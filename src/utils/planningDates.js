export const getLocalTodayKey = (referenceDate = new Date()) => {
  const date = referenceDate instanceof Date ? referenceDate : new Date(referenceDate);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const clampPlanningStartDate = (value, minimumDate = getLocalTodayKey()) => {
  const normalizedValue = /^\d{4}-\d{2}-\d{2}$/.test(String(value || ''))
    ? String(value)
    : minimumDate;
  return normalizedValue < minimumDate ? minimumDate : normalizedValue;
};
