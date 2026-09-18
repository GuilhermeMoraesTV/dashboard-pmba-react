/**
 * @fileoverview Serviço para criação, votação, encerramento e consulta de Enquetes via Broadcast.
 */

import {
  collection,
  collectionGroup,
  doc,
  getDoc,
  getDocs,
  increment,
  limit,
  orderBy,
  query,
  serverTimestamp,
  startAfter,
  Timestamp,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { validatePollDraft } from '../contracts/broadcastPoll.js';

/**
 * Publica uma nova enquete e inicializa atomicamente seu documento de contagem.
 * @param {Object} params
 * @param {import('firebase/firestore').Firestore} params.db
 * @param {Object} [params.actor]
 * @param {string} params.title
 * @param {string} [params.description]
 * @param {Array<{ id?: string, text: string }|string>} params.options
 * @param {any} [params.closesAt]
 * @param {'all'|'segment'|'test'} [params.audienceMode]
 * @param {string|null} [params.targetUid]
 * @param {string[]|null} [params.targetUserIds]
 * @param {number|null} [params.audienceCount]
 * @param {string|null} [params.segmentId]
 * @param {string|null} [params.segmentLabel]
 * @param {Object|null} [params.segmentFilters]
 * @returns {Promise<{ broadcastId: string, pollId: string }>}
 */
export async function createBroadcastPoll({
  db,
  title,
  description = null,
  options = [],
  closesAt = null,
  audienceMode = 'all',
  targetUid = null,
  targetUserIds = null,
  audienceCount = null,
  segmentId = null,
  segmentLabel = null,
  segmentFilters = null,
}) {
  const validation = validatePollDraft({ title, description, options, closesAt });
  if (!validation.isValid) {
    throw new Error(validation.errors.join(' '));
  }

  const broadcastRef = doc(collection(db, 'system_broadcasts'));
  const pollId = broadcastRef.id;
  const resultsRef = doc(db, 'system_broadcast_poll_results', pollId);

  const optionIds = validation.normalizedOptions.map((opt) => opt.id);
  const initialOptionCounts = {};
  optionIds.forEach((id) => {
    initialOptionCounts[id] = 0;
  });

  const closesAtTimestamp = validation.closesAtMillis
    ? Timestamp.fromMillis(validation.closesAtMillis)
    : null;

  const resolvedAudienceMode = targetUid ? 'test' : (targetUserIds?.length ? 'segment' : 'all');
  const resolvedAudienceCount = resolvedAudienceMode === 'test'
    ? 1
    : (Number(audienceCount) || targetUserIds?.length || null);

  const batch = writeBatch(db);

  batch.set(broadcastRef, {
    contentType: 'poll',
    title: validation.normalizedOptions.length ? title.trim() : '',
    message: description?.trim() || null,
    description: description?.trim() || null,
    audienceMode: resolvedAudienceMode,
    targetUid: targetUid || null,
    targetUserIds: targetUserIds || null,
    audienceCount: resolvedAudienceCount,
    active: true,
    timestamp: serverTimestamp(),
    type: 'admin_push',
    category: 'comunicado',
    segmentId: resolvedAudienceMode === 'segment' ? segmentId : null,
    segmentLabel: resolvedAudienceMode === 'segment' ? segmentLabel : null,
    segmentFilters: resolvedAudienceMode === 'segment' ? segmentFilters : null,
    poll: {
      options: validation.normalizedOptions,
      optionIds,
      status: 'open',
      closesAt: closesAtTimestamp,
      closedAt: null,
      description: description?.trim() || null,
    },
  });

  batch.set(resultsRef, {
    pollId,
    responseCount: 0,
    optionCounts: initialOptionCounts,
    createdAt: serverTimestamp(),
  });

  await batch.commit();

  return { broadcastId: pollId, pollId };
}

/**
 * Submete o voto de um usuário em um único batch atômico no Firestore.
 * Suporta tanto chamada com objeto `{ db, pollId, uid, optionId }` quanto posicional `(db, uid, pollId, optionId)`.
 * @param {any} dbOrParams
 * @param {string} [uidOrPollId]
 * @param {string} [pollIdOrUid]
 * @param {string} [optionIdParam]
 * @returns {Promise<{ success: boolean, alreadyVoted?: boolean, answer?: Object }>}
 */
export async function submitPollVote(dbOrParams, uidOrPollId, pollIdOrUid, optionIdParam) {
  let db, pollId, uid, optionId;

  if (dbOrParams && typeof dbOrParams === 'object' && !dbOrParams.type && (dbOrParams.pollId || dbOrParams.optionId)) {
    db = dbOrParams.db;
    pollId = dbOrParams.pollId;
    uid = dbOrParams.uid;
    optionId = dbOrParams.optionId;
  } else {
    db = dbOrParams;
    uid = uidOrPollId;
    pollId = pollIdOrUid;
    optionId = optionIdParam;
  }

  if (!db || !pollId || !uid || !optionId) {
    throw new Error('Parâmetros obrigatórios de votação incompletos.');
  }

  const cleanOptionId = String(optionId).trim();
  const answerRef = doc(db, 'users', uid, 'broadcast_poll_answers', pollId);
  const resultsRef = doc(db, 'system_broadcast_poll_results', pollId);

  const batch = writeBatch(db);

  const answerPayload = {
    pollId,
    uid,
    optionId: cleanOptionId,
    respondedAt: serverTimestamp(),
  };

  batch.set(answerRef, answerPayload);

  batch.update(resultsRef, {
    responseCount: increment(1),
    [`optionCounts.${cleanOptionId}`]: increment(1),
  });

  try {
    await batch.commit();
    return { success: true, answer: { ...answerPayload, respondedAt: new Date() } };
  } catch (error) {
    // Se falhou por permissão ou documento já existente, tenta carregar resposta prévia
    const existing = await getUserPollAnswer({ db, pollId, uid }).catch(() => null);
    if (existing) {
      return { success: true, alreadyVoted: true, answer: existing };
    }
    throw error;
  }
}

/**
 * Consulta a resposta individual do usuário para uma enquete.
 * Suporta chamada com objeto `{ db, pollId, uid }` ou posicional `(db, uid, pollId)`.
 * @param {any} dbOrParams
 * @param {string} [uidOrPollId]
 * @param {string} [pollIdParam]
 * @returns {Promise<import('../contracts/broadcastPoll.js').BroadcastPollAnswer|null>}
 */
export async function getUserPollAnswer(dbOrParams, uidOrPollId, pollIdParam) {
  let db, pollId, uid;
  if (dbOrParams && typeof dbOrParams === 'object' && (dbOrParams.pollId || dbOrParams.uid)) {
    db = dbOrParams.db;
    pollId = dbOrParams.pollId;
    uid = dbOrParams.uid;
  } else {
    db = dbOrParams;
    uid = uidOrPollId;
    pollId = pollIdParam;
  }
  if (!db || !pollId || !uid) return null;
  const answerRef = doc(db, 'users', uid, 'broadcast_poll_answers', pollId);
  const snap = await getDoc(answerRef);
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() };
}

/**
 * Consulta os resultados agregados de uma enquete (sob demanda).
 * Suporta chamada com objeto `{ db, pollId }` ou posicional `(db, pollId)`.
 * @param {any} dbOrParams
 * @param {string} [pollIdParam]
 * @returns {Promise<import('../contracts/broadcastPoll.js').BroadcastPollResults|null>}
 */
export async function getPollResults(dbOrParams, pollIdParam) {
  let db, pollId;
  if (dbOrParams && typeof dbOrParams === 'object' && dbOrParams.pollId) {
    db = dbOrParams.db;
    pollId = dbOrParams.pollId;
  } else {
    db = dbOrParams;
    pollId = pollIdParam;
  }
  if (!db || !pollId) return null;
  const resultsRef = doc(db, 'system_broadcast_poll_results', pollId);
  const snap = await getDoc(resultsRef);
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() };
}

/**
 * Encerra uma enquete manualmente em definitivo.
 * @param {any} dbOrParams
 * @param {string} [pollIdParam]
 * @returns {Promise<void>}
 */
export async function closeBroadcastPoll(dbOrParams, pollIdParam) {
  let db, pollId;
  if (dbOrParams && typeof dbOrParams === 'object' && dbOrParams.pollId) {
    db = dbOrParams.db;
    pollId = dbOrParams.pollId;
  } else {
    db = dbOrParams;
    pollId = pollIdParam;
  }
  if (!db || !pollId) throw new Error('pollId é obrigatório para encerrar a enquete.');
  const broadcastRef = doc(db, 'system_broadcasts', pollId);
  await updateDoc(broadcastRef, {
    'poll.status': 'closed',
    'poll.closedAt': serverTimestamp(),
  });
}

/**
 * Alterna a visibilidade ativa do broadcast.
 * @param {Object} params
 * @param {import('firebase/firestore').Firestore} params.db
 * @param {string} params.broadcastId
 * @param {boolean} params.active
 * @returns {Promise<void>}
 */
export async function toggleBroadcastActive({ db, broadcastId, active }) {
  if (!db || !broadcastId) return;
  await updateDoc(doc(db, 'system_broadcasts', broadcastId), {
    active: Boolean(active),
  });
}

/**
 * Consulta respondentes nominais por opção com paginação em cursores.
 * @param {Object} params
 * @param {import('firebase/firestore').Firestore} params.db
 * @param {string} params.pollId
 * @param {string|null} [params.optionId]
 * @param {number} [params.pageSize]
 * @param {import('firebase/firestore').DocumentSnapshot|null} [params.lastDoc]
 * @returns {Promise<{ respondents: Array<{ id: string, uid: string, optionId: string, respondedAt: any }>, hasMore: boolean, lastDoc: any }>}
 */
export async function getPollRespondentsPage({
  db,
  pollId,
  optionId = null,
  pageSize = 50,
  lastDoc = null,
}) {
  if (!db || !pollId) return { respondents: [], hasMore: false, lastDoc: null };

  const constraints = [where('pollId', '==', pollId)];
  if (optionId) {
    constraints.push(where('optionId', '==', optionId));
  }

  constraints.push(orderBy('respondedAt', 'desc'));
  constraints.push(orderBy('__name__', 'desc'));
  constraints.push(limit(pageSize));

  if (lastDoc) {
    constraints.push(startAfter(lastDoc));
  }

  const q = query(collectionGroup(db, 'broadcast_poll_answers'), ...constraints);
  const snap = await getDocs(q);

  const respondents = snap.docs.map((d) => ({
    id: d.id,
    ...d.data(),
  }));

  const nextLastDoc = snap.docs.length > 0 ? snap.docs[snap.docs.length - 1] : null;
  const hasMore = snap.docs.length === pageSize;

  return {
    respondents,
    hasMore,
    lastDoc: nextLastDoc,
  };
}

/**
 * Exclui com segurança uma enquete.
 * @param {Object} params
 * @param {import('firebase/firestore').Firestore} params.db
 * @param {string} params.pollId
 * @param {boolean} [params.isTest]
 * @param {string|null} [params.currentUid]
 * @returns {Promise<void>}
 */
export async function deleteBroadcastPoll({
  db,
  pollId,
  isTest = false,
  currentUid = null,
}) {
  if (!db || !pollId) return;

  const broadcastRef = doc(db, 'system_broadcasts', pollId);
  const resultsRef = doc(db, 'system_broadcast_poll_results', pollId);

  if (isTest && currentUid) {
    const testAnswerRef = doc(db, 'users', currentUid, 'broadcast_poll_answers', pollId);
    const batch = writeBatch(db);
    batch.delete(broadcastRef);
    batch.delete(resultsRef);
    batch.delete(testAnswerRef);
    await batch.commit();
    return;
  }

  const resultsSnap = await getDoc(resultsRef);
  if (resultsSnap.exists()) {
    const data = resultsSnap.data();
    if (Number(data.responseCount || 0) > 0) {
      throw new Error('Enquetes com votos registrados não podem ser excluídas fisicamente. Desative o broadcast para arquivá-lo mantendo os resultados.');
    }
  }

  const batch = writeBatch(db);
  batch.delete(broadcastRef);
  batch.delete(resultsRef);
  await batch.commit();
}
