import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { gerarSchedule } from '../src/services/scheduling/index.js';

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
});
