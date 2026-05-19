import React, { useMemo, useState } from 'react';
import { BarChart3, BookOpen, Clock3, Target, TrendingDown, TrendingUp, Trophy } from 'lucide-react';

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
  if (registro?.data) return registro.data;
  if (registro?.dataRegistro) return registro.dataRegistro;
  if (registro?.timestamp?.toDate) return dateToYMDLocal(registro.timestamp.toDate());
  if (registro?.createdAt?.toDate) return dateToYMDLocal(registro.createdAt.toDate());
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
    acc.minutes += Number(registro.tempoEstudadoMinutos) || 0;
    acc.questions += Number(registro.questoesFeitas) || 0;
    acc.correct += Number(registro.acertos) || 0;
    return acc;
  }, { minutes: 0, questions: 0, correct: 0 });

  return {
    ...totals,
    accuracy: totals.questions > 0 ? Math.round((totals.correct / totals.questions) * 100) : 0,
  };
};

function WeeklyRankingCard({ bestItems, worstItems, className = '' }) {
  const [mode, setMode] = useState('best');
  const isBestMode = mode === 'best';
  const items = isBestMode ? bestItems : worstItems;
  const hasItems = items.length > 0;

  return (
    <div className={`dashboard-card min-h-[178px] p-4 border-l-4 border-l-red-500 flex flex-col relative overflow-hidden ${className}`}>
      <div className="absolute -bottom-8 -right-8 text-red-500/10 pointer-events-none">
        <Trophy size={150} strokeWidth={1.2} />
      </div>

      <div className="relative z-10 flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-red-500 text-white flex items-center justify-center shadow-lg shadow-red-500/20 shrink-0">
            <Trophy size={19} strokeWidth={2.5} />
          </div>
          <div className="min-w-0">
            <h3 className="text-[12px] font-black uppercase tracking-[0.16em] text-red-600 dark:text-red-400">
              Ranking da Semana
            </h3>
            <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 mt-0.5">
              desempenho por disciplina
            </p>
          </div>
        </div>

        <div className="flex shrink-0 rounded-lg border border-zinc-200 bg-zinc-100 p-0.5 dark:border-zinc-800 dark:bg-zinc-900">
          {[
            ['best', 'Melhores'],
            ['worst', 'Piores'],
          ].map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setMode(value)}
              className={`rounded-md px-2 py-1 text-[8px] font-black uppercase tracking-wide transition-all ${
                mode === value
                  ? 'bg-red-500 text-white shadow-sm'
                  : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {hasItems ? (
        <div className="relative z-10 mt-3 flex-1 space-y-2">
          {items.map((item, index) => (
            <div key={`${mode}-${item.disciplina}`} className="rounded-xl border border-zinc-100 bg-white/75 px-3 py-2 shadow-sm dark:border-zinc-800 dark:bg-zinc-950/30">
              <div className="flex items-center gap-2.5">
                <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-[11px] font-black ${
                  index === 0
                    ? 'bg-red-500 text-white shadow-lg shadow-red-500/20'
                    : 'bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-300'
                }`}>
                  {index + 1}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-[11px] font-black text-zinc-900 dark:text-white" title={item.disciplina}>
                      {item.disciplina}
                    </p>
                    <span className="shrink-0 text-[15px] font-black leading-none tracking-tighter text-red-600 dark:text-red-400">
                      {item.accuracy}%
                    </span>
                  </div>
                  <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-red-600 to-rose-400"
                      style={{ width: `${Math.max(6, Math.min(100, item.accuracy))}%` }}
                    />
                  </div>
                </div>
              </div>
              <div className="mt-1.5 flex items-center justify-between gap-2 pl-9 text-[8.5px] font-black uppercase tracking-widest text-zinc-400">
                <span className="flex items-center gap-1">
                  <BookOpen size={9} />
                  {item.questions} questoes
                </span>
                <span className="flex items-center gap-1">
                  <Clock3 size={9} />
                  {formatMinutes(item.minutes)}
                </span>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="relative z-10 flex-1 flex flex-col items-center justify-center text-center opacity-45 py-5">
          <Target size={32} strokeWidth={1.5} />
          <p className="mt-2 text-[10px] font-black uppercase tracking-widest">
            Responda questoes nesta semana para gerar o ranking
          </p>
        </div>
      )}
    </div>
  );
}

function WeekEvolutionCard({ currentWeek, previousWeek, className = '' }) {
  const accuracyDelta = currentWeek.accuracy - previousWeek.accuracy;
  const minutesDelta = currentWeek.minutes - previousWeek.minutes;
  const hasCurrentData = currentWeek.minutes > 0 || currentWeek.questions > 0;

  const MetricPanel = ({ icon: Icon, label, value, previous, delta, subValue, isAccuracy = false }) => {
    const isUp = delta > 0;
    const isDown = delta < 0;
    const DeltaIcon = isUp ? TrendingUp : isDown ? TrendingDown : BarChart3;
    const progress = isAccuracy
      ? Math.max(6, Math.min(100, Number(value) || 0))
      : Math.max(6, Math.min(100, previous > 0 ? (value / Math.max(value, previous)) * 100 : value > 0 ? 100 : 6));
    const previousProgress = isAccuracy
      ? Math.max(6, Math.min(100, Number(previous) || 0))
      : Math.max(6, Math.min(100, Math.max(value, previous) > 0 ? (previous / Math.max(value, previous)) * 100 : 6));

    return (
      <div className="rounded-xl border border-zinc-100 bg-white/75 p-3 shadow-sm dark:border-zinc-800 dark:bg-zinc-950/30">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2.5">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-300">
              <Icon size={15} strokeWidth={2.5} />
            </div>
            <div className="min-w-0">
              <p className="text-[8px] font-black uppercase tracking-widest text-zinc-400">
                {label}
              </p>
              <p className="mt-0.5 text-[22px] font-black leading-none tracking-tighter text-zinc-900 dark:text-white">
                {subValue}
              </p>
            </div>
          </div>
          <div className="shrink-0 text-right">
            <div className="inline-flex items-center gap-1 rounded-md bg-red-50 px-1.5 py-1 text-[9px] font-black text-red-600 dark:bg-red-500/10 dark:text-red-300">
              <DeltaIcon size={10} strokeWidth={3} />
              {isAccuracy ? `${delta > 0 ? '+' : ''}${delta}pp` : formatDeltaMinutes(delta)}
            </div>
            <p className="mt-1 text-[8px] font-black uppercase tracking-widest text-zinc-400">
              vs anterior
            </p>
          </div>
        </div>

        <div className="mt-3 space-y-1.5">
          <div className="h-1.5 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
            <div className="h-full rounded-full bg-gradient-to-r from-red-600 to-rose-400" style={{ width: `${progress}%` }} />
          </div>
          <div className="h-1 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
            <div className="h-full rounded-full bg-zinc-300 dark:bg-zinc-700" style={{ width: `${previousProgress}%` }} />
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className={`dashboard-card min-h-[178px] p-4 border-l-4 border-l-red-500 flex flex-col relative overflow-hidden ${className}`}>
      <div className="absolute -bottom-8 -right-8 text-red-500/10 pointer-events-none">
        <TrendingUp size={150} strokeWidth={1.2} />
      </div>

      <div className="relative z-10 flex items-start justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-red-500 text-white flex items-center justify-center shadow-lg shadow-red-500/20 shrink-0">
            <TrendingUp size={19} strokeWidth={2.5} />
          </div>
          <div className="min-w-0">
            <h3 className="text-[12px] font-black uppercase tracking-[0.16em] text-red-600 dark:text-red-400">
              Evolucao da Semana
            </h3>
            <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 mt-0.5">
              acerto e horas vs anterior
            </p>
          </div>
        </div>
      </div>

      {hasCurrentData ? (
        <div className="relative z-10 mt-3 grid flex-1 grid-cols-1 gap-2.5">
          <MetricPanel
            icon={Target}
            label="Desempenho"
            value={currentWeek.accuracy}
            previous={previousWeek.accuracy}
            delta={accuracyDelta}
            subValue={`${currentWeek.accuracy}%`}
            isAccuracy
          />
          <MetricPanel
            icon={Clock3}
            label="Horas estudadas"
            value={currentWeek.minutes}
            previous={previousWeek.minutes}
            delta={minutesDelta}
            subValue={formatMinutes(currentWeek.minutes)}
          />
        </div>
      ) : (
        <div className="relative z-10 flex-1 flex flex-col items-center justify-center text-center opacity-45 py-5">
          <Clock3 size={32} strokeWidth={1.5} />
          <p className="mt-2 text-[10px] font-black uppercase tracking-widest">
            Registre estudos nesta semana para comparar a evolucao
          </p>
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
}) {
  const { bestItems, worstItems, currentWeek, previousWeek } = useMemo(() => {
    const currentWeekRecords = getWeekRecords(registrosEstudo, 0);
    const previousWeekRecords = getWeekRecords(registrosEstudo, -1);
    const disciplineMap = new Map();

    currentWeekRecords.forEach((registro) => {
      const disciplina = registro.disciplinaNome || registro.disciplinaDisplay || 'Geral';
      const questions = Number(registro.questoesFeitas) || 0;
      const correct = Number(registro.acertos) || 0;
      const minutes = Number(registro.tempoEstudadoMinutos) || 0;

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
      .filter((item) => item.questions >= 3)
      .map((item) => ({
        ...item,
        accuracy: Math.round((item.correct / item.questions) * 100),
      }));

    const byBest = [...disciplineItems].sort((a, b) => {
      if (b.accuracy !== a.accuracy) return b.accuracy - a.accuracy;
      return b.questions - a.questions;
    });
    const byWorst = [...disciplineItems].sort((a, b) => {
      if (a.accuracy !== b.accuracy) return a.accuracy - b.accuracy;
      return b.questions - a.questions;
    });

    return {
      bestItems: byBest.slice(0, 3),
      worstItems: byWorst.slice(0, 3),
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
