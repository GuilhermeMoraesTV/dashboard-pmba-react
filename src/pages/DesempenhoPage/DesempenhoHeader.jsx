import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Clock, Target, TrendingUp, CalendarDays,
  Filter, List, Calendar, ChevronDown, CheckCircle2, XCircle,
  SlidersHorizontal
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { formatTime } from './DesempenhoPage';

// Configuração de Ranges de Tempo
const TIME_RANGES = [
  { value: '7D', label: '7D' },
  { value: '15D', label: '15D' },
  { value: '30D', label: '30D' },
  { value: 'CYCLE', label: 'Ciclo Total' }
];

// --- COMPONENTES VISUAIS INTERNOS ---
const colorMap = {
  blue:   { text: 'text-blue-500',   bgHover: 'group-hover:text-blue-500/15 dark:group-hover:text-blue-500/10', border: 'hover:border-blue-500', watermark: 'text-blue-500/10 dark:text-blue-500/5' },
  violet: { text: 'text-violet-500', bgHover: 'group-hover:text-violet-500/15 dark:group-hover:text-violet-500/10', border: 'hover:border-violet-500', watermark: 'text-violet-500/10 dark:text-violet-500/5' },
  emerald:{ text: 'text-emerald-500',bgHover: 'group-hover:text-emerald-500/15 dark:group-hover:text-emerald-500/10', border: 'hover:border-emerald-500', watermark: 'text-emerald-500/10 dark:text-emerald-500/5' },
  red:    { text: 'text-red-500',    bgHover: 'group-hover:text-red-500/15 dark:group-hover:text-red-500/10',    border: 'hover:border-red-500',    watermark: 'text-red-500/10 dark:text-red-500/5' },
};

const StatCard = ({ icon: Icon, title, value, subValue, color = 'red', className = "" }) => {
  const theme = colorMap[color] || colorMap.red;
  return (
    <div className={`relative overflow-hidden group p-3 sm:p-4 md:p-6 min-h-[90px] sm:min-h-[110px] md:min-h-[140px] flex flex-col justify-center items-start transition-all duration-500 hover:shadow-lg border-l-4 border-transparent ${theme.border} bg-white dark:bg-zinc-900 rounded-xl md:rounded-2xl shadow-sm ${className}`}>
      <div className="relative z-20 flex flex-col gap-0.5 w-full">
        <h3 className="text-[9px] sm:text-[10px] md:text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 truncate w-full">
          {title}
        </h3>
        <div className="flex flex-col gap-0.5">
          <div className="text-lg sm:text-2xl md:text-3xl lg:text-4xl font-extrabold text-zinc-900 dark:text-white tracking-tight leading-none break-all">
            {value}
          </div>
          {subValue && (
            <div className="text-[10px] sm:text-xs md:text-sm opacity-90 text-zinc-500 dark:text-zinc-400 font-medium">
              {subValue}
            </div>
          )}
        </div>
      </div>
      <div className={`absolute -bottom-3 -right-3 sm:-bottom-4 sm:-right-4 md:-bottom-6 md:-right-6 ${theme.watermark} transition-all duration-700 ease-out group-hover:scale-125 group-hover:rotate-[-10deg] ${theme.bgHover} z-10 pointer-events-none`}>
        <Icon strokeWidth={1.5} className="w-16 h-16 sm:w-24 sm:h-24 md:w-36 md:h-36" />
      </div>
    </div>
  );
};

// ── COMPACT INLINE SELECT — auto-posicionamento ────────────────────────────
const InlineSelect = ({ options, value, onChange, placeholder, disabled }) => {
  const [isOpen, setIsOpen]     = useState(false);
  const [openLeft, setOpenLeft] = useState(false);
  const ref    = useRef(null);
  const btnRef = useRef(null);

  // Fecha ao clicar fora
  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setIsOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Detecta borda antes de abrir — abre para esquerda se sobrar < 200px à direita
  const handleOpen = () => {
    if (disabled) return;
    if (!isOpen && btnRef.current) {
      const rect       = btnRef.current.getBoundingClientRect();
      const spaceRight = window.innerWidth - rect.right;
      setOpenLeft(spaceRight < 200);
    }
    setIsOpen(v => !v);
  };

  const selected = options.find(o => o.value === value);

  return (
    <div className="relative" ref={ref}>
      <button
        ref={btnRef}
        onClick={handleOpen}
        disabled={disabled}
        className={`
          flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold uppercase tracking-wide
          transition-all duration-150 select-none whitespace-nowrap
          ${disabled
            ? 'text-zinc-400 dark:text-zinc-600 cursor-not-allowed opacity-50'
            : isOpen
              ? 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400'
              : 'text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800/70 hover:text-zinc-900 dark:hover:text-white'
          }
        `}
      >
        <span className="truncate max-w-[130px] sm:max-w-[160px]">
          {selected ? selected.label : placeholder}
        </span>
        <ChevronDown
          size={11}
          strokeWidth={2.5}
          className={`flex-shrink-0 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>

      <AnimatePresence>
        {isOpen && !disabled && (
          <motion.div
            initial={{ opacity: 0, y: -4, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.97 }}
            transition={{ duration: 0.12 }}
            className={`
              absolute z-[999] top-full mt-1.5
              min-w-[180px] max-w-[min(240px,80vw)]
              bg-white dark:bg-zinc-900
              border border-zinc-200 dark:border-zinc-700/80
              rounded-xl shadow-xl shadow-black/10 dark:shadow-black/40
              overflow-hidden
              ${openLeft ? 'right-0' : 'left-0'}
            `}
          >
            <div className="p-1 max-h-60 overflow-y-auto">
              {options.map(opt => (
                <button
                  key={opt.value}
                  onClick={() => { onChange(opt.value); setIsOpen(false); }}
                  className={`
                    w-full text-left px-3 py-2 rounded-lg text-[11px] font-bold uppercase tracking-wide
                    flex items-center justify-between gap-3 transition-colors duration-100
                    ${value === opt.value
                      ? 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400'
                      : 'text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800'
                    }
                  `}
                >
                  <span className="truncate">{opt.label}</span>
                  {value === opt.value && (
                    <CheckCircle2 size={11} strokeWidth={2.5} className="flex-shrink-0" />
                  )}
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// ── PERÍODO PILLS ──────────────────────────────────────────────────────────
const PeriodPills = ({ value, onChange }) => (
  <div className="flex items-center gap-0.5 p-0.5 bg-zinc-100 dark:bg-zinc-800/60 rounded-lg">
    {TIME_RANGES.map(r => (
      <button
        key={r.value}
        onClick={() => onChange(r.value)}
        className={`
          relative px-3 py-1 rounded-md text-[11px] font-bold uppercase tracking-wide
          transition-all duration-150 select-none
          ${value === r.value
            ? 'text-zinc-900 dark:text-white'
            : 'text-zinc-400 dark:text-zinc-500 hover:text-zinc-600 dark:hover:text-zinc-300'
          }
        `}
      >
        {value === r.value && (
          <motion.div
            layoutId="period-pill"
            className="absolute inset-0 bg-white dark:bg-zinc-700 rounded-md shadow-sm"
            transition={{ type: 'spring', stiffness: 400, damping: 35 }}
          />
        )}
        <span className="relative z-10">{r.label}</span>
      </button>
    ))}
  </div>
);

// ── SEPARADOR VERTICAL ──────────────────────────────────────────────────────
const Sep = () => (
  <div className="w-px h-4 bg-zinc-200 dark:bg-zinc-700/60 flex-shrink-0" />
);

// ── MAIN COMPONENT ─────────────────────────────────────────────────────────
const DesempenhoHeader = ({ analytics, filters, options }) => {
  const disciplineOptions = useMemo(() => [
    { value: 'ALL', label: 'Todas' },
    ...options.disciplines.map(d => ({ value: d, label: d }))
  ], [options.disciplines]);

  const topicOptions = useMemo(() => [
    { value: 'ALL', label: 'Todos' },
    ...options.topics.map(t => ({ value: t, label: t }))
  ], [options.topics]);

  const hasFilters = filters.selectedDiscipline !== 'ALL' || filters.selectedTopic !== 'ALL';

  return (
    <div className="flex flex-col gap-5">

      {/* ── TÍTULO + FILTROS — MESMA LINHA ───────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 pb-4 border-b border-zinc-100 dark:border-zinc-800">

        {/* Título */}
        <div className="flex items-center gap-3 flex-shrink-0">
          <div className="p-2 sm:p-2.5 bg-red-100 dark:bg-red-900/20 text-red-600 dark:text-red-500 rounded-xl">
            <TrendingUp size={20} strokeWidth={2} />
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-zinc-800 dark:text-white tracking-tight uppercase">
            Desempenho
          </h1>
        </div>

        {/* Filtros — agrupados à direita */}
        <div className="flex flex-wrap items-end gap-x-3 gap-y-2">

          {/* Período */}
          <div className="flex flex-col gap-0.5">
            <span className="text-[9px] font-black uppercase tracking-widest text-zinc-400 dark:text-zinc-500 px-1">
              Período
            </span>
            <PeriodPills value={filters.timeRange} onChange={filters.setTimeRange} />
          </div>

          {/* Divisor vertical */}
          <div className="w-px h-7 bg-zinc-200 dark:bg-zinc-700/60 self-end mb-0.5 hidden sm:block" />

          {/* Disciplina */}
          <div className="flex flex-col gap-0.5">
            <span className="text-[9px] font-black uppercase tracking-widest text-zinc-400 dark:text-zinc-500 px-1">
              Disciplina
            </span>
            <InlineSelect
              options={disciplineOptions}
              value={filters.selectedDiscipline}
              onChange={filters.setSelectedDiscipline}
              placeholder="Todas"
            />
          </div>

          {/* Assunto — animado */}
          <AnimatePresence>
            {filters.selectedDiscipline !== 'ALL' && (
              <motion.div
                initial={{ opacity: 0, x: -6 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -6 }}
                transition={{ duration: 0.15 }}
                className="flex flex-col gap-0.5"
              >
                <span className="text-[9px] font-black uppercase tracking-widest text-zinc-400 dark:text-zinc-500 px-1">
                  Assunto
                </span>
                <InlineSelect
                  options={topicOptions}
                  value={filters.selectedTopic}
                  onChange={filters.setSelectedTopic}
                  placeholder="Todos"
                  alignRight
                />
              </motion.div>
            )}
          </AnimatePresence>

          {/* Limpar */}
          <AnimatePresence>
            {hasFilters && (
              <motion.button
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                transition={{ duration: 0.12 }}
                onClick={() => {
                  filters.setSelectedDiscipline('ALL');
                  filters.setSelectedTopic('ALL');
                }}
                className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wide text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors flex-shrink-0 self-end"
              >
                <XCircle size={11} strokeWidth={2.5} />
                <span>Limpar</span>
              </motion.button>
            )}
          </AnimatePresence>

        </div>
      </div>

      {/* ── KPI CARDS ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3 md:gap-4">
        <StatCard
          color="blue"
          icon={Clock}
          title="Tempo Líquido"
          value={formatTime(analytics.kpis.totalTime)}
          subValue={analytics.kpis.totalTime > 0 ? "No período" : "Sem registros"}
        />

        <StatCard
          color="violet"
          icon={Target}
          title="Questões Totais"
          value={analytics.kpis.totalQuestions}
          subValue={
            <div className="flex items-center gap-1.5 text-[10px] font-bold mt-0.5">
              <span className="text-emerald-500 flex items-center gap-0.5">
                <CheckCircle2 size={11} strokeWidth={3}/> {analytics.kpis.totalCorrect}
              </span>
              <span className="text-zinc-300 dark:text-zinc-600">·</span>
              <span className="text-red-500 flex items-center gap-0.5">
                <XCircle size={11} strokeWidth={3}/> {analytics.kpis.totalQuestions - analytics.kpis.totalCorrect}
              </span>
            </div>
          }
        />

        <StatCard
          color="emerald"
          icon={TrendingUp}
          title="Precisão Global"
          value={`${analytics.kpis.accuracy.toFixed(0)}%`}
          subValue="Taxa de acertos"
        />

        <StatCard
          color="red"
          icon={CalendarDays}
          title="Dias Estudados"
          value={analytics.kpis.daysCount}
          subValue="Neste filtro"
        />
      </div>
    </div>
  );
};

export default DesempenhoHeader;