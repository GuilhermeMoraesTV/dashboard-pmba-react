import React, { useState, useEffect } from 'react';
import {
  collection,
  onSnapshot,
  query,
  orderBy,
  addDoc,
  deleteDoc,
  doc,
  where // <-- IMPORTAR 'where'
} from 'firebase/firestore';
import { db, auth } from '../firebaseConfig';
import { signOut } from 'firebase/auth';

import NavSideBar from './dashboard/NavSideBar';
import Header from './dashboard/Header';
import Home from './dashboard/Home';
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

  // --- Estados ---
  const [activeTab, setActiveTab] = useState('home');
  const [goalsHistory, setGoalsHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isSidebarExpanded, setIsSidebarExpanded] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  // --- NOVOS ESTADOS PARA FILTRAGEM ---
  const [activeCicloId, setActiveCicloId] = useState(null);
  const [allRegistrosEstudo, setAllRegistrosEstudo] = useState([]); // Para o Calendário
  const [activeRegistrosEstudo, setActiveRegistrosEstudo] = useState([]); // Para a Home

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

  // --- NOVO HOOK: Buscar o Ciclo Ativo ---
  useEffect(() => {
    if (!user) return;

    // Query para encontrar o ciclo ativo e não arquivado
    const ciclosRef = collection(db, 'users', user.uid, 'ciclos');
    const q = query(ciclosRef,
      where('ativo', '==', true),
      where('arquivado', '==', false)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      if (snapshot.empty) {
        // Nenhum ciclo ativo encontrado
        setActiveCicloId(null);
        setLoading(false);
      } else {
        // Pega o primeiro (e único) ciclo ativo
        const cicloAtivo = snapshot.docs[0];
        setActiveCicloId(cicloAtivo.id);
        // Não seta loading para false aqui, pois o hook de registros ainda está rodando
      }
    }, (error) => {
      console.error("Erro ao buscar ciclo ativo:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  // --- HOOK MODIFICADO: Buscar TODOS os Registros ---
  useEffect(() => {
    if (!user) return;

    // Este hook agora busca TODOS os registros e os armazena em 'allRegistrosEstudo'
    // A flag 'loading' é controlada aqui.
    setLoading(true);
    const q = query(collection(db, 'users', user.uid, 'registrosEstudo'), orderBy('data', 'desc'));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const todosRegistros = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setAllRegistrosEstudo(todosRegistros);
      setLoading(false); // <--- Loading principal termina aqui
    }, (error) => {
      console.error("Erro ao buscar registros:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  // --- NOVO HOOK: Filtrar Registros para a Home ---
  useEffect(() => {
    // Este hook reage à mudança do ciclo ativo ou à lista de registros
    if (loading) return; // Espera o carregamento inicial terminar

    if (!activeCicloId) {
      // Se não há ciclo ativo, a Home não exibe dados de ciclo
      setActiveRegistrosEstudo([]);
    } else {
      // Filtra a lista completa de registros
      // ASSUMINDO que seu 'registroEstudo' tem o campo 'cicloId'
      const registrosFiltrados = allRegistrosEstudo.filter(
        (registro) => registro.cicloId === activeCicloId
      );
      setActiveRegistrosEstudo(registrosFiltrados);
    }
  }, [activeCicloId, allRegistrosEstudo, loading]); // Depende do ciclo ativo e dos registros

  // Hook de Metas (sem alteração)
  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, 'users', user.uid, 'metas'), orderBy('startDate', 'desc'));
    const unsubscribeGoals = onSnapshot(q, (snapshot) => {
      setGoalsHistory(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => console.error("Erro ao buscar metas:", error));

    return () => unsubscribeGoals();
  }, [user]);


  // --- FUNÇÕES DE DADOS (sem alteração) ---
  const addRegistroEstudo = async (data) => {
    try {
      // IMPORTANTE: 'data' deve conter 'cicloId: activeCicloId'
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

  // --- NOVA FUNÇÃO CALLBACK ---
  // Esta função será chamada pelo CiclosList quando o usuário
  // ativar um novo ciclo ou arquivar o ciclo atual.
  const handleCicloAtivado = (cicloId) => {
    setActiveCicloId(cicloId); // Simplesmente atualiza o estado
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

    switch (activeTab) {
      case 'home':
        return <Home
                  // Passa APENAS os registros filtrados para a Home
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
                  // O Calendário continua recebendo TODOS os registros
                  registrosEstudo={allRegistrosEstudo}
                  goalsHistory={goalsHistory}
                  onDeleteRegistro={deleteRegistro}
                />;
      case 'ciclos':
        return <CiclosPage
                  user={user}
                  addRegistroEstudo={addRegistroEstudo}
                  // Passa a função de callback para o CiclosPage
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