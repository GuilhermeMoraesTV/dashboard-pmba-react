import React, { useState, useEffect, useRef } from 'react';
import { Chart, registerables } from 'chart.js';
import ChartDataLabels from 'chartjs-plugin-datalabels';
import Legend from './Legend.jsx'; // Este componente também precisará ser traduzido

// Registra os componentes do Chart.js
Chart.register(...registerables, ChartDataLabels);

// --- Funções Helper ---
const dateToYMD_local = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

// ATUALIZADO: Retorna a classe do Tailwind
const getPColorClass = (p) => {
    if (p > 88) return 'text-excellent-color';
    if (p >= 80) return 'text-success-color';
    if (p >= 60) return 'text-warning-color';
    return 'text-danger-color';
};
// ----------------------

function QuestionsTab({ questionsData, onAddQuestion, onDeleteQuestion }) {
  const [subject, setSubject] = useState('Língua Portuguesa');
  const [questionsDone, setQuestionsDone] = useState('');
  const [questionsCorrect, setQuestionsCorrect] = useState('');
  const [entryDate, setEntryDate] = useState(dateToYMD_local(new Date()));
  const subjects = ["Língua Portuguesa", "Matemática", "Raciocínio Lógico", "História", "Geografia", "Atualidades", "Informática", "Dir. Constitucional", "Direitos Humanos", "Dir. Administrativo", "Dir. Penal", "Igualdade Racial", "Dir. Penal Militar"];

  const chartRef = useRef(null);
  const chartInstanceRef = useRef(null);

  // Lógica do Gráfico (sem alteração)
  useEffect(() => {
    if (chartRef.current) {
      if (chartInstanceRef.current) {
        chartInstanceRef.current.destroy();
      }
      if (questionsData.length === 0) { return; }

      const ctx = chartRef.current.getContext('2d');
      const agg = questionsData.reduce((a, e) => {
        a[e.subject] = (a[e.subject] || 0) + e.questions;
        return a;
      }, {});

      const sortedData = Object.entries(agg).map(([subject, value]) => ({ subject, value })).sort((a,b) => b.value - a.value);
      const labels = sortedData.map(d => d.subject);
      const data = sortedData.map(d => d.value);
      const total = data.reduce((s, v) => s + v, 0);

      chartInstanceRef.current = new Chart(ctx, {
        type: 'pie',
        data: {
          labels: labels,
          datasets: [{
            data: data,
            backgroundColor: ['#3498db','#2ecc71','#9b59b6','#f1c40f','#e74c3c','#34495e','#1abc9c','#e67e22','#7f8c8d','#2980b9','#27ae60','#8e44ad', '#d35400', '#c0392b'],
            borderWidth: 0,
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            datalabels: {
              color: '#fff',
              font: { weight: '600' },
              formatter: (v) => total > 0 ? `${((v / total) * 100).toFixed(0)}%` : ''
            }
          }
        }
      });
    }
  }, [questionsData]);

  // Lógica de Submit (sem alteração)
  const handleSubmit = (e) => {
    e.preventDefault();
    const q = parseInt(questionsDone);
    const c = parseInt(questionsCorrect);

    if(!q || q <= 0 || isNaN(c) || c < 0 || !entryDate){ alert('Campos inválidos.'); return; }
    if(c > q){ alert('O número de acertos não pode ser maior que o de questões.'); return; }

    const newQuestion = { subject, questions: q, correct: c, date: entryDate };
    onAddQuestion(newQuestion);
    setQuestionsDone('');
    setQuestionsCorrect('');
  };

  return (
    <div>
      {/* TRADUÇÃO de .chart-section-container .card */}
      <section className="bg-card-background-color dark:bg-dark-card-background-color rounded-xl shadow-card-shadow p-4 md:p-6 mt-6
                          flex flex-col md:flex-row items-start gap-6">
          {/* Legend.jsx (assumindo que será traduzido) */}
          <div className="flex-1 w-full min-w-[280px]">
            <Legend title="Distribuição de Questões" data={questionsData} dataKey="questions" />
          </div>
        {/* TRADUÇÃO de .chart-wrapper */}
        <div className="flex-2 min-w-[300px] max-w-md mx-auto w-full h-[400px] relative">
          <canvas ref={chartRef}></canvas>
        </div>
      </section>

      {/* TRADUÇÃO de h2 */}
      <h2 className="text-xl font-bold text-heading-color dark:text-dark-heading-color mt-8 mb-4 border-b-2 border-border-color dark:border-dark-border-color pb-2">
        Adicionar Registro de Questões
      </h2>

      {/* TRADUÇÃO de .form-container */}
      <form onSubmit={handleSubmit} className="flex flex-col md:flex-row flex-wrap items-end gap-4">
        {/* TRADUÇÃO de .form-group .fg-grow-2 */}
        <div className="flex flex-col flex-grow w-full md:w-auto md:flex-[2] min-w-[180px]">
            <label htmlFor="q-subject" className="block mb-2 font-semibold text-sm text-text-color dark:text-dark-text-color">Disciplina</label>
            <select id="q-subject" value={subject} onChange={(e) => setSubject(e.target.value)}
              className="w-full p-3 border border-border-color dark:border-dark-border-color rounded-lg bg-background-color dark:bg-dark-background-color text-text-color dark:text-dark-text-color text-base
                         focus:outline-none focus:ring-2 focus:ring-primary-color"
            >
                {subjects.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
        </div>
        {/* TRADUÇÃO de .form-group .fg-grow-1 e .input-group */}
        <div className="flex flex-col flex-grow w-full md:w-auto md:flex-[1] min-w-[120px]">
            <label className="block mb-2 font-semibold text-sm text-text-color dark:text-dark-text-color">Questões/Acertos</label>
            <div className="flex gap-2">
                <input type="number" placeholder="Fiz" value={questionsDone} onChange={(e) => setQuestionsDone(e.target.value)}
                  className="w-full p-3 border border-border-color dark:border-dark-border-color rounded-lg bg-background-color dark:bg-dark-background-color text-text-color dark:text-dark-text-color text-base
                             focus:outline-none focus:ring-2 focus:ring-primary-color"
                />
                <input type="number" placeholder="Acertei" value={questionsCorrect} onChange={(e) => setQuestionsCorrect(e.target.value)}
                  className="w-full p-3 border border-border-color dark:border-dark-border-color rounded-lg bg-background-color dark:bg-dark-background-color text-text-color dark:text-dark-text-color text-base
                             focus:outline-none focus:ring-2 focus:ring-primary-color"
                />
            </div>
        </div>
        <div className="flex flex-col flex-grow w-full md:w-auto md:flex-[1] min-w-[120px]">
            <label htmlFor="q-entry-date" className="block mb-2 font-semibold text-sm text-text-color dark:text-dark-text-color">Data</label>
            <input type="date" id="q-entry-date" value={entryDate} onChange={(e) => setEntryDate(e.target.value)}
              className="w-full p-3 border border-border-color dark:border-dark-border-color rounded-lg bg-background-color dark:bg-dark-background-color text-text-color dark:text-dark-text-color text-base
                         focus:outline-none focus:ring-2 focus:ring-primary-color"
            />
        </div>
        {/* TRADUÇÃO de .btn .btn-primary */}
        <button type="submit"
          className="w-full md:w-auto p-3 h-12 border-none rounded-lg cursor-pointer font-semibold text-base
                     transition-opacity duration-200 transform active:scale-[0.98]
                     bg-primary-color text-white hover:opacity-90"
        >
          Adicionar
        </button>
      </form>

      <h2 className="text-xl font-bold text-heading-color dark:text-dark-heading-color mt-8 mb-4 border-b-2 border-border-color dark:border-dark-border-color pb-2">
        Painel de Questões
      </h2>

      {/* TRADUÇÃO de .history-table */}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse min-w-[700px]">
          <thead>
            <tr className="border-b-2 border-border-color dark:border-dark-border-color">
              <th className="p-3 text-left text-xs font-semibold text-subtle-text-color dark:text-dark-subtle-text-color uppercase">Disciplina</th>
              <th className="p-3 text-left text-xs font-semibold text-subtle-text-color dark:text-dark-subtle-text-color uppercase">Data</th>
              <th className="p-3 text-left text-xs font-semibold text-subtle-text-color dark:text-dark-subtle-text-color uppercase">Questões</th>
              <th className="p-3 text-left text-xs font-semibold text-subtle-text-color dark:text-dark-subtle-text-color uppercase">Acertos</th>
              <th className="p-3 text-left text-xs font-semibold text-subtle-text-color dark:text-dark-subtle-text-color uppercase">Desempenho</th>
              <th className="p-3 text-left text-xs font-semibold text-subtle-text-color dark:text-dark-subtle-text-color uppercase">Ação</th>
            </tr>
          </thead>
          <tbody>
            {questionsData.length === 0 ? (
              <tr><td colSpan="6" className="p-3 text-center text-subtle-text-color dark:text-dark-subtle-text-color">Nenhum registro encontrado.</td></tr>
            ) : (
              [...questionsData].sort((a,b) => new Date(b.date) - new Date(a.date)).map(item => {
                const performance = item.questions > 0 ? (item.correct / item.questions) * 100 : 0;
                return (
                  <tr key={item.id || Date.now() + Math.random()} className="border-b border-border-color dark:border-dark-border-color transition-colors hover:bg-background-color dark:hover:bg-dark-background-color">
                    <td className="p-3 align-middle text-sm">{item.subject}</td>
                    <td className="p-3 align-middle text-sm">{new Date(item.date + 'T03:00:00').toLocaleDateString('pt-BR')}</td>
                    <td className="p-3 align-middle text-sm">{item.questions}</td>
                    <td className="p-3 align-middle text-sm">{item.correct}</td>
                    <td className={`p-3 align-middle text-sm font-semibold ${getPColorClass(performance)}`}>
                      {performance.toFixed(1)}%
                    </td>
                    <td>
                      {/* TRADUÇÃO de .btn-delete */}
                      <button
                        className="bg-transparent border-none text-subtle-text-color dark:text-dark-subtle-text-color cursor-pointer text-lg p-2 transition-colors hover:text-danger-color"
                        onClick={() => onDeleteQuestion(item.id)}
                      >
                        ❌
                      </button>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default QuestionsTab;