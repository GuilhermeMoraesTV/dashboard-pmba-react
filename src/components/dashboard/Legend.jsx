import React from 'react';

const colors = ['#3498db','#2ecc71','#9b59b6','#f1c40f','#e74c3c','#34495e','#1abc9c','#e67e22','#7f8c8d','#2980b9','#27ae60','#8e44ad', '#d35400', '#c0392b'];

const formatDecimalHours = (d) => {
    if (!d || d < 0) return '00:00:00';
    const s = Math.round(d * 3600);
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sc = s % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(sc).padStart(2, '0')}`;
};

function Legend({ title, data, dataKey }) {
  if (data.length === 0) {
    return (
        <div className="legend-container">
            <h2>{title}</h2>
            <p>Sem dados no período.</p>
        </div>
    );
  }

  const getLegendTable = () => {
    if (dataKey === 'questions') {
      const fullStats = data.reduce((a, { subject, questions, correct }) => {
        a[subject] = a[subject] || { q: 0, c: 0 };
        a[subject].q += questions;
        a[subject].c += correct;
        return a;
      }, {});

      const sortedSubjects = Object.keys(fullStats).sort((a, b) => fullStats[b].q - fullStats[a].q);

      const totalStatsAll = data.reduce((a, { questions, correct }) => {
        a.q += questions;
        a.c += correct;
        return a;
      }, { q: 0, c: 0 });

      const totalWAll = totalStatsAll.q - totalStatsAll.c;
      const totalPAll = totalStatsAll.q > 0 ? (totalStatsAll.c / totalStatsAll.q) * 100 : 0;

      return (
        <table className="legend-table" style={{ width: '100%' }}>
          <tbody>
            {sortedSubjects.map((subject, i) => {
              const s = fullStats[subject];
              const w = s.q - s.c;
              const p = s.q > 0 ? (s.c / s.q) * 100 : 0;
              return (
                <tr key={subject}>
                  <td>
                    <span style={{ backgroundColor: colors[i % colors.length], display: 'inline-block', width: '12px', height: '12px', borderRadius: '3px', marginRight: '8px' }}></span>
                    {subject}
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <b>{p.toFixed(1)}%</b><br />
                    <small>Q:{s.q} | C:{s.c} | E:{w}</small>
                  </td>
                </tr>
              );
            })}
            <tr className="total-row" style={{ borderTop: '2px solid var(--border-color)' }}>
              <td style={{ paddingTop: '8px' }}><b>Total</b></td>
              <td style={{ textAlign: 'right', paddingTop: '8px' }}>
                <b>{totalPAll.toFixed(1)}%</b><br />
                <small>Q:{totalStatsAll.q} | C:{totalStatsAll.c} | E:{totalWAll}</small>
              </td>
            </tr>
          </tbody>
        </table>
      );
    }

    if (dataKey === 'hours') {
      const agg = data.reduce((a, e) => {
        a[e.subject] = (a[e.subject] || 0) + e.hours;
        return a;
      }, {});

      const sortedData = Object.entries(agg).map(([subject, value]) => ({ subject, value })).sort((a,b) => b.value - a.value);
      const total = sortedData.reduce((s, v) => s + v.value, 0);

      return (
        <table className="legend-table" style={{ width: '100%' }}>
            <tbody>
                {sortedData.map((item, i) => {
                    const percentage = total > 0 ? (item.value / total * 100).toFixed(1) : 0;
                    return (
                        <tr key={item.subject}>
                            <td>
                                <span style={{ backgroundColor: colors[i % colors.length], display: 'inline-block', width: '12px', height: '12px', borderRadius: '3px', marginRight: '8px' }}></span>
                                {item.subject}
                            </td>
                            <td style={{ textAlign: 'right' }}>
                                <b>{formatDecimalHours(item.value)}</b><br />
                                <small>{percentage}% do total</small>
                            </td>
                        </tr>
                    );
                })}
                <tr className="total-row" style={{ borderTop: '2px solid var(--border-color)' }}>
                    <td style={{ paddingTop: '8px' }}><b>Total</b></td>
                    <td style={{ textAlign: 'right', paddingTop: '8px' }}><b>{formatDecimalHours(total)}</b></td>
                </tr>
            </tbody>
        </table>
      );
    }

    return null;
  };

  return (
    <div className="legend-container">
      <h2>{title}</h2>
      {getLegendTable()}
    </div>
  );
}

export default Legend;