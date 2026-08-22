import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { doc, getDocFromServer, onSnapshot } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { ACHIEVEMENTS, getLeague, getLevelProgress } from '../utils/gamification';
import { GAMIFICATION_SOURCE_SAVED_EVENT } from '../utils/gamificationRealtime';

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
  const [profile, setProfile] = useState(EMPTY_PROFILE);
  const [loading, setLoading] = useState(Boolean(uid));
  const profileRef = useRef(EMPTY_PROFILE);

  const applyProfile = useCallback((nextProfile) => {
    const normalized = { ...EMPTY_PROFILE, ...(nextProfile || {}) };
    profileRef.current = normalized;
    setProfile(normalized);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!uid) {
      setProfile(EMPTY_PROFILE);
      setLoading(false);
      return undefined;
    }
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
    let refreshGeneration = 0;
    let disposed = false;
    const profileDoc = doc(db, 'users', uid, 'gamification', 'profile');

    const timestampMillis = (value) => value?.toMillis?.() || value?.toDate?.()?.getTime?.() || 0;
    const wait = (delay) => new Promise((resolve) => window.setTimeout(resolve, delay));
    const handleSourceSaved = async (event) => {
      if (event.detail?.uid !== uid) return;
      const generation = ++refreshGeneration;
      const baselineUpdatedAt = timestampMillis(profileRef.current.updatedAt);
      const baselineTotalXP = Number(profileRef.current.totalXP || 0);

      for (const delay of [0, 400, 800, 1200, 2000, 3200]) {
        if (delay) await wait(delay);
        if (disposed || generation !== refreshGeneration) return;
        try {
          const snapshot = await getDocFromServer(profileDoc);
          if (!snapshot.exists()) continue;
          const nextProfile = snapshot.data();
          applyProfile(nextProfile);
          if (
            timestampMillis(nextProfile.updatedAt) > baselineUpdatedAt
            || Number(nextProfile.totalXP || 0) !== baselineTotalXP
          ) return;
        } catch (error) {
          if (delay === 3200) console.warn('[Gamification] Atualização direta do perfil indisponível:', error);
        }
      }
    };

    window.addEventListener(GAMIFICATION_SOURCE_SAVED_EVENT, handleSourceSaved);
    return () => {
      disposed = true;
      refreshGeneration += 1;
      window.removeEventListener(GAMIFICATION_SOURCE_SAVED_EVENT, handleSourceSaved);
    };
  }, [applyProfile, uid]);

  const levelData = useMemo(() => {
    const progress = getLevelProgress(profile.totalXP);
    const league = getLeague(profile.currentLeague || profile.league || 'iron');
    const groupIds = Array.isArray(profile.groupIds) ? profile.groupIds : [];
    const mainGroupId = groupIds.includes(profile.mainGroupId) ? profile.mainGroupId : null;
    return {
      ...progress,
      currentLevel: Number(profile.level || progress.currentLevel),
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
