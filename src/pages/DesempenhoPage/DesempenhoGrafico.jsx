import React, { useState, useMemo, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Sector } from 'recharts';
import {
  X, Clock, Target, Maximize2, BarChart2, ListFilter, ChevronDown,
  AlertCircle, CheckCircle2, Calendar as CalendarIcon, ArrowRight
} from 'lucide-react';
import {
  format, subDays, startOfWeek, startOfMonth, startOfYear,
  parseISO, startOfToday, endOfDay
} from 'date-fns';
import { ptBR } from 'date-fns/locale';

// ============================================================================
// CONFIGURAÇÕES GERAIS
// ============================================================================
const COLORS = [
  '#ef4444', '#f97316', '#f59e0b', '#10b981',
  '#3b82f6', '#8b5cf6', '#ec4899', '#14b8a6', '#6366f1'
];

const PERIOD_OPTIONS = [
  { value: 'TODAY', label: 'Hoje' },
  { value: '7D',    label: '7 dias' },
  { value: '15D',   label: '15 dias' },
  { value: '30D',   label: '30 dias' },
  { value: 'WEEK',  label: 'Esta semana' },
  { value: 'MONTH', label: 'Este mês' },
  { value: 'YEAR',  label: 'Este ano' },
  { value: 'ALL',   label: 'Todo período' },
  { value: 'CUSTOM',label: 'Personalizado' },
];

const periodLabels = Object.fromEntries(PERIOD_OPTIONS.map(o => [o.value, o.label]));

// ============================================================================
// HELPERS
// ============================================================================
const formatValue = (value, type) => {
  if (type === 'hours') {
    const h = Math.floor(value / 60);
    const m = Math.round(value % 60);
    if (h === 0) return `${m}m`;
    if (m === 0) return `${h}h`;
    return `${h}h ${m}m`;
  }
  return `${value}`;
};

const hasDataForPeriod = (registros, periodCheck) => {
  if (!registros || registros.length === 0) return false;
  const now = startOfToday();
  let startDate;
  let endDate = endOfDay(new Date());
  switch (periodCheck) {
    case 'TODAY': startDate = now; break;
    case '7D':   startDate = subDays(now, 7); break;
    case '30D':  startDate = subDays(now, 30); break;
    case 'ALL':  return true;
    default: return false;
  }
  return registros.some(r => {
    const d = r.data ? parseISO(r.data) : new Date(0);
    return d >= startDate && d <= endDate;
  });
};

// ============================================================================
// COMPONENTES VISUAIS (INPUT DATA, SELECT, TOGGLE)
// ============================================================================
const VisualDateInput = ({ value, onChange, placeholder, min, max }) => {
  let dayDisplay = '--';
  let monthDisplay = '---';
  let weekDisplay = placeholder;

  if (value) {
    const [y, m, d] = value.split('-').map(Number);
    const dateObj = new Date(y, m - 1, d, 12, 0, 0);
    dayDisplay = format(dateObj, 'dd');
    monthDisplay = format(dateObj, 'MMM', { locale: ptBR }).toUpperCase().replace('.', '');
    weekDisplay = format(dateObj, 'eee', { locale: ptBR }).replace('.', '');
  }

  return (
    <div className="relative group cursor-pointer h-[46px] flex-1 min-w-[120px]">
      <input
        type="date" value={value} onChange={onChange} min={min} max={max}
        className="absolute inset-0 w-full h-full opacity-0 z-10 cursor-pointer"
      />
      <div className={`flex h-full w-full bg-zinc-50 dark:bg-zinc-900 border rounded-xl overflow-hidden shadow-sm transition-all ${value ? 'border-zinc-200 dark:border-zinc-800 group-hover:border-red-300 dark:group-hover:border-red-900/50' : 'border-dashed border-zinc-300 dark:border-zinc-700'}`}>
        <div className="bg-zinc-100 dark:bg-zinc-800 w-10 flex flex-col items-center justify-center border-r border-zinc-200 dark:border-zinc-700 shrink-0">
          <span className="text-[9px] font-bold uppercase text-red-600 leading-none mb-0.5">{monthDisplay}</span>
          <span className="text-sm font-black leading-none text-zinc-800 dark:text-white">{dayDisplay}</span>
        </div>
        <div className="flex-1 px-2 flex items-center justify-between overflow-hidden">
          <span className="text-[10px] font-bold text-zinc-600 dark:text-zinc-300 capitalize truncate">{weekDisplay}</span>
          <CalendarIcon size={14} className="text-zinc-300 group-hover:text-red-500 transition-colors shrink-0 ml-1" />
        </div>
      </div>
    </div>
  );
};

const InlineSelect = ({ options, value, onChange, disabled }) => {
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setIsOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);
  const selected = options.find(o => o.value === value);

  return (
    <div className="relative" ref={ref}>
      <button onClick={() => !disabled && setIsOpen(v => !v)} disabled={disabled}
        className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-[11px] font-bold uppercase tracking-wide border transition-all duration-150 select-none ${isOpen ? 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 border-red-200 dark:border-red-700/50' : 'bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-300 border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 hover:text-zinc-900 dark:hover:text-white'}`}>
        <span className="truncate max-w-[100px]">{selected?.label ?? '—'}</span>
        <ChevronDown size={11} strokeWidth={2.5} className={`flex-shrink-0 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
      </button>
      <AnimatePresence>
        {isOpen && (
          <motion.div initial={{ opacity: 0, y: -4, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -4, scale: 0.97 }} transition={{ duration: 0.12 }}
            className="absolute z-[60] top-full mt-1.5 right-0 min-w-[160px] bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700/80 rounded-xl shadow-xl shadow-black/10 dark:shadow-black/40 overflow-hidden">
            <div className="p-1">
              {options.map(opt => (
                <button key={opt.value} onClick={() => { onChange(opt.value); setIsOpen(false); }}
                  className={`w-full text-left px-3 py-2 rounded-lg text-[11px] font-bold uppercase tracking-wide flex items-center justify-between transition-colors duration-100 ${value === opt.value ? 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400' : 'text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800'}`}>
                  {opt.label} {value === opt.value && <CheckCircle2 size={11} strokeWidth={2.5} className="flex-shrink-0" />}
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

const MetricToggle = ({ value, onChange }) => {
  const options = [{ key: 'hours', label: 'Horas', Icon: Clock }, { key: 'questions', label: 'Questões', Icon: Target }];
  return (
    <div className="flex items-center gap-0.5 p-0.5 bg-zinc-100 dark:bg-zinc-800/60 rounded-lg">
      {options.map(({ key, label, Icon }) => (
        <button key={key} onClick={() => onChange(key)}
          className={`relative flex items-center gap-1.5 px-3 py-1 rounded-md text-[11px] font-bold uppercase tracking-wide transition-all duration-150 select-none ${value === key ? 'text-zinc-900 dark:text-white' : 'text-zinc-400 dark:text-zinc-500 hover:text-zinc-600 dark:hover:text-zinc-300'}`}>
          {value === key && <motion.div layoutId="metric-pill" className="absolute inset-0 bg-white dark:bg-zinc-700 rounded-md shadow-sm" transition={{ type: 'spring', stiffness: 400, damping: 35 }} />}
          <Icon size={11} strokeWidth={2.5} className="relative z-10 flex-shrink-0" />
          <span className="relative z-10 hidden sm:block">{label}</span>
        </button>
      ))}
    </div>
  );
};

// ============================================================================
// RECHARTS HELPERS
// ============================================================================
const renderActiveShape = (props) => {
  const { cx, cy, innerRadius, outerRadius, startAngle, endAngle, fill } = props;
  return (
    <g>
      <Sector cx={cx} cy={cy} innerRadius={innerRadius} outerRadius={outerRadius + 6} startAngle={startAngle} endAngle={endAngle} fill={fill} style={{ filter: `drop-shadow(0 0 8px ${fill}60)` }} />
      <Sector cx={cx} cy={cy} innerRadius={outerRadius + 8} outerRadius={outerRadius + 11} startAngle={startAngle} endAngle={endAngle} fill={fill} opacity={0.2} />
    </g>
  );
};

const CustomTooltip = ({ active, payload, type }) => {
  if (!active || !payload?.length) return null;
  const data = payload[0].payload;
  return (
    <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700/50 p-2.5 rounded-xl shadow-xl text-xs z-50">
      <div className="flex items-center gap-2 mb-1">
        <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: data.fill }} />
        <span className="font-black text-zinc-900 dark:text-white max-w-[150px] truncate">{data.name}</span>
      </div>
      <div className="flex justify-between gap-4">
        <span className="font-mono font-bold text-zinc-600 dark:text-zinc-300">{formatValue(data.value, type)}</span>
        <span className="font-bold text-zinc-400">{data.percent.toFixed(1)}%</span>
      </div>
    </div>
  );
};

// ============================================================================
// COMPONENTE PRINCIPAL DO GRÁFICO (REMODELADO)
// ============================================================================
const DesempenhoGrafico = ({ registrosEstudo }) => {
  const [period, setPeriod] = useState('7D');
  const [metric, setMetric] = useState('hours');
  const [isExpanded, setIsExpanded] = useState(false);
  const [activeIndex, setActiveIndex] = useState(null);
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [hasInitialized, setHasInitialized] = useState(false);

  useEffect(() => {
    if (registrosEstudo && registrosEstudo.length > 0 && !hasInitialized) {
      if (hasDataForPeriod(registrosEstudo, '7D')) setPeriod('7D');
      else if (hasDataForPeriod(registrosEstudo, '30D')) setPeriod('30D');
      else setPeriod('ALL');
      setHasInitialized(true);
    }
  }, [registrosEstudo, hasInitialized]);

  const { chartData, totals } = useMemo(() => {
    if (!registrosEstudo?.length) return { chartData: [], totals: { hours: 0, questions: 0 } };
    const now = startOfToday();
    let startDate;
    let endDate = endOfDay(new Date());

    switch (period) {
      case 'TODAY': startDate = now; break;
      case '7D':   startDate = subDays(now, 7); break;
      case '15D':  startDate = subDays(now, 15); break;
      case '30D':  startDate = subDays(now, 30); break;
      case 'WEEK': startDate = startOfWeek(now, { weekStartsOn: 0 }); break;
      case 'MONTH':startDate = startOfMonth(now); break;
      case 'YEAR': startDate = startOfYear(now); break;
      case 'CUSTOM':
        if (customStart) startDate = parseISO(customStart);
        if (customEnd)   endDate   = endOfDay(parseISO(customEnd)); // Corrigido para pegar fim do dia
        break;
      default: startDate = null;
    }

    const grouped = {};
    let totalH = 0, totalQ = 0, totalMetric = 0;

    registrosEstudo.forEach(reg => {
      const regDate = reg.data ? parseISO(reg.data) : new Date(0);
      if (period !== 'ALL' && startDate) {
         // Ajuste simples para garantir comparacao correta
         if (regDate < startDate || (endDate && regDate > endDate)) return;
      }

      const disc = reg.disciplinaNome || 'Geral';
      const h = Number(reg.tempoEstudadoMinutos) || 0;
      const q = Number(reg.questoesFeitas) || 0;
      totalH += h;
      totalQ += q;
      const val = metric === 'hours' ? h : q;
      if (val > 0) {
        if (!grouped[disc]) grouped[disc] = 0;
        grouped[disc] += val;
        totalMetric += val;
      }
    });

    const data = Object.entries(grouped)
      .map(([name, value], i) => ({
        name, value, fill: COLORS[i % COLORS.length],
        percent: totalMetric > 0 ? (value / totalMetric) * 100 : 0
      }))
      .sort((a, b) => b.value - a.value);

    return { chartData: data, totals: { hours: totalH, questions: totalQ } };
  }, [registrosEstudo, period, metric, customStart, customEnd]);

  const hasData = chartData.length > 0;

  // Renderização da Lista (Extraída para reutilizar no modal se necessário)
  const renderList = () => (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Cabeçalho do Total (Estilo Referência) */}
      <div className="mb-3 px-2 hidden lg:block">
        <h4 className="text-3xl font-black text-zinc-900 dark:text-white tracking-tight">
           {metric === 'hours' ? formatValue(totals.hours, 'hours') : totals.questions}
        </h4>
        <p className="text-[11px] font-bold text-zinc-500 uppercase tracking-wide">
           Tempo total em {periodLabels[period] || 'Período'}
        </p>
      </div>

      {/* Lista com Scroll */}
      <div className="flex-1 overflow-y-auto pr-1 space-y-1 custom-scrollbar">
        {chartData.map((entry, i) => (
          <div
            key={i}
            onMouseEnter={() => setActiveIndex(i)}
            onMouseLeave={() => setActiveIndex(null)}
            className={`
              flex items-center justify-between p-2 rounded-lg cursor-pointer transition-all duration-200 group
              ${activeIndex === i
                ? 'bg-zinc-100 dark:bg-zinc-800 translate-x-1'
                : 'hover:bg-zinc-50 dark:hover:bg-zinc-900/50'
              }
            `}
          >
            {/* Esquerda: Cor + Nome */}
            <div className="flex items-center gap-2.5 overflow-hidden">
              <div
                className="w-2.5 h-2.5 rounded-full shadow-sm shrink-0 transition-transform duration-300"
                style={{
                  backgroundColor: entry.fill,
                  transform: activeIndex === i ? 'scale(1.2)' : 'scale(1)'
                }}
              />
              <span className={`text-[11px] font-bold truncate transition-colors ${activeIndex === i ? 'text-zinc-900 dark:text-white' : 'text-zinc-600 dark:text-zinc-400'}`}>
                {entry.name}
              </span>
            </div>

            {/* Direita: Valor + Porcentagem */}
            <div className="flex items-center gap-3 shrink-0">
               <span className="text-[11px] font-mono font-bold text-zinc-500 dark:text-zinc-400">
                 {formatValue(entry.value, metric)}
               </span>
               <span
                 className="text-[10px] font-bold bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded min-w-[32px] text-center"
                 style={{ color: entry.fill }}
               >
                 {entry.percent.toFixed(0)}%
               </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-sm p-5 h-full flex flex-col min-h-[400px]">

      {/* ── HEADER DE CONTROLES ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 shrink-0">
        <div className="flex items-center gap-2">
           <MetricToggle value={metric} onChange={setMetric} />
        </div>

        <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap justify-end">
          {period === 'CUSTOM' ? (
             <div className="flex items-center gap-2 animate-in slide-in-from-right-4 fade-in duration-300">
                <VisualDateInput value={customStart} onChange={e => setCustomStart(e.target.value)} placeholder="Início" />
                <ArrowRight size={12} className="text-zinc-300" />
                <VisualDateInput value={customEnd} onChange={e => setCustomEnd(e.target.value)} placeholder="Fim" />
                <button onClick={() => setPeriod('7D')} className="p-2 text-zinc-400 hover:text-red-500 hover:bg-red-50 rounded-lg">
                   <X size={14} />
                </button>
             </div>
          ) : (
            <InlineSelect options={PERIOD_OPTIONS} value={period} onChange={setPeriod} />
          )}
        </div>
      </div>

      {/* ── CONTEÚDO PRINCIPAL (LAYOUT RESPONSIVO) ── */}
      <div className="flex-1 min-h-0 w-full">
        {!hasData ? (
          <div className="h-full flex flex-col items-center justify-center text-zinc-400 opacity-60">
             <div className="p-4 bg-zinc-50 dark:bg-zinc-900 rounded-full mb-3">
               <Target size={32} />
             </div>
             <p className="text-xs font-bold">Sem atividades neste período</p>
          </div>
        ) : (
          <div className="flex flex-col lg:flex-row h-full gap-6">

            {/* 1. GRÁFICO (DONUT) - TOPO no Mobile, ESQUERDA no Desktop */}
            <div className="w-full lg:w-5/12 h-[220px] lg:h-auto min-h-[220px] relative shrink-0">
               <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={chartData} cx="50%" cy="50%"
                      innerRadius="60%" outerRadius="90%"
                      paddingAngle={4} dataKey="value" stroke="none"
                      activeIndex={activeIndex}
                      activeShape={renderActiveShape}
                      onMouseEnter={(_, i) => setActiveIndex(i)}
                      onMouseLeave={() => setActiveIndex(null)}
                    >
                      {chartData.map((entry, i) => (
                        <Cell key={i} fill={entry.fill} fillOpacity={activeIndex === i ? 1 : activeIndex !== null ? 0.3 : 1} className="transition-all duration-300" />
                      ))}
                    </Pie>
                    <Tooltip content={<CustomTooltip type={metric} />} />
                  </PieChart>
               </ResponsiveContainer>

               {/* TEXTO CENTRAL (Aparece no Mobile, ou se quiser manter no Desktop tbm) */}
               <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                 <AnimatePresence mode="wait">
                    {activeIndex !== null ? (
                      <motion.div key="active" initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} className="text-center">
                         <span className="text-2xl font-black text-zinc-800 dark:text-white block leading-none">{formatValue(chartData[activeIndex].value, metric)}</span>
                         <span className="text-[10px] font-bold uppercase tracking-widest mt-1" style={{ color: chartData[activeIndex].fill }}>{chartData[activeIndex].name.split(' ')[0]}</span>
                      </motion.div>
                    ) : (
                      <motion.div key="total" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center">
                         <span className="text-2xl font-black text-zinc-800 dark:text-white block leading-none">
                            {metric === 'hours' ? formatValue(totals.hours, 'hours') : totals.questions}
                         </span>
                         <span className="text-[10px] text-zinc-400 font-bold uppercase tracking-widest mt-1">Total</span>
                      </motion.div>
                    )}
                 </AnimatePresence>
               </div>
            </div>

            {/* 2. LISTA DETALHADA - BAIXO no Mobile, DIREITA no Desktop */}
            <div className="flex-1 min-h-0 border-t lg:border-t-0 lg:border-l border-zinc-100 dark:border-zinc-800 pt-4 lg:pt-0 lg:pl-6 overflow-hidden">
               {renderList()}
            </div>

          </div>
        )}
      </div>

    </div>
  );
};

export default DesempenhoGrafico;