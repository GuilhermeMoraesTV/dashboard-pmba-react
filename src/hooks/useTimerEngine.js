import { useCallback, useEffect, useRef, useState } from 'react';

export const TIMER_MAX_ELAPSED_MS = 7 * 24 * 60 * 60 * 1000;

export function createTimerTabId() {
  try {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  } catch {
    // Fallback abaixo.
  }
  return `tab_${Math.random().toString(16).slice(2)}_${Date.now()}`;
}

export function parseTimerJson(value) {
  try {
    return JSON.parse(value || '');
  } catch {
    return null;
  }
}

export const DEFAULT_HEARTBEAT_LEASE_TTL_MS = 75000;

export function claimTimerHeartbeatLease({ storage, key, ownerId, now = Date.now(), ttlMs = DEFAULT_HEARTBEAT_LEASE_TTL_MS }) {
  if (!storage || !key || !ownerId) return true;
  try {
    const current = parseTimerJson(storage.getItem(key));
    if (current?.ownerId && current.ownerId !== ownerId && Number(current.expiresAt || 0) > now) return false;
    storage.setItem(key, JSON.stringify({ ownerId, expiresAt: now + ttlMs }));
    const confirmed = parseTimerJson(storage.getItem(key));
    return confirmed?.ownerId === ownerId;
  } catch {
    return true;
  }
}

export function releaseTimerHeartbeatLease({ storage, key, ownerId }) {
  if (!storage || !key || !ownerId) return;
  try {
    const current = parseTimerJson(storage.getItem(key));
    if (current?.ownerId === ownerId) storage.removeItem(key);
  } catch {
    // localStorage pode estar indisponível em modo privado.
  }
}

export function timerTimestampToMillis(timestamp) {
  try {
    return timestamp?.toMillis?.() ?? null;
  } catch {
    return null;
  }
}

export function isValidTimerElapsedMs(value) {
  const elapsed = Number(value);
  return Number.isFinite(elapsed) && elapsed >= 0 && elapsed < TIMER_MAX_ELAPSED_MS;
}

function firstValidTimestampMs(...values) {
  for (const value of values) {
    const numeric = Number(value);
    if (Number.isFinite(numeric) && numeric > 0) return numeric;
    const timestamp = timerTimestampToMillis(value);
    if (Number.isFinite(timestamp) && timestamp > 0) return timestamp;
  }
  return null;
}

export function deriveRestoredTimerState(data, nowMs = Date.now()) {
  const hasLocalActiveSession = !!data?.schemaVersion && !!data?.disciplinaId && !data?.isFinishing;
  const status = String(data?.status || (hasLocalActiveSession ? (data?.isPaused ? 'paused' : 'running') : ''));
  const isActive = ['running', 'paused', 'pomodoro_finished', 'rest_finished'].includes(status);
  if (!isActive) return null;

  const mode = String(data?.mode || 'free');
  const phase = String(
    data?.phase
    || (data?.restFinished ? 'rest_finished' : null)
    || (data?.pomodoroBlockFinished ? 'pomodoro_finished' : null)
    || (data?.isResting ? 'rest' : 'focus')
  );
  const isRunning = status === 'running' && !data?.isPaused;
  const startedAtMs = isRunning
    ? firstValidTimestampMs(data?.runStartedAtMs, data?.runStartedAt, data?.lastTimestamp, data?.actionAt)
    : null;
  const runningMs = startedAtMs == null ? 0 : Math.max(0, Number(nowMs) - startedAtMs);

  const focusBaseMs = Math.max(0, Number(data?.focusBaseMs ?? data?.focusAccumulatedMs) || 0);
  const restBaseMs = Math.max(0, Number(data?.restBaseMs ?? data?.restElapsedBaseMs) || 0);
  const pomoBaseMs = Math.max(0, Number(data?.pomoBaseMs ?? data?.focusBlockElapsedBaseMs) || 0);
  const focusElapsedMs = focusBaseMs + (phase === 'focus' ? runningMs : 0);
  const restElapsedMs = restBaseMs + (phase === 'rest' ? runningMs : 0);
  const pomodoroElapsedMs = pomoBaseMs + (phase === 'focus' ? runningMs : 0);

  let displaySeconds;
  if (phase === 'pomodoro_finished' || phase === 'rest_finished') {
    displaySeconds = 0;
  } else if (mode === 'countdown') {
    const durationMs = Math.max(0, Number(data?.countdownSeconds) || 0) * 1000;
    displaySeconds = Math.floor(Math.max(0, durationMs - focusElapsedMs) / 1000);
  } else if (phase === 'rest') {
    const durationMs = Math.max(0, Number(data?.restSeconds ?? data?.restDuration) || 0) * 1000;
    displaySeconds = Math.floor(Math.max(0, durationMs - restElapsedMs) / 1000);
  } else if (mode === 'pomodoro') {
    const durationMs = Math.max(0, Number(data?.pomodoroSeconds ?? data?.pomodoroDuration) || 0) * 1000;
    displaySeconds = Math.floor(Math.max(0, durationMs - pomodoroElapsedMs) / 1000);
  } else {
    displaySeconds = Math.floor(focusElapsedMs / 1000);
  }

  return {
    displaySeconds,
    focusElapsedMs,
    restElapsedMs,
    pomodoroElapsedMs,
    runStartedAtMs: startedAtMs,
    isRunning,
    isPaused: !isRunning,
    isResting: phase === 'rest',
    isPomodoroFinished: phase === 'pomodoro_finished',
    isRestFinished: phase === 'rest_finished',
    mode,
    countdownSeconds: mode === 'countdown' ? Math.max(0, Number(data?.countdownSeconds) || 0) : null,
  };
}

export function formatTimerClock(totalSeconds) {
  const safe = Math.max(0, Number(totalSeconds) || 0);
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const seconds = safe % 60;
  return [hours, minutes, seconds].map((part) => String(part).padStart(2, '0')).join(':');
}

export function reduceTimerState(state, event) {
  const current = {
    status: 'idle',
    elapsedSeconds: 0,
    ...state,
  };
  switch (event?.type) {
    case 'START':
      return { ...current, status: 'running' };
    case 'TICK':
      return current.status === 'running'
        ? { ...current, elapsedSeconds: current.elapsedSeconds + Math.max(0, Number(event.seconds) || 1) }
        : current;
    case 'PAUSE':
      return current.status === 'running' ? { ...current, status: 'paused' } : current;
    case 'RESUME':
      return current.status === 'paused' ? { ...current, status: 'running' } : current;
    case 'FINISH':
      return { ...current, status: 'finished' };
    case 'CANCEL':
      return { ...current, status: 'cancelled', elapsedSeconds: 0 };
    case 'REMOTE_SYNC':
      return {
        ...current,
        ...event.state,
        elapsedSeconds: Math.max(0, Number(event.state?.elapsedSeconds) || 0),
      };
    default:
      return current;
  }
}

export function useFullscreenState(target = () => document.documentElement) {
  const [isFullscreen, setIsFullscreen] = useState(
    () => typeof document !== 'undefined' && !!document.fullscreenElement
  );

  useEffect(() => {
    if (typeof document === 'undefined') return undefined;
    const sync = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', sync);
    return () => document.removeEventListener('fullscreenchange', sync);
  }, []);

  const toggleFullscreen = useCallback(async () => {
    if (typeof document === 'undefined') return false;
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
        return false;
      }
      const element = typeof target === 'function' ? target() : target;
      await element?.requestFullscreen?.();
      return true;
    } catch {
      return !!document.fullscreenElement;
    }
  }, [target]);

  return { isFullscreen, toggleFullscreen };
}

export function useWakeLock() {
  const wakeLockRef = useRef(null);
  const wakeLockWantedRef = useRef(false);

  const requestWakeLock = useCallback(async () => {
    try {
      if (typeof navigator === 'undefined' || !('wakeLock' in navigator)) return;
      if (!wakeLockWantedRef.current || wakeLockRef.current) return;
      const lock = await navigator.wakeLock.request('screen');
      wakeLockRef.current = lock;
      lock.addEventListener('release', () => {
        wakeLockRef.current = null;
      });
    } catch {
      // Wake Lock é progressivo e pode ser negado pelo navegador.
    }
  }, []);

  const releaseWakeLock = useCallback(async () => {
    wakeLockWantedRef.current = false;
    try {
      await wakeLockRef.current?.release?.();
    } catch {
      // Nada a fazer: o lock pode já ter sido liberado pelo sistema.
    }
    wakeLockRef.current = null;
  }, []);

  useEffect(() => () => {
    wakeLockWantedRef.current = false;
    wakeLockRef.current?.release?.().catch?.(() => {});
    wakeLockRef.current = null;
  }, []);

  return {
    wakeLockRef,
    wakeLockWantedRef,
    requestWakeLock,
    releaseWakeLock,
  };
}

export function useTimerBroadcastChannel(channelName, onMessage) {
  const channelRef = useRef(null);
  const handlerRef = useRef(onMessage);
  handlerRef.current = onMessage;

  useEffect(() => {
    if (!channelName || typeof BroadcastChannel === 'undefined') return undefined;
    try {
      const channel = new BroadcastChannel(channelName);
      channelRef.current = channel;
      channel.onmessage = (event) => handlerRef.current?.(event);
      return () => {
        channel.close();
        if (channelRef.current === channel) channelRef.current = null;
      };
    } catch {
      channelRef.current = null;
      return undefined;
    }
  }, [channelName]);

  const postMessage = useCallback((payload) => {
    try {
      channelRef.current?.postMessage(payload);
    } catch {
      // Sincronização entre abas é best effort.
    }
  }, []);

  return { channelRef, postMessage };
}
