import React, { useMemo, useState } from 'react'; // ADICIONAR useState aqui
import DisciplineSummaryTable from './DisciplineSummaryTable.jsx';
import WeeklyGoalsPanel from './WeeklyGoalsPanel.jsx';
import DayDetailsModal from './DayDetailsModal.jsx';

const dateToYMD_local = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

const formatDecimalHours = (d) => {
    if (!d || d < 0) return '00h 00m';
    const totalMinutes = Math.round(d * 60);
    const h = Math.floor(totalMinutes / 60);
    const m = totalMinutes % 60;
    return `${String(h).padStart(2, '0')}h ${String(m).padStart(2, '0')}m`;
};

function Home({ questionsData, hoursData, goalsHistory, setActiveTab }) {
  // MOVER O ESTADO PARA ANTES DO useMemo
  const [selectedDate, setSelectedDate] = useState(null);

  const handleDayClick = (date) => {
    const dayQuestions = questionsData.filter(d => d.date === date);
    const dayHours = hoursData.filter(d => d.date === date);
    setSelectedDate({ date, dayQuestions, dayHours });
  };

  const getGoalsForDate = (dateStr) => {
    if (!goalsHistory || goalsHistory.length === 0) return { questions: 0, hours: 0 };
    const sortedGoals = [...goalsHistory].sort((a, b) => new Date(b.startDate) - new Date(a.startDate));
    return sortedGoals.find(g => g.startDate <= dateStr) || { questions: 0, hours: 0 };
  };

  const homeStats = useMemo(() => {
    try {
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

      const totalQuestions = questionsData.reduce((sum, item) => sum + item.questions, 0);
      const totalCorrect = questionsData.reduce((sum, item) => sum + item.correct, 0);
      const totalTime = hoursData.reduce((sum, item) => sum + item.hours, 0);

      let currentStreak = 0;
      const today = new Date();
      const yesterday = new Date();
      yesterday.setDate(today.getDate() - 1);

      const lastStudyDay = Object.keys(studyDays).sort().pop();
      if (lastStudyDay === dateToYMD_local(today) || lastStudyDay === dateToYMD_local(yesterday)) {
          for (let i = 0; i < 90; i++) {
              const dateToCheck = new Date();
              dateToCheck.setDate(today.getDate() - i);
              const dateStr = dateToYMD_local(dateToCheck);
              const dayData = studyDays[dateStr];

              if (dayData) {
                  const goalsForDay = getGoalsForDate(dateStr);
                  const qGoalMet = dayData.questions > 0 && dayData.questions >= goalsForDay.questions;
                  const hGoalMet = dayData.hours > 0 && dayData.hours >= goalsForDay.hours;
                  if (qGoalMet || hGoalMet) {
                      currentStreak++;
                  } else {
                      if (i === 0 && dateStr === dateToYMD_local(today)) continue;
                      break;
                  }
              } else {
                  if (i > 0) break;
              }
          }
      }

      const last14Days = Array.from({ length: 14 }).map((_, i) => {
          const date = new Date();
          date.setDate(new Date().getDate() - (13 - i));
          const dateStr = dateToYMD_local(date);
          const dayData = studyDays[dateStr];
          let status = 'no-data';
          const hasData = !!dayData;

          if(hasData) {
              const goalsForDay = getGoalsForDate(dateStr);
              const qGoalMet = dayData.questions >= goalsForDay.questions;
              const hGoalMet = dayData.hours >= goalsForDay.hours;
              if (qGoalMet && hGoalMet) status = 'goal-met-both';
              else if (qGoalMet || hGoalMet) status = 'goal-met-one';
              else status = 'goal-not-met';
          }

          return {
            date: dateStr,
            status,
            hasData,
            title: new Date(dateStr + 'T03:00:00').toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: 'short' })
          };
      });

      return {
        streak: currentStreak,
        last14Days: last14Days,
        performance: {
          correct: totalCorrect,
          wrong: totalQuestions - totalCorrect,
          percentage: totalQuestions > 0 ? (totalCorrect / totalQuestions) * 100 : 0,
          total: totalQuestions
        },
        totalTime: totalTime,
      };
    } catch (error) {
        console.error("Erro ao calcular estatísticas da Home:", error);
        return { streak: 0, last14Days: [], performance: { correct: 0, wrong: 0, percentage: 0, total: 0 }, totalTime: 0 };
    }
  }, [questionsData, hoursData, goalsHistory]);

  return (
    <div>
      <div className="home-grid">
        <div className="home-card">
          <h3>Tempo de Estudo</h3>
          <p className="stat-big">{formatDecimalHours(homeStats.totalTime)}</p>
        </div>
        <div className="home-card">
          <h3>Questões Resolvidas</h3>
          <p className="stat-big">{homeStats.performance.total}</p>
        </div>
        <div className="home-card">
          <h3>Desempenho</h3>
          <div className="stat-secondary">
            <span className="correct">{homeStats.performance.correct} Acertos</span>
            <span className="wrong">{homeStats.performance.wrong} Erros</span>
          </div>
          <p className="stat-big">{homeStats.performance.percentage.toFixed(0)}%</p>
        </div>

        <div className="home-card grid-col-span-full">
            <h3>🔥 Constância nos Estudos</h3>
            <p>Você está há <span style={{fontWeight: 700, color: 'var(--success-color)'}}>{homeStats.streak} {homeStats.streak === 1 ? 'dia' : 'dias'}</span> sem falhar!</p>
            <div className="streak-tracker-full">
                {homeStats.last14Days.map(day => (
                    <div
                        key={day.date}
                        data-tooltip={day.title}
                        className={`streak-day-full ${day.status} ${day.date === dateToYMD_local(new Date()) ? 'today' : ''} ${day.hasData ? 'has-data' : ''}`}
                        onClick={() => day.hasData && handleDayClick(day.date)}
                    ></div>
                ))}
            </div>
        </div>

        <WeeklyGoalsPanel
            questionsData={questionsData}
            hoursData={hoursData}
            goalsHistory={goalsHistory}
            setActiveTab={setActiveTab}
        />

        <DisciplineSummaryTable
          questionsData={questionsData}
          hoursData={hoursData}
        />
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

export default Home;