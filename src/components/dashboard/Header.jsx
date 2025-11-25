import React from 'react';
import { Moon, Sun } from 'lucide-react';
import HeaderProgress from './HeaderProgress';

function Header({ user, activeTab, isDarkMode, toggleTheme, registrosEstudo, goalsHistory, activeCicloId }) {

  const firstName = user.displayName ? user.displayName.split(' ')[0] : 'Estudante';
  const showWelcome = activeTab === 'home';

  return (
    // ALTERAÇÃO AQUI: Mudado de 'flex-col md:flex-row' para 'flex' direto com 'items-center'
    // Isso garante que fiquem na mesma linha horizontal
    <header className="flex justify-between items-center w-full gap-2 md:gap-4 h-16 md:h-auto">

      {/* Lado Esquerdo: Título ou Espaçador */}
      <div className="flex items-center">
        {showWelcome ? (
          <div className="flex flex-col">
            {/* Texto ajustado para mobile: some o subtítulo e diminui o título se necessário,
                ou esconde totalmente em telas muito pequenas se colidir com o widget */}
            <h1 className="text-lg md:text-2xl font-bold text-zinc-800 dark:text-white transition-colors leading-tight">
              Olá, {firstName}! <span className="hidden md:inline"></span>
            </h1>
            <p className="hidden md:block text-sm text-zinc-500 dark:text-zinc-400 transition-colors">
              Vamos evoluir hoje?
            </p>
          </div>
        ) : (
           // Mantém um espaço mínimo se necessário, ou removido
           <div className="w-1"></div>
        )}
      </div>

      {/* Lado Direito: Ações (Widget + Tema) */}
      {/* Removido 'self-end', agora alinhado pelo pai */}
      <div className="flex items-center gap-2 md:gap-4">

        {/* Wrapper para garantir que o widget não quebre o layout em telas minúsculas */}
        <div className="flex-shrink-0">
            <HeaderProgress
                registrosEstudo={registrosEstudo}
                goalsHistory={goalsHistory}
                activeCicloId={activeCicloId}
            />
        </div>

        <button
          onClick={toggleTheme}
          className="p-2 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors shrink-0 border border-zinc-200 dark:border-zinc-700"
          aria-label="Alternar tema"
        >
          {isDarkMode ? <Sun size={20} /> : <Moon size={20} />}
        </button>
      </div>
    </header>
  );
}

export default Header;