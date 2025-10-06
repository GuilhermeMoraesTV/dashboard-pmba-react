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
    <div className="home-card grid-col-span-3">
        <h2>Painel de Disciplinas</h2>
        <table className="discipline-summary-table">
            <thead>
                <tr>
                    <th>Disciplinas</th>
                    <th>Tempo</th>
                    <th>Qtd.</th>
                    <th>✅</th>
                    <th>❌</th>
                    <th>%</th>
                </tr>
            </thead>
            <tbody>
                {summary.map(item => (
                    <tr key={item.subject}>
                        <td>{item.subject}</td>
                        <td>{formatDecimalHours(item.hours)}</td>
                        <td>{item.questions}</td>
                        <td style={{color: 'var(--success-color)'}}>{item.correct}</td>
                        <td style={{color: 'var(--danger-color)'}}>{item.wrong}</td>
                        <td style={{fontWeight: 600}}>{item.percentage.toFixed(0)}%</td>
                    </tr>
                ))}
            </tbody>
        </table>
    </div>
  );
};

export default DisciplineSummaryTable;