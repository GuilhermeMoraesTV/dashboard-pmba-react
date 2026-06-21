import test from 'node:test';
import assert from 'node:assert/strict';
import {
  NOTIFICATION_TYPES,
  classifyNotification,
  normalizeNotification,
} from '../src/services/notificationContract.js';

test('classifica notificações pelo contrato central', () => {
  assert.equal(classifyNotification({ _type: 'edital_update' }), NOTIFICATION_TYPES.EDITAL);
  assert.equal(classifyNotification({ category: 'urgente' }), NOTIFICATION_TYPES.ACTION_REQUIRED);
  assert.equal(classifyNotification({ category: 'atualizacao' }), NOTIFICATION_TYPES.UPDATE);
  assert.equal(classifyNotification({ ticketId: 't1' }), NOTIFICATION_TYPES.SUPPORT);
  assert.equal(normalizeNotification({ id: 'n1' }).notificationType, NOTIFICATION_TYPES.SYSTEM);
});
