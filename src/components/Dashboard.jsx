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
import StudyTimer from '../components/ciclos/StudyTimer'; // <--- NOVO IMPORT

const dateToYMD = (date) => {
  const d = date.getDate();
  const m = date.getMonth() + 1;
  const y = date.getFullYear();
  return '' + y + '-' + (m <= 9 ? '0' + m : m) + '-' + (d <= 9 ? '0' + d : d);
};

function Dashboard({ user, isDarkMode, toggleTheme }) {
  if (!user) {
    return (
      <div className="flex justify-center items-center min-h-screen bg-background-light dark:bg-background-dark">
        <div className="text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-accent mx-auto mb-4"></div>
          <h2 className="text-lg font-medium text-gray-600 dark:text-gray-300">Carregando...</h2>
        </div>
      </div>
    );
  }

  const [activeTab, setActiveTab] = useState('home');
  const [goalsHistory, setGoalsHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isSidebarExpanded, setIsSidebarExpanded] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  // Estados Globais
  const [activeCicloId, setActiveCicloId] = useState(null);
  const [activeCicloData, setActiveCicloData] = useState(null); // Para pegar nome do ciclo
  const [allRegistrosEstudo, setAllRegistrosEstudo] = useState([]);
  const [activeRegistrosEstudo, setActiveRegistrosEstudo] = useState([]);

  // --- NOVO: Estado da Sessão de Estudo (Timer Global) ---
  const [activeStudySession, setActiveStudySession] = useState(null);
  // Exemplo de objeto: { disciplina: {id, nome}, isMinimized: false }

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 1024) setIsMobileOpen(false);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Busca Ciclo Ativo
  useEffect(() => {
    if (!user) return;
    const ciclosRef = collection(db, 'users', user.uid, 'ciclos');
    const q = query(ciclosRef, where('ativo', '==', true), where('arquivado', '==', false));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      if (snapshot.empty) {
        setActiveCicloId(null);
        setActiveCicloData(null);
      } else {
        const cicloDoc = snapshot.docs[0];
        setActiveCicloId(cicloDoc.id);
        setActiveCicloData({ id: cicloDoc.id, ...cicloDoc.data() });
      }
    }, (error) => {
      console.error("Erro ao buscar ciclo ativo:", error);
    });

    return () => unsubscribe();
  }, [user]);

  // Busca Registros
  useEffect(() => {
    if (!user) return;
    setLoading(true);
    const q = query(collection(db, 'users', user.uid, 'registrosEstudo'), orderBy('timestamp', 'desc'));

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
    });
    return () => unsubscribe();
  }, [user]);

  useEffect(() => {
    if (loading) return;
    if (!activeCicloId) {
      setActiveRegistrosEstudo([]);
    } else {
      setActiveRegistrosEstudo(allRegistrosEstudo.filter(r => r.cicloId === activeCicloId));
    }
  }, [activeCicloId, allRegistrosEstudo, loading]);

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, 'users', user.uid, 'metas'), orderBy('startDate', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => setGoalsHistory(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))));
    return () => unsubscribe();
  }, [user]);

  // --- Lógica de Timer Global ---

  // Iniciar Timer (Chamado pela CiclosPage ou Atalho da Home)
  const handleStartStudy = (disciplina) => {
    setActiveStudySession({
        disciplina,
        isMinimized: false // Começa Maximizado
    });
  };

  // Finalizar Timer e Salvar
  const handleStopStudy = async (minutes) => {
    if (!activeStudySession) return;

    // Salva no Firebase
    try {
        const data = {
            cicloId: activeCicloId,
            disciplinaId: activeStudySession.disciplina.id,
            disciplinaNome: activeStudySession.disciplina.nome,
            data: dateToYMD(new Date()),
            tempoEstudadoMinutos: minutes,
            questoesFeitas: 0, // Opcional: pode abrir modal pra perguntar questões depois
            acertos: 0,
            obs: 'Sessão cronometrada'
        };
        const collectionRef = collection(db, 'users', user.uid, 'registrosEstudo');
        await addDoc(collectionRef, { ...data, timestamp: Timestamp.now() });

        setActiveStudySession(null); // Fecha timer
    } catch (e) {
        console.error("Erro ao salvar estudo", e);
    }
  };

  const handleCancelStudy = () => {
      if(window.confirm("Deseja cancelar essa sessão? O tempo não será salvo.")) {
          setActiveStudySession(null);
      }
  };

  // Minimizar/Maximizar
  const toggleTimerView = () => {
      setActiveStudySession(prev => ({ ...prev, isMinimized: !prev.isMinimized }));
  };

  // --- Fim Lógica Timer ---

  const deleteRegistro = async (id) => {
    await deleteDoc(doc(db, 'users', user.uid, 'registrosEstudo', id));
  };

  const deleteData = async (collectionName, id) => {
    await deleteDoc(doc(db, 'users', user.uid, collectionName, id));
  };

  const addGoal = async (goalData) => {
    const newGoal = { ...goalData, startDate: dateToYMD(new Date()) };
    await addDoc(collection(db, 'users', user.uid, 'metas'), newGoal);
  };

  const handleLogout = () => {
    signOut(auth).catch((error) => console.error('Logout Error:', error));
  };

  const renderTabContent = () => {
    if (loading && ['home', 'calendar'].includes(activeTab)) {
      return (
        <div className="flex justify-center items-center h-64">
           <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-accent"></div>
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
                activeCicloData={activeCicloData} // Passando dados do ciclo
                onDeleteRegistro={deleteRegistro}
            />
        );
      case 'goals':
        return <GoalsTab goalsHistory={goalsHistory} onAddGoal={addGoal} onDeleteGoal={(id) => deleteData('metas', id)} />;
      case 'calendar':
        return <CalendarTab registrosEstudo={allRegistrosEstudo} goalsHistory={goalsHistory} onDeleteRegistro={deleteRegistro} />;
      case 'ciclos':
        return (
            <CiclosPage
                user={user}
                onStartStudy={handleStartStudy} // Passando a função global de iniciar
                onCicloAtivado={(id) => setActiveCicloId(id)}
            />
        );
      case 'profile':
        return <ProfilePage user={user} allRegistrosEstudo={allRegistrosEstudo} onDeleteRegistro={deleteRegistro} />;
      default:
        return <Home registrosEstudo={activeRegistrosEstudo} goalsHistory={goalsHistory} setActiveTab={setActiveTab} onDeleteRegistro={deleteRegistro} />;
    }
  };

  return (
    <div className="flex min-h-screen bg-background-light dark:bg-background-dark text-text-primary dark:text-text-dark-primary transition-colors duration-300 overflow-x-hidden">

      {/* O TIMER GLOBAL FICA AQUI, ACIMA DE TUDO */}
      {activeStudySession && (
          <StudyTimer
              disciplina={activeStudySession.disciplina}
              isMinimized={activeStudySession.isMinimized}
              onStop={handleStopStudy}
              onCancel={handleCancelStudy}
              onMaximize={() => setActiveStudySession(prev => ({...prev, isMinimized: false}))}
              onMinimize={() => setActiveStudySession(prev => ({...prev, isMinimized: true}))}
          />
      )}

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

      <div className={`flex-grow w-full transition-all duration-300 ease-in-out pt-[80px] px-4 md:px-8 lg:pt-8 pb-10 ${isSidebarExpanded ? 'lg:ml-[260px]' : 'lg:ml-[80px]'}`}>
        <Header user={user} activeTab={activeTab} isDarkMode={isDarkMode} toggleTheme={toggleTheme} />
        <main className="mt-6 max-w-7xl mx-auto animate-fade-in">
          {renderTabContent()}
        </main>
      </div>

      {isMobileOpen && (
        <div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden transition-opacity duration-300" onClick={() => setIsMobileOpen(false)} />
      )}
    </div>
  );
}

export default Dashboard;