import test from 'node:test';
import assert from 'node:assert/strict';
import { reconcileStudyRecordSnapshot } from '../src/utils/optimisticStudyRecords.js';

test('snapshot intermediario nao remove conclusoes otimistas ainda nao confirmadas', () => {
  const pending = new Map([
    ['completion-1', { id: 'completion-1', tempoEstudadoMinutos: 60 }],
    ['completion-2', { id: 'completion-2', tempoEstudadoMinutos: 60 }],
  ]);

  const reconciled = reconcileStudyRecordSnapshot({
    snapshotRecords: [{ id: 'completion-1', tempoEstudadoMinutos: 60 }],
    pendingRecords: pending,
    hasPendingWrites: true,
  });

  assert.deepEqual(reconciled.map((record) => record.id), ['completion-1', 'completion-2']);
  assert.equal(pending.size, 2);
});

test('snapshot confirmado limpa somente os registros persistidos', () => {
  const pending = new Map([
    ['completion-1', { id: 'completion-1', tempoEstudadoMinutos: 60 }],
    ['completion-2', { id: 'completion-2', tempoEstudadoMinutos: 60 }],
  ]);

  const reconciled = reconcileStudyRecordSnapshot({
    snapshotRecords: [{ id: 'completion-1', tempoEstudadoMinutos: 60 }],
    pendingRecords: pending,
    hasPendingWrites: false,
  });

  assert.deepEqual(reconciled.map((record) => record.id), ['completion-1', 'completion-2']);
  assert.deepEqual([...pending.keys()], ['completion-2']);
});
