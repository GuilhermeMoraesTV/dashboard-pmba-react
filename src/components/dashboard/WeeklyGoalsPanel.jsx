import React, { useMemo } from 'react';

// --- Funções Helper (Sem alteração) ---
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
// --- FIM DOS HELPERS ---


function WeeklyGoalsPanel({ registrosEstudo, goalsHistory, setActiveTab }) {

    const activeGoal = useMemo(() => {
        if (!goalsHistory || goalsHistory.length === 0) {
            return { questions: 0, hours: 0 };
        }
        return [...goalsHistory].sort((a, b) => new Date(b.startDate) - new Date(a.startDate))[0];
    }, [goalsHistory]);

    // --- useMemo CORRIGIDO ---
    const weeklyProgress = useMemo(() => {
        const startOfWeekStr = getStartOfWeek();

        const weeklyRegistros = registrosEstudo.filter(item => {
            const itemDateStr = dateToYMD_local(item.data.toDate());
            return itemDateStr >= startOfWeekStr;
        });

        let totalQuestions = 0;
        let totalMinutes = 0;

        weeklyRegistros.forEach(item => {
            // CORREÇÃO: Soma se houver questões
            if (item.questoesFeitas > 0) {
                totalQuestions += item.questoesFeitas;
            }
            // CORREÇÃO: Soma se houver tempo
            if (item.duracaoMinutos > 0) {
                totalMinutes += item.duracaoMinutos;
            }
        });

        const totalHours = totalMinutes / 60;

        const questionsPercent = activeGoal.questions > 0
            ? Math.min((totalQuestions / activeGoal.questions) * 100, 100)
            : 0;

        const hoursPercent = activeGoal.hours > 0
            ? Math.min((totalHours / activeGoal.hours) * 100, 100)
            : 0;

        return {
            currentQuestions: totalQuestions,
            goalQuestions: activeGoal.questions,
            questionsPercent: questionsPercent,

            currentHours: totalHours,
            goalHours: activeGoal.hours,
            hoursPercent: hoursPercent
        };

    }, [registrosEstudo, activeGoal]);
    // --- FIM DA CORREÇÃO ---

    const formatHours = (d) => {
        if (!d || d < 0) return '0.0';
        return d.toFixed(1);
    };

    return (
        <div className="bg-card-background-color dark:bg-dark-card-background-color rounded-xl shadow-card-shadow p-4 md:p-6 col-span-1 md:col-span-1 lg:col-span-2">
            <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold text-heading-color dark:text-dark-heading-color">
                    Metas Semanais
                </h3>
                <button
                    onClick={() => setActiveTab('goals')}
                    className="text-sm font-semibold text-primary-color hover:brightness-125"
                >
                    Definir Metas
                </button>
            </div>

            <div className="space-y-4">
                {/* Meta de Horas */}
                <div>
                    <div className="flex justify-between text-sm font-medium mb-1">
                        <span className="text-subtle-text-color dark:text-dark-subtle-text-color">Horas de Estudo</span>
                        <span className="text-heading-color dark:text-dark-heading-color">
                            {formatHours(weeklyProgress.currentHours)} / {formatHours(weeklyProgress.goalHours)}h
                        </span>
                    </div>
                    <div className="w-full bg-border-color dark:bg-dark-border-color rounded-full h-2.5">
                        <div
                            className="bg-primary-color h-2.5 rounded-full transition-all duration-500"
                            style={{ width: `${weeklyProgress.hoursPercent}%` }}
                        ></div>
                    </div>
                </div>

                {/* Meta de Questões */}
                <div>
                    <div className="flex justify-between text-sm font-medium mb-1">
                        <span className="text-subtle-text-color dark:text-dark-subtle-text-color">Questões Resolvidas</span>
                        <span className="text-heading-color dark:text-dark-heading-color">
                            {weeklyProgress.currentQuestions} / {weeklyProgress.goalQuestions}
                        </span>
                    </div>
                    <div className="w-full bg-border-color dark:bg-dark-border-color rounded-full h-2.5">
                        <div
                            className="bg-success-color h-2.5 rounded-full transition-all duration-500"
                            style={{ width: `${weeklyProgress.questionsPercent}%` }}
                        ></div>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default WeeklyGoalsPanel;