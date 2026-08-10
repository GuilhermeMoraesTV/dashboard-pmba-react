import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { isStudyRecordLinkedToPlan } from '../src/utils/planDeletion.js';

describe('plan deletion record matching', () => {
  it('matches only records from the deleted cycle', () => {
    assert.equal(isStudyRecordLinkedToPlan({ cicloId: 'ciclo-1' }, 'ciclo-1', 'ciclo'), true);
    assert.equal(isStudyRecordLinkedToPlan({ cicloId: 'ciclo-2' }, 'ciclo-1', 'ciclo'), false);
    assert.equal(isStudyRecordLinkedToPlan({ cronogramaId: 'ciclo-1' }, 'ciclo-1', 'ciclo'), false);
  });

  it('matches only records from the deleted schedule', () => {
    assert.equal(isStudyRecordLinkedToPlan({ cronogramaId: 'cronograma-1' }, 'cronograma-1', 'cronograma'), true);
    assert.equal(isStudyRecordLinkedToPlan({ cicloId: 'cronograma-1' }, 'cronograma-1', 'cronograma'), false);
  });
});
