import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createHydrationState,
  getCoreHydrationStatus,
  HYDRATION_RESOURCE_KEYS,
  isPlanningAssessmentReady,
} from '../src/utils/appHydration.js';

const fillState = (overrides = {}) => Object.fromEntries(
  HYDRATION_RESOURCE_KEYS.map((key) => [key, {
    received: true,
    authoritative: true,
    failed: false,
    hasPendingWrites: false,
    ...(overrides[key] || {}),
  }])
);

test('nao libera estado vazio vindo apenas do cache enquanto online', () => {
  const state = fillState({ registros: { authoritative: false } });
  const status = getCoreHydrationStatus({
    hydrationState: state,
    isOnline: true,
    timedOut: false,
    legacyReadyFlags: true,
  });

  assert.equal(status.ready, false);
  assert.equal(isPlanningAssessmentReady(state), false);
});

test('libera a interface depois que os recursos essenciais sao confirmados', () => {
  const state = fillState();
  const status = getCoreHydrationStatus({
    hydrationState: state,
    isOnline: true,
    timedOut: false,
    legacyReadyFlags: true,
  });

  assert.equal(status.ready, true);
  assert.equal(isPlanningAssessmentReady(state), true);
});

test('offline usa cache recebido sem classificar usuario como novo', () => {
  const state = fillState(Object.fromEntries(
    HYDRATION_RESOURCE_KEYS.map((key) => [key, { authoritative: false }])
  ));
  const status = getCoreHydrationStatus({
    hydrationState: state,
    isOnline: false,
    timedOut: false,
    legacyReadyFlags: true,
  });

  assert.equal(status.ready, true);
  assert.equal(isPlanningAssessmentReady(state), false);
});

test('timeout evita bloqueio infinito sem autorizar onboarding incorreto', () => {
  const state = fillState(Object.fromEntries(
    HYDRATION_RESOURCE_KEYS.map((key) => [key, { authoritative: false }])
  ));
  const status = getCoreHydrationStatus({
    hydrationState: state,
    isOnline: true,
    timedOut: true,
    legacyReadyFlags: false,
  });

  assert.equal(status.ready, true);
  assert.equal(isPlanningAssessmentReady(state), false);
});

test('timeout nao libera a interface antes de todos os listeners responderem', () => {
  const state = createHydrationState();
  const status = getCoreHydrationStatus({
    hydrationState: state,
    isOnline: true,
    timedOut: true,
    legacyReadyFlags: false,
  });

  assert.equal(status.ready, false);
});
