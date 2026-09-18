export const BRASILIA_TIMEZONE = 'America/Sao_Paulo';

const brasiliaDateFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: BRASILIA_TIMEZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/**
 * Retorna a data no formato YYYY-MM-DD garantindo o fuso de Brasília (America/Sao_Paulo).
 * Aceita Date, timestamp Firestore, string ou undefined (default = agora).
 */
export const getBrasiliaTodayKey = (referenceDate = new Date()) => {
  if (!referenceDate) return '';
  if (typeof referenceDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(referenceDate)) {
    return referenceDate;
  }
  const date = referenceDate instanceof Date
    ? referenceDate
    : (referenceDate?.toDate ? referenceDate.toDate() : (referenceDate?.seconds ? new Date(referenceDate.seconds * 1000) : new Date(referenceDate)));
  if (Number.isNaN(date.getTime())) return '';
  try {
    return brasiliaDateFormatter.format(date);
  } catch {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
};

/**
 * Retorna uma instância de Date fixada ao meio-dia (12:00:00) correspondente à data em Brasília.
 * Fixar ao meio-dia previne que eventuais conversões locais ou shifts de fuso horário (-11h a +11h)
 * mudem o dia do calendário.
 */
export const getBrasiliaToday = (referenceDate = new Date()) => {
  const key = getBrasiliaTodayKey(referenceDate);
  if (!key) return new Date();
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d, 12, 0, 0, 0);
};

export const getBrasiliaDayOfWeek = (referenceDate = new Date()) => {
  const date = getBrasiliaToday(referenceDate);
  return date.getDay();
};

export const addDaysBrasilia = (dateOrKey, days = 0) => {
  const base = typeof dateOrKey === 'string'
    ? new Date(`${dateOrKey}T12:00:00`)
    : (dateOrKey instanceof Date ? new Date(dateOrKey) : getBrasiliaToday(dateOrKey));
  base.setHours(12, 0, 0, 0);
  base.setDate(base.getDate() + Number(days || 0));
  return base;
};

export const getLocalTodayKey = (referenceDate = new Date()) => getBrasiliaTodayKey(referenceDate);

export const isPlanningDateToday = (date, now = new Date()) => {
  const dateKey = getBrasiliaTodayKey(date);
  const todayKey = getBrasiliaTodayKey(now);
  return Boolean(dateKey && todayKey && dateKey === todayKey);
};

export const clampPlanningStartDate = (value, minimumDate = getBrasiliaTodayKey()) => {
  const normalizedValue = /^\d{4}-\d{2}-\d{2}$/.test(String(value || ''))
    ? String(value)
    : minimumDate;
  return normalizedValue < minimumDate ? minimumDate : normalizedValue;
};
