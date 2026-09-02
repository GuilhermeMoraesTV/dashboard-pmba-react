import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import test from 'node:test';
import { jsPDF } from 'jspdf';

const require = createRequire(import.meta.url);
const {
  assertPdfBuffer,
  buildDocumentChunks,
  extractPdf,
  normalizeExtractedText,
} = require('../functions/documents/pdf.js');
const {
  AIProviderError,
  VertexAIProvider,
  parseStructuredJson,
  validateJsonSchema,
} = require('../functions/ai/provider.js');
const {
  buildFlashcardSchema,
  buildQuestionSchema,
  normalizeCount,
} = require('../functions/ai/generation.js');

const limits = {
  storage: { maxPdfSizeBytes: 1024 * 1024 },
  ai: { maxDocumentPagesForAI: 10 },
  documents: {
    chunkTargetChars: 500,
    chunkOverlapChars: 40,
    maxExtractedTextChars: 10000,
    maxChunks: 20,
  },
};

test('PDF valida MIME, assinatura e limite no backend', () => {
  const valid = Buffer.from('%PDF-1.7\nconteudo');
  assert.doesNotThrow(() => assertPdfBuffer(valid, { contentType: 'application/pdf' }, limits));
  assert.throws(
    () => assertPdfBuffer(valid, { contentType: 'text/plain' }, limits),
    (error) => error.code === 'invalid-mime',
  );
  assert.throws(
    () => assertPdfBuffer(Buffer.from('nao-pdf!!'), { contentType: 'application/pdf' }, limits),
    (error) => error.code === 'invalid-signature',
  );
  assert.throws(
    () => assertPdfBuffer(Buffer.alloc(limits.storage.maxPdfSizeBytes + 1, 1), { contentType: 'application/pdf' }, limits),
    (error) => error.code === 'file-too-large',
  );
});

test('normalizacao Unicode e chunking preservam ordem e paginas', () => {
  assert.equal(normalizeExtractedText('  Ac\u0327a\u0303o\u00a0\u0000 segura  '), 'Ação segura');
  const result = buildDocumentChunks([
    { pageNumber: 1, text: 'Primeiro parágrafo. '.repeat(24) },
    { pageNumber: 2, text: 'Segundo parágrafo. '.repeat(24) },
  ], limits.documents);
  assert.ok(result.chunks.length >= 2);
  assert.deepEqual(result.chunks.map((chunk) => chunk.order), result.chunks.map((_chunk, index) => index));
  assert.equal(result.chunks[0].pageStart, 1);
  assert.equal(result.chunks.at(-1).pageEnd, 2);
  assert.ok(result.chunks.every((chunk) => chunk.documentId === undefined && chunk.content.length > 0));
});

test('extracao real de PDF textual produz chunks rastreaveis', async () => {
  const pdf = new jsPDF();
  pdf.text('ModoQAP documento privado com texto extraivel para estudo e revisao.', 15, 20);
  pdf.addPage();
  pdf.text('Segunda pagina com conteudo suficiente para validar rastreabilidade.', 15, 20);
  const buffer = Buffer.from(pdf.output('arraybuffer'));
  const result = await extractPdf(buffer, limits, { metadata: { contentType: 'application/pdf' } });
  assert.equal(result.pageCount, 2);
  assert.equal(result.processedPageCount, 2);
  assert.ok(result.textCharCount > 20);
  assert.equal(result.chunks[0].pageStart, 1);
  assert.equal(result.chunks.at(-1).pageEnd, 2);
});

test('PDF maior que a janela de IA continua processavel e ready com aviso', async () => {
  const pdf = new jsPDF();
  pdf.text('Pagina 1 com texto suficiente para processamento seguro do documento.', 15, 20);
  pdf.addPage();
  pdf.text('Pagina 2 tambem deve ser extraida, apesar da janela menor da IA.', 15, 20);
  pdf.addPage();
  pdf.text('Pagina 3 permanece armazenada para uso futuro e rastreabilidade.', 15, 20);
  const buffer = Buffer.from(pdf.output('arraybuffer'));
  const smallAiWindowLimits = { ...limits, ai: { ...limits.ai, maxDocumentPagesForAI: 1 } };
  const result = await extractPdf(buffer, smallAiWindowLimits, { metadata: { contentType: 'application/pdf' } });
  assert.equal(result.pageCount, 3);
  assert.equal(result.processedPageCount, 3);
  assert.equal(result.chunks.at(-1).pageEnd, 3);
  assert.match(result.warning, /PDF processado e pronto/);
  assert.match(result.warning, /1 paginas/);
});

test('PDF sem texto extraivel reporta necessidade de OCR sem aplica-lo', async () => {
  const pdf = new jsPDF();
  const buffer = Buffer.from(pdf.output('arraybuffer'));
  await assert.rejects(
    extractPdf(buffer, limits, { metadata: { contentType: 'application/pdf' } }),
    (error) => error.code === 'no-extractable-text' && /OCR/.test(error.message),
  );
});

test('schemas de IA rejeitam resposta incompleta, excedente e campos inesperados', () => {
  const schema = buildFlashcardSchema(2);
  assert.doesNotThrow(() => validateJsonSchema({ items: [{ front: 'F', back: 'B', tags: [] }] }, schema));
  assert.throws(
    () => validateJsonSchema({ items: [{ front: 'F', tags: [] }] }, schema),
    (error) => error instanceof AIProviderError && error.code === 'schema-invalid',
  );
  assert.throws(
    () => validateJsonSchema({ items: [], secret: 'nao permitido' }, schema),
    (error) => error.code === 'schema-invalid',
  );
  assert.throws(
    () => validateJsonSchema({ items: [
      { front: '1', back: '1', tags: [] },
      { front: '2', back: '2', tags: [] },
      { front: '3', back: '3', tags: [] },
    ] }, schema),
    (error) => error.code === 'schema-invalid',
  );
  assert.equal(normalizeCount(999, 10, 30), 30);
  assert.ok(buildQuestionSchema(5).properties.items.maxItems === 5);
});

test('provider Vertex usa credencial server-side e retorna JSON validado', async () => {
  let request;
  const provider = new VertexAIProvider({
    model: 'gemini-test',
    location: 'us-central1',
    projectId: 'projeto-teste',
    getAccessToken: async () => ({ token: 'token-servidor' }),
    fetchImpl: async (url, options) => {
      request = { url, options };
      return {
        ok: true,
        json: async () => ({
          candidates: [{ content: { parts: [{ text: '{"items":[{"front":"F","back":"B","tags":[]}]}' }] } }],
          usageMetadata: { promptTokenCount: 11, candidatesTokenCount: 7 },
        }),
      };
    },
  });
  const result = await provider.generate({ prompt: 'interno', responseSchema: buildFlashcardSchema(1) });
  assert.equal(result.parsedJson.items[0].back, 'B');
  assert.match(request.url, /projeto-teste/);
  assert.equal(request.options.headers.Authorization, 'Bearer token-servidor');
  const generationConfig = JSON.parse(request.options.body).generationConfig;
  assert.equal(generationConfig.responseMimeType, 'application/json');
  assert.equal(generationConfig.responseJsonSchema.type, 'object');
  assert.equal(generationConfig.responseSchema, undefined);
});

test('provider trata JSON invalido, schema invalido e falha/quota externa', async () => {
  assert.throws(() => parseStructuredJson('```json\nnao-json\n```'), (error) => error.code === 'invalid-json');
  const failureProvider = new VertexAIProvider({
    model: 'gemini-test', location: 'us-central1', projectId: 'p',
    getAccessToken: async () => ({ token: 't' }),
    fetchImpl: async () => ({ ok: false, status: 429, text: async () => 'quota' }),
  });
  await assert.rejects(
    failureProvider.generate({ prompt: 'interno', responseSchema: buildFlashcardSchema(1) }),
    (error) => error.code === 'quota-exceeded',
  );
  let invalidAttempts = 0;
  const invalidSchemaProvider = new VertexAIProvider({
    model: 'gemini-test', location: 'us-central1', projectId: 'p',
    getAccessToken: async () => ({ token: 't' }),
    fetchImpl: async () => {
      invalidAttempts += 1;
      return ({
      ok: true,
      json: async () => ({ candidates: [{ content: { parts: [{ text: '{"items":[{"front":"sem verso","tags":[]}]}' }] } }] }),
      });
    },
  });
  await assert.rejects(
    invalidSchemaProvider.generate({ prompt: 'interno', responseSchema: buildFlashcardSchema(1) }),
    (error) => error.code === 'schema-invalid',
  );
  assert.equal(invalidAttempts, 2);
});

test('provider registra finishReason e faz no maximo um retry quando Vertex trunca', async () => {
  let attempts = 0;
  const provider = new VertexAIProvider({
    model: 'gemini-test', location: 'us-central1', projectId: 'p',
    getAccessToken: async () => ({ token: 't' }),
    fetchImpl: async () => {
      attempts += 1;
      return {
        ok: true,
        json: async () => ({
          candidates: [{ finishReason: 'MAX_TOKENS', finishMessage: 'token limit', content: { parts: [{ text: '{"items":[' }] } }],
          usageMetadata: { promptTokenCount: 100, candidatesTokenCount: 2048 },
        }),
      };
    },
  });
  await assert.rejects(
    provider.generate({ prompt: 'interno', surface: 'concept-analysis', responseSchema: buildFlashcardSchema(1), maxOutputTokens: 1024 }),
    (error) => error.code === 'truncated-response'
      && error.details.finishReason === 'MAX_TOKENS'
      && error.details.attempt === 2
      && error.details.surface === 'concept-analysis',
  );
  assert.equal(attempts, 2);
});
