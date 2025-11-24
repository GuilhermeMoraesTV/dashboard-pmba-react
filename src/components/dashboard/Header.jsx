import React from 'react';
import { Bell, Moon, Sun, Menu } from 'lucide-react';
import HeaderProgress from './HeaderProgress';

function Header({ user, activeTab, isDarkMode, toggleTheme, registrosEstudo, goalsHistory, activeCicloId }) {
  return (
    <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
      <div className="flex flex-col">
        <h1 className="text-2xl font-bold text-gray-800 dark:text-white">
          Olá, {user.displayName ? user.displayName.split(' ')[0] : 'Estudante'}! 👋
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Vamos evoluir hoje?
        </p>
      </div>

      <div className="flex items-center gap-4 self-end md:self-auto">
        {/* A condição {activeTab === 'home' && ...} foi removida para aparecer sempre */}
        <HeaderProgress
            registrosEstudo={registrosEstudo}
            goalsHistory={goalsHistory}
            activeCicloId={activeCicloId}
        />

        <button
          onClick={toggleTheme}
          className="p-2 rounded-full bg-gray-100 dark:bg-zinc-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-zinc-700 transition-colors shrink-0"
        >
          {isDarkMode ? <Sun size={20} /> : <Moon size={20} />}
        </button>
      </div>
    </header>
  );
}

export default Header;