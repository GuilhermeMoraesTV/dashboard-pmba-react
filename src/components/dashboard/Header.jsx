import React from 'react';

// --- Ícones para o botão de Tema ---
const IconSun = () => (
  <svg id="theme-icon-sun" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
    <path d="M12 7c-2.76 0-5 2.24-5 5s2.24 5 5 5 5-2.24 5-5-2.24-5-5-5zM2 13h2c.55 0 1-.45 1-1s-.45-1-1-1H2c-.55 0-1 .45-1 1s.45 1 1 1zm18 0h2c.55 0 1-.45 1-1s-.45-1-1-1h-2c-.55 0-1 .45-1 1s.45 1 1 1zM11 2v2c0 .55.45 1 1 1s1-.45 1-1V2c0-.55-.45-1-1-1s-1 .45-1 1zm0 18v2c0 .55.45 1 1 1s1-.45 1-1v-2c0-.55-.45-1-1-1s-1 .45-1 1zM5.64 5.64c-.39-.39-1.02-.39-1.41 0-.39.39-.39 1.02 0 1.41l1.06 1.06c.39.39 1.02.39 1.41 0s.39-1.02 0-1.41L5.64 5.64zm12.72 12.72c-.39-.39-1.02-.39-1.41 0-.39.39-.39 1.02 0 1.41l1.06 1.06c.39.39 1.02.39 1.41 0s.39-1.02 0-1.41l-1.06-1.06zM5.64 18.36l-1.06-1.06c-.39-.39-.39-1.02 0-1.41s1.02-.39 1.41 0l1.06 1.06c.39.39.39 1.02 0 1.41s-1.02.39-1.41 0zm12.72-12.72l-1.06-1.06c-.39-.39-.39-1.02 0-1.41s1.02-.39 1.41 0l1.06 1.06c.39.39.39 1.02 0 1.41s-1.02.39-1.41 0z"></path>
  </svg>
);

const IconMoon = () => (
  <svg id="theme-icon-moon" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
    <path d="M9.37 5.51A7.35 7.35 0 0 0 9.1 7.5c0 4.08 3.32 7.4 7.4 7.4.68 0 1.35-.09 1.99-.27C17.45 17.19 14.93 19 12 19c-3.86 0-7-3.14-7-7 0-2.93 1.81-5.45 4.37-6.49z"></path>
  </svg>
);
// ------------------------------------

// Mapeia os IDs das abas para títulos amigáveis
const tabTitles = {
  home: 'Dashboard de Performance',
  questions: 'Registros de Questões',
  hours: 'Registros de Horas',
  goals: 'Minhas Metas',
  calendar: 'Calendário de Estudos',
};

const Header = ({ activeTab, isDarkMode, toggleTheme, userEmail }) => {
  const title = tabTitles[activeTab] || 'Dashboard';

  return (
    // TRADUÇÃO de .header:
    // - display: flex -> flex
    // - justify-content, align-items, margin-bottom, padding-bottom, border-bottom -> ...
    // - Responsividade: flex-col (mobile) md:flex-row (tablet+)
    // - Responsividade: items-start (mobile) md:items-center (tablet+)
    <header className="flex flex-col md:flex-row justify-between items-start md:items-center
                       mb-8 pb-4 border-b-2 border-border-color dark:border-dark-border-color
                       relative" // Posição relativa para o botão de tema no mobile
    >
      {/* TRADUÇÃO de .header-content */}
      <div>
        <h1 className="m-0 text-2xl md:text-3xl font-bold text-heading-color dark:text-dark-heading-color">
          {title}
        </h1>
        <p className="mt-1 mb-0 text-sm md:text-base text-subtle-text-color dark:text-dark-subtle-text-color">
          {userEmail}
        </p>
      </div>

      {/* TRADUÇÃO de #theme-toggle */}
      <button
        id="theme-toggle"
        title="Alterar tema"
        onClick={toggleTheme}
        className="
          bg-card-background-color dark:bg-dark-card-background-color
          border border-border-color dark:border-dark-border-color
          text-text-color dark:text-dark-text-color
          rounded-full w-10 h-10 flex items-center justify-center cursor-pointer
          transition-colors duration-200 hover:bg-background-color dark:hover:bg-dark-background-color

          absolute top-0 right-0 mt-0 md:static md:mt-0" // Posicionamento responsivo
      >
        <span className={isDarkMode ? 'hidden' : 'block'}>
          <IconSun />
        </span>
        <span className={isDarkMode ? 'block' : 'hidden'}>
          <IconMoon />
        </span>
      </button>
    </header>
  );
};

export default Header;