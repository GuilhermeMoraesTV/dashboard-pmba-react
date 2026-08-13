import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  BookOpen, CalendarCheck2, Check, X, HelpCircle, Square, MinusSquare,
  CheckSquare, Layers, Tag, Sparkles, Target,
  Plus, Trash2, Edit2, AlertTriangle, Brain, Scale
} from 'lucide-react';
import { normalizePlanningLevel } from '../../utils/planningPriority';

// ══════════════════════════════════════════════════════════════════════════════
//  CABEÇALHO DA PÁGINA
// ══════════════════════════════════════════════════════════════════════════════
const PageHeader = ({ modoManual }) => (
  <motion.div
    initial={{ opacity: 0, y: -12 }}
    animate={{ opacity: 1, y: 0 }}
    className="text-center mb-8 max-w-2xl mx-auto px-4"
  >
    <h2 className="text-4xl sm:text-4xl font-black text-zinc-900 dark:text-white uppercase tracking-tighter leading-[0.95] mb-3">
      O que você vai<br />
      <span className="text-red-600">estudar?</span>
    </h2>
    <p className="text-zinc-500 dark:text-zinc-400 text-base sm:text-sm font-semibold leading-relaxed max-w-md mx-auto">
      {modoManual
        ? "Monte sua lista, escolha as disciplinas que entram no plano e informe conhecimento e importância para orientar a distribuição."
        : "Clique nos cards para escolher as disciplinas do plano. Depois ajuste conhecimento e importância para equilibrar ordem, peso e prioridade de estudo."}
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
    <div className="relative z-10 w-28 h-28 shrink-0 rounded-2xl bg-white dark:bg-zinc-800 border-2 border-red-100 dark:border-red-900/30 flex items-center justify-center p-2 mb-4 shadow-lg shadow-red-500/20">
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
    <div className="w-16 h-16 shrink-0 rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-100 dark:border-zinc-700 flex items-center justify-center p-1 mb-2 z-10">
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
const LEVEL_BAR_LABELS = {
  1: 'Muito baixo',
  2: 'Baixo',
  3: 'Médio',
  4: 'Alto',
  5: 'Muito alto',
};

const LEVEL_HELP = {
  conhecimento: 'Conhecimento mostra quanto você já domina a disciplina. Quanto menor, maior a necessidade de reforço.',
  importancia: 'Importância mostra o peso da disciplina no edital. Quanto maior, mais o planejamento prioriza essa matéria.',
};

const LEVEL_COLORS = {
  conhecimento: {
    1: '#ef4444',
    2: '#f97316',
    3: '#eab308',
    4: '#0ea5e9',
    5: '#10b981',
  },
  importancia: {
    1: '#71717a',
    2: '#0ea5e9',
    3: '#eab308',
    4: '#f97316',
    5: '#ef4444',
  },
};

const PlanningLevelSelector = ({
  conhecimentoNivel,
  importanciaNivel,
  onConhecimentoChange,
  onImportanciaChange,
  isFaltando,
  canToggleTodosDias = false,
  todosDiasAtivo = false,
  onToggleTodosDias,
  labelDiasAtivos = '',
}) => {
  const [activeControl, setActiveControl] = useState(null);
  const [activeHelp, setActiveHelp] = useState(null);

  return (
    <div className="mt-2 w-full border-t border-zinc-100 pt-2 dark:border-zinc-800/60" onClick={(e) => e.stopPropagation()}>
      {(isFaltando || canToggleTodosDias) && (
      <div className={`mb-2 grid w-full gap-1.5 ${isFaltando && canToggleTodosDias ? 'grid-cols-2' : 'grid-cols-1'}`}>
        {isFaltando && (
        <span className={`inline-flex min-w-0 items-center justify-center gap-1 rounded-md px-2 py-1 text-center font-black uppercase tracking-wider leading-tight ${isFaltando ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400' : 'text-zinc-400 dark:text-zinc-500'}`}>
          <span className="shrink-0">
            {isFaltando ? <AlertTriangle size={12} /> : <Target size={12} />}
          </span>
          <span className="min-w-0 whitespace-normal break-words text-[8px]">
            {isFaltando ? 'Preencha os dois niveis' : 'Prioridade 50/50'}
          </span>
        </span>
        )}
        {canToggleTodosDias && (
          <label
            title={`Estudar esta disciplina todos os dias ativos${labelDiasAtivos}`}
            className={`inline-flex min-w-0 cursor-pointer select-none items-center justify-center gap-1 rounded-md border px-2 py-1 text-center font-black uppercase tracking-wider leading-tight transition-all ${
              todosDiasAtivo
                ? 'border-emerald-400 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/25 dark:text-emerald-300'
                : 'border-zinc-200 bg-white text-zinc-500 hover:border-emerald-300 hover:text-emerald-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400'
            }`}
          >
            <input
              type="checkbox"
              checked={todosDiasAtivo}
              onChange={onToggleTodosDias}
              className="sr-only"
            />
            <CalendarCheck2 size={12} strokeWidth={3} className="shrink-0" />
            <span className="min-w-0 whitespace-normal break-words text-[8px]">Estudar todo dia</span>
            <span className={`relative h-4 w-7 shrink-0 rounded-full transition-colors ${todosDiasAtivo ? 'bg-emerald-600' : 'bg-zinc-300 dark:bg-zinc-700'}`}>
              <span className={`absolute top-0.5 h-3 w-3 rounded-full bg-white shadow-sm transition-all ${todosDiasAtivo ? 'right-0.5' : 'left-0.5'}`} />
            </span>
          </label>
        )}
      </div>
      )}

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
      {[
        { key: 'conhecimento', label: 'Conhecimento', icon: Brain, value: conhecimentoNivel, onChange: onConhecimentoChange, help: LEVEL_HELP.conhecimento },
        { key: 'importancia', label: 'Importância no edital', icon: Scale, value: importanciaNivel, onChange: onImportanciaChange, help: LEVEL_HELP.importancia },
      ].map((control) => {
        const Icon = control.icon;
        const percent = control.value ? ((control.value - 1) / 4) * 100 : 0;
        const levelColor = LEVEL_COLORS[control.key]?.[control.value || 1] || '#71717a';
        return (
          <div
            key={control.key}
            className="relative min-w-0 rounded-lg px-2 py-1.5 transition-colors"
            style={{ '--planning-level-color': levelColor }}
          >
            <div className="mb-0.5 flex items-center justify-between gap-2">
              <span className="flex min-w-0 items-center gap-1 text-[10px] font-black uppercase tracking-wider text-zinc-500 dark:text-zinc-400 sm:text-[11px]">
                <Icon size={13} style={{ color: levelColor }} /> {control.label}
                <button
                  type="button"
                  title={control.help}
                  aria-label={`Explicar ${control.label}`}
                  aria-expanded={activeHelp === control.key}
                  onClick={() => setActiveHelp((current) => current === control.key ? null : control.key)}
                  className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
                >
                  <HelpCircle size={12} />
                </button>
              </span>
              <motion.span
                key={`${control.key}-${control.value || 0}`}
                initial={{ opacity: 0, y: 2 }}
                animate={{ opacity: 1, y: 0, scale: activeControl === control.key ? 1.04 : 1 }}
                className="shrink-0 rounded-md px-1.5 py-0.5 text-[9px] font-black text-white shadow-sm sm:text-[10px]"
                style={{ backgroundColor: levelColor }}
              >
                {control.value ? LEVEL_BAR_LABELS[control.value] : 'Não definido'}
              </motion.span>
            </div>
            <AnimatePresence initial={false}>
              {activeHelp === control.key && (
                <motion.p
                  initial={{ opacity: 0, height: 0, y: -3 }}
                  animate={{ opacity: 1, height: 'auto', y: 0 }}
                  exit={{ opacity: 0, height: 0, y: -3 }}
                  className="mb-1 overflow-hidden rounded-md bg-zinc-100 px-2 py-1.5 text-[11px] font-semibold leading-snug text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300"
                >
                  {control.help}
                </motion.p>
              )}
            </AnimatePresence>
            <div className="relative flex h-6 items-center">
              <div className="absolute inset-x-0 h-1.5 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800">
                <div
                  className="h-full rounded-full transition-all"
                  style={{ width: `${percent}%`, backgroundColor: levelColor }}
                />
              </div>
              <input
                type="range"
                min="1"
                max="5"
                step="1"
                value={control.value || 1}
                title={control.value ? LEVEL_BAR_LABELS[control.value] : 'Selecione um nível'}
                aria-label={control.label}
                onPointerDown={() => setActiveControl(control.key)}
                onPointerUp={() => setActiveControl(null)}
                onPointerCancel={() => setActiveControl(null)}
                onFocus={() => setActiveControl(control.key)}
                onBlur={() => setActiveControl(null)}
                onChange={(event) => control.onChange(Number(event.target.value))}
                className="planning-level-range absolute inset-x-0 z-10 m-0 h-6 w-full cursor-pointer bg-transparent"
              />
            </div>
          </div>
        );
      })}
      </div>
    </div>
  );
};


// ══════════════════════════════════════════════════════════════════════════════
//  LISTAGEM DE ASSUNTOS E CARD DE DISCIPLINA
// ══════════════════════════════════════════════════════════════════════════════
const AssuntoItem = ({ assunto, checked, onToggle }) => {
  return (
    <motion.button type="button" layout initial={{ opacity: 0, y: -3 }} animate={{ opacity: 1, y: 0 }} className="flex w-full items-center gap-3 border-b border-zinc-100 px-1 py-2.5 text-left last:border-b-0 dark:border-zinc-800" onClick={() => onToggle?.()}>
      <span className={`min-w-0 flex-1 break-words text-sm font-medium leading-snug ${checked ? 'text-zinc-950 dark:text-white' : 'text-zinc-600 dark:text-zinc-400'}`}>{assunto}</span>
      <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md border transition-colors ${checked ? 'border-emerald-500 bg-emerald-500 text-white' : 'border-zinc-300 bg-white text-transparent dark:border-zinc-700 dark:bg-zinc-900'}`}>
        <Check size={14} strokeWidth={3} />
      </span>
    </motion.button>
  );
};


const DisciplinaCard = ({
  disciplina, isExpanded, onToggleExpand, estadoDisc, onToggleDisc, onToggleAssunto,
  onRemover, onEditar, onAdicionarAssunto, onRemoverAssunto, onEditarAssunto,
  onConhecimentoChange, onImportanciaChange, isExtra = false,
  canToggleTodosDias = false, todosDiasAtivo = false, onToggleTodosDias, activeStudyDaysCount = 0,
}) => {
  const [editandoNome, setEditandoNome] = useState(false);
  const [nomeTemp, setNomeTemp] = useState(disciplina.nome);

  const confirmarNome = () => { const t = nomeTemp.trim(); if (t && t !== disciplina.nome) onEditar?.(disciplina.id, { ...disciplina, nome: t }); setEditandoNome(false); };

  const discChecked = estadoDisc?.checked ?? false;
  const parcial = estadoDisc?.parcial ?? false;
  const assuntosMarcados = estadoDisc?.assuntosMarcados ?? new Set();
  const conhecimentoNivel = normalizePlanningLevel(estadoDisc?.conhecimentoNivel);
  const importanciaNivel = normalizePlanningLevel(estadoDisc?.importanciaNivel);

  const totalAssuntos = disciplina.assuntos.length;
  const qtdMarcados = assuntosMarcados.size;
  const corBarra = discChecked ? 100 : totalAssuntos > 0 ? Math.round((qtdMarcados / totalAssuntos) * 100) : 0;

  const isAtivo = discChecked || parcial;
  const isFaltandoNivel = isAtivo && (!conhecimentoNivel || !importanciaNivel);
  const labelDiasAtivos = activeStudyDaysCount ? ` (${activeStudyDaysCount} dias)` : '';

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className={`relative overflow-hidden rounded-xl border transition-all duration-300 group ${isFaltandoNivel
        ? 'border-amber-300 bg-amber-50/30 shadow-sm dark:border-amber-800/60 dark:bg-card-dark'
        : isAtivo
        ? 'border-emerald-400/80 bg-emerald-50/35 shadow-sm dark:border-emerald-800/70 dark:bg-card-dark'
        : 'border-zinc-200 bg-zinc-50/90 dark:border-zinc-700 dark:bg-card-dark hover:border-zinc-300 dark:hover:border-zinc-600 hover:bg-white dark:hover:bg-zinc-800'
      }`}
    >
      <div className="px-3.5 py-3.5 sm:px-5 sm:py-4">
        <div className="flex gap-3 cursor-pointer select-none" onClick={() => !editandoNome && onToggleDisc()}>
          <div className="flex-1 min-w-0 z-10 flex flex-col justify-center">
            {editandoNome ? (
              <input value={nomeTemp} onChange={e => setNomeTemp(e.target.value)} onBlur={confirmarNome} onKeyDown={e => { if (e.key === 'Enter') confirmarNome(); if (e.key === 'Escape') setEditandoNome(false); }} autoFocus onClick={e => e.stopPropagation()} className="w-full text-sm sm:text-base font-bold bg-zinc-50 dark:bg-zinc-800 border-2 border-red-400 rounded-lg px-3 py-1 outline-none text-zinc-900 dark:text-white" />
            ) : (
              <div className="flex flex-wrap items-center gap-2">
                <h4 className={`min-w-0 break-words text-base font-black leading-tight tracking-tight transition-colors sm:text-lg ${isAtivo ? 'text-zinc-950 dark:text-white' : 'text-zinc-600 dark:text-zinc-400'}`}>
                  {disciplina.nome}
                </h4>
                {isExtra && (
                  <span className="shrink-0 text-[9px] font-black px-2 py-0.5 rounded-md bg-zinc-100 dark:bg-zinc-800 text-zinc-500 uppercase tracking-widest mt-0.5">Extra</span>
                )}
              </div>
            )}

            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
              <span className="text-sm font-semibold text-zinc-400">{totalAssuntos} {totalAssuntos === 1 ? 'tópico' : 'tópicos'}</span>
              {parcial && <><span className="w-1 h-1 rounded-full bg-zinc-300 dark:bg-zinc-600" /><MinusSquare size={12} className="text-orange-500" /></>}
              {qtdMarcados > 0 && !discChecked && (
                <><span className="w-1 h-1 rounded-full bg-zinc-300 dark:bg-zinc-600" /><span className="text-xs font-bold text-orange-500">{qtdMarcados} selecionados</span></>
              )}
            </div>
          </div>

          <div className="z-10 flex max-w-[174px] shrink-0 items-start gap-0.5">
            <button
              type="button"
              onClick={(event) => { event.stopPropagation(); onToggleExpand(); }}
              className="inline-flex min-w-0 items-center gap-1 rounded-lg px-1.5 py-2 text-[9px] font-black uppercase tracking-normal text-zinc-500 transition-all hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-white sm:px-2.5 sm:text-[10px] sm:tracking-wide"
            >
              <BookOpen size={14} />
              <span>Ver assuntos</span>
            </button>
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
              <PlanningLevelSelector
                conhecimentoNivel={conhecimentoNivel}
                importanciaNivel={importanciaNivel}
                onConhecimentoChange={(nivel) => onConhecimentoChange(disciplina.id, nivel)}
                onImportanciaChange={(nivel) => onImportanciaChange(disciplina.id, nivel)}
                isFaltando={isFaltandoNivel}
                canToggleTodosDias={canToggleTodosDias}
                todosDiasAtivo={todosDiasAtivo}
                onToggleTodosDias={() => onToggleTodosDias?.(disciplina.id)}
                labelDiasAtivos={labelDiasAtivos}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {totalAssuntos > 0 && (
        <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-zinc-100 dark:bg-zinc-800 overflow-hidden rounded-b-xl">
          <motion.div
            className={`h-full ${discChecked ? 'bg-emerald-500' : 'bg-orange-400'}`}
            initial={{ width: 0 }}
            animate={{ width: `${corBarra}%` }}
            transition={{ duration: 0.5, ease: "easeOut" }}
          />
        </div>
      )}

    </motion.div>
  );
};

const AssuntosModal = ({
  disciplina,
  estadoDisc,
  onClose,
  onToggleDisc,
  onToggleAssunto,
  onAdicionarAssunto,
}) => {
  const [creating, setCreating] = useState(false);
  const [novoAssunto, setNovoAssunto] = useState('');
  if (!disciplina) return null;

  const assuntos = Array.isArray(disciplina.assuntos) ? disciplina.assuntos : [];
  const assuntosMarcados = estadoDisc?.assuntosMarcados ?? new Set();
  const discChecked = estadoDisc?.checked ?? false;
  const handleCreate = (event) => {
    event.preventDefault();
    const value = novoAssunto.trim();
    if (!value) return;
    onAdicionarAssunto?.(disciplina.id, value);
    setNovoAssunto('');
    setCreating(false);
  };
  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-[100060] flex items-center justify-center bg-zinc-950/55 px-3 py-4 backdrop-blur-sm sm:px-6"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, y: 24, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 16, scale: 0.98 }}
          transition={{ type: 'spring', stiffness: 420, damping: 34 }}
          onClick={(event) => event.stopPropagation()}
          className="flex max-h-[86vh] w-full max-w-xl flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-2xl dark:border-zinc-800 dark:bg-card-dark"
        >
          <div className="border-b border-zinc-100 px-4 py-4 dark:border-zinc-800 sm:px-5">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
              <p className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-emerald-600 dark:text-emerald-400">
                <Tag size={12} /> Assuntos da disciplina
              </p>
              <h3 className="mt-1 break-words text-lg font-black text-zinc-950 dark:text-white sm:text-xl">
                {disciplina.nome}
              </h3>
              <p className="mt-1 text-xs font-semibold text-zinc-500 dark:text-zinc-400">
                Marque os assuntos que entram no planejamento.
              </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-zinc-100 text-zinc-500 transition-colors hover:bg-zinc-200 hover:text-zinc-900 dark:bg-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-white"
                aria-label="Fechar assuntos"
              >
                <X size={17} />
              </button>
            </div>
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
              <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">
                {assuntosMarcados.size}/{assuntos.length} selecionados
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setCreating((value) => !value)}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-zinc-100 px-2.5 py-1.5 text-[10px] font-black uppercase tracking-wide text-zinc-600 transition-colors hover:bg-zinc-200 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
                >
                  <Plus size={13} /> Novo assunto
                </button>
                {assuntos.length > 0 && (
                  <button
                    type="button"
                    onClick={onToggleDisc}
                    className={`rounded-lg px-2.5 py-1.5 text-[10px] font-black uppercase tracking-wide transition-colors ${discChecked ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-950/30 dark:text-emerald-300' : 'text-zinc-500 hover:bg-emerald-50 hover:text-emerald-700 dark:hover:bg-emerald-950/20'}`}
                  >
                    {discChecked ? 'Desmarcar todos' : 'Marcar todos'}
                  </button>
                )}
              </div>
            </div>
            <AnimatePresence>
              {creating && (
                <motion.form
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  onSubmit={handleCreate}
                  className="mt-2 flex overflow-hidden"
                >
                  <input
                    value={novoAssunto}
                    onChange={(event) => setNovoAssunto(event.target.value)}
                    placeholder="Nome do novo assunto"
                    autoFocus
                    className="min-w-0 flex-1 rounded-l-lg border border-zinc-200 bg-white px-3 py-2 text-sm font-medium text-zinc-900 outline-none focus:border-emerald-400 dark:border-zinc-700 dark:bg-zinc-900 dark:text-white"
                  />
                  <button type="submit" disabled={!novoAssunto.trim()} className="rounded-r-lg bg-emerald-600 px-3 text-[10px] font-black uppercase text-white disabled:opacity-40">
                    Criar
                  </button>
                </motion.form>
              )}
            </AnimatePresence>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 custom-scrollbar sm:px-5">
            <div className="flex flex-col">
              {assuntos.length > 0 ? (
                assuntos.map((assunto, idx) => (
                  <AssuntoItem
                    key={`${assunto}-${idx}`}
                    assunto={assunto}
                    checked={assuntosMarcados.has(idx)}
                    onToggle={() => onToggleAssunto?.(idx)}
                  />
                ))
              ) : (
                <div className="rounded-xl border border-dashed border-zinc-200 bg-zinc-50 px-4 py-8 text-center dark:border-zinc-700 dark:bg-card-dark">
                  <p className="text-sm font-semibold text-zinc-500">Nenhum tópico cadastrado.</p>
                </div>
              )}
            </div>
          </div>

        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

// ══════════════════════════════════════════════════════════════════════════════
//  COMPONENTE PRINCIPAL MODO GERAL
// ══════════════════════════════════════════════════════════════════════════════
const ModoGeral = ({
  disciplinas,
  selecao,
  onSelecaoChange,
  onDisciplinasChange,
  extraDisciplinas = [],
  onExtraDisciplinasChange = () => {},
  editalSelecionado,
  modoManual,
  disciplinaTodosDiasId = null,
  disciplinaTodosDiasIds = [],
  onDisciplinaTodosDiasChange = null,
  activeStudyDaysCount = 0,
}) => {
  const [nomeNova, setNomeNova] = useState('');
  const [assuntosModal, setAssuntosModal] = useState(null);
  const [isAdding, setIsAdding] = useState(false);

  const getSelecaoPadrao = () => ({
    checked: false,
    parcial: false,
    assuntosMarcados: new Set(),
    conhecimentoNivel: 0,
    importanciaNivel: 0,
  });

  const adicionarDisciplina = (e) => {
    e.preventDefault(); const nome = nomeNova.trim(); if (!nome) return;
    const novoId = modoManual ? `m-${Date.now()}` : `extra-${Date.now()}`;
    if (modoManual) onDisciplinasChange([{ id: novoId, nome, assuntos: [] }, ...disciplinas]);
    else onExtraDisciplinasChange([{ id: novoId, nome, assuntos: [] }, ...extraDisciplinas]);
    onSelecaoChange({ ...selecao, [novoId]: getSelecaoPadrao() });
    setNomeNova(''); setIsAdding(false);
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

  const handlePlanningLevelChange = (discId, field, nivel) => {
    const atual = selecao[discId] || getSelecaoPadrao();
    onSelecaoChange({ ...selecao, [discId]: { ...atual, [field]: normalizePlanningLevel(nivel) } });
  };

  const handleSelecionarTodos = () => {
    const novo = {};
    [...disciplinas, ...extraDisciplinas].forEach((d) => {
      novo[d.id] = {
        checked: true,
        parcial: false,
        assuntosMarcados: new Set(d.assuntos.map((_, i) => i)),
        conhecimentoNivel: normalizePlanningLevel(selecao[d.id]?.conhecimentoNivel),
        importanciaNivel: normalizePlanningLevel(selecao[d.id]?.importanciaNivel),
      };
    });
    onSelecaoChange(novo);
  };

  const handleLimparTodos = () => {
    const novo = {};
    [...disciplinas, ...extraDisciplinas].forEach((d) => {
      novo[d.id] = {
        ...getSelecaoPadrao(),
        conhecimentoNivel: normalizePlanningLevel(selecao[d.id]?.conhecimentoNivel),
        importanciaNivel: normalizePlanningLevel(selecao[d.id]?.importanciaNivel),
      };
    });
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

  const stats = useMemo(() => {
    const totalDisc = disciplinas.length + extraDisciplinas.length;
    const discMarcadas = Object.values(selecao).filter(s => s?.checked || s?.parcial).length;
    const totalTopicos = disciplinas.reduce((a, d) => a + d.assuntos.length, 0) + extraDisciplinas.reduce((a, d) => a + d.assuntos.length, 0);
    const topicosMarcados = disciplinas.reduce((acc, d) => acc + (selecao[d.id]?.assuntosMarcados?.size || 0), 0) + extraDisciplinas.reduce((acc, d) => acc + (selecao[d.id]?.assuntosMarcados?.size || 0), 0);
    return { totalDisc, discMarcadas, totalTopicos, topicosMarcados };
  }, [disciplinas, extraDisciplinas, selecao]);

  const todasSelecionadas = disciplinas.length > 0 && disciplinas.every(d => selecao[d.id]?.checked) && (extraDisciplinas.length === 0 || extraDisciplinas.every(d => selecao[d.id]?.checked));
  const handleToggleTodos = () => { if (todasSelecionadas) handleLimparTodos(); else handleSelecionarTodos(); };
  const mostrarPreferenciaDiaria = typeof onDisciplinaTodosDiasChange === 'function';
  const idsTodosDias = useMemo(() => {
    const ids = Array.isArray(disciplinaTodosDiasIds)
      ? disciplinaTodosDiasIds
      : (disciplinaTodosDiasId ? [disciplinaTodosDiasId] : []);
    return [...new Set(ids.filter(Boolean).map(String))];
  }, [disciplinaTodosDiasId, disciplinaTodosDiasIds]);
  const toggleDisciplinaTodosDias = (disciplinaId) => {
    const id = String(disciplinaId);
    const active = idsTodosDias.includes(id);
    const next = active
      ? idsTodosDias.filter((item) => item !== id)
      : [...idsTodosDias, id];
    onDisciplinaTodosDiasChange(next);
  };
  const abrirAssuntosModal = (disciplina, isExtra = false) => {
    setAssuntosModal({ id: disciplina.id, isExtra });
  };
  const disciplinaModal = useMemo(() => {
    if (!assuntosModal?.id) return null;
    const source = assuntosModal.isExtra ? extraDisciplinas : disciplinas;
    return source.find((disciplina) => String(disciplina.id) === String(assuntosModal.id)) || null;
  }, [assuntosModal, disciplinas, extraDisciplinas]);

  return (
    <div className="flex flex-col h-full w-full">
      <PageHeader modoManual={modoManual} />
      <div className="flex w-full flex-col gap-5 overflow-y-auto px-1 pb-10 custom-scrollbar sm:px-2 lg:flex-row lg:gap-5 xl:px-2">
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
              {/* Botão Nova / Extra — somente ícone quando cancelar, texto limpo sem + duplo */}
              <button
                onClick={() => setIsAdding(!isAdding)}
                className={`flex-1 h-full px-3 rounded-2xl flex items-center justify-center gap-1.5 font-bold text-xs transition-all shadow-sm border-2 ${isAdding
                  ? 'bg-zinc-900 text-white border-zinc-900 dark:bg-white dark:text-zinc-900 dark:border-white'
                  : 'bg-red-50 text-red-600 border-red-200 dark:bg-red-900/20 dark:border-red-900/50 dark:text-red-400'
                }`}
              >
                <Plus size={15} className={`transition-transform duration-300 shrink-0 ${isAdding ? 'rotate-45' : ''}`} />
                <span>{isAdding ? 'Cancelar' : 'Nova disciplina'}</span>
              </button>

              {/* Botão Marcar/Limpar Tudo — flex-1 também, com texto completo */}
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
            </div>

            {/* Campo expandível para adicionar disciplina */}
            <AnimatePresence>
              {isAdding && (
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

          <div className="hidden lg:flex flex-col items-end gap-3 mb-6">
            <div className="flex items-center gap-3">
              <button onClick={() => setIsAdding(!isAdding)} className="flex items-center justify-center gap-2 px-5 py-3 rounded-xl text-sm font-bold bg-red-600 text-white hover:bg-red-700 transition-colors shadow-sm">
                <Plus size={16} /> Nova disciplina
              </button>
              <button onClick={handleToggleTodos} className={`flex items-center justify-center gap-2 px-5 py-3 rounded-xl text-sm font-bold transition-all shadow-sm border-2 ${todasSelecionadas ? 'bg-red-50 border-red-200 text-red-600 dark:bg-red-900/20 dark:border-red-900/50 dark:text-red-400' : 'bg-white border-zinc-200 text-zinc-700 hover:border-zinc-900 dark:bg-zinc-900 dark:border-zinc-800 dark:text-zinc-300'}`}>
                {todasSelecionadas ? (<><Square size={16} /> Limpar tudo</>) : (<><CheckSquare size={16} /> Marcar tudo</>)}
              </button>
            </div>
            <AnimatePresence>
              {isAdding && (
                <motion.form initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} onSubmit={adicionarDisciplina} className="w-full overflow-hidden">
                  <div className="flex items-center gap-2 pt-1">
                    <input value={nomeNova} onChange={e => setNomeNova(e.target.value)} placeholder="Nome da disciplina..." autoFocus className="flex-1 py-3 px-4 bg-white dark:bg-zinc-900 border-2 border-red-200 dark:border-red-900/50 rounded-xl text-sm font-bold text-zinc-900 dark:text-white outline-none focus:border-red-500" />
                    <button type="submit" disabled={!nomeNova.trim()} className="px-5 py-3 rounded-xl bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 font-bold text-sm disabled:opacity-50">Criar</button>
                  </div>
                </motion.form>
              )}
            </AnimatePresence>
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
                  <p className="text-xs text-red-700/70 dark:text-red-400/70 font-medium">Selecione pelo menos uma disciplina e defina conhecimento e importância para avançar.</p>
                </div>
              </motion.div>
            )}

            {(modoManual && disciplinas.length === 0) ? (
              <div className="py-20 border-2 border-dashed border-zinc-200 dark:border-zinc-800 rounded-3xl bg-zinc-50/50 flex flex-col items-center">
                <Layers size={48} className="text-zinc-300 mb-4" />
                <p className="text-lg font-bold text-zinc-600">Seu cronograma está vazio</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3 2xl:grid-cols-2">
                {extraDisciplinas.map(disc => (
                  <DisciplinaCard key={disc.id} disciplina={disc} isExpanded={false} onToggleExpand={() => abrirAssuntosModal(disc, true)} isExtra={true} estadoDisc={selecao[disc.id]} onToggleDisc={() => handleToggleDisc(disc)} onToggleAssunto={idx => handleToggleAssunto(disc, idx)} onRemover={(id) => remover(id, true)} onEditar={(id, novo) => editar(id, novo, true)} onAdicionarAssunto={adicionarAssunto} onRemoverAssunto={(dId, idx) => removerAssunto(dId, idx, true)} onEditarAssunto={(dId, idx, novo) => editarAssunto(dId, idx, novo, true)} onConhecimentoChange={(id, nivel) => handlePlanningLevelChange(id, 'conhecimentoNivel', nivel)} onImportanciaChange={(id, nivel) => handlePlanningLevelChange(id, 'importanciaNivel', nivel)} canToggleTodosDias={mostrarPreferenciaDiaria} todosDiasAtivo={idsTodosDias.includes(String(disc.id))} onToggleTodosDias={toggleDisciplinaTodosDias} activeStudyDaysCount={activeStudyDaysCount} />
                ))}
                {disciplinas.map(disc => (
                  <DisciplinaCard key={disc.id} disciplina={disc} isExpanded={false} onToggleExpand={() => abrirAssuntosModal(disc, false)} isExtra={false} estadoDisc={selecao[disc.id]} onToggleDisc={() => handleToggleDisc(disc)} onToggleAssunto={idx => handleToggleAssunto(disc, idx)} onRemover={modoManual ? ((id) => remover(id, false)) : undefined} onEditar={(id, novo) => editar(id, novo, false)} onAdicionarAssunto={adicionarAssunto} onRemoverAssunto={(dId, idx) => removerAssunto(dId, idx, false)} onEditarAssunto={(dId, idx, novo) => editarAssunto(dId, idx, novo, false)} onConhecimentoChange={(id, nivel) => handlePlanningLevelChange(id, 'conhecimentoNivel', nivel)} onImportanciaChange={(id, nivel) => handlePlanningLevelChange(id, 'importanciaNivel', nivel)} canToggleTodosDias={mostrarPreferenciaDiaria} todosDiasAtivo={idsTodosDias.includes(String(disc.id))} onToggleTodosDias={toggleDisciplinaTodosDias} activeStudyDaysCount={activeStudyDaysCount} />
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="sticky top-6 hidden w-[250px] shrink-0 flex-col gap-5 self-start lg:flex xl:w-[270px]">
          {editalSelecionado && <EditalSidebarCard editalSelecionado={editalSelecionado} />}
          <StatsSidebarCard stats={stats} />
        </div>
      </div>
      {disciplinaModal && (
        <AssuntosModal
          disciplina={disciplinaModal}
          estadoDisc={selecao[disciplinaModal.id]}
          onClose={() => setAssuntosModal(null)}
          onToggleDisc={() => handleToggleDisc(disciplinaModal)}
          onToggleAssunto={(idx) => handleToggleAssunto(disciplinaModal, idx)}
          onAdicionarAssunto={adicionarAssunto}
          onRemoverAssunto={(id, idx) => removerAssunto(id, idx, Boolean(assuntosModal?.isExtra))}
          onEditarAssunto={(id, idx, novo) => editarAssunto(id, idx, novo, Boolean(assuntosModal?.isExtra))}
        />
      )}
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
