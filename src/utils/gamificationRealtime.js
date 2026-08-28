export const GAMIFICATION_SOURCE_SAVED_EVENT = 'modoqap:gamification-source-saved';
export const GAMIFICATION_SOURCE_SAVE_FAILED_EVENT = 'modoqap:gamification-source-save-failed';
export const GAMIFICATION_EVENT_CONFIRMED_EVENT = 'modoqap:gamification-event-confirmed';

export const requestGamificationRefresh = ({ uid, sourceType, sourceId, message = null, xpTotal = 0 }) => {
  if (typeof window === 'undefined' || !uid || !sourceType || !sourceId) return;
  window.dispatchEvent(new CustomEvent(GAMIFICATION_SOURCE_SAVED_EVENT, {
    detail: {
      uid,
      sourceType,
      sourceId,
      message,
      xpTotal: Math.max(0, Number(xpTotal || 0)),
    },
  }));
};

export const notifyGamificationSaveFailed = ({ uid, sourceType, sourceId }) => {
  if (typeof window === 'undefined' || !uid || !sourceType || !sourceId) return;
  window.dispatchEvent(new CustomEvent(GAMIFICATION_SOURCE_SAVE_FAILED_EVENT, {
    detail: { uid, sourceType, sourceId },
  }));
};

export const notifyGamificationEventConfirmed = ({ uid, eventId }) => {
  if (typeof window === 'undefined' || !uid || !eventId) return;
  window.dispatchEvent(new CustomEvent(GAMIFICATION_EVENT_CONFIRMED_EVENT, {
    detail: { uid, eventId },
  }));
};

export const getAcademicXPEventId = ({ sourceType, sourceId } = {}) => {
  if (!sourceType || !sourceId) return null;
  if (sourceType === 'cycle_round') {
    const [cycleId, ...roundParts] = String(sourceId).split(':');
    return roundParts.length ? `academic_cycle_round_${cycleId}_${roundParts.join(':')}` : null;
  }
  if (sourceType === 'schedule_completion') return `academic_schedule_complete_${sourceId}`;
  return `academic_${sourceType}_${sourceId}`;
};
