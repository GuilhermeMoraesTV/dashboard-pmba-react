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
