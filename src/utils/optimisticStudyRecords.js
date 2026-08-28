export const reconcileStudyRecordSnapshot = ({
  snapshotRecords = [],
  pendingRecords = new Map(),
  hasPendingWrites = false,
} = {}) => {
  const records = Array.isArray(snapshotRecords) ? snapshotRecords : [];
  const pending = pendingRecords instanceof Map ? pendingRecords : new Map();
  const snapshotIds = new Set(records.map((record) => String(record?.id || '')).filter(Boolean));

  if (!hasPendingWrites) {
    snapshotIds.forEach((id) => pending.delete(id));
  }

  return [
    ...records,
    ...[...pending.values()].filter((record) => !snapshotIds.has(String(record?.id || ''))),
  ];
};
