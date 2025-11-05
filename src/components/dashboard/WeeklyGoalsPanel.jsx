import React, { useMemo } from 'react';

const dateToYMD_local = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

const getStartOfWeek = () => {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const dayOfWeek = today.getDay();
  const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;

  const startOfWeek = new Date(today);
  startOfWeek.setDate(today.getDate() + diffToMonday);
  return dateToYMD_local(startOfWeek);
};

function WeeklyGoalsPanel({ registrosEstudo, goalsHistory, setActiveTab }) {

    const activeGoal = useMemo(() => {
        if (!goalsHistory || goalsHistory.length === 0) {
            return { questions: 0, hours: 0 };
        }
        return [...goalsHistory].sort((a, b) => new Date(b.startDate) - new Date(a.startDate))[0];
    }, [goalsHistory]);

    const weeklyProgress = useMemo(() => {
      const startOfWeekStr = getStartOfWeek();

      const weeklyRegistros = registrosEstudo.filter(item => {
        const itemDateStr = item.data;
        if (!itemDateStr || typeof itemDateStr !== 'string' || itemDateStr.split('-').length !== 3) {
          return false;
        }
        return itemDateStr >= startOfWeekStr;
      });

      let totalQuestions = 0;
      let totalMinutes = 0;

      weeklyRegistros.forEach(item => {
        const questoes = item.questoesFeitas || 0;
        const minutos = item.tempoEstudadoMinutos || item.duracaoMinutos || 0;

        if (questoes > 0) {
          totalQuestions += questoes;
        }
        if (minutos > 0) {
          totalMinutes += minutos;
        }
      });

      const totalHours = totalMinutes / 60;
      const goalQuestionsNum = parseInt(activeGoal.questions) || 0;
      const goalHoursNum = parseFloat(activeGoal.hours) || 0;

      const questionsPercent = goalQuestionsNum > 0
        ? Math.min((totalQuestions / goalQuestionsNum) * 100, 100)
        : 0;

      const hoursPercent = goalHoursNum > 0
        ? Math.min((totalHours / goalHoursNum) * 100, 100)
        : 0;

      return {
        currentQuestions: totalQuestions,
        goalQuestions: goalQuestionsNum,
        questionsPercent: questionsPercent,
        currentHours: totalHours,
        goalHours: goalHoursNum,
        hoursPercent: hoursPercent
      };
    }, [registrosEstudo, activeGoal]);

    const formatHours = (d) => {
        if (!d || d < 0) return '0.0';
        return d.toFixed(1);
    };

    return (
        <div className="bg-zinc-200 dark:bg-zinc-800 rounded-xl shadow-sm hover:shadow-md p-4 col-span-1 md:col-span-1 lg:col-span-2 border border-zinc-300 dark:border-zinc-700 transition-all duration-300">
            <div className="flex justify-between items-center mb-3">
                <h3 className="text-base font-semibold text-zinc-800 dark:text-white">
                    Metas Semanais
                </h3>
                <button
                    onClick={() => setActiveTab('goals')}
                    className="text-xs font-semibold text-neutral-500 hover:text-neutral-600 dark:hover:text-neutral-400 transition-all"
                >
                    Definir Metas
                </button>
            </div>

            <div className="space-y-3">
                <div>
                    <div className="flex justify-between text-xs font-medium mb-1">
                        <span className="text-zinc-600 dark:text-zinc-400">Horas de Estudo</span>
                        <span className="text-zinc-800 dark:text-white">
                            {formatHours(weeklyProgress.currentHours)} / {formatHours(weeklyProgress.goalHours)}h
                        </span>
                    </div>
                    <div className="w-full bg-zinc-300 dark:bg-zinc-700 rounded-full h-2">
                        <div
                            className="bg-neutral-500 h-2 rounded-full transition-all duration-500"
                            style={{ width: `${weeklyProgress.hoursPercent}%` }}
                        ></div>
                    </div>
                </div>

                <div>
                    <div className="flex justify-between text-xs font-medium mb-1">
                        <span className="text-zinc-600 dark:text-zinc-400">Questões Resolvidas</span>
                        <span className="text-zinc-800 dark:text-white">
                            {weeklyProgress.currentQuestions} / {weeklyProgress.goalQuestions}
                        </span>
                    </div>
                    <div className="w-full bg-zinc-300 dark:bg-zinc-700 rounded-full h-2">
                        <div
                            className="bg-green-500 h-2 rounded-full transition-all duration-500"
                            style={{ width: `${weeklyProgress.questionsPercent}%` }}
                        ></div>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default WeeklyGoalsPanel;