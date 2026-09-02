/**
 * @fileoverview Contratos de dados e tipos para o domínio de Flashcards.
 * Define interfaces para Decks, Cards, CardReviews e estados de agendamento.
 */

/**
 * Classificações de qualidade de revisão aceitas pelo scheduler.
 * @type {readonly ['again', 'hard', 'good', 'easy']}
 */
export const QUALITY_RATINGS = Object.freeze(['again', 'hard', 'good', 'easy']);

/**
 * Estados possíveis do ciclo de vida de um flashcard.
 * @type {readonly ['new', 'learning', 'review', 'relearning']}
 */
export const CARD_STATUSES = Object.freeze(['new', 'learning', 'review', 'relearning']);

/**
 * Origens possíveis de criação de um flashcard.
 * @type {readonly ['manual', 'ai', 'anki', 'document']}
 */
export const CARD_SOURCE_TYPES = Object.freeze(['manual', 'ai', 'anki', 'document']);

/**
 * @typedef {'again' | 'hard' | 'good' | 'easy'} QualityRating
 */

/**
 * @typedef {'new' | 'learning' | 'review' | 'relearning'} CardStatus
 */

/**
 * @typedef {'manual' | 'ai' | 'anki' | 'document'} CardSourceType
 */

/**
 * Estado opaco e versionado do algoritmo de agendamento.
 * Permite desacoplamento entre o domínio e o algoritmo concreto (ex: SM-2, FSRS).
 * @typedef {Object} OpaqueSchedulerState
 * @property {string} algorithm Identificador do algoritmo (ex: 'sm2', 'fsrs').
 * @property {number} version Versão do schema de dados do algoritmo.
 * @property {Record<string, any>} data Estrutura interna de parâmetros matemáticos do algoritmo.
 */

/**
 * Metadados para cards importados do Anki para permitir reimportação idempotente.
 * @typedef {Object} AnkiCardMetadata
 * @property {string} ankiNoteGuid Identificador global exclusivo da nota no Anki.
 * @property {number | string} [ankiNoteId] ID numérico ou string da nota no banco Anki.
 * @property {number} ankiCardOrd Índice ordinal do card dentro da nota.
 */

/**
 * Modelo de transporte / UI para Deck (Baralho).
 * @typedef {Object} Deck
 * @property {string} id Identificador único do deck.
 * @property {string} userId ID do usuário proprietário (isolamento por usuário).
 * @property {string} name Nome do baralho.
 * @property {string} [description] Descrição opcional.
 * @property {number} cardCount Quantidade total de cards no deck.
 * @property {string | null} [folderId] Pasta de Estudos opcional associada ao deck.
 * @property {string[]} tags Tags para categorização e busca.
 * @property {boolean} archived Indica se o deck está arquivado.
 * @property {string | Date} createdAt Data de criação.
 * @property {string | Date} updatedAt Data da última alteração.
 */

/**
 * Modelo de persistência no Firestore para Deck.
 * Caminho no Firestore: users/{userId}/decks/{deckId}
 * @typedef {Object} DeckEntity
 * @property {string} userId ID do usuário proprietário.
 * @property {string} name Nome do baralho.
 * @property {string} [description] Descrição opcional.
 * @property {number} cardCount Quantidade total de cards.
 * @property {string | null} [folderId] Pasta de Estudos opcional associada.
 * @property {string[]} tags Tags de categorização.
 * @property {boolean} archived Flag de arquivamento.
 * @property {any} createdAt Firestore Timestamp / serverTimestamp.
 * @property {any} updatedAt Firestore Timestamp / serverTimestamp.
 */

/**
 * Modelo de transporte / UI para Flashcard.
 * @typedef {Object} Card
 * @property {string} id Identificador único do card.
 * @property {string} deckId ID do deck ao qual pertence.
 * @property {string} [folderId] Pasta de Estudos obrigatoria para cards novos; legado pode herdar do Deck.
 * @property {string} userId ID do proprietário.
 * @property {string} front Conteúdo da frente (pergunta / prompt).
 * @property {string} back Conteúdo do verso (resposta).
 * @property {string[]} tags Tags associadas.
 * @property {CardStatus} status Estado atual de retenção ('new', 'learning', 'review', 'relearning').
 * @property {string | Date} dueAt Data/hora da próxima revisão agendada.
 * @property {number} lapses Quantidade de vezes em que o usuário errou ('again') após ter aprendido.
 * @property {number} reps Quantidade de repetições bem-sucedidas consecutivas.
 * @property {number} reviewVersion Contador monotônico de versão da revisão para controle de concorrência.
 * @property {OpaqueSchedulerState} schedulerState Estado opaco do scheduler.
 * @property {AnkiCardMetadata} [ankiMetadata] Metadados de rastreio de origem Anki.
 * @property {CardSourceType} sourceType Tipo de origem do card.
 * @property {string | null} [sourceId] ID do recurso de origem (ex: docId ou questionId).
 * @property {number} [sourceRevision] Revisao da fonte usada na geracao.
 * @property {string} [conceptId] Conceito adaptativo.
 * @property {'easy'|'hard'} [cognitiveDifficulty] Dificuldade cognitiva do conteudo.
 * @property {string} [variantKey] Variante conceitual.
 * @property {string} [contentFingerprint] Identidade de deduplicacao textual.
 * @property {import('./adaptiveStudy.js').SourceReference[]} [sourceRefs] Evidencias da fonte.
 * @property {string | Date} createdAt Data de criação.
 * @property {string | Date} updatedAt Data de atualização.
 */

/**
 * Modelo de persistência no Firestore para Flashcard.
 * Caminho no Firestore: users/{userId}/decks/{deckId}/cards/{cardId}
 * @typedef {Object} CardEntity
 * @property {string} deckId ID do deck.
 * @property {string} userId ID do proprietário.
 * @property {string} front Conteúdo da frente.
 * @property {string} back Conteúdo do verso.
 * @property {string[]} tags Tags.
 * @property {CardStatus} status Estado do card.
 * @property {any} dueAt Firestore Timestamp para consultas por vencimento.
 * @property {number} lapses Contagem de esquecimentos.
 * @property {number} reps Contagem de repetições.
 * @property {number} [reviewVersion] Contador monotônico de versão.
 * @property {OpaqueSchedulerState} schedulerState Estado do algoritmo.
 * @property {AnkiCardMetadata} [ankiMetadata] Metadados Anki.
 * @property {CardSourceType} sourceType Tipo de origem.
 * @property {string | null} [sourceId] ID da origem.
 * @property {any} createdAt Firestore Timestamp.
 * @property {any} updatedAt Firestore Timestamp.
 */

/**
 * Modelo de transporte / UI para histórico de revisão de Flashcard.
 * @typedef {Object} CardReview
 * @property {string} id Identificador da revisão.
 * @property {string} cardId ID do card revisado.
 * @property {string} deckId ID do deck do card.
 * @property {string} userId ID do usuário.
 * @property {QualityRating} rating Avaliação aplicada ('again', 'hard', 'good', 'easy').
 * @property {number} [elapsedTimeMs] Tempo de resposta em milissegundos.
 * @property {number} scheduledDays Intervalo em dias agendado.
 * @property {OpaqueSchedulerState} previousState Estado antes da revisão.
 * @property {OpaqueSchedulerState} nextState Estado resultante após a revisão.
 * @property {number} [reviewVersion] Versão resultante do card após esta revisão.
 * @property {string} [reviewRequestId] Identidade de idempotência da requisição de revisão.
 * @property {boolean} [isLapse] Indica se o review gerou lapse real.
 * @property {'pending' | 'synced' | null} [errorBookSyncStatus] Status de sincronização com o Caderno de Erros.
 * @property {string | Date} reviewedAt Data/hora em que a revisão foi realizada.
 */

/**
 * Modelo de persistência no Firestore para CardReview.
 * Caminho no Firestore: users/{userId}/card_reviews/{reviewId}
 * @typedef {Object} CardReviewEntity
 * @property {string} cardId ID do card.
 * @property {string} deckId ID do deck.
 * @property {string} userId ID do usuário.
 * @property {QualityRating} rating Avaliação de qualidade.
 * @property {number} [elapsedTimeMs] Duração em ms.
 * @property {number} scheduledDays Dias até a próxima revisão.
 * @property {OpaqueSchedulerState} previousState Estado prévio.
 * @property {OpaqueSchedulerState} nextState Estado novo.
 * @property {number} [reviewVersion] Versão do card.
 * @property {string} [reviewRequestId] Chave de idempotência.
 * @property {boolean} [isLapse] Flag de lapse.
 * @property {'pending' | 'synced' | null} [errorBookSyncStatus] Status de sincronização.
 * @property {string | null} [errorBookEntryId] ID da entrada no Caderno de Erros gerada.
 * @property {any} [errorBookSyncedAt] Timestamp da sincronização com ErrorBook.
 * @property {any} reviewedAt Firestore Timestamp.
 */

/**
 * Resultado do cálculo de agendamento produzido pelo CardScheduler.
 * @typedef {Object} SchedulerOutput
 * @property {OpaqueSchedulerState} nextState Novo estado opaco do algoritmo.
 * @property {number} intervalDays Intervalo de dias até a próxima revisão.
 * @property {number} [intervalMinutes] Intervalo exato em minutos para learning/relearning intradiário.
 * @property {Date} dueAt Data/hora calculada para a próxima revisão.
 * @property {boolean} isLapse Indica se a resposta foi classificada como esquecimento ('again').
 * @property {CardStatus} status Próximo status do card ('new', 'learning', 'review', 'relearning').
 */

/**
 * Visualização prévia dos 4 resultados possíveis para uma revisão.
 * @typedef {Record<QualityRating, SchedulerOutput>} SchedulerPreview
 */

/**
 * Validador básico de QualityRating.
 * @param {any} rating
 * @returns {rating is QualityRating}
 */
export function isValidQualityRating(rating) {
  return typeof rating === 'string' && QUALITY_RATINGS.includes(rating);
}

/**
 * Validador de CardStatus.
 * @param {any} status
 * @returns {status is CardStatus}
 */
export function isValidCardStatus(status) {
  return typeof status === 'string' && CARD_STATUSES.includes(status);
}
