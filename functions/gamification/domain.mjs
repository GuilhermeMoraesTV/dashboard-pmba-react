export const GAMIFICATION_RULE_VERSION = '3.0.0';
export const GAMIFICATION_TIME_ZONE = 'America/Bahia';

export const LEAGUES = Object.freeze([
  { id: 'iron', name: 'Ferro', index: 0, color: '#71717a', glow: '#a1a1aa', icon: 'shield' },
  { id: 'bronze', name: 'Bronze', index: 1, color: '#c86b32', glow: '#fb923c', icon: 'medal' },
  { id: 'silver', name: 'Prata', index: 2, color: '#a1a1aa', glow: '#e4e4e7', icon: 'medal' },
  { id: 'gold', name: 'Ouro', index: 3, color: '#d99a17', glow: '#fbbf24', icon: 'crown' },
  { id: 'platinum', name: 'Platina', index: 4, color: '#0d9488', glow: '#5eead4', icon: 'gem' },
  { id: 'emerald', name: 'Esmeralda', index: 5, color: '#059669', glow: '#34d399', icon: 'gem' },
  { id: 'diamond', name: 'Diamante', index: 6, color: '#0891b2', glow: '#67e8f9', icon: 'diamond' },
]);

export const LEVEL_XP_THRESHOLDS = Object.freeze([0, 150, 350, 600, 900, 1250, 1650, 2100, 2550, 3000]);

export const GAMIFICATION_CONFIG = Object.freeze({
  version: GAMIFICATION_RULE_VERSION,
  timeZone: GAMIFICATION_TIME_ZONE,
  academic: Object.freeze({
    registration: 5,
    minutesBlock: 10,
    xpPerMinutesBlock: 10,
    questionsBlock: 5,
    xpPerQuestionsBlock: 5,
    correctBlock: 5,
    xpPerCorrectBlock: 5,
    accuracyMinimumQuestions: 5,
    accuracyThreshold: 0.85,
    accuracyBonus: 15,
    dailyGoal: 30,
    review: 20,
    simulation: 25,
    cycleRound: 100,
    scheduleCompletion: 100,
  }),
  dailyLimits: Object.freeze({
    minutes: 12 * 60,
    questions: 500,
    correct: 500,
    registrations: 10,
    accuracyBonuses: 3,
    reviews: 5,
    simulations: 2,
  }),
  recurringRewards: Object.freeze({
    group: Object.freeze({ 1: 125, 2: 100, 3: 75 }),
    league: Object.freeze({ 1: 100, 2: 75, 3: 50 }),
    general: Object.freeze({ 1: 350, 2: 300, 3: 250, top10: 150 }),
    maxGroupPodiumsPerWeek: 2,
  }),
});

const n = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
};

const integer = (value) => Math.max(0, Math.floor(n(value)));
const boundedInteger = (value, maximum) => Math.min(integer(value), maximum);
const pad = (value) => String(value).padStart(2, '0');

export const toDateKey = (value = new Date()) => {
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const raw = value?.toDate ? value.toDate() : value;
  const date = raw instanceof Date ? raw : new Date(raw);
  if (Number.isNaN(date.getTime())) return null;
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: GAMIFICATION_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const get = (type) => parts.find((part) => part.type === type)?.value;
  return `${get('year')}-${get('month')}-${get('day')}`;
};

export const getWeekId = (value = new Date()) => {
  const dateKey = toDateKey(value);
  if (!dateKey) return null;
  const cursor = new Date(`${dateKey}T12:00:00Z`);
  const weekday = cursor.getUTCDay() || 7;
  cursor.setUTCDate(cursor.getUTCDate() - weekday + 1);
  return cursor.toISOString().slice(0, 10);
};

export const getMonthId = (value = new Date()) => {
  const dateKey = toDateKey(value);
  return dateKey ? dateKey.slice(0, 7) : null;
};

export const getNextWeekId = (weekId = getWeekId()) => {
  const cursor = new Date(`${weekId}T12:00:00Z`);
  cursor.setUTCDate(cursor.getUTCDate() + 7);
  return cursor.toISOString().slice(0, 10);
};

export const isCurrentWeek = (value, now = new Date()) => getWeekId(value) === getWeekId(now);

export const getXPForLevel = (level = 1) => {
  const safeLevel = Math.max(1, Math.floor(Number(level) || 1));
  if (safeLevel <= 10) return LEVEL_XP_THRESHOLDS[safeLevel - 1];
  const delta = safeLevel - 10;
  return 3000 + (250 * delta) + (25 * delta * delta);
};

export const getLevelFromXP = (totalXP = 0) => {
  const safeXP = integer(totalXP);
  if (safeXP < 3000) {
    let level = 1;
    LEVEL_XP_THRESHOLDS.forEach((threshold, index) => {
      if (safeXP >= threshold) level = index + 1;
    });
    return level;
  }
  const delta = Math.max(0, Math.floor((-250 + Math.sqrt((250 * 250) + (100 * (safeXP - 3000)))) / 50));
  let level = 10 + delta;
  while (safeXP >= getXPForLevel(level + 1)) level += 1;
  while (level > 1 && safeXP < getXPForLevel(level)) level -= 1;
  return level;
};

export const getLevelProgress = (totalXP = 0) => {
  const safeXP = integer(totalXP);
  const currentLevel = getLevelFromXP(safeXP);
  const levelStartXP = getXPForLevel(currentLevel);
  const nextLevelXP = getXPForLevel(currentLevel + 1);
  const currentXP = Math.max(0, safeXP - levelStartXP);
  const levelRange = Math.max(1, nextLevelXP - levelStartXP);
  return {
    currentLevel,
    currentXP,
    xpToNextLevel: Math.max(0, nextLevelXP - safeXP),
    progressPercent: Math.min(100, (currentXP / levelRange) * 100),
    totalXP: safeXP,
    levelStartXP,
    nextLevelXP,
    levelRing: '#dc2626',
  };
};

export const getLeague = (leagueId = 'iron') => (
  LEAGUES.find((league) => league.id === leagueId || league.name.toLowerCase() === String(leagueId).toLowerCase())
  || LEAGUES[0]
);

export const getLeagueMovement = (leagueId, direction = 0) => {
  const current = getLeague(leagueId);
  return LEAGUES[Math.max(0, Math.min(LEAGUES.length - 1, current.index + Number(direction || 0)))];
};

export const getPromotionRelegationCounts = (participants = 0, { merged = false } = {}) => {
  const count = integer(participants);
  if (merged && count >= 16 && count <= 19) return { promoted: 5, relegated: 4 };
  if (merged && count >= 11 && count <= 15) return { promoted: 4, relegated: 3 };
  if (count === 10) return { promoted: 3, relegated: 2 };
  if (!merged && count >= 6 && count <= 9) return { promoted: 2, relegated: 1 };
  return { promoted: 0, relegated: 0 };
};

export const getRankingZone = ({ position, participants, leagueId = 'iron', merged = false }) => {
  const { promoted, relegated } = getPromotionRelegationCounts(participants, { merged });
  if (promoted > 0 && getLeague(leagueId).index < LEAGUES.length - 1 && position <= promoted) return 'promotion';
  if (relegated > 0 && getLeague(leagueId).index > 0 && position > participants - relegated) return 'relegation';
  return 'neutral';
};

export const sortCompetitiveMembers = (members = []) => [...members].sort((a, b) => {
  const xpDiff = integer(b.competitiveXP ?? b.weeklyXP) - integer(a.competitiveXP ?? a.weeklyXP);
  if (xpDiff) return xpDiff;
  const reachedA = Number(a.finalXPReachedAtMillis ?? a.finalXPReachedAt?.toMillis?.() ?? a.finalXPReachedAt ?? Number.MAX_SAFE_INTEGER);
  const reachedB = Number(b.finalXPReachedAtMillis ?? b.finalXPReachedAt?.toMillis?.() ?? b.finalXPReachedAt ?? Number.MAX_SAFE_INTEGER);
  if (reachedA !== reachedB) return reachedA - reachedB;
  return String(a.uid || a.id || '').localeCompare(String(b.uid || b.id || ''));
});

export const sortRankingMembers = (members = []) => sortCompetitiveMembers(members);

export const RANKING_ACTIVITY_WINDOW_DAYS = 30;

export const getRankingAccuracy = (member = {}) => {
  const questions = integer(member.questions);
  if (!questions) return 0;
  const correct = Math.min(questions, integer(member.correct));
  return (correct / questions) * 100;
};

export const hasRecentRankingActivity = ({ lastStudyAtMillis = 0, now = new Date(), windowDays = RANKING_ACTIVITY_WINDOW_DAYS } = {}) => {
  const nowMillis = now instanceof Date ? now.getTime() : Number(now);
  const activityMillis = Number(lastStudyAtMillis || 0);
  const cutoffMillis = nowMillis - Math.max(1, integer(windowDays)) * 24 * 60 * 60 * 1000;
  return activityMillis > 0 && activityMillis <= nowMillis && activityMillis >= cutoffMillis;
};

export const sortGeneralRankingMembers = (members = [], metric = 'questions') => {
  const selectedMetric = metric === 'minutes' ? 'minutes' : 'questions';
  const secondaryMetric = selectedMetric === 'questions' ? 'minutes' : 'questions';
  return [...members].sort((a, b) => {
    const primaryDiff = integer(b[selectedMetric]) - integer(a[selectedMetric]);
    if (primaryDiff) return primaryDiff;
    const secondaryDiff = integer(b[secondaryMetric]) - integer(a[secondaryMetric]);
    if (secondaryDiff) return secondaryDiff;
    const correctDiff = integer(b.correct) - integer(a.correct);
    if (correctDiff) return correctDiff;
    return String(a.uid || a.id || '').localeCompare(String(b.uid || b.id || ''));
  });
};

export const sortGroupsRanking = (groups = [], metric = 'xp') => [...groups].sort((a, b) => {
  const selectedMetric = metric === 'minutes' ? 'weeklyMinutes' : metric === 'questions' ? 'weeklyQuestions' : 'weeklyXP';
  const metricDiff = integer(b[selectedMetric] ?? b.competitiveXP) - integer(a[selectedMetric] ?? a.competitiveXP);
  if (metricDiff) return metricDiff;
  const xpDiff = integer(b.competitiveXP ?? b.weeklyXP) - integer(a.competitiveXP ?? a.weeklyXP);
  if (xpDiff) return xpDiff;
  return String(a.name || a.id || '').localeCompare(String(b.name || b.id || ''), 'pt-BR');
});

export const isValidGamificationRecord = (record = {}) => {
  const status = String(record.status || record.situacao || '').toLowerCase();
  return !record.deletedAt
    && !record.excluido
    && !record.cancelado
    && !['cancelado', 'cancelled', 'planejado', 'planned', 'invalido', 'invalid'].includes(status);
};

export const getStudyMetrics = (record = {}) => ({
  minutes: boundedInteger(record.tempoEstudadoMinutos ?? record.duracaoMinutos ?? record.minutes, GAMIFICATION_CONFIG.dailyLimits.minutes),
  questions: boundedInteger(record.questoesFeitas ?? record.totalQuestoes ?? record.questions, GAMIFICATION_CONFIG.dailyLimits.questions),
  correct: Math.min(
    boundedInteger(record.questoesFeitas ?? record.totalQuestoes ?? record.questions, GAMIFICATION_CONFIG.dailyLimits.questions),
    boundedInteger(record.acertos ?? record.questoesAcertadas ?? record.correct, GAMIFICATION_CONFIG.dailyLimits.correct),
  ),
  date: record.data || record.date || record.timestamp || record.createdAt,
});

export const getSimuladoMetrics = (simulado = {}) => ({
  minutes: boundedInteger(simulado.durationMinutes ?? simulado.duracaoMinutos ?? simulado.tempoEstudadoMinutos, GAMIFICATION_CONFIG.dailyLimits.minutes),
  questions: boundedInteger(simulado.resumo?.totalQuestoes ?? simulado.totalQuestoes ?? simulado.questoesFeitas, GAMIFICATION_CONFIG.dailyLimits.questions),
  correct: Math.min(
    boundedInteger(simulado.resumo?.totalQuestoes ?? simulado.totalQuestoes ?? simulado.questoesFeitas, GAMIFICATION_CONFIG.dailyLimits.questions),
    boundedInteger(simulado.resumo?.totalAcertos ?? simulado.totalAcertos ?? simulado.acertos, GAMIFICATION_CONFIG.dailyLimits.correct),
  ),
  date: simulado.data || simulado.date || simulado.timestamp || simulado.createdAt,
});

export const isReviewRecord = (record = {}) => Boolean(
  record.isRevisao
  || record.revisao
  || String(record.tipoEstudo || '').toLowerCase() === 'revisao'
  || String(record.tipoRegistro || '').toLowerCase() === 'revisao'
);

export const calculateActivityXP = ({ minutes = 0, questions = 0, correct = 0, includeRegistration = true, isReview = false, isSimulation = false } = {}) => {
  const safeQuestions = integer(questions);
  const safeCorrect = Math.min(safeQuestions, integer(correct));
  const breakdown = {
    registration: includeRegistration ? GAMIFICATION_CONFIG.academic.registration : 0,
    time: Math.floor(integer(minutes) / GAMIFICATION_CONFIG.academic.minutesBlock) * GAMIFICATION_CONFIG.academic.xpPerMinutesBlock,
    questions: Math.floor(safeQuestions / GAMIFICATION_CONFIG.academic.questionsBlock) * GAMIFICATION_CONFIG.academic.xpPerQuestionsBlock,
    correct: Math.floor(safeCorrect / GAMIFICATION_CONFIG.academic.correctBlock) * GAMIFICATION_CONFIG.academic.xpPerCorrectBlock,
    accuracy: safeQuestions >= GAMIFICATION_CONFIG.academic.accuracyMinimumQuestions && safeCorrect / safeQuestions >= GAMIFICATION_CONFIG.academic.accuracyThreshold
      ? GAMIFICATION_CONFIG.academic.accuracyBonus
      : 0,
    review: isReview ? GAMIFICATION_CONFIG.academic.review : 0,
    simulation: isSimulation ? GAMIFICATION_CONFIG.academic.simulation : 0,
  };
  return Object.values(breakdown).reduce((sum, value) => sum + value, 0);
};

const sourceMillis = (source = {}) => {
  const raw = source.timestamp || source.updatedAt || source.createdAt || source.data || source.date;
  if (raw?.toMillis) return raw.toMillis();
  if (raw?.toDate) return raw.toDate().getTime();
  if (typeof raw === 'number') return raw;
  const date = /^\d{4}-\d{2}-\d{2}$/.test(String(raw || '')) ? new Date(`${raw}T12:00:00-03:00`) : new Date(raw || 0);
  return Number.isNaN(date.getTime()) ? 0 : date.getTime();
};

const sumRankingMetrics = (sources) => {
  const daily = new Map();
  sources.forEach((source) => {
    const dateKey = toDateKey(source.metrics.date || source.millis);
    if (!dateKey) return;
    const current = daily.get(dateKey) || { minutes: 0, questions: 0, correct: 0 };
    const nextMinutes = Math.min(GAMIFICATION_CONFIG.dailyLimits.minutes, current.minutes + source.metrics.minutes);
    const nextQuestions = Math.min(GAMIFICATION_CONFIG.dailyLimits.questions, current.questions + source.metrics.questions);
    const nextCorrect = Math.min(
      nextQuestions,
      GAMIFICATION_CONFIG.dailyLimits.correct,
      current.correct + source.metrics.correct,
    );
    daily.set(dateKey, { minutes: nextMinutes, questions: nextQuestions, correct: nextCorrect });
  });
  return [...daily.values()].reduce((sum, metrics) => ({
    minutes: sum.minutes + metrics.minutes,
    questions: sum.questions + metrics.questions,
    correct: sum.correct + metrics.correct,
  }), { minutes: 0, questions: 0, correct: 0 });
};

export const calculateRankingPeriodMetrics = ({ records = [], simulations = [], now = new Date() } = {}) => {
  const nowMillis = now instanceof Date ? now.getTime() : Number(now);
  const weekId = getWeekId(new Date(nowMillis));
  const monthId = getMonthId(new Date(nowMillis));
  const sources = [
    ...records.filter(isValidGamificationRecord).map((data) => ({ metrics: getStudyMetrics(data), millis: sourceMillis(data) })),
    ...simulations.filter(isValidGamificationRecord).map((data) => ({ metrics: getSimuladoMetrics(data), millis: sourceMillis(data) })),
  ]
    .filter((source) => source.millis > 0 && source.millis <= nowMillis);
  const weeklySources = sources.filter((source) => getWeekId(new Date(source.millis)) === weekId);
  const monthlySources = sources.filter((source) => getMonthId(new Date(source.millis)) === monthId);
  return {
    lastStudyAtMillis: Math.max(0, ...sources.map((source) => source.millis)),
    weekly: { ...sumRankingMetrics(weeklySources), hasActivity: weeklySources.length > 0, weekId },
    monthly: { ...sumRankingMetrics(monthlySources), hasActivity: monthlySources.length > 0, monthId },
    lifetime: { ...sumRankingMetrics(sources), hasActivity: sources.length > 0 },
  };
};

const xpDeltaForBlocks = (before, after, block, xpPerBlock) => (
  (Math.floor(after / block) - Math.floor(before / block)) * xpPerBlock
);

export const buildAcademicXPEvents = ({ records = [], simulations = [], goals = [] } = {}) => {
  const sources = [
    ...records.filter(isValidGamificationRecord).map((data, index) => ({
      kind: 'study',
      id: String(data.id || data.sourceId || index),
      data,
      metrics: getStudyMetrics(data),
      millis: sourceMillis(data),
    })),
    ...simulations.filter(isValidGamificationRecord).map((data, index) => ({
      kind: 'simulation',
      id: String(data.id || data.sourceId || index),
      data,
      metrics: getSimuladoMetrics(data),
      millis: sourceMillis(data),
    })),
  ].filter((source) => toDateKey(source.metrics.date || source.data.data || source.millis));

  sources.sort((a, b) => a.millis - b.millis || a.kind.localeCompare(b.kind) || a.id.localeCompare(b.id));
  const daily = new Map();
  const events = [];

  sources.forEach((source) => {
    const dateKey = toDateKey(source.metrics.date || source.millis);
    const state = daily.get(dateKey) || { minutes: 0, questions: 0, correct: 0, registrations: 0, accuracyBonuses: 0, reviews: 0, simulations: 0 };
    const metrics = source.metrics;
    const beforeMinutes = Math.min(state.minutes, GAMIFICATION_CONFIG.dailyLimits.minutes);
    const afterMinutes = Math.min(state.minutes + metrics.minutes, GAMIFICATION_CONFIG.dailyLimits.minutes);
    const beforeQuestions = Math.min(state.questions, GAMIFICATION_CONFIG.dailyLimits.questions);
    const afterQuestions = Math.min(state.questions + metrics.questions, GAMIFICATION_CONFIG.dailyLimits.questions);
    const beforeCorrect = Math.min(state.correct, GAMIFICATION_CONFIG.dailyLimits.correct);
    const afterCorrect = Math.min(state.correct + metrics.correct, GAMIFICATION_CONFIG.dailyLimits.correct);
    const qualifiesAccuracy = metrics.questions >= GAMIFICATION_CONFIG.academic.accuracyMinimumQuestions
      && metrics.correct / metrics.questions >= GAMIFICATION_CONFIG.academic.accuracyThreshold;
    const review = source.kind === 'study' && isReviewRecord(source.data);

    const breakdown = {
      registration: source.kind === 'study' && state.registrations < GAMIFICATION_CONFIG.dailyLimits.registrations ? GAMIFICATION_CONFIG.academic.registration : 0,
      time: xpDeltaForBlocks(beforeMinutes, afterMinutes, GAMIFICATION_CONFIG.academic.minutesBlock, GAMIFICATION_CONFIG.academic.xpPerMinutesBlock),
      questions: xpDeltaForBlocks(beforeQuestions, afterQuestions, GAMIFICATION_CONFIG.academic.questionsBlock, GAMIFICATION_CONFIG.academic.xpPerQuestionsBlock),
      correct: xpDeltaForBlocks(beforeCorrect, afterCorrect, GAMIFICATION_CONFIG.academic.correctBlock, GAMIFICATION_CONFIG.academic.xpPerCorrectBlock),
      accuracy: qualifiesAccuracy && state.accuracyBonuses < GAMIFICATION_CONFIG.dailyLimits.accuracyBonuses ? GAMIFICATION_CONFIG.academic.accuracyBonus : 0,
      review: review && state.reviews < GAMIFICATION_CONFIG.dailyLimits.reviews ? GAMIFICATION_CONFIG.academic.review : 0,
      simulation: source.kind === 'simulation' && state.simulations < GAMIFICATION_CONFIG.dailyLimits.simulations ? GAMIFICATION_CONFIG.academic.simulation : 0,
    };

    state.minutes += metrics.minutes;
    state.questions += metrics.questions;
    state.correct += metrics.correct;
    if (source.kind === 'study') state.registrations += 1;
    if (qualifiesAccuracy) state.accuracyBonuses += 1;
    if (review) state.reviews += 1;
    if (source.kind === 'simulation') state.simulations += 1;
    daily.set(dateKey, state);

    const xp = Object.values(breakdown).reduce((sum, value) => sum + value, 0);
    if (xp <= 0) return;
    const labels = [];
    if (breakdown.registration) labels.push('registro');
    if (breakdown.time) labels.push('tempo');
    if (breakdown.questions) labels.push('questões');
    if (breakdown.correct) labels.push('acertos');
    if (breakdown.accuracy) labels.push('precisão');
    if (breakdown.review) labels.push('revisão');
    if (breakdown.simulation) labels.push('simulado');
    events.push({
      id: `academic_${source.kind}_${source.id}`,
      sourceType: source.kind,
      sourceId: source.id,
      sourceKey: `${source.kind}:${source.id}`,
      dateKey,
      weekId: getWeekId(dateKey),
      sourceMillis: source.millis,
      xpTotal: xp,
      xpCompetitive: xp,
      breakdown,
      message: `${source.kind === 'simulation' ? 'Simulado' : review ? 'Revisão' : 'Estudo'}: ${labels.join(', ')}`,
      category: 'academic',
    });
  });

  const metricsByDay = new Map();
  sources.forEach(({ metrics }) => {
    const dateKey = toDateKey(metrics.date);
    if (!dateKey) return;
    const totals = metricsByDay.get(dateKey) || { minutes: 0, questions: 0 };
    totals.minutes += metrics.minutes;
    totals.questions += metrics.questions;
    metricsByDay.set(dateKey, totals);
  });
  const sortedGoals = [...goals].filter(isValidGamificationRecord).sort((a, b) => String(a.startDate || '').localeCompare(String(b.startDate || '')));
  metricsByDay.forEach((metrics, dateKey) => {
    const goal = [...sortedGoals].reverse().find((item) => String(item.startDate || '') <= dateKey);
    if (!goal) return;
    const minutesGoal = n(goal.hours) * 60;
    const questionsGoal = integer(goal.questions);
    const hasRequirement = minutesGoal > 0 || questionsGoal > 0;
    const met = hasRequirement
      && (minutesGoal <= 0 || metrics.minutes >= minutesGoal)
      && (questionsGoal <= 0 || metrics.questions >= questionsGoal);
    if (met) events.push({
      id: `academic_daily_goal_${dateKey}`,
      sourceType: 'daily_goal',
      sourceId: dateKey,
      sourceKey: `daily_goal:${dateKey}`,
      dateKey,
      weekId: getWeekId(dateKey),
      sourceMillis: new Date(`${dateKey}T23:59:59-03:00`).getTime(),
      xpTotal: GAMIFICATION_CONFIG.academic.dailyGoal,
      xpCompetitive: GAMIFICATION_CONFIG.academic.dailyGoal,
      breakdown: { dailyGoal: GAMIFICATION_CONFIG.academic.dailyGoal },
      message: 'Meta diária alcançada',
      category: 'academic',
    });
  });
  return events.sort((a, b) => a.sourceMillis - b.sourceMillis || a.id.localeCompare(b.id));
};

const achievement = (id, category, title, description, requirement, xp, progressKey, threshold) => ({
  id, category, title, description, requirement, xp, progressKey, threshold,
});

export const ACHIEVEMENTS = Object.freeze([
  achievement('first_study', 'Primeiros passos', 'Primeiro estudo', 'Registre seu primeiro estudo válido.', '1 estudo', 25, 'studies', 1),
  achievement('first_goal', 'Primeiros passos', 'Primeira meta', 'Alcance sua primeira meta diária.', '1 meta diária', 25, 'dailyGoals', 1),
  achievement('first_simulation', 'Primeiros passos', 'Primeiro simulado', 'Conclua seu primeiro simulado.', '1 simulado', 50, 'simulations', 1),
  achievement('first_review', 'Primeiros passos', 'Primeira revisão', 'Conclua sua primeira revisão.', '1 revisão', 25, 'reviews', 1),
  achievement('first_cycle_created', 'Primeiros passos', 'Primeiro ciclo criado', 'Crie seu primeiro ciclo.', '1 ciclo criado', 25, 'cyclesCreated', 1),
  achievement('first_schedule_created', 'Primeiros passos', 'Primeiro cronograma criado', 'Crie seu primeiro cronograma.', '1 cronograma criado', 25, 'schedulesCreated', 1),
  achievement('first_cycle_round', 'Primeiros passos', 'Primeira rodada concluída', 'Conclua uma rodada do ciclo.', '1 rodada', 50, 'cycleRounds', 1),
  achievement('first_schedule_complete', 'Primeiros passos', 'Primeiro cronograma concluído', 'Conclua um cronograma inteiro.', '1 cronograma', 50, 'schedulesCompleted', 1),
  ...[[5, 50], [10, 100], [25, 250], [50, 500], [75, 750], [100, 1000]].map(([level, xp]) => achievement(`level_${level}`, 'Níveis', `Nível ${level}`, `Alcance o nível ${level}.`, `Nível ${level}`, xp, 'level', level)),
  ...[[60, 25, '1h'], [600, 100, '10h'], [3000, 250, '50h'], [6000, 500, '100h'], [15000, 1000, '250h']].map(([minutes, xp, label]) => achievement(`time_${minutes}`, 'Tempo', `${label} de estudo`, `Acumule ${label} de estudo.`, label, xp, 'minutes', minutes)),
  ...[[100, 100], [500, 250], [1000, 500], [5000, 1000]].map(([questions, xp]) => achievement(`questions_${questions}`, 'Questões', `${questions.toLocaleString('pt-BR')} questões`, `Resolva ${questions.toLocaleString('pt-BR')} questões.`, `${questions.toLocaleString('pt-BR')} questões`, xp, 'questions', questions)),
  achievement('accuracy_85_100', 'Precisão', 'Precisão de 85%', 'Mantenha 85% em pelo menos 100 questões.', '85% em 100 questões', 150, 'accuracy85Questions', 100),
  achievement('accuracy_90_500', 'Precisão', 'Precisão de 90%', 'Mantenha 90% em pelo menos 500 questões.', '90% em 500 questões', 300, 'accuracy90Questions', 500),
  ...[[3, 25], [7, 50], [14, 100], [30, 250], [60, 500], [100, 1000]].map(([days, xp]) => achievement(`streak_${days}`, 'Sequência', `${days} dias em sequência`, `Estude por ${days} dias seguidos.`, `${days} dias`, xp, 'streak', days)),
  ...[[10, 100], [50, 250], [100, 500]].map(([reviews, xp]) => achievement(`reviews_${reviews}`, 'Revisões', `${reviews} revisões`, `Conclua ${reviews} revisões.`, `${reviews} revisões`, xp, 'reviews', reviews)),
  achievement('first_group', 'Social', 'Primeiro grupo', 'Participe do seu primeiro grupo.', '1 grupo', 25, 'groupsJoined', 1),
  achievement('first_group_created', 'Social', 'Primeiro grupo criado', 'Crie seu primeiro grupo.', '1 grupo criado', 50, 'groupsCreated', 1),
  achievement('first_group_podium', 'Social', 'Primeiro pódio em grupo', 'Termine uma semana no pódio de um grupo.', '1 pódio', 100, 'groupPodiums', 1),
  ...LEAGUES.slice(1).map((league) => achievement(`league_${league.id}`, 'Ligas', `Liga ${league.name}`, `Alcance a Liga ${league.name}.`, `Liga ${league.name}`, [50, 100, 150, 250, 350, 500][league.index - 1], 'highestLeagueIndex', league.index)),
  achievement('first_league_podium', 'Ligas', 'Primeiro pódio de liga', 'Termine uma semana no pódio da liga.', '1 pódio', 100, 'leaguePodiums', 1),
  achievement('first_general_top10', 'Geral', 'Primeiro top 10 geral', 'Termine a semana entre os 10 primeiros.', 'Top 10', 150, 'generalTop10', 1),
  achievement('first_general_top3', 'Geral', 'Primeiro top 3 geral', 'Termine a semana entre os 3 primeiros.', 'Top 3', 300, 'generalTop3', 1),
  achievement('first_general_first', 'Geral', 'Primeira colocação geral', 'Termine uma semana na primeira colocação geral.', '1º geral', 500, 'generalFirst', 1),
]);

export const getAchievementProgress = (item, state = {}) => {
  const current = n(state[item.progressKey]);
  const threshold = Math.max(1, n(item.threshold));
  return { current, threshold, percent: Math.min(100, (current / threshold) * 100), unlocked: current >= threshold };
};

export const evaluateAchievements = (state = {}, unlockedIds = []) => {
  const unlocked = new Set(unlockedIds);
  const newlyUnlocked = [];
  let effectiveLevel = n(state.level);
  let rewardXP = 0;
  let changed = true;
  while (changed) {
    changed = false;
    ACHIEVEMENTS.forEach((item) => {
      if (unlocked.has(item.id)) return;
      const evaluationState = { ...state, level: effectiveLevel };
      if (getAchievementProgress(item, evaluationState).unlocked) {
        unlocked.add(item.id);
        newlyUnlocked.push(item);
        rewardXP += item.xp;
        effectiveLevel = getLevelFromXP(n(state.totalXPBeforeAchievements) + rewardXP);
        changed = true;
      }
    });
  }
  return { unlockedIds: [...unlocked], newlyUnlocked, rewardXP, effectiveLevel };
};

const dateKeyToUTCDate = (dateKey) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(dateKey || ''))) return null;
  const date = new Date(`${dateKey}T12:00:00Z`);
  return Number.isNaN(date.getTime()) ? null : date;
};

const addDateKeyDays = (dateKey, amount) => {
  const date = dateKeyToUTCDate(dateKey);
  if (!date) return null;
  date.setUTCDate(date.getUTCDate() + Number(amount || 0));
  return date.toISOString().slice(0, 10);
};

const getScheduleTemplate = (schedule) => {
  if (Array.isArray(schedule?.semanaTemplate)) return schedule.semanaTemplate;
  if (schedule?.semanaTemplate && typeof schedule.semanaTemplate === 'object') {
    return Object.values(schedule.semanaTemplate);
  }
  return [];
};

export const STUDY_STREAK_DAY_STATES = Object.freeze({
  STUDIED: 'studied',
  REST: 'rest',
  RECOVERY_PENDING: 'recovery_pending',
  RECOVERED: 'recovered',
  FAILED: 'failed',
  NOT_APPLICABLE: 'not_applicable',
});

const INVALID_STUDY_STATUSES = new Set([
  'cancelado', 'cancelled', 'planejado', 'planned', 'invalido', 'invalid',
  'pendente', 'pending', 'simulado', 'simulated', 'rascunho', 'draft',
  'em_andamento', 'in_progress', 'abandonado', 'abandoned',
]);

export const isQualifiedStudyRecord = (record = {}) => {
  if (!isValidGamificationRecord(record)) return false;
  const status = String(record.status || record.situacao || '').trim().toLowerCase();
  const type = String(record.tipoEstudo || record.activityType || record.sourceType || '').trim().toLowerCase();
  if (INVALID_STUDY_STATUSES.has(status)) return false;
  if (['simulado', 'simulation'].includes(type) || record.isSimulado === true) return false;
  if (record.confirmado === false || record.confirmed === false || record.persisted === false) return false;
  const metrics = getStudyMetrics(record);
  return metrics.minutes > 0 || metrics.questions > 0;
};

export const isQualifiedSimulation = (simulation = {}) => {
  if (!isValidGamificationRecord(simulation)) return false;
  const status = String(simulation.status || simulation.situacao || '').trim().toLowerCase();
  if (INVALID_STUDY_STATUSES.has(status)) return false;
  if (simulation.confirmado === false || simulation.confirmed === false || simulation.persisted === false) return false;
  const metrics = getSimuladoMetrics(simulation);
  return metrics.minutes > 0 || metrics.questions > 0;
};

const getQualifiedStudyDates = (records, simulations, { includeReviewRecords = true } = {}) => new Set([
  ...(Array.isArray(records) ? records : [])
    .filter(isQualifiedStudyRecord)
    .filter((record) => includeReviewRecords || !isReviewRecord(record))
    .map((record) => toDateKey(getStudyMetrics(record).date)),
  ...(Array.isArray(simulations) ? simulations : [])
    .filter(isQualifiedSimulation)
    .map((simulation) => toDateKey(getSimuladoMetrics(simulation).date)),
].filter(Boolean));

const addMapMinutes = (map, dateKey, minutes) => {
  if (!dateKey || minutes <= 0) return;
  map.set(dateKey, (map.get(dateKey) || 0) + minutes);
};

const getWeekdayFromDateKey = (dateKey) => dateKeyToUTCDate(dateKey)?.getUTCDay();

const getPlanContext = (plan) => (plan?.type === 'cycle' ? 'ciclo' : 'cronograma');

const isRecordExplicitlyLinkedToAnotherPlan = (record = {}, plan) => {
  const planId = String(plan?.id || '');
  const context = getPlanContext(plan);
  const recordContext = String(record.contextoRegistro || record.origemPlanejamento || '').trim().toLowerCase();
  if (recordContext && recordContext !== context) return true;
  if (plan?.type === 'cycle') {
    if (record.cronogramaId) return true;
    if (record.cicloId && String(record.cicloId) !== planId) return true;
  }
  if (plan?.type === 'schedule') {
    if (record.cicloId) return true;
    if (record.cronogramaId && String(record.cronogramaId) !== planId) return true;
  }
  return false;
};

const getCycleTargetMinutesForDate = (cycle, dateKey) => {
  const weekday = getWeekdayFromDateKey(dateKey);
  const rawDays = cycle?.diasEstudo;
  const fallback = Math.max(1, integer(cycle?.tempoSessaoMinutos) || 60);
  if (rawDays && typeof rawDays === 'object' && !Array.isArray(rawDays)) {
    const rawValue = rawDays[weekday] ?? rawDays[String(weekday)];
    const hours = Number(rawValue);
    return hours > 0 ? Math.round(hours * 60) : fallback;
  }
  return fallback;
};

const getSlotMinutes = (slot = {}) => Math.max(0, integer(
  slot.tempoPlanejadoMinutos ?? slot.tempoMinutos ?? slot.minutosEstudo ?? slot.durationMinutes,
));

const getScheduleTargetMinutesForDate = (schedule, dateKey) => {
  const weekday = getWeekdayFromDateKey(dateKey);
  const configuredHours = Number(
    schedule?.horariosDetalhados?.[weekday]
    ?? schedule?.horariosDetalhados?.[String(weekday)]
    ?? (schedule?.diasEstudo && !Array.isArray(schedule.diasEstudo)
      ? schedule.diasEstudo[weekday] ?? schedule.diasEstudo[String(weekday)]
      : 0),
  );
  if (configuredHours > 0) return Math.round(configuredHours * 60);

  const grossMinutes = getScheduleTemplate(schedule)
    .filter((slot) => Number(slot?.dia) === weekday)
    .reduce((maximum, slot) => Math.max(maximum, getSlotMinutes({
      tempoPlanejadoMinutos: slot?.minutosBrutoDia,
    })), 0);
  if (grossMinutes > 0) return grossMinutes;

  const templateMinutes = getScheduleTemplate(schedule)
    .filter((slot) => {
      const rawSlotDate = slot?.dataSlot || slot?.data || slot?.date;
      const slotDate = rawSlotDate ? toDateKey(rawSlotDate) : null;
      if (slotDate) return slotDate === dateKey;
      return Number(slot?.dia) === weekday;
    })
    .reduce((total, slot) => total + getSlotMinutes(slot), 0);
  if (templateMinutes > 0) return templateMinutes;

  return 60;
};

const getScheduleStudyTargetMinutesForDate = (schedule, dateKey) => {
  const weekday = getWeekdayFromDateKey(dateKey);
  return getScheduleTemplate(schedule)
    .filter((slot) => !slot?.isRevisaoAuto && !slot?.isRevisao && !slot?.isConsolidada)
    .filter((slot) => {
      const rawSlotDate = slot?.dataSlot || slot?.data || slot?.date;
      const slotDate = rawSlotDate ? toDateKey(rawSlotDate) : null;
      if (slotDate) return slotDate === dateKey;
      return Number(slot?.dia) === weekday;
    })
    .reduce((total, slot) => total + getSlotMinutes(slot), 0);
};

const getPlanTargetMinutesForDate = (plan, dateKey) => (
  plan?.type === 'cycle'
    ? getCycleTargetMinutesForDate(plan.data, dateKey)
    : getScheduleTargetMinutesForDate(plan.data, dateKey)
);

const getReviewDueDateKey = (review = {}) => toDateKey(
  review.dataAgendada || review.dataPrevista || review.dataRevisao || review.dataSlot,
);

const getReviewCompletionDateKey = (review = {}) => toDateKey(
  review.concluidaEm || review.concluidoEm || review.dataConclusao,
);

const isCycleReviewPendingByDate = (review, plan, dateKey) => {
  if (plan?.type !== 'cycle') return false;
  if (String(review?.cicloId || '') !== String(plan.id || '')) return false;
  const dueDate = getReviewDueDateKey(review);
  if (!dueDate || dueDate > dateKey) return false;
  if (review?.concluida !== true && review?.concluido !== true) return true;
  const completionDate = getReviewCompletionDateKey(review);
  return Boolean(completionDate && completionDate > dateKey);
};

const getCycleReviewRequirementsByDate = (cycleReviews, plan, dateKey) => (
  (Array.isArray(cycleReviews) ? cycleReviews : []).filter((review) => {
    if (plan?.type !== 'cycle' || String(review?.cicloId || '') !== String(plan.id || '')) return false;
    const dueDate = getReviewDueDateKey(review);
    if (!dueDate || dueDate > dateKey) return false;
    const completed = review?.concluida === true || review?.concluido === true;
    if (!completed) return true;
    const completionDate = getReviewCompletionDateKey(review);
    return dueDate === dateKey || Boolean(completionDate && completionDate >= dateKey);
  })
);

const getPlanDailyActivityMinutes = ({ records = [], simulations = [], plan }) => {
  const totalMinutesByDate = new Map();
  const studyMinutesByDate = new Map();
  (Array.isArray(records) ? records : []).forEach((record) => {
    if (!isQualifiedStudyRecord(record)) return;
    if (isRecordExplicitlyLinkedToAnotherPlan(record, plan)) return;
    const metrics = getStudyMetrics(record);
    const dateKey = toDateKey(metrics.date);
    addMapMinutes(totalMinutesByDate, dateKey, metrics.minutes);
    if (!isReviewRecord(record)) addMapMinutes(studyMinutesByDate, dateKey, metrics.minutes);
  });
  (Array.isArray(simulations) ? simulations : []).forEach((simulation) => {
    if (!isQualifiedSimulation(simulation)) return;
    const metrics = getSimuladoMetrics(simulation);
    const dateKey = toDateKey(metrics.date);
    addMapMinutes(totalMinutesByDate, dateKey, metrics.minutes);
    addMapMinutes(studyMinutesByDate, dateKey, metrics.minutes);
  });
  return { totalMinutesByDate, studyMinutesByDate };
};

const normalizeStudyWeekdays = (raw, fallback = []) => {
  if (Array.isArray(raw)) {
    return [...new Set(raw.map(Number).filter((day) => Number.isInteger(day) && day >= 0 && day <= 6))];
  }
  if (raw && typeof raw === 'object') {
    return [...new Set(Object.entries(raw)
      .filter(([, value]) => value === true || Number(value) > 0)
      .map(([day]) => Number(day))
      .filter((day) => Number.isInteger(day) && day >= 0 && day <= 6))];
  }
  return [...fallback];
};

const getPlanStudyWeekdays = (plan) => {
  if (plan?.type === 'schedule') {
    const configured = normalizeStudyWeekdays(plan.data?.diasEstudo);
    const template = getScheduleTemplate(plan.data)
      .filter((slot) => !slot?.isRevisaoAuto)
      .map((slot) => Number(slot?.dia))
      .filter((day) => Number.isInteger(day) && day >= 0 && day <= 6);
    return [...new Set([...configured, ...template])].sort((a, b) => a - b);
  }
  return normalizeStudyWeekdays(plan?.data?.diasEstudo, [1, 2, 3, 4, 5]).sort((a, b) => a - b);
};

const getPlanStartKey = (plan, studyDates) => {
  const value = plan?.type === 'cycle'
    ? (plan?.data?.dataInicioPlanejamento || plan?.data?.dataInicio || plan?.data?.inicio || plan?.data?.dataCriacao || plan?.data?.createdAt)
    : (plan?.data?.dataInicio || plan?.data?.inicio || plan?.data?.createdAt || plan?.data?.dataCriacao);
  const configured = value ? toDateKey(value) : null;
  if (configured) return configured;
  return [...studyDates].sort()[0] || null;
};

const getPlanRestDateKeys = (plan) => {
  const data = plan?.data || {};
  const directValues = [data.datasDescanso, data.diasDescanso, data.diasFolga, data.feriados]
    .flatMap((value) => (Array.isArray(value) ? value : Object.entries(value || {})
      .filter(([, enabled]) => enabled === true || String(enabled).toLowerCase() === 'descanso')
      .map(([dateKey]) => dateKey)));
  const exceptionValues = Object.values(data.excecoesCalendario || data.excecoes || {})
    .filter((entry) => ['descanso', 'folga', 'feriado', 'rest'].includes(String(entry?.tipo || entry?.type || entry?.status || '').toLowerCase()))
    .map((entry) => entry?.data || entry?.date || entry?.dateKey);
  return new Set([...directValues, ...exceptionValues].map(toDateKey).filter(Boolean));
};

const nextExpectedStudyDate = (dateKey, studyWeekdays, restDates, limit = 14) => {
  let cursor = dateKey;
  for (let index = 0; index < limit; index += 1) {
    cursor = addDateKeyDays(cursor, 1);
    const weekday = dateKeyToUTCDate(cursor)?.getUTCDay();
    if (studyWeekdays.has(weekday) && !restDates.has(cursor)) return cursor;
  }
  return null;
};

// A regra de meta completa/revisões não pode recalcular períodos anteriores à
// sua vigência. A base anterior é preservada e a regra nova apenas continua
// ou encerra a sequência a partir deste marco.
export const STRICT_STREAK_RULES_START_DATE = '2026-08-15';

const calculateLegacyStreakBeforeStrictRules = ({ records = [], strictStartKey, lookbackDays }) => {
  if (!strictStartKey) return 0;
  const earliestAllowed = addDateKeyDays(strictStartKey, -Math.max(1, integer(lookbackDays)));
  const studyDates = new Set(
    (Array.isArray(records) ? records : [])
      .filter(isValidGamificationRecord)
      .map((record) => toDateKey(getStudyMetrics(record).date))
      .filter((dateKey) => Boolean(dateKey && dateKey < strictStartKey && dateKey >= earliestAllowed)),
  );
  let cursor = addDateKeyDays(strictStartKey, -1);
  let streak = 0;
  while (cursor && studyDates.has(cursor)) {
    streak += 1;
    cursor = addDateKeyDays(cursor, -1);
  }
  return streak;
};

const calculateLegacyWeekdayStreakBeforeStrictRules = ({ records = [], strictStartKey, lookbackDays }) => {
  if (!strictStartKey) return 0;
  const earliestAllowed = addDateKeyDays(strictStartKey, -Math.max(1, integer(lookbackDays)));
  const studyDates = new Set(
    (Array.isArray(records) ? records : [])
      .filter(isValidGamificationRecord)
      .map((record) => toDateKey(getStudyMetrics(record).date))
      .filter((dateKey) => Boolean(dateKey && dateKey < strictStartKey && dateKey >= earliestAllowed)),
  );
  let cursor = addDateKeyDays(strictStartKey, -1);
  let streak = 0;
  while (cursor && cursor >= earliestAllowed) {
    const weekday = dateKeyToUTCDate(cursor)?.getUTCDay();
    if (weekday === 0 || weekday === 6) {
      cursor = addDateKeyDays(cursor, -1);
      continue;
    }
    if (!studyDates.has(cursor)) break;
    streak += 1;
    cursor = addDateKeyDays(cursor, -1);
  }
  return streak;
};

const calculateLegacyPlannedStreakBeforeStrictRules = ({ plan, dailyActivityMinutes, strictStartKey, lookbackDays }) => {
  if (!plan || !strictStartKey) return 0;
  const studyWeekdays = new Set(getPlanStudyWeekdays(plan));
  if (!studyWeekdays.size) return 0;
  const restDates = getPlanRestDateKeys(plan);
  const totalMinutesByDate = dailyActivityMinutes?.totalMinutesByDate || new Map();
  const configuredStartKey = getPlanStartKey(plan, new Set(totalMinutesByDate.keys()));
  if (!configuredStartKey || configuredStartKey >= strictStartKey) return 0;
  const earliestAllowed = addDateKeyDays(strictStartKey, -Math.max(1, integer(lookbackDays)));
  let cursor = addDateKeyDays(strictStartKey, -1);
  let streak = 0;
  while (cursor && cursor >= configuredStartKey && cursor >= earliestAllowed) {
    const weekday = dateKeyToUTCDate(cursor)?.getUTCDay();
    const expected = studyWeekdays.has(weekday) && !restDates.has(cursor);
    if (expected) {
      if (Number(totalMinutesByDate.get(cursor) || 0) <= 0) break;
      streak += 1;
    }
    cursor = addDateKeyDays(cursor, -1);
  }
  return streak;
};

const evaluatePlannedStudyStreak = ({ plan, dailyActivityMinutes, cycleReviews = [], todayKey, lookbackDays, historicalStreak = 0 }) => {
  const weekdays = getPlanStudyWeekdays(plan);
  const studyWeekdays = new Set(weekdays);
  const restDates = getPlanRestDateKeys(plan);
  const totalMinutesByDate = dailyActivityMinutes?.totalMinutesByDate || new Map();
  const studyMinutesByDate = dailyActivityMinutes?.studyMinutesByDate || new Map();
  const configuredStartKey = getPlanStartKey(plan, new Set(totalMinutesByDate.keys()));
  if (!configuredStartKey && !totalMinutesByDate.size && !studyMinutesByDate.size) return null;
  const startKey = configuredStartKey && configuredStartKey > STRICT_STREAK_RULES_START_DATE
    ? configuredStartKey
    : STRICT_STREAK_RULES_START_DATE;
  if (!todayKey || !studyWeekdays.size || startKey > todayKey) return null;

  const earliestAllowed = addDateKeyDays(todayKey, -(Math.max(1, integer(lookbackDays)) - 1));
  let cursor = startKey < earliestAllowed ? earliestAllowed : startKey;
  let currentStreak = Math.max(0, integer(historicalStreak));
  let pendingRecoveryDate = null;
  let recoveryDueDate = null;
  const days = {};

  while (cursor && cursor <= todayKey) {
    const weekday = dateKeyToUTCDate(cursor)?.getUTCDay();
    const expected = studyWeekdays.has(weekday) && !restDates.has(cursor);
    const plannedMinutes = expected ? getPlanTargetMinutesForDate(plan, cursor) : 0;
    const qualifiedMinutes = Math.max(0, Number(totalMinutesByDate.get(cursor) || 0));
    const qualifiedStudyMinutes = Math.max(0, Number(studyMinutesByDate.get(cursor) || 0));
    const cycleReviewRequirements = expected
      ? getCycleReviewRequirementsByDate(cycleReviews, plan, cursor)
      : [];
    const pendingReviewCount = cycleReviewRequirements
      .filter((review) => isCycleReviewPendingByDate(review, plan, cursor)).length;
    const plannedReviewMinutes = cycleReviewRequirements.reduce(
      (total, review) => total + Math.max(0, getSlotMinutes(review) || 20),
      0,
    );
    const plannedStudyMinutes = plan.type === 'schedule'
      ? Math.min(plannedMinutes, getScheduleStudyTargetMinutesForDate(plan.data, cursor) || plannedMinutes)
      : Math.max(0, plannedMinutes - Math.min(plannedMinutes, plannedReviewMinutes));

    const studied = expected
      && qualifiedMinutes >= plannedMinutes
      && qualifiedStudyMinutes >= plannedStudyMinutes
      && pendingReviewCount === 0;

    const isToday = cursor === todayKey;
    let state = STUDY_STREAK_DAY_STATES.NOT_APPLICABLE;

    if (!expected) {
      state = STUDY_STREAK_DAY_STATES.REST;
    } else if (studied) {
      state = pendingRecoveryDate
        ? STUDY_STREAK_DAY_STATES.RECOVERED
        : STUDY_STREAK_DAY_STATES.STUDIED;
      currentStreak += 1;
      pendingRecoveryDate = null;
      recoveryDueDate = null;
    } else if (isToday) {
      state = STUDY_STREAK_DAY_STATES.RECOVERY_PENDING;
      if (!pendingRecoveryDate) pendingRecoveryDate = cursor;
      recoveryDueDate = pendingRecoveryDate === cursor
        ? nextExpectedStudyDate(cursor, studyWeekdays, restDates)
        : cursor;
    } else if (!pendingRecoveryDate) {
      state = STUDY_STREAK_DAY_STATES.RECOVERY_PENDING;
      pendingRecoveryDate = cursor;
      recoveryDueDate = nextExpectedStudyDate(cursor, studyWeekdays, restDates);
    } else {
      state = STUDY_STREAK_DAY_STATES.FAILED;
      currentStreak = 0;
      pendingRecoveryDate = null;
      recoveryDueDate = null;
    }

    days[cursor] = {
      state,
      expectedStudy: expected,
      qualifiedStudy: studied,
      qualifiedMinutes,
      qualifiedStudyMinutes,
      plannedMinutes,
      plannedStudyMinutes,
      pendingReviewCount,
      incrementsStreak: state === STUDY_STREAK_DAY_STATES.STUDIED || state === STUDY_STREAK_DAY_STATES.RECOVERED,
      preservesStreak: state !== STUDY_STREAK_DAY_STATES.FAILED && state !== STUDY_STREAK_DAY_STATES.NOT_APPLICABLE,
      streakAfterDay: currentStreak,
    };
    cursor = addDateKeyDays(cursor, 1);
  }

  return {
    currentStreak,
    days,
    pendingRecoveryDate,
    recoveryDueDate,
    context: { type: plan.type, id: String(plan.id), startDate: startKey, studyWeekdays: weekdays },
    qualifiedStudyDates: Object.entries(days)
      .filter(([, day]) => day.incrementsStreak)
      .map(([dateKey]) => dateKey),
  };
};

const evaluateRecordsFallback = ({ studyDates, todayKey, lookbackDays }) => {
  const days = {};
  if (!todayKey || !studyDates.size) {
    return { currentStreak: 0, days, pendingRecoveryDate: null, recoveryDueDate: null, context: null };
  }
  const earliestAllowed = addDateKeyDays(todayKey, -(Math.max(1, integer(lookbackDays)) - 1));
  const earliestStudyDate = [...studyDates].filter((dateKey) => dateKey <= todayKey).sort()[0];
  let cursor = earliestStudyDate && earliestStudyDate > earliestAllowed ? earliestStudyDate : earliestAllowed;
  while (cursor && cursor <= todayKey) {
    const studied = studyDates.has(cursor);
    days[cursor] = {
      state: studied ? STUDY_STREAK_DAY_STATES.STUDIED : STUDY_STREAK_DAY_STATES.NOT_APPLICABLE,
      expectedStudy: false,
      qualifiedStudy: studied,
      incrementsStreak: studied,
      preservesStreak: studied,
      streakAfterDay: 0,
    };
    cursor = addDateKeyDays(cursor, 1);
  }
  let currentStreak = 0;
  let reverseCursor = todayKey;
  if (!studyDates.has(reverseCursor)) reverseCursor = addDateKeyDays(reverseCursor, -1);
  while (reverseCursor && reverseCursor >= earliestAllowed && studyDates.has(reverseCursor)) {
    currentStreak += 1;
    reverseCursor = addDateKeyDays(reverseCursor, -1);
  }
  return { currentStreak, days, pendingRecoveryDate: null, recoveryDueDate: null, context: null };
};

const emptyPlanStudyStreak = ({ todayKey, source = 'plan_unavailable' }) => ({
  currentStreak: 0,
  days: {},
  pendingRecoveryDate: null,
  recoveryDueDate: null,
  context: null,
  qualifiedStudyDates: [],
  candidateContexts: [],
  source,
  today: todayKey,
});

export const calculatePlanStudyStreak = ({
  records = [],
  simulations = [],
  simulados = simulations,
  plan = null,
  planType = null,
  cycleReviews = [],
  now = new Date(),
  lookbackDays = 3660,
} = {}) => {
  const todayKey = toDateKey(now);
  const normalizedType = ['cycle', 'ciclo'].includes(String(planType || '').toLowerCase())
    ? 'cycle'
    : ['schedule', 'cronograma'].includes(String(planType || '').toLowerCase())
      ? 'schedule'
      : null;
  const planId = plan?.id;
  if (!normalizedType || planId === undefined || planId === null || planId === '') {
    return emptyPlanStudyStreak({ todayKey });
  }

  const wrappedPlan = { type: normalizedType, id: planId, data: plan };
  const dailyActivityMinutes = getPlanDailyActivityMinutes({ records, simulations: simulados, plan: wrappedPlan });
  const historicalStreak = Math.max(
    calculateLegacyStreakBeforeStrictRules({ records, strictStartKey: STRICT_STREAK_RULES_START_DATE, lookbackDays }),
    calculateLegacyWeekdayStreakBeforeStrictRules({ records, strictStartKey: STRICT_STREAK_RULES_START_DATE, lookbackDays }),
    calculateLegacyPlannedStreakBeforeStrictRules({ plan: wrappedPlan, dailyActivityMinutes, strictStartKey: STRICT_STREAK_RULES_START_DATE, lookbackDays }),
  );
  const result = evaluatePlannedStudyStreak({
    plan: wrappedPlan,
    dailyActivityMinutes,
    cycleReviews,
    todayKey,
    lookbackDays,
    historicalStreak,
  });
  if (!result) return emptyPlanStudyStreak({ todayKey, source: 'plan_invalid' });

  return {
    ...result,
    source: 'plan',
    today: todayKey,
    qualifiedStudyDates: [...(result.qualifiedStudyDates || [])].sort(),
    candidateContexts: [{ ...result.context, currentStreak: result.currentStreak }],
  };
};

// Agregado público usado por Ranking, perfis públicos e Cloud Functions.
// Quando há vários planejamentos ativos válidos, vence a maior sequência atual;
// empates são resolvidos por tipo (ciclo antes de cronograma) e id crescente.
export const calculateCanonicalStudyStreak = ({
  records = [],
  simulations = [],
  simulados = simulations,
  cycles = [],
  schedules = [],
  cycleReviews = [],
  now = new Date(),
  lookbackDays = 3660,
  historicalStreakBaseline = 0,
} = {}) => {
  const todayKey = toDateKey(now);
  const studyDates = getQualifiedStudyDates(records, simulados);
  const rawHistoricalStreak = Math.max(
    integer(historicalStreakBaseline),
    calculateLegacyStreakBeforeStrictRules({ records, strictStartKey: STRICT_STREAK_RULES_START_DATE, lookbackDays }),
    calculateLegacyWeekdayStreakBeforeStrictRules({ records, strictStartKey: STRICT_STREAK_RULES_START_DATE, lookbackDays }),
  );
  const activePlans = [
    ...(Array.isArray(cycles) ? cycles : [])
      .filter((plan) => plan?.ativo === true && plan?.arquivado !== true)
      .map((plan) => ({ type: 'cycle', id: plan.id, data: plan })),
    ...(Array.isArray(schedules) ? schedules : [])
      .filter((plan) => plan?.ativo === true && plan?.arquivado !== true)
      .map((plan) => ({ type: 'schedule', id: plan.id, data: plan })),
  ].filter((plan) => plan.id !== undefined && plan.id !== null && plan.id !== '');

  const candidates = activePlans
    .map((plan) => {
      const dailyActivityMinutes = getPlanDailyActivityMinutes({ records, simulations: simulados, plan });
      const historicalStreak = Math.max(
        rawHistoricalStreak,
        calculateLegacyPlannedStreakBeforeStrictRules({ plan, dailyActivityMinutes, strictStartKey: STRICT_STREAK_RULES_START_DATE, lookbackDays }),
      );
      return evaluatePlannedStudyStreak({ plan, dailyActivityMinutes, cycleReviews, todayKey, lookbackDays, historicalStreak });
    })
    .filter(Boolean)
    .sort((a, b) => (
      b.currentStreak - a.currentStreak
      || String(a.context.type).localeCompare(String(b.context.type))
      || String(a.context.id).localeCompare(String(b.context.id))
    ));
  const selected = candidates[0] || evaluateRecordsFallback({ studyDates, todayKey, lookbackDays });
  return {
    ...selected,
    source: candidates.length ? 'active_plan' : 'records_fallback',
    today: todayKey,
    qualifiedStudyDates: [...(candidates.length ? (selected.qualifiedStudyDates || []) : studyDates)].sort(),
    candidateContexts: candidates.map((candidate) => ({ ...candidate.context, currentStreak: candidate.currentStreak })),
  };
};

export const calculateStudyStreak = (records = [], now = new Date()) => (
  calculateCanonicalStudyStreak({ records, now }).currentStreak
);

export const calculateBestActivePlanStreak = ({
  records = [],
  simulations = [],
  simulados = simulations,
  cycles = [],
  schedules = [],
  now = new Date(),
  historicalStreakBaseline = 0,
} = {}) => {
  return calculateCanonicalStudyStreak({ records, simulations: simulados, cycles, schedules, now, historicalStreakBaseline }).currentStreak;
};

export const calculateGamificationSnapshot = ({ records = [], simulations = [], simulados = simulations, goals = [], now = new Date() } = {}) => {
  const events = buildAcademicXPEvents({ records, simulations: simulados, goals });
  const totalXP = events.reduce((sum, event) => sum + event.xpTotal, 0);
  const weekId = getWeekId(now);
  const weeklyEvents = events.filter((event) => event.weekId === weekId);
  const allMetrics = [
    ...records.filter(isValidGamificationRecord).map(getStudyMetrics),
    ...simulados.filter(isValidGamificationRecord).map(getSimuladoMetrics),
  ];
  const totals = allMetrics.reduce((sum, metric) => ({ minutes: sum.minutes + metric.minutes, questions: sum.questions + metric.questions, correct: sum.correct + metric.correct }), { minutes: 0, questions: 0, correct: 0 });
  const weeklyMetrics = allMetrics.filter((metric) => getWeekId(metric.date) === weekId).reduce((sum, metric) => ({ minutes: sum.minutes + metric.minutes, questions: sum.questions + metric.questions, correct: sum.correct + metric.correct }), { minutes: 0, questions: 0, correct: 0 });
  return {
    totalXP,
    level: getLevelFromXP(totalXP),
    weekId,
    events,
    totals,
    weekly: {
      xp: weeklyEvents.reduce((sum, event) => sum + event.xpCompetitive, 0),
      minutes: weeklyMetrics.minutes,
      questions: weeklyMetrics.questions,
      correct: weeklyMetrics.correct,
      accuracy: weeklyMetrics.questions ? (weeklyMetrics.correct / weeklyMetrics.questions) * 100 : 0,
    },
  };
};

export const roundMigrationBaseXP = (xp = 0) => Math.ceil(n(xp) / 5) * 5;

export const formatStudyMinutes = (minutes = 0) => {
  const safe = integer(minutes);
  const hours = Math.floor(safe / 60);
  const rest = safe % 60;
  return hours ? `${hours}h${rest ? ` ${rest}min` : ''}` : `${rest}min`;
};
