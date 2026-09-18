/**
 * @fileoverview Contratos de dados e funções puras de domínio para Enquetes via Broadcast.
 */

import { DEFAULT_PRODUCT_LIMITS } from '../config/productLimits.js';

/**
 * @typedef {Object} BroadcastPollOption
 * @property {string} id - Identificador único da opção (ex: 'opt_1').
 * @property {string} text - Texto descritivo da opção.
 */

/**
 * @typedef {Object} BroadcastPollData
 * @property {BroadcastPollOption[]} options - Lista de 2 a 6 opções únicas.
 * @property {string[]} optionIds - Lista dos IDs das opções para validação rápida.
 * @property {'open'|'closed'} status - Status de votação da enquete.
 * @property {any|null} closesAt - Timestamp ou data de encerramento automático (opcional).
 * @property {any|null} closedAt - Timestamp de encerramento manual (se houver).
 */

/**
 * @typedef {Object} BroadcastPollResults
 * @property {string} pollId - ID do broadcast correspondente.
 * @property {number} responseCount - Total acumulado de respostas/votos.
 * @property {Record<string, number>} optionCounts - Mapeamento optionId -> contagem de votos.
 * @property {any} createdAt - Timestamp de criação do resumo.
 */

/**
 * @typedef {Object} BroadcastPollAnswer
 * @property {string} pollId - ID da enquete votada.
 * @property {string} uid - UID do usuário votante.
 * @property {string} optionId - ID da opção escolhida.
 * @property {any} respondedAt - Timestamp do registro do voto.
 */

/**
 * Normaliza o texto de uma opção removendo espaços excessivos.
 * @param {any} text
 * @returns {string}
 */
export function normalizeOptionText(text) {
  return String(text ?? '')
    .trim()
    .replace(/\s+/g, ' ');
}

/**
 * Chave de comparação para unicidade de opções (ignora maiúsculas, acentos e espaços múltiplos).
 * @param {any} text
 * @returns {string}
 */
export function normalizeOptionKey(text) {
  return normalizeOptionText(text)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

/**
 * Converte qualquer formato de data/timestamp para milissegundos de forma segura.
 * @param {any} value
 * @returns {number|null}
 */
export function toMillisSafe(value) {
  if (!value) return null;
  if (typeof value.toMillis === 'function') return value.toMillis();
  if (typeof value.toDate === 'function') return value.toDate().getTime();
  if (value instanceof Date) return value.getTime();
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const parsed = new Date(value).getTime();
  return Number.isNaN(parsed) ? null : parsed;
}

/**
 * Valida o rascunho de uma enquete antes de sua publicação.
 * @param {Object} draft
 * @param {string} [draft.title]
 * @param {string} [draft.description]
 * @param {Array<{ id?: string, text: string }|string>} [draft.options]
 * @param {any} [draft.closesAt]
 * @param {typeof DEFAULT_PRODUCT_LIMITS.polls} [limits]
 * @returns {{ isValid: boolean, errors: string[], normalizedOptions: BroadcastPollOption[], closesAtMillis: number|null }}
 */
export function validatePollDraft(draft = {}, limits = DEFAULT_PRODUCT_LIMITS.polls) {
  const errors = [];
  const pollLimits = limits || DEFAULT_PRODUCT_LIMITS.polls;

  const rawTitle = normalizeOptionText(draft.title);
  if (!rawTitle) {
    errors.push('O título da enquete é obrigatório.');
  } else if (rawTitle.length > pollLimits.maxTitleChars) {
    errors.push(`O título deve ter no máximo ${pollLimits.maxTitleChars} caracteres.`);
  }

  const rawDescription = normalizeOptionText(draft.description);
  if (rawDescription && rawDescription.length > pollLimits.maxDescriptionChars) {
    errors.push(`A descrição deve ter no máximo ${pollLimits.maxDescriptionChars} caracteres.`);
  }

  const rawOptions = Array.isArray(draft.options) ? draft.options : [];
  const normalizedOptions = [];
  const seenKeys = new Set();

  rawOptions.forEach((opt, index) => {
    const text = normalizeOptionText(typeof opt === 'string' ? opt : opt?.text);
    if (!text) {
      errors.push(`A opção ${index + 1} não pode estar vazia.`);
      return;
    }
    if (text.length > pollLimits.maxOptionChars) {
      errors.push(`A opção "${text.slice(0, 20)}..." excede ${pollLimits.maxOptionChars} caracteres.`);
      return;
    }
    const key = normalizeOptionKey(text);
    if (seenKeys.has(key)) {
      errors.push(`Opção duplicada: "${text}". Todas as opções devem ser distintas.`);
      return;
    }
    seenKeys.add(key);
    const id = (typeof opt === 'object' && opt?.id) ? String(opt.id).trim() : `opt_${index + 1}`;
    normalizedOptions.push({ id, text });
  });

  if (normalizedOptions.length < pollLimits.minOptions) {
    errors.push(`A enquete deve ter pelo menos ${pollLimits.minOptions} opções válidas.`);
  } else if (normalizedOptions.length > pollLimits.maxOptions) {
    errors.push(`A enquete pode ter no máximo ${pollLimits.maxOptions} opções.`);
  }

  let validClosesAt = null;
  if (draft.closesAt) {
    const millis = toMillisSafe(draft.closesAt);
    if (!millis || Number.isNaN(millis)) {
      errors.push('Data/hora de encerramento inválida.');
    } else {
      validClosesAt = millis;
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    normalizedOptions,
    closesAtMillis: validClosesAt,
  };
}

/**
 * Determina se uma enquete está efetivamente encerrada (por status manual ou por decurso de prazo).
 * @param {BroadcastPollData|Object} [poll]
 * @param {number} [nowMs]
 * @returns {boolean}
 */
export function isPollEffectiveClosed(poll = {}, nowMs = Date.now()) {
  if (!poll) return false;
  const target = (typeof poll === 'object' && poll.poll) ? { ...poll, ...poll.poll } : poll;
  if (target.status === 'closed') return true;
  if (target.closesAt) {
    const millis = toMillisSafe(target.closesAt);
    if (millis && millis <= nowMs) {
      return true;
    }
  }
  return false;
}

/**
 * Retorna o rótulo descritivo do status efetivo da enquete.
 * @param {BroadcastPollData|Object} [poll]
 * @param {number} [nowMs]
 * @returns {'open'|'closed_manual'|'closed_deadline'}
 */
export function getPollEffectiveStatus(poll = {}, nowMs = Date.now()) {
  if (!poll) return 'open';
  const target = (typeof poll === 'object' && poll.poll) ? { ...poll, ...poll.poll } : poll;
  if (target.status === 'closed') return 'closed_manual';
  if (target.closesAt) {
    const millis = toMillisSafe(target.closesAt);
    if (millis && millis <= nowMs) {
      return 'closed_deadline';
    }
  }
  return 'open';
}

/**
 * Calcula os percentuais e taxas de participação de uma enquete.
 * @param {BroadcastPollResults|Object|BroadcastPollOption[]} results
 * @param {BroadcastPollOption[]|Record<string, number>} [options]
 * @param {number|null} [audienceCount]
 * @returns {{ totalResponses: number, participationRate: number|null, optionStats: Array<BroadcastPollOption & { count: number, percentage: number, percentageLabel: string }> }}
 */
export function calculatePollPercentages(results = {}, options = [], audienceCount = null) {
  let normalizedResults = results;
  let normalizedOptions = options;
  let normalizedAudience = audienceCount;

  // Se chamado na ordem legada: (options, optionCounts, responseCount)
  if (Array.isArray(results)) {
    normalizedOptions = results;
    normalizedResults = {
      optionCounts: (options && typeof options === 'object') ? options : {},
      responseCount: typeof audienceCount === 'number' ? audienceCount : 0,
    };
    normalizedAudience = null;
  }

  const totalResponses = Math.max(0, Number(normalizedResults?.responseCount) || 0);
  const counts = normalizedResults?.optionCounts || {};

  const optionStats = (normalizedOptions || []).map((opt) => {
    const count = Math.max(0, Number(counts[opt.id]) || 0);
    const percentage = totalResponses > 0 ? (count / totalResponses) * 100 : 0;
    const rounded = Math.round(percentage * 10) / 10;
    const percentageLabel = totalResponses > 0 ? `${rounded.toFixed(rounded % 1 === 0 ? 0 : 1)}%` : '0%';
    return {
      ...opt,
      count,
      percentage,
      percentageLabel,
    };
  });

  const parsedAudience = Number(normalizedAudience);
  const participationRate = (Number.isFinite(parsedAudience) && parsedAudience > 0)
    ? Math.min(100, (totalResponses / parsedAudience) * 100)
    : null;

  return {
    totalResponses,
    participationRate,
    optionStats,
  };
}

/**
 * Verifica se um usuário pertence à audiência de um broadcast.
 * @param {Object} broadcast
 * @param {string} uid
 * @returns {boolean}
 */
export function isUserInBroadcastAudience(broadcast = {}, uid = '') {
  if (!uid) return false;
  if (broadcast.targetUid) {
    return broadcast.targetUid === uid;
  }
  if (Array.isArray(broadcast.targetUserIds) && broadcast.targetUserIds.length > 0) {
    return broadcast.targetUserIds.includes(uid);
  }
  return broadcast.audienceMode === 'all' || (!broadcast.targetUid && (!broadcast.targetUserIds || broadcast.targetUserIds.length === 0));
}
