import React, { useMemo } from 'react';
import { ArrowDownRight, ArrowUpRight, Clock3, Minus, Target, TrendingUp, Trophy, Zap } from 'lucide-react';
import { motion } from 'framer-motion';
import EmptyStateCard from '../../components/shared/EmptyStateCard';

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

function WeeklyRankingCard({ bestItems, worstItems, className = '' }) {
  const hasItems = bestItems.length > 0 || worstItems.length > 0;

  const RankingSection = ({ title, icon: Icon, items, type }) => {
    const isHours = type === 'hours';
    const gradient = isHours ? 'from-red-600 to-rose-700' : 'from-emerald-600 to-teal-700';
    const line = isHours ? 'from-red-500 to-rose-600' : 'from-emerald-500 to-teal-600';
    const accent = isHours ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400';
    const visibleItems = items.slice(0, 3);

    return (
      <div className="relative z-10 rounded-2xl border border-zinc-100 bg-zinc-50/45 p-3 dark:border-white/5 dark:bg-white/5">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2">
            <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${gradient} text-white shadow-lg ${isHours ? 'shadow-red-500/15' : 'shadow-emerald-500/15'}`}>
              <Icon size={14} strokeWidth={2.2} />
            </div>
            <p className={`truncate text-[9px] font-black uppercase tracking-[0.2em] ${accent}`}>
              {title}
            </p>
          </div>
          <span className="shrink-0 text-[8px] font-black uppercase tracking-widest text-zinc-400">Top 3</span>
        </div>

        {visibleItems.length > 0 ? (
          <div className="space-y-2">
            {visibleItems.map((item, index) => {
              const value = isHours ? formatMinutes(item.minutes) : `${item.accuracy}%`;
              const progress = isHours ? item.hoursProgress : item.accuracy;
              return (
                <div key={`${type}-${item.disciplina}`} className="flex items-center gap-3">
                  <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-xl text-[11px] font-black ${
                    index === 0
                      ? `bg-gradient-to-br ${gradient} text-white`
                      : 'bg-white text-zinc-400 dark:bg-zinc-900/70 dark:text-zinc-500'
                  }`}>
                    {index + 1}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="mb-1 flex items-center justify-between gap-2">
                      <p className="truncate text-[11px] font-black uppercase tracking-tight text-zinc-800 dark:text-zinc-200" title={item.disciplina}>
                        {item.disciplina}
                      </p>
                      <span className={`shrink-0 text-sm font-black tabular-nums leading-none ${index === 0 ? accent : 'text-zinc-900 dark:text-white'}`}>
                        {value}
                      </span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-zinc-200/70 dark:bg-white/5">
                      <div
                        className={`h-full rounded-full bg-gradient-to-r ${line}`}
                        style={{ width: `${Math.max(6, Math.min(100, progress || 0))}%` }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="py-3 text-center text-[10px] font-bold uppercase tracking-widest text-zinc-400">
            Sem dados suficientes
          </p>
        )}
      </div>
    );
  };

  return (
    <div className={`group relative flex flex-col overflow-hidden rounded-xl border-2 border-l-4 border-zinc-200 !border-l-red-500/20 bg-white p-4 transition-all duration-300 hover:-translate-y-0.5 hover:border-accent-light/50 hover:!border-l-red-500 hover:shadow-glow dark:border-white/10 dark:!border-l-red-500/25 dark:hover:border-accent-light/30 dark:hover:!border-l-red-500 dark:bg-zinc-950 ${className}`}>
      <div className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-red-500/5 blur-[80px] opacity-60 transition-all duration-700 group-hover:opacity-100" />
      <div className="pointer-events-none absolute bottom-4 right-10 h-40 w-40 rounded-full bg-emerald-500/5 blur-[70px] opacity-70 transition-all duration-700" />
      <div className="pointer-events-none absolute -bottom-20 -left-20 h-64 w-64 rounded-full bg-zinc-500/5 blur-[80px] opacity-60 transition-all duration-700" />

      <div className="relative z-10 flex items-start gap-3">
        <div className="relative">
          <div className="absolute inset-0 animate-ping rounded-full bg-red-500/20 opacity-40 duration-[3s]" />
          <div className="relative flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-red-600 to-rose-700 text-white shadow-xl shadow-red-500/20">
            <Trophy size={20} strokeWidth={1.7} />
          </div>
        </div>
        <div className="min-w-0">
          <h3 className="text-lg font-black uppercase tracking-tight text-zinc-900 dark:text-white leading-tight">
            Ranking <span className="bg-gradient-to-r from-red-600 to-rose-700 bg-clip-text text-transparent">Semanal</span>
          </h3>
        </div>
      </div>

      {hasItems ? (
        <div className="relative z-10 mt-5 flex flex-1 flex-col gap-3">
          <RankingSection title="Horas" icon={Trophy} items={bestItems} type="hours" />
          <RankingSection title="Precisao" icon={Target} items={worstItems} type="accuracy" />
        </div>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center mt-6">
          <EmptyStateCard
            icon={Trophy}
            title="Ranking ainda sem dados"
            description="Registre tempo de estudo ou questoes nesta semana para montar seu top 3."
            variant="compact"
            compact
            className="w-full border-none shadow-none bg-transparent"
          />
        </div>
      )}
    </div>
  );
}
function WeekEvolutionCard({ currentWeek, previousWeek, className = '' }) {
  const accuracyDelta = currentWeek.accuracy - previousWeek.accuracy;
  const minutesDelta = currentWeek.minutes - previousWeek.minutes;
  const questionsDelta = currentWeek.questions - previousWeek.questions;
  const hasCurrentData = currentWeek.minutes > 0 || currentWeek.questions > 0;
  const hasPreviousData = previousWeek.minutes > 0 || previousWeek.questions > 0;
  
  const isBetter = minutesDelta > 0 || questionsDelta > 0 || accuracyDelta > 0;
  const isWorse = !isBetter && (minutesDelta < 0 || questionsDelta < 0 || accuracyDelta < 0);
  
  const TrendIcon = isBetter ? ArrowUpRight : isWorse ? ArrowDownRight : Minus;
  const evolutionTone = isBetter
    ? {
      card: 'border-emerald-200 !border-l-emerald-500/60 hover:border-emerald-300 hover:!border-l-emerald-500 hover:shadow-emerald-500/10 dark:border-emerald-500/20 dark:!border-l-emerald-400/40 dark:hover:border-emerald-400/35',
      glow: 'from-emerald-50 via-white to-teal-50 dark:from-emerald-950/20 dark:via-zinc-950 dark:to-teal-950/10',
      icon: 'from-emerald-500 to-teal-600 shadow-emerald-500/20',
      accent: 'from-emerald-600 to-teal-600',
      activePanel: 'border-emerald-500/25 bg-emerald-500/8 dark:border-emerald-500/25 dark:bg-emerald-500/10',
      activeText: 'text-emerald-600 dark:text-emerald-400',
      activeBar: 'bg-gradient-to-r from-emerald-400 to-teal-500 shadow-[0_0_8px_rgba(16,185,129,0.35)]',
      glowSpot: 'bg-emerald-500/8',
    }
    : isWorse
      ? {
        card: 'border-amber-200 !border-l-amber-500/70 hover:border-amber-300 hover:!border-l-amber-500 hover:shadow-amber-500/10 dark:border-amber-500/20 dark:!border-l-amber-400/40 dark:hover:border-amber-400/35',
        glow: 'from-amber-50 via-white to-orange-50 dark:from-amber-950/20 dark:via-zinc-950 dark:to-orange-950/10',
        icon: 'from-amber-500 to-orange-600 shadow-amber-500/20',
        accent: 'from-amber-600 to-orange-600',
        activePanel: 'border-amber-500/25 bg-amber-500/8 dark:border-amber-500/25 dark:bg-amber-500/10',
        activeText: 'text-amber-600 dark:text-amber-400',
        activeBar: 'bg-gradient-to-r from-amber-400 to-orange-500 shadow-[0_0_8px_rgba(245,158,11,0.35)]',
        glowSpot: 'bg-amber-500/8',
      }
      : {
        card: 'border-sky-200 !border-l-sky-500/50 hover:border-sky-300 hover:!border-l-sky-500 hover:shadow-sky-500/10 dark:border-sky-500/20 dark:!border-l-sky-400/35 dark:hover:border-sky-400/30',
        glow: 'from-sky-50 via-white to-zinc-50 dark:from-sky-950/15 dark:via-zinc-950 dark:to-zinc-950',
        icon: 'from-sky-500 to-indigo-600 shadow-sky-500/20',
        accent: 'from-sky-600 to-indigo-600',
        activePanel: 'border-sky-500/25 bg-sky-500/8 dark:border-sky-500/25 dark:bg-sky-500/10',
        activeText: 'text-sky-600 dark:text-sky-400',
        activeBar: 'bg-gradient-to-r from-sky-400 to-indigo-500 shadow-[0_0_8px_rgba(14,165,233,0.32)]',
        glowSpot: 'bg-sky-500/8',
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
    <div className={`relative overflow-hidden rounded-2xl border p-3 transition-all ${
      active
        ? evolutionTone.activePanel
        : 'border-zinc-200 bg-white/85 dark:border-white/5 dark:bg-zinc-900/50'
    }`}>
      <div className="flex items-start justify-between gap-3">
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

      <div className="mt-3 flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[8px] font-black uppercase tracking-widest text-zinc-400">Questões</p>
          <p className="mt-0.5 text-xs font-black tabular-nums text-zinc-900 dark:text-white">{week.questions}</p>
        </div>
        <div className="text-right">
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
        <div className="flex items-start gap-3">
          <div className="relative">
            <div className={`absolute inset-0 animate-ping rounded-full opacity-35 duration-[3s] ${isBetter ? 'bg-emerald-500/20' : isWorse ? 'bg-amber-500/20' : 'bg-sky-500/20'}`} />
            <div className={`relative flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br ${evolutionTone.icon} text-white shadow-xl`}>
              <TrendingUp size={20} strokeWidth={1.7} />
            </div>
          </div>
          <div className="min-w-0">
            <h3 className="text-lg font-black uppercase tracking-tight text-zinc-900 dark:text-white leading-tight">
              Evolução <span className={`bg-gradient-to-r ${evolutionTone.accent} bg-clip-text text-transparent`}>Semanal</span>
            </h3>
          </div>
        </div>
      </div>

      {hasCurrentData ? (
        <div className="relative z-10 mt-5 flex flex-1 flex-col gap-3">
          <div className="grid grid-cols-2 gap-3">
            <WeekComparePanel label="Esta Semana" week={currentWeek} progress={currentProgress} active />
            <WeekComparePanel label="Anterior" week={previousWeek} progress={previousProgress} />
          </div>

          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <div className="h-1 w-1 rounded-full bg-zinc-300 dark:bg-zinc-600" />
              <p className="text-[9px] font-black uppercase tracking-[0.2em] text-zinc-400">Indicadores de Performance</p>
            </div>
            
            <div className="grid grid-cols-3 gap-2">
              <DeltaStat label="Tempo" value={formatDeltaMinutes(minutesDelta)} isPositive={minutesDelta} />
              <DeltaStat label="Questões" value={`${questionsDelta > 0 ? '+' : ''}${questionsDelta}`} isPositive={questionsDelta} />
              <DeltaStat label="Precisão" value={`${accuracyDelta > 0 ? '+' : ''}${accuracyDelta}%`} isPositive={accuracyDelta} />
            </div>
          </div>

          {/* Badge de Status da Evolução */}
          <div className={`mt-auto flex items-center justify-between gap-3 rounded-2xl border p-3 transition-all ${
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
          <EmptyStateCard
            icon={Zap}
            title="Sem comparativo ainda"
            description={hasPreviousData
              ? 'Registre algo nesta semana para mostrar sua evolução.'
              : 'Depois dos primeiros registros, a comparação semanal aparece aqui.'}
            variant="compact"
            compact
            className="w-full border-none shadow-none bg-transparent"
          />
        </div>
      )}
    </div>
  );
}

export default function HomeInsightsCards({
  registrosEstudo = [],
  className = 'grid grid-cols-1 gap-4 md:gap-5 xl:grid-cols-2',
  weakPointClassName = '',
  loadClassName = '',
  onStartStudy,
}) {
  const { bestItems, worstItems, currentWeek, previousWeek } = useMemo(() => {
    const currentWeekRecords = getWeekRecords(registrosEstudo, 0);
    const previousWeekRecords = getWeekRecords(registrosEstudo, -1);
    const disciplineMap = new Map();

    currentWeekRecords.forEach((registro) => {
      const disciplina = registro.disciplinaNome || registro.disciplinaDisplay || registro.disciplina || 'Geral';
      const questions = Number(registro.questoesFeitas) || 0;
      const correct = Number(registro.acertos ?? registro.questoesAcertadas) || 0;
      const minutes = Number(registro.tempoEstudadoMinutos ?? registro.duracaoMinutos) || 0;

      const current = disciplineMap.get(disciplina) || {
        disciplina,
        questions: 0,
        correct: 0,
        minutes: 0,
      };
      current.questions += questions;
      current.correct += correct;
      current.minutes += minutes;
      disciplineMap.set(disciplina, current);
    });

    const disciplineItems = Array.from(disciplineMap.values())
      .filter((item) => item.minutes > 0 || item.questions > 0)
      .map((item) => ({
        ...item,
        accuracy: item.questions > 0 ? Math.round((item.correct / item.questions) * 100) : 0,
      }));

    const maxMinutes = Math.max(...disciplineItems.map((item) => item.minutes), 1);
    const byHours = [...disciplineItems]
      .sort((a, b) => {
        if (b.minutes !== a.minutes) return b.minutes - a.minutes;
        if (b.accuracy !== a.accuracy) return b.accuracy - a.accuracy;
        return b.questions - a.questions;
      })
      .map((item) => ({
        ...item,
        hoursProgress: Math.round((item.minutes / maxMinutes) * 100),
      }));
    const byAccuracy = [...disciplineItems].filter((item) => item.questions > 0).sort((a, b) => {
      if (b.accuracy !== a.accuracy) return b.accuracy - a.accuracy;
      return b.questions - a.questions;
    });

    return {
      bestItems: byHours.slice(0, 3),
      worstItems: byAccuracy.slice(0, 3),
      currentWeek: summarizeRecords(currentWeekRecords),
      previousWeek: summarizeRecords(previousWeekRecords),
    };
  }, [registrosEstudo]);

  return (
    <div className={className}>
      <WeeklyRankingCard bestItems={bestItems} worstItems={worstItems} className={weakPointClassName} />
      <WeekEvolutionCard currentWeek={currentWeek} previousWeek={previousWeek} className={loadClassName} />
    </div>
  );
}
