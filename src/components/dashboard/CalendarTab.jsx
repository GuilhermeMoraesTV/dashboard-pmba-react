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
  CalendarDays
} from 'lucide-react';
import DayDetailsModal from './DayDetailsModal.jsx';

// --- Funções Auxiliares ---
const dateToYMD_local = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const formatDecimalHours = (minutos) => {
  if (!minutos || minutos < 0) return '00h 00m';
  const h = Math.floor(minutos / 60);
  const m = Math.round(minutos % 60);
  return `${String(h).padStart(2, '0')}h ${String(m).padStart(2, '0')}m`;
};

// --- Componente de Card de Estatística (Design da Home FLEXÍVEL) ---
const StatCard = ({
  icon: Icon,
  title,
  value,
  subValue,
  className = "",
  // Configurações de cores (Padrão: Vermelho/Red igual Home)
  hoverBorderClass = "hover:border-red-500",
  iconColorClass = "text-red-500/10 dark:text-red-500/5",
  iconHoverColorClass = "group-hover:text-red-500/15 dark:group-hover:text-red-500/10",
  // Nova prop para classes extras no ícone (ex: preenchimento e animação)
  iconExtraClasses = ""
}) => (
  <div className={`relative overflow-hidden group p-3 md:p-6 h-[110px] md:h-[140px] flex flex-col justify-center items-start transition-all duration-500 hover:shadow-lg border-l-4 border-transparent ${hoverBorderClass} bg-white dark:bg-zinc-800 rounded-2xl shadow-sm ${className}`}>

    {/* Conteúdo (Texto e Valores) */}
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

    {/* Marca D'água (Ícone Grande no Fundo) */}
    <div className={`absolute -bottom-4 -right-4 md:-bottom-6 md:-right-6 transition-all duration-700 ease-out group-hover:scale-125 group-hover:rotate-[-10deg] z-10 pointer-events-none ${iconColorClass} ${iconHoverColorClass}`}>
      <Icon strokeWidth={1.5} className={`w-24 h-24 md:w-36 md:h-36 ${iconExtraClasses}`} />
    </div>
  </div>
);

function CalendarTab({ registrosEstudo = [], goalsHistory = [], onDeleteRegistro }) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(null);

  const getGoalsForDate = useCallback((dateStr) => {
    if (!goalsHistory || goalsHistory.length === 0) return { questions: 0, hours: 0 };
    const sortedGoals = [...goalsHistory].sort((a, b) => new Date(b.startDate) - new Date(a.startDate));
    return sortedGoals.find(g => g.startDate <= dateStr) || { questions: 0, hours: 0 };
  }, [goalsHistory]);

  // --- Processamento de Dados ---
  const { studyDays, currentStreak, monthlyStats } = useMemo(() => {
    const days = {};
    const currentMonthStats = { hours: 0, questions: 0, correct: 0, daysStudied: 0 };
    const currentMonthKey = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`;

    if (!registrosEstudo || registrosEstudo.length === 0) {
      return { studyDays: {}, currentStreak: 0, monthlyStats: currentMonthStats };
    }

    registrosEstudo.forEach(item => {
      try {
        const dateStr = item.data;
        if (!dateStr) return;

        if (!days[dateStr]) {
          days[dateStr] = { questions: 0, correct: 0, hours: 0 };
        }

        const minutos = Number(item.tempoEstudadoMinutos || 0);
        const questoes = Number(item.questoesFeitas || 0);
        const acertos = Number(item.acertos || 0);

        days[dateStr].hours += minutos;
        days[dateStr].questions += questoes;
        days[dateStr].correct += acertos;

        if (dateStr.startsWith(currentMonthKey)) {
          currentMonthStats.hours += minutos;
          currentMonthStats.questions += questoes;
          currentMonthStats.correct += acertos;
        }
      } catch (e) { console.error(e); }
    });

    currentMonthStats.daysStudied = Object.keys(days).filter(d => d.startsWith(currentMonthKey) && (days[d].hours > 0 || days[d].questions > 0)).length;

    // --- CÁLCULO DA SEQUÊNCIA (Lógica Corrigida) ---
    let streak = 0;
    const today = new Date();
    const todayStr = dateToYMD_local(today);

    for (let i = 0; i < 90; i++) {
        const dateToCheck = new Date();
        dateToCheck.setDate(today.getDate() - i);
        const dStr = dateToYMD_local(dateToCheck);
        const dayData = days[dStr];

        const hasData = !!dayData;

        if (hasData) {
            const goalsForDay = getGoalsForDate(dStr);
            const qGoal = goalsForDay.questions || 0;
            const hGoalMinutes = (goalsForDay.hours || 0) * 60;

            const isTimeGoalMet = hGoalMinutes === 0 || dayData.hours >= hGoalMinutes;
            const isQuestionGoalMet = qGoal === 0 || dayData.questions >= qGoal;
            const goalMet = isTimeGoalMet && isQuestionGoalMet;

            if (goalMet) {
                streak++;
            } else {
                if (dStr === todayStr) {
                    continue;
                } else {
                    break;
                }
            }
        } else {
            if (dStr === todayStr) {
                continue;
            } else {
                break;
            }
        }
    }

    return { studyDays: days, currentStreak: streak, monthlyStats: currentMonthStats };
  }, [registrosEstudo, currentDate, getGoalsForDate]);


  const getDayStatus = (dateStr) => {
    const dayData = studyDays[dateStr];
    const hasData = !!dayData && (dayData.questions > 0 || dayData.hours > 0);
    let status = 'no-data';

    if (hasData) {
      const goalsForDay = getGoalsForDate(dateStr);
      const qGoal = goalsForDay?.questions || 0;
      const hGoal = (goalsForDay?.hours || 0) * 60;

      const qGoalMet = qGoal === 0 || dayData.questions >= qGoal;
      const hGoalMet = hGoal === 0 || dayData.hours >= hGoal;

      if (qGoalMet && hGoalMet) status = 'goal-met-both';
      else if (qGoalMet || hGoalMet) status = 'goal-met-one';
      else status = 'goal-not-met';
    }
    return { status, hasData };
  };

  const handleDayClick = (dateStr) => {
    const dayRegistros = registrosEstudo.filter(r => r.data === dateStr);
    const dayQuestions = dayRegistros.filter(r => (r.questoesFeitas || 0) > 0);
    const dayHours = dayRegistros.filter(r => (r.tempoEstudadoMinutos || 0) > 0);
    setSelectedDate({ date: dateStr, dayQuestions, dayHours });
  };

  const changeMonth = (offset) => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + offset, 1));
  };

  const daysOfWeek = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
  const currentMonth = currentDate.getMonth();
  const currentYear = currentDate.getFullYear();
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const firstDayOfMonth = new Date(currentYear, currentMonth, 1).getDay();
  const todayStr = dateToYMD_local(new Date());

  const accuracyMonth = monthlyStats.questions > 0
    ? Math.round((monthlyStats.correct / monthlyStats.questions) * 100)
    : 0;

  return (
    <div className="space-y-6 animate-fade-in pb-12">

      {/* --- CABEÇALHO INTERNO --- */}
      <div className="mb-2 border-b border-zinc-200 dark:border-zinc-800 pb-4">
        <div className="flex items-center gap-3">
            <div className="p-2.5 bg-red-100 dark:bg-red-900/20 text-red-600 dark:text-red-500 rounded-xl">
                <CalendarDays size={28} strokeWidth={2} />
            </div>
            <h1 className="text-3xl font-black text-zinc-800 dark:text-white tracking-tight uppercase">
                Calendário de Estudos
            </h1>
        </div>
      </div>

      {/* --- Stats Grid --- */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4"
      >
        {/* CARD DE SEQUÊNCIA - Laranja com Ícone Preenchido e Pulsante */}
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

        {/* Outros Cards - Vermelho Padrão */}
        <StatCard
          icon={Clock}
          title="Horas (Mês)"
          value={formatDecimalHours(monthlyStats.hours)}
        />
        <StatCard
          icon={Target}
          title="Questões (Mês)"
          value={monthlyStats.questions}
          subValue={`${accuracyMonth}% acertos`}
        />
        <StatCard
          icon={Trophy}
          title="Dias de Estudo"
          value={`${monthlyStats.daysStudied}`}
          subValue={`de ${daysInMonth} dias`}
        />
      </motion.div>

      {/* --- Container do Calendário --- */}
      <div id="calendar-grid" className="bg-white dark:bg-zinc-900 rounded-2xl shadow-sm border border-zinc-300 dark:border-zinc-800 overflow-hidden relative">

        {/* Marca D'água */}
        <div className="absolute top-[-30px] right-[-10px] opacity-[0.03] dark:opacity-[0.05] pointer-events-none">
          <CalendarIcon size={200} className="text-red-600" />
        </div>

        {/* Header do Mês */}
        <div className="p-4 flex flex-col md:flex-row justify-between items-center gap-3 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50 relative z-10">
          <div className="flex items-center gap-3">
             <div className="p-2 bg-red-600 rounded-lg shadow-md text-white">
                <CalendarIcon size={20} />
             </div>
             <div>
               <h2 className="text-xl font-extrabold text-zinc-800 dark:text-white capitalize leading-none tracking-tight">
                 {new Date(currentYear, currentMonth).toLocaleDateString('pt-BR', { month: 'long' })}
               </h2>
               <p className="text-xs text-zinc-500 dark:text-zinc-400 font-semibold mt-0.5">
                 {currentYear}
               </p>
             </div>
          </div>

          <div className="flex items-center gap-1 bg-white dark:bg-zinc-800 p-1 rounded-lg border border-zinc-300 dark:border-zinc-700 shadow-sm">
            <button
              onClick={() => changeMonth(-1)}
              className="p-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-700 rounded-md transition-all text-zinc-700 dark:text-zinc-300"
            >
              <ChevronLeft size={18} />
            </button>
            <span className="px-3 text-xs font-bold text-zinc-700 dark:text-zinc-300 min-w-[80px] text-center">
              {new Date(currentYear, currentMonth).toLocaleDateString('pt-BR', { month: 'short' }).toUpperCase()}
            </span>
            <button
              onClick={() => changeMonth(1)}
              className="p-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-700 rounded-md transition-all text-zinc-700 dark:text-zinc-300"
            >
              <ChevronRight size={18} />
            </button>
          </div>
        </div>

        {/* Corpo do Calendário */}
        <div className="p-4 bg-zinc-100/50 dark:bg-zinc-900 relative z-10">
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
              const { status, hasData } = getDayStatus(dateStr);
              const isToday = todayStr === dateStr;

              // Estilos base
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
                    relative rounded-lg border p-1.5 md:p-2 text-left flex flex-col justify-between
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

                  {hasData && studyDays[dateStr] && (
                    <div className="space-y-0.5 mt-1">
                      {studyDays[dateStr].hours > 0 && (
                        <div className="flex items-center gap-1 text-[10px] font-bold text-zinc-700 dark:text-zinc-300 truncate">
                           <Clock size={10} className={status === 'goal-met-both' ? 'text-emerald-600' : 'text-zinc-500'} />
                           {formatDecimalHours(studyDays[dateStr].hours)}
                        </div>
                      )}
                      {studyDays[dateStr].questions > 0 && (
                        <div className="flex items-center gap-1 text-[10px] font-bold text-zinc-700 dark:text-zinc-300 truncate">
                           <Target size={10} className={status === 'goal-met-both' ? 'text-emerald-600' : 'text-zinc-500'} />
                           {studyDays[dateStr].questions} Qst.
                        </div>
                      )}
                    </div>
                  )}
                </motion.button>
              );
            })}
          </div>

          {/* Legenda */}
          <div className="mt-4 flex flex-wrap gap-4 text-xs border-t border-zinc-200 dark:border-zinc-800 pt-3 justify-center">
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-full bg-emerald-500 border border-emerald-600 shadow-sm"></div>
              <span className="text-zinc-700 dark:text-zinc-300 font-semibold">Meta Concluída</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-full bg-amber-500 border border-amber-600 shadow-sm"></div>
              <span className="text-zinc-700 dark:text-zinc-300 font-semibold">Meta Parcial</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-full bg-red-600 border border-red-700 shadow-sm"></div>
              <span className="text-zinc-700 dark:text-zinc-300 font-semibold">Meta Incompleta</span>
            </div>
          </div>
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