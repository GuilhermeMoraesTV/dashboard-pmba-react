import React, { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Users, ChevronDown, ChevronUp, Zap, Coffee,
  PauseCircle, BookOpen, Clock, Activity, Target,
  MoreHorizontal, Play, ClipboardList, AlertCircle,
  Filter, TrendingUp, BarChart3, Eye, Grid
} from 'lucide-react';
import UserProfileModal from '../../components/admin/UserProfileModal';

// --- UTILS ---
const formatClock = (totalSeconds) => {
  const safe = Math.max(0, Number(totalSeconds) || 0);
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const seconds = safe % 60;

  return (
    <span className="font-mono font-semibold tracking-wide tabular-nums">
      {[hours, minutes, seconds].map(v => String(v).padStart(2, '0')).join(':')}
    </span>
  );
};

const toDateSafe = (value) => {
  if (!value) return null;
  if (value?.toDate) return value.toDate();
  if (value instanceof Date) return value;
  const n = Number(value);
  if (!Number.isNaN(n) && n > 0) return new Date(n);
  return null;
};

const toMillisSafe = (value) => {
  const d = toDateSafe(value);
  return d ? d.getTime() : null;
};

// Hook para sincronizar o tempo de cada sessão individualmente
const MAX_TIMER_MS = 7 * 24 * 60 * 60 * 1000;

const isReasonableElapsedMs = (value) => {
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 && n < MAX_TIMER_MS;
};

const getSessionPhase = (session) => session?.phase || (session?.isResting ? 'rest' : 'focus');

const getDisplaySnapshotSeconds = (session) => (
  Math.max(0, Number(session?.displaySecondsSnapshot ?? session?.secondsSnapshot ?? session?.seconds ?? 0) || 0)
);

const getRemoteRunStartedMs = (session, nowMs = Date.now()) => {
  const numericMs = Number(session?.runStartedAtMs);
  if (
    Number.isFinite(numericMs)
    && numericMs > 0
    && numericMs < nowMs + 5 * 60 * 1000
    && numericMs > nowMs - MAX_TIMER_MS
  ) {
    return numericMs;
  }

  return (
    toMillisSafe(session?.runStartedAt)
    || toMillisSafe(session?.actionAt)
    || toMillisSafe(session?.snapshotAt)
    || toMillisSafe(session?.updatedAt)
    || null
  );
};

const getElapsedBaseMsForDisplay = (session, phase) => {
  const mode = session?.mode;
  const isStudyTimer = session?.variant !== 'simulado' && !session?.isSimulado;
  const baseCandidates = phase === 'rest'
    ? [session?.restBaseMs, session?.restElapsedMsSnapshot]
    : (isStudyTimer && mode === 'pomodoro')
      ? [session?.pomoBaseMs, session?.pomodoroElapsedMsSnapshot, session?.focusBaseMs, session?.focusElapsedMsSnapshot]
      : [session?.focusBaseMs, session?.focusElapsedMsSnapshot];

  const firstValid = baseCandidates.find(isReasonableElapsedMs);
  if (firstValid != null) return Math.max(0, Number(firstValid));

  return getDisplaySnapshotSeconds(session) * 1000;
};

const getCountdownTotalSeconds = (session, phase) => {
  if (phase === 'rest') return Math.max(0, Number(session?.restSeconds || 0));
  if (session?.mode === 'pomodoro' && session?.variant !== 'simulado' && !session?.isSimulado) {
    return Math.max(0, Number(session?.pomodoroSeconds || 0));
  }
  if (session?.mode === 'countdown') return Math.max(0, Number(session?.countdownSeconds || session?.initialSeconds || 0));
  return 0;
};

const isCountdownDisplay = (session, phase) => (
  phase === 'rest'
  || (session?.mode === 'pomodoro' && session?.variant !== 'simulado' && !session?.isSimulado)
  || session?.mode === 'countdown'
);

const calculateSyncedSessionSeconds = (session, nowMs = Date.now()) => {
  if (!session) return 0;

  const phase = getSessionPhase(session);
  const isPaused = !!session.isPaused || session.status === 'paused';
  const isFinishedPhase = phase === 'pomodoro_finished' || phase === 'rest_finished';
  const shouldRun = !isPaused && !isFinishedPhase && session.status !== 'finished' && session.status !== 'finishing';
  const baseMs = getElapsedBaseMsForDisplay(session, phase);
  const startedMs = shouldRun ? getRemoteRunStartedMs(session, nowMs) : null;
  const elapsedMs = Math.max(0, baseMs + (startedMs ? Math.max(0, nowMs - startedMs) : 0));

  if (isFinishedPhase) return 0;

  if (isCountdownDisplay(session, phase)) {
    const totalSeconds = getCountdownTotalSeconds(session, phase);
    if (totalSeconds <= 0) return getDisplaySnapshotSeconds(session);
    return Math.floor(Math.max(0, (totalSeconds * 1000) - elapsedMs) / 1000);
  }

  return Math.floor(elapsedMs / 1000);
};

const getSessionSyncKey = (session) => [
  session?.uid || '',
  session?.id || '',
  session?.mode || '',
  getSessionPhase(session),
  session?.status || '',
  session?.isPaused ? 'paused' : 'running',
  Number(session?.actionSeq || 0),
  Number(session?.runStartedAtMs || 0),
].join('|');

const useAdminSyncedSeconds = (session) => {
  const [live, setLive] = useState(() => calculateSyncedSessionSeconds(session));
  const stateRef = useRef({ key: null, value: 0 });

  useEffect(() => {
    const key = getSessionSyncKey(session);
    const countdownLike = isCountdownDisplay(session, getSessionPhase(session));

    const update = () => {
      const next = calculateSyncedSessionSeconds(session);
      const sameRun = stateRef.current.key === key;
      const isPaused = !!session?.isPaused || session?.status === 'paused';
      let stableNext = next;

      if (sameRun && !isPaused) {
        stableNext = countdownLike
          ? Math.min(stateRef.current.value, next)
          : Math.max(stateRef.current.value || 0, next);
      }

      stateRef.current = { key, value: stableNext };
      setLive(stableNext);
    };

    update();
    if (!session || session.isPaused || session.status === 'paused') return undefined;
    const intervalId = setInterval(update, 250);
    return () => clearInterval(intervalId);
  }, [
    session?.uid,
    session?.id,
    session?.mode,
    session?.phase,
    session?.status,
    session?.isPaused,
    session?.isResting,
    session?.actionSeq,
    session?.runStartedAtMs,
    session?.runStartedAt,
    session?.focusBaseMs,
    session?.pomoBaseMs,
    session?.restBaseMs,
    session?.focusElapsedMsSnapshot,
    session?.pomodoroElapsedMsSnapshot,
    session?.restElapsedMsSnapshot,
    session?.displaySecondsSnapshot,
    session?.countdownSeconds,
    session?.initialSeconds,
    session?.pomodoroSeconds,
    session?.restSeconds,
    session?.variant,
    session?.isSimulado,
  ]);

  return live;
};

const useSyncedSeconds = (session) => {
  const [live, setLive] = useState(0);

  // Usar um ref para armazenar informações únicas por sessão
  const sessionDataRef = useRef({
    lastUpdateTime: Date.now(), // Última vez que atualizamos o estado
    lastSnapshotTime: 0, // Timestamp do último snapshot do servidor
    lastDisplaySeconds: 0, // Valor do último snapshot
    isCurrentlyPaused: false, // Estado de pausa atual
    intervalId: null, // Intervalo de atualização
    sessionUid: null // UID da sessão para garantir consistência
  });

  // Atualizar o estado quando a sessão mudar
  useEffect(() => {
    if (!session) {
      setLive(0);
      sessionDataRef.current.lastUpdateTime = Date.now();
      sessionDataRef.current.lastSnapshotTime = 0;
      sessionDataRef.current.lastDisplaySeconds = 0;
      sessionDataRef.current.isCurrentlyPaused = false;
      sessionDataRef.current.sessionUid = null;
      return;
    }

    // Verificar se é uma sessão diferente para limpar o intervalo anterior
    if (sessionDataRef.current.sessionUid && sessionDataRef.current.sessionUid !== session.uid) {
      if (sessionDataRef.current.intervalId) {
        clearInterval(sessionDataRef.current.intervalId);
        sessionDataRef.current.intervalId = null;
      }
    }

    sessionDataRef.current.sessionUid = session.uid;

    const isPaused = !!session.isPaused || session.status === 'paused';
    const displaySeconds = Number(session.displaySecondsSnapshot ?? session.secondsSnapshot ?? session.seconds ?? 0);

    // Obter o timestamp do snapshot
    let snapshotTime = 0;
    if (session.snapshotAt) {
      // Se for um timestamp do Firebase, converter para milissegundos
      if (session.snapshotAt?.toDate) {
        const dateObj = session.snapshotAt.toDate();
        if (dateObj && !isNaN(dateObj.getTime())) {
          snapshotTime = dateObj.getTime();
        } else {
          snapshotTime = Date.now(); // fallback
        }
      } else if (typeof session.snapshotAt === 'number') {
        const numValue = Number(session.snapshotAt);
        if (numValue && numValue > 0 && numValue < Date.now() + 86400000) { // não mais que 1 dia no futuro
          snapshotTime = numValue;
        } else {
          snapshotTime = Date.now(); // fallback
        }
      } else {
        snapshotTime = Date.now(); // fallback
      }
    } else {
      snapshotTime = Date.now(); // fallback
    }

    // Validar que o tempo do snapshot é razoável (não muito antigo ou muito no futuro)
    const currentTime = Date.now();
    if (snapshotTime > currentTime + 5000 || snapshotTime < currentTime - 7 * 24 * 60 * 60 * 1000) { // não mais que 7 dias atrás
      snapshotTime = currentTime;
    }

    // Atualizar o estado do ref
    sessionDataRef.current.lastUpdateTime = Date.now();
    sessionDataRef.current.lastSnapshotTime = snapshotTime;
    sessionDataRef.current.lastDisplaySeconds = displaySeconds;
    sessionDataRef.current.isCurrentlyPaused = isPaused;

    // Definir o tempo inicial baseado no estado
    if (isPaused) {
      setLive(displaySeconds);
    } else {
      // Calcular tempo decorrido desde o snapshot
      const timeSinceSnapshot = Math.max(0, (currentTime - snapshotTime) / 1000);
      const calculatedTime = Math.floor(displaySeconds + timeSinceSnapshot);
      setLive(calculatedTime);
    }

  }, [session?.uid, session?.cicloId, session?.createdAt, session?.displaySecondsSnapshot, session?.secondsSnapshot, session?.seconds,
      session?.snapshotAt, session?.timerType, session?.mode, session?.isResting, session?.phase, session?.isPaused, session?.status]);

  // Atualizar o tempo periodicamente se a sessão estiver ativa
  useEffect(() => {
    if (!session) return;

    const isPaused = !!session.isPaused || session.status === 'paused';

    // Limpar intervalo anterior
    if (sessionDataRef.current.intervalId) {
      clearInterval(sessionDataRef.current.intervalId);
      sessionDataRef.current.intervalId = null;
    }

    // Somente iniciar o intervalo se não estiver pausado
    if (!isPaused) {
      // Atualizar o tempo a cada 250ms
      sessionDataRef.current.intervalId = setInterval(() => {
        setLive(prevTime => {
          if (!session) return 0;

          // Verificar se ainda estamos lidando com a mesma sessão
          if (sessionDataRef.current.sessionUid !== session.uid) {
            if (sessionDataRef.current.intervalId) {
              clearInterval(sessionDataRef.current.intervalId);
              sessionDataRef.current.intervalId = null;
            }
            return 0;
          }

          const isNowPaused = !!session.isPaused || session.status === 'paused';
          if (isNowPaused) {
            // Se estiver pausado, usar o tempo do servidor
            const displaySeconds = Number(session.displaySecondsSnapshot ?? session.secondsSnapshot ?? session.seconds ?? 0);
            sessionDataRef.current.lastDisplaySeconds = displaySeconds;
            sessionDataRef.current.isCurrentlyPaused = true;
            return displaySeconds;
          }

          // Calcular tempo decorrido desde o snapshot do servidor
          let snapshotTime = 0;
          if (session.snapshotAt) {
            if (session.snapshotAt?.toDate) {
              const dateObj = session.snapshotAt.toDate();
              if (dateObj && !isNaN(dateObj.getTime())) {
                snapshotTime = dateObj.getTime();
              } else {
                snapshotTime = Date.now();
              }
            } else if (typeof session.snapshotAt === 'number') {
              const numValue = Number(session.snapshotAt);
              if (numValue && numValue > 0 && numValue < Date.now() + 86400000) { // não mais que 1 dia no futuro
                snapshotTime = numValue;
              } else {
                snapshotTime = Date.now();
              }
            } else {
              snapshotTime = Date.now();
            }
          } else {
            snapshotTime = Date.now();
          }

          // Validar que o tempo do snapshot é razoável (não muito antigo ou muito no futuro)
          const currentTime = Date.now();
          if (snapshotTime > currentTime + 5000 || snapshotTime < currentTime - 7 * 24 * 60 * 60 * 1000) { // não mais que 7 dias atrás
            snapshotTime = currentTime;
          }

          const displaySeconds = Number(session.displaySecondsSnapshot ?? session.secondsSnapshot ?? session.seconds ?? 0);

          // Calcular tempo decorrido desde o snapshot do servidor
          const timeSinceSnapshot = Math.max(0, (currentTime - snapshotTime) / 1000);
          const calculatedTime = Math.floor(displaySeconds + timeSinceSnapshot);

          // Atualizar o estado do ref
          sessionDataRef.current.lastUpdateTime = Date.now();
          sessionDataRef.current.lastSnapshotTime = snapshotTime;
          sessionDataRef.current.lastDisplaySeconds = displaySeconds;
          sessionDataRef.current.isCurrentlyPaused = false;

          return Math.max(0, calculatedTime);
        });
      }, 250);
    } else {
      // Se estiver pausado, atualizar imediatamente com o valor do snapshot
      const displaySeconds = Number(session.displaySecondsSnapshot ?? session.secondsSnapshot ?? session.seconds ?? 0);
      setLive(displaySeconds);
    }

    // Cleanup
    return () => {
      if (sessionDataRef.current.intervalId) {
        clearInterval(sessionDataRef.current.intervalId);
        sessionDataRef.current.intervalId = null;
      }
    };
  }, [session?.uid, session?.isPaused, session?.status, session?.snapshotAt, session?.displaySecondsSnapshot,
      session?.secondsSnapshot, session?.seconds]);

  // Cleanup ao desmontar
  useEffect(() => {
    return () => {
      if (sessionDataRef.current.intervalId) {
        clearInterval(sessionDataRef.current.intervalId);
        sessionDataRef.current.intervalId = null;
      }
    };
  }, []);

  return live;
};

// --- COMPONENTES DE UI ---

const PulsingAvatar = ({ user, status }) => {
  const isActive = status === 'focus' || status === 'simulado';

  const gradients = {
    focus: 'from-emerald-400 to-teal-500',
    rest: 'from-blue-400 to-indigo-500',
    paused: 'from-amber-400 to-orange-500',
    simulado: 'from-red-500 to-rose-600'
  };

  const badgeColors = {
    focus: 'bg-emerald-500',
    rest: 'bg-blue-500',
    paused: 'bg-amber-500',
    simulado: 'bg-red-600'
  };

  const currentGradient = gradients[status] || gradients.paused;
  const currentBadgeColor = badgeColors[status] || badgeColors.paused;

  return (
    <div className="relative flex items-center justify-center">
      {isActive && (
        <>
          <span className={`absolute inline-flex h-full w-full rounded-full opacity-20 animate-ping duration-[3s] ${status === 'simulado' ? 'bg-red-500' : 'bg-emerald-400'}`} />
          <span className={`absolute inline-flex h-[110%] w-[110%] rounded-full border opacity-50 ${status === 'simulado' ? 'border-red-500/30' : 'border-emerald-500/30'}`} />
        </>
      )}

      <div className={`relative w-12 h-12 rounded-full p-[2px] bg-gradient-to-br ${currentGradient}`}>
        <div className="w-full h-full rounded-full bg-white dark:bg-zinc-900 overflow-hidden flex items-center justify-center border-2 border-white dark:border-zinc-900">
           {user?.photoURL ? (
             <img src={user.photoURL} alt={user.name} className="w-full h-full object-cover" />
           ) : (
             <span className="font-bold text-zinc-500 text-xs">
               {user?.name?.substring(0,2).toUpperCase() || <Users size={16}/>}
             </span>
           )}
        </div>

        <div className={`absolute -bottom-1 -right-1 p-1 rounded-full text-white shadow-sm border border-white dark:border-zinc-900 ${currentBadgeColor}`}>
          {status === 'focus' && <Zap size={10} fill="currentColor" />}
          {status === 'rest' && <Coffee size={10} />}
          {status === 'paused' && <PauseCircle size={10} />}
          {status === 'simulado' && <ClipboardList size={10} />}
        </div>
      </div>
    </div>
  );
};

// --- ALUNO CARD (foto, nome, matéria, timer em destaque) ---
const AlunoCard = ({ s, getUser, onOpenUser: onOpenUserProp }) => {
  const liveSeconds = useAdminSyncedSeconds(s);
  const user = getUser(s.uid);

  const isSimulado = s.isSimulado || (!!s.titulo && !s.disciplinaNome);
  const isPaused = s.isPaused || s.status === 'paused';
  const isResting = s.phase === 'rest' || s.isResting;

  let status = 'focus';
  if (isPaused) status = 'paused';
  else if (isSimulado) status = 'simulado';
  else if (isResting) status = 'rest';

  const theme = { focus: 'emerald', rest: 'blue', paused: 'amber', simulado: 'red' };
  const color = theme[status];

  const titleDisplay = isSimulado ? s.titulo : (s.disciplinaNome || 'Estudo Livre');
  const subTitleDisplay = isSimulado ? 'Simulado em Andamento' : (s.assunto || '');

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -8, scale: 0.95 }}
      className="group relative overflow-hidden rounded-2xl border bg-white dark:bg-zinc-900/80 backdrop-blur-sm transition-all duration-300 hover:shadow-lg"
      style={{ borderLeft: `4px solid var(--tw-color-${color}-500)` }}
    >
      <div className="p-4 flex flex-col gap-3">
        {/* Topo: Avatar + Nome */}
        <div className="flex items-center gap-3">
          <PulsingAvatar user={user} status={status} />
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-bold text-zinc-800 dark:text-zinc-100 truncate">
              {user.name || 'Usuário'}
            </h3>
            <span className={`text-[9px] font-bold uppercase tracking-wider text-${color}-500`}>
              {status === 'focus' && 'Focando Agora'}
              {status === 'rest' && 'Descansando'}
              {status === 'paused' && 'Em Pausa'}
              {status === 'simulado' && 'Simulado'}
            </span>
          </div>
          <button
            onClick={(e) => { e.stopPropagation(); onOpenUserProp(user); }}
            className="p-2 rounded-lg bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors opacity-0 group-hover:opacity-100 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
          >
            <Eye size={14} />
          </button>
        </div>

        {/* O que está estudando */}
        <div className="bg-zinc-50 dark:bg-zinc-800/50 rounded-xl p-3 border border-zinc-100 dark:border-zinc-700/50">
          <div className="flex items-start gap-2">
            {isSimulado ? (
              <ClipboardList size={13} className="mt-0.5 text-red-500 flex-shrink-0" />
            ) : (
              <BookOpen size={13} className="mt-0.5 text-zinc-400 flex-shrink-0" />
            )}
            <div className="min-w-0">
              <p className={`text-xs font-bold leading-snug truncate ${isSimulado ? 'text-red-600 dark:text-red-400' : 'text-zinc-700 dark:text-zinc-200'}`}>
                {titleDisplay}
              </p>
              {subTitleDisplay && (
                <p className="text-[10px] text-zinc-400 dark:text-zinc-500 truncate mt-0.5">{subTitleDisplay}</p>
              )}
            </div>
          </div>
        </div>

        {/* Timer em destaque */}
        <div className={`relative rounded-xl overflow-hidden bg-gradient-to-br from-${color}-500 to-${color}-600 text-white`}>
          <div className="absolute inset-0 bg-black/5" />
          <div className={`relative px-4 py-3 flex items-center justify-between ${isPaused || !status || status === 'focus' || status === 'simulado' ? '' : ''}`}>
            <div className="flex items-center gap-2">
              <Clock size={16} className={`${status === 'focus' || status === 'simulado' ? 'animate-pulse' : ''}`} />
              <span className="text-[10px] font-black uppercase tracking-wider opacity-80">
                {(status === 'focus' || status === 'simulado') && !isPaused ? 'Tempo' : 'Tempo'}
              </span>
            </div>
            <span className="text-lg font-mono font-bold tabular-nums tracking-wide">
              {formatClock(liveSeconds)}
            </span>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

// --- CARD DA SESSÃO (VISUALIZAÇÃO EXPANDIDA) ---
const SessionCard = ({ s, getUser, cicloNameByKey, isExpanded, toggleExpand, onOpenUser: onOpenUserProp }) => {
  const liveSeconds = useAdminSyncedSeconds(s);
  const user = getUser(s.uid);

  const isSimulado = s.isSimulado || (!!s.titulo && !s.disciplinaNome);
  const key = `${s.uid}_${s.cicloId || ''}`;
  const cicloNome = s.cicloNome || cicloNameByKey.get(key) || 'Ciclo Avulso';

  const isPaused = s.isPaused || s.status === 'paused';
  const isResting = s.phase === 'rest' || s.isResting;

  let status = 'focus';
  if (isPaused) status = 'paused';
  else if (isSimulado) status = 'simulado';
  else if (isResting) status = 'rest';

  const theme = {
    focus: 'emerald',
    rest: 'blue',
    paused: 'amber',
    simulado: 'red'
  };
  const color = theme[status];

  const titleDisplay = isSimulado ? s.titulo : (s.disciplinaNome || 'Estudo Livre');
  const subTitleDisplay = isSimulado ? 'Simulado em Andamento' : s.assunto;
  const modeDisplay = isSimulado
    ? (s.mode === 'countdown' ? 'Simulado (Tempo Limite)' : 'Simulado (Livre)')
    : (s.timerType === 'pomodoro' ? 'Pomodoro' : 'Cronômetro Livre');

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      className={`group relative overflow-hidden rounded-xl transition-all duration-300 border backdrop-blur-sm ${
        isExpanded
          ? `bg-white dark:bg-zinc-800 border-${color}-500/30 shadow-lg shadow-${color}-500/10`
          : 'bg-white/80 dark:bg-zinc-900/60 border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700'
      }`}
    >
      <div className={`absolute left-0 top-0 bottom-0 w-1 transition-colors duration-500 bg-${color}-500`} />

      {status === 'simulado' && (
         <div className="absolute inset-0 bg-red-500/5 animate-pulse pointer-events-none" />
      )}

      <div
        onClick={() => toggleExpand(s.uid)}
        className="p-4 pl-5 cursor-pointer flex flex-col md:flex-row items-start md:items-center gap-4 relative"
      >
        <div className="flex items-center gap-4 min-w-[200px]">
          <PulsingAvatar user={user} status={status} />
          <div className="flex flex-col">
            <h3 className="text-sm font-bold text-zinc-800 dark:text-zinc-100 leading-tight">
              {user.name || 'Usuário'}
            </h3>
            <span className={`text-[10px] font-bold uppercase tracking-wider mt-1 text-${color}-600 dark:text-${color}-400 flex items-center gap-1`}>
              {status === 'focus' && 'Focando Agora'}
              {status === 'rest' && 'Descansando'}
              {status === 'paused' && 'Em Pausa'}
              {status === 'simulado' && (
                 <> <AlertCircle size={10} /> Realizando Simulado </>
              )}
            </span>
          </div>
        </div>

        <div className="flex-1 w-full md:w-auto min-w-0 pr-2">
            <div className="flex flex-col gap-1">
              <div className="flex items-start gap-2">
                {isSimulado ? (
                   <ClipboardList size={14} className="mt-0.5 text-red-500 flex-shrink-0" />
                ) : (
                   <BookOpen size={14} className="mt-0.5 text-zinc-400 flex-shrink-0" />
                )}

                <span className={`text-sm font-semibold leading-snug break-words line-clamp-2 ${isSimulado ? 'text-red-700 dark:text-red-300' : 'text-zinc-700 dark:text-zinc-200'}`}>
                  {titleDisplay}
                </span>
              </div>
              {subTitleDisplay && (
                <span className="text-xs text-zinc-500 dark:text-zinc-400 pl-6 break-words line-clamp-1">
                  {subTitleDisplay}
                </span>
              )}
            </div>
        </div>

        <div className="flex items-center justify-between w-full md:w-auto gap-4 md:pl-4 border-t md:border-t-0 border-zinc-100 dark:border-zinc-800 pt-3 md:pt-0">
           <div className={`px-3 py-1.5 rounded-lg flex items-center gap-2 border bg-${color}-50 dark:bg-${color}-900/10 border-${color}-100 dark:border-${color}-800/30 text-${color}-700 dark:text-${color}-300`}>
              <Clock size={14} className={(status === 'focus' || status === 'simulado') && !isPaused ? 'animate-pulse' : ''} />
              {formatClock(liveSeconds)}
           </div>

           <div className={`p-1.5 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-transform duration-300 text-zinc-400 ${isExpanded ? 'rotate-180' : ''}`}>
             <ChevronDown size={18} />
           </div>
        </div>
      </div>

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="border-t border-zinc-100 dark:border-zinc-800 bg-zinc-50/80 dark:bg-black/20"
          >
            <div className="p-4 pl-6 grid grid-cols-1 md:grid-cols-2 gap-4">
               <div className="space-y-2">
                 <h4 className="text-[10px] uppercase font-bold text-zinc-400 tracking-wider flex items-center gap-1">
                   <Activity size={12} /> Detalhes da Sessão
                 </h4>
                 <div className="bg-white dark:bg-zinc-900 rounded-lg p-3 border border-zinc-200 dark:border-zinc-800 shadow-sm grid grid-cols-2 gap-2 text-xs">
                    {!isSimulado && (
                        <>
                            <div className="text-zinc-500">Ciclo Atual</div>
                            <div className="font-semibold text-right text-zinc-800 dark:text-zinc-200 truncate">{cicloNome}</div>
                        </>
                    )}

                    <div className="text-zinc-500">Início</div>
                    <div className="font-semibold text-right text-zinc-800 dark:text-zinc-200">
                       {toDateSafe(s.createdAt)?.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) || '--:--'}
                    </div>

                    <div className="text-zinc-500">Tipo</div>
                    <div className="font-semibold text-right text-zinc-800 dark:text-zinc-200 capitalize">
                       {modeDisplay}
                    </div>
                 </div>
               </div>

               <div className="flex flex-col justify-end space-y-2">
                 <h4 className="text-[10px] uppercase font-bold text-zinc-400 tracking-wider flex items-center gap-1">
                   <Target size={12} /> Ações
                 </h4>
                 <button
                    onClick={(e) => { e.stopPropagation(); onOpenUserProp(user); }}
                   className="flex items-center justify-center gap-2 w-full py-2.5 rounded-lg bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 font-bold text-xs hover:opacity-90 transition-opacity shadow-md"
                 >
                   Ver Histórico Completo
                 </button>
               </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

// --- VISUALIZAÇÃO EM BLOCO (TILE) ---
const TileView = ({ s, getUser, onOpenUser: onOpenUserProp }) => {
  const liveSeconds = useAdminSyncedSeconds(s);
  const user = getUser(s.uid);

  const isSimulado = s.isSimulado || (!!s.titulo && !s.disciplinaNome);
  const isPaused = s.isPaused || s.status === 'paused';
  const isResting = s.phase === 'rest' || s.isResting;

  let status = 'focus';
  if (isPaused) status = 'paused';
  else if (isSimulado) status = 'simulado';
  else if (isResting) status = 'rest';

  const theme = {
    focus: 'emerald',
    rest: 'blue',
    paused: 'amber',
    simulado: 'red'
  };
  const color = theme[status];

  const titleDisplay = isSimulado ? s.titulo : (s.disciplinaNome || 'Estudo Livre');

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      whileHover={{ scale: 1.02 }}
      className={`rounded-xl border p-4 cursor-pointer transition-all duration-200 hover:shadow-md bg-white dark:bg-zinc-900 border-${color}-200 dark:border-${color}-800 hover:border-${color}-300 dark:hover:border-${color}-700 flex flex-col h-full`}
      onClick={() => onOpenUserProp(user)}
    >
      {/* Avatar e nome */}
      <div className="flex items-center gap-3 mb-3">
        <div className="flex-shrink-0">
          <PulsingAvatar user={user} status={status} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-zinc-800 dark:text-zinc-100 truncate">
            {user.name || 'Usuário'}
          </p>
        </div>
      </div>

      {/* Matéria/Atividade */}
      <div className="mb-3 flex-1">
        <p className={`text-sm font-semibold ${isSimulado ? 'text-red-600 dark:text-red-400' : 'text-zinc-700 dark:text-zinc-200'} truncate`}>
          {titleDisplay}
        </p>
        {s.assunto && !isSimulado && (
          <p className="text-xs text-zinc-500 dark:text-zinc-400 truncate mt-1">
            {s.assunto}
          </p>
        )}
      </div>

      {/* Status e tempo em destaque */}
      <div className="space-y-2">
        <div className={`relative rounded-lg overflow-hidden bg-gradient-to-br from-${color}-500 to-${color}-600 text-white shadow-md`}>
          <div className="absolute inset-0 bg-black/5" />
          <div className="relative px-3 py-2.5">
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-1">
                <Clock size={10} className={`${status === 'focus' || status === 'simulado' ? 'animate-pulse' : ''}`} />
                <span className="text-[7px] font-black uppercase tracking-wider opacity-90">
                  {status === 'focus' || status === 'simulado' ? 'TEMPO' : 'TEMPO'}
                </span>
              </div>
            </div>
            <div className="text-center">
              <span className="text-xl font-mono font-bold tabular-nums tracking-tight">
                {formatClock(liveSeconds)}
              </span>
            </div>
          </div>
        </div>

        <span className={`w-full text-center py-1 rounded-full text-[9px] font-bold uppercase bg-${color}-100 dark:bg-${color}-900/20 text-${color}-700 dark:text-${color}-400 border border-${color}-200 dark:border-${color}-800`}>
          {status === 'focus' && 'Estudando'}
          {status === 'rest' && 'Descansando'}
          {status === 'paused' && 'Pausado'}
          {status === 'simulado' && 'Simulado'}
        </span>
      </div>
    </motion.div>
  );
};

// --- VISUALIZAÇÃO EM TABELA COMPACTA (Para +5 usuários) ---
const TableRow = ({ s, getUser, cicloNameByKey, onOpenUser: onOpenUserProp }) => {
  const liveSeconds = useAdminSyncedSeconds(s);
  const user = getUser(s.uid);

  const isSimulado = s.isSimulado || (!!s.titulo && !s.disciplinaNome);
  const isPaused = s.isPaused || s.status === 'paused';
  const isResting = s.phase === 'rest' || s.isResting;

  let status = 'focus';
  if (isPaused) status = 'paused';
  else if (isSimulado) status = 'simulado';
  else if (isResting) status = 'rest';

  const theme = {
    focus: 'emerald',
    rest: 'blue',
    paused: 'amber',
    simulado: 'red'
  };
  const color = theme[status];

  const titleDisplay = isSimulado ? s.titulo : (s.disciplinaNome || 'Estudo Livre');

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="grid grid-cols-12 gap-3 p-3 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-900/50 border border-transparent hover:border-zinc-200 dark:hover:border-zinc-800 transition-all items-center group"
    >
      {/* Avatar + Nome */}
      <div className="col-span-4 flex items-center gap-3 min-w-0">
        <div className="flex-shrink-0">
          <PulsingAvatar user={user} status={status} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-zinc-800 dark:text-zinc-100 truncate">
            {user.name || 'Usuário'}
          </p>
          <p className="text-[10px] text-zinc-500 truncate">{titleDisplay}</p>
        </div>
      </div>

      {/* Status */}
      <div className="col-span-3 flex items-center justify-center">
        <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase bg-${color}-100 dark:bg-${color}-900/20 text-${color}-700 dark:text-${color}-400 border border-${color}-200 dark:border-${color}-800`}>
          {status === 'focus' && 'Estudando'}
          {status === 'rest' && 'Descansando'}
          {status === 'paused' && 'Pausado'}
          {status === 'simulado' && 'Simulado'}
        </span>
      </div>

      {/* Cronômetro */}
      <div className="col-span-3 flex items-center justify-center">
        <div className={`px-3 py-1.5 rounded-lg border bg-${color}-50 dark:bg-${color}-900/10 border-${color}-100 dark:border-${color}-800/30 text-${color}-700 dark:text-${color}-300`}>
          {formatClock(liveSeconds)}
        </div>
      </div>

      {/* Ações */}
      <div className="col-span-2 flex items-center justify-end">
        <button
          onClick={() => onOpenUserProp(user)}
          className="p-2 rounded-lg bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors opacity-0 group-hover:opacity-100"
        >
          <Eye size={16} className="text-zinc-600 dark:text-zinc-400" />
        </button>
      </div>
    </motion.div>
  );
};

// --- COMPONENTE PRINCIPAL ---
const StudyingNowPanel = ({ sessions = [], getUser, cicloNameByKey, onOpenUser }) => {
  const [selectedUser, setSelectedUser] = useState(null);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);

  const handleOpenUser = (user) => {
    setSelectedUser(user);
    setIsProfileModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsProfileModalOpen(false);
    setSelectedUser(null);
  };
  const [expandedUid, setExpandedUid] = useState(null);
  const [filterStatus, setFilterStatus] = useState('all');
  const [viewMode, setViewMode] = useState('auto');

  // Contadores
  const counts = useMemo(() => {
    let focus = 0;
    let rest = 0;
    let paused = 0;
    let simulado = 0;

    sessions.forEach(s => {
       const isSim = s.isSimulado || (!!s.titulo && !s.disciplinaNome);
       const isPausedSess = s.isPaused || s.status === 'paused';

       if (isPausedSess) {
         paused++;
       } else if (isSim) {
         simulado++;
       } else if (s.isResting || s.phase === 'rest') {
         rest++;
       } else {
         focus++;
       }
    });

    return { focus, rest, paused, simulado, total: sessions.length };
  }, [sessions]);

  // Filtragem
  const filteredSessions = useMemo(() => {
    if (filterStatus === 'all') return sessions;

    return sessions.filter(s => {
      const isSim = s.isSimulado || (!!s.titulo && !s.disciplinaNome);
      const isPausedSess = s.isPaused || s.status === 'paused';
      const isRestingSess = s.isResting || s.phase === 'rest';

      if (filterStatus === 'simulado') return isSim;
      if (filterStatus === 'paused') return isPausedSess && !isSim;
      if (filterStatus === 'rest') return isRestingSess && !isSim;
      if (filterStatus === 'focus') return !isPausedSess && !isRestingSess && !isSim;

      return true;
    });
  }, [sessions, filterStatus]);

  // Determina modo de visualização
  const shouldUseTable = viewMode === 'table' || (viewMode === 'auto' && filteredSessions.length > 5);
  const shouldUseAlunoCards = viewMode === 'alunos';
  const shouldUseTiles = viewMode === 'tiles';

  const toggleExpand = (uid) => setExpandedUid(prev => prev === uid ? null : uid);

  return (
    <>
      {/* Estilos do Scrollbar Customizado */}
      <style dangerouslySetInnerHTML={{__html: `
        .live-monitor-scroll::-webkit-scrollbar {
          width: 8px;
        }

        .live-monitor-scroll::-webkit-scrollbar-track {
          background: transparent;
        }

        .live-monitor-scroll::-webkit-scrollbar-thumb {
          background: #a1a1aa;
          border-radius: 4px;
          transition: background 0.2s ease;
        }

        .live-monitor-scroll::-webkit-scrollbar-thumb:hover {
          background: #71717a;
        }

        .dark .live-monitor-scroll::-webkit-scrollbar-thumb {
          background: #3f3f46;
        }

        .dark .live-monitor-scroll::-webkit-scrollbar-thumb:hover {
          background: #52525b;
        }

        /* Firefox */
        .live-monitor-scroll {
          scrollbar-width: thin;
          scrollbar-color: #a1a1aa transparent;
        }

        .dark .live-monitor-scroll {
          scrollbar-color: #3f3f46 transparent;
        }
      `}} />

      <div className="relative h-full flex flex-col overflow-hidden rounded-3xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 shadow-2xl">

      {/* BACKGROUND DECORATIVO */}
      <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-indigo-500/10 rounded-full blur-[100px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-emerald-500/10 rounded-full blur-[100px]" />
        <div
          className="absolute inset-0 opacity-20 mix-blend-overlay"
          style={{
            backgroundImage: [
              'radial-gradient(circle at 20% 20%, rgba(255,255,255,0.22) 0 1px, transparent 1px)',
              'radial-gradient(circle at 80% 30%, rgba(255,255,255,0.16) 0 1px, transparent 1px)',
              'radial-gradient(circle at 40% 70%, rgba(255,255,255,0.14) 0 1px, transparent 1px)',
            ].join(','),
            backgroundSize: '18px 18px, 24px 24px, 28px 28px',
            backgroundPosition: '0 0, 6px 10px, 12px 4px',
          }}
        />
      </div>

      {/* HEADER FIXO COM STICKY E Z-INDEX ALTO */}
      <div className="sticky top-0 z-50 flex-shrink-0 px-6 py-5 flex flex-col gap-4 border-b border-zinc-200/50 dark:border-zinc-800/50 bg-white dark:bg-zinc-900 backdrop-blur-md shadow-sm">
        {/* Linha 1: Título + Estatísticas */}
        <div className="flex flex-col md:flex-row items-start md:items-end justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
               <span className="relative flex h-3 w-3">
                 <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                 <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
               </span>
               <span className="text-[10px] font-black uppercase tracking-widest text-red-500">Ao Vivo</span>
            </div>
            <h2 className="text-2xl font-black text-zinc-900 dark:text-white tracking-tight">Monitoramento</h2>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 font-medium">
               {filteredSessions.length} {filteredSessions.length === 1 ? 'aluno conectado' : 'alunos conectados'}
            </p>
          </div>

          {/* Status Pills */}
          <div className="flex flex-wrap gap-2">
             {counts.simulado > 0 && (
               <div className="px-3 py-1 rounded-full bg-red-100/50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 text-xs font-bold flex items-center gap-1.5 animate-pulse">
                 <ClipboardList size={12} fill="currentColor" /> {counts.simulado}
               </div>
             )}
             <div className="px-3 py-1 rounded-full bg-emerald-100/50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400 text-xs font-bold flex items-center gap-1.5">
               <Zap size={12} fill="currentColor" /> {counts.focus}
             </div>
             <div className="px-3 py-1 rounded-full bg-blue-100/50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-400 text-xs font-bold flex items-center gap-1.5">
               <Coffee size={12} /> {counts.rest}
             </div>
             <div className="px-3 py-1 rounded-full bg-amber-100/50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-400 text-xs font-bold flex items-center gap-1.5">
               <PauseCircle size={12} /> {counts.paused}
             </div>
          </div>
        </div>

        {/* Linha 2: Filtros + Controles de Visualização */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          {/* Filtros */}
          <div className="flex items-center gap-2 bg-zinc-100 dark:bg-zinc-900 p-1 rounded-xl border border-zinc-200 dark:border-zinc-800 flex-wrap">
            <button
              onClick={() => setFilterStatus('all')}
              className={`px-3 py-1.5 text-[10px] font-bold uppercase rounded-lg transition-all ${
                filterStatus === 'all'
                  ? 'bg-white dark:bg-zinc-800 shadow text-zinc-900 dark:text-white'
                  : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'
              }`}
            >
              Todos
            </button>
            <button
              onClick={() => setFilterStatus('focus')}
              className={`px-3 py-1.5 text-[10px] font-bold uppercase rounded-lg transition-all ${
                filterStatus === 'focus'
                  ? 'bg-emerald-500 shadow text-white'
                  : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'
              }`}
            >
              Estudando
            </button>
            {counts.simulado > 0 && (
              <button
                onClick={() => setFilterStatus('simulado')}
                className={`px-3 py-1.5 text-[10px] font-bold uppercase rounded-lg transition-all ${
                  filterStatus === 'simulado'
                    ? 'bg-red-500 shadow text-white'
                    : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'
                }`}
              >
                Simulados
              </button>
            )}
          </div>

          {/* Controles de Visualização */}
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold uppercase text-zinc-400 mr-1">Vista:</span>
            <button
              onClick={() => setViewMode('auto')}
              className={`p-2 rounded-lg transition-all ${
                viewMode === 'auto'
                  ? 'bg-zinc-900 dark:bg-white text-white dark:text-zinc-900'
                  : 'bg-zinc-200 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400'
              }`}
              title="Auto (Cards até 5, depois Tabela)"
            >
              <TrendingUp size={14} />
            </button>
            <button
              onClick={() => setViewMode('cards')}
              className={`p-2 rounded-lg transition-all ${
                viewMode === 'cards'
                  ? 'bg-zinc-900 dark:bg-white text-white dark:text-zinc-900'
                  : 'bg-zinc-200 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400'
              }`}
              title="Cards Expandidos"
            >
              <Activity size={14} />
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={`p-2 rounded-lg transition-all ${
                viewMode === 'table'
                  ? 'bg-zinc-900 dark:bg-white text-white dark:text-zinc-900'
                  : 'bg-zinc-200 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400'
              }`}
              title="Tabela Compacta"
            >
              <BarChart3 size={14} />
            </button>
            <button
              onClick={() => setViewMode('tiles')}
              className={`p-2 rounded-lg transition-all ${
                viewMode === 'tiles'
                  ? 'bg-zinc-900 dark:bg-white text-white dark:text-zinc-900'
                  : 'bg-zinc-200 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400'
              }`}
              title="Visualização em Blocos"
            >
              <Grid size={14} />
            </button>
          </div>
        </div>
      </div>

      {/* ÁREA DE CONTEÚDO COM SCROLL */}
      <div className="relative z-0 flex-1 min-h-0 overflow-hidden">
        <div className="h-full overflow-y-auto px-4 md:px-6 py-4 space-y-3 live-monitor-scroll" style={{ scrollbarGutter: 'stable' }}>
          <AnimatePresence mode='popLayout'>
            {filteredSessions.length === 0 ? (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex flex-col items-center justify-center h-full min-h-[300px] text-center"
              >
                 <div className="w-20 h-20 bg-zinc-100 dark:bg-zinc-800 rounded-full flex items-center justify-center mb-4">
                   <Users size={32} className="text-zinc-300 dark:text-zinc-600" />
                 </div>
                 <h3 className="text-lg font-bold text-zinc-700 dark:text-zinc-200">
                   {filterStatus === 'all' ? 'Sala Vazia' : 'Nenhum resultado'}
                 </h3>
                 <p className="text-sm text-zinc-500 dark:text-zinc-400 max-w-xs mx-auto mt-2">
                   {filterStatus === 'all'
                     ? 'Assim que os alunos iniciarem os estudos ou simulados, eles aparecerão aqui.'
                     : 'Não há alunos com este status no momento.'
                   }
                 </p>
              </motion.div>
            ) : shouldUseTable ? (
              // VISUALIZAÇÃO EM TABELA COMPACTA
              <div className="space-y-2 w-full">
                {/* Header da Tabela (sticky dentro do scroll) */}
                <div className="sticky top-0 z-10 grid grid-cols-12 gap-3 px-3 py-2 bg-zinc-100 dark:bg-zinc-900 rounded-lg text-[10px] font-black uppercase text-zinc-500 tracking-wider backdrop-blur-sm">
                  <div className="col-span-4">Aluno / Atividade</div>
                  <div className="col-span-3 text-center">Status</div>
                  <div className="col-span-3 text-center">Tempo</div>
                  <div className="col-span-2 text-right">Ações</div>
                </div>

                {/* Linhas da Tabela */}
                {filteredSessions.map((s) => (
                  <TableRow
                    key={s.uid}
                    s={s}
                    getUser={getUser}
                    cicloNameByKey={cicloNameByKey}
                    onOpenUser={handleOpenUser}
                  />
                ))}
              </div>
            ) : shouldUseTiles ? (
              // VISUALIZAÇÃO EM BLOCOS (TILES)
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 w-full">
                {filteredSessions.map((s) => (
                  <TileView
                    key={s.uid}
                    s={s}
                    getUser={getUser}
                    onOpenUser={handleOpenUser}
                  />
                ))}
              </div>
            ) : (
              // VISUALIZAÇÃO EM CARDS EXPANDIDOS
              <div className="space-y-3 w-full">
                {filteredSessions.map((s) => (
                  <SessionCard
                    key={s.uid}
                    s={s}
                    getUser={getUser}
                    cicloNameByKey={cicloNameByKey}
                    isExpanded={expandedUid === s.uid}
                    toggleExpand={toggleExpand}
                    onOpenUser={handleOpenUser}
                  />
                ))}
              </div>
            )}
          </AnimatePresence>
        </div>

        {/* FOOTER SOMBRA (Indicador de Scroll) */}
        <div className="absolute bottom-0 left-0 right-0 h-12 bg-gradient-to-t from-zinc-50 dark:from-zinc-950 to-transparent pointer-events-none z-20" />
      </div>

      {/* Modal de Perfil do Usuário */}
      {isProfileModalOpen && selectedUser && (
        <UserProfileModal
          user={selectedUser}
          isOpen={isProfileModalOpen}
          onClose={handleCloseModal}
        />
      )}
    </div>
    </>
  );
};

export default StudyingNowPanel;
