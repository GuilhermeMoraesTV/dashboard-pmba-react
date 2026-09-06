import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { __test } = require('../functions/index.js');

test('IA rejeita chamada anônima', () => {
  assert.throws(
    () => __test.validateAiRequest({ data: { prompt: 'teste' } }),
    (error) => error.code === 'permission-denied',
  );
});

test('IA normaliza superfície e limita tokens por requisição', () => {
  const request = __test.validateAiRequest({
    auth: { uid: 'u1' },
    data: { prompt: 'teste', surface: 'INVALIDA', maxOutputTokens: 999999 },
  });
  assert.equal(request.uid, 'u1');
  assert.equal(request.surface, 'outro');
  assert.equal(request.maxOutputTokens, 4096);
  assert.equal(__test.estimateTokenCost('12345678', 128), 130);
});

const { VertexAIProvider, validateJsonSchema } = require('../functions/ai/provider.js');
const { conceptSchema, adaptiveCardSchema } = require('../functions/adaptiveStudy/service.js');

test('VertexAIProvider retenta em HTTP 429 e sucede na tentativa subsequente', async () => {
  let callCount = 0;
  const mockFetch = async () => {
    callCount += 1;
    if (callCount === 1) {
      return {
        ok: false,
        status: 429,
        text: async () => 'Rate limit exceeded',
      };
    }
    return {
      ok: true,
      status: 200,
      json: async () => ({
        candidates: [{
          content: { parts: [{ text: JSON.stringify({ items: [{ front: 'Pergunta', back: 'Resposta' }] }) }] },
          finishReason: 'STOP',
        }],
        usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 20 },
      }),
    };
  };

  const provider = new VertexAIProvider({
    model: 'gemini-1.5-flash',
    location: 'us-central1',
    projectId: 'test-project',
    getAccessToken: async () => ({ token: 'mock-token', projectId: 'test-project' }),
    fetchImpl: mockFetch,
  });

  const result = await provider.generate({
    surface: 'test',
    prompt: 'Olá',
  });

  assert.equal(callCount, 2);
  assert.ok(result.text.includes('Pergunta'));
});

test('conceptSchema e adaptiveCardSchema toleram textos longos sem rejeitar', () => {
  const cSchema = conceptSchema(2);
  const sampleConcept = {
    concepts: [{
      name: 'Princípio da Legalidade Estrita e Reserva Legal',
      summary: 'A administração pública e os administrados estão vinculados aos preceitos legais e regulamentares estabelecidos pelo ordenamento jurídico vigente, sendo vedado agir contra legem ou praeter legem em matérias reservadas à lei ordinária ou complementar.'.repeat(2),
      sourceRefKeys: ['ref-1', 'ref-2'],
    }],
  };
  assert.doesNotThrow(() => validateJsonSchema(sampleConcept, cSchema));

  const aSchema = adaptiveCardSchema(2);
  const sampleCard = {
    items: [{
      conceptId: 'concept-1',
      cognitiveDifficulty: 'easy',
      variantKey: 'concept-1:easy:v1',
      front: 'O que caracteriza a autoexecutoriedade dos atos administrativos segundo a doutrina majoritária?',
      back: 'A prerrogativa pela qual a Administração Pública pode executar diretamente seus atos materiais sem a necessidade de prévia autorização judicial.'.repeat(2),
      sourceRefKeys: ['ref-1'],
    }],
  };
  assert.doesNotThrow(() => validateJsonSchema(sampleCard, aSchema));
});

