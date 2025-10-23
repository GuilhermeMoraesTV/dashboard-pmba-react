import React from 'react';

// --- Funções Helper (Sem alteração) ---
const formatDecimalHours = (d) => {
    if (!d || d < 0) return '00:00:00';
    const s = Math.round(d * 3600);
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sc = s % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(sc).padStart(2, '0')}`;
};

// Esta função agora usa as classes de cor do Tailwind
const getPColorClass = (p) => {
    if (p > 88) return 'text-excellent-color';
    if (p >= 80) return 'text-success-color';
    if (p >= 60) return 'text-warning-color';
    return 'text-danger-color';
};
// -------------------------------------


function DayDetailsModal({ date, dayData, onClose }) {
  if (!date || !dayData) {
    return null;
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
    // TRADUÇÃO de .modal-overlay
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 transition-opacity duration-300 opacity-100 pointer-events-auto"
      onClick={onClose}
    >
      {/* TRADUÇÃO de .modal-content */}
      <div
        className="bg-card-background-color dark:bg-dark-card-background-color
                   rounded-xl shadow-lg p-6 md:p-8 w-11/12 max-w-3xl max-h-[90vh]
                   overflow-y-auto transform transition-transform duration-300 scale-100"
        onClick={(e) => e.stopPropagation()}
      >
        {/* TRADUÇÃO de .modal-header */}
        <div className="flex justify-between items-center mb-4 pb-2 border-b-2 border-border-color dark:border-dark-border-color">
          <h2 className="text-xl md:text-2xl font-bold text-heading-color dark:text-dark-heading-color m-0 border-none">
            {formattedDate}
          </h2>
          {/* TRADUÇÃO de .modal-close-btn */}
          <button
            className="bg-transparent border-none text-3xl cursor-pointer text-text-color dark:text-dark-text-color hover:text-danger-color"
            onClick={onClose}
          >
            &times;
          </button>
        </div>

        {/* --- TRADUÇÃO do .modal-body (implicit) --- */}
        <div>
          {/* TRADUÇÃO de .modal-summary-panel */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
            {/* TRADUÇÃO de .modal-summary-item */}
            <div className="bg-background-color dark:bg-dark-background-color text-center p-4 rounded-lg">
              <h4 className="m-0 mb-2 text-sm font-semibold text-subtle-text-color dark:text-dark-subtle-text-color">Total de Horas</h4>
              <p className="m-0 text-2xl font-bold text-heading-color dark:text-dark-heading-color">{formatDecimalHours(totalH)}</p>
            </div>
            <div className="bg-background-color dark:bg-dark-background-color text-center p-4 rounded-lg">
              <h4 className="m-0 mb-2 text-sm font-semibold text-subtle-text-color dark:text-dark-subtle-text-color">Total de Questões</h4>
              <p className="m-0 text-2xl font-bold text-heading-color dark:text-dark-heading-color">{totalQ}</p>
            </div>
            <div className="bg-background-color dark:bg-dark-background-color text-center p-4 rounded-lg">
              <h4 className="m-0 mb-2 text-sm font-semibold text-subtle-text-color dark:text-dark-subtle-text-color">Aproveitamento</h4>
              <p className={`m-0 text-2xl font-bold ${getPColorClass(perc)}`}>{perc.toFixed(1)}%</p>
            </div>
          </div>

          <h3 className="text-lg font-bold text-heading-color dark:text-dark-heading-color mb-3">Questões</h3>
          {/* TRADUÇÃO de .history-table */}
          <table className="w-full border-collapse mb-6">
            <thead>
              <tr>
                <th className="p-3 text-left text-xs font-semibold text-subtle-text-color dark:text-dark-subtle-text-color uppercase border-b-2 border-border-color dark:border-dark-border-color">Disciplina</th>
                <th className="p-3 text-left text-xs font-semibold text-subtle-text-color dark:text-dark-subtle-text-color uppercase border-b-2 border-border-color dark:border-dark-border-color">Questões</th>
                <th className="p-3 text-left text-xs font-semibold text-subtle-text-color dark:text-dark-subtle-text-color uppercase border-b-2 border-border-color dark:border-dark-border-color">Acertos</th>
                <th className="p-3 text-left text-xs font-semibold text-subtle-text-color dark:text-dark-subtle-text-color uppercase border-b-2 border-border-color dark:border-dark-border-color">Aproveitamento</th>
              </tr>
            </thead>
            <tbody>
              {dayQuestions.length > 0 ? (
                dayQuestions.map((q, index) => {
                  const p = q.questions > 0 ? (q.correct / q.questions) * 100 : 0;
                  return (
                    <tr key={index} className="border-b border-border-color dark:border-dark-border-color transition-colors hover:bg-background-color dark:hover:bg-dark-background-color">
                      <td className="p-3 align-middle text-sm">{q.subject}</td>
                      <td className="p-3 align-middle text-sm">{q.questions}</td>
                      <td className="p-3 align-middle text-sm">{q.correct}</td>
                      <td className={`p-3 align-middle text-sm font-semibold ${getPColorClass(p)}`}>{p.toFixed(1)}%</td>
                    </tr>
                  )
                })
              ) : (
                <tr><td colSpan="4" className="p-3 text-center text-subtle-text-color dark:text-dark-subtle-text-color">Nenhum registro de questão.</td></tr>
              )}
            </tbody>
          </table>

          <h3 className="text-lg font-bold text-heading-color dark:text-dark-heading-color mb-3">Horas de Estudo</h3>
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <th className="p-3 text-left text-xs font-semibold text-subtle-text-color dark:text-dark-subtle-text-color uppercase border-b-2 border-border-color dark:border-dark-border-color">Atividade</th>
                <th className="p-3 text-left text-xs font-semibold text-subtle-text-color dark:text-dark-subtle-text-color uppercase border-b-2 border-border-color dark:border-dark-border-color">Tempo Dedicado</th>
              </tr>
            </thead>
            <tbody>
              {dayHours.length > 0 ? (
                dayHours.map((h, index) => (
                  <tr key={index} className="border-b border-border-color dark:border-dark-border-color transition-colors hover:bg-background-color dark:hover:bg-dark-background-color">
                    <td className="p-3 align-middle text-sm">{h.subject}</td>
                    <td className="p-3 align-middle text-sm">{formatDecimalHours(h.hours)}</td>
                  </tr>
                ))
              ) : (
                <tr><td colSpan="2" className="p-3 text-center text-subtle-text-color dark:text-dark-subtle-text-color">Nenhum registro de horas.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default DayDetailsModal;