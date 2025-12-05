// Dashboard.js (CÓDIGO COMPLETO E FINAL)

import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  collection, onSnapshot, query, orderBy, addDoc, deleteDoc, doc, where, Timestamp
} from 'firebase/firestore';
import { db, auth } from '../firebaseConfig';
import { signOut } from 'firebase/auth';

// Dependências
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import { AnimatePresence, motion } from 'framer-motion';
import { X, CheckCircle2, Download, Calendar } from 'lucide-react';
import ShareCard from '../components/shared/ShareCard';

// Componentes
import NavSideBar from '../components/dashboard/NavSideBar';
import Header from '../components/dashboard/Header';
import Home from '../components/dashboard/Home';
import GoalsTab from '../components/dashboard/GoalsTab';
import CalendarTab from '../components/dashboard/CalendarTab';
import CiclosPage from '../pages/CiclosPage';
import ProfilePage from '../pages/ProfilePage';
import StudyTimer from '../components/ciclos/StudyTimer';
import TimerFinishModal from '../components/ciclos/TimerFinishModal';
import OnboardingTour from '../components/shared/OnboardingTour';

const dateToYMD = (date) => {
  const d = date.getDate();
  const m = date.getMonth() + 1;
  const y = date.getFullYear();
  return '' + y + '-' + (m <= 9 ? '0' + m : m) + '-' + (d <= 9 ? '0' + d : d);
};

// --- ALERTA DE DOWNLOAD ---
const DownloadAlert = ({ isVisible, onDismiss }) => (
  <AnimatePresence>
    {isVisible && (
      <motion.div
        initial={{ y: 50, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 50, opacity: 0 }}
        transition={{ duration: 0.3 }}
        className="fixed bottom-10 left-1/2 transform -translate-x-1/2 z-[10000] p-4 rounded-xl bg-emerald-600 shadow-xl text-white flex items-center gap-3"
      >
        <CheckCircle2 size={24} />
        <span className="font-bold">Download do Cartão iniciado!</span>
        <motion.button whileHover={{ scale: 1.1 }} onClick={onDismiss} className="text-white/80 hover:text-white">
          <X size={18} />
        </motion.button>
      </motion.div>
    )}
  </AnimatePresence>
);

// --- MODAL DE PREVIEW DO SHARECARD (Altura corrigida) ---
const ShareCardPreviewModal = ({ data, onClose, onDownload }) => {
  if (!data) return null;

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-[9999] flex items-center justify-center p-4 sm:p-6"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        <motion.div
          className="absolute inset-0 bg-zinc-900/70 backdrop-blur-sm"
          onClick={onClose}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        />

        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          transition={{ duration: 0.3, ease: 'easeOut' }}
          // CORREÇÃO: max-h ajustado para caber em telas menores
          className="relative bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl border border-zinc-200 dark:border-zinc-800 w-[95%] max-w-lg p-4 sm:p-6 flex flex-col items-center max-h-[90vh] overflow-y-auto"
        >
          <div className="absolute top-3 right-3">
            <button
              onClick={onClose}
              className="p-2 rounded-full bg-white/60 dark:bg-zinc-800/60 hover:bg-red-100 dark:hover:bg-red-900/30 text-zinc-600 hover:text-red-600 transition-all"
            >
              <X size={18} />
            </button>
          </div>

          <h2 className="text-xl font-bold text-zinc-800 dark:text-white mt-4 mb-1">Preview do Cartão</h2>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-4 text-center">
            Visualize como ficará seu cartão antes de baixar.
          </p>

          {/* ShareCard Preview - O cartão renderiza aqui para a captura */}
          <div id="share-card-capture-target" className="mb-4">
            <ShareCard
              stats={data.stats}
              userName={data.userName}
              dayData={data.dayData}
              goals={data.goals}
              isDarkMode={data.isDarkMode}
              disableAnimations={true}
            />
          </div>

          {/* Botões */}
          <div className="flex gap-3 mt-2 mb-2 shrink-0 download-button-wrapper"> {/* Adicionado download-button-wrapper */}
            <button
              onClick={onDownload}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-red-600 text-white font-semibold shadow hover:bg-red-700 transition-all"
            >
              <Download size={16} /> Baixar PDF
            </button>
            <button
              onClick={onClose}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 font-semibold hover:bg-zinc-300 dark:hover:bg-zinc-700 transition-all"
            >
              <X size={16} /> Fechar
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
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

  // --- ESTADOS DE NAVEGAÇÃO E UI ---
  const [activeTab, setActiveTab] = useState('home');
  const [loading, setLoading] = useState(true);
  const [isSidebarExpanded, setIsSidebarExpanded] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [forceOpenVisual, setForceOpenVisual] = useState(false);

  const [sharePreviewData, setSharePreviewData] = useState(null);
  const [isDownloadAlertVisible, setIsDownloadAlertVisible] = useState(false);

  // --- RESTAURADO: ESTADOS DO TOUR ---
  const [tourState, setTourState] = useState({
    isActive: false,
    type: 'main'
  });

  // --- RESTAURADO: ESTADOS DE DADOS DA SESSÃO ---
  const [activeStudySession, setActiveStudySession] = useState(null);
  const [finishModalData, setFinishModalData] = useState(null);


  // --- ESTADOS DE DADOS FIREBASE ---
  const [goalsHistory, setGoalsHistory] = useState([]);
  const [activeCicloId, setActiveCicloId] = useState(null);
  const [activeCicloData, setActiveCicloData] = useState(null);
  const [allRegistrosEstudo, setAllRegistrosEstudo] = useState([]);
  const [activeRegistrosEstudo, setActiveRegistrosEstudo] = useState([]);

  // Agrupa os registros do dia atual para passar ao ShareCard
  const todayStr = dateToYMD(new Date());

  const dayToShareData = useMemo(() => {
    const todayRecords = allRegistrosEstudo.filter(r => r.data === todayStr);

    return {
      dayHours: todayRecords.filter(r => (Number(r.tempoEstudadoMinutos) || Number(r.duracaoMinutos)) > 0),
      dayQuestions: todayRecords.filter(r => (Number(r.questoesFeitas) || 0) > 0),
    };
  }, [allRegistrosEstudo, todayStr]);


  // --- FUNÇÕES DE AÇÃO RESTAURADAS ---

  const addRegistroEstudo = async (data) => {
    try {
      const collectionRef = collection(db, 'users', user.uid, 'registrosEstudo');
      await addDoc(collectionRef, { ...data, timestamp: Timestamp.now() });
    } catch (e) {
      console.error('Erro ao adicionar registro:', e);
    }
  };

  const handleStartStudy = (disciplina) => {
    setActiveStudySession({ disciplina, isMinimized: false });
  };

  const handleStopStudyRequest = (minutes) => {
    if (!activeStudySession) return;
    if (!activeCicloId) {
        alert("Nenhum ciclo ativo encontrado. Ative um ciclo antes de salvar.");
        return;
    }
    setFinishModalData({ minutes, disciplinaNome: activeStudySession.disciplina.nome });
  };

  const handleConfirmFinishStudy = async (questionsResult) => {
    if (!activeStudySession || !finishModalData) return;
    const { minutes } = finishModalData;
    const { questions, correct } = questionsResult;

    try {
        const data = {
            cicloId: activeCicloId,
            disciplinaId: activeStudySession.disciplina.id,
            disciplinaNome: activeStudySession.disciplina.nome,
            data: dateToYMD(new Date()),
            tempoEstudadoMinutos: minutes,
            questoesFeitas: questions,
            acertos: correct,
            obs: 'Sessão via Timer'
        };
        await addRegistroEstudo(data);
        setFinishModalData(null);
        setActiveStudySession(null);
    } catch (e) {
        console.error("Erro ao salvar timer:", e);
    }
  };

  const handleConfirmCancelStudy = () => {
      setActiveStudySession(null);
  };

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

  const handleCicloCreationOrActivation = (cicloId) => {
     setActiveTab('ciclos');
     setForceOpenVisual(true);
     setTimeout(() => setForceOpenVisual(false), 1000);
  };

  const handleGoToActiveCycle = () => {
    if (activeCicloId) {
      handleCicloCreationOrActivation(activeCicloId);
    } else {
      setActiveTab('ciclos');
    }
  };

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    if (tab !== 'ciclos') {
      setForceOpenVisual(false);
    }
  };

  const handleLogout = () => {
    signOut(auth).catch((error) => console.error('Logout Error:', error));
  };

  // --- DOWNLOAD PDF (desativa animações) ---
  const showDownloadSuccess = () => {
    setIsDownloadAlertVisible(true);
    const timer = setTimeout(() => setIsDownloadAlertVisible(false), 3500);
    return () => clearTimeout(timer);
  };

  const handleDownloadPDF = async () => {
    const element = document.getElementById('share-card-capture-target');
    if (!element) return alert('Erro ao capturar cartão.');

    // Remove o botão de download dentro do modal de preview para não aparecer no PDF
    const buttonWrapper = document.querySelector('.download-button-wrapper');
    if (buttonWrapper) buttonWrapper.style.display = 'none';

    try {
      // Usar a mesma lógica de cálculo de alta escala e conversão para MM
      const targetWidthPx = 340; // Tamanho fixo do ShareCard
      const targetHeightPx = element.offsetHeight;
      const scaleFactor = 4.0;

      const canvas = await html2canvas(element, {
        scale: scaleFactor,
        useCORS: true,
        backgroundColor: sharePreviewData.isDarkMode ? '#18181b' : '#ffffff'
      });

      const pxToMm = 0.264583;
      const pdfWidthMm = targetWidthPx * pxToMm;
      const pdfHeightMm = targetHeightPx * pxToMm;

      const imgData = canvas.toDataURL('image/jpeg', 1.0);

      const pdf = new jsPDF({
          orientation: 'p',
          unit: 'mm',
          format: [pdfWidthMm, pdfHeightMm]
      });

      pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidthMm, pdfHeightMm);
      pdf.save(`Progresso_${dateToYMD(new Date())}.pdf`);

      setSharePreviewData(null); // Fecha o modal após o download
      showDownloadSuccess();

    } catch (e) {
      console.error('Erro ao gerar PDF:', e);
      alert('Falha ao gerar PDF.');
    } finally {
      // RESTAURA o botão de download, caso ele não tenha sido fechado
      if (buttonWrapper) buttonWrapper.style.display = 'flex';
    }
  };


  // --- Abrir preview ---
  const handleShareGoal = (stats) => {
    const previewData = {
      stats: stats,
      userName: user.displayName || 'Estudante',
      dayData: dayToShareData,
      goals: goalsHistory[0] || { questions: 0, hours: 0 },
      isDarkMode: isDarkMode
    };
    setSharePreviewData(previewData);
  };

  // --- Firebase e Ciclos (restante inalterado) ---
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
    });
    return () => unsubscribe();
  }, [user]);

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    const q = query(collection(db, 'users', user.uid, 'registrosEstudo'), orderBy('timestamp', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const registros = snapshot.docs.map(doc => {
        const data = doc.data();
        let dataStr = data.data;
        if (data.data && typeof data.data.toDate === 'function') dataStr = dateToYMD(data.data.toDate());
        if (!dataStr && data.timestamp && typeof data.timestamp.toDate === 'function')
          dataStr = dateToYMD(data.timestamp.toDate());
        return { id: doc.id, ...data, data: dataStr, tempoEstudadoMinutos: data.tempoEstudadoMinutos, questoesFeitas: data.questoesFeitas, acertos: data.acertos };
      });
      setAllRegistrosEstudo(registros);
      setLoading(false);
    });
    return () => unsubscribe();
  }, [user]);

  useEffect(() => {
    if (loading) return;
    if (!activeCicloId) setActiveRegistrosEstudo([]);
    else setActiveRegistrosEstudo(allRegistrosEstudo.filter(r => r.cicloId === activeCicloId));
  }, [activeCicloId, allRegistrosEstudo, loading]);

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, 'users', user.uid, 'metas'), orderBy('startDate', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) =>
      setGoalsHistory(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })))
    );
    return () => unsubscribe();
  }, [user]);

  // --- Render Tabs ---
  const renderTabContent = () => {
    if (loading && ['home', 'calendar'].includes(activeTab)) {
      return (
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-accent mx-auto mb-4"></div>
        </div>
      );
    }
    switch (activeTab) {
      case 'home':
        return (
          <Home
            registrosEstudo={activeRegistrosEstudo}
            goalsHistory={goalsHistory}
            setActiveTab={handleGoToActiveCycle}
            activeCicloData={activeCicloData}
            onDeleteRegistro={deleteRegistro}
          />
        );
      case 'goals':
        return (
          <GoalsTab
            goalsHistory={goalsHistory}
            onSetGoal={addGoal}
            onDeleteGoal={(id) => deleteData('metas', id)}
          />
        );
      case 'calendar':
        return <CalendarTab registrosEstudo={allRegistrosEstudo} goalsHistory={goalsHistory} onDeleteRegistro={deleteRegistro} />;
      case 'ciclos':
        return (
          <CiclosPage
            user={user}
            onStartStudy={handleStartStudy}
            onCicloAtivado={handleCicloCreationOrActivation}
            addRegistroEstudo={addRegistroEstudo}
            activeCicloId={activeCicloId}
            forceOpenVisual={forceOpenVisual}
          />
        );
      case 'profile':
        return <ProfilePage user={user} allRegistrosEstudo={allRegistrosEstudo} onDeleteRegistro={deleteRegistro} />;
      default:
        return null;
    }
  };


  return (
    <div className="flex min-h-screen bg-background-light dark:bg-background-dark text-text-primary dark:text-text-dark-primary transition-colors duration-300 overflow-x-hidden">

      <DownloadAlert isVisible={isDownloadAlertVisible} onDismiss={() => setIsDownloadAlertVisible(false)} />

      <ShareCardPreviewModal
        data={sharePreviewData}
        onClose={() => setSharePreviewData(null)}
        onDownload={handleDownloadPDF}
      />

      {/* --- Elemento Invisível para Captura (Fora da tela) --- */}
      {/* Renderiza o ShareCard na opacidade zero para captura do PDF */}
      {sharePreviewData && (
          <div className="fixed top-0 left-0 -translate-x-full z-[-1000] opacity-0">
             <ShareCard
                 stats={sharePreviewData.stats}
                 userName={user.displayName || 'Estudante'}
                 dayData={sharePreviewData.dayData}
                 goals={sharePreviewData.goals}
                 isDarkMode={sharePreviewData.isDarkMode}
             />
          </div>
      )}
      {/* -------------------------------------------------- */}

      <NavSideBar
        user={user}
        activeTab={activeTab}
        setActiveTab={handleTabChange}
        handleLogout={handleLogout}
        isExpanded={isSidebarExpanded}
        setExpanded={setIsSidebarExpanded}
        isMobileOpen={isMobileOpen}
        setMobileOpen={setIsMobileOpen}
      />

      <div className={`flex-grow w-full transition-all duration-300 pt-[80px] px-4 md:px-8 lg:pt-8 pb-10 ${isSidebarExpanded ? 'lg:ml-[260px]' : 'lg:ml-[80px]'}`}>

        <Header
          user={user}
          activeTab={activeTab}
          isDarkMode={isDarkMode}
          toggleTheme={toggleTheme}
          registrosEstudo={allRegistrosEstudo}
          goalsHistory={goalsHistory}
          activeCicloId={activeCicloId}
          onShareGoal={handleShareGoal}
        />
        <main className="mt-6 max-w-7xl mx-auto animate-fade-in">{renderTabContent()}</main>
      </div>

      {/* --- RESTAURADO: TOUR INTERATIVO, TIMER, MODAIS --- */}
      <OnboardingTour
         isActive={tourState.isActive}
         tourType={tourState.type}
         activeTab={activeTab}
         setActiveTab={handleTabChange}
         onClose={() => setTourState({ isActive: false, type: 'main' })}
         onFinish={() => setTourState({ isActive: false, type: 'main' })}
      />

      {activeStudySession && (
          <StudyTimer
              disciplina={activeStudySession.disciplina}
              isMinimized={activeStudySession.isMinimized}
              onStop={handleStopStudyRequest}
              onCancel={handleConfirmCancelStudy}
              onMaximize={() => setActiveStudySession(prev => ({...prev, isMinimized: false}))}
              onMinimize={() => setActiveStudySession(prev => ({...prev, isMinimized: true}))}
          />
      )}

      {finishModalData && (
        <TimerFinishModal
          timeMinutes={finishModalData.minutes}
          disciplinaNome={finishModalData.disciplinaNome}
          onConfirm={handleConfirmFinishStudy}
          onCancel={() => setFinishModalData(null)}
        />
      )}

      {isMobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden"
          onClick={() => setIsMobileOpen(false)}
        />
      )}
    </div>
  );
}

export default Dashboard;