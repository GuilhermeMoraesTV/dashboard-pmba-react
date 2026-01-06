import React, { useState, useEffect, useMemo } from 'react';
import {
  collection, onSnapshot, query, orderBy, addDoc, deleteDoc, doc, where, Timestamp
} from 'firebase/firestore';
import { db, auth } from '../firebaseConfig';
import { signOut } from 'firebase/auth';

import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import { AnimatePresence, motion } from 'framer-motion';
import { X, CheckCircle2, Download, AlertTriangle, Maximize2 } from 'lucide-react';
import ShareCard from '../components/shared/ShareCard';

import NavSideBar from '../components/dashboard/NavSideBar';
import Header from '../components/dashboard/Header';
import Home from '../components/dashboard/Home';
import GoalsTab from '../components/dashboard/GoalsTab';
import CalendarTab from '../components/dashboard/CalendarTab';
import CiclosPage from '../pages/CiclosPage';
import ProfilePage from '../pages/ProfilePage';
import AdminPage from '../pages/AdminPage';
import EditalPage from '../pages/EditalPage';
import Desempenho from '../pages/PerformanceHub';
import StudyTimer from '../components/ciclos/StudyTimer';
import TimerFinishModal from '../components/ciclos/TimerFinishModal';
import OnboardingTour from '../components/shared/OnboardingTour';

const ADMIN_UID = 'OLoJi457GQNE2eTSOcz9DAD6ppZ2';
const STORAGE_KEY = '@ModoQAP:ActiveSession';

const dateToYMD = (date) => {
  const d = date.getDate();
  const m = date.getMonth() + 1;
  const y = date.getFullYear();
  return '' + y + '-' + (m <= 9 ? '0' + m : m) + '-' + (d <= 9 ? '0' + d : d);
};

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
        <motion.div className="absolute inset-0 bg-zinc-900/70 backdrop-blur-sm" onClick={onClose} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} />
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          transition={{ duration: 0.3, ease: 'easeOut' }}
          className="relative bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl border border-zinc-200 dark:border-zinc-800 w-[95%] max-w-lg p-4 sm:p-6 flex flex-col items-center max-h-[90vh] overflow-y-auto"
        >
            <div className="absolute top-3 right-3">
              <button onClick={onClose} className="p-2 rounded-full bg-white/60 dark:bg-zinc-800/60 hover:bg-red-100 dark:hover:bg-red-900/30 text-zinc-600 hover:text-red-600 transition-all">
                <X size={18} />
              </button>
            </div>
            <h2 className="text-xl font-bold text-zinc-800 dark:text-white mt-4 mb-1">Preview do Cartão</h2>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-4 text-center">Visualize como ficará seu cartão antes de baixar.</p>
            <div id="share-card-capture-target" className="mb-4">
              <ShareCard stats={data.stats} userName={data.userName} dayData={data.dayData} goals={data.goals} isDarkMode={data.isDarkMode} disableAnimations={true} />
            </div>
            <div className="flex gap-3 mt-2 mb-2 shrink-0 download-button-wrapper">
              <button onClick={onDownload} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-red-600 text-white font-semibold shadow hover:bg-red-700 transition-all">
                <Download size={16} /> Baixar PDF
              </button>
              <button onClick={onClose} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 font-semibold hover:bg-zinc-300 dark:hover:bg-zinc-700 transition-all">
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

  // --- ESTADOS ---
  const [activeTab, setActiveTab] = useState('home');
  const [loading, setLoading] = useState(true);
  const [isSidebarExpanded, setIsSidebarExpanded] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [forceOpenVisual, setForceOpenVisual] = useState(false);

  const [sharePreviewData, setSharePreviewData] = useState(null);
  const [isDownloadAlertVisible, setIsDownloadAlertVisible] = useState(false);

  // Tour e Sessão
  const [tourState, setTourState] = useState({ isActive: false, type: 'main' });
  const [activeStudySession, setActiveStudySession] = useState(null);
  const [finishModalData, setFinishModalData] = useState(null);

  // --- NOVO: Estado para Registro Pendente ---
  const [pendingReviewData, setPendingReviewData] = useState(null);

  const [goalsHistory, setGoalsHistory] = useState([]);
  const [activeCicloId, setActiveCicloId] = useState(null);
  const [activeCicloData, setActiveCicloData] = useState(null);
  const [allRegistrosEstudo, setAllRegistrosEstudo] = useState([]);
  const [activeRegistrosEstudo, setActiveRegistrosEstudo] = useState([]);
  const [activeCycleDisciplines, setActiveCycleDisciplines] = useState([]);

  const todayStr = dateToYMD(new Date());

  const dayToShareData = useMemo(() => {
    const todayRecords = allRegistrosEstudo.filter(r => r.data === todayStr);
    return {
      dayHours: todayRecords.filter(r => (Number(r.tempoEstudadoMinutos) || Number(r.duracaoMinutos)) > 0),
      dayQuestions: todayRecords.filter(r => (Number(r.questoesFeitas) || 0) > 0),
    };
  }, [allRegistrosEstudo, todayStr]);

  // --- RESTAURAÇÃO DE SESSÃO / PENDÊNCIA ---
  useEffect(() => {
    const savedSession = localStorage.getItem(STORAGE_KEY);
    if (savedSession) {
      try {
        const parsed = JSON.parse(savedSession);

        if (parsed && parsed.disciplinaId && parsed.disciplinaNome) {

          // CASO 1: Foi desligado durante o "Finalizar" (isFinishing = true)
          // Em vez de abrir o modal direto, mostramos o Widget Amarelo de Pendência
          if (parsed.isFinishing && parsed.tempMinutes) {
              setPendingReviewData({
                  minutes: parsed.tempMinutes,
                  disciplinaNome: parsed.disciplinaNome,
                  assuntoInicial: parsed.assunto,
                  reason: 'Sessão interrompida (Atualização/Fechamento)',
                  originalData: parsed
              });
          }
          // CASO 2: Apenas um refresh normal com timer rodando ou pausado
          else {
              // Se estava rodando, marcamos como pausado no restore para segurança
              if(!parsed.isPaused) {
                parsed.isPaused = true;
                localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed));
              }

              setActiveStudySession({
                disciplina: {
                  id: parsed.disciplinaId,
                  nome: parsed.disciplinaNome
                },
                assunto: parsed.assunto,
                isMinimized: true
              });
          }
        }
      } catch (e) {
        console.error("Erro ao restaurar sessão:", e);
        localStorage.removeItem(STORAGE_KEY);
      }
    }
  }, []);

  // --- ACTIONS ---
  const addRegistroEstudo = async (data) => {
    try {
      const collectionRef = collection(db, 'users', user.uid, 'registrosEstudo');
      await addDoc(collectionRef, { ...data, timestamp: Timestamp.now() });
    } catch (e) {
      console.error('Erro ao adicionar registro:', e);
    }
  };

  const handleStartStudy = (disciplina, assunto = null) => {
    setActiveStudySession({ disciplina, assunto, isMinimized: false });
  };

  const handleStopStudyRequest = (minutes) => {
    if (!activeStudySession) return;
    if (!activeCicloId) {
        alert("Nenhum ciclo ativo encontrado. Ative um ciclo antes de salvar.");
        return;
    }

    // Salva estado de finalização no storage com o tempo que veio do Timer
    // O StudyTimer já salvou o accumulatedTime exato, aqui adicionamos a flag de finalização
    const currentStorage = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');

    // Atualiza storage com a intenção de finalizar
    const updatedStorage = {
        ...currentStorage,
        isFinishing: true,
        tempMinutes: minutes, // Armazena os minutos calculados
        isPaused: true
    };

    localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedStorage));

    setFinishModalData({
        minutes,
        disciplinaNome: activeStudySession.disciplina.nome,
        assuntoInicial: activeStudySession.assunto
    });
  };

  const handleRetomarEstudo = () => {
      // 1. Limpa os modais
      setFinishModalData(null);
      setPendingReviewData(null);

      // 2. Manipula o Storage
      const currentStorage = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');

      if (currentStorage.disciplinaId) {
          // Remove flags de finalização
          delete currentStorage.isFinishing;
          delete currentStorage.tempMinutes;
          // Garante que volta pausado
          currentStorage.isPaused = true;

          localStorage.setItem(STORAGE_KEY, JSON.stringify(currentStorage));

          // 3. Recria a sessão visualmente
          setActiveStudySession({
              disciplina: {
                  id: currentStorage.disciplinaId,
                  nome: currentStorage.disciplinaNome
              },
              assunto: currentStorage.assunto,
              isMinimized: false // Maximiza para o usuário ver
          });
      }
  };

  const handleConfirmCancelStudy = () => {
      setActiveStudySession(null);
      setFinishModalData(null);
      setPendingReviewData(null);
      localStorage.removeItem(STORAGE_KEY);
  };

  const handleConfirmFinishStudy = async (resultData) => {
    const dataRef = finishModalData || pendingReviewData;

    if (!dataRef) return;
    const { minutes } = dataRef;

    const {
        questions,
        correct,
        obs,
        assunto,
        disciplinaNomeCorrigido,
        markAsFinished
    } = resultData;

    const nomeDisciplinaFinal = disciplinaNomeCorrigido || dataRef.disciplinaNome;

    try {
        const storageData = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
        const finalDisciplinaId = activeStudySession?.disciplina?.id || storageData.disciplinaId || 'restored_id';

        const registroEstudoData = {
            cicloId: activeCicloId,
            disciplinaId: finalDisciplinaId,
            disciplinaNome: nomeDisciplinaFinal,
            data: dateToYMD(new Date()),
            tempoEstudadoMinutos: minutes,
            questoesFeitas: questions,
            acertos: correct,
            obs: obs || 'Sessão via Timer',
            assunto: assunto || null,
            timestamp: Timestamp.now()
        };

        await addRegistroEstudo(registroEstudoData);

        if (markAsFinished && assunto) {
             const checkData = {
                cicloId: activeCicloId,
                disciplinaId: finalDisciplinaId,
                disciplinaNome: nomeDisciplinaFinal,
                assunto: assunto,
                data: dateToYMD(new Date()),
                timestamp: Timestamp.now(),
                tempoEstudadoMinutos: 0,
                questoesFeitas: 0,
                acertos: 0,
                tipoEstudo: 'check_manual',
                obs: 'Concluído via Timer'
            };
            await addDoc(collection(db, 'users', user.uid, 'registrosEstudo'), checkData);
        }

        setFinishModalData(null);
        setPendingReviewData(null);
        setActiveStudySession(null);
        localStorage.removeItem(STORAGE_KEY);

    } catch (e) {
        console.error("Erro ao salvar timer:", e);
        alert("Erro ao salvar sessão. Verifique sua conexão.");
    }
  };

  const deleteRegistro = async (id) => { await deleteDoc(doc(db, 'users', user.uid, 'registrosEstudo', id)); };
  const deleteData = async (collectionName, id) => { await deleteDoc(doc(db, 'users', user.uid, collectionName, id)); };

  const addGoal = async (goalData) => {
    const newGoal = { ...goalData, startDate: dateToYMD(new Date()) };
    await addDoc(collection(db, 'users', user.uid, 'metas'), newGoal);
  };

  const handleTourCloseOrFinish = (type) => {
    if (user) localStorage.setItem(`onboarding_seen_${user.uid}_${type}`, 'true');
    setTourState({ isActive: false, type: 'main' });
  };

  const handleCicloCreationOrActivation = (cicloId) => {
     setActiveTab('ciclos');
     setForceOpenVisual(true);
     setTimeout(() => setForceOpenVisual(false), 1000);
     if (user) {
        const cycleTourSeen = localStorage.getItem(`onboarding_seen_${user.uid}_cycle_visual`);
        if (!cycleTourSeen) setTourState({ isActive: true, type: 'cycle_visual' });
     }
  };

  const handleGoToActiveCycle = () => {
    if (activeCicloId) handleCicloCreationOrActivation(activeCicloId);
    else setActiveTab('ciclos');
  };

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    if (tab !== 'ciclos') setForceOpenVisual(false);
  };

  const handleLogout = () => {
    signOut(auth).catch((error) => console.error('Logout Error:', error));
  };

  const handleDownloadPDF = async () => {
    const element = document.getElementById('share-card-capture-target');
    if (!element) return alert('Erro ao capturar cartão.');
    const buttonWrapper = document.querySelector('.download-button-wrapper');
    if (buttonWrapper) buttonWrapper.style.display = 'none';

    try {
      const targetWidthPx = 340;
      const targetHeightPx = element.offsetHeight;
      const scaleFactor = 4.0;
      const canvas = await html2canvas(element, { scale: scaleFactor, useCORS: true, backgroundColor: sharePreviewData.isDarkMode ? '#18181b' : '#ffffff' });
      const pxToMm = 0.264583;
      const pdfWidthMm = targetWidthPx * pxToMm;
      const pdfHeightMm = targetHeightPx * pxToMm;
      const imgData = canvas.toDataURL('image/jpeg', 1.0);
      const pdf = new jsPDF({ orientation: 'p', unit: 'mm', format: [pdfWidthMm, pdfHeightMm] });
      pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidthMm, pdfHeightMm);
      pdf.save(`Progresso_${dateToYMD(new Date())}.pdf`);
      setSharePreviewData(null);
      showDownloadSuccess();
    } catch (e) {
      console.error('Erro ao gerar PDF:', e);
      alert('Falha ao gerar PDF.');
    } finally {
      if (buttonWrapper) buttonWrapper.style.display = 'flex';
    }
  };

  const showDownloadSuccess = () => {
    setIsDownloadAlertVisible(true);
    setTimeout(() => setIsDownloadAlertVisible(false), 3500);
  };

  const handleShareGoal = (stats) => {
    setSharePreviewData({
      stats: stats,
      userName: user.displayName || 'Estudante',
      dayData: dayToShareData,
      goals: goalsHistory[0] || { questions: 0, hours: 0 },
      isDarkMode: isDarkMode
    });
  };

  // Efeitos
  useEffect(() => {
    if (!user || loading) return;
    const tourType = 'main';
    const hasSeen = localStorage.getItem(`onboarding_seen_${user.uid}_${tourType}`);
    const isTrulyNew = goalsHistory.length === 0 && allRegistrosEstudo.length === 0;
    if (!hasSeen && isTrulyNew) setTourState({ isActive: true, type: tourType });
    else if (!isTrulyNew && !hasSeen) handleTourCloseOrFinish(tourType);
  }, [user, loading, goalsHistory.length, allRegistrosEstudo.length]);

  useEffect(() => {
    if (!user) return;
    const ciclosRef = collection(db, 'users', user.uid, 'ciclos');
    const q = query(ciclosRef, where('ativo', '==', true), where('arquivado', '==', false));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      if (snapshot.empty) { setActiveCicloId(null); setActiveCicloData(null); }
      else { const cicloDoc = snapshot.docs[0]; setActiveCicloId(cicloDoc.id); setActiveCicloData({ id: cicloDoc.id, ...cicloDoc.data() }); }
    });
    return () => unsubscribe();
  }, [user]);

  useEffect(() => {
    if (!user || !activeCicloId) {
        setActiveCycleDisciplines([]);
        return;
    }
    const q = query(collection(db, 'users', user.uid, 'ciclos', activeCicloId, 'disciplinas'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
        const discs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setActiveCycleDisciplines(discs);
    });
    return () => unsubscribe();
  }, [user, activeCicloId]);

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    const q = query(collection(db, 'users', user.uid, 'registrosEstudo'), orderBy('timestamp', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const registros = snapshot.docs.map(doc => {
        const data = doc.data();
        let dataStr = data.data;
        if (data.data && typeof data.data.toDate === 'function') dataStr = dateToYMD(data.data.toDate());
        if (!dataStr && data.timestamp && typeof data.timestamp.toDate === 'function') dataStr = dateToYMD(data.timestamp.toDate());
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
    const unsubscribe = onSnapshot(q, (snapshot) => setGoalsHistory(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))));
    return () => unsubscribe();
  }, [user]);

  const renderTabContent = () => {
    if (loading && ['home', 'calendar', 'stats'].includes(activeTab)) {
      return (
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-accent mx-auto mb-4"></div>
        </div>
      );
    }
    switch (activeTab) {
      case 'home':
        return <Home registrosEstudo={activeRegistrosEstudo} goalsHistory={goalsHistory} setActiveTab={handleGoToActiveCycle} activeCicloData={activeCicloData} onDeleteRegistro={deleteRegistro} />;
      case 'goals':
        return <GoalsTab goalsHistory={goalsHistory} onSetGoal={addGoal} onDeleteGoal={(id) => deleteData('metas', id)} />;
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
                onGoToEdital={() => setActiveTab('edital')}
                registrosEstudo={allRegistrosEstudo}
            />
        );
      case 'edital':
        return (
            <EditalPage
                user={user}
                activeCicloId={activeCicloId}
                onStartStudy={handleStartStudy}
                onBack={handleGoToActiveCycle}
            />
        );
      case 'stats':
        return (
          <Desempenho
            registrosEstudo={allRegistrosEstudo}
            disciplinasDoCiclo={activeCycleDisciplines}
            activeCicloId={activeCicloId}
            metas={goalsHistory}
            onCreateCycle={() => setActiveTab('ciclos')}
          />
        );
      case 'profile':
        return <ProfilePage user={user} allRegistrosEstudo={allRegistrosEstudo} onDeleteRegistro={deleteRegistro} />;
      case 'admin':
        if (user.uid === ADMIN_UID) {
            return <AdminPage />;
        }
        return <div className="p-8 text-center text-red-500 font-bold">Acesso Negado</div>;
      default:
        return null;
    }
  };

  return (
    <div className="flex min-h-screen bg-background-light dark:bg-background-dark text-text-primary dark:text-text-dark-primary transition-colors duration-300 overflow-x-hidden">
      <DownloadAlert isVisible={isDownloadAlertVisible} onDismiss={() => setIsDownloadAlertVisible(false)} />
      <ShareCardPreviewModal data={sharePreviewData} onClose={() => setSharePreviewData(null)} onDownload={handleDownloadPDF} />
      {sharePreviewData && (
          <div className="fixed top-0 left-0 -translate-x-full z-[-1000] opacity-0">
             <ShareCard stats={sharePreviewData.stats} userName={user.displayName || 'Estudante'} dayData={sharePreviewData.dayData} goals={sharePreviewData.goals} isDarkMode={sharePreviewData.isDarkMode} />
          </div>
      )}
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
        <Header user={user} activeTab={activeTab} isDarkMode={isDarkMode} toggleTheme={toggleTheme} registrosEstudo={allRegistrosEstudo} goalsHistory={goalsHistory} activeCicloId={activeCicloId} onShareGoal={handleShareGoal} />
        <main className="mt-6 max-w-7xl mx-auto animate-fade-in">{renderTabContent()}</main>
      </div>
      <OnboardingTour isActive={tourState.isActive} tourType={tourState.type} activeTab={activeTab} setActiveTab={handleTabChange} onClose={() => handleTourCloseOrFinish(tourState.type)} onFinish={() => handleTourCloseOrFinish(tourState.type)} />

      {activeStudySession && (
          <StudyTimer
            disciplina={activeStudySession.disciplina}
            assunto={activeStudySession.assunto}
            isMinimized={activeStudySession.isMinimized}
            onStop={handleStopStudyRequest}
            onCancel={handleConfirmCancelStudy}
            onMaximize={() => setActiveStudySession(prev => ({...prev, isMinimized: false}))}
            onMinimize={() => setActiveStudySession(prev => ({...prev, isMinimized: true}))}
          />
      )}

      {/* --- WIDGET PENDENTE DE REGISTRO (AMARELO) --- */}
      {pendingReviewData && !finishModalData && (
          <div className="fixed bottom-24 right-4 z-[9999] animate-fade-in">
            <div
              onClick={() => setFinishModalData(pendingReviewData)}
              className="bg-amber-900/90 backdrop-blur-md border border-amber-500/50 shadow-[0_0_20px_rgba(245,158,11,0.2)] rounded-2xl p-3 flex items-center gap-4 w-auto max-w-[320px] overflow-hidden hover:scale-105 transition-transform cursor-pointer"
            >
              <div className="relative flex items-center justify-center w-10 h-10 bg-amber-800 rounded-full shrink-0">
                <div className="absolute inset-0 rounded-full bg-amber-500/20 animate-ping"></div>
                <AlertTriangle size={20} className="text-amber-200 relative z-10" />
              </div>
              <div className="flex flex-col mr-2 min-w-0">
                <span className="text-[10px] text-amber-200 uppercase font-bold tracking-wider truncate">Registro Pendente</span>
                <span className="text-[10px] text-white truncate leading-tight font-bold">{pendingReviewData.disciplinaNome}</span>
                <span className="text-[9px] text-amber-300/80 italic mt-0.5 truncate">{pendingReviewData.reason}</span>
              </div>
              <div className="p-2 rounded-full bg-amber-800/50 text-amber-100 hover:bg-amber-700/50 transition-colors">
                  <Maximize2 size={16} />
              </div>
            </div>
          </div>
      )}

      {(finishModalData || (pendingReviewData && finishModalData)) && (
        <TimerFinishModal
          timeMinutes={finishModalData.minutes}
          disciplinaNome={finishModalData.disciplinaNome}
          initialAssunto={finishModalData.assuntoInicial}
          disciplinaId={activeStudySession?.disciplina?.id || pendingReviewData?.originalData?.disciplinaId}
          activeCicloId={activeCicloId}
          userUid={user.uid}
          onConfirm={handleConfirmFinishStudy}
          onCancel={handleRetomarEstudo}
          onDiscard={handleConfirmCancelStudy}
        />
      )}

      {isMobileOpen && <div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden" onClick={() => setIsMobileOpen(false)} />}
    </div>
  );
}

export default Dashboard;