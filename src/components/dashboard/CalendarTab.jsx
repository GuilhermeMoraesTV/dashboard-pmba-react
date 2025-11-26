import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
  Clock,
  Target,
  Flame,
  Trophy,
  CheckCircle2,
  CalendarDays // Ícone específico para o cabeçalho
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
  if (!minutos || minutos < 0) return '0h';
  const h = Math.floor(minutos / 60);
  const m = Math.round(minutos % 60);
  if (h === 0) return `${m}m`;
  return `${h}h ${m}m`;
};

// --- Componente de Card de Estatística (REVERTIDO para layout COMPACTO) ---
const StatCard = ({ icon: Icon, label, value, subValue, colorClass = "text-zinc-600" }) => (
  <div className="flex items-center gap-2 md:gap-3 p-2 md:p-3 bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700/50 rounded-xl shadow-sm min-w-[110px] flex-1 relative overflow-hidden">
    {/* ESTE É O QUADRADO COLORIDO QUE ESTAVA FALTANDO */}
    <div className={`p-1.5 md:p-2 rounded-lg bg-white dark:bg-zinc-700 shadow-sm border border-zinc-100 dark:border-zinc-600 ${colorClass} relative z-10`}>
      <Icon size={20} strokeWidth={2.5} />
    </div>
    <div className="flex flex-col relative z-10">
      <span className="text-[10px] md:text-xs font-bold text-zinc-600 dark:text-zinc-400 uppercase tracking-wider">{label}</span>
      <span className="text-base md:text-lg font-extrabold text-zinc-800 dark:text-white leading-tight">{value}</span>
      {subValue && <span className="text-[10px] text-zinc-500 font-medium hidden md:inline-block">{subValue}</span>}
    </div>
  </div>
);


function CalendarTab({ registrosEstudo = [], goalsHistory = [], onDeleteRegistro }) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(null);

  // CORREÇÃO: Função getGoalsForDate movida para o topo do escopo do componente
  const getGoalsForDate = (dateStr) => {
    if (!goalsHistory || goalsHistory.length === 0) return { questions: 0, hours: 0 };
    // Ordena as metas pela data de início para encontrar a meta vigente
    const sortedGoals = [...goalsHistory].sort((a, b) => new Date(b.startDate) - new Date(a.startDate));
    // Retorna a meta mais recente que começou antes ou no dia em questão
    return sortedGoals.find(g => g.startDate <= dateStr) || { questions: 0, hours: 0 };
  };

  // --- Processamento de Dados (Agora useMemo pode acessar getGoalsForDate) ---
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
          // 'hours' neste objeto armazena a SOMA TOTAL DOS MINUTOS DE ESTUDO
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

    // --- CÁLCULO DA SEQUÊNCIA (STREAK) - Lógica de Meta Completa (E) ---
    let streak = 0;
    const today = new Date();
    const todayStr = dateToYMD_local(today);

    // Itera por até 90 dias, começando pelo dia atual (i=0) e voltando
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

            // Condições de cumprimento (Meta 0 é considerada cumprida)
            const isTimeGoalMet = hGoalMinutes === 0 || dayData.hours >= hGoalMinutes; // dayData.hours é em minutos
            const isQuestionGoalMet = qGoal === 0 || dayData.questions >= qGoal;

            // A SEQUÊNCIA SÓ CONTA SE AS DUAS METAS FOREM CUMPRIDAS (E)
            const goalMet = isTimeGoalMet && isQuestionGoalMet;

            if (goalMet) {
                streak++;
            } else {
                // Se a meta NÃO foi batida, encerra a sequência
                break;
            }
        } else {
            // Se não houver dados, o streak para, a menos que seja hoje
            if (dStr === todayStr) {
                continue; // Se for hoje sem estudo, pula e verifica o dia anterior (streak não quebra)
            } else {
                break; // Se for um dia passado e não houve estudo, encerra.
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

      // Mantemos a distinção Goal-Met-One para a visualização do calendário (Heatmap)
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
    <div className="space-y-8 animate-fade-in pb-12">

      {/* --- CABEÇALHO INTERNO (PADRONIZADO) --- */}
      <div className="mb-4 border-b border-zinc-200 dark:border-zinc-800 pb-6">
        <div className="flex items-center gap-3 mb-2">
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
        className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4"
      >
        <StatCard
          icon={Flame}
          label="Sequência"
          value={`${currentStreak} dias`}
          colorClass="text-orange-600 bg-orange-50 dark:bg-orange-900/30 dark:text-orange-400"
        />
        <StatCard
          icon={Clock}
          label="Horas (Mês)"
          value={formatDecimalHours(monthlyStats.hours)}
          colorClass="text-blue-600 bg-blue-50 dark:bg-blue-900/30 dark:text-blue-400"
        />
        <StatCard
          icon={CheckCircle2}
          label="Questões (Mês)"
          value={monthlyStats.questions}
          subValue={`${accuracyMonth}% acertos`}
          colorClass="text-emerald-600 bg-emerald-50 dark:bg-emerald-900/30 dark:text-emerald-400"
        />
        <StatCard
          icon={Trophy}
          label="Dias de Estudo"
          value={`${monthlyStats.daysStudied}/${daysInMonth}`}
          colorClass="text-red-600 bg-red-50 dark:bg-red-900/30 dark:text-red-500"
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