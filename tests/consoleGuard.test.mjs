import test from 'node:test';
import assert from 'node:assert/strict';
import {
  initConsoleGuard,
  silenceConsole,
  restoreConsole,
  syncConsoleAccess,
} from '../src/utils/consoleGuard.js';

test('ConsoleGuard: funções exportadas existem e são invocáveis sem erros', () => {
  assert.equal(typeof initConsoleGuard, 'function');
  assert.equal(typeof silenceConsole, 'function');
  assert.equal(typeof restoreConsole, 'function');
  assert.equal(typeof syncConsoleAccess, 'function');

  // Executa para garantir que não lança erros em ambiente de teste
  initConsoleGuard();
  restoreConsole();
  syncConsoleAccess(true);
  syncConsoleAccess(false);
});
