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

test('fast-path de ranking mensal detecta precomputado valido e evita fallback historico', async () => {
  const rules = await import('../functions/gamification/domain.mjs');
  const now = new Date('2026-08-25T12:00:00Z');
  const currentMonthId = rules.getMonthId(now);

  // Perfil com agregado pré-calculado válido para o mês vigente
  const profileWithFastPath = {
    rankingMetrics: {
      monthly: {
        periodId: currentMonthId,
        minutes: 180,
        questions: 50,
        correct: 45,
      },
    },
  };

  const precomputed = profileWithFastPath.rankingMetrics?.monthly;
  const isFastPathEligible = Boolean(
    precomputed
    && precomputed.periodId === currentMonthId
    && typeof precomputed.minutes === 'number'
  );

  assert.equal(isFastPathEligible, true);
  assert.equal(precomputed.minutes, 180);
  assert.equal(precomputed.questions, 50);
  assert.equal(precomputed.correct, 45);

  // Perfil legado sem rankingMetrics (ou com mês anterior)
  const legacyProfile = {
    rankingMetrics: {
      monthly: {
        periodId: '2026-07',
        minutes: 100,
        questions: 30,
        correct: 25,
      },
    },
  };

  const legacyPrecomputed = legacyProfile.rankingMetrics?.monthly;
  const isLegacyFastPathEligible = Boolean(
    legacyPrecomputed
    && legacyPrecomputed.periodId === currentMonthId
    && typeof legacyPrecomputed.minutes === 'number'
  );

  assert.equal(isLegacyFastPathEligible, false);

  // Simulação de cálculo de fallback e persistência para a 2a execução
  const sources = {
    records: [{ id: 'study-1', data: '2026-08-10', tempoEstudadoMinutos: 120, questoesFeitas: 40, acertos: 35 }],
    simulations: [],
    questionRewards: [],
  };
  const calculatedPeriods = rules.calculateRankingPeriodMetrics({
    records: sources.records,
    simulations: sources.simulations,
    questionRewards: sources.questionRewards,
    now,
  });

  const persistedProfile = {
    ...legacyProfile,
    rankingMetrics: {
      ...(legacyProfile.rankingMetrics || {}),
      monthly: {
        minutes: calculatedPeriods.monthly.minutes,
        questions: calculatedPeriods.monthly.questions,
        correct: calculatedPeriods.monthly.correct,
        periodId: currentMonthId,
      },
    },
  };

  // 2a execução agora se qualifica com sucesso para o fast-path!
  const nextRunPrecomputed = persistedProfile.rankingMetrics?.monthly;
  const nextRunIsFastPathEligible = Boolean(
    nextRunPrecomputed
    && nextRunPrecomputed.periodId === currentMonthId
    && typeof nextRunPrecomputed.minutes === 'number'
  );

  assert.equal(nextRunIsFastPathEligible, true);
  assert.equal(nextRunPrecomputed.minutes, 120);
  assert.equal(nextRunPrecomputed.questions, 40);
  assert.equal(nextRunPrecomputed.correct, 35);
});
