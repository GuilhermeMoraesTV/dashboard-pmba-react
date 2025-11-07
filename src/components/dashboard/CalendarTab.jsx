import React, { useState, useMemo } from 'react';
import DayDetailsModal from './DayDetailsModal.jsx';

const dateToYMD_local = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const formatDecimalHours = (minutos) => {
  if (!minutos || minutos < 0) return '0h 0m';
  const h = Math.floor(minutos / 60);
  const m = Math.round(minutos % 60);
  return `${h}h ${m}m`;
};

function CalendarTab({ registrosEstudo = [], goalsHistory = [], onDeleteRegistro }) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(null);

  console.log("📅 CalendarTab renderizado com", registrosEstudo?.length || 0, "registros");

  const getGoalsForDate = (dateStr) => {
    if (!goalsHistory || goalsHistory.length === 0) return { questions: 0, hours: 0 };
    const sortedGoals = [...goalsHistory].sort((a, b) => new Date(b.startDate) - new Date(a.startDate));
    return sortedGoals.find(g => g.startDate <= dateStr) || { questions: 0, hours: 0 };
  };

  const studyDays = useMemo(() => {
    const days = {};

    if (!registrosEstudo || registrosEstudo.length === 0) {
      console.log("⚠️ Nenhum registro para processar");
      return days;
    }

    console.log("🔄 Processando", registrosEstudo.length, "registros");

    registrosEstudo.forEach(item => {
      try {
        const dateStr = item.data;

        if (!dateStr || typeof dateStr !== 'string') {
          console.log("⚠️ Data inválida:", dateStr);
          return;
        }

        if (!days[dateStr]) {
          days[dateStr] = { questions: 0, correct: 0, hours: 0 };
        }

        const minutos = Number(item.tempoEstudadoMinutos || 0);
        const questoes = Number(item.questoesFeitas || 0);
        const acertos = Number(item.acertos || 0);

        if (minutos > 0) {
          days[dateStr].hours += minutos;
        }

        if (questoes > 0) {
          days[dateStr].questions += questoes;
          days[dateStr].correct += acertos;
        }
      } catch (error) {
        console.error("❌ Erro ao processar registro:", error, item);
      }
    });

    console.log("✅ Dias processados:", Object.keys(days).length);
    return days;
  }, [registrosEstudo]);

  const handleDayClick = (date) => {
    const dayRegistros = registrosEstudo.filter(r => r.data === date);
    const dayQuestions = dayRegistros.filter(r => (r.questoesFeitas || 0) > 0);
    const dayHours = dayRegistros.filter(r => (r.tempoEstudadoMinutos || 0) > 0);

    console.log("🔍 Clique no dia:", date, "Registros:", dayRegistros.length);
    setSelectedDate({ date, dayQuestions, dayHours });
  };

  const daysOfWeek = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
  const currentMonth = currentDate.getMonth();
  const currentYear = currentDate.getFullYear();
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const firstDayOfMonth = new Date(currentYear, currentMonth, 1).getDay();

  const changeMonth = (offset) => {
    setCurrentDate(new Date(currentYear, currentMonth + offset, 1));
  };

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

  return (
    <div className="bg-zinc-200 dark:bg-zinc-800 rounded-xl shadow-card-shadow p-4 md:p-6 border border-zinc-300 dark:border-zinc-700">
      <div className="flex justify-between items-center mb-4">
        <button
          onClick={() => changeMonth(-1)}
          className="px-4 py-2 bg-zinc-300 dark:bg-zinc-700 rounded-lg font-semibold text-zinc-800 dark:text-white hover:bg-zinc-400 dark:hover:bg-zinc-600"
        >
          &larr; Anterior
        </button>
        <h2 className="text-xl font-bold text-zinc-800 dark:text-white">
          {new Date(currentYear, currentMonth).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}
        </h2>
        <button
          onClick={() => changeMonth(1)}
          className="px-4 py-2 bg-zinc-300 dark:bg-zinc-700 rounded-lg font-semibold text-zinc-800 dark:text-white hover:bg-zinc-400 dark:hover:bg-zinc-600"
        >
          Próximo &rarr;
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1">
        {daysOfWeek.map(day => (
          <div key={day} className="text-center font-semibold text-zinc-600 dark:text-zinc-400 text-sm py-2">
            {day}
          </div>
        ))}

        {Array.from({ length: firstDayOfMonth }).map((_, i) => (
          <div key={`empty-${i}`} className="border border-border-light dark:border-border-dark bg-card-light dark:bg-card-dark min-h-[100px] rounded-md"></div>
        ))}

        {Array.from({ length: daysInMonth }).map((_, day) => {
          const dayNumber = day + 1;
          const date = new Date(currentYear, currentMonth, dayNumber);
          const dateStr = dateToYMD_local(date);
          const { status, hasData } = getDayStatus(dateStr);
          const isToday = dateToYMD_local(new Date()) === dateStr;

          return (
            <button
              key={dateStr}
              disabled={!hasData}
              onClick={() => hasData && handleDayClick(dateStr)}
              className={`
                border border-border-light dark:border-border-dark min-h-[100px] rounded-md p-2 text-left relative transition-all duration-150
                ${status === 'goal-met-both' ? 'bg-green-200 dark:bg-green-800' : ''}
                ${status === 'goal-met-one' ? 'bg-yellow-200 dark:bg-yellow-800' : ''}
                ${status === 'goal-not-met' ? 'bg-red-200 dark:bg-red-800' : ''}
                ${status === 'no-data' ? 'bg-card-light dark:bg-card-dark' : ''}
                ${hasData ? 'cursor-pointer hover:brightness-110' : 'cursor-default'}
                ${isToday ? 'ring-2 ring-neutral-500' : ''}
              `}
            >
              <span className={`font-semibold text-sm ${isToday ? 'text-neutral-500' : 'text-zinc-800 dark:text-white'}`}>
                {dayNumber}
              </span>
              {hasData && studyDays[dateStr] && (
                <div className="absolute bottom-2 left-2 right-2 text-xs text-zinc-800 dark:text-white">
                  {studyDays[dateStr].hours > 0 && (
                    <div className="font-medium">{formatDecimalHours(studyDays[dateStr].hours)}</div>
                  )}
                  {studyDays[dateStr].questions > 0 && (
                    <div className="font-medium">{studyDays[dateStr].questions} Qst.</div>
                  )}
                </div>
              )}
            </button>
          );
        })}
      </div>

      <div className="mt-6 flex flex-wrap gap-4 text-sm">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded bg-green-200 dark:bg-green-800"></div>
          <span className="text-zinc-700 dark:text-zinc-300">Metas Atingidas</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded bg-yellow-200 dark:bg-yellow-800"></div>
          <span className="text-zinc-700 dark:text-zinc-300">Meta Parcial</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded bg-red-200 dark:bg-red-800"></div>
          <span className="text-zinc-700 dark:text-zinc-300">Abaixo da Meta</span>
        </div>
      </div>

      {selectedDate && (
        <DayDetailsModal
          date={selectedDate.date}
          dayData={{ dayQuestions: selectedDate.dayQuestions, dayHours: selectedDate.dayHours }}
          onClose={() => setSelectedDate(null)}
        />
      )}
    </div>
  );
}

export default CalendarTab;