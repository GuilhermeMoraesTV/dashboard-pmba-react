/** @fileoverview Permanent planning identity shared by cycle and schedule stages. */

/**
 * @typedef {'ciclo'|'cronograma'} PlanningMethod
 */

/**
 * @typedef {Object} PlanningStage
 * @property {PlanningMethod} metodo
 * @property {string} id Original cycle or schedule document ID.
 * @property {string} inicioEm ISO instant from which this stage governs future goals.
 * @property {Object} [metas] Compact, immutable goal snapshot for historical streaks.
 */

/**
 * @typedef {Object} PermanentPlanning
 * @property {string} id Stable ID under users/{uid}/planejamentos.
 * @property {string} nome
 * @property {string|null} editalId
 * @property {PlanningMethod} metodoVigente
 * @property {string} etapaVigenteId
 * @property {Array<PlanningStage>} etapas Ordered, append-only method timeline.
 * @property {boolean} arquivado
 */

/**
 * @typedef {Object} PlanningStudyLink
 * @property {string} [planejamentoId] Permanent ID on new study records.
 * @property {string} [cicloId] Original cycle-stage link, never rewritten.
 * @property {string} [cronogramaId] Original schedule-stage link, never rewritten.
 */

export {};
