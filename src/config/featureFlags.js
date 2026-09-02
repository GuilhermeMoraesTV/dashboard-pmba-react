const viteEnvironment = (typeof import.meta !== 'undefined' && import.meta.env)
  ? import.meta.env
  : {};

export const LOCAL_HOMOLOGATION_ENABLED = viteEnvironment.DEV === true;

export const FEATURE_FLAGS = Object.freeze({
  leagues: false,
  flashcards: LOCAL_HOMOLOGATION_ENABLED,
  questions: LOCAL_HOMOLOGATION_ENABLED,
  errorBook: LOCAL_HOMOLOGATION_ENABLED,
  documents: LOCAL_HOMOLOGATION_ENABLED,
  ankiImport: LOCAL_HOMOLOGATION_ENABLED,
  aiGenerator: false,
});

export const FLASHCARDS_ENABLED = FEATURE_FLAGS.flashcards;
export const QUESTIONS_ENABLED = FEATURE_FLAGS.questions;
export const ERROR_BOOK_ENABLED = FEATURE_FLAGS.errorBook;
export const AI_GENERATOR_ENABLED = FEATURE_FLAGS.aiGenerator;
export const DOCUMENTS_ENABLED = FEATURE_FLAGS.documents;
export const ANKI_IMPORT_ENABLED = FEATURE_FLAGS.ankiImport;

export const LEAGUES_ENABLED = FEATURE_FLAGS.leagues;

export const resolveLeagueFeatureTab = (tab) => (
  !LEAGUES_ENABLED && tab === 'ligas' ? 'ranking' : tab
);

export const resolveFeatureTab = (tab) => {
  const normalized = String(tab || 'home');
  if (!LEAGUES_ENABLED && normalized === 'ligas') return 'ranking';
  if (!FLASHCARDS_ENABLED && ['flashcards', 'decks', 'baralhos'].includes(normalized)) return 'home';
  if (!QUESTIONS_ENABLED && normalized === 'questoes') return 'home';
  if (!ERROR_BOOK_ENABLED && ['cadernoErros', 'caderno-erros'].includes(normalized)) return 'home';
  if (!DOCUMENTS_ENABLED && ['documentos', 'documents'].includes(normalized)) return 'home';
  return normalized;
};

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
