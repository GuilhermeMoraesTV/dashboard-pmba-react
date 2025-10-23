import React from 'react';

const Filter = ({ activeFilter, setFilter }) => {
  const filters = [
    { key: 'all', label: 'Tudo' },
    { key: 'today', label: 'Hoje' },
    { key: 'weekly', label: 'Semanal' },
    { key: 'monthly', label: 'Mensal' },
  ];

  return (
    // TRADUÇÃO de .filter-container e .filter-options
    <section className="mb-6">
      <div className="flex flex-wrap gap-2">
        {filters.map(f => (
          <button
            key={f.key}
            // TRADUÇÃO de .btn-filter e .active
            className={`
              py-2 px-4 rounded-lg font-semibold text-sm border
              transition-all duration-200
              ${activeFilter === f.key
                ? 'bg-primary-color text-white border-primary-color' // Estado Ativo
                : 'bg-card-background-color dark:bg-dark-card-background-color \
                   border-border-color dark:border-dark-border-color \
                   text-text-color dark:text-dark-text-color \
                   hover:bg-background-color dark:hover:bg-dark-background-color \
                   hover:border-primary-color dark:hover:border-primary-color' // Estado Padrão
              }
            `}
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