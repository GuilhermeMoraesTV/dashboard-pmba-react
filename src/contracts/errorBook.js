/**
 * @fileoverview Contratos de dados e tipos para o Caderno de Erros.
 * Suporta erros polimórficos originados tanto de Questões quanto de Flashcards.
 */

/**
 * Tipos de origem suportados pelo Caderno de Erros.
 * @type {readonly ['question', 'flashcard']}
 */
export const ERROR_BOOK_SOURCE_TYPES = Object.freeze(['question', 'flashcard']);

export { buildErrorBookEntryId } from '../../functions/shared/errorBookIdentity.mjs';

/**
 * @typedef {'question' | 'flashcard'} ErrorBookSourceType
 */

/**
 * Representação prévia do item para renderização na lista do Caderno de Erros.
 * @typedef {Object} ErrorBookPreview
 * @property {string} [title] Título descritivo ou cabeçalho.
 * @property {string} [snippet] Trecho resumido para exibição rápida.
 * @property {string} [statement] Enunciado completo (se questão).
 * @property {string} [front] Frente do card (se flashcard).
 * @property {Array<{ id: string, text: string }>} [options] Alternativas (se questão).
 * @property {string} [correctOptionId] Alternativa correta (revelada após resolução).
 * @property {string} [userSelectedOptionId] Última opção assinalada pelo usuário.
 */

/**
 * Modelo de transporte / UI para Entrada no Caderno de Erros.
 * @typedef {Object} ErrorBookEntry
 * @property {string} id Identidade determinística (`question:{scope}:{id}` ou `flashcard:{deckId}:{cardId}`).
 * @property {string} userId ID do usuário proprietário.
 * @property {ErrorBookSourceType} sourceType Tipo de item de origem ('question' ou 'flashcard').
 * @property {string} sourceId ID do item original (ID da questão ou ID do card).
 * @property {'global' | 'private' | null} questionScope Escopo obrigatório para questões; null para flashcards.
 * @property {string | null} deckId Deck obrigatório para flashcards; null para questões.
 * @property {string | null} [disciplineId] Identificador da matéria/disciplina.
 * @property {string | null} [subject] Nome do assunto / tópico.
 * @property {number} wrongCount Quantidade acumulada de erros registrados.
 * @property {number} correctCount Quantidade de acertos após inclusão no caderno de erros.
 * @property {string | Date} lastAttemptAt Data/hora da tentativa mais recente.
 * @property {string | null} [userNotes] Anotações pessoais do estudante sobre o erro.
 * @property {boolean} mastered Indica se o item foi superado/dominado pelo estudante.
 * @property {string | Date | null} [masteredAt] Data em que foi marcado como dominado.
 * @property {ErrorBookPreview} preview Dados necessários para renderização visual do item.
 * @property {string | Date} createdAt Data de inclusão no caderno.
 * @property {string | Date} updatedAt Data da última modificação.
 */

/**
 * Modelo de persistência no Firestore para Entrada no Caderno de Erros.
 * Caminho: users/{userId}/error_book/{entryId}
 * @typedef {Object} ErrorBookEntryEntity
 * @property {string} userId ID do usuário.
 * @property {ErrorBookSourceType} sourceType 'question' ou 'flashcard'.
 * @property {string} sourceId ID do recurso de origem.
 * @property {'global' | 'private' | null} questionScope Escopo obrigatório para questões; null para flashcards.
 * @property {string | null} deckId Deck obrigatório para flashcards; null para questões.
 * @property {string | null} [disciplineId] Disciplina.
 * @property {string | null} [subject] Assunto.
 * @property {number} wrongCount Contagem de erros.
 * @property {number} correctCount Contagem de acertos.
 * @property {any} lastAttemptAt Firestore Timestamp da última tentativa.
 * @property {string | null} [userNotes] Notas.
 * @property {boolean} mastered Status dominado.
 * @property {any} [masteredAt] Firestore Timestamp de domínio.
 * @property {ErrorBookPreview} preview Visualização prévia.
 * @property {any} createdAt Firestore Timestamp.
 * @property {any} updatedAt Firestore Timestamp.
 */

/**
 * Validador de ErrorBookSourceType.
 * @param {any} sourceType
 * @returns {sourceType is ErrorBookSourceType}
 */
export function isValidErrorBookSourceType(sourceType) {
  return typeof sourceType === 'string' && ERROR_BOOK_SOURCE_TYPES.includes(sourceType);
}
