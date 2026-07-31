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
  ArrowRight,
} from 'lucide-react';
import { resolveLogoUrl } from '../../components/admin/config/editalAssets';
import HomeCardTitle from './HomeCardTitle.jsx';
import HomeEmptyState from './HomeEmptyState.jsx';

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
    <div className="bg-white/95 dark:bg-zinc-950/95 backdrop-blur-md border-2 border-zinc-100 dark:border-white/10 rounded-2xl shadow-2xl px-4 py-3 min-w-[160px]">
      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400 mb-2">
        {label}
      </p>
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-red-500" />
            <span className="text-[11px] font-bold text-zinc-600 dark:text-zinc-400">Tempo</span>
          </div>
          <span className="text-xs font-black text-zinc-900 dark:text-zinc-100">{formatDecimalHours(minutes)}</span>
        </div>
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
            <span className="text-[11px] font-bold text-zinc-600 dark:text-zinc-400">Questoes</span>
          </div>
          <span className="text-xs font-black text-zinc-900 dark:text-zinc-100">{questions}q</span>
        </div>
      </div>
      {data.isToday && (
        <div className="mt-2 pt-2 border-t border-zinc-100 dark:border-white/5 flex items-center gap-1.5">
          <div className="w-1 h-1 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-[9px] font-black uppercase tracking-widest text-emerald-600 dark:text-emerald-400">Hoje</span>
        </div>
      )}
    </div>
  );
};

const StatCard = ({ icon: Icon, title, value, subValue, iconColor = 'text-red-500/10 dark:text-red-500/5', compact = false }) => (
  <div className={`group relative flex flex-col justify-center overflow-hidden rounded-xl border-2 border-l-4 border-zinc-200 !border-l-red-500/20 bg-white shadow-soft transition-all duration-300 hover:-translate-y-0.5 hover:border-accent-light/40 hover:!border-l-red-500 hover:shadow-[0_0_18px_rgba(239,68,68,0.07)] dark:border-white/10 dark:!border-l-red-500/25 dark:bg-zinc-950 dark:hover:border-accent-light/20 dark:hover:!border-l-red-500 dark:hover:shadow-[0_0_22px_rgba(239,68,68,0.08)] ${compact ? 'px-3 py-2.5 h-[86px]' : 'px-3 py-2.5 min-h-[108px]'}`}>
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
    <div className={`absolute -bottom-4 -right-4 ${iconColor} transition-all duration-700 ease-out group-hover:scale-125 group-hover:rotate-[-10deg] z-10 pointer-events-none`}>
      <Icon strokeWidth={1.5} className="h-16 w-16 md:h-20 md:w-20" />
    </div>
  </div>
);

const streakSparkConfig = [
  { x: [0, 8, 14], y: [-2, -19, -34], delay: 0, color: 'bg-orange-200', size: 'h-1.5 w-1.5' },
  { x: [0, -7, -12], y: [-1, -17, -30], delay: 0.28, color: 'bg-red-200', size: 'h-1 w-1' },
  { x: [0, 5, 8], y: [0, -15, -27], delay: 0.56, color: 'bg-amber-100', size: 'h-1 w-1' },
  { x: [0, -4, -8], y: [-2, -20, -36], delay: 0.84, color: 'bg-orange-300', size: 'h-1.5 w-1.5' },
];

const AnimatedStreakFlame = ({ active, compact }) => {
  const iconSize = compact ? 30 : 28;

  return (
    <div className={`${compact ? 'h-9 w-9' : 'h-8 w-8'} relative flex items-center justify-center`}>
      {active && (
        <>
          <motion.div
            animate={{ scale: [1, 1.45, 1], opacity: [0.22, 0.48, 0.22] }}
            transition={{ duration: 2.8, repeat: Infinity, ease: 'easeInOut' }}
            className="absolute inset-0 rounded-full bg-orange-200/35 blur-md"
          />
          <motion.div
            animate={{ scale: [1, 1.2, 1], opacity: [0.28, 0.58, 0.28] }}
            transition={{ duration: 2, repeat: Infinity, delay: 0.35, ease: 'easeInOut' }}
            className="absolute h-6 w-6 rounded-full bg-red-300/25 blur-sm"
          />
        </>
      )}

      <motion.div
        animate={active ? { y: [0, -3, 0], rotate: [-2, 2, -2], scale: [1, 1.06, 1] } : { y: 0, rotate: 0, scale: 1 }}
        transition={active ? { duration: 1.9, repeat: Infinity, ease: 'easeInOut' } : { duration: 0.2 }}
        className="relative z-20"
      >
        <Flame
          size={iconSize}
          className={active ? 'fill-white/25 text-white drop-shadow-[0_0_8px_rgba(255,255,255,0.42)]' : 'text-white/80'}
          strokeWidth={2}
        />
      </motion.div>

      {active && streakSparkConfig.map((spark, index) => (
        <motion.div
          key={index}
          initial={{ opacity: 0, scale: 0.2, x: 0, y: 0 }}
          animate={{ opacity: [0, 1, 0], scale: [0.3, 1, 0.2], x: spark.x, y: spark.y }}
          transition={{ duration: 1.55, repeat: Infinity, delay: spark.delay, ease: 'easeOut' }}
          className={`absolute left-1/2 top-1/2 z-10 rounded-full ${spark.color} ${spark.size} blur-[0.5px]`}
        />
      ))}
    </div>
  );
};

const ActiveContextCard = ({ activeCicloData, activeCronogramaData, preferredContext, onPreferredContextChange, onGoToCiclo, onGoToCronograma, compact = false }) => {
  const hasCiclo = !!activeCicloData;
  const hasCronograma = !!activeCronogramaData;
  const hasBoth = hasCiclo && hasCronograma;
  const preferred = preferredContext === 'ciclo' ? 'ciclo' : 'cronograma';
  const showCiclo = hasBoth ? preferred === 'ciclo' : hasCiclo;

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
  const cardTone = 'border-red-400/30 bg-gradient-to-br from-red-500 via-red-600 to-rose-800 text-white shadow-red-900/20';
  const playTone = 'text-red-600';
  const logoUrl = activeData?.logoUrl || activeData?.logo || resolveLogoUrl({ ciclo: activeData });
  const destinoData = isCiclo ? activeCronogramaData : activeCicloData;
  const destinoLabel = isCiclo ? 'Cronograma' : 'Ciclo';
  const destinoLogo = destinoData?.logoUrl || destinoData?.logo || resolveLogoUrl({ ciclo: destinoData });
  const toggleDestination = isCiclo ? 'cronograma' : 'ciclo';
  const canToggle = hasBoth;
  const handleTrocarClick = (event) => {
    event.stopPropagation();
    onPreferredContextChange?.(toggleDestination);
  };

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={clickHandler}
      onKeyDown={(event) => { if (event.key === 'Enter') clickHandler?.(); }}
      className={`relative overflow-hidden group flex flex-col justify-between rounded-xl shadow-soft transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md active:scale-[0.98] border ${cardTone} ${compact ? 'h-[86px] p-3' : 'h-full p-3.5 min-h-[108px]'}`}
    >
      <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(255,255,255,0.13),transparent_42%,rgba(0,0,0,0.12))] pointer-events-none" />
      <div className="absolute -right-6 -bottom-8 h-24 w-24 rounded-2xl border-[6px] border-white/10 pointer-events-none rotate-45" />

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
          onClick={handleTrocarClick}
          whileHover={{ scale: 1.03, y: -1 }}
          whileTap={{ scale: 0.96 }}
          className="absolute right-2 top-2 z-30 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-white/25 bg-white/95 text-red-600 shadow-lg shadow-black/15 backdrop-blur-sm transition-all duration-200 hover:bg-white hover:shadow-xl"
          title={`Ver ${destinoLabel}`}
          aria-label={`Ver ${destinoLabel}`}
        >
          <ArrowLeftRight size={14} strokeWidth={3} className="flex-shrink-0 transition-colors" />
        </motion.button>
      )}

      <div className="absolute bottom-2 right-2 z-20 flex items-end justify-end">
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
  const hasWeeklyData = weekData.some((day) => day.minutes > 0 || day.questions > 0);

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
        color: '#ef4444',
        softColor: '#fb7185',
        unit: 'h',
        formatter: (value) => (value === 0 ? '' : `${Math.round(value / 60)}h`),
        gradient: 'from-red-600 to-rose-700',
        shadow: 'shadow-red-500/10',
      }
    : {
        label: 'Questoes',
        color: '#6366f1',
        softColor: '#818cf8',
        unit: '',
        formatter: (value) => (value === 0 ? '' : value),
        gradient: 'from-indigo-600 to-blue-700',
        shadow: 'shadow-indigo-500/20',
      };

  const weekLabel = useMemo(() => {
    const first = weekData[0]?.dateStr;
    const last = weekData[6]?.dateStr;
    if (!first || !last) return '';
    const fmt = (value) => value.split('-').reverse().slice(0, 2).join('/');
    return `${fmt(first)} - ${fmt(last)}`;
  }, [weekData]);

  return (
    <div className={`group relative flex flex-col overflow-hidden rounded-xl border-2 border-l-4 border-zinc-200 !border-l-red-500/20 bg-white transition-all duration-300 hover:-translate-y-0.5 hover:border-accent-light/40 hover:!border-l-red-500 hover:shadow-[0_0_18px_rgba(239,68,68,0.07)] dark:border-white/10 dark:!border-l-red-500/25 dark:hover:border-accent-light/20 dark:hover:!border-l-red-500 dark:bg-zinc-950 dark:hover:shadow-[0_0_22px_rgba(239,68,68,0.08)] ${compact ? 'h-full min-h-[220px]' : 'h-full'} z-20`}>
      {/* Decorative Orbs */}
      <div className={`pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full blur-[80px] opacity-10 transition-all duration-700 group-hover:opacity-16 bg-gradient-to-br ${metricConfig.gradient}`} />
      <div className="pointer-events-none absolute -bottom-20 -left-20 h-64 w-64 rounded-full bg-zinc-500/5 blur-[80px] opacity-40 transition-all duration-700" />
      <div className={`relative z-10 flex gap-2 border-b border-zinc-100 dark:border-white/5 bg-zinc-50/30 dark:bg-transparent ${compact ? 'items-start justify-between p-4' : 'items-center justify-between px-5 py-4'}`}>
        <div className="flex min-w-0 items-start gap-3">
          <HomeCardTitle
            icon={TrendingUp}
            eyebrow="Estudo Semanal"
          >
            <div className="flex items-center gap-2 mt-1">
              <button type="button" onClick={() => setWeekOffset((value) => value - 1)} className="w-5 h-5 rounded-lg bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-white/5 hover:bg-zinc-50 dark:hover:bg-zinc-800 flex items-center justify-center transition-all text-zinc-500 shadow-sm">
                <ChevronLeft size={12} strokeWidth={3} />
              </button>
              <span className="text-[10px] font-black text-zinc-400 dark:text-zinc-500 tracking-widest uppercase">{weekLabel}</span>
              <button type="button" onClick={() => setWeekOffset((value) => Math.min(value + 1, 0))} disabled={weekOffset === 0} className={`w-5 h-5 rounded-lg border flex items-center justify-center transition-all text-zinc-500 shadow-sm ${weekOffset === 0 ? 'opacity-30 cursor-not-allowed bg-zinc-50 dark:bg-zinc-900 border-zinc-100 dark:border-white/5' : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-white/5 hover:bg-zinc-50 dark:hover:bg-zinc-800'}`}>
                <ChevronRight size={12} strokeWidth={3} />
              </button>
            </div>
          </HomeCardTitle>
        </div>
        
        <div className="flex shrink-0 items-center gap-2">
          <div className="flex rounded-xl border border-zinc-200/50 bg-zinc-100 p-0.5 gap-0.5 dark:border-white/5 dark:bg-white/5">
            <button 
              type="button" 
              onClick={() => setMetric('hours')} 
              className={`px-2.5 py-1.5 rounded-lg text-[8px] font-black uppercase tracking-widest transition-all ${
                metric === 'hours' 
                  ? `bg-gradient-to-br ${metricConfig.gradient} text-white shadow-lg ${metricConfig.shadow}` 
                  : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'
              }`}
            >
              Horas
            </button>
            <button 
              type="button" 
              onClick={() => setMetric('questions')} 
              className={`px-2.5 py-1.5 rounded-lg text-[8px] font-black uppercase tracking-widest transition-all ${
                metric === 'questions' 
                  ? `bg-gradient-to-br ${metricConfig.gradient} text-white shadow-lg ${metricConfig.shadow}` 
                  : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'
              }`}
            >
              Questoes
            </button>
          </div>
        </div>
      </div>

      <div className={`relative z-10 w-full ${compact ? 'flex-1 min-h-0 p-4' : 'flex-1 min-h-[220px] p-6 pb-2'}`}>
        {hasWeeklyData ? (
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="wkStudyArea" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={metricConfig.color} stopOpacity={0.2} />
                  <stop offset="95%" stopColor={metricConfig.color} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e4e4e7" strokeOpacity={0.4} className="dark:stroke-zinc-800" />
              <XAxis 
                dataKey="date" 
                axisLine={false} 
                tickLine={false} 
                tick={{ fontSize: 10, fill: '#71717a', fontWeight: 800, textAnchor: 'middle' }} 
                dy={10} 
              />
              <YAxis
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 10, fill: metricConfig.color, fontWeight: 800 }}
                tickFormatter={metricConfig.formatter}
              />
              <Tooltip
                content={<WeeklyStudyTooltip />}
                cursor={{ stroke: metricConfig.color, strokeWidth: 2, strokeDasharray: '6 6', strokeOpacity: 0.2 }}
                wrapperStyle={{ zIndex: 100 }}
              />
              <Area
                key={`area-${chartAnimationKey}`}
                type="monotone"
                dataKey="value"
                stroke={metricConfig.color}
                strokeWidth={4}
                fill="url(#wkStudyArea)"
                dot={false}
                activeDot={{ r: 6, fill: metricConfig.color, stroke: '#fff', strokeWidth: 3, shadow: '0 0 10px rgba(0,0,0,0.1)' }}
                isAnimationActive
                animationDuration={1000}
              />
            </ComposedChart>
          </ResponsiveContainer>
        ) : (
          <HomeEmptyState
            icon={TrendingUp}
            title="Semana ainda zerada"
            description="Registre seu primeiro estudo para acompanhar horas e questoes da semana."
            className="h-full min-h-[160px]"
          />
        )}
      </div>

      {!compact && (
        <div className="relative z-10 grid grid-cols-3 gap-3 p-5 pt-2">
          <div className="group/stat rounded-2xl border border-zinc-100 bg-zinc-50/50 p-3 transition-all hover:border-zinc-200 hover:bg-white dark:border-white/5 dark:bg-white/5 dark:hover:bg-white/10">
            <div className="flex items-center gap-2 text-[8px] font-black uppercase tracking-[0.2em] text-zinc-400 group-hover/stat:text-zinc-500">
              <Clock size={12} className="text-zinc-400 group-hover/stat:text-red-500 transition-colors" /> Total
            </div>
            <p className="mt-1 text-base font-black text-zinc-900 dark:text-white leading-none">
              {metric === 'hours' ? formatDecimalHours(weeklySummary.totalMinutes) : weeklySummary.totalQuestions}
            </p>
          </div>
          <div className="group/stat rounded-2xl border border-zinc-100 bg-zinc-50/50 p-3 transition-all hover:border-zinc-200 hover:bg-white dark:border-white/5 dark:bg-white/5 dark:hover:bg-white/10">
            <div className="flex items-center gap-2 text-[8px] font-black uppercase tracking-[0.2em] text-zinc-400 group-hover/stat:text-zinc-500">
              <Flame size={12} className="text-zinc-400 group-hover/stat:text-red-500 transition-colors" /> Ritmo
            </div>
            <p className="mt-1 text-base font-black text-zinc-900 dark:text-white leading-none">
              {weeklySummary.activeDays}<span className="text-[10px] text-zinc-400">/7d</span>
            </p>
          </div>
          <div className="group/stat rounded-2xl border border-zinc-100 bg-zinc-50/50 p-3 transition-all hover:border-zinc-200 hover:bg-white dark:border-white/5 dark:bg-white/5 dark:hover:bg-white/10 overflow-hidden">
            <div className="flex items-center gap-2 text-[8px] font-black uppercase tracking-[0.2em] text-zinc-400 group-hover/stat:text-zinc-500">
              <Crown size={12} className="text-zinc-400 group-hover/stat:text-amber-500 transition-colors" /> Pico
            </div>
            <p className="mt-1 truncate text-base font-black text-zinc-900 dark:text-white leading-none">
              {weeklySummary.bestDay ? (metric === 'hours' ? formatDecimalHours(weeklySummary.bestDay.minutes) : weeklySummary.bestDay.questions) : '0'}
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
      <div className={`group/card relative z-20 flex h-full flex-col gap-2.5 overflow-hidden rounded-xl border-2 border-l-4 border-zinc-200 !border-l-orange-500/25 bg-white transition-all duration-300 hover:-translate-y-0.5 hover:border-orange-400/50 hover:!border-l-orange-500 hover:shadow-[0_0_15px_rgba(249,115,22,0.15)] dark:border-white/10 dark:!border-l-orange-500/30 dark:bg-zinc-950 dark:shadow-[0_0_42px_rgba(249,115,22,0.12)] dark:hover:border-orange-400/30 dark:hover:!border-l-orange-500 dark:hover:shadow-[0_0_52px_rgba(249,115,22,0.2)] ${compact ? 'p-4 min-h-[184px]' : 'p-3 min-h-[118px]'}`}>
        <div className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-gradient-to-br from-orange-600 to-amber-500 opacity-20 blur-[80px] transition-all duration-700 group-hover/card:opacity-40" />
        <div className="pointer-events-none absolute -bottom-20 -left-20 h-64 w-64 rounded-full bg-zinc-500/5 opacity-40 blur-[80px] transition-all duration-700" />
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-orange-500/0 via-orange-500/50 to-orange-500/0" />
        <div className="absolute inset-0 bg-gradient-to-br from-orange-500/5 to-transparent pointer-events-none" />

        <div className="flex items-start gap-3 w-full relative pointer-events-none z-10">
          <div
            className="relative pointer-events-auto cursor-help shrink-0"
            onMouseEnter={() => setIsHoveringMultiplier(true)}
            onMouseLeave={() => setIsHoveringMultiplier(false)}
          >
                <div className="absolute inset-0 animate-ping rounded-full bg-orange-500/20 opacity-35 duration-[3s]" />
                <div className="relative flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-orange-600 via-orange-500 to-amber-500 text-white shadow-lg shadow-orange-500/20 transition-all duration-500 group-hover/card:scale-105">
                <AnimatedStreakFlame active={homeStats.streak > 0} compact={compact} />
                </div>
                <AnimatePresence mode="wait">
                  {badgeConfig && (
                    <motion.div
                      key={homeStats.multiplier}
                      initial={{ opacity: 0, scale: 0.8, rotate: 10 }}
                      animate={{ opacity: 1, scale: 1, rotate: -8 }}
                      exit={{ opacity: 0, scale: 0.8, rotate: -10 }}
                      className="absolute -left-3 -top-3 z-50"
                    >
                      <div className={`${badgeConfig.bg} ${badgeConfig.text} border-2 ${badgeConfig.border} px-2 py-0.5 rounded-full shadow-lg flex items-center gap-1 min-w-max`}>
                        <badgeConfig.icon size={13} fill="currentColor" strokeWidth={3} />
                        <span className="ml-0.5 text-[11px] font-black leading-none">{formatMultiplierText(homeStats.multiplier)}</span>
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

          <div className="min-w-0 flex-1 pointer-events-auto w-full">
            <div className="mb-1 flex items-center gap-2">
              <h3 className="bg-gradient-to-r from-orange-600 to-amber-600 bg-clip-text text-[10px] font-black uppercase tracking-[0.16em] text-transparent dark:from-orange-400 dark:to-amber-400">
                Sequência de Estudo
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
                Dias de descanso não quebram a sequência
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
                      className={`relative w-full rounded-md h-full flex items-center justify-center bg-emerald-500 border border-emerald-400 shadow-[0_0_10px_rgba(16,185,129,0.2)] cursor-pointer active:scale-95 transition-all duration-300 ${
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
                    className={`w-full rounded-md transition-all duration-500 ease-out border border-white/5
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
        {streakCard}
      </div>
    </div>
  );
}
