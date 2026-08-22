import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ACHIEVEMENTS,
  buildAcademicXPEvents,
  calculateRankingPeriodMetrics,
  calculateActivityXP,
  evaluateAchievements,
  GAMIFICATION_CONFIG,
  getLeagueMovement,
  getLevelFromXP,
  getLevelProgress,
  getPromotionRelegationCounts,
  getRankingZone,
  getWeekId,
  getXPForLevel,
  LEAGUES,
  roundMigrationBaseXP,
  sortCompetitiveMembers,
  sortGeneralRankingMembers,
  sortGroupsRanking,
} from '../src/utils/gamification.js';

test('curva V2 respeita limites iniciais, marcos e nível de 500 XP', () => {
  assert.equal(getLevelFromXP(0), 1);
  assert.equal(getLevelFromXP(149), 1);
  assert.equal(getLevelFromXP(150), 2);
  assert.equal(getLevelFromXP(500), 3);
  assert.equal(getXPForLevel(20), 8000);
  assert.equal(getXPForLevel(50), 53000);
  assert.equal(getXPForLevel(75), 124875);
  assert.equal(getXPForLevel(100), 228000);
  const progress = getLevelProgress(500);
  assert.equal(progress.currentLevel, 3);
  assert.equal(progress.levelStartXP, 350);
  assert.equal(progress.nextLevelXP, 600);
  assert.equal(progress.xpToNextLevel, 100);
});

test('3h, 40 questões e 30 acertos concedem exatamente 255 XP', () => {
  assert.equal(calculateActivityXP({ minutes: 180, questions: 40, correct: 30 }), 255);
});

test('blocos incompletos não arredondam e métricas compartilham blocos do dia', () => {
  const events = buildAcademicXPEvents({
    records: [
      { id: 'a', data: '2026-08-20', timestamp: '2026-08-20T09:00:00-03:00', tempoEstudadoMinutos: 6 },
      { id: 'b', data: '2026-08-20', timestamp: '2026-08-20T10:00:00-03:00', tempoEstudadoMinutos: 13 },
    ],
  });
  assert.equal(events[0].breakdown.time, 0);
  assert.equal(events[1].breakdown.time, 10);
  assert.equal(events.reduce((sum, event) => sum + event.breakdown.time, 0), 10);
});

test('estudos e simulados compartilham limites diários sem bloquear salvamento', () => {
  const events = buildAcademicXPEvents({
    records: [{ id: 'study', data: '2026-08-20', timestamp: '2026-08-20T08:00:00-03:00', tempoEstudadoMinutos: 600, questoesFeitas: 400, acertos: 350 }],
    simulations: [{ id: 'sim', data: '2026-08-20', timestamp: '2026-08-20T12:00:00-03:00', durationMinutes: 300, resumo: { totalQuestoes: 200, totalAcertos: 180 } }],
  });
  const totals = events.reduce((sum, event) => ({ time: sum.time + event.breakdown.time, questions: sum.questions + event.breakdown.questions, correct: sum.correct + event.breakdown.correct }), { time: 0, questions: 0, correct: 0 });
  assert.equal(totals.time, GAMIFICATION_CONFIG.dailyLimits.minutes);
  assert.equal(totals.questions, GAMIFICATION_CONFIG.dailyLimits.questions);
  assert.equal(totals.correct, GAMIFICATION_CONFIG.dailyLimits.correct);
  assert.equal(events.find((event) => event.sourceType === 'simulation').breakdown.simulation, 25);
});

test('limites de registro, precisão, revisão e simulado são aplicados por dia', () => {
  const records = Array.from({ length: 12 }, (_, index) => ({
    id: `review-${index}`,
    data: '2026-08-20',
    timestamp: `2026-08-20T${String(index + 8).padStart(2, '0')}:00:00-03:00`,
    questoesFeitas: 5,
    acertos: 5,
    tipoEstudo: 'revisao',
  }));
  const simulations = Array.from({ length: 4 }, (_, index) => ({ id: `sim-${index}`, data: '2026-08-20', timestamp: `2026-08-20T${20 + index}:00:00-03:00` }));
  const events = buildAcademicXPEvents({ records, simulations });
  const sum = (key) => events.reduce((total, event) => total + Number(event.breakdown[key] || 0), 0);
  assert.equal(sum('registration'), 10 * 5);
  assert.equal(sum('accuracy'), 3 * 15);
  assert.equal(sum('review'), 5 * 20);
  assert.equal(sum('simulation'), 2 * 25);
});

test('edição e exclusão recalculam eventos pela origem determinística', () => {
  const original = buildAcademicXPEvents({ records: [{ id: 'record-1', data: '2026-08-20', tempoEstudadoMinutos: 60 }] });
  const edited = buildAcademicXPEvents({ records: [{ id: 'record-1', data: '2026-08-20', tempoEstudadoMinutos: 20 }] });
  const deleted = buildAcademicXPEvents({ records: [] });
  assert.equal(original[0].id, edited[0].id);
  assert.equal(original[0].xpTotal, 65);
  assert.equal(edited[0].xpTotal, 25);
  assert.equal(deleted.length, 0);
});

test('meta diária batida gera XP e desbloqueia a conquista Primeira meta', () => {
  const events = buildAcademicXPEvents({
    records: [{ id: 'goal-study', data: '2026-08-20', timestamp: '2026-08-20T10:00:00-03:00', tempoEstudadoMinutos: 60, questoesFeitas: 20, acertos: 15 }],
    goals: [{ id: 'goal', startDate: '2026-08-01', hours: 1, questions: 20 }],
  });
  const goalEvent = events.find((event) => event.sourceType === 'daily_goal');
  assert.equal(goalEvent?.xpTotal, 30);
  const evaluation = evaluateAchievements({ dailyGoals: 1, totalXPBeforeAchievements: 30, level: 1 }, []);
  assert.ok(evaluation.unlockedIds.includes('first_goal'));
});

test('semana usa segunda-feira no calendário America/Bahia', () => {
  assert.equal(getWeekId(new Date('2026-08-20T12:00:00-03:00')), '2026-08-17');
  assert.equal(getWeekId(new Date('2026-08-24T00:00:00-03:00')), '2026-08-24');
});

test('ligas são independentes do nível e possuem as sete divisões definidas', () => {
  assert.deepEqual(LEAGUES.map((league) => league.name), ['Ferro', 'Bronze', 'Prata', 'Ouro', 'Platina', 'Esmeralda', 'Diamante']);
  assert.equal(getLeagueMovement('iron', -1).id, 'iron');
  assert.equal(getLeagueMovement('diamond', 1).id, 'diamond');
  assert.equal(getLeagueMovement('gold', 1).id, 'platinum');
});

test('promoção e rebaixamento cobrem todos os tamanhos de rodada exigidos', () => {
  const cases = [
    [1, false, 0, 0], [5, false, 0, 0], [6, false, 2, 1], [9, false, 2, 1], [10, false, 3, 2],
    [11, true, 4, 3], [15, true, 4, 3], [16, true, 5, 4], [19, true, 5, 4],
  ];
  cases.forEach(([participants, merged, promoted, relegated]) => {
    assert.deepEqual(getPromotionRelegationCounts(participants, { merged }), { promoted, relegated });
  });
  assert.equal(getRankingZone({ position: 1, participants: 10, leagueId: 'diamond' }), 'neutral');
  assert.equal(getRankingZone({ position: 10, participants: 10, leagueId: 'iron' }), 'neutral');
  assert.equal(getRankingZone({ position: 1, participants: 10, leagueId: 'gold' }), 'promotion');
  assert.equal(getRankingZone({ position: 10, participants: 10, leagueId: 'gold' }), 'relegation');
});

test('desempate usa primeiro instante do XP final e depois uid', () => {
  const members = [
    { uid: 'b', competitiveXP: 100, finalXPReachedAtMillis: 200 },
    { uid: 'c', competitiveXP: 100, finalXPReachedAtMillis: 100 },
    { uid: 'a', competitiveXP: 100, finalXPReachedAtMillis: 200 },
    { uid: 'd', competitiveXP: 110, finalXPReachedAtMillis: 300 },
  ];
  assert.deepEqual(sortCompetitiveMembers(members).map((member) => member.uid), ['d', 'c', 'a', 'b']);
});

test('ranking geral alterna entre questões e tempo sem usar liga ou XP', () => {
  const members = [
    { uid: 'xp', competitiveXP: 9999, questions: 2, minutes: 20 },
    { uid: 'questions', competitiveXP: 1, questions: 80, minutes: 10 },
    { uid: 'time', competitiveXP: 2, questions: 10, minutes: 300 },
  ];
  assert.deepEqual(sortGeneralRankingMembers(members, 'questions').map((member) => member.uid), ['questions', 'time', 'xp']);
  assert.deepEqual(sortGeneralRankingMembers(members, 'minutes').map((member) => member.uid), ['time', 'xp', 'questions']);
});

test('ranking semanal usa a semana atual e ranking geral preserva os totais acumulados', () => {
  const now = new Date('2026-08-22T12:00:00-03:00');
  const periods = calculateRankingPeriodMetrics({
    records: [
      { id: 'week', data: '2026-08-20', tempoEstudadoMinutos: 60, questoesFeitas: 20, acertos: 15 },
      { id: 'month', data: '2026-08-02', tempoEstudadoMinutos: 120, questoesFeitas: 40, acertos: 30 },
      { id: 'old', data: '2026-07-01', tempoEstudadoMinutos: 300, questoesFeitas: 100, acertos: 80 },
      { id: 'invalid', data: '2026-08-21', tempoEstudadoMinutos: 999, questoesFeitas: 999, status: 'cancelado' },
    ],
    simulations: [
      { id: 'sim', data: '2026-08-10', durationMinutes: 30, resumo: { totalQuestoes: 10, totalAcertos: 8 } },
    ],
    now,
  });
  assert.deepEqual(
    { minutes: periods.weekly.minutes, questions: periods.weekly.questions, correct: periods.weekly.correct },
    { minutes: 60, questions: 20, correct: 15 },
  );
  assert.deepEqual(
    { minutes: periods.lifetime.minutes, questions: periods.lifetime.questions, correct: periods.lifetime.correct },
    { minutes: 510, questions: 170, correct: 133 },
  );
  assert.equal(periods.weekly.hasActivity, true);
  assert.equal(periods.lifetime.hasActivity, true);
});

test('ranking de grupos alterna entre tempo e questões sem misturar métricas', () => {
  const groups = [
    { id: 'b', name: 'Bravo', weeklyXP: 100, weeklyMinutes: 999, weeklyQuestions: 2 },
    { id: 'a', name: 'Alfa', weeklyXP: 200, weeklyMinutes: 1, weeklyQuestions: 80 },
  ];
  assert.deepEqual(sortGroupsRanking(groups).map((group) => group.id), ['a', 'b']);
  assert.deepEqual(sortGroupsRanking(groups, 'minutes').map((group) => group.id), ['b', 'a']);
  assert.deepEqual(sortGroupsRanking(groups, 'questions').map((group) => group.id), ['a', 'b']);
});

test('conquistas cobrem o catálogo V2 e permanecem desbloqueadas', () => {
  assert.equal(ACHIEVEMENTS.length, 47);
  const previous = ['first_study'];
  const evaluation = evaluateAchievements({ studies: 0, level: 10, totalXPBeforeAchievements: 3000 }, previous);
  assert.ok(evaluation.unlockedIds.includes('first_study'));
  assert.ok(evaluation.unlockedIds.includes('level_5'));
  assert.ok(evaluation.unlockedIds.includes('level_10'));
  assert.ok(evaluation.rewardXP >= 150);
});

test('migração arredonda saldo-base sempre para cima ao múltiplo de 5', () => {
  assert.equal(roundMigrationBaseXP(74597), 74600);
  assert.equal(roundMigrationBaseXP(74600), 74600);
  assert.equal(roundMigrationBaseXP(0), 0);
});
