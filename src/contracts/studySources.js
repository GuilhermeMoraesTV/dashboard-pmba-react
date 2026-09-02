/** @fileoverview Contratos da autoridade acadêmica StudySource e da organização StudyFolder. */

export const STUDY_SOURCE_KINDS = Object.freeze(['note', 'document']);
export const STUDY_SOURCE_STATUSES = Object.freeze(['processing', 'ready', 'error']);

/**
 * @typedef {Object} StudyFolder
 * @property {string} id
 * @property {string} userId
 * @property {string} name
 * @property {string} description
 * @property {string} [color]
 * @property {string} [icon]
 * @property {number} order
 * @property {string|null} [parentFolderId]
 * @property {string[]} [ancestorFolderIds]
 * @property {boolean} archived
 * @property {Date|string} createdAt
 * @property {Date|string} updatedAt
 */

/**
 * @typedef {Object} StudySource
 * @property {string} id
 * @property {string} userId
 * @property {string} folderId
 * @property {'note'|'document'} kind
 * @property {string} title
 * @property {'processing'|'ready'|'error'} status
 * @property {number} sourceRevision
 * @property {string|null} [documentId]
 * @property {string} [originalText]
 * @property {Date|string} createdAt
 * @property {Date|string} updatedAt
 */

/**
 * Toda geração acadêmica futura recebe exclusivamente esta autoridade.
 * Disciplina, assunto, tema, focusTopics e prompts de conhecimento geral não integram o contrato.
 * @typedef {Object} SourceBoundGenerationRequest
 * @property {string} sourceId
 */
