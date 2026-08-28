import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateBestActivePlanStreak,
  calculateCanonicalStudyStreak,
  calculatePlanStudyStreak,
  calculateStudyStreak,
  evaluateAchievements,
  isQualifiedSimulation,
  isQualifiedStudyRecord,
  STUDY_STREAK_DAY_STATES,
  toDateKey,
} from '../src/utils/gamification.js';
import { buildStudyDaysMap, getDailyStudyStatus } from '../src/utils/studyDayStatus.js';

const cycle = (overrides = {}) => ({
  id: 'cycle-active',
  ativo: true,
  dataInicioPlanejamento: '2026-08-17',
  diasEstudo: { 1: 1, 2: 1, 3: 1, 4: 1, 5: 1 },
  ...overrides,
});

const schedule = (overrides = {}) => ({
  id: 'schedule-active',
  ativo: true,
  dataInicio: '2026-08-17',
  semanaTemplate: [1, 2, 3, 4, 5].map((dia) => ({ slotId: `slot-${dia}`, dia, minutosEstudo: 60 })),
  ...overrides,
});

const recordsFor = (dates, extra = {}) => dates.map((data, index) => ({
  id: `study-${index}`,
  data,
  tempoEstudadoMinutos: 60,
  origemConclusao: 'timer',
  ...extra,
}));

test('ciclo recupera quarta perdida na quinta e descanso nao incrementa', () => {
  const result = calculateCanonicalStudyStreak({
    records: recordsFor(['2026-08-17', '2026-08-18', '2026-08-20', '2026-08-21', '2026-08-24']),
    cycles: [cycle()],
    now: new Date('2026-08-24T12:00:00-03:00'),
  });

  assert.equal(result.currentStreak, 5);
  assert.equal(result.days['2026-08-19'].state, STUDY_STREAK_DAY_STATES.RECOVERY_PENDING);
  assert.equal(result.days['2026-08-20'].state, STUDY_STREAK_DAY_STATES.RECOVERED);
  assert.equal(result.days['2026-08-22'].state, STUDY_STREAK_DAY_STATES.REST);
  assert.equal(result.days['2026-08-23'].state, STUDY_STREAK_DAY_STATES.REST);
  assert.equal(result.days['2026-08-19'].incrementsStreak, false);
});

test('ciclo quebra ao perder o dia e a recuperacao e reinicia no estudo seguinte', () => {
  const result = calculateCanonicalStudyStreak({
    records: recordsFor(['2026-08-17', '2026-08-18', '2026-08-21']),
    cycles: [cycle()],
    now: new Date('2026-08-21T12:00:00-03:00'),
  });

  assert.equal(result.days['2026-08-19'].state, STUDY_STREAK_DAY_STATES.RECOVERY_PENDING);
  assert.equal(result.days['2026-08-20'].state, STUDY_STREAK_DAY_STATES.FAILED);
  assert.equal(result.days['2026-08-21'].state, STUDY_STREAK_DAY_STATES.STUDIED);
  assert.equal(result.currentStreak, 1);
});

test('cronograma recupera slot perdido no proximo dia previsto', () => {
  const result = calculateCanonicalStudyStreak({
    records: recordsFor(['2026-08-17', '2026-08-18', '2026-08-20']),
    schedules: [schedule()],
    now: new Date('2026-08-20T12:00:00-03:00'),
  });

  assert.equal(result.currentStreak, 3);
  assert.equal(result.days['2026-08-19'].state, STUDY_STREAK_DAY_STATES.RECOVERY_PENDING);
  assert.equal(result.days['2026-08-20'].state, STUDY_STREAK_DAY_STATES.RECOVERED);
});

test('cronograma quebra quando a recuperacao tambem nao e cumprida', () => {
  const result = calculateCanonicalStudyStreak({
    records: recordsFor(['2026-08-17', '2026-08-18']),
    schedules: [schedule()],
    now: new Date('2026-08-20T23:59:00-03:00'),
  });

  assert.equal(result.days['2026-08-19'].state, STUDY_STREAK_DAY_STATES.RECOVERY_PENDING);
  assert.equal(result.days['2026-08-20'].state, STUDY_STREAK_DAY_STATES.RECOVERY_PENDING);
  assert.equal(result.currentStreak, 2, 'o dia atual ainda nao deve falhar antes da virada');

  const nextDay = calculateCanonicalStudyStreak({
    records: recordsFor(['2026-08-17', '2026-08-18']),
    schedules: [schedule()],
    now: new Date('2026-08-21T00:01:00-03:00'),
  });
  assert.equal(nextDay.days['2026-08-20'].state, STUDY_STREAK_DAY_STATES.FAILED);
  assert.equal(nextDay.currentStreak, 0);
});

test('descanso entre perda e recuperacao protege e nao consome a pendencia', () => {
  const result = calculateCanonicalStudyStreak({
    records: recordsFor(['2026-08-17', '2026-08-21']),
    schedules: [schedule({
      semanaTemplate: [1, 3, 5].map((dia) => ({ slotId: `slot-${dia}`, dia, minutosEstudo: 60 })),
    })],
    now: new Date('2026-08-21T12:00:00-03:00'),
  });

  assert.equal(result.days['2026-08-19'].state, STUDY_STREAK_DAY_STATES.RECOVERY_PENDING);
  assert.equal(result.days['2026-08-20'].state, STUDY_STREAK_DAY_STATES.REST);
  assert.equal(result.days['2026-08-21'].state, STUDY_STREAK_DAY_STATES.RECOVERED);
  assert.equal(result.currentStreak, 2);
});

test('recuperacao atravessa fim de semana, descanso configurado e troca de mes', () => {
  const result = calculateCanonicalStudyStreak({
    records: recordsFor(['2026-08-27', '2026-09-01']),
    schedules: [schedule({
      dataInicio: '2026-08-27',
      datasDescanso: ['2026-08-31'],
    })],
    now: new Date('2026-09-01T12:00:00-03:00'),
  });

  assert.equal(result.days['2026-08-28'].state, STUDY_STREAK_DAY_STATES.RECOVERY_PENDING);
  assert.equal(result.days['2026-08-29'].state, STUDY_STREAK_DAY_STATES.REST);
  assert.equal(result.days['2026-08-30'].state, STUDY_STREAK_DAY_STATES.REST);
  assert.equal(result.days['2026-08-31'].state, STUDY_STREAK_DAY_STATES.REST);
  assert.equal(result.days['2026-09-01'].state, STUDY_STREAK_DAY_STATES.RECOVERED);
  assert.equal(result.currentStreak, 2);
});

test('estudo parcial nao fecha sequencia sem bater a meta de tempo do planejamento', () => {
  const partialRecord = { id: 'partial', data: '2026-08-18', tempoEstudadoMinutos: 10, origemConclusao: 'timer' };
  const plan = cycle({ diasEstudo: { 2: 2 } });
  const streak = calculateCanonicalStudyStreak({
    records: [partialRecord],
    cycles: [plan],
    now: new Date('2026-08-18T12:00:00-03:00'),
  });
  const adherence = getDailyStudyStatus({
    date: '2026-08-18',
    studyDaysMap: buildStudyDaysMap([partialRecord]),
    activeCicloData: plan,
    activeCronogramaData: null,
    contextMode: 'ciclo',
  });

  assert.equal(streak.currentStreak, 0);
  assert.equal(streak.days['2026-08-18'].state, STUDY_STREAK_DAY_STATES.RECOVERY_PENDING);
  assert.equal(streak.days['2026-08-18'].qualifiedMinutes, 10);
  assert.equal(streak.days['2026-08-18'].plannedMinutes, 120);
  assert.equal(adherence.goalMet, false);
  assert.equal(adherence.status, 'goal-met-one');
});

test('cronograma exige a meta bruta combinada de estudo e revisao', () => {
  const plan = schedule({
    horariosDetalhados: { 2: 1 },
    semanaTemplate: [{ slotId: 'tue', dia: 2, minutosEstudo: 45, minutosBrutoDia: 60 }],
  });
  const studyOnly = calculatePlanStudyStreak({
    records: recordsFor(['2026-08-18'], { tempoEstudadoMinutos: 45, cronogramaId: plan.id, contextoRegistro: 'cronograma' }),
    plan,
    planType: 'schedule',
    now: new Date('2026-08-18T12:00:00-03:00'),
  });
  const withReview = calculatePlanStudyStreak({
    records: [
      ...recordsFor(['2026-08-18'], { tempoEstudadoMinutos: 45, cronogramaId: plan.id, contextoRegistro: 'cronograma' }),
      { data: '2026-08-18', tempoEstudadoMinutos: 15, tipoEstudo: 'revisao', isRevisao: true, cronogramaId: plan.id, contextoRegistro: 'cronograma' },
    ],
    plan,
    planType: 'schedule',
    now: new Date('2026-08-18T12:00:00-03:00'),
  });

  assert.equal(studyOnly.currentStreak, 0);
  assert.equal(studyOnly.days['2026-08-18'].qualifiedMinutes, 45);
  assert.equal(studyOnly.days['2026-08-18'].plannedMinutes, 60);
  assert.equal(withReview.currentStreak, 1);
  assert.equal(withReview.days['2026-08-18'].qualifiedMinutes, 60);

  const reviewCannotReplaceStudy = calculatePlanStudyStreak({
    records: [{ data: '2026-08-18', tempoEstudadoMinutos: 60, tipoEstudo: 'revisao', isRevisao: true, cronogramaId: plan.id, contextoRegistro: 'cronograma' }],
    plan,
    planType: 'schedule',
    now: new Date('2026-08-18T12:00:00-03:00'),
  });
  assert.equal(reviewCannotReplaceStudy.currentStreak, 0);
  assert.equal(reviewCannotReplaceStudy.days['2026-08-18'].qualifiedStudyMinutes, 0);
  assert.equal(reviewCannotReplaceStudy.days['2026-08-18'].plannedStudyMinutes, 45);
});

test('ciclo nao conclui a sequencia enquanto houver revisao devida pendente', () => {
  const plan = cycle({ diasEstudo: { 2: 1 } });
  const records = recordsFor(['2026-08-18'], { cicloId: plan.id, contextoRegistro: 'ciclo' });
  const pendingReview = {
    id: 'review-cycle',
    cicloId: plan.id,
    dataAgendada: '2026-08-18',
    concluida: false,
  };
  const pending = calculatePlanStudyStreak({
    records,
    cycleReviews: [pendingReview],
    plan,
    planType: 'cycle',
    now: new Date('2026-08-18T12:00:00-03:00'),
  });
  const completed = calculatePlanStudyStreak({
    records,
    cycleReviews: [{ ...pendingReview, concluida: true, concluidaEm: '2026-08-18T15:00:00-03:00' }],
    plan,
    planType: 'cycle',
    now: new Date('2026-08-18T16:00:00-03:00'),
  });

  assert.equal(pending.currentStreak, 0);
  assert.equal(pending.days['2026-08-18'].pendingReviewCount, 1);
  assert.equal(completed.currentStreak, 1);
  assert.equal(completed.days['2026-08-18'].pendingReviewCount, 0);
});

test('status diario do ciclo e do cronograma exige cada revisao programada', () => {
  const date = '2026-08-18';
  const cyclePlan = cycle({ diasEstudo: { 2: 1 } });
  const studyDaysMap = buildStudyDaysMap(recordsFor([date], { cicloId: cyclePlan.id, contextoRegistro: 'ciclo' }));
  const cycleStatus = getDailyStudyStatus({
    date,
    studyDaysMap,
    activeCicloData: cyclePlan,
    contextMode: 'ciclo',
    cycleReviews: [{ cicloId: cyclePlan.id, dataAgendada: date, concluida: false }],
  });

  const schedulePlan = schedule({ dataInicio: date, diasEstudo: [2] });
  const scheduleStatus = getDailyStudyStatus({
    date,
    studyDaysMap,
    activeCronogramaData: schedulePlan,
    contextMode: 'cronograma',
    getAgendaSemana: () => [
      { slotId: 'study-1', slotIdBase: 'study-1', dataSlot: date, concluido: true, minutosEstudo: 45 },
      { slotId: 'review-1', dataSlot: date, isRevisaoAuto: true, concluido: false, minutosEstudo: 15 },
    ],
  });

  assert.equal(cycleStatus.goalMet, false);
  assert.equal(cycleStatus.completedSlots, 1);
  assert.equal(cycleStatus.totalSlots, 2);
  assert.equal(scheduleStatus.goalMet, false);
  assert.equal(scheduleStatus.completedSlots, 1);
  assert.equal(scheduleStatus.totalSlots, 2);
});

test('revisao isolada nao marca dia previsto de planejamento como estudado', () => {
  const result = calculateCanonicalStudyStreak({
    records: [
      ...recordsFor(['2026-08-20', '2026-08-21', '2026-08-22', '2026-08-24', '2026-08-25', '2026-08-26']),
      { id: 'review-today', data: '2026-08-27', tempoEstudadoMinutos: 5, tipoEstudo: 'revisao', isRevisao: true },
    ],
    cycles: [cycle({
      dataInicioPlanejamento: '2026-08-20',
      diasEstudo: { 1: 1, 2: 1, 3: 1, 4: 1, 5: 1, 6: 1 },
    })],
    schedules: [schedule({
      dataInicio: '2026-08-20',
      semanaTemplate: [1, 2, 3, 4, 5, 6].map((dia) => ({ slotId: `slot-${dia}`, dia, minutosEstudo: 60 })),
    })],
    now: new Date('2026-08-27T12:00:00-03:00'),
  });

  assert.equal(result.currentStreak, 6);
  assert.equal(result.days['2026-08-27'].state, STUDY_STREAK_DAY_STATES.RECOVERY_PENDING);
  assert.equal(result.days['2026-08-27'].incrementsStreak, false);
  assert.deepEqual(result.qualifiedStudyDates, ['2026-08-20', '2026-08-21', '2026-08-22', '2026-08-24', '2026-08-25', '2026-08-26']);
});

test('registro manual mensurado qualifica, mas registros invalidos e espelhos de simulado nao', () => {
  const invalidRecords = [
    { data: '2026-08-18', tempoEstudadoMinutos: 30, deletedAt: new Date() },
    { data: '2026-08-18', tempoEstudadoMinutos: 30, status: 'pendente' },
    { data: '2026-08-18', tempoEstudadoMinutos: 30, confirmado: false },
    { data: '2026-08-18', tempoEstudadoMinutos: 30, tipoEstudo: 'Simulado' },
  ];
  invalidRecords.forEach((record) => assert.equal(isQualifiedStudyRecord(record), false));
  assert.equal(isQualifiedStudyRecord({ data: '2026-08-18', questoesFeitas: 1, origemConclusao: 'registro_manual' }), true);
  assert.equal(isQualifiedStudyRecord({ data: '2026-08-18', tempoEstudadoMinutos: 30, origemConclusao: 'botao_concluir', conclusaoManual: true }), true);
  assert.equal(isQualifiedStudyRecord({ data: '2026-08-18', tipoEstudo: 'check_manual', tempoEstudadoMinutos: 0 }), false);
});

test('simulado real concluido preserva a sequencia e conta apenas uma vez por dia', () => {
  const simulations = [
    {
      id: 'simulation-1',
      data: '2026-08-18',
      durationMinutes: 90,
      resumo: { totalQuestoes: 60, totalAcertos: 45 },
    },
    {
      id: 'simulation-2',
      data: '2026-08-18',
      durationMinutes: 30,
      resumo: { totalQuestoes: 20, totalAcertos: 15 },
    },
  ];
  const result = calculateCanonicalStudyStreak({
    records: recordsFor(['2026-08-17']),
    simulations,
    cycles: [cycle()],
    now: new Date('2026-08-18T12:00:00-03:00'),
  });

  assert.equal(isQualifiedSimulation(simulations[0]), true);
  assert.equal(result.currentStreak, 2);
  assert.deepEqual(result.qualifiedStudyDates, ['2026-08-17', '2026-08-18']);
});

test('simulado pendente ou abandonado nao qualifica para a sequencia', () => {
  assert.equal(isQualifiedSimulation({ data: '2026-08-18', durationMinutes: 30, status: 'pendente' }), false);
  assert.equal(isQualifiedSimulation({ data: '2026-08-18', durationMinutes: 30, status: 'abandonado' }), false);
  assert.equal(isQualifiedSimulation({ data: '2026-08-18', durationMinutes: 0, resumo: { totalQuestoes: 0 } }), false);
});

test('cada planejamento mantem sua sequencia e o ranking usa somente a maior', () => {
  const activeCycle = cycle();
  const activeSchedule = schedule({
    semanaTemplate: [{ slotId: 'mon', dia: 1, minutosEstudo: 60 }],
  });
  const records = [
    ...recordsFor(['2026-08-17', '2026-08-18', '2026-08-20'], {
      cicloId: activeCycle.id,
      contextoRegistro: 'ciclo',
    }),
    ...recordsFor(['2026-08-17'], {
      cronogramaId: activeSchedule.id,
      contextoRegistro: 'cronograma',
    }),
  ];
  const input = {
    records,
    cycles: [activeCycle],
    schedules: [activeSchedule],
    now: new Date('2026-08-20T12:00:00-03:00'),
  };
  const cycleResult = calculatePlanStudyStreak({
    records,
    plan: activeCycle,
    planType: 'cycle',
    now: input.now,
  });
  const scheduleResult = calculatePlanStudyStreak({
    records,
    plan: activeSchedule,
    planType: 'schedule',
    now: input.now,
  });
  const rankingStreak = calculateBestActivePlanStreak(input);
  const achievements = evaluateAchievements({
    streak: cycleResult.currentStreak,
    totalXPBeforeAchievements: 0,
    level: 1,
  }, []);

  assert.equal(cycleResult.currentStreak, 3);
  assert.equal(scheduleResult.currentStreak, 1);
  assert.equal(rankingStreak, 3);
  assert.equal(cycleResult.context.id, activeCycle.id);
  assert.equal(scheduleResult.context.id, activeSchedule.id);
  assert.ok(achievements.unlockedIds.includes('streak_3'));
});

test('sem planejamento ativo usa fallback de dias reais consecutivos', () => {
  const records = recordsFor(['2026-08-23', '2026-08-24', '2026-08-25']);
  assert.equal(calculateStudyStreak(records, new Date('2026-08-26T12:00:00-03:00')), 3);
  assert.equal(calculateCanonicalStudyStreak({ records, now: new Date('2026-08-26T12:00:00-03:00') }).source, 'records_fallback');
});

test('timezone America Bahia nao desloca registro na virada UTC', () => {
  const instant = '2026-08-26T02:30:00.000Z';
  assert.equal(toDateKey(instant), '2026-08-25');
  const result = calculateCanonicalStudyStreak({
    records: [{ timestamp: instant, tempoEstudadoMinutos: 15, origemConclusao: 'timer' }],
    now: new Date('2026-08-26T02:45:00.000Z'),
  });
  assert.equal(result.today, '2026-08-25');
  assert.equal(result.currentStreak, 1);
});

test('multiplos planejamentos escolhem o melhor contexto com desempate deterministico', () => {
  const result = calculateCanonicalStudyStreak({
    records: recordsFor(['2026-08-17', '2026-08-18', '2026-08-20']),
    cycles: [cycle({ id: 'cycle-b' }), cycle({ id: 'cycle-a' })],
    schedules: [schedule({ id: 'schedule-a', semanaTemplate: [{ slotId: 'mon', dia: 1, minutosEstudo: 60 }] })],
    now: new Date('2026-08-20T12:00:00-03:00'),
  });

  assert.equal(result.currentStreak, 3);
  assert.deepEqual(result.context, {
    type: 'cycle',
    id: 'cycle-a',
    startDate: '2026-08-17',
    studyWeekdays: [1, 2, 3, 4, 5],
  });
});
