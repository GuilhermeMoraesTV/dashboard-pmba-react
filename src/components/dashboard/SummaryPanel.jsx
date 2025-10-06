import React from 'react';

function SummaryPanel({ questionsData }) {
  // Lógica para calcular os totais a partir dos dados recebidos
  const totalQuestions = questionsData.reduce((sum, item) => sum + item.questions, 0);
  const totalCorrect = questionsData.reduce((sum, item) => sum + item.correct, 0);
  const percentage = totalQuestions > 0 ? ((totalCorrect / totalQuestions) * 100).toFixed(1) : '0.0';

  return (
    <section className="summary-panel">
      <div className="summary-item" style={{animationDelay: '0.1s'}}>
        <h3>Questões no Período</h3>
        <p id="total-questions">{totalQuestions}</p>
      </div>
      <div className="summary-item" style={{animationDelay: '0.2s'}}>
        <h3>Acertos no Período</h3>
        <p id="total-correct">{totalCorrect}</p>
      </div>
      <div className="summary-item" style={{animationDelay: '0.3s'}}>
        <h3>Aproveitamento</h3>
        <p id="total-percentage">{percentage}%</p>
      </div>
    </section>
  );
}

export default SummaryPanel;