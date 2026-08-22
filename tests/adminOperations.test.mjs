import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { __test } = require('../functions/index.js');

test('admin reconhece formatos de acesso atuais e preserva aluno comum', () => {
  assert.equal(__test.admin.isAdminAccess('legacy', { access: { role: 'student' } }), false);
  assert.equal(__test.admin.isAdminAccess('u1', { access: { role: 'admin' } }), true);
  assert.equal(__test.admin.isAdminAccess('u2', { access: { permissions: { adminPanel: true } } }), true);
  assert.equal(__test.admin.isAdminAccess('u3', { role: 'admin' }), true);
});

test('admin normaliza estatisticas academicas sem aceitar valores negativos', () => {
  assert.deepEqual(__test.admin.studyStats({ tempoEstudadoMinutos: 35, questoesFeitas: 20, acertos: 14 }), {
    minutes: 35,
    questions: 20,
    correct: 14,
  });
  assert.deepEqual(__test.admin.simulationStats({ resumo: { totalQuestoes: 50, totalAcertos: 41 }, tempoGastoMinutos: 90 }), {
    minutes: 90,
    questions: 50,
    correct: 41,
  });
  assert.equal(__test.admin.numeric(-20), 0);
});

test('auditoria compacta payloads e elimina valores indefinidos', () => {
  assert.equal(__test.admin.compactObject(undefined), null);
  assert.equal(__test.admin.compactObject('x'.repeat(800)).length, 500);
  assert.deepEqual(__test.admin.compactObject({ nested: { secret: { deep: true } } }), {
    nested: { secret: '[resumo omitido]' },
  });
});
