const MAX_TIMER_MS = 7 * 24 * 60 * 60 * 1000;

const timestampMs = (value) => {
  if (!value) return 0;
  if (typeof value.toMillis === 'function') return value.toMillis();
  if (typeof value.toDate === 'function') return value.toDate().getTime();
  return new Date(value).getTime() || 0;
};

const isReasonableElapsedMs = (value) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric >= 0 && numeric < MAX_TIMER_MS;
};

export const getLiveTimerPhase = (session) => session?.phase || (session?.isResting ? 'rest' : 'focus');

const getDisplaySnapshotSeconds = (session) => (
  Math.max(0, Number(session?.displaySecondsSnapshot ?? session?.secondsSnapshot ?? session?.seconds ?? 0) || 0)
);

const getRemoteRunStartedMs = (session, nowMs) => {
  const numericMs = Number(session?.runStartedAtMs);
  if (
    Number.isFinite(numericMs)
    && numericMs > 0
    && numericMs < nowMs + 5 * 60 * 1000
    && numericMs > nowMs - MAX_TIMER_MS
  ) return numericMs;

  return timestampMs(session?.runStartedAt)
    || timestampMs(session?.actionAt)
    || timestampMs(session?.snapshotAt)
    || timestampMs(session?.updatedAt)
    || null;
};

const getElapsedBaseMs = (session, phase) => {
  const isStudyTimer = session?.variant !== 'simulado' && !session?.isSimulado;
  const candidates = phase === 'rest'
    ? [session?.restBaseMs, session?.restElapsedMsSnapshot]
    : (isStudyTimer && session?.mode === 'pomodoro')
      ? [session?.pomoBaseMs, session?.pomodoroElapsedMsSnapshot, session?.focusBaseMs, session?.focusElapsedMsSnapshot]
      : [session?.focusBaseMs, session?.focusElapsedMsSnapshot];
  const firstValid = candidates.find(isReasonableElapsedMs);
  return firstValid == null ? getDisplaySnapshotSeconds(session) * 1000 : Math.max(0, Number(firstValid));
};

const countdownTotalSeconds = (session, phase) => {
  if (phase === 'rest') return Math.max(0, Number(session?.restSeconds || 0));
  if (session?.mode === 'pomodoro' && session?.variant !== 'simulado' && !session?.isSimulado) {
    return Math.max(0, Number(session?.pomodoroSeconds || 0));
  }
  if (session?.mode === 'countdown') return Math.max(0, Number(session?.countdownSeconds || session?.initialSeconds || 0));
  return 0;
};

const isCountdown = (session, phase) => (
  phase === 'rest'
  || (session?.mode === 'pomodoro' && session?.variant !== 'simulado' && !session?.isSimulado)
  || session?.mode === 'countdown'
);

export const calculateLiveTimerSeconds = (session, nowMs = Date.now()) => {
  if (!session) return 0;
  const phase = getLiveTimerPhase(session);
  const finishedPhase = phase === 'pomodoro_finished' || phase === 'rest_finished';
  if (finishedPhase) return 0;

  const isPaused = Boolean(session.isPaused) || session.status === 'paused';
  const shouldRun = !isPaused && session.status !== 'finished' && session.status !== 'finishing';
  const baseMs = getElapsedBaseMs(session, phase);
  const startedMs = shouldRun ? getRemoteRunStartedMs(session, nowMs) : null;
  const elapsedMs = Math.max(0, baseMs + (startedMs ? Math.max(0, nowMs - startedMs) : 0));

  if (isCountdown(session, phase)) {
    const totalSeconds = countdownTotalSeconds(session, phase);
    if (totalSeconds <= 0) return getDisplaySnapshotSeconds(session);
    return Math.floor(Math.max(0, (totalSeconds * 1000) - elapsedMs) / 1000);
  }
  return Math.floor(elapsedMs / 1000);
};

export const formatLiveTimer = (totalSeconds = 0) => {
  const safeSeconds = Math.max(0, Math.floor(Number(totalSeconds) || 0));
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const seconds = safeSeconds % 60;
  return [hours, minutes, seconds].map((value) => String(value).padStart(2, '0')).join(':');
};

const TERMINAL_TIMER_STATUSES = new Set(['finished', 'finishing', 'stopped', 'cancelled']);

export const isMonitorableStudySession = (session, nowMs = Date.now()) => {
  if (!session) return false;
  const status = String(session.status || '').toLowerCase();
  if (TERMINAL_TIMER_STATUSES.has(status)) return false;
  const isPaused = session.isPaused === true || status === 'paused';
  const lastSeen = Math.max(
    timestampMs(session.heartbeatAt),
    timestampMs(session.updatedAt),
    timestampMs(session.snapshotAt),
  );
  return (status === 'running' || isPaused)
    && lastSeen > 0
    && nowMs - lastSeen <= 120000;
};

export const isLiveStudySession = (session, nowMs = Date.now()) => {
  const phase = getLiveTimerPhase(session);
  return isMonitorableStudySession(session, nowMs)
    && session?.status === 'running'
    && session?.isPaused !== true
    && phase !== 'rest'
    && phase !== 'rest_finished'
    && phase !== 'pomodoro_finished';
};

export const GROUP_MEMBER_STUDY_STATES = Object.freeze({
  STUDYING: 'studying',
  PAUSED: 'paused',
  OFFLINE: 'offline',
});

export const getGroupMemberStudyState = (session, nowMs = Date.now()) => {
  if (isLiveStudySession(session, nowMs)) return GROUP_MEMBER_STUDY_STATES.STUDYING;
  const paused = session?.status === 'paused' || session?.isPaused === true;
  if (paused && isMonitorableStudySession(session, nowMs)) return GROUP_MEMBER_STUDY_STATES.PAUSED;
  return GROUP_MEMBER_STUDY_STATES.OFFLINE;
};

export const sortGroupMembersByStudyState = (members = [], timers = {}, nowMs = Date.now()) => {
  const priority = {
    [GROUP_MEMBER_STUDY_STATES.STUDYING]: 0,
    [GROUP_MEMBER_STUDY_STATES.PAUSED]: 1,
    [GROUP_MEMBER_STUDY_STATES.OFFLINE]: 2,
  };
  return [...members].sort((a, b) => {
    const aId = a?.uid || a?.id;
    const bId = b?.uid || b?.id;
    const stateDifference = priority[getGroupMemberStudyState(timers?.[aId], nowMs)]
      - priority[getGroupMemberStudyState(timers?.[bId], nowMs)];
    if (stateDifference) return stateDifference;
    return String(a?.displayName || a?.name || aId || '').localeCompare(
      String(b?.displayName || b?.name || bId || ''),
      'pt-BR',
    );
  });
};

export const isLiveRankingMember = (member, nowMs = Date.now()) => isLiveStudySession({
  status: member?.liveStudy ? 'running' : 'stopped',
  phase: 'focus',
  isPaused: member?.liveStudy === false,
  heartbeatAt: member?.liveStudyHeartbeatAt,
}, nowMs);
