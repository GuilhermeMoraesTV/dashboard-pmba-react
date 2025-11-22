import React, { useMemo, useState } from 'react';
import DisciplineSummaryTable from './DisciplineSummaryTable.jsx';
import DayDetailsModal from './DayDetailsModal.jsx';
import DailyTacticalHUD from './DailyTacticalHUD.jsx';
import { Clock, Target, TrendingUp, Flame, Calendar, CheckCircle2, XCircle } from 'lucide-react';

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

const StatCard = ({ icon: Icon, title, value, subValue, className = "" }) => (
  <div className={`dashboard-card relative overflow-hidden group p-4 md:p-6 h-[110px] md:h-[140px] flex flex-col justify-center items-start transition-all duration-500 hover:shadow-glow border-l-4 border-transparent hover:border-red-500 bg-card-light dark:bg-card-dark ${className}`}>
    <div className="relative z-20 flex flex-col gap-0.5 md:gap-1 w-full">
      <h3 className="text-[10px] md:text-xs font-bold uppercase tracking-wider text-text-secondary dark:text-text-dark-secondary truncate w-full">
        {title}
      </h3>
      <div className="flex flex-col md:flex-row md:items-end gap-0 md:gap-2">
        <p className="text-2xl md:text-4xl font-extrabold text-text-primary dark:text-text-dark-primary tracking-tight leading-none">
          {value}
        </p>
        {subValue && <div className="mb-0 md:mb-1 text-xs md:text-sm opacity-90">{subValue}</div>}
      </div>
    </div>
    <div className="absolute -bottom-4 -right-4 md:-bottom-6 md:-right-6 text-red-500/10 dark:text-red-500/5 transition-all duration-700 ease-out group-hover:scale-125 group-hover:rotate-[-10deg] group-hover:text-red-500/15 dark:group-hover:text-red-500/10 z-10 pointer-events-none">
      <Icon strokeWidth={1.5} className="w-24 h-24 md:w-36 md:h-36" />
    </div>
  </div>
);

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
    <div className="space-y-4 md:space-y-6 animate-slide-up pb-8 relative">

      {/* HUD Tático Flutuante - Agora é a única visualização de meta */}
      <DailyTacticalHUD registrosEstudo={registrosEstudo} goalsHistory={goalsHistory} />

      {/* Grid Principal - Adicionado padding top para o HUD não cobrir */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 md:gap-6 pt-4">

        <StatCard
          icon={Clock}
          title="Tempo de Estudo"
          value={formatDecimalHours(homeStats.totalTimeMinutes)}
        />
        <StatCard
          icon={Target}
          title="Questões Feitas"
          value={homeStats.performance.total}
        />
        <StatCard
          icon={TrendingUp}
          title="Precisão Geral"
          className="col-span-2 lg:col-span-1"
          value={`${homeStats.performance.percentage.toFixed(0)}%`}
          subValue={
            <div className="flex items-center gap-2 text-[10px] md:text-sm font-bold md:ml-2 mt-1 md:mt-0">
              <span className="text-emerald-500 flex items-center">
                <CheckCircle2 size={12} className="mr-0.5 md:mr-1" strokeWidth={3}/> {homeStats.performance.correct}
              </span>
              <span className="text-zinc-300">|</span>
              <span className="text-red-500 flex items-center">
                <XCircle size={12} className="mr-0.5 md:mr-1" strokeWidth={3}/> {homeStats.performance.wrong}
              </span>
            </div>
          }
        />

        {/* Streak / Heatmap */}
        <div className="dashboard-card p-4 md:p-6 col-span-2 lg:col-span-3 flex flex-col lg:flex-row items-stretch justify-between gap-4 md:gap-8 relative overflow-hidden z-0">
            <div className="absolute top-0 left-0 w-full h-full pointer-events-none">
               <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-red-500/50 to-transparent opacity-20"></div>
            </div>
            <div className="flex items-center gap-3 md:gap-5 w-full lg:w-auto z-20 relative my-auto">
              <div className={`p-3 md:p-4 rounded-2xl shadow-lg transition-colors duration-500 ${homeStats.streak > 0 ? 'bg-gradient-to-br from-orange-500 to-red-600 text-white shadow-orange-500/20' : 'bg-zinc-200 dark:bg-zinc-800 text-zinc-400'}`}>
                <Flame size={24} className={`md:w-8 md:h-8 ${homeStats.streak > 0 ? "animate-pulse fill-current" : ""}`} strokeWidth={1.5} />
              </div>
              <div>
                <h3 className="text-xs md:text-sm font-semibold uppercase tracking-wider text-text-secondary dark:text-text-dark-secondary mb-0.5">Sequência</h3>
                <div className="flex items-baseline gap-1.5 md:gap-2">
                   <p className="text-3xl md:text-4xl font-extrabold text-text-primary dark:text-text-dark-primary leading-none">
                     {homeStats.streak}
                   </p>
                   <span className="text-sm md:text-base font-medium text-zinc-500 dark:text-zinc-400">dias</span>
                </div>
              </div>
            </div>
            <div className="flex flex-col w-full lg:flex-1 lg:ml-12 z-20 relative justify-between min-h-[80px] md:min-h-[100px]">
              <div className="flex justify-end w-full mb-1 md:mb-2">
                <span className="text-[9px] md:text-[10px] font-bold uppercase tracking-widest text-zinc-500 dark:text-zinc-400 flex items-center gap-1.5 bg-zinc-100 dark:bg-zinc-800/50 px-2 py-1 rounded-md border border-zinc-200 dark:border-zinc-700/50">
                  <Calendar size={10} className="md:w-3 md:h-3" /> Últimos 14 dias
                </span>
              </div>
              <div className="flex items-end gap-1 md:gap-2 h-12 md:h-16 w-full">
                {homeStats.last14Days.map((day) => (
                  <div key={day.date} className="relative group flex-1 h-full flex flex-col justify-end">
                    <div
                      role="button"
                      onClick={() => { if(day.hasData) handleDayClick(day.date); }}
                      className={`
                        w-full rounded-sm md:rounded-md transition-all duration-300 ease-out cursor-pointer relative
                        border border-white/5 dark:border-white/5
                        ${day.status === 'goal-met-both' ? 'bg-emerald-500 h-full shadow-[0_0_15px_rgba(16,185,129,0.25)]' : ''}
                        ${day.status === 'goal-met-one' ? 'bg-amber-500 h-[75%] shadow-[0_0_15px_rgba(245,158,11,0.25)]' : ''}
                        ${day.status === 'goal-not-met' ? 'bg-red-500 h-[40%] shadow-[0_0_15px_rgba(239,68,68,0.25)]' : ''}
                        ${day.status === 'no-data' ? 'bg-zinc-200 dark:bg-zinc-800/50 h-[15%]' : ''}
                        ${day.date === dateToYMD_local(new Date()) ? 'ring-1 md:ring-2 ring-red-500 ring-offset-1 md:ring-offset-2 ring-offset-card-light dark:ring-offset-card-dark' : ''}
                        ${day.hasData ? 'active:scale-95' : 'cursor-default opacity-60'}
                      `}
                    >
                         {day.date === dateToYMD_local(new Date()) && (
                             <div className="absolute -top-2 left-1/2 -translate-x-1/2 w-1 h-1 md:w-1.5 md:h-1.5 bg-red-500 rounded-full"></div>
                         )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
        </div>
      </div>

      {/* Seção Inferior: Apenas o Ranking (Ocupando largura total) */}
      <div className="h-[450px]">
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