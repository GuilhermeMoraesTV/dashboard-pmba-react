import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateLiveTimerSeconds,
  formatLiveTimer,
  getGroupMemberStudyState,
  GROUP_MEMBER_STUDY_STATES,
  isMonitorableStudySession,
  isLiveRankingMember,
  isLiveStudySession,
  sortGroupMembersByStudyState,
} from '../src/utils/liveStudyTimer.js';

const now = Date.parse('2026-08-20T15:00:10.000Z');

test('cronômetro ao vivo soma a base e o trecho remoto em execução', () => {
  const seconds = calculateLiveTimerSeconds({
    status: 'running',
    mode: 'free',
    focusBaseMs: 65_000,
    runStartedAtMs: now - 5_000,
  }, now);
  assert.equal(seconds, 70);
  assert.equal(formatLiveTimer(seconds), '00:01:10');
});

test('ranking só mostra presença projetada com heartbeat recente', () => {
  assert.equal(isLiveRankingMember({
    liveStudy: true,
    liveStudyHeartbeatAt: new Date(now - 30_000),
  }, now), true);
  assert.equal(isLiveRankingMember({
    liveStudy: true,
    liveStudyHeartbeatAt: new Date(now - 121_000),
  }, now), false);
  assert.equal(isLiveRankingMember({
    liveStudy: false,
    liveStudyHeartbeatAt: new Date(now - 10_000),
  }, now), false);
  assert.equal(isLiveRankingMember({ liveStudy: true }, now), false);
});

test('pomodoro exibe contagem regressiva como o monitor do admin', () => {
  const seconds = calculateLiveTimerSeconds({
    status: 'running',
    mode: 'pomodoro',
    variant: 'study',
    pomodoroSeconds: 25 * 60,
    pomoBaseMs: 60_000,
    runStartedAtMs: now - 5_000,
  }, now);
  assert.equal(seconds, 1435);
  assert.equal(formatLiveTimer(seconds), '00:23:55');
});

test('sessão estudando agora exige foco, execução e heartbeat recente', () => {
  assert.equal(isLiveStudySession({ status: 'running', phase: 'focus', updatedAt: new Date(now - 30_000) }, now), true);
  assert.equal(isLiveStudySession({ status: 'running', phase: 'rest', updatedAt: new Date(now - 30_000) }, now), false);
  assert.equal(isLiveStudySession({ status: 'paused', phase: 'focus', updatedAt: new Date(now - 30_000) }, now), false);
  assert.equal(isLiveStudySession({ status: 'running', phase: 'focus', updatedAt: new Date(now - 121_000) }, now), false);
});

test('membros do grupo preservam pausados e priorizam quem esta estudando', () => {
  const members = [
    { uid: 'offline', displayName: 'Ana' },
    { uid: 'paused', displayName: 'Bruno' },
    { uid: 'studying', displayName: 'Carlos' },
  ];
  const timers = {
    paused: { status: 'paused', isPaused: true, phase: 'focus', updatedAt: new Date(now - 30_000) },
    studying: { status: 'running', phase: 'focus', updatedAt: new Date(now - 30_000) },
  };

  assert.equal(getGroupMemberStudyState(timers.studying, now), 'studying');
  assert.equal(getGroupMemberStudyState(timers.paused, now), 'paused');
  assert.equal(getGroupMemberStudyState(null, now), 'offline');
  assert.deepEqual(sortGroupMembersByStudyState(members, timers, now).map((member) => member.uid), [
    'studying',
    'paused',
    'offline',
  ]);
});

test('monitoramento e grupo descartam timer pausado sem presença recente', () => {
  const now = Date.parse('2026-08-27T12:00:00.000Z');
  const recentPaused = {
    status: 'paused',
    isPaused: true,
    updatedAt: new Date(now - 30_000),
    displaySecondsSnapshot: 120,
  };
  const stalePaused = { ...recentPaused, updatedAt: new Date(now - (15 * 60 * 1000)) };
  assert.equal(isMonitorableStudySession(recentPaused, now), true);
  assert.equal(getGroupMemberStudyState(recentPaused, now), GROUP_MEMBER_STUDY_STATES.PAUSED);
  assert.equal(isMonitorableStudySession(stalePaused, now), false);
  assert.equal(getGroupMemberStudyState(stalePaused, now), GROUP_MEMBER_STUDY_STATES.OFFLINE);
  assert.equal(isMonitorableStudySession({ ...recentPaused, status: 'finished' }, now), false);
});
