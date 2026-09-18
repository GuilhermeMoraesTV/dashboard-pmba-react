import { PLAN_TYPES, SUBSCRIPTION_STATUS, MONETIZATION_PHASE } from '../contracts/subscription.js';

export { PLAN_TYPES, SUBSCRIPTION_STATUS, MONETIZATION_PHASE };

/**
 * Converte de forma segura Timestamp do Firestore, string ISO, número ou Date em Date nativa
 * @param {any} value
 * @returns {Date | null}
 */
export function toSafeDate(value) {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value.toDate === 'function') {
    try {
      const d = value.toDate();
      return Number.isNaN(d.getTime()) ? null : d;
    } catch {
      return null;
    }
  }
  if (typeof value === 'number') {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  if (typeof value === 'string') {
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? null : new Date(parsed);
  }
  return null;
}

/**
 * Deriva os direitos (entitlements) de acesso do usuário a partir do seu documento Firestore
 * @param {Object|null} userDoc - Documento do usuário em users/{uid}
 * @param {Object} [options]
 * @param {number} [options.now] - Timestamp de referência em milissegundos
 * @param {boolean} [options.isAdmin] - Flag se o usuário tem privilégio administrativo
 * @returns {import('../contracts/subscription.js').UserEntitlements}
 */
export function deriveSubscription(userDoc, { now = Date.now(), isAdmin = false } = {}) {
  const sub = userDoc?.subscription || null;

  // Se o documento ou o nó subscription ainda não existe, sinaliza inicialização pendente
  if (!sub || typeof sub !== 'object') {
    return {
      plan: PLAN_TYPES.FREE_TRIAL,
      status: SUBSCRIPTION_STATUS.ACTIVE,
      hasAccess: Boolean(isAdmin),
      isTrial: true,
      isTrialActive: false,
      isTrialExpired: false,
      trialDaysRemaining: 0,
      trialHoursRemaining: 0,
      isFounder: false,
      founderSince: null,
      founderEligible: false,
      founderEligibleAt: null,
      isPendingInitialization: true,
    };
  }

  const rawPlan = String(sub.plan || PLAN_TYPES.FREE_TRIAL).toUpperCase();
  const plan = Object.values(PLAN_TYPES).includes(rawPlan) ? rawPlan : PLAN_TYPES.FREE_TRIAL;

  const rawStatus = String(sub.status || SUBSCRIPTION_STATUS.ACTIVE).toUpperCase();
  const rawStatusActive = rawStatus === SUBSCRIPTION_STATUS.ACTIVE;

  const isFounder = Boolean(sub.founder);
  const founderSince = toSafeDate(sub.founderSince);
  const founderEligible = Boolean(sub.founderEligible);
  const founderEligibleAt = toSafeDate(sub.founderEligibleAt);

  const trialStartedAt = toSafeDate(sub.trialStartedAt);
  const trialEndsAt = toSafeDate(sub.trialEndsAt);
  const isTrial = plan === PLAN_TYPES.FREE_TRIAL;

  let isTrialActive = false;
  let isTrialExpired = false;
  let trialDaysRemaining = 0;
  let trialHoursRemaining = 0;

  if (isTrial) {
    if (rawStatusActive && !trialEndsAt) {
      // Fase de pré-lançamento (PRE_FOUNDER) com acesso ativo sem data de término estipulada
      isTrialActive = true;
      isTrialExpired = false;
      trialDaysRemaining = null;
      trialHoursRemaining = null;
    } else if (trialEndsAt && rawStatusActive) {
      const endsAtMs = trialEndsAt.getTime();
      const diffMs = endsAtMs - now;
      if (diffMs > 0) {
        isTrialActive = true;
        isTrialExpired = false;
        trialDaysRemaining = Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
        trialHoursRemaining = Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60)));
      } else {
        isTrialActive = false;
        isTrialExpired = true;
      }
    } else {
      isTrialActive = false;
      isTrialExpired = true;
    }
  }

  // Determinação final de acesso
  let hasAccess = false;
  if (isAdmin) {
    hasAccess = true;
  } else if (isTrial) {
    hasAccess = isTrialActive;
  } else if (plan === PLAN_TYPES.FOUNDER || plan === PLAN_TYPES.PREMIUM) {
    hasAccess = rawStatusActive;
  }

  const effectiveStatus = hasAccess ? SUBSCRIPTION_STATUS.ACTIVE : SUBSCRIPTION_STATUS.EXPIRED;

  return {
    plan,
    status: effectiveStatus,
    hasAccess,
    isTrial,
    isTrialActive,
    isTrialExpired,
    trialDaysRemaining,
    trialHoursRemaining,
    isFounder,
    founderSince,
    founderEligible,
    founderEligibleAt,
    isPendingInitialization: false,
  };
}
