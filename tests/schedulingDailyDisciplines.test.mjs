import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { gerarSchedule } from '../src/services/scheduling/index.js';
import { getAgendaSemana } from '../src/services/scheduling/review.js';

describe('scheduling daily disciplines', () => {
  it('uses knowledge and importance and respects the configured session range', () => {
    const resultado = gerarSchedule(
      [
        { id: 'prioritaria', nome: 'Prioritaria', conhecimentoNivel: 1, importanciaNivel: 5, assuntos: ['A', 'B'] },
        { id: 'reforco', nome: 'Reforco', conhecimentoNivel: 5, importanciaNivel: 1, assuntos: ['A', 'B'] },
      ],
      { 1: 5 },
      {
        dataInicio: '2026-08-03',
        duracaoMinimaSessaoMinutos: 30,
        duracaoMaximaSessaoMinutos: 60,
      },
    );

    const minutosPorDisciplina = resultado.semanaTemplate.reduce((acc, slot) => {
      acc[slot.disciplinaId] = (acc[slot.disciplinaId] || 0) + Number(slot.minutosEstudo || 0);
      assert.ok(slot.minutosEstudo >= 30 && slot.minutosEstudo <= 60);
      return acc;
    }, {});
    assert.ok(minutosPorDisciplina.prioritaria > minutosPorDisciplina.reforco);
  });

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

      assert.equal(estudosDia.length, 3);
      assert.deepEqual([...idsEstudo].sort(), ['lei', 'pt']);
      estudosDia.forEach((slot) => assert.ok(slot.minutosEstudo <= 60));
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

      assert.ok(estudosDia.length >= 1);
      assert.ok(idsEstudo.size <= 2);
      assert.equal(totalDia, 180);
    });
  });

  it('uses the selected single duration as the standard block and keeps only a smaller remainder', () => {
    const disciplinas = [
      { id: 'pt', nome: 'Portugues', nivel: 'intermediario', assuntos: ['A', 'B', 'C'] },
      { id: 'mat', nome: 'Matematica', nivel: 'intermediario', assuntos: ['A', 'B', 'C'] },
    ];
    const horarios = { 1: 2 };
    const resultado = gerarSchedule(disciplinas, horarios, {
      dataInicio: '2026-08-03',
      usarDuracaoUnica: true,
      tempoSessaoMinutos: 50,
      duracaoMinimaSessaoMinutos: 50,
      duracaoMaximaSessaoMinutos: 50,
    });

    assert.equal(resultado.semanaTemplate.length, 3);
    resultado.semanaTemplate.forEach((slot) => assert.ok(slot.minutosEstudo <= 50));

    const agenda = getAgendaSemana({
      ...resultado,
      disciplinasSnapshot: disciplinas,
      progresso: {},
      historicoRevisoes: {},
      dataInicio: '2026-08-03',
      usarDuracaoUnica: true,
      tempoSessaoMinutos: 50,
      duracaoMinimaSessaoMinutos: 50,
      duracaoMaximaSessaoMinutos: 50,
    }, 0, null, null, horarios);

    const duracoes = agenda
      .filter((slot) => !slot.isRevisaoAuto && !slot.isRevisao && !slot.isConsolidada)
      .map((slot) => Number(slot.tempoMinutos || slot.minutosEstudo || 0));

    assert.deepEqual(duracoes, [50, 50, 20]);
    assert.equal(duracoes.reduce((total, minutos) => total + minutos, 0), 120);
    assert.equal(duracoes.some((minutos) => minutos > 50), false);
  });

  it('increases and decreases the weekly block count when the available time changes', () => {
    const disciplinas = [
      { id: 'pt', nome: 'Portugues', nivel: 'intermediario', assuntos: ['A', 'B', 'C', 'D', 'E', 'F'] },
      { id: 'mat', nome: 'Matematica', nivel: 'intermediario', assuntos: ['A', 'B', 'C', 'D', 'E', 'F'] },
    ];
    const opcoes = {
      dataInicio: '2026-08-03',
      usarDuracaoUnica: true,
      tempoSessaoMinutos: 50,
      duracaoMinimaSessaoMinutos: 50,
      duracaoMaximaSessaoMinutos: 50,
    };

    const agendaParaHoras = (horas) => {
      const horarios = { 1: horas };
      const resultado = gerarSchedule(disciplinas, horarios, opcoes);
      return getAgendaSemana({
        ...resultado,
        ...opcoes,
        disciplinasSnapshot: disciplinas,
        progresso: {},
        historicoRevisoes: {},
      }, 0, null, null, horarios)
        .filter((slot) => !slot.isRevisaoAuto && !slot.isRevisao && !slot.isConsolidada)
        .map((slot) => Number(slot.tempoMinutos || slot.minutosEstudo || 0));
    };

    assert.deepEqual(agendaParaHoras(1), [50, 10]);
    assert.deepEqual(agendaParaHoras(5), [50, 50, 50, 50, 50, 50]);
  });
});
