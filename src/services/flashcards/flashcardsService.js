/**
 * @fileoverview Serviço de Flashcards — Fase 1 (Sonnet).
 * Implementação completa com Firestore real: CRUD de decks/cards, scheduler SM-2,
 * revisão atômica com Transaction, controle de concorrência com reviewVersion,
 * idempotência com reviewRequestId, histórico em card_reviews e integração com Caderno de Erros.
 */

import {
  Timestamp,
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  limit as firestoreLimit,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '../../firebaseConfig.js';
import { isValidQualityRating } from '../../contracts/flashcards.js';
import { DEFAULT_PRODUCT_LIMITS } from '../../config/productLimits.js';

const LIMITS = DEFAULT_PRODUCT_LIMITS.flashcards;

// ─── Helpers de normalização ──────────────────────────────────────────────────

/**
 * Converte valor Firestore Timestamp ou string para Date.
 * @param {any} value
 * @returns {Date | null}
 */
function toDate(value) {
  if (value?.toDate) return value.toDate();
  if (value instanceof Date) return value;
  if (value) {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }
  return null;
}

/**
 * Gera identificador determinístico para um CardReview a partir de reviewRequestId.
 * @param {string} userId
 * @param {string} deckId
 * @param {string} cardId
 * @param {string} reviewRequestId
 * @returns {string}
 */
export function buildDeterministicReviewId(userId, deckId, cardId, reviewRequestId) {
  const safeReq = String(reviewRequestId || '').trim().replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 100);
  const safeCard = String(cardId || '').trim().replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 100);
  return `rev_${safeCard}_${safeReq}`;
}

/**
 * Normaliza um documento de Deck vindo do Firestore.
 * @param {import('firebase/firestore').DocumentSnapshot} snap
 * @returns {import('../../contracts/flashcards.js').Deck}
 */
function normalizeDeck(snap) {
  const data = snap.data() || {};
  return {
    id: snap.id,
    userId: data.userId || '',
    name: data.name || '',
    description: data.description || '',
    cardCount: Number(data.cardCount || 0),
    folderId: data.folderId || null,
    tags: Array.isArray(data.tags) ? data.tags : [],
    archived: Boolean(data.archived),
    createdAt: toDate(data.createdAt) || new Date(),
    updatedAt: toDate(data.updatedAt) || new Date(),
  };
}

/**
 * Normaliza um documento de Card vindo do Firestore.
 * @param {import('firebase/firestore').DocumentSnapshot} snap
 * @param {string} deckId
 * @returns {import('../../contracts/flashcards.js').Card}
 */
function normalizeCard(snap, deckId) {
  const data = snap.data() || {};
  return {
    id: snap.id,
    deckId: data.deckId || deckId,
    folderId: data.folderId || null,
    userId: data.userId || '',
    front: data.front || '',
    back: data.back || '',
    tags: Array.isArray(data.tags) ? data.tags : [],
    status: data.status || 'new',
    dueAt: toDate(data.dueAt) || new Date(),
    lapses: Number(data.lapses || 0),
    reps: Number(data.reps || 0),
    reviewVersion: typeof data.reviewVersion === 'number' ? data.reviewVersion : 0,
    schedulerState: data.schedulerState || null,
    ankiMetadata: data.ankiMetadata || undefined,
    sourceType: data.sourceType || 'manual',
    sourceId: data.sourceId || null,
    createdAt: toDate(data.createdAt) || new Date(),
    updatedAt: toDate(data.updatedAt) || new Date(),
  };
}

// ─── Decks ────────────────────────────────────────────────────────────────────

/**
 * Lista os decks do usuário (exclui arquivados por padrão).
 * @param {string} userId
 * @param {{ includeArchived?: boolean, firestoreDb?: any }} [options]
 * @returns {Promise<import('../../contracts/flashcards.js').Deck[]>}
 */
export async function listDecks(userId, options = {}) {
  if (!userId) throw new Error('userId e obrigatorio em listDecks.');
  const firestoreDb = options.firestoreDb || db;
  const decksRef = collection(firestoreDb, 'users', userId, 'decks');
  const constraints = [];
  if (!options.includeArchived) {
    constraints.push(where('archived', '==', false));
  }
  const snap = await getDocs(query(decksRef, ...constraints));
  return snap.docs
    .map(normalizeDeck)
    .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime());
}

/**
 * Obtém um deck específico do usuário.
 * @param {string} userId
 * @param {string} deckId
 * @param {{ firestoreDb?: any }} [options]
 * @returns {Promise<import('../../contracts/flashcards.js').Deck | null>}
 */
export async function getDeck(userId, deckId, options = {}) {
  if (!userId || !deckId) throw new Error('userId e deckId sao obrigatorios em getDeck.');
  const firestoreDb = options.firestoreDb || db;
  const snap = await getDoc(doc(firestoreDb, 'users', userId, 'decks', deckId));
  if (!snap.exists()) return null;
  const deck = normalizeDeck(snap);
  if (deck.userId !== userId) throw new Error('Acesso negado: deck nao pertence ao usuario.');
  return deck;
}

/**
 * Cria um novo deck para o usuário.
 * @param {string} userId
 * @param {{ name: string, description?: string, tags?: string[] }} deckData
 * @param {{ firestoreDb?: any }} [options]
 * @returns {Promise<import('../../contracts/flashcards.js').Deck>}
 */
export async function createDeck(userId, deckData, options = {}) {
  if (!userId) throw new Error('userId e obrigatorio em createDeck.');
  if (!deckData?.name?.trim()) throw new Error('name e obrigatorio para criar um deck.');
  if (!deckData?.folderId) throw new Error('folderId e obrigatorio para criar um deck.');

  const firestoreDb = options.firestoreDb || db;
  const decksRef = collection(firestoreDb, 'users', userId, 'decks');
  const payload = {
    userId,
    name: String(deckData.name).trim().slice(0, 160),
    description: String(deckData.description || '').trim().slice(0, 2000),
    cardCount: 0,
    folderId: String(deckData.folderId).slice(0, 160),
    tags: Array.isArray(deckData.tags)
      ? deckData.tags.map(String).slice(0, LIMITS.maxTagsPerCard)
      : [],
    archived: false,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  const docRef = await addDoc(decksRef, payload);
  const snap = await getDoc(docRef);
  return normalizeDeck(snap);
}

/**
 * Atualiza campos de um deck existente do usuário.
 * @param {string} userId
 * @param {string} deckId
 * @param {{ name?: string, description?: string, tags?: string[] }} updates
 * @param {{ firestoreDb?: any }} [options]
 * @returns {Promise<void>}
 */
export async function updateDeck(userId, deckId, updates, options = {}) {
  if (!userId || !deckId) throw new Error('userId e deckId sao obrigatorios em updateDeck.');
  const firestoreDb = options.firestoreDb || db;
  const docRef = doc(firestoreDb, 'users', userId, 'decks', deckId);
  const snap = await getDoc(docRef);
  if (!snap.exists()) throw new Error('Deck nao encontrado.');
  if (snap.data().userId !== userId) throw new Error('Acesso negado: deck nao pertence ao usuario.');

  const patch = { updatedAt: serverTimestamp() };
  if (updates.name !== undefined) patch.name = String(updates.name).trim().slice(0, 160);
  if (updates.description !== undefined) {
    patch.description = String(updates.description).trim().slice(0, 2000);
  }
  if (updates.tags !== undefined) {
    patch.tags = Array.isArray(updates.tags)
      ? updates.tags.map(String).slice(0, LIMITS.maxTagsPerCard)
      : [];
  }
  if (updates.folderId !== undefined) patch.folderId = updates.folderId ? String(updates.folderId).slice(0, 160) : null;

  await updateDoc(docRef, patch);
}

/**
 * Arquiva (soft-delete) um deck do usuário.
 * Os cards e o histórico de revisões são preservados integralmente.
 * @param {string} userId
 * @param {string} deckId
 * @param {{ firestoreDb?: any }} [options]
 * @returns {Promise<void>}
 */
export async function archiveDeck(userId, deckId, options = {}) {
  if (!userId || !deckId) throw new Error('userId e deckId sao obrigatorios em archiveDeck.');
  const firestoreDb = options.firestoreDb || db;
  const docRef = doc(firestoreDb, 'users', userId, 'decks', deckId);
  const snap = await getDoc(docRef);
  if (!snap.exists()) throw new Error('Deck nao encontrado.');
  if (snap.data().userId !== userId) throw new Error('Acesso negado: deck nao pertence ao usuario.');
  await updateDoc(docRef, { archived: true, updatedAt: serverTimestamp() });
}

/**
 * Restaura um deck arquivado.
 * @param {string} userId
 * @param {string} deckId
 * @param {{ firestoreDb?: any }} [options]
 * @returns {Promise<void>}
 */
export async function unarchiveDeck(userId, deckId, options = {}) {
  if (!userId || !deckId) throw new Error('userId e deckId sao obrigatorios em unarchiveDeck.');
  const firestoreDb = options.firestoreDb || db;
  const docRef = doc(firestoreDb, 'users', userId, 'decks', deckId);
  const snap = await getDoc(docRef);
  if (!snap.exists()) throw new Error('Deck nao encontrado.');
  if (snap.data().userId !== userId) throw new Error('Acesso negado.');
  await updateDoc(docRef, { archived: false, updatedAt: serverTimestamp() });
}

// ─── Cards ────────────────────────────────────────────────────────────────────

/**
 * Obtém um card específico de um deck.
 * @param {string} userId
 * @param {string} deckId
 * @param {string} cardId
 * @param {{ firestoreDb?: any }} [options]
 * @returns {Promise<import('../../contracts/flashcards.js').Card | null>}
 */
export async function getCard(userId, deckId, cardId, options = {}) {
  if (!userId || !deckId || !cardId) {
    throw new Error('userId, deckId e cardId sao obrigatorios em getCard.');
  }
  const firestoreDb = options.firestoreDb || db;
  const snap = await getDoc(doc(firestoreDb, 'users', userId, 'decks', deckId, 'cards', cardId));
  if (!snap.exists()) return null;
  const card = normalizeCard(snap, deckId);
  if (card.userId !== userId) throw new Error('Acesso negado: card nao pertence ao usuario.');
  return card;
}

/**
 * Lista todos os cards de um deck.
 * @param {string} userId
 * @param {string} deckId
 * @param {{ firestoreDb?: any }} [options]
 * @returns {Promise<import('../../contracts/flashcards.js').Card[]>}
 */
export async function listCards(userId, deckId, options = {}) {
  if (!userId || !deckId) throw new Error('userId e deckId sao obrigatorios em listCards.');
  const firestoreDb = options.firestoreDb || db;
  const snap = await getDocs(query(
    collection(firestoreDb, 'users', userId, 'decks', deckId, 'cards'),
    orderBy('createdAt', 'asc'),
  ));
  return snap.docs.map((s) => normalizeCard(s, deckId));
}

/**
 * Cria um novo card em um deck.
 * O contador cardCount no Deck é mantido de forma backend-authoritative pelo trigger.
 * @param {string} userId
 * @param {string} deckId
 * @param {{
 *   front: string,
 *   back: string,
 *   tags?: string[],
 *   sourceType?: import('../../contracts/flashcards.js').CardSourceType,
 *   sourceId?: string | null,
 *   ankiMetadata?: import('../../contracts/flashcards.js').AnkiCardMetadata,
 *   schedulerState?: import('../../contracts/flashcards.js').OpaqueSchedulerState
 * }} cardData
 * @param {{ firestoreDb?: any }} [options]
 * @returns {Promise<import('../../contracts/flashcards.js').Card>}
 */
export async function createCard(userId, deckId, cardData, options = {}) {
  if (!userId || !deckId) throw new Error('userId e deckId sao obrigatorios em createCard.');
  if (!cardData?.front?.trim()) throw new Error('front e obrigatorio para criar um card.');
  if (!cardData?.back?.trim()) throw new Error('back e obrigatorio para criar um card.');
  if (!cardData?.folderId) throw new Error('folderId e obrigatorio para criar um card.');

  const callable = options.callable || httpsCallable(functions, 'createFlashcard');
  const result = await callable({
    deckId,
    card: {
      front: String(cardData.front).trim(),
      back: String(cardData.back).trim(),
      folderId: String(cardData.folderId).trim(),
      tags: Array.isArray(cardData.tags) ? cardData.tags.map(String).slice(0, LIMITS.maxTagsPerCard) : [],
    },
  });
  const card = result.data?.card;
  if (!card?.id) throw new Error('Backend nao retornou o card criado.');
  return {
    ...card,
    dueAt: toDate(card.dueAt) || new Date(),
    createdAt: toDate(card.createdAt) || new Date(),
    updatedAt: toDate(card.updatedAt) || new Date(),
  };
}

export async function createFolderFlashcard(userId, folderId, cardData, options = {}) {
  if (!userId || !folderId) throw new Error('userId e folderId sao obrigatorios.');
  if (!cardData?.front?.trim()) throw new Error('front e obrigatorio para criar um card.');
  if (!cardData?.back?.trim()) throw new Error('back e obrigatorio para criar um card.');
  const callable = options.callable || httpsCallable(functions, 'createFolderFlashcard');
  const result = await callable({
    folderId,
    card: {
      front: String(cardData.front).trim(),
      back: String(cardData.back).trim(),
      tags: Array.isArray(cardData.tags) ? cardData.tags.map(String).slice(0, LIMITS.maxTagsPerCard) : [],
    },
  });
  const card = result.data?.card;
  if (!card?.id) throw new Error('Backend nao retornou o card criado.');
  return { ...card, dueAt: toDate(card.dueAt) || new Date(), createdAt: toDate(card.createdAt) || new Date(), updatedAt: toDate(card.updatedAt) || new Date() };
}

/**
 * Atualiza campos de conteúdo de um card (front, back, tags).
 * Não altera schedulerState, dueAt, status, lapses, reps ou reviewVersion.
 * @param {string} userId
 * @param {string} deckId
 * @param {string} cardId
 * @param {{ front?: string, back?: string, tags?: string[] }} updates
 * @param {{ firestoreDb?: any }} [options]
 * @returns {Promise<void>}
 */
export async function updateCard(userId, deckId, cardId, updates, options = {}) {
  if (!userId || !deckId || !cardId) {
    throw new Error('userId, deckId e cardId sao obrigatorios em updateCard.');
  }
  const firestoreDb = options.firestoreDb || db;
  const cardRef = doc(firestoreDb, 'users', userId, 'decks', deckId, 'cards', cardId);
  const snap = await getDoc(cardRef);
  if (!snap.exists()) throw new Error('Card nao encontrado.');
  if (snap.data().userId !== userId) throw new Error('Acesso negado.');

  const patch = { updatedAt: serverTimestamp() };
  if (updates.front !== undefined) patch.front = String(updates.front).trim();
  if (updates.back !== undefined) patch.back = String(updates.back).trim();
  if (updates.tags !== undefined) {
    patch.tags = Array.isArray(updates.tags)
      ? updates.tags.map(String).slice(0, LIMITS.maxTagsPerCard)
      : [];
  }

  await updateDoc(cardRef, patch);
}

/**
 * Exclui um card de um deck.
 * Card e Deck.cardCount sao alterados na mesma transacao backend-authoritative.
 * @param {string} userId
 * @param {string} deckId
 * @param {string} cardId
 * @param {{ firestoreDb?: any }} [options]
 * @returns {Promise<void>}
 */
export async function deleteCard(userId, deckId, cardId, options = {}) {
  if (!userId || !deckId || !cardId) {
    throw new Error('userId, deckId e cardId sao obrigatorios em deleteCard.');
  }
  const callable = options.callable || httpsCallable(functions, 'deleteFlashcard');
  await callable({ deckId, cardId });
}

// ─── Consultas de cards devidos ───────────────────────────────────────────────

/**
 * Consulta os cards vencidos (dueAt <= targetDate) de um deck específico ou de todos os decks.
 * @param {string} userId
 * @param {string | null} [deckId]
 * @param {{ targetDate?: string | Date, limit?: number, firestoreDb?: any }} [options]
 * @returns {Promise<import('../../contracts/flashcards.js').Card[]>}
 */
export async function getDueCards(userId, deckId = null, options = {}) {
  if (!userId) throw new Error('userId e obrigatorio em getDueCards.');
  const firestoreDb = options.firestoreDb || db;

  const targetDate = options.targetDate
    ? (options.targetDate instanceof Date ? options.targetDate : new Date(options.targetDate))
    : new Date();

  const maxCards = Math.min(
    Math.max(1, Number(options.limit) || LIMITS.defaultMaxReviewsPerDay),
    LIMITS.defaultMaxReviewsPerDay,
  );

  const targetTs = Timestamp.fromDate(targetDate);

  if (deckId) {
    const cardsRef = collection(firestoreDb, 'users', userId, 'decks', deckId, 'cards');
    const q = query(
      cardsRef,
      where('dueAt', '<=', targetTs),
      orderBy('dueAt', 'asc'),
      firestoreLimit(maxCards),
    );
    const snap = await getDocs(q);
    return snap.docs.map((s) => normalizeCard(s, deckId));
  }

  // Sem deckId: busca em todos os decks ativos do usuário
  const decks = await listDecks(userId, { includeArchived: false, firestoreDb });
  const allDue = [];
  for (const deck of decks) {
    if (allDue.length >= maxCards) break;
    const remaining = maxCards - allDue.length;
    const cardsRef = collection(firestoreDb, 'users', userId, 'decks', deck.id, 'cards');
    const q = query(
      cardsRef,
      where('dueAt', '<=', targetTs),
      orderBy('dueAt', 'asc'),
      firestoreLimit(remaining),
    );
    const snap = await getDocs(q);
    allDue.push(...snap.docs.map((s) => normalizeCard(s, deck.id)));
  }
  return allDue;
}

/**
 * Consulta todos os cards para estudo em um conjunto de pastas (pasta e descendentes).
 * @param {string} userId
 * @param {string[]} folderIds
 * @param {{ onlyDue?: boolean, firestoreDb?: any }} [options]
 * @returns {Promise<import('../../contracts/flashcards.js').Card[]>}
 */
export async function getFolderStudyCards(userId, folderIds, options = {}) {
  if (!userId || !Array.isArray(folderIds) || !folderIds.length) return [];
  const targetFolderSet = new Set(folderIds);
  const userDecks = await listDecks(userId, { includeArchived: false, firestoreDb: options.firestoreDb });
  const matchingDecks = userDecks.filter((deck) => deck.folderId && targetFolderSet.has(deck.folderId));
  const allCards = [];
  const now = new Date();
  for (const deck of matchingDecks) {
    const cards = await listCards(userId, deck.id, { firestoreDb: options.firestoreDb });
    allCards.push(...cards);
  }
  const filtered = options.onlyDue
    ? allCards.filter((card) => !card.dueAt || card.dueAt <= now || card.status === 'new')
    : allCards;
  return filtered.sort((a, b) => (a.dueAt?.getTime?.() || 0) - (b.dueAt?.getTime?.() || 0));
}

/**
 * Consulta os cards novos (status == 'new') de um deck.
 * @param {string} userId
 * @param {string} deckId
 * @param {{ limit?: number, firestoreDb?: any }} [options]
 * @returns {Promise<import('../../contracts/flashcards.js').Card[]>}
 */
export async function getNewCards(userId, deckId, options = {}) {
  if (!userId || !deckId) throw new Error('userId e deckId sao obrigatorios em getNewCards.');
  const firestoreDb = options.firestoreDb || db;
  const maxNew = Math.min(
    Math.max(1, Number(options.limit) || LIMITS.defaultNewCardsPerDay),
    LIMITS.defaultNewCardsPerDay,
  );
  const cardsRef = collection(firestoreDb, 'users', userId, 'decks', deckId, 'cards');
  const q = query(
    cardsRef,
    where('status', '==', 'new'),
    orderBy('createdAt', 'asc'),
    firestoreLimit(maxNew),
  );
  const snap = await getDocs(q);
  return snap.docs.map((s) => normalizeCard(s, deckId));
}

// ─── Estatísticas de Deck ─────────────────────────────────────────────────────

/**
 * Retorna estatísticas de um deck.
 * @param {string} userId
 * @param {string} deckId
 * @param {{ firestoreDb?: any }} [options]
 * @returns {Promise<{ total: number, due: number, newCards: number, learning: number, review: number }>}
 */
export async function getDeckStats(userId, deckId, options = {}) {
  if (!userId || !deckId) throw new Error('userId e deckId sao obrigatorios em getDeckStats.');
  const firestoreDb = options.firestoreDb || db;

  const deckRef = doc(firestoreDb, 'users', userId, 'decks', deckId);
  const deckSnap = await getDoc(deckRef);
  if (!deckSnap.exists()) throw new Error('Deck nao encontrado.');
  if (deckSnap.data().userId !== userId) throw new Error('Acesso negado.');

  const cardsRef = collection(firestoreDb, 'users', userId, 'decks', deckId, 'cards');
  const now = Timestamp.now();

  const [dueSnap, newSnap, learningSnap, reviewSnap] = await Promise.all([
    getDocs(query(cardsRef, where('dueAt', '<=', now), firestoreLimit(200))),
    getDocs(query(cardsRef, where('status', '==', 'new'), firestoreLimit(200))),
    getDocs(query(cardsRef, where('status', '==', 'learning'), firestoreLimit(200))),
    getDocs(query(cardsRef, where('status', '==', 'review'), firestoreLimit(200))),
  ]);

  return {
    total: Number(deckSnap.data().cardCount || 0),
    due: dueSnap.size,
    newCards: newSnap.size,
    learning: learningSnap.size,
    review: reviewSnap.size,
  };
}

// ─── reviewCard (Transaction Atômica com reviewVersion e reviewRequestId) ───

/**
 * Executa a revisão de um flashcard com atomicidade via Firestore Transaction.
 *
 * @param {string} userId
 * @param {string} deckId
 * @param {string} cardId
 * @param {import('../../contracts/flashcards.js').QualityRating} rating
 * @param {{
 *   elapsedTimeMs?: number,
 *   now?: string | Date,
 *   expectedReviewVersion?: number,
 *   expectedSchedulerState?: import('../../contracts/flashcards.js').OpaqueSchedulerState,
 *   reviewRequestId?: string,
 *   firestoreDb?: any
 * }} [options]
 * @returns {Promise<{
 *   card: import('../../contracts/flashcards.js').Card,
 *   review: import('../../contracts/flashcards.js').CardReview,
 *   isLapse: boolean
 * }>}
 */
export async function reviewCard(userId, deckId, cardId, rating, options = {}) {
  if (!userId || !deckId || !cardId) {
    throw new Error('userId, deckId e cardId sao obrigatorios em reviewCard.');
  }
  if (!isValidQualityRating(rating)) {
    throw new Error(`Rating invalido em reviewCard: ${rating}`);
  }

  const now = options.now
    ? (options.now instanceof Date ? options.now : new Date(options.now))
    : new Date();

  if (Number.isNaN(now.getTime())) {
    throw new Error('Parametro "now" invalido em reviewCard.');
  }

  if (!Number.isInteger(options.expectedReviewVersion) || options.expectedReviewVersion < 0) {
    throw new Error('expectedReviewVersion e obrigatorio e deve ser inteiro nao negativo.');
  }
  if (!String(options.reviewRequestId || '').trim()) {
    throw new Error('reviewRequestId e obrigatorio para idempotencia.');
  }
  const callable = options.callable || httpsCallable(functions, 'reviewFlashcard');
  const result = await callable({
    deckId,
    cardId,
    rating,
    expectedReviewVersion: options.expectedReviewVersion,
    reviewRequestId: options.reviewRequestId,
    elapsedTimeMs: options.elapsedTimeMs,
  });
  const data = result.data || {};
  return {
    card: {
      ...data.card,
      dueAt: toDate(data.card?.dueAt) || now,
      createdAt: toDate(data.card?.createdAt) || now,
      updatedAt: toDate(data.card?.updatedAt) || now,
    },
    review: { ...data.review, reviewedAt: toDate(data.review?.reviewedAt) || now },
    isLapse: data.isLapse === true,
  };
}

// ─── Integração com Caderno de Erros ─────────────────────────────────────────

/**
 * Verifica se uma revisão deve gerar entrada no Caderno de Erros.
 * @param {string} rating
 * @param {boolean} isLapse
 * @returns {boolean}
 */
export function shouldCreateErrorBookEntry(rating, isLapse) {
  return rating === 'again' && isLapse === true;
}

/**
 * Constrói o payload descritivo para o Caderno de Erros.
 * @param {string} userId
 * @param {string} deckId
 * @param {import('../../contracts/flashcards.js').Card} card
 * @returns {{
 *   sourceType: 'flashcard',
 *   sourceId: string,
 *   deckId: string,
 *   isCorrectAttempt: boolean,
 *   preview: import('../../contracts/errorBook.js').ErrorBookPreview
 * }}
 */
export function buildFlashcardErrorBookPayload(userId, deckId, card) {
  if (!userId || !deckId || !card?.id) {
    throw new Error('userId, deckId e card sao obrigatorios em buildFlashcardErrorBookPayload.');
  }
  return {
    sourceType: 'flashcard',
    sourceId: card.id,
    deckId,
    isCorrectAttempt: false,
    preview: {
      title: String(card.front || '').slice(0, 200),
      front: String(card.front || ''),
      snippet: String(card.back || '').slice(0, 300),
    },
  };
}

/**
 * Invoca a sincronização backend-authoritative de ErrorBook para um flashcard.
 * @param {string} userId
 * @param {{ deckId: string, cardId: string, reviewId: string }} params
 * @returns {Promise<{ ok: boolean, entryId: string, duplicate: boolean }>}
 */
export async function syncFlashcardErrorBook(userId, { deckId, cardId, reviewId }) {
  if (!userId || !deckId || !cardId || !reviewId) {
    throw new Error('userId, deckId, cardId e reviewId sao obrigatorios em syncFlashcardErrorBook.');
  }
  const syncFn = httpsCallable(functions, 'syncFlashcardErrorBook');
  const result = await syncFn({ deckId, cardId, reviewId });
  return /** @type {{ ok: boolean, entryId: string, duplicate: boolean }} */ (result.data);
}
