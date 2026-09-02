/**
 * @fileoverview Serviço de Questões e Resoluções.
 * Validação de respostas e gabarito é estritamente server-side.
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit as firestoreLimit,
  orderBy,
  query,
  where,
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '../../firebaseConfig.js';
import { isValidQuestionScope } from '../../contracts/questions.js';
import { DEFAULT_PRODUCT_LIMITS } from '../../config/productLimits.js';

/**
 * Normaliza um documento de questão vindo do Firestore em um modelo Question client-safe.
 * @param {import('firebase/firestore').DocumentSnapshot} docSnap
 * @param {import('../../contracts/questions.js').QuestionScope} scope
 * @returns {import('../../contracts/questions.js').Question}
 */
export function projectClientSafeOptions(options) {
  if (!Array.isArray(options)) return [];
  return options.map((option) => ({
    id: String(option?.id || '').trim(),
    text: String(option?.text || ''),
  }));
}

export function normalizeQuestionDoc(docSnap, scope) {
  const data = docSnap.data() || {};
  return {
    id: docSnap.id,
    questionScope: scope,
    userId: data.userId || null,
    statement: data.statement || '',
    options: projectClientSafeOptions(data.options),
    disciplineId: data.disciplineId || 'geral',
    subject: data.subject || 'Geral',
    banca: data.banca || undefined,
    year: data.year ? Number(data.year) : undefined,
    institution: data.institution || undefined,
    difficulty: data.difficulty || 'medium',
    sourceType: data.sourceType || (scope === 'global' ? 'official' : 'manual'),
    sourceDocumentId: data.sourceDocumentId || null,
    createdAt: data.createdAt?.toDate?.() || (data.createdAt ? new Date(data.createdAt) : new Date()),
    updatedAt: data.updatedAt?.toDate?.() || (data.updatedAt ? new Date(data.updatedAt) : new Date()),
  };
}

/**
 * Consulta questões públicas (globais) ou privadas do usuário com base no filtro.
 * @param {{
 *   scope?: import('../../contracts/questions.js').QuestionScope,
 *   userId?: string,
 *   disciplineId?: string,
 *   subject?: string,
 *   banca?: string,
 *   year?: number,
 *   difficulty?: import('../../contracts/questions.js').QuestionDifficulty,
 *   limit?: number
 * }} [filter]
 * @returns {Promise<import('../../contracts/questions.js').Question[]>}
 */
export async function getQuestions(filter = {}) {
  const scope = filter.scope || 'global';
  if (!isValidQuestionScope(scope)) {
    throw new Error(`Escopo de questao invalido: ${scope}`);
  }

  if (scope === 'private' && !filter.userId) {
    throw new Error('userId e obrigatorio para consultar questoes privadas.');
  }

  const maxLimit = Math.min(
    Math.max(1, Math.floor(Number(filter.limit) || DEFAULT_PRODUCT_LIMITS.questions.maxQuestionsPerSession)),
    DEFAULT_PRODUCT_LIMITS.questions.maxQuestionsPerSession,
  );
  const listFn = httpsCallable(functions, 'listQuestions');
  const result = await listFn({
    scope,
    disciplineId: filter.disciplineId || null,
    subject: filter.subject || null,
    banca: filter.banca || null,
    year: filter.year || null,
    difficulty: filter.difficulty || null,
    limit: maxLimit,
  });
  return (Array.isArray(result.data?.questions) ? result.data.questions : []).map((question) => ({
    ...question,
    createdAt: question.createdAt ? new Date(question.createdAt) : new Date(),
    updatedAt: question.updatedAt ? new Date(question.updatedAt) : new Date(),
  }));
}

/**
 * Obtém os detalhes de uma questão segura (sem expor o gabarito).
 * @param {string} questionId ID da questão.
 * @param {import('../../contracts/questions.js').QuestionScope} [scope='global']
 * @param {string} [userId] ID do usuário caso seja questão privada.
 * @returns {Promise<import('../../contracts/questions.js').Question | null>}
 */
export async function getQuestionById(questionId, scope = 'global', userId = null) {
  if (!questionId) throw new Error('questionId e obrigatorio em getQuestionById.');
  if (!isValidQuestionScope(scope)) throw new Error(`Escopo invalido: ${scope}`);

  if (scope === 'private' && !userId) {
    throw new Error('userId e obrigatorio para questao privada.');
  }

  const docRef = scope === 'private'
    ? doc(db, 'users', userId, 'questions', questionId)
    : doc(db, 'questions', questionId);

  const snap = await getDoc(docRef);
  if (!snap.exists()) return null;

  return normalizeQuestionDoc(snap, scope);
}

/**
 * Submete uma resposta para validação server-side via Cloud Function.
 * O gabarito e a explicação são revelados somente após a validação no servidor.
 * @param {import('../../contracts/questions.js').SubmitQuestionAnswerRequest} request
 * @returns {Promise<import('../../contracts/questions.js').SubmitQuestionAnswerResponse>}
 */
export async function submitQuestionAnswer(request) {
  if (!request?.questionId || !request?.selectedOptionId || !isValidQuestionScope(request?.questionScope)) {
    throw new Error('questionId, questionScope e selectedOptionId validos sao obrigatorios em submitQuestionAnswer.');
  }

  try {
    const submitFn = httpsCallable(functions, 'submitQuestionAnswer');
    const result = await submitFn({
      questionId: request.questionId,
      questionScope: request.questionScope,
      selectedOptionId: request.selectedOptionId,
      timeSpentSeconds: Number(request.timeSpentSeconds || 0),
    });

    return /** @type {import('../../contracts/questions.js').SubmitQuestionAnswerResponse} */ (result.data);
  } catch (error) {
    console.error('[QuestionsService] Falha ao submeter resposta:', error);
    throw error;
  }
}

/**
 * Cria uma questão privada através da Cloud Function segura.
 * Caminho: users/{userId}/questions/{questionId}
 * @param {string} userId
 * @param {import('../../contracts/questions.js').UpsertPrivateQuestionRequest} request
 * @returns {Promise<import('../../contracts/questions.js').Question>}
 */
export async function createPrivateQuestion(userId, request) {
  const questionData = request?.question;
  if (!userId || !questionData?.statement || !request?.answerKey?.correctOptionId) {
    throw new Error('userId, question.statement e answerKey.correctOptionId sao obrigatorios para criar questao privada.');
  }

  try {
    const upsertFn = httpsCallable(functions, 'upsertPrivateQuestion');
    const result = await upsertFn({
      question: request.question,
      answerKey: request.answerKey,
    });

    return /** @type {import('../../contracts/questions.js').Question} */ (result.data);
  } catch (error) {
    console.error('[QuestionsService] Falha ao criar questao privada:', error);
    throw error;
  }
}

/**
 * Atualiza uma questão privada existente via Cloud Function segura.
 * @param {string} userId
 * @param {string} questionId
 * @param {import('../../contracts/questions.js').UpsertPrivateQuestionRequest} request
 * @returns {Promise<import('../../contracts/questions.js').Question>}
 */
export async function updatePrivateQuestion(userId, questionId, request) {
  if (!userId || !questionId || !request?.question?.statement) {
    throw new Error('userId, questionId e question.statement sao obrigatorios para atualizar questao.');
  }

  try {
    const upsertFn = httpsCallable(functions, 'upsertPrivateQuestion');
    const result = await upsertFn({
      questionId,
      question: request.question,
      ...(request.answerKey ? { answerKey: request.answerKey } : {}),
    });

    return /** @type {import('../../contracts/questions.js').Question} */ (result.data);
  } catch (error) {
    console.error('[QuestionsService] Falha ao atualizar questao privada:', error);
    throw error;
  }
}

/**
 * Exclui uma questão privada via Cloud Function segura.
 * @param {string} userId
 * @param {string} questionId
 * @returns {Promise<{ ok: boolean, questionId: string }>}
 */
export async function deletePrivateQuestion(userId, questionId) {
  if (!userId || !questionId) {
    throw new Error('userId e questionId sao obrigatorios para excluir questao.');
  }

  try {
    const deleteFn = httpsCallable(functions, 'deletePrivateQuestion');
    const result = await deleteFn({ questionId });
    return result.data;
  } catch (error) {
    console.error('[QuestionsService] Falha ao excluir questao privada:', error);
    throw error;
  }
}

/**
 * Consulta as estatísticas consolidadas de questões do usuário.
 * @param {string} userId
 * @returns {Promise<import('../../contracts/questions.js').QuestionStatsEntity>}
 */
export async function getUserQuestionStats(userId) {
  if (!userId) throw new Error('userId e obrigatorio em getUserQuestionStats.');

  const statsRef = doc(db, 'users', userId, 'question_stats', 'summary');
  const snap = await getDoc(statsRef);

  if (!snap.exists()) {
    return {
      questionsResolved: 0,
      correctResolved: 0,
      incorrectResolved: 0,
      accuracy: 0,
      totalAttemptEvents: 0,
      totalAttempts: 0,
      correctAttempts: 0,
      wrongAttempts: 0,
      totalXpEarned: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }

  const data = snap.data() || {};
  const totalAttemptEvents = Number(data.totalAttemptEvents ?? data.totalAttempts ?? 0);
  const questionsResolved = Number(data.questionsResolved ?? data.questions ?? totalAttemptEvents);
  const correctResolved = Number(data.correctResolved ?? data.correctFirstAttempts ?? data.correctAttempts ?? 0);
  const incorrectResolved = Number(data.incorrectResolved ?? data.incorrectFirstAttempts ?? data.wrongAttempts ?? 0);
  const accuracy = questionsResolved > 0
    ? Number(((correctResolved / questionsResolved) * 100).toFixed(2))
    : 0;

  return {
    questionsResolved,
    correctResolved,
    incorrectResolved,
    accuracy,
    totalAttemptEvents,
    totalAttempts: totalAttemptEvents,
    correctAttempts: Number(data.correctAttempts ?? 0),
    wrongAttempts: Number(data.wrongAttempts ?? 0),
    totalXpEarned: Number(data.totalXpEarned || 0),
    createdAt: data.createdAt?.toDate?.() || new Date(),
    updatedAt: data.updatedAt?.toDate?.() || new Date(),
  };
}

/**
 * Consulta as tentativas recentes de resolução de questões do usuário.
 * @param {string} userId
 * @param {number} [limitCount=50]
 * @returns {Promise<import('../../contracts/questions.js').QuestionAttempt[]>}
 */
export async function getUserQuestionAttempts(userId, limitCount = 50) {
  if (!userId) throw new Error('userId e obrigatorio em getUserQuestionAttempts.');

  const attemptsRef = collection(db, 'users', userId, 'question_attempts');
  const safeLimit = Math.min(
    Math.max(1, Math.floor(Number(limitCount) || DEFAULT_PRODUCT_LIMITS.questions.maxQuestionsPerSession)),
    DEFAULT_PRODUCT_LIMITS.questions.maxQuestionsPerSession,
  );
  const q = query(attemptsRef, orderBy('attemptedAt', 'desc'), firestoreLimit(safeLimit));
  const snap = await getDocs(q);

  return snap.docs.map((d) => {
    const data = d.data() || {};
    return {
      id: d.id,
      questionId: data.questionId,
      questionScope: data.questionScope,
      userId: data.userId,
      selectedOptionId: data.selectedOptionId,
      correctOptionId: data.correctOptionId,
      isCorrect: Boolean(data.isCorrect),
      timeSpentSeconds: Number(data.timeSpentSeconds || 0),
      xpEarned: Number(data.xpEarned || 0),
      attemptedAt: data.attemptedAt?.toDate?.() || (data.attemptedAt ? new Date(data.attemptedAt) : new Date()),
    };
  });
}
