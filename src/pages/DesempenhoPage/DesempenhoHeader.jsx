import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Clock, Target, TrendingUp, CalendarDays,
  ChevronDown, CheckCircle2, XCircle,
  ArrowLeftRight, BookOpen, BarChart3
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { formatTime } from './DesempenhoPage';
import { CATALOGO_EDITAIS } from '../AdminPage/EditaisManager';

// ============================================================================
// CORREÇÃO 7: "Estudo Total" mostra TODOS os registros, sem filtro de contexto
// ============================================================================
const TIME_RANGES = [
  { value: '7D',       label: '7D' },
  { value: '15D',      label: '15D' },
  { value: '30D',      label: '30D' },
  { value: 'ALL_TIME', label: 'Estudo Total' },
];

const getTemplateId = (item) => item?.templateId || item?.editalId || item?.templateOrigemId || null;

const getContextLogo = (item) => {
  if (!item) return null;
  if (item.logoUrl) return item.logoUrl;
  if (item.editalLogoUrl) return item.editalLogoUrl;
  const templateId = getTemplateId(item);
  if (templateId) {
    const edital = CATALOGO_EDITAIS.find(e => e.id === templateId);
    if (edital) return edital.logoUrl || edital.logo;
    if (templateId !== 'manual') return `/logosEditais/${String(templateId).replace(/^edital_/, 'logo-')}.png`;
  }
  const nome = (item.nome || '').toLowerCase();
  if (nome.includes('pmba')) return '/logosEditais/logo-pmba.png';
  return null;
};

const getContextName = (item, fallback) => item?.nome || item?.editalNome || item?.titulo || fallback;

const SourceToggleButton = ({ selected, onToggle, cicloLogo, cronogramaLogo }) => {
  const isCiclo = selected === 'ciclo';
  const destinoLogo = isCiclo ? cronogramaLogo : cicloLogo;
  const destinoLabel = isCiclo ? 'Cronograma' : 'Ciclo';

  return (
    <motion.button
      type="button"
      onClick={onToggle}
      whileHover={{ scale: 1.04, y: -1 }}
      whileTap={{ scale: 0.96 }}
      className="group relative flex items-center gap-1.5 pl-1.5 pr-3 py-1 rounded-full border border-zinc-200 dark:border-zinc-700 bg-white/90 dark:bg-zinc-800/90 backdrop-blur-sm shadow-md hover:shadow-lg hover:border-red-300 dark:hover:border-red-600 transition-all duration-200"
      title={`Ver desempenho do ${destinoLabel}`}
    >
      <div className="w-5 h-5 rounded-full bg-zinc-100 dark:bg-zinc-700 border border-zinc-200 dark:border-zinc-600 flex items-center justify-center overflow-hidden flex-shrink-0">
        {destinoLogo
          ? <img src={destinoLogo} alt="" className="w-4 h-4 object-contain" />
          : (isCiclo
              ? <CalendarDays size={10} className="text-zinc-400" />
              : <BookOpen size={10} className="text-zinc-400" />)
        }
      </div>

      <ArrowLeftRight size={9} className="text-zinc-400 group-hover:text-red-500 transition-colors flex-shrink-0" />

      <span className="text-[9px] font-black uppercase tracking-widest text-zinc-500 group-hover:text-red-600 dark:group-hover:text-red-400 transition-colors whitespace-nowrap">
        Ver {destinoLabel}
      </span>
    </motion.button>
  );
};

const ContextSelector = ({ context }) => {
  if (!context || !context.hasCiclo || !context.hasCronograma) return null;
  const cicloLogo = getContextLogo(context.activeCicloData);
  const cronogramaLogo = getContextLogo(context.activeCronogramaData);

  return (
    <div className="desempenho-context-filter flex shrink-0 flex-col gap-0.5">
      <span className="text-[9px] font-black uppercase tracking-widest text-zinc-400 dark:text-zinc-500 px-1">
        Planejamento
      </span>
      <SourceToggleButton
        selected={context.selected}
        onToggle={() => context.setSelected?.(context.selected === 'ciclo' ? 'cronograma' : 'ciclo')}
        cicloLogo={cicloLogo}
        cronogramaLogo={cronogramaLogo}
      />
    </div>
  );
};

// --- COMPONENTES VISUAIS INTERNOS ---
const StatCard = ({ icon: Icon, title, value, subValue, className = "" }) => (
  <div className={`group relative flex min-h-[86px] flex-col justify-center overflow-hidden rounded-xl border-2 border-l-4 border-zinc-200 !border-l-red-500/20 bg-white px-3 py-2.5 shadow-soft transition-all duration-300 hover:-translate-y-0.5 hover:border-accent-light/40 hover:!border-l-red-500 hover:shadow-[0_0_18px_rgba(239,68,68,0.07)] dark:border-white/10 dark:!border-l-red-500/25 dark:bg-card-dark dark:hover:border-accent-light/20 dark:hover:!border-l-red-500 dark:hover:shadow-[0_0_22px_rgba(239,68,68,0.08)] ${className}`}>
    <div className="relative z-20 flex w-full flex-col gap-0.5">
      <h3 className="w-full truncate text-xs font-bold uppercase leading-none tracking-wide text-text-secondary dark:text-text-dark-secondary md:text-[13px]">
        {title}
      </h3>
      <div className="mt-1 flex flex-row items-baseline gap-1">
        <p className="text-xl font-extrabold leading-none tracking-tight text-text-primary dark:text-text-dark-primary md:text-2xl">
          {value}
        </p>
        {subValue && <div className="text-[9px] leading-none opacity-90">{subValue}</div>}
      </div>
    </div>
    <div className="pointer-events-none absolute -bottom-4 -right-4 z-10 text-red-500/10 transition-all duration-700 ease-out group-hover:scale-125 group-hover:rotate-[-10deg] dark:text-red-500/5">
      <Icon strokeWidth={1.5} className="h-16 w-16 md:h-20 md:w-20" />
    </div>
  </div>
);

// ── COMPACT INLINE SELECT ─────────────────────────────────────────────────
const InlineSelect = ({ options, value, onChange, placeholder, disabled }) => {
  const [isOpen, setIsOpen]     = useState(false);
  const [openLeft, setOpenLeft] = useState(false);
  const ref    = useRef(null);
  const btnRef = useRef(null);

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setIsOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

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
    <div className="relative z-[220]" ref={ref}>
      <button
        ref={btnRef}
        onClick={handleOpen}
        disabled={disabled}
        className={`
          flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-[11px] font-bold uppercase tracking-wide shadow-sm
          transition-all duration-150 select-none whitespace-nowrap
          ${disabled
            ? 'border-zinc-200 bg-white text-zinc-400 opacity-50 cursor-not-allowed dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-600'
            : isOpen
              ? 'border-red-200 bg-red-50 text-red-600 dark:border-red-900/50 dark:bg-red-900/20 dark:text-red-400'
              : 'border-zinc-200 bg-white text-zinc-600 hover:border-zinc-300 hover:bg-zinc-50 hover:text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:border-zinc-600 dark:hover:bg-zinc-800 dark:hover:text-white'
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
              absolute z-[10050] top-full mt-1.5
              min-w-[180px] max-w-[min(240px,80vw)]
              bg-white dark:bg-card-dark
              border border-zinc-200 dark:border-zinc-700/80
              rounded-xl shadow-2xl shadow-black/20 dark:shadow-black/50
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

// ── MAIN COMPONENT ─────────────────────────────────────────────────────────
const DesempenhoHeader = ({ analytics, filters, options, context }) => {
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
    <div className="relative z-40 flex flex-col gap-5">

      {/* ── TÍTULO + FILTROS ─────────────────────────────────────────────── */}
      <div className="group relative z-40 overflow-visible rounded-xl border-2 border-l-4 border-zinc-200 !border-l-red-500/20 bg-white p-4 shadow-soft transition-all duration-300 hover:border-accent-light/40 hover:!border-l-red-500 hover:shadow-[0_0_18px_rgba(239,68,68,0.07)] dark:border-white/10 dark:!border-l-red-500/25 dark:bg-card-dark dark:hover:border-accent-light/20 dark:hover:!border-l-red-500 dark:hover:shadow-[0_0_22px_rgba(239,68,68,0.08)]">
        <div className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-red-500/5 blur-[80px] transition-all duration-700 group-hover:bg-red-500/10" />
        <div className="pointer-events-none absolute -bottom-20 -left-20 h-64 w-64 rounded-full bg-zinc-500/5 blur-[80px]" />
        <div className="relative z-10 flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">

        {/* Título */}
        <div className="flex min-w-0 items-start gap-3">
          <div className="relative">
            <div className="absolute inset-0 animate-ping rounded-full bg-red-500/20 opacity-30 duration-[3s]" />
            <div className="relative flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-red-600 to-rose-700 text-white shadow-xl shadow-red-500/20">
              <BarChart3 size={22} strokeWidth={2.1} />
            </div>
          </div>
          <div className="min-w-0">
            <h1 className="text-2xl font-black uppercase leading-none tracking-tight text-zinc-900 dark:text-white sm:text-3xl">
              Desempenho <span className="bg-gradient-to-r from-red-600 to-rose-700 bg-clip-text text-transparent">Completo</span>
            </h1>
            <p className="mt-2 max-w-2xl text-xs font-semibold leading-relaxed text-zinc-500 dark:text-zinc-400 sm:text-sm">
              Acompanhe tempo, precisao, consistencia e prioridades de estudo com base nos seus registros.
            </p>
          </div>
        </div>

        {/* Filtros */}
        <div className="desempenho-filter-bar flex flex-wrap items-end gap-x-3 gap-y-2 xl:flex-nowrap">
          <ContextSelector context={context} />

          {/* Período */}
          <div className="desempenho-period-filter flex shrink-0 flex-col gap-0.5">
            <span className="text-[9px] font-black uppercase tracking-widest text-zinc-400 dark:text-zinc-500 px-1">
              Período
            </span>
            <PeriodPills value={filters.timeRange} onChange={filters.setTimeRange} />
          </div>

          {/* Divisor vertical */}
          <div className="w-px h-7 bg-zinc-200 dark:bg-zinc-700/60 self-end mb-0.5 hidden sm:block" />

          {/* Disciplina */}
          <div className="desempenho-discipline-filter desempenho-discipline-filter-zoom relative z-[240] flex shrink-0 flex-col gap-0.5">
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
      </div>

      {/* ── KPI CARDS ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3 md:gap-4">
        <StatCard
          color="red"
          icon={Clock}
          title="Tempo Líquido"
          value={formatTime(analytics.kpis.totalTime)}
          subValue={analytics.kpis.totalTime > 0 ? "No período" : "Sem registros"}
        />

        <StatCard
          color="red"
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
          color="red"
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
