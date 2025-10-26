import React, { useState, useMemo } from 'react';
import DayDetailsModal from './DayDetailsModal.jsx'; // Continua usando o modal corrigido

// --- Funções Helper (Sem alteração) ---
const dateToYMD_local = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};
// -------------------------------------

// Recebe 'registrosEstudo' e 'onDeleteRegistro'
function CalendarTab({ registrosEstudo, goalsHistory, onDeleteRegistro }) {
    const [viewDate, setViewDate] = useState(new Date());
    const [selectedDate, setSelectedDate] = useState(null);

    // Função getGoalsForDate (sem alteração)
    const getGoalsForDate = (dateStr) => {
        if (!goalsHistory || goalsHistory.length === 0) return { questions: 0, hours: 0 };
        const sortedGoals = [...goalsHistory].sort((a, b) => new Date(b.startDate) - new Date(a.startDate));
        return sortedGoals.find(g => g.startDate <= dateStr) || { questions: 0, hours: 0 };
    };

    // --- useMemo COM LÓGICA CORRETA (sem alteração na lógica) ---
    const calendarData = useMemo(() => {
        const studyDays = {};
        registrosEstudo.forEach(item => {
            const dateStr = dateToYMD_local(item.data.toDate());
            studyDays[dateStr] = studyDays[dateStr] || { questions: 0, hours: 0 };

            if (item.questoesFeitas > 0) {
                studyDays[dateStr].questions += item.questoesFeitas;
            }
            if (item.duracaoMinutos > 0) {
                studyDays[dateStr].hours += (item.duracaoMinutos / 60);
            }
        });

        const year = viewDate.getFullYear();
        const month = viewDate.getMonth();
        const firstDayOfMonth = new Date(year, month, 1);
        const lastDayOfMonth = new Date(year, month + 1, 0);
        const daysInMonth = lastDayOfMonth.getDate();
        const startDayOfWeek = firstDayOfMonth.getDay(); // 0 = Domingo

        const days = Array(startDayOfWeek).fill(null); // Dias em branco

        for (let i = 1; i <= daysInMonth; i++) {
            const date = new Date(year, month, i);
            const dateStr = dateToYMD_local(date);
            const dayData = studyDays[dateStr];
            let status = 'no-data';
            const hasData = !!dayData && (dayData.questions > 0 || dayData.hours > 0);

            if (hasData) {
                const goalsForDay = getGoalsForDate(dateStr);
                const qGoalMet = dayData.questions >= goalsForDay.questions;
                const hGoalMet = dayData.hours >= goalsForDay.hours;
                if (qGoalMet && hGoalMet) status = 'goal-met-both'; // Verde mais forte
                else if (qGoalMet || hGoalMet) status = 'goal-met-one'; // Amarelo/Verde claro
                else status = 'goal-not-met'; // Vermelho/Laranja
            }
            days.push({ day: i, date: dateStr, status, hasData });
        }
        return days;
    }, [registrosEstudo, goalsHistory, viewDate]);
    // --- FIM DO useMemo ---

    // handleDayClick (sem alteração na lógica)
    const handleDayClick = (day) => {
        if (!day || !day.hasData) return;
        const dayRegistros = registrosEstudo.filter(r => dateToYMD_local(r.data.toDate()) === day.date);
        const dayQuestions = dayRegistros.filter(r => r.questoesFeitas > 0);
        const dayHours = dayRegistros.filter(r => r.duracaoMinutos > 0);
        setSelectedDate({ date: day.date, dayQuestions, dayHours });
    };

    const weekDays = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

    return (
        // --- JSX COM NOVO ESTILO VISUAL ---
        <div className="bg-card-background-color dark:bg-dark-card-background-color p-4 md:p-6 rounded-xl shadow-card-shadow border border-border-color dark:border-dark-border-color">
            {/* Cabeçalho de Navegação (sem alteração) */}
            <div className="flex justify-between items-center mb-4">
                <button
                    onClick={() => setViewDate(new Date(viewDate.setMonth(viewDate.getMonth() - 1)))}
                    className="px-4 py-2 rounded bg-background-color dark:bg-dark-background-color text-text-color dark:text-dark-text-color font-semibold hover:bg-border-color dark:hover:bg-dark-border-color"
                >
                    &lt; Anterior
                </button>
                <h2 className="text-lg md:text-xl font-semibold text-heading-color dark:text-dark-heading-color text-center">
                    {viewDate.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }).replace(/^\w/, c => c.toUpperCase())}
                </h2>
                <button
                    onClick={() => setViewDate(new Date(viewDate.setMonth(viewDate.getMonth() + 1)))}
                    className="px-4 py-2 rounded bg-background-color dark:bg-dark-background-color text-text-color dark:text-dark-text-color font-semibold hover:bg-border-color dark:hover:bg-dark-border-color"
                >
                    Próximo &gt;
                </button>
            </div>

            {/* Grid do Calendário (Estilo Modificado) */}
            <div className="grid grid-cols-7 gap-1 md:gap-2"> {/* Aumenta o gap */}
                {/* Cabeçalho dos dias da semana */}
                {weekDays.map(day => (
                    <div key={day} className="text-center font-semibold text-subtle-text-color dark:text-dark-subtle-text-color text-xs md:text-sm py-2">
                        {day}
                    </div>
                ))}
                {/* Dias do mês */}
                {calendarData.map((day, index) => {
                  // Define a cor de fundo e a cor do texto com base no status
                  let bgColorClass = 'bg-background-color dark:bg-dark-background-color'; // Padrão
                  let textColorClass = 'text-text-color dark:text-dark-text-color'; // Padrão
                  let hoverClass = 'hover:bg-border-color dark:hover:bg-dark-border-color'; // Padrão

                  if (day) {
                    switch (day.status) {
                      case 'goal-met-both':
                        bgColorClass = 'bg-goal-met-both'; // Seu verde forte
                        textColorClass = 'text-white font-bold'; // Texto branco para contraste
                        hoverClass = 'hover:brightness-110';
                        break;
                      case 'goal-met-one':
                        bgColorClass = 'bg-goal-met-one'; // Seu amarelo/verde claro
                        textColorClass = 'text-yellow-900 font-semibold'; // Texto escuro para contraste
                        hoverClass = 'hover:brightness-110';
                        break;
                      case 'goal-not-met':
                        bgColorClass = 'bg-goal-not-met'; // Seu vermelho/laranja
                        textColorClass = 'text-red-900 font-semibold'; // Texto escuro para contraste
                        hoverClass = 'hover:brightness-110';
                        break;
                      case 'no-data':
                        // Mantém o padrão
                        break;
                    }
                  } else {
                    // Dias em branco (mês anterior/seguinte)
                     bgColorClass = 'bg-gray-100 dark:bg-gray-800 opacity-40';
                     hoverClass = ''; // Sem hover
                  }

                  return (
                    <div
                        key={index}
                        // --- ESTILO DA CÉLULA DO DIA MODIFICADO ---
                        className={`
                            h-16 md:h-20 border border-border-color dark:border-dark-border-color rounded-lg  /* Borda arredondada */
                            flex items-center justify-center /* Centraliza o número */
                            transition-all duration-200
                            ${bgColorClass} /* Cor de fundo baseada no status */
                            ${day?.hasData ? 'cursor-pointer' : ''}
                            ${day?.hasData ? hoverClass : ''} /* Efeito hover só se houver dados */
                        `}
                        onClick={() => handleDayClick(day)}
                    >
                        {day && (
                            // Número do dia com cor ajustada
                            <span className={`text-sm font-semibold ${textColorClass}`}>
                                {day.day}
                            </span>
                        )}
                        {/* A bolinha foi removida */}
                    </div>
                  );
                })}
            </div>
            {/* --- FIM DO JSX MODIFICADO --- */}

            {/* Modal (sem alteração, usa o modal já corrigido) */}
            {selectedDate && (
                <DayDetailsModal
                    date={selectedDate.date}
                    dayData={{ dayQuestions: selectedDate.dayQuestions, dayHours: selectedDate.dayHours }}
                    onClose={() => setSelectedDate(null)}
                    onDeleteRegistro={onDeleteRegistro} // Passa a função de delete
                />
            )}
        </div>
    );
}

export default CalendarTab;