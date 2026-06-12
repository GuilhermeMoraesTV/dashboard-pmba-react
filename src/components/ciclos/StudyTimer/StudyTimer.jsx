import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useTimerSettings } from './TimerSettingsModal';
import {
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
  onSnapshot,
  getDocFromServer,
  increment,
} from 'firebase/firestore';
import { db } from '../../../firebaseConfig';

import MiniWidgetTimer from './MiniWidgetTimer';
import OverlaysTimer from './OverlaysTimer';
import InterfacePrincipalTimer from './InterfacePrincipalTimer';

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

const toMillisSafe = (ts) => {
  try { return ts?.toMillis?.() ?? null; } catch { return null; }
};

// 🛡️ ANTI-EPOCH: Valida se um valor ms é razoável (não é timestamp epoch)
const isValidElapsedMs = (ms) => {
  const val = Number(ms);
  if (!Number.isFinite(val)) return false;
  // Máximo 7 dias em ms (604800000) - qualquer coisa acima é suspeita
  return val >= 0 && val < 604800000;
};

function StudyTimer({
  disciplina,
  assunto,
  contextHint = null,
  sessaoGlobalIndex = null,
  onStop,
  onCancel,
  isMinimized,
  onMaximize: onWidgetMode,
  onMinimize: onWidgetMinimize,
  raised = false,

  userUid,
  userName,
  userPhotoURL,

  variant = 'study',
  timerMode,
  countdownSeconds = 0,
  storageKeyOverride,
  activeTimerCollectionOverride,
  activeTimerDocIdOverride,
  finishButtonLabel,
}) {
  const { settings } = useTimerSettings(userUid);

  const tabIdRef = useRef(
    (() => {
      try { if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID(); } catch {}
      return `tab_${Math.random().toString(16).slice(2)}_${Date.now()}`;
    })()
  );

  const mountTimeRef = useRef(Date.now());
  const bcRef = useRef(null);

  const joinedExistingRef = useRef(false);
  const hasSessionStartedRef = useRef(false);
  const hasEverSeenRemoteDocRef = useRef(false);
  const lastAppliedStateKeyRef = useRef(null);

  // ✅ Ref que controla intenção local (separado do estado remoto)
  const desiredRunningRef = useRef(false);

  // ======= NTP / offset =======
  const serverOffsetMsRef = useRef(0);
  const bestRttRef = useRef(Number.POSITIVE_INFINITY);
  const timeSyncInFlightRef = useRef(false);

  const nowMs = useCallback(() => Date.now() + (Number(serverOffsetMsRef.current) || 0), []);

  const STORAGE_KEY = useMemo(() => {
    if (storageKeyOverride) return storageKeyOverride;
    return `@ModoQAP:ActiveSession:${userUid}`;
  }, [storageKeyOverride, userUid]);

  const [isPreparing, setIsPreparing] = useState(true);
  const [countdown, setCountdown] = useState(3);

  const [seconds, setSeconds] = useState(0);
  const [totalFocusSeconds, setTotalFocusSeconds] = useState(0);

  const [isPaused, setIsPaused] = useState(false);
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isDark, setIsDark] = useState(true);

  const [isPomodoroFinished, setIsPomodoroFinished] = useState(false);
  const [isResting, setIsResting] = useState(false);
  const [isRestFinished, setIsRestFinished] = useState(false);

  // ✅ FIX: Estado para armazenar o modo vindo do servidor (garante sync entre dispositivos)
  const [remoteMode, setRemoteMode] = useState(null);
  const remoteModeRef = useRef(null);

  // ✅ FIX: Armazena o countdownSeconds vindo do servidor
  const [remoteCountdownSeconds, setRemoteCountdownSeconds] = useState(null);
  const remoteCountdownSecondsRef = useRef(null);

  const secondsRef = useRef(0);
  const isPausedRef = useRef(false);
  const isRestingRef = useRef(false);
  const isPomodoroFinishedRef = useRef(false);
  const isRestFinishedRef = useRef(false);
  const totalFocusSecondsRef = useRef(0);

  useEffect(() => { secondsRef.current = seconds; }, [seconds]);
  useEffect(() => { isPausedRef.current = isPaused; }, [isPaused]);
  useEffect(() => { isRestingRef.current = isResting; }, [isResting]);
  useEffect(() => { isPomodoroFinishedRef.current = isPomodoroFinished; }, [isPomodoroFinished]);
  useEffect(() => { isRestFinishedRef.current = isRestFinished; }, [isRestFinished]);
  useEffect(() => { totalFocusSecondsRef.current = totalFocusSeconds; }, [totalFocusSeconds]);

  const intervalRef = useRef(null);

  const focusAccumulatedMsRef = useRef(0);
  const focusBlockElapsedBaseMsRef = useRef(0);
  const restElapsedBaseMsRef = useRef(0);

  // IMPORTANT: esses ms são no "relógio do servidor" (via offset)
  const focusStartMsRef = useRef(null);
  const restStartMsRef = useRef(null);

  const lastPersistDisplaySecondRef = useRef(-1);
  const actionInFlightRef = useRef(false);

  const audioRef = useRef(null);
  const alarmRef = useRef(null);
  const originalTitleRef = useRef(document.title);

  const wakeLockRef = useRef(null);
  const wakeLockWantedRef = useRef(false);

  // ✅ NOVO: controla se o servidor já "ackou" o doc do timer (evita depender do heartbeat de 30s)
  const remoteAckRef = useRef(false);
  const remoteStartMsAckedRef = useRef(null);

  const requestWakeLock = useCallback(async () => {
    try {
      if (!('wakeLock' in navigator)) return;
      if (!wakeLockWantedRef.current) return;
      if (wakeLockRef.current) return;

      const lock = await navigator.wakeLock.request('screen');
      wakeLockRef.current = lock;
      lock.addEventListener('release', () => { wakeLockRef.current = null; });
    } catch {}
  }, []);

  const releaseWakeLock = useCallback(async () => {
    try {
      wakeLockWantedRef.current = false;
      if (wakeLockRef.current) await wakeLockRef.current.release();
    } catch {}
    wakeLockRef.current = null;
  }, []);

  // ✅ FIX: effectiveMode agora prioriza o modo vindo do servidor quando entrando em sessão existente.
  // Isso garante que o PC exiba "pomodoro" quando o tablet iniciou nesse modo.
  const effectiveMode = useMemo(() => {
    if (variant === 'simulado') {
      if (timerMode === 'countdown') return 'countdown';
      return 'free';
    }
    // Se já temos um modo remoto (entramos em sessão existente), use-o
    if (remoteMode) return remoteMode;
    return settings.mode;
  }, [variant, timerMode, settings.mode, remoteMode]);

  // ✅ FIX: countdownSeconds também pode vir do servidor
  const safeCountdownSeconds = useMemo(() => {
    // Prioriza o valor do servidor se disponível (sessão remota)
    const sourceSeconds = remoteCountdownSeconds !== null ? remoteCountdownSeconds : countdownSeconds;
    const n = Number(sourceSeconds) || 0;
    return Math.max(0, Math.floor(n));
  }, [countdownSeconds, remoteCountdownSeconds]);

  const isPomodoro = effectiveMode === 'pomodoro';
  const isCountdown = effectiveMode === 'countdown';

  const themeColor = (variant !== 'simulado' && isResting) ? '#3B82F6' : settings.color;

  const activeTimerCollectionName = activeTimerCollectionOverride || ACTIVE_TIMER_COLLECTION;
  const activeTimerDocId = activeTimerDocIdOverride || userUid;

  const activeTimerDocRef = useMemo(() => {
    if (!userUid) return null;
    if (!activeTimerCollectionName) return null;
    if (!activeTimerDocId) return null;
    return doc(db, activeTimerCollectionName, activeTimerDocId);
  }, [userUid, activeTimerCollectionName, activeTimerDocId]);

  const timeSyncDocRef = useMemo(() => {
    if (!userUid) return null;
    return doc(db, 'time_sync', `${userUid}_${tabIdRef.current}`);
  }, [userUid]);

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

  const closeAllOverlaysLocal = useCallback(() => {
    setIsCancelModalOpen(false);
    if (variant !== 'simulado') {
      if (isPomodoroFinishedRef.current) { setIsPomodoroFinished(false); isPomodoroFinishedRef.current = false; }
      if (isRestFinishedRef.current) { setIsRestFinished(false); isRestFinishedRef.current = false; }
    }
  }, [variant]);

  // ========= TIME SYNC =========
  const trySampleWithActiveDoc = useCallback(async (i) => {
    if (!activeTimerDocRef) return null;
    const t0 = Date.now();
    try {
      await updateDoc(activeTimerDocRef, {
        __ts_ping: serverTimestamp(),
        __ts_nonce: `${tabIdRef.current}_${t0}_${i}`,
      });
      const snap = await getDocFromServer(activeTimerDocRef);
      const t1 = Date.now();
      const serverMs = toMillisSafe(snap.data()?.__ts_ping);
      if (!Number.isFinite(serverMs)) return null;

      const rtt = Math.max(0, t1 - t0);
      const offset = serverMs - ((t0 + t1) / 2);

      return { rtt, offset };
    } catch {
      return null;
    }
  }, [activeTimerDocRef]);

  const trySampleWithTimeSyncDoc = useCallback(async (i) => {
    if (!timeSyncDocRef) return null;
    const t0 = Date.now();
    try {
      await setDoc(timeSyncDocRef, {
        tab: tabIdRef.current,
        nonce: `${t0}_${i}`,
        ts: serverTimestamp(),
      }, { merge: false });

      const snap = await getDocFromServer(timeSyncDocRef);
      const t1 = Date.now();
      const serverMs = toMillisSafe(snap.data()?.ts);
      if (!Number.isFinite(serverMs)) return null;

      const rtt = Math.max(0, t1 - t0);
      const offset = serverMs - ((t0 + t1) / 2);
      return { rtt, offset };
    } catch {
      return null;
    }
  }, [timeSyncDocRef]);

  const performTimeSync = useCallback(async () => {
    if (!userUid) return;
    if (timeSyncInFlightRef.current) return;
    timeSyncInFlightRef.current = true;

    try {
      for (let i = 0; i < 3; i++) {
        let sample = await trySampleWithActiveDoc(i);
        if (!sample) sample = await trySampleWithTimeSyncDoc(i);

        if (sample && sample.rtt < bestRttRef.current) {
          bestRttRef.current = sample.rtt;
          serverOffsetMsRef.current = sample.offset;

          console.log(`[TimeSync] RTT: ${sample.rtt}ms, Offset: ${sample.offset}ms`);
        }

        await new Promise((r) => setTimeout(r, 80));
      }
    } finally {
      timeSyncInFlightRef.current = false;
    }
  }, [userUid, trySampleWithActiveDoc, trySampleWithTimeSyncDoc]);

  const ensureTimeSync = useCallback(async () => {
    if (!Number.isFinite(bestRttRef.current) || bestRttRef.current === Number.POSITIVE_INFINITY) {
      await performTimeSync();
    }
  }, [performTimeSync]);

  useEffect(() => {
    if (!userUid) return;
    performTimeSync();
  }, [userUid, performTimeSync]);

  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === 'visible') performTimeSync();
    };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, [performTimeSync]);

  // ========= ms -> display seconds =========
  const getCurrentFocusElapsedMs = useCallback(() => {
    let ms = Number(focusAccumulatedMsRef.current || 0);

    if (!isValidElapsedMs(ms)) {
      console.warn('[Timer] Invalid focusAccumulatedMs detected, resetting to 0');
      focusAccumulatedMsRef.current = 0;
      ms = 0;
    }

    if (!isPausedRef.current && focusStartMsRef.current != null) {
      ms += Math.max(0, nowMs() - focusStartMsRef.current);
    }
    return Math.max(0, ms);
  }, [nowMs]);

  const getCurrentRestElapsedMs = useCallback(() => {
    let ms = Number(restElapsedBaseMsRef.current || 0);

    if (!isValidElapsedMs(ms)) {
      console.warn('[Timer] Invalid restElapsedBaseMs detected, resetting to 0');
      restElapsedBaseMsRef.current = 0;
      ms = 0;
    }

    if (!isPausedRef.current && restStartMsRef.current != null) {
      ms += Math.max(0, nowMs() - restStartMsRef.current);
    }
    return Math.max(0, ms);
  }, [nowMs]);

  const getCurrentPomodoroBlockElapsedMs = useCallback(() => {
    let ms = Number(focusBlockElapsedBaseMsRef.current || 0);

    if (!isValidElapsedMs(ms)) {
      console.warn('[Timer] Invalid focusBlockElapsedBaseMs detected, resetting to 0');
      focusBlockElapsedBaseMsRef.current = 0;
      ms = 0;
    }

    if (!isPausedRef.current && focusStartMsRef.current != null) {
      ms += Math.max(0, nowMs() - focusStartMsRef.current);
    }
    return Math.max(0, ms);
  }, [nowMs]);

  const getDisplaySecondsFromCurrentState = useCallback(() => {
    if (variant !== 'simulado' && isRestFinishedRef.current) return 0;
    if (variant !== 'simulado' && isPomodoroFinishedRef.current && !isRestingRef.current) return 0;

    // Usa effectiveMode via ref para evitar stale closure
    const currentMode = remoteModeRef.current || (variant === 'simulado' ? (timerMode === 'countdown' ? 'countdown' : 'free') : null);

    const resolvedMode = currentMode || effectiveMode;

    if (resolvedMode === 'countdown') {
      const cdSecs = remoteCountdownSecondsRef.current !== null
        ? remoteCountdownSecondsRef.current
        : Math.max(0, Math.floor(Number(countdownSeconds) || 0));
      const totalMs = Math.max(0, cdSecs * 1000);
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

    if (resolvedMode === 'pomodoro' && variant !== 'simulado') {
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
    timerMode,
    countdownSeconds,
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

  const setTotalFocusIfChanged = useCallback((next) => {
    const safe = Math.max(0, Number(next) || 0);
    if (safe !== totalFocusSecondsRef.current) {
      totalFocusSecondsRef.current = safe;
      setTotalFocusSeconds(safe);
    }
  }, []);

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
      else if (isRunning) prefix = (remoteModeRef.current === 'pomodoro' || settings.mode === 'pomodoro') ? "Focando" : "Estudando";
    }
    document.title = `${prefix}: ${timeString} - ${(disciplina?.nome || 'Disciplina')}`;
  }, [disciplina?.nome, settings.mode, variant]);

  const computeMediaPositionState = useCallback((displaySeconds) => {
    let duration = 60;
    let position = 0;

    const resolvedMode = remoteModeRef.current || effectiveMode;

    if (resolvedMode === 'countdown') {
      const cdSecs = remoteCountdownSecondsRef.current !== null
        ? remoteCountdownSecondsRef.current
        : Math.max(1, Number(countdownSeconds) || 1);
      duration = Math.max(1, cdSecs);
      const remaining = Math.max(0, Number(displaySeconds) || 0);
      position = Math.min(duration, Math.max(0, duration - remaining));
      return { duration, position };
    }

    if (variant !== 'simulado' && isRestingRef.current) {
      const total = Math.max(1, Number(settings.restTime || 1) * 60);
      duration = total;
      const remaining = Math.max(0, Number(displaySeconds) || 0);
      position = Math.min(total, Math.max(0, total - remaining));
      return { duration, position };
    }

    if (resolvedMode === 'pomodoro' && variant !== 'simulado') {
      const total = Math.max(1, Number(settings.pomodoroTime || 1) * 60);
      duration = total;
      const remaining = Math.max(0, Number(displaySeconds) || 0);
      position = Math.min(total, Math.max(0, total - remaining));
      return { duration, position };
    }

    position = Math.max(0, Number(displaySeconds) || 0);
    duration = Math.max(3600, position + 60);
    return { duration, position };
  }, [effectiveMode, variant, settings.restTime, settings.pomodoroTime, countdownSeconds]);

  const updateMediaSession = useCallback((isRunning, displaySeconds) => {
    if (!('mediaSession' in navigator)) return;
    try {
      const mainTitle = assunto
        ? `${disciplina?.nome || 'Disciplina'} • ${assunto}`
        : (disciplina?.nome || 'Disciplina');

      const resolvedMode = remoteModeRef.current || settings.mode;

      let contextLabel = 'Estudando';
      if (variant === 'simulado') contextLabel = 'Simulado';
      else if (isRestFinishedRef.current) contextLabel = 'Descanso Finalizado';
      else if (isRestingRef.current) contextLabel = 'Descansando';
      else if (resolvedMode === 'pomodoro') contextLabel = 'Foco';

      const timerLine = `${contextLabel} • ${formatClock(displaySeconds)}`;

      navigator.mediaSession.metadata = new MediaMetadata({
        title: mainTitle,
        artist: timerLine,
        album: "ModoQAP",
        artwork: [{ src: '/logoModoQAP.png', sizes: '512x512', type: 'image/png' }]
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

  // ========= Broadcast Channel =========
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
    try {
      const currentStorage = rememberJson(localStorage.getItem(STORAGE_KEY)) || {};
      if (currentStorage.isFinishing) return;

      const resolvedMode = remoteModeRef.current || effectiveMode;

      const data = {
        ...currentStorage,
        schemaVersion: 8,
        disciplinaId: disciplina?.id,
        disciplinaNome: disciplina?.nome,
        assunto: assunto ?? null,
        defaultContext: contextHint || null,
        sessaoGlobalIndex: Number.isFinite(Number(sessaoGlobalIndex)) ? Number(sessaoGlobalIndex) : null,
        variant,
        mode: resolvedMode,
        pomodoroDuration: Number(settings.pomodoroTime || 0) * 60,
        restDuration: Number(settings.restTime || 0) * 60,
        countdownSeconds: resolvedMode === 'countdown'
          ? (remoteCountdownSecondsRef.current !== null ? remoteCountdownSecondsRef.current : Number(countdownSeconds))
          : 0,
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
    } catch {}
  }, [
    STORAGE_KEY,
    disciplina?.id, disciplina?.nome, assunto, contextHint, sessaoGlobalIndex,
    variant,
    effectiveMode,
    settings.pomodoroTime, settings.restTime,
    countdownSeconds
  ]);

  // ========= persist helper =========
  const persistLocalState = useCallback((overrides = {}) => {
    try {
      const now = Date.now();
      const focusMs = Math.max(0, Number(getCurrentFocusElapsedMs() || 0));
      const restMs = Math.max(0, Number(getCurrentRestElapsedMs() || 0));
      const pomoMs = Math.max(0, Number(getCurrentPomodoroBlockElapsedMs() || 0));

      saveToStorage({
        isPaused: (typeof overrides.isPaused === 'boolean') ? overrides.isPaused : !!isPausedRef.current,
        isResting: (typeof overrides.isResting === 'boolean') ? overrides.isResting : !!isRestingRef.current,
        restFinished: (typeof overrides.restFinished === 'boolean') ? overrides.restFinished : !!isRestFinishedRef.current,
        pomodoroBlockFinished: (typeof overrides.pomodoroBlockFinished === 'boolean')
          ? overrides.pomodoroBlockFinished
          : !!isPomodoroFinishedRef.current,

        focusAccumulatedMs: (typeof overrides.focusAccumulatedMs === 'number') ? overrides.focusAccumulatedMs : focusMs,
        focusBlockElapsedBaseMs: (typeof overrides.focusBlockElapsedBaseMs === 'number') ? overrides.focusBlockElapsedBaseMs : pomoMs,
        restElapsedBaseMs: (typeof overrides.restElapsedBaseMs === 'number') ? overrides.restElapsedBaseMs : restMs,
        lastTimestamp: now,
      });
    } catch {}
  }, [
    saveToStorage,
    getCurrentFocusElapsedMs,
    getCurrentRestElapsedMs,
    getCurrentPomodoroBlockElapsedMs,
  ]);

  // ========= tick loop =========
  const clearTick = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  // ========= Firestore payload =========
  const buildActiveTimerPayload = useCallback((extra = {}) => {
    const resolvedMode = remoteModeRef.current || effectiveMode;

    const phase =
      (variant !== 'simulado' && isRestFinishedRef.current) ? 'rest_finished'
        : (variant !== 'simulado' && isPomodoroFinishedRef.current) ? 'pomodoro_finished'
          : (variant !== 'simulado' && isRestingRef.current) ? 'rest'
            : 'focus';

    const timerTypeLabel =
      resolvedMode === 'countdown' ? 'cronometro'
        : (resolvedMode === 'pomodoro' ? 'pomodoro' : 'livre');

    const uiOverlay =
      (variant !== 'simulado' && isRestFinishedRef.current) ? 'rest_finished'
        : (variant !== 'simulado' && isPomodoroFinishedRef.current) ? 'pomodoro_finished'
          : (isCancelModalOpen ? 'cancel_confirm' : 'none');

    const cdSecs = remoteCountdownSecondsRef.current !== null
      ? remoteCountdownSecondsRef.current
      : (resolvedMode === 'countdown' ? Number(countdownSeconds) : 0);

    return {
      uid: userUid || null,
      userName: userName || 'Estudante',
      userPhotoURL: userPhotoURL || null,
      disciplinaId: disciplina?.id || null,
      disciplinaNome: disciplina?.nome || '',
      assunto: assunto ?? null,
      defaultContext: contextHint || null,
      sessaoGlobalIndex: Number.isFinite(Number(sessaoGlobalIndex)) ? Number(sessaoGlobalIndex) : null,

      timerType: timerTypeLabel,
      mode: resolvedMode,
      variant: variant || 'study',

      phase,
      uiOverlay,

      status: isPausedRef.current ? 'paused' : 'running',
      isPaused: !!isPausedRef.current,
      isResting: !!isRestingRef.current,

      focusBaseMs: Number(focusAccumulatedMsRef.current || 0),
      pomoBaseMs: Number(focusBlockElapsedBaseMsRef.current || 0),
      restBaseMs: Number(restElapsedBaseMsRef.current || 0),

      displaySecondsSnapshot: Number(secondsRef.current || 0),
      snapshotAt: serverTimestamp(),
      focusElapsedMsSnapshot: Number(getCurrentFocusElapsedMs() || 0),
      restElapsedMsSnapshot: Number(getCurrentRestElapsedMs() || 0),
      pomodoroElapsedMsSnapshot: Number(getCurrentPomodoroBlockElapsedMs() || 0),

      runStartedAt: null,
      runStartedAtMs: null,

      countdownSeconds: cdSecs,
      pomodoroSeconds: Number(settings.pomodoroTime || 0) * 60,
      restSeconds: Number(settings.restTime || 0) * 60,

      actionSeq: Number(extra.actionSeq ?? 0),
      action: extra.action ?? null,
      actionAt: extra.actionAt ?? null,

      updatedBy: tabIdRef.current,
      updatedAt: serverTimestamp(),
      heartbeatAt: serverTimestamp(),
      ...extra,
    };
  }, [
    userUid, userName, userPhotoURL,
    disciplina?.id, disciplina?.nome, assunto, contextHint, sessaoGlobalIndex,
    effectiveMode, variant, countdownSeconds,
    settings.pomodoroTime, settings.restTime,
    isCancelModalOpen,
    getCurrentFocusElapsedMs, getCurrentRestElapsedMs, getCurrentPomodoroBlockElapsedMs
  ]);

  const upsertActiveTimer = useCallback(async (extra = {}, { merge = true } = {}) => {
    if (!activeTimerDocRef) return;
    try {
      const payload = buildActiveTimerPayload(extra);
      await setDoc(activeTimerDocRef, payload, { merge });
    } catch {}
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
      updatedBy: tabIdRef.current,
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
    } catch {
      await upsertActiveTimer(patch, { merge: true });
    }
  }, [
    activeTimerDocRef,
    upsertActiveTimer,
    getCurrentFocusElapsedMs,
    getCurrentRestElapsedMs,
    getCurrentPomodoroBlockElapsedMs
  ]);

  const removeActiveTimer = useCallback(async () => {
    if (!activeTimerDocRef) return;
    try { await deleteDoc(activeTimerDocRef); } catch {}
  }, [activeTimerDocRef]);

  const ensureRemoteStartAck = useCallback(async (startMs) => {
    if (!activeTimerDocRef) return false;

    remoteAckRef.current = false;
    remoteStartMsAckedRef.current = startMs;

    const basePayload = {
      status: 'running',
      isPaused: false,
      runStartedAt: serverTimestamp(),
      runStartedAtMs: startMs,
      action: 'start',
      actionAt: serverTimestamp(),
      actionSeq: increment(1),
      updatedBy: tabIdRef.current,
      updatedAt: serverTimestamp(),
      heartbeatAt: serverTimestamp(),
      focusBaseMs: 0,
      uiOverlay: 'none',
      phase: 'focus',
      isResting: false,
    };

    const delays = [0, 250, 500, 900, 1400, 2000, 2500];

    for (let i = 0; i < delays.length; i++) {
      if (remoteAckRef.current) return true;

      const d = delays[i];
      if (d > 0) await new Promise(r => setTimeout(r, d));

      try {
        await setDoc(activeTimerDocRef, buildActiveTimerPayload(basePayload), { merge: true });
      } catch {}

      try {
        const snap = await getDocFromServer(activeTimerDocRef);
        if (snap.exists()) {
          const data = snap.data() || {};
          const rs = Number(data.runStartedAtMs);
          if (Number.isFinite(rs) && rs === startMs && data.status === 'running' && !data.isPaused) {
            remoteAckRef.current = true;
            return true;
          }
        }
      } catch {}
    }

    return false;
  }, [activeTimerDocRef, buildActiveTimerPayload]);

  useEffect(() => {
    if (!activeTimerDocRef) return;
    if (isPreparing) return;

    const fast = setInterval(() => {
      if (!remoteAckRef.current && remoteStartMsAckedRef.current != null) {
        patchActiveTimer({}, { includeSnapshot: true, touchUpdatedAt: true, touchHeartbeat: true });
      }
    }, 2000);

    return () => clearInterval(fast);
  }, [activeTimerDocRef, isPreparing, patchActiveTimer]);

  useEffect(() => {
    if (!activeTimerDocRef) return;
    if (isPreparing) return;
    const t = setInterval(() => {
      patchActiveTimer({}, { includeSnapshot: true, touchUpdatedAt: true, touchHeartbeat: true });
    }, 30000);
    return () => clearInterval(t);
  }, [activeTimerDocRef, isPreparing, patchActiveTimer]);

  // theme init
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

  // ✅ FIX BUG 1: Quando o usuário muda o modo nas configurações (ex: livre → pomodoro),
  // faz patch imediato no Firestore para que outros dispositivos recebam o novo modo via snapshot.
  const prevEffectiveModeRef = useRef(null);
  useEffect(() => {
    // Ignora a primeira renderização e mudanças de modo que vieram do próprio servidor (remoteMode)
    if (prevEffectiveModeRef.current === null) {
      prevEffectiveModeRef.current = effectiveMode;
      return;
    }
    if (prevEffectiveModeRef.current === effectiveMode) return;

    const oldMode = prevEffectiveModeRef.current;
    prevEffectiveModeRef.current = effectiveMode;

    // Só sincroniza se a sessão já está ativa
    if (!hasSessionStartedRef.current || !activeTimerDocRef) return;
    // Não sincroniza se a mudança veio do servidor (remoteMode preenchido)
    // Só sincroniza mudanças que o usuário fez localmente via settings
    if (remoteModeRef.current) return;

    console.log(`[ModeSync] Modo mudou localmente: ${oldMode} → ${effectiveMode}. Sincronizando com Firestore...`);

    const resolvedMode = effectiveMode;
    const timerTypeLabel =
      resolvedMode === 'countdown' ? 'cronometro'
        : (resolvedMode === 'pomodoro' ? 'pomodoro' : 'livre');

    patchActiveTimer({
      mode: resolvedMode,
      timerType: timerTypeLabel,
      action: 'mode_change',
      actionAt: serverTimestamp(),
      actionSeq: increment(1),
    }, { includeSnapshot: false, touchUpdatedAt: true, touchHeartbeat: false });
  }, [effectiveMode, activeTimerDocRef, patchActiveTimer]);


  const cleanupAndCancel = useCallback(async (source = 'local', opts = {}) => {
    const { skipFirestoreDelete = false } = opts;

    clearTick();

    joinedExistingRef.current = false;
    hasSessionStartedRef.current = false;
    desiredRunningRef.current = false;

    remoteAckRef.current = false;
    remoteStartMsAckedRef.current = null;

    // ✅ Limpa modo remoto ao cancelar
    remoteModeRef.current = null;
    remoteCountdownSecondsRef.current = null;
    setRemoteMode(null);
    setRemoteCountdownSeconds(null);

    try { audioRef.current?.pause?.(); } catch {}
    try { alarmRef.current?.pause?.(); } catch {}
    await releaseWakeLock();

    try { localStorage.removeItem(STORAGE_KEY); } catch {}

    if (!skipFirestoreDelete) await removeActiveTimer();

    restoreDocumentTitle();
    clearMediaSession();

    if (source === 'user') postBC({ type: 'TIMER_ACTION', action: 'CANCEL' });

    onCancel?.();
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

  const handleStopInternal = useCallback(
    (source = 'user', reason = 'manual') => {
      const n = nowMs();

      const startMs = focusStartMsRef.current;
      if (typeof startMs === 'number') {
        focusAccumulatedMsRef.current += Math.max(0, n - startMs);
      }
      focusStartMsRef.current = null;

      desiredRunningRef.current = false;
      isPausedRef.current = true;
      setIsPaused(true);

      clearTick();
      void releaseWakeLock();

      const display = getDisplaySecondsFromCurrentState();
      setSecondsIfChanged(display);
      updateExternalStatus(false, display);

      persistLocalState({ isPaused: true });

      void patchActiveTimer({
        status: 'paused',
        isPaused: true,
        action: 'stop',
        actionAt: serverTimestamp(),
        actionSeq: increment(1),
        stopReason: reason,
        updatedBy: tabIdRef.current,
        updatedAt: serverTimestamp(),
        focusBaseMs: Math.floor(focusAccumulatedMsRef.current),
      });

      try {
        document.title = originalTitleRef.current || 'Timer';
      } catch {}

      if (source === 'user') {
        postBC({ action: 'STOP', reason, at: Date.now() });

        if (onStop) {
          const finalSeconds = Math.floor(focusAccumulatedMsRef.current / 1000);
          const finalMinutes = Math.ceil(finalSeconds / 60);
          onStop(finalMinutes);
        }
      }
    },
    [
      nowMs,
      getDisplaySecondsFromCurrentState,
      setSecondsIfChanged,
      updateExternalStatus,
      clearTick,
      releaseWakeLock,
      persistLocalState,
      patchActiveTimer,
      postBC,
      onStop,
    ]
  );

  const handleStop = useCallback(() => {
    handleStopInternal('user', 'user');
  }, [handleStopInternal]);

  // ========= COMPLETES =========
  const handlePomodoroComplete = useCallback(() => {
    clearTick();
    const now = nowMs();

    if (focusStartMsRef.current != null) {
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
    desiredRunningRef.current = false;

    setSecondsIfChanged(0);

    try { audioRef.current?.pause?.(); } catch {}

    if (alarmRef.current) {
      alarmRef.current.src = getSoundUrl();
      alarmRef.current.volume = settings.soundVolume || 0.5;
      alarmRef.current.play().catch(() => {});
    }

    safeNotify("Pomodoro Concluído!", "Hora de descansar.");
    setTotalFocusIfChanged(Math.floor((focusAccumulatedMsRef.current || 0) / 1000));

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
      runStartedAtMs: null,
      phase: 'pomodoro_finished',
      uiOverlay: 'pomodoro_finished',
      focusBaseMs: Number(focusAccumulatedMsRef.current || 0),
      pomoBaseMs: Number(focusBlockElapsedBaseMsRef.current || 0),
      restBaseMs: Number(restElapsedBaseMsRef.current || 0),
      actionSeq: increment(1),
      action: 'pomodoro_complete',
      actionAt: serverTimestamp(),
    }, { includeSnapshot: true });

    releaseWakeLock();
  }, [
    clearTick,
    nowMs,
    getSoundUrl,
    settings.pomodoroTime,
    settings.soundVolume,
    saveToStorage,
    updateExternalStatus,
    updateMediaSession,
    patchActiveTimer,
    setSecondsIfChanged,
    setTotalFocusIfChanged,
    releaseWakeLock
  ]);

  const handleRestComplete = useCallback(() => {
    clearTick();
    const now = nowMs();

    if (restStartMsRef.current != null) {
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
    desiredRunningRef.current = false;

    setSecondsIfChanged(0);

    try { audioRef.current?.pause?.(); } catch {}

    if (alarmRef.current) {
      alarmRef.current.src = getSoundUrl();
      alarmRef.current.volume = settings.soundVolume || 0.5;
      alarmRef.current.play().catch(() => {});
    }

    safeNotify("Descanso Finalizado!", "Hora de voltar a estudar.");
    setTotalFocusIfChanged(Math.floor((focusAccumulatedMsRef.current || 0) / 1000));

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
      runStartedAtMs: null,
      phase: 'rest_finished',
      uiOverlay: 'rest_finished',
      focusBaseMs: Number(focusAccumulatedMsRef.current || 0),
      pomoBaseMs: Number(focusBlockElapsedBaseMsRef.current || 0),
      restBaseMs: Number(restElapsedBaseMsRef.current || 0),
      actionSeq: increment(1),
      action: 'rest_complete',
      actionAt: serverTimestamp(),
    }, { includeSnapshot: true });

    releaseWakeLock();
  }, [
    clearTick,
    nowMs,
    getSoundUrl,
    settings.restTime,
    settings.soundVolume,
    saveToStorage,
    updateExternalStatus,
    updateMediaSession,
    patchActiveTimer,
    setSecondsIfChanged,
    setTotalFocusIfChanged,
    releaseWakeLock
  ]);

  // ========= tick (leve) =========
  const startTickLoop = useCallback(() => {
    clearTick();

    const tick = () => {
      if (isPausedRef.current) return;

      const display = getDisplaySecondsFromCurrentState();
      setSecondsIfChanged(display);

      const focusElapsedSec = Math.floor(getCurrentFocusElapsedMs() / 1000);
      setTotalFocusIfChanged(focusElapsedSec);

      if (display !== lastPersistDisplaySecondRef.current) {
        lastPersistDisplaySecondRef.current = display;

        saveToStorage({
          isPaused: false,
          isResting: !!isRestingRef.current,
          restFinished: !!isRestFinishedRef.current,
          pomodoroBlockFinished: !!isPomodoroFinishedRef.current,
          focusAccumulatedMs: getCurrentFocusElapsedMs(),
          focusBlockElapsedBaseMs: getCurrentPomodoroBlockElapsedMs(),
          restElapsedBaseMs: getCurrentRestElapsedMs(),
          lastTimestamp: Date.now(),
        });

        updateExternalStatus(true, display);
        updateMediaSession(true, display);

        const resolvedMode = remoteModeRef.current || effectiveMode;

        if (resolvedMode === 'countdown') {
          if (display <= 0) handleStopInternal('timeup', 'countdown_complete');
        } else if (variant !== 'simulado' && isRestingRef.current) {
          if (display <= 0) handleRestComplete();
        } else if (resolvedMode === 'pomodoro' && variant !== 'simulado') {
          if (display <= 0) handlePomodoroComplete();
        }
      }
    };

    tick();
    intervalRef.current = setInterval(tick, 250);
  }, [
    clearTick,
    effectiveMode,
    variant,
    getDisplaySecondsFromCurrentState,
    setSecondsIfChanged,
    getCurrentFocusElapsedMs,
    getCurrentPomodoroBlockElapsedMs,
    getCurrentRestElapsedMs,
    setTotalFocusIfChanged,
    saveToStorage,
    updateExternalStatus,
    updateMediaSession,
    handleStopInternal,
    handleRestComplete,
    handlePomodoroComplete
  ]);

  // ========= PAUSE / RESUME =========
  const pauseTimer = useCallback(
    (source = 'user') => {
      if (isPausedRef.current) return;
      if (actionInFlightRef.current) return;
      actionInFlightRef.current = true;

      const n = nowMs();

      // ✅ FIX: acumula o tempo correto dependendo da fase (foco ou descanso)
      if (isRestingRef.current) {
        // Durante o descanso, acumula em restElapsedBaseMsRef
        const restStart = restStartMsRef.current;
        if (typeof restStart === 'number') {
          const delta = Math.max(0, n - restStart);
          restElapsedBaseMsRef.current += delta;
        }
        restStartMsRef.current = null;
      } else {
        // Durante o foco, acumula em focusAccumulatedMs e pomoBase
        const startMs = focusStartMsRef.current;
        if (typeof startMs === 'number') {
          const delta = Math.max(0, n - startMs);
          focusAccumulatedMsRef.current += delta;
          focusBlockElapsedBaseMsRef.current += delta;
        }
        focusStartMsRef.current = null;
      }

      desiredRunningRef.current = false;
      isPausedRef.current = true;
      setIsPaused(true);

      const display = getDisplaySecondsFromCurrentState();
      setSecondsIfChanged(display);

      updateExternalStatus(false, display);

      clearTick();
      void releaseWakeLock();

      persistLocalState({ isPaused: true });

      void patchActiveTimer({
        status: 'paused',
        isPaused: true,
        action: 'pause',
        actionAt: serverTimestamp(),
        actionSeq: increment(1),
        updatedBy: tabIdRef.current,
        updatedAt: serverTimestamp(),
        focusBaseMs: Math.floor(focusAccumulatedMsRef.current),
        // ✅ FIX: envia pomoBaseMs atualizado para outros dispositivos não resetarem o bloco
        pomoBaseMs: Math.floor(focusBlockElapsedBaseMsRef.current),
        uiOverlay: 'none',
      });

      setTimeout(() => {
        actionInFlightRef.current = false;
      }, 300);

      if (source === 'user') {
        postBC({ action: 'PAUSE', at: Date.now() });
      }
    },
    [
      nowMs,
      getDisplaySecondsFromCurrentState,
      setSecondsIfChanged,
      updateExternalStatus,
      clearTick,
      releaseWakeLock,
      persistLocalState,
      patchActiveTimer,
      postBC,
    ]
  );

  const resumeTimer = useCallback(
    (source = 'user') => {
      if (!isPausedRef.current) return;
      if (actionInFlightRef.current) return;
      actionInFlightRef.current = true;

      const n = nowMs();

      // ✅ FIX: retoma o ponteiro correto dependendo da fase (foco ou descanso)
      if (isRestingRef.current) {
        restStartMsRef.current = n;
        focusStartMsRef.current = null;
      } else {
        focusStartMsRef.current = n;
        restStartMsRef.current = null;
      }

      desiredRunningRef.current = true;
      isPausedRef.current = false;
      setIsPaused(false);

      closeAllOverlaysLocal();

      const display = getDisplaySecondsFromCurrentState();
      setSecondsIfChanged(display);

      updateExternalStatus(true, display);

      startTickLoop();
      void requestWakeLock();

      persistLocalState({ isPaused: false });

      void patchActiveTimer({
        status: 'running',
        isPaused: false,
        runStartedAt: serverTimestamp(),
        runStartedAtMs: n,
        action: 'resume',
        actionAt: serverTimestamp(),
        actionSeq: increment(1),
        updatedBy: tabIdRef.current,
        updatedAt: serverTimestamp(),
        focusBaseMs: Math.floor(focusAccumulatedMsRef.current),
        pomoBaseMs: Math.floor(focusBlockElapsedBaseMsRef.current),
        restBaseMs: Math.floor(restElapsedBaseMsRef.current),
        uiOverlay: 'none',
      });

      setTimeout(() => {
        actionInFlightRef.current = false;
      }, 300);

      if (source === 'user') {
        postBC({ action: 'RESUME', at: Date.now() });
      }
    },
    [
      nowMs,
      closeAllOverlaysLocal,
      getDisplaySecondsFromCurrentState,
      setSecondsIfChanged,
      updateExternalStatus,
      startTickLoop,
      requestWakeLock,
      persistLocalState,
      patchActiveTimer,
      postBC,
    ]
  );

  const handleTogglePause = useCallback((source = 'user') => {
    if (isPausedRef.current) resumeTimer(source);
    else pauseTimer(source);
  }, [pauseTimer, resumeTimer]);

  // ========= WakeLock re-request + UI refresh =========
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

  // ========= estado remoto =========
  const makeRemoteStateKey = useCallback((data) => {
    const rs1 = toMillisSafe(data?.runStartedAt) || 0;
    const rs2 = Number(data?.runStartedAtMs ?? 0) || 0;
    const focusBase = Number(data?.focusBaseMs ?? 0);
    const restBase = Number(data?.restBaseMs ?? 0);
    const pomoBase = Number(data?.pomoBaseMs ?? 0);
    const actionSeq = Number(data?.actionSeq ?? 0);

    return [
      data?.status ?? '',
      data?.isPaused ? '1' : '0',
      data?.phase ?? '',
      data?.mode ?? '',
      data?.variant ?? '',
      data?.isResting ? '1' : '0',
      focusBase,
      restBase,
      pomoBase,
      rs1,
      rs2,
      actionSeq,
      data?.action ?? ''
    ].join('|');
  }, []);

  const getRemoteRunStartedMs = useCallback((data) => {
    const numericMs = Number(data?.runStartedAtMs);
    if (Number.isFinite(numericMs) && numericMs > 0) {
      const age = Math.abs(nowMs() - numericMs);
      if (age < 300000) return numericMs;
    }

    const timestampMs = toMillisSafe(data?.runStartedAt);
    if (Number.isFinite(timestampMs)) return timestampMs;

    const actionMs = toMillisSafe(data?.actionAt);
    if (Number.isFinite(actionMs)) return actionMs;

    return null;
  }, [nowMs]);

  const applyRemoteState = useCallback((data) => {
    if (!data) return;

    const key = makeRemoteStateKey(data);
    if (lastAppliedStateKeyRef.current === key) return;

    const isOwn = data.updatedBy === tabIdRef.current;
    const status = data.status;
    const remotePhase = data.phase || (data.isResting ? 'rest' : 'focus');

    hasEverSeenRemoteDocRef.current = true;

    // ✅ FIX: Aplica o modo remoto ANTES de qualquer outra lógica.
    // Isso garante que o PC use "pomodoro" quando o tablet iniciou nesse modo.
    if (data.mode && data.mode !== remoteModeRef.current) {
      console.log(`[RemoteSync] Aplicando modo remoto: ${data.mode} (local era: ${remoteModeRef.current || 'local settings'})`);
      remoteModeRef.current = data.mode;
      setRemoteMode(data.mode);
    }

    // ✅ FIX: Sincroniza countdownSeconds do servidor
    if (data.mode === 'countdown' && Number.isFinite(Number(data.countdownSeconds))) {
      const remoteCD = Number(data.countdownSeconds);
      if (remoteCD !== remoteCountdownSecondsRef.current) {
        remoteCountdownSecondsRef.current = remoteCD;
        setRemoteCountdownSeconds(remoteCD);
      }
    }

    // ✅ Marca ACK quando o servidor já tem o start
    try {
      const rs = Number(data?.runStartedAtMs);
      if (
        Number.isFinite(rs) &&
        rs > 0 &&
        data.status === 'running' &&
        !data.isPaused &&
        remoteStartMsAckedRef.current != null &&
        rs === remoteStartMsAckedRef.current
      ) {
        remoteAckRef.current = true;
      }
    } catch {}

    if (!joinedExistingRef.current) {
      if (status === 'running' || status === 'paused' || status === 'pomodoro_finished' || status === 'rest_finished') {
        joinedExistingRef.current = true;
        hasSessionStartedRef.current = true;
        setIsPreparing(false);
        setCountdown(0);
      }
    }

    if (variant !== 'simulado') {
      const rResting = !!data.isResting || remotePhase === 'rest';
      const rPomoFinished = remotePhase === 'pomodoro_finished';
      const rRestFinished = remotePhase === 'rest_finished';

      if (rResting !== isRestingRef.current) { setIsResting(rResting); isRestingRef.current = rResting; }
      if (rPomoFinished !== isPomodoroFinishedRef.current) { setIsPomodoroFinished(rPomoFinished); isPomodoroFinishedRef.current = rPomoFinished; }
      if (rRestFinished !== isRestFinishedRef.current) { setIsRestFinished(rRestFinished); isRestFinishedRef.current = rRestFinished; }
    }

    let focusBase = Math.max(0, Number(data.focusBaseMs ?? 0));
    let restBase = Math.max(0, Number(data.restBaseMs ?? 0));
    let pomoBase = Math.max(0, Number(data.pomoBaseMs ?? 0));

    if (!isValidElapsedMs(focusBase)) focusBase = 0;
    if (!isValidElapsedMs(restBase)) restBase = 0;
    if (!isValidElapsedMs(pomoBase)) pomoBase = 0;

    const shouldRun = (status === 'running') && !data.isPaused;

    let remoteStartMs = shouldRun ? getRemoteRunStartedMs(data) : null;

    if (shouldRun && remoteStartMs != null) {
      const compensation = bestRttRef.current !== Number.POSITIVE_INFINITY ? Math.floor(bestRttRef.current / 2) : 0;
      remoteStartMs -= compensation;

      console.log(`[RemoteSync] Start: ${remoteStartMs}, Compensation: ${compensation}ms`);
    }

    if (shouldRun && bestRttRef.current === Number.POSITIVE_INFINITY) {
      performTimeSync();
    }

    if (isOwn) {
      if (shouldRun && remoteStartMs != null) {
        if (remotePhase === 'rest') {
          restStartMsRef.current = remoteStartMs;
          focusStartMsRef.current = null;
        } else {
          focusStartMsRef.current = remoteStartMs;
          restStartMsRef.current = null;
        }
      }
      lastAppliedStateKeyRef.current = key;
      return;
    }

    clearTick();

    focusAccumulatedMsRef.current = focusBase;
    restElapsedBaseMsRef.current = restBase;
    focusBlockElapsedBaseMsRef.current = pomoBase;

    focusStartMsRef.current = null;
    restStartMsRef.current = null;

    if (shouldRun && remoteStartMs != null) {
      if (isPausedRef.current) { setIsPaused(false); }
      isPausedRef.current = false;
      desiredRunningRef.current = true;

      if (remotePhase === 'rest') restStartMsRef.current = remoteStartMs;
      else focusStartMsRef.current = remoteStartMs;

      wakeLockWantedRef.current = true;
      requestWakeLock();

      if (audioRef.current) audioRef.current.play().catch(() => {});
      startTickLoop();
    } else {
      if (!isPausedRef.current) { setIsPaused(true); }
      isPausedRef.current = true;
      desiredRunningRef.current = false;

      wakeLockWantedRef.current = false;
      releaseWakeLock();

      try { audioRef.current?.pause?.(); } catch {}
    }

    const display = getDisplaySecondsFromCurrentState();
    setSecondsIfChanged(display);

    const focusElapsedSec = Math.floor(getCurrentFocusElapsedMs() / 1000);
    setTotalFocusIfChanged(focusElapsedSec);

    if (!isPausedRef.current) {
      updateExternalStatus(true, display);
      updateMediaSession(true, display);
    } else {
      updateExternalStatus(false, display);
      updateMediaSession(false, display);
    }

    saveToStorage({
      isPaused: !shouldRun,
      isResting: !!isRestingRef.current,
      restFinished: !!isRestFinishedRef.current,
      pomodoroBlockFinished: !!isPomodoroFinishedRef.current,
      focusAccumulatedMs: getCurrentFocusElapsedMs(),
      focusBlockElapsedBaseMs: getCurrentPomodoroBlockElapsedMs(),
      restElapsedBaseMs: getCurrentRestElapsedMs(),
      lastTimestamp: Date.now(),
    });

    lastAppliedStateKeyRef.current = key;
  }, [
    makeRemoteStateKey,
    variant,
    clearTick,
    startTickLoop,
    requestWakeLock,
    releaseWakeLock,
    getDisplaySecondsFromCurrentState,
    setSecondsIfChanged,
    getCurrentFocusElapsedMs,
    getCurrentPomodoroBlockElapsedMs,
    getCurrentRestElapsedMs,
    setTotalFocusIfChanged,
    saveToStorage,
    updateExternalStatus,
    updateMediaSession,
    getRemoteRunStartedMs,
    nowMs,
    performTimeSync
  ]);

  // ========= BC listener (mesmo device) =========
  useEffect(() => {
    if (!bcRef.current) return;

    const handleBC = (event) => {
      const msg = event.data;
      if (!msg) return;
      if (msg.from === tabIdRef.current) return;

      if (msg.type === 'PAUSE_COMMAND') pauseTimer('bc');
      if (msg.type === 'RESUME_COMMAND') resumeTimer('bc');
      if (msg.type === 'TIMER_ACTION' && msg.action === 'CLOSE_OVERLAYS') closeAllOverlaysLocal();
      if (msg.type === 'TIMER_ACTION' && msg.action === 'CANCEL') cleanupAndCancel('bc', { skipFirestoreDelete: true });
      if (msg.type === 'TIMER_ACTION' && msg.action === 'STOP') handleStopInternal('bc', 'remote');
    };

    bcRef.current.addEventListener('message', handleBC);
    return () => {
      try { bcRef.current?.removeEventListener('message', handleBC); } catch {}
    };
  }, [pauseTimer, resumeTimer, cleanupAndCancel, handleStopInternal, closeAllOverlaysLocal]);

  // ========= Eventos vindos do TimerFinishModal =========
  useEffect(() => {
    const matches = (detail) => {
      if (!detail) return false;
      const uid = detail.uid || detail.userUid;
      if (uid && uid !== userUid) return false;
      return true;
    };

    const onResume = (ev) => {
      if (!matches(ev?.detail)) return;
      resumeTimer('external');
    };

    const onFinalize = (ev) => {
      if (!matches(ev?.detail)) return;
      void cleanupAndCancel('finish_confirm');
    };

    const onDiscard = (ev) => {
      if (!matches(ev?.detail)) return;
      void cleanupAndCancel('finish_discard');
    };

    window.addEventListener('StudyTimer:FinishResume', onResume);
    window.addEventListener('StudyTimer:FinishFinalize', onFinalize);
    window.addEventListener('StudyTimer:FinishDiscard', onDiscard);

    return () => {
      window.removeEventListener('StudyTimer:FinishResume', onResume);
      window.removeEventListener('StudyTimer:FinishFinalize', onFinalize);
      window.removeEventListener('StudyTimer:FinishDiscard', onDiscard);
    };
  }, [userUid, resumeTimer, cleanupAndCancel]);

  // ========= Firestore snapshot =========
  useEffect(() => {
    if (!activeTimerDocRef) return;

    const unsub = onSnapshot(
      activeTimerDocRef,
      { includeMetadataChanges: false },
      (snap) => {
        if (snap.metadata.hasPendingWrites) return;

        if (!snap.exists()) {
          const age = Date.now() - mountTimeRef.current;
          if (!hasEverSeenRemoteDocRef.current && age < 5000) return;

          cleanupAndCancel('remote_missing', { skipFirestoreDelete: true });
          return;
        }

        const data = snap.data();
        hasEverSeenRemoteDocRef.current = true;
        applyRemoteState(data);
      },
      () => {}
    );

    return () => unsub();
  }, [activeTimerDocRef, applyRemoteState, cleanupAndCancel]);

  // ========= ao montar: tenta entrar em timer existente =========
  useEffect(() => {
    if (!activeTimerDocRef) return;

    let cancelled = false;

    (async () => {
      try {
        const snap = await getDocFromServer(activeTimerDocRef);
        if (cancelled) return;

        if (snap.exists()) {
          const data = snap.data();
          if (data?.status && data.status !== 'stopped') {
            joinedExistingRef.current = true;
            setIsPreparing(false);
            setCountdown(0);

            hasSessionStartedRef.current = true;

            applyRemoteState(data);
            void performTimeSync();
          }
        }
      } catch {}
    })();

    return () => { cancelled = true; };
  }, [activeTimerDocRef, applyRemoteState, performTimeSync]);

  // ========= countdown init =========
  useEffect(() => {
    if (!isPreparing) return;

    const t = setInterval(() => {
      setCountdown(prev => {
        const next = prev - 1;
        if (next <= 0) {
          setIsPreparing(false);
          return 0;
        }
        return next;
      });
    }, 1000);

    return () => clearInterval(t);
  }, [isPreparing]);

  // ========= 🚀 countdown end + START LOCAL IMEDIATO + ACK RAPIDO =========
  useEffect(() => {
    if (!userUid || !activeTimerDocRef) return;
    if (joinedExistingRef.current) return;
    if (isPreparing) return;
    if (countdown > 0) return;
    if (hasSessionStartedRef.current) return;

    hasSessionStartedRef.current = true;

    const start = nowMs();

    desiredRunningRef.current = true;
    isPausedRef.current = false;
    setIsPaused(false);

    focusStartMsRef.current = start;
    focusAccumulatedMsRef.current = 0;

    if (variant !== 'simulado' && isPomodoro) {
      setTotalFocusIfChanged(0);
    }

    closeAllOverlaysLocal();

    const display = getDisplaySecondsFromCurrentState();
    setSecondsIfChanged(display);

    startTickLoop();
    void requestWakeLock();

    try { if (audioRef.current) audioRef.current.play().catch(() => {}); } catch {}

    updateExternalStatus(true, display);
    updateMediaSession(true, display);

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

    (async () => {
      try {
        await ensureRemoteStartAck(start);
      } catch (e) {
        console.warn('[StudyTimer] falha no ensureRemoteStartAck:', e);
      }

      try {
        await performTimeSync();
      } catch {}
    })();
  }, [
    userUid,
    activeTimerDocRef,
    isPreparing,
    countdown,
    nowMs,
    variant,
    isPomodoro,
    closeAllOverlaysLocal,
    getDisplaySecondsFromCurrentState,
    setSecondsIfChanged,
    setTotalFocusIfChanged,
    saveToStorage,
    updateExternalStatus,
    updateMediaSession,
    startTickLoop,
    requestWakeLock,
    ensureRemoteStartAck,
    performTimeSync,
  ]);

  // ========= init audio =========
  useEffect(() => {
    audioRef.current = new Audio(WHITE_NOISE_URL);
    audioRef.current.loop = true;
    audioRef.current.volume = 0.01;
    try { audioRef.current.setAttribute('playsinline', ''); } catch {}

    alarmRef.current = new Audio();
    alarmRef.current.src = DEFAULT_ALARM_URL;

    return () => {
      clearTick();
      try { audioRef.current?.pause?.(); } catch {}
      try { alarmRef.current?.pause?.(); } catch {}
      releaseWakeLock();
      restoreDocumentTitle();
      clearMediaSession();
      if (document.fullscreenElement) {
        try { document.exitFullscreen(); } catch {}
      }
    };
  }, [clearTick, releaseWakeLock, restoreDocumentTitle, clearMediaSession]);

  // ========= MediaSession action handlers =========
  const handleTogglePauseRef = useRef(null);
  const handleStopRef = useRef(null);
  useEffect(() => { handleTogglePauseRef.current = handleTogglePause; }, [handleTogglePause]);
  useEffect(() => { handleStopRef.current = handleStop; }, [handleStop]);

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
        ['play', 'pause', 'stop', 'seekto', 'seekbackward', 'seekforward'].forEach(a => {
          try { navigator.mediaSession.setActionHandler(a, null); } catch {}
        });
      } catch {}
    };
  }, []);

  // ========= handlers overlay =========
  const handleRepeatCycle = useCallback(async () => {
    try { alarmRef.current?.pause?.(); } catch {}

    closeAllOverlaysLocal();

    setIsPomodoroFinished(false);
    setIsResting(false);
    setIsRestFinished(false);

    isPomodoroFinishedRef.current = false;
    isRestingRef.current = false;
    isRestFinishedRef.current = false;

    setIsPaused(false);
    isPausedRef.current = false;
    desiredRunningRef.current = true;

    focusBlockElapsedBaseMsRef.current = 0;

    await ensureTimeSync();
    const start = nowMs();

    focusStartMsRef.current = start;
    restStartMsRef.current = null;

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
      runStartedAtMs: start,
      phase: 'focus',
      uiOverlay: 'none',
      focusBaseMs: Number(focusAccumulatedMsRef.current || 0),
      pomoBaseMs: Number(focusBlockElapsedBaseMsRef.current || 0),
      restBaseMs: Number(restElapsedBaseMsRef.current || 0),
      actionSeq: increment(1),
      action: 'repeat_cycle',
      actionAt: serverTimestamp(),
    }, { includeSnapshot: true });

    postBC({ type: 'TIMER_ACTION', action: 'CLOSE_OVERLAYS' });
  }, [
    ensureTimeSync,
    nowMs,
    getDisplaySecondsFromCurrentState,
    setSecondsIfChanged,
    startTickLoop,
    saveToStorage,
    updateExternalStatus,
    updateMediaSession,
    patchActiveTimer,
    postBC,
    getCurrentFocusElapsedMs,
    requestWakeLock,
    closeAllOverlaysLocal
  ]);

  const handleStartRest = useCallback(async () => {
    try { alarmRef.current?.pause?.(); } catch {}

    closeAllOverlaysLocal();

    setIsPomodoroFinished(false);
    setIsResting(true);
    setIsRestFinished(false);

    isPomodoroFinishedRef.current = false;
    isRestingRef.current = true;
    isRestFinishedRef.current = false;

    setIsPaused(false);
    isPausedRef.current = false;
    desiredRunningRef.current = true;

    restElapsedBaseMsRef.current = 0;

    await ensureTimeSync();
    const start = nowMs();

    restStartMsRef.current = start;
    focusStartMsRef.current = null;

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
      runStartedAtMs: start,
      phase: 'rest',
      uiOverlay: 'none',
      focusBaseMs: Number(focusAccumulatedMsRef.current || 0),
      pomoBaseMs: Number(focusBlockElapsedBaseMsRef.current || 0),
      restBaseMs: Number(restElapsedBaseMsRef.current || 0),
      actionSeq: increment(1),
      action: 'start_rest',
      actionAt: serverTimestamp(),
    }, { includeSnapshot: true });

    postBC({ type: 'TIMER_ACTION', action: 'CLOSE_OVERLAYS' });
  }, [
    ensureTimeSync,
    nowMs,
    getDisplaySecondsFromCurrentState,
    setSecondsIfChanged,
    startTickLoop,
    saveToStorage,
    updateExternalStatus,
    updateMediaSession,
    patchActiveTimer,
    postBC,
    getCurrentFocusElapsedMs,
    requestWakeLock,
    closeAllOverlaysLocal
  ]);

  const handleBackToStudy = useCallback(async () => {
    try { alarmRef.current?.pause?.(); } catch {}

    closeAllOverlaysLocal();

    setIsRestFinished(false);
    setIsResting(false);
    setIsPomodoroFinished(false);

    isRestFinishedRef.current = false;
    isRestingRef.current = false;
    isPomodoroFinishedRef.current = false;

    setIsPaused(false);
    isPausedRef.current = false;
    desiredRunningRef.current = true;

    await ensureTimeSync();
    const start = nowMs();

    focusStartMsRef.current = start;
    restStartMsRef.current = null;

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
      runStartedAtMs: start,
      phase: 'focus',
      uiOverlay: 'none',
      focusBaseMs: Number(focusAccumulatedMsRef.current || 0),
      pomoBaseMs: Number(focusBlockElapsedBaseMsRef.current || 0),
      restBaseMs: Number(restElapsedBaseMsRef.current || 0),
      actionSeq: increment(1),
      action: 'back_to_study',
      actionAt: serverTimestamp(),
    }, { includeSnapshot: true });

    postBC({ type: 'TIMER_ACTION', action: 'CLOSE_OVERLAYS' });
  }, [
    ensureTimeSync,
    nowMs,
    getDisplaySecondsFromCurrentState,
    startTickLoop,
    saveToStorage,
    updateExternalStatus,
    updateMediaSession,
    patchActiveTimer,
    postBC,
    getCurrentFocusElapsedMs,
    requestWakeLock,
    closeAllOverlaysLocal,
    setSecondsIfChanged,
  ]);

  const finishText = finishButtonLabel || (variant === 'simulado' ? 'Finalizar Simulado' : 'Finalizar Estudo');

  // ========= RENDER =========
  if (isMinimized) {
    return (
      <MiniWidgetTimer
        isPaused={isPaused}
        themeColor={themeColor}
        assunto={assunto}
        variant={variant}
        isResting={isResting}
        disciplina={disciplina}
        seconds={seconds}
        isPreparing={isPreparing}
        countdown={countdown}
        formatClock={formatClock}
        onTogglePause={() => handleTogglePause('user')}
        onMaximize={onWidgetMode}
        raised={raised}
      />
    );
  }

  return (
    <>
      <OverlaysTimer
        variant={variant}
        isPomodoroFinished={isPomodoroFinished}
        isRestFinished={isRestFinished}
        isCancelModalOpen={isCancelModalOpen}
        themeColor={themeColor}
        totalFocusSeconds={totalFocusSeconds}
        settings={settings}
        formatHM={formatHMFromSeconds}
        onStop={handleStop}
        onRepeatCycle={handleRepeatCycle}
        onStartRest={handleStartRest}
        onBackToStudy={handleBackToStudy}
        onCloseCancelModal={() => setIsCancelModalOpen(false)}
        onConfirmCancel={() => cleanupAndCancel('user')}
        onOpenCancelModal={() => setIsCancelModalOpen(true)}
      />

      <InterfacePrincipalTimer
        themeColor={themeColor}
        isDark={isDark}
        isFullscreen={isFullscreen}
        isPreparing={isPreparing}
        countdown={countdown}
        isPaused={isPaused}
        variant={variant}
        effectiveMode={effectiveMode}
        isResting={isResting}
        isPomodoro={isPomodoro}
        disciplina={disciplina}
        assunto={assunto}
        totalFocusSeconds={totalFocusSeconds}
        seconds={seconds}
        finishText={finishText}
        formatClock={formatClock}
        formatHM={formatHMFromSeconds}
        onToggleTheme={toggleTheme}
        onToggleFullscreen={toggleFullscreen}
        onMinimize={onWidgetMinimize}
        onRestComplete={handleRestComplete}
        onOpenCancelModal={() => setIsCancelModalOpen(true)}
        onTogglePause={() => handleTogglePause('user')}
        onStop={handleStop}
      />
    </>
  );
}

export default StudyTimer;
