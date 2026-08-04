/**
 * Step1Edital.jsx — REDESIGN CINEMATOGRÁFICO v2
 */

import React, { useState, useMemo, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search, X, Library, CheckCircle2, Check, Layers, ArrowRight, ChevronDown,
  Briefcase, ShieldAlert, Globe, BadgeAlert, Lock, Flame, Siren, Target,
  Plus, MessageSquare, ChevronRight, ChevronLeft
} from 'lucide-react';
import { SkeletonCard } from '../ui/Skeleton';

const CATEGORIA_CONFIG = {
  pm:      { icon: ShieldAlert, bg: 'bg-zinc-100 dark:bg-zinc-800',         color: 'text-zinc-700 dark:text-zinc-300',       label: 'Polícia Militar' },
  pc:      { icon: BadgeAlert,  bg: 'bg-blue-50 dark:bg-blue-900/20',       color: 'text-blue-600 dark:text-blue-400',       label: 'Polícia Civil' },
  pp:      { icon: Lock,        bg: 'bg-zinc-100 dark:bg-zinc-800',         color: 'text-zinc-600 dark:text-zinc-400',       label: 'Polícia Penal' },
  cbm:     { icon: Flame,       bg: 'bg-red-50 dark:bg-red-900/20',         color: 'text-red-600 dark:text-red-400',         label: 'Corpo de Bombeiros' },
  gcm:     { icon: Siren,       bg: 'bg-sky-50 dark:bg-sky-900/20',         color: 'text-sky-500 dark:text-sky-400',         label: 'Guarda Municipal' },
  fa:      { icon: Target,      bg: 'bg-emerald-50 dark:bg-emerald-900/20', color: 'text-emerald-700 dark:text-emerald-400', label: 'Forças Armadas' },
  federal: { icon: Globe,       bg: 'bg-indigo-50 dark:bg-indigo-900/20',   color: 'text-indigo-600 dark:text-indigo-400',   label: 'Carreiras Federais' },
  adm:     { icon: Briefcase,   bg: 'bg-violet-50 dark:bg-violet-900/20',   color: 'text-violet-600 dark:text-violet-400',   label: 'Administrativos' },
};

// ─── COMPONENTE DE CARD ───────────────────────────────────────────────────────
const CardEdital = ({ dados, unico, idConfirmado, aoConfirmar }) => {
  const editalBase   = unico ? dados : dados[0];
  const variosCargos = !unico;
  const [menuAberto, setMenuAberto] = useState(false);

  const itemSelecionado = unico
    ? (idConfirmado === dados.id ? dados : null)
    : dados.find(d => d.id === idConfirmado);
  const estaSelecionado = !!itemSelecionado;
  const estaConfirmado = !!itemSelecionado && idConfirmado === itemSelecionado.id;

  const tituloExibicao = variosCargos
    ? (editalBase.instituicao || editalBase.titulo.split(' - ')[0])
    : editalBase.titulo;
  const cargoExibicao = variosCargos && itemSelecionado?.cargo ? itemSelecionado.cargo : '';
  const rawDescricaoExibicao = itemSelecionado?.descricao || editalBase.descricao || editalBase.subtitulo || '';
  const descricaoExibicao = (() => {
    const texto = String(rawDescricaoExibicao || '').trim();
    const cargo = String(itemSelecionado?.cargo || editalBase.cargo || '').trim().toLowerCase();
    const banca = String(itemSelecionado?.banca || editalBase.banca || '').trim().toLowerCase();
    if (!texto) return '';
    const normalizado = texto.toLowerCase();
    if (cargo && banca && normalizado === `${cargo} com ${banca}`) return '';
    return texto;
  })();

  const qtdDisc = itemSelecionado
    ? (itemSelecionado.disciplinas?.length || 0)
    : (editalBase.disciplinas?.length || 0);

  const handleClick = () => {
    if (variosCargos) { setMenuAberto(true); return; }
    aoConfirmar(dados);
  };

  return (
    <div className="pt-2 pb-4 px-1">
      <motion.div
        layout
        whileHover={{ y: -4, scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        className={`relative flex flex-col rounded-2xl border-2 overflow-hidden cursor-pointer transition-all duration-300 w-[154px] sm:w-[210px] shrink-0 group sm:rounded-[24px] ${
          estaSelecionado
            ? 'border-red-500 bg-white dark:bg-zinc-900 shadow-[0_12px_40px_rgba(220,38,38,0.15)] ring-4 ring-red-500/5'
            : 'border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:border-red-300 dark:hover:border-red-900 shadow-sm'
        }`}
        onClick={handleClick}
      >
        <div className={`h-[92px] flex items-center justify-center p-3 relative overflow-hidden sm:h-36 sm:p-5 ${
          estaSelecionado
            ? 'bg-gradient-to-br from-red-50 to-white dark:from-red-950/10 dark:to-zinc-900'
            : 'bg-zinc-50 dark:bg-zinc-800/50'
        }`}>
          <div className="absolute -bottom-6 -right-6 w-20 h-20 bg-zinc-200 dark:bg-zinc-700/30 rounded-full blur-2xl group-hover:bg-red-500/10 transition-colors" />

          {editalBase.logoUrl || editalBase.logo ? (
            <img src={editalBase.logoUrl || editalBase.logo} alt={tituloExibicao}
              draggable="false" className="h-full w-full object-contain relative z-10 transition-transform duration-500 group-hover:scale-110 select-none" />
          ) : (
            <div className="w-14 h-14 rounded-2xl bg-white dark:bg-zinc-800 flex items-center justify-center shadow-lg border border-zinc-100 dark:border-zinc-700 relative z-10">
              <Library size={24} className="text-zinc-400" />
            </div>
          )}
          
          {estaConfirmado && (
            <motion.div initial={{ scale: 0, rotate: -45 }} animate={{ scale: 1, rotate: 0 }}
              className="absolute top-2 left-2 w-5 h-5 bg-red-600 rounded-full flex items-center justify-center shadow-lg z-20 sm:top-3 sm:left-3 sm:h-6 sm:w-6">
              <CheckCircle2 size={12} className="text-white sm:h-[14px] sm:w-[14px]" strokeWidth={3} />
            </motion.div>
          )}
        </div>

        <div className="flex-1 p-2.5 flex flex-col gap-1.5 relative z-10 sm:p-4 sm:gap-2.5">
          <div className="min-h-[34px] sm:min-h-[36px]">
            <h4 className={`text-[10px] font-black leading-snug uppercase tracking-tight line-clamp-2 transition-colors sm:text-[12px] ${
              estaSelecionado ? 'text-red-600 dark:text-red-400' : 'text-zinc-900 dark:text-white'
            }`}>{tituloExibicao}</h4>
          </div>

          {cargoExibicao && (
          <div className="flex items-center gap-1.5">
             <div className="w-1 h-3 rounded-full bg-red-300 dark:bg-red-800" />
             <span className="truncate text-[8px] font-black uppercase tracking-wide text-red-600 dark:text-red-400 sm:text-[9px]">{cargoExibicao}</span>
          </div>
          )}

          {descricaoExibicao && (
          <p className="line-clamp-2 text-[8px] font-semibold leading-snug text-zinc-500 dark:text-zinc-400 sm:text-[10px]">
            {descricaoExibicao}
          </p>
          )}

          <div className="flex items-center gap-1.5">
             <div className="w-1 h-3 rounded-full bg-zinc-300 dark:bg-zinc-700" />
             <span className="text-[9px] text-zinc-400 font-bold uppercase tracking-wider">{editalBase.banca || 'Banca a definir'}</span>
          </div>

          <div className="flex items-center justify-between mt-1 pt-2 border-t border-zinc-50 dark:border-zinc-800/50">
            <div className="flex items-center gap-1 text-[9px] font-bold text-zinc-400">
              <Layers size={10} className="text-zinc-300" />
              <span>{qtdDisc} Matérias</span>
            </div>
          </div>

          <div className="mt-1.5 sm:mt-2">
              <button onClick={e => { e.stopPropagation(); handleClick(); }}
                className={`w-full text-[8px] font-black py-1.5 rounded-xl flex items-center justify-center gap-1 transition-all active:scale-95 sm:gap-1.5 sm:py-2 sm:text-[9px] ${
                  estaConfirmado
                    ? 'bg-red-600 text-white shadow-lg shadow-red-500/20'
                    : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-red-600 hover:text-white dark:hover:bg-red-600 dark:hover:text-white'
                }`}>
                {variosCargos
                  ? (<>Ver Cargos <ChevronDown size={10} strokeWidth={3} /></>)
                  : estaConfirmado ? (<>Selecionado <Check size={10} strokeWidth={3} /></>)
                    : 'Selecionar'}
              </button>
          </div>
        </div>

        <AnimatePresence>
          {variosCargos && menuAberto && (
            <motion.div initial={{ opacity: 0, y: '100%' }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: '100%' }}
              className="absolute inset-0 z-30 bg-white dark:bg-zinc-950 flex flex-col rounded-[24px] overflow-hidden">
              <div className="p-2.5 sm:p-3 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between bg-zinc-50/50 dark:bg-zinc-900/50">
                <span className="text-[7px] sm:text-[9px] font-black uppercase tracking-[0.12em] text-zinc-500 flex items-center gap-2"><Briefcase size={12} /> Escolha o Cargo</span>
                <button onClick={e => { e.stopPropagation(); setMenuAberto(false); }} className="p-1.5 hover:bg-red-50 dark:hover:bg-red-950 text-zinc-400 hover:text-red-500 rounded-lg transition-colors"><X size={14} strokeWidth={2.5} /></button>
              </div>
              <div className="flex-1 overflow-y-auto p-2 space-y-1.5 custom-scrollbar">
                {dados.map(item => {
                  const isAtivo = idConfirmado === item.id;
                  return (
                    <button key={item.id} onClick={e => { e.stopPropagation(); aoConfirmar(item); setMenuAberto(false); }}
                      className={`w-full text-left p-2 sm:p-3 rounded-xl border-2 transition-all active:scale-[0.98] ${
                        isAtivo ? 'border-red-500 bg-red-50/50 dark:bg-red-950/20' : 'border-zinc-50 dark:border-zinc-900 hover:border-red-200 dark:hover:border-red-800 bg-zinc-50/30 dark:bg-zinc-900/30'
                      }`}>
                      <div className="text-[8px] sm:text-[9px] font-black text-zinc-900 dark:text-white uppercase leading-tight truncate">{item.cargo || 'Cargo Padrão'}</div>
                      <div className="text-[7px] sm:text-[8px] font-bold text-zinc-400 mt-1 uppercase tracking-tighter flex items-center gap-1.5">
                         <Layers size={10} /> {item.disciplinas?.length || 0} matérias
                      </div>
                    </button>
                  );
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
};

// ─── SEÇÃO POR CATEGORIA (COM ARRASTE MOUSE) ──────────────────────────────────
const SecaoCategoria = ({ chave, itens, idConfirmado, onConfirmar }) => {
  const cfg   = CATEGORIA_CONFIG[chave] || CATEGORIA_CONFIG.adm;
  const Icone = cfg.icon;
  const [usarScrollNativo, setUsarScrollNativo] = useState(false);

  const grupos = useMemo(() => {
    const g = {};
    itens.forEach(item => {
      const key = (item.instituicao || item.titulo.split(' - ')[0]).toUpperCase();
      if (!g[key]) g[key] = [];
      g[key].push(item);
    });
    return Object.values(g);
  }, [itens]);

  const scrollRef = useRef(null);
  const contentRef = useRef(null);
  const [largura, setLargura] = useState(0);
  const [arrastando, setArrastando] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return undefined;
    const media = window.matchMedia('(max-width: 1023px), (pointer: coarse)');
    const update = () => setUsarScrollNativo(media.matches);
    update();
    media.addEventListener?.('change', update);
    return () => media.removeEventListener?.('change', update);
  }, []);

  useEffect(() => {
    const calcularLargura = () => {
      if (!scrollRef.current || !contentRef.current) return;
      setLargura(Math.max(0, contentRef.current.scrollWidth - scrollRef.current.offsetWidth));
    };

    calcularLargura();
    const timeout = setTimeout(calcularLargura, 300);
    window.addEventListener('resize', calcularLargura);
    return () => {
      clearTimeout(timeout);
      window.removeEventListener('resize', calcularLargura);
    };
  }, [grupos]);

  const scrollByCards = (direction) => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({
      left: Math.min(Math.max(0, el.scrollLeft + direction * Math.min(el.clientWidth * 0.82, 520)), largura),
      behavior: 'smooth'
    });
  };

  return (
    <div className="mb-10 last:mb-0">
      <div className="flex items-center justify-between gap-3 mb-3 px-1 sticky left-0 z-10">
        <div className="flex items-center gap-4 min-w-0">
          <motion.div whileHover={{ scale: 1.05 }} className={`relative p-2 rounded-xl ${cfg.bg} ${cfg.color} shadow-md shadow-black/5 border-2 border-white/50 dark:border-white/5 shrink-0`}>
            <Icone size={17} strokeWidth={2} />
          </motion.div>
          <div className="min-w-0 flex-1">
            <h4 className="text-sm sm:text-base font-black text-zinc-900 dark:text-white uppercase tracking-tighter leading-none mb-1 truncate">{cfg.label}</h4>
            <div className="flex items-center gap-1.5">
              <div className="h-1 w-12 bg-gradient-to-r from-red-600 to-red-400 rounded-full"></div>
              <div className="h-1 w-2 bg-red-400 rounded-full opacity-60"></div>
              <div className="h-1 w-1 bg-red-300 rounded-full opacity-40"></div>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="hidden sm:flex px-2.5 py-1 rounded-lg bg-gradient-to-br from-zinc-900 to-zinc-800 dark:from-zinc-800 dark:to-zinc-900 text-white font-black text-[11px] shadow-lg border border-zinc-700/50">
            {itens.length}
          </motion.div>
          <button
            type="button"
            onClick={() => scrollByCards(-1)}
            className="w-8 h-8 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white/90 dark:bg-zinc-900/90 text-zinc-500 hover:text-red-600 hover:border-red-200 dark:hover:border-red-900 shadow-sm transition-all active:scale-95"
            aria-label={`Ver editais anteriores de ${cfg.label}`}
          >
            <ChevronLeft size={15} strokeWidth={3} className="mx-auto" />
          </button>
          <button
            type="button"
            onClick={() => scrollByCards(1)}
            className="w-8 h-8 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white/90 dark:bg-zinc-900/90 text-zinc-500 hover:text-red-600 hover:border-red-200 dark:hover:border-red-900 shadow-sm transition-all active:scale-95"
            aria-label={`Ver próximos editais de ${cfg.label}`}
          >
            <ChevronRight size={15} strokeWidth={3} className="mx-auto" />
          </button>
        </div>
      </div>

      <motion.div
        ref={scrollRef}
        className="-mx-3 cursor-grab overflow-x-auto overflow-y-hidden overscroll-x-contain px-3 py-2 active:cursor-grabbing custom-scrollbar"
        whileTap={{ cursor: 'grabbing' }}
        style={{ WebkitOverflowScrolling: 'touch', touchAction: usarScrollNativo ? 'pan-x pan-y' : 'pan-x' }}
      >
        <motion.div
          ref={contentRef}
          drag={usarScrollNativo ? false : 'x'}
          dragConstraints={{ right: 0, left: -largura }}
          dragElastic={usarScrollNativo ? 0 : 0.06}
          dragMomentum={!usarScrollNativo}
          onDragStart={() => !usarScrollNativo && setArrastando(true)}
          onDragEnd={() => !usarScrollNativo && setTimeout(() => setArrastando(false), 150)}
          className="flex w-max snap-x snap-mandatory gap-3 pb-3 transform-gpu will-change-transform sm:gap-4"
        >
          {grupos.map((grupo, i) => (
            <div key={i} className="relative snap-start transform transition-transform hover:z-10" onClickCapture={(e) => { if (arrastando) e.stopPropagation(); }}>
              <CardEdital
                dados={grupo.length === 1 ? grupo[0] : grupo}
                unico={grupo.length === 1}
                idConfirmado={idConfirmado}
                aoConfirmar={onConfirmar}
              />
            </div>
          ))}
        </motion.div>
      </motion.div>
    </div>
  );
};

const TelaEscolhaTipo = ({ onManual, onCatalogo }) => {
  const opcoes = [
    {
      id: 'edital',
      title: 'Edital',
      subtitle: 'Pronto e organizado',
      desc: 'Use um edital pronto, com materias e topicos ja estruturados para comecar mais rapido.',
      icon: Library,
      action: 'Explorar',
      onClick: onCatalogo,
      tone: 'red',
    },
    {
      id: 'manual',
      title: 'Manual',
      subtitle: 'Personalizado',
      desc: 'Crie a base do zero, escolha suas disciplinas e monte o plano no seu formato.',
      icon: Plus,
      action: 'Montar',
      onClick: onManual,
      tone: 'zinc',
    },
  ];

  return (
    <div className="flex min-h-[calc(100vh-12rem)] w-full max-w-5xl mx-auto flex-col items-center justify-center py-4 md:min-h-0 md:justify-start md:pt-0">
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="relative mb-5 text-center sm:mb-7">
        <h2 className="mb-2 text-4xl font-black uppercase leading-[0.95] tracking-tighter text-zinc-900 dark:text-white sm:mb-3 sm:text-4xl">Selecione como deseja<br /><span className="text-red-600">Começar</span></h2>
        <p className="mx-auto max-w-md px-4 text-[12px] font-black uppercase leading-relaxed tracking-[0.16em] text-zinc-500 dark:text-zinc-400 sm:text-sm sm:font-semibold sm:normal-case sm:tracking-normal">Escolha um edital pronto ou crie uma base manual para o seu plano.</p>
      </motion.div>
      <div className="grid w-full max-w-5xl grid-cols-2 gap-2 px-1 sm:gap-6 lg:gap-10">
        {opcoes.map((opcao) => {
          const Icon = opcao.icon;
          const isRed = opcao.tone === 'red';
          return (
            <motion.button
              key={opcao.id}
              whileHover={{ y: -8, scale: 1.015 }}
              whileTap={{ scale: 0.99 }}
              onClick={opcao.onClick}
              className={`group relative flex min-h-[168px] flex-col overflow-hidden rounded-2xl border-2 p-3 text-left shadow-md transition-all duration-500 dark:bg-zinc-900 sm:min-h-[260px] sm:p-6 md:rounded-[2.2rem] md:p-7 md:shadow-xl ${
                isRed
                  ? 'border-zinc-100 bg-white hover:border-red-600 hover:shadow-red-600/10 dark:border-zinc-800'
                  : 'border-dashed border-zinc-300 bg-zinc-50 hover:border-zinc-400 hover:bg-white hover:shadow-zinc-900/10 dark:border-zinc-700 dark:bg-zinc-900/60 dark:hover:border-zinc-500 dark:hover:bg-zinc-900'
              }`}
            >
              <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-[2.2rem]">
                <Icon
                  size={160}
                  strokeWidth={1.5}
                  className={`absolute -bottom-6 -right-6 opacity-[0.05] transition-all duration-700 group-hover:-rotate-12 group-hover:scale-110 dark:opacity-[0.08] ${isRed ? 'text-red-600 dark:text-red-500' : 'text-zinc-500 dark:text-zinc-400'}`}
                />
                <div className={`absolute inset-0 opacity-0 transition-opacity duration-500 group-hover:opacity-100 ${isRed ? 'bg-gradient-to-br from-red-500/[0.05] to-transparent' : 'bg-[radial-gradient(circle_at_bottom_right,rgba(113,113,122,0.10),transparent_55%)]'}`} />
              </div>
              <div className={`relative z-10 mb-2 flex h-7 w-7 items-center justify-center rounded-xl shadow-lg transition-all duration-500 group-hover:rotate-6 sm:mb-6 sm:h-12 sm:w-12 ${isRed ? 'bg-red-600 text-white shadow-red-500/20' : 'border border-zinc-200 bg-zinc-100 text-zinc-500 shadow-zinc-500/10 dark:border-zinc-700 dark:bg-zinc-800'}`}>
                <Icon size={16} strokeWidth={2.5} className="sm:h-6 sm:w-6" />
              </div>
              <div className="relative z-10 flex h-full flex-col">
                <h3 className="mb-1 text-[18px] font-black uppercase leading-none tracking-tighter text-zinc-900 dark:text-white min-[390px]:text-[20px] sm:mb-2 sm:text-xl md:text-2xl">
                  {opcao.title}
                </h3>
                <p className={`mb-1 text-[7px] font-black uppercase tracking-[0.1em] sm:mb-4 sm:text-[9px] sm:tracking-[0.2em] ${isRed ? 'text-red-600 dark:text-red-500' : 'text-zinc-500 dark:text-zinc-400'}`}>
                  {opcao.subtitle}
                </p>
                <p className="line-clamp-3 text-[11px] font-semibold leading-snug text-zinc-500 dark:text-zinc-400 min-[390px]:text-[12px] sm:text-[12px] md:text-[13px] lg:text-sm">
                  {opcao.desc}
                </p>
                <div className={`mt-auto pt-3 text-[8px] font-black uppercase tracking-[0.1em] transition-all group-hover:text-red-600 group-hover:tracking-[0.14em] sm:text-[10px] ${isRed ? 'text-red-600' : 'text-zinc-500'}`}>
                  {opcao.action} <ArrowRight size={11} strokeWidth={3} className="inline" />
                </div>
              </div>
            </motion.button>
          );
        })}
      </div>
    </div>
  );
};

// ─── TELA CATÁLOGO ────────────────────────────────────────────────────────────
const TelaCatalogo = ({ modelos, carregando, idConfirmado, onConfirmar, onAbrirSuporte }) => {
  const [busca, setBusca] = useState('');

  const modelosFiltrados = useMemo(() => {
    if (!busca) return modelos.filter(m => m.ativo !== false);
    const b = busca.toLowerCase();
    return modelos.filter(m => {
      if (m.ativo === false) return false;
      return (m.titulo + ' ' + (m.instituicao || '') + ' ' + (m.banca || '') + ' ' + (m.cargo || '')).toLowerCase().includes(b);
    });
  }, [modelos, busca]);

  const categorias = useMemo(() => {
    const grupos = { pm: [], pc: [], pp: [], cbm: [], gcm: [], fa: [], federal: [], adm: [] };
    modelosFiltrados.forEach(m => {
      const t = (m.titulo + ' ' + (m.instituicao || '') + ' ' + (m.tipo || '')).toLowerCase();
      if (t.includes('federal') || t.includes('prf') || t.includes('pf') || t.includes('depen')) grupos.federal.push(m);
      else if (t.includes('penal') || t.includes('agepen') || t.includes(' pp')) grupos.pp.push(m);
      else if (t.includes('pm') || t.includes('policia militar') || t.includes('polícia militar')) grupos.pm.push(m);
      else if (t.includes('pc') || t.includes('policia civil') || t.includes('polícia civil')) grupos.pc.push(m);
      else if (t.includes('cbm') || t.includes('bombeiro')) grupos.cbm.push(m);
      else if (t.includes('gcm') || t.includes('guarda') || t.includes('cgm')) grupos.gcm.push(m);
      else if (t.includes('exército') || t.includes('marinha') || t.includes('aeronáutica') || t.includes('forças armadas') || t.includes('esa') || t.includes('eear')) grupos.fa.push(m);
      else grupos.adm.push(m);
    });
    return grupos;
  }, [modelosFiltrados]);

  const total = Object.values(categorias).reduce((a, c) => a + c.length, 0);

  return (
    <div className="flex flex-col w-full px-2 sm:px-6 pb-16">
      <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} className="text-center mb-6 w-full mx-auto">
        <h2 className="text-4xl sm:text-4xl font-black text-zinc-900 dark:text-white uppercase tracking-tighter leading-[0.95] mb-3">Catálogo de<br /><span className="text-red-600">Editais</span></h2>
        <p className="text-zinc-500 dark:text-zinc-400 text-base sm:text-sm font-semibold leading-relaxed max-w-md mx-auto mb-5">Selecione o concurso, confira cargo e descrição, e organize sua preparação.</p>
        <div className="mx-auto flex w-full max-w-4xl flex-col items-stretch justify-center gap-3 px-1 lg:flex-row lg:items-center">
           <div className="relative w-full min-w-0 flex-1 group">
              <input type="text" value={busca} onChange={e => setBusca(e.target.value)} placeholder="BUSCAR CONCURSO (EX: PMBA, PCSP, PRF...)" className="w-full px-10 py-4 bg-white dark:bg-zinc-900 border-2 border-zinc-100 dark:border-zinc-800 rounded-2xl text-xs font-black uppercase tracking-widest text-zinc-900 dark:text-white placeholder:text-zinc-400 focus:border-red-600 outline-none transition-all shadow-xl shadow-zinc-900/5 dark:shadow-none" />
              {busca && <button onClick={() => setBusca('')} className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-red-600"><X size={16} strokeWidth={3} /></button>}
           </div>
          <button
            onClick={onAbrirSuporte}
            className="inline-flex h-[52px] items-center justify-center gap-2.5 rounded-2xl bg-zinc-900 px-4 text-white shadow-lg shadow-zinc-900/20 transition-all active:scale-95 dark:bg-zinc-100 dark:text-zinc-900 border border-white/10 dark:border-zinc-300 group lg:w-auto lg:shrink-0"
          >
            <div className="w-6 h-6 rounded-full bg-red-600 flex items-center justify-center shrink-0 shadow-lg shadow-red-600/30 group-hover:rotate-12 transition-transform">
              <MessageSquare size={12} strokeWidth={3} className="text-white" />
            </div>
            <p className="text-[9px] font-black uppercase tracking-[0.12em] whitespace-nowrap">Edital não listado? <span className="text-red-500 ml-1">Fale conosco</span></p>
            <ChevronRight size={12} strokeWidth={3} className="text-zinc-400 dark:text-zinc-600 group-hover:translate-x-1 transition-transform" />
          </button>
        </div>
      </motion.div>
      <div className="space-y-4">
        {carregando ? (
          <div className="flex flex-wrap gap-4 justify-center">{Array.from({ length: 8 }).map((_, i) => <SkeletonCard key={i} />)}</div>
        ) : total === 0 ? (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center justify-center py-20 bg-zinc-50 dark:bg-zinc-900/50 rounded-[40px] border-2 border-dashed border-zinc-200 dark:border-zinc-800"><Search size={48} className="text-zinc-200 dark:text-zinc-800 mb-4" strokeWidth={1.5} /><h3 className="font-black text-zinc-400 uppercase tracking-widest">Missão não localizada</h3></motion.div>
        ) : (
          <div className="space-y-2 pb-10">
            {Object.entries(categorias).map(([chave, itens]) => itens.length > 0 && (<SecaoCategoria key={chave} chave={chave} itens={itens} idConfirmado={idConfirmado} onConfirmar={onConfirmar} />))}
          </div>
        )}
      </div>
    </div>
  );
};

// ─── COMPONENTE PRINCIPAL ─────────────────────────────────────────────────────
const Step1_Edital = ({ editalSelecionado, modelos = [], carregando, onSelect, onAbrirSuporte, onEscolhaCompleta }) => {
  const [tela, setTela] = useState('escolha');
  const idConfirmado = editalSelecionado?.id || null;

  const handleConfirmar = (edital) => {
    onSelect(edital);
  };
  const handleManual = () => {
    onSelect({ id: 'manual', titulo: 'Manual', disciplinas: [] });
    onEscolhaCompleta?.();
  };

  return (
    <div className="flex flex-col w-full min-h-[500px]">
      <AnimatePresence mode="wait">
        {tela === 'escolha' ? (
          <motion.div key="escolha" initial={{ opacity: 0, x: -18 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -18 }} transition={{ duration: 0.22, ease: 'easeOut' }} className="w-full">
            <TelaEscolhaTipo onManual={handleManual} onCatalogo={() => setTela('catalogo')} />
          </motion.div>
        ) : (
          <motion.div key="catalogo" initial={{ opacity: 0, x: 18 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 18 }} transition={{ duration: 0.22, ease: 'easeOut' }} className="w-full">
            <div className="mb-6 px-1"><button onClick={() => setTela('escolha')} className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400 hover:text-red-600 transition-colors"><ChevronLeft size={14} strokeWidth={3} /> Voltar para opções</button></div>
            <TelaCatalogo modelos={modelos} carregando={carregando} idConfirmado={idConfirmado} onConfirmar={handleConfirmar} onAbrirSuporte={onAbrirSuporte} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export { Step1_Edital };
export default Step1_Edital;




