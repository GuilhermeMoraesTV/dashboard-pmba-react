import React, { useState, useMemo } from 'react';

// NOVA FUNÇÃO DE DATA LOCAL
const dateToYMD_local = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

function CalendarTab({ questionsData, hoursData, goalsHistory, onDayClick }) {
  const [currentDate, setCurrentDate] = useState(new Date());

  const getGoalsForDate = (dateStr) => {
    if (!goalsHistory || goalsHistory.length === 0) return { questions: 0, hours: 0 };
    const sortedGoals = [...goalsHistory].sort((a, b) => new Date(b.startDate) - new Date(a.startDate));
    return sortedGoals.find(g => g.startDate <= dateStr) || { questions: 0, hours: 0 };
  };

  const calendarGrid = useMemo(() => {
    const month = currentDate.getMonth();
    const year = currentDate.getFullYear();
    const firstDayOfMonth = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const grid = [];
    const emptyDays = (firstDayOfMonth === 0) ? 6 : firstDayOfMonth - 1;
    for (let i = 0; i < emptyDays; i++) {
      grid.push({ key: `empty-${i}`, isEmpty: true });
    }

    for (let i = 1; i <= daysInMonth; i++) {
      const dayDate = new Date(year, month, i);
      const dayYMD = dateToYMD_local(dayDate); // CORRIGIDO

      const goalsForDay = getGoalsForDate(dayYMD);
      const dayQuestions = questionsData.filter(d => d.date === dayYMD).reduce((sum, d) => sum + d.questions, 0);
      const dayHours = hoursData.filter(d => d.date === dayYMD).reduce((sum, d) => sum + d.hours, 0);

      const qGoalMet = dayQuestions > 0 && dayQuestions >= goalsForDay.questions;
      const hGoalMet = dayHours > 0 && dayHours >= goalsForDay.hours;

      let className = 'calendar-day';
      if (dayQuestions > 0 || dayHours > 0) {
        className += ' has-data';
        if (qGoalMet && hGoalMet) className += ' goal-met-both';
        else if (qGoalMet || hGoalMet) className += ' goal-met-one';
        else className += ' goal-not-met';
      }
      if (dayYMD === dateToYMD_local(new Date())) className += ' today'; // CORRIGIDO

      grid.push({
        key: dayYMD,
        day: i,
        date: dayYMD,
        className,
        hasData: dayQuestions > 0 || dayHours > 0,
        icons: { q: qGoalMet, h: hGoalMet }
      });
    }
    return grid;
  }, [currentDate, questionsData, hoursData, goalsHistory]);

  const changeMonth = (offset) => {
    setCurrentDate(prevDate => {
      const newDate = new Date(prevDate);
      newDate.setMonth(newDate.getMonth() + offset);
      return newDate;
    });
  };

  return (
    <div>
      <div className="calendar-header">
        <button onClick={() => changeMonth(-1)} className="calendar-nav">ᐊ</button>
        <h2 style={{ margin: 0, border: 'none' }}>
          {currentDate.toLocaleString('pt-BR', { month: 'long', year: 'numeric' })}
        </h2>
        <button onClick={() => changeMonth(1)} className="calendar-nav">ᐅ</button>
      </div>
      <div className="goal-calendar">
        {['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'].map(day => (
          <div key={day} className="calendar-weekday">{day}</div>
        ))}
      </div>
      <div className="goal-calendar">
        {calendarGrid.map(dayInfo =>
          dayInfo.isEmpty ? <div key={dayInfo.key}></div> : (
            <div key={dayInfo.key} className={dayInfo.className} onClick={() => dayInfo.hasData && onDayClick(dayInfo.date)}>
              <span className="calendar-day-number">{dayInfo.day}</span>
              <div className="calendar-day-icons">
                {dayInfo.icons.q && '🎯'}
                {dayInfo.icons.h && '⏰'}
              </div>
            </div>
          )
        )}
      </div>
    </div>
  );
}

export default CalendarTab;