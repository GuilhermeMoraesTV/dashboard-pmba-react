export const FEATURE_FLAGS = Object.freeze({
  leagues: false,
});

export const LEAGUES_ENABLED = FEATURE_FLAGS.leagues;

export const resolveLeagueFeatureTab = (tab) => (
  !LEAGUES_ENABLED && tab === 'ligas' ? 'ranking' : tab
);

export const isLeagueOnlyNotification = (notification = {}) => {
  const kind = notification.operationalKind || notification.type || '';
  return !LEAGUES_ENABLED && ['league_state', 'league_result', 'league_closing'].includes(kind);
};

export const sanitizeLeagueXPEvent = (event = {}) => {
  if (LEAGUES_ENABLED) return event;
  const identifier = String(event.sourceKey || event.id || '');
  const isLeagueReward = identifier.startsWith('reward_league_')
    || (event.category === 'reward' && Boolean(event.metadata?.leagueId));
  if (!isLeagueReward) return event;
  return { ...event, message: 'Bônus semanal recebido' };
};

export const isLeagueAchievement = (achievement = {}) => (
  !LEAGUES_ENABLED && (
    achievement.category === 'Ligas'
    || String(achievement.id || '').startsWith('league_')
    || achievement.id === 'first_league_podium'
  )
);
