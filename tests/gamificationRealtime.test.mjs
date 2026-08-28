import test from 'node:test';
import assert from 'node:assert/strict';
import { buildAcademicXPEvents } from '../src/utils/gamification.js';
import { getAcademicXPEventId } from '../src/utils/gamificationRealtime.js';

test('refresh de gamificacao resolve o mesmo id deterministico usado pelo backend', () => {
  const [event] = buildAcademicXPEvents({
    records: [{ id: 'registro-123', data: '2026-08-22', tempoEstudadoMinutos: 20 }],
  });
  assert.equal(getAcademicXPEventId({ sourceType: 'study', sourceId: 'registro-123' }), event.id);
  assert.equal(getAcademicXPEventId({ sourceType: 'study' }), null);
});

test('ids de conclusao usam o mesmo contrato deterministico do backend', () => {
  assert.equal(
    getAcademicXPEventId({ sourceType: 'cycle_round', sourceId: 'ciclo-1:rodada-000003' }),
    'academic_cycle_round_ciclo-1_rodada-000003',
  );
  assert.equal(
    getAcademicXPEventId({ sourceType: 'schedule_completion', sourceId: 'cronograma-1' }),
    'academic_schedule_complete_cronograma-1',
  );
});
