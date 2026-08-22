const admin = require('firebase-admin');

if (!admin.apps.length) {
  admin.initializeApp({ projectId: process.env.GCLOUD_PROJECT || process.env.GOOGLE_CLOUD_PROJECT || 'dashboard-pmba' });
}

const db = () => admin.firestore();
const serverTimestamp = () => admin.firestore.FieldValue.serverTimestamp();
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
  if (schedule.concluido === true || schedule.finalizado === true || schedule.status === 'concluido') return true;
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
    schedulesSnapshot,
    achievementsSnapshot,
    xpEventsSnapshot,
    ownedGroupsSnapshot,
  ] = await Promise.all([
    userRef.get(),
    userRef.collection('gamification').doc('profile').get(),
    userRef.collection('registrosEstudo').get(),
    userRef.collection('simulados').get(),
    userRef.collection('metas').get(),
    userRef.collection('ciclos').get(),
    userRef.collection('cronogramas').get(),
    userRef.collection('gamification').doc('profile').collection('achievements').get(),
    userRef.collection('gamification').doc('profile').collection('xp_events').get(),
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
    user: userSnapshot.exists ? userSnapshot.data() : {},
    authUser,
    profileRef: userRef.collection('gamification').doc('profile'),
    profile: profileSnapshot.exists ? profileSnapshot.data() : {},
    records: dataWithId(recordsSnapshot),
    simulations: dataWithId(simulationsSnapshot),
    goals: dataWithId(goalsSnapshot),
    cycles,
    schedules: dataWithId(schedulesSnapshot),
    cycleRounds,
    achievements: dataWithId(achievementsSnapshot),
    xpEvents: dataWithId(xpEventsSnapshot),
    ownedGroups: dataWithId(ownedGroupsSnapshot),
  };
};

const getMigrationCutoffMillis = (profile = {}) => (
  timestampMillis(profile.migration?.cutoffAt || profile.migrationCutoffAt)
);

const sourceCreatedMillis = (source = {}) => timestampMillis(
  source.timestamp || source.criadoEm || source.dataCriacao || source.createdAt || source.data || source.date,
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
  [...sources.cycles.map((item) => planPublicIdentity(item, 'cycle')), ...sources.schedules.map((item) => planPublicIdentity(item, 'schedule'))]
    .filter(Boolean)
    .forEach((item) => {
      const key = item.id !== 'manual' ? item.id : item.name.toLocaleLowerCase('pt-BR');
      if (!unique.has(key)) unique.set(key, item);
    });
  return [...unique.values()].slice(0, 6);
};

const updateRankingMetricPositions = async ({ membersRef, rules, activeCutoffMillis = 0 }) => {
  const snapshot = await membersRef.get();
  const members = dataWithId(snapshot).filter((member) => (
    member.accountActive !== false
    && (!activeCutoffMillis || Number(member.lastStudyAtMillis || 0) >= activeCutoffMillis)
  ));
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
  members.forEach((member) => {
    const uid = member.uid || member.id;
    const positions = nextByUid.get(uid) || {};
    const stored = member.positions || {};
    const changedMetrics = ['minutes', 'questions'].filter((metric) => Number(stored[metric] || 0) > 0 && Number(stored[metric]) !== Number(positions[metric]));
    const payload = { positions, updatedPositionAt: serverTimestamp() };
    if (changedMetrics.length) {
      payload.previousPositions = { ...(member.previousPositions || {}) };
      payload.positionDeltas = { ...(member.positionDeltas || {}) };
      changedMetrics.forEach((metric) => {
        payload.previousPositions[metric] = Number(stored[metric]);
        payload.positionDeltas[metric] = Number(stored[metric]) - Number(positions[metric]);
      });
      payload.positionChangedAt = serverTimestamp();
    }
    writer.set(membersRef.doc(uid), payload, { merge: true });
  });
  await writer.close();
};

const buildCompletionEvents = async ({ cycleRounds, schedules, cutoffMillis }) => {
  const rules = await domain();
  const events = [];
  cycleRounds.forEach((round) => {
    const millis = sourceCreatedMillis(round);
    if (cutoffMillis && millis <= cutoffMillis) return;
    const dateKey = rules.toDateKey(round.fechamentoReal || round.fechadoEm || round.criadoEm || round.dataFim || millis);
    if (!dateKey) return;
    events.push({
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
    events.push({
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
  return events;
};

const calculateHistoricalState = async (sources, totalXPBeforeAchievements) => {
  const rules = await domain();
  const recordMetrics = sources.records.filter(rules.isValidGamificationRecord).map(rules.getStudyMetrics);
  const simulationMetrics = sources.simulations.filter(rules.isValidGamificationRecord).map(rules.getSimuladoMetrics);
  const allMetrics = [...recordMetrics, ...simulationMetrics];
  const totals = allMetrics.reduce((sum, metric) => ({
    minutes: sum.minutes + metric.minutes,
    questions: sum.questions + metric.questions,
    correct: sum.correct + metric.correct,
  }), { minutes: 0, questions: 0, correct: 0 });
  const accuracy = totals.questions ? (totals.correct / totals.questions) * 100 : 0;
  const dailyGoalEvents = rules.buildAcademicXPEvents({
    records: sources.records,
    simulations: sources.simulations,
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
    streak: rules.calculateStudyStreak(sources.records),
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

const writeEventsAndAchievements = async ({ sources, academicEvents, newAchievements, state, rules }) => {
  const writer = db().bulkWriter();
  const nextAcademicIds = new Set(academicEvents.map((event) => event.id));
  sources.xpEvents
    .filter((event) => event.category === 'academic' && !nextAcademicIds.has(event.id))
    .forEach((event) => writer.delete(sources.profileRef.collection('xp_events').doc(event.id)));
  academicEvents.forEach((event) => {
    const existing = sources.xpEvents.find((item) => item.id === event.id);
    const unchanged = existing
      && Number(existing.xpTotal || 0) === event.xpTotal
      && Number(existing.xpCompetitive || 0) === event.xpCompetitive
      && existing.message === event.message;
    writer.set(sources.profileRef.collection('xp_events').doc(event.id), serializeEvent(event, rules, unchanged ? {
      isRead: existing.isRead === true,
      ...(existing.readAt ? { readAt: existing.readAt } : {}),
    } : {}), { merge: true });
  });
  rules.ACHIEVEMENTS.forEach((item) => {
    const progress = rules.getAchievementProgress(item, state);
    const existing = sources.achievements.find((achievementItem) => achievementItem.id === item.id);
    const isNew = newAchievements.some((achievementItem) => achievementItem.id === item.id);
    writer.set(sources.profileRef.collection('achievements').doc(item.id), {
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
      ...(isNew ? { unlockedAt: serverTimestamp(), xpGranted: item.xp } : {}),
      ruleVersion: rules.GAMIFICATION_RULE_VERSION,
      updatedAt: serverTimestamp(),
    }, { merge: true });
  });
  newAchievements.forEach((item) => {
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
    writer.set(sources.profileRef.collection('xp_events').doc(event.id), serializeEvent(event, rules), { merge: true });
  });
  await writer.close();
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
  const rankingNow = new Date();
  const rankingPeriods = rules.calculateRankingPeriodMetrics({ records: validRecords, simulations: validSimulations, now: rankingNow });
  const generalMetrics = rankingPeriods.lifetime;
  const weeklyMetrics = rankingPeriods.weekly;
  const lastStudyAtMillis = rankingPeriods.lastStudyAtMillis;
  const accountStatus = String(sources.user.status || (sources.user.disabled ? 'disabled' : 'active')).toLowerCase();
  const accountActive = !sources.user.disabled && !['blocked', 'disabled'].includes(accountStatus);
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
    ...publicProfile,
    updatedAt: serverTimestamp(),
  };
  const generalMembersRef = db().collection('general_rankings').doc('all').collection('members');
  await generalMembersRef.doc(uid).set(generalMember, { merge: true });
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
    ...publicProfile,
    ruleVersion: rules.GAMIFICATION_RULE_VERSION,
    updatedAt: serverTimestamp(),
  };
  const currentEvents = academicEvents.filter((event) => event.weekId === weekId);
  const competitionStarted = !sources.profile.competitionStartsWeekId || weekId >= sources.profile.competitionStartsWeekId;
  const competitiveXP = competitionStarted ? currentEvents.reduce((sum, event) => sum + Number(event.xpCompetitive || 0), 0) : 0;
  if (!accountActive || competitiveXP <= 0) {
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
      const cleanup = db().batch();
      (sources.profile.groupIds || []).filter(Boolean).forEach((groupId) => {
        cleanup.delete(db().collection('study_groups').doc(groupId).collection('weekly_rankings').doc(weekId).collection('members').doc(uid));
      });
      await cleanup.commit();
    }
    await db().collection('weekly_rankings').doc(weekId).collection('members').doc(uid).set(weeklyMember, { merge: true });
    if (!skipGeneralPositionUpdate) {
      await updateRankingMetricPositions({ membersRef: generalMembersRef, rules });
    }
    await updateRankingMetricPositions({ membersRef: db().collection('weekly_rankings').doc(weekId).collection('members'), rules });
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
    ...publicProfile,
    finalXPReachedAt: admin.firestore.Timestamp.fromMillis(finalXPReachedAtMillis),
    ruleVersion: rules.GAMIFICATION_RULE_VERSION,
    updatedAt: serverTimestamp(),
  };
  const batch = db().batch();
  batch.set(db().collection('weekly_rankings').doc(weekId).collection('members').doc(uid), member, { merge: true });
  batch.set(db().collection('weekly_rankings').doc(weekId).collection('cohorts').doc(cohortId).collection('members').doc(uid), member, { merge: true });
  (sources.profile.groupIds || []).filter(Boolean).forEach((groupId) => {
    batch.set(db().collection('study_groups').doc(groupId).collection('weekly_rankings').doc(weekId).collection('members').doc(uid), member, { merge: true });
  });
  batch.set(sources.profileRef, {
    currentCohortId: cohortId,
    competitiveWeekId: weekId,
    weeklyCompetitiveXP: competitiveXP,
    weeklyXP: competitiveXP,
    updatedAt: serverTimestamp(),
  }, { merge: true });
  await batch.commit();
  await Promise.all([
    ...(skipGeneralPositionUpdate ? [] : [updateRankingMetricPositions({ membersRef: generalMembersRef, rules })]),
    updateRankingMetricPositions({ membersRef: db().collection('weekly_rankings').doc(weekId).collection('members'), rules }),
  ]);
  const cohortMembers = await db().collection('weekly_rankings').doc(weekId).collection('cohorts').doc(cohortId).collection('members').get();
  const sortedCohort = rules.sortCompetitiveMembers(dataWithId(cohortMembers));
  const positionsBatch = db().batch();
  sortedCohort.forEach((rankedMember, index) => {
    const nextPosition = index + 1;
    const storedPosition = Number(rankedMember.position || 0);
    const changed = storedPosition > 0 && storedPosition !== nextPosition;
    positionsBatch.set(
      db().collection('weekly_rankings').doc(weekId).collection('cohorts').doc(cohortId).collection('members').doc(rankedMember.uid || rankedMember.id),
      {
        position: nextPosition,
        previousPosition: changed ? storedPosition : Number(rankedMember.previousPosition || storedPosition || nextPosition),
        positionDelta: changed ? storedPosition - nextPosition : Number(rankedMember.positionDelta || 0),
        updatedAt: serverTimestamp(),
      },
      { merge: true },
    );
  });
  await positionsBatch.commit();
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
  await sources.profileRef.set({ lastNotifiedLeaguePosition: position, lastNotifiedLeagueZone: zone }, { merge: true });
  return { competitiveXP, cohortId };
};

const recomputeUserGamification = async (uid, { skipGeneralPositionUpdate = false } = {}) => {
  if (!uid) return null;
  const rules = await domain();
  const sources = await loadUserGamificationSources(uid);
  const cutoffMillis = getMigrationCutoffMillis(sources.profile);
  const newRecords = cutoffMillis ? sources.records.filter((item) => sourceCreatedMillis(item) > cutoffMillis) : sources.records;
  const newSimulations = cutoffMillis ? sources.simulations.filter((item) => sourceCreatedMillis(item) > cutoffMillis) : sources.simulations;
  const academicEvents = [
    ...rules.buildAcademicXPEvents({ records: newRecords, simulations: newSimulations, goals: sources.goals }),
    ...await buildCompletionEvents({ cycleRounds: sources.cycleRounds, schedules: sources.schedules, cutoffMillis }),
  ];
  const previousAcademicIds = new Set(sources.xpEvents.filter((event) => event.category === 'academic').map((event) => event.id));
  const retainedEvents = sources.xpEvents.filter((event) => event.category !== 'academic' || academicEvents.some((next) => next.id === event.id));
  const retainedNonAcademicXP = retainedEvents.filter((event) => event.category !== 'academic').reduce((sum, event) => sum + Number(event.xpTotal || 0), 0);
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
    achievementIds: evaluation.unlockedIds,
    achievementsSummary: { unlocked: evaluation.unlockedIds.length, total: rules.ACHIEVEMENTS.length },
    ruleVersion: rules.GAMIFICATION_RULE_VERSION,
    updatedAt: serverTimestamp(),
  };
  await writeEventsAndAchievements({ sources, academicEvents, newAchievements, state: { ...state, level }, rules });
  await sources.profileRef.set(profilePayload, { merge: true });
  const rankingResult = await updateRankings({ uid, sources, profilePayload, academicEvents, rules, skipGeneralPositionUpdate });
  return {
    uid,
    totalXP,
    level,
    weeklyCompetitiveXP: rankingResult.competitiveXP,
    cohortId: rankingResult.cohortId,
    createdAcademicEvents: academicEvents.filter((event) => !previousAcademicIds.has(event.id)).length,
    achievementsUnlocked: newAchievements.map((item) => item.id),
  };
};

const refreshActiveUserRankings = async () => {
  const rules = await domain();
  const weekId = rules.getWeekId();
  const users = await db().collection('users').get();
  const uids = new Set(users.docs.map((item) => item.id));
  const failures = [];
  let updatedUsers = 0;
  for (const uid of uids) {
    try {
      await recomputeUserGamification(uid, { skipGeneralPositionUpdate: true });
      updatedUsers += 1;
    } catch (error) {
      failures.push({ uid, code: error?.code || 'unknown' });
    }
  }
  await updateRankingMetricPositions({
    membersRef: db().collection('general_rankings').doc('all').collection('members'),
    rules,
  });
  return { weekId, requestedUsers: uids.size, updatedUsers, failures };
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
  refreshActiveUserRankings,
  closeWeeklyGamification,
  simulateWeeklyGamificationClosure,
  notifyWeeklyClosing,
  migrateGamification,
  __test: {
    isCompletedSchedule,
    buildMigrationPreview,
  },
};
