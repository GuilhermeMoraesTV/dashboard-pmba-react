/**
 * @fileoverview Geracao estruturada a partir de chunks de documentos privados.
 */

const crypto = require('crypto');
const sanitizeHtml = require('sanitize-html');
const { AIProviderError } = require('./provider');

class GenerationError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'GenerationError';
    this.code = code;
  }
}

const SAFE_TEXT_TAGS = ['p', 'br', 'strong', 'em', 'b', 'i', 'ul', 'ol', 'li', 'code'];

function stripInternalRefTokens(text) {
  return String(text || '')
    .replace(/\[\s*REF\s+[^\]]+\]/gi, '')
    .replace(/\bREF\s+[A-Za-z0-9_:-]+\b/gi, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function cleanText(value, maxLength) {
  const stripped = stripInternalRefTokens(value);
  return sanitizeHtml(String(stripped || '').normalize('NFC').trim(), {
    allowedTags: SAFE_TEXT_TAGS,
    allowedAttributes: {},
    disallowedTagsMode: 'discard',
    enforceHtmlBoundary: true,
  }).slice(0, maxLength).trim();
}

function cleanTags(value, maxTags = 10) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value
    .map((tag) => String(tag || '').normalize('NFC').replace(/[\u0000-\u001F\u007F]/g, '').trim().slice(0, 60))
    .filter(Boolean))].slice(0, maxTags);
}

function dateKey(date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Bahia', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(date);
}

function buildFlashcardSchema(targetCount) {
  return {
    type: 'object',
    required: ['items'],
    additionalProperties: false,
    properties: {
      items: {
        type: 'array', minItems: 1, maxItems: targetCount,
        items: {
          type: 'object', required: ['front', 'back', 'tags'], additionalProperties: false,
          properties: {
            front: { type: 'string', minLength: 1, maxLength: 400 },
            back: { type: 'string', minLength: 1, maxLength: 600 },
            tags: { type: 'array', maxItems: 10, items: { type: 'string', maxLength: 60 } },
          },
        },
      },
    },
  };
}

function buildQuestionSchema(targetCount) {
  return {
    type: 'object', required: ['items'], additionalProperties: false,
    properties: {
      items: {
        type: 'array', minItems: 1, maxItems: targetCount,
        items: {
          type: 'object',
          required: ['statement', 'options', 'correctOptionId', 'explanation', 'tags'],
          additionalProperties: false,
          properties: {
            statement: { type: 'string', minLength: 1, maxLength: 4000 },
            options: {
              type: 'array', minItems: 2, maxItems: 5,
              items: {
                type: 'object', required: ['id', 'text'], additionalProperties: false,
                properties: {
                  id: { type: 'string', minLength: 1, maxLength: 12 },
                  text: { type: 'string', minLength: 1, maxLength: 2000 },
                },
              },
            },
            correctOptionId: { type: 'string', minLength: 1, maxLength: 12 },
            explanation: { type: 'string', maxLength: 5000 },
            tags: { type: 'array', maxItems: 10, items: { type: 'string', maxLength: 60 } },
          },
        },
      },
    },
  };
}

function buildSummarySchema() {
  return {
    type: 'object', required: ['title', 'summary', 'keyPoints'], additionalProperties: false,
    properties: {
      title: { type: 'string', minLength: 1, maxLength: 200 },
      summary: { type: 'string', minLength: 1, maxLength: 12000 },
      keyPoints: { type: 'array', minItems: 1, maxItems: 30, items: { type: 'string', maxLength: 800 } },
    },
  };
}

function normalizeCount(value, fallback, maximum) {
  const number = Math.floor(Number(value) || fallback);
  return Math.min(Math.max(number, 1), maximum);
}

async function reserveGenerationQuota({ admin, db, uid, surface, limit }) {
  const day = dateKey();
  const ref = db.collection('system_ai_usage').doc(`${day}_${uid}`);
  await db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(ref);
    const data = snapshot.data() || {};
    const calls = Number(data.domainGenerationCalls || 0);
    if (calls >= limit) {
      throw new GenerationError('quota-exceeded', 'Limite diario de geracoes por IA atingido.');
    }
    transaction.set(ref, {
      uid,
      day,
      domainGenerationCalls: calls + 1,
      domainGenerationSurfaces: {
        ...(data.domainGenerationSurfaces || {}),
        [surface]: Number(data.domainGenerationSurfaces?.[surface] || 0) + 1,
      },
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      createdAt: data.createdAt || admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });
  });
}

async function loadOwnedStudySourceContext({ db, uid, sourceId, limits }) {
  if (!/^[A-Za-z0-9_-]{1,160}$/.test(String(sourceId || ''))) throw new GenerationError('invalid-argument', 'sourceId invalido.');
  const userRef = db.collection('users').doc(uid);
  const sourceRef = userRef.collection('study_sources').doc(sourceId);
  const sourceSnapshot = await sourceRef.get();
  if (!sourceSnapshot.exists) throw new GenerationError('not-found', 'Fonte de estudo nao encontrada.');
  const source = sourceSnapshot.data() || {};
  if (source.userId !== uid) throw new GenerationError('permission-denied', 'Fonte nao pertence ao usuario autenticado.');
  if (source.status !== 'ready') throw new GenerationError('failed-precondition', 'A fonte de estudo ainda nao esta pronta.');
  let chunksRef = sourceRef.collection('chunks');
  let documentId = null;
  if (source.kind === 'document') {
    documentId = String(source.documentId || '');
    if (!/^[A-Za-z0-9_-]{1,160}$/.test(documentId)) throw new GenerationError('failed-precondition', 'Fonte documental sem documentId valido.');
    const documentRef = userRef.collection('documents').doc(documentId);
    const documentSnapshot = await documentRef.get();
    if (!documentSnapshot.exists || documentSnapshot.data()?.userId !== uid || documentSnapshot.data()?.studySourceId !== sourceId) {
      throw new GenerationError('failed-precondition', 'Vinculo entre fonte e documento e invalido.');
    }
    if (documentSnapshot.data()?.status !== 'processed') throw new GenerationError('failed-precondition', 'O documento da fonte ainda nao foi processado.');
    chunksRef = documentRef.collection('chunks');
  } else if (source.kind !== 'note') {
    throw new GenerationError('failed-precondition', 'Tipo de fonte de estudo invalido.');
  }
  const chunksSnapshot = await chunksRef.orderBy('order').get();
  if (chunksSnapshot.empty) throw new GenerationError('failed-precondition', 'A fonte nao possui chunks processados.');
  let remaining = limits.ai.maxInputChars;
  const maximumDocumentPage = Math.max(1, Number(limits.ai.maxDocumentPagesForAI));
  const pieces = [];
  for (const chunk of chunksSnapshot.docs) {
    if (remaining <= 0) break;
    const data = chunk.data() || {};
    if (source.kind === 'document' && Number(data.pageStart || 0) > maximumDocumentPage) break;
    const content = String(data.content || '').slice(0, remaining);
    if (!content) continue;
    const pageLabel = data.pageStart && data.pageStart === data.pageEnd
      ? `Pagina ${data.pageStart}`
      : data.pageStart ? `Paginas ${data.pageStart}-${data.pageEnd}` : `Trecho ${Number(data.order || 0) + 1}`;
    pieces.push(`[${pageLabel}]\n${content}`);
    remaining -= content.length;
  }
  if (!pieces.length) throw new GenerationError('failed-precondition', 'Os chunks do documento estao vazios.');
  return { sourceRef, source, sourceId, documentId, text: pieces.join('\n\n---\n\n') };
}

function createGenerationService({ admin, getProductLimits, getProvider }) {
  const db = admin.firestore();

  async function execute({ uid, sourceId, type, payload = {} }) {
    if (!uid) throw new GenerationError('unauthenticated', 'Autenticacao obrigatoria.');
    const limits = await getProductLimits(db);
    const context = await loadOwnedStudySourceContext({ db, uid, sourceId, limits });
    const surface = type === 'flashcard' ? 'flashcards' : type === 'question' ? 'questions' : 'summary';
    await reserveGenerationQuota({
      admin, db, uid, surface, limit: limits.ai.dailyGenerationsLimitPerUser,
    });

    let schema;
    let prompt;
    let targetCount = 1;
    if (type === 'flashcard') {
      // Quantidade e um detalhe interno de buffer; o client nao escolhe lote de Flashcards.
      targetCount = Math.min(Number(limits.adaptiveStudy?.refillSize || 3), limits.ai.maxGeneratedCardsPerBatch);
      schema = buildFlashcardSchema(targetCount);
      prompt = `Crie até ${targetCount} flashcards atômicos e ultradiretos usando somente a FONTE DE ESTUDO abaixo. Regras: Uma ideia por card. Frente: pergunta ou comando direto (máx 20 palavras). Verso: resposta concisa e objetiva (máx 35 palavras). Proibido textos longos ou parágrafos dissertativos. Nunca inclua tags internas como [REF ...] no texto.\n\nFONTE DE ESTUDO\n${context.text}`;
    } else if (type === 'question') {
      targetCount = normalizeCount(payload.targetCount, 5, limits.ai.maxGeneratedQuestionsPerBatch);
      const currentQuestions = await db.collection('users').doc(uid).collection('questions').count().get();
      const remainingQuestions = Math.max(
        0,
        Number(limits.questions.maxPrivateQuestionsPerUser) - Number(currentQuestions.data().count || 0),
      );
      if (!remainingQuestions) {
        throw new GenerationError('quota-exceeded', 'Limite de questoes privadas do usuario atingido.');
      }
      targetCount = Math.min(targetCount, remainingQuestions);
      const difficulty = ['easy', 'medium', 'hard'].includes(payload.difficulty) ? payload.difficulty : 'medium';
      schema = buildQuestionSchema(targetCount);
      prompt = `Crie ate ${targetCount} questoes objetivas de dificuldade ${difficulty}, usando somente a FONTE DE ESTUDO abaixo. Cada questao deve ter alternativas unicas, exatamente um gabarito valido e explicacao fundamentada.\n\nFONTE DE ESTUDO\n${context.text}`;
    } else if (type === 'summary') {
      schema = buildSummarySchema();
      prompt = `Produza resumo estruturado fiel somente a FONTE DE ESTUDO abaixo, sem inventar informacoes.\n\nFONTE DE ESTUDO\n${context.text}`;
    } else {
      throw new GenerationError('invalid-argument', 'Tipo de geracao invalido.');
    }

    const provider = getProvider();
    let result;
    try {
      result = await provider.generate({
        surface,
        prompt,
        systemPrompt: 'Voce e um gerador educacional server-side. Use apenas o contexto fornecido e respeite estritamente o schema JSON.',
        responseSchema: schema,
        temperature: 0.2,
        maxOutputTokens: limits.ai.maxOutputTokens,
      });
    } catch (error) {
      if (error instanceof AIProviderError) throw error;
      throw new GenerationError('provider-error', error?.message || 'Falha no provedor de IA.');
    }

    const generatedRef = db.collection('users').doc(uid).collection('generated_items');
    const now = admin.firestore.FieldValue.serverTimestamp();
    const jobId = `ai_${crypto.randomUUID()}`;
    const batch = db.batch();
    let itemCount = 0;

    if (type === 'flashcard') {
      for (const item of result.parsedJson.items.slice(0, targetCount)) {
        const front = cleanText(item.front, 2000);
        const back = cleanText(item.back, 5000);
        if (!front || !back) continue;
        const ref = generatedRef.doc();
        batch.set(ref, {
          userId: uid, sourceId, sourceDocumentId: context.documentId, type: 'flashcard', status: 'buffer',
          content: { front, back, targetDeckId: payload.deckId || null },
          tags: cleanTags(item.tags, limits.flashcards.maxTagsPerCard),
          createdAt: now, updatedAt: now,
        });
        itemCount += 1;
      }
    } else if (type === 'question') {
      const questionsRef = db.collection('users').doc(uid).collection('questions');
      for (const item of result.parsedJson.items.slice(0, targetCount)) {
        const statement = cleanText(item.statement, 4000);
        const options = Array.isArray(item.options) ? item.options.slice(0, 5).map((option) => ({
          id: cleanText(option.id, 12), text: cleanText(option.text, 2000),
        })).filter((option) => option.id && option.text) : [];
        const uniqueIds = new Set(options.map((option) => option.id));
        const correctOptionId = cleanText(item.correctOptionId, 12);
        if (!statement || options.length < 2 || uniqueIds.size !== options.length || !uniqueIds.has(correctOptionId)) continue;
        const questionRef = questionsRef.doc();
        const questionData = {
          userId: uid,
          statement,
          options,
          disciplineId: 'derivacao_pendente',
          subject: 'Derivação pendente',
          difficulty: ['easy', 'medium', 'hard'].includes(payload.difficulty) ? payload.difficulty : 'medium',
          sourceType: 'ai',
          sourceId,
          sourceDocumentId: context.documentId,
          createdAt: now,
          updatedAt: now,
        };
        batch.set(questionRef, questionData);
        batch.set(questionRef.collection('private').doc('answerKey'), {
          correctOptionId,
          explanation: cleanText(item.explanation, 5000),
          createdAt: now,
          updatedAt: now,
        });
        const generatedItemRef = generatedRef.doc();
        batch.set(generatedItemRef, {
          userId: uid, sourceId, sourceDocumentId: context.documentId, type: 'question', status: 'buffer',
          content: {
            questionId: questionRef.id,
            statement: questionData.statement,
            options: questionData.options,
            disciplineId: questionData.disciplineId,
            subject: questionData.subject,
            difficulty: questionData.difficulty,
            sourceType: questionData.sourceType,
            sourceDocumentId: questionData.sourceDocumentId,
          },
          tags: cleanTags(item.tags, limits.flashcards.maxTagsPerCard),
          createdAt: now, updatedAt: now,
        });
        itemCount += 1;
      }
    } else {
      const ref = generatedRef.doc();
      batch.set(ref, {
        userId: uid, sourceId, sourceDocumentId: context.documentId, type: 'summary', status: 'buffer',
        content: {
          title: cleanText(result.parsedJson.title, 200),
          summary: cleanText(result.parsedJson.summary, 12000),
          keyPoints: (result.parsedJson.keyPoints || []).map((item) => cleanText(item, 800)).filter(Boolean).slice(0, 30),
        },
        tags: [], createdAt: now, updatedAt: now,
      });
      itemCount = 1;
    }

    if (!itemCount) throw new GenerationError('schema-invalid', 'A resposta estruturada nao continha itens validos.');
    await batch.commit();
    return { jobId, status: 'completed', itemCount };
  }

  return {
    generateFlashcards: (args) => execute({ ...args, type: 'flashcard' }),
    generateQuestions: (args) => execute({ ...args, type: 'question' }),
    generateSummary: (args) => execute({ ...args, type: 'summary' }),
  };
}

module.exports = {
  GenerationError,
  buildFlashcardSchema,
  buildQuestionSchema,
  buildSummarySchema,
  cleanTags,
  createGenerationService,
  loadOwnedStudySourceContext,
  normalizeCount,
};
