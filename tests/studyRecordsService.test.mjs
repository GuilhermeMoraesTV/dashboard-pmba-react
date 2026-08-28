import test from 'node:test';
import assert from 'node:assert/strict';

import {
  dateToYMD,
  ymdToDateLocal,
  isRegistroContext,
  normalizeRegistroPayload,
  sortRegistrosEstudo,
  getCompletionDocId,
} from '../src/services/studyRecords/utils.js';

test('studyRecords utils: date conversions and validation', () => {
  const d = new Date(2026, 7, 28);
  assert.equal(dateToYMD(d), '2026-08-28');

  const parsed = ymdToDateLocal('2026-08-28');
  assert.equal(parsed.getFullYear(), 2026);
  assert.equal(parsed.getMonth(), 7);
  assert.equal(parsed.getDate(), 28);

  assert.equal(isRegistroContext('ciclo'), true);
  assert.equal(isRegistroContext('cronograma'), true);
  assert.equal(isRegistroContext('outro'), false);
  assert.equal(isRegistroContext(null), false);
});

test('studyRecords utils: normalizeRegistroPayload handles numeric conversions', () => {
  const normalized = normalizeRegistroPayload('rec-1', {
    data: '2026-08-28',
    tempoEstudadoMinutos: '45',
    questoesFeitas: '10',
    acertos: '8',
    assunto: 'Direito Constitucional',
  });

  assert.equal(normalized.id, 'rec-1');
  assert.equal(normalized.tempoEstudadoMinutos, 45);
  assert.equal(normalized.questoesFeitas, 10);
  assert.equal(normalized.acertos, 8);
  assert.equal(normalized.assunto, 'Direito Constitucional');
});

test('studyRecords utils: sortRegistrosEstudo sorts by date descending then timestamp descending', () => {
  const records = [
    { id: '1', data: '2026-08-25', timestamp: { seconds: 100 } },
    { id: '2', data: '2026-08-28', timestamp: { seconds: 200 } },
    { id: '3', data: '2026-08-28', timestamp: { seconds: 300 } },
  ];

  const sorted = sortRegistrosEstudo(records);
  assert.equal(sorted[0].id, '3');
  assert.equal(sorted[1].id, '2');
  assert.equal(sorted[2].id, '1');
});

test('studyRecords utils: getCompletionDocId creates deterministic document ID', () => {
  assert.equal(getCompletionDocId(null), null);
  assert.equal(getCompletionDocId(''), null);
  assert.equal(getCompletionDocId('slot:123:abc'), 'completion_slot%3A123%3Aabc');
  assert.equal(getCompletionDocId('slot.123'), 'completion_slot%2E123');
});
