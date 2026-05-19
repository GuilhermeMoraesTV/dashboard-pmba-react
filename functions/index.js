const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { defineSecret }       = require('firebase-functions/params');

const GEMINI_KEY = defineSecret('GEMINI_API_KEY');
const GEMINI_MODEL = 'gemini-2.5-flash';
const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

exports.chamarGemini = onCall(
  {
    secrets: [GEMINI_KEY],
    timeoutSeconds: 120,
    region: 'us-central1',
  },
  async (request) => {
    const { prompt, maxOutputTokens = 2048 } = request.data ?? {};

    if (!prompt) {
      throw new HttpsError('invalid-argument', 'O campo "prompt" é obrigatório.');
    }

    const url = `${GEMINI_BASE}/${GEMINI_MODEL}:generateContent?key=${GEMINI_KEY.value()}`;

    let res;
    try {
      res = await fetch(url, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.3,
            maxOutputTokens: maxOutputTokens,
          },
        }),
      });
    } catch (err) {
      throw new HttpsError('unavailable', `Erro de rede: ${err.message}`);
    }

    if (!res.ok) {
      throw new HttpsError('internal', `Gemini falhou com status ${res.status}`);
    }

    return await res.json();
  }
);