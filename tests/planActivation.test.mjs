import test from 'node:test';
import assert from 'node:assert/strict';
import { isPlanActivationBlocked } from '../src/utils/planActivation.js';

test('timer bloqueia apenas a ativacao de planejamento do mesmo tipo', () => {
  assert.equal(isPlanActivationBlocked(true, 'cronograma', 'ciclo'), false);
  assert.equal(isPlanActivationBlocked(true, 'ciclo', 'cronograma'), false);
  assert.equal(isPlanActivationBlocked(true, 'cronograma', 'cronograma'), true);
  assert.equal(isPlanActivationBlocked(true, 'ciclo', 'ciclo'), true);
});

test('sem timer permite ambos; sessao sem contexto preserva protecao', () => {
  for (const target of ['ciclo', 'cronograma']) {
    assert.equal(isPlanActivationBlocked(false, null, target), false);
    assert.equal(isPlanActivationBlocked(true, null, target), true);
  }
});
