import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { STUDY_SOURCE_KINDS, STUDY_SOURCE_STATUSES } from '../src/contracts/studySources.js';
import {
  requestFlashcardGeneration,
  requestQuestionGeneration,
  requestSummaryGeneration,
} from '../src/services/ai/aiService.js';
import { DEFAULT_PRODUCT_LIMITS } from '../src/config/productLimits.js';

const require = createRequire(import.meta.url);
const { splitNoteIntoChunks } = require('../functions/studySources/service.js');

test('StudySource contract exposes only note/document and processing/ready/error', () => {
  assert.deepEqual(STUDY_SOURCE_KINDS, ['note', 'document']);
  assert.deepEqual(STUDY_SOURCE_STATUSES, ['processing', 'ready', 'error']);
});

test('note chunking is server-side, bounded and preserves the original text separately', () => {
  const limits = DEFAULT_PRODUCT_LIMITS;
  const original = `${'A'.repeat(5900)}. ${'B'.repeat(5900)}`;
  const chunks = splitNoteIntoChunks(original, limits);
  assert.ok(chunks.length >= 2);
  assert.ok(chunks.length <= limits.documents.maxChunks);
  assert.deepEqual(chunks.map((chunk) => chunk.order), chunks.map((_, index) => index));
  assert.ok(chunks.every((chunk) => chunk.content.length > 0 && chunk.charCount === chunk.content.length));
  assert.equal(original.length, 11802);
});

test('source-only gate rejects documentId, discipline, subject and focusTopics without sourceId', async () => {
  await assert.rejects(() => requestFlashcardGeneration({ documentId: 'doc-1', focusTopics: ['tema'] }), /sourceId e obrigatorio/);
  await assert.rejects(() => requestQuestionGeneration({ documentId: 'doc-1', disciplineId: 'direito', subject: 'tema' }), /sourceId e obrigatorio/);
  await assert.rejects(() => requestSummaryGeneration({ documentId: 'doc-1', focusTopics: ['tema'] }), /sourceId e obrigatorio/);
});
