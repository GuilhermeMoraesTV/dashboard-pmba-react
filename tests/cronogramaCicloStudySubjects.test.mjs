import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildScheduleRecordedProgress,
} from '../functions/gamification/scheduleStudyProgress.mjs';

import {
  buildCycleOrderedSessions,
} from '../src/utils/studyDayStatus.js';

test('1. Cronograma e Ciclo: 3 assuntos da mesma disciplina aparecem sem repeticao', () => {
  // Cronograma: 1 planejado + 2 extras na mesma disciplina
  const slots = [
    { slotId: 'slot-0', slotIdBase: 'slot-0', disciplinaId: 'd-dpm', disciplinaNome: 'Direito Penal Militar', assunto: 'Principios', tempoMinutos: 60, minutosEstudo: 60, dataSlot: '2026-09-17' },
  ];

  const scheduleRecords = [
    { id: 'r1', cronogramaId: 'c1', contextoRegistro: 'cronograma', disciplinaId: 'd-dpm', assunto: 'Principios', tempoEstudadoMinutos: 20, data: '2026-09-17' },
    { id: 'r2', cronogramaId: 'c1', contextoRegistro: 'cronograma', disciplinaId: 'd-dpm', assunto: 'Crimes militares', tempoEstudadoMinutos: 25, data: '2026-09-17' },
    { id: 'r3', cronogramaId: 'c1', contextoRegistro: 'cronograma', disciplinaId: 'd-dpm', assunto: 'Aplicacao da lei penal militar', tempoEstudadoMinutos: 15, data: '2026-09-17' },
    // Registro repetido do mesmo assunto para testar deduplicacao
    { id: 'r4', cronogramaId: 'c1', contextoRegistro: 'cronograma', disciplinaId: 'd-dpm', assunto: 'Principios', tempoEstudadoMinutos: 10, data: '2026-09-17' },
  ];

  const cronoProgress = buildScheduleRecordedProgress({ slots, records: scheduleRecords });
  const dpmKey = 'slot-0';

  assert.equal(cronoProgress.allSubjects[dpmKey].length, 3, 'Deve conter exatamente 3 assuntos distintos');
  assert.deepEqual(cronoProgress.allSubjects[dpmKey], ['Principios', 'Crimes militares', 'Aplicacao da lei penal militar']);

  const details = cronoProgress.subjectDetails[dpmKey];
  assert.equal(details.length, 3);
  const princDetail = details.find(d => d.assunto === 'Principios');
  assert.equal(princDetail.minutos, 30, 'Soma minutos dos 2 registros de Principios (20 + 10)');
  assert.equal(princDetail.isPlanned, true, 'Principios e o planejado');
  assert.equal(princDetail.isExtra, false);

  const crimeDetail = details.find(d => d.assunto === 'Crimes militares');
  assert.equal(crimeDetail.isPlanned, false);
  assert.equal(crimeDetail.isExtra, true, 'Crimes militares e extra');

  // Ciclo: 3 assuntos no mesmo bloco de sessao
  const ciclo = {
    id: 'ciclo-1',
    conclusoes: 0,
    tempoSessaoMinutos: 60,
    ordemSessoes: [{ disciplinaId: 'd-dpm', sessaoIndex: 0, tempoPlanejadoMinutos: 60 }],
    disciplinas: [{ id: 'd-dpm', nome: 'Direito Penal Militar' }],
  };

  const cycleRecords = [
    { id: 'cr1', cicloId: 'ciclo-1', contextoRegistro: 'ciclo', disciplinaId: 'd-dpm', assunto: 'Principios', tempoEstudadoMinutos: 20, sessaoGlobalIndex: 0, cicloRoundVersion: 0 },
    { id: 'cr2', cicloId: 'ciclo-1', contextoRegistro: 'ciclo', disciplinaId: 'd-dpm', assunto: 'Crimes militares', tempoEstudadoMinutos: 25, sessaoGlobalIndex: 0, cicloRoundVersion: 0 },
    { id: 'cr3', cicloId: 'ciclo-1', contextoRegistro: 'ciclo', disciplinaId: 'd-dpm', assunto: 'Aplicacao da lei penal militar', tempoEstudadoMinutos: 15, sessaoGlobalIndex: 0, cicloRoundVersion: 0 },
    // Registro repetido para testar agrupamento
    { id: 'cr4', cicloId: 'ciclo-1', contextoRegistro: 'ciclo', disciplinaId: 'd-dpm', assunto: 'Principios', tempoEstudadoMinutos: 10, sessaoGlobalIndex: 0, cicloRoundVersion: 0 },
  ];

  const sessions = buildCycleOrderedSessions(ciclo, null, cycleRecords);
  assert.equal(sessions[0].assuntosEstudados.length, 3, 'Deve conter 3 assuntos no bloco');
  assert.equal(sessions[0].progressoMinutos, 70, 'Soma minutos reais dos assuntos (20 + 25 + 15 + 10 = 70)');
  const cPrinc = sessions[0].assuntosEstudados.find(a => a.assunto === 'Principios');
  assert.equal(cPrinc.minutos, 30);
});

test('2. Estudo parcial aparece como Estudado sem ser considerado Finalizado', () => {
  // Cronograma: 35 de 60 minutos estudados, markAsFinished false
  const slots = [
    { slotId: 'slot-0', slotIdBase: 'slot-0', disciplinaId: 'd-dpm', disciplinaNome: 'Direito Penal Militar', assunto: 'Principios', tempoMinutos: 60, minutosEstudo: 60, dataSlot: '2026-09-17' },
  ];

  const scheduleRecords = [
    { id: 'r1', cronogramaId: 'c1', contextoRegistro: 'cronograma', disciplinaId: 'd-dpm', assunto: 'Principios', tempoEstudadoMinutos: 35, markAsFinished: false, data: '2026-09-17' },
  ];

  const cronoProgress = buildScheduleRecordedProgress({ slots, records: scheduleRecords });
  const dpmKey = 'slot-0';
  assert.equal(cronoProgress.completed[dpmKey], false, 'Bloco nao esta concluido pois 35m < 60m e markAsFinished e false');
  assert.equal(cronoProgress.subjectDetails[dpmKey][0].markAsFinished, false, 'Assunto nao esta finalizado');
  assert.equal(cronoProgress.subjectDetails[dpmKey][0].minutos, 35);
  assert.equal(cronoProgress.hasPlannedStudied[dpmKey], true, 'Planejado foi estudado');

  // Ciclo: 35 de 60 minutos estudados
  const ciclo = {
    id: 'ciclo-1',
    conclusoes: 0,
    tempoSessaoMinutos: 60,
    ordemSessoes: [{ disciplinaId: 'd-dpm', sessaoIndex: 0, tempoPlanejadoMinutos: 60 }],
    disciplinas: [{ id: 'd-dpm', nome: 'Direito Penal Militar' }],
  };

  const cycleRecords = [
    { id: 'cr1', cicloId: 'ciclo-1', contextoRegistro: 'ciclo', disciplinaId: 'd-dpm', assunto: 'Principios', tempoEstudadoMinutos: 20, sessaoGlobalIndex: 0, markAsFinished: false, cicloRoundVersion: 0 },
    { id: 'cr2', cicloId: 'ciclo-1', contextoRegistro: 'ciclo', disciplinaId: 'd-dpm', assunto: 'Crimes militares', tempoEstudadoMinutos: 15, sessaoGlobalIndex: 0, markAsFinished: false, cicloRoundVersion: 0 },
  ];

  const sessions = buildCycleOrderedSessions(ciclo, null, cycleRecords);
  assert.equal(sessions[0].progressoMinutos, 35);
  assert.equal(sessions[0].concluida, false, 'Bloco de 60m nao deve estar concluido com 35m');
  assert.equal(sessions[0].assuntosEstudados.length, 2);
  assert.equal(sessions[0].assuntosEstudados[0].markAsFinished, false);
  assert.equal(sessions[0].assuntosEstudados[1].markAsFinished, false);
});

test('3. Assunto planejado/sugerido nao estudado nao aparece como concluido', () => {
  // Cronograma: Planejado e Principios, mas usuario estudou apenas Crimes militares
  const slots = [
    { slotId: 'slot-0', slotIdBase: 'slot-0', disciplinaId: 'd-dpm', disciplinaNome: 'Direito Penal Militar', assunto: 'Principios', tempoMinutos: 60, minutosEstudo: 60, dataSlot: '2026-09-17' },
  ];

  const scheduleRecords = [
    { id: 'r1', cronogramaId: 'c1', contextoRegistro: 'cronograma', disciplinaId: 'd-dpm', assunto: 'Crimes militares', tempoEstudadoMinutos: 60, markAsFinished: true, data: '2026-09-17' },
  ];

  const cronoProgress = buildScheduleRecordedProgress({ slots, records: scheduleRecords });
  const dpmKey = 'slot-0';
  assert.equal(cronoProgress.completed[dpmKey], true, 'Bloco foi cumprido pelo tempo da disciplina');
  assert.equal(cronoProgress.hasPlannedStudied[dpmKey], false, 'Planejado Principios NAO foi estudado');
  assert.equal(cronoProgress.allSubjects[dpmKey].includes('Principios'), false, 'Principios nao consta nos assuntos estudados');
  assert.equal(cronoProgress.allSubjects[dpmKey].includes('Crimes militares'), true);

  // Ciclo: Sugerido e Principios, mas usuario estudou Crimes militares
  const ciclo = {
    id: 'ciclo-1',
    conclusoes: 0,
    tempoSessaoMinutos: 60,
    ordemSessoes: [{ disciplinaId: 'd-dpm', sessaoIndex: 0, tempoPlanejadoMinutos: 60 }],
    disciplinas: [{
      id: 'd-dpm',
      nome: 'Direito Penal Militar',
      assuntos: [{ nome: 'Principios', concluido: false }, { nome: 'Crimes militares', concluido: false }],
    }],
  };

  const cycleRecords = [
    { id: 'cr1', cicloId: 'ciclo-1', contextoRegistro: 'ciclo', disciplinaId: 'd-dpm', assunto: 'Crimes militares', tempoEstudadoMinutos: 60, sessaoGlobalIndex: 0, markAsFinished: true, cicloRoundVersion: 0 },
  ];

  const sessions = buildCycleOrderedSessions(ciclo, null, cycleRecords);
  assert.equal(sessions[0].progressoMinutos, 60);
  assert.equal(sessions[0].concluida, true);
  assert.equal(sessions[0].assuntosEstudados.length, 1);
  assert.equal(sessions[0].assuntosEstudados[0].assunto, 'Crimes militares');
  assert.equal(sessions[0].assuntosEstudados.some(a => a.assunto === 'Principios'), false, 'Principios nao foi estudado e nao aparece');
});

test('4. Mesmo registro nao preenche dois blocos; estudo extra nao consome bloco', () => {
  const ciclo = {
    id: 'ciclo-1',
    conclusoes: 0,
    tempoSessaoMinutos: 60,
    ordemSessoes: [
      { disciplinaId: 'd-dpm', sessaoIndex: 0, tempoPlanejadoMinutos: 60 },
      { disciplinaId: 'd-dpm', sessaoIndex: 1, tempoPlanejadoMinutos: 60 },
    ],
    disciplinas: [{ id: 'd-dpm', nome: 'Direito Penal Militar' }],
  };

  // 1 registro de 60m apontando para sessaoGlobalIndex 0
  const cycleRecords1 = [
    { id: 'cr1', cicloId: 'ciclo-1', contextoRegistro: 'ciclo', disciplinaId: 'd-dpm', assunto: 'Principios', tempoEstudadoMinutos: 60, sessaoGlobalIndex: 0, cicloRoundVersion: 0 },
  ];

  const sessions1 = buildCycleOrderedSessions(ciclo, null, cycleRecords1);
  assert.equal(sessions1[0].concluida, true, 'Bloco 0 concluido');
  assert.equal(sessions1[0].progressoMinutos, 60);
  assert.equal(sessions1[1].concluida, false, 'Bloco 1 NAO deve ser preenchido pelo mesmo registro');
  assert.equal(sessions1[1].progressoMinutos, 0);

  // 1 registro sem indice (alocacao frouxa): aloca apenas ao primeiro bloco pendente
  const cycleRecords2 = [
    { id: 'cr2', cicloId: 'ciclo-1', contextoRegistro: 'ciclo', disciplinaId: 'd-dpm', assunto: 'Crimes militares', tempoEstudadoMinutos: 60, cicloRoundVersion: 0 },
  ];

  const sessions2 = buildCycleOrderedSessions(ciclo, null, cycleRecords2);
  assert.equal(sessions2[0].concluida, true);
  assert.equal(sessions2[1].concluida, false, 'Bloco 1 continua pendente sem dupla contagem');

  // Registro marcado como isEstudoExtra: true: NAO preenche nenhum bloco do ciclo
  const cycleRecordsExtra = [
    { id: 'cr-extra', cicloId: 'ciclo-1', contextoRegistro: 'ciclo', disciplinaId: 'd-dpm', assunto: 'Jurisprudencia', tempoEstudadoMinutos: 60, isEstudoExtra: true, cicloRoundVersion: 0 },
  ];

  const sessionsExtra = buildCycleOrderedSessions(ciclo, null, cycleRecordsExtra);
  assert.equal(sessionsExtra[0].concluida, false, 'Estudo extra nao consome Bloco 0');
  assert.equal(sessionsExtra[0].progressoMinutos, 0);
  assert.equal(sessionsExtra[1].concluida, false, 'Estudo extra nao consome Bloco 1');
  assert.equal(sessionsExtra[1].progressoMinutos, 0);
});

test('5. Edicao/exclusao de registro atualiza assuntos e progresso dinamicamente', () => {
  const ciclo = {
    id: 'ciclo-1',
    conclusoes: 0,
    tempoSessaoMinutos: 60,
    ordemSessoes: [{ disciplinaId: 'd-dpm', sessaoIndex: 0, tempoPlanejadoMinutos: 60 }],
    disciplinas: [{ id: 'd-dpm', nome: 'Direito Penal Militar' }],
  };

  // Estado inicial: 2 registros
  let records = [
    { id: 'cr1', cicloId: 'ciclo-1', contextoRegistro: 'ciclo', disciplinaId: 'd-dpm', assunto: 'Principios', tempoEstudadoMinutos: 20, sessaoGlobalIndex: 0, cicloRoundVersion: 0 },
    { id: 'cr2', cicloId: 'ciclo-1', contextoRegistro: 'ciclo', disciplinaId: 'd-dpm', assunto: 'Crimes militares', tempoEstudadoMinutos: 15, sessaoGlobalIndex: 0, cicloRoundVersion: 0 },
  ];

  let sessions = buildCycleOrderedSessions(ciclo, null, records);
  assert.equal(sessions[0].progressoMinutos, 35);
  assert.equal(sessions[0].assuntosEstudados.length, 2);

  // Edicao do registro cr2: aumenta minutos de 15 para 40 (atingindo 60m e concluindo bloco)
  records = records.map(r => r.id === 'cr2' ? { ...r, tempoEstudadoMinutos: 40 } : r);
  sessions = buildCycleOrderedSessions(ciclo, null, records);
  assert.equal(sessions[0].progressoMinutos, 60);
  assert.equal(sessions[0].concluida, true, 'Apos edicao para 40m, bloco conclui com 60m');
  const editedSubject = sessions[0].assuntosEstudados.find(a => a.assunto === 'Crimes militares');
  assert.equal(editedSubject.minutos, 40);

  // Exclusao do registro cr1: resta apenas cr2 (40m)
  records = records.filter(r => r.id !== 'cr1');
  sessions = buildCycleOrderedSessions(ciclo, null, records);
  assert.equal(sessions[0].progressoMinutos, 40);
  assert.equal(sessions[0].concluida, false, 'Apos exclusao de cr1, bloco volta para pendente com 40m');
  assert.equal(sessions[0].assuntosEstudados.length, 1);
  assert.equal(sessions[0].assuntosEstudados[0].assunto, 'Crimes militares');
});

test('6. Historico preservado: registros de rodadas anteriores nao afetam rodada atual', () => {
  const ciclo = {
    id: 'ciclo-1',
    conclusoes: 1, // Rodada atual = 1
    tempoSessaoMinutos: 60,
    ordemSessoes: [{ disciplinaId: 'd-dpm', sessaoIndex: 0, tempoPlanejadoMinutos: 60 }],
    disciplinas: [{ id: 'd-dpm', nome: 'Direito Penal Militar' }],
  };

  const records = [
    // Registro historico da Rodada 0
    { id: 'cr-old', cicloId: 'ciclo-1', contextoRegistro: 'ciclo', disciplinaId: 'd-dpm', assunto: 'Principios', tempoEstudadoMinutos: 60, sessaoGlobalIndex: 0, cicloRoundVersion: 0 },
    // Registro da nova Rodada 1
    { id: 'cr-new', cicloId: 'ciclo-1', contextoRegistro: 'ciclo', disciplinaId: 'd-dpm', assunto: 'Principios', tempoEstudadoMinutos: 25, sessaoGlobalIndex: 0, cicloRoundVersion: 1 },
  ];

  const sessions = buildCycleOrderedSessions(ciclo, null, records);
  assert.equal(sessions[0].progressoMinutos, 25, 'Considera apenas minutos da rodada atual 1');
  assert.equal(sessions[0].concluida, false, 'Bloco da rodada 1 nao deve estar concluido pelo registro da rodada 0');
  assert.equal(sessions[0].assuntosEstudados.length, 1);
  assert.equal(sessions[0].assuntosEstudados[0].minutos, 25);
});
