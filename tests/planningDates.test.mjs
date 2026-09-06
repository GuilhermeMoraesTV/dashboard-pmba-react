import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  clampPlanningStartDate,
  getLocalTodayKey,
  getBrasiliaTodayKey,
  getBrasiliaToday,
  getBrasiliaDayOfWeek,
  addDaysBrasilia,
} from '../src/utils/planningDates.js';

describe('planning start dates and Brasilia timezone', () => {
  it('formats the local day without using UTC conversion', () => {
    assert.equal(getLocalTodayKey(new Date(2026, 7, 15, 23, 30)), '2026-08-15');
  });

  it('correctly handles Brasilia timezone during late evening UTC rollover', () => {
    // 2026-09-06T00:39:20.000Z is 2026-09-05 21:39:20 in Brasilia (UTC-3)
    const lateSaturdayUtc = new Date('2026-09-06T00:39:20.000Z');
    assert.equal(getBrasiliaTodayKey(lateSaturdayUtc), '2026-09-05');
    assert.equal(getBrasiliaDayOfWeek(lateSaturdayUtc), 6); // 6 = Saturday

    const todayDate = getBrasiliaToday(lateSaturdayUtc);
    assert.equal(todayDate.getDate(), 5);
    assert.equal(todayDate.getMonth(), 8); // September (0-indexed)
    assert.equal(todayDate.getFullYear(), 2026);
    assert.equal(todayDate.getDay(), 6);

    const nextDay = addDaysBrasilia(lateSaturdayUtc, 1);
    assert.equal(getBrasiliaTodayKey(nextDay), '2026-09-06');
    assert.equal(nextDay.getDay(), 0); // 0 = Sunday
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

