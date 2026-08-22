import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateLiveTimerSeconds,
  formatLiveTimer,
  isLiveStudySession,
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
