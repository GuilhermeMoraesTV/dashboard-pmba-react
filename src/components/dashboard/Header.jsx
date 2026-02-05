import React, { useState, useEffect } from 'react';
import { Moon, Sun, Radio } from 'lucide-react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../../firebaseConfig';
import HeaderProgress from './HeaderProgress';

function Header({
  user,
  activeTab,
  isDarkMode,
  toggleTheme,
  registrosEstudo,
  goalsHistory,
  activeCicloId,
  onShareGoal,
  onOpenFeedback
}) {

  const firstName = user.displayName ? user.displayName.split(' ')[0] : 'Estudante';
  const showWelcome = activeTab === 'home';
  const [hasUnreadSupport, setHasUnreadSupport] = useState(false);

  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, 'system_feedback'),
      where('uid', '==', user.uid),
      where('unreadUser', '==', true)
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setHasUnreadSupport(!snapshot.empty);
    });
    return () => unsubscribe();
  }, [user]);

  return (
    // FLEX-COL-REVERSE no mobile: O segundo filho (Botões) vai para o topo visualmente.
    // MD:FLEX-ROW no desktop: O primeiro filho (Saudação) fica na esquerda, o segundo (Botões) na direita.
    <header className="flex flex-col-reverse md:flex-row justify-between items-center w-full gap-1 md:gap-4 mb-2 md:mb-0 transition-all">

      {/* 1. SAUDAÇÃO (Fica embaixo no Mobile, Esquerda no Desktop) */}
      <div className="flex items-center min-w-0 w-full md:w-auto pt-1 md:pt-0">
        {showWelcome ? (
          <div className="flex flex-col min-w-0">
            <h1 className="text-xl md:text-2xl font-bold text-zinc-800 dark:text-white transition-colors leading-tight truncate flex items-center gap-1">
              Olá, {firstName}! <span className="hidden md:inline"></span>
            </h1>

          </div>
        ) : (
           <div className="w-1"></div>
        )}
      </div>

      {/* 2. GRUPO DE BOTÕES (Fica no topo no Mobile, Direita no Desktop) */}
      <div className="flex items-center justify-end gap-2 w-full md:w-auto h-8 md:h-auto">

        {/* A) Botão Suporte */}
        <button
            onClick={onOpenFeedback}
            className="group relative flex items-center justify-center h-7 w-auto px-2 md:h-auto md:px-3 md:py-2 rounded-lg md:rounded-xl bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800 hover:bg-indigo-100 transition-all active:scale-95 flex-shrink-0"
            title="Suporte"
        >
            <div className="relative">
                <Radio size={14} className={`relative z-10 md:w-5 md:h-5 ${hasUnreadSupport ? 'animate-pulse' : ''}`} />
                {hasUnreadSupport ? (
                   <span className="absolute -top-1 -right-1 flex h-2 w-2 md:h-3 md:w-3">
                     <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                     <span className="relative inline-flex rounded-full h-2 w-2 md:h-3 md:w-3 bg-red-500 border-2 border-white dark:border-zinc-900"></span>
                   </span>
                ) : (
                   <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 md:w-2.5 md:h-2.5 bg-indigo-500 rounded-full border border-white dark:border-zinc-900 opacity-75"></span>
                )}
            </div>
            <span className="ml-1.5 text-[9px] md:text-xs font-black uppercase tracking-wider">Suporte</span>
        </button>

        {/* B) HeaderProgress (No meio) */}
        <div className="flex-shrink-0">
            <HeaderProgress
                registrosEstudo={registrosEstudo}
                goalsHistory={goalsHistory}
                activeCicloId={activeCicloId}
                onShareGoal={onShareGoal}
            />
        </div>

        {/* C) Botão Tema (Na ponta direita) */}
        <button
          onClick={toggleTheme}
          className="w-7 h-7 md:w-auto md:h-auto md:p-2 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200 border border-zinc-200 dark:border-zinc-700 flex items-center justify-center transition-colors flex-shrink-0"
        >
          {isDarkMode ? <Sun size={14} className="md:w-5 md:h-5" /> : <Moon size={14} className="md:w-5 md:h-5" />}
        </button>
      </div>

    </header>
  );
}

export default Header;