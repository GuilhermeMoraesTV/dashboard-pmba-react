const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { onSchedule } = require('firebase-functions/v2/scheduler');
const { defineSecret }       = require('firebase-functions/params');
const admin = require('firebase-admin');
const crypto = require('crypto');

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
const AI_DAILY_TOKEN_LIMIT = 90000;
const AI_MAX_PROMPT_CHARS = 24000;
const AI_MAX_OUTPUT_TOKENS = 4096;
const NEWS_CACHE_MAX_ARTICLE_BYTES = 120000;
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

async function reserveAiQuota({ uid, surface, prompt, maxOutputTokens }) {
  const db = admin.firestore();
  const day = todayKey();
  const quotaRef = db.collection('system_ai_usage').doc(`${day}_${uid}`);
  const estimatedTokens = estimateTokenCost(prompt, maxOutputTokens);

  await db.runTransaction(async (transaction) => {
    const snap = await transaction.get(quotaRef);
    const current = Number(snap.data()?.estimatedTokens || 0);
    if (current + estimatedTokens > AI_DAILY_TOKEN_LIMIT) {
      throw new HttpsError('resource-exhausted', 'Limite diario de IA atingido para este usuario.');
    }

    const payload = {
      uid,
      day,
      estimatedTokens: current + estimatedTokens,
      calls: admin.firestore.FieldValue.increment(1),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      surfaces: {
        [surface]: {
          calls: admin.firestore.FieldValue.increment(1),
          estimatedTokens: admin.firestore.FieldValue.increment(estimatedTokens),
        },
      },
    };
    if (!snap.exists) payload.createdAt = admin.firestore.FieldValue.serverTimestamp();

    transaction.set(quotaRef, payload, { merge: true });
  });

  await quotaRef.collection('calls').add({
    uid,
    surface,
    requestedMaxOutputTokens: maxOutputTokens,
    estimatedTokens,
    promptChars: String(prompt || '').length,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });
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
  },
  async (request) => {
    const uid = request.auth?.uid;
    if (!uid) {
      throw new HttpsError('permission-denied', 'Login obrigatorio para usar a IA.');
    }

    const { prompt, maxOutputTokens = 2048, surface = 'outro' } = request.data ?? {};
    const normalizedSurface = normalizeSurface(surface);
    const requestedTokens = Math.floor(Number(maxOutputTokens) || 2048);
    const safeMaxOutputTokens = Math.min(Math.max(requestedTokens, 128), AI_MAX_OUTPUT_TOKENS);

    if (!prompt) {
      throw new HttpsError('invalid-argument', 'O campo "prompt" é obrigatório.');
    }

    if (typeof prompt !== 'string') {
      throw new HttpsError('invalid-argument', 'O campo "prompt" deve ser texto.');
    }
    if (prompt.length > AI_MAX_PROMPT_CHARS) {
      throw new HttpsError('invalid-argument', `Prompt acima do limite de ${AI_MAX_PROMPT_CHARS} caracteres.`);
    }

    try {
      await reserveAiQuota({ uid, surface: normalizedSurface, prompt, maxOutputTokens: safeMaxOutputTokens });
      const text = await callVertexAI(prompt, safeMaxOutputTokens, 0.3);
      return {
        provider: 'google_vertex',
        model: VERTEX_MODEL,
        surface: normalizedSurface,
        text,
        candidates: [{ content: { parts: [{ text }] } }],
      };
    } catch (err) {
      if (err instanceof HttpsError) throw err;
      throw new HttpsError('internal', `Erro ao chamar Vertex AI: ${err.message || err}`);
    }
  }
);

exports.salvarNoticiaCache = onCall(
  {
    timeoutSeconds: 30,
    region: 'us-central1',
  },
  async (request) => {
    const uid = request.auth?.uid;
    if (!uid) {
      throw new HttpsError('permission-denied', 'Login obrigatorio para salvar cache de noticias.');
    }

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

    await admin.firestore().collection('noticiaCache').doc(key).set({
      artigo,
      sourceUrl: url,
      savedBy: uid,
      _savedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });

    return { ok: true, key };
  },
);

exports.abastecerFrasesMotivacionais = onCall(
  {
    secrets: [GOOGLE_SERVICE_ACCOUNT_JSON_BASE64],
    timeoutSeconds: 180,
    region: 'us-central1',
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
