import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  buildTopicCompletionRecord,
  getTopicCompletionRecordId,
} from '../src/services/studyRecords/topicCompletion.js';

describe('topic completion record', () => {
  it('marks a cronograma topic in the format consumed by EditalPage', () => {
    const record = buildTopicCompletionRecord({
      contextoRegistro: 'cronograma',
      contextId: 'cronograma-1',
      disciplinaId: 'direito',
      disciplinaNome: 'Direito Constitucional',
      assunto: 'Direitos fundamentais',
      data: '2026-09-10',
      obs: 'Concluído via Timer',
      origem: 'timer',
    });

    assert.equal(record.cronogramaId, 'cronograma-1');
    assert.equal(record.cicloId, undefined);
    assert.equal(record.contextoRegistro, 'cronograma');
    assert.equal(record.tipoEstudo, 'check_manual');
    assert.equal(record.assunto, 'Direitos fundamentais');
    assert.equal(record.tempoEstudadoMinutos, 0);
  });

  it('keeps the existing ciclo completion contract', () => {
    const record = buildTopicCompletionRecord({
      contextoRegistro: 'ciclo',
      contextId: 'ciclo-1',
      disciplinaId: 'portugues',
      disciplinaNome: 'Português',
      assunto: 'Crase',
      data: '2026-09-10',
      obs: 'Concluído via Registro Manual',
      origem: 'registro_manual',
    });

    assert.equal(record.cicloId, 'ciclo-1');
    assert.equal(record.cronogramaId, undefined);
    assert.equal(record.tipoEstudo, 'check_manual');
  });

  it('uses the same id for retries of the same topic and plan', () => {
    const base = {
      contextoRegistro: 'cronograma',
      contextId: 'cronograma-1',
      disciplinaId: 'direito',
      disciplinaNome: 'Direito Constitucional',
      assunto: 'Poder Constituinte',
    };

    assert.equal(getTopicCompletionRecordId(base), getTopicCompletionRecordId({ ...base }));
    assert.notEqual(
      getTopicCompletionRecordId(base),
      getTopicCompletionRecordId({ ...base, assunto: 'Controle de Constitucionalidade' }),
    );
  });
});
