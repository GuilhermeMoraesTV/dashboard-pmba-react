import React, { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  BookOpen, ChevronDown, CheckCircle2, Square, MinusSquare,
  Search, X, CheckSquare, Layers, Tag, Sparkles, Target,
  Plus, Trash2, Edit2, AlertTriangle, Zap, TrendingUp, Flame
} from 'lucide-react';

// ══════════════════════════════════════════════════════════════════════════════
//  CABEÇALHO DA PÁGINA
// ══════════════════════════════════════════════════════════════════════════════
const PageHeader = ({ modoManual }) => (
  <motion.div
    initial={{ opacity: 0, y: -12 }}
    animate={{ opacity: 1, y: 0 }}
    className="text-center mb-8 max-w-2xl mx-auto px-4"
  >
    <h2 className="text-3xl sm:text-4xl font-black text-zinc-900 dark:text-white uppercase tracking-tight leading-none mb-3">
      O que você vai<br />
      <span className="text-red-600">estudar?</span>
    </h2>
    <p className="text-zinc-500 dark:text-zinc-400 text-sm font-medium leading-relaxed max-w-md mx-auto">
      {modoManual
        ? "Adicione as disciplinas e indique seu nível atual em cada uma. O sistema montará o tempo ideal de forma inteligente."
        : "Marque o que vai estudar e defina seu nível de domínio. Nossa IA dará mais tempo para suas dificuldades e menos para o que já domina."}
    </p>
  </motion.div>
);

// ══════════════════════════════════════════════════════════════════════════════
//  CARDS SIDEBAR E MINI
// ══════════════════════════════════════════════════════════════════════════════
const EditalSidebarCard = ({ editalSelecionado }) => (
  <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 flex flex-col items-center text-center relative overflow-hidden shadow-[0_8px_30px_rgba(239,68,68,0.15)] dark:shadow-[0_8px_30px_rgba(239,68,68,0.08)]">
    <div className="absolute top-0 inset-x-0 h-24 bg-gradient-to-b from-red-50 dark:from-red-900/10 to-transparent pointer-events-none" />
    <span className="relative z-10 inline-block px-2.5 py-1 mb-4 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 text-[9px] font-black uppercase tracking-widest rounded-lg">
      Edital Alvo
    </span>
    <div className="relative z-10 w-24 h-24 shrink-0 rounded-2xl bg-white dark:bg-zinc-800 border-2 border-red-100 dark:border-red-900/30 flex items-center justify-center p-3 mb-4 shadow-lg shadow-red-500/20">
      {editalSelecionado.logo || editalSelecionado.logoUrl ? (
        <img src={editalSelecionado.logo || editalSelecionado.logoUrl} alt="Logo Edital" className="w-full h-full object-contain" />
      ) : <Target size={36} className="text-red-500" />}
    </div>
    <div className="relative z-10 w-full">
      <h3 className="text-base font-black text-zinc-900 dark:text-white uppercase leading-tight line-clamp-2">
        {editalSelecionado.titulo || editalSelecionado.nome}
      </h3>
      {editalSelecionado.cargo && (
        <p className="text-xs font-bold text-zinc-500 dark:text-zinc-400 mt-1.5 line-clamp-1">
          {editalSelecionado.cargo}
        </p>
      )}
    </div>
  </div>
);

const StatsSidebarCard = ({ stats }) => (
  <div className="bg-white dark:bg-zinc-900 rounded-3xl p-6 shadow-xl shadow-zinc-200/40 dark:shadow-none border border-zinc-100 dark:border-zinc-800 relative overflow-hidden">
    <div className="absolute top-0 right-0 w-40 h-40 bg-red-500/5 dark:bg-red-500/10 rounded-full blur-[40px] pointer-events-none" />
    <div className="relative z-10">
      <div className="flex items-center gap-2 mb-6 opacity-80">
        <Sparkles size={16} className="text-red-500" />
        <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500 dark:text-zinc-400">
          Resumo da Seleção
        </p>
      </div>
      <div className="space-y-5">
        <BarStat label="Matérias Selecionadas" marcado={stats.discMarcadas} total={stats.totalDisc} cor="bg-zinc-800 dark:bg-zinc-100" />
        <BarStat label="Tópicos Selecionados" marcado={stats.topicosMarcados} total={stats.totalTopicos} cor="bg-red-500" />
      </div>
    </div>
  </div>
);

const EditalMiniCard = ({ editalSelecionado }) => (
  <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-3 shadow-sm flex flex-col items-center text-center justify-center relative overflow-hidden h-full min-h-[120px]">
    <div className="absolute top-0 inset-x-0 h-1 bg-red-500" />
    <div className="w-10 h-10 shrink-0 rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-100 dark:border-zinc-700 flex items-center justify-center p-1.5 mb-2 z-10">
      {editalSelecionado.logo || editalSelecionado.logoUrl ? (
        <img src={editalSelecionado.logo || editalSelecionado.logoUrl} alt="Logo Edital" className="w-full h-full object-contain" />
      ) : <Target size={20} className="text-red-500" />}
    </div>
    <h3 className="text-[11px] font-black text-zinc-900 dark:text-white uppercase line-clamp-2 leading-tight">
      {editalSelecionado.titulo || editalSelecionado.nome}
    </h3>
    <p className="text-[9px] font-bold text-zinc-500 dark:text-zinc-400 mt-1 line-clamp-1">
      {editalSelecionado.cargo}
    </p>
  </div>
);

const StatsMiniCard = ({ stats }) => (
  <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-3 shadow-sm flex flex-col justify-center h-full min-h-[120px]">
    <div className="flex items-center gap-1.5 mb-3">
      <div className="w-5 h-5 rounded-md bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center shrink-0">
        <Sparkles size={10} className="text-zinc-600 dark:text-zinc-400" />
      </div>
      <h3 className="text-[10px] font-black text-zinc-900 dark:text-white uppercase tracking-wider">Resumo</h3>
    </div>
    <div className="space-y-2.5">
      <div>
         <div className="flex justify-between items-end text-[9px] font-bold mb-1">
           <span className="text-zinc-500">Matérias</span>
           <span className="text-zinc-900 dark:text-white">{stats.discMarcadas}/{stats.totalDisc}</span>
         </div>
         <div className="h-1.5 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
           <motion.div className="h-full bg-zinc-800 dark:bg-zinc-100 rounded-full" animate={{ width: stats.totalDisc > 0 ? `${Math.round((stats.discMarcadas / stats.totalDisc) * 100)}%` : '0%' }} />
         </div>
      </div>
      <div>
         <div className="flex justify-between items-end text-[9px] font-bold mb-1">
           <span className="text-zinc-500">Tópicos</span>
           <span className="text-zinc-900 dark:text-white">{stats.topicosMarcados}/{stats.totalTopicos}</span>
         </div>
         <div className="h-1.5 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
           <motion.div className="h-full bg-red-500 rounded-full" animate={{ width: stats.totalTopicos > 0 ? `${Math.round((stats.topicosMarcados / stats.totalTopicos) * 100)}%` : '0%' }} />
         </div>
      </div>
    </div>
  </div>
);

// ══════════════════════════════════════════════════════════════════════════════
//  FORMULÁRIO
// ══════════════════════════════════════════════════════════════════════════════
const FormAdicionarDisciplina = ({ valor, setValor, onSubmit, modoManual }) => {
  const [isOpen, setIsOpen] = useState(modoManual);

  useEffect(() => {
    if (window.innerWidth < 1024 && !modoManual) setIsOpen(false);
  }, [modoManual]);

  const handleSubmit = (e) => { e.preventDefault(); onSubmit(e); };

  return (
    <div className="bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-200 dark:border-zinc-800 shadow-sm mb-6 overflow-hidden transition-all">
      <button onClick={() => setIsOpen(!isOpen)} className="w-full p-4 flex items-center justify-between hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors focus:outline-none">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-red-100 dark:bg-red-900/30 flex items-center justify-center shrink-0 transition-transform"><Plus size={18} className="text-red-600 dark:text-red-400" /></div>
          <div className="text-left">
            <h2 className="text-base font-black text-zinc-900 dark:text-white leading-none">Criar Nova Disciplina</h2>
            <p className="text-[11px] text-zinc-500 mt-0.5">Clique para adicionar matérias personalizadas</p>
          </div>
        </div>
        <div className={`p-1.5 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-400 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`}><ChevronDown size={18} /></div>
      </button>
      <AnimatePresence>
        {isOpen && (
          <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} className="overflow-hidden">
            <div className="px-4 pb-4">
              <form onSubmit={handleSubmit} className="flex items-center gap-3 pt-2 border-t border-zinc-100 dark:border-zinc-800">
                <div className="relative flex-1 w-full">
                  <BookOpen size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400" />
                  <input value={valor} onChange={e => setValor(e.target.value)} placeholder="Ex: Redação, Informática..." className="w-full pl-10 pr-3 py-3.5 bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700 rounded-2xl text-sm font-bold placeholder:text-zinc-400 text-zinc-900 dark:text-white focus:border-red-500 focus:bg-white dark:focus:bg-zinc-900 outline-none transition-all shadow-sm" />
                </div>
                <button type="submit" disabled={!valor.trim()} className="flex items-center justify-center px-6 py-3.5 rounded-2xl bg-red-600 text-white font-bold text-sm hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-95 shadow-sm shrink-0">Adicionar</button>
              </form>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// ══════════════════════════════════════════════════════════════════════════════
//  SELETOR DE NÍVEL — PILLS HORIZONTAIS (SEMPRE LADO A LADO)
// ══════════════════════════════════════════════════════════════════════════════

const NIVEL_CONFIG = {
  iniciante: {
    id: 'iniciante',
    label: 'Iniciante',
    icon: Flame,
    activeBg: 'bg-red-500',
    activeText: 'text-white',
    badgeBg: 'bg-red-50 dark:bg-red-950/60',
    badgeBorder: 'border-red-200 dark:border-red-800/60',
    badgeText: 'text-red-600 dark:text-red-400',
  },
  intermediario: {
    id: 'intermediario',
    label: 'Médio',
    icon: TrendingUp,
    activeBg: 'bg-amber-500',
    activeText: 'text-white',
    badgeBg: 'bg-amber-50 dark:bg-amber-950/60',
    badgeBorder: 'border-amber-200 dark:border-amber-800/60',
    badgeText: 'text-amber-600 dark:text-amber-400',
  },
  avancado: {
    id: 'avancado',
    label: 'Avançado',
    icon: Zap,
    activeBg: 'bg-emerald-500',
    activeText: 'text-white',
    badgeBg: 'bg-emerald-50 dark:bg-emerald-950/60',
    badgeBorder: 'border-emerald-200 dark:border-emerald-800/60',
    badgeText: 'text-emerald-600 dark:text-emerald-400',
  },
};

const NivelInteligenteSelector = ({ nivelAtual, onNivelChange, isFaltando }) => {
  const options = Object.values(NIVEL_CONFIG);

  return (
    <div className="mt-4 pt-4 border-t border-zinc-100 dark:border-zinc-800/60 w-full" onClick={(e) => e.stopPropagation()}>
      <div className="mb-2.5 w-full">
        <span className={`inline-flex max-w-full min-w-0 items-center gap-2 rounded-lg px-2.5 py-1.5 text-[0px] font-black uppercase tracking-widest leading-tight ${isFaltando ? 'bg-red-500/10 text-red-500 dark:bg-red-500/10 dark:text-red-400' : 'text-zinc-400 dark:text-zinc-500'}`}>
          <span className="shrink-0">
            {isFaltando ? <AlertTriangle size={12} /> : <Target size={12} />}
          </span>
          <span className="min-w-0 whitespace-normal break-words text-[10px]">
            {isFaltando ? 'Obrigatorio escolher nivel' : 'Nivel de Dominio'}
          </span>
        </span>
      </div>

      {/* Botões SEMPRE em linha horizontal, ícones nunca cortados */}
      <div className={`grid grid-cols-3 gap-1.5 sm:gap-2 p-1 sm:p-1.5 rounded-xl transition-all duration-300 ${isFaltando ? 'bg-red-500/[0.04] dark:bg-red-500/[0.06]' : 'bg-zinc-50 dark:bg-zinc-800/40'}`}>
        {options.map((opt) => {
          const isActive = nivelAtual === opt.id;
          const Icon = opt.icon;

          return (
            <button
              key={opt.id}
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); onNivelChange(opt.id); }}
              className={`
                min-w-0 flex items-center justify-center gap-1 sm:gap-2
                py-2 px-1 sm:py-2.5 sm:px-3 rounded-lg
                text-[9px] sm:text-[11px] font-bold transition-all duration-200
                active:scale-95
                ${isActive
                  ? `${opt.activeBg} ${opt.activeText} shadow-md`
                  : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-white dark:hover:bg-zinc-700'
                }
              `}
            >
              <span className="shrink-0 flex items-center justify-center w-[14px] h-[14px]">
                <Icon size={14} strokeWidth={isActive ? 2.5 : 2} />
              </span>
              <span className="min-w-0 whitespace-normal break-words leading-tight">{opt.label}</span>
            </button>
          );
        })}
      </div>

      <p className="text-[10px] text-zinc-400 dark:text-zinc-500 font-medium mt-2.5 leading-tight px-1">
        * A sua dificuldade nessa matéria define o quanto de tempo será dedicado a ela no cronograma.
      </p>
    </div>
  );
};


// ══════════════════════════════════════════════════════════════════════════════
//  LISTAGEM DE ASSUNTOS E CARD DE DISCIPLINA
// ══════════════════════════════════════════════════════════════════════════════
const AssuntoItem = ({ assunto, checked, onToggle, onRemover, onEditar }) => {
  const [editando, setEditando] = useState(false);
  const [valor, setValor] = useState(assunto);
  const confirmar = () => { const trimmed = valor.trim(); if (trimmed && trimmed !== assunto) onEditar?.(trimmed); setEditando(false); };

  return (
    <motion.div layout initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }} className={`flex items-center gap-2 sm:gap-3 group px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl border transition-all cursor-pointer ${checked ? 'bg-red-50/50 dark:bg-red-900/10 border-red-200 dark:border-red-900/40' : 'bg-white dark:bg-zinc-900 border-zinc-100 dark:border-zinc-800 hover:border-red-100 dark:hover:border-red-900/30'}`} onClick={() => onToggle?.()}>
      <div className={`shrink-0 flex items-center justify-center transition-colors ${checked ? 'text-red-600 dark:text-red-500' : 'text-zinc-300 dark:text-zinc-600 group-hover:text-red-400'}`}>
        {checked ? <CheckSquare size={16} strokeWidth={2.5} /> : <Square size={16} strokeWidth={1.5} />}
      </div>
      {editando ? (
        <input value={valor} onChange={e => setValor(e.target.value)} onBlur={confirmar} onKeyDown={e => { if (e.key === 'Enter') confirmar(); if (e.key === 'Escape') setEditando(false); }} autoFocus onClick={e => e.stopPropagation()} className="flex-1 text-sm font-medium bg-white dark:bg-zinc-950 border border-red-400 rounded-lg px-3 py-1 outline-none text-zinc-900 dark:text-white shadow-sm" />
      ) : (
        <span className={`flex-1 text-xs sm:text-sm font-medium leading-relaxed truncate transition-colors ${checked ? 'text-zinc-900 dark:text-zinc-100' : 'text-zinc-600 dark:text-zinc-400'}`}>{assunto}</span>
      )}
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity" onClick={e => e.stopPropagation()}>
        <button onClick={() => { setEditando(true); setValor(assunto); }} className="p-1.5 rounded-lg text-zinc-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-all"><Edit2 size={14} /></button>
        <button onClick={onRemover} className="p-1.5 rounded-lg text-zinc-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 transition-all"><Trash2 size={14} /></button>
      </div>
    </motion.div>
  );
};


const DisciplinaCard = ({
  disciplina, isExpanded, onToggleExpand, estadoDisc, onToggleDisc, onToggleAssunto,
  onRemover, onEditar, onAdicionarAssunto, onRemoverAssunto, onEditarAssunto, onNivelChange, isExtra = false,
}) => {
  const [novoAssunto, setNovoAssunto] = useState('');
  const [editandoNome, setEditandoNome] = useState(false);
  const [nomeTemp, setNomeTemp] = useState(disciplina.nome);

  const confirmarNome = () => { const t = nomeTemp.trim(); if (t && t !== disciplina.nome) onEditar?.(disciplina.id, { ...disciplina, nome: t }); setEditandoNome(false); };
  const handleAdicionarAssunto = (e) => { e.preventDefault(); const t = novoAssunto.trim(); if (!t) return; onAdicionarAssunto?.(disciplina.id, t); setNovoAssunto(''); if (!isExpanded) onToggleExpand(); };

  const discChecked = estadoDisc?.checked ?? false;
  const parcial = estadoDisc?.parcial ?? false;
  const assuntosMarcados = estadoDisc?.assuntosMarcados ?? new Set();
  const nivelAtual = estadoDisc?.nivel || null;

  const totalAssuntos = disciplina.assuntos.length;
  const qtdMarcados = assuntosMarcados.size;
  const corBarra = discChecked ? 100 : totalAssuntos > 0 ? Math.round((qtdMarcados / totalAssuntos) * 100) : 0;

  const isAtivo = discChecked || parcial;
  const isFaltandoNivel = isAtivo && !nivelAtual;

  const borderAccentColor = isAtivo
    ? nivelAtual === 'iniciante' ? 'bg-red-500'
    : nivelAtual === 'intermediario' ? 'bg-amber-500'
    : nivelAtual === 'avancado' ? 'bg-emerald-500'
    : 'bg-orange-400'
    : 'bg-transparent';

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className={`relative mx-1 sm:mx-2 rounded-2xl border transition-all duration-300 overflow-hidden mb-4 group ${isFaltandoNivel
        ? 'border-zinc-200 dark:border-zinc-700/80 bg-white dark:bg-zinc-900 shadow-md'
        : isAtivo
        ? 'border-zinc-200 dark:border-zinc-700/80 bg-white dark:bg-zinc-900 shadow-md'
        : 'border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:border-zinc-300 dark:hover:border-zinc-700 hover:shadow-sm'
      }`}
    >
      <div className={`absolute left-3 top-4 bottom-4 w-1 transition-all duration-500 rounded-full ${borderAccentColor}`} />

      <div className="pl-7 pr-4 sm:pr-5 pt-4 pb-4">
        <div className="flex gap-3 cursor-pointer select-none" onClick={() => !editandoNome && onToggleExpand()}>

          <button
            onClick={(e) => { e.stopPropagation(); onToggleDisc(); }}
            className={`shrink-0 mt-0.5 w-6 h-6 rounded-lg flex items-center justify-center transition-all active:scale-90 z-10 ${discChecked
              ? 'bg-red-600 text-white shadow-sm shadow-red-500/30'
              : parcial
              ? 'bg-orange-100 dark:bg-orange-900/30 text-orange-600'
              : 'border-2 border-zinc-300 dark:border-zinc-600 text-transparent hover:border-red-400'
            }`}
          >
            {discChecked ? <CheckCircle2 size={16} strokeWidth={3} /> : parcial ? <MinusSquare size={16} strokeWidth={3} /> : null}
          </button>

          <div className="flex-1 min-w-0 z-10 flex flex-col justify-center">
            {editandoNome ? (
              <input value={nomeTemp} onChange={e => setNomeTemp(e.target.value)} onBlur={confirmarNome} onKeyDown={e => { if (e.key === 'Enter') confirmarNome(); if (e.key === 'Escape') setEditandoNome(false); }} autoFocus onClick={e => e.stopPropagation()} className="w-full text-sm sm:text-base font-bold bg-zinc-50 dark:bg-zinc-800 border-2 border-red-400 rounded-lg px-3 py-1 outline-none text-zinc-900 dark:text-white" />
            ) : (
              <div className="flex flex-wrap items-center gap-2">
                <h4 className={`text-base sm:text-lg font-black tracking-tight truncate transition-colors ${isAtivo ? 'text-zinc-900 dark:text-white' : 'text-zinc-600 dark:text-zinc-400'}`}>
                  {disciplina.nome}
                </h4>
                {isExtra && (
                  <span className="shrink-0 text-[9px] font-black px-2 py-0.5 rounded-md bg-zinc-100 dark:bg-zinc-800 text-zinc-500 uppercase tracking-widest mt-0.5">Extra</span>
                )}
                {!isExpanded && nivelAtual && isAtivo && (() => {
                  const cfg = NIVEL_CONFIG[nivelAtual];
                  const Icon = cfg.icon;
                  return (
                    <motion.span
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className={`shrink-0 flex items-center gap-1 text-[9px] font-black px-2 py-0.5 rounded-full border ${cfg.badgeBg} ${cfg.badgeBorder} ${cfg.badgeText} uppercase tracking-wider`}
                    >
                      <Icon size={9} strokeWidth={3} />
                      {cfg.label}
                    </motion.span>
                  );
                })()}
              </div>
            )}

            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
              <span className="text-xs text-zinc-400 font-medium">{totalAssuntos} {totalAssuntos === 1 ? 'tópico' : 'tópicos'}</span>
              {qtdMarcados > 0 && !discChecked && (
                <><span className="w-1 h-1 rounded-full bg-zinc-300 dark:bg-zinc-600" /><span className="text-xs font-bold text-orange-500">{qtdMarcados} selected</span></>
              )}
            </div>
          </div>

          <div className="flex items-start gap-1 shrink-0 z-10">
            {onEditar && (
              <button onClick={e => { e.stopPropagation(); setEditandoNome(true); setNomeTemp(disciplina.nome); }} className="p-2 rounded-xl text-zinc-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-all opacity-0 group-hover:opacity-100 md:opacity-100">
                <Edit2 size={16} />
              </button>
            )}
            {onRemover && (
              <button onClick={(e) => { e.stopPropagation(); onRemover?.(disciplina.id); }} className="p-2 rounded-xl text-zinc-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all opacity-0 group-hover:opacity-100 md:opacity-100">
                <Trash2 size={16} />
              </button>
            )}
            <div className={`p-1.5 sm:p-2 rounded-xl transition-all ${isExpanded ? 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300' : 'text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800'}`}>
              <ChevronDown size={18} className={`transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`} />
            </div>
          </div>
        </div>

        {/* Seletor de nível FORA do flex row — ocupa largura total do card */}
        <AnimatePresence>
          {isAtivo && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.25, ease: 'easeInOut' }}
              className="overflow-hidden"
              onClick={e => e.stopPropagation()}
            >
              <NivelInteligenteSelector
                nivelAtual={nivelAtual}
                onNivelChange={(n) => onNivelChange(disciplina.id, n)}
                isFaltando={isFaltandoNivel}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {totalAssuntos > 0 && (
        <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-zinc-100 dark:bg-zinc-800 overflow-hidden rounded-b-xl">
          <motion.div
            className={`h-full ${discChecked ? 'bg-red-500' : 'bg-orange-400'}`}
            initial={{ width: 0 }}
            animate={{ width: `${corBarra}%` }}
            transition={{ duration: 0.5, ease: "easeOut" }}
          />
        </div>
      )}

      <AnimatePresence initial={false}>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: "easeInOut" }}
            className="overflow-hidden z-0"
          >
            <div className="px-4 sm:px-5 pb-5 pt-3 mt-1">

              {totalAssuntos > 0 && (
                <div className="flex items-center justify-between mb-4">
                  <span className="text-xs font-bold uppercase tracking-widest text-zinc-400 flex items-center gap-2"><Tag size={12} /> Tópicos</span>
                  <button onClick={onToggleDisc} className={`text-xs font-bold transition-colors px-3 py-1.5 rounded-lg ${discChecked ? 'text-red-600 bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/40' : 'text-zinc-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20'}`}>
                    {discChecked ? 'Desmarcar todos' : 'Marcar todos'}
                  </button>
                </div>
              )}

              <div className="space-y-2 mb-4 max-h-64 overflow-y-auto pr-1 sm:pr-2 custom-scrollbar">
                {totalAssuntos > 0 ? (
                  <AnimatePresence>
                    {disciplina.assuntos.map((assunto, idx) => (
                      <AssuntoItem key={idx} assunto={assunto} checked={assuntosMarcados.has(idx)} onToggle={() => onToggleAssunto?.(idx)} onRemover={() => onRemoverAssunto?.(disciplina.id, idx)} onEditar={(novo) => onEditarAssunto?.(disciplina.id, idx, novo)} />
                    ))}
                  </AnimatePresence>
                ) : (
                  <div className="text-center py-6 px-4 bg-zinc-50 dark:bg-zinc-800/40 rounded-xl border border-dashed border-zinc-200 dark:border-zinc-700">
                    <p className="text-sm text-zinc-500 font-medium">Nenhum tópico cadastrado.</p>
                  </div>
                )}
              </div>

              <form onSubmit={handleAdicionarAssunto} className="flex items-center gap-2 sm:gap-3">
                <input value={novoAssunto} onChange={e => setNovoAssunto(e.target.value)} placeholder="Novo tópico ou assunto..." className="flex-1 text-sm font-medium px-4 py-2.5 sm:py-3 bg-zinc-50 dark:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-700 rounded-xl outline-none focus:border-red-400 transition-all text-zinc-900 dark:text-white" />
                <button type="submit" disabled={!novoAssunto.trim()} className="w-10 h-10 sm:w-11 sm:h-11 shrink-0 flex items-center justify-center rounded-xl bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 hover:bg-red-600 dark:hover:bg-red-600 disabled:opacity-30 disabled:cursor-not-allowed transition-all active:scale-95 shadow-sm">
                  <Plus size={18} />
                </button>
              </form>

            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

// ══════════════════════════════════════════════════════════════════════════════
//  COMPONENTE PRINCIPAL MODO GERAL
// ══════════════════════════════════════════════════════════════════════════════
const ModoGeral = ({ disciplinas, selecao, onSelecaoChange, onDisciplinasChange, extraDisciplinas = [], onExtraDisciplinasChange = () => {}, editalSelecionado, modoManual, horarios }) => {
  const [nomeNova, setNomeNova] = useState('');
  const [busca, setBusca] = useState('');
  const [expandedId, setExpandedId] = useState(null);
  const [isAddingMobile, setIsAddingMobile] = useState(false);

  const getSelecaoPadrao = () => ({ checked: false, parcial: false, assuntosMarcados: new Set(), nivel: null });

  const adicionarDisciplina = (e) => {
    e.preventDefault(); const nome = nomeNova.trim(); if (!nome) return;
    const novoId = modoManual ? `m-${Date.now()}` : `extra-${Date.now()}`;
    if (modoManual) onDisciplinasChange([{ id: novoId, nome, assuntos: [] }, ...disciplinas]);
    else onExtraDisciplinasChange([{ id: novoId, nome, assuntos: [] }, ...extraDisciplinas]);
    onSelecaoChange({ ...selecao, [novoId]: getSelecaoPadrao() });
    setNomeNova(''); setExpandedId(novoId); setIsAddingMobile(false);
  };

  const handleToggleDisc = (disc) => {
    const atual = selecao[disc.id] || getSelecaoPadrao();
    const allChecked = atual.checked;
    const novosAssuntos = allChecked ? new Set() : new Set(disc.assuntos.map((_, i) => i));
    onSelecaoChange({ ...selecao, [disc.id]: { ...atual, checked: !allChecked, parcial: false, assuntosMarcados: novosAssuntos } });
  };

  const handleToggleAssunto = (disc, assuntoIdx) => {
    const atual = selecao[disc.id] || getSelecaoPadrao();
    const novos = new Set(atual.assuntosMarcados);
    if (novos.has(assuntoIdx)) novos.delete(assuntoIdx); else novos.add(assuntoIdx);
    const totalDisc = disc.assuntos.length;
    onSelecaoChange({ ...selecao, [disc.id]: { ...atual, checked: novos.size === totalDisc && totalDisc > 0, parcial: novos.size > 0 && novos.size < totalDisc, assuntosMarcados: novos } });
  };

  const handleNivelChange = (discId, nivel) => {
    const atual = selecao[discId] || getSelecaoPadrao();
    onSelecaoChange({ ...selecao, [discId]: { ...atual, nivel } });
  };

  const handleSelecionarTodos = () => {
    const novo = {};
    disciplinas.forEach(d => { novo[d.id] = { checked: true, parcial: false, assuntosMarcados: new Set(d.assuntos.map((_, i) => i)), nivel: selecao[d.id]?.nivel || null }; });
    extraDisciplinas.forEach(d => { novo[d.id] = { checked: true, parcial: false, assuntosMarcados: new Set(d.assuntos.map((_, i) => i)), nivel: selecao[d.id]?.nivel || null }; });
    onSelecaoChange(novo);
  };

  const handleLimparTodos = () => {
    const novo = {};
    disciplinas.forEach(d => { novo[d.id] = { ...getSelecaoPadrao(), nivel: selecao[d.id]?.nivel || null }; });
    extraDisciplinas.forEach(d => { novo[d.id] = { ...getSelecaoPadrao(), nivel: selecao[d.id]?.nivel || null }; });
    onSelecaoChange(novo);
  };

  const remover = (id, isExtra) => { if (isExtra) onExtraDisciplinasChange(extraDisciplinas.filter(d => d.id !== id)); else onDisciplinasChange(disciplinas.filter(d => d.id !== id)); const novaSel = { ...selecao }; delete novaSel[id]; onSelecaoChange(novaSel); };
  const editar = (id, novosDados, isExtra) => { if (isExtra) onExtraDisciplinasChange(extraDisciplinas.map(d => d.id === id ? novosDados : d)); else onDisciplinasChange(disciplinas.map(d => d.id === id ? novosDados : d)); };

  const adicionarAssunto = (discId, assunto) => {
    if (extraDisciplinas.find(d => d.id === discId)) { onExtraDisciplinasChange(extraDisciplinas.map(d => d.id === discId ? { ...d, assuntos: [...d.assuntos, assunto] } : d)); }
    else { const disc = disciplinas.find(d => d.id === discId); if (!disc) return; disc.assuntos.push(assunto); const sel = selecao[discId] || getSelecaoPadrao(); onSelecaoChange({ ...selecao, [discId]: { ...sel, checked: false, parcial: sel.assuntosMarcados.size > 0 } }); onDisciplinasChange([...disciplinas]); }
  };
  const removerAssunto = (discId, idx, isExtra) => { if (isExtra) onExtraDisciplinasChange(extraDisciplinas.map(d => d.id === discId ? { ...d, assuntos: d.assuntos.filter((_, i) => i !== idx) } : d)); else onDisciplinasChange(disciplinas.map(d => d.id === discId ? { ...d, assuntos: d.assuntos.filter((_, i) => i !== idx) } : d)); };
  const editarAssunto = (discId, idx, novo, isExtra) => { if (isExtra) onExtraDisciplinasChange(extraDisciplinas.map(d => d.id === discId ? { ...d, assuntos: d.assuntos.map((a, i) => i === idx ? novo : a) } : d)); else onDisciplinasChange(disciplinas.map(d => d.id === discId ? { ...d, assuntos: d.assuntos.map((a, i) => i === idx ? novo : a) } : d)); };

  const discFiltradas = useMemo(() => {
    if (!busca) return disciplinas;
    return disciplinas.filter(d => d.nome.toLowerCase().includes(busca.toLowerCase()));
  }, [disciplinas, busca]);

  const stats = useMemo(() => {
    const totalDisc = disciplinas.length + extraDisciplinas.length;
    const discMarcadas = Object.values(selecao).filter(s => s?.checked || s?.parcial).length;
    const totalTopicos = disciplinas.reduce((a, d) => a + d.assuntos.length, 0) + extraDisciplinas.reduce((a, d) => a + d.assuntos.length, 0);
    const topicosMarcados = disciplinas.reduce((acc, d) => acc + (selecao[d.id]?.assuntosMarcados?.size || 0), 0) + extraDisciplinas.reduce((acc, d) => acc + (selecao[d.id]?.assuntosMarcados?.size || 0), 0);
    return { totalDisc, discMarcadas, totalTopicos, topicosMarcados };
  }, [disciplinas, extraDisciplinas, selecao]);

  const todasSelecionadas = disciplinas.length > 0 && disciplinas.every(d => selecao[d.id]?.checked) && (extraDisciplinas.length === 0 || extraDisciplinas.every(d => selecao[d.id]?.checked));
  const handleToggleTodos = () => { if (todasSelecionadas) handleLimparTodos(); else handleSelecionarTodos(); };

  return (
    <div className="flex flex-col h-full w-full">
      <PageHeader modoManual={modoManual} />
      <div className="flex flex-col lg:flex-row gap-6 lg:gap-8 w-full overflow-y-auto custom-scrollbar pb-10 px-2 sm:px-3">
        <div className="flex-1 min-w-0 flex flex-col gap-2">

          <div className="lg:hidden flex flex-col gap-3 mb-4">
            <div className={`grid ${editalSelecionado ? 'grid-cols-2' : 'grid-cols-1'} gap-3`}>
              {editalSelecionado && <EditalMiniCard editalSelecionado={editalSelecionado} />}
              <StatsMiniCard stats={stats} />
            </div>
          </div>

          {/* ── BARRA DE AÇÕES MOBILE ─────────────────────────────────────── */}
          <div className="lg:hidden flex flex-col gap-3 mb-6">

            {/* Linha principal: Filtrar (menor) | + Extra | Marcar Todas */}
            <div className="flex items-center gap-2 h-[46px]">

              {/* Input filtro: menor, não cresce demais */}
              {!modoManual && (
                <div className="relative w-[110px] shrink-0 h-full group">
                  <input
                    type="text"
                    value={busca}
                    onChange={e => setBusca(e.target.value)}
                    placeholder="Filtrar..."
                    className="w-full h-full px-5 bg-white dark:bg-zinc-900 border-2 border-zinc-200 dark:border-zinc-800 rounded-2xl text-xs font-bold text-zinc-900 dark:text-white placeholder:text-zinc-400 focus:border-red-500 outline-none transition-all shadow-sm"
                  />
                  {busca && (
                    <button onClick={() => setBusca('')} className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-zinc-400 hover:text-red-500 rounded-lg">
                      <X size={12} />
                    </button>
                  )}
                </div>
              )}

              {/* Botão Nova / Extra — somente ícone quando cancelar, texto limpo sem + duplo */}
              <button
                onClick={() => setIsAddingMobile(!isAddingMobile)}
                className={`flex-1 h-full px-3 rounded-2xl flex items-center justify-center gap-1.5 font-bold text-xs transition-all shadow-sm border-2 ${isAddingMobile
                  ? 'bg-zinc-900 text-white border-zinc-900 dark:bg-white dark:text-zinc-900 dark:border-white'
                  : 'bg-red-50 text-red-600 border-red-200 dark:bg-red-900/20 dark:border-red-900/50 dark:text-red-400'
                }`}
              >
                <Plus size={15} className={`transition-transform duration-300 shrink-0 ${isAddingMobile ? 'rotate-45' : ''}`} />
                <span>{isAddingMobile ? 'Cancelar' : modoManual ? 'Nova' : 'Extra'}</span>
              </button>

              {/* Botão Marcar/Limpar Tudo — flex-1 também, com texto completo */}
              {!modoManual && (
                <button
                  onClick={handleToggleTodos}
                  className={`flex-1 h-full px-3 rounded-2xl flex items-center justify-center gap-1.5 font-bold text-xs transition-all shadow-sm border-2 ${todasSelecionadas
                    ? 'bg-red-50 border-red-200 text-red-600 dark:bg-red-900/20 dark:border-red-900/50 dark:text-red-400'
                    : 'bg-white border-zinc-200 text-zinc-700 dark:bg-zinc-900 dark:border-zinc-800 dark:text-zinc-300'
                  }`}
                >
                  {todasSelecionadas
                    ? <><Square size={14} className="shrink-0" /><span>Limpar tudo</span></>
                    : <><CheckSquare size={14} className="shrink-0" /><span>Marcar tudo</span></>
                  }
                </button>
              )}
            </div>

            {/* Campo expandível para adicionar disciplina */}
            <AnimatePresence>
              {isAddingMobile && (
                <motion.form
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden"
                  onSubmit={adicionarDisciplina}
                >
                  <div className="flex items-center gap-2 pt-1">
                    <input
                      value={nomeNova}
                      onChange={e => setNomeNova(e.target.value)}
                      placeholder={modoManual ? "Nome da disciplina..." : "Nome da disciplina extra..."}
                      autoFocus
                      className="flex-1 py-3 px-4 bg-white dark:bg-zinc-900 border-2 border-red-200 dark:border-red-900/50 rounded-2xl text-sm font-bold text-zinc-900 dark:text-white outline-none focus:border-red-500 shadow-sm"
                    />
                    <button
                      type="submit"
                      disabled={!nomeNova.trim()}
                      className="px-5 py-3 rounded-2xl bg-red-600 text-white font-bold text-sm hover:bg-red-700 disabled:opacity-50 transition-all shadow-sm shrink-0"
                    >
                      Criar
                    </button>
                  </div>
                </motion.form>
              )}
            </AnimatePresence>
          </div>
          {/* ── FIM BARRA MOBILE ──────────────────────────────────────────── */}

          <div className="hidden lg:block">
            <FormAdicionarDisciplina valor={nomeNova} setValor={setNomeNova} onSubmit={adicionarDisciplina} modoManual={modoManual} />
            {!modoManual && (
              <div className="flex flex-col md:flex-row gap-3 items-center mb-6">
                <div className="relative w-full md:flex-1 group">
                  <input type="text" value={busca} onChange={e => setBusca(e.target.value)} placeholder="Filtrar disciplinas..." className="w-full px-5 py-3.5 bg-white dark:bg-zinc-900 border-2 border-zinc-200 dark:border-zinc-800 rounded-2xl text-sm font-bold text-zinc-900 dark:text-white placeholder:text-zinc-400 focus:border-red-500 outline-none transition-all shadow-sm" />
                  {busca && <button onClick={() => setBusca('')} className="absolute right-3.5 top-1/2 -translate-y-1/2 p-1.5 text-zinc-400 hover:text-red-600 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-all"><X size={14} /></button>}
                </div>
                <div className="w-full md:w-auto shrink-0">
                  <button onClick={handleToggleTodos} className={`w-full md:w-auto flex items-center justify-center gap-2 px-6 py-3.5 rounded-2xl text-sm font-bold transition-all shadow-sm border-2 ${todasSelecionadas ? 'bg-red-50 border-red-200 text-red-600 hover:bg-red-100 dark:bg-red-900/20 dark:border-red-900/50 dark:text-red-400 dark:hover:bg-red-900/40' : 'bg-white border-zinc-200 text-zinc-700 hover:border-zinc-900 hover:text-zinc-900 dark:bg-zinc-900 dark:border-zinc-800 dark:text-zinc-300 dark:hover:border-zinc-100 dark:hover:text-white'}`}>
                    {todasSelecionadas ? (<><Square size={16} /> Limpar Tudo</>) : (<><CheckSquare size={16} /> Marcar Tudo</>)}
                  </button>
                </div>
              </div>
            )}
          </div>

          <div>
            {stats.discMarcadas === 0 && (
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="mb-6 p-4 rounded-3xl bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/40 flex flex-col sm:flex-row items-center gap-3 text-center sm:text-left"
              >
                <div className="w-10 h-10 rounded-2xl bg-red-100 dark:bg-red-900/50 flex items-center justify-center shrink-0">
                  <AlertTriangle className="text-red-600 dark:text-red-400" size={20} />
                </div>
                <div>
                  <h4 className="text-sm font-black text-red-900 dark:text-red-300 uppercase tracking-tight">Nenhuma disciplina selecionada</h4>
                  <p className="text-xs text-red-700/70 dark:text-red-400/70 font-medium">Você precisa selecionar pelo menos uma matéria e definir seu nível para avançar.</p>
                </div>
              </motion.div>
            )}

            {(modoManual && disciplinas.length === 0) ? (
              <div className="py-20 border-2 border-dashed border-zinc-200 dark:border-zinc-800 rounded-3xl bg-zinc-50/50 flex flex-col items-center">
                <Layers size={48} className="text-zinc-300 mb-4" />
                <p className="text-lg font-bold text-zinc-600">Seu cronograma está vazio</p>
              </div>
            ) : (
              <>
                {extraDisciplinas.map(disc => (
                  <DisciplinaCard key={disc.id} disciplina={disc} isExpanded={expandedId === disc.id} onToggleExpand={() => setExpandedId(expandedId === disc.id ? null : disc.id)} isExtra={true} estadoDisc={selecao[disc.id]} onToggleDisc={() => handleToggleDisc(disc)} onToggleAssunto={idx => handleToggleAssunto(disc, idx)} onRemover={(id) => remover(id, true)} onEditar={(id, novo) => editar(id, novo, true)} onAdicionarAssunto={adicionarAssunto} onRemoverAssunto={(dId, idx) => removerAssunto(dId, idx, true)} onEditarAssunto={(dId, idx, novo) => editarAssunto(dId, idx, novo, true)} onNivelChange={handleNivelChange} />
                ))}
                {discFiltradas.map(disc => (
                  <DisciplinaCard key={disc.id} disciplina={disc} isExpanded={expandedId === disc.id} onToggleExpand={() => setExpandedId(expandedId === disc.id ? null : disc.id)} isExtra={false} estadoDisc={selecao[disc.id]} onToggleDisc={() => handleToggleDisc(disc)} onToggleAssunto={idx => handleToggleAssunto(disc, idx)} onRemover={modoManual ? ((id) => remover(id, false)) : undefined} onEditar={(id, novo) => editar(id, novo, false)} onAdicionarAssunto={adicionarAssunto} onRemoverAssunto={(dId, idx) => removerAssunto(dId, idx, false)} onEditarAssunto={(dId, idx, novo) => editarAssunto(dId, idx, novo, false)} onNivelChange={handleNivelChange} />
                ))}
              </>
            )}
          </div>
        </div>

        <div className="hidden lg:flex flex-col w-[320px] shrink-0 gap-5 sticky top-6 self-start">
          {editalSelecionado && <EditalSidebarCard editalSelecionado={editalSelecionado} />}
          <StatsSidebarCard stats={stats} />
        </div>
      </div>
    </div>
  );
};

const BarStat = ({ label, marcado, total, cor }) => (
  <div>
    <div className="flex justify-between items-end mb-2">
      <span className="text-sm font-bold text-zinc-500">{label}</span>
      <span className="text-lg font-black text-zinc-900 dark:text-white">{marcado} <span className="text-sm text-zinc-400">/ {total}</span></span>
    </div>
    <div className="h-2 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
      <motion.div className={`h-full ${cor} rounded-full`} animate={{ width: total > 0 ? `${Math.round((marcado / total) * 100)}%` : '0%' }} transition={{ duration: 0.5 }} />
    </div>
  </div>
);

const Step2_Disciplinas = (props) => {
  return <ModoGeral {...props} />;
};

export default Step2_Disciplinas;
