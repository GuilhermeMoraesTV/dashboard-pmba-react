const admin = require('firebase-admin');
const { FieldValue } = require('firebase-admin/firestore');

const db = () => admin.firestore();
const serverTimestamp = () => FieldValue.serverTimestamp();

const cleanId = (value) => String(value || '').trim().slice(0, 500);

function arraysEqual(left = [], right = []) {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

async function prepareChat({ uid, groupId }) {
  const safeGroupId = cleanId(groupId);
  if (!uid || !safeGroupId) throw Object.assign(new Error('Grupo inválido.'), { code: 'invalid-argument' });
  const firestore = db();
  const groupRef = firestore.collection('study_groups').doc(safeGroupId);
  const memberRef = groupRef.collection('members').doc(uid);
  const metaRef = groupRef.collection('chat_meta').doc('current');
  const stateRef = firestore.collection('users').doc(uid).collection('group_chat_states').doc(safeGroupId);
  const [groupSnapshot, memberSnapshot, membersSnapshot, metaSnapshot, stateSnapshot] = await Promise.all([
    groupRef.get(), memberRef.get(), groupRef.collection('members').limit(50).get(), metaRef.get(), stateRef.get(),
  ]);
  if (!groupSnapshot.exists) throw Object.assign(new Error('Grupo não encontrado.'), { code: 'not-found' });
  if (!memberSnapshot.exists) throw Object.assign(new Error('Somente membros podem abrir o chat.'), { code: 'permission-denied' });
  const group = groupSnapshot.data() || {};
  const currentMeta = metaSnapshot.data() || {};
  const memberIds = membersSnapshot.docs.map((item) => item.id).sort();
  const lastSeq = Math.max(0, Number(currentMeta.lastSeq || 0));
  const bootstrapStateSnapshots = !metaSnapshot.exists && memberIds.length
    ? await firestore.getAll(...memberIds.map((memberId) => firestore.collection('users').doc(memberId).collection('group_chat_states').doc(safeGroupId)))
    : [];
  const batch = firestore.batch();
  const metaChanged = !metaSnapshot.exists
    || currentMeta.groupName !== group.name
    || !arraysEqual([...(currentMeta.memberIds || [])].sort(), memberIds);
  if (metaChanged) batch.set(metaRef, {
    groupId: safeGroupId,
    groupName: String(group.name || 'Grupo de estudo').trim().slice(0, 80),
    memberIds,
    lastSeq,
    lastMessageId: currentMeta.lastMessageId || null,
    lastMessageAt: currentMeta.lastMessageAt || null,
    lastAuthorId: currentMeta.lastAuthorId || null,
    createdAt: currentMeta.createdAt || serverTimestamp(),
    updatedAt: serverTimestamp(),
  }, { merge: false });
  bootstrapStateSnapshots.filter((snapshot) => !snapshot.exists).forEach((snapshot) => batch.set(snapshot.ref, {
    groupId: safeGroupId,
    lastReadSeq: lastSeq,
    readAt: serverTimestamp(),
    lastSendAt: null,
    sentCountTotal: 0,
    sentCountAtRead: 0,
    updatedAt: serverTimestamp(),
  }));
  if (!stateSnapshot.exists && metaSnapshot.exists) batch.set(stateRef, {
    groupId: safeGroupId,
    lastReadSeq: lastSeq,
    readAt: serverTimestamp(),
    lastSendAt: null,
    sentCountTotal: 0,
    sentCountAtRead: 0,
    updatedAt: serverTimestamp(),
  });
  if (metaChanged || !stateSnapshot.exists || bootstrapStateSnapshots.some((snapshot) => !snapshot.exists)) await batch.commit();
  return { groupId: safeGroupId, lastSeq, initialized: !metaSnapshot.exists || !stateSnapshot.exists };
}

async function syncMembership({ groupId, memberId = null, memberCreated = false, memberDeleted = false }) {
  const safeGroupId = cleanId(groupId);
  if (!safeGroupId) return null;
  const firestore = db();
  const groupRef = firestore.collection('study_groups').doc(safeGroupId);
  const metaRef = groupRef.collection('chat_meta').doc('current');
  const [groupSnapshot, metaSnapshot] = await Promise.all([groupRef.get(), metaRef.get()]);
  if (!groupSnapshot.exists) {
    await Promise.all([
      metaRef.delete().catch(() => {}),
      memberId ? firestore.collection('users').doc(memberId).collection('group_chat_states').doc(safeGroupId).delete().catch(() => {}) : Promise.resolve(),
    ]);
    return { groupId: safeGroupId, deleted: true };
  }
  const membersSnapshot = await groupRef.collection('members').limit(50).get();
  const memberIds = membersSnapshot.docs.map((item) => item.id).sort();
  const group = groupSnapshot.data() || {};
  const currentMeta = metaSnapshot.data() || {};
  const lastSeq = Math.max(0, Number(currentMeta.lastSeq || 0));
  const bootstrapStateSnapshots = !metaSnapshot.exists && memberIds.length
    ? await firestore.getAll(...memberIds.map((uid) => firestore.collection('users').doc(uid).collection('group_chat_states').doc(safeGroupId)))
    : [];
  const batch = firestore.batch();
  const currentMemberIds = [...(currentMeta.memberIds || [])].sort();
  const metaChanged = !metaSnapshot.exists || currentMeta.groupName !== group.name || !arraysEqual(currentMemberIds, memberIds);
  if (metaChanged) batch.set(metaRef, {
    groupId: safeGroupId,
    groupName: String(group.name || 'Grupo de estudo').trim().slice(0, 80),
    memberIds,
    lastSeq,
    lastMessageId: currentMeta.lastMessageId || null,
    lastMessageAt: currentMeta.lastMessageAt || null,
    lastAuthorId: currentMeta.lastAuthorId || null,
    createdAt: currentMeta.createdAt || serverTimestamp(),
    updatedAt: serverTimestamp(),
  }, { merge: false });
  bootstrapStateSnapshots.filter((snapshot) => !snapshot.exists).forEach((snapshot) => batch.set(snapshot.ref, {
    groupId: safeGroupId,
    lastReadSeq: lastSeq,
    readAt: serverTimestamp(),
    lastSendAt: null,
    sentCountTotal: 0,
    sentCountAtRead: 0,
    updatedAt: serverTimestamp(),
  }));
  if (memberId && memberCreated) {
    const stateRef = firestore.collection('users').doc(memberId).collection('group_chat_states').doc(safeGroupId);
    const stateSnapshot = await stateRef.get();
    const state = stateSnapshot.data() || {};
    const sentCountTotal = Math.max(0, Number(state.sentCountTotal || 0));
    if (metaSnapshot.exists) {
      batch.set(stateRef, {
        groupId: safeGroupId,
        lastReadSeq: lastSeq,
        readAt: serverTimestamp(),
        lastSendAt: state.lastSendAt || null,
        sentCountTotal,
        sentCountAtRead: sentCountTotal,
        updatedAt: serverTimestamp(),
      }, { merge: false });
    }
  }
  if (memberId && memberDeleted) {
    batch.delete(firestore.collection('users').doc(memberId).collection('group_chat_states').doc(safeGroupId));
  }
  if (metaChanged || bootstrapStateSnapshots.some((snapshot) => !snapshot.exists) || (memberId && (memberCreated || memberDeleted))) await batch.commit();
  return { groupId: safeGroupId, memberCount: memberIds.length, changed: metaChanged };
}

async function processMentionOutbox({ authorUid, eventId, data = {} }) {
  const firestore = db();
  const groupId = cleanId(data.groupId);
  const messageId = cleanId(data.messageId);
  const outboxRef = firestore.collection('users').doc(authorUid).collection('group_chat_mention_outbox').doc(eventId);
  const currentOutbox = await outboxRef.get();
  if (currentOutbox.data()?.processed === true) {
    return { delivered: Math.max(0, Number(currentOutbox.data()?.deliveredCount || 0)), duplicate: true };
  }
  const requested = [...new Set((Array.isArray(data.mentionUids) ? data.mentionUids : []).map(cleanId).filter(Boolean))].slice(0, 10);
  if (!groupId || !messageId || data.authorUid !== authorUid || !requested.length) {
    await outboxRef.set({ processed: true, processedAt: serverTimestamp(), processingError: 'invalid-payload' }, { merge: true });
    return { delivered: 0 };
  }
  const groupRef = firestore.collection('study_groups').doc(groupId);
  const messageRef = groupRef.collection('messages').doc(messageId);
  const [groupSnapshot, messageSnapshot] = await Promise.all([groupRef.get(), messageRef.get()]);
  const message = messageSnapshot.data() || {};
  if (!groupSnapshot.exists || !messageSnapshot.exists || message.authorId !== authorUid || message.deleted === true) {
    await outboxRef.set({ processed: true, processedAt: serverTimestamp(), processingError: 'source-unavailable' }, { merge: true });
    return { delivered: 0 };
  }
  const messageMentions = new Set(message.mentionUids || []);
  const candidates = requested.filter((uid) => uid !== authorUid && messageMentions.has(uid));
  const membershipSnapshots = candidates.length
    ? await firestore.getAll(...candidates.map((uid) => groupRef.collection('members').doc(uid)))
    : [];
  const targets = membershipSnapshots.filter((snapshot) => snapshot.exists).map((snapshot) => snapshot.id);
  const group = groupSnapshot.data() || {};
  const batch = firestore.batch();
  targets.forEach((targetUid) => {
    const notificationId = `${groupId}_${messageId}_${targetUid}`;
    batch.set(firestore.collection('users').doc(targetUid).collection('notifications').doc(notificationId), {
      type: 'group_chat_mention',
      title: 'Você foi mencionado no chat',
      message: `${message.authorName || 'Um colega'} mencionou você em ${group.name || 'um grupo de estudo'}.`,
      groupId,
      messageId,
      authorUid,
      isRead: false,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    }, { merge: true });
  });
  batch.set(outboxRef, { processed: true, processedAt: serverTimestamp(), deliveredCount: targets.length }, { merge: true });
  await batch.commit();
  return { delivered: targets.length };
}

module.exports = {
  prepareChat,
  processMentionOutbox,
  syncMembership,
  __test: { arraysEqual },
};
