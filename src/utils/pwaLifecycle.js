export const PWA_BEFORE_RELOAD_EVENT = 'modoqap-pwa-before-reload';
export const PWA_UPDATE_CHECK_INTERVAL_MS = 60 * 1000;

export function notifyBeforePwaReload(target = window) {
  target.dispatchEvent(new Event(PWA_BEFORE_RELOAD_EVENT));
}
