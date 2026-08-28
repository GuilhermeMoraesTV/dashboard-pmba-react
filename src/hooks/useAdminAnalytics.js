import { useEffect, useMemo, useState } from 'react';
import {
  collection,
  collectionGroup,
  doc,
  getDoc,
  limit,
  onSnapshot,
  orderBy,
  query,
  where,
} from 'firebase/firestore';
import { db } from '../firebaseConfig';
import {
  buildAdminAnalyticsDatasets,
  buildStudyRanking,
  DAY_MS,
  filterAdminActivities,
  prepareAdminActivities,
  toAdminDate,
} from '../utils/adminAnalytics';
import { getLeague } from '../utils/gamification';
import {
  getGroupMemberStudyState,
  GROUP_MEMBER_STUDY_STATES,
  isMonitorableStudySession,
} from '../utils/liveStudyTimer';

const INITIAL_LOADED = {
  users: false,
  records: false,
  simulations: false,
  cycles: false,
  schedules: false,
  timers: false,
  gamification: false,
};

const GAMIFICATION_TABS = new Set([
  'users',
  'gamification',
  'leagues',
  'groups',
  'moderation',
  'communications',
  'maintenance',
]);

const userCreatedAt = (user) => (
  toAdminDate(user?.createdAt)
  || toAdminDate(user?.criadoEm)
  || toAdminDate(user?.creationTime)
  || toAdminDate(user?.metadata?.creationTime)
  || null
);

const userProfile = (user) => String(
  user?.perfil || user?.role || user?.userType || user?.tipoPerfil || user?.tipo || user?.cargo || 'Não informado',
).trim();

const planMeta = (docSnap) => {
  const parts = docSnap.ref.path.split('/');
  const data = docSnap.data();
  return {
    key: `${parts[1]}_${parts[3]}`,
    value: {
      id: parts[3],
      uid: parts[1],
      nome: data.nome || data.titulo || 'Sem título',
      templateId: data.templateId || data.editalId || 'manual',
      editalId: data.editalId || data.templateId || 'manual',
      ...data,
    },
  };
};

export const useAdminAnalytics = ({
  activeTab = 'overview',
  filters = {},
  rankingMetric = 'hours',
  rankingLimit = 10,
  selectedFeedUid = 'all',
} = {}) => {
  const [rawUsers, setRawUsers] = useState([]);
  const [rawStudyRecords, setRawStudyRecords] = useState([]);
  const [rawSimulations, setRawSimulations] = useState([]);
  const [activeSessions, setActiveSessions] = useState([]);
  const [gamificationByUid, setGamificationByUid] = useState(new Map());
  const [gamificationCollectionDenied, setGamificationCollectionDenied] = useState(false);
  const [cicloMetaByKey, setCicloMetaByKey] = useState(new Map());
  const [cronogramaMetaByKey, setCronogramaMetaByKey] = useState(new Map());
  const [loaded, setLoaded] = useState(INITIAL_LOADED);
  const [errors, setErrors] = useState({});
  const [presenceNowMs, setPresenceNowMs] = useState(() => Date.now());
  const needsGamification = GAMIFICATION_TABS.has(activeTab);

  useEffect(() => {
    const timerId = window.setInterval(() => setPresenceNowMs(Date.now()), 30_000);
    return () => window.clearInterval(timerId);
  }, []);

  const subscribe = (key, firestoreQuery, onData) => onSnapshot(
    firestoreQuery,
    (snapshot) => {
      onData(snapshot);
      setLoaded((current) => ({ ...current, [key]: true }));
      setErrors((current) => {
        if (!current[key]) return current;
        const next = { ...current };
        delete next[key];
        return next;
      });
    },
    (snapshotError) => {
      console.error(`Falha ao carregar dados administrativos (${key}):`, snapshotError);
      setErrors((current) => ({
        ...current,
        [key]: snapshotError?.message || 'Não foi possível carregar os dados administrativos.',
      }));
      setLoaded((current) => ({ ...current, [key]: true }));
    },
  );

  useEffect(() => subscribe('users', query(collection(db, 'users')), (snapshot) => {
    setRawUsers(snapshot.docs.map((docSnap) => {
      const data = docSnap.data();
      return {
        id: docSnap.id,
        ...data,
        name: data.name || data.displayName || data.nome || data.email || 'Usuário',
        createdAt: userCreatedAt(data),
      };
    }));
  }), []);

  useEffect(() => {
    const constraints = [];
    const recordFrom = toAdminDate(filters.recordFrom);
    if (recordFrom) constraints.push(where('timestamp', '>=', recordFrom));
    constraints.push(orderBy('timestamp', 'desc'), limit(5000));
    setLoaded((current) => ({ ...current, records: false }));
    return subscribe('records', query(collectionGroup(db, 'registrosEstudo'), ...constraints), (snapshot) => {
      setRawStudyRecords(snapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        path: docSnap.ref.path,
        uid: docSnap.data().uid || docSnap.ref.path.split('/')[1],
        ...docSnap.data(),
      })));
    });
  }, [filters.recordFrom]);

  useEffect(() => {
    const constraints = [];
    const recordFrom = toAdminDate(filters.recordFrom);
    if (recordFrom) constraints.push(where('timestamp', '>=', recordFrom));
    constraints.push(orderBy('timestamp', 'desc'), limit(2000));
    setLoaded((current) => ({ ...current, simulations: false }));
    return subscribe('simulations', query(collectionGroup(db, 'simulados'), ...constraints), (snapshot) => {
      setRawSimulations(snapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        path: docSnap.ref.path,
        uid: docSnap.data().uid || docSnap.ref.path.split('/')[1],
        ...docSnap.data(),
      })));
    });
  }, [filters.recordFrom]);

  useEffect(() => subscribe('cycles', query(collectionGroup(db, 'ciclos'), limit(5000)), (snapshot) => {
      const next = new Map();
      snapshot.docs.forEach((docSnap) => {
        const meta = planMeta(docSnap);
        if (meta.value.uid && meta.value.id) next.set(meta.key, meta.value);
      });
      setCicloMetaByKey(next);
  }), []);

  useEffect(() => subscribe('schedules', query(collectionGroup(db, 'cronogramas'), limit(5000)), (snapshot) => {
      const next = new Map();
      snapshot.docs.forEach((docSnap) => {
        const meta = planMeta(docSnap);
        if (meta.value.uid && meta.value.id) next.set(meta.key, meta.value);
      });
      setCronogramaMetaByKey(next);
  }), []);

  useEffect(() => subscribe('timers', query(collection(db, 'active_timers')), (snapshot) => {
    setActiveSessions(snapshot.docs.map((docSnap) => ({
      id: docSnap.id,
      uid: docSnap.data().uid || docSnap.id,
      ...docSnap.data(),
      updatedAt: toAdminDate(docSnap.data().updatedAt),
      displaySecondsSnapshot: Number(docSnap.data().displaySecondsSnapshot ?? docSnap.data().seconds ?? 0),
      _receivedAt: Date.now(),
      _receivedPerf: typeof performance !== 'undefined' ? performance.now() : undefined,
    })));
  }), []);

  useEffect(() => {
    if (!needsGamification) return undefined;
    return onSnapshot(
      query(collectionGroup(db, 'gamification'), limit(5000)),
      (snapshot) => {
        const next = new Map();
        snapshot.docs.forEach((docSnap) => {
          if (docSnap.id !== 'profile') return;
          const parts = docSnap.ref.path.split('/');
          const uid = parts[0] === 'users' ? parts[1] : null;
          if (uid) next.set(uid, { id: docSnap.id, ...docSnap.data() });
        });
        setGamificationByUid(next);
        setGamificationCollectionDenied(false);
        setLoaded((current) => ({ ...current, gamification: true }));
        setErrors((current) => {
          if (!current.gamification) return current;
          const nextErrors = { ...current };
          delete nextErrors.gamification;
          return nextErrors;
        });
      },
      (snapshotError) => {
        if (snapshotError?.code === 'permission-denied') {
          // Regras antigas em produção podem negar collectionGroup. O caminho
          // individual já é permitido ao admin e mantém a tela funcional até a
          // publicação das regras consolidadas.
          setGamificationCollectionDenied(true);
          return;
        }
        console.error('Falha ao carregar dados administrativos (gamification):', snapshotError);
        setErrors((current) => ({
          ...current,
          gamification: snapshotError?.message || 'Não foi possível carregar a gamificação administrativa.',
        }));
        setLoaded((current) => ({ ...current, gamification: true }));
      },
    );
  }, [needsGamification]);

  useEffect(() => {
    if (!needsGamification || !gamificationCollectionDenied || !loaded.users) return undefined;
    let cancelled = false;

    const loadProfilesIndividually = async () => {
      try {
        const next = new Map();
        const batchSize = 40;
        for (let index = 0; index < rawUsers.length; index += batchSize) {
          const batch = rawUsers.slice(index, index + batchSize);
          const snapshots = await Promise.all(batch.map((user) => getDoc(doc(db, 'users', user.id, 'gamification', 'profile'))));
          snapshots.forEach((profileSnap, snapshotIndex) => {
            if (profileSnap.exists()) next.set(batch[snapshotIndex].id, { id: profileSnap.id, ...profileSnap.data() });
          });
        }
        if (cancelled) return;
        setGamificationByUid(next);
        setLoaded((current) => ({ ...current, gamification: true }));
        setErrors((current) => {
          if (!current.gamification) return current;
          const nextErrors = { ...current };
          delete nextErrors.gamification;
          return nextErrors;
        });
      } catch (fallbackError) {
        if (cancelled) return;
        console.error('Falha no fallback de gamificação administrativa:', fallbackError);
        setErrors((current) => ({
          ...current,
          gamification: fallbackError?.message || 'Não foi possível carregar os perfis de gamificação.',
        }));
        setLoaded((current) => ({ ...current, gamification: true }));
      }
    };

    loadProfilesIndividually();
    return () => { cancelled = true; };
  }, [gamificationCollectionDenied, loaded.users, needsGamification, rawUsers]);

  const state = useMemo(() => {
    const now = new Date();
    const profileFilteredUsers = filters.userProfile && filters.userProfile !== 'all'
      ? rawUsers.filter((user) => userProfile(user) === filters.userProfile)
      : rawUsers;
    const allowedUserIds = new Set(profileFilteredUsers.map((user) => user.id));

    const allActivities = prepareAdminActivities({
      studyRecords: rawStudyRecords,
      simulations: rawSimulations,
      cicloMetaByKey,
      cronogramaMetaByKey,
    }).filter((record) => allowedUserIds.has(record.uid));

    const activities = filterAdminActivities(allActivities, filters);
    const rankingByMetric = buildStudyRanking(profileFilteredUsers, activities);
    const hoursRankingByUid = new Map(rankingByMetric.hours.map((row) => [row.id, row]));
    const latestActivityByUid = new Map();
    allActivities.forEach((record) => {
      if (!latestActivityByUid.has(record.uid)) latestActivityByUid.set(record.uid, record);
    });
    const rankings = {
      hours: rankingByMetric.hours.slice(0, rankingLimit),
      questions: rankingByMetric.questions.slice(0, rankingLimit),
    };
    const rankingList = rankings[rankingMetric];
    const feedList = (selectedFeedUid === 'all'
      ? activities
      : activities.filter((record) => record.uid === selectedFeedUid)
    ).slice(0, 120);

    const last24h = now.getTime() - DAY_MS;
    const active24hIds = new Set(
      filterAdminActivities(allActivities, {
        ...filters,
        recordFrom: new Date(last24h),
      })
        .map((record) => record.uid),
    );

    const isActivePlan = (plan) => plan?.ativo === true
      || plan?.ativa === true
      || plan?.active === true
      || ['active', 'ativo', 'em_andamento'].includes(String(plan?.status || '').toLowerCase());
    const activeCycleUserIds = new Set([...cicloMetaByKey.values()].filter(isActivePlan).map((plan) => plan.uid));
    const activeScheduleUserIds = new Set([...cronogramaMetaByKey.values()].filter(isActivePlan).map((plan) => plan.uid));

    const enrichedUsers = profileFilteredUsers.map((user) => {
      const ranking = hoursRankingByUid.get(user.id);
      const latest = latestActivityByUid.get(user.id);
      const gamification = gamificationByUid.get(user.id) || null;
      const totalQuestions = ranking?.totalQuestions || 0;
      const totalCorrect = ranking?.totalCorrect || 0;
      const daysInactive = latest?.timestamp
        ? Math.max(0, Math.floor((now.getTime() - latest.timestamp.getTime()) / DAY_MS))
        : null;
      const status = user.status || (user.disabled ? 'disabled' : 'active');
      return {
        ...user,
        status,
        totalHours: ranking?.totalHours || 0,
        totalMinutes: ranking?.totalMinutes || 0,
        totalQuestions,
        totalCorrect,
        accuracy: totalQuestions > 0 ? Math.round((totalCorrect / totalQuestions) * 100) : 0,
        recordsCount: ranking?.recordsCount || 0,
        lastStudy: latest?.timestamp || null,
        daysInactive,
        risk: status === 'blocked' || status === 'disabled'
          ? 'Conta restrita'
          : daysInactive == null ? 'Sem atividade' : daysInactive >= 30 ? 'Risco 30d' : daysInactive >= 14 ? 'Risco 14d' : 'Saudavel',
        gamification,
        hasGamification: Boolean(gamification),
        level: Number(gamification?.level || gamification?.currentLevel || 0),
        league: gamification
          ? (gamification.leagueName || getLeague(gamification.currentLeague || gamification.league || gamification.leagueId || 'iron').name)
          : 'Sem liga',
        cohortId: gamification?.currentCohortId || null,
        mainGroupId: gamification?.mainGroupId || null,
        mainGroupName: gamification?.mainGroupName || 'Sem grupo',
        hasActiveCycle: activeCycleUserIds.has(user.id),
        hasActiveSchedule: activeScheduleUserIds.has(user.id),
      };
    });

    const datasets = buildAdminAnalyticsDatasets(activities, now, filters.windowDays || 30);
    const filterOptions = {
      userProfiles: [...new Set(rawUsers.map(userProfile).filter(Boolean))].sort(),
      templateIds: [...new Set(allActivities.map((record) => String(record.templateId || 'manual')).filter(Boolean))].sort(),
      accuracyBands: ['0-20%', '21-40%', '41-60%', '61-80%', '81-100%', 'Sem questoes'],
    };

    return {
      users: enrichedUsers,
      activities,
      rankings,
      rankingList,
      feedList,
      datasets,
      filterOptions,
      dashboardData: {
        totalUsers: profileFilteredUsers.length,
        active24h: active24hIds.size,
        datasets,
        enrichedUsers,
      },
    };
  }, [cicloMetaByKey, cronogramaMetaByKey, filters, gamificationByUid, rankingLimit, rankingMetric, rawSimulations, rawStudyRecords, rawUsers, selectedFeedUid]);

  const activeSessionsFresh = useMemo(() => {
    return activeSessions.filter((session) => isMonitorableStudySession(session, presenceNowMs));
  }, [activeSessions, presenceNowMs]);

  const studyingNowSessions = useMemo(() => {
    const rank = (session) => {
      const state = getGroupMemberStudyState(session, presenceNowMs);
      if (state === GROUP_MEMBER_STUDY_STATES.STUDYING) return 0;
      if (state === GROUP_MEMBER_STUDY_STATES.PAUSED) return 2;
      return 1;
    };
    return [...activeSessionsFresh].sort((a, b) => rank(a) - rank(b));
  }, [activeSessionsFresh, presenceNowMs]);

  const cicloNameByKey = useMemo(() => new Map(
    [...cicloMetaByKey].map(([key, value]) => [key, value.nome]),
  ), [cicloMetaByKey]);

  const userByUid = useMemo(() => {
    const next = new Map(rawUsers.map((user) => [user.id, user]));
    state.users.forEach((user) => next.set(user.id, user));
    return next;
  }, [rawUsers, state.users]);

  const getUser = (uid) => userByUid.get(uid)
    || { id: uid, name: 'Usuário', email: 'Não informado' };

  const loadingState = {
    users: !loaded.users,
    activities: !loaded.records || !loaded.simulations || !loaded.cycles || !loaded.schedules,
    timers: !loaded.users || !loaded.timers,
    gamification: needsGamification && (!loaded.users || !loaded.gamification),
  };
  const sectionLoading = activeTab === 'analytics'
    ? loadingState.activities
    : activeTab === 'gamification'
      ? loadingState.gamification
      : activeTab === 'users'
        ? loadingState.users || loadingState.activities || loadingState.gamification
        : GAMIFICATION_TABS.has(activeTab)
          ? loadingState.users || loadingState.gamification
          : loadingState.users;

  return {
    loading: sectionLoading,
    loadingState,
    error: Object.values(errors)[0] || null,
    users: state.users,
    rawUsers,
    studyRecords: state.activities,
    rawStudyRecords,
    activeSessions,
    activeSessionsFresh,
    studyingNowSessions,
    cicloNameByKey,
    getUser,
    dashboardData: state.dashboardData,
    rankings: state.rankings,
    rankingList: state.rankingList,
    feedList: state.feedList,
    filterOptions: state.filterOptions,
    analytics: { datasets: state.datasets },
  };
};
