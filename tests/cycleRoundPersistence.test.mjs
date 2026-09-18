import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  buildCycleProgressRollbackFromRecord,
  buildCycleProgressUpdateFromRecord,
  isCycleProgressRecord,
} from '../src/utils/cycleProgressPersistence.js';

const cycle = {
  id: 'cycle-atomic',
  conclusoes: 4,
  tempoSessaoMinutos: 50,
  ordemSessoes: [
    { disciplinaId: 'd1', sessaoIndex: 0, tempoMinutos: 30 },
    { disciplinaId: 'd2', sessaoIndex: 0, tempoMinutos: 70 },
  ],
  progressoSessoes: {},
  sessoesConcluidas: [],
  sessoesConcluidasDetalhes: {},
};

test('registro aplica progresso apenas na rodada exata e respeita a duração do bloco', () => {
  const result = buildCycleProgressUpdateFromRecord({
    cicloData: cycle,
    payload: {
      cicloId: cycle.id,
      cicloRoundVersion: 4,
      contextoRegistro: 'ciclo',
      disciplinaId: 'd1',
      sessaoGlobalIndex: 0,
      tempoEstudadoMinutos: 30,
      origem: 'timer',
      data: '2026-09-13',
    },
    disciplinas: [
      { id: 'd1', duracoesSessoes: [30] },
      { id: 'd2', duracoesSessoes: [70] },
    ],
  });

  assert.equal(result.staleRound, false);
  assert.equal(result.update.progressoSessoes['0'], 30);
  assert.deepEqual(result.update.sessoesConcluidas, [0]);
  assert.equal(result.update.sessoesConcluidasDetalhes['0'].origem, 'timer');
});

test('timer iniciado em rodada encerrada jamais altera a rodada seguinte', () => {
  const result = buildCycleProgressUpdateFromRecord({
    cicloData: cycle,
    payload: {
      cicloId: cycle.id,
      cicloRoundVersion: 3,
      contextoRegistro: 'ciclo',
      disciplinaId: 'd1',
      sessaoGlobalIndex: 0,
      tempoEstudadoMinutos: 30,
      origem: 'timer',
    },
  });

  assert.equal(result.staleRound, true);
  assert.equal(result.update, null);
});

test('ciclo migrado rejeita registro sem versão em vez de presumir a rodada atual', () => {
  const result = buildCycleProgressUpdateFromRecord({
    cicloData: { ...cycle, roundIdentityVersion: 1 },
    payload: {
      cicloId: cycle.id,
      contextoRegistro: 'ciclo',
      disciplinaId: 'd1',
      tempoEstudadoMinutos: 30,
    },
  });

  assert.equal(result.staleRound, true);
  assert.equal(result.update, null);
});

test('marcador manual nunca avança progresso, mesmo que contenha minutos legados', () => {
  assert.equal(isCycleProgressRecord({
    cicloId: cycle.id,
    tipoEstudo: 'check_manual',
    tempoEstudadoMinutos: 999,
  }), false);
});

test('índice de sessão nulo não é convertido acidentalmente em bloco zero', () => {
  const result = buildCycleProgressUpdateFromRecord({
    cicloData: cycle,
    payload: {
      cicloId: cycle.id,
      cicloRoundVersion: 4,
      contextoRegistro: 'ciclo',
      disciplinaId: 'd2',
      sessaoGlobalIndex: null,
      tempoEstudadoMinutos: 20,
      origem: 'registro_manual',
    },
    disciplinas: [{ id: 'd2', duracoesSessoes: [70] }],
  });

  assert.equal(result.update.progressoSessoes['0'], undefined);
  assert.equal(result.update.progressoSessoes['1'], 20);
});

test('persistência de estudo e progresso do ciclo usa a mesma transação', () => {
  const creationSource = readFileSync(new URL('../src/services/studyRecords/creation.js', import.meta.url), 'utf8');
  const actionsSource = readFileSync(new URL('../src/hooks/useStudyRecordActions.js', import.meta.url), 'utf8');
  const timerModalSource = readFileSync(new URL('../src/components/ciclos/TimerFinishModal.jsx', import.meta.url), 'utf8');
  const registroModalSource = readFileSync(new URL('../src/components/ciclos/RegistroEstudoModal.jsx', import.meta.url), 'utf8');
  const ciclosSource = readFileSync(new URL('../src/hooks/useCiclos.jsx', import.meta.url), 'utf8');

  assert.match(creationSource, /transaction\.set\(registroRef, persistedPayload\)/);
  assert.match(creationSource, /transaction\.update\(cicloRef, \{/);
  assert.match(creationSource, /\.\.\.\(progressResult\.update \|\| \{\}\)/);
  assert.match(actionsSource, /persistCycleStudyRecordWithProgress/);
  assert.match(actionsSource, /`cycle_\$\{cycleProgressOperationId\}`/);
  assert.match(timerModalSource, /await Promise\.all\(saveTasks\)/);
  assert.match(timerModalSource, /cycleProgressOperationId/);
  assert.match(registroModalSource, /await Promise\.all\(saveTasks\)/);
  assert.match(registroModalSource, /cycleProgressOperationId/);
  assert.doesNotMatch(ciclosSource, /registrosAtuaisRefs/);
  assert.match(ciclosSource, /cycleProgressOperations: \{\}/);
  assert.match(ciclosSource, /roundIdentityVersion: CYCLE_ROUND_IDENTITY_VERSION/);
});

test('exclusão reverte exatamente as alocações persistidas do registro', () => {
  const rollback = buildCycleProgressRollbackFromRecord({
    cicloData: {
      conclusoes: 3,
      roundIdentityVersion: 1,
      progressoSessoes: { 0: 50, 1: 25 },
      sessoesConcluidas: [0],
      sessoesConcluidasDetalhes: { 0: { origem: 'timer' } },
    },
    payload: {
      cicloRoundVersion: 3,
      cycleProgressAllocations: {
        0: { minutes: 20, plannedMinutes: 50 },
        1: { minutes: 10, plannedMinutes: 40 },
      },
    },
  });

  assert.deepEqual(rollback.progressoSessoes, { 0: 30, 1: 15 });
  assert.deepEqual(rollback.sessoesConcluidas, []);
  assert.equal(rollback.sessoesConcluidasDetalhes['0'], undefined);
});

test('exclusão de registro de outra rodada não altera a rodada atual', () => {
  assert.equal(buildCycleProgressRollbackFromRecord({
    cicloData: { conclusoes: 4, roundIdentityVersion: 1 },
    payload: {
      cicloRoundVersion: 3,
      cycleProgressAllocations: { 0: { minutes: 50, plannedMinutes: 50 } },
    },
  }), null);
});
