const admin = require('firebase-admin');

const LEGACY_ADMIN_UID = 'OLoJi457GQNE2eTSOcz9DAD6ppZ2';
const USER_STATUSES = new Set(['active', 'blocked', 'disabled']);
const ACCESS_ROLES = new Set(['student', 'admin']);
const ADMIN_ROLES = new Set(['admin', 'super_admin']);
const GROUP_ACTIONS = new Set(['block', 'unblock', 'set_visibility', 'update_identity', 'remove_member']);

const firestore = () => admin.firestore();
const timestamp = () => admin.firestore.FieldValue.serverTimestamp();

const asText = (value, max = 240) => String(value ?? '').trim().slice(0, max);
const asUid = (value, field = 'targetUid') => {
  const uid = asText(value, 128);
  if (!uid || uid.includes('/')) throw Object.assign(new Error(`${field} invalido.`), { code: 'invalid-argument' });
  return uid;
};

const compactObject = (value, depth = 0) => {
  if (value == null) return null;
  if (typeof value === 'boolean' || typeof value === 'number') return value;
  if (typeof value === 'string') return value.slice(0, 500);
  if (depth >= 2) return '[resumo omitido]';
  if (Array.isArray(value)) return value.slice(0, 20).map((item) => compactObject(item, depth + 1));
  if (typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).slice(0, 30).map(([key, item]) => [key, compactObject(item, depth + 1)]));
  }
  return String(value).slice(0, 500);
};

const isAdminAccess = (uid, user = {}) => {
  const access = user.access || {};
  const permissions = access.permissions || user.permissions || {};
  return uid === LEGACY_ADMIN_UID
    || access.role === 'admin'
    || user.role === 'admin'
    || ADMIN_ROLES.has(access.adminRole)
    || ADMIN_ROLES.has(user.adminRole)
    || permissions.adminPanel === true;
};

const assertAdmin = async ({ uid, token = {} }) => {
  if (!uid) throw Object.assign(new Error('Login obrigatorio.'), { code: 'unauthenticated' });
  const snapshot = await firestore().collection('users').doc(uid).get();
  const actor = snapshot.data() || {};
  if (!isAdminAccess(uid, actor)) {
    throw Object.assign(new Error('Somente administradores podem executar esta acao.'), { code: 'permission-denied' });
  }
  return {
    uid,
    email: asText(token.email || actor.email || '', 320),
  };
};

const writeAudit = async ({ action, actor, targetUid = null, targetPath = null, targetType, payloadSummary = {}, before = null, after = null, status = 'success', error = null }) => {
  const ref = firestore().collection('admin_audit_logs').doc();
  await ref.set({
    action,
    actorUid: actor.uid,
    actorEmail: actor.email || null,
    targetUid,
    targetPath,
    targetType,
    payloadSummary: compactObject(payloadSummary),
    before: compactObject(before),
    after: compactObject(after),
    createdAt: timestamp(),
    status,
    error: error ? asText(error, 800) : null,
  });
  return ref.id;
};

const withAudit = async (context, operation) => {
  try {
    const result = await operation();
    const logId = await writeAudit({ ...context, after: result?.auditAfter ?? context.after, status: 'success' });
    return { ...result, auditAfter: undefined, auditLogId: logId };
  } catch (error) {
    await writeAudit({ ...context, status: 'error', error: error?.message || error }).catch(() => {});
    throw error;
  }
};

const numeric = (...values) => {
  for (const value of values) {
    const number = Number(value);
    if (Number.isFinite(number)) return Math.max(0, number);
  }
  return 0;
};

const studyStats = (record = {}) => ({
  minutes: numeric(record.tempoEstudadoMinutos, record.duracaoMinutos, record.minutes),
  questions: numeric(record.questoesFeitas, record.totalQuestoes, record.questions),
  correct: numeric(record.acertos, record.totalAcertos, record.correct),
});

const simulationStats = (simulation = {}) => {
  const summary = simulation.resumo || {};
  return {
    minutes: numeric(simulation.tempoEstudadoMinutos, simulation.duracaoMinutos, simulation.tempoGastoMinutos, simulation.tempoTotalMinutos),
    questions: numeric(summary.totalQuestoes, simulation.totalQuestoes, simulation.questoesFeitas),
    correct: numeric(summary.totalAcertos, summary.acertos, simulation.totalAcertos, simulation.acertos),
  };
};

const calculateUserStats = async (uid) => {
  const userRef = firestore().collection('users').doc(uid);
  const [records, simulations] = await Promise.all([
    userRef.collection('registrosEstudo').get(),
    userRef.collection('simulados').get(),
  ]);
  const totals = [...records.docs.map((item) => studyStats(item.data())), ...simulations.docs.map((item) => simulationStats(item.data()))]
    .reduce((acc, item) => ({
      minutes: acc.minutes + item.minutes,
      questions: acc.questions + item.questions,
      correct: acc.correct + item.correct,
    }), { minutes: 0, questions: 0, correct: 0 });
  const payload = {
    totalHorasMinutos: totals.minutes,
    totalQuestoes: totals.questions,
    totalAcertos: totals.correct,
    accuracy: totals.questions > 0 ? Number(((totals.correct / totals.questions) * 100).toFixed(2)) : 0,
    source: 'admin-cloud-function',
    lastUpdated: timestamp(),
  };
  await userRef.collection('stats').doc('geral').set(payload, { merge: true });
  return { uid, ...totals, accuracy: payload.accuracy };
};

const updateUserStatus = async ({ actor, targetUid, status }) => {
  const uid = asUid(targetUid);
  if (!USER_STATUSES.has(status)) throw Object.assign(new Error('Status de usuario nao permitido.'), { code: 'invalid-argument' });
  if (uid === actor.uid && status !== 'active') throw Object.assign(new Error('O admin nao pode bloquear ou desativar a propria conta.'), { code: 'failed-precondition' });
  const userRef = firestore().collection('users').doc(uid);
  const snapshot = await userRef.get();
  if (!snapshot.exists) throw Object.assign(new Error('Usuario nao encontrado.'), { code: 'not-found' });
  const before = { status: snapshot.data()?.status || 'active', disabled: snapshot.data()?.disabled === true };
  const disabled = status !== 'active';
  return withAudit({ action: `user.${status}`, actor, targetUid: uid, targetPath: userRef.path, targetType: 'user', payloadSummary: { status }, before }, async () => {
    await admin.auth().updateUser(uid, { disabled });
    await userRef.set({ status, disabled, statusUpdatedAt: timestamp(), statusUpdatedBy: actor.uid }, { merge: true });
    return { targetUid: uid, status, disabled, auditAfter: { status, disabled } };
  });
};

const updateUserAccess = async ({ actor, targetUid, access = {} }) => {
  const uid = asUid(targetUid);
  const currentRef = firestore().collection('users').doc(uid);
  const snapshot = await currentRef.get();
  if (!snapshot.exists) throw Object.assign(new Error('Usuario nao encontrado.'), { code: 'not-found' });
  const current = snapshot.data()?.access || {};
  const role = access.role == null ? current.role || 'student' : asText(access.role, 32);
  if (!ACCESS_ROLES.has(role)) throw Object.assign(new Error('Perfil de acesso invalido.'), { code: 'invalid-argument' });
  const adminRole = access.adminRole == null || access.adminRole === '' ? null : asText(access.adminRole, 32);
  if (adminRole && !ADMIN_ROLES.has(adminRole)) throw Object.assign(new Error('Papel administrativo invalido.'), { code: 'invalid-argument' });
  const allowedPermissionKeys = ['adminPanel', 'manageBroadcasts', 'manageTemplates', 'viewAdminAnalytics'];
  const permissions = Object.fromEntries(allowedPermissionKeys.map((key) => [key, access.permissions?.[key] === true]));
  if (uid === actor.uid && role !== 'admin' && !permissions.adminPanel) {
    throw Object.assign(new Error('O admin nao pode remover o proprio acesso administrativo.'), { code: 'failed-precondition' });
  }
  const next = { ...current, role, adminRole, permissions };
  return withAudit({ action: 'user.access_updated', actor, targetUid: uid, targetPath: currentRef.path, targetType: 'user', payloadSummary: next, before: current }, async () => {
    await currentRef.set({ access: next, accessUpdatedAt: timestamp(), accessUpdatedBy: actor.uid }, { merge: true });
    return { targetUid: uid, access: next, auditAfter: next };
  });
};

const recalculateUserStats = async ({ actor, targetUid = null }) => {
  const targetUids = targetUid
    ? [asUid(targetUid)]
    : (await firestore().collection('users').select().get()).docs.map((item) => item.id);
  return withAudit({ action: targetUid ? 'user.stats_recalculated' : 'maintenance.stats_recalculated', actor, targetUid: targetUid || null, targetPath: targetUid ? `users/${targetUid}/stats/geral` : 'users/*/stats/geral', targetType: targetUid ? 'user_stats' : 'maintenance', payloadSummary: { requestedUsers: targetUids.length } }, async () => {
    const results = [];
    for (const uid of targetUids) results.push(await calculateUserStats(uid));
    return { processedCount: results.length, users: targetUid ? results : undefined, auditAfter: { processedCount: results.length } };
  });
};

const recomputeUserGamification = async ({ actor, targetUid, gamification }) => {
  const uid = asUid(targetUid);
  return withAudit({ action: 'gamification.recomputed', actor, targetUid: uid, targetPath: `users/${uid}/gamification/profile`, targetType: 'gamification_profile', payloadSummary: {} }, async () => {
    const result = await gamification.recomputeUserGamification(uid);
    return { ...result, auditAfter: result };
  });
};

const sendUserNotification = async ({ actor, targetUid, title, message, type = 'admin' }) => {
  const uid = asUid(targetUid);
  const safeTitle = asText(title, 120);
  const safeMessage = asText(message, 1200);
  if (!safeTitle || !safeMessage) throw Object.assign(new Error('Titulo e mensagem sao obrigatorios.'), { code: 'invalid-argument' });
  const ref = firestore().collection('users').doc(uid).collection('notifications').doc();
  return withAudit({ action: 'notification.sent', actor, targetUid: uid, targetPath: ref.path, targetType: 'notification', payloadSummary: { title: safeTitle, type } }, async () => {
    await ref.set({ title: safeTitle, message: safeMessage, type: asText(type, 48) || 'admin', isRead: false, createdAt: timestamp(), createdBy: actor.uid });
    return { targetUid: uid, notificationId: ref.id, auditAfter: { notificationId: ref.id } };
  });
};

const sendBroadcast = async ({ actor, title, message, targetUserIds = [], segment = null }) => {
  const safeTitle = asText(title, 120);
  const safeMessage = asText(message, 1600);
  const targets = [...new Set((targetUserIds || []).map((item) => asUid(item, 'targetUserIds')).slice(0, 5000))];
  if (!safeTitle || !safeMessage) throw Object.assign(new Error('Titulo e mensagem sao obrigatorios.'), { code: 'invalid-argument' });
  const ref = firestore().collection('system_broadcasts').doc();
  return withAudit({ action: 'broadcast.sent', actor, targetPath: ref.path, targetType: 'broadcast', payloadSummary: { title: safeTitle, audienceCount: targets.length, segment: asText(segment, 80) } }, async () => {
    const createdAt = timestamp();
    await ref.set({
      title: safeTitle,
      message: safeMessage,
      targetUserIds: targets,
      segment: asText(segment, 80) || null,
      audienceCount: targets.length,
      status: 'sent',
      active: true,
      type: 'admin',
      category: 'administrative',
      timestamp: createdAt,
      createdAt,
      createdBy: actor.uid,
      createdByEmail: actor.email || null,
    });
    return { broadcastId: ref.id, audienceCount: targets.length, auditAfter: { broadcastId: ref.id, audienceCount: targets.length } };
  });
};

const moderateStudyGroup = async ({ actor, groupId, action, payload = {} }) => {
  const id = asUid(groupId, 'groupId');
  if (!GROUP_ACTIONS.has(action)) throw Object.assign(new Error('Acao de moderacao invalida.'), { code: 'invalid-argument' });
  const groupRef = firestore().collection('study_groups').doc(id);
  const snapshot = await groupRef.get();
  if (!snapshot.exists) throw Object.assign(new Error('Grupo nao encontrado.'), { code: 'not-found' });
  const before = compactObject(snapshot.data());
  return withAudit({ action: `group.${action}`, actor, targetPath: groupRef.path, targetType: 'study_group', payloadSummary: payload, before }, async () => {
    if (action === 'block' || action === 'unblock') {
      const status = action === 'block' ? 'blocked' : 'active';
      await groupRef.set({ status, moderatedAt: timestamp(), moderatedBy: actor.uid }, { merge: true });
      return { groupId: id, status, auditAfter: { status } };
    }
    if (action === 'set_visibility') {
      const visibility = payload.visibility;
      if (!['public', 'private'].includes(visibility)) throw Object.assign(new Error('Visibilidade invalida.'), { code: 'invalid-argument' });
      await groupRef.set({ visibility, moderatedAt: timestamp(), moderatedBy: actor.uid }, { merge: true });
      return { groupId: id, visibility, auditAfter: { visibility } };
    }
    if (action === 'update_identity') {
      const update = { moderatedAt: timestamp(), moderatedBy: actor.uid };
      if (payload.name != null) update.name = asText(payload.name, 80);
      if (payload.photoURL != null) update.photoURL = asText(payload.photoURL, 1000);
      if (!update.name && !update.photoURL) throw Object.assign(new Error('Informe nome ou foto.'), { code: 'invalid-argument' });
      await groupRef.set(update, { merge: true });
      return { groupId: id, auditAfter: update };
    }
    const memberUid = asUid(payload.memberUid, 'memberUid');
    if (memberUid === snapshot.data()?.ownerId) throw Object.assign(new Error('Transfira a lideranca antes de remover o dono.'), { code: 'failed-precondition' });
    const memberRef = groupRef.collection('members').doc(memberUid);
    const profileRef = firestore().collection('users').doc(memberUid).collection('gamification').doc('profile');
    await firestore().runTransaction(async (transaction) => {
      const [member, profile] = await Promise.all([transaction.get(memberRef), transaction.get(profileRef)]);
      if (!member.exists) throw Object.assign(new Error('Membro nao encontrado.'), { code: 'not-found' });
      const profileData = profile.data() || {};
      const groupIds = (profileData.groupIds || []).filter((item) => item !== id);
      transaction.delete(memberRef);
      transaction.set(groupRef, { memberCount: Math.max(0, Number(snapshot.data()?.memberCount || 1) - 1), updatedAt: timestamp() }, { merge: true });
      transaction.set(profileRef, {
        groupIds,
        mainGroupId: profileData.mainGroupId === id ? (groupIds[0] || null) : (profileData.mainGroupId || null),
        mainGroupName: profileData.mainGroupId === id ? null : (profileData.mainGroupName || null),
        updatedAt: timestamp(),
      }, { merge: true });
    });
    return { groupId: id, memberUid, removed: true, auditAfter: { memberUid, removed: true } };
  });
};

const validWeekId = (value) => {
  const weekId = asText(value, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(weekId)) throw Object.assign(new Error('Semana invalida. Use AAAA-MM-DD.'), { code: 'invalid-argument' });
  return weekId;
};

const simulateLeagueClosure = async ({ actor, weekId, gamification }) => {
  const targetWeekId = validWeekId(weekId);
  return withAudit({ action: 'league.week_simulated', actor, targetPath: `weekly_rankings/${targetWeekId}`, targetType: 'league_week', payloadSummary: { weekId: targetWeekId } }, async () => {
    const result = await gamification.simulateWeeklyGamificationClosure(targetWeekId);
    return { ...result, auditAfter: { weekId: result.weekId, cohorts: result.cohortCount, participants: result.participantCount } };
  });
};

const recomputeLeagueWeek = async ({ actor, weekId, gamification }) => {
  const targetWeekId = validWeekId(weekId);
  return withAudit({ action: 'league.week_reprocessed', actor, targetPath: `weekly_rankings/${targetWeekId}`, targetType: 'league_week', payloadSummary: { weekId: targetWeekId } }, async () => {
    const result = await gamification.closeWeeklyGamification(targetWeekId);
    return { ...result, auditAfter: result };
  });
};

const exportSegment = async ({ actor, targetUserIds = [] }) => {
  const ids = [...new Set((targetUserIds || []).map((item) => asUid(item, 'targetUserIds')).slice(0, 5000))];
  const refs = ids.map((uid) => firestore().collection('users').doc(uid));
  const snapshots = refs.length ? await firestore().getAll(...refs) : [];
  const rows = snapshots.filter((item) => item.exists).map((item) => {
    const user = item.data() || {};
    return {
      uid: item.id,
      name: asText(user.name || user.displayName || user.nome || '', 160),
      email: asText(user.email || '', 320),
      status: asText(user.status || 'active', 32),
      profile: asText(user.perfil || user.access?.role || user.role || '', 80),
    };
  });
  return withAudit({ action: 'segment.exported', actor, targetPath: 'users', targetType: 'user_segment', payloadSummary: { requested: ids.length } }, async () => ({
    rows,
    exportedCount: rows.length,
    auditAfter: { exportedCount: rows.length },
  }));
};

module.exports = {
  assertAdmin,
  exportSegment,
  isAdminAccess,
  moderateStudyGroup,
  recalculateUserStats,
  recomputeLeagueWeek,
  recomputeUserGamification,
  sendBroadcast,
  sendUserNotification,
  simulateLeagueClosure,
  updateUserAccess,
  updateUserStatus,
  writeAudit,
  __test: { asText, compactObject, isAdminAccess, numeric, simulationStats, studyStats },
};
