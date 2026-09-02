/**
 * @fileoverview Serviço do Caderno de Erros.
 * Gerencia o registro, consulta e domínio de erros polimórficos (questões e flashcards).
 */

import {
  collection,
  count,
  doc,
  getAggregateFromServer,
  getDoc,
  getDocs,
  limit as firestoreLimit,
  query,
  serverTimestamp,
  sum,
  updateDoc,
  where,
} from 'firebase/firestore';
import { db } from '../../firebaseConfig.js';
import { DEFAULT_PRODUCT_LIMITS } from '../../config/productLimits.js';
import {
  buildErrorBookEntryId,
  isValidErrorBookSourceType,
} from '../../contracts/errorBook.js';

/**
 * Normaliza um documento de entrada do Caderno de Erros vindo do Firestore.
 * @param {import('firebase/firestore').DocumentSnapshot} docSnap
 * @returns {import('../../contracts/errorBook.js').ErrorBookEntry}
 */
function normalizeErrorBookDoc(docSnap) {
  const data = docSnap.data() || {};
  return {
    id: docSnap.id,
    userId: data.userId || '',
    sourceType: data.sourceType || 'question',
    sourceId: data.sourceId || '',
    questionScope: data.questionScope || null,
    deckId: data.deckId || null,
    disciplineId: data.disciplineId || null,
    subject: data.subject || null,
    wrongCount: Number(data.wrongCount || 0),
    correctCount: Number(data.correctCount || 0),
    lastAttemptAt: data.lastAttemptAt?.toDate?.() || (data.lastAttemptAt ? new Date(data.lastAttemptAt) : new Date()),
    userNotes: data.userNotes || null,
    mastered: Boolean(data.mastered),
    masteredAt: data.masteredAt?.toDate?.() || (data.masteredAt ? new Date(data.masteredAt) : null),
    preview: data.preview || {},
    createdAt: data.createdAt?.toDate?.() || (data.createdAt ? new Date(data.createdAt) : new Date()),
    updatedAt: data.updatedAt?.toDate?.() || (data.updatedAt ? new Date(data.updatedAt) : new Date()),
  };
}

/**
 * Consulta as entradas do Caderno de Erros do usuário com filtros opcionais.
 * @param {string} userId ID do usuário autenticado.
 * @param {{
 *   sourceType?: import('../../contracts/errorBook.js').ErrorBookSourceType,
 *   disciplineId?: string,
 *   mastered?: boolean,
 *   search?: string,
 *   limit?: number
 * }} [filter]
 * @returns {Promise<import('../../contracts/errorBook.js').ErrorBookEntry[]>}
 */
export async function getErrorBookEntries(userId, filter = {}) {
  if (!userId) throw new Error('userId e obrigatorio em getErrorBookEntries.');

  const collectionRef = collection(db, 'users', userId, 'error_book');
  const queryConstraints = [];

  if (filter.sourceType && isValidErrorBookSourceType(filter.sourceType)) {
    queryConstraints.push(where('sourceType', '==', filter.sourceType));
  }
  if (filter.disciplineId) {
    queryConstraints.push(where('disciplineId', '==', String(filter.disciplineId).trim()));
  }
  if (typeof filter.mastered === 'boolean') {
    queryConstraints.push(where('mastered', '==', filter.mastered));
  }

  const maxLimit = Math.min(
    Math.max(1, Math.floor(Number(filter.limit) || DEFAULT_PRODUCT_LIMITS.errorBook.maxEntriesPerPage)),
    DEFAULT_PRODUCT_LIMITS.errorBook.maxEntriesPerPage,
  );
  queryConstraints.push(firestoreLimit(maxLimit));

  const q = query(collectionRef, ...queryConstraints);
  const snapshot = await getDocs(q);

  let entries = snapshot.docs.map(normalizeErrorBookDoc);

  if (filter.search) {
    const term = String(filter.search).toLowerCase().trim();
    entries = entries.filter((entry) => {
      const statement = String(entry.preview?.statement || '').toLowerCase();
      const subject = String(entry.subject || '').toLowerCase();
      const notes = String(entry.userNotes || '').toLowerCase();
      return statement.includes(term) || subject.includes(term) || notes.includes(term);
    });
  }

  return entries;
}

/**
 * Consulta uma entrada individual do Caderno de Erros por ID.
 * @param {string} userId
 * @param {string} entryId
 * @returns {Promise<import('../../contracts/errorBook.js').ErrorBookEntry | null>}
 */
export async function getErrorBookEntryById(userId, entryId) {
  if (!userId || !entryId) throw new Error('userId e entryId sao obrigatorios em getErrorBookEntryById.');

  const docRef = doc(db, 'users', userId, 'error_book', entryId);
  const snap = await getDoc(docRef);

  if (!snap.exists()) return null;
  return normalizeErrorBookDoc(snap);
}

/**
 * Marca ou desmarca uma entrada como dominada/superada pelo estudante.
 * @param {string} userId
 * @param {string} entryId
 * @param {boolean} [mastered=true]
 * @returns {Promise<void>}
 */
export async function markErrorBookEntryMastered(userId, entryId, mastered = true) {
  if (!userId || !entryId) throw new Error('userId e entryId sao obrigatorios em markErrorBookEntryMastered.');

  const docRef = doc(db, 'users', userId, 'error_book', entryId);
  await updateDoc(docRef, {
    mastered: Boolean(mastered),
    masteredAt: mastered ? serverTimestamp() : null,
    updatedAt: serverTimestamp(),
  });
}

/**
 * Atualiza anotações pessoais do estudante sobre determinado erro.
 * @param {string} userId
 * @param {string} entryId
 * @param {string} notes
 * @returns {Promise<void>}
 */
export async function updateErrorBookUserNotes(userId, entryId, notes) {
  if (!userId || !entryId) throw new Error('userId e entryId sao obrigatorios em updateErrorBookUserNotes.');

  const docRef = doc(db, 'users', userId, 'error_book', entryId);
  const userNotes = String(notes || '').trim() || null;
  if (userNotes && userNotes.length > DEFAULT_PRODUCT_LIMITS.errorBook.maxUserNotesChars) {
    throw new Error(`As anotacoes podem ter no maximo ${DEFAULT_PRODUCT_LIMITS.errorBook.maxUserNotesChars} caracteres.`);
  }
  await updateDoc(docRef, {
    userNotes,
    updatedAt: serverTimestamp(),
  });
}

/**
 * Gera ou retorna o modelo inicial de uma entrada de Caderno de Erros.
 * @param {string} userId
 * @param {Parameters<typeof buildErrorBookEntryId>[0] & {
 *   disciplineId?: string | null,
 *   subject?: string | null,
 *   isCorrectAttempt?: boolean,
 *   preview?: import('../../contracts/errorBook.js').ErrorBookPreview,
 *   userNotes?: string | null
 * }} entryData
 * @returns {import('../../contracts/errorBook.js').ErrorBookEntry}
 */
export function buildInitialErrorBookEntry(userId, entryData) {
  if (!userId || !entryData?.sourceId || !entryData?.sourceType) {
    throw new Error('userId, sourceId e sourceType sao obrigatorios em buildInitialErrorBookEntry.');
  }
  if (!isValidErrorBookSourceType(entryData.sourceType)) {
    throw new Error(`sourceType invalido no caderno de erros: ${entryData.sourceType}`);
  }

  const entryId = buildErrorBookEntryId(entryData);
  const now = new Date();

  return {
    id: entryId,
    userId,
    sourceType: entryData.sourceType,
    sourceId: entryData.sourceId,
    questionScope: entryData.sourceType === 'question' ? (entryData.questionScope || 'global') : null,
    deckId: entryData.sourceType === 'flashcard' ? (entryData.deckId || null) : null,
    disciplineId: entryData.disciplineId || null,
    subject: entryData.subject || null,
    wrongCount: entryData.isCorrectAttempt ? 0 : 1,
    correctCount: entryData.isCorrectAttempt ? 1 : 0,
    lastAttemptAt: now,
    userNotes: entryData.userNotes || null,
    mastered: false,
    masteredAt: null,
    preview: entryData.preview || {},
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Consulta métricas agregadas do Caderno de Erros do usuário.
 * @param {string} userId
 * @returns {Promise<{
 *   totalEntries: number,
 *   masteredEntries: number,
 *   pendingEntries: number,
 *   masteryRate: number,
 *   totalWrongAttempts: number,
 *   totalCorrectAttempts: number
 * }>}
 */
export async function getErrorBookSummaryStats(userId) {
  if (!userId) throw new Error('userId e obrigatorio em getErrorBookSummaryStats.');

  const entriesRef = collection(db, 'users', userId, 'error_book');
  const [totalSnapshot, wrongSnapshot, correctSnapshot, masteredSnapshot] = await Promise.all([
    getAggregateFromServer(entriesRef, {
      totalEntries: count(),
    }),
    getAggregateFromServer(entriesRef, {
      totalWrongAttempts: sum('wrongCount'),
    }),
    getAggregateFromServer(entriesRef, {
      totalCorrectAttempts: sum('correctCount'),
    }),
    getAggregateFromServer(query(entriesRef, where('mastered', '==', true)), {
      masteredEntries: count(),
    }),
  ]);
  const totalEntries = Number(totalSnapshot.data().totalEntries || 0);
  const masteredEntries = Number(masteredSnapshot.data().masteredEntries || 0);
  const pendingEntries = totalEntries - masteredEntries;
  const masteryRate = totalEntries > 0 ? (masteredEntries / totalEntries) * 100 : 0;
  const totalWrongAttempts = Number(wrongSnapshot.data().totalWrongAttempts || 0);
  const totalCorrectAttempts = Number(correctSnapshot.data().totalCorrectAttempts || 0);

  return {
    totalEntries,
    masteredEntries,
    pendingEntries,
    masteryRate,
    totalWrongAttempts,
    totalCorrectAttempts,
  };
}
