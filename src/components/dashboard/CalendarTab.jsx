import React, { useState, useMemo, useCallback } from 'react';
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
  Maximize2
} from 'lucide-react';
import DayDetailsModal from './DayDetailsModal.jsx';
import { useForceUnlock } from '../../hooks/useForceUnlock';

// --- Funções Auxiliares ---
const dateToYMD_local = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

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

// --- Componente de Card de Estatística ---
const StatCard = ({
  icon: Icon,
  title,
  value,
  subValue,
  className = "",
  hoverBorderClass = "hover:border-red-500",
  iconColorClass = "text-red-500/10 dark:text-red-500/5",
  iconHoverColorClass = "group-hover:text-red-500/15 dark:group-hover:text-red-500/10",
  iconExtraClasses = ""
}) => (
  // AJUSTE REALIZADO AQUI: alterado dark:bg-zinc-800 para dark:bg-zinc-900 para padronizar com a Home/Performance
  <div className={`relative overflow-hidden group p-3 md:p-6 h-[110px] md:h-[140px] flex flex-col justify-center items-start transition-all duration-500 hover:shadow-lg border-l-4 border-transparent ${hoverBorderClass} bg-white dark:bg-zinc-900 rounded-2xl shadow-sm ${className}`}>
    <div className="relative z-20 flex flex-col gap-0.5 md:gap-1 w-full">
      <h3 className="text-[10px] md:text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 truncate w-full">
        {title}
      </h3>
      <div className="flex flex-col md:flex-row md:items-end gap-0 md:gap-2">
        <p className="text-2xl md:text-3xl lg:text-4xl font-extrabold text-zinc-800 dark:text-white tracking-tight leading-none">
          {value}
        </p>
        {subValue && (
          <div className="mb-0 md:mb-1 text-xs md:text-sm opacity-90 text-zinc-500 dark:text-zinc-400 font-medium">
            {subValue}
          </div>
        )}
      </div>
    </div>
    <div className={`absolute -bottom-4 -right-4 md:-bottom-6 md:-right-6 transition-all duration-700 ease-out group-hover:scale-125 group-hover:rotate-[-10deg] z-10 pointer-events-none ${iconColorClass} ${iconHoverColorClass}`}>
      <Icon strokeWidth={1.5} className={`w-24 h-24 md:w-36 md:h-36 ${iconExtraClasses}`} />
    </div>
  </div>
);

// --- MINI GRID DO MÊS (Estilo Unificado) ---
const MiniMonthGrid = ({ monthIndex, year, studyDaysMap, monthlyTotals, onClick, getGoalsForDate }) => {
  const date = new Date(year, monthIndex, 1);
  const monthName = date.toLocaleDateString('pt-BR', { month: 'long' });
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  const firstDayOfWeek = new Date(year, monthIndex, 1).getDay(); // 0 = Dom

  const totals = monthlyTotals || { hours: 0, questions: 0, daysStudied: 0 };
  const hasActivity = totals.hours > 0 || totals.questions > 0;

  // COR UNIFICADA (Zinc/Cinza Neutro para todos)
  const headerClass = "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300";

  return (
    <motion.div
      whileHover={{ y: -2 }}
      className={`
        flex flex-col rounded-xl overflow-hidden border transition-all duration-300 bg-white dark:bg-zinc-800 shadow-sm
        ${hasActivity ? 'border-zinc-200 dark:border-zinc-700 hover:shadow-md hover:border-red-300 dark:hover:border-red-800' : 'border-zinc-100 dark:border-zinc-800 opacity-70 hover:opacity-100'}
      `}
      onClick={onClick}
    >
      {/* Header do Mês */}
      <div className={`py-1 px-2 text-center text-[10px] sm:text-xs font-bold uppercase tracking-wider ${headerClass} relative`}>
        {monthName}
        {hasActivity && <Maximize2 size={10} className="absolute right-2 top-1/2 -translate-y-1/2 opacity-50" />}
      </div>

      {/* Grid de Dias */}
      <div className="p-1.5 flex-1 cursor-pointer">
        <div className="grid grid-cols-7 mb-1">
          {['D','S','T','Q','Q','S','S'].map((d, i) => (
            <div key={i} className="text-[8px] text-center font-bold text-zinc-400">{d}</div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-0.5">
          {Array.from({ length: firstDayOfWeek }).map((_, i) => (
            <div key={`empty-${i}`} className="aspect-square"></div>
          ))}

          {Array.from({ length: daysInMonth }).map((_, i) => {
            const dayNum = i + 1;
            const dateStr = `${year}-${String(monthIndex + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
            const dayData = studyDaysMap[dateStr];
            const hasData = !!dayData && (dayData.questions > 0 || dayData.hours > 0);

            let bgClass = "bg-zinc-50 dark:bg-zinc-900 text-zinc-300";

            if (hasData) {
                const goals = getGoalsForDate(dateStr);
                const qGoal = goals?.questions || 0;
                const hGoal = (goals?.hours || 0) * 60;
                const qMet = qGoal === 0 || dayData.questions >= qGoal;
                const hMet = hGoal === 0 || dayData.hours >= hGoal;

                if (qMet && hMet) bgClass = "bg-emerald-500 text-white shadow-sm";
                else if (qMet || hMet) bgClass = "bg-amber-500 text-white shadow-sm";
                else bgClass = "bg-red-500 text-white shadow-sm";
            }

            return (
              <div
                key={dayNum}
                className={`aspect-square rounded-[2px] sm:rounded flex items-center justify-center text-[7px] sm:text-[9px] font-medium transition-colors ${bgClass}`}
              >
                {dayNum}
              </div>
            );
          })}
        </div>
      </div>

      {/* Footer Resumo */}
      <div className="bg-zinc-50 dark:bg-zinc-900/50 border-t border-zinc-100 dark:border-zinc-700/50 py-1 px-2 flex justify-between items-center text-[9px] sm:text-[10px] text-zinc-500 dark:text-zinc-400">
         <div className="flex items-center gap-1">
            <Clock size={10} /> {formatDecimalHours(totals.hours)}
         </div>
         <div className="flex items-center gap-1">
            <Target size={10} /> {totals.questions}
         </div>
      </div>
    </motion.div>
  );
};

function CalendarTab({ registrosEstudo = [], goalsHistory = [], onDeleteRegistro }) {
    useForceUnlock();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState('year');
  const [selectedDate, setSelectedDate] = useState(null);

  const getGoalsForDate = useCallback((dateStr) => {
    if (!goalsHistory || goalsHistory.length === 0) return { questions: 0, hours: 0 };
    const sortedGoals = [...goalsHistory].sort((a, b) => new Date(b.startDate) - new Date(a.startDate));
    return sortedGoals.find(g => g.startDate <= dateStr) || { questions: 0, hours: 0 };
  }, [goalsHistory]);

  // --- Processamento de Dados ---
  const { studyDays, currentStreak, annualStats, monthlyData, currentMonthStats } = useMemo(() => {
    const days = {};
    const months = {};

    const selectedYear = currentDate.getFullYear();
    const currentYearStats = { hours: 0, questions: 0, daysStudied: 0 };

    // Identificador do mês atual selecionado (para filtrar os stats corretamente)
    const currentMonthKey = `${selectedYear}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`;
    const selectedMonthStats = { hours: 0, questions: 0, daysStudied: 0 };

    if (!registrosEstudo || registrosEstudo.length === 0) {
      return { studyDays: {}, currentStreak: 0, annualStats: currentYearStats, monthlyData: {}, currentMonthStats: selectedMonthStats };
    }

    registrosEstudo.forEach(item => {
      try {
        const dateStr = item.data;
        if (!dateStr) return;

        const [y, m] = dateStr.split('-');
        const monthKey = `${y}-${m}`;

        // Dados por Dia
        if (!days[dateStr]) days[dateStr] = { questions: 0, correct: 0, hours: 0 };
        const minutos = Number(item.tempoEstudadoMinutos || 0);
        const questoes = Number(item.questoesFeitas || 0);
        const acertos = Number(item.acertos || 0);

        days[dateStr].hours += minutos;
        days[dateStr].questions += questoes;
        days[dateStr].correct += acertos;

        // Dados por Mês (Agregado)
        if (!months[monthKey]) months[monthKey] = { hours: 0, questions: 0, daysStudied: 0, rawDays: new Set() };
        months[monthKey].hours += minutos;
        months[monthKey].questions += questoes;
        months[monthKey].rawDays.add(dateStr);

        // Stats do Ano Atual
        if (parseInt(y) === selectedYear) {
            currentYearStats.hours += minutos;
            currentYearStats.questions += questoes;
        }

        // Stats do Mês Atual Selecionado
        if (dateStr.startsWith(currentMonthKey)) {
            selectedMonthStats.hours += minutos;
            selectedMonthStats.questions += questoes;
        }
      } catch (e) { console.error(e); }
    });

    currentYearStats.daysStudied = Object.keys(days).filter(d => d.startsWith(`${selectedYear}`)).length;
    selectedMonthStats.daysStudied = Object.keys(days).filter(d => d.startsWith(currentMonthKey)).length;

    Object.keys(months).forEach(k => {
        months[k].daysStudied = months[k].rawDays.size;
    });

    // Streak
    let streak = 0;
    const today = new Date();
    const todayStr = dateToYMD_local(today);
    for (let i = 0; i < 90; i++) {
        const dateToCheck = new Date();
        dateToCheck.setDate(today.getDate() - i);
        const dStr = dateToYMD_local(dateToCheck);
        const dayData = days[dStr];
        if (dayData) {
            const goals = getGoalsForDate(dStr);
            const met = (goals.hours === 0 || dayData.hours >= goals.hours * 60) && (goals.questions === 0 || dayData.questions >= goals.questions);
            if (met) streak++; else if (dStr !== todayStr) break;
        } else if (dStr !== todayStr) break;
    }

    return {
        studyDays: days,
        currentStreak: streak,
        annualStats: currentYearStats,
        monthlyData: months,
        currentMonthStats: selectedMonthStats
    };
  }, [registrosEstudo, currentDate, getGoalsForDate]);


  // --- Navegação ---
  const handleDayClick = (dateStr) => {
    const dayRegistros = registrosEstudo.filter(r => r.data === dateStr);
    const dayQuestions = dayRegistros.filter(r => (r.questoesFeitas || 0) > 0);
    const dayHours = dayRegistros.filter(r => (r.tempoEstudadoMinutos || 0) > 0);
    setSelectedDate({ date: dateStr, dayQuestions, dayHours });
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

  const daysOfWeek = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
  const currentMonth = currentDate.getMonth();
  const currentYear = currentDate.getFullYear();
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const firstDayOfMonth = new Date(currentYear, currentMonth, 1).getDay();
  const todayStr = dateToYMD_local(new Date());

  // CORREÇÃO: Usar currentMonthStats quando estiver no modo 'month'
  const statsToDisplay = viewMode === 'year' ? annualStats : currentMonthStats;
  const statsLabel = viewMode === 'year' ? `EM ${currentYear}` : new Date(currentYear, currentMonth).toLocaleDateString('pt-BR', { month: 'long' }).toUpperCase();

  return (
    <div className="space-y-6 animate-fade-in pb-12">

      {/* --- CABEÇALHO --- */}
      <div className="mb-2 border-b border-zinc-200 dark:border-zinc-800 pb-4">
        <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
                <div className="p-2.5 bg-red-100 dark:bg-red-900/20 text-red-600 dark:text-red-500 rounded-xl">
                    <CalendarDays size={28} strokeWidth={2} />
                </div>
                <h1 className="text-3xl font-black text-zinc-800 dark:text-white tracking-tight uppercase">
                    Calendário de Estudos
                </h1>
            </div>

            {viewMode === 'month' && (
                <button
                    onClick={() => setViewMode('year')}
                    className="flex items-center gap-2 px-4 py-2 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-lg text-sm font-bold text-zinc-600 dark:text-zinc-300 transition-colors"
                >
                    <ArrowLeft size={16} />
                    <span className="hidden md:inline">Voltar para o Ano</span>
                    <span className="md:hidden">Ano</span>
                </button>
            )}
        </div>
      </div>

      {/* --- Stats Grid (Mostra Ano ou Mês dependendo da View) --- */}
      <motion.div
        key={viewMode}
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4"
      >
        <StatCard
          icon={Flame}
          title="Sequência Atual"
          value={currentStreak}
          subValue="dias seguidos"
          hoverBorderClass="hover:border-orange-500"
          iconColorClass="text-orange-500/10 dark:text-orange-500/5"
          iconHoverColorClass="group-hover:text-orange-500/15 dark:group-hover:text-orange-500/10"
          iconExtraClasses={currentStreak > 0 ? "fill-current animate-pulse" : ""}
        />

        <StatCard
          icon={Clock}
          title={`Horas (${statsLabel})`}
          value={formatDecimalHoursLong(statsToDisplay.hours)}
        />
        <StatCard
          icon={Target}
          title={`Questões (${statsLabel})`}
          value={statsToDisplay.questions}
        />
        <StatCard
          icon={Trophy}
          title={`Dias de Estudo`}
          value={`${statsToDisplay.daysStudied}`}
          subValue={viewMode === 'year' ? `em ${currentYear}` : `de ${daysInMonth} dias`}
        />
      </motion.div>

      {/* --- CONTEÚDO PRINCIPAL (MÊS vs ANO) --- */}
      <div id="calendar-container" className="bg-white dark:bg-zinc-900 rounded-2xl shadow-sm border border-zinc-300 dark:border-zinc-800 overflow-hidden relative min-h-[500px]">

        <div className="absolute top-[-30px] right-[-10px] opacity-[0.03] dark:opacity-[0.05] pointer-events-none">
          {viewMode === 'year' ? <LayoutGrid size={200} className="text-red-600" /> : <CalendarIcon size={200} className="text-red-600" />}
        </div>

        {/* --- Header da Navegação --- */}
        <div className="p-4 flex flex-col md:flex-row justify-between items-center gap-3 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50 relative z-10">
          <div className="flex items-center gap-3">
             <div className="p-2 bg-red-600 rounded-lg shadow-md text-white">
                {viewMode === 'year' ? <LayoutGrid size={20} /> : <CalendarIcon size={20} />}
             </div>
             <div>
               <h2 className="text-xl font-extrabold text-zinc-800 dark:text-white capitalize leading-none tracking-tight">
                 {viewMode === 'year' ? currentYear : new Date(currentYear, currentMonth).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}
               </h2>
               <p className="text-xs text-zinc-500 dark:text-zinc-400 font-semibold mt-0.5">
                 {viewMode === 'year' ? 'Visão Geral do Ano' : 'Detalhes do Mês'}
               </p>
             </div>
          </div>

          <div className="flex items-center gap-1 bg-white dark:bg-zinc-800 p-1 rounded-lg border border-zinc-300 dark:border-zinc-700 shadow-sm">
            <button
              onClick={() => viewMode === 'year' ? changeYear(-1) : changeMonth(-1)}
              className="p-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-700 rounded-md transition-all text-zinc-700 dark:text-zinc-300"
            >
              <ChevronLeft size={18} />
            </button>
            <span className="px-3 text-xs font-bold text-zinc-700 dark:text-zinc-300 min-w-[80px] text-center">
              {viewMode === 'year' ? currentYear : new Date(currentYear, currentMonth).toLocaleDateString('pt-BR', { month: 'short' }).toUpperCase()}
            </span>
            <button
              onClick={() => viewMode === 'year' ? changeYear(1) : changeMonth(1)}
              className="p-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-700 rounded-md transition-all text-zinc-700 dark:text-zinc-300"
            >
              <ChevronRight size={18} />
            </button>
          </div>
        </div>

        {/* --- CORPO --- */}
        <div className="p-4 bg-zinc-100/50 dark:bg-zinc-900 relative z-10">
            <AnimatePresence mode="wait">
                {viewMode === 'year' ? (
                    // --- YEAR VIEW ---
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
                                    getGoalsForDate={getGoalsForDate}
                                />
                            );
                        })}
                    </motion.div>
                ) : (
                    // --- MONTH VIEW EXPANDIDA ---
                    <motion.div
                        key="month-view"
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                    >
                        <div className="grid grid-cols-7 mb-2">
                            {daysOfWeek.map(day => (
                            <div key={day} className="text-center text-[10px] md:text-xs font-bold text-zinc-600 dark:text-zinc-400 uppercase tracking-wider">
                                {day}
                            </div>
                            ))}
                        </div>

                        <div className="grid grid-cols-7 gap-1.5 md:gap-2">
                            {Array.from({ length: firstDayOfMonth }).map((_, i) => (
                                <div key={`empty-${i}`} className="min-h-[64px] md:min-h-[85px] bg-zinc-200/30 dark:bg-zinc-800/20 rounded-lg border border-transparent"></div>
                            ))}

                            {Array.from({ length: daysInMonth }).map((_, day) => {
                                const dayNumber = day + 1;
                                const dateObj = new Date(currentYear, currentMonth, dayNumber);
                                const dateStr = dateToYMD_local(dateObj);
                                const dayData = studyDays[dateStr];
                                const hasData = !!dayData && (dayData.questions > 0 || dayData.hours > 0);
                                const isToday = todayStr === dateStr;

                                let status = 'no-data';
                                if (hasData) {
                                    const goalsForDay = getGoalsForDate(dateStr);
                                    const qGoal = goalsForDay?.questions || 0;
                                    const hGoal = (goalsForDay?.hours || 0) * 60;
                                    const qMet = qGoal === 0 || dayData.questions >= qGoal;
                                    const hMet = hGoal === 0 || dayData.hours >= hGoal;

                                    if (qMet && hMet) status = 'goal-met-both';
                                    else if (qMet || hMet) status = 'goal-met-one';
                                    else status = 'goal-not-met';
                                }

                                let cardClasses = "bg-white dark:bg-zinc-800 border-zinc-300 dark:border-zinc-700 shadow-sm";
                                let textClasses = "text-zinc-700 dark:text-zinc-300";

                                if (hasData) {
                                    if (status === 'goal-met-both') {
                                        cardClasses = "bg-emerald-50 dark:bg-emerald-900/20 border-emerald-400 dark:border-emerald-700 shadow-sm";
                                        textClasses = "text-emerald-800 dark:text-emerald-400";
                                    } else if (status === 'goal-met-one') {
                                        cardClasses = "bg-amber-50 dark:bg-amber-900/20 border-amber-400 dark:border-amber-700 shadow-sm";
                                        textClasses = "text-amber-800 dark:text-amber-400";
                                    } else {
                                        cardClasses = "bg-red-50 dark:bg-red-900/10 border-red-300 dark:border-red-900/30 shadow-sm";
                                        textClasses = "text-red-800 dark:text-red-400";
                                    }
                                }

                                if (isToday) {
                                    cardClasses += " ring-2 ring-red-600 ring-offset-2 ring-offset-zinc-100 dark:ring-offset-zinc-900 z-10 font-bold";
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
                                        </div>

                                        {hasData && (
                                            <div className="space-y-0.5 mt-1 overflow-hidden">
                                            {dayData.hours > 0 && (
                                                <div className="flex items-center gap-1 text-[7px] xs:text-[8px] sm:text-[10px] font-bold text-zinc-700 dark:text-zinc-300 truncate">
                                                    <Clock size={8} className={`sm:w-[10px] sm:h-[10px] ${status === 'goal-met-both' ? 'text-emerald-600' : 'text-zinc-500'}`} />
                                                    {formatDecimalHours(dayData.hours)}
                                                </div>
                                            )}
                                            {dayData.questions > 0 && (
                                                <div className="flex items-center gap-1 text-[7px] xs:text-[8px] sm:text-[10px] font-bold text-zinc-700 dark:text-zinc-300 truncate">
                                                    <Target size={8} className={`sm:w-[10px] sm:h-[10px] ${status === 'goal-met-both' ? 'text-emerald-600' : 'text-zinc-500'}`} />
                                                    {dayData.questions} Qst.
                                                </div>
                                            )}
                                            </div>
                                        )}
                                    </motion.button>
                                );
                            })}
                        </div>

                         {/* LEGENDA NO RODAPÉ (Modo Expandido) */}
                        <div className="mt-6 flex flex-wrap gap-4 text-[10px] sm:text-xs border-t border-zinc-200 dark:border-zinc-800 pt-4 justify-center bg-zinc-50/50 dark:bg-zinc-900/50 p-3 rounded-lg">
                            <div className="flex items-center gap-1.5">
                                <div className="w-3 h-3 rounded bg-emerald-500 border border-emerald-600 shadow-sm"></div>
                                <span className="text-zinc-700 dark:text-zinc-300 font-semibold">Meta Batida</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                                <div className="w-3 h-3 rounded bg-amber-500 border border-amber-600 shadow-sm"></div>
                                <span className="text-zinc-700 dark:text-zinc-300 font-semibold">Meta Parcial</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                                <div className="w-3 h-3 rounded bg-red-600 border border-red-700 shadow-sm"></div>
                                <span className="text-zinc-700 dark:text-zinc-300 font-semibold">Meta Incompleta</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                                <div className="w-3 h-3 rounded bg-white dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 shadow-sm"></div>
                                <span className="text-zinc-500 dark:text-zinc-400 font-semibold">Sem Registro</span>
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
            onClose={() => setSelectedDate(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

export default CalendarTab;