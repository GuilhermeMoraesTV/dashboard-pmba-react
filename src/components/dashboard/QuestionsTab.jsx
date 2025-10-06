import React, { useState, useEffect, useRef } from 'react';
import { Chart, registerables } from 'chart.js';
import ChartDataLabels from 'chartjs-plugin-datalabels';
import Legend from './Legend.jsx';

// Registra os componentes do Chart.js para que ele funcione
Chart.register(...registerables, ChartDataLabels);

const dateToYMD_local = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

const getPColor = (p) => {
    if (p > 88) return 'var(--excellent-color)';
    if (p >= 80) return 'var(--success-color)';
    if (p >= 60) return 'var(--warning-color)';
    return 'var(--danger-color)';
};

function QuestionsTab({ questionsData, onAddQuestion, onDeleteQuestion }) {
  const [subject, setSubject] = useState('Língua Portuguesa');
  const [questionsDone, setQuestionsDone] = useState('');
  const [questionsCorrect, setQuestionsCorrect] = useState('');
  const [entryDate, setEntryDate] = useState(dateToYMD_local(new Date()));
  const subjects = ["Língua Portuguesa", "Matemática", "Raciocínio Lógico", "História", "Geografia", "Atualidades", "Informática", "Dir. Constitucional", "Direitos Humanos", "Dir. Administrativo", "Dir. Penal", "Igualdade Racial", "Dir. Penal Militar"];

  const chartRef = useRef(null);
  const chartInstanceRef = useRef(null);

  useEffect(() => {
    if (chartRef.current) {
      if (chartInstanceRef.current) {
        chartInstanceRef.current.destroy();
      }

      if (questionsData.length === 0) {
        // Se não houver dados, não desenha o gráfico
        return;
      }

      const ctx = chartRef.current.getContext('2d');
      const agg = questionsData.reduce((a, e) => {
        a[e.subject] = (a[e.subject] || 0) + e.questions;
        return a;
      }, {});

      const sortedData = Object.entries(agg).map(([subject, value]) => ({ subject, value })).sort((a,b) => b.value - a.value);
      const labels = sortedData.map(d => d.subject);
      const data = sortedData.map(d => d.value);
      const total = data.reduce((s, v) => s + v, 0);

      chartInstanceRef.current = new Chart(ctx, { // Não usamos mais 'window.Chart'
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
      <section className="chart-section-container card" style={{ marginTop: '24px' }}>
          <Legend title="Distribuição de Questões" data={questionsData} dataKey="questions" />
        <div className="chart-wrapper">
          <canvas ref={chartRef}></canvas>
        </div>
      </section>

      <h2>Adicionar Registro de Questões</h2>
      <form onSubmit={handleSubmit} className="form-container">
        <div className="form-group fg-grow-2">
            <label htmlFor="q-subject">Disciplina</label>
            <select id="q-subject" value={subject} onChange={(e) => setSubject(e.target.value)}>
                {subjects.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
        </div>
        <div className="form-group fg-grow-1">
            <label>Questões/Acertos</label>
            <div className="input-group">
                <input type="number" placeholder="Fiz" value={questionsDone} onChange={(e) => setQuestionsDone(e.target.value)} />
                <input type="number" placeholder="Acertei" value={questionsCorrect} onChange={(e) => setQuestionsCorrect(e.target.value)} />
            </div>
        </div>
        <div className="form-group fg-grow-1">
            <label htmlFor="q-entry-date">Data</label>
            <input type="date" id="q-entry-date" value={entryDate} onChange={(e) => setEntryDate(e.target.value)} />
        </div>
        <button type="submit" className="btn btn-primary" style={{ height: '48px' }}>Adicionar</button>
      </form>

      <h2 id="questions-table-title">Painel de Questões</h2>
      <table className="history-table">
        <thead>
          <tr>
            <th>Disciplina</th>
            <th>Data</th>
            <th>Questões</th>
            <th>Acertos</th>
            <th>Desempenho</th>
            <th>Ação</th>
          </tr>
        </thead>
        <tbody>
          {questionsData.length === 0 ? (
            <tr><td colSpan="6" style={{ textAlign: 'center' }}>Nenhum registro encontrado.</td></tr>
          ) : (
            [...questionsData].sort((a,b) => new Date(b.date) - new Date(a.date)).map(item => {
              const performance = item.questions > 0 ? (item.correct / item.questions) * 100 : 0;
              return (
                <tr key={item.id || Date.now() + Math.random()}>
                  <td>{item.subject}</td>
                  <td>{new Date(item.date + 'T03:00:00').toLocaleDateString('pt-BR')}</td>
                  <td>{item.questions}</td>
                  <td>{item.correct}</td>
                  <td style={{ fontWeight: 600, color: getPColor(performance) }}>
                    {performance.toFixed(1)}%
                  </td>
                  <td><button className="btn-delete" data-type="question"  onClick={() => onDeleteQuestion(item.id)}>❌</button></td>
                </tr>
              )
            })
          )}
        </tbody>
      </table>
    </div>
  );
}

export default QuestionsTab;