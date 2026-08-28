export const buildPermanentUserDeletionPayload = (targetUid) => ({
  targetUid,
  confirmed: true,
  confirmation: targetUid,
});
