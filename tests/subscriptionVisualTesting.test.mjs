import test from 'node:test';
import assert from 'node:assert/strict';
import { deriveSubscription, PLAN_TYPES, SUBSCRIPTION_STATUS, MONETIZATION_PHASE } from '../src/auth/subscriptionControl.js';

test('1. Cenário PRE_FOUNDER: Usuário ativo sem data de término estipulada', () => {
  const userDoc = {
    subscription: {
      plan: PLAN_TYPES.FREE_TRIAL,
      status: SUBSCRIPTION_STATUS.ACTIVE,
      trialStartedAt: null,
      trialEndsAt: null,
      founder: false,
      founderEligible: false,
    },
  };

  const sub = deriveSubscription(userDoc);
  assert.equal(sub.hasAccess, true);
  assert.equal(sub.isTrialActive, true);
  assert.equal(sub.isTrialExpired, false);
  assert.equal(sub.trialDaysRemaining, null);
  assert.equal(sub.trialHoursRemaining, null);
  assert.equal(sub.isFounder, false);
});

test('2. Cenário FOUNDER_OPEN + Trial Novo (7 dias): Acesso ativo com 7 dias restantes', () => {
  const now = new Date('2026-09-07T12:00:00Z').getTime();
  const userDoc = {
    subscription: {
      plan: PLAN_TYPES.FREE_TRIAL,
      status: SUBSCRIPTION_STATUS.ACTIVE,
      trialStartedAt: new Date('2026-09-07T12:00:00Z'),
      trialEndsAt: new Date('2026-09-14T12:00:00Z'),
      founder: false,
      founderEligible: false, // Ajuste: não forçado true
    },
  };

  const sub = deriveSubscription(userDoc, { now });
  assert.equal(sub.hasAccess, true);
  assert.equal(sub.isTrialActive, true);
  assert.equal(sub.isTrialExpired, false);
  assert.equal(sub.trialDaysRemaining, 7);
  assert.equal(sub.trialHoursRemaining, 168);
  assert.equal(sub.isFounder, false);
  assert.equal(sub.founderEligible, false);
});

test('3. Cenário Trial com 3 dias restantes', () => {
  const now = new Date('2026-09-11T12:00:00Z').getTime();
  const userDoc = {
    subscription: {
      plan: PLAN_TYPES.FREE_TRIAL,
      status: SUBSCRIPTION_STATUS.ACTIVE,
      trialStartedAt: new Date('2026-09-07T12:00:00Z'),
      trialEndsAt: new Date('2026-09-14T12:00:00Z'),
      founder: false,
    },
  };

  const sub = deriveSubscription(userDoc, { now });
  assert.equal(sub.hasAccess, true);
  assert.equal(sub.isTrialActive, true);
  assert.equal(sub.trialDaysRemaining, 3);
  assert.equal(sub.trialHoursRemaining, 72);
});

test('4. Cenário Trial com menos de 24h (12 horas restantes): Expira hoje', () => {
  const now = new Date('2026-09-14T00:00:00Z').getTime();
  const userDoc = {
    subscription: {
      plan: PLAN_TYPES.FREE_TRIAL,
      status: SUBSCRIPTION_STATUS.ACTIVE,
      trialStartedAt: new Date('2026-09-07T12:00:00Z'),
      trialEndsAt: new Date('2026-09-14T12:00:00Z'), // Faltam 12 horas
      founder: false,
    },
  };

  const sub = deriveSubscription(userDoc, { now });
  assert.equal(sub.hasAccess, true);
  assert.equal(sub.isTrialActive, true);
  assert.equal(sub.trialDaysRemaining, 1);
  assert.equal(sub.trialHoursRemaining, 12);
  // Regra visual de 'expira hoje': hours <= 24 ou days === 0
  assert.equal(sub.trialHoursRemaining <= 24, true);
});

test('5. Cenário Trial expirado: Acesso bloqueado (hasAccess false)', () => {
  const now = new Date('2026-09-14T12:01:00Z').getTime();
  const userDoc = {
    subscription: {
      plan: PLAN_TYPES.FREE_TRIAL,
      status: SUBSCRIPTION_STATUS.ACTIVE,
      trialStartedAt: new Date('2026-09-07T12:00:00Z'),
      trialEndsAt: new Date('2026-09-14T12:00:00Z'), // Expirou há 1 minuto
      founder: false,
    },
  };

  const sub = deriveSubscription(userDoc, { now });
  assert.equal(sub.hasAccess, false);
  assert.equal(sub.isTrialActive, false);
  assert.equal(sub.isTrialExpired, true);
  assert.equal(sub.status, SUBSCRIPTION_STATUS.EXPIRED);
});

test('6. Cenário Founder ativo: Acesso total com trialEndsAt nulo e founder true', () => {
  const userDoc = {
    subscription: {
      plan: PLAN_TYPES.FOUNDER,
      status: SUBSCRIPTION_STATUS.ACTIVE,
      trialStartedAt: null, // Ajuste: nulo para planos pagos
      trialEndsAt: null,    // Ajuste: nulo para planos pagos
      founder: true,
      founderSince: new Date('2026-09-01T00:00:00Z'),
      founderEligible: true,
    },
  };

  const sub = deriveSubscription(userDoc);
  assert.equal(sub.hasAccess, true);
  assert.equal(sub.isFounder, true);
  assert.equal(sub.plan, PLAN_TYPES.FOUNDER);
  assert.equal(sub.status, SUBSCRIPTION_STATUS.ACTIVE);
  assert.equal(sub.isTrial, false);
});

test('7. Cenário Founder expirado: Acesso bloqueado, mas preserva identidade de Fundador', () => {
  const userDoc = {
    subscription: {
      plan: PLAN_TYPES.FOUNDER,
      status: SUBSCRIPTION_STATUS.EXPIRED,
      trialStartedAt: null,
      trialEndsAt: null,
      founder: true,
      founderSince: new Date('2025-08-01T00:00:00Z'),
      founderEligible: true,
    },
  };

  const sub = deriveSubscription(userDoc);
  assert.equal(sub.hasAccess, false);
  assert.equal(sub.isFounder, true); // Honra permanente
  assert.equal(sub.status, SUBSCRIPTION_STATUS.EXPIRED);
});

test('8. Cenário Premium ativo: Acesso total com trialEndsAt nulo e fase REGULAR', () => {
  const userDoc = {
    subscription: {
      plan: PLAN_TYPES.PREMIUM,
      status: SUBSCRIPTION_STATUS.ACTIVE,
      trialStartedAt: null,
      trialEndsAt: null,
      founder: false,
      founderSince: null,
      founderEligible: false,
    },
  };

  const sub = deriveSubscription(userDoc);
  assert.equal(sub.hasAccess, true);
  assert.equal(sub.plan, PLAN_TYPES.PREMIUM);
  assert.equal(sub.status, SUBSCRIPTION_STATUS.ACTIVE);
  assert.equal(sub.isFounder, false);
  assert.equal(MONETIZATION_PHASE.REGULAR, 'REGULAR');
});
