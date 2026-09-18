export const FIREBASE_MODE_STORAGE_KEY = 'modoqap_firebase_mode';
export const FIREBASE_EMULATOR_CONTROL_ENDPOINT = '/__modoqap/firebase-emulators/start';
export const FIREBASE_EMULATOR_MIRROR_ENDPOINT = '/__modoqap/firebase-emulators/mirror-user';
export const FIREBASE_EMULATOR_LOGIN_KEY = 'modoqap_firebase_emulator_login';
export const FIREBASE_EMULATOR_SESSION_KEY = 'modoqap_firebase_emulator_session';

export function normalizeFirebaseMode(value) {
  return value === 'emulator' || value === 'real' ? value : '';
}

export function readFirebaseModePreference(storage) {
  try {
    return normalizeFirebaseMode(storage?.getItem?.(FIREBASE_MODE_STORAGE_KEY));
  } catch {
    return '';
  }
}

export function writeFirebaseModePreference(storage, mode) {
  const normalized = normalizeFirebaseMode(mode);
  if (!normalized) throw new Error('Modo Firebase inválido.');
  storage?.setItem?.(FIREBASE_MODE_STORAGE_KEY, normalized);
  return normalized;
}

export function isLocalDevelopment(sourceEnv = {}, browserLocation = {}) {
  const hostname = String(browserLocation.hostname || '').toLowerCase();
  return sourceEnv.DEV === true && (hostname === 'localhost' || hostname === '127.0.0.1');
}

export async function ensureFirebaseEmulators(fetchImpl = globalThis.fetch) {
  if (typeof fetchImpl !== 'function') throw new Error('Controle local dos emuladores indisponível.');
  const response = await fetchImpl(FIREBASE_EMULATOR_CONTROL_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok || result.ready !== true) {
    throw new Error(result.message || 'Não foi possível iniciar os Firebase Emulators.');
  }
  return result;
}

export function writePendingEmulatorLogin(storage, credentials) {
  if (!credentials?.email || !credentials?.password || !credentials?.uid) {
    throw new Error('Credenciais temporárias do Emulator inválidas.');
  }
  storage?.setItem?.(FIREBASE_EMULATOR_LOGIN_KEY, JSON.stringify({
    email: String(credentials.email),
    password: String(credentials.password),
    uid: String(credentials.uid),
  }));
}

export function readPendingEmulatorLogin(storage) {
  try {
    const parsed = JSON.parse(storage?.getItem?.(FIREBASE_EMULATOR_LOGIN_KEY) || 'null');
    return parsed?.email && parsed?.password && parsed?.uid ? parsed : null;
  } catch {
    return null;
  }
}

export function clearPendingEmulatorLogin(storage) {
  storage?.removeItem?.(FIREBASE_EMULATOR_LOGIN_KEY);
}

export function writeEmulatorSessionIdentity(storage, identity) {
  if (!identity?.uid || !identity?.email) throw new Error('Identidade de sessão do Emulator inválida.');
  storage?.setItem?.(FIREBASE_EMULATOR_SESSION_KEY, JSON.stringify({
    uid: String(identity.uid),
    email: String(identity.email),
  }));
}

export function readEmulatorSessionIdentity(storage) {
  try {
    const parsed = JSON.parse(storage?.getItem?.(FIREBASE_EMULATOR_SESSION_KEY) || 'null');
    return parsed?.uid && parsed?.email ? { uid: String(parsed.uid), email: String(parsed.email) } : null;
  } catch {
    return null;
  }
}

export function clearEmulatorSessionIdentity(storage) {
  storage?.removeItem?.(FIREBASE_EMULATOR_SESSION_KEY);
}

export async function mirrorFirebaseUserToEmulator(user, fetchImpl = globalThis.fetch) {
  if (typeof fetchImpl !== 'function') throw new Error('Espelhamento local indisponível.');
  const response = await fetchImpl(FIREBASE_EMULATOR_MIRROR_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(user),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok || result.ready !== true) {
    throw new Error(result.message || 'Não foi possível preparar o usuário no Auth Emulator.');
  }
  return result;
}
