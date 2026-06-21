import { getFunctions, httpsCallable } from 'firebase/functions';
import { app } from '../firebaseConfig';

const buscarConteudoNoticia = httpsCallable(getFunctions(app, 'us-central1'), 'buscarConteudoNoticia');

const FALLBACK_PROXIES = [
  (url) => `https://corsproxy.io/?${encodeURIComponent(url)}`,
  (url) => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
];

export async function fetchNewsSource(url, options = {}) {
  const { retries = 1 } = options;
  try {
    const result = await buscarConteudoNoticia({ url });
    const text = result?.data?.text;
    if (typeof text === 'string' && text.length > 200) return text;
  } catch {
    // Fallback temporário se a callable estiver indisponível.
  }

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    for (const makeProxy of FALLBACK_PROXIES) {
      try {
        const response = await fetch(makeProxy(url), {
          signal: AbortSignal.timeout(12000),
          headers: { Accept: 'text/html, application/xml, text/xml, */*' },
        });
        if (!response.ok) continue;
        const text = await response.text();
        if (text.length > 200) return text;
      } catch {
        // Tenta a próxima fonte.
      }
    }
  }
  throw new Error('Não foi possível carregar a fonte de notícias.');
}
