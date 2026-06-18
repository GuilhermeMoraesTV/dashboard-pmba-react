// src/services/noticiaIA.js
import { chamarGeminiREST } from './scheduling/aiAdapter';
import { db } from '../firebaseConfig';
import { doc, getDoc } from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { app } from '../firebaseConfig';

export const artigoCache = new Map();
export const listaCache  = new Map();

const functions = getFunctions(app);
const salvarNoticiaCacheCallable = httpsCallable(functions, 'salvarNoticiaCache');

// ─── CACHE FIRESTORE ─────────────────────────────────────────────────────────
// TTL de 24h — artigos são reprocessados uma vez por dia no máximo
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

// Converte uma URL em chave segura para documento Firestore
function urlParaChaveFirestore(url) {
  return url
    .replace(/https?:\/\//, '')
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .slice(0, 500);
}

async function lerCacheFirestore(url) {
  try {
    const chave = urlParaChaveFirestore(url);
    const ref   = doc(db, 'noticiaCache', chave);
    const snap  = await getDoc(ref);
    if (!snap.exists()) return null;
    const dados = snap.data();
    // Verifica TTL
    const savedAt = dados._savedAt?.toMillis?.() || 0;
    if (Date.now() - savedAt > CACHE_TTL_MS) return null;
    return dados.artigo ?? null;
  } catch { return null; }
}

async function salvarCacheFirestore(url, artigo) {
  if (!artigo) return;
  try {
    await salvarNoticiaCacheCallable({ url, artigo });
  } catch { /* falha silenciosa — cache é best-effort */ }
}

// ─── STATUS VÁLIDOS ───────────────────────────────────────────────────────────
// Lista exaustiva de status semânticos permitidos no campo "status".
// Qualquer valor fora desta lista deve ser descartado e ficar vazio.
export const STATUS_VALIDOS = [
  'Previsto',
  'Autorizado',
  'Comissão Formada',
  'Banca Definida',
  'Edital Publicado',
  'Suspenso',
  'Encerrado',
  'Em Análise',
  'Anunciado',
];

/**
 * Normaliza um valor de status retornado pela IA ou extraído do HTML.
 * Aceita apenas termos da lista STATUS_VALIDOS (com tolerância a acentos/case).
 * Se o valor não casar com nenhum, retorna string vazia.
 */
export function normalizarStatus(valor = '') {
  if (!valor || typeof valor !== 'string') return '';

  const v = valor
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // remove acentos
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();

  const mapa = {
    'previsto':          'Previsto',
    'autorizado':        'Autorizado',
    'comissao formada':  'Comissão Formada',
    'comissão formada':  'Comissão Formada',
    'banca definida':    'Banca Definida',
    'definindo banca':   'Banca Definida',
    'edital publicado':  'Edital Publicado',
    'inscricoes abertas':'Edital Publicado',
    'inscrições abertas':'Edital Publicado',
    'suspenso':          'Suspenso',
    'cancelado':         'Suspenso',
    'encerrado':         'Encerrado',
    'em analise':        'Em Análise',
    'em análise':        'Em Análise',
    'anunciado':         'Anunciado',
  };

  // Correspondência exata
  if (mapa[v]) return mapa[v];

  // Correspondência parcial (para casos como "Banca Definida - INDEPAC")
  for (const [chave, status] of Object.entries(mapa)) {
    if (v.startsWith(chave) || v.includes(chave)) return status;
  }

  return '';
}

const TERMOS_FORTE_CONCURSO_RE = /\b(concurso|edital|banca|inscric|gabarito|convoca|nomea|retifica|vagas?|salario|prova|cargo)\b/i;

function normalizarTextoBusca(valor = '') {
  return String(valor || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function pareceConteudoConcurso({ titulo = '', resumo = '', link = '', texto = '' }) {
  const corpus = [titulo, resumo, link, texto].join(' ').slice(0, 3000);
  const normalizado = normalizarTextoBusca(corpus);
  return TERMOS_FORTE_CONCURSO_RE.test(normalizado);
}

// ─── HELPER: chama Gemini via fetch ─────────────────────────────────────────
async function chamarGemini(prompt) {
  return chamarGeminiREST(prompt, 4096, { surface: 'noticias' });
}

// ─── HELPER: extrai JSON de resposta que pode ter markdown ──────────────────
function extrairJSON(texto) {
  if (!texto) return null;
  const limpo = texto
    .replace(/```json\s*/gi, '')
    .replace(/```\s*/g, '')
    .trim();

  // Tenta parse direto primeiro
  try { return JSON.parse(limpo); } catch { /* segue */ }

  // Busca SEMPRE pelo objeto raiz { primeiro (nunca array — o retorno esperado é sempre objeto)
  const idxObj = limpo.indexOf('{');
  if (idxObj >= 0) {
    let depth = 0;
    let dentroString = false;
    let escape = false;
    for (let i = idxObj; i < limpo.length; i++) {
      const ch = limpo[i];
      if (escape) { escape = false; continue; }
      if (ch === '\\' && dentroString) { escape = true; continue; }
      if (ch === '"') { dentroString = !dentroString; continue; }
      if (dentroString) continue;
      if (ch === '{') depth++;
      if (ch === '}') depth--;
      if (depth === 0) {
        const trecho = limpo.slice(idxObj, i + 1);
        try { return JSON.parse(trecho); } catch { break; }
      }
    }
  }
  return null;
}

function escaparHtml(valor = '') {
  return String(valor || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function montarHtmlFallback({ noticia, dados = {}, textoFonte = '' }) {
  const resumo = String(dados?.resumo_limpo || noticia?.resumo || textoFonte || '').trim();
  const resumoCurto = resumo.split(/\s+/).slice(0, 180).join(' ').trim();

  const itensTabela = [
    ['Órgão', dados?.orgao || 'A definir'],
    ['Status', dados?.status || dados?.quadro?.situacao || 'A definir'],
    ['Banca', dados?.banca || dados?.quadro?.banca || 'A definir'],
    ['Vagas', dados?.vagas || dados?.quadro?.vagas || 'A definir'],
    ['Salário', dados?.salario_maximo || dados?.quadro?.salario || 'A definir'],
  ];

  const linhas = itensTabela
    .map(([campo, valor]) => `<tr><td>${escaparHtml(campo)}</td><td>${escaparHtml(valor)}</td></tr>`)
    .join('');

  const requisitos = Array.isArray(dados?.requisitos_principais) ? dados.requisitos_principais.filter(Boolean) : [];
  const requisitosHtml = requisitos.length
    ? `<h3>Requisitos principais</h3><ul>${requisitos.map((r) => `<li>${escaparHtml(r)}</li>`).join('')}</ul>`
    : '';

  return (
    `<h3>Resumo</h3>` +
    `<p>${escaparHtml(resumoCurto || 'Conteúdo em atualização. Consulte o link original para detalhes.')}</p>` +
    `<h3>Quadro do concurso</h3>` +
    `<table><thead><tr><th>Campo</th><th>Valor</th></tr></thead><tbody>${linhas}</tbody></table>` +
    requisitosHtml +
    `<p><em>Para leitura completa acesse a noticia original.</em></p>`
  );
}

// ════════════════════════════════════════════════════════════════════════════
// PROMPT ARTIGO
// ════════════════════════════════════════════════════════════════════════════
const PROMPT_ARTIGO = `Editor de concursos publicos brasileiros. Retorne SOMENTE JSON valido, sem markdown, sem texto fora do JSON.

Estrutura exata de saida:
{"tipo":"concurso","orgao":"max 3 palavras","titulo":"titulo direto","status":"Edital Publicado","banca":"nome","vagas":"numero","salario_maximo":"R$ valor","requisitos_principais":["item1","item2"],"resumo_limpo":"1-2 frases","conteudo_formatado":"<p>resumo</p><h3>Dados</h3><table>...</table><p><em>Para leitura completa acesse a noticia original.</em></p>","quadro":{"cargo":"","situacao":"igual ao status","banca":"","inscricao":"","prova":"","vagas":"","salario":"","requisito":""}}

Regras:
- status: apenas um destes: Previsto|Autorizado|Comissão Formada|Banca Definida|Edital Publicado|Suspenso|Encerrado|Em Análise|Anunciado (ou "" se nao souber)
- conteudo_formatado: maximo 120 palavras, apenas <p><h3><ul><li><table><thead><tbody><tr><th><td><em>, sem divs nem estilos
- Ignore propaganda, cursos, assinaturas, WhatsApp, links de navegacao
`;

// ════════════════════════════════════════════════════════════════════════════
// PROMPT LISTA
// ════════════════════════════════════════════════════════════════════════════
const PROMPT_LISTA = `
Voce e um editor de noticias de concursos publicos.
Analise cada noticia e retorne metadados estruturados.
Ignore referencias a cursos, assinaturas ou propaganda.

Para "urgencia":
"alta"  = edital novo / inscricoes abertas ou encerrando / prova proxima
"media" = resultado / gabarito / convocacao
"baixa" = noticia geral, previsao, tendencia

Para "tipo":
"concurso"    = edital, vagas, inscricoes, resultado, gabarito
"noticia"     = informativo geral
"irrelevante" = 100% propaganda

Para "status": use SOMENTE um destes valores exatos (ou "" se nao identificar):
"Previsto" | "Autorizado" | "Comissão Formada" | "Banca Definida" |
"Edital Publicado" | "Suspenso" | "Encerrado" | "Em Análise" | "Anunciado"

Retorne SOMENTE este array JSON sem markdown, na mesma ordem das noticias recebidas:
[{
  "tipo": "concurso" | "noticia" | "irrelevante",
  "orgao": "nome curto (max 3 palavras)",
  "urgencia": "alta" | "media" | "baixa",
  "status": "",
  "tags": ["ate 3 tags"],
  "destaque": "ponto principal em ate 12 palavras sem mencionar cursos",
  "titulo_limpo": "titulo sem mencionar plataformas",
  "resumo_limpo": "2 frases diretas sem propaganda"
}]
`;

// ════════════════════════════════════════════════════════════════════════════
// PROMPT FILTRO DE TÍTULOS
// ════════════════════════════════════════════════════════════════════════════
const PROMPT_FILTRO_TITULOS = `
Você é um curador de noticias de concursos publicos brasileiros.
Abaixo há uma lista numerada de títulos extraídos de uma página do Estratégia Concursos.

Para cada título, responda:
- true  → é uma notícia real sobre concurso público (edital, inscrições, resultado, gabarito, prova, nomeação, vagas, concurso de qualquer órgão)
- false → é propaganda, link de curso, menu de navegação, texto genérico, categoria de blog ou conteúdo sem relação com concurso público

Retorne SOMENTE um array JSON com true/false na mesma ordem dos títulos, sem texto adicional.
Exemplo: [true, false, true, true, false]
`;

// ════════════════════════════════════════════════════════════════════════════
// FUNÇÃO: filtrarTitulosComIA
// ════════════════════════════════════════════════════════════════════════════
export async function filtrarTitulosComIA(noticias) {
  if (!noticias?.length) return [];

  const LOTE = 25;
  const resultadoFinal = [];

  for (let i = 0; i < noticias.length; i += LOTE) {
    const lote  = noticias.slice(i, i + LOTE);
    const lista = lote.map((n, idx) => `[${idx}] ${n.titulo}`).join('\n');

    try {
      const texto   = await chamarGemini(`${PROMPT_FILTRO_TITULOS}\n\nTítulos:\n${lista}`);
      const parsed  = extrairJSON(texto);
      const validos = Array.isArray(parsed) ? parsed : lote.map(() => true);

      lote.forEach((n, idx) => {
        if (validos[idx] !== false) resultadoFinal.push(n);
      });
    } catch {
      lote.forEach(n => resultadoFinal.push(n));
    }
  }

  return resultadoFinal;
}

// ════════════════════════════════════════════════════════════════════════════
// FUNÇÃO: reescreverArtigo
// ════════════════════════════════════════════════════════════════════════════
export async function reescreverArtigo(url, noticia, conteudoBruto, links = []) {
  // 1. Cache em memória (instantâneo — mesma sessão)
  if (artigoCache.has(url)) return artigoCache.get(url);

  // 2. Cache no Firestore (persistente entre sessões, TTL 24h)
  const cachadoFirestore = await lerCacheFirestore(url);
  if (cachadoFirestore) {
    artigoCache.set(url, cachadoFirestore); // popula memória também
    return cachadoFirestore;
  }

  const linksTexto = links.length
    ? links.map(l => `- [${l.texto}](${l.href})`).join('\n')
    : 'nenhum';

  // Contexto extra vindo do ia da lista (analisarListaNoticias) — enriquece o prompt
  // quando o conteúdo bruto for pobre ou o proxy falhar
  const iaExistente = noticia.ia || {};
  const contextoIA = [
    iaExistente.status        && `Status identificado: ${iaExistente.status}`,
    iaExistente.orgao         && `Órgão: ${iaExistente.orgao}`,
    iaExistente.titulo_limpo  && `Título limpo: ${iaExistente.titulo_limpo}`,
    iaExistente.resumo_limpo  && `Resumo: ${iaExistente.resumo_limpo}`,
    iaExistente.tags?.length  && `Tags: ${iaExistente.tags.join(', ')}`,
  ].filter(Boolean).join('\n');

  const entrada = `TITULO: ${noticia.titulo}
CATEGORIA: ${noticia.categoria?.label || ''}
${contextoIA ? `CONTEXTO JA IDENTIFICADO:\n${contextoIA}\n` : ''}LINKS DO ARTIGO:
${linksTexto}

CONTEUDO:
${(conteudoBruto || noticia.resumo || '').slice(0, 3000)}`;
  const ehConcursoProvavel = pareceConteudoConcurso({
    titulo: noticia?.titulo,
    resumo: noticia?.resumo,
    link: url,
    texto: `${conteudoBruto || ''}\n${linksTexto}`,
  });

  try {
    const raw    = await chamarGemini(PROMPT_ARTIGO + '\n\nARTIGO:\n' + entrada);
    const parsed = extrairJSON(raw);

    if (!parsed) {
      if (!ehConcursoProvavel) {
        artigoCache.set(url, null);
        return null;
      }
      const fallback = {
        tipo: 'concurso',
        orgao: '',
        titulo_limpo: noticia?.titulo || '',
        titulo_inteligente: noticia?.titulo || '',
        status: '',
        banca: '',
        vagas: '',
        salario_maximo: '',
        requisitos_principais: [],
        conteudo_formatado: '',
        texto_completo_formatado: '',
        urgencia: 'baixa',
        tags: [],
        destaque: '',
        resumo_limpo: noticia?.resumo || '',
        quadro: {
          cargo: '',
          situacao: '',
          banca: '',
          inscricao: '',
          prova: '',
          vagas: '',
          salario: '',
          requisito: '',
        },
      };
      fallback.conteudo_formatado = montarHtmlFallback({ noticia, dados: fallback, textoFonte: conteudoBruto });
      fallback.texto_completo_formatado = fallback.conteudo_formatado;
      artigoCache.set(url, fallback);
      return fallback;
    }

    if (parsed.tipo === 'irrelevante' && ehConcursoProvavel) {
      parsed.tipo = 'concurso';
    }

    if (parsed.tipo === 'irrelevante') {
      artigoCache.set(url, null);
      return null;
    }

    // ── Normaliza o status para garantir que seja sempre um valor válido ──
    const statusNormalizado = normalizarStatus(parsed.status || parsed.quadro?.situacao || '');

    const output = {
      tipo:               parsed.tipo              || 'noticia',
      orgao:              parsed.orgao             || '',
      titulo_limpo:       parsed.titulo            || parsed.titulo_inteligente || noticia.titulo,
      titulo_inteligente: parsed.titulo            || parsed.titulo_inteligente || noticia.titulo,
      status:             statusNormalizado,
      banca:              parsed.banca             || parsed.quadro?.banca || '',
      vagas:              parsed.vagas             || parsed.quadro?.vagas || '',
      salario_maximo:     parsed.salario_maximo    || parsed.quadro?.salario || '',
      requisitos_principais: Array.isArray(parsed.requisitos_principais)
        ? parsed.requisitos_principais : [],
      conteudo_formatado:       parsed.conteudo_formatado || '',
      texto_completo_formatado: parsed.conteudo_formatado || '',
      urgencia: parsed.urgencia || 'baixa',
      tags:     Array.isArray(parsed.tags) ? parsed.tags : [],
      destaque: parsed.destaque || '',
      resumo_limpo: parsed.resumo_limpo || noticia?.resumo || '',
      quadro: {
        cargo:     parsed.quadro?.cargo     || '',
        situacao:  statusNormalizado,          // sempre normalizado
        banca:     parsed.quadro?.banca     || parsed.banca  || '',
        inscricao: parsed.quadro?.inscricao || '',
        prova:     parsed.quadro?.prova     || '',
        vagas:     parsed.quadro?.vagas     || parsed.vagas  || '',
        salario:   parsed.quadro?.salario   || parsed.salario_maximo || '',
        requisito: parsed.quadro?.requisito || '',
      },
    };
    if (!output.conteudo_formatado || !String(output.conteudo_formatado).trim()) {
      output.conteudo_formatado = montarHtmlFallback({ noticia, dados: output, textoFonte: conteudoBruto });
      output.texto_completo_formatado = output.conteudo_formatado;
    }

    artigoCache.set(url, output);
    salvarCacheFirestore(url, output); // persiste no Firestore (não bloqueia)
    return output;
  } catch (err) {
    console.error('[noticiaIA] reescreverArtigo falhou:', err);
    if (ehConcursoProvavel) {
      const fallbackErro = {
        tipo: 'concurso',
        orgao: '',
        titulo_limpo: noticia?.titulo || '',
        titulo_inteligente: noticia?.titulo || '',
        status: '',
        banca: '',
        vagas: '',
        salario_maximo: '',
        requisitos_principais: [],
        urgencia: 'baixa',
        tags: [],
        destaque: '',
        resumo_limpo: noticia?.resumo || '',
        quadro: { cargo: '', situacao: '', banca: '', inscricao: '', prova: '', vagas: '', salario: '', requisito: '' },
      };
      fallbackErro.conteudo_formatado = montarHtmlFallback({ noticia, dados: fallbackErro, textoFonte: conteudoBruto });
      fallbackErro.texto_completo_formatado = fallbackErro.conteudo_formatado;
      artigoCache.set(url, fallbackErro);
      return fallbackErro;
    }
    artigoCache.set(url, null);
    return null;
  }
}

// ════════════════════════════════════════════════════════════════════════════
// FUNÇÃO: analisarListaNoticias
// ════════════════════════════════════════════════════════════════════════════
export async function analisarListaNoticias(noticias) {
  if (!noticias?.length) return [];

  const lote  = noticias.slice(0, 15);
  const texto = lote
    .map((n, i) => `[${i}]\nTITULO: ${n.titulo}\nRESUMO: ${n.resumo || ''}`)
    .join('\n\n---\n\n');

  try {
    const raw    = await chamarGemini(PROMPT_LISTA + `\n\nNOTICIAS (${lote.length}):\n\n${texto}`);
    const parsed = extrairJSON(raw);

    if (!Array.isArray(parsed)) return lote.map(() => null);

    return parsed.map(item => ({
      tipo:         item?.tipo         || 'noticia',
      orgao:        item?.orgao        || '',
      urgencia:     item?.urgencia     || 'baixa',
      // Normaliza o status retornado pela IA
      status:       normalizarStatus(item?.status || ''),
      tags:         Array.isArray(item?.tags) ? item.tags : [],
      destaque:     item?.destaque     || '',
      titulo_limpo: item?.titulo_limpo || '',
      resumo_limpo: item?.resumo_limpo || '',
    }));
  } catch (err) {
    console.error('[noticiaIA] analisarListaNoticias falhou:', err);
    return lote.map(() => null);
  }
}
