/**
 * src/services/scheduling/aiAdapter.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Camada opcional de otimização via Gemini.
 *
 * CONTRATO ABSOLUTO:
 *   • Este arquivo NUNCA lança exceção.
 *   • otimizarComIA() sempre retorna slots válidos — os originais em caso de
 *     qualquer falha (rede, timeout, JSON inválido, schema errado, API key
 *     ausente, ou qualquer outro erro).
 *   • A IA NUNCA altera minutosEstudo. Só reordena/escolhe assuntos.
 *   • Imports de Firebase limitados ao SDK de Functions (httpsCallable).
 *
 * Responsabilidade única:
 *   Dado um semanaTemplate JÁ GERADO por gerarSchedule() (com minutos corretos),
 *   pedir ao Gemini que reordene os assuntos de forma estratégica — respeitando
 *   a lógica do edital, o nível do aluno e o espalhamento entre dias.
 */

// ─── PROXY SEGURO via Firebase Functions ─────────────────────────────────────
// A VITE_GEMINI_API_KEY foi REMOVIDA do cliente.
// Todas as chamadas ao Gemini passam pela Cloud Function "chamarGemini",
// que mantém a API key no servidor (Firebase Secret Manager).

import { getFunctions, httpsCallable } from 'firebase/functions';


const _functions         = getFunctions();
const _chamarGeminiProxy = httpsCallable(_functions, 'chamarGemini');

// ─── SYSTEM PROMPT ────────────────────────────────────────────────────────────
//
// Simplificado em relação ao cronogramaIA.js original:
//   • A IA não decide quem recebe qual bloco — o back-end já fez isso.
//   • A IA não toca em minutosEstudo — esses valores são imutáveis.
//   • A única responsabilidade é escolher QUAL assunto do edital vai em cada slot,
//     na ordem que fizer mais sentido pedagogicamente.

const SYSTEM_PROMPT = `
Você é o assistente de planejamento de estudos do sistema MODOQAP.
O back-end já calculou e distribuiu os blocos de estudo (com tempo em minutos fixo por bloco).
Sua única tarefa: escolher QUAL assunto do edital deve ser estudado em cada slot.

REGRAS — LEIA COM ATENÇÃO:

1. FIDELIDADE AO EDITAL: use apenas assuntos da lista [ASSUNTOS_DISPONIVEIS] de cada disciplina.
   Não invente tópicos. Não repita o mesmo assunto no mesmo dia quando houver outros disponíveis.

2. ORDEM LÓGICA: prefira a sequência natural do edital (pré-requisitos antes de dependentes).
   Não é obrigatório seguir a ordem linear — pode adiantar assuntos se fizer sentido pedagógico.

3. ESPALHAMENTO: distribua assuntos diferentes para slots da mesma disciplina em dias distintos.
   Evite repetir o mesmo assunto em dias consecutivos.

4. NÃO ALTERE: slotId, dia, disciplinaId, disciplinaNome, minutosEstudo ou qualquer outro campo.
   Retorne APENAS o campo "assunto" modificado para cada slot. Todos os outros campos são copiados.

5. RESPOSTA COMPLETA: inclua TODOS os slots no JSON. Não omita nenhum slotId.

ESTRUTURA DE SAÍDA (JSON puro, sem markdown, sem blocos de código):
{
  "slots": [
    {
      "slotId": "s0-0",
      "assunto": "Tópico escolhido do edital"
    }
  ]
}
`.trim();

// ─── HELPER: CHAMADA AO GEMINI VIA PROXY (Firebase Function) ────────────────

/**
 * Envia um prompt para a Cloud Function "chamarGemini" e retorna o texto bruto.
 * A API key NÃO está no cliente — fica exclusivamente no servidor.
 * Lança exceção em caso de falha — o caller (otimizarComIA) faz o catch.
 *
 * @param {string} prompt - texto completo do prompt
 * @param {number} [maxOutputTokens=2048]
 * @returns {Promise<string>} texto bruto da resposta
 * @throws {Error} em caso de falha de rede, Function error ou resposta vazia
 */
export async function chamarGeminiREST(prompt, maxOutputTokens = 2048) {
  const result = await _chamarGeminiProxy({ prompt, maxOutputTokens });
  const payload = result?.data ?? result;

  if (typeof payload?.text === 'string' && payload.text.trim()) {
    return payload.text.trim();
  }

  const partes =
    payload?.candidates?.[0]?.content?.parts ||
    payload?.content?.parts ||
    [];

  if (Array.isArray(partes) && partes.length > 0) {
    const texto = partes
      .map((p) => (typeof p?.text === 'string' ? p.text : ''))
      .filter(Boolean)
      .join('\n')
      .trim();
    if (texto) return texto;
  }

  return '';
}

// ─── HELPER: EXTRAÇÃO DE JSON DA RESPOSTA ────────────────────────────────────

/**
 * Remove markdown wrapping (```json ... ```) e retorna o JSON parseado.
 * Retorna null se a string for vazia ou o parse falhar.
 *
 * @param {string} raw - texto bruto vindo do Gemini
 * @returns {any|null} objeto parseado ou null
 */
function extrairJSON(raw) {
  if (!raw || typeof raw !== 'string') return null;

  // Remove blocos de código markdown: ```json ... ``` ou ``` ... ```
  const limpo = raw
    .replace(/```json\s*/gi, '')
    .replace(/```\s*/g, '')
    .trim();

  if (!limpo) return null;

  try {
    return JSON.parse(limpo);
  } catch {
    // Extrai o primeiro objeto/array JSON balanceado.
    const inicios = ['{', '['];
    for (const inicio of inicios) {
      const idx = limpo.indexOf(inicio);
      if (idx < 0) continue;

      const abre = inicio;
      const fecha = inicio === '{' ? '}' : ']';
      let depth = 0;

      for (let i = idx; i < limpo.length; i++) {
        const ch = limpo[i];
        if (ch === abre) depth++;
        if (ch === fecha) depth--;
        if (depth === 0) {
          const trecho = limpo.slice(idx, i + 1);
          try {
            return JSON.parse(trecho);
          } catch {
            break;
          }
        }
      }
    }
    return null;
  }
}

// ─── VALIDAÇÃO DE SCHEMA ──────────────────────────────────────────────────────

/**
 * Valida se a resposta da IA tem o schema esperado.
 *
 * Schema esperado:
 * {
 *   slots: Array<{ slotId: string, assunto: string }>
 * }
 *
 * Critérios de rejeição:
 *   - Não é objeto
 *   - Não tem chave "slots"
 *   - "slots" não é array
 *   - Array vazio
 *   - Algum item sem slotId (string não-vazia)
 *   - Algum item sem assunto (string não-vazia)
 *
 * @param {any} resposta - objeto parseado da resposta da IA
 * @returns {boolean} true se válido, false para qualquer formato inválido
 */
export function validarRespostaIA(resposta) {
  if (!resposta || typeof resposta !== 'object' || Array.isArray(resposta)) return false;
  if (!Array.isArray(resposta.slots)) return false;
  if (resposta.slots.length === 0) return false;

  return resposta.slots.every(
    item =>
      item &&
      typeof item === 'object' &&
      typeof item.slotId  === 'string' && item.slotId.trim()  !== '' &&
      typeof item.assunto === 'string' && item.assunto.trim() !== '',
  );
}

/**
 * Normaliza formatos comuns de retorno da IA para o schema interno:
 * { slots: [{ slotId, assunto }] }.
 *
 * Aceita aliases frequentes como:
 * - raiz em array
 * - campos "items" ou "resultado"
 * - item.id / item.slot / item.slotID
 * - item.topic / item.tema / item.conteudo
 *
 * @param {any} resposta
 * @returns {{slots: Array<{slotId: string, assunto: string}>} | null}
 */
function normalizarRespostaIA(resposta) {
  if (!resposta) return null;

  let lista = null;
  if (Array.isArray(resposta)) lista = resposta;
  else if (Array.isArray(resposta.slots)) lista = resposta.slots;
  else if (Array.isArray(resposta?.data?.slots)) lista = resposta.data.slots;
  else if (Array.isArray(resposta?.output?.slots)) lista = resposta.output.slots;
  else if (Array.isArray(resposta.items)) lista = resposta.items;
  else if (Array.isArray(resposta.resultado)) lista = resposta.resultado;
  else if (Array.isArray(resposta?.resultado?.slots)) lista = resposta.resultado.slots;

  if (!Array.isArray(lista) || lista.length === 0) return null;

  const slots = lista
    .map((item) => {
      const slotId = (
        item?.slotId ?? item?.slotID ?? item?.id ?? item?.slot ?? ''
      ).toString().trim();
      const assunto = (
        item?.assunto ?? item?.topic ?? item?.tema ?? item?.conteudo ?? ''
      ).toString().trim();
      if (!slotId || !assunto) return null;
      return { slotId, assunto };
    })
    .filter(Boolean);

  if (slots.length === 0) return null;
  return { slots };
}

// ─── MONTAGEM DO PROMPT DE USUÁRIO ───────────────────────────────────────────

/**
 * Monta o prompt de usuário com os slots existentes e os assuntos disponíveis
 * por disciplina, sem incluir minutosEstudo ou outros campos imutáveis.
 *
 * @param {SlotTemplate[]} slots - slots gerados por gerarSchedule()
 * @param {Array<{id, nome, nivel, assuntos}>} disciplinas
 * @returns {string}
 */
function montarPromptUsuario(slots, disciplinas) {
  // Índice de assuntos por disciplinaId
  const assuntosPorDisc = {};
  disciplinas.forEach(d => {
    assuntosPorDisc[d.id] = {
      nome:     d.nome,
      nivel:    d.nivel,
      assuntos: d.assuntos || [],
    };
  });

  // Lista de slots simplificada (sem minutosEstudo — a IA não deve ver nem alterar)
  const slotsResumidos = slots.map(s => ({
    slotId:         s.slotId,
    dia:            s.dia,
    disciplinaId:   s.disciplinaId,
    disciplinaNome: s.disciplinaNome,
    nivel:          s.nivel,
    assuntoAtual:   s.assunto || '',
  }));

  // Assuntos disponíveis por disciplina (limitado a 30 para não explodir o contexto)
  const edital = {};
  Object.entries(assuntosPorDisc).forEach(([id, info]) => {
    edital[info.nome] = {
      nivel:    info.nivel,
      assuntos: info.assuntos.slice(0, 30),
    };
  });

  return (
    `[SLOTS_PARA_OTIMIZAR]:\n${JSON.stringify(slotsResumidos, null, 2)}\n\n` +
    `[ASSUNTOS_DISPONIVEIS]:\n${JSON.stringify(edital, null, 2)}\n\n` +
    `Retorne o JSON com os assuntos otimizados. ` +
    `Inclua TODOS os ${slots.length} slots. Apenas o campo "assunto" muda.`
  );
}

// ─── APLICAÇÃO DOS ASSUNTOS OTIMIZADOS ───────────────────────────────────────

/**
 * Mescla os assuntos retornados pela IA nos slots originais.
 * Campos imutáveis (minutosEstudo, disciplinaId, etc.) são SEMPRE preservados
 * do slot original — a IA não pode alterá-los.
 *
 * Se a IA retornou um slotId que não existe no original, ele é ignorado.
 * Se um slot original não foi coberto pela IA, mantém o assunto original.
 *
 * @param {SlotTemplate[]} slotsOriginais
 * @param {Array<{slotId: string, assunto: string}>} assuntosIA
 * @returns {SlotTemplate[]} slots com assuntos atualizados
 */
function aplicarAssuntosIA(slotsOriginais, assuntosIA) {
  const mapaIA = {};
  assuntosIA.forEach(item => {
    if (item.slotId && item.assunto) {
      mapaIA[item.slotId] = item.assunto.trim();
    }
  });

  return slotsOriginais.map(slot => {
    const assuntoOtimizado = mapaIA[slot.slotId];
    if (!assuntoOtimizado) return slot; // mantém original se a IA não cobriu

    return {
      ...slot,
      assunto: assuntoOtimizado,
      // Garante que campos imutáveis não foram adulterados
      minutosEstudo:  slot.minutosEstudo,
      disciplinaId:   slot.disciplinaId,
      disciplinaNome: slot.disciplinaNome,
      nivel:          slot.nivel,
      pesoEfetivo:    slot.pesoEfetivo,
      isRevisao:      slot.isRevisao,
      pinned:         slot.pinned,
    };
  });
}

// ─── FUNÇÃO PRINCIPAL EXPORTADA ───────────────────────────────────────────────

/**
 * Otimiza a ordem/escolha de assuntos nos slots usando o Gemini.
 *
 * Recebe o template JÁ GERADO por gerarSchedule() e pede à IA que escolha
 * os assuntos de forma estratégica. MinutosEstudo e todos os outros campos
 * estruturais são IMUTÁVEIS — a IA só toca em "assunto".
 *
 * CONTRATO: esta função NUNCA lança exceção. Em qualquer falha, retorna
 * os slots originais sem modificação.
 *
 * @param {SlotTemplate[]} slots - template gerado por gerarSchedule()
 * @param {Array<{id, nome, nivel, assuntos}>} disciplinas
 * @param {{}} [opcoes={}] - reservado para extensões futuras
 * @returns {Promise<SlotTemplate[]>} slots com assuntos otimizados ou originais
 */
export async function otimizarComIA(slots, disciplinas, opcoes = {}) {
  // Guarda de entrada — retorna original imediatamente se dados insuficientes
  if (!slots?.length || !disciplinas?.length) return slots ?? [];

  try {
    // Verifica se há assuntos para otimizar (sem assuntos, a IA não agrega valor)
    const temAssuntos = disciplinas.some(d => d.assuntos?.length > 0);
    if (!temAssuntos) return slots;

    const promptUsuario = montarPromptUsuario(slots, disciplinas);
    const fullPrompt    = SYSTEM_PROMPT + '\n\n' + promptUsuario;

    // Estima tokens de saída: ~40 tokens por slot (slotId + assunto + estrutura JSON)
    const maxOutputTokens = Math.min(4096, Math.max(512, slots.length * 40));

    const raw     = await chamarGeminiREST(fullPrompt, maxOutputTokens);
    const parsed  = extrairJSON(raw);
    const normalizada = normalizarRespostaIA(parsed);

    if (!validarRespostaIA(normalizada)) {
      // Schema inválido — fallback silencioso para não poluir console.
      if (import.meta.env?.DEV && opcoes?.debugIA) {
        console.info('[aiAdapter] Schema inválido da IA; mantendo slots originais.');
      }
      return slots;
    }

    // Verifica cobertura mínima: a IA deve ter retornado pelo menos 50% dos slots
    // (proteção contra respostas truncadas)
    const cobertura = normalizada.slots.length / slots.length;
    if (cobertura < 0.5) {
      if (import.meta.env?.DEV && opcoes?.debugIA) {
        console.info(
          `[aiAdapter] Cobertura insuficiente: ${normalizada.slots.length}/${slots.length} slots. ` +
          `Usando originais.`
        );
      }
      return slots;
    }

    const slotsOtimizados = aplicarAssuntosIA(slots, normalizada.slots);

    if (import.meta.env?.DEV && opcoes?.debugIA) {
      const alterados = slotsOtimizados.filter((s, i) => s.assunto !== slots[i].assunto).length;
      console.info(`[aiAdapter] ✅ Otimização aplicada: ${alterados}/${slots.length} assuntos alterados.`);
    }

    return slotsOtimizados;

  } catch (err) {
    // Qualquer erro (rede, timeout, parse, API key) → retorna original
    if (import.meta.env?.DEV && opcoes?.debugIA) {
      console.info('[aiAdapter] Falha na otimização via IA; mantendo slots originais.', err?.message ?? err);
    }
    return slots;
  }
}

// ─── FUNÇÕES DE IA AUXILIARES ─────────────────────────────────────────────────
// Movidas de cronogramaIA.js para centralizar toda comunicação com o Gemini.
// Re-exportadas por cronogramaIA.js para manter compatibilidade de imports.

const parseIA = (raw) =>
  JSON.parse(raw.replace(/```json/gi, '').replace(/```/g, '').trim());

export async function sugerirNivelDisciplinas(disciplinas, editalNome = '') {
  if (!disciplinas?.length) return {};
  const prompt = `Você é especialista em concursos brasileiros. Analise as disciplinas do concurso "${editalNome}" e retorne o nível sugerido para um candidato típico.
CRITÉRIOS: "iniciante"=extenso/abstrato (mais tempo necessário), "intermediario"=volume médio, "avancado"=enxuto/familiar.
DISCIPLINAS:\n${disciplinas.map(d => `- ${d.nome} (${d.assuntos?.length || 0} tópicos)`).join('\n')}
JSON APENAS: {"sugestoes":{"Nome da Disciplina":"iniciante|intermediario|avancado"},"resumo":"frase curta"}`;
  try {
    const p = parseIA(await chamarGeminiREST(prompt));
    const mapa = {};
    disciplinas.forEach(d => {
      const s = p?.sugestoes?.[d.nome];
      if (s && ['iniciante', 'intermediario', 'avancado'].includes(s)) mapa[d.id] = s;
    });
    return { niveis: mapa, resumo: p?.resumo || '' };
  } catch { return { niveis: {}, resumo: '' }; }
}

export async function detectarSobrecarga(disciplinas, horarios, dataProva = null) {
  const tt = disciplinas.reduce((a, d) => a + (d.assuntos?.length || 1), 0);
  const th = Object.values(horarios).reduce((a, h) => a + Number(h || 0), 0);
  const prompt = `Analise se a carga de estudo é viável: ${tt} tópicos, ${th}h/semana, prova: ${dataProva || 'não informada'}.
Disciplinas: ${disciplinas.map(d => `${d.nome}(${d.assuntos?.length || 0})`).join(', ')}.
JSON APENAS: {"viavel":true,"alerta":"","sugestoes":[],"semanasEstimadas":0}`;
  try { return parseIA(await chamarGeminiREST(prompt)); }
  catch { return { viavel: true, alerta: '', sugestoes: [], semanasEstimadas: null }; }
}

export async function analisarProgressoIA(cronograma, progresso) {
  const prompt = `Analise o progresso deste candidato a concurso.
Semanas: ${cronograma.totalSemanasNecessarias || 0}, Slots: ${progresso.slotsCompletos || 0}/${progresso.totalSlots || 0}, Adesão: ${progresso.taxaAdesao || 0}%.
JSON APENAS: {"resumo":"","notaGeral":"bom","insights":[],"sugestoes":[],"proximoFoco":null}`;
  try { return parseIA(await chamarGeminiREST(prompt, 1024)); }
  catch { return { resumo: 'Não foi possível analisar o progresso.', notaGeral: 'bom', insights: [], sugestoes: [], proximoFoco: null }; }
}

export async function gerarMensagemDia(contexto) {
  const prompt = `Gere UMA frase motivacional curta (máx 120 chars) para candidato a concurso. ${contexto.slotsDia || 0} matérias hoje, ${contexto.taxaAdesao || 0}% de adesão. Sem emojis, sem "guerreiro"/"campeão"/"rumo à aprovação". Retorne APENAS o texto.`;
  try {
    let t = (await chamarGeminiREST(prompt, 200)).trim().replace(/^["«]/, '').replace(/["»]$/, '');
    return t.length > 140 ? t.slice(0, 137) + '...' : t;
  } catch { return `${contexto.slotsDia || 0} matéria(s) no plano de hoje. Bom estudo.`; }
}
