import React, { useMemo, useState, useEffect } from 'react';
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
  BookOpen,
  AlertTriangle
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
      id="active-cycle-card"
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
  const [showGoalAlert, setShowGoalAlert] = useState(false);

  const handleDayClick = (date) => {
    const dayRegistros = registrosEstudo.filter(r => r.data === date);
    const dayQuestions = dayRegistros.filter(r => (r.questoesFeitas || 0) > 0);
    const dayHours = dayRegistros.filter(r => (r.tempoEstudadoMinutos || 0) > 0);
    setSelectedDate({ date, dayQuestions, dayHours });
  };

  const getGoalsForDate = (dateStr) => {
    if (!goalsHistory || goalsHistory.length === 0) return { questions: 0, hours: 0 };
    const sortedGoals = [...goalsHistory].sort((a, b) => new Date(b.startDate) - new Date(a.startDate));
    const goal = sortedGoals.find(g => g.startDate <= dateStr) || { questions: 0, hours: 0 };
    return goal;
  };

  useEffect(() => {
    const hasRecords = registrosEstudo.length > 0;
    const hasGoals = goalsHistory.length > 0;
    if (hasRecords && !hasGoals) {
        setShowGoalAlert(true);
    } else {
        setShowGoalAlert(false);
    }
  }, [registrosEstudo.length, goalsHistory.length]);


  const homeStats = useMemo(() => {
    try {
      const studyDays = {};
      let totalQuestions = 0;
      let totalCorrect = 0;
      let totalTimeMinutes = 0;

      const hasAnyRecordsOverall = registrosEstudo.length > 0;
      const hasDefinedGoals = goalsHistory.length > 0;

      const oldestGoal = hasDefinedGoals
        ? [...goalsHistory].sort((a, b) => new Date(a.startDate) - new Date(b.startDate))[0]
        : null;
      const firstGoalDateStr = oldestGoal ? oldestGoal.startDate : null;

      registrosEstudo.forEach(item => {
        const dateStr = item.data;
        if (!dateStr) return;
        studyDays[dateStr] = studyDays[dateStr] || { questions: 0, correct: 0, hours: 0, minutes: 0 };
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
          studyDays[dateStr].minutes += minutos;
          totalTimeMinutes += minutos;
        }
      });

      let currentStreak = 0;
      const today = new Date();
      const todayStr = dateToYMD_local(today);

      for (let i = 0; i < 90; i++) {
          const dateToCheck = new Date();
          dateToCheck.setDate(today.getDate() - i);
          const dateStr = dateToYMD_local(dateToCheck);
          const dayData = studyDays[dateStr];
          const hasStudyData = !!dayData && (dayData.minutes > 0 || dayData.questions > 0);
          const goalsForDay = getGoalsForDate(dateStr);

          const qGoal = goalsForDay.questions || 0;
          const hGoalMinutes = (goalsForDay.hours || 0) * 60;

          let goalMet = false;

          if (!hasDefinedGoals) {
              // Se não tem metas definidas, consideramos o estudo como meta batida
              if (hasStudyData) {
                  goalMet = true;
              } else if (dateStr !== todayStr) {
                  // Se não for hoje e não teve estudo (e não tem metas), quebra a sequencia
                  break;
              }
          } else {
              if (firstGoalDateStr && dateStr < firstGoalDateStr) {
                  break;
              }
              const isTimeGoalMet = hGoalMinutes === 0 || (dayData && dayData.minutes >= hGoalMinutes);
              const isQuestionGoalMet = qGoal === 0 || (dayData && dayData.questions >= qGoal);
              goalMet = isTimeGoalMet && isQuestionGoalMet;
          }

          if (goalMet) {
              currentStreak++;
          } else {
              // --- CORREÇÃO DO BUG AQUI ---
              // Antes estava: if (dateStr === todayStr && !hasStudyData)
              // Isso fazia com que se houvesse dados parciais hoje (!hasStudyData = false),
              // ele entrava no else e quebrava o loop.

              // Nova lógica: Se for HOJE, independente de ter dados ou não,
              // se a meta não foi batida, nós apenas pulamos (continue) para checar ontem.
              // Não podemos dar break só porque a meta de hoje ainda está incompleta.
              if (dateStr === todayStr) {
                  continue;
              } else {
                  break;
              }
          }
      }

      if (!hasDefinedGoals && !hasAnyRecordsOverall) {
          currentStreak = 0;
      }

      // 3. Cálculos para o Heatmap (ADICIONADO DADOS EXTRAS PARA TOOLTIP)
      const last14Days = Array.from({ length: 14 }).map((_, i) => {
        const date = new Date();
        date.setDate(new Date().getDate() - (13 - i));
        const dateStr = dateToYMD_local(date);
        const dayData = studyDays[dateStr];
        let status = 'no-data';
        const hasData = !!dayData && (dayData.questions > 0 || dayData.minutes > 0);

        if (hasData) {
          const goalsForDay = getGoalsForDate(dateStr);
          const qGoal = goalsForDay?.questions || 0;
          const hGoalMinutes = (goalsForDay?.hours || 0) * 60;

          const qGoalMet = dayData.questions >= qGoal;
          const hGoalMet = dayData.minutes >= hGoalMinutes;

          if (qGoalMet && hGoalMet) status = 'goal-met-both';
          else if (qGoalMet || hGoalMet) status = 'goal-met-one';
          else status = 'goal-not-met';
        }

        // Retornamos os dados brutos também para usar no Tooltip
        return {
            date: dateStr,
            status,
            hasData,
            minutes: dayData ? dayData.minutes : 0,
            questions: dayData ? dayData.questions : 0
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
      console.error(error);
      return { streak: 0, last14Days: [], performance: { correct: 0, wrong: 0, percentage: 0, total: 0 }, totalTimeMinutes: 0 };
    }
  }, [registrosEstudo, goalsHistory]);

  return (
    <div className="space-y-4 md:space-y-6 animate-slide-up pb-8 relative">

      {/* ALERTA DE METAS */}
      {showGoalAlert && (
          <div className="p-4 bg-yellow-100 dark:bg-yellow-900/40 text-yellow-800 dark:text-yellow-300 rounded-xl flex items-center gap-3 border border-yellow-300 dark:border-yellow-700 transition-all">
              <AlertTriangle size={20} className="shrink-0" />
              <p className="text-sm font-medium">
                  **Atenção!** Você tem registros de estudo, mas nenhuma meta definida. Defina suas metas em <span className="font-bold">Metas</span> para que sua sequência de constância seja calculada corretamente!
              </p>
          </div>
      )}

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

        <ActiveCycleCard
          activeCicloData={activeCicloData}
          onClick={() => setActiveTab('ciclos')}
        />

        {/* Streak Heatmap */}
        <div className="dashboard-card p-3 md:p-6 col-span-2 lg:col-span-4 flex flex-col lg:flex-row items-stretch justify-between gap-4 md:gap-8 relative overflow-visible z-0">
            <div className="absolute top-0 left-0 w-full h-full pointer-events-none overflow-hidden rounded-2xl">
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
                   <span className="text-sm md:text-base font-medium text-zinc-500 dark:text-zinc-400">dias de estudo</span>
                </div>
              </div>
            </div>

            {/* Heatmap 14 dias COM TOOLTIP */}
            <div className="flex flex-col w-full lg:flex-1 lg:ml-12 z-20 relative justify-between min-h-[80px] md:min-h-[100px]">
              <div className="flex justify-end w-full mb-1 md:mb-2">
                <span className="text-[9px] md:text-[10px] font-bold uppercase tracking-widest text-zinc-500 dark:text-zinc-400 flex items-center gap-1.5 bg-zinc-100 dark:bg-zinc-800/50 px-2 py-1 rounded-md border border-zinc-200 dark:border-zinc-700/50">
                  <Calendar size={10} className="md:w-3 md:h-3" /> Últimos 14 dias
                </span>
              </div>
              <div className="flex items-end gap-1 md:gap-2 h-12 md:h-16 w-full">
                {homeStats.last14Days.map((day) => (
                  <div key={day.date} className="relative group flex-1 h-full flex flex-col justify-end">

                    {/* TOOLTIP CUSTOMIZADO */}
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-3 w-max p-2 bg-zinc-900/95 dark:bg-zinc-800/95 backdrop-blur-sm text-white text-[10px] md:text-xs rounded-lg shadow-xl opacity-0 group-hover:opacity-100 transition-all duration-200 pointer-events-none z-50 transform translate-y-2 group-hover:translate-y-0 border border-zinc-700/50">
                        <div className="font-bold text-center border-b border-white/10 pb-1 mb-1 text-zinc-300">
                            {day.date.split('-').reverse().slice(0, 2).join('/')}
                        </div>
                        <div className="flex flex-col gap-0.5">
                            <div className="flex items-center gap-2">
                                <Clock size={10} className="text-red-400"/>
                                <span className="font-mono">{formatDecimalHours(day.minutes)}</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <Target size={10} className="text-blue-400"/>
                                <span className="font-mono">{day.questions} Questões</span>
                            </div>
                        </div>
                        {/* Seta do Tooltip */}
                        <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-zinc-900/95 dark:border-t-zinc-800/95"></div>
                    </div>

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