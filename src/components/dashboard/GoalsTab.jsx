import React, { useState, useEffect } from 'react';

const dateToYMD_local = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

function GoalsTab({ goalsHistory, onSaveGoal, onDeleteGoal }) {
  // Estados para controlar os inputs do formulário
  const [questions, setQuestions] = useState('');
  const [hours, setHours] = useState('');

  // useEffect para preencher o formulário com a meta da semana atual, se ela existir
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
      setQuestions('');
      setHours('');
    }
  }, [goalsHistory]); // Roda sempre que o histórico de metas mudar

  const handleSubmit = (e) => {
    e.preventDefault();
    const qValue = parseInt(questions) || 0;
    const hValue = parseFloat(hours) || 0;
    onSaveGoal({ questions: qValue, hours: hValue });
  };

  return (
    <div>
      <h2>🎯 Definir Meta Semanal</h2>
      <p>Defina sua meta diária de questões e horas para a <strong>semana atual</strong>. Essa meta será salva e usada para avaliar seu desempenho.</p>
      <form onSubmit={handleSubmit} className="form-container">
        <div className="form-group fg-grow-1">
          <label htmlFor="goal-questions">Questões/Dia</label>
          <input
            type="number"
            id="goal-questions"
            placeholder="Ex: 80"
            value={questions}
            onChange={(e) => setQuestions(e.target.value)}
          />
        </div>
        <div className="form-group fg-grow-1">
          <label htmlFor="goal-hours">Horas/Dia</label>
          <input
            type="number"
            id="goal-hours"
            placeholder="Ex: 4"
            value={hours}
            onChange={(e) => setHours(e.target.value)}
          />
        </div>
        <button type="submit" className="btn btn-success" style={{ height: '48px' }}>Salvar Meta da Semana</button>
      </form>

      <h2>Histórico de Metas Semanais</h2>
      <table className="history-table">
        <thead>
          <tr>
            <th>Semana de Início</th>
            <th>Meta de Questões/Dia</th>
            <th>Meta de Horas/Dia</th>
            <th>Ação</th>
          </tr>
        </thead>
        <tbody>
          {goalsHistory.filter(g => g.startDate !== '2020-01-01').length === 0 ? (
            <tr><td colSpan="4" style={{ textAlign: 'center' }}>Nenhum histórico de metas.</td></tr>
          ) : (
            [...goalsHistory]
              .filter(g => g.startDate !== '2020-01-01') // Não mostra a meta padrão
              .sort((a, b) => new Date(b.startDate) - new Date(a.startDate))
              .map(goal => (
                <tr key={goal.id}>
                  <td>{new Date(goal.startDate + 'T03:00:00').toLocaleDateString('pt-BR')}</td>
                  <td>{goal.questions}</td>
                  <td>{goal.hours}</td>
                  <td>
                    <button className="btn-delete" onClick={() => onDeleteGoal(goal.id)}>
                      ❌
                    </button>
                  </td>
                </tr>
              ))
          )}
        </tbody>
      </table>
    </div>
  );
}

export default GoalsTab;