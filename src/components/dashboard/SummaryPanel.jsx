import React from 'react';

function SummaryPanel({ questionsData }) {
  // Lógica (sem alteração)
  const totalQuestions = questionsData.reduce((sum, item) => sum + item.questions, 0);
  const totalCorrect = questionsData.reduce((sum, item) => sum + item.correct, 0);
  const percentage = totalQuestions > 0 ? ((totalCorrect / totalQuestions) * 100).toFixed(1) : '0.0';

  return (
    // TRADUÇÃO de .summary-panel
    <section className="grid grid-cols-1 sm:grid-cols-3 gap-4 md:gap-6 mb-6">
      {/* TRADUÇÃO de .summary-item */}
      <div className="bg-card-background-color dark:bg-dark-card-background-color
                      rounded-xl shadow-card-shadow p-4 text-center">
        <h3 className="m-0 mb-2 text-sm font-semibold uppercase
                       text-subtle-text-color dark:text-dark-subtle-text-color">
          Questões no Período
        </h3>
        <p className="m-0 text-3xl font-bold text-heading-color dark:text-dark-heading-color">
          {totalQuestions}
        </p>
      </div>

      <div className="bg-card-background-color dark:bg-dark-card-background-color
                      rounded-xl shadow-card-shadow p-4 text-center">
        <h3 className="m-0 mb-2 text-sm font-semibold uppercase
                       text-subtle-text-color dark:text-dark-subtle-text-color">
          Acertos no Período
        </h3>
        <p className="m-0 text-3xl font-bold text-heading-color dark:text-dark-heading-color">
          {totalCorrect}
        </p>
      </div>

      <div className="bg-card-background-color dark:bg-dark-card-background-color
                      rounded-xl shadow-card-shadow p-4 text-center">
        <h3 className="m-0 mb-2 text-sm font-semibold uppercase
                       text-subtle-text-color dark:text-dark-subtle-text-color">
          Aproveitamento
        </h3>
        <p className="m-0 text-3xl font-bold text-heading-color dark:text-dark-heading-color">
          {percentage}%
        </p>
      </div>
    </section>
  );
}

export default SummaryPanel;