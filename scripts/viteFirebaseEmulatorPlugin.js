import { execSync, spawn } from 'node:child_process';
import crypto from 'node:crypto';
import { Buffer } from 'node:buffer';
import { closeSync, mkdirSync, openSync, readFileSync } from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const endpoint = '/__modoqap/firebase-emulators/start';
const mirrorEndpoint = '/__modoqap/firebase-emulators/mirror-user';
const emulatorProjectId = 'demo-dashboard-pmba-local';
const ports = Object.freeze([9099, 8085, 5001, 9199]);
const functionsProbeUrl = `http://127.0.0.1:5001/${emulatorProjectId}/us-central1/ensureUserSubscription`;
let emulatorProcess = null;
let emulatorStartPromise = null;

function isLoopbackAddress(address = '') {
  return ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(String(address));
}

function portIsOpen(port, timeoutMs = 1200) {
  return new Promise((resolve) => {
    const socket = net.createConnection({ host: '127.0.0.1', port });
    const finish = (open) => { socket.destroy(); resolve(open); };
    socket.setTimeout(timeoutMs);
    socket.once('connect', () => finish(true));
    socket.once('timeout', () => finish(false));
    socket.once('error', () => finish(false));
  });
}

async function readPortStatus() {
  const states = await Promise.all(ports.map(async (port) => [port, await portIsOpen(port)]));
  return Object.fromEntries(states);
}

async function functionsAreReady(timeoutMs = 1500) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(functionsProbeUrl, {
      method: 'OPTIONS',
      headers: {
        Origin: 'http://localhost:5173',
        'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': 'content-type',
      },
      signal: controller.signal,
    });
    return response.status === 204
      && Boolean(response.headers.get('access-control-allow-origin'));
  } catch {
    return false;
  } finally {
    clearTimeout(timeout);
  }
}

async function emulatorsAreReady(status = null) {
  const current = status || await readPortStatus();
  return Object.values(current).every(Boolean) && await functionsAreReady();
}

function tailLog(file, maximum = 1800) {
  try {
    const content = readFileSync(file, 'utf8');
    return content.slice(-maximum).replaceAll(projectRoot, '<workspace>');
  } catch {
    return '';
  }
}

function startEmulatorProcess() {
  const logsDirectory = path.join(projectRoot, 'tmp', 'firebase-emulator-control');
  mkdirSync(logsDirectory, { recursive: true });
  const outputPath = path.join(logsDirectory, 'emulators.out.log');
  const errorPath = path.join(logsDirectory, 'emulators.err.log');
  const output = openSync(outputPath, 'w');
  const error = openSync(errorPath, 'w');
  const executable = globalThis.process.platform === 'win32' ? 'powershell.exe' : 'pwsh';
  const script = path.join(projectRoot, 'scripts', 'start-firebase-emulators.ps1');
  emulatorProcess = spawn(executable, ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', script], {
    cwd: projectRoot,
    windowsHide: true,
    stdio: ['ignore', output, error],
  });
  emulatorProcess.once('exit', () => {
    closeSync(output);
    closeSync(error);
    emulatorProcess = null;
  });
  return { outputPath, errorPath };
}

function killProcessesOnPorts(targetPorts = []) {
  try {
    if (globalThis.process.platform === 'win32') {
      const portList = targetPorts.join(', ');
      execSync(`powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "Get-NetTCPConnection -LocalPort ${portList} -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique | ForEach-Object { if ($_ -and $_ -ne $PID) { Stop-Process -Id $_ -Force -ErrorAction SilentlyContinue } }"`, { stdio: 'ignore' });
    }
  } catch (err) {
    console.warn('[Firebase Emulator Control] Aviso ao liberar portas antigas:', err?.message || err);
  }
}

async function ensureEmulatorsReady() {
  let status = await readPortStatus();
  if (await emulatorsAreReady(status)) return { ready: true, alreadyRunning: true, ports: status };

  // Tentativa de confirmação rápida para evitar falsos negativos em conexões locais ocupadas
  for (let attempt = 0; attempt < 3; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 300));
    status = await readPortStatus();
    if (await emulatorsAreReady(status)) return { ready: true, alreadyRunning: true, ports: status };
  }

  if (emulatorStartPromise) return emulatorStartPromise;
  emulatorStartPromise = (async () => {
    const logs = startEmulatorProcess();
    const deadline = Date.now() + 90000;
    while (Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, 500));
      const current = await readPortStatus();
      if (await emulatorsAreReady(current)) return { ready: true, alreadyRunning: false, ports: current };
      if (!emulatorProcess) {
        const detail = tailLog(logs.errorPath) || tailLog(logs.outputPath);
        throw new Error(`Firebase Emulators encerraram antes de iniciar.${detail ? ` ${detail}` : ''}`);
      }
    }
    throw new Error('Firebase Emulators não ficaram prontos em 90 segundos. Consulte tmp/firebase-emulator-control.');
  })().finally(() => { emulatorStartPromise = null; });
  return emulatorStartPromise;
}

function sendJson(response, status, payload) {
  response.statusCode = status;
  response.setHeader('Content-Type', 'application/json; charset=utf-8');
  response.end(JSON.stringify(payload));
}

function readJsonBody(request, maximumBytes = 16 * 1024) {
  return new Promise((resolve, reject) => {
    let body = '';
    request.setEncoding('utf8');
    request.on('data', (chunk) => {
      body += chunk;
      if (Buffer.byteLength(body, 'utf8') > maximumBytes) reject(new Error('Payload local excede o limite permitido.'));
    });
    request.on('end', () => {
      try { resolve(JSON.parse(body || '{}')); } catch { reject(new Error('Payload JSON inválido.')); }
    });
    request.on('error', reject);
  });
}

const LEGACY_ADMIN_UID = 'OLoJi457GQNE2eTSOcz9DAD6ppZ2';

function normalizeMirrorUserPayload(payload = {}) {
  const uid = String(payload.uid || '').trim();
  const email = String(payload.email || '').trim().toLowerCase();
  if (!/^[A-Za-z0-9:_-]{1,128}$/.test(uid)) throw new Error('UID inválido para espelhamento local.');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) throw new Error('E-mail inválido para espelhamento local.');
  const isAdmin = payload.isAdmin === true || uid === LEGACY_ADMIN_UID;
  const defaultPermissions = {
    adminPanel: isAdmin,
    manageBroadcasts: isAdmin,
    manageTemplates: isAdmin,
    viewAdminAnalytics: isAdmin,
  };
  const requestedAccess = payload.access && typeof payload.access === 'object' ? payload.access : {};
  const localPassword = payload.localPassword == null ? null : String(payload.localPassword);
  if (localPassword && (localPassword.length < 6 || Buffer.byteLength(localPassword, 'utf8') > 4096)) {
    throw new Error('Senha local inválida para o Auth Emulator.');
  }
  return {
    uid,
    email,
    displayName: String(payload.displayName || '').trim().slice(0, 120),
    photoURL: /^https?:\/\//i.test(String(payload.photoURL || '')) ? String(payload.photoURL).slice(0, 2048) : null,
    localPassword,
    access: {
      version: 1,
      migrationPhase: 'emulator_identity_mirror',
      role: isAdmin ? 'admin' : 'student',
      adminRole: isAdmin ? (['admin', 'super_admin'].includes(requestedAccess.adminRole) ? requestedAccess.adminRole : 'super_admin') : null,
      permissions: defaultPermissions,
    },
  };
}

async function mirrorUserToEmulator(payload) {
  await ensureEmulatorsReady();
  const profile = normalizeMirrorUserPayload(payload);
  const restoreOnly = payload?.restoreOnly === true;
  globalThis.process.env.FIREBASE_AUTH_EMULATOR_HOST = '127.0.0.1:9099';
  globalThis.process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8085';
  const [{ initializeApp, getApps }, { getAuth }, { getFirestore, FieldValue }] = await Promise.all([
    import('firebase-admin/app'), import('firebase-admin/auth'), import('firebase-admin/firestore'),
  ]);
  const appName = 'modoqap-emulator-identity-bridge';
  const app = getApps().find((candidate) => candidate.name === appName)
    || initializeApp({ projectId: emulatorProjectId }, appName);
  const emulatorAuth = getAuth(app);
  const findUser = async (loader) => {
    try { return await loader(); } catch (error) {
      if (error?.code === 'auth/user-not-found') return null;
      throw error;
    }
  };
  const [uidUser, emailUser] = await Promise.all([
    findUser(() => emulatorAuth.getUser(profile.uid)),
    findUser(() => emulatorAuth.getUserByEmail(profile.email)),
  ]);
  // If an account with this email exists under a different UID, remove the stale
  // account so the authentic production UID is guaranteed on localhost.
  if (emailUser && emailUser.uid !== profile.uid) {
    await emulatorAuth.deleteUser(emailUser.uid).catch(() => undefined);
  }
  const password = profile.localPassword || `Local-${crypto.randomBytes(24).toString('base64url')}!`;
  const authData = {
    email: profile.email,
    password,
    emailVerified: true,
    displayName: profile.displayName || undefined,
    photoURL: profile.photoURL || undefined,
  };
  if (uidUser) {
    await emulatorAuth.updateUser(profile.uid, authData);
  } else {
    await emulatorAuth.createUser({ uid: profile.uid, ...authData });
  }
  if (restoreOnly) {
    return { ready: true, uid: profile.uid, email: profile.email, password };
  }
  await emulatorAuth.setCustomUserClaims(profile.uid, {
    admin: profile.access.role === 'admin' || profile.access.adminRole != null,
    role: profile.access.role,
  }).catch(() => undefined);
  const firestore = getFirestore(app);
  await firestore.collection('users').doc(profile.uid).set({
    uid: profile.uid,
    name: profile.displayName,
    displayName: profile.displayName,
    email: profile.email,
    photoURL: profile.photoURL,
    access: profile.access,
    emulatorMirror: { sourceUid: profile.uid, mirroredAt: FieldValue.serverTimestamp() },
  }, { merge: true });
  return { ready: true, uid: profile.uid, email: profile.email, password };
}

const monetizationApplyEndpoint = '/__modoqap/monetization-dev/apply-state';
const monetizationResetEndpoint = '/__modoqap/monetization-dev/reset-subscription';

async function getDevAdminFirestore() {
  const isFirestoreActive = await portIsOpen(8085);
  if (!isFirestoreActive) {
    throw new Error('Firestore Emulator (porta 8085) não está ativo. O painel de teste exige o Emulator rodando.');
  }
  globalThis.process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8085';
  globalThis.process.env.FIREBASE_AUTH_EMULATOR_HOST = '127.0.0.1:9099';

  const [{ initializeApp, getApps }, { getFirestore, FieldValue, Timestamp }] = await Promise.all([
    import('firebase-admin/app'),
    import('firebase-admin/firestore'),
  ]);

  const appName = 'modoqap-emulator-dev-test';
  const app = getApps().find((candidate) => candidate.name === appName)
    || initializeApp({ projectId: emulatorProjectId }, appName);

  return { firestore: getFirestore(app), FieldValue, Timestamp };
}

async function applyMonetizationStateDev(payload = {}) {
  const { firestore, FieldValue, Timestamp } = await getDevAdminFirestore();

  const toTimestamp = (val) => {
    if (!val) return null;
    const d = new Date(val);
    return Number.isNaN(d.getTime()) ? null : Timestamp.fromDate(d);
  };

  // 1. Atualiza configuração global de monetização
  if (payload.monetizationPhase) {
    const configUpdate = {
      monetizationPhase: String(payload.monetizationPhase),
      founderProgram: {
        isOpen: Boolean(payload.founderProgram?.isOpen),
        priceYearly: Number(payload.founderProgram?.priceYearly) || 97,
        openedAt: toTimestamp(payload.founderProgram?.openedAt),
        closedAt: toTimestamp(payload.founderProgram?.closedAt),
      },
      trialConfig: {
        durationDays: Number(payload.trialConfig?.durationDays) || 7,
      },
      updatedAt: FieldValue.serverTimestamp(),
    };
    await firestore.collection('system_config').doc('monetization').set(configUpdate, { merge: true });
  }

  // 2. Atualiza assinatura do usuário de teste
  if (payload.uid && payload.subscription) {
    const sub = payload.subscription;
    const subUpdate = {
      plan: String(sub.plan || 'FREE_TRIAL'),
      status: String(sub.status || 'ACTIVE'),
      trialStartedAt: toTimestamp(sub.trialStartedAt),
      trialEndsAt: toTimestamp(sub.trialEndsAt),
      founder: Boolean(sub.founder),
      founderSince: toTimestamp(sub.founderSince),
      founderEligible: Boolean(sub.founderEligible),
      founderEligibleAt: toTimestamp(sub.founderEligibleAt),
      updatedAt: FieldValue.serverTimestamp(),
    };
    await firestore.collection('users').doc(String(payload.uid)).set({ subscription: subUpdate }, { merge: true });
  }

  return { ready: true, success: true, appliedAt: new Date().toISOString() };
}

async function resetSubscriptionDev(payload = {}) {
  const uid = String(payload.uid || '').trim();
  if (!uid) throw new Error('UID do usuário é obrigatório para reset.');

  const { firestore, FieldValue } = await getDevAdminFirestore();
  await firestore.collection('users').doc(uid).update({
    subscription: FieldValue.delete(),
  }).catch(async (_err) => {
    // Se o documento existe mas o update falhou (ou campo já não existia), define como nulo
    await firestore.collection('users').doc(uid).set({ subscription: null }, { merge: true });
  });

  return { ready: true, success: true, resetUid: uid, resetAt: new Date().toISOString() };
}

export function firebaseEmulatorControlPlugin() {
  return {
    name: 'modoqap-firebase-emulator-control',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use(async (request, response, next) => {
        const allowedUrls = [endpoint, mirrorEndpoint, monetizationApplyEndpoint, monetizationResetEndpoint];
        if (!allowedUrls.includes(request.url)) return next();
        if (request.method !== 'POST') return sendJson(response, 405, { ready: false, message: 'Método não permitido.' });
        if (!isLoopbackAddress(request.socket.remoteAddress)) {
          return sendJson(response, 403, { ready: false, message: 'Controle disponível somente no computador local.' });
        }
        try {
          if (request.url === mirrorEndpoint) {
            response.setHeader('Cache-Control', 'no-store');
            return sendJson(response, 200, await mirrorUserToEmulator(await readJsonBody(request)));
          }
          if (request.url === monetizationApplyEndpoint) {
            response.setHeader('Cache-Control', 'no-store');
            return sendJson(response, 200, await applyMonetizationStateDev(await readJsonBody(request)));
          }
          if (request.url === monetizationResetEndpoint) {
            response.setHeader('Cache-Control', 'no-store');
            return sendJson(response, 200, await resetSubscriptionDev(await readJsonBody(request)));
          }
          return sendJson(response, 200, await ensureEmulatorsReady());
        } catch (error) {
          return sendJson(response, 503, { ready: false, message: String(error?.message || error).slice(0, 2200) });
        }
      });
    },
  };
}

export const firebaseEmulatorControlInternals = Object.freeze({
  isLoopbackAddress,
  normalizeMirrorUserPayload,
  functionsAreReady,
  emulatorsAreReady,
  applyMonetizationStateDev,
  resetSubscriptionDev,
});
