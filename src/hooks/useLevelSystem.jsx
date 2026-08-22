import { useCallback, useEffect, useMemo, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { ACHIEVEMENTS, getLeague, getLevelProgress } from '../utils/gamification';

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

  useEffect(() => {
    if (!uid) {
      setProfile(EMPTY_PROFILE);
      setLoading(false);
      return undefined;
    }
    setLoading(true);
    return onSnapshot(doc(db, 'users', uid, 'gamification', 'profile'), (snapshot) => {
      setProfile({ ...EMPTY_PROFILE, ...(snapshot.exists() ? snapshot.data() : {}) });
      setLoading(false);
    }, (error) => {
      console.error('[Gamification] Erro ao carregar perfil:', error);
      setLoading(false);
    });
  }, [uid]);

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
