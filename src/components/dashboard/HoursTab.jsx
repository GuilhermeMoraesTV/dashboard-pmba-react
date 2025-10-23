import React, { useState, useEffect, useRef } from 'react';
import { Chart, registerables } from 'chart.js';
import ChartDataLabels from 'chartjs-plugin-datalabels';
import Legend from './Legend.jsx';

// Registra os componentes do Chart.js
Chart.register(...registerables, ChartDataLabels);

// --- Funções Helper ---
const dateToYMD_local = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

const formatDecimalHours = (d) => {
    if (!d || d < 0) return '00:00:00';
    const s = Math.round(d * 3600);
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sc = s % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(sc).padStart(2, '0')}`;
};
// ----------------------

function HoursTab({ hoursData, onAddHour, onDeleteHour }) {
  const [subject, setSubject] = useState('Língua Portuguesa');
  const [hours, setHours] = useState('');
  const [minutes, setMinutes] = useState('');
  const [seconds, setSeconds] = useState('');
  const [entryDate, setEntryDate] = useState(dateToYMD_local(new Date()));
  const studyActivities = ["Língua Portuguesa", "Matemática", "Raciocínio Lógico", "História", "Geografia", "Atualidades", "Informática", "Dir. Constitucional", "Direitos Humanos", "Dir. Administrativo", "Dir. Penal", "Igualdade Racial", "Dir. Penal Militar", "Simulado", "Correção de Simulado"];

  const chartRef = useRef(null);
  const chartInstanceRef = useRef(null);

  // Lógica do Gráfico (sem alteração)
  useEffect(() => {
    if (chartRef.current) {
      if (chartInstanceRef.current) {
        chartInstanceRef.current.destroy();
      }
      if (hoursData.length === 0) { return; }

      const ctx = chartRef.current.getContext('2d');
      const agg = hoursData.reduce((a, e) => {
        a[e.subject] = (a[e.subject] || 0) + e.hours;
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
  }, [hoursData]);

  // Lógica de Submit (sem alteração)
  const handleSubmit = (e) => {
    e.preventDefault();
    const h = parseInt(hours) || 0;
    const m = parseInt(minutes) || 0;
    const s = parseInt(seconds) || 0;

    if ((h + m + s) <= 0 || !entryDate) { alert('Tempo ou data inválidos.'); return; }

    const newHour = { subject, hours: h + (m / 60) + (s / 3600), date: entryDate };
    onAddHour(newHour);
    setHours('');
    setMinutes('');
    setSeconds('');
  };

  return (
    <div>
      {/* TRADUÇÃO de .chart-section-container .card */}
      <section className="bg-card-background-color dark:bg-dark-card-background-color rounded-xl shadow-card-shadow p-4 md:p-6 mt-6
                          flex flex-col md:flex-row items-start gap-6">
          <div className="flex-1 w-full min-w-[280px]">
            <Legend title="Distribuição de Horas" data={hoursData} dataKey="hours" />
          </div>
        <div className="flex-2 min-w-[300px] max-w-md mx-auto w-full h-[400px] relative">
          <canvas ref={chartRef}></canvas>
        </div>
      </section>

      {/* TRADUÇÃO de .card */}
      <div className="bg-card-background-color dark:bg-dark-card-background-color rounded-xl shadow-card-shadow p-4 md:p-6 mt-8">
        <h2 className="text-xl font-bold text-heading-color dark:text-dark-heading-color mt-0 mb-4 border-none">
          Adicionar Horas de Estudo
        </h2>

        {/* TRADUÇÃO de .form-container */}
        <form onSubmit={handleSubmit} className="flex flex-col md:flex-row flex-wrap items-end gap-4">
          <div className="flex flex-col flex-grow w-full md:w-auto md:flex-[2] min-w-[180px]">
            <label htmlFor="h-subject" className="block mb-2 font-semibold text-sm text-text-color dark:text-dark-text-color">Disciplina</label>
            <select id="h-subject" value={subject} onChange={(e) => setSubject(e.target.value)}
              className="w-full p-3 border border-border-color dark:border-dark-border-color rounded-lg bg-background-color dark:bg-dark-background-color text-text-color dark:text-dark-text-color text-base
                         focus:outline-none focus:ring-2 focus:ring-primary-color"
            >
              {studyActivities.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          {/* TRADUÇÃO de .form-group .fg-grow-2 e .input-group */}
          <div className="flex flex-col flex-grow w-full md:w-auto md:flex-[2] min-w-[180px]">
            <label className="block mb-2 font-semibold text-sm text-text-color dark:text-dark-text-color">Tempo (H/M/S)</label>
            <div className="flex gap-2">
              <input placeholder="H" type="number" value={hours} onChange={e => setHours(e.target.value)}
                className="w-full p-3 border border-border-color dark:border-dark-border-color rounded-lg bg-background-color dark:bg-dark-background-color text-text-color dark:text-dark-text-color text-base
                           focus:outline-none focus:ring-2 focus:ring-primary-color"
              />
              <input placeholder="M" type="number" value={minutes} onChange={e => setMinutes(e.target.value)}
                className="w-full p-3 border border-border-color dark:border-dark-border-color rounded-lg bg-background-color dark:bg-dark-background-color text-text-color dark:text-dark-text-color text-base
                           focus:outline-none focus:ring-2 focus:ring-primary-color"
              />
              <input placeholder="S" type="number" value={seconds} onChange={e => setSeconds(e.target.value)}
                className="w-full p-3 border border-border-color dark:border-dark-border-color rounded-lg bg-background-color dark:bg-dark-background-color text-text-color dark:text-dark-text-color text-base
                           focus:outline-none focus:ring-2 focus:ring-primary-color"
              />
            </div>
          </div>
          <div className="flex flex-col flex-grow w-full md:w-auto md:flex-[1] min-w-[120px]">
            <label htmlFor="h-entry-date" className="block mb-2 font-semibold text-sm text-text-color dark:text-dark-text-color">Data</label>
            <input type="date" id="h-entry-date" value={entryDate} onChange={e => setEntryDate(e.target.value)}
              className="w-full p-3 border border-border-color dark:border-dark-border-color rounded-lg bg-background-color dark:bg-dark-background-color text-text-color dark:text-dark-text-color text-base
                         focus:outline-none focus:ring-2 focus:ring-primary-color"
            />
          </div>
          <button type="submit"
            className="w-full md:w-auto p-3 h-12 border-none rounded-lg cursor-pointer font-semibold text-base
                       transition-opacity duration-200 transform active:scale-[0.98]
                       bg-primary-color text-white hover:opacity-90"
          >
            Adicionar
          </button>
        </form>
      </div>

      <h2 className="text-xl font-bold text-heading-color dark:text-dark-heading-color mt-8 mb-4 border-b-2 border-border-color dark:border-dark-border-color pb-2">
        Histórico de Horas
      </h2>

      {/* TRADUÇÃO de .history-table */}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse min-w-[600px]">
          <thead>
            <tr className="border-b-2 border-border-color dark:border-dark-border-color">
              <th className="p-3 text-left text-xs font-semibold text-subtle-text-color dark:text-dark-subtle-text-color uppercase">Disciplina</th>
              <th className="p-3 text-left text-xs font-semibold text-subtle-text-color dark:text-dark-subtle-text-color uppercase">Data</th>
              <th className="p-3 text-left text-xs font-semibold text-subtle-text-color dark:text-dark-subtle-text-color uppercase">Tempo</th>
              <th className="p-3 text-left text-xs font-semibold text-subtle-text-color dark:text-dark-subtle-text-color uppercase">Ação</th>
            </tr>
          </thead>
          <tbody>
            {hoursData.length === 0 ? (
              <tr><td colSpan="4" className="p-3 text-center text-subtle-text-color dark:text-dark-subtle-text-color">Nenhum registro encontrado.</td></tr>
            ) : (
              [...hoursData].sort((a,b) => new Date(b.date) - new Date(a.date)).map(item => (
                <tr key={item.id || Date.now() + Math.random()} className="border-b border-border-color dark:border-dark-border-color transition-colors hover:bg-background-color dark:hover:bg-dark-background-color">
                  <td className="p-3 align-middle text-sm">{item.subject}</td>
                  <td className="p-3 align-middle text-sm">{new Date(item.date + 'T03:00:00').toLocaleDateString('pt-BR')}</td>
                  <td className="p-3 align-middle text-sm">{formatDecimalHours(item.hours)}</td>
                  <td>
                    <button
                      className="bg-transparent border-none text-subtle-text-color dark:text-dark-subtle-text-color cursor-pointer text-lg p-2 transition-colors hover:text-danger-color"
                      onClick={() => onDeleteHour(item.id)}
                    >
                      ❌
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default HoursTab;