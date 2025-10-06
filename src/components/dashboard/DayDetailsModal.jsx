import React from 'react';

// Funções auxiliares que já conhecemos
const formatDecimalHours = (d) => {
    if (!d || d < 0) return '00:00:00';
    const s = Math.round(d * 3600);
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sc = s % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(sc).padStart(2, '0')}`;
};

const getPColor = (p) => {
    if (p > 88) return 'var(--excellent-color)';
    if (p >= 80) return 'var(--success-color)';
    if (p >= 60) return 'var(--warning-color)';
    return 'var(--danger-color)';
};

function DayDetailsModal({ date, dayData, onClose }) {
  if (!date || !dayData) {
    return null; // Não mostra nada se não houver data
  }

  const { dayQuestions, dayHours } = dayData;

  const totalQ = dayQuestions.reduce((s, d) => s + d.questions, 0);
  const totalC = dayQuestions.reduce((s, d) => s + d.correct, 0);
  const totalH = dayHours.reduce((s, d) => s + d.hours, 0);
  const perc = totalQ > 0 ? ((totalC / totalQ) * 100) : 0;

  const formattedDate = new Date(date + 'T03:00:00').toLocaleDateString('pt-BR', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
  });

  return (
    <div className="modal-overlay active" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 id="modal-date">{formattedDate}</h2>
          <button className="modal-close-btn" onClick={onClose}>&times;</button>
        </div>
        <div className="modal-body">
          <div className="modal-summary-panel">
            <div className="modal-summary-item"><h4>Total de Horas</h4><p>{formatDecimalHours(totalH)}</p></div>
            <div className="modal-summary-item"><h4>Total de Questões</h4><p>{totalQ}</p></div>
            <div className="modal-summary-item"><h4>Aproveitamento</h4><p style={{ color: getPColor(perc) }}>{perc.toFixed(1)}%</p></div>
          </div>

          <h3>Questões</h3>
          <table className="history-table">
            <thead><tr><th>Disciplina</th><th>Questões</th><th>Acertos</th><th>Aproveitamento</th></tr></thead>
            <tbody>
              {dayQuestions.length > 0 ? (
                dayQuestions.map((q, index) => {
                  const p = q.questions > 0 ? (q.correct / q.questions) * 100 : 0;
                  return (
                    <tr key={index}>
                      <td>{q.subject}</td>
                      <td>{q.questions}</td>
                      <td>{q.correct}</td>
                      <td style={{ fontWeight: '600', color: getPColor(p) }}>{p.toFixed(1)}%</td>
                    </tr>
                  )
                })
              ) : (
                <tr><td colSpan="4" style={{ textAlign: 'center' }}>Nenhum registro de questão.</td></tr>
              )}
            </tbody>
          </table>
          <br />
          <h3>Horas de Estudo</h3>
          <table className="history-table">
            <thead><tr><th>Atividade</th><th>Tempo Dedicado</th></tr></thead>
            <tbody>
              {dayHours.length > 0 ? (
                dayHours.map((h, index) => (
                  <tr key={index}>
                    <td>{h.subject}</td>
                    <td>{formatDecimalHours(h.hours)}</td>
                  </tr>
                ))
              ) : (
                <tr><td colSpan="2" style={{ textAlign: 'center' }}>Nenhum registro de horas.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default DayDetailsModal;