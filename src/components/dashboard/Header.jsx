import React from 'react';
import { Sun, Moon } from 'lucide-react'; // Usando Lucide aqui também

// Mapeia os IDs das abas para títulos amigáveis
const tabTitles = {
  home: 'Dashboard de Performance',
  ciclos: 'Meus Ciclos de Estudo',
  goals: 'Minhas Metas',
  calendar: 'Calendário de Estudos',
  profile: 'Minha Conta e Perfil',
  historico: 'Histórico de Registros', // Título para a nova aba
};

// 1. Receber 'user' completo em vez de 'userEmail'
const Header = ({ activeTab, isDarkMode, toggleTheme, user }) => {
  const title = tabTitles[activeTab] || 'Dashboard';

  // 2. Tentar usar displayName, senão usar email
  const userIdentifier = user?.displayName || user?.email || 'Bem-vindo(a)';

  return (
    <header className="flex flex-col md:flex-row justify-between items-start md:items-center
                       mb-8 pb-4 border-b-2 border-border-color dark:border-dark-border-color
                       relative"
    >
      <div>
        <h1 className="m-0 text-2xl md:text-3xl font-bold text-heading-color dark:text-dark-heading-color">
          {title}
        </h1>
        <p className="mt-1 mb-0 text-sm md:text-base text-subtle-text-color dark:text-dark-subtle-text-color">
          {userIdentifier}
        </p>
      </div>

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
        {isDarkMode ? (
          <Sun size={20} />
        ) : (
          <Moon size={20} />
        )}
      </button>
    </header>
  );
};

export default Header;