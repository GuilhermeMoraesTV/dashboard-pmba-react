import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { __test } = require('../functions/index.js');

test('IA rejeita chamada anônima', () => {
  assert.throws(
    () => __test.validateAiRequest({ data: { prompt: 'teste' } }),
    (error) => error.code === 'permission-denied',
  );
});

test('IA normaliza superfície e limita tokens por requisição', () => {
  const request = __test.validateAiRequest({
    auth: { uid: 'u1' },
    data: { prompt: 'teste', surface: 'INVALIDA', maxOutputTokens: 999999 },
  });
  assert.equal(request.uid, 'u1');
  assert.equal(request.surface, 'outro');
  assert.equal(request.maxOutputTokens, 4096);
  assert.equal(__test.estimateTokenCost('12345678', 128), 130);
});
