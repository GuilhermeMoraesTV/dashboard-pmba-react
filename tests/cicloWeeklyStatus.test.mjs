import test from 'node:test';
import assert from 'node:assert/strict';

import {
  aggregateCycleRoundStats,
  buildCicloWeeklyAlert,
  buildCycleRoundSummary,
  getCicloWeeklyStatus,
  mergeOptimisticCycleRecords,
} from '../src/utils/cicloWeeklyStatus.js';

const cicloBase = {
  dataInicioPlanejamento: '2026-08-17',
  conclusoes: 0,
  totalSessoesCiclo: 3,
  sessoesConcluidas: [],
};

test('ciclo criado na sexta pode iniciar na segunda e conta sete dias desde a data escolhida', () => {
  const status = getCicloWeeklyStatus({ ciclo: cicloBase, today: '2026-08-14' });
  assert.equal(status.estado, 'nao_iniciado');
  assert.equal(status.diasAteInicio, 3);
  assert.equal(status.inicioRodada, '2026-08-17');
  assert.equal(status.fechamentoIdeal, '2026-08-24');
});

test('calcula os estados de dois dias, vencimento, atraso e pronto para fechar', () => {
  assert.equal(getCicloWeeklyStatus({ ciclo: cicloBase, today: '2026-08-22' }).estado, 'perto_de_vencer');
  assert.equal(getCicloWeeklyStatus({ ciclo: cicloBase, today: '2026-08-24' }).estado, 'vence_hoje');
  assert.equal(getCicloWeeklyStatus({ ciclo: cicloBase, today: '2026-08-27' }).estado, 'atrasado');
  assert.equal(getCicloWeeklyStatus({
    ciclo: { ...cicloBase, sessoesConcluidas: [0, 1, 2] },
    today: '2026-08-27',
  }).estado, 'pronto_para_fechar');
});

test('gera os alertas do sino para cada estado acionavel', () => {
  const cases = [
    ['2026-08-14', cicloBase, 'ciclo_nao_iniciado'],
    ['2026-08-22', cicloBase, 'ciclo_perto_vencer'],
    ['2026-08-24', cicloBase, 'ciclo_vence_hoje'],
    ['2026-08-27', cicloBase, 'ciclo_atrasado'],
    ['2026-08-27', { ...cicloBase, sessoesConcluidas: [0, 1, 2] }, 'ciclo_finalizacao'],
  ];

  cases.forEach(([today, ciclo, expectedType]) => {
    const status = getCicloWeeklyStatus({ ciclo, today });
    assert.equal(buildCicloWeeklyAlert({ ...ciclo, id: 'cycle-1' }, status)?.type, expectedType);
  });
});

test('rodadas seguintes usam ultimaConclusao como novo inicio', () => {
  const status = getCicloWeeklyStatus({
    ciclo: { ...cicloBase, conclusoes: 1, ultimaConclusao: new Date(2026, 7, 25, 21, 30) },
    today: '2026-08-26',
  });
  assert.equal(status.inicioRodada, '2026-08-25');
  assert.equal(status.fechamentoIdeal, '2026-09-01');
});

test('registro otimista do ultimo bloco entra no total sem duplicar ao persistir', () => {
  const optimistic = {
    final: { origemConclusaoId: 'ciclo:estudo:2:2026-08-24', tempoEstudadoMinutos: 50 },
  };
  const beforeSnapshot = mergeOptimisticCycleRecords([
    { origemConclusaoId: 'ciclo:estudo:1:2026-08-24', tempoEstudadoMinutos: 40 },
  ], optimistic);
  assert.equal(beforeSnapshot.reduce((total, item) => total + item.tempoEstudadoMinutos, 0), 90);

  const afterSnapshot = mergeOptimisticCycleRecords([
    { origemConclusaoId: 'ciclo:estudo:1:2026-08-24', tempoEstudadoMinutos: 40 },
    { origemConclusaoId: 'ciclo:estudo:2:2026-08-24', tempoEstudadoMinutos: 50 },
  ], optimistic);
  assert.equal(afterSnapshot.length, 2);
  assert.equal(afterSnapshot.reduce((total, item) => total + item.tempoEstudadoMinutos, 0), 90);
});

test('resumo da rodada registra atraso, carga cumprida no prazo e pendencias por materia', () => {
  const summary = buildCycleRoundSummary({
    ciclo: cicloBase,
    closedAt: '2026-08-26',
    disciplinas: [
      { id: 'a', nome: 'Português', tempoAlocadoSemanalMinutos: 120 },
      { id: 'b', nome: 'Direito', tempoAlocadoSemanalMinutos: 60 },
    ],
    registros: [
      { disciplinaId: 'a', data: '2026-08-20', tempoEstudadoMinutos: 90 },
      { disciplinaId: 'a', data: '2026-08-25', tempoEstudadoMinutos: 30 },
      { disciplinaId: 'b', data: '2026-08-24', tempoEstudadoMinutos: 60 },
    ],
  });
  assert.equal(summary.numeroRodada, 1);
  assert.equal(summary.atrasoDias, 2);
  assert.equal(summary.cargaPlanejadaMinutos, 180);
  assert.equal(summary.cargaCumpridaAteDataIdealMinutos, 150);
  assert.deepEqual(summary.materiasPendentesNoVencimento, [
    { disciplinaId: 'a', nome: 'Português', minutosPendentes: 30 },
  ]);
});

test('estatisticas aceitam vazio, uma rodada e multiplas rodadas', () => {
  assert.equal(aggregateCycleRoundStats([]).totalRodadas, 0);
  assert.deepEqual(aggregateCycleRoundStats([{ numeroRodada: 1, atrasoDias: 0 }]), {
    totalRodadas: 1,
    rodadasAtrasadas: 0,
    mediaDiasAtraso: 0,
    maiorAtraso: 0,
    materiasMaisPendentes: [],
    historico: [{ numeroRodada: 1, atrasoDias: 0 }],
  });

  const stats = aggregateCycleRoundStats([
    { numeroRodada: 1, atrasoDias: 2, materiasPendentesNoVencimento: [{ disciplinaId: 'a', nome: 'Português', minutosPendentes: 30 }] },
    { numeroRodada: 2, atrasoDias: 4, materiasPendentesNoVencimento: [{ disciplinaId: 'a', nome: 'Português', minutosPendentes: 20 }] },
    { numeroRodada: 3, atrasoDias: 0, materiasPendentesNoVencimento: [] },
  ]);
  assert.equal(stats.totalRodadas, 3);
  assert.equal(stats.rodadasAtrasadas, 2);
  assert.equal(stats.mediaDiasAtraso, 3);
  assert.equal(stats.maiorAtraso, 4);
  assert.equal(stats.materiasMaisPendentes[0].rodadasPendentes, 2);
  assert.equal(stats.materiasMaisPendentes[0].minutosPendentes, 50);
});
