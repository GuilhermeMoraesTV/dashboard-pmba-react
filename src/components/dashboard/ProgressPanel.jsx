import React from 'react';

// --- Funções Helper (sem alteração) ---
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

const triggerConfetti = () => {
    // Esta função depende do CSS em index.css (seções 17 e 18)
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
// ------------------------------------

function ProgressPanel({ questionsData, hoursData, goalsHistory }) {
  const todayStr = dateToYMD_local(new Date());

  // Lógica (sem alteração)
  const getGoalsForDate = (dateStr) => {
    if (!goalsHistory || goalsHistory.length === 0) return { questions: 0, hours: 0 };
    const sortedGoals = [...goalsHistory].sort((a, b) => new Date(b.startDate) - new Date(a.startDate));
    return sortedGoals.find(g => g.startDate <= dateStr) || { questions: 0, hours: 0 };
  };

  const goalsForToday = getGoalsForDate(todayStr);

  const todayQuestions = questionsData
    .filter(d => d.date === todayStr)
    .reduce((sum, d) => sum + d.questions, 0);

  const todayHours = hoursData
    .filter(d => d.date === todayStr)
    .reduce((sum, d) => sum + d.hours, 0);

  const qProgress = Math.min((todayQuestions / (goalsForToday.questions || 1)) * 100, 100);
  const hProgress = Math.min((todayHours / (goalsForToday.hours || 1)) * 100, 100);

  // Lógica do Confete (sem alteração)
  if (qProgress >= 100 && hProgress >= 100) {
    const lastConfettiDate = localStorage.getItem('lastConfettiDate');
    if (lastConfettiDate !== todayStr) {
        triggerConfetti();
        localStorage.setItem('lastConfettiDate', todayStr);
    }
  }

  return (
    // TRADUÇÃO de .card
    // A animação 'fadeInFromBottom' (seção 18) deve ser mantida no index.css
    // Para usá-la com Tailwind, podemos adicionar uma classe customizada
    // ou apenas manter a lógica de animação no CSS.
    // Por ora, vamos focar no layout.
    <div className="bg-card-background-color dark:bg-dark-card-background-color rounded-xl shadow-card-shadow p-4 md:p-6">
      <h2 className="text-xl font-bold text-heading-color dark:text-dark-heading-color mb-4 mt-0 border-none">
        Progresso de Hoje
      </h2>

      {/* TRADUÇÃO de .progress-bar-container */}
      <div className="mb-4">
        {/* TRADUÇÃO de .progress-bar-label */}
        <div className="flex justify-between font-semibold mb-2 text-sm text-text-color dark:text-dark-text-color">
          <span>Questões</span>
          <span>{todayQuestions} / {goalsForToday.questions}</span>
        </div>
        {/* TRADUÇÃO de .progress-bar */}
        <div className="bg-border-color dark:bg-dark-border-color rounded-full h-4 overflow-hidden">
          {/* TRADUÇÃO de .progress-bar-fill e .completed */}
          <div
            className={`h-full rounded-full transition-all duration-500 ease-out
                       ${qProgress >= 100 ? 'bg-success-color' : 'bg-primary'}`}
            style={{ width: `${qProgress}%` }}
          ></div>
        </div>
      </div>

      {/* Segundo .progress-bar-container */}
      <div className="mb-4">
        <div className="flex justify-between font-semibold mb-2 text-sm text-text-color dark:text-dark-text-color">
          <span>Horas de Estudo</span>
          <span>{formatDecimalHours(todayHours)} / {formatDecimalHours(goalsForToday.hours)}</span>
        </div>
        <div className="bg-border-color dark:bg-dark-border-color rounded-full h-4 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ease-out
                       ${hProgress >= 100 ? 'bg-success-color' : 'bg-primary'}`}
            style={{ width: `${hProgress}%` }}
          ></div>
        </div>
      </div>
    </div>
  );
}

export default ProgressPanel;