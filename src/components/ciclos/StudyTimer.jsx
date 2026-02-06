// StudyTimer.jsx
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  Play, Pause, Square, Minimize2, X, AlertTriangle,
  Maximize, Repeat, Coffee, CheckCircle2, Sun, Moon, AlarmClock
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTimerSettings } from './TimerSettingsModal';
import {
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
  onSnapshot
} from 'firebase/firestore';
import { db } from '../../firebaseConfig';

const WHITE_NOISE_URL = 'https://raw.githubusercontent.com/anars/blank-audio/master/10-minutes-of-silence.mp3';
const DEFAULT_ALARM_URL = 'https://actions.google.com/sounds/v1/alarms/beep_short.ogg';
const ACTIVE_TIMER_COLLECTION = 'active_timers';

const DEFAULT_SOUNDS = [
  { id: 'beep', url: 'https://actions.google.com/sounds/v1/alarms/beep_short.ogg' },
  { id: 'digital', url: 'https://actions.google.com/sounds/v1/alarms/digital_watch_alarm_long.ogg' },
  { id: 'mechanical', url: 'https://actions.google.com/sounds/v1/alarms/mechanical_clock_ring.ogg' },
  { id: 'bugle', url: 'https://actions.google.com/sounds/v1/alarms/bugle_tune.ogg' },
  { id: 'zen', url: 'https://cdn.freesound.org/previews/235/235886_3226359-lq.mp3' },
];

const formatClock = (totalSeconds) => {
  const safe = Math.max(0, Number(totalSeconds) || 0);
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const seconds = safe % 60;
  return [hours, minutes, seconds].map(v => String(v).padStart(2, '0')).join(':');
};

const formatHMFromSeconds = (totalSeconds) => {
  const safe = Math.max(0, Number(totalSeconds) || 0);
  const totalMinutes = Math.floor(safe / 60);
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
};

const rememberJson = (str) => {
  try { return JSON.parse(str || ''); } catch { return null; }
};

const ConfirmationModal = ({
  isOpen,
  onConfirm,
  onCancel,
  title,
  description,
  confirmText,
  isDestructive
}) => {
  if (!isOpen) return null;
  return (
    <motion.div
      className="fixed inset-0 z-[10000] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-2xl rounded-2xl p-6 w-full max-w-sm">
        <div className="flex items-start gap-4">
          <AlertTriangle className={`${isDestructive ? 'text-red-500' : 'text-amber-500'} mt-0.5 shrink-0`} size={24} />
          <div>
            <h3 className="text-lg font-bold text-zinc-900 dark:text-white mb-1">{title || 'Atenção'}</h3>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">{description}</p>
          </div>
        </div>
        <div className="mt-6 flex justify-end gap-3">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm font-semibold text-zinc-600 dark:text-zinc-300 bg-zinc-100 dark:bg-zinc-800 rounded-lg hover:bg-zinc-200 dark:hover:bg-zinc-700"
          >
            Cancelar
          </button>
          <button
            onClick={onConfirm}
            className={`px-4 py-2 text-sm font-bold text-white rounded-lg ${isDestructive ? 'bg-red-600 hover:bg-red-700' : 'bg-indigo-600 hover:bg-indigo-700'}`}
          >
            {confirmText || 'Confirmar'}
          </button>
        </div>
      </div>
    </motion.div>
  );
};

function StudyTimer({
  disciplina,
  assunto,
  onStop,
  onCancel,
  isMinimized,
  onMaximize: onWidgetMode,
  onMinimize: onWidgetMinimize,
  raised = false,

  userUid,
  userName,
  userPhotoURL,

  variant = 'study', // 'study' | 'simulado'
  timerMode, // 'free' | 'countdown' (apenas variant='simulado')
  countdownSeconds = 0, // apenas timerMode='countdown'
  storageKeyOverride,
  activeTimerCollectionOverride,
  activeTimerDocIdOverride,
  finishButtonLabel,
}) {
  const { settings } = useTimerSettings();

  // ========= IDs / cross-tab =========
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

  // ========= Storage Key =========
  const STORAGE_KEY = useMemo(() => {
    if (storageKeyOverride) return storageKeyOverride;
    return `@ModoQAP:ActiveSession:${userUid}`;
  }, [storageKeyOverride, userUid]);

  // ========= UI state =========
  const [isPreparing, setIsPreparing] = useState(true);
  const [countdown, setCountdown] = useState(3);

  const [seconds, setSeconds] = useState(0);
  const [totalFocusSeconds, setTotalFocusSeconds] = useState(0);

  const [isPaused, setIsPaused] = useState(false);
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isDark, setIsDark] = useState(true);

  // overlays (study)
  const [isPomodoroFinished, setIsPomodoroFinished] = useState(false);
  const [isResting, setIsResting] = useState(false);
  const [isRestFinished, setIsRestFinished] = useState(false);

  // ========= refs (evitar stale) =========
  const secondsRef = useRef(0);
  const isPausedRef = useRef(false);
  const isRestingRef = useRef(false);
  const isPomodoroFinishedRef = useRef(false);
  const isRestFinishedRef = useRef(false);

  useEffect(() => { secondsRef.current = seconds; }, [seconds]);
  useEffect(() => { isPausedRef.current = isPaused; }, [isPaused]);
  useEffect(() => { isRestingRef.current = isResting; }, [isResting]);
  useEffect(() => { isPomodoroFinishedRef.current = isPomodoroFinished; }, [isPomodoroFinished]);
  useEffect(() => { isRestFinishedRef.current = isRestFinished; }, [isRestFinished]);

  // ========= motor =========
  const intervalRef = useRef(null);

  // foco: acumulado (ms) + start (ms)
  const focusAccumulatedMsRef = useRef(0);
  const focusStartMsRef = useRef(null);

  // pomodoro: elapsed do bloco de foco (ms)
  const focusBlockElapsedBaseMsRef = useRef(0);

  // descanso: elapsed do descanso (ms)
  const restElapsedBaseMsRef = useRef(0);
  const restStartMsRef = useRef(null);

  // watchdog: intenção do usuário
  const desiredRunningRef = useRef(false);
  const lastExplicitToggleAtRef = useRef(0);

  // anti-jitter local
  const lastLocalRunStartMsRef = useRef(0);
  const lastLocalElapsedMsAtRunStartRef = useRef(0);

  // persist leve
  const lastPersistDisplaySecondRef = useRef(-1);

  // locks de ações
  const stopInFlightRef = useRef(false);
  const cancelInFlightRef = useRef(false);

  // ========= audio =========
  const audioRef = useRef(null);
  const alarmRef = useRef(null);
  const originalTitleRef = useRef(document.title);

  // ========= Wake Lock =========
  const wakeLockRef = useRef(null);
  const wakeLockWantedRef = useRef(false);

  const requestWakeLock = useCallback(async () => {
    try {
      if (!('wakeLock' in navigator)) return;
      if (!wakeLockWantedRef.current) return;
      if (wakeLockRef.current) return;

      const lock = await navigator.wakeLock.request('screen');
      wakeLockRef.current = lock;

      lock.addEventListener('release', () => {
        wakeLockRef.current = null;
      });
    } catch {}
  }, []);

  const releaseWakeLock = useCallback(async () => {
    try {
      wakeLockWantedRef.current = false;
      if (wakeLockRef.current) await wakeLockRef.current.release();
    } catch {}
    wakeLockRef.current = null;
  }, []);

  // ========= modo efetivo =========
  const effectiveMode = useMemo(() => {
    if (variant === 'simulado') {
      if (timerMode === 'countdown') return 'countdown';
      return 'free';
    }
    return settings.mode; // 'pomodoro' | 'free'
  }, [variant, timerMode, settings.mode]);

  const isPomodoro = effectiveMode === 'pomodoro';
  const isCountdown = effectiveMode === 'countdown';

  const safeCountdownSeconds = useMemo(() => {
    const n = Number(countdownSeconds) || 0;
    return Math.max(0, Math.floor(n));
  }, [countdownSeconds]);

  const themeColor = (variant !== 'simulado' && isResting) ? '#3B82F6' : settings.color;

  // ========= Firestore doc =========
  const activeTimerCollectionName = activeTimerCollectionOverride || ACTIVE_TIMER_COLLECTION;
  const activeTimerDocId = activeTimerDocIdOverride || userUid;

  const activeTimerDocRef = useMemo(() => {
    if (!userUid) return null;
    if (!activeTimerCollectionName) return null;
    if (!activeTimerDocId) return null;
    return doc(db, activeTimerCollectionName, activeTimerDocId);
  }, [userUid, activeTimerCollectionName, activeTimerDocId]);

  // ========= helpers =========
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

  const getSoundUrl = useCallback(() => {
    if (settings.soundType === 'custom' && settings.customSoundUrl) return settings.customSoundUrl;
    const sound = DEFAULT_SOUNDS.find(s => s.id === settings.selectedSoundId) || DEFAULT_SOUNDS[0];
    return sound.url;
  }, [settings.soundType, settings.customSoundUrl, settings.selectedSoundId]);

  // ========= fechar overlays em qualquer aba/dispositivo (correção do seu bug) =========
  const closeAllOverlaysLocal = useCallback(() => {
    setIsCancelModalOpen(false);

    if (variant !== 'simulado') {
      if (isPomodoroFinishedRef.current) { setIsPomodoroFinished(false); isPomodoroFinishedRef.current = false; }
      if (isRestFinishedRef.current) { setIsRestFinished(false); isRestFinishedRef.current = false; }
    }
  }, [variant]);

  // ========= ms -> display seconds =========
  const getCurrentFocusElapsedMs = useCallback(() => {
    let ms = Number(focusAccumulatedMsRef.current || 0);
    if (!isPausedRef.current && focusStartMsRef.current) {
      ms += Math.max(0, Date.now() - focusStartMsRef.current);
    }
    return Math.max(0, ms);
  }, []);

  const getCurrentRestElapsedMs = useCallback(() => {
    let ms = Number(restElapsedBaseMsRef.current || 0);
    if (!isPausedRef.current && restStartMsRef.current) {
      ms += Math.max(0, Date.now() - restStartMsRef.current);
    }
    return Math.max(0, ms);
  }, []);

  const getCurrentPomodoroBlockElapsedMs = useCallback(() => {
    let ms = Number(focusBlockElapsedBaseMsRef.current || 0);
    if (!isPausedRef.current && focusStartMsRef.current) {
      ms += Math.max(0, Date.now() - focusStartMsRef.current);
    }
    return Math.max(0, ms);
  }, []);

  const getDisplaySecondsFromCurrentState = useCallback(() => {
    if (variant !== 'simulado' && isRestFinishedRef.current) return 0;
    if (variant !== 'simulado' && isPomodoroFinishedRef.current && !isRestingRef.current) return 0;

    if (effectiveMode === 'countdown') {
      const totalMs = Math.max(0, safeCountdownSeconds * 1000);
      const elapsedMs = getCurrentFocusElapsedMs();
      const remainingMs = Math.max(0, totalMs - elapsedMs);
      return Math.floor(remainingMs / 1000);
    }

    if (variant !== 'simulado' && isRestingRef.current) {
      const durationMs = Math.max(1, Number(settings.restTime || 1) * 60 * 1000);
      const elapsedMs = getCurrentRestElapsedMs();
      const remainingMs = Math.max(0, durationMs - elapsedMs);
      return Math.floor(remainingMs / 1000);
    }

    if (effectiveMode === 'pomodoro' && variant !== 'simulado') {
      const durationMs = Math.max(1, Number(settings.pomodoroTime || 1) * 60 * 1000);
      const elapsedMs = getCurrentPomodoroBlockElapsedMs();
      const remainingMs = Math.max(0, durationMs - elapsedMs);
      return Math.floor(remainingMs / 1000);
    }

    const elapsedMs = getCurrentFocusElapsedMs();
    return Math.floor(elapsedMs / 1000);
  }, [
    effectiveMode,
    variant,
    safeCountdownSeconds,
    settings.restTime,
    settings.pomodoroTime,
    getCurrentFocusElapsedMs,
    getCurrentRestElapsedMs,
    getCurrentPomodoroBlockElapsedMs
  ]);

  const setSecondsIfChanged = useCallback((nextSeconds) => {
    const safe = Math.max(0, Number(nextSeconds) || 0);
    if (safe !== secondsRef.current) {
      secondsRef.current = safe;
      setSeconds(safe);
    }
  }, []);

  // ========= title + media session =========
  const restoreDocumentTitle = useCallback(() => {
    try { document.title = originalTitleRef.current || 'ModoQAP'; } catch {}
  }, []);

  const clearMediaSession = useCallback(() => {
    try {
      if (!('mediaSession' in navigator)) return;
      navigator.mediaSession.playbackState = "none";
      if ('setPositionState' in navigator.mediaSession) {
        try { navigator.mediaSession.setPositionState(null); } catch {}
      }
      try { navigator.mediaSession.metadata = null; } catch {}
    } catch {}
  }, []);

  const updateExternalStatus = useCallback((isRunning, displaySeconds) => {
    const timeString = formatClock(displaySeconds);

    let prefix = "Pausado";
    if (variant === 'simulado') {
      prefix = isRunning ? "Simulado" : "Simulado Pausado";
    } else {
      if (isRestFinishedRef.current) prefix = "Descanso Acabou!";
      else if (isRestingRef.current) prefix = isRunning ? "Descansando" : "Descanso Pausado";
      else if (isPomodoroFinishedRef.current) prefix = "Concluído!";
      else if (isRunning) prefix = (settings.mode === 'pomodoro') ? "Focando" : "Estudando";
    }

    document.title = `${prefix}: ${timeString} - ${(disciplina?.nome || 'Disciplina')}`;
  }, [disciplina?.nome, settings.mode, variant]);

  const computeMediaPositionState = useCallback((displaySeconds) => {
    let duration = 60;
    let position = 0;

    if (effectiveMode === 'countdown') {
      const total = Math.max(1, safeCountdownSeconds || 1);
      duration = total;
      const remaining = Math.max(0, Number(displaySeconds) || 0);
      position = Math.min(total, Math.max(0, total - remaining));
      return { duration, position };
    }

    if (variant !== 'simulado' && isRestingRef.current) {
      const total = Math.max(1, Number(settings.restTime || 1) * 60);
      duration = total;
      const remaining = Math.max(0, Number(displaySeconds) || 0);
      position = Math.min(total, Math.max(0, total - remaining));
      return { duration, position };
    }

    if (effectiveMode === 'pomodoro' && variant !== 'simulado') {
      const total = Math.max(1, Number(settings.pomodoroTime || 1) * 60);
      duration = total;
      const remaining = Math.max(0, Number(displaySeconds) || 0);
      position = Math.min(total, Math.max(0, total - remaining));
      return { duration, position };
    }

    position = Math.max(0, Number(displaySeconds) || 0);
    duration = Math.max(3600, position + 60);
    return { duration, position };
  }, [effectiveMode, variant, settings.restTime, settings.pomodoroTime, safeCountdownSeconds]);

  const updateMediaSession = useCallback((isRunning, displaySeconds) => {
    if (!('mediaSession' in navigator)) return;
    try {
      const mainTitle = assunto
        ? `${disciplina?.nome || 'Disciplina'} • ${assunto}`
        : (disciplina?.nome || 'Disciplina');

      let contextLabel = 'Estudando';
      if (variant === 'simulado') contextLabel = 'Simulado';
      else if (isRestFinishedRef.current) contextLabel = 'Descanso Finalizado';
      else if (isRestingRef.current) contextLabel = 'Descansando';
      else if (settings.mode === 'pomodoro') contextLabel = 'Foco';

      const timerLine = `${contextLabel} • ${formatClock(displaySeconds)}`;

      navigator.mediaSession.metadata = new MediaMetadata({
        title: mainTitle,
        artist: timerLine,
        album: "ModoQAP",
        artwork: [{ src: '/logo-pmba.png', sizes: '512x512', type: 'image/png' }]
      });

      navigator.mediaSession.playbackState = isRunning ? "playing" : "paused";

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
  }, [assunto, disciplina?.nome, settings.mode, variant, computeMediaPositionState]);

  // ========= broadcast channel =========
  const postBC = useCallback((payload) => {
    try {
      if (!bcRef.current) return;
      bcRef.current.postMessage({ from: tabIdRef.current, ...payload });
    } catch {}
  }, []);

  useEffect(() => {
    if (!userUid) return;

    const channelName = `ModoQAP:StudyTimerBC:${userUid}:${activeTimerCollectionName || 'active_timers'}:${activeTimerDocId || userUid}`;
    try {
      bcRef.current = new BroadcastChannel(channelName);
    } catch {
      bcRef.current = null;
    }

    if (!bcRef.current) return;

    return () => {
      try { bcRef.current?.close?.(); } catch {}
      bcRef.current = null;
    };
  }, [userUid, activeTimerCollectionName, activeTimerDocId]);

  // ========= storage =========
  const saveToStorage = useCallback((payload) => {
    const currentStorage = rememberJson(localStorage.getItem(STORAGE_KEY)) || {};
    if (currentStorage.isFinishing) return;

    const data = {
      ...currentStorage,
      schemaVersion: 4,

      disciplinaId: disciplina?.id,
      disciplinaNome: disciplina?.nome,
      assunto: assunto ?? null,

      variant,
      mode: effectiveMode,

      pomodoroDuration: Number(settings.pomodoroTime || 0) * 60,
      restDuration: Number(settings.restTime || 0) * 60,
      countdownSeconds: isCountdown ? Number(safeCountdownSeconds) : 0,

      isPaused: !!payload.isPaused,
      isResting: !!payload.isResting,
      pomodoroBlockFinished: !!payload.pomodoroBlockFinished,
      restFinished: !!payload.restFinished,

      focusAccumulatedMs: Math.max(0, Number(payload.focusAccumulatedMs) || 0),
      focusBlockElapsedBaseMs: Math.max(0, Number(payload.focusBlockElapsedBaseMs) || 0),
      restElapsedBaseMs: Math.max(0, Number(payload.restElapsedBaseMs) || 0),

      lastTimestamp: Number(payload.lastTimestamp) || Date.now(),
    };

    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }, [
    STORAGE_KEY,
    disciplina?.id, disciplina?.nome, assunto,
    variant,
    effectiveMode,
    settings.pomodoroTime, settings.restTime,
    isCountdown, safeCountdownSeconds
  ]);

  // ========= tick loop =========
  const clearTick = useCallback(() => {
    clearInterval(intervalRef.current);
    intervalRef.current = null;
  }, []);

  // ========= Firestore payload / upsert / patch =========
  const buildActiveTimerPayload = useCallback((extra = {}) => {
    const phase =
      (variant !== 'simulado' && isRestFinishedRef.current) ? 'rest_finished'
        : (variant !== 'simulado' && isPomodoroFinishedRef.current) ? 'pomodoro_finished'
          : (variant !== 'simulado' && isRestingRef.current) ? 'rest'
            : 'focus';

    const timerTypeLabel =
      isCountdown ? 'cronometro'
        : (effectiveMode === 'pomodoro' ? 'pomodoro' : 'livre');

    const nowFocusElapsedMs = getCurrentFocusElapsedMs();
    const nowRestElapsedMs = getCurrentRestElapsedMs();
    const nowPomoElapsedMs = getCurrentPomodoroBlockElapsedMs();

    // 🔒 uiOverlay: garante “fecha overlay” cross-aba/dispositivo
    // - none quando rodando/pausado normal
    // - pomodoro_finished/rest_finished quando exibindo telas finais
    const uiOverlay =
      (variant !== 'simulado' && isRestFinishedRef.current) ? 'rest_finished'
        : (variant !== 'simulado' && isPomodoroFinishedRef.current) ? 'pomodoro_finished'
          : (isCancelModalOpen ? 'cancel_confirm' : 'none');

    return {
      uid: userUid || null,
      userName: userName || 'Estudante',
      userPhotoURL: userPhotoURL || null,

      disciplinaId: disciplina?.id || null,
      disciplinaNome: disciplina?.nome || '',
      assunto: assunto ?? null,

      timerType: timerTypeLabel,
      mode: effectiveMode,
      variant: variant || 'study',

      phase,
      uiOverlay,

      isPaused: !!isPausedRef.current,
      isResting: !!isRestingRef.current,

      displaySecondsSnapshot: Number(secondsRef.current || 0),
      snapshotAt: serverTimestamp(),

      focusElapsedMsSnapshot: Number(nowFocusElapsedMs || 0),
      restElapsedMsSnapshot: Number(nowRestElapsedMs || 0),
      pomodoroElapsedMsSnapshot: Number(nowPomoElapsedMs || 0),

      status: isPausedRef.current ? 'paused' : 'running',
      runStartedAt: (!isPausedRef.current) ? serverTimestamp() : null,

      elapsedMsAtRunStart: (!isPausedRef.current)
        ? (variant !== 'simulado' && isRestingRef.current)
          ? Number(restElapsedBaseMsRef.current || 0)
          : (effectiveMode === 'pomodoro' && variant !== 'simulado')
            ? Number(focusBlockElapsedBaseMsRef.current || 0)
            : Number(focusAccumulatedMsRef.current || 0)
        : null,

      countdownSeconds: isCountdown ? Number(safeCountdownSeconds || 0) : 0,
      pomodoroSeconds: Number(settings.pomodoroTime || 0) * 60,
      restSeconds: Number(settings.restTime || 0) * 60,

      updatedBy: tabIdRef.current,
      updatedAt: serverTimestamp(),
      heartbeatAt: serverTimestamp(),

      ...extra,
    };
  }, [
    userUid, userName, userPhotoURL,
    disciplina?.id, disciplina?.nome, assunto,
    effectiveMode, variant, isCountdown, safeCountdownSeconds,
    settings.pomodoroTime, settings.restTime,
    getCurrentFocusElapsedMs, getCurrentRestElapsedMs, getCurrentPomodoroBlockElapsedMs,
    isCancelModalOpen
  ]);

  const upsertActiveTimer = useCallback(async (extra = {}, { merge = true } = {}) => {
    if (!activeTimerDocRef) return;
    try {
      const payload = buildActiveTimerPayload(extra);
      await setDoc(activeTimerDocRef, payload, { merge });
      hasWrittenFirebaseRef.current = true;
    } catch (e) {
      console.error('active_timers upsert error:', e);
    }
  }, [activeTimerDocRef, buildActiveTimerPayload]);

  const patchActiveTimer = useCallback(async (extra = {}, opts = {}) => {
    if (!activeTimerDocRef) return;

    const {
      includeSnapshot = true,
      touchUpdatedAt = true,
      touchHeartbeat = true,
    } = opts;

    const patch = {
      ...extra,
      ...(includeSnapshot ? {
        displaySecondsSnapshot: Number(secondsRef.current || 0),
        snapshotAt: serverTimestamp(),
        focusElapsedMsSnapshot: Number(getCurrentFocusElapsedMs() || 0),
        restElapsedMsSnapshot: Number(getCurrentRestElapsedMs() || 0),
        pomodoroElapsedMsSnapshot: Number(getCurrentPomodoroBlockElapsedMs() || 0),
      } : {}),
      ...(touchUpdatedAt ? { updatedAt: serverTimestamp() } : {}),
      ...(touchHeartbeat ? { heartbeatAt: serverTimestamp() } : {}),
    };

    try {
      await updateDoc(activeTimerDocRef, patch);
      hasWrittenFirebaseRef.current = true;
    } catch {
      await upsertActiveTimer(patch, { merge: true });
    }
  }, [activeTimerDocRef, upsertActiveTimer, getCurrentFocusElapsedMs, getCurrentRestElapsedMs, getCurrentPomodoroBlockElapsedMs]);

  const removeActiveTimer = useCallback(async () => {
    if (!activeTimerDocRef) return;
    try { await deleteDoc(activeTimerDocRef); } catch {}
  }, [activeTimerDocRef]);

  // ========= heartbeat =========
  useEffect(() => {
    if (!activeTimerDocRef) return;
    if (isPreparing) return;

    const t = setInterval(() => {
      patchActiveTimer({}, { includeSnapshot: false, touchUpdatedAt: true, touchHeartbeat: true });
    }, 30000);

    return () => clearInterval(t);
  }, [activeTimerDocRef, isPreparing, patchActiveTimer]);

  // ========= theme init =========
  useEffect(() => {
    if (document.documentElement.classList.contains('dark')) setIsDark(true);
    else setIsDark(false);
  }, []);

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

  // ========= exportLocalStateForSync =========
  const exportLocalStateForSync = useCallback(() => {
    const focusElapsedMs = getCurrentFocusElapsedMs();
    const restElapsedMs = getCurrentRestElapsedMs();
    const pomoElapsedMs = getCurrentPomodoroBlockElapsedMs();

    const uiOverlay =
      (variant !== 'simulado' && isRestFinishedRef.current) ? 'rest_finished'
        : (variant !== 'simulado' && isPomodoroFinishedRef.current) ? 'pomodoro_finished'
          : (isCancelModalOpen ? 'cancel_confirm' : 'none');

    return {
      variant,
      mode: effectiveMode,
      isPaused: !!isPausedRef.current,
      isResting: !!isRestingRef.current,
      isPomodoroFinished: !!isPomodoroFinishedRef.current,
      isRestFinished: !!isRestFinishedRef.current,
      focusElapsedMs,
      restElapsedMs,
      pomodoroElapsedMs: pomoElapsedMs,
      countdownSeconds: isCountdown ? Number(safeCountdownSeconds || 0) : 0,
      uiOverlay,
      updatedBy: tabIdRef.current,
      ts: Date.now(),
    };
  }, [
    variant,
    effectiveMode,
    isCountdown,
    safeCountdownSeconds,
    getCurrentFocusElapsedMs,
    getCurrentRestElapsedMs,
    getCurrentPomodoroBlockElapsedMs,
    isCancelModalOpen
  ]);

  // ========= STOP/CANCEL helpers =========
  const cleanupAndCancel = useCallback(async (source = 'local') => {
    if (cancelInFlightRef.current) return;
    cancelInFlightRef.current = true;

    desiredRunningRef.current = false;

    clearTick();
    try { audioRef.current?.pause?.(); } catch {}
    try { alarmRef.current?.pause?.(); } catch {}

    await releaseWakeLock();

    try { localStorage.removeItem(STORAGE_KEY); } catch {}
    await removeActiveTimer();

    restoreDocumentTitle();
    clearMediaSession();

    if (source !== 'bc') postBC({ type: 'TIMER_ACTION', action: 'CANCEL' });

    onCancel?.();

    setTimeout(() => { cancelInFlightRef.current = false; }, 250);
  }, [
    STORAGE_KEY,
    clearTick,
    removeActiveTimer,
    postBC,
    onCancel,
    releaseWakeLock,
    restoreDocumentTitle,
    clearMediaSession
  ]);

  const handleStopInternal = useCallback(async (reason = 'user') => {
    if (stopInFlightRef.current) return;
    stopInFlightRef.current = true;

    desiredRunningRef.current = false;

    clearTick();
    try { audioRef.current?.pause?.(); } catch {}
    try { alarmRef.current?.pause?.(); } catch {}

    await releaseWakeLock();

    const now = Date.now();

    if (variant !== 'simulado' && isRestingRef.current) {
      if (restStartMsRef.current) {
        const d = Math.max(0, now - restStartMsRef.current);
        restElapsedBaseMsRef.current = (restElapsedBaseMsRef.current || 0) + d;
        restStartMsRef.current = null;
      }
    } else {
      if (focusStartMsRef.current) {
        const d = Math.max(0, now - focusStartMsRef.current);
        focusAccumulatedMsRef.current = (focusAccumulatedMsRef.current || 0) + d;

        if (effectiveMode === 'pomodoro' && variant !== 'simulado') {
          focusBlockElapsedBaseMsRef.current = (focusBlockElapsedBaseMsRef.current || 0) + d;
        }

        focusStartMsRef.current = null;
      }
    }

    setIsPaused(true);
    isPausedRef.current = true;

    const totalFocusSec = Math.floor((focusAccumulatedMsRef.current || 0) / 1000);
    setTotalFocusSeconds(totalFocusSec);

    const display = getDisplaySecondsFromCurrentState();
    setSecondsIfChanged(display);

    saveToStorage({
      isPaused: true,
      isResting: !!isRestingRef.current,
      restFinished: !!isRestFinishedRef.current,
      pomodoroBlockFinished: !!isPomodoroFinishedRef.current,
      focusAccumulatedMs: focusAccumulatedMsRef.current || 0,
      focusBlockElapsedBaseMs: focusBlockElapsedBaseMsRef.current || 0,
      restElapsedBaseMs: restElapsedBaseMsRef.current || 0,
      lastTimestamp: Date.now(),
    });

    await patchActiveTimer({
      status: 'finishing',
      isPaused: true,
      runStartedAt: null,
      elapsedMsAtRunStart: null,
      // 🔒 garante que UI volte ao timer em outras abas/dispositivos quando nova sessão rodar
      uiOverlay: 'none',
    }, { includeSnapshot: true });

    if (reason !== 'bc') postBC({ type: 'TIMER_ACTION', action: 'STOP' });

    restoreDocumentTitle();
    clearMediaSession();

    const finalMinutes = Math.max(1, Math.round(totalFocusSec / 60));
    onStop?.(finalMinutes);

    setTimeout(() => { stopInFlightRef.current = false; }, 250);
  }, [
    clearTick,
    effectiveMode,
    variant,
    getDisplaySecondsFromCurrentState,
    setSecondsIfChanged,
    saveToStorage,
    patchActiveTimer,
    postBC,
    onStop,
    releaseWakeLock,
    restoreDocumentTitle,
    clearMediaSession
  ]);

  const cleanupAndStop = useCallback((source = 'local') => {
    void source;
    handleStopInternal(source === 'bc' ? 'bc' : 'user');
  }, [handleStopInternal]);

  const handleStop = useCallback(() => {
    handleStopInternal('user');
  }, [handleStopInternal]);

  // ========= tick =========
  const startTickLoop = useCallback(() => {
    clearTick();

    const tick = () => {
      if (isPausedRef.current) return;

      const display = getDisplaySecondsFromCurrentState();
      setSecondsIfChanged(display);

      const focusElapsedMsNow = getCurrentFocusElapsedMs();
      setTotalFocusSeconds(Math.floor(focusElapsedMsNow / 1000));

      if (display !== lastPersistDisplaySecondRef.current) {
        lastPersistDisplaySecondRef.current = display;

        saveToStorage({
          isPaused: false,
          isResting: !!isRestingRef.current,
          restFinished: !!isRestFinishedRef.current,
          pomodoroBlockFinished: !!isPomodoroFinishedRef.current,
          focusAccumulatedMs: focusElapsedMsNow,
          focusBlockElapsedBaseMs: getCurrentPomodoroBlockElapsedMs(),
          restElapsedBaseMs: getCurrentRestElapsedMs(),
          lastTimestamp: Date.now(),
        });

        updateExternalStatus(true, display);
        updateMediaSession(true, display);

        if (effectiveMode === 'countdown') {
          if (display <= 0) handleStopInternal('timeup');
        } else if (variant !== 'simulado' && isRestingRef.current) {
          if (display <= 0) handleRestComplete();
        } else if (effectiveMode === 'pomodoro' && variant !== 'simulado') {
          if (display <= 0) handlePomodoroComplete();
        }
      }
    };

    tick();
    intervalRef.current = setInterval(tick, 200);
  }, [
    clearTick,
    effectiveMode,
    variant,
    getDisplaySecondsFromCurrentState,
    setSecondsIfChanged,
    getCurrentFocusElapsedMs,
    getCurrentPomodoroBlockElapsedMs,
    getCurrentRestElapsedMs,
    saveToStorage,
    updateExternalStatus,
    updateMediaSession,
    handleStopInternal,
    // abaixo são declaradas depois, mas JS hoista apenas a const? não: são useCallback (ok porque estão no mesmo scope e já definidas no runtime)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  ]);

  // ========= completes (pomodoro/rest) =========
  const handlePomodoroComplete = useCallback(() => {
    clearTick();
    desiredRunningRef.current = false;

    const now = Date.now();
    if (focusStartMsRef.current) {
      const delta = Math.max(0, now - focusStartMsRef.current);

      focusBlockElapsedBaseMsRef.current = Math.min(
        Number(settings.pomodoroTime || 1) * 60 * 1000,
        (focusBlockElapsedBaseMsRef.current || 0) + delta
      );

      focusAccumulatedMsRef.current = (focusAccumulatedMsRef.current || 0) + delta;
      focusStartMsRef.current = null;
    }

    setIsPomodoroFinished(true);
    setIsPaused(true);
    isPomodoroFinishedRef.current = true;
    isPausedRef.current = true;

    setSecondsIfChanged(0);

    try { audioRef.current?.pause?.(); } catch {}
    if (alarmRef.current) {
      alarmRef.current.src = getSoundUrl();
      alarmRef.current.volume = settings.soundVolume || 0.5;
      alarmRef.current.play().catch(() => {});
    }

    setTotalFocusSeconds(Math.floor((focusAccumulatedMsRef.current || 0) / 1000));

    saveToStorage({
      isPaused: true,
      isResting: false,
      restFinished: false,
      pomodoroBlockFinished: true,
      focusAccumulatedMs: focusAccumulatedMsRef.current || 0,
      focusBlockElapsedBaseMs: focusBlockElapsedBaseMsRef.current || 0,
      restElapsedBaseMs: restElapsedBaseMsRef.current || 0,
      lastTimestamp: Date.now(),
    });

    updateExternalStatus(false, 0);
    updateMediaSession(false, 0);

    patchActiveTimer({
      status: 'pomodoro_finished',
      isPaused: true,
      runStartedAt: null,
      elapsedMsAtRunStart: null,
      phase: 'pomodoro_finished',
      uiOverlay: 'pomodoro_finished',
    }, { includeSnapshot: true });

    releaseWakeLock();
  }, [
    clearTick,
    getSoundUrl,
    settings.pomodoroTime,
    settings.soundVolume,
    saveToStorage,
    updateExternalStatus,
    updateMediaSession,
    patchActiveTimer,
    setSecondsIfChanged,
    releaseWakeLock
  ]);

  const handleRestComplete = useCallback(() => {
    clearTick();
    desiredRunningRef.current = false;

    const now = Date.now();
    if (restStartMsRef.current) {
      const delta = Math.max(0, now - restStartMsRef.current);
      restElapsedBaseMsRef.current = Math.min(
        Number(settings.restTime || 1) * 60 * 1000,
        (restElapsedBaseMsRef.current || 0) + delta
      );
      restStartMsRef.current = null;
    }

    setIsPaused(true);
    setIsRestFinished(true);
    isPausedRef.current = true;
    isRestFinishedRef.current = true;

    setSecondsIfChanged(0);

    try { audioRef.current?.pause?.(); } catch {}
    if (alarmRef.current) {
      alarmRef.current.src = getSoundUrl();
      alarmRef.current.volume = settings.soundVolume || 0.5;
      alarmRef.current.play().catch(() => {});
    }

    safeNotify("Descanso Finalizado!", "Hora de voltar a estudar.");

    setTotalFocusSeconds(Math.floor((focusAccumulatedMsRef.current || 0) / 1000));

    saveToStorage({
      isPaused: true,
      isResting: true,
      restFinished: true,
      pomodoroBlockFinished: false,
      focusAccumulatedMs: focusAccumulatedMsRef.current || 0,
      focusBlockElapsedBaseMs: focusBlockElapsedBaseMsRef.current || 0,
      restElapsedBaseMs: restElapsedBaseMsRef.current || 0,
      lastTimestamp: Date.now(),
    });

    updateExternalStatus(false, 0);
    updateMediaSession(false, 0);

    patchActiveTimer({
      status: 'rest_finished',
      isPaused: true,
      runStartedAt: null,
      elapsedMsAtRunStart: null,
      phase: 'rest_finished',
      uiOverlay: 'rest_finished',
    }, { includeSnapshot: true });

    releaseWakeLock();
  }, [
    clearTick,
    getSoundUrl,
    settings.restTime,
    settings.soundVolume,
    saveToStorage,
    updateExternalStatus,
    updateMediaSession,
    patchActiveTimer,
    setSecondsIfChanged,
    releaseWakeLock
  ]);

  // ========= PAUSE / RESUME =========
  const pauseTimer = useCallback(async (opts = {}) => {
    const source = opts.source || 'user';

    if (variant !== 'simulado') {
      if (isRestFinishedRef.current) return;
      if (isPomodoroFinishedRef.current && !isRestingRef.current) return;
    }
    if (isPausedRef.current) return;

    desiredRunningRef.current = false;
    if (source !== 'watchdog' && source !== 'remote' && source !== 'bc') {
      lastExplicitToggleAtRef.current = Date.now();
    }

    clearTick();

    const now = Date.now();

    if (variant !== 'simulado' && isRestingRef.current) {
      if (restStartMsRef.current) {
        const delta = Math.max(0, now - restStartMsRef.current);
        restElapsedBaseMsRef.current = (restElapsedBaseMsRef.current || 0) + delta;
        restStartMsRef.current = null;
      }
    } else {
      if (focusStartMsRef.current) {
        const delta = Math.max(0, now - focusStartMsRef.current);
        focusAccumulatedMsRef.current = (focusAccumulatedMsRef.current || 0) + delta;

        if (effectiveMode === 'pomodoro' && variant !== 'simulado') {
          focusBlockElapsedBaseMsRef.current = (focusBlockElapsedBaseMsRef.current || 0) + delta;
        }

        focusStartMsRef.current = null;
      }
    }

    let frozenDisplaySeconds = 0;

    if (effectiveMode === 'countdown') {
      const totalMs = Math.max(0, safeCountdownSeconds * 1000);
      const elapsedMs = Math.max(0, Number(focusAccumulatedMsRef.current || 0));
      frozenDisplaySeconds = Math.floor(Math.max(0, totalMs - elapsedMs) / 1000);
    } else if (variant !== 'simulado' && isRestingRef.current) {
      const durationMs = Math.max(1, Number(settings.restTime || 1) * 60 * 1000);
      const elapsedMs = Math.max(0, Number(restElapsedBaseMsRef.current || 0));
      frozenDisplaySeconds = Math.floor(Math.max(0, durationMs - elapsedMs) / 1000);
    } else if (effectiveMode === 'pomodoro' && variant !== 'simulado') {
      const durationMs = Math.max(1, Number(settings.pomodoroTime || 1) * 60 * 1000);
      const elapsedMs = Math.max(0, Number(focusBlockElapsedBaseMsRef.current || 0));
      frozenDisplaySeconds = Math.floor(Math.max(0, durationMs - elapsedMs) / 1000);
    } else {
      frozenDisplaySeconds = Math.floor(Math.max(0, Number(focusAccumulatedMsRef.current || 0)) / 1000);
    }

    setIsPaused(true);
    isPausedRef.current = true;

    setSecondsIfChanged(frozenDisplaySeconds);
    setTotalFocusSeconds(Math.floor(Math.max(0, Number(focusAccumulatedMsRef.current || 0)) / 1000));

    try { audioRef.current?.pause?.(); } catch {}

    await releaseWakeLock();

    saveToStorage({
      isPaused: true,
      isResting: !!isRestingRef.current,
      restFinished: !!isRestFinishedRef.current,
      pomodoroBlockFinished: !!isPomodoroFinishedRef.current,
      focusAccumulatedMs: Number(focusAccumulatedMsRef.current || 0),
      focusBlockElapsedBaseMs: Number(focusBlockElapsedBaseMsRef.current || 0),
      restElapsedBaseMs: Number(restElapsedBaseMsRef.current || 0),
      lastTimestamp: Date.now(),
    });

    updateExternalStatus(false, frozenDisplaySeconds);
    updateMediaSession(false, frozenDisplaySeconds);

    await patchActiveTimer({
      status: 'paused',
      isPaused: true,
      runStartedAt: null,
      elapsedMsAtRunStart: null,
      uiOverlay: 'none',
    }, { includeSnapshot: true });

    if (source !== 'bc') {
      postBC({ type: 'TIMER_SYNC', state: exportLocalStateForSync() });
      postBC({ type: 'TIMER_ACTION', action: 'CLOSE_OVERLAYS' });
    }
  }, [
    variant,
    effectiveMode,
    safeCountdownSeconds,
    settings.restTime,
    settings.pomodoroTime,
    clearTick,
    setSecondsIfChanged,
    saveToStorage,
    updateExternalStatus,
    updateMediaSession,
    patchActiveTimer,
    postBC,
    exportLocalStateForSync,
    releaseWakeLock
  ]);

  const resumeTimer = useCallback(async (opts = {}) => {
    const source = opts.source || 'user';

    if (variant !== 'simulado') {
      if (isRestFinishedRef.current) return;
      if (isPomodoroFinishedRef.current && !isRestingRef.current) return;
    }
    if (!isPausedRef.current) return;

    // ✅ quando retoma, fecha overlays em TODO lugar
    closeAllOverlaysLocal();

    desiredRunningRef.current = true;
    if (source !== 'watchdog' && source !== 'remote' && source !== 'bc') {
      lastExplicitToggleAtRef.current = Date.now();
    }

    if (variant !== 'simulado' && isRestingRef.current) {
      restStartMsRef.current = Date.now();
      lastLocalRunStartMsRef.current = restStartMsRef.current;
      lastLocalElapsedMsAtRunStartRef.current = restElapsedBaseMsRef.current || 0;
    } else {
      focusStartMsRef.current = Date.now();
      lastLocalRunStartMsRef.current = focusStartMsRef.current;
      lastLocalElapsedMsAtRunStartRef.current =
        (effectiveMode === 'pomodoro' && variant !== 'simulado')
          ? (focusBlockElapsedBaseMsRef.current || 0)
          : (focusAccumulatedMsRef.current || 0);
    }

    setIsPaused(false);
    isPausedRef.current = false;

    wakeLockWantedRef.current = true;
    requestWakeLock();

    if (audioRef.current) audioRef.current.play().catch(() => {});

    const display = getDisplaySecondsFromCurrentState();
    setSecondsIfChanged(display);

    startTickLoop();

    await patchActiveTimer({
      status: 'running',
      isPaused: false,
      runStartedAt: serverTimestamp(),
      elapsedMsAtRunStart: lastLocalElapsedMsAtRunStartRef.current || 0,
      phase: (variant !== 'simulado' && isRestingRef.current) ? 'rest' : 'focus',
      uiOverlay: 'none',
    }, { includeSnapshot: true });

    updateExternalStatus(true, display);
    updateMediaSession(true, display);

    if (source !== 'bc') {
      postBC({ type: 'TIMER_ACTION', action: 'CLOSE_OVERLAYS' });
      postBC({ type: 'TIMER_SYNC', state: exportLocalStateForSync() });
    }
  }, [
    variant,
    effectiveMode,
    getDisplaySecondsFromCurrentState,
    setSecondsIfChanged,
    startTickLoop,
    patchActiveTimer,
    updateExternalStatus,
    updateMediaSession,
    postBC,
    exportLocalStateForSync,
    requestWakeLock,
    closeAllOverlaysLocal
  ]);

  const handleTogglePause = useCallback((source = 'user') => {
    if (isPausedRef.current) resumeTimer({ source });
    else pauseTimer({ source });
  }, [pauseTimer, resumeTimer]);

  // ========= Wake Lock: re-request ao voltar visível + resync =========
  useEffect(() => {
    const onVis = () => {
      try {
        const display = getDisplaySecondsFromCurrentState();
        setSecondsIfChanged(display);
        if (!isPausedRef.current) {
          updateExternalStatus(true, display);
          updateMediaSession(true, display);
        }
      } catch {}

      if (document.visibilityState === 'visible') {
        if (wakeLockWantedRef.current) requestWakeLock();
      }
    };

    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, [getDisplaySecondsFromCurrentState, setSecondsIfChanged, updateExternalStatus, updateMediaSession, requestWakeLock]);

  // ========= applyRemoteState =========
  const applyRemoteState = useCallback((remote, source = 'remote') => {
    if (!remote) return;
    if (remote.updatedBy && remote.updatedBy === tabIdRef.current) return;

    if (isPreparing) {
      setIsPreparing(false);
      setCountdown(0);
    }

    // ✅ FECHA overlays quando:
    // - qualquer outra aba/dispositivo mandar CLOSE_OVERLAYS (via uiOverlay === 'none' + running/paused normal)
    // - ou quando remoto entrar em "running"
    const remoteUiOverlay = String(remote.uiOverlay || 'none');
    const shouldCloseOverlays = (remoteUiOverlay === 'none') || (!remote.isPaused);
    if (shouldCloseOverlays) closeAllOverlaysLocal();

    if (variant !== 'simulado') {
      const rResting = !!remote.isResting;
      const rPomoFinished = !!remote.isPomodoroFinished;
      const rRestFinished = !!remote.isRestFinished;

      setIsResting(rResting); isRestingRef.current = rResting;

      // Se remoto diz que NÃO está finished, fecha local definitivamente
      if (!rPomoFinished && isPomodoroFinishedRef.current) { setIsPomodoroFinished(false); isPomodoroFinishedRef.current = false; }
      if (!rRestFinished && isRestFinishedRef.current) { setIsRestFinished(false); isRestFinishedRef.current = false; }

      // Se remoto diz finished, abre
      if (rPomoFinished) { setIsPomodoroFinished(true); isPomodoroFinishedRef.current = true; }
      if (rRestFinished) { setIsRestFinished(true); isRestFinishedRef.current = true; }
    }

    const focusMs = Math.max(0, Number(remote.focusElapsedMs) || 0);
    const restMs = Math.max(0, Number(remote.restElapsedMs) || 0);
    const pomoMs = Math.max(0, Number(remote.pomodoroElapsedMs) || 0);

    focusAccumulatedMsRef.current = focusMs;
    restElapsedBaseMsRef.current = restMs;

    if (effectiveMode === 'pomodoro' && variant !== 'simulado') {
      focusBlockElapsedBaseMsRef.current = pomoMs;
    }

    const rPaused = !!remote.isPaused;

    clearTick();
    focusStartMsRef.current = null;
    restStartMsRef.current = null;

    if (rPaused) {
      setIsPaused(true);
      isPausedRef.current = true;
      desiredRunningRef.current = false;

      wakeLockWantedRef.current = false;
      releaseWakeLock();

      const display = getDisplaySecondsFromCurrentState();
      setSecondsIfChanged(display);
      updateExternalStatus(false, display);
      updateMediaSession(false, display);

      try { audioRef.current?.pause?.(); } catch {}
    } else {
      setIsPaused(false);
      isPausedRef.current = false;
      desiredRunningRef.current = true;

      wakeLockWantedRef.current = true;
      requestWakeLock();

      if (variant !== 'simulado' && isRestingRef.current) {
        restStartMsRef.current = Date.now();
        lastLocalRunStartMsRef.current = restStartMsRef.current;
        lastLocalElapsedMsAtRunStartRef.current = restElapsedBaseMsRef.current || 0;
      } else {
        focusStartMsRef.current = Date.now();
        lastLocalRunStartMsRef.current = focusStartMsRef.current;
        lastLocalElapsedMsAtRunStartRef.current =
          (effectiveMode === 'pomodoro' && variant !== 'simulado')
            ? (focusBlockElapsedBaseMsRef.current || 0)
            : (focusAccumulatedMsRef.current || 0);
      }

      if (audioRef.current) audioRef.current.play().catch(() => {});
      startTickLoop();

      const display = getDisplaySecondsFromCurrentState();
      setSecondsIfChanged(display);
      updateExternalStatus(true, display);
      updateMediaSession(true, display);
    }

    setTotalFocusSeconds(Math.floor(getCurrentFocusElapsedMs() / 1000));

    saveToStorage({
      isPaused: rPaused,
      isResting: !!isRestingRef.current,
      restFinished: !!isRestFinishedRef.current,
      pomodoroBlockFinished: !!isPomodoroFinishedRef.current,
      focusAccumulatedMs: getCurrentFocusElapsedMs(),
      focusBlockElapsedBaseMs: getCurrentPomodoroBlockElapsedMs(),
      restElapsedBaseMs: getCurrentRestElapsedMs(),
      lastTimestamp: Date.now(),
    });

    void source;
  }, [
    isPreparing,
    variant,
    effectiveMode,
    clearTick,
    startTickLoop,
    getDisplaySecondsFromCurrentState,
    setSecondsIfChanged,
    updateExternalStatus,
    updateMediaSession,
    getCurrentFocusElapsedMs,
    getCurrentPomodoroBlockElapsedMs,
    getCurrentRestElapsedMs,
    saveToStorage,
    requestWakeLock,
    releaseWakeLock,
    closeAllOverlaysLocal
  ]);

  // ========= BC onmessage =========
  useEffect(() => {
    if (!bcRef.current) return;

    bcRef.current.onmessage = (ev) => {
      const msg = ev?.data;
      if (!msg || msg.from === tabIdRef.current) return;

      if (msg.type === 'TIMER_SYNC' && msg.state) {
        applyRemoteState(msg.state, 'bc');
      }

      if (msg.type === 'TIMER_ACTION' && msg.action === 'CLOSE_OVERLAYS') {
        // ✅ a correção que faltava: qualquer aba que receber isso fecha a “tela de finalização”
        closeAllOverlaysLocal();
      }

      if (msg.type === 'TIMER_ACTION' && msg.action === 'CANCEL') {
        cleanupAndCancel('bc');
      }

      if (msg.type === 'TIMER_ACTION' && msg.action === 'STOP') {
        cleanupAndStop('bc');
      }
    };
  }, [applyRemoteState, cleanupAndCancel, cleanupAndStop, closeAllOverlaysLocal]);

  // ========= Firestore sync (cross-device) =========
  const lastAppliedRemoteSigRef = useRef('');

  useEffect(() => {
    if (!activeTimerDocRef) return;

    const unsub = onSnapshot(
      activeTimerDocRef,
      { includeMetadataChanges: true },
      (snap) => {
        if (snap.metadata?.hasPendingWrites) return;

        if (!snap.exists()) {
          const graceMs = 8000;
          const age = Date.now() - (mountedAtRef.current || Date.now());
          const canCancelNow =
            hasEverSeenDocRef.current ||
            hasWrittenFirebaseRef.current ||
            (!isPreparing && age > graceMs);

          if (!canCancelNow) return;

          cleanupAndCancel('remote_missing');
          return;
        }

        hasEverSeenDocRef.current = true;

        const data = snap.data() || {};
        if (data.updatedBy && data.updatedBy === tabIdRef.current) return;

        const sig = JSON.stringify({
          status: data.status,
          phase: data.phase,
          uiOverlay: data.uiOverlay,
          isPaused: data.isPaused,
          isResting: data.isResting,
          focusElapsedMsSnapshot: data.focusElapsedMsSnapshot,
          restElapsedMsSnapshot: data.restElapsedMsSnapshot,
          pomodoroElapsedMsSnapshot: data.pomodoroElapsedMsSnapshot,
          runStartedAt: data.runStartedAt?.toMillis ? data.runStartedAt.toMillis() : null,
          elapsedMsAtRunStart: data.elapsedMsAtRunStart,
          mode: data.mode,
        });
        if (sig === lastAppliedRemoteSigRef.current) return;
        lastAppliedRemoteSigRef.current = sig;

        const isRemoteRunning = data.status === 'running' && !data.isPaused;

        let remoteState = {
          variant: data.variant || variant,
          mode: data.mode || effectiveMode,
          isPaused: !isRemoteRunning,
          isResting: !!data.isResting,
          isPomodoroFinished: data.phase === 'pomodoro_finished',
          isRestFinished: data.phase === 'rest_finished',
          focusElapsedMs: Math.max(0, Number(data.focusElapsedMsSnapshot) || 0),
          restElapsedMs: Math.max(0, Number(data.restElapsedMsSnapshot) || 0),
          pomodoroElapsedMs: Math.max(0, Number(data.pomodoroElapsedMsSnapshot) || 0),
          countdownSeconds: Number(data.countdownSeconds || 0),
          uiOverlay: data.uiOverlay || 'none',
          updatedBy: data.updatedBy || null,
        };

        if (
          isRemoteRunning &&
          data.runStartedAt?.toMillis &&
          Number.isFinite(Number(data.elapsedMsAtRunStart))
        ) {
          const runStartedAtMs = data.runStartedAt.toMillis();
          const deltaMs = Math.max(0, Date.now() - runStartedAtMs);
          const base = Math.max(0, Number(data.elapsedMsAtRunStart) || 0);

          if (data.phase === 'rest') remoteState.restElapsedMs = base + deltaMs;
          else if ((data.mode === 'pomodoro') && data.phase === 'focus') remoteState.pomodoroElapsedMs = base + deltaMs;
          else remoteState.focusElapsedMs = base + deltaMs;
        }

        applyRemoteState(remoteState, 'remote');
        postBC({ type: 'TIMER_SYNC', state: remoteState });
      }
    );

    return () => unsub();
  }, [
    activeTimerDocRef,
    applyRemoteState,
    postBC,
    isPreparing,
    variant,
    effectiveMode,
    cleanupAndCancel
  ]);

  // ========= watchdog =========
  useEffect(() => {
    if (isPreparing) return;

    const t = setInterval(() => {
      if (!desiredRunningRef.current) return;
      if (variant !== 'simulado' && (isPomodoroFinishedRef.current || isRestFinishedRef.current)) return;

      const sinceToggle = Date.now() - (lastExplicitToggleAtRef.current || 0);
      if (sinceToggle < 1200) return;

      if (isPausedRef.current) {
        resumeTimer({ source: 'watchdog' });
      }
    }, 1500);

    return () => clearInterval(t);
  }, [isPreparing, resumeTimer, variant]);

  // ========= init audio + restore =========
  useEffect(() => {
    audioRef.current = new Audio(WHITE_NOISE_URL);
    audioRef.current.loop = true;
    audioRef.current.volume = 0.01;
    try { audioRef.current.setAttribute('playsinline', ''); } catch {}

    alarmRef.current = new Audio();
    alarmRef.current.src = DEFAULT_ALARM_URL;

    const savedSession = localStorage.getItem(STORAGE_KEY);
    if (savedSession) {
      try {
        const data = JSON.parse(savedSession);

        const sameDisciplina = String(data.disciplinaId || '') === String(disciplina?.id || '');
        const isValid = (variant === 'simulado') ? true : sameDisciplina;

        if (isValid && !data.isFinishing) {
          setIsPreparing(false);
          setCountdown(0);

          const sessionMode = data.mode || effectiveMode;
          const wasPaused = !!data.isPaused;

          const focusMs = Number.isFinite(Number(data.focusAccumulatedMs))
            ? Number(data.focusAccumulatedMs)
            : (Number(data.totalFocusSeconds || 0) * 1000);

          const pomoMs = Number.isFinite(Number(data.focusBlockElapsedBaseMs))
            ? Number(data.focusBlockElapsedBaseMs)
            : (Number(data.focusBlockElapsedSeconds || 0) * 1000);

          const restMs = Number.isFinite(Number(data.restElapsedBaseMs))
            ? Number(data.restElapsedBaseMs)
            : (Number(data.restElapsedSeconds || 0) * 1000);

          const lastTs = Number(data.lastTimestamp) || Date.now();
          const inactiveDeltaMs = wasPaused ? 0 : Math.max(0, Date.now() - lastTs);

          const rResting = !!data.isResting;
          const rPomoFinished = !!data.pomodoroBlockFinished;
          const rRestFinished = !!data.restFinished;

          if (variant !== 'simulado') {
            setIsResting(rResting); isRestingRef.current = rResting;
            setIsPomodoroFinished(rPomoFinished); isPomodoroFinishedRef.current = rPomoFinished;
            setIsRestFinished(rRestFinished); isRestFinishedRef.current = rRestFinished;
          }

          if (!wasPaused && inactiveDeltaMs > 0) {
            if (sessionMode === 'countdown') {
              focusAccumulatedMsRef.current = focusMs + inactiveDeltaMs;
              focusBlockElapsedBaseMsRef.current = pomoMs;
              restElapsedBaseMsRef.current = restMs;
            } else if (sessionMode === 'pomodoro' && variant !== 'simulado') {
              if (rResting) {
                restElapsedBaseMsRef.current = Math.min(Number(settings.restTime || 1) * 60 * 1000, restMs + inactiveDeltaMs);
                focusAccumulatedMsRef.current = focusMs;
                focusBlockElapsedBaseMsRef.current = pomoMs;
              } else {
                focusBlockElapsedBaseMsRef.current = Math.min(Number(settings.pomodoroTime || 1) * 60 * 1000, pomoMs + inactiveDeltaMs);
                focusAccumulatedMsRef.current = focusMs + inactiveDeltaMs;
              }
            } else {
              focusAccumulatedMsRef.current = focusMs + inactiveDeltaMs;
              focusBlockElapsedBaseMsRef.current = pomoMs;
              restElapsedBaseMsRef.current = restMs;
            }
          } else {
            focusAccumulatedMsRef.current = focusMs;
            focusBlockElapsedBaseMsRef.current = pomoMs;
            restElapsedBaseMsRef.current = restMs;
          }

          setIsPaused(wasPaused);
          isPausedRef.current = wasPaused;

          const display = getDisplaySecondsFromCurrentState();
          setSecondsIfChanged(display);

          setTotalFocusSeconds(Math.floor(getCurrentFocusElapsedMs() / 1000));

          updateExternalStatus(!wasPaused, display);
          updateMediaSession(!wasPaused, display);

          if (!wasPaused) {
            desiredRunningRef.current = true;

            wakeLockWantedRef.current = true;
            requestWakeLock();

            if (variant !== 'simulado' && isRestingRef.current) {
              restStartMsRef.current = Date.now();
              lastLocalRunStartMsRef.current = restStartMsRef.current;
              lastLocalElapsedMsAtRunStartRef.current = restElapsedBaseMsRef.current || 0;
            } else {
              focusStartMsRef.current = Date.now();
              lastLocalRunStartMsRef.current = focusStartMsRef.current;
              lastLocalElapsedMsAtRunStartRef.current =
                (sessionMode === 'pomodoro' && variant !== 'simulado')
                  ? (focusBlockElapsedBaseMsRef.current || 0)
                  : (focusAccumulatedMsRef.current || 0);
            }

            if (audioRef.current) audioRef.current.play().catch(() => {});
            startTickLoop();

            upsertActiveTimer({
              status: 'running',
              isPaused: false,
              runStartedAt: serverTimestamp(),
              elapsedMsAtRunStart: lastLocalElapsedMsAtRunStartRef.current || 0,
              createdAt: serverTimestamp(),
              phase: rResting ? 'rest' : 'focus',
              uiOverlay: 'none',
            }, { merge: true });

            postBC({ type: 'TIMER_ACTION', action: 'CLOSE_OVERLAYS' });
          } else {
            desiredRunningRef.current = false;
            focusStartMsRef.current = null;
            restStartMsRef.current = null;

            wakeLockWantedRef.current = false;
            releaseWakeLock();

            upsertActiveTimer({
              status: 'paused',
              isPaused: true,
              runStartedAt: null,
              elapsedMsAtRunStart: null,
              createdAt: serverTimestamp(),
              phase: rRestFinished ? 'rest_finished' : (rPomoFinished ? 'pomodoro_finished' : (rResting ? 'rest' : 'focus')),
              uiOverlay: 'none',
            }, { merge: true });
          }
        }
      } catch (e) {
        console.error(e);
      }
    }

    return () => {
      clearTick();
      try { audioRef.current?.pause?.(); } catch {}
      try { alarmRef.current?.pause?.(); } catch {}

      releaseWakeLock();
      restoreDocumentTitle();
      clearMediaSession();

      if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    };
  }, [
    disciplina?.id,
    STORAGE_KEY,
    variant,
    effectiveMode,
    safeCountdownSeconds,
    settings.pomodoroTime,
    settings.restTime,
    startTickLoop,
    setSecondsIfChanged,
    getDisplaySecondsFromCurrentState,
    getCurrentFocusElapsedMs,
    updateExternalStatus,
    updateMediaSession,
    upsertActiveTimer,
    clearTick,
    requestWakeLock,
    releaseWakeLock,
    restoreDocumentTitle,
    clearMediaSession,
    postBC
  ]);

  // ========= init “GO!” =========
  useEffect(() => {
    if (!isPreparing) return;

    if (countdown > 0) {
      const t = setTimeout(() => setCountdown(c => c - 1), 1000);
      return () => clearTimeout(t);
    }

    setIsPreparing(false);

    focusAccumulatedMsRef.current = 0;
    focusBlockElapsedBaseMsRef.current = 0;
    restElapsedBaseMsRef.current = 0;

    closeAllOverlaysLocal();

    setIsPaused(false);
    isPausedRef.current = false;

    desiredRunningRef.current = true;
    lastExplicitToggleAtRef.current = Date.now();

    if (variant !== 'simulado') {
      setIsPomodoroFinished(false); isPomodoroFinishedRef.current = false;
      setIsResting(false); isRestingRef.current = false;
      setIsRestFinished(false); isRestFinishedRef.current = false;
    }

    focusStartMsRef.current = Date.now();
    lastLocalRunStartMsRef.current = focusStartMsRef.current;
    lastLocalElapsedMsAtRunStartRef.current = 0;

    wakeLockWantedRef.current = true;
    requestWakeLock();

    if (audioRef.current) audioRef.current.play().catch(() => {});

    const display = getDisplaySecondsFromCurrentState();
    setSecondsIfChanged(display);
    setTotalFocusSeconds(0);

    saveToStorage({
      isPaused: false,
      isResting: false,
      restFinished: false,
      pomodoroBlockFinished: false,
      focusAccumulatedMs: 0,
      focusBlockElapsedBaseMs: 0,
      restElapsedBaseMs: 0,
      lastTimestamp: Date.now(),
    });

    updateExternalStatus(true, display);
    updateMediaSession(true, display);

    upsertActiveTimer({
      status: 'running',
      isPaused: false,
      runStartedAt: serverTimestamp(),
      elapsedMsAtRunStart: 0,
      createdAt: serverTimestamp(),
      phase: 'focus',
      uiOverlay: 'none',
    }, { merge: true });

    startTickLoop();

    // ✅ fecha overlay em TODAS as outras abas/dispositivos
    postBC({ type: 'TIMER_ACTION', action: 'CLOSE_OVERLAYS' });
    postBC({ type: 'TIMER_SYNC', state: exportLocalStateForSync() });
  }, [
    isPreparing,
    countdown,
    variant,
    effectiveMode,
    startTickLoop,
    getDisplaySecondsFromCurrentState,
    setSecondsIfChanged,
    saveToStorage,
    updateExternalStatus,
    updateMediaSession,
    upsertActiveTimer,
    postBC,
    exportLocalStateForSync,
    requestWakeLock,
    closeAllOverlaysLocal
  ]);

  // ========= pomodoro actions =========
  const handleRepeatCycle = useCallback(() => {
    try { alarmRef.current?.pause?.(); } catch {}

    desiredRunningRef.current = true;
    lastExplicitToggleAtRef.current = Date.now();

    closeAllOverlaysLocal();

    setIsPomodoroFinished(false);
    setIsResting(false);
    setIsRestFinished(false);
    isPomodoroFinishedRef.current = false;
    isRestingRef.current = false;
    isRestFinishedRef.current = false;

    setIsPaused(false);
    isPausedRef.current = false;

    focusBlockElapsedBaseMsRef.current = 0;

    focusStartMsRef.current = Date.now();
    lastLocalRunStartMsRef.current = focusStartMsRef.current;
    lastLocalElapsedMsAtRunStartRef.current = 0;

    wakeLockWantedRef.current = true;
    requestWakeLock();

    if (audioRef.current) audioRef.current.play().catch(() => {});

    const display = getDisplaySecondsFromCurrentState();
    setSecondsIfChanged(display);
    startTickLoop();

    saveToStorage({
      isPaused: false,
      isResting: false,
      restFinished: false,
      pomodoroBlockFinished: false,
      focusAccumulatedMs: getCurrentFocusElapsedMs(),
      focusBlockElapsedBaseMs: 0,
      restElapsedBaseMs: 0,
      lastTimestamp: Date.now(),
    });

    updateExternalStatus(true, display);
    updateMediaSession(true, display);

    patchActiveTimer({
      status: 'running',
      isPaused: false,
      isResting: false,
      runStartedAt: serverTimestamp(),
      elapsedMsAtRunStart: 0,
      phase: 'focus',
      uiOverlay: 'none',
    }, { includeSnapshot: true });

    // ✅ FECHA overlay em outras abas/dispositivos
    postBC({ type: 'TIMER_ACTION', action: 'CLOSE_OVERLAYS' });
    postBC({ type: 'TIMER_SYNC', state: exportLocalStateForSync() });
  }, [
    getDisplaySecondsFromCurrentState,
    setSecondsIfChanged,
    startTickLoop,
    saveToStorage,
    updateExternalStatus,
    updateMediaSession,
    patchActiveTimer,
    exportLocalStateForSync,
    postBC,
    getCurrentFocusElapsedMs,
    requestWakeLock,
    closeAllOverlaysLocal
  ]);

  const handleStartRest = useCallback(() => {
    try { alarmRef.current?.pause?.(); } catch {}

    desiredRunningRef.current = true;
    lastExplicitToggleAtRef.current = Date.now();

    closeAllOverlaysLocal();

    setIsPomodoroFinished(false);
    setIsResting(true);
    setIsRestFinished(false);
    setIsPaused(false);

    isPomodoroFinishedRef.current = false;
    isRestingRef.current = true;
    isRestFinishedRef.current = false;
    isPausedRef.current = false;

    restElapsedBaseMsRef.current = 0;
    restStartMsRef.current = Date.now();
    lastLocalRunStartMsRef.current = restStartMsRef.current;
    lastLocalElapsedMsAtRunStartRef.current = 0;

    wakeLockWantedRef.current = true;
    requestWakeLock();

    if (audioRef.current) audioRef.current.play().catch(() => {});

    const display = getDisplaySecondsFromCurrentState();
    setSecondsIfChanged(display);
    startTickLoop();

    saveToStorage({
      isPaused: false,
      isResting: true,
      restFinished: false,
      pomodoroBlockFinished: false,
      focusAccumulatedMs: getCurrentFocusElapsedMs(),
      focusBlockElapsedBaseMs: focusBlockElapsedBaseMsRef.current || 0,
      restElapsedBaseMs: 0,
      lastTimestamp: Date.now(),
    });

    updateExternalStatus(true, display);
    updateMediaSession(true, display);

    patchActiveTimer({
      status: 'running',
      isPaused: false,
      isResting: true,
      runStartedAt: serverTimestamp(),
      elapsedMsAtRunStart: 0,
      phase: 'rest',
      uiOverlay: 'none',
    }, { includeSnapshot: true });

    // ✅ FECHA overlay em outras abas/dispositivos
    postBC({ type: 'TIMER_ACTION', action: 'CLOSE_OVERLAYS' });
    postBC({ type: 'TIMER_SYNC', state: exportLocalStateForSync() });
  }, [
    getDisplaySecondsFromCurrentState,
    setSecondsIfChanged,
    startTickLoop,
    saveToStorage,
    updateExternalStatus,
    updateMediaSession,
    patchActiveTimer,
    exportLocalStateForSync,
    postBC,
    getCurrentFocusElapsedMs,
    requestWakeLock,
    closeAllOverlaysLocal
  ]);

  const handleBackToStudy = useCallback(() => {
    try { alarmRef.current?.pause?.(); } catch {}

    desiredRunningRef.current = true;
    lastExplicitToggleAtRef.current = Date.now();

    closeAllOverlaysLocal();

    setIsRestFinished(false);
    setIsResting(false);
    setIsPomodoroFinished(false);
    setIsPaused(false);

    isRestFinishedRef.current = false;
    isRestingRef.current = false;
    isPomodoroFinishedRef.current = false;
    isPausedRef.current = false;

    focusStartMsRef.current = Date.now();
    lastLocalRunStartMsRef.current = focusStartMsRef.current;
    lastLocalElapsedMsAtRunStartRef.current =
      (settings.mode === 'pomodoro')
        ? (focusBlockElapsedBaseMsRef.current || 0)
        : (focusAccumulatedMsRef.current || 0);

    wakeLockWantedRef.current = true;
    requestWakeLock();

    if (audioRef.current) audioRef.current.play().catch(() => {});

    const display = getDisplaySecondsFromCurrentState();
    setSecondsIfChanged(display);
    startTickLoop();

    saveToStorage({
      isPaused: false,
      isResting: false,
      restFinished: false,
      pomodoroBlockFinished: false,
      focusAccumulatedMs: getCurrentFocusElapsedMs(),
      focusBlockElapsedBaseMs: focusBlockElapsedBaseMsRef.current || 0,
      restElapsedBaseMs: restElapsedBaseMsRef.current || 0,
      lastTimestamp: Date.now(),
    });

    updateExternalStatus(true, display);
    updateMediaSession(true, display);

    patchActiveTimer({
      status: 'running',
      isPaused: false,
      isResting: false,
      runStartedAt: serverTimestamp(),
      elapsedMsAtRunStart: lastLocalElapsedMsAtRunStartRef.current || 0,
      phase: 'focus',
      uiOverlay: 'none',
    }, { includeSnapshot: true });

    // ✅ FECHA overlay em outras abas/dispositivos
    postBC({ type: 'TIMER_ACTION', action: 'CLOSE_OVERLAYS' });
    postBC({ type: 'TIMER_SYNC', state: exportLocalStateForSync() });
  }, [
    settings.mode,
    getDisplaySecondsFromCurrentState,
    startTickLoop,
    saveToStorage,
    updateExternalStatus,
    updateMediaSession,
    patchActiveTimer,
    exportLocalStateForSync,
    postBC,
    getCurrentFocusElapsedMs,
    requestWakeLock,
    closeAllOverlaysLocal
  ]);

  const finishText = finishButtonLabel || (variant === 'simulado' ? 'Finalizar Simulado' : 'Finalizar Estudo');

  // ========= minimized UI =========
  if (isMinimized) {
    let positionClass = 'bottom-24';
    if (raised === 'top') positionClass = 'bottom-[350px]';
    else if (raised) positionClass = 'bottom-56';

    return (
      <motion.div
        layout
        initial={false}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
        className={`fixed right-4 z-[9999] animate-fade-in ${positionClass}`}
      >
        <div
          className="bg-white/90 dark:bg-zinc-900/90 backdrop-blur-md border border-zinc-200 dark:border-zinc-700 shadow-2xl rounded-2xl p-3 flex items-center gap-4 w-auto max-w-[300px] cursor-pointer hover:scale-105 transition-transform"
          style={{ borderColor: `${themeColor}40` }}
          onClick={onWidgetMode}
        >
          <div className="relative flex items-center justify-center w-10 h-10 bg-zinc-100 dark:bg-zinc-800 rounded-full shrink-0">
            <div className={`absolute inset-0 rounded-full ${isPaused ? '' : 'animate-ping'}`} style={{ backgroundColor: isPaused ? 'transparent' : `${themeColor}40` }} />
            <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: isPaused ? '#fbbf24' : themeColor }} />
          </div>

          <div className="flex flex-col mr-2 min-w-0">
            <span className="text-[10px] text-zinc-500 dark:text-zinc-400 uppercase font-bold tracking-wider truncate">
              {assunto ? assunto : (variant !== 'simulado' && isResting ? 'Descanso' : (disciplina?.nome || 'Disciplina'))}
            </span>
            <span className="text-xl font-mono font-bold text-zinc-900 dark:text-white leading-none">{formatClock(seconds)}</span>
          </div>

          <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => handleTogglePause('user')}
              className="p-2 rounded-full bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-900 dark:text-white"
            >
              {isPaused ? <Play size={14} fill="currentColor" /> : <Pause size={14} fill="currentColor" />}
            </button>
          </div>
        </div>
      </motion.div>
    );
  }

  // ========= FULL UI =========
  return (
    <div className="fixed inset-0 z-[9999] bg-zinc-50 dark:bg-zinc-950 flex flex-col items-center justify-center animate-fade-in overflow-hidden font-sans">
      <ConfirmationModal
        isOpen={isCancelModalOpen}
        onConfirm={() => cleanupAndCancel('user')}
        onCancel={() => setIsCancelModalOpen(false)}
        title="Cancelar Sessão?"
        description="Todo o tempo desta sessão será descartado."
        confirmText="Sim, Cancelar"
        isDestructive={true}
      />

      <div
        className="absolute inset-0 opacity-[0.03] pointer-events-none"
        style={{
          backgroundImage: 'radial-gradient(circle at 2px 2px, currentColor 1px, transparent 0)',
          backgroundSize: '40px 40px',
          color: themeColor
        }}
      />
      <div className="absolute top-0 left-0 w-full h-1 opacity-50" style={{ background: `linear-gradient(90deg, transparent, ${themeColor}, transparent)` }} />

      <div className="absolute top-6 left-1/2 -translate-x-1/2 z-20 opacity-80 pointer-events-none transition-all">
        <img src="/logo-pmba.png" alt="Logo" className="h-20 md:h-28 w-auto drop-shadow-2xl grayscale-[0.2]" />
      </div>

      <div className="absolute top-6 right-6 flex gap-3 z-[100]">
        <button
          onClick={toggleTheme}
          className="p-3 rounded-full bg-white dark:bg-zinc-900 text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 border border-zinc-200 dark:border-zinc-800 transition-all shadow-sm"
        >
          {isDark ? <Sun size={20} /> : <Moon size={20} />}
        </button>

        <button
          onClick={toggleFullscreen}
          className="p-3 rounded-full bg-white dark:bg-zinc-900 text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 border border-zinc-200 dark:border-zinc-800 transition-all shadow-sm"
        >
          {isFullscreen ? <Minimize2 size={20} /> : <Maximize size={20} />}
        </button>

        <button
          onClick={onWidgetMinimize}
          className="flex items-center gap-2 bg-white dark:bg-zinc-900 text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 border border-zinc-200 dark:border-zinc-800 transition-all px-4 py-2 rounded-full shadow-sm"
        >
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
              <span className="relative z-10 text-black dark:text-white">{countdown > 0 ? countdown : "GO!"}</span>
            </motion.div>

            <p className="mt-8 text-zinc-500 text-xl uppercase tracking-[0.5em] font-bold">
              {variant === 'simulado' ? 'Iniciando Simulado' : 'Preparar Foco'}
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* overlays pomodoro/rest apenas no study */}
      {variant !== 'simulado' && (
        <>
          <AnimatePresence>
            {isPomodoroFinished && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="absolute inset-0 z-40 bg-white/95 dark:bg-zinc-950/95 backdrop-blur-md flex flex-col items-center justify-center p-6"
              >
                <div className="w-24 h-24 rounded-full flex items-center justify-center mb-6 animate-bounce shadow-2xl" style={{ backgroundColor: `${themeColor}20`, color: themeColor }}>
                  <CheckCircle2 size={48} />
                </div>
                <h2 className="text-4xl font-black text-zinc-900 dark:text-white mb-2 uppercase tracking-tight">Ciclo Concluído!</h2>
                <p className="text-zinc-500 dark:text-zinc-400 text-lg mb-2">Você completou {settings.pomodoroTime} minutos de foco.</p>
                <p className="text-zinc-500 dark:text-zinc-400 text-sm mb-10">
                  Total acumulado: <span className="font-black">{formatHMFromSeconds(totalFocusSeconds)}</span>
                </p>

                <div className="flex flex-col sm:flex-row gap-4 w-full max-w-md">
                  <button
                    onClick={handleStop}
                    className="flex-1 py-4 rounded-xl bg-zinc-200 dark:bg-zinc-800 text-zinc-900 dark:text-white font-bold uppercase tracking-wide hover:bg-zinc-300 dark:hover:bg-zinc-700 transition-colors"
                  >
                    Salvar Sessão
                  </button>
                  <button
                    onClick={handleRepeatCycle}
                    className="flex-1 py-4 rounded-xl font-bold uppercase tracking-wide text-white hover:opacity-90 transition-opacity flex items-center justify-center gap-2 shadow-lg"
                    style={{ backgroundColor: themeColor }}
                  >
                    <Repeat size={20} /> Novo Ciclo
                  </button>
                </div>

                <button
                  onClick={handleStartRest}
                  className="mt-6 px-8 py-3 rounded-full border-2 border-blue-500/30 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 text-sm font-bold uppercase tracking-widest flex items-center gap-2 transition-all"
                >
                  <Coffee size={18} /> Iniciar Descanso ({settings.restTime} min)
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          <AnimatePresence>
            {isRestFinished && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="absolute inset-0 z-40 bg-white/95 dark:bg-zinc-950/95 backdrop-blur-md flex flex-col items-center justify-center p-6"
              >
                <div className="w-24 h-24 rounded-full flex items-center justify-center mb-6 animate-bounce shadow-2xl" style={{ backgroundColor: `${themeColor}20`, color: themeColor }}>
                  <AlarmClock size={48} />
                </div>
                <h2 className="text-4xl font-black text-zinc-900 dark:text-white mb-2 uppercase tracking-tight">Descanso Acabou!</h2>
                <p className="text-zinc-500 dark:text-zinc-400 text-lg mb-2">Hora de voltar ao foco total.</p>
                <p className="text-zinc-500 dark:text-zinc-400 text-sm mb-10">
                  Total acumulado: <span className="font-black">{formatHMFromSeconds(totalFocusSeconds)}</span>
                </p>

                <div className="flex flex-col sm:flex-row gap-4 w-full max-w-md">
                  <button
                    onClick={handleBackToStudy}
                    className="flex-1 py-4 rounded-xl font-bold uppercase tracking-wide text-white hover:opacity-90 transition-opacity flex items-center justify-center gap-2 shadow-lg"
                    style={{ backgroundColor: themeColor }}
                  >
                    <Play size={20} /> Retomar Estudo
                  </button>
                  <button
                    onClick={handleStop}
                    className="flex-1 py-4 rounded-xl bg-zinc-200 dark:bg-zinc-800 text-zinc-900 dark:text-white font-bold uppercase tracking-wide hover:bg-zinc-300 dark:hover:bg-zinc-700 transition-colors"
                  >
                    Finalizar
                  </button>
                </div>

                <button
                  onClick={() => setIsCancelModalOpen(true)}
                  className="mt-6 px-8 py-3 rounded-full border-2 border-red-500/30 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 text-sm font-bold uppercase tracking-widest flex items-center gap-2 transition-all"
                >
                  <X size={18} /> Cancelar Sessão
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </>
      )}

      <div className="relative z-10 flex flex-col items-center text-center w-full max-w-5xl px-4 mt-24">
        <div
          className="mb-8 px-5 py-2 rounded-full border text-[10px] md:text-xs font-bold tracking-[0.2em] uppercase flex items-center gap-3 transition-colors shadow-sm bg-white dark:bg-zinc-900"
          style={{ borderColor: `${themeColor}40`, color: themeColor }}
        >
          <span className={`w-2 h-2 rounded-full ${isPaused ? 'bg-zinc-400' : 'animate-pulse'}`} style={{ backgroundColor: isPaused ? undefined : themeColor }} />
          {variant === 'simulado'
            ? (isPaused ? 'Simulado Pausado' : (effectiveMode === 'countdown' ? 'Cronômetro' : 'Tempo Livre'))
            : (isResting ? 'Modo Descanso' : (isPaused ? 'Pausado' : (isPomodoro ? 'Modo Pomodoro' : 'Modo Livre')))}
        </div>

        <h2 className="text-xl md:text-4xl font-bold text-zinc-800 dark:text-zinc-300 mb-2 tracking-tight max-w-3xl leading-tight line-clamp-2">
          {disciplina?.nome || 'Disciplina'}
        </h2>
        {assunto && <p className="text-zinc-500 dark:text-zinc-400 text-sm font-bold uppercase tracking-wide mb-4">{assunto}</p>}

        {isPomodoro && variant !== 'simulado' && (
          <p className="text-zinc-500 dark:text-zinc-400 text-sm mb-8">
            Total acumulado: <span className="font-black">{formatHMFromSeconds(totalFocusSeconds)}</span>
          </p>
        )}

        <div className="relative mb-16 md:mb-20">
          <div className="absolute -inset-10 blur-[60px] md:blur-[100px] opacity-20 rounded-full transition-colors duration-700" style={{ backgroundColor: isPaused ? '#71717a' : themeColor }} />
          <div
            className="text-7xl sm:text-9xl md:text-[12rem] font-mono font-bold leading-none tracking-tighter tabular-nums transition-colors duration-300 select-none drop-shadow-2xl"
            style={{ color: isPaused ? '#a1a1aa' : (variant !== 'simulado' && isResting ? '#3B82F6' : '#18181b') }}
          >
            <span className={`${isPaused ? 'text-zinc-400' : (variant !== 'simulado' && isResting ? 'text-blue-500' : 'text-zinc-900 dark:text-white')}`}>
              {formatClock(seconds)}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-6 md:gap-12">
          {variant !== 'simulado' && isResting ? (
            <button
              onClick={handleRestComplete}
              className="group flex flex-col items-center gap-2 text-zinc-400 hover:text-blue-500 transition-colors"
            >
              <div className="w-14 h-14 rounded-full border-2 border-zinc-200 dark:border-zinc-800 group-hover:border-blue-500/50 flex items-center justify-center bg-white dark:bg-zinc-900 transition-all shadow-sm">
                <CheckCircle2 size={24} />
              </div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-center">Finalizar Descanso</span>
            </button>
          ) : (
            <button
              onClick={() => setIsCancelModalOpen(true)}
              className="group flex flex-col items-center gap-2 text-zinc-400 hover:text-red-500 transition-colors"
            >
              <div className="w-14 h-14 rounded-full border-2 border-zinc-200 dark:border-zinc-800 group-hover:border-red-500/50 flex items-center justify-center bg-white dark:bg-zinc-900 transition-all shadow-sm">
                <X size={24} />
              </div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-center">Cancelar</span>
            </button>
          )}

          <button
            onClick={() => handleTogglePause('user')}
            className="w-24 h-24 md:w-32 md:h-32 rounded-full flex flex-col items-center justify-center shadow-2xl transition-all transform hover:scale-105 active:scale-95 text-white"
            style={{ backgroundColor: isPaused ? themeColor : '#f59e0b' }}
          >
            {isPaused ? <Play size={36} fill="currentColor" className="ml-1" /> : <Pause size={36} fill="currentColor" />}
            <span className="mt-2 text-[10px] md:text-sm font-bold uppercase">{isPaused ? 'Retomar' : 'Pausar'}</span>
          </button>

          <button
            onClick={handleStop}
            className="group flex flex-col items-center gap-2 text-zinc-400 hover:text-emerald-500 transition-colors"
          >
            <div className="w-14 h-14 rounded-full border-2 border-zinc-200 dark:border-zinc-800 group-hover:border-emerald-500/50 flex items-center justify-center bg-white dark:bg-zinc-900 transition-all shadow-sm">
              <Square size={24} fill="currentColor" />
            </div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-center">{finishText}</span>
          </button>
        </div>
      </div>
    </div>
  );
}

export default StudyTimer;
