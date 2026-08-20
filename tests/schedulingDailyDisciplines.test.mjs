import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { gerarSchedule } from '../src/services/scheduling/index.js';
import { getAgendaDia, getAgendaSemana } from '../src/services/scheduling/review.js';

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

  it('keeps every review moved from a day without classes even when the study day has a discipline limit', () => {
    const disciplinas = [
      { id: 'mat', nome: 'Matematica', assuntos: ['Topico de matematica'] },
      { id: 'dir', nome: 'Direito', assuntos: ['Topico de direito'] },
      { id: 'lit', nome: 'Literatura', assuntos: ['Topico de literatura'] },
      { id: 'ing', nome: 'Ingles', assuntos: ['Topico de ingles'] },
    ];
    const semanaTemplate = [
      ...disciplinas.map((disciplina, index) => ({
        slotId: `sabado-${disciplina.id}`,
        disciplinaId: disciplina.id,
        disciplinaNome: disciplina.nome,
        dia: 6,
        hora: 8 + index,
        minutosEstudo: 45,
        minutosBrutoDia: 240,
        minutosRevisaoReservados: 60,
        slotIndexParaDisc: 0,
        totalSlotsParaDisc: 1,
      })),
      ...disciplinas.slice(0, 2).map((disciplina, index) => ({
        slotId: `segunda-${disciplina.id}`,
        disciplinaId: disciplina.id,
        disciplinaNome: disciplina.nome,
        dia: 1,
        hora: 8 + index,
        minutosEstudo: 45,
        minutosBrutoDia: 120,
        minutosRevisaoReservados: 30,
        slotIndexParaDisc: 0,
        totalSlotsParaDisc: 1,
      })),
    ];
    const historicoSabado = disciplinas.map((disciplina, index) => ({
      disciplinaId: disciplina.id,
      disciplinaNome: disciplina.nome,
      assunto: disciplina.assuntos[0],
      dataEstudo: new Date(2026, 7, 15, 12, 0, 0),
      hora: 8 + index,
      nivel: 'intermediario',
      pesoEfetivo: 1,
    }));
    const horarios = { 1: 2, 6: 4 };

    const agenda = getAgendaSemana({
      semanaTemplate,
      disciplinasSnapshot: disciplinas,
      progresso: {},
      historicoRevisoes: {},
      dataInicio: '2026-08-15',
      limitarMaterias: true,
      limitesPorDia: { 1: 2, 6: 4 },
      tempoRevisaoMinutos: 30,
    }, 0, historicoSabado, null, horarios);

    const revisoesSegunda = agenda.filter((slot) => (
      slot.isRevisaoAuto && slot.dataSlot === '2026-08-17'
    ));

    assert.equal(revisoesSegunda.length, 4);
    assert.deepEqual(
      revisoesSegunda.map((slot) => slot.disciplinaId).sort(),
      ['dir', 'ing', 'lit', 'mat'],
    );
    assert.deepEqual(
      revisoesSegunda.map((slot) => slot.assunto).sort(),
      disciplinas.map((disciplina) => disciplina.assuntos[0]).sort(),
    );
    assert.equal(
      revisoesSegunda.reduce((total, slot) => total + Number(slot.tempoMinutos || 0), 0),
      20,
    );
  });

  it('creates a due review for every studied block even after topic rollover', () => {
    const disciplinas = Array.from({ length: 7 }, (_, index) => ({
      id: `disc-${index + 1}`,
      nome: `Disciplina ${index + 1}`,
      assuntos: [`Assunto ${index + 1}`],
    }));
    const semanaTemplate = [
      ...disciplinas.map((disciplina, index) => ({
        slotId: `sabado-${disciplina.id}`,
        disciplinaId: disciplina.id,
        disciplinaNome: disciplina.nome,
        dia: 6,
        hora: 8 + index,
        minutosEstudo: 50,
        minutosBrutoDia: 420,
        minutosRevisaoReservados: 105,
        slotIndexParaDisc: index < 4 ? 0 : 1,
        totalSlotsParaDisc: 1,
      })),
      {
        slotId: 'segunda-base',
        disciplinaId: disciplinas[0].id,
        disciplinaNome: disciplinas[0].nome,
        dia: 1,
        hora: 8,
        minutosEstudo: 50,
        minutosBrutoDia: 420,
        minutosRevisaoReservados: 105,
        slotIndexParaDisc: 0,
        totalSlotsParaDisc: 1,
      },
    ];

    const agenda = getAgendaSemana({
      semanaTemplate,
      disciplinasSnapshot: disciplinas,
      progresso: {},
      historicoRevisoes: {},
      dataInicio: '2026-08-15',
      tempoRevisaoMinutos: 30,
    }, 0, null, null, { 1: 7, 6: 7 });
    const revisoesSegunda = agenda.filter((slot) => (
      slot.isRevisaoAuto && slot.dataSlot === '2026-08-17'
    ));

    assert.equal(revisoesSegunda.length, 7);
    assert.deepEqual(
      revisoesSegunda.map((slot) => slot.disciplinaId).sort(),
      disciplinas.map((disciplina) => disciplina.id).sort(),
    );
    assert.equal(
      revisoesSegunda.reduce((total, slot) => total + Number(slot.tempoMinutos || 0), 0),
      35,
    );
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

  it('uses 5-minute review blocks and can grow above the configured base limit', () => {
    const estudos = Array.from({ length: 6 }, (_, index) => ({
      slotId: `estudo-${index}`,
      disciplinaId: `disc-${index}`,
      minutosEstudo: index < 3 ? 40 : 35,
      minutosBrutoDia: 300,
    }));
    const revisoes = Array.from({ length: 5 }, (_, index) => ({
      slotId: `revisao-${index}`,
      disciplinaId: `disc-${index}`,
      isRevisaoAuto: true,
    }));

    const agenda = getAgendaDia(1, estudos, revisoes, 0, 20, 75, {
      expandirTeoriaAteBruto: true,
      duracaoUnicaMinutos: 50,
    });
    const minutosRevisao = agenda
      .filter((slot) => slot.isRevisaoAuto)
      .reduce((total, slot) => total + Number(slot.tempoMinutos || 0), 0);
    const estudosFinais = agenda.filter((slot) => !slot.isRevisaoAuto);
    const totalDia = agenda.reduce(
      (total, slot) => total + Number(slot.tempoMinutos || slot.minutosEstudo || 0),
      0,
    );

    assert.equal(minutosRevisao, 25);
    assert.equal(totalDia, 300);
    assert.equal(estudosFinais.some((slot) => slot.tempoMinutos > 50), false);
  });

  it('caps direct review allocation by the number of useful 5-minute blocks', () => {
    const estudos = [{
      slotId: 'estudo-base',
      disciplinaId: 'base',
      minutosEstudo: 9,
      minutosBrutoDia: 12,
    }];
    const revisoes = Array.from({ length: 10 }, (_, index) => ({
      slotId: `revisao-curta-${index}`,
      disciplinaId: `disc-${index}`,
      isRevisaoAuto: true,
    }));

    const agenda = getAgendaDia(1, estudos, revisoes, 0, 3, 3);
    const revisoesFinais = agenda.filter((slot) => slot.isRevisaoAuto);

    assert.equal(revisoesFinais.length, 1);
    assert.equal(
      revisoesFinais.reduce((total, slot) => total + Number(slot.tempoMinutos || 0), 0),
      5,
    );
  });

  it('carries review overflow to the next available day before new reviews', () => {
    const revisoesSabado = Array.from({ length: 15 }, (_, index) => ({
      id: `sabado-${index}`,
      nome: `Disciplina Sabado ${index}`,
      assuntos: [`Assunto Sabado ${index}`],
    }));
    const revisoesSegunda = Array.from({ length: 6 }, (_, index) => ({
      id: `segunda-${index}`,
      nome: `Disciplina Segunda ${index}`,
      assuntos: [`Assunto Segunda ${index}`],
    }));
    const semanaTemplate = [
      ...revisoesSabado.map((disciplina, index) => ({
        slotId: `sabado-${disciplina.id}`,
        disciplinaId: disciplina.id,
        disciplinaNome: disciplina.nome,
        dia: 6,
        hora: 8 + index,
        minutosEstudo: 30,
        minutosBrutoDia: 420,
        minutosRevisaoReservados: 105,
        slotIndexParaDisc: 0,
        totalSlotsParaDisc: 1,
      })),
      ...revisoesSegunda.map((disciplina, index) => ({
        slotId: `segunda-${disciplina.id}`,
        disciplinaId: disciplina.id,
        disciplinaNome: disciplina.nome,
        dia: 1,
        hora: 8 + index,
        minutosEstudo: 30,
        minutosBrutoDia: 420,
        minutosRevisaoReservados: 105,
        slotIndexParaDisc: 0,
        totalSlotsParaDisc: 1,
      })),
      {
        slotId: 'terca-base',
        disciplinaId: revisoesSegunda[0].id,
        disciplinaNome: revisoesSegunda[0].nome,
        dia: 2,
        hora: 8,
        minutosEstudo: 30,
        minutosBrutoDia: 420,
        minutosRevisaoReservados: 105,
        slotIndexParaDisc: 1,
        totalSlotsParaDisc: 1,
      },
    ];
    const disciplinas = [...revisoesSabado, ...revisoesSegunda];
    const agenda = getAgendaSemana({
      semanaTemplate,
      disciplinasSnapshot: disciplinas,
      progresso: {},
      historicoRevisoes: {},
      dataInicio: '2026-08-15',
      tempoRevisaoMinutos: 30,
    }, 0, null, null, { 1: 7, 2: 7, 6: 7 });
    const revisoesNaSegunda = agenda.filter((slot) => slot.isRevisaoAuto && slot.dataSlot === '2026-08-17');
    const revisoesNaTerca = agenda.filter((slot) => slot.isRevisaoAuto && slot.dataSlot === '2026-08-18');

    assert.equal(revisoesNaSegunda.length, 12);
    assert.equal(
      revisoesNaSegunda.reduce((total, slot) => total + Number(slot.tempoMinutos || 0), 0),
      60,
    );
    assert.equal(revisoesNaTerca.length, 9);
    assert.equal(
      revisoesNaTerca.reduce((total, slot) => total + Number(slot.tempoMinutos || 0), 0),
      45,
    );
    assert.deepEqual(
      revisoesNaTerca.slice(0, 3).map((slot) => slot.disciplinaId),
      ['sabado-12', 'sabado-13', 'sabado-14'],
    );
  });

  it('keeps review overflow across the week boundary', () => {
    const disciplinas = Array.from({ length: 15 }, (_, index) => ({
      id: `sexta-${index}`,
      nome: `Disciplina ${index}`,
      assuntos: [`Assunto ${index}`],
    }));
    const semanaTemplate = [
      ...disciplinas.map((disciplina, index) => ({
        slotId: `sexta-slot-${index}`,
        disciplinaId: disciplina.id,
        disciplinaNome: disciplina.nome,
        dia: 5,
        hora: 8 + index,
        minutosEstudo: 25,
        minutosBrutoDia: 420,
        minutosRevisaoReservados: 105,
        slotIndexParaDisc: 0,
        totalSlotsParaDisc: 1,
      })),
      {
        slotId: 'sabado-base',
        disciplinaId: disciplinas[0].id,
        disciplinaNome: disciplinas[0].nome,
        dia: 6,
        hora: 8,
        minutosEstudo: 30,
        minutosBrutoDia: 420,
        minutosRevisaoReservados: 105,
        slotIndexParaDisc: 1,
        totalSlotsParaDisc: 1,
      },
      {
        slotId: 'segunda-base',
        disciplinaId: disciplinas[1].id,
        disciplinaNome: disciplinas[1].nome,
        dia: 1,
        hora: 8,
        minutosEstudo: 30,
        minutosBrutoDia: 420,
        minutosRevisaoReservados: 105,
        slotIndexParaDisc: 1,
        totalSlotsParaDisc: 1,
      },
    ];
    const cronograma = {
      semanaTemplate,
      disciplinasSnapshot: disciplinas,
      progresso: {},
      historicoRevisoes: {},
      dataInicio: '2026-08-10',
      tempoRevisaoMinutos: 30,
    };
    const horarios = { 1: 7, 5: 7, 6: 1 };

    const semanaZero = getAgendaSemana(cronograma, 0, null, null, horarios);
    const semanaUm = getAgendaSemana(cronograma, 1, null, null, horarios);
    const revisoesSabado = semanaZero.filter((slot) => slot.isRevisaoAuto && slot.dataSlot === '2026-08-15');
    const revisoesSegunda = semanaUm.filter((slot) => slot.isRevisaoAuto && slot.dataSlot === '2026-08-17');

    assert.equal(revisoesSabado.length, 6);
    assert.equal(revisoesSabado.reduce((total, slot) => total + Number(slot.tempoMinutos || 0), 0), 30);
    assert.deepEqual(
      revisoesSegunda.slice(0, 9).map((slot) => slot.disciplinaId),
      disciplinas.slice(6).map((disciplina) => disciplina.id),
    );
  });

  it('keeps automatic blocks inside the configured range while filling the day', () => {
    const disciplinas = [
      { id: 'pt', nome: 'Portugues', nivel: 'intermediario', assuntos: ['A', 'B', 'C'] },
      { id: 'mat', nome: 'Matematica', nivel: 'intermediario', assuntos: ['A', 'B', 'C'] },
    ];
    const horarios = { 1: 2 };
    const opcoes = {
      dataInicio: '2026-08-03',
      usarDuracaoUnica: false,
      duracaoMinimaSessaoMinutos: 30,
      duracaoMaximaSessaoMinutos: 60,
    };
    const resultado = gerarSchedule(disciplinas, horarios, opcoes);
    const agenda = getAgendaSemana({
      ...resultado,
      ...opcoes,
      disciplinasSnapshot: disciplinas,
      progresso: {},
      historicoRevisoes: {},
    }, 0, null, null, horarios);
    const estudos = agenda.filter((slot) => !slot.isRevisaoAuto);

    assert.equal(estudos.reduce((total, slot) => total + Number(slot.tempoMinutos || 0), 0), 120);
    estudos.forEach((slot) => {
      assert.ok(slot.tempoMinutos >= 30);
      assert.ok(slot.tempoMinutos <= 60);
    });
  });

  it('balances automatic blocks from 40 to 80 minutes without flattening every duration', () => {
    const assuntos = ['A', 'B', 'C', 'D', 'E'];
    const disciplinas = [
      { id: 'prioritaria', nome: 'Prioritaria', conhecimentoNivel: 1, importanciaNivel: 5, assuntos },
      { id: 'media', nome: 'Media', conhecimentoNivel: 3, importanciaNivel: 3, assuntos },
      { id: 'dominada', nome: 'Dominada', conhecimentoNivel: 5, importanciaNivel: 1, assuntos },
    ];
    const horarios = { 1: 5 };
    const opcoes = {
      dataInicio: '2026-08-03',
      usarDuracaoUnica: false,
      duracaoMinimaSessaoMinutos: 40,
      duracaoMaximaSessaoMinutos: 80,
    };
    const resultado = gerarSchedule(disciplinas, horarios, opcoes);
    const estudos = getAgendaSemana({
      ...resultado,
      ...opcoes,
      disciplinasSnapshot: disciplinas,
      progresso: {},
      historicoRevisoes: {},
    }, 0, null, null, horarios).filter((slot) => !slot.isRevisaoAuto && !slot.isConsolidada);
    const duracoes = estudos.map((slot) => Number(slot.tempoMinutos || slot.minutosEstudo || 0));

    assert.equal(duracoes.reduce((total, minutos) => total + minutos, 0), 300);
    assert.ok(new Set(duracoes).size > 1);
    duracoes.forEach((minutos) => {
      assert.ok(minutos >= 40 && minutos <= 80);
      assert.equal(minutos % 5, 0);
    });
  });

  it('fills every 5-hour day even when some disciplines have fewer topics than slots', () => {
    const disciplinas = [
      { id: 'pt', nome: 'Portugues', conhecimentoNivel: 3, importanciaNivel: 4, assuntos: ['P1', 'P2'] },
      { id: 'dir', nome: 'Direito', conhecimentoNivel: 2, importanciaNivel: 5, assuntos: ['D1'] },
      { id: 'lit', nome: 'Literatura', conhecimentoNivel: 4, importanciaNivel: 2, assuntos: ['L1', 'L2'] },
      { id: 'mat', nome: 'Matematica', conhecimentoNivel: 3, importanciaNivel: 3, assuntos: ['M1'] },
    ];
    const horarios = { 1: 5, 2: 5, 3: 5, 4: 5, 5: 5 };
    const opcoes = {
      dataInicio: '2026-08-17',
      usarDuracaoUnica: false,
      duracaoMinimaSessaoMinutos: 40,
      duracaoMaximaSessaoMinutos: 80,
      tempoRevisaoMinutos: 20,
    };
    const resultado = gerarSchedule(disciplinas, horarios, opcoes);

    assert.ok(resultado?.semanaTemplate?.length > 0);
    [1, 2, 3, 4, 5].forEach((dia) => {
      assert.ok(resultado.semanaTemplate.filter((slot) => slot.dia === dia).length >= 5);
    });

    [0, 1].forEach((weekOffset) => {
      const agenda = getAgendaSemana({
        ...resultado,
        ...opcoes,
        disciplinasSnapshot: disciplinas,
        progresso: {},
        historicoRevisoes: {},
      }, weekOffset, null, null, horarios);

      [1, 2, 3, 4, 5].forEach((dia) => {
        const itensDia = agenda.filter((slot) => slot.dia === dia);
        const totalDia = itensDia.reduce(
          (total, slot) => total + Number(slot.tempoMinutos || slot.minutosEstudo || 0),
          0,
        );
        assert.equal(totalDia, 300);
        assert.ok(itensDia.some((slot) => !slot.isRevisaoAuto));
      });
    });
  });

  it('keeps a short residual block instead of losing time', () => {
    const estudos = [{
      slotId: 'estudo-curto',
      slotIdBase: 'estudo-curto',
      disciplinaId: 'pt',
      disciplinaNome: 'Portugues',
      minutosEstudo: 65,
      minutosBrutoDia: 90,
      pesoEfetivo: 3,
    }];

    const agenda = getAgendaDia(1, estudos, [], 0, 20, 0, {
      expandirTeoriaAteBruto: true,
      duracaoUnicaMinutos: 80,
      usarDuracaoUnica: false,
    });
    const duracoes = agenda.map((slot) => Number(slot.tempoMinutos || slot.minutosEstudo || 0));

    assert.equal(duracoes.reduce((total, minutos) => total + minutos, 0), 90);
    assert.deepEqual(duracoes, [80, 10]);
    assert.equal(agenda[1].isBlocoResidual, true);
  });

  it('keeps the exact minute budget when durations are not multiples of five', () => {
    const agenda = getAgendaDia(1, [
      { slotId: 'a', disciplinaId: 'a', minutosEstudo: 43, minutosBrutoDia: 87, pesoEfetivo: 4 },
      { slotId: 'b', disciplinaId: 'b', minutosEstudo: 43, minutosBrutoDia: 87, pesoEfetivo: 2 },
    ], [], 0, 20, 0, {
      expandirTeoriaAteBruto: true,
      duracaoUnicaMinutos: 80,
      usarDuracaoUnica: false,
    });

    assert.equal(
      agenda.reduce((total, slot) => total + Number(slot.tempoMinutos || slot.minutosEstudo || 0), 0),
      87,
    );
  });
});
