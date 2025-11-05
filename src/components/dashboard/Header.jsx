// src/components/dashboard/Header.jsx
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
          // Primeiro tenta do Auth
          if (auth.currentUser.displayName) {
            setDisplayName(auth.currentUser.displayName);
          } else {
            // Se não tiver, busca do Firestore
            const userDocRef = doc(db, 'users', auth.currentUser.uid);
            const userDocSnap = await getDoc(userDocRef);
            if (userDocSnap.exists() && userDocSnap.data().displayName) {
              setDisplayName(userDocSnap.data().displayName);
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
      home: 'Início',
      goals: 'Metas',
      calendar: 'Calendário',
      ciclos: 'Ciclos',
      profile: 'Perfil',
      historico: 'Histórico'
    };
    return tabNames[activeTab] || 'Dashboard';
  };

  return (
    <div className="flex items-center justify-between mb-8">
      <div>
        <h1 className="text-3xl font-bold text-heading-color dark:text-dark-heading-color mb-1">
          Olá, {displayName}!
        </h1>
        <p className="text-subtle-text-color dark:text-dark-subtle-text-color">
          {getTabTitle()}
        </p>
      </div>

      {/* Toggle Tema */}
      <button
        onClick={toggleTheme}
        className="p-3 rounded-lg bg-card-background-color dark:bg-dark-card-background-color hover:bg-border-color dark:hover:bg-dark-border-color transition-all"
        title={isDarkMode ? 'Ativar modo claro' : 'Ativar modo escuro'}
      >
        {isDarkMode ? (
          <Sun size={24} className="text-yellow-400" />
        ) : (
          <Moon size={24} className="text-purple-400" />
        )}
      </button>
    </div>
  );
}

export default Header;
