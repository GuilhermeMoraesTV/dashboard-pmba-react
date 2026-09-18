const admin = require('firebase-admin');
const { Timestamp, FieldValue } = require('firebase-admin/firestore');

const MONETIZATION_CONFIG_DOC = 'monetization';
const SIXTY_DAYS_MS = 60 * 24 * 60 * 60 * 1000;
const TRIAL_DURATION_DAYS = 7;

const firestore = () => admin.firestore();
const timestamp = () => FieldValue.serverTimestamp();

const DEFAULT_MONETIZATION_CONFIG = {
  monetizationPhase: 'PRE_FOUNDER',
  founderProgram: {
    isOpen: false,
    priceYearly: 97,
    openedAt: null,
    closedAt: null,
  },
  trialConfig: {
    durationDays: TRIAL_DURATION_DAYS,
  },
};

/**
 * Obtém as configurações centrais de monetização
 */
const getMonetizationConfig = async () => {
  const docRef = firestore().collection('system_config').doc(MONETIZATION_CONFIG_DOC);
  const snap = await docRef.get();
  if (!snap.exists) return { ...DEFAULT_MONETIZATION_CONFIG };
  const data = snap.data() || {};
  return {
    monetizationPhase: data.monetizationPhase || DEFAULT_MONETIZATION_CONFIG.monetizationPhase,
    founderProgram: {
      ...DEFAULT_MONETIZATION_CONFIG.founderProgram,
      ...(data.founderProgram || {}),
    },
    trialConfig: {
      ...DEFAULT_MONETIZATION_CONFIG.trialConfig,
      ...(data.trialConfig || {}),
    },
    snapshotSummary: data.snapshotSummary || null,
  };
};

/**
 * Garante de forma idempotente que o usuário possui o nó subscription inicializado pelo servidor
 */
const ensureUserSubscription = async ({ uid, email, displayName }) => {
  if (!uid || typeof uid !== 'string') {
    throw Object.assign(new Error('UID inválido para inicializar assinatura.'), { code: 'invalid-argument' });
  }

  const userRef = firestore().collection('users').doc(uid);
  const snap = await userRef.get();
  const userData = snap.exists ? (snap.data() || {}) : {};
  const existing = (userData.subscription && typeof userData.subscription === 'object') ? userData.subscription : {};

  const config = await getMonetizationConfig();
  const now = Timestamp.now();

  const isPaidUser = existing.plan === 'FOUNDER' || existing.plan === 'PREMIUM' || Boolean(existing.founder);
  const isTrialAlreadyStarted = existing.plan === 'FREE_TRIAL' && existing.trialStartedAt != null;
  const isAlreadyExpired = existing.status === 'EXPIRED';
  const isPreFounderReady = config.monetizationPhase === 'PRE_FOUNDER' && existing.plan && existing.status === 'ACTIVE';

  // Se o usuário já é pago, já teve o trial iniciado, já expirou ou já está pronto em PRE_FOUNDER, não altera nada
  if (isPaidUser || isTrialAlreadyStarted || isAlreadyExpired || isPreFounderReady) {
    return {
      initialized: true,
      alreadyExisted: true,
      subscription: existing,
    };
  }

  let initialSubscription;
  if (config.monetizationPhase === 'REGULAR' || config.monetizationPhase === 'POST_FOUNDER_REGULAR') {
    // Fase regular pós-fundador: sem trial gratuito
    initialSubscription = {
      plan: existing.plan || 'FREE_TRIAL',
      status: existing.status || 'EXPIRED',
      trialStartedAt: existing.trialStartedAt || null,
      trialEndsAt: existing.trialEndsAt || null,
      founder: Boolean(existing.founder),
      founderSince: existing.founderSince || null,
      founderEligible: Boolean(existing.founderEligible),
      founderEligibleAt: existing.founderEligibleAt || null,
      updatedAt: now,
    };
  } else if (config.monetizationPhase === 'PRE_FOUNDER') {
    // Fase PRE_FOUNDER: Acesso ativo de pré-lançamento sem queimar os 7 dias de trial prematuramente
    initialSubscription = {
      plan: existing.plan || 'FREE_TRIAL',
      status: existing.status || 'ACTIVE',
      trialStartedAt: existing.trialStartedAt || null,
      trialEndsAt: existing.trialEndsAt || null,
      founder: Boolean(existing.founder),
      founderSince: existing.founderSince || null,
      founderEligible: Boolean(existing.founderEligible),
      founderEligibleAt: existing.founderEligibleAt || null,
      updatedAt: now,
    };
  } else {
    // Fase FOUNDER_OPEN: 7 dias de trial ativo a partir de NOW (quando o usuário acessa ou se cadastra)
    const trialDays = Number(config.trialConfig?.durationDays) || TRIAL_DURATION_DAYS;
    const trialEndsAt = Timestamp.fromMillis(now.toMillis() + (trialDays * 24 * 60 * 60 * 1000));
    initialSubscription = {
      plan: existing.plan || 'FREE_TRIAL',
      status: 'ACTIVE',
      trialStartedAt: now,
      trialEndsAt,
      founder: Boolean(existing.founder),
      founderSince: existing.founderSince || null,
      founderEligible: Boolean(existing.founderEligible),
      founderEligibleAt: existing.founderEligibleAt || null,
      updatedAt: now,
    };
  }

  const basePayload = {
    subscription: initialSubscription,
  };
  if (!snap.exists) {
    basePayload.uid = uid;
    if (email) basePayload.email = email;
    if (displayName) basePayload.name = displayName;
    basePayload.createdAt = now;
  }

  await userRef.set(basePayload, { merge: true });

  return {
    initialized: true,
    alreadyExisted: false,
    subscription: initialSubscription,
  };
};

/**
 * Verifica se um usuário possui pelo menos um registro de estudo em registrosEstudo nos 60 dias anteriores
 */
const checkUserStudyActivityInWindow = async ({ uid, cutoffTimestamp, cutoffDateKey }) => {
  const recordsRef = firestore().collection('users').doc(uid).collection('registrosEstudo');
  const cutoffTs = Timestamp.fromMillis(cutoffTimestamp);

  const [snapData, snapDate, snapTimestamp, snapCreatedAt] = await Promise.all([
    recordsRef.where('data', '>=', cutoffDateKey).limit(1).get(),
    recordsRef.where('date', '>=', cutoffDateKey).limit(1).get(),
    recordsRef.where('timestamp', '>=', cutoffTs).limit(1).get(),
    recordsRef.where('createdAt', '>=', cutoffTs).limit(1).get(),
  ]);

  return !snapData.empty || !snapDate.empty || !snapTimestamp.empty || !snapCreatedAt.empty;
};

/**
 * Abertura manual do Programa de Fundador com execução da fotografia histórica dos 60 dias
 */
const openFounderProgram = async ({ actor }) => {
  const configDocRef = firestore().collection('system_config').doc(MONETIZATION_CONFIG_DOC);
  const currentConfig = await getMonetizationConfig();

  // Trava de idempotência estrita: se já foi aberto, rejeita recálculo
  if (currentConfig.founderProgram?.openedAt != null || currentConfig.founderProgram?.isOpen === true) {
    throw Object.assign(new Error('O Programa Fundador já foi aberto anteriormente e sua fotografia é imutável.'), {
      code: 'failed-precondition',
      details: { openedAt: currentConfig.founderProgram.openedAt },
    });
  }

  const openedAt = Timestamp.now();
  const cutoffTimestamp = openedAt.toMillis() - SIXTY_DAYS_MS;
  const cutoffDate = new Date(cutoffTimestamp);
  const cutoffDateKey = cutoffDate.toISOString().slice(0, 10);

  const usersSnap = await firestore().collection('users').get();
  const totalAnalyzed = usersSnap.size;
  let eligibleCount = 0;

  let batch = firestore().batch();
  let batchCount = 0;

  for (const userDoc of usersSnap.docs) {
    const uid = userDoc.id;
    const isEligible = await checkUserStudyActivityInWindow({
      uid,
      cutoffTimestamp,
      cutoffDateKey,
    });

    if (isEligible) {
      eligibleCount += 1;
      const userData = userDoc.data() || {};
      const existing = (userData.subscription && typeof userData.subscription === 'object') ? userData.subscription : {};

      const fullSubscription = {
        plan: existing.plan || 'FREE_TRIAL',
        status: existing.status || 'ACTIVE',
        trialStartedAt: existing.trialStartedAt || null,
        trialEndsAt: existing.trialEndsAt || null,
        founder: Boolean(existing.founder),
        founderSince: existing.founderSince || null,
        founderEligible: true,
        founderEligibleAt: openedAt,
        updatedAt: openedAt,
      };

      batch.set(userDoc.ref, { subscription: fullSubscription }, { merge: true });
      batchCount += 1;

      if (batchCount >= 400) {
        await batch.commit();
        batch = firestore().batch();
        batchCount = 0;
      }
    }
  }

  if (batchCount > 0) {
    await batch.commit();
  }

  const snapshotSummary = {
    executedAt: openedAt,
    cutoffDate: cutoffDate.toISOString(),
    cutoffDateKey,
    totalAnalyzed,
    eligibleCount,
  };

  const updatedConfig = {
    monetizationPhase: 'FOUNDER_OPEN',
    founderProgram: {
      isOpen: true,
      priceYearly: 97,
      openedAt,
      closedAt: null,
    },
    trialConfig: {
      durationDays: TRIAL_DURATION_DAYS,
    },
    snapshotSummary,
    updatedAt: openedAt,
  };

  await configDocRef.set(updatedConfig, { merge: true });

  // Grava auditoria
  await firestore().collection('admin_audit_logs').add({
    action: 'open_founder_program',
    actorUid: actor?.uid || null,
    actorEmail: actor?.email || null,
    createdAt: openedAt,
    status: 'success',
    payloadSummary: snapshotSummary,
  });

  return {
    success: true,
    openedAt: openedAt.toDate().toISOString(),
    snapshotSummary,
  };
};

/**
 * Encerramento manual do Programa de Fundador
 */
const closeFounderProgram = async ({ actor }) => {
  const configDocRef = firestore().collection('system_config').doc(MONETIZATION_CONFIG_DOC);
  const currentConfig = await getMonetizationConfig();

  if (!currentConfig.founderProgram?.isOpen) {
    throw Object.assign(new Error('O Programa Fundador não está aberto atualmente.'), { code: 'failed-precondition' });
  }

  const closedAt = Timestamp.now();

  await configDocRef.set({
    monetizationPhase: 'REGULAR',
    'founderProgram.isOpen': false,
    'founderProgram.closedAt': closedAt,
    updatedAt: closedAt,
  }, { merge: true });

  // Grava auditoria
  await firestore().collection('admin_audit_logs').add({
    action: 'close_founder_program',
    actorUid: actor?.uid || null,
    actorEmail: actor?.email || null,
    createdAt: closedAt,
    status: 'success',
    payloadSummary: { closedAt: closedAt.toDate().toISOString() },
  });

  return {
    success: true,
    closedAt: closedAt.toDate().toISOString(),
  };
};

module.exports = {
  getMonetizationConfig,
  ensureUserSubscription,
  openFounderProgram,
  closeFounderProgram,
  checkUserStudyActivityInWindow,
  DEFAULT_MONETIZATION_CONFIG,
};
