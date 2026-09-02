import { initializeApp, getApps, getApp } from "firebase/app";
import {
  connectFirestoreEmulator,
  getFirestore,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
} from "firebase/firestore";
import { browserLocalPersistence, connectAuthEmulator, getAuth, setPersistence } from "firebase/auth";
import { connectStorageEmulator, getStorage } from "firebase/storage";
import { connectFunctionsEmulator, getFunctions } from "firebase/functions";

const env = (typeof import.meta !== 'undefined' && import.meta.env)
  ? import.meta.env
  : globalThis.process?.env
  ? globalThis.process.env
  : {};

const nodeEntryPoint = String(globalThis.process?.argv?.[1] || '').replace(/\\/g, '/');
const isNodeTest = Boolean(
  globalThis.process?.env?.NODE_TEST_CONTEXT
  || /(?:^|\/)tests\/(?:runUnitTests\.mjs|[^/]+\.test\.mjs)$/.test(nodeEntryPoint)
);

export function resolveFirebaseConfig(sourceEnv = {}, { nodeTest = false } = {}) {
  if (nodeTest) {
    const testProjectId = String(sourceEnv.FIREBASE_TEST_PROJECT_ID || 'demo-modoqap-unit-tests');
    if (!testProjectId.startsWith('demo-')) {
      throw new Error('FIREBASE_TEST_PROJECT_ID deve usar o prefixo demo- para impedir acesso acidental a projeto real.');
    }
    return {
      apiKey: 'demo-key-not-for-network',
      authDomain: `${testProjectId}.firebaseapp.com`,
      projectId: testProjectId,
      storageBucket: `${testProjectId}.appspot.com`,
      messagingSenderId: '000000000000',
      appId: '1:000000000000:web:demo',
    };
  }

  const config = {
    apiKey: sourceEnv.VITE_FIREBASE_API_KEY,
    authDomain: sourceEnv.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: sourceEnv.VITE_FIREBASE_PROJECT_ID,
    storageBucket: sourceEnv.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: sourceEnv.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: sourceEnv.VITE_FIREBASE_APP_ID,
  };
  const missing = Object.entries(config).filter(([, value]) => !String(value || '').trim()).map(([key]) => key);
  if (missing.length) {
    throw new Error(`Configuracao Firebase obrigatoria ausente: ${missing.join(', ')}.`);
  }
  return config;
}

const app = getApps().length > 0
  ? getApp()
  : initializeApp(resolveFirebaseConfig(env, { nodeTest: isNodeTest }));

const isBrowser = typeof window !== 'undefined';

const db = isBrowser
  ? initializeFirestore(app, {
      localCache: persistentLocalCache({
        tabManager: persistentMultipleTabManager(),
      }),
    })
  : getFirestore(app);

if (isBrowser) {
  console.log("📦 Cache Offline configurado (API v10).");
}

const auth    = getAuth(app);
const storage = getStorage(app);
const functions = getFunctions(app, 'us-central1');

const authPersistenceReady = isBrowser
  ? setPersistence(auth, browserLocalPersistence).catch((error) => {
      console.warn('[Firebase] Persistencia local de autenticacao indisponivel:', error);
    })
  : Promise.resolve();

function emulatorPort(value, fallback) {
  const parsed = Number.parseInt(String(value || ''), 10);
  return Number.isInteger(parsed) && parsed > 0 && parsed <= 65535 ? parsed : fallback;
}

export function resolveFirebaseEmulatorConfig(sourceEnv = {}, browserLocation = {}) {
  const hostname = String(browserLocation.hostname || '').toLowerCase();
  const localHostname = hostname === 'localhost' || hostname === '127.0.0.1';
  const mode = String(sourceEnv.MODE || '').toLowerCase();
  const explicitOptIn = ['1', 'true', 'yes'].includes(String(sourceEnv.VITE_USE_FIREBASE_EMULATORS || '').toLowerCase()) || mode === 'emulator';
  return Object.freeze({
    enabled: sourceEnv.DEV === true && localHostname && explicitOptIn,
    host: String(sourceEnv.VITE_FIREBASE_EMULATOR_HOST || '127.0.0.1'),
    authPort: emulatorPort(sourceEnv.VITE_AUTH_EMULATOR_PORT, 9099),
    firestorePort: emulatorPort(sourceEnv.VITE_FIRESTORE_EMULATOR_PORT, 8085),
    functionsPort: emulatorPort(sourceEnv.VITE_FUNCTIONS_EMULATOR_PORT, 5001),
    storagePort: emulatorPort(sourceEnv.VITE_STORAGE_EMULATOR_PORT, 9199),
  });
}

const isFirebaseEmulator = (isBrowser && window.location)
  ? resolveFirebaseEmulatorConfig(env, window.location).enabled
  : false;

if (isBrowser && window.location) {
  const emulatorConfig = resolveFirebaseEmulatorConfig(env, window.location);
  if (emulatorConfig.enabled) {
    connectAuthEmulator(auth, `http://${emulatorConfig.host}:${emulatorConfig.authPort}`, { disableWarnings: true });
    connectFirestoreEmulator(db, emulatorConfig.host, emulatorConfig.firestorePort);
    connectFunctionsEmulator(functions, emulatorConfig.host, emulatorConfig.functionsPort);
    connectStorageEmulator(storage, emulatorConfig.host, emulatorConfig.storagePort);
    console.info('[Firebase] Emulators locais conectados.');
  } else {
    console.info('[Firebase] Conectado ao Firebase REAL (dashboard-pmba).');
  }
}

export { app, db, auth, storage, functions, authPersistenceReady, isFirebaseEmulator };
