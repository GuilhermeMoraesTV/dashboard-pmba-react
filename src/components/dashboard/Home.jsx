import React, { useMemo, useState } from 'react';
import DisciplineSummaryTable from './DisciplineSummaryTable.jsx';
import WeeklyGoalsPanel from './WeeklyGoalsPanel.jsx';
import DayDetailsModal from './DayDetailsModal.jsx';

// Funções Helper
const dateToYMD_local = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const formatDecimalHours = (minutes) => {
  if (!minutes || minutes < 0) return '00h 00m';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, '0')}h ${String(m).padStart(2, '0')}m`;
};

function Home({ registrosEstudo, goalsHistory, setActiveTab, onDeleteRegistro }) {
  const [selectedDate, setSelectedDate] = useState(null);

  const handleDayClick = (date) => {
    const dayRegistros = registrosEstudo.filter(r => r.data === date);
    const dayQuestions = dayRegistros.filter(r => (r.questoesFeitas || 0) > 0);
    const dayHours = dayRegistros.filter(r => (r.tempoEstudadoMinutos || 0) > 0);
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
      let totalQuestions = 0;
      let totalCorrect = 0;
      let totalTimeMinutes = 0;

      registrosEstudo.forEach(item => {
        const dateStr = item.data;
        if (!dateStr || typeof dateStr !== 'string' || dateStr.split('-').length !== 3) {
          return;
        }

        studyDays[dateStr] = studyDays[dateStr] || { questions: 0, correct: 0, hours: 0 };

        // NORMALIZAÇÃO COMPLETA
        const questoes = item.questoesFeitas || 0;
        const acertadas = item.acertos || item.questoesAcertadas || 0;
        const minutos = item.tempoEstudadoMinutos || item.duracaoMinutos || 0;

        if (questoes > 0) {
          studyDays[dateStr].questions += questoes;
          studyDays[dateStr].correct += acertadas;
          totalQuestions += questoes;
          totalCorrect += acertadas;
        }

        if (minutos > 0) {
          studyDays[dateStr].hours += (minutos / 60);
          totalTimeMinutes += minutos;
        }
      });

      // Cálculo do Streak
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
            const qGoalMet = dayData.questions > 0 && dayData.questions >= (goalsForDay.questions || 0);
            const hGoalMet = dayData.hours > 0 && dayData.hours >= (goalsForDay.hours || 0);
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

      // Últimos 14 dias
      const last14Days = Array.from({ length: 14 }).map((_, i) => {
        const date = new Date();
        date.setDate(new Date().getDate() - (13 - i));
        const dateStr = dateToYMD_local(date);
        const dayData = studyDays[dateStr];
        let status = 'no-data';
        const hasData = !!dayData && (dayData.questions > 0 || dayData.hours > 0);

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

        return {
          date: dateStr,
          status,
          hasData,
          title: new Date(dateStr + 'T03:00:00').toLocaleDateString('pt-BR', {
            weekday: 'short',
            day: '2-digit',
            month: 'short'
          })
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
        totalTimeMinutes: totalTimeMinutes,
      };
    } catch (error) {
      console.error("Erro ao calcular estatísticas da Home:", error);
      return {
        streak: 0,
        last14Days: [],
        performance: { correct: 0, wrong: 0, percentage: 0, total: 0 },
        totalTimeMinutes: 0
      };
    }
  }, [registrosEstudo, goalsHistory]);

  return (
    <div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">

        {/* Card Tempo */}
        <div className="bg-card-background-color dark:bg-dark-card-background-color rounded-xl shadow-card-shadow p-4 md:p-6 flex flex-col min-h-[120px]">
          <h3 className="text-sm text-subtle-text-color dark:text-dark-subtle-text-color uppercase font-semibold mb-2">
            Tempo de Estudo
          </h3>
          <p className="text-3xl md:text-4xl font-bold text-heading-color dark:text-dark-heading-color mt-auto self-end">
            {formatDecimalHours(homeStats.totalTimeMinutes)}
          </p>
        </div>

        {/* Card Questões */}
        <div className="bg-card-background-color dark:bg-dark-card-background-color rounded-xl shadow-card-shadow p-4 md:p-6 flex flex-col min-h-[120px]">
          <h3 className="text-sm text-subtle-text-color dark:text-dark-subtle-text-color uppercase font-semibold mb-2">
            Questões Resolvidas
          </h3>
          <p className="text-3xl md:text-4xl font-bold text-heading-color dark:text-dark-heading-color mt-auto self-end">
            {homeStats.performance.total}
          </p>
        </div>

        {/* Card Desempenho */}
        <div className="bg-card-background-color dark:bg-dark-card-background-color rounded-xl shadow-card-shadow p-4 md:p-6 flex flex-col min-h-[120px]">
          <h3 className="text-sm text-subtle-text-color dark:text-dark-subtle-text-color uppercase font-semibold mb-2">
            Desempenho
          </h3>
          <div className="text-sm font-semibold flex flex-col gap-1">
            <span className="text-success-color">{homeStats.performance.correct} Acertos</span>
            <span className="text-danger-color">{homeStats.performance.wrong} Erros</span>
          </div>
          <p className="text-3xl md:text-4xl font-bold text-heading-color dark:text-dark-heading-color mt-auto self-end">
            {homeStats.performance.percentage.toFixed(0)}%
          </p>
        </div>

        {/* Constância */}
        <div className="bg-card-background-color dark:bg-dark-card-background-color rounded-xl shadow-card-shadow p-4 md:p-6 col-span-1 md:col-span-2 lg:col-span-3">
          <h3 className="text-sm text-subtle-text-color dark:text-dark-subtle-text-color uppercase font-semibold mb-2">
            🔥 Constância nos Estudos
          </h3>
          <p className='dark:text-dark-text-color'>
            Você está há <span className="font-bold text-success-color">
              {homeStats.streak} {homeStats.streak === 1 ? 'dia' : 'dias'}
            </span> sem falhar!
          </p>
          <div className="flex gap-0.5 mt-4 h-8 md:h-10">
            {homeStats.last14Days.map(day => (
              <div
                key={day.date}
                data-tooltip={day.title}
                className={`flex-1 h-full transition-all duration-200 first:rounded-l-md last:rounded-r-md
                  ${day.status === 'goal-met-both' ? 'bg-goal-met-both' : ''}
                  ${day.status === 'goal-met-one' ? 'bg-goal-met-one' : ''}
                  ${day.status === 'goal-not-met' ? 'bg-goal-not-met' : ''}
                  ${day.status === 'no-data' ? 'bg-border-color dark:bg-dark-border-color opacity-60' : ''}
                  ${day.date === dateToYMD_local(new Date()) ? 'shadow-[inset_0_-3px_0_theme(colors.primary-color)]' : ''}
                  ${day.hasData ? 'cursor-pointer hover:-translate-y-0.5 hover:brightness-110' : ''}
                `}
                onClick={() => day.hasData && handleDayClick(day.date)}
              ></div>
            ))}
          </div>
        </div>

        <WeeklyGoalsPanel
          registrosEstudo={registrosEstudo}
          goalsHistory={goalsHistory}
          setActiveTab={setActiveTab}
        />

        <DisciplineSummaryTable registrosEstudo={registrosEstudo} />
      </div>

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

export default Home;