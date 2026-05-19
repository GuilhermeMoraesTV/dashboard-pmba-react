// src/utils/filtroNoticias.js
// Módulo de filtragem para notícias do Estratégia Concursos
// Importa ESTADOS_SLUGS de estadosSlugs para garantir fonte única da verdade.

import { ESTADOS_SLUGS } from './estadosSlugs';

// ════════════════════════════════════════════════════════════════════════════
// BLACKLIST: Termos de interface / ruído de UI
// ════════════════════════════════════════════════════════════════════════════
export const BLACKLIST_TERMS = new Set([
  // Marca / CTA
  'estratégia', 'estrategia concursos', 'ler', 'leia mais', 'veja mais',
  'confira', 'acesse', 'clique aqui', 'saiba mais',

  // Genéricos temporais
  'concursos 2026', 'concursos 2025', 'concursos 2024',
  'últimas notícias', 'notícias', 'destaques', 'em destaque',

  // Categorias isoladas (sem contexto de notícia real)
  'bancária (bb, cef e bancos estaduais)', 'bancaria (bb, cef e bancos estaduais)',
  'educação', 'educacao',
  'executivo (administrativa)',
  'fiscal - estadual (icms)', 'fiscal estadual (icms)',
  'jurídico', 'juridico',
  'legislativo',
  'policial (agente, escrivão e investigador)',
  'tribunais',
  'tribunais de contas (tcu, tce, tcm)', 'tribunais de contas',

  // Navegação / UI
  'home', 'blog', 'sobre', 'contato', 'login', 'cadastro',
  'assine', 'planos', 'cursos', 'área do aluno', 'meus cursos',
  'filtros', 'buscar', 'pesquisar', 'todas as notícias',
  'ver tudo', 'carregar mais',
]);

// ════════════════════════════════════════════════════════════════════════════
// MAPEAMENTO SIGLA → SLUG  (derivado de ESTADOS_SLUGS — fonte única)
// ════════════════════════════════════════════════════════════════════════════
export const SIGLA_PARA_SLUG = ESTADOS_SLUGS; // mesmo objeto, alias semântico
export const SIGLAS_VALIDAS  = new Set(Object.keys(ESTADOS_SLUGS));

// ════════════════════════════════════════════════════════════════════════════
// INDICADORES DE RELEVÂNCIA (notícia real de concurso)
// ════════════════════════════════════════════════════════════════════════════
export const INDICADORES_RELEVANCIA = [
  // Status de concurso
  'edital', 'publicado', 'aberto', 'inscrições', 'inscricoes', 'vagas',
  'banca', 'organizadora', 'previsto', 'autorizado',
  'comissão formada', 'comissao formada', 'banca definida',
  'suspenso', 'cancelado', 'encerrado', 'prazo', 'prorroga',

  // Ações específicas
  'resultado', 'gabarito', 'convocação', 'convocacao',
  'nomeação', 'nomeacao', 'homologação', 'homologacao',
  'prova', 'exame', 'discursiva', 'objetiva', 'títulos', 'titulos',

  // Dados concretos
  'salário', 'salario', 'remuneração', 'remuneracao',
  'carga horária', 'carga horaria', 'requisitos', 'escolaridade',
  'nível', 'nivel', 'superior', 'médio', 'medio',

  // Órgãos específicos
  'prefeitura', 'secretaria', 'ministério', 'ministerio',
  'tribunal', 'câmara', 'camara', 'assembleia',
  'defensoria', 'procuradoria', 'polícia', 'policia', 'bombeiros',
];

// ════════════════════════════════════════════════════════════════════════════
// UTILITÁRIO: Normaliza texto para comparação
// ════════════════════════════════════════════════════════════════════════════
export function normalizarTexto(texto = '') {
  return texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// ════════════════════════════════════════════════════════════════════════════
// REGRA 1 + 2: Valida se título é notícia real (não é ruído de UI)
// ════════════════════════════════════════════════════════════════════════════
export function tituloEhNoticiaReal(titulo = '', contexto = '') {
  if (!titulo || typeof titulo !== 'string') return false;

  const t        = normalizarTexto(titulo);
  const ctx      = normalizarTexto(contexto);
  const combinado = `${t} ${ctx}`;

  if (t.length < 20) return false;
  if (BLACKLIST_TERMS.has(t)) return false;

  // Rejeita "Estado + Categoria" sem indicador real
  for (const termo of BLACKLIST_TERMS) {
    if (t === termo) return false;
    if (t.startsWith(termo) && t.split(' ').length <= 3) {
      const pos   = t.indexOf(termo) + termo.length;
      const resto = t.substring(pos).trim();
      if (resto && !INDICADORES_RELEVANCIA.some(ind => resto.includes(ind))) return false;
    }
  }

  // Deve ter pelo menos 1 indicador de relevância
  if (!INDICADORES_RELEVANCIA.some(ind => combinado.includes(ind))) return false;

  // Não pode ser menu
  if (/^[\s\-•,;|]+$/.test(t)) return false;
  if (/^(home|blog|not[íi]cias|concursos|sobre|contato)$/i.test(t)) return false;

  return true;
}

// ════════════════════════════════════════════════════════════════════════════
// REGRA 3: Extrai SIGLA do texto e retorna slug padronizado
// ════════════════════════════════════════════════════════════════════════════
export function extrairSlugPorSigla(texto = '') {
  if (!texto) return null;

  const t = texto.toUpperCase();

  for (const sigla of SIGLAS_VALIDAS) {
    const patterns = [
      new RegExp(`\\b${sigla}\\b`,          'g'),
      new RegExp(`\\(${sigla}\\)`,          'g'),
      new RegExp(`\\s${sigla}[\\s:;,.]`,    'g'),
      new RegExp(`[\\s:;,.]${sigla}\\s`,    'g'),
    ];
    for (const re of patterns) {
      if (re.test(t)) return ESTADOS_SLUGS[sigla] || null;
    }
  }

  // Fallback: detecção pelo nome completo do estado
  const nomesParaSigla = {
    'acre': 'AC', 'alagoas': 'AL', 'amapa': 'AP', 'amazonas': 'AM',
    'bahia': 'BA', 'ceara': 'CE', 'distrito federal': 'DF',
    'espirito santo': 'ES', 'goias': 'GO', 'maranhao': 'MA',
    'mato grosso do sul': 'MS', 'mato grosso': 'MT', 'minas gerais': 'MG',
    'para': 'PA', 'paraiba': 'PB', 'parana': 'PR', 'pernambuco': 'PE',
    'piaui': 'PI', 'rio de janeiro': 'RJ', 'rio grande do norte': 'RN',
    'rio grande do sul': 'RS', 'rondonia': 'RO', 'roraima': 'RR',
    'santa catarina': 'SC', 'sao paulo': 'SP', 'sergipe': 'SE', 'tocantins': 'TO',
  };

  const tNorm = normalizarTexto(t);
  // Ordena por tamanho desc para evitar match parcial (ex: "para" dentro de "parana")
  const nomes = Object.keys(nomesParaSigla).sort((a, b) => b.length - a.length);
  for (const nome of nomes) {
    const sigla = nomesParaSigla[nome];
    if (tNorm.includes(nome)) return ESTADOS_SLUGS[sigla] || null;
  }

  return null;
}

// ════════════════════════════════════════════════════════════════════════════
// REGRA 3: Gera URL padronizada para a página de concursos do estado
// ════════════════════════════════════════════════════════════════════════════
const BASE_URL = 'https://www.estrategiaconcursos.com.br/blog';

export function gerarUrlEstadoPadronizada(siglaOuSlug) {
  if (!siglaOuSlug) return null;

  // Se for uma sigla conhecida (2 letras maiúsculas)
  if (ESTADOS_SLUGS[siglaOuSlug.toUpperCase()]) {
    const slug = ESTADOS_SLUGS[siglaOuSlug.toUpperCase()];
    return `${BASE_URL}/concursos-${slug}/`;
  }

  // Se for um slug já normalizado
  const slugNorm = siglaOuSlug.toLowerCase().trim();
  const slugsValidos = new Set(Object.values(ESTADOS_SLUGS));
  if (slugsValidos.has(slugNorm)) {
    return `${BASE_URL}/concursos-${slugNorm}/`;
  }

  // Tenta extrair via nome
  const slug = extrairSlugPorSigla(siglaOuSlug);
  if (slug) return `${BASE_URL}/concursos-${slug}/`;

  return null;
}

// ════════════════════════════════════════════════════════════════════════════
// FUNÇÃO COMPOSTA: Filtra e padroniza lista de notícias brutas
// ════════════════════════════════════════════════════════════════════════════
export function filtrarEPadronizarNoticias(itensExtraidos = []) {
  if (!Array.isArray(itensExtraidos)) return [];

  return itensExtraidos
    .map(item => {
      const titulo      = item.titulo || item.title || item.text || item || '';
      const linkOriginal = item.link  || item.url   || item.href || '';
      const contexto    = item.contexto || item.resumo || item.description || '';

      if (!tituloEhNoticiaReal(titulo, contexto)) return null;

      const slug           = extrairSlugPorSigla(`${titulo} ${contexto}`);
      const urlPadronizada = slug ? gerarUrlEstadoPadronizada(slug) : linkOriginal;

      return {
        titulo:     titulo.trim(),
        link:       urlPadronizada || linkOriginal,
        slugEstado: slug,
        relevancia: 'alta',
        _original:  item,
      };
    })
    .filter(Boolean)
    .filter((item, idx, arr) =>
      arr.findIndex(i => i.titulo === item.titulo && i.slugEstado === item.slugEstado) === idx
    );
}

// ════════════════════════════════════════════════════════════════════════════
// UTILITÁRIO: Valida se URL segue padrão oficial do Estratégia
// ════════════════════════════════════════════════════════════════════════════
export function validarUrlEstrategia(url = '') {
  if (!url) return false;
  const pattern = /^https:\/\/www\.estrategiaconcursos\.com\.br\/blog\/concursos-([a-z-]+)\/?$/i;
  const match   = url.match(pattern);
  if (!match) return false;
  const slug = match[1].toLowerCase();
  return Object.values(ESTADOS_SLUGS).includes(slug);
}

export default {
  BLACKLIST_TERMS,
  SIGLA_PARA_SLUG,
  SIGLAS_VALIDAS,
  INDICADORES_RELEVANCIA,
  normalizarTexto,
  tituloEhNoticiaReal,
  extrairSlugPorSigla,
  gerarUrlEstadoPadronizada,
  filtrarEPadronizarNoticias,
  validarUrlEstrategia,
};