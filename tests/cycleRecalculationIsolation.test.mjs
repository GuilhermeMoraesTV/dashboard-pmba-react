import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CYCLE_ROUND_IDENTITY_VERSION,
  buildCycleSessionCompletionUpdate,
  isCycleRecordInRound,
} from '../src/utils/cycleSessionCompletion.js';
import { buildCycleOrderedSessions, getCycleFreeQueue } from '../src/utils/studyDayStatus.js';

test('registros de voltas anteriores com conclusaoId preenchido não completam sessões da volta atual', () => {
  const ciclo = {
    id: 'ciclo-123',
    tempoSessaoMinutos: 50,
    ordemSessoes: [
      { disciplinaId: 'd1', sessaoIndex: 0, tempoMinutos: 50 },
      { disciplinaId: 'd2', sessaoIndex: 0, tempoMinutos: 50 },
    ],
    disciplinas: [
      { id: 'd1', nome: 'Direito Penal', duracoesSessoes: [50] },
      { id: 'd2', nome: 'Português', duracoesSessoes: [50] },
    ],
    sessoesConcluidas: [],
    progressoSessoes: {},
    sessoesConcluidasDetalhes: {},
  };

  // Registros de rodadas passadas com conclusaoId != null
  const registrosPassados = [
    {
      id: 'reg-1',
      cicloId: 'ciclo-123',
      disciplinaId: 'd1',
      contextoRegistro: 'ciclo',
      tempoEstudadoMinutos: 50,
      conclusaoId: 1, // Rodada 1 finalizada
      data: '2026-08-10',
    },
    {
      id: 'reg-2',
      cicloId: 'ciclo-123',
      disciplinaId: 'd2',
      contextoRegistro: 'ciclo',
      tempoEstudadoMinutos: 100,
      conclusaoId: 1, // Rodada 1 finalizada
      data: '2026-08-11',
    },
  ];

  const sessions = buildCycleOrderedSessions(ciclo, null, registrosPassados);

  assert.equal(sessions.length, 2);
  assert.equal(sessions[0].concluida, false);
  assert.equal(sessions[0].progressoMinutos, 0);
  assert.equal(sessions[0].bloqueiaDesmarcarConclusao, false);

  assert.equal(sessions[1].concluida, false);
  assert.equal(sessions[1].progressoMinutos, 0);
  assert.equal(sessions[1].bloqueiaDesmarcarConclusao, false);
});

test('registro da rodada ativa (conclusaoId == null) completa apenas o bloco correspondente', () => {
  const ciclo = {
    id: 'ciclo-123',
    tempoSessaoMinutos: 50,
    ordemSessoes: [
      { disciplinaId: 'd1', sessaoIndex: 0, tempoMinutos: 50 },
      { disciplinaId: 'd2', sessaoIndex: 0, tempoMinutos: 50 },
    ],
    disciplinas: [
      { id: 'd1', nome: 'Direito Penal', duracoesSessoes: [50] },
      { id: 'd2', nome: 'Português', duracoesSessoes: [50] },
    ],
    sessoesConcluidas: [],
    progressoSessoes: {},
    sessoesConcluidasDetalhes: {},
  };

  const registrosAtuais = [
    {
      id: 'reg-active',
      cicloId: 'ciclo-123',
      disciplinaId: 'd1',
      sessaoGlobalIndex: 0,
      contextoRegistro: 'ciclo',
      tempoEstudadoMinutos: 50,
      conclusaoId: null, // Rodada atual
      data: '2026-09-06',
    },
  ];

  const sessions = buildCycleOrderedSessions(ciclo, null, registrosAtuais);

  assert.equal(sessions[0].concluida, true);
  assert.equal(sessions[0].progressoMinutos, 50);
  assert.equal(sessions[0].bloqueiaDesmarcarConclusao, true);

  // Bloco 2 permanece pendente e desmarcado
  assert.equal(sessions[1].concluida, false);
  assert.equal(sessions[1].progressoMinutos, 0);
  assert.equal(sessions[1].bloqueiaDesmarcarConclusao, false);
});

test('bloco concluído por checkout_manual pode ser desmarcado normalmente', () => {
  const cycle = {
    sessoesConcluidas: [0],
    progressoSessoes: { 0: 50 },
    sessoesConcluidasDetalhes: {
      0: { origem: 'checkout_manual', concluidaEm: '2026-09-06' },
    },
  };

  const update = buildCycleSessionCompletionUpdate({
    cycle,
    sessionIndex: 0,
    targetCompleted: false,
    plannedMinutes: 50,
    completedAt: new Date(),
  });

  assert.equal(update.protectedByStudy, false);
  assert.equal(update.changed, true);
  assert.deepEqual(update.update.sessoesConcluidas, []);
  assert.equal(update.update.progressoSessoes['0'], 0);
  assert.equal(update.update.sessoesConcluidasDetalhes['0'], undefined);
});

test('fila livre do ciclo não ressuscita registros concluídos de rodadas passadas', () => {
  const ciclo = {
    id: 'ciclo-abc',
    tempoSessaoMinutos: 50,
    conclusoes: 2,
    ordemSessoes: [
      { disciplinaId: 'd1', sessaoIndex: 0, tempoMinutos: 50 },
      { disciplinaId: 'd2', sessaoIndex: 0, tempoMinutos: 50 },
    ],
    disciplinas: [
      { id: 'd1', nome: 'Direito Penal', duracoesSessoes: [50] },
      { id: 'd2', nome: 'Português', duracoesSessoes: [50] },
    ],
    sessoesConcluidas: [],
    progressoSessoes: {},
    sessoesConcluidasDetalhes: {},
  };

  const registrosEstudo = [
    {
      id: 'reg-round-1',
      cicloId: 'ciclo-abc',
      disciplinaId: 'd1',
      contextoRegistro: 'ciclo',
      tempoEstudadoMinutos: 50,
      conclusaoId: 1,
      data: '2026-08-01',
    },
    {
      id: 'reg-round-2',
      cicloId: 'ciclo-abc',
      disciplinaId: 'd2',
      contextoRegistro: 'ciclo',
      tempoEstudadoMinutos: 50,
      conclusaoId: 2,
      data: '2026-08-20',
    },
  ];

  const queue = getCycleFreeQueue(ciclo, registrosEstudo);

  assert.equal(queue.sessions.length, 2);
  assert.equal(queue.sessions.every((s) => s.concluida === false), true);
  assert.equal(queue.remainingMinutes, 100);
});

test('snapshot atrasado da rodada anterior nunca completa a rodada nova', () => {
  const ciclo = {
    id: 'ciclo-race',
    conclusoes: 1,
    roundIdentityVersion: CYCLE_ROUND_IDENTITY_VERSION,
    tempoSessaoMinutos: 50,
    ordemSessoes: [
      { disciplinaId: 'd1', sessaoIndex: 0, tempoMinutos: 50 },
      { disciplinaId: 'd2', sessaoIndex: 0, tempoMinutos: 50 },
    ],
    disciplinas: [
      { id: 'd1', duracoesSessoes: [50] },
      { id: 'd2', duracoesSessoes: [50] },
    ],
    sessoesConcluidas: [],
    progressoSessoes: {},
    sessoesConcluidasDetalhes: {},
  };
  const snapshotAtrasado = [
    { cicloId: ciclo.id, cicloRoundVersion: 0, conclusaoId: null, sessaoGlobalIndex: 0, disciplinaId: 'd1', tempoEstudadoMinutos: 50 },
    { cicloId: ciclo.id, cicloRoundVersion: 0, conclusaoId: null, sessaoGlobalIndex: 1, disciplinaId: 'd2', tempoEstudadoMinutos: 50 },
  ];

  const queue = getCycleFreeQueue(ciclo, snapshotAtrasado);
  assert.deepEqual(queue.sessions.map((session) => session.progressoMinutos), [0, 0]);
  assert.equal(queue.sessions.some((session) => session.concluida), false);
});

test('ciclo migrado rejeita registro sem identidade de rodada, mesmo com conclusaoId nulo', () => {
  const registroLegadoAtrasado = { conclusaoId: null, tempoEstudadoMinutos: 50 };
  assert.equal(isCycleRecordInRound(registroLegadoAtrasado, {
    conclusoes: 2,
    roundIdentityVersion: CYCLE_ROUND_IDENTITY_VERSION,
  }), false);
  assert.equal(isCycleRecordInRound(registroLegadoAtrasado, {
    conclusoes: 2,
    roundIdentityVersion: 0,
  }), true);
});
