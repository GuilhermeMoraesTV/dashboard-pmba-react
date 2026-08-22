const admin = require('firebase-admin');

const db = () => admin.firestore();
const serverTimestamp = () => admin.firestore.FieldValue.serverTimestamp();
const arrayUnion = (...values) => admin.firestore.FieldValue.arrayUnion(...values);
const arrayRemove = (...values) => admin.firestore.FieldValue.arrayRemove(...values);
const increment = (value) => admin.firestore.FieldValue.increment(value);

const memberName = (data = {}, uid = '') => data.displayName || data.name || data.email?.split('@')[0] || `Usuário ${uid.slice(0, 5)}`;
const manager = (group = {}, member = {}) => group.ownerId === member.uid || member.permissions?.manageMembers === true;

const notificationPayload = ({ type, title, message, groupId, requestUid = null, status = 'pending', requiresAction = false, metadata = {} }) => ({
  type,
  title,
  message,
  groupId,
  requestUid,
  status,
  requiresAction,
  metadata,
  isRead: false,
  createdAt: serverTimestamp(),
  updatedAt: serverTimestamp(),
});

async function createJoinRequest({ uid, groupId, caller = {} }) {
  if (!uid || !groupId) throw Object.assign(new Error('Dados inválidos.'), { code: 'invalid-argument' });
  const groupRef = db().collection('study_groups').doc(groupId);
  const requestRef = groupRef.collection('join_requests').doc(uid);
  const [groupSnapshot, existingMember, existingRequest] = await Promise.all([
    groupRef.get(),
    groupRef.collection('members').doc(uid).get(),
    requestRef.get(),
  ]);
  if (!groupSnapshot.exists) throw Object.assign(new Error('Grupo não encontrado.'), { code: 'not-found' });
  const group = groupSnapshot.data() || {};
  if (group.visibility !== 'private') throw Object.assign(new Error('Grupos públicos usam entrada direta.'), { code: 'failed-precondition' });
  if (existingMember.exists) return { status: 'member', groupId };
  if (existingRequest.exists && existingRequest.data()?.status === 'pending') return { status: 'pending', groupId };

  let userData = {};
  try { userData = (await db().collection('users').doc(uid).get()).data() || {}; } catch {}
  const applicant = {
    uid,
    displayName: memberName({ ...caller, ...userData }, uid),
    photoURL: caller.photoURL || userData.photoURL || null,
  };
  await requestRef.set({
    ...applicant,
    groupId,
    groupName: group.name || 'Grupo de estudo',
    status: 'pending',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  }, { merge: true });

  const managers = await groupRef.collection('members').where('permissions.manageMembers', '==', true).get();
  const batch = db().batch();
  managers.docs.forEach((item) => {
    const managerUid = item.id;
    batch.set(db().collection('users').doc(managerUid).collection('notifications').doc(`group_request_${groupId}_${uid}`), notificationPayload({
      type: 'group_request',
      title: 'Nova solicitação de entrada',
      message: `${applicant.displayName} quer entrar em ${group.name || 'seu grupo'}.`,
      groupId,
      requestUid: uid,
      requiresAction: true,
      metadata: { applicantName: applicant.displayName, applicantPhotoURL: applicant.photoURL, groupName: group.name || '' },
    }), { merge: true });
  });
  await batch.commit();
  return { status: 'pending', groupId };
}

async function respondJoinRequest({ managerUid, groupId, requestUid, approve }) {
  if (!managerUid || !groupId || !requestUid || typeof approve !== 'boolean') throw Object.assign(new Error('Dados inválidos.'), { code: 'invalid-argument' });
  const groupRef = db().collection('study_groups').doc(groupId);
  const managerRef = groupRef.collection('members').doc(managerUid);
  const requestRef = groupRef.collection('join_requests').doc(requestUid);
  const targetMemberRef = groupRef.collection('members').doc(requestUid);
  const profileRef = db().collection('users').doc(requestUid).collection('gamification').doc('profile');
  const result = await db().runTransaction(async (transaction) => {
    const [groupSnapshot, managerSnapshot, requestSnapshot, targetSnapshot, profileSnapshot] = await Promise.all([
      transaction.get(groupRef), transaction.get(managerRef), transaction.get(requestRef), transaction.get(targetMemberRef), transaction.get(profileRef),
    ]);
    if (!groupSnapshot.exists || !requestSnapshot.exists) throw Object.assign(new Error('Solicitação não encontrada.'), { code: 'not-found' });
    const group = groupSnapshot.data() || {};
    const managerData = { uid: managerUid, ...(managerSnapshot.data() || {}) };
    if (!manager(group, managerData)) throw Object.assign(new Error('Sem permissão para gerenciar solicitações.'), { code: 'permission-denied' });
    const request = requestSnapshot.data() || {};
    if (request.status !== 'pending') return { status: request.status, groupName: group.name || '' };
    const status = approve ? 'approved' : 'rejected';
    transaction.set(requestRef, { status, respondedBy: managerUid, respondedAt: serverTimestamp(), updatedAt: serverTimestamp() }, { merge: true });
    if (approve && !targetSnapshot.exists) {
      transaction.set(targetMemberRef, {
        uid: requestUid,
        displayName: request.displayName || 'Estudante',
        photoURL: request.photoURL || null,
        role: 'member',
        permissions: { manageGroup: false, manageMembers: false },
        joinSource: 'request',
        joinedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      transaction.set(groupRef, { memberCount: increment(1), updatedAt: serverTimestamp() }, { merge: true });
      const profile = profileSnapshot.data() || {};
      transaction.set(profileRef, {
        groupIds: arrayUnion(groupId),
        lastJoinedGroupId: groupId,
        ...(!profile.mainGroupId ? { mainGroupId: groupId, mainGroupName: group.name || '' } : {}),
        socialUpdatedAt: serverTimestamp(),
      }, { merge: true });
    }
    return { status, groupName: group.name || '' };
  });

  const managerSnapshots = await groupRef.collection('members').where('permissions.manageMembers', '==', true).get();
  const batch = db().batch();
  managerSnapshots.docs.forEach((item) => batch.set(
    db().collection('users').doc(item.id).collection('notifications').doc(`group_request_${groupId}_${requestUid}`),
    { status: result.status, requiresAction: false, isRead: true, readAt: serverTimestamp(), updatedAt: serverTimestamp() },
    { merge: true },
  ));
  batch.set(db().collection('users').doc(requestUid).collection('notifications').doc(`group_request_result_${groupId}`), notificationPayload({
    type: 'group_request_result',
    title: result.status === 'approved' ? 'Solicitação aprovada' : 'Solicitação recusada',
    message: result.status === 'approved' ? `Você já pode acessar ${result.groupName}.` : `Sua solicitação para ${result.groupName} não foi aprovada.`,
    groupId,
    requestUid,
    status: result.status,
  }), { merge: true });
  await batch.commit();
  return result;
}

async function leaveGroup({ uid, groupId, successorUid = null }) {
  if (!uid || !groupId) throw Object.assign(new Error('Dados inválidos.'), { code: 'invalid-argument' });
  const groupRef = db().collection('study_groups').doc(groupId);
  const memberRef = groupRef.collection('members').doc(uid);
  const profileRef = db().collection('users').doc(uid).collection('gamification').doc('profile');
  const currentMembers = await groupRef.collection('members').limit(2).get();
  const isOnlyMember = currentMembers.size === 1 && currentMembers.docs[0].id === uid;
  const result = await db().runTransaction(async (transaction) => {
    const [groupSnapshot, memberSnapshot, profileSnapshot] = await Promise.all([
      transaction.get(groupRef), transaction.get(memberRef), transaction.get(profileRef),
    ]);
    if (!groupSnapshot.exists || !memberSnapshot.exists) throw Object.assign(new Error('Você não participa deste grupo.'), { code: 'not-found' });
    const group = groupSnapshot.data() || {};
    const member = memberSnapshot.data() || {};
    const holdsRole = group.ownerId === uid || member.role === 'vice_leader';
    const closesEmptyGroup = group.ownerId === uid && isOnlyMember;
    let successor = null;
    if (holdsRole && !closesEmptyGroup) {
      if (!successorUid || successorUid === uid) throw Object.assign(new Error('Escolha outro membro para assumir o cargo.'), { code: 'failed-precondition' });
      const successorRef = groupRef.collection('members').doc(successorUid);
      const successorSnapshot = await transaction.get(successorRef);
      if (!successorSnapshot.exists) throw Object.assign(new Error('Sucessor inválido.'), { code: 'failed-precondition' });
      successor = successorSnapshot.data() || {};
      if (group.ownerId === uid) {
        transaction.set(groupRef, { ownerId: successorUid, updatedAt: serverTimestamp() }, { merge: true });
        transaction.set(successorRef, { role: 'owner', permissions: { manageGroup: true, manageMembers: true }, updatedAt: serverTimestamp() }, { merge: true });
      } else {
        transaction.set(successorRef, { role: 'vice_leader', permissions: { manageGroup: true, manageMembers: true }, updatedAt: serverTimestamp() }, { merge: true });
      }
    }
    transaction.delete(memberRef);
    if (closesEmptyGroup) transaction.delete(groupRef);
    else transaction.set(groupRef, { memberCount: increment(-1), updatedAt: serverTimestamp() }, { merge: true });
    const profile = profileSnapshot.data() || {};
    transaction.set(profileRef, {
      groupIds: arrayRemove(groupId),
      lastRemovedGroupId: groupId,
      ...(profile.mainGroupId === groupId ? { mainGroupId: null, mainGroupName: null } : {}),
      socialUpdatedAt: serverTimestamp(),
    }, { merge: true });
    return { groupName: group.name || 'grupo', inviteCode: group.inviteCode || null, groupDeleted: closesEmptyGroup, successorUid, successorName: successor ? memberName(successor, successorUid) : null };
  });
  if (result.groupDeleted && result.inviteCode) {
    await db().collection('study_group_invites').doc(result.inviteCode).delete().catch(() => {});
  }
  if (result.successorUid) await db().collection('users').doc(result.successorUid).collection('notifications').doc(`group_role_${groupId}_${Date.now()}`).set(notificationPayload({
    type: 'group_role', title: 'Novo cargo no grupo', message: `Você assumiu uma função de liderança em ${result.groupName}.`, groupId, status: 'completed',
  }));
  return { status: 'left', ...result };
}

module.exports = { createJoinRequest, respondJoinRequest, leaveGroup, __test: { manager, memberName } };
