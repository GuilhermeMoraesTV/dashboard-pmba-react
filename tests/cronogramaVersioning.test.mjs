import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  resolveTemplateForWeek,
  getAgendaSemana,
  chaveAssuntoDominado,
} from '../src/services/scheduling/review.js';
import {
  _normalizarInitialStateEdicao,
  _gerarCronogramaDeGradePersonalizada,
} from '../src/hooks/useCronogramaWizard.js';
import {
  areFunctionalFieldsEqual,
} from '../src/hooks/useCronogramaSystem.js';

describe('Cronograma Versioning and Schedule Resolution', () => {
  it('resolves root template for legacy cronogramas without version fields', () => {
    const legacyCronograma = {
      dataInicio: '2026-09-07',
      semanaTemplate: [
        { slotId: 'slot-1', disciplinaId: 'dir-const', disciplinaNome: 'Direito Constitucional', dia: 1, minutosEstudo: 60 },
        { slotId: 'slot-2', disciplinaId: 'port', disciplinaNome: 'Português', dia: 2, minutosEstudo: 60 },
      ],
    };

    const resolved0 = resolveTemplateForWeek(legacyCronograma, 0);
    assert.equal(resolved0.semanaTemplate.length, 2);
    assert.equal(resolved0.isArchived, false);
    assert.equal(resolved0.semanaTemplateVigenteDesde, 0);

    const resolved5 = resolveTemplateForWeek(legacyCronograma, 5);
    assert.equal(resolved5.semanaTemplate.length, 2);
    assert.equal(resolved5.isArchived, false);
    assert.equal(resolved5.semanaTemplateVigenteDesde, 0);
  });

  it('resolves historical archived version when weekOffset < semanaTemplateVigenteDesde', () => {
    const v0Template = [
      { slotId: 'v0-1', disciplinaId: 'dir-const', disciplinaNome: 'Direito Constitucional', dia: 1, minutosEstudo: 60 },
      { slotId: 'v0-2', disciplinaId: 'port', disciplinaNome: 'Português', dia: 2, minutosEstudo: 60 },
    ];
    const v1Template = [
      { slotId: 'v1-1', disciplinaId: 'dir-const', disciplinaNome: 'Direito Constitucional', dia: 1, minutosEstudo: 90 },
      { slotId: 'v1-2', disciplinaId: 'port', disciplinaNome: 'Português', dia: 3, minutosEstudo: 90 },
      { slotId: 'v1-3', disciplinaId: 'dir-penal', disciplinaNome: 'Direito Penal', dia: 5, minutosEstudo: 60 },
    ];

    const versionedCronograma = {
      dataInicio: '2026-09-07',
      semanaTemplateVigenteDesde: 3,
      semanaTemplate: v1Template,
      historicoSemanasTemplate: {
        v0: {
          deSemana: 0,
          ateSemana: 2,
          semanaTemplate: v0Template,
          criadoEm: '2026-09-07T10:00:00.000Z',
        },
      },
    };

    // Week 1 falls in [0, 2] -> should resolve v0Template with isArchived = true
    const resolvedW1 = resolveTemplateForWeek(versionedCronograma, 1);
    assert.equal(resolvedW1.isArchived, true);
    assert.equal(resolvedW1.semanaTemplate.length, 2);
    assert.equal(resolvedW1.semanaTemplate[0].slotId, 'v0-1');
    assert.equal(resolvedW1.semanaTemplate[1].dia, 2);

    // Week 3 is active from week 3 -> should resolve v1Template with isArchived = false
    const resolvedW3 = resolveTemplateForWeek(versionedCronograma, 3);
    assert.equal(resolvedW3.isArchived, false);
    assert.equal(resolvedW3.semanaTemplate.length, 3);
    assert.equal(resolvedW3.semanaTemplate[0].slotId, 'v1-1');
    assert.equal(resolvedW3.semanaTemplate[1].dia, 3);

    // Week 6 is in the future -> should resolve v1Template with isArchived = false
    const resolvedW6 = resolveTemplateForWeek(versionedCronograma, 6);
    assert.equal(resolvedW6.isArchived, false);
    assert.equal(resolvedW6.semanaTemplate.length, 3);
  });
});

describe('Hydration and Custom Schedule Assembly', () => {
  it('hydrates gradePersonalizada from active semanaTemplate, excluding reviews', () => {
    const cronograma = {
      id: 'crono-123',
      dataInicio: '2026-09-07',
      tempoSessaoMinutos: 60,
      semanaTemplate: [
        { slotId: 'slot-seg-1', disciplinaId: 'd1', disciplinaNome: 'Português', dia: 1, minutosEstudo: 60, cor: '#3b82f6' },
        { slotId: 'slot-seg-2', disciplinaId: 'd2', disciplinaNome: 'Matemática', dia: 1, minutosEstudo: 90, cor: '#10b981' },
        { slotId: 'slot-ter-rev', isRevisao: true, disciplinaId: 'd1', disciplinaNome: 'Revisão Português', dia: 2, minutosEstudo: 30 },
        { slotId: 'slot-qua-auto', isRevisaoAuto: true, dia: 3, minutosEstudo: 45 },
        { slotId: 'slot-sex-1', disciplinaId: 'd3', disciplinaNome: 'Direito', dia: 5, minutosEstudo: 120, cor: '#ef4444' },
      ],
      disciplinasSnapshot: [
        { id: 'd1', nome: 'Português', cor: '#3b82f6', assuntos: ['A1', 'A2'] },
        { id: 'd2', nome: 'Matemática', cor: '#10b981', assuntos: ['M1'] },
        { id: 'd3', nome: 'Direito', cor: '#ef4444', assuntos: ['D1'] },
      ],
    };

    const hydrated = _normalizarInitialStateEdicao(cronograma);

    assert.equal(hydrated.config.modoMontagem, 'personalizado');
    const grade = hydrated.config.gradePersonalizada;

    // Day 1 (Segunda) should have 2 slots
    assert.equal(grade[1]?.length, 2);
    assert.equal(grade[1][0].id, 'slot-seg-1');
    assert.equal(grade[1][0].disciplinaNome, 'Português');
    assert.equal(grade[1][0].minutos, 60);
    assert.equal(grade[1][1].id, 'slot-seg-2');
    assert.equal(grade[1][1].minutos, 90);

    // Days 2 and 3 should have NO slots because reviews were excluded
    assert.equal(grade[2]?.length || 0, 0);
    assert.equal(grade[3]?.length || 0, 0);

    // Day 5 (Sexta) should have 1 slot
    assert.equal(grade[5]?.length, 1);
    assert.equal(grade[5][0].id, 'slot-sex-1');
    assert.equal(grade[5][0].minutos, 120);

    // Colors should be populated
    assert.equal(hydrated.config.disciplinaCoresPersonalizadas['d1'], '#3b82f6');
    assert.equal(hydrated.config.disciplinaCoresPersonalizadas['d2'], '#10b981');
    assert.equal(hydrated.config.disciplinaCoresPersonalizadas['d3'], '#ef4444');
  });

  it('generates new semanaTemplate preserving stable slotIdBase for moved slots', () => {
    const gradePersonalizada = {
      // Slot 1 moved to Wednesday (dia 3)
      3: [
        { id: 'slot-seg-1', disciplinaId: 'd1', disciplinaNome: 'Português', minutos: 60, cor: '#3b82f6' },
      ],
      // New slot added on Friday (dia 5)
      5: [
        { id: 'custom-123456', disciplinaId: 'd2', disciplinaNome: 'Matemática', minutos: 75, cor: '#10b981' },
      ],
    };

    const edital = {
      disciplinas: [
        { id: 'd1', nome: 'Português', assuntos: ['A1', 'A2', 'A3'] },
        { id: 'd2', nome: 'Matemática', assuntos: ['M1', 'M2'] },
      ],
    };

    const config = {
      modoMontagem: 'personalizado',
      tempoSessaoMinutos: 60,
      tempoRevisaoMinutos: 30,
      gradePersonalizada,
      disciplinaCoresPersonalizadas: { d1: '#3b82f6', d2: '#10b981' },
    };

    const resultado = _gerarCronogramaDeGradePersonalizada({
      gradePersonalizada,
      edital,
      extraDisciplinas: [],
      config,
      horarios: { 3: 1, 5: 1.25 },
      duracaoSemanas: 12,
    });

    assert.equal(resultado.semanaTemplate.length, 2);
    const movedSlot = resultado.semanaTemplate.find((s) => s.disciplinaId === 'd1');
    assert.ok(movedSlot);
    assert.equal(movedSlot.slotId, 'slot-seg-1');
    assert.equal(movedSlot.slotIdBase, 'slot-seg-1');
    assert.equal(movedSlot.dia, 3);
    assert.equal(movedSlot.layoutManual, true);

    const newSlot = resultado.semanaTemplate.find((s) => s.disciplinaId === 'd2');
    assert.ok(newSlot);
    assert.equal(newSlot.slotId, 'custom-123456');
    assert.equal(newSlot.slotIdBase, 'custom-123456');
    assert.equal(newSlot.dia, 5);
    assert.equal(newSlot.layoutManual, true);
  });
});

describe('Cross-Version Spaced Reviews and Progress Continuity', () => {
  it('calculates 7d and 30d spaced reviews across template version boundaries', () => {
    const v0Template = [
      { slotId: 'slot-seg', slotIdBase: 'slot-seg', disciplinaId: 'd1', disciplinaNome: 'Português', dia: 1, hora: '08:00', ordemNoDia: 0, minutosEstudo: 60, minutosBrutoDia: 60, minutosRevisaoReservados: 0, slotIndexParaDisc: 0, totalSlotsParaDisc: 1 },
      { slotId: 'slot-ter', slotIdBase: 'slot-ter', disciplinaId: 'd2', disciplinaNome: 'Matemática', dia: 2, hora: '08:00', ordemNoDia: 0, minutosEstudo: 60, minutosBrutoDia: 60, minutosRevisaoReservados: 0, slotIndexParaDisc: 0, totalSlotsParaDisc: 1 },
      { slotId: 'slot-qui', slotIdBase: 'slot-qui', disciplinaId: 'd3', disciplinaNome: 'Direito', dia: 4, hora: '08:00', ordemNoDia: 0, minutosEstudo: 60, minutosBrutoDia: 60, minutosRevisaoReservados: 0, slotIndexParaDisc: 0, totalSlotsParaDisc: 1 },
    ];

    const v1Template = [
      { slotId: 'slot-seg', slotIdBase: 'slot-seg', disciplinaId: 'd1', disciplinaNome: 'Português', dia: 1, hora: '08:00', ordemNoDia: 0, minutosEstudo: 60, minutosBrutoDia: 60, minutosRevisaoReservados: 0, slotIndexParaDisc: 0, totalSlotsParaDisc: 1 },
      { slotId: 'slot-qua', slotIdBase: 'slot-qua', disciplinaId: 'd2', disciplinaNome: 'Matemática', dia: 3, hora: '08:00', ordemNoDia: 0, minutosEstudo: 60, minutosBrutoDia: 60, minutosRevisaoReservados: 0, slotIndexParaDisc: 0, totalSlotsParaDisc: 1 },
      { slotId: 'slot-sex', slotIdBase: 'slot-sex', disciplinaId: 'd3', disciplinaNome: 'Direito', dia: 5, hora: '08:00', ordemNoDia: 0, minutosEstudo: 60, minutosBrutoDia: 60, minutosRevisaoReservados: 0, slotIndexParaDisc: 0, totalSlotsParaDisc: 1 },
    ];

    const cronograma = {
      id: 'crono-versioned',
      dataInicio: '2026-09-07', // Monday
      tempoRevisaoMinutos: 30,
      semanaTemplateVigenteDesde: 3,
      semanaTemplate: v1Template,
      historicoSemanasTemplate: {
        v0: {
          deSemana: 0,
          ateSemana: 2,
          semanaTemplate: v0Template,
        },
      },
      disciplinasSnapshot: [
        { id: 'd1', nome: 'Português', assuntos: ['Crase', 'Pontuação', 'Regência', 'Concordância'] },
        { id: 'd2', nome: 'Matemática', assuntos: ['Porcentagem', 'Álgebra'] },
        { id: 'd3', nome: 'Direito', assuntos: ['CF Art 5', 'Poder Executivo'] },
      ],
      progresso: {
        // In week 0, slot-seg (Português - Crase on 2026-09-07) was completed
        w0: { 'slot-seg': true },
      },
      progressoMinutos: {
        w0: { 'slot-seg': 60 },
      },
    };

    // Week 1 (still under v0): 7-day review for Crase should appear on 2026-09-14 (dia 1)
    const agendaW1 = getAgendaSemana(cronograma, 1);
    const rev7d = agendaW1.find((s) => s.isRevisaoAuto && s.intervaloDias === 7 && s.assunto === 'Crase');
    assert.ok(rev7d, '7d review should appear in Week 1');
    assert.equal(rev7d.dataSlot, '2026-09-14');

    // Week 4 (under v1, since v1 starts at week 3): 30-day review for Crase (2026-09-07 + 30d = 2026-10-07 Wednesday)
    // Under v1, study days are 1 (Seg), 3 (Qua), 5 (Sex). 2026-10-07 is Wednesday (dia 3), an active study day!
    const agendaW4 = getAgendaSemana(cronograma, 4);
    const rev30d = agendaW4.find((s) => s.isRevisaoAuto && s.intervaloDias === 30 && s.assunto === 'Crase');
    assert.ok(rev30d, '30d review should appear across version boundary in Week 4');
    assert.equal(rev30d.dia, 3);
  });

  it('suppresses dynamic review across version boundary when topic is marked as dominado', () => {
    const v0Template = [
      { slotId: 'slot-seg', slotIdBase: 'slot-seg', disciplinaId: 'd1', disciplinaNome: 'Português', dia: 1, hora: '08:00', ordemNoDia: 0, minutosEstudo: 60, minutosBrutoDia: 60, minutosRevisaoReservados: 0, slotIndexParaDisc: 0, totalSlotsParaDisc: 1 },
      { slotId: 'slot-qui', slotIdBase: 'slot-qui', disciplinaId: 'd3', disciplinaNome: 'Direito', dia: 4, hora: '08:00', ordemNoDia: 0, minutosEstudo: 60, minutosBrutoDia: 60, minutosRevisaoReservados: 0, slotIndexParaDisc: 0, totalSlotsParaDisc: 1 },
    ];
    const v1Template = [
      { slotId: 'slot-seg', slotIdBase: 'slot-seg', disciplinaId: 'd1', disciplinaNome: 'Português', dia: 1, hora: '08:00', ordemNoDia: 0, minutosEstudo: 60, minutosBrutoDia: 60, minutosRevisaoReservados: 0, slotIndexParaDisc: 0, totalSlotsParaDisc: 1 },
      { slotId: 'slot-sex', slotIdBase: 'slot-sex', disciplinaId: 'd3', disciplinaNome: 'Direito', dia: 5, hora: '08:00', ordemNoDia: 0, minutosEstudo: 60, minutosBrutoDia: 60, minutosRevisaoReservados: 0, slotIndexParaDisc: 0, totalSlotsParaDisc: 1 },
    ];

    const dominadoKey = chaveAssuntoDominado('d1', 'Crase');
    const cronograma = {
      id: 'crono-versioned-dom',
      dataInicio: '2026-09-07',
      tempoRevisaoMinutos: 30,
      semanaTemplateVigenteDesde: 3,
      semanaTemplate: v1Template,
      historicoSemanasTemplate: {
        v0: { deSemana: 0, ateSemana: 2, semanaTemplate: v0Template },
      },
      disciplinasSnapshot: [
        { id: 'd1', nome: 'Português', assuntos: ['Crase', 'Pontuação'] },
        { id: 'd3', nome: 'Direito', assuntos: ['CF Art 5'] },
      ],
      progresso: {
        w0: { 'slot-seg': true },
        dominios: { [dominadoKey]: true },
      },
      progressoMinutos: {
        w0: { 'slot-seg': 60 },
      },
    };

    const dominadosSet = new Set([dominadoKey]);
    const agendaW1 = getAgendaSemana(cronograma, 1, null, dominadosSet);
    const rev7d = agendaW1.find((s) => s.isRevisaoAuto && s.assunto === 'Crase');
    assert.equal(rev7d, undefined, '7d review for dominado topic should not be generated');

    const agendaW4 = getAgendaSemana(cronograma, 4, null, dominadosSet);
    const rev30d = agendaW4.find((s) => s.isRevisaoAuto && s.assunto === 'Crase');
    assert.equal(rev30d, undefined, '30d review for dominado topic should not be generated');
  });
});

describe('Transaction Idempotency and Equality Checks', () => {
  it('detects functional equality between identical schedule configurations (0 writes)', () => {
    const existing = {
      nome: 'Cronograma PMBA 2026',
      dataInicio: '2026-09-07',
      dataFim: '2026-12-31',
      tempoRevisaoMinutos: 30,
      modoMontagem: 'personalizado',
      semanaTemplate: [
        { slotId: 's1', disciplinaId: 'd1', disciplinaNome: 'Português', dia: 1, minutosEstudo: 60 },
        { slotId: 's2', disciplinaId: 'd2', disciplinaNome: 'Matemática', dia: 3, minutosEstudo: 60 },
      ],
      disciplinasSnapshot: [
        { id: 'd1', nome: 'Português', assuntos: ['A1', 'A2'] },
        { id: 'd2', nome: 'Matemática', assuntos: ['M1'] },
      ],
    };

    const updateCandidateIdentical = {
      nome: 'Cronograma PMBA 2026',
      dataInicio: '2026-09-07',
      dataFim: '2026-12-31',
      tempoRevisaoMinutos: 30,
      modoMontagem: 'personalizado',
      semanaTemplate: [
        { slotId: 's1', disciplinaId: 'd1', disciplinaNome: 'Português', dia: 1, minutosEstudo: 60 },
        { slotId: 's2', disciplinaId: 'd2', disciplinaNome: 'Matemática', dia: 3, minutosEstudo: 60 },
      ],
      disciplinasSnapshot: [
        { id: 'd1', nome: 'Português', assuntos: ['A1', 'A2'] },
        { id: 'd2', nome: 'Matemática', assuntos: ['M1'] },
      ],
    };

    assert.equal(areFunctionalFieldsEqual(existing, updateCandidateIdentical), true);

    const updateCandidateChanged = {
      ...updateCandidateIdentical,
      semanaTemplate: [
        { slotId: 's1', disciplinaId: 'd1', disciplinaNome: 'Português', dia: 1, minutosEstudo: 90 }, // changed minutes
        { slotId: 's2', disciplinaId: 'd2', disciplinaNome: 'Matemática', dia: 3, minutosEstudo: 60 },
      ],
    };

    assert.equal(areFunctionalFieldsEqual(existing, updateCandidateChanged), false);
  });
});
