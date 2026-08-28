import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { __test } = require('../functions/gamification/service.js');

test('perfil público publica somente os editais dos planejamentos ativos', () => {
  const editais = __test.buildPublicEditais({
    cycles: [
      { id: 'cycle-active', ativo: true, editalId: 'pmba', editalNome: 'PMBA' },
      { id: 'cycle-old', ativo: false, editalId: 'pmsp', editalNome: 'PMSP' },
    ],
    schedules: [
      { id: 'schedule-active', ativo: true, editalId: 'pcma', editalNome: 'PCMA' },
      { id: 'schedule-archived', ativo: true, arquivado: true, editalId: 'prf', editalNome: 'PRF' },
    ],
  });

  assert.deepEqual(editais.map((edital) => edital.name), ['PMBA', 'PCMA']);
});

test('XP de conquista vem do documento desbloqueado e nao duplica pelo evento de notificacao', () => {
  const total = __test.calculatePersistedNonAcademicXP({
    achievements: [{ id: 'reviews_100', unlocked: true, xp: 500, xpGranted: 500 }],
    events: [
      { id: 'achievement_reviews_100', category: 'achievement', xpTotal: 500 },
      { id: 'reward_week', category: 'reward', xpTotal: 100 },
    ],
  });

  assert.equal(total, 600);
});
