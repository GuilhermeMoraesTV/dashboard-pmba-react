import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  Play, Pause, Square, Minimize2, X,
  Maximize, Sun, Moon, ClipboardList, CheckCircle2, Zap
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
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
import { db } from '../../firebaseConfig';
import {
  createTimerTabId,
  formatTimerClock,
  isValidTimerElapsedMs,
  timerTimestampToMillis,
  useFullscreenState,
  useWakeLock,
} from '../../hooks/useTimerEngine';

// ============================================
// CONFIGURAÇÕES DE TAMANHOS
// ============================================
const SIZES = {
  LOGO_SYSTEM_NORMAL: { LOGO_HEIGHT: '4.5rem', LOGO_TOP: '1rem', LOGO_LEFT: '1rem', LOGO_OPACITY: 1, SYSTEM_NAME: 'MODOQAP', NAME_FONT_SIZE: '1.2rem', NAME_FONT_WEIGHT: '900', NAME_COLOR: '#dc2626', NAME_TRACKING: '0.15em', NAME_OPACITY: 1, NAME_MARGIN_LEFT: '0.75rem', NAME_UPPERCASE: true },
  LOGO_SYSTEM_NORMAL_FULLSCREEN: { LOGO_HEIGHT: '5rem', LOGO_TOP: '0.75rem', LOGO_LEFT: '0.75rem', LOGO_OPACITY: 1, SYSTEM_NAME: 'MODOQAP', NAME_FONT_SIZE: '1.2rem', NAME_FONT_WEIGHT: '900', NAME_COLOR: '#dc2626', NAME_TRACKING: '0.15em', NAME_OPACITY: 1, NAME_MARGIN_LEFT: '0.65rem', NAME_UPPERCASE: true },
  LOGO_SYSTEM_COMPACT: { LOGO_HEIGHT: '3rem', LOGO_TOP: '0.5rem', LOGO_LEFT: '0.5rem', LOGO_OPACITY: 1, SYSTEM_NAME: 'MODOQAP', NAME_FONT_SIZE: '1rem', NAME_FONT_WEIGHT: '900', NAME_COLOR: '#dc2626', NAME_TRACKING: '0.1em', NAME_OPACITY: 1, NAME_MARGIN_LEFT: '0.5rem', NAME_UPPERCASE: true },
  LOGO_SYSTEM_COMPACT_FULLSCREEN: { LOGO_HEIGHT: '3rem', LOGO_TOP: '0.4rem', LOGO_LEFT: '0.4rem', LOGO_OPACITY: 1, SYSTEM_NAME: 'MODOQAP', NAME_FONT_SIZE: '1rem', NAME_FONT_WEIGHT: '900', NAME_COLOR: '#dc2626', NAME_TRACKING: '0.1em', NAME_OPACITY: 1, NAME_MARGIN_LEFT: '0.4rem', NAME_UPPERCASE: true },
  LOGO_SYSTEM_PORTRAIT_TABLET: { LOGO_HEIGHT: '4rem', LOGO_TOP: '0.75rem', LOGO_LEFT: '0.75rem', LOGO_OPACITY: 1, SYSTEM_NAME: 'MODOQAP', NAME_FONT_SIZE: '1rem', NAME_FONT_WEIGHT: '900', NAME_COLOR: '#dc2626', NAME_TRACKING: '0.125em', NAME_OPACITY: 1, NAME_MARGIN_LEFT: '0.625rem', NAME_UPPERCASE: true },
  LOGO_SYSTEM_PORTRAIT_TABLET_FULLSCREEN: { LOGO_HEIGHT: '4rem', LOGO_TOP: '0.625rem', LOGO_LEFT: '0.625rem', LOGO_OPACITY: 1, SYSTEM_NAME: 'MODOQAP', NAME_FONT_SIZE: '1rem', NAME_FONT_WEIGHT: '900', NAME_COLOR: '#dc2626', NAME_TRACKING: '0.125em', NAME_OPACITY: 1, NAME_MARGIN_LEFT: '0.55rem', NAME_UPPERCASE: true },
  LOGO_SYSTEM_PORTRAIT_MOBILE: { LOGO_HEIGHT: '3rem', LOGO_TOP: '0.625rem', LOGO_LEFT: '0.625rem', LOGO_OPACITY: 0.8, SYSTEM_NAME: 'MODOQAP', NAME_FONT_SIZE: '1rem', NAME_FONT_WEIGHT: '900', NAME_COLOR: '#dc2626', NAME_TRACKING: '0.1em', NAME_OPACITY: 0.8, NAME_MARGIN_LEFT: '0.5rem', NAME_UPPERCASE: true },
  LOGO_SYSTEM_PORTRAIT_MOBILE_FULLSCREEN: { LOGO_HEIGHT: '3rem', LOGO_TOP: '0.5rem', LOGO_LEFT: '0.5rem', LOGO_OPACITY: 0.75, SYSTEM_NAME: 'MODOQAP', NAME_FONT_SIZE: '1rem', NAME_FONT_WEIGHT: '900', NAME_COLOR: '#dc2626', NAME_TRACKING: '0.1em', NAME_OPACITY: 0.75, NAME_MARGIN_LEFT: '0.45rem', NAME_UPPERCASE: true },
  BADGE_NORMAL: { PADDING_X: '1.25rem', PADDING_Y: '0.5rem', FONT_SIZE: '0.75rem', DOT_SIZE: '0.5rem', GAP: '0.75rem', MARGIN_BOTTOM: '1.5rem' },
  BADGE_NORMAL_FULLSCREEN: { PADDING_X: '1rem', PADDING_Y: '0.4rem', FONT_SIZE: '0.7rem', DOT_SIZE: '0.45rem', GAP: '0.6rem', MARGIN_BOTTOM: '1.2rem' },
  BADGE_COMPACT: { PADDING_X: '1rem', PADDING_Y: '0.375rem', FONT_SIZE: '0.625rem', DOT_SIZE: '0.375rem', GAP: '0.5rem', MARGIN_BOTTOM: '0.5rem' },
  BADGE_COMPACT_FULLSCREEN: { PADDING_X: '0.875rem', PADDING_Y: '0.3rem', FONT_SIZE: '0.575rem', DOT_SIZE: '0.35rem', GAP: '0.4rem', MARGIN_BOTTOM: '0.4rem' },
  BADGE_PORTRAIT_TABLET: { PADDING_X: '1rem', PADDING_Y: '0.4rem', FONT_SIZE: '0.7rem', DOT_SIZE: '0.4rem', GAP: '0.6rem', MARGIN_BOTTOM: '1rem' },
  BADGE_PORTRAIT_TABLET_FULLSCREEN: { PADDING_X: '0.875rem', PADDING_Y: '0.35rem', FONT_SIZE: '0.65rem', DOT_SIZE: '0.375rem', GAP: '0.5rem', MARGIN_BOTTOM: '0.85rem' },
  BADGE_PORTRAIT_MOBILE: { PADDING_X: '0.875rem', PADDING_Y: '0.35rem', FONT_SIZE: '0.625rem', DOT_SIZE: '0.35rem', GAP: '0.5rem', MARGIN_BOTTOM: '0.75rem' },
  BADGE_PORTRAIT_MOBILE_FULLSCREEN: { PADDING_X: '0.75rem', PADDING_Y: '0.3rem', FONT_SIZE: '0.575rem', DOT_SIZE: '0.325rem', GAP: '0.4rem', MARGIN_BOTTOM: '0.6rem' },
  TITLE_NORMAL: { FONT_SIZE: '2rem', MARGIN_BOTTOM: '0.5rem' },
  TITLE_NORMAL_FULLSCREEN: { FONT_SIZE: '1.75rem', MARGIN_BOTTOM: '0.4rem' },
  TITLE_COMPACT: { FONT_SIZE: '2rem', MARGIN_BOTTOM: '0.25rem' },
  TITLE_COMPACT_FULLSCREEN: { FONT_SIZE: '1.75rem', MARGIN_BOTTOM: '0.2rem' },
  TITLE_PORTRAIT_TABLET: { FONT_SIZE: '2rem', MARGIN_BOTTOM: '0.4rem' },
  TITLE_PORTRAIT_TABLET_FULLSCREEN: { FONT_SIZE: '2rem', MARGIN_BOTTOM: '0.35rem' },
  TITLE_PORTRAIT_MOBILE: { FONT_SIZE: '1.25rem', MARGIN_BOTTOM: '0.3rem' },
  TITLE_PORTRAIT_MOBILE_FULLSCREEN: { FONT_SIZE: '1.15rem', MARGIN_BOTTOM: '0.25rem' },
  SUBTITLE_NORMAL: { FONT_SIZE: '1rem', MARGIN_BOTTOM: '0.75rem' },
  SUBTITLE_NORMAL_FULLSCREEN: { FONT_SIZE: '0.9rem', MARGIN_BOTTOM: '0.6rem' },
  SUBTITLE_COMPACT: { FONT_SIZE: '1rem', MARGIN_BOTTOM: '0.25rem' },
  SUBTITLE_COMPACT_FULLSCREEN: { FONT_SIZE: '1rem', MARGIN_BOTTOM: '0.2rem' },
  SUBTITLE_PORTRAIT_TABLET: { FONT_SIZE: '1rem', MARGIN_BOTTOM: '0.5rem' },
  SUBTITLE_PORTRAIT_TABLET_FULLSCREEN: { FONT_SIZE: '1rem', MARGIN_BOTTOM: '0.4rem' },
  SUBTITLE_PORTRAIT_MOBILE: { FONT_SIZE: '0.75rem', MARGIN_BOTTOM: '0.4rem' },
  SUBTITLE_PORTRAIT_MOBILE_FULLSCREEN: { FONT_SIZE: '0.7rem', MARGIN_BOTTOM: '0.3rem' },
  CLOCK_NORMAL: { FONT_SIZE: '17rem', MARGIN_BOTTOM: '3rem' },
  CLOCK_NORMAL_FULLSCREEN: { FONT_SIZE: '18rem', MARGIN_BOTTOM: '2.5rem' },
  CLOCK_COMPACT: { FONT_SIZE: '7rem', MARGIN_BOTTOM: '0.75rem' },
  CLOCK_COMPACT_FULLSCREEN: { FONT_SIZE: '8rem', MARGIN_BOTTOM: '0.6rem' },
  CLOCK_PORTRAIT_TABLET: { FONT_SIZE: '12rem', MARGIN_BOTTOM: '2rem' },
  CLOCK_PORTRAIT_TABLET_FULLSCREEN: { FONT_SIZE: '12rem', MARGIN_BOTTOM: '1.75rem' },
  CLOCK_PORTRAIT_MOBILE: { FONT_SIZE: '5rem', MARGIN_BOTTOM: '1.5rem' },
  CLOCK_PORTRAIT_MOBILE_FULLSCREEN: { FONT_SIZE: '5rem', MARGIN_BOTTOM: '1.25rem' },
  CLOCK_SHADOW_NORMAL: { INSET: '-2.5rem', BLUR: '60px', OPACITY: 0.2 },
  CLOCK_SHADOW_NORMAL_FULLSCREEN: { INSET: '-3rem', BLUR: '70px', OPACITY: 0.25 },
  CLOCK_SHADOW_COMPACT: { INSET: '-1.5rem', BLUR: '40px', OPACITY: 0.15 },
  CLOCK_SHADOW_COMPACT_FULLSCREEN: { INSET: '-1.75rem', BLUR: '45px', OPACITY: 0.18 },
  CLOCK_SHADOW_PORTRAIT_TABLET: { INSET: '-2rem', BLUR: '50px', OPACITY: 0.18 },
  CLOCK_SHADOW_PORTRAIT_TABLET_FULLSCREEN: { INSET: '-2.5rem', BLUR: '60px', OPACITY: 0.22 },
  CLOCK_SHADOW_PORTRAIT_MOBILE: { INSET: '-1.5rem', BLUR: '40px', OPACITY: 0.15 },
  CLOCK_SHADOW_PORTRAIT_MOBILE_FULLSCREEN: { INSET: '-2rem', BLUR: '50px', OPACITY: 0.18 },
  SIDE_BUTTON_NORMAL: { WIDTH: '3.5rem', HEIGHT: '3.5rem', ICON_SIZE: 24, LABEL_SIZE: '0.625rem', GAP: '0.5rem' },
  SIDE_BUTTON_NORMAL_FULLSCREEN: { WIDTH: '4rem', HEIGHT: '4rem', ICON_SIZE: 26, LABEL_SIZE: '0.7rem', GAP: '0.6rem' },
  SIDE_BUTTON_COMPACT: { WIDTH: '2.5rem', HEIGHT: '2.5rem', ICON_SIZE: 20, LABEL_SIZE: '0.625rem', GAP: '0.125rem' },
  SIDE_BUTTON_COMPACT_FULLSCREEN: { WIDTH: '2.75rem', HEIGHT: '2.75rem', ICON_SIZE: 22, LABEL_SIZE: '0.65rem', GAP: '0.15rem' },
  SIDE_BUTTON_PORTRAIT_TABLET: { WIDTH: '4rem', HEIGHT: '4rem', ICON_SIZE: 20, LABEL_SIZE: '0.6rem', GAP: '0.4rem' },
  SIDE_BUTTON_PORTRAIT_TABLET_FULLSCREEN: { WIDTH: '4.5rem', HEIGHT: '4.5rem', ICON_SIZE: 22, LABEL_SIZE: '0.65rem', GAP: '0.5rem' },
  SIDE_BUTTON_PORTRAIT_MOBILE: { WIDTH: '3rem', HEIGHT: '3rem', ICON_SIZE: 20, LABEL_SIZE: '0.55rem', GAP: '0.3rem' },
  SIDE_BUTTON_PORTRAIT_MOBILE_FULLSCREEN: { WIDTH: '3rem', HEIGHT: '3rem', ICON_SIZE: 22, LABEL_SIZE: '0.6rem', GAP: '0.35rem' },
  CENTER_BUTTON_NORMAL: { WIDTH: '6rem', HEIGHT: '6rem', ICON_SIZE: 36, LABEL_SIZE: '0.75rem', LABEL_MARGIN_TOP: '0.5rem' },
  CENTER_BUTTON_NORMAL_FULLSCREEN: { WIDTH: '7rem', HEIGHT: '7rem', ICON_SIZE: 40, LABEL_SIZE: '0.85rem', LABEL_MARGIN_TOP: '0.6rem' },
  CENTER_BUTTON_COMPACT: { WIDTH: '4rem', HEIGHT: '4rem', ICON_SIZE: 28, LABEL_SIZE: '0.625rem', LABEL_MARGIN_TOP: '0.25rem' },
  CENTER_BUTTON_COMPACT_FULLSCREEN: { WIDTH: '4.5rem', HEIGHT: '4.5rem', ICON_SIZE: 30, LABEL_SIZE: '0.65rem', LABEL_MARGIN_TOP: '0.3rem' },
  CENTER_BUTTON_PORTRAIT_TABLET: { WIDTH: '5rem', HEIGHT: '5rem', ICON_SIZE: 32, LABEL_SIZE: '0.7rem', LABEL_MARGIN_TOP: '0.4rem' },
  CENTER_BUTTON_PORTRAIT_TABLET_FULLSCREEN: { WIDTH: '5.5rem', HEIGHT: '5.5rem', ICON_SIZE: 34, LABEL_SIZE: '0.75rem', LABEL_MARGIN_TOP: '0.45rem' },
  CENTER_BUTTON_PORTRAIT_MOBILE: { WIDTH: '4rem', HEIGHT: '4rem', ICON_SIZE: 28, LABEL_SIZE: '0.625rem', LABEL_MARGIN_TOP: '0.3rem' },
  CENTER_BUTTON_PORTRAIT_MOBILE_FULLSCREEN: { WIDTH: '4.5rem', HEIGHT: '4.5rem', ICON_SIZE: 30, LABEL_SIZE: '0.65rem', LABEL_MARGIN_TOP: '0.35rem' },
  BUTTONS_GAP_NORMAL: '1.5rem', BUTTONS_GAP_NORMAL_FULLSCREEN: '2rem', BUTTONS_GAP_COMPACT: '1rem', BUTTONS_GAP_COMPACT_FULLSCREEN: '1.25rem', BUTTONS_GAP_PORTRAIT_TABLET: '1.25rem', BUTTONS_GAP_PORTRAIT_TABLET_FULLSCREEN: '1.5rem', BUTTONS_GAP_PORTRAIT_MOBILE: '1rem', BUTTONS_GAP_PORTRAIT_MOBILE_FULLSCREEN: '1.25rem',
  CONTAINER_NORMAL: { MARGIN_TOP: '5rem', PADDING_TOP: '0' }, CONTAINER_NORMAL_FULLSCREEN: { MARGIN_TOP: '3rem', PADDING_TOP: '0' }, CONTAINER_COMPACT: { MARGIN_TOP: '0', PADDING_TOP: '0.5rem' }, CONTAINER_COMPACT_FULLSCREEN: { MARGIN_TOP: '0', PADDING_TOP: '0.3rem' }, CONTAINER_PORTRAIT_TABLET: { MARGIN_TOP: '4rem', PADDING_TOP: '0' }, CONTAINER_PORTRAIT_TABLET_FULLSCREEN: { MARGIN_TOP: '3rem', PADDING_TOP: '0' }, CONTAINER_PORTRAIT_MOBILE: { MARGIN_TOP: '3rem', PADDING_TOP: '0' }, CONTAINER_PORTRAIT_MOBILE_FULLSCREEN: { MARGIN_TOP: '2rem', PADDING_TOP: '0' },
};

const MODE_MAP = {
  'normal': { logoSystem: SIZES.LOGO_SYSTEM_NORMAL, badge: SIZES.BADGE_NORMAL, title: SIZES.TITLE_NORMAL, subtitle: SIZES.SUBTITLE_NORMAL, clock: SIZES.CLOCK_NORMAL, clockShadow: SIZES.CLOCK_SHADOW_NORMAL, sideButton: SIZES.SIDE_BUTTON_NORMAL, centerButton: SIZES.CENTER_BUTTON_NORMAL, buttonsGap: SIZES.BUTTONS_GAP_NORMAL, container: SIZES.CONTAINER_NORMAL },
  'normal_fullscreen': { logoSystem: SIZES.LOGO_SYSTEM_NORMAL_FULLSCREEN, badge: SIZES.BADGE_NORMAL_FULLSCREEN, title: SIZES.TITLE_NORMAL_FULLSCREEN, subtitle: SIZES.SUBTITLE_NORMAL_FULLSCREEN, clock: SIZES.CLOCK_NORMAL_FULLSCREEN, clockShadow: SIZES.CLOCK_SHADOW_NORMAL_FULLSCREEN, sideButton: SIZES.SIDE_BUTTON_NORMAL_FULLSCREEN, centerButton: SIZES.CENTER_BUTTON_NORMAL_FULLSCREEN, buttonsGap: SIZES.BUTTONS_GAP_NORMAL_FULLSCREEN, container: SIZES.CONTAINER_NORMAL_FULLSCREEN },
  'compact': { logoSystem: SIZES.LOGO_SYSTEM_COMPACT, badge: SIZES.BADGE_COMPACT, title: SIZES.TITLE_COMPACT, subtitle: SIZES.SUBTITLE_COMPACT, clock: SIZES.CLOCK_COMPACT, clockShadow: SIZES.CLOCK_SHADOW_COMPACT, sideButton: SIZES.SIDE_BUTTON_COMPACT, centerButton: SIZES.CENTER_BUTTON_COMPACT, buttonsGap: SIZES.BUTTONS_GAP_COMPACT, container: SIZES.CONTAINER_COMPACT },
  'compact_fullscreen': { logoSystem: SIZES.LOGO_SYSTEM_COMPACT_FULLSCREEN, badge: SIZES.BADGE_COMPACT_FULLSCREEN, title: SIZES.TITLE_COMPACT_FULLSCREEN, subtitle: SIZES.SUBTITLE_COMPACT_FULLSCREEN, clock: SIZES.CLOCK_COMPACT_FULLSCREEN, clockShadow: SIZES.CLOCK_SHADOW_COMPACT_FULLSCREEN, sideButton: SIZES.SIDE_BUTTON_COMPACT_FULLSCREEN, centerButton: SIZES.CENTER_BUTTON_COMPACT_FULLSCREEN, buttonsGap: SIZES.BUTTONS_GAP_COMPACT_FULLSCREEN, container: SIZES.CONTAINER_COMPACT_FULLSCREEN },
  'portrait_tablet': { logoSystem: SIZES.LOGO_SYSTEM_PORTRAIT_TABLET, badge: SIZES.BADGE_PORTRAIT_TABLET, title: SIZES.TITLE_PORTRAIT_TABLET, subtitle: SIZES.SUBTITLE_PORTRAIT_TABLET, clock: SIZES.CLOCK_PORTRAIT_TABLET, clockShadow: SIZES.CLOCK_SHADOW_PORTRAIT_TABLET, sideButton: SIZES.SIDE_BUTTON_PORTRAIT_TABLET, centerButton: SIZES.CENTER_BUTTON_PORTRAIT_TABLET, buttonsGap: SIZES.BUTTONS_GAP_PORTRAIT_TABLET, container: SIZES.CONTAINER_PORTRAIT_TABLET },
  'portrait_tablet_fullscreen': { logoSystem: SIZES.LOGO_SYSTEM_PORTRAIT_TABLET_FULLSCREEN, badge: SIZES.BADGE_PORTRAIT_TABLET_FULLSCREEN, title: SIZES.TITLE_PORTRAIT_TABLET_FULLSCREEN, subtitle: SIZES.SUBTITLE_PORTRAIT_TABLET_FULLSCREEN, clock: SIZES.CLOCK_PORTRAIT_TABLET_FULLSCREEN, clockShadow: SIZES.CLOCK_SHADOW_PORTRAIT_TABLET_FULLSCREEN, sideButton: SIZES.SIDE_BUTTON_PORTRAIT_TABLET_FULLSCREEN, centerButton: SIZES.CENTER_BUTTON_PORTRAIT_TABLET_FULLSCREEN, buttonsGap: SIZES.BUTTONS_GAP_PORTRAIT_TABLET_FULLSCREEN, container: SIZES.CONTAINER_PORTRAIT_TABLET_FULLSCREEN },
  'portrait_mobile': { logoSystem: SIZES.LOGO_SYSTEM_PORTRAIT_MOBILE, badge: SIZES.BADGE_PORTRAIT_MOBILE, title: SIZES.TITLE_PORTRAIT_MOBILE, subtitle: SIZES.SUBTITLE_PORTRAIT_MOBILE, clock: SIZES.CLOCK_PORTRAIT_MOBILE, clockShadow: SIZES.CLOCK_SHADOW_PORTRAIT_MOBILE, sideButton: SIZES.SIDE_BUTTON_PORTRAIT_MOBILE, centerButton: SIZES.CENTER_BUTTON_PORTRAIT_MOBILE, buttonsGap: SIZES.BUTTONS_GAP_PORTRAIT_MOBILE, container: SIZES.CONTAINER_PORTRAIT_MOBILE },
  'portrait_mobile_fullscreen': { logoSystem: SIZES.LOGO_SYSTEM_PORTRAIT_MOBILE_FULLSCREEN, badge: SIZES.BADGE_PORTRAIT_MOBILE_FULLSCREEN, title: SIZES.TITLE_PORTRAIT_MOBILE_FULLSCREEN, subtitle: SIZES.SUBTITLE_PORTRAIT_MOBILE_FULLSCREEN, clock: SIZES.CLOCK_PORTRAIT_MOBILE_FULLSCREEN, clockShadow: SIZES.CLOCK_SHADOW_PORTRAIT_MOBILE_FULLSCREEN, sideButton: SIZES.SIDE_BUTTON_PORTRAIT_MOBILE_FULLSCREEN, centerButton: SIZES.CENTER_BUTTON_PORTRAIT_MOBILE_FULLSCREEN, buttonsGap: SIZES.BUTTONS_GAP_PORTRAIT_MOBILE_FULLSCREEN, container: SIZES.CONTAINER_PORTRAIT_MOBILE_FULLSCREEN },
};

const WHITE_NOISE_URL = 'https://raw.githubusercontent.com/anars/blank-audio/master/10-minutes-of-silence.mp3';
const ALARM_URL = 'https://actions.google.com/sounds/v1/alarms/beep_short.ogg';

const formatClock = formatTimerClock;

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

const toMillisSafe = timerTimestampToMillis;
const isValidElapsedMs = isValidTimerElapsedMs;

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
  userPhotoURL,
  groupIds = [],
  isNewSession = false,
}) {
  const themeColor = '#dc2626';
  const STORAGE_KEY = useMemo(() => `@ModoQAP:SimuladoActive:${userUid}`, [userUid]);

  const tabIdRef = useRef(createTimerTabId());

  const mountTimeRef = useRef(Date.now());
  const bcRef = useRef(null);

  const joinedExistingRef = useRef(false);
  const hasSessionStartedRef = useRef(false);
  const hasEverSeenRemoteDocRef = useRef(false);
  const lastAppliedStateKeyRef = useRef(null);

  const desiredRunningRef = useRef(false);

  // === Time Sync Refs ===
  const serverOffsetMsRef = useRef(0);
  const bestRttRef = useRef(Number.POSITIVE_INFINITY);
  const timeSyncInFlightRef = useRef(false);

  const nowMs = useCallback(() => Date.now() + (Number(serverOffsetMsRef.current) || 0), []);

  const [isPreparing, setIsPreparing] = useState(true);
  const [countdown, setCountdown] = useState(3);
  const [isDark, setIsDark] = useState(true);
  const { isFullscreen, toggleFullscreen } = useFullscreenState();
  const { wakeLockWantedRef, requestWakeLock, releaseWakeLock } = useWakeLock();
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
  const [viewMode, setViewMode] = useState('normal');

  const [seconds, setSeconds] = useState(0);
  const [isPaused, setIsPaused] = useState(false);

  const intervalRef = useRef(null);
  const audioRef = useRef(null);
  const alarmRef = useRef(null);

  const accumulatedMsRef = useRef(0);
  const focusStartMsRef = useRef(null);

  const secondsRef = useRef(0);
  const isPausedRef = useRef(false);

  const originalTitleRef = useRef(document.title);
  const actionInFlightRef = useRef(false);
  const lastPersistSecondRef = useRef(-1);

  const remoteAckRef = useRef(false);
  const remoteStartMsAckedRef = useRef(null);

  const timeUpFiredRef = useRef(false);

  useEffect(() => { secondsRef.current = seconds; }, [seconds]);
  useEffect(() => { isPausedRef.current = isPaused; }, [isPaused]);
  useEffect(() => {
    wakeLockWantedRef.current = !isPreparing && !isPaused;
    if (wakeLockWantedRef.current) requestWakeLock();
    else releaseWakeLock();
  }, [isPreparing, isPaused, releaseWakeLock, requestWakeLock, wakeLockWantedRef]);

  const simuladoDocRef = useMemo(() => {
    if (!userUid) return null;
    return doc(db, 'users', userUid, 'personal_timers', 'active_simulado');
  }, [userUid]);

  const globalTimerRef = useMemo(() => {
    if (!userUid) return null;
    return doc(db, 'active_timers', userUid);
  }, [userUid]);

  const timeSyncDocRef = useMemo(() => {
    if (!userUid) return null;
    return doc(db, 'time_sync', `${userUid}_${tabIdRef.current}_sim`);
  }, [userUid]);

  // ViewMode responsivo
  useEffect(() => {
    const checkSize = () => {
      const width = window.innerWidth;
      const height = window.innerHeight;
      const isLandscape = width > height;
      let vm = 'normal';
      if (!isLandscape) {
        if (width < 768) vm = isFullscreen ? 'portrait_mobile_fullscreen' : 'portrait_mobile';
        else vm = isFullscreen ? 'portrait_tablet_fullscreen' : 'portrait_tablet';
      } else {
        if (width <= 960 && height <= 570) vm = isFullscreen ? 'compact_fullscreen' : 'compact';
        else vm = isFullscreen ? 'normal_fullscreen' : 'normal';
      }
      setViewMode(vm);
    };
    checkSize();
    window.addEventListener('resize', checkSize);
    return () => window.removeEventListener('resize', checkSize);
  }, [isFullscreen]);

  const sizes = MODE_MAP[viewMode] || MODE_MAP['normal'];
  const showLabels = !viewMode.startsWith('compact');

  // ========= TIME SYNC (NTP via Firestore) =========
  const trySampleWithActiveDoc = useCallback(async (i) => {
    if (!simuladoDocRef) return null;
    const t0 = Date.now();
    try {
      await setDoc(simuladoDocRef, {
        __ts_ping: serverTimestamp(),
        __ts_nonce: `${tabIdRef.current}_${t0}_${i}`,
      }, { merge: true });
      const snap = await getDocFromServer(simuladoDocRef);
      const t1 = Date.now();
      const serverMs = toMillisSafe(snap.data()?.__ts_ping);
      if (!Number.isFinite(serverMs)) return null;
      const rtt = Math.max(0, t1 - t0);
      const offset = serverMs - ((t0 + t1) / 2);
      return { rtt, offset };
    } catch { return null; }
  }, [simuladoDocRef]);

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
    } catch { return null; }
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
        }
        await new Promise((r) => setTimeout(r, 80));
      }
    } finally {
      timeSyncInFlightRef.current = false;
    }
  }, [userUid, trySampleWithActiveDoc, trySampleWithTimeSyncDoc]);

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

  // ========= CÁLCULO DE TEMPO =========
  const getCurrentElapsedMs = useCallback(() => {
    let ms = Number(accumulatedMsRef.current || 0);
    if (!isValidElapsedMs(ms)) {
      accumulatedMsRef.current = 0;
      ms = 0;
    }
    if (!isPausedRef.current && focusStartMsRef.current != null) {
      ms += Math.max(0, nowMs() - focusStartMsRef.current);
    }
    return Math.max(0, ms);
  }, [nowMs]);

  const msToDisplaySeconds = useCallback((elapsedMs) => {
    const elapsedSec = Math.floor(Math.max(0, Number(elapsedMs) || 0) / 1000);
    if (mode === 'countdown') {
      const total = Math.max(0, Number(initialSeconds) || 0);
      return Math.max(0, total - elapsedSec);
    }
    return elapsedSec;
  }, [mode, initialSeconds]);

  const setSecondsIfChanged = useCallback((nextSeconds) => {
    const safe = Math.max(0, Number(nextSeconds) || 0);
    if (safe !== secondsRef.current) {
      secondsRef.current = safe;
      setSeconds(safe);
    }
  }, []);

  const saveToStorage = useCallback((paused, currentElapsedMs, finished = false) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        titulo: tituloSimulado, mode, initialSeconds,
        accumulatedTimeMs: Math.max(0, Number(currentElapsedMs) || 0),
        accumulatedTime: Math.floor((Number(currentElapsedMs) || 0) / 1000),
        isPaused: paused,
        lastTimestamp: Date.now(),
        isFinished: finished,
      }));
    } catch {}
  }, [STORAGE_KEY, tituloSimulado, mode, initialSeconds]);

  const updateExternalStatus = useCallback((isRunning, displaySeconds) => {
    const timeStr = formatClock(displaySeconds);
    const label = mode === 'countdown' ? 'Restante' : 'Tempo';
    document.title = `${isRunning ? 'Simulado' : 'Simulado Pausado'} • ${label}: ${timeStr}`;
  }, [mode]);

  const computeMediaPositionState = useCallback((displaySeconds) => {
    if (mode === 'countdown') {
      const total = Math.max(1, Number(initialSeconds) || 1);
      const remaining = Math.max(0, Number(displaySeconds) || 0);
      return { duration: total, position: Math.min(total, Math.max(0, total - remaining)) };
    }
    const position = Math.max(0, Number(displaySeconds) || 0);
    return { duration: Math.max(3600, position + 60), position };
  }, [mode, initialSeconds]);

  const updateMediaSession = useCallback((isRunning, displaySeconds) => {
    if (!('mediaSession' in navigator)) return;
    try {
      const timeStr = formatClock(displaySeconds);
      const label = mode === 'countdown' ? 'Tempo restante' : 'Tempo decorrido';
      navigator.mediaSession.metadata = new MediaMetadata({
        title: tituloSimulado || 'Simulado',
        artist: `${isRunning ? 'Rodando' : 'Pausado'} • ${label}: ${timeStr}`,
        album: 'ModoQAP • Simulado',
        artwork: [{ src: '/logoModoQAP.png', sizes: '512x512', type: 'image/png' }]
      });
      navigator.mediaSession.playbackState = isRunning ? 'playing' : 'paused';
      if ('setPositionState' in navigator.mediaSession) {
        const { duration, position } = computeMediaPositionState(displaySeconds);
        try {
          navigator.mediaSession.setPositionState({ duration, position, playbackRate: isRunning ? 1 : 0 });
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
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const handleTimeUp = useCallback(() => {
    if (timeUpFiredRef.current) return;
    timeUpFiredRef.current = true;
    if (alarmRef.current) alarmRef.current.play().catch(() => {});
    safeNotify('Tempo do simulado acabou!', 'O cronômetro zerou.');
  }, []);

  const buildFirestorePayload = useCallback((isRunning, extra = {}) => {
    const elapsedMsNow = getCurrentElapsedMs();
    const elapsedSecNow = Math.floor(elapsedMsNow / 1000);
    const start = nowMs();
    return {
      uid: userUid,
      userName: userName || 'Candidato',
      photoURL: userPhotoURL || null,
      groupIds: Array.isArray(groupIds) ? groupIds : [],
      titulo: tituloSimulado || 'Simulado',
      disciplinaNome: tituloSimulado || 'Simulado',
      assunto: 'Prova em Andamento',
      mode: mode || 'free',
      initialSeconds: Number(initialSeconds) || 0,
      status: isRunning ? 'running' : 'paused',
      isPaused: !isRunning,
      elapsedBaseMs: Number(accumulatedMsRef.current || 0),
      secondsSnapshot: Number(secondsRef.current) || 0,
      elapsedSnapshot: Number(elapsedSecNow) || 0,
      elapsedMsSnapshot: Number(elapsedMsNow) || 0,
      runStartedAt: isRunning ? serverTimestamp() : null,
      runStartedAtMs: isRunning ? start : null,
      actionSeq: increment(1),
      action: isRunning ? 'resume' : 'pause',
      actionAt: serverTimestamp(),
      updatedBy: tabIdRef.current,
      updatedAt: serverTimestamp(),
      heartbeatAt: serverTimestamp(),
      isSimulado: true,
      timerType: 'simulado',
      ...extra,
    };
  }, [userUid, userName, userPhotoURL, groupIds, tituloSimulado, mode, initialSeconds, getCurrentElapsedMs, nowMs]);

  // ✅ FIX: UPSERT MAIS ROBUSTO PARA GARANTIR SINCRONIA IMEDIATA
  const upsertFirebase = useCallback(async (isRunning, extra = {}) => {
    if (!userUid) return;
    const payload = buildFirestorePayload(isRunning, extra);
    try {
      if (simuladoDocRef) await setDoc(simuladoDocRef, payload, { merge: true });
      if (globalTimerRef) await setDoc(globalTimerRef, payload, { merge: true });
    } catch (e) {
      console.warn('[SimuladoTimer] Firebase upsert ignorado:', e?.message);
    }
  }, [simuladoDocRef, globalTimerRef, userUid, buildFirestorePayload]);

  const patchFirebase = useCallback(async (patch) => {
    if (!userUid) return;
    const base = {
      updatedBy: tabIdRef.current,
      updatedAt: serverTimestamp(),
      heartbeatAt: serverTimestamp(),
      elapsedMsSnapshot: Number(getCurrentElapsedMs() || 0),
      secondsSnapshot: Number(secondsRef.current || 0),
      ...patch,
    };
    try {
      if (simuladoDocRef) await updateDoc(simuladoDocRef, base);
      if (globalTimerRef) await updateDoc(globalTimerRef, base);
    } catch {
      await upsertFirebase(!isPausedRef.current, patch);
    }
  }, [userUid, simuladoDocRef, globalTimerRef, getCurrentElapsedMs, upsertFirebase]);

  const safeRemoveFirebase = useCallback(async () => {
    try {
      if (simuladoDocRef) await deleteDoc(simuladoDocRef);
      if (globalTimerRef) await deleteDoc(globalTimerRef);
    } catch (e) {
      console.warn('[SimuladoTimer] Erro ao limpar Firebase:', e?.message);
    }
  }, [simuladoDocRef, globalTimerRef]);

  const ensureRemoteStartAck = useCallback(async (startMs) => {
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
      elapsedBaseMs: 0,
    };

    const delays = [0, 250, 500, 900, 1400, 2000, 2500];
    for (let i = 0; i < delays.length; i++) {
      if (remoteAckRef.current) return true;
      const d = delays[i];
      if (d > 0) await new Promise(r => setTimeout(r, d));
      try {
        const payload = buildFirestorePayload(true, basePayload);
        if (simuladoDocRef) await setDoc(simuladoDocRef, payload, { merge: true });
        if (globalTimerRef) await setDoc(globalTimerRef, payload, { merge: true });
      } catch {}
      try {
        if (simuladoDocRef) {
          const snap = await getDocFromServer(simuladoDocRef);
          if (snap.exists()) {
            const data = snap.data() || {};
            const rs = Number(data.runStartedAtMs);
            if (Number.isFinite(rs) && rs === startMs && data.status === 'running' && !data.isPaused) {
              remoteAckRef.current = true;
              return true;
            }
          }
        }
      } catch {}
    }
    return false;
  }, [simuladoDocRef, globalTimerRef, buildFirestorePayload]);

  // Heartbeat acelerado (sem ACK)
  useEffect(() => {
    if (!userUid || isPreparing) return;
    const fast = setInterval(() => {
      if (!remoteAckRef.current && remoteStartMsAckedRef.current != null) {
        patchFirebase({});
      }
    }, 2000);
    return () => clearInterval(fast);
  }, [userUid, isPreparing, patchFirebase]);

  // Heartbeat normal (30s)
  useEffect(() => {
    if (isPreparing || !userUid) return;
    const t = setInterval(() => {
      if (!isPausedRef.current) patchFirebase({});
    }, 30000);
    return () => clearInterval(t);
  }, [isPreparing, userUid, patchFirebase]);

  // ========= tick loop (ACELERADO PARA 50ms) =========
  const startTickLoop = useCallback(() => {
    clearTimers();
    const tick = () => {
      if (isPausedRef.current) return;
      const elapsedMsNow = getCurrentElapsedMs();
      const display = msToDisplaySeconds(elapsedMsNow);
      setSecondsIfChanged(display);
      const elapsedSecNow = Math.floor(elapsedMsNow / 1000);
      if (elapsedSecNow !== lastPersistSecondRef.current) {
        lastPersistSecondRef.current = elapsedSecNow;
        saveToStorage(false, elapsedMsNow, false);
        updateExternalStatus(true, display);
        updateMediaSession(true, display);
        if (mode === 'countdown' && display <= 0) handleTimeUp();
      }
    };
    tick();
    // ✅ FIX: Aumenta a frequência para evitar "pulos" visuais em dispositivos lentos
    intervalRef.current = setInterval(tick, 50);
  }, [clearTimers, getCurrentElapsedMs, msToDisplaySeconds, setSecondsIfChanged, saveToStorage, updateExternalStatus, updateMediaSession, mode, handleTimeUp]);

  // Broadcast Channel
  const postBC = useCallback((payload) => {
    try { if (bcRef.current) bcRef.current.postMessage({ from: tabIdRef.current, ...payload }); } catch {}
  }, []);

  useEffect(() => {
    if (!userUid) return;
    try { bcRef.current = new BroadcastChannel(`ModoQAP:SimuladoBC:${userUid}`); } catch { bcRef.current = null; }
    if (!bcRef.current) return;
    return () => {
      try { bcRef.current?.close?.(); } catch {}
      bcRef.current = null;
    };
  }, [userUid]);

  // ========= PAUSE =========
  const pauseSimulado = useCallback((source = 'user') => {
    if (isPausedRef.current || actionInFlightRef.current) return;
    actionInFlightRef.current = true;

    const n = nowMs();
    if (typeof focusStartMsRef.current === 'number') {
      accumulatedMsRef.current += Math.max(0, n - focusStartMsRef.current);
    }
    focusStartMsRef.current = null;
    desiredRunningRef.current = false;
    isPausedRef.current = true;
    setIsPaused(true);
    clearTimers();

    const display = msToDisplaySeconds(accumulatedMsRef.current);
    setSecondsIfChanged(display);
    saveToStorage(true, accumulatedMsRef.current, false);
    updateExternalStatus(false, display);
    updateMediaSession(false, display);
    try { audioRef.current?.pause?.(); } catch {}

    void patchFirebase({
      status: 'paused', isPaused: true, action: 'pause',
      actionAt: serverTimestamp(), actionSeq: increment(1),
      updatedBy: tabIdRef.current, elapsedBaseMs: Math.floor(accumulatedMsRef.current),
    });
    if (source !== 'bc') postBC({ type: 'SIMULADO_SYNC', action: 'PAUSE', at: Date.now() });
    setTimeout(() => { actionInFlightRef.current = false; }, 300);
  }, [nowMs, msToDisplaySeconds, setSecondsIfChanged, clearTimers, saveToStorage, updateExternalStatus, updateMediaSession, patchFirebase, postBC]);

  // ========= RESUME =========
  const resumeSimulado = useCallback((source = 'user') => {
    if (!isPausedRef.current || actionInFlightRef.current) return;
    if (mode === 'countdown' && secondsRef.current <= 0) return;
    actionInFlightRef.current = true;

    const n = nowMs();
    focusStartMsRef.current = n;
    desiredRunningRef.current = true;
    isPausedRef.current = false;
    setIsPaused(false);
    try { audioRef.current?.play().catch(() => {}); } catch {}
    startTickLoop();

    const display = msToDisplaySeconds(accumulatedMsRef.current);
    updateExternalStatus(true, display);
    updateMediaSession(true, display);

    void patchFirebase({
      status: 'running', isPaused: false,
      runStartedAt: serverTimestamp(), runStartedAtMs: n,
      action: 'resume', actionAt: serverTimestamp(), actionSeq: increment(1),
      updatedBy: tabIdRef.current, elapsedBaseMs: Math.floor(accumulatedMsRef.current),
    });
    if (source !== 'bc') postBC({ type: 'SIMULADO_SYNC', action: 'RESUME', at: Date.now() });
    setTimeout(() => { actionInFlightRef.current = false; }, 300);
  }, [mode, nowMs, startTickLoop, msToDisplaySeconds, updateExternalStatus, updateMediaSession, patchFirebase, postBC]);

  const handleTogglePause = useCallback((source = 'user') => {
    if (isPausedRef.current) resumeSimulado(source);
    else pauseSimulado(source);
  }, [pauseSimulado, resumeSimulado]);

  // ========= estado remoto =========
  const makeRemoteStateKey = useCallback((data) => {
    const rs1 = toMillisSafe(data?.runStartedAt) || 0;
    const rs2 = Number(data?.runStartedAtMs ?? 0) || 0;
    return [
      data?.status ?? '',
      data?.isPaused ? '1' : '0',
      Number(data?.elapsedBaseMs ?? 0),
      rs1, rs2,
      Number(data?.actionSeq ?? 0),
      data?.action ?? '',
    ].join('|');
  }, []);

  const getRemoteRunStartedMs = useCallback((data) => {
    const numericMs = Number(data?.runStartedAtMs);
    if (Number.isFinite(numericMs) && numericMs > 0 && Math.abs(nowMs() - numericMs) < 300000) return numericMs;
    const timestampMs = toMillisSafe(data?.runStartedAt);
    if (Number.isFinite(timestampMs)) return timestampMs;
    const actionMs = toMillisSafe(data?.actionAt);
    if (Number.isFinite(actionMs)) return actionMs;
    return null;
  }, [nowMs]);

  const applyRemoteState = useCallback((data) => {
    if (!data) return;
    if (!data.isSimulado && data.timerType !== 'simulado') return;

    const key = makeRemoteStateKey(data);
    if (lastAppliedStateKeyRef.current === key) return;

    const isOwn = data.updatedBy === tabIdRef.current;
    const status = data.status;
    hasEverSeenRemoteDocRef.current = true;

    try {
      const rs = Number(data?.runStartedAtMs);
      if (Number.isFinite(rs) && rs > 0 && data.status === 'running' && !data.isPaused && remoteStartMsAckedRef.current != null && rs === remoteStartMsAckedRef.current) {
        remoteAckRef.current = true;
      }
    } catch {}

    if (!joinedExistingRef.current) {
      if (status === 'running' || status === 'paused') {
        joinedExistingRef.current = true;
        hasSessionStartedRef.current = true;
        setIsPreparing(false);
        setCountdown(0);
      }
    }

    let baseMs = Math.max(0, Number(data.elapsedBaseMs ?? 0));
    if (!isValidElapsedMs(baseMs)) baseMs = 0;

    const shouldRun = (status === 'running') && !data.isPaused;
    let remoteStartMs = shouldRun ? getRemoteRunStartedMs(data) : null;

    // ✅ FIX: REMOVIDA COMPENSAÇÃO DE RTT MANUAL (USA APENAS TIME SYNC)
    // O ServerOffsetMsRef já corrige o tempo do servidor, então não precisamos mais
    // tentar adivinhar a latência e subtrair do tempo de início.
    if (shouldRun && bestRttRef.current === Number.POSITIVE_INFINITY) performTimeSync();

    if (isOwn) {
      if (shouldRun && remoteStartMs != null) focusStartMsRef.current = remoteStartMs;
      lastAppliedStateKeyRef.current = key;
      return;
    }

    clearTimers();
    accumulatedMsRef.current = baseMs;
    focusStartMsRef.current = null;

    if (shouldRun && remoteStartMs != null) {
      if (isPausedRef.current) setIsPaused(false);
      isPausedRef.current = false;
      desiredRunningRef.current = true;
      focusStartMsRef.current = remoteStartMs;
      try { audioRef.current?.play().catch(() => {}); } catch {}
      startTickLoop();
    } else {
      if (!isPausedRef.current) setIsPaused(true);
      isPausedRef.current = true;
      desiredRunningRef.current = false;
      try { audioRef.current?.pause?.(); } catch {}
    }

    // ✅ FIX: FORÇA A ATUALIZAÇÃO VISUAL IMEDIATA
    const display = msToDisplaySeconds(shouldRun ? getCurrentElapsedMs() : baseMs);
    setSecondsIfChanged(display);

    updateExternalStatus(!isPausedRef.current, display);
    updateMediaSession(!isPausedRef.current, display);
    saveToStorage(!shouldRun, baseMs, false);
    lastAppliedStateKeyRef.current = key;
  }, [makeRemoteStateKey, clearTimers, startTickLoop, msToDisplaySeconds, getCurrentElapsedMs, setSecondsIfChanged, saveToStorage, updateExternalStatus, updateMediaSession, getRemoteRunStartedMs, performTimeSync]);

  // BC listener
  useEffect(() => {
    if (!bcRef.current) return;
    const handleBC = (ev) => {
      const msg = ev?.data;
      if (!msg || msg.from === tabIdRef.current) return;
      if (msg.action === 'PAUSE' || (msg.type === 'SIMULADO_SYNC' && msg.action === 'PAUSE')) pauseSimulado('bc');
      if (msg.action === 'RESUME' || (msg.type === 'SIMULADO_SYNC' && msg.action === 'RESUME')) resumeSimulado('bc');
      if (msg.action === 'CANCEL' || msg.action === 'STOP') {
        clearTimers();
        try { localStorage.removeItem(STORAGE_KEY); } catch {}
        onCancel?.();
      }
    };
    bcRef.current.addEventListener('message', handleBC);
    return () => {
      try { bcRef.current?.removeEventListener('message', handleBC); } catch {}
    };
  }, [pauseSimulado, resumeSimulado, clearTimers, STORAGE_KEY, onCancel]);

  // Firestore snapshot (para sync cross-device e cross-tab)
  useEffect(() => {
    if (!simuladoDocRef) return;
    const unsub = onSnapshot(
      simuladoDocRef,
      { includeMetadataChanges: false },
      (snap) => {
        if (snap.metadata?.hasPendingWrites) return;
        if (!snap.exists()) {
          const age = Date.now() - mountTimeRef.current;
          if (!hasEverSeenRemoteDocRef.current && age < 5000) return;
          clearTimers();
          try { localStorage.removeItem(STORAGE_KEY); } catch {}
          onCancel?.();
          return;
        }
        const data = snap.data() || {};
        hasEverSeenRemoteDocRef.current = true;
        applyRemoteState(data);
      },
      () => {}
    );
    return () => unsub();
  }, [simuladoDocRef, applyRemoteState, STORAGE_KEY, onCancel, clearTimers]);

  // ✅ FIX: Ao montar, só tenta restaurar sessão do Firestore se NÃO for uma sessão nova.
  useEffect(() => {
    if (!simuladoDocRef) return;
    if (isNewSession) return;

    let cancelled = false;
    (async () => {
      try {
        const snap = await getDocFromServer(simuladoDocRef);
        if (cancelled) return;
        if (snap.exists()) {
          const data = snap.data();
          if (data?.status && data.status !== 'stopped' && (data.isSimulado || data.timerType === 'simulado')) {
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
  }, [simuladoDocRef, applyRemoteState, performTimeSync, isNewSession]);

  // Countdown 3-2-1
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

  // 🚀 Início efetivo após countdown
  useEffect(() => {
    if (!userUid) return;
    if (joinedExistingRef.current) return;
    if (isPreparing) return;
    if (countdown > 0) return;
    if (hasSessionStartedRef.current) return;

    hasSessionStartedRef.current = true;
    timeUpFiredRef.current = false;

    const start = nowMs();
    accumulatedMsRef.current = 0;
    focusStartMsRef.current = start;
    desiredRunningRef.current = true;
    isPausedRef.current = false;
    setIsPaused(false);

    const displayInitial = mode === 'countdown' ? Number(initialSeconds) || 0 : 0;
    setSeconds(displayInitial);
    secondsRef.current = displayInitial;

    try { audioRef.current?.play().catch(() => {}); } catch {}
    startTickLoop();
    updateExternalStatus(true, displayInitial);
    updateMediaSession(true, displayInitial);
    saveToStorage(false, 0, false);

    (async () => {
      try { await ensureRemoteStartAck(start); } catch (e) { console.warn('[SimuladoTimer] falha no ensureRemoteStartAck:', e); }
      try { await performTimeSync(); } catch {}
    })();
  }, [userUid, isPreparing, countdown, mode, initialSeconds, nowMs, startTickLoop, saveToStorage, updateExternalStatus, updateMediaSession, ensureRemoteStartAck, performTimeSync]);

  // Visibilidade
  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === 'visible') {
        try {
          const display = msToDisplaySeconds(getCurrentElapsedMs());
          setSecondsIfChanged(display);
          if (!isPausedRef.current) {
            updateExternalStatus(true, display);
            updateMediaSession(true, display);
          }
        } catch {}
      }
    };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, [msToDisplaySeconds, getCurrentElapsedMs, setSecondsIfChanged, updateExternalStatus, updateMediaSession]);

  // Init audio + cleanup
  useEffect(() => {
    const originalTitle = originalTitleRef.current;
    audioRef.current = new Audio(WHITE_NOISE_URL);
    audioRef.current.loop = true;
    audioRef.current.volume = 0.01;
    try { audioRef.current.setAttribute('playsinline', ''); } catch {}
    alarmRef.current = new Audio(ALARM_URL);
    setIsDark(document.documentElement.classList.contains('dark'));

    return () => {
      clearTimers();
      try { audioRef.current?.pause?.(); } catch {}
      try { alarmRef.current?.pause?.(); } catch {}
      document.title = originalTitle;
      try {
        if ('mediaSession' in navigator && 'setPositionState' in navigator.mediaSession) {
          navigator.mediaSession.setPositionState(null);
        }
      } catch {}
      if (document.fullscreenElement) {
        try { document.exitFullscreen(); } catch {}
      }
    };
  }, [clearTimers]);

  const handleTogglePauseRef = useRef(null);
  const handleStopRef = useRef(null);
  useEffect(() => { handleTogglePauseRef.current = handleTogglePause; }, [handleTogglePause]);

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

  // ========= STOP =========
  const handleStop = useCallback(() => {
    desiredRunningRef.current = false;
    clearTimers();
    try { audioRef.current?.pause?.(); } catch {}

    const finalMs = getCurrentElapsedMs();
    saveToStorage(true, finalMs, true);
    postBC({ type: 'SIMULADO_SYNC', action: 'STOP', at: Date.now() });
    safeRemoveFirebase();

    const finalSec = Math.floor(finalMs / 1000);
    const display = mode === 'countdown' ? Math.max(0, (Number(initialSeconds) || 0) - finalSec) : finalSec;
    updateExternalStatus(false, display);
    updateMediaSession(false, display);

    onStop(Math.max(1, Math.round(finalSec / 60)));
  }, [clearTimers, getCurrentElapsedMs, saveToStorage, postBC, safeRemoveFirebase, mode, initialSeconds, updateExternalStatus, updateMediaSession, onStop]);

  useEffect(() => { handleStopRef.current = handleStop; }, [handleStop]);

  // ========= CANCEL =========
  const handleCancelSession = useCallback(() => {
    desiredRunningRef.current = false;
    clearTimers();
    try { localStorage.removeItem(STORAGE_KEY); } catch {}
    postBC({ type: 'SIMULADO_SYNC', action: 'CANCEL', at: Date.now() });
    safeRemoveFirebase();
    updateExternalStatus(false, secondsRef.current);
    updateMediaSession(false, secondsRef.current);
    onCancel();
  }, [clearTimers, STORAGE_KEY, postBC, safeRemoveFirebase, updateExternalStatus, updateMediaSession, onCancel]);

  const toggleTheme = () => {
    if (isDark) { document.documentElement.classList.remove('dark'); setIsDark(false); }
    else { document.documentElement.classList.add('dark'); setIsDark(true); }
  };

  // ============================================================
  // RENDER: MINIMIZADO
  // ============================================================
  if (isMinimized) {
      const activeColor = isPaused ? '#fbbf24' : themeColor;

      return (
          <motion.div
              initial={{ opacity: 0, x: 50, scale: 0.9 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="fixed bottom-24 right-4 z-[9999]"
          >
              <div
                  className="relative overflow-hidden group bg-white/90 dark:bg-zinc-900/95 backdrop-blur-xl border border-zinc-200/50 dark:border-white/10 shadow-xl rounded-xl p-2.5 flex items-center gap-3 w-auto max-w-[280px] cursor-pointer transition-all duration-300"
                  onClick={onMaximize}
              >
                  {/* Glow de fundo reduzido */}
                  <div
                      className="absolute -inset-4 opacity-5 blur-xl pointer-events-none group-hover:opacity-10 transition-opacity"
                      style={{ backgroundColor: activeColor }}
                  />

                  {/* Indicador Visual (SVG Ajustado para não cortar) */}
                  <div className="relative flex items-center justify-center w-10 h-10 shrink-0">
                      <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 40 40">
                          <circle
                              cx="20" cy="20" r="18"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2.5"
                              className="text-zinc-100 dark:text-white/5"
                          />
                          {!isPaused && (
                              <motion.circle
                                  cx="20" cy="20" r="18"
                                  fill="none"
                                  stroke={activeColor}
                                  strokeWidth="2.5"
                                  strokeLinecap="round"
                                  strokeDasharray="113.1" // Perímetro aproximado (2 * PI * 18)
                                  initial={{ strokeDashoffset: 113.1 }}
                                  animate={{ strokeDashoffset: 0 }}
                                  transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
                              />
                          )}
                      </svg>

                      <div
                          className="relative z-10 flex items-center justify-center w-7 h-7 rounded-full transition-colors duration-500"
                          style={{ backgroundColor: `${activeColor}15` }}
                      >
                          {!isPaused ? (
                              <ClipboardList size={12} className="fill-current" style={{ color: activeColor }} />
                          ) : (
                              <div className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                          )}
                      </div>
                  </div>

                  {/* Textos e Tempo */}
                  <div className="flex flex-col min-w-0 flex-1">
                      <span className="text-[8px] text-zinc-500 dark:text-zinc-400 uppercase font-black tracking-wider truncate mb-0.5">
                          {tituloSimulado || 'Simulado'}
                      </span>
                      <span className="text-lg font-mono font-black text-zinc-900 dark:text-white leading-none">
                          {formatClock(seconds)}
                      </span>
                  </div>

                  {/* Botão de Controle Compacto */}
                  <div className="flex items-center pl-1" onClick={(e) => e.stopPropagation()}>
                      <button
                          onClick={() => handleTogglePause('user')}
                          className={`p-2 rounded-lg transition-all duration-300 border ${
                              isPaused
                              ? 'bg-amber-500 border-amber-400 text-white'
                              : 'bg-zinc-900 dark:bg-white border-zinc-800 dark:border-zinc-100 text-white dark:text-zinc-900'
                          } hover:scale-110 active:scale-95 shadow-md`}
                      >
                          {isPaused ? <Play size={12} fill="currentColor" /> : <Pause size={12} fill="currentColor" />}
                      </button>
                  </div>

                  {/* Detalhe Lateral */}
                  <div
                      className="absolute left-0 top-2 bottom-2 w-0.5 rounded-r-full transition-colors duration-500"
                      style={{ backgroundColor: activeColor }}
                  />
              </div>
          </motion.div>
      );
  }

  // ============================================================
  // RENDER: FULL
  // ============================================================
  const isLowTime = mode === 'countdown' && seconds < 600;
  const clockColor = isPaused ? '#a1a1aa' : (isLowTime ? '#ef4444' : '#18181b');

  return (
    <div className="fixed inset-0 z-[9999] bg-zinc-50 dark:bg-background-dark flex flex-col items-center justify-center animate-fade-in overflow-hidden font-sans">

      {isCancelModalOpen && (
        <div className="fixed inset-0 z-[10000] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-2xl rounded-2xl p-6 w-full max-w-sm">
            <div className="flex items-start gap-4">
              <X className="text-red-500 mt-0.5 shrink-0" size={24} />
              <div>
                <h3 className="text-lg font-bold text-zinc-900 dark:text-white mb-1">Cancelar Simulado?</h3>
                <p className="text-sm text-zinc-500 dark:text-zinc-400">Todo o progresso será perdido e o simulado não será salvo.</p>
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button onClick={() => setIsCancelModalOpen(false)} className="px-4 py-2 text-sm font-semibold text-zinc-600 dark:text-zinc-300 bg-zinc-100 dark:bg-zinc-800 rounded-lg hover:bg-zinc-200 dark:hover:bg-zinc-700">Continuar</button>
              <button onClick={handleCancelSession} className="px-4 py-2 text-sm font-bold text-white rounded-lg bg-red-600 hover:bg-red-700">Sim, Cancelar</button>
            </div>
          </div>
        </div>
      )}

      <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, currentColor 1px, transparent 0)', backgroundSize: '40px 40px', color: themeColor }} />
      <div className="absolute top-0 left-0 w-full h-1 opacity-50" style={{ background: `linear-gradient(90deg, transparent, ${themeColor}, transparent)` }} />

      {/* Logo */}
      <div className="absolute flex items-center pointer-events-none z-20" style={{ top: sizes.logoSystem.LOGO_TOP, left: sizes.logoSystem.LOGO_LEFT }}>
        <img src="/logoModoQAP.png" alt="Logo" className="drop-shadow-2xl grayscale-[0.2]" style={{ height: sizes.logoSystem.LOGO_HEIGHT, width: 'auto', opacity: sizes.logoSystem.LOGO_OPACITY }} />
        <h1 style={{ fontSize: sizes.logoSystem.NAME_FONT_SIZE, fontWeight: sizes.logoSystem.NAME_FONT_WEIGHT, color: sizes.logoSystem.NAME_COLOR, letterSpacing: sizes.logoSystem.NAME_TRACKING, opacity: sizes.logoSystem.NAME_OPACITY, marginLeft: sizes.logoSystem.NAME_MARGIN_LEFT, textTransform: sizes.logoSystem.NAME_UPPERCASE ? 'uppercase' : 'none' }}>
          {sizes.logoSystem.SYSTEM_NAME}
        </h1>
      </div>

      {/* Controles superiores */}
      <div className="absolute top-4 right-4 flex gap-2 z-[100]">
        <button onClick={toggleTheme} className="p-3 rounded-full bg-white dark:bg-zinc-900 text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 border border-zinc-200 dark:border-zinc-800 transition-all shadow-sm">
          {isDark ? <Sun size={20} /> : <Moon size={20} />}
        </button>
        <button onClick={toggleFullscreen} className="p-3 rounded-full bg-white dark:bg-zinc-900 text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 border border-zinc-200 dark:border-zinc-800 transition-all shadow-sm">
          {isFullscreen ? <Minimize2 size={20} /> : <Maximize size={20} />}
        </button>
        <button onClick={onMinimize} className="flex items-center gap-2 bg-white dark:bg-zinc-900 text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 border border-zinc-200 dark:border-zinc-800 transition-all px-4 py-2 rounded-full shadow-sm">
          <Minimize2 size={20} />
          <span className="hidden md:inline text-sm font-bold uppercase tracking-wide">Minimizar</span>
        </button>
      </div>

      {/* Countdown 3-2-1 */}
      <AnimatePresence>
        {isPreparing && (
          <motion.div className="absolute inset-0 z-50 flex flex-col items-center justify-center" initial={{ opacity: 1 }} exit={{ opacity: 0 }} style={{ backgroundColor: isDark ? '#09090b' : '#fafafa' }}>
            <motion.div key={countdown} initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1.5, opacity: 1 }} exit={{ scale: 2, opacity: 0 }} transition={{ duration: 0.5 }} className="relative font-black drop-shadow-2xl text-[10rem] md:text-[15rem]">
              <div className="absolute inset-0 rounded-full blur-[60px]" style={{ backgroundColor: themeColor, opacity: 0.3 }} />
              <span className="relative z-10 text-black dark:text-white">{countdown > 0 ? countdown : 'GO!'}</span>
            </motion.div>
            <p className="mt-8 text-zinc-500 text-xl uppercase tracking-[0.5em] font-bold text-center px-4">Boa Prova</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Conteúdo Principal */}
      <div className="relative z-10 flex flex-col items-center text-center w-full max-w-5xl px-4" style={{ marginTop: sizes.container.MARGIN_TOP, paddingTop: sizes.container.PADDING_TOP }}>

        {/* Badge */}
        <div className="rounded-full border font-bold tracking-[0.2em] uppercase flex items-center transition-colors shadow-sm bg-white dark:bg-zinc-900" style={{ borderColor: isPaused ? '#fbbf2440' : `${themeColor}40`, color: isPaused ? '#d97706' : themeColor, paddingLeft: sizes.badge.PADDING_X, paddingRight: sizes.badge.PADDING_X, paddingTop: sizes.badge.PADDING_Y, paddingBottom: sizes.badge.PADDING_Y, fontSize: sizes.badge.FONT_SIZE, gap: sizes.badge.GAP, marginBottom: sizes.badge.MARGIN_BOTTOM }}>
          <span className={`rounded-full ${isPaused ? 'bg-amber-400' : 'animate-pulse'}`} style={{ width: sizes.badge.DOT_SIZE, height: sizes.badge.DOT_SIZE, backgroundColor: isPaused ? undefined : themeColor }} />
          {isPaused ? 'Simulado Pausado' : (mode === 'countdown' ? 'Cronômetro' : 'Tempo Livre')}
        </div>

        {/* Título */}
        <h2 className="font-bold text-zinc-800 dark:text-zinc-300 tracking-tight max-w-3xl leading-tight line-clamp-2" style={{ fontSize: sizes.title.FONT_SIZE, marginBottom: sizes.title.MARGIN_BOTTOM }}>
          {tituloSimulado || 'Simulado'}
        </h2>

        {/* Subtítulo */}
        <div className="flex items-center gap-2 text-zinc-500 dark:text-zinc-400 font-bold uppercase tracking-wide" style={{ fontSize: sizes.subtitle.FONT_SIZE, marginBottom: sizes.subtitle.MARGIN_BOTTOM }}>
          <ClipboardList size={14} />
          <span>Simulado em Andamento</span>
        </div>

        {/* Relógio */}
        <div className="relative" style={{ marginBottom: sizes.clock.MARGIN_BOTTOM }}>
          <div className="absolute rounded-full transition-colors duration-700 pointer-events-none" style={{ inset: sizes.clockShadow.INSET, filter: `blur(${sizes.clockShadow.BLUR})`, opacity: sizes.clockShadow.OPACITY, backgroundColor: isPaused ? '#71717a' : themeColor }} />
          <div className="font-mono font-bold leading-none tracking-tighter tabular-nums transition-colors duration-300 select-none drop-shadow-2xl relative z-10" style={{ fontSize: sizes.clock.FONT_SIZE, color: clockColor }}>
            <span className={isPaused ? 'text-zinc-400' : isLowTime ? 'text-red-500 animate-pulse' : 'text-zinc-900 dark:text-white'}>
              {formatClock(seconds)}
            </span>
          </div>
        </div>

        {/* Botões */}
        <div className="flex items-center" style={{ gap: sizes.buttonsGap }}>

          <button onClick={() => setIsCancelModalOpen(true)} className="group flex flex-col items-center text-zinc-400 hover:text-red-500 transition-colors" style={{ gap: sizes.sideButton.GAP }}>
            <div className="rounded-full border-2 border-zinc-200 dark:border-zinc-800 group-hover:border-red-500/50 flex items-center justify-center bg-white dark:bg-zinc-900 transition-all shadow-sm" style={{ width: sizes.sideButton.WIDTH, height: sizes.sideButton.HEIGHT }}>
              <X size={sizes.sideButton.ICON_SIZE} />
            </div>
            {showLabels && <span className="font-bold uppercase tracking-wider text-center" style={{ fontSize: sizes.sideButton.LABEL_SIZE }}>Cancelar</span>}
          </button>

          <button
            onClick={() => handleTogglePause('user')}
            className="rounded-full flex flex-col items-center justify-center shadow-2xl transition-all transform hover:scale-105 active:scale-95 text-white"
            style={{ backgroundColor: isPaused ? themeColor : '#f59e0b', width: sizes.centerButton.WIDTH, height: sizes.centerButton.HEIGHT }}
          >
            {isPaused ? <Play size={sizes.centerButton.ICON_SIZE} className="ml-0.5" fill="currentColor" /> : <Pause size={sizes.centerButton.ICON_SIZE} fill="currentColor" />}
            {showLabels && <span className="font-bold uppercase" style={{ fontSize: sizes.centerButton.LABEL_SIZE, marginTop: sizes.centerButton.LABEL_MARGIN_TOP }}>{isPaused ? 'Retomar' : 'Pausar'}</span>}
          </button>

          <button onClick={handleStop} className="group flex flex-col items-center text-zinc-400 hover:text-emerald-500 transition-colors" style={{ gap: sizes.sideButton.GAP }}>
            <div className="rounded-full border-2 border-zinc-200 dark:border-zinc-800 group-hover:border-emerald-500/50 flex items-center justify-center bg-white dark:bg-zinc-900 transition-all shadow-sm" style={{ width: sizes.sideButton.WIDTH, height: sizes.sideButton.HEIGHT }}>
              <Square size={sizes.sideButton.ICON_SIZE} fill="currentColor" />
            </div>
            {showLabels && <span className="font-bold uppercase tracking-wider text-center" style={{ fontSize: sizes.sideButton.LABEL_SIZE }}>Finalizar</span>}
          </button>

        </div>
      </div>
    </div>
  );
}

export default SimuladoTimer;
