import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  Home, Target, Calendar, LogOut, RefreshCw, Menu, ShieldAlert,
  LayoutList, BarChart3, ClipboardList, Sun, Moon, User, Radio, X, ChevronRight,
  CalendarClock, Layers, ChevronDown, Newspaper, RotateCw, CalendarDays, BookOpen,
  Clock, AlertTriangle, ArrowRight, Bell, Flame, Settings,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../../firebaseConfig';
import ProfileLevelRing from '../gamification/ProfileLevelRing';
import { NotificationBell } from '../shared/NotificationPanel';
import { contarRevisoesPendentes } from '../../pages/RevisaoPage';
import { calcularStatusEstudoHoje, contarRevisoesPendentesHoje } from '../../hooks/useCronogramaSystem';
import { buildStudyDaysMap, calculateCurrentStudyStreak } from '../../utils/studyDayStatus';
import { getAgendaSemana } from '../../services/scheduling/review';
import TimerSettingsModal, { useTimerSettings } from '../ciclos/StudyTimer/TimerSettingsModal';

const NAV_ICON_SIZE  = 20;
const NAV_LABEL_SIZE = 'text-xs';
const NAV_BTN_PAD    = 'p-2.5';
const NAV_BTN_RADIUS = 'rounded-xl';
const NAV_GAP        = 'space-y-1';
const NAV_BADGE_SIZE = 'text-[8px]';
const ENABLE_FLOATING_STUDY_REMINDER = false;

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
      className="fixed z-[9999] w-72 overflow-hidden rounded-3xl border border-zinc-200 bg-white p-6 shadow-2xl dark:border-zinc-800 dark:bg-zinc-950"
    >
      {/* Fundo Decorativo */}
      <div className="absolute inset-0 bg-gradient-to-b from-orange-500/5 to-transparent dark:from-orange-500/10 pointer-events-none" />
      
      <div className="relative z-10 flex flex-col items-center text-center">
        {/* Grande Chama Animada */}
        <div className="relative mb-6 flex h-32 w-32 items-center justify-center">
          {/* Brilhos de fundo da chama */}
          <motion.div
            animate={{ scale: [1, 1.4, 1], opacity: [0.2, 0.4, 0.2] }}
            transition={{ duration: 3, repeat: Infinity }}
            className="absolute inset-0 rounded-full bg-orange-500/20 blur-2xl"
          />
          <motion.div
            animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0.5, 0.3] }}
            transition={{ duration: 2, repeat: Infinity, delay: 0.5 }}
            className="absolute h-20 w-20 rounded-full bg-red-500/20 blur-xl"
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
              size={80} 
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

        <h4 className="text-sm font-black uppercase tracking-widest text-zinc-400 dark:text-zinc-500">
          Sequência de Estudo
        </h4>
        
        <div className="mt-1 flex items-baseline gap-2">
          <span className={`text-6xl font-black tabular-nums ${
            streak > 0 
              ? 'bg-gradient-to-br from-red-600 to-orange-500 bg-clip-text text-transparent dark:from-red-500 dark:to-orange-400' 
              : 'text-zinc-300 dark:text-zinc-800'
          }`}>
            {streak}
          </span>
          <span className="text-lg font-bold text-zinc-400 dark:text-zinc-600">dias</span>
        </div>

        <p className="mt-4 text-sm font-medium leading-relaxed text-zinc-600 dark:text-zinc-400 px-2">
          {streak === 0 
            ? "Você ainda não começou sua jornada hoje. Vamos ativar o Modo QAP?" 
            : streak < 3 
            ? "O começo de algo grande! Mantenha a constância para fortalecer o hábito." 
            : streak < 7 
            ? "Você está pegando ritmo! Continue assim e verá os resultados em breve."
            : "Incrível! Sua dedicação é inspiradora. Mantenha essa chama acesa!"}
        </p>

        {/* Footer do Card */}
        <div className="mt-8 w-full border-t border-zinc-100 pt-4 dark:border-zinc-800/50">
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
  userAccess,
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
  goalsHistory,
  activeCicloId,
  onShareGoal,
  onOpenFeedback,
  activeCicloData,
  activeCronogramaData,
  onGoToCicloAtivo,
  cicloFinalizacaoAlert,
  cicloLegacyUpgradeAlert,
  notificationProps,
}) {
  const [hasUnreadSupport, setHasUnreadSupport]     = useState(false);
  const [isProfileMenuOpen, setIsProfileMenuOpen]   = useState(false);
  const [isTimerSettingsOpen, setIsTimerSettingsOpen] = useState(false);
  const [isPlanejamentoOpen, setIsPlanejamentoOpen] = useState(false);
  const [homeContextPreferred, setHomeContextPreferred] = useState(() => {
    try { return localStorage.getItem('homeContextPreferred') || 'cronograma'; } catch { return 'cronograma'; }
  });

  // Pill de lembrete — aparece na Home e some automaticamente
  const [showReminderPill, setShowReminderPill] = useState(false);
  const prevTabRef = useRef(null);
  const reminderTimerRef = useRef(null);
  const reminderDismissedRef = useRef(false);
  const reminderShownKeyRef = useRef(null);
  const bellContainerRef = useRef(null);
  const { updateSettings } = useTimerSettings(user?.uid);

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

  useEffect(() => {
    const updatePreferredContext = (event) => {
      const nextValue = event?.detail || localStorage.getItem('homeContextPreferred') || 'cronograma';
      setHomeContextPreferred(nextValue);
    };
    window.addEventListener('home-context-preferred-change', updatePreferredContext);
    window.addEventListener('storage', updatePreferredContext);
    return () => {
      window.removeEventListener('home-context-preferred-change', updatePreferredContext);
      window.removeEventListener('storage', updatePreferredContext);
    };
  }, []);
  const [revisoesPendentes, setRevisoesPendentes] = useState(0);

  // Cronograma ativo (para alertas de sistema)
  const [cronogramaAtivo, setCronogramaAtivo] = useState(null);
  const cronogramaParaAlertas = cronogramaAtivo || activeCronogramaData || null;

  const menuRef = useRef(null);
  const autoCloseTimerRef = useRef(null);

  // ── Fechamento automático em dispositivos Touch (Tablets/Mobile) ────────
  useEffect(() => {
    // Função para limpar o timer
    const clearTimer = () => {
      if (autoCloseTimerRef.current) {
        clearTimeout(autoCloseTimerRef.current);
        autoCloseTimerRef.current = null;
      }
    };

    // Só inicia o timer se estiver expandido E não for hover (dispositivos touch)
    if (isExpanded) {
      clearTimer();
      autoCloseTimerRef.current = setTimeout(() => {
        // Verifica se ainda está expandido antes de fechar
        setExpanded(false);
      }, 5000);
    }

    // Listener para resetar o timer ao tocar em qualquer lugar do menu
    const handleTouch = () => {
      if (isExpanded) {
        clearTimer();
        autoCloseTimerRef.current = setTimeout(() => setExpanded(false), 5000);
      }
    };

    const el = menuRef.current;
    if (el) el.addEventListener('touchstart', handleTouch);

    return () => {
      clearTimer();
      if (el) el.removeEventListener('touchstart', handleTouch);
    };
  }, [isExpanded, setExpanded]);

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
      where('unreadUser', '==', true)
    );
    const unsub = onSnapshot(q, (snap) => setHasUnreadSupport(!snap.empty));
    return () => unsub();
  }, [user]);

  // ── Escuta cronograma ativo para calcular badge de revisões ────────────
  useEffect(() => {
    if (!user?.uid) return;

    const q = query(
      collection(db, 'users', user.uid, 'cronogramas'),
      where('ativo', '==', true)
    );

    const unsub = onSnapshot(q, (snap) => {
      if (!snap.empty) {
        const cronograma = { id: snap.docs[0].id, ...snap.docs[0].data() };
        setCronogramaAtivo(cronograma);
        setRevisoesPendentes(contarRevisoesPendentes(cronograma));
      } else {
        setCronogramaAtivo(null);
        setRevisoesPendentes(0);
      }
    });

    return () => unsub();
  }, [user?.uid]);

  // ── Alertas inteligentes de sistema ──────────────────────────────────
  const systemAlerts = useMemo(() => {
    const alerts = [];
    if (cicloFinalizacaoAlert) alerts.push(cicloFinalizacaoAlert);
    if (cicloLegacyUpgradeAlert) alerts.push(cicloLegacyUpgradeAlert);
    if (!cronogramaParaAlertas) return alerts;

    const statusEstudo = calcularStatusEstudoHoje(cronogramaParaAlertas);
    const revisoesInfo = contarRevisoesPendentesHoje(cronogramaParaAlertas);

    if (statusEstudo.temEstudoHoje && statusEstudo.progressoHoje === 0) {
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
  }, [cronogramaParaAlertas, cicloFinalizacaoAlert, cicloLegacyUpgradeAlert]);

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
    if (!cronogramaParaAlertas) return null;
    return contarRevisoesPendentesHoje(cronogramaParaAlertas);
  }, [cronogramaParaAlertas]);

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
      { id: 'noticias',  label: 'Notícias',   icon: <Newspaper size={NAV_ICON_SIZE}/>,    isNew: true },
      { id: 'home',      label: 'Home',        icon: <Home size={NAV_ICON_SIZE}/> },
      { id: 'planejamento', label: 'Planejamento', icon: <Layers size={NAV_ICON_SIZE}/> },
      { id: 'revisoes',  label: 'Revisões',    icon: <BookOpen size={NAV_ICON_SIZE}/> },
      { id: 'edital',    label: 'Edital',      icon: <LayoutList size={NAV_ICON_SIZE}/> },
      { id: 'stats',     label: 'Desempenho',  icon: <BarChart3 size={NAV_ICON_SIZE}/> },
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

  const isFullyExpanded = isExpanded || isMobileOpen;
  const hasCicloAtivo      = !!(activeCicloId && activeCicloData);
  const hasCronogramaAtivo = !!(activeCronogramaData?.ativo);
  const revisoesPendentesBadge = revisoesPendentes || (cronogramaParaAlertas ? contarRevisoesPendentes(cronogramaParaAlertas) : 0);
  const headerStreak = useMemo(() => {
    const studyDaysFull = buildStudyDaysMap(registrosEstudo || []);
    let contextMode = 'all';
    const hasCiclo = !!activeCicloData?.id;
    const hasCronograma = !!activeCronogramaData?.id;
    if (hasCiclo && hasCronograma) contextMode = homeContextPreferred === 'ciclo' ? 'ciclo' : 'cronograma';
    else if (hasCiclo) contextMode = 'ciclo';
    else if (hasCronograma) contextMode = 'cronograma';

    return calculateCurrentStudyStreak({
      studyDaysMap: studyDaysFull,
      goalsHistory,
      activeCronogramaData,
      activeCicloData,
      getAgendaSemana,
      contextMode,
    });
  }, [registrosEstudo, goalsHistory, activeCronogramaData, activeCicloData, homeContextPreferred]);

  // ── NavButton — agora aceita badgeCount ───────────────────────────────
  const NavButton = ({ label, icon, isActive, isAdmin, isNew, isAtalho, badgeCount, onClick }) => (
    <button
      onClick={(e) => {
        setExpanded(true);
        onClick(e);
      }}
      className={`
        relative flex items-center w-full ${NAV_BTN_PAD} ${NAV_BTN_RADIUS}
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
      <span className={`ml-3 ${NAV_LABEL_SIZE} font-black uppercase tracking-widest transition-all duration-300 ${isFullyExpanded ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-4 w-0'}`}>
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
      {isAtalho && isFullyExpanded && !isActive && (
        <span className={`ml-auto flex-shrink-0 ${NAV_BADGE_SIZE} font-black uppercase tracking-wider text-emerald-600 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-900/30 px-1.5 py-0.5 rounded-full`}>
          ativo
        </span>
      )}

      {/* Badge "novo" */}
      {isNew && isFullyExpanded && !isActive && (
        <span className={`ml-auto flex-shrink-0 ${NAV_BADGE_SIZE} font-black uppercase tracking-wider bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 px-1.5 py-0.5 rounded-full`}>
          novo
        </span>
      )}
      {isNew && !isFullyExpanded && !isMobileOpen && !isActive && (
        <div className="absolute right-1.5 top-1.5 w-1.5 h-1.5 bg-red-500 rounded-full"/>
      )}

      {/* Ponto pulsante quando ativo e collapsed */}
      {isActive && !isFullyExpanded && !isMobileOpen && (
        <div className="absolute right-1.5 top-1.5 w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse"/>
      )}
    </button>
  );

  const TopBar = () => (
    <div
      className={`
        fixed top-0 right-0 h-[70px] z-[60]
        bg-white/70 dark:bg-zinc-950/70 backdrop-blur-xl border-b border-white/60 dark:border-white/10
        flex items-center justify-between px-2 sm:px-4 shadow-sm shadow-black/5 dark:shadow-black/30 transition-all duration-300
        left-0 lg:left-[72px]
        ${isExpanded ? 'lg:left-[240px]' : 'lg:left-[72px]'}
      `}
    >
      <div className="flex items-center z-20">
        <button
          onClick={() => setMobileOpen(true)}
          className="lg:hidden p-2 -ml-2 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl transition-colors"
        >
          <Menu size={24}/>
        </button>
      </div>

      <div
        onClick={handleLogoClick}
        className="absolute left-1/2 -translate-x-1/2 cursor-pointer z-0 group select-none"
      >
        <h1 className="text-red-600 font-black tracking-[0.14em] sm:tracking-[0.2em] uppercase text-lg sm:text-2xl whitespace-nowrap transition-all duration-300 group-hover:scale-105 group-active:scale-95 drop-shadow-sm">
          MODOQAP
        </h1>
      </div>

      <div className="flex items-center gap-1 sm:gap-2 z-10">
        <StreakHeaderPill streak={headerStreak} />
        {notificationProps && (
          <NotificationBell
            unreadCount={notificationProps.unreadCount}
            notifications={notificationProps.notifications}
            readBroadcasts={notificationProps.readBroadcasts}
            dismissedHistory={notificationProps.dismissedHistory}
            onMarkBroadcastRead={notificationProps.onMarkBroadcastRead}
            onMarkAllRead={notificationProps.onMarkAllRead}
            onApplyEditalUpdate={notificationProps.onApplyEditalUpdate}
            onDismissEditalUpdate={notificationProps.onDismissEditalUpdate}
            loadingUpdate={notificationProps.loadingNotif}
            onNavigateToEdital={notificationProps.onNavigateToEdital}
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
          className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 hover:text-red-600 border border-zinc-200 dark:border-zinc-800 shadow-sm flex items-center justify-center transition-all active:scale-95"
        >
          {isDarkMode ? <Sun size={17} strokeWidth={2.2}/> : <Moon size={17} strokeWidth={2.2}/>}
        </button>

        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setIsProfileMenuOpen(v => !v)}
            className="outline-none active:scale-95 transition-transform flex items-center justify-center relative scale-[0.72] -mx-[7px] sm:mx-0 sm:scale-100 lg:scale-105"
          >
            <ProfileLevelRing userPhotoURL={user?.photoURL} size={50}/>
          </button>

          <AnimatePresence>
            {isProfileMenuOpen && (
              <motion.div
                initial={{ opacity:0, y:10, scale:0.95 }}
                animate={{ opacity:1, y:0, scale:1 }}
                exit={{ opacity:0, y:10, scale:0.95 }}
                className="absolute right-0 top-full mt-2 sm:mt-3 w-64 sm:w-80 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-2xl sm:rounded-3xl shadow-2xl z-[100] overflow-hidden ring-1 ring-black/5 dark:ring-white/5"
              >
                <div className="relative flex flex-col items-center pt-5 pb-4 px-4 sm:pt-10 sm:pb-8 sm:px-6 overflow-hidden bg-gradient-to-b from-zinc-50 to-white dark:from-zinc-900 dark:to-zinc-950 border-b border-zinc-100 dark:border-zinc-800">
                  <div className="absolute top-0 left-0 right-0 h-32 bg-gradient-to-b from-red-500/5 to-transparent dark:from-red-500/10 pointer-events-none"/>
                  <div
                    className="relative z-10 mb-3 drop-shadow-xl transform hover:scale-105 transition-transform duration-500 cursor-pointer"
                    onClick={() => { setActiveTab('profile'); setIsProfileMenuOpen(false); }}
                  >
                    <ProfileLevelRing userPhotoURL={user?.photoURL} size={76} strokeWidth={3.5}/>
                  </div>
                  <h3 className="relative z-10 font-black text-zinc-900 dark:text-white text-base sm:text-xl text-center leading-tight truncate w-full tracking-tight mb-1">
                    {user?.displayName || 'Guerreiro'}
                  </h3>
                </div>

                <div className="p-2 sm:p-3 space-y-1 sm:space-y-2 bg-white dark:bg-zinc-950">
                  <button
                    onClick={() => { setActiveTab('profile'); setIsProfileMenuOpen(false); }}
                    className="w-full flex items-center justify-between px-3 sm:px-4 py-2.5 sm:py-3.5 rounded-xl sm:rounded-2xl text-sm font-bold text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-900 hover:text-zinc-900 dark:hover:text-white transition-all group border border-transparent hover:border-zinc-200 dark:hover:border-zinc-800"
                  >
                    <div className="flex items-center gap-4">
                      <div className="p-2 rounded-xl bg-zinc-100 dark:bg-zinc-900 text-zinc-500 group-hover:text-red-500 group-hover:bg-red-50 dark:group-hover:bg-red-900/20 transition-all">
                        <User size={18}/>
                      </div>
                      <span>Meu Perfil</span>
                    </div>
                    <ChevronRight size={16} className="text-zinc-300 group-hover:text-zinc-500"/>
                  </button>

                  <button
                    onClick={() => { setIsTimerSettingsOpen(true); setIsProfileMenuOpen(false); }}
                    className="w-full flex items-center justify-between px-3 sm:px-4 py-2.5 sm:py-3.5 rounded-xl sm:rounded-2xl text-sm font-bold text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-900 hover:text-zinc-900 dark:hover:text-white transition-all group border border-transparent hover:border-zinc-200 dark:hover:border-zinc-800"
                  >
                    <div className="flex items-center gap-4">
                      <div className="p-2 rounded-xl bg-zinc-100 dark:bg-zinc-900 text-zinc-500 group-hover:text-red-500 group-hover:bg-red-50 dark:group-hover:bg-red-900/20 transition-all">
                        <Settings size={18}/>
                      </div>
                      <span>Configurações</span>
                    </div>
                    <ChevronRight size={16} className="text-zinc-300 group-hover:text-zinc-500"/>
                  </button>

                  <button
                    onClick={() => { onOpenFeedback(); setIsProfileMenuOpen(false); }}
                    className="w-full flex items-center justify-between px-3 sm:px-4 py-2.5 sm:py-3.5 rounded-xl sm:rounded-2xl text-sm font-bold text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-900 hover:text-zinc-900 dark:hover:text-white transition-all group border border-transparent hover:border-zinc-200 dark:hover:border-zinc-800"
                  >
                    <div className="flex items-center gap-4">
                      <div className="relative p-2 rounded-xl bg-zinc-100 dark:bg-zinc-900 text-zinc-500 group-hover:text-blue-500 group-hover:bg-blue-50 dark:group-hover:bg-blue-900/20 transition-all">
                        <Radio size={18} className={hasUnreadSupport ? 'animate-pulse' : ''}/>
                        {hasUnreadSupport && (
                          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full border-2 border-white dark:border-zinc-900"/>
                        )}
                      </div>
                      <span>Suporte</span>
                    </div>
                    <ChevronRight size={16} className="text-zinc-300 group-hover:text-zinc-500"/>
                  </button>

                  <div className="h-px bg-zinc-100 dark:bg-zinc-900 mx-4"/>

                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center px-3 sm:px-4 py-2.5 sm:py-3.5 rounded-xl sm:rounded-2xl text-sm font-bold text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 transition-all group"
                  >
                    <div className="flex items-center gap-4">
                      <div className="p-2 rounded-xl bg-red-50 dark:bg-red-900/10 text-red-500 group-hover:bg-red-100 dark:group-hover:bg-red-900/30 transition-all">
                        <LogOut size={18}/>
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
      <TopBar/>
      <div
        className={`fixed inset-0 bg-black/60 z-[70] lg:hidden backdrop-blur-sm transition-opacity duration-300 ${isMobileOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
        onClick={() => setMobileOpen(false)}
      />
      <nav
        className={`
          fixed top-0 bottom-0 z-[80] flex h-screen min-h-dvh flex-col
          bg-white dark:bg-zinc-950 border-r border-zinc-200 dark:border-white/10
          transition-all duration-300 shadow-2xl lg:shadow-none
          ${isMobileOpen ? 'translate-x-0 w-[260px]' : '-translate-x-full lg:translate-x-0'}
          lg:left-0 ${isExpanded ? 'lg:w-[240px]' : 'lg:w-[72px]'}
        `}
        onMouseEnter={() => !isMobileOpen && setExpanded(true)}
        onMouseLeave={() => !isMobileOpen && setExpanded(false)}
      >
        <div className="flex-shrink-0 flex items-center justify-between lg:justify-center h-[70px] px-4 border-b border-white/60 dark:border-white/10 lg:border-none">
          <div onClick={handleLogoClick} className="cursor-pointer flex items-center justify-center">
            <img src="/logoModoQAP.png" alt="Logo" className="h-11 w-auto object-contain drop-shadow-sm"/>
          </div>
          <button onClick={() => setMobileOpen(false)} className="lg:hidden p-1.5 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg">
            <X size={18}/>
          </button>
        </div>

        <div className={`flex-1 py-3 px-2.5 ${NAV_GAP} overflow-y-auto`} style={{scrollbarWidth:'none'}}>
          <AnimatePresence>
            {hasCicloAtivo && (
              <motion.div key="atalho-ciclo" initial={{ opacity:0, height:0 }} animate={{ opacity:1, height:'auto' }} exit={{ opacity:0, height:0 }} transition={{ duration:0.2 }} className="mb-0.5">
                <NavButton
                  label="Ciclo de Estudos"
                  icon={<RotateCw size={NAV_ICON_SIZE}/>}
                  isActive={activeTab === 'ciclos'}
                  isAtalho={true}
                  onClick={() => {
                    setMobileOpen(false);
                    if (onGoToCicloAtivo) onGoToCicloAtivo();
                    else setActiveTab('ciclos');
                  }}
                />
              </motion.div>
            )}
          </AnimatePresence>
          <AnimatePresence>
            {hasCronogramaAtivo && (
              <motion.div key="atalho-cronograma" initial={{ opacity:0, height:0 }} animate={{ opacity:1, height:'auto' }} exit={{ opacity:0, height:0 }} transition={{ duration:0.2 }} className="mb-0.5">
                <NavButton
                  label="Cronograma"
                  icon={<CalendarDays size={NAV_ICON_SIZE}/>}
                  isActive={activeTab === 'cronograma'}
                  isAtalho={true}
                  onClick={() => { setActiveTab('cronograma'); setMobileOpen(false); }}
                />
              </motion.div>
            )}
          </AnimatePresence>

          {(hasCicloAtivo || hasCronogramaAtivo) && (
            <div className="h-px bg-zinc-100 dark:bg-zinc-800 mx-1 my-1"/>
          )}

          {navItems.map((item) => {
            if (item.subItems) {
              const isActiveParent = item.subItems.some(sub => sub.id === activeTab);
              return (
                <div key={item.id} className="flex flex-col w-full">
                  <AnimatePresence>
                    {hasCicloAtivo && (
                      <motion.div key="atalho-ciclo" initial={{ opacity:0, height:0 }} animate={{ opacity:1, height:'auto' }} exit={{ opacity:0, height:0 }} transition={{ duration:0.2 }} className="mb-0.5">
                        <NavButton
                          label="Ciclo de Estudos"
                          icon={<RotateCw size={NAV_ICON_SIZE}/>}
                          isActive={activeTab === 'ciclos'}
                          isAtalho={true}
                          onClick={() => {
                            setMobileOpen(false);
                            if (onGoToCicloAtivo) onGoToCicloAtivo();
                            else setActiveTab('ciclos');
                          }}
                        />
                      </motion.div>
                    )}
                  </AnimatePresence>
                  <AnimatePresence>
                    {hasCronogramaAtivo && (
                      <motion.div key="atalho-cronograma" initial={{ opacity:0, height:0 }} animate={{ opacity:1, height:'auto' }} exit={{ opacity:0, height:0 }} transition={{ duration:0.2 }} className="mb-0.5">
                        <NavButton
                          label="Cronograma"
                          icon={<CalendarDays size={NAV_ICON_SIZE}/>}
                          isActive={activeTab === 'cronograma'}
                          isAtalho={true}
                          onClick={() => { setActiveTab('cronograma'); setMobileOpen(false); }}
                        />
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {(hasCicloAtivo || hasCronogramaAtivo) && (
                    <div className="h-px bg-zinc-100 dark:bg-zinc-800 mx-1 my-1"/>
                  )}

                  <button
                    onClick={() => {
                      setIsPlanejamentoOpen(v => !v);
                      setExpanded(true);
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
                      <span className={`ml-3 ${NAV_LABEL_SIZE} font-black uppercase tracking-widest transition-all duration-300 ${isFullyExpanded ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-4 w-0'}`}>
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
                              <span className={`ml-3 ${NAV_LABEL_SIZE} font-black uppercase tracking-widest transition-all duration-300 ${isFullyExpanded ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-4 w-0'}`}>
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
                </div>
              );
            }

            const isActive = activeTab === item.id;
            return (
              <NavButton
                key={item.id}
                label={item.label}
                icon={item.icon}
                isActive={isActive}
                isAdmin={item.isAdmin}
                isNew={item.isNew}
                // Passa o badge apenas para o item de revisões
                badgeCount={item.id === 'revisoes' ? revisoesPendentesBadge : 0}
                onClick={() => {
                  setActiveTab(item.id);
                  setMobileOpen(false);
                  if (item.id === 'home') scrollWindowToTopInstant();
                }}
              />
            );
          })}
        </div>
      </nav>
      <AnimatePresence>
        {isTimerSettingsOpen && (
          <TimerSettingsModal
            isOpen={isTimerSettingsOpen}
            onClose={() => setIsTimerSettingsOpen(false)}
            onSave={updateSettings}
          />
        )}
      </AnimatePresence>
    </>
  );
}

export default NavSideBar;
