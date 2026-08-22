import React, { useState, useEffect, useMemo, useCallback, useLayoutEffect, useRef } from 'react';
import {
  collection, onSnapshot, query, orderBy, addDoc, deleteDoc, doc, where, Timestamp,
  getDocs, getDoc, setDoc, updateDoc, increment, deleteField } from 'firebase/firestore';
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
import DailyGoalCompletedModal from '../components/shared/DailyGoalCompletedModal';
import XPNotification from './gamification/XPNotification';
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
const RankingPage = lazy(() => import('../pages/RankingPage'));
const GroupsPage = lazy(() => import('../pages/GroupsPage'));
const LeaguesPage = lazy(() => import('../pages/LeaguesPage'));
const AchievementsPage = lazy(() => import('../pages/AchievementsPage'));

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
  ranking: 'ranking',
  ligas: resolveLeagueFeatureTab('ligas'),
  conquistas: 'conquistas',
  grupos: 'grupos',
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
  ranking: 'ranking',
  ligas: 'ligas',
  conquistas: 'conquistas',
  grupos: 'grupos',
  admin: 'admin',
};

import { useNotifications } from '../hooks/useNotifications';
import { useUserAccess } from '../hooks/useUserAccess';
import { useLevelSystem } from '../hooks/useLevelSystem';
import { useGamificationSync } from '../hooks/useGamificationSync';
import {
  marcarPendenciaTeoriaPorRegistro,
  syncRegistroEstudoWithCronograma,
  syncRegistroRevisaoWithCronograma,
} from '../services/cronogramaProgressSync';
import { getAgendaSemana, getWeekOffsetFromDate } from '../services/scheduling/review';
import { upsertCicloRevisao } from '../services/cicloRevisoes';
import { resolveLogoUrl } from './admin/config/editalAssets';
import { isCicloLegacyForGuide } from '../utils/cicloLegacyUpgrade';
import { buildCicloWeeklyAlert, getCicloWeeklyStatus } from '../utils/cicloWeeklyStatus';
import { DEFAULT_COVER_POSITION, normalizeCoverPosition } from '../utils/profileCover';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import {
  createHydrationState,
  getCoreHydrationStatus,
  HYDRATION_RESOURCE_KEYS,
  isPlanningAssessmentReady,
} from '../utils/appHydration';
import { dismissInitialLoadingScreen } from '../utils/initialLoadingScreen';
import { LEAGUES_ENABLED, resolveLeagueFeatureTab } from '../config/featureFlags';
import {
  buildStudyDaysMap,
  getCronogramaSlotRecordedMinutes,
  getDailyStudyStatus,
} from '../utils/studyDayStatus';
import {
  applyReviewProgress,
  getReviewPlannedMinutes,
  normalizeReviewText,
} from '../services/reviewProgressRules';
import {
  applyCronogramaRegistroProgress,
  emitRegistroProgressOptimisticUpdate,
} from '../services/reviewOptimisticUpdates';
import { requestGamificationRefresh } from '../utils/gamificationRealtime';

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

const normalizeRegistroText = normalizeReviewText;

const getAssuntoCicloPorSessao = (ciclo, disciplinas, sessao) => {
  const disciplina = (disciplinas || []).find((item) => String(item?.id) === String(sessao?.disciplinaId));
  const assuntos = Array.isArray(disciplina?.assuntos) ? disciplina.assuntos : [];
  const assunto = assuntos[Number(sessao?.sessaoIndex || 0) % Math.max(1, assuntos.length)];
  if (typeof assunto === 'string') return assunto;
  return assunto?.nome || assunto?.titulo || assunto?.label || '';
};

const getRegistroDateKey = (registro) => {
  if (registro?.data) return registro.data;
  if (registro?.dataRegistro) return registro.dataRegistro;
  if (registro?.timestamp?.toDate) return dateToYMD(registro.timestamp.toDate());
  if (registro?.createdAt?.toDate) return dateToYMD(registro.createdAt.toDate());
  return null;
};

const getRegistroChronologyValue = (registro) => {
  if (registro?.timestamp?.toDate) return registro.timestamp.toDate().getTime();
  if (registro?.timestamp instanceof Date) return registro.timestamp.getTime();
  if (registro?.timestamp?.seconds) return Number(registro.timestamp.seconds) * 1000;
  if (registro?.createdAt?.toDate) return registro.createdAt.toDate().getTime();
  const dateKey = getRegistroDateKey(registro);
  return dateKey ? ymdToDateLocal(dateKey).getTime() : 0;
};

const sortRegistrosChronologically = (items = []) => [...items].sort((a, b) => {
  const diff = getRegistroChronologyValue(a) - getRegistroChronologyValue(b);
  if (diff !== 0) return diff;
  return String(a.id || '').localeCompare(String(b.id || ''));
});

const getDisciplinaOrderValue = (disciplina, fallbackIndex = 9999) => {
  const value = disciplina?.index ?? disciplina?.ordem ?? disciplina?.position ?? disciplina?.posicao ?? disciplina?.ordemDisciplina;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallbackIndex;
};

const sortDisciplinasByEditalOrder = (disciplinas = []) => (
  [...disciplinas].sort((a, b) => {
    const orderA = getDisciplinaOrderValue(a, a.__sourceOrder ?? 9999);
    const orderB = getDisciplinaOrderValue(b, b.__sourceOrder ?? 9999);
    if (orderA !== orderB) return orderA - orderB;
    const sourceA = Number(a.__sourceOrder ?? 9999);
    const sourceB = Number(b.__sourceOrder ?? 9999);
    if (sourceA !== sourceB) return sourceA - sourceB;
    return (a.nome || '').localeCompare(b.nome || '');
  }).map(({ __sourceOrder, ...disciplina }) => disciplina)
);

const getRegistroContext = (registro) => {
  if (isRegistroContext(registro?.contextoRegistro)) return registro.contextoRegistro;
  if (registro?.cronogramaId && !registro?.cicloId) return 'cronograma';
  if (registro?.cicloId && !registro?.cronogramaId) return 'ciclo';
  return null;
};

const getGoalModalPlanInfo = ({ context, plan }) => {
  const fallbackName = context === 'ciclo' ? 'Ciclo ativo' : 'Cronograma ativo';
  return {
    planName: plan?.nome || fallbackName,
    editalName: plan?.editalNome || plan?.titulo || plan?.nome || fallbackName,
    editalLogo: plan?.logoUrl || plan?.logo || plan?.editalLogoUrl || resolveLogoUrl({ ciclo: plan }),
  };
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

const DashboardBootScreen = ({ isOnline, timedOut = false, noOfflineData = false }) => (
  <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-zinc-950 px-6 text-white">
    <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(220,38,38,0.16),transparent_46%)]" />
    <div className="relative flex max-w-md flex-col items-center text-center">
      <img src="/logoModoQAP.png" alt="ModoQAP" className="mb-6 h-24 w-24 rounded-full object-cover shadow-2xl shadow-red-950/50" />
      <p className="text-[10px] font-black uppercase tracking-[0.42em] text-red-500">ModoQAP</p>
      <h1 className="mt-3 text-2xl font-black uppercase tracking-tight">
        {noOfflineData ? 'Dados offline indisponíveis' : 'Preparando seu sistema'}
      </h1>
      <p className="mt-3 text-sm font-medium leading-relaxed text-zinc-400">
        {noOfflineData
          ? 'Conecte-se à internet uma vez para baixar seus dados neste dispositivo.'
          : timedOut
            ? 'A conexão está demorando. Estamos usando os dados seguros disponíveis neste dispositivo.'
            : isOnline
              ? 'Sincronizando edital, planejamento e progresso antes de liberar a navegação.'
              : 'Carregando os dados salvos neste dispositivo.'}
      </p>
      {!noOfflineData && (
        <div className="mt-7 h-1.5 w-52 overflow-hidden rounded-full bg-white/10">
          <div className="h-full w-2/5 animate-pulse rounded-full bg-red-600" />
        </div>
      )}
      {noOfflineData && (
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="mt-7 rounded-xl bg-red-600 px-5 py-3 text-xs font-black uppercase tracking-wider hover:bg-red-700"
        >
          Tentar novamente
        </button>
      )}
    </div>
  </div>
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
  const isOnline = useOnlineStatus();
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
    markOperationalRead,
    respondGroupRequest,
    markAllRead,
    dismissEditalUpdate,
    applyEditalUpdate,
    loading: loadingNotif,
    deleteBroadcast,
    deleteHistoryItem
  } = useNotifications(user);
  const userAccess = useUserAccess(user);
  const { levelData, profile: gamificationProfile } = useLevelSystem(user);

  const [activeTab, setActiveTabState]          = useState(initialRouteTab);
  const [loading, setLoading]                   = useState(true);
  const [isSidebarExpanded, setIsSidebarExpanded] = useState(false);
  const [isLargeSidebarViewport, setIsLargeSidebarViewport] = useState(false);
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
  const [pendingPlanningEdital, setPendingPlanningEdital] = useState(null);
  const [reopenEditalLibrary, setReopenEditalLibrary] = useState(false);
  const [welcomeCarousel, setWelcomeCarousel]   = useState({ loading:true, mode:null });
  const [profileCover, setProfileCover] = useState({
    url: null,
    position: DEFAULT_COVER_POSITION,
    loading: true,
  });
  const [hydrationState, setHydrationState] = useState(createHydrationState);
  const [hydrationTimedOut, setHydrationTimedOut] = useState(false);

  const [activeStudySession, setActiveStudySession]   = useState(null);
  const [finishModalData, setFinishModalData]         = useState(null);
  const [pendingReviewData, setPendingReviewData]     = useState(null);
  const [showGlobalRegistroModal, setShowGlobalRegistroModal] = useState(false);
  const [isLocalRegistroModalOpen, setIsLocalRegistroModalOpen] = useState(false);
  const [dailyGoalModalData, setDailyGoalModalData] = useState(null);
  const [pendingDailyGoalModalData, setPendingDailyGoalModalData] = useState(null);
  const dailyGoalShownRef = useRef(new Set());

  const [activeSimuladoSession, setActiveSimuladoSession] = useState(null);
  const [finishedSimuladoData, setFinishedSimuladoData]   = useState(null);
  const [pendingSimuladoReview, setPendingSimuladoReview] = useState(null);

  const setActiveTab = useCallback((nextTab) => {
    const resolvedTab = typeof nextTab === 'function' ? nextTab(activeTab) : nextTab;
    const pathTab = TAB_TO_PATH[resolvedTab] || 'home';
    const targetPath = `/app/${pathTab}`;
    setActiveTabState(resolvedTab);
    setIsSidebarExpanded(false);
    setIsMobileOpen(false);
    if (location.pathname !== targetPath) navigate(targetPath);
  }, [activeTab, location.pathname, navigate]);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return undefined;
    const media = window.matchMedia('(min-width: 1024px)');
    const update = () => setIsLargeSidebarViewport(media.matches);
    update();
    if (typeof media.addEventListener === 'function') {
      media.addEventListener('change', update);
      return () => media.removeEventListener('change', update);
    }
    media.addListener(update);
    return () => media.removeListener(update);
  }, []);

  useEffect(() => {
    const resolvedTab = PATH_TO_TAB[String(routeTab || 'home').toLowerCase()];
    if (!resolvedTab) {
      if (location.pathname.startsWith('/app/')) navigate('/app/home', { replace: true });
      return;
    }
    if (!LEAGUES_ENABLED && String(routeTab || '').toLowerCase() === 'ligas') {
      navigate('/app/ranking', { replace: true });
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
  const [editalInitialSource, setEditalInitialSource] = useState(null);
  const [targetCronogramaEditMode, setTargetCronogramaEditMode] = useState(null);
  const [allRegistrosEstudo, setAllRegistrosEstudo] = useState([]);
  const [allSimulados, setAllSimulados]           = useState([]);
  const [registrosLoaded, setRegistrosLoaded]     = useState(false);
  const [simuladosLoaded, setSimuladosLoaded]     = useState(false);
  const [goalsLoaded, setGoalsLoaded]             = useState(false);
  const [activeCycleDisciplinesLoaded, setActiveCycleDisciplinesLoaded] = useState(false);
  const [activeCycleDisciplines, setActiveCycleDisciplines] = useState([]);

  useGamificationSync({
    user,
    records: allRegistrosEstudo,
    simulados: allSimulados,
    activeCiclo: activeCicloData,
    activeCronograma: activeCronogramaData,
    profile: gamificationProfile,
    enabled: registrosLoaded && simuladosLoaded,
  });

  const mainContentRef = useRef(null);

  const handleOpenFeedback = (options = {}) => {
    setFeedbackInitialState({
      initialView: options.initialView || 'home',
      initialType: options.initialType || 'ideia',
    });
    setIsFeedbackOpen(true);
  };
  const statsSyncKeyRef = useRef('');

  const markHydrationSnapshot = useCallback((resource, snapshot) => {
    if (!HYDRATION_RESOURCE_KEYS.includes(resource)) return;
    setHydrationState((current) => ({
      ...current,
      [resource]: {
        received: true,
        // Depois que o servidor confirmou este recurso, uma mudanca de
        // metadados causada por perda de conexao nao deve reabrir o boot.
        authoritative: current[resource].authoritative || snapshot?.metadata?.fromCache === false,
        failed: false,
        hasPendingWrites: Boolean(snapshot?.metadata?.hasPendingWrites),
      },
    }));
  }, []);

  const markHydrationError = useCallback((resource) => {
    if (!HYDRATION_RESOURCE_KEYS.includes(resource)) return;
    setHydrationState((current) => ({
      ...current,
      [resource]: {
        ...current[resource],
        received: true,
        failed: true,
        hasPendingWrites: false,
      },
    }));
  }, []);

  const resetHydrationResource = useCallback((resource) => {
    if (!HYDRATION_RESOURCE_KEYS.includes(resource)) return;
    setHydrationState((current) => ({
      ...current,
      [resource]: createHydrationState()[resource],
    }));
  }, []);

  useEffect(() => {
    setHydrationState(createHydrationState());
    setHydrationTimedOut(false);
  }, [user?.uid]);

  useEffect(() => {
    if (!user?.uid) {
      setProfileCover({ url: null, position: DEFAULT_COVER_POSITION, loading: false });
      return undefined;
    }

    setProfileCover({ url: null, position: DEFAULT_COVER_POSITION, loading: true });
    return onSnapshot(doc(db, 'users', user.uid), (snapshot) => {
      const profileData = snapshot.data();
      setProfileCover({
        url: profileData?.coverURL || null,
        position: normalizeCoverPosition(profileData?.coverPosition),
        loading: false,
      });
    }, (error) => {
      console.error('[Dashboard] Erro ao carregar capa do perfil:', error);
      setProfileCover({ url: null, position: DEFAULT_COVER_POSITION, loading: false });
    });
  }, [user?.uid]);

  useEffect(() => {
    if (!user?.uid) return undefined;
    setHydrationTimedOut(false);
    const timeoutId = window.setTimeout(() => setHydrationTimedOut(true), 10000);
    return () => window.clearTimeout(timeoutId);
  }, [user?.uid, isOnline]);

  const todayStr = dateToYMD(new Date());
  const hasActiveStudyContext = !!(activeCicloId || activeCronogramaData?.id);
  const cicloPendenteFinalizacao = useMemo(
    () => isCicloPendingFinalization(activeCicloData),
    [activeCicloData]
  );
  const cicloFinalizacaoMessage = 'Seu ciclo chegou a 100%. Finalize a rodada antes de registrar novos estudos.';
  const cicloFinalizacaoAlert = useMemo(() => {
    if (!activeCicloData?.ativo) return null;
    const cycle = { ...activeCicloData, id: activeCicloId || activeCicloData.id };
    const status = getCicloWeeklyStatus({ ciclo: cycle, isRoundComplete: cicloPendenteFinalizacao });
    return buildCicloWeeklyAlert(cycle, status);
  }, [activeCicloData, activeCicloId, cicloPendenteFinalizacao]);
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
    resetHydrationResource('simulados');
    return onSnapshot(q, { includeMetadataChanges: true }, (snap) => {
      setAllSimulados(snap.docs.map(d => ({ id:d.id, ...d.data() })));
      setSimuladosLoaded(true);
      markHydrationSnapshot('simulados', snap);
    }, (error) => {
      console.error('[Dashboard] Erro ao sincronizar simulados:', error);
      setSimuladosLoaded(true);
      markHydrationError('simulados');
    });
  }, [user, markHydrationError, markHydrationSnapshot, resetHydrationResource]);

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

  const buildRecordsForDailyGoal = (nextPayload = null, dateKey = todayStr) => {
    const base = Array.isArray(mergedAllRegistrosEstudo) ? mergedAllRegistrosEstudo : [];
    const records = nextPayload
      ? [normalizeRegistroPayload('__pending_daily_goal__', nextPayload), ...base]
      : base;
    return records.filter((registro) => getRegistroDateKey(registro) === dateKey);
  };

  const getDailyGoalStatusForPlan = ({
    context,
    dateKey = todayStr,
    planOverride = null,
    nextPayload = null,
  }) => {
    if (!isRegistroContext(context)) return null;

    const activePlan = context === 'ciclo'
      ? (planOverride || activeCicloData)
      : (planOverride || activeCronogramaData);
    if (!activePlan?.id) return null;

    const dayRecords = buildRecordsForDailyGoal(nextPayload, dateKey).filter((registro) => {
      const registroContext = getRegistroContext(registro);
      if (registroContext !== context) return false;
      if (context === 'ciclo') return String(registro.cicloId || '') === String(activePlan.id || activeCicloId || '');
      return String(registro.cronogramaId || '') === String(activePlan.id || '');
    });

    return getDailyStudyStatus({
      date: dateKey,
      studyDaysMap: buildStudyDaysMap(dayRecords),
      activeCronogramaData: context === 'cronograma' ? activePlan : null,
      activeCicloData: context === 'ciclo' ? activePlan : null,
      getAgendaSemana,
      contextMode: context,
      registrosEstudo: dayRecords,
    });
  };

  const fetchFreshPlanForDailyGoal = async (context, planId) => {
    if (!user?.uid || !isRegistroContext(context) || !planId) return null;
    const collectionName = context === 'ciclo' ? 'ciclos' : 'cronogramas';
    const snap = await getDoc(doc(db, 'users', user.uid, collectionName, planId));
    return snap.exists() ? { id: snap.id, ...snap.data() } : null;
  };

  const maybeShowDailyGoalCompleted = async ({
    payload,
    wasGoalMet = false,
    forceAfterCompletionAction = false,
  }) => {
    if (activeTab === 'home' || !payload) return;
    const context = getRegistroContext(payload);
    if (!isRegistroContext(context)) return;

    const dateKey = payload.data || todayStr;
    if (dateKey !== todayStr) return;

    const planId = context === 'ciclo' ? payload.cicloId : payload.cronogramaId;
    if (!planId) return;

    const freshPlan = await fetchFreshPlanForDailyGoal(context, planId);
    const afterStatus = getDailyGoalStatusForPlan({
      context,
      dateKey,
      planOverride: freshPlan,
      nextPayload: payload,
    });
    if (!afterStatus?.goalMet) return;
    if (wasGoalMet && !forceAfterCompletionAction) return;

    const modalKey = `${context}:${planId}:${dateKey}`;
    if (dailyGoalShownRef.current.has(modalKey)) return;
    dailyGoalShownRef.current.add(modalKey);

    const recordsForStats = buildRecordsForDailyGoal(payload, dateKey).filter((registro) => {
      const registroContext = getRegistroContext(registro);
      if (registroContext !== context) return false;
      return context === 'ciclo'
        ? String(registro.cicloId || '') === String(planId)
        : String(registro.cronogramaId || '') === String(planId);
    });

    const minutes = recordsForStats.reduce((acc, registro) => acc + Number(registro.tempoEstudadoMinutos || registro.duracaoMinutos || 0), 0);
    const questions = recordsForStats.reduce((acc, registro) => acc + Number(registro.questoesFeitas || 0), 0);
    const correct = recordsForStats.reduce((acc, registro) => acc + Number(registro.acertos || registro.questoesAcertadas || 0), 0);
    const planInfo = getGoalModalPlanInfo({ context, plan: freshPlan || (context === 'ciclo' ? activeCicloData : activeCronogramaData) });

    const modalData = {
      contextLabel: context === 'ciclo' ? 'Ciclo do dia' : 'Cronograma do dia',
      ...planInfo,
      minutes,
      plannedMinutes: Number(afterStatus.totalSlots || 0) > 0 ? minutes : 0,
      questions,
      correct,
    };

    if (showGlobalRegistroModal || finishModalData || isLocalRegistroModalOpen) {
      setPendingDailyGoalModalData(modalData);
    } else {
      setDailyGoalModalData(modalData);
    }
  };

  useEffect(() => {
    if (!pendingDailyGoalModalData || showGlobalRegistroModal || finishModalData || isLocalRegistroModalOpen) return;
    setDailyGoalModalData(pendingDailyGoalModalData);
    setPendingDailyGoalModalData(null);
  }, [finishModalData, isLocalRegistroModalOpen, pendingDailyGoalModalData, showGlobalRegistroModal]);

  const legacyReadyFlags = registrosLoaded
    && simuladosLoaded
    && activeCicloLoaded
    && activeCronogramaLoaded
    && goalsLoaded
    && activeCycleDisciplinesLoaded;
  const hydrationStatus = useMemo(() => getCoreHydrationStatus({
    hydrationState,
    isOnline,
    timedOut: hydrationTimedOut,
    legacyReadyFlags,
  }), [hydrationState, hydrationTimedOut, isOnline, legacyReadyFlags]);
  const coreDataReady = hydrationStatus.ready;
  const planningAssessmentReady = isPlanningAssessmentReady(hydrationState);
  const hasPendingWrites = hydrationStatus.hasPendingWrites;

  useEffect(() => {
    window.dispatchEvent(new CustomEvent('modoqap-firestore-sync-state', {
      detail: { hasPendingWrites },
    }));
    return () => {
      window.dispatchEvent(new CustomEvent('modoqap-firestore-sync-state', {
        detail: { hasPendingWrites: false },
      }));
    };
  }, [hasPendingWrites]);

  const isNovoUsuarioPlanejamento = useMemo(() => {
    if (!planningAssessmentReady) return false;
    const semCicloAtivo = !activeCicloId;
    const semCronogramaAtivo = !activeCronogramaData?.id;
    const semRegistros = mergedAllRegistrosEstudo.length === 0;
    return semCicloAtivo && semCronogramaAtivo && semRegistros;
  }, [activeCicloId, activeCronogramaData?.id, mergedAllRegistrosEstudo.length, planningAssessmentReady]);

  const noOfflineData = !isOnline
    && coreDataReady
    && !activeCicloId
    && !activeCronogramaData?.id
    && mergedAllRegistrosEstudo.length === 0
    && allSimulados.length === 0
    && goalsHistory.length === 0
    && !planningAssessmentReady;

  useEffect(() => {
    if (coreDataReady && !userAccess.isLoading) dismissInitialLoadingScreen();
  }, [coreDataReady, userAccess.isLoading]);

  useEffect(() => {
    if (!user?.uid) {
      setWelcomeCarousel({ loading:false, mode:null });
      return;
    }

    const ready = coreDataReady && planningAssessmentReady;
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
    coreDataReady,
    planningAssessmentReady,
    isNovoUsuarioPlanejamento,
  ]);

  useEffect(() => {
    if (welcomeCarousel.mode === 'welcome' && isDarkMode) {
      toggleTheme();
    }
  }, [welcomeCarousel.mode, isDarkMode, toggleTheme]);

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
    resetHydrationResource('registros');
    const q = query(collection(db,'users',user.uid,'registrosEstudo'), orderBy('data','desc'), orderBy('timestamp','desc'));
    return onSnapshot(q, { includeMetadataChanges: true }, (snap) => {
      setAllRegistrosEstudo(snap.docs.map(normalizeRegistroEstudo));
      setRegistrosLoaded(true);
      setLoading(false);
      markHydrationSnapshot('registros', snap);
    }, (error) => {
      console.error('[Dashboard] Erro ao sincronizar registrosEstudo:', error);
      setRegistrosLoaded(true);
      setLoading(false);
      markHydrationError('registros');
    });
  }, [user, markHydrationError, markHydrationSnapshot, resetHydrationResource]);

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
    const persistedSyncKey = `modoqap_stats_sync_${user.uid}`;
    try {
      if (localStorage.getItem(persistedSyncKey) === syncKey) {
        statsSyncKeyRef.current = syncKey;
        return;
      }
    } catch {}
    statsSyncKeyRef.current = syncKey;

    const persistStats = () => {
      setDoc(doc(db,'users',user.uid,'stats','geral'), {
        ...totals,
        lastUpdated: Timestamp.now(),
      }, { merge: true }).then(() => {
        try { localStorage.setItem(persistedSyncKey, syncKey); } catch {}
      }).catch((error) => {
        console.error('[Dashboard] Erro ao sincronizar stats/geral:', error);
        statsSyncKeyRef.current = '';
      });
    };

    if ('requestIdleCallback' in window) {
      const idleId = window.requestIdleCallback(persistStats, { timeout: 2500 });
      return () => {
        window.cancelIdleCallback(idleId);
        if (statsSyncKeyRef.current === syncKey) statsSyncKeyRef.current = '';
      };
    }
    const timeoutId = window.setTimeout(persistStats, 0);
    return () => {
      window.clearTimeout(timeoutId);
      if (statsSyncKeyRef.current === syncKey) statsSyncKeyRef.current = '';
    };
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

    const candidatosPorDisciplina = ordemSessoes
      .map((sessao, globalIndex) => ({ ...sessao, globalIndex }))
      .filter((sessao) => {
        if (concluidas.includes(Number(sessao.globalIndex))) return false;
        if (Number.isFinite(Number(payload.sessaoGlobalIndex)) && Number(payload.sessaoGlobalIndex) !== Number(sessao.globalIndex)) return false;
        if (disciplinaIdRegistro && String(sessao.disciplinaId || '') !== disciplinaIdRegistro) return false;
        return true;
      });
    const candidatosPorAssunto = assuntoRegistroNorm
      ? candidatosPorDisciplina.filter((sessao) => {
        const assuntoSessao = getAssuntoCicloPorSessao(cicloData, activeCycleDisciplines, sessao);
        return !assuntoSessao || normalizeRegistroText(assuntoSessao) === assuntoRegistroNorm;
      })
      : [];
    const candidatos = (candidatosPorAssunto.length ? candidatosPorAssunto : candidatosPorDisciplina)
      .slice()
      .sort((a, b) => Number(a.globalIndex) - Number(b.globalIndex));

    if (!candidatos.length) return;

    let minutosRestantes = minutosRegistrados;
    const updates = {};
    const novasConcluidas = [...concluidas];
    let lastTouchedIndex = null;

    for (const sessao of candidatos) {
      if (minutosRestantes <= 0) break;
      const index = Number(sessao.globalIndex);
      const progressoAtual = Number(progressoSessoes?.[index] || progressoSessoes?.[String(index)] || 0);
      const faltantes = Math.max(0, tempoSessaoMinutos - progressoAtual);
      if (faltantes <= 0) {
        if (minutosRestantes > 0) {
          const novoProgresso = progressoAtual + minutosRestantes;
          updates[`progressoSessoes.${index}`] = novoProgresso;
          lastTouchedIndex = index;
          minutosRestantes = 0;
        }
        if (progressoAtual >= tempoSessaoMinutos && !novasConcluidas.includes(index)) {
          novasConcluidas.push(index);
          updates.sessoesConcluidas = novasConcluidas;
          updates[`sessoesConcluidasDetalhes.${index}`] = {
            concluidaEm: payload.data,
            atualizadoEm: Timestamp.now(),
            origem: 'registro_manual',
          };
        }
        continue;
      }

      const incremento = Math.min(faltantes, minutosRestantes);
      const novoProgresso = progressoAtual + incremento;
      const concluiu = novoProgresso >= tempoSessaoMinutos;

      updates[`progressoSessoes.${index}`] = novoProgresso;
      lastTouchedIndex = index;
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

    if (minutosRestantes > 0 && lastTouchedIndex !== null) {
      updates[`progressoSessoes.${lastTouchedIndex}`] =
        Number(updates[`progressoSessoes.${lastTouchedIndex}`] || progressoSessoes?.[lastTouchedIndex] || progressoSessoes?.[String(lastTouchedIndex)] || 0)
        + minutosRestantes;
      minutosRestantes = 0;
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
      const tempoPlanejado = getReviewPlannedMinutes(rev, 20);
      const progressoAtual = Number(rev.progressoMinutos || 0);
      const {
        appliedMinutes,
        nextProgress: novoProgresso,
        done: concluiu,
      } = applyReviewProgress({
        currentMinutes: progressoAtual,
        plannedMinutes: tempoPlanejado,
        addedMinutes: minutosRestantes,
        wasDone: rev.concluida,
      });
      if (appliedMinutes <= 0) continue;

      await setDoc(revisaoRef, {
        progressoMinutos: novoProgresso,
        tempoMinutos: tempoPlanejado,
        ...(concluiu ? { concluida: true, concluidaEm: Timestamp.now(), bloqueiaDesmarcar: true, origemConclusao: 'registro_manual' } : {}),
        atualizadaEm: Timestamp.now(),
      }, { merge: true });

      minutosRestantes -= appliedMinutes;
    }
  };

  const applyRegistroProgressOptimistic = useCallback((payload) => {
    if (!payload) return;
    emitRegistroProgressOptimisticUpdate(payload);
    if (payload.contextoRegistro === 'cronograma' && payload.cronogramaId) {
      setActiveCronogramaData((prev) => (
        prev?.id === payload.cronogramaId
          ? applyCronogramaRegistroProgress(prev, payload)
          : prev
      ));
    }
  }, []);

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

      if (
        contextoRegistro === 'ciclo'
        && String(cicloIdResolved || '') === String(activeCicloId || '')
        && cicloPendenteFinalizacao
        && data?.origemConclusao !== 'botao_concluir'
      ) {
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
      const dailyGoalBeforeStatus = getDailyGoalStatusForPlan({
        context: payload.contextoRegistro,
        dateKey: payload.data,
      });
      let dailyGoalModalChecked = false;
      const checkDailyGoalAfterPlanSync = async () => {
        if (dailyGoalModalChecked) return;
        dailyGoalModalChecked = true;
        await maybeShowDailyGoalCompleted({
          payload,
          wasGoalMet: Boolean(dailyGoalBeforeStatus?.goalMet),
          forceAfterCompletionAction: payload.origemConclusao === 'botao_concluir',
        });
      };

      const completionDocId = getCompletionDocId(payload.origemConclusaoId);
      let registroJaExistia = false;
      let savedRegistroId = null;
      if (completionDocId) {
        const registroRef = doc(db,'users',user.uid,'registrosEstudo',completionDocId);
        const existingRegistro = await getDoc(registroRef);
        registroJaExistia = existingRegistro.exists();
        await setDoc(registroRef, payload);
        savedRegistroId = completionDocId;
        setAllRegistrosEstudo((prev) => {
          const normalized = normalizeRegistroPayload(completionDocId, payload);
          const withoutCurrent = prev.filter((item) => item.id !== completionDocId);
          return sortRegistrosEstudo([normalized, ...withoutCurrent]);
        });
      } else {
        const registroRef = await addDoc(collection(db,'users',user.uid,'registrosEstudo'), payload);
        savedRegistroId = registroRef.id;
        setAllRegistrosEstudo((prev) => sortRegistrosEstudo([
          normalizeRegistroPayload(registroRef.id, payload),
          ...prev.filter((item) => item.id !== registroRef.id),
        ]));
      }

      if (!registroJaExistia && savedRegistroId) {
        requestGamificationRefresh({
          uid: user.uid,
          sourceType: 'study',
          sourceId: savedRegistroId,
        });
      }

      if (registroJaExistia) {
        await maybeShowDailyGoalCompleted({
          payload,
          wasGoalMet: Boolean(dailyGoalBeforeStatus?.goalMet),
          forceAfterCompletionAction: payload.origemConclusao === 'botao_concluir',
        });
        return;
      }

      const isRegistroRevisao = payload.isRevisao || payload.revisao || payload.tipoEstudo === 'revisao';
      const isCompletionRegistro = payload.origemConclusao === 'botao_concluir' || Boolean(completionDocId);
      if (!isCompletionRegistro) {
        applyRegistroProgressOptimistic(payload);
      }

      const postSaveTasks = [];
      postSaveTasks.push((async () => {
        if (!isCompletionRegistro && payload.contextoRegistro === 'ciclo' && payload.cicloId) {
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

        if (!isCompletionRegistro && payload.contextoRegistro === 'cronograma' && payload.cronogramaId) {
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

        if (!isCompletionRegistro && payload.contextoRegistro === 'ciclo' && payload.cicloId && isRegistroRevisao) {
          await syncRegistroRevisaoWithCiclo(payload);
        }

        await checkDailyGoalAfterPlanSync();
      })());
      const intervaloRevisaoDias = Number(payload.intervaloRevisaoDias);
      const intervalosRevisaoCiclo = payload.revisaoAutomaticaCiclo === true
        ? [1, 7, 30]
        : [intervaloRevisaoDias].filter((intervalo) => Number.isFinite(intervalo) && intervalo > 0);
      const deveAgendarRevisaoCiclo = Boolean(
        !isCompletionRegistro &&
        payload.cicloId &&
        payload.assunto &&
        intervalosRevisaoCiclo.length > 0
      );

      if (deveAgendarRevisaoCiclo) {
        postSaveTasks.push((async () => {
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
        })());
      }

      postSaveTasks.push(setDoc(doc(db,'users',user.uid,'stats','geral'), {
        totalHorasMinutos: increment(payload.tempoEstudadoMinutos),
        totalQuestoes: increment(payload.questoesFeitas),
        totalAcertos: increment(payload.acertos),
      }, { merge: true }));

      Promise.allSettled(postSaveTasks).then((results) => {
        results.forEach((result) => {
          if (result.status === 'rejected') console.error('[Dashboard] Erro em pos-salvamento do registro:', result.reason);
        });
      });

    } catch (e) {
      console.error(e);
      throw e;
    }
  };

  const isRegistroRevisaoPayload = (registro) => (
    registro?.isRevisao || registro?.revisao || registro?.tipoEstudo === 'revisao' || registro?.tipoRegistro === 'revisao'
  );

  const parseCompletionSourceId = (registro) => {
    const ids = [
      registro?.origemConclusaoId,
      ...(Array.isArray(registro?.alternateOrigemConclusaoIds) ? registro.alternateOrigemConclusaoIds : []),
    ].filter(Boolean).map(String);
    for (const value of ids) {
      const parts = value.split(':');
      if (parts.length >= 4) return parts[2];
    }
    return null;
  };

  const rollbackCycleStudyProgress = async (registro) => {
    if (!registro?.cicloId || isRegistroRevisaoPayload(registro)) return;
    const cicloRef = doc(db, 'users', user.uid, 'ciclos', registro.cicloId);
    const cicloSnap = await getDoc(cicloRef);
    if (!cicloSnap.exists()) return;

    const cicloData = cicloSnap.data() || {};
    const ordemSessoes = Array.isArray(cicloData.ordemSessoes) ? cicloData.ordemSessoes : [];
    if (!ordemSessoes.length) return;

    const disciplinasFonte = Array.isArray(activeCycleDisciplines) && activeCycleDisciplines.length
      ? activeCycleDisciplines
      : (await getDocs(collection(db, 'users', user.uid, 'ciclos', registro.cicloId, 'disciplinas')))
        .docs.map((document) => ({ id: document.id, ...document.data() }));
    const tempoSessaoMinutos = Math.max(1, Number(cicloData.tempoSessaoMinutos || 50));
    const progressoSessoes = cicloData.progressoSessoes || {};
    const concluidas = Array.isArray(cicloData.sessoesConcluidas) ? cicloData.sessoesConcluidas.map(Number) : [];
    const disciplinaIdRegistro = String(registro.disciplinaId || '').trim();
    const assuntoRegistroNorm = normalizeRegistroText(registro.assunto);
    const completionSourceId = parseCompletionSourceId(registro);
    const explicitIndex = Number.isFinite(Number(registro.sessaoGlobalIndex))
      ? Number(registro.sessaoGlobalIndex)
      : Number.isFinite(Number(completionSourceId))
        ? Number(completionSourceId)
        : null;

    const candidates = ordemSessoes
      .map((sessao, globalIndex) => ({ ...sessao, globalIndex }))
      .filter((sessao) => {
        if (explicitIndex !== null) return Number(sessao.globalIndex) === explicitIndex;
        if (completionSourceId && String(sessao.id || sessao.slotId || '') === String(completionSourceId)) return true;
        if (disciplinaIdRegistro && String(sessao.disciplinaId || '') !== disciplinaIdRegistro) return false;
        if (!assuntoRegistroNorm) return true;
        const assuntoSessao = getAssuntoCicloPorSessao(cicloData, disciplinasFonte, sessao);
        return !assuntoSessao || normalizeRegistroText(assuntoSessao) === assuntoRegistroNorm;
      })
      .sort((a, b) => Number(b.globalIndex) - Number(a.globalIndex));

    const target = candidates.find((sessao) => {
      const current = Number(progressoSessoes?.[sessao.globalIndex] || progressoSessoes?.[String(sessao.globalIndex)] || 0);
      return current > 0 || concluidas.includes(Number(sessao.globalIndex));
    }) || candidates[0];
    if (!target) return;

    const index = Number(target.globalIndex);
    const currentProgress = Math.max(
      Number(progressoSessoes?.[index] || progressoSessoes?.[String(index)] || 0),
      concluidas.includes(index) ? tempoSessaoMinutos : 0
    );
    const removedMinutes = Math.max(0, Number(registro.tempoEstudadoMinutos || registro.duracaoMinutos || tempoSessaoMinutos));
    const nextProgress = Math.max(0, currentProgress - removedMinutes);
    const nextConcluidas = nextProgress >= tempoSessaoMinutos
      ? [...new Set([...concluidas, index])]
      : concluidas.filter((item) => Number(item) !== index);

    await updateDoc(cicloRef, {
      [`progressoSessoes.${index}`]: nextProgress,
      sessoesConcluidas: nextConcluidas,
      [`sessoesConcluidasDetalhes.${index}`]: nextProgress >= tempoSessaoMinutos
        ? (cicloData.sessoesConcluidasDetalhes?.[index] || cicloData.sessoesConcluidasDetalhes?.[String(index)] || { concluidaEm: registro.data, atualizadoEm: Timestamp.now(), origem: 'registro_manual' })
        : deleteField(),
      updatedAt: Timestamp.now(),
    });
  };

  const rollbackCycleReviewProgress = async (registro) => {
    if (!registro?.cicloId || !isRegistroRevisaoPayload(registro)) return;
    const minutos = Math.max(0, Number(registro.tempoEstudadoMinutos || registro.duracaoMinutos || 0));
    if (minutos <= 0) return;

    const revisoesRef = collection(db, 'users', user.uid, 'revisoesCiclo');
    const snap = await getDocs(query(revisoesRef, where('cicloId', '==', registro.cicloId)));
    const disciplinaIdRegistro = String(registro.disciplinaId || '').trim();
    const assuntoRegistroNorm = normalizeRegistroText(registro.assunto);
    const dataRegistro = String(registro.data || '');

    const target = snap.docs
      .map((document) => ({ id: document.id, ...document.data() }))
      .filter((rev) => {
        if (disciplinaIdRegistro && String(rev.disciplinaId || '') !== disciplinaIdRegistro) return false;
        if (assuntoRegistroNorm && normalizeRegistroText(rev.assunto) !== assuntoRegistroNorm) return false;
        if (dataRegistro && rev.dataAgendada && String(rev.dataAgendada) > dataRegistro) return false;
        return rev.concluida || Number(rev.progressoMinutos || 0) > 0;
      })
      .sort((a, b) => String(b.dataAgendada || '').localeCompare(String(a.dataAgendada || '')))[0];
    if (!target) return;

    const planned = getReviewPlannedMinutes(target, 20);
    const currentProgress = Math.max(Number(target.progressoMinutos || 0), target.concluida ? planned : 0);
    const nextProgress = Math.max(0, currentProgress - minutos);
    const nextDone = nextProgress >= planned;

    await updateDoc(doc(revisoesRef, target.id), {
      progressoMinutos: nextProgress,
      concluida: nextDone,
      concluidaEm: nextDone ? (target.concluidaEm || Timestamp.now()) : null,
      bloqueiaDesmarcar: nextDone ? target.bloqueiaDesmarcar : false,
      origemConclusao: nextDone ? target.origemConclusao : null,
      atualizadaEm: Timestamp.now(),
    });
  };

  const rollbackCronogramaProgress = async (registro) => {
    if (!registro?.cronogramaId) return;
    const cronogramaRef = doc(db, 'users', user.uid, 'cronogramas', registro.cronogramaId);
    const cronogramaSnap = await getDoc(cronogramaRef);
    if (!cronogramaSnap.exists()) return;

    const cronograma = { id: cronogramaSnap.id, ...cronogramaSnap.data() };
    if (!cronograma.dataInicio) return;
    const weekOffset = getWeekOffsetFromDate(cronograma.dataInicio, registro.data || new Date());
    if (!Number.isFinite(Number(weekOffset))) return;

    const semKey = `w${weekOffset}`;
    const agenda = getAgendaSemana(cronograma, weekOffset) || [];
    const isReview = isRegistroRevisaoPayload(registro);
    const disciplinaIdRegistro = String(registro.disciplinaId || '').trim();
    const disciplinaNomeRegistroNorm = normalizeRegistroText(registro.disciplinaNome);
    const assuntoRegistroNorm = normalizeRegistroText(registro.assunto);
    const dataRegistro = String(registro.data || '');
    const candidates = agenda
      .filter((slot) => Boolean(slot?.isRevisaoAuto) === isReview)
      .filter((slot) => !dataRegistro || slot.dataSlot === dataRegistro)
      .filter((slot) => {
        const sameId = disciplinaIdRegistro && String(slot.disciplinaId || '') === disciplinaIdRegistro;
        const sameNome = disciplinaNomeRegistroNorm && normalizeRegistroText(slot.disciplinaNome || slot.disciplina) === disciplinaNomeRegistroNorm;
        if (!sameId && !sameNome) return false;
        return !assuntoRegistroNorm || normalizeRegistroText(slot.assunto) === assuntoRegistroNorm;
      })
      .sort((a, b) => String(b.slotId || '').localeCompare(String(a.slotId || '')));
    const target = candidates[0];
    if (!target) return;

    const removedMinutes = Math.max(0, Number(registro.tempoEstudadoMinutos || registro.duracaoMinutos || 0));
    const updates = {};
    if (isReview) {
      const slotKey = target.slotId;
      const planned = getReviewPlannedMinutes(target, 20);
      const current = Math.max(
        Number(cronograma.progressoRevisoesMinutos?.[slotKey] || target.progressoMinutos || 0),
        cronograma.historicoRevisoes?.[slotKey]?.dataConclusao ? planned : 0
      );
      const next = Math.max(0, current - removedMinutes);
      updates[`progressoRevisoesMinutos.${slotKey}`] = next;
      updates[`progresso.${semKey}.${slotKey}`] = next >= planned;
      if (next < planned) {
        updates[`historicoRevisoes.${slotKey}`] = deleteField();
      }
    } else {
      const slotKey = target.slotIdBase || target.slotId;
      const planned = Math.max(1, Number(target.tempoMinutos ?? target.minutosEstudo ?? 0) || 0);
      const current = Math.max(
        Number(cronograma.progressoMinutos?.[semKey]?.[slotKey] || 0),
        Number(target.slotId ? cronograma.progressoMinutos?.[semKey]?.[target.slotId] || 0 : 0),
        cronograma.progresso?.[semKey]?.[slotKey] ? planned : 0
      );
      const fallbackRemoved = registro.origemConclusao === 'botao_concluir' ? planned : 0;
      const next = Math.max(0, current - (removedMinutes || fallbackRemoved));
      updates[`progressoMinutos.${semKey}.${slotKey}`] = next;
      updates[`progresso.${semKey}.${slotKey}`] = next >= planned;
      if (target.slotId && target.slotId !== slotKey) {
        updates[`progressoMinutos.${semKey}.${target.slotId}`] = next;
        updates[`progresso.${semKey}.${target.slotId}`] = next >= planned;
      }
    }

    if (Object.keys(updates).length) await updateDoc(cronogramaRef, updates);
  };

  const fetchAllRegistrosEstudoSnapshot = async () => {
    const snap = await getDocs(collection(db, 'users', user.uid, 'registrosEstudo'));
    return sortRegistrosEstudo(snap.docs.map(normalizeRegistroEstudo));
  };

  const syncStatsFromRegistrosSnapshot = async (registrosSnapshot) => {
    const totalRegistros = (registrosSnapshot || []).reduce((acc, item) => ({
      minutos: acc.minutos + Number(item.tempoEstudadoMinutos || 0),
      questoes: acc.questoes + Number(item.questoesFeitas || 0),
      acertos: acc.acertos + Number(item.acertos || 0),
    }), { minutos: 0, questoes: 0, acertos: 0 });

    const simSnap = await getDocs(collection(db, 'users', user.uid, 'simulados'));
    const totalSimulados = simSnap.docs.reduce((acc, document) => {
      const item = document.data() || {};
      return {
        minutos: acc.minutos + Number(item.durationMinutes || 0),
        questoes: acc.questoes + Number(item.resumo?.totalQuestoes || 0),
        acertos: acc.acertos + Number(item.resumo?.totalAcertos || 0),
      };
    }, { minutos: 0, questoes: 0, acertos: 0 });

    const totals = {
      totalHorasMinutos: totalRegistros.minutos + totalSimulados.minutos,
      totalQuestoes: totalRegistros.questoes + totalSimulados.questoes,
      totalAcertos: totalRegistros.acertos + totalSimulados.acertos,
    };
    statsSyncKeyRef.current = `${totals.totalHorasMinutos}|${totals.totalQuestoes}|${totals.totalAcertos}`;
    await setDoc(doc(db, 'users', user.uid, 'stats', 'geral'), {
      ...totals,
      lastUpdated: Timestamp.now(),
    }, { merge: true });
  };

  const recalculateCycleStudyProgressFromRegistros = async (cicloId, registrosSnapshot) => {
    if (!cicloId) return;
    const cicloRef = doc(db, 'users', user.uid, 'ciclos', cicloId);
    const cicloSnap = await getDoc(cicloRef);
    if (!cicloSnap.exists()) return;

    const cicloData = cicloSnap.data() || {};
    const ordemSessoes = Array.isArray(cicloData.ordemSessoes) ? cicloData.ordemSessoes : [];
    if (!ordemSessoes.length) return;

    const disciplinasFonte = Array.isArray(activeCycleDisciplines) && activeCycleDisciplines.length && String(activeCicloId || '') === String(cicloId)
      ? activeCycleDisciplines
      : (await getDocs(collection(db, 'users', user.uid, 'ciclos', cicloId, 'disciplinas')))
        .docs.map((document, __sourceOrder) => ({ id: document.id, __sourceOrder, ...document.data() }));
    const tempoSessaoMinutos = Math.max(1, Number(cicloData.tempoSessaoMinutos || 50));
    const sessoes = ordemSessoes.map((sessao, globalIndex) => ({ ...sessao, globalIndex }));
    const progressoSessoes = {};
    const sessoesConcluidas = [];
    const sessoesConcluidasDetalhes = {};

    const markProgress = (index, minutes, registro, forceComplete = false) => {
      if (!Number.isFinite(Number(index))) return;
      const normalizedIndex = Number(index);
      const current = Number(progressoSessoes[normalizedIndex] || 0);
      const next = forceComplete ? Math.max(current + Number(minutes || 0), tempoSessaoMinutos) : current + Number(minutes || 0);
      progressoSessoes[normalizedIndex] = Math.max(0, next);
      if (progressoSessoes[normalizedIndex] >= tempoSessaoMinutos && !sessoesConcluidas.includes(normalizedIndex)) {
        sessoesConcluidas.push(normalizedIndex);
        sessoesConcluidasDetalhes[normalizedIndex] = {
          concluidaEm: getRegistroDateKey(registro) || dateToYMD(new Date()),
          atualizadoEm: Timestamp.now(),
          origem: registro?.origemConclusao || registro?.origem || 'registro_manual',
        };
      }
    };

    const registrosCiclo = sortRegistrosChronologically((registrosSnapshot || []).filter((registro) => (
      String(registro?.cicloId || '') === String(cicloId)
      && getRegistroContext(registro) === 'ciclo'
      && !isRegistroRevisaoPayload(registro)
      && Number(registro.tempoEstudadoMinutos || registro.duracaoMinutos || 0) >= 0
    )));

    registrosCiclo.forEach((registro) => {
      const minutos = Math.max(0, Number(registro.tempoEstudadoMinutos || registro.duracaoMinutos || 0));
      const completionSourceId = parseCompletionSourceId(registro);
      const explicitIndex = Number.isFinite(Number(registro.sessaoGlobalIndex))
        ? Number(registro.sessaoGlobalIndex)
        : Number.isFinite(Number(completionSourceId))
          ? Number(completionSourceId)
          : null;

      if (explicitIndex !== null) {
        markProgress(explicitIndex, minutos, registro, registro.origemConclusao === 'botao_concluir' || minutos <= 0);
        return;
      }

      const disciplinaIdRegistro = String(registro.disciplinaId || '').trim();
      const assuntoRegistroNorm = normalizeRegistroText(registro.assunto);
      const candidatosBase = sessoes
        .filter((sessao) => {
          if (disciplinaIdRegistro && String(sessao.disciplinaId || '') !== disciplinaIdRegistro) return false;
          if (!assuntoRegistroNorm) return true;
          const assuntoSessao = getAssuntoCicloPorSessao(cicloData, disciplinasFonte, sessao);
          return !assuntoSessao || normalizeRegistroText(assuntoSessao) === assuntoRegistroNorm;
        })
        .sort((a, b) => Number(a.globalIndex) - Number(b.globalIndex));

      let minutosRestantes = minutos;
      let lastTouchedIndex = null;
      for (const sessao of candidatosBase) {
        if (minutosRestantes <= 0) break;
        const index = Number(sessao.globalIndex);
        const current = Number(progressoSessoes[index] || 0);
        const faltantes = Math.max(0, tempoSessaoMinutos - current);
        if (faltantes <= 0) continue;
        const applied = Math.min(faltantes, minutosRestantes);
        markProgress(index, applied, registro);
        lastTouchedIndex = index;
        minutosRestantes -= applied;
      }

      if (minutosRestantes > 0 && lastTouchedIndex !== null) {
        markProgress(lastTouchedIndex, minutosRestantes, registro);
      }
    });

    await updateDoc(cicloRef, {
      progressoSessoes,
      sessoesConcluidas: sessoesConcluidas.sort((a, b) => a - b),
      sessoesConcluidasDetalhes,
      updatedAt: Timestamp.now(),
    });
  };

  const recalculateCycleReviewProgressFromRegistros = async (cicloId, registrosSnapshot) => {
    if (!cicloId) return;
    const revisoesRef = collection(db, 'users', user.uid, 'revisoesCiclo');
    const snap = await getDocs(query(revisoesRef, where('cicloId', '==', cicloId)));
    const revisoes = snap.docs
      .map((document) => ({ id: document.id, ...document.data() }))
      .sort((a, b) => String(a.dataAgendada || '').localeCompare(String(b.dataAgendada || '')));
    if (!revisoes.length) return;

    const stateById = revisoes.reduce((acc, rev) => {
      acc[rev.id] = { progressoMinutos: 0, concluida: false, concluidaEm: null };
      return acc;
    }, {});
    const registrosRevisao = sortRegistrosChronologically((registrosSnapshot || []).filter((registro) => (
      String(registro?.cicloId || '') === String(cicloId)
      && getRegistroContext(registro) === 'ciclo'
      && isRegistroRevisaoPayload(registro)
      && Number(registro.tempoEstudadoMinutos || registro.duracaoMinutos || 0) > 0
    )));

    registrosRevisao.forEach((registro) => {
      let minutosRestantes = Math.max(0, Number(registro.tempoEstudadoMinutos || registro.duracaoMinutos || 0));
      const disciplinaIdRegistro = String(registro.disciplinaId || '').trim();
      const assuntoRegistroNorm = normalizeRegistroText(registro.assunto);
      const dataRegistro = String(getRegistroDateKey(registro) || '');
      const candidatas = revisoes.filter((rev) => {
        if (stateById[rev.id]?.concluida) return false;
        if (disciplinaIdRegistro && String(rev.disciplinaId || '') !== disciplinaIdRegistro) return false;
        if (assuntoRegistroNorm && normalizeRegistroText(rev.assunto) !== assuntoRegistroNorm) return false;
        if (dataRegistro && rev.dataAgendada && String(rev.dataAgendada) > dataRegistro) return false;
        return true;
      });

      for (const rev of candidatas) {
        if (minutosRestantes <= 0) break;
        const planned = getReviewPlannedMinutes(rev, 20);
        const current = Number(stateById[rev.id]?.progressoMinutos || 0);
        const {
          appliedMinutes,
          nextProgress,
          done,
        } = applyReviewProgress({
          currentMinutes: current,
          plannedMinutes: planned,
          addedMinutes: minutosRestantes,
          wasDone: stateById[rev.id]?.concluida,
        });
        if (appliedMinutes <= 0) continue;
        stateById[rev.id] = {
          progressoMinutos: nextProgress,
          concluida: done,
          concluidaEm: done ? (getRegistroDateKey(registro) || dateToYMD(new Date())) : null,
        };
        minutosRestantes -= appliedMinutes;
      }
    });

    await Promise.all(revisoes.map((rev) => {
      const nextState = stateById[rev.id] || { progressoMinutos: 0, concluida: false, concluidaEm: null };
      const done = Boolean(nextState.concluida);
      return updateDoc(doc(revisoesRef, rev.id), {
        progressoMinutos: Number(nextState.progressoMinutos || 0),
        tempoMinutos: getReviewPlannedMinutes(rev, 20),
        concluida: done,
        concluidaEm: done ? Timestamp.now() : null,
        bloqueiaDesmarcar: done,
        origemConclusao: done ? 'registro_manual' : null,
        atualizadaEm: Timestamp.now(),
      });
    }));
  };

  const getCronogramaReviewSlotRecordedMinutes = ({ cronograma, slot, registrosSnapshot }) => {
    if (!cronograma?.id || !slot) return 0;
    const slotDateKey = slot.dataSlot || null;
    const disciplinaId = String(slot.disciplinaId || '').trim();
    const disciplinaNomeNorm = normalizeRegistroText(slot.disciplinaNome || slot.disciplina);
    const assuntoNorm = normalizeRegistroText(slot.assunto || slot.assuntoOriginal);
    return (registrosSnapshot || []).reduce((acc, registro) => {
      if (!isRegistroRevisaoPayload(registro)) return acc;
      if (String(registro?.cronogramaId || '') !== String(cronograma.id || '')) return acc;
      if (getRegistroContext(registro) !== 'cronograma') return acc;
      if (slotDateKey && getRegistroDateKey(registro) !== slotDateKey) return acc;
      const sameId = disciplinaId && String(registro.disciplinaId || '') === disciplinaId;
      const sameNome = disciplinaNomeNorm && normalizeRegistroText(registro.disciplinaNome) === disciplinaNomeNorm;
      if (!sameId && !sameNome) return acc;
      const registroAssuntoNorm = normalizeRegistroText(registro.assunto);
      if (assuntoNorm && registroAssuntoNorm && registroAssuntoNorm !== assuntoNorm) return acc;
      return acc + Math.max(0, Number(registro.tempoEstudadoMinutos || registro.duracaoMinutos || 0));
    }, 0);
  };

  const recalculateCronogramaWeekProgressFromRegistros = async (registroExcluido, registrosSnapshot) => {
    if (!registroExcluido?.cronogramaId) return;
    const cronogramaRef = doc(db, 'users', user.uid, 'cronogramas', registroExcluido.cronogramaId);
    const cronogramaSnap = await getDoc(cronogramaRef);
    if (!cronogramaSnap.exists()) return;

    const cronograma = { id: cronogramaSnap.id, ...cronogramaSnap.data() };
    if (!cronograma.dataInicio) return;
    const weekOffset = getWeekOffsetFromDate(cronograma.dataInicio, registroExcluido.data || new Date());
    if (!Number.isFinite(Number(weekOffset))) return;

    const semKey = `w${weekOffset}`;
    const agenda = getAgendaSemana(cronograma, weekOffset) || [];
    const nextWeekMinutes = { ...(cronograma.progressoMinutos?.[semKey] || {}) };
    const nextWeekProgress = { ...(cronograma.progresso?.[semKey] || {}) };
    const nextReviewMinutes = { ...(cronograma.progressoRevisoesMinutos || {}) };
    const nextHistoricoRevisoes = { ...(cronograma.historicoRevisoes || {}) };

    agenda.forEach((slot) => {
      if (!slot) return;
      if (slot.isRevisaoAuto) {
        const slotKey = slot.slotId;
        if (!slotKey) return;
        const planned = getReviewPlannedMinutes(slot, 20);
        const minutes = getCronogramaReviewSlotRecordedMinutes({ cronograma, slot, registrosSnapshot });
        nextReviewMinutes[slotKey] = minutes;
        nextWeekProgress[slotKey] = minutes >= planned;
        if (minutes >= planned) {
          nextHistoricoRevisoes[slotKey] = nextHistoricoRevisoes[slotKey] || {
            dataConclusao: slot.dataSlot || registroExcluido.data || dateToYMD(new Date()),
            origem: 'registro_manual',
          };
        } else {
          delete nextHistoricoRevisoes[slotKey];
        }
        return;
      }

      const slotKey = slot.slotIdBase || slot.slotId;
      if (!slotKey) return;
      const planned = Math.max(1, Number(slot.tempoMinutos ?? slot.minutosEstudo ?? 0) || 0);
      const minutes = getCronogramaSlotRecordedMinutes({
        cronograma,
        slot,
        registrosEstudo: registrosSnapshot,
        dateKey: slot.dataSlot,
      });
      nextWeekMinutes[slotKey] = minutes;
      nextWeekProgress[slotKey] = minutes >= planned;
      if (slot.slotId && slot.slotId !== slotKey) {
        nextWeekMinutes[slot.slotId] = minutes;
        nextWeekProgress[slot.slotId] = minutes >= planned;
      }
    });

    await updateDoc(cronogramaRef, {
      [`progressoMinutos.${semKey}`]: nextWeekMinutes,
      [`progresso.${semKey}`]: nextWeekProgress,
      progressoRevisoesMinutos: nextReviewMinutes,
      historicoRevisoes: nextHistoricoRevisoes,
      atualizadoEm: Timestamp.now(),
    });
  };

  const rollbackDeletedRegistroProgress = async (registro, registrosSnapshot) => {
    try {
      const context = getRegistroContext(registro);
      if (context === 'ciclo') {
        await recalculateCycleStudyProgressFromRegistros(registro.cicloId, registrosSnapshot);
        await recalculateCycleReviewProgressFromRegistros(registro.cicloId, registrosSnapshot);
      } else if (context === 'cronograma') {
        await recalculateCronogramaWeekProgressFromRegistros(registro, registrosSnapshot);
      }
    } catch (error) {
      console.error('[Dashboard] Erro ao sincronizar exclusao de registro com progresso:', error);
    }
  };

  const deleteRegistro = async (id) => {
    try {
      const ref = doc(db,'users',user.uid,'registrosEstudo',id);
      const snap = await getDoc(ref);
      if (snap.exists()) {
        const data = snap.data();
        const deletedRegistro = normalizeRegistroPayload(id, data);
        await deleteDoc(ref);
        const registrosSnapshot = await fetchAllRegistrosEstudoSnapshot();
        setAllRegistrosEstudo(registrosSnapshot);
        setDailyGoalModalData(null);
        setPendingDailyGoalModalData(null);
        await rollbackDeletedRegistroProgress(deletedRegistro, registrosSnapshot);
        await syncStatsFromRegistrosSnapshot(registrosSnapshot);
      }
    } catch (e) { console.error(e); }
  };

  const deleteCompletionRegistro = async (completionData) => {
    try {
      const origemConclusaoIds = typeof completionData === 'string'
        ? [completionData]
        : [
          completionData?.origemConclusaoId,
          ...(Array.isArray(completionData?.alternateOrigemConclusaoIds) ? completionData.alternateOrigemConclusaoIds : []),
        ];
      const uniqueOrigemConclusaoIds = [...new Set(origemConclusaoIds.filter(Boolean).map(String))];
      if (!uniqueOrigemConclusaoIds.length) return false;

      let deleted = false;
      for (const origemConclusaoId of uniqueOrigemConclusaoIds) {
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
      }

      return deleted;
    } catch (e) {
      console.error('[Dashboard] Erro ao remover registro de conclusao:', e);
      throw e;
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
      tipoRegistro: options?.tipoRegistro === 'revisao' ? 'revisao' : 'estudo',
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
      tipoRegistro: activeStudySession.tipoRegistro === 'revisao' ? 'revisao' : 'estudo',
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

  const handleCronogramaCreation = (options = {}) => {
    setPreferredHomeContext('cronograma');
    if (options?.initialEditMode) setTargetCronogramaEditMode(options.initialEditMode);
    setActiveTab('cronograma');
  };

  const handleGoToActiveCycle = () => { if (activeCicloId) handleCicloCreationOrActivation(activeCicloId); else setActiveTab('planejamento'); };
  const handleGoToEditalSource = useCallback((source = 'ciclo') => {
    setEditalInitialSource(source);
    setActiveTab('edital');
  }, [setActiveTab]);
  const handleCreatePlanningFromEdital = useCallback((edital) => {
    if (!edital) return;
    setPendingPlanningEdital(edital);
    setForcePlanejamentoSelector(true);
    setActiveTab('planejamento');
  }, [setActiveTab]);
  const handleBackToEditalLibrary = useCallback(() => {
    setPendingPlanningEdital(null);
    setForcePlanejamentoSelector(false);
    setReopenEditalLibrary(true);
    setActiveTab('edital');
  }, [setActiveTab]);
  const handleCreateNewCycleFromLegacy = useCallback(() => {
    setForcePlanejamentoSelector(false);
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
    resetHydrationResource('activeCiclo');
    const q = query(collection(db,'users',user.uid,'ciclos'), where('ativo','==',true), where('arquivado','==',false));
    return onSnapshot(q, { includeMetadataChanges: true }, (snap) => {
      if (snap.empty) { setActiveCicloId(null); setActiveCicloData(null); }
      else { const d = snap.docs[0]; setActiveCicloId(d.id); setActiveCicloData({ id:d.id, ...d.data() }); }
      setActiveCicloLoaded(true);
      markHydrationSnapshot('activeCiclo', snap);
    }, (error) => {
      console.error('[Dashboard] Erro ao sincronizar ciclo ativo:', error);
      setActiveCicloId(null);
      setActiveCicloData(null);
      setActiveCicloLoaded(true);
      markHydrationError('activeCiclo');
    });
  }, [user, markHydrationError, markHydrationSnapshot, resetHydrationResource]);

  useEffect(() => {
    if (!user) return;
    setActiveCronogramaLoaded(false);
    resetHydrationResource('activeCronograma');
    const q = query(collection(db,'users',user.uid,'cronogramas'), where('ativo','==',true));
    return onSnapshot(q, { includeMetadataChanges: true }, (snap) => {
      if (snap.empty) setActiveCronogramaData(null);
      else {
        const cronogramasAtivos = snap.docs
          .map((d) => ({ id: d.id, ...d.data() }))
          .filter((crono) => crono.arquivado !== true)
          .sort((a, b) => {
            const tA = a.criadoEm?.seconds || a.dataCriacao?.seconds || a.createdAt?.seconds || 0;
            const tB = b.criadoEm?.seconds || b.dataCriacao?.seconds || b.createdAt?.seconds || 0;
            return tB - tA;
          });
        setActiveCronogramaData(cronogramasAtivos[0] || null);
      }
      setActiveCronogramaLoaded(true);
      markHydrationSnapshot('activeCronograma', snap);
    }, (error) => {
      console.error('[Dashboard] Erro ao sincronizar cronograma ativo:', error);
      setActiveCronogramaData(null);
      setActiveCronogramaLoaded(true);
      markHydrationError('activeCronograma');
    });
  }, [user, markHydrationError, markHydrationSnapshot, resetHydrationResource]);

  useEffect(() => {
    if (!user || !activeCicloId) {
      setActiveCycleDisciplines([]);
      setActiveCycleDisciplinesLoaded(Boolean(hydrationState.activeCiclo.received));
      if (hydrationState.activeCiclo.received) {
        setHydrationState((current) => ({
          ...current,
          disciplinasCiclo: {
            received: true,
            authoritative: current.activeCiclo.authoritative,
            failed: current.activeCiclo.failed,
            hasPendingWrites: false,
          },
        }));
      }
      return undefined;
    }
    setActiveCycleDisciplinesLoaded(false);
    resetHydrationResource('disciplinasCiclo');
    return onSnapshot(
      query(collection(db,'users',user.uid,'ciclos',activeCicloId,'disciplinas')),
      { includeMetadataChanges: true },
      (snap) => {
        setActiveCycleDisciplines(sortDisciplinasByEditalOrder(snap.docs.map((d, __sourceOrder) => {
          const data = d.data();
          const assuntos = Array.isArray(data.assuntos)
            ? data.assuntos.map(a => typeof a==='string' ? { nome:a, inCiclo:true } : { ...a, nome:(a?.nome||'').trim(), inCiclo:a?.inCiclo!==false }).filter(a=>a.nome)
            : [];
          return { id:d.id, ...data, assuntos, inCiclo:data.inCiclo!==false, __sourceOrder };
        })));
        setActiveCycleDisciplinesLoaded(true);
        markHydrationSnapshot('disciplinasCiclo', snap);
      },
      (error) => {
        console.error('[Dashboard] Erro ao sincronizar disciplinas do ciclo:', error);
        setActiveCycleDisciplinesLoaded(true);
        markHydrationError('disciplinasCiclo');
      }
    );
  }, [
    user,
    activeCicloId,
    hydrationState.activeCiclo.received,
    hydrationState.activeCiclo.authoritative,
    hydrationState.activeCiclo.failed,
    markHydrationError,
    markHydrationSnapshot,
    resetHydrationResource,
  ]);

  useEffect(() => {
    if (!user) return;
    setGoalsLoaded(false);
    resetHydrationResource('metas');
    return onSnapshot(
      query(collection(db,'users',user.uid,'metas'), orderBy('startDate','desc')),
      { includeMetadataChanges: true },
      (snap) => {
        setGoalsHistory(snap.docs.map(d => ({ id:d.id, ...d.data() })));
        setGoalsLoaded(true);
        markHydrationSnapshot('metas', snap);
      },
      (error) => {
        console.error('[Dashboard] Erro ao sincronizar metas:', error);
        setGoalsLoaded(true);
        markHydrationError('metas');
      }
    );
  }, [user, markHydrationError, markHydrationSnapshot, resetHydrationResource]);

  const renderTabContent = () => {
    if (loading && ['home','calendar','stats'].includes(activeTab)) {
      return <SectionLoader minHeight="18rem" label="Carregando seus dados" />;
    }
    switch (activeTab) {
      case 'home':
        return <Home registrosEstudo={mergedActiveRegistrosEstudo} allRegistrosEstudo={mergedAllRegistrosEstudo} goalsHistory={goalsHistory} setActiveTab={handleGoToActiveCycle} activeCicloData={activeCicloData} activeCronogramaData={activeCronogramaData} activeCycleDisciplines={activeCycleDisciplines} onGoToCronograma={() => handleCronogramaCreation(activeCronogramaData?.id)} onGoToRevisao={() => setActiveTab('revisoes')} onStartStudy={handleStartStudy} addRegistroEstudo={addRegistroEstudo} deleteCompletionRegistro={deleteCompletionRegistro} user={user} dailyGoalModalBlocked={Boolean(showGlobalRegistroModal || finishModalData || isLocalRegistroModalOpen)} />;
      case 'calendar':
        return <div className="mobile-page-zoom mobile-page-zoom--calendar desktop-page-zoom desktop-page-zoom--calendar"><CalendarTab registrosEstudo={mergedAllRegistrosEstudo} goalsHistory={goalsHistory} onDeleteRegistro={deleteRegistro} activeCicloData={activeCicloData} activeCronogramaData={activeCronogramaData}/></div>;
      case 'ciclos':
        return <CiclosPage user={user} onStartStudy={handleStartStudy} onCicloAtivado={handleCicloCreationOrActivation} addRegistroEstudo={addRegistroEstudo} deleteCompletionRegistro={deleteCompletionRegistro} onDeleteRegistro={deleteRegistro} activeCicloId={activeCicloId} forceOpenVisual={forceOpenVisual} targetOpenCicloId={targetOpenCicloId} onTargetOpenHandled={() => setTargetOpenCicloId(null)} onGoToEdital={() => handleGoToEditalSource('ciclo')} onGoToRevisao={() => setActiveTab('revisoes')} onCreateNewCycle={handleCreateNewCycleFromLegacy} registrosEstudo={mergedAllRegistrosEstudo} isTimerActive={!!(activeStudySession||activeSimuladoSession)} onRegistroModalOpenChange={setIsLocalRegistroModalOpen}/>;
      case 'planejamento':
        return <PlanejamentoPage user={user} addRegistroEstudo={addRegistroEstudo} onStartStudy={handleStartStudy} onGoToEdital={() => handleGoToEditalSource('ciclo')} onGoToRevisao={() => setActiveTab('revisoes')} registrosEstudo={mergedAllRegistrosEstudo} isTimerActive={!!(activeStudySession||activeSimuladoSession)} onGoToCronograma={handleCronogramaCreation} onCicloAtivado={handleCicloCreationOrActivation} activeCicloId={activeCicloId} abrirDiretoSeletor={isNovoUsuarioPlanejamento || forcePlanejamentoSelector} onSeletorDiretoAberto={handleSeletorDiretoAberto} onOpenFeedback={handleOpenFeedback} onRegistroModalOpenChange={setIsLocalRegistroModalOpen} initialEdital={pendingPlanningEdital} onInitialEditalConsumed={() => setPendingPlanningEdital(null)} onBackToEditais={handleBackToEditalLibrary} />;
      case 'cronograma':
        return <CronogramaPage user={user} onStartStudy={handleStartStudy} addRegistroEstudo={addRegistroEstudo} deleteCompletionRegistro={deleteCompletionRegistro} registrosEstudo={mergedAllRegistrosEstudo} onDeleteRegistro={deleteRegistro} onGoToEdital={() => handleGoToEditalSource('cronograma')} onGoToRevisao={() => setActiveTab('revisoes')} initialEditMode={targetCronogramaEditMode} onInitialEditModeHandled={() => setTargetCronogramaEditMode(null)}/>;
      case 'cronogramas':
        return <PlanejamentoPage user={user} addRegistroEstudo={addRegistroEstudo} onStartStudy={handleStartStudy} onGoToEdital={() => handleGoToEditalSource('ciclo')} onGoToRevisao={() => setActiveTab('revisoes')} registrosEstudo={mergedAllRegistrosEstudo} isTimerActive={!!(activeStudySession||activeSimuladoSession)} onGoToCronograma={handleCronogramaCreation} onCicloAtivado={handleCicloCreationOrActivation} activeCicloId={activeCicloId} abrirDiretoSeletor={isNovoUsuarioPlanejamento || forcePlanejamentoSelector} onSeletorDiretoAberto={handleSeletorDiretoAberto} onOpenFeedback={handleOpenFeedback} onRegistroModalOpenChange={setIsLocalRegistroModalOpen} />;
      case 'edital':
        return (
          <EditalPage
            user={user}
            activeCicloId={activeCicloId}
            activeCronogramaId={activeCronogramaData?.id || null}
            activeCicloData={activeCicloData}
            activeCronogramaData={activeCronogramaData}
            registrosEstudo={mergedAllRegistrosEstudo}
            initialViewSource={editalInitialSource}
            onStartStudy={handleStartStudy}
            onBack={handleGoToActiveCycle}
            editalUpdates={editalUpdates}
            onApplyEditalUpdate={applyEditalUpdate}
            onDismissEditalUpdate={dismissEditalUpdate}
            loadingEditalUpdate={loadingNotif}
            onGoToCronograma={handleCronogramaCreation}
            onCreatePlanningFromEdital={handleCreatePlanningFromEdital}
            openLibraryOnMount={reopenEditalLibrary}
            onLibraryOpened={() => setReopenEditalLibrary(false)}
          />
        );
      case 'revisoes':
        return <div className="mobile-page-zoom mobile-page-zoom--revisoes desktop-page-zoom desktop-page-zoom--revisoes"><RevisaoPage user={user} onStartStudy={handleStartStudy} addRegistroEstudo={addRegistroEstudo} deleteCompletionRegistro={deleteCompletionRegistro} onChoosePlan={handleChoosePlanFromRevisao} registrosEstudo={mergedAllRegistrosEstudo} disciplinasCiclo={activeCycleDisciplines} /></div>;
      case 'stats':
        return <Desempenho registrosEstudo={mergedAllRegistrosEstudo} disciplinasDoCiclo={activeCycleDisciplines} activeCicloId={activeCicloId} activeCronogramaId={activeCronogramaData?.id||null} activeCicloData={activeCicloData} activeCronogramaData={activeCronogramaData} metas={goalsHistory} onCreateCycle={() => setActiveTab('planejamento')}/>;
      case 'simulados':
        return <SimuladosPage user={user} activeCycleDisciplines={activeCycleDisciplines} onStartSimulado={handleStartSimulado} initialData={finishedSimuladoData} onClearInitialData={handleClearSimuladoData}/>;
      case 'ranking':
        return <div className="w-full min-w-0"><RankingPage user={user} levelData={levelData}/></div>;
      case 'ligas':
        return LEAGUES_ENABLED
          ? <div className="mobile-page-zoom mobile-page-zoom--ligas"><LeaguesPage user={user} levelData={levelData}/></div>
          : <div className="w-full min-w-0"><RankingPage user={user} levelData={levelData}/></div>;
      case 'conquistas':
        return <div className="mobile-page-zoom mobile-page-zoom--conquistas"><AchievementsPage user={user} levelData={levelData}/></div>;
      case 'grupos':
        return <div className="mobile-page-zoom mobile-page-zoom--grupos"><GroupsPage user={user} gamificationProfile={gamificationProfile} levelData={levelData}/></div>;
      case 'profile':
        return <div className="mobile-page-zoom mobile-page-zoom--profile desktop-page-zoom desktop-page-zoom--profile"><ProfilePage user={user} allRegistrosEstudo={mergedAllRegistrosEstudo} onDeleteRegistro={deleteRegistro} coverURL={profileCover.url} coverPosition={profileCover.position} coverLoading={profileCover.loading} levelData={levelData} onGoToAchievements={() => setActiveTab('conquistas')}/></div>;
      case 'noticias':
        return <div className="mobile-page-zoom mobile-page-zoom--noticias desktop-page-zoom desktop-page-zoom--noticias"><NoticiasPage/></div>;
      case 'admin':
        if (userAccess.isLoading) return <SectionLoader minHeight="20rem" />;
        if (userAccess.permissions.adminPanel) return <div className="mobile-page-zoom mobile-page-zoom--admin desktop-page-zoom desktop-page-zoom--admin"><AdminPage onRecalculateStats={recalculateAllStats} userAccess={userAccess} /></div>;
        return <div className="mobile-page-zoom mobile-page-zoom--admin desktop-page-zoom desktop-page-zoom--admin p-8 text-center text-red-500 font-bold">Acesso Negado</div>;
      default:
        return null;
    }
  };

  if (!user) {
    return null;
  }

  if (!coreDataReady || userAccess.isLoading) {
    return null;
  }

  if (noOfflineData) {
    return <DashboardBootScreen isOnline={false} noOfflineData />;
  }

  return (
    <div className="relative isolate flex min-h-screen bg-background-light dark:bg-background-dark text-text-primary dark:text-text-dark-primary transition-colors duration-300 overflow-x-hidden">
      <AppBackgroundEffects />
      <XPNotification user={user} />
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
      <DailyGoalCompletedModal
        open={Boolean(dailyGoalModalData)}
        onClose={() => setDailyGoalModalData(null)}
        {...(dailyGoalModalData || {})}
      />

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
          coverURL={profileCover.url}
          coverPosition={profileCover.position}
          coverLoading={profileCover.loading}
          levelData={levelData}
          userAccess={userAccess}
          activeTab={activeTab}
        setActiveTab={handleTabChange}
        handleLogout={handleLogout}
        isExpanded={isSidebarExpanded}
        setExpanded={setIsSidebarExpanded}
        forceExpandedOnLarge={isLargeSidebarViewport}
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
          onMarkOperationalRead: markOperationalRead,
          onRespondGroupRequest: respondGroupRequest,
          onMarkAllRead: markAllRead,
          onApplyEditalUpdate: applyEditalUpdate,
          onDismissEditalUpdate: dismissEditalUpdate,
          loadingNotif,
          onNavigateToEdital: () => handleTabChange('edital'),
          deleteBroadcast,
          deleteHistoryItem
        }}
      />

      <div
        ref={mainContentRef}
        onPointerDown={() => {
          if (isSidebarExpanded && !isLargeSidebarViewport) setIsSidebarExpanded(false);
          if (isMobileOpen) setIsMobileOpen(false);
        }}
        className={`dashboard-main-content relative z-10 min-w-0 flex-1 transition-all duration-300 pt-[80px] px-4 md:px-8 lg:pt-[90px] pb-10 ${isLargeSidebarViewport || isSidebarExpanded ? 'lg:ml-[220px]' : 'lg:ml-[72px]'}`}
      >
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
        hidden={showGlobalRegistroModal || welcomeCarousel.loading || Boolean(welcomeCarousel.mode)}
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
            groupIds={levelData.groupIds}
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
            groupIds={levelData.groupIds}
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
            initialTipoRegistro={finishModalData.tipoRegistro || pendingReviewData?.tipoRegistro || 'estudo'}
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

