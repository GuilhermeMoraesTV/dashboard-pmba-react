import React, { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ResponsiveContainer,
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';
import {
  Clock,
  Target,
  TrendingUp,
  Flame,
  Calendar,
  CheckCircle2,
  XCircle,
  ChevronLeft,
  ChevronRight,
  Crown,
  Star,
  Shield,
  ArrowLeftRight,
  CalendarDays,
  RotateCw,
  ClipboardList,
  Coffee,
  Play,
} from 'lucide-react';
import { resolveLogoUrl } from '../../components/admin/config/editalAssets';

const PT_DAYS_SHORT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab'];

const dateToYMDLocal = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const addDays = (date, days) => {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
};

const getMonday = (date) => {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(d.setDate(diff));
};

const formatDecimalHours = (minutes) => {
  if (!minutes || minutes < 0) return '00h 00m';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, '0')}h ${String(m).padStart(2, '0')}m`;
};

const formatMultiplierText = (multiplier) => {
  const val = parseFloat(multiplier);
  if (val >= 2) return '2x';
  if (val >= 1.5) return '+50%';
  if (val >= 1.25) return '+25%';
  return '';
};

const getMultiplierBadge = (multiplier) => {
  const val = parseFloat(multiplier);
  if (val >= 2) return { bg: 'bg-gradient-to-r from-purple-600 to-indigo-600', text: 'text-white', border: 'border-purple-300', icon: Crown };
  if (val >= 1.5) return { bg: 'bg-gradient-to-r from-yellow-400 to-amber-500', text: 'text-yellow-950', border: 'border-yellow-200', icon: Star };
  if (val >= 1.25) return { bg: 'bg-gradient-to-r from-slate-300 to-slate-400', text: 'text-slate-900', border: 'border-slate-200', icon: Shield };
  return null;
};

const WeeklyStudyTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  const data = payload[0]?.payload || {};
  const minutes = Number(data.minutes) || 0;
  const questions = Number(data.questions) || 0;

  return (
    <div className="bg-white/95 dark:bg-zinc-950/95 backdrop-blur-md border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-xl px-3 py-2 min-w-[150px]">
      <p className="text-[10px] font-black uppercase tracking-wide text-zinc-900 dark:text-zinc-100 mb-1">
        {label}
      </p>
      <div className="flex items-center justify-between gap-4 text-[11px]">
        <span className="font-bold text-red-500">Horas</span>
        <span className="font-black text-zinc-900 dark:text-zinc-100">{formatDecimalHours(minutes)}</span>
      </div>
      <div className="flex items-center justify-between gap-4 text-[11px] mt-1">
        <span className="font-bold text-indigo-500">Questoes</span>
        <span className="font-black text-zinc-900 dark:text-zinc-100">{questions}</span>
      </div>
    </div>
  );
};

const StatCard = ({ icon: Icon, title, value, subValue, iconColor = 'text-red-500/10 dark:text-red-500/5', compact = false }) => (
  <div className={`relative overflow-hidden group flex flex-col justify-center bg-card-light dark:bg-card-dark border border-border-light dark:border-border-dark border-l-[3px] !border-l-red-500 dark:!border-l-red-500 rounded-lg shadow-soft transition-colors duration-300 ${compact ? 'px-3 py-2.5 h-[86px]' : 'px-3 py-2.5 min-h-[108px]'}`}>
    <div className="relative z-20 flex flex-col gap-0.5 w-full">
      <h3 className={`${compact ? 'text-[10px]' : 'text-[10.5px]'} font-bold uppercase tracking-wider text-text-secondary dark:text-text-dark-secondary truncate w-full leading-none`}>
        {title}
      </h3>
      <div className="flex flex-row items-baseline gap-1 mt-1">
        <p className={`${compact ? 'text-xl md:text-2xl' : 'text-xl md:text-2xl'} font-extrabold text-text-primary dark:text-text-dark-primary tracking-tight leading-none`}>
          {value}
        </p>
        {subValue && <div className={`${compact ? 'text-[9px]' : 'text-[10px]'} opacity-90 leading-none`}>{subValue}</div>}
      </div>
    </div>
    <div className={`absolute -bottom-3 -right-3 ${iconColor} transition-all duration-700 ease-out group-hover:scale-125 group-hover:rotate-[-10deg] z-10 pointer-events-none`}>
      <Icon strokeWidth={1.5} className={compact ? 'w-11 h-11 md:w-12 md:h-12' : 'w-12 h-12 md:w-14 md:h-14'} />
    </div>
  </div>
);

const ActiveContextCard = ({ activeCicloData, activeCronogramaData, preferredContext, onPreferredContextChange, onGoToCiclo, onGoToCronograma, compact = false }) => {
  const hasCiclo = !!activeCicloData;
  const hasCronograma = !!activeCronogramaData;
  const hasBoth = hasCiclo && hasCronograma;
  const preferred = preferredContext === 'ciclo' ? 'ciclo' : 'cronograma';
  const showCiclo = hasBoth ? preferred === 'ciclo' : hasCiclo;

  const setPreferred = (value, event) => {
    event.stopPropagation();
    onPreferredContextChange?.(value);
  };

  if (!hasCiclo && !hasCronograma) {
    return (
      <button
        type="button"
        onClick={() => onGoToCiclo?.()}
        className={`relative overflow-hidden group flex items-center rounded-xl cursor-pointer transition-all duration-300 bg-card-light dark:bg-card-dark border-2 border-dashed border-border-light dark:border-border-dark text-text-secondary dark:text-text-dark-secondary hover:border-red-500/50 hover:bg-zinc-50 dark:hover:bg-[#2a2a2a] hover:-translate-y-0.5 active:scale-95 ${compact ? 'h-[86px] px-4' : 'px-4 py-3 min-h-[108px] h-full'}`}
      >
        <div className="flex flex-col items-center justify-center w-full gap-1.5 text-center">
          <div className="p-2 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-400 group-hover:text-red-500 group-hover:bg-red-500/10 transition-colors">
            <ClipboardList size={18} />
          </div>
          <div>
            <span className="block text-[10px] font-black uppercase tracking-widest opacity-70">Sem Planejamento</span>
            <span className="text-[9px] text-red-500 font-bold uppercase">Começar agora</span>
          </div>
        </div>
      </button>
    );
  }

  const isCiclo = showCiclo && activeCicloData;
  const activeData = isCiclo ? activeCicloData : activeCronogramaData;
  const Icon = isCiclo ? RotateCw : CalendarDays;
  const clickHandler = isCiclo ? onGoToCiclo : onGoToCronograma;
  const cardTone = 'border-red-400/30 bg-gradient-to-br from-red-500 via-red-600 to-red-800 text-white shadow-red-900/20';
  const playTone = 'text-red-600';
  const logoUrl = activeData?.logoUrl || activeData?.logo || resolveLogoUrl({ ciclo: activeData });
  const destinoData = isCiclo ? activeCronogramaData : activeCicloData;
  const destinoLabel = isCiclo ? 'Cronograma' : 'Ciclo';
  const destinoLogo = destinoData?.logoUrl || destinoData?.logo || resolveLogoUrl({ ciclo: destinoData });
  const toggleDestination = isCiclo ? 'cronograma' : 'ciclo';
  const canToggle = hasBoth;

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={clickHandler}
      onKeyDown={(event) => { if (event.key === 'Enter') clickHandler?.(); }}
      className={`relative overflow-hidden group flex flex-col justify-between rounded-xl shadow-soft transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md active:scale-[0.98] border ${cardTone} ${compact ? 'h-[86px] p-3' : 'h-full p-3.5 min-h-[108px]'}`}
    >
      <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(255,255,255,0.13),transparent_42%,rgba(0,0,0,0.12))] pointer-events-none" />
      <div className="absolute -right-6 -top-8 h-24 w-24 rounded-2xl border-[6px] border-white/10 pointer-events-none rotate-45" />

      <div className="absolute inset-y-0 left-0 z-0 flex w-[68%] items-center justify-start overflow-hidden pointer-events-none">
        {logoUrl ? (
          <motion.div
            className="relative -ml-3 flex h-24 w-24 items-center justify-center opacity-95 md:h-28 md:w-28"
            animate={{ scale: [1, 1.04, 1], rotate: [-5, -2, -5] }}
            transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
          >
            <img
              src={logoUrl}
              alt=""
              className="w-full h-full object-contain opacity-100 drop-shadow-[0_10px_18px_rgba(0,0,0,0.24)]"
              onError={(e) => e.currentTarget.style.display = 'none'}
            />
          </motion.div>
        ) : (
          <Icon
            strokeWidth={1.3}
            className="h-24 w-24 -ml-4 text-white/25"
          />
        )}
      </div>

      {canToggle && (
        <motion.button
          type="button"
          onClick={(event) => setPreferred(toggleDestination, event)}
          whileHover={{ scale: 1.04, y: -1 }}
          whileTap={{ scale: 0.96 }}
          className="absolute right-2 top-2 z-20 flex h-8 w-12 shrink-0 items-center justify-center gap-1 rounded-lg border border-white/20 bg-white/10 px-1.5 text-white shadow-sm backdrop-blur-[1px] transition-all duration-200 hover:bg-white/18 hover:shadow-md"
          title={`Ver ${destinoLabel}`}
          aria-label={`Ver ${destinoLabel}`}
        >
          <div className="flex h-5 w-5 flex-shrink-0 items-center justify-center overflow-hidden rounded-md">
            {destinoLogo ? (
              <img src={destinoLogo} alt="" className="h-5 w-5 object-contain opacity-100 drop-shadow" />
            ) : isCiclo ? (
              <CalendarDays size={12} className="text-white" />
            ) : (
              <RotateCw size={12} className="text-white" />
            )}
          </div>
          <ArrowLeftRight size={10} className="flex-shrink-0 text-white/80 transition-colors" />
        </motion.button>
      )}

      <div className="relative z-10 ml-auto flex items-end justify-end pb-0.5 pr-0.5">
        <div className="flex flex-col items-center gap-1 text-white">
          <span className={`flex ${compact ? 'h-8 w-8' : 'h-9 w-9'} shrink-0 items-center justify-center rounded-full bg-white ${playTone} shadow-lg shadow-black/15 transition-transform duration-200 group-hover:scale-105`}>
            <Play size={compact ? 13 : 15} fill="currentColor" strokeWidth={3} className="ml-0.5" />
          </span>
        </div>
      </div>

    </div>
  );
};

export const WeeklyBarChart = ({ registrosEstudo, compact = false }) => {
  const [metric, setMetric] = useState('hours');
  const [weekOffset, setWeekOffset] = useState(0);

  const weekData = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const currentMonday = addDays(getMonday(new Date()), weekOffset * 7);
    const todayStr = dateToYMDLocal(today);
    const map = {};

    (registrosEstudo || []).forEach((registro) => {
      if (!registro.data) return;
      if (!map[registro.data]) map[registro.data] = { minutes: 0, questions: 0 };
      map[registro.data].minutes += Number(registro.tempoEstudadoMinutos) || 0;
      map[registro.data].questions += Number(registro.questoesFeitas) || 0;
    });

    return Array.from({ length: 7 }, (_, index) => {
      const date = addDays(currentMonday, index);
      const dateStr = dateToYMDLocal(date);
      const dayData = map[dateStr] || { minutes: 0, questions: 0 };
      const isFuture = dateStr > todayStr;
      return {
        date: PT_DAYS_SHORT[date.getDay()],
        dateStr,
        minutes: isFuture ? 0 : dayData.minutes,
        questions: isFuture ? 0 : dayData.questions,
        isToday: dateStr === todayStr,
        isFuture,
      };
    });
  }, [registrosEstudo, weekOffset]);

  const chartData = weekData.map((day) => ({
    ...day,
    value: metric === 'hours' ? day.minutes : day.questions,
    lineValue: metric === 'hours' ? day.minutes : day.questions,
  }));

  const chartAnimationKey = `${metric}-${weekOffset}-${weekData.map((day) => `${day.dateStr}:${day.minutes}:${day.questions}`).join('|')}`;

  const weeklySummary = useMemo(() => {
    const totalMinutes = weekData.reduce((acc, day) => acc + day.minutes, 0);
    const totalQuestions = weekData.reduce((acc, day) => acc + day.questions, 0);
    const activeDays = weekData.filter((day) => day.minutes > 0 || day.questions > 0).length;
    const bestDay = [...weekData].sort((a, b) => {
      const metricA = metric === 'hours' ? a.minutes : a.questions;
      const metricB = metric === 'hours' ? b.minutes : b.questions;
      return metricB - metricA;
    })[0];
    const bestValue = bestDay ? (metric === 'hours' ? bestDay.minutes : bestDay.questions) : 0;

    return {
      totalMinutes,
      totalQuestions,
      activeDays,
      bestDay,
      bestValue,
    };
  }, [metric, weekData]);

  const metricConfig = metric === 'hours'
    ? {
        label: 'Horas',
        color: '#dc2626',
        softColor: '#ef4444',
        unit: 'h',
        formatter: (value) => (value === 0 ? '' : `${Math.round(value / 60)}h`),
      }
    : {
        label: 'Questoes',
        color: '#6366f1',
        softColor: '#818cf8',
        unit: '',
        formatter: (value) => (value === 0 ? '' : value),
      };

  const weekLabel = useMemo(() => {
    const first = weekData[0]?.dateStr;
    const last = weekData[6]?.dateStr;
    if (!first || !last) return '';
    const fmt = (value) => value.split('-').reverse().slice(0, 2).join('/');
    return `${fmt(first)} - ${fmt(last)}`;
  }, [weekData]);

  return (
    <div className={`dashboard-card flex flex-col relative overflow-hidden group/chart z-20 ${compact ? 'h-full min-h-[220px] p-0 gap-0' : 'h-full p-0 gap-0'}`}>
      <div className={`flex gap-2 border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-transparent ${compact ? 'items-start justify-between p-3' : 'items-center justify-between p-4'}`}>
        <div className="flex items-center gap-3">
          <div className={`${compact ? 'p-1.5 rounded-lg' : 'p-2 rounded-xl'} bg-red-500/10`}>
            <TrendingUp size={compact ? 15 : 22} className="text-red-500" strokeWidth={2.5} />
          </div>
          <div>
            <h3 className="text-xs font-black uppercase tracking-tight text-zinc-900 dark:text-zinc-100">
              Estudo Semanal
            </h3>
            <div className="flex items-center gap-2 mt-0.5">
              <button type="button" onClick={() => setWeekOffset((value) => value - 1)} className="w-4 h-4 rounded hover:bg-zinc-200 dark:hover:bg-zinc-700 flex items-center justify-center transition-colors text-zinc-500">
                <ChevronLeft size={10} />
              </button>
              <span className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 tracking-wide">{weekLabel}</span>
              <button type="button" onClick={() => setWeekOffset((value) => Math.min(value + 1, 0))} disabled={weekOffset === 0} className={`w-4 h-4 rounded flex items-center justify-center transition-colors text-zinc-500 ${weekOffset === 0 ? 'opacity-30 cursor-not-allowed' : 'hover:bg-zinc-200 dark:hover:bg-zinc-700'}`}>
                <ChevronRight size={10} />
              </button>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3 self-start md:self-center">
          <div className="hidden sm:flex items-center gap-1.5">
            <div className="w-3 h-0.5 rounded-full" style={{ backgroundColor: metricConfig.color }} />
            <span className="text-[9px] font-bold uppercase tracking-wide" style={{ color: metricConfig.color }}>{metricConfig.label}</span>
          </div>
          <div className="flex bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg p-0.5 gap-0.5">
            <button type="button" onClick={() => setMetric('hours')} className={`${compact ? 'px-2 py-1 text-[8px]' : 'px-3 py-1.5 text-[9px]'} rounded-md font-black uppercase tracking-wide transition-all ${metric === 'hours' ? 'bg-red-500 text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'}`}>Horas</button>
            <button type="button" onClick={() => setMetric('questions')} className={`${compact ? 'px-2 py-1 text-[8px]' : 'px-3 py-1.5 text-[9px]'} rounded-md font-black uppercase tracking-wide transition-all ${metric === 'questions' ? 'bg-indigo-500 text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'}`}>Questoes</button>
          </div>
        </div>
      </div>

      <div className={`relative z-10 w-full ${compact ? 'flex-1 min-h-0 p-3 pt-3 pb-4' : 'flex-1 min-h-[180px] p-4 pb-2'}`}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={chartData} margin={compact ? { top: 8, right: 8, left: -28, bottom: 8 } : { top: 14, right: 12, left: -22, bottom: 0 }}>
            <defs>
              <linearGradient id="wkStudyArea" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={metricConfig.color} stopOpacity={0.26} />
                <stop offset="95%" stopColor={metricConfig.color} stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e4e4e7" strokeOpacity={0.7} className="dark:stroke-zinc-800" />
            <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: compact ? 9 : 11, fill: '#71717a', fontWeight: 600 }} dy={8} />
            <YAxis
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: compact ? 9 : 11, fill: metricConfig.color, fontWeight: 600 }}
              tickFormatter={metricConfig.formatter}
            />
            <Tooltip
              content={<WeeklyStudyTooltip />}
              cursor={{ stroke: metricConfig.softColor, strokeWidth: 1, strokeDasharray: '4 4', strokeOpacity: 0.45 }}
              wrapperStyle={{ zIndex: 50 }}
            />
            <Area
              key={`area-${chartAnimationKey}`}
              type="monotone"
              dataKey="value"
              name={metricConfig.label}
              unit={metricConfig.unit}
              stroke={metricConfig.color}
              strokeWidth={2.5}
              fill="url(#wkStudyArea)"
              dot={false}
              activeDot={{ r: compact ? 4 : 5, fill: metricConfig.color, stroke: '#fff', strokeWidth: 2 }}
              connectNulls={false}
              isAnimationActive
              animationBegin={120}
              animationDuration={850}
              animationEasing="ease-out"
            />
            <Line
              key={`line-${chartAnimationKey}`}
              type="monotone"
              dataKey="lineValue"
              stroke={metricConfig.color}
              strokeWidth={1.5}
              dot={({ cx, cy, payload }) => payload?.isToday && payload?.value > 0 ? (
                <circle cx={cx} cy={cy} r={4} fill={metricConfig.color} stroke="#fff" strokeWidth={2} />
              ) : null}
              activeDot={false}
              legendType="none"
              isAnimationActive
              animationBegin={180}
              animationDuration={900}
              animationEasing="ease-out"
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {!compact && (
        <div className="grid grid-cols-3 gap-2 px-4 pb-4 pt-1">
          <div className="rounded-xl border border-zinc-100 bg-zinc-50/70 px-3 py-2 dark:border-zinc-800 dark:bg-zinc-950/40">
            <div className="flex items-center gap-1.5 text-[8px] font-black uppercase tracking-widest text-zinc-400">
              <Clock size={10} /> Total
            </div>
            <p className="mt-1 text-sm font-black text-zinc-900 dark:text-white">
              {metric === 'hours' ? formatDecimalHours(weeklySummary.totalMinutes) : weeklySummary.totalQuestions}
            </p>
          </div>
          <div className="rounded-xl border border-zinc-100 bg-zinc-50/70 px-3 py-2 dark:border-zinc-800 dark:bg-zinc-950/40">
            <div className="flex items-center gap-1.5 text-[8px] font-black uppercase tracking-widest text-zinc-400">
              <Flame size={10} /> Ritmo
            </div>
            <p className="mt-1 text-sm font-black text-zinc-900 dark:text-white">
              {weeklySummary.activeDays}/7 dias
            </p>
          </div>
          <div className="rounded-xl border border-zinc-100 bg-zinc-50/70 px-3 py-2 dark:border-zinc-800 dark:bg-zinc-950/40">
            <div className="flex items-center gap-1.5 text-[8px] font-black uppercase tracking-widest text-zinc-400">
              <Crown size={10} /> Pico
            </div>
            <p className="mt-1 truncate text-sm font-black text-zinc-900 dark:text-white">
              {weeklySummary.bestValue > 0
                ? `${weeklySummary.bestDay.date} · ${metric === 'hours' ? formatDecimalHours(weeklySummary.bestValue) : weeklySummary.bestValue}`
                : 'Sem dados'}
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default function HomeSessao1({
  variant = 'full',
  compact = false,
  homeStats,
  activeCicloData,
  activeCronogramaData,
  preferredContext,
  onPreferredContextChange,
  setActiveTab,
  onGoToCronograma,
  handleDayClick,
  diasEstudo,
  headerSlot,
  daysLimit = 12,
}) {
  const [isHoveringMultiplier, setIsHoveringMultiplier] = useState(false);
  const badgeConfig = getMultiplierBadge(homeStats.multiplier);

  const statsGrid = (
    <div id="home-stats-grid" className={`grid grid-cols-2 auto-rows-[86px] gap-2.5 md:gap-3 pt-0 ${variant === 'full' && !headerSlot ? 'md:grid-cols-4' : ''} ${headerSlot ? 'xl:grid-cols-2 xl:max-w-[320px] xl:justify-self-end' : ''}`}>
      <StatCard compact={compact} icon={Clock} title="Tempo de Estudo" value={formatDecimalHours(homeStats.totalTimeMinutes)} />
      <StatCard compact={compact} icon={Target} title="Questoes Feitas" value={homeStats.performance.total} />
      <StatCard
        compact={compact}
        icon={TrendingUp}
        title="Precisao Geral"
        value={`${homeStats.performance.percentage.toFixed(0)}%`}
        subValue={
          <div className="flex items-center gap-1.5 text-[10px] md:text-[11px] font-bold">
            <span className="text-emerald-500 flex items-center gap-0.5">
              <CheckCircle2 size={11} strokeWidth={3} /> {homeStats.performance.correct}
            </span>
            <span className="text-zinc-300">|</span>
            <span className="text-red-500 flex items-center gap-0.5">
              <XCircle size={11} strokeWidth={3} /> {homeStats.performance.wrong}
            </span>
          </div>
        }
      />
      <div className="min-w-0 h-full">
        <ActiveContextCard
          compact={compact}
          activeCicloData={activeCicloData}
          activeCronogramaData={activeCronogramaData}
          preferredContext={preferredContext}
          onPreferredContextChange={onPreferredContextChange}
          onGoToCiclo={() => setActiveTab?.('ciclos')}
          onGoToCronograma={onGoToCronograma}
        />
      </div>
    </div>
  );

  const streakDays = homeStats.last12Days.slice(-daysLimit);

  const streakCard = (
    <div className="min-w-0 h-full">
      <div className={`dashboard-card flex flex-col gap-2.5 relative overflow-visible border-l-4 border-l-orange-500 group/card z-20 h-full ${compact ? 'p-4 min-h-[184px]' : 'p-3 min-h-[118px]'}`}>
        <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-orange-500/5 to-transparent pointer-events-none rounded-xl" />

        <div className="flex items-start gap-3 w-full relative pointer-events-none z-10">
          <div
            className="relative p-2.5 rounded-xl shadow-lg shadow-orange-500/25 bg-gradient-to-tr from-orange-600 via-orange-500 to-amber-400 text-white transform group-hover/card:scale-105 transition-all duration-500 pointer-events-auto cursor-help shrink-0 mt-0.5"
            onMouseEnter={() => setIsHoveringMultiplier(true)}
            onMouseLeave={() => setIsHoveringMultiplier(false)}
          >
            <Flame size={compact ? 28 : 26} className={`${homeStats.streak > 0 ? 'animate-pulse fill-white/20' : ''}`} strokeWidth={2} />
            <AnimatePresence mode="wait">
              {badgeConfig && (
                <motion.div key={homeStats.multiplier} initial={{ opacity: 0, scale: 0.8, rotate: -10 }} animate={{ opacity: 1, scale: 1, rotate: 6 }} exit={{ opacity: 0, scale: 0.8, rotate: 10 }} className="absolute -top-3 -right-8 z-50">
                  <div className={`${badgeConfig.bg} ${badgeConfig.text} border-2 ${badgeConfig.border} px-2 py-0.5 rounded-full shadow-lg flex items-center gap-1 min-w-max`}>
                    <badgeConfig.icon size={13} fill="currentColor" strokeWidth={3} />
                    <span className="text-[11px] font-black leading-none ml-0.5">{formatMultiplierText(homeStats.multiplier)}</span>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
            <AnimatePresence>
              {isHoveringMultiplier && badgeConfig && (
                <motion.div initial={{ opacity: 0, x: -10, scale: 0.9 }} animate={{ opacity: 1, x: 0, scale: 1 }} exit={{ opacity: 0, x: -10, scale: 0.9 }} transition={{ duration: 0.2 }} className="absolute bottom-full left-full -ml-8 mb-2 w-36 bg-zinc-900/95 backdrop-blur-md text-white text-[10px] p-2.5 rounded-xl border border-zinc-700 shadow-2xl z-[100] text-center">
                  <p className="font-bold mb-0.5 uppercase tracking-wider text-orange-400 text-[9px]">Bonus Ativo</p>
                  <p className="leading-tight opacity-90 font-medium">Mantenha a sequencia.</p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div className="flex-1 pointer-events-auto w-full">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="text-[10px] font-black uppercase tracking-[0.16em] bg-gradient-to-r from-orange-600 to-amber-600 dark:from-orange-400 dark:to-amber-400 bg-clip-text text-transparent">
                Sequencia de Estudo
              </h3>
            </div>
            <div className="flex items-baseline gap-2">
              <p className={`${compact ? 'text-4xl' : 'text-3xl'} font-black text-orange-600 dark:text-orange-500 tracking-tighter leading-none drop-shadow-sm`}>{homeStats.streak}</p>
              <span className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wide leading-tight">
                {diasEstudo ? 'dias de estudo seguidos' : 'dias sem falhar'}
              </span>
            </div>
            {diasEstudo && (
              <p className="text-[9px] text-zinc-400 mt-1 flex items-center gap-1">
                <Coffee size={9} className="text-zinc-300" />
                Dias de descanso nao quebram a sequencia
              </p>
            )}
          </div>

          {!compact && (
            <div className="pointer-events-none shrink-0 text-right self-start">
              <span className="hidden sm:flex items-center gap-1 text-[8px] font-black text-zinc-400 uppercase tracking-widest whitespace-nowrap">
                <Calendar size={13} /> Ultimos 12 dias
              </span>
            </div>
          )}
        </div>

        <div className={`flex items-end gap-1.5 w-full mt-auto relative z-20 overflow-visible ${compact ? 'pt-1' : ''}`}>
          {streakDays.map((day, index) => {
            const [, month, dayNum] = day.date.split('-');
            const dateDisplay = `${dayNum}/${month}`;
            const isToday = day.date === dateToYMDLocal(new Date());
            const hideOnMobile = index < Math.max(0, streakDays.length - 10);

            if (day.isRestDay) {
              return (
                <div key={day.date} className={`relative group/day flex-1 flex flex-col items-center gap-0 hover:z-[60] ${hideOnMobile ? 'hidden sm:flex' : 'flex'}`}>
                  <div className={`${compact ? 'h-8' : 'h-7'} w-full flex items-end`}>
                    <div
                      role="button"
                      tabIndex={0}
                      onClick={() => handleDayClick?.(day.date)}
                      onKeyDown={(event) => { if (event.key === 'Enter') handleDayClick?.(day.date); }}
                      className={`relative w-full rounded-md h-full flex items-center justify-center bg-emerald-500 border border-emerald-400 shadow-[0_0_10px_rgba(16,185,129,0.3)] cursor-pointer active:scale-95 transition-all duration-300 ${
                        isToday ? 'ring-1 ring-orange-500' : ''
                      }`}
                    >
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="relative flex h-6 w-6 items-center justify-center rounded-full bg-white/14 ring-1 ring-white/18">
                          <div className="absolute inset-0 rounded-full bg-white/12 blur-[2px]" />
                          <Coffee size={11} className="relative text-white drop-shadow-sm" strokeWidth={2.35} />
                        </div>
                      </div>
                    </div>
                  </div>
                  <span className={`text-[9px] font-bold tracking-tight leading-none mt-1 ${isToday ? 'text-orange-500' : 'text-zinc-400 dark:text-zinc-500'}`}>
                    {dateDisplay}
                  </span>
                </div>
              );
            }

            return (
              <div key={day.date} className={`relative group/day flex-1 flex flex-col items-center gap-0 hover:z-[60] ${hideOnMobile ? 'hidden sm:flex' : 'flex'}`}>
                <div className={`${compact ? 'h-8' : 'h-7'} w-full flex items-end`}>
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => handleDayClick?.(day.date)}
                    onKeyDown={(event) => { if (event.key === 'Enter') handleDayClick?.(day.date); }}
                    className={`w-full rounded-md transition-all duration-300 ease-out border border-white/5
                      ${day.status === 'goal-met-both' ? 'bg-emerald-500 h-full shadow-[0_0_10px_rgba(16,185,129,0.3)]' : ''}
                      ${day.status === 'goal-met-one' ? 'bg-amber-500 h-[75%] shadow-[0_0_10px_rgba(245,158,11,0.3)]' : ''}
                      ${day.status === 'goal-not-met' ? 'bg-red-500 h-[40%] shadow-[0_0_10px_rgba(239,68,68,0.3)]' : ''}
                      ${day.status === 'no-data' ? 'bg-zinc-200 dark:bg-zinc-800/60 h-[10%]' : ''}
                      ${isToday ? 'ring-1 ring-orange-500' : ''}
                      cursor-pointer active:scale-95`}
                  />
                </div>
                <span className={`text-[9px] font-bold tracking-tight leading-none mt-1 ${isToday ? 'text-orange-500' : 'text-zinc-400 dark:text-zinc-500'}`}>
                  {dateDisplay}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );

  if (variant === 'stats') return statsGrid;
  if (variant === 'streak') return streakCard;

  return (
    <div className="space-y-3 md:space-y-4">
      <div className={`${headerSlot ? 'grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_minmax(260px,320px)]' : 'block'} gap-3 md:gap-4 items-start`}>
        {headerSlot && (
          <div className="min-w-0">
            {headerSlot}
          </div>
        )}
        <div id="home-stats-grid" className={`grid grid-cols-2 md:grid-cols-4 gap-1.5 md:gap-2 pt-0 ${headerSlot ? 'xl:grid-cols-2 xl:max-w-[320px] xl:justify-self-end' : ''}`}>
          <StatCard icon={Clock} title="Tempo de Estudo" value={formatDecimalHours(homeStats.totalTimeMinutes)} />
          <StatCard icon={Target} title="Questoes Feitas" value={homeStats.performance.total} />
          <StatCard
            icon={TrendingUp}
            title="Precisao Geral"
            value={`${homeStats.performance.percentage.toFixed(0)}%`}
            subValue={
              <div className="flex items-center gap-1 text-[7.5px] md:text-[8px] font-bold">
                <span className="text-emerald-500 flex items-center gap-0.5">
                  <CheckCircle2 size={8} strokeWidth={3} /> {homeStats.performance.correct}
                </span>
                <span className="text-zinc-300">|</span>
                <span className="text-red-500 flex items-center gap-0.5">
                  <XCircle size={8} strokeWidth={3} /> {homeStats.performance.wrong}
                </span>
              </div>
            }
          />
          <div className="min-w-0 h-full">
            <ActiveContextCard
              activeCicloData={activeCicloData}
              activeCronogramaData={activeCronogramaData}
              preferredContext={preferredContext}
              onPreferredContextChange={onPreferredContextChange}
              onGoToCiclo={() => setActiveTab('ciclos')}
              onGoToCronograma={onGoToCronograma}
            />
          </div>
        </div>
      </div>

      <div className="min-w-0 h-full">
        <div className="dashboard-card p-3 flex flex-col gap-2.5 relative overflow-visible border-l-4 border-l-orange-500 group/card z-20 min-h-[118px] h-full">
          <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-orange-500/5 to-transparent pointer-events-none rounded-xl" />

          <div className="flex items-start gap-2.5 w-full relative pointer-events-none z-10">
            <div
              className="relative p-2.5 rounded-xl shadow-lg shadow-orange-500/25 bg-gradient-to-tr from-orange-600 via-orange-500 to-amber-400 text-white transform group-hover/card:scale-105 transition-all duration-500 pointer-events-auto cursor-help shrink-0 mt-0.5"
              onMouseEnter={() => setIsHoveringMultiplier(true)}
              onMouseLeave={() => setIsHoveringMultiplier(false)}
            >
              <Flame size={26} className={`${homeStats.streak > 0 ? 'animate-pulse fill-white/20' : ''}`} strokeWidth={2} />
              <AnimatePresence mode="wait">
                {badgeConfig && (
                  <motion.div key={homeStats.multiplier} initial={{ opacity: 0, scale: 0.8, rotate: -10 }} animate={{ opacity: 1, scale: 1, rotate: 6 }} exit={{ opacity: 0, scale: 0.8, rotate: 10 }} className="absolute -top-3 -right-8 z-50">
                    <div className={`${badgeConfig.bg} ${badgeConfig.text} border-2 ${badgeConfig.border} px-2 py-0.5 rounded-full shadow-lg flex items-center gap-1 min-w-max`}>
                      <badgeConfig.icon size={13} fill="currentColor" strokeWidth={3} />
                      <span className="text-[11px] font-black leading-none ml-0.5">{formatMultiplierText(homeStats.multiplier)}</span>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
              <AnimatePresence>
                {isHoveringMultiplier && badgeConfig && (
                  <motion.div initial={{ opacity: 0, x: -10, scale: 0.9 }} animate={{ opacity: 1, x: 0, scale: 1 }} exit={{ opacity: 0, x: -10, scale: 0.9 }} transition={{ duration: 0.2 }} className="absolute bottom-full left-full -ml-8 mb-2 w-36 bg-zinc-900/95 backdrop-blur-md text-white text-[10px] p-2.5 rounded-xl border border-zinc-700 shadow-2xl z-[100] text-center">
                    <p className="font-bold mb-0.5 uppercase tracking-wider text-orange-400 text-[9px]">Bonus Ativo</p>
                    <p className="leading-tight opacity-90 font-medium">Mantenha a sequencia.</p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <div className="flex-1 pointer-events-auto">
              <div className="flex items-center gap-2 mb-1">
                <h3 className="text-[10px] font-black uppercase tracking-[0.16em] bg-gradient-to-r from-orange-600 to-amber-600 dark:from-orange-400 dark:to-amber-400 bg-clip-text text-transparent">
                  Sequencia de Estudo
                </h3>
              </div>
              <div className="flex items-baseline gap-2">
                <p className="text-3xl font-black text-orange-600 dark:text-orange-500 tracking-tighter leading-none drop-shadow-sm">{homeStats.streak}</p>
                <span className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wide leading-tight">
                  {diasEstudo ? 'dias de estudo seguidos' : 'dias sem falhar'}
                </span>
              </div>
              {diasEstudo && (
                <p className="text-[9px] text-zinc-400 mt-1 flex items-center gap-1">
                  <Coffee size={9} className="text-zinc-300" />
                  Dias de descanso nao quebram a sequencia
                </p>
              )}
            </div>

            <div className="pointer-events-none shrink-0 text-right self-start">
              <span className="hidden sm:flex items-center gap-1 text-[8px] font-black text-zinc-400 uppercase tracking-widest whitespace-nowrap">
                <Calendar size={13} /> Ultimos 12 dias
              </span>
            </div>
          </div>

          <div className="flex items-end gap-1.5 w-full mt-auto relative z-20 overflow-visible">
            {homeStats.last12Days.map((day, index) => {
              const [, month, dayNum] = day.date.split('-');
              const dateDisplay = `${dayNum}/${month}`;
              const isToday = day.date === dateToYMDLocal(new Date());
              const hideOnMobile = index < 2;

              if (day.isRestDay) {
                return (
                  <div key={day.date} className={`relative group/day flex-1 flex flex-col items-center gap-0 hover:z-[60] ${hideOnMobile ? 'hidden sm:flex' : 'flex'}`}>
                    <div className="w-full h-7 flex items-end">
                      <div
                        role="button"
                        tabIndex={0}
                        onClick={() => handleDayClick(day.date)}
                        onKeyDown={(event) => { if (event.key === 'Enter') handleDayClick(day.date); }}
                        className={`relative w-full rounded-md h-full flex items-center justify-center bg-emerald-500 border border-emerald-400 shadow-[0_0_10px_rgba(16,185,129,0.3)] cursor-pointer active:scale-95 transition-all duration-300 ${
                          isToday ? 'ring-1 ring-orange-500' : ''
                        }`}
                      >
                        <div className="absolute inset-0 flex items-center justify-center">
                          <div className="relative flex h-7 w-7 items-center justify-center rounded-full bg-white/14 ring-1 ring-white/18">
                            <div className="absolute inset-0 rounded-full bg-white/12 blur-[2px]" />
                            <Coffee size={12} className="relative text-white drop-shadow-sm" strokeWidth={2.35} />
                          </div>
                        </div>
                      </div>
                    </div>
                    <span className={`text-[9px] font-bold tracking-tight leading-none mt-1 ${isToday ? 'text-orange-500' : 'text-zinc-400 dark:text-zinc-500'}`}>
                      {dateDisplay}
                    </span>
                  </div>
                );
              }

              return (
                <div key={day.date} className={`relative group/day flex-1 flex flex-col items-center gap-0 hover:z-[60] ${hideOnMobile ? 'hidden sm:flex' : 'flex'}`}>
                    <div className="w-full h-7 flex items-end">
                    <div
                      role="button"
                      tabIndex={0}
                      onClick={() => handleDayClick(day.date)}
                      onKeyDown={(event) => { if (event.key === 'Enter') handleDayClick(day.date); }}
                      className={`w-full rounded-md transition-all duration-300 ease-out border border-white/5
                        ${day.status === 'goal-met-both' ? 'bg-emerald-500 h-full shadow-[0_0_10px_rgba(16,185,129,0.3)]' : ''}
                        ${day.status === 'goal-met-one' ? 'bg-amber-500 h-[75%] shadow-[0_0_10px_rgba(245,158,11,0.3)]' : ''}
                        ${day.status === 'goal-not-met' ? 'bg-red-500 h-[40%] shadow-[0_0_10px_rgba(239,68,68,0.3)]' : ''}
                        ${day.status === 'no-data' ? 'bg-zinc-200 dark:bg-zinc-800/60 h-[10%]' : ''}
                        ${isToday ? 'ring-1 ring-orange-500' : ''}
                        cursor-pointer active:scale-95`}
                    />
                  </div>
                  <span className={`text-[9px] font-bold tracking-tight leading-none mt-1 ${isToday ? 'text-orange-500' : 'text-zinc-400 dark:text-zinc-500'}`}>
                    {dateDisplay}
                  </span>
                </div>
              );
            })}
          </div>
      </div>
    </div>
    </div>
  );
}
