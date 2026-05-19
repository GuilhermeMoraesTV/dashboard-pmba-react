// src/config/noticiasConfig.js
// Constantes de categorias, regiões e helpers de SVG — extraídas de NoticiasPage.

const BASE = 'https://www.estrategiaconcursos.com.br/blog';

export { BASE };

// ─── CATEGORIAS ───────────────────────────────────────────────────────────────
export const CATEGORIAS = [
  { id: 'todas',      label: 'Todas',             cor: 'bg-red-600',     tipo: 'todas' },
  { id: 'abertos',    label: 'Concursos Abertos', cor: 'bg-green-600',
    banner: { bg: 'linear-gradient(135deg,#16a34a 0%,#14532d 100%)', pattern: 'stars' },
    tipo: 'pagina', url: `${BASE}/concursos-abertos/` },
  { id: 'policial',   label: 'Policial',           cor: 'bg-sky-600',
    banner: { bg: 'linear-gradient(135deg,#0284c7 0%,#0c4a6e 100%)', pattern: 'lines' },
    feeds: [`${BASE}/policia/feed/?posts_per_page=40`, `${BASE}/policial-oficial/feed/?posts_per_page=20`,
      `${BASE}/policial-pracas/feed/?posts_per_page=20`, `${BASE}/policial-agente-penitenciario/feed/?posts_per_page=20`,
      `${BASE}/policial-guarda-civis/feed/?posts_per_page=20`], tipo: 'rss' },
  { id: 'fiscal',     label: 'Fiscal',             cor: 'bg-amber-600',
    banner: { bg: 'linear-gradient(135deg,#d97706 0%,#78350f 100%)', pattern: 'grid' },
    feeds: [`${BASE}/fiscal-federal/feed/?posts_per_page=40`, `${BASE}/fiscal-estadual/feed/?posts_per_page=30`,
      `${BASE}/fiscal-municipal/feed/?posts_per_page=20`], tipo: 'rss' },
  { id: 'tribunais',  label: 'Tribunais',          cor: 'bg-violet-600',
    banner: { bg: 'linear-gradient(135deg,#7c3aed 0%,#2e1065 100%)', pattern: 'scales' },
    feeds: [`${BASE}/tribunais/feed/?posts_per_page=40`, `${BASE}/tribunais-de-contas/feed/?posts_per_page=20`], tipo: 'rss' },
  { id: 'mp',         label: 'Min. Público',       cor: 'bg-indigo-600',
    banner: { bg: 'linear-gradient(135deg,#4338ca 0%,#1e1b4b 100%)', pattern: 'hexagons' },
    feeds: [`${BASE}/promotor-de-justica/feed/?posts_per_page=40`, `${BASE}/carreiras-juridicas/feed/?posts_per_page=20`,
      `${BASE}/procuradorias/feed/?posts_per_page=20`, `${BASE}/defensoria-publica/feed/?posts_per_page=20`], tipo: 'rss' },
  { id: 'educacao',   label: 'Educação',           cor: 'bg-teal-600',
    banner: { bg: 'linear-gradient(135deg,#0d9488 0%,#042f2e 100%)', pattern: 'triangles' },
    feeds: [`${BASE}/educacional/feed/?posts_per_page=40`], tipo: 'rss' },
  { id: 'prefeituras',label: 'Prefeituras',        cor: 'bg-orange-600',
    banner: { bg: 'linear-gradient(135deg,#ea580c 0%,#431407 100%)', pattern: 'waves' },
    feeds: [`${BASE}/prefeituras/feed/?posts_per_page=40`], tipo: 'rss' },
  { id: 'saude',      label: 'Saúde',              cor: 'bg-rose-600',
    banner: { bg: 'linear-gradient(135deg,#e11d48 0%,#4c0519 100%)', pattern: 'cross' },
    feeds: [`${BASE}/saude/feed/?posts_per_page=40`], tipo: 'rss' },
  { id: 'bancaria',   label: 'Bancários',          cor: 'bg-emerald-600',
    banner: { bg: 'linear-gradient(135deg,#059669 0%,#022c22 100%)', pattern: 'dots' },
    feeds: [`${BASE}/carreiras-bancarias/feed/?posts_per_page=40`], tipo: 'rss' },
];

export const CATS_RSS = CATEGORIAS.filter(c => c.tipo === 'rss');

// ─── REGIÕES ──────────────────────────────────────────────────────────────────
export const REGIOES = [
  { id: 'norte',       label: 'Norte',       url: `${BASE}/concursos-norte/`,       cor: 'bg-teal-600',
    banner: { bg: 'linear-gradient(135deg,#0d9488 0%,#042f2e 100%)', pattern: 'waves' },    uf: ['AM','PA','AC','RO','RR','AP','TO'] },
  { id: 'nordeste',    label: 'Nordeste',    url: `${BASE}/concursos-nordeste/`,    cor: 'bg-orange-500',
    banner: { bg: 'linear-gradient(135deg,#f97316 0%,#431407 100%)', pattern: 'stars' },    uf: ['BA','SE','AL','PE','PB','RN','CE','PI','MA'] },
  { id: 'sudeste',     label: 'Sudeste',     url: `${BASE}/concursos-sudeste/`,     cor: 'bg-blue-600',
    banner: { bg: 'linear-gradient(135deg,#2563eb 0%,#1e1b4b 100%)', pattern: 'grid' },     uf: ['SP','RJ','MG','ES'] },
  { id: 'sul',         label: 'Sul',         url: `${BASE}/concursos-sul/`,         cor: 'bg-emerald-600',
    banner: { bg: 'linear-gradient(135deg,#059669 0%,#022c22 100%)', pattern: 'triangles' }, uf: ['PR','SC','RS'] },
  { id: 'centro-oeste',label: 'Centro-Oeste',url: `${BASE}/concursos-centro-oeste/`,cor: 'bg-amber-600',
    banner: { bg: 'linear-gradient(135deg,#d97706 0%,#78350f 100%)', pattern: 'hexagons' },  uf: ['GO','MT','MS','DF'] },
];

// ─── SVG PATTERNS ─────────────────────────────────────────────────────────────
export function getSvgPattern(key, pid) {
  const defs = {
    dots:      `<pattern id="${pid}" x="0" y="0" width="20" height="20" patternUnits="userSpaceOnUse"><circle cx="10" cy="10" r="2" fill="white" fill-opacity="0.18"/></pattern>`,
    grid:      `<pattern id="${pid}" x="0" y="0" width="20" height="20" patternUnits="userSpaceOnUse"><path d="M20 0L0 0 0 20" fill="none" stroke="white" stroke-opacity="0.13" stroke-width="0.8"/></pattern>`,
    lines:     `<pattern id="${pid}" x="0" y="0" width="30" height="30" patternUnits="userSpaceOnUse"><line x1="0" y1="0" x2="30" y2="30" stroke="white" stroke-opacity="0.14" stroke-width="1.2"/></pattern>`,
    scales:    `<pattern id="${pid}" x="0" y="0" width="20" height="20" patternUnits="userSpaceOnUse"><circle cx="0" cy="0" r="10" fill="none" stroke="white" stroke-opacity="0.13" stroke-width="1"/><circle cx="20" cy="20" r="10" fill="none" stroke="white" stroke-opacity="0.13" stroke-width="1"/></pattern>`,
    triangles: `<pattern id="${pid}" x="0" y="0" width="24" height="24" patternUnits="userSpaceOnUse"><polygon points="12,2 22,22 2,22" fill="none" stroke="white" stroke-opacity="0.14" stroke-width="1"/></pattern>`,
    cross:     `<pattern id="${pid}" x="0" y="0" width="22" height="22" patternUnits="userSpaceOnUse"><path d="M11 4L11 18 M4 11L18 11" stroke="white" stroke-opacity="0.18" stroke-width="1.5" stroke-linecap="round"/></pattern>`,
    waves:     `<pattern id="${pid}" x="0" y="0" width="40" height="20" patternUnits="userSpaceOnUse"><path d="M0 10 Q10 0 20 10 Q30 20 40 10" fill="none" stroke="white" stroke-opacity="0.16" stroke-width="1.5"/></pattern>`,
    hexagons:  `<pattern id="${pid}" x="0" y="0" width="26" height="30" patternUnits="userSpaceOnUse"><polygon points="13,1 25,7 25,23 13,29 1,23 1,7" fill="none" stroke="white" stroke-opacity="0.13" stroke-width="1"/></pattern>`,
    stars:     `<pattern id="${pid}" x="0" y="0" width="24" height="24" patternUnits="userSpaceOnUse"><polygon points="12,2 14.5,9 22,9 16,14 18,22 12,17 6,22 8,14 2,9 9.5,9" fill="white" fill-opacity="0.1"/></pattern>`,
  };
  return defs[key] || defs.grid;
}