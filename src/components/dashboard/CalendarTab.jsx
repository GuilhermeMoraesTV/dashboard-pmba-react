import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
  Clock,
  Target,
  Flame,
  Trophy,
  CalendarDays,
  LayoutGrid,
  ArrowLeft,
  Maximize2,
  Coffee,
} from 'lucide-react';
import DayDetailsModal from './DayDetailsModal.jsx';
import { useForceUnlock } from '../../hooks/useForceUnlock';
import { getAgendaSemana } from '../../services/scheduling/review';
import {
  buildStudyDaysMap,
  dateToYMDLocal,
  getDailyStudyStatus,
} from '../../utils/studyDayStatus';

const formatDecimalHours = (minutos) => {
  if (!minutos || minutos < 0) return '0h';
  const h = Math.floor(minutos / 60);
  const m = Math.round(minutos % 60);
  if (h > 0 && m > 0) return `${h}h${m}`;
  if (h > 0) return `${h}h`;
  return `${m}m`;
};

const formatDecimalHoursLong = (minutos) => {
  if (!minutos || minutos < 0) return '00h 00m';
  const h = Math.floor(minutos / 60);
  const m = Math.round(minutos % 60);
  return `${String(h).padStart(2, '0')}h ${String(m).padStart(2, '0')}m`;
};

const normalizeText = (value) => String(value || '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .trim();

const isReviewRecord = (record) => (
  record?.isRevisao === true ||
  record?.revisao === true ||
  record?.tipoEstudo === 'revisao'
);

const buildReviewRecordKey = (record) => (
  `${record?.disciplinaId || normalizeText(record?.disciplinaNome)}::${normalizeText(record?.assunto)}`
);

const buildCronogramaReviewHistoryRecords = (cronograma, dateStr, existingRecords = []) => {
  const historico = cronograma?.historicoRevisoes || {};
  const existingKeys = new Set(
    existingRecords
      .filter((record) => isReviewRecord(record) && record.data === dateStr)
      .map(buildReviewRecordKey)
  );

  return Object.entries(historico)
    .filter(([, review]) => review?.dataConclusao === dateStr)
    .map(([slotId, review]) => {
      const record = {
        id: `cronograma-review-${slotId}`,
        data: dateStr,
        contextoRegistro: 'cronograma',
        cronogramaId: cronograma?.id || null,
        disciplinaId: review.disciplinaId || null,
        disciplinaNome: review.disciplinaNome || review.disciplina || 'Disciplina',
        assunto: review.assunto || 'Revisao',
        tempoEstudadoMinutos: Number(review.tempoMinutos || 15),
        questoesFeitas: 0,
        acertos: 0,
        tipoEstudo: 'revisao',
        isRevisao: true,
        revisao: true,
        origemConclusao: 'historico_revisao_cronograma',
        origemConclusaoId: `cronograma:revisao:${slotId}:${dateStr}`,
      };
      return existingKeys.has(buildReviewRecordKey(record)) ? null : record;
    })
    .filter(Boolean);
};

const StatCard = ({
  icon: Icon,
  title,
  value,
  subValue,
  className = '',
  iconColorClass = 'text-red-500/10 dark:text-red-500/5',
  iconHoverColorClass = 'group-hover:text-red-500/15 dark:group-hover:text-red-500/10',
  iconExtraClasses = '',
}) => (
  <div className={`group relative flex min-h-[75px] flex-col items-start justify-center overflow-hidden rounded-xl border-2 border-l-4 border-zinc-200 !border-l-red-500/20 bg-white px-3 py-2.5 shadow-soft transition-all duration-300 hover:-translate-y-0.5 hover:border-accent-light/40 hover:!border-l-red-500 hover:shadow-[0_0_18px_rgba(239,68,68,0.07)] dark:border-white/10 dark:!border-l-red-500/25 dark:bg-zinc-950 dark:hover:border-accent-light/20 dark:hover:!border-l-red-500 dark:hover:shadow-[0_0_22px_rgba(239,68,68,0.08)] md:min-h-[85px] ${className}`}>
    <div className="relative z-20 flex flex-col gap-0.5 w-full">
      <h3 className="text-[9px] md:text-[10px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 truncate w-full leading-none">
        {title}
      </h3>
      <div className="flex flex-row items-baseline gap-1.5 mt-0.5">
        <p className="text-xl md:text-2xl font-extrabold text-zinc-800 dark:text-white tracking-tight leading-none">
          {value}
        </p>
        {subValue && (
          <div className="text-[10px] md:text-xs opacity-90 text-zinc-500 dark:text-zinc-400 font-medium leading-none">
            {subValue}
          </div>
        )}
      </div>
    </div>
    <div className={`absolute -bottom-4 -right-4 transition-all duration-700 ease-out group-hover:scale-125 group-hover:rotate-[-10deg] z-10 pointer-events-none ${iconColorClass} ${iconHoverColorClass}`}>
      <Icon strokeWidth={1.5} className={`w-16 h-16 md:w-20 md:h-20 ${iconExtraClasses}`} />
    </div>
  </div>
);

const MiniMonthGrid = ({ monthIndex, year, studyDaysMap, monthlyTotals, onClick, getDayStatus }) => {
  const date = new Date(year, monthIndex, 1);
  const monthName = date.toLocaleDateString('pt-BR', { month: 'long' });
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  const firstDayOfWeek = new Date(year, monthIndex, 1).getDay();

  const totals = monthlyTotals || { hours: 0, questions: 0, daysStudied: 0 };
  const hasActivity = totals.hours > 0 || totals.questions > 0;
  const headerClass = 'bg-gradient-to-r from-zinc-50 via-white to-zinc-50 text-zinc-900 dark:from-zinc-900 dark:via-zinc-950 dark:to-zinc-900 dark:text-white';

  return (
    <motion.div
      whileHover={{ y: -2 }}
      className={`
        flex flex-col overflow-hidden rounded-xl border-2 border-zinc-200 bg-white shadow-soft transition-all duration-300 dark:border-white/10 dark:bg-zinc-950
        ${hasActivity ? 'hover:-translate-y-0.5 hover:border-red-200 hover:shadow-[0_0_18px_rgba(239,68,68,0.07)] dark:hover:border-red-500/25 dark:hover:shadow-[0_0_22px_rgba(239,68,68,0.08)]' : 'opacity-70 hover:opacity-100'}
      `}
      onClick={onClick}
    >
      <div className={`relative border-b border-zinc-100 px-2.5 py-2 text-center dark:border-white/10 ${headerClass}`}>
        <p className="truncate text-[11px] font-black uppercase tracking-[0.16em] sm:text-xs">
          {monthName}
        </p>
        {hasActivity && <Maximize2 size={11} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-red-500/70" />}
      </div>

      <div className="p-1.5 flex-1 cursor-pointer">
        <div className="grid grid-cols-7 mb-1">
          {['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].map((d, i) => (
            <div key={i} className="text-[8px] text-center font-bold text-zinc-400">{d}</div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-0.5">
          {Array.from({ length: firstDayOfWeek }).map((_, i) => (
            <div key={`empty-${i}`} className="aspect-square" />
          ))}

          {Array.from({ length: daysInMonth }).map((_, i) => {
            const dayNum = i + 1;
            const dateStr = `${year}-${String(monthIndex + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
            const dayStatus = getDayStatus(dateStr);
            const isRestDay = dayStatus.isRestDay;

            let bgClass = 'bg-zinc-50 dark:bg-white/[0.04] text-zinc-300';
            if (isRestDay || dayStatus.status === 'goal-met-both') {
              bgClass = 'bg-emerald-500 text-white shadow-sm';
            } else if (dayStatus.status === 'goal-met-one') {
              bgClass = 'bg-amber-500 text-white shadow-sm';
            } else if (dayStatus.status === 'goal-not-met') {
              bgClass = 'bg-red-500 text-white shadow-sm';
            }

            return (
              <div
                key={dayNum}
                className={`aspect-square rounded-[2px] sm:rounded flex items-center justify-center text-[7px] sm:text-[9px] font-medium transition-colors relative ${bgClass}`}
              >
                {isRestDay ? <Coffee size={9} className="sm:w-[10px] sm:h-[10px]" /> : dayNum}
              </div>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-1 border-t border-zinc-100 bg-zinc-50/90 px-2 py-2 text-[10px] font-black text-zinc-700 dark:border-white/10 dark:bg-zinc-900/70 dark:text-zinc-200 sm:text-[11px]">
        <div className="flex min-w-0 items-center justify-center gap-1 rounded-md bg-white px-1.5 py-1 shadow-sm ring-1 ring-zinc-200/70 dark:bg-zinc-950/80 dark:ring-white/10">
          <Clock size={11} className="shrink-0 text-red-500" /> <span className="truncate">{formatDecimalHours(totals.hours)}</span>
        </div>
        <div className="flex min-w-0 items-center justify-center gap-1 rounded-md bg-white px-1.5 py-1 shadow-sm ring-1 ring-zinc-200/70 dark:bg-zinc-950/80 dark:ring-white/10">
          <Target size={11} className="shrink-0 text-red-500" /> <span className="truncate">{totals.questions}</span>
        </div>
      </div>
    </motion.div>
  );
};

function CalendarTab({
  registrosEstudo = [],
  goalsHistory = [],
  onDeleteRegistro,
  activeCicloData = null,
  activeCronogramaData = null,
}) {
  useForceUnlock();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState('year');
  const [selectedDate, setSelectedDate] = useState(null);
  const [homeContextPreferred, setHomeContextPreferred] = useState(() => {
    try { return localStorage.getItem('homeContextPreferred') || 'cronograma'; } catch { return 'cronograma'; }
  });

  useEffect(() => {
    const syncPreferredContext = () => {
      try {
        setHomeContextPreferred(localStorage.getItem('homeContextPreferred') || 'cronograma');
      } catch {
        setHomeContextPreferred('cronograma');
      }
    };

    window.addEventListener('storage', syncPreferredContext);
    window.addEventListener('home-context-preferred-change', syncPreferredContext);
    return () => {
      window.removeEventListener('storage', syncPreferredContext);
      window.removeEventListener('home-context-preferred-change', syncPreferredContext);
    };
  }, []);

  const effectiveContextMode = useMemo(() => {
    const hasCiclo = !!activeCicloData?.id;
    const hasCronograma = !!activeCronogramaData?.id;
    if (hasCiclo && hasCronograma) return homeContextPreferred === 'ciclo' ? 'ciclo' : 'cronograma';
    if (hasCiclo) return 'ciclo';
    if (hasCronograma) return 'cronograma';
    return 'all';
  }, [activeCicloData?.id, activeCronogramaData?.id, homeContextPreferred]);

  const getGoalsForDate = useCallback((dateStr) => {
    if (!goalsHistory || goalsHistory.length === 0) return { questions: 0, hours: 0 };
    const sortedGoals = [...goalsHistory].sort((a, b) => new Date(b.startDate) - new Date(a.startDate));
    return sortedGoals.find((g) => g.startDate <= dateStr) || { questions: 0, hours: 0 };
  }, [goalsHistory]);

  const { studyDays, currentStreak, annualStats, monthlyData, currentMonthStats } = useMemo(() => {
    const days = buildStudyDaysMap(registrosEstudo);
    const months = {};

    const selectedYear = currentDate.getFullYear();
    const currentYearStats = { hours: 0, questions: 0, daysStudied: 0 };
    const currentMonthKey = `${selectedYear}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`;
    const selectedMonthStats = { hours: 0, questions: 0, daysStudied: 0 };

    if (!registrosEstudo || registrosEstudo.length === 0) {
      return {
        studyDays: days,
        currentStreak: 0,
        annualStats: currentYearStats,
        monthlyData: {},
        currentMonthStats: selectedMonthStats,
      };
    }

    registrosEstudo.forEach((item) => {
      try {
        const dateStr = item.data;
        if (!dateStr) return;

        const [y, m] = dateStr.split('-');
        const monthKey = `${y}-${m}`;
        const minutos = Number(item.tempoEstudadoMinutos || 0);
        const questoes = Number(item.questoesFeitas || 0);

        if (!months[monthKey]) months[monthKey] = { hours: 0, questions: 0, daysStudied: 0, rawDays: new Set() };
        months[monthKey].hours += minutos;
        months[monthKey].questions += questoes;
        months[monthKey].rawDays.add(dateStr);

        if (parseInt(y, 10) === selectedYear) {
          currentYearStats.hours += minutos;
          currentYearStats.questions += questoes;
        }

        if (dateStr.startsWith(currentMonthKey)) {
          selectedMonthStats.hours += minutos;
          selectedMonthStats.questions += questoes;
        }
      } catch (e) {
        console.error(e);
      }
    });

    currentYearStats.daysStudied = Object.keys(days).filter((d) => d.startsWith(`${selectedYear}`)).length;
    selectedMonthStats.daysStudied = Object.keys(days).filter((d) => d.startsWith(currentMonthKey)).length;

    Object.keys(months).forEach((k) => {
      months[k].daysStudied = months[k].rawDays.size;
    });

    let streak = 0;
    const today = new Date();
    const todayStr = dateToYMDLocal(today);
    for (let i = 0; i < 90; i++) {
      const dateToCheck = new Date();
      dateToCheck.setDate(today.getDate() - i);
      const dStr = dateToYMDLocal(dateToCheck);
      const dayStatus = getDailyStudyStatus({
        date: dateToCheck,
        studyDaysMap: days,
        activeCronogramaData,
        activeCicloData,
        getAgendaSemana,
        contextMode: effectiveContextMode,
      });

      if (dayStatus.goalMet) streak++;
      else if (dStr !== todayStr) break;
    }

    return {
      studyDays: days,
      currentStreak: streak,
      annualStats: currentYearStats,
      monthlyData: months,
      currentMonthStats: selectedMonthStats,
    };
  }, [registrosEstudo, currentDate, activeCronogramaData, activeCicloData, effectiveContextMode]);

  const getDayStatus = useCallback((dateValue) => getDailyStudyStatus({
    date: dateValue,
    studyDaysMap: studyDays,
    activeCronogramaData,
    activeCicloData,
    getAgendaSemana,
    contextMode: effectiveContextMode,
  }), [studyDays, activeCronogramaData, activeCicloData, effectiveContextMode]);

  const handleDayClick = (dateStr) => {
    const baseRegistros = registrosEstudo.filter((r) => r.data === dateStr);
    const reviewFallbackRecords = buildCronogramaReviewHistoryRecords(activeCronogramaData, dateStr, baseRegistros);
    const dayRegistros = [...baseRegistros, ...reviewFallbackRecords];
    const dayStatus = getDayStatus(dateStr);
    const dayQuestions = dayRegistros.filter((r) => (r.questoesFeitas || 0) > 0);
    const dayHours = dayRegistros.filter((r) => (r.tempoEstudadoMinutos || 0) > 0);
    setSelectedDate({ date: dateStr, dayQuestions, dayHours, isRestDay: Boolean(dayStatus?.isRestDay) });
  };

  const changeMonth = (offset) => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + offset, 1));
  };

  const changeYear = (offset) => {
    setCurrentDate(new Date(currentDate.getFullYear() + offset, currentDate.getMonth(), 1));
  };

  const selectMonth = (monthIndex) => {
    setCurrentDate(new Date(currentDate.getFullYear(), monthIndex, 1));
    setViewMode('month');
  };

  const daysOfWeek = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab'];
  const currentMonth = currentDate.getMonth();
  const currentYear = currentDate.getFullYear();
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const firstDayOfMonth = new Date(currentYear, currentMonth, 1).getDay();
  const todayStr = dateToYMDLocal(new Date());
  const statsToDisplay = viewMode === 'year' ? annualStats : currentMonthStats;
  const statsLabel = viewMode === 'year'
    ? `EM ${currentYear}`
    : new Date(currentYear, currentMonth).toLocaleDateString('pt-BR', { month: 'long' }).toUpperCase();

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      <div className="group relative mb-2 overflow-hidden rounded-xl border-2 border-l-4 border-zinc-200 !border-l-red-500/20 bg-white p-4 shadow-soft transition-all duration-300 hover:border-accent-light/40 hover:!border-l-red-500 hover:shadow-[0_0_18px_rgba(239,68,68,0.07)] dark:border-white/10 dark:!border-l-red-500/25 dark:bg-zinc-950 dark:hover:border-accent-light/20 dark:hover:!border-l-red-500 dark:hover:shadow-[0_0_22px_rgba(239,68,68,0.08)]">
        <div className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-red-500/5 blur-[80px] transition-all duration-700 group-hover:bg-red-500/10" />
        <div className="pointer-events-none absolute -bottom-20 -left-20 h-64 w-64 rounded-full bg-zinc-500/5 blur-[80px]" />
        <div className="relative z-10 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div className="flex min-w-0 items-start gap-3">
            <div className="relative">
              <div className="absolute inset-0 animate-ping rounded-full bg-red-500/20 opacity-30 duration-[3s]" />
              <div className="relative flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-red-600 to-rose-700 text-white shadow-xl shadow-red-500/20">
                <CalendarDays size={22} strokeWidth={2.1} />
              </div>
            </div>
            <div className="min-w-0">
              <h1 className="text-2xl font-black uppercase leading-none tracking-tight text-zinc-900 dark:text-white sm:text-3xl">
                Calendario <span className="bg-gradient-to-r from-red-600 to-rose-700 bg-clip-text text-transparent">de Estudos</span>
              </h1>
              <p className="mt-2 max-w-2xl text-xs font-semibold leading-relaxed text-zinc-500 dark:text-zinc-400 sm:text-sm">
                Visualize sua rotina, revisoes, dias estudados e evolucao mensal em uma agenda unica.
              </p>
            </div>
          </div>

        </div>
      </div>

      <motion.div
        key={viewMode}
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4"
      >
        <StatCard
          icon={Flame}
          title="Sequencia Atual"
          value={currentStreak}
          subValue="dias seguidos"
          iconExtraClasses={currentStreak > 0 ? 'fill-current animate-pulse' : ''}
        />

        <StatCard
          icon={Clock}
          title={`Horas (${statsLabel})`}
          value={formatDecimalHoursLong(statsToDisplay.hours)}
        />
        <StatCard
          icon={Target}
          title={`Questoes (${statsLabel})`}
          value={statsToDisplay.questions}
        />
        <StatCard
          icon={Trophy}
          title="Dias de Estudo"
          value={`${statsToDisplay.daysStudied}`}
          subValue={viewMode === 'year' ? `em ${currentYear}` : `de ${daysInMonth} dias`}
        />
      </motion.div>

      <div id="calendar-container" className="group relative min-h-[500px] overflow-hidden rounded-xl border-2 border-l-4 border-zinc-200 !border-l-red-500/20 bg-white shadow-soft transition-all duration-300 hover:border-accent-light/40 hover:!border-l-red-500 hover:shadow-[0_0_18px_rgba(239,68,68,0.07)] dark:border-white/10 dark:!border-l-red-500/25 dark:bg-zinc-950 dark:hover:border-accent-light/20 dark:hover:!border-l-red-500 dark:hover:shadow-[0_0_22px_rgba(239,68,68,0.08)]">
        <div className="absolute top-[-30px] right-[-10px] opacity-[0.03] dark:opacity-[0.05] pointer-events-none">
          {viewMode === 'year' ? <LayoutGrid size={200} className="text-red-600" /> : <CalendarIcon size={200} className="text-red-600" />}
        </div>

        <div className="relative z-10 grid gap-3 border-b border-zinc-200 bg-zinc-50/80 p-4 dark:border-white/10 dark:bg-zinc-950/70 md:grid-cols-[1fr_auto_1fr] md:items-center">
          {viewMode === 'month' && (
            <button
              onClick={() => setViewMode('year')}
              className="flex w-full items-center justify-center gap-2 rounded-lg border border-zinc-200 bg-white px-4 py-2 text-sm font-bold text-zinc-600 shadow-sm transition-colors hover:bg-zinc-100 dark:border-white/10 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-white/10 md:col-start-1 md:w-auto md:justify-self-start"
            >
              <ArrowLeft size={16} />
              <span className="hidden md:inline">Voltar para o Ano</span>
              <span className="md:hidden">Ano</span>
            </button>
          )}

          <div className="flex items-center justify-center gap-3 text-center md:col-start-2">
            <div className="relative shrink-0">
              <div className="absolute inset-0 animate-ping rounded-full bg-red-500/20 opacity-30 duration-[3s]" />
              <div className="relative flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-red-600 to-rose-700 text-white shadow-xl shadow-red-500/20">
              {viewMode === 'year' ? <LayoutGrid size={20} /> : <CalendarIcon size={20} />}
              </div>
            </div>
            <div>
              <h2 className="text-xl font-extrabold text-zinc-800 dark:text-white capitalize leading-none tracking-tight">
                {viewMode === 'year' ? currentYear : new Date(currentYear, currentMonth).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}
              </h2>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 font-semibold mt-0.5">
                {viewMode === 'year' ? 'Visao Geral do Ano' : 'Detalhes do Mes'}
              </p>
            </div>
          </div>

          <div className="flex items-center justify-center gap-1 rounded-lg border border-zinc-200 bg-white p-1 shadow-sm dark:border-white/10 dark:bg-zinc-900 md:col-start-3 md:justify-self-end">
            <button
              onClick={() => (viewMode === 'year' ? changeYear(-1) : changeMonth(-1))}
              className="rounded-md p-1.5 text-zinc-700 transition-all hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-white/10"
            >
              <ChevronLeft size={18} />
            </button>
            <span className="px-3 text-xs font-bold text-zinc-700 dark:text-zinc-300 min-w-[80px] text-center">
              {viewMode === 'year' ? currentYear : new Date(currentYear, currentMonth).toLocaleDateString('pt-BR', { month: 'short' }).toUpperCase()}
            </span>
            <button
              onClick={() => (viewMode === 'year' ? changeYear(1) : changeMonth(1))}
              className="rounded-md p-1.5 text-zinc-700 transition-all hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-white/10"
            >
              <ChevronRight size={18} />
            </button>
          </div>
        </div>

        <div className="relative z-10 bg-zinc-50/70 p-4 dark:bg-zinc-950/40">
          <AnimatePresence mode="wait">
            {viewMode === 'year' ? (
              <motion.div
                key="year-view"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2 sm:gap-4"
              >
                {Array.from({ length: 12 }).map((_, index) => {
                  const monthKey = `${currentYear}-${String(index + 1).padStart(2, '0')}`;
                  return (
                    <MiniMonthGrid
                      key={index}
                      monthIndex={index}
                      year={currentYear}
                      studyDaysMap={studyDays}
                      monthlyTotals={monthlyData[monthKey]}
                      onClick={() => selectMonth(index)}
                      getDayStatus={getDayStatus}
                    />
                  );
                })}
              </motion.div>
            ) : (
              <motion.div
                key="month-view"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
              >
                <div className="grid grid-cols-7 mb-2">
                  {daysOfWeek.map((day) => (
                    <div key={day} className="text-center text-[10px] md:text-xs font-bold text-zinc-600 dark:text-zinc-400 uppercase tracking-wider">
                      {day}
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-7 gap-1.5 md:gap-2">
                  {Array.from({ length: firstDayOfMonth }).map((_, i) => (
                    <div key={`empty-${i}`} className="min-h-[64px] rounded-lg border border-transparent bg-zinc-100/60 dark:bg-white/[0.03] md:min-h-[85px]" />
                  ))}

                  {Array.from({ length: daysInMonth }).map((_, day) => {
                    const dayNumber = day + 1;
                    const dateObj = new Date(currentYear, currentMonth, dayNumber);
                    const dateStr = dateToYMDLocal(dateObj);
                    const dayData = studyDays[dateStr];
                    const dayStatus = getDayStatus(dateObj);
                    const isRestDay = dayStatus.isRestDay;
                    const hasData = !!dayData && (dayData.questions > 0 || dayData.minutes > 0);
                    const isToday = todayStr === dateStr;

                    let cardClasses = 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-white/10 shadow-sm';
                    let textClasses = 'text-zinc-700 dark:text-zinc-300';

                    if (isRestDay || dayStatus.status === 'goal-met-both') {
                      cardClasses = 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-400 dark:border-emerald-700 shadow-sm';
                      textClasses = 'text-emerald-800 dark:text-emerald-400';
                    } else if (dayStatus.status === 'goal-met-one') {
                      cardClasses = 'bg-amber-50 dark:bg-amber-900/20 border-amber-400 dark:border-amber-700 shadow-sm';
                      textClasses = 'text-amber-800 dark:text-amber-400';
                    } else if (dayStatus.status === 'goal-not-met') {
                      cardClasses = 'bg-red-50 dark:bg-red-900/10 border-red-300 dark:border-red-900/30 shadow-sm';
                      textClasses = 'text-red-800 dark:text-red-400';
                    }

                    if (isToday) {
                      cardClasses += ' ring-2 ring-red-600 ring-offset-2 ring-offset-zinc-100 dark:ring-offset-zinc-900 z-10 font-bold';
                    }

                    return (
                      <motion.button
                        layout
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: day * 0.005 }}
                        key={dateStr}
                        disabled={!hasData}
                        onClick={() => hasData && handleDayClick(dateStr)}
                        className={`
                          relative rounded-lg border p-1 md:p-2 text-left flex flex-col justify-between
                          min-h-[64px] md:min-h-[85px] transition-all duration-200 group
                          ${cardClasses}
                          ${hasData ? 'cursor-pointer hover:shadow-md hover:-translate-y-0.5 hover:brightness-95' : 'cursor-default opacity-80'}
                        `}
                      >
                        <div className="flex justify-between items-start">
                          <span className={`text-sm md:text-base font-bold leading-none ${isToday ? 'text-red-600' : textClasses}`}>
                            {dayNumber}
                          </span>
                          {isRestDay && (
                            <div className="w-full h-full absolute inset-0 flex items-center justify-center pointer-events-none">
                              <Coffee size={18} className="text-emerald-600 dark:text-emerald-300" />
                            </div>
                          )}
                        </div>

                        {!isRestDay && hasData && (
                          <div className="space-y-0.5 mt-1 overflow-hidden">
                            {dayData.minutes > 0 && (
                              <div className="flex items-center gap-1 text-[7px] xs:text-[8px] sm:text-[10px] font-bold text-zinc-700 dark:text-zinc-300 truncate">
                                <Clock size={8} className={`sm:w-[10px] sm:h-[10px] ${dayStatus.status === 'goal-met-both' ? 'text-emerald-600' : dayStatus.status === 'goal-met-one' ? 'text-amber-600' : 'text-zinc-500'}`} />
                                {formatDecimalHours(dayData.minutes)}
                              </div>
                            )}
                            {dayData.questions > 0 && (
                              <div className="flex items-center gap-1 text-[7px] xs:text-[8px] sm:text-[10px] font-bold text-zinc-700 dark:text-zinc-300 truncate">
                                <Target size={8} className={`sm:w-[10px] sm:h-[10px] ${dayStatus.status === 'goal-met-both' ? 'text-emerald-600' : dayStatus.status === 'goal-met-one' ? 'text-amber-600' : 'text-zinc-500'}`} />
                                {dayData.questions} Qst.
                              </div>
                            )}
                          </div>
                        )}
                      </motion.button>
                    );
                  })}
                </div>

                <div className="mt-6 flex flex-wrap justify-center gap-4 rounded-lg border-t border-zinc-200 bg-white/70 p-3 pt-4 text-[10px] dark:border-white/10 dark:bg-zinc-900/60 sm:text-xs">
                  <div className="flex items-center gap-1.5">
                    <div className="w-3 h-3 rounded bg-emerald-500 border border-emerald-600 shadow-sm" />
                    <span className="text-zinc-700 dark:text-zinc-300 font-semibold">Dia concluido</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-3 h-3 rounded bg-emerald-500 border border-emerald-600 shadow-sm flex items-center justify-center">
                      <Coffee size={8} className="text-white" />
                    </div>
                    <span className="text-zinc-700 dark:text-zinc-300 font-semibold">Dia de descanso</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-3 h-3 rounded bg-amber-500 border border-amber-600 shadow-sm" />
                    <span className="text-zinc-700 dark:text-zinc-300 font-semibold">Dia parcial</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-3 h-3 rounded bg-red-600 border border-red-700 shadow-sm" />
                    <span className="text-zinc-700 dark:text-zinc-300 font-semibold">Dia sem estudo</span>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      <AnimatePresence>
        {selectedDate && (
          <DayDetailsModal
            date={selectedDate.date}
            dayData={{ dayQuestions: selectedDate.dayQuestions, dayHours: selectedDate.dayHours }}
            goals={getGoalsForDate(selectedDate.date)}
            isRestDay={Boolean(selectedDate.isRestDay)}
            onClose={() => setSelectedDate(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

export default CalendarTab;
