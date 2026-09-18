import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { getAgendaSemana } from '../src/services/scheduling/review.js';
import { applyCronogramaRegistroProgress } from '../src/services/reviewOptimisticUpdates.js';
import {
  advanceTheoryPendingAfterCompletion,
  buildTheoryContinuationPending,
  captureDisplacedTheoryTopic,
} from '../src/utils/cronogramaTheoryQueue.js';

const createCronograma = (pending, semanaTemplate = null) => ({
  dataInicio: '2026-09-07',
  disciplinasSnapshot: [{
    id: 'direito',
    nome: 'Direito Constitucional',
    assuntos: ['Assunto A', 'Assunto B', 'Assunto C', 'Assunto D'],
  }],
  semanaTemplate: semanaTemplate || [
    { slotId: 'seg', disciplinaId: 'direito', disciplinaNome: 'Direito Constitucional', dia: 1, hora: '08:00', ordemNoDia: 0, minutosEstudo: 50, minutosBrutoDia: 50, minutosRevisaoReservados: 0, slotIndexParaDisc: 0, totalSlotsParaDisc: 3 },
    { slotId: 'qua', disciplinaId: 'direito', disciplinaNome: 'Direito Constitucional', dia: 3, hora: '08:00', ordemNoDia: 0, minutosEstudo: 50, minutosBrutoDia: 50, minutosRevisaoReservados: 0, slotIndexParaDisc: 1, totalSlotsParaDisc: 3 },
    { slotId: 'sex', disciplinaId: 'direito', disciplinaNome: 'Direito Constitucional', dia: 5, hora: '08:00', ordemNoDia: 0, minutosEstudo: 50, minutosBrutoDia: 50, minutosRevisaoReservados: 0, slotIndexParaDisc: 2, totalSlotsParaDisc: 3 },
  ],
  progresso: {},
  progressoMinutos: {},
  historicoRevisoes: {},
  pendenciasTeoria: pending ? { direito: pending } : {},
});

const theorySlots = (cronograma, weekOffset = 0) => (
  getAgendaSemana(cronograma, weekOffset).filter((slot) => !slot.isRevisaoAuto && !slot.isBlocoResidual)
);

describe('cronograma theory continuation', () => {
  it('reserves the next chronological occurrence of the same discipline', () => {
    const cronograma = createCronograma({
      assunto: 'Assunto B',
      origemSlotIdBase: 'qua',
      origemDataSlot: '2026-09-09',
      origemOrdemNoDia: 0,
      ultimaMarcacaoEm: '2026-09-09T15:00:00.000Z',
      tipo: 'continuidade',
      filaAssuntos: [],
    });

    const slots = theorySlots(cronograma);
    assert.equal(slots.find((slot) => slot.slotIdBase === 'seg').isFilaTeoriaOverride, false);
    assert.equal(slots.find((slot) => slot.slotIdBase === 'qua').isFilaTeoriaOverride, false);
    assert.deepEqual(
      slots.filter((slot) => slot.isFilaTeoriaOverride).map((slot) => [slot.slotIdBase, slot.assunto]),
      [['sex', 'Assunto B']],
    );
  });

  it('uses chronological order even when the template array is unordered', () => {
    const ordered = createCronograma(null).semanaTemplate;
    const cronograma = createCronograma({
      assunto: 'Assunto A',
      origemSlotIdBase: 'seg',
      origemDataSlot: '2026-09-07',
      origemOrdemNoDia: 0,
      tipo: 'continuidade',
    }, [ordered[2], ordered[0], ordered[1]]);

    const continuation = theorySlots(cronograma).find((slot) => slot.isFilaTeoriaOverride);
    assert.equal(continuation.slotIdBase, 'qua');
  });

  it('keeps displaced subjects in FIFO order instead of losing them', () => {
    const initialPending = {
      assunto: 'Assunto A',
      filaAssuntos: [],
      tipo: 'continuidade',
      criadoEm: '2026-09-07T10:00:00.000Z',
    };
    const completedA = {
      slotIdBase: 'qua',
      dataSlot: '2026-09-09',
      assunto: 'Assunto A',
      assuntoOriginal: 'Assunto B',
    };
    const pendingB = advanceTheoryPendingAfterCompletion({ pending: initialPending, slot: completedA });
    assert.equal(pendingB.assunto, 'Assunto B');
    assert.equal(pendingB.tipo, 'fila_reprogramada');

    const pendingC = advanceTheoryPendingAfterCompletion({
      pending: pendingB,
      slot: {
        slotIdBase: 'sex',
        dataSlot: '2026-09-11',
        assunto: 'Assunto B',
        assuntoOriginal: 'Assunto C',
      },
    });
    assert.equal(pendingC.assunto, 'Assunto C');
  });

  it('keeps the same subject first when it remains unfinished again', () => {
    const pending = buildTheoryContinuationPending({
      assunto: 'Assunto A',
      currentPending: { assunto: 'Assunto A', filaAssuntos: [], tipo: 'continuidade' },
      slot: {
        slotIdBase: 'qua',
        dataSlot: '2026-09-09',
        assunto: 'Assunto A',
        assuntoOriginal: 'Assunto B',
      },
      nowIso: '2026-09-09T15:00:00.000Z',
    });

    assert.equal(pending.assunto, 'Assunto A');
    assert.deepEqual(pending.filaAssuntos.map((entry) => entry.assunto), ['Assunto B']);
  });

  it('does not duplicate a displaced subject when progress sync runs twice', () => {
    const pending = { assunto: 'Assunto A', filaAssuntos: [], tipo: 'continuidade' };
    const slot = {
      slotIdBase: 'qua',
      assunto: 'Assunto A',
      assuntoOriginal: 'Assunto B',
    };
    const once = captureDisplacedTheoryTopic(pending, slot);
    const twice = captureDisplacedTheoryTopic(once, slot);
    assert.deepEqual(twice.filaAssuntos.map((entry) => entry.assunto), ['Assunto B']);
  });

  it('queues a second unfinished subject without overwriting the older continuation', () => {
    const pending = buildTheoryContinuationPending({
      assunto: 'Assunto B',
      currentPending: {
        assunto: 'Assunto A',
        filaAssuntos: [],
        origemSlotIdBase: 'seg',
        origemDataSlot: '2026-09-07',
        tipo: 'continuidade',
      },
      dataSlot: '2026-09-09',
      fallbackOrigin: 'registro-manual:direito:assunto-b',
      nowIso: '2026-09-09T15:00:00.000Z',
    });

    assert.equal(pending.assunto, 'Assunto A');
    assert.deepEqual(pending.filaAssuntos.map((entry) => entry.assunto), ['Assunto B']);
  });

  it('keeps queue-only schedule adjustments visually distinct from unfinished content', () => {
    const cronograma = createCronograma({
      assunto: 'Assunto B',
      origemSlotIdBase: 'qua',
      origemDataSlot: '2026-09-09',
      origemOrdemNoDia: 0,
      tipo: 'fila_reprogramada',
      filaAssuntos: [],
    });

    const adjusted = theorySlots(cronograma).find((slot) => slot.isFilaTeoriaOverride);
    assert.equal(adjusted.slotIdBase, 'sex');
    assert.equal(adjusted.isPendenciaTeoria, false);
  });

  it('records the session while keeping an unfinished continuation first', () => {
    const cronograma = {
      id: 'cronograma-1',
      ...createCronograma({
        assunto: 'Assunto A',
        origemSlotIdBase: 'seg',
        origemDataSlot: '2026-09-07',
        origemOrdemNoDia: 0,
        tipo: 'continuidade',
        filaAssuntos: [],
      }),
    };
    const result = applyCronogramaRegistroProgress(cronograma, {
      contextoRegistro: 'cronograma',
      cronogramaId: 'cronograma-1',
      disciplinaId: 'direito',
      assunto: 'Assunto A',
      data: '2026-09-09',
      tempoEstudadoMinutos: 50,
      naoConcluidoCronograma: true,
      cronogramaSlotIdBase: 'qua',
    });

    assert.equal(result.progresso.w0.qua, true);
    assert.equal(result.pendenciasTeoria.direito.assunto, 'Assunto A');
    assert.deepEqual(
      result.pendenciasTeoria.direito.filaAssuntos.map((entry) => entry.assunto),
      ['Assunto B'],
    );
  });

  it('advances to the displaced subject when the continuation is completed', () => {
    const cronograma = {
      id: 'cronograma-1',
      ...createCronograma({
        assunto: 'Assunto A',
        origemSlotIdBase: 'seg',
        origemDataSlot: '2026-09-07',
        origemOrdemNoDia: 0,
        tipo: 'continuidade',
        filaAssuntos: [],
      }),
    };
    const result = applyCronogramaRegistroProgress(cronograma, {
      contextoRegistro: 'cronograma',
      cronogramaId: 'cronograma-1',
      disciplinaId: 'direito',
      assunto: 'Assunto A',
      data: '2026-09-09',
      tempoEstudadoMinutos: 50,
      markAsFinished: true,
      assuntoFinalizado: true,
      cronogramaSlotIdBase: 'qua',
    });

    assert.equal(result.progresso.w0.qua, true);
    assert.equal(result.pendenciasTeoria.direito.assunto, 'Assunto B');
    assert.equal(result.pendenciasTeoria.direito.tipo, 'fila_reprogramada');
  });
});
