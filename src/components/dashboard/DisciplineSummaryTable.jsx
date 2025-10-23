import React, { useMemo } from 'react';

const formatDecimalHours = (d) => {
    if (!d || d < 0) return '00h 00m';
    const totalMinutes = Math.round(d * 60);
    const h = Math.floor(totalMinutes / 60);
    const m = totalMinutes % 60;
    return `${String(h).padStart(2, '0')}h ${String(m).padStart(2, '0')}m`;
};

const DisciplineSummaryTable = ({ questionsData, hoursData }) => {
  const summary = useMemo(() => {
    const data = {};

    // Agrega horas
    hoursData.forEach(item => {
      data[item.subject] = data[item.subject] || { hours: 0, questions: 0, correct: 0 };
      data[item.subject].hours += item.hours;
    });

    // Agrega questões
    questionsData.forEach(item => {
      data[item.subject] = data[item.subject] || { hours: 0, questions: 0, correct: 0 };
      data[item.subject].questions += item.questions;
      data[item.subject].correct += item.correct;
    });

    return Object.entries(data)
      .map(([subject, values]) => {
        const wrong = values.questions - values.correct;
        const percentage = values.questions > 0 ? (values.correct / values.questions) * 100 : 0;
        return { subject, ...values, wrong, percentage };
      })
      .sort((a, b) => b.hours - a.hours); // Ordena por horas de estudo
  }, [questionsData, hoursData]);

  return (
    // TRADUÇÃO de .home-card .grid-col-span-3
    <div className="bg-card-background-color dark:bg-dark-card-background-color rounded-xl shadow-card-shadow p-4 md:p-6 col-span-1 md:col-span-2 lg:col-span-3">
        {/* TRADUÇÃO de h2 */}
        <h2 className="text-xl font-bold text-heading-color dark:text-dark-heading-color mb-4 mt-0 border-none">
          Painel de Disciplinas
        </h2>

        {/* TRADUÇÃO de .discipline-summary-table */}
        <div className="overflow-x-auto"> {/* Garante responsividade em telas pequenas */}
          <table className="w-full border-collapse min-w-[600px]">
              <thead>
                  <tr className="border-b-2 border-border-color dark:border-dark-border-color">
                      <th className="p-3 text-left text-xs font-semibold text-subtle-text-color dark:text-dark-subtle-text-color uppercase">Disciplinas</th>
                      <th className="p-3 text-left text-xs font-semibold text-subtle-text-color dark:text-dark-subtle-text-color uppercase">Tempo</th>
                      <th className="p-3 text-left text-xs font-semibold text-subtle-text-color dark:text-dark-subtle-text-color uppercase">Qtd.</th>
                      <th className="p-3 text-left text-xs font-semibold text-subtle-text-color dark:text-dark-subtle-text-color uppercase">✅</th>
                      <th className="p-3 text-left text-xs font-semibold text-subtle-text-color dark:text-dark-subtle-text-color uppercase">❌</th>
                      <th className="p-3 text-left text-xs font-semibold text-subtle-text-color dark:text-dark-subtle-text-color uppercase">%</th>
                  </tr>
              </thead>
              <tbody>
                  {summary.map(item => (
                      <tr key={item.subject} className="border-b border-border-color dark:border-dark-border-color transition-colors hover:bg-background-color dark:hover:bg-dark-background-color">
                          <td className="p-3 align-middle text-sm font-medium text-heading-color dark:text-dark-heading-color">{item.subject}</td>
                          <td className="p-3 align-middle text-sm">{formatDecimalHours(item.hours)}</td>
                          <td className="p-3 align-middle text-sm">{item.questions}</td>
                          <td className="p-3 align-middle text-sm text-success-color">{item.correct}</td>
                          <td className="p-3 align-middle text-sm text-danger-color">{item.wrong}</td>
                          <td className="p-3 align-middle text-sm font-semibold">{item.percentage.toFixed(0)}%</td>
                      </tr>
                  ))}
              </tbody>
          </table>
        </div>
    </div>
  );
};

export default DisciplineSummaryTable;