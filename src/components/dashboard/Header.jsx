import React from 'react';
import { Sun, Moon } from 'lucide-react'; // Mudei para ícones melhores

// Mapeia os IDs das abas para títulos amigáveis
const tabTitles = {
  home: 'Dashboard de Performance',
  ciclos: 'Meus Ciclos de Estudo',
  goals: 'Minhas Metas',
  calendar: 'Calendário de Estudos',
  profile: 'Minha Conta e Perfil',
  // 'historico' foi removido
};

// 1. 'user' não é mais necessário aqui
const Header = ({ activeTab, isDarkMode, toggleTheme }) => {
  const title = tabTitles[activeTab] || 'Dashboard';

  return (
    <header className="flex flex-col md:flex-row justify-between items-start md:items-center
                       mb-8 pb-4 border-b-2
                       relative"
    >
      {/* 2. Conteúdo do Header (título) */}
      <div>
        <h1 className="m-0 text-2xl md:text-3xl font-bold">
          {title}
        </h1>
        {/* 3. Parágrafo com email/nome FOI REMOVIDO (Ponto 6) */}
      </div>

      {/* Botão de Tema */}
      <button
        id="theme-toggle"
        title="Alterar tema"
        onClick={toggleTheme}
        className="
          w-10 h-10 flex items-center justify-center cursor-pointer
          rounded-full
          bg-card text-text-subtle border
          transition-colors duration-200
          hover:bg-background hover:text-text

          absolute top-0 right-0 mt-0 md:static md:mt-0"
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