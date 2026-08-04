import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { gerarSchedule } from '../src/services/scheduling/index.js';
import { getAgendaSemana } from '../src/services/scheduling/review.js';

describe('scheduling daily disciplines', () => {
  it('places every daily discipline on every active day', () => {
    const resultado = gerarSchedule(
      [
        {
          id: 'lei',
          nome: 'Legislacao',
          nivel: 'intermediario',
          assuntos: ['A', 'B'],
          estudarTodosDias: true,
        },
        {
          id: 'pt',
          nome: 'Portugues',
          nivel: 'intermediario',
          assuntos: ['A', 'B'],
          estudarTodosDias: true,
        },
        {
          id: 'inf',
          nome: 'Informatica',
          nivel: 'iniciante',
          assuntos: ['A', 'B'],
        },
      ],
      { 1: 1, 2: 1, 3: 1 },
      { dataInicio: '2026-08-03' }
    );

    assert.ok(resultado?.semanaTemplate?.length > 0);

    [1, 2, 3].forEach((dia) => {
      const idsNoDia = new Set(
        resultado.semanaTemplate
          .filter((slot) => slot.dia === dia)
          .map((slot) => slot.disciplinaId)
      );
      assert.equal(idsNoDia.has('lei'), true);
      assert.equal(idsNoDia.has('pt'), true);
    });

    resultado.semanaTemplate.forEach((slot) => {
      const totalDia = resultado.semanaTemplate
        .filter((item) => item.dia === slot.dia)
        .reduce((total, item) => total + Number(item.minutosEstudo || 0), 0);
      assert.ok(totalDia <= 60);
    });
  });

  it('respects daily subject limits and fills the configured day budget in agenda', () => {
    const assuntos = ['A', 'B', 'C', 'D', 'E', 'F'];
    const disciplinas = [
      { id: 'lei', nome: 'Legislacao', nivel: 'intermediario', assuntos, estudarTodosDias: true },
      { id: 'pt', nome: 'Portugues', nivel: 'intermediario', assuntos, estudarTodosDias: true },
      { id: 'inf', nome: 'Informatica', nivel: 'iniciante', assuntos },
      { id: 'mat', nome: 'Matematica', nivel: 'iniciante', assuntos },
    ];
    const horarios = { 1: 3, 2: 3, 3: 3, 4: 3, 5: 3 };
    const limitesPorDia = { 1: 2, 2: 2, 3: 2, 4: 2, 5: 2 };
    const resultado = gerarSchedule(
      disciplinas,
      horarios,
      {
        dataInicio: '2026-08-03',
        limitarMaterias: true,
        limitesPorDia,
        tempoRevisaoMinutos: 20,
      }
    );

    assert.ok(resultado?.semanaTemplate?.length > 0);

    [1, 2, 3, 4, 5].forEach((dia) => {
      const estudosDia = resultado.semanaTemplate.filter((slot) => slot.dia === dia);
      const idsEstudo = new Set(estudosDia.map((slot) => slot.disciplinaId));

      assert.equal(estudosDia.length, 2);
      assert.deepEqual([...idsEstudo].sort(), ['lei', 'pt']);
    });

    const agenda = getAgendaSemana(
      {
        ...resultado,
        disciplinasSnapshot: disciplinas,
        progresso: {},
        historicoRevisoes: {},
        dataInicio: '2026-08-03',
        limitarMaterias: true,
        limitesPorDia,
      },
      0,
      null,
      null,
      horarios
    );

    [1, 2, 3, 4, 5].forEach((dia) => {
      const itensDia = agenda.filter((slot) => slot.dia === dia);
      const estudosDia = itensDia.filter((slot) => !slot.isRevisaoAuto && !slot.isRevisao && !slot.isConsolidada);
      const idsEstudo = new Set(estudosDia.map((slot) => slot.disciplinaId));
      const totalDia = itensDia.reduce(
        (total, slot) => total + Number(slot.tempoMinutos || slot.minutosEstudo || 0),
        0
      );

      assert.equal(estudosDia.length, 2);
      assert.ok(idsEstudo.size <= 2);
      assert.equal(totalDia, 180);
    });
  });
});
