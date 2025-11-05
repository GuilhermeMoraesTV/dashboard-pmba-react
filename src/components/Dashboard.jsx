import React, { useState, useEffect } from 'react';
import {
  collection, onSnapshot, query, orderBy, addDoc, deleteDoc, doc, where, Timestamp
} from 'firebase/firestore';
import { db, auth } from '../firebaseConfig';
import { signOut } from 'firebase/auth';

import NavSideBar from '../components/dashboard/NavSideBar';
import Header from '../components/dashboard/Header';
import Home from '../components/dashboard/Home';
import GoalsTab from '../components/dashboard/GoalsTab';
import CalendarTab from '../components/dashboard/CalendarTab';
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
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-color mx-auto mb-4"></div>
          <h2 className="text-xl font-semibold text-heading-color dark:text-dark-heading-color">
            Redirecionando...
          </h2>
        </div>
      </div>
    );
  }

  // ===== ESTADOS =====
  const [activeTab, setActiveTab] = useState('home');
  const [goalsHistory, setGoalsHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isSidebarExpanded, setIsSidebarExpanded] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [activeCicloId, setActiveCicloId] = useState(null);
  const [allRegistrosEstudo, setAllRegistrosEstudo] = useState([]);
  const [activeRegistrosEstudo, setActiveRegistrosEstudo] = useState([]);

  // ===== EFEITO: Redimensionamento =====
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 1024) {
        setIsMobileOpen(false);
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // ===== EFEITO: Busca ciclo ativo =====
  useEffect(() => {
    if (!user) return;
    const ciclosRef = collection(db, 'users', user.uid, 'ciclos');
    const q = query(ciclosRef, where('ativo', '==', true), where('arquivado', '==', false));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      if (snapshot.empty) {
        setActiveCicloId(null);
      } else {
        const cicloAtivo = snapshot.docs[0];
        setActiveCicloId(cicloAtivo.id);
      }
    }, (error) => {
      console.error("Erro ao buscar ciclo ativo:", error);
      setActiveCicloId(null);
    });

    return () => unsubscribe();
  }, [user]);

  // ===== EFEITO: Busca TODOS os registros =====
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
        let dataStr = data.data;

        if (data.data && typeof data.data.toDate === 'function') {
          dataStr = dateToYMD(data.data.toDate());
        }

        return {
          id: doc.id,
          ...data,
          tempoEstudadoMinutos: Number(data.tempoEstudadoMinutos || 0),
          questoesFeitas: Number(data.questoesFeitas || 0),
          acertos: Number(data.acertos || 0),
          data: dataStr,
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

  // ===== EFEITO: Filtra registros do ciclo ativo =====
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

  // ===== EFEITO: Busca metas =====
  useEffect(() => {
    if (!user) return;

    const q = query(
      collection(db, 'users', user.uid, 'metas'),
      orderBy('startDate', 'desc')
    );

    const unsubscribeGoals = onSnapshot(q, (snapshot) => {
      setGoalsHistory(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => console.error("Erro ao buscar metas:", error));

    return () => unsubscribeGoals();
  }, [user]);

  // ===== FUNÇÕES DE DADOS =====
  const addRegistroEstudo = async (data) => {
    try {
      const collectionRef = collection(db, 'users', user.uid, 'registrosEstudo');
      await addDoc(collectionRef, {
        ...data,
        timestamp: Timestamp.now()
      });
    } catch (e) {
      console.error('Erro ao adicionar registro:', e);
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

  // ===== FUNÇÕES DE CONTROLE =====
  const handleLogout = () => {
    signOut(auth).catch((error) => console.error('Logout Error:', error));
  };

  const handleCicloAtivado = (cicloId) => {
    setActiveCicloId(cicloId);
  };

  // ===== RENDERIZAÇÃO DE CONTEÚDO =====
  const renderTabContent = () => {
    if (loading && ['home', 'calendar'].includes(activeTab)) {
      return (
        <div className="flex justify-center items-center pt-20">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-color mx-auto mb-4"></div>
            <p className="text-lg font-semibold text-heading-color dark:text-dark-heading-color">
              Carregando dados...
            </p>
          </div>
        </div>
      );
    }

    switch (activeTab) {
      case 'home':
        return (
          <Home
            registrosEstudo={activeRegistrosEstudo}
            goalsHistory={goalsHistory}
            setActiveTab={setActiveTab}
            onDeleteRegistro={deleteRegistro}
          />
        );
      case 'goals':
        return (
          <GoalsTab
            goalsHistory={goalsHistory}
            onAddGoal={addGoal}
            onDeleteGoal={(id) => deleteData('metas', id)}
          />
        );
      case 'calendar':
        return (
          <CalendarTab
            registrosEstudo={allRegistrosEstudo}
            goalsHistory={goalsHistory}
            onDeleteRegistro={deleteRegistro}
          />
        );
      case 'ciclos':
        return (
          <CiclosPage
            user={user}
            addRegistroEstudo={addRegistroEstudo}
            onCicloAtivado={handleCicloAtivado}
          />
        );
      case 'profile':
        return (
          <ProfilePage
            user={user}
            allRegistrosEstudo={allRegistrosEstudo}
            onDeleteRegistro={deleteRegistro}
          />
        );
      default:
        return (
          <Home
            registrosEstudo={activeRegistrosEstudo}
            goalsHistory={goalsHistory}
            setActiveTab={setActiveTab}
            onDeleteRegistro={deleteRegistro}
          />
        );
    }
  };

  // ===== RENDERIZAÇÃO PRINCIPAL =====
  return (
    <div className="flex min-h-screen bg-background-color dark:bg-dark-background-color transition-colors duration-300">

      {/* ===== SIDEBAR ===== */}
      <NavSideBar
        user={user}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        handleLogout={handleLogout}
        isExpanded={isSidebarExpanded}
        setExpanded={setIsSidebarExpanded}
        isMobileOpen={isMobileOpen}
        setMobileOpen={setIsMobileOpen}
      />

      {/* ===== CONTEÚDO PRINCIPAL ===== */}
      <div
        className={`
          flex-grow w-full transition-all duration-300 ease-in-out
          pt-[70px] px-4 md:px-6 lg:pt-6 lg:px-8
          ${isSidebarExpanded ? 'lg:ml-[260px]' : 'lg:ml-[70px]'}
        `}
      >
        {/* Header */}
        <Header
          activeTab={activeTab}
          isDarkMode={isDarkMode}
          toggleTheme={toggleTheme}
        />

        {/* Main Content */}
        <main className="mt-6 max-w-7xl mx-auto">
          <div className="animate-fade-in">
            {renderTabContent()}
          </div>
        </main>
      </div>

      {/* ===== OVERLAY MOBILE ===== */}
      {isMobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden transition-opacity duration-300"
          onClick={() => setIsMobileOpen(false)}
        />
      )}
    </div>
  );
}

export default Dashboard;
