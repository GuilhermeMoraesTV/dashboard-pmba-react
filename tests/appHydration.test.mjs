import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createHydrationState,
  getCoreHydrationStatus,
  HYDRATION_RESOURCE_KEYS,
  isPlanningAssessmentReady,
  shouldShowDashboardBoot,
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

test('libera a shell com cache preenchido enquanto mantém decisões de planejamento bloqueadas', () => {
  const state = fillState({ registros: { authoritative: false, hasData: true } });
  const status = getCoreHydrationStatus({
    hydrationState: state,
    isOnline: true,
    timedOut: false,
    legacyReadyFlags: true,
  });

  assert.equal(status.ready, true);
  assert.equal(isPlanningAssessmentReady(state), false);
});

test('nao trata cache vazio online como ausencia confirmada', () => {
  const state = fillState({
    activeCiclo: { authoritative: false, hasData: false },
  });
  const status = getCoreHydrationStatus({ hydrationState: state, isOnline: true });

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

test('shell online usa cache antes do timeout sem classificar usuário como novo', () => {
  const state = fillState(Object.fromEntries(
    HYDRATION_RESOURCE_KEYS.map((key) => [key, { authoritative: false, hasData: true }])
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

test('timeout libera shell online quando ciclo e cronograma já foram resolvidos', () => {
  const state = fillState({
    registros: { authoritative: false, hasData: true },
    simulados: { authoritative: false, hasData: true },
    disciplinasCiclo: { authoritative: false, hasData: true },
    metas: { authoritative: false, hasData: true },
  });
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

test('timeout encerra o boot de tela cheia sem autorizar decisões de planejamento', () => {
  const state = createHydrationState();

  assert.equal(shouldShowDashboardBoot({
    hasSubscriptionAccess: true,
    coreDataReady: false,
    hydrationTimedOut: false,
  }), true);
  assert.equal(shouldShowDashboardBoot({
    hasSubscriptionAccess: true,
    coreDataReady: false,
    hydrationTimedOut: true,
  }), false);
  assert.equal(isPlanningAssessmentReady(state), false);
});
