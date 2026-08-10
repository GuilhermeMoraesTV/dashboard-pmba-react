export const PLANNING_LEVEL_MIN = 1;
export const PLANNING_LEVEL_MAX = 5;

export const PLANNING_LEVEL_LABELS = {
  0: 'Nao definido',
  1: 'Muito baixo',
  2: 'Baixo',
  3: 'Medio',
  4: 'Alto',
  5: 'Muito alto',
};

export const normalizePlanningLevel = (value, fallback = 0) => {
  const numericValue = Number(value);
  if (Number.isInteger(numericValue) && numericValue >= PLANNING_LEVEL_MIN && numericValue <= PLANNING_LEVEL_MAX) {
    return numericValue;
  }
  return Number(fallback) || 0;
};

export const legacyKnowledgeToLevel = (value, pesoFallback = null) => {
  const normalized = String(value || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '');

  if (normalized === 'iniciante') return 1;
  if (normalized === 'intermediario' || normalized === 'medio') return 3;
  if (normalized === 'avancado') return 5;

  const peso = Number(pesoFallback);
  if (Number.isFinite(peso)) {
    if (peso >= 4) return 1;
    if (peso <= 1) return 5;
    return 3;
  }

  return 0;
};

export const getKnowledgeLevel = (disciplina, { allowLegacy = true } = {}) => {
  const explicit = normalizePlanningLevel(
    disciplina?.conhecimentoNivel ?? disciplina?.nivelConhecimento,
  );
  if (explicit) return explicit;
  if (!allowLegacy) return 0;
  return legacyKnowledgeToLevel(
    disciplina?.nivelDominio ?? disciplina?.nivel,
    disciplina?.peso,
  );
};

export const getImportanceLevel = (disciplina, { allowLegacy = true } = {}) => {
  const explicit = normalizePlanningLevel(
    disciplina?.importanciaNivel ?? disciplina?.nivelImportancia,
  );
  if (explicit) return explicit;
  if (!allowLegacy) return 0;
  return normalizePlanningLevel(disciplina?.importancia ?? disciplina?.peso);
};

export const isPlanningLevelDefined = (value) => normalizePlanningLevel(value) > 0;

export const hasCompletePlanningLevels = (disciplina) => (
  isPlanningLevelDefined(disciplina?.conhecimentoNivel)
  && isPlanningLevelDefined(disciplina?.importanciaNivel)
);

export const calculatePlanningPriorityBase = (disciplina, { allowLegacy = true } = {}) => {
  const conhecimentoNivel = getKnowledgeLevel(disciplina, { allowLegacy }) || 3;
  const importanciaNivel = getImportanceLevel(disciplina, { allowLegacy }) || 3;
  const necessidadeConhecimento = (PLANNING_LEVEL_MAX + 1) - conhecimentoNivel;

  return (necessidadeConhecimento + importanciaNivel) / 2;
};

export const calculatePlanningPriority = (
  disciplina,
  averageTopics = 1,
  { allowLegacy = true } = {},
) => {
  const base = calculatePlanningPriorityBase(disciplina, { allowLegacy });
  const topicCount = Math.max(1, Number(disciplina?.assuntos?.length) || 1);
  const safeAverage = Math.max(1, Number(averageTopics) || 1);
  const topicRatio = topicCount / safeAverage;
  const topicAdjustment = Math.min(1.2, Math.max(0.8, 1 + (topicRatio - 1) * 0.3));

  return base * topicAdjustment;
};

export const isHighRelevance = (disciplina) => getImportanceLevel(disciplina) >= 4;
