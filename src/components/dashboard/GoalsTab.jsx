import React, { useState, useEffect } from 'react';

const dateToYMD_local = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

// A função onDeleteGoal não estava sendo passada como prop, adicionei
function GoalsTab({ goalsHistory, onAddGoal, onDeleteGoal }) {
  const [questions, setQuestions] = useState('');
  const [hours, setHours] = useState('');

  // Lógica do useEffect (sem alteração)
  useEffect(() => {
    const today = new Date();
    const day = today.getDay();
    const diff = today.getDate() - day + (day === 0 ? -6 : 1);
    const startOfWeek = dateToYMD_local(new Date(today.setDate(diff)));

    const currentWeekGoal = goalsHistory.find(g => g.startDate === startOfWeek);
    if (currentWeekGoal) {
      setQuestions(currentWeekGoal.questions);
      setHours(currentWeekGoal.hours);
    } else {
      // Se não houver meta, busca a meta mais recente como sugestão
      const latestGoal = [...goalsHistory].sort((a, b) => new Date(b.startDate) - new Date(a.startDate))[0];
      if (latestGoal && latestGoal.startDate !== '2020-01-01') {
        setQuestions(latestGoal.questions);
        setHours(latestGoal.hours);
      } else {
        setQuestions('');
        setHours('');
      }
    }
  }, [goalsHistory]);

  // Lógica de Submit (use onAddGoal)
  const handleSubmit = (e) => {
    e.preventDefault();
    const qValue = parseInt(questions) || 0;
    const hValue = parseFloat(hours) || 0;
    // Corrigido para usar a prop 'onAddGoal'
    onAddGoal({ questions: qValue, hours: hValue });
  };

  return (
    <div>
      <h2 className="text-xl font-bold text-heading-color dark:text-dark-heading-color mt-8 mb-4 border-b-2 border-border-color dark:border-dark-border-color pb-2">
        🎯 Definir Meta Semanal
      </h2>
      <p className="text-text-color dark:text-dark-text-color mb-6">
        Defina sua meta diária de questões e horas para a <strong>semana atual</strong>. Essa meta será salva e usada para avaliar seu desempenho.
      </p>

      {/* TRADUÇÃO de .form-container */}
      <form onSubmit={handleSubmit} className="flex flex-col md:flex-row flex-wrap items-end gap-4 p-6 bg-card-background-color dark:bg-dark-card-background-color rounded-xl shadow-card-shadow">
        <div className="flex flex-col flex-grow w-full md:w-auto md:flex-[1] min-w-[120px]">
          <label htmlFor="goal-questions" className="block mb-2 font-semibold text-sm text-text-color dark:text-dark-text-color">Questões/Dia</label>
          <input
            type="number"
            id="goal-questions"
            placeholder="Ex: 80"
            value={questions}
            onChange={(e) => setQuestions(e.target.value)}
            className="w-full p-3 border border-border-color dark:border-dark-border-color rounded-lg bg-background-color dark:bg-dark-background-color text-text-color dark:text-dark-text-color text-base
                       focus:outline-none focus:ring-2 focus:ring-primary-color"
          />
        </div>
        <div className="flex flex-col flex-grow w-full md:w-auto md:flex-[1] min-w-[120px]">
          <label htmlFor="goal-hours" className="block mb-2 font-semibold text-sm text-text-color dark:text-dark-text-color">Horas/Dia</label>
          <input
            type="number"
            id="goal-hours"
            placeholder="Ex: 4"
            value={hours}
            onChange={(e) => setHours(e.target.value)}
            className="w-full p-3 border border-border-color dark:border-dark-border-color rounded-lg bg-background-color dark:bg-dark-background-color text-text-color dark:text-dark-text-color text-base
                       focus:outline-none focus:ring-2 focus:ring-primary-color"
          />
        </div>
        {/* TRADUÇÃO de .btn .btn-success */}
        <button type="submit"
          className="w-full md:w-auto p-3 h-12 border-none rounded-lg cursor-pointer font-semibold text-base
                     transition-opacity duration-200 transform active:scale-[0.98]
                     bg-success-color text-white hover:opacity-90"
        >
          Salvar Meta da Semana
        </button>
      </form>

      <h2 className="text-xl font-bold text-heading-color dark:text-dark-heading-color mt-8 mb-4 border-b-2 border-border-color dark:border-dark-border-color pb-2">
        Histórico de Metas Semanais
      </h2>

      {/* TRADUÇÃO de .history-table */}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse min-w-[600px]">
          <thead>
            <tr className="border-b-2 border-border-color dark:border-dark-border-color">
              <th className="p-3 text-left text-xs font-semibold text-subtle-text-color dark:text-dark-subtle-text-color uppercase">Semana de Início</th>
              <th className="p-3 text-left text-xs font-semibold text-subtle-text-color dark:text-dark-subtle-text-color uppercase">Meta de Questões/Dia</th>
              <th className="p-3 text-left text-xs font-semibold text-subtle-text-color dark:text-dark-subtle-text-color uppercase">Meta de Horas/Dia</th>
              <th className="p-3 text-left text-xs font-semibold text-subtle-text-color dark:text-dark-subtle-text-color uppercase">Ação</th>
            </tr>
          </thead>
          <tbody>
            {goalsHistory.filter(g => g.startDate !== '2020-01-01').length === 0 ? (
              <tr><td colSpan="4" className="p-3 text-center text-subtle-text-color dark:text-dark-subtle-text-color">Nenhum histórico de metas.</td></tr>
            ) : (
              [...goalsHistory]
                .filter(g => g.startDate !== '2020-01-01')
                .sort((a, b) => new Date(b.startDate) - new Date(a.startDate))
                .map(goal => (
                  <tr key={goal.id} className="border-b border-border-color dark:border-dark-border-color transition-colors hover:bg-background-color dark:hover:bg-dark-background-color">
                    <td className="p-3 align-middle text-sm">{new Date(goal.startDate + 'T03:00:00').toLocaleDateString('pt-BR')}</td>
                    <td className="p-3 align-middle text-sm">{goal.questions}</td>
                    <td className="p-3 align-middle text-sm">{goal.hours}</td>
                    <td>
                      <button
                        className="bg-transparent border-none text-subtle-text-color dark:text-dark-subtle-text-color cursor-pointer text-lg p-2 transition-colors hover:text-danger-color"
                        onClick={() => onDeleteGoal(goal.id)} // onDeleteGoal precisa ser passado do Dashboard.jsx
                      >
                        ❌
                      </button>
                    </td>
                  </tr>
                ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default GoalsTab;