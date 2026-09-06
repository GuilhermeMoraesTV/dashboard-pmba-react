import React, { lazy } from 'react';

/**
 * Carrega um componente lazy com tentativas de recuperacao automatica
 * em caso de oscilacao de rede, reinicio do servidor de desenvolvimento ou
 * atualizacao de versao (chunk hash expirado).
 *
 * @param {() => Promise<{ default: React.ComponentType<any> }>} componentImport
 * @param {Object} [options]
 * @param {number} [options.retries=2]
 * @param {number} [options.interval=1000]
 * @param {string} [options.name='']
 * @returns {React.LazyExoticComponent<React.ComponentType<any>>}
 */
export function lazyWithRetry(componentImport, { retries = 2, interval = 1000, name = '' } = {}) {
  return lazy(() => {
    return new Promise((resolve, reject) => {
      const attempt = (remaining) => {
        componentImport()
          .then(resolve)
          .catch((error) => {
            const isModuleFetchError = error?.name === 'TypeError'
              || /failed to fetch dynamically imported module/i.test(error?.message || '')
              || /loading chunk/i.test(error?.message || '')
              || /importing a module script failed/i.test(error?.message || '');

            if (remaining > 0 && isModuleFetchError) {
              console.warn(
                `[LazyRetry] Falha ao carregar ${name || 'modulo'}. Tentando novamente (${remaining} tentativas restantes)...`,
              );
              setTimeout(() => {
                attempt(remaining - 1);
              }, interval);
            } else {
              reject(error);
            }
          });
      };
      attempt(retries);
    });
  });
}
