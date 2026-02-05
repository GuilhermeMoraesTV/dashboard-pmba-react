import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  collection, onSnapshot, query, orderBy, addDoc, deleteDoc, doc, where, Timestamp
} from 'firebase/firestore';
import { db, auth } from '../firebaseConfig';
import { signOut } from 'firebase/auth';

import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import { AnimatePresence, motion } from 'framer-motion';
import { X, CheckCircle2, Download, AlertTriangle, Maximize2, ClipboardList, AlertCircle } from 'lucide-react';
import ShareCard from '../components/shared/ShareCard';

// --- IMPORTS DE COMPONENTES ---
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
import BroadcastReceiver from '../components/shared/BroadcastReceiver';
import FeedbackWidget from '../components/FeedbackWidget';

// --- IMPORTS DE SIMULADO ---
import SimuladosPage from '../pages/SimuladosPage';
import SimuladoTimer from '../pages/SimuladosPage/SimuladoTimer';

const ADMIN_UID = 'OLoJi457GQNE2eTSOcz9DAD6ppZ2';

const dateToYMD = (date) => {
  const d = date.getDate();
  const m = date.getMonth() + 1;
  const y = date.getFullYear();
  return '' + y + '-' + (m <= 9 ? '0' + m : m) + '-' + (d <= 9 ? '0' + d : d);
};

// --- COMPONENTES AUXILIARES ---

// 1. Alerta de Conflito (Visual Bonito)
const WarningModal = ({ isOpen, onClose, title, message }) => {
  if (!isOpen) return null;
  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-[10001] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.95, opacity: 0, y: 10 }}
          transition={{ type: "spring", duration: 0.5 }}
          className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-2xl p-6 w-full max-w-md relative overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Background decorativo */}
          <div className="absolute top-0 left-0 w-full h-1 bg-amber-500" />

          <div className="flex flex-col items-center text-center">
            <div className="w-16 h-16 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center mb-4 text-amber-600 dark:text-amber-500">
              <AlertCircle size={32} strokeWidth={2.5} />
            </div>

            <h3 className="text-xl font-bold text-zinc-900 dark:text-white mb-2">
              {title}
            </h3>

            <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-6 leading-relaxed">
              {message}
            </p>

            <button
              onClick={onClose}
              className="w-full py-3 rounded-xl bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 font-bold hover:opacity-90 transition-opacity"
            >
              Entendi
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
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

// --- COMPONENTE PRINCIPAL ---
function Dashboard({ user, isDarkMode, toggleTheme }) {
  if (!user) {
    return (
      <div className="flex justify-center items-center min-h-screen bg-background-light dark:bg-background-dark">
        <div className="text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-red-600 mx-auto mb-4"></div>
          <h2 className="text-lg font-medium text-gray-600 dark:text-gray-300">Carregando...</h2>
        </div>
      </div>
    );
  }

  // ✅ CHAVES DE STORAGE LOCAIS (Fallback)
  const STUDY_STORAGE_KEY = useMemo(() => `@ModoQAP:ActiveSession:${user.uid}`, [user.uid]);
  const SIMULADO_STORAGE_KEY = useMemo(() => `@ModoQAP:SimuladoActive:${user.uid}`, [user.uid]);
  const SIMULADO_PENDING_KEY = useMemo(() => `@ModoQAP:SimuladoPending:${user.uid}`, [user.uid]);

  // --- ESTADOS DE UI ---
  const [activeTab, setActiveTab] = useState('home');
  const [loading, setLoading] = useState(true);
  const [isSidebarExpanded, setIsSidebarExpanded] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [forceOpenVisual, setForceOpenVisual] = useState(false);
  const [isTimerRaised, setIsTimerRaised] = useState(false);
  const [sharePreviewData, setSharePreviewData] = useState(null);
  const [isDownloadAlertVisible, setIsDownloadAlertVisible] = useState(false);
  const [tourState, setTourState] = useState({ isActive: false, type: 'main' });
  const [isFeedbackOpen, setIsFeedbackOpen] = useState(false);

  // --- NOVO: Estado para o Alerta de Conflito ---
  const [warningAlert, setWarningAlert] = useState({ isOpen: false, title: '', message: '' });

  // --- ESTADOS DE SESSÃO (Estudo) ---
  const [activeStudySession, setActiveStudySession] = useState(null);
  const [finishModalData, setFinishModalData] = useState(null);
  const [pendingReviewData, setPendingReviewData] = useState(null);

  // --- ESTADOS DE SESSÃO (Simulado) ---
  const [activeSimuladoSession, setActiveSimuladoSession] = useState(null);
  const [finishedSimuladoData, setFinishedSimuladoData] = useState(null);
  const [pendingSimuladoReview, setPendingSimuladoReview] = useState(null);

  // --- DADOS DO FIRESTORE ---
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

  // --- HANDLERS DE LIMPEZA ---
  useEffect(() => {
    const handleTimerRaise = (event) => setIsTimerRaised(event.detail);
    window.addEventListener('toggle-timer-raise', handleTimerRaise);
    return () => window.removeEventListener('toggle-timer-raise', handleTimerRaise);
  }, []);

  const clearActiveTimerDoc = useCallback(async () => {
    try { await deleteDoc(doc(db, 'active_timers', user.uid)); } catch {}
  }, [user?.uid]);

  const clearActiveSimuladoDoc = useCallback(async () => {
    try { await deleteDoc(doc(db, `users/${user.uid}/personal_timers/active_simulado`)); } catch {}
  }, [user?.uid]);

  // -------------------------------------------------------------
  // 🔥 SINCRONIZAÇÃO EM TEMPO REAL (CROSS-DEVICE & CROSS-TAB)
  // -------------------------------------------------------------

  // 1. Ouvinte: Timer de Estudo Ativo
  useEffect(() => {
    if (!user) return;
    const activeStudyRef = doc(db, 'active_timers', user.uid);

    const unsubscribe = onSnapshot(activeStudyRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();

        // Se for um timer do tipo 'simulado' gravado aqui por engano, ignoramos
        if (data.isSimulado) return;

        // Se o status for 'finished', não montamos o timer (deixamos o modal de conclusão lidar)
        if (data.status === 'finishing' || data.status === 'finished') return;

        // Atualiza estado local se diferente (garante sync entre abas)
        setActiveStudySession(prev => {
          // Se já existe e é igual, não faz nada para evitar re-render
          if (prev && prev.disciplina.id === data.disciplinaId && prev.assunto === data.assunto) return prev;

          return {
            disciplina: { id: data.disciplinaId, nome: data.disciplinaNome },
            assunto: data.assunto,
            isMinimized: true // Ao syncar de outro device, inicia minimizado
          };
        });
      } else {
        // Se o documento sumiu do banco, e não estamos finalizando, limpa o estado
        if (!finishModalData && !pendingReviewData) {
           setActiveStudySession(null);
        }
      }
    });

    return () => unsubscribe();
  }, [user, finishModalData, pendingReviewData]);

  // 2. Ouvinte: Timer de Simulado Ativo
  useEffect(() => {
    if (!user) return;
    const activeSimRef = doc(db, 'users', user.uid, 'personal_timers', 'active_simulado');

    const unsubscribe = onSnapshot(activeSimRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();

        // Se já foi finalizado, não restaura aqui
        if (data.status === 'finished') return;

        setActiveSimuladoSession(prev => {
           if (prev && prev.titulo === data.titulo) return prev;
           return {
             titulo: data.titulo,
             mode: data.mode,
             initialSeconds: data.initialSeconds || 0,
             isMinimized: true // Ao syncar, inicia minimizado
           };
        });
      } else {
        // Se sumiu do banco, limpa estado local (a menos que esteja no fluxo de conclusão)
        if (!finishedSimuladoData) {
           setActiveSimuladoSession(null);
        }
      }
    });

    return () => unsubscribe();
  }, [user, finishedSimuladoData]);


  // -------------------------------------------------------------
  // RESTAURAÇÃO LOCAL (FALLBACK / REFRESH)
  // -------------------------------------------------------------
  useEffect(() => {
    // Tenta restaurar dados pendentes de conclusão (que não estão mais no active_timer)
    const savedStudy = localStorage.getItem(STUDY_STORAGE_KEY);
    if (savedStudy) {
      try {
        const parsed = JSON.parse(savedStudy);
        // Se estava finalizando, restaura o modal de conclusão
        if (parsed.isFinishing && parsed.tempMinutes) {
            clearActiveTimerDoc();
            setPendingReviewData({
              minutes: parsed.tempMinutes,
              disciplinaNome: parsed.disciplinaNome,
              assuntoInicial: parsed.assunto,
              reason: 'Sessão interrompida (Atualização/Fechamento)',
              originalData: parsed
            });
        }
      } catch (e) {}
    }

    const pendingSimulado = localStorage.getItem(SIMULADO_PENDING_KEY);
    if (pendingSimulado) {
      try {
        const parsed = JSON.parse(pendingSimulado);
        if (parsed && parsed.titulo) {
          setPendingSimuladoReview(parsed);
        }
      } catch (e) {}
    }
  }, [STUDY_STORAGE_KEY, SIMULADO_PENDING_KEY, clearActiveTimerDoc]);

  // --- ACTIONS DE BANCO DE DADOS ---
  const addRegistroEstudo = async (data) => {
    try {
      const collectionRef = collection(db, 'users', user.uid, 'registrosEstudo');
      await addDoc(collectionRef, { ...data, timestamp: Timestamp.now() });
    } catch (e) {
      console.error('Erro ao adicionar registro:', e);
    }
  };

  // ---------------------------------------------
  // HANDLERS: ESTUDO (CRONÔMETRO/POMODORO)
  // ---------------------------------------------
  const handleStartStudy = (disciplina, assunto = null) => {
    // 🔴 ALERTA DE CONFLITO
    if (activeSimuladoSession) {
      setWarningAlert({
        isOpen: true,
        title: "Sessão Conflitante",
        message: "Você tem um Simulado em andamento. Finalize-o antes de iniciar uma sessão de estudo."
      });
      return;
    }
    setActiveStudySession({ disciplina, assunto, isMinimized: false });
  };

  const handleStopStudyRequest = (minutes) => {
    if (!activeStudySession) return;
    if (!activeCicloId) {
      alert("Nenhum ciclo ativo encontrado. Ative um ciclo antes de salvar.");
      return;
    }
    const currentStorage = JSON.parse(localStorage.getItem(STUDY_STORAGE_KEY) || '{}');
    const updatedStorage = {
      ...currentStorage,
      isFinishing: true,
      tempMinutes: minutes,
      isPaused: true
    };
    localStorage.setItem(STUDY_STORAGE_KEY, JSON.stringify(updatedStorage));
    setFinishModalData({
      minutes,
      disciplinaNome: activeStudySession.disciplina.nome,
      assuntoInicial: activeStudySession.assunto
    });
  };

  const handleRetomarEstudo = () => {
    setFinishModalData(null);
    setPendingReviewData(null);
    const currentStorage = JSON.parse(localStorage.getItem(STUDY_STORAGE_KEY) || '{}');
    if (currentStorage.disciplinaId) {
      delete currentStorage.isFinishing;
      delete currentStorage.tempMinutes;
      currentStorage.isPaused = true;
      localStorage.setItem(STUDY_STORAGE_KEY, JSON.stringify(currentStorage));
      setActiveStudySession({
        disciplina: { id: currentStorage.disciplinaId, nome: currentStorage.disciplinaNome },
        assunto: currentStorage.assunto,
        isMinimized: false
      });
    }
  };

  const handleConfirmCancelStudy = async () => {
    setActiveStudySession(null);
    setFinishModalData(null);
    setPendingReviewData(null);
    localStorage.removeItem(STUDY_STORAGE_KEY);
    clearActiveTimerDoc();
  };

  const handleConfirmFinishStudy = async (resultData) => {
    const dataRef = finishModalData || pendingReviewData;
    if (!dataRef) return;
    const { minutes } = dataRef;
    const { questions, correct, obs, assunto, disciplinaNomeCorrigido, markAsFinished } = resultData;
    const nomeDisciplinaFinal = disciplinaNomeCorrigido || dataRef.disciplinaNome;

    try {
      const storageData = JSON.parse(localStorage.getItem(STUDY_STORAGE_KEY) || '{}');
      const finalDisciplinaId = activeStudySession?.disciplina?.id || storageData.disciplinaId || 'restored_id';
      localStorage.removeItem(STUDY_STORAGE_KEY);

      const isEdital = activeCicloData?.editalId || activeCicloData?.templateId;
      const tipoCiclo = isEdital ? 'Edital Base' : 'Ciclo Manual';
      const nomeCiclo = activeCicloData?.nome || 'Ciclo Personalizado';

      const registroEstudoData = {
        cicloId: activeCicloId,
        cicloNome: nomeCiclo,
        cicloTipo: tipoCiclo,
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
          cicloNome: nomeCiclo,
          cicloTipo: tipoCiclo,
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
      clearActiveTimerDoc();
    } catch (e) {
      console.error("Erro ao salvar timer:", e);
      alert("Erro ao salvar sessão. Verifique sua conexão.");
    }
  };

  // ---------------------------------------------
  // HANDLERS: SIMULADO
  // ---------------------------------------------
  const handleStartSimulado = (config) => {
    // 🔴 ALERTA DE CONFLITO
    if (activeStudySession) {
      setWarningAlert({
        isOpen: true,
        title: "Sessão Conflitante",
        message: "Você tem uma sessão de estudo ativa. Finalize-a antes de iniciar o Simulado."
      });
      return;
    }

    // Configura o objeto da sessão garantindo initialSeconds
    setActiveSimuladoSession({
        ...config,
        initialSeconds: Number(config.totalSeconds) || Number(config.initialSeconds) || 14400, // Fallback 4h
        isMinimized: false
    });
  };

  const handleFinishSimulado = (minutes) => {
    const data = {
        titulo: activeSimuladoSession?.titulo || 'Simulado',
        data: dateToYMD(new Date()),
        durationMinutes: minutes
    };
    // Salva estado pendente para a tela de Simulado processar (modal de notas)
    localStorage.setItem(SIMULADO_PENDING_KEY, JSON.stringify(data));
    setFinishedSimuladoData(data);
    setActiveSimuladoSession(null);
    clearActiveSimuladoDoc();
    setActiveTab('simulados'); // Redireciona para a aba para mostrar o modal
  };

  const handleRecoverSimulado = () => {
    if (pendingSimuladoReview) {
      setFinishedSimuladoData(pendingSimuladoReview);
      setPendingSimuladoReview(null);
      setActiveTab('simulados');
    }
  };

  const handleCancelSimulado = () => {
    setActiveSimuladoSession(null);
    clearActiveSimuladoDoc();
    localStorage.removeItem(SIMULADO_STORAGE_KEY);
  };

  const handleClearSimuladoData = () => {
    setFinishedSimuladoData(null);
    localStorage.removeItem(SIMULADO_PENDING_KEY);
  };

  // ---------------------------------------------
  // HANDLERS GENÉRICOS & ACTIONS
  // ---------------------------------------------
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
    if (tab !== 'ciclos') {
      setForceOpenVisual(false);
      setIsTimerRaised(false);
    }
  };

  const handleLogout = async () => {
    clearActiveTimerDoc();
    clearActiveSimuladoDoc();
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

  // --- LOADS & EFFECTS (Firestore) ---
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
      if (snapshot.empty) {
        setActiveCicloId(null);
        setActiveCicloData(null);
      }
      else {
        const cicloDoc = snapshot.docs[0];
        setActiveCicloId(cicloDoc.id);
        setActiveCicloData({ id: cicloDoc.id, ...cicloDoc.data() });
      }
    });
    return () => unsubscribe();
  }, [user]);

  useEffect(() => {
    if (!user || !activeCicloId) {
      setActiveCycleDisciplines([]);
      return;
    }
    const qDisc = query(collection(db, 'users', user.uid, 'ciclos', activeCicloId, 'disciplinas'));
    const unsubscribe = onSnapshot(qDisc, (snapshot) => {
      const discs = snapshot.docs.map(d => {
        const data = d.data();
        const assuntos = Array.isArray(data.assuntos)
          ? data.assuntos.map(a => (typeof a === 'string' ? { nome: a, inCiclo: true } : { ...a, nome: (a?.nome || '').trim(), inCiclo: a?.inCiclo !== false })).filter(a => a.nome)
          : [];
        return { id: d.id, ...data, assuntos, inCiclo: data.inCiclo !== false };
      });
      setActiveCycleDisciplines(discs);
    });
    return () => unsubscribe();
  }, [user, activeCicloId]);

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    const qReg = query(collection(db, 'users', user.uid, 'registrosEstudo'), orderBy('timestamp', 'desc'));
    const unsubscribe = onSnapshot(qReg, (snapshot) => {
      const registros = snapshot.docs.map(docSnap => {
        const data = docSnap.data();
        let dataStr = data.data;
        if (data.data && typeof data.data.toDate === 'function') dataStr = dateToYMD(data.data.toDate());
        if (!dataStr && data.timestamp && typeof data.timestamp.toDate === 'function') dataStr = dateToYMD(data.timestamp.toDate());

        return {
          id: docSnap.id,
          ...data,
          data: dataStr,
          tempoEstudadoMinutos: data.tempoEstudadoMinutos,
          questoesFeitas: data.questoesFeitas,
          acertos: data.acertos
        };
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
    const qMeta = query(collection(db, 'users', user.uid, 'metas'), orderBy('startDate', 'desc'));
    const unsubscribe = onSnapshot(qMeta, (snapshot) => setGoalsHistory(snapshot.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() }))));
    return () => unsubscribe();
  }, [user]);

  // --- RENDER TAB CONTENT ---
  const renderTabContent = () => {
    if (loading && ['home', 'calendar', 'stats'].includes(activeTab)) {
      return (
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-red-600 mx-auto mb-4"></div>
        </div>
      );
    }
    switch (activeTab) {
      case 'home':
        return (
          <Home
            registrosEstudo={activeRegistrosEstudo}
            allRegistrosEstudo={allRegistrosEstudo}
            goalsHistory={goalsHistory}
            setActiveTab={handleGoToActiveCycle}
            activeCicloData={activeCicloData}
            activeCicloId={activeCicloId}
            onDeleteRegistro={deleteRegistro}
          />
        );
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
      case 'simulados':
        return (
          <SimuladosPage
            user={user}
            activeCycleDisciplines={activeCycleDisciplines}
            onStartSimulado={handleStartSimulado}
            initialData={finishedSimuladoData}
            onClearInitialData={handleClearSimuladoData}
          />
        );
      case 'profile':
        return <ProfilePage user={user} allRegistrosEstudo={allRegistrosEstudo} onDeleteRegistro={deleteRegistro} />;
      case 'admin':
        if (user.uid === ADMIN_UID) return <AdminPage />;
        return <div className="p-8 text-center text-red-500 font-bold">Acesso Negado</div>;
      default:
        return null;
    }
  };

  return (
    <div className="flex min-h-screen bg-background-light dark:bg-background-dark text-text-primary dark:text-text-dark-primary transition-colors duration-300 overflow-x-hidden">

      {/* --- RENDERIZAÇÃO DO MODAL DE ALERTA --- */}
      <WarningModal
        isOpen={warningAlert.isOpen}
        title={warningAlert.title}
        message={warningAlert.message}
        onClose={() => setWarningAlert(prev => ({ ...prev, isOpen: false }))}
      />

      {activeTab === 'home' && <BroadcastReceiver canShow={!tourState.isActive} />}

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

        <Header
          user={user}
          activeTab={activeTab}
          isDarkMode={isDarkMode}
          toggleTheme={toggleTheme}
          registrosEstudo={allRegistrosEstudo}
          goalsHistory={goalsHistory}
          activeCicloId={activeCicloId}
          onShareGoal={handleShareGoal}
          onOpenFeedback={() => setIsFeedbackOpen(true)}
        />

        <main className="mt-6 max-w-7xl mx-auto animate-fade-in">{renderTabContent()}</main>
      </div>

      <OnboardingTour
        isActive={tourState.isActive}
        tourType={tourState.type}
        activeTab={activeTab}
        setActiveTab={handleTabChange}
        onClose={() => handleTourCloseOrFinish(tourState.type)}
        onFinish={() => handleTourCloseOrFinish(tourState.type)}
      />

      <FeedbackWidget
        user={user}
        isOpen={isFeedbackOpen}
        onClose={() => setIsFeedbackOpen(false)}
        isSidebarOpen={isMobileOpen}
      />

      {/* --- TIMER DE ESTUDO (STUDY TIMER) --- */}
      {activeStudySession && (
        <StudyTimer
          disciplina={activeStudySession.disciplina}
          assunto={activeStudySession.assunto}
          isMinimized={activeStudySession.isMinimized}
          onStop={handleStopStudyRequest}
          onCancel={handleConfirmCancelStudy}
          onMaximize={() => setActiveStudySession(prev => ({ ...prev, isMinimized: false }))}
          onMinimize={() => setActiveStudySession(prev => ({ ...prev, isMinimized: true }))}
          raised={isTimerRaised}
          userUid={user.uid}
          userName={user.displayName || 'Estudante'}
          userPhotoURL={user.photoURL || null}
        />
      )}

      {/* --- TIMER DE SIMULADO --- */}
      {activeSimuladoSession && (
        <SimuladoTimer
          tituloSimulado={activeSimuladoSession.titulo}
          mode={activeSimuladoSession.mode}
          initialSeconds={activeSimuladoSession.initialSeconds || activeSimuladoSession.totalSeconds || 0}
          isMinimized={activeSimuladoSession.isMinimized}
          onStop={handleFinishSimulado}
          onCancel={handleCancelSimulado}
          onMaximize={() => setActiveSimuladoSession(prev => ({ ...prev, isMinimized: false }))}
          onMinimize={() => setActiveSimuladoSession(prev => ({ ...prev, isMinimized: true }))}
          userUid={user.uid}
          userName={user.displayName || 'Candidato'}
        />
      )}

      {/* --- RECOVERY MODAL DE ESTUDO --- */}
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

      {/* --- RECOVERY MODAL DE SIMULADO --- */}
      {pendingSimuladoReview && !finishedSimuladoData && (
        <div className="fixed bottom-24 right-4 z-[9999] animate-fade-in">
          <div
            onClick={handleRecoverSimulado}
            className="bg-red-900/90 backdrop-blur-md border border-red-500/50 shadow-[0_0_20px_rgba(239,68,68,0.2)] rounded-2xl p-3 flex items-center gap-4 w-auto max-w-[320px] overflow-hidden hover:scale-105 transition-transform cursor-pointer"
          >
            <div className="relative flex items-center justify-center w-10 h-10 bg-red-800 rounded-full shrink-0">
              <div className="absolute inset-0 rounded-full bg-red-500/20 animate-ping"></div>
              <ClipboardList size={20} className="text-red-200 relative z-10" />
            </div>
            <div className="flex flex-col mr-2 min-w-0">
              <span className="text-[10px] text-red-200 uppercase font-bold tracking-wider truncate">Registro de Simulado Pendente</span>
              <span className="text-[10px] text-white truncate leading-tight font-bold">{pendingSimuladoReview.titulo}</span>
              <span className="text-[9px] text-red-300/80 italic mt-0.5 truncate">Clique para registrar notas</span>
            </div>
            <div className="p-2 rounded-full bg-red-800/50 text-red-100 hover:bg-red-700/50 transition-colors">
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