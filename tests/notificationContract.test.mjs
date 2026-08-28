import test from 'node:test';
import assert from 'node:assert/strict';
import {
  EDITAL_LAUNCH_CATEGORY,
  NOTIFICATION_TYPES,
  buildEditalLaunchNotification,
  classifyNotification,
  isEditalLaunchNotification,
  isXPNotification,
  normalizeNotification,
  shouldDisplayGamificationToast,
} from '../src/services/notificationContract.js';

test('monta lançamento global com nome, logo e mensagem do edital', () => {
  const timestamp = new Date('2026-08-27T12:00:00-03:00');
  const notification = buildEditalLaunchNotification({
    editalId: 'pmba_soldado_2026',
    title: 'PMBA - Soldado',
    logoUrl: '/logosEditais/logo-pmba.png',
    message: 'O novo edital da PMBA foi publicado.',
    timestamp,
  });

  assert.equal(notification.category, EDITAL_LAUNCH_CATEGORY);
  assert.equal(notification.notificationType, NOTIFICATION_TYPES.EDITAL);
  assert.equal(notification.templateId, 'pmba_soldado_2026');
  assert.equal(notification.title, 'PMBA - Soldado');
  assert.equal(notification.logoUrl, '/logosEditais/logo-pmba.png');
  assert.equal(notification.message, 'O novo edital da PMBA foi publicado.');
  assert.equal(notification.timestamp, timestamp);
  assert.equal(isEditalLaunchNotification(notification), true);
  assert.equal(classifyNotification(notification), NOTIFICATION_TYPES.EDITAL);
});

test('classifica notificações pelo contrato central', () => {
  assert.equal(classifyNotification({ _type: 'edital_update' }), NOTIFICATION_TYPES.EDITAL);
  assert.equal(classifyNotification({ category: 'urgente' }), NOTIFICATION_TYPES.ACTION_REQUIRED);
  assert.equal(classifyNotification({ category: 'atualizacao' }), NOTIFICATION_TYPES.UPDATE);
  assert.equal(classifyNotification({ ticketId: 't1' }), NOTIFICATION_TYPES.SUPPORT);
  assert.equal(normalizeNotification({ id: 'n1' }).notificationType, NOTIFICATION_TYPES.SYSTEM);
});

test('toast de gamificacao exibe conquistas e oculta eventos comuns de XP', () => {
  assert.equal(shouldDisplayGamificationToast({ category: 'achievement', xpTotal: 50 }), true);
  assert.equal(shouldDisplayGamificationToast({ category: 'academic', xpTotal: 65 }), false);
  assert.equal(shouldDisplayGamificationToast({ category: 'reward', xpTotal: 100 }), false);
});

test('identifica eventos de XP para exclui-los da Central de Notificacoes', () => {
  assert.equal(isXPNotification({ sourceCollection: 'xp_events' }), true);
  assert.equal(isXPNotification({ operationalKind: 'xp' }), true);
  assert.equal(isXPNotification({ title: '+65 XP' }), true);
  assert.equal(isXPNotification({ type: 'group_request', title: 'Solicitacao de entrada' }), false);
});
