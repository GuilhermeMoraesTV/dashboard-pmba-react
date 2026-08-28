const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { onSchedule } = require('firebase-functions/v2/scheduler');
const { onDocumentWritten, onDocumentCreated } = require('firebase-functions/v2/firestore');
const { defineSecret }       = require('firebase-functions/params');
const admin = require('firebase-admin');
const crypto = require('crypto');
const gamification = require('./gamification/service');
const groups = require('./groups/service');
const adminOperations = require('./admin/service');

if (!admin.apps.length) {
  admin.initializeApp();
}

const GOOGLE_SERVICE_ACCOUNT_JSON_BASE64 = defineSecret('GOOGLE_SERVICE_ACCOUNT_JSON_BASE64');
const VERTEX_MODEL = process.env.GOOGLE_VERTEX_MODEL || 'gemini-2.5-flash';
const VERTEX_LOCATION = process.env.GOOGLE_CLOUD_LOCATION || 'us-central1';
const VERTEX_SCOPE = 'https://www.googleapis.com/auth/cloud-platform';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const LEGACY_ADMIN_UID = 'OLoJi457GQNE2eTSOcz9DAD6ppZ2';
const QUOTES_COLLECTION = 'system_quotes';
const QUOTES_AUTOMATION_DOC = 'quotes_automation';
const QUOTE_TARGET_FUTURE_DAYS = 21;
const AI_ALLOWED_SURFACES = new Set(['cronograma', 'noticias', 'edital', 'frases', 'outro']);
const AI_MAX_PROMPT_CHARS = 24000;
const AI_MAX_OUTPUT_TOKENS = 4096;
const NEWS_CACHE_MAX_ARTICLE_BYTES = 120000;
const NEWS_CACHE_DAILY_WRITE_LIMIT = 40;
const NEWS_FETCH_MAX_BYTES = 1500000;
const QUOTE_SOURCES = [
  'https://ultimoconcurso.com/frases-de-motivacao-para-concurso-publico/',
  'https://www.demandaconcursos.com.br/dicas/frases-motivadoras-que-todo-concurseiro-precisa-ler-para-manter-o-foco/',
  'https://www.pensador.com/motivacao_para_estudar/',
  'https://www.collegenp.com/motivation/student-motivation-quotes-study-focus',
];

function dateToYMD(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Bahia',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const get = (type) => parts.find((part) => part.type === type)?.value;
  return `${get('year')}-${get('month')}-${get('day')}`;
}

function addDays(ymd, days) {
  const date = new Date(`${ymd}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function normalizeQuoteText(value = '') {
  return String(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function stripHtml(html = '') {
  return String(html)
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

function safeDocIdFromUrl(url = '') {
  return String(url || '')
    .replace(/^https?:\/\//i, '')
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .slice(0, 500);
}

function validateNewsSourceUrl(value = '') {
  let parsed;
  try {
    parsed = new URL(String(value || ''));
  } catch {
    throw new HttpsError('invalid-argument', 'URL de noticia invalida.');
  }
  const hostname = parsed.hostname.toLowerCase();
  if (parsed.protocol !== 'https:' || hostname !== 'www.estrategiaconcursos.com.br') {
    throw new HttpsError('permission-denied', 'Fonte de noticia nao permitida.');
  }
  if (!parsed.pathname.startsWith('/blog/')) {
    throw new HttpsError('permission-denied', 'Caminho de noticia nao permitido.');
  }
  return parsed.toString();
}

function todayKey() {
  return dateToYMD();
}

function normalizeSurface(surface = 'outro') {
  const value = String(surface || 'outro').toLowerCase().trim();
  return AI_ALLOWED_SURFACES.has(value) ? value : 'outro';
}

function estimateTokenCost(prompt, maxOutputTokens) {
  const promptTokens = Math.ceil(String(prompt || '').length / 4);
  return promptTokens + Number(maxOutputTokens || 0);
}

function validateAiRequest(request = {}) {
  const uid = request.auth?.uid;
  if (!uid) {
    throw new HttpsError('permission-denied', 'Login obrigatorio para usar a IA.');
  }

  const { prompt, maxOutputTokens = 2048, surface = 'outro' } = request.data ?? {};
  if (!prompt) {
    throw new HttpsError('invalid-argument', 'O campo "prompt" é obrigatório.');
  }
  if (typeof prompt !== 'string') {
    throw new HttpsError('invalid-argument', 'O campo "prompt" deve ser texto.');
  }
  if (prompt.length > AI_MAX_PROMPT_CHARS) {
    throw new HttpsError('invalid-argument', `Prompt acima do limite de ${AI_MAX_PROMPT_CHARS} caracteres.`);
  }

  const requestedTokens = Math.floor(Number(maxOutputTokens) || 2048);
  return {
    uid,
    prompt,
    surface: normalizeSurface(surface),
    maxOutputTokens: Math.min(Math.max(requestedTokens, 128), AI_MAX_OUTPUT_TOKENS),
  };
}

async function recordAiUsage({ uid, surface, prompt, maxOutputTokens }) {
  const db = admin.firestore();
  const day = todayKey();
  const quotaRef = db.collection('system_ai_usage').doc(`${day}_${uid}`);
  const estimatedTokens = estimateTokenCost(prompt, maxOutputTokens);

  try {
    await quotaRef.set({
      uid,
      day,
      estimatedTokens: admin.firestore.FieldValue.increment(estimatedTokens),
      calls: admin.firestore.FieldValue.increment(1),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      surfaces: {
        [surface]: {
          calls: admin.firestore.FieldValue.increment(1),
          estimatedTokens: admin.firestore.FieldValue.increment(estimatedTokens),
        },
      },
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });

    await quotaRef.collection('calls').add({
      uid,
      surface,
      requestedMaxOutputTokens: maxOutputTokens,
      estimatedTokens,
      promptChars: String(prompt || '').length,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  } catch (error) {
    // Métricas não podem impedir a funcionalidade principal de IA.
    console.error('Falha ao registrar uso de IA:', error);
  }
}

async function reserveNewsCacheQuota(uid) {
  const db = admin.firestore();
  const day = todayKey();
  const ref = db.collection('system_news_cache_usage').doc(`${day}_${uid}`);
  await db.runTransaction(async (transaction) => {
    const snap = await transaction.get(ref);
    const calls = Number(snap.data()?.calls || 0);
    if (calls >= NEWS_CACHE_DAILY_WRITE_LIMIT) {
      throw new HttpsError('resource-exhausted', 'Limite diario de cache de noticias atingido.');
    }
    transaction.set(ref, {
      uid,
      day,
      calls: calls + 1,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });
  });
}

async function logOperationalFailure(collectionName, payload) {
  try {
    await admin.firestore().collection(collectionName).add({
      ...payload,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  } catch (loggingError) {
    console.error('Falha ao registrar erro operacional:', loggingError);
  }
}

function extractGeminiText(payload) {
  if (typeof payload?.text === 'string') return payload.text.trim();
  const parts = payload?.candidates?.[0]?.content?.parts || [];
  return parts.map((part) => part?.text || '').join('\n').trim();
}

function base64Url(input) {
  return Buffer.from(input)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function getVertexServiceAccount() {
  const raw = GOOGLE_SERVICE_ACCOUNT_JSON_BASE64.value();
  if (!raw) {
    throw new Error('Secret GOOGLE_SERVICE_ACCOUNT_JSON_BASE64 nao configurado.');
  }

  const decoded = Buffer.from(raw, 'base64').toString('utf8');
  const account = JSON.parse(decoded);
  if (!account.client_email || !account.private_key) {
    throw new Error('Service account do Vertex AI sem client_email ou private_key.');
  }

  return {
    ...account,
    private_key: String(account.private_key).replace(/\\n/g, '\n'),
  };
}

async function getVertexAccessToken() {
  const serviceAccount = getVertexServiceAccount();
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'RS256', typ: 'JWT' };
  const claim = {
    iss: serviceAccount.client_email,
    scope: VERTEX_SCOPE,
    aud: TOKEN_URL,
    exp: now + 3600,
    iat: now,
  };

  const unsigned = `${base64Url(JSON.stringify(header))}.${base64Url(JSON.stringify(claim))}`;
  const signature = crypto
    .createSign('RSA-SHA256')
    .update(unsigned)
    .sign(serviceAccount.private_key);
  const assertion = `${unsigned}.${base64Url(signature)}`;

  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion,
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Falha ao autenticar no Google Cloud: HTTP ${res.status} ${body.slice(0, 240)}`);
  }

  const json = await res.json();
  if (!json.access_token) throw new Error('Google Cloud nao retornou access_token.');
  return {
    token: json.access_token,
    projectId: serviceAccount.project_id,
  };
}

function extractJSON(raw) {
  if (!raw || typeof raw !== 'string') return null;
  const clean = raw.replace(/```json/gi, '').replace(/```/g, '').trim();
  try {
    return JSON.parse(clean);
  } catch {
    const starts = ['{', '['];
    for (const start of starts) {
      const index = clean.indexOf(start);
      if (index < 0) continue;
      const end = start === '{' ? '}' : ']';
      let depth = 0;
      let inString = false;
      let escape = false;
      for (let i = index; i < clean.length; i += 1) {
        const char = clean[i];
        if (escape) {
          escape = false;
          continue;
        }
        if (char === '\\' && inString) {
          escape = true;
          continue;
        }
        if (char === '"') inString = !inString;
        if (inString) continue;
        if (char === start) depth += 1;
        if (char === end) depth -= 1;
        if (depth === 0) {
          try {
            return JSON.parse(clean.slice(index, i + 1));
          } catch {
            break;
          }
        }
      }
    }
  }
  return null;
}

async function callVertexAI(prompt, maxOutputTokens = 2048, temperature = 0.55) {
  const { token, projectId: serviceAccountProjectId } = await getVertexAccessToken();
  const projectId = process.env.GOOGLE_CLOUD_PROJECT || serviceAccountProjectId || process.env.GCLOUD_PROJECT;
  if (!projectId) throw new Error('GOOGLE_CLOUD_PROJECT nao configurado e ausente no service account.');

  const url = `https://${VERTEX_LOCATION}-aiplatform.googleapis.com/v1/projects/${projectId}/locations/${VERTEX_LOCATION}/publishers/google/models/${VERTEX_MODEL}:generateContent`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: {
        temperature,
        maxOutputTokens,
      },
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Vertex AI falhou com status ${res.status}: ${body.slice(0, 240)}`);
  }

  return extractGeminiText(await res.json());
}

async function fetchInspirationSources() {
  const results = await Promise.allSettled(
    QUOTE_SOURCES.map(async (url) => {
      const res = await fetch(url, {
        headers: {
          'User-Agent': 'ModoQAP-Quote-Curator/1.0',
        },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const text = stripHtml(await res.text());
      return {
        url,
        excerpt: text.slice(0, 1800),
      };
    }),
  );

  const sources = results
    .filter((result) => result.status === 'fulfilled' && result.value?.excerpt)
    .map((result) => result.value);

  const failures = results
    .filter((result) => result.status === 'rejected')
    .map((result) => String(result.reason?.message || result.reason || 'erro desconhecido').slice(0, 180));

  return { sources, failures };
}

function buildQuotePrompt({ existingQuotes, inspirationSources, count }) {
  const existing = existingQuotes
    .slice(-140)
    .map((quote, index) => `${index + 1}. ${quote.text} - ${quote.author || 'Autor desconhecido'}`)
    .join('\n');

  const sources = inspirationSources.length
    ? inspirationSources.map((source, index) => `Fonte ${index + 1}: ${source.url}\n${source.excerpt}`).join('\n\n')
    : 'Sem fontes externas disponiveis nesta execucao. Use apenas temas gerais de disciplina, constancia e estudo.';

  return `Voce e curador editorial do MODO QAP, um sistema para estudantes de concursos publicos e area policial.

Tarefa: selecionar ou criar ${count} frases motivacionais em portugues brasileiro.

Antes de responder, analise as frases ja cadastradas abaixo como guia editorial:
- mantenha o mesmo padrao de tamanho, tom, intensidade e vocabulario;
- preserve a pegada motivacional que ja existe no sistema;
- evite mudar o estilo para algo poetico demais, generico demais ou longo demais;
- trate as frases existentes como referencia principal de padrao, e a internet como fonte complementar.

Regras obrigatorias:
- Retorne somente JSON valido, sem markdown.
- Estrutura: [{"text":"frase","author":"autor","theme":"disciplina|constancia|foco|prova|revisao|resiliencia","origin":"internet|ia","sourceUrl":"url ou vazio"}]
- Retorne exatamente um array JSON na raiz. Nao use objeto com chave "frases".
- Pode usar frases prontas da internet com ou sem autoria identificada.
- Se usar frase da internet, preserve o texto e o autor informados pela fonte.
- Se a frase da internet nao tiver autor claro, use exatamente "Autor Desconhecido".
- Se criar uma frase nova por IA, use author "Modo QAP".
- Nao use frases identicas ou parecidas com as ja cadastradas.
- Texto entre 55 e 145 caracteres.
- Tom firme, humano e direto para concurseiros; sem promessa de aprovacao garantida.
- Evite cliches como "guerreiro", "campeao", "nunca desista" e "a aprovacao vem".
- Sempre preencha author. Use "Autor Desconhecido" apenas para frase real de internet sem autoria clara.

Frases ja cadastradas para entender o padrao e evitar repeticao:
${existing || 'Nenhuma informada.'}

Materiais online disponiveis nesta execucao. Quando houver frase real e autor claro, voce pode selecionar/adaptar uma frase curta e preencher sourceUrl com a fonte. Se nao houver autoria clara, crie uma frase nova inspirada no tema e use origin "ia":
${sources}`;
}

function normalizeGeneratedQuoteItems(parsed) {
  if (Array.isArray(parsed)) return parsed;
  if (!parsed || typeof parsed !== 'object') return [];
  const keys = ['quotes', 'frases', 'items', 'results', 'data'];
  for (const key of keys) {
    if (Array.isArray(parsed[key])) return parsed[key];
  }
  return [];
}

function sanitizeGeneratedQuotes(rawQuotes, existingKeys, limit) {
  const items = normalizeGeneratedQuoteItems(rawQuotes);
  if (!items.length) return [];
  const accepted = [];
  const localKeys = new Set(existingKeys);

  for (const item of items) {
    const text = String(item?.text || '').replace(/^["']|["']$/g, '').trim();
    if (text.length < 35 || text.length > 170) continue;

    const key = normalizeQuoteText(text);
    if (!key || localKeys.has(key)) continue;

    localKeys.add(key);
    const author = String(item?.author || '').trim();
    const origin = String(item?.origin || '').trim() || 'ia';
    const safeAuthor = author || (origin === 'internet' ? 'Autor Desconhecido' : 'Modo QAP');

    accepted.push({
      text,
      author: safeAuthor,
      theme: String(item?.theme || 'constancia').trim() || 'constancia',
      origin,
      sourceUrl: String(item?.sourceUrl || '').trim(),
    });

    if (accepted.length >= limit) break;
  }

  return accepted;
}

function selectReusableQuoteCandidates(allQuotes, futureKeys, limit) {
  const seen = new Set(futureKeys);
  return allQuotes
    .filter((quote) => quote.text)
    .sort((a, b) => {
      const aDate = a.scheduledDate || '0000-00-00';
      const bDate = b.scheduledDate || '0000-00-00';
      return String(aDate).localeCompare(String(bDate));
    })
    .filter((quote) => {
      const key = normalizeQuoteText(quote.text);
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, limit);
}

async function pruneDuplicateFutureQuotes(db, futureQuotes) {
  const sorted = [...futureQuotes].sort((a, b) => String(a.scheduledDate).localeCompare(String(b.scheduledDate)));
  const seen = new Set();
  const duplicateIds = [];

  sorted.forEach((quote) => {
    const key = normalizeQuoteText(quote.text);
    if (!key) return;
    if (seen.has(key)) {
      duplicateIds.push(quote.id);
      return;
    }
    seen.add(key);
  });

  if (duplicateIds.length === 0) return 0;

  for (let i = 0; i < duplicateIds.length; i += 450) {
    const batch = db.batch();
    duplicateIds.slice(i, i + 450).forEach((id) => {
      batch.delete(db.collection(QUOTES_COLLECTION).doc(id));
    });
    await batch.commit();
  }

  return duplicateIds.length;
}

async function assertAdminCaller(request) {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'Login obrigatorio.');
  if (uid === LEGACY_ADMIN_UID) return;

  const snap = await admin.firestore().doc(`users/${uid}`).get();
  const access = snap.data()?.access || {};
  const permissions = access.permissions || {};
  const isAdmin =
    permissions.adminPanel === true ||
    access.adminRole === 'admin' ||
    access.adminRole === 'super_admin' ||
    access.role === 'admin';

  if (!isAdmin) {
    throw new HttpsError('permission-denied', 'Apenas administradores podem abastecer frases.');
  }
}

async function replenishMotivationalQuotes({ manual = false } = {}) {
  const db = admin.firestore();
  const today = dateToYMD();
  const snapshot = await db.collection(QUOTES_COLLECTION).orderBy('scheduledDate', 'asc').get();
  const allQuotes = snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }));
  let futureQuotes = allQuotes.filter((quote) => quote.scheduledDate && quote.scheduledDate >= today);
  const prunedDuplicates = await pruneDuplicateFutureQuotes(db, futureQuotes);
  const prunedDuplicateIds = new Set();

  if (prunedDuplicates > 0) {
    const sortedFuture = [...futureQuotes].sort((a, b) => String(a.scheduledDate).localeCompare(String(b.scheduledDate)));
    const seen = new Set();
    sortedFuture.forEach((quote) => {
      const key = normalizeQuoteText(quote.text);
      if (!key) return;
      if (seen.has(key)) prunedDuplicateIds.add(quote.id);
      else seen.add(key);
    });
    futureQuotes = futureQuotes.filter((quote) => !prunedDuplicateIds.has(quote.id));
  }

  const occupiedDates = new Set(
    allQuotes
      .filter((quote) => !prunedDuplicateIds.has(quote.id))
      .map((quote) => quote.scheduledDate)
      .filter(Boolean)
  );
  const missing = Math.max(0, QUOTE_TARGET_FUTURE_DAYS - futureQuotes.length);
  const futureKeys = new Set(futureQuotes.map((quote) => normalizeQuoteText(quote.text)).filter(Boolean));

  if (missing === 0 && !manual) {
    await db.collection('system_config').doc(QUOTES_AUTOMATION_DOC).set({
      lastRunAt: admin.firestore.FieldValue.serverTimestamp(),
      lastRunMode: manual ? 'manual' : 'scheduled',
      status: 'ok',
      created: 0,
      reused: 0,
      prunedDuplicates,
      message: 'Estoque futuro suficiente.',
      futureCount: futureQuotes.length,
    }, { merge: true });
    return { created: 0, reused: 0, prunedDuplicates, futureCount: futureQuotes.length, message: 'Estoque futuro suficiente.' };
  }

  const needed = manual ? Math.max(7, missing) : missing;
  const existingKeys = new Set(allQuotes.map((quote) => normalizeQuoteText(quote.text)).filter(Boolean));
  let generatedQuotes = [];
  let inspirationSources = [];
  let inspirationFailures = [];
  const freshTarget = Math.min(manual ? 5 : 3, needed);
  if (freshTarget > 0) {
    const inspiration = await fetchInspirationSources();
    inspirationSources = inspiration.sources;
    inspirationFailures = inspiration.failures;
    const prompt = buildQuotePrompt({
      existingQuotes: allQuotes,
      inspirationSources,
      count: Math.max(freshTarget * 4, freshTarget + 8),
    });
    const raw = await callVertexAI(prompt, 4096, 0.72);
    generatedQuotes = sanitizeGeneratedQuotes(extractJSON(raw), existingKeys, freshTarget);
  }

  const reusableTarget = Math.max(0, needed - generatedQuotes.length);
  const reusable = selectReusableQuoteCandidates(allQuotes, futureKeys, reusableTarget);
  const reusedQuotes = reusable.slice(0, reusableTarget);

  const quotesToSchedule = [
    ...reusedQuotes.map((quote) => ({
      text: quote.text,
      author: quote.author || 'Modo QAP',
      theme: quote.theme || 'reaproveitada',
      source: 'recycled',
      recycledFrom: quote.id,
    })),
    ...generatedQuotes.map((quote) => ({
      ...quote,
      source: quote.origin === 'internet' ? 'internet_quote' : 'ai_generated',
    })),
  ].filter((quote) => {
    const key = normalizeQuoteText(quote.text);
    if (!key || futureKeys.has(key)) return false;
    futureKeys.add(key);
    return true;
  });

  let nextDate = today;
  const batch = db.batch();
  quotesToSchedule.forEach((quote) => {
    while (occupiedDates.has(nextDate)) {
      nextDate = addDays(nextDate, 1);
    }
    occupiedDates.add(nextDate);
    const ref = db.collection(QUOTES_COLLECTION).doc();
    batch.set(ref, {
      text: quote.text,
      author: quote.author || 'Modo QAP',
      theme: quote.theme || 'constancia',
      source: quote.source,
      sourceUrl: quote.sourceUrl || null,
      recycledFrom: quote.recycledFrom || null,
      scheduledDate: nextDate,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      generatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  });

  await batch.commit();

  const summary = {
    created: generatedQuotes.length,
    reused: reusedQuotes.length,
    prunedDuplicates,
    onlineSourcesRead: inspirationSources.length,
    onlineSourceFailures: inspirationFailures.length,
    futureCount: futureQuotes.length + quotesToSchedule.length,
    message: `${quotesToSchedule.length} frase(s) agendada(s).`,
  };

  await db.collection('system_config').doc(QUOTES_AUTOMATION_DOC).set({
    lastRunAt: admin.firestore.FieldValue.serverTimestamp(),
    lastRunMode: manual ? 'manual' : 'scheduled',
    status: 'ok',
    error: admin.firestore.FieldValue.delete(),
    ...summary,
  }, { merge: true });

  return summary;
}

exports.chamarGemini = onCall(
  {
    secrets: [GOOGLE_SERVICE_ACCOUNT_JSON_BASE64],
    timeoutSeconds: 120,
    region: 'us-central1',
    maxInstances: 2,
  },
  async (request) => {
    const {
      uid,
      prompt,
      surface: normalizedSurface,
      maxOutputTokens: safeMaxOutputTokens,
    } = validateAiRequest(request);

    try {
      await recordAiUsage({ uid, surface: normalizedSurface, prompt, maxOutputTokens: safeMaxOutputTokens });
      const text = await callVertexAI(prompt, safeMaxOutputTokens, 0.3);
      return {
        provider: 'google_vertex',
        model: VERTEX_MODEL,
        surface: normalizedSurface,
        text,
        candidates: [{ content: { parts: [{ text }] } }],
      };
    } catch (err) {
      await logOperationalFailure('system_ai_failures', {
        uid,
        surface: normalizedSurface,
        code: err?.code || 'internal',
        message: String(err?.message || err).slice(0, 500),
      });
      if (err instanceof HttpsError) throw err;
      throw new HttpsError('internal', `Erro ao chamar Vertex AI: ${err.message || err}`);
    }
  }
);

exports.salvarNoticiaCache = onCall(
  {
    timeoutSeconds: 30,
    region: 'us-central1',
    maxInstances: 2,
  },
  async (request) => {
    const uid = request.auth?.uid;
    if (!uid) {
      throw new HttpsError('permission-denied', 'Login obrigatorio para salvar cache de noticias.');
    }

    try {
      const { url, artigo } = request.data ?? {};
      if (!url || typeof url !== 'string' || !/^https?:\/\//i.test(url)) {
        throw new HttpsError('invalid-argument', 'URL de noticia invalida.');
      }
      if (!artigo || typeof artigo !== 'object') {
        throw new HttpsError('invalid-argument', 'Artigo invalido.');
      }

      const serialized = JSON.stringify(artigo);
      if (Buffer.byteLength(serialized, 'utf8') > NEWS_CACHE_MAX_ARTICLE_BYTES) {
        throw new HttpsError('invalid-argument', 'Artigo acima do limite permitido para cache.');
      }

      const key = safeDocIdFromUrl(url);
      if (!key) {
        throw new HttpsError('invalid-argument', 'Nao foi possivel gerar chave de cache.');
      }

      await reserveNewsCacheQuota(uid);
      await admin.firestore().collection('noticiaCache').doc(key).set({
        artigo,
        sourceUrl: url,
        savedBy: uid,
        _savedAt: admin.firestore.FieldValue.serverTimestamp(),
      }, { merge: true });

      return { ok: true, key };
    } catch (error) {
      await logOperationalFailure('system_cache_errors', {
        uid,
        code: error?.code || 'internal',
        message: String(error?.message || error).slice(0, 500),
      });
      if (error instanceof HttpsError) throw error;
      throw new HttpsError('internal', 'Nao foi possivel salvar o cache da noticia.');
    }
  },
);

exports.buscarConteudoNoticia = onCall(
  {
    timeoutSeconds: 30,
    region: 'us-central1',
    maxInstances: 2,
  },
  async (request) => {
    const uid = request.auth?.uid;
    if (!uid) {
      throw new HttpsError('permission-denied', 'Login obrigatorio para carregar noticias.');
    }

    const url = validateNewsSourceUrl(request.data?.url);
    try {
      const response = await fetch(url, {
        redirect: 'follow',
        headers: {
          'Accept': 'application/rss+xml, application/xml, text/xml, text/html;q=0.9, */*;q=0.5',
          'User-Agent': 'ModoQAP-NewsReader/1.0',
        },
        signal: AbortSignal.timeout(20000),
      });
      if (!response.ok) {
        throw new Error(`Fonte respondeu HTTP ${response.status}`);
      }
      const contentLength = Number(response.headers.get('content-length') || 0);
      if (contentLength > NEWS_FETCH_MAX_BYTES) {
        throw new HttpsError('resource-exhausted', 'Conteudo de noticia acima do limite permitido.');
      }
      const text = await response.text();
      if (!text || Buffer.byteLength(text, 'utf8') > NEWS_FETCH_MAX_BYTES) {
        throw new HttpsError('resource-exhausted', 'Conteudo de noticia vazio ou acima do limite.');
      }
      return { text, sourceUrl: url };
    } catch (error) {
      if (error instanceof HttpsError) throw error;
      await logOperationalFailure('system_cache_errors', {
        uid,
        sourceUrl: url,
        code: 'news-fetch-failed',
        message: String(error?.message || error).slice(0, 500),
      });
      throw new HttpsError('unavailable', 'Nao foi possivel carregar a fonte de noticias.');
    }
  },
);

exports.abastecerFrasesMotivacionais = onCall(
  {
    secrets: [GOOGLE_SERVICE_ACCOUNT_JSON_BASE64],
    timeoutSeconds: 180,
    region: 'us-central1',
    maxInstances: 1,
  },
  async (request) => {
    await assertAdminCaller(request);
    try {
      return await replenishMotivationalQuotes({ manual: true });
    } catch (err) {
      await admin.firestore().collection('system_config').doc(QUOTES_AUTOMATION_DOC).set({
        lastRunAt: admin.firestore.FieldValue.serverTimestamp(),
        lastRunMode: 'manual',
        status: 'error',
        error: String(err?.message || err).slice(0, 500),
      }, { merge: true });
      throw new HttpsError('internal', `Erro ao abastecer frases: ${err.message || err}`);
    }
  },
);

exports.abastecerFrasesMotivacionaisAgendado = onSchedule(
  {
    schedule: 'every day 05:20',
    timeZone: 'America/Bahia',
    secrets: [GOOGLE_SERVICE_ACCOUNT_JSON_BASE64],
    timeoutSeconds: 180,
    region: 'us-central1',
    maxInstances: 1,
  },
  async () => {
    try {
      await replenishMotivationalQuotes({ manual: false });
    } catch (err) {
      await admin.firestore().collection('system_config').doc(QUOTES_AUTOMATION_DOC).set({
        lastRunAt: admin.firestore.FieldValue.serverTimestamp(),
        lastRunMode: 'scheduled',
        status: 'error',
        error: String(err?.message || err).slice(0, 500),
      }, { merge: true });
      throw err;
    }
  },
);

const gamificationWriteOptions = {
  region: 'us-central1',
  retry: true,
  timeoutSeconds: 300,
  memory: '512MiB',
  maxInstances: 2,
};

const getCurrentGamificationWeekId = (value = new Date()) => {
  const dateKey = dateToYMD(value);
  const cursor = new Date(`${dateKey}T12:00:00Z`);
  const weekday = cursor.getUTCDay() || 7;
  cursor.setUTCDate(cursor.getUTCDate() - weekday + 1);
  return cursor.toISOString().slice(0, 10);
};

const projectTimerPresenceToRankings = async (event) => {
  const uid = event.params.uid;
  if (!uid) return null;
  const timer = event.data?.after?.exists ? (event.data.after.data() || {}) : null;
  const phase = timer?.phase || (timer?.isResting ? 'rest' : 'focus');
  const liveStudy = Boolean(
    timer
    && timer.status === 'running'
    && !timer.isPaused
    && !['rest', 'rest_finished', 'pomodoro_finished'].includes(phase)
  );
  const payload = {
    liveStudy,
    liveStudyHeartbeatAt: liveStudy ? (timer?.heartbeatAt || timer?.updatedAt || null) : null,
    liveStudyUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
  };
  const weekId = getCurrentGamificationWeekId();
  const refs = [
    admin.firestore().collection('weekly_rankings').doc(weekId).collection('members').doc(uid),
    admin.firestore().collection('general_rankings').doc('all').collection('members').doc(uid),
  ];
  const snapshots = await Promise.all(refs.map((ref) => ref.get()));
  const batch = admin.firestore().batch();
  let writes = 0;
  snapshots.forEach((snapshot, index) => {
    if (!snapshot.exists) return;
    batch.set(refs[index], payload, { merge: true });
    writes += 1;
  });
  if (writes) await batch.commit();
  return { uid, liveStudy, writes };
};

const recomputeGamificationFromEvent = async (event) => {
  const uid = event.params.uid || event.params.memberId || event.params.ownerId;
  if (!uid) return null;
  const deletionMarker = await admin.firestore().collection('system_deleted_users').doc(uid).get();
  if (deletionMarker.exists) return { uid, skipped: 'user-deleted' };
  // Projeta primeiro os campos visíveis do perfil e repete ao final. Isso
  // elimina a janela de vários minutos e garante convergência mesmo quando
  // ativações/desativações disparam recálculos concorrentes.
  await gamification.refreshUserPublicPlanningProfile(uid);
  return gamification.recomputeUserGamification(uid);
};

const publicProfileSourceChanged = (before = {}, after = {}) => {
  const fields = ['displayName', 'name', 'nome', 'photoURL', 'coverURL', 'coverPosition', 'createdAt', 'dataCriacao', 'criadoEm', 'registrationDate', 'status', 'disabled'];
  return fields.some((field) => JSON.stringify(before?.[field] ?? null) !== JSON.stringify(after?.[field] ?? null));
};

// Toda pontuação nasce de fontes acadêmicas persistidas. Os gatilhos refazem o
// agregado completo para que edições e exclusões removam o XP da origem.
exports.processarGamificacaoEstudo = onDocumentWritten(
  { ...gamificationWriteOptions, document: 'users/{uid}/registrosEstudo/{recordId}' },
  recomputeGamificationFromEvent,
);
exports.processarGamificacaoSimulado = onDocumentWritten(
  { ...gamificationWriteOptions, document: 'users/{uid}/simulados/{simulationId}' },
  recomputeGamificationFromEvent,
);
exports.processarGamificacaoMeta = onDocumentWritten(
  { ...gamificationWriteOptions, document: 'users/{uid}/metas/{goalId}' },
  recomputeGamificationFromEvent,
);
exports.processarGamificacaoCiclo = onDocumentWritten(
  { ...gamificationWriteOptions, document: 'users/{uid}/ciclos/{cycleId}' },
  recomputeGamificationFromEvent,
);
exports.processarGamificacaoRodadaCiclo = onDocumentWritten(
  { ...gamificationWriteOptions, document: 'users/{uid}/ciclos/{cycleId}/rodadas/{roundId}' },
  recomputeGamificationFromEvent,
);
exports.processarGamificacaoCronograma = onDocumentWritten(
  { ...gamificationWriteOptions, document: 'users/{uid}/cronogramas/{scheduleId}' },
  recomputeGamificationFromEvent,
);
exports.sincronizarPresencaRanking = onDocumentWritten(
  {
    region: 'us-central1',
    retry: true,
    timeoutSeconds: 60,
    memory: '256MiB',
    maxInstances: 4,
    document: 'active_timers/{uid}',
  },
  projectTimerPresenceToRankings,
);
exports.sincronizarRankingMensalGrupoEstudo = onDocumentWritten(
  { ...gamificationWriteOptions, document: 'users/{uid}/registrosEstudo/{recordId}' },
  async (event) => gamification.refreshUserGroupMonthlyRankings(event.params.uid),
);
exports.sincronizarRankingMensalGrupoSimulado = onDocumentWritten(
  { ...gamificationWriteOptions, document: 'users/{uid}/simulados/{simulationId}' },
  async (event) => gamification.refreshUserGroupMonthlyRankings(event.params.uid),
);
// Mantém o perfil social derivado sincronizado quando o usuário altera nome,
// foto ou capa na página de Perfil. O documento privado continua inacessível
// aos demais usuários; apenas os campos públicos seguem para os rankings.
exports.processarGamificacaoPerfilPublico = onDocumentWritten(
  { ...gamificationWriteOptions, document: 'users/{uid}' },
  async (event) => {
    const before = event.data?.before?.data?.() || {};
    const afterSnapshot = event.data?.after;
    if (!afterSnapshot?.exists) return null;
    const after = afterSnapshot.data() || {};
    if (!publicProfileSourceChanged(before, after)) return null;
    return recomputeGamificationFromEvent(event);
  },
);
exports.processarConquistaGrupoCriado = onDocumentCreated(
  { ...gamificationWriteOptions, document: 'study_groups/{groupId}' },
  async (event) => {
    const ownerId = event.data?.data()?.ownerId;
    return ownerId ? gamification.recomputeUserGamification(ownerId) : null;
  },
);
exports.sincronizarDiretorioGrupo = onDocumentWritten(
  { ...gamificationWriteOptions, document: 'study_groups/{groupId}' },
  async (event) => groups.syncGroupDirectory({
    groupId: event.params.groupId,
    group: event.data?.after?.exists ? (event.data.after.data() || {}) : null,
  }),
);
exports.processarConquistaEntradaGrupo = onDocumentCreated(
  { ...gamificationWriteOptions, document: 'study_groups/{groupId}/members/{memberId}' },
  async (event) => gamification.recomputeUserGamification(event.params.memberId),
);
exports.sincronizarRankingMensalEntradaGrupo = onDocumentCreated(
  { ...gamificationWriteOptions, document: 'study_groups/{groupId}/members/{memberId}' },
  async (event) => gamification.refreshUserGroupMonthlyRankings(event.params.memberId, {
    groupIds: [event.params.groupId],
  }),
);
exports.sincronizarContagemMembrosGrupo = onDocumentWritten(
  { ...gamificationWriteOptions, document: 'study_groups/{groupId}/members/{memberId}' },
  async (event) => groups.syncGroupMemberCount({ groupId: event.params.groupId }),
);

const groupCallableOptions = { region: 'us-central1', timeoutSeconds: 60, memory: '256MiB', maxInstances: 3 };
const requireGroupAuth = (request) => {
  if (!request.auth?.uid) throw new HttpsError('unauthenticated', 'Autenticação obrigatória.');
  return request.auth.uid;
};
const mapGroupError = (error) => {
  if (error instanceof HttpsError) return error;
  const allowed = new Set(['invalid-argument', 'not-found', 'failed-precondition', 'permission-denied']);
  const code = allowed.has(error?.code) ? error.code : 'internal';
  return new HttpsError(code, error?.message || 'Não foi possível concluir a ação no grupo.');
};

exports.solicitarEntradaGrupo = onCall(groupCallableOptions, async (request) => {
  try {
    const uid = requireGroupAuth(request);
    return await groups.createJoinRequest({ uid, groupId: request.data?.groupId, caller: request.auth.token || {} });
  } catch (error) { throw mapGroupError(error); }
});

exports.listarGruposEstudo = onCall(groupCallableOptions, async (request) => {
  try {
    requireGroupAuth(request);
    return { groups: await groups.listGroups() };
  } catch (error) { throw mapGroupError(error); }
});

exports.entrarGrupoPrivadoComCodigo = onCall(groupCallableOptions, async (request) => {
  try {
    const uid = requireGroupAuth(request);
    return await groups.joinPrivateGroupByCode({ uid, inviteCode: request.data?.inviteCode, caller: request.auth.token || {} });
  } catch (error) { throw mapGroupError(error); }
});

exports.responderSolicitacaoGrupo = onCall(groupCallableOptions, async (request) => {
  try {
    const managerUid = requireGroupAuth(request);
    return await groups.respondJoinRequest({ managerUid, groupId: request.data?.groupId, requestUid: request.data?.requestUid, approve: request.data?.approve });
  } catch (error) { throw mapGroupError(error); }
});

exports.sairGrupoEstudo = onCall(groupCallableOptions, async (request) => {
  try {
    const uid = requireGroupAuth(request);
    return await groups.leaveGroup({ uid, groupId: request.data?.groupId, successorUid: request.data?.successorUid || null });
  } catch (error) { throw mapGroupError(error); }
});

exports.atualizarPapelMembroGrupo = onCall(groupCallableOptions, async (request) => {
  try {
    const managerUid = requireGroupAuth(request);
    return await groups.updateMemberRole({ managerUid, groupId: request.data?.groupId, memberUid: request.data?.memberUid, viceLeader: request.data?.viceLeader });
  } catch (error) { throw mapGroupError(error); }
});

exports.removerMembroGrupo = onCall(groupCallableOptions, async (request) => {
  try {
    const managerUid = requireGroupAuth(request);
    return await groups.removeMember({ managerUid, groupId: request.data?.groupId, memberUid: request.data?.memberUid });
  } catch (error) { throw mapGroupError(error); }
});

const adminCallableOptions = { region: 'us-central1', timeoutSeconds: 540, memory: '1GiB', maxInstances: 1 };
const adminCallable = (handler) => onCall(adminCallableOptions, async (request) => {
  try {
    const actor = await adminOperations.assertAdmin({ uid: request.auth?.uid, token: request.auth?.token || {} });
    return await handler({ actor, data: request.data || {} });
  } catch (error) {
    if (error instanceof HttpsError) throw error;
    const allowed = new Set(['unauthenticated', 'invalid-argument', 'not-found', 'failed-precondition', 'permission-denied', 'resource-exhausted']);
    const code = allowed.has(error?.code) ? error.code : 'internal';
    console.error('Falha em operacao administrativa:', error);
    throw new HttpsError(code, error?.message || 'Nao foi possivel concluir a operacao administrativa.');
  }
});

exports.adminUpdateUserStatus = adminCallable(({ actor, data }) => adminOperations.updateUserStatus({ actor, targetUid: data.targetUid, status: data.status }));
exports.adminDeleteUserPermanently = adminCallable(({ actor, data }) => adminOperations.deleteUserPermanently({
  actor,
  targetUid: data.targetUid,
  confirmed: data.confirmed === true || data.confirmation === data.targetUid,
}));
exports.adminUpdateUserAccess = adminCallable(({ actor, data }) => adminOperations.updateUserAccess({ actor, targetUid: data.targetUid, access: data.access }));
exports.adminRecalculateUserStats = adminCallable(({ actor, data }) => adminOperations.recalculateUserStats({ actor, targetUid: data.targetUid || null }));
exports.adminRecomputeUserGamification = adminCallable(({ actor, data }) => adminOperations.recomputeUserGamification({ actor, targetUid: data.targetUid, gamification }));
exports.adminSimulateLeagueClosure = adminCallable(({ actor, data }) => adminOperations.simulateLeagueClosure({ actor, weekId: data.weekId, gamification }));
exports.adminRecomputeLeagueWeek = adminCallable(({ actor, data }) => adminOperations.recomputeLeagueWeek({ actor, weekId: data.weekId, gamification }));
exports.adminModerateStudyGroup = adminCallable(({ actor, data }) => adminOperations.moderateStudyGroup({ actor, groupId: data.groupId, action: data.action, payload: data.payload || {} }));
exports.adminSendUserNotification = adminCallable(({ actor, data }) => adminOperations.sendUserNotification({ actor, targetUid: data.targetUid, title: data.title, message: data.message, type: data.type }));
exports.adminSendBroadcast = adminCallable(({ actor, data }) => adminOperations.sendBroadcast({ actor, title: data.title, message: data.message, targetUserIds: data.targetUserIds, segment: data.segment }));
exports.adminExportSegment = adminCallable(({ actor, data }) => adminOperations.exportSegment({ actor, targetUserIds: data.targetUserIds }));

exports.fecharLigasSemanais = onSchedule(
  {
    schedule: 'every monday 00:10',
    timeZone: 'America/Bahia',
    region: 'us-central1',
    retryCount: 3,
    timeoutSeconds: 540,
    memory: '1GiB',
    maxInstances: 1,
  },
  async () => gamification.closeWeeklyGamification(),
);

exports.avisarFechamentoLigas = onSchedule(
  {
    schedule: 'every sunday 18:00',
    timeZone: 'America/Bahia',
    region: 'us-central1',
    retryCount: 2,
    timeoutSeconds: 300,
    memory: '512MiB',
    maxInstances: 1,
  },
  async () => gamification.notifyWeeklyClosing(),
);

exports.atualizarRankingsAtivos = onSchedule(
  {
    schedule: 'every day 03:20',
    timeZone: 'America/Bahia',
    region: 'us-central1',
    retryCount: 2,
    timeoutSeconds: 540,
    memory: '1GiB',
    maxInstances: 1,
  },
  async () => gamification.refreshActiveUserRankings(),
);

exports.atualizarRankingsMensaisGrupos = onSchedule(
  {
    schedule: 'every day 03:30',
    timeZone: 'America/Bahia',
    region: 'us-central1',
    retryCount: 2,
    timeoutSeconds: 540,
    memory: '1GiB',
    maxInstances: 1,
  },
  async () => gamification.refreshStudyGroupMonthlyRankings(),
);

exports.atualizarPerfisPublicosGrupos = onSchedule(
  {
    schedule: 'every day 03:35',
    timeZone: 'America/Bahia',
    region: 'us-central1',
    retryCount: 2,
    timeoutSeconds: 540,
    memory: '1GiB',
    maxInstances: 1,
  },
  async () => gamification.refreshPublicStudyGroupProfiles(),
);

exports.migrarGamificacaoV2 = onCall(
  { region: 'us-central1', timeoutSeconds: 540, memory: '1GiB', maxInstances: 1 },
  async (request) => {
    if (!request.auth?.uid) throw new HttpsError('unauthenticated', 'Autenticacao obrigatoria.');
    const caller = await admin.firestore().collection('users').doc(request.auth.uid).get();
    const callerData = caller.data() || {};
    const isAdmin = callerData.role === 'admin'
      || callerData.adminRole === true
      || callerData.permissions?.adminPanel === true
      || request.auth.uid === LEGACY_ADMIN_UID;
    if (!isAdmin) throw new HttpsError('permission-denied', 'Somente administradores podem simular ou executar a migracao.');
    const apply = request.data?.apply === true;
    return gamification.migrateGamification({ apply, uid: request.data?.uid || null });
  },
);

exports.__test = {
  estimateTokenCost,
  normalizeSurface,
  safeDocIdFromUrl,
  validateNewsSourceUrl,
  validateAiRequest,
  gamification: gamification.__test,
  groups: groups.__test,
  admin: adminOperations.__test,
};
