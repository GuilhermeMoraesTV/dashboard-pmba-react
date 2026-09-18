import test from 'node:test';
import assert from 'node:assert/strict';

import { buildCompletionRegistro } from '../src/utils/completionRegistro.js';
import { buildStudyDaysMap, getCronogramaSlotRecordedMinutes, getCycleFreeQueue } from '../src/utils/studyDayStatus.js';
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

test('checkout com minutos persistidos não entra nas horas reais', () => {
  const legacy = normalizeRecordedStudyMinutes({
    cicloId: ciclo.id,
    contextoRegistro: 'ciclo',
    sessaoGlobalIndex: 0,
    origemConclusao: 'botao_concluir',
    tempoEstudadoMinutos: 60,
  });
  assert.equal(getRecordedStudyMinutes(legacy), 0);
  assert.equal(legacy.tempoPlanejadoConclusaoMinutos, 60);
  const [session] = getCycleFreeQueue({
    ...ciclo,
    sessoesConcluidas: [0],
    progressoSessoes: { 0: 60 },
  }, [legacy]).sessions;
  assert.equal(session.concluida, false);
  assert.equal(session.concluidaPorTempoRegistrado, false);
  assert.equal(session.progressoMinutos, 0);
  assert.equal(session.bloqueiaDesmarcarConclusao, false);
});

test('conclusão direta do cronograma registra os minutos planejados como estudo real', () => {
  const cronograma = { id: 'cronograma-1' };
  const slot = {
    slotId: 'slot-1',
    disciplinaId: 'disc-1',
    disciplinaNome: 'Direito',
    assunto: 'Tema',
    dataSlot: '2026-08-25',
    tempoPlanejadoMinutos: 60,
  };
  const completion = normalizeRecordedStudyMinutes(buildCompletionRegistro({
    context: 'cronograma',
    cronograma,
    item: slot,
  }));

  assert.equal(getRecordedStudyMinutes(completion), 60);
  assert.equal(completion.tempoEstudadoMinutos, 60);
  assert.equal(buildStudyDaysMap([completion])['2026-08-25'].minutes, 60);
  assert.equal(getCronogramaSlotRecordedMinutes({
    cronograma,
    slot,
    registrosEstudo: [completion],
  }), 60);
  assert.equal(getCronogramaSlotRecordedMinutes({
    cronograma,
    slot,
    registrosEstudo: [completion],
    onlyRealStudyRecords: true,
  }), 0);
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

test('assunto livre da mesma disciplina conta minutos reais no guia sem duplicar entre blocos', () => {
  const cronograma = { id: 'cronograma-1' };
  const slotsDia = [
    { slotIdBase: 'port-1', disciplinaId: 'port', assunto: 'Crase', dataSlot: '2026-09-15', tempoMinutos: 60 },
    { slotIdBase: 'port-2', disciplinaId: 'port', assunto: 'Redacao', dataSlot: '2026-09-15', tempoMinutos: 60 },
  ];
  const registro = {
    cronogramaId: cronograma.id, contextoRegistro: 'cronograma', disciplinaId: 'port',
    assunto: 'Pontuacao', data: '2026-09-15', tempoEstudadoMinutos: 180,
  };
  assert.equal(getCronogramaSlotRecordedMinutes({ cronograma, slot: slotsDia[0], slotsDia, registrosEstudo: [registro] }), 60);
  assert.equal(getCronogramaSlotRecordedMinutes({ cronograma, slot: slotsDia[1], slotsDia, registrosEstudo: [registro] }), 120);
  assert.equal(getCronogramaSlotRecordedMinutes({ cronograma, slot: slotsDia[0], slotsDia,
    registrosEstudo: [{ ...registro, cronogramaSlotIdBase: 'port-2' }] }), 0);
  assert.equal(getCronogramaSlotRecordedMinutes({ cronograma, slot: slotsDia[1], slotsDia,
    registrosEstudo: [{ ...registro, cronogramaSlotIdBase: 'port-2' }] }), 180);
  assert.equal(getCronogramaSlotRecordedMinutes({ cronograma, slot: slotsDia[0], slotsDia,
    registrosEstudo: [{ ...registro, disciplinaId: 'mat' }] }), 0);
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
