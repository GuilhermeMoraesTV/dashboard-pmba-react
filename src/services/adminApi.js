import { getFunctions, httpsCallable } from 'firebase/functions';
import { app } from '../firebaseConfig';
import { buildPermanentUserDeletionPayload } from '../utils/adminUserActions';

const functions = getFunctions(app, 'us-central1');

const normalizeAdminError = (error) => {
  const message = error?.message || 'Nao foi possivel concluir a operacao administrativa.';
  return new Error(message.replace(/^Firebase:\s*/i, '').replace(/\s*\(functions\/[\w-]+\)\.?$/i, ''));
};

export const callAdminOperation = async (name, payload = {}) => {
  try {
    const callable = httpsCallable(functions, name);
    const response = await callable(payload);
    return response.data;
  } catch (error) {
    throw normalizeAdminError(error);
  }
};

export const adminUpdateUserStatus = (targetUid, status) => callAdminOperation('adminUpdateUserStatus', { targetUid, status });
export const adminDeleteUserPermanently = (targetUid) => callAdminOperation(
  'adminDeleteUserPermanently',
  buildPermanentUserDeletionPayload(targetUid),
);
export const adminUpdateUserAccess = (targetUid, access) => callAdminOperation('adminUpdateUserAccess', { targetUid, access });
export const adminRecalculateUserStats = (targetUid = null) => callAdminOperation('adminRecalculateUserStats', targetUid ? { targetUid } : {});
export const adminRecomputeUserGamification = (targetUid) => callAdminOperation('adminRecomputeUserGamification', { targetUid });
export const adminSendUserNotification = (targetUid, notification) => callAdminOperation('adminSendUserNotification', { targetUid, ...notification });
export const adminSimulateLeagueClosure = (weekId) => callAdminOperation('adminSimulateLeagueClosure', { weekId });
export const adminRecomputeLeagueWeek = (weekId) => callAdminOperation('adminRecomputeLeagueWeek', { weekId });
export const adminModerateStudyGroup = (groupId, action, payload = {}) => callAdminOperation('adminModerateStudyGroup', { groupId, action, payload });
export const adminSendBroadcast = (payload) => callAdminOperation('adminSendBroadcast', payload);
export const adminExportSegment = (targetUserIds) => callAdminOperation('adminExportSegment', { targetUserIds });
