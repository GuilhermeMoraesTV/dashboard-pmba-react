import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { buildStudyDaysMap, getCycleDailyGuide, getCycleFreeQueue, getDailyStudyStatus } from '../src/utils/studyDayStatus.js';

describe('cycle daily guide', () => {
  it('uses leftover minutes as an extra planned study session and avoids repeated disciplines when possible', () => {
    const ciclo = {
      id: 'ciclo-1',
      dataCriacao: '2026-08-03',
      tempoSessaoMinutos: 60,
      diasEstudo: { 1: 2.1667 },
      disciplinas: [
        { id: 'pt', nome: 'Lingua Portuguesa', assuntos: ['A'] },
        { id: 'mat', nome: 'Matematica', assuntos: ['A'] },
        { id: 'inf', nome: 'Informatica', assuntos: ['A'] },
      ],
      ordemSessoes: [
        { disciplinaId: 'pt', sessaoIndex: 0 },
        { disciplinaId: 'pt', sessaoIndex: 1 },
        { disciplinaId: 'mat', sessaoIndex: 0 },
        { disciplinaId: 'inf', sessaoIndex: 0 },
      ],
      sessoesConcluidas: [],
      progressoSessoes: {},
    };

    const guide = getCycleDailyGuide(ciclo, new Date('2026-08-03T12:00:00'), []);

    assert.equal(guide.remainingMinutes, 0);
    assert.equal(guide.plannedMinutes, 130);
    assert.deepEqual(
      guide.sessions.map((session) => session.disciplinaId),
      ['pt', 'mat', 'inf']
    );
    assert.deepEqual(
      guide.sessions.map((session) => session.tempoPlanejadoMinutos),
      [60, 60, 10]
    );
    assert.equal(guide.sessions[2].sessaoParcial, true);
  });
});

describe('cycle free queue', () => {
  it('keeps every visual cycle block without date or carryover', () => {
    const ciclo = {
      id: 'ciclo-livre',
      tempoSessaoMinutos: 60,
      disciplinas: [
        { id: 'pt', nome: 'Portugues', inCiclo: true, assuntos: ['A'] },
        { id: 'mat', nome: 'Matematica', inCiclo: true, assuntos: ['B'] },
      ],
      ordemSessoes: [
        { disciplinaId: 'pt', sessaoIndex: 0, tempoPlanejadoMinutos: 45 },
        { disciplinaId: 'mat', sessaoIndex: 0, tempoPlanejadoMinutos: 55 },
        { disciplinaId: 'pt', sessaoIndex: 1, tempoPlanejadoMinutos: 40 },
      ],
      sessoesConcluidas: [],
      progressoSessoes: {},
    };

    const queue = getCycleFreeQueue(ciclo, []);
    assert.deepEqual(queue.sessions.map((session) => session.disciplinaId), ['pt', 'mat', 'pt']);
    assert.deepEqual(queue.sessions.map((session) => session.tempoPlanejadoMinutos), [50, 60, 40]);
    assert.equal(queue.sessions.some((session) => session.assignedDate || session.carriedOver), false);
  });

  it('does not reuse records from a completed round in the new free queue', () => {
    const ciclo = {
      id: 'ciclo-voltas',
      tempoSessaoMinutos: 60,
      disciplinas: [{ id: 'pt', nome: 'Portugues', assuntos: ['A'] }],
      ordemSessoes: [{ disciplinaId: 'pt', sessaoIndex: 0, tempoPlanejadoMinutos: 45 }],
      sessoesConcluidas: [],
      progressoSessoes: {},
    };
    const queue = getCycleFreeQueue(ciclo, [{
      cicloId: ciclo.id,
      disciplinaId: 'pt',
      sessaoGlobalIndex: 0,
      tempoEstudadoMinutos: 45,
      conclusaoId: 1,
    }]);

    assert.equal(queue.sessions[0].concluida, false);
    assert.equal(queue.sessions[0].progressoMinutos, 0);
    assert.equal(queue.remainingMinutes, 50);
  });

  it('repairs an old max-only order with the configured discipline durations', () => {
    const queue = getCycleFreeQueue({
      id: 'ciclo-duracoes',
      tempoSessaoMinutos: 90,
      disciplinas: [{
        id: 'pt',
        nome: 'Portugues',
        duracoesSessoes: [50, 70, 90],
      }],
      ordemSessoes: [
        { disciplinaId: 'pt', sessaoIndex: 0, tempoPlanejadoMinutos: 90 },
        { disciplinaId: 'pt', sessaoIndex: 1, tempoPlanejadoMinutos: 90 },
        { disciplinaId: 'pt', sessaoIndex: 2, tempoPlanejadoMinutos: 90 },
      ],
      sessoesConcluidas: [],
      progressoSessoes: {},
    });

    assert.deepEqual(queue.sessions.map((session) => session.tempoPlanejadoMinutos), [50, 70, 90]);
    assert.equal(queue.plannedMinutes, 210);
  });

  it('normalizes persisted visual blocks to round ten-minute durations', () => {
    const queue = getCycleFreeQueue({
      id: 'ciclo-tempos-redondos',
      duracaoMinimaSessaoMinutos: 40,
      duracaoMaximaSessaoMinutos: 90,
      disciplinas: [{
        id: 'pt',
        nome: 'Portugues',
        duracoesSessoes: [55, 66, 88],
      }],
      ordemSessoes: [
        { disciplinaId: 'pt', sessaoIndex: 0 },
        { disciplinaId: 'pt', sessaoIndex: 1 },
        { disciplinaId: 'pt', sessaoIndex: 2 },
      ],
    });

    assert.deepEqual(queue.sessions.map((session) => session.tempoPlanejadoMinutos), [60, 70, 90]);
  });

  it('preserves a partial block below the configured minimum in the card queue', () => {
    const queue = getCycleFreeQueue({
      id: 'ciclo-parcial-20',
      tempoSessaoMinutos: 60,
      duracaoMinimaSessaoMinutos: 60,
      duracaoMaximaSessaoMinutos: 60,
      ordemSessoes: [{ disciplinaId: 'pt', sessaoIndex: 0, tempoPlanejadoMinutos: 20 }],
      disciplinas: [{ id: 'pt', nome: 'Português', duracoesSessoes: [20] }],
      sessoesConcluidas: [],
      progressoSessoes: {},
    }, []);

    assert.equal(queue.sessions[0].tempoPlanejadoMinutos, 20);
  });

  it('does not create a missed-day status when the cycle was not studied', () => {
    const status = getDailyStudyStatus({
      date: '2026-08-01',
      studyDaysMap: {},
      activeCronogramaData: null,
      activeCicloData: { id: 'ciclo-livre', dataCriacao: '2026-07-01' },
      getAgendaSemana: () => [],
      contextMode: 'ciclo',
      registrosEstudo: [],
    });

    assert.equal(status.status, 'no-data');
    assert.equal(status.goalMet, false);
  });

  it('counts checkout planned time toward the configured cycle goal', () => {
    const date = '2026-08-03';
    const cycle = {
      id: 'ciclo-meta',
      dataCriacao: '2026-08-01',
      diasEstudo: { 1: 2 },
    };
    const completionOnly = [{
      data: date,
      cicloId: cycle.id,
      tempoEstudadoMinutos: 120,
      origemConclusao: 'botao_concluir',
    }];
    const partialConfirmed = [{
      data: date,
      cicloId: cycle.id,
      tempoEstudadoMinutos: 90,
      origemConclusao: 'timer',
    }];
    const completedConfirmed = [{
      data: date,
      cicloId: cycle.id,
      tempoEstudadoMinutos: 120,
      origemConclusao: 'timer',
    }];

    const getStatus = (records) => getDailyStudyStatus({
      date,
      studyDaysMap: buildStudyDaysMap(records),
      activeCronogramaData: null,
      activeCicloData: cycle,
      getAgendaSemana: () => [],
      contextMode: 'ciclo',
      registrosEstudo: records,
    });

    assert.equal(getStatus(completionOnly).goalMet, true);
    assert.equal(getStatus(completionOnly).status, 'goal-met-both');
    assert.equal(getStatus(partialConfirmed).goalMet, false);
    assert.equal(getStatus(partialConfirmed).status, 'goal-met-one');
    assert.equal(getStatus(completedConfirmed).goalMet, true);
    assert.equal(getStatus(completedConfirmed).status, 'goal-met-both');
  });

  it('keeps the queue identical to the real visual blocks and ignores disciplines without sessions', () => {
    const queue = getCycleFreeQueue({
      id: 'ciclo-legado',
      disciplinas: [
        { id: 'pt', nome: 'Portugues', inCiclo: true },
        { id: 'adm', nome: 'Administrativo', inCiclo: false },
        { id: 'dh', nome: 'Direitos Humanos', inCiclo: false },
      ],
      ordemSessoes: [
        { disciplinaId: 'pt', sessaoIndex: 0, tempoPlanejadoMinutos: 45 },
        { disciplinaId: 'adm', sessaoIndex: 0, tempoPlanejadoMinutos: 45 },
      ],
    });

    assert.deepEqual(queue.sessions.map((session) => session.disciplinaId), ['pt', 'adm']);
    assert.deepEqual(queue.sessions.map((session) => session.globalIndex), [0, 1]);
  });
});
