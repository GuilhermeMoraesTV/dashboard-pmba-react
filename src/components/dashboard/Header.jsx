import React from 'react';
import { Sun, Moon } from 'lucide-react';
import HeaderProgress from './HeaderProgress';

function Header({ activeTab, isDarkMode, toggleTheme, registrosEstudo, goalsHistory }) {
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
    // ALTERAÇÃO AQUI: z-40 garante que o Header (e seus dropdowns) fiquem ACIMA dos cards da Home (z-20)
    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 pb-4 border-b border-zinc-200 dark:border-zinc-800 relative z-40">

      {/* Título da Página */}
      <div>
        <h1 className="text-2xl font-black text-zinc-800 dark:text-white uppercase tracking-tight">
          {getTabTitle()}
        </h1>
        <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 hidden md:block">
          Sistema de Gestão de Estudos
        </p>
      </div>

      {/* Área Direita: Progresso + Tema */}
      <div className="flex items-center gap-4 self-end md:self-auto">

        {/* Componente de Progresso */}
        <HeaderProgress registrosEstudo={registrosEstudo} goalsHistory={goalsHistory} />

        <div className="h-8 w-px bg-zinc-300 dark:bg-zinc-700 mx-1 hidden md:block"></div>

        {/* Botão de Tema */}
        <button
          onClick={toggleTheme}
          className="group relative p-2.5 rounded-xl bg-zinc-200 dark:bg-zinc-800 hover:bg-zinc-300 dark:hover:bg-zinc-700 border border-zinc-300 dark:border-zinc-700 transition-all duration-300 shadow-sm"
          title={isDarkMode ? 'Ativar modo claro' : 'Ativar modo escuro'}
        >
          <div className="relative w-5 h-5">
            <Sun
              size={20}
              className={`absolute inset-0 text-amber-500 transition-all duration-300 ${
                isDarkMode ? 'opacity-0 rotate-90 scale-0' : 'opacity-100 rotate-0 scale-100'
              }`}
            />
            <Moon
              size={20}
              className={`absolute inset-0 text-indigo-400 transition-all duration-300 ${
                isDarkMode ? 'opacity-100 rotate-0 scale-100' : 'opacity-0 -rotate-90 scale-0'
              }`}
            />
          </div>
        </button>
      </div>
    </div>
  );
}

export default Header;