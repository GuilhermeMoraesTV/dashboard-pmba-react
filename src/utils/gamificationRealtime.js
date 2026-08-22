export const GAMIFICATION_SOURCE_SAVED_EVENT = 'modoqap:gamification-source-saved';

export const requestGamificationRefresh = ({ uid, sourceType, sourceId }) => {
  if (typeof window === 'undefined' || !uid || !sourceType || !sourceId) return;
  window.dispatchEvent(new CustomEvent(GAMIFICATION_SOURCE_SAVED_EVENT, {
    detail: {
      uid,
      sourceType,
      sourceId,
    },
  }));
};

export const getAcademicXPEventId = ({ sourceType, sourceId } = {}) => (
  sourceType && sourceId ? `academic_${sourceType}_${sourceId}` : null
);
