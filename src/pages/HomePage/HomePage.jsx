import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../../firebaseConfig';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import DayDetailsModal from '../../components/dashboard/DayDetailsModal.jsx';
import HomeSessao1 from './HomeSessao1.jsx';
import HomeSessao2 from './HomeSessao2.jsx';
import { useForceUnlock } from '../../hooks/useForceUnlock';

// ============================================================================
// HELPERS LOCAIS NECESSÁRIOS PARA CÁLCULO DE ESTATÍSTICAS
// ============================================================================
const dateToYMD_local = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// ============================================================================
// COMPONENTE PRINCIPAL HOME PAGE
// ============================================================================
function HomePage({ registrosEstudo, allRegistrosEstudo = [], goalsHistory, setActiveTab, activeCicloData, user }) {
    useForceUnlock();
  const [selectedDate, setSelectedDate] = useState(null);

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

  const handleDayClick = (date) => {
    const source = unifyStreaks ? allRegistrosEstudo : registrosEstudo;
    const dayRegistros = source.filter(r => r.data === date);
    setSelectedDate({
      date,
      dayQuestions: dayRegistros.filter(r => (r.questoesFeitas || 0) > 0),
      dayHours: dayRegistros.filter(r => (r.tempoEstudadoMinutos || 0) > 0)
    });
  };

  const getGoalsForDate = (dateStr) => {
    if (!goalsHistory || goalsHistory.length === 0) return { questions: 0, hours: 0 };
    const sortedGoals = [...goalsHistory].sort((a, b) => new Date(b.startDate) - new Date(a.startDate));
    return sortedGoals.find(g => g.startDate <= dateStr) || { questions: 0, hours: 0 };
  };

  // Cálculo da Tabela de Ranking (Passado para Sessao2)
  const tableData = useMemo(() => {
    const map = {};
    (registrosEstudo || []).forEach(reg => {
      const disc = reg.disciplinaNome || 'Geral';
      const assunto = reg.assuntoNome || reg.assunto || 'Geral';
      const key = `${disc}||${assunto}`;
      if (!map[key]) map[key] = { disciplina: disc, assunto, q: 0, c: 0 };
      map[key].q += Number(reg.questoesFeitas) || 0;
      map[key].c += Number(reg.acertos) || 0;
    });
    return Object.values(map).filter(t => t.q > 0);
  }, [registrosEstudo]);

  // Cálculo das Estatísticas Gerais (Passado para Sessao1)
  const homeStats = useMemo(() => {
    try {
      const studyDaysFull = {};
      let totalQuestions = 0, totalCorrect = 0, totalTimeMinutes = 0;

      // Totais vêm apenas do ciclo atual para os cards superiores
      registrosEstudo.forEach(item => {
        totalQuestions += (item.questoesFeitas || 0);
        totalCorrect += (item.acertos || 0);
        totalTimeMinutes += (item.tempoEstudadoMinutos || 0);
      });

      // Dados do Streak dependem da preferência de unificação
      const streakSource = unifyStreaks ? allRegistrosEstudo : registrosEstudo;
      streakSource.forEach(item => {
        if (!item.data) return;
        studyDaysFull[item.data] = studyDaysFull[item.data] || { questions: 0, minutes: 0 };
        studyDaysFull[item.data].questions += (item.questoesFeitas || 0);
        studyDaysFull[item.data].minutes += (item.tempoEstudadoMinutos || 0);
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

      // Últimos 12 dias para o gráfico visual de sequência
      const last12Days = Array.from({ length: 12 }).map((_, i) => {
        const date = new Date();
        date.setDate(new Date().getDate() - (11 - i));
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

      let multiplier = 1.0;
      if (currentStreak >= 30) multiplier = 2.0;
      else if (currentStreak >= 14) multiplier = 1.5;
      else if (currentStreak >= 7) multiplier = 1.25;

      return {
        streak: currentStreak, multiplier: multiplier.toFixed(2), last12Days,
        performance: { total: totalQuestions, correct: totalCorrect, wrong: totalQuestions - totalCorrect, percentage: totalQuestions > 0 ? (totalCorrect / totalQuestions) * 100 : 0 },
        totalTimeMinutes
      };
    } catch (error) {
      console.error("Erro calculando stats:", error);
      return { streak: 0, multiplier: "1.00", last12Days: [], performance: { correct: 0, wrong: 0, percentage: 0, total: 0 }, totalTimeMinutes: 0 };
    }
  }, [registrosEstudo, allRegistrosEstudo, goalsHistory, unifyStreaks]);

  return (
    <div className="space-y-4 md:space-y-6 animate-slide-up pb-8 relative">
      {/* Sessão 1: Cards Superiores, Streak e Gráfico Semanal */}
      <HomeSessao1
        homeStats={homeStats}
        activeCicloData={activeCicloData}
        setActiveTab={setActiveTab}
        registrosEstudo={registrosEstudo}
        allRegistrosEstudo={allRegistrosEstudo}
        unifyStreaks={unifyStreaks}
        updateUnifyPreference={updateUnifyPreference}
        handleDayClick={handleDayClick}
      />

      {/* Sessão 2: Estudo de Hoje e Ranking */}
      <HomeSessao2
        registrosEstudo={registrosEstudo}
        tableData={tableData}
      />

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

export default HomePage;