import assert from 'node:assert/strict';
import test from 'node:test';
import {
  isUnconfirmedEmptySnapshot,
  snapshotHasData,
} from '../src/utils/firestoreSnapshotState.js';

test('classifica query vazia do cache online como ainda nao confirmada', () => {
  const snapshot = { empty: true, docs: [], metadata: { fromCache: true } };
  assert.equal(snapshotHasData(snapshot), false);
  assert.equal(isUnconfirmedEmptySnapshot(snapshot, { isOnline: true }), true);
});

test('aceita query vazia quando o servidor confirmou a ausencia', () => {
  const snapshot = { empty: true, docs: [], metadata: { fromCache: false } };
  assert.equal(isUnconfirmedEmptySnapshot(snapshot, { isOnline: true }), false);
});

test('aceita cache preenchido e cache vazio quando o dispositivo esta offline', () => {
  const populated = { empty: false, docs: [{}], metadata: { fromCache: true } };
  const empty = { empty: true, docs: [], metadata: { fromCache: true } };
  assert.equal(snapshotHasData(populated), true);
  assert.equal(isUnconfirmedEmptySnapshot(populated, { isOnline: true }), false);
  assert.equal(isUnconfirmedEmptySnapshot(empty, { isOnline: false }), false);
});

test('tambem protege documento inexistente vindo do cache online', () => {
  const snapshot = { exists: () => false, metadata: { fromCache: true } };
  assert.equal(snapshotHasData(snapshot), false);
  assert.equal(isUnconfirmedEmptySnapshot(snapshot, { isOnline: true }), true);
});
