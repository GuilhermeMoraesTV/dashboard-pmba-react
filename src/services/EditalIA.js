// src/services/editalIA.js
// Serviço para gerar resumos de atualização de editais via IA (Gemini Flash)

import { chamarGeminiREST } from './scheduling/aiAdapter';

/**
 * Converte o título bruto do edital em forma legível e natural.
 *
 * Exemplos:
 *   "PMBA Soldado"           → "concurso da PMBA para o cargo de Soldado"
 *   "PCBA Investigador"      → "concurso da PCBA para o cargo de Investigador"
 *   "GCM Salvador - BA"      → "concurso da GCM de Salvador"
 *   "DEPEN"                  → "concurso do DEPEN"
 *   "Concurso Federal 2026"  → "Concurso Federal 2026"
 */
export function formatarNomeEditalLegivel(titulo) {
  if (!titulo) return 'este concurso';

  // Remove anos soltos no final (ex: "PMBA 2026" → "PMBA")
  const semAno = titulo.replace(/\s+\d{4}$/, '').trim();

  // Padrão explícito "SIGLA - Cargo" ou "SIGLA – Cargo"
  const matchExplicito = semAno.match(/^([A-ZÁÉÍÓÚÂÊÔÃÕÇ]{2,10}(?:\s[A-ZÁÉÍÓÚÂÊÔÃÕÇ]{2,4})?)\s*[-–]\s*(.+)$/);
  if (matchExplicito) {
    const sigla = matchExplicito[1].trim();
    const resto = matchExplicito[2].trim();
    if (_ehCargo(resto)) return `concurso da ${sigla} para o cargo de ${resto}`;
    if (_ehLocalidade(resto)) return `concurso da ${sigla} de ${resto}`;
    return `concurso da ${sigla} (${resto})`;
  }

  // Padrão "SIGLA Cargo" (sem separador)
  const matchJunto = semAno.match(/^([A-ZÁÉÍÓÚÂÊÔÃÕÇ]{2,8}(?:[A-ZÁÉÍÓÚÂÊÔÃÕÇ]{2})?)\s+(.+)$/);
  if (matchJunto) {
    const sigla = matchJunto[1].trim();
    const resto = matchJunto[2].trim();
    if (_ehCargo(resto)) return `concurso da ${sigla} para o cargo de ${resto}`;
    if (_ehLocalidade(resto)) return `concurso da ${sigla} de ${resto}`;
    return `concurso da ${sigla} (${resto})`;
  }

  // Apenas sigla (ex: "DEPEN", "PF", "PRF")
  if (/^[A-ZÁÉÍÓÚÂÊÔÃÕÇ]{2,10}$/.test(semAno)) {
    return `concurso do ${semAno}`;
  }

  return `concurso ${titulo}`;
}

const _CARGOS = new Set([
  'soldado','oficial','agente','investigador','escrivão','escrivao','delegado',
  'perito','condutor','guarda','inspetor','cadete','aprendiz','tenente',
  'sargento','policial','assistente','analista','técnico','tecnico','auxiliar',
  'professor','auditor','contador','gestor','secretário','secretario',
  'fuzileiro','marinheiro','cabo','sub-inspetor','subinspetor','musico',
  'músico','papiloscopista','policial penal','agente penitenciário',
]);

function _ehCargo(s) {
  const norm = s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  return [..._CARGOS].some((c) =>
    norm.startsWith(c.normalize('NFD').replace(/[\u0300-\u036f]/g, ''))
  );
}

// Estados e cidades conhecidas
const _LOCALIDADES = new Set([
  'salvador','fortaleza','recife','manaus','belém','belem','porto alegre',
  'curitiba','florianópolis','florianopolis','goiânia','goiania','campo grande',
  'cuiabá','cuiaba','teresina','natal','joão pessoa','joao pessoa','maceió',
  'maceio','aracaju','macapá','macapa','porto velho','rio branco','boa vista',
  'palmas',
]);

function _ehLocalidade(s) {
  const norm = s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  return [..._LOCALIDADES].some((l) =>
    norm.startsWith(l.normalize('NFD').replace(/[\u0300-\u036f]/g, ''))
  );
}

// ─── Gerador principal ────────────────────────────────────────────────────────

/**
 * Gera um resumo informativo e objetivo para notificar os alunos.
 *
 * @param {string} tituloEdital - Ex: "PMBA Soldado" ou "GCM Salvador - BA"
 * @param {string} tipoAtualizacao - "LANCAMENTO" | "RETIFICACAO" | "AJUSTE_INTERNO"
 * @param {string} diffDescricao - O que mudou, ex: "adicionadas 3 disciplinas: Português..."
 * @returns {Promise<string>} Texto pronto para exibir no modal de notificação
 */
export async function gerarResumoAtualizacaoIA(
  tituloEdital,
  tipoAtualizacao,
  diffDescricao
) {
  const nomeFormatado = formatarNomeEditalLegivel(tituloEdital);

  const configs = {
    LANCAMENTO: {
      instrucao: `Escreva uma frase informativa curta (máx 160 caracteres) anunciando que um edital de concurso foi publicado oficialmente.`,
      exemplos: [
        'O edital da PMBA para o cargo de Soldado foi publicado com 600 vagas.',
        'O concurso da GCM de Salvador abriu inscrições para 80 vagas no cargo de Inspetor.',
        'O edital do DEPEN para Policial Penal foi lançado com 1.500 vagas.',
        'O concurso da PCBA para Investigador está aberto com provas previstas para março.',
      ],
      restricoes: [
        'NÃO use frases motivacionais: "chegou a hora", "prepare-se já", "rumo à aprovação"',
        'NÃO use vocativo como "candidato(a)", "concurseiros"',
        'NÃO comece com "Atenção" ou "Fique atento"',
        'Seja factual, como uma nota de jornal',
      ],
    },

    RETIFICACAO: {
      instrucao: `Escreva uma frase técnica e direta (máx 160 caracteres) informando que houve uma retificação oficial publicada pela banca deste concurso.`,
      exemplos: [
        'A banca retificou o edital da PMBA: foram alteradas as datas de prova e o conteúdo de Informática.',
        'O edital da PCBA foi retificado com correção nos requisitos de altura para Soldado.',
        'A GCM de Fortaleza publicou retificação modificando a distribuição de vagas por região.',
        'A banca do concurso do DEPEN publicou retificação corrigindo o cronograma de inscrições.',
      ],
      restricoes: [
        'NÃO use "atenção candidatos", "fique atento", "urgente"',
        'NÃO use linguagem alarmista',
        'Comece mencionando a banca ou o edital diretamente',
        'Tom neutro e técnico, como nota oficial',
      ],
    },

    AJUSTE_INTERNO: {
      instrucao: `Escreva uma frase informativa curta (máx 150 caracteres) explicando que houve uma revisão técnica no conteúdo programático cadastrado nesta plataforma. NÃO é uma alteração oficial da banca — é uma correção de cadastro interno.`,
      exemplos: [
        'O conteúdo programático da PMBA foi revisado: ajustes em Português e atualização em Legislação.',
        'O programa da PCBA foi atualizado com reorganização em Raciocínio Lógico e correções em Direito.',
        'O conteúdo cadastrado para o concurso da GCM foi corrigido com adição de novos tópicos.',
        'Revisão técnica no programa do DEPEN: inclusão de novos assuntos em Informática e Direito Penal.',
      ],
      restricoes: [
        'NÃO diga "visa otimizar sua preparação", "focando nos pontos cruciais", "para sua aprovação"',
        'NÃO mencione a plataforma, o app ou o sistema',
        'NÃO use "você", "candidato", "aluno"',
        'NÃO diga que é "para melhorar sua experiência"',
        'Descreva apenas O QUE mudou no conteúdo, de forma objetiva',
      ],
    },
  };

  const cfg = configs[tipoAtualizacao] || configs.AJUSTE_INTERNO;

  const restricoesFormatadas = cfg.restricoes
    .map((r, i) => `${i + 1}. ${r}`)
    .join('\n');

  const exemplosFormatados = cfg.exemplos
    .map((e, i) => `Exemplo ${i + 1}: "${e}"`)
    .join('\n');

  const prompt = `${cfg.instrucao}

CONCURSO: ${nomeFormatado}
ALTERAÇÕES DETECTADAS: ${diffDescricao}

${exemplosFormatados}

REGRAS OBRIGATÓRIAS:
${restricoesFormatadas}
${cfg.restricoes.length + 1}. Máximo de 160 caracteres no total
${cfg.restricoes.length + 2}. Mencione o concurso como: "${nomeFormatado}"
${cfg.restricoes.length + 3}. Sem emojis, sem exclamações excessivas
${cfg.restricoes.length + 4}. Retorne APENAS o texto final, sem aspas, sem prefixo como "Texto:" ou explicações

TEXTO:`;

  try {
    let texto = (await chamarGeminiREST(prompt, 512)).trim();

    // Remove aspas e prefixos que o modelo ocasionalmente inclui
    texto = texto
      .replace(/^["'""\u201C\u201D]|["'""\u201C\u201D]$/g, '')
      .replace(/^(Texto:|Resposta:|Output:)\s*/i, '')
      .trim();

    // Corta se muito longo
    if (texto.length > 200) texto = texto.slice(0, 197) + '...';

    // Validação básica: rejeita se tiver frases proibidas
    const proibidas = [
      'prepare-se',
      'chegou a hora',
      'rumo à aprovação',
      'sua aprovação',
      'otimizar sua',
      'focando nos pontos',
      'melhorar sua experiência',
      'nossa plataforma',
      'o aplicativo',
      'candidatos,',
      'fique atento',
    ];
    const textoLower = texto.toLowerCase();
    const temProibida = proibidas.some((p) => textoLower.includes(p));

    if (temProibida || texto.length < 20) {
      return getFallback(tipoAtualizacao, nomeFormatado, diffDescricao);
    }

    return texto;
  } catch (err) {
    console.error('[editalIA] erro ao gerar resumo:', err);
    return getFallback(tipoAtualizacao, nomeFormatado, diffDescricao);
  }
}

/** Fallbacks de qualidade sem depender da IA */
function getFallback(tipoAtualizacao, nomeFormatado, diffDescricao) {
  const descCurta = diffDescricao
    ? `: ${diffDescricao.slice(0, 80)}${diffDescricao.length > 80 ? '...' : ''}`
    : '';

  const fallbacks = {
    LANCAMENTO: `O ${nomeFormatado} foi publicado oficialmente. Sincronize seu ciclo para estudar com o conteúdo atualizado.`,
    RETIFICACAO: `A banca publicou uma retificação para o ${nomeFormatado}. Verifique as alterações e atualize seu ciclo.`,
    AJUSTE_INTERNO: `O conteúdo programático do ${nomeFormatado} foi revisado com correções técnicas${descCurta}.`,
  };
  return fallbacks[tipoAtualizacao] || `O ${nomeFormatado} foi atualizado. Sincronize seu ciclo de estudos.`;
}

// ─── Helpers públicos ─────────────────────────────────────────────────────────

/**
 * Gera descrição textual do diff para usar no prompt da IA.
 */
export function gerarDescricaoDiff(diff) {
  const partes = [];

  if (diff?.novasDisciplinas?.length > 0) {
    const nomes = diff.novasDisciplinas.map((d) => d.nome).join(', ');
    partes.push(
      `adicionada${diff.novasDisciplinas.length > 1 ? 's' : ''} ${diff.novasDisciplinas.length} disciplina${diff.novasDisciplinas.length > 1 ? 's' : ''}: ${nomes}`
    );
  }

  if (diff?.disciplinasComNovosAssuntos?.length > 0) {
    const total = diff.disciplinasComNovosAssuntos.reduce(
      (a, d) => a + d.novosAssuntos.length,
      0
    );
    const detalhe = diff.disciplinasComNovosAssuntos
      .map(
        (d) =>
          `${d.nome} (+${d.novosAssuntos.length} assunto${d.novosAssuntos.length > 1 ? 's' : ''})`
      )
      .join(', ');
    partes.push(
      `${total} novo${total > 1 ? 's' : ''} assunto${total > 1 ? 's' : ''} em: ${detalhe}`
    );
  }

  if (diff?.disciplinasRemovidas?.length > 0) {
    const nomes = diff.disciplinasRemovidas.map((d) => d.nome).join(', ');
    partes.push(
      `removida${diff.disciplinasRemovidas.length > 1 ? 's' : ''} ${diff.disciplinasRemovidas.length} disciplina${diff.disciplinasRemovidas.length > 1 ? 's' : ''}: ${nomes}`
    );
  }

  if (diff?.disciplinasComAssuntosRemovidos?.length > 0) {
    const total = diff.disciplinasComAssuntosRemovidos.reduce(
      (a, d) => a + d.assuntosRemovidos.length,
      0
    );
    partes.push(
      `${total} assunto${total > 1 ? 's' : ''} removido${total > 1 ? 's' : ''} de ${diff.disciplinasComAssuntosRemovidos.length} disciplina${diff.disciplinasComAssuntosRemovidos.length > 1 ? 's' : ''}`
    );
  }

  return partes.length > 0
    ? partes.join('; ')
    : 'ajustes gerais no conteúdo cadastrado';
}

/**
 * Determina se um ajuste interno deve gerar notificação visível.
 *
 * Regras:
 * - LANCAMENTO e RETIFICACAO: sempre notifica
 * - AJUSTE_INTERNO: só notifica se houver mudanças substantivas (evita spam por correções de grafia)
 *
 * @param {string} tipoAtualizacao
 * @param {object} diff
 * @returns {boolean}
 */
export function deveNotificarAluno(tipoAtualizacao, diff) {
  if (tipoAtualizacao === 'LANCAMENTO' || tipoAtualizacao === 'RETIFICACAO') {
    return true;
  }

  if (!diff) return false;

  const novasDisciplinas = diff.novasDisciplinas?.length || 0;
  const disciplinasRemovidas = diff.disciplinasRemovidas?.length || 0;
  const novosAssuntos = diff.disciplinasComNovosAssuntos?.reduce(
    (a, d) => a + d.novosAssuntos.length,
    0
  ) || 0;
  const assuntosRemovidos = diff.disciplinasComAssuntosRemovidos?.reduce(
    (a, d) => a + d.assuntosRemovidos.length,
    0
  ) || 0;

  // Notifica ajuste interno apenas se:
  // - Há disciplinas novas ou removidas
  // - Ou 3+ assuntos alterados (ignora correções de grafia isoladas)
  const totalMudancas =
    novasDisciplinas + disciplinasRemovidas + novosAssuntos + assuntosRemovidos;

  return novasDisciplinas > 0 || disciplinasRemovidas > 0 || totalMudancas >= 3;
}
