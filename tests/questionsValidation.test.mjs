import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const questionValidation = require('../functions/questions/validation.js');

test('processQuestionAnswerSubmission rejects unauthenticated call', async () => {
  await assert.rejects(
    () => questionValidation.processQuestionAnswerSubmission({
      uid: '',
      questionId: 'q-1',
      questionScope: 'global',
      selectedOptionId: 'A',
    }),
    /Usuario nao autenticado/,
  );
});

test('listQuestions rejects unauthenticated and invalid scopes before querying Firestore', async () => {
  await assert.rejects(
    () => questionValidation.listQuestions({ uid: '', data: { scope: 'private' } }),
    (error) => error.code === 'unauthenticated',
  );
  await assert.rejects(
    () => questionValidation.listQuestions({ uid: 'user-1', data: { scope: 'invalid' } }),
    (error) => error.code === 'invalid-argument',
  );
});

test('processQuestionAnswerSubmission rejects missing parameters', async () => {
  await assert.rejects(
    () => questionValidation.processQuestionAnswerSubmission({
      uid: 'user-1',
      questionId: '',
      questionScope: 'global',
      selectedOptionId: 'A',
    }),
    /questionId, questionScope e selectedOptionId validos sao obrigatorios/,
  );

  await assert.rejects(
    () => questionValidation.processQuestionAnswerSubmission({
      uid: 'user-1',
      questionId: 'q-1',
      questionScope: 'invalid_scope',
      selectedOptionId: 'A',
    }),
    /questionId, questionScope e selectedOptionId validos sao obrigatorios/,
  );

  await assert.rejects(
    () => questionValidation.processQuestionAnswerSubmission({
      uid: 'user-1',
      questionId: 'q-1',
      questionScope: 'global',
      selectedOptionId: '',
    }),
    /questionId, questionScope e selectedOptionId validos sao obrigatorios/,
  );
});

test('upsertPrivateQuestion validates input payload', async () => {
  await assert.rejects(
    () => questionValidation.upsertPrivateQuestion({ uid: '', data: {} }),
    /Usuario nao autenticado/,
  );

  await assert.rejects(
    () => questionValidation.upsertPrivateQuestion({
      uid: 'user-1',
      data: { question: { statement: '' } },
    }),
    /statement e obrigatorio/,
  );

  await assert.rejects(
    () => questionValidation.upsertPrivateQuestion({
      uid: 'user-1',
      data: { question: { statement: 'Enunciado', options: [{ id: 'A', text: 'Opt A' }] } },
    }),
    /A questao deve possuir entre 2 e 5 alternativas/,
  );

  await assert.rejects(
    () => questionValidation.upsertPrivateQuestion({
      uid: 'user-1',
      data: {
        question: {
          statement: 'Enunciado',
          options: [{ id: 'A', text: 'Opt A' }, { id: 'B', text: 'Opt B' }],
        },
        answerKey: { correctOptionId: 'C' },
      },
    }),
    /Gabarito correto deve corresponder a exatamente uma alternativa/,
  );
});

const validQuestion = {
  statement: 'Enunciado valido',
  options: [{ id: 'A', text: 'Opcao A' }, { id: 'B', text: 'Opcao B' }],
  disciplineId: 'direito',
  subject: 'Constitucional',
  difficulty: 'medium',
  sourceType: 'manual',
};

test('question authoring rejects duplicate IDs, invalid counts and nonexistent answer', () => {
  assert.throws(
    () => questionValidation.normalizeQuestionAuthoringPayload({
      ...validQuestion,
      options: [{ id: 'A', text: 'Uma' }, { id: 'A', text: 'Duas' }],
    }, { correctOptionId: 'A' }, undefined),
    /ID de alternativa duplicado/,
  );
  assert.throws(
    () => questionValidation.normalizeQuestionAuthoringPayload({ ...validQuestion, options: [{ id: 'A', text: 'Uma' }] }, { correctOptionId: 'A' }, undefined),
    /entre 2 e 5 alternativas/,
  );
  assert.throws(
    () => questionValidation.normalizeQuestionAuthoringPayload({
      ...validQuestion,
      options: Array.from({ length: 6 }, (_, index) => ({ id: String(index), text: `Opcao ${index}` })),
    }, { correctOptionId: '0' }, undefined),
    /entre 2 e 5 alternativas/,
  );
  assert.throws(
    () => questionValidation.normalizeQuestionAuthoringPayload(validQuestion, { correctOptionId: 'C' }, undefined),
    /exatamente uma alternativa/,
  );
});

test('question authoring rejects answer metadata embedded in client-safe options', () => {
  assert.throws(
    () => questionValidation.normalizeQuestionAuthoringPayload({
      ...validQuestion,
      options: [{ id: 'A', text: 'Uma', isCorrect: true }, { id: 'B', text: 'Duas' }],
    }, { correctOptionId: 'A' }, undefined),
    /options\[0\] contem campos nao permitidos: isCorrect/,
  );
  assert.throws(
    () => questionValidation.normalizeQuestionAuthoringPayload({
      ...validQuestion,
      options: [{ id: 'A', text: 'Uma', correctOptionId: 'A' }, { id: 'B', text: 'Duas' }],
    }, { correctOptionId: 'A' }, undefined),
    /options\[0\] contem campos nao permitidos: correctOptionId/,
  );
});

test('deletePrivateQuestion validates input parameters', async () => {
  await assert.rejects(
    () => questionValidation.deletePrivateQuestion({ uid: '', questionId: 'q-1' }),
    /Usuario nao autenticado/,
  );

  await assert.rejects(
    () => questionValidation.deletePrivateQuestion({ uid: 'user-1', questionId: '' }),
    /questionId e obrigatorio/,
  );
});

test('deterministicDocumentId generates consistent deterministic SHA256 hashes', () => {
  const hash1 = questionValidation.deterministicDocumentId(['global', 'q-1', 'A']);
  const hash2 = questionValidation.deterministicDocumentId(['global', 'q-1', 'A']);
  const hashDiffOpt = questionValidation.deterministicDocumentId(['global', 'q-1', 'B']);
  const rewardHash = questionValidation.deterministicDocumentId(['global', 'q-1']);

  assert.equal(hash1, hash2);
  assert.notEqual(hash1, hashDiffOpt);
  assert.notEqual(hash1, rewardHash);
  assert.equal(typeof hash1, 'string');
  assert.equal(hash1.length, 64);
});
