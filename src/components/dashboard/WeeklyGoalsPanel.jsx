import React, { useMemo } from 'react';

const formatDecimalHours = (d) => {
    if (!d || d < 0) return '00:00:00';
    const s = Math.round(d * 3600);
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    return `${h}h ${m}m`;
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
            .filter(d => new Date(d.date) >= startOfWeek)
            .reduce((sum, item) => sum + item.questions, 0);

        const weeklyHours = hoursData
            .filter(d => new Date(d.date) >= startOfWeek)
            .reduce((sum, item) => sum + item.hours, 0);

        const questionGoal = goalForThisWeek.questions * 7;
        const hoursGoal = goalForThisWeek.hours * 7;

        return {
            currentQuestions: weeklyQuestions,
            goalQuestions: questionGoal,
            questionPerc: questionGoal > 0 ? (weeklyQuestions / questionGoal) * 100 : 0,
            currentHours: weeklyHours,
            goalHours: hoursGoal,
            hoursPerc: hoursGoal > 0 ? (weeklyHours / hoursGoal) * 100 : 0,
        };
    }, [questionsData, hoursData, goalsHistory]);

    return (
        <div className="home-card grid-col-span-3">
            <div className="weekly-goals-header">
                <h2>Metas da Semana</h2>
                <button onClick={() => setActiveTab('goals')} title="Editar Metas">✏️</button>
            </div>
            <div>
                <div className="progress-bar-label">
                    <span>Horas de Estudo</span>
                    <span>{formatDecimalHours(weeklyProgress.currentHours)} / {formatDecimalHours(weeklyProgress.goalHours)}</span>
                </div>
                <div className="progress-bar">
                    <div className="progress-bar-fill" style={{ width: `${weeklyProgress.hoursPerc}%` }}></div>
                </div>
            </div>
            <div style={{marginTop: '16px'}}>
                <div className="progress-bar-label">
                    <span>Questões</span>
                    <span>{weeklyProgress.currentQuestions} / {weeklyProgress.goalQuestions}</span>
                </div>
                <div className="progress-bar">
                    <div className="progress-bar-fill" style={{ width: `${weeklyProgress.questionPerc}%` }}></div>
                </div>
            </div>
        </div>
    );
};

export default WeeklyGoalsPanel;