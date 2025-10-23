import React, { useMemo } from 'react';

const formatDecimalHours = (d) => {
    // Formato de horas e minutos (ex: 05h 30m)
    if (!d || d < 0) return '00h 00m';
    const totalMinutes = Math.round(d * 60);
    const h = Math.floor(totalMinutes / 60);
    const m = totalMinutes % 60;
    return `${String(h).padStart(2, '0')}h ${String(m).padStart(2, '0')}m`;
};

const WeeklyGoalsPanel = ({ questionsData, hoursData, goalsHistory, setActiveTab }) => {

    const weeklyProgress = useMemo(() => {
        const today = new Date();
        const day = today.getDay();
        const diff = today.getDate() - day + (day === 0 ? -6 : 1);
        const startOfWeek = new Date(today.setDate(diff));
        startOfWeek.setHours(0, 0, 0, 0);

        const getGoalsForDate = (dateStr) => {
            if (!goalsHistory || goalsHistory.length === 0) return { questions: 0, hours: 0 };
            const sortedGoals = [...goalsHistory].sort((a, b) => new Date(b.startDate) - new Date(a.startDate));
            return sortedGoals.find(g => g.startDate <= dateStr) || { questions: 0, hours: 0 };
        };

        const goalForThisWeek = getGoalsForDate(startOfWeek.toISOString().slice(0, 10));

        const weeklyQuestions = questionsData
            .filter(d => new Date(d.date + 'T03:00:00') >= startOfWeek) // Ajuste de fuso
            .reduce((sum, item) => sum + item.questions, 0);

        const weeklyHours = hoursData
            .filter(d => new Date(d.date + 'T03:00:00') >= startOfWeek) // Ajuste de fuso
            .reduce((sum, item) => sum + item.hours, 0);

        const questionGoal = goalForThisWeek.questions * 7;
        const hoursGoal = goalForThisWeek.hours * 7;

        const hoursPerc = Math.min(hoursGoal > 0 ? (weeklyHours / hoursGoal) * 100 : 0, 100);
        const questionPerc = Math.min(questionGoal > 0 ? (weeklyQuestions / questionGoal) * 100 : 0, 100);

        return {
            currentQuestions: weeklyQuestions,
            goalQuestions: questionGoal,
            questionPerc: questionPerc,
            currentHours: weeklyHours,
            goalHours: hoursGoal,
            hoursPerc: hoursPerc,
        };
    }, [questionsData, hoursData, goalsHistory]);

    return (
        // TRADUÇÃO de .home-card .grid-col-span-3
        <div className="bg-card-background-color dark:bg-dark-card-background-color rounded-xl shadow-card-shadow p-4 md:p-6 col-span-1 md:col-span-2 lg:col-span-3">
            {/* TRADUÇÃO de .weekly-goals-header */}
            <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold text-heading-color dark:text-dark-heading-color m-0 border-none">
                  Metas da Semana
                </h2>
                {/* TRADUÇÃO do botão de editar */}
                <button
                  onClick={() => setActiveTab('goals')}
                  title="Editar Metas"
                  className="bg-transparent border-none text-2xl cursor-pointer text-subtle-text-color dark:text-dark-subtle-text-color
                             hover:bg-background-color dark:hover:bg-dark-background-color rounded-full p-2"
                >
                  ✏️
                </button>
            </div>

            {/* TRADUÇÃO de .progress-bar-container */}
            <div className="mb-4">
                {/* TRADUÇÃO de .progress-bar-label */}
                <div className="flex justify-between font-semibold mb-2 text-sm text-text-color dark:text-dark-text-color">
                    <span>Horas de Estudo</span>
                    <span>{formatDecimalHours(weeklyProgress.currentHours)} / {formatDecimalHours(weeklyProgress.goalHours)}</span>
                </div>
                {/* TRADUÇÃO de .progress-bar */}
                <div className="bg-border-color dark:bg-dark-border-color rounded-full h-4 overflow-hidden">
                    {/* TRADUÇÃO de .progress-bar-fill */}
                    <div
                      className={`h-full rounded-full transition-all duration-500 ease-out
                                 ${weeklyProgress.hoursPerc >= 100 ? 'bg-success-color' : 'bg-primary-color'}`}
                      style={{ width: `${weeklyProgress.hoursPerc}%` }}
                    ></div>
                </div>
            </div>

            {/* Segundo .progress-bar-container */}
            <div>
                <div className="flex justify-between font-semibold mb-2 text-sm text-text-color dark:text-dark-text-color">
                    <span>Questões</span>
                    <span>{weeklyProgress.currentQuestions} / {weeklyProgress.goalQuestions}</span>
                </div>
                <div className="bg-border-color dark:bg-dark-border-color rounded-full h-4 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ease-out
                                 ${weeklyProgress.questionPerc >= 100 ? 'bg-success-color' : 'bg-primary-color'}`}
                      style={{ width: `${weeklyProgress.questionPerc}%` }}
                    ></div>
                </div>
            </div>
        </div>
    );
};

export default WeeklyGoalsPanel;