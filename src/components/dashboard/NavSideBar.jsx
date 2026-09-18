import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  Home, Target, Calendar, LogOut, RefreshCw, Menu, ShieldAlert,
  LayoutList, BarChart3, ClipboardList, Sun, Moon, Radio, X, ChevronRight, ChevronLeft,
  CalendarClock, Layers, ChevronDown, Newspaper, RotateCw, CalendarDays, BookOpen,
  PanelLeftClose, PanelLeftOpen,
  Clock, AlertTriangle, ArrowRight, Bell, Flame, Settings, HelpCircle,
  Trophy, Users, Award, Shield, Medal, Crown, Gem, Diamond, Files,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { collection, doc, query, where, onSnapshot, limit } from 'firebase/firestore';
import { db } from '../../firebaseConfig';
import ProfileLevelRing from '../gamification/ProfileLevelRing';
import { NotificationBell } from '../shared/NotificationPanel';
import InstallAppButton from '../shared/InstallAppButton';
import TrialStatusBadge from '../subscription/TrialStatusBadge';
import { calcularStatusEstudoHoje } from '../../hooks/useCronogramaSystem';
import { useCicloRevisoes } from '../../hooks/useCicloRevisoes';
import { buildRevisaoCentral } from '../../utils/revisaoCentral';
import { coverPositionToStyle } from '../../utils/profileCover';
import { getWeekId, sortGeneralRankingMembers } from '../../utils/gamification';
import { DOCUMENTS_ENABLED, ERROR_BOOK_ENABLED, FLASHCARDS_ENABLED, LEAGUES_ENABLED, QUESTIONS_ENABLED } from '../../config/featureFlags';


const NAV_ICON_SIZE  = 18;
const NAV_LABEL_SIZE = 'text-[10px]';
const NAV_BTN_PAD    = 'px-2.5 py-2';
const NAV_BTN_RADIUS = 'rounded-xl';
const NAV_GAP        = 'space-y-0.5';
const NAV_BADGE_SIZE = 'text-[8px]';
const ENABLE_FLOATING_STUDY_REMINDER = false;
const leagueIconByType = { shield: Shield, medal: Medal, crown: Crown, gem: Gem, diamond: Diamond };

const LeagueIcon = ({ league, size = 13, className = '', style }) => {
  const Icon = leagueIconByType[league?.icon] || Shield;
  return <Icon size={size} strokeWidth={1.9} className={className} style={style}/>;
};
// ─────────────────────────────────────────────────────────────────────
// Pill de lembrete — aparece abaixo do sino quando o usuário entra na Home.
// Usa um wrapper fixed com largura total na linha do sino, e o card
// fica absolute dentro dele — assim nunca é cortado e a seta segue o sino.
// ─────────────────────────────────────────────────────────────────────
function StudyReminderPill({ statusEstudo, revisoesInfo, onNavigate, isVisible, onDismiss, bellContainerRef }) {
  const now = new Date();
  const hour = now.getHours();
  const isNight = hour >= 18 || hour < 6;

  const hasStudyPending = statusEstudo?.temEstudoHoje && statusEstudo.progressoHoje === 0;
  const hasReviewPending = revisoesInfo?.total > 0;

  const [bellRect, setBellRect] = useState(null);

  useEffect(() => {
    if (!isVisible || !bellContainerRef?.current) { setBellRect(null); return; }
    const el = bellContainerRef.current;
    const update = () => {
      const r = el.getBoundingClientRect();
      if (r && r.width > 0 && r.top > 0) setBellRect(r);
    };
    const tid = setTimeout(update, 50);
    window.addEventListener('resize', update);
    return () => { clearTimeout(tid); window.removeEventListener('resize', update); };
  }, [isVisible, bellContainerRef]);

  if (!isVisible || (!hasStudyPending && !hasReviewPending)) return null;

  const vw = window.innerWidth;
  const cardWidth = vw < 480 ? 260 : 300;

  // Usa bellRect se disponível, senão fallback seguro
  const top = bellRect ? bellRect.bottom + 12 : 82;
  const isMobile = vw < 768;
  const right = bellRect ? Math.max(vw - bellRect.right - (isMobile ? 5 : 20), 8) : 16;
  // Seta alinhada ao centro do bell
  const arrowRight = bellRect ? Math.max(4, isMobile ? bellRect.width / 2 : bellRect.width / 2 + 4) : 20;

  return createPortal(
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
      className="fixed z-[9999]"
      style={{ top, right, width: cardWidth }}
    >
      <div className={`rounded-2xl shadow-2xl border ${
          isNight
            ? 'bg-zinc-900 border-zinc-700/60 shadow-black/50'
            : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-700/60 shadow-black/10 dark:shadow-black/50'
        }`}>

          {/* Seta apontando para cima — canto superior direito */}
          <svg
            className="absolute -top-2 w-4 h-2 z-[10000]"
            style={{ right: arrowRight }}
            viewBox="0 0 16 8"
            preserveAspectRatio="none"
          >
            <path
              d="M0 8 L8 0 L16 8 Z"
              className={isNight
                ? 'fill-zinc-900 stroke-zinc-700/60'
                : 'fill-white dark:fill-zinc-900 stroke-zinc-200 dark:stroke-zinc-700/60'
              }
              strokeWidth="0.5"
            />
          </svg>

          {/* Header */}
          <div className="flex items-center justify-between px-3 py-1.5 border-b border-zinc-100 dark:border-zinc-800/80">
            <div className="flex items-center gap-1.5">
              <Bell size={10} className="text-zinc-400" />
              <span className="text-[8px] font-black uppercase tracking-widest text-zinc-400">
                Notificação
              </span>
            </div>
            <button
              onClick={(e) => { e.stopPropagation(); onDismiss(); }}
              className="w-5 h-5 rounded-md flex items-center justify-center hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors"
            >
              <X size={12} strokeWidth={2.5} />
            </button>
          </div>

          {/* Pill de Estudo */}
          {hasStudyPending && (
            <motion.button
              onClick={() => onNavigate('cronograma')}
              whileHover={{ backgroundColor: isNight ? 'rgba(180,83,9,0.15)' : 'rgba(251,191,36,0.08)' }}
              whileTap={{ scale: 0.99 }}
              className="flex items-center gap-2 w-full px-3 py-2.5 border-b border-zinc-100 dark:border-zinc-800/80 transition-colors text-left"
            >
              <div className="w-1 h-8 rounded-full shrink-0 bg-amber-400"/>
              <div className="flex items-center gap-2 flex-1 min-w-0">
                {isNight ? (
                  <div className="relative shrink-0 flex items-center justify-center">
                    <Clock size={14} className="text-amber-500 z-10" />
                    <motion.span
                      animate={{ opacity: [0.4, 1, 0.4], scale: [1, 1.4, 1] }}
                      transition={{ duration: 2, repeat: Infinity }}
                      className="absolute w-3 h-3 bg-amber-500/30 rounded-full"
                    />
                  </div>
                ) : (
                  <Target size={14} className="text-amber-500 shrink-0" />
                )}
                <div className="flex flex-col items-start min-w-0">
                  <span className="text-[9px] font-black uppercase tracking-wider leading-none text-amber-600 dark:text-amber-400">Estudo</span>
                  <span className="text-[10px] font-bold leading-tight mt-0.5 text-zinc-600 dark:text-zinc-300">
                    {statusEstudo.totalSlotsHoje} bloco(s) pendente(s)
                  </span>
                </div>
              </div>
              <ArrowRight size={11} className="shrink-0 text-zinc-300 dark:text-zinc-500" />
            </motion.button>
          )}

          {/* Pill de Revisão */}
          {hasReviewPending && (
            <motion.button
              onClick={() => onNavigate('revisoes')}
              whileHover={{ backgroundColor: isNight ? 'rgba(29,78,216,0.15)' : 'rgba(59,130,246,0.08)' }}
              whileTap={{ scale: 0.99 }}
              className="flex items-center gap-2 w-full px-3 py-2.5 transition-colors text-left"
            >
              <div className="w-1 h-8 rounded-full shrink-0 bg-blue-400"/>
              <div className="flex items-center gap-2 flex-1 min-w-0">
                {isNight ? (
                  <div className="relative shrink-0 flex items-center justify-center">
                    <Clock size={14} className="text-blue-500 z-10" />
                    <motion.span
                      animate={{ opacity: [0.4, 1, 0.4], scale: [1, 1.4, 1] }}
                      transition={{ duration: 2, repeat: Infinity, delay: 0.5 }}
                      className="absolute w-3 h-3 bg-blue-500/30 rounded-full"
                    />
                  </div>
                ) : (
                  <BookOpen size={14} className="text-blue-500 shrink-0" />
                )}
                <div className="flex flex-col items-start min-w-0">
                  <span className="text-[9px] font-black uppercase tracking-wider leading-none text-blue-600 dark:text-blue-400">Revisão</span>
                  <span className="text-[10px] font-bold leading-tight mt-0.5 text-zinc-600 dark:text-zinc-300">
                    {revisoesInfo.total} pendente(s){revisoesInfo.atrasadas > 0 ? ` (${revisoesInfo.atrasadas} atrasada(s))` : ''}
                  </span>
                </div>
              </div>
              <ArrowRight size={11} className="shrink-0 text-zinc-300 dark:text-zinc-500" />
            </motion.button>
          )}
        </div>
      </motion.div>,
    document.body
  );
}

function StreakHeaderPill({ streak }) {
  const [isCardOpen, setIsCardOpen] = useState(false);
  const buttonRef = useRef(null);

  // Fecha o card ao clicar fora
  useEffect(() => {
    if (!isCardOpen) return;
    const handler = (e) => {
      if (buttonRef.current && !buttonRef.current.contains(e.target)) {
        setIsCardOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [isCardOpen]);

  return (
    <>
      <motion.button
        ref={buttonRef}
        onClick={() => setIsCardOpen(!isCardOpen)}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        className={`group relative hidden h-10 items-center gap-1.5 overflow-hidden rounded-2xl px-3 py-1.5 transition-all sm:flex border ${
          streak > 0 
            ? 'bg-white/50 dark:bg-zinc-900/50 hover:bg-white dark:hover:bg-zinc-900 border-zinc-200 dark:border-zinc-800' 
            : 'bg-zinc-100/50 dark:bg-zinc-900/30 border-transparent text-zinc-400'
        }`}
        title="Ver detalhes da sequência"
      >
        {/* Glow Effect de fundo (apenas se tiver streak) */}
        {streak > 0 && (
          <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500">
            <div className="absolute inset-[-20%] bg-gradient-to-r from-red-500/10 via-orange-500/10 to-red-500/10 blur-xl" />
          </div>
        )}

        <div className="relative flex items-center justify-center">
          {streak > 0 && (
            <div className="absolute h-6 w-6 rounded-full bg-orange-500/20 blur-md" />
          )}
          
          <div className="relative z-10">
            <Flame 
              size={18} 
              className={streak > 0 
                ? "text-orange-600 dark:text-orange-500 fill-orange-500/30" 
                : "text-zinc-400 dark:text-zinc-600"
              } 
              strokeWidth={2.5} 
            />
          </div>
        </div>

        <div className="relative z-10 flex items-center">
          <span
            className={`text-base font-black tabular-nums ${
              streak > 0 
                ? 'bg-gradient-to-br from-red-600 to-orange-500 bg-clip-text text-transparent dark:from-red-500 dark:to-orange-400' 
                : 'text-zinc-400 dark:text-zinc-600'
            }`}
          >
            {streak}
          </span>
        </div>
      </motion.button>

      {/* Card de Detalhes da Sequência */}
      <AnimatePresence>
        {isCardOpen && (
          <StreakInfoPortal 
            streak={streak} 
            anchorRef={buttonRef} 
            onClose={() => setIsCardOpen(false)} 
          />
        )}
      </AnimatePresence>
    </>
  );
}

function StreakInfoPortal({ streak, anchorRef, onClose }) {
  const [coords, setCoords] = useState({ top: 0, right: 0 });

  useEffect(() => {
    if (anchorRef.current) {
      const rect = anchorRef.current.getBoundingClientRect();
      setCoords({
        top: rect.bottom + 12,
        right: window.innerWidth - rect.right
      });
    }
  }, [anchorRef]);

  return createPortal(
    <motion.div
      initial={{ opacity: 0, y: 10, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 10, scale: 0.95 }}
      style={{ top: coords.top, right: coords.right }}
      className="fixed z-[9999] w-60 overflow-hidden rounded-2xl border border-zinc-200 bg-white p-4 shadow-2xl dark:border-zinc-800 dark:bg-card-dark"
    >
      {/* Fundo Decorativo */}
      <div className="absolute inset-0 bg-gradient-to-b from-orange-500/5 to-transparent dark:from-orange-500/10 pointer-events-none" />
      
      <div className="relative z-10 flex flex-col items-center text-center">
        {/* Grande Chama Animada */}
        <div className="relative mb-3 flex h-20 w-20 items-center justify-center">
          {/* Brilhos de fundo da chama */}
          <motion.div
            animate={{ scale: [1, 1.4, 1], opacity: [0.2, 0.4, 0.2] }}
            transition={{ duration: 3, repeat: Infinity }}
            className="absolute inset-0 rounded-full bg-orange-500/20 blur-2xl"
          />
          <motion.div
            animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0.5, 0.3] }}
            transition={{ duration: 2, repeat: Infinity, delay: 0.5 }}
            className="absolute h-14 w-14 rounded-full bg-red-500/20 blur-xl"
          />

          {/* Ícone da Chama Principal */}
          <motion.div
            animate={{
              y: [0, -5, 0],
              rotate: [-2, 2, -2],
              scale: [1, 1.05, 1],
            }}
            transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
            className="relative z-20"
          >
            <Flame 
              size={52}
              className={streak > 0 
                ? "text-orange-600 dark:text-orange-500 fill-orange-500/40" 
                : "text-zinc-300 dark:text-zinc-800"
              } 
              strokeWidth={1.5} 
            />
          </motion.div>

          {/* Partículas de faísca grandes */}
          {streak > 0 && Array.from({ length: 6 }).map((_, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 0, x: 0 }}
              animate={{
                y: [-20, -80],
                x: [0, (i % 2 === 0 ? 30 : -30) * Math.random()],
                opacity: [0, 1, 0],
                scale: [0, 1, 0],
              }}
              transition={{
                duration: 1.5 + Math.random(),
                repeat: Infinity,
                delay: i * 0.3,
                ease: "easeOut"
              }}
              className={`absolute top-1/2 h-2 w-2 rounded-full ${i % 2 === 0 ? 'bg-orange-500' : 'bg-red-500'} blur-[1px]`}
            />
          ))}
        </div>

        <h4 className="text-[10px] font-black uppercase tracking-widest text-zinc-400 dark:text-zinc-500">
          Sequência de Estudo
        </h4>
        
        <div className="mt-1 flex items-baseline gap-2">
          <span className={`text-4xl font-black tabular-nums ${
            streak > 0 
              ? 'bg-gradient-to-br from-red-600 to-orange-500 bg-clip-text text-transparent dark:from-red-500 dark:to-orange-400' 
              : 'text-zinc-300 dark:text-zinc-800'
          }`}>
            {streak}
          </span>
          <span className="text-sm font-bold text-zinc-400 dark:text-zinc-600">dias</span>
        </div>

        <p className="mt-2 text-xs font-medium leading-relaxed text-zinc-600 dark:text-zinc-400">
          {streak === 0 
            ? "Você ainda não começou sua jornada hoje. Vamos ativar o Modo QAP?" 
            : streak < 3 
            ? "O começo de algo grande! Mantenha a constância para fortalecer o hábito." 
            : streak < 7 
            ? "Você está pegando ritmo! Continue assim e verá os resultados em breve."
            : "Incrível! Sua dedicação é inspiradora. Mantenha essa chama acesa!"}
        </p>

        {/* Footer do Card */}
        <div className="mt-4 w-full border-t border-zinc-100 pt-3 dark:border-zinc-800/50">
          <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-wider text-zinc-400">
            <span>Status</span>
            <span className={streak > 0 ? "text-orange-500" : "text-zinc-500"}>
              {streak > 0 ? "Fogo Ativo" : "Aguardando"}
            </span>
          </div>
        </div>
      </div>
    </motion.div>,
    document.body
  );
}

function NavSideBar({
  user,
  coverURL,
  coverPosition,
  coverLoading = false,
  levelData,
  userAccess,
  monetizationConfig = null,
  activeTab,
  setActiveTab,
  handleLogout,
  isExpanded,
  setExpanded,
  isMobileOpen,
  setMobileOpen,
  isDarkMode,
  toggleTheme,
  registrosEstudo,
  activeCicloId,
  onShareGoal,
  onOpenFeedback,
  activeCicloData,
  activeCronogramaData,
  onGoToCicloAtivo,
  shouldGuidePlanning = false,
  cicloFinalizacaoAlert,
  cicloLegacyUpgradeAlert,
  notificationProps,
  onPrefetchTab,
  studyStreakResult,
}) {
  const [hasUnreadSupport, setHasUnreadSupport]     = useState(false);
  const [isProfileMenuOpen, setIsProfileMenuOpen]   = useState(false);
  const [isPlanejamentoOpen, setIsPlanejamentoOpen] = useState(false);
  const [weeklyRanking, setWeeklyRanking] = useState({
    loading: Boolean(user?.uid),
    position: null,
  });

  useEffect(() => {
    if (!user?.uid) {
      setWeeklyRanking({ loading: false, position: null });
      return undefined;
    }

    setWeeklyRanking({ loading: true, position: null });
    const weekId = getWeekId();
    const memberRef = doc(db, 'weekly_rankings', weekId, 'members', user.uid);
    let unsubCollection = null;

    const unsubMember = onSnapshot(memberRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        const rawPosition = data?.positions?.minutes
          ?? data?.positions?.questions
          ?? data?.position
          ?? data?.weeklyPosition
          ?? data?.rank;
        const posNum = Number(rawPosition);
        if (Number.isInteger(posNum) && posNum > 0) {
          setWeeklyRanking({ loading: false, position: posNum });
          if (unsubCollection) {
            unsubCollection();
            unsubCollection = null;
          }
          return;
        }
      }

      if (!unsubCollection) {
        const membersRef = collection(db, 'weekly_rankings', weekId, 'members');
        unsubCollection = onSnapshot(membersRef, (colSnapshot) => {
          const membersList = colSnapshot.docs
            .map((item) => ({ id: item.id, ...item.data() }))
            .filter((m) => m.accountActive !== false && m.active !== false && !m.disabled);
          if (membersList.length > 0) {
            const sorted = sortGeneralRankingMembers(membersList, 'minutes');
            const userIndex = sorted.findIndex((m) => (m.uid || m.id) === user.uid);
            if (userIndex >= 0) {
              setWeeklyRanking({ loading: false, position: userIndex + 1 });
              return;
            }
          }
          setWeeklyRanking({ loading: false, position: null });
        }, (err) => {
          console.warn('[Ranking] Erro ao buscar membros do ranking semanal:', err.code || err);
          setWeeklyRanking({ loading: false, position: null });
        });
      }
    }, (error) => {
      console.warn('[Ranking] Nao foi possivel carregar a posicao semanal do usuario:', error.code || error);
      setWeeklyRanking({ loading: false, position: null });
    });

    return () => {
      if (typeof unsubMember === 'function') unsubMember();
      if (typeof unsubCollection === 'function') unsubCollection();
    };
  }, [user?.uid]);

  // Pill de lembrete — aparece na Home e some automaticamente
  const [showReminderPill, setShowReminderPill] = useState(false);
  const prevTabRef = useRef(null);
  const reminderTimerRef = useRef(null);
  const reminderDismissedRef = useRef(false);
  const reminderShownKeyRef = useRef(null);
  const bellContainerRef = useRef(null);

  useEffect(() => {
    if (!ENABLE_FLOATING_STUDY_REMINDER) return;

    if (activeTab === 'home' && prevTabRef.current !== 'home') {
      setShowReminderPill(true);
      const timer = setTimeout(() => setShowReminderPill(false), 8000);
      return () => clearTimeout(timer);
    } else if (activeTab !== 'home') {
      reminderDismissedRef.current = false;
      reminderShownKeyRef.current = null;
      if (reminderTimerRef.current) {
        clearTimeout(reminderTimerRef.current);
        reminderTimerRef.current = null;
      }
      setShowReminderPill(false);
    }
    prevTabRef.current = activeTab;
  }, [activeTab]);

  useEffect(() => () => {
    if (reminderTimerRef.current) clearTimeout(reminderTimerRef.current);
  }, []);

  const { revisoes: revisoesCiclo } = useCicloRevisoes(
    user,
    activeCicloId || '__sem_ciclo_ativo__',
  );

  // Cronograma ativo (para alertas de sistema)
  const [cronogramaAtivo, setCronogramaAtivo] = useState(null);
  const cronogramaParaAlertas = cronogramaAtivo || activeCronogramaData || null;

  const menuRef = useRef(null);
  useEffect(() => {
    if (activeTab === 'ciclos' || activeTab === 'cronograma' || activeTab === 'cronogramas' || activeTab === 'planejamento') {
      setIsPlanejamentoOpen(true);
    }
  }, [activeTab]);

  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, 'system_feedback'),
      where('uid', '==', user.uid),
      where('unreadUser', '==', true), limit(1)
    );
    const unsub = onSnapshot(
      q,
      (snap) => setHasUnreadSupport(!snap.empty),
      (error) => {
        setHasUnreadSupport(false);
        console.warn('[Suporte] Nao foi possivel acompanhar chamados nao lidos:', error.code || error);
      }
    );
    return () => unsub();
  }, [user]);

  // ── Escuta cronograma ativo para calcular badge de revisões ────────────
  useEffect(() => {
    if (!user?.uid) return;

    const q = query(
      collection(db, 'users', user.uid, 'cronogramas'),
      where('ativo', '==', true)
    );

    const unsub = onSnapshot(
      q,
      (snap) => {
        if (!snap.empty) {
          const cronograma = { id: snap.docs[0].id, ...snap.docs[0].data() };
          setCronogramaAtivo(cronograma);
          return;
        }
        setCronogramaAtivo(null);
      },
      (error) => {
        setCronogramaAtivo(null);
        console.warn('[Planejamento] Nao foi possivel acompanhar o cronograma ativo:', error.code || error);
      }
    );

    return () => unsub();
  }, [user?.uid]);

  const revisaoCentral = useMemo(() => buildRevisaoCentral({
    cronograma: cronogramaParaAlertas,
    ciclo: activeCicloData ? { ...activeCicloData, disciplinas: [] } : null,
    revisoesCiclo,
    registrosEstudo,
    dataReferencia: new Date(),
  }), [activeCicloData, cronogramaParaAlertas, registrosEstudo, revisoesCiclo]);
  const revisoesInfoCanonicas = useMemo(() => ({
    total: revisaoCentral.buckets.atrasadas.length + revisaoCentral.buckets.hoje.length,
    atrasadas: revisaoCentral.buckets.atrasadas.length,
  }), [revisaoCentral.buckets.atrasadas.length, revisaoCentral.buckets.hoje.length]);

  // ── Alertas inteligentes de sistema ──────────────────────────────────
  const systemAlerts = useMemo(() => {
    const alerts = [];
    if (cicloFinalizacaoAlert) alerts.push(cicloFinalizacaoAlert);
    if (cicloLegacyUpgradeAlert) alerts.push(cicloLegacyUpgradeAlert);
    const statusEstudo = cronogramaParaAlertas ? calcularStatusEstudoHoje(cronogramaParaAlertas) : null;
    const revisoesInfo = revisoesInfoCanonicas;

    if (statusEstudo?.temEstudoHoje && statusEstudo.progressoHoje === 0) {
      alerts.push({
        id: 'alerta_falta_estudo',
        type: 'falta_estudo',
        title: 'Estudos pendentes hoje',
        message: `Você tem ${statusEstudo.totalSlotsHoje} bloco(s) programado(s) e ainda não iniciou. Modo QAP ativado?`,
        actionLabel: 'Ir para Cronograma',
        navigateTo: 'cronograma',
      });
    }

    if (revisoesInfo.total > 0) {
      const complemento = revisoesInfo.atrasadas > 0
        ? ` (${revisoesInfo.atrasadas} atrasada(s))`
        : '';
      alerts.push({
        id: 'alerta_revisoes',
        type: 'revisoes_pendentes',
        title: 'Revisões pendentes',
        message: `Atenção: ${revisoesInfo.total} revisão(ões) pendente(s) para hoje${complemento}. Não quebre seu ciclo!`,
        actionLabel: revisoesInfo.atrasadas > 0 ? 'Revisar Atrasadas' : 'Revisar Agora',
        navigateTo: 'revisoes',
      });
    }

    return alerts;
  }, [cronogramaParaAlertas, cicloFinalizacaoAlert, cicloLegacyUpgradeAlert, revisoesInfoCanonicas]);

  const handleSystemAlertAction = useCallback((alert) => {
    if (alert.type === 'ciclo_legacy_upgrade') {
      try {
        if (alert.cicloId) sessionStorage.setItem('modoqap_open_cycle_upgrade', alert.cicloId);
      } catch {}
      window.dispatchEvent(new CustomEvent('modoqap:open-cycle-upgrade', { detail: { cicloId: alert.cicloId || null } }));
      onGoToCicloAtivo?.();
      setMobileOpen(false);
      return;
    }
    if (String(alert.type || '').startsWith('ciclo_')) {
      onGoToCicloAtivo?.();
      setMobileOpen(false);
      return;
    }
    if (alert.navigateTo) {
      setActiveTab(alert.navigateTo);
      setMobileOpen(false);
    }
  }, [onGoToCicloAtivo, setActiveTab, setMobileOpen]);

  // ── Dados para o pill de lembrete (abaixo do sino) ────────────────────
  const reminderStatusEstudo = useMemo(() => {
    if (!cronogramaParaAlertas) return null;
    return calcularStatusEstudoHoje(cronogramaParaAlertas);
  }, [cronogramaParaAlertas]);

  const reminderRevisoesInfo = useMemo(() => {
    return revisoesInfoCanonicas;
  }, [revisoesInfoCanonicas]);

  const reminderKey = useMemo(() => (
    systemAlerts.map((alert) => alert.id).join('|')
  ), [systemAlerts]);

  useEffect(() => {
    if (!ENABLE_FLOATING_STUDY_REMINDER) return;

    if (activeTab !== 'home' || systemAlerts.length === 0 || reminderDismissedRef.current) return;
    if (reminderShownKeyRef.current === reminderKey) return;

    reminderShownKeyRef.current = reminderKey;
    setShowReminderPill(true);

    if (reminderTimerRef.current) clearTimeout(reminderTimerRef.current);
    reminderTimerRef.current = setTimeout(() => {
      setShowReminderPill(false);
      reminderTimerRef.current = null;
    }, 8000);
  }, [activeTab, reminderKey, systemAlerts.length]);

  const handleReminderNavigate = useCallback((tab) => {
    setActiveTab(tab);
    setMobileOpen(false);
  }, [setActiveTab, setMobileOpen]);

  const handleReminderDismiss = useCallback(() => {
    reminderDismissedRef.current = true;
    if (reminderTimerRef.current) {
      clearTimeout(reminderTimerRef.current);
      reminderTimerRef.current = null;
    }
    setShowReminderPill(false);
  }, []);

  useEffect(() => {
    const handler = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setIsProfileMenuOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const navItems = useMemo(() => {
    const items = [
      { id: 'home',      label: 'Home',        icon: <Home size={NAV_ICON_SIZE}/> },
      { id: 'noticias',  label: 'Notícias',   icon: <Newspaper size={NAV_ICON_SIZE}/>,    isNew: true },
      { id: 'planejamento', label: 'Planejamento', icon: <Layers size={NAV_ICON_SIZE}/> },
      { id: 'edital',    label: 'Edital',      icon: <LayoutList size={NAV_ICON_SIZE}/> },
      { id: 'revisoes',  label: 'Revisões',    icon: <BookOpen size={NAV_ICON_SIZE}/> },
      ...(FLASHCARDS_ENABLED ? [{ id: 'flashcards', label: 'Flashcards', icon: <Layers size={NAV_ICON_SIZE}/> }] : []),
      ...(DOCUMENTS_ENABLED ? [{ id: 'documentos', label: 'Documentos', icon: <Files size={NAV_ICON_SIZE}/> }] : []),
      ...(QUESTIONS_ENABLED ? [{ id: 'questoes', label: 'Questões', icon: <HelpCircle size={NAV_ICON_SIZE}/> }] : []),
      ...(ERROR_BOOK_ENABLED ? [{ id: 'cadernoErros', label: 'Caderno de Erros', icon: <AlertTriangle size={NAV_ICON_SIZE}/> }] : []),
      { id: 'stats',     label: 'Desempenho',  icon: <BarChart3 size={NAV_ICON_SIZE}/> },
      ...(LEAGUES_ENABLED ? [{ id: 'ligas', label: 'Ligas', icon: <Trophy size={NAV_ICON_SIZE}/> }] : []),
      { id: 'ranking',   label: 'Ranking',      icon: <Trophy size={NAV_ICON_SIZE}/> },
      { id: 'grupos',    label: 'Grupos de Estudo', icon: <Users size={NAV_ICON_SIZE}/> },
      { id: 'simulados', label: 'Simulados',   icon: <ClipboardList size={NAV_ICON_SIZE}/> },
      { id: 'calendar',  label: 'Calendário',  icon: <Calendar size={NAV_ICON_SIZE}/> },
    ];

    if (userAccess?.permissions?.adminPanel) {
      items.push({ id: 'admin', label: 'Admin Zone', icon: <ShieldAlert size={NAV_ICON_SIZE}/>, isAdmin: true });
    }

    return items;
  }, [userAccess?.permissions?.adminPanel]);

  const scrollWindowToTopInstant = () => {
    try {
      window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    } catch {
      window.scrollTo(0, 0);
    }
  };

  const handleLogoClick = () => {
    setActiveTab('home');
    setMobileOpen(false);
    scrollWindowToTopInstant();
  };

  const isDesktopExpanded = isExpanded;
  const isFullyExpanded = isDesktopExpanded || isMobileOpen;
  const hasCicloAtivo      = !!(activeCicloId && activeCicloData);
  const hasCronogramaAtivo = !!(activeCronogramaData?.ativo);
  const revisoesPendentesBadge = revisoesInfoCanonicas.total;
  const profileCardData = useMemo(() => {
    const profile = levelData?.profile || {};
    const progressPercent = Math.max(0, Math.min(100, Number(levelData?.progressPercent || 0)));
    const rankCandidate = [
      weeklyRanking.position,
      profile.weeklyPosition,
      profile.weeklyRank,
    ].find((value) => Number.isFinite(Number(value)) && Number(value) > 0);

    const rankValue = rankCandidate ? Number(rankCandidate) : null;
    const rankDisplay = rankValue ? `${rankValue}º` : '--';

    const levelStartXP = Number(levelData?.levelStartXP || 0);
    const nextLevelXP = Number(levelData?.nextLevelXP || levelData?.totalXP || 0);
    const currentXP = Math.max(0, Number(levelData?.totalXP || 0) - levelStartXP);
    const levelRangeXP = Math.max(1, nextLevelXP - levelStartXP);

    return {
      displayName: user?.displayName || user?.email?.split('@')[0] || 'Estudante',
      level: Math.max(1, Number(levelData?.currentLevel || 1)),
      league: levelData?.league || {},
      leagueName: levelData?.leagueName || 'Ferro',
      leagueColor: levelData?.leagueColor || levelData?.league?.color || '#dc2626',
      leagueGlow: levelData?.leagueGlow || levelData?.league?.glow || '#ef4444',
      progressPercent,
      progressLabel: `${Math.round(progressPercent)}%`,
      rankValue,
      rankDisplay,
      rankHint: rankValue ? `Posição #${rankValue} no ranking semanal de tempo` : 'Sem posição definida no ranking',
      currentXP,
      levelRangeXP,
      xpToNextLevel: Math.max(0, Number(levelData?.xpToNextLevel || 0)),
      totalXP: Number(levelData?.totalXP || 0),
    };
  }, [weeklyRanking.position, levelData, user?.displayName, user?.email]);
  const headerStreak = Math.max(0, Number(studyStreakResult?.currentStreak || 0));

  // ── NavButton — agora aceita badgeCount ───────────────────────────────
  const NavButton = ({ label, icon, isActive, isAdmin, isNew, isAtalho, isPlanningGuide, badgeCount, onClick, prefetchId }) => (
    <button
      onPointerEnter={() => prefetchId && onPrefetchTab?.(prefetchId)}
      onFocus={() => prefetchId && onPrefetchTab?.(prefetchId)}
      onClick={(e) => {
        onClick(e);
      }}
      className={`
        relative flex items-center w-full ${NAV_BTN_PAD} ${NAV_BTN_RADIUS} ${isPlanningGuide && !isActive ? 'pr-9' : ''}
        transition-all duration-200 group overflow-hidden whitespace-nowrap
        ${isActive
          ? isAdmin
            ? 'bg-zinc-800 text-red-500 shadow-md ring-1 ring-red-900/20'
            : 'bg-red-600 text-white shadow-lg shadow-red-600/30'
          : 'text-zinc-500 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 hover:text-red-600 dark:hover:text-red-500'
        }
      `}
    >
      {/* Ícone */}
      {isPlanningGuide && !isActive && (
        <>
          <motion.span
            className="pointer-events-none absolute inset-0 rounded-xl border-2 border-red-400"
            animate={{ opacity: [0.15, 0.7, 0.15], scale: [1, 1.035, 1] }}
            transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
          />
          <motion.span
            className="pointer-events-none absolute right-2 top-1/2 hidden h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full bg-red-600 text-white shadow-lg shadow-red-600/30 lg:flex"
            animate={{ x: [0, -6, 0] }}
            transition={{ duration: 1.2, repeat: Infinity, ease: 'easeInOut' }}
          >
            <ArrowRight size={13} strokeWidth={3} />
          </motion.span>
        </>
      )}
      <span className={`flex-shrink-0 relative transition-transform duration-300 ${isActive ? 'scale-110' : 'group-hover:scale-110'}`}>
        {icon}
        {/* Ponto de ativo/atalho quando collapsed */}
        {isAtalho && !isActive && (
          <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-emerald-500 ring-2 ring-white dark:ring-zinc-900"/>
        )}
        {/* Badge numérico no ícone quando sidebar está collapsed */}
        {!isFullyExpanded && !isMobileOpen && !isActive && badgeCount > 0 && (
          <span
            className="absolute -top-1.5 -right-1.5 min-w-[14px] h-[14px] px-0.5 rounded-full flex items-center justify-center text-[8px] font-black text-white"
            style={{ backgroundColor: '#dc2626', lineHeight: 1 }}
          >
            {badgeCount > 99 ? '99+' : badgeCount}
          </span>
        )}
      </span>

      {/* Label */}
      <span className={`${isFullyExpanded ? 'ml-3 opacity-100 translate-x-0' : 'ml-0 opacity-0 -translate-x-4 w-0'} ${NAV_LABEL_SIZE} font-black uppercase tracking-widest transition-all duration-300`}>
        {label}
      </span>

      {/* Badge numérico ao lado do label quando expanded */}
      {isFullyExpanded && !isActive && badgeCount > 0 && (
        <span
          className={`ml-auto flex-shrink-0 ${NAV_BADGE_SIZE} font-black text-white px-1.5 py-0.5 rounded-full`}
          style={{ backgroundColor: '#dc2626' }}
        >
          {badgeCount > 99 ? '99+' : badgeCount}
        </span>
      )}

      {/* Badge "ativo" para atalhos */}
      {/* Badges textuais removidos para manter o menu estreito e limpo. */}
      {isNew && !isFullyExpanded && !isMobileOpen && !isActive && (
        <div className="absolute right-1.5 top-1.5 w-1.5 h-1.5 bg-red-500 rounded-full"/>
      )}

      {/* Ponto pulsante quando ativo e collapsed */}
      {isActive && !isFullyExpanded && !isMobileOpen && (
        <div className="absolute right-1.5 top-1.5 w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse"/>
      )}
    </button>
  );

  const StudyPlanShortcuts = () => (
    <>
      {hasCicloAtivo && (
        <div className="mb-0.5">
          <NavButton
            label="Ciclo semanal"
            icon={<RotateCw size={NAV_ICON_SIZE}/>}
            isActive={activeTab === 'ciclos'}
            isAtalho={true}
            onClick={() => {
              setMobileOpen(false);
              if (onGoToCicloAtivo) onGoToCicloAtivo();
              else setActiveTab('ciclos');
            }}
          />
        </div>
      )}
      {hasCronogramaAtivo && (
        <div className="mb-0.5">
          <NavButton
            label="Cronograma"
            icon={<CalendarDays size={NAV_ICON_SIZE}/>}
            isActive={activeTab === 'cronograma'}
            isAtalho={true}
            onClick={() => { setActiveTab('cronograma'); setMobileOpen(false); }}
          />
        </div>
      )}

      {(hasCicloAtivo || hasCronogramaAtivo) && (
        <div className="h-px bg-zinc-100 dark:bg-zinc-800 mx-1 my-1"/>
      )}
    </>
  );

  const TopBar = () => (
    <div
      className="fixed top-0 left-0 right-0 h-[64px] z-[60] bg-white/90 dark:bg-card-dark/95 backdrop-blur-md border-b border-zinc-200/80 dark:border-white/10 flex items-center justify-between px-2 sm:px-4 shadow-xs"
    >
      {/* Canto superior esquerdo: Perfil do usuário (visível no desktop) e menu mobile */}
      <div className="flex items-center gap-2 z-20">
        <button
          onClick={() => setMobileOpen(true)}
          className="lg:hidden p-2 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl transition-colors"
          aria-label="Abrir menu"
          title="Abrir menu"
        >
          <Menu size={22}/>
        </button>

        <button
          type="button"
          onClick={() => { setActiveTab('profile'); setMobileOpen(false); scrollWindowToTopInstant(); }}
          className="hidden lg:flex group/profile items-center gap-2.5 rounded-2xl p-1 text-left transition-all hover:bg-zinc-100/80 dark:hover:bg-zinc-800/60 active:scale-95"
          title="Abrir meu perfil"
        >
          <div className="relative shrink-0">
            <ProfileLevelRing userPhotoURL={user?.photoURL} levelData={levelData} size={44} strokeWidth={2.8}/>
          </div>
          <div className="flex flex-col min-w-0">
            {/* Linha 1: Nome do usuário + Badge de Assinatura/Trial */}
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="truncate text-xs sm:text-sm font-black leading-tight text-zinc-950 dark:text-white group-hover/profile:text-red-600 transition-colors">
                {profileCardData.displayName}
              </span>
              <TrialStatusBadge
                subscription={userAccess?.subscription}
                monetizationConfig={monetizationConfig}
                size="sm"
              />
            </div>

            {/* Linha 2: Troféu + Posição no Ranking */}
            <div className="flex items-center gap-1.5 text-xs font-bold text-zinc-700 dark:text-zinc-200 mt-0.5">
              <Trophy size={13} className="text-amber-500 shrink-0" />
              <span>{profileCardData.rankDisplay}</span>
            </div>

            {/* Linha 3: Barra de Progresso de XP + Texto XP */}
            <div className="flex items-center gap-2 mt-1">
              <div className="h-1.5 w-16 sm:w-20 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-700">
                <div
                  className="h-full rounded-full bg-red-600 transition-[width] duration-500"
                  style={{ width: `${profileCardData.progressPercent}%` }}
                />
              </div>
              <span className="text-[9px] sm:text-[10px] font-bold text-zinc-600 dark:text-zinc-300 whitespace-nowrap">
                {profileCardData.currentXP}/{profileCardData.levelRangeXP} XP
              </span>
            </div>
          </div>
        </button>
      </div>

      {/* Centro: Logo MODOQAP única */}
      <div
        onClick={handleLogoClick}
        className="absolute left-1/2 -translate-x-1/2 cursor-pointer z-10 group select-none flex items-center gap-2"
        title="Ir para a Home"
      >
        <h1 className="text-red-600 font-black tracking-[0.12em] sm:tracking-[0.18em] uppercase text-base sm:text-xl whitespace-nowrap transition-all duration-300 group-hover:scale-105 group-active:scale-95 drop-shadow-sm">
          MODOQAP
        </h1>
      </div>

      {/* Canto superior direito: Streak, Notificações, Tema e Menu de Opções da Conta */}
      <div className="flex items-center gap-1.5 sm:gap-2 z-20">
        <StreakHeaderPill streak={headerStreak} />
        {notificationProps && (
          <NotificationBell
            unreadCount={notificationProps.unreadCount}
            notifications={notificationProps.notifications}
            readBroadcasts={notificationProps.readBroadcasts}
            dismissedHistory={notificationProps.dismissedHistory}
            onMarkBroadcastRead={notificationProps.onMarkBroadcastRead}
            onMarkOperationalRead={notificationProps.onMarkOperationalRead}
            onRespondGroupRequest={notificationProps.onRespondGroupRequest}
            onMarkAllRead={notificationProps.onMarkAllRead}
            onApplyEditalUpdate={notificationProps.onApplyEditalUpdate}
            onDismissEditalUpdate={notificationProps.onDismissEditalUpdate}
            loadingUpdate={notificationProps.loadingNotif}
            onNavigateToEdital={notificationProps.onNavigateToEdital}
            onOpenGroupChat={notificationProps.onOpenGroupChat}
            onOpenSupport={notificationProps.onOpenSupport || ((ticketId) => onOpenFeedback?.({ ticketId }))}
            systemAlerts={systemAlerts}
            onSystemAlertAction={handleSystemAlertAction}
            bellRef={bellContainerRef}
          />
        )}
        {ENABLE_FLOATING_STUDY_REMINDER && (
          <StudyReminderPill
            statusEstudo={reminderStatusEstudo}
            revisoesInfo={reminderRevisoesInfo}
            onNavigate={handleReminderNavigate}
            isVisible={showReminderPill}
            onDismiss={handleReminderDismiss}
            bellContainerRef={bellContainerRef}
          />
        )}
        <button
          onClick={toggleTheme}
          className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 hover:text-red-600 border border-zinc-200 dark:border-zinc-800 shadow-xs flex items-center justify-center transition-all active:scale-95"
          aria-label="Alternar tema"
          title={isDarkMode ? 'Modo claro' : 'Modo escuro'}
        >
          {isDarkMode ? <Sun size={16} strokeWidth={2.2}/> : <Moon size={16} strokeWidth={2.2}/>}
        </button>

        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setIsProfileMenuOpen(v => !v)}
            className="outline-none active:scale-95 transition-transform flex items-center justify-center rounded-xl p-1 hover:bg-zinc-100 dark:hover:bg-zinc-800"
            title="Menu da conta"
            aria-label="Menu da conta"
          >
            <ProfileLevelRing userPhotoURL={user?.photoURL} levelData={levelData} size={38} strokeWidth={2.5}/>
          </button>

          <AnimatePresence>
            {isProfileMenuOpen && (
              <motion.div
                initial={{ opacity:0, y:10, scale:0.95 }}
                animate={{ opacity:1, y:0, scale:1 }}
                exit={{ opacity:0, y:10, scale:0.95 }}
                className="absolute right-0 top-full mt-2 w-60 overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-2xl shadow-zinc-950/10 ring-1 ring-black/5 dark:border-zinc-700 dark:bg-card-dark dark:ring-white/5 sm:w-64 z-[100]"
              >
                <div className="relative flex min-h-[178px] flex-col items-center justify-end overflow-hidden border-b border-zinc-200 bg-zinc-50 px-4 pb-3 pt-4 dark:border-zinc-700 dark:bg-zinc-800/45">
                  {coverURL && (
                    <img
                      src={coverURL}
                      alt=""
                      aria-hidden="true"
                      className="pointer-events-none absolute inset-0 h-full w-full object-cover"
                      style={{ objectPosition: coverPositionToStyle(coverPosition) }}
                    />
                  )}
                  {coverURL && <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/25 via-black/45 to-black/80" />}
                  {!coverURL && !coverLoading && <div className="pointer-events-none absolute -top-16 left-1/2 h-40 w-40 -translate-x-1/2 rounded-full bg-zinc-400/15 blur-3xl dark:bg-white/5"/>}
                  {coverLoading && <div className="pointer-events-none absolute inset-0 animate-pulse bg-zinc-200 dark:bg-zinc-800" />}
                  <div className="pointer-events-none absolute left-0 right-0 top-0 h-0.5 bg-red-600/70"/>
                  <motion.div
                    animate={{ scale: [1, 1.12, 1], opacity: [0.35, 0.55, 0.35] }}
                    transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
                    className="pointer-events-none absolute top-8 h-20 w-20 rounded-full bg-zinc-400/10 blur-2xl dark:bg-white/5"
                  />
                  <div
                    className="relative z-10 mb-2 cursor-pointer drop-shadow-xl transition-transform duration-500 hover:scale-105"
                    onClick={() => { setActiveTab('profile'); setIsProfileMenuOpen(false); }}
                  >
                    <div className="rounded-full bg-white/80 p-1 shadow-xl shadow-zinc-900/10 ring-4 ring-zinc-200/80 dark:bg-card-dark dark:ring-zinc-700/80">
                      <ProfileLevelRing userPhotoURL={user?.photoURL} levelData={levelData} size={56} strokeWidth={3.5}/>
                    </div>
                  </div>
                  <h3 className={`relative z-10 mb-1 w-full truncate text-center text-sm font-black leading-tight tracking-tight ${coverURL ? 'text-white drop-shadow-md' : 'text-zinc-950 dark:text-white'}`}>
                    {user?.displayName || 'Guerreiro'}
                  </h3>
                  <div className="relative z-10 flex items-center justify-center gap-1.5 mb-1.5 flex-wrap">
                    <TrialStatusBadge
                      subscription={userAccess?.subscription}
                      monetizationConfig={monetizationConfig}
                      size="sm"
                    />
                  </div>
                  <div className={`relative z-10 rounded-full px-2.5 py-0.5 text-[8px] font-black uppercase tracking-[0.18em] shadow-sm ${coverURL ? 'border border-white/25 bg-black/35 text-white backdrop-blur-sm' : 'border border-zinc-200 bg-white/75 text-zinc-600 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-300'}`}>
                    Nível {levelData?.currentLevel || 1}{LEAGUES_ENABLED ? ` · Liga ${levelData?.leagueName || 'Ferro'}` : ''}
                  </div>
                  <div className="relative z-10 mt-2 h-1.5 w-full overflow-hidden rounded-full bg-black/15 dark:bg-white/10">
                    <div className="h-full rounded-full bg-red-600" style={{ width: `${Math.max(0, Math.min(100, levelData?.progressPercent || 0))}%` }}/>
                  </div>
                  <div className={`relative z-10 mt-1 flex w-full items-center justify-between text-[8px] font-black uppercase tracking-wider ${coverURL ? 'text-white/80' : 'text-zinc-500 dark:text-zinc-400'}`}>
                    <span>{levelData?.totalXP || 0} XP</span>
                    <span className="max-w-[130px] truncate">{levelData?.mainGroupName || 'Sem grupo principal'}</span>
                  </div>
                </div>

                <div className="space-y-1 bg-white p-2 dark:bg-card-dark">
                  <button
                    onClick={() => { setActiveTab('profile'); setIsProfileMenuOpen(false); }}
                    className="group flex w-full items-center justify-between rounded-xl border border-transparent px-3 py-2 text-xs font-bold text-zinc-700 transition-all hover:border-zinc-200 hover:bg-zinc-100 hover:text-zinc-950 dark:text-zinc-300 dark:hover:border-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-white"
                  >
                    <div className="flex items-center gap-4">
                      <div className="rounded-lg bg-zinc-100 p-1.5 text-zinc-600 transition-all group-hover:bg-zinc-200 group-hover:text-zinc-900 dark:bg-zinc-800 dark:text-zinc-300 dark:group-hover:bg-zinc-700 dark:group-hover:text-white">
                        <Settings size={16}/>
                      </div>
                      <span>Configurações</span>
                    </div>
                    <ChevronRight size={16} className="text-zinc-300 group-hover:text-zinc-500"/>
                  </button>

                  <button
                    onClick={() => { setActiveTab('conquistas'); setIsProfileMenuOpen(false); }}
                    className="group flex w-full items-center justify-between rounded-xl border border-transparent px-3 py-2 text-xs font-bold text-zinc-700 transition-all hover:border-zinc-200 hover:bg-zinc-100 hover:text-zinc-950 dark:text-zinc-300 dark:hover:border-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-white"
                  >
                    <div className="flex items-center gap-4">
                      <div className="rounded-lg bg-zinc-100 p-1.5 text-zinc-600 transition-all group-hover:bg-amber-100 group-hover:text-amber-700 dark:bg-zinc-800 dark:text-zinc-300 dark:group-hover:bg-amber-950/40 dark:group-hover:text-amber-300">
                        <Award size={16}/>
                      </div>
                      <span>Conquistas</span>
                    </div>
                    <ChevronRight size={16} className="text-zinc-300 group-hover:text-zinc-500"/>
                  </button>

                  <button
                    onClick={() => { onOpenFeedback(); setIsProfileMenuOpen(false); }}
                    className="group flex w-full items-center justify-between rounded-xl border border-transparent px-3 py-2 text-xs font-bold text-zinc-700 transition-all hover:border-zinc-200 hover:bg-zinc-100 hover:text-zinc-950 dark:text-zinc-300 dark:hover:border-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-white"
                  >
                    <div className="flex items-center gap-4">
                      <div className="relative rounded-lg bg-zinc-100 p-1.5 text-zinc-600 transition-all group-hover:bg-zinc-200 group-hover:text-zinc-900 dark:bg-zinc-800 dark:text-zinc-300 dark:group-hover:bg-zinc-700 dark:group-hover:text-white">
                        <Radio size={16} className={hasUnreadSupport ? 'animate-pulse' : ''}/>
                        {hasUnreadSupport && (
                          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full border-2 border-white dark:border-zinc-900"/>
                        )}
                      </div>
                      <span>Suporte</span>
                    </div>
                    <ChevronRight size={16} className="text-zinc-300 group-hover:text-zinc-500"/>
                  </button>

                  <div className="mx-4 h-px bg-zinc-200 dark:bg-zinc-700"/>

                  <button
                    onClick={handleLogout}
                    className="group flex w-full items-center rounded-xl px-3 py-2 text-xs font-bold text-zinc-600 transition-all hover:bg-zinc-100 hover:text-red-600 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-red-400"
                  >
                    <div className="flex items-center gap-4">
                      <div className="rounded-lg bg-zinc-100 p-1.5 text-zinc-600 transition-all group-hover:bg-red-600 group-hover:text-white dark:bg-zinc-800 dark:text-zinc-300">
                        <LogOut size={16}/>
                      </div>
                      <span>Sair do Sistema</span>
                    </div>
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {TopBar()}
      <div
        className={`fixed inset-0 bg-black/60 z-[70] lg:hidden backdrop-blur-sm transition-opacity duration-300 ${isMobileOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
        onClick={() => setMobileOpen(false)}
      />
      <nav
        className={`
          fixed bottom-0 z-[50] flex flex-col
          bg-white dark:bg-card-dark border-r border-zinc-200 dark:border-white/10
          transition-all duration-300 shadow-2xl lg:shadow-none
          ${isMobileOpen ? 'top-0 translate-x-0 w-[260px] z-[80]' : '-translate-x-full lg:translate-x-0'}
          lg:top-[64px] lg:left-0 ${isDesktopExpanded ? 'lg:w-[208px]' : 'lg:w-[64px]'}
        `}
      >
        {/* Cabeçalho do menu mobile com Perfil Completo */}
        <div className="lg:hidden shrink-0 border-b border-zinc-100 dark:border-zinc-800/80 p-3 bg-zinc-50/70 dark:bg-zinc-900/50">
          <div className="flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => {
                setActiveTab('profile');
                setMobileOpen(false);
                scrollWindowToTopInstant();
              }}
              className="group/mobprofile flex items-center gap-2.5 flex-1 min-w-0 text-left rounded-xl p-1 -m-1 transition-all hover:bg-zinc-100/80 dark:hover:bg-zinc-800/60 active:scale-[0.98]"
              title="Abrir meu perfil"
            >
              <div className="relative shrink-0">
                <ProfileLevelRing userPhotoURL={user?.photoURL} levelData={levelData} size={44} strokeWidth={2.8}/>
              </div>
              <div className="flex flex-col min-w-0 flex-1">
                {/* Linha 1: Nome do usuário + Badge de Assinatura/Trial */}
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="truncate text-xs font-black leading-tight text-zinc-950 dark:text-white group-hover/mobprofile:text-red-600 transition-colors">
                    {profileCardData.displayName}
                  </span>
                  <TrialStatusBadge
                    subscription={userAccess?.subscription}
                    monetizationConfig={monetizationConfig}
                    size="sm"
                  />
                </div>

                {/* Linha 2: Troféu + Posição no Ranking */}
                <div className="flex items-center gap-1.5 text-xs font-bold text-zinc-700 dark:text-zinc-200 mt-0.5">
                  <Trophy size={13} className="text-amber-500 shrink-0" />
                  <span>{profileCardData.rankDisplay}</span>
                </div>

                {/* Linha 3: Barra de Progresso de XP + Texto XP */}
                <div className="flex items-center gap-2 mt-1">
                  <div className="h-1.5 flex-1 max-w-[84px] overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-700">
                    <div
                      className="h-full rounded-full bg-red-600 transition-[width] duration-500"
                      style={{ width: `${profileCardData.progressPercent}%` }}
                    />
                  </div>
                  <span className="text-[9px] font-bold text-zinc-600 dark:text-zinc-300 whitespace-nowrap">
                    {profileCardData.currentXP}/{profileCardData.levelRangeXP} XP
                  </span>
                </div>
              </div>
            </button>

            {/* Botão de Fechar o Menu Mobile */}
            <button
              type="button"
              onClick={() => setMobileOpen(false)}
              className="p-1.5 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl transition-colors shrink-0"
              aria-label="Fechar menu"
              title="Fechar menu"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Botão de alternância flutuante posicionado do lado de FORA na borda direita, alinhado com a HOME */}
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="hidden lg:flex absolute -right-3.5 top-3.5 z-[60] h-7 w-7 items-center justify-center rounded-full bg-white dark:bg-zinc-900 border border-zinc-200/90 dark:border-zinc-700/80 text-zinc-500 hover:text-red-600 dark:text-zinc-400 dark:hover:text-red-400 shadow-md hover:shadow-lg transition-all duration-200 hover:scale-110 active:scale-95 cursor-pointer"
          title={isDesktopExpanded ? "Recolher menu lateral" : "Expandir menu lateral"}
          aria-label={isDesktopExpanded ? "Recolher menu lateral" : "Expandir menu lateral"}
        >
          {isDesktopExpanded ? (
            <ChevronLeft size={15} strokeWidth={2.5} />
          ) : (
            <ChevronRight size={15} strokeWidth={2.5} />
          )}
        </button>

        <div className={`nav-sidebar-content-zoom min-h-0 flex-1 overflow-y-auto px-2.5 pb-3 pt-3 ${NAV_GAP}`} style={{scrollbarWidth:'none'}}>
          {navItems.map((item) => {
            if (item.subItems) {
              const isActiveParent = item.subItems.some(sub => sub.id === activeTab);
              return (
                <div key={item.id} className="flex flex-col w-full">
                  <button
                    onClick={() => {
                      setIsPlanejamentoOpen(v => !v);
                    }}
                    className={`
                      relative flex items-center justify-between w-full ${NAV_BTN_PAD} ${NAV_BTN_RADIUS}
                      transition-all duration-200 group overflow-hidden whitespace-nowrap
                      ${isActiveParent && !isPlanejamentoOpen
                        ? 'bg-red-50 dark:bg-red-900/10 text-red-600 shadow-sm'
                        : 'text-zinc-500 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 hover:text-red-600 dark:hover:text-red-500'
                      }
                    `}
                  >
                    <div className="flex items-center">
                      <span className={`flex-shrink-0 transition-transform duration-300 ${isActiveParent ? 'scale-110' : 'group-hover:scale-110'}`}>
                        {item.icon}
                      </span>
                      <span className={`${isFullyExpanded ? 'ml-3 opacity-100 translate-x-0' : 'ml-0 opacity-0 -translate-x-4 w-0'} ${NAV_LABEL_SIZE} font-black uppercase tracking-widest transition-all duration-300`}>
                        {item.label}
                      </span>
                    </div>
                    {isFullyExpanded && (
                      <ChevronDown size={14} className={`transition-transform duration-300 flex-shrink-0 ${isPlanejamentoOpen ? 'rotate-180' : ''}`}/>
                    )}
                    {isActiveParent && !isFullyExpanded && !isMobileOpen && (
                      <div className="absolute right-1.5 top-1.5 w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse"/>
                    )}
                  </button>

                  <AnimatePresence>
                    {isPlanejamentoOpen && (
                      <motion.div
                        initial={{ opacity:0, height:0 }}
                        animate={{ opacity:1, height:'auto' }}
                        exit={{ opacity:0, height:0 }}
                        className={`flex flex-col gap-0.5 overflow-hidden ${isFullyExpanded ? 'pl-3' : 'pl-0'}`}
                      >
                        {item.subItems.map((sub) => {
                          const isSubActive = activeTab === sub.id;
                          return (
                            <button
                              key={sub.id}
                              onClick={() => { setActiveTab(sub.id); setMobileOpen(false); }}
                              className={`
                                relative flex items-center w-full ${NAV_BTN_PAD} ${NAV_BTN_RADIUS}
                                transition-all duration-200 group overflow-hidden whitespace-nowrap
                                ${isSubActive
                                  ? 'bg-red-600 text-white shadow-lg shadow-red-600/30'
                                  : 'text-zinc-500 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 hover:text-red-600 dark:hover:text-red-500'
                                }
                              `}
                            >
                              <span className={`flex-shrink-0 transition-transform duration-300 ${isSubActive ? 'scale-110' : 'group-hover:scale-110'}`}>
                                {sub.icon}
                              </span>
                              <span className={`${isFullyExpanded ? 'ml-3 opacity-100 translate-x-0' : 'ml-0 opacity-0 -translate-x-4 w-0'} ${NAV_LABEL_SIZE} font-black uppercase tracking-widest transition-all duration-300`}>
                                {sub.label}
                              </span>
                              {isSubActive && !isFullyExpanded && !isMobileOpen && (
                                <div className="absolute right-1.5 top-1.5 w-1.5 h-1.5 bg-white rounded-full animate-pulse"/>
                              )}
                            </button>
                          );
                        })}
                      </motion.div>
                    )}
                  </AnimatePresence>
                  {item.id === 'planejamento' && <StudyPlanShortcuts />}
                </div>
              );
            }

            const isActive = activeTab === item.id;
            return (
              <React.Fragment key={item.id}>
                <NavButton
                  label={item.label}
                  icon={item.icon}
                  isActive={isActive}
                  isAdmin={item.isAdmin}
                  isNew={item.isNew}
                  isPlanningGuide={shouldGuidePlanning && item.id === 'planejamento'}
                  // Passa o badge apenas para o item de revisões
                  badgeCount={item.id === 'revisoes' ? revisoesPendentesBadge : 0}
                  prefetchId={item.id}
                  onClick={() => {
                    setActiveTab(item.id);
                    setMobileOpen(false);
                    if (item.id === 'home') scrollWindowToTopInstant();
                  }}
                />
                {item.id === 'planejamento' && <StudyPlanShortcuts />}
              </React.Fragment>
            );
          })}
        </div>

        <div className="nav-sidebar-content-zoom shrink-0 border-t border-zinc-100 bg-white p-2 dark:border-zinc-800 dark:bg-card-dark">
          <InstallAppButton
            expanded={isFullyExpanded}
            onNavigate={() => setMobileOpen(false)}
          />
          <div className="h-1" />
          <button
            type="button"
            onClick={() => {
              onOpenFeedback?.({ initialView: 'home' });
              setMobileOpen(false);
            }}
            className={`group relative flex w-full items-center overflow-hidden rounded-xl border transition-all ${
              hasUnreadSupport
                ? 'border-red-200 bg-red-50/80 text-red-700 shadow-sm dark:border-red-900/40 dark:bg-red-950/20 dark:text-red-300'
                : 'border-transparent bg-transparent text-zinc-500 hover:border-zinc-200 hover:bg-zinc-50 hover:text-red-600 dark:text-zinc-400 dark:hover:border-zinc-800 dark:hover:bg-zinc-900 dark:hover:text-red-400'
            } ${isFullyExpanded ? 'gap-2.5 px-2.5 py-2' : 'justify-center px-2 py-2'}`}
            title="Abrir suporte"
          >
            <span className={`relative flex h-7 w-7 shrink-0 items-center justify-center rounded-lg transition-all ${
              hasUnreadSupport
                ? 'bg-red-600 text-white shadow-md shadow-red-600/20'
                : 'bg-zinc-100 text-zinc-500 group-hover:bg-red-600 group-hover:text-white dark:bg-zinc-800 dark:text-zinc-400'
            }`}>
              <HelpCircle size={16} strokeWidth={2.5} />
              {hasUnreadSupport && (
                <span className="absolute -right-0.5 -top-0.5 h-3 w-3 rounded-full border-2 border-white bg-red-400 dark:border-zinc-900" />
              )}
            </span>
            {isFullyExpanded && (
              <span className="min-w-0 text-left">
                <span className="block text-[9px] font-black uppercase tracking-[0.16em]">
                  {hasUnreadSupport ? 'Suporte respondeu' : 'Suporte'}
                </span>
                <span className="mt-0.5 block text-[9px] font-bold opacity-65">
                  Dúvidas e problemas
                </span>
              </span>
            )}
          </button>
        </div>
      </nav>
    </>
  );
}

export default NavSideBar;
