import React, { useMemo } from 'react';

const formatDecimalHours = (d) => {
    if (!d || d < 0) return '00h 00m';
    const totalMinutes = Math.round(d * 60);
    const h = Math.floor(totalMinutes / 60);
    const m = totalMinutes % 60;
    return `${String(h).padStart(2, '0')}h ${String(m).padStart(2, '0')}m`;
};

const colors = ['#3498db','#2ecc71','#9b59b6','#f1c40f','#e74c3c','#34495e','#1abc9c','#e67e22','#7f8c8d','#2980b9','#27ae60','#8e44ad', '#d35400', '#c0392b'];

function Legend({ title, data, dataKey }) {
  const legendData = useMemo(() => {
    const agg = data.reduce((a, e) => {
      a[e.subject] = (a[e.subject] || 0) + e[dataKey];
      return a;
    }, {});

    const total = Object.values(agg).reduce((s, v) => s + v, 0);

    return Object.entries(agg)
      .map(([subject, value], index) => ({
        subject,
        value,
        percentage: total > 0 ? (value / total) * 100 : 0,
        color: colors[index % colors.length],
      }))
      .sort((a, b) => b.value - a.value);
  }, [data, dataKey]);

  const formatter = dataKey === 'hours' ? formatDecimalHours : (v) => v;

  return (
    // TRADUÇÃO de .legend-container
    <div className="w-full">
      <h3 className="text-lg font-bold text-heading-color dark:text-dark-heading-color mb-3 mt-0">
        {title}
      </h3>

      {/* TRADUÇÃO de .legend-table */}
      <table className="w-full border-collapse">
        <tbody>
          {legendData.map((item) => (
            <tr key={item.subject} className="border-b border-border-color dark:border-dark-border-color text-sm">
              <td className="p-2 align-middle">
                <span
                  className="inline-block w-3 h-3 rounded-full mr-2"
                  style={{ backgroundColor: item.color }}
                ></span>
                {item.subject}
              </td>
              <td className="p-2 align-middle text-right font-semibold text-text-color dark:text-dark-text-color">
                {formatter(item.value)}
              </td>
              <td className="p-2 align-middle text-right w-16 text-subtle-text-color dark:text-dark-subtle-text-color">
                {item.percentage.toFixed(0)}%
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default Legend;