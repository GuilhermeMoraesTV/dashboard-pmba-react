import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  startAfter,
  Timestamp,
  updateDoc,
  where,
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '../../firebaseConfig.js';
import { loadGroupChatOpening } from './groupChatViewport.js';
import {
  CHAT_LIMITS,
  normalizeMentionUids,
  normalizeMessageText,
  retainedReadFloor,
  toDate,
} from './groupChatDomain.js';

const replyCache = new Map();
const messageCollection = (groupId) => collection(db, 'study_groups', groupId, 'messages');
const messageDocument = (groupId, messageId) => doc(db, 'study_groups', groupId, 'messages', messageId);
const metaDocument = (groupId) => doc(db, 'study_groups', groupId, 'chat_meta', 'current');
const stateDocument = (uid, groupId) => doc(db, 'users', uid, 'group_chat_states', groupId);
const wait = (milliseconds) => new Promise((resolve) => window.setTimeout(resolve, milliseconds));

function isRetryableTransactionConflict(error, transactionReachedWrites) {
  return Boolean(transactionReachedWrites)
    && ['aborted', 'permission-denied', 'unavailable'].includes(error?.code);
}

function normalizeMessage(snapshot) {
  const data = snapshot.data() || {};
  return {
    id: snapshot.id,
    ...data,
    createdAt: toDate(data.createdAt),
    updatedAt: toDate(data.updatedAt),
    editedAt: toDate(data.editedAt),
    deletedAt: toDate(data.deletedAt),
    expiresAt: toDate(data.expiresAt),
    deliveryState: 'sent',
  };
}

export async function prepareGroupChat(groupId) {
  const callable = httpsCallable(functions, 'prepararChatGrupo');
  const result = await callable({ groupId });
  return result.data;
}

export async function loadLatestGroupChatMessages(groupId, pageSize = CHAT_LIMITS.pageSize) {
  const snapshot = await getDocs(query(messageCollection(groupId), orderBy('seq', 'desc'), limit(pageSize)));
  const messages = snapshot.docs.map(normalizeMessage).reverse();
  return {
    messages,
    oldestSeq: messages[0]?.seq || null,
    highestSeq: messages.at(-1)?.seq || 0,
    hasMore: snapshot.size === pageSize,
  };
}

export async function loadOlderGroupChatMessages(groupId, oldestSeq, pageSize = CHAT_LIMITS.pageSize) {
  if (!Number.isFinite(Number(oldestSeq))) return { messages: [], oldestSeq: null, hasMore: false };
  const snapshot = await getDocs(query(
    messageCollection(groupId),
    orderBy('seq', 'desc'),
    startAfter(Number(oldestSeq)),
    limit(pageSize),
  ));
  const messages = snapshot.docs.map(normalizeMessage).reverse();
  return { messages, oldestSeq: messages[0]?.seq || null, hasMore: snapshot.size === pageSize };
}

export async function loadNewerGroupChatMessages(groupId, afterSeq, pageSize = CHAT_LIMITS.pageSize) {
  const snapshot = await getDocs(query(
    messageCollection(groupId), orderBy('seq', 'asc'),
    startAfter(Math.max(0, Number(afterSeq || 0))), limit(pageSize),
  ));
  const messages = snapshot.docs.map(normalizeMessage);
  return { messages, oldestSeq: messages[0]?.seq || null, highestSeq: messages.at(-1)?.seq || Number(afterSeq || 0), hasMore: snapshot.size === pageSize };
}

export function loadInitialGroupChatMessages(groupId, uid) {
  return loadGroupChatOpening({
    uid,
    loadState: async () => {
      const snapshot = await getDoc(stateDocument(uid, groupId));
      return snapshot.exists() ? snapshot.data() : null;
    },
    loadLatest: () => loadLatestGroupChatMessages(groupId),
    loadAfter: (seq) => loadNewerGroupChatMessages(groupId, seq),
  });
}

export function subscribeToNewGroupChatMessages(groupId, afterSeq, onMessages, onError) {
  return onSnapshot(query(
    messageCollection(groupId),
    where('seq', '>', Math.max(0, Number(afterSeq || 0))),
    orderBy('seq', 'asc'),
  ), (snapshot) => onMessages(snapshot.docs.map(normalizeMessage)), onError);
}

export async function catchUpGroupChatMessages(groupId, afterSeq, targetSeq) {
  let cursor = Math.max(0, Number(afterSeq || 0));
  const target = Math.max(cursor, Number(targetSeq || 0));
  const messages = [];
  while (cursor < target) {
    const snapshot = await getDocs(query(
      messageCollection(groupId),
      where('seq', '>', cursor),
      orderBy('seq', 'asc'),
      limit(CHAT_LIMITS.reconnectBatchSize),
    ));
    if (snapshot.empty) break;
    const batch = snapshot.docs.map(normalizeMessage);
    messages.push(...batch);
    cursor = batch.at(-1).seq;
    if (snapshot.size < CHAT_LIMITS.reconnectBatchSize) break;
  }
  return messages;
}

export async function sendGroupChatMessage({ groupId, author, text, replyToMessageId = null, mentionUids = [], messageId = null }) {
  const cleanText = normalizeMessageText(text);
  const mentions = normalizeMentionUids(mentionUids, author.uid);
  const targetRef = messageId ? messageDocument(groupId, messageId) : doc(messageCollection(groupId));
  const outboxRef = mentions.length ? doc(db, 'users', author.uid, 'group_chat_mention_outbox', `${targetRef.id}_create`) : null;
  const startedAt = performance.now();
  let attempts = 0;
  for (let conflictRetry = 0; conflictRetry <= CHAT_LIMITS.transactionConflictRetries; conflictRetry += 1) {
    let transactionReachedWrites = false;
    let attemptedSeq = 0;
    try {
      const result = await runTransaction(db, async (transaction) => {
        attempts += 1;
        const [metaSnapshot, stateSnapshot] = await Promise.all([
          transaction.get(metaDocument(groupId)),
          transaction.get(stateDocument(author.uid, groupId)),
        ]);
        if (!metaSnapshot.exists() || !stateSnapshot.exists()) throw new Error('O chat ainda está sendo preparado. Tente novamente.');
        const meta = metaSnapshot.data() || {};
        const state = stateSnapshot.data() || {};
        const nextSeq = Number(meta.lastSeq || 0) + 1;
        attemptedSeq = nextSeq;
        const expiresAt = Timestamp.fromMillis(Date.now() + CHAT_LIMITS.retentionDays * 24 * 60 * 60 * 1000);
        transactionReachedWrites = true;
        transaction.set(targetRef, {
          seq: nextSeq,
          authorId: author.uid,
          authorName: String(author.displayName || author.name || 'Estudante').trim().slice(0, 120),
          authorPhotoURL: typeof author.photoURL === 'string' ? author.photoURL.slice(0, 2048) : null,
          text: cleanText,
          replyToMessageId: replyToMessageId || null,
          mentionUids: mentions,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          editedAt: null,
          deleted: false,
          deletedAt: null,
          deletedBy: null,
          expiresAt,
        });
        transaction.update(metaDocument(groupId), {
          lastSeq: nextSeq,
          lastMessageId: targetRef.id,
          lastMessageAt: serverTimestamp(),
          lastAuthorId: author.uid,
          updatedAt: serverTimestamp(),
        });
        transaction.update(stateDocument(author.uid, groupId), {
          lastSendAt: serverTimestamp(),
          sentCountTotal: Number(state.sentCountTotal || 0) + 1,
          updatedAt: serverTimestamp(),
        });
        if (outboxRef) transaction.set(outboxRef, {
          eventId: outboxRef.id,
          groupId,
          messageId: targetRef.id,
          authorUid: author.uid,
          mentionUids: mentions,
          processed: false,
          createdAt: serverTimestamp(),
          expiresAt: Timestamp.fromMillis(Date.now() + CHAT_LIMITS.outboxRetentionDays * 24 * 60 * 60 * 1000),
        });
        return { id: targetRef.id, seq: nextSeq };
      }, { maxAttempts: CHAT_LIMITS.transactionMaxAttempts });
      return { ...result, attempts, latencyMs: Math.round(performance.now() - startedAt) };
    } catch (error) {
      const canRetry = conflictRetry < CHAT_LIMITS.transactionConflictRetries
        && isRetryableTransactionConflict(error, transactionReachedWrites);
      if (!canRetry) throw error;
      try {
        const [existing, freshMeta] = await Promise.all([
          getDoc(targetRef),
          getDoc(metaDocument(groupId)),
        ]);
        if (existing.exists()) {
          return { id: existing.id, seq: existing.data().seq, attempts, recovered: true, latencyMs: Math.round(performance.now() - startedAt) };
        }
        if (error?.code === 'permission-denied' && Number(freshMeta.data()?.lastSeq || 0) < attemptedSeq) throw error;
      } catch (recoveryError) {
        if (recoveryError === error || recoveryError?.code === 'permission-denied') throw error;
      }
      const jitter = Math.floor(Math.random() * CHAT_LIMITS.transactionRetryBaseMs * 3);
      await wait(Math.min(750, CHAT_LIMITS.transactionRetryBaseMs * (conflictRetry + 1) + jitter));
    }
  }
  throw new Error('Mensagem não enviada');
}

export async function recoverOrRetryGroupChatMessage(payload) {
  const existing = await getDoc(messageDocument(payload.groupId, payload.messageId));
  if (existing.exists()) return { id: existing.id, seq: existing.data().seq, attempts: 0, recovered: true };
  return sendGroupChatMessage(payload);
}

export async function editGroupChatMessage({ groupId, messageId, text, mentionUids = [], authorUid }) {
  const cleanText = normalizeMessageText(text);
  const mentions = normalizeMentionUids(mentionUids, authorUid);
  const messageRef = messageDocument(groupId, messageId);
  const eventRef = doc(collection(db, 'users', authorUid, 'group_chat_mention_outbox'));
  return runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(messageRef);
    if (!snapshot.exists()) throw new Error('Mensagem não encontrada.');
    const current = snapshot.data() || {};
    const previousMentions = new Set(current.mentionUids || []);
    const addedMentions = mentions.filter((uid) => !previousMentions.has(uid));
    if (current.text === cleanText && JSON.stringify(current.mentionUids || []) === JSON.stringify(mentions)) return { changed: false };
    transaction.update(messageRef, { text: cleanText, mentionUids: mentions, editedAt: serverTimestamp(), updatedAt: serverTimestamp() });
    if (addedMentions.length) transaction.set(eventRef, {
      eventId: eventRef.id,
      groupId,
      messageId,
      authorUid,
      mentionUids: addedMentions,
      processed: false,
      createdAt: serverTimestamp(),
      expiresAt: Timestamp.fromMillis(Date.now() + CHAT_LIMITS.outboxRetentionDays * 24 * 60 * 60 * 1000),
    });
    return { changed: true, addedMentions };
  });
}

export async function deleteGroupChatMessage({ groupId, messageId, deletedBy }) {
  await updateDoc(messageDocument(groupId, messageId), {
    text: '',
    deleted: true,
    deletedAt: serverTimestamp(),
    deletedBy,
    updatedAt: serverTimestamp(),
  });
}

export async function markGroupChatRead(groupId, uid, observedSeq = null) {
  return runTransaction(db, async (transaction) => {
    const [metaSnapshot, stateSnapshot] = await Promise.all([
      transaction.get(metaDocument(groupId)),
      transaction.get(stateDocument(uid, groupId)),
    ]);
    if (!metaSnapshot.exists() || !stateSnapshot.exists()) return false;
    const meta = metaSnapshot.data() || {};
    const state = stateSnapshot.data() || {};
    // A message arriving after the viewport check must remain unread.
    if (observedSeq != null && Number(meta.lastSeq || 0) > observedSeq) return false;
    if (Number(state.lastReadSeq || 0) >= Number(meta.lastSeq || 0)
      && Number(state.sentCountAtRead || 0) === Number(state.sentCountTotal || 0)) return false;
    transaction.update(stateDocument(uid, groupId), {
      lastReadSeq: Number(meta.lastSeq || 0),
      sentCountAtRead: Number(state.sentCountTotal || 0),
      readAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return true;
  });
}

export async function reconcileGroupChatRetainedHistory(groupId, uid) {
  const firstSnapshot = await getDocs(query(messageCollection(groupId), orderBy('seq', 'asc'), limit(1)));
  const firstRetainedSeq = firstSnapshot.docs[0]?.data()?.seq;
  return runTransaction(db, async (transaction) => {
    const [metaSnapshot, stateSnapshot] = await Promise.all([
      transaction.get(metaDocument(groupId)), transaction.get(stateDocument(uid, groupId)),
    ]);
    if (!metaSnapshot.exists() || !stateSnapshot.exists()) return false;
    const meta = metaSnapshot.data() || {};
    const state = stateSnapshot.data() || {};
    const floor = firstRetainedSeq == null ? Number(meta.lastSeq || 0) : retainedReadFloor(firstRetainedSeq, state.lastReadSeq);
    if (floor <= Number(state.lastReadSeq || 0)) return false;
    transaction.update(stateDocument(uid, groupId), {
      lastReadSeq: Math.min(floor, Number(meta.lastSeq || 0)),
      sentCountAtRead: Number(state.sentCountTotal || 0),
      readAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return true;
  });
}

export function subscribeToGroupChatTyping(groupId, onEntries, onError) {
  return onSnapshot(collection(db, 'study_groups', groupId, 'typing'), (snapshot) => {
    onEntries(snapshot.docs.map((entry) => ({ uid: entry.id, ...entry.data(), typingUntil: toDate(entry.data().typingUntil) })));
  }, onError);
}

export function publishGroupChatTyping(groupId, user) {
  return setDoc(doc(db, 'study_groups', groupId, 'typing', user.uid), {
    uid: user.uid,
    name: String(user.displayName || user.name || 'Estudante').trim().slice(0, 120),
    typingUntil: Timestamp.fromMillis(Date.now() + CHAT_LIMITS.typingVisibleMs),
    updatedAt: serverTimestamp(),
  }, { merge: true });
}

export async function getReplyMessage(groupId, messageId) {
  if (!messageId) return null;
  const key = `${groupId}:${messageId}`;
  if (replyCache.has(key)) return replyCache.get(key);
  const snapshot = await getDoc(messageDocument(groupId, messageId));
  const message = snapshot.exists() ? normalizeMessage(snapshot) : null;
  replyCache.set(key, message);
  return message;
}

export { isRetryableTransactionConflict, metaDocument, stateDocument };
