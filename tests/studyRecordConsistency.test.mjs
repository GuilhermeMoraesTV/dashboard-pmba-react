import test from 'node:test';
import assert from 'node:assert/strict';

import { buildCompletionRegistro } from '../src/utils/completionRegistro.js';
import { getCronogramaSlotRecordedMinutes, getCycleFreeQueue } from '../src/utils/studyDayStatus.js';
import { getRecordedStudyMinutes, normalizeRecordedStudyMinutes } from '../src/utils/studyRecords.js';
import { setLatestToggleIntent, takeLatestToggleIntent } from '../src/utils/latestToggleIntent.js';

const ciclo = {
  id: 'ciclo-1',
  tempoSessaoMinutos: 60,
  ordemSessoes: [{ disciplinaId: 'disc-1', sessaoIndex: 0 }],
  disciplinas: [{ id: 'disc-1', nome: 'Direito', duracoesSessoes: [60], assuntos: ['Tema'] }],
  sessoesConcluidas: [],
  progressoSessoes: {},
};

test('checkout registra a duração planejada como tempo estudado', () => {
  const record = buildCompletionRegistro({
    context: 'ciclo',
    ciclo,
    item: { globalIndex: 0, disciplinaId: 'disc-1', tempoPlanejadoMinutos: 60 },
  });
  assert.equal(record.tempoEstudadoMinutos, 60);
  assert.equal(record.duracaoMinutos, 60);
  assert.equal(record.tempoPlanejadoConclusaoMinutos, 60);
  assert.equal(record.tipoEstudo, 'Teoria');
  assert.equal(record.conclusaoManual, true);
});

test('registro de 3h em bloco de 1h preserva excedente e protege conclusao', () => {
  const queue = getCycleFreeQueue(ciclo, [{
    id: 'study-1',
    cicloId: ciclo.id,
    contextoRegistro: 'ciclo',
    disciplinaId: 'disc-1',
    sessaoGlobalIndex: 0,
    tempoEstudadoMinutos: 180,
    data: '2026-08-23',
  }]);
  const [session] = queue.sessions;
  assert.equal(session.progressoMinutos, 180);
  assert.equal(session.tempoPlanejadoMinutos, 60);
  assert.equal(session.concluida, true);
  assert.equal(session.concluidaPorTempoRegistrado, true);
  assert.equal(session.bloqueiaDesmarcarConclusao, true);
});

test('checkout com minutos persistidos entra nas horas reais', () => {
  const legacy = normalizeRecordedStudyMinutes({
    cicloId: ciclo.id,
    sessaoGlobalIndex: 0,
    origemConclusao: 'botao_concluir',
    tempoEstudadoMinutos: 60,
  });
  assert.equal(getRecordedStudyMinutes(legacy), 60);
  assert.equal(legacy.tempoPlanejadoConclusaoMinutos, 60);
  const [session] = getCycleFreeQueue({
    ...ciclo,
    sessoesConcluidas: [0],
    progressoSessoes: { 0: 60 },
  }, [legacy]).sessions;
  assert.equal(session.concluida, true);
  assert.equal(session.concluidaPorTempoRegistrado, true);
  assert.equal(session.progressoMinutos, 60);
  assert.equal(session.bloqueiaDesmarcarConclusao, false);
});

test('apenas estudo real bloqueia desmarcacao no ciclo e no cronograma', () => {
  const manual = {
    id: 'manual',
    cicloId: ciclo.id,
    cronogramaId: 'cronograma-1',
    contextoRegistro: 'ciclo',
    disciplinaId: 'disc-1',
    sessaoGlobalIndex: 0,
    origemConclusao: 'botao_concluir',
    conclusaoManual: true,
    tempoEstudadoMinutos: 60,
    data: '2026-08-25',
  };
  const real = { ...manual, id: 'real', origemConclusao: 'timer', conclusaoManual: false };

  assert.equal(getCycleFreeQueue(ciclo, [manual]).sessions[0].bloqueiaDesmarcarConclusao, false);
  assert.equal(getCycleFreeQueue(ciclo, [real]).sessions[0].bloqueiaDesmarcarConclusao, true);

  const cronograma = { id: 'cronograma-1' };
  const slot = { disciplinaId: 'disc-1', disciplinaNome: 'Direito', dataSlot: '2026-08-25' };
  const cronogramaManual = { ...manual, contextoRegistro: 'cronograma' };
  const cronogramaReal = { ...real, contextoRegistro: 'cronograma' };
  assert.equal(getCronogramaSlotRecordedMinutes({ cronograma, slot, registrosEstudo: [cronogramaManual], onlyRealStudyRecords: true }), 0);
  assert.equal(getCronogramaSlotRecordedMinutes({ cronograma, slot, registrosEstudo: [cronogramaReal], onlyRealStudyRecords: true }), 60);
});

test('cliques rapidos mantem somente a intencao visual mais recente', () => {
  const intents = new Map();
  setLatestToggleIntent(intents, 'bloco-1', { targetCompleted: true });
  setLatestToggleIntent(intents, 'bloco-1', { targetCompleted: false });
  setLatestToggleIntent(intents, 'bloco-1', { targetCompleted: true });
  assert.equal(intents.size, 1);
  assert.deepEqual(takeLatestToggleIntent(intents, 'bloco-1'), { targetCompleted: true });
  assert.equal(intents.size, 0);
});
