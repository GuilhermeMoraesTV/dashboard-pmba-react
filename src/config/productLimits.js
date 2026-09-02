/**
 * @fileoverview Configurações de limites e cotas de produto.
 * Fornece valores padrão de fallback e utilitários para mesclar com configurações
 * dinâmicas obtidas do Firestore (system_config/product_limits) sem necessidade de redeploy.
 */

/**
 * Caminho do documento de configuração dinâmica no Firestore.
 */
export const SYSTEM_CONFIG_PRODUCT_LIMITS_DOC = 'system_config/product_limits';

/**
 * Limites padrão imutáveis do sistema.
 */
export const DEFAULT_PRODUCT_LIMITS = Object.freeze({
  // Armazenamento e Upload
  storage: Object.freeze({
    maxPdfSizeBytes: 25 * 1024 * 1024, // 25 MB
    maxApkgSizeBytes: 50 * 1024 * 1024, // 50 MB (Anki)
    allowedDocumentTypes: Object.freeze(['pdf']),
  }),

  // Flashcards e Baralhos
  flashcards: Object.freeze({
    defaultNewCardsPerDay: 20,
    defaultMaxReviewsPerDay: 100,
    maxCardsPerDeck: 2000,
    maxDecksPerUser: 500,
    maxTagsPerCard: 10,
  }),

  scheduler: Object.freeze({
    learningStepsMinutes: Object.freeze([1, 10]),
    relearningStepsMinutes: Object.freeze([1, 10]),
    hardMinutes: 6,
    graduatingIntervalDays: 1,
    easyIntervalDays: 3,
  }),

  // Questões e Sessões
  questions: Object.freeze({
    defaultDailyQuestionsGoal: 20,
    maxQuestionsPerSession: 50,
    maxPrivateQuestionsPerUser: 5000,
    minOptionsPerQuestion: 2,
    maxOptionsPerQuestion: 5,
    maxStatementChars: 12000,
    maxOptionTextChars: 4000,
    maxDisciplineIdChars: 160,
    maxSubjectChars: 500,
    maxMetadataChars: 240,
    maxExplanationChars: 12000,
  }),

  // Caderno de Erros
  errorBook: Object.freeze({
    maxEntriesPerPage: 50,
    maxUserNotesChars: 4000,
  }),

  // Geração por Inteligência Artificial
  ai: Object.freeze({
    maxGeneratedCardsPerBatch: 30,
    maxGeneratedQuestionsPerBatch: 20,
    maxDocumentPagesForAI: 50,
    dailyGenerationsLimitPerUser: 10,
    maxInputChars: 120000,
    maxOutputTokens: 8192,
  }),

  documents: Object.freeze({
    chunkTargetChars: 6000,
    chunkOverlapChars: 300,
    maxExtractedTextChars: 600000,
    maxChunks: 160,
    processingLeaseMs: 15 * 60 * 1000,
  }),

  studySources: Object.freeze({
    maxFoldersPerUser: 500,
    maxSourcesPerUser: 500,
    maxTitleChars: 180,
    maxFolderNameChars: 120,
    maxFolderDescriptionChars: 1000,
    maxNoteChars: 120000,
  }),

  // Tutor Adaptativo (valores internos; nunca solicitados ao usuario)
  adaptiveStudy: Object.freeze({
    targetReady: 4,
    lowWatermark: 3,
    refillSize: 4,
    maxConceptsPerSource: 24,
    maxItemsPerSession: 100,
    maxGenerationCallsPerSession: 35,
    maxDailyGenerationCalls: 40,
    maxTokensPerGeneration: 4096,
    maxTokensPerSession: 60000,
    maxConceptChunks: 4,
  }),

  // Identidade de Reimportação do Anki
  anki: Object.freeze({
    identityFields: Object.freeze(['ankiNoteGuid', 'ankiCardOrd']),
    supportedFormats: Object.freeze(['collection.anki2', 'collection.anki21', 'collection.anki21b', 'collection.21b']),
    maxArchiveEntries: 10000,
    maxArchiveUncompressedBytes: 200 * 1024 * 1024,
    maxCollectionBytes: 120 * 1024 * 1024,
    maxMediaFileSizeBytes: 12 * 1024 * 1024,
    maxMediaFiles: 5000,
    maxCardsPerImport: 10000,
    maxCardHtmlChars: 200000,
    maxWarnings: 100,
    maxCompressionRatio: 200,
  }),
});

/**
 * Mescla as configurações padrão com eventuais substituições obtidas remotamente do Firestore.
 * @param {Record<string, any>} [remoteOverrides] Objeto vindo de system_config/product_limits.
 * @returns {typeof DEFAULT_PRODUCT_LIMITS}
 */
export function resolveProductLimits(remoteOverrides = {}) {
  if (!remoteOverrides || typeof remoteOverrides !== 'object') {
    return DEFAULT_PRODUCT_LIMITS;
  }

  return {
    storage: {
      ...DEFAULT_PRODUCT_LIMITS.storage,
      ...(remoteOverrides.storage || {}),
    },
    flashcards: {
      ...DEFAULT_PRODUCT_LIMITS.flashcards,
      ...(remoteOverrides.flashcards || {}),
    },
    scheduler: {
      ...DEFAULT_PRODUCT_LIMITS.scheduler,
      ...(remoteOverrides.scheduler || {}),
    },
    questions: {
      ...DEFAULT_PRODUCT_LIMITS.questions,
      ...(remoteOverrides.questions || {}),
    },
    errorBook: {
      ...DEFAULT_PRODUCT_LIMITS.errorBook,
      ...(remoteOverrides.errorBook || {}),
    },
    ai: {
      ...DEFAULT_PRODUCT_LIMITS.ai,
      ...(remoteOverrides.ai || {}),
    },
    documents: {
      ...DEFAULT_PRODUCT_LIMITS.documents,
      ...(remoteOverrides.documents || {}),
    },
    studySources: {
      ...DEFAULT_PRODUCT_LIMITS.studySources,
      ...(remoteOverrides.studySources || {}),
    },
    adaptiveStudy: {
      ...DEFAULT_PRODUCT_LIMITS.adaptiveStudy,
      ...(remoteOverrides.adaptiveStudy || {}),
    },
    anki: {
      ...DEFAULT_PRODUCT_LIMITS.anki,
      ...(remoteOverrides.anki || {}),
    },
  };
}
