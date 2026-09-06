import test from 'node:test';
import assert from 'node:assert/strict';
import { firebaseEmulatorControlInternals } from '../scripts/viteFirebaseEmulatorPlugin.js';

test('controle de processos dos Emulators aceita somente loopback', () => {
  assert.equal(firebaseEmulatorControlInternals.isLoopbackAddress('127.0.0.1'), true);
  assert.equal(firebaseEmulatorControlInternals.isLoopbackAddress('::1'), true);
  assert.equal(firebaseEmulatorControlInternals.isLoopbackAddress('::ffff:127.0.0.1'), true);
  assert.equal(firebaseEmulatorControlInternals.isLoopbackAddress('192.168.0.10'), false);
  assert.equal(firebaseEmulatorControlInternals.isLoopbackAddress(''), false);
});

test('espelhamento local normaliza identidade e não aceita privilégios implícitos', () => {
  const admin = firebaseEmulatorControlInternals.normalizeMirrorUserPayload({
    uid: 'OLoJi457GQNE2eTSOcz9DAD6ppZ2', email: 'ADMIN@EXAMPLE.COM', displayName: ' Admin ',
    isAdmin: true, access: { adminRole: 'super_admin' }, localPassword: 'real-password-123',
  });
  assert.equal(admin.email, 'admin@example.com');
  assert.equal(admin.displayName, 'Admin');
  assert.equal(admin.access.role, 'admin');
  assert.equal(admin.access.permissions.adminPanel, true);
  assert.equal(admin.localPassword, 'real-password-123');
  const student = firebaseEmulatorControlInternals.normalizeMirrorUserPayload({
    uid: 'student_1', email: 'student@example.com', access: { role: 'admin' }, isAdmin: false,
  });
  assert.equal(student.access.role, 'student');
  assert.equal(student.access.permissions.adminPanel, false);

  const legacyAdmin = firebaseEmulatorControlInternals.normalizeMirrorUserPayload({
    uid: 'OLoJi457GQNE2eTSOcz9DAD6ppZ2', email: 'legacy-admin@example.com',
  });
  assert.equal(legacyAdmin.access.role, 'admin');
  assert.equal(legacyAdmin.access.adminRole, 'super_admin');
  assert.equal(legacyAdmin.access.permissions.adminPanel, true);
  assert.equal(legacyAdmin.access.permissions.manageBroadcasts, true);

  assert.throws(() => firebaseEmulatorControlInternals.normalizeMirrorUserPayload({
    uid: '../invalid', email: 'invalid', isAdmin: true,
  }), /UID inválido/);
  assert.throws(() => firebaseEmulatorControlInternals.normalizeMirrorUserPayload({
    uid: 'valid_uid', email: 'valid@example.com', localPassword: 'short',
  }), /Senha local inválida/);
});
