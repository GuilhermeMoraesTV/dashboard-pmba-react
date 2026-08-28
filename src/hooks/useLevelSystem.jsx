import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { doc, getDocFromServer, onSnapshot } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { ACHIEVEMENTS, getLeague, getLevelProgress } from '../utils/gamification';
import {
  GAMIFICATION_EVENT_CONFIRMED_EVENT,
  GAMIFICATION_SOURCE_SAVED_EVENT,
  GAMIFICATION_SOURCE_SAVE_FAILED_EVENT,
  getAcademicXPEventId,
} from '../utils/gamificationRealtime';
import {
  addOptimisticXPEntry,
  getOptimisticTotalXP,
  removeOptimisticXPEntry,
} from '../utils/optimisticXP';

const EMPTY_PROFILE = {
  totalXP: 0,
  level: 1,
  currentLeague: 'iron',
  leagueName: 'Ferro',
  weeklyCompetitiveXP: 0,
  weeklyXP: 0,
  achievementIds: [],
  achievementsSummary: { unlocked: 0, total: ACHIEVEMENTS.length },
  groupIds: [],
  mainGroupId: null,
  mainGroupName: null,
  createdGroupCount: 0,
  lastResult: null,
};

export const useLevelSystem = (user) => {
  const uid = user?.uid || null;
  const [serverProfile, setServerProfile] = useState(EMPTY_PROFILE);
  const [pendingXP, setPendingXP] = useState({});
  const [loading, setLoading] = useState(Boolean(uid));
  const profileRef = useRef(EMPTY_PROFILE);
  const pendingXPRef = useRef({});

  const applyProfile = useCallback((nextProfile) => {
    const normalized = { ...EMPTY_PROFILE, ...(nextProfile || {}) };
    profileRef.current = normalized;
    setServerProfile(normalized);
    setLoading(false);
  }, []);

  const updatePendingXP = useCallback((updater) => {
    setPendingXP((current) => {
      const next = updater(current);
      pendingXPRef.current = next;
      return next;
    });
  }, []);

  const removePendingXP = useCallback((eventId) => {
    updatePendingXP((current) => removeOptimisticXPEntry(current, eventId));
  }, [updatePendingXP]);

  useEffect(() => {
    if (!uid) {
      profileRef.current = EMPTY_PROFILE;
      pendingXPRef.current = {};
      setServerProfile(EMPTY_PROFILE);
      setPendingXP({});
      setLoading(false);
      return undefined;
    }
    pendingXPRef.current = {};
    setPendingXP({});
    setLoading(true);
    const profileDoc = doc(db, 'users', uid, 'gamification', 'profile');
    return onSnapshot(profileDoc, { includeMetadataChanges: true }, (snapshot) => {
      applyProfile(snapshot.exists() ? snapshot.data() : null);
    }, (error) => {
      console.error('[Gamification] Erro ao carregar perfil:', error);
      setLoading(false);
    });
  }, [applyProfile, uid]);

  useEffect(() => {
    if (!uid) return undefined;
    let disposed = false;
    const profileDoc = doc(db, 'users', uid, 'gamification', 'profile');

    const wait = (delay) => new Promise((resolve) => window.setTimeout(resolve, delay));
    const handleSourceSaved = async (event) => {
      if (event.detail?.uid !== uid) return;
      const eventId = getAcademicXPEventId(event.detail);
      if (!eventId) return;
      const optimisticXP = Math.max(0, Number(event.detail?.xpTotal || 0));
      if (optimisticXP > 0) {
        updatePendingXP((current) => addOptimisticXPEntry({
          pendingEntries: current,
          eventId,
          xpTotal: optimisticXP,
          currentTotalXP: getOptimisticTotalXP(profileRef.current.totalXP, current),
        }));
      }
      const eventDoc = doc(db, 'users', uid, 'gamification', 'profile', 'xp_events', eventId);

      for (const delay of [0, 400, 800, 1200, 2000, 3200]) {
        if (delay) await wait(delay);
        if (disposed) return;
        try {
          const [eventSnapshot, profileSnapshot] = await Promise.all([
            getDocFromServer(eventDoc),
            getDocFromServer(profileDoc),
          ]);
          if (profileSnapshot.exists()) applyProfile(profileSnapshot.data());
          if (eventSnapshot.exists()) {
            removePendingXP(eventId);
            return;
          }
        } catch (error) {
          if (delay === 3200) console.warn('[Gamification] Atualização direta do perfil indisponível:', error);
        }
      }
    };

    const handleEventConfirmed = async (event) => {
      if (event.detail?.uid !== uid) return;
      const eventId = String(event.detail?.eventId || '');
      if (!eventId || !pendingXPRef.current[eventId]) return;
      try {
        const snapshot = await getDocFromServer(profileDoc);
        if (!snapshot.exists()) return;
        applyProfile(snapshot.data());
        removePendingXP(eventId);
      } catch (error) {
        console.warn('[Gamification] Evento confirmado; perfil aguardando listener:', error);
      }
    };

    const handleSourceFailed = (event) => {
      if (event.detail?.uid !== uid) return;
      removePendingXP(getAcademicXPEventId(event.detail));
    };

    window.addEventListener(GAMIFICATION_SOURCE_SAVED_EVENT, handleSourceSaved);
    window.addEventListener(GAMIFICATION_EVENT_CONFIRMED_EVENT, handleEventConfirmed);
    window.addEventListener(GAMIFICATION_SOURCE_SAVE_FAILED_EVENT, handleSourceFailed);
    return () => {
      disposed = true;
      window.removeEventListener(GAMIFICATION_SOURCE_SAVED_EVENT, handleSourceSaved);
      window.removeEventListener(GAMIFICATION_EVENT_CONFIRMED_EVENT, handleEventConfirmed);
      window.removeEventListener(GAMIFICATION_SOURCE_SAVE_FAILED_EVENT, handleSourceFailed);
    };
  }, [applyProfile, removePendingXP, uid, updatePendingXP]);

  const profile = useMemo(() => {
    const totalXP = getOptimisticTotalXP(serverProfile.totalXP, pendingXP);
    if (totalXP === Number(serverProfile.totalXP || 0)) return serverProfile;
    return { ...serverProfile, totalXP, optimisticXP: true };
  }, [pendingXP, serverProfile]);

  const levelData = useMemo(() => {
    const progress = getLevelProgress(profile.totalXP);
    const league = getLeague(profile.currentLeague || profile.league || 'iron');
    const groupIds = Array.isArray(profile.groupIds) ? profile.groupIds : [];
    const mainGroupId = groupIds.includes(profile.mainGroupId) ? profile.mainGroupId : null;
    return {
      ...progress,
      currentLevel: profile.optimisticXP
        ? progress.currentLevel
        : Number(profile.level || progress.currentLevel),
      weeklyCompetitiveXP: Number(profile.weeklyCompetitiveXP ?? profile.weeklyXP ?? 0),
      weeklyXP: Number(profile.weeklyCompetitiveXP ?? profile.weeklyXP ?? 0),
      league,
      leagueId: league.id,
      leagueName: profile.leagueName || league.name,
      leagueColor: league.color,
      leagueGlow: league.glow,
      achievementsSummary: profile.achievementsSummary || EMPTY_PROFILE.achievementsSummary,
      groupIds,
      mainGroupId,
      mainGroupName: mainGroupId ? (profile.mainGroupName || null) : null,
      lastResult: profile.lastResult || null,
      profile,
      loading,
    };
  }, [loading, profile]);

  // Adaptadores sem escrita: os eventos reais chegam da fila xp_events.
  const addXP = useCallback(async () => true, []);
  const checkAndAwardMilestone = useCallback(async () => true, []);
  const processSimuladoResult = useCallback(async () => ({ queued: true }), []);

  return { levelData, profile, loading, addXP, checkAndAwardMilestone, processSimuladoResult };
};
