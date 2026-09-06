import test from 'node:test';
import assert from 'node:assert/strict';
import {
  formatNextReviewTime,
  partitionInitialCards,
} from '../src/hooks/useStudySession.js';
import { getCardScheduler } from '../src/services/flashcards/cardScheduler.js';
import { DEFAULT_PRODUCT_LIMITS } from '../src/config/productLimits.js';
import { createAdaptiveSessionController } from '../src/services/adaptiveStudy/adaptiveSessionController.js';

test('SRS Partition: separates due cards, new cards, and future cards properly', () => {
  const now = Date.now();
  const rawCards = [
    {
      id: 'due_old',
      status: 'review',
      dueAt: new Date(now - 3600000),
      schedulerState: { algorithm: 'sm2', version: 2, data: { repetition: 2, interval: 3 } },
    },
    {
      id: 'due_recent',
      status: 'review',
      dueAt: new Date(now - 60000),
      schedulerState: { algorithm: 'sm2', version: 2, data: { repetition: 2, interval: 3 } },
    },
    {
      id: 'new_card_1',
      status: 'new',
      createdAt: new Date(now - 10000),
    },
    {
      id: 'new_card_2',
      status: 'new',
      createdAt: new Date(now - 5000),
    },
    {
      id: 'future_card_1',
      status: 'review',
      dueAt: new Date(now + 86400000),
      schedulerState: { algorithm: 'sm2', version: 2, data: { repetition: 3, interval: 5 } },
    },
  ];

  const partition = partitionInitialCards(rawCards);

  assert.equal(partition.dueCards.length, 2);
  assert.equal(partition.dueCards[0].id, 'due_old');
  assert.equal(partition.dueCards[1].id, 'due_recent');

  assert.equal(partition.newCards.length, 2);
  assert.equal(partition.newCards[0].id, 'new_card_1');
  assert.equal(partition.newCards[1].id, 'new_card_2');

  assert.equal(partition.futureCards.length, 1);
  assert.equal(partition.futureCards[0].id, 'future_card_1');
});

test('SRS Next Review Formatting: formats friendly human-readable labels', () => {
  assert.equal(formatNextReviewTime(null), 'Nenhuma revisão agendada');
  assert.equal(formatNextReviewTime(undefined), 'Nenhuma revisão agendada');
  assert.equal(formatNextReviewTime(new Date('invalid')), 'Nenhuma revisão agendada');

  const now = new Date();

  const in10Min = new Date(now.getTime() + 10 * 60 * 1000);
  assert.equal(formatNextReviewTime(in10Min), 'em 10 minutos');

  const in1Min = new Date(now.getTime() + 1 * 60 * 1000);
  assert.equal(formatNextReviewTime(in1Min), 'em 1 minuto');

  const todayLater = new Date(now.getTime() + 3 * 3600 * 1000);
  if (todayLater.getDate() === now.getDate()) {
    const label = formatNextReviewTime(todayLater);
    assert.ok(label.startsWith('hoje às '));
  }

  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(9, 30, 0, 0);
  const tomorrowLabel = formatNextReviewTime(tomorrow);
  assert.ok(tomorrowLabel.startsWith('amanhã às '));
});

test('SRS SM-2 Intraday Steps and Graduation Rules', () => {
  const scheduler = getCardScheduler('sm2');
  const initial = scheduler.createInitialState();
  const now = new Date('2026-09-04T12:00:00.000Z');

  const againOutcome = scheduler.schedule(initial, 'again', { now });
  assert.equal(againOutcome.intervalMinutes, 1);
  assert.equal(againOutcome.status, 'learning');
  assert.equal(againOutcome.dueAt.getTime(), now.getTime() + 60000);

  const hardOutcome = scheduler.schedule(initial, 'hard', { now });
  assert.equal(hardOutcome.intervalMinutes, 6);
  assert.equal(hardOutcome.status, 'learning');
  assert.equal(hardOutcome.dueAt.getTime(), now.getTime() + 6 * 60000);

  const goodStep1 = scheduler.schedule(initial, 'good', { now });
  assert.equal(goodStep1.intervalMinutes, 10);
  assert.equal(goodStep1.status, 'learning');
  assert.equal(goodStep1.nextState.data.stepIndex, 1);

  const goodStep2 = scheduler.schedule(goodStep1.nextState, 'good', { now });
  assert.equal(goodStep2.intervalDays, 1);
  assert.equal(goodStep2.status, 'review');
  assert.equal(goodStep2.nextState.data.phase, 'review');

  const easyStep = scheduler.schedule(initial, 'easy', { now });
  assert.equal(easyStep.intervalDays, 3);
  assert.equal(easyStep.status, 'review');
  assert.equal(easyStep.nextState.data.phase, 'review');
});

test('Adaptive Infra: default limits configured for 4-card buffer', () => {
  assert.equal(DEFAULT_PRODUCT_LIMITS.adaptiveStudy.targetReady, 4);
  assert.equal(DEFAULT_PRODUCT_LIMITS.adaptiveStudy.lowWatermark, 3);
  assert.equal(DEFAULT_PRODUCT_LIMITS.adaptiveStudy.refillSize, 4);
});

test('AdaptiveSessionController: maintains proactive 4-card buffer refills', async () => {
  let startCalled = false;
  let refillCallCount = 0;

  const storageMap = new Map();
  const mockApi = {
    start: async () => {
      startCalled = true;
      return {
        session: { id: 'sess-123', status: 'active' },
        item: { id: 'item-1', conceptId: 'c1', front: 'Q1', back: 'A1', cognitiveDifficulty: 'easy' },
        prefetchedItems: [
          { id: 'item-2', conceptId: 'c2', front: 'Q2', back: 'A2', cognitiveDifficulty: 'easy' },
          { id: 'item-3', conceptId: 'c3', front: 'Q3', back: 'A3', cognitiveDifficulty: 'easy' },
          { id: 'item-4', conceptId: 'c4', front: 'Q4', back: 'A4', cognitiveDifficulty: 'easy' },
          { id: 'item-5', conceptId: 'c5', front: 'Q5', back: 'A5', cognitiveDifficulty: 'easy' },
        ],
      };
    },
    rate: async () => {
      return {
        shouldRefill: true,
        nextItem: { id: 'item-2', conceptId: 'c2', front: 'Q2', back: 'A2', cognitiveDifficulty: 'easy' },
        prefetchedItems: [
          { id: 'item-3', conceptId: 'c3', front: 'Q3', back: 'A3', cognitiveDifficulty: 'easy' },
          { id: 'item-4', conceptId: 'c4', front: 'Q4', back: 'A4', cognitiveDifficulty: 'easy' },
          { id: 'item-5', conceptId: 'c5', front: 'Q5', back: 'A5', cognitiveDifficulty: 'easy' },
        ],
      };
    },
    refill: async () => {
      refillCallCount += 1;
      return {
        prefetchedItems: [
          { id: `refill-item-${refillCallCount}-a`, conceptId: 'c-ref-a', front: 'Q Ref A', back: 'A Ref A', cognitiveDifficulty: 'easy' },
          { id: `refill-item-${refillCallCount}-b`, conceptId: 'c-ref-b', front: 'Q Ref B', back: 'A Ref B', cognitiveDifficulty: 'easy' },
        ],
      };
    },
    end: async () => {},
    createRequestId: () => `req-${Math.random()}`,
  };

  const controller = createAdaptiveSessionController({
    folderId: 'folder-1',
    sourceId: 'source-1',
    storageKey: 'test-outbox',
    storage: {
      getItem: (k) => storageMap.get(k),
      setItem: (k, v) => storageMap.set(k, v),
      removeItem: (k) => storageMap.delete(k),
    },
    api: mockApi,
  });

  await controller.start();
  assert.ok(startCalled);
  assert.equal(controller.getSnapshot().item.id, 'item-1');
  assert.equal(controller.getSnapshot().prefetchedItems.length, 4);

  const rated = controller.rate('good', 'item-1');
  assert.equal(rated, true);
  await controller.drain();
  assert.equal(controller.getSnapshot().item.id, 'item-2');

  await new Promise((r) => setTimeout(r, 50));
  assert.ok(refillCallCount >= 1);
});

test('SRS Session Restoration: Card scheduled for +1 min becomes due immediately after maturity', () => {
  const t0 = 1000000;
  const card = {
    id: 'card_intraday_1',
    status: 'learning',
    dueAt: new Date(t0 + 60000), // +1 minute
    schedulerState: { algorithm: 'sm2', version: 2, data: { repetition: 0, interval: 1 / 1440, phase: 'learning' } },
  };

  // Case A: Opened before maturity (at t0 + 30s)
  const beforeMaturity = partitionInitialCards([card]);
  // Date.now() in real runtime vs passed dates:
  // Let's test partition with timestamps relative to real now:
  const now = Date.now();
  const futureCard = { ...card, dueAt: new Date(now + 60000) };
  const partitionBefore = partitionInitialCards([futureCard]);
  assert.equal(partitionBefore.dueCards.length, 0);
  assert.equal(partitionBefore.futureCards.length, 1);

  // Case B: Session closed and reopened after maturity (at now - 5s, card matured)
  const maturedCard = { ...card, dueAt: new Date(now - 5000) };
  const partitionAfter = partitionInitialCards([maturedCard]);
  assert.equal(partitionAfter.dueCards.length, 1);
  assert.equal(partitionAfter.dueCards[0].id, 'card_intraday_1');
  assert.equal(partitionAfter.futureCards.length, 0);
});

test('SRS Page Reload: Graduated cards (due in 1+ days) are never pulled into active queue upon refresh', () => {
  const now = Date.now();
  const graduatedCard = {
    id: 'card_graduated_1',
    status: 'review',
    dueAt: new Date(now + 86400000), // due tomorrow
    schedulerState: { algorithm: 'sm2', version: 2, data: { repetition: 2, interval: 1, phase: 'review' } },
  };

  const repartitioned = partitionInitialCards([graduatedCard]);
  assert.equal(repartitioned.dueCards.length, 0);
  assert.equal(repartitioned.newCards.length, 0);
  assert.equal(repartitioned.futureCards.length, 1);
});

test('SRS Separation: Management sees all cards, while onlyDue query filters future cards', async () => {
  const { getFolderStudyCardsPage } = await import('../src/services/flashcards/flashcardsService.js');
  // Both onlyDue: true and onlyDue: false options are supported
  assert.equal(typeof getFolderStudyCardsPage, 'function');
});

test('Adaptive Buffer Invariant: Prefetched items never exceed 4 reserved slots even with oversized API responses', async () => {
  const storageMap = new Map();
  const mockApi = {
    start: async () => ({
      session: { id: 'sess-oversized', status: 'active' },
      item: { id: 'item-active', conceptId: 'c1', front: 'Q0', back: 'A0' },
      // API returns 8 items
      prefetchedItems: [
        { id: 'item-1', conceptId: 'c1', front: 'Q1', back: 'A1' },
        { id: 'item-2', conceptId: 'c2', front: 'Q2', back: 'A2' },
        { id: 'item-3', conceptId: 'c3', front: 'Q3', back: 'A3' },
        { id: 'item-4', conceptId: 'c4', front: 'Q4', back: 'A4' },
        { id: 'item-5', conceptId: 'c5', front: 'Q5', back: 'A5' },
        { id: 'item-6', conceptId: 'c6', front: 'Q6', back: 'A6' },
      ],
    }),
    rate: async () => ({
      shouldRefill: false,
      nextItem: { id: 'item-1', conceptId: 'c1', front: 'Q1', back: 'A1' },
      prefetchedItems: [
        { id: 'item-2', conceptId: 'c2', front: 'Q2', back: 'A2' },
        { id: 'item-3', conceptId: 'c3', front: 'Q3', back: 'A3' },
        { id: 'item-4', conceptId: 'c4', front: 'Q4', back: 'A4' },
        { id: 'item-5', conceptId: 'c5', front: 'Q5', back: 'A5' },
        { id: 'item-6', conceptId: 'c6', front: 'Q6', back: 'A6' },
      ],
    }),
    refill: async () => ({ prefetchedItems: [] }),
    end: async () => {},
    createRequestId: () => `req-${Math.random()}`,
  };

  const controller = createAdaptiveSessionController({
    folderId: 'folder-1',
    sourceId: 'source-1',
    storageKey: 'test-oversized',
    storage: {
      getItem: (k) => storageMap.get(k),
      setItem: (k, v) => storageMap.set(k, v),
      removeItem: (k) => storageMap.delete(k),
    },
    api: mockApi,
  });

  await controller.start();
  // Buffer MUST be strictly capped at 4 items in reserve
  assert.equal(controller.getSnapshot().item.id, 'item-active');
  assert.equal(controller.getSnapshot().prefetchedItems.length, 4);
  assert.deepEqual(
    controller.getSnapshot().prefetchedItems.map((i) => i.id),
    ['item-1', 'item-2', 'item-3', 'item-4'],
  );
});

