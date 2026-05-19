import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Clock, Target, TrendingUp, CalendarDays,
  ChevronDown, CheckCircle2, XCircle,
  ArrowLeftRight, BookOpen
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
    <div className="flex flex-col gap-0.5">
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
const colorMap = {
  blue:   { text: 'text-red-500', bgHover: 'group-hover:text-red-500/15 dark:group-hover:text-red-500/10', border: 'border-red-500', watermark: 'text-red-500/10 dark:text-red-500/5' },
  violet: { text: 'text-red-500', bgHover: 'group-hover:text-red-500/15 dark:group-hover:text-red-500/10', border: 'border-red-500', watermark: 'text-red-500/10 dark:text-red-500/5' },
  emerald:{ text: 'text-red-500', bgHover: 'group-hover:text-red-500/15 dark:group-hover:text-red-500/10', border: 'border-red-500', watermark: 'text-red-500/10 dark:text-red-500/5' },
  red:    { text: 'text-red-500',    bgHover: 'group-hover:text-red-500/15 dark:group-hover:text-red-500/10',    border: 'hover:border-red-500',    watermark: 'text-red-500/10 dark:text-red-500/5' },
};

const StatCard = ({ icon: Icon, title, value, subValue, color = 'red', className = "" }) => {
  const theme = colorMap[color] || colorMap.red;
  return (
    <div className={`relative overflow-hidden group px-3 py-2.5 min-h-[75px] md:min-h-[85px] flex flex-col justify-center items-start transition-all duration-300 hover:shadow-glow border-l-4 border-red-500 bg-white dark:bg-zinc-900 rounded-xl shadow-sm ${className}`}>
      <div className="relative z-20 flex flex-col gap-0.5 w-full">
        <h3 className="text-[9px] md:text-[10px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 truncate w-full leading-none">
          {title}
        </h3>
        <div className="flex flex-row items-baseline gap-1.5 mt-0.5">
          <div className="text-xl md:text-2xl font-extrabold text-zinc-900 dark:text-white tracking-tight leading-none">
            {value}
          </div>
          {subValue && (
            <div className="text-[10px] md:text-xs opacity-90 text-zinc-500 dark:text-zinc-400 font-medium leading-none">
              {subValue}
            </div>
          )}
        </div>
      </div>
      <div className={`absolute -bottom-4 -right-4 ${theme.watermark} transition-all duration-700 ease-out group-hover:scale-125 group-hover:rotate-[-10deg] ${theme.bgHover} z-10 pointer-events-none`}>
        <Icon strokeWidth={1.5} className="w-16 h-16 md:w-20 md:h-20" />
      </div>
    </div>
  );
};

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
    <div className="flex flex-col gap-5">

      {/* ── TÍTULO + FILTROS ─────────────────────────────────────────────── */}
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

        {/* Filtros */}
        <div className="flex flex-wrap items-end gap-x-3 gap-y-2">
          <ContextSelector context={context} />

          <div className="w-px h-7 bg-zinc-200 dark:bg-zinc-700/60 self-end mb-0.5 hidden sm:block" />

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
