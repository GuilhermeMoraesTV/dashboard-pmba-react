import React, { useState, useMemo } from 'react';
import DayDetailsModal from './DayDetailsModal.jsx'; // Reutiliza o modal
import Legend from './Legend.jsx'; // Importa a legenda

// --- Funções Helper (Sem alteração) ---
const dateToYMD_local = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const formatDecimalHours = (d) => {
  if (!d || d < 0) return '0h 0m';
  const totalMinutes = Math.round(d * 60);
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return `${h}h ${m}m`;
};
// -------------------------------------


function CalendarTab({ registrosEstudo, goalsHistory, onDeleteRegistro }) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(null);

  // --- getGoalsForDate (Sem alteração) ---
  const getGoalsForDate = (dateStr) => {
    if (!goalsHistory || goalsHistory.length === 0) return { questions: 0, hours: 0 };
    const sortedGoals = [...goalsHistory].sort((a, b) => new Date(b.startDate) - new Date(a.startDate));
    return sortedGoals.find(g => g.startDate <= dateStr) || { questions: 0, hours: 0 };
  };

  // --- useMemo CORRIGIDO ---
  const studyDays = useMemo(() => {
    const days = {};
    try {
      registrosEstudo.forEach(item => {
        // CORREÇÃO: item.data JÁ É A STRING "YYYY-MM-DD"
        const dateStr = item.data;

        // Proteção contra dados inválidos/antigos
        if (!dateStr || typeof dateStr !== 'string' || dateStr.split('-').length !== 3) {
          return;
        }

        days[dateStr] = days[dateStr] || { questions: 0, correct: 0, hours: 0 };

        // CORREÇÃO: Usa 'tempoEstudadoMinutos'
        if ((item.tempoEstudadoMinutos || 0) > 0) {
          days[dateStr].hours += (item.tempoEstudadoMinutos / 60);
        }

        // CORREÇÃO: Usa 'questoesFeitas' e 'acertos'
        if ((item.questoesFeitas || 0) > 0) {
          days[dateStr].questions += item.questoesFeitas;
          days[dateStr].correct += (item.acertos || 0);
        }
      });
    } catch (error) {
      console.error("Erro ao processar dados do calendário:", error);
    }
    return days;
  }, [registrosEstudo]);
  // --- FIM DA CORREÇÃO ---


  // --- handleDayClick CORRIGIDO ---
  const handleDayClick = (date) => {
    // CORREÇÃO: Compara 'r.data' (string) diretamente com 'date' (string)
    const dayRegistros = registrosEstudo.filter(r => r.data === date);

    // CORREÇÃO: Nomes de campo corretos
    const dayQuestions = dayRegistros.filter(r => (r.questoesFeitas || 0) > 0);
    const dayHours = dayRegistros.filter(r => (r.tempoEstudadoMinutos || 0) > 0);

    setSelectedDate({ date, dayQuestions, dayHours });
  };
  // --- FIM DA CORREÇÃO ---


  // Funções de navegação do calendário (sem alteração)
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
      const hGoal = goalsForDay?.hours || 0;
      const qGoalMet = dayData.questions >= qGoal;
      const hGoalMet = dayData.hours >= hGoal;

      if (qGoalMet && hGoalMet) status = 'goal-met-both';
      else if (qGoalMet || hGoalMet) status = 'goal-met-one';
      else status = 'goal-not-met';
    }
    return { status, hasData };
  };

  return (
    <div className="bg-card-background-color dark:bg-dark-card-background-color rounded-xl shadow-card-shadow p-4 md:p-6">
      <h1 className="text-2xl font-semibold text-heading-color dark:text-dark-heading-color mb-6">
        Calendário de Estudos
      </h1>

      {/* Header do Calendário */}
      <div className="flex justify-between items-center mb-4">
        <button
          onClick={() => changeMonth(-1)}
          className="px-4 py-2 bg-gray-200 dark:bg-dark-border-color rounded-lg font-semibold text-text-color dark:text-dark-text-color hover:brightness-95"
        >
          &larr; Anterior
        </button>
        <h2 className="text-xl font-bold text-heading-color dark:text-dark-heading-color">
          {new Date(currentYear, currentMonth).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}
        </h2>
        <button
          onClick={() => changeMonth(1)}
          className="px-4 py-2 bg-gray-200 dark:bg-dark-border-color rounded-lg font-semibold text-text-color dark:text-dark-text-color hover:brightness-95"
        >
          Próximo &rarr;
        </button>
      </div>

      {/* Grid do Calendário */}
      <div className="grid grid-cols-7 gap-1">
        {daysOfWeek.map(day => (
          <div key={day} className="text-center font-semibold text-subtle-text-color dark:text-dark-subtle-text-color text-sm py-2">
            {day}
          </div>
        ))}

        {/* Dias em branco (offset) */}
        {Array.from({ length: firstDayOfMonth }).map((_, i) => (
          <div key={`empty-${i}`} className="border border-border-color dark:border-dark-border-color bg-background-color dark:bg-dark-background-color/50 min-h-[100px] rounded-md"></div>
        ))}

        {/* Dias do Mês */}
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
                border border-border-color dark:border-dark-border-color min-h-[100px] rounded-md p-2 text-left relative transition-all duration-150
                ${status === 'goal-met-both' ? 'bg-goal-met-both' : ''}
                ${status === 'goal-met-one' ? 'bg-goal-met-one' : ''}
                ${status === 'goal-not-met' ? 'bg-goal-not-met' : ''}
                ${status === 'no-data' ? 'bg-background-color dark:bg-dark-background-color/50' : ''}
                ${hasData ? 'cursor-pointer hover:brightness-110' : 'cursor-default'}
                ${isToday ? 'shadow-[inset_0_0_0_2px_theme(colors.primary-color)]' : ''}
              `}
            >
              <span className={`font-semibold text-sm ${isToday ? 'text-primary-color' : 'text-text-color dark:text-dark-text-color'}`}>
                {dayNumber}
              </span>
              {hasData && (
                <div className="absolute bottom-2 left-2 right-2 text-xs text-text-color dark:text-dark-text-color">
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

      <Legend />

      {/* Modal de Detalhes */}
      {selectedDate && (
        <DayDetailsModal
          date={selectedDate.date}
          dayData={{ dayQuestions: selectedDate.dayQuestions, dayHours: selectedDate.dayHours }}
          onClose={() => setSelectedDate(null)}
          onDeleteRegistro={onDeleteRegistro}
        />
      )}
    </div>
  );
}

export default CalendarTab;