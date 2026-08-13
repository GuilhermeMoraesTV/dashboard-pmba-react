import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildAdminAnalyticsDatasets,
  buildStudyRanking,
  prepareAdminActivities,
} from '../src/utils/adminAnalytics.js';

const date = new Date('2026-08-13T12:00:00-03:00');
const users = [
  { id: 'u2', name: 'Bruno' },
  { id: 'u1', name: 'Ana' },
  { id: 'u3', name: 'Carlos' },
];

test('prepara apenas atividades reais de planos existentes e não arquivados', () => {
  const cycles = new Map([
    ['u1_active', { id: 'active', uid: 'u1', nome: 'Ciclo ativo', ativo: false, arquivado: false }],
    ['u1_archived', { id: 'archived', uid: 'u1', nome: 'Arquivado', arquivado: true }],
    ['u1_deleted', { id: 'deleted', uid: 'u1', nome: 'Excluído', deletedAt: date }],
  ]);
  const schedules = new Map([
    ['u2_schedule', { id: 'schedule', uid: 'u2', nome: 'Cronograma', status: 'ativo' }],
    ['u2_logical-delete', { id: 'logical-delete', uid: 'u2', nome: 'Excluído', status: 'deletado' }],
  ]);
  const records = [
    { id: '1', path: 'users/u1/registrosEstudo/1', uid: 'u1', cicloId: 'active', timestamp: date, tempoEstudadoMinutos: 60, questoesFeitas: 10, acertos: 8 },
    { id: '2', path: 'users/u1/registrosEstudo/2', uid: 'u1', cicloId: 'archived', timestamp: date, tempoEstudadoMinutos: 120 },
    { id: '3', path: 'users/u1/registrosEstudo/3', uid: 'u1', cicloId: 'deleted', timestamp: date, tempoEstudadoMinutos: 120 },
    { id: '4', path: 'users/u2/registrosEstudo/4', uid: 'u2', cronogramaId: 'schedule', timestamp: date, durationSeconds: 1800, questoesFeitas: 5, acertos: 3 },
    { id: '5', path: 'users/u2/registrosEstudo/5', uid: 'u2', cronogramaId: 'logical-delete', timestamp: date, tempoEstudadoMinutos: 45 },
    { id: '6', path: 'users/u2/registrosEstudo/6', uid: 'u2', cronogramaId: 'schedule', timestamp: date, tempoEstudadoMinutos: 40, status: 'cancelado' },
    { id: '7', path: 'users/u2/registrosEstudo/7', uid: 'u2', cronogramaId: 'schedule', timestamp: date, tempoEstudadoMinutos: 40, status: 'planejado' },
    { id: '8', path: 'users/u3/registrosEstudo/8', uid: 'u3', cicloId: 'missing', timestamp: date, tempoEstudadoMinutos: 90 },
  ];

  const result = prepareAdminActivities({ studyRecords: records, cicloMetaByKey: cycles, cronogramaMetaByKey: schedules });
  assert.deepEqual(result.map((item) => item.id), ['1', '4']);
  assert.equal(result[1].tempoEstudadoMinutos, 30);
});

test('deduplica registros e mantém simulados no feed, mas fora do ranking', () => {
  const cycles = new Map([['u1_cycle', { id: 'cycle', uid: 'u1', nome: 'Ciclo' }]]);
  const duplicated = { id: 'same', path: 'users/u1/registrosEstudo/same', uid: 'u1', cicloId: 'cycle', timestamp: date, tempoEstudadoMinutos: 60, questoesFeitas: 10, acertos: 7 };
  const activities = prepareAdminActivities({
    studyRecords: [duplicated, { ...duplicated }],
    simulations: [{ id: 'sim', path: 'users/u1/simulados/sim', uid: 'u1', timestamp: date, durationMinutes: 45, resumo: { totalQuestoes: 20, totalAcertos: 15 } }],
    cicloMetaByKey: cycles,
  });

  assert.equal(activities.length, 2);
  assert.equal(activities.find((item) => item.id === 'sim').rankingEligible, false);
  const ranking = buildStudyRanking(users, activities);
  assert.equal(ranking.hours[0].totalMinutes, 60);
  assert.equal(ranking.hours[0].totalQuestions, 10);
});

test('ordena ranking do maior para o menor e resolve empates de forma estável', () => {
  const activities = [
    { uid: 'u2', rankingEligible: true, timestamp: date, tempoEstudadoMinutos: 90, questoesFeitas: 20, acertos: 10 },
    { uid: 'u1', rankingEligible: true, timestamp: date, tempoEstudadoMinutos: 90, questoesFeitas: 20, acertos: 18 },
    { uid: 'u3', rankingEligible: true, timestamp: date, tempoEstudadoMinutos: 30, questoesFeitas: 50, acertos: 40 },
  ];
  const ranking = buildStudyRanking(users, activities);

  assert.deepEqual(ranking.hours.map((item) => item.id), ['u1', 'u2', 'u3']);
  assert.deepEqual(ranking.questions.map((item) => item.id), ['u3', 'u1', 'u2']);
});

test('analytics usa os mesmos registros consolidados do ranking', () => {
  const activities = [
    { uid: 'u1', sourceType: 'ciclo', timestamp: new Date('2026-08-13T09:00:00-03:00'), tempoEstudadoMinutos: 60, questoesFeitas: 10 },
    { uid: 'u2', sourceType: 'cronograma', timestamp: new Date('2026-08-13T10:00:00-03:00'), tempoEstudadoMinutos: 30, questoesFeitas: 5 },
    { uid: 'u1', sourceType: 'simulado', timestamp: new Date('2026-08-12T10:00:00-03:00'), tempoEstudadoMinutos: 45, questoesFeitas: 20 },
  ];
  const datasets = buildAdminAnalyticsDatasets(activities, date, 7);
  const today = datasets.daily.at(-1);

  assert.equal(today.activeUsers, 2);
  assert.equal(today.studyMinutes, 90);
  assert.equal(today.questions, 15);
  assert.equal(datasets.contextDistribution.find((item) => item.context === 'Simulados').records, 1);
});
