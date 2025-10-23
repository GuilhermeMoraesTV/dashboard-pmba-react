import React, { useState, useMemo } from 'react';
import DayDetailsModal from './DayDetailsModal.jsx'; // Reutiliza o modal

const dateToYMD_local = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

function CalendarTab({ questionsData, hoursData, goalsHistory }) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(null);

  const getGoalsForDate = (dateStr) => {
    if (!goalsHistory || goalsHistory.length === 0) return { questions: 0, hours: 0 };
    const sortedGoals = [...goalsHistory].sort((a, b) => new Date(b.startDate) - new Date(a.startDate));
    return sortedGoals.find(g => g.startDate <= dateStr) || { questions: 0, hours: 0 };
  };

  const calendarData = useMemo(() => {
    const studyDays = {};
    questionsData.forEach(d => {
      studyDays[d.date] = studyDays[d.date] || { questions: 0, correct: 0, hours: 0 };
      studyDays[d.date].questions += d.questions;
      studyDays[d.date].correct += d.correct;
    });
    hoursData.forEach(d => {
      studyDays[d.date] = studyDays[d.date] || { questions: 0, correct: 0, hours: 0 };
      studyDays[d.date].hours += d.hours;
    });

    return studyDays;
  }, [questionsData, hoursData]);

  const handleDayClick = (dateStr) => {
    const dayQuestions = questionsData.filter(d => d.date === dateStr);
    const dayHours = hoursData.filter(d => d.date === dateStr);
    setSelectedDate({ date: dateStr, dayQuestions, dayHours });
  };

  const changeMonth = (offset) => {
    setCurrentDate(new Date(currentDate.setMonth(currentDate.getMonth() + offset)));
  };

  const renderCalendar = () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const todayStr = dateToYMD_local(new Date());

    const days = [];
    // Preenche os dias vazios do início
    for (let i = 0; i < firstDay; i++) {
      days.push(<div key={`empty-${i}`} className="calendar-day-empty"></div>);
    }

    // Preenche os dias do mês
    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = dateToYMD_local(new Date(year, month, day));
      const dayData = calendarData[dateStr];
      const hasData = !!dayData;
      let statusClass = 'no-data';

      if (hasData) {
        const goalsForDay = getGoalsForDate(dateStr);
        const qGoalMet = dayData.questions >= goalsForDay.questions;
        const hGoalMet = dayData.hours >= goalsForDay.hours;
        if (qGoalMet && hGoalMet) statusClass = 'bg-goal-met-both text-white';
        else if (qGoalMet || hGoalMet) statusClass = 'bg-goal-met-one text-white';
        else statusClass = 'bg-goal-not-met text-white';
      } else {
        statusClass = 'bg-background-color dark:bg-dark-background-color';
      }

      const isToday = dateStr === todayStr;

      days.push(
        // TRADUÇÃO de .calendar-day
        <div
          key={dateStr}
          className={`text-center p-2 rounded-md text-xs sm:text-sm relative
                      ${hasData ? 'cursor-pointer transition-transform hover:scale-105' : ''}
                      ${isToday ? 'font-bold shadow-[0_0_0_2px_theme(colors.primary-color)]' : ''}
                      ${statusClass}
                    `}
          onClick={() => hasData && handleDayClick(dateStr)}
        >
          {/* TRADUÇÃO de .calendar-day-number */}
          <span className="font-semibold">{day}</span>
        </div>
      );
    }

    return days;
  };

  const weekdays = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

  return (
    <div className="bg-card-background-color dark:bg-dark-card-background-color rounded-xl shadow-card-shadow p-4 md:p-6 mt-8">
      {/* TRADUÇÃO de .calendar-header */}
      <div className="flex justify-between items-center mb-4">
        <button
          onClick={() => changeMonth(-1)}
          className="bg-transparent border-none text-2xl cursor-pointer p-2 rounded-lg text-text-color dark:text-dark-text-color
                     hover:bg-background-color dark:hover:bg-dark-background-color"
        >
          &lt;
        </button>
        <h2 className="m-0 text-xl font-bold text-heading-color dark:text-dark-heading-color border-none">
          {currentDate.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}
        </h2>
        <button
          onClick={() => changeMonth(1)}
          className="bg-transparent border-none text-2xl cursor-pointer p-2 rounded-lg text-text-color dark:text-dark-text-color
                     hover:bg-background-color dark:hover:bg-dark-background-color"
        >
          &gt;
        </button>
      </div>

      {/* TRADUÇÃO de .goal-calendar (grid) */}
      <div className="grid grid-cols-7 gap-1 sm:gap-2">
        {weekdays.map(day => (
          // TRADUÇÃO de .calendar-weekday
          <div key={day} className="text-center p-2 rounded-md text-xs sm:text-sm font-bold text-subtle-text-color dark:text-dark-subtle-text-color">
            {day}
          </div>
        ))}
        {renderCalendar()}
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