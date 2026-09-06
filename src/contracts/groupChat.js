/**
 * @fileoverview Contratos JSDoc do chat interno dos grupos de estudo.
 */

/**
 * @typedef {Object} GroupChatMeta
 * @property {string} groupId
 * @property {string} groupName
 * @property {string[]} memberIds
 * @property {number} lastSeq
 * @property {string|null} lastMessageId
 * @property {Date|null} lastMessageAt
 * @property {string|null} lastAuthorId
 * @property {Date|null} updatedAt
 */

/**
 * @typedef {Object} GroupChatMessage
 * @property {string} id
 * @property {number} seq
 * @property {string} authorId
 * @property {string} authorName
 * @property {string|null} authorPhotoURL
 * @property {string} text
 * @property {string|null} replyToMessageId
 * @property {string[]} mentionUids IDs individuais ou todos os demais membros quando o texto usa @Todos.
 * @property {Date|null} createdAt
 * @property {Date|null} updatedAt
 * @property {Date|null} editedAt
 * @property {boolean} deleted
 * @property {Date|null} deletedAt
 * @property {string|null} deletedBy
 * @property {Date|null} expiresAt
 * @property {'sending'|'sent'|'error'} [deliveryState]
 */

/**
 * @typedef {Object} GroupChatState
 * @property {string} groupId
 * @property {number} lastReadSeq
 * @property {Date|null} readAt
 * @property {Date|null} lastSendAt
 * @property {number} sentCountTotal
 * @property {number} sentCountAtRead
 * @property {Date|null} updatedAt
 */

/** @typedef {{uid: string, name: string, typingUntil: Date|null}} GroupChatTyping */

export {};
