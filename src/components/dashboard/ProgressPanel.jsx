import React from 'react';

const formatDecimalHours = (d) => {
    if (!d || d < 0) return '00:00:00';
    const s = Math.round(d * 3600);
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sc = s % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(sc).padStart(2, '0')}`;
};

const dateToYMD_local = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

const dateToYMD = (date) => date.toISOString().slice(0, 10);

const triggerConfetti = () => {
    for (let i = 0; i < 100; i++) {
        const confetti = document.createElement('div');
        confetti.classList.add('confetti');
        confetti.style.left = Math.random() * 100 + 'vw';
        confetti.style.top = Math.random() * -20 + 'vh';
        confetti.style.backgroundColor = `hsl(${Math.random() * 360}, 100%, 50%)`;
        confetti.style.animationDelay = Math.random() * 0.5 + 's';
        document.body.appendChild(confetti);
        setTimeout(() => { confetti.remove(); }, 3000);
    }
};

function ProgressPanel({ questionsData, hoursData, goalsHistory }) {
  const todayStr = dateToYMD_local(new Date());

  // Lógica para buscar a meta de hoje
  const getGoalsForDate = (dateStr) => {
    if (!goalsHistory || goalsHistory.length === 0) return { questions: 0, hours: 0 };
    const sortedGoals = [...goalsHistory].sort((a, b) => new Date(b.startDate) - new Date(a.startDate));
    return sortedGoals.find(g => g.startDate <= dateStr) || { questions: 0, hours: 0 };
  };

  const goalsForToday = getGoalsForDate(todayStr);

  // Lógica para calcular o progresso de hoje
  const todayQuestions = questionsData
    .filter(d => d.date === todayStr)
    .reduce((sum, d) => sum + d.questions, 0);

  const todayHours = hoursData
    .filter(d => d.date === todayStr)
    .reduce((sum, d) => sum + d.hours, 0);

  const qProgress = Math.min((todayQuestions / (goalsForToday.questions || 1)) * 100, 100);
  const hProgress = Math.min((todayHours / (goalsForToday.hours || 1)) * 100, 100);

  // Lógica do Confete
  if (qProgress >= 100 && hProgress >= 100) {
    const lastConfettiDate = localStorage.getItem('lastConfettiDate');
    if (lastConfettiDate !== todayStr) {
        triggerConfetti();
        localStorage.setItem('lastConfettiDate', todayStr);
    }
  }

  return (
    <div className="card" style={{ animationDelay: '0.1s' }}>
      <h2>Progresso de Hoje</h2>
      <div className="progress-bar-container">
        <div className="progress-bar-label">
          <span>Questões</span>
          <span>{todayQuestions} / {goalsForToday.questions}</span>
        </div>
        <div className="progress-bar">
          <div
            className={`progress-bar-fill ${qProgress >= 100 ? 'completed' : ''}`}
            style={{ width: `${qProgress}%` }}
          ></div>
        </div>
      </div>
      <div className="progress-bar-container">
        <div className="progress-bar-label">
          <span>Horas de Estudo</span>
          <span>{formatDecimalHours(todayHours)} / {formatDecimalHours(goalsForToday.hours)}</span>
        </div>
        <div className="progress-bar">
          <div
            className={`progress-bar-fill ${hProgress >= 100 ? 'completed' : ''}`}
            style={{ width: `${hProgress}%` }}
          ></div>
        </div>
      </div>
    </div>
  );
}

export default ProgressPanel;