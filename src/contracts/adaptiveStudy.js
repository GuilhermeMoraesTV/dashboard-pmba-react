/** @fileoverview Contratos da sessao backend-authoritative do Tutor Adaptativo. */

export const ADAPTIVE_SESSION_STATUSES = Object.freeze(['active', 'completed', 'cancelled', 'error']);
export const ADAPTIVE_QUEUE_STATES = Object.freeze(['generating', 'ready', 'served', 'consumed', 'cancelled', 'error']);
export const COGNITIVE_DIFFICULTIES = Object.freeze(['easy', 'hard']);

/**
 * @typedef {'easy'|'hard'} CognitiveDifficulty
 */

/**
 * @typedef {Object} SourceReference
 * @property {string} sourceId
 * @property {string|null} documentId
 * @property {string} chunkId
 * @property {number|null} [pageStart]
 * @property {number|null} [pageEnd]
 * @property {number} [order]
 */

/**
 * @typedef {Object} AdaptiveStudySession
 * @property {string} id
 * @property {string} userId
 * @property {string} sourceId
 * @property {number} sourceRevision
 * @property {string} folderId
 * @property {string} deckId
 * @property {'flashcards'} mode
 * @property {'active'|'completed'|'cancelled'|'error'} status
 * @property {string} algorithmVersion
 * @property {Record<string, any>} metrics
 */

/**
 * @typedef {Object} ConceptMastery
 * @property {string} userId
 * @property {string} sourceId
 * @property {number} sourceRevision
 * @property {string} conceptId
 * @property {number} exposures
 * @property {number} correctCount
 * @property {number} wrongCount
 * @property {number} correctStreak
 * @property {number} wrongStreak
 * @property {Array<Record<string, any>>} recentErrors
 * @property {'new'|'learning'|'reinforcing'|'mastered'} learningStage
 * @property {number} priorityBoost
 */
