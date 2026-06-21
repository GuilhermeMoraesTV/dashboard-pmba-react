import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft, ExternalLink, ChevronUp,
  AlertCircle, Loader2,
  Building2, Users, Wallet, GraduationCap,
  Calendar, CalendarDays, BadgeCheck, FileText,
} from 'lucide-react';
import StatusBadge from './StatusBadge';
// ✅ USA O SERVIÇO CENTRALIZADO — sem chave de API duplicada aqui
import { reescreverArtigo } from '../../services/noticiaIA';
import { sanitizeArticleHtml } from '../../utils/sanitizeHtml';
import { fetchNewsSource } from '../../services/newsSource';

// ─── LOGO ESTRATÉGIA (com fallback) ──────────────────────────────────────────
function LogoComFallback({ size = 'sm' }) {
  const [erro, setErro] = useState(false);
  const sz         = size === 'lg' ? 'w-8 h-8' : size === 'md' ? 'w-6 h-6' : 'w-5 h-5';
  const szFallback = size === 'lg' ? 'w-8 h-8 text-sm' : size === 'md' ? 'w-6 h-6 text-[10px]' : 'w-5 h-5 text-[8px]';
  if (erro) {
    return (
      <div className={`${szFallback} rounded-full bg-gradient-to-br from-red-500 to-red-700 flex items-center justify-center flex-shrink-0 shadow-sm`}>
        <span className="text-white font-black">E</span>
      </div>
    );
  }
  return (
    <img
      src="/logo-estrategia.png"
      alt="Estratégia"
      className={`${sz} rounded object-contain flex-shrink-0`}
      onError={() => setErro(true)}
    />
  );
}

// ─── HELPERS ──────────────────────────────────────────────────────────────────
function stripHtmlBasico(html = '') {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function extrairCorpoArtigo(html) {
  if (!html) return '';
  const seletores = [
    /<article[^>]*>([\s\S]*?)<\/article>/i,
    /<div[^>]*class=["'][^"']*(?:entry-content|post-content|article-content|content-post|single-content)[^"']*["'][^>]*>([\s\S]*?)<\/div>/i,
  ];
  for (const re of seletores) {
    const m = html.match(re);
    if (m?.[1] && m[1].length > 300) return m[1];
  }
  const main = html.match(/<main[^>]*>([\s\S]*?)<\/main>/i);
  if (main?.[1]) return main[1];
  return html;
}

// ─── CACHE LOCAL ──────────────────────────────────────────────────────────────
const _artCache = new Map();

// ─── HOOK PRINCIPAL ───────────────────────────────────────────────────────────
// CORREÇÃO #1 — Loop infinito:
//   Dependências do useEffect eram objetos (noticia, ia) recriados a cada render.
//   Agora usamos apenas primitivos estáveis (link, titulo, resumo, id).
//
// CORREÇÃO #2 — Gemini duplicado com VITE_GEMINI_API_KEY:
//   A versão antiga tinha chamarGemini() local lendo do .env.
//   Agora delegamos tudo para reescreverArtigo() → aiAdapter → Firebase Secret.
function useArtigoProcessado(noticia) {
  // Primitivos estáveis — seguros como dependências de useEffect
  const link   = noticia?.link    || '';
  const titulo = noticia?.titulo  || '';
  const resumo = noticia?.resumo  || '';
  const id     = noticia?.id      || '';

  // ia é um objeto que muda de referência a cada render do pai.
  // Guardamos num ref para leitura dentro do effect sem adicioná-lo como dep.
  const iaRef = useRef(noticia?.ia || {});
  useEffect(() => { iaRef.current = noticia?.ia || {}; });

  const cacheKey = link || `noticia_sem_link_${id || titulo || 'item'}`;

  const [estado, setEstado] = useState(() => {
    const ia     = iaRef.current;
    const jaProc = ia.conteudo_formatado || ia.texto_completo_formatado || '';
    if (jaProc) return { fase: 'pronto', dados: ia, html: jaProc };
    return { fase: 'idle', dados: ia, html: '' };
  });

  useEffect(() => {
    const ia     = iaRef.current;
    const jaProc = ia.conteudo_formatado || ia.texto_completo_formatado || '';

    // Já processado pela pipeline de lista — usa direto, sem IA
    if (jaProc) {
      setEstado({ fase: 'pronto', dados: ia, html: jaProc });
      return;
    }

    // Sem conteúdo disponível
    if (!link && !resumo) {
      setEstado(s => ({ ...s, fase: 'sem_conteudo' }));
      return;
    }

    // Cache local do componente
    if (_artCache.has(cacheKey)) {
      const cached = _artCache.get(cacheKey);
      setEstado({ fase: 'pronto', dados: cached, html: cached.conteudo_formatado || '' });
      return;
    }

    let cancelado = false;

    async function processar() {
      setEstado(s => ({ ...s, fase: 'buscando' }));

      let htmlBruto   = '';
      let proxyFalhou = false;

      if (link) {
        try {
          const raw = await fetchNewsSource(link);
          htmlBruto = extrairCorpoArtigo(raw);
        } catch {
          proxyFalhou = true;
          htmlBruto   = resumo;
        }
      } else {
        htmlBruto = resumo;
      }

      if (cancelado) return;

      setEstado(s => ({ ...s, fase: 'processando' }));
      const textoBruto = stripHtmlBasico(htmlBruto).slice(0, 6000) || resumo.slice(0, 6000);

      // Objeto mínimo sem referenciar `noticia` (evita capturar referência instável)
      // ia é lido via ref para não adicionar dependência instável no effect
      const noticiaRef = { titulo, resumo, link, id, ia: iaRef.current };

      try {
        // ✅ Chama o serviço centralizado — a chave Gemini fica no aiAdapter/Firebase Secret
        const resultado = await reescreverArtigo(cacheKey, noticiaRef, textoBruto);

        if (!resultado) {
          if (!cancelado && resumo) {
            // Fallback: nunca deixa a tela em branco quando há resumo
            const html = `<h3>Resumo</h3><p>${resumo}</p><p><em>Para leitura completa acesse a notícia original.</em></p>`;
            const dados = { titulo_inteligente: titulo, titulo_limpo: titulo, status: '', resumo_limpo: resumo };
            _artCache.set(cacheKey, { ...dados, conteudo_formatado: html });
            setEstado({ fase: 'pronto', dados, html });
          } else if (!cancelado) {
            setEstado(s => ({ ...s, fase: 'irrelevante' }));
          }
          return;
        }

        _artCache.set(cacheKey, resultado);
        if (!cancelado) {
          setEstado({
            fase: 'pronto',
            dados: resultado,
            html: resultado.conteudo_formatado || resultado.texto_completo_formatado || '',
            ...(proxyFalhou ? { avisoProxy: true } : {}),
          });
        }
      } catch (err) {
        console.error('[NoticiaDetalhe] processamento falhou:', err);
        if (!cancelado && resumo) {
          const html = `<h3>Resumo</h3><p>${resumo}</p><p><em>Para leitura completa acesse a notícia original.</em></p>`;
          setEstado({
            fase: 'pronto',
            dados: { titulo_inteligente: titulo, titulo_limpo: titulo, status: '', resumo_limpo: resumo },
            html,
          });
        } else if (!cancelado) {
          setEstado(s => ({ ...s, fase: proxyFalhou ? 'erro_proxy' : 'erro' }));
        }
      }
    }

    processar();
    return () => { cancelado = true; };

  // ✅ Apenas primitivos — sem objetos que causam loop infinito
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cacheKey, link, resumo, titulo]);

  return estado;
}

// ─── QUADRO RESUMO ────────────────────────────────────────────────────────────
function QuadroResumo({ dados }) {
  if (!dados) return null;
  const d        = dados.quadro || {};
  const status   = dados.status         || d.situacao || '';
  const banca    = dados.banca          || d.banca    || '';
  const vagas    = dados.vagas          || d.vagas    || '';
  const salario  = dados.salario_maximo || d.salario  || '';
  const inscricao = d.inscricao || '';
  const prova     = d.prova     || '';
  const requisito = d.requisito || '';
  const requisitos = Array.isArray(dados.requisitos_principais) ? dados.requisitos_principais : [];

  const campos = [
    { icon: BadgeCheck,   label: 'Situação',   valor: status,    cor: 'text-blue-500',   bg: 'bg-blue-50 dark:bg-blue-900/20' },
    { icon: Building2,    label: 'Banca',      valor: banca,     cor: 'text-zinc-500',   bg: 'bg-zinc-50 dark:bg-zinc-800' },
    { icon: Calendar,     label: 'Inscrições', valor: inscricao, cor: 'text-violet-500', bg: 'bg-violet-50 dark:bg-violet-900/20' },
    { icon: CalendarDays, label: 'Prova',      valor: prova,     cor: 'text-orange-500', bg: 'bg-orange-50 dark:bg-orange-900/20' },
    { icon: Users,        label: 'Vagas',      valor: vagas,     cor: 'text-zinc-500',   bg: 'bg-zinc-50 dark:bg-zinc-800' },
    { icon: Wallet,       label: 'Salário',    valor: salario,   cor: 'text-red-600',    bg: 'bg-red-50 dark:bg-red-900/20', destaque: true },
  ].filter(c => c.valor);

  if (!campos.length && !requisitos.length && !requisito) return null;

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
      className="rounded-2xl border border-zinc-200 dark:border-zinc-700 overflow-hidden bg-white dark:bg-zinc-900 shadow-lg shadow-zinc-200/60 dark:shadow-black/30 mb-4"
    >
      <div className="bg-gradient-to-r from-red-600 to-red-800 px-5 py-3 flex items-center gap-3">
        <BadgeCheck size={14} className="text-white/70" />
        <span className="text-white text-xs font-black uppercase tracking-wider">Dados do Concurso</span>
        {status && <StatusBadge status={status} size="sm" className="ml-auto" />}
      </div>
      {campos.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3">
          {campos.map((c, i) => (
            <motion.div key={i} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.12 + i * 0.04 }}
              className="flex items-center gap-2.5 px-4 py-3 border-b border-r border-zinc-100 dark:border-zinc-800"
            >
              <div className={`w-8 h-8 rounded-lg ${c.bg} flex items-center justify-center flex-shrink-0`}>
                <c.icon size={14} className={c.cor} />
              </div>
              <div className="min-w-0">
                <span className="text-[9px] text-zinc-400 font-black uppercase tracking-wider block">{c.label}</span>
                <p className={`text-xs font-semibold leading-tight mt-0.5 truncate ${c.destaque ? 'text-red-600 dark:text-red-400 font-black text-sm' : 'text-zinc-800 dark:text-zinc-200'}`}>
                  {c.valor}
                </p>
              </div>
            </motion.div>
          ))}
        </div>
      )}
      {(requisitos.length > 0 || requisito) && (
        <div className="border-t border-zinc-100 dark:border-zinc-800 px-5 py-3 bg-zinc-50/50 dark:bg-zinc-800/30">
          <div className="flex items-center gap-1.5 mb-2">
            <GraduationCap size={12} className="text-zinc-400" />
            <span className="text-[9px] text-zinc-400 font-black uppercase tracking-wider">Requisitos</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {requisitos.length > 0
              ? requisitos.map((r, i) => (
                  <span key={i} className="text-xs bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 px-2.5 py-1 rounded-lg font-medium">{r}</span>
                ))
              : <p className="text-xs text-zinc-600 dark:text-zinc-400">{requisito}</p>
            }
          </div>
        </div>
      )}
    </motion.div>
  );
}

// ─── RENDERIZADOR HTML LIMPO ──────────────────────────────────────────────────
function HtmlLimpo({ html }) {
  if (!html) return null;
  const htmlSeguro = sanitizeArticleHtml(html);
  const estilizado = htmlSeguro
    .replace(/<h3\b[^>]*>/gi, '<h3 style="font-size:0.95rem;font-weight:800;margin:1.25rem 0 0.5rem;padding-bottom:0.4rem;border-bottom:2px solid rgba(220,38,38,0.15)">')
    .replace(/<p\b[^>]*>/gi, '<p style="font-size:0.875rem;line-height:1.75;margin:0.6rem 0">')
    .replace(/<ul\b[^>]*>/gi, '<ul style="padding-left:1.25rem;margin:0.6rem 0;list-style:disc">')
    .replace(/<ol\b[^>]*>/gi, '<ol style="padding-left:1.25rem;margin:0.6rem 0;list-style:decimal">')
    .replace(/<li\b[^>]*>/gi, '<li style="font-size:0.85rem;line-height:1.6;margin:0.25rem 0">')
    .replace(/<strong\b[^>]*>/gi, '<strong style="font-weight:700">')
    .replace(/<em\b[^>]*>/gi, '<em style="font-style:italic;opacity:0.7;font-size:0.8rem">')
    .replace(/<table\b[^>]*>/gi, '<table style="width:100%;border-collapse:collapse;font-size:0.8rem;margin:1rem 0;border-radius:10px;overflow:hidden;border:1px solid rgba(220,38,38,0.15)">')
    .replace(/<thead\b[^>]*>/gi, '<thead style="background:linear-gradient(135deg,#dc2626,#991b1b)">')
    .replace(/<th\b[^>]*>/gi, '<th style="padding:0.5rem 0.75rem;text-align:left;font-size:0.68rem;font-weight:800;color:#fff;text-transform:uppercase;letter-spacing:0.06em">')
    .replace(/<tbody\b[^>]*>/gi, '<tbody>')
    .replace(/<tr\b[^>]*>/gi, '<tr style="border-bottom:1px solid rgba(220,38,38,0.08)">')
    .replace(/<td\b[^>]*>/gi, '<td style="padding:0.45rem 0.75rem;font-size:0.82rem;font-weight:500">');
  return <div className="text-zinc-700 dark:text-zinc-300" dangerouslySetInnerHTML={{ __html: estilizado }} />;
}

// ─── LOADING STATE ────────────────────────────────────────────────────────────
function LoadingState({ fase }) {
  const info = fase === 'processando'
    ? { icon: '📄', titulo: 'Processando artigo...', sub: 'Extraindo e organizando as informações' }
    : { icon: '🔍', titulo: 'Buscando artigo...', sub: 'Conectando ao site original' };
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center py-12 gap-3">
      <motion.div animate={{ scale: [1, 1.08, 1] }} transition={{ repeat: Infinity, duration: 1.5 }}
        className="w-12 h-12 rounded-2xl bg-red-50 dark:bg-red-900/20 flex items-center justify-center text-2xl">
        {info.icon}
      </motion.div>
      <div className="text-center">
        <p className="text-sm font-bold text-zinc-700 dark:text-zinc-300">{info.titulo}</p>
        <p className="text-xs text-zinc-400 mt-0.5">{info.sub}</p>
      </div>
      <Loader2 size={15} className="text-red-400 animate-spin mt-1" />
    </motion.div>
  );
}

// ─── COMPONENTE PRINCIPAL ─────────────────────────────────────────────────────
export default function NoticiaDetalhe({ noticia, onVoltar }) {
  const [mostrarTopo, setMostrarTopo] = useState(false);
  const { fase, dados, html } = useArtigoProcessado(noticia);

  const titulo  = dados?.titulo_inteligente || dados?.titulo || dados?.titulo_limpo || noticia?.titulo || 'Concurso';
  const status  = dados?.status || noticia?.ia?.status || '';
  const orgao   = dados?.orgao  || noticia?.ia?.orgao  || '';
  const link    = noticia?.link || '';
  const loading = fase === 'buscando' || fase === 'processando';

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
    const onScroll = () => setMostrarTopo(window.scrollY > 400);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <motion.div initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }} transition={{ duration: 0.3 }}
      className="min-h-screen bg-transparent pb-16"
    >
      <div className="max-w-2xl mx-auto px-4 sm:px-6">

        {/* Voltar */}
        <div className="py-4">
          <motion.button onClick={onVoltar} whileHover={{ x: -2 }} whileTap={{ scale: 0.97 }}
            className="flex items-center gap-2 text-sm font-semibold text-zinc-500 hover:text-red-600 dark:hover:text-red-400 transition-colors"
          >
            <span className="w-8 h-8 rounded-xl bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 flex items-center justify-center shadow-sm hover:border-red-200 dark:hover:border-red-800 transition-colors">
              <ArrowLeft size={15} />
            </span>
            Voltar
          </motion.button>
        </div>

        {/* ── CABEÇALHO ── */}
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
          className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-700 p-5 sm:p-7 mb-4 shadow-lg shadow-zinc-200/60 dark:shadow-black/30"
        >
          <div className="flex items-center gap-2 flex-wrap mb-3">
            {status && <StatusBadge status={status} size="lg" />}
            {orgao && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 text-xs font-semibold">
                <Building2 size={11} /> {orgao}
              </span>
            )}
            {loading && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-600 text-[10px] font-bold border border-red-100 dark:border-red-800/30">
                <Loader2 size={9} className="animate-spin" /> {fase === 'processando' ? 'Processando' : 'Carregando'}
              </span>
            )}
          </div>
          <h1 className="text-lg sm:text-xl font-black text-zinc-900 dark:text-white leading-tight mb-4">{titulo}</h1>
          <div className="flex items-center justify-between pt-3 border-t border-zinc-100 dark:border-zinc-800">
            <div className="flex items-center gap-1.5">
              <LogoComFallback />
              <span className="text-[10px] text-zinc-400 font-medium">Estratégia Concursos</span>
            </div>
            {link && (
              <a href={link} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-1 text-[10px] font-bold text-red-600 dark:text-red-400 hover:underline transition-colors">
                Ver original <ExternalLink size={9} />
              </a>
            )}
          </div>
        </motion.div>

        {/* ── QUADRO DE DADOS ── */}
        {!loading && dados && <QuadroResumo dados={dados} />}

        {/* ── CONTEÚDO ── */}
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
          className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-700 shadow-lg shadow-zinc-200/60 dark:shadow-black/30 overflow-hidden mb-4"
        >
          <div className="flex items-center gap-2 px-5 py-3 border-b border-zinc-100 dark:border-zinc-800">
            <FileText size={13} className="text-red-500" />
            <span className="text-xs font-black text-zinc-500 uppercase tracking-wider">Resumo do Artigo</span>
          </div>
          <div className="p-5 sm:p-6">
            {loading && <LoadingState fase={fase} />}

            {!loading && fase === 'pronto' && html && <HtmlLimpo html={html} />}

            {!loading && (fase === 'pronto' || fase === 'idle') && !html && noticia?.resumo && (
              <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">{noticia.resumo}</p>
            )}

            {!loading && fase === 'erro_proxy' && (
              <div className="flex items-start gap-3 bg-amber-50 dark:bg-amber-900/10 border border-amber-100 dark:border-amber-800/30 rounded-xl p-4">
                <AlertCircle size={16} className="text-amber-500 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-bold text-amber-700 dark:text-amber-400">Artigo temporariamente indisponível</p>
                  <p className="text-xs text-amber-600 dark:text-amber-500 mt-1">Acesse o link original para ler o conteúdo completo.</p>
                </div>
              </div>
            )}

            {!loading && fase === 'erro' && (
              <div className="space-y-3">
                <div className="flex items-start gap-3 bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700 rounded-xl p-4">
                  <AlertCircle size={16} className="text-zinc-400 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-zinc-600 dark:text-zinc-300 font-medium">Não foi possível processar este artigo no momento.</p>
                </div>
                {noticia?.resumo && (
                  <p className="text-sm text-zinc-500 leading-relaxed px-1">{noticia.resumo}</p>
                )}
              </div>
            )}

            {!loading && (fase === 'irrelevante' || fase === 'sem_conteudo') && (
              <p className="text-sm text-zinc-400 text-center py-8">
                {fase === 'irrelevante' ? 'Conteúdo não relacionado a concursos.' : 'Conteúdo não disponível.'}
              </p>
            )}
          </div>
        </motion.div>

        {/* ── FOOTER ── */}
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
          className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-700 shadow-lg shadow-zinc-200/60 dark:shadow-black/30 overflow-hidden"
        >
          <div className="h-1 bg-gradient-to-r from-red-500 via-red-600 to-red-700" />
          <div className="p-4 flex items-center gap-3">
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <LogoComFallback size="md" />
              <div className="min-w-0">
                <p className="text-[10px] font-black text-zinc-700 dark:text-zinc-300 leading-none">Estratégia Concursos</p>
                <p className="text-[9px] text-zinc-400 mt-0.5 truncate">Conteúdo original no site oficial</p>
              </div>
            </div>
            <motion.button onClick={onVoltar} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
              className="flex-shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 text-xs font-bold hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-all"
            >
              <ArrowLeft size={12} /> Voltar
            </motion.button>
            {link && (
              <motion.a href={link} target="_blank" rel="noopener noreferrer"
                whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
                className="flex-shrink-0 flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-red-600 to-red-700 text-white rounded-xl text-xs font-black uppercase tracking-wide hover:from-red-700 hover:to-red-800 active:scale-95 transition-all shadow-md shadow-red-600/30"
              >
                Ler completo <ExternalLink size={11} />
              </motion.a>
            )}
          </div>
        </motion.div>

      </div>

      {/* Botão topo */}
      <AnimatePresence>
        {mostrarTopo && (
          <motion.button
            initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.8 }}
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            className="fixed bottom-6 right-6 z-40 w-11 h-11 rounded-xl bg-gradient-to-br from-red-500 to-red-700 text-white shadow-lg shadow-red-600/30 flex items-center justify-center hover:scale-105 active:scale-95 transition-transform"
          >
            <ChevronUp size={18} />
          </motion.button>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
