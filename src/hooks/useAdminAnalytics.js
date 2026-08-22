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

const INITIAL_LOADED = {
  users: false,
  records: false,
  simulations: false,
  cycles: false,
  schedules: false,
  timers: false,
  gamification: false,
};

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

  useEffect(() => subscribe('records', query(collectionGroup(db, 'registrosEstudo'), orderBy('timestamp', 'desc'), limit(5000)), (snapshot) => {
    setRawStudyRecords(snapshot.docs.map((docSnap) => ({
      id: docSnap.id,
      path: docSnap.ref.path,
      uid: docSnap.data().uid || docSnap.ref.path.split('/')[1],
      ...docSnap.data(),
    })));
  }), []);

  useEffect(() => subscribe('simulations', query(collectionGroup(db, 'simulados'), orderBy('timestamp', 'desc'), limit(2000)), (snapshot) => {
    setRawSimulations(snapshot.docs.map((docSnap) => ({
      id: docSnap.id,
      path: docSnap.ref.path,
      uid: docSnap.data().uid || docSnap.ref.path.split('/')[1],
      ...docSnap.data(),
    })));
  }), []);

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

  useEffect(() => onSnapshot(
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
  ), []);

  useEffect(() => {
    if (!gamificationCollectionDenied || !loaded.users) return undefined;
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
  }, [gamificationCollectionDenied, loaded.users, rawUsers]);

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
      const ranking = rankingByMetric.hours.find((row) => row.id === user.id);
      const latest = allActivities.find((record) => record.uid === user.id);
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

  const activeSessionsFresh = useMemo(() => activeSessions.filter((session) => (
    Date.now() - (toAdminDate(session.updatedAt)?.getTime() || 0)
  ) <= 2 * 60 * 1000), [activeSessions]);

  const studyingNowSessions = useMemo(() => {
    const rank = (session) => (!session.isPaused && session.phase !== 'rest' ? 0 : !session.isPaused ? 1 : 2);
    return [...activeSessionsFresh].sort((a, b) => rank(a) - rank(b));
  }, [activeSessionsFresh]);

  const cicloNameByKey = useMemo(() => new Map(
    [...cicloMetaByKey].map(([key, value]) => [key, value.nome]),
  ), [cicloMetaByKey]);

  const getUser = (uid) => state.users.find((user) => user.id === uid)
    || rawUsers.find((user) => user.id === uid)
    || { id: uid, name: 'Usuário', email: 'Não informado' };

  return {
    loading: Object.values(loaded).some((value) => !value),
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
