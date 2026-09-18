const asRecord = (value) => (
  value && typeof value === 'object' && !Array.isArray(value) ? value : {}
);

const STUDY_BACKED_COMPLETION_SOURCES = new Set([
  'registro_manual',
  'timer',
  'registro_estudo',
  'tempo_acumulado',
  'upgrade_legado',
]);

export const CYCLE_ROUND_IDENTITY_VERSION = 1;

const hasExplicitRoundVersion = (value) => (
  value !== null
  && value !== undefined
  && value !== ''
  && Number.isInteger(Number(value))
  && Number(value) >= 0
);

export const getCycleRoundVersion = (cycle = {}) => Math.max(0, Number(cycle?.conclusoes || 0));

export const getCycleRecordRoundVersion = (record = {}) => (
  hasExplicitRoundVersion(record?.cicloRoundVersion)
    ? Number(record.cicloRoundVersion)
    : null
);

/**
 * A rodada gravada no registro é a identidade canônica. O fallback por
 * `conclusaoId == null` existe apenas para ciclos legados ainda não migrados.
 * Assim que `roundIdentityVersion` é ativado, registros sem identidade nunca
 * podem reaparecer em uma rodada nova por atraso de snapshot ou cache.
 */
export const isCycleRecordInRound = (record = {}, cycle = {}) => {
  if (record?.conclusaoId != null) return false;
  const recordRound = getCycleRecordRoundVersion(record);
  if (recordRound !== null) return recordRound === getCycleRoundVersion(cycle);
  return Number(cycle?.roundIdentityVersion || 0) < CYCLE_ROUND_IDENTITY_VERSION;
};

export const isStudyBackedCycleCompletion = (detail = {}) => (
  STUDY_BACKED_COMPLETION_SOURCES.has(String(detail?.origem || '').trim().toLowerCase())
);

export const getStudyBackedCycleCompletionState = (cycle = {}) => {
  const progress = { ...asRecord(cycle.progressoSessoes) };
  const details = { ...asRecord(cycle.sessoesConcluidasDetalhes) };
  const rawCompleted = (Array.isArray(cycle.sessoesConcluidas) ? cycle.sessoesConcluidas : [])
    .map(Number)
    .filter((index) => Number.isInteger(index) && index >= 0);
  const completed = rawCompleted.filter((index) => {
    const detail = details[index] ?? details[String(index)] ?? {};
    if (isStudyBackedCycleCompletion(detail)) return true;
    delete progress[String(index)];
    delete progress[index];
    delete details[String(index)];
    delete details[index];
    return false;
  });

  return {
    sessoesConcluidas: [...new Set(completed)].sort((a, b) => a - b),
    progressoSessoes: progress,
    sessoesConcluidasDetalhes: details,
    removedManualCheckoutCount: rawCompleted.length - completed.length,
  };
};

export const isManualCycleCheckoutRecord = (record = {}) => (
  record?.origemConclusao === 'botao_concluir'
  || record?.origem === 'checkout_manual'
);

// Registros de conclusão manual são o comprovante da ação no bloco, mas não
// representam tempo acumulado. Eles jamais podem participar de um recálculo
// de progresso, pois isso transformaria uma ação pontual em conclusão em massa.
export const isRealCycleStudyRecord = (record = {}) => {
  if (isManualCycleCheckoutRecord(record)) return false;
  // O modal de registro manual não tinha uma origem preenchida nos documentos
  // já existentes. Ausência de origem não significa ausência de estudo: todo
  // registro com minutos que não seja o checkout sintético é tempo real.
  return Number(record?.tempoEstudadoMinutos || record?.duracaoMinutos || 0) > 0;
};

// Um clique renderizado antes da abertura da próxima rodada não pode ser
// reaproveitado depois dela. O número da rodada viaja junto com o bloco que
// foi mostrado na tela e é conferido antes de qualquer escrita.
export const isCurrentCycleRound = (renderedRound, currentRound) => (
  Number.isInteger(Number(renderedRound))
  && Number(renderedRound) === Number(currentRound || 0)
);

export const buildCycleSessionCompletionUpdate = ({
  cycle = {},
  sessionIndex,
  targetCompleted,
  plannedMinutes,
  completedAt,
  updatedAt = completedAt,
  source = 'checkout_manual',
}) => {
  const index = Number(sessionIndex);
  if (!Number.isInteger(index) || index < 0) throw new Error('sessao-invalida');

  const planned = Math.max(1, Math.round(Number(plannedMinutes) || 0));
  const completed = new Set(
    (Array.isArray(cycle.sessoesConcluidas) ? cycle.sessoesConcluidas : [])
      .map(Number)
      .filter(Number.isInteger)
  );
  const progress = { ...asRecord(cycle.progressoSessoes) };
  const details = { ...asRecord(cycle.sessoesConcluidasDetalhes) };
  const currentProgress = Math.max(0, Number(progress[index] ?? progress[String(index)] ?? 0) || 0);
  const detail = details[index] ?? details[String(index)] ?? null;
  const wasCompleted = completed.has(index);
  const protectedByStudy = targetCompleted === false
    && currentProgress >= planned
    && ['registro_manual', 'timer', 'registro_estudo'].includes(String(detail?.origem || ''));

  if (protectedByStudy || targetCompleted === wasCompleted) {
    return { changed: false, protectedByStudy, update: null };
  }

  if (targetCompleted) {
    completed.add(index);
    progress[String(index)] = Math.max(currentProgress, planned);
    details[String(index)] = {
      concluidaEm: completedAt,
      atualizadoEm: updatedAt,
      origem: source,
    };
  } else {
    completed.delete(index);
    progress[String(index)] = 0;
    delete details[String(index)];
  }

  return {
    changed: true,
    protectedByStudy: false,
    update: {
      sessoesConcluidas: [...completed].sort((a, b) => a - b),
      progressoSessoes: progress,
      sessoesConcluidasDetalhes: details,
    },
  };
};
