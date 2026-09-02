import test from 'node:test';
import assert from 'node:assert/strict';
import {
  AI_GENERATOR_ENABLED,
  ANKI_IMPORT_ENABLED,
  DOCUMENTS_ENABLED,
  FLASHCARDS_ENABLED,
  LEAGUES_ENABLED,
  QUESTIONS_ENABLED,
  ERROR_BOOK_ENABLED,
  isLeagueAchievement,
  isLeagueOnlyNotification,
  resolveLeagueFeatureTab,
  resolveFeatureTab,
  sanitizeLeagueXPEvent,
} from '../src/config/featureFlags.js';

test('league exposure is paused and direct navigation falls back to ranking', () => {
  assert.equal(LEAGUES_ENABLED, false);
  assert.equal(resolveLeagueFeatureTab('ligas'), 'ranking');
  assert.equal(resolveLeagueFeatureTab('ranking'), 'ranking');
  assert.equal(resolveLeagueFeatureTab('grupos'), 'grupos');
});

test('local-only study surfaces stay disabled outside Vite development mode', () => {
  assert.equal(QUESTIONS_ENABLED, false);
  assert.equal(ERROR_BOOK_ENABLED, false);
  assert.equal(DOCUMENTS_ENABLED, false);
  assert.equal(FLASHCARDS_ENABLED, false);
  assert.equal(ANKI_IMPORT_ENABLED, false);
  assert.equal(AI_GENERATOR_ENABLED, false);
  assert.equal(resolveFeatureTab('questoes'), 'home');
  assert.equal(resolveFeatureTab('cadernoErros'), 'home');
  assert.equal(resolveFeatureTab('caderno-erros'), 'home');
  assert.equal(resolveFeatureTab('documentos'), 'home');
  assert.equal(resolveFeatureTab('documents'), 'home');
  assert.equal(resolveFeatureTab('flashcards'), 'home');
  assert.equal(resolveFeatureTab('decks'), 'home');
  assert.equal(resolveFeatureTab('baralhos'), 'home');
});

test('league-only notifications are hidden while other operational events remain visible', () => {
  assert.equal(isLeagueOnlyNotification({ type: 'league_state' }), true);
  assert.equal(isLeagueOnlyNotification({ operationalKind: 'league_result' }), true);
  assert.equal(isLeagueOnlyNotification({ type: 'group_request' }), false);
  assert.equal(isLeagueOnlyNotification({ type: 'xp' }), false);
});

test('league rewards keep their XP payload but use neutral copy', () => {
  const reward = {
    id: 'reward_league_2026-W34_iron-0001_1',
    category: 'reward',
    message: '1º lugar na Liga Ferro',
    xpTotal: 100,
    metadata: { leagueId: 'iron' },
  };
  const sanitized = sanitizeLeagueXPEvent(reward);

  assert.equal(sanitized.message, 'Bônus semanal recebido');
  assert.equal(sanitized.xpTotal, 100);
  assert.equal(sanitized.metadata.leagueId, 'iron');
  assert.equal(reward.message, '1º lugar na Liga Ferro');
});

test('league achievements are omitted without changing the remaining catalog', () => {
  assert.equal(isLeagueAchievement({ id: 'league_gold', category: 'Ligas' }), true);
  assert.equal(isLeagueAchievement({ id: 'first_league_podium', category: 'Competição' }), true);
  assert.equal(isLeagueAchievement({ id: 'general_top_10', category: 'Ranking' }), false);
});
