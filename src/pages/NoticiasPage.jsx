// src/pages/NoticiasPage.jsx
// Componente de UI apenas — toda a lógica está em useNoticias.js e noticiasConfig.js
import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ExternalLink,
  BookOpen, Search, X, WifiOff, ChevronRight,
  Filter, RefreshCw, MapPin,
  BadgeCheck, Building2, Calendar, CalendarDays, Users, Wallet,
  TrendingUp, ChevronDown, Globe
} from 'lucide-react';

import { ESTADOS_LISTA, ESTADOS_SLUGS } from '../utils/estadosSlugs';
import { StatusBadge, NoticiaDetalhe } from '../components/noticias';
import { listaCache } from '../services/noticiaIA';
import { sanitizarValorCampo } from '../hooks/useNoticias';
import { useNoticias } from '../hooks/useNoticias';
import { CATEGORIAS, CATS_RSS, REGIOES, getSvgPattern, BASE } from '../config/noticiasConfig';

// ─── LOGO ESTRATÉGIA ─────────────────────────────────────────────────────────
function LogoComFallback({ size = 'sm' }) {
  const [erro, setErro] = useState(false);
  const sz         = size === 'lg' ? 'w-8 h-8' : size === 'md' ? 'w-6 h-6' : 'w-4 h-4';
  const szFallback = size === 'lg' ? 'w-8 h-8 text-sm' : size === 'md' ? 'w-6 h-6 text-[10px]' : 'w-4 h-4 text-[7px]';
  if (erro) {
    return (
      <div className={`${szFallback} rounded-full bg-gradient-to-br from-red-500 to-red-700 flex items-center justify-center flex-shrink-0 shadow-sm`}>
        <span className="text-white font-black">E</span>
      </div>
    );
  }
  return (
    <img src="/logo-estrategia.png" alt="Estratégia"
      className={`${sz} rounded object-contain flex-shrink-0`}
      onError={() => setErro(true)} />
  );
}

// ─── COMPONENTE DE DATA DE PUBLICAÇÃO ────────────────────────────────────────
function DataPublicacao({ dataRaw, dataFormatada, dataRelativa, className = '' }) {
  if (!dataRaw || !dataRelativa) return null;
  return (
    <span title={dataFormatada || dataRaw}
      className={`text-[9px] text-zinc-400 font-medium cursor-default select-none ${className}`}>
      {dataRelativa}
    </span>
  );
}

// ─── SKELETON ─────────────────────────────────────────────────────────────────
function Skeleton() {
  return (
    <div className="bg-white dark:bg-zinc-900 rounded-2xl overflow-hidden border border-zinc-100 dark:border-zinc-800 animate-pulse p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="h-5 w-24 bg-zinc-100 dark:bg-zinc-800 rounded-full" />
        <div className="h-3 w-12 bg-zinc-100 dark:bg-zinc-800 rounded-full" />
      </div>
      <div className="h-4 bg-zinc-100 dark:bg-zinc-800 rounded-full w-full" />
      <div className="h-4 bg-zinc-100 dark:bg-zinc-800 rounded-full w-4/5" />
      <div className="space-y-2 pt-2 border-t border-zinc-50 dark:border-zinc-800">
        <div className="h-3 bg-zinc-100 dark:bg-zinc-800 rounded-full w-3/5" />
        <div className="h-3 bg-zinc-100 dark:bg-zinc-800 rounded-full w-2/5" />
      </div>
    </div>
  );
}

function NoticiasLoadingState() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} />)}
      </div>
    </div>
  );
}

// ─── MINI TABELA DE DADOS ─────────────────────────────────────────────────────
function MiniTabelaDados({
  dados,
  corSalario   = 'text-red-600 dark:text-red-400',
  showSituacao = false,
  showADefinir = false,
}) {
  if (!dados) {
    if (!showADefinir) return null;
  }

  const d         = dados || {};
  const situacao  = sanitizarValorCampo(d.situacao,  'situacao');
  const banca     = sanitizarValorCampo(d.banca,     'banca');
  const inscricao = sanitizarValorCampo(d.inscricao, 'inscricao');
  const prova     = sanitizarValorCampo(d.prova,     'prova');
  const vagas     = sanitizarValorCampo(d.vagas,     'vagas');
  const salario   = sanitizarValorCampo(d.salario,   'salario');

  const def = (v) => (showADefinir && !v) ? 'A definir' : v;

  const campos = [
    showSituacao && (situacao || showADefinir) && {
      icon: BadgeCheck, label: 'Situação',   valor: def(situacao),  cor: 'text-blue-500 dark:text-blue-400',
    },
    (banca || showADefinir)     && { icon: Building2,    label: 'Banca',      valor: def(banca),     cor: 'text-zinc-400' },
    (inscricao || showADefinir) && { icon: Calendar,     label: 'Inscrições', valor: def(inscricao), cor: 'text-violet-400' },
    (prova || showADefinir)     && { icon: CalendarDays, label: 'Prova',      valor: def(prova),     cor: 'text-orange-400' },
    (vagas || showADefinir)     && { icon: Users,        label: 'Vagas',      valor: def(vagas),     cor: 'text-zinc-400' },
    (salario || showADefinir)   && { icon: Wallet,       label: 'Salário',    valor: def(salario),   cor: corSalario, destaque: true },
  ].filter(Boolean);

  if (!campos.length) return null;

  return (
    <div className="flex flex-col flex-1 divide-y divide-zinc-50 dark:divide-zinc-800/80">
      {campos.map((f, fi) => (
        <div key={fi} className="flex items-center gap-2 px-3 py-1.5 min-w-0">
          <f.icon size={11} className={`${f.cor} flex-shrink-0`} />
          <span className="text-[10px] text-zinc-400 font-semibold w-[52px] flex-shrink-0">{f.label}</span>
          <span className={`text-[11px] leading-tight truncate min-w-0 flex-1 ${
            f.destaque
              ? `${corSalario} font-black`
              : f.valor === 'A definir'
                ? 'text-zinc-300 dark:text-zinc-600 font-medium italic'
                : 'text-zinc-700 dark:text-zinc-300 font-medium'
          }`}>
            {f.valor}
          </span>
        </div>
      ))}
    </div>
  );
}

// ─── CARD CONCURSO ABERTO ─────────────────────────────────────────────────────
function ConcursoAbertoCard({ noticia, index, onClick }) {
  return (
    <motion.article
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, delay: Math.min(index * 0.025, 0.3) }}
      whileHover={{ y: -2, scale: 1.01 }}
      onClick={() => onClick(noticia)}
      className="group flex flex-col bg-white dark:bg-zinc-900 rounded-2xl overflow-hidden border border-zinc-100 dark:border-zinc-800 hover:border-red-200 dark:hover:border-red-900/50 hover:shadow-xl hover:shadow-red-600/5 transition-all duration-250 cursor-pointer"
    >
      <div className="px-4 pt-4 pb-3 border-b border-zinc-50 dark:border-zinc-800/60">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[9px] font-black text-green-600 dark:text-green-400 uppercase tracking-widest border border-green-200 dark:border-green-800 px-2 py-0.5 rounded-full bg-green-50 dark:bg-green-900/20">
            Aberto
          </span>
        </div>
        <h3 className="font-black text-sm text-zinc-900 dark:text-white leading-snug line-clamp-2 group-hover:text-red-600 dark:group-hover:text-red-400 transition-colors">
          {noticia.titulo}
        </h3>
      </div>
      <MiniTabelaDados dados={noticia._dados} corSalario="text-red-600 dark:text-red-400" />
      <div className="flex items-center justify-between px-3 py-2 border-t border-zinc-50 dark:border-zinc-800 mt-auto">
        <div className="flex items-center gap-1.5">
          <LogoComFallback />
          <span className="text-[9px] text-zinc-400">Estratégia Concursos</span>
        </div>
        <span className="text-[9px] text-red-600 dark:text-red-400 font-black flex items-center gap-0.5 group-hover:gap-1.5 transition-all">
          Ver edital <ChevronRight size={9} />
        </span>
      </div>
    </motion.article>
  );
}

// ─── CARD REGIÃO ──────────────────────────────────────────────────────────────
function RegiaoCard({ noticia, index, onClick, regiao }) {
  return (
    <motion.article
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, delay: Math.min(index * 0.02, 0.3) }}
      whileHover={{ y: -2, scale: 1.01 }}
      onClick={() => onClick(noticia)}
      className="group flex flex-col bg-white dark:bg-zinc-900 rounded-2xl overflow-hidden border border-zinc-100 dark:border-zinc-800 hover:border-red-200 dark:hover:border-red-900/50 hover:shadow-xl transition-all duration-250 cursor-pointer"
    >
      <div className="px-4 pt-4 pb-3 border-b border-zinc-50 dark:border-zinc-800/60">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[9px] font-black uppercase tracking-widest border px-2 py-0.5 rounded-full text-white"
            style={{ background: regiao.banner.bg, borderColor: 'transparent' }}>
            {regiao.label}
          </span>
        </div>
        <h3 className="font-black text-sm text-zinc-900 dark:text-white leading-snug line-clamp-2 group-hover:text-red-600 dark:group-hover:text-red-400 transition-colors">
          {noticia.titulo}
        </h3>
      </div>
      <MiniTabelaDados dados={noticia._dados} corSalario="text-red-600 dark:text-red-400" showSituacao showADefinir />
      <div className="flex items-center justify-between px-3 py-2 border-t border-zinc-50 dark:border-zinc-800 mt-auto">
        <div className="flex items-center gap-1.5">
          <LogoComFallback />
          <span className="text-[9px] text-zinc-400">Estratégia Concursos</span>
        </div>
        <ChevronRight size={9} className="text-zinc-400 group-hover:text-red-500 transition-colors" />
      </div>
    </motion.article>
  );
}

// ─── CARD NOTÍCIA SIMPLES ─────────────────────────────────────────────────────
function NoticiaCardLegado({ noticia, index, onClick }) {
  const ia     = noticia.ia;
  const titulo = ia?.titulo_limpo || noticia.titulo;
  const resumo = ia?.destaque || ia?.resumo_limpo || noticia.resumo;
  const status = ia?.status || '';
  const isEstado = noticia._tipo === 'estado';
  const temDados = noticia._dados && (noticia._dados.banca || noticia._dados.vagas || noticia._dados.salario || noticia._dados.inscricao || noticia._dados.prova || noticia._dados.situacao);
  const campos = !temDados && !isEstado ? [
    ia?.banca          && { icon: Building2,    label: 'Banca',   valor: ia.banca,            cor: 'text-zinc-400' },
    ia?.quadro?.prova  && { icon: CalendarDays, label: 'Prova',   valor: ia.quadro.prova,     cor: 'text-orange-400' },
    ia?.vagas          && { icon: Users,        label: 'Vagas',   valor: ia.vagas,             cor: 'text-zinc-400' },
    ia?.salario_maximo && { icon: Wallet,       label: 'Salário', valor: ia.salario_maximo,   cor: 'text-red-500', destaque: true },
  ].filter(Boolean) : [];

  return (
    <motion.article
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, delay: Math.min(index * 0.03, 0.3) }}
      whileHover={{ y: -2, scale: 1.01 }}
      onClick={() => onClick(noticia)}
      className="group flex flex-col bg-white dark:bg-zinc-900 rounded-2xl overflow-hidden border border-zinc-100 dark:border-zinc-800 hover:border-red-200 dark:hover:border-red-900/40 hover:shadow-xl hover:shadow-red-600/5 transition-all duration-300 cursor-pointer"
    >
      <div className="flex items-center justify-between px-4 pt-4 pb-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`${noticia.categoria?.cor || 'bg-zinc-500'} text-white text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full`}>
            {noticia.categoria?.label || 'Notícia'}
          </span>
          {status && <StatusBadge status={status} />}
        </div>
        <DataPublicacao dataRaw={noticia.dataRaw} dataFormatada={noticia.dataFormatada} dataRelativa={noticia.dataRelativa} />
      </div>
      <div className="flex flex-col flex-1 px-4 pt-3 pb-3 gap-2">
        <h3 className="font-black text-sm text-zinc-900 dark:text-white leading-snug group-hover:text-red-600 dark:group-hover:text-red-400 transition-colors line-clamp-3">
          {titulo}
        </h3>
        {(temDados || isEstado) && (
          <MiniTabelaDados
            dados={noticia._dados}
            corSalario="text-red-600 dark:text-red-400"
            showSituacao={isEstado}
            showADefinir={isEstado}
          />
        )}
        {!temDados && !isEstado && campos.length > 0 && (
          <div className="space-y-1.5 border-t border-zinc-50 dark:border-zinc-800/60 pt-2.5 mt-1">
            {campos.map((f, fi) => (
              <div key={fi} className="flex items-center gap-2 min-w-0">
                <f.icon size={11} className={`${f.cor} flex-shrink-0`} />
                <span className="text-[9px] text-zinc-400 font-semibold w-[50px] flex-shrink-0">{f.label}</span>
                <span className={`text-[11px] leading-tight truncate flex-1 min-w-0 ${f.destaque ? 'text-red-600 dark:text-red-400 font-black' : 'text-zinc-700 dark:text-zinc-300 font-medium'}`}>
                  {f.valor}
                </span>
              </div>
            ))}
          </div>
        )}
        {!temDados && !isEstado && campos.length === 0 && resumo && (
          <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed line-clamp-2">{resumo}</p>
        )}
        <div className="flex items-center justify-between mt-auto pt-2 border-t border-zinc-50 dark:border-zinc-800">
          <div className="flex items-center gap-1.5">
            <LogoComFallback />
            <span className="text-[9px] text-zinc-400">Estratégia Concursos</span>
          </div>
          <span className="text-[9px] text-red-500 dark:text-red-400 font-bold flex items-center gap-0.5 group-hover:gap-1.5 transition-all">
            Ler <ChevronRight size={9} />
          </span>
        </div>
      </div>
    </motion.article>
  );
}

// ─── CARD DESTAQUE ────────────────────────────────────────────────────────────
function NoticiaDestaque({ noticia, onClick }) {
  if (!noticia) return null;
  const ia     = noticia.ia;
  const titulo = ia?.titulo_limpo || noticia.titulo;
  const status = ia?.status || '';
  const banca  = ia?.banca  || '';
  const vagas  = ia?.vagas  || '';
  const salario = ia?.salario_maximo || '';
  return (
    <motion.article
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -2 }}
      onClick={() => onClick(noticia)}
      className="group mb-5 bg-white dark:bg-zinc-900 rounded-2xl overflow-hidden border border-zinc-100 dark:border-zinc-800 hover:border-red-200 dark:hover:border-red-900/40 hover:shadow-2xl hover:shadow-red-600/8 transition-all duration-300 cursor-pointer"
    >
      <div className="relative overflow-hidden bg-gradient-to-br from-red-600 to-red-800 px-6 py-5">
        <div className="absolute inset-0 opacity-20"
          style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg width='20' height='20' viewBox='0 0 20 20' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='white' fill-opacity='0.4'%3E%3Ccircle cx='3' cy='3' r='1'/%3E%3C/g%3E%3C/svg%3E\")" }} />
        <div className="relative flex items-start gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-[9px] bg-white/20 text-white font-black px-2 py-0.5 rounded-full uppercase tracking-wider">
                {noticia.categoria?.label || 'Destaque'}
              </span>
              {status && <StatusBadge status={status} />}
            </div>
            <h2 className="text-white font-black text-base sm:text-lg leading-snug line-clamp-3 group-hover:text-red-100 transition-colors">
              {titulo}
            </h2>
          </div>
          <div className="flex-shrink-0 w-10 h-10 rounded-2xl bg-white/15 flex items-center justify-center">
            <TrendingUp size={18} className="text-white" />
          </div>
        </div>
        {(banca || vagas || salario) && (
          <div className="relative mt-4 flex flex-wrap gap-3">
            {banca   && <span className="text-[10px] bg-white/15 text-white px-2 py-1 rounded-lg font-semibold">{banca}</span>}
            {vagas   && <span className="text-[10px] bg-white/15 text-white px-2 py-1 rounded-lg font-semibold">{vagas} vagas</span>}
            {salario && <span className="text-[10px] bg-white/25 text-white px-2 py-1 rounded-lg font-black">{salario}</span>}
          </div>
        )}
      </div>
      <div className="flex items-center justify-between px-4 py-3 border-t border-zinc-50 dark:border-zinc-800">
        <div className="flex items-center gap-1.5">
          <LogoComFallback />
          <span className="text-[9px] text-zinc-400">Estratégia Concursos</span>
          {noticia.dataRelativa && <span className="text-[9px] text-zinc-400">· {noticia.dataRelativa}</span>}
        </div>
        <span className="text-[9px] text-red-500 dark:text-red-400 font-black flex items-center gap-0.5 group-hover:gap-1.5 transition-all">
          Ler artigo <ChevronRight size={9} />
        </span>
      </div>
    </motion.article>
  );
}

// ─── ERRO ─────────────────────────────────────────────────────────────────────
function ErroState({ onRetry }) {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
      className="flex flex-col items-center justify-center py-20 px-6 text-center">
      <div className="w-20 h-20 rounded-3xl bg-red-50 dark:bg-red-900/20 flex items-center justify-center mb-6">
        <WifiOff size={36} className="text-red-400" />
      </div>
      <h3 className="text-xl font-black text-zinc-800 dark:text-white mb-2">Falha ao carregar</h3>
      <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-6 max-w-sm leading-relaxed">
        Não foi possível conectar. Verifique sua conexão e tente novamente.
      </p>
      <button onClick={onRetry}
        className="flex items-center gap-2 px-6 py-3 bg-red-600 text-white rounded-2xl font-bold hover:bg-red-700 active:scale-95 transition-all shadow-lg shadow-red-600/30">
        <RefreshCw size={16} /> Tentar novamente
      </button>
    </motion.div>
  );
}

// ─── MODAL DE PESQUISA ────────────────────────────────────────────────────────
function ModalPesquisa({ onClose, onAbrirArtigo }) {
  const [busca, setBusca]           = useState('');
  const [resultados, setResultados] = useState([]);
  const inputRef = useRef(null);
  const timerRef = useRef(null);
  useEffect(() => { setTimeout(() => inputRef.current?.focus(), 80); }, []);
  useEffect(() => {
    clearTimeout(timerRef.current);
    if (!busca.trim() || busca.length < 2) { setResultados([]); return; }
    timerRef.current = setTimeout(() => {
      const encontrados = [];
      const q = busca.toLowerCase();
      for (const [, lista] of listaCache) {
        for (const n of lista) {
          const t = (n.ia?.titulo_limpo || n.titulo || '').toLowerCase();
          const r = (n.ia?.resumo_limpo || n.resumo || '').toLowerCase();
          if (t.includes(q) || r.includes(q)) encontrados.push(n);
        }
      }
      setResultados(encontrados.slice(0, 12));
    }, 280);
  }, [busca]);
  const handleSelect = (n) => { onAbrirArtigo(n); onClose(); };
  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-start justify-center pt-16 px-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <motion.div
        initial={{ opacity: 0, y: -20, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -10, scale: 0.97 }}
        className="relative w-full max-w-lg bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl border border-zinc-100 dark:border-zinc-800 overflow-hidden"
      >
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-zinc-100 dark:border-zinc-800">
          <Search size={16} className="text-red-500 flex-shrink-0" />
          <input
            ref={inputRef}
            value={busca}
            onChange={e => setBusca(e.target.value)}
            placeholder="Buscar concursos, editais, órgãos..."
            className="flex-1 bg-transparent text-sm text-zinc-800 dark:text-white placeholder-zinc-400 outline-none"
          />
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-400 hover:text-zinc-600 transition-colors">
            <X size={16} />
          </button>
        </div>
        <div className="max-h-80 overflow-y-auto">
          {busca.length < 2 && (
            <div className="px-4 py-6 text-center">
              <p className="text-xs text-zinc-400">Digite ao menos 2 caracteres para pesquisar</p>
            </div>
          )}
          {busca.length >= 2 && resultados.length === 0 && (
            <div className="px-4 py-6 text-center">
              <p className="text-xs text-zinc-400">Nenhum resultado para "{busca}"</p>
            </div>
          )}
          {resultados.length > 0 && (
            <div className="divide-y divide-zinc-50 dark:divide-zinc-800">
              {resultados.map((n, i) => {
                const t = n.ia?.titulo_limpo || n.titulo;
                const r = n.ia?.destaque || n.ia?.resumo_limpo || n.resumo;
                return (
                  <motion.button key={i} onClick={() => handleSelect(n)}
                    initial={{ opacity: 0, x: -4 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.03 }}
                    className="w-full text-left flex items-start gap-3 px-4 py-3 hover:bg-red-50 dark:hover:bg-red-900/10 transition-colors">
                    <span className={`${n.categoria?.cor || 'bg-zinc-500'} text-white text-[8px] font-black px-1.5 py-0.5 rounded-full mt-0.5 flex-shrink-0 uppercase whitespace-nowrap`}>
                      {n.categoria?.label || 'Notícia'}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-zinc-800 dark:text-white line-clamp-1">{t}</p>
                      {r && <p className="text-[10px] text-zinc-400 line-clamp-1 mt-0.5">{r}</p>}
                    </div>
                    <ChevronRight size={12} className="text-red-400 flex-shrink-0 mt-0.5" />
                  </motion.button>
                );
              })}
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}

// ─── DROPDOWN ESTADOS ─────────────────────────────────────────────────────────
function DropdownEstados({ estadoFiltro, mudarEstado, onClose }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 4, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 4, scale: 0.97 }}
      transition={{ duration: 0.15 }}
      className="absolute top-full left-0 mt-2 z-[200] w-72 bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl border border-zinc-100 dark:border-zinc-800 overflow-hidden"
      style={{ position: 'absolute', top: '100%', left: 0, marginTop: '8px', zIndex: 200 }}
    >
      <div className="overflow-y-auto p-1.5" style={{ maxHeight: '360px' }}>
        <button
          onClick={() => { mudarEstado(null); onClose(); }}
          className={`w-full text-left px-4 py-3 text-sm font-semibold transition-all flex items-center justify-between rounded-xl
            ${!estadoFiltro
              ? 'bg-red-50 dark:bg-red-900/25 text-red-600 dark:text-red-400 border border-red-100 dark:border-red-900/30'
              : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800/60'
            }`}
        >
          <span className="flex items-center gap-2">
            <Globe size={14} className={estadoFiltro ? 'text-zinc-400' : 'text-red-500'} />
            Todos os estados
          </span>
          {!estadoFiltro && <div className="w-2.5 h-2.5 rounded-full bg-red-500 shadow-sm" />}
        </button>
        <div className="h-px bg-zinc-100 dark:bg-zinc-800 my-1.5" />
        {ESTADOS_LISTA.map(estado => (
          <button
            key={estado.uf}
            onClick={() => { mudarEstado(estado.uf); onClose(); }}
            className={`w-full text-left px-4 py-2.5 text-sm transition-all flex items-center justify-between gap-3 rounded-xl mt-0.5
              ${estadoFiltro?.uf === estado.uf
                ? 'bg-red-50 dark:bg-red-900/25 text-red-600 dark:text-red-400 font-bold border border-red-100 dark:border-red-900/30'
                : 'text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800/60'
              }`}
          >
            <span className="flex-1 truncate">{estado.nome}</span>
            <span className={`text-[11px] font-black flex-shrink-0 px-2.5 py-1 rounded-lg min-w-[32px] text-center transition-all
              ${estadoFiltro?.uf === estado.uf
                ? 'bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-300 shadow-sm'
                : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400'
              }`}>
              {estado.uf}
            </span>
          </button>
        ))}
      </div>
    </motion.div>
  );
}

// ─── HEADER ───────────────────────────────────────────────────────────────────
function Header({
  regiaoAtiva, estadoFiltro, loading,
  loadingRegiao, catAtiva,
  mudarCategoria, mudarRegiao, setRegiaoAtiva, mudarEstado, setEstadoFiltro,
  onAbrirArtigo,
}) {
  const [pesquisaAberta, setPesquisaAberta]             = useState(false);
  const [estadoDropdownAberto, setEstadoDropdownAberto] = useState(false);
  const estadoDropRef = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if (estadoDropRef.current && !estadoDropRef.current.contains(e.target))
        setEstadoDropdownAberto(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <>
      <AnimatePresence>
        {pesquisaAberta && (
          <ModalPesquisa onClose={() => setPesquisaAberta(false)} onAbrirArtigo={onAbrirArtigo} />
        )}
      </AnimatePresence>

      <motion.div
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: 'easeOut' }}
        className="mb-6"
      >
        {/* TITULO SOLTO */}
        <div className="flex items-start justify-between gap-4 mb-5">
          <div>
            <motion.div
              animate={{ opacity: [1, 0.35, 1] }}
              transition={{ repeat: Infinity, duration: 2.2 }}
              className="flex items-center gap-1.5 mb-2"
            >
              <div className="w-1.5 h-1.5 rounded-full bg-green-500 dark:bg-green-400" />
              <span className="text-[10px] font-bold uppercase tracking-[.12em] text-green-600 dark:text-green-400">
                Ao vivo
              </span>
            </motion.div>
            <p className="text-[10px] font-semibold uppercase tracking-[.1em] text-zinc-400 dark:text-zinc-500 mb-1">
              Portal de concursos públicos
            </p>
            <h1 className="text-[28px] sm:text-[32px] font-black leading-none tracking-tight text-zinc-900 dark:text-white">
              Notícias{" "}
              <span className="text-red-600 dark:text-red-500">Concursos</span>
            </h1>
            <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-1.5">
              Editais e informações em tempo real
            </p>
          </div>
          <button
            onClick={() => setPesquisaAberta(true)}
            className="flex-shrink-0 flex items-center gap-2 bg-red-600 hover:bg-red-700 active:scale-95 text-white rounded-xl px-4 py-2.5 text-xs font-bold transition-all duration-150 shadow-sm shadow-red-600/20 mt-1"
          >
            <Search size={13} />
            <span className="hidden sm:inline">Pesquisar</span>
          </button>
        </div>

        {/* DIVISOR */}
        <div className="h-px bg-zinc-100 dark:bg-zinc-800 mb-4" />

        {/* REGIAO + ESTADO */}
        <div className="flex items-center gap-2 flex-wrap mb-2.5">
          <span className="text-[10px] font-bold uppercase tracking-[.1em] text-zinc-400 dark:text-zinc-500 mr-1 flex-shrink-0">
            Região
          </span>
          {REGIOES.map((reg) => {
            const ativa = regiaoAtiva?.id === reg.id;
            return (
              <button
                key={reg.id}
                onClick={() => mudarRegiao(reg)}
                className={`flex-shrink-0 flex items-center gap-1 px-3 py-1.5 rounded-full text-[11px] font-semibold transition-all duration-150 whitespace-nowrap border ${
                  ativa
                    ? "bg-red-600 border-red-600 text-white shadow-sm"
                    : "bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:border-zinc-300 dark:hover:border-zinc-600 hover:text-zinc-800 dark:hover:text-zinc-200"
                }`}
              >
                {reg.label}
                {ativa && (
                  <span
                    onClick={(e) => { e.stopPropagation(); setRegiaoAtiva(null); }}
                    className="ml-0.5 opacity-70 hover:opacity-100 cursor-pointer"
                  >
                    <X size={9} />
                  </span>
                )}
              </button>
            );
          })}
          <div className="h-4 w-px bg-zinc-200 dark:bg-zinc-700 mx-1 flex-shrink-0" />
          <div ref={estadoDropRef} className="relative flex-shrink-0">
            <button
              onClick={() => setEstadoDropdownAberto(v => !v)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-semibold border transition-all duration-150 whitespace-nowrap ${
                estadoFiltro
                  ? "bg-red-600 border-red-600 text-white shadow-sm"
                  : "bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:border-zinc-300 dark:hover:border-zinc-600 hover:text-zinc-800 dark:hover:text-zinc-200"
              }`}
            >
              <MapPin size={11} />
              <span>{estadoFiltro ? estadoFiltro.nome : "Estado"}</span>
              {estadoFiltro ? (
                <span
                  onClick={(e) => { e.stopPropagation(); setEstadoFiltro(null); }}
                  className="ml-0.5 opacity-70 hover:opacity-100 cursor-pointer"
                >
                  <X size={9} />
                </span>
              ) : (
                <ChevronDown size={10} className={`transition-transform duration-150 ${estadoDropdownAberto ? "rotate-180" : ""}`} />
              )}
            </button>
            <AnimatePresence>
              {estadoDropdownAberto && (
                <DropdownEstados
                  estadoFiltro={estadoFiltro}
                  mudarEstado={(uf) => {
                    if (!uf) { setEstadoFiltro(null); return; }
                    const estadoObj = ESTADOS_LISTA.find(e => e.uf === uf);
                    if (estadoObj) {
                      window.scrollTo({ top: 0, behavior: "instant" });
                      setRegiaoAtiva(null);
                      setEstadoFiltro(estadoObj);
                    }
                  }}
                  onClose={() => setEstadoDropdownAberto(false)}
                />
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* CATEGORIAS */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[10px] font-bold uppercase tracking-[.1em] text-zinc-400 dark:text-zinc-500 mr-1 flex-shrink-0">
            Categoria
          </span>
          <div className="flex gap-1.5 overflow-x-auto scrollbar-none flex-1 min-w-0">
            {CATEGORIAS.map((cat) => {
              const ativa = catAtiva.id === cat.id;
              return (
                <button
                  key={cat.id}
                  onClick={() => mudarCategoria(cat)}
                  className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-semibold transition-all duration-150 whitespace-nowrap border ${
                    ativa
                      ? "bg-red-600 border-red-600 text-white shadow-sm"
                      : "bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:border-zinc-300 dark:hover:border-zinc-600 hover:text-zinc-800 dark:hover:text-zinc-200"
                  }`}
                >
                  {ativa && <div className="w-1 h-1 rounded-full bg-white/70 flex-shrink-0" />}
                  {cat.label}
                </button>
              );
            })}
          </div>
        </div>
      </motion.div>
    </>
  );
}
// ─── PÁGINA PRINCIPAL ─────────────────────────────────────────────────────────
export default function NoticiasPage() {
  const {
    noticias, loading, erro, catAtiva, atualizado, artigoAberto,
    regiaoAtiva, noticiasRegiao, loadingRegiao, erroRegiao,
    estadoFiltro, noticiasEstado, loadingEstado, erroEstado,
    setArtigoAberto, setRegiaoAtiva, setEstadoFiltro, setNoticiasEstado,
    carregar, carregarEstado, mudarCategoria, mudarRegiao, mudarEstado,
    handleAbrirPorUrl, handleAbrirNoticia,
  } = useNoticias(CATEGORIAS, CATS_RSS);

  useEffect(() => { carregar(catAtiva); }, [catAtiva, carregar]);
  useEffect(() => {
    if (estadoFiltro) carregarEstado(estadoFiltro);
    else setNoticiasEstado([]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [estadoFiltro]);

  const agruparPorArea = (arr) => {
    const secoes = []; const mapa = new Map();
    for (const n of arr) {
      const area = n._area || 'Geral';
      if (!mapa.has(area)) { const s = { area, itens: [] }; mapa.set(area, s); secoes.push(s); }
      mapa.get(area).itens.push(n);
    }
    return secoes;
  };

  const ehConcursosAbertos = catAtiva.tipo === 'pagina' && !regiaoAtiva && !estadoFiltro;
  const noticiasPadrao     = noticias;
  const destaque           = !ehConcursosAbertos && !regiaoAtiva && !estadoFiltro && noticiasPadrao.length > 0 ? noticiasPadrao[0] : null;
  const lista              = !ehConcursosAbertos && !regiaoAtiva && !estadoFiltro && noticiasPadrao.length > 0 ? noticiasPadrao.slice(1) : [];
  const showAtualizando = (loading && noticias.length > 0)
    || (loadingRegiao && noticiasRegiao.length > 0)
    || (loadingEstado && noticiasEstado.length > 0);

  if (artigoAberto) {
    return (
      <AnimatePresence mode="wait">
        <NoticiaDetalhe
          key={artigoAberto.id}
          noticia={artigoAberto}
          onVoltar={() => { setArtigoAberto(null); window.scrollTo({ top: 0, behavior: 'instant' }); }}
          onAbrirArtigo={handleAbrirPorUrl}
        />
      </AnimatePresence>
    );
  }

  return (
    <div className="min-h-screen pb-16">
      <Header
        regiaoAtiva={regiaoAtiva}
        estadoFiltro={estadoFiltro}
        loading={loading}
        loadingRegiao={loadingRegiao}
        catAtiva={catAtiva}
        mudarCategoria={mudarCategoria}
        mudarRegiao={mudarRegiao}
        setRegiaoAtiva={setRegiaoAtiva}
        mudarEstado={mudarEstado}
        setEstadoFiltro={setEstadoFiltro}
        onAbrirArtigo={handleAbrirNoticia}
      />

      {showAtualizando && (
        <div className="mb-4 flex justify-end">
          <span className="inline-flex items-center gap-2 rounded-full border border-red-100 bg-red-50 px-3 py-1 text-[10px] font-black uppercase tracking-wider text-red-700 dark:border-red-900/40 dark:bg-red-950/20 dark:text-red-300">
            <RefreshCw size={12} className="animate-spin" />
            Atualizando
          </span>
        </div>
      )}

      {/* ══ VISTA ESTADO ══ */}
      {estadoFiltro && (
        <>
          {loadingEstado && noticiasEstado.length === 0 && <NoticiasLoadingState />}
          {!loadingEstado && noticiasEstado.length === 0 && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              className="flex flex-col items-center py-16 text-center px-4">
              <BookOpen size={48} className="text-zinc-300 dark:text-zinc-600 mb-4" />
              <p className="text-zinc-500 dark:text-zinc-400 font-medium mb-3">
                Nenhuma notícia encontrada para {estadoFiltro.nome} no momento.
              </p>
              <p className="text-xs text-zinc-400 mb-5 max-w-sm">
                O site do Estratégia pode não ter conteúdo específico para este estado ou o conteúdo pode estar em outra seção.
              </p>
              <a
                href={`${BASE}/concursos-${ESTADOS_SLUGS[estadoFiltro.uf] || estadoFiltro.slug}/`}
                target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-2 px-5 py-2.5 bg-red-600 text-white rounded-xl text-xs font-black hover:bg-red-700 active:scale-95 transition-all shadow-lg shadow-red-600/30"
              >
                Ver página no Estratégia <ExternalLink size={12} />
              </a>
            </motion.div>
          )}
          {!loadingEstado && noticiasEstado.length > 0 && (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
              <div className="rounded-2xl overflow-hidden border border-red-100 dark:border-red-900/30 bg-gradient-to-r from-red-600 to-red-800 px-5 py-4 flex items-center justify-between">
                <div>
                  <p className="text-white/60 text-[10px] font-bold uppercase tracking-widest mb-0.5">Concursos por Estado</p>
                  <p className="text-white text-xl font-black">{estadoFiltro.nome}</p>
                  <p className="text-white/50 text-[10px] mt-0.5">{estadoFiltro.uf}</p>
                </div>
                <div className="text-right">
                  <p className="text-white text-2xl font-black">{noticiasEstado.length}</p>
                  <p className="text-white/60 text-[10px] font-bold">notícias</p>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {noticiasEstado.map((n, i) => (
                  <NoticiaCardLegado key={n.id} noticia={n} index={i} onClick={setArtigoAberto} />
                ))}
              </div>
              <div className="p-4 rounded-2xl border border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <LogoComFallback />
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">Estratégia Concursos · {estadoFiltro.nome}</p>
                </div>
                <a
                  href={`${BASE}/concursos-${ESTADOS_SLUGS[estadoFiltro.uf] || estadoFiltro.slug}/`}
                  target="_blank" rel="noopener noreferrer"
                  className="flex-shrink-0 flex items-center gap-1.5 text-xs font-bold text-red-600 hover:underline"
                >
                  Ver página completa <ExternalLink size={11} />
                </a>
              </div>
            </motion.div>
          )}
        </>
      )}

      {/* ══ VISTA REGIÃO ══ */}
      {regiaoAtiva && !estadoFiltro && (
        <>
          {loadingRegiao && noticiasRegiao.length === 0 && <NoticiasLoadingState />}
          {!loadingRegiao && noticiasRegiao.length === 0 && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center py-20 text-center">
              <BookOpen size={48} className="text-zinc-300 dark:text-zinc-600 mb-4" />
              <p className="text-zinc-500 font-medium">Nenhum concurso encontrado nesta região no momento.</p>
            </motion.div>
          )}
          {!loadingRegiao && noticiasRegiao.length > 0 && (() => {
            const secoes = agruparPorArea(noticiasRegiao);
            return (
              <motion.div key={regiaoAtiva.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-10">
                <div className="relative rounded-2xl overflow-hidden h-24 sm:h-28 flex items-center px-5 sm:px-7"
                  style={{ background: regiaoAtiva.banner.bg }}>
                  {(() => {
                    const pid = `rbanner_${regiaoAtiva.id}`;
                    const enc = encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="800" height="112"><defs>${getSvgPattern(regiaoAtiva.banner.pattern, pid)}</defs><rect width="100%" height="100%" fill="url(#${pid})"/></svg>`);
                    return <img src={`data:image/svg+xml,${enc}`} alt="" className="absolute inset-0 w-full h-full object-cover pointer-events-none opacity-70" />;
                  })()}
                  <div className="relative z-10 flex items-center justify-between w-full gap-4">
                    <div>
                      <p className="text-white/70 text-[10px] font-bold uppercase tracking-widest mb-0.5">Concursos por Região</p>
                      <p className="text-white text-xl sm:text-2xl font-black leading-tight" style={{ textShadow: '0 2px 10px rgba(0,0,0,0.3)' }}>
                        Região {regiaoAtiva.label}
                      </p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-white text-lg font-black">{noticiasRegiao.length}</p>
                      <p className="text-white/70 text-[10px] font-bold">concursos</p>
                    </div>
                  </div>
                </div>
                {secoes.map((secao, si) => (
                  <div key={si}>
                    <div className="flex items-center gap-3 mb-4">
                      <div className="h-px flex-1 bg-zinc-200 dark:bg-zinc-700" />
                      <span className="flex items-center gap-2 px-4 py-1.5 rounded-full text-white text-[11px] font-black uppercase tracking-wider whitespace-nowrap shadow-sm"
                        style={{ background: regiaoAtiva.banner.bg }}>
                        <Filter size={10} /> {secao.area}
                        <span className="bg-white/25 text-[9px] font-black px-1.5 py-0.5 rounded-full">{secao.itens.length}</span>
                      </span>
                      <div className="h-px flex-1 bg-zinc-200 dark:bg-zinc-700" />
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                      {secao.itens.map((n, i) => (
                        <RegiaoCard key={n.id} noticia={n} index={i} onClick={setArtigoAberto} regiao={regiaoAtiva} />
                      ))}
                    </div>
                  </div>
                ))}
                <div className="p-4 rounded-2xl border border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <LogoComFallback />
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">Estratégia Concursos · Região {regiaoAtiva.label}</p>
                  </div>
                  <a href={regiaoAtiva.url} target="_blank" rel="noopener noreferrer"
                    className="flex-shrink-0 flex items-center gap-1.5 text-xs font-bold text-red-600 hover:underline">
                    Ver página completa <ExternalLink size={11} />
                  </a>
                </div>
              </motion.div>
            );
          })()}
        </>
      )}

      {/* ══ VISTA NORMAL ══ */}
      {!regiaoAtiva && !estadoFiltro && (
        <>
          {erro && !loading && <ErroState onRetry={() => { listaCache.delete(catAtiva.id); carregar(catAtiva); }} />}
          {!erro && loading && noticias.length === 0 && <NoticiasLoadingState />}
          {!erro && !loading && noticias.length === 0 && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center py-20 text-center">
              <BookOpen size={48} className="text-zinc-300 dark:text-zinc-600 mb-4" />
              <p className="text-zinc-500 font-medium">Nenhum resultado encontrado.</p>
            </motion.div>
          )}

          {!erro && !loading && ehConcursosAbertos && noticias.length > 0 && (() => {
            const secoes = agruparPorArea(noticias);
            return (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-10">
                {secoes.map((secao, si) => (
                  <div key={si}>
                    <div className="flex items-center gap-3 mb-4">
                      <div className="h-px flex-1 bg-zinc-200 dark:bg-zinc-700" />
                      <span className="flex items-center gap-2 px-4 py-1.5 rounded-full bg-red-600 text-white text-[11px] font-black uppercase tracking-wider whitespace-nowrap shadow-sm">
                        <Filter size={10} /> {secao.area}
                        <span className="bg-white/20 text-[9px] font-black px-1.5 py-0.5 rounded-full">{secao.itens.length}</span>
                      </span>
                      <div className="h-px flex-1 bg-zinc-200 dark:bg-zinc-700" />
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                      {secao.itens.map((n, i) => (
                        <ConcursoAbertoCard key={n.id} noticia={n} index={i} onClick={setArtigoAberto} />
                      ))}
                    </div>
                  </div>
                ))}
                <div className="p-4 bg-red-50 dark:bg-red-900/10 border border-red-100 dark:border-red-900/30 rounded-2xl flex items-center justify-between gap-4">
                  <div className="flex items-center gap-2">
                    <LogoComFallback />
                    <p className="text-xs text-red-700 dark:text-red-400 font-medium">Lista atualizada diariamente pelo Estratégia Concursos</p>
                  </div>
                  <a href="https://www.estrategiaconcursos.com.br/blog/concursos-abertos/" target="_blank" rel="noopener noreferrer"
                    className="flex-shrink-0 flex items-center gap-1.5 text-xs text-red-700 dark:text-red-400 font-bold hover:underline">
                    Ver lista completa <ExternalLink size={11} />
                  </a>
                </div>
              </motion.div>
            );
          })()}

          {!erro && !loading && !ehConcursosAbertos && noticias.length > 0 && (
            <>
              {destaque && <NoticiaDestaque noticia={destaque} onClick={setArtigoAberto} />}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {lista.map((n, i) => (
                  <NoticiaCardLegado key={n.id} noticia={n} index={i} onClick={setArtigoAberto} />
                ))}
              </div>
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}
                className="mt-10 p-5 bg-zinc-50 dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-white dark:bg-zinc-800 border border-zinc-100 dark:border-zinc-700 flex items-center justify-center flex-shrink-0 overflow-hidden">
                    <LogoComFallback size="md" />
                  </div>
                  <div>
                    <p className="text-sm font-black text-zinc-800 dark:text-white">Estratégia Concursos</p>
                    <p className="text-xs text-zinc-500 mt-0.5">
                      Via <a href="https://www.estrategiaconcursos.com.br/blog" target="_blank" rel="noopener noreferrer"
                        className="text-red-600 hover:underline font-semibold">estrategiaconcursos.com.br</a>
                    </p>
                  </div>
                </div>
                <a href="https://www.estrategiaconcursos.com.br/blog/noticias" target="_blank" rel="noopener noreferrer"
                  className="flex-shrink-0 flex items-center gap-2 px-4 py-2.5 bg-red-600 text-white rounded-xl text-xs font-black uppercase tracking-wider hover:bg-red-700 active:scale-95 transition-all shadow-md shadow-red-600/30">
                  Ver site oficial <ExternalLink size={12} />
                </a>
              </motion.div>
            </>
          )}
        </>
      )}
    </div>
  );
}
