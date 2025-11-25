import React, { useMemo, useState } from 'react';
import DisciplineSummaryTable from './DisciplineSummaryTable.jsx';
import DayDetailsModal from './DayDetailsModal.jsx';
import {
  Clock,
  Target,
  TrendingUp,
  Flame,
  Calendar,
  CheckCircle2,
  XCircle,
  Play,
  Zap,
  BookOpen
} from 'lucide-react';

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

// --- Card Padrão de Estatística ---
const StatCard = ({ icon: Icon, title, value, subValue, className = "" }) => (
  <div className={`dashboard-card relative overflow-hidden group p-3 md:p-6 h-[110px] md:h-[140px] flex flex-col justify-center items-start transition-all duration-500 hover:shadow-glow border-l-4 border-transparent hover:border-red-500 bg-card-light dark:bg-card-dark ${className}`}>
    <div className="relative z-20 flex flex-col gap-0.5 md:gap-1 w-full">
      <h3 className="text-[10px] md:text-xs font-bold uppercase tracking-wider text-text-secondary dark:text-text-dark-secondary truncate w-full">
        {title}
      </h3>
      <div className="flex flex-col md:flex-row md:items-end gap-0 md:gap-2">
        <p className="text-2xl md:text-3xl lg:text-4xl font-extrabold text-text-primary dark:text-text-dark-primary tracking-tight leading-none">
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

// --- CARD DE CICLO ATIVO ---
const ActiveCycleCard = ({ activeCicloData, onClick }) => {
  const hasCycle = !!activeCicloData;

  return (
    <div
      id="active-cycle-card" // ID ADICIONADO PARA O TOUR
      onClick={onClick}
      className={`
        relative overflow-hidden group p-4 h-[110px] md:h-[140px]
        flex items-center
        rounded-2xl cursor-pointer shadow-lg transition-all duration-500
        hover:shadow-red-500/40 hover:-translate-y-1 active:scale-95
        ${hasCycle
          ? 'bg-gradient-to-br from-red-600 to-red-800 text-white'
          : 'bg-zinc-100 dark:bg-zinc-800 border-2 border-dashed border-zinc-300 dark:border-zinc-700 text-zinc-500'}
      `}
    >
      {hasCycle ? (
        <>
          <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10 mix-blend-overlay pointer-events-none"></div>
          <div className="absolute -right-10 -top-10 text-white/5 group-hover:text-white/10 transition-all duration-700 transform group-hover:rotate-[30deg] group-hover:scale-150 pointer-events-none">
            <Zap size={140} fill="currentColor" />
          </div>

          <div className="relative z-10 w-full flex items-center justify-between gap-4">
            <div className="flex flex-col justify-center flex-1 min-w-0">
               <div className="flex items-center gap-2 mb-1 opacity-90">
                  <div className="w-2.5 h-2.5 rounded-full bg-green-400 animate-pulse shadow-[0_0_8px_rgba(74,222,128,0.9)] border border-white/30 shrink-0"></div>
                  <span className="text-[10px] font-bold uppercase tracking-widest text-white/80">Ciclo Ativo</span>
               </div>

               <h2 className="text-sm md:text-xl font-black leading-tight line-clamp-2 drop-shadow-md w-full" title={activeCicloData.nome}>
                 {activeCicloData.nome}
               </h2>
            </div>

            <div className="flex flex-col items-center justify-center shrink-0 gap-1">
               <div className="w-10 h-10 md:w-12 md:h-12 rounded-full bg-white text-red-600 shadow-xl flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                  <Play size={20} fill="currentColor" className="ml-1" />
               </div>
               <span className="text-[9px] font-bold uppercase text-white/90">Iniciar</span>
            </div>
          </div>
        </>
      ) : (
        <div className="flex flex-col items-center justify-center w-full text-center gap-2">
          <BookOpen size={24} className="opacity-40" />
          <div>
            <span className="block text-xs font-bold uppercase opacity-70">Nenhum ciclo</span>
            <span className="text-[10px] bg-zinc-200 dark:bg-zinc-700 px-2 py-0.5 rounded opacity-60 mt-1 inline-block">Criar Novo</span>
          </div>
        </div>
      )}
    </div>
  );
};

function Home({ registrosEstudo, goalsHistory, setActiveTab, activeCicloData, onDeleteRegistro }) {
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
        if (!dateStr) return;
        studyDays[dateStr] = studyDays[dateStr] || { questions: 0, correct: 0, hours: 0 };
        const questoes = item.questoesFeitas || 0;
        const acertadas = item.acertos || 0;
        const minutos = item.tempoEstudadoMinutos || 0;

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
            if (qGoalMet || hGoalMet) currentStreak++;
            else { if (i === 0 && dateStr === dateToYMD_local(today)) continue; break; }
          } else { if (i > 0) break; }
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
        return { date: dateStr, status, hasData };
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
      console.error(error);
      return { streak: 0, last14Days: [], performance: { correct: 0, wrong: 0, percentage: 0, total: 0 }, totalTimeMinutes: 0 };
    }
  }, [registrosEstudo, goalsHistory]);

  return (
    <div className="space-y-4 md:space-y-6 animate-slide-up pb-8 relative">

      {/* Grid Principal */}
      <div id="home-stats-grid" className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 pt-0">
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
          className="col-span-1"
          value={`${homeStats.performance.percentage.toFixed(0)}%`}
          subValue={
            <div className="flex items-center gap-2 text-[10px] md:text-sm font-bold md:ml-1 mt-1 md:mt-0">
              <span className="text-emerald-500 flex items-center">
                <CheckCircle2 size={12} className="mr-0.5" strokeWidth={3}/> {homeStats.performance.correct}
              </span>
              <span className="text-zinc-300">|</span>
              <span className="text-red-500 flex items-center">
                <XCircle size={12} className="mr-0.5" strokeWidth={3}/> {homeStats.performance.wrong}
              </span>
            </div>
          }
        />

        {/* CARD DE AÇÃO */}
        <ActiveCycleCard
          activeCicloData={activeCicloData}
          onClick={() => setActiveTab('ciclos')}
        />

        {/* Streak Heatmap */}
        <div className="dashboard-card p-3 md:p-6 col-span-2 lg:col-span-4 flex flex-col lg:flex-row items-stretch justify-between gap-4 md:gap-8 relative overflow-hidden z-0">
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

            {/* Heatmap 14 dias */}
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
                        ${day.date === dateToYMD_local(new Date()) ? 'ring-1 md:ring-2 ring-red-500' : ''}
                        ${day.hasData ? 'active:scale-95' : 'cursor-default opacity-60'}
                      `}
                    ></div>
                  </div>
                ))}
              </div>
            </div>
        </div>
      </div>

      <DisciplineSummaryTable registrosEstudo={registrosEstudo} />

      {selectedDate && (
        <DayDetailsModal
          date={selectedDate.date}
          dayData={{ dayQuestions: selectedDate.dayQuestions, dayHours: selectedDate.dayHours }}
          goals={getGoalsForDate(selectedDate.date)}
          onClose={() => setSelectedDate(null)}
        />
      )}
    </div>
  );
}

export default Home;