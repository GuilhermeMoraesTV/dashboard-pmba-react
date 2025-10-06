import React, { useState, useEffect, useRef } from 'react';
import { Chart, registerables } from 'chart.js';
import ChartDataLabels from 'chartjs-plugin-datalabels';
import Legend from './Legend.jsx';

// Registra os componentes do Chart.js
Chart.register(...registerables, ChartDataLabels);

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

function HoursTab({ hoursData, onAddHour, onDeleteHour }) {
  const [subject, setSubject] = useState('Língua Portuguesa');
  const [hours, setHours] = useState('');
  const [minutes, setMinutes] = useState('');
  const [seconds, setSeconds] = useState('');
  const [entryDate, setEntryDate] = useState(dateToYMD_local(new Date()));
  const studyActivities = ["Língua Portuguesa", "Matemática", "Raciocínio Lógico", "História", "Geografia", "Atualidades", "Informática", "Dir. Constitucional", "Direitos Humanos", "Dir. Administrativo", "Dir. Penal", "Igualdade Racial", "Dir. Penal Militar", "Simulado", "Correção de Simulado"];

  const chartRef = useRef(null);
  const chartInstanceRef = useRef(null);

  useEffect(() => {
    if (chartRef.current) {
      if (chartInstanceRef.current) {
        chartInstanceRef.current.destroy();
      }

      if (hoursData.length === 0) {
        return;
      }

      const ctx = chartRef.current.getContext('2d');
      const agg = hoursData.reduce((a, e) => {
        a[e.subject] = (a[e.subject] || 0) + e.hours;
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
  }, [hoursData]);

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
      <section className="chart-section-container card">
           <Legend title="Distribuição de Horas" data={hoursData} dataKey="hours" />
        <div className="chart-wrapper">
          <canvas ref={chartRef}></canvas>
        </div>
      </section>

      <div className="card">
        <h2>Adicionar Horas de Estudo</h2>
        <form onSubmit={handleSubmit} className="form-container" style={{ padding: 0, boxShadow: 'none' }}>
          <div className="form-group fg-grow-2">
            <label htmlFor="h-subject">Disciplina</label>
            <select id="h-subject" value={subject} onChange={(e) => setSubject(e.target.value)}>
              {studyActivities.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div className="form-group fg-grow-2">
            <label>Tempo (H/M/S)</label>
            <div className="input-group">
              <input placeholder="H" type="number" value={hours} onChange={e => setHours(e.target.value)} />
              <input placeholder="M" type="number" value={minutes} onChange={e => setMinutes(e.target.value)} />
              <input placeholder="S" type="number" value={seconds} onChange={e => setSeconds(e.target.value)} />
            </div>
          </div>
          <div className="form-group fg-grow-1">
            <label htmlFor="h-entry-date">Data</label>
            <input type="date" id="h-entry-date" value={entryDate} onChange={e => setEntryDate(e.target.value)} />
          </div>
          <button type="submit" className="btn btn-primary" style={{ height: '48px' }}>Adicionar</button>
        </form>
      </div>

      <h2>Histórico de Horas</h2>
      <table className="history-table">
        <thead>
          <tr>
            <th>Disciplina</th>
            <th>Data</th>
            <th>Tempo</th>
            <th>Ação</th>
          </tr>
        </thead>
        <tbody>
          {hoursData.length === 0 ? (
            <tr><td colSpan="4" style={{ textAlign: 'center' }}>Nenhum registro encontrado.</td></tr>
          ) : (
            [...hoursData].sort((a,b) => new Date(b.date) - new Date(a.date)).map(item => (
              <tr key={item.id || Date.now() + Math.random()}>
                <td>{item.subject}</td>
                <td>{new Date(item.date + 'T03:00:00').toLocaleDateString('pt-BR')}</td>
                <td>{formatDecimalHours(item.hours)}</td>
                <td><button className="btn-delete" data-type="hour" onClick={() => onDeleteHour(item.id)}>❌</button></td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

export default HoursTab;