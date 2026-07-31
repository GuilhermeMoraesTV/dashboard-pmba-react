import React, { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Activity, Award, BarChart3, BookOpen, CalendarDays, CheckCircle2, Clock3, Target, TrendingUp, XCircle } from 'lucide-react';
import { db } from '../../firebaseConfig';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import DayDetailsModal from '../../components/dashboard/DayDetailsModal.jsx';
import HomeSessao1, { WeeklyBarChart } from './HomeSessao1.jsx';
import HomeSessao2 from './HomeSessao2.jsx';
import HojeCard from './HojeCard.jsx';
import HomeCardTitle from './HomeCardTitle.jsx';
import HomeEmptyState from './HomeEmptyState.jsx';
import { useForceUnlock } from '../../hooks/useForceUnlock';
import { getAgendaSemana } from '../../services/scheduling/review';
import {
  buildStudyDaysMap,
  calculateCurrentStudyStreak,
  dateToYMDLocal,
  getCronogramaStudyDays,
  getCycleStudyDays,
  getDailyStudyStatus,
} from '../../utils/studyDayStatus';

const getRegistroDateKey = (registro) => {
  if (registro?.data) return registro.data;
  if (registro?.dataRegistro) return registro.dataRegistro;
  if (registro?.timestamp?.toDate) return dateToYMDLocal(registro.timestamp.toDate());
  if (registro?.createdAt?.toDate) return dateToYMDLocal(registro.createdAt.toDate());
  return null;
};

const addDays = (date, amount) => {
  const d = new Date(date);
  d.setDate(d.getDate() + amount);
  return d;
};

const formatDecimalHours = (minutes) => {
  const value = Number(minutes || 0) / 60;
  return value >= 10 ? `${value.toFixed(0)}h` : `${value.toFixed(1).replace('.', ',')}h`;
};

const formatHoursMinutes = (minutes) => {
  const total = Math.max(0, Math.round(Number(minutes) || 0));
  const hours = Math.floor(total / 60);
  const mins = total % 60;
  if (hours > 0 && mins > 0) return `${hours}h ${mins}m`;
  if (hours > 0) return `${hours}h`;
  return `${mins}m`;
};

const formatShortDate = (dateKey) => {
  const [, month, day] = String(dateKey || '').split('-');
  return day && month ? `${day}/${month}` : '--/--';
};

const normalizeDisciplineKey = (value) => (
  String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
);

const formatDisciplineDisplayName = (value) => {
  const text = String(value || '').trim();
  if (!text) return '';
  const letters = text.replace(/[^A-Za-zÀ-ÖØ-öø-ÿ]/g, '');
  const hasLowercase = /[a-zà-öø-ÿ]/.test(text);
  if (!letters || hasLowercase) return text;

  const smallWords = new Set(['a', 'as', 'ao', 'aos', 'com', 'da', 'das', 'de', 'do', 'dos', 'e', 'em', 'na', 'nas', 'no', 'nos', 'para', 'por']);
  return text.toLocaleLowerCase('pt-BR').replace(/[A-Za-zÀ-ÖØ-öø-ÿ]+/g, (word, offset) => {
    if (word.length <= 4 && !smallWords.has(word)) return word.toLocaleUpperCase('pt-BR');
    if (offset > 0 && smallWords.has(word)) return word;
    return word.charAt(0).toLocaleUpperCase('pt-BR') + word.slice(1);
  });
};

const getDisciplinaDisplayName = (disciplina) => (
  formatDisciplineDisplayName(
    disciplina?.nome
    || disciplina?.disciplinaNome
    || disciplina?.disciplina
    || disciplina?.label
    || disciplina?.titulo
    || ''
  )
);

const getPlanDisciplines = ({ effectiveHomeContext, activeCronogramaData, activeCicloData, activeCycleDisciplines }) => {
  if (effectiveHomeContext === 'cronograma' && activeCronogramaData?.id) {
    if (Array.isArray(activeCronogramaData.disciplinasSnapshot) && activeCronogramaData.disciplinasSnapshot.length > 0) {
      return activeCronogramaData.disciplinasSnapshot;
    }

    const template = Array.isArray(activeCronogramaData.semanaTemplate) ? activeCronogramaData.semanaTemplate : [];
    return Object.values(template.reduce((acc, slot) => {
      const id = slot?.disciplinaId || slot?.id || slot?.disciplinaNome || slot?.disciplina;
      const nome = slot?.disciplinaNome || slot?.disciplina || slot?.nome;
      if (!id && !nome) return acc;
      const key = String(id || nome);
      if (!acc[key]) acc[key] = { id: key, nome: nome || 'Disciplina' };
      return acc;
    }, {}));
  }

  if (effectiveHomeContext === 'ciclo' && activeCicloData?.id) {
    if (Array.isArray(activeCycleDisciplines) && activeCycleDisciplines.length > 0) return activeCycleDisciplines;
    if (Array.isArray(activeCicloData.disciplinas) && activeCicloData.disciplinas.length > 0) return activeCicloData.disciplinas;
  }

  return [];
};

function DisciplinePerformanceCard({ items, totals, className = '' }) {
  const hasItems = items.length > 0;

  return (
    <div className={`home-discipline-performance-card group relative flex flex-col overflow-hidden rounded-xl border-2 border-l-4 border-zinc-200 !border-l-red-500/20 bg-white p-4 transition-all duration-300 hover:-translate-y-0.5 hover:border-accent-light/50 hover:!border-l-red-500 hover:shadow-glow dark:border-white/10 dark:!border-l-red-500/25 dark:hover:border-accent-light/30 dark:hover:!border-l-red-500 dark:bg-zinc-950 ${className}`}>
      <div className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-red-500/5 blur-[80px] opacity-70 transition-all duration-700 group-hover:opacity-100" />
      <div className="pointer-events-none absolute -bottom-20 -left-20 h-64 w-64 rounded-full bg-zinc-500/5 blur-[80px] opacity-60 transition-all duration-700" />

      <div className="relative z-10 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <HomeCardTitle
          icon={BookOpen}
          eyebrow="Desempenho por Disciplinas"
          className="text-sm lg:text-sm"
        />

        <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-5 lg:w-[410px] xl:w-[430px]">
          {[
            { label: 'Horas', value: formatHoursMinutes(totals.minutes), icon: Clock3, tone: 'text-red-500' },
            { label: 'Questoes', value: totals.questions, icon: Target, tone: 'text-indigo-500' },
            { label: 'Acertos', value: totals.correct, icon: CheckCircle2, tone: 'text-emerald-500' },
            { label: 'Erros', value: totals.wrong, icon: XCircle, tone: 'text-rose-500' },
            { label: 'Precisao', value: `${totals.accuracy}%`, icon: BarChart3, tone: 'text-amber-500' },
          ].map(({ label, value, icon: Icon, tone }) => (
            <div key={label} className="min-w-0 rounded-lg border border-zinc-100 bg-zinc-50/60 px-2 py-1.5 dark:border-white/5 dark:bg-white/5">
              <p className="flex items-center gap-1 text-[7px] font-black uppercase tracking-wider text-zinc-400">
                <Icon size={10} className={tone} />
                {label}
              </p>
              <p className="mt-0.5 truncate text-xs font-black tabular-nums text-zinc-900 dark:text-white">{value}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="relative z-10 mt-4 min-h-0">
        {hasItems ? (
          <div className="home-discipline-performance-table-wrap overflow-x-auto rounded-xl border border-zinc-100 dark:border-white/5">
            <div className="home-discipline-performance-table min-w-[560px]">
              <div className="grid grid-cols-[minmax(180px,1fr)_70px_72px_62px_56px_72px] gap-2 border-b border-zinc-100 bg-zinc-50/80 px-3 py-2 text-[8px] font-black uppercase tracking-widest text-zinc-400 dark:border-white/5 dark:bg-white/5 md:grid-cols-[minmax(260px,1fr)_82px_76px_68px_62px_82px] md:gap-3">
                <span>Disciplina</span>
                <span className="text-right">Horas</span>
                <span className="text-right">Questoes</span>
                <span className="text-right">Acertos</span>
                <span className="text-right">Erros</span>
                <span className="text-right">Precisao</span>
              </div>
              <div className="max-h-[420px] overflow-y-auto divide-y divide-zinc-100 pr-1 dark:divide-white/5 [&::-webkit-scrollbar]:h-1.5 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-zinc-200 dark:[&::-webkit-scrollbar-thumb]:bg-zinc-700">
                {items.map((item) => {
                  const accuracyTone = item.questions === 0
                    ? 'text-zinc-400'
                    : item.accuracy >= 80
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : item.accuracy >= 60
                        ? 'text-amber-600 dark:text-amber-400'
                        : 'text-zinc-600 dark:text-zinc-300';

                  return (
                    <div key={item.key} className="group/discipline-row grid cursor-default grid-cols-[minmax(180px,1fr)_70px_72px_62px_56px_72px] items-center gap-2 px-3 py-2.5 transition-all hover:bg-red-50/70 active:bg-red-50 dark:hover:bg-red-500/10 dark:active:bg-red-500/15 md:grid-cols-[minmax(260px,1fr)_82px_76px_68px_62px_82px] md:gap-3 md:py-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="min-w-0 truncate text-[11px] font-bold normal-case leading-tight text-zinc-900 transition-colors group-hover/discipline-row:text-red-600 dark:text-white dark:group-hover/discipline-row:text-red-400 md:text-xs" title={item.name}>
                          {item.name}
                        </p>
                      </div>
                    </div>

                    <div className="text-right">
                        <p className="text-xs font-black tabular-nums text-zinc-900 dark:text-white">{formatHoursMinutes(item.minutes)}</p>
                      </div>
                    <div className="text-right">
                        <p className="text-xs font-black tabular-nums text-zinc-900 dark:text-white">{item.questions}</p>
                      </div>
                    <div className="text-right">
                        <p className="text-xs font-black tabular-nums text-emerald-600 dark:text-emerald-400">{item.correct}</p>
                      </div>
                    <div className="text-right">
                        <p className="text-xs font-black tabular-nums text-rose-600 dark:text-rose-400">{item.wrong}</p>
                      </div>
                    <div className="text-right">
                        <p className={`text-xs font-black tabular-nums ${accuracyTone}`}>{item.questions > 0 ? `${item.accuracy}%` : '-'}</p>
                      </div>
                  </div>
                  );
                })}
              </div>
            </div>
          </div>
        ) : (
          <HomeEmptyState
            icon={BookOpen}
            title="Sem disciplinas mapeadas"
            description="Quando houver disciplinas no planejamento ou registros de estudo, a lista aparece aqui."
            className="min-h-[220px]"
          />
        )}
      </div>
    </div>
  );
}

function WeeklySummaryCard({ data, className = '' }) {
  const activePct = Math.round((data.activeDays / 7) * 100);
  const maxDayMinutes = Math.max(1, ...data.days.map((day) => day.minutes));
  const status = data.minutes > 0
    ? data.activeDays >= 5 ? 'Ritmo forte' : data.activeDays >= 3 ? 'Ritmo em construcao' : 'Semana iniciada'
    : 'Aguardando registros';

  return (
    <div className={`dashboard-card hidden border-l-4 !border-l-red-500/20 hover:!border-l-red-500 dark:!border-l-red-500/25 dark:hover:!border-l-red-500 p-5 xl:flex flex-col overflow-hidden relative ${className}`}>
      <div className="absolute -right-10 -bottom-12 text-red-500/10 pointer-events-none">
        <BarChart3 size={160} strokeWidth={1.1} />
      </div>
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-red-500/0 via-red-500/50 to-red-500/0" />

      <div className="relative z-10 flex items-start justify-between gap-3">
        <HomeCardTitle
          icon={Activity}
          eyebrow="Resumo da Semana"
        />

        <div
          className="relative flex h-14 w-14 shrink-0 items-center justify-center rounded-full"
          style={{ background: `conic-gradient(#ef4444 ${activePct}%, rgba(113,113,122,0.18) 0)` }}
        >
          <div className="flex h-11 w-11 flex-col items-center justify-center rounded-full bg-white text-zinc-900 shadow-inner dark:bg-zinc-950 dark:text-white">
            <span className="text-sm font-black leading-none">{data.activeDays}</span>
            <span className="text-[7px] font-black uppercase leading-none text-zinc-400">/7</span>
          </div>
        </div>
      </div>

      <div className="relative z-10 mt-4 flex items-end justify-between gap-4">
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-[0.18em] text-zinc-400">
            <Clock3 size={11} className="text-red-500" />
            Horas estudadas
          </p>
          <div className="mt-1 flex items-end gap-2">
            <span className="text-4xl font-black leading-none tracking-tight text-zinc-900 dark:text-white">
              {formatDecimalHours(data.minutes)}
            </span>
            <span className="mb-1 rounded-md bg-red-50 px-1.5 py-0.5 text-[8px] font-black uppercase tracking-wide text-red-600 dark:bg-red-500/10 dark:text-red-300">
              {data.minutes}min
            </span>
          </div>
        </div>

        <div className="grid shrink-0 grid-cols-2 gap-x-4 gap-y-2 text-right">
          <div>
            <p className="text-[8px] font-black uppercase tracking-widest text-zinc-400">Questões</p>
            <p className="mt-0.5 text-lg font-black leading-none text-zinc-900 dark:text-white">{data.questions}</p>
          </div>
          <div>
            <p className="text-[8px] font-black uppercase tracking-widest text-zinc-400">Precisão</p>
            <p className="mt-0.5 text-lg font-black leading-none text-emerald-600 dark:text-emerald-300">{data.accuracy}%</p>
          </div>
          <div className="col-span-2 flex items-center justify-end gap-1 text-[8px] font-black uppercase tracking-widest text-zinc-400">
            <Award size={11} className="text-amber-500" />
            {data.bestDay.minutes > 0 ? `Pico ${data.bestDay.label}` : 'Sem pico'}
          </div>
        </div>
      </div>

      <div className="relative z-10 mt-4">
        <div className="mb-2 flex items-center justify-between">
          <span className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-[0.16em] text-zinc-400">
            <CalendarDays size={11} />
            Distribuição
          </span>
          <span className="text-[9px] font-black uppercase tracking-[0.16em] text-red-500">
            {data.activityScore}% ritmo
          </span>
        </div>
        <div className="flex h-16 items-end gap-2">
          {data.days.map((day) => {
            const height = day.minutes > 0 ? Math.max(16, Math.round((day.minutes / maxDayMinutes) * 56)) : 8;
            const isBest = day.key === data.bestDay.key && day.minutes > 0;
            const hasWork = day.minutes > 0 || day.questions > 0;
            const title = `${day.label}: ${formatDecimalHours(day.minutes)} · ${day.questions}q`;
            return (
              <div key={day.key} className="flex flex-1 flex-col items-center justify-end gap-1" title={title}>
                <div className="flex h-14 w-full items-end rounded-md bg-zinc-100/70 px-1 dark:bg-zinc-900/70">
                  <div
                    className={`w-full rounded-md transition-all ${isBest ? 'bg-gradient-to-t from-red-600 to-rose-400 shadow-[0_0_14px_rgba(239,68,68,0.28)]' : hasWork ? 'bg-gradient-to-t from-red-600 to-red-400' : 'bg-zinc-300 dark:bg-zinc-800'}`}
                    style={{ height }}
                  />
                </div>
                <span className={`text-[8px] font-black uppercase ${isBest ? 'text-red-500' : 'text-zinc-400'}`}>
                  {day.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="relative z-10 mt-4 grid grid-cols-2 gap-3 border-t border-zinc-100 pt-3 dark:border-zinc-800/70">
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 text-[8px] font-black uppercase tracking-widest text-zinc-400">
            <Target size={10} className="text-blue-500" />
            Media ativa
          </p>
          <p className="mt-1 truncate text-sm font-black text-zinc-900 dark:text-white">
            {formatDecimalHours(data.avgMinutes)} por dia
          </p>
        </div>
        <div className="min-w-0 text-right">
          <p className="flex items-center justify-end gap-1.5 text-[8px] font-black uppercase tracking-widest text-zinc-400">
            <TrendingUp size={10} className="text-emerald-500" />
            Aproveitamento
          </p>
          <p className="mt-1 truncate text-sm font-black text-zinc-900 dark:text-white">
            {data.questions > 0 ? `${data.correct}/${data.questions} acertos` : 'Sem questões'}
          </p>
        </div>
      </div>
    </div>
  );
}

function StudyHistoryTimelineCard({ data, className = '' }) {
  if (!data.activeDays) {
    return (
      <div className={`group relative flex flex-col overflow-hidden rounded-xl border-2 border-l-4 border-zinc-200 !border-l-red-500/20 bg-white p-4 transition-all duration-300 hover:-translate-y-0.5 hover:border-accent-light/50 hover:!border-l-red-500 hover:shadow-glow dark:border-white/10 dark:!border-l-red-500/25 dark:hover:border-accent-light/30 dark:hover:!border-l-red-500 dark:bg-zinc-950 ${className}`}>
        <HomeEmptyState
          icon={BarChart3}
          title="Histórico ainda zerado"
          description="Seus últimos dias aparecem aqui depois dos primeiros registros de estudo."
          className="flex-1"
        />
      </div>
    );
  }

  const maxMinutes = Math.max(1, ...data.days.map((day) => day.minutes));
  const getTimeBarTone = (day) => {
    if (day.minutes <= 0) {
      return {
        fill: 'bg-zinc-200 dark:bg-white/5',
        text: 'text-zinc-400 dark:text-zinc-500',
      };
    }

    const ratio = day.minutes / maxMinutes;
    if (ratio >= 0.95) {
      return {
        fill: 'bg-gradient-to-r from-red-600 to-rose-500 shadow-[0_0_10px_rgba(239,68,68,0.34)]',
        text: 'text-red-500',
      };
    }
    if (ratio >= 0.7) {
      return {
        fill: 'bg-gradient-to-r from-rose-500 to-orange-400 shadow-[0_0_8px_rgba(244,63,94,0.22)]',
        text: 'text-rose-500',
      };
    }
    if (ratio >= 0.4) {
      return {
        fill: 'bg-gradient-to-r from-amber-500 to-yellow-400 shadow-[0_0_7px_rgba(245,158,11,0.2)]',
        text: 'text-amber-500',
      };
    }
    return {
      fill: 'bg-zinc-400 dark:bg-zinc-600',
      text: 'text-zinc-500 dark:text-zinc-400',
    };
  };
  return (
    <div className={`group relative flex flex-col overflow-hidden rounded-xl border-2 border-l-4 border-zinc-200 !border-l-red-500/20 bg-white p-4 transition-all duration-300 hover:-translate-y-0.5 hover:border-accent-light/50 hover:!border-l-red-500 hover:shadow-glow dark:border-white/10 dark:!border-l-red-500/25 dark:hover:border-accent-light/30 dark:hover:!border-l-red-500 dark:bg-zinc-950 ${className}`}>
      {/* Decorative Orbs */}
      <div className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-red-500/5 blur-[80px] transition-all duration-700 group-hover:bg-red-500/10" />
      <div className="pointer-events-none absolute -bottom-20 -left-20 h-64 w-64 rounded-full bg-zinc-500/5 blur-[80px] transition-all duration-700 group-hover:bg-zinc-500/10" />

      <div className="relative z-10 flex items-start justify-between gap-4">
        <HomeCardTitle icon={BarChart3} eyebrow="Historico Semanal" />
      </div>


      {/* Timeline Section */}
      <div className="relative z-10 mt-5 flex-1 min-h-0">
        <div className="flex items-center gap-2 mb-2">
          <div className="h-1 w-1 rounded-full bg-zinc-300 dark:bg-zinc-600" />
          <p className="text-[9px] font-black uppercase tracking-[0.2em] text-zinc-400">Linha do Tempo</p>
        </div>

        <div className="space-y-2">
          {data.days.map((day) => {
            const width = day.minutes > 0 ? Math.max(8, Math.round((day.minutes / maxMinutes) * 100)) : 0;
            const isToday = day.key === data.today.key;
            const hasWork = day.minutes > 0 || day.questions > 0;
            const barTone = getTimeBarTone(day);
            
            return (
              <div key={day.key} className="relative flex items-center gap-3 group/item">
                <div className="flex flex-col items-center gap-1 w-10 shrink-0">
                  <p className={`text-[10px] font-black uppercase leading-none ${isToday ? 'text-red-500' : 'text-zinc-500 dark:text-zinc-400'}`}>
                    {isToday ? 'Hoje' : day.label}
                  </p>
                  <p className="text-[8px] font-bold text-zinc-400 leading-none">{formatShortDate(day.key)}</p>
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className={`text-[11px] font-black tabular-nums ${hasWork ? barTone.text : 'text-zinc-400 dark:text-zinc-500'}`}>
                      {formatHoursMinutes(day.minutes)}
                    </span>
                    {hasWork && (
                      <span className="text-[9px] font-bold text-zinc-400 dark:text-zinc-500 tabular-nums">
                        {day.questions}q • {day.accuracy}%
                      </span>
                    )}
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-zinc-100 dark:bg-white/5">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: hasWork ? `${width}%` : '4%' }}
                      className={`h-full rounded-full transition-all duration-500 ${barTone.fill}`}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// COMPONENTE PRINCIPAL HOME PAGE
// ============================================================================
function HomePage({
  registrosEstudo,
  allRegistrosEstudo = [],
  goalsHistory,
  setActiveTab,
  activeCicloData,
  activeCronogramaData,
  onGoToCronograma,
  onGoToRevisao,
  onStartStudy,
  addRegistroEstudo,
  deleteCompletionRegistro,
  user,
  activeCycleDisciplines = [],
  dailyGoalModalBlocked = false,
}) {
  useForceUnlock();
  const [selectedDate, setSelectedDate] = useState(null);
  const [homeContextPreferred, setHomeContextPreferred] = useState(() => {
    try { return localStorage.getItem('homeContextPreferred') || 'cronograma'; } catch { return 'cronograma'; }
  });

  const [unifyStreaks, setUnifyStreaks] = useState(() => {
    const saved = localStorage.getItem('unifyStreaks');
    return saved !== null ? JSON.parse(saved) : false;
  });

  useEffect(() => {
    if (!user) return;
    const loadPrefs = async () => {
      const prefDoc = await getDoc(doc(db, 'users', user.uid, 'settings', 'preferences'));
      if (prefDoc.exists()) {
        const cloudValue = prefDoc.data().unifyStreaks || false;
        setUnifyStreaks(cloudValue);
        localStorage.setItem('unifyStreaks', JSON.stringify(cloudValue));
      }
    };
    loadPrefs();
  }, [user]);

  const updateUnifyPreference = async (value) => {
    setUnifyStreaks(value);
    localStorage.setItem('unifyStreaks', JSON.stringify(value));
    if (user) await setDoc(doc(db, 'users', user.uid, 'settings', 'preferences'), { unifyStreaks: value }, { merge: true });
  };

  const effectiveHomeContext = useMemo(() => {
    const hasCiclo = !!activeCicloData?.id;
    const hasCronograma = !!activeCronogramaData?.id;
    if (hasCiclo && hasCronograma) return homeContextPreferred === 'ciclo' ? 'ciclo' : 'cronograma';
    if (hasCiclo) return 'ciclo';
    if (hasCronograma) return 'cronograma';
    return 'all';
  }, [activeCicloData?.id, activeCronogramaData?.id, homeContextPreferred]);

  const contextRegistrosEstudo = useMemo(() => {
    const source = allRegistrosEstudo?.length ? allRegistrosEstudo : registrosEstudo;
    if (effectiveHomeContext === 'ciclo' && activeCicloData?.id) {
      return source.filter(r => r.cicloId === activeCicloData.id && !r.cronogramaId);
    }
    if (effectiveHomeContext === 'cronograma' && activeCronogramaData?.id) {
      return source.filter(r => r.cronogramaId === activeCronogramaData.id);
    }
    return source;
  }, [allRegistrosEstudo, registrosEstudo, effectiveHomeContext, activeCicloData?.id, activeCronogramaData?.id]);

  const globalRegistrosEstudo = useMemo(
    () => allRegistrosEstudo?.length ? allRegistrosEstudo : registrosEstudo,
    [allRegistrosEstudo, registrosEstudo]
  );

  const updateHomeContextPreferred = (value) => {
    setHomeContextPreferred(value);
    try {
      localStorage.setItem('homeContextPreferred', value);
      window.dispatchEvent(new CustomEvent('home-context-preferred-change', { detail: value }));
    } catch {}
  };

  const handleDayClick = (date) => {
    const source = globalRegistrosEstudo;
    const dayRegistros = source.filter(r => r.data === date);
    const dayStatus = getDailyStudyStatus({
      date,
      studyDaysMap: buildStudyDaysMap(globalRegistrosEstudo),
      activeCronogramaData,
      activeCicloData,
      getAgendaSemana,
      contextMode: effectiveHomeContext,
    });
    setSelectedDate({
      date,
      dayQuestions: dayRegistros.filter(r => (r.questoesFeitas || 0) > 0),
      dayHours:     dayRegistros.filter(r => (r.tempoEstudadoMinutos || 0) > 0),
      isRestDay: Boolean(dayStatus?.isRestDay),
    });
  };

  const getGoalsForDate = (dateStr) => {
    if (!goalsHistory || goalsHistory.length === 0) return { questions: 0, hours: 0 };
    const sortedGoals = [...goalsHistory].sort((a, b) => new Date(b.startDate) - new Date(a.startDate));
    return sortedGoals.find(g => g.startDate <= dateStr) || { questions: 0, hours: 0 };
  };

  // ── Mantém o rótulo do card alinhado ao contexto visível, sem afetar a sequência global ──
  const diasEstudo = useMemo(() => {
    if (effectiveHomeContext === 'cronograma') {
      const diasCronograma = getCronogramaStudyDays(activeCronogramaData);
      return diasCronograma.length > 0 ? new Set(diasCronograma) : null;
    }

    if (effectiveHomeContext === 'ciclo') {
      const diasCiclo = getCycleStudyDays(activeCicloData);
      return diasCiclo.length > 0 ? new Set(diasCiclo) : null;
    }

    return null;
  }, [activeCronogramaData, activeCicloData, effectiveHomeContext]);

  // ── Tabela de Ranking (mantida para uso na página de Desempenho via HomeSessao2) ──
  const tableData = useMemo(() => {
    const map = {};
    (contextRegistrosEstudo || []).forEach(reg => {
      const disc    = reg.disciplinaNome || 'Geral';
      const assunto = reg.assuntoNome || reg.assunto || 'Geral';
      const key     = `${disc}||${assunto}`;
      if (!map[key]) map[key] = { disciplina: disc, assunto, q: 0, c: 0 };
      map[key].q += Number(reg.questoesFeitas) || 0;
      map[key].c += Number(reg.acertos) || 0;
    });
    return Object.values(map).filter(t => t.q > 0);
  }, [contextRegistrosEstudo]);

  // ── Estatísticas Gerais + Streak Inteligente ──────────────────────────────
  const homeStats = useMemo(() => {
    try {
      const studyDaysFull = {};
      let totalQuestions = 0, totalCorrect = 0, totalTimeMinutes = 0;

      contextRegistrosEstudo.forEach(item => {
        totalQuestions   += (item.questoesFeitas || 0);
        totalCorrect     += (item.acertos || 0);
        totalTimeMinutes += (item.tempoEstudadoMinutos || 0);
      });

      Object.assign(studyDaysFull, buildStudyDaysMap(globalRegistrosEstudo));

      const today         = new Date();
      const currentStreak = calculateCurrentStudyStreak({
        studyDaysMap: studyDaysFull,
        goalsHistory,
        activeCronogramaData,
        activeCicloData,
        getAgendaSemana,
        contextMode: effectiveHomeContext,
        today,
      });

      // ── Últimos 12 dias ─────────────────────────────────────────────────
      const last12Days = Array.from({ length: 12 }).map((_, i) => {
        const date    = new Date();
        date.setDate(new Date().getDate() - (11 - i));
        const dateStr  = dateToYMDLocal(date);
        const dayData  = studyDaysFull[dateStr];
        const dayStatus = getDailyStudyStatus({
          date,
          studyDaysMap: studyDaysFull,
          activeCronogramaData,
          activeCicloData,
          getAgendaSemana,
          contextMode: effectiveHomeContext,
        });
        return {
          date: dateStr,
          status: dayStatus.status,
          hasData: dayStatus.hasData,
          minutes: dayData?.minutes || 0,
          questions: dayData?.questions || 0,
          isRestDay: dayStatus.isRestDay,
          completedSlots: dayStatus.completedSlots,
          totalSlots: dayStatus.totalSlots,
        };
      });

      let multiplier = 1.0;
      if (currentStreak >= 30) multiplier = 2.0;
      else if (currentStreak >= 14) multiplier = 1.5;
      else if (currentStreak >= 7)  multiplier = 1.25;

      return {
        streak: currentStreak,
        multiplier: multiplier.toFixed(2),
        last12Days,
        performance: {
          total:      totalQuestions,
          correct:    totalCorrect,
          wrong:      totalQuestions - totalCorrect,
          percentage: totalQuestions > 0 ? (totalCorrect / totalQuestions) * 100 : 0,
        },
        totalTimeMinutes,
      };
    } catch (error) {
      console.error('Erro calculando stats:', error);
      return {
        streak: 0, multiplier: '1.00', last12Days: [],
        performance: { correct: 0, wrong: 0, percentage: 0, total: 0 },
        totalTimeMinutes: 0,
      };
    }
  }, [contextRegistrosEstudo, globalRegistrosEstudo, goalsHistory, activeCronogramaData, activeCicloData, effectiveHomeContext]);

  const disciplinePerformance = useMemo(() => {
    const planDisciplines = getPlanDisciplines({
      effectiveHomeContext,
      activeCronogramaData,
      activeCicloData,
      activeCycleDisciplines,
    });

    const map = new Map();
    const ensureItem = ({ key, name, id, planIndex = 9999 }) => {
      const normalizedKey = normalizeDisciplineKey(key || id || name);
      if (!normalizedKey) return null;

      const current = map.get(normalizedKey);
      if (current) {
        current.name = current.name || name || 'Disciplina';
        current.planIndex = Math.min(current.planIndex, planIndex);
        if (!current.id && id) current.id = id;
        return current;
      }

      const item = {
        key: normalizedKey,
        id: id || null,
        name: name || 'Disciplina',
        minutes: 0,
        questions: 0,
        correct: 0,
        wrong: 0,
        accuracy: 0,
        planIndex,
        hasActivity: false,
      };
      map.set(normalizedKey, item);
      return item;
    };

    planDisciplines.forEach((disciplina, index) => {
      const name = getDisciplinaDisplayName(disciplina);
      const id = disciplina?.id || disciplina?.disciplinaId || name;
      ensureItem({ key: id || name, name, id, planIndex: index });
    });

    (contextRegistrosEstudo || []).forEach((registro) => {
      const name = formatDisciplineDisplayName(registro.disciplinaNome || registro.disciplinaDisplay || registro.disciplina || 'Geral');
      const id = registro.disciplinaId || name;
      const item = ensureItem({ key: id || name, name, id });
      if (!item) return;

      item.minutes += Number(registro.tempoEstudadoMinutos ?? registro.duracaoMinutos) || 0;
      item.questions += Number(registro.questoesFeitas) || 0;
      item.correct += Number(registro.acertos ?? registro.questoesAcertadas) || 0;
    });

    const items = Array.from(map.values()).map((item) => {
      const questions = Math.max(0, item.questions);
      const correct = Math.max(0, item.correct);
      const wrong = Math.max(0, questions - correct);
      return {
        ...item,
        questions,
        correct,
        wrong,
        accuracy: questions > 0 ? Math.round((correct / questions) * 100) : 0,
        hasActivity: item.minutes > 0 || questions > 0,
      };
    }).sort((a, b) => {
      if (a.hasActivity !== b.hasActivity) return a.hasActivity ? -1 : 1;
      if (b.minutes !== a.minutes) return b.minutes - a.minutes;
      if (b.questions !== a.questions) return b.questions - a.questions;
      if (a.planIndex !== b.planIndex) return a.planIndex - b.planIndex;
      return a.name.localeCompare(b.name, 'pt-BR');
    });

    const totals = items.reduce((acc, item) => {
      acc.minutes += item.minutes;
      acc.questions += item.questions;
      acc.correct += item.correct;
      acc.wrong += item.wrong;
      return acc;
    }, { minutes: 0, questions: 0, correct: 0, wrong: 0, accuracy: 0 });
    totals.accuracy = totals.questions > 0 ? Math.round((totals.correct / totals.questions) * 100) : 0;

    return { items, totals };
  }, [activeCronogramaData, activeCicloData, activeCycleDisciplines, contextRegistrosEstudo, effectiveHomeContext]);

  const studyHistory = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dayNames = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab'];
    const days = Array.from({ length: 6 }, (_, index) => {
      const date = addDays(today, -index);
      return {
        key: dateToYMDLocal(date),
        label: dayNames[date.getDay()],
        minutes: 0,
        questions: 0,
        correct: 0,
        accuracy: 0,
      };
    });
    const dayMap = new Map(days.map((day) => [day.key, day]));

    (globalRegistrosEstudo || []).forEach((registro) => {
      const dateKey = getRegistroDateKey(registro);
      const dayData = dayMap.get(dateKey);
      if (!dayData) return;

      dayData.minutes += Number(registro.tempoEstudadoMinutos || 0);
      dayData.questions += Number(registro.questoesFeitas || 0);
      dayData.correct += Number(registro.acertos || 0);
    });

    days.forEach((day) => {
      day.accuracy = day.questions > 0 ? Math.round((day.correct / day.questions) * 100) : 0;
    });

    return {
      today: days[0],
      days,
      activeDays: days.filter((day) => day.minutes > 0 || day.questions > 0).length,
    };
  }, [globalRegistrosEstudo]);

  return (
    <div className="mobile-page-zoom mobile-page-zoom--home animate-slide-up pb-8 relative w-full max-w-7xl mx-auto">
      {/* ① STAT CARDS — 4 cards compactos no topo */}
      {/* ② STREAK + GRÁFICO SEMANAL — logo abaixo dos stats */}
      {/* Ambos gerenciados por HomeSessao1 */}
      <div className="relative z-10 space-y-4 md:space-y-5">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-5 items-stretch xl:grid-cols-[minmax(250px,0.75fr)_minmax(300px,1fr)_minmax(300px,1fr)] xl:grid-rows-[184px_320px_120px_minmax(260px,auto)]">
          <div className="order-1 md:col-span-2 xl:order-none xl:col-span-1">
            <HomeSessao1
              variant="stats"
              compact
              homeStats={homeStats}
              activeCicloData={activeCicloData}
              activeCronogramaData={activeCronogramaData}
              preferredContext={effectiveHomeContext}
              onPreferredContextChange={updateHomeContextPreferred}
              setActiveTab={setActiveTab}
              onGoToCronograma={onGoToCronograma}
            />
          </div>

          <div className="order-4 md:col-span-1 xl:order-none xl:col-start-2 xl:row-start-1 xl:h-full">
            <HomeSessao1
              variant="streak"
              compact
              daysLimit={10}
              homeStats={homeStats}
              handleDayClick={handleDayClick}
              diasEstudo={diasEstudo}
            />
          </div>

          <HomeSessao2
            registrosEstudo={globalRegistrosEstudo}
            tableData={tableData}
            compact
            className="order-3 md:order-2 md:col-start-1 md:col-span-1 xl:order-none xl:col-start-1 xl:row-start-2 xl:row-span-2 xl:h-full xl:self-start"
          />

          <div className="order-5 md:col-span-1 xl:order-none xl:col-start-2 xl:row-start-2 xl:row-span-2 xl:h-full">
            <WeeklyBarChart registrosEstudo={globalRegistrosEstudo} compact />
          </div>

          <HojeCard
            className="order-2 md:order-3 md:col-start-2 md:col-span-1 xl:order-none xl:col-start-3 xl:row-start-1 xl:row-span-3 xl:h-full xl:!min-h-0 xl:!p-4"
            activeCicloData={activeCicloData}
            activeCronogramaData={activeCronogramaData}
            cronogramaId={activeCronogramaData?.id}
            user={user}
            setActiveTab={setActiveTab}
            onGoToStudySession={onStartStudy}
            onGoToCiclo={() => setActiveTab('ciclos')}
            onGoToCronograma={onGoToCronograma}
            onGoToRevisao={onGoToRevisao}
            addRegistroEstudo={addRegistroEstudo}
            deleteCompletionRegistro={deleteCompletionRegistro}
            registrosEstudo={globalRegistrosEstudo}
            preferredContext={homeContextPreferred}
            onPreferredContextChange={updateHomeContextPreferred}
            dailyGoalModalBlocked={dailyGoalModalBlocked}
          />

          <DisciplinePerformanceCard
            items={disciplinePerformance.items}
            totals={disciplinePerformance.totals}
            className="order-7 md:col-span-2 xl:order-none xl:col-start-1 xl:col-span-3 xl:row-start-4 xl:h-full"
          />

        </div>
      </div>

      {/* ③ GUIA DE ESTUDO DO DIA — protagonismo logo após os stats */}
      {/* ④ GRÁFICO DE ESTUDO DE HOJE — apenas TodayChart, sem ranking */}
      {selectedDate && (
        <DayDetailsModal
          date={selectedDate.date}
          dayData={{ dayQuestions: selectedDate.dayQuestions, dayHours: selectedDate.dayHours }}
          goals={getGoalsForDate(selectedDate.date)}
          isRestDay={Boolean(selectedDate.isRestDay)}
          onClose={() => setSelectedDate(null)}
        />
      )}
    </div>
  );
}

export default HomePage;
