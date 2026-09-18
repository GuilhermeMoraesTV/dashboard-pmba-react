import { deleteApp, initializeApp } from 'firebase/app';
import {
  getAuth,
  inMemoryPersistence,
  setPersistence,
  signInWithEmailAndPassword,
  signOut,
} from 'firebase/auth';
import { LEGACY_ADMIN_UID } from '../../auth/accessControl.js';
import { auth, isFirebaseEmulator, resolveRealFirebaseConfig } from '../../firebaseConfig.js';
import {
  mirrorFirebaseUserToEmulator,
  writeEmulatorSessionIdentity,
} from '../../utils/firebaseEnvironment.js';

const EMULATOR_IDENTITY_ERRORS = new Set([
  'auth/invalid-credential',
  'auth/user-not-found',
  'auth/wrong-password',
]);

export function shouldRecoverEmulatorIdentity(error, emulatorEnabled = isFirebaseEmulator) {
  return emulatorEnabled === true && EMULATOR_IDENTITY_ERRORS.has(error?.code);
}

async function verifyRealFirebaseCredentials(email, password) {
  const suffix = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const realApp = initializeApp(resolveRealFirebaseConfig(), `modoqap-real-auth-check-${suffix}`);
  const realAuth = getAuth(realApp);

  try {
    await setPersistence(realAuth, inMemoryPersistence);
    const credential = await signInWithEmailAndPassword(realAuth, email, password);
    return {
      uid: credential.user.uid,
      email: credential.user.email || email,
      displayName: credential.user.displayName || '',
      photoURL: credential.user.photoURL || '',
    };
  } finally {
    await signOut(realAuth).catch(() => undefined);
    await deleteApp(realApp).catch(() => undefined);
  }
}

export async function signInWithEmulatorIdentityRecovery(
  { email, password, persistence },
  adapters = {},
) {
  const targetAuth = adapters.auth || auth;
  const persist = adapters.setPersistence || setPersistence;
  const signIn = adapters.signIn || signInWithEmailAndPassword;
  const emulatorEnabled = adapters.emulatorEnabled ?? isFirebaseEmulator;
  const verifyReal = adapters.verifyRealCredentials || verifyRealFirebaseCredentials;
  const mirror = adapters.mirrorUser || mirrorFirebaseUserToEmulator;
  const saveSessionIdentity = adapters.saveSessionIdentity || ((identity) => {
    if (typeof window !== 'undefined') writeEmulatorSessionIdentity(window.sessionStorage, identity);
  });

  await persist(targetAuth, emulatorEnabled ? inMemoryPersistence : persistence);

  let credential;
  try {
    credential = await signIn(targetAuth, email, password);
  } catch (error) {
    if (!shouldRecoverEmulatorIdentity(error, emulatorEnabled)) throw error;
  }

  if (credential) {
    if (emulatorEnabled) saveSessionIdentity({ uid: credential.user.uid, email });
    return credential;
  }

  // The production password is checked by Firebase Auth itself. Only after a
  // successful check do we copy the identity and the same password to localhost.
  const realUser = await verifyReal(email, password);
  await mirror({
    ...realUser,
    isAdmin: realUser.uid === LEGACY_ADMIN_UID,
    access: realUser.uid === LEGACY_ADMIN_UID ? { adminRole: 'super_admin' } : {},
    localPassword: password,
  });

  credential = await signIn(targetAuth, email, password);
  saveSessionIdentity({ uid: credential.user.uid, email });
  return credential;
}
