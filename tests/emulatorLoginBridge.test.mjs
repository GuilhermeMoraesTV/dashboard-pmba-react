import test from 'node:test';
import assert from 'node:assert/strict';
import { inMemoryPersistence } from 'firebase/auth';
import {
  shouldRecoverEmulatorIdentity,
  signInWithEmulatorIdentityRecovery,
} from '../src/services/auth/emulatorLoginBridge.js';

test('recuperação de identidade só ocorre no Emulator e para credencial ausente ou divergente', () => {
  assert.equal(shouldRecoverEmulatorIdentity({ code: 'auth/wrong-password' }, true), true);
  assert.equal(shouldRecoverEmulatorIdentity({ code: 'auth/invalid-credential' }, true), true);
  assert.equal(shouldRecoverEmulatorIdentity({ code: 'auth/network-request-failed' }, true), false);
  assert.equal(shouldRecoverEmulatorIdentity({ code: 'auth/wrong-password' }, false), false);
});

test('login recupera no Auth Emulator somente depois de validar a credencial real', async () => {
  const calls = [];
  const localAuth = { name: 'local-auth' };
  let attempts = 0;

  const result = await signInWithEmulatorIdentityRecovery({
    email: 'admin@example.com',
    password: 'production-password',
    persistence: 'session',
  }, {
    auth: localAuth,
    emulatorEnabled: true,
    setPersistence: async (receivedAuth, persistence) => calls.push(['persistence', receivedAuth, persistence]),
    signIn: async (receivedAuth, email, password) => {
      calls.push(['signIn', receivedAuth, email, password]);
      attempts += 1;
      if (attempts === 1) throw Object.assign(new Error('local password differs'), { code: 'auth/wrong-password' });
      return { user: { uid: LEGACY_ADMIN_UID_FOR_TEST } };
    },
    verifyRealCredentials: async (email, password) => {
      calls.push(['verifyReal', email, password]);
      return { uid: LEGACY_ADMIN_UID_FOR_TEST, email, displayName: 'Admin', photoURL: '' };
    },
    mirrorUser: async (payload) => calls.push(['mirror', payload]),
    saveSessionIdentity: (payload) => calls.push(['saveSession', payload]),
  });

  assert.equal(result.user.uid, LEGACY_ADMIN_UID_FOR_TEST);
  assert.deepEqual(calls.map(([name]) => name), ['persistence', 'signIn', 'verifyReal', 'mirror', 'signIn', 'saveSession']);
  assert.equal(calls[0][2], inMemoryPersistence);
  assert.equal(calls[3][1].localPassword, 'production-password');
  assert.equal(calls[3][1].isAdmin, true);
  assert.deepEqual(calls[5][1], {
    uid: LEGACY_ADMIN_UID_FOR_TEST,
    email: 'admin@example.com',
  });
});

test('login já existente no Emulator usa memória e preserva credencial local da sessão', async () => {
  const calls = [];
  const credential = { user: { uid: 'local-user' } };
  const result = await signInWithEmulatorIdentityRecovery({
    email: 'local@example.com',
    password: 'local-password',
    persistence: 'local',
  }, {
    auth: {},
    emulatorEnabled: true,
    setPersistence: async (_auth, persistence) => calls.push(['persistence', persistence]),
    signIn: async () => credential,
    saveSessionIdentity: (payload) => calls.push(['saveSession', payload]),
  });

  assert.equal(result, credential);
  assert.equal(calls[0][1], inMemoryPersistence);
  assert.deepEqual(calls[1][1], {
    uid: 'local-user', email: 'local@example.com',
  });
});

const LEGACY_ADMIN_UID_FOR_TEST = 'OLoJi457GQNE2eTSOcz9DAD6ppZ2';
