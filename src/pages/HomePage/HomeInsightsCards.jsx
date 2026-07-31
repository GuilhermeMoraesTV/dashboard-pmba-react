import React, { useMemo } from 'react';
import { ArrowDownRight, ArrowUpRight, Clock3, Minus, TrendingUp, Zap } from 'lucide-react';
import { motion } from 'framer-motion';
import HomeCardTitle from './HomeCardTitle.jsx';
import HomeEmptyState from './HomeEmptyState.jsx';

const dateToYMDLocal = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const getMonday = (date) => {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
};

const addDays = (date, amount) => {
  const d = new Date(date);
  d.setDate(d.getDate() + amount);
  return d;
};

const getRegistroDate = (registro) => {
  if (registro?.data?.toDate) return dateToYMDLocal(registro.data.toDate());
  if (registro?.dataRegistro?.toDate) return dateToYMDLocal(registro.dataRegistro.toDate());
  if (registro?.data instanceof Date) return dateToYMDLocal(registro.data);
  if (registro?.dataRegistro instanceof Date) return dateToYMDLocal(registro.dataRegistro);
  if (registro?.data) return String(registro.data).slice(0, 10);
  if (registro?.dataRegistro) return String(registro.dataRegistro).slice(0, 10);
  if (registro?.timestamp?.toDate) return dateToYMDLocal(registro.timestamp.toDate());
  if (registro?.timestamp instanceof Date) return dateToYMDLocal(registro.timestamp);
  if (registro?.createdAt?.toDate) return dateToYMDLocal(registro.createdAt.toDate());
  if (registro?.createdAt instanceof Date) return dateToYMDLocal(registro.createdAt);
  return null;
};

const getWeekRange = (weekOffset = 0) => {
  const start = addDays(getMonday(new Date()), weekOffset * 7);
  return {
    startKey: dateToYMDLocal(start),
    endKey: dateToYMDLocal(addDays(start, 6)),
  };
};

const getWeekRecords = (registrosEstudo = [], weekOffset = 0) => {
  const { startKey, endKey } = getWeekRange(weekOffset);
  return registrosEstudo.filter((registro) => {
    const date = getRegistroDate(registro);
    return date && date >= startKey && date <= endKey;
  });
};

const formatMinutes = (minutes) => {
  const value = Number(minutes) || 0;
  if (value <= 0) return '0m';
  const hours = Math.floor(value / 60);
  const mins = value % 60;
  if (hours <= 0) return `${mins}m`;
  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
};

const formatDeltaMinutes = (minutes) => {
  const value = Number(minutes) || 0;
  const sign = value > 0 ? '+' : value < 0 ? '-' : '';
  return `${sign}${formatMinutes(Math.abs(value))}`;
};

const summarizeRecords = (records = []) => {
  const totals = records.reduce((acc, registro) => {
    acc.minutes += Number(registro.tempoEstudadoMinutos ?? registro.duracaoMinutos) || 0;
    acc.questions += Number(registro.questoesFeitas) || 0;
    acc.correct += Number(registro.acertos ?? registro.questoesAcertadas) || 0;
    return acc;
  }, { minutes: 0, questions: 0, correct: 0 });

  return {
    ...totals,
    accuracy: totals.questions > 0 ? Math.round((totals.correct / totals.questions) * 100) : 0,
  };
};

function WeekEvolutionCard({ currentWeek, previousWeek, className = '' }) {
  const accuracyDelta = currentWeek.accuracy - previousWeek.accuracy;
  const minutesDelta = currentWeek.minutes - previousWeek.minutes;
  const questionsDelta = currentWeek.questions - previousWeek.questions;
  const hasCurrentData = currentWeek.minutes > 0 || currentWeek.questions > 0;
  const hasPreviousData = previousWeek.minutes > 0 || previousWeek.questions > 0;
  
  const isBetter = minutesDelta > 0 || questionsDelta > 0 || accuracyDelta > 0;
  const isWorse = !isBetter && (minutesDelta < 0 || questionsDelta < 0 || accuracyDelta < 0);
  
  const TrendIcon = isBetter ? ArrowUpRight : isWorse ? ArrowDownRight : Minus;
  const evolutionTone = {
    card: 'border-zinc-200 !border-l-red-500/20 hover:border-accent-light/50 hover:!border-l-red-500 hover:shadow-red-500/10 dark:border-white/10 dark:!border-l-red-500/25 dark:hover:border-accent-light/30',
    glow: 'from-white via-white to-red-50 dark:from-zinc-950 dark:via-zinc-950 dark:to-red-950/10',
    icon: 'from-red-600 to-rose-700 shadow-red-500/20',
    activePanel: 'border-red-500/20 bg-red-500/5 dark:border-red-500/20 dark:bg-red-500/10',
    activeText: 'text-red-600 dark:text-red-400',
    activeBar: 'bg-gradient-to-r from-red-600 to-rose-500 shadow-[0_0_8px_rgba(239,68,68,0.28)]',
    glowSpot: 'bg-red-500/5',
  };
  
  const maxMinutes = Math.max(currentWeek.minutes, previousWeek.minutes, 1);
  const currentProgress = Math.round((currentWeek.minutes / maxMinutes) * 100);
  const previousProgress = Math.round((previousWeek.minutes / maxMinutes) * 100);

  const DeltaStat = ({ label, value, isPositive }) => {
    const tone = isPositive > 0
      ? 'text-emerald-600 dark:text-emerald-400'
      : isPositive < 0
        ? 'text-amber-600 dark:text-amber-400'
        : 'text-zinc-500 dark:text-zinc-400';
    return (
      <div className="min-w-0 rounded-2xl border border-zinc-100 bg-zinc-50/30 px-3 py-2.5 dark:border-white/5 dark:bg-white/5">
        <p className="truncate text-[8px] font-black uppercase tracking-widest text-zinc-400">{label}</p>
        <p className={`mt-1 truncate text-[13px] font-black tabular-nums leading-none ${tone}`}>{value}</p>
      </div>
    );
  };

  const WeekComparePanel = ({ label, week, progress, active = false }) => (
    <div className={`relative overflow-hidden rounded-xl border p-3 transition-all ${
      active
        ? evolutionTone.activePanel
        : 'border-zinc-200 bg-white/85 dark:border-white/5 dark:bg-zinc-900/50'
    }`}>
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className={`text-[8px] font-black uppercase tracking-[0.18em] ${active ? evolutionTone.activeText : 'text-zinc-400'}`}>
            {label}
          </p>
          <p className="mt-1 text-lg font-black tabular-nums tracking-tight text-zinc-900 dark:text-white leading-none">
            {formatMinutes(week.minutes)}
          </p>
        </div>
        <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
          active ? `bg-gradient-to-br ${evolutionTone.icon} text-white shadow-lg` : 'bg-zinc-100 text-zinc-500 dark:bg-white/5 dark:text-zinc-500'
        }`}>
          <Clock3 size={16} strokeWidth={2} />
        </div>
      </div>

      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-zinc-100 dark:bg-white/5">
        <div
          className={`h-full rounded-full transition-all duration-1000 ${active ? evolutionTone.activeBar : 'bg-zinc-300 dark:bg-zinc-700'}`}
          style={{ width: `${Math.max(week.minutes > 0 ? 8 : 0, progress)}%` }}
        />
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <div className="min-w-0 rounded-lg bg-white/70 px-2 py-1.5 dark:bg-white/5">
          <p className="text-[8px] font-black uppercase tracking-widest text-zinc-400">Questões</p>
          <p className="mt-0.5 text-xs font-black tabular-nums text-zinc-900 dark:text-white">{week.questions}</p>
        </div>
        <div className="rounded-lg bg-white/70 px-2 py-1.5 text-right dark:bg-white/5">
          <p className="text-[8px] font-black uppercase tracking-widest text-zinc-400">Precisão</p>
          <p className="mt-0.5 text-xs font-black tabular-nums text-emerald-600 dark:text-emerald-400">{week.accuracy}%</p>
        </div>
      </div>
    </div>
  );

  return (
    <div className={`group relative flex flex-col overflow-hidden rounded-xl border-2 border-l-4 bg-gradient-to-br ${evolutionTone.glow} p-4 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-xl dark:bg-zinc-950 ${evolutionTone.card} ${className}`}>
      <div className={`pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full ${evolutionTone.glowSpot} blur-[80px] opacity-70 transition-all duration-700 group-hover:opacity-100`} />
      <div className="pointer-events-none absolute -bottom-20 -left-20 h-64 w-64 rounded-full bg-zinc-500/5 blur-[80px] transition-all duration-700 opacity-60" />

      <div className="relative z-10 flex items-start justify-between gap-3">
        <HomeCardTitle icon={TrendingUp} eyebrow="Evolução Semanal" />
      </div>

      {hasCurrentData ? (
        <div className="relative z-10 mt-5 flex flex-1 flex-col gap-3">
          <div className="rounded-xl border border-red-500/15 bg-red-500/5 p-3 dark:border-red-500/20 dark:bg-red-500/10">
            <p className="text-[8px] font-black uppercase tracking-[0.2em] text-red-600 dark:text-red-400">
              Saldo semanal
            </p>
            <div className="mt-2 flex items-end justify-between gap-3">
              <div className="min-w-0">
                <p className="text-3xl font-black leading-none tracking-tight text-zinc-900 dark:text-white">
                  {formatDeltaMinutes(minutesDelta)}
                </p>
                <p className="mt-1 text-[9px] font-bold uppercase tracking-widest text-zinc-400">
                  vs. semana anterior
                </p>
              </div>
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-red-600 to-rose-700 text-white shadow-lg shadow-red-500/20">
                <TrendIcon size={20} strokeWidth={2.5} />
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-2.5">
            <WeekComparePanel label="Esta Semana" week={currentWeek} progress={currentProgress} active />
            <WeekComparePanel label="Semana Anterior" week={previousWeek} progress={previousProgress} />
          </div>

          <div className="mt-auto flex flex-col gap-2">
            <div className="grid grid-cols-3 gap-2">
              <DeltaStat label="Tempo" value={formatDeltaMinutes(minutesDelta)} isPositive={minutesDelta} />
              <DeltaStat label="Questões" value={`${questionsDelta > 0 ? '+' : ''}${questionsDelta}`} isPositive={questionsDelta} />
              <DeltaStat label="Precisão" value={`${accuracyDelta > 0 ? '+' : ''}${accuracyDelta}%`} isPositive={accuracyDelta} />
            </div>
          </div>

          <div className={`flex items-center justify-between gap-3 rounded-xl border p-3 transition-all ${
            isBetter 
              ? 'border-emerald-500/20 bg-emerald-500/5 dark:bg-emerald-500/5' 
              : isWorse 
              ? 'border-amber-500/20 bg-amber-500/5 dark:bg-amber-500/5'
              : 'border-zinc-100 bg-zinc-50 dark:border-white/5 dark:bg-white/5'
          }`}>
            <div className="flex items-center gap-3">
              <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl shadow-lg ${
                isBetter ? 'bg-emerald-500 shadow-emerald-500/20' : isWorse ? 'bg-amber-500 shadow-amber-500/20' : 'bg-zinc-400 shadow-zinc-400/20'
              } text-white`}>
                <TrendIcon size={18} strokeWidth={2.5} />
              </div>
              <div className="min-w-0">
                <p className={`text-[11px] font-black uppercase tracking-tight ${
                  isBetter ? 'text-emerald-600 dark:text-emerald-400' : isWorse ? 'text-amber-600 dark:text-amber-400' : 'text-zinc-500'
                }`}>
                  {isBetter ? 'Ritmo em Alta' : isWorse ? 'Ritmo em Queda' : 'Ritmo Estável'}
                </p>
                <p className="mt-0.5 text-[9px] font-bold uppercase tracking-widest text-zinc-400">
                  comparado à semana anterior
                </p>
              </div>
            </div>
            <div className="shrink-0 text-right">
              <p className={`text-lg font-black tabular-nums leading-none ${
                isBetter ? 'text-emerald-600 dark:text-emerald-400' : isWorse ? 'text-amber-600 dark:text-amber-400' : 'text-zinc-500'
              }`}>
                {accuracyDelta > 0 ? `+${accuracyDelta}%` : `${accuracyDelta}%`}
              </p>
              <p className="mt-1 text-[7px] font-black uppercase tracking-widest text-zinc-400">precisão</p>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center mt-6">
          <HomeEmptyState
            icon={Zap}
            title="Sem comparativo ainda"
            description={hasPreviousData
              ? 'Registre algo nesta semana para mostrar sua evolução.'
              : 'Depois dos primeiros registros, a comparação semanal aparece aqui.'}
            className="w-full"
          />
        </div>
      )}
    </div>
  );
}

export default function HomeInsightsCards({
  registrosEstudo = [],
  className = 'grid grid-cols-1 gap-4 md:gap-5 xl:grid-cols-2',
  loadClassName = '',
}) {
  const { currentWeek, previousWeek } = useMemo(() => {
    const currentWeekRecords = getWeekRecords(registrosEstudo, 0);
    const previousWeekRecords = getWeekRecords(registrosEstudo, -1);

    return {
      currentWeek: summarizeRecords(currentWeekRecords),
      previousWeek: summarizeRecords(previousWeekRecords),
    };
  }, [registrosEstudo]);

  return (
    <div className={className}>
      <WeekEvolutionCard currentWeek={currentWeek} previousWeek={previousWeek} className={loadClassName} />
    </div>
  );
}
