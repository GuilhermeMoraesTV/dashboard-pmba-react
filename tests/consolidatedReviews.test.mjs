import test from 'node:test';
import assert from 'node:assert/strict';
import { expandConsolidatedReviewTopics } from '../src/utils/consolidatedReviews.js';
import { buildCompletionRegistro } from '../src/utils/completionRegistro.js';
import { estimateAcademicXPForRecord } from '../src/utils/academicXPPreview.js';

test('revisões consolidadas preservam IDs individuais e geram eventos determinísticos distintos', () => {
  const topics = expandConsolidatedReviewTopics([{
    slotId: 'reviews-day-1',
    dataSlot: '2026-08-25',
    topicosRevisao: [
      { slotId: 'review-portuguese-1', disciplinaId: 'portuguese', disciplinaNome: 'Português', assunto: 'Crase', tempoMinutos: 5 },
      { slotId: 'review-portuguese-2', disciplinaId: 'portuguese', disciplinaNome: 'Português', assunto: 'Regência', tempoMinutos: 5 },
    ],
  }]);

  assert.deepEqual(topics.map((topic) => topic.slotId), ['review-portuguese-1', 'review-portuguese-2']);
  const records = topics.map((topic) => buildCompletionRegistro({
    context: 'cronograma',
    item: topic,
    cronograma: { id: 'schedule-1' },
    isReview: true,
  }));
  assert.notEqual(records[0].origemConclusaoId, records[1].origemConclusaoId);
  assert.equal(records.every((record) => record.isRevisao && record.tipoEstudo === 'revisao'), true);
});

test('conclusão de revisão consolidada produz feedback otimista de XP', () => {
  const [topic] = expandConsolidatedReviewTopics([{
    slotId: 'reviews-day-1',
    dataSlot: '2026-08-25',
    topicosRevisao: [
      { slotId: 'review-law-1', disciplinaId: 'law', disciplinaNome: 'Direito', assunto: 'Princípios', tempoMinutos: 5 },
    ],
  }]);
  const record = buildCompletionRegistro({
    context: 'cronograma',
    item: topic,
    cronograma: { id: 'schedule-1' },
    isReview: true,
  });
  assert.ok(estimateAcademicXPForRecord({ record }) > 0);
});
