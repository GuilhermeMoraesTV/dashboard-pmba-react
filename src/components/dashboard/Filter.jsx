import React from 'react';

const Filter = ({ activeFilter, setFilter }) => {
  const filters = [
    { key: 'all', label: 'Tudo' },
    { key: 'today', label: 'Hoje' },
    { key: 'weekly', label: 'Semanal' },
    { key: 'monthly', label: 'Mensal' },
    // O filtro 'custom' pode ser adicionado depois
  ];

  return (
    <section className="filter-container">
      <div className="filter-options">
        {filters.map(f => (
          <button
            key={f.key}
            className={`btn-filter ${activeFilter === f.key ? 'active' : ''}`}
            onClick={() => setFilter(f.key)}
          >
            {f.label}
          </button>
        ))}
      </div>
    </section>
  );
};

export default Filter;