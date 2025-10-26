import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, query, orderBy, addDoc, deleteDoc, doc } from 'firebase/firestore';
import { db, auth } from '../firebaseConfig';
import { signOut } from 'firebase/auth';

import NavSideBar from './dashboard/NavSideBar';
import Header from './dashboard/Header';
import Home from './dashboard/Home';
// import QuestionsTab from './dashboard/QuestionsTab'; // REMOVIDO
// import HoursTab from './dashboard/HoursTab'; // REMOVIDO
import GoalsTab from './dashboard/GoalsTab';
import CalendarTab from './dashboard/CalendarTab';
import CiclosPage from '../pages/CiclosPage';

// Função para formatar data (sem alteração)
const dateToYMD = (date) => {
  const d = date.getDate();
  const m = date.getMonth() + 1;
  const y = date.getFullYear();
  return '' + y + '-' + (m <= 9 ? '0' + m : m) + '-' + (d <= 9 ? '0' + d : d);
};

function Dashboard({ user, isDarkMode, toggleTheme }) {
  if (!user) {
    return (
      <div className="flex justify-center items-center min-h-screen bg-background-color dark:bg-dark-background-color">
        <h2 className="text-2xl font-semibold text-heading-color dark:text-dark-heading-color">
          Redirecionando...
        </h2>
      </div>
    );
  }

  // --- Estados (sem alteração) ---
  const [activeTab, setActiveTab] = useState('home');
  const [goalsHistory, setGoalsHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isSidebarExpanded, setIsSidebarExpanded] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [registrosEstudo, setRegistrosEstudo] = useState([]);

  // Correção de Redimensionamento (sem alteração)
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 1024) {
        setIsMobileOpen(false);
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Hook de Registros (sem alteração)
  useEffect(() => {
    if (!user) return;
    setLoading(true);
    const q = query(collection(db, 'users', user.uid, 'registrosEstudo'), orderBy('data', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setRegistrosEstudo(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLoading(false);
    }, (error) => console.error("Erro ao buscar registros:", error));

    return () => unsubscribe();
  }, [user]);

  // Hook de Metas (sem alteração)
  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, 'users', user.uid, 'metas'), orderBy('startDate', 'desc'));
    const unsubscribeGoals = onSnapshot(q, (snapshot) => {
      setGoalsHistory(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => console.error("Erro ao buscar metas:", error));

    return () => unsubscribeGoals();
  }, [user]);

  // --- FUNÇÕES DE DADOS (AGORA SÃO GLOBAIS) ---
  const addRegistroEstudo = async (data) => {
    try {
      const collectionRef = collection(db, 'users', user.uid, 'registrosEstudo');
      await addDoc(collectionRef, data);
    } catch (e) {
      console.error('Error adding document: ', e);
    }
  };

  const deleteRegistro = async (id) => {
    try {
      await deleteDoc(doc(db, 'users', user.uid, 'registrosEstudo', id));
    } catch (e) {
      console.error('Error deleting document: ', e);
    }
  };

  const deleteData = async (collectionName, id) => {
    try {
      await deleteDoc(doc(db, 'users', user.uid, collectionName, id));
    } catch (e) {
      console.error('Error deleting document: ', e);
    }
  };

  const addGoal = async (goalData) => {
    try {
      const newGoal = {
        ...goalData,
        startDate: dateToYMD(new Date())
      };
      const collectionRef = collection(db, 'users', user.uid, 'metas');
      await addDoc(collectionRef, newGoal);
    } catch (e) {
      console.error('Error adding goal: ', e);
    }
  };

  const handleLogout = () => {
    signOut(auth).catch((error) => console.error('Logout Error:', error));
  };

  // --- RENDERIZAÇÃO DE ABA (MODIFICADO) ---
  const renderTabContent = () => {
    if (loading && activeTab === 'home') {
      return (
        <div className="flex justify-center items-center pt-20">
          <h2 className="text-xl font-semibold text-heading-color dark:text-dark-heading-color">
            Carregando dados...
          </h2>
        </div>
      );
    }

    // A Home e o Calendário agora precisam da função de delete
    // para o (futuro) modal de detalhes do dia.

    switch (activeTab) {
      case 'home':
        return <Home
                  registrosEstudo={registrosEstudo}
                  goalsHistory={goalsHistory}
                  setActiveTab={setActiveTab}
                  onDeleteRegistro={deleteRegistro} // Passando delete
                />;

      // 'questions' e 'hours' REMOVIDOS

      case 'goals':
        return <GoalsTab
                  goalsHistory={goalsHistory}
                  onAddGoal={addGoal}
                  onDeleteGoal={(id) => deleteData('metas', id)}
                />;
      case 'calendar':
        return <CalendarTab
                  registrosEstudo={registrosEstudo}
                  goalsHistory={goalsHistory}
                  onDeleteRegistro={deleteRegistro} // Passando delete
                />;
      case 'ciclos':
        // Passando a função de ADICIONAR para o módulo de ciclos
        return <CiclosPage
                  user={user}
                  addRegistroEstudo={addRegistroEstudo}
                />;
      default:
        return <Home
                  registrosEstudo={registrosEstudo}
                  goalsHistory={goalsHistory}
                  setActiveTab={setActiveTab}
                  onDeleteRegistro={deleteRegistro}
                />;
    }
  };

  // --- JSX (sem alteração) ---
  return (
    <div className="flex min-h-screen">
      <NavSideBar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        handleLogout={handleLogout}
        isExpanded={isSidebarExpanded}
        setExpanded={setIsSidebarExpanded}
        isMobileOpen={isMobileOpen}
        setMobileOpen={setIsMobileOpen}
      />

      <div
        className={`flex-grow max-w-[1400px] mx-auto w-full
                    transition-[margin-left] duration-300 ease-in-out
                    pt-[70px] px-3 md:px-6 lg:pt-6 lg:px-8
                    ${isSidebarExpanded ? 'lg:ml-[260px]' : 'lg:ml-[70px]'}
                  `}
      >
        <Header
          activeTab={activeTab}
          isDarkMode={isDarkMode}
          toggleTheme={toggleTheme}
          userEmail={user ? user.email : ''}
        />
        <main>
          {renderTabContent()}
        </main>
      </div>

      <div
        className={`block lg:hidden fixed inset-0 z-40 bg-black/50 transition-opacity duration-300 ease-in-out
                    ${isMobileOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}
                  `}
        onClick={() => setIsMobileOpen(false)}
      ></div>
    </div>
  );
}

export default Dashboard;