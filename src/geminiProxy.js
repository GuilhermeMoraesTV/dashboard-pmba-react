/**
 * functions/src/geminiProxy.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Firebase Cloud Function que atua como proxy seguro para a API do Gemini.
 *
 * A API key NUNCA é exposta ao cliente — fica exclusivamente no servidor,
 * armazenada como Firebase Secret (não em variável de ambiente em texto claro).
 *
 * Para registrar o secret antes do deploy:
 *   firebase functions:secrets:set GEMINI_API_KEY
 *   (colar o valor da chave quando solicitado)
 *
 * Para fazer o deploy:
 *   firebase deploy --only functions:chamarGemini
 *
 * Dependências (package.json de /functions):
 *   "firebase-functions": "^6.0.0"   (v2 API disponível a partir da v4)
 *   "node-fetch": "^2.7.0"           (CommonJS-compatible)
 */

const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { defineSecret }       = require('firebase-functions/params');
const fetch                  = require('node-fetch');

// ─── SECRET ───────────────────────────────────────────────────────────────────
// defineSecret vincula o secret do Secret Manager à função.
// O valor real só fica acessível em runtime via GEMINI_KEY.value().
const GEMINI_KEY = defineSecret('GEMINI_API_KEY');

// ─── CONSTANTES ───────────────────────────────────────────────────────────────
const GEMINI_MODEL   = 'gemini-2.5-flash-lite';
const GEMINI_BASE    = 'https://generativelanguage.googleapis.com/v1beta/models';
const MAX_TOKENS_CAP = 8192; // limite de segurança — impede abuso de tokens

// ─── HANDLER ──────────────────────────────────────────────────────────────────

/**
 * Callable function: chamarGemini
 *
 * Payload esperado (request.data):
 *   { prompt: string, maxOutputTokens?: number }
 *
 * Retorna a resposta bruta do Gemini (objeto JSON da API),
 * idêntica ao que a chamada REST direta retornaria.
 * O cliente extrai: result.data?.candidates?.[0]?.content?.parts?.[0]?.text
 */
exports.chamarGemini = onCall(
  {
    secrets:    [GEMINI_KEY],
    // Limita o tempo máximo de execução (a API do Gemini pode ser lenta)
    timeoutSeconds: 120,
    // Região mais próxima dos servidores do Gemini e dos usuários BR
    region: 'us-central1',
  },
  async (request) => {
    const { prompt, maxOutputTokens = 2048 } = request.data ?? {};

    // ── Validação de entrada ─────────────────────────────────────────────────
    if (!prompt || typeof prompt !== 'string' || prompt.trim() === '') {
      throw new HttpsError('invalid-argument', 'O campo "prompt" é obrigatório e deve ser uma string não vazia.');
    }

    const tokens = Math.min(Math.max(256, Number(maxOutputTokens) || 2048), MAX_TOKENS_CAP);

    // ── Chamada à API do Gemini ──────────────────────────────────────────────
    const url = `${GEMINI_BASE}/${GEMINI_MODEL}:generateContent?key=${GEMINI_KEY.value()}`;

    let res;
    try {
      res = await fetch(url, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature:     0.3,
            maxOutputTokens: tokens,
          },
        }),
      });
    } catch (networkErr) {
      throw new HttpsError('unavailable', `Erro de rede ao chamar o Gemini: ${networkErr.message}`);
    }

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new HttpsError(
        'internal',
        `Gemini retornou HTTP ${res.status}. Detalhes: ${body.slice(0, 300)}`
      );
    }

    return await res.json();
  }
);
