import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getQuestions,
  getQuestionById,
  submitQuestionAnswer,
  createPrivateQuestion,
  updatePrivateQuestion,
  deletePrivateQuestion,
  getUserQuestionStats,
  getUserQuestionAttempts,
  projectClientSafeOptions,
} from '../src/services/questions/questionsService.js';

test('getQuestions rejects invalid scope', async () => {
  await assert.rejects(
    () => getQuestions({ scope: 'invalid_scope' }),
    /Escopo de questao invalido/,
  );
});

test('getQuestions rejects private scope without userId', async () => {
  await assert.rejects(
    () => getQuestions({ scope: 'private' }),
    /userId e obrigatorio/,
  );
});

test('getQuestionById requires questionId', async () => {
  await assert.rejects(
    () => getQuestionById(''),
    /questionId e obrigatorio/,
  );
});

test('getQuestionById rejects invalid scope', async () => {
  await assert.rejects(
    () => getQuestionById('q-123', 'invalid'),
    /Escopo invalido/,
  );
});

test('getQuestionById rejects private scope without userId', async () => {
  await assert.rejects(
    () => getQuestionById('q-123', 'private'),
    /userId e obrigatorio/,
  );
});

test('submitQuestionAnswer validates required fields', async () => {
  await assert.rejects(
    () => submitQuestionAnswer({}),
    /questionId, questionScope e selectedOptionId validos sao obrigatorios/,
  );

  await assert.rejects(
    () => submitQuestionAnswer({ questionId: 'q-1', questionScope: 'invalid', selectedOptionId: 'A' }),
    /questionId, questionScope e selectedOptionId validos sao obrigatorios/,
  );
});

test('createPrivateQuestion validates required question and answerKey fields', async () => {
  await assert.rejects(
    () => createPrivateQuestion('user-1', {}),
    /userId, question.statement e answerKey.correctOptionId sao obrigatorios/,
  );

  await assert.rejects(
    () => createPrivateQuestion('user-1', { question: { statement: 'Enunciado' } }),
    /userId, question.statement e answerKey.correctOptionId sao obrigatorios/,
  );
});

test('updatePrivateQuestion validates required fields', async () => {
  await assert.rejects(
    () => updatePrivateQuestion('user-1', '', {}),
    /userId, questionId e question.statement sao obrigatorios/,
  );
});

test('client-safe option projection removes every answer-related field', () => {
  assert.deepEqual(projectClientSafeOptions([
    { id: 'A', text: 'Segura', isCorrect: true, correctOptionId: 'A', explanation: 'vazamento' },
  ]), [{ id: 'A', text: 'Segura' }]);
});

test('deletePrivateQuestion validates required fields', async () => {
  await assert.rejects(
    () => deletePrivateQuestion('', 'q-1'),
    /userId e questionId sao obrigatorios/,
  );

  await assert.rejects(
    () => deletePrivateQuestion('user-1', ''),
    /userId e questionId sao obrigatorios/,
  );
});

test('getUserQuestionStats requires userId', async () => {
  await assert.rejects(
    () => getUserQuestionStats(''),
    /userId e obrigatorio/,
  );
});

test('getUserQuestionAttempts requires userId', async () => {
  await assert.rejects(
    () => getUserQuestionAttempts(''),
    /userId e obrigatorio/,
  );
});
