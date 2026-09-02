/**
 * @fileoverview Servico backend-authoritative de Flashcards.
 * Implementa:
 *   1. Sincronizacao/reconciliacao idempotente de ErrorBook a partir de CardReviews
 *   2. Sincronizacao backend-authoritative de cardCount em Decks
 *   3. Aprovacao atomica e idempotente de GeneratedItem para Card
 */

const { HttpsError } = require('firebase-functions/v2/https');
const admin = require('firebase-admin');
const crypto = require('crypto');
const { createInitialState, schedule } = require('./scheduler');
const { getProductLimits } = require('../shared/productLimits');

const errorBookIdentityModule = import('../shared/errorBookIdentity.mjs');

function safeString(value, label, maxLength = 160) {
  const str = String(value || '').trim();
  if (!str) throw new HttpsError('invalid-argument', `${label} e obrigatorio.`);
  if (str.length > maxLength) throw new HttpsError('invalid-argument', `${label} excede o limite de ${maxLength} caracteres.`);
  return str;
}

/**
 * Sincroniza uma revisao classificada como lapse com o Caderno de Erros.
 * Valida ownership, integridade e parametros rigorosamente.
 *
 * @param {object} params
 * @param {string} params.uid UID autenticado.
 * @param {string} params.deckId ID do deck.
 * @param {string} params.cardId ID do card.
 * @param {string} params.reviewId ID do card_review.
 * @returns {Promise<{ ok: boolean, entryId: string, duplicate: boolean }>}
 */
async function syncFlashcardErrorBook({ uid, deckId, cardId, reviewId }) {
  if (!uid) throw new HttpsError('unauthenticated', 'Usuario nao autenticado.');
  const safeDeckId = safeString(deckId, 'deckId', 160);
  const safeCardId = safeString(cardId, 'cardId', 160);
  const safeReviewId = safeString(reviewId, 'reviewId', 200);

  const db = admin.firestore();
  const userRef = db.collection('users').doc(uid);
  const reviewRef = userRef.collection('card_reviews').doc(safeReviewId);
  const cardRef = userRef.collection('decks').doc(safeDeckId).collection('cards').doc(safeCardId);

  const { buildErrorBookEntryId } = await errorBookIdentityModule;
  const entryId = buildErrorBookEntryId({
    sourceType: 'flashcard',
    deckId: safeDeckId,
    sourceId: safeCardId,
  });
  const errorEntryRef = userRef.collection('error_book').doc(entryId);

  return db.runTransaction(async (transaction) => {
    const [reviewSnap, cardSnap, errorEntrySnap] = await Promise.all([
      transaction.get(reviewRef),
      transaction.get(cardRef),
      transaction.get(errorEntryRef),
    ]);

    if (!reviewSnap.exists) {
      throw new HttpsError('not-found', 'Revisao nao encontrada.');
    }

    const reviewData = reviewSnap.data() || {};
    if (reviewData.userId !== uid) {
      throw new HttpsError('permission-denied', 'Acesso negado a revisao informada.');
    }

    // Validacao estrita dos parametros recebidos vs documento persistido
    if (reviewData.deckId !== safeDeckId) {
      throw new HttpsError('invalid-argument', 'deckId diverge do registro da revisao.');
    }
    if (reviewData.cardId !== safeCardId) {
      throw new HttpsError('invalid-argument', 'cardId diverge do registro da revisao.');
    }

    // Regra de dominio: somente rating 'again' com lapse real
    const isAgain = reviewData.rating === 'again';
    const isLapse = reviewData.isLapse === true
      || (reviewData.previousState?.data?.repetition >= 2);
    if (!isAgain || !isLapse) {
      throw new HttpsError('failed-precondition', 'Apenas revisoes com classificacao "again" e lapse real geram entrada no Caderno de Erros.');
    }

    // Idempotencia: se a revisao ja foi sincronizada
    if (reviewData.errorBookSyncStatus === 'synced'
      || (errorEntrySnap.exists && errorEntrySnap.data()?.lastSyncedReviewId === safeReviewId)) {
      return { ok: true, entryId, duplicate: true };
    }

    if (!cardSnap.exists) {
      throw new HttpsError('not-found', 'Card nao encontrado no deck informado.');
    }

    const cardData = cardSnap.data() || {};
    const serverTimestamp = admin.firestore.FieldValue.serverTimestamp();
    const frontText = String(cardData.front || '');
    const backText = String(cardData.back || '');

    transaction.set(errorEntryRef, {
      userId: uid,
      sourceType: 'flashcard',
      sourceId: safeCardId,
      questionScope: null,
      deckId: safeDeckId,
      disciplineId: null,
      subject: null,
      wrongCount: admin.firestore.FieldValue.increment(1),
      correctCount: admin.firestore.FieldValue.increment(0),
      lastAttemptAt: serverTimestamp,
      userNotes: errorEntrySnap.exists ? errorEntrySnap.data().userNotes || null : null,
      mastered: false,
      masteredAt: null,
      preview: {
        title: frontText.slice(0, 200),
        front: frontText,
        snippet: backText.slice(0, 300),
      },
      lastSyncedReviewId: safeReviewId,
      ...(!errorEntrySnap.exists ? { createdAt: serverTimestamp } : {}),
      updatedAt: serverTimestamp,
    }, { merge: true });

    transaction.update(reviewRef, {
      errorBookSyncStatus: 'synced',
      errorBookSyncedAt: serverTimestamp,
      errorBookEntryId: entryId,
    });

    return { ok: true, entryId, duplicate: false };
  });
}

/**
 * Reconciliador acionado por trigger Firestore quando um CardReview e gravado.
 * Garante convergencia mesmo se o usuario fechar a aba do navegador antes da chamada client-side.
 *
 * @param {import('firebase-functions/v2/firestore').FirestoreEvent} event
 * @returns {Promise<object | null>}
 */
async function reconcileCardReviewErrorBook(event) {
  const uid = event.params.uid;
  const reviewId = event.params.reviewId;
  if (!uid || !reviewId) return null;

  const afterSnapshot = event.data?.after;
  if (!afterSnapshot?.exists) return null;

  const reviewData = afterSnapshot.data() || {};
  if (reviewData.errorBookSyncStatus === 'pending'
    && reviewData.rating === 'again'
    && (reviewData.isLapse === true || reviewData.previousState?.data?.repetition >= 2)) {
    try {
      return await syncFlashcardErrorBook({
        uid,
        deckId: reviewData.deckId,
        cardId: reviewData.cardId,
        reviewId,
      });
    } catch (err) {
      console.error(`[Flashcards] Falha na reconciliacao em background do CardReview ${reviewId}:`, err);
      return null;
    }
  }

  return null;
}

function normalizeCardForTransport(cardId, data) {
  const toIso = (value) => value?.toDate?.().toISOString?.() || value?.toISOString?.() || null;
  return {
    id: cardId,
    deckId: data.deckId,
    folderId: data.folderId || null,
    userId: data.userId,
    front: data.front,
    back: data.back,
    tags: data.tags || [],
    status: data.status,
    dueAt: toIso(data.dueAt),
    lapses: Number(data.lapses || 0),
    reps: Number(data.reps || 0),
    reviewVersion: Number(data.reviewVersion || 0),
    schedulerState: data.schedulerState,
    sourceType: data.sourceType || 'manual',
    sourceId: data.sourceId || null,
    createdAt: toIso(data.createdAt),
    updatedAt: toIso(data.updatedAt),
  };
}

async function createCard({ uid, deckId, card }) {
  if (!uid) throw new HttpsError('unauthenticated', 'Usuario nao autenticado.');
  const safeDeckId = safeString(deckId, 'deckId', 160);
  const front = safeString(card?.front, 'front', 20000);
  const back = safeString(card?.back, 'back', 20000);
  const folderId = safeString(card?.folderId, 'folderId', 160);
  const db = admin.firestore();
  const limits = await getProductLimits(db);
  const deckRef = db.collection('users').doc(uid).collection('decks').doc(safeDeckId);
  const folderRef = db.collection('users').doc(uid).collection('study_folders').doc(folderId);
  const cardRef = deckRef.collection('cards').doc();
  const tags = Array.isArray(card?.tags) ? card.tags.map((tag) => String(tag).slice(0, 60)).slice(0, limits.flashcards.maxTagsPerCard) : [];

  const result = await db.runTransaction(async (transaction) => {
    const [deckSnap, folderSnap] = await Promise.all([transaction.get(deckRef), transaction.get(folderRef)]);
    if (!deckSnap.exists || deckSnap.data()?.userId !== uid) throw new HttpsError('not-found', 'Deck nao encontrado.');
    if (!folderSnap.exists || folderSnap.data()?.userId !== uid || folderSnap.data()?.archived === true) {
      throw new HttpsError('not-found', 'Pasta de Estudos nao encontrada.');
    }
    const deck = deckSnap.data() || {};
    if (deck.folderId !== folderId) throw new HttpsError('failed-precondition', 'O Deck nao pertence a Pasta de Estudos informada.');
    const cardCount = Number(deck.cardCount || 0);
    if (deck.archived === true) throw new HttpsError('failed-precondition', 'Deck arquivado nao aceita novos cards.');
    if (cardCount >= limits.flashcards.maxCardsPerDeck) throw new HttpsError('resource-exhausted', 'Limite de cards do deck atingido.');
    const now = admin.firestore.Timestamp.now();
    const payload = {
      userId: uid, deckId: safeDeckId, folderId, front, back, tags,
      status: 'new', dueAt: now, lapses: 0, reps: 0, reviewVersion: 0,
      schedulerState: createInitialState(limits.scheduler), sourceType: 'manual', sourceId: null,
      createdAt: now, updatedAt: now,
    };
    transaction.create(cardRef, payload);
    transaction.update(deckRef, {
      cardCount: cardCount + 1,
      cardMutationVersion: Number(deck.cardMutationVersion || 0) + 1,
      updatedAt: now,
    });
    return payload;
  });
  return { ok: true, card: normalizeCardForTransport(cardRef.id, result) };
}

async function createFolderCard({ uid, folderId, card }) {
  if (!uid) throw new HttpsError('unauthenticated', 'Usuario nao autenticado.');
  const safeFolderId = safeString(folderId, 'folderId', 160);
  const db = admin.firestore();
  const userRef = db.collection('users').doc(uid);
  const folderRef = userRef.collection('study_folders').doc(safeFolderId);
  const folder = await folderRef.get();
  if (!folder.exists || folder.data()?.userId !== uid || folder.data()?.archived === true) {
    throw new HttpsError('not-found', 'Pasta de Estudos nao encontrada.');
  }
  const decks = await userRef.collection('decks').where('folderId', '==', safeFolderId).get();
  let deck = decks.docs.find((snapshot) => snapshot.data()?.userId === uid && snapshot.data()?.archived !== true);
  if (!deck) {
    const deckId = `folderdeck_${crypto.createHash('sha256').update(safeFolderId).digest('base64url').slice(0, 28)}`;
    const deckRef = userRef.collection('decks').doc(deckId);
    await db.runTransaction(async (transaction) => {
      const [currentFolder, currentDeck] = await Promise.all([transaction.get(folderRef), transaction.get(deckRef)]);
      if (!currentFolder.exists || currentFolder.data()?.userId !== uid || currentFolder.data()?.archived === true) {
        throw new HttpsError('failed-precondition', 'Pasta indisponivel.');
      }
      if (!currentDeck.exists) transaction.create(deckRef, {
        userId: uid,
        folderId: safeFolderId,
        name: String(currentFolder.data()?.name || 'Flashcards').slice(0, 160),
        description: 'Deck interno da Pasta de Estudos',
        cardCount: 0,
        cardMutationVersion: 0,
        tags: [],
        archived: false,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    });
    deck = await deckRef.get();
  }
  return createCard({ uid, deckId: deck.id, card: { ...card, folderId: safeFolderId } });
}

async function deleteCard({ uid, deckId, cardId }) {
  if (!uid) throw new HttpsError('unauthenticated', 'Usuario nao autenticado.');
  const safeDeckId = safeString(deckId, 'deckId', 160);
  const safeCardId = safeString(cardId, 'cardId', 160);
  const db = admin.firestore();
  const deckRef = db.collection('users').doc(uid).collection('decks').doc(safeDeckId);
  const cardRef = deckRef.collection('cards').doc(safeCardId);
  return db.runTransaction(async (transaction) => {
    const [deckSnap, cardSnap] = await Promise.all([transaction.get(deckRef), transaction.get(cardRef)]);
    if (!deckSnap.exists || deckSnap.data()?.userId !== uid) throw new HttpsError('not-found', 'Deck nao encontrado.');
    if (!cardSnap.exists) return { ok: true, deleted: true, duplicate: true };
    if (cardSnap.data()?.userId !== uid) throw new HttpsError('permission-denied', 'Card nao pertence ao usuario.');
    transaction.delete(cardRef);
    transaction.update(deckRef, {
      cardCount: Math.max(0, Number(deckSnap.data()?.cardCount || 0) - 1),
      cardMutationVersion: Number(deckSnap.data()?.cardMutationVersion || 0) + 1,
      updatedAt: admin.firestore.Timestamp.now(),
    });
    return { ok: true, deleted: true, duplicate: false };
  });
}

async function reviewCard({ uid, deckId, cardId, rating, expectedReviewVersion, reviewRequestId, elapsedTimeMs }) {
  if (!uid) throw new HttpsError('unauthenticated', 'Usuario nao autenticado.');
  const safeDeckId = safeString(deckId, 'deckId', 160);
  const safeCardId = safeString(cardId, 'cardId', 160);
  const safeRequestId = safeString(reviewRequestId, 'reviewRequestId', 160);
  if (!['again', 'hard', 'good', 'easy'].includes(rating)) throw new HttpsError('invalid-argument', 'rating invalido.');
  if (!Number.isInteger(expectedReviewVersion) || expectedReviewVersion < 0) throw new HttpsError('invalid-argument', 'expectedReviewVersion invalido.');
  const safeElapsed = elapsedTimeMs == null ? null : Math.max(0, Math.min(Number(elapsedTimeMs) || 0, 24 * 60 * 60 * 1000));
  const db = admin.firestore();
  const limits = await getProductLimits(db);
  const userRef = db.collection('users').doc(uid);
  const cardRef = userRef.collection('decks').doc(safeDeckId).collection('cards').doc(safeCardId);
  const reviewId = `rev_${safeCardId.replace(/[^A-Za-z0-9_-]/g, '_').slice(0, 100)}_${safeRequestId.replace(/[^A-Za-z0-9_-]/g, '_').slice(0, 100)}`;
  const reviewRef = userRef.collection('card_reviews').doc(reviewId);

  return db.runTransaction(async (transaction) => {
    const [cardSnap, reviewSnap] = await Promise.all([transaction.get(cardRef), transaction.get(reviewRef)]);
    if (!cardSnap.exists) throw new HttpsError('not-found', 'Card nao encontrado.');
    const card = cardSnap.data() || {};
    if (card.userId !== uid || card.deckId !== safeDeckId) throw new HttpsError('permission-denied', 'Card nao pertence ao usuario/deck informado.');
    if (reviewSnap.exists) {
      const existingReview = reviewSnap.data() || {};
      return {
        ok: true, duplicate: true,
        card: normalizeCardForTransport(safeCardId, card),
        review: { id: reviewId, ...existingReview, reviewedAt: existingReview.reviewedAt?.toDate?.().toISOString?.() || null },
        isLapse: existingReview.isLapse === true,
      };
    }
    const currentVersion = Number.isInteger(card.reviewVersion) ? card.reviewVersion : 0;
    if (currentVersion !== expectedReviewVersion) throw new HttpsError('aborted', 'Stale state: recarregue o card antes de continuar.');
    const previousState = card.schedulerState || createInitialState(limits.scheduler);
    const now = new Date();
    const outcome = schedule(previousState, rating, { now });
    const nextVersion = currentVersion + 1;
    const nextCard = {
      ...card,
      schedulerState: outcome.nextState,
      status: outcome.status,
      dueAt: admin.firestore.Timestamp.fromDate(outcome.dueAt),
      lapses: outcome.isLapse ? Number(card.lapses || 0) + 1 : Number(card.lapses || 0),
      reps: outcome.isLapse ? 0 : Number(card.reps || 0) + 1,
      reviewVersion: nextVersion,
      updatedAt: admin.firestore.Timestamp.fromDate(now),
    };
    const review = {
      userId: uid, cardId: safeCardId, deckId: safeDeckId, rating,
      scheduledDays: outcome.intervalDays, previousState, nextState: outcome.nextState,
      reviewRequestId: safeRequestId, reviewVersion: nextVersion, isLapse: outcome.isLapse,
      reviewedAt: admin.firestore.Timestamp.fromDate(now),
      ...(safeElapsed == null ? {} : { elapsedTimeMs: safeElapsed }),
      ...(outcome.isLapse && rating === 'again' ? { errorBookSyncStatus: 'pending' } : {}),
    };
    transaction.update(cardRef, {
      schedulerState: nextCard.schedulerState, status: nextCard.status, dueAt: nextCard.dueAt,
      lapses: nextCard.lapses, reps: nextCard.reps, reviewVersion: nextVersion, updatedAt: nextCard.updatedAt,
    });
    transaction.create(reviewRef, review);
    return {
      ok: true, duplicate: false, card: normalizeCardForTransport(safeCardId, nextCard),
      review: { ...review, id: reviewId, reviewedAt: now.toISOString() }, isLapse: outcome.isLapse,
    };
  });
}

/**
 * Aprova um GeneratedItem de flashcard de forma atomica e backend-authoritative.
 *
 * @param {object} params
 * @param {string} params.uid UID autenticado.
 * @param {string} params.generatedItemId ID do GeneratedItem.
 * @param {string} params.targetDeckId ID do Deck de destino.
 * @returns {Promise<{ ok: boolean, cardId: string, duplicate: boolean }>}
 */
async function materializeGeneratedFlashcard({ uid, generatedItemId, targetDeckId, firstRating, reviewRequestId }) {
  if (!uid) throw new HttpsError('unauthenticated', 'Usuario nao autenticado.');
  const safeItemId = safeString(generatedItemId, 'generatedItemId', 160);
  const safeDeckId = safeString(targetDeckId, 'targetDeckId', 160);
  if (!['again', 'hard', 'good', 'easy'].includes(firstRating)) throw new HttpsError('invalid-argument', 'firstRating e obrigatorio para materializar um GeneratedItem.');
  safeString(reviewRequestId, 'reviewRequestId', 160);

  const db = admin.firestore();
  const limits = await getProductLimits(db);
  const userRef = db.collection('users').doc(uid);
  const itemRef = userRef.collection('generated_items').doc(safeItemId);
  const deckRef = userRef.collection('decks').doc(safeDeckId);

  // Identidade deterministica de Card para aprovacao idempotente
  const deterministicCardId = `gen_${safeItemId.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 100)}`;
  const cardRef = deckRef.collection('cards').doc(deterministicCardId);

  return db.runTransaction(async (transaction) => {
    const itemPreflight = await transaction.get(itemRef);
    if (!itemPreflight.exists) throw new HttpsError('not-found', 'GeneratedItem nao encontrado.');
    const sourceId = String(itemPreflight.data()?.sourceId || '');
    if (!/^[A-Za-z0-9_-]{1,160}$/.test(sourceId)) throw new HttpsError('failed-precondition', 'GeneratedItem sem StudySource autoritativa.');
    const sourceRef = userRef.collection('study_sources').doc(sourceId);
    const [deckSnap, cardSnap, sourceSnap] = await Promise.all([
      transaction.get(deckRef),
      transaction.get(cardRef),
      transaction.get(sourceRef),
    ]);
    const itemSnap = itemPreflight;
    const itemData = itemSnap.data() || {};
    if (itemData.userId !== uid) {
      throw new HttpsError('permission-denied', 'GeneratedItem nao pertence ao usuario autenticado.');
    }
    if (itemData.type !== 'flashcard') {
      throw new HttpsError('invalid-argument', 'GeneratedItem nao e do tipo flashcard.');
    }
    if (!sourceSnap.exists || sourceSnap.data()?.userId !== uid || sourceSnap.data()?.status !== 'ready') {
      throw new HttpsError('failed-precondition', 'StudySource do GeneratedItem nao esta pronta.');
    }
    if (itemData.status === 'rejected') {
      throw new HttpsError('failed-precondition', 'GeneratedItem foi rejeitado e nao pode ser aprovado.');
    }

    if (!deckSnap.exists) {
      throw new HttpsError('not-found', 'Deck de destino nao encontrado.');
    }
    const deckData = deckSnap.data() || {};
    if (deckData.userId !== uid) {
      throw new HttpsError('permission-denied', 'Deck nao pertence ao usuario autenticado.');
    }
    if (deckData.archived === true) {
      throw new HttpsError('failed-precondition', 'Nao e possivel adicionar cards a um deck arquivado.');
    }

    // Idempotencia: se ja aprovado ou card deterministico ja existe
    if (itemData.status === 'materialized' || itemData.status === 'approved' || cardSnap.exists) {
      const approvedCardId = itemData.content?.materializedCardId || itemData.content?.approvedCardId || deterministicCardId;
      if (!['materialized', 'approved'].includes(itemData.status)) {
        transaction.update(itemRef, {
          status: 'materialized',
          'content.materializedCardId': approvedCardId,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      }
      return { ok: true, cardId: approvedCardId, duplicate: true };
    }

    const content = itemData.content || {};
    const front = String(content.front || '').trim();
    const back = String(content.back || '').trim();
    if (!front || !back) {
      throw new HttpsError('invalid-argument', 'GeneratedItem nao possui front e back validos.');
    }

    const serverTimestamp = admin.firestore.FieldValue.serverTimestamp();
    const now = admin.firestore.Timestamp.now();

    transaction.set(cardRef, {
      userId: uid,
      deckId: safeDeckId,
      front,
      back,
      tags: Array.isArray(itemData.tags) ? itemData.tags : [],
      status: 'new',
      dueAt: now,
      lapses: 0,
      reps: 0,
      reviewVersion: 0,
      schedulerState: createInitialState(limits.scheduler),
      sourceType: 'ai',
      sourceId,
      createdAt: serverTimestamp,
      updatedAt: serverTimestamp,
    });

    transaction.update(deckRef, {
      cardCount: Number(deckData.cardCount || 0) + 1,
      cardMutationVersion: Number(deckData.cardMutationVersion || 0) + 1,
      updatedAt: serverTimestamp,
    });

    transaction.update(itemRef, {
      status: 'materialized',
      content: {
        ...content,
        materializedCardId: deterministicCardId,
        targetDeckId: safeDeckId,
        firstRating,
        reviewRequestId,
      },
      updatedAt: serverTimestamp,
    });

    return { ok: true, cardId: deterministicCardId, duplicate: false };
  });
}

module.exports = {
  createCard,
  createFolderCard,
  deleteCard,
  reviewCard,
  syncFlashcardErrorBook,
  reconcileCardReviewErrorBook,
  materializeGeneratedFlashcard,
};
