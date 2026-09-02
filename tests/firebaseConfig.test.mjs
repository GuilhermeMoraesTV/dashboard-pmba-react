import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveFirebaseConfig, resolveFirebaseEmulatorConfig } from '../src/firebaseConfig.js';

test('Firebase config fails closed outside tests and uses only demo projects in Node tests', () => {
  assert.throws(() => resolveFirebaseConfig({}, { nodeTest: false }), /Configuracao Firebase obrigatoria ausente/);
  assert.equal(resolveFirebaseConfig({}, { nodeTest: true }).projectId, 'demo-modoqap-unit-tests');
  assert.throws(
    () => resolveFirebaseConfig({ FIREBASE_TEST_PROJECT_ID: 'dashboard-pmba' }, { nodeTest: true }),
    /prefixo demo-/,
  );
});

test('Firebase Emulator exige DEV, localhost e opt-in explicito', () => {
  assert.equal(resolveFirebaseEmulatorConfig({ DEV: true }, { hostname: 'localhost' }).enabled, false);
  assert.equal(resolveFirebaseEmulatorConfig({ DEV: false, VITE_USE_FIREBASE_EMULATORS: 'true' }, { hostname: 'localhost' }).enabled, false);
  assert.equal(resolveFirebaseEmulatorConfig({ DEV: true, VITE_USE_FIREBASE_EMULATORS: 'true' }, { hostname: 'dashboard-pmba.web.app' }).enabled, false);
  assert.deepEqual(
    resolveFirebaseEmulatorConfig({ DEV: true, VITE_USE_FIREBASE_EMULATORS: 'true' }, { hostname: '127.0.0.1' }),
    {
      enabled: true,
      host: '127.0.0.1',
      authPort: 9099,
      firestorePort: 8085,
      functionsPort: 5001,
      storagePort: 9199,
    },
  );
  assert.deepEqual(
    resolveFirebaseEmulatorConfig({ DEV: true, MODE: 'emulator' }, { hostname: '127.0.0.1' }),
    {
      enabled: true,
      host: '127.0.0.1',
      authPort: 9099,
      firestorePort: 8085,
      functionsPort: 5001,
      storagePort: 9199,
    },
  );
  assert.equal(resolveFirebaseEmulatorConfig({ DEV: true, MODE: 'development' }, { hostname: 'localhost' }).enabled, false);
});
