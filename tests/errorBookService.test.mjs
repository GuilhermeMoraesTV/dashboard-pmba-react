import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getErrorBookEntries,
  getErrorBookEntryById,
  markErrorBookEntryMastered,
  updateErrorBookUserNotes,
  buildInitialErrorBookEntry,
  getErrorBookSummaryStats,
} from '../src/services/errorBook/errorBookService.js';
import { buildErrorBookEntryId } from '../src/contracts/errorBook.js';

test('buildErrorBookEntryId generates correct deterministic identities', () => {
  assert.equal(
    buildErrorBookEntryId({ sourceType: 'question', sourceId: 'q-100', questionScope: 'global' }),
    'question:global:q-100',
  );

  assert.equal(
    buildErrorBookEntryId({ sourceType: 'question', sourceId: 'q-200', questionScope: 'private' }),
    'question:private:q-200',
  );

  assert.equal(
    buildErrorBookEntryId({ sourceType: 'flashcard', sourceId: 'card-1', deckId: 'deck-A' }),
    'flashcard:deck-A:card-1',
  );
});

test('buildErrorBookEntryId throws on invalid inputs', () => {
  assert.throws(
    () => buildErrorBookEntryId({ sourceType: 'question', sourceId: '' }),
    /sourceId e obrigatorio/,
  );

  assert.throws(
    () => buildErrorBookEntryId({ sourceType: 'question', sourceId: 'q-1', questionScope: null }),
    /questionScope global ou private e obrigatorio/,
  );

  assert.throws(
    () => buildErrorBookEntryId({ sourceType: 'flashcard', sourceId: 'c-1', deckId: '' }),
    /deckId e obrigatorio/,
  );

  assert.throws(
    () => buildErrorBookEntryId({ sourceType: 'flashcard', sourceId: 'card:1', deckId: 'deck-A' }),
    /nao podem conter o delimitador/,
  );

  assert.throws(
    () => buildErrorBookEntryId({ sourceType: 'invalid', sourceId: '123' }),
    /sourceType invalido/,
  );
});

test('buildInitialErrorBookEntry builds valid error book entry object', () => {
  const entry = buildInitialErrorBookEntry('user-1', {
    sourceType: 'question',
    sourceId: 'q-123',
    questionScope: 'global',
    disciplineId: 'direito',
    subject: 'Constitucional',
    preview: { statement: 'Enunciado de teste' },
  });

  assert.equal(entry.id, 'question:global:q-123');
  assert.equal(entry.userId, 'user-1');
  assert.equal(entry.sourceType, 'question');
  assert.equal(entry.sourceId, 'q-123');
  assert.equal(entry.questionScope, 'global');
  assert.equal(entry.deckId, null);
  assert.equal(entry.wrongCount, 1);
  assert.equal(entry.correctCount, 0);
  assert.equal(entry.mastered, false);
  assert.equal(entry.masteredAt, null);
  assert.equal(entry.preview.statement, 'Enunciado de teste');
});

test('getErrorBookEntries validates userId', async () => {
  await assert.rejects(
    () => getErrorBookEntries(''),
    /userId e obrigatorio/,
  );
});

test('getErrorBookEntryById validates userId and entryId', async () => {
  await assert.rejects(
    () => getErrorBookEntryById('', 'entry-1'),
    /userId e entryId sao obrigatorios/,
  );

  await assert.rejects(
    () => getErrorBookEntryById('user-1', ''),
    /userId e entryId sao obrigatorios/,
  );
});

test('markErrorBookEntryMastered validates userId and entryId', async () => {
  await assert.rejects(
    () => markErrorBookEntryMastered('', 'entry-1'),
    /userId e entryId sao obrigatorios/,
  );

  await assert.rejects(
    () => markErrorBookEntryMastered('user-1', ''),
    /userId e entryId sao obrigatorios/,
  );
});

test('updateErrorBookUserNotes validates userId and entryId', async () => {
  await assert.rejects(
    () => updateErrorBookUserNotes('', 'entry-1', 'Notas'),
    /userId e entryId sao obrigatorios/,
  );

  await assert.rejects(
    () => updateErrorBookUserNotes('user-1', '', 'Notas'),
    /userId e entryId sao obrigatorios/,
  );
});

test('getErrorBookSummaryStats validates userId', async () => {
  await assert.rejects(
    () => getErrorBookSummaryStats(''),
    /userId e obrigatorio/,
  );
});
