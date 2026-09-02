import test from 'node:test';
import assert from 'node:assert/strict';
import {
  claimTimerHeartbeatLease,
  formatTimerClock,
  isValidTimerElapsedMs,
  parseTimerJson,
  reduceTimerState,
  releaseTimerHeartbeatLease,
} from '../src/hooks/useTimerEngine.js';

test('timer engine percorre iniciar, pausar, retomar e finalizar', () => {
  let state = reduceTimerState(undefined, { type: 'START' });
  state = reduceTimerState(state, { type: 'TICK', seconds: 30 });
  state = reduceTimerState(state, { type: 'PAUSE' });
  state = reduceTimerState(state, { type: 'TICK', seconds: 30 });
  assert.equal(state.elapsedSeconds, 30);
  state = reduceTimerState(state, { type: 'RESUME' });
  state = reduceTimerState(state, { type: 'TICK', seconds: 15 });
  state = reduceTimerState(state, { type: 'FINISH' });
  assert.deepEqual(state, { status: 'finished', elapsedSeconds: 45 });
});

test('heartbeat elege uma unica aba e libera a lideranca ao encerrar', () => {
  const values = new Map();
  const storage = {
    getItem: (key) => values.get(key) || null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
  };
  const input = { storage, key: 'heartbeat:user-1', now: 1000, ttlMs: 45000 };
  assert.equal(claimTimerHeartbeatLease({ ...input, ownerId: 'tab-a' }), true);
  assert.equal(claimTimerHeartbeatLease({ ...input, ownerId: 'tab-b', now: 2000 }), false);
  releaseTimerHeartbeatLease({ storage, key: input.key, ownerId: 'tab-a' });
  assert.equal(claimTimerHeartbeatLease({ ...input, ownerId: 'tab-b', now: 3000 }), true);
});

test('timer engine cancela e aplica estado remoto de outra aba', () => {
  const synced = reduceTimerState(
    { status: 'running', elapsedSeconds: 10 },
    { type: 'REMOTE_SYNC', state: { status: 'paused', elapsedSeconds: 52 } },
  );
  assert.deepEqual(synced, { status: 'paused', elapsedSeconds: 52 });
  assert.deepEqual(reduceTimerState(synced, { type: 'CANCEL' }), {
    status: 'cancelled',
    elapsedSeconds: 0,
  });
});

test('helpers do timer rejeitam epoch suspeito e formatam relógio', () => {
  assert.equal(formatTimerClock(3661), '01:01:01');
  assert.equal(isValidTimerElapsedMs(5000), true);
  assert.equal(isValidTimerElapsedMs(8 * 24 * 60 * 60 * 1000), false);
  assert.deepEqual(parseTimerJson('{"ok":true}'), { ok: true });
  assert.equal(parseTimerJson('{'), null);
});
