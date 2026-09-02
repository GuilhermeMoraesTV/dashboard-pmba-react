/**
 * @fileoverview Abstracao de provedor de IA server-side com resposta estruturada.
 */

const { HttpsError } = require('firebase-functions/v2/https');

class AIProviderError extends Error {
  constructor(code, message, details = null) {
    super(message);
    this.name = 'AIProviderError';
    this.code = code;
    this.details = details;
  }
}

function extractModelText(payload) {
  const parts = payload?.candidates?.[0]?.content?.parts;
  if (!Array.isArray(parts)) return '';
  return parts.map((part) => (typeof part?.text === 'string' ? part.text : '')).join('\n').trim();
}

function parseStructuredJson(raw) {
  if (typeof raw !== 'string' || !raw.trim()) {
    throw new AIProviderError('empty-response', 'O provedor de IA retornou uma resposta vazia.');
  }
  const clean = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
  try {
    return JSON.parse(clean);
  } catch {
    throw new AIProviderError('invalid-json', 'O provedor de IA retornou JSON invalido.');
  }
}

function responseDiagnostics(payload, text, attempt, surface) {
  const candidate = payload?.candidates?.[0] || {};
  return {
    surface: String(surface || 'unknown').slice(0, 80),
    attempt,
    finishReason: String(candidate.finishReason || 'UNSPECIFIED').slice(0, 80),
    finishMessage: String(candidate.finishMessage || '').slice(0, 300),
    rawLength: text.length,
    rawPreview: text.slice(0, 800),
    promptTokens: Number(payload?.usageMetadata?.promptTokenCount || 0),
    outputTokens: Number(payload?.usageMetadata?.candidatesTokenCount || 0),
  };
}

function validateJsonSchema(value, schema, path = '$') {
  if (!schema || typeof schema !== 'object') return;
  if (schema.type === 'object') {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      throw new AIProviderError('schema-invalid', `${path} deve ser um objeto.`);
    }
    for (const key of schema.required || []) {
      if (!(key in value)) throw new AIProviderError('schema-invalid', `${path}.${key} e obrigatorio.`);
    }
    if (schema.additionalProperties === false) {
      const allowed = new Set(Object.keys(schema.properties || {}));
      const unexpected = Object.keys(value).find((key) => !allowed.has(key));
      if (unexpected) throw new AIProviderError('schema-invalid', `${path}.${unexpected} nao e permitido.`);
    }
    for (const [key, childSchema] of Object.entries(schema.properties || {})) {
      if (key in value) validateJsonSchema(value[key], childSchema, `${path}.${key}`);
    }
  } else if (schema.type === 'array') {
    if (!Array.isArray(value)) throw new AIProviderError('schema-invalid', `${path} deve ser uma lista.`);
    if (Number.isFinite(schema.minItems) && value.length < schema.minItems) {
      throw new AIProviderError('schema-invalid', `${path} possui menos itens que o permitido.`);
    }
    if (Number.isFinite(schema.maxItems) && value.length > schema.maxItems) {
      throw new AIProviderError('schema-invalid', `${path} possui mais itens que o permitido.`);
    }
    value.forEach((item, index) => validateJsonSchema(item, schema.items, `${path}[${index}]`));
  } else if (schema.type === 'string') {
    if (typeof value !== 'string') throw new AIProviderError('schema-invalid', `${path} deve ser texto.`);
    if (Number.isFinite(schema.minLength) && value.length < schema.minLength) {
      throw new AIProviderError('schema-invalid', `${path} e curto demais.`);
    }
    if (Number.isFinite(schema.maxLength) && value.length > schema.maxLength) {
      throw new AIProviderError('schema-invalid', `${path} excede o tamanho permitido.`);
    }
  } else if (schema.type === 'number' || schema.type === 'integer') {
    if (typeof value !== 'number' || !Number.isFinite(value) || (schema.type === 'integer' && !Number.isInteger(value))) {
      throw new AIProviderError('schema-invalid', `${path} deve ser numerico.`);
    }
  } else if (schema.type === 'boolean' && typeof value !== 'boolean') {
    throw new AIProviderError('schema-invalid', `${path} deve ser booleano.`);
  }
  if (Array.isArray(schema.enum) && !schema.enum.includes(value)) {
    throw new AIProviderError('schema-invalid', `${path} possui valor nao permitido.`);
  }
}

class ServerAIProvider {
  constructor(name = 'abstract') {
    this.name = name;
  }

  async generate(_options) {
    throw new HttpsError('unimplemented', 'Metodo generate deve ser implementado pelo provedor de IA.');
  }
}

class VertexAIProvider extends ServerAIProvider {
  constructor(options) {
    super('google_vertex');
    this.model = options.model;
    this.location = options.location;
    this.projectId = options.projectId || null;
    this.getAccessToken = options.getAccessToken;
    this.fetchImpl = options.fetchImpl || globalThis.fetch;
  }

  async generate(options, attempt = 1) {
    if (!options?.prompt || typeof options.prompt !== 'string') {
      throw new AIProviderError('invalid-request', 'Prompt server-side obrigatorio.');
    }
    if (typeof this.fetchImpl !== 'function') {
      throw new AIProviderError('provider-unavailable', 'Runtime sem suporte a fetch para Vertex AI.');
    }

    const auth = await this.getAccessToken();
    const projectId = this.projectId || auth?.projectId;
    if (!auth?.token || !projectId) {
      throw new AIProviderError('provider-auth-failed', 'Credenciais server-side do Vertex AI indisponiveis.');
    }
    const maxOutputTokens = Math.min(Math.max(Math.floor(Number(options.maxOutputTokens) || 2048), 128), 8192);
    const temperature = Math.min(Math.max(Number(options.temperature) || 0.2, 0), 1);
    const url = `https://${this.location}-aiplatform.googleapis.com/v1/projects/${projectId}/locations/${this.location}/publishers/google/models/${this.model}:generateContent`;
    const body = {
      contents: [{ role: 'user', parts: [{ text: options.prompt }] }],
      generationConfig: {
        temperature: attempt > 1 ? 0 : temperature,
        maxOutputTokens,
        ...(options.responseSchema ? {
          responseMimeType: 'application/json',
          responseJsonSchema: options.responseSchema,
        } : {}),
      },
      ...(options.systemPrompt ? {
        systemInstruction: { parts: [{ text: options.systemPrompt }] },
      } : {}),
    };

    let response;
    try {
      response = await this.fetchImpl(url, {
        method: 'POST',
        headers: { Authorization: `Bearer ${auth.token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
    } catch (error) {
      throw new AIProviderError('provider-unavailable', `Falha de rede no provedor de IA: ${error?.message || error}`);
    }
    if (!response.ok) {
      const responseBody = await response.text().catch(() => '');
      const code = response.status === 429 ? 'quota-exceeded' : 'provider-error';
      throw new AIProviderError(code, `Vertex AI retornou HTTP ${response.status}.`, responseBody.slice(0, 500));
    }

    const payload = await response.json();
    const text = extractModelText(payload);
    const diagnostics = responseDiagnostics(payload, text, attempt, options.surface);
    const retryableFinish = diagnostics.finishReason === 'MAX_TOKENS';
    const blockedFinish = ['SAFETY', 'RECITATION', 'BLOCKLIST', 'PROHIBITED_CONTENT', 'SPII'].includes(diagnostics.finishReason);
    if (blockedFinish) {
      console.warn('[VertexAIProvider] Resposta estruturada bloqueada.', diagnostics);
      throw new AIProviderError('provider-blocked', 'O Vertex AI bloqueou a resposta estruturada.', diagnostics);
    }
    if (retryableFinish && attempt === 1) {
      console.warn('[VertexAIProvider] Resposta estruturada truncada; repetindo uma unica vez.', diagnostics);
      return this.generate({
        ...options,
        temperature: 0,
        maxOutputTokens: Math.min(8192, Math.max(maxOutputTokens + 1024, Math.ceil(maxOutputTokens * 1.5))),
      }, 2);
    }
    if (retryableFinish) {
      console.warn('[VertexAIProvider] Resposta estruturada permaneceu truncada.', diagnostics);
      throw new AIProviderError('truncated-response', 'O Vertex AI encerrou a resposta ao atingir o limite de tokens.', diagnostics);
    }
    let parsedJson;
    if (options.responseSchema) {
      try {
        parsedJson = parseStructuredJson(text);
        validateJsonSchema(parsedJson, options.responseSchema);
      } catch (err) {
        console.warn('[VertexAIProvider] Resposta estruturada invalida.', { ...diagnostics, validationCode: err?.code || 'unknown' });
        if (attempt === 1 && ['empty-response', 'invalid-json', 'schema-invalid'].includes(err.code)) {
          return this.generate({ ...options, temperature: 0 }, 2);
        }
        throw new AIProviderError(
          err?.code || 'invalid-json',
          err?.message || 'O provedor de IA retornou uma resposta estruturada invalida.',
          diagnostics,
        );
      }
    }
    const usageMetadata = payload?.usageMetadata || {};
    return {
      provider: this.name,
      model: this.model,
      text,
      ...(options.responseSchema ? { parsedJson } : {}),
      finishReason: diagnostics.finishReason,
      finishMessage: diagnostics.finishMessage,
      usage: {
        promptTokens: Number(usageMetadata.promptTokenCount || 0),
        outputTokens: Number(usageMetadata.candidatesTokenCount || 0),
      },
    };
  }
}

module.exports = {
  AIProviderError,
  ServerAIProvider,
  VertexAIProvider,
  extractModelText,
  parseStructuredJson,
  responseDiagnostics,
  validateJsonSchema,
};
