import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  Play, Pause, Square, Minimize2, X, AlertTriangle,
  Maximize, Repeat, Coffee, CheckCircle2, Sun, Moon, AlarmClock
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import TimerSettingsModal, { useTimerSettings } from './TimerSettingsModal';
import { doc, setDoc, updateDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
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

const ConfirmationModal = ({ isOpen, onConfirm, onCancel, title, description, confirmText, isDestructive }) => {
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
          <button onClick={onCancel} className="px-4 py-2 text-sm font-semibold text-zinc-600 dark:text-zinc-300 bg-zinc-100 dark:bg-zinc-800 rounded-lg hover:bg-zinc-200 dark:hover:bg-zinc-700">Cancelar</button>
          <button onClick={onConfirm} className={`px-4 py-2 text-sm font-bold text-white rounded-lg ${isDestructive ? 'bg-red-600 hover:bg-red-700' : 'bg-indigo-600 hover:bg-indigo-700'}`}>
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
}) {
  const { settings } = useTimerSettings();

  // ✅ CHAVE DE STORAGE ÚNICA POR USUÁRIO
  const STORAGE_KEY = useMemo(() => `@ModoQAP:ActiveSession:${userUid}`, [userUid]);

  const [isPreparing, setIsPreparing] = useState(true);
  const [countdown, setCountdown] = useState(3);

  // seconds = o que aparece no display
  const [seconds, setSeconds] = useState(0);

  // Total de foco acumulado
  const [totalFocusSeconds, setTotalFocusSeconds] = useState(0);

  const [isPaused, setIsPaused] = useState(false);
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const [isDark, setIsDark] = useState(true);

  // Estados de Controle de Fluxo
  const [isPomodoroFinished, setIsPomodoroFinished] = useState(false);
  const [isResting, setIsResting] = useState(false);
  const [isRestFinished, setIsRestFinished] = useState(false);

  const intervalRef = useRef(null);
  const audioRef = useRef(null);
  const alarmRef = useRef(null);
  const originalTitleRef = useRef(document.title);

  // Refs para evitar stale closures
  const secondsRef = useRef(0);
  const isPausedRef = useRef(false);
  const isRestingRef = useRef(false);
  const isPomodoroFinishedRef = useRef(false);
  const isRestFinishedRef = useRef(false);

  const totalFocusRef = useRef(0);
  const focusBlockElapsedBaseRef = useRef(0);
  const focusBlockStartRef = useRef(null);
  const restElapsedBaseRef = useRef(0);
  const restStartRef = useRef(null);

  useEffect(() => { secondsRef.current = seconds; }, [seconds]);
  useEffect(() => { isPausedRef.current = isPaused; }, [isPaused]);
  useEffect(() => { isRestingRef.current = isResting; }, [isResting]);
  useEffect(() => { isPomodoroFinishedRef.current = isPomodoroFinished; }, [isPomodoroFinished]);
  useEffect(() => { isRestFinishedRef.current = isRestFinished; }, [isRestFinished]);

  const themeColor = isResting ? '#3B82F6' : settings.color;
  const isPomodoro = settings.mode === 'pomodoro';

  // ===========================
  // ✅ Firestore: active_timers/{uid}
  // ===========================
  const activeTimerDocRef = useMemo(() => {
    if (!userUid) return null;
    return doc(db, ACTIVE_TIMER_COLLECTION, userUid);
  }, [userUid]);

  const buildActiveTimerPayload = useCallback((extra = {}) => {
    const mode = settings.mode; // 'pomodoro' | 'free'
    const phase =
      isRestFinishedRef.current ? 'rest_finished' :
      isPomodoroFinishedRef.current ? 'pomodoro_finished' :
      isRestingRef.current ? 'rest' :
      'focus';

    return {
      uid: userUid || null,
      userName: userName || 'Estudante',
      userPhotoURL: userPhotoURL || null,

      disciplinaId: disciplina?.id || null,
      disciplinaNome: disciplina?.nome || '',
      assunto: assunto ?? null,

      timerType: mode === 'pomodoro' ? 'pomodoro' : 'livre',
      mode: mode,

      phase,
      isPaused: !!isPausedRef.current,
      isResting: !!isRestingRef.current,

      // Snapshot exato do momento (admin usa isso como BASE)
      displaySecondsSnapshot: Number(secondsRef.current || 0),

      // ✅ NOVO: timestamp do snapshot (âncora estável)
      snapshotAt: serverTimestamp(),

      // Controle de frescor/monitoramento (TTL no Admin)
      updatedAt: serverTimestamp(),
      heartbeatAt: serverTimestamp(),

      ...extra,
    };
  }, [
    userUid, userName, userPhotoURL,
    disciplina?.id, disciplina?.nome,
    assunto,
    settings.mode
  ]);

  const upsertActiveTimer = useCallback(async (extra = {}, { merge = true } = {}) => {
    if (!activeTimerDocRef) return;
    try {
      const payload = buildActiveTimerPayload(extra);
      await setDoc(activeTimerDocRef, payload, { merge });
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
      } : {}),
      ...(touchUpdatedAt ? { updatedAt: serverTimestamp() } : {}),
      ...(touchHeartbeat ? { heartbeatAt: serverTimestamp() } : {}),
    };

    try {
      await updateDoc(activeTimerDocRef, patch);
    } catch (e) {
      await upsertActiveTimer(patch, { merge: true });
    }
  }, [activeTimerDocRef, upsertActiveTimer]);

  const removeActiveTimer = useCallback(async () => {
    if (!activeTimerDocRef) return;
    try {
      await deleteDoc(activeTimerDocRef);
    } catch {}
  }, [activeTimerDocRef]);

  useEffect(() => {
    if (!activeTimerDocRef) return;
    if (isPreparing) return;

    const t = setInterval(() => {
      patchActiveTimer({}, { includeSnapshot: false, touchUpdatedAt: true, touchHeartbeat: true });
    }, 30000);

    return () => clearInterval(t);
  }, [activeTimerDocRef, isPreparing, patchActiveTimer]);

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

  const getSoundUrl = useCallback(() => {
    if (settings.soundType === 'custom' && settings.customSoundUrl) return settings.customSoundUrl;
    const sound = DEFAULT_SOUNDS.find(s => s.id === settings.selectedSoundId) || DEFAULT_SOUNDS[0];
    return sound.url;
  }, [settings.soundType, settings.customSoundUrl, settings.selectedSoundId]);

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

  const updateExternalStatus = useCallback((isRunning, displaySeconds) => {
    const timeString = formatClock(displaySeconds);
    let prefix = "Pausado";
    if (isRestFinishedRef.current) prefix = "Descanso Acabou!";
    else if (isRestingRef.current) prefix = isRunning ? "Descansando" : "Descanso Pausado";
    else if (isPomodoroFinishedRef.current) prefix = "Concluído!";
    else if (isRunning) prefix = (settings.mode === 'pomodoro') ? "Focando" : "Estudando";
    document.title = `${prefix}: ${timeString} - ${(disciplina?.nome || 'Disciplina')}`;
  }, [disciplina?.nome, settings.mode]);

  const updateMediaSession = useCallback((isRunning, displaySeconds) => {
    if (!('mediaSession' in navigator)) return;
    try {
      const mainTitle = assunto ? `${disciplina?.nome || 'Disciplina'} • ${assunto}` : (disciplina?.nome || 'Disciplina');

      let contextLabel = 'Estudando';
      if (isRestFinishedRef.current) contextLabel = 'Descanso Finalizado';
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
    } catch {}
  }, [assunto, disciplina?.nome, settings.mode]);

  const saveToStorage = useCallback((payload) => {
    const currentStorage = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    if (currentStorage.isFinishing) return;

    const data = {
      ...currentStorage,
      schemaVersion: 2,
      disciplinaId: disciplina?.id,
      disciplinaNome: disciplina?.nome,
      assunto: assunto ?? null,
      mode: settings.mode,
      pomodoroDuration: settings.pomodoroTime * 60,
      restDuration: settings.restTime * 60,
      isPaused: !!payload.isPaused,
      isResting: !!payload.isResting,
      pomodoroBlockFinished: !!payload.pomodoroBlockFinished,
      restFinished: !!payload.restFinished,
      totalFocusSeconds: Number(payload.totalFocusSeconds) || 0,
      focusBlockElapsedSeconds: Number(payload.focusBlockElapsedSeconds) || 0,
      restElapsedSeconds: Number(payload.restElapsedSeconds) || 0,
      lastTimestamp: Number(payload.lastTimestamp) || Date.now(),
    };

    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }, [disciplina, assunto, settings.mode, settings.pomodoroTime, settings.restTime, STORAGE_KEY]);

  const getPomodoroRunningDeltaSeconds = useCallback(() => {
    const start = focusBlockStartRef.current;
    if (!start) return 0;
    const duration = settings.pomodoroTime * 60;
    const elapsedBase = focusBlockElapsedBaseRef.current || 0;
    const raw = Math.floor((Date.now() - start) / 1000);
    const remainingInBlock = Math.max(0, duration - elapsedBase);
    return Math.max(0, Math.min(remainingInBlock, raw));
  }, [settings.pomodoroTime]);

  const getFreeRunningDeltaSeconds = useCallback(() => {
    const start = focusBlockStartRef.current;
    if (!start) return 0;
    const raw = Math.floor((Date.now() - start) / 1000);
    return Math.max(0, raw);
  }, []);

  const getRestRunningDeltaSeconds = useCallback(() => {
    const start = restStartRef.current;
    if (!start) return 0;
    const duration = settings.restTime * 60;
    const elapsedBase = restElapsedBaseRef.current || 0;
    const raw = Math.floor((Date.now() - start) / 1000);
    const remaining = Math.max(0, duration - elapsedBase);
    return Math.max(0, Math.min(remaining, raw));
  }, [settings.restTime]);

  const commitFocusSegment = useCallback(() => {
    if (settings.mode === 'pomodoro') {
      const delta = getPomodoroRunningDeltaSeconds();
      if (delta <= 0) return;
      focusBlockElapsedBaseRef.current = (focusBlockElapsedBaseRef.current || 0) + delta;
      totalFocusRef.current = (totalFocusRef.current || 0) + delta;
      setTotalFocusSeconds(totalFocusRef.current);
      focusBlockStartRef.current = null;
      return;
    }
    const delta = getFreeRunningDeltaSeconds();
    if (delta <= 0) return;
    totalFocusRef.current = (totalFocusRef.current || 0) + delta;
    setTotalFocusSeconds(totalFocusRef.current);
    focusBlockStartRef.current = null;
  }, [settings.mode, getPomodoroRunningDeltaSeconds, getFreeRunningDeltaSeconds]);

  const commitRestSegment = useCallback(() => {
    const delta = getRestRunningDeltaSeconds();
    if (delta <= 0) return;
    restElapsedBaseRef.current = (restElapsedBaseRef.current || 0) + delta;
    restStartRef.current = null;
  }, [getRestRunningDeltaSeconds]);

  const pauseTimer = useCallback(() => {
    if (isRestFinishedRef.current) return;
    if (isPomodoroFinishedRef.current && !isRestingRef.current) return;
    if (isPausedRef.current) return;

    clearInterval(intervalRef.current);

    if (isRestingRef.current) {
      commitRestSegment();
      const duration = settings.restTime * 60;
      const remaining = Math.max(0, duration - (restElapsedBaseRef.current || 0));
      secondsRef.current = remaining;
      setSeconds(remaining);
    } else {
      commitFocusSegment();
      if (settings.mode === 'pomodoro') {
        const duration = settings.pomodoroTime * 60;
        const remaining = Math.max(0, duration - (focusBlockElapsedBaseRef.current || 0));
        secondsRef.current = remaining;
        setSeconds(remaining);
      } else {
        secondsRef.current = totalFocusRef.current || 0;
        setSeconds(secondsRef.current);
      }
    }

    if (audioRef.current) audioRef.current.pause();
    setIsPaused(true);
    isPausedRef.current = true;

    saveToStorage({
      isPaused: true, isResting: !!isRestingRef.current, restFinished: false, pomodoroBlockFinished: false,
      totalFocusSeconds: totalFocusRef.current || 0,
      focusBlockElapsedSeconds: focusBlockElapsedBaseRef.current || 0,
      restElapsedSeconds: restElapsedBaseRef.current || 0,
      lastTimestamp: Date.now(),
    });

    updateExternalStatus(false, secondsRef.current);
    updateMediaSession(false, secondsRef.current);

    patchActiveTimer({
      status: 'paused',
      isPaused: true,
      runningSince: null,
    }, { includeSnapshot: true });
  }, [commitFocusSegment, commitRestSegment, saveToStorage, settings.mode, settings.pomodoroTime, settings.restTime, updateExternalStatus, updateMediaSession, patchActiveTimer]);

  const resumeTimer = useCallback(() => {
    if (isRestFinishedRef.current) return;
    if (isPomodoroFinishedRef.current && !isRestingRef.current) return;
    if (!isPausedRef.current) return;

    if (isRestingRef.current) restStartRef.current = Date.now();
    else focusBlockStartRef.current = Date.now();

    if (audioRef.current) audioRef.current.play().catch(() => {});
    setIsPaused(false);
    isPausedRef.current = false;

    saveToStorage({
      isPaused: false, isResting: !!isRestingRef.current, restFinished: false, pomodoroBlockFinished: false,
      totalFocusSeconds: totalFocusRef.current || 0,
      focusBlockElapsedSeconds: focusBlockElapsedBaseRef.current || 0,
      restElapsedSeconds: restElapsedBaseRef.current || 0,
      lastTimestamp: Date.now(),
    });

    updateExternalStatus(true, secondsRef.current);
    updateMediaSession(true, secondsRef.current);

    patchActiveTimer({
      status: 'running',
      isPaused: false,
      runningSince: serverTimestamp(),
    }, { includeSnapshot: true });
  }, [saveToStorage, updateExternalStatus, updateMediaSession, patchActiveTimer]);

  const handleTogglePause = useCallback(() => {
    if (isPausedRef.current) resumeTimer();
    else pauseTimer();
  }, [pauseTimer, resumeTimer]);

  const handlePomodoroComplete = useCallback(() => {
    clearInterval(intervalRef.current);
    commitFocusSegment();
    setIsPomodoroFinished(true);
    setIsPaused(true);
    isPomodoroFinishedRef.current = true;
    isPausedRef.current = true;
    focusBlockStartRef.current = null;
    secondsRef.current = 0;
    setSeconds(0);

    if (audioRef.current) audioRef.current.pause();
    if (alarmRef.current) {
      alarmRef.current.src = getSoundUrl();
      alarmRef.current.volume = settings.soundVolume || 0.5;
      alarmRef.current.play().catch(() => {});
    }

    saveToStorage({
      isPaused: true, isResting: false, restFinished: false, pomodoroBlockFinished: true,
      totalFocusSeconds: totalFocusRef.current || 0,
      focusBlockElapsedSeconds: focusBlockElapsedBaseRef.current || 0,
      restElapsedSeconds: restElapsedBaseRef.current || 0,
      lastTimestamp: Date.now(),
    });

    updateExternalStatus(false, 0);
    updateMediaSession(false, 0);

    patchActiveTimer({
      status: 'pomodoro_finished',
      isPaused: true,
      runningSince: null,
    }, { includeSnapshot: true });
  }, [commitFocusSegment, getSoundUrl, saveToStorage, settings.soundVolume, updateExternalStatus, updateMediaSession, patchActiveTimer]);

  const handleRestComplete = useCallback(() => {
    clearInterval(intervalRef.current);
    commitRestSegment();
    setIsPaused(true);
    setIsRestFinished(true);
    isPausedRef.current = true;
    isRestFinishedRef.current = true;
    secondsRef.current = 0;
    setSeconds(0);

    if (audioRef.current) audioRef.current.pause();
    if (alarmRef.current) {
      alarmRef.current.src = getSoundUrl();
      alarmRef.current.volume = settings.soundVolume || 0.5;
      alarmRef.current.play().catch(() => {});
    }

    safeNotify("Descanso Finalizado!", "Hora de voltar a estudar.");

    saveToStorage({
      isPaused: true, isResting: true, restFinished: true, pomodoroBlockFinished: false,
      totalFocusSeconds: totalFocusRef.current || 0,
      focusBlockElapsedSeconds: focusBlockElapsedBaseRef.current || 0,
      restElapsedSeconds: restElapsedBaseRef.current || 0,
      lastTimestamp: Date.now(),
    });

    updateExternalStatus(false, 0);
    updateMediaSession(false, 0);

    patchActiveTimer({
      status: 'rest_finished',
      isPaused: true,
      runningSince: null,
    }, { includeSnapshot: true });
  }, [commitRestSegment, getSoundUrl, saveToStorage, settings.soundVolume, updateExternalStatus, updateMediaSession, patchActiveTimer]);

  const handleStop = useCallback(() => {
    clearInterval(intervalRef.current);
    if (audioRef.current) audioRef.current.pause();
    if (alarmRef.current) alarmRef.current.pause();

    let finalTotalFocus = totalFocusRef.current || 0;
    if (!isPausedRef.current && !isRestingRef.current && !isPomodoroFinishedRef.current && !isRestFinishedRef.current) {
      if (settings.mode === 'pomodoro') finalTotalFocus += getPomodoroRunningDeltaSeconds();
      else finalTotalFocus += getFreeRunningDeltaSeconds();
    }

    totalFocusRef.current = finalTotalFocus;
    setTotalFocusSeconds(finalTotalFocus);
    focusBlockStartRef.current = null;

    if (isRestingRef.current) {
      const duration = settings.restTime * 60;
      const remaining = Math.max(0, duration - (restElapsedBaseRef.current || 0));
      secondsRef.current = remaining;
    } else if (settings.mode === 'pomodoro') {
      const duration = settings.pomodoroTime * 60;
      const remaining = Math.max(0, duration - (focusBlockElapsedBaseRef.current || 0));
      secondsRef.current = remaining;
    } else {
      secondsRef.current = finalTotalFocus;
    }
    setSeconds(secondsRef.current);

    setIsPaused(true);
    isPausedRef.current = true;

    saveToStorage({
      isPaused: true, isResting: !!isRestingRef.current, restFinished: !!isRestFinishedRef.current,
      pomodoroBlockFinished: !!isPomodoroFinishedRef.current,
      totalFocusSeconds: finalTotalFocus,
      focusBlockElapsedSeconds: focusBlockElapsedBaseRef.current || 0,
      restElapsedSeconds: restElapsedBaseRef.current || 0,
      lastTimestamp: Date.now(),
    });

    updateExternalStatus(false, secondsRef.current);

    patchActiveTimer({
      status: 'finishing',
      isPaused: true,
      runningSince: null,
    }, { includeSnapshot: true });

    const finalMinutes = Math.round(finalTotalFocus / 60);
    onStop(Math.max(1, finalMinutes));
  }, [
    onStop, saveToStorage, settings.mode, settings.pomodoroTime, settings.restTime, updateExternalStatus,
    getPomodoroRunningDeltaSeconds, getFreeRunningDeltaSeconds, patchActiveTimer
  ]);

  const handleRepeatCycle = useCallback(() => {
    if (alarmRef.current) alarmRef.current.pause();
    setIsPomodoroFinished(false);
    setIsResting(false);
    setIsRestFinished(false);
    isPomodoroFinishedRef.current = false;
    isRestingRef.current = false;
    isRestFinishedRef.current = false;
    setIsPaused(false);
    isPausedRef.current = false;

    focusBlockElapsedBaseRef.current = 0;
    const totalSeconds = settings.pomodoroTime * 60;
    secondsRef.current = totalSeconds;
    setSeconds(totalSeconds);
    focusBlockStartRef.current = Date.now();

    saveToStorage({
      isPaused: false, isResting: false, restFinished: false, pomodoroBlockFinished: false,
      totalFocusSeconds: totalFocusRef.current || 0,
      focusBlockElapsedSeconds: 0,
      restElapsedSeconds: 0,
      lastTimestamp: Date.now(),
    });

    if (audioRef.current) audioRef.current.play().catch(() => {});
    updateExternalStatus(true, totalSeconds);
    updateMediaSession(true, totalSeconds);

    patchActiveTimer({
      status: 'running',
      isPaused: false,
      isResting: false,
      runningSince: serverTimestamp(),
    }, { includeSnapshot: true });
  }, [saveToStorage, settings.pomodoroTime, updateExternalStatus, updateMediaSession, patchActiveTimer]);

  const handleStartRest = useCallback(() => {
    if (alarmRef.current) alarmRef.current.pause();
    setIsPomodoroFinished(false);
    setIsResting(true);
    setIsRestFinished(false);
    setIsPaused(false);
    isPomodoroFinishedRef.current = false;
    isRestingRef.current = true;
    isRestFinishedRef.current = false;
    isPausedRef.current = false;

    restElapsedBaseRef.current = 0;
    const restSeconds = settings.restTime * 60;
    secondsRef.current = restSeconds;
    setSeconds(restSeconds);
    restStartRef.current = Date.now();

    saveToStorage({
      isPaused: false, isResting: true, restFinished: false, pomodoroBlockFinished: false,
      totalFocusSeconds: totalFocusRef.current || 0,
      focusBlockElapsedSeconds: focusBlockElapsedBaseRef.current || 0,
      restElapsedSeconds: 0,
      lastTimestamp: Date.now(),
    });

    if (audioRef.current) audioRef.current.play().catch(() => {});
    updateExternalStatus(true, restSeconds);
    updateMediaSession(true, restSeconds);

    patchActiveTimer({
      status: 'running',
      isPaused: false,
      isResting: true,
      runningSince: serverTimestamp(),
    }, { includeSnapshot: true });
  }, [saveToStorage, settings.restTime, updateExternalStatus, updateMediaSession, patchActiveTimer]);

  const handleBackToStudy = useCallback(() => {
    if (alarmRef.current) alarmRef.current.pause();
    setIsRestFinished(false);
    setIsResting(false);
    setIsPomodoroFinished(false);
    isRestFinishedRef.current = false;
    isRestingRef.current = false;
    isPomodoroFinishedRef.current = false;
    setIsPaused(false);
    isPausedRef.current = false;

    if (settings.mode === 'pomodoro') {
      focusBlockElapsedBaseRef.current = 0;
      const totalSeconds = settings.pomodoroTime * 60;
      secondsRef.current = totalSeconds;
      setSeconds(totalSeconds);
      focusBlockStartRef.current = Date.now();
      saveToStorage({
        isPaused: false, isResting: false, restFinished: false, pomodoroBlockFinished: false,
        totalFocusSeconds: totalFocusRef.current || 0,
        focusBlockElapsedSeconds: 0,
        restElapsedSeconds: 0,
        lastTimestamp: Date.now(),
      });
      if (audioRef.current) audioRef.current.play().catch(() => {});
      updateExternalStatus(true, totalSeconds);
      updateMediaSession(true, totalSeconds);

      patchActiveTimer({
        status: 'running',
        isPaused: false,
        isResting: false,
        runningSince: serverTimestamp(),
      }, { includeSnapshot: true });
      return;
    }

    focusBlockStartRef.current = Date.now();
    secondsRef.current = totalFocusRef.current || 0;
    setSeconds(secondsRef.current);
    saveToStorage({
      isPaused: false, isResting: false, restFinished: false, pomodoroBlockFinished: false,
      totalFocusSeconds: totalFocusRef.current || 0,
      focusBlockElapsedSeconds: 0,
      restElapsedSeconds: 0,
      lastTimestamp: Date.now(),
    });
    if (audioRef.current) audioRef.current.play().catch(() => {});
    updateExternalStatus(true, secondsRef.current);
    updateMediaSession(true, secondsRef.current);

    patchActiveTimer({
      status: 'running',
      isPaused: false,
      isResting: false,
      runningSince: serverTimestamp(),
    }, { includeSnapshot: true });
  }, [saveToStorage, settings.mode, settings.pomodoroTime, updateExternalStatus, updateMediaSession, patchActiveTimer]);

  // ===== Restore =====
  useEffect(() => {
    const savedSession = localStorage.getItem(STORAGE_KEY);
    audioRef.current = new Audio(WHITE_NOISE_URL);
    audioRef.current.loop = true;
    audioRef.current.volume = 0.01;
    try { audioRef.current.setAttribute('playsinline', ''); } catch {}
    alarmRef.current = new Audio();
    alarmRef.current.src = DEFAULT_ALARM_URL;

    if (savedSession) {
      try {
        const data = JSON.parse(savedSession);
        if (String(data.disciplinaId) === String(disciplina?.id) && !data.isFinishing) {
          setIsPreparing(false);
          const schemaVersion = Number(data.schemaVersion || 1);
          const sessionMode = data.mode || settings.mode;
          let restoredTotalFocus = 0;
          let restoredFocusBlockElapsed = 0;
          let restoredRestElapsed = 0;

          if (schemaVersion >= 2) {
            restoredTotalFocus = Number(data.totalFocusSeconds) || 0;
            restoredFocusBlockElapsed = Number(data.focusBlockElapsedSeconds) || 0;
            restoredRestElapsed = Number(data.restElapsedSeconds) || 0;
          } else {
            restoredTotalFocus = Number(data.accumulatedTime) || 0;
            restoredFocusBlockElapsed = Number(data.accumulatedTime) || 0;
          }

          totalFocusRef.current = restoredTotalFocus;
          setTotalFocusSeconds(restoredTotalFocus);

          const pomoFinished = !!(schemaVersion >= 2 ? data.pomodoroBlockFinished : data.pomodoroFinished);
          const resting = !!(schemaVersion >= 2 ? data.isResting : false);
          const restFinished = !!(schemaVersion >= 2 ? data.restFinished : false);

          setIsPomodoroFinished(pomoFinished); isPomodoroFinishedRef.current = pomoFinished;
          setIsResting(resting); isRestingRef.current = resting;
          setIsRestFinished(restFinished); isRestFinishedRef.current = restFinished;

          focusBlockElapsedBaseRef.current = restoredFocusBlockElapsed;
          restElapsedBaseRef.current = restoredRestElapsed;

          if (resting) {
            const restDuration = Number(data.restDuration || (settings.restTime * 60)) || (settings.restTime * 60);
            const remaining = Math.max(0, restDuration - restoredRestElapsed);
            secondsRef.current = restFinished ? 0 : remaining;
            setSeconds(secondsRef.current);
          } else if (sessionMode === 'pomodoro') {
            const duration = Number(data.pomodoroDuration || (settings.pomodoroTime * 60)) || (settings.pomodoroTime * 60);
            const remaining = Math.max(0, duration - restoredFocusBlockElapsed);
            secondsRef.current = pomoFinished ? 0 : remaining;
            setSeconds(secondsRef.current);
          } else {
            secondsRef.current = restoredTotalFocus;
            setSeconds(restoredTotalFocus);
          }

          setIsPaused(true); isPausedRef.current = true;
          focusBlockStartRef.current = null; restStartRef.current = null;
          updateExternalStatus(false, secondsRef.current);
          updateMediaSession(false, secondsRef.current);

          upsertActiveTimer({
            status: 'paused',
            isPaused: true,
            runningSince: null,
            createdAt: serverTimestamp(),
          }, { merge: true });
        }
      } catch (e) { console.error(e); }
    }

    return () => {
      clearInterval(intervalRef.current);
      if (audioRef.current) audioRef.current.pause();
      if (alarmRef.current) alarmRef.current.pause();
      if (originalTitleRef.current) document.title = originalTitleRef.current;
      if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    };
  }, [disciplina?.id, STORAGE_KEY]);

  // ===== Init =====
  useEffect(() => {
    if (!isPreparing) return;
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(c => c - 1), 1000);
      return () => clearTimeout(timer);
    }
    if (audioRef.current) audioRef.current.play().catch(() => {});
    setIsPreparing(false);
    totalFocusRef.current = 0; setTotalFocusSeconds(0);
    setIsPaused(false); isPausedRef.current = false;
    setIsPomodoroFinished(false); isPomodoroFinishedRef.current = false;
    setIsResting(false); isRestingRef.current = false;
    setIsRestFinished(false); isRestFinishedRef.current = false;
    focusBlockElapsedBaseRef.current = 0; restElapsedBaseRef.current = 0;

    if (settings.mode === 'pomodoro') {
      const total = settings.pomodoroTime * 60;
      secondsRef.current = total; setSeconds(total);
      focusBlockStartRef.current = Date.now();
    } else {
      secondsRef.current = 0; setSeconds(0);
      focusBlockStartRef.current = Date.now();
    }

    saveToStorage({
      isPaused: false, isResting: false, restFinished: false, pomodoroBlockFinished: false,
      totalFocusSeconds: 0, focusBlockElapsedSeconds: 0, restElapsedSeconds: 0, lastTimestamp: Date.now(),
    });
    updateExternalStatus(true, secondsRef.current);
    updateMediaSession(true, secondsRef.current);

    upsertActiveTimer({
      status: 'running',
      isPaused: false,
      runningSince: serverTimestamp(),
      createdAt: serverTimestamp(),
    }, { merge: true });
  }, [isPreparing, countdown, settings.mode, settings.pomodoroTime, saveToStorage, updateExternalStatus, updateMediaSession, upsertActiveTimer]);

  // ===== Tick =====
  useEffect(() => {
    if (isPreparing || isPomodoroFinished || isRestFinished) return;
    if (isPaused) {
      clearInterval(intervalRef.current);
      updateExternalStatus(false, secondsRef.current);
      updateMediaSession(false, secondsRef.current);
      return;
    }

    const tick = () => {
      if (isRestingRef.current) {
        const duration = settings.restTime * 60;
        const delta = getRestRunningDeltaSeconds();
        const elapsed = (restElapsedBaseRef.current || 0) + delta;
        const remaining = Math.max(0, duration - elapsed);
        secondsRef.current = remaining; setSeconds(remaining);
        saveToStorage({
          isPaused: false, isResting: true, restFinished: false, pomodoroBlockFinished: false,
          totalFocusSeconds: totalFocusRef.current || 0,
          focusBlockElapsedSeconds: focusBlockElapsedBaseRef.current || 0,
          restElapsedSeconds: elapsed, lastTimestamp: Date.now(),
        });
        updateExternalStatus(true, remaining); updateMediaSession(true, remaining);
        if (remaining <= 0) handleRestComplete();
        return;
      }

      if (settings.mode === 'pomodoro') {
        const duration = settings.pomodoroTime * 60;
        const delta = getPomodoroRunningDeltaSeconds();
        const elapsedInBlock = (focusBlockElapsedBaseRef.current || 0) + delta;
        const remaining = Math.max(0, duration - elapsedInBlock);

        secondsRef.current = remaining; setSeconds(remaining);

        const currentTotalFocus = (totalFocusRef.current || 0) + delta;
        setTotalFocusSeconds(currentTotalFocus);

        saveToStorage({
          isPaused: false, isResting: false, restFinished: false, pomodoroBlockFinished: false,
          totalFocusSeconds: currentTotalFocus,
          focusBlockElapsedSeconds: elapsedInBlock,
          restElapsedSeconds: restElapsedBaseRef.current || 0, lastTimestamp: Date.now(),
        });
        updateExternalStatus(true, remaining); updateMediaSession(true, remaining);
        if (remaining <= 0) handlePomodoroComplete();
        return;
      }

      const delta = getFreeRunningDeltaSeconds();
      const currentTotal = (totalFocusRef.current || 0) + delta;
      secondsRef.current = currentTotal; setSeconds(currentTotal); setTotalFocusSeconds(currentTotal);
      saveToStorage({
        isPaused: false, isResting: false, restFinished: false, pomodoroBlockFinished: false,
        totalFocusSeconds: currentTotal, focusBlockElapsedSeconds: 0, restElapsedSeconds: 0, lastTimestamp: Date.now(),
      });
      updateExternalStatus(true, currentTotal); updateMediaSession(true, currentTotal);
    };

    if (isRestingRef.current && !restStartRef.current) restStartRef.current = Date.now();
    if (!isRestingRef.current && !focusBlockStartRef.current) focusBlockStartRef.current = Date.now();

    tick();
    intervalRef.current = setInterval(tick, 1000);
    return () => clearInterval(intervalRef.current);
  }, [
    isPreparing, isPaused, isPomodoroFinished, isRestFinished,
    settings.mode, settings.pomodoroTime, settings.restTime,
    saveToStorage, updateExternalStatus, updateMediaSession,
    getPomodoroRunningDeltaSeconds, getFreeRunningDeltaSeconds, getRestRunningDeltaSeconds,
    handlePomodoroComplete, handleRestComplete
  ]);

  if (isMinimized) {
    // === LÓGICA DE POSICIONAMENTO DINÂMICO ===
    // 'top': Configurações abertas -> bottom-[350px] (320px do bottom-80 + 30px)
    // true: Ciclo aberto -> bottom-56 (acima dos botões)
    // false: Padrão -> bottom-24
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
            <div className={`absolute inset-0 rounded-full ${isPaused ? '' : 'animate-ping'}`} style={{ backgroundColor: isPaused ? 'transparent' : `${themeColor}40` }}></div>
            <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: isPaused ? '#fbbf24' : themeColor }}></div>
          </div>
          <div className="flex flex-col mr-2 min-w-0">
            <span className="text-[10px] text-zinc-500 dark:text-zinc-400 uppercase font-bold tracking-wider truncate">
              {assunto ? assunto : (isResting ? 'Descanso' : (disciplina?.nome || 'Disciplina'))}
            </span>
            <span className="text-xl font-mono font-bold text-zinc-900 dark:text-white leading-none">{formatClock(seconds)}</span>
          </div>
          <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
            <button onClick={handleTogglePause} className="p-2 rounded-full bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-900 dark:text-white">
              {isPaused ? <Play size={14} fill="currentColor" /> : <Pause size={14} fill="currentColor" />}
            </button>
          </div>
        </div>
      </motion.div>
    );
  }

  return (
    <div className="fixed inset-0 z-[9999] bg-zinc-50 dark:bg-zinc-950 flex flex-col items-center justify-center animate-fade-in overflow-hidden font-sans">
      <ConfirmationModal
        isOpen={isCancelModalOpen}
        onConfirm={() => {
          localStorage.removeItem(STORAGE_KEY);
          removeActiveTimer();
          onCancel();
        }}
        onCancel={() => setIsCancelModalOpen(false)}
        title="Cancelar Sessão?"
        description="Todo o tempo estudado nesta sessão será descartado."
        confirmText="Sim, Cancelar"
        isDestructive={true}
      />

      <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, currentColor 1px, transparent 0)', backgroundSize: '40px 40px', color: themeColor }}></div>
      <div className="absolute top-0 left-0 w-full h-1 opacity-50" style={{ background: `linear-gradient(90deg, transparent, ${themeColor}, transparent)` }}></div>
      <div className="absolute top-6 left-1/2 -translate-x-1/2 z-20 opacity-80 pointer-events-none transition-all">
        <img src="/logo-pmba.png" alt="Logo" className="h-20 md:h-28 w-auto drop-shadow-2xl grayscale-[0.2]" />
      </div>

      <div className="absolute top-6 right-6 flex gap-3 z-[100]">
        <button onClick={toggleTheme} className="p-3 rounded-full bg-white dark:bg-zinc-900 text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 border border-zinc-200 dark:border-zinc-800 transition-all shadow-sm">
          {isDark ? <Sun size={20} /> : <Moon size={20} />}
        </button>
        <button onClick={toggleFullscreen} className="p-3 rounded-full bg-white dark:bg-zinc-900 text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 border border-zinc-200 dark:border-zinc-800 transition-all shadow-sm">
          {isFullscreen ? <Minimize2 size={20} /> : <Maximize size={20} />}
        </button>
        <button onClick={onWidgetMinimize} className="flex items-center gap-2 bg-white dark:bg-zinc-900 text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 border border-zinc-200 dark:border-zinc-800 transition-all px-4 py-2 rounded-full shadow-sm">
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
              <span className="relative z-10 text-white dark:text-white">{countdown > 0 ? countdown : "GO!"}</span>
            </motion.div>
            <p className="mt-8 text-zinc-500 text-xl uppercase tracking-[0.5em] font-bold">Preparar Foco</p>
          </motion.div>
        )}
      </AnimatePresence>

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
              <button onClick={handleStop} className="flex-1 py-4 rounded-xl bg-zinc-200 dark:bg-zinc-800 text-zinc-900 dark:text-white font-bold uppercase tracking-wide hover:bg-zinc-300 dark:hover:bg-zinc-700 transition-colors">
                Salvar Sessão
              </button>
              <button onClick={handleRepeatCycle} className="flex-1 py-4 rounded-xl font-bold uppercase tracking-wide text-white hover:opacity-90 transition-opacity flex items-center justify-center gap-2 shadow-lg" style={{ backgroundColor: themeColor }}>
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
              <button onClick={handleBackToStudy} className="flex-1 py-4 rounded-xl font-bold uppercase tracking-wide text-white hover:opacity-90 transition-opacity flex items-center justify-center gap-2 shadow-lg" style={{ backgroundColor: themeColor }}>
                <Play size={20} /> Retomar Estudo
              </button>
              <button onClick={handleStop} className="flex-1 py-4 rounded-xl bg-zinc-200 dark:bg-zinc-800 text-zinc-900 dark:text-white font-bold uppercase tracking-wide hover:bg-zinc-300 dark:hover:bg-zinc-700 transition-colors">
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

      <div className="relative z-10 flex flex-col items-center text-center w-full max-w-5xl px-4 mt-24">
        <div
          className="mb-8 px-5 py-2 rounded-full border text-[10px] md:text-xs font-bold tracking-[0.2em] uppercase flex items-center gap-3 transition-colors shadow-sm bg-white dark:bg-zinc-900"
          style={{ borderColor: `${themeColor}40`, color: themeColor }}
        >
          <span className={`w-2 h-2 rounded-full ${isPaused ? 'bg-zinc-400' : 'animate-pulse'}`} style={{ backgroundColor: isPaused ? undefined : themeColor }}></span>
          {isResting ? 'Modo Descanso' : (isPaused ? 'Pausado' : (isPomodoro ? 'Modo Pomodoro' : 'Modo Livre'))}
        </div>

        <h2 className="text-xl md:text-4xl font-bold text-zinc-800 dark:text-zinc-300 mb-2 tracking-tight max-w-3xl leading-tight line-clamp-2">{disciplina?.nome || 'Disciplina'}</h2>
        {assunto && <p className="text-zinc-500 dark:text-zinc-400 text-sm font-bold uppercase tracking-wide mb-4">{assunto}</p>}

        {isPomodoro && (
          <p className="text-zinc-500 dark:text-zinc-400 text-sm mb-8">
            Total acumulado: <span className="font-black">{formatHMFromSeconds(totalFocusSeconds)}</span>
          </p>
        )}

        <div className="relative mb-16 md:mb-20">
          <div className="absolute -inset-10 blur-[60px] md:blur-[100px] opacity-20 rounded-full transition-colors duration-700" style={{ backgroundColor: isPaused ? '#71717a' : themeColor }}></div>
          <div
            className="text-7xl sm:text-9xl md:text-[12rem] font-mono font-bold leading-none tracking-tighter tabular-nums transition-colors duration-300 select-none drop-shadow-2xl"
            style={{ color: isPaused ? '#a1a1aa' : (isResting ? '#3B82F6' : '#18181b') }}
          >
            <span className={`${isPaused ? 'text-zinc-400' : (isResting ? 'text-blue-500' : 'text-zinc-900 dark:text-white')}`}>
              {formatClock(seconds)}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-6 md:gap-12">
          {isResting ? (
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
            <button onClick={() => setIsCancelModalOpen(true)} className="group flex flex-col items-center gap-2 text-zinc-400 hover:text-red-500 transition-colors">
              <div className="w-14 h-14 rounded-full border-2 border-zinc-200 dark:border-zinc-800 group-hover:border-red-500/50 flex items-center justify-center bg-white dark:bg-zinc-900 transition-all shadow-sm">
                <X size={24} />
              </div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-center">Cancelar</span>
            </button>
          )}

          <button
            onClick={handleTogglePause}
            className="w-24 h-24 md:w-32 md:h-32 rounded-full flex flex-col items-center justify-center shadow-2xl transition-all transform hover:scale-105 active:scale-95 text-white"
            style={{ backgroundColor: isPaused ? (isResting ? '#3B82F6' : themeColor) : (isResting ? '#3B82F6' : '#f59e0b') }}
          >
            {isPaused ? <Play size={36} fill="currentColor" className="ml-1" /> : <Pause size={36} fill="currentColor" />}
            <span className="mt-2 text-[10px] md:text-sm font-bold uppercase">{isPaused ? 'Retomar' : 'Pausar'}</span>
          </button>

          <button onClick={handleStop} className="group flex flex-col items-center gap-2 text-zinc-400 hover:text-emerald-500 transition-colors">
            <div className="w-14 h-14 rounded-full border-2 border-zinc-200 dark:border-zinc-800 group-hover:border-emerald-500/50 flex items-center justify-center bg-white dark:bg-zinc-900 transition-all shadow-sm"><Square size={24} fill="currentColor" /></div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-center">Finalizar Estudo</span>
          </button>
        </div>
      </div>
    </div>
  );
}

export default StudyTimer;