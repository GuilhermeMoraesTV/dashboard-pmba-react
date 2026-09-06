const INSTALL_STATE_EVENT = 'modoqap-pwa-install-state';
const STORAGE_KEY = 'modoqap_pwa_installed_on_this_device';

let deferredInstallPrompt = typeof window !== 'undefined' ? (window.__deferredInstallPrompt || null) : null;

export function isPwaInstalled() {
  if (typeof window === 'undefined') return false;

  // 1. Verifica se a aplicação já está rodando em modo standalone (app instalado)
  const isStandalone =
    window.matchMedia('(display-mode: standalone)').matches ||
    window.navigator.standalone === true;

  if (isStandalone) {
    try {
      window.localStorage?.setItem(STORAGE_KEY, 'true');
    } catch {}
    return true;
  }

  // 2. Verifica no armazenamento local exclusivo deste dispositivo/navegador
  try {
    if (window.localStorage?.getItem(STORAGE_KEY) === 'true') {
      return true;
    }
  } catch {}

  return false;
}

export function isIosDevice() {
  if (typeof window === 'undefined') return false;
  const ua = window.navigator.userAgent || '';
  const isIosPlatform = /iphone|ipad|ipod/i.test(ua);
  const isIpadOs = window.navigator.platform === 'MacIntel' && (window.navigator.maxTouchPoints || 0) > 1;
  return isIosPlatform || isIpadOs;
}

function emitInstallState() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(INSTALL_STATE_EVENT));
  }
}

export function markPwaAsInstalledLocally() {
  try {
    window.localStorage?.setItem(STORAGE_KEY, 'true');
  } catch {}
  deferredInstallPrompt = null;
  if (typeof window !== 'undefined') {
    window.__deferredInstallPrompt = null;
  }
  emitInstallState();
}

if (typeof window !== 'undefined') {
  if (window.__deferredInstallPrompt) {
    deferredInstallPrompt = window.__deferredInstallPrompt;
  }

  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    try {
      window.localStorage?.removeItem(STORAGE_KEY);
    } catch {}
    deferredInstallPrompt = event;
    window.__deferredInstallPrompt = event;
    emitInstallState();
  });

  window.addEventListener('appinstalled', () => {
    try {
      window.localStorage?.setItem(STORAGE_KEY, 'true');
    } catch {}
    deferredInstallPrompt = null;
    if (typeof window !== 'undefined') {
      window.__deferredInstallPrompt = null;
    }
    emitInstallState();
  });
}

export function getPwaInstallState() {
  const prompt = deferredInstallPrompt || (typeof window !== 'undefined' ? window.__deferredInstallPrompt : null);
  return {
    canPrompt: Boolean(prompt),
    installed: isPwaInstalled(),
    isIos: isIosDevice(),
  };
}

export function subscribeToPwaInstallState(callback) {
  if (typeof window === 'undefined') return () => {};
  window.addEventListener(INSTALL_STATE_EVENT, callback);
  return () => window.removeEventListener(INSTALL_STATE_EVENT, callback);
}

export async function promptPwaInstall() {
  const promptEvent = deferredInstallPrompt || (typeof window !== 'undefined' ? window.__deferredInstallPrompt : null);
  if (!promptEvent) return null;

  try {
    await promptEvent.prompt();
    const choice = await promptEvent.userChoice;

    if (choice?.outcome === 'accepted') {
      try {
        window.localStorage?.setItem(STORAGE_KEY, 'true');
      } catch {}
    }

    deferredInstallPrompt = null;
    if (typeof window !== 'undefined') {
      window.__deferredInstallPrompt = null;
    }
    emitInstallState();

    return choice?.outcome || null;
  } catch (err) {
    console.warn('[PWA] Erro no prompt de instalação:', err);
    return null;
  }
}
