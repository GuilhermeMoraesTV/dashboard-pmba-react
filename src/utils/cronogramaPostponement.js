const POSTPONABLE_DATE_FIELDS = ['dataInicio', 'dataFim', 'dataFechamento'];

export const normalizePostponeDays = (value) => {
  const parsed = Number.parseInt(String(value), 10);
  if (!Number.isFinite(parsed) || parsed < 1 || parsed > 365) return null;
  return parsed;
};

const parseCronogramaDate = (value) => {
  if (!value) return null;
  if (typeof value?.toDate === 'function') return value.toDate();
  if (Number.isFinite(value?.seconds)) return new Date(value.seconds * 1000);
  if (value instanceof Date) return new Date(value.getTime());
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month, day] = value.split('-').map(Number);
    return new Date(year, month - 1, day, 12);
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const formatDateKeyLocal = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const shiftDate = (value, days) => {
  const date = parseCronogramaDate(value);
  if (!date || Number.isNaN(date.getTime())) return null;
  date.setDate(date.getDate() + days);
  return formatDateKeyLocal(date);
};

export function buildCronogramaPostponement(cronograma, days = 7) {
  if (!cronograma?.dataInicio) {
    throw new Error('Cronograma sem data de inicio');
  }

  const normalizedDays = normalizePostponeDays(days);
  if (!normalizedDays) {
    throw new Error('Quantidade de dias invalida');
  }

  const previousDates = {};
  const nextDates = {};

  POSTPONABLE_DATE_FIELDS.forEach((field) => {
    if (cronograma[field] == null || cronograma[field] === '') return;
    const shifted = shiftDate(cronograma[field], normalizedDays);
    if (!shifted) {
      if (field === 'dataInicio') throw new Error('Data de inicio invalida');
      return;
    }
    previousDates[field] = cronograma[field];
    nextDates[field] = shifted;
  });

  if (!nextDates.dataInicio) throw new Error('Data de inicio invalida');

  return {
    previousDates,
    nextDates,
    days: normalizedDays,
  };
}

export function getCronogramaPostponementRestorePayload(postponement) {
  if (!postponement?.previousDates?.dataInicio) {
    throw new Error('Adiamento sem data anterior');
  }
  return { ...postponement.previousDates };
}
