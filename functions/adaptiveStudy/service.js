/**
 * @fileoverview Adaptive Tutor de Flashcards, orientado exclusivamente por StudySource.
 *
 * O client nunca escolhe quantidade, conceito, dificuldade cognitiva ou ownership.
 * O backend mantem um buffer pequeno em generated_items e materializa Card + CardReview
 * somente no primeiro rating, em uma unica transacao idempotente.
 */

const crypto = require('crypto');
const { HttpsError } = require('firebase-functions/v2/https');
const sanitizeHtml = require('sanitize-html');
const { createInitialState, schedule } = require('../flashcards/scheduler');

const ALGORITHM_VERSION = 'adaptive-flashcards-v2';
const CONCEPT_PROMPT_VERSION = 'concepts-windowed-v2';
const CARD_PROMPT_VERSION = 'adaptive-card-compact-v2';
const ACTIVE_QUEUE_STATES = new Set(['generating', 'ready', 'served']);
const SAFE_TEXT_TAGS = ['p', 'br', 'strong', 'em', 'b', 'i', 'ul', 'ol', 'li', 'code'];

function safeIdentifier(value, label) {
  const normalized = String(value || '').trim();
  if (!/^[A-Za-z0-9_-]{1,160}$/.test(normalized)) {
    throw new HttpsError('invalid-argument', `${label} invalido.`);
  }
  return normalized;
}

function stripInternalRefTokens(text) {
  return String(text || '')
    .replace(/\[\s*REF\s+[^\]]+\]/gi, '')
    .replace(/\bREF\s+[A-Za-z0-9_:-]+\b/gi, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function cleanText(value, maximum = 5000) {
  const stripped = stripInternalRefTokens(value);
  return sanitizeHtml(String(stripped || '').normalize('NFC').trim(), {
    allowedTags: SAFE_TEXT_TAGS,
    allowedAttributes: {},
    disallowedTagsMode: 'discard',
    enforceHtmlBoundary: true,
  }).slice(0, maximum).trim();
}

function normalizedKey(value) {
  return String(value || '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function stableId(prefix, value, length = 24) {
  return `${prefix}_${crypto.createHash('sha256').update(String(value)).digest('base64url').slice(0, length)}`;
}

function contentFingerprint(front, back) {
  return crypto.createHash('sha256')
    .update(`${normalizedKey(front)}\u0000${normalizedKey(back)}`)
    .digest('base64url');
}

function masteryDocumentId(sourceId, conceptId) {
  return stableId('mastery', `${sourceId}\u0000${conceptId}`, 32);
}

function evolveMastery(current = {}, rating, context = {}) {
  const isWrong = rating === 'again';
  const isCorrect = !isWrong;
  const correctCount = Number(current.correctCount || 0) + (isCorrect ? 1 : 0);
  const wrongCount = Number(current.wrongCount || 0) + (isWrong ? 1 : 0);
  const correctStreak = isCorrect ? Number(current.correctStreak || 0) + 1 : 0;
  const wrongStreak = isWrong ? Number(current.wrongStreak || 0) + 1 : 0;
  const previousBoost = Number(current.priorityBoost || 0);
  const priorityBoost = isWrong
    ? Math.min(12, previousBoost + 2)
    : Math.max(0, previousBoost - (rating === 'easy' ? 2 : rating === 'good' ? 1 : 0.5));
  const recentErrors = [
    ...(Array.isArray(current.recentErrors) ? current.recentErrors : []),
    ...(isWrong ? [{ itemId: context.itemId || null, at: context.at || null }] : []),
  ].slice(-6);
  const exposures = Number(current.exposures || 0) + 1;
  let learningStage = 'learning';
  if (wrongStreak > 0 || priorityBoost >= 2) learningStage = 'reinforcing';
  else if (correctCount >= 4 && correctStreak >= 2 && priorityBoost <= 1) learningStage = 'mastered';
  else if (exposures <= 1) learningStage = 'new';
  return {
    exposures,
    correctCount,
    wrongCount,
    correctStreak,
    wrongStreak,
    recentErrors,
    priorityBoost,
    learningStage,
  };
}

function conceptScore(concept, mastery = {}) {
  const exposures = Number(mastery.exposures || 0);
  const wrongStreak = Number(mastery.wrongStreak || 0);
  const correctStreak = Number(mastery.correctStreak || 0);
  const priorityBoost = Number(mastery.priorityBoost || 0);
  return (exposures === 0 ? 8 : 0)
    + priorityBoost * 3
    + wrongStreak * 5
    - correctStreak * 0.75
    - exposures * 0.35
    + Number(concept.coverageWeight || 1);
}

function chooseCognitiveDifficulty(mastery = {}) {
  if (Number(mastery.wrongStreak || 0) > 0 || Number(mastery.priorityBoost || 0) >= 3) return 'easy';
  if (Number(mastery.correctStreak || 0) >= 2 && Number(mastery.exposures || 0) >= 3) return 'hard';
  return Number(mastery.exposures || 0) >= 2 ? 'hard' : 'easy';
}

function selectConceptPlans(concepts, masteryByConcept, count, existingItems = []) {
  const candidates = concepts
    .map((concept) => ({ concept, mastery: masteryByConcept.get(concept.conceptId) || {} }))
    .sort((left, right) => conceptScore(right.concept, right.mastery) - conceptScore(left.concept, left.mastery)
      || left.concept.conceptId.localeCompare(right.concept.conceptId));
  const variantCounts = new Map();
  for (const item of existingItems) {
    const conceptId = String(item.conceptId || '');
    variantCounts.set(conceptId, Number(variantCounts.get(conceptId) || 0) + 1);
  }
  const plans = [];
  for (let index = 0; index < count; index += 1) {
    const selected = candidates[index % Math.max(1, candidates.length)];
    if (!selected) break;
    const conceptId = selected.concept.conceptId;
    const nextVariant = Number(variantCounts.get(conceptId) || 0) + 1;
    variantCounts.set(conceptId, nextVariant);
    const cognitiveDifficulty = chooseCognitiveDifficulty(selected.mastery);
    plans.push({
      conceptId,
      conceptName: selected.concept.name,
      conceptSummary: selected.concept.summary,
      cognitiveDifficulty,
      variantKey: `${conceptId}:${cognitiveDifficulty}:v${nextVariant}`,
      allowedSourceRefKeys: selected.concept.sourceRefKeys,
    });
  }
  return plans;
}

function conceptSchema(maximum) {
  return {
    type: 'object', required: ['concepts'], additionalProperties: false,
    properties: {
      concepts: {
        type: 'array', minItems: 1, maxItems: maximum,
        items: {
          type: 'object', required: ['name', 'summary', 'sourceRefKeys'], additionalProperties: false,
          properties: {
            name: { type: 'string', minLength: 1, maxLength: 200 },
            summary: { type: 'string', minLength: 1, maxLength: 1000 },
            sourceRefKeys: { type: 'array', minItems: 1, maxItems: 6, items: { type: 'string', maxLength: 120 } },
          },
        },
      },
    },
  };
}

function adaptiveCardSchema(maximum) {
  return {
    type: 'object', required: ['items'], additionalProperties: false,
    properties: {
      items: {
        type: 'array', minItems: 1, maxItems: maximum,
        items: {
          type: 'object',
          required: ['conceptId', 'cognitiveDifficulty', 'variantKey', 'front', 'back', 'sourceRefKeys'],
          additionalProperties: false,
          properties: {
            conceptId: { type: 'string', minLength: 1, maxLength: 120 },
            cognitiveDifficulty: { type: 'string', enum: ['easy', 'hard'] },
            variantKey: { type: 'string', minLength: 1, maxLength: 150 },
            front: { type: 'string', minLength: 1, maxLength: 600 },
            back: { type: 'string', minLength: 1, maxLength: 1500 },
            sourceRefKeys: { type: 'array', minItems: 1, maxItems: 6, items: { type: 'string', maxLength: 120 } },
          },
        },
      },
    },
  };
}

function buildConceptWindows(chunks, maximumChars = 18000) {
  const safeMaximum = Math.max(2000, Math.min(30000, Number(maximumChars) || 18000));
  const fragments = [];
  for (const chunk of chunks) {
    const refKey = String(chunk.refKey || 'source');
    const header = `[REF ${refKey}]\n`;
    const rawText = String(chunk.text || '').replace(/^\[REF [^\]]+\]\s*/i, '').trim();
    const fragmentSize = Math.max(1000, safeMaximum - header.length);
    for (let offset = 0; offset < rawText.length; offset += fragmentSize) {
      fragments.push({ refKey, text: `${header}${rawText.slice(offset, offset + fragmentSize)}` });
    }
  }
  const windows = [];
  let current = [];
  let currentLength = 0;
  for (const fragment of fragments) {
    const separatorLength = current.length ? 7 : 0;
    if (current.length && currentLength + separatorLength + fragment.text.length > safeMaximum) {
      windows.push({ fragments: current, text: current.map((item) => item.text).join('\n\n---\n\n') });
      current = [];
      currentLength = 0;
    }
    current.push(fragment);
    currentLength += separatorLength + fragment.text.length;
  }
  if (current.length) windows.push({ fragments: current, text: current.map((item) => item.text).join('\n\n---\n\n') });
  return windows;
}

async function mapWithConcurrency(items, concurrency, mapper) {
  const results = new Array(items.length);
  let nextIndex = 0;
  async function worker() {
    while (nextIndex < items.length) {
      const index = nextIndex;
      nextIndex += 1;
      try {
        results[index] = { status: 'fulfilled', value: await mapper(items[index], index) };
      } catch (reason) {
        results[index] = { status: 'rejected', reason };
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(Math.max(1, concurrency), items.length) }, worker));
  return results;
}

function logAdaptiveStage(stage, startedAt, context = {}) {
  console.log('[AdaptiveStudy Stage Telemetry]', {
    stage,
    durationMs: Date.now() - startedAt,
    sourceId: context.sourceId || null,
    conceptId: context.conceptId || null,
    count: Number(context.count || 0),
  });
}

function transportItem(snapshot) {
  if (!snapshot?.exists) return null;
  const data = snapshot.data() || {};
  const toIso = (value) => value?.toDate?.().toISOString?.() || null;
  return {
    id: snapshot.id,
    sessionId: data.sessionId,
    folderId: data.folderId,
    sourceId: data.sourceId,
    sourceRevision: data.sourceRevision,
    conceptId: data.conceptId,
    conceptName: data.conceptName,
    cognitiveDifficulty: data.cognitiveDifficulty,
    variantKey: data.variantKey,
    contentFingerprint: data.contentFingerprint,
    sourceRefs: data.sourceRefs || [],
    front: data.content?.front || '',
    back: data.content?.back || '',
    queueState: data.queueState,
    servedAt: toIso(data.servedAt),
  };
}

function createAdaptiveStudyService({ admin, getProductLimits, getProvider }) {
  const db = admin.firestore();
  const nowTimestamp = () => admin.firestore.Timestamp.now();
  const serverTimestamp = () => admin.firestore.FieldValue.serverTimestamp();

  async function loadAuthority(uid, folderId, sourceId, limits) {
    const safeFolderId = safeIdentifier(folderId, 'folderId');
    const safeSourceId = safeIdentifier(sourceId, 'sourceId');
    const userRef = db.collection('users').doc(uid);
    const folderRef = userRef.collection('study_folders').doc(safeFolderId);
    const sourceRef = userRef.collection('study_sources').doc(safeSourceId);
    const [folderSnapshot, sourceSnapshot] = await Promise.all([folderRef.get(), sourceRef.get()]);
    if (!folderSnapshot.exists || folderSnapshot.data()?.userId !== uid || folderSnapshot.data()?.archived === true) {
      throw new HttpsError('not-found', 'Pasta de Estudos nao encontrada.');
    }
    if (!sourceSnapshot.exists || sourceSnapshot.data()?.userId !== uid) {
      throw new HttpsError('not-found', 'Fonte de estudo nao encontrada.');
    }
    const source = sourceSnapshot.data() || {};
    if (source.folderId !== safeFolderId) throw new HttpsError('failed-precondition', 'A fonte nao pertence a pasta informada.');
    if (source.status !== 'ready') throw new HttpsError('failed-precondition', 'A fonte ainda nao esta pronta para estudar.');
    if (!Number.isInteger(source.sourceRevision) || source.sourceRevision < 1) {
      throw new HttpsError('failed-precondition', 'A fonte nao possui revisao valida.');
    }

    let chunkCollection = sourceRef.collection('chunks');
    let documentId = null;
    if (source.kind === 'document') {
      documentId = safeIdentifier(source.documentId, 'documentId');
      const documentSnapshot = await userRef.collection('documents').doc(documentId).get();
      const document = documentSnapshot.data() || {};
      if (!documentSnapshot.exists || document.userId !== uid || document.studySourceId !== safeSourceId || document.status !== 'processed') {
        throw new HttpsError('failed-precondition', 'Documento da fonte nao esta pronto ou perdeu o vinculo autoritativo.');
      }
      chunkCollection = documentSnapshot.ref.collection('chunks');
    } else if (source.kind !== 'note') {
      throw new HttpsError('failed-precondition', 'Tipo de StudySource nao suportado.');
    }

    const chunkQuery = chunkCollection.orderBy('order').limit(Number(limits.documents.maxChunks || 160));
    const chunkSnapshots = await chunkQuery.get();
    const refs = new Map();
    const refText = new Map();
    const chunks = [];
    const textParts = [];
    for (const chunkSnapshot of chunkSnapshots.docs) {
      const chunk = chunkSnapshot.data() || {};
      const content = String(chunk.content || '').trim();
      if (!content) continue;
      const refKey = source.kind === 'document'
        ? `${documentId}:${chunkSnapshot.id}:p${Number(chunk.pageStart || 0)}-${Number(chunk.pageEnd || chunk.pageStart || 0)}`
        : `${safeSourceId}:${chunkSnapshot.id}`;
      const provenance = {
        sourceId: safeSourceId,
        documentId,
        chunkId: chunkSnapshot.id,
        ...(source.kind === 'document' ? {
          pageStart: Number(chunk.pageStart || 0) || null,
          pageEnd: Number(chunk.pageEnd || chunk.pageStart || 0) || null,
        } : { order: Number(chunk.order || 0) }),
      };
      refs.set(refKey, provenance);
      const promptText = `[REF ${refKey}]\n${content}`;
      refText.set(refKey, promptText);
      chunks.push({ refKey, text: promptText });
      textParts.push(promptText);
    }
    if (!textParts.length) throw new HttpsError('failed-precondition', 'A fonte nao possui evidencia suficiente para estudo.');
    return {
      userRef, folderRef, folder: folderSnapshot.data(), sourceRef, source, sourceId: safeSourceId,
      folderId: safeFolderId, documentId, refs, refText, chunks, text: textParts.join('\n\n---\n\n'),
    };
  }

  async function ensureConceptAnalysis(authority, limits) {
    const existing = authority.source.conceptAnalysis;
    if (existing?.sourceRevision === authority.source.sourceRevision
      && existing?.algorithmVersion === ALGORITHM_VERSION
      && Array.isArray(existing?.concepts) && existing.concepts.length) {
      return existing;
    }
    const provider = getProvider();
    const chunks = authority.chunks.length ? authority.chunks : [{ refKey: 'source', text: authority.text }];
    const conceptsPerWindow = Math.max(4, Math.min(10, Number(limits.adaptiveStudy.conceptsPerWindow || 8)));
    const windows = buildConceptWindows(chunks, limits.adaptiveStudy.conceptWindowMaxChars || 18000);
    const analysisStartedAt = Date.now();
    const results = await mapWithConcurrency(
      windows,
      Number(limits.adaptiveStudy.conceptAnalysisConcurrency || 1),
      (window, index) => provider.generate({
      surface: `adaptive-concepts-window-${index + 1}`,
      systemPrompt: 'Analise somente o chunk fornecido. Identifique conceitos concisos, essenciais e atômicos. Nao use conhecimento externo.',
      prompt: `Identifique ate ${conceptsPerWindow} conceitos academicamente sustentados somente por esta JANELA. Cada conceito deve citar uma ou mais REF exatamente como fornecida.\n\nJANELA ${index + 1}/${windows.length}\n${window.text}`,
      responseSchema: conceptSchema(conceptsPerWindow),
      temperature: 0.1,
      maxOutputTokens: Math.min(limits.ai.maxOutputTokens, limits.adaptiveStudy.maxTokensPerGeneration),
      requestedCount: conceptsPerWindow,
      sourceId: authority.sourceId,
      reduceScopeOnRetry: () => ({
        prompt: `Identifique somente os ${Math.max(2, Math.floor(conceptsPerWindow / 2))} conceitos mais essenciais desta JANELA. Use apenas as REF fornecidas e seja extremamente conciso.\n\n${window.text}`,
        responseSchema: conceptSchema(Math.max(2, Math.floor(conceptsPerWindow / 2))),
        requestedCount: Math.max(2, Math.floor(conceptsPerWindow / 2)),
      }),
    }),
    );
    const successfulResults = results.filter((entry) => entry.status === 'fulfilled').map((entry) => entry.value);
    if (!successfulResults.length) {
      throw results.find((entry) => entry.status === 'rejected')?.reason
        || new HttpsError('failed-precondition', 'Nao foi possivel analisar os chunks da fonte.');
    }
    results.filter((entry) => entry.status === 'rejected').forEach((entry, index) => {
      console.warn('[AdaptiveStudy] Chunk de conceitos ignorado apos retry unico.', {
        sourceId: authority.sourceId,
        chunkIndex: index,
        code: entry.reason?.code || 'generation-error',
        details: entry.reason?.details || null,
      });
    });
    const concepts = [];
    const seen = new Set();
    windows.forEach((window, windowIndex) => {
      const execResult = results[windowIndex];
      if (execResult?.status !== 'fulfilled' || !Array.isArray(execResult.value?.parsedJson?.concepts)) return;
      for (const raw of execResult.value.parsedJson.concepts) {
        const name = cleanText(raw.name, 200);
        const summary = cleanText(raw.summary, 1000);
        const key = normalizedKey(name);
        const rawRefKeys = Array.isArray(raw.sourceRefKeys) ? raw.sourceRefKeys.map(String) : [];
        let sourceRefKeys = rawRefKeys
          .map((k) => k.replace(/^\[?\s*REF\s+/i, '').replace(/\]$/, '').trim())
          .filter((k) => authority.refs.has(k));
        if (!sourceRefKeys.length && window.fragments[0]?.refKey && authority.refs.has(window.fragments[0].refKey)) {
          sourceRefKeys = [window.fragments[0].refKey];
        }
        if (!name || !summary || !key || seen.has(key) || !sourceRefKeys.length) continue;
        seen.add(key);
        concepts.push({
          conceptId: stableId('concept', `${authority.sourceId}\u0000${key}`, 28),
          name,
          summary,
          sourceRefKeys,
          coverageWeight: 1,
        });
      }
    });
    if (!concepts.length) throw new HttpsError('failed-precondition', 'A fonte não possui evidência suficiente para identificar conceitos.');
    logAdaptiveStage('concept_analysis', analysisStartedAt, { sourceId: authority.sourceId, count: concepts.length });
    const analysis = {
      sourceRevision: authority.source.sourceRevision,
      algorithmVersion: ALGORITHM_VERSION,
      promptVersion: CONCEPT_PROMPT_VERSION,
      concepts,
      analyzedWindows: windows.length,
      analyzedAt: nowTimestamp(),
      usage: successfulResults.reduce((usage, result) => ({
        promptTokens: usage.promptTokens + Number(result.usage?.promptTokens || 0),
        outputTokens: usage.outputTokens + Number(result.usage?.outputTokens || 0),
      }), { promptTokens: 0, outputTokens: 0 }),
    };
    await db.runTransaction(async (transaction) => {
      const current = await transaction.get(authority.sourceRef);
      if (!current.exists || current.data()?.userId !== authority.source.userId
        || current.data()?.sourceRevision !== authority.source.sourceRevision
        || current.data()?.status !== 'ready') {
        throw new HttpsError('aborted', 'A fonte mudou durante a analise. Inicie novamente.');
      }
      const currentAnalysis = current.data()?.conceptAnalysis;
      if (!(currentAnalysis?.sourceRevision === authority.source.sourceRevision
        && Array.isArray(currentAnalysis?.concepts) && currentAnalysis.concepts.length)) {
        transaction.update(authority.sourceRef, { conceptAnalysis: analysis, updatedAt: serverTimestamp() });
      }
    });
    return analysis;
  }

  async function ensureFolderDeck(uid, authority, limits) {
    const decks = await authority.userRef.collection('decks').where('folderId', '==', authority.folderId).get();
    const reusable = decks.docs.find((snapshot) => snapshot.data()?.userId === uid && snapshot.data()?.archived !== true);
    if (reusable) return reusable.id;
    const totalDecks = await authority.userRef.collection('decks').count().get();
    if (Number(totalDecks.data().count || 0) >= limits.flashcards.maxDecksPerUser) {
      throw new HttpsError('resource-exhausted', 'Limite de decks atingido.');
    }
    const deckId = stableId('folderdeck', authority.folderId, 28);
    const deckRef = authority.userRef.collection('decks').doc(deckId);
    await db.runTransaction(async (transaction) => {
      const [folderSnapshot, deckSnapshot] = await Promise.all([
        transaction.get(authority.folderRef), transaction.get(deckRef),
      ]);
      if (!folderSnapshot.exists || folderSnapshot.data()?.userId !== uid || folderSnapshot.data()?.archived === true) {
        throw new HttpsError('failed-precondition', 'Pasta indisponivel.');
      }
      if (!deckSnapshot.exists) transaction.create(deckRef, {
        userId: uid,
        folderId: authority.folderId,
        name: String(authority.folder.name || 'Flashcards').slice(0, 160),
        description: 'Deck interno da Pasta de Estudos',
        cardCount: 0,
        cardMutationVersion: 0,
        tags: [],
        archived: false,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    });
    return deckId;
  }

  async function loadSession(uid, sessionId) {
    const safeSessionId = safeIdentifier(sessionId, 'sessionId');
    const ref = db.collection('users').doc(uid).collection('adaptive_study_sessions').doc(safeSessionId);
    const snapshot = await ref.get();
    if (!snapshot.exists || snapshot.data()?.userId !== uid) throw new HttpsError('not-found', 'Sessao adaptativa nao encontrada.');
    return { ref, snapshot, data: snapshot.data(), id: safeSessionId };
  }

  async function listSessionItems(uid, sessionId) {
    const snapshot = await db.collection('users').doc(uid).collection('generated_items')
      .where('sessionId', '==', sessionId).get();
    return snapshot.docs.sort((left, right) => {
      const leftTime = left.data()?.createdAt?.toMillis?.() || 0;
      const rightTime = right.data()?.createdAt?.toMillis?.() || 0;
      return leftTime - rightTime || left.id.localeCompare(right.id);
    });
  }

  async function listReadyPreviews(uid, sessionId, maximum = 5) {
    const items = await listSessionItems(uid, sessionId);
    return items.filter((item) => item.data()?.queueState === 'ready').slice(0, maximum).map(transportItem);
  }

  function initialReviewPreview(limits) {
    const state = createInitialState(limits.scheduler);
    return Object.fromEntries(['again', 'hard', 'good', 'easy'].map((rating) => {
      const outcome = schedule(state, rating, { now: new Date(0) });
      return [rating, { intervalMinutes: outcome.intervalMinutes, intervalDays: outcome.intervalDays, status: outcome.status }];
    }));
  }

  async function loadMastery(uid, sourceId) {
    const snapshot = await db.collection('users').doc(uid).collection('concept_mastery')
      .where('sourceId', '==', sourceId).get();
    return new Map(snapshot.docs.map((doc) => [doc.data()?.conceptId, doc.data() || {}]));
  }

  async function reserveDailyGeneration(uid, limits) {
    const day = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Bahia', year: 'numeric', month: '2-digit', day: '2-digit',
    }).format(new Date());
    const ref = db.collection('system_ai_usage').doc(`${day}_${uid}`);
    await db.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(ref);
      const data = snapshot.data() || {};
      const current = Number(data.adaptiveStudyCalls || 0);
      if (current >= limits.adaptiveStudy.maxDailyGenerationCalls) {
        throw new HttpsError('resource-exhausted', 'Limite diario do Tutor Adaptativo atingido.');
      }
      transaction.set(ref, {
        uid, day, adaptiveStudyCalls: current + 1,
        createdAt: data.createdAt || serverTimestamp(), updatedAt: serverTimestamp(),
      }, { merge: true });
    });
  }

  async function refillBuffer({ uid, sessionId, forceTarget = null }) {
    const limits = await getProductLimits(db);
    const session = await loadSession(uid, sessionId);
    if (session.data.status !== 'active') return { generated: 0, discarded: true, readyCount: 0 };
    const allItems = await listSessionItems(uid, session.id);
    const readyCount = allItems.filter((item) => item.data()?.queueState === 'ready').length;
    const generatingItems = allItems.filter((item) => item.data()?.queueState === 'generating');
    const liveLease = (session.data.generationLock?.expiresAt?.toMillis?.() || 0) > Date.now();
    const targetReady = Number(forceTarget || limits.adaptiveStudy.targetReady);
    if (readyCount >= targetReady || liveLease) return { generated: 0, readyCount, busy: liveLease };
    const sessionGenerated = Number(session.data.metrics?.generated || 0);
    if (sessionGenerated >= limits.adaptiveStudy.maxItemsPerSession) {
      throw new HttpsError('resource-exhausted', 'Limite de itens desta sessao atingido.');
    }
    if (Number(session.data.metrics?.generationCalls || 0) >= limits.adaptiveStudy.maxGenerationCallsPerSession
      || Number(session.data.metrics?.tokens || 0) >= limits.adaptiveStudy.maxTokensPerSession) {
      throw new HttpsError('resource-exhausted', 'Limite de IA desta sessao atingido.');
    }
    const maxBatch = forceTarget ? (targetReady - readyCount) : Number(limits.adaptiveStudy.refillSize || 4);
    const requested = Math.min(
      targetReady - readyCount,
      maxBatch,
      Number(limits.adaptiveStudy.maxItemsPerSession) - sessionGenerated,
    );
    const lockToken = crypto.randomUUID();
    const itemRefs = Array.from({ length: requested }, () => session.ref.parent.parent.collection('generated_items').doc());
    const reserved = await db.runTransaction(async (transaction) => {
      const current = await transaction.get(session.ref);
      const data = current.data() || {};
      const lockExpires = data.generationLock?.expiresAt?.toMillis?.() || 0;
      if (!current.exists || data.userId !== uid || data.status !== 'active') return false;
      if (lockExpires > Date.now()) return false;
      // Another refill may have completed since our item query. Do not reserve
      // against that stale snapshot (or discard its placeholders).
      if (data.generationLock?.token !== session.data.generationLock?.token
        || Number(data.metrics?.generationCalls || 0) !== Number(session.data.metrics?.generationCalls || 0)) return false;
      generatingItems.forEach((item) => transaction.update(item.ref, {
        queueState: 'error', status: 'rejected', errorCode: 'generation-lease-expired', updatedAt: serverTimestamp(),
      }));
      transaction.update(session.ref, {
        generationLock: { token: lockToken, expiresAt: admin.firestore.Timestamp.fromMillis(Date.now() + 10 * 60 * 1000) },
        'metrics.generationCalls': Number(data.metrics?.generationCalls || 0) + 1,
        updatedAt: serverTimestamp(),
      });
      itemRefs.forEach((ref) => transaction.create(ref, {
        userId: uid,
        sessionId: session.id,
        folderId: data.folderId,
        sourceId: data.sourceId,
        sourceRevision: data.sourceRevision,
        deckId: data.deckId,
        type: 'flashcard',
        status: 'buffer',
        queueState: 'generating',
        generationToken: lockToken,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }));
      return true;
    });
    if (!reserved) return { generated: 0, readyCount, busy: true };

    try {
      await reserveDailyGeneration(uid, limits);
      const freshSession = await loadSession(uid, session.id);
      let stageStartedAt = Date.now();
      const authority = await loadAuthority(uid, freshSession.data.folderId, freshSession.data.sourceId, limits);
      logAdaptiveStage('read_chunks', stageStartedAt, { sourceId: freshSession.data.sourceId, count: authority.chunks.length });
      if (authority.source.sourceRevision !== freshSession.data.sourceRevision) {
        throw new HttpsError('aborted', 'A fonte mudou durante a sessao.');
      }
      stageStartedAt = Date.now();
      const analysis = await ensureConceptAnalysis(authority, limits);
      logAdaptiveStage('load_concept_inventory', stageStartedAt, { sourceId: authority.sourceId, count: analysis.concepts.length });
      const mastery = await loadMastery(uid, authority.sourceId);
      const existingItems = (await listSessionItems(uid, session.id)).map((snapshot) => snapshot.data() || {});
      const plans = selectConceptPlans(analysis.concepts, mastery, requested, existingItems);
      const planByVariant = new Map(plans.map((plan) => [plan.variantKey, plan]));
      stageStartedAt = Date.now();
      const generationRefKeys = [...new Set(plans.flatMap((plan) => plan.allowedSourceRefKeys))];
      const generationText = generationRefKeys.map((refKey) => authority.refText.get(refKey)).filter(Boolean).join('\n\n---\n\n');
      const compactPrompt = `Crie exatamente um flashcard NOVO e ATÔMICO para cada PLANO. Seja objetivo e conciso. NÃO gere cards longos ou dissertativos.\n\nEASY: pergunta curta de definição, conceito central ou significado direto.\nHARD: pergunta curta de distinção, aplicação prática direta ou relação entre termos.\n\nCopie conceptId, cognitiveDifficulty e variantKey do plano e cite as REF permitidas no campo sourceRefKeys (não no texto visível).\n\nPLANOS\n${JSON.stringify(plans)}\n\nCHUNKS AUTORIZADOS\n${generationText}`;
      logAdaptiveStage('build_prompt', stageStartedAt, { sourceId: authority.sourceId, count: requested });
      const provider = getProvider();
      const result = await provider.generate({
        surface: 'adaptive-flashcards',
        systemPrompt: 'Você é um especialista em criar Flashcards ultradiretos, atômicos e objetivos para estudo ativo estilo Anki. Regras essenciais:\n1. UMA ÚNICA ideia ou fato por flashcard.\n2. Frente: Pergunta ou comando curto, direto e claro (máximo 15-20 palavras).\n3. Verso: Resposta direta, concisa e objetiva (máximo 1 a 3 linhas ou até 30-40 palavras). Proibido textos longos, parágrafos dissertativos ou explicações enciclopédicas.\n4. Divida conteúdos complexos em múltiplos cards atômicos.\n5. NUNCA inclua marcações de citação como [REF ...] no texto da frente ou do verso.\n6. Use apenas evidências presentes nos chunks autorizados.',
        prompt: compactPrompt,
        responseSchema: adaptiveCardSchema(requested),
        temperature: 0.2,
        maxOutputTokens: Math.min(limits.ai.maxOutputTokens, limits.adaptiveStudy.maxTokensPerGeneration),
        requestedCount: requested,
        sourceId: authority.sourceId,
        conceptId: plans.map((plan) => plan.conceptId).join(',').slice(0, 240),
        reduceScopeOnRetry: requested > 1 ? () => {
          const retryPlans = plans.slice(0, 1);
          const retryRefKeys = [...new Set(retryPlans.flatMap((plan) => plan.allowedSourceRefKeys))];
          const retryText = retryRefKeys.map((refKey) => authority.refText.get(refKey)).filter(Boolean).join('\n\n---\n\n');
          return {
            prompt: `Crie exatamente um flashcard curto para este PLANO. Copie os identificadores e use apenas as REF autorizadas.\n\nPLANO\n${JSON.stringify(retryPlans[0])}\n\nCHUNKS\n${retryText}`,
            responseSchema: adaptiveCardSchema(1),
            requestedCount: 1,
            conceptId: retryPlans[0]?.conceptId || null,
          };
        } : null,
      });
      const knownFingerprints = new Set(existingItems.map((item) => item.contentFingerprint).filter(Boolean));
      const accepted = [];
      for (const raw of result.parsedJson.items.slice(0, requested)) {
        const plan = planByVariant.get(String(raw.variantKey || ''));
        if (!plan || raw.conceptId !== plan.conceptId || raw.cognitiveDifficulty !== plan.cognitiveDifficulty) continue;
        const front = cleanText(raw.front, 600);
        const back = cleanText(raw.back, 1500);
        const rawRefKeys = Array.isArray(raw.sourceRefKeys) ? raw.sourceRefKeys.map(String) : [];
        let sourceRefKeys = rawRefKeys
          .map((k) => k.replace(/^\[?\s*REF\s+/i, '').replace(/\]$/, '').trim())
          .filter((refKey) => plan.allowedSourceRefKeys.includes(refKey) && authority.refs.has(refKey)).slice(0, 8);
        if (!sourceRefKeys.length && !rawRefKeys.length) {
          sourceRefKeys = plan.allowedSourceRefKeys.filter((refKey) => authority.refs.has(refKey)).slice(0, 8);
        }
        const fingerprint = contentFingerprint(front, back);
        if (!front || !back || !sourceRefKeys.length || knownFingerprints.has(fingerprint)) continue;
        knownFingerprints.add(fingerprint);
        accepted.push({
          ...plan,
          front,
          back,
          contentFingerprint: fingerprint,
          sourceRefKeys,
          sourceRefs: sourceRefKeys.map((refKey) => authority.refs.get(refKey)),
        });
      }
      stageStartedAt = Date.now();
      const committed = await db.runTransaction(async (transaction) => {
        const current = await transaction.get(session.ref);
        const data = current.data() || {};
        const active = current.exists && data.userId === uid && data.status === 'active'
          && data.sourceRevision === authority.source.sourceRevision
          && data.generationLock?.token === lockToken;
        itemRefs.forEach((ref, index) => {
          const item = accepted[index];
          if (!active || !item) {
            transaction.update(ref, {
              queueState: active ? 'error' : 'cancelled',
              status: active ? 'buffer' : 'rejected',
              errorCode: active ? 'insufficient-grounded-output' : 'late-result-discarded',
              updatedAt: serverTimestamp(),
            });
            return;
          }
          transaction.update(ref, {
            conceptId: item.conceptId,
            conceptName: item.conceptName,
            cognitiveDifficulty: item.cognitiveDifficulty,
            variantKey: item.variantKey,
            contentFingerprint: item.contentFingerprint,
            sourceRefKeys: item.sourceRefKeys,
            sourceRefs: item.sourceRefs,
            promptVersion: CARD_PROMPT_VERSION,
            algorithmVersion: ALGORITHM_VERSION,
            content: { front: item.front, back: item.back },
            tags: [],
            queueState: 'ready',
            readyAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        });
        transaction.update(session.ref, {
          ...(data.generationLock?.token === lockToken ? { generationLock: admin.firestore.FieldValue.delete() } : {}),
          'metrics.generated': Number(data.metrics?.generated || 0) + (active ? accepted.length : 0),
          'metrics.tokens': Number(data.metrics?.tokens || 0) + Number(result.usage?.promptTokens || 0) + Number(result.usage?.outputTokens || 0),
          updatedAt: serverTimestamp(),
        });
        return active;
      });
      logAdaptiveStage('firestore_commit', stageStartedAt, { sourceId: authority.sourceId, count: accepted.length });
      return {
        generated: committed ? accepted.length : 0,
        discarded: !committed,
        readyCount: committed ? readyCount + accepted.length : 0,
      };
    } catch (error) {
      await db.runTransaction(async (transaction) => {
        const current = await transaction.get(session.ref);
        const ownsLease = current.data()?.generationLock?.token === lockToken;
        itemRefs.forEach((ref) => transaction.update(ref, {
          queueState: ownsLease && current.data()?.status === 'active' ? 'error' : 'cancelled',
          status: 'rejected', errorCode: String(error?.code || 'generation-error').slice(0, 80),
          updatedAt: serverTimestamp(),
        }));
        if (ownsLease) transaction.update(session.ref, {
          generationLock: admin.firestore.FieldValue.delete(),
          lastGenerationError: String(error?.message || 'Falha na geracao.').slice(0, 500),
          updatedAt: serverTimestamp(),
        });
      }).catch(() => {});
      throw error;
    }
  }

  async function serveNext(uid, sessionId) {
    const session = await loadSession(uid, sessionId);
    if (session.data.status !== 'active') return null;
    const items = await listSessionItems(uid, session.id);
    const alreadyServed = items.find((item) => item.data()?.queueState === 'served');
    if (alreadyServed) return transportItem(alreadyServed);
    const next = items.find((item) => item.data()?.queueState === 'ready');
    if (!next) return null;
    await db.runTransaction(async (transaction) => {
      const [currentSession, currentItem] = await Promise.all([
        transaction.get(session.ref), transaction.get(next.ref),
      ]);
      if (!currentSession.exists || currentSession.data()?.userId !== uid || currentSession.data()?.status !== 'active') {
        throw new HttpsError('failed-precondition', 'Sessao encerrada.');
      }
      if (!currentItem.exists || currentItem.data()?.queueState !== 'ready') {
        throw new HttpsError('aborted', 'Item ja servido por outra requisicao.');
      }
      transaction.update(next.ref, { queueState: 'served', servedAt: serverTimestamp(), updatedAt: serverTimestamp() });
      transaction.update(session.ref, {
        currentItemId: next.id,
        'metrics.served': Number(currentSession.data()?.metrics?.served || 0) + 1,
        updatedAt: serverTimestamp(),
      });
    });
    return transportItem(await next.ref.get());
  }

  async function startSession({ uid, folderId, sourceId }) {
    if (!uid) throw new HttpsError('unauthenticated', 'Autenticacao obrigatoria.');
    const limits = await getProductLimits(db);
    let stageStartedAt = Date.now();
    const authority = await loadAuthority(uid, folderId, sourceId, limits);
    logAdaptiveStage('read_chunks', stageStartedAt, { sourceId, count: authority.chunks.length });
    stageStartedAt = Date.now();
    const analysis = await ensureConceptAnalysis(authority, limits);
    logAdaptiveStage('load_concept_inventory', stageStartedAt, { sourceId, count: analysis.concepts.length });
    const deckId = await ensureFolderDeck(uid, authority, limits);
    const ref = authority.userRef.collection('adaptive_study_sessions').doc();
    await ref.create({
      userId: uid,
      sourceId: authority.sourceId,
      sourceRevision: authority.source.sourceRevision,
      folderId: authority.folderId,
      deckId,
      mode: 'flashcards',
      status: 'active',
      algorithmVersion: ALGORITHM_VERSION,
      conceptPromptVersion: CONCEPT_PROMPT_VERSION,
      cardPromptVersion: CARD_PROMPT_VERSION,
      conceptCount: analysis.concepts.length,
      metrics: { generated: 0, served: 0, consumed: 0, generationCalls: 0, tokens: 0, ratings: {} },
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      endedAt: null,
    });
    try {
      await refillBuffer({ uid, sessionId: ref.id, forceTarget: Number(limits.adaptiveStudy.targetReady) + 1 });
      const item = await serveNext(uid, ref.id);
      if (!item) throw new HttpsError('failed-precondition', 'Nao foi possivel preparar um flashcard sustentado pela fonte.');
      const prefetchedItems = await listReadyPreviews(uid, ref.id, limits.adaptiveStudy.targetReady);
      return {
        session: { id: ref.id, folderId: authority.folderId, sourceId: authority.sourceId, deckId, status: 'active', reviewPreview: initialReviewPreview(limits) },
        item,
        prefetchedItems,
        buffer: { targetReady: limits.adaptiveStudy.targetReady, lowWatermark: limits.adaptiveStudy.lowWatermark },
      };
    } catch (error) {
      await ref.set({ status: 'error', errorMessage: String(error?.message || 'Falha ao iniciar.').slice(0, 500), endedAt: serverTimestamp(), updatedAt: serverTimestamp() }, { merge: true });
      throw error;
    }
  }

  async function rateItem({ uid, sessionId, itemId, rating, reviewRequestId, elapsedTimeMs }) {
    if (!uid) throw new HttpsError('unauthenticated', 'Autenticacao obrigatoria.');
    const safeItemId = safeIdentifier(itemId, 'itemId');
    const safeRequestId = safeIdentifier(reviewRequestId, 'reviewRequestId');
    if (!['again', 'hard', 'good', 'easy'].includes(rating)) throw new HttpsError('invalid-argument', 'rating invalido.');
    const session = await loadSession(uid, sessionId);
    const userRef = db.collection('users').doc(uid);
    const itemRef = userRef.collection('generated_items').doc(safeItemId);
    const cardId = stableId('adaptive', safeItemId, 32);
    const reviewId = stableId('review', `${safeItemId}\u0000${safeRequestId}`, 36);
    const deckRef = userRef.collection('decks').doc(session.data.deckId);
    const cardRef = deckRef.collection('cards').doc(cardId);
    const reviewRef = userRef.collection('card_reviews').doc(reviewId);
    const sourceRef = userRef.collection('study_sources').doc(session.data.sourceId);
    const folderRef = userRef.collection('study_folders').doc(session.data.folderId);
    const itemPreflight = await itemRef.get();
    if (!itemPreflight.exists || itemPreflight.data()?.userId !== uid || itemPreflight.data()?.sessionId !== session.id) {
      throw new HttpsError('not-found', 'Item adaptativo nao encontrado.');
    }
    const conceptId = safeIdentifier(itemPreflight.data()?.conceptId, 'conceptId');
    const masteryRef = userRef.collection('concept_mastery').doc(masteryDocumentId(session.data.sourceId, conceptId));
    const safeElapsed = elapsedTimeMs == null ? null : Math.max(0, Math.min(Number(elapsedTimeMs) || 0, 24 * 60 * 60 * 1000));
    const limits = await getProductLimits(db);

    const materialized = await db.runTransaction(async (transaction) => {
      const [sessionSnapshot, itemSnapshot, deckSnapshot, cardSnapshot, reviewSnapshot, masterySnapshot, sourceSnapshot, folderSnapshot] = await Promise.all([
        transaction.get(session.ref), transaction.get(itemRef), transaction.get(deckRef), transaction.get(cardRef),
        transaction.get(reviewRef), transaction.get(masteryRef), transaction.get(sourceRef), transaction.get(folderRef),
      ]);
      const sessionData = sessionSnapshot.data() || {};
      const item = itemSnapshot.data() || {};
      if (reviewSnapshot.exists) return { duplicate: true, cardId, reviewId };
      if (!sessionSnapshot.exists || sessionData.userId !== uid || sessionData.status !== 'active') {
        throw new HttpsError('failed-precondition', 'Sessao encerrada.');
      }
      if (!itemSnapshot.exists || item.userId !== uid || item.sessionId !== session.id || !['served', 'ready'].includes(item.queueState)) {
        throw new HttpsError('failed-precondition', 'O item nao esta disponivel para avaliacao nesta sessao.');
      }
      if (item.sourceId !== sessionData.sourceId || item.folderId !== sessionData.folderId
        || item.sourceRevision !== sessionData.sourceRevision || !Array.isArray(item.sourceRefs) || !item.sourceRefs.length) {
        throw new HttpsError('failed-precondition', 'Item sem proveniencia autoritativa.');
      }
      if (!sourceSnapshot.exists || sourceSnapshot.data()?.userId !== uid || sourceSnapshot.data()?.status !== 'ready'
        || sourceSnapshot.data()?.sourceRevision !== sessionData.sourceRevision) {
        throw new HttpsError('failed-precondition', 'A StudySource mudou ou nao esta pronta.');
      }
      if (!folderSnapshot.exists || folderSnapshot.data()?.userId !== uid || folderSnapshot.data()?.archived === true) {
        throw new HttpsError('failed-precondition', 'Pasta indisponivel.');
      }
      if (!deckSnapshot.exists || deckSnapshot.data()?.userId !== uid || deckSnapshot.data()?.folderId !== sessionData.folderId
        || deckSnapshot.data()?.archived === true) {
        throw new HttpsError('failed-precondition', 'Deck interno invalido para a pasta.');
      }
      if (cardSnapshot.exists) throw new HttpsError('already-exists', 'Card deterministico existe sem a revisao correspondente.');
      const now = new Date();
      const initialState = createInitialState(limits.scheduler);
      const outcome = schedule(initialState, rating, { now });
      const evolved = evolveMastery(masterySnapshot.data() || {}, rating, { itemId: safeItemId, at: now.toISOString() });
      const card = {
        userId: uid,
        deckId: sessionData.deckId,
        folderId: sessionData.folderId,
        front: item.content?.front,
        back: item.content?.back,
        tags: Array.isArray(item.tags) ? item.tags : [],
        status: outcome.status,
        dueAt: admin.firestore.Timestamp.fromDate(outcome.dueAt),
        lapses: outcome.isLapse ? 1 : 0,
        reps: outcome.isLapse ? 0 : 1,
        reviewVersion: 1,
        schedulerState: outcome.nextState,
        sourceType: 'ai',
        sourceId: sessionData.sourceId,
        sourceRevision: sessionData.sourceRevision,
        conceptId,
        cognitiveDifficulty: item.cognitiveDifficulty,
        variantKey: item.variantKey,
        contentFingerprint: item.contentFingerprint,
        sourceRefs: item.sourceRefs,
        adaptiveSessionId: session.id,
        generatedItemId: safeItemId,
        createdAt: admin.firestore.Timestamp.fromDate(now),
        updatedAt: admin.firestore.Timestamp.fromDate(now),
      };
      transaction.create(cardRef, card);
      transaction.create(reviewRef, {
        userId: uid,
        cardId,
        deckId: sessionData.deckId,
        folderId: sessionData.folderId,
        rating,
        scheduledDays: outcome.intervalDays,
        previousState: initialState,
        nextState: outcome.nextState,
        reviewRequestId: safeRequestId,
        reviewVersion: 1,
        isLapse: outcome.isLapse,
        adaptiveSessionId: session.id,
        generatedItemId: safeItemId,
        conceptId,
        cognitiveDifficulty: item.cognitiveDifficulty,
        ...(safeElapsed == null ? {} : { elapsedTimeMs: safeElapsed }),
        reviewedAt: admin.firestore.Timestamp.fromDate(now),
      });
      transaction.set(masteryRef, {
        userId: uid,
        sourceId: sessionData.sourceId,
        sourceRevision: sessionData.sourceRevision,
        conceptId,
        conceptName: item.conceptName,
        ...evolved,
        lastSeenAt: admin.firestore.Timestamp.fromDate(now),
        createdAt: masterySnapshot.exists ? masterySnapshot.data()?.createdAt : admin.firestore.Timestamp.fromDate(now),
        updatedAt: admin.firestore.Timestamp.fromDate(now),
      });
      transaction.update(deckRef, {
        cardCount: Number(deckSnapshot.data()?.cardCount || 0) + 1,
        cardMutationVersion: Number(deckSnapshot.data()?.cardMutationVersion || 0) + 1,
        updatedAt: admin.firestore.Timestamp.fromDate(now),
      });
      transaction.update(itemRef, {
        queueState: 'consumed',
        status: 'materialized',
        consumedAt: admin.firestore.Timestamp.fromDate(now),
        materializedCardId: cardId,
        cardReviewId: reviewId,
        firstRating: rating,
        reviewRequestId: safeRequestId,
        updatedAt: admin.firestore.Timestamp.fromDate(now),
      });
      transaction.update(session.ref, {
        currentItemId: null,
        'metrics.consumed': Number(sessionData.metrics?.consumed || 0) + 1,
        [`metrics.ratings.${rating}`]: Number(sessionData.metrics?.ratings?.[rating] || 0) + 1,
        updatedAt: admin.firestore.Timestamp.fromDate(now),
      });
      return { duplicate: false, cardId, reviewId, mastery: evolved };
    });

    const nextItem = await serveNext(uid, session.id);
    const items = await listSessionItems(uid, session.id);
    const readyCount = items.filter((item) => item.data()?.queueState === 'ready').length;
    const prefetchedItems = items.filter((item) => item.data()?.queueState === 'ready').slice(0, limits.adaptiveStudy.targetReady).map(transportItem);
    return {
      ok: true,
      ...materialized,
      nextItem,
      prefetchedItems,
      shouldRefill: readyCount < Number(limits.adaptiveStudy.targetReady),
      readyCount,
    };
  }

  async function refillAndGetNext({ uid, sessionId }) {
    if (!uid) throw new HttpsError('unauthenticated', 'Autenticacao obrigatoria.');
    const refill = await refillBuffer({ uid, sessionId });
    const item = await serveNext(uid, sessionId);
    const limits = await getProductLimits(db);
    const prefetchedItems = await listReadyPreviews(uid, sessionId, limits.adaptiveStudy.targetReady);
    return { refill, item, prefetchedItems };
  }

  async function endSession({ uid, sessionId }) {
    if (!uid) throw new HttpsError('unauthenticated', 'Autenticacao obrigatoria.');
    const session = await loadSession(uid, sessionId);
    await db.runTransaction(async (transaction) => {
      const current = await transaction.get(session.ref);
      if (!current.exists || current.data()?.userId !== uid) throw new HttpsError('not-found', 'Sessao nao encontrada.');
      if (current.data()?.status !== 'active') return;
      transaction.update(session.ref, {
        status: 'cancelled', currentItemId: null, endedAt: serverTimestamp(), updatedAt: serverTimestamp(),
      });
    });
    const items = await listSessionItems(uid, session.id);
    for (let offset = 0; offset < items.length; offset += 300) {
      const batch = db.batch();
      items.slice(offset, offset + 300).forEach((item) => {
        if (ACTIVE_QUEUE_STATES.has(item.data()?.queueState)) {
          batch.update(item.ref, { queueState: 'cancelled', status: 'rejected', updatedAt: serverTimestamp() });
        }
      });
      await batch.commit();
    }
    return { sessionId: session.id, status: 'cancelled' };
  }

  return { endSession, refillAndGetNext, refillBuffer, rateItem, serveNext, startSession };
}

module.exports = {
  ALGORITHM_VERSION,
  CARD_PROMPT_VERSION,
  CONCEPT_PROMPT_VERSION,
  adaptiveCardSchema,
  buildConceptWindows,
  chooseCognitiveDifficulty,
  conceptSchema,
  contentFingerprint,
  createAdaptiveStudyService,
  evolveMastery,
  masteryDocumentId,
  selectConceptPlans,
  stableId,
};
