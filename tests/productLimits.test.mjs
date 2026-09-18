import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_PRODUCT_LIMITS,
  resolveProductLimits,
  SYSTEM_CONFIG_PRODUCT_LIMITS_DOC,
} from '../src/config/productLimits.js';

test('DEFAULT_PRODUCT_LIMITS has expected domain values and is frozen', () => {
  assert.equal(SYSTEM_CONFIG_PRODUCT_LIMITS_DOC, 'system_config/product_limits');
  assert.equal(DEFAULT_PRODUCT_LIMITS.storage.maxPdfSizeBytes, 25 * 1024 * 1024);
  assert.equal(DEFAULT_PRODUCT_LIMITS.storage.maxApkgSizeBytes, 50 * 1024 * 1024);
  assert.deepEqual(DEFAULT_PRODUCT_LIMITS.storage.allowedDocumentTypes, ['pdf']);

  assert.equal(DEFAULT_PRODUCT_LIMITS.flashcards.defaultNewCardsPerDay, 20);
  assert.equal(DEFAULT_PRODUCT_LIMITS.flashcards.defaultMaxReviewsPerDay, 100);
  assert.equal(DEFAULT_PRODUCT_LIMITS.flashcards.maxCardsPerDeck, 2000);
  assert.equal(DEFAULT_PRODUCT_LIMITS.flashcards.maxDecksPerUser, 500);
  assert.deepEqual(DEFAULT_PRODUCT_LIMITS.scheduler.learningStepsMinutes, [1, 10]);
  assert.equal(DEFAULT_PRODUCT_LIMITS.scheduler.hardMinutes, 6);
  assert.equal(DEFAULT_PRODUCT_LIMITS.scheduler.easyIntervalDays, 3);

  assert.equal(DEFAULT_PRODUCT_LIMITS.questions.defaultDailyQuestionsGoal, 20);
  assert.equal(DEFAULT_PRODUCT_LIMITS.questions.maxQuestionsPerSession, 50);
  assert.equal(DEFAULT_PRODUCT_LIMITS.studyRecords.maxMinutesPerRecord, 720);
  assert.ok(Object.isFrozen(DEFAULT_PRODUCT_LIMITS.studyRecords));

  assert.equal(DEFAULT_PRODUCT_LIMITS.ai.maxGeneratedCardsPerBatch, 30);
  assert.equal(DEFAULT_PRODUCT_LIMITS.ai.maxGeneratedQuestionsPerBatch, 20);
  assert.equal(DEFAULT_PRODUCT_LIMITS.ai.maxDocumentPagesForAI, 50);

  assert.deepEqual(DEFAULT_PRODUCT_LIMITS.anki.identityFields, ['ankiNoteGuid', 'ankiCardOrd']);
  assert.equal(DEFAULT_PRODUCT_LIMITS.groupChat.maxMessageChars, 4000);
  assert.equal(DEFAULT_PRODUCT_LIMITS.groupChat.messageCooldownMs, 1000);
  assert.equal(DEFAULT_PRODUCT_LIMITS.groupChat.transactionConflictRetries, 30);

  assert.equal(DEFAULT_PRODUCT_LIMITS.polls.minOptions, 2);
  assert.equal(DEFAULT_PRODUCT_LIMITS.polls.maxOptions, 6);
  assert.equal(DEFAULT_PRODUCT_LIMITS.polls.maxTitleChars, 120);
  assert.equal(DEFAULT_PRODUCT_LIMITS.polls.maxDescriptionChars, 600);
  assert.equal(DEFAULT_PRODUCT_LIMITS.polls.maxOptionChars, 120);
  assert.equal(DEFAULT_PRODUCT_LIMITS.polls.pageSizeRespondents, 50);
  assert.equal(DEFAULT_PRODUCT_LIMITS.polls.maxHistoryItems, 100);

  // Imutabilidade
  assert.ok(Object.isFrozen(DEFAULT_PRODUCT_LIMITS));
  assert.ok(Object.isFrozen(DEFAULT_PRODUCT_LIMITS.storage));
  assert.ok(Object.isFrozen(DEFAULT_PRODUCT_LIMITS.flashcards));
  assert.ok(Object.isFrozen(DEFAULT_PRODUCT_LIMITS.polls));
});

test('resolveProductLimits safely falls back to defaults with null or empty override', () => {
  const resolvedNull = resolveProductLimits(null);
  const resolvedEmpty = resolveProductLimits({});

  assert.equal(resolvedNull.storage.maxPdfSizeBytes, 25 * 1024 * 1024);
  assert.equal(resolvedEmpty.flashcards.defaultNewCardsPerDay, 20);
});

test('resolveProductLimits merges remote Firestore overrides without losing base fields', () => {
  const remoteOverrides = {
    storage: {
      maxPdfSizeBytes: 30 * 1024 * 1024,
    },
    flashcards: {
      defaultNewCardsPerDay: 30,
    },
  };

  const resolved = resolveProductLimits(remoteOverrides);

  assert.equal(resolved.storage.maxPdfSizeBytes, 30 * 1024 * 1024);
  assert.equal(resolved.storage.maxApkgSizeBytes, 50 * 1024 * 1024); // preservado
  assert.equal(resolved.flashcards.defaultNewCardsPerDay, 30);
  assert.equal(resolved.flashcards.defaultMaxReviewsPerDay, 100); // preservado
});
