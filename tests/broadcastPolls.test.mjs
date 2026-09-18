import test from 'node:test';
import assert from 'node:assert/strict';
import {
  validatePollDraft,
  isPollEffectiveClosed,
  getPollEffectiveStatus,
  calculatePollPercentages,
  isUserInBroadcastAudience,
  normalizeOptionText,
  normalizeOptionKey,
  toMillisSafe,
} from '../src/contracts/broadcastPoll.js';
import { DEFAULT_PRODUCT_LIMITS } from '../src/config/productLimits.js';

test('PRODUCT_LIMITS.polls has defined limits and is frozen', () => {
  assert.equal(DEFAULT_PRODUCT_LIMITS.polls.minOptions, 2);
  assert.equal(DEFAULT_PRODUCT_LIMITS.polls.maxOptions, 6);
  assert.equal(DEFAULT_PRODUCT_LIMITS.polls.maxTitleChars, 120);
  assert.equal(DEFAULT_PRODUCT_LIMITS.polls.maxDescriptionChars, 600);
  assert.equal(DEFAULT_PRODUCT_LIMITS.polls.maxOptionChars, 120);
  assert.equal(DEFAULT_PRODUCT_LIMITS.polls.pageSizeRespondents, 50);
  assert.equal(DEFAULT_PRODUCT_LIMITS.polls.maxHistoryItems, 100);
  assert.ok(Object.isFrozen(DEFAULT_PRODUCT_LIMITS.polls));
});

test('normalizeOptionText and normalizeOptionKey normalize properly', () => {
  assert.equal(normalizeOptionText('   Opção A   '), 'Opção A');
  assert.equal(normalizeOptionKey('  Opção A  '), 'opcao a');
  assert.equal(normalizeOptionKey('Sim! Concluído'), 'sim! concluido');
});

test('toMillisSafe converts various date formats accurately', () => {
  const now = Date.now();
  assert.equal(toMillisSafe(now), now);
  assert.equal(toMillisSafe(new Date(now)), now);
  assert.equal(toMillisSafe({ toMillis: () => now }), now);
  assert.equal(toMillisSafe({ toDate: () => new Date(now) }), now);
  assert.equal(toMillisSafe(new Date(now).toISOString()), now);
  assert.equal(toMillisSafe(null), null);
  assert.equal(toMillisSafe('invalid-date'), null);
});

test('validatePollDraft: accepts valid minimal and maximal drafts', () => {
  const futureDate = new Date(Date.now() + 3600 * 1000 * 24).toISOString();

  // Minimal valid
  const minDraft = {
    title: 'Qual simulado fazer amanhã?',
    options: ['Simulado 1', 'Simulado 2'],
  };
  const validMin = validatePollDraft(minDraft);
  assert.equal(validMin.isValid, true);
  assert.equal(validMin.errors.length, 0);
  assert.equal(validMin.normalizedOptions.length, 2);
  assert.equal(validMin.normalizedOptions[0].id, 'opt_1');
  assert.equal(validMin.normalizedOptions[0].text, 'Simulado 1');
  assert.equal(validMin.closesAtMillis, null);

  // Maximal valid with description and closesAt
  const maxDraft = {
    title: 'Qual o melhor horário para a live de revisão?',
    description: 'Votem para definirmos o horário da nossa transmissão especial.',
    options: ['18h', '19h', '20h', '21h', '22h', '23h'],
    closesAt: futureDate,
  };
  const validMax = validatePollDraft(maxDraft);
  assert.equal(validMax.isValid, true);
  assert.equal(validMax.errors.length, 0);
  assert.equal(validMax.normalizedOptions.length, 6);
  assert.equal(typeof validMax.closesAtMillis, 'number');
  assert.ok(validMax.closesAtMillis > Date.now());
});

test('validatePollDraft: rejects invalid title', () => {
  assert.equal(validatePollDraft({ title: '', options: ['A', 'B'] }).isValid, false);
  assert.equal(validatePollDraft({ title: '   ', options: ['A', 'B'] }).isValid, false);
  assert.equal(validatePollDraft({ title: null, options: ['A', 'B'] }).isValid, false);
  assert.equal(validatePollDraft({ title: 'a'.repeat(121), options: ['A', 'B'] }).isValid, false);
});

test('validatePollDraft: rejects invalid description exceeding limit', () => {
  const result = validatePollDraft({
    title: 'Título válido',
    description: 'x'.repeat(601),
    options: ['A', 'B'],
  });
  assert.equal(result.isValid, false);
  assert.ok(result.errors.some((err) => err.includes('600')));
});

test('validatePollDraft: rejects invalid options count and duplicates', () => {
  // Fewer than min options
  assert.equal(validatePollDraft({ title: 'Teste', options: ['Única'] }).isValid, false);
  assert.equal(validatePollDraft({ title: 'Teste', options: [] }).isValid, false);
  assert.equal(validatePollDraft({ title: 'Teste', options: null }).isValid, false);

  // More than max options
  assert.equal(validatePollDraft({
    title: 'Teste',
    options: ['1', '2', '3', '4', '5', '6', '7'],
  }).isValid, false);

  // Empty option text
  assert.equal(validatePollDraft({
    title: 'Teste',
    options: ['Opção 1', '   '],
  }).isValid, false);

  // Duplicate options (case-insensitive and normalized)
  const dupResult1 = validatePollDraft({
    title: 'Teste',
    options: ['Opção A', 'opção a'],
  });
  assert.equal(dupResult1.isValid, false);
  assert.ok(dupResult1.errors.some((err) => err.includes('duplicada')));

  const dupResult2 = validatePollDraft({
    title: 'Teste',
    options: ['Sim', 'Não', ' Sim  '],
  });
  assert.equal(dupResult2.isValid, false);

  // Option text length > 120 chars
  const longOptResult = validatePollDraft({
    title: 'Teste',
    options: ['Opção Normal', 'o'.repeat(121)],
  });
  assert.equal(longOptResult.isValid, false);
});

test('validatePollDraft: validates closesAt deadline format', () => {
  const invalidDateResult = validatePollDraft({
    title: 'Teste',
    options: ['A', 'B'],
    closesAt: 'data-invalida',
  });
  assert.equal(invalidDateResult.isValid, false);
  assert.ok(invalidDateResult.errors.some((err) => err.includes('inválida')));
});

test('isPollEffectiveClosed and getPollEffectiveStatus detect status accurately', () => {
  const now = Date.now();
  const pastTimestamp = { toMillis: () => now - 10000 };
  const futureTimestamp = { toMillis: () => now + 60000 };

  // Manual closed status takes precedence
  assert.equal(isPollEffectiveClosed({ status: 'closed', closesAt: futureTimestamp }, now), true);
  assert.equal(getPollEffectiveStatus({ status: 'closed' }, now), 'closed_manual');

  // Published with no closesAt -> open
  assert.equal(isPollEffectiveClosed({ status: 'open' }, now), false);
  assert.equal(getPollEffectiveStatus({ status: 'open' }, now), 'open');

  // Published with future closesAt -> open
  assert.equal(isPollEffectiveClosed({ status: 'open', closesAt: futureTimestamp }, now), false);
  assert.equal(getPollEffectiveStatus({ status: 'open', closesAt: futureTimestamp }, now), 'open');

  // Published with past closesAt -> closed
  assert.equal(isPollEffectiveClosed({ status: 'open', closesAt: pastTimestamp }, now), true);
  assert.equal(getPollEffectiveStatus({ status: 'open', closesAt: pastTimestamp }, now), 'closed_deadline');

  // Nested broadcast with poll object
  assert.equal(isPollEffectiveClosed({ poll: { status: 'closed' } }, now), true);
  assert.equal(getPollEffectiveStatus({ poll: { status: 'closed' } }, now), 'closed_manual');
  assert.equal(isPollEffectiveClosed({ poll: { status: 'open', closesAt: pastTimestamp } }, now), true);
  assert.equal(getPollEffectiveStatus({ poll: { status: 'open', closesAt: pastTimestamp } }, now), 'closed_deadline');
  assert.equal(isPollEffectiveClosed({ poll: { status: 'open', closesAt: futureTimestamp } }, now), false);
  assert.equal(getPollEffectiveStatus({ poll: { status: 'open', closesAt: futureTimestamp } }, now), 'open');
});

test('calculatePollPercentages calculates option percentages and participation rates', () => {
  const options = [
    { id: 'opt_1', text: 'Opção A' },
    { id: 'opt_2', text: 'Opção B' },
    { id: 'opt_3', text: 'Opção C' },
  ];

  // Zero responses
  const zeroStats = calculatePollPercentages({ responseCount: 0, optionCounts: {} }, options, 100);
  assert.equal(zeroStats.totalResponses, 0);
  assert.equal(zeroStats.participationRate, 0);
  assert.equal(zeroStats.optionStats.length, 3);
  assert.equal(zeroStats.optionStats[0].count, 0);
  assert.equal(zeroStats.optionStats[0].percentage, 0);
  assert.equal(zeroStats.optionStats[0].percentageLabel, '0%');

  // Mixed responses
  const results = {
    responseCount: 10,
    optionCounts: {
      opt_1: 5,
      opt_2: 3,
      opt_3: 2,
    },
  };
  const stats = calculatePollPercentages(results, options, 20);
  assert.equal(stats.totalResponses, 10);
  assert.equal(stats.participationRate, 50); // 10 / 20 = 50%
  assert.equal(stats.optionStats[0].count, 5);
  assert.equal(stats.optionStats[0].percentage, 50);
  assert.equal(stats.optionStats[0].percentageLabel, '50%');
  assert.equal(stats.optionStats[1].count, 3);
  assert.equal(stats.optionStats[1].percentage, 30);
  assert.equal(stats.optionStats[1].percentageLabel, '30%');
  assert.equal(stats.optionStats[2].count, 2);
  assert.equal(stats.optionStats[2].percentage, 20);
  assert.equal(stats.optionStats[2].percentageLabel, '20%');

  // Alternate signature fallback: (options, optionCounts, responseCount)
  const altStats = calculatePollPercentages(options, results.optionCounts, results.responseCount);
  assert.equal(altStats.totalResponses, 10);
  assert.equal(altStats.optionStats[0].count, 5);
  assert.equal(altStats.optionStats[0].percentage, 50);

  // Rounding check
  const oddResults = {
    responseCount: 3,
    optionCounts: {
      opt_1: 1,
      opt_2: 1,
      opt_3: 1,
    },
  };
  const oddStats = calculatePollPercentages(oddResults, options);
  assert.equal(oddStats.optionStats[0].percentageLabel, '33.3%');
  assert.equal(oddStats.optionStats[1].percentageLabel, '33.3%');
  assert.equal(oddStats.optionStats[2].percentageLabel, '33.3%');
});

test('isUserInBroadcastAudience matches audience segments and target uids', () => {
  // 'all' audience (or empty targetUid / targetUserIds)
  assert.equal(isUserInBroadcastAudience({ audienceMode: 'all' }, 'u1'), true);
  assert.equal(isUserInBroadcastAudience({}, 'u1'), true);
  assert.equal(isUserInBroadcastAudience({}, ''), false);

  // targetUid specific user
  assert.equal(isUserInBroadcastAudience({ targetUid: 'u1' }, 'u1'), true);
  assert.equal(isUserInBroadcastAudience({ targetUid: 'u1' }, 'u2'), false);

  // targetUserIds array
  assert.equal(isUserInBroadcastAudience({ targetUserIds: ['u1', 'u2'] }, 'u1'), true);
  assert.equal(isUserInBroadcastAudience({ targetUserIds: ['u1', 'u2'] }, 'u3'), false);
});

test('submitPollVote rejects when required parameters are missing', async () => {
  const { submitPollVote } = await import('../src/services/broadcastPollService.js');
  await assert.rejects(
    () => submitPollVote(null),
    /Parâmetros obrigatórios de votação incompletos/,
  );
  await assert.rejects(
    () => submitPollVote({ db: {}, pollId: 'p1', uid: '', optionId: 'opt_1' }),
    /Parâmetros obrigatórios de votação incompletos/,
  );
  await assert.rejects(
    () => submitPollVote({}, '', 'p1', 'opt_1'),
    /Parâmetros obrigatórios de votação incompletos/,
  );
});
