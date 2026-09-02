/**
 * @fileoverview Validação server-side de submissão de respostas de questões.
 * O conteúdo client-safe e o answerKey ficam em documentos distintos.
 */

const { HttpsError } = require('firebase-functions/v2/https');
const admin = require('firebase-admin');
const crypto = require('crypto');
const { getProductLimits, DEFAULT_SERVER_PRODUCT_LIMITS } = require('../shared/productLimits');
const gamificationService = require('../gamification/service');

const errorBookIdentityModule = import('../shared/errorBookIdentity.mjs');
const VALID_SCOPES = new Set(['global', 'private']);
const VALID_DIFFICULTIES = new Set(['easy', 'medium', 'hard']);
const VALID_PRIVATE_SOURCE_TYPES = new Set(['manual', 'ai', 'imported']);
const QUESTION_FIELDS = new Set([
  'statement', 'options', 'disciplineId', 'subject', 'banca', 'year',
  'institution', 'difficulty', 'sourceType', 'sourceDocumentId',
]);
const ANSWER_KEY_FIELDS = new Set(['correctOptionId', 'explanation']);
const UPSERT_FIELDS = new Set(['questionId', 'question', 'answerKey']);
const LIST_FIELDS = new Set([
  'scope', 'disciplineId', 'subject', 'banca', 'year', 'difficulty', 'limit',
]);

function assertAllowedFields(value, allowedFields, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new HttpsError('invalid-argument', `${label} deve ser um objeto.`);
  }
  const unexpected = Object.keys(value).filter((key) => !allowedFields.has(key));
  if (unexpected.length) {
    throw new HttpsError('invalid-argument', `${label} contem campos nao permitidos: ${unexpected.join(', ')}.`);
  }
}

function boundedString(value, { field, required = false, maxLength }) {
  const normalized = value == null ? '' : String(value).trim();
  if (required && !normalized) {
    throw new HttpsError('invalid-argument', `${field} e obrigatorio.`);
  }
  if (normalized.length > maxLength) {
    throw new HttpsError('invalid-argument', `${field} excede o limite de ${maxLength} caracteres.`);
  }
  return normalized;
}

function deterministicDocumentId(parts) {
  return crypto.createHash('sha256').update(parts.map((part) => String(part)).join('\u0000')).digest('hex');
}

function toTransportDate(value) {
  const date = value?.toDate?.();
  return date instanceof Date && !Number.isNaN(date.getTime()) ? date.toISOString() : null;
}

function projectClientSafeQuestion(snapshot, scope) {
  const data = snapshot.data() || {};
  const options = Array.isArray(data.options)
    ? data.options.map((option) => ({
      id: String(option?.id || '').trim(),
      text: String(option?.text || ''),
    }))
    : [];
  return {
    id: snapshot.id,
    questionScope: scope,
    userId: scope === 'private' ? String(data.userId || '') : null,
    statement: String(data.statement || ''),
    options,
    disciplineId: String(data.disciplineId || 'geral'),
    subject: String(data.subject || 'Geral'),
    banca: data.banca == null ? null : String(data.banca),
    year: Number.isFinite(Number(data.year)) ? Number(data.year) : null,
    institution: data.institution == null ? null : String(data.institution),
    difficulty: VALID_DIFFICULTIES.has(data.difficulty) ? data.difficulty : 'medium',
    sourceType: String(data.sourceType || (scope === 'global' ? 'official' : 'manual')),
    sourceDocumentId: data.sourceDocumentId == null ? null : String(data.sourceDocumentId),
    createdAt: toTransportDate(data.createdAt),
    updatedAt: toTransportDate(data.updatedAt),
  };
}

async function listQuestions({ uid, data }) {
  if (!uid) throw new HttpsError('unauthenticated', 'Usuario nao autenticado.');
  assertAllowedFields(data || {}, LIST_FIELDS, 'payload');
  const scope = data?.scope || 'global';
  if (!VALID_SCOPES.has(scope)) throw new HttpsError('invalid-argument', 'scope invalido.');

  const db = admin.firestore();
  const productLimits = await getProductLimits(db);
  const maxAllowed = Number(productLimits?.questions?.maxQuestionsPerSession)
    || DEFAULT_SERVER_PRODUCT_LIMITS.questions.maxQuestionsPerSession;
  const requestedLimit = Math.floor(Number(data?.limit) || maxAllowed);
  const resultLimit = Math.min(Math.max(1, requestedLimit), maxAllowed);
  let questionsQuery = scope === 'private'
    ? db.collection('users').doc(uid).collection('questions').where('userId', '==', uid)
    : db.collection('questions');

  if (data?.disciplineId) questionsQuery = questionsQuery.where('disciplineId', '==', String(data.disciplineId).trim());
  if (data?.subject) questionsQuery = questionsQuery.where('subject', '==', String(data.subject).trim());
  if (data?.banca) questionsQuery = questionsQuery.where('banca', '==', String(data.banca).trim());
  if (data?.difficulty) {
    if (!VALID_DIFFICULTIES.has(data.difficulty)) throw new HttpsError('invalid-argument', 'difficulty invalida.');
    questionsQuery = questionsQuery.where('difficulty', '==', data.difficulty);
  }
  if (data?.year) {
    const year = Number(data.year);
    if (!Number.isInteger(year)) throw new HttpsError('invalid-argument', 'year invalido.');
    questionsQuery = questionsQuery.where('year', '==', year);
  }

  const snapshot = await questionsQuery.limit(resultLimit).get();
  return { questions: snapshot.docs.map((item) => projectClientSafeQuestion(item, scope)) };
}

function normalizeQuestionAuthoringPayload(questionData, answerKeyData, limits, { answerKeyRequired = true } = {}) {
  assertAllowedFields(questionData, QUESTION_FIELDS, 'question');
  if (answerKeyData != null) assertAllowedFields(answerKeyData, ANSWER_KEY_FIELDS, 'answerKey');
  const questionLimits = { ...DEFAULT_SERVER_PRODUCT_LIMITS.questions, ...(limits?.questions || {}) };
  const statement = boundedString(questionData.statement, {
    field: 'statement', required: true, maxLength: questionLimits.maxStatementChars,
  });
  const rawOptions = Array.isArray(questionData.options) ? questionData.options : [];
  if (rawOptions.length < questionLimits.minOptionsPerQuestion || rawOptions.length > questionLimits.maxOptionsPerQuestion) {
    throw new HttpsError(
      'invalid-argument',
      `A questao deve possuir entre ${questionLimits.minOptionsPerQuestion} e ${questionLimits.maxOptionsPerQuestion} alternativas.`,
    );
  }

  const optionIds = new Set();
  const options = rawOptions.map((option, index) => {
    assertAllowedFields(option, new Set(['id', 'text']), `options[${index}]`);
    const id = boundedString(option.id, {
      field: `options[${index}].id`, required: true, maxLength: 80,
    });
    if (optionIds.has(id)) {
      throw new HttpsError('invalid-argument', `ID de alternativa duplicado: ${id}.`);
    }
    optionIds.add(id);
    const text = boundedString(option.text, {
      field: `options[${index}].text`, required: true, maxLength: questionLimits.maxOptionTextChars,
    });
    return { id, text };
  });

  if (answerKeyRequired && answerKeyData == null) {
    throw new HttpsError('invalid-argument', 'answerKey e obrigatorio na criacao da questao.');
  }

  let normalizedAnswerKey = null;
  if (answerKeyData != null) {
    const correctOptionId = boundedString(answerKeyData.correctOptionId, {
      field: 'answerKey.correctOptionId', required: true, maxLength: 80,
    });
    if (options.filter((option) => option.id === correctOptionId).length !== 1) {
      throw new HttpsError('invalid-argument', 'Gabarito correto deve corresponder a exatamente uma alternativa.');
    }
    normalizedAnswerKey = {
      correctOptionId,
      explanation: boundedString(answerKeyData.explanation, {
        field: 'answerKey.explanation', maxLength: questionLimits.maxExplanationChars,
      }),
    };
  }

  const disciplineId = boundedString(questionData.disciplineId, {
    field: 'disciplineId', required: true, maxLength: questionLimits.maxDisciplineIdChars,
  });
  const subject = boundedString(questionData.subject, {
    field: 'subject', required: true, maxLength: questionLimits.maxSubjectChars,
  });
  const difficulty = questionData.difficulty == null ? 'medium' : String(questionData.difficulty);
  if (!VALID_DIFFICULTIES.has(difficulty)) {
    throw new HttpsError('invalid-argument', 'difficulty invalida.');
  }
  const sourceType = questionData.sourceType == null ? 'manual' : String(questionData.sourceType);
  if (!VALID_PRIVATE_SOURCE_TYPES.has(sourceType)) {
    throw new HttpsError('invalid-argument', 'sourceType invalido para questao privada.');
  }

  let year;
  if (questionData.year != null && questionData.year !== '') {
    year = Number(questionData.year);
    const maxYear = new Date().getUTCFullYear() + 1;
    if (!Number.isInteger(year) || year < 1900 || year > maxYear) {
      throw new HttpsError('invalid-argument', `year deve ser um inteiro entre 1900 e ${maxYear}.`);
    }
  }

  const optionalMetadata = (field) => {
    const value = boundedString(questionData[field], {
      field, maxLength: questionLimits.maxMetadataChars,
    });
    return value || undefined;
  };
  const banca = optionalMetadata('banca');
  const institution = optionalMetadata('institution');
  const sourceDocumentId = optionalMetadata('sourceDocumentId');

  return {
    question: {
      statement,
      options,
      disciplineId,
      subject,
      difficulty,
      sourceType,
      ...(banca ? { banca } : {}),
      ...(year ? { year } : {}),
      ...(institution ? { institution } : {}),
      ...(sourceDocumentId ? { sourceDocumentId } : {}),
    },
    answerKey: normalizedAnswerKey,
  };
}

function questionRefs(db, uid, questionId, questionScope) {
  const questionRef = questionScope === 'private'
    ? db.collection('users').doc(uid).collection('questions').doc(questionId)
    : db.collection('questions').doc(questionId);
  return {
    questionRef,
    answerKeyRef: questionRef.collection('private').doc('answerKey'),
  };
}

/**
 * Valida a resposta, persiste a tentativa e atualiza agregados derivados.
 * @param {object} params
 * @param {string} params.uid UID autenticado.
 * @param {string} params.questionId ID da questão.
 * @param {'global' | 'private'} params.questionScope Escopo da questão.
 * @param {string} params.selectedOptionId Alternativa escolhida.
 * @param {number} [params.timeSpentSeconds] Tempo informado pelo client.
 * @returns {Promise<object>}
 */
async function processQuestionAnswerSubmission({ uid, questionId, questionScope, selectedOptionId, timeSpentSeconds = 0 }) {
  if (!uid) throw new HttpsError('unauthenticated', 'Usuario nao autenticado.');
  if (!questionId || !selectedOptionId || !VALID_SCOPES.has(questionScope)) {
    throw new HttpsError('invalid-argument', 'questionId, questionScope e selectedOptionId validos sao obrigatorios.');
  }

  const normalizedQuestionId = String(questionId).trim();
  const normalizedSelectedOptionId = String(selectedOptionId).trim();
  if (!normalizedQuestionId || normalizedQuestionId.length > 1500 || !normalizedSelectedOptionId || normalizedSelectedOptionId.length > 80) {
    throw new HttpsError('invalid-argument', 'questionId ou selectedOptionId invalido.');
  }
  const normalizedTimeSpentSeconds = Math.max(0, Math.min(Number(timeSpentSeconds) || 0, 24 * 60 * 60));
  const db = admin.firestore();
  const { questionRef, answerKeyRef } = questionRefs(db, uid, normalizedQuestionId, questionScope);
  const userRef = db.collection('users').doc(uid);
  const attemptId = deterministicDocumentId([questionScope, normalizedQuestionId, normalizedSelectedOptionId]);
  const rewardSourceId = deterministicDocumentId([questionScope, normalizedQuestionId]);
  const attemptRef = userRef.collection('question_attempts').doc(attemptId);
  const rewardSourceRef = userRef.collection('question_reward_sources').doc(rewardSourceId);
  const statsRef = userRef.collection('question_stats').doc('summary');
  const { buildErrorBookEntryId } = await errorBookIdentityModule;
  const errorEntryId = buildErrorBookEntryId({ sourceType: 'question', sourceId: normalizedQuestionId, questionScope });
  const errorEntryRef = userRef.collection('error_book').doc(errorEntryId);

  const transactionResult = await db.runTransaction(async (transaction) => {
    const [questionSnap, answerKeySnap, attemptSnap, rewardSourceSnap, statsSnap, errorEntrySnap] = await Promise.all([
      transaction.get(questionRef),
      transaction.get(answerKeyRef),
      transaction.get(attemptRef),
      transaction.get(rewardSourceRef),
      transaction.get(statsRef),
      transaction.get(errorEntryRef),
    ]);

    if (!questionSnap.exists) throw new HttpsError('not-found', 'Questao nao encontrada.');
    if (!answerKeySnap.exists) throw new HttpsError('failed-precondition', 'Gabarito protegido nao encontrado.');

    const questionData = questionSnap.data() || {};
    const answerKeyData = answerKeySnap.data() || {};
    const options = Array.isArray(questionData.options) ? questionData.options : [];
    if (!options.some((option) => String(option?.id || '').trim() === normalizedSelectedOptionId)) {
      throw new HttpsError('invalid-argument', 'selectedOptionId nao pertence as alternativas da questao.');
    }

    const correctOptionId = String(answerKeyData.correctOptionId || '').trim();
    if (!correctOptionId || !options.some((option) => String(option?.id || '').trim() === correctOptionId)) {
      throw new HttpsError('failed-precondition', 'Gabarito protegido invalido para esta questao.');
    }

    const isCorrect = normalizedSelectedOptionId === correctOptionId;
    const explanation = String(answerKeyData.explanation || '');
    if (attemptSnap.exists) {
      let firstAttemptId = null;
      if (rewardSourceSnap.exists) {
        firstAttemptId = rewardSourceSnap.data()?.firstAttemptId;
        if (!firstAttemptId) {
          throw new HttpsError(
            'failed-precondition',
            'Fonte de recompensa da questao esta em estado inconsistente (firstAttemptId ausente). Reconciliacao administrativa necessaria.',
          );
        }
      } else {
        firstAttemptId = attemptId;
      }
      return {
        questionId: normalizedQuestionId,
        questionScope,
        selectedOptionId: normalizedSelectedOptionId,
        correctOptionId,
        isCorrect,
        explanation,
        xpEarned: 0,
        attemptId,
        rewardSourceId,
        firstAttemptId,
        shouldSyncGamification: rewardSourceSnap.exists && rewardSourceSnap.data()?.gamificationSynced !== true,
        duplicate: true,
      };
    }

    const serverTimestamp = admin.firestore.FieldValue.serverTimestamp();
    const rewardEligible = !rewardSourceSnap.exists;
    let firstAttemptId = null;

    if (rewardEligible) {
      firstAttemptId = attemptId;
    } else {
      const existingFirstAttemptId = rewardSourceSnap.data()?.firstAttemptId;
      if (!existingFirstAttemptId) {
        throw new HttpsError(
          'failed-precondition',
          'Fonte de recompensa da questao esta em estado inconsistente (firstAttemptId ausente). Reconciliacao administrativa necessaria.',
        );
      }
      firstAttemptId = existingFirstAttemptId;
    }

    transaction.create(attemptRef, {
      questionId: normalizedQuestionId,
      questionScope,
      userId: uid,
      selectedOptionId: normalizedSelectedOptionId,
      correctOptionId,
      isCorrect,
      timeSpentSeconds: normalizedTimeSpentSeconds,
      xpEarned: 0,
      rewardSourceId: rewardEligible ? rewardSourceId : null,
      attemptedAt: serverTimestamp,
    });

    if (rewardEligible) {
      transaction.create(rewardSourceRef, {
        userId: uid,
        questionId: normalizedQuestionId,
        questionScope,
        firstAttemptId: attemptId,
        selectedOptionId: normalizedSelectedOptionId,
        isCorrect,
        questions: 1,
        correct: isCorrect ? 1 : 0,
        attemptedAt: serverTimestamp,
        createdAt: serverTimestamp,
        gamificationSynced: false,
      });
    }

    transaction.set(statsRef, {
      questionsResolved: admin.firestore.FieldValue.increment(rewardEligible ? 1 : 0),
      correctResolved: admin.firestore.FieldValue.increment(rewardEligible && isCorrect ? 1 : 0),
      incorrectResolved: admin.firestore.FieldValue.increment(rewardEligible && !isCorrect ? 1 : 0),
      totalAttemptEvents: admin.firestore.FieldValue.increment(1),
      totalAttempts: admin.firestore.FieldValue.increment(1),
      correctAttempts: admin.firestore.FieldValue.increment(isCorrect ? 1 : 0),
      wrongAttempts: admin.firestore.FieldValue.increment(isCorrect ? 0 : 1),
      ...(!statsSnap.exists ? { totalXpEarned: 0 } : {}),
      ...(!statsSnap.exists ? { createdAt: serverTimestamp } : {}),
      updatedAt: serverTimestamp,
    }, { merge: true });

    if (!isCorrect) {
      transaction.set(errorEntryRef, {
        userId: uid,
        sourceType: 'question',
        sourceId: normalizedQuestionId,
        questionScope,
        deckId: null,
        disciplineId: questionData.disciplineId || null,
        subject: questionData.subject || null,
        wrongCount: admin.firestore.FieldValue.increment(1),
        correctCount: admin.firestore.FieldValue.increment(0),
        lastAttemptAt: serverTimestamp,
        userNotes: errorEntrySnap.exists ? errorEntrySnap.data().userNotes || null : null,
        mastered: false,
        masteredAt: null,
        preview: {
          statement: questionData.statement || '',
          options: options.map((option) => ({ id: String(option?.id || ''), text: String(option?.text || '') })),
          correctOptionId,
          userSelectedOptionId: normalizedSelectedOptionId,
        },
        ...(!errorEntrySnap.exists ? { createdAt: serverTimestamp } : {}),
        updatedAt: serverTimestamp,
      }, { merge: true });
    } else if (errorEntrySnap.exists) {
      transaction.set(errorEntryRef, {
        correctCount: admin.firestore.FieldValue.increment(1),
        lastAttemptAt: serverTimestamp,
        updatedAt: serverTimestamp,
      }, { merge: true });
    }

    const shouldSyncGamification = rewardEligible
      || (rewardSourceSnap.exists && rewardSourceSnap.data()?.gamificationSynced !== true);

    return {
      questionId: normalizedQuestionId,
      questionScope,
      selectedOptionId: normalizedSelectedOptionId,
      correctOptionId,
      isCorrect,
      explanation,
      xpEarned: 0,
      attemptId,
      rewardSourceId,
      firstAttemptId,
      shouldSyncGamification,
      duplicate: false,
    };
  }, { maxAttempts: 15 });

  let xpEarned = 0;
  if (transactionResult.shouldSyncGamification) {
    try {
      const rewardSourceForGamification = await rewardSourceRef.get();
      if (!rewardSourceForGamification.exists) {
        throw new HttpsError('failed-precondition', 'Fonte de recompensa ausente para sincronizacao de gamificacao.');
      }
      const gamificationResult = await gamificationService.recomputeUserGamification(uid, {
        change: {
          sourceType: 'question',
          sourceId: rewardSourceId,
          before: null,
          after: rewardSourceForGamification.data() || {},
          eventId: `question-${rewardSourceId}`,
        },
      });
      let rewardXp = 0;
      if (gamificationResult?.questionXPBySource && rewardSourceId in gamificationResult.questionXPBySource) {
        rewardXp = Number(gamificationResult.questionXPBySource[rewardSourceId] || 0);
      }
      if (rewardXp <= 0) {
        const eventSnap = await userRef.collection('gamification').doc('profile').collection('xp_events').doc(`academic_question_${rewardSourceId}`).get();
        rewardXp = Number(eventSnap.data()?.xpTotal || 0);
      }

      const targetFirstAttemptId = transactionResult.firstAttemptId;
      if (!targetFirstAttemptId) {
        throw new HttpsError(
          'failed-precondition',
          'Tentativa original (firstAttemptId) nao identificada para sincronizacao de gamificacao.',
        );
      }
      const firstAttemptRef = userRef.collection('question_attempts').doc(targetFirstAttemptId);
      const [profileSnap, currentStatsSnap] = await Promise.all([
        userRef.collection('gamification').doc('profile').get(),
        statsRef.get(),
      ]);
      const profileQuestionXP = Number(profileSnap.data()?.totals?.questionXP || 0);
      const currentStatsXP = Number(currentStatsSnap.data()?.totalXpEarned || 0);
      const totalXpEarned = Math.max(currentStatsXP, profileQuestionXP, rewardXp);

      const batch = db.batch();
      batch.set(rewardSourceRef, {
        gamificationSynced: true,
        gamificationSyncedAt: admin.firestore.FieldValue.serverTimestamp(),
      }, { merge: true });
      batch.set(firstAttemptRef, {
        xpEarned: rewardXp,
      }, { merge: true });
      batch.set(statsRef, {
        totalXpEarned,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      }, { merge: true });
      await batch.commit();

      if (attemptId === targetFirstAttemptId) {
        xpEarned = rewardXp;
      }
    } catch (error) {
      console.error('[Questions] Falha ao sincronizar gamificacao oficial:', error);
      if (error instanceof HttpsError) throw error;
      throw new HttpsError('internal', 'Resposta registrada, mas a gamificacao ainda nao foi sincronizada. Reenvie para reconciliar.');
    }
  }

  return {
    questionId: transactionResult.questionId,
    questionScope: transactionResult.questionScope,
    selectedOptionId: transactionResult.selectedOptionId,
    correctOptionId: transactionResult.correctOptionId,
    isCorrect: transactionResult.isCorrect,
    explanation: transactionResult.explanation,
    xpEarned,
    attemptId: transactionResult.attemptId,
  };
}

/**
 * Cria ou atualiza uma questão privada e seu respectivo gabarito protegido.
 * @param {object} params
 * @param {string} params.uid UID autenticado.
 * @param {object} params.data Dados da requisição.
 * @returns {Promise<object>}
 */
async function upsertPrivateQuestion({ uid, data }) {
  if (!uid) throw new HttpsError('unauthenticated', 'Usuario nao autenticado.');
  assertAllowedFields(data || {}, UPSERT_FIELDS, 'payload');
  const questionData = data?.question || {};
  const answerKeyData = data?.answerKey == null ? null : data.answerKey;
  const questionId = data?.questionId ? String(data.questionId).trim() : null;
  if (questionId && (questionId.length > 1500 || questionId.includes('/'))) {
    throw new HttpsError('invalid-argument', 'questionId invalido.');
  }

  normalizeQuestionAuthoringPayload(questionData, answerKeyData, DEFAULT_SERVER_PRODUCT_LIMITS, {
    answerKeyRequired: !questionId,
  });
  const db = admin.firestore();
  const productLimits = await getProductLimits(db);
  const normalized = normalizeQuestionAuthoringPayload(questionData, answerKeyData, productLimits, {
    answerKeyRequired: !questionId,
  });
  const userQuestionsRef = db.collection('users').doc(uid).collection('questions');
  const targetDocRef = questionId ? userQuestionsRef.doc(questionId) : userQuestionsRef.doc();
  const targetAnswerKeyRef = targetDocRef.collection('private').doc('answerKey');
  const serverTimestamp = admin.firestore.FieldValue.serverTimestamp();

  return db.runTransaction(async (transaction) => {
    const [existingSnap, existingAnswerKeySnap, userSnap] = await Promise.all([
      questionId ? transaction.get(targetDocRef) : Promise.resolve(null),
      questionId ? transaction.get(targetAnswerKeyRef) : Promise.resolve(null),
      !questionId ? transaction.get(db.collection('users').doc(uid)) : Promise.resolve(null),
    ]);
    const isEdit = existingSnap && existingSnap.exists;

    if (questionId && !isEdit) {
      throw new HttpsError('not-found', 'Questao privada nao encontrada.');
    }
    if (!questionId && !userSnap?.exists) {
      throw new HttpsError('not-found', 'Usuario nao encontrado.');
    }
    if (isEdit && existingSnap.data()?.userId !== uid) {
      throw new HttpsError('permission-denied', 'Questao privada nao pertence ao usuario autenticado.');
    }

    const preservedCorrectOptionId = String(existingAnswerKeySnap?.data()?.correctOptionId || '').trim();
    const finalAnswerKey = normalized.answerKey || (isEdit && existingAnswerKeySnap?.exists ? {
      correctOptionId: preservedCorrectOptionId,
      explanation: String(existingAnswerKeySnap.data()?.explanation || ''),
    } : null);
    if (!finalAnswerKey) {
      throw new HttpsError('failed-precondition', 'Gabarito protegido existente nao foi encontrado.');
    }
    const matchingOptions = normalized.question.options.filter((option) => option.id === finalAnswerKey.correctOptionId);
    const existingCorrectText = isEdit
      ? (existingSnap.data()?.options || []).find((option) => option?.id === finalAnswerKey.correctOptionId)?.text
      : null;
    const preservedAnswerChanged = isEdit
      && !normalized.answerKey
      && String(matchingOptions[0]?.text || '') !== String(existingCorrectText || '');
    if (matchingOptions.length !== 1 || preservedAnswerChanged) {
      throw new HttpsError(
        'failed-precondition',
        'As alternativas editadas sao incompativeis com o gabarito protegido atual. Selecione explicitamente um novo gabarito valido.',
      );
    }

    const questionEntity = {
      userId: uid,
      ...normalized.question,
      createdAt: isEdit ? existingSnap.data().createdAt : serverTimestamp,
      updatedAt: serverTimestamp,
    };

    transaction.set(targetDocRef, questionEntity);
    if (!isEdit || normalized.answerKey) {
      transaction.set(targetAnswerKeyRef, {
        ...finalAnswerKey,
        createdAt: isEdit && existingAnswerKeySnap?.exists
          ? existingAnswerKeySnap.data().createdAt
          : serverTimestamp,
        updatedAt: serverTimestamp,
      });
    }

    return {
      id: targetDocRef.id,
      questionScope: 'private',
      userId: uid,
      ...normalized.question,
      createdAt: isEdit ? (existingSnap.data().createdAt?.toDate?.() || new Date()) : new Date(),
      updatedAt: new Date(),
    };
  });
}

/**
 * Exclui uma questão privada e seu answerKey protegido.
 * @param {object} params
 * @param {string} params.uid UID autenticado.
 * @param {string} params.questionId ID da questão.
 * @returns {Promise<object>}
 */
async function deletePrivateQuestion({ uid, questionId }) {
  if (!uid) throw new HttpsError('unauthenticated', 'Usuario nao autenticado.');
  if (!questionId) throw new HttpsError('invalid-argument', 'questionId e obrigatorio.');

  const db = admin.firestore();
  const questionRef = db.collection('users').doc(uid).collection('questions').doc(questionId);
  const answerKeyRef = questionRef.collection('private').doc('answerKey');

  const questionSnap = await questionRef.get();
  if (!questionSnap.exists) {
    throw new HttpsError('not-found', 'Questao privada nao encontrada.');
  }

  const batch = db.batch();
  batch.delete(answerKeyRef);
  batch.delete(questionRef);
  await batch.commit();

  return { ok: true, questionId };
}

module.exports = {
  listQuestions,
  processQuestionAnswerSubmission,
  upsertPrivateQuestion,
  deletePrivateQuestion,
  normalizeQuestionAuthoringPayload,
  deterministicDocumentId,
};
