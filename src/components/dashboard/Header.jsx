import React from 'react';
import { Sun, Moon } from 'lucide-react';

function Header({ activeTab, isDarkMode, toggleTheme }) {
  const getTabTitle = () => {
    const tabNames = {
      home: 'Dashboard',
      goals: 'Metas de Estudo',
      calendar: 'Calendário',
      ciclos: 'Ciclos de Estudo',
      profile: 'Perfil',
      historico: 'Histórico'
    };
    return tabNames[activeTab] || 'Dashboard';
  };

  return (
    <div className="flex items-center justify-between mb-5 pb-3 border-b-2 border-border-light dark:border-border-dark relative z-10">
      <div>
        <h1 className="text-xl md:text-2xl font-bold text-zinc-800 dark:text-white">
          {getTabTitle()}
        </h1>
      </div>

      <button
        onClick={toggleTheme}
        className="group relative p-2.5 rounded-xl bg-zinc-300 dark:bg-zinc-700 hover:bg-zinc-400 dark:hover:bg-zinc-600 border border-zinc-400 dark:border-zinc-600 transition-all duration-300 shadow-sm hover:shadow-md"
        title={isDarkMode ? 'Ativar modo claro' : 'Ativar modo escuro'}
      >
        <div className="relative w-5 h-5">
          <Sun
            size={20}
            className={`absolute inset-0 text-zinc-700 transition-all duration-300 ${
              isDarkMode ? 'opacity-0 rotate-90 scale-0' : 'opacity-100 rotate-0 scale-100'
            }`}
          />
          <Moon
            size={20}
            className={`absolute inset-0 text-zinc-200 transition-all duration-300 ${
              isDarkMode ? 'opacity-100 rotate-0 scale-100' : 'opacity-0 -rotate-90 scale-0'
            }`}
          />
        </div>

        <span className="absolute -bottom-8 left-1/2 -translate-x-1/2 px-2 py-1 bg-zinc-800 dark:bg-zinc-200 text-white dark:text-zinc-800 text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
          {isDarkMode ? 'Modo Claro' : 'Modo Escuro'}
        </span>
      </button>
    </div>
  );
}

export default Header;