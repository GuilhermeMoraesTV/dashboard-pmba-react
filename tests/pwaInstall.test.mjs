import test from 'node:test';
import assert from 'node:assert/strict';
import {
  isPwaInstalled,
  isIosDevice,
  getPwaInstallState,
  promptPwaInstall,
  subscribeToPwaInstallState,
  markPwaAsInstalledLocally,
} from '../src/utils/pwaInstall.js';

test('PWA Install Unit Tests', async (t) => {
  let storage = {};
  const mockLocalStorage = {
    getItem: (k) => storage[k] || null,
    setItem: (k, v) => { storage[k] = String(v); },
    removeItem: (k) => { delete storage[k]; },
    clear: () => { storage = {}; },
  };

  const listeners = {};
  const mockWindow = {
    localStorage: mockLocalStorage,
    matchMedia: (query) => ({
      matches: query.includes('standalone') && mockWindow.__isStandalone,
    }),
    navigator: {
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0 Safari/537.36',
      platform: 'Win32',
      maxTouchPoints: 0,
    },
    addEventListener: (event, handler) => {
      if (!listeners[event]) listeners[event] = [];
      listeners[event].push(handler);
    },
    removeEventListener: (event, handler) => {
      if (listeners[event]) {
        listeners[event] = listeners[event].filter(h => h !== handler);
      }
    },
    dispatchEvent: (event) => {
      const type = event.type || event;
      if (listeners[type]) {
        listeners[type].forEach(h => h(event));
      }
      return true;
    },
    __isStandalone: false,
    __deferredInstallPrompt: null,
  };

  globalThis.window = mockWindow;
  globalThis.CustomEvent = class CustomEvent {
    constructor(type, eventInitDict) {
      this.type = type;
      this.detail = eventInitDict?.detail;
    }
  };

  t.afterEach(() => {
    storage = {};
    mockWindow.__isStandalone = false;
    mockWindow.__deferredInstallPrompt = null;
    mockWindow.navigator.userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0';
    mockWindow.navigator.platform = 'Win32';
    mockWindow.navigator.maxTouchPoints = 0;
  });

  await t.test('detects non-standalone when fresh', () => {
    assert.equal(isPwaInstalled(), false);
  });

  await t.test('detects standalone mode as installed', () => {
    mockWindow.__isStandalone = true;
    assert.equal(isPwaInstalled(), true);
  });

  await t.test('detects iOS device correctly', () => {
    mockWindow.navigator.userAgent = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)';
    assert.equal(isIosDevice(), true);

    // iPadOS with MacIntel and touch points
    mockWindow.navigator.userAgent = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)';
    mockWindow.navigator.platform = 'MacIntel';
    mockWindow.navigator.maxTouchPoints = 5;
    assert.equal(isIosDevice(), true);

    // Desktop Chrome
    mockWindow.navigator.userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0';
    mockWindow.navigator.platform = 'Win32';
    mockWindow.navigator.maxTouchPoints = 0;
    assert.equal(isIosDevice(), false);
  });

  await t.test('getPwaInstallState reflects deferredPrompt state', () => {
    mockWindow.__deferredInstallPrompt = {
      prompt: async () => {},
      userChoice: Promise.resolve({ outcome: 'accepted' }),
    };

    const state = getPwaInstallState();
    assert.equal(state.canPrompt, true);
    assert.equal(state.installed, false);
    assert.equal(state.isIos, false);
  });

  await t.test('promptPwaInstall executes prompt and marks installation on accepted', async () => {
    let promptCalled = false;
    mockWindow.__deferredInstallPrompt = {
      prompt: async () => { promptCalled = true; },
      userChoice: Promise.resolve({ outcome: 'accepted' }),
    };

    const outcome = await promptPwaInstall();
    assert.equal(outcome, 'accepted');
    assert.equal(promptCalled, true);
    assert.equal(mockLocalStorage.getItem('modoqap_pwa_installed_on_this_device'), 'true');
    assert.equal(mockWindow.__deferredInstallPrompt, null);
  });

  await t.test('subscribeToPwaInstallState notifies subscribers', () => {
    let notified = false;
    const unsubscribe = subscribeToPwaInstallState(() => {
      notified = true;
    });

    markPwaAsInstalledLocally();
    assert.equal(notified, true);
    unsubscribe();
  });
});
