import test from 'node:test';
import assert from 'node:assert/strict';
import {
  QUALITY_RATINGS,
  CARD_STATUSES,
  isValidQualityRating,
  isValidCardStatus,
  QUESTION_SCOPES,
  QUESTION_DIFFICULTIES,
  isValidQuestionScope,
  ERROR_BOOK_SOURCE_TYPES,
  buildErrorBookEntryId,
  isValidErrorBookSourceType,
  DOCUMENT_FILE_TYPES,
  DOCUMENT_STATUSES,
  isValidDocumentFileType,
  AI_SURFACES,
} from '../src/contracts/index.js';
import { reviewCard } from '../src/services/flashcards/flashcardsService.js';

test('Flashcards contracts constants and validators', () => {
  assert.deepEqual(QUALITY_RATINGS, ['again', 'hard', 'good', 'easy']);
  assert.deepEqual(CARD_STATUSES, ['new', 'learning', 'review', 'relearning']);

  assert.equal(isValidQualityRating('again'), true);
  assert.equal(isValidQualityRating('easy'), true);
  assert.equal(isValidQualityRating('unknown'), false);
  assert.equal(isValidQualityRating(5), false);

  assert.equal(isValidCardStatus('new'), true);
  assert.equal(isValidCardStatus('relearning'), true);
  assert.equal(isValidCardStatus('archived'), false);
});

test('Questions contracts constants and validators', () => {
  assert.deepEqual(QUESTION_SCOPES, ['global', 'private']);
  assert.deepEqual(QUESTION_DIFFICULTIES, ['easy', 'medium', 'hard']);

  assert.equal(isValidQuestionScope('global'), true);
  assert.equal(isValidQuestionScope('private'), true);
  assert.equal(isValidQuestionScope('public'), false);
});

test('ErrorBook contracts constants and validators', () => {
  assert.deepEqual(ERROR_BOOK_SOURCE_TYPES, ['question', 'flashcard']);

  assert.equal(isValidErrorBookSourceType('question'), true);
  assert.equal(isValidErrorBookSourceType('flashcard'), true);
  assert.equal(isValidErrorBookSourceType('simulado'), false);
});

test('ErrorBook identity is deterministic and collision-free across scopes and decks', () => {
  assert.equal(buildErrorBookEntryId({ sourceType: 'question', questionScope: 'global', sourceId: 'XYZ' }), 'question:global:XYZ');
  assert.equal(buildErrorBookEntryId({ sourceType: 'question', questionScope: 'private', sourceId: 'XYZ' }), 'question:private:XYZ');
  assert.equal(buildErrorBookEntryId({ sourceType: 'flashcard', deckId: 'DECK123', sourceId: 'CARD456' }), 'flashcard:DECK123:CARD456');
  assert.notEqual(
    buildErrorBookEntryId({ sourceType: 'question', questionScope: 'global', sourceId: 'XYZ' }),
    buildErrorBookEntryId({ sourceType: 'question', questionScope: 'private', sourceId: 'XYZ' }),
  );
});

test('reviewCard freezes userId, deckId, cardId and rating as required positional arguments', async () => {
  assert.equal(reviewCard.length, 4);
  await assert.rejects(
    () => reviewCard('', 'DECK123', 'CARD456', 'again'),
    /userId, deckId e cardId sao obrigatorios/,
  );
  await assert.rejects(
    () => reviewCard('USER1', '', 'CARD456', 'again'),
    /userId, deckId e cardId sao obrigatorios/,
  );
  await assert.rejects(
    () => reviewCard('USER1', 'DECK123', '', 'again'),
    /userId, deckId e cardId sao obrigatorios/,
  );
  await assert.rejects(
    () => reviewCard('USER1', 'DECK123', 'CARD456', 'invalid_rating'),
    /Rating invalido/,
  );
});

test('Documents contracts restrict v1 to PDF only', () => {
  assert.deepEqual(DOCUMENT_FILE_TYPES, ['pdf']);
  assert.deepEqual(DOCUMENT_STATUSES, ['pending', 'processing', 'processed', 'error']);

  assert.equal(isValidDocumentFileType('pdf'), true);
  assert.equal(isValidDocumentFileType('txt'), false);
  assert.equal(isValidDocumentFileType('md'), false);
  assert.equal(isValidDocumentFileType('apkg'), false);
});

test('AI surfaces include new and existing surfaces', () => {
  assert.ok(AI_SURFACES.includes('flashcards'));
  assert.ok(AI_SURFACES.includes('questions'));
  assert.ok(AI_SURFACES.includes('summary'));
  assert.ok(AI_SURFACES.includes('cronograma'));
});
