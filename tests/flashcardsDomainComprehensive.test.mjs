import test from 'node:test';
import assert from 'node:assert/strict';
import {
  QUALITY_RATINGS,
  CARD_STATUSES,
  CARD_SOURCE_TYPES,
  isValidQualityRating,
  isValidCardStatus,
  buildErrorBookEntryId,
} from '../src/contracts/index.js';
import {
  CardScheduler,
  SM2CardScheduler,
  getCardScheduler,
  registerCardScheduler,
} from '../src/services/flashcards/cardScheduler.js';
import {
  reviewCard,
  shouldCreateErrorBookEntry,
  buildFlashcardErrorBookPayload,
  getDueCards,
  getNewCards,
  createDeck,
  getDeck,
  updateDeck,
  archiveDeck,
  unarchiveDeck,
  createCard,
  getCard,
  updateCard,
  deleteCard,
  getDeckStats,
} from '../src/services/flashcards/flashcardsService.js';
import { DEFAULT_PRODUCT_LIMITS } from '../src/config/productLimits.js';

// ─── 1. SCHEDULER SM-2 & INVARIANTES ─────────────────────────────────────────

test('SM-2: createInitialState produces correct default initial state', () => {
  const scheduler = getCardScheduler('sm2');
  const initial = scheduler.createInitialState();

  assert.equal(initial.algorithm, 'sm2');
  assert.equal(initial.version, 2);
  assert.deepEqual(initial.data, {
    repetition: 0,
    interval: 0,
    easeFactor: 2.5,
    phase: 'learning',
    stepIndex: 0,
    learningStepsMinutes: [1, 10],
    relearningStepsMinutes: [1, 10],
    hardMinutes: 6,
    graduatingIntervalDays: 1,
    easyIntervalDays: 3,
  });
});

test('SM-2: Again on new card (learning) stays in learning and does not trigger lapse', () => {
  const scheduler = getCardScheduler('sm2');
  const state = scheduler.createInitialState();
  const now = new Date('2026-08-29T12:00:00.000Z');

  const result = scheduler.schedule(state, 'again', { now });

  assert.equal(result.isLapse, false);
  assert.equal(result.status, 'learning');
  assert.equal(result.nextState.data.repetition, 0);
  assert.equal(result.nextState.data.interval, 1 / 1440);
  assert.equal(result.nextState.data.easeFactor, 2.5); // Ease factor nao penalizado em card novo
  assert.equal(result.intervalMinutes, 1);
  assert.equal(result.dueAt.getTime(), now.getTime() + 60 * 1000);
});

test('SM-2: Again on consolidated review card (repetition >= 2) triggers real lapse and status relearning', () => {
  const scheduler = getCardScheduler('sm2');
  const reviewState = {
    algorithm: 'sm2',
    version: 1,
    data: {
      repetition: 3,
      interval: 15,
      easeFactor: 2.5,
    },
  };
  const now = new Date('2026-08-29T12:00:00.000Z');

  const result = scheduler.schedule(reviewState, 'again', { now });

  assert.equal(result.isLapse, true);
  assert.equal(result.status, 'relearning');
  assert.equal(result.nextState.data.repetition, 0);
  assert.equal(result.nextState.data.interval, 1 / 1440);
  assert.equal(result.nextState.data.easeFactor, 2.3); // Ease factor reduzido em 0.2 no lapse
  assert.equal(result.intervalMinutes, 1);
});

test('SM-2: Hard rating reduces ease factor by 0.15 and applies 1.2x interval scaling', () => {
  const scheduler = getCardScheduler('sm2');
  const state = {
    algorithm: 'sm2',
    version: 1,
    data: { repetition: 2, interval: 10, easeFactor: 2.5 },
  };
  const now = new Date('2026-08-29T12:00:00.000Z');

  const result = scheduler.schedule(state, 'hard', { now });

  assert.equal(result.isLapse, false);
  assert.equal(result.status, 'review');
  assert.equal(result.nextState.data.easeFactor, 2.35); // 2.5 - 0.15
  assert.equal(result.nextState.data.interval, 12); // round(10 * 1.2) = 12
  assert.equal(result.intervalDays, 12);
});

test('SM-2: Good rating standard progression across repetitions', () => {
  const scheduler = getCardScheduler('sm2');
  const now = new Date('2026-08-29T12:00:00.000Z');

  // Primeiro Good avanca ao segundo passo intradiario (10 min).
  const step1 = scheduler.schedule(scheduler.createInitialState(), 'good', { now });
  assert.equal(step1.nextState.data.repetition, 1);
  assert.equal(step1.intervalMinutes, 10);
  assert.equal(step1.status, 'learning');

  // Segundo Good conclui o learning e gradua em 1 dia.
  const step2 = scheduler.schedule(step1.nextState, 'good', { now });
  assert.equal(step2.nextState.data.repetition, 2);
  assert.equal(step2.intervalDays, 1);
  assert.equal(step2.status, 'review');

  // Em review, o SM-2 diario continua preservado.
  const step3 = scheduler.schedule(step2.nextState, 'good', { now });
  assert.equal(step3.nextState.data.repetition, 3);
  assert.equal(step3.intervalDays, 3);
  assert.equal(step3.status, 'review');
});

test('SM-2: Easy rating accelerates interval and increases ease factor by 0.15', () => {
  const scheduler = getCardScheduler('sm2');
  const now = new Date('2026-08-29T12:00:00.000Z');

  // Easy gradua diretamente em 3 dias.
  const step1 = scheduler.schedule(scheduler.createInitialState(), 'easy', { now });
  assert.equal(step1.nextState.data.repetition, 2);
  assert.equal(step1.intervalDays, 3);
  assert.equal(step1.nextState.data.easeFactor, 2.65);
  assert.equal(step1.status, 'review');

  // O rating seguinte continua no SM-2 diario.
  const step2 = scheduler.schedule(step1.nextState, 'easy', { now });
  assert.equal(step2.nextState.data.repetition, 3);
  assert.equal(step2.intervalDays, 10);
  assert.equal(step2.nextState.data.easeFactor, 2.80);
});

test('SM-2 Invariant: EaseFactor never drops below MIN_EASE_FACTOR (1.3)', () => {
  const scheduler = getCardScheduler('sm2');
  let state = {
    algorithm: 'sm2',
    version: 1,
    data: { repetition: 5, interval: 20, easeFactor: 1.4 },
  };

  // Aplica 'again' consecutivamente
  for (let i = 0; i < 5; i++) {
    const res = scheduler.schedule(state, 'again');
    state = res.nextState;
    assert.ok(state.data.easeFactor >= 1.3, `EF caiu abaixo de 1.3 na iteracao ${i}`);
  }
  assert.equal(state.data.easeFactor, 1.3);

  // Aplica 'hard' no limite minimo
  const hardRes = scheduler.schedule(state, 'hard');
  assert.equal(hardRes.nextState.data.easeFactor, 1.3);
});

test('SM-2 Invariant: intervalMinutes e sempre inteiro positivo, inclusive no intradiario', () => {
  const scheduler = getCardScheduler('sm2');
  const testStates = [
    { algorithm: 'sm2', version: 1, data: { repetition: 0, interval: 0, easeFactor: 1.3 } },
    { algorithm: 'sm2', version: 1, data: { repetition: 1, interval: 1, easeFactor: 1.3 } },
    { algorithm: 'sm2', version: 1, data: { repetition: 2, interval: 2, easeFactor: 1.3 } },
  ];

  for (const st of testStates) {
    for (const rating of QUALITY_RATINGS) {
      const out = scheduler.schedule(st, rating);
      assert.ok(Number.isInteger(out.intervalMinutes));
      assert.ok(out.intervalMinutes >= 1);
      assert.equal(out.nextState.data.interval, out.intervalDays);
      assert.ok(out.intervalDays > 0);
    }
  }
});

test('SM-2: Deterministic long progression sequence', () => {
  const scheduler = getCardScheduler('sm2');
  let current = scheduler.createInitialState();
  const base = new Date('2026-08-29T12:00:00.000Z');
  let currentDate = base;

  const ratingsSequence = ['good', 'good', 'good', 'easy', 'good', 'again', 'good', 'good'];
  const expectedMinutes = [10, 1440, 4320, 14400, 38880, 1, 10, 1440];

  for (let i = 0; i < ratingsSequence.length; i++) {
    const rating = ratingsSequence[i];
    const out = scheduler.schedule(current, rating, { now: currentDate });
    assert.equal(out.intervalMinutes, expectedMinutes[i], `Intervalo divergente no passo ${i} (${rating})`);
    current = out.nextState;
    currentDate = out.dueAt;
  }
});

test('SM-2: preview generates all 4 outcomes without mutating input state', () => {
  const scheduler = getCardScheduler('sm2');
  const inputState = {
    algorithm: 'sm2',
    version: 1,
    data: { repetition: 2, interval: 6, easeFactor: 2.5 },
  };
  const snapshotBefore = JSON.stringify(inputState);

  const preview = scheduler.preview(inputState);
  assert.equal(JSON.stringify(inputState), snapshotBefore);

  assert.ok(preview.again);
  assert.ok(preview.hard);
  assert.ok(preview.good);
  assert.ok(preview.easy);

  assert.equal(preview.again.isLapse, true);
  assert.equal(preview.again.intervalMinutes, 1);
  assert.equal(preview.hard.intervalDays, 7); // round(6 * 1.2) = 7
  assert.equal(preview.good.intervalDays, 15); // round(6 * 2.5) = 15
  assert.equal(preview.easy.intervalDays, 20); // round(6 * 2.5 * 1.3) = 19.5 -> 20
});

test('SM-2: isDue correctly evaluates cut-off targets', () => {
  const scheduler = getCardScheduler('sm2');
  const now = new Date('2026-08-29T12:00:00.000Z');

  assert.equal(scheduler.isDue({ dueAt: '2026-08-29T11:59:59.000Z' }, now), true);
  assert.equal(scheduler.isDue({ dueAt: '2026-08-29T12:00:00.000Z' }, now), true);
  assert.equal(scheduler.isDue({ dueAt: '2026-08-29T12:00:01.000Z' }, now), false);
  assert.equal(scheduler.isDue(null, now), false);
  assert.equal(scheduler.isDue({}, now), false);
});

// ─── 2. CONCORRÊNCIA, VALIDAÇÃO & CONTRATOS POSICIONAIS ──────────────────────

test('reviewCard: validates all positional arguments', async () => {
  assert.equal(reviewCard.length, 4);

  await assert.rejects(
    () => reviewCard('', 'deck1', 'card1', 'good'),
    /userId, deckId e cardId sao obrigatorios/,
  );
  await assert.rejects(
    () => reviewCard('user1', '', 'card1', 'good'),
    /userId, deckId e cardId sao obrigatorios/,
  );
  await assert.rejects(
    () => reviewCard('user1', 'deck1', '', 'good'),
    /userId, deckId e cardId sao obrigatorios/,
  );
  await assert.rejects(
    () => reviewCard('user1', 'deck1', 'card1', 'invalid_rating'),
    /Rating invalido/,
  );
  await assert.rejects(
    () => reviewCard('user1', 'deck1', 'card1', 'good', { now: 'data-invalida' }),
    /Parametro "now" invalido/,
  );
});

test('Decks service: validates input arguments for CRUD', async () => {
  await assert.rejects(() => createDeck('', { name: 'D' }), /userId e obrigatorio/);
  await assert.rejects(() => createDeck('u1', { name: '' }), /name e obrigatorio/);
  await assert.rejects(() => createDeck('u1', { name: 'Sem pasta' }), /folderId e obrigatorio/);
  await assert.rejects(() => getDeck('', 'd1'), /userId e deckId sao obrigatorios/);
  await assert.rejects(() => getDeck('u1', ''), /userId e deckId sao obrigatorios/);
  await assert.rejects(() => updateDeck('', 'd1', {}), /userId e deckId sao obrigatorios/);
  await assert.rejects(() => archiveDeck('', 'd1'), /userId e deckId sao obrigatorios/);
  await assert.rejects(() => unarchiveDeck('u1', ''), /userId e deckId sao obrigatorios/);
});

test('Cards service: validates input arguments for CRUD', async () => {
  await assert.rejects(() => createCard('', 'd1', { front: 'f', back: 'b' }), /userId e deckId sao obrigatorios/);
  await assert.rejects(() => createCard('u1', 'd1', { front: '', back: 'b' }), /front e obrigatorio/);
  await assert.rejects(() => createCard('u1', 'd1', { front: 'f', back: '' }), /back e obrigatorio/);
  await assert.rejects(() => createCard('u1', 'd1', { front: 'f', back: 'b' }), /folderId e obrigatorio/);
  await assert.rejects(() => getCard('', 'd1', 'c1'), /userId, deckId e cardId sao obrigatorios/);
  await assert.rejects(() => updateCard('u1', '', 'c1', {}), /userId, deckId e cardId sao obrigatorios/);
  await assert.rejects(() => deleteCard('u1', 'd1', ''), /userId, deckId e cardId sao obrigatorios/);
});

test('Queries service: getDueCards, getNewCards and getDeckStats validate inputs', async () => {
  await assert.rejects(() => getDueCards(''), /userId e obrigatorio/);
  await assert.rejects(() => getNewCards('', 'd1'), /userId e deckId sao obrigatorios/);
  await assert.rejects(() => getNewCards('u1', ''), /userId e deckId sao obrigatorios/);
  await assert.rejects(() => getDeckStats('', 'd1'), /userId e deckId sao obrigatorios/);
  await assert.rejects(() => getDeckStats('u1', ''), /userId e deckId sao obrigatorios/);
});

// ─── 3. INTEGRAÇÃO COM CADERNO DE ERROS ──────────────────────────────────────

test('ErrorBook: shouldCreateErrorBookEntry only returns true for again with real lapse', () => {
  assert.equal(shouldCreateErrorBookEntry('again', true), true);
  assert.equal(shouldCreateErrorBookEntry('again', false), false);
  assert.equal(shouldCreateErrorBookEntry('hard', false), false);
  assert.equal(shouldCreateErrorBookEntry('hard', true), false);
  assert.equal(shouldCreateErrorBookEntry('good', false), false);
  assert.equal(shouldCreateErrorBookEntry('easy', false), false);
});

test('ErrorBook: buildFlashcardErrorBookPayload constructs compliant payload', () => {
  const card = {
    id: 'card-999',
    deckId: 'deck-123',
    userId: 'user-001',
    front: 'O que é o princípio da legalidade?',
    back: 'Ninguém será obrigado a fazer ou deixar de fazer alguma coisa senão em virtude de lei.',
  };

  const payload = buildFlashcardErrorBookPayload('user-001', 'deck-123', card);

  assert.equal(payload.sourceType, 'flashcard');
  assert.equal(payload.sourceId, 'card-999');
  assert.equal(payload.deckId, 'deck-123');
  assert.equal(payload.isCorrectAttempt, false);
  assert.equal(payload.preview.front, card.front);
  assert.equal(payload.preview.snippet, card.back);
  assert.equal(payload.preview.title, card.front);

  // Identidade deterministica
  const errorBookId = buildErrorBookEntryId({
    sourceType: 'flashcard',
    deckId: payload.deckId,
    sourceId: payload.sourceId,
  });
  assert.equal(errorBookId, 'flashcard:deck-123:card-999');
});

// ─── 4. ANKI & GENERATED ITEMS INTEGRATION ───────────────────────────────────

test('Anki metadata adherence on Card contract', () => {
  const ankiCard = {
    id: 'card_anki_1',
    deckId: 'deck_anki_1',
    userId: 'u1',
    front: 'Pergunta Anki {{c1::Resposta}}',
    back: 'Explicação Anki',
    tags: ['direito', 'penal'],
    status: 'new',
    dueAt: new Date(),
    lapses: 0,
    reps: 0,
    schedulerState: { algorithm: 'sm2', version: 1, data: { repetition: 0, interval: 0, easeFactor: 2.5 } },
    sourceType: 'anki',
    sourceId: 'import_123',
    ankiMetadata: {
      ankiNoteGuid: 'guid-xyz-123',
      ankiNoteId: 1724800000,
      ankiCardOrd: 0,
    },
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  assert.equal(ankiCard.sourceType, 'anki');
  assert.equal(ankiCard.ankiMetadata.ankiNoteGuid, 'guid-xyz-123');
  assert.equal(ankiCard.ankiMetadata.ankiCardOrd, 0);
  assert.equal(isValidCardStatus(ankiCard.status), true);
  assert.ok(CARD_SOURCE_TYPES.includes(ankiCard.sourceType));
});

test('Generated Items: materializacao nao e exportada no bundle cliente', async () => {
  const clientModule = await import('../src/services/flashcards/flashcardsService.js');
  assert.equal('approveGeneratedFlashcard' in clientModule, false);
  assert.equal('materializeGeneratedFlashcard' in clientModule, false);
});

// ─── 5. LIMITES DE PRODUTO ───────────────────────────────────────────────────

test('Product Limits for Flashcards domain', () => {
  const limits = DEFAULT_PRODUCT_LIMITS.flashcards;

  assert.equal(limits.maxDecksPerUser, 500);
  assert.equal(limits.maxCardsPerDeck, 2000);
  assert.equal(limits.maxTagsPerCard, 10);
  assert.equal(limits.defaultNewCardsPerDay, 20);
  assert.equal(limits.defaultMaxReviewsPerDay, 100);
});

// ─── 6. IDEMPOTÊNCIA & DETERMINISMO DE REVIEW ─────────────────────────────────

test('Deterministic Review ID is stable and properly formatted', async () => {
  const { buildDeterministicReviewId } = await import('../src/services/flashcards/flashcardsService.js');
  const id1 = buildDeterministicReviewId('user1', 'deck1', 'card1', 'req-12345');
  const id2 = buildDeterministicReviewId('user1', 'deck1', 'card1', 'req-12345');
  const id3 = buildDeterministicReviewId('user1', 'deck1', 'card1', 'req-99999');

  assert.equal(id1, id2);
  assert.notEqual(id1, id3);
  assert.equal(id1, 'rev_card1_req-12345');
});

test('reviewCard: validates reviewRequestId and options parameters', async () => {
  const { syncFlashcardErrorBook } = await import('../src/services/flashcards/flashcardsService.js');
  await assert.rejects(
    () => syncFlashcardErrorBook('', { deckId: 'd1', cardId: 'c1', reviewId: 'r1' }),
    /userId, deckId, cardId e reviewId sao obrigatorios/,
  );
  await assert.rejects(
    () => syncFlashcardErrorBook('u1', { deckId: '', cardId: 'c1', reviewId: 'r1' }),
    /userId, deckId, cardId e reviewId sao obrigatorios/,
  );
  await assert.rejects(
    () => syncFlashcardErrorBook('u1', { deckId: 'd1', cardId: '', reviewId: 'r1' }),
    /userId, deckId, cardId e reviewId sao obrigatorios/,
  );
  await assert.rejects(
    () => syncFlashcardErrorBook('u1', { deckId: 'd1', cardId: 'c1', reviewId: '' }),
    /userId, deckId, cardId e reviewId sao obrigatorios/,
  );
});

test('Legacy migration: rotina estrutural nao e exportada no bundle cliente', async () => {
  const clientModule = await import('../src/services/flashcards/flashcardsService.js');
  assert.equal('migrateLegacyFlashcardsData' in clientModule, false);
});
