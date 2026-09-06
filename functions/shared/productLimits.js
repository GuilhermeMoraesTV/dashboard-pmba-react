/**
 * @fileoverview Limites server-side com fallback local e overrides remotos.
 * O documento system_config/product_limits permanece a fonte dinamica de verdade.
 */

const DEFAULT_SERVER_PRODUCT_LIMITS = Object.freeze({
  support: Object.freeze({
    maxAttachments: 3, maxImageBytes: 5 * 1024 * 1024, maxPixels: 25_000_000,
    imageSide: 2560, imageQuality: 80, thumbnailSide: 480, thumbnailQuality: 70,
    userDailyImages: 30, adminDailyImages: 200, operationsPerMinute: 3,
    retentionMs: 15 * 86400000, operationTtlMs: 86400000, leaseMs: 180000,
    pageSize: 50, ticketPageSize: 100, maintenanceBatch: 100, maxTextChars: 12000,
  }),
  storage: Object.freeze({
    maxPdfSizeBytes: 25 * 1024 * 1024,
    maxApkgSizeBytes: 50 * 1024 * 1024,
  }),
  flashcards: Object.freeze({
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
  questions: Object.freeze({
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
  errorBook: Object.freeze({
    maxEntriesPerPage: 50,
    maxUserNotesChars: 4000,
  }),
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
  groupChat: Object.freeze({
    maxMessageChars: 4000,
    maxMentions: 10,
    editWindowMinutes: 15,
    messageCooldownMs: 1000,
    retentionDays: 90,
    outboxRetentionDays: 14,
  }),
  adaptiveStudy: Object.freeze({
    targetReady: 4,
    lowWatermark: 3,
    refillSize: 4,
    conceptsPerWindow: 8,
    conceptWindowMaxChars: 18000,
    conceptAnalysisConcurrency: 1,
    maxItemsPerSession: 100,
    maxGenerationCallsPerSession: 35,
    maxDailyGenerationCalls: 40,
    maxTokensPerGeneration: 4096,
    maxTokensPerSession: 60000,
  }),
  anki: Object.freeze({
    maxArchiveEntries: 10000,
    maxArchiveUncompressedBytes: 200 * 1024 * 1024,
    maxCollectionBytes: 120 * 1024 * 1024,
    maxMediaFileSizeBytes: 12 * 1024 * 1024,
    maxMediaFiles: 5000,
    maxCardsPerImport: 10000,
    maxCardsPerDeck: 10000,
    maxDecksPerUser: 10000,
    maxFoldersPerUser: 10000,
    importLeaseMs: 12 * 60 * 1000,
    maxCardHtmlChars: 200000,
    maxCardBytes: 900 * 1024,
    maxInlineReportBytes: 256 * 1024,
    maxWarnings: 100,
    maxCompressionRatio: 200,
  }),
});

let cachedLimits = null;
let cachedAt = 0;
const CACHE_TTL_MS = 5 * 60 * 1000;

function mergeLimits(overrides = {}) {
  const result = {};
  for (const [section, defaults] of Object.entries(DEFAULT_SERVER_PRODUCT_LIMITS)) {
    const sectionOverrides = overrides?.[section];
    result[section] = {
      ...defaults,
      ...(sectionOverrides && typeof sectionOverrides === 'object' ? sectionOverrides : {}),
    };
  }
  return result;
}

/**
 * Resolve limites dinamicos, com cache curto para evitar uma leitura por pagina/chunk.
 * @param {FirebaseFirestore.Firestore} db
 * @param {{ forceRefresh?: boolean }} [options]
 */
async function getProductLimits(db, options = {}) {
  const now = Date.now();
  if (!options.forceRefresh && cachedLimits && now - cachedAt < CACHE_TTL_MS) {
    return cachedLimits;
  }

  let remote = {};
  try {
    const snapshot = await db.collection('system_config').doc('product_limits').get();
    remote = snapshot.exists ? (snapshot.data() || {}) : {};
  } catch (error) {
    console.warn('[ProductLimits] Usando fallback server-side:', error?.message || error);
  }

  cachedLimits = mergeLimits(remote);
  cachedAt = now;
  return cachedLimits;
}

function resetProductLimitsCache() {
  cachedLimits = null;
  cachedAt = 0;
}

module.exports = {
  DEFAULT_SERVER_PRODUCT_LIMITS,
  getProductLimits,
  mergeLimits,
  resetProductLimitsCache,
};
