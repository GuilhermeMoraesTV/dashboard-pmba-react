import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildCycleToScheduleWizardState,
  buildTransformationDisciplines,
  getSchedulePlanningRecords,
  getPlanningStageRecords,
} from '../src/utils/planningTransformation.js';

test('conversion preserves discipline IDs and only explicit finished topics leave new theory', () => {
  const disciplines = [
    { id: 'original-1', nome: 'Direito', assuntos: ['Lei A', 'Lei B', 'Lei C'], inCiclo: true },
    { id: 'original-2', nome: 'Historia', assuntos: ['Tema D'], inCiclo: true },
  ];
  const records = [
    { cicloId: 'cycle-1', disciplinaId: 'original-1', assunto: 'Lei A', tipoEstudo: 'Teoria', tempoEstudadoMinutos: 40 },
    { cicloId: 'cycle-1', disciplinaId: 'original-1', assunto: 'Lei B', tipoEstudo: 'check_manual' },
    { cicloId: 'cycle-1', disciplinaId: 'original-1', assunto: 'Lei C', tipoEstudo: 'revisao' },
  ];
  const converted = buildTransformationDisciplines(disciplines, records);
  assert.deepEqual(converted.map((item) => item.id), ['original-1', 'original-2']);
  assert.deepEqual(converted[0].assuntos, ['Lei A', 'Lei C']);
  assert.deepEqual(converted[0].assuntosConcluidosAntesTransformacao, ['Lei B']);
  const state = buildCycleToScheduleWizardState(
    { id: 'cycle-1', nome: 'PMBA', editalId: 'pmba', diasEstudo: [1, 3], cargaHorariaSemanalTotal: 6 },
    disciplines, records, '2026-09-15',
  );
  assert.equal(state.edital.id, 'pmba');
  assert.equal(state.selecao['original-1'].checked, true);
  assert.equal(state.horarios[1], 3);
  assert.equal(state.cronConfig.dataInicio, '2026-09-15');
});

test('returning to a cycle keeps completed theory and every prior stage record', () => {
  const disciplines = [{
    id: 'disc-1', nome: 'Direito', assuntos: ['Lei A', 'Lei B'],
    assuntosConcluidosAntesTransformacao: ['Base inicial'],
  }];
  const pending = buildTransformationDisciplines(disciplines, [
    { contextoRegistro: 'cronograma', origemConclusao: 'botao_concluir',
      disciplinaId: 'disc-1', assunto: 'Lei A' },
    { contextoRegistro: 'cronograma', origemConclusao: 'timer',
      disciplinaId: 'disc-1', assunto: 'Lei B' },
  ]);
  assert.deepEqual(pending[0].assuntos, ['Lei B']);
  assert.deepEqual(pending[0].assuntosConcluidosAntesTransformacao,
    ['Base inicial', 'Lei A']);
  const stages = [
    { metodo: 'ciclo', id: 'plan-1' },
    { metodo: 'cronograma', id: 'plan-1' },
    { metodo: 'ciclo', id: 'plan-1-ciclo-2' },
  ];
  const records = [
    { id: 'old-cycle', cicloId: 'plan-1', tempoEstudadoMinutos: 40 },
    { id: 'schedule', cronogramaId: 'plan-1', tempoEstudadoMinutos: 30 },
    { id: 'new-cycle', cicloId: 'plan-1-ciclo-2', tempoEstudadoMinutos: 50 },
    { id: 'elsewhere', cicloId: 'other', tempoEstudadoMinutos: 100 },
  ];
  const linked = getPlanningStageRecords(records, {
    id: 'plan-1-ciclo-2', planejamentoId: 'plan-1',
    metodoVigente: 'ciclo', etapasPlanejamento: stages,
  });
  assert.deepEqual(linked.map((record) => record.id),
    ['old-cycle', 'schedule', 'new-cycle']);
  assert.equal(linked.reduce((sum, record) => sum + record.tempoEstudadoMinutos, 0), 120);
});

test('linked planning counts each record once across methods and rounds', () => {
  const records = [
    { id: 'old-a', cicloId: 'cycle-1', conclusaoId: 2, tempoEstudadoMinutos: 30 },
    { id: 'same-day', cicloId: 'cycle-1', cronogramaId: 'cycle-1', tempoEstudadoMinutos: 20 },
    { id: 'new-a', cronogramaId: 'cycle-1', tempoEstudadoMinutos: 45 },
    { id: 'other', cicloId: 'other', tempoEstudadoMinutos: 100 },
  ];
  const linked = getSchedulePlanningRecords(records, { id: 'cycle-1', cicloVinculadoId: 'cycle-1' });
  assert.deepEqual(linked.map((item) => item.id), ['old-a', 'same-day', 'new-a']);
  assert.equal(linked.reduce((sum, item) => sum + item.tempoEstudadoMinutos, 0), 95);
});
