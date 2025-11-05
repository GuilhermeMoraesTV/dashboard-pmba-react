import React, { useState, useEffect } from 'react';
import { auth, db } from '../../firebaseConfig';
import { doc, getDoc } from 'firebase/firestore';
import { Sun, Moon } from 'lucide-react';

function Header({ activeTab, isDarkMode, toggleTheme }) {
  const [displayName, setDisplayName] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchUserName = async () => {
      try {
        if (auth.currentUser) {
          if (auth.currentUser.displayName) {
            setDisplayName(auth.currentUser.displayName);
          } else {
            const userDocRef = doc(db, 'users', auth.currentUser.uid);
            const userDocSnap = await getDoc(userDocRef);
            if (userDocSnap.exists() && userDocSnap.data().displayName) {
              setDisplayName(userDocSnap.data().displayName);
            } else if (userDocSnap.exists() && userDocSnap.data().name) {
              setDisplayName(userDocSnap.data().name);
            } else {
              setDisplayName('Estudante');
            }
          }
        }
      } catch (error) {
        console.error('Erro ao buscar nome:', error);
        setDisplayName('Estudante');
      } finally {
        setLoading(false);
      }
    };

    fetchUserName();
  }, [auth.currentUser?.uid]);

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
    <div className="flex items-center justify-between mb-6 pb-4 border-b-2 border-border-light dark:border-border-dark">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold text-text-heading dark:text-text-dark-heading mb-1">
          {loading ? 'Olá!' : `Olá, ${displayName}!`}
        </h1>
        <p className="text-sm text-text-subtle dark:text-text-dark-subtle flex items-center gap-2">
          <span className="w-2 h-2 bg-primary rounded-full animate-pulse"></span>
          {getTabTitle()}
        </p>
      </div>

      <button
        onClick={toggleTheme}
        className="group relative p-3 rounded-xl bg-card-light dark:bg-card-dark hover:bg-border-light dark:hover:bg-border-dark border border-border-light dark:border-border-dark transition-all duration-300 shadow-sm hover:shadow-md"
        title={isDarkMode ? 'Ativar modo claro' : 'Ativar modo escuro'}
      >
        <div className="relative w-6 h-6">
          <Sun
            size={24}
            className={`absolute inset-0 text-yellow-500 transition-all duration-300 ${
              isDarkMode ? 'opacity-0 rotate-90 scale-0' : 'opacity-100 rotate-0 scale-100'
            }`}
          />
          <Moon
            size={24}
            className={`absolute inset-0 text-blue-400 transition-all duration-300 ${
              isDarkMode ? 'opacity-100 rotate-0 scale-100' : 'opacity-0 -rotate-90 scale-0'
            }`}
          />
        </div>

        <span className="absolute -bottom-8 left-1/2 -translate-x-1/2 px-2 py-1 bg-text-heading dark:bg-text-dark-heading text-card-light dark:text-card-dark text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
          {isDarkMode ? 'Modo Claro' : 'Modo Escuro'}
        </span>
      </button>
    </div>
  );
}

export default Header;