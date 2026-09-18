import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolveFirebaseConfig, resolveFirebaseEmulatorConfig, resolveFirebaseRuntimeConfig } from '../src/firebaseConfig.js';
import {
  FIREBASE_MODE_STORAGE_KEY,
  clearPendingEmulatorLogin,
  clearEmulatorSessionIdentity,
  normalizeFirebaseMode,
  readPendingEmulatorLogin,
  readEmulatorSessionIdentity,
  readFirebaseModePreference,
  writePendingEmulatorLogin,
  writeEmulatorSessionIdentity,
  writeFirebaseModePreference,
} from '../src/utils/firebaseEnvironment.js';

test('Firebase config fails closed outside tests and uses only demo projects in Node tests', () => {
  assert.throws(() => resolveFirebaseConfig({}, { nodeTest: false }), /Configuracao Firebase obrigatoria ausente/);
  assert.equal(resolveFirebaseConfig({}, { nodeTest: true }).projectId, 'demo-modoqap-unit-tests');
  assert.throws(
    () => resolveFirebaseConfig({ FIREBASE_TEST_PROJECT_ID: 'dashboard-pmba' }, { nodeTest: true }),
    /prefixo demo-/,
  );
});

test('sessão do Emulator persiste somente identidade não secreta', () => {
  const values = new Map();
  const storage = {
    getItem: (key) => values.get(key),
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
  };
  writeEmulatorSessionIdentity(storage, {
    uid: 'local-user', email: 'local@example.com', password: 'nao-deve-ser-persistida',
  });
  assert.deepEqual(readEmulatorSessionIdentity(storage), {
    uid: 'local-user', email: 'local@example.com',
  });
  assert.equal([...values.values()].some((value) => value.includes('nao-deve-ser-persistida')), false);
  clearEmulatorSessionIdentity(storage);
  assert.equal(readEmulatorSessionIdentity(storage), null);
});

test('login temporário do Emulator é validado e removível', () => {
  const values = new Map();
  const storage = {
    getItem: (key) => values.get(key),
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
  };
  writePendingEmulatorLogin(storage, { uid: 'admin', email: 'admin@example.com', password: 'local-secret' });
  assert.deepEqual(readPendingEmulatorLogin(storage), {
    uid: 'admin', email: 'admin@example.com', password: 'local-secret',
  });
  clearPendingEmulatorLogin(storage);
  assert.equal(readPendingEmulatorLogin(storage), null);
  assert.throws(() => writePendingEmulatorLogin(storage, { email: 'missing@example.com' }), /inválidas/);
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
  assert.equal(resolveFirebaseEmulatorConfig(
    { DEV: true, MODE: 'emulator' }, { hostname: 'localhost' }, 'real',
  ).enabled, false);
  assert.equal(resolveFirebaseEmulatorConfig(
    { DEV: true, MODE: 'development' }, { hostname: 'localhost' }, 'emulator',
  ).enabled, true);
});

test('seletor local usa projeto demo no Emulator e nunca habilita Emulator no Hosting', () => {
  const real = {
    DEV: true,
    VITE_FIREBASE_API_KEY: 'real-key',
    VITE_FIREBASE_AUTH_DOMAIN: 'dashboard-pmba.firebaseapp.com',
    VITE_FIREBASE_PROJECT_ID: 'dashboard-pmba',
    VITE_FIREBASE_STORAGE_BUCKET: 'dashboard-pmba.firebasestorage.app',
    VITE_FIREBASE_MESSAGING_SENDER_ID: '1',
    VITE_FIREBASE_APP_ID: 'real-app',
  };
  const local = resolveFirebaseRuntimeConfig(real, { hostname: 'localhost' }, 'emulator');
  assert.equal(local.emulator.enabled, true);
  assert.equal(local.config.projectId, 'demo-dashboard-pmba-local');
  assert.match(local.config.apiKey, /^demo-/);
  const hosting = resolveFirebaseRuntimeConfig({ ...real, DEV: false }, { hostname: 'dashboard-pmba.web.app' }, 'emulator');
  assert.equal(hosting.emulator.enabled, false);
  assert.equal(hosting.config.projectId, 'dashboard-pmba');
});

test('preferência do ambiente Firebase aceita apenas real ou emulator', () => {
  const values = new Map();
  const storage = {
    getItem: (key) => values.get(key),
    setItem: (key, value) => values.set(key, value),
  };
  assert.equal(normalizeFirebaseMode('production'), '');
  assert.equal(readFirebaseModePreference(storage), '');
  writeFirebaseModePreference(storage, 'emulator');
  assert.equal(values.get(FIREBASE_MODE_STORAGE_KEY), 'emulator');
  assert.equal(readFirebaseModePreference(storage), 'emulator');
  assert.throws(() => writeFirebaseModePreference(storage, 'invalid'), /inválido/);
});

test('bootstrap de Auth preserva a sessão e não redireciona antes do estado inicial', async () => {
  const [firebaseConfigSource, appSource] = await Promise.all([
    readFile(new URL('../src/firebaseConfig.js', import.meta.url), 'utf8'),
    readFile(new URL('../src/App.jsx', import.meta.url), 'utf8'),
  ]);

  assert.match(firebaseConfigSource, /persistence:\s*emulatorConfig\.enabled[\s\S]*indexedDBLocalPersistence, browserLocalPersistence/);
  assert.match(firebaseConfigSource, /auth\.authStateReady\(\)/);
  assert.doesNotMatch(firebaseConfigSource, /setPersistence\(/);
  assert.doesNotMatch(appSource, /authTimeout/);
  assert.doesNotMatch(appSource, /setTimeout\(\(\) => \{\s*if \(active\) setLoading\(false\)/);
});
