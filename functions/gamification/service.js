const admin = require('firebase-admin');
const { FieldValue } = require('firebase-admin/firestore');

if (!admin.apps.length) {
  admin.initializeApp({ projectId: process.env.GCLOUD_PROJECT || process.env.GOOGLE_CLOUD_PROJECT || 'dashboard-pmba' });
}

const db = () => admin.firestore();
const serverTimestamp = () => FieldValue.serverTimestamp();
const userDeletionStarted = async (uid) => (await db().collection('system_deleted_users').doc(uid).get()).exists;
const HISTORICAL_STREAK_RECOVERY_VERSION = '2026-08-28-persisted-baseline-v3';
const HISTORICAL_STREAK_RECOVERY_BATCH_SIZE = 20;
let domainPromise;
const domain = () => {
  if (!domainPromise) domainPromise = import('./domain.mjs');
  return domainPromise;
};

const dataWithId = (snapshot) => snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
const timestampMillis = (value) => {
  if (value?.toMillis) return value.toMillis();
  if (value?.toDate) return value.toDate().getTime();
  const date = new Date(value || 0);
  return Number.isNaN(date.getTime()) ? 0 : date.getTime();
};

const userNameFrom = (userDoc = {}, authUser = null) => (
  userDoc.displayName
  || userDoc.nome
  || userDoc.name
  || authUser?.displayName
  || authUser?.email?.split('@')[0]
  || 'Estudante'
);

const isCompletedSchedule = (schedule = {}) => {
  const totalWeeks = Number(schedule.totalSemanasNecessarias || schedule.totalSemanas || 0);
  const templateSlots = Array.isArray(schedule.semanaTemplate) ? schedule.semanaTemplate.filter((slot) => !slot?.isRevisaoAuto) : [];
  const progressWeeks = Object.values(schedule.progresso || {});
  if (!totalWeeks || !templateSlots.length || progressWeeks.length < totalWeeks) return false;
  return progressWeeks.slice(0, totalWeeks).every((week) => (
    templateSlots.every((slot) => week?.[slot.slotId] === true)
  ));
};

const loadCycleRounds = async (uid, cycles) => {
  const snapshots = await Promise.all(cycles.map((cycle) => (
    db().collection('users').doc(uid).collection('ciclos').doc(cycle.id).collection('rodadas').get()
  )));
  return snapshots.flatMap((snapshot, cycleIndex) => snapshot.docs.map((item) => ({
    id: item.id,
    cycleId: cycles[cycleIndex].id,
    ...item.data(),
  })));
};

const loadUserGamificationSources = async (uid) => {
  const userRef = db().collection('users').doc(uid);
  const [
    userSnapshot,
    profileSnapshot,
    recordsSnapshot,
    simulationsSnapshot,
    goalsSnapshot,
    cyclesSnapshot,
    cycleReviewsSnapshot,
    schedulesSnapshot,
    achievementsSnapshot,
    xpEventsSnapshot,
    questionRewardsSnapshot,
    ownedGroupsSnapshot,
  ] = await Promise.all([
    userRef.get(),
    userRef.collection('gamification').doc('profile').get(),
    userRef.collection('registrosEstudo').get(),
    userRef.collection('simulados').get(),
    userRef.collection('metas').get(),
    userRef.collection('ciclos').get(),
    userRef.collection('revisoesCiclo').get(),
    userRef.collection('cronogramas').get(),
    userRef.collection('gamification').doc('profile').collection('achievements').get(),
    userRef.collection('gamification').doc('profile').collection('xp_events').get(),
    userRef.collection('question_reward_sources').get(),
    db().collection('study_groups').where('ownerId', '==', uid).get(),
  ]);
  const cycles = dataWithId(cyclesSnapshot);
  const cycleRounds = await loadCycleRounds(uid, cycles);
  let authUser = null;
  if (!process.env.FIRESTORE_EMULATOR_HOST || process.env.FIREBASE_AUTH_EMULATOR_HOST) {
    try { authUser = await admin.auth().getUser(uid); } catch {}
  }
  return {
    userRef,
    userExists: userSnapshot.exists,
    user: userSnapshot.exists ? userSnapshot.data() : {},
    authUser,
    profileRef: userRef.collection('gamification').doc('profile'),
    profile: profileSnapshot.exists ? profileSnapshot.data() : {},
    records: dataWithId(recordsSnapshot),
    simulations: dataWithId(simulationsSnapshot),
    goals: dataWithId(goalsSnapshot),
    cycles,
    cycleReviews: dataWithId(cycleReviewsSnapshot),
    schedules: dataWithId(schedulesSnapshot),
    cycleRounds,
    achievements: dataWithId(achievementsSnapshot),
    xpEvents: dataWithId(xpEventsSnapshot),
    questionRewards: dataWithId(questionRewardsSnapshot),
    ownedGroups: dataWithId(ownedGroupsSnapshot),
  };
};

const getMigrationCutoffMillis = (profile = {}) => (
  timestampMillis(profile.migration?.cutoffAt || profile.migrationCutoffAt)
);

const sourceCreatedMillis = (source = {}) => timestampMillis(
  source.attemptedAt || source.timestamp || source.criadoEm || source.dataCriacao || source.createdAt || source.data || source.date,
);

const planPublicIdentity = (plan = {}, type) => {
  const edital = typeof plan.edital === 'object' && plan.edital ? plan.edital : {};
  const editalId = plan.editalId || plan.templateId || plan.templateOrigem || edital.id || null;
  const normalizedEditalId = String(editalId || '').trim().toLocaleLowerCase('pt-BR');
  if (normalizedEditalId === 'manual') return null;
  const hasEditalIdentity = Boolean(
    normalizedEditalId
    || plan.editalNome
    || Object.keys(edital).length,
  );
  if (!hasEditalIdentity) return null;
  const name = plan.editalNome
    || edital.nome
    || edital.name
    || plan.instituicao
    || plan.orgao
    || plan.templateNome
    || plan.titulo
    || plan.nome
    || plan.name
    || null;
  if (!name) return null;
  return {
    id: String(editalId || `${type}:${name}`),
    name: String(name).slice(0, 120),
    logoURL: plan.logoUrl
      || plan.logo
      || plan.editalLogoUrl
      || edital.logoUrl
      || edital.logoURL
      || edital.logo
      || null,
    type,
  };
};

const buildPublicEditais = (sources) => {
  const unique = new Map();
  const activeCycles = (sources.cycles || []).filter((plan) => plan?.ativo === true && plan?.arquivado !== true);
  const activeSchedules = (sources.schedules || []).filter((plan) => plan?.ativo === true && plan?.arquivado !== true);
  [...activeCycles.map((item) => planPublicIdentity(item, 'cycle')), ...activeSchedules.map((item) => planPublicIdentity(item, 'schedule'))]
    .filter(Boolean)
    .forEach((item) => {
      const key = item.id !== 'manual' ? item.id : item.name.toLocaleLowerCase('pt-BR');
      if (!unique.has(key)) unique.set(key, item);
    });
  return [...unique.values()].slice(0, 6);
};

const comparableValue = (value) => {
  if (value?.toMillis) return { __timestampMillis: value.toMillis() };
  if (value?.path && typeof value.path === 'string') return { __documentPath: value.path };
  if (Array.isArray(value)) return value.map(comparableValue);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, nested]) => [key, comparableValue(nested)]));
  }
  return value === undefined ? null : value;
};

const functionalValuesEqual = (left, right) => (
  JSON.stringify(comparableValue(left)) === JSON.stringify(comparableValue(right))
);

const pickPayloadFields = (source = {}, payload = {}) => Object.fromEntries(
  Object.keys(payload).map((key) => [key, source?.[key]]),
);

const payloadChanged = (current = {}, payload = {}) => (
  !functionalValuesEqual(pickPayloadFields(current, payload), payload)
);

const AUDIT_TIMESTAMP_FIELDS = new Set([
  'updatedAt',
  'eligibilityUpdatedAt',
  'publicPlanningUpdatedAt',
  'monthlyMetricsUpdatedAt',
  'weeklyMetricsUpdatedAt',
  'updatedPositionAt',
  'positionChangedAt',
]);

const withoutAuditTimestamps = (payload = {}) => Object.fromEntries(
  Object.entries(payload).filter(([key]) => !AUDIT_TIMESTAMP_FIELDS.has(key)),
);

const setIfChanged = async (ref, payload, {
  snapshot = null,
  merge = true,
  timestamps = { updatedAt: serverTimestamp() },
} = {}) => {
  const currentSnapshot = snapshot || await ref.get();
  const current = currentSnapshot.exists ? (currentSnapshot.data() || {}) : {};
  if (currentSnapshot.exists && !payloadChanged(current, payload)) return false;
  await ref.set({ ...payload, ...timestamps }, { merge });
  return true;
};

const deleteIfExists = async (ref, snapshot = null) => {
  const currentSnapshot = snapshot || await ref.get();
  if (!currentSnapshot.exists) return false;
  await ref.delete();
  return true;
};

const buildPublicFocusSubjects = (records, rules) => {
  const subjects = new Map();
  records.forEach((record) => {
    const name = record.disciplinaNome
      || record.disciplina
      || record.materiaNome
      || record.materia
      || record.subjectName;
    if (!name) return;
    const normalizedName = String(name).trim();
    if (!normalizedName || ['disciplina', 'desconhecida'].includes(normalizedName.toLocaleLowerCase('pt-BR'))) return;
    const metrics = rules.getStudyMetrics(record);
    const key = normalizedName.toLocaleLowerCase('pt-BR');
    const current = subjects.get(key) || { name: normalizedName, minutes: 0, questions: 0, records: 0 };
    current.minutes += Number(metrics.minutes || 0);
    current.questions += Number(metrics.questions || 0);
    current.records += 1;
    subjects.set(key, current);
  });
  return [...subjects.values()]
    .sort((a, b) => b.minutes - a.minutes || b.questions - a.questions || b.records - a.records || a.name.localeCompare(b.name, 'pt-BR'))
    .slice(0, 4);
};

const syncGroupWeeklyMember = async ({ groupId, weekId, uid, member = null }) => {
  const groupRef = db().collection('study_groups').doc(groupId);
  const memberRef = groupRef.collection('weekly_rankings').doc(weekId).collection('members').doc(uid);
  await db().runTransaction(async (transaction) => {
    const [groupSnapshot, previousSnapshot] = await Promise.all([
      transaction.get(groupRef),
      transaction.get(memberRef),
    ]);
    if (!groupSnapshot.exists) return;
    const group = groupSnapshot.data() || {};
    const previous = previousSnapshot.data() || {};
    const sameWeek = group.weeklyMetricsWeekId === weekId;
    const base = {
      xp: sameWeek ? Number(group.weeklyXP || 0) : 0,
      minutes: sameWeek ? Number(group.weeklyMinutes || 0) : 0,
      questions: sameWeek ? Number(group.weeklyQuestions || 0) : 0,
    };
    const next = member || {};
    const groupPayload = {
      weeklyMetricsWeekId: weekId,
      weeklyXP: Math.max(0, base.xp - Number(previous.competitiveXP || previous.weeklyXP || 0) + Number(next.competitiveXP || next.weeklyXP || 0)),
      weeklyMinutes: Math.max(0, base.minutes - Number(previous.minutes || 0) + Number(next.minutes || 0)),
      weeklyQuestions: Math.max(0, base.questions - Number(previous.questions || 0) + Number(next.questions || 0)),
    };
    if (payloadChanged(group, groupPayload)) {
      transaction.set(groupRef, { ...groupPayload, weeklyMetricsUpdatedAt: serverTimestamp() }, { merge: true });
    }
    const functionalMember = withoutAuditTimestamps(member || {});
    if (member && (!previousSnapshot.exists || payloadChanged(previous, functionalMember))) {
      transaction.set(memberRef, { ...functionalMember, updatedAt: serverTimestamp() }, { merge: true });
    }
    if (!member && previousSnapshot.exists) transaction.delete(memberRef);
  });
};

const syncGroupMonthlyMember = async ({ groupId, monthId, uid, member = null }) => {
  const groupRef = db().collection('study_groups').doc(groupId);
  const rankingMemberRef = groupRef.collection('monthly_rankings').doc(monthId).collection('members').doc(uid);
  const groupMemberRef = groupRef.collection('members').doc(uid);
  await db().runTransaction(async (transaction) => {
    const [groupSnapshot, groupMemberSnapshot, rankingMemberSnapshot] = await Promise.all([
      transaction.get(groupRef),
      transaction.get(groupMemberRef),
      transaction.get(rankingMemberRef),
    ]);
    if (!groupSnapshot.exists || !groupMemberSnapshot.exists) {
      if (rankingMemberSnapshot.exists) transaction.delete(rankingMemberRef);
      return;
    }
    const groupMember = groupMemberSnapshot.data() || {};
    const groupMemberPayload = {
      monthlyMetricsMonthId: monthId,
      monthlyMinutes: Number(member?.minutes || 0),
      monthlyQuestions: Number(member?.questions || 0),
      monthlyCorrect: Number(member?.correct || 0),
    };
    if (payloadChanged(groupMember, groupMemberPayload)) {
      transaction.set(groupMemberRef, { ...groupMemberPayload, monthlyMetricsUpdatedAt: serverTimestamp() }, { merge: true });
    }
    const functionalMember = withoutAuditTimestamps(member || {});
    if (member && (!rankingMemberSnapshot.exists || payloadChanged(rankingMemberSnapshot.data() || {}, functionalMember))) {
      transaction.set(rankingMemberRef, { ...functionalMember, updatedAt: serverTimestamp() }, { merge: true });
    }
    if (!member && rankingMemberSnapshot.exists) transaction.delete(rankingMemberRef);
  });
};

const buildMonthlyGroupMember = async ({ uid, rules, now = new Date() }) => {
  const sources = await loadUserGamificationSources(uid);
  if (!sources.userExists || await userDeletionStarted(uid)) {
    return { sources, monthId: rules.getMonthId(now), member: null };
  }
  const periods = rules.calculateRankingPeriodMetrics({
    records: sources.records,
    simulations: sources.simulations,
    questionRewards: sources.questionRewards,
    now,
  });
  const monthly = periods.monthly;
  const status = String(sources.user.status || (sources.user.disabled ? 'disabled' : 'active')).toLowerCase();
  const accountActive = !sources.user.disabled && !['blocked', 'disabled'].includes(status);
  const member = accountActive && monthly.hasActivity ? {
    uid,
    displayName: userNameFrom(sources.user, sources.authUser),
    photoURL: sources.user.photoURL || sources.authUser?.photoURL || null,
    minutes: monthly.minutes,
    questions: monthly.questions,
    correct: monthly.correct,
    accuracy: monthly.questions ? Number(((monthly.correct / monthly.questions) * 100).toFixed(2)) : 0,
    errors: Math.max(0, monthly.questions - monthly.correct),
    accountActive,
    accountStatus: status,
    rankingEligible: true,
    periodType: 'monthly',
    monthId: monthly.monthId,
    ruleVersion: rules.GAMIFICATION_RULE_VERSION,
    updatedAt: serverTimestamp(),
  } : null;
  return { sources, monthId: monthly.monthId, member };
};

const refreshUserGroupMonthlyRankings = async (uid, { groupIds = null } = {}) => {
  if (!uid) return { uid, groupsUpdated: 0 };
  const rules = await domain();
  const state = await buildMonthlyGroupMember({ uid, rules });
  const targetGroupIds = [...new Set((groupIds || state.sources.profile.groupIds || []).filter(Boolean))];
  await Promise.all(targetGroupIds.map((groupId) => syncGroupMonthlyMember({
    groupId,
    monthId: state.monthId,
    uid,
    member: state.member,
  })));
  return { uid, monthId: state.monthId, groupsUpdated: targetGroupIds.length, hasActivity: Boolean(state.member) };
};

const refreshStudyGroupMonthlyRankings = async () => {
  const rules = await domain();
  const now = new Date();
  const monthId = rules.getMonthId(now);
  const groupsSnapshot = await db().collection('study_groups').get();
  const rows = [];
  for (const groupSnapshot of groupsSnapshot.docs) {
    const membersSnapshot = await groupSnapshot.ref.collection('members').get();
    membersSnapshot.docs.forEach((memberSnapshot) => rows.push({
      groupId: groupSnapshot.id,
      uid: memberSnapshot.data()?.uid || memberSnapshot.id,
    }));
  }
  const stateByUid = new Map();
  const getState = (uid) => {
    if (!stateByUid.has(uid)) stateByUid.set(uid, buildMonthlyGroupMember({ uid, rules, now }));
    return stateByUid.get(uid);
  };
  let updated = 0;
  let withActivity = 0;
  for (let cursor = 0; cursor < rows.length; cursor += 10) {
    const chunk = rows.slice(cursor, cursor + 10);
    const results = await Promise.all(chunk.map(async ({ groupId, uid }) => {
      const state = await getState(uid);
      await syncGroupMonthlyMember({ groupId, monthId, uid, member: state.member });
      return Boolean(state.member);
    }));
    updated += chunk.length;
    withActivity += results.filter(Boolean).length;
  }
  console.info('Study group monthly rankings refreshed', {
    monthId,
    groups: groupsSnapshot.size,
    uniqueUsers: stateByUid.size,
    membersUpdated: updated,
    membersWithActivity: withActivity,
  });
  return {
    monthId,
    groups: groupsSnapshot.size,
    uniqueUsers: stateByUid.size,
    membersUpdated: updated,
    membersWithActivity: withActivity,
  };
};

const buildPositionPayload = ({ member, positions }) => {
  const stored = member.positions || {};
  const changedMetrics = ['minutes', 'questions'].filter((metric) => (
    Number(stored[metric] || 0) > 0
    && Number(stored[metric]) !== Number(positions[metric])
  ));
  const payload = { positions };
  if (changedMetrics.length) {
    payload.previousPositions = { ...(member.previousPositions || {}) };
    payload.positionDeltas = { ...(member.positionDeltas || {}) };
    changedMetrics.forEach((metric) => {
      payload.previousPositions[metric] = Number(stored[metric]);
      payload.positionDeltas[metric] = Number(stored[metric]) - Number(positions[metric]);
    });
  }
  return { payload, changedMetrics };
};

const countPositionForMember = async ({ membersRef, memberSnapshot, metric }) => {
  const member = memberSnapshot.data() || {};
  const secondaryMetric = metric === 'minutes' ? 'questions' : 'minutes';
  const ahead = membersRef
    .where('rankingEligible', '==', true)
    .orderBy(metric, 'desc')
    .orderBy(secondaryMetric, 'desc')
    .orderBy('correct', 'desc')
    .orderBy(admin.firestore.FieldPath.documentId(), 'asc')
    .endBefore(
      Number(member[metric] || 0),
      Number(member[secondaryMetric] || 0),
      Number(member.correct || 0),
      memberSnapshot.id,
    );
  const countSnapshot = await ahead.count().get();
  return Number(countSnapshot.data().count || 0) + 1;
};

const updateRankingMetricPositions = async ({ membersRef, rules, targetUid = null }) => {
  if (targetUid) {
    const memberSnapshot = await membersRef.doc(targetUid).get();
    if (!memberSnapshot.exists || memberSnapshot.data()?.rankingEligible !== true) return { reads: 1, writes: 0 };
    const [minutes, questions] = await Promise.all(['minutes', 'questions'].map((metric) => (
      countPositionForMember({ membersRef, memberSnapshot, metric })
    )));
    const member = memberSnapshot.data() || {};
    const { payload, changedMetrics } = buildPositionPayload({ member, positions: { minutes, questions } });
    if (!payloadChanged(member, payload)) return { reads: 3, writes: 0 };
    await memberSnapshot.ref.set({
      ...payload,
      updatedPositionAt: serverTimestamp(),
      ...(changedMetrics.length ? { positionChangedAt: serverTimestamp() } : {}),
    }, { merge: true });
    return { reads: 3, writes: 1 };
  }
  const snapshot = await membersRef.get();
  const members = dataWithId(snapshot).filter((member) => member.rankingEligible === true);
  const nextByUid = new Map();
  ['minutes', 'questions'].forEach((metric) => {
    rules.sortGeneralRankingMembers(members, metric).forEach((member, index) => {
      const uid = member.uid || member.id;
      const next = nextByUid.get(uid) || {};
      next[metric] = index + 1;
      nextByUid.set(uid, next);
    });
  });
  const writer = db().bulkWriter();
  let writes = 0;
  members.forEach((member) => {
    const uid = member.uid || member.id;
    const positions = nextByUid.get(uid) || {};
    const { payload, changedMetrics } = buildPositionPayload({ member, positions });
    if (!payloadChanged(member, payload)) return;
    writer.set(membersRef.doc(uid), {
      ...payload,
      updatedPositionAt: serverTimestamp(),
      ...(changedMetrics.length ? { positionChangedAt: serverTimestamp() } : {}),
    }, { merge: true });
    writes += 1;
  });
  await writer.close();
  return { reads: snapshot.size, writes };
};

const buildCompletionEvents = async ({ cycleRounds, schedules, cutoffMillis }) => {
  const rules = await domain();
  const candidates = [];
  cycleRounds.forEach((round) => {
    if (!round.fechamentoReal || !Number.isInteger(Number(round.numeroRodada)) || Number(round.numeroRodada) < 1) return;
    const millis = sourceCreatedMillis(round);
    if (cutoffMillis && millis <= cutoffMillis) return;
    const dateKey = rules.toDateKey(round.fechamentoReal || round.fechadoEm || round.criadoEm || round.dataFim || millis);
    if (!dateKey) return;
    candidates.push({
      id: `academic_cycle_round_${round.cycleId}_${round.id}`,
      sourceType: 'cycle_round',
      sourceId: `${round.cycleId}:${round.id}`,
      sourceKey: `cycle_round:${round.cycleId}:${round.id}`,
      dateKey,
      weekId: rules.getWeekId(dateKey),
      sourceMillis: millis,
      xpTotal: rules.GAMIFICATION_CONFIG.academic.cycleRound,
      xpCompetitive: rules.GAMIFICATION_CONFIG.academic.cycleRound,
      breakdown: { cycleRound: rules.GAMIFICATION_CONFIG.academic.cycleRound },
      message: 'Rodada do ciclo concluída',
      category: 'academic',
    });
  });
  schedules.filter(isCompletedSchedule).forEach((schedule) => {
    const millis = timestampMillis(schedule.concluidoEm || schedule.finalizadoEm || schedule.atualizadoEm || schedule.editadoEm || schedule.criadoEm);
    if (cutoffMillis && millis <= cutoffMillis) return;
    const dateKey = rules.toDateKey(schedule.concluidoEm || schedule.finalizadoEm || schedule.atualizadoEm || schedule.dataFim || millis);
    if (!dateKey) return;
    candidates.push({
      id: `academic_schedule_complete_${schedule.id}`,
      sourceType: 'schedule_completion',
      sourceId: schedule.id,
      sourceKey: `schedule_completion:${schedule.id}`,
      dateKey,
      weekId: rules.getWeekId(dateKey),
      sourceMillis: millis,
      xpTotal: rules.GAMIFICATION_CONFIG.academic.scheduleCompletion,
      xpCompetitive: rules.GAMIFICATION_CONFIG.academic.scheduleCompletion,
      breakdown: { scheduleCompletion: rules.GAMIFICATION_CONFIG.academic.scheduleCompletion },
      message: 'Cronograma concluído',
      category: 'academic',
    });
  });
  candidates.sort((a, b) => a.sourceMillis - b.sourceMillis || a.id.localeCompare(b.id));
  const daily = new Map();
  return candidates.filter((event) => {
    const state = daily.get(event.dateKey) || { cycleRounds: 0, schedules: 0 };
    const key = event.sourceType === 'cycle_round' ? 'cycleRounds' : 'schedules';
    if (state[key] >= 1) return false;
    state[key] += 1;
    daily.set(event.dateKey, state);
    return true;
  });
};

const calculateHistoricalState = async (sources, totalXPBeforeAchievements) => {
  const rules = await domain();
  const streakResult = rules.calculateCanonicalStudyStreak({
    records: sources.records,
    simulations: sources.simulations,
    cycles: sources.cycles,
    cycleReviews: sources.cycleReviews,
    schedules: sources.schedules,
    now: new Date(),
    historicalStreakBaseline: Number(sources.profile.historicalStreakBaseline?.value || 0),
  });
  const recordMetrics = sources.records.filter(rules.isValidGamificationRecord).map(rules.getStudyMetrics);
  const simulationMetrics = sources.simulations.filter(rules.isValidGamificationRecord).map(rules.getSimuladoMetrics);
  const questionMetrics = sources.questionRewards.filter(rules.isValidGamificationRecord).map(rules.getQuestionRewardMetrics);
  const allMetrics = [...recordMetrics, ...simulationMetrics, ...questionMetrics];
  const totals = allMetrics.reduce((sum, metric) => ({
    minutes: sum.minutes + metric.minutes,
    questions: sum.questions + metric.questions,
    correct: sum.correct + metric.correct,
  }), { minutes: 0, questions: 0, correct: 0 });
  const accuracy = totals.questions ? (totals.correct / totals.questions) * 100 : 0;
  const dailyGoalEvents = rules.buildAcademicXPEvents({
    records: sources.records,
    simulations: sources.simulations,
    questionRewards: sources.questionRewards,
    goals: sources.goals,
  }).filter((event) => event.sourceType === 'daily_goal');
  const currentLeague = rules.getLeague(sources.profile.currentLeague || sources.profile.league || 'iron');
  const leagueRewardEvents = sources.xpEvents.filter((event) => String(event.sourceKey || event.id || '').startsWith('reward_league_'));
  const groupRewardEvents = sources.xpEvents.filter((event) => String(event.sourceKey || event.id || '').startsWith('reward_group_'));
  const generalRewardEvents = sources.xpEvents.filter((event) => String(event.sourceKey || event.id || '').startsWith('reward_general_'));
  return {
    studies: sources.records.filter(rules.isValidGamificationRecord).length,
    dailyGoals: dailyGoalEvents.length,
    simulations: sources.simulations.filter(rules.isValidGamificationRecord).length,
    reviews: sources.records.filter((record) => rules.isValidGamificationRecord(record) && rules.isReviewRecord(record)).length,
    cyclesCreated: sources.cycles.length,
    schedulesCreated: sources.schedules.length,
    cycleRounds: sources.cycleRounds.length,
    schedulesCompleted: sources.schedules.filter(isCompletedSchedule).length,
    minutes: totals.minutes,
    questions: totals.questions,
    correct: totals.correct,
    accuracy,
    accuracy85Questions: accuracy >= 85 ? totals.questions : 0,
    accuracy90Questions: accuracy >= 90 ? totals.questions : 0,
    streak: streakResult.currentStreak,
    streakState: streakResult.days?.[streakResult.today]?.state || 'not_applicable',
    streakContext: streakResult.context || null,
    groupsJoined: Math.max(Number(sources.profile.groupIds?.length || 0), Number(sources.profile.socialHistory?.groupsJoined || 0)),
    groupsCreated: Math.max(Number(sources.ownedGroups?.length || 0), Number(sources.profile.socialHistory?.groupsCreated || 0)),
    groupPodiums: Math.max(groupRewardEvents.length, Number(sources.profile.competitionHistory?.groupPodiums || 0)),
    leaguePodiums: Math.max(leagueRewardEvents.length, Number(sources.profile.competitionHistory?.leaguePodiums || 0)),
    generalTop10: Math.max(generalRewardEvents.length, Number(sources.profile.competitionHistory?.generalTop10 || 0)),
    generalTop3: Math.max(generalRewardEvents.filter((event) => Number(event.metadata?.position || 99) <= 3).length, Number(sources.profile.competitionHistory?.generalTop3 || 0)),
    generalFirst: Math.max(generalRewardEvents.filter((event) => Number(event.metadata?.position || 99) === 1).length, Number(sources.profile.competitionHistory?.generalFirst || 0)),
    highestLeagueIndex: Math.max(currentLeague.index, Number(sources.profile.highestLeagueIndex || 0)),
    totalXPBeforeAchievements,
    level: rules.getLevelFromXP(totalXPBeforeAchievements),
    totals,
  };
};

const serializeEvent = (event, rules, extra = {}) => ({
  sourceKey: event.sourceKey,
  sourceType: event.sourceType,
  sourceId: event.sourceId,
  category: event.category,
  xpTotal: Number(event.xpTotal || 0),
  xpCompetitive: Number(event.xpCompetitive || 0),
  breakdown: event.breakdown || {},
  message: event.message || 'XP recebido',
  ruleVersion: rules.GAMIFICATION_RULE_VERSION,
  dateKey: event.dateKey || rules.toDateKey(),
  weekId: event.weekId || rules.getWeekId(),
  occurredAt: admin.firestore.Timestamp.fromMillis(Math.max(1, Number(event.sourceMillis || Date.now()))),
  updatedAt: serverTimestamp(),
  isRead: false,
  ...extra,
});

const calculatePersistedNonAcademicXP = ({ achievements = [], events = [] } = {}) => {
  const achievementXP = (Array.isArray(achievements) ? achievements : [])
    .filter((item) => item?.unlocked === true)
    .reduce((sum, item) => sum + Math.max(0, Number(item.xpGranted ?? item.xp ?? 0)), 0);
  const otherEventXP = (Array.isArray(events) ? events : [])
    .filter((event) => event?.category !== 'academic' && event?.category !== 'achievement')
    .reduce((sum, event) => sum + Math.max(0, Number(event.xpTotal || 0)), 0);
  return achievementXP + otherEventXP;
};

const writeEventsAndAchievements = async ({ sources, academicEvents, newAchievements, state, rules }) => {
  const writer = db().bulkWriter();
  const nextAcademicIds = new Set(academicEvents.map((event) => event.id));
  const eventsById = new Map(sources.xpEvents.map((event) => [event.id, event]));
  const achievementsById = new Map(sources.achievements.map((item) => [item.id, item]));
  let writes = 0;
  sources.xpEvents
    .filter((event) => event.category === 'academic' && !nextAcademicIds.has(event.id))
    .forEach((event) => {
      writer.delete(sources.profileRef.collection('xp_events').doc(event.id));
      writes += 1;
    });
  academicEvents.forEach((event) => {
    const existing = eventsById.get(event.id);
    const nextPayload = serializeEvent(event, rules, existing ? {
      isRead: existing.isRead === true,
      ...(existing.readAt ? { readAt: existing.readAt } : {}),
    } : {});
    const { updatedAt, ...functionalPayload } = nextPayload;
    if (existing && !payloadChanged(existing, functionalPayload)) return;
    writer.set(sources.profileRef.collection('xp_events').doc(event.id), {
      ...functionalPayload,
      updatedAt,
    }, { merge: true });
    writes += 1;
  });
  rules.ACHIEVEMENTS.forEach((item) => {
    const progress = rules.getAchievementProgress(item, state);
    const existing = achievementsById.get(item.id);
    const isNew = newAchievements.some((achievementItem) => achievementItem.id === item.id);
    const functionalPayload = {
      id: item.id,
      category: item.category,
      title: item.title,
      description: item.description,
      requirement: item.requirement,
      xp: item.xp,
      progress: progress.current,
      progressTarget: progress.threshold,
      progressPercent: progress.percent,
      unlocked: Boolean(existing?.unlocked || progress.unlocked || isNew),
      ...(isNew ? { xpGranted: item.xp } : {}),
      ruleVersion: rules.GAMIFICATION_RULE_VERSION,
    };
    if (existing && !payloadChanged(existing, functionalPayload)) return;
    writer.set(sources.profileRef.collection('achievements').doc(item.id), {
      ...functionalPayload,
      ...(isNew ? { unlockedAt: serverTimestamp() } : {}),
      updatedAt: serverTimestamp(),
    }, { merge: true });
    writes += 1;
  });
  await writer.close();
  await Promise.all(newAchievements.map(async (item) => {
    const event = {
      id: `achievement_${item.id}`,
      sourceKey: `achievement:${item.id}`,
      sourceType: 'achievement',
      sourceId: item.id,
      category: 'achievement',
      xpTotal: item.xp,
      xpCompetitive: 0,
      message: `Conquista: ${item.title}`,
      sourceMillis: Date.now(),
    };
    const eventRef = sources.profileRef.collection('xp_events').doc(event.id);
    await db().runTransaction(async (transaction) => {
      const existingEvent = await transaction.get(eventRef);
      if (existingEvent.exists) return;
      transaction.create(eventRef, serializeEvent(event, rules));
      writes += 1;
    });
  }));
  return { writes };
};

const incrementalSourceDateKey = ({ sourceType, source, rules }) => {
  if (!source) return null;
  if (sourceType === 'goal') return rules.toDateKey(source.startDate || source.data || source.createdAt);
  const metrics = sourceType === 'study'
    ? rules.getStudyMetrics(source)
    : sourceType === 'simulation'
      ? rules.getSimuladoMetrics(source)
      : rules.getQuestionRewardMetrics(source);
  return rules.toDateKey(metrics.date);
};

const mergeSnapshotsById = (...snapshots) => {
  const byId = new Map();
  snapshots.forEach((snapshot) => snapshot.docs.forEach((item) => byId.set(item.id, { id: item.id, ...item.data() })));
  return [...byId.values()];
};

const loadIncrementalDay = async ({ uid, dateKey, rules }) => {
  const userRef = db().collection('users').doc(uid);
  const dayStart = admin.firestore.Timestamp.fromDate(new Date(`${dateKey}T00:00:00-03:00`));
  const nextDate = new Date(`${dateKey}T12:00:00Z`);
  nextDate.setUTCDate(nextDate.getUTCDate() + 1);
  const nextDateKey = nextDate.toISOString().slice(0, 10);
  const dayEnd = admin.firestore.Timestamp.fromDate(new Date(`${nextDateKey}T00:00:00-03:00`));
  const [
    recordsByData,
    recordsByDate,
    simulationsByData,
    simulationsByDate,
    questionRewards,
    goals,
    xpEvents,
  ] = await Promise.all([
    userRef.collection('registrosEstudo').where('data', '==', dateKey).get(),
    userRef.collection('registrosEstudo').where('date', '==', dateKey).get(),
    userRef.collection('simulados').where('data', '==', dateKey).get(),
    userRef.collection('simulados').where('date', '==', dateKey).get(),
    userRef.collection('question_reward_sources').where('attemptedAt', '>=', dayStart).where('attemptedAt', '<', dayEnd).get(),
    userRef.collection('metas').get(),
    userRef.collection('gamification').doc('profile').collection('xp_events').where('dateKey', '==', dateKey).get(),
  ]);
  const profileRef = userRef.collection('gamification').doc('profile');
  const profileSnapshot = await profileRef.get();
  const profile = profileSnapshot.data() || {};
  const currentWeekId = rules.getWeekId();
  const currentMonthId = rules.getMonthId();
  const weeklyRankingSnapshot = await db().collection('weekly_rankings').doc(currentWeekId).collection('members').doc(uid).get();
  let monthlyRanking = null;
  const firstGroupId = (profile.groupIds || []).find(Boolean);
  if (firstGroupId) {
    const monthlySnapshot = await db().collection('study_groups').doc(firstGroupId)
      .collection('monthly_rankings').doc(currentMonthId).collection('members').doc(uid).get();
    monthlyRanking = monthlySnapshot.exists ? (monthlySnapshot.data() || {}) : null;
  }
  return {
    userRef,
    profileRef,
    records: mergeSnapshotsById(recordsByData, recordsByDate)
      .filter((item) => incrementalSourceDateKey({ sourceType: 'study', source: item, rules }) === dateKey),
    simulations: mergeSnapshotsById(simulationsByData, simulationsByDate)
      .filter((item) => incrementalSourceDateKey({ sourceType: 'simulation', source: item, rules }) === dateKey),
    questionRewards: dataWithId(questionRewards)
      .filter((item) => incrementalSourceDateKey({ sourceType: 'question', source: item, rules }) === dateKey),
    goals: dataWithId(goals),
    xpEvents: dataWithId(xpEvents),
    rankingBaselines: {
      weekly: weeklyRankingSnapshot.exists ? (weeklyRankingSnapshot.data() || {}) : null,
      monthly: monthlyRanking,
    },
  };
};

const replaceChangedDaySource = ({ daySources, sourceType, sourceId, before, after, dateKey, rules }) => {
  const collectionKey = sourceType === 'study'
    ? 'records'
    : sourceType === 'simulation'
      ? 'simulations'
      : sourceType === 'goal'
        ? 'goals'
        : 'questionRewards';
  const next = { ...daySources, [collectionKey]: [...daySources[collectionKey]] };
  const byId = new Map(next[collectionKey].map((item) => [String(item.id), item]));
  const afterDateKey = incrementalSourceDateKey({ sourceType, source: after, rules });
  const beforeDateKey = incrementalSourceDateKey({ sourceType, source: before, rules });
  const afterAffectsDay = sourceType === 'goal'
    ? Boolean(afterDateKey && afterDateKey <= dateKey)
    : incrementalSourceDateKey({ sourceType, source: after, rules }) === dateKey;
  const beforeAffectsDay = sourceType === 'goal'
    ? Boolean(beforeDateKey && beforeDateKey <= dateKey)
    : incrementalSourceDateKey({ sourceType, source: before, rules }) === dateKey;
  if (afterAffectsDay) byId.delete(String(sourceId));
  if (beforeAffectsDay) {
    byId.set(String(sourceId), { id: String(sourceId), ...before });
  }
  next[collectionKey] = [...byId.values()];
  return next;
};

const buildIncrementalDayState = ({ dateKey, sources, rules }) => {
  const events = rules.buildAcademicXPEvents(sources).filter((event) => event.dateKey === dateKey);
  const metrics = rules.calculateRankingPeriodMetrics({
    records: sources.records,
    simulations: sources.simulations,
    questionRewards: sources.questionRewards,
    now: new Date(`${dateKey}T23:59:59-03:00`),
  }).lifetime;
  const validRecords = sources.records.filter(rules.isValidGamificationRecord);
  const validSimulations = sources.simulations.filter(rules.isValidGamificationRecord);
  return {
    dateKey,
    academicXP: events.reduce((sum, event) => sum + Number(event.xpTotal || 0), 0),
    questionXP: events.filter((event) => event.sourceType === 'question').reduce((sum, event) => sum + Number(event.xpTotal || 0), 0),
    metrics: {
      minutes: Number(metrics.minutes || 0),
      questions: Number(metrics.questions || 0),
      correct: Number(metrics.correct || 0),
    },
    counts: {
      studies: validRecords.length,
      simulations: validSimulations.length,
      reviews: validRecords.filter(rules.isReviewRecord).length,
      dailyGoals: events.filter((event) => event.sourceType === 'daily_goal').length,
    },
    eventIds: events.map((event) => event.id),
    ruleVersion: rules.GAMIFICATION_RULE_VERSION,
    events,
  };
};

const deltaNumber = (after, before) => Number(after || 0) - Number(before || 0);
const applyMetricDelta = (base = {}, before = {}, after = {}) => ({
  minutes: Math.max(0, Number(base.minutes || 0) + deltaNumber(after.minutes, before.minutes)),
  questions: Math.max(0, Number(base.questions || 0) + deltaNumber(after.questions, before.questions)),
  correct: Math.max(0, Number(base.correct || 0) + deltaNumber(after.correct, before.correct)),
});

const buildIncrementalAchievementState = ({ profile, totals, rules }) => {
  const accuracy = totals.questions ? (totals.correct / totals.questions) * 100 : 0;
  return {
    studies: Number(totals.studies || 0),
    dailyGoals: Number(totals.dailyGoals || 0),
    simulations: Number(totals.simulations || 0),
    reviews: Number(totals.reviews || 0),
    cyclesCreated: Number(totals.cyclesCreated || profile.totals?.cyclesCreated || 0),
    schedulesCreated: Number(totals.schedulesCreated || profile.totals?.schedulesCreated || 0),
    cycleRounds: Number(totals.cycleRounds || 0),
    schedulesCompleted: Number(totals.schedulesCompleted || 0),
    minutes: Number(totals.minutes || 0),
    questions: Number(totals.questions || 0),
    accuracy85Questions: accuracy >= 85 ? Number(totals.questions || 0) : 0,
    accuracy90Questions: accuracy >= 90 ? Number(totals.questions || 0) : 0,
    streak: Number(profile.currentStreak || profile.streak || 0),
    groupsJoined: Math.max(Number(profile.groupIds?.length || 0), Number(profile.socialHistory?.groupsJoined || 0)),
    groupsCreated: Number(profile.socialHistory?.groupsCreated || 0),
    groupPodiums: Number(profile.competitionHistory?.groupPodiums || 0),
    leaguePodiums: Number(profile.competitionHistory?.leaguePodiums || 0),
    generalTop10: Number(profile.competitionHistory?.generalTop10 || 0),
    generalTop3: Number(profile.competitionHistory?.generalTop3 || 0),
    generalFirst: Number(profile.competitionHistory?.generalFirst || 0),
    highestLeagueIndex: Number(profile.highestLeagueIndex || rules.getLeague(profile.currentLeague || profile.league || 'iron').index),
  };
};

const writeIncrementalEvents = async ({ profileRef, existingEvents, events, rules }) => {
  const managedTypes = new Set(['study', 'simulation', 'question', 'daily_goal']);
  const existingById = new Map(existingEvents.filter((event) => managedTypes.has(event.sourceType)).map((event) => [event.id, event]));
  const nextIds = new Set(events.map((event) => event.id));
  const writer = db().bulkWriter();
  let writes = 0;
  existingById.forEach((event) => {
    if (nextIds.has(event.id)) return;
    writer.delete(profileRef.collection('xp_events').doc(event.id));
    writes += 1;
  });
  events.forEach((event) => {
    const existing = existingById.get(event.id);
    const serialized = serializeEvent(event, rules, existing ? {
      isRead: existing.isRead === true,
      ...(existing.readAt ? { readAt: existing.readAt } : {}),
    } : {});
    const { updatedAt, ...functionalPayload } = serialized;
    if (existing && !payloadChanged(existing, functionalPayload)) return;
    writer.set(profileRef.collection('xp_events').doc(event.id), { ...functionalPayload, updatedAt }, { merge: true });
    writes += 1;
  });
  await writer.close();
  return writes;
};

const writeIncrementalAchievements = async ({ profileRef, state, unlockedIds, unlockIds, rules }) => {
  const unlocked = new Set(unlockedIds || []);
  const nextByProgressKey = new Map();
  rules.ACHIEVEMENTS.forEach((item) => {
    if (unlocked.has(item.id)) return;
    const current = nextByProgressKey.get(item.progressKey);
    if (!current || Number(item.threshold) < Number(current.threshold)) nextByProgressKey.set(item.progressKey, item);
  });
  const candidates = [...new Map([
    ...(unlockIds || []).map((id) => [id, rules.ACHIEVEMENTS.find((item) => item.id === id)]),
    ...[...nextByProgressKey.values()].map((item) => [item.id, item]),
  ].filter(([, item]) => item)).values()];
  if (!candidates.length) return 0;
  const refs = candidates.map((item) => profileRef.collection('achievements').doc(item.id));
  const snapshots = await db().getAll(...refs);
  const writer = db().bulkWriter();
  let writes = 0;
  candidates.forEach((item, index) => {
    const existing = snapshots[index].exists ? (snapshots[index].data() || {}) : {};
    const progress = rules.getAchievementProgress(item, state);
    const isUnlocked = unlocked.has(item.id);
    const payload = {
      id: item.id,
      category: item.category,
      title: item.title,
      description: item.description,
      requirement: item.requirement,
      xp: item.xp,
      progress: progress.current,
      progressTarget: progress.threshold,
      progressPercent: progress.percent,
      unlocked: isUnlocked,
      ...(isUnlocked ? { xpGranted: item.xp } : {}),
      ruleVersion: rules.GAMIFICATION_RULE_VERSION,
    };
    if (snapshots[index].exists && !payloadChanged(existing, payload)) return;
    writer.set(refs[index], {
      ...payload,
      ...(isUnlocked && !existing.unlockedAt ? { unlockedAt: serverTimestamp() } : {}),
      updatedAt: serverTimestamp(),
    }, { merge: true });
    writes += 1;
  });
  await writer.close();
  return writes;
};

const projectIncrementalRankings = async ({ uid, user, profile, rules }) => {
  const weekId = rules.getWeekId();
  const monthId = rules.getMonthId();
  const generalMembersRef = db().collection('general_rankings').doc('all').collection('members');
  const weeklyMembersRef = db().collection('weekly_rankings').doc(weekId).collection('members');
  const generalRef = generalMembersRef.doc(uid);
  const weeklyRef = weeklyMembersRef.doc(uid);
  const [generalSnapshot, weeklySnapshot] = await db().getAll(generalRef, weeklyRef);
  const generalExisting = generalSnapshot.exists ? (generalSnapshot.data() || {}) : {};
  const weeklyExisting = weeklySnapshot.exists ? (weeklySnapshot.data() || {}) : {};
  const totals = profile.totals || {};
  const weeklyMetrics = profile.rankingMetrics?.weekly?.periodId === weekId
    ? profile.rankingMetrics.weekly
    : { minutes: 0, questions: 0, correct: 0 };
  const monthlyMetrics = profile.rankingMetrics?.monthly?.periodId === monthId
    ? profile.rankingMetrics.monthly
    : { minutes: 0, questions: 0, correct: 0 };
  const accountStatus = String(user.status || (user.disabled ? 'disabled' : 'active')).toLowerCase();
  const accountActive = !user.disabled && !['blocked', 'disabled'].includes(accountStatus);
  const rankingEligible = accountActive && rules.hasRecentRankingActivity({
    lastStudyAtMillis: profile.lastStudyAtMillis,
    now: new Date(),
  });
  const identity = {
    uid,
    displayName: userNameFrom(user),
    photoURL: user.photoURL || null,
    level: Number(profile.level || 1),
    leagueId: rules.getLeague(profile.currentLeague || profile.league || 'iron').id,
    accountActive,
    accountStatus,
    lastStudyAtMillis: Number(profile.lastStudyAtMillis || 0),
    editais: profile.publicEditais || generalExisting.editais || [],
    streak: Number(profile.currentStreak || profile.streak || 0),
    streakState: profile.streakState || 'not_applicable',
  };
  const generalPayload = {
    ...identity,
    minutes: Number(totals.minutes || 0),
    questions: Number(totals.questions || 0),
    correct: Number(totals.correct || 0),
    accuracy: Number(totals.questions || 0) ? Number(((Number(totals.correct || 0) / Number(totals.questions)) * 100).toFixed(2)) : 0,
    errors: Math.max(0, Number(totals.questions || 0) - Number(totals.correct || 0)),
    active: accountActive,
    rankingEligible,
  };
  if (rankingEligible) await setIfChanged(generalRef, generalPayload, { snapshot: generalSnapshot });
  else await deleteIfExists(generalRef, generalSnapshot);

  const weeklyEligible = rankingEligible && (Number(weeklyMetrics.minutes || 0) > 0 || Number(weeklyMetrics.questions || 0) > 0);
  const weeklyPayload = {
    ...identity,
    competitiveXP: Number(profile.weeklyCompetitiveXP || 0),
    weeklyXP: Number(profile.weeklyCompetitiveXP || 0),
    minutes: Number(weeklyMetrics.minutes || 0),
    questions: Number(weeklyMetrics.questions || 0),
    correct: Number(weeklyMetrics.correct || 0),
    accuracy: Number(weeklyMetrics.questions || 0) ? Number(((Number(weeklyMetrics.correct || 0) / Number(weeklyMetrics.questions)) * 100).toFixed(2)) : 0,
    errors: Math.max(0, Number(weeklyMetrics.questions || 0) - Number(weeklyMetrics.correct || 0)),
    rankingEligible: weeklyEligible,
    ruleVersion: rules.GAMIFICATION_RULE_VERSION,
  };
  if (weeklyEligible) await setIfChanged(weeklyRef, weeklyPayload, { snapshot: weeklySnapshot });
  else await deleteIfExists(weeklyRef, weeklySnapshot);

  let cohortId = profile.competitiveWeekId === weekId ? profile.currentCohortId : null;
  if (weeklyEligible && Number(profile.weeklyCompetitiveXP || 0) > 0 && !cohortId) {
    const profileRef = db().collection('users').doc(uid).collection('gamification').doc('profile');
    cohortId = await ensureCohort({ uid, profileRef, leagueId: identity.leagueId, weekId });
  }
  if (cohortId) {
    const cohortMemberRef = db().collection('weekly_rankings').doc(weekId).collection('cohorts').doc(cohortId).collection('members').doc(uid);
    if (weeklyEligible && Number(profile.weeklyCompetitiveXP || 0) > 0) {
      await setIfChanged(cohortMemberRef, { ...weeklyPayload, cohortId });
    } else {
      await deleteIfExists(cohortMemberRef);
    }
  }

  const monthlyPayload = {
    ...identity,
    minutes: Number(monthlyMetrics.minutes || 0),
    questions: Number(monthlyMetrics.questions || 0),
    correct: Number(monthlyMetrics.correct || 0),
    accuracy: Number(monthlyMetrics.questions || 0) ? Number(((Number(monthlyMetrics.correct || 0) / Number(monthlyMetrics.questions)) * 100).toFixed(2)) : 0,
    errors: Math.max(0, Number(monthlyMetrics.questions || 0) - Number(monthlyMetrics.correct || 0)),
    rankingEligible: rankingEligible && (Number(monthlyMetrics.minutes || 0) > 0 || Number(monthlyMetrics.questions || 0) > 0),
    periodType: 'monthly',
    monthId,
    ruleVersion: rules.GAMIFICATION_RULE_VERSION,
  };
  await Promise.all((profile.groupIds || []).filter(Boolean).flatMap((groupId) => [
    syncGroupWeeklyMember({ groupId, weekId, uid, member: weeklyEligible ? { ...weeklyExisting, ...weeklyPayload } : null }),
    syncGroupMonthlyMember({
      groupId,
      monthId,
      uid,
      member: monthlyPayload.rankingEligible ? monthlyPayload : null,
    }),
  ]));
  await Promise.all([
    ...(rankingEligible ? [updateRankingMetricPositions({ membersRef: generalMembersRef, rules, targetUid: uid })] : []),
    ...(weeklyEligible ? [updateRankingMetricPositions({ membersRef: weeklyMembersRef, rules, targetUid: uid })] : []),
  ]);
  return { cohortId, generalChanged: payloadChanged(generalExisting, generalPayload) };
};

const incrementalOperationId = ({ sourceType, sourceId, eventId, dateKey }) => {
  const safeEventId = String(eventId || `${sourceType}-${sourceId}`).replaceAll('/', '_');
  return `${safeEventId}_${dateKey}`.slice(0, 1400);
};

const processIncrementalGamificationDay = async ({ uid, sourceType, sourceId, before, after, eventId, dateKey, rules }) => {
  const daySources = await loadIncrementalDay({ uid, dateKey, rules });
  const oldSources = replaceChangedDaySource({ daySources, sourceType, sourceId, before, after, dateKey, rules });
  const fallbackPreviousDay = buildIncrementalDayState({ dateKey, sources: oldSources, rules });
  const nextDay = buildIncrementalDayState({ dateKey, sources: daySources, rules });
  const dailyRef = daySources.profileRef.collection('daily_states').doc(dateKey);
  const operationRef = daySources.profileRef.collection('operations').doc(incrementalOperationId({
    sourceType,
    sourceId,
    eventId,
    dateKey,
  }));
  let transactionResult = null;
  await db().runTransaction(async (transaction) => {
    const [userSnapshot, profileSnapshot, dailySnapshot, operationSnapshot] = await Promise.all([
      transaction.get(daySources.userRef),
      transaction.get(daySources.profileRef),
      transaction.get(dailyRef),
      transaction.get(operationRef),
    ]);
    if (!userSnapshot.exists || operationSnapshot.data()?.status === 'completed') {
      transactionResult = { skipped: true, user: userSnapshot.data() || null };
      return;
    }
    const profile = profileSnapshot.data() || {};
    const previousDay = dailySnapshot.exists ? (dailySnapshot.data() || {}) : fallbackPreviousDay;
    const previousTotals = profile.totals || {};
    const nextTotals = {
      ...previousTotals,
      ...applyMetricDelta(previousTotals, previousDay.metrics, nextDay.metrics),
      studies: Math.max(0, Number(previousTotals.studies || 0) + deltaNumber(nextDay.counts.studies, previousDay.counts?.studies)),
      simulations: Math.max(0, Number(previousTotals.simulations || 0) + deltaNumber(nextDay.counts.simulations, previousDay.counts?.simulations)),
      reviews: Math.max(0, Number(previousTotals.reviews || 0) + deltaNumber(nextDay.counts.reviews, previousDay.counts?.reviews)),
      dailyGoals: Math.max(0, Number(previousTotals.dailyGoals || 0) + deltaNumber(nextDay.counts.dailyGoals, previousDay.counts?.dailyGoals)),
      questionXP: Math.max(0, Number(previousTotals.questionXP || 0) + deltaNumber(nextDay.questionXP, previousDay.questionXP)),
    };
    nextTotals.accuracy = nextTotals.questions ? Number(((nextTotals.correct / nextTotals.questions) * 100).toFixed(2)) : 0;
    const currentWeekId = rules.getWeekId();
    const currentMonthId = rules.getMonthId();
    const previousRanking = profile.rankingMetrics || {};
    const weeklyBase = previousRanking.weekly?.periodId === currentWeekId
      ? previousRanking.weekly
      : daySources.rankingBaselines.weekly || { minutes: 0, questions: 0, correct: 0 };
    const monthlyBase = previousRanking.monthly?.periodId === currentMonthId
      ? previousRanking.monthly
      : daySources.rankingBaselines.monthly || { minutes: 0, questions: 0, correct: 0 };
    const weekMatches = rules.getWeekId(dateKey) === currentWeekId;
    const monthMatches = rules.getMonthId(dateKey) === currentMonthId;
    const rankingMetrics = {
      lifetime: { minutes: nextTotals.minutes, questions: nextTotals.questions, correct: nextTotals.correct },
      weekly: { ...(weekMatches ? applyMetricDelta(weeklyBase, previousDay.metrics, nextDay.metrics) : weeklyBase), periodId: currentWeekId },
      monthly: { ...(monthMatches ? applyMetricDelta(monthlyBase, previousDay.metrics, nextDay.metrics) : monthlyBase), periodId: currentMonthId },
    };
    const academicDelta = deltaNumber(nextDay.academicXP, previousDay.academicXP);
    const weeklyCompetitiveXP = Math.max(0, Number(profile.weeklyCompetitiveXP || 0) + (weekMatches ? academicDelta : 0));
    const totalBeforeUnlocks = Math.max(0, Number(profile.totalXP || 0) + academicDelta);
    const achievementState = {
      ...buildIncrementalAchievementState({ profile, totals: nextTotals, rules }),
      totalXPBeforeAchievements: totalBeforeUnlocks,
      level: rules.getLevelFromXP(totalBeforeUnlocks),
    };
    const evaluation = rules.evaluateAchievements(achievementState, profile.achievementIds || []);
    const nextTotalXP = totalBeforeUnlocks + evaluation.newlyUnlocked.reduce((sum, item) => sum + Number(item.xp || 0), 0);
    const nextProfile = {
      totals: nextTotals,
      totalXP: nextTotalXP,
      level: rules.getLevelFromXP(nextTotalXP),
      weeklyCompetitiveXP,
      weeklyXP: weeklyCompetitiveXP,
      competitiveWeekId: currentWeekId,
      rankingMetrics,
      achievementIds: [...evaluation.unlockedIds].sort(),
      achievementsSummary: { unlocked: evaluation.unlockedIds.length, total: rules.ACHIEVEMENTS.length },
      lastStudyAtMillis: Math.max(
        Number(profile.lastStudyAtMillis || 0),
        ...[...daySources.records, ...daySources.simulations, ...daySources.questionRewards].map(sourceCreatedMillis),
      ),
      ruleVersion: rules.GAMIFICATION_RULE_VERSION,
    };
    const dailyPayload = withoutAuditTimestamps({ ...nextDay, events: undefined });
    delete dailyPayload.events;
    if (!dailySnapshot.exists || payloadChanged(dailySnapshot.data() || {}, dailyPayload)) {
      transaction.set(dailyRef, { ...dailyPayload, updatedAt: serverTimestamp() }, { merge: true });
    }
    if (!profileSnapshot.exists || payloadChanged(profile, nextProfile)) {
      transaction.set(daySources.profileRef, { ...nextProfile, updatedAt: serverTimestamp() }, { merge: true });
    }
    const operationPayload = {
      status: 'pending',
      sourceType,
      sourceId,
      dateKey,
      unlockIds: evaluation.newlyUnlocked.map((item) => item.id),
    };
    if (!operationSnapshot.exists || payloadChanged(operationSnapshot.data() || {}, operationPayload)) {
      transaction.set(operationRef, { ...operationPayload, updatedAt: serverTimestamp() }, { merge: true });
    }
    transactionResult = {
      user: userSnapshot.data() || {},
      profile: { ...profile, ...nextProfile },
      achievementState: { ...achievementState, level: rules.getLevelFromXP(nextTotalXP) },
      unlockIds: operationSnapshot.data()?.unlockIds || operationPayload.unlockIds,
      academicDelta,
    };
  });
  if (transactionResult?.skipped) {
    const sourceEvent = nextDay.events.find((event) => event.sourceType === sourceType && String(event.sourceId) === String(sourceId));
    return { skipped: true, writes: 0, sourceXP: Number(sourceEvent?.xpTotal || 0) };
  }
  const eventWrites = await writeIncrementalEvents({
    profileRef: daySources.profileRef,
    existingEvents: daySources.xpEvents,
    events: nextDay.events,
    rules,
  });
  const achievementWrites = await writeIncrementalAchievements({
    profileRef: daySources.profileRef,
    state: transactionResult.achievementState,
    unlockedIds: transactionResult.profile.achievementIds,
    unlockIds: transactionResult.unlockIds,
    rules,
  });
  if (sourceType === 'question') {
    await setIfChanged(daySources.userRef.collection('question_stats').doc('summary'), {
      totalXpEarned: Number(transactionResult.profile.totals?.questionXP || 0),
    });
  }
  await projectIncrementalRankings({
    uid,
    user: transactionResult.user,
    profile: transactionResult.profile,
    rules,
  });
  await operationRef.set({
    status: 'completed',
    completedAt: serverTimestamp(),
    expiresAt: admin.firestore.Timestamp.fromMillis(Date.now() + (30 * 24 * 60 * 60 * 1000)),
    updatedAt: serverTimestamp(),
  }, { merge: true });
  const sourceEvent = nextDay.events.find((event) => event.sourceType === sourceType && String(event.sourceId) === String(sourceId));
  return {
    dateKey,
    eventWrites,
    achievementWrites,
    academicDelta: transactionResult.academicDelta,
    sourceXP: Number(sourceEvent?.xpTotal || 0),
  };
};

const processGamificationSourceChange = async ({ uid, sourceType, sourceId, before = null, after = null, eventId = null }) => {
  if (!uid || !['study', 'simulation', 'question', 'goal'].includes(sourceType)) return null;
  if (await userDeletionStarted(uid)) return { uid, skipped: 'user-deleted' };
  const rules = await domain();
  let affectedDateKeys = [...new Set([
    incrementalSourceDateKey({ sourceType, source: before, rules }),
    incrementalSourceDateKey({ sourceType, source: after, rules }),
  ].filter(Boolean))];
  if (sourceType === 'goal') {
    const minimumDate = [...affectedDateKeys].sort()[0] || rules.toDateKey();
    const dailyStates = await db().collection('users').doc(uid).collection('gamification').doc('profile')
      .collection('daily_states')
      .where(admin.firestore.FieldPath.documentId(), '>=', minimumDate)
      .get();
    affectedDateKeys = [...new Set([
      ...dailyStates.docs.map((snapshot) => snapshot.id),
      rules.toDateKey(),
    ])].sort();
  }
  const profileRef = db().collection('users').doc(uid).collection('gamification').doc('profile');
  const operationRefs = affectedDateKeys.map((dateKey) => profileRef.collection('operations').doc(incrementalOperationId({
    sourceType,
    sourceId,
    eventId,
    dateKey,
  })));
  const operationSnapshots = operationRefs.length ? await db().getAll(...operationRefs) : [];
  const pendingDateKeys = affectedDateKeys.filter((dateKey, index) => operationSnapshots[index]?.data()?.status !== 'completed');
  if (!pendingDateKeys.length) {
    let sourceXP = 0;
    if (sourceType === 'question') {
      const eventSnapshot = await profileRef.collection('xp_events').doc(`academic_question_${sourceId}`).get();
      sourceXP = Number(eventSnapshot.data()?.xpTotal || 0);
    }
    return {
      uid,
      incremental: true,
      retrySkipped: true,
      affectedDateKeys,
      days: [],
      ...(sourceType === 'question' ? { questionXPBySource: { [sourceId]: sourceXP } } : {}),
    };
  }
  await refreshUserPublicPlanningProfile(uid);
  const days = [];
  for (const dateKey of pendingDateKeys) {
    days.push(await processIncrementalGamificationDay({
      uid,
      sourceType,
      sourceId,
      before,
      after,
      eventId,
      dateKey,
      rules,
    }));
  }
  return {
    uid,
    incremental: true,
    affectedDateKeys,
    days,
    ...(sourceType === 'question' ? {
      questionXPBySource: { [sourceId]: Math.max(0, ...days.map((day) => Number(day?.sourceXP || 0))) },
    } : {}),
  };
};

const ensureCohort = async ({ uid, profileRef, leagueId, weekId }) => {
  const rankingsRef = db().collection('weekly_rankings').doc(weekId);
  let cohortId = null;
  await db().runTransaction(async (transaction) => {
    const currentProfile = await transaction.get(profileRef);
    const current = currentProfile.data() || {};
    if (current.competitiveWeekId === weekId && current.currentCohortId) {
      cohortId = current.currentCohortId;
      return;
    }
    const leagueStateRef = rankingsRef.collection('league_states').doc(leagueId);
    const leagueStateSnapshot = await transaction.get(leagueStateRef);
    const leagueState = leagueStateSnapshot.data() || {};
    let sequence = Number(leagueState.openSequence || 0);
    let candidateId = sequence > 0 ? `${leagueId}-${String(sequence).padStart(4, '0')}` : null;
    let candidateRef = candidateId ? rankingsRef.collection('cohorts').doc(candidateId) : null;
    let candidateSnapshot = candidateRef ? await transaction.get(candidateRef) : null;
    if (!candidateSnapshot?.exists || Number(candidateSnapshot.data()?.participantCount || 0) >= 10 || candidateSnapshot.data()?.status === 'closed') {
      sequence += 1;
      candidateId = `${leagueId}-${String(sequence).padStart(4, '0')}`;
      candidateRef = rankingsRef.collection('cohorts').doc(candidateId);
      candidateSnapshot = await transaction.get(candidateRef);
    }
    const participantCount = Number(candidateSnapshot?.data()?.participantCount || 0) + 1;
    transaction.set(candidateRef, {
      id: candidateId,
      leagueId,
      weekId,
      sequence,
      participantCount,
      status: participantCount >= 10 ? 'full' : 'open',
      createdAt: candidateSnapshot?.data()?.createdAt || serverTimestamp(),
      updatedAt: serverTimestamp(),
    }, { merge: true });
    transaction.set(leagueStateRef, { leagueId, openSequence: sequence, updatedAt: serverTimestamp() }, { merge: true });
    transaction.set(profileRef, { currentCohortId: candidateId, competitiveWeekId: weekId, updatedAt: serverTimestamp() }, { merge: true });
    cohortId = candidateId;
  });
  return cohortId;
};

const updateRankings = async ({ uid, sources, profilePayload, academicEvents, rules, skipGeneralPositionUpdate = false }) => {
  const weekId = rules.getWeekId();
  const validRecords = sources.records.filter(rules.isValidGamificationRecord);
  const validSimulations = sources.simulations.filter(rules.isValidGamificationRecord);
  const validQuestionRewards = sources.questionRewards.filter(rules.isValidGamificationRecord);
  const rankingNow = new Date();
  const rankingPeriods = rules.calculateRankingPeriodMetrics({
    records: validRecords,
    simulations: validSimulations,
    questionRewards: validQuestionRewards,
    now: rankingNow,
  });
  const generalMetrics = rankingPeriods.lifetime;
  const weeklyMetrics = rankingPeriods.weekly;
  const monthlyMetrics = rankingPeriods.monthly;
  const monthId = monthlyMetrics.monthId;
  const lastStudyAtMillis = rankingPeriods.lastStudyAtMillis;
  const accountStatus = String(sources.user.status || (sources.user.disabled ? 'disabled' : 'active')).toLowerCase();
  const accountActive = !sources.user.disabled && !['blocked', 'disabled'].includes(accountStatus);
  const rankingEligible = accountActive && rules.hasRecentRankingActivity({ lastStudyAtMillis, now: rankingNow });
  const platformSinceMillis = timestampMillis(
    sources.user.createdAt
    || sources.user.dataCriacao
    || sources.user.criadoEm
    || sources.user.registrationDate,
  ) || timestampMillis(sources.authUser?.metadata?.creationTime);
  const publicProfile = {
    coverURL: sources.user.coverURL || null,
    coverPosition: sources.user.coverPosition || null,
    editais: buildPublicEditais(sources),
    streak: Number(profilePayload.streak || 0),
    streakState: profilePayload.streakState || 'not_applicable',
    focusSubjects: buildPublicFocusSubjects(validRecords, rules),
    mainGroupName: sources.profile.mainGroupName || null,
    platformSinceMillis,
    studies: validRecords.length + validSimulations.length,
  };
  const generalMember = {
    uid,
    displayName: userNameFrom(sources.user, sources.authUser),
    photoURL: sources.user.photoURL || sources.authUser?.photoURL || null,
    level: profilePayload.level,
    leagueId: rules.getLeague(sources.profile.currentLeague || sources.profile.league || 'iron').id,
    minutes: generalMetrics.minutes,
    questions: generalMetrics.questions,
    correct: generalMetrics.correct,
    accuracy: generalMetrics.questions ? Number(((generalMetrics.correct / generalMetrics.questions) * 100).toFixed(2)) : 0,
    errors: Math.max(0, generalMetrics.questions - generalMetrics.correct),
    active: accountActive,
    accountActive,
    accountStatus,
    lastStudyAtMillis,
    rankingEligible,
    ...publicProfile,
    updatedAt: serverTimestamp(),
  };
  const generalMembersRef = db().collection('general_rankings').doc('all').collection('members');
  const generalMemberRef = generalMembersRef.doc(uid);
  if (rankingEligible) {
    await setIfChanged(generalMemberRef, withoutAuditTimestamps(generalMember));
  } else {
    await deleteIfExists(generalMemberRef);
  }
  const weeklyRankingEligible = rankingEligible && weeklyMetrics.hasActivity;
  const weeklyMember = {
    uid,
    displayName: generalMember.displayName,
    photoURL: generalMember.photoURL,
    level: generalMember.level,
    leagueId: generalMember.leagueId,
    competitiveXP: 0,
    weeklyXP: 0,
    minutes: weeklyMetrics.minutes,
    questions: weeklyMetrics.questions,
    correct: weeklyMetrics.correct,
    accuracy: weeklyMetrics.questions ? Number(((weeklyMetrics.correct / weeklyMetrics.questions) * 100).toFixed(2)) : 0,
    errors: Math.max(0, weeklyMetrics.questions - weeklyMetrics.correct),
    accountActive,
    accountStatus,
    lastStudyAtMillis,
    rankingEligible: weeklyRankingEligible,
    ...publicProfile,
    ruleVersion: rules.GAMIFICATION_RULE_VERSION,
    updatedAt: serverTimestamp(),
  };
  const monthlyMember = {
    uid,
    displayName: generalMember.displayName,
    photoURL: generalMember.photoURL,
    level: generalMember.level,
    leagueId: generalMember.leagueId,
    minutes: monthlyMetrics.minutes,
    questions: monthlyMetrics.questions,
    correct: monthlyMetrics.correct,
    accuracy: monthlyMetrics.questions ? Number(((monthlyMetrics.correct / monthlyMetrics.questions) * 100).toFixed(2)) : 0,
    errors: Math.max(0, monthlyMetrics.questions - monthlyMetrics.correct),
    accountActive,
    accountStatus,
    lastStudyAtMillis,
    rankingEligible: rankingEligible && monthlyMetrics.hasActivity,
    ...publicProfile,
    periodType: 'monthly',
    monthId,
    ruleVersion: rules.GAMIFICATION_RULE_VERSION,
    updatedAt: serverTimestamp(),
  };
  const currentEvents = academicEvents.filter((event) => event.weekId === weekId);
  const competitionStarted = !sources.profile.competitionStartsWeekId || weekId >= sources.profile.competitionStartsWeekId;
  const competitiveXP = competitionStarted ? currentEvents.reduce((sum, event) => sum + Number(event.xpCompetitive || 0), 0) : 0;
  if (!weeklyRankingEligible || competitiveXP <= 0) {
    const previousCohortId = sources.profile.competitiveWeekId === weekId ? sources.profile.currentCohortId : null;
    if (previousCohortId) {
      const generalMemberRef = db().collection('weekly_rankings').doc(weekId).collection('members').doc(uid);
      const cohortRef = db().collection('weekly_rankings').doc(weekId).collection('cohorts').doc(previousCohortId);
      const cohortMemberRef = cohortRef.collection('members').doc(uid);
      await db().runTransaction(async (transaction) => {
        const [cohortSnapshot, memberSnapshot] = await Promise.all([
          transaction.get(cohortRef),
          transaction.get(cohortMemberRef),
        ]);
        if (memberSnapshot.exists) transaction.delete(cohortMemberRef);
        transaction.delete(generalMemberRef);
        if (cohortSnapshot.exists && memberSnapshot.exists) {
          const nextCount = Math.max(0, Number(cohortSnapshot.data()?.participantCount || 1) - 1);
          transaction.set(cohortRef, {
            participantCount: nextCount,
            status: nextCount >= 10 ? 'full' : 'open',
            updatedAt: serverTimestamp(),
          }, { merge: true });
        }
        transaction.set(sources.profileRef, {
          currentCohortId: null,
          competitiveWeekId: weekId,
          weeklyCompetitiveXP: 0,
          weeklyXP: 0,
          updatedAt: serverTimestamp(),
        }, { merge: true });
      });
    }
    const weeklyGeneralMemberRef = db().collection('weekly_rankings').doc(weekId).collection('members').doc(uid);
    if (weeklyRankingEligible) {
      await setIfChanged(weeklyGeneralMemberRef, withoutAuditTimestamps(weeklyMember));
    } else {
      await deleteIfExists(weeklyGeneralMemberRef);
    }
    await Promise.all((sources.profile.groupIds || []).filter(Boolean).flatMap((groupId) => [
      syncGroupWeeklyMember({ groupId, weekId, uid, member: weeklyMetrics.hasActivity ? weeklyMember : null }),
      syncGroupMonthlyMember({ groupId, monthId, uid, member: monthlyMetrics.hasActivity ? monthlyMember : null }),
    ]));
    if (!skipGeneralPositionUpdate) {
      await updateRankingMetricPositions({ membersRef: generalMembersRef, rules, targetUid: uid });
    }
    await updateRankingMetricPositions({
      membersRef: db().collection('weekly_rankings').doc(weekId).collection('members'),
      rules,
      targetUid: uid,
    });
    return { competitiveXP: 0, cohortId: null };
  }
  const leagueId = rules.getLeague(sources.profile.currentLeague || sources.profile.league || 'iron').id;
  const cohortId = await ensureCohort({ uid, profileRef: sources.profileRef, leagueId, weekId });
  const metrics = weeklyMetrics;
  const finalXPReachedAtMillis = Math.max(...currentEvents.map((event) => Number(event.sourceMillis || 0)), 1);
  const member = {
    uid,
    displayName: userNameFrom(sources.user, sources.authUser),
    photoURL: sources.user.photoURL || sources.authUser?.photoURL || null,
    level: profilePayload.level,
    leagueId,
    cohortId,
    competitiveXP,
    weeklyXP: competitiveXP,
    minutes: metrics.minutes,
    questions: metrics.questions,
    correct: metrics.correct,
    accuracy: metrics.questions ? Number(((metrics.correct / metrics.questions) * 100).toFixed(2)) : 0,
    errors: Math.max(0, metrics.questions - metrics.correct),
    accountActive,
    accountStatus,
    lastStudyAtMillis,
    rankingEligible: weeklyRankingEligible,
    ...publicProfile,
    finalXPReachedAt: admin.firestore.Timestamp.fromMillis(finalXPReachedAtMillis),
    ruleVersion: rules.GAMIFICATION_RULE_VERSION,
    updatedAt: serverTimestamp(),
  };
  const weeklyMemberRef = db().collection('weekly_rankings').doc(weekId).collection('members').doc(uid);
  const cohortMemberRef = db().collection('weekly_rankings').doc(weekId).collection('cohorts').doc(cohortId).collection('members').doc(uid);
  const profileRankingPayload = {
    currentCohortId: cohortId,
    competitiveWeekId: weekId,
    weeklyCompetitiveXP: competitiveXP,
    weeklyXP: competitiveXP,
  };
  const [weeklyMemberSnapshot, cohortMemberSnapshot, currentProfileSnapshot] = await db().getAll(
    weeklyMemberRef,
    cohortMemberRef,
    sources.profileRef,
  );
  await Promise.all([
    setIfChanged(weeklyMemberRef, withoutAuditTimestamps(member), { snapshot: weeklyMemberSnapshot }),
    setIfChanged(cohortMemberRef, withoutAuditTimestamps(member), { snapshot: cohortMemberSnapshot }),
    setIfChanged(sources.profileRef, profileRankingPayload, { snapshot: currentProfileSnapshot }),
  ]);
  await Promise.all((sources.profile.groupIds || []).filter(Boolean).flatMap((groupId) => [
    syncGroupWeeklyMember({ groupId, weekId, uid, member }),
    syncGroupMonthlyMember({ groupId, monthId, uid, member: monthlyMetrics.hasActivity ? monthlyMember : null }),
  ]));
  await Promise.all([
    ...(skipGeneralPositionUpdate ? [] : [updateRankingMetricPositions({ membersRef: generalMembersRef, rules, targetUid: uid })]),
    updateRankingMetricPositions({
      membersRef: db().collection('weekly_rankings').doc(weekId).collection('members'),
      rules,
      targetUid: uid,
    }),
  ]);
  const cohortMembers = await db().collection('weekly_rankings').doc(weekId).collection('cohorts').doc(cohortId).collection('members').get();
  const sortedCohort = rules.sortCompetitiveMembers(dataWithId(cohortMembers));
  const positionsBatch = db().batch();
  let cohortPositionWrites = 0;
  sortedCohort.forEach((rankedMember, index) => {
    const nextPosition = index + 1;
    const storedPosition = Number(rankedMember.position || 0);
    const changed = storedPosition > 0 && storedPosition !== nextPosition;
    const positionPayload = {
      position: nextPosition,
      previousPosition: changed ? storedPosition : Number(rankedMember.previousPosition || storedPosition || nextPosition),
      positionDelta: changed ? storedPosition - nextPosition : Number(rankedMember.positionDelta || 0),
    };
    if (!payloadChanged(rankedMember, positionPayload)) return;
    positionsBatch.set(
      db().collection('weekly_rankings').doc(weekId).collection('cohorts').doc(cohortId).collection('members').doc(rankedMember.uid || rankedMember.id),
      {
        ...positionPayload,
        updatedAt: serverTimestamp(),
      },
      { merge: true },
    );
    cohortPositionWrites += 1;
  });
  if (cohortPositionWrites) await positionsBatch.commit();
  const position = sortedCohort.findIndex((item) => (item.uid || item.id) === uid) + 1;
  const zone = position > 0 ? rules.getRankingZone({ position, participants: sortedCohort.length, leagueId, merged: false }) : 'neutral';
  const previousPosition = Number(sources.profile.lastNotifiedLeaguePosition || 0);
  const previousZone = sources.profile.lastNotifiedLeagueZone || null;
  if ((previousPosition && position && previousPosition !== position) || (previousZone && previousZone !== zone)) {
    const notificationRef = db().collection('users').doc(uid).collection('notifications').doc(`league_state_${weekId}_${position}_${zone}`);
    await notificationRef.set({
      type: 'league_state',
      title: previousZone !== zone ? 'Sua zona da liga mudou' : 'Nova posição na liga',
      message: zone === 'promotion' ? `Você entrou na zona de promoção em ${position}º.` : zone === 'relegation' ? `Atenção: você está na zona de rebaixamento em ${position}º.` : `Você agora está em ${position}º na zona neutra.`,
      groupId: null,
      status: 'active',
      requiresAction: false,
      isRead: false,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      metadata: { weekId, position, zone, previousPosition, previousZone },
    }, { merge: true });
  }
  await setIfChanged(sources.profileRef, { lastNotifiedLeaguePosition: position, lastNotifiedLeagueZone: zone });
  return { competitiveXP, cohortId };
};

const recomputeUserGamification = async (uid, { skipGeneralPositionUpdate = false, change = null } = {}) => {
  if (!uid) return null;
  if (change) return processGamificationSourceChange({ uid, ...change });
  const rules = await domain();
  const sources = await loadUserGamificationSources(uid);
  if (!sources.userExists || await userDeletionStarted(uid)) return { uid, skipped: 'user-deleted' };
  const cutoffMillis = getMigrationCutoffMillis(sources.profile);
  const newRecords = cutoffMillis ? sources.records.filter((item) => sourceCreatedMillis(item) > cutoffMillis) : sources.records;
  const newSimulations = cutoffMillis ? sources.simulations.filter((item) => sourceCreatedMillis(item) > cutoffMillis) : sources.simulations;
  const newQuestionRewards = cutoffMillis
    ? sources.questionRewards.filter((item) => sourceCreatedMillis(item) > cutoffMillis)
    : sources.questionRewards;
  const academicEvents = [
    ...rules.buildAcademicXPEvents({
      records: newRecords,
      simulations: newSimulations,
      questionRewards: newQuestionRewards,
      goals: sources.goals,
    }),
    ...await buildCompletionEvents({ cycleRounds: sources.cycleRounds, schedules: sources.schedules, cutoffMillis }),
  ];
  const previousAcademicIds = new Set(sources.xpEvents.filter((event) => event.category === 'academic').map((event) => event.id));
  const retainedEvents = sources.xpEvents.filter((event) => event.category !== 'academic' || academicEvents.some((next) => next.id === event.id));
  const retainedNonAcademicXP = calculatePersistedNonAcademicXP({
    achievements: sources.achievements,
    events: retainedEvents,
  });
  const academicXP = academicEvents.reduce((sum, event) => sum + Number(event.xpTotal || 0), 0);
  const baseXP = Number(sources.profile.baseXP || 0);
  const totalXPBeforeAchievements = baseXP + academicXP + retainedNonAcademicXP;
  const state = await calculateHistoricalState(sources, totalXPBeforeAchievements);
  const unlockedIds = sources.achievements.filter((item) => item.unlocked).map((item) => item.id);
  const evaluation = rules.evaluateAchievements(state, unlockedIds);
  const newAchievements = evaluation.newlyUnlocked;
  const totalXP = totalXPBeforeAchievements + newAchievements.reduce((sum, item) => sum + item.xp, 0);
  const level = rules.getLevelFromXP(totalXP);
  const currentWeekId = rules.getWeekId();
  const competitionStarted = !sources.profile.competitionStartsWeekId || currentWeekId >= sources.profile.competitionStartsWeekId;
  const weeklyCompetitiveXP = competitionStarted ? academicEvents.filter((event) => event.weekId === currentWeekId).reduce((sum, event) => sum + Number(event.xpCompetitive || 0), 0) : 0;
  const currentLeague = rules.getLeague(sources.profile.currentLeague || sources.profile.league || 'iron');
  const profilePayload = {
    baseXP,
    totalXP,
    level,
    currentLeague: currentLeague.id,
    leagueName: currentLeague.name,
    weeklyCompetitiveXP,
    weeklyXP: weeklyCompetitiveXP,
    competitiveWeekId: currentWeekId,
    totals: {
      minutes: state.totals.minutes,
      questions: state.totals.questions,
      correct: state.totals.correct,
      accuracy: Number(state.accuracy.toFixed(2)),
      reviews: state.reviews,
      studies: state.studies,
      simulations: state.simulations,
      dailyGoals: state.dailyGoals,
      cycleRounds: state.cycleRounds,
      schedulesCompleted: state.schedulesCompleted,
    },
    achievementIds: [...evaluation.unlockedIds].sort(),
    achievementsSummary: { unlocked: evaluation.unlockedIds.length, total: rules.ACHIEVEMENTS.length },
    streak: state.streak,
    currentStreak: state.streak,
    streakState: state.streakState,
    streakContext: state.streakContext,
    ruleVersion: rules.GAMIFICATION_RULE_VERSION,
    updatedAt: serverTimestamp(),
  };
  if (await userDeletionStarted(uid)) return { uid, skipped: 'user-deleted' };
  await writeEventsAndAchievements({ sources, academicEvents, newAchievements, state: { ...state, level }, rules });
  const questionEvents = academicEvents.filter((event) => event.sourceType === 'question');
  const questionXPBySource = Object.fromEntries(questionEvents.map((event) => [event.sourceId, Number(event.xpTotal || 0)]));
  await setIfChanged(sources.userRef.collection('question_stats').doc('summary'), {
    totalXpEarned: questionEvents.reduce((sum, event) => sum + Number(event.xpTotal || 0), 0),
  });
  await setIfChanged(sources.profileRef, withoutAuditTimestamps(profilePayload));
  const rankingResult = await updateRankings({ uid, sources, profilePayload, academicEvents, rules, skipGeneralPositionUpdate });
  // O recálculo completo pode levar minutos em contas antigas. Releia os
  // planejamentos ao final para que uma execução concorrente nunca deixe no
  // perfil público a fotografia que capturou no início.
  await refreshUserPublicPlanningProfile(uid);
  return {
    uid,
    totalXP,
    level,
    weeklyCompetitiveXP: rankingResult.competitiveXP,
    cohortId: rankingResult.cohortId,
    createdAcademicEvents: academicEvents.filter((event) => !previousAcademicIds.has(event.id)).length,
    achievementsUnlocked: newAchievements.map((item) => item.id),
    questionXPBySource,
  };
};

const refreshActiveUserRankings = async () => {
  const rules = await domain();
  const weekId = rules.getWeekId();
  const now = new Date();
  const [generalMembers, weeklyMembers] = await Promise.all([
    db().collection('general_rankings').doc('all').collection('members').get(),
    db().collection('weekly_rankings').doc(weekId).collection('members').get(),
  ]);
  const writer = db().bulkWriter();
  const publicProfileUids = new Set([
    ...generalMembers.docs.map((snapshot) => snapshot.id),
    ...weeklyMembers.docs.map((snapshot) => snapshot.id),
  ]);
  const counts = {
    generalEligible: 0,
    generalRemoved: 0,
    weeklyEligible: 0,
    weeklyRemoved: 0,
    publicProfilesRefreshed: 0,
  };

  generalMembers.docs.forEach((snapshot) => {
    const member = snapshot.data() || {};
    const eligible = member.accountActive !== false && rules.hasRecentRankingActivity({
      lastStudyAtMillis: member.lastStudyAtMillis,
      now,
    });
    if (!eligible) {
      counts.generalRemoved += 1;
      writer.delete(snapshot.ref);
      return;
    }
    counts.generalEligible += 1;
    const payload = {
      rankingEligible: true,
      accuracy: Number(rules.getRankingAccuracy(member).toFixed(2)),
    };
    if (payloadChanged(member, payload)) {
      writer.set(snapshot.ref, { ...payload, eligibilityUpdatedAt: serverTimestamp() }, { merge: true });
    }
  });

  weeklyMembers.docs.forEach((snapshot) => {
    const member = snapshot.data() || {};
    const hasWeeklyStudy = Number(member.minutes || 0) > 0 || Number(member.questions || 0) > 0;
    const eligible = member.accountActive !== false
      && hasWeeklyStudy
      && rules.hasRecentRankingActivity({ lastStudyAtMillis: member.lastStudyAtMillis, now });
    if (!eligible) {
      counts.weeklyRemoved += 1;
      writer.delete(snapshot.ref);
      return;
    }
    counts.weeklyEligible += 1;
    const payload = {
      rankingEligible: true,
      accuracy: Number(rules.getRankingAccuracy(member).toFixed(2)),
    };
    if (payloadChanged(member, payload)) {
      writer.set(snapshot.ref, { ...payload, eligibilityUpdatedAt: serverTimestamp() }, { merge: true });
    }
  });

  await writer.close();
  // Perfis públicos são projetados pelos gatilhos das próprias fontes. Fazer
  // isso aqui multiplicava U usuários por todo o histórico de cada usuário.
  counts.publicProfilesSkippedAsUnchanged = publicProfileUids.size;
  await Promise.all([
    updateRankingMetricPositions({
      membersRef: db().collection('general_rankings').doc('all').collection('members'),
      rules,
    }),
    updateRankingMetricPositions({
      membersRef: db().collection('weekly_rankings').doc(weekId).collection('members'),
      rules,
    }),
  ]);
  console.info('Ranking eligibility refresh completed', { weekId, ...counts });
  return { weekId, ...counts };
};

// Reprocessa em lotes pequenos os perfis que foram gravados com a regra de
// sequência retroativa. O marcador torna a operação idempotente e impede que
// o agendamento volte a recalcular toda a base depois da recuperação.
const recoverHistoricalStreaks = async () => {
  const recoveryRef = db().collection('system_maintenance').doc('historical_streak_recovery');
  const recoverySnapshot = await recoveryRef.get();
  const recovery = recoverySnapshot.data() || {};
  if (recovery.version === HISTORICAL_STREAK_RECOVERY_VERSION && recovery.status === 'completed') {
    return { status: 'completed', processedCount: 0, cursor: recovery.cursor || null };
  }

  const afterUid = recovery.version === HISTORICAL_STREAK_RECOVERY_VERSION
    && typeof recovery.cursor === 'string' && recovery.cursor
    ? recovery.cursor
    : null;
  let query = db().collection('users').orderBy(admin.firestore.FieldPath.documentId()).limit(HISTORICAL_STREAK_RECOVERY_BATCH_SIZE);
  if (afterUid) query = query.startAfter(afterUid);
  const usersSnapshot = await query.get();
  let processedCount = 0;
  let failedCount = 0;
  let cursor = afterUid;
  const weeklyRootsSnapshot = await db().collection('weekly_rankings').get();
  const weeklyRoots = [...weeklyRootsSnapshot.docs]
    .sort((left, right) => right.id.localeCompare(left.id))
    .slice(0, 16);

  for (const userSnapshot of usersSnapshot.docs) {
    cursor = userSnapshot.id;
    try {
      const profileRef = userSnapshot.ref.collection('gamification').doc('profile');
      const profileSnapshot = await profileRef.get();
      const profile = profileSnapshot.data() || {};
      const archivedMemberSnapshots = await Promise.all(
        weeklyRoots.map((weekSnapshot) => weekSnapshot.ref.collection('members').doc(userSnapshot.id).get()),
      );
      const persistedCandidates = [
        profile.streak,
        profile.currentStreak,
        profile.historicalStreakBaseline?.value,
        userSnapshot.data()?.streak,
        userSnapshot.data()?.currentStreak,
        ...archivedMemberSnapshots.flatMap((snapshot) => {
          const member = snapshot.data() || {};
          return [member.streak, member.currentStreak, member.studyStreak];
        }),
        ...(Array.isArray(profile.achievementIds) ? profile.achievementIds : [])
          .map((id) => String(id).match(/^streak_(\d+)$/)?.[1]),
      ].map(Number).filter((value) => Number.isFinite(value) && value > 0);
      const persistedBaseline = persistedCandidates.length ? Math.max(...persistedCandidates) : 0;
      if (persistedBaseline > Number(profile.historicalStreakBaseline?.value || 0)) {
        await profileRef.set({
          historicalStreakBaseline: {
            value: persistedBaseline,
            cutoverDate: '2026-08-15',
            source: 'persisted-ranking-or-profile',
            recoveredAt: serverTimestamp(),
          },
        }, { merge: true });
      }
      await recomputeUserGamification(userSnapshot.id);
      processedCount += 1;
    } catch (error) {
      failedCount += 1;
      console.error(`Falha ao recuperar sequência histórica de ${userSnapshot.id}:`, error);
    }
    await recoveryRef.set({
      version: HISTORICAL_STREAK_RECOVERY_VERSION,
      status: 'running',
      cursor,
      processedCount: FieldValue.increment(processedCount + failedCount ? 1 : 0),
      failedCount: FieldValue.increment(failedCount ? 1 : 0),
      updatedAt: serverTimestamp(),
      startedAt: recovery.startedAt || serverTimestamp(),
    }, { merge: true });
    processedCount = 0;
    failedCount = 0;
  }

  const completed = usersSnapshot.size < HISTORICAL_STREAK_RECOVERY_BATCH_SIZE;
  await recoveryRef.set({
    version: HISTORICAL_STREAK_RECOVERY_VERSION,
    status: completed ? 'completed' : 'running',
    cursor,
    completedAt: completed ? serverTimestamp() : null,
    updatedAt: serverTimestamp(),
  }, { merge: true });
  const result = { status: completed ? 'completed' : 'running', processedCount: usersSnapshot.size, cursor };
  console.info('Historical streak recovery batch completed', result);
  return result;
};

const refreshUserPublicPlanningProfile = async (uid) => {
  if (!uid) return null;
  const rules = await domain();
  const userRef = db().collection('users').doc(uid);
  const strictStartDate = rules.STRICT_STREAK_RULES_START_DATE;
  const profileRef = userRef.collection('gamification').doc('profile');
  const profileSnapshot = await profileRef.get();
  const profile = profileSnapshot.exists ? profileSnapshot.data() : {};
  const hasPersistedHistoricalBaseline = Object.hasOwn(profile.historicalStreakBaseline || {}, 'value');
  const strictStartTimestamp = admin.firestore.Timestamp.fromDate(new Date(`${strictStartDate}T00:00:00-03:00`));
  const recordQueries = hasPersistedHistoricalBaseline ? [
    userRef.collection('registrosEstudo').where('data', '>=', strictStartDate).get(),
    userRef.collection('registrosEstudo').where('date', '>=', strictStartDate).get(),
    userRef.collection('registrosEstudo').where('timestamp', '>=', strictStartTimestamp).get(),
  ] : [userRef.collection('registrosEstudo').get()];
  const simulationQueries = hasPersistedHistoricalBaseline ? [
    userRef.collection('simulados').where('data', '>=', strictStartDate).get(),
    userRef.collection('simulados').where('date', '>=', strictStartDate).get(),
    userRef.collection('simulados').where('timestamp', '>=', strictStartTimestamp).get(),
  ] : [userRef.collection('simulados').get()];
  const [cyclesSnapshot, cycleReviewsSnapshot, schedulesSnapshot, recordSnapshots, simulationSnapshots] = await Promise.all([
    userRef.collection('ciclos').where('ativo', '==', true).get(),
    userRef.collection('revisoesCiclo').get(),
    userRef.collection('cronogramas').where('ativo', '==', true).get(),
    Promise.all(recordQueries),
    Promise.all(simulationQueries),
  ]);
  const sources = {
    cycles: dataWithId(cyclesSnapshot),
    cycleReviews: dataWithId(cycleReviewsSnapshot),
    schedules: dataWithId(schedulesSnapshot),
    records: mergeSnapshotsById(...recordSnapshots),
    simulations: mergeSnapshotsById(...simulationSnapshots),
  };
  const streakResult = rules.calculateCanonicalStudyStreak({
    ...sources,
    now: new Date(),
    historicalStreakBaseline: Number(profile.historicalStreakBaseline?.value || 0),
  });
  const hasLegacyActivity = !hasPersistedHistoricalBaseline && [
    ...sources.records.map((item) => incrementalSourceDateKey({ sourceType: 'study', source: item, rules })),
    ...sources.simulations.map((item) => incrementalSourceDateKey({ sourceType: 'simulation', source: item, rules })),
  ].some((dateKey) => dateKey && dateKey < strictStartDate);
  const lazyHistoricalBaseline = hasLegacyActivity
    ? Math.max(
      Number(profile.historicalStreakBaseline?.value || 0),
      Number(profile.currentStreak || profile.streak || 0),
      Number(streakResult.currentStreak || 0),
    )
    : 0;
  const payload = {
    editais: buildPublicEditais(sources),
    streak: streakResult.currentStreak,
    streakState: streakResult.days?.[streakResult.today]?.state || 'not_applicable',
  };
  await setIfChanged(userRef.collection('gamification').doc('profile'), {
    publicEditais: payload.editais,
    streak: payload.streak,
    currentStreak: payload.streak,
    streakState: payload.streakState,
    streakContext: streakResult.context || null,
    ...(!hasPersistedHistoricalBaseline ? {
      historicalStreakBaseline: {
        value: lazyHistoricalBaseline,
        cutoverDate: strictStartDate,
        source: hasLegacyActivity ? 'lazy-legacy-recovery' : 'post-cutover-profile',
        recoveredAt: serverTimestamp(),
      },
    } : {}),
  });
  const weekId = rules.getWeekId();
  const monthId = rules.getMonthId();
  const refs = [
    db().collection('general_rankings').doc('all').collection('members').doc(uid),
    db().collection('weekly_rankings').doc(weekId).collection('members').doc(uid),
  ];
  if (profile.currentCohortId) {
    refs.push(db().collection('weekly_rankings').doc(weekId).collection('cohorts').doc(profile.currentCohortId).collection('members').doc(uid));
  }
  (profile.groupIds || []).filter(Boolean).forEach((groupId) => {
    refs.push(db().collection('study_groups').doc(groupId).collection('weekly_rankings').doc(weekId).collection('members').doc(uid));
    refs.push(db().collection('study_groups').doc(groupId).collection('monthly_rankings').doc(monthId).collection('members').doc(uid));
  });
  const uniqueRefs = [...new Map(refs.map((ref) => [ref.path, ref])).values()];
  const snapshots = await db().getAll(...uniqueRefs);
  const batch = db().batch();
  let writes = 0;
  snapshots.forEach((snapshot) => {
    if (!snapshot.exists) return;
    if (!payloadChanged(snapshot.data() || {}, payload)) return;
    batch.set(snapshot.ref, { ...payload, publicPlanningUpdatedAt: serverTimestamp() }, { merge: true });
    writes += 1;
  });
  if (writes) await batch.commit();
  return { uid, ...payload, writes };
};

const refreshUserRankingIdentity = async (uid) => {
  if (!uid) return null;
  const rules = await domain();
  const userRef = db().collection('users').doc(uid);
  const profileRef = userRef.collection('gamification').doc('profile');
  const [userSnapshot, profileSnapshot] = await db().getAll(userRef, profileRef);
  if (!userSnapshot.exists) return { uid, skipped: 'missing-user' };
  const user = userSnapshot.data() || {};
  const profile = profileSnapshot.data() || {};
  const weekId = rules.getWeekId();
  const monthId = rules.getMonthId();
  const payload = {
    displayName: userNameFrom(user),
    photoURL: user.photoURL || null,
    coverURL: user.coverURL || null,
    coverPosition: user.coverPosition || null,
    mainGroupName: profile.mainGroupName || null,
    platformSinceMillis: timestampMillis(user.createdAt || user.dataCriacao || user.criadoEm || user.registrationDate),
  };
  const refs = [
    db().collection('general_rankings').doc('all').collection('members').doc(uid),
    db().collection('weekly_rankings').doc(weekId).collection('members').doc(uid),
  ];
  if (profile.currentCohortId) {
    refs.push(db().collection('weekly_rankings').doc(weekId).collection('cohorts').doc(profile.currentCohortId).collection('members').doc(uid));
  }
  (profile.groupIds || []).filter(Boolean).forEach((groupId) => {
    refs.push(db().collection('study_groups').doc(groupId).collection('weekly_rankings').doc(weekId).collection('members').doc(uid));
    refs.push(db().collection('study_groups').doc(groupId).collection('monthly_rankings').doc(monthId).collection('members').doc(uid));
  });
  const uniqueRefs = [...new Map(refs.map((ref) => [ref.path, ref])).values()];
  const snapshots = await db().getAll(...uniqueRefs);
  const writer = db().bulkWriter();
  let writes = 0;
  snapshots.forEach((snapshot) => {
    if (!snapshot.exists || !payloadChanged(snapshot.data() || {}, payload)) return;
    writer.set(snapshot.ref, { ...payload, updatedAt: serverTimestamp() }, { merge: true });
    writes += 1;
  });
  await writer.close();
  return { uid, writes };
};

const refreshPublicStudyGroupProfiles = async () => {
  const rules = await domain();
  const weekId = rules.getWeekId();
  const monthId = rules.getMonthId();
  const groupsSnapshot = await db().collection('study_groups').get();
  const groupsByUser = new Map();

  for (const groupSnapshot of groupsSnapshot.docs) {
    const group = { id: groupSnapshot.id, ...groupSnapshot.data() };
    const groupId = String(group.id || group.groupId || '').trim();
    const groupName = String(group.name || group.nome || '').trim();
    const publicGroup = groupId && groupName ? {
      id: groupId,
      name: groupName.slice(0, 80),
      photoURL: group.photoURL || group.photoUrl || null,
      editalName: String(group.editalName || group.editalNome || '').trim().slice(0, 120) || null,
      editalLogoURL: group.editalLogoURL || group.editalLogoUrl || null,
      memberCount: Math.max(0, Number(group.memberCount || 0)),
      visibility: group.visibility === 'private' ? 'private' : 'public',
    } : null;
    if (!publicGroup) continue;
    const membersSnapshot = await groupSnapshot.ref.collection('members').get();
    membersSnapshot.docs.forEach((memberSnapshot) => {
      const uid = memberSnapshot.id;
      const current = groupsByUser.get(uid) || [];
      current.push(publicGroup);
      groupsByUser.set(uid, current);
    });
    if (group.ownerId) {
      const ownerGroups = groupsByUser.get(group.ownerId) || [];
      if (!ownerGroups.some((item) => item.id === publicGroup.id)) ownerGroups.push(publicGroup);
      groupsByUser.set(group.ownerId, ownerGroups);
    }
  }

  const writer = db().bulkWriter();
  let updatedDocuments = 0;
  const entries = [...groupsByUser.entries()];
  for (let cursor = 0; cursor < entries.length; cursor += 20) {
    const chunk = entries.slice(cursor, cursor + 20);
    await Promise.all(chunk.map(async ([uid, studyGroups]) => {
      const profileRef = db().collection('users').doc(uid).collection('gamification').doc('profile');
      const generalRef = db().collection('general_rankings').doc('all').collection('members').doc(uid);
      const weeklyRef = db().collection('weekly_rankings').doc(weekId).collection('members').doc(uid);
      const [profileSnapshot, generalSnapshot, weeklySnapshot] = await Promise.all([
        profileRef.get(), generalRef.get(), weeklyRef.get(),
      ]);
      const snapshots = [generalSnapshot, weeklySnapshot];
      const cohortId = weeklySnapshot.data()?.cohortId || profileSnapshot.data()?.currentCohortId;
      if (cohortId) {
        snapshots.push(await db().collection('weekly_rankings').doc(weekId).collection('cohorts').doc(cohortId).collection('members').doc(uid).get());
      }
      snapshots.push(...await Promise.all(studyGroups.map((group) => (
        db().collection('study_groups').doc(group.id).collection('weekly_rankings').doc(weekId).collection('members').doc(uid).get()
      ))));
      snapshots.push(...await Promise.all(studyGroups.map((group) => (
        db().collection('study_groups').doc(group.id).collection('monthly_rankings').doc(monthId).collection('members').doc(uid).get()
      ))));
      snapshots.filter((snapshot) => snapshot.exists).forEach((snapshot) => {
        writer.set(snapshot.ref, { studyGroups, publicGroupsUpdatedAt: serverTimestamp() }, { merge: true });
        updatedDocuments += 1;
      });
    }));
  }
  await writer.close();
  return { users: groupsByUser.size, groups: groupsSnapshot.size, updatedDocuments, weekId };
};

const rewardEvent = async ({ uid, id, xp, message, category = 'reward', weekId, metadata = {} }) => {
  const rules = await domain();
  const ref = db().collection('users').doc(uid).collection('gamification').doc('profile').collection('xp_events').doc(id);
  try {
    await ref.create({
      sourceKey: id,
      sourceType: category,
      sourceId: id,
      category,
      xpTotal: xp,
      xpCompetitive: 0,
      message,
      weekId,
      dateKey: rules.toDateKey(),
      ruleVersion: rules.GAMIFICATION_RULE_VERSION,
      occurredAt: serverTimestamp(),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      isRead: false,
      metadata,
    });
  } catch (error) {
    if (![6, '6', 'already-exists', 'ALREADY_EXISTS'].includes(error?.code)) throw error;
  }
};

const notifyWeeklyClosing = async () => {
  const rules = await domain();
  const weekId = rules.getWeekId();
  const members = await db().collection('weekly_rankings').doc(weekId).collection('members').get();
  const writer = db().bulkWriter();
  members.docs.forEach((item) => writer.set(db().collection('users').doc(item.id).collection('notifications').doc(`league_closing_${weekId}`), {
    type: 'league_closing',
    title: 'A rodada fecha em poucas horas',
    message: 'Confira sua posição e sua zona antes do fechamento desta semana.',
    status: 'active',
    requiresAction: false,
    isRead: false,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    metadata: { weekId },
  }, { merge: true }));
  await writer.close();
  return { weekId, notified: members.size };
};

const closeCohort = async ({ weekId, cohort, members, merged = false, mergedFrom = [] }) => {
  const rules = await domain();
  const sorted = rules.sortCompetitiveMembers(members);
  const count = sorted.length;
  const league = rules.getLeague(cohort.leagueId);
  const { promoted, relegated } = rules.getPromotionRelegationCounts(count, { merged });
  const batch = db().batch();
  const resultRows = [];
  sorted.forEach((member, index) => {
    const position = index + 1;
    const zone = rules.getRankingZone({ position, participants: count, leagueId: league.id, merged });
    const movement = zone === 'promotion' ? 1 : zone === 'relegation' ? -1 : 0;
    const nextLeague = rules.getLeagueMovement(league.id, movement);
    const podiumXP = Number(rules.GAMIFICATION_CONFIG.recurringRewards.league[position] || 0);
    const result = {
      weekId,
      cohortId: cohort.id,
      leagueId: league.id,
      leagueName: league.name,
      position,
      participants: count,
      zone,
      status: zone === 'promotion' ? 'promoted' : zone === 'relegation' ? 'relegated' : 'stayed',
      nextLeagueId: nextLeague.id,
      nextLeagueName: nextLeague.name,
      competitiveXP: Number(member.competitiveXP || 0),
      leagueRewardXP: podiumXP,
      closedAt: serverTimestamp(),
    };
    resultRows.push({ uid: member.uid || member.id, result, podiumXP, position });
    const memberRef = db().collection('weekly_rankings').doc(weekId).collection('cohorts').doc(cohort.id).collection('members').doc(member.uid || member.id);
    batch.set(memberRef, { position, zone, result, status: 'closed', updatedAt: serverTimestamp() }, { merge: true });
    const generalMemberRef = db().collection('weekly_rankings').doc(weekId).collection('members').doc(member.uid || member.id);
    batch.set(generalMemberRef, { leaguePosition: position, leagueZone: zone, leagueResult: result, updatedAt: serverTimestamp() }, { merge: true });
    const profileRef = db().collection('users').doc(member.uid || member.id).collection('gamification').doc('profile');
    batch.set(profileRef, {
      currentLeague: nextLeague.id,
      leagueName: nextLeague.name,
      highestLeagueIndex: Math.max(nextLeague.index, Number(member.highestLeagueIndex || 0)),
      currentCohortId: null,
      lastResult: result,
      updatedAt: serverTimestamp(),
    }, { merge: true });
    batch.set(db().collection('users').doc(member.uid || member.id).collection('notifications').doc(`league_result_${weekId}_${cohort.id}`), {
      type: 'league_result',
      title: zone === 'promotion' ? 'Você foi promovido!' : zone === 'relegation' ? 'Resultado da liga' : 'Você permaneceu na liga',
      message: `${position}º lugar na Liga ${league.name}. ${podiumXP > 0 ? `Você recebeu ${podiumXP} XP.` : ''}`.trim(),
      status: 'completed',
      requiresAction: false,
      isRead: false,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      metadata: result,
    }, { merge: true });
  });
  batch.set(db().collection('weekly_rankings').doc(weekId).collection('cohorts').doc(cohort.id), {
    status: 'closed',
    participantCount: count,
    promoted,
    relegated,
    merged,
    mergedFrom,
    closedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  }, { merge: true });
  await batch.commit();
  await Promise.all(resultRows.filter((row) => row.podiumXP > 0).map((row) => rewardEvent({
    uid: row.uid,
    id: `reward_league_${weekId}_${cohort.id}_${row.position}`,
    xp: row.podiumXP,
    message: `${row.position}º lugar na Liga ${league.name}`,
    weekId,
    metadata: { cohortId: cohort.id, position: row.position, leagueId: league.id },
  })));
  return resultRows;
};

const closeGeneralRanking = async (weekId) => {
  const rules = await domain();
  const snapshot = await db().collection('weekly_rankings').doc(weekId).collection('members').get();
  const sorted = rules.sortCompetitiveMembers(dataWithId(snapshot).filter((member) => (
    member.accountActive !== false && Number(member.competitiveXP || member.weeklyXP || 0) > 0
  )));
  const batch = db().batch();
  const rewards = [];
  sorted.forEach((member, index) => {
    const position = index + 1;
    const xp = Number(rules.GAMIFICATION_CONFIG.recurringRewards.general[position] || (position <= 10 ? rules.GAMIFICATION_CONFIG.recurringRewards.general.top10 : 0));
    batch.set(member.ref || snapshot.docs.find((item) => item.id === (member.uid || member.id))?.ref, { generalPosition: position, generalRewardXP: xp, updatedAt: serverTimestamp() }, { merge: true });
    if (xp > 0) rewards.push({ uid: member.uid || member.id, position, xp });
  });
  if (sorted.length) await batch.commit();
  await Promise.all(rewards.map((reward) => rewardEvent({
    uid: reward.uid,
    id: `reward_general_${weekId}_${reward.position}`,
    xp: reward.xp,
    message: reward.position <= 3 ? `${reward.position}º lugar no Ranking Geral` : 'Top 10 no Ranking Geral',
    weekId,
    metadata: { position: reward.position },
  })));
  return sorted.map((member, index) => ({ uid: member.uid || member.id, position: index + 1 }));
};

const closeGroupRankings = async (weekId) => {
  const rules = await domain();
  const groups = await db().collection('study_groups').get();
  const candidates = new Map();
  for (const groupDoc of groups.docs) {
    const rankingRef = groupDoc.ref.collection('weekly_rankings').doc(weekId);
    const membersSnapshot = await rankingRef.collection('members').get();
    const sorted = rules.sortCompetitiveMembers(dataWithId(membersSnapshot));
    const batch = db().batch();
    sorted.forEach((member, index) => {
      const position = index + 1;
      batch.set(membersSnapshot.docs.find((item) => item.id === (member.uid || member.id)).ref, { position, frozen: true, updatedAt: serverTimestamp() }, { merge: true });
      const xp = Number(rules.GAMIFICATION_CONFIG.recurringRewards.group[position] || 0);
      if (xp > 0) {
        const uid = member.uid || member.id;
        const list = candidates.get(uid) || [];
        list.push({ uid, groupId: groupDoc.id, groupName: groupDoc.data().name || 'Grupo', position, xp });
        candidates.set(uid, list);
      }
    });
    batch.set(rankingRef, { frozen: true, participantCount: sorted.length, closedAt: serverTimestamp(), updatedAt: serverTimestamp() }, { merge: true });
    await batch.commit();
  }
  const rewards = [];
  candidates.forEach((items) => rewards.push(...items.sort((a, b) => b.xp - a.xp || a.groupId.localeCompare(b.groupId)).slice(0, rules.GAMIFICATION_CONFIG.recurringRewards.maxGroupPodiumsPerWeek)));
  await Promise.all(rewards.map(async (reward) => {
    await rewardEvent({
      uid: reward.uid,
      id: `reward_group_${weekId}_${reward.groupId}_${reward.position}`,
      xp: reward.xp,
      message: `${reward.position}º lugar no grupo ${reward.groupName}`,
      weekId,
      metadata: { groupId: reward.groupId, position: reward.position },
    });
  }));
  return rewards;
};

const closeWeeklyGamification = async (weekId = null) => {
  const rules = await domain();
  const currentWeekId = rules.getWeekId();
  const targetWeekId = weekId || (() => {
    const cursor = new Date(`${currentWeekId}T12:00:00Z`);
    cursor.setUTCDate(cursor.getUTCDate() - 7);
    return cursor.toISOString().slice(0, 10);
  })();
  const rankingRef = db().collection('weekly_rankings').doc(targetWeekId);
  const closureRef = rankingRef.collection('system').doc('closure');
  const closure = await closureRef.get();
  if (closure.data()?.status === 'completed') return { weekId: targetWeekId, alreadyClosed: true };
  await closureRef.set({ status: 'processing', attempts: admin.firestore.FieldValue.increment(1), startedAt: serverTimestamp(), ruleVersion: rules.GAMIFICATION_RULE_VERSION }, { merge: true });
  const cohortSnapshot = await rankingRef.collection('cohorts').get();
  const cohorts = dataWithId(cohortSnapshot).filter((item) => !['closed', 'merged'].includes(item.status)).sort((a, b) => a.leagueId.localeCompare(b.leagueId) || Number(a.sequence || 0) - Number(b.sequence || 0));
  const byLeague = new Map();
  cohorts.forEach((cohort) => {
    const list = byLeague.get(cohort.leagueId) || [];
    list.push(cohort);
    byLeague.set(cohort.leagueId, list);
  });
  const allResults = [];
  for (const leagueCohorts of byLeague.values()) {
    for (let index = 0; index < leagueCohorts.length; index += 1) {
      const cohort = leagueCohorts[index];
      const memberSnapshot = await rankingRef.collection('cohorts').doc(cohort.id).collection('members').get();
      let members = dataWithId(memberSnapshot);
      let merged = false;
      let mergedFrom = [];
      const isLast = index === leagueCohorts.length - 1;
      if (isLast && members.length < 10 && index > 0) {
        const previous = leagueCohorts[index - 1];
        const previousSnapshot = await rankingRef.collection('cohorts').doc(previous.id).collection('members').get();
        const previousMembers = dataWithId(previousSnapshot);
        if (previousMembers.length === 10) {
          members = [...previousMembers, ...members];
          merged = true;
          mergedFrom = [previous.id, cohort.id];
          index -= 0;
          const previousResults = await closeCohort({ weekId: targetWeekId, cohort: previous, members, merged, mergedFrom });
          allResults.push(...previousResults);
          await rankingRef.collection('cohorts').doc(cohort.id).set({ status: 'merged', mergedInto: previous.id, closedAt: serverTimestamp() }, { merge: true });
          continue;
        }
      }
      if (index < leagueCohorts.length - 1 && leagueCohorts[index + 1] && Number(leagueCohorts[index + 1].participantCount || 0) < 10 && members.length === 10) continue;
      const results = await closeCohort({ weekId: targetWeekId, cohort, members, merged, mergedFrom });
      allResults.push(...results);
    }
  }
  const generalResults = await closeGeneralRanking(targetWeekId);
  const groupRewards = await closeGroupRankings(targetWeekId);
  const affectedUsers = new Set([...allResults.map((row) => row.uid), ...generalResults.map((row) => row.uid), ...groupRewards.map((row) => row.uid)]);
  for (const uid of affectedUsers) await recomputeUserGamification(uid);
  await closureRef.set({ status: 'completed', completedAt: serverTimestamp(), cohortResults: allResults.length, generalParticipants: generalResults.length, groupRewards: groupRewards.length }, { merge: true });
  return { weekId: targetWeekId, cohortResults: allResults.length, generalParticipants: generalResults.length, groupRewards: groupRewards.length };
};

const simulateWeeklyGamificationClosure = async (weekId = null) => {
  const rules = await domain();
  const targetWeekId = weekId || rules.getWeekId();
  const rankingRef = db().collection('weekly_rankings').doc(targetWeekId);
  const [weekSnapshot, closureSnapshot, cohortSnapshot] = await Promise.all([
    rankingRef.get(),
    rankingRef.collection('system').doc('closure').get(),
    rankingRef.collection('cohorts').get(),
  ]);
  const cohorts = [];
  for (const cohortDoc of cohortSnapshot.docs) {
    const cohort = { id: cohortDoc.id, ...cohortDoc.data() };
    const membersSnapshot = await cohortDoc.ref.collection('members').get();
    const members = rules.sortCompetitiveMembers(dataWithId(membersSnapshot));
    const rows = members.map((member, index) => {
      const position = index + 1;
      const zone = rules.getRankingZone({
        position,
        participants: members.length,
        leagueId: cohort.leagueId,
        merged: false,
      });
      const movement = zone === 'promotion' ? 'up' : zone === 'relegation' ? 'down' : 'same';
      const nextLeague = rules.getLeagueMovement(cohort.leagueId, movement);
      return {
        uid: member.uid || member.id,
        displayName: member.displayName || member.name || 'Usuario',
        position,
        competitiveXP: Number(member.competitiveXP || member.weeklyXP || 0),
        zone,
        currentLeague: cohort.leagueId,
        nextLeague: nextLeague.id,
      };
    });
    cohorts.push({
      id: cohort.id,
      leagueId: cohort.leagueId || 'iron',
      status: cohort.status || 'open',
      participantCount: members.length,
      promotions: rows.filter((row) => row.zone === 'promotion').length,
      relegations: rows.filter((row) => row.zone === 'relegation').length,
      protected: rows.filter((row) => row.zone === 'protected').length,
      members: rows,
    });
  }
  cohorts.sort((a, b) => a.leagueId.localeCompare(b.leagueId) || a.id.localeCompare(b.id));
  return {
    weekId: targetWeekId,
    weekStatus: closureSnapshot.data()?.status || weekSnapshot.data()?.status || 'open',
    cohortCount: cohorts.length,
    participantCount: cohorts.reduce((sum, cohort) => sum + cohort.participantCount, 0),
    promotions: cohorts.reduce((sum, cohort) => sum + cohort.promotions, 0),
    relegations: cohorts.reduce((sum, cohort) => sum + cohort.relegations, 0),
    protected: cohorts.reduce((sum, cohort) => sum + cohort.protected, 0),
    cohorts,
  };
};

const buildMigrationPreview = async (sources) => {
  const rules = await domain();
  const currentXP = Number(sources.profile.totalXP || sources.user.totalXP || 0);
  if (sources.profile.migration?.version === rules.GAMIFICATION_RULE_VERSION) {
    return {
      uid: sources.userRef.id,
      previousXP: currentXP,
      baseXP: Number(sources.profile.baseXP || 0),
      roundingXP: 0,
      retroactiveXP: 0,
      finalXP: currentXP,
      level: Number(sources.profile.level || rules.getLevelFromXP(currentXP)),
      league: sources.profile.currentLeague || 'iron',
      achievements: [],
      state: null,
      alreadyMigrated: true,
    };
  }
  const baseXP = rules.roundMigrationBaseXP(currentXP);
  const state = await calculateHistoricalState(sources, baseXP);
  const evaluation = rules.evaluateAchievements(state, sources.achievements.filter((item) => item.unlocked).map((item) => item.id));
  const retroactiveXP = evaluation.newlyUnlocked.reduce((sum, item) => sum + item.xp, 0);
  return {
    uid: sources.userRef.id,
    previousXP: currentXP,
    baseXP,
    roundingXP: baseXP - currentXP,
    retroactiveXP,
    finalXP: baseXP + retroactiveXP,
    level: rules.getLevelFromXP(baseXP + retroactiveXP),
    league: 'iron',
    achievements: evaluation.newlyUnlocked.map((item) => ({ id: item.id, title: item.title, xp: item.xp })),
    state,
  };
};

const migrateGamification = async ({ apply = false, uid = null } = {}) => {
  const rules = await domain();
  const userDocs = uid ? [await db().collection('users').doc(uid).get()] : (await db().collection('users').get()).docs;
  const existingUsers = userDocs.filter((item) => item.exists);
  const previews = [];
  for (const userDoc of existingUsers) {
    const sources = await loadUserGamificationSources(userDoc.id);
    const preview = await buildMigrationPreview(sources);
    previews.push(preview);
    if (!apply || preview.alreadyMigrated) continue;
    const cutoff = admin.firestore.Timestamp.now();
    const batch = db().batch();
    batch.set(sources.profileRef, {
      baseXP: preview.baseXP,
      totalXP: preview.finalXP,
      level: preview.level,
      currentLeague: 'iron',
      leagueName: 'Ferro',
      currentCohortId: null,
      weeklyCompetitiveXP: 0,
      weeklyXP: 0,
      ruleVersion: rules.GAMIFICATION_RULE_VERSION,
      migration: {
        version: rules.GAMIFICATION_RULE_VERSION,
        cutoffAt: cutoff,
        previousXP: preview.previousXP,
        baseXP: preview.baseXP,
        roundingXP: preview.roundingXP,
        retroactiveXP: preview.retroactiveXP,
        migratedAt: cutoff,
      },
      competitionStartsWeekId: rules.getNextWeekId(rules.getWeekId()),
      achievementIds: [...new Set([...sources.achievements.filter((item) => item.unlocked).map((item) => item.id), ...preview.achievements.map((item) => item.id)])],
      achievementsSummary: { unlocked: preview.achievements.length + sources.achievements.filter((item) => item.unlocked).length, total: rules.ACHIEVEMENTS.length },
      updatedAt: serverTimestamp(),
    }, { merge: true });
    preview.achievements.forEach((item) => batch.set(sources.profileRef.collection('achievements').doc(item.id), {
      ...item,
      unlocked: true,
      unlockedAt: cutoff,
      xpGranted: item.xp,
      ruleVersion: rules.GAMIFICATION_RULE_VERSION,
      updatedAt: serverTimestamp(),
    }, { merge: true }));
    if (preview.retroactiveXP > 0) batch.set(sources.profileRef.collection('xp_events').doc(`migration_achievements_${rules.GAMIFICATION_RULE_VERSION.replace(/\./g, '_')}`), {
      sourceKey: `migration:achievements:${rules.GAMIFICATION_RULE_VERSION}`,
      sourceType: 'migration_achievements',
      sourceId: rules.GAMIFICATION_RULE_VERSION,
      category: 'achievement',
      xpTotal: preview.retroactiveXP,
      xpCompetitive: 0,
      message: `${preview.achievements.length} conquistas históricas desbloqueadas`,
      ruleVersion: rules.GAMIFICATION_RULE_VERSION,
      occurredAt: cutoff,
      createdAt: cutoff,
      updatedAt: cutoff,
      isRead: false,
    }, { merge: true });
    await batch.commit();
  }
  return {
    mode: apply ? 'apply' : 'dry-run',
    affectedUsers: previews.length,
    preservedXP: previews.reduce((sum, item) => sum + item.previousXP, 0),
    roundedXP: previews.reduce((sum, item) => sum + item.roundingXP, 0),
    retroactiveXP: previews.reduce((sum, item) => sum + item.retroactiveXP, 0),
    users: previews.map(({ state, ...preview }) => preview),
  };
};

module.exports = {
  recomputeUserGamification,
  processGamificationSourceChange,
  recoverHistoricalStreaks,
  refreshUserGroupMonthlyRankings,
  refreshStudyGroupMonthlyRankings,
  refreshUserPublicPlanningProfile,
  refreshUserRankingIdentity,
  refreshActiveUserRankings,
  refreshPublicStudyGroupProfiles,
  closeWeeklyGamification,
  simulateWeeklyGamificationClosure,
  notifyWeeklyClosing,
  migrateGamification,
  __test: {
    isCompletedSchedule,
    buildPublicEditais,
    calculatePersistedNonAcademicXP,
    buildMigrationPreview,
    functionalValuesEqual,
    payloadChanged,
    buildIncrementalDayState,
  },
};
