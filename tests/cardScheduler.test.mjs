import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CardScheduler,
  getCardScheduler,
  registerCardScheduler,
} from '../src/services/flashcards/cardScheduler.js';
import { QUALITY_RATINGS } from '../src/contracts/flashcards.js';

test('CardScheduler abstract class cannot be instantiated directly', () => {
  assert.throws(
    () => new CardScheduler('dummy', 1),
    /CardScheduler e uma classe abstrata/
  );
});

test('getCardScheduler factory returns the SM2 scheduler by default', () => {
  const scheduler = getCardScheduler('sm2');
  assert.ok(scheduler instanceof CardScheduler);
  assert.equal(scheduler.algorithm, 'sm2');
  assert.equal(scheduler.version, 2);
});

test('createInitialState produces versioned opaque state', () => {
  const scheduler = getCardScheduler('sm2');
  const initialState = scheduler.createInitialState();

  assert.equal(initialState.algorithm, 'sm2');
  assert.equal(initialState.version, 2);
  assert.ok(typeof initialState.data === 'object');
  assert.equal(initialState.data.phase, 'learning');
});

test('schedule processes all 4 semantic ratings without numeric exposure', () => {
  const scheduler = getCardScheduler('sm2');
  const state = scheduler.createInitialState();
  const baseTime = new Date('2026-08-28T12:00:00.000Z');

  for (const rating of QUALITY_RATINGS) {
    const result = scheduler.schedule(state, rating, { now: baseTime });

    assert.ok(result.nextState);
    assert.equal(result.nextState.algorithm, 'sm2');
    assert.ok(result.intervalDays > 0);
    assert.ok(result.dueAt instanceof Date);
    assert.ok(result.dueAt.getTime() > baseTime.getTime());
    // Card novo: Again retorna ao fluxo de aprendizagem (sem lapse)
    assert.equal(result.isLapse, false);
  }

  // Card consolidado em review (repetition >= 2): Again gera lapse real
  const reviewState = {
    algorithm: 'sm2',
    version: 1,
    data: { repetition: 2, interval: 6, easeFactor: 2.5 },
  };
  const againResult = scheduler.schedule(reviewState, 'again', { now: baseTime });
  assert.equal(againResult.isLapse, true);
  assert.equal(againResult.status, 'relearning');
});

test('schedule rejects invalid quality ratings', () => {
  const scheduler = getCardScheduler('sm2');
  const state = scheduler.createInitialState();

  assert.throws(
    () => scheduler.schedule(state, 'invalid_rating'),
    /Rating invalido/
  );
});

test('preview returns projections for all 4 ratings without side effects', () => {
  const scheduler = getCardScheduler('sm2');
  const state = scheduler.createInitialState();
  const baseTime = new Date('2026-08-28T12:00:00.000Z');

  const preview = scheduler.preview(state, { now: baseTime });

  assert.ok(preview.again);
  assert.ok(preview.hard);
  assert.ok(preview.good);
  assert.ok(preview.easy);

  assert.equal(preview.again.intervalMinutes, 1);
  assert.equal(preview.hard.intervalMinutes, 6);
  assert.equal(preview.good.intervalMinutes, 10);
  assert.equal(preview.easy.intervalMinutes, 3 * 24 * 60);

  assert.equal(preview.again.isLapse, false); // Card novo: nao e lapse
  assert.equal(preview.good.isLapse, false);
  assert.ok(preview.easy.intervalDays >= preview.good.intervalDays);

  // Preview de card em review
  const reviewPreview = scheduler.preview({
    algorithm: 'sm2',
    version: 1,
    data: { repetition: 3, interval: 15, easeFactor: 2.5 },
  }, { now: baseTime });
  assert.equal(reviewPreview.again.isLapse, true);
});

test('isDue correctly evaluates due dates', () => {
  const scheduler = getCardScheduler('sm2');
  const now = new Date('2026-08-28T12:00:00.000Z');

  const overdueCard = { dueAt: new Date('2026-08-27T12:00:00.000Z') };
  const dueNowCard = { dueAt: new Date('2026-08-28T12:00:00.000Z') };
  const futureCard = { dueAt: new Date('2026-08-29T12:00:00.000Z') };

  assert.equal(scheduler.isDue(overdueCard, now), true);
  assert.equal(scheduler.isDue(dueNowCard, now), true);
  assert.equal(scheduler.isDue(futureCard, now), false);
});

test('registerCardScheduler allows adding new algorithm implementations', () => {
  class CustomSchedulerStub extends CardScheduler {
    constructor() {
      super('fsrs_custom', 1);
    }
    createInitialState() {
      return { algorithm: 'fsrs_custom', version: 1, data: { stability: 1.0, difficulty: 5.0 } };
    }
    schedule(state, rating, options = {}) {
      const now = options.now ? new Date(options.now) : new Date();
      return {
        nextState: { algorithm: 'fsrs_custom', version: 1, data: { ...state.data, lastRating: rating } },
        intervalDays: rating === 'again' ? 1 : 4,
        dueAt: new Date(now.getTime() + (rating === 'again' ? 1 : 4) * 86400000),
        isLapse: rating === 'again',
        status: rating === 'again' ? 'relearning' : 'review',
      };
    }
  }

  registerCardScheduler('fsrs_custom', () => new CustomSchedulerStub());
  const custom = getCardScheduler('fsrs_custom');

  assert.equal(custom.algorithm, 'fsrs_custom');
  const initial = custom.createInitialState();
  assert.equal(initial.data.stability, 1.0);
});
