import React from 'react';

// Função auxiliar para pegar a cor baseada na performance
const getPColor = (p) => {
    if (p > 88) return 'var(--excellent-color)';
    if (p >= 80) return 'var(--success-color)';
    if (p >= 60) return 'var(--warning-color)';
    return 'var(--danger-color)';
};

function Sidebar({ questionsData, hoursData }) {

  // Lógica para calcular o ranking de aproveitamento
  const questionStats = questionsData.reduce((acc, { subject, questions, correct }) => {
    acc[subject] = acc[subject] || { q: 0, c: 0 };
    acc[subject].q += questions;
    acc[subject].c += correct;
    return acc;
  }, {});

  const performanceRanking = Object.entries(questionStats)
    .map(([subject, data]) => ({
      subject,
      totalQ: data.q,
      totalC: data.c,
      perc: data.q > 0 ? (data.c / data.q) * 100 : 0,
    }))
    .sort((a, b) => b.perc - a.perc);

  return (
    <aside className="sidebar" id="sidebar-ranking">
      <div className="card" style={{ animationDelay: '0.3s' }}>
        <h2>Ranking por Aproveitamento</h2>
        <ul className="ranking-list" id="questions-ranking-list">
          {performanceRanking.length === 0 ? (
            <li>Sem dados de questões.</li>
          ) : (
            performanceRanking.map(item => (
              <li key={item.subject}>
                <div className="main-info">
                  <span>{item.subject}</span>
                  <span className="percentage" style={{ backgroundColor: getPColor(item.perc) }}>
                    {item.perc.toFixed(1)}%
                  </span>
                </div>
                <div className="details">
                  Total: {item.totalQ} | Certas: {item.totalC}
                </div>
              </li>
            ))
          )}
        </ul>
      </div>
      <div className="card" style={{ animationDelay: '0.4s' }}>
        <h2>Ranking de Horas</h2>
        <ul className="ranking-list" id="hours-ranking-list">
          <li>Em breve...</li>
        </ul>
      </div>
    </aside>
  );
}

export default Sidebar;