import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  Play, Pause, Square, Minimize2, X, AlertTriangle,
  Maximize, Sun, Moon, ClipboardList
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { doc, setDoc, deleteDoc, serverTimestamp, onSnapshot } from 'firebase/firestore';
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
  mode = 'free',
  initialSeconds = 0,
  onStop,
  onCancel,
  isMinimized,
  onMaximize,
  onMinimize,
  userUid,
  userName,
  userPhotoURL
}) {
  const themeColor = '#dc2626';
  const STORAGE_KEY = useMemo(() => `@ModoQAP:SimuladoActive:${userUid}`, [userUid]);

  const tabIdRef = useRef(
    (() => {
      try { if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID(); } catch {}
      return `tab_${Math.random().toString(16).slice(2)}_${Date.now()}`;
    })()
  );

  const mountedAtRef = useRef(Date.now());
  const hasWrittenFirebaseRef = useRef(false);
  const hasEverSeenDocRef = useRef(false);

  const bcRef = useRef(null);

  const [isPreparing, setIsPreparing] = useState(true);
  const [countdown, setCountdown] = useState(3);
  const [isDark, setIsDark] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);

  const [seconds, setSeconds] = useState(0);
  const [isPaused, setIsPaused] = useState(false);

  const intervalRef = useRef(null);

  const audioRef = useRef(null);
  const alarmRef = useRef(null);

  // ✅ Motor em MILISSEGUNDOS (NUNCA PULA)
  const startTimeMsRef = useRef(null);   // Date.now() quando rodando
  const accumulatedMsRef = useRef(0);    // total acumulado em ms quando pausado/antes do run atual

  const secondsRef = useRef(0);
  const isPausedRef = useRef(false);

  const originalTitleRef = useRef(document.title);

  const desiredRunningRef = useRef(false);
  const lastExplicitToggleAtRef = useRef(0);

  const timeUpFiredRef = useRef(false);
  const lastAppliedRemoteSigRef = useRef('');

  // anti-jitter local
  const lastLocalRunStartMsRef = useRef(0);
  const lastLocalElapsedMsAtRunStartRef = useRef(0);

  // persist leve
  const lastPersistSecondRef = useRef(-1);

  useEffect(() => { secondsRef.current = seconds; }, [seconds]);
  useEffect(() => { isPausedRef.current = isPaused; }, [isPaused]);

  const simuladoDocRef = useMemo(() => {
    if (!userUid) return null;
    return doc(db, 'users', userUid, 'personal_timers', 'active_simulado');
  }, [userUid]);

  const globalTimerRef = useMemo(() => {
    if (!userUid) return null;
    return doc(db, 'active_timers', userUid);
  }, [userUid]);

  // ✅ elapsed atual em ms
  const getCurrentElapsedMs = useCallback(() => {
    let ms = accumulatedMsRef.current || 0;
    if (!isPausedRef.current && startTimeMsRef.current) {
      ms += Math.max(0, Date.now() - startTimeMsRef.current);
    }
    return Math.max(0, Number(ms) || 0);
  }, []);

  // ✅ converte ms -> segundos para display (1 único floor)
  const msToDisplaySeconds = useCallback((elapsedMs) => {
    const elapsedSec = Math.floor(Math.max(0, Number(elapsedMs) || 0) / 1000);
    if (mode === 'countdown') {
      const total = Math.max(0, Number(initialSeconds) || 0);
      return Math.max(0, total - elapsedSec);
    }
    return elapsedSec;
  }, [mode, initialSeconds]);

  const saveToStorage = useCallback((paused, currentElapsedMs, finished = false) => {
    const data = {
      titulo: tituloSimulado,
      mode,
      initialSeconds,
      accumulatedTimeMs: Number(currentElapsedMs) || 0, // ms
      accumulatedTime: Math.floor((Number(currentElapsedMs) || 0) / 1000), // compat (sec)
      isPaused: paused,
      lastTimestamp: Date.now(),
      isFinished: finished
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }, [STORAGE_KEY, tituloSimulado, mode, initialSeconds]);

  const updateExternalStatus = useCallback((isRunning, displaySeconds) => {
    const timeStr = formatClock(displaySeconds);
    const label = mode === 'countdown' ? 'Restante' : 'Tempo';
    const status = isRunning ? 'Simulado' : 'Simulado Pausado';
    document.title = `${status} • ${label}: ${timeStr}`;
  }, [mode]);

  const computeMediaPositionState = useCallback((displaySeconds) => {
    let duration = 60;
    let position = 0;

    if (mode === 'countdown') {
      const total = Math.max(1, Number(initialSeconds) || 1);
      duration = total;
      const remaining = Math.max(0, Number(displaySeconds) || 0);
      position = Math.min(total, Math.max(0, total - remaining));
      return { duration, position };
    }

    position = Math.max(0, Number(displaySeconds) || 0);
    duration = Math.max(3600, position + 60);
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
  }, [tituloSimulado, computeMediaPositionState, mode]);

  const clearTimers = useCallback(() => {
    clearInterval(intervalRef.current);
    intervalRef.current = null;
  }, []);

  const handleTimeUp = useCallback(() => {
    if (timeUpFiredRef.current) return;
    timeUpFiredRef.current = true;

    if (alarmRef.current) alarmRef.current.play().catch(() => {});
    safeNotify("Tempo do simulado acabou!", "O cronômetro zerou.");
  }, []);

  // ✅ render a partir de ms
  const renderFromElapsedMs = useCallback((elapsedMs) => {
    const display = msToDisplaySeconds(elapsedMs);

    // só atualiza se mudou o segundo (evita render sem necessidade)
    if (display !== secondsRef.current) {
      setSeconds(display);
      secondsRef.current = display;
    }

    if (mode === 'countdown' && display <= 0) {
      handleTimeUp();
    }
  }, [msToDisplaySeconds, mode, handleTimeUp]);

  // ✅ LOOP DO TIMER (antes isso tinha sumido, por isso congelou)
  const startTickLoop = useCallback(() => {
    clearTimers();

    const tick = () => {
      if (isPausedRef.current) return;

      const elapsedMsNow = getCurrentElapsedMs();
      renderFromElapsedMs(elapsedMsNow);

      // persist a cada segundo real (leve)
      const elapsedSecNow = Math.floor(elapsedMsNow / 1000);
      if (elapsedSecNow !== lastPersistSecondRef.current) {
        lastPersistSecondRef.current = elapsedSecNow;

        saveToStorage(false, elapsedMsNow, false);
        updateExternalStatus(true, secondsRef.current);
        updateMediaSession(true, secondsRef.current);

        if (mode === 'countdown' && secondsRef.current <= 0) {
          // cai para pause "timeup"
          pauseSimuladoRef.current?.('timeup');
        }
      }
    };

    // tick curto pra manter responsivo (sem pulo e sem pesar)
    tick();
    intervalRef.current = setInterval(tick, 200);
  }, [clearTimers, getCurrentElapsedMs, renderFromElapsedMs, saveToStorage, updateExternalStatus, updateMediaSession, mode]);

  // ref pra evitar deps circulares com pauseSimulado
  const pauseSimuladoRef = useRef(null);

  const postBC = useCallback((payload) => {
    try {
      if (!bcRef.current) return;
      bcRef.current.postMessage({ from: tabIdRef.current, ...payload });
    } catch {}
  }, []);

  const safeUpdateFirebase = useCallback(async (isRunning) => {
    if (!userUid) return;

    const elapsedMsNow = getCurrentElapsedMs();
    const elapsedSecNow = Math.floor(elapsedMsNow / 1000);

    const payload = {
      uid: userUid,
      userName: userName || 'Candidato',
      photoURL: userPhotoURL || null,
      titulo: tituloSimulado || 'Simulado Sem Título',
      disciplinaNome: tituloSimulado || 'Simulado',
      assunto: 'Prova em Andamento',
      mode: mode || 'free',
      initialSeconds: Number(initialSeconds) || 0, // ✅ IMPORTANTE pro dashboard
      status: isRunning ? 'running' : 'paused',

      secondsSnapshot: Number(secondsRef.current) || 0,
      elapsedSnapshot: Number(elapsedSecNow) || 0,
      elapsedMsSnapshot: Number(elapsedMsNow) || 0,

      runStartedAt: isRunning ? serverTimestamp() : null,
      elapsedAtRunStart: isRunning ? Math.floor((Number(lastLocalElapsedMsAtRunStartRef.current || accumulatedMsRef.current || 0)) / 1000) : null,
      elapsedMsAtRunStart: isRunning ? Number(lastLocalElapsedMsAtRunStartRef.current || accumulatedMsRef.current || 0) : null,

      updatedBy: tabIdRef.current,
      updatedAt: serverTimestamp(),
      heartbeatAt: serverTimestamp(),
      isSimulado: true,
      timerType: 'simulado'
    };

    try {
      if (simuladoDocRef) await setDoc(simuladoDocRef, payload, { merge: true });
      if (globalTimerRef) await setDoc(globalTimerRef, payload, { merge: true });

      hasWrittenFirebaseRef.current = true;
    } catch (e) {
      console.warn("Firebase Sync ignorado (Permissão ou Rede):", e?.message);
    }
  }, [simuladoDocRef, globalTimerRef, userUid, userName, userPhotoURL, tituloSimulado, mode, initialSeconds, getCurrentElapsedMs]);

  const safeRemoveFirebase = useCallback(async () => {
    try {
      if (simuladoDocRef) await deleteDoc(simuladoDocRef);
      if (globalTimerRef) await deleteDoc(globalTimerRef);
    } catch (e) {
      console.warn("Erro ao limpar Firebase:", e?.message);
    }
  }, [simuladoDocRef, globalTimerRef]);

  // ✅ aplica estado remoto/local por ms sem pulo
  const applyStateFromElapsedMs = useCallback((nextRunning, nextElapsedMs, source = 'remote') => {
    const elapsedMs = Math.max(0, Number(nextElapsedMs) || 0);

    clearTimers();
    accumulatedMsRef.current = elapsedMs;

    if (nextRunning) {
      startTimeMsRef.current = Date.now();
      desiredRunningRef.current = true;

      lastLocalRunStartMsRef.current = startTimeMsRef.current;
      lastLocalElapsedMsAtRunStartRef.current = elapsedMs;

      setIsPaused(false);
      isPausedRef.current = false;

      if (audioRef.current) audioRef.current.play().catch(() => {});
      startTickLoop(); // ✅ IMPORTANTE: voltar a “rodar” o display
    } else {
      startTimeMsRef.current = null;
      desiredRunningRef.current = false;

      setIsPaused(true);
      isPausedRef.current = true;

      if (audioRef.current) audioRef.current.pause();
    }

    renderFromElapsedMs(elapsedMs);
    saveToStorage(!nextRunning, elapsedMs, false);
    updateExternalStatus(nextRunning, secondsRef.current);
    updateMediaSession(nextRunning, secondsRef.current);

    void source;
  }, [clearTimers, renderFromElapsedMs, saveToStorage, updateExternalStatus, updateMediaSession, startTickLoop]);

  // BroadcastChannel
  useEffect(() => {
    if (!userUid) return;

    const channelName = `ModoQAP:SimuladoBC:${userUid}`;
    try {
      bcRef.current = new BroadcastChannel(channelName);
    } catch {
      bcRef.current = null;
    }
    if (!bcRef.current) return;

    bcRef.current.onmessage = (ev) => {
      const msg = ev?.data;
      if (!msg || msg.from === tabIdRef.current) return;
      if (msg.type !== 'SIMULADO_SYNC') return;

      if (typeof msg.running === 'boolean' && Number.isFinite(Number(msg.elapsedMs))) {
        applyStateFromElapsedMs(msg.running, Number(msg.elapsedMs), 'bc');
      }

      if (msg.action === 'CANCEL') {
        clearTimers();
        try { localStorage.removeItem(STORAGE_KEY); } catch {}
        onCancel?.();
      }

      if (msg.action === 'STOP') {
        clearTimers();
        try { localStorage.removeItem(STORAGE_KEY); } catch {}
        onCancel?.();
      }
    };

    return () => {
      try { bcRef.current?.close?.(); } catch {}
      bcRef.current = null;
    };
  }, [userUid, applyStateFromElapsedMs, STORAGE_KEY, onCancel, clearTimers]);

  // ✅ PAUSE (ms exato)
  const pauseSimulado = useCallback(async (source = 'user') => {
    if (isPausedRef.current) return;

    desiredRunningRef.current = false;
    if (source !== 'watchdog' && source !== 'remote' && source !== 'bc') lastExplicitToggleAtRef.current = Date.now();

    const frozenMs = getCurrentElapsedMs();

    clearTimers();
    accumulatedMsRef.current = frozenMs;
    startTimeMsRef.current = null;

    setIsPaused(true);
    isPausedRef.current = true;

    renderFromElapsedMs(frozenMs);
    saveToStorage(true, frozenMs, false);

    updateExternalStatus(false, secondsRef.current);
    updateMediaSession(false, secondsRef.current);

    if (audioRef.current) audioRef.current.pause();

    if (source !== 'bc') postBC({ type: 'SIMULADO_SYNC', running: false, elapsedMs: frozenMs });
    if (source !== 'remote' && source !== 'bc') await safeUpdateFirebase(false);
  }, [getCurrentElapsedMs, clearTimers, renderFromElapsedMs, saveToStorage, updateExternalStatus, updateMediaSession, postBC, safeUpdateFirebase]);

  // guarda ref pro tick chamar pause timeup sem deps circulares
  useEffect(() => { pauseSimuladoRef.current = pauseSimulado; }, [pauseSimulado]);

  // ✅ RESUME (ms exato + tick loop)
  const resumeSimulado = useCallback(async (source = 'user') => {
    if (!isPausedRef.current) return;
    if (mode === 'countdown' && secondsRef.current <= 0) return;

    desiredRunningRef.current = true;
    if (source !== 'watchdog' && source !== 'remote' && source !== 'bc') lastExplicitToggleAtRef.current = Date.now();

    const baseMs = Math.max(0, Number(accumulatedMsRef.current || 0));

    startTimeMsRef.current = Date.now();
    lastLocalRunStartMsRef.current = startTimeMsRef.current;
    lastLocalElapsedMsAtRunStartRef.current = baseMs;

    setIsPaused(false);
    isPausedRef.current = false;

    if (audioRef.current) audioRef.current.play().catch(() => {});

    startTickLoop(); // ✅ IMPORTANTE: agora o display atualiza

    if (source !== 'bc') postBC({ type: 'SIMULADO_SYNC', running: true, elapsedMs: baseMs });
    if (source !== 'remote' && source !== 'bc') await safeUpdateFirebase(true);

    updateExternalStatus(true, secondsRef.current);
    updateMediaSession(true, secondsRef.current);
  }, [mode, startTickLoop, postBC, safeUpdateFirebase, updateExternalStatus, updateMediaSession]);

  const handleTogglePause = useCallback((source = 'user') => {
    if (isPausedRef.current) resumeSimulado(source);
    else pauseSimulado(source);
  }, [pauseSimulado, resumeSimulado]);

  const handleStopRef = useRef(null);
  const handleTogglePauseRef = useRef(null);
  useEffect(() => { handleTogglePauseRef.current = handleTogglePause; }, [handleTogglePause]);

  // MediaSession
  useEffect(() => {
    if (!('mediaSession' in navigator)) return;

    try {
      navigator.mediaSession.setActionHandler('play', () => handleTogglePauseRef.current?.('media_play'));
      navigator.mediaSession.setActionHandler('pause', () => handleTogglePauseRef.current?.('media_pause'));
      navigator.mediaSession.setActionHandler('stop', () => handleStopRef.current?.());
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

  // Setup Inicial & Restore
  useEffect(() => {
    audioRef.current = new Audio(WHITE_NOISE_URL);
    audioRef.current.loop = true;
    audioRef.current.volume = 0.01;
    try { audioRef.current.setAttribute('playsinline', ''); } catch {}
    alarmRef.current = new Audio(ALARM_URL);

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

          const baseMs = Number.isFinite(Number(data.accumulatedTimeMs))
            ? Number(data.accumulatedTimeMs)
            : (Number(data.accumulatedTime) || 0) * 1000;

          const deltaSinceCloseMs = wasPaused ? 0 : Math.max(0, now - lastTs);
          const restoredMs = Math.max(0, baseMs + deltaSinceCloseMs);

          accumulatedMsRef.current = restoredMs;

          if (wasPaused) {
            desiredRunningRef.current = false;
            setIsPaused(true);
            isPausedRef.current = true;
            startTimeMsRef.current = null;
          } else {
            desiredRunningRef.current = true;
            setIsPaused(false);
            isPausedRef.current = false;

            startTimeMsRef.current = now;
            lastLocalRunStartMsRef.current = now;
            lastLocalElapsedMsAtRunStartRef.current = restoredMs;

            audioRef.current.play().catch(() => {});
            startTickLoop(); // ✅ IMPORTANTE no restore rodando
          }

          renderFromElapsedMs(restoredMs);

          updateExternalStatus(!wasPaused, secondsRef.current);
          updateMediaSession(!wasPaused, secondsRef.current);

          safeUpdateFirebase(!wasPaused);
        }
      } catch (e) {
        console.error("Erro restore:", e);
      }
    }

    return () => {
      clearTimers();
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

  // Countdown Inicial (3..2..1)
  useEffect(() => {
    if (!isPreparing) return;

    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(c => c - 1), 1000);
      return () => clearTimeout(timer);
    }

    setIsPreparing(false);
    timeUpFiredRef.current = false;

    accumulatedMsRef.current = 0;

    const now = Date.now();
    startTimeMsRef.current = now;
    lastLocalRunStartMsRef.current = now;
    lastLocalElapsedMsAtRunStartRef.current = 0;

    desiredRunningRef.current = true;
    lastExplicitToggleAtRef.current = Date.now();

    setIsPaused(false);
    isPausedRef.current = false;

    if (audioRef.current) audioRef.current.play().catch(() => {});

    const displayInitial = mode === 'countdown' ? Number(initialSeconds) || 0 : 0;
    setSeconds(displayInitial);
    secondsRef.current = displayInitial;

    saveToStorage(false, 0, false);
    postBC({ type: 'SIMULADO_SYNC', running: true, elapsedMs: 0 });
    safeUpdateFirebase(true);

    updateExternalStatus(true, displayInitial);
    updateMediaSession(true, displayInitial);

    startTickLoop(); // ✅ IMPORTANTE: inicia o tick no start
  }, [isPreparing, countdown, mode, initialSeconds, saveToStorage, safeUpdateFirebase, updateExternalStatus, updateMediaSession, postBC, startTickLoop]);

  // Heartbeat
  useEffect(() => {
    if (isPreparing) return;
    if (!userUid) return;

    const t = setInterval(() => {
      safeUpdateFirebase(!isPausedRef.current);
    }, 30000);

    return () => clearInterval(t);
  }, [isPreparing, userUid, safeUpdateFirebase]);

  // Watchdog
  useEffect(() => {
    if (isPreparing) return;

    const t = setInterval(() => {
      if (!desiredRunningRef.current) return;
      if (mode === 'countdown' && secondsRef.current <= 0) return;

      const sinceToggle = Date.now() - (lastExplicitToggleAtRef.current || 0);
      if (sinceToggle < 1200) return;

      if (isPausedRef.current) {
        resumeSimulado('watchdog');
      }
    }, 1500);

    return () => clearInterval(t);
  }, [isPreparing, mode, resumeSimulado]);

  // Firestore sync (cross-device)
  useEffect(() => {
    if (!simuladoDocRef) return;

    const unsub = onSnapshot(
      simuladoDocRef,
      { includeMetadataChanges: true },
      (snap) => {
        if (snap.metadata?.hasPendingWrites) return;

        if (!snap.exists()) {
          const graceMs = 8000;
          const age = Date.now() - (mountedAtRef.current || Date.now());
          const canCancelNow = hasEverSeenDocRef.current || hasWrittenFirebaseRef.current || (!isPreparing && age > graceMs);
          if (!canCancelNow) return;

          clearTimers();
          try { localStorage.removeItem(STORAGE_KEY); } catch {}

          postBC({ type: 'SIMULADO_SYNC', action: 'CANCEL', running: false, elapsedMs: accumulatedMsRef.current || 0 });
          onCancel?.();
          return;
        }

        hasEverSeenDocRef.current = true;

        const data = snap.data() || {};
        if (!data.isSimulado && data.timerType !== 'simulado') return;
        if (data.updatedBy && data.updatedBy === tabIdRef.current) return;

        const sig = JSON.stringify({
          status: data.status,
          elapsedMsSnapshot: data.elapsedMsSnapshot,
          elapsedMsAtRunStart: data.elapsedMsAtRunStart,
          runStartedAt: data.runStartedAt ? (data.runStartedAt.toMillis ? data.runStartedAt.toMillis() : data.runStartedAt) : null,
          mode: data.mode,
          initialSeconds: data.initialSeconds,
          titulo: data.titulo
        });
        if (sig === lastAppliedRemoteSigRef.current) return;
        lastAppliedRemoteSigRef.current = sig;

        if (isPreparing) {
          setIsPreparing(false);
          setCountdown(0);
        }

        const remoteMode = data.mode || mode;
        const remoteInitialSeconds = Number(data.initialSeconds ?? initialSeconds) || 0;

        const isRemoteRunning = data.status === 'running';

        let remoteElapsedMs = NaN;

        if (isRemoteRunning && data.runStartedAt?.toMillis && Number.isFinite(Number(data.elapsedMsAtRunStart))) {
          const runStartedAtMs = data.runStartedAt.toMillis();
          const deltaMs = Math.max(0, Date.now() - runStartedAtMs);
          remoteElapsedMs = Math.max(0, Number(data.elapsedMsAtRunStart) + deltaMs);
        } else if (Number.isFinite(Number(data.elapsedMsSnapshot))) {
          remoteElapsedMs = Math.max(0, Number(data.elapsedMsSnapshot));
        } else if (Number.isFinite(Number(data.elapsedSnapshot))) {
          remoteElapsedMs = Math.max(0, Number(data.elapsedSnapshot) * 1000);
        } else {
          const secSnap = Math.max(0, Number(data.secondsSnapshot) || 0);
          if (remoteMode === 'countdown') {
            const total = remoteInitialSeconds;
            const elapsedSec = Math.max(0, total - secSnap);
            remoteElapsedMs = elapsedSec * 1000;
          } else {
            remoteElapsedMs = secSnap * 1000;
          }
        }

        const remoteElapsedMsInt = Math.max(0, Math.floor(Number(remoteElapsedMs) || 0));
        const localElapsedMsNow = getCurrentElapsedMs();

        const sameRunningState = (isRemoteRunning === !isPausedRef.current);
        const closeEnough = Math.abs(remoteElapsedMsInt - localElapsedMsNow) <= 750;

        // trava anti-jitter local: se eu acabei de dar play, não aceito remoto “adiantar”
        if (sameRunningState && isRemoteRunning && lastLocalRunStartMsRef.current) {
          const localDeltaMs = Math.max(0, Date.now() - lastLocalRunStartMsRef.current);
          const maxAllowed = Math.max(0, Number(lastLocalElapsedMsAtRunStartRef.current || 0) + localDeltaMs);

          if (remoteElapsedMsInt > maxAllowed + 250) {
            postBC({ type: 'SIMULADO_SYNC', running: true, elapsedMs: Math.min(remoteElapsedMsInt, maxAllowed) });
            return;
          }
        }

        if (sameRunningState && closeEnough) {
          postBC({ type: 'SIMULADO_SYNC', running: isRemoteRunning, elapsedMs: remoteElapsedMsInt });
          return;
        }

        applyStateFromElapsedMs(isRemoteRunning, remoteElapsedMsInt, 'remote');
        postBC({ type: 'SIMULADO_SYNC', running: isRemoteRunning, elapsedMs: remoteElapsedMsInt });

        void remoteMode;
        void remoteInitialSeconds;
      }
    );

    return () => unsub();
  }, [
    simuladoDocRef,
    STORAGE_KEY,
    onCancel,
    isPreparing,
    mode,
    initialSeconds,
    applyStateFromElapsedMs,
    postBC,
    clearTimers,
    getCurrentElapsedMs
  ]);

  const handleStop = useCallback(() => {
    desiredRunningRef.current = false;

    clearTimers();
    if (audioRef.current) audioRef.current.pause();

    const finalMs = getCurrentElapsedMs();

    saveToStorage(true, finalMs, true);
    postBC({ type: 'SIMULADO_SYNC', action: 'STOP', running: false, elapsedMs: finalMs });

    safeRemoveFirebase();

    const finalSec = Math.floor(finalMs / 1000);
    const display = (mode === 'countdown')
      ? Math.max(0, (Number(initialSeconds) || 0) - finalSec)
      : finalSec;

    updateExternalStatus(false, display);
    updateMediaSession(false, display);

    const minutes = Math.max(1, Math.round(finalSec / 60));
    onStop(minutes);
  }, [clearTimers, getCurrentElapsedMs, saveToStorage, postBC, safeRemoveFirebase, mode, initialSeconds, updateExternalStatus, updateMediaSession, onStop]);

  useEffect(() => { handleStopRef.current = handleStop; }, [handleStop]);

  const handleCancelSession = useCallback(() => {
    desiredRunningRef.current = false;

    clearTimers();
    localStorage.removeItem(STORAGE_KEY);

    postBC({ type: 'SIMULADO_SYNC', action: 'CANCEL', running: false, elapsedMs: accumulatedMsRef.current || 0 });

    safeRemoveFirebase();

    updateExternalStatus(false, secondsRef.current);
    updateMediaSession(false, secondsRef.current);

    onCancel();
  }, [clearTimers, STORAGE_KEY, postBC, safeRemoveFirebase, updateExternalStatus, updateMediaSession, onCancel]);

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

  // --- RENDER: MINIMIZADO ---
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

  // --- RENDER: FULL ---
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
          <div className="absolute -inset-10 blur-[60px] md:blur-[100px] opacity-20 rounded-full transition-colors duration-700" style={{ backgroundColor: isPaused ? '#71717a' : themeColor }}></div>
          <div
            className="text-7xl sm:text-9xl md:text-[12rem] font-mono font-bold leading-none tracking-tighter tabular-nums transition-colors duration-300 select-none drop-shadow-2xl"
            style={{ color: isPaused ? '#a1a1aa' : (mode === 'countdown' && seconds < 600 ? '#ef4444' : '#18181b') }}
          >
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

          <button onClick={handleStopRef.current || (() => {})} className="group flex flex-col items-center gap-2 text-zinc-400 hover:text-emerald-500 transition-colors">
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
