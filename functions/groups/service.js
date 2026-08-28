const admin = require('firebase-admin');

const db = () => admin.firestore();
const serverTimestamp = () => admin.firestore.FieldValue.serverTimestamp();
const arrayUnion = (...values) => admin.firestore.FieldValue.arrayUnion(...values);
const arrayRemove = (...values) => admin.firestore.FieldValue.arrayRemove(...values);
const increment = (value) => admin.firestore.FieldValue.increment(value);
const currentWeekId = () => {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bahia', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
  const get = (type) => parts.find((part) => part.type === type)?.value;
  const cursor = new Date(`${get('year')}-${get('month')}-${get('day')}T12:00:00Z`);
  const weekday = cursor.getUTCDay() || 7;
  cursor.setUTCDate(cursor.getUTCDate() - weekday + 1);
  return cursor.toISOString().slice(0, 10);
};
const currentMonthId = () => {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bahia', year: 'numeric', month: '2-digit' }).formatToParts(new Date());
  const get = (type) => parts.find((part) => part.type === type)?.value;
  return `${get('year')}-${get('month')}`;
};

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

const timestampMillis = (value) => {
  if (!value) return 0;
  if (typeof value.toMillis === 'function') return value.toMillis();
  if (typeof value.toDate === 'function') return value.toDate().getTime();
  const millis = new Date(value).getTime();
  return Number.isFinite(millis) ? millis : 0;
};

const publicGroupPayload = (groupId, group = {}) => ({
  groupId,
  name: String(group.name || 'Grupo de estudo').trim().slice(0, 80),
  description: String(group.description || '').trim().slice(0, 240),
  visibility: group.visibility === 'private' ? 'private' : 'public',
  editalId: group.editalId || null,
  editalName: String(group.editalName || group.editalNome || '').trim().slice(0, 120),
  editalLogoURL: group.editalLogoURL || group.editalLogoUrl || null,
  cargo: String(group.cargo || '').trim().slice(0, 120),
  photoURL: group.photoURL || null,
  memberCount: Math.max(0, Number(group.memberCount || 0)),
  weeklyMetricsWeekId: group.weeklyMetricsWeekId || null,
  weeklyXP: Math.max(0, Number(group.weeklyXP || 0)),
  weeklyMinutes: Math.max(0, Number(group.weeklyMinutes || 0)),
  weeklyQuestions: Math.max(0, Number(group.weeklyQuestions || 0)),
  status: group.status === 'blocked' ? 'blocked' : 'active',
  createdAt: group.createdAt || null,
  updatedAt: group.updatedAt || null,
});

async function syncGroupDirectoryWithDb({ groupId, group = null, firestore, getTimestamp = serverTimestamp }) {
  if (!groupId) return null;
  const directoryRef = firestore.collection('study_group_directory').doc(groupId);
  if (!group) {
    await directoryRef.delete().catch((error) => {
      if (error?.code !== 5 && error?.code !== 'not-found') throw error;
    });
    return { groupId, deleted: true };
  }
  const payload = publicGroupPayload(groupId, group);
  await directoryRef.set({ ...payload, directoryUpdatedAt: getTimestamp() }, { merge: false });
  return { groupId, visibility: payload.visibility };
}

async function syncGroupDirectory({ groupId, group = null }) {
  return syncGroupDirectoryWithDb({ groupId, group, firestore: db() });
}

async function listGroups() {
  const snapshot = await db().collection('study_groups').get();
  const weekId = currentWeekId();
  const groups = await Promise.all(snapshot.docs.map(async (item) => {
    const storedGroup = item.data() || {};
    const membersSnapshot = await item.ref.collection('members').get();
    const memberCount = membersSnapshot.size;
    const group = { id: item.id, ...publicGroupPayload(item.id, { ...storedGroup, memberCount }) };
    if (Number(storedGroup.memberCount || 0) !== memberCount) {
      await Promise.all([
        item.ref.set({ memberCount, memberCountUpdatedAt: serverTimestamp() }, { merge: true }),
        syncGroupDirectory({ groupId: item.id, group: { ...storedGroup, memberCount } }),
      ]);
    }
    if (group.weeklyMetricsWeekId === weekId) return group;
    const weeklyMembersSnapshot = await item.ref.collection('weekly_rankings').doc(weekId).collection('members').get();
    return weeklyMembersSnapshot.docs.reduce((total, memberSnapshot) => {
      const member = memberSnapshot.data() || {};
      total.weeklyXP += Number(member.competitiveXP || member.weeklyXP || 0);
      total.weeklyMinutes += Number(member.minutes || 0);
      total.weeklyQuestions += Number(member.questions || 0);
      return total;
    }, { ...group, weeklyMetricsWeekId: weekId, weeklyXP: 0, weeklyMinutes: 0, weeklyQuestions: 0 });
  }));
  return groups
    .filter((group) => group.status !== 'blocked')
    .map((group) => {
      const { createdAt, updatedAt, ...publicFields } = group;
      return {
        ...publicFields,
        createdAtMillis: timestampMillis(createdAt),
        updatedAtMillis: timestampMillis(updatedAt),
      };
    })
    .sort((a, b) => b.createdAtMillis - a.createdAtMillis || a.name.localeCompare(b.name, 'pt-BR'));
}

async function syncGroupMemberCountWithDb({ groupId, firestore, getTimestamp = serverTimestamp }) {
  if (!groupId) return null;
  const groupRef = firestore.collection('study_groups').doc(groupId);
  const [groupSnapshot, membersSnapshot] = await Promise.all([
    groupRef.get(),
    groupRef.collection('members').get(),
  ]);
  if (!groupSnapshot.exists) return { groupId, deleted: true };
  const group = groupSnapshot.data() || {};
  const memberCount = membersSnapshot.size;
  await Promise.all([
    Number(group.memberCount || 0) !== memberCount
      ? groupRef.set({ memberCount, memberCountUpdatedAt: getTimestamp() }, { merge: true })
      : Promise.resolve(),
    syncGroupDirectoryWithDb({ groupId, group: { ...group, memberCount }, firestore, getTimestamp }),
  ]);
  return { groupId, memberCount };
}

async function syncGroupMemberCount({ groupId }) {
  return syncGroupMemberCountWithDb({ groupId, firestore: db() });
}

async function removeCurrentGroupRankingMember({ groupId, memberUid }) {
  const weekId = currentWeekId();
  const monthId = currentMonthId();
  const groupRef = db().collection('study_groups').doc(groupId);
  const rankingMemberRef = groupRef.collection('weekly_rankings').doc(weekId).collection('members').doc(memberUid);
  const monthlyRankingMemberRef = groupRef.collection('monthly_rankings').doc(monthId).collection('members').doc(memberUid);
  await db().runTransaction(async (transaction) => {
    const [groupSnapshot, memberSnapshot, monthlyMemberSnapshot] = await Promise.all([
      transaction.get(groupRef),
      transaction.get(rankingMemberRef),
      transaction.get(monthlyRankingMemberRef),
    ]);
    if (!groupSnapshot.exists) return;
    const group = groupSnapshot.data() || {};
    const member = memberSnapshot.data() || {};
    if (memberSnapshot.exists && group.weeklyMetricsWeekId === weekId) {
      transaction.set(groupRef, {
        weeklyXP: Math.max(0, Number(group.weeklyXP || 0) - Number(member.competitiveXP || member.weeklyXP || 0)),
        weeklyMinutes: Math.max(0, Number(group.weeklyMinutes || 0) - Number(member.minutes || 0)),
        weeklyQuestions: Math.max(0, Number(group.weeklyQuestions || 0) - Number(member.questions || 0)),
        weeklyMetricsUpdatedAt: serverTimestamp(),
      }, { merge: true });
    }
    if (memberSnapshot.exists) transaction.delete(rankingMemberRef);
    if (monthlyMemberSnapshot.exists) transaction.delete(monthlyRankingMemberRef);
  });
}

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
      message: `${applicant.displayName} solicitou entrada no grupo ${group.name || 'de estudo'}.`,
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
    title: result.status === 'approved' ? 'Solicitação aprovada' : 'Solicitação não aprovada',
    message: result.status === 'approved'
      ? `Sua solicitação para entrar no grupo ${result.groupName} foi aprovada.`
      : `Sua solicitação para entrar no grupo ${result.groupName} não foi aprovada.`,
    groupId,
    requestUid,
    status: result.status,
  }), { merge: true });
  await batch.commit();
  return result;
}

async function joinPrivateGroupByCode({ uid, inviteCode, caller = {} }) {
  const code = String(inviteCode || '').trim().toUpperCase();
  if (!uid || !code) throw Object.assign(new Error('Código de entrada inválido.'), { code: 'invalid-argument' });
  const inviteRef = db().collection('study_group_invites').doc(code);
  let userData = {};
  try { userData = (await db().collection('users').doc(uid).get()).data() || {}; } catch {}
  const applicant = {
    uid,
    displayName: memberName({ ...caller, ...userData }, uid),
    photoURL: caller.photoURL || userData.photoURL || null,
  };
  const result = await db().runTransaction(async (transaction) => {
    const inviteSnapshot = await transaction.get(inviteRef);
    if (!inviteSnapshot.exists || inviteSnapshot.data()?.active !== true) throw Object.assign(new Error('Código inválido ou expirado.'), { code: 'not-found' });
    const invite = inviteSnapshot.data() || {};
    const groupId = String(invite.groupId || '').trim();
    if (!groupId) throw Object.assign(new Error('Convite sem grupo associado.'), { code: 'failed-precondition' });
    const groupRef = db().collection('study_groups').doc(groupId);
    const memberRef = groupRef.collection('members').doc(uid);
    const profileRef = db().collection('users').doc(uid).collection('gamification').doc('profile');
    const requestRef = groupRef.collection('join_requests').doc(uid);
    const [groupSnapshot, memberSnapshot, profileSnapshot, requestSnapshot] = await Promise.all([
      transaction.get(groupRef), transaction.get(memberRef), transaction.get(profileRef), transaction.get(requestRef),
    ]);
    if (!groupSnapshot.exists) throw Object.assign(new Error('Grupo não encontrado.'), { code: 'not-found' });
    const group = groupSnapshot.data() || {};
    if (group.visibility !== 'private') throw Object.assign(new Error('Este código não pertence a um grupo privado.'), { code: 'failed-precondition' });
    if (memberSnapshot.exists) return { status: 'member', groupId, groupName: group.name || invite.groupName || 'Grupo de estudo', hadPendingRequest: false };
    transaction.set(memberRef, {
      ...applicant,
      role: 'member',
      permissions: { manageGroup: false, manageMembers: false },
      joinSource: 'invite',
      joinedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    transaction.set(groupRef, { memberCount: increment(1), updatedAt: serverTimestamp() }, { merge: true });
    const profile = profileSnapshot.data() || {};
    transaction.set(profileRef, {
      groupIds: arrayUnion(groupId),
      lastJoinedGroupId: groupId,
      ...(!profile.mainGroupId ? { mainGroupId: groupId, mainGroupName: group.name || invite.groupName || '' } : {}),
      socialUpdatedAt: serverTimestamp(),
    }, { merge: true });
    const hadPendingRequest = requestSnapshot.exists && requestSnapshot.data()?.status === 'pending';
    if (hadPendingRequest) transaction.set(requestRef, {
      status: 'approved_via_code',
      respondedBy: uid,
      respondedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    }, { merge: true });
    return { status: 'joined', groupId, groupName: group.name || invite.groupName || 'Grupo de estudo', hadPendingRequest };
  });

  if (result.hadPendingRequest) {
    const groupRef = db().collection('study_groups').doc(result.groupId);
    const managers = await groupRef.collection('members').where('permissions.manageMembers', '==', true).get();
    const batch = db().batch();
    managers.docs.forEach((item) => batch.set(
      db().collection('users').doc(item.id).collection('notifications').doc(`group_request_${result.groupId}_${uid}`),
      { status: 'approved_via_code', requiresAction: false, isRead: true, readAt: serverTimestamp(), updatedAt: serverTimestamp() },
      { merge: true },
    ));
    await batch.commit();
  }
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
  if (!result.groupDeleted) await removeCurrentGroupRankingMember({ groupId, memberUid: uid });
  if (result.successorUid) await db().collection('users').doc(result.successorUid).collection('notifications').doc(`group_role_${groupId}_${Date.now()}`).set(notificationPayload({
    type: 'group_role', title: 'Novo cargo no grupo', message: `Você assumiu uma função de liderança em ${result.groupName}.`, groupId, status: 'completed',
  }));
  return { status: 'left', ...result };
}

async function updateMemberRole({ managerUid, groupId, memberUid, viceLeader }) {
  if (!managerUid || !groupId || !memberUid || typeof viceLeader !== 'boolean') throw Object.assign(new Error('Dados inválidos.'), { code: 'invalid-argument' });
  const groupRef = db().collection('study_groups').doc(groupId);
  const memberRef = groupRef.collection('members').doc(memberUid);
  const result = await db().runTransaction(async (transaction) => {
    const [groupSnapshot, memberSnapshot] = await Promise.all([transaction.get(groupRef), transaction.get(memberRef)]);
    if (!groupSnapshot.exists || !memberSnapshot.exists) throw Object.assign(new Error('Grupo ou membro não encontrado.'), { code: 'not-found' });
    const group = groupSnapshot.data() || {};
    if (group.ownerId !== managerUid) throw Object.assign(new Error('Somente o líder pode alterar a vice-liderança.'), { code: 'permission-denied' });
    if (memberUid === group.ownerId) throw Object.assign(new Error('O líder não pode ser alterado por esta ação.'), { code: 'failed-precondition' });
    transaction.set(memberRef, {
      role: viceLeader ? 'vice_leader' : 'member',
      permissions: viceLeader
        ? { manageGroup: true, manageMembers: true }
        : { manageGroup: false, manageMembers: false },
      updatedAt: serverTimestamp(),
    }, { merge: true });
    return { groupName: group.name || 'grupo de estudo', viceLeader };
  });
  await db().collection('users').doc(memberUid).collection('notifications').doc(`group_role_${groupId}`).set(notificationPayload({
    type: 'group_role',
    title: result.viceLeader ? 'Você agora é vice-líder' : 'Função atualizada',
    message: result.viceLeader
      ? `Você foi promovido a vice-líder do grupo ${result.groupName}.`
      : `Sua função no grupo ${result.groupName} foi alterada para membro.`,
    groupId,
    status: 'completed',
  }), { merge: true });
  return { status: 'updated', ...result };
}

async function removeMember({ managerUid, groupId, memberUid }) {
  if (!managerUid || !groupId || !memberUid) throw Object.assign(new Error('Dados inválidos.'), { code: 'invalid-argument' });
  const groupRef = db().collection('study_groups').doc(groupId);
  const managerRef = groupRef.collection('members').doc(managerUid);
  const memberRef = groupRef.collection('members').doc(memberUid);
  const profileRef = db().collection('users').doc(memberUid).collection('gamification').doc('profile');
  const result = await db().runTransaction(async (transaction) => {
    const [groupSnapshot, managerSnapshot, memberSnapshot, profileSnapshot] = await Promise.all([
      transaction.get(groupRef), transaction.get(managerRef), transaction.get(memberRef), transaction.get(profileRef),
    ]);
    if (!groupSnapshot.exists || !memberSnapshot.exists) throw Object.assign(new Error('Grupo ou membro não encontrado.'), { code: 'not-found' });
    const group = groupSnapshot.data() || {};
    const managerData = { uid: managerUid, ...(managerSnapshot.data() || {}) };
    const memberData = memberSnapshot.data() || {};
    if (!manager(group, managerData)) throw Object.assign(new Error('Sem permissão para remover membros.'), { code: 'permission-denied' });
    if (memberUid === group.ownerId || (memberData.role === 'vice_leader' && group.ownerId !== managerUid)) throw Object.assign(new Error('Este membro está protegido.'), { code: 'failed-precondition' });
    transaction.delete(memberRef);
    transaction.set(groupRef, { memberCount: increment(-1), updatedAt: serverTimestamp() }, { merge: true });
    const profile = profileSnapshot.data() || {};
    transaction.set(profileRef, {
      groupIds: arrayRemove(groupId),
      lastRemovedGroupId: groupId,
      ...(profile.mainGroupId === groupId ? { mainGroupId: null, mainGroupName: null } : {}),
      socialUpdatedAt: serverTimestamp(),
    }, { merge: true });
    return { groupName: group.name || 'grupo de estudo' };
  });
  await db().collection('users').doc(memberUid).collection('notifications').doc(`group_removed_${groupId}`).set(notificationPayload({
    type: 'group_removed',
    title: 'Você foi removido do grupo',
    message: `Sua participação no grupo ${result.groupName} foi encerrada pela administração.`,
    groupId,
    status: 'completed',
  }), { merge: true });
  await removeCurrentGroupRankingMember({ groupId, memberUid });
  return { status: 'removed', ...result };
}

module.exports = {
  createJoinRequest,
  respondJoinRequest,
  joinPrivateGroupByCode,
  leaveGroup,
  updateMemberRole,
  removeMember,
  listGroups,
  syncGroupMemberCount,
  syncGroupDirectory,
  __test: { manager, memberName, publicGroupPayload, syncGroupDirectoryWithDb, syncGroupMemberCountWithDb },
};
