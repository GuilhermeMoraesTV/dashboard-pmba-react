import React, { useMemo, useState } from 'react';
import DisciplineSummaryTable from './DisciplineSummaryTable.jsx';
import WeeklyGoalsPanel from './WeeklyGoalsPanel.jsx';
import DayDetailsModal from './DayDetailsModal.jsx';
import { Clock, Target, TrendingUp, Flame } from 'lucide-react';

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
        if (!dateStr || typeof dateStr !== 'string' || dateStr.split('-').length !== 3) return;

        studyDays[dateStr] = studyDays[dateStr] || { questions: 0, correct: 0, hours: 0 };

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
      console.error("Erro ao calcular estatísticas:", error);
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

        <div className="group bg-gradient-to-br from-blue-500 to-blue-600 dark:from-blue-600 dark:to-blue-700 rounded-xl shadow-card-shadow hover:shadow-card-hover p-6 flex flex-col min-h-[140px] transition-all duration-300 hover:-translate-y-1 border border-blue-400 dark:border-blue-500">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 bg-white/20 rounded-lg">
              <Clock size={24} className="text-white" />
            </div>
            <h3 className="text-sm text-white/90 uppercase font-semibold tracking-wide">
              Tempo de Estudo
            </h3>
          </div>
          <p className="text-4xl md:text-5xl font-bold text-white mt-auto self-end group-hover:scale-110 transition-transform">
            {formatDecimalHours(homeStats.totalTimeMinutes)}
          </p>
        </div>

        <div className="group bg-gradient-to-br from-green-500 to-green-600 dark:from-green-600 dark:to-green-700 rounded-xl shadow-card-shadow hover:shadow-card-hover p-6 flex flex-col min-h-[140px] transition-all duration-300 hover:-translate-y-1 border border-green-400 dark:border-green-500">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 bg-white/20 rounded-lg">
              <Target size={24} className="text-white" />
            </div>
            <h3 className="text-sm text-white/90 uppercase font-semibold tracking-wide">
              Questões Resolvidas
            </h3>
          </div>
          <p className="text-4xl md:text-5xl font-bold text-white mt-auto self-end group-hover:scale-110 transition-transform">
            {homeStats.performance.total}
          </p>
        </div>

        <div className="group bg-gradient-to-br from-purple-500 to-purple-600 dark:from-purple-600 dark:to-purple-700 rounded-xl shadow-card-shadow hover:shadow-card-hover p-6 flex flex-col min-h-[140px] transition-all duration-300 hover:-translate-y-1 border border-purple-400 dark:border-purple-500">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 bg-white/20 rounded-lg">
              <TrendingUp size={24} className="text-white" />
            </div>
            <h3 className="text-sm text-white/90 uppercase font-semibold tracking-wide">
              Desempenho
            </h3>
          </div>
          <div className="text-sm font-semibold flex flex-col gap-1 mb-2">
            <span className="text-white/80">{homeStats.performance.correct} Acertos</span>
            <span className="text-white/80">{homeStats.performance.wrong} Erros</span>
          </div>
          <p className="text-4xl md:text-5xl font-bold text-white mt-auto self-end group-hover:scale-110 transition-transform">
            {homeStats.performance.percentage.toFixed(0)}%
          </p>
        </div>

        <div className="bg-card-light dark:bg-card-dark rounded-xl shadow-card-shadow hover:shadow-card-hover p-6 col-span-1 md:col-span-2 lg:col-span-3 border border-border-light dark:border-border-dark transition-all duration-300">
          <div className="flex items-center gap-3 mb-4">
            <Flame size={24} className="text-orange-500" />
            <h3 className="text-lg font-semibold text-text-heading dark:text-text-dark-heading">
              Constância nos Estudos
            </h3>
          </div>
          <p className="text-text-DEFAULT dark:text-text-dark-DEFAULT mb-4">
            Você está há <span className="font-bold text-green-500">
              {homeStats.streak} {homeStats.streak === 1 ? 'dia' : 'dias'}
            </span> sem falhar!
          </p>
          <div className="flex gap-1 h-12">
            {homeStats.last14Days.map(day => (
              <div
                key={day.date}
                data-tooltip={day.title}
                className={`flex-1 h-full transition-all duration-200 first:rounded-l-lg last:rounded-r-lg hover:brightness-110 ${day.status === 'goal-met-both' ? 'bg-green-500' : ''} ${day.status === 'goal-met-one' ? 'bg-yellow-500' : ''} ${day.status === 'goal-not-met' ? 'bg-red-500' : ''} ${day.status === 'no-data' ? 'bg-border-light dark:bg-border-dark opacity-50' : ''} ${day.date === dateToYMD_local(new Date()) ? 'ring-2 ring-primary ring-inset' : ''} ${day.hasData ? 'cursor-pointer hover:-translate-y-1 hover:shadow-lg' : ''}`}
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
        />
      )}
    </div>
  );
}

export default Home;