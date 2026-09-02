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

test('agregado incremental recalcula somente o dia afetado e permanece deterministico', async () => {
  const rules = await import('../functions/gamification/domain.mjs');
  const sources = {
    records: [{ id: 'study-1', data: '2026-08-31', tempoEstudadoMinutos: 60, questoesFeitas: 20, acertos: 15 }],
    simulations: [],
    questionRewards: [],
    goals: [],
  };
  const first = __test.buildIncrementalDayState({ dateKey: '2026-08-31', sources, rules });
  const retry = __test.buildIncrementalDayState({ dateKey: '2026-08-31', sources, rules });

  assert.deepEqual(first, retry);
  assert.deepEqual(first.metrics, { minutes: 60, questions: 20, correct: 15 });
  assert.equal(first.counts.studies, 1);
  assert.equal(first.eventIds.length, 1);
  assert.equal(__test.payloadChanged(first, retry), false);
});
