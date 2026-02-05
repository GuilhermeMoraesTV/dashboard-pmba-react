import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  Play, Pause, Square, Minimize2, X, AlertTriangle,
  Maximize, Sun, Moon, ClipboardList
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { doc, setDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../firebaseConfig';

const WHITE_NOISE_URL = 'https://raw.githubusercontent.com/anars/blank-audio/master/10-minutes-of-silence.mp3';
const ALARM_URL = 'https://actions.google.com/sounds/v1/alarms/beep_short.ogg';

// Helpers
const formatClock = (totalSeconds) => {
  const safe = Math.max(0, Number(totalSeconds) || 0);
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const seconds = safe % 60;
  return [hours, minutes, seconds].map(v => String(v).padStart(2, '0')).join(':');
};

const safeNotify = (title, body) => {
  try {
    if (!('Notification' in window)) return;
    if (Notification.permission === 'granted') {
      new Notification(title, { body });
    } else if (Notification.permission !== 'denied') {
      Notification.requestPermission().then((p) => {
        if (p === 'granted') new Notification(title, { body });
      }).catch(() => {});
    }
  } catch {}
};

const ConfirmationModal = ({ isOpen, onConfirm, onCancel, title, description, confirmText, isDestructive }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-[10000] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-2xl rounded-2xl p-6 w-full max-w-sm">
        <div className="flex items-start gap-4">
          <AlertTriangle className={`${isDestructive ? 'text-red-500' : 'text-amber-500'} mt-0.5 shrink-0`} size={24} />
          <div>
            <h3 className="text-lg font-bold text-zinc-900 dark:text-white mb-1">{title || 'Atenção'}</h3>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">{description}</p>
          </div>
        </div>
        <div className="mt-6 flex justify-end gap-3">
          <button onClick={onCancel} className="px-4 py-2 text-sm font-semibold text-zinc-600 dark:text-zinc-300 bg-zinc-100 dark:bg-zinc-800 rounded-lg hover:bg-zinc-200 dark:hover:bg-zinc-700">
            Cancelar
          </button>
          <button onClick={onConfirm} className={`px-4 py-2 text-sm font-bold text-white rounded-lg ${isDestructive ? 'bg-red-600 hover:bg-red-700' : 'bg-emerald-600 hover:bg-emerald-700'}`}>
            {confirmText || 'Confirmar'}
          </button>
        </div>
      </div>
    </div>
  );
};

function SimuladoTimer({
  tituloSimulado,
  mode = 'free',            // 'free' | 'countdown'
  initialSeconds = 0,        // duração total em segundos (apenas countdown)
  onStop,
  onCancel,
  isMinimized,
  onMaximize,
  onMinimize,
  userUid,
  userName,
  userPhotoURL // Adicionado para exibir a foto no painel de monitoramento
}) {
  const themeColor = '#dc2626'; // Vermelho Tático para Simulados
  const STORAGE_KEY = useMemo(() => `@ModoQAP:SimuladoActive:${userUid}`, [userUid]);

  // Estados
  const [isPreparing, setIsPreparing] = useState(true);
  const [countdown, setCountdown] = useState(3);
  const [isDark, setIsDark] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);

  const [seconds, setSeconds] = useState(0); // display
  const [isPaused, setIsPaused] = useState(false);

  // Refs (Persistência entre renders)
  const intervalRef = useRef(null);
  const audioRef = useRef(null);
  const alarmRef = useRef(null);

  const startTimeRef = useRef(null);       // início do segmento em execução
  const accumulatedBaseRef = useRef(0);    // total acumulado (elapsed) antes do segmento atual

  const secondsRef = useRef(0);            // display atual
  const isPausedRef = useRef(false);

  const originalTitleRef = useRef(document.title);

  // ✅ Watchdog / intenção do usuário
  const desiredRunningRef = useRef(false);
  const lastExplicitToggleAtRef = useRef(0);

  // ✅ evita “time up” disparar várias vezes
  const timeUpFiredRef = useRef(false);

  useEffect(() => { secondsRef.current = seconds; }, [seconds]);
  useEffect(() => { isPausedRef.current = isPaused; }, [isPaused]);

  // --- FIREBASE (safe) ---
  const simuladoDocRef = useMemo(() => {
    if (!userUid) return null;
    return doc(db, 'users', userUid, 'personal_timers', 'active_simulado');
  }, [userUid]);

  const globalTimerRef = useMemo(() => {
    if (!userUid) return null;
    return doc(db, 'active_timers', userUid);
  }, [userUid]);

  const safeUpdateFirebase = useCallback(async (isRunning) => {
    if (!userUid) return;

    // Payload completo para ser lido pelo painel de monitoramento
    const payload = {
      uid: userUid,
      userName: userName || 'Candidato',
      photoURL: userPhotoURL || null,
      titulo: tituloSimulado || 'Simulado Sem Título',
      disciplinaNome: tituloSimulado || 'Simulado', // Alias para monitores que buscam disciplina
      assunto: 'Prova em Andamento',
      mode: mode || 'free',
      status: isRunning ? 'running' : 'paused',
      secondsSnapshot: Number(secondsRef.current) || 0,
      updatedAt: serverTimestamp(),
      heartbeatAt: serverTimestamp(),
      isSimulado: true, // 🔴 FLAG IMPORTANTE: Identifica que é um simulado
      timerType: 'simulado'
    };

    try {
      // 1. Atualiza persistência local do usuário (para reload)
      if (simuladoDocRef) {
        await setDoc(simuladoDocRef, payload, { merge: true });
      }

      // 2. Atualiza monitoramento global (para o painel de controle)
      if (globalTimerRef) {
        await setDoc(globalTimerRef, payload, { merge: true });
      }
    } catch (e) {
      console.warn("Firebase Sync ignorado (Permissão ou Rede):", e?.message);
    }
  }, [simuladoDocRef, globalTimerRef, userUid, userName, userPhotoURL, tituloSimulado, mode]);

  const safeRemoveFirebase = useCallback(async () => {
    try {
      if (simuladoDocRef) await deleteDoc(simuladoDocRef);
      if (globalTimerRef) await deleteDoc(globalTimerRef);
    } catch (e) {
      console.warn("Erro ao limpar Firebase:", e?.message);
    }
  }, [simuladoDocRef, globalTimerRef]);

  // --- Local Storage ---
  const saveToStorage = useCallback((paused, currentElapsed, finished = false) => {
    const data = {
      titulo: tituloSimulado,
      mode,
      initialSeconds,
      accumulatedTime: currentElapsed, // aqui SEMPRE guardamos ELAPSED (tempo decorrido)
      isPaused: paused,
      lastTimestamp: Date.now(),
      isFinished: finished
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }, [STORAGE_KEY, tituloSimulado, mode, initialSeconds]);

  // --- UI externa: title + MediaSession ---
  const updateExternalStatus = useCallback((isRunning, displaySeconds) => {
    const timeStr = formatClock(displaySeconds);
    const label = mode === 'countdown' ? 'Restante' : 'Tempo';
    const status = isRunning ? 'Simulado' : 'Simulado Pausado';
    document.title = `${status} • ${label}: ${timeStr}`;
  }, [mode]);

  const computeMediaPositionState = useCallback((displaySeconds) => {
    // displaySeconds = remaining (countdown) ou elapsed (free)
    let duration = 60;
    let position = 0;

    if (mode === 'countdown') {
      const total = Math.max(1, Number(initialSeconds) || 1);
      duration = total;
      const remaining = Math.max(0, Number(displaySeconds) || 0);
      position = Math.min(total, Math.max(0, total - remaining)); // elapsed dentro do countdown
      return { duration, position };
    }

    // free (count up)
    position = Math.max(0, Number(displaySeconds) || 0);
    duration = Math.max(3600, position + 60); // sempre > position (duração “deslizante”)
    return { duration, position };
  }, [mode, initialSeconds]);

  const updateMediaSession = useCallback((isRunning, displaySeconds) => {
    if (!('mediaSession' in navigator)) return;

    try {
      const timeStr = formatClock(displaySeconds);
      const label = mode === 'countdown' ? 'Tempo restante' : 'Tempo decorrido';
      const statusLine = `${isRunning ? 'Rodando' : 'Pausado'} • ${label}: ${timeStr}`;

      navigator.mediaSession.metadata = new MediaMetadata({
        title: tituloSimulado || 'Simulado',
        artist: statusLine,
        album: 'ModoQAP • Simulado',
        artwork: [{ src: '/logo-pmba.png', sizes: '512x512', type: 'image/png' }]
      });

      navigator.mediaSession.playbackState = isRunning ? 'playing' : 'paused';

      if ('setPositionState' in navigator.mediaSession) {
        const { duration, position } = computeMediaPositionState(displaySeconds);
        const playbackRate = isRunning ? 1 : 0;
        try {
          navigator.mediaSession.setPositionState({ duration, position, playbackRate });
        } catch {
          try {
            if (!isRunning) navigator.mediaSession.setPositionState(null);
            else navigator.mediaSession.setPositionState({ duration, position, playbackRate: 1 });
          } catch {}
        }
      }
    } catch {}
  }, [tituloSimulado, mode, computeMediaPositionState]);

  // --- Controle Play/Pause/Stop vindo da lockscreen / notificação / teclas de mídia ---
  const handleStopRef = useRef(null);
  const handleTogglePauseRef = useRef(null);

  useEffect(() => {
    if (!('mediaSession' in navigator)) return;

    try {
      navigator.mediaSession.setActionHandler('play', () => {
        handleTogglePauseRef.current?.('media_play');
      });
      navigator.mediaSession.setActionHandler('pause', () => {
        handleTogglePauseRef.current?.('media_pause');
      });
      navigator.mediaSession.setActionHandler('stop', () => {
        handleStopRef.current?.();
      });

      // Ignorar seeks (não aplicamos)
      navigator.mediaSession.setActionHandler('seekto', () => {});
      navigator.mediaSession.setActionHandler('seekbackward', () => {});
      navigator.mediaSession.setActionHandler('seekforward', () => {});
    } catch {}

    return () => {
      try {
        navigator.mediaSession.setActionHandler('play', null);
        navigator.mediaSession.setActionHandler('pause', null);
        navigator.mediaSession.setActionHandler('stop', null);
        navigator.mediaSession.setActionHandler('seekto', null);
        navigator.mediaSession.setActionHandler('seekbackward', null);
        navigator.mediaSession.setActionHandler('seekforward', null);
      } catch {}
    };
  }, []);

  // --- Core: updateDisplay (ELAPSED -> displaySeconds) ---
  const pauseSimulado = useCallback(async (source = 'user') => {
    if (isPausedRef.current) return;

    desiredRunningRef.current = false;
    if (source !== 'watchdog') lastExplicitToggleAtRef.current = Date.now();

    clearInterval(intervalRef.current);

    // “commita” segmento em execução
    if (startTimeRef.current) {
      const now = Date.now();
      const delta = Math.floor((now - startTimeRef.current) / 1000);
      accumulatedBaseRef.current += Math.max(0, delta);
      startTimeRef.current = null;
    }

    setIsPaused(true);
    isPausedRef.current = true;

    // display depende do modo
    const elapsed = accumulatedBaseRef.current || 0;
    if (mode === 'countdown') {
      const total = Number(initialSeconds) || 0;
      const remaining = Math.max(0, total - elapsed);
      setSeconds(remaining);
      secondsRef.current = remaining;
      saveToStorage(true, elapsed, false);
      updateExternalStatus(false, remaining);
      updateMediaSession(false, remaining);
    } else {
      setSeconds(elapsed);
      secondsRef.current = elapsed;
      saveToStorage(true, elapsed, false);
      updateExternalStatus(false, elapsed);
      updateMediaSession(false, elapsed);
    }

    if (audioRef.current) audioRef.current.pause();
    await safeUpdateFirebase(false);
  }, [mode, initialSeconds, saveToStorage, updateExternalStatus, updateMediaSession, safeUpdateFirebase]);

  const resumeSimulado = useCallback(async (source = 'user') => {
    if (!isPausedRef.current) return;

    // se countdown já acabou, não retoma
    if (mode === 'countdown' && secondsRef.current <= 0) return;

    desiredRunningRef.current = true;
    if (source !== 'watchdog') lastExplicitToggleAtRef.current = Date.now();

    startTimeRef.current = Date.now();

    setIsPaused(false);
    isPausedRef.current = false;

    if (audioRef.current) audioRef.current.play().catch(() => {});
    await safeUpdateFirebase(true);

    updateExternalStatus(true, secondsRef.current);
    updateMediaSession(true, secondsRef.current);
  }, [mode, safeUpdateFirebase, updateExternalStatus, updateMediaSession]);

  const handleTogglePause = useCallback((source = 'user') => {
    if (isPausedRef.current) resumeSimulado(source);
    else pauseSimulado(source);
  }, [pauseSimulado, resumeSimulado]);

  useEffect(() => { handleTogglePauseRef.current = handleTogglePause; }, [handleTogglePause]);

  const handleTimeUp = useCallback(() => {
    if (timeUpFiredRef.current) return;
    timeUpFiredRef.current = true;

    if (alarmRef.current) alarmRef.current.play().catch(() => {});
    safeNotify("Tempo do simulado acabou!", "O cronômetro zerou.");

    // pausa (isso também atualiza MediaSession + Storage + Firebase)
    pauseSimulado('timeup');
  }, [pauseSimulado]);

  const updateDisplayFromElapsed = useCallback((elapsedTotal) => {
    const elapsed = Math.max(0, Number(elapsedTotal) || 0);

    if (mode === 'countdown') {
      const total = Number(initialSeconds) || 0;
      const remaining = Math.max(0, total - elapsed);

      setSeconds(remaining);
      secondsRef.current = remaining;

      if (remaining <= 0) handleTimeUp();
    } else {
      setSeconds(elapsed);
      secondsRef.current = elapsed;
    }
  }, [mode, initialSeconds, handleTimeUp]);

  // --- Setup Inicial & Restore ---
  useEffect(() => {
    audioRef.current = new Audio(WHITE_NOISE_URL);
    audioRef.current.loop = true;
    audioRef.current.volume = 0.01;
    try { audioRef.current.setAttribute('playsinline', ''); } catch {}
    alarmRef.current = new Audio(ALARM_URL);

    // ✅ Verifica preferência de tema do sistema/app
    if (document.documentElement.classList.contains('dark')) setIsDark(true);
    else setIsDark(false);

    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const data = JSON.parse(saved);

        if (data && !data.isFinished && data.titulo === tituloSimulado) {
          setIsPreparing(false);

          const now = Date.now();
          const lastTs = Number(data.lastTimestamp) || now;
          const wasPaused = !!data.isPaused;

          // sempre tratamos accumulatedTime como ELAPSED
          const baseElapsed = Number(data.accumulatedTime) || 0;
          const deltaSinceClose = wasPaused ? 0 : Math.max(0, Math.floor((now - lastTs) / 1000));
          const restoredElapsed = baseElapsed + deltaSinceClose;

          accumulatedBaseRef.current = restoredElapsed;

          if (wasPaused) {
            desiredRunningRef.current = false;
            setIsPaused(true);
            isPausedRef.current = true;
            startTimeRef.current = null;
          } else {
            desiredRunningRef.current = true;
            setIsPaused(false);
            isPausedRef.current = false;
            startTimeRef.current = now;
            audioRef.current.play().catch(() => {});
          }

          // Recalcula display conforme modo
          updateDisplayFromElapsed(restoredElapsed);

          // Atualiza title/media
          const display = (mode === 'countdown')
            ? Math.max(0, (Number(initialSeconds) || 0) - restoredElapsed)
            : restoredElapsed;

          updateExternalStatus(!wasPaused, display);
          updateMediaSession(!wasPaused, display);

          safeUpdateFirebase(!wasPaused);
        }
      } catch (e) {
        console.error("Erro restore:", e);
      }
    }

    return () => {
      clearInterval(intervalRef.current);
      if (audioRef.current) audioRef.current.pause();
      if (alarmRef.current) alarmRef.current.pause();
      document.title = originalTitleRef.current;

      try {
        if ('mediaSession' in navigator && 'setPositionState' in navigator.mediaSession) {
          navigator.mediaSession.setPositionState(null);
        }
      } catch {}
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // --- Countdown Inicial (3..2..1) ---
  useEffect(() => {
    if (!isPreparing) return;

    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(c => c - 1), 1000);
      return () => clearTimeout(timer);
    }

    // start
    setIsPreparing(false);

    timeUpFiredRef.current = false;

    accumulatedBaseRef.current = 0;
    startTimeRef.current = Date.now();

    desiredRunningRef.current = true;
    lastExplicitToggleAtRef.current = Date.now();

    setIsPaused(false);
    isPausedRef.current = false;

    if (audioRef.current) audioRef.current.play().catch(() => {});

    // display inicial
    const displayInitial = mode === 'countdown' ? Number(initialSeconds) || 0 : 0;
    setSeconds(displayInitial);
    secondsRef.current = displayInitial;

    saveToStorage(false, 0, false);
    safeUpdateFirebase(true);

    updateExternalStatus(true, displayInitial);
    updateMediaSession(true, displayInitial);
  }, [isPreparing, countdown, mode, initialSeconds, saveToStorage, safeUpdateFirebase, updateExternalStatus, updateMediaSession]);

  // --- Loop do Timer (tick) ---
  useEffect(() => {
    if (isPreparing || isPaused) {
      clearInterval(intervalRef.current);
      return;
    }

    const tick = () => {
      const now = Date.now();
      const segStart = startTimeRef.current || now;
      const deltaSegment = Math.floor((now - segStart) / 1000);
      const elapsedTotal = (accumulatedBaseRef.current || 0) + Math.max(0, deltaSegment);

      // Atualiza display (remaining ou elapsed)
      updateDisplayFromElapsed(elapsedTotal);

      // Persistimos sempre ELAPSED no storage
      saveToStorage(false, elapsedTotal, false);

      // Atualiza title/media de acordo com display
      const display = (mode === 'countdown')
        ? Math.max(0, (Number(initialSeconds) || 0) - elapsedTotal)
        : elapsedTotal;

      updateExternalStatus(true, display);
      updateMediaSession(true, display);
    };

    tick();
    intervalRef.current = setInterval(tick, 1000);
    return () => clearInterval(intervalRef.current);
  }, [isPreparing, isPaused, mode, initialSeconds, updateDisplayFromElapsed, saveToStorage, updateExternalStatus, updateMediaSession]);

  // ✅ Heartbeat Firebase (mantém “vivo” no backend)
  useEffect(() => {
    if (isPreparing) return;
    if (!userUid) return;

    const t = setInterval(() => {
      // só manda heartbeat (merge)
      safeUpdateFirebase(!isPausedRef.current);
    }, 30000);

    return () => clearInterval(t);
  }, [isPreparing, userUid, safeUpdateFirebase]);

  // ✅ WATCHDOG: Corrigido para não brigar com o YouTube
  useEffect(() => {
    if (isPreparing) return;

    const t = setInterval(() => {
      // se usuário quer pausado, não mexe
      if (!desiredRunningRef.current) return;

      // se countdown acabou, não mexe
      if (mode === 'countdown' && secondsRef.current <= 0) return;

      const sinceToggle = Date.now() - (lastExplicitToggleAtRef.current || 0);
      if (sinceToggle < 1200) return;

      if (isPausedRef.current) {
        resumeSimulado('watchdog');
      }

      // 🔴 CORREÇÃO: Removido o bloco que forçava audioRef.current.play()
      // Se o browser/SO pausou o áudio (ex: Youtube), deixamos pausado.
      // O timer visual continua rodando normalmente.

    }, 1500);

    return () => clearInterval(t);
  }, [isPreparing, mode, resumeSimulado]);

  // --- HANDLERS STOP/CANCEL (inclui MediaSession) ---
  const handleStop = useCallback(() => {
    desiredRunningRef.current = false;

    clearInterval(intervalRef.current);
    if (audioRef.current) audioRef.current.pause();

    // computa ELAPSED final
    let finalElapsed = accumulatedBaseRef.current || 0;
    if (!isPausedRef.current && startTimeRef.current) {
      const delta = Math.floor((Date.now() - startTimeRef.current) / 1000);
      finalElapsed += Math.max(0, delta);
    }

    // marca finalizado no storage
    saveToStorage(true, finalElapsed, true);

    // limpa firebase
    safeRemoveFirebase();

    // atualiza media/title como pausado
    const display = (mode === 'countdown')
      ? Math.max(0, (Number(initialSeconds) || 0) - finalElapsed)
      : finalElapsed;

    updateExternalStatus(false, display);
    updateMediaSession(false, display);

    // retorna minutos
    const minutes = Math.max(1, Math.round(finalElapsed / 60));
    onStop(minutes);
  }, [mode, initialSeconds, saveToStorage, safeRemoveFirebase, updateExternalStatus, updateMediaSession, onStop]);

  useEffect(() => { handleStopRef.current = handleStop; }, [handleStop]);

  const handleCancelSession = useCallback(() => {
    desiredRunningRef.current = false;

    clearInterval(intervalRef.current);
    localStorage.removeItem(STORAGE_KEY);
    safeRemoveFirebase();

    updateExternalStatus(false, secondsRef.current);
    updateMediaSession(false, secondsRef.current);

    onCancel();
  }, [STORAGE_KEY, safeRemoveFirebase, updateExternalStatus, updateMediaSession, onCancel]);

  const toggleTheme = () => {
    if (isDark) {
      document.documentElement.classList.remove('dark');
      setIsDark(false);
    } else {
      document.documentElement.classList.add('dark');
      setIsDark(true);
    }
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {});
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {});
    }
  };

  // --- RENDER: MODO MINIMIZADO ---
  if (isMinimized) {
    const borderColor = isPaused ? '#fbbf24' : themeColor;
    return (
      <motion.div
        layout
        initial={{ y: 100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 100, opacity: 0 }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
        className="fixed right-4 bottom-24 z-[9999]"
      >
        <div
          className="bg-white/95 dark:bg-zinc-900/95 backdrop-blur-md border shadow-2xl rounded-2xl p-3 flex items-center gap-4 w-auto max-w-[300px] cursor-pointer hover:scale-105 transition-transform"
          style={{ borderColor: `${borderColor}60` }}
          onClick={onMaximize}
        >
          <div className="relative flex items-center justify-center w-10 h-10 bg-zinc-100 dark:bg-zinc-800 rounded-full shrink-0">
            <div className={`absolute inset-0 rounded-full ${isPaused ? '' : 'animate-ping'}`} style={{ backgroundColor: isPaused ? 'transparent' : `${themeColor}40` }}></div>
            <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: isPaused ? '#fbbf24' : themeColor }}></div>
          </div>

          <div className="flex flex-col mr-2 min-w-0">
            <span className="text-[10px] text-zinc-500 dark:text-zinc-400 uppercase font-bold tracking-wider truncate">
              {tituloSimulado || 'Simulado'}
            </span>
            <span className={`text-xl font-mono font-bold leading-none ${mode === 'countdown' && seconds < 600 ? 'text-red-500 animate-pulse' : 'text-zinc-900 dark:text-white'}`}>
              {formatClock(seconds)}
            </span>
          </div>

          <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => handleTogglePause('user')}
              className="p-2 rounded-full bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-900 dark:text-white transition-colors"
            >
              {isPaused ? <Play size={14} fill="currentColor" /> : <Pause size={14} fill="currentColor" />}
            </button>
          </div>
        </div>
      </motion.div>
    );
  }

  // --- RENDER: MODO FULL ---
  return (
    <div className="fixed inset-0 z-[9999] bg-zinc-50 dark:bg-zinc-950 flex flex-col items-center justify-center animate-fade-in overflow-hidden font-sans">
      <ConfirmationModal
        isOpen={isCancelModalOpen}
        onConfirm={handleCancelSession}
        onCancel={() => setIsCancelModalOpen(false)}
        title="Cancelar Simulado?"
        description="Todo o progresso será perdido."
        confirmText="Sim, Cancelar"
        isDestructive={true}
      />

      <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, currentColor 1px, transparent 0)', backgroundSize: '40px 40px', color: themeColor }}></div>
      <div className="absolute top-0 left-0 w-full h-1 opacity-50" style={{ background: `linear-gradient(90deg, transparent, ${themeColor}, transparent)` }}></div>

      <div className="absolute top-6 left-1/2 -translate-x-1/2 z-20 opacity-80 pointer-events-none transition-all">
        <img src="/logo-pmba.png" alt="Logo" className="h-20 md:h-22 w-auto drop-shadow-2xl grayscale-[0.2]" />
      </div>

      <div className="absolute top-6 right-6 flex gap-3 z-[100]">
        <button onClick={toggleTheme} className="p-3 rounded-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-white transition-all">
          {isDark ? <Sun size={20} /> : <Moon size={20} />}
        </button>
        <button onClick={toggleFullscreen} className="p-3 rounded-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-white transition-all">
          {isFullscreen ? <Minimize2 size={20} /> : <Maximize size={20} />}
        </button>
        <button onClick={onMinimize} className="flex items-center gap-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 px-4 py-2 rounded-full shadow-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-white transition-all">
          <Minimize2 size={20} />
          <span className="hidden md:inline text-sm font-bold uppercase tracking-wide">Minimizar</span>
        </button>
      </div>

      <AnimatePresence>
        {isPreparing && (
          <motion.div
            className="absolute inset-0 z-50 flex flex-col items-center justify-center"
            initial={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{ backgroundColor: isDark ? '#09090b' : '#fafafa' }}
          >
            <motion.div
              key={countdown}
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1.5, opacity: 1 }}
              exit={{ scale: 2, opacity: 0 }}
              transition={{ duration: 0.5 }}
              className="relative text-[15rem] font-black drop-shadow-2xl"
            >
              {/* ✅ Efeito de Glow idêntico ao StudyTimer */}
              <div className="absolute inset-0 blur-[100px] rounded-full" style={{ backgroundColor: themeColor, opacity: 0.3 }} />
              <span className="relative z-10 text-zinc-900 dark:text-white">{countdown > 0 ? countdown : "GO!"}</span>
            </motion.div>
            <p className="mt-8 text-zinc-500 text-xl uppercase tracking-[0.5em] font-bold">Boa Prova</p>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="relative z-10 flex flex-col items-center text-center w-full max-w-5xl px-4 mt-20">
        <div
          className="mb-8 px-5 py-2 rounded-full border text-[10px] md:text-xs font-bold tracking-[0.2em] uppercase flex items-center gap-3 transition-colors shadow-sm bg-white dark:bg-zinc-900"
          style={{ borderColor: isPaused ? '#fbbf24' : `${themeColor}40`, color: isPaused ? '#d97706' : themeColor }}
        >
          <span className={`w-2 h-2 rounded-full ${isPaused ? 'bg-amber-400' : 'animate-pulse'}`} style={{ backgroundColor: isPaused ? undefined : themeColor }}></span>
          {isPaused ? 'Simulado Pausado' : (mode === 'countdown' ? 'Tempo Restante' : 'Tempo Decorrido')}
        </div>

        <h2 className="text-xl md:text-4xl font-bold text-zinc-800 dark:text-zinc-300 mb-2 tracking-tight max-w-3xl leading-tight">
          {tituloSimulado || "Simulado"}
        </h2>

        <div className="flex items-center gap-2 text-zinc-500 dark:text-zinc-400 text-sm font-bold uppercase tracking-wide mb-10">
          <ClipboardList size={16} />
          <span>Simulado</span>
        </div>

        <div className="relative mb-16 md:mb-20">
          {/* ✅ Efeito de Blur atrás do cronômetro (estilo StudyTimer) */}
          <div className="absolute -inset-10 blur-[60px] md:blur-[100px] opacity-20 rounded-full transition-colors duration-700" style={{ backgroundColor: isPaused ? '#71717a' : themeColor }}></div>
          <div
            className="text-7xl sm:text-9xl md:text-[12rem] font-mono font-bold leading-none tracking-tighter tabular-nums transition-colors duration-300 select-none drop-shadow-2xl"
            style={{ color: isPaused ? '#a1a1aa' : (mode === 'countdown' && seconds < 600 ? '#ef4444' : '#18181b') }}
          >
            {/* ✅ Texto branco no dark mode, como pedido */}
            <span className={`${isPaused ? 'text-zinc-400' : (mode === 'countdown' && seconds < 600 ? 'text-red-500 animate-pulse' : 'text-zinc-900 dark:text-white')}`}>
              {formatClock(seconds)}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-6 md:gap-12">
          <button onClick={() => setIsCancelModalOpen(true)} className="group flex flex-col items-center gap-2 text-zinc-400 hover:text-red-500 transition-colors">
            <div className="w-14 h-14 rounded-full border-2 border-zinc-200 dark:border-zinc-800 group-hover:border-red-500/50 flex items-center justify-center bg-white dark:bg-zinc-900 transition-all shadow-sm">
              <X size={24} />
            </div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-center">Abandonar</span>
          </button>

          <button
            onClick={() => handleTogglePause('user')}
            className="w-24 h-24 md:w-32 md:h-32 rounded-full flex flex-col items-center justify-center shadow-2xl transition-all transform hover:scale-105 active:scale-95 text-white"
            style={{ backgroundColor: isPaused ? '#f59e0b' : themeColor }}
          >
            {isPaused ? <Play size={36} fill="currentColor" className="ml-1" /> : <Pause size={36} fill="currentColor" />}
            <span className="mt-2 text-[10px] md:text-sm font-bold uppercase">{isPaused ? 'Retomar' : 'Pausar'}</span>
          </button>

          <button onClick={handleStop} className="group flex flex-col items-center gap-2 text-zinc-400 hover:text-emerald-500 transition-colors">
            <div className="w-14 h-14 rounded-full border-2 border-zinc-200 dark:border-zinc-800 group-hover:border-emerald-500/50 flex items-center justify-center bg-white dark:bg-zinc-900 transition-all shadow-sm">
              <Square size={24} fill="currentColor" />
            </div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-center">Finalizar</span>
          </button>
        </div>
      </div>
    </div>
  );
}

export default SimuladoTimer;