import React, { useMemo, useState, useEffect } from 'react';
import DisciplineSummaryTable from './DisciplineSummaryTable.jsx';
import DayDetailsModal from './DayDetailsModal.jsx';
import { db } from '../../firebaseConfig';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { motion, AnimatePresence } from 'framer-motion';
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
  Settings,
  Check
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

function Home({ registrosEstudo, allRegistrosEstudo = [], goalsHistory, setActiveTab, activeCicloData, user }) {
  const [selectedDate, setSelectedDate] = useState(null);
  const [showPrefMenu, setShowPrefMenu] = useState(false);

  const [unifyStreaks, setUnifyStreaks] = useState(() => {
    const saved = localStorage.getItem('unifyStreaks');
    return saved !== null ? JSON.parse(saved) : false;
  });

  useEffect(() => {
    if (!user) return;
    const loadPrefs = async () => {
        const prefDoc = await getDoc(doc(db, 'users', user.uid, 'settings', 'preferences'));
        if(prefDoc.exists()) {
            const cloudValue = prefDoc.data().unifyStreaks || false;
            setUnifyStreaks(cloudValue);
            localStorage.setItem('unifyStreaks', JSON.stringify(cloudValue));
        }
    };
    loadPrefs();
  }, [user]);

  const updateUnifyPreference = async (value) => {
    setUnifyStreaks(value);
    localStorage.setItem('unifyStreaks', JSON.stringify(value));
    if (user) {
        await setDoc(doc(db, 'users', user.uid, 'settings', 'preferences'), { unifyStreaks: value }, { merge: true });
    }
    setShowPrefMenu(false);
  };

  const handlePreferenceClick = (e, value) => {
      e.stopPropagation();
      updateUnifyPreference(value);
  };

  const handleDayClick = (date) => {
    if (showPrefMenu) return;

    const source = unifyStreaks ? allRegistrosEstudo : registrosEstudo;
    const dayRegistros = source.filter(r => r.data === date);
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

  const homeStats = useMemo(() => {
    try {
      const studyDaysFull = {};

      let totalQuestions = 0;
      let totalCorrect = 0;
      let totalTimeMinutes = 0;

      registrosEstudo.forEach(item => {
        totalQuestions += (item.questoesFeitas || 0);
        totalCorrect += (item.acertos || 0);
        totalTimeMinutes += (item.tempoEstudadoMinutos || 0);
      });

      const streakSource = unifyStreaks ? allRegistrosEstudo : registrosEstudo;

      streakSource.forEach(item => {
        const dateStr = item.data;
        if (!dateStr) return;
        studyDaysFull[dateStr] = studyDaysFull[dateStr] || { questions: 0, minutes: 0 };
        studyDaysFull[dateStr].questions += (item.questoesFeitas || 0);
        studyDaysFull[dateStr].minutes += (item.tempoEstudadoMinutos || 0);
      });

      let currentStreak = 0;
      const today = new Date();
      const todayStr = dateToYMD_local(today);
      const hasDefinedGoals = goalsHistory.length > 0;
      const oldestGoal = hasDefinedGoals ? [...goalsHistory].sort((a, b) => new Date(a.startDate) - new Date(b.startDate))[0] : null;
      const firstGoalDateStr = oldestGoal ? oldestGoal.startDate : null;

      for (let i = 0; i < 90; i++) {
          const dateToCheck = new Date();
          dateToCheck.setDate(today.getDate() - i);
          const dateStr = dateToYMD_local(dateToCheck);
          const dayData = studyDaysFull[dateStr];
          const hasStudyData = !!dayData && (dayData.minutes > 0 || dayData.questions > 0);
          const goalsForDay = getGoalsForDate(dateStr);
          const qGoal = goalsForDay.questions || 0;
          const hGoalMinutes = (goalsForDay.hours || 0) * 60;

          let goalMet = false;
          if (!hasDefinedGoals) {
              if (hasStudyData) goalMet = true;
              else if (dateStr !== todayStr) break;
          } else {
              if (firstGoalDateStr && dateStr < firstGoalDateStr) break;
              const isTimeGoalMet = hGoalMinutes === 0 || (dayData && dayData.minutes >= hGoalMinutes);
              const isQuestionGoalMet = qGoal === 0 || (dayData && dayData.questions >= qGoal);
              goalMet = isTimeGoalMet && isQuestionGoalMet;
          }

          if (goalMet) currentStreak++;
          else if (dateStr === todayStr) continue;
          else break;
      }

      const last14Days = Array.from({ length: 14 }).map((_, i) => {
        const date = new Date();
        date.setDate(new Date().getDate() - (13 - i));
        const dateStr = dateToYMD_local(date);
        const dayData = studyDaysFull[dateStr];
        let status = 'no-data';
        const hasData = !!dayData && (dayData.questions > 0 || dayData.minutes > 0);

        if (hasData) {
          const goalsForDay = getGoalsForDate(dateStr);
          const qGoal = goalsForDay?.questions || 0;
          const hGoalMinutes = (goalsForDay?.hours || 0) * 60;
          if (dayData.questions >= qGoal && dayData.minutes >= hGoalMinutes) status = 'goal-met-both';
          else if (dayData.questions >= qGoal || dayData.minutes >= hGoalMinutes) status = 'goal-met-one';
          else status = 'goal-not-met';
        }

        return { date: dateStr, status, hasData, minutes: dayData?.minutes || 0, questions: dayData?.questions || 0 };
      });

      return {
        streak: currentStreak,
        last14Days,
        performance: {
          total: totalQuestions,
          correct: totalCorrect,
          wrong: totalQuestions - totalCorrect,
          percentage: totalQuestions > 0 ? (totalCorrect / totalQuestions) * 100 : 0
        },
        totalTimeMinutes
      };
    } catch (error) {
      return { streak: 0, last14Days: [], performance: { correct: 0, wrong: 0, percentage: 0, total: 0 }, totalTimeMinutes: 0 };
    }
  }, [registrosEstudo, allRegistrosEstudo, goalsHistory, unifyStreaks]);

  return (
    <div className="space-y-4 md:space-y-6 animate-slide-up pb-8 relative">

      {/* --- OVERLAY GLOBAL: Fecha o menu se clicar fora do card --- */}
      {showPrefMenu && (
        <div
          className="fixed inset-0 z-40 bg-transparent cursor-default"
          onClick={(e) => {
            e.stopPropagation();
            setShowPrefMenu(false);
          }}
        />
      )}

      {/* Grid Principal: Removido z-30 para não prender o contexto */}
      <div id="home-stats-grid" className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 pt-0 relative">
        <StatCard icon={Clock} title="Tempo de Estudo" value={formatDecimalHours(homeStats.totalTimeMinutes)} />
        <StatCard icon={Target} title="Questões Feitas" value={homeStats.performance.total} />
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
        <ActiveCycleCard activeCicloData={activeCicloData} onClick={() => setActiveTab('ciclos')} />

        {/* --- CARD DA SEQUÊNCIA DE ESTUDOS --- */}
        {/* Quando o menu está aberto, este card ganha z-50 para ficar acima do overlay Global */}
        <div className={`dashboard-card p-3 md:p-6 col-span-2 lg:col-span-4 flex flex-col lg:flex-row items-stretch justify-between gap-4 md:gap-8 relative overflow-visible border-l-4 border-orange-500 group/card ${showPrefMenu ? 'z-50' : 'z-20'}`}>

            {/* Background Glow */}
            <div className="absolute top-0 left-0 w-1/2 h-full bg-gradient-to-r from-orange-500/5 to-transparent pointer-events-none rounded-l-xl"></div>

            {/* --- OVERLAY INTERNO: Bloqueia interação com o fundo do card --- */}
            {/* Este overlay é z-40. Ele cobria o conteúdo antes. */}
            {showPrefMenu && (
              <div
                className="absolute inset-0 z-40 bg-transparent cursor-default rounded-xl"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowPrefMenu(false);
                }}
              />
            )}

            {/* CORREÇÃO CRÍTICA AQUI:
                Mudei de z-20 para z-50.
                Como o Overlay Interno é z-40, o conteúdo (z-50) agora fica ACIMA dele.
                Isso permite que o mouse "veja" os botões para o efeito hover.
            */}
            <div className="flex items-center gap-3 md:gap-6 w-full lg:w-auto relative my-auto pl-2 pointer-events-none z-50">
              <div className={`p-3 md:p-4 rounded-2xl shadow-lg shadow-orange-500/30 transition-all duration-500 bg-gradient-to-tr from-orange-600 via-orange-500 to-amber-400 text-white transform group-hover/card:scale-105 pointer-events-auto`}>
                <Flame size={28} className={`md:w-9 md:h-9 ${homeStats.streak > 0 ? "animate-pulse fill-white/20" : ""}`} strokeWidth={2} />
              </div>

              <div className="flex-1 pointer-events-auto">
                <div className="flex items-center gap-3 mb-0.5">
                   <h3 className="text-[11px] md:text-xs font-black uppercase tracking-[0.2em] bg-gradient-to-r from-orange-600 to-amber-600 dark:from-orange-400 dark:to-amber-400 bg-clip-text text-transparent drop-shadow-sm">
                      Sequência de Fogo
                   </h3>

                   <div className="relative z-50">
                      <button
                        onClick={(e) => {
                           e.stopPropagation();
                           setShowPrefMenu(!showPrefMenu);
                        }}
                        className="p-1 hover:bg-orange-50 dark:hover:bg-orange-900/20 rounded-md text-orange-400 hover:text-orange-600 transition-colors cursor-pointer"
                        title="Configurar Sequência"
                      >
                        <Settings size={14} />
                      </button>

                      <AnimatePresence>
                        {showPrefMenu && (
                            <motion.div
                              initial={{ opacity: 0, scale: 0.95, y: -5 }}
                              animate={{ opacity: 1, scale: 1, y: 0 }}
                              exit={{ opacity: 0, scale: 0.95, y: -5 }}
                              className="absolute left-0 top-full mt-2 w-56 bg-white dark:bg-zinc-900 border border-orange-100 dark:border-orange-900/30 rounded-xl shadow-xl z-[60] p-1.5 overflow-visible ring-1 ring-black/5 cursor-auto pointer-events-auto"
                              onClick={(e) => e.stopPropagation()}
                            >
                                <div className="px-3 py-2 border-b border-zinc-100 dark:border-zinc-800 mb-1 text-left">
                                  <span className="text-[9px] font-black text-orange-500 uppercase tracking-widest">Fonte de Dados</span>
                                </div>

                                <button
                                    type="button"
                                    onClick={(e) => handlePreferenceClick(e, false)}
                                    // Cores reforçadas para garantir visualização
                                    className={`w-full flex items-center justify-between px-3 py-2.5 text-[10px] font-bold uppercase tracking-tight rounded-lg transition-colors duration-150 mb-1 cursor-pointer
                                    ${!unifyStreaks
                                        ? 'bg-orange-500 text-white shadow-md shadow-orange-500/20 hover:bg-orange-600'
                                        : 'text-zinc-600 dark:text-zinc-400 hover:bg-orange-100 dark:hover:bg-zinc-800 hover:text-orange-600'
                                    }`}
                                >
                                  <span>Apenas o Ciclo Atual</span>
                                  {!unifyStreaks && <Check size={12} strokeWidth={4}/>}
                                </button>

                                <button
                                    type="button"
                                    onClick={(e) => handlePreferenceClick(e, true)}
                                    className={`w-full flex items-center justify-between px-3 py-2.5 text-[10px] font-bold uppercase tracking-tight rounded-lg transition-colors duration-150 cursor-pointer
                                    ${unifyStreaks
                                        ? 'bg-orange-500 text-white shadow-md shadow-orange-500/20 hover:bg-orange-600'
                                        : 'text-zinc-600 dark:text-zinc-400 hover:bg-orange-100 dark:hover:bg-zinc-800 hover:text-orange-600'
                                    }`}
                                >
                                  <span>Histórico Completo</span>
                                  {unifyStreaks && <Check size={12} strokeWidth={4}/>}
                                </button>
                            </motion.div>
                        )}
                      </AnimatePresence>
                   </div>
                </div>

                <div className="flex items-baseline gap-1.5 md:gap-2">
                   <p className="text-4xl md:text-5xl font-black text-orange-600 dark:text-orange-500 tracking-tighter leading-none drop-shadow-sm">{homeStats.streak}</p>
                   <span className="text-sm md:text-base font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wide">dias seguidos</span>
                </div>
              </div>
            </div>

            <div className={`flex flex-col w-full lg:flex-1 lg:ml-12 relative justify-between z-10`}>
              <div className="flex justify-end w-full mb-1 md:mb-2">
                <span className="text-[9px] md:text-[10px] font-bold uppercase tracking-widest text-zinc-400 dark:text-zinc-500 flex items-center gap-1.5 bg-zinc-50 dark:bg-zinc-800/50 px-2 py-1 rounded-md border border-zinc-100 dark:border-zinc-800">
                  <Calendar size={10} className="md:w-3 md:h-3" /> Últimos 14 dias
                </span>
              </div>

              <div className="flex items-end gap-1 md:gap-2 w-full">
                {homeStats.last14Days.map((day) => {
                  const [year, month, dayNum] = day.date.split('-');
                  const dateDisplay = `${dayNum}/${month}`;
                  const isToday = day.date === dateToYMD_local(new Date());

                  return (
                    <div key={day.date} className="relative group/day flex-1 flex flex-col items-center gap-1">

                      {!showPrefMenu && (
                        <div className="absolute bottom-[calc(100%+24px)] left-1/2 -translate-x-1/2 mb-1 w-max p-2 bg-zinc-900/95 dark:bg-zinc-800/95 backdrop-blur-sm text-white text-[10px] md:text-xs rounded-lg shadow-xl opacity-0 group-hover/day:opacity-100 transition-all duration-200 pointer-events-none z-50 transform translate-y-2 group-hover/day:translate-y-0 border border-zinc-700/50">
                            <div className="font-bold text-center border-b border-white/10 pb-1 mb-1 text-zinc-300">{day.date.split('-').reverse().slice(0, 2).join('/')}</div>
                            <div className="flex flex-col gap-0.5 text-left">
                                <div className="flex items-center gap-2"><Clock size={10} className="text-red-400"/><span className="font-mono">{formatDecimalHours(day.minutes)}</span></div>
                                <div className="flex items-center gap-2"><Target size={10} className="text-blue-400"/><span className="font-mono">{day.questions} Questões</span></div>
                            </div>
                            <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-zinc-900/95 dark:border-t-zinc-800/95"></div>
                        </div>
                      )}

                      <div className="w-full h-12 md:h-16 flex items-end">
                        <div
                          role="button"
                          onClick={() => { if(day.hasData) handleDayClick(day.date); }}
                          className={`w-full rounded-sm md:rounded-md transition-all duration-300 ease-out cursor-pointer border border-white/5 dark:border-white/5
                            ${day.status === 'goal-met-both' ? 'bg-emerald-500 h-full shadow-[0_0_15px_rgba(16,185,129,0.25)]' : ''}
                            ${day.status === 'goal-met-one' ? 'bg-amber-500 h-[75%] shadow-[0_0_15px_rgba(245,158,11,0.25)]' : ''}
                            ${day.status === 'goal-not-met' ? 'bg-red-500 h-[40%] shadow-[0_0_15px_rgba(239,68,68,0.25)]' : ''}
                            ${day.status === 'no-data' ? 'bg-zinc-200 dark:bg-zinc-800/50 h-[15%]' : ''}
                            ${isToday ? 'ring-1 md:ring-2 ring-orange-500' : ''}
                            ${day.hasData ? 'active:scale-95' : 'cursor-default opacity-60'}`}
                        ></div>
                      </div>

                      <span className={`text-[8px] md:text-[9px] font-bold tracking-tight leading-none mt-0.5 ${isToday ? 'text-orange-500' : 'text-zinc-300 dark:text-zinc-600'}`}>
                        {dateDisplay}
                      </span>
                    </div>
                  );
                })}
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