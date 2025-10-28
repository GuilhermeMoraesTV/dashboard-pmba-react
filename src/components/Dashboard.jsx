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
import ProfilePage from '../pages/ProfilePage'; // <-- 1. IMPORTAR

// Função helper (sem alteração)
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

  // Estados (sem alteração)
  const [activeTab, setActiveTab] = useState('home');
  const [goalsHistory, setGoalsHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isSidebarExpanded, setIsSidebarExpanded] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [activeCicloId, setActiveCicloId] = useState(null);
  const [allRegistrosEstudo, setAllRegistrosEstudo] = useState([]);
  const [activeRegistrosEstudo, setActiveRegistrosEstudo] = useState([]);

  // Redimensionamento (sem alteração)
  useEffect(() => {
    // ... (código existente)
    const handleResize = () => {
      if (window.innerWidth >= 1024) {
        setIsMobileOpen(false);
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Busca ciclo ativo (sem alteração)
  useEffect(() => {
    // ... (código existente)
     if (!user) return;

    const ciclosRef = collection(db, 'users', user.uid, 'ciclos');
    const q = query(ciclosRef, where('ativo', '==', true), where('arquivado', '==', false));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      if (snapshot.empty) {
        setActiveCicloId(null);
        // Não definir loading aqui para esperar os registros
      } else {
        const cicloAtivo = snapshot.docs[0];
        setActiveCicloId(cicloAtivo.id);
      }
    }, (error) => {
      console.error("Erro ao buscar ciclo ativo:", error);
      setActiveCicloId(null); // Garante que fica nulo em caso de erro
      // Não definir loading aqui para esperar os registros
    });

    return () => unsubscribe();
  }, [user]);

  // Busca TODOS os registros (sem alteração)
  useEffect(() => {
    // ... (código existente)
     if (!user) return;

    setLoading(true); // Controla o loading principal aqui
    const q = query(
      collection(db, 'users', user.uid, 'registrosEstudo'),
      // Ordena por timestamp se existir, senão por data (para compatibilidade)
      orderBy('timestamp', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const todosRegistros = snapshot.docs.map(doc => {
        const data = doc.data();
        // Normaliza os dados para garantir consistência e tratar dados antigos
        return {
          id: doc.id,
          ...data,
          // Garante que os campos usados nos cálculos existam e sejam números
          tempoEstudadoMinutos: Number(data.tempoEstudadoMinutos || data.duracaoMinutos || 0),
          questoesFeitas: Number(data.questoesFeitas || 0),
          acertos: Number(data.acertos || data.questoesAcertadas || 0),
          // Garante que a data seja uma string YYYY-MM-DD
          data: typeof data.data === 'string' ? data.data : (data.data?.toDate ? dateToYMD(data.data.toDate()) : dateToYMD(new Date())),
        };
      });
      setAllRegistrosEstudo(todosRegistros);
      setLoading(false); // Loading termina após buscar registros
    }, (error) => {
      console.error("Erro ao buscar registros:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  // Filtra registros do ciclo ativo (sem alteração)
  useEffect(() => {
    // ... (código existente)
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

  // Busca metas (sem alteração)
  useEffect(() => {
    // ... (código existente)
     if (!user) return;
    const q = query(collection(db, 'users', user.uid, 'metas'), orderBy('startDate', 'desc'));
    const unsubscribeGoals = onSnapshot(q, (snapshot) => {
      setGoalsHistory(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => console.error("Erro ao buscar metas:", error));

    return () => unsubscribeGoals();
  }, [user]);

  // Funções de dados (addRegistro, deleteRegistro, deleteData, addGoal) (sem alteração)
  const addRegistroEstudo = async (data) => {
    try {
      const collectionRef = collection(db, 'users', user.uid, 'registrosEstudo');
      await addDoc(collectionRef, {
        ...data,
        timestamp: Timestamp.now() // Adiciona timestamp para ordenação
      });
      console.log("Registro salvo com sucesso!");
    } catch (e) {
      console.error('Erro ao adicionar registro:', e);
      // Opcional: Mostrar um erro para o usuário
      // throw e; // Re-lança se precisar tratar no modal
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

  // Logout e Callback do Ciclo (sem alteração)
  const handleLogout = () => {
    signOut(auth).catch((error) => console.error('Logout Error:', error));
  };

  const handleCicloAtivado = (cicloId) => {
    setActiveCicloId(cicloId);
  };

  // ============================================
  // FUNÇÃO ATUALIZADA: renderTabContent
  // ============================================
  const renderTabContent = () => {
    // Mostra loading apenas se estiver carregando E na home (ou outra aba que dependa dos dados)
    if (loading && (activeTab === 'home' || activeTab === 'calendar' || activeTab === 'profile')) {
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
          registrosEstudo={activeRegistrosEstudo} // Passa só os do ciclo ativo
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
          registrosEstudo={allRegistrosEstudo} // Passa todos os registros
          goalsHistory={goalsHistory}
          onDeleteRegistro={deleteRegistro}
        />;

      case 'ciclos':
        return <CiclosPage
          user={user}
          addRegistroEstudo={addRegistroEstudo}
          onCicloAtivado={handleCicloAtivado}
        />;

      // --- 2. ADICIONADO CASE PARA 'profile' ---
      case 'profile':
        return <ProfilePage
          user={user}
          // Passa todos os registros para histórico, se necessário
          allRegistrosEstudo={allRegistrosEstudo}
          onDeleteRegistro={deleteRegistro}
        />;
      // --- FIM DA ADIÇÃO ---

      default:
        return <Home
          registrosEstudo={activeRegistrosEstudo}
          goalsHistory={goalsHistory}
          setActiveTab={setActiveTab}
          onDeleteRegistro={deleteRegistro}
        />;
    }
  };

  // JSX (sem alteração visual)
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
          // Passa a função para abrir o menu mobile no Header
          onMenuButtonClick={() => setIsMobileOpen(true)}
        />
        <main>
          {renderTabContent()}
        </main>
      </div>

      {/* Overlay para fechar menu mobile */}
      <div className={`block lg:hidden fixed inset-0 z-40 bg-black/50 transition-opacity duration-300 ease-in-out ${isMobileOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
        onClick={() => setIsMobileOpen(false)}
      ></div>
    </div>
  );
}

export default Dashboard;