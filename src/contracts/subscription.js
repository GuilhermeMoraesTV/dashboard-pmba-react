/**
 * @fileoverview Contratos de domínio para Monetização, Planos e Assinaturas (ModoQAP)
 * @module contracts/subscription
 */

/**
 * Fases de monetização do sistema
 * @readonly
 * @enum {string}
 */
export const MONETIZATION_PHASE = Object.freeze({
  PRE_FOUNDER: 'PRE_FOUNDER',
  FOUNDER_OPEN: 'FOUNDER_OPEN',
  REGULAR: 'REGULAR',
});

/**
 * Tipos de planos disponíveis no ModoQAP
 * @readonly
 * @enum {string}
 */
export const PLAN_TYPES = Object.freeze({
  FREE_TRIAL: 'FREE_TRIAL',
  FOUNDER: 'FOUNDER',
  PREMIUM: 'PREMIUM',
});

/**
 * Status do ciclo de vida da assinatura
 * @readonly
 * @enum {string}
 */
export const SUBSCRIPTION_STATUS = Object.freeze({
  ACTIVE: 'ACTIVE',
  EXPIRED: 'EXPIRED',
});

/**
 * @typedef {Object} SubscriptionRecord
 * @property {'FREE_TRIAL' | 'FOUNDER' | 'PREMIUM'} plan
 * @property {'ACTIVE' | 'EXPIRED'} status
 * @property {any | null} trialStartedAt - Timestamp do Firestore ou Date
 * @property {any | null} trialEndsAt - Timestamp do Firestore ou Date
 * @property {boolean} founder - Identidade permanente de Fundador (após pagamento)
 * @property {any | null} founderSince - Timestamp de quando virou Fundador
 * @property {boolean} founderEligible - Flag histórica (estudou nos 60d anteriores)
 * @property {any | null} founderEligibleAt - Timestamp do snapshot
 * @property {any} updatedAt - Timestamp da última atualização
 */

/**
 * @typedef {Object} UserEntitlements
 * @property {'FREE_TRIAL' | 'FOUNDER' | 'PREMIUM'} plan
 * @property {'ACTIVE' | 'EXPIRED'} status
 * @property {boolean} hasAccess - Se o usuário pode acessar as áreas protegidas
 * @property {boolean} isTrial - Se o plano atual é FREE_TRIAL
 * @property {boolean} isTrialActive - Se está em trial e dentro do prazo
 * @property {boolean} isTrialExpired - Se está em trial e o prazo expirou
 * @property {number} trialDaysRemaining - Dias inteiros restantes de trial (>= 0)
 * @property {number} trialHoursRemaining - Horas restantes de trial (>= 0)
 * @property {boolean} isFounder - Se possui a identidade permanente de Fundador
 * @property {Date | null} founderSince - Data em que se tornou Fundador
 * @property {boolean} founderEligible - Se tem a marcação de elegibilidade histórica
 * @property {Date | null} founderEligibleAt - Data do snapshot de elegibilidade
 * @property {boolean} isPendingInitialization - Se aguarda inicialização no backend
 */
