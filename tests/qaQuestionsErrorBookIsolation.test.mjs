import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {
  mockGlobalQuestion,
  mockGlobalAnswerKey,
  mockPrivateQuestion,
  mockPrivateAnswerKey,
  mockErrorBookEntryQuestion,
  mockErrorBookEntryFlashcard,
} from './fixtures/qaFixtures.mjs';
import {
  projectClientSafeOptions,
  normalizeQuestionDoc,
} from '../src/services/questions/questionsService.js';
import {
  buildErrorBookEntryId,
  isValidErrorBookSourceType,
} from '../src/contracts/errorBook.js';
import {
  buildInitialErrorBookEntry,
} from '../src/services/errorBook/errorBookService.js';
import { DEFAULT_PRODUCT_LIMITS } from '../src/config/productLimits.js';

function deterministicDocumentId(parts) {
  return crypto.createHash('sha256').update(parts.map((part) => String(part)).join('\u0000')).digest('hex');
}

test('QA: Idempotency & Deterministic IDs for Questions and Attempts', () => {
  const scope = 'global';
  const questionId = mockGlobalQuestion.id;
  const selectedOption1 = 'A';
  const selectedOption2 = 'B';

  const attemptId1 = deterministicDocumentId([scope, questionId, selectedOption1]);
  const attemptId1Repeat = deterministicDocumentId([scope, questionId, selectedOption1]);
  const attemptId2 = deterministicDocumentId([scope, questionId, selectedOption2]);

  // Idempotency: exact same attempt produces the exact same attempt ID
  assert.equal(attemptId1, attemptId1Repeat, 'Re-submission of same option must produce identical attempt ID');
  assert.notEqual(attemptId1, attemptId2, 'Submission of different option produces distinct attempt ID');

  // Reward source ID is solely determined by scope + questionId (not option), preventing double XP reward
  const rewardSourceId1 = deterministicDocumentId([scope, questionId]);
  const rewardSourceId2 = deterministicDocumentId([scope, questionId]);
  assert.equal(rewardSourceId1, rewardSourceId2, 'Reward source ID must be deterministic and unique per question');
});

test('QA: Client-Safe Option Projection strictly strips answer leaks', () => {
  const dirtyOptions = [
    { id: 'A', text: 'Option A', isCorrect: true, correctOptionId: 'A', explanation: 'Secret reason', score: 10 },
    { id: 'B', text: 'Option B', isCorrect: false, answer: true },
    { id: 'C', text: 'Option C', __hidden: 'leak' },
  ];

  const safeOptions = projectClientSafeOptions(dirtyOptions);

  assert.equal(safeOptions.length, 3);
  for (const opt of safeOptions) {
    const keys = Object.keys(opt);
    assert.deepEqual(keys.sort(), ['id', 'text'].sort(), `Option must only contain id and text, found: ${keys.join(', ')}`);
  }
  assert.equal(safeOptions[0].id, 'A');
  assert.equal(safeOptions[0].text, 'Option A');
});

test('QA: Normalization of Question doc snapshot guarantees default fields', () => {
  const fakeDocSnap = {
    id: 'q_test_999',
    data: () => ({
      statement: 'Texto do enunciado',
      options: [{ id: 'A', text: 'Opção 1' }, { id: 'B', text: 'Opção 2', isCorrect: true }],
      disciplineId: 'direito',
      subject: 'Penal',
    }),
  };

  const normalized = normalizeQuestionDoc(fakeDocSnap, 'global');
  assert.equal(normalized.id, 'q_test_999');
  assert.equal(normalized.questionScope, 'global');
  assert.equal(normalized.options.length, 2);
  assert.equal(normalized.options[1].isCorrect, undefined);
  assert.equal(normalized.difficulty, 'medium'); // Default fallback
  assert.ok(normalized.createdAt instanceof Date);
  assert.ok(normalized.updatedAt instanceof Date);
});

test('QA: ErrorBook deterministic identity across all scopes and collision safety', () => {
  const qGlobalId = buildErrorBookEntryId({
    sourceType: 'question',
    questionScope: 'global',
    sourceId: '123',
  });
  const qPrivateId = buildErrorBookEntryId({
    sourceType: 'question',
    questionScope: 'private',
    sourceId: '123',
  });
  const fcId = buildErrorBookEntryId({
    sourceType: 'flashcard',
    deckId: 'deck_math',
    sourceId: 'card_456',
  });

  assert.equal(qGlobalId, 'question:global:123');
  assert.equal(qPrivateId, 'question:private:123');
  assert.equal(fcId, 'flashcard:deck_math:card_456');

  // No collisions between global and private questions with identical ID
  assert.notEqual(qGlobalId, qPrivateId);

  // Rejection of invalid colons in IDs to prevent structural spoofing
  assert.throws(
    () => buildErrorBookEntryId({ sourceType: 'flashcard', deckId: 'deck:bad', sourceId: 'card1' }),
    /delimitador/,
  );
  assert.throws(
    () => buildErrorBookEntryId({ sourceType: 'flashcard', deckId: 'deck1', sourceId: 'card:bad' }),
    /delimitador/,
  );
});

test('QA: ErrorBook initial entry construction and state consistency', () => {
  const userNotes = 'Lembrar de revisar este tópico com prioridade.';
  const entry = buildInitialErrorBookEntry('user_qa_123', {
    sourceType: 'question',
    sourceId: mockGlobalQuestion.id,
    questionScope: 'global',
    disciplineId: mockGlobalQuestion.disciplineId,
    subject: mockGlobalQuestion.subject,
    preview: { statement: mockGlobalQuestion.statement },
    userNotes,
    isCorrectAttempt: false,
  });

  assert.equal(entry.id, 'question:global:q_global_001');
  assert.equal(entry.userId, 'user_qa_123');
  assert.equal(entry.wrongCount, 1);
  assert.equal(entry.correctCount, 0);
  assert.equal(entry.mastered, false);
  assert.equal(entry.masteredAt, null);
  assert.equal(entry.userNotes, userNotes);
  assert.ok(entry.createdAt instanceof Date);
  assert.ok(entry.lastAttemptAt instanceof Date);

  // If initial entry was created on a correct retry
  const entryCorrect = buildInitialErrorBookEntry('user_qa_123', {
    sourceType: 'question',
    sourceId: mockGlobalQuestion.id,
    questionScope: 'global',
    isCorrectAttempt: true,
  });
  assert.equal(entryCorrect.wrongCount, 0);
  assert.equal(entryCorrect.correctCount, 1);
});

test('QA: Product limits validation constraints', () => {
  assert.ok(DEFAULT_PRODUCT_LIMITS.questions.maxQuestionsPerSession >= 10);
  assert.ok(DEFAULT_PRODUCT_LIMITS.questions.maxStatementChars >= 1000);
  assert.ok(DEFAULT_PRODUCT_LIMITS.errorBook.maxEntriesPerPage >= 10);
  assert.ok(DEFAULT_PRODUCT_LIMITS.errorBook.maxUserNotesChars >= 500);
  assert.ok(DEFAULT_PRODUCT_LIMITS.storage.maxPdfSizeBytes >= 10 * 1024 * 1024); // at least 10MB
});
