import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DOCUMENT_FILE_TYPES,
  DOCUMENT_STATUSES,
  GENERATED_ITEM_TYPES,
  GENERATED_ITEM_STATUSES,
  isValidDocumentFileType,
} from '../src/contracts/documents.js';
import {
  AI_SURFACES,
} from '../src/contracts/ai.js';
import {
  mockUserDocument,
  mockGeneratedItemFlashcard,
  mockGeneratedItemQuestion,
} from './fixtures/qaFixtures.mjs';
import {
  sanitizeFileName,
} from '../src/services/documents/documentsService.js';
import {
  sanitizeApkgName,
} from '../src/services/anki/ankiService.js';

test('QA Prepared [AGUARDANDO CODEX]: Documents and AI contract definitions', () => {
  assert.deepEqual(DOCUMENT_FILE_TYPES, ['pdf']);
  assert.deepEqual(DOCUMENT_STATUSES, ['pending', 'processing', 'processed', 'error']);
  assert.deepEqual(GENERATED_ITEM_TYPES, ['flashcard', 'question', 'summary']);
  assert.deepEqual(GENERATED_ITEM_STATUSES, ['draft', 'buffer', 'materialized', 'approved', 'rejected']);

  assert.equal(isValidDocumentFileType('pdf'), true);
  assert.equal(isValidDocumentFileType('docx'), false);

  assert.ok(AI_SURFACES.includes('flashcards'));
  assert.ok(AI_SURFACES.includes('questions'));
  assert.ok(AI_SURFACES.includes('summary'));
});

test('QA Prepared [AGUARDANDO CODEX]: User Document fixture adherence', () => {
  assert.equal(mockUserDocument.fileType, 'pdf');
  assert.equal(mockUserDocument.status, 'processed');
  assert.ok(mockUserDocument.storagePath.startsWith('user_uploads/'));
  assert.ok(mockUserDocument.createdAt instanceof Date);
});

test('QA Prepared [AGUARDANDO CODEX]: Generated Items fixtures adherence', () => {
  assert.equal(mockGeneratedItemFlashcard.type, 'flashcard');
  assert.equal(mockGeneratedItemFlashcard.status, 'draft');
  assert.ok(mockGeneratedItemFlashcard.content.front);
  assert.ok(mockGeneratedItemFlashcard.content.back);

  assert.equal(mockGeneratedItemQuestion.type, 'question');
  assert.equal(mockGeneratedItemQuestion.status, 'draft');
  assert.ok(mockGeneratedItemQuestion.content.statement);
  assert.ok(Array.isArray(mockGeneratedItemQuestion.content.options));
});

test('QA Prepared: File sanitization helpers for PDF and APKG', () => {
  assert.equal(sanitizeFileName('arquivo.pdf'), 'arquivo.pdf');
  assert.equal(sanitizeFileName('arquivo/com\\barras.pdf'), 'arquivo_com_barras.pdf');
  assert.equal(sanitizeFileName('sem-extensao'), 'sem-extensao.pdf');

  assert.equal(sanitizeApkgName('meu_deck.apkg'), 'meu_deck.apkg');
  assert.equal(sanitizeApkgName('deck/perigoso.apkg'), 'deck_perigoso.apkg');
  assert.equal(sanitizeApkgName('sem_extensao'), 'sem_extensao.apkg');
});
