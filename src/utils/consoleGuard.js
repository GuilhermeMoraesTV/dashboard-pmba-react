/**
 * Console Guard - Proteção e Bloqueio de Console em Produção
 * 
 * - Ambiente de Desenvolvimento: Console 100% ativo e livre.
 * - Ambiente de Produção (Usuários Comuns): Todo output do console é silenciado.
 * - Ambiente de Produção (Administradores): Console restaurado automaticamente para admins.
 */

const isDev = Boolean(
  (typeof import.meta !== 'undefined' && import.meta.env?.DEV) ||
  (globalThis.process?.env?.NODE_ENV === 'development' || globalThis.process?.env?.NODE_ENV === 'test')
);

const CONSOLE_METHODS = [
  'log',
  'info',
  'warn',
  'error',
  'debug',
  'table',
  'trace',
  'dir',
  'dirxml',
  'group',
  'groupCollapsed',
  'groupEnd',
  'time',
  'timeEnd',
  'timeLog',
  'count',
  'countReset',
  'assert',
  'clear',
];

const targetConsole = typeof window !== 'undefined' && window.console
  ? window.console
  : (typeof globalThis !== 'undefined' ? globalThis.console : null);

// Armazena cópias fiéis dos métodos nativos originais
const originalMethods = {};
if (targetConsole) {
  CONSOLE_METHODS.forEach((method) => {
    if (typeof targetConsole[method] === 'function') {
      originalMethods[method] = targetConsole[method].bind(targetConsole);
    }
  });
}

let adminOverride = false;

const noop = () => {};

/**
 * Silencia os métodos do console
 */
export function silenceConsole() {
  if (isDev || !targetConsole) return;
  if (adminOverride) return;

  CONSOLE_METHODS.forEach((method) => {
    try {
      targetConsole[method] = noop;
    } catch {}
  });

}

/**
 * Restaura os métodos nativos originais do console
 */
export function restoreConsole() {
  if (!targetConsole) return;

  CONSOLE_METHODS.forEach((method) => {
    if (originalMethods[method]) {
      try {
        targetConsole[method] = originalMethods[method];
      } catch {}
    }
  });

}

const hasStoredOverride = () => {
  try {
    if (typeof window === 'undefined') return false;
    return (
      window.sessionStorage?.getItem?.('debug_admin_console') === 'true' ||
      window.localStorage?.getItem?.('debug_admin_console') === 'true'
    );
  } catch {
    return false;
  }
};

/**
 * Sincroniza o estado do console de acordo com os privilégios do usuário
 * @param {boolean} isAdmin 
 */
export function syncConsoleAccess(isAdmin = false) {
  if (isDev) return;

  if (isAdmin) {
    restoreConsole();
  } else {
    // Se não for admin e não houver override explícito no storage, silencia
    if (!hasStoredOverride() && !adminOverride) {
      silenceConsole();
    }
  }
}

/**
 * Inicialização principal do Guard no boot da aplicação
 */
export function initConsoleGuard() {
  if (isDev || !targetConsole) return;

  if (hasStoredOverride()) {
    adminOverride = true;
    restoreConsole();
  } else {
    silenceConsole();
  }

  // Permite desbloqueio manual de emergência para admins no DevTools em produção
  if (typeof window !== 'undefined') {
    window.__UNLOCK_ADMIN_CONSOLE__ = () => {
      adminOverride = true;
      try {
        window.sessionStorage?.setItem('debug_admin_console', 'true');
      } catch {}
      restoreConsole();
      return '🔓 [Security] Console de Administrador ativado com sucesso.';
    };

    window.__LOCK_ADMIN_CONSOLE__ = () => {
      adminOverride = false;
      try {
        window.sessionStorage?.removeItem('debug_admin_console');
        window.localStorage?.removeItem('debug_admin_console');
      } catch {}
      silenceConsole();
      return '🔒 [Security] Console de produção silenciado.';
    };
  }
}
