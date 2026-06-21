import React, { useState, useEffect, useMemo, useCallback, useLayoutEffect, useRef } from 'react';
import {
  collection, onSnapshot, query, orderBy, addDoc, deleteDoc, doc, where, Timestamp,
  getDocs, getDoc, setDoc, updateDoc, increment } from 'firebase/firestore';
import { Suspense, lazy } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { db, auth } from '../firebaseConfig';
import { signOut } from 'firebase/auth';
import { AnimatePresence, motion } from 'framer-motion';
import { X, CheckCircle2, Download, AlertTriangle, Maximize2, ClipboardList, AlertCircle } from 'lucide-react';
import NavSideBar from '../components/dashboard/NavSideBar';
import Header from '../components/dashboard/Header';
import GlobalStudyRegisterFab from '../components/ciclos/GlobalStudyRegisterFab';
import AppBackgroundEffects from '../components/shared/AppBackgroundEffects';
import PlanningSuccessCelebration from '../components/shared/PlanningSuccessCelebration';
const ShareCard = lazy(() => import('../components/shared/ShareCard'));
const Home = lazy(() => import('../pages/HomePage/HomePage'));
const CalendarTab = lazy(() => import('../components/dashboard/CalendarTab'));
const CiclosPage = lazy(() => import('../pages/CiclosPage'));
const CronogramaPage = lazy(() => import('../pages/CronogramaPage'));
const PlanejamentoPage = lazy(() => import('../pages/PlanejamentoPage'));
const ProfilePage = lazy(() => import('../pages/ProfilePage'));
const AdminPage = lazy(() => import('../pages/AdminPage/AdminPage'));
const EditalPage = lazy(() => import('../pages/EditalPage'));
const Desempenho = lazy(() => import('../pages/DesempenhoPage/DesempenhoPage'));
const StudyTimer = lazy(() => import('../components/ciclos/StudyTimer/StudyTimer'));
const TimerFinishModal = lazy(() => import('../components/ciclos/TimerFinishModal'));
const RegistroEstudoModal = lazy(() => import('../components/ciclos/RegistroEstudoModal'));
const OnboardingTour = lazy(() => import('../components/shared/OnboardingTour'));
const BroadcastReceiver = lazy(() => import('../components/shared/BroadcastReceiver'));
const WelcomeCarouselModal = lazy(() => import('../components/shared/WelcomeCarouselModal'));
const FeedbackWidget = lazy(() => import('../components/FeedbackWidget'));
const SimuladosPage = lazy(() => import('../pages/SimuladosPage/SimuladosPage'));
const SimuladoTimer = lazy(() => import('../pages/SimuladosPage/SimuladoTimer'));
const NoticiasPage = lazy(() => import('../pages/NoticiasPage'));
const RevisaoPage = lazy(() => import('../pages/RevisaoPage'));

const ENABLE_ONBOARDING_TOUR = false;
const WELCOME_UPDATE_VERSION = '2026-06-dashboard-rebuild-v2';
const PATH_TO_TAB = {
  home: 'home',
  calendario: 'calendar',
  calendar: 'calendar',
  ciclos: 'ciclos',
  planejamento: 'planejamento',
  cronograma: 'cronograma',
  cronogramas: 'planejamento',
  edital: 'edital',
  revisoes: 'revisoes',
  desempenho: 'stats',
  stats: 'stats',
  simulados: 'simulados',
  perfil: 'profile',
  profile: 'profile',
  noticias: 'noticias',
  admin: 'admin',
};
const TAB_TO_PATH = {
  home: 'home',
  calendar: 'calendario',
  ciclos: 'ciclos',
  planejamento: 'planejamento',
  cronograma: 'cronograma',
  cronogramas: 'planejamento',
  edital: 'edital',
  revisoes: 'revisoes',
  stats: 'desempenho',
  simulados: 'simulados',
  profile: 'perfil',
  noticias: 'noticias',
  admin: 'admin',
};

import { useNotifications } from '../hooks/useNotifications';
import { useUserAccess } from '../hooks/useUserAccess';
import {
  marcarPendenciaTeoriaPorRegistro,
  syncRegistroEstudoWithCronograma,
  syncRegistroRevisaoWithCronograma,
} from '../services/cronogramaProgressSync';
import { upsertCicloRevisao } from '../services/cicloRevisoes';
import { resolveLogoUrl } from './admin/config/editalAssets';
import { isCicloLegacyForGuide } from '../utils/cicloLegacyUpgrade';

const dateToYMD = (date) => {
  const d = date.getDate();
  const m = date.getMonth() + 1;
  const y = date.getFullYear();
  return '' + y + '-' + (m <= 9 ? '0'+m : m) + '-' + (d <= 9 ? '0'+d : d);
};

const ymdToDateLocal = (value) => {
  if (!value || typeof value !== 'string') return new Date();
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, (month || 1) - 1, day || 1, 12, 0, 0);
};

const getPreferredHomeContext = () => {
  try { return localStorage.getItem('homeContextPreferred') || 'cronograma'; } catch { return 'cronograma'; }
};

const isRegistroContext = (value) => value === 'ciclo' || value === 'cronograma';

const normalizeRegistroEstudo = (docSnap) => {
  const data = docSnap.data();
  let dataStr = data.data;
  if (data.data?.toDate) dataStr = dateToYMD(data.data.toDate());
  if (!dataStr && data.timestamp?.toDate) dataStr = dateToYMD(data.timestamp.toDate());
  return {
    id: docSnap.id,
    ...data,
    data: dataStr,
    tempoEstudadoMinutos: Number(data.tempoEstudadoMinutos || 0),
    questoesFeitas: Number(data.questoesFeitas || 0),
    acertos: Number(data.acertos || 0),
  };
};

const normalizeRegistroPayload = (id, data = {}) => {
  let dataStr = data.data;
  if (data.data?.toDate) dataStr = dateToYMD(data.data.toDate());
  if (!dataStr && data.timestamp?.toDate) dataStr = dateToYMD(data.timestamp.toDate());
  return {
    id,
    ...data,
    data: dataStr,
    tempoEstudadoMinutos: Number(data.tempoEstudadoMinutos || 0),
    questoesFeitas: Number(data.questoesFeitas || 0),
    acertos: Number(data.acertos || 0),
  };
};

const sortRegistrosEstudo = (items = []) => [...items].sort((a, b) => {
  const tA = a.timestamp?.seconds || (a.timestamp instanceof Date ? a.timestamp.getTime() / 1000 : 0);
  const tB = b.timestamp?.seconds || (b.timestamp instanceof Date ? b.timestamp.getTime() / 1000 : 0);
  if (a.data === b.data) return tB - tA;
  return a.data < b.data ? 1 : -1;
});

const getCompletionDocId = (origemConclusaoId) => {
  if (!origemConclusaoId) return null;
  return `completion_${encodeURIComponent(String(origemConclusaoId)).replace(/\./g, '%2E')}`;
};

const isCicloPendingFinalization = (ciclo) => {
  if (!ciclo?.id || ciclo.ativo === false) return false;
  const totalSessoes = Number(ciclo.totalSessoesCiclo || 0);
  const concluidas = new Set((ciclo.sessoesConcluidas || []).map(Number)).size;
  return totalSessoes > 0 && concluidas >= totalSessoes;
};

const normalizeRegistroText = (value) =>
  String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

const getAssuntoCicloPorSessao = (ciclo, disciplinas, sessao) => {
  const disciplina = (disciplinas || []).find((item) => String(item?.id) === String(sessao?.disciplinaId));
  const assuntos = Array.isArray(disciplina?.assuntos) ? disciplina.assuntos : [];
  const assunto = assuntos[Number(sessao?.sessaoIndex || 0) % Math.max(1, assuntos.length)];
  if (typeof assunto === 'string') return assunto;
  return assunto?.nome || assunto?.titulo || assunto?.label || '';
};

const scrollToTopInstant = (element = null) => {
  if (element) element.scrollTop = 0;
  try {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  } catch {
    window.scrollTo(0, 0);
  }
};

const WarningModal = ({ isOpen, onClose, title, message }) => {
  if (!isOpen) return null;
  return (
    <AnimatePresence>
      <motion.div className="fixed inset-0 z-[10001] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }} onClick={onClose}>
        <motion.div initial={{ scale:0.9, opacity:0, y:20 }} animate={{ scale:1, opacity:1, y:0 }} exit={{ scale:0.95, opacity:0, y:10 }} transition={{ type:'spring', duration:0.5 }} className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-2xl p-6 w-full max-w-md relative overflow-hidden" onClick={(e)=>e.stopPropagation()}>
          <div className="absolute top-0 left-0 w-full h-1 bg-amber-500"/>
          <div className="flex flex-col items-center text-center">
            <div className="w-16 h-16 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center mb-4 text-amber-600 dark:text-amber-500"><AlertCircle size={32} strokeWidth={2.5}/></div>
            <h3 className="text-xl font-bold text-zinc-900 dark:text-white mb-2">{title}</h3>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-6 leading-relaxed">{message}</p>
            <button onClick={onClose} className="w-full py-3 rounded-xl bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 font-bold hover:opacity-90 transition-opacity">Entendi</button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

const DownloadAlert = ({ isVisible, onDismiss }) => (
  <AnimatePresence>
    {isVisible && (
      <motion.div initial={{ y:50, opacity:0 }} animate={{ y:0, opacity:1 }} exit={{ y:50, opacity:0 }} transition={{ duration:0.3 }} className="fixed bottom-10 left-1/2 transform -translate-x-1/2 z-[10000] p-4 rounded-xl bg-emerald-600 shadow-xl text-white flex items-center gap-3">
        <CheckCircle2 size={24}/>
        <span className="font-bold">Download do Cartão iniciado!</span>
        <motion.button whileHover={{ scale:1.1 }} onClick={onDismiss} className="text-white/80 hover:text-white"><X size={18}/></motion.button>
      </motion.div>
    )}
  </AnimatePresence>
);

const SectionLoader = ({ minHeight = '16rem' }) => (
  <div className="w-full" style={{ minHeight }} aria-busy="true" />
);

const ShareCardPreviewModal = ({ data, onClose, onDownload }) => {
  if (!data) return null;
  return (
    <AnimatePresence>
      <motion.div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 sm:p-6" initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }}>
        <motion.div className="absolute inset-0 bg-zinc-900/70 backdrop-blur-sm" onClick={onClose} initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }}/>
        <motion.div initial={{ scale:0.9, opacity:0 }} animate={{ scale:1, opacity:1 }} exit={{ scale:0.9, opacity:0 }} transition={{ duration:0.3, ease:'easeOut' }} className="relative bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl border border-zinc-200 dark:border-zinc-800 w-[95%] max-w-lg p-4 sm:p-6 flex flex-col items-center max-h-[90vh] overflow-y-auto">
          <div className="absolute top-3 right-3"><button onClick={onClose} className="p-2 rounded-full bg-white/60 dark:bg-zinc-800/60 hover:bg-red-100 dark:hover:bg-red-900/30 text-zinc-600 hover:text-red-600 transition-all"><X size={18}/></button></div>
          <h2 className="text-xl font-bold text-zinc-800 dark:text-white mt-4 mb-1">Preview do Cartão</h2>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-4 text-center">Visualize como ficará seu cartão antes de baixar.</p>
          <div id="share-card-capture-target" className="mb-4">
            <Suspense fallback={<SectionLoader minHeight="20rem" />}>
              <ShareCard stats={data.stats} userName={data.userName} dayData={data.dayData} goals={data.goals} isDarkMode={data.isDarkMode} disableAnimations={true}/>
            </Suspense>
          </div>
          <div className="flex gap-3 mt-2 mb-2 shrink-0 download-button-wrapper">
            <button onClick={onDownload} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-red-600 text-white font-semibold shadow hover:bg-red-700 transition-all"><Download size={16}/> Baixar PDF</button>
            <button onClick={onClose} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 font-semibold hover:bg-zinc-300 dark:hover:bg-zinc-700 transition-all"><X size={16}/> Fechar</button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

function Dashboard({ user, isDarkMode, toggleTheme }) {
  const { tab: routeTab } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const initialRouteTab = PATH_TO_TAB[String(routeTab || 'home').toLowerCase()] || 'home';
  const userUid = user?.uid || 'anonymous';
  const STUDY_STORAGE_KEY   = useMemo(() => `@ModoQAP:ActiveSession:${userUid}`, [userUid]);
  const SIMULADO_STORAGE_KEY = useMemo(() => `@ModoQAP:SimuladoActive:${userUid}`, [userUid]);
  const SIMULADO_PENDING_KEY = useMemo(() => `@ModoQAP:SimuladoPending:${userUid}`, [userUid]);

  const {
    notifications,
    unreadCount,
    broadcasts,
    editalUpdates,
    dismissedHistory,
    readBroadcasts,
    markBroadcastRead,
    markAllRead,
    dismissEditalUpdate,
    applyEditalUpdate,
    loading: loadingNotif,
    deleteBroadcast,
    deleteHistoryItem
  } = useNotifications(user);
  const userAccess = useUserAccess(user);

  const [activeTab, setActiveTabState]          = useState(initialRouteTab);
  const [loading, setLoading]                   = useState(true);
  const [isSidebarExpanded, setIsSidebarExpanded] = useState(false);
  const [isMobileOpen, setIsMobileOpen]         = useState(false);
  const [forceOpenVisual, setForceOpenVisual]   = useState(false);
  const [isTimerRaised, setIsTimerRaised]       = useState(false);
  const [sharePreviewData, setSharePreviewData] = useState(null);
  const [isDownloadAlertVisible, setIsDownloadAlertVisible] = useState(false);
  const [tourState, setTourState]               = useState({ isActive:false, type:'main' });
  const [isFeedbackOpen, setIsFeedbackOpen]     = useState(false);
  const [feedbackInitialState, setFeedbackInitialState] = useState({ initialView: 'home', initialType: 'ideia' });
  const [warningAlert, setWarningAlert]         = useState({ isOpen:false, title:'', message:'' });
  const [forcePlanejamentoSelector, setForcePlanejamentoSelector] = useState(false);
  const [welcomeCarousel, setWelcomeCarousel]   = useState({ loading:true, mode:null });

  const [activeStudySession, setActiveStudySession]   = useState(null);
  const [finishModalData, setFinishModalData]         = useState(null);
  const [pendingReviewData, setPendingReviewData]     = useState(null);
  const [showGlobalRegistroModal, setShowGlobalRegistroModal] = useState(false);

  const [activeSimuladoSession, setActiveSimuladoSession] = useState(null);
  const [finishedSimuladoData, setFinishedSimuladoData]   = useState(null);
  const [pendingSimuladoReview, setPendingSimuladoReview] = useState(null);

  const setActiveTab = useCallback((nextTab) => {
    const resolvedTab = typeof nextTab === 'function' ? nextTab(activeTab) : nextTab;
    const pathTab = TAB_TO_PATH[resolvedTab] || 'home';
    const targetPath = `/app/${pathTab}`;
    setActiveTabState(resolvedTab);
    if (location.pathname !== targetPath) navigate(targetPath);
  }, [activeTab, location.pathname, navigate]);

  useEffect(() => {
    const resolvedTab = PATH_TO_TAB[String(routeTab || 'home').toLowerCase()];
    if (!resolvedTab) {
      if (location.pathname.startsWith('/app/')) navigate('/app/home', { replace: true });
      return;
    }
    setActiveTabState((current) => (current === resolvedTab ? current : resolvedTab));
  }, [location.pathname, navigate, routeTab]);

  const [goalsHistory, setGoalsHistory]           = useState([]);
  const [activeCicloId, setActiveCicloId]         = useState(null);
  const [activeCicloData, setActiveCicloData]     = useState(null);
  const [activeCronogramaData, setActiveCronogramaData] = useState(null);
  const [activeCicloLoaded, setActiveCicloLoaded] = useState(false);
  const [activeCronogramaLoaded, setActiveCronogramaLoaded] = useState(false);
  const [targetOpenCicloId, setTargetOpenCicloId] = useState(null);
  const [allRegistrosEstudo, setAllRegistrosEstudo] = useState([]);
  const [allSimulados, setAllSimulados]           = useState([]);
  const [registrosLoaded, setRegistrosLoaded]     = useState(false);
  const [simuladosLoaded, setSimuladosLoaded]     = useState(false);
  const [activeCycleDisciplines, setActiveCycleDisciplines] = useState([]);

  const mainContentRef = useRef(null);

  const handleOpenFeedback = (options = {}) => {
    setFeedbackInitialState({
      initialView: options.initialView || 'home',
      initialType: options.initialType || 'ideia',
    });
    setIsFeedbackOpen(true);
  };
  const statsSyncKeyRef = useRef('');

  const todayStr = dateToYMD(new Date());
  const hasActiveStudyContext = !!(activeCicloId || activeCronogramaData?.id);
  const cicloPendenteFinalizacao = useMemo(
    () => isCicloPendingFinalization(activeCicloData),
    [activeCicloData]
  );
  const cicloFinalizacaoMessage = 'Seu ciclo chegou a 100%. Finalize a rodada antes de registrar novos estudos.';
  const cicloFinalizacaoAlert = useMemo(() => {
    if (!cicloPendenteFinalizacao) return null;
    return {
      id: `alerta_finalizar_ciclo_${activeCicloId || activeCicloData?.id || 'ativo'}`,
      type: 'ciclo_finalizacao',
      title: 'Finalize seu ciclo',
      message: `${activeCicloData?.nome || 'Seu ciclo'} foi concluido. Registre a finalizacao para liberar uma nova rodada de estudos.`,
      actionLabel: 'Finalizar Ciclo',
      navigateTo: 'ciclos',
    };
  }, [activeCicloData?.id, activeCicloData?.nome, activeCicloId, cicloPendenteFinalizacao]);
  const cicloLegacyUpgradeAlert = useMemo(() => {
    if (!isCicloLegacyForGuide(activeCicloData)) return null;
    return {
      id: `alerta_atualizar_guia_ciclo_${activeCicloId || activeCicloData?.id || 'ativo'}`,
      type: 'ciclo_legacy_upgrade',
      cicloId: activeCicloId || activeCicloData?.id || null,
      title: 'Atualize seu ciclo',
      message: 'Ative o novo guia de estudos por assunto mantendo seu edital e progresso atual.',
      actionLabel: 'Atualizar ciclo',
      navigateTo: 'ciclos',
    };
  }, [activeCicloData, activeCicloId]);
  const registroContextOptions = useMemo(() => {
    const options = [];

    if (activeCicloId) {
      const cicloLogo = activeCicloData?.logoUrl || activeCicloData?.logo || resolveLogoUrl({ ciclo: activeCicloData });
      options.push({
        type: 'ciclo',
        id: activeCicloId,
        label: activeCicloData?.nome || 'Ciclo',
        logoUrl: cicloLogo,
        disciplinas: Array.isArray(activeCycleDisciplines) ? activeCycleDisciplines : [],
      });
    }

    if (activeCronogramaData?.id) {
      const cronogramaLogo = activeCronogramaData.logoUrl || activeCronogramaData.logo || activeCronogramaData.editalLogoUrl || resolveLogoUrl({ ciclo: activeCronogramaData });
      const snapshot = Array.isArray(activeCronogramaData.disciplinasSnapshot)
        ? activeCronogramaData.disciplinasSnapshot
        : [];
      const disciplinasCronograma = snapshot.length > 0
        ? snapshot
        : Object.values((activeCronogramaData.semanaTemplate || []).reduce((acc, slot) => {
            const id = slot.disciplinaId || slot.id || slot.disciplinaNome;
            if (!id) return acc;
            if (!acc[id]) acc[id] = { id, nome: slot.disciplinaNome || 'Disciplina', assuntos: [] };
            if (slot.assunto && !acc[id].assuntos.includes(slot.assunto)) acc[id].assuntos.push(slot.assunto);
            return acc;
          }, {}));
      options.push({
        type: 'cronograma',
        id: activeCronogramaData.id,
        label: activeCronogramaData.nome || 'Cronograma',
        logoUrl: cronogramaLogo,
        disciplinas: disciplinasCronograma,
      });
    }

    return options;
  }, [activeCicloId, activeCicloData?.nome, activeCycleDisciplines, activeCronogramaData]);

  useEffect(() => {
    statsSyncKeyRef.current = '';
  }, [user?.uid]);

  const defaultRegistroContext = useMemo(() => {
    const contextTypes = registroContextOptions.map((item) => item.type);
    const sessionHint = activeStudySession?.defaultContext;

    if (contextTypes.length === 1) return contextTypes[0];
    if (isRegistroContext(sessionHint) && contextTypes.includes(sessionHint)) return sessionHint;

    const preferred = getPreferredHomeContext();
    if (contextTypes.includes(preferred)) return preferred;

    return contextTypes[0] || null;
  }, [registroContextOptions, activeStudySession?.defaultContext]);

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db,'users',user.uid,'simulados'), orderBy('data','desc'));
    setSimuladosLoaded(false);
    return onSnapshot(q, (snap) => {
      setAllSimulados(snap.docs.map(d => ({ id:d.id, ...d.data() })));
      setSimuladosLoaded(true);
    }, (error) => {
      console.error('[Dashboard] Erro ao sincronizar simulados:', error);
      setSimuladosLoaded(true);
    });
  }, [user]);

  const mergedAllRegistrosEstudo = useMemo(() => {
    const virtual = [];
    allSimulados.forEach(sim => {
      const dataStr   = sim.data || dateToYMD(new Date());
      const timestamp = sim.timestamp || Timestamp.now();
      if (sim.durationMinutes > 0) {
        virtual.push({
          id:`vsim_time_${sim.id}`, cicloId:'simulados_virtuais', disciplinaId:'categoria_simulado',
          disciplinaNome:'Simulado', disciplinaDisplay:'Simulado',
          assunto: sim.titulo||'Simulado', simuladoTitulo: sim.titulo||'Simulado',
          data:dataStr, timestamp, tempoEstudadoMinutos:sim.durationMinutes,
          duracaoMinutos:sim.durationMinutes, questoesFeitas:0, acertos:0, tipoEstudo:'Simulado',
        });
      }
      if (sim.disciplinas?.length) {
        sim.disciplinas.forEach((d, idx) => {
          const nomeReal = (d.nome||'Geral').trim();
          const discNorm = nomeReal.toLowerCase();
          const matched  = activeCycleDisciplines?.find(ac => ac.nome.trim().toLowerCase() === discNorm);

          virtual.push({
            id:`vsim_q_${sim.id}_${idx}`, cicloId:'simulados_virtuais',
            disciplinaId: matched ? matched.id : `vsim_disc_${discNorm}`,
            disciplinaNome: nomeReal, disciplinaDisplay:'Simulado',
            assunto: nomeReal, simuladoTitulo: sim.titulo||'Simulado',
            data:dataStr, timestamp, tempoEstudadoMinutos:0,
            questoesFeitas: Number(d.total||d.questoes||0), acertos: Number(d.acertos||0),
            tipoEstudo:'Simulado',
          });
        });
      }
    });

    return sortRegistrosEstudo([...allRegistrosEstudo, ...virtual]);
  }, [allRegistrosEstudo, allSimulados, activeCycleDisciplines]);

  const mergedActiveRegistrosEstudo = useMemo(() => {
    const preferred = getPreferredHomeContext();
    const activeCronogramaId = activeCronogramaData?.id;

    if (preferred === 'cronograma' && activeCronogramaId) {
      return mergedAllRegistrosEstudo.filter(r => r.cronogramaId === activeCronogramaId || r.tipoEstudo === 'Simulado');
    }

    if (preferred === 'ciclo' && activeCicloId) {
      return mergedAllRegistrosEstudo.filter(r => r.cicloId === activeCicloId || r.tipoEstudo === 'Simulado');
    }

    if (activeCronogramaId && !activeCicloId) {
      return mergedAllRegistrosEstudo.filter(r => r.cronogramaId === activeCronogramaId || r.tipoEstudo === 'Simulado');
    }

    if (activeCicloId) {
      return mergedAllRegistrosEstudo.filter(r => r.cicloId === activeCicloId || r.tipoEstudo === 'Simulado');
    }

    return mergedAllRegistrosEstudo;
  }, [mergedAllRegistrosEstudo, activeCicloId, activeCronogramaData?.id]);

  const isNovoUsuarioPlanejamento = useMemo(() => {
    const semCicloAtivo = !activeCicloId;
    const semCronogramaAtivo = !activeCronogramaData?.id;
    const semRegistros = mergedAllRegistrosEstudo.length === 0;
    return semCicloAtivo && semCronogramaAtivo && semRegistros;
  }, [activeCicloId, activeCronogramaData?.id, mergedAllRegistrosEstudo.length]);

  useEffect(() => {
    if (!user?.uid) {
      setWelcomeCarousel({ loading:false, mode:null });
      return;
    }

    const ready = registrosLoaded && simuladosLoaded && activeCicloLoaded && activeCronogramaLoaded;
    if (!ready) {
      setWelcomeCarousel((current) => ({ ...current, loading:true }));
      return;
    }

    let alive = true;
    const localBaseKey = `modoqap_welcome_carousel_${user.uid}`;

    const resolveMode = (saved = {}) => {
      const localWelcomeSeen = localStorage.getItem(`${localBaseKey}_welcome`) === 'true';
      const localUpdateSeen = localStorage.getItem(`${localBaseKey}_update_${WELCOME_UPDATE_VERSION}`) === 'true';
      const welcomeSeen = Boolean(saved.welcomeCompletedAt || saved.welcomeSeen || localWelcomeSeen);
      const updateSeen = saved.updateVersionSeen === WELCOME_UPDATE_VERSION || localUpdateSeen;

      if (isNovoUsuarioPlanejamento && !welcomeSeen) return 'welcome';
      if (!isNovoUsuarioPlanejamento && !updateSeen) return 'update';
      return null;
    };

    setWelcomeCarousel((current) => ({ ...current, loading:true }));

    getDoc(doc(db, 'users', user.uid, 'system_state', 'welcome_carousel'))
      .then((snap) => {
        if (!alive) return;
        const mode = resolveMode(snap.exists() ? snap.data() : {});
        setWelcomeCarousel({ loading:false, mode });
      })
      .catch((error) => {
        console.error('[Dashboard] Erro ao carregar carrossel inicial:', error);
        if (!alive) return;
        setWelcomeCarousel({ loading:false, mode:resolveMode({}) });
      });

    return () => { alive = false; };
  }, [
    user?.uid,
    registrosLoaded,
    simuladosLoaded,
    activeCicloLoaded,
    activeCronogramaLoaded,
    isNovoUsuarioPlanejamento,
  ]);

  const dayToShareData = useMemo(() => {
    const recs = mergedAllRegistrosEstudo.filter(r => r.data === todayStr);
    return {
      dayHours:     recs.filter(r => (Number(r.tempoEstudadoMinutos)||Number(r.duracaoMinutos)) > 0),
      dayQuestions: recs.filter(r => (Number(r.questoesFeitas)||0) > 0),
    };
  }, [mergedAllRegistrosEstudo, todayStr]);

  useEffect(() => {
    const handler = (e) => setIsTimerRaised(e.detail);
    window.addEventListener('toggle-timer-raise', handler);
    return () => window.removeEventListener('toggle-timer-raise', handler);
  }, []);

  const clearActiveTimerDoc = useCallback(async () => {
    try { await deleteDoc(doc(db,'active_timers',user.uid)); } catch {}
  }, [user?.uid]);

  const clearActiveSimuladoDoc = useCallback(async () => {
    try { await deleteDoc(doc(db,`users/${user.uid}/personal_timers/active_simulado`)); } catch {}
  }, [user?.uid]);

  useEffect(() => {
    if (!user) return;
    return onSnapshot(doc(db,'active_timers',user.uid), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data.isSimulado || data.status === 'finishing' || data.status === 'finished') return;
        setActiveStudySession(prev => {
          const prevAssunto = prev?.assunto ?? null;
          const nextAssunto = data.assunto ?? null;
          if (prev?.disciplina?.id === data.disciplinaId && prevAssunto === nextAssunto) return prev;
          return {
            disciplina:{ id:data.disciplinaId, nome:data.disciplinaNome },
            assunto: nextAssunto,
            isMinimized: prev ? prev.isMinimized : true,
            defaultContext: data.defaultContext || prev?.defaultContext || null,
            sessaoGlobalIndex: Number.isFinite(Number(data.sessaoGlobalIndex)) ? Number(data.sessaoGlobalIndex) : null
          };
        });
      } else {
        if (!finishModalData && !pendingReviewData) setActiveStudySession(null);
      }
    });
  }, [user, finishModalData, pendingReviewData]);

  useEffect(() => {
    if (!user) return;
    return onSnapshot(doc(db,'users',user.uid,'personal_timers','active_simulado'), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data.status === 'finished') return;
        if (!data.isSimulado && data.timerType !== 'simulado') return;
        setActiveSimuladoSession(prev => {
          const isMin    = prev ? prev.isMinimized : true;
          const titulo   = prev?.titulo || data.titulo || 'Simulado';
          const isNew    = prev?.isNewSession === true;
          const next     = { titulo, mode:data.mode, initialSeconds:Number(data.initialSeconds||0), isMinimized:isMin, isNewSession:isNew };
          if (prev && prev.titulo===next.titulo && prev.mode===next.mode && Number(prev.initialSeconds||0)===Number(next.initialSeconds||0) && prev.isMinimized===next.isMinimized) return prev;
          return next;
        });
      } else {
        if (!finishedSimuladoData) setActiveSimuladoSession(null);
      }
    });
  }, [user, finishedSimuladoData]);

  useEffect(() => {
    const savedStudy = localStorage.getItem(STUDY_STORAGE_KEY);
    if (savedStudy) {
      try {
        const parsed = JSON.parse(savedStudy);
        if (parsed.isFinishing && parsed.tempMinutes) {
          clearActiveTimerDoc();
          setPendingReviewData({
            minutes:parsed.tempMinutes,
            disciplinaNome:parsed.disciplinaNome,
            assuntoInicial:parsed.assunto,
            defaultContext: parsed.defaultContext || null,
            sessaoGlobalIndex: Number.isFinite(Number(parsed.sessaoGlobalIndex)) ? Number(parsed.sessaoGlobalIndex) : null,
            reason:'Sessão interrompida (Atualização/Fechamento)',
            originalData:parsed,
          });
        }
      } catch {}
    }
    const pendingSim = localStorage.getItem(SIMULADO_PENDING_KEY);
    if (pendingSim) {
      try { const p = JSON.parse(pendingSim); if (p?.titulo) setPendingSimuladoReview(p); } catch {}
    }
  }, [STUDY_STORAGE_KEY, SIMULADO_PENDING_KEY, clearActiveTimerDoc]);

  const fetchHistory = useCallback(() => {}, []);

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    setRegistrosLoaded(false);
    const q = query(collection(db,'users',user.uid,'registrosEstudo'), orderBy('data','desc'), orderBy('timestamp','desc'));
    return onSnapshot(q, (snap) => {
      setAllRegistrosEstudo(snap.docs.map(normalizeRegistroEstudo));
      setRegistrosLoaded(true);
      setLoading(false);
    }, (error) => {
      console.error('[Dashboard] Erro ao sincronizar registrosEstudo:', error);
      setRegistrosLoaded(true);
      setLoading(false);
    });
  }, [user]);

  useEffect(() => {
    if (!user || !registrosLoaded || !simuladosLoaded) return;

    const totalRegistros = allRegistrosEstudo.reduce((acc, item) => ({
      minutos: acc.minutos + Number(item.tempoEstudadoMinutos || 0),
      questoes: acc.questoes + Number(item.questoesFeitas || 0),
      acertos: acc.acertos + Number(item.acertos || 0),
    }), { minutos: 0, questoes: 0, acertos: 0 });

    const totalSimulados = allSimulados.reduce((acc, item) => ({
      minutos: acc.minutos + Number(item.durationMinutes || 0),
      questoes: acc.questoes + Number(item.resumo?.totalQuestoes || 0),
      acertos: acc.acertos + Number(item.resumo?.totalAcertos || 0),
    }), { minutos: 0, questoes: 0, acertos: 0 });

    const totals = {
      totalHorasMinutos: totalRegistros.minutos + totalSimulados.minutos,
      totalQuestoes: totalRegistros.questoes + totalSimulados.questoes,
      totalAcertos: totalRegistros.acertos + totalSimulados.acertos,
    };
    const syncKey = `${totals.totalHorasMinutos}|${totals.totalQuestoes}|${totals.totalAcertos}`;
    if (statsSyncKeyRef.current === syncKey) return;
    statsSyncKeyRef.current = syncKey;

    setDoc(doc(db,'users',user.uid,'stats','geral'), {
      ...totals,
      lastUpdated: Timestamp.now(),
    }, { merge: true }).catch((error) => {
      console.error('[Dashboard] Erro ao sincronizar stats/geral:', error);
      statsSyncKeyRef.current = '';
    });
  }, [allRegistrosEstudo, allSimulados, registrosLoaded, simuladosLoaded, user]);

  const recalculateAllStats = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const q = query(collection(db,'users',user.uid,'registrosEstudo'));
      const snap = await getDocs(q);
      let tMin=0, tQ=0, tC=0;
      snap.docs.forEach(d => { const v=d.data(); tMin+=Number(v.tempoEstudadoMinutos||0); tQ+=Number(v.questoesFeitas||0); tC+=Number(v.acertos||0); });

      const simQ = query(collection(db,'users',user.uid,'simulados'));
      const simSnap = await getDocs(simQ);
      simSnap.docs.forEach(d => { const v=d.data(); tMin+=Number(v.durationMinutes||0); tQ+=Number(v.resumo?.totalQuestoes||0); tC+=Number(v.resumo?.totalAcertos||0); });

      await setDoc(doc(db,'users',user.uid,'stats','geral'), { totalHorasMinutos:tMin, totalQuestoes:tQ, totalAcertos:tC, lastUpdated:Timestamp.now() });
      setWarningAlert({ isOpen:true, title:'Estatisticas atualizadas', message:'Os dados gerais foram recalculados com sucesso.' });
    } catch {
      setWarningAlert({ isOpen:true, title:'Erro ao recalcular', message:'Nao foi possivel recalcular as estatisticas agora. Tente novamente em instantes.' });
    }
    finally { setLoading(false); }
  };

  const syncRegistroEstudoWithCiclo = async (payload) => {
    if (!payload?.cicloId || payload?.isRevisao || payload?.revisao || payload?.tipoEstudo === 'revisao') return;
    const minutosRegistrados = Number(payload.tempoEstudadoMinutos || 0);
    if (minutosRegistrados <= 0) return;

    const cicloRef = doc(db, 'users', user.uid, 'ciclos', payload.cicloId);
    const cicloSnap = await getDoc(cicloRef);
    const cicloData = cicloSnap.data() || {};
    const ordemSessoes = Array.isArray(cicloData.ordemSessoes) ? cicloData.ordemSessoes : [];
    if (!ordemSessoes.length) return;

    const tempoSessaoMinutos = Math.max(1, Number(cicloData.tempoSessaoMinutos || 50));
    const concluidas = Array.isArray(cicloData.sessoesConcluidas) ? cicloData.sessoesConcluidas.map(Number) : [];
    const progressoSessoes = cicloData.progressoSessoes || {};
    const disciplinaIdRegistro = String(payload.disciplinaId || '').trim();
    const assuntoRegistroNorm = normalizeRegistroText(payload.assunto);

    const candidatos = ordemSessoes
      .map((sessao, globalIndex) => ({ ...sessao, globalIndex }))
      .filter((sessao) => {
        if (concluidas.includes(Number(sessao.globalIndex))) return false;
        if (Number.isFinite(Number(payload.sessaoGlobalIndex)) && Number(payload.sessaoGlobalIndex) !== Number(sessao.globalIndex)) return false;
        if (disciplinaIdRegistro && String(sessao.disciplinaId || '') !== disciplinaIdRegistro) return false;
        if (!assuntoRegistroNorm) return true;
        const assuntoSessao = getAssuntoCicloPorSessao(cicloData, activeCycleDisciplines, sessao);
        return !assuntoSessao || normalizeRegistroText(assuntoSessao) === assuntoRegistroNorm;
      })
      .sort((a, b) => Number(a.globalIndex) - Number(b.globalIndex));

    if (!candidatos.length) return;

    let minutosRestantes = minutosRegistrados;
    const updates = {};
    const novasConcluidas = [...concluidas];

    for (const sessao of candidatos) {
      if (minutosRestantes <= 0) break;
      const index = Number(sessao.globalIndex);
      const progressoAtual = Number(progressoSessoes?.[index] || progressoSessoes?.[String(index)] || 0);
      const faltantes = Math.max(0, tempoSessaoMinutos - progressoAtual);
      if (faltantes <= 0) continue;

      const incremento = Math.min(faltantes, minutosRestantes);
      const novoProgresso = progressoAtual + incremento;
      const concluiu = novoProgresso >= tempoSessaoMinutos;

      updates[`progressoSessoes.${index}`] = novoProgresso;
      if (concluiu && !novasConcluidas.includes(index)) {
        novasConcluidas.push(index);
        updates.sessoesConcluidas = novasConcluidas;
        updates[`sessoesConcluidasDetalhes.${index}`] = {
          concluidaEm: payload.data,
          atualizadoEm: Timestamp.now(),
          origem: 'registro_manual',
        };
      }
      minutosRestantes -= incremento;
    }

    if (Object.keys(updates).length) await updateDoc(cicloRef, updates);
  };

  const syncRegistroRevisaoWithCiclo = async (payload) => {
    if (!payload?.cicloId) return;
    const minutosRegistrados = Number(payload.tempoEstudadoMinutos || 0);
    if (minutosRegistrados <= 0) return;

    const revisoesRef = collection(db, 'users', user.uid, 'revisoesCiclo');
    const snap = await getDocs(query(revisoesRef, where('cicloId', '==', payload.cicloId)));
    const disciplinaIdRegistro = String(payload.disciplinaId || '').trim();
    const assuntoRegistroNorm = normalizeRegistroText(payload.assunto);
    const dataRegistro = String(payload.data || '');

    const revisoes = snap.docs
      .map((document) => ({ id: document.id, ...document.data() }))
      .filter((rev) => {
        if (rev.concluida) return false;
        if (disciplinaIdRegistro && String(rev.disciplinaId || '') !== disciplinaIdRegistro) return false;
        if (assuntoRegistroNorm && normalizeRegistroText(rev.assunto) !== assuntoRegistroNorm) return false;
        if (dataRegistro && rev.dataAgendada && String(rev.dataAgendada) > dataRegistro) return false;
        return true;
      })
      .sort((a, b) => String(a.dataAgendada || '').localeCompare(String(b.dataAgendada || '')));

    let minutosRestantes = minutosRegistrados;
    for (const rev of revisoes) {
      if (minutosRestantes <= 0) break;
      const revisaoRef = doc(revisoesRef, rev.id);
      const tempoPlanejado = Math.max(1, Number(rev.tempoMinutos || 20));
      const progressoAtual = Number(rev.progressoMinutos || 0);
      const faltantes = Math.max(0, tempoPlanejado - progressoAtual);
      if (faltantes <= 0) continue;

      const incremento = Math.min(faltantes, minutosRestantes);
      const novoProgresso = progressoAtual + incremento;
      const concluiu = novoProgresso >= tempoPlanejado;

      await setDoc(revisaoRef, {
        progressoMinutos: novoProgresso,
        tempoMinutos: tempoPlanejado,
        ...(concluiu ? { concluida: true, concluidaEm: Timestamp.now() } : {}),
        atualizadaEm: Timestamp.now(),
      }, { merge: true });

      minutosRestantes -= incremento;
    }
  };

  const addRegistroEstudo = async (data) => {
    try {
      const explicitContext = data?.contextoRegistro;
      const hasCicloDisponivel = Boolean(activeCicloId);
      const hasCronogramaDisponivel = Boolean(activeCronogramaData?.id);

      let contextoRegistro = isRegistroContext(explicitContext) ? explicitContext : null;
      if (!contextoRegistro) {
        if (data?.cronogramaId && !data?.cicloId) contextoRegistro = 'cronograma';
        else if (data?.cicloId && !data?.cronogramaId) contextoRegistro = 'ciclo';
        else if (hasCicloDisponivel && !hasCronogramaDisponivel) contextoRegistro = 'ciclo';
        else if (!hasCicloDisponivel && hasCronogramaDisponivel) contextoRegistro = 'cronograma';
      }

      const cicloIdResolved = contextoRegistro === 'ciclo'
        ? (data?.cicloId || activeCicloId || null)
        : null;
      const cronogramaIdResolved = contextoRegistro === 'cronograma'
        ? (data?.cronogramaId || activeCronogramaData?.id || null)
        : null;

      if (contextoRegistro === 'cronograma' && !cronogramaIdResolved) {
        throw new Error('cronograma-id-obrigatorio');
      }

      if (contextoRegistro === 'ciclo' && String(cicloIdResolved || '') === String(activeCicloId || '') && cicloPendenteFinalizacao) {
        setWarningAlert({ isOpen:true, title:'Ciclo aguardando finalizacao', message:cicloFinalizacaoMessage });
        return;
      }

      const payload = {
        ...data,
        data: data?.data || dateToYMD(new Date()),
        tempoEstudadoMinutos: Number(data?.tempoEstudadoMinutos || 0),
        questoesFeitas: Number(data?.questoesFeitas || 0),
        acertos: Number(data?.acertos || 0),
        timestamp: Timestamp.now(),
        ...(contextoRegistro ? { contextoRegistro } : {}),
        ...(cicloIdResolved ? { cicloId: cicloIdResolved } : {}),
        ...(cronogramaIdResolved ? { cronogramaId: cronogramaIdResolved } : {}),
        ...(contextoRegistro === 'cronograma' && data?.naoConcluidoCronograma
          ? { naoConcluidoCronograma: true }
          : {}),
      };

      const completionDocId = getCompletionDocId(payload.origemConclusaoId);
      let registroJaExistia = false;
      if (completionDocId) {
        const registroRef = doc(db,'users',user.uid,'registrosEstudo',completionDocId);
        const existingRegistro = await getDoc(registroRef);
        registroJaExistia = existingRegistro.exists();
        await setDoc(registroRef, payload);
        setAllRegistrosEstudo((prev) => {
          const normalized = normalizeRegistroPayload(completionDocId, payload);
          const withoutCurrent = prev.filter((item) => item.id !== completionDocId);
          return sortRegistrosEstudo([normalized, ...withoutCurrent]);
        });
      } else {
        const registroRef = await addDoc(collection(db,'users',user.uid,'registrosEstudo'), payload);
        setAllRegistrosEstudo((prev) => sortRegistrosEstudo([
          normalizeRegistroPayload(registroRef.id, payload),
          ...prev.filter((item) => item.id !== registroRef.id),
        ]));
      }

      if (registroJaExistia) return;

      const intervaloRevisaoDias = Number(payload.intervaloRevisaoDias);
      const intervalosRevisaoCiclo = payload.revisaoAutomaticaCiclo === true
        ? [1, 7, 30]
        : [intervaloRevisaoDias].filter((intervalo) => Number.isFinite(intervalo) && intervalo > 0);
      const deveAgendarRevisaoCiclo = Boolean(
        payload.cicloId &&
        payload.assunto &&
        intervalosRevisaoCiclo.length > 0
      );

      if (deveAgendarRevisaoCiclo) {
        for (const intervalo of intervalosRevisaoCiclo) {
          const baseDate = ymdToDateLocal(payload.data);
          baseDate.setDate(baseDate.getDate() + intervalo);

          await upsertCicloRevisao(db, user.uid, {
            cicloId: payload.cicloId,
            disciplinaId: payload.disciplinaId || null,
            disciplinaNome: payload.disciplinaNome || 'Disciplina',
            assunto: payload.assunto,
            dataAgendada: dateToYMD(baseDate),
            intervaloDias: intervalo,
            origem: payload.revisaoAutomaticaCiclo === true ? 'registro_estudo_auto_1_7_30' : 'registro_estudo',
          });
        }
      }

      if (payload.contextoRegistro === 'ciclo' && payload.cicloId) {
        const cicloRef = doc(db, 'users', user.uid, 'ciclos', payload.cicloId);
        const disciplinaKey = payload.disciplinaId || null;
        const assuntoAtual = String(payload.assunto || '').trim();

        if (payload.teoriaNaoFinalizadaCiclo && disciplinaKey && assuntoAtual) {
          await setDoc(cicloRef, {
            pendenciasTeoria: {
              [disciplinaKey]: {
                assuntoAtual,
                minutosAcumulados: Number(payload.tempoEstudadoMinutos || 0),
                status: 'pendente',
                atualizadoEm: Timestamp.now(),
              },
            },
          }, { merge: true });
        } else if (disciplinaKey && assuntoAtual && (payload.assuntoFinalizadoCiclo || payload.markAsFinished)) {
          await setDoc(cicloRef, {
            pendenciasTeoria: {
              [disciplinaKey]: {
                assuntoAtual: '',
                minutosAcumulados: 0,
                status: 'finalizado',
                atualizadoEm: Timestamp.now(),
              },
            },
          }, { merge: true });
        }

        if (!payload.teoriaNaoFinalizadaCiclo) {
          await syncRegistroEstudoWithCiclo(payload);
        }
      }

      const statsRef = doc(db,'users',user.uid,'stats','geral');
      const statsDoc = await getDoc(statsRef);
      const vals = {
        totalHorasMinutos: increment(payload.tempoEstudadoMinutos),
        totalQuestoes: increment(payload.questoesFeitas),
        totalAcertos: increment(payload.acertos),
      };
      if (!statsDoc.exists()) {
        await setDoc(statsRef, {
          totalHorasMinutos: payload.tempoEstudadoMinutos,
          totalQuestoes: payload.questoesFeitas,
          totalAcertos: payload.acertos,
        });
      }
      else await updateDoc(statsRef, vals);

      const isRegistroRevisao = payload.isRevisao || payload.revisao || payload.tipoEstudo === 'revisao';

      if (payload.contextoRegistro === 'cronograma' && payload.cronogramaId) {
        if (isRegistroRevisao) {
          await syncRegistroRevisaoWithCronograma({
            db,
            userUid: user.uid,
            cronogramaId: payload.cronogramaId,
            registro: payload,
          });
        } else if (payload.naoConcluidoCronograma) {
          await marcarPendenciaTeoriaPorRegistro({
            db,
            userUid: user.uid,
            cronogramaId: payload.cronogramaId,
            registro: payload,
          });
        } else {
          await syncRegistroEstudoWithCronograma({
            db,
            userUid: user.uid,
            cronogramaId: payload.cronogramaId,
            registro: payload,
          });
        }
      }

      if (payload.contextoRegistro === 'ciclo' && payload.cicloId && isRegistroRevisao) {
        await syncRegistroRevisaoWithCiclo(payload);
      }

    } catch (e) { console.error(e); }
  };

  const deleteRegistro = async (id) => {
    try {
      const ref = doc(db,'users',user.uid,'registrosEstudo',id);
      const snap = await getDoc(ref);
      if (snap.exists()) {
        const data = snap.data();
        await deleteDoc(ref);
        setAllRegistrosEstudo((prev) => prev.filter((item) => item.id !== id));
        const statsRef = doc(db,'users',user.uid,'stats','geral');
        try { await updateDoc(statsRef, { totalHorasMinutos:increment(-(data.tempoEstudadoMinutos||0)), totalQuestoes:increment(-(data.questoesFeitas||0)), totalAcertos:increment(-(data.acertos||0)) }); } catch {}
      }
    } catch (e) { console.error(e); }
  };

  const deleteCompletionRegistro = async (completionData) => {
    try {
      const origemConclusaoId = typeof completionData === 'string'
        ? completionData
        : completionData?.origemConclusaoId;
      if (!origemConclusaoId) return false;

      let deleted = false;
      const completionDocId = getCompletionDocId(origemConclusaoId);
      if (completionDocId) {
        const ref = doc(db,'users',user.uid,'registrosEstudo',completionDocId);
        const snap = await getDoc(ref);
        if (snap.exists()) {
          await deleteRegistro(completionDocId);
          deleted = true;
        }
      }

      const q = query(
        collection(db,'users',user.uid,'registrosEstudo'),
        where('origemConclusaoId','==',origemConclusaoId)
      );
      const snap = await getDocs(q);
      for (const document of snap.docs) {
        if (document.id !== completionDocId) {
          await deleteRegistro(document.id);
          deleted = true;
        }
      }

      return deleted;
    } catch (e) {
      console.error('[Dashboard] Erro ao remover registro de conclusao:', e);
      return false;
    }
  };

  const deleteData  = async (col, id) => { await deleteDoc(doc(db,'users',user.uid,col,id)); };
  const addGoal     = async (goalData) => { await addDoc(collection(db,'users',user.uid,'metas'), { ...goalData, startDate:dateToYMD(new Date()) }); };

  const handleStartStudy = (disciplina, assunto = null, options = {}) => {
    if (activeSimuladoSession) { setWarningAlert({ isOpen:true, title:'Sessão Conflitante', message:'Você tem um Simulado em andamento.' }); return; }
    const contextHint = isRegistroContext(options?.defaultContext) ? options.defaultContext : defaultRegistroContext;
    setActiveStudySession({
      disciplina,
      assunto,
      isMinimized:false,
      defaultContext: contextHint,
      sessaoGlobalIndex: Number.isFinite(Number(options?.sessaoGlobalIndex)) ? Number(options.sessaoGlobalIndex) : null,
    });
  };
  const handleOpenGlobalRegistro = () => {
    if (!hasActiveStudyContext) {
      setWarningAlert({ isOpen:true, title:'Planejamento Necessario', message:'Ative um ciclo ou cronograma para registrar estudos.' });
      return;
    }
    if (activeStudySession || activeSimuladoSession) {
      setWarningAlert({ isOpen:true, title:'Sessao em andamento', message:'Finalize o timer ativo antes de abrir um novo registro manual.' });
      return;
    }
    setShowGlobalRegistroModal(true);
  };

  const handleStopStudyRequest = (minutes) => {
    if (!activeStudySession) return;
    if (!hasActiveStudyContext) {
      setWarningAlert({ isOpen:true, title:'Planejamento nao encontrado', message:'Ative um ciclo ou cronograma antes de finalizar esta sessao.' });
      return;
    }
    const cur = JSON.parse(localStorage.getItem(STUDY_STORAGE_KEY)||'{}');
    localStorage.setItem(STUDY_STORAGE_KEY, JSON.stringify({ ...cur, isFinishing:true, tempMinutes:minutes, isPaused:true }));
    setFinishModalData({
      minutes,
      disciplinaNome:activeStudySession.disciplina.nome,
      assuntoInicial:activeStudySession.assunto,
      defaultContext: activeStudySession.defaultContext || null,
      sessaoGlobalIndex: activeStudySession.sessaoGlobalIndex ?? null,
    });
  };

  const handleRetomarEstudo = () => {
    setFinishModalData(null); setPendingReviewData(null);
    const cur = JSON.parse(localStorage.getItem(STUDY_STORAGE_KEY)||'{}');
    if (cur.disciplinaId) {
      delete cur.isFinishing; delete cur.tempMinutes; cur.isPaused = true;
      localStorage.setItem(STUDY_STORAGE_KEY, JSON.stringify(cur));
      setActiveStudySession({
        disciplina:{ id:cur.disciplinaId, nome:cur.disciplinaNome },
        assunto:cur.assunto,
        isMinimized:false,
        defaultContext: isRegistroContext(cur.defaultContext) ? cur.defaultContext : null,
        sessaoGlobalIndex: Number.isFinite(Number(cur.sessaoGlobalIndex)) ? Number(cur.sessaoGlobalIndex) : null,
      });
    }
  };

  const handleConfirmCancelStudy = async () => {
    setActiveStudySession(null); setFinishModalData(null); setPendingReviewData(null);
    localStorage.removeItem(STUDY_STORAGE_KEY); clearActiveTimerDoc();
  };

  const handleConfirmFinishStudy = async (resultData) => {
    const dataRef = finishModalData || pendingReviewData;
    if (!dataRef) return;
    if (resultData.savedInternal) {
      localStorage.removeItem(STUDY_STORAGE_KEY);
      setFinishModalData(null); setPendingReviewData(null); setActiveStudySession(null);
      clearActiveTimerDoc(); fetchHistory(); return;
    }
    const { minutes } = dataRef;
    const {
      questions,
      correct,
      obs,
      assunto,
      disciplinaNomeCorrigido,
      markAsFinished,
      contextoRegistro,
      teoriaNaoFinalizadaCiclo,
      naoConcluidoCronograma,
    } = resultData;
    const nomeFinal = disciplinaNomeCorrigido || dataRef.disciplinaNome;

    try {
      const storageData = JSON.parse(localStorage.getItem(STUDY_STORAGE_KEY)||'{}');
      const finalDiscId = activeStudySession?.disciplina?.id || storageData.disciplinaId || 'restored_id';
      localStorage.removeItem(STUDY_STORAGE_KEY);

      const isEdital  = activeCicloData?.editalId || activeCicloData?.templateId;
      const tipoCiclo = isEdital ? 'Edital Base' : 'Ciclo Manual';
      const nomeCiclo = activeCicloData?.nome || 'Ciclo Personalizado';

      await addRegistroEstudo({
        cicloId:activeCicloId,
        cicloNome:nomeCiclo,
        cicloTipo:tipoCiclo,
        disciplinaId:finalDiscId,
        disciplinaNome:nomeFinal,
        data:dateToYMD(new Date()),
        tempoEstudadoMinutos:minutes,
        questoesFeitas:questions,
        acertos:correct,
        obs:obs||'Sessão via Timer',
        assunto:assunto||null,
        timestamp:Timestamp.now(),
        ...(Number.isFinite(Number(dataRef.sessaoGlobalIndex)) && !teoriaNaoFinalizadaCiclo ? { sessaoGlobalIndex: Number(dataRef.sessaoGlobalIndex) } : {}),
        ...(isRegistroContext(contextoRegistro) ? { contextoRegistro } : {}),
        ...(markAsFinished ? { markAsFinished: true, assuntoFinalizado: true } : {}),
        ...(contextoRegistro === 'ciclo' && markAsFinished ? { assuntoFinalizadoCiclo: true } : {}),
        ...(contextoRegistro === 'ciclo' && teoriaNaoFinalizadaCiclo ? { teoriaNaoFinalizadaCiclo: true } : {}),
        ...(contextoRegistro === 'cronograma' && naoConcluidoCronograma ? { naoConcluidoCronograma: true } : {}),
      });

      if (contextoRegistro === 'ciclo' && markAsFinished && assunto) {
        await addDoc(collection(db,'users',user.uid,'registrosEstudo'), { cicloId:activeCicloId, cicloNome:nomeCiclo, cicloTipo:tipoCiclo, disciplinaId:finalDiscId, disciplinaNome:nomeFinal, assunto, data:dateToYMD(new Date()), timestamp:Timestamp.now(), tempoEstudadoMinutos:0, questoesFeitas:0, acertos:0, tipoEstudo:'check_manual', obs:'Concluído via Timer' });
        fetchHistory();
      }

      setFinishModalData(null); setPendingReviewData(null); setActiveStudySession(null); clearActiveTimerDoc();
    } catch (e) {
      console.error(e);
      setWarningAlert({ isOpen:true, title:'Erro ao salvar sessao', message:'Nao foi possivel salvar a sessao. Verifique sua conexao e tente novamente.' });
    }
  };

  const handleStartSimulado = (config) => {
    if (activeStudySession) { setWarningAlert({ isOpen:true, title:'Sessão Conflitante', message:'Finalize a sessão de estudo antes.' }); return; }
    setActiveSimuladoSession({ titulo:config.titulo||'Simulado', mode:config.mode||'free', initialSeconds:Number(config.totalSeconds)||Number(config.initialSeconds)||14400, isMinimized:false, isNewSession:true });
  };

  const handleFinishSimulado = async (minutes) => {
    const titulo = activeSimuladoSession?.titulo||'Simulado';
    const data   = { titulo, data:dateToYMD(new Date()), durationMinutes:minutes };
    localStorage.setItem(SIMULADO_PENDING_KEY, JSON.stringify(data));
    setFinishedSimuladoData(data); setActiveSimuladoSession(null); clearActiveSimuladoDoc(); setActiveTab('simulados');
  };

  const handleRecoverSimulado = () => {
    if (pendingSimuladoReview) { setFinishedSimuladoData(pendingSimuladoReview); setPendingSimuladoReview(null); setActiveTab('simulados'); }
  };

  const handleCancelSimulado  = () => { setActiveSimuladoSession(null); clearActiveSimuladoDoc(); localStorage.removeItem(SIMULADO_STORAGE_KEY); };
  const handleClearSimuladoData = () => { setFinishedSimuladoData(null); localStorage.removeItem(SIMULADO_PENDING_KEY); };

  const handleTourCloseOrFinish = (type) => { if (user) localStorage.setItem(`onboarding_seen_${user.uid}_${type}`,'true'); setTourState({ isActive:false, type:'main' }); };

  const setPreferredHomeContext = (value) => {
    if (!isRegistroContext(value)) return;
    try {
      localStorage.setItem('homeContextPreferred', value);
      window.dispatchEvent(new CustomEvent('home-context-preferred-change', { detail: value }));
    } catch (error) {
      void error;
    }
  };

  const handleCicloCreationOrActivation = (cicloId) => {
    setPreferredHomeContext('ciclo');
    if (cicloId) setTargetOpenCicloId(cicloId);
    setActiveTab('ciclos'); setForceOpenVisual(true); setTimeout(() => setForceOpenVisual(false), 1000);
    if (ENABLE_ONBOARDING_TOUR && user) { const seen = localStorage.getItem(`onboarding_seen_${user.uid}_cycle_visual`); if (!seen) setTourState({ isActive:true, type:'cycle_visual' }); }
  };

  const handleCronogramaCreation = () => {
    setPreferredHomeContext('cronograma');
    setActiveTab('cronograma');
  };

  const handleGoToActiveCycle = () => { if (activeCicloId) handleCicloCreationOrActivation(activeCicloId); else setActiveTab('planejamento'); };
  const handleCreateNewCycleFromLegacy = useCallback(() => {
    setForcePlanejamentoSelector(true);
    setActiveTab('planejamento');
  }, []);

  const handleTabChange = (tab) => {
    const resolvedTab = tab === 'cronogramas' ? 'planejamento' : tab;
    if (resolvedTab !== 'planejamento') setForcePlanejamentoSelector(false);
    if (resolvedTab === 'cronograma') setPreferredHomeContext('cronograma');
    if (resolvedTab === 'ciclos') {
      if (activeCicloId) {
        handleCicloCreationOrActivation(activeCicloId);
        return;
      }
      setForcePlanejamentoSelector(true);
      setActiveTab('planejamento');
      return;
    }
    setActiveTab(resolvedTab);
    if (resolvedTab !== 'ciclos') { setForceOpenVisual(false); setIsTimerRaised(false); }
  };

  const handleChoosePlanFromRevisao = useCallback(() => {
    setForcePlanejamentoSelector(true);
    setActiveTab('planejamento');
  }, []);

  const handleSeletorDiretoAberto = useCallback(() => {
    setForcePlanejamentoSelector(false);
  }, []);

  const markUpdateCarouselSeen = useCallback(async (action = 'planning_created') => {
    if (!user?.uid) return;

    const localBaseKey = `modoqap_welcome_carousel_${user.uid}`;
    localStorage.setItem(`${localBaseKey}_update_${WELCOME_UPDATE_VERSION}`, 'true');
    setWelcomeCarousel((current) => (
      current.mode === 'update' ? { loading:false, mode:null } : current
    ));

    try {
      await setDoc(doc(db, 'users', user.uid, 'system_state', 'welcome_carousel'), {
        updateVersionSeen: WELCOME_UPDATE_VERSION,
        updateCompletedAt: Timestamp.now(),
        lastCompletedMode: 'update',
        lastCompletedAction: action,
        lastCompletedAt: Timestamp.now(),
      }, { merge:true });
    } catch (error) {
      console.error('[Dashboard] Erro ao marcar carrossel de atualizacao como visto:', error);
    }
  }, [user?.uid]);

  const handleWelcomeCreatePlanning = useCallback(() => {
    markUpdateCarouselSeen('create_planning_from_carousel');
    setForcePlanejamentoSelector(true);
    setActiveTab('planejamento');
  }, [markUpdateCarouselSeen]);

  useEffect(() => {
    const handlePlanningCreated = () => {
      markUpdateCarouselSeen('planning_created');
      setWelcomeCarousel((current) => ({ ...current, mode:null }));
    };

    window.addEventListener('Planning:Created', handlePlanningCreated);
    return () => window.removeEventListener('Planning:Created', handlePlanningCreated);
  }, [markUpdateCarouselSeen]);

  const handleWelcomeCarouselComplete = useCallback(async ({ action } = {}) => {
    if (!user?.uid) {
      setWelcomeCarousel({ loading:false, mode:null });
      return;
    }

    const completedMode = welcomeCarousel.mode;
    const localBaseKey = `modoqap_welcome_carousel_${user.uid}`;
    const payload = {
      lastCompletedMode: completedMode || null,
      lastCompletedAction: action || 'done',
      lastCompletedAt: Timestamp.now(),
    };

    if (completedMode === 'welcome') {
      payload.welcomeSeen = true;
      payload.welcomeCompletedAt = Timestamp.now();
      payload.updateVersionSeen = WELCOME_UPDATE_VERSION;
      payload.updateCompletedAt = Timestamp.now();
      localStorage.setItem(`${localBaseKey}_welcome`, 'true');
      localStorage.setItem(`${localBaseKey}_update_${WELCOME_UPDATE_VERSION}`, 'true');
    } else if (completedMode === 'update') {
      payload.updateVersionSeen = WELCOME_UPDATE_VERSION;
      payload.updateCompletedAt = Timestamp.now();
      localStorage.setItem(`${localBaseKey}_update_${WELCOME_UPDATE_VERSION}`, 'true');
    }

    setWelcomeCarousel({ loading:false, mode:null });

    try {
      await setDoc(doc(db, 'users', user.uid, 'system_state', 'welcome_carousel'), payload, { merge:true });
    } catch (error) {
      console.error('[Dashboard] Erro ao salvar carrossel inicial:', error);
    }
  }, [user?.uid, welcomeCarousel.mode]);

  const handleLogout     = async () => { clearActiveTimerDoc(); clearActiveSimuladoDoc(); signOut(auth).catch(console.error); };

  const handleShareGoal  = (stats) => { setSharePreviewData({ stats, userName:user.displayName||'Estudante', dayData:dayToShareData, goals:goalsHistory[0]||{ questions:0, hours:0 }, isDarkMode }); };

  useLayoutEffect(() => {
    scrollToTopInstant(mainContentRef.current);
  }, [activeTab]);

  const handleDownloadPDF = async () => {
    const el = document.getElementById('share-card-capture-target');
    if (!el) {
      setWarningAlert({ isOpen:true, title:'Erro ao capturar cartao', message:'Nao encontramos o cartao para gerar o PDF. Feche o preview e tente novamente.' });
      return;
    }
    const bw = document.querySelector('.download-button-wrapper');
    if (bw) bw.style.display = 'none';
    try {
      const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
        import('html2canvas'),
        import('jspdf'),
      ]);
      const W = 340, H = el.offsetHeight, pxMm = 0.264583;
      const canvas = await html2canvas(el, { scale:4.0, useCORS:true, backgroundColor:sharePreviewData?.isDarkMode?'#18181b':'#ffffff' });
      const pdf = new jsPDF({ orientation:'p', unit:'mm', format:[W*pxMm, H*pxMm] });
      pdf.addImage(canvas.toDataURL('image/jpeg',1.0),'JPEG',0,0,W*pxMm,H*pxMm);
      pdf.save(`Progresso_${dateToYMD(new Date())}.pdf`);
      setSharePreviewData(null); setIsDownloadAlertVisible(true); setTimeout(() => setIsDownloadAlertVisible(false),3500);
    } catch {
      setWarningAlert({ isOpen:true, title:'Falha ao gerar PDF', message:'Nao foi possivel gerar o arquivo agora. Tente novamente em instantes.' });
    }
    finally { if (bw) bw.style.display = 'flex'; }
  };

  useEffect(() => {
    if (!ENABLE_ONBOARDING_TOUR) return;

    if (!user || loading) return;
    const type    = 'main';
    const hasSeen = localStorage.getItem(`onboarding_seen_${user.uid}_${type}`);
    const isNew   = goalsHistory.length === 0 && mergedAllRegistrosEstudo.length === 0;

    if (!hasSeen && isNew)  setTourState({ isActive:true, type });
    else if (!isNew && !hasSeen) handleTourCloseOrFinish(type);
  }, [user, loading, goalsHistory.length, mergedAllRegistrosEstudo.length]);

  useEffect(() => {
    if (!user) return;
    setActiveCicloLoaded(false);
    const q = query(collection(db,'users',user.uid,'ciclos'), where('ativo','==',true), where('arquivado','==',false));
    return onSnapshot(q, (snap) => {
      if (snap.empty) { setActiveCicloId(null); setActiveCicloData(null); }
      else { const d = snap.docs[0]; setActiveCicloId(d.id); setActiveCicloData({ id:d.id, ...d.data() }); }
      setActiveCicloLoaded(true);
    }, (error) => {
      console.error('[Dashboard] Erro ao sincronizar ciclo ativo:', error);
      setActiveCicloId(null);
      setActiveCicloData(null);
      setActiveCicloLoaded(true);
    });
  }, [user]);

  useEffect(() => {
    if (!user) return;
    setActiveCronogramaLoaded(false);
    const q = query(collection(db,'users',user.uid,'cronogramas'), where('ativo','==',true));
    return onSnapshot(q, (snap) => {
      if (snap.empty) setActiveCronogramaData(null);
      else setActiveCronogramaData({ id:snap.docs[0].id, ...snap.docs[0].data() });
      setActiveCronogramaLoaded(true);
    }, (error) => {
      console.error('[Dashboard] Erro ao sincronizar cronograma ativo:', error);
      setActiveCronogramaData(null);
      setActiveCronogramaLoaded(true);
    });
  }, [user]);

  useEffect(() => {
    if (!user || !activeCicloId) { setActiveCycleDisciplines([]); return; }
    return onSnapshot(
      query(collection(db,'users',user.uid,'ciclos',activeCicloId,'disciplinas')),
      (snap) => setActiveCycleDisciplines(snap.docs.map(d => {
        const data = d.data();
        const assuntos = Array.isArray(data.assuntos)
          ? data.assuntos.map(a => typeof a==='string' ? { nome:a, inCiclo:true } : { ...a, nome:(a?.nome||'').trim(), inCiclo:a?.inCiclo!==false }).filter(a=>a.nome)
          : [];
        return { id:d.id, ...data, assuntos, inCiclo:data.inCiclo!==false };
      }))
    );
  }, [user, activeCicloId]);

  useEffect(() => {
    if (!user) return;
    return onSnapshot(
      query(collection(db,'users',user.uid,'metas'), orderBy('startDate','desc')),
      (snap) => setGoalsHistory(snap.docs.map(d => ({ id:d.id, ...d.data() })))
    );
  }, [user]);

  const renderTabContent = () => {
    if (loading && ['home','calendar','stats'].includes(activeTab)) {
      return <SectionLoader minHeight="18rem" label="Carregando seus dados" />;
    }
    switch (activeTab) {
      case 'home':
        return <Home registrosEstudo={mergedActiveRegistrosEstudo} allRegistrosEstudo={mergedAllRegistrosEstudo} goalsHistory={goalsHistory} setActiveTab={handleGoToActiveCycle} activeCicloData={activeCicloData} activeCronogramaData={activeCronogramaData} onGoToCronograma={() => handleCronogramaCreation(activeCronogramaData?.id)} onGoToRevisao={() => setActiveTab('revisoes')} onStartStudy={handleStartStudy} addRegistroEstudo={addRegistroEstudo} deleteCompletionRegistro={deleteCompletionRegistro} user={user} />;
      case 'calendar':
        return <CalendarTab registrosEstudo={mergedAllRegistrosEstudo} goalsHistory={goalsHistory} onDeleteRegistro={deleteRegistro} activeCicloData={activeCicloData} activeCronogramaData={activeCronogramaData}/>;
      case 'ciclos':
        return <CiclosPage user={user} onStartStudy={handleStartStudy} onCicloAtivado={handleCicloCreationOrActivation} addRegistroEstudo={addRegistroEstudo} deleteCompletionRegistro={deleteCompletionRegistro} onDeleteRegistro={deleteRegistro} activeCicloId={activeCicloId} forceOpenVisual={forceOpenVisual} targetOpenCicloId={targetOpenCicloId} onTargetOpenHandled={() => setTargetOpenCicloId(null)} onGoToEdital={() => setActiveTab('edital')} onCreateNewCycle={handleCreateNewCycleFromLegacy} registrosEstudo={mergedAllRegistrosEstudo} isTimerActive={!!(activeStudySession||activeSimuladoSession)}/>;
      case 'planejamento':
        return <PlanejamentoPage user={user} addRegistroEstudo={addRegistroEstudo} onStartStudy={handleStartStudy} onGoToEdital={() => setActiveTab('edital')} registrosEstudo={mergedAllRegistrosEstudo} isTimerActive={!!(activeStudySession||activeSimuladoSession)} onGoToCronograma={handleCronogramaCreation} onCicloAtivado={handleCicloCreationOrActivation} abrirDiretoSeletor={isNovoUsuarioPlanejamento || forcePlanejamentoSelector} onSeletorDiretoAberto={handleSeletorDiretoAberto} onOpenFeedback={handleOpenFeedback} />;
      case 'cronograma':
        return <CronogramaPage user={user} onStartStudy={handleStartStudy} addRegistroEstudo={addRegistroEstudo} deleteCompletionRegistro={deleteCompletionRegistro} registrosEstudo={mergedAllRegistrosEstudo} onDeleteRegistro={deleteRegistro} onGoToEdital={() => setActiveTab('edital')} onGoToRevisao={() => setActiveTab('revisoes')}/>;
      case 'cronogramas':
        return <PlanejamentoPage user={user} addRegistroEstudo={addRegistroEstudo} onStartStudy={handleStartStudy} onGoToEdital={() => setActiveTab('edital')} registrosEstudo={mergedAllRegistrosEstudo} isTimerActive={!!(activeStudySession||activeSimuladoSession)} onGoToCronograma={handleCronogramaCreation} onCicloAtivado={handleCicloCreationOrActivation} abrirDiretoSeletor={isNovoUsuarioPlanejamento || forcePlanejamentoSelector} onSeletorDiretoAberto={handleSeletorDiretoAberto} onOpenFeedback={handleOpenFeedback} />;
      case 'edital':
        return (
          <EditalPage
            user={user}
            activeCicloId={activeCicloId}
            onStartStudy={handleStartStudy}
            onBack={handleGoToActiveCycle}
            editalUpdates={editalUpdates}
            onApplyEditalUpdate={applyEditalUpdate}
            onDismissEditalUpdate={dismissEditalUpdate}
            loadingEditalUpdate={loadingNotif}
            onGoToCronograma={() => handleCronogramaCreation(activeCronogramaData?.id)}
          />
        );
      case 'revisoes':
        return <RevisaoPage user={user} onStartStudy={handleStartStudy} addRegistroEstudo={addRegistroEstudo} deleteCompletionRegistro={deleteCompletionRegistro} onChoosePlan={handleChoosePlanFromRevisao} />;
      case 'stats':
        return <Desempenho registrosEstudo={mergedAllRegistrosEstudo} disciplinasDoCiclo={activeCycleDisciplines} activeCicloId={activeCicloId} activeCronogramaId={activeCronogramaData?.id||null} activeCicloData={activeCicloData} activeCronogramaData={activeCronogramaData} metas={goalsHistory} onCreateCycle={() => setActiveTab('planejamento')}/>;
      case 'simulados':
        return <SimuladosPage user={user} activeCycleDisciplines={activeCycleDisciplines} onStartSimulado={handleStartSimulado} initialData={finishedSimuladoData} onClearInitialData={handleClearSimuladoData}/>;
      case 'profile':
        return <ProfilePage user={user} allRegistrosEstudo={mergedAllRegistrosEstudo} onDeleteRegistro={deleteRegistro}/>;
      case 'noticias':
        return <NoticiasPage/>;
      case 'admin':
        if (userAccess.isLoading) return <SectionLoader minHeight="20rem" />;
        if (userAccess.permissions.adminPanel) return <AdminPage onRecalculateStats={recalculateAllStats} userAccess={userAccess} />;
        return <div className="p-8 text-center text-red-500 font-bold">Acesso Negado</div>;
      default:
        return null;
    }
  };

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

  return (
    <div className="relative isolate flex min-h-screen bg-background-light dark:bg-background-dark text-text-primary dark:text-text-dark-primary transition-colors duration-300 overflow-x-hidden">
      <AppBackgroundEffects />
      <WarningModal isOpen={warningAlert.isOpen} title={warningAlert.title} message={warningAlert.message} onClose={() => setWarningAlert(p => ({ ...p, isOpen:false }))}/>
      <Suspense fallback={null}>
        <WelcomeCarouselModal
          isOpen={!!welcomeCarousel.mode}
          mode={welcomeCarousel.mode || 'welcome'}
          userName={user.displayName || user.email || ''}
          onComplete={handleWelcomeCarouselComplete}
          onCreatePlanning={handleWelcomeCreatePlanning}
        />
      </Suspense>
      {activeTab === 'home' && (
        <Suspense fallback={null}>
          <BroadcastReceiver canShow={!tourState.isActive && !welcomeCarousel.mode} userAccess={userAccess}/>
        </Suspense>
      )}
      <DownloadAlert isVisible={isDownloadAlertVisible} onDismiss={() => setIsDownloadAlertVisible(false)}/>
      <ShareCardPreviewModal data={sharePreviewData} onClose={() => setSharePreviewData(null)} onDownload={handleDownloadPDF}/>

      {sharePreviewData && (
        <div className="fixed top-0 left-0 -translate-x-full z-[-1000] opacity-0">
          <Suspense fallback={null}>
            <ShareCard stats={sharePreviewData.stats} userName={user.displayName||'Estudante'} dayData={sharePreviewData.dayData} goals={sharePreviewData.goals} isDarkMode={sharePreviewData.isDarkMode}/>
          </Suspense>
        </div>
      )}

      {/* NavSideBar com a prop nova para histórico */}
        <NavSideBar
          user={user}
          userAccess={userAccess}
          activeTab={activeTab}
        setActiveTab={handleTabChange}
        handleLogout={handleLogout}
        isExpanded={isSidebarExpanded}
        setExpanded={setIsSidebarExpanded}
        isMobileOpen={isMobileOpen}
        setMobileOpen={setIsMobileOpen}
        isDarkMode={isDarkMode}
        toggleTheme={toggleTheme}
        registrosEstudo={mergedAllRegistrosEstudo}
        goalsHistory={goalsHistory}
        activeCicloId={activeCicloId}
        onShareGoal={handleShareGoal}
        onOpenFeedback={handleOpenFeedback}
        activeCicloData={activeCicloData}
        activeCronogramaData={activeCronogramaData}
        onGoToCicloAtivo={handleGoToActiveCycle}
        shouldGuidePlanning={isNovoUsuarioPlanejamento}
        cicloFinalizacaoAlert={cicloFinalizacaoAlert}
        cicloLegacyUpgradeAlert={cicloLegacyUpgradeAlert}
        notificationProps={{
          notifications,
          unreadCount,
          readBroadcasts,
          dismissedHistory,
          onMarkBroadcastRead: markBroadcastRead,
          onMarkAllRead: markAllRead,
          onApplyEditalUpdate: applyEditalUpdate,
          onDismissEditalUpdate: dismissEditalUpdate,
          loadingNotif,
          onNavigateToEdital: () => handleTabChange('edital'),
          deleteBroadcast,
          deleteHistoryItem
        }}
      />

      <div ref={mainContentRef} className={`dashboard-main-content relative z-10 min-w-0 flex-1 transition-all duration-300 pt-[80px] px-4 md:px-8 lg:pt-[90px] pb-10 ${isSidebarExpanded ? 'lg:ml-[260px]' : 'lg:ml-[80px]'}`}>
        <Header user={user} activeTab={activeTab}/>
        <main className={`mt-2 min-w-0 animate-fade-in ${['home', 'ciclos', 'cronograma', 'planejamento'].includes(activeTab) ? 'w-full' : 'max-w-7xl mx-auto'}`}>
          <Suspense fallback={<SectionLoader label="Abrindo area" />}>
            {renderTabContent()}
          </Suspense>
        </main>
      </div>

      <Suspense fallback={null}>
        {ENABLE_ONBOARDING_TOUR && (
          <OnboardingTour isActive={tourState.isActive} tourType={tourState.type} activeTab={activeTab} setActiveTab={handleTabChange} onClose={() => handleTourCloseOrFinish(tourState.type)} onFinish={() => handleTourCloseOrFinish(tourState.type)}/>
        )}
        <FeedbackWidget
          user={user}
          isOpen={isFeedbackOpen}
          onClose={() => setIsFeedbackOpen(false)}
          isSidebarOpen={isMobileOpen}
          initialView={feedbackInitialState.initialView}
          initialType={feedbackInitialState.initialType}
        />
      </Suspense>
      <GlobalStudyRegisterFab
        onClick={handleOpenGlobalRegistro}
        disabled={!hasActiveStudyContext}
        disabledMessage="Ative um ciclo ou cronograma para registrar estudo"
        hidden={showGlobalRegistroModal}
      />
      <PlanningSuccessCelebration />

      {showGlobalRegistroModal && hasActiveStudyContext && (
        <Suspense fallback={null}>
          <RegistroEstudoModal
            onClose={() => setShowGlobalRegistroModal(false)}
            addRegistroEstudo={addRegistroEstudo}
            cicloId={activeCicloId || null}
            userId={user.uid}
            availableContexts={registroContextOptions}
            defaultContext={defaultRegistroContext}
            requireExplicitContextSelection={registroContextOptions.length > 1}
          />
        </Suspense>
      )}

      {activeStudySession && (
        <Suspense fallback={null}>
          <StudyTimer
            disciplina={activeStudySession.disciplina}
            assunto={activeStudySession.assunto}
            contextHint={activeStudySession.defaultContext || defaultRegistroContext}
            sessaoGlobalIndex={activeStudySession.sessaoGlobalIndex}
            isMinimized={activeStudySession.isMinimized}
            onStop={handleStopStudyRequest}
            onCancel={handleConfirmCancelStudy}
            onMaximize={() => setActiveStudySession(p => ({ ...p, isMinimized:false }))}
            onMinimize={() => setActiveStudySession(p => ({ ...p, isMinimized:true }))}
            raised={isTimerRaised}
            userUid={user.uid}
            userName={user.displayName||'Estudante'}
            userPhotoURL={user.photoURL||null}
          />
        </Suspense>
      )}

      {activeSimuladoSession && (
        <Suspense fallback={null}>
          <SimuladoTimer
            tituloSimulado={activeSimuladoSession.titulo}
            mode={activeSimuladoSession.mode}
            initialSeconds={activeSimuladoSession.initialSeconds||0}
            isMinimized={activeSimuladoSession.isMinimized}
            isNewSession={activeSimuladoSession.isNewSession===true}
            onStop={handleFinishSimulado}
            onCancel={handleCancelSimulado}
            onMaximize={() => setActiveSimuladoSession(p => ({ ...p, isMinimized:false }))}
            onMinimize={() => setActiveSimuladoSession(p => ({ ...p, isMinimized:true }))}
            userUid={user.uid}
            userName={user.displayName||'Candidato'}
            userPhotoURL={user.photoURL||null}
          />
        </Suspense>
      )}

      {pendingReviewData && !finishModalData && (
        <div className="fixed bottom-24 right-4 z-[9999] animate-fade-in">
          <div onClick={() => setFinishModalData(pendingReviewData)} className="bg-amber-900/90 backdrop-blur-md border border-amber-500/50 shadow-[0_0_20px_rgba(245,158,11,0.2)] rounded-2xl p-3 flex items-center gap-4 w-auto max-w-[320px] overflow-hidden hover:scale-105 transition-transform cursor-pointer">
            <div className="relative flex items-center justify-center w-10 h-10 bg-amber-800 rounded-full shrink-0">
              <div className="absolute inset-0 rounded-full bg-amber-500/20 animate-ping"></div>
              <AlertTriangle size={20} className="text-amber-200 relative z-10"/>
            </div>
            <div className="flex flex-col mr-2 min-w-0">
              <span className="text-[10px] text-amber-200 uppercase font-bold tracking-wider truncate">Registro Pendente</span>
              <span className="text-[10px] text-white truncate leading-tight font-bold">{pendingReviewData.disciplinaNome}</span>
              <span className="text-[9px] text-amber-300/80 italic mt-0.5 truncate">{pendingReviewData.reason}</span>
            </div>
            <div className="p-2 rounded-full bg-amber-800/50 text-amber-100"><Maximize2 size={16}/></div>
          </div>
        </div>
      )}

      {pendingSimuladoReview && !finishedSimuladoData && (
        <div className="fixed bottom-24 right-4 z-[9999] animate-fade-in">
          <div onClick={handleRecoverSimulado} className="bg-red-900/90 backdrop-blur-md border border-red-500/50 shadow-[0_0_20px_rgba(239,68,68,0.2)] rounded-2xl p-3 flex items-center gap-4 w-auto max-w-[320px] overflow-hidden hover:scale-105 transition-transform cursor-pointer">
            <div className="relative flex items-center justify-center w-10 h-10 bg-red-800 rounded-full shrink-0">
              <div className="absolute inset-0 rounded-full bg-red-500/20 animate-ping"></div>
              <ClipboardList size={20} className="text-red-200 relative z-10"/>
            </div>
            <div className="flex flex-col mr-2 min-w-0">
              <span className="text-[10px] text-red-200 uppercase font-bold tracking-wider truncate">Simulado Pendente</span>
              <span className="text-[10px] text-white truncate leading-tight font-bold">{pendingSimuladoReview.titulo}</span>
            </div>
            <div className="p-2 rounded-full bg-red-800/50 text-red-100"><Maximize2 size={16}/></div>
          </div>
        </div>
      )}

      {(finishModalData || (pendingReviewData && finishModalData)) && (
        <Suspense fallback={null}>
          <TimerFinishModal
            timeMinutes={finishModalData.minutes}
            disciplinaNome={finishModalData.disciplinaNome}
            initialAssunto={finishModalData.assuntoInicial}
            disciplinaId={activeStudySession?.disciplina?.id || pendingReviewData?.originalData?.disciplinaId}
            activeCicloId={activeCicloId}
            userUid={user.uid}
            addRegistroEstudo={addRegistroEstudo}
            availableContexts={registroContextOptions}
            defaultContext={finishModalData.defaultContext || pendingReviewData?.defaultContext || defaultRegistroContext}
            requireExplicitContextSelection={registroContextOptions.length > 1}
            sessaoGlobalIndex={finishModalData.sessaoGlobalIndex ?? activeStudySession?.sessaoGlobalIndex ?? null}
            onConfirm={handleConfirmFinishStudy}
            onCancel={handleRetomarEstudo}
            onDiscard={handleConfirmCancelStudy}
            activeCicloData={activeCicloData}
          />
        </Suspense>
      )}

      {isMobileOpen && <div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden" onClick={() => setIsMobileOpen(false)}/>}
    </div>
  );
}

export default Dashboard;

