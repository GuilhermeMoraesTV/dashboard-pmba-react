import test from 'node:test';
import assert from 'node:assert/strict';
import { createAdaptiveSessionController } from '../src/services/adaptiveStudy/adaptiveSessionController.js';

const deferred = () => {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
};
const tick = () => new Promise((resolve) => setImmediate(resolve));
const item = (id) => ({ id, sessionId: 'session', front: id, back: `Resposta ${id}` });
function harness(overrides = {}, storage = new Map()) {
  const calls = { start: 0, rate: [], refill: 0, end: 0 };
  const api = {
    start: async () => { calls.start++; return { session: { id: 'session' }, item: item('A'), prefetchedItems: [item('B')] }; },
    rate: async (task) => { calls.rate.push(task); return {}; },
    refill: async () => { calls.refill++; return { item: item('C'), prefetchedItems: [item('D')] }; },
    end: async () => { calls.end++; },
    createRequestId: () => `request-${Math.random()}`,
    ...overrides,
  };
  const options = { api, folderId: 'folder', sourceId: 'source', storageKey: 'outbox', storage: {
    getItem: (key) => storage.get(key), setItem: (key, value) => storage.set(key, value), removeItem: (key) => storage.delete(key),
  } };
  return { controller: createAdaptiveSessionController(options), calls, options, storage };
}

test('P0 lifecycle: cleanup/remount retains one start, one queue and accepted rating delivery', async () => {
  const { controller: c, calls } = harness();
  let renders = 0;
  const unsubscribe = c.subscribe(() => renders++);
  await c.start();
  unsubscribe();
  c.subscribe(() => renders++);
  await c.start();
  c.rate('good', 'A');
  await c.drain();
  assert.equal(calls.start, 1);
  assert.equal(calls.rate.length, 1);
  assert.equal(c.getSnapshot().pendingSyncCount, 0);
  assert.ok(renders > 0);
});

test('P0 stale responses: delayed refill AND reviews cannot restore rapidly answered A/B', async () => {
  const refill = deferred(), first = deferred(), second = deferred();
  const sent = [];
  const { controller: c } = harness({ refill: () => refill.promise, rate: (task) => {
    sent.push(task); return sent.length === 1 ? first.promise : second.promise;
  } });
  await c.start();
  const refillPending = c.refill();
  assert.equal(c.rate('good', 'A'), true);
  assert.equal(c.rate('easy', 'B'), true);
  assert.equal(c.rate('easy', 'B'), false);
  await tick();
  refill.resolve({ item: item('A'), prefetchedItems: [item('B')] });
  await refillPending;
  assert.equal(c.getSnapshot().item, null);
  assert.deepEqual(c.getSnapshot().prefetchedItems, []);
  first.resolve({ nextItem: item('B'), prefetchedItems: [item('A')] });
  await tick();
  assert.equal(c.getSnapshot().item, null);
  second.resolve({ nextItem: item('C'), prefetchedItems: [item('B'), item('D')] });
  await c.drain();
  assert.equal(c.getSnapshot().item.id, 'C');
  assert.deepEqual(c.getSnapshot().prefetchedItems.map((v) => v.id), ['D']);
  assert.deepEqual(sent.map((v) => v.itemId), ['A', 'B']);
});

test('P0 end: all accepted ratings reconcile before cancellation, even with view detached', async () => {
  const first = deferred(), second = deferred();
  const order = [];
  const { controller: c } = harness({ rate: async (task) => {
    order.push(task.itemId); return task.itemId === 'A' ? first.promise : second.promise;
  }, end: async () => order.push('end') });
  await c.start();
  c.rate('good', 'A'); c.rate('hard', 'B');
  const finish = c.end();
  await tick();
  assert.deepEqual(order, ['A']);
  assert.equal(c.getSnapshot().ending, true);
  first.resolve({ nextItem: item('B') });
  await tick();
  assert.deepEqual(order, ['A', 'B']);
  second.resolve({});
  assert.equal(await finish, true);
  assert.deepEqual(order, ['A', 'B', 'end']);
  assert.equal(c.getSnapshot().ended, true);
  assert.equal(c.getSnapshot().pendingSyncCount, 0);
});

test('P0 end failure: permanent review failure is not retried or cancelled; explicit retry uses same ID', async () => {
  let fail = true;
  const sent = [];
  const { controller: c, calls } = harness({ rate: async (task) => {
    sent.push(task);
    if (fail) throw Object.assign(new Error('Falha permanente'), { code: 'functions/permission-denied' });
    return {};
  } });
  await c.start();
  c.rate('again', 'A');
  assert.equal(await c.end(), false);
  assert.equal(sent.length, 1);
  assert.equal(calls.end, 0);
  assert.equal(c.getSnapshot().pendingSyncCount, 1);
  assert.match(c.getSnapshot().syncError, /Falha permanente/);
  assert.equal(c.rate('good', 'B'), false, 'new ratings cannot implicitly retry a permanent failure');
  assert.equal(sent.length, 1);
  fail = false;
  assert.equal(await c.end(), true);
  assert.equal(sent[1].reviewRequestId, sent[0].reviewRequestId);
  assert.equal(calls.end, 1);
});

test('transient rating retry is bounded to one, retaining reviewRequestId', async () => {
  const sent = [];
  const { controller: c } = harness({ rate: async (task) => {
    sent.push(task);
    throw Object.assign(new Error('Offline'), { code: 'functions/unavailable' });
  } });
  await c.start(); c.rate('good', 'A');
  assert.equal(await c.drain(), false);
  assert.equal(sent.length, 2);
  assert.deepEqual(sent[0], sent[1]);
});

test('P0 empty buffer: busy, permanent error and no output surface an actionable state without polling', async () => {
  for (const response of [{ refill: { busy: true } }, {}, new Error('Limite de IA atingido')]) {
    let refills = 0;
    const { controller: c } = harness({ refill: async () => { refills++; if (response instanceof Error) throw response; return response; } });
    await c.start(); c.rate('good', 'A'); c.rate('good', 'B');
    await c.drain(); await tick();
    assert.equal(c.getSnapshot().item, null);
    assert.equal(c.getSnapshot().refilling, false);
    assert.ok(c.getSnapshot().bufferError);
    await tick();
    assert.equal(refills, 1, 'no automatic loop or retry of generation');
  }
});

test('reload recovers lost acknowledgement using durable request ID and local exclusion set', async () => {
  const lostResponse = deferred();
  const { controller: first, options, storage } = harness({ rate: () => lostResponse.promise });
  await first.start(); first.rate('good', 'A'); await tick();
  const persisted = JSON.parse(storage.get('outbox'));
  assert.equal(persisted.queue.length, 1);
  const sent = [];
  const reloaded = createAdaptiveSessionController({ ...options, api: { ...options.api,
    start: () => assert.fail('reload must not start another session'),
    rate: async (task) => { sent.push(task); return { duplicate: true, nextItem: item('A'), prefetchedItems: [item('B')] }; },
  } });
  await reloaded.start(); await reloaded.drain();
  assert.equal(sent[0].reviewRequestId, persisted.queue[0].reviewRequestId);
  assert.equal(reloaded.getSnapshot().item.id, 'B');
  assert.equal(reloaded.getSnapshot().pendingSyncCount, 0);
  assert.equal(await reloaded.end(), true);
  assert.equal(storage.has('outbox'), false);
  const restarted = createAdaptiveSessionController(options);
  await restarted.start();
  assert.equal(restarted.getSnapshot().answered, 0);
  assert.equal(restarted.getSnapshot().item.id, 'A');
});

test('slow ratings: no eager refill before acknowledgement; one logical rating and bounded refill', async () => {
  const pending = deferred();
  const { controller: c, calls } = harness({ rate: () => pending.promise });
  await c.start(); c.rate('good', 'A'); await tick();
  assert.equal(c.getSnapshot().item.id, 'B');
  assert.equal(calls.refill, 0);
  pending.resolve({ shouldRefill: true, nextItem: item('B') });
  await c.drain(); await tick();
  assert.equal(calls.refill, 1);
  assert.deepEqual(c.getSnapshot().prefetchedItems.map((v) => v.id), ['C', 'D']);
});

test('exit while starting waits for session ID and cancels exactly once', async () => {
  const pending = deferred();
  const { controller: c, calls } = harness({ start: () => pending.promise });
  void c.start();
  const first = c.end(), second = c.end();
  assert.equal(first, second);
  pending.resolve({ session: { id: 'session' }, item: item('A') });
  assert.equal(await first, true);
  assert.equal(calls.end, 1);
  assert.equal(calls.refill, 0);
});

test('P0 end acknowledgement lost: no new rating can be accepted on a possibly cancelled session, including reload', async () => {
  let ends = 0;
  const { controller: c, options } = harness({ end: async () => {
    ends++;
    throw Object.assign(new Error('Resposta do encerramento perdida'), { code: 'functions/unavailable' });
  } });
  await c.start();
  assert.equal(await c.end(), false);
  assert.equal(ends, 2);
  assert.equal(c.rate('good', 'A'), false);
  const reloaded = createAdaptiveSessionController({ ...options, api: { ...options.api, end: async () => { ends++; } } });
  await reloaded.start();
  assert.equal(reloaded.rate('good', 'A'), false);
  assert.equal(await reloaded.end(), true);
  assert.equal(ends, 3);
});
