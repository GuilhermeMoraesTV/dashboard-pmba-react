export const normalizeReviewText = (value) =>
  String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

export const getReviewPlannedMinutes = (review, fallbackMinutes = 20) =>
  Math.max(1, Math.round(Number(review?.tempoMinutos ?? review?.minutosEstudo ?? fallbackMinutes) || fallbackMinutes));

export const applyReviewProgress = ({
  currentMinutes = 0,
  plannedMinutes = 0,
  addedMinutes = 0,
  wasDone = false,
}) => {
  const planned = Math.max(1, Math.round(Number(plannedMinutes) || 0));
  const current = Math.max(0, Math.round(Number(currentMinutes) || 0));
  const added = Math.max(0, Math.round(Number(addedMinutes) || 0));
  const base = wasDone ? Math.max(current, planned) : current;
  const nextProgress = base + added;

  return {
    appliedMinutes: added,
    nextProgress,
    done: nextProgress >= planned,
  };
};
