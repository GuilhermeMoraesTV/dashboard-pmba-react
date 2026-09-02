/** @fileoverview Resolve URIs internas do Anki para URLs autenticadas e sanitiza o HTML final. */

import { getDownloadURL, ref } from 'firebase/storage';
import { auth, storage } from '../../firebaseConfig.js';
import { sanitizeFlashcardHtml } from '../../utils/sanitizeHtml.js';

const INTERNAL_MEDIA_URI = /^anki-media:\/\/([^\s"'<>]+)$/i;

function internalStoragePath(uri, uid) {
  const match = String(uri || '').match(INTERNAL_MEDIA_URI);
  if (!match) return null;
  let path;
  try { path = decodeURIComponent(match[1]); } catch { return null; }
  const prefix = `user_uploads/${uid}/anki_media/`;
  return path.startsWith(prefix) && !path.slice(prefix.length).includes('/') ? path : null;
}

export async function resolveAnkiMediaHtml(html = '', options = {}) {
  const uid = options.uid || auth.currentUser?.uid;
  const getUrl = options.getUrl || ((path) => getDownloadURL(ref(storage, path)));
  const source = String(html || '');
  if (!uid || !source.includes('anki-media://')) return sanitizeFlashcardHtml(source);
  const uris = [...new Set([...source.matchAll(/\bsrc\s*=\s*(["'])(.*?)\1/gi)].map((match) => match[2]).filter((uri) => uri.startsWith('anki-media://')))];
  const resolved = new Map();
  await Promise.all(uris.map(async (uri) => {
    const path = internalStoragePath(uri, uid);
    if (!path) return;
    try { resolved.set(uri, await getUrl(path)); } catch { resolved.set(uri, ''); }
  }));
  const replaced = source.replace(/(\bsrc\s*=\s*)(["'])(.*?)\2/gi, (match, prefix, quote, uri) => {
    if (!uri.startsWith('anki-media://')) return match;
    const url = resolved.get(uri);
    return url ? `${prefix}${quote}${url}${quote}` : '';
  });
  return sanitizeFlashcardHtml(replaced);
}

export { internalStoragePath };
