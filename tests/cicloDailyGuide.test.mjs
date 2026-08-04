import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { getCycleDailyGuide } from '../src/utils/studyDayStatus.js';

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
