import test from 'node:test';
import assert from 'node:assert/strict';
import { deriveSubscription, PLAN_TYPES, SUBSCRIPTION_STATUS, MONETIZATION_PHASE } from '../src/auth/subscriptionControl.js';
import { deriveUserAccess } from '../src/auth/accessControl.js';

test('1. Documento sem subscription resulta em estado inicializante (isPendingInitialization = true, isTrialExpired = false)', () => {
  const emptyUserDoc = { uid: 'user-123', name: 'Guerreiro' };
  const sub = deriveSubscription(emptyUserDoc);

  assert.equal(sub.hasAccess, false);
  assert.equal(sub.isTrial, true);
  assert.equal(sub.isTrialExpired, false); // Não é expirado, está inicializando
  assert.equal(sub.isPendingInitialization, true);
});

test('2. Novo usuário em trial ativo (7 dias) tem acesso total', () => {
  const now = new Date('2026-09-07T12:00:00.000Z').getTime();
  const trialEndsAt = new Date('2026-09-14T12:00:00.000Z'); // 7 dias depois

  const userDoc = {
    uid: 'user-new',
    subscription: {
      plan: PLAN_TYPES.FREE_TRIAL,
      status: SUBSCRIPTION_STATUS.ACTIVE,
      trialStartedAt: new Date('2026-09-07T12:00:00.000Z'),
      trialEndsAt: trialEndsAt,
      founder: false,
      founderSince: null,
      founderEligible: false,
      founderEligibleAt: null,
    },
  };

  const sub = deriveSubscription(userDoc, { now });

  assert.equal(sub.hasAccess, true);
  assert.equal(sub.status, SUBSCRIPTION_STATUS.ACTIVE);
  assert.equal(sub.isTrialActive, true);
  assert.equal(sub.isTrialExpired, false);
  assert.equal(sub.trialDaysRemaining, 7);
  assert.equal(sub.isFounder, false);
});

test('3. Trial expirado bloqueia o acesso e calcula 0 dias restantes', () => {
  const trialEndsAt = new Date('2026-09-14T12:00:00.000Z');
  const nowAfterExpiry = new Date('2026-09-14T12:00:01.000Z').getTime();

  const userDoc = {
    uid: 'user-expired',
    subscription: {
      plan: PLAN_TYPES.FREE_TRIAL,
      status: SUBSCRIPTION_STATUS.ACTIVE,
      trialStartedAt: new Date('2026-09-07T12:00:00.000Z'),
      trialEndsAt: trialEndsAt,
      founder: false,
      founderSince: null,
      founderEligible: false,
      founderEligibleAt: null,
    },
  };

  const sub = deriveSubscription(userDoc, { now: nowAfterExpiry });

  assert.equal(sub.hasAccess, false);
  assert.equal(sub.status, SUBSCRIPTION_STATUS.EXPIRED);
  assert.equal(sub.isTrialActive, false);
  assert.equal(sub.isTrialExpired, true);
  assert.equal(sub.trialDaysRemaining, 0);
});

test('4. Usuário Fundador ativo tem acesso total e identidade de Fundador', () => {
  const founderSince = new Date('2026-09-01T10:00:00.000Z');
  const userDoc = {
    uid: 'user-founder',
    subscription: {
      plan: PLAN_TYPES.FOUNDER,
      status: SUBSCRIPTION_STATUS.ACTIVE,
      trialStartedAt: null,
      trialEndsAt: null,
      founder: true,
      founderSince: founderSince,
      founderEligible: true,
      founderEligibleAt: new Date('2026-08-30T10:00:00.000Z'),
    },
  };

  const sub = deriveSubscription(userDoc);

  assert.equal(sub.hasAccess, true);
  assert.equal(sub.status, SUBSCRIPTION_STATUS.ACTIVE);
  assert.equal(sub.isFounder, true);
  assert.equal(sub.isTrial, false);
  assert.equal(sub.founderSince?.toISOString(), founderSince.toISOString());
});

test('5. Usuário Fundador expirado tem acesso bloqueado, mas preserva identidade permanente de Fundador', () => {
  const founderSince = new Date('2025-09-01T10:00:00.000Z');
  const userDoc = {
    uid: 'user-founder-expired',
    subscription: {
      plan: PLAN_TYPES.FOUNDER,
      status: SUBSCRIPTION_STATUS.EXPIRED,
      trialStartedAt: null,
      trialEndsAt: null,
      founder: true,
      founderSince: founderSince,
      founderEligible: true,
      founderEligibleAt: new Date('2025-08-30T10:00:00.000Z'),
    },
  };

  const sub = deriveSubscription(userDoc);

  assert.equal(sub.hasAccess, false);
  assert.equal(sub.status, SUBSCRIPTION_STATUS.EXPIRED);
  assert.equal(sub.isFounder, true); // Identidade PERMANENTE preservada
  assert.equal(sub.founderSince?.toISOString(), founderSince.toISOString());
});

test('6. founderEligible é apenas histórico e não concede acesso sem assinatura ativa', () => {
  const userDoc = {
    uid: 'user-eligible-only',
    subscription: {
      plan: PLAN_TYPES.FREE_TRIAL,
      status: SUBSCRIPTION_STATUS.EXPIRED,
      trialStartedAt: new Date('2026-01-01T00:00:00.000Z'),
      trialEndsAt: new Date('2026-01-08T00:00:00.000Z'),
      founder: false,
      founderSince: null,
      founderEligible: true, // Apenas elegibilidade histórica
      founderEligibleAt: new Date('2026-09-07T00:00:00.000Z'),
    },
  };

  const sub = deriveSubscription(userDoc);

  assert.equal(sub.hasAccess, false);
  assert.equal(sub.founderEligible, true);
  assert.equal(sub.isFounder, false);
});

test('7. Administrador possui bypass administrativo mesmo com plano expirado', () => {
  const userDoc = {
    uid: 'admin-user',
    access: {
      role: 'admin',
      permissions: { adminPanel: true },
    },
    subscription: {
      plan: PLAN_TYPES.FREE_TRIAL,
      status: SUBSCRIPTION_STATUS.EXPIRED,
      trialStartedAt: null,
      trialEndsAt: null,
      founder: false,
    },
  };

  const access = deriveUserAccess({ authUser: { uid: 'admin-user' }, userDoc });

  assert.equal(access.isAdmin, true);
  assert.equal(access.hasAccess, true);
  assert.equal(access.subscription.hasAccess, true);
});

test('8. Validação dos enums e constantes de monetização', () => {
  assert.equal(MONETIZATION_PHASE.PRE_FOUNDER, 'PRE_FOUNDER');
  assert.equal(MONETIZATION_PHASE.FOUNDER_OPEN, 'FOUNDER_OPEN');
  assert.equal(MONETIZATION_PHASE.REGULAR, 'REGULAR');

  assert.equal(PLAN_TYPES.FREE_TRIAL, 'FREE_TRIAL');
  assert.equal(PLAN_TYPES.FOUNDER, 'FOUNDER');
  assert.equal(PLAN_TYPES.PREMIUM, 'PREMIUM');

  assert.equal(SUBSCRIPTION_STATUS.ACTIVE, 'ACTIVE');
  assert.equal(SUBSCRIPTION_STATUS.EXPIRED, 'EXPIRED');
});

test('9. Configuração inicial padrão de monetização inicia em PRE_FOUNDER e com Programa fechado', async () => {
  const { createRequire } = await import('node:module');
  const require = createRequire(import.meta.url);
  const { __test } = require('../functions/index.js');
  const config = __test.subscription.DEFAULT_MONETIZATION_CONFIG;

  assert.equal(config.monetizationPhase, 'PRE_FOUNDER');
  assert.equal(config.founderProgram.isOpen, false);
  assert.equal(config.founderProgram.priceYearly, 97);
  assert.equal(config.founderProgram.openedAt, null);
  assert.equal(config.founderProgram.closedAt, null);
  assert.equal(config.trialConfig.durationDays, 7);
});

test('10. Cálculo de cutoff de 60 dias anteriores ao momento da abertura', () => {
  const openedAtMs = new Date('2026-09-07T12:00:00.000Z').getTime();
  const sixtyDaysMs = 60 * 24 * 60 * 60 * 1000;
  const cutoffTimestamp = openedAtMs - sixtyDaysMs;
  const cutoffDate = new Date(cutoffTimestamp);
  const cutoffDateKey = cutoffDate.toISOString().slice(0, 10);

  // 60 dias antes de 2026-09-07 é 2026-07-09
  assert.equal(cutoffDateKey, '2026-07-09');
});

test('11. Usuário em PRE_FOUNDER com status ACTIVE e sem trialEndsAt possui acesso ativo sem queimar trial', () => {
  const userDoc = {
    uid: 'user-pre-founder',
    subscription: {
      plan: PLAN_TYPES.FREE_TRIAL,
      status: SUBSCRIPTION_STATUS.ACTIVE,
      trialStartedAt: null,
      trialEndsAt: null,
      founder: false,
      founderSince: null,
      founderEligible: false,
      founderEligibleAt: null,
    },
  };

  const sub = deriveSubscription(userDoc);

  assert.equal(sub.hasAccess, true);
  assert.equal(sub.status, SUBSCRIPTION_STATUS.ACTIVE);
  assert.equal(sub.isTrialActive, true);
  assert.equal(sub.isTrialExpired, false);
  assert.equal(sub.trialDaysRemaining, null);
});

test('12. Preservação de founderEligible e founder durante inicialização de assinatura', () => {
  const existingEligibleDoc = {
    uid: 'user-already-eligible',
    subscription: {
      founderEligible: true,
      founderEligibleAt: new Date('2026-09-07T12:00:00.000Z'),
      plan: PLAN_TYPES.FREE_TRIAL,
      status: SUBSCRIPTION_STATUS.ACTIVE,
      trialStartedAt: new Date('2026-09-07T12:00:00.000Z'),
      trialEndsAt: new Date('2026-09-14T12:00:00.000Z'),
      founder: false,
    },
  };

  const sub = deriveSubscription(existingEligibleDoc);
  assert.equal(sub.founderEligible, true);
  assert.equal(sub.hasAccess, true);
});

test('13. Usuário antigo elegível que volta 20 dias depois da abertura recebe 7 dias a partir do retorno', () => {
  const day1ProgramOpened = new Date('2026-09-01T12:00:00.000Z');
  const day20UserReturn = new Date('2026-09-21T12:00:00.000Z');
  const day27TrialEnd = new Date('2026-09-28T12:00:00.000Z'); // 7 dias a partir do dia 20

  // Snapshot registrou founderEligible no Dia 1, mas o trial inicia no Dia 20 (momento do retorno)
  const userDocDay20 = {
    uid: 'joao-antigo-elegivel',
    subscription: {
      plan: PLAN_TYPES.FREE_TRIAL,
      status: SUBSCRIPTION_STATUS.ACTIVE,
      trialStartedAt: day20UserReturn,
      trialEndsAt: day27TrialEnd,
      founder: false,
      founderSince: null,
      founderEligible: true,
      founderEligibleAt: day1ProgramOpened,
    },
  };

  const sub = deriveSubscription(userDocDay20, { now: day20UserReturn.getTime() });

  assert.equal(sub.hasAccess, true);
  assert.equal(sub.status, SUBSCRIPTION_STATUS.ACTIVE);
  assert.equal(sub.isTrialActive, true);
  assert.equal(sub.trialDaysRemaining, 7);
  assert.equal(sub.founderEligible, true);
  assert.equal(sub.founderEligibleAt?.toISOString(), day1ProgramOpened.toISOString());
});

test('14. Usuário antigo não elegível que volta 20 dias depois recebe 7 dias de trial sem founderEligible', () => {
  const day20UserReturn = new Date('2026-09-21T12:00:00.000Z');
  const day27TrialEnd = new Date('2026-09-28T12:00:00.000Z');

  const userDocDay20 = {
    uid: 'maria-antiga-nao-elegivel',
    subscription: {
      plan: PLAN_TYPES.FREE_TRIAL,
      status: SUBSCRIPTION_STATUS.ACTIVE,
      trialStartedAt: day20UserReturn,
      trialEndsAt: day27TrialEnd,
      founder: false,
      founderSince: null,
      founderEligible: false,
      founderEligibleAt: null,
    },
  };

  const sub = deriveSubscription(userDocDay20, { now: day20UserReturn.getTime() });

  assert.equal(sub.hasAccess, true);
  assert.equal(sub.status, SUBSCRIPTION_STATUS.ACTIVE);
  assert.equal(sub.isTrialActive, true);
  assert.equal(sub.trialDaysRemaining, 7);
  assert.equal(sub.founderEligible, false);
});

test('15. Usuário antigo que faz logout e login durante o trial NÃO tem o trial reiniciado', () => {
  const day20UserReturn = new Date('2026-09-21T12:00:00.000Z');
  const day27TrialEnd = new Date('2026-09-28T12:00:00.000Z');
  const day23LoginAgain = new Date('2026-09-24T12:00:00.000Z'); // 3 dias depois

  const userDocDay23 = {
    uid: 'joao-antigo-elegivel',
    subscription: {
      plan: PLAN_TYPES.FREE_TRIAL,
      status: SUBSCRIPTION_STATUS.ACTIVE,
      trialStartedAt: day20UserReturn, // Início original preservado
      trialEndsAt: day27TrialEnd,       // Fim original preservado
      founder: false,
      founderSince: null,
      founderEligible: true,
      founderEligibleAt: new Date('2026-09-01T12:00:00.000Z'),
    },
  };

  const sub = deriveSubscription(userDocDay23, { now: day23LoginAgain.getTime() });

  assert.equal(sub.hasAccess, true);
  assert.equal(sub.status, SUBSCRIPTION_STATUS.ACTIVE);
  assert.equal(sub.isTrialActive, true);
  assert.equal(sub.trialDaysRemaining, 4); // 7 - 3 = 4 dias restantes
});

test('16. Usuário antigo cujo trial já expirou permanece bloqueado e não tem o trial reiniciado', () => {
  const day20UserReturn = new Date('2026-09-21T12:00:00.000Z');
  const day27TrialEnd = new Date('2026-09-28T12:00:00.000Z');
  const day29LoginExpired = new Date('2026-09-30T12:00:00.000Z'); // 2 dias após expirar

  const userDocExpired = {
    uid: 'joao-antigo-elegivel',
    subscription: {
      plan: PLAN_TYPES.FREE_TRIAL,
      status: SUBSCRIPTION_STATUS.ACTIVE,
      trialStartedAt: day20UserReturn,
      trialEndsAt: day27TrialEnd,
      founder: false,
      founderSince: null,
      founderEligible: true,
      founderEligibleAt: new Date('2026-09-01T12:00:00.000Z'),
    },
  };

  const sub = deriveSubscription(userDocExpired, { now: day29LoginExpired.getTime() });

  assert.equal(sub.hasAccess, false);
  assert.equal(sub.status, SUBSCRIPTION_STATUS.EXPIRED);
  assert.equal(sub.isTrialActive, false);
  assert.equal(sub.isTrialExpired, true);
  assert.equal(sub.trialDaysRemaining, 0);
  assert.equal(sub.founderEligible, true); // Identidade histórica preservada
});

test('17. Novo usuário criado durante FOUNDER_OPEN recebe 7 dias a partir da criação', () => {
  const day10Registration = new Date('2026-09-10T15:00:00.000Z');
  const day17TrialEnd = new Date('2026-09-17T15:00:00.000Z');

  const newUserDoc = {
    uid: 'carlos-novo-cadastro',
    subscription: {
      plan: PLAN_TYPES.FREE_TRIAL,
      status: SUBSCRIPTION_STATUS.ACTIVE,
      trialStartedAt: day10Registration,
      trialEndsAt: day17TrialEnd,
      founder: false,
      founderSince: null,
      founderEligible: false,
      founderEligibleAt: null,
    },
  };

  const sub = deriveSubscription(newUserDoc, { now: day10Registration.getTime() });

  assert.equal(sub.hasAccess, true);
  assert.equal(sub.status, SUBSCRIPTION_STATUS.ACTIVE);
  assert.equal(sub.isTrialActive, true);
  assert.equal(sub.trialDaysRemaining, 7);
  assert.equal(sub.founderEligible, false);
});

test('18. Novo cadastro em PRE_FOUNDER passa pelo estado INITIALIZING e termina com acesso normal, sem exibir estado de trial expirado', () => {
  // Passo 1: Conta recém-criada sem subscription (estado INITIALIZING)
  const freshUserDoc = {
    uid: 'novo-aluno-1',
    name: 'Aluno Novo',
    email: 'aluno@modoqap.com',
  };

  const initialSub = deriveSubscription(freshUserDoc);
  assert.equal(initialSub.isPendingInitialization, true);
  assert.equal(initialSub.isTrialExpired, false); // NUNCA deve ser interpretado como expirado
  assert.equal(initialSub.hasAccess, false);

  // Passo 2: Servidor executa ensureUserSubscription em PRE_FOUNDER e grava nó completo
  const initializedUserDoc = {
    ...freshUserDoc,
    subscription: {
      plan: PLAN_TYPES.FREE_TRIAL,
      status: SUBSCRIPTION_STATUS.ACTIVE,
      trialStartedAt: null,
      trialEndsAt: null,
      founder: false,
      founderSince: null,
      founderEligible: false,
      founderEligibleAt: null,
    },
  };

  const readySub = deriveSubscription(initializedUserDoc);
  assert.equal(readySub.isPendingInitialization, false);
  assert.equal(readySub.isTrialActive, true);
  assert.equal(readySub.isTrialExpired, false);
  assert.equal(readySub.hasAccess, true);
  assert.equal(readySub.status, SUBSCRIPTION_STATUS.ACTIVE);
});

