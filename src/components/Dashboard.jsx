import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, query, orderBy, addDoc, deleteDoc, doc, where, Timestamp } from 'firebase/firestore';
import { db, auth } from '../firebaseConfig';
import { signOut } from 'firebase/auth';

import NavSideBar from './dashboard/NavSideBar';
import Header from './dashboard/Header';
import Home from './dashboard/Home';
import GoalsTab from './dashboard/GoalsTab';
import CalendarTab from './dashboard/CalendarTab';
import CiclosPage from '../pages/CiclosPage';
import ProfilePage from '../pages/ProfilePage';

// Função helper
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

  // Estados
  const [activeTab, setActiveTab] = useState('home');
  const [goalsHistory, setGoalsHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isSidebarExpanded, setIsSidebarExpanded] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  // Estados para filtragem de ciclo
  const [activeCicloId, setActiveCicloId] = useState(null);
  const [allRegistrosEstudo, setAllRegistrosEstudo] = useState([]);
  const [activeRegistrosEstudo, setActiveRegistrosEstudo] = useState([]);

  // Redimensionamento
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 1024) {
        setIsMobileOpen(false);
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Busca ciclo ativo
  useEffect(() => {
    if (!user) return;

    const ciclosRef = collection(db, 'users', user.uid, 'ciclos');
    const q = query(ciclosRef, where('ativo', '==', true), where('arquivado', '==', false));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      if (snapshot.empty) {
        setActiveCicloId(null);
        setLoading(false);
      } else {
        const cicloAtivo = snapshot.docs[0];
        setActiveCicloId(cicloAtivo.id);
      }
    }, (error) => {
      console.error("Erro ao buscar ciclo ativo:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  // Busca TODOS os registros
  useEffect(() => {
    if (!user) return;

    setLoading(true);
    const q = query(
      collection(db, 'users', user.uid, 'registrosEstudo'),
      orderBy('timestamp', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const todosRegistros = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          // Normaliza os dados para garantir consistência
          tempoEstudadoMinutos: data.tempoEstudadoMinutos || data.duracaoMinutos || 0,
          questoesFeitas: data.questoesFeitas || 0,
          acertos: data.acertos || data.questoesAcertadas || 0,
        };
      });
      setAllRegistrosEstudo(todosRegistros);
      setLoading(false);
    }, (error) => {
      console.error("Erro ao buscar registros:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  // Filtra registros do ciclo ativo
  useEffect(() => {
    if (loading) return;

    if (!activeCicloId) {
      setActiveRegistrosEstudo([]);
    } else {
      const registrosFiltrados = allRegistrosEstudo.filter(
        (registro) => registro.cicloId === activeCicloId
      );
      setActiveRegistrosEstudo(registrosFiltrados);
    }
  }, [activeCicloId, allRegistrosEstudo, loading]);

  // Busca metas
  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, 'users', user.uid, 'metas'), orderBy('startDate', 'desc'));
    const unsubscribeGoals = onSnapshot(q, (snapshot) => {
      setGoalsHistory(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => console.error("Erro ao buscar metas:", error));

    return () => unsubscribeGoals();
  }, [user]);

  // ============================================
  // FUNÇÃO ATUALIZADA: addRegistroEstudo
  // ============================================
  const addRegistroEstudo = async (data) => {
    try {
      const collectionRef = collection(db, 'users', user.uid, 'registrosEstudo');
      await addDoc(collectionRef, {
        ...data,
        timestamp: Timestamp.now()
      });
      console.log("Registro salvo com sucesso!");
    } catch (e) {
      console.error('Erro ao adicionar registro:', e);
      throw e;
    }
  };

  const deleteRegistro = async (id) => {
    try {
      await deleteDoc(doc(db, 'users', user.uid, 'registrosEstudo', id));
    } catch (e) {
      console.error('Erro ao deletar registro:', e);
    }
  };

  const deleteData = async (collectionName, id) => {
    try {
      await deleteDoc(doc(db, 'users', user.uid, collectionName, id));
    } catch (e) {
      console.error('Erro ao deletar documento:', e);
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
      console.error('Erro ao adicionar meta:', e);
    }
  };

  const handleLogout = () => {
    signOut(auth).catch((error) => console.error('Logout Error:', error));
  };

  const handleCicloAtivado = (cicloId) => {
    setActiveCicloId(cicloId);
  };

  // Renderização de aba
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

    switch (activeTab) {
      case 'home':
        return <Home
          registrosEstudo={activeRegistrosEstudo}
          goalsHistory={goalsHistory}
          setActiveTab={setActiveTab}
          onDeleteRegistro={deleteRegistro}
        />;

      case 'goals':
        return <GoalsTab
          goalsHistory={goalsHistory}
          onAddGoal={addGoal}
          onDeleteGoal={(id) => deleteData('metas', id)}
        />;

      case 'calendar':
        return <CalendarTab
          registrosEstudo={allRegistrosEstudo}
          goalsHistory={goalsHistory}
          onDeleteRegistro={deleteRegistro}
        />;

      case 'ciclos':
        return <CiclosPage
          user={user}
          addRegistroEstudo={addRegistroEstudo}
          onCicloAtivado={handleCicloAtivado}
        />;

      default:
        return <Home
          registrosEstudo={activeRegistrosEstudo}
          goalsHistory={goalsHistory}
          setActiveTab={setActiveTab}
          onDeleteRegistro={deleteRegistro}
        />;
    }
  };

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

      <div className={`flex-grow max-w-[1400px] mx-auto w-full transition-[margin-left] duration-300 ease-in-out pt-[70px] px-3 md:px-6 lg:pt-6 lg:px-8 ${isSidebarExpanded ? 'lg:ml-[260px]' : 'lg:ml-[70px]'}`}>
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

      <div className={`block lg:hidden fixed inset-0 z-40 bg-black/50 transition-opacity duration-300 ease-in-out ${isMobileOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
        onClick={() => setIsMobileOpen(false)}
      ></div>
    </div>
  );
}

export default Dashboard;