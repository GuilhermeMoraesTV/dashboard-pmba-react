const asRecord = (value) => (
  value && typeof value === 'object' && !Array.isArray(value) ? value : {}
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
