// src/hooks/useNoticias.js
// Toda a lógica de fetch, parse e estado das notícias — extraída de NoticiasPage.
import { useState, useCallback, useRef } from 'react';
import { ESTADOS_LISTA, ESTADOS_SLUGS } from '../utils/estadosSlugs';
import { analisarListaNoticias, filtrarTitulosComIA, listaCache } from '../services/noticiaIA';

const BASE = 'https://www.estrategiaconcursos.com.br/blog';

// ─── CACHES DE ESTADO/REGIÃO ──────────────────────────────────────────────────
export const estadoCache = new Map();
export const regionCache = new Map();

// ─── PROXIES ──────────────────────────────────────────────────────────────────
const PROXIES = [
  { makeProxy: (url) => `https://corsproxy.io/?${encodeURIComponent(url)}`,                    timeout: 12000, useRaw: false },
  { makeProxy: (url) => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,       timeout: 15000, useRaw: true  },
  { makeProxy: (url) => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(url)}`, timeout: 12000, useRaw: false },
  { makeProxy: (url) => `https://proxy.cors.sh/${encodeURIComponent(url)}`,                   timeout: 15000, useRaw: false, headers: { 'x-api-key': '' } },
];

export async function fetchViaProxy(url, options = {}) {
  const { timeout = 15000, retries = 2 } = options;

  try {
    const controller = new AbortController();
    const tid = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'text/html,*/*;q=0.8' },
    });
    clearTimeout(tid);
    if (res.ok) { const t = await res.text(); if (t.length > 200) return t; }
  } catch { /* cai nos proxies */ }

  for (let attempt = 0; attempt < retries; attempt++) {
    for (const config of PROXIES) {
      try {
        const pUrl = config.makeProxy(url);
        const res  = await fetch(pUrl, {
          signal: AbortSignal.timeout(config.timeout),
          headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'text/html,*/*;q=0.8', ...config.headers },
        });
        if (!res.ok) continue;
        let text = await res.text();
        if (config.useRaw && pUrl.includes('allorigins')) {
          try { const j = JSON.parse(text); if (j?.contents?.length > 200) return j.contents; } catch {}
          continue;
        }
        if (text.length > 200) return text;
      } catch { continue; }
    }
    if (attempt < retries - 1) await new Promise(r => setTimeout(r, 400 * (attempt + 1)));
  }
  throw new Error('Proxy falhou: ' + url);
}

// ─── UTILITÁRIOS ──────────────────────────────────────────────────────────────
export function stripHtml(html = '') {
  return html
    .replace(/<!\[CDATA\[/g, '').replace(/\]\]>/g, '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&#(\d+);/g,    (_, n) => String.fromCharCode(parseInt(n, 10)))
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCharCode(parseInt(h, 16)))
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#039;/g, "'").replace(/&nbsp;/g, ' ')
    .replace(/&[a-z]{2,8};/gi, '').replace(/\s+/g, ' ').trim();
}

export function formatDate(dateStr) {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr);
    if (isNaN(d)) return '';
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
      + ' às ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  } catch { return ''; }
}

export function formatDateRelativa(dateStr) {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return '';
    const now = new Date();
    if (d > now) return '';
    const diffMs  = now - d;
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 3)   return 'agora';
    if (diffMin < 60)  return `há ${diffMin}min`;
    const diffH = Math.floor(diffMin / 60);
    if (diffH < 24)    return `há ${diffH}h`;
    const diffD = Math.floor(diffH / 24);
    if (diffD === 1)   return 'ontem';
    if (diffD < 7)     return `há ${diffD}d`;
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }).replace('.', '');
  } catch { return ''; }
}

// ─── SANITIZADOR DE VALOR DE CAMPO ───────────────────────────────────────────
/**
 * Garante que valores extraídos do HTML não contenham lixo (propaganda, texto
 * corrido de parágrafo, etc.). Aplica limites de caracteres por tipo de campo.
 *
 * ATENÇÃO — campo "situacao":
 * Valores de situação nunca devem conter texto corrido. Se o valor não for
 * uma palavra-chave reconhecida de status, retornamos string vazia para que
 * o campo exiba "A definir" em vez de lixo.
 */
export function sanitizarValorCampo(valor = '', tipo = 'geral') {
  if (!valor) return '';
  let v = valor.replace(/\s+/g, ' ').trim();

  // Para campo situacao: aceita apenas tokens curtos (status simples)
  if (tipo === 'situacao') {
    // Remove tudo que vem depois de " - " ou " – " (ex: "Banca Definida - INDEPAC")
    const sepIdx = v.search(/\s[-–]\s/);
    if (sepIdx > 0) v = v.substring(0, sepIdx).trim();
    // Se ainda for muito longo, provavelmente é texto corrido — descarta
    if (v.length > 40) return '';
    // Verifica se parece com um status válido (tem palavras conhecidas)
    const statusTokens = /previsto|autorizado|comiss[aã]o|banca|edital|publicado|suspenso|cancelado|encerrado|analise|an[aá]lise|anunciado/i;
    if (!statusTokens.test(v)) return '';
    return v;
  }

  // Descarta valores que claramente são texto corrido / propaganda
  const LIXO = /curso[s]?\s|assine|plano|desconto|clique|acesse|saiba mais|whatsapp|telegram|grupos|apostila|edição|outras oportunidades|curiosidades|localizado|floresta|amazônica|inscri[çc][aã]/i;

  // Para campo banca: se contiver palavra de inscrição, é vazamento — descarta tudo a partir daí
  if (tipo === 'banca') {
    const idx = v.search(/inscri[çc][õo]|per[íi]odo|abertura|prazo/i);
    if (idx > 0) v = v.substring(0, idx).trim();
  }
  // Para campo inscricao: corta ao encontrar rótulos de outros campos colados no valor.
  // Padrão comum do Estratégia: "até 30/04 Data da Prova" — "Data da Prova" é do campo seguinte.
  if (tipo === 'inscricao') {
    const leakIdx = v.search(/\s+(?:Data\s+da|Data\s+do|Banca|Vagas?|Sal[aá]rio|Prova|Exame|Situa[çc][aã]o|Requisito)/i);
    if (leakIdx > 0) v = v.substring(0, leakIdx).trim();
    // Se começar com nome de banca, o valor está completamente errado
    if (/^(?:banca|fundação|instituto|cespe|cebraspe|fcc|vunesp|ibfc|aocp)/i.test(v)) return '';
  }
  if (LIXO.test(v) && tipo !== 'inscricao') return '';

  // Limites rígidos por tipo — evita texto corrido
  const limites = {
    salario:   28,
    banca:     35,
    vagas:     20,
    inscricao: 45,
    prova:     45,
    geral:     60,
  };
  const limite = limites[tipo] || limites.geral;

  if (v.length > limite) {
    const corte = v.search(/[|·•\n;]/);
    if (corte > 3 && corte <= limite) return v.substring(0, corte).trim();
    const truncado  = v.substring(0, limite);
    const ultimoEsp = truncado.lastIndexOf(' ');
    return (ultimoEsp > limite * 0.55 ? truncado.substring(0, ultimoEsp) : truncado).trim() + '…';
  }
  return v;
}

// ─── EXTRATOR DE DADOS DE TABELA ──────────────────────────────────────────────
export function extrairDadosDeTabela(htmlBloco) {
  if (!htmlBloco) return {};
  const dados = {};
  const texto = stripHtml(htmlBloco);

  // Tenta extrair de tabela HTML primeiro
  const linhas = htmlBloco.match(/<tr[^>]*>([\s\S]*?)<\/tr>/gi) || [];
  for (const linha of linhas) {
    const cells = linha.match(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi) || [];
    if (cells.length >= 2) {
      const chave = stripHtml(cells[0]).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
      const valor = stripHtml(cells[1]).trim();
      if (!valor || valor.length > 300) continue;
      if (chave.includes('situa') || chave.includes('status') || chave.includes('fase'))    dados.situacao  = dados.situacao  || valor;
      if (chave.includes('banca') || chave.includes('organiz'))                              dados.banca     = dados.banca     || valor;
      if (chave.includes('vaga'))                                                            dados.vagas     = dados.vagas     || valor;
      if (chave.includes('sal') || chave.includes('remun') || chave.includes('vencim'))     dados.salario   = dados.salario   || valor;
      if (chave.includes('inscri'))                                                          dados.inscricao = dados.inscricao || valor;
      if (chave.includes('prova') || chave.includes('exam'))                                 dados.prova     = dados.prova     || valor;
      if (chave.includes('cargo') || chave.includes('funcao') || chave.includes('função'))  dados.cargo     = dados.cargo     || valor;
      if (chave.includes('escolar') || chave.includes('requisit'))                          dados.requisito = dados.requisito || valor;
    }
  }

  // Fallback regex no texto plano
  function extrairValor(re) {
    const m = texto.match(re);
    if (!m?.[1]) return '';
    let val = m[1].replace(/<[^>]+>/g, '').trim();

    // Corta ao encontrar o INÍCIO do próximo campo.
    // Cobre dois padrões:
    //   1) "Campo:" ou "Campo -" — separador explícito
    //   2) Nomes de campo que aparecem SEM separador, grudados no valor
    //      ex: "até 30/04 Data da Prova" → corta em "Data da Prova"
    const NEXT_FIELD = new RegExp(
      '(?:Data\\s+da\\s+(?:Prova|Inscri[çc])|Data\\s+do\\s+Exame' +
      '|Banca\\s+Organizadora' +
      '|(?:Situa[çc][aã]o|Banca|Vagas?|Sal[aá]rio|Inscri[çc][oõ]es?|Prova|Exame|Requisito|Escolaridade)\\s*[:\\-–])',
      'i'
    );
    const proxMatch = val.match(NEXT_FIELD);
    if (proxMatch && proxMatch.index > 0) val = val.substring(0, proxMatch.index).trim();

    if (/^(?:concurso|pss|exame|seleção|edital)\s/i.test(val)) return '';
    return val.replace(/\s+/g, ' ').trim().substring(0, 200);
  }

  if (!dados.situacao)  dados.situacao  = extrairValor(/(?:Situa[çc][aã]o|Status|Fase)\s*[:\-–]\s*(.+)/i);
  if (!dados.banca)     dados.banca     = extrairValor(/(?:Banca|Organizadora|Fundação)\s*[:\-–]\s*(.+)/i);
  if (!dados.vagas)     dados.vagas     = extrairValor(/(?:Vagas?|N[º°]\s*de\s*Vagas?)\s*[:\-–]\s*(.+)/i);
  if (!dados.salario) {
    const mSal = texto.match(/(?:Sal[aá]rio|Remunera[çc][aã]o|Vencimento)(?:\s+inicial)?\s*[:\-–]\s*(R\$\s*[\d.,]+(?:\s*,?\s*a\s*,?\s*R\$\s*[\d.,]+)?)/i);
    dados.salario = mSal?.[1]?.replace(/\s+/g, ' ').trim() || extrairValor(/(?:Sal[aá]rio|Remunera[çc][aã]o|Vencimento)(?:\s+inicial)?\s*[:\-–]\s*(.+)/i);
  }
  if (!dados.inscricao) {
    dados.inscricao = extrairValor(/(?:Per[ií]odo\s+de\s+)?[Ii]nscri[çc][oõ]es?\s*[:\-–]\s*(.+)/i)
      || extrairValor(/Inscri[çc][aã]o\s*[:\-–]\s*(.+)/i);
  }
  if (!dados.prova) {
    dados.prova = extrairValor(/(?:Data\s+da\s+)?[Pp]rova\s*[:\-–]\s*(.+)/i)
      || extrairValor(/Prova\s+(?:objetiva|discursiva|t[ií]tulos|f[ií]sica)\s*[:\-–]\s*(.+)/i)
      || extrairValor(/(?:Data\s+do\s+)?[Ee]xame\s*[:\-–]\s*(.+)/i);
  }

  // Sanitiza todos os campos antes de retornar
  const LIXO_VALOR = /curso[s]?\s|assine|plano|desconto|clique|acesse|saiba mais|whatsapp|telegram|apostila|outras oportunidades|curiosidades|localizado|floresta|amazônica/i;
  for (const k of ['situacao','banca','vagas','salario','inscricao','prova','cargo','requisito']) {
    if (!dados[k]) continue;
    if (LIXO_VALOR.test(dados[k])) { dados[k] = ''; continue; }

    if (k === 'situacao') {
      // Aplica sanitizarValorCampo específico para situação — descarta texto corrido
      dados[k] = sanitizarValorCampo(dados[k], 'situacao');
      continue;
    }

    const lim = k === 'salario' ? 30 : 60;
    if (dados[k].length > lim) {
      const corte = dados[k].search(/[|·•,\n]/);
      dados[k] = (corte > 4 && corte <= lim)
        ? dados[k].substring(0, corte).trim()
        : dados[k].substring(0, lim).replace(/\s\S+$/, '').trim() + '…';
    }
  }

  return dados;
}

// ─── HELPERS DE IDENTIFICAÇÃO ─────────────────────────────────────────────────
const REGION_EXACT_SLUGS = new Set([
  'concursos-norte', 'concursos-nordeste', 'concursos-sudeste',
  'concursos-sul', 'concursos-centro-oeste', 'concursos-por-regiao', 'concursos-abertos',
]);

export function isNoticiaRegional(link = '') {
  const slug = link.replace(/\/$/, '').split('/').pop() || '';
  return REGION_EXACT_SLUGS.has(slug);
}

export function isSlugDeEstado(href = '') {
  const slug = href.replace(/\/$/, '').split('/').pop() || '';
  if (!slug.startsWith('concursos-')) return false;
  const parte = slug.replace('concursos-', '');
  return Object.values(ESTADOS_SLUGS).includes(parte);
}

const TITULOS_BLOQUEADOS_ESTADO = [
  /concursos?\s+(da\s+)?regi[aã]o/i,
  /banc[aá]ri[ao]/i,
  /\bbb\b.*\bcef\b/i,
  /\bcef\b.*\bbancos?\b/i,
  /^carregando\.?\.?\.?$/i,
  /executivo\s*[\-–(]?\s*administrat/i,
  /fiscal\s*[\-–]?\s*estadual/i,
  /\bicms\b/i,
  /^(legislativo|executivo|judici[aá]rio)(\s*[,\/&]\s*(legislativo|executivo|judici[aá]rio))*$/i,
  /^policial\s*[\-–(]\s*(agente|escrivão|escrivao|investigador)/i,
  /^[úu]ltimas\s+not[ií]cias$/i,
  /^concursos?\s+p[úu]blicos?$/i,
  /^concursos?\s+20\d{2}$/i,
  /tribunais?\s+de\s+contas?/i,
];

export function isTituloBloqueadoEstado(titulo = '') {
  return TITULOS_BLOQUEADOS_ESTADO.some(re => re.test(titulo.trim()));
}

// ─── PARSERS ──────────────────────────────────────────────────────────────────
export function parseRSS(xml, categoriaObj) {
  if (!xml || xml.length < 100) return [];
  const items = xml.match(/<item[\s>]([\s\S]*?)<\/item>/g) || [];
  return items.map((item) => {
    const titulo = stripHtml(
      item.match(/<title><!\[CDATA\[([\s\S]*?)\]\]><\/title>/)?.[1] ||
      item.match(/<title>([\s\S]*?)<\/title>/)?.[1] || ''
    );
    if (!titulo) return null;
    const link = (
      item.match(/<link>([\s\S]*?)<\/link>/)?.[1] ||
      item.match(/<link\s+href="([^"]+)"/)?.[1] || ''
    ).trim().replace(/\s/g, '');
    if (!link || !link.startsWith('http')) return null;
    if (isNoticiaRegional(link)) return null;
    const dataRaw    = item.match(/<pubDate>([\s\S]*?)<\/pubDate>/)?.[1]?.trim() || '';
    const autor      = stripHtml(
      item.match(/<dc:creator><!\[CDATA\[([\s\S]*?)\]\]><\/dc:creator>/)?.[1] ||
      item.match(/<dc:creator>([\s\S]*?)<\/dc:creator>/)?.[1] || 'Redação'
    );
    const descRaw    = item.match(/<description><!\[CDATA\[([\s\S]*?)\]\]><\/description>/)?.[1] ||
      item.match(/<description>([\s\S]*?)<\/description>/)?.[1] || '';
    const resumoTexto = stripHtml(descRaw);
    const resumo      = resumoTexto.substring(0, 220) + (resumoTexto.length > 220 ? '...' : '');
    return {
      id: link, titulo, link, dataRaw,
      dataFormatada: formatDate(dataRaw),
      dataRelativa:  formatDateRelativa(dataRaw),
      autor, resumo, categoria: categoriaObj, ia: null, _tipo: 'rss',
    };
  }).filter(Boolean);
}

export function parseConcursosAbertos(html, categoriaObj) {
  if (!html || html.length < 100) return [];
  const secoes  = [];
  const reSecao = /Concursos\s+Abertos[:\s–-]+([A-ZÀ-Ú][^\n\r<]{3,80})/gi;
  let mSecao;
  while ((mSecao = reSecao.exec(html)) !== null) {
    const area = stripHtml(mSecao[1]).replace(/\s+/g, ' ').trim();
    if (area.length < 3) continue;
    secoes.push({ pos: mSecao.index, area });
  }
  function areaParaPosicao(pos) {
    let melhor = 'Outros';
    for (const s of secoes) { if (s.pos <= pos) melhor = s.area; else break; }
    return melhor;
  }
  const PREFIXOS_VALIDOS = /^(concurso|pss|exame|seleção|processo seletivo|edital)\s/i;
  const concursos = [];
  const seen      = new Set();
  const reLink    = /<a\s[^>]*href=["'](https:\/\/www\.estrategiaconcursos\.com\.br\/blog\/[^"'?#][^"'?#]{4,}?\/)["'][^>]*>([\s\S]{4,120}?)<\/a>/gi;
  let mLink;
  while ((mLink = reLink.exec(html)) !== null) {
    const href   = mLink[1].trim();
    const titulo = stripHtml(mLink[2]).replace(/\s+/g, ' ').trim();
    if (!PREFIXOS_VALIDOS.test(titulo)) continue;
    if (/\/category\/|\/tag\/|\/page\/|\/feed\//i.test(href)) continue;
    if (seen.has(href)) continue;
    seen.add(href);
    const posApos    = mLink.index + mLink[0].length;
    const htmlApos   = html.substring(posApos, posApos + 4000);
    const proxAnchor = htmlApos.search(/<a\s[^>]*href=["']https:\/\/www\.estrategiaconcursos\.com\.br\/blog\/[^"'?#][^"'?#]{4,}?\/["']/i);
    const blocoHtml  = proxAnchor > 80 ? htmlApos.substring(0, proxAnchor) : htmlApos.substring(0, 2000);
    const d = extrairDadosDeTabela(blocoHtml);
    if (!d.banca && !d.inscricao && !d.vagas && !d.salario && !d.prova && !d.situacao) continue;
    const partesResumo = [];
    if (d.situacao)  partesResumo.push(`Situação: ${d.situacao}`);
    if (d.banca)     partesResumo.push(`Banca: ${d.banca}`);
    if (d.inscricao) partesResumo.push(`Inscrições: ${d.inscricao}`);
    if (d.prova)     partesResumo.push(`Prova: ${d.prova}`);
    if (d.vagas)     partesResumo.push(`Vagas: ${d.vagas}`);
    if (d.salario)   partesResumo.push(`Salário: ${d.salario}`);
    concursos.push({
      id: href, link: href, titulo,
      dataRaw: '', dataFormatada: '', dataRelativa: '',
      autor: 'Redação', resumo: partesResumo.join(' · '),
      categoria: categoriaObj, ia: null, _tipo: 'aberto',
      _area: areaParaPosicao(mLink.index), _dados: d,
    });
  }
  return concursos;
}

export function parseEstadoPage(html, estadoObj, categoriaRef) {
  if (!html || html.length < 100) return [];

  let htmlLimpo = html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<nav[\s\S]*?<\/nav>/gi, '')
    .replace(/<header[\s\S]*?<\/header>/gi, '')
    .replace(/<footer[\s\S]*?<\/footer>/gi, '');

  const contentSelectors = [
    /<main[^>]*>([\s\S]*?)<\/main>/i,
    /<article[^>]*>([\s\S]*?)<\/article>/i,
    /<div[^>]*class="[^"]*(?:entry-content|post-content|content|article-body)[^"]*"[^>]*>([\s\S]*?)<\/div>/i,
    /<section[^>]*class="[^"]*(?:posts|articles|content)[^"]*"[^>]*>([\s\S]*?)<\/section>/i,
  ];
  let htmlConteudo = htmlLimpo;
  for (const re of contentSelectors) {
    const match = htmlLimpo.match(re);
    if (match?.[1] && match[1].length > 500) { htmlConteudo = match[1]; break; }
  }

  const artigos = [];
  const seen    = new Set();
  const slugOficial = ESTADOS_SLUGS[estadoObj.uf] || estadoObj.slug || estadoObj.uf.toLowerCase();

  const reLink = /<a\s+[^>]*href=["'](https:\/\/www\.estrategiaconcursos\.com\.br\/blog\/[^"'?#]{8,}\/?)["'][^>]*>([\s\S]{5,300}?)<\/a>/gi;
  let m;

  while ((m = reLink.exec(htmlConteudo)) !== null) {
    const href   = m[1].trim().replace(/\/+$/, '') + '/';
    const titulo = stripHtml(m[2]).replace(/\s+/g, ' ').trim();

    if (/\/category\/|\/tag\/|\/page\/|\/feed\//i.test(href)) continue;
    if (isNoticiaRegional(href)) continue;
    if (isSlugDeEstado(href)) continue;
    if (seen.has(href)) continue;
    if (titulo.length < 10) continue;
    if (/^(home|blog|sobre|contato|login|cadastro|assine|planos|cursos|área do aluno|meus cursos|ver tudo|carregar mais|leia mais|saiba mais|clique aqui)$/i.test(titulo)) continue;
    if (isTituloBloqueadoEstado(titulo)) continue;

    seen.add(href);

    const contextoLocal  = htmlConteudo.substring(Math.max(0, m.index - 100), m.index + 800);
    const contextoTexto  = stripHtml(contextoLocal).replace(/\s+/g, ' ');
    const dataRaw = contextoTexto.match(/(\d{4}-\d{2}-\d{2}T\d{2}:\d{2})/)?.[1]
      || contextoTexto.match(/(\d{2}\/\d{2}\/\d{4})/)?.[1] || '';

    const blocoContexto = htmlConteudo.substring(m.index, Math.min(m.index + 1500, htmlConteudo.length));
    const dadosContexto = extrairDadosDeTabela(blocoContexto);
    const temDadosContexto = dadosContexto.banca || dadosContexto.vagas || dadosContexto.salario || dadosContexto.inscricao || dadosContexto.prova;

    artigos.push({
      id: href, link: href, titulo, dataRaw,
      dataFormatada: formatDate(dataRaw),
      dataRelativa:  formatDateRelativa(dataRaw),
      autor: 'Redação', resumo: '',
      categoria: categoriaRef || { label: estadoObj.nome, cor: 'bg-zinc-600' },
      ia: null, _tipo: 'estado',
      _slugEstado:  slugOficial,
      _urlEstado:   `${BASE}/concursos-${slugOficial}/`,
      _dados:       temDadosContexto ? dadosContexto : null,
    });

    if (artigos.length >= 60) break;
  }

  // Fallback
  if (artigos.length < 3) {
    const fallbackRe = /<a\s+[^>]*href=["'](https:\/\/www\.estrategiaconcursos\.com\.br\/blog\/[^"']{12,}\/?)["'][^>]*>([^<]{8,200})<\/a>/gi;
    while ((m = fallbackRe.exec(html)) !== null) {
      const href   = m[1].trim().replace(/\/+$/, '') + '/';
      const titulo = stripHtml(m[2]).replace(/\s+/g, ' ').trim();
      if (/\/category\/|\/tag\/|\/page\/|\/feed\//i.test(href)) continue;
      if (isNoticiaRegional(href)) continue;
      if (isSlugDeEstado(href)) continue;
      if (seen.has(href)) continue;
      if (titulo.length < 10) continue;
      if (isTituloBloqueadoEstado(titulo)) continue;
      seen.add(href);
      artigos.push({
        id: href, link: href, titulo,
        dataRaw: '', dataFormatada: '', dataRelativa: '',
        autor: 'Redação', resumo: '',
        categoria: categoriaRef || { label: estadoObj.nome, cor: 'bg-zinc-600' },
        ia: null, _tipo: 'estado', _slugEstado: slugOficial,
        _urlEstado: `${BASE}/concursos-${slugOficial}/`,
      });
      if (artigos.length >= 40) break;
    }
  }

  return artigos;
}

export function parseRegiaoPage(html, regiaoObj) {
  if (!html || html.length < 100) return [];
  let htmlLimpo = html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<nav[\s\S]*?<\/nav>/gi, '')
    .replace(/<header[\s\S]*?<\/header>/gi, '')
    .replace(/<footer[\s\S]*?<\/footer>/gi, '');
  const mainMatch = htmlLimpo.match(/<main[\s\S]*?>([\s\S]*?)<\/main>/i)
    || htmlLimpo.match(/<article[\s\S]*?>([\s\S]*?)<\/article>/i);
  const htmlConteudo = mainMatch ? mainMatch[1] : htmlLimpo;
  const secoes  = [];
  const reSecao = /(?:Concursos\s+Abertos[:\s–-]+|<h[2-4][^>]*>)([A-ZÀ-Ú][^\n\r<]{3,80})/gi;
  let mSecao;
  while ((mSecao = reSecao.exec(htmlConteudo)) !== null) {
    const area = stripHtml(mSecao[1]).replace(/\s+/g, ' ').trim();
    if (area.length < 3) continue;
    if (!/área|policial|fiscal|tribunal|ministério|bancár|educac|saúde|legislat|militar|municipal|federal|estadual|prefeit|outros/i.test(area)) continue;
    secoes.push({ pos: mSecao.index, area });
  }
  function areaParaPosicao(pos) {
    let melhor = 'Geral';
    for (const s of secoes) { if (s.pos <= pos) melhor = s.area; else break; }
    return melhor;
  }
  const PREFIXOS_VALIDOS = /^(concurso|pss|exame|seleção|processo seletivo|edital)\s/i;
  const concursos = [];
  const seen      = new Set();
  const reLink    = /<a\s[^>]*href=["'](https:\/\/www\.estrategiaconcursos\.com\.br\/blog\/[^"'?#][^"'?#]{4,}?\/)["'][^>]*>([\s\S]{4,120}?)<\/a>/gi;
  let mLink;
  while ((mLink = reLink.exec(htmlConteudo)) !== null) {
    const href   = mLink[1].trim();
    const titulo = stripHtml(mLink[2]).replace(/\s+/g, ' ').trim();
    if (!PREFIXOS_VALIDOS.test(titulo)) continue;
    if (/\/category\/|\/tag\/|\/page\/|\/feed\//i.test(href)) continue;
    if (seen.has(href)) continue;
    seen.add(href);
    const posApos    = mLink.index + mLink[0].length;
    const htmlApos   = htmlConteudo.substring(posApos, posApos + 4000);
    const proxAnchor = htmlApos.search(/<a\s[^>]*href=["']https:\/\/www\.estrategiaconcursos\.com\.br\/blog\/[^"'?#][^"'?#]{4,}?\/["']/i);
    const blocoHtml  = proxAnchor > 80 ? htmlApos.substring(0, proxAnchor) : htmlApos.substring(0, 2000);
    const d = extrairDadosDeTabela(blocoHtml);
    if (!d.banca && !d.inscricao && !d.vagas && !d.salario && !d.prova && !d.situacao) continue;
    const partesResumo = [];
    if (d.situacao)  partesResumo.push(`Situação: ${d.situacao}`);
    if (d.banca)     partesResumo.push(`Banca: ${d.banca}`);
    if (d.inscricao) partesResumo.push(`Inscrições: ${d.inscricao}`);
    if (d.prova)     partesResumo.push(`Prova: ${d.prova}`);
    if (d.vagas)     partesResumo.push(`Vagas: ${d.vagas}`);
    if (d.salario)   partesResumo.push(`Salário: ${d.salario}`);
    concursos.push({
      id: href, link: href, titulo,
      dataRaw: '', dataFormatada: '', dataRelativa: '',
      autor: 'Redação', resumo: partesResumo.join(' · '),
      categoria: { ...regiaoObj }, ia: null, _tipo: 'regiao',
      _area: areaParaPosicao(mLink.index), _regiao: regiaoObj.id, _dados: d,
    });
  }
  return concursos;
}

// ─── buscarPorCategoria ───────────────────────────────────────────────────────
export async function buscarPorCategoria(cat) {
  if (cat.tipo === 'pagina') {
    const html = await fetchViaProxy(cat.url);
    return parseConcursosAbertos(html, cat);
  }
  if (cat.tipo === 'regiao') {
    const html = await fetchViaProxy(cat.url);
    return parseRegiaoPage(html, cat);
  }
  const resultados = await Promise.allSettled(
    cat.feeds.map(feed => fetchViaProxy(feed).then(xml => parseRSS(xml, cat)))
  );
  const visto = new Set(); const lista = [];
  for (const r of resultados) {
    if (r.status === 'fulfilled')
      for (const n of r.value) { if (!visto.has(n.id)) { visto.add(n.id); lista.push(n); } }
  }
  lista.sort((a, b) => (b.dataRaw ? new Date(b.dataRaw) : 0) - (a.dataRaw ? new Date(a.dataRaw) : 0));
  return lista;
}

// ════════════════════════════════════════════════════════════════════════════
// HOOK PRINCIPAL: useNoticias
// ════════════════════════════════════════════════════════════════════════════
export function useNoticias(CATEGORIAS, CATS_RSS) {
  const [noticias, setNoticias]             = useState([]);
  const [loading, setLoading]               = useState(true);
  const [erro, setErro]                     = useState(false);
  const [catAtiva, setCatAtiva]             = useState(CATEGORIAS[0]);
  const [atualizado, setAtualizado]         = useState(null);
  const [artigoAberto, setArtigoAberto]     = useState(null);

  const [regiaoAtiva, setRegiaoAtiva]       = useState(null);
  const [noticiasRegiao, setNoticiasRegiao] = useState([]);
  const [loadingRegiao, setLoadingRegiao]   = useState(false);
  const [erroRegiao, setErroRegiao]         = useState(false);

  const [estadoFiltro, setEstadoFiltro]     = useState(null);
  const [noticiasEstado, setNoticiasEstado] = useState([]);
  const [loadingEstado, setLoadingEstado]   = useState(false);
  const [erroEstado, setErroEstado]         = useState(false);

  const fetchTokenRef  = useRef(0);
  const fetchRegiaoRef = useRef(0);
  const fetchEstadoRef = useRef(0);

  // ─── Carrega categoria ──────────────────────────────────────────────────
  const carregar = useCallback(async (cat) => {
    const token = ++fetchTokenRef.current;
    if (listaCache.has(cat.id)) {
      if (token !== fetchTokenRef.current) return;
      setNoticias(listaCache.get(cat.id)); setLoading(false); return;
    }
    setLoading(true); setErro(false); setNoticias([]);
    try {
      let data = [];
      if (cat.tipo === 'todas') {
        const resultados = await Promise.allSettled(CATS_RSS.map(c => buscarPorCategoria(c)));
        const visto = new Set(); const todas = [];
        for (const r of resultados) {
          if (r.status === 'fulfilled')
            for (const n of r.value) { if (!visto.has(n.id)) { visto.add(n.id); todas.push(n); } }
        }
        todas.sort((a, b) => (b.dataRaw ? new Date(b.dataRaw) : 0) - (a.dataRaw ? new Date(a.dataRaw) : 0));
        data = todas;
      } else {
        data = await buscarPorCategoria(cat);
      }
      if (token !== fetchTokenRef.current) return;
      const dataFiltrada = data.filter(n => !isNoticiaRegional(n.link || n.id || ''));
      setNoticias(dataFiltrada); setLoading(false); setAtualizado(new Date());
      if (cat.tipo !== 'pagina') {
        analisarListaNoticias(dataFiltrada)
          .then(analises => {
            if (token !== fetchTokenRef.current) return;
            if (!analises?.length) return;
            const enriquecidas = dataFiltrada.map((n, i) => ({ ...n, ia: analises[i] || null }));
            listaCache.set(cat.id, enriquecidas);
            if (token === fetchTokenRef.current) setNoticias(enriquecidas);
          })
          .catch(() => { listaCache.set(cat.id, dataFiltrada); });
      } else {
        listaCache.set(cat.id, dataFiltrada);
      }
    } catch {
      if (token !== fetchTokenRef.current) return;
      setErro(true); setNoticias([]); setLoading(false);
    }
  }, [CATS_RSS]);

  // ─── Carrega região ─────────────────────────────────────────────────────
  const carregarRegiao = useCallback(async (regiao) => {
    const token = ++fetchRegiaoRef.current;
    if (regionCache.has(regiao.id)) {
      if (token !== fetchRegiaoRef.current) return;
      setNoticiasRegiao(regionCache.get(regiao.id)); setLoadingRegiao(false); return;
    }
    setLoadingRegiao(true); setErroRegiao(false); setNoticiasRegiao([]);
    try {
      const html = await fetchViaProxy(regiao.url);
      if (token !== fetchRegiaoRef.current) return;
      const data = parseRegiaoPage(html, regiao);
      regionCache.set(regiao.id, data);
      setNoticiasRegiao(data); setLoadingRegiao(false);
    } catch {
      if (token !== fetchRegiaoRef.current) return;
      setErroRegiao(true); setLoadingRegiao(false);
    }
  }, []);

  // ─── Carrega estado ─────────────────────────────────────────────────────
  const carregarEstado = useCallback(async (estadoObj) => {
    const token    = ++fetchEstadoRef.current;
    const cacheKey = `estado_${estadoObj.uf}`;

    if (estadoCache.has(cacheKey)) {
      if (token !== fetchEstadoRef.current) return;
      setNoticiasEstado(estadoCache.get(cacheKey));
      setLoadingEstado(false);
      return;
    }

    setLoadingEstado(true);
    setErroEstado(false);
    setNoticiasEstado([]);

    const slugOficial = ESTADOS_SLUGS[estadoObj.uf] || estadoObj.slug || estadoObj.uf.toLowerCase();
    const urlEstado   = `${BASE}/concursos-${slugOficial}/`;

    try {
      const html = await fetchViaProxy(urlEstado, { timeout: 18000, retries: 3 });
      if (token !== fetchEstadoRef.current) return;

      const catRef      = { id: `estado_${estadoObj.uf}`, label: estadoObj.nome, cor: 'bg-red-600' };
      const dadosBrutos = parseEstadoPage(html, estadoObj, catRef);

      let resultadoFinal = dadosBrutos;
      try {
        resultadoFinal = await filtrarTitulosComIA(dadosBrutos);
      } catch {
        resultadoFinal = dadosBrutos;
      }

      if (token !== fetchEstadoRef.current) return;
      setNoticiasEstado(resultadoFinal);
      setLoadingEstado(false);
      estadoCache.set(cacheKey, resultadoFinal);
    } catch (err) {
      console.warn(`[Estado ${estadoObj.uf}] Erro ao carregar:`, err?.message);
      if (token !== fetchEstadoRef.current) return;
      setNoticiasEstado([]);
      setLoadingEstado(false);
    }
  }, []);

  // ─── Ações ──────────────────────────────────────────────────────────────
  const mudarCategoria = useCallback((cat) => {
    window.scrollTo({ top: 0, behavior: 'instant' });
    setRegiaoAtiva(null); setEstadoFiltro(null);
    if (cat.id !== catAtiva.id) setCatAtiva(cat);
    setArtigoAberto(null);
  }, [catAtiva.id]);

  const mudarRegiao = useCallback((regiao) => {
    window.scrollTo({ top: 0, behavior: 'instant' });
    setArtigoAberto(null); setEstadoFiltro(null);
    if (regiaoAtiva?.id === regiao.id) { setRegiaoAtiva(null); return; }
    setRegiaoAtiva(regiao); carregarRegiao(regiao);
  }, [regiaoAtiva, carregarRegiao]);

  const mudarEstado = useCallback((estado) => {
    window.scrollTo({ top: 0, behavior: 'instant' });
    setRegiaoAtiva(null); setArtigoAberto(null);
    if (!estado) { setEstadoFiltro(null); return; }
    if (estadoFiltro?.uf === estado) { setEstadoFiltro(null); return; }
    const estadoObj = ESTADOS_LISTA.find(e => e.uf === estado);
    if (estadoObj) setEstadoFiltro(estadoObj);
  }, [estadoFiltro]);

  const handleAbrirPorUrl = useCallback((url, tituloFallback) => {
    const catRef = regiaoAtiva ? { ...regiaoAtiva } : catAtiva;
    setArtigoAberto({ id: url, link: url, titulo: tituloFallback || 'Carregando...', autor: 'Redação', dataRaw: '', dataFormatada: '', dataRelativa: '', resumo: '', categoria: catRef, ia: null });
  }, [catAtiva, regiaoAtiva]);

  return {
    // state
    noticias, loading, erro, catAtiva, atualizado, artigoAberto,
    regiaoAtiva, noticiasRegiao, loadingRegiao, erroRegiao,
    estadoFiltro, noticiasEstado, loadingEstado, erroEstado,
    // setters
    setArtigoAberto, setRegiaoAtiva, setEstadoFiltro, setNoticiasEstado,
    // actions
    carregar, carregarRegiao, carregarEstado,
    mudarCategoria, mudarRegiao, mudarEstado,
    handleAbrirPorUrl,
    handleAbrirNoticia: useCallback((noticia) => setArtigoAberto(noticia), []),
  };
}