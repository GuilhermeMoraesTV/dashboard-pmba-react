const INSTALL_STATE_EVENT = 'modoqap-pwa-install-state';
const STORAGE_KEY = 'modoqap_pwa_installed_on_this_device';

let deferredInstallPrompt = null;

export function isPwaInstalled() {
  if (typeof window === 'undefined') return false;

  // 1. Verifica no armazenamento local exclusivo deste dispositivo/navegador
  try {
    if (window.localStorage?.getItem(STORAGE_KEY) === 'true') {
      return true;
    }
  } catch {}

  // 2. Verifica se a aplicação já está rodando em modo standalone (app instalado)
  const isStandalone =
    window.matchMedia('(display-mode: standalone)').matches ||
    window.navigator.standalone === true;

  if (isStandalone) {
    try {
      window.localStorage?.setItem(STORAGE_KEY, 'true');
    } catch {}
    return true;
  }

  return false;
}

export function isIosDevice() {
  if (typeof window === 'undefined') return false;
  return /iphone|ipad|ipod/i.test(window.navigator.userAgent);
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
  emitInstallState();
}

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    deferredInstallPrompt = event;
    emitInstallState();
  });

  window.addEventListener('appinstalled', () => {
    try {
      window.localStorage?.setItem(STORAGE_KEY, 'true');
    } catch {}
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
  if (typeof window === 'undefined') return () => {};
  window.addEventListener(INSTALL_STATE_EVENT, callback);
  return () => window.removeEventListener(INSTALL_STATE_EVENT, callback);
}

export async function promptPwaInstall() {
  if (!deferredInstallPrompt) return null;

  const promptEvent = deferredInstallPrompt;
  try {
    await promptEvent.prompt();
    const choice = await promptEvent.userChoice;

    if (choice?.outcome === 'accepted') {
      try {
        window.localStorage?.setItem(STORAGE_KEY, 'true');
      } catch {}
    }

    deferredInstallPrompt = null;
    emitInstallState();

    return choice?.outcome || null;
  } catch (err) {
    console.warn('[PWA] Erro no prompt de instalação:', err);
    return null;
  }
}
