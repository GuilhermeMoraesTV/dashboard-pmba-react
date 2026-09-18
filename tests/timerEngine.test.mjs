import test from 'node:test';
import assert from 'node:assert/strict';
import {
  claimTimerHeartbeatLease,
  formatTimerClock,
  deriveRestoredTimerState,
  isValidTimerElapsedMs,
  parseTimerJson,
  reduceTimerState,
  releaseTimerHeartbeatLease,
} from '../src/hooks/useTimerEngine.js';

test('restaura imediatamente um cronometro livre em andamento', () => {
  const restored = deriveRestoredTimerState({
    status: 'running',
    mode: 'free',
    phase: 'focus',
    isPaused: false,
    focusBaseMs: 12000,
    runStartedAtMs: 100000,
  }, 108900);

  assert.equal(restored.displaySeconds, 20);
  assert.equal(restored.isRunning, true);
  assert.equal(restored.isPaused, false);
});

test('restaura imediatamente pomodoro, descanso e cronometro regressivo', () => {
  const pomodoro = deriveRestoredTimerState({
    status: 'running', mode: 'pomodoro', phase: 'focus',
    pomodoroSeconds: 1500, pomoBaseMs: 10000, runStartedAtMs: 100000,
  }, 105000);
  const rest = deriveRestoredTimerState({
    status: 'running', mode: 'pomodoro', phase: 'rest',
    restSeconds: 300, restBaseMs: 20000, runStartedAtMs: 100000,
  }, 105000);
  const countdownTimer = deriveRestoredTimerState({
    status: 'paused', mode: 'countdown', phase: 'focus', isPaused: true,
    countdownSeconds: 60, focusBaseMs: 17000,
  }, 105000);

  assert.equal(pomodoro.displaySeconds, 1485);
  assert.equal(rest.displaySeconds, 275);
  assert.equal(countdownTimer.displaySeconds, 43);
  assert.equal(countdownTimer.isPaused, true);
});

test('restaura pelo cache local antes da leitura remota', () => {
  const restored = deriveRestoredTimerState({
    schemaVersion: 8,
    disciplinaId: 'disc-1',
    mode: 'free',
    isPaused: false,
    focusAccumulatedMs: 42000,
    focusBlockElapsedBaseMs: 42000,
    lastTimestamp: 100000,
  }, 103500);

  assert.equal(restored.displaySeconds, 45);
  assert.equal(restored.focusElapsedMs, 45500);
  assert.equal(restored.isRunning, true);
});

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
  const input = { storage, key: 'heartbeat:user-1', now: 1000, ttlMs: 75000 };
  assert.equal(claimTimerHeartbeatLease({ ...input, ownerId: 'tab-a' }), true);
  assert.equal(claimTimerHeartbeatLease({ ...input, ownerId: 'tab-b', now: 2000 }), false);
  releaseTimerHeartbeatLease({ storage, key: input.key, ownerId: 'tab-a' });
  assert.equal(claimTimerHeartbeatLease({ ...input, ownerId: 'tab-b', now: 3000 }), true);
});

test('multi-tab lease: Cenário 1 - Operação normal de renovação periódica a cada 30s', () => {
  const values = new Map();
  const storage = {
    getItem: (key) => values.get(key) || null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
  };
  const key = 'heartbeat:user-1';

  // t = 0s: Tab A assume liderança (lease válido até t = 75s)
  assert.equal(claimTimerHeartbeatLease({ storage, key, ownerId: 'tab-a', now: 0 }), true);

  // Tab B tenta liderança em t = 10s -> rejeitado
  assert.equal(claimTimerHeartbeatLease({ storage, key, ownerId: 'tab-b', now: 10_000 }), false);

  // t = 30s: Tab A renova o lease (válido até t = 105s)
  assert.equal(claimTimerHeartbeatLease({ storage, key, ownerId: 'tab-a', now: 30_000 }), true);

  // Tab B tenta liderança em t = 45s -> rejeitado
  assert.equal(claimTimerHeartbeatLease({ storage, key, ownerId: 'tab-b', now: 45_000 }), false);

  // t = 60s: Tab A renova o lease (válido até t = 135s)
  assert.equal(claimTimerHeartbeatLease({ storage, key, ownerId: 'tab-a', now: 60_000 }), true);
  assert.equal(claimTimerHeartbeatLease({ storage, key, ownerId: 'tab-b', now: 70_000 }), false);
});

test('multi-tab lease: Cenário 2 - Um heartbeat atrasado (30s atrasado para 45s)', () => {
  const values = new Map();
  const storage = {
    getItem: (key) => values.get(key) || null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
  };
  const key = 'heartbeat:user-1';

  // t = 0s: Tab A inicia (lease até t = 75s)
  assert.equal(claimTimerHeartbeatLease({ storage, key, ownerId: 'tab-a', now: 0 }), true);

  // Em t = 30s, Tab A sofre atraso e não dispara.
  // Tab B tenta em t = 35s, 40s, 44s -> rejeitado porque 75s > now
  assert.equal(claimTimerHeartbeatLease({ storage, key, ownerId: 'tab-b', now: 35_000 }), false);
  assert.equal(claimTimerHeartbeatLease({ storage, key, ownerId: 'tab-b', now: 44_000 }), false);

  // t = 45s: Tab A atrasada finalmente executa e renova o lease (válido até t = 120s)
  assert.equal(claimTimerHeartbeatLease({ storage, key, ownerId: 'tab-a', now: 45_000 }), true);
  assert.equal(claimTimerHeartbeatLease({ storage, key, ownerId: 'tab-b', now: 50_000 }), false);
});

test('multi-tab lease: Cenário 3 - Heartbeat completamente perdido no ciclo de 30s', () => {
  const values = new Map();
  const storage = {
    getItem: (key) => values.get(key) || null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
  };
  const key = 'heartbeat:user-1';

  // t = 0s: Tab A inicia (lease até t = 75s)
  assert.equal(claimTimerHeartbeatLease({ storage, key, ownerId: 'tab-a', now: 0 }), true);

  // Heartbeat de 30s é 100% perdido (ex: falha de rede temporária / heavy GC).
  // Tab B tenta em t = 35s, 50s, 59s -> rejeitado
  assert.equal(claimTimerHeartbeatLease({ storage, key, ownerId: 'tab-b', now: 35_000 }), false);
  assert.equal(claimTimerHeartbeatLease({ storage, key, ownerId: 'tab-b', now: 59_000 }), false);

  // t = 60s: Próximo ciclo nominal de Tab A executa (60s < 75s expiração)
  // Tab A renova com sucesso para t = 60s + 75s = 135s
  assert.equal(claimTimerHeartbeatLease({ storage, key, ownerId: 'tab-a', now: 60_000 }), true);
  assert.equal(claimTimerHeartbeatLease({ storage, key, ownerId: 'tab-b', now: 65_000 }), false);
});

test('multi-tab lease: Cenário 4 - Fechamento limpo vs Crash abrupto da aba líder', () => {
  const values = new Map();
  const storage = {
    getItem: (key) => values.get(key) || null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
  };
  const key = 'heartbeat:user-1';

  // Parte A: Fechamento limpo da Tab A
  assert.equal(claimTimerHeartbeatLease({ storage, key, ownerId: 'tab-a', now: 0 }), true);
  releaseTimerHeartbeatLease({ storage, key, ownerId: 'tab-a' });
  // Tab B assume instantaneamente (0ms de espera)
  assert.equal(claimTimerHeartbeatLease({ storage, key, ownerId: 'tab-b', now: 100 }), true);

  // Parte B: Crash abrupto da Tab B (sem unmount/cleanup)
  // Lease de Tab B expira em t = 100 + 75_000 = 75_100ms
  // Tab C tenta antes da expiração -> rejeitado
  assert.equal(claimTimerHeartbeatLease({ storage, key, ownerId: 'tab-c', now: 50_000 }), false);
  // Tab C tenta após expiração (t = 76_000ms < 120_000ms timeout de presença) -> assume liderança!
  assert.equal(claimTimerHeartbeatLease({ storage, key, ownerId: 'tab-c', now: 76_000 }), true);
});

test('multi-tab lease: Cenário 5 e 6 - Concorrência simultânea e Background Tab Jitter', () => {
  const values = new Map();
  const storage = {
    getItem: (key) => values.get(key) || null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
  };
  const key = 'heartbeat:user-1';

  // Cenário 5: Tentativa simultânea no mesmo timestamp t = 0
  assert.equal(claimTimerHeartbeatLease({ storage, key, ownerId: 'tab-a', now: 0 }), true);
  assert.equal(claimTimerHeartbeatLease({ storage, key, ownerId: 'tab-b', now: 0 }), false);

  // Cenário 6: Background tab throttling (intervalo de 30s sofre jitter de até 50s)
  // t = 50s: Tab A em background executa com atraso (50s < 75s)
  assert.equal(claimTimerHeartbeatLease({ storage, key, ownerId: 'tab-a', now: 50_000 }), true);
  // Renovado até t = 125s
  assert.equal(claimTimerHeartbeatLease({ storage, key, ownerId: 'tab-b', now: 60_000 }), false);
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
