const readOnlineState = () => {
  if (typeof navigator === 'undefined') return true;
  return navigator.onLine !== false;
};

export const snapshotHasData = (snapshot) => {
  if (!snapshot) return false;
  if (typeof snapshot.exists === 'function') return snapshot.exists();
  if (typeof snapshot.empty === 'boolean') return !snapshot.empty;
  return Array.isArray(snapshot.docs) && snapshot.docs.length > 0;
};

export const isUnconfirmedEmptySnapshot = (
  snapshot,
  { isOnline = readOnlineState() } = {},
) => Boolean(
  isOnline
  && snapshot?.metadata?.fromCache === true
  && !snapshotHasData(snapshot)
);

