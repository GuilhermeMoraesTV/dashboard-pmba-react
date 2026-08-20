import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { clampPlanningStartDate, getLocalTodayKey } from '../src/utils/planningDates.js';

describe('planning start dates', () => {
  it('formats the local day without using UTC conversion', () => {
    assert.equal(getLocalTodayKey(new Date(2026, 7, 15, 23, 30)), '2026-08-15');
  });

  it('rejects past or invalid planning dates', () => {
    assert.equal(clampPlanningStartDate('2026-08-14', '2026-08-15'), '2026-08-15');
    assert.equal(clampPlanningStartDate('', '2026-08-15'), '2026-08-15');
  });

  it('keeps today and future dates', () => {
    assert.equal(clampPlanningStartDate('2026-08-15', '2026-08-15'), '2026-08-15');
    assert.equal(clampPlanningStartDate('2026-09-01', '2026-08-15'), '2026-09-01');
  });
});
