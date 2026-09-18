import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildCycleSessionCompletionUpdate,
  getStudyBackedCycleCompletionState,
} from '../src/utils/cycleSessionCompletion.js';
import { buildCycleOrderedSessions } from '../src/utils/studyDayStatus.js';

test('conclusão grava mapas completos e duração planejada sem field path numérico', () => {
  const result = buildCycleSessionCompletionUpdate({
    cycle: { sessoesConcluidas: [], progressoSessoes: {}, sessoesConcluidasDetalhes: {} },
    sessionIndex: 0,
    targetCompleted: true,
    plannedMinutes: 60,
    completedAt: new Date('2026-08-24T12:00:00Z'),
  });
  assert.equal(result.changed, true);
  assert.deepEqual(result.update.sessoesConcluidas, [0]);
  assert.equal(result.update.progressoSessoes['0'], 60);
  assert.equal(result.update.sessoesConcluidasDetalhes['0'].origem, 'checkout_manual');
  assert.equal(Object.keys(result.update).some((key) => key.includes('.0')), false);
});

test('estado-alvo repetido é idempotente', () => {
  const result = buildCycleSessionCompletionUpdate({
    cycle: { sessoesConcluidas: [2], progressoSessoes: { 2: 45 } },
    sessionIndex: 2,
    targetCompleted: true,
    plannedMinutes: 45,
    completedAt: new Date(),
  });
  assert.equal(result.changed, false);
  assert.equal(result.update, null);
});

test('registro real protege a conclusão contra desmarcação', () => {
  const result = buildCycleSessionCompletionUpdate({
    cycle: {
      sessoesConcluidas: [1],
      progressoSessoes: { 1: 90 },
      sessoesConcluidasDetalhes: { 1: { origem: 'registro_manual' } },
    },
    sessionIndex: 1,
    targetCompleted: false,
    plannedMinutes: 60,
    completedAt: new Date(),
  });
  assert.equal(result.protectedByStudy, true);
  assert.equal(result.update, null);
});

test('estado concluído sem progresso não deixa todos os blocos verdes', () => {
  const sessions = buildCycleOrderedSessions({
    id: 'cycle-1',
    tempoSessaoMinutos: 60,
    ordemSessoes: [
      { disciplinaId: 'd1', sessaoIndex: 0, tempoMinutos: 60 },
      { disciplinaId: 'd1', sessaoIndex: 1, tempoMinutos: 60 },
    ],
    disciplinas: [{ id: 'd1', duracoesSessoes: [60, 60] }],
    sessoesConcluidas: [0, 1],
    progressoSessoes: {},
    sessoesConcluidasDetalhes: {
      0: { origem: 'checkout_manual' },
      1: { origem: 'checkout_manual' },
    },
  });

  assert.deepEqual(sessions.map((session) => session.concluida), [false, false]);
  assert.deepEqual(sessions.map((session) => session.progressoMinutos), [0, 0]);
});

test('conclusão por checkout manual com minutos persistidos é ignorada', () => {
  const sessions = buildCycleOrderedSessions({
    id: 'cycle-1',
    tempoSessaoMinutos: 60,
    ordemSessoes: [
      { disciplinaId: 'd1', sessaoIndex: 0, tempoMinutos: 60 },
      { disciplinaId: 'd1', sessaoIndex: 1, tempoMinutos: 60 },
    ],
    disciplinas: [{ id: 'd1', duracoesSessoes: [60, 60] }],
    sessoesConcluidas: [0],
    progressoSessoes: { 0: 60 },
    sessoesConcluidasDetalhes: { 0: { origem: 'checkout_manual' } },
  });

  assert.deepEqual(sessions.map((session) => session.concluida), [false, false]);
  assert.deepEqual(sessions.map((session) => session.progressoMinutos), [0, 0]);
});

test('normalização remove checkout pendente e preserva conclusões vindas de estudo', () => {
  const state = getStudyBackedCycleCompletionState({
    sessoesConcluidas: [0, 1, 2],
    progressoSessoes: { 0: 60, 1: 60, 2: 60 },
    sessoesConcluidasDetalhes: {
      0: { origem: 'checkout_manual' },
      1: { origem: 'timer' },
      2: { origem: 'registro_manual' },
    },
  });

  assert.deepEqual(state.sessoesConcluidas, [1, 2]);
  assert.equal(state.progressoSessoes['0'], undefined);
  assert.equal(state.progressoSessoes['1'], 60);
  assert.equal(state.progressoSessoes['2'], 60);
  assert.equal(state.sessoesConcluidasDetalhes['0'], undefined);
  assert.equal(state.removedManualCheckoutCount, 1);
});
