import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, query, orderBy, addDoc, deleteDoc, doc } from 'firebase/firestore';
import { db, auth } from '../firebaseConfig';
import { signOut } from 'firebase/auth';

import NavSideBar from './dashboard/NavSideBar';
import Header from './dashboard/Header';
import Home from './dashboard/Home';
import QuestionsTab from './dashboard/QuestionsTab';
import HoursTab from './dashboard/HoursTab';
import GoalsTab from './dashboard/GoalsTab';
import CalendarTab from './dashboard/CalendarTab';
import CiclosPage from '../pages/CiclosPage'; // Importação (sem alteração)

// Função para formatar data (sem alteração)
const dateToYMD = (date) => {
  const d = date.getDate();
  const m = date.getMonth() + 1;
  const y = date.getFullYear();
  return '' + y + '-' + (m <= 9 ? '0' + m : m) + '-' + (d <= 9 ? '0' + d : d);
};

function Dashboard({ user, isDarkMode, toggleTheme }) { // 'user' já está aqui
  // --- Guarda de Segurança (sem alteração) ---
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
  const [questionsData, setQuestionsData] = useState([]);
  const [hoursData, setHoursData] = useState([]);
  const [goalsHistory, setGoalsHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isSidebarExpanded, setIsSidebarExpanded] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  // --- Correção de Redimensionamento (sem alteração) ---
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 1024) {
        setIsMobileOpen(false);
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Hooks de dados (sem alteração)
  useEffect(() => {
    if (!user) return;
    setLoading(true);
    const q = query(collection(db, 'users', user.uid, 'questoes'), orderBy('date', 'desc'));
    const unsubscribeQuestions = onSnapshot(q, (snapshot) => {
      setQuestionsData(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLoading(false);
    }, (error) => console.error("Erro ao buscar questões:", error));

    return () => unsubscribeQuestions();
  }, [user]);

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    const q = query(collection(db, 'users', user.uid, 'horas'), orderBy('date', 'desc'));
    const unsubscribeHours = onSnapshot(q, (snapshot) => {
      setHoursData(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLoading(false);
    }, (error) => console.error("Erro ao buscar horas:", error));

    return () => unsubscribeHours();
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, 'users', user.uid, 'metas'), orderBy('startDate', 'desc'));
    const unsubscribeGoals = onSnapshot(q, (snapshot) => {
      setGoalsHistory(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => console.error("Erro ao buscar metas:", error));

    return () => unsubscribeGoals();
  }, [user]);

  // Funções de manipulação de dados (sem alteração)
  const addData = async (collectionName, data) => {
    try {
      const collectionRef = collection(db, 'users', user.uid, collectionName);
      await addDoc(collectionRef, data);
    } catch (e) {
      console.error('Error adding document: ', e);
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

  // renderTabContent (MODIFICADO)
  const renderTabContent = () => {
    if (loading) {
      return (
        <div className="flex justify-center items-center pt-20">
          <h2 className="text-xl font-semibold text-heading-color dark:text-dark-heading-color">
            Carregando dados...
          </h2>
        </div>
      );
    }

    switch (activeTab) {
      case 'home':
        return <Home questionsData={questionsData} hoursData={hoursData} goalsHistory={goalsHistory} setActiveTab={setActiveTab} />;
      case 'questions':
        return <QuestionsTab questionsData={questionsData} onAddQuestion={(data) => addData('questoes', data)} onDeleteQuestion={(id) => deleteData('questoes', id)} />;
      case 'hours':
        return <HoursTab hoursData={hoursData} onAddHour={(data) => addData('horas', data)} onDeleteHour={(id) => deleteData('horas', id)} />;
      case 'goals':
        return <GoalsTab
                  goalsHistory={goalsHistory}
                  onAddGoal={addGoal}
                  onDeleteGoal={(id) => deleteData('metas', id)}
                />;
      case 'calendar':
        return <CalendarTab questionsData={questionsData} hoursData={hoursData} goalsHistory={goalsHistory} />;

      case 'ciclos':
        // AQUI ESTÁ A MUDANÇA: Passando 'user' como prop
        return <CiclosPage user={user} />;

      default:
        return <Home questionsData={questionsData} hoursData={hoursData} goalsHistory={goalsHistory} setActiveTab={setActiveTab} />;
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