import test from 'node:test';
import assert from 'node:assert/strict';
import {
  addOptimisticXPEntry,
  getOptimisticTotalXP,
  removeOptimisticXPEntry,
} from '../src/utils/optimisticXP.js';

test('XP otimista soma ações rápidas uma vez por evento determinístico', () => {
  let pending = addOptimisticXPEntry({
    pendingEntries: {},
    eventId: 'academic_study_1',
    xpTotal: 15,
    currentTotalXP: 100,
  });
  pending = addOptimisticXPEntry({
    pendingEntries: pending,
    eventId: 'academic_study_1',
    xpTotal: 15,
    currentTotalXP: getOptimisticTotalXP(100, pending),
  });
  pending = addOptimisticXPEntry({
    pendingEntries: pending,
    eventId: 'academic_study_2',
    xpTotal: 25,
    currentTotalXP: getOptimisticTotalXP(100, pending),
  });

  assert.equal(getOptimisticTotalXP(100, pending), 140);
  assert.equal(Object.keys(pending).length, 2);
});

test('reconciliação evita XP duplicado durante atualização parcial do backend', () => {
  let pending = addOptimisticXPEntry({
    pendingEntries: {}, eventId: 'event-1', xpTotal: 15, currentTotalXP: 100,
  });
  pending = addOptimisticXPEntry({
    pendingEntries: pending, eventId: 'event-2', xpTotal: 25, currentTotalXP: 115,
  });

  assert.equal(getOptimisticTotalXP(115, pending), 140);
  pending = removeOptimisticXPEntry(pending, 'event-1');
  assert.equal(getOptimisticTotalXP(115, pending), 140);
  pending = removeOptimisticXPEntry(pending, 'event-2');
  assert.equal(getOptimisticTotalXP(140, pending), 140);
});

test('falha remove somente a ação pendente correspondente', () => {
  const first = addOptimisticXPEntry({
    pendingEntries: {}, eventId: 'event-1', xpTotal: 15, currentTotalXP: 100,
  });
  const pending = addOptimisticXPEntry({
    pendingEntries: first, eventId: 'event-2', xpTotal: 25, currentTotalXP: 115,
  });
  const afterFailure = removeOptimisticXPEntry(pending, 'event-2');

  assert.equal(getOptimisticTotalXP(100, afterFailure), 115);
  assert.deepEqual(removeOptimisticXPEntry(afterFailure, 'missing'), afterFailure);
});
