import React, { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { db } from '../../firebaseConfig';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import DayDetailsModal from '../../components/dashboard/DayDetailsModal.jsx';
import HomeSessao1, { WeeklyBarChart } from './HomeSessao1.jsx';
import HomeSessao2 from './HomeSessao2.jsx';
import HojeCard from './HojeCard.jsx';
import HomeInsightsCards from './HomeInsightsCards.jsx';
import { useForceUnlock } from '../../hooks/useForceUnlock';
import { getAgendaSemana } from '../../services/scheduling/review';
import {
  buildStudyDaysMap,
  calculateCurrentStudyStreak,
  dateToYMDLocal,
  getCronogramaStudyDays,
  getCycleStudyDays,
  getDailyStudyStatus,
} from '../../utils/studyDayStatus';

const homeParticles = Array.from({ length: 150 }, (_, index) => ({
  id: index,
  left: `${2 + ((index * 17) % 96)}%`,
  top: `${2 + ((index * 31) % 96)}%`,
  size: 2 + (index % 5),
  delay: index * 0.08,
  duration: 5.4 + (index % 7) * 0.42,
  opacity: 0.16 + (index % 6) * 0.045,
}));

const HomeRedParticles = () => (
  <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
    <div className="absolute inset-0 bg-[radial-gradient(circle_at_15%_12%,rgba(239,68,68,0.13),transparent_26%),radial-gradient(circle_at_86%_18%,rgba(220,38,38,0.10),transparent_30%),radial-gradient(circle_at_52%_88%,rgba(153,27,27,0.11),transparent_34%),linear-gradient(135deg,rgba(239,68,68,0.055),transparent_38%,rgba(127,29,29,0.06))]" />
    <div className="absolute inset-0 bg-[radial-gradient(circle_at_1px_1px,rgba(239,68,68,0.14)_1px,transparent_0)] bg-[length:34px_34px] opacity-30 dark:opacity-40" />
    <motion.div
      className="absolute -left-1/4 top-[8%] h-64 w-[150%] bg-gradient-to-r from-transparent via-red-500/10 to-transparent blur-2xl"
      animate={{ x: ['-8%', '8%', '-8%'], opacity: [0.18, 0.34, 0.18] }}
      transition={{ duration: 12, repeat: Infinity, ease: 'easeInOut' }}
    />
    <motion.div
      className="absolute left-[10%] top-[20%] h-[420px] w-[420px] rounded-full bg-red-500/10 blur-[120px]"
      animate={{ scale: [1, 1.16, 1], opacity: [0.16, 0.28, 0.16] }}
      transition={{ duration: 9, repeat: Infinity, ease: 'easeInOut' }}
    />
    <motion.div
      className="absolute bottom-[-12%] right-[4%] h-[520px] w-[520px] rounded-full bg-red-700/10 blur-[140px]"
      animate={{ scale: [1.08, 0.94, 1.08], opacity: [0.12, 0.26, 0.12] }}
      transition={{ duration: 10, repeat: Infinity, ease: 'easeInOut' }}
    />
    {homeParticles.map((particle) => (
      <motion.span
        key={particle.id}
        className="absolute rounded-full bg-red-500 shadow-[0_0_14px_rgba(239,68,68,0.55)]"
        style={{
          left: particle.left,
          top: particle.top,
          width: particle.size,
          height: particle.size,
          opacity: particle.opacity,
        }}
        animate={{
          y: [0, particle.id % 3 === 0 ? -28 : -18, 0],
          x: [0, particle.id % 2 === 0 ? 12 : -12, 0],
          opacity: [0, particle.opacity, 0],
          scale: [0.65, particle.id % 4 === 0 ? 1.45 : 1.12, 0.65],
        }}
        transition={{
          duration: particle.duration,
          delay: particle.delay,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
      />
    ))}
    {Array.from({ length: 11 }, (_, index) => (
      <motion.span
        key={`line-${index}`}
        className="absolute h-px w-32 bg-gradient-to-r from-transparent via-red-500/30 to-transparent"
        style={{
          left: `${-4 + index * 11}%`,
          top: `${10 + ((index * 19) % 82)}%`,
          rotate: `${-22 + index * 6}deg`,
        }}
        animate={{ x: [0, 42, 0], opacity: [0.06, 0.24, 0.06] }}
        transition={{ duration: 7 + index * 0.35, repeat: Infinity, ease: 'easeInOut' }}
      />
    ))}
  </div>
);

// ============================================================================
// COMPONENTE PRINCIPAL HOME PAGE
// ============================================================================
function HomePage({
  registrosEstudo,
  allRegistrosEstudo = [],
  goalsHistory,
  setActiveTab,
  activeCicloData,
  activeCronogramaData,
  onGoToCronograma,
  onGoToRevisao,
  onStartStudy,
  addRegistroEstudo,
  deleteCompletionRegistro,
  user,
}) {
  useForceUnlock();
  const [selectedDate, setSelectedDate] = useState(null);
  const [homeContextPreferred, setHomeContextPreferred] = useState(() => {
    try { return localStorage.getItem('homeContextPreferred') || 'cronograma'; } catch { return 'cronograma'; }
  });

  const [unifyStreaks, setUnifyStreaks] = useState(() => {
    const saved = localStorage.getItem('unifyStreaks');
    return saved !== null ? JSON.parse(saved) : false;
  });

  useEffect(() => {
    if (!user) return;
    const loadPrefs = async () => {
      const prefDoc = await getDoc(doc(db, 'users', user.uid, 'settings', 'preferences'));
      if (prefDoc.exists()) {
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
    if (user) await setDoc(doc(db, 'users', user.uid, 'settings', 'preferences'), { unifyStreaks: value }, { merge: true });
  };

  const effectiveHomeContext = useMemo(() => {
    const hasCiclo = !!activeCicloData?.id;
    const hasCronograma = !!activeCronogramaData?.id;
    if (hasCiclo && hasCronograma) return homeContextPreferred === 'ciclo' ? 'ciclo' : 'cronograma';
    if (hasCiclo) return 'ciclo';
    if (hasCronograma) return 'cronograma';
    return 'all';
  }, [activeCicloData?.id, activeCronogramaData?.id, homeContextPreferred]);

  const contextRegistrosEstudo = useMemo(() => {
    const source = allRegistrosEstudo?.length ? allRegistrosEstudo : registrosEstudo;
    if (effectiveHomeContext === 'ciclo' && activeCicloData?.id) {
      return source.filter(r => r.cicloId === activeCicloData.id && !r.cronogramaId);
    }
    if (effectiveHomeContext === 'cronograma' && activeCronogramaData?.id) {
      return source.filter(r => r.cronogramaId === activeCronogramaData.id);
    }
    return source;
  }, [allRegistrosEstudo, registrosEstudo, effectiveHomeContext, activeCicloData?.id, activeCronogramaData?.id]);

  const globalRegistrosEstudo = useMemo(
    () => allRegistrosEstudo?.length ? allRegistrosEstudo : registrosEstudo,
    [allRegistrosEstudo, registrosEstudo]
  );

  const updateHomeContextPreferred = (value) => {
    setHomeContextPreferred(value);
    try {
      localStorage.setItem('homeContextPreferred', value);
      window.dispatchEvent(new CustomEvent('home-context-preferred-change', { detail: value }));
    } catch {}
  };

  const handleDayClick = (date) => {
    const source = globalRegistrosEstudo;
    const dayRegistros = source.filter(r => r.data === date);
    const dayStatus = getDailyStudyStatus({
      date,
      studyDaysMap: buildStudyDaysMap(globalRegistrosEstudo),
      activeCronogramaData,
      activeCicloData,
      getAgendaSemana,
      contextMode: effectiveHomeContext,
    });
    setSelectedDate({
      date,
      dayQuestions: dayRegistros.filter(r => (r.questoesFeitas || 0) > 0),
      dayHours:     dayRegistros.filter(r => (r.tempoEstudadoMinutos || 0) > 0),
      isRestDay: Boolean(dayStatus?.isRestDay),
    });
  };

  const getGoalsForDate = (dateStr) => {
    if (!goalsHistory || goalsHistory.length === 0) return { questions: 0, hours: 0 };
    const sortedGoals = [...goalsHistory].sort((a, b) => new Date(b.startDate) - new Date(a.startDate));
    return sortedGoals.find(g => g.startDate <= dateStr) || { questions: 0, hours: 0 };
  };

  // ── Mantém o rótulo do card alinhado ao contexto visível, sem afetar a sequência global ──
  const diasEstudo = useMemo(() => {
    if (effectiveHomeContext === 'cronograma') {
      const diasCronograma = getCronogramaStudyDays(activeCronogramaData);
      return diasCronograma.length > 0 ? new Set(diasCronograma) : null;
    }

    if (effectiveHomeContext === 'ciclo') {
      const diasCiclo = getCycleStudyDays(activeCicloData);
      return diasCiclo.length > 0 ? new Set(diasCiclo) : null;
    }

    return null;
  }, [activeCronogramaData, activeCicloData, effectiveHomeContext]);

  // ── Tabela de Ranking (mantida para uso na página de Desempenho via HomeSessao2) ──
  const tableData = useMemo(() => {
    const map = {};
    (contextRegistrosEstudo || []).forEach(reg => {
      const disc    = reg.disciplinaNome || 'Geral';
      const assunto = reg.assuntoNome || reg.assunto || 'Geral';
      const key     = `${disc}||${assunto}`;
      if (!map[key]) map[key] = { disciplina: disc, assunto, q: 0, c: 0 };
      map[key].q += Number(reg.questoesFeitas) || 0;
      map[key].c += Number(reg.acertos) || 0;
    });
    return Object.values(map).filter(t => t.q > 0);
  }, [contextRegistrosEstudo]);

  // ── Estatísticas Gerais + Streak Inteligente ──────────────────────────────
  const homeStats = useMemo(() => {
    try {
      const studyDaysFull = {};
      let totalQuestions = 0, totalCorrect = 0, totalTimeMinutes = 0;

      contextRegistrosEstudo.forEach(item => {
        totalQuestions   += (item.questoesFeitas || 0);
        totalCorrect     += (item.acertos || 0);
        totalTimeMinutes += (item.tempoEstudadoMinutos || 0);
      });

      Object.assign(studyDaysFull, buildStudyDaysMap(globalRegistrosEstudo));

      const today         = new Date();
      const currentStreak = calculateCurrentStudyStreak({
        studyDaysMap: studyDaysFull,
        goalsHistory,
        activeCronogramaData,
        activeCicloData,
        getAgendaSemana,
        contextMode: effectiveHomeContext,
        today,
      });

      // ── Últimos 12 dias ─────────────────────────────────────────────────
      const last12Days = Array.from({ length: 12 }).map((_, i) => {
        const date    = new Date();
        date.setDate(new Date().getDate() - (11 - i));
        const dateStr  = dateToYMDLocal(date);
        const dayData  = studyDaysFull[dateStr];
        const dayStatus = getDailyStudyStatus({
          date,
          studyDaysMap: studyDaysFull,
          activeCronogramaData,
          activeCicloData,
          getAgendaSemana,
          contextMode: effectiveHomeContext,
        });
        return {
          date: dateStr,
          status: dayStatus.status,
          hasData: dayStatus.hasData,
          minutes: dayData?.minutes || 0,
          questions: dayData?.questions || 0,
          isRestDay: dayStatus.isRestDay,
          completedSlots: dayStatus.completedSlots,
          totalSlots: dayStatus.totalSlots,
        };
      });

      let multiplier = 1.0;
      if (currentStreak >= 30) multiplier = 2.0;
      else if (currentStreak >= 14) multiplier = 1.5;
      else if (currentStreak >= 7)  multiplier = 1.25;

      return {
        streak: currentStreak,
        multiplier: multiplier.toFixed(2),
        last12Days,
        performance: {
          total:      totalQuestions,
          correct:    totalCorrect,
          wrong:      totalQuestions - totalCorrect,
          percentage: totalQuestions > 0 ? (totalCorrect / totalQuestions) * 100 : 0,
        },
        totalTimeMinutes,
      };
    } catch (error) {
      console.error('Erro calculando stats:', error);
      return {
        streak: 0, multiplier: '1.00', last12Days: [],
        performance: { correct: 0, wrong: 0, percentage: 0, total: 0 },
        totalTimeMinutes: 0,
      };
    }
  }, [contextRegistrosEstudo, globalRegistrosEstudo, goalsHistory, activeCronogramaData, activeCicloData, effectiveHomeContext]);

  return (
    <div className="animate-slide-up pb-8 relative w-full max-w-7xl mx-auto">
      <HomeRedParticles />

      {/* ① STAT CARDS — 4 cards compactos no topo */}
      {/* ② STREAK + GRÁFICO SEMANAL — logo abaixo dos stats */}
      {/* Ambos gerenciados por HomeSessao1 */}
      <div className="relative z-10 space-y-4 md:space-y-5">
        <div className="grid grid-cols-1 gap-4 md:gap-5 items-stretch xl:grid-cols-[minmax(250px,0.75fr)_minmax(300px,1fr)_minmax(300px,1fr)] xl:grid-rows-[184px_360px_178px]">
          <HomeSessao1
            variant="stats"
            compact
            homeStats={homeStats}
            activeCicloData={activeCicloData}
            activeCronogramaData={activeCronogramaData}
            preferredContext={effectiveHomeContext}
            onPreferredContextChange={updateHomeContextPreferred}
            setActiveTab={setActiveTab}
            onGoToCronograma={onGoToCronograma}
          />

          <HomeSessao1
            variant="streak"
            compact
            daysLimit={10}
            homeStats={homeStats}
            handleDayClick={handleDayClick}
            diasEstudo={diasEstudo}
          />

          <HomeSessao2
            registrosEstudo={globalRegistrosEstudo}
            tableData={tableData}
            compact
            className="xl:col-start-1 xl:row-start-2 xl:row-span-2 xl:h-full"
          />

          <div className="xl:col-start-2 xl:row-start-2 xl:h-full">
            <WeeklyBarChart registrosEstudo={globalRegistrosEstudo} compact />
          </div>

          <HojeCard
            className="xl:col-start-3 xl:row-start-1 xl:row-span-2 xl:h-full xl:!min-h-0 xl:!p-4"
            activeCicloData={activeCicloData}
            activeCronogramaData={activeCronogramaData}
            cronogramaId={activeCronogramaData?.id}
            user={user}
            setActiveTab={setActiveTab}
            onGoToStudySession={onStartStudy}
            onGoToCiclo={() => setActiveTab('ciclos')}
            onGoToCronograma={onGoToCronograma}
            onGoToRevisao={onGoToRevisao}
            addRegistroEstudo={addRegistroEstudo}
            deleteCompletionRegistro={deleteCompletionRegistro}
            preferredContext={homeContextPreferred}
            onPreferredContextChange={updateHomeContextPreferred}
          />

          <HomeInsightsCards
            className="contents"
            weakPointClassName="xl:col-start-2 xl:row-start-3 xl:h-full"
            loadClassName="xl:col-start-3 xl:row-start-3 xl:h-full"
            registrosEstudo={contextRegistrosEstudo}
            onStartStudy={(disciplina, assunto) => onStartStudy?.(
              disciplina,
              assunto,
              { defaultContext: effectiveHomeContext === 'ciclo' ? 'ciclo' : 'cronograma' },
            )}
          />
        </div>
      </div>

      {/* ③ GUIA DE ESTUDO DO DIA — protagonismo logo após os stats */}
      {/* ④ GRÁFICO DE ESTUDO DE HOJE — apenas TodayChart, sem ranking */}
      {selectedDate && (
        <DayDetailsModal
          date={selectedDate.date}
          dayData={{ dayQuestions: selectedDate.dayQuestions, dayHours: selectedDate.dayHours }}
          goals={getGoalsForDate(selectedDate.date)}
          isRestDay={Boolean(selectedDate.isRestDay)}
          onClose={() => setSelectedDate(null)}
        />
      )}
    </div>
  );
}

export default HomePage;
