import test from 'node:test';
import assert from 'node:assert/strict';
import {
  QUALITY_RATINGS,
  CARD_STATUSES,
  CARD_SOURCE_TYPES,
  isValidQualityRating,
  isValidCardStatus,
} from '../src/contracts/flashcards.js';
import {
  getCardScheduler,
  registerCardScheduler,
  CardScheduler,
} from '../src/services/flashcards/cardScheduler.js';
import {
  mockCard,
  mockDeck,
} from './fixtures/qaFixtures.mjs';

test('QA Prepared [AGUARDANDO SONNET]: Flashcard contract schemas and types', () => {
  assert.deepEqual(QUALITY_RATINGS, ['again', 'hard', 'good', 'easy']);
  assert.deepEqual(CARD_STATUSES, ['new', 'learning', 'review', 'relearning']);
  assert.deepEqual(CARD_SOURCE_TYPES, ['manual', 'ai', 'anki', 'document']);

  // Validations
  assert.equal(isValidQualityRating('again'), true);
  assert.equal(isValidQualityRating('hard'), true);
  assert.equal(isValidQualityRating('good'), true);
  assert.equal(isValidQualityRating('easy'), true);
  assert.equal(isValidQualityRating('medium'), false); // Medium is for questions, not flashcards

  assert.equal(isValidCardStatus('new'), true);
  assert.equal(isValidCardStatus('learning'), true);
  assert.equal(isValidCardStatus('review'), true);
  assert.equal(isValidCardStatus('relearning'), true);
  assert.equal(isValidCardStatus('suspended'), false);
});

test('QA Prepared [AGUARDANDO SONNET]: CardScheduler Interface contract integrity', () => {
  const scheduler = getCardScheduler('sm2');
  assert.ok(scheduler instanceof CardScheduler);

  // createInitialState returns opaque versioned state
  const initialState = scheduler.createInitialState();
  assert.equal(initialState.algorithm, 'sm2');
  assert.equal(typeof initialState.version, 'number');
  assert.ok(initialState.data !== null && typeof initialState.data === 'object');

  // preview returns all 4 ratings
  const preview = scheduler.preview(initialState);
  assert.ok(preview.again);
  assert.ok(preview.hard);
  assert.ok(preview.good);
  assert.ok(preview.easy);

  for (const rating of QUALITY_RATINGS) {
    const outcome = preview[rating];
    assert.ok(outcome.nextState);
    assert.ok(typeof outcome.intervalDays === 'number');
    assert.ok(outcome.dueAt instanceof Date);
    assert.equal(typeof outcome.isLapse, 'boolean');
    assert.ok(CARD_STATUSES.includes(outcome.status));
  }
});

test('QA Prepared [AGUARDANDO SONNET]: Mock fixture adheres to Flashcard contract', () => {
  assert.equal(mockCard.deckId, mockDeck.id);
  assert.equal(mockCard.userId, mockDeck.userId);
  assert.ok(CARD_STATUSES.includes(mockCard.status));
  assert.ok(CARD_SOURCE_TYPES.includes(mockCard.sourceType));
  assert.equal(mockCard.schedulerState.algorithm, 'sm2');
  assert.ok(mockCard.dueAt instanceof Date);
  assert.ok(typeof mockCard.lapses === 'number');
  assert.ok(typeof mockCard.reps === 'number');
});
