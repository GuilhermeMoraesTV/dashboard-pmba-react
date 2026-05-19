import { useEffect, useMemo, useState } from 'react';
import { collection, collectionGroup, limit, onSnapshot, orderBy, query } from 'firebase/firestore';
import { db } from '../firebaseConfig';

const DAY_MS = 24 * 60 * 60 * 1000;
const PERIODS = [
  { key: '24h', label: '24h', durationMs: DAY_MS },
  { key: '7d', label: '7d', durationMs: 7 * DAY_MS },
  { key: '30d', label: '30d', durationMs: 30 * DAY_MS },
];

const clampPercent = (value) => {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, value));
};

const calcPercentChange = (current, previous) => {
  const currentSafe = Number(current) || 0;
  const previousSafe = Number(previous) || 0;
  if (previousSafe === 0) return currentSafe > 0 ? 100 : 0;
  return Math.round(((currentSafe - previousSafe) / previousSafe) * 100);
};

const toDateSafe = (value) => {
  if (!value) return null;
  if (value?.toDate && typeof value.toDate === 'function') return value.toDate();
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;

  if (typeof value === 'number') {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return null;

    if (/^\d+$/.test(trimmed)) {
      const numericDate = new Date(Number(trimmed));
      if (!Number.isNaN(numericDate.getTime())) return numericDate;
    }

    const parsed = new Date(trimmed);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  return null;
};

const toMillisSafe = (value) => toDateSafe(value)?.getTime() || null;

const getRecordDate = (record) => (
  toDateSafe(record?.timestamp)
  || toDateSafe(record?.createdAt)
  || toDateSafe(record?.updatedAt)
  || toDateSafe(record?.finishedAt)
  || toDateSafe(record?.concludedAt)
  || null
);

const getUserCreatedAt = (user) => (
  toDateSafe(user?.createdAt)
  || toDateSafe(user?.criadoEm)
  || toDateSafe(user?.creationTime)
  || toDateSafe(user?.metadata?.creationTime)
  || null
);

const matchesSearch = (value, search) => {
  if (!search) return true;
  return String(value || '').toLowerCase().includes(search.toLowerCase());
};

const deriveUserProfile = (user) => {
  const raw = user?.perfil || user?.role || user?.userType || user?.tipoPerfil || user?.tipo || user?.cargo || null;
  return String(raw || 'Nao informado').trim();
};

const deriveAccuracyBand = (record) => {
  const questions = Number(record?.questoesFeitas || 0);
  const correct = Number(record?.acertos || 0);
  if (questions <= 0) return 'Sem questoes';
  const accuracy = Math.round((correct / questions) * 100);
  if (accuracy <= 20) return '0-20%';
  if (accuracy <= 40) return '21-40%';
  if (accuracy <= 60) return '41-60%';
  if (accuracy <= 80) return '61-80%';
  return '81-100%';
};

const deriveContextType = (record) => {
  if (record?.cronogramaId && !record?.cicloId) return 'cronograma';
  if (record?.cicloId) return 'ciclo';
  return 'outros';
};

const applyGlobalFilters = (users, records, filters = {}) => {
  const userIdsFilter = Array.isArray(filters.userIds) && filters.userIds.length > 0
    ? new Set(filters.userIds)
    : null;
  const statusesFilter = Array.isArray(filters.statuses) && filters.statuses.length > 0
    ? new Set(filters.statuses)
    : null;
  const search = filters.search || '';
  const createdFromMs = toMillisSafe(filters.createdFrom);
  const createdToMs = toMillisSafe(filters.createdTo);
  const recordFromMs = toMillisSafe(filters.recordFrom);
  const recordToMs = toMillisSafe(filters.recordTo);
  const contextType = filters.contextType || 'all';
  const userProfile = filters.userProfile || 'all';
  const templateId = filters.templateId || 'all';
  const accuracyBand = filters.accuracyBand || 'all';

  const filteredUsers = users.filter((user) => {
    if (userIdsFilter && !userIdsFilter.has(user.id)) return false;
    if (!matchesSearch(user.name, search) && !matchesSearch(user.email, search)) return false;

    const createdAtMs = toMillisSafe(getUserCreatedAt(user));
    if (createdFromMs && (!createdAtMs || createdAtMs < createdFromMs)) return false;
    if (createdToMs && (!createdAtMs || createdAtMs > createdToMs)) return false;

    if (statusesFilter && user.status && !statusesFilter.has(user.status)) return false;
    if (userProfile !== 'all' && deriveUserProfile(user) !== userProfile) return false;

    return true;
  });

  const allowedUserIds = new Set(filteredUsers.map((user) => user.id));

  const filteredRecords = records.filter((record) => {
    if (!allowedUserIds.has(record.uid)) return false;

    const recordMs = toMillisSafe(getRecordDate(record));
    if (recordFromMs && (!recordMs || recordMs < recordFromMs)) return false;
    if (recordToMs && (!recordMs || recordMs > recordToMs)) return false;
    if (contextType !== 'all' && deriveContextType(record) !== contextType) return false;
    if (templateId !== 'all' && String(record.templateId || record.editalId || 'manual') !== templateId) return false;
    if (accuracyBand !== 'all' && deriveAccuracyBand(record) !== accuracyBand) return false;

    return true;
  });

  return { filteredUsers, filteredRecords };
};

const isWithinPeriod = (date, nowMs, durationMs) => {
  const dateMs = toMillisSafe(date);
  if (!dateMs) return false;
  return nowMs - dateMs <= durationMs;
};

const isWithinRange = (date, startMs, endMs) => {
  const dateMs = toMillisSafe(date);
  if (!dateMs) return false;
  return dateMs >= startMs && dateMs < endMs;
};

const getDayKey = (date) => {
  const safeDate = toDateSafe(date);
  if (!safeDate) return null;
  return `${safeDate.getFullYear()}-${String(safeDate.getMonth() + 1).padStart(2, '0')}-${String(safeDate.getDate()).padStart(2, '0')}`;
};

const buildDailyDataset = (users, records, now, days = 30) => {
  const nowDate = toDateSafe(now) || new Date();
  const byDay = new Map();
  const orderedDays = [];

  for (let offset = days - 1; offset >= 0; offset -= 1) {
    const day = new Date(nowDate);
    day.setHours(0, 0, 0, 0);
    day.setDate(day.getDate() - offset);
    const key = getDayKey(day);
    const label = day.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
    orderedDays.push({ key, label });
    byDay.set(key, {
      key,
      label,
      newUsers: 0,
      activeUsers: 0,
      studyMinutes: 0,
      questions: 0,
      activeUserIds: new Set(),
    });
  }

  users.forEach((user) => {
    const key = getDayKey(getUserCreatedAt(user));
    if (key && byDay.has(key)) byDay.get(key).newUsers += 1;
  });

  records.forEach((record) => {
    const key = getDayKey(getRecordDate(record));
    if (!key || !byDay.has(key)) return;
    const bucket = byDay.get(key);
    bucket.studyMinutes += Number(record.tempoEstudadoMinutos || record.duracaoMinutos || 0);
    bucket.questions += Number(record.questoesFeitas || 0);
    if (record.uid) bucket.activeUserIds.add(record.uid);
  });

  return orderedDays.map(({ key, label }) => {
    const bucket = byDay.get(key);
    return {
      key,
      label,
      newUsers: bucket.newUsers,
      activeUsers: bucket.activeUserIds.size,
      studyMinutes: bucket.studyMinutes,
      questions: bucket.questions,
    };
  });
};

const startOfDay = (date) => {
  const safeDate = toDateSafe(date) || new Date();
  const next = new Date(safeDate);
  next.setHours(0, 0, 0, 0);
  return next;
};

const startOfWeek = (date) => {
  const safeDate = startOfDay(date);
  const day = safeDate.getDay();
  const diff = (day + 6) % 7;
  safeDate.setDate(safeDate.getDate() - diff);
  return safeDate;
};

const formatWeekLabel = (date) => {
  const safeDate = startOfWeek(date);
  const dd = String(safeDate.getDate()).padStart(2, '0');
  const mm = String(safeDate.getMonth() + 1).padStart(2, '0');
  return `${dd}/${mm}`;
};

const buildActivationFunnel = ({ users, firstStudyByUid, activeUserIds7d, activeUserIds30d, nowMs }) => {
  const currentMonthStart = nowMs - (30 * DAY_MS);
  const recentUsers = users.filter((user) => isWithinRange(getUserCreatedAt(user), currentMonthStart, nowMs));
  const activated24h = recentUsers.filter((user) => {
    const createdAtMs = toMillisSafe(getUserCreatedAt(user));
    const firstStudyMs = toMillisSafe(firstStudyByUid.get(user.id));
    return createdAtMs && firstStudyMs && firstStudyMs >= createdAtMs && (firstStudyMs - createdAtMs) <= DAY_MS;
  });
  const active7d = recentUsers.filter((user) => activeUserIds7d.has(user.id));
  const active30d = recentUsers.filter((user) => activeUserIds30d.has(user.id));
  const base = recentUsers.length || 1;

  return [
    { stage: 'Novos 30d', value: recentUsers.length, rate: 100 },
    { stage: 'Ativados 24h', value: activated24h.length, rate: Math.round((activated24h.length / base) * 100) },
    { stage: 'Ativos 7d', value: active7d.length, rate: Math.round((active7d.length / base) * 100) },
    { stage: 'Ativos 30d', value: active30d.length, rate: Math.round((active30d.length / base) * 100) },
  ];
};

const buildRetentionCohort = ({ users, records, now }) => {
  const nowDate = startOfWeek(now);
  const userActivityWeeks = new Map();

  records.forEach((record) => {
    if (!record.uid) return;
    const recordDate = getRecordDate(record);
    if (!recordDate) return;
    const weekKey = startOfWeek(recordDate).toISOString();
    if (!userActivityWeeks.has(record.uid)) userActivityWeeks.set(record.uid, new Set());
    userActivityWeeks.get(record.uid).add(weekKey);
  });

  const cohortsByWeek = [];
  for (let offset = 7; offset >= 0; offset -= 1) {
    const weekStart = new Date(nowDate);
    weekStart.setDate(weekStart.getDate() - (offset * 7));
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 7);

    const cohortUsers = users.filter((user) => {
      const createdAt = getUserCreatedAt(user);
      const createdMs = toMillisSafe(createdAt);
      return createdMs && createdMs >= weekStart.getTime() && createdMs < weekEnd.getTime();
    });

    if (!cohortUsers.length) continue;

    const weekKey = weekStart.toISOString();
    const row = {
      cohort: formatWeekLabel(weekStart),
      cohortSize: cohortUsers.length,
      w0: 0,
      w1: 0,
      w2: 0,
      w4: 0,
    };

    const checkpoints = [0, 1, 2, 4];
    checkpoints.forEach((checkpoint) => {
      const target = new Date(weekStart);
      target.setDate(target.getDate() + (checkpoint * 7));
      const targetKey = startOfWeek(target).toISOString();
      const retained = cohortUsers.filter((user) => userActivityWeeks.get(user.id)?.has(targetKey)).length;
      row[`w${checkpoint}`] = Math.round((retained / cohortUsers.length) * 100);
    });

    row._weekKey = weekKey;
    cohortsByWeek.push(row);
  }

  return cohortsByWeek;
};

const buildActivityHeatmap = (records) => {
  const dayLabels = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab', 'Dom'];
  const cellMap = new Map();

  dayLabels.forEach((dayLabel, dayIndex) => {
    for (let hour = 0; hour < 24; hour += 1) {
      const key = `${dayIndex}-${hour}`;
      cellMap.set(key, {
        dayLabel,
        dayIndex,
        hour,
        label: `${dayLabel} ${String(hour).padStart(2, '0')}h`,
        value: 0,
        minutes: 0,
      });
    }
  });

  records.forEach((record) => {
    const recordDate = getRecordDate(record);
    if (!recordDate) return;
    const dayIndex = (recordDate.getDay() + 6) % 7;
    const hour = recordDate.getHours();
    const key = `${dayIndex}-${hour}`;
    const cell = cellMap.get(key);
    if (!cell) return;
    cell.value += 1;
    cell.minutes += Number(record.tempoEstudadoMinutos || record.duracaoMinutos || 0);
  });

  const cells = Array.from(cellMap.values());
  const maxValue = Math.max(...cells.map((cell) => cell.value), 0);

  return cells.map((cell) => ({
    ...cell,
    intensity: maxValue > 0 ? Math.round((cell.value / maxValue) * 100) : 0,
  }));
};

const buildDisciplineDistribution = (records) => {
  const map = new Map();

  records.forEach((record) => {
    const name = record.disciplinaNome || record.disciplina || 'Nao informado';
    if (!map.has(name)) {
      map.set(name, {
        disciplina: name,
        minutes: 0,
        questions: 0,
        records: 0,
      });
    }

    const entry = map.get(name);
    entry.minutes += Number(record.tempoEstudadoMinutos || record.duracaoMinutos || 0);
    entry.questions += Number(record.questoesFeitas || 0);
    entry.records += 1;
  });

  return Array.from(map.values())
    .sort((a, b) => b.minutes - a.minutes)
    .slice(0, 8)
    .map((entry) => ({
      ...entry,
      hours: Number((entry.minutes / 60).toFixed(1)),
    }));
};

const buildAccuracyDistribution = (records) => {
  const buckets = [
    { range: '0-20%', min: 0, max: 20, count: 0 },
    { range: '21-40%', min: 21, max: 40, count: 0 },
    { range: '41-60%', min: 41, max: 60, count: 0 },
    { range: '61-80%', min: 61, max: 80, count: 0 },
    { range: '81-100%', min: 81, max: 100, count: 0 },
  ];

  records.forEach((record) => {
    const questions = Number(record.questoesFeitas || 0);
    const correct = Number(record.acertos || 0);
    if (questions <= 0) return;
    const accuracy = Math.round((correct / questions) * 100);
    const bucket = buckets.find((item) => accuracy >= item.min && accuracy <= item.max);
    if (bucket) bucket.count += 1;
  });

  return buckets;
};

export const useAdminAnalytics = ({
  filters = {},
  rankingMetric = 'hours',
  rankingLimit = 10,
  selectedFeedUid = 'all',
} = {}) => {
  const [users, setUsers] = useState([]);
  const [studyRecords, setStudyRecords] = useState([]);
  const [activeSessions, setActiveSessions] = useState([]);
  const [cicloNameByKey, setCicloNameByKey] = useState(new Map());
  const [cicloMetaByUserCycle, setCicloMetaByUserCycle] = useState(new Map());
  const [cronogramaMetaByUserCronograma, setCronogramaMetaByUserCronograma] = useState(new Map());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(collection(db, 'users'), orderBy('createdAt', 'desc'));
    return onSnapshot(q, (snap) => {
      setUsers(
        snap.docs.map((docSnap) => ({
          id: docSnap.id,
          ...docSnap.data(),
          createdAt: getUserCreatedAt(docSnap.data()) || new Date(),
        })),
      );
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    const q = query(collectionGroup(db, 'registrosEstudo'), orderBy('timestamp', 'desc'), limit(1000));
    return onSnapshot(q, (snap) => {
      setStudyRecords(
        snap.docs.map((docSnap) => {
          const data = docSnap.data();
          return {
            id: docSnap.id,
            uid: data.uid || docSnap.ref.path.split('/')[1],
            ...data,
            timestamp: getRecordDate(data) || new Date(),
          };
        }),
      );
    });
  }, []);

  useEffect(() => {
    const q = query(collection(db, 'active_timers'), orderBy('updatedAt', 'desc'), limit(160));
    return onSnapshot(q, (snap) => {
      const nowAt = Date.now();
      const nowPerf = (typeof performance !== 'undefined' && performance.now) ? performance.now() : null;

      setActiveSessions(
        snap.docs.map((docSnap) => {
          const data = docSnap.data();
          return {
            id: docSnap.id,
            uid: data.uid || docSnap.id,
            ...data,
            updatedAt: toDateSafe(data.updatedAt) || new Date(),
            displaySecondsSnapshot: Number(data.displaySecondsSnapshot ?? data.seconds ?? 0),
            _receivedAt: nowAt,
            _receivedPerf: typeof nowPerf === 'number' ? nowPerf : undefined,
          };
        }),
      );
    });
  }, []);

  useEffect(() => {
    const q = query(collectionGroup(db, 'ciclos'), limit(800));
    return onSnapshot(q, (snap) => {
      const next = new Map();
      const meta = new Map();
      snap.docs.forEach((docSnap) => {
        const parts = docSnap.ref.path.split('/');
        const data = docSnap.data();
        if (parts[1] && parts[3] && (data.nome || data.titulo)) {
          next.set(`${parts[1]}_${parts[3]}`, data.nome || data.titulo);
          meta.set(`${parts[1]}_${parts[3]}`, {
            id: parts[3],
            uid: parts[1],
            nome: data.nome || data.titulo || 'Ciclo',
            templateId: data.templateId || data.editalId || 'manual',
            editalId: data.editalId || data.templateId || 'manual',
            cicloTipo: data.editalId || data.templateId ? 'Edital Base' : 'Ciclo Manual',
          });
        }
      });
      setCicloNameByKey(next);
      setCicloMetaByUserCycle(meta);
    });
  }, []);

  useEffect(() => {
    const q = query(collectionGroup(db, 'cronogramas'), limit(800));
    return onSnapshot(q, (snap) => {
      const meta = new Map();
      snap.docs.forEach((docSnap) => {
        const parts = docSnap.ref.path.split('/');
        const data = docSnap.data();
        if (parts[1] && parts[3]) {
          meta.set(`${parts[1]}_${parts[3]}`, {
            id: parts[3],
            uid: parts[1],
            nome: data.nome || data.titulo || 'Cronograma',
            templateId: data.templateId || data.editalId || 'manual',
            editalId: data.editalId || data.templateId || 'manual',
          });
        }
      });
      setCronogramaMetaByUserCronograma(meta);
    });
  }, []);

  const analyticsState = useMemo(() => {
    const now = new Date();
    const nowMs = now.getTime();
    const enrichedRawRecords = studyRecords.map((record) => {
      const cicloMeta = record.uid && record.cicloId ? cicloMetaByUserCycle.get(`${record.uid}_${record.cicloId}`) : null;
      const cronogramaMeta = record.uid && record.cronogramaId ? cronogramaMetaByUserCronograma.get(`${record.uid}_${record.cronogramaId}`) : null;

      return {
        ...record,
        contextoRegistro: record.contextoRegistro || deriveContextType(record),
        templateId: record.templateId || record.editalId || cicloMeta?.templateId || cronogramaMeta?.templateId || null,
        editalId: record.editalId || record.templateId || cicloMeta?.editalId || cronogramaMeta?.editalId || null,
        cicloTipo: record.cicloTipo || cicloMeta?.cicloTipo || null,
        cicloNome: record.cicloNome || cicloMeta?.nome || record.cicloNome || null,
        cronogramaNome: record.cronogramaNome || cronogramaMeta?.nome || null,
        accuracyBand: deriveAccuracyBand(record),
      };
    });

    const { filteredUsers, filteredRecords } = applyGlobalFilters(users, enrichedRawRecords, filters);

    const statsByUid = new Map();
    const activeUsersByPeriod = new Map(PERIODS.map((period) => [period.key, new Set()]));
    const newUsersByPeriod = Object.fromEntries(PERIODS.map((period) => [period.key, 0]));
    const studyTimeByPeriod = Object.fromEntries(PERIODS.map((period) => [period.key, 0]));
    const questionsByPeriod = Object.fromEntries(PERIODS.map((period) => [period.key, 0]));
    const firstStudyByUid = new Map();

    filteredUsers.forEach((user) => {
      const createdAt = getUserCreatedAt(user);
      PERIODS.forEach((period) => {
        if (isWithinPeriod(createdAt, nowMs, period.durationMs)) {
          newUsersByPeriod[period.key] += 1;
        }
      });
    });

    filteredRecords.forEach((record) => {
      if (!record.uid) return;

      const recordDate = getRecordDate(record);
      const current = statsByUid.get(record.uid) || {
        minutes: 0,
        questions: 0,
        correct: 0,
        lastStudy: null,
        recordsCount: 0,
      };

      const minutes = Number(record.tempoEstudadoMinutos || record.duracaoMinutos || 0);
      const questions = Number(record.questoesFeitas || 0);
      const correct = Number(record.acertos || 0);

      current.minutes += minutes;
      current.questions += questions;
      current.correct += correct;
      current.recordsCount += 1;

      if (recordDate && (!current.lastStudy || recordDate > current.lastStudy)) {
        current.lastStudy = recordDate;
      }

      if (recordDate && (!firstStudyByUid.has(record.uid) || recordDate < firstStudyByUid.get(record.uid))) {
        firstStudyByUid.set(record.uid, recordDate);
      }

      statsByUid.set(record.uid, current);

      PERIODS.forEach((period) => {
        if (isWithinPeriod(recordDate, nowMs, period.durationMs)) {
          activeUsersByPeriod.get(period.key).add(record.uid);
          studyTimeByPeriod[period.key] += minutes;
          questionsByPeriod[period.key] += questions;
        }
      });
    });

    const enrichedUsers = filteredUsers
      .map((user) => {
        const stats = statsByUid.get(user.id) || {
          minutes: 0,
          questions: 0,
          correct: 0,
          lastStudy: null,
          recordsCount: 0,
        };

        let status = 'inactive';
        if (stats.lastStudy && nowMs - stats.lastStudy.getTime() < 7 * DAY_MS) status = 'active';
        else if (stats.lastStudy) status = 'churn_risk';

        return {
          ...user,
          createdAt: getUserCreatedAt(user) || user.createdAt || new Date(),
          lastStudy: stats.lastStudy,
          status,
          totalHours: Math.round(stats.minutes / 60),
          totalMinutes: stats.minutes,
          totalQuestions: stats.questions,
          totalCorrect: stats.correct,
          accuracy: stats.questions > 0 ? Math.round((stats.correct / stats.questions) * 100) : 0,
          recordsCount: stats.recordsCount,
        };
      })
      .sort((a, b) => (toMillisSafe(b.lastStudy) || 0) - (toMillisSafe(a.lastStudy) || 0));

    const rankingList = [...enrichedUsers]
      .sort((a, b) => (
        rankingMetric === 'hours'
          ? b.totalHours - a.totalHours
          : b.totalQuestions - a.totalQuestions
      ))
      .slice(0, rankingLimit);

    const feedList = selectedFeedUid === 'all'
      ? filteredRecords.slice(0, 60)
      : filteredRecords.filter((record) => record.uid === selectedFeedUid).slice(0, 200);

    const currentDayStart = nowMs - DAY_MS;
    const previousDayStart = nowMs - (2 * DAY_MS);
    const currentWeekStart = nowMs - (7 * DAY_MS);
    const previousWeekStart = nowMs - (14 * DAY_MS);
    const currentMonthStart = nowMs - (30 * DAY_MS);
    const previousMonthStart = nowMs - (60 * DAY_MS);

    const dauIds = new Set();
    const wauIds = new Set();
    const mauIds = new Set();
    const previousDauIds = new Set();
    const previousWauIds = new Set();
    const previousMauIds = new Set();

    filteredRecords.forEach((record) => {
      const recordDate = getRecordDate(record);
      if (!record.uid || !recordDate) return;

      if (isWithinRange(recordDate, currentDayStart, nowMs)) dauIds.add(record.uid);
      if (isWithinRange(recordDate, currentWeekStart, nowMs)) wauIds.add(record.uid);
      if (isWithinRange(recordDate, currentMonthStart, nowMs)) mauIds.add(record.uid);
      if (isWithinRange(recordDate, previousDayStart, currentDayStart)) previousDauIds.add(record.uid);
      if (isWithinRange(recordDate, previousWeekStart, currentWeekStart)) previousWauIds.add(record.uid);
      if (isWithinRange(recordDate, previousMonthStart, currentMonthStart)) previousMauIds.add(record.uid);
    });

    const usersCreatedCurrentWeek = filteredUsers.filter((user) => isWithinRange(getUserCreatedAt(user), currentWeekStart, nowMs));
    const usersCreatedPreviousWeek = filteredUsers.filter((user) => isWithinRange(getUserCreatedAt(user), previousWeekStart, currentWeekStart));
    const usersCreatedCurrentMonth = filteredUsers.filter((user) => isWithinRange(getUserCreatedAt(user), currentMonthStart, nowMs));

    const activatedWithin24hCurrentWeek = usersCreatedCurrentWeek.filter((user) => {
      const createdAtMs = toMillisSafe(getUserCreatedAt(user));
      const firstStudyMs = toMillisSafe(firstStudyByUid.get(user.id));
      return createdAtMs && firstStudyMs && firstStudyMs >= createdAtMs && (firstStudyMs - createdAtMs) <= DAY_MS;
    });

    const activatedWithin24hPreviousWeek = usersCreatedPreviousWeek.filter((user) => {
      const createdAtMs = toMillisSafe(getUserCreatedAt(user));
      const firstStudyMs = toMillisSafe(firstStudyByUid.get(user.id));
      return createdAtMs && firstStudyMs && firstStudyMs >= createdAtMs && (firstStudyMs - createdAtMs) <= DAY_MS;
    });

    const currentActivationRate = usersCreatedCurrentWeek.length
      ? Math.round((activatedWithin24hCurrentWeek.length / usersCreatedCurrentWeek.length) * 100)
      : 0;
    const previousActivationRate = usersCreatedPreviousWeek.length
      ? Math.round((activatedWithin24hPreviousWeek.length / usersCreatedPreviousWeek.length) * 100)
      : 0;

    const riskUsers7d = [];
    const riskUsers14d = [];
    const riskUsers30d = [];
    const neverStartedUsers = [];

    enrichedUsers.forEach((user) => {
      const lastStudyMs = toMillisSafe(user.lastStudy);
      if (!lastStudyMs) {
        neverStartedUsers.push(user);
        return;
      }

      const daysInactive = (nowMs - lastStudyMs) / DAY_MS;
      if (daysInactive >= 30) riskUsers30d.push(user);
      else if (daysInactive >= 14) riskUsers14d.push(user);
      else if (daysInactive >= 7) riskUsers7d.push(user);
    });

    const dau = dauIds.size;
    const wau = wauIds.size;
    const mau = mauIds.size;
    const previousDau = previousDauIds.size;
    const previousWau = previousWauIds.size;
    const previousMau = previousMauIds.size;
    const stickiness = Math.round(clampPercent(mau > 0 ? (dau / mau) * 100 : 0));
    const previousStickiness = Math.round(clampPercent(previousMau > 0 ? (previousDau / previousMau) * 100 : 0));
    const totalUsers = filteredUsers.length;
    const previousUserBase = Math.max(totalUsers - usersCreatedCurrentMonth.length, 0);

    const risk = {
      activeCount: enrichedUsers.filter((user) => user.status === 'active').length,
      churnRiskCount: enrichedUsers.filter((user) => user.status === 'churn_risk').length,
      inactiveCount: enrichedUsers.filter((user) => user.status === 'inactive').length,
      neverStartedCount: enrichedUsers.filter((user) => !user.lastStudy).length,
      atRiskUsers: enrichedUsers.filter((user) => user.status !== 'active').slice(0, 12),
      buckets: {
        risk7d: riskUsers7d,
        risk14d: riskUsers14d,
        risk30d: riskUsers30d,
        neverStarted: neverStartedUsers,
      },
    };

    const executive = {
      totalUsers: {
        value: totalUsers,
        delta: calcPercentChange(totalUsers, previousUserBase),
        subtext: `${usersCreatedCurrentMonth.length} novos nos ultimos 30d`,
        userIds: filteredUsers.map((user) => user.id),
      },
      newUsers7d: {
        value: usersCreatedCurrentWeek.length,
        delta: calcPercentChange(usersCreatedCurrentWeek.length, usersCreatedPreviousWeek.length),
        subtext: `${usersCreatedPreviousWeek.length} na janela anterior`,
        userIds: usersCreatedCurrentWeek.map((user) => user.id),
      },
      dau: {
        value: dau,
        delta: calcPercentChange(dau, previousDau),
        subtext: `${previousDau} nas 24h anteriores`,
        userIds: [...dauIds],
      },
      wau: {
        value: wau,
        delta: calcPercentChange(wau, previousWau),
        subtext: `${previousWau} na semana anterior`,
        userIds: [...wauIds],
      },
      mau: {
        value: mau,
        delta: calcPercentChange(mau, previousMau),
        subtext: `${previousMau} nos 30d anteriores`,
        userIds: [...mauIds],
      },
      stickiness: {
        value: stickiness,
        delta: calcPercentChange(stickiness, previousStickiness),
        subtext: `${dau} DAU sobre ${mau} MAU`,
      },
      activation24h: {
        value: currentActivationRate,
        delta: calcPercentChange(currentActivationRate, previousActivationRate),
        subtext: `${activatedWithin24hCurrentWeek.length}/${usersCreatedCurrentWeek.length || 0} novos ativaram em 24h`,
        userIds: activatedWithin24hCurrentWeek.map((user) => user.id),
      },
      risk7d: {
        value: riskUsers7d.length,
        delta: 0,
        subtext: '7 a 13 dias sem estudar',
        userIds: riskUsers7d.map((user) => user.id),
      },
      risk14d: {
        value: riskUsers14d.length,
        delta: 0,
        subtext: '14 a 29 dias sem estudar',
        userIds: riskUsers14d.map((user) => user.id),
      },
      risk30d: {
        value: riskUsers30d.length,
        delta: 0,
        subtext: `${neverStartedUsers.length} sem ativacao inicial`,
        userIds: riskUsers30d.map((user) => user.id),
      },
    };

    const activationFunnel = buildActivationFunnel({
      users: filteredUsers,
      firstStudyByUid,
      activeUserIds7d: wauIds,
      activeUserIds30d: mauIds,
      nowMs,
    });

    const retentionCohort = buildRetentionCohort({
      users: filteredUsers,
      records: filteredRecords,
      now,
    });

    const activityHeatmap = buildActivityHeatmap(filteredRecords);
    const disciplineDistribution = buildDisciplineDistribution(filteredRecords);
    const accuracyDistribution = buildAccuracyDistribution(filteredRecords);

    const datasets = {
      overviewByPeriod: PERIODS.map((period) => ({
        period: period.label,
        newUsers: newUsersByPeriod[period.key],
        activeUsers: activeUsersByPeriod.get(period.key).size,
        studyMinutes: studyTimeByPeriod[period.key],
        questions: questionsByPeriod[period.key],
      })),
      daily30d: buildDailyDataset(filteredUsers, filteredRecords, now, Math.max(7, Number(filters.windowDays) || 30)),
      statusDistribution: [
        { status: 'Ativos', value: risk.activeCount },
        { status: 'Risco', value: risk.churnRiskCount },
        { status: 'Inativos', value: risk.inactiveCount },
      ],
      rankingPreview: rankingList.map((user, index) => ({
        rank: index + 1,
        uid: user.id,
        name: user.name,
        totalHours: user.totalHours,
        totalQuestions: user.totalQuestions,
        accuracy: user.accuracy,
      })),
      activationFunnel,
      retentionCohort,
      activityHeatmap,
      disciplineDistribution,
      accuracyDistribution,
    };

    const filterOptions = {
      userProfiles: Array.from(new Set(users.map((user) => deriveUserProfile(user)).filter(Boolean))).sort(),
      templateIds: Array.from(new Set(enrichedRawRecords.map((record) => String(record.templateId || record.editalId || 'manual')).filter(Boolean))).sort(),
      accuracyBands: ['0-20%', '21-40%', '41-60%', '61-80%', '81-100%', 'Sem questoes'],
      contextTypes: ['all', 'ciclo', 'cronograma'],
    };

    return {
      filteredUsers,
      filteredRecords,
      dashboardData: {
        totalUsers: filteredUsers.length,
        newUsers24h: newUsersByPeriod['24h'],
        newUsers7d: newUsersByPeriod['7d'],
        newUsers30d: newUsersByPeriod['30d'],
        active24h: activeUsersByPeriod.get('24h').size,
        active7d: activeUsersByPeriod.get('7d').size,
        active30d: activeUsersByPeriod.get('30d').size,
        studyTime24h: studyTimeByPeriod['24h'],
        studyTime7d: studyTimeByPeriod['7d'],
        studyTime30d: studyTimeByPeriod['30d'],
        questions24h: questionsByPeriod['24h'],
        questions7d: questionsByPeriod['7d'],
        questions30d: questionsByPeriod['30d'],
        enrichedUsers,
        summary: {
          users: {
            total: filteredUsers.length,
            new: newUsersByPeriod,
            active: Object.fromEntries(PERIODS.map((period) => [period.key, activeUsersByPeriod.get(period.key).size])),
          },
          study: {
            minutes: studyTimeByPeriod,
            questions: questionsByPeriod,
          },
        },
        risk,
        executive,
        datasets,
        filterOptions,
      },
      rankingList,
      feedList,
      risk,
      datasets,
      filterOptions,
    };
  }, [cicloMetaByUserCycle, cronogramaMetaByUserCronograma, filters, rankingLimit, rankingMetric, selectedFeedUid, studyRecords, users]);

  const activeSessionsFresh = useMemo(() => {
    const ttlMs = 2 * 60 * 1000;
    return activeSessions.filter((session) => (Date.now() - (toMillisSafe(session.updatedAt) || 0)) <= ttlMs);
  }, [activeSessions]);

  const studyingNowSessions = useMemo(() => {
    const rank = (session) => (!session.isPaused && session.phase !== 'rest' ? 0 : !session.isPaused ? 1 : 2);
    return [...activeSessionsFresh].sort((a, b) => rank(a) - rank(b));
  }, [activeSessionsFresh]);

  const getUser = (uid) => (
    analyticsState.filteredUsers.find((user) => user.id === uid)
    || users.find((user) => user.id === uid)
    || { id: uid, name: 'Usuário', email: '...', createdAt: new Date() }
  );

  return {
    loading,
    users: analyticsState.filteredUsers,
    rawUsers: users,
    studyRecords: analyticsState.filteredRecords,
    rawStudyRecords: studyRecords,
    activeSessions,
    activeSessionsFresh,
    studyingNowSessions,
    cicloNameByKey,
    getUser,
    dashboardData: analyticsState.dashboardData,
    rankingList: analyticsState.rankingList,
    feedList: analyticsState.feedList,
    filterOptions: analyticsState.filterOptions,
    analytics: {
      summary: analyticsState.dashboardData.summary,
      risk: analyticsState.risk,
      datasets: analyticsState.datasets,
    },
  };
};

export { deriveAccuracyBand, deriveContextType, deriveUserProfile, toDateSafe, toMillisSafe };
