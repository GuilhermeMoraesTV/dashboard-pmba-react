const DAY_MS = 24 * 60 * 60 * 1000;

const INVALID_STATUSES = new Set([
  'cancelado', 'cancelada', 'canceled', 'cancelled',
  'invalido', 'invalida', 'invalid',
  'planejado', 'planejada', 'planned', 'pendente',
  'deletado', 'deletada', 'deleted', 'excluido', 'excluida',
]);

const EXCLUDED_PLAN_STATUSES = new Set([
  'arquivado', 'arquivada', 'archived',
  'deletado', 'deletada', 'deleted', 'excluido', 'excluida',
]);

const numberFrom = (...values) => {
  const value = values.find((item) => item !== undefined && item !== null && item !== '');
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

export const toAdminDate = (value) => {
  if (!value) return null;
  if (typeof value?.toDate === 'function') return value.toDate();
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value === 'object' && Number.isFinite(value.seconds)) return new Date(value.seconds * 1000);
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

export const getAdminRecordDate = (record) => (
  toAdminDate(record?.timestamp)
  || toAdminDate(record?.createdAt)
  || toAdminDate(record?.finishedAt)
  || toAdminDate(record?.concludedAt)
  || toAdminDate(record?.updatedAt)
  || toAdminDate(record?.data)
  || null
);

export const normalizeStudyMinutes = (record) => {
  const explicitMinutes = numberFrom(
    record?.tempoEstudadoMinutos,
    record?.duracaoMinutos,
    record?.durationMinutes,
    record?.tempoMinutos,
    record?.minutes,
  );
  if (explicitMinutes > 0) return Math.round(explicitMinutes);

  const seconds = numberFrom(record?.duracaoSegundos, record?.durationSeconds, record?.seconds);
  return seconds > 0 ? Math.round(seconds / 60) : 0;
};

export const normalizeQuestions = (record) => Math.max(0, Math.round(numberFrom(
  record?.questoesFeitas,
  record?.totalQuestoes,
  record?.questions,
  record?.resumo?.totalQuestoes,
)));

export const normalizeCorrect = (record) => Math.max(0, Math.round(numberFrom(
  record?.acertos,
  record?.totalAcertos,
  record?.correct,
  record?.resumo?.totalAcertos,
)));

const normalizeStatus = (value) => String(value || '').trim().toLowerCase();

export const isExcludedPlan = (plan) => {
  if (!plan) return true;
  if (
    plan.arquivado === true
    || plan.archived === true
    || plan.deletado === true
    || plan.deleted === true
    || plan.excluido === true
    || plan.deletedAt
    || plan.excluidoEm
  ) return true;
  return EXCLUDED_PLAN_STATUSES.has(normalizeStatus(plan.status));
};

export const isCompletedAcademicRecord = (record) => {
  if (!record?.uid || !getAdminRecordDate(record)) return false;
  if (
    record.cancelado === true
    || record.cancelled === true
    || record.invalido === true
    || record.invalid === true
    || record.deletado === true
    || record.deleted === true
    || record.planejado === true
  ) return false;
  if (INVALID_STATUSES.has(normalizeStatus(record.status))) return false;
  return normalizeStudyMinutes(record) > 0 || normalizeQuestions(record) > 0;
};

export const getStudyContext = (record) => {
  if (record?.activityType === 'simulado' || record?.sourceType === 'simulado') return 'simulado';
  if (record?.cronogramaId && !record?.cicloId) return 'cronograma';
  if (record?.cicloId) return 'ciclo';
  return record?.contextoRegistro || record?.contextType || 'outros';
};

const recordIdentity = (record) => {
  if (record.path) return record.path;
  if (record.uid && record.id) return `${record.uid}:${record.sourceType || getStudyContext(record)}:${record.id}`;
  return [
    record.uid,
    getStudyContext(record),
    record.cicloId || record.cronogramaId || '',
    getAdminRecordDate(record)?.getTime() || '',
    record.disciplinaId || record.disciplinaNome || record.disciplina || '',
    normalizeStudyMinutes(record),
    normalizeQuestions(record),
  ].join(':');
};

export const prepareAdminActivities = ({
  studyRecords = [],
  simulations = [],
  cicloMetaByKey = new Map(),
  cronogramaMetaByKey = new Map(),
} = {}) => {
  const unique = new Map();

  studyRecords.forEach((record) => {
    if (!isCompletedAcademicRecord(record)) return;

    const context = getStudyContext(record);
    const cicloMeta = context === 'ciclo'
      ? cicloMetaByKey.get(`${record.uid}_${record.cicloId}`)
      : null;
    const cronogramaMeta = context === 'cronograma'
      ? cronogramaMetaByKey.get(`${record.uid}_${record.cronogramaId}`)
      : null;

    if (context === 'ciclo' && isExcludedPlan(cicloMeta)) return;
    if (context === 'cronograma' && isExcludedPlan(cronogramaMeta)) return;

    const questions = normalizeQuestions(record);
    const correct = Math.min(questions, normalizeCorrect(record));
    const plan = cicloMeta || cronogramaMeta;
    const activity = {
      ...record,
      activityType: record.isRevisao || record.revisao || normalizeStatus(record.tipoEstudo) === 'revisao'
        ? 'revisao'
        : questions > 0 && normalizeStudyMinutes(record) === 0 ? 'questoes' : 'estudo',
      sourceType: context,
      sourceName: record.cicloNome || record.cronogramaNome || plan?.nome || (context === 'ciclo' ? 'Ciclo' : 'Cronograma'),
      disciplinaNome: record.disciplinaNome || record.disciplina || 'Sem disciplina',
      timestamp: getAdminRecordDate(record),
      tempoEstudadoMinutos: normalizeStudyMinutes(record),
      questoesFeitas: questions,
      acertos: correct,
      erros: Math.max(0, questions - correct - numberFrom(record.brancos, record.totalBrancos)),
      templateId: record.templateId || record.editalId || plan?.templateId || plan?.editalId || 'manual',
      rankingEligible: context === 'ciclo' || context === 'cronograma',
    };
    unique.set(recordIdentity(activity), activity);
  });

  simulations.forEach((record) => {
    if (!isCompletedAcademicRecord({
      ...record,
      questoesFeitas: normalizeQuestions(record),
      tempoEstudadoMinutos: normalizeStudyMinutes(record),
    })) return;

    const questions = normalizeQuestions(record);
    const correct = Math.min(questions, normalizeCorrect(record));
    const activity = {
      ...record,
      activityType: 'simulado',
      sourceType: 'simulado',
      sourceName: record.titulo || 'Simulado',
      disciplinaNome: record.disciplinas?.length === 1 ? record.disciplinas[0].nome : 'Múltiplas disciplinas',
      assunto: record.banca || null,
      timestamp: getAdminRecordDate(record),
      tempoEstudadoMinutos: normalizeStudyMinutes(record),
      questoesFeitas: questions,
      acertos: correct,
      erros: Math.max(0, questions - correct - numberFrom(record.resumo?.totalBrancos)),
      rankingEligible: false,
    };
    unique.set(recordIdentity(activity), activity);
  });

  return [...unique.values()].sort((a, b) => (
    (getAdminRecordDate(b)?.getTime() || 0) - (getAdminRecordDate(a)?.getTime() || 0)
  ));
};

export const filterAdminActivities = (activities, filters = {}) => {
  const fromMs = toAdminDate(filters.recordFrom)?.getTime() || null;
  const toMs = toAdminDate(filters.recordTo)?.getTime() || null;
  return activities.filter((record) => {
    const recordMs = getAdminRecordDate(record)?.getTime() || 0;
    if (fromMs && recordMs < fromMs) return false;
    if (toMs && recordMs > toMs) return false;
    if (filters.contextType && filters.contextType !== 'all' && record.sourceType !== filters.contextType) return false;
    if (filters.templateId && filters.templateId !== 'all' && String(record.templateId || 'manual') !== filters.templateId) return false;
    if (filters.accuracyBand && filters.accuracyBand !== 'all') {
      const questions = normalizeQuestions(record);
      const accuracy = questions > 0 ? Math.round((normalizeCorrect(record) / questions) * 100) : null;
      const band = accuracy === null ? 'Sem questoes'
        : accuracy <= 20 ? '0-20%'
          : accuracy <= 40 ? '21-40%'
            : accuracy <= 60 ? '41-60%'
              : accuracy <= 80 ? '61-80%' : '81-100%';
      if (band !== filters.accuracyBand) return false;
    }
    return true;
  });
};

export const buildStudyRanking = (users, activities) => {
  const totals = new Map();
  activities.filter((item) => item.rankingEligible).forEach((record) => {
    const current = totals.get(record.uid) || { minutes: 0, questions: 0, correct: 0, records: 0 };
    current.minutes += normalizeStudyMinutes(record);
    current.questions += normalizeQuestions(record);
    current.correct += normalizeCorrect(record);
    current.records += 1;
    totals.set(record.uid, current);
  });

  const rows = users.map((user) => {
    const total = totals.get(user.id) || { minutes: 0, questions: 0, correct: 0, records: 0 };
    return {
      ...user,
      totalMinutes: total.minutes,
      totalHours: Number((total.minutes / 60).toFixed(1)),
      totalQuestions: total.questions,
      totalCorrect: total.correct,
      recordsCount: total.records,
    };
  });

  const tieBreak = (a, b) => String(a.name || a.email || a.id).localeCompare(String(b.name || b.email || b.id), 'pt-BR') || String(a.id).localeCompare(String(b.id));

  return {
    hours: [...rows].sort((a, b) => b.totalMinutes - a.totalMinutes || b.totalQuestions - a.totalQuestions || tieBreak(a, b)),
    questions: [...rows].sort((a, b) => b.totalQuestions - a.totalQuestions || b.totalMinutes - a.totalMinutes || tieBreak(a, b)),
  };
};

const dayKey = (date) => {
  const value = toAdminDate(date);
  if (!value) return null;
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;
};

export const buildAdminAnalyticsDatasets = (activities, now = new Date(), days = 30) => {
  const countDays = Math.max(7, Number(days) || 30);
  const buckets = new Map();
  const daily = [];
  const activeUserIds = new Set();
  let totalStudyMinutes = 0;
  let totalQuestions = 0;
  let totalCorrect = 0;
  let totalRecords = 0;

  for (let offset = countDays - 1; offset >= 0; offset -= 1) {
    const date = new Date(now);
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() - offset);
    const key = dayKey(date);
    const bucket = { key, label: date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }), activeUsers: 0, studyMinutes: 0, studyHours: 0, questions: 0, activeUserIds: new Set() };
    buckets.set(key, bucket);
    daily.push(bucket);
  }

  const contextMap = new Map([
    ['ciclo', { context: 'Ciclos', records: 0, minutes: 0, questions: 0 }],
    ['cronograma', { context: 'Cronogramas', records: 0, minutes: 0, questions: 0 }],
    ['simulado', { context: 'Simulados', records: 0, minutes: 0, questions: 0 }],
  ]);

  activities.forEach((record) => {
    const bucket = buckets.get(dayKey(getAdminRecordDate(record)));
    if (bucket) {
      const studyMinutes = normalizeStudyMinutes(record);
      const questions = normalizeQuestions(record);
      const correct = Math.min(questions, normalizeCorrect(record));
      bucket.studyMinutes += studyMinutes;
      bucket.questions += questions;
      if (record.uid) bucket.activeUserIds.add(record.uid);
      if (record.uid) activeUserIds.add(record.uid);
      totalStudyMinutes += studyMinutes;
      totalQuestions += questions;
      totalCorrect += correct;
      totalRecords += 1;
    }
    const context = contextMap.get(record.sourceType);
    if (context) {
      context.records += 1;
      context.minutes += normalizeStudyMinutes(record);
      context.questions += normalizeQuestions(record);
    }
  });

  const normalizedDaily = daily.map(({ activeUserIds, ...bucket }) => ({
    ...bucket,
    activeUsers: activeUserIds.size,
    studyHours: Number((bucket.studyMinutes / 60).toFixed(1)),
  }));

  return {
    summary: {
      activeUsers: activeUserIds.size,
      totalStudyMinutes,
      totalStudyHours: Number((totalStudyMinutes / 60).toFixed(1)),
      totalQuestions,
      totalCorrect,
      accuracy: totalQuestions > 0 ? Math.round((totalCorrect / totalQuestions) * 100) : 0,
      totalRecords,
    },
    daily: normalizedDaily,
    contextDistribution: [...contextMap.values()].map((item) => ({
      ...item,
      hours: Number((item.minutes / 60).toFixed(1)),
    })),
    timeVsQuestions: normalizedDaily.map((item) => ({
      day: item.label,
      hours: item.studyHours,
      questions: item.questions,
    })).filter((item) => item.hours > 0 || item.questions > 0),
  };
};

export { DAY_MS };
