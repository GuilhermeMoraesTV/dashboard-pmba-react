const asEntries = (value) => (
  value && typeof value === 'object' && !Array.isArray(value) ? value : {}
);

const nonNegativeNumber = (value) => Math.max(0, Number(value) || 0);

export const getOptimisticTotalXP = (serverTotalXP, pendingEntries = {}) => {
  const serverTotal = nonNegativeNumber(serverTotalXP);
  return Object.values(asEntries(pendingEntries)).reduce(
    (total, entry) => Math.max(total, nonNegativeNumber(entry?.optimisticTotalAfter)),
    serverTotal,
  );
};

export const addOptimisticXPEntry = ({
  pendingEntries = {},
  eventId,
  xpTotal,
  currentTotalXP,
} = {}) => {
  const entries = asEntries(pendingEntries);
  const id = String(eventId || '');
  const xp = nonNegativeNumber(xpTotal);
  if (!id || xp <= 0 || entries[id]) return entries;

  return {
    ...entries,
    [id]: {
      xpTotal: xp,
      optimisticTotalAfter: nonNegativeNumber(currentTotalXP) + xp,
    },
  };
};

export const removeOptimisticXPEntry = (pendingEntries = {}, eventId) => {
  const entries = asEntries(pendingEntries);
  const id = String(eventId || '');
  if (!id || !entries[id]) return entries;
  const next = { ...entries };
  delete next[id];
  return next;
};
