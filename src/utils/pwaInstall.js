const INSTALL_STATE_EVENT = 'modoqap-pwa-install-state';

let deferredInstallPrompt = null;

export function isPwaInstalled() {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(display-mode: standalone)').matches
    || window.navigator.standalone === true;
}

export function isIosDevice() {
  if (typeof window === 'undefined') return false;
  return /iphone|ipad|ipod/i.test(window.navigator.userAgent);
}

function emitInstallState() {
  window.dispatchEvent(new CustomEvent(INSTALL_STATE_EVENT));
}

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    deferredInstallPrompt = event;
    emitInstallState();
  });

  window.addEventListener('appinstalled', () => {
    deferredInstallPrompt = null;
    emitInstallState();
  });
}

export function getPwaInstallState() {
  return {
    canPrompt: Boolean(deferredInstallPrompt),
    installed: isPwaInstalled(),
    isIos: isIosDevice(),
  };
}

export function subscribeToPwaInstallState(callback) {
  window.addEventListener(INSTALL_STATE_EVENT, callback);
  return () => window.removeEventListener(INSTALL_STATE_EVENT, callback);
}

export async function promptPwaInstall() {
  if (!deferredInstallPrompt) return null;

  const promptEvent = deferredInstallPrompt;
  await promptEvent.prompt();
  const choice = await promptEvent.userChoice;

  deferredInstallPrompt = null;
  emitInstallState();

  return choice?.outcome || null;
}
