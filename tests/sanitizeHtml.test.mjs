import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><html><body></body></html>');
globalThis.window = dom.window;
globalThis.document = dom.window.document;

const { sanitizeArticleHtml, sanitizeFlashcardHtml } = await import('../src/utils/sanitizeHtml.js');
const { internalStoragePath, resolveAnkiMediaHtml } = await import('../src/services/anki/ankiMedia.js');

test('sanitização remove scripts, handlers, estilos e links', () => {
  const dirty = [
    '<h3 onclick="alert(1)">Título</h3>',
    '<script>window.hacked=true</script>',
    '<p style="color:red">Texto <strong>seguro</strong></p>',
    '<a href="javascript:alert(1)">link</a>',
  ].join('');
  const clean = sanitizeArticleHtml(dirty);
  assert.match(clean, /<h3>Título<\/h3>/);
  assert.match(clean, /<strong>seguro<\/strong>/);
  assert.doesNotMatch(clean, /script|onclick|style=|href=/i);
});

test('HTML de flashcard preserva HTTPS, bloqueia URL ativa e resolve mídia Anki do próprio UID', async () => {
  const internalUri = `anki-media://${encodeURIComponent('user_uploads/user-a/anki_media/hash.png')}`;
  assert.equal(internalStoragePath(internalUri, 'user-a'), 'user_uploads/user-a/anki_media/hash.png');
  assert.equal(internalStoragePath(internalUri, 'user-b'), null);
  const clean = await resolveAnkiMediaHtml(
    `<img src="${internalUri}"><img src="https://example.com/publica.jpg"><img src="javascript:alert(1)">`,
    { uid: 'user-a', getUrl: async (path) => `https://storage.example/${encodeURIComponent(path)}` },
  );
  assert.match(clean, /https:\/\/storage\.example/);
  assert.match(clean, /https:\/\/example\.com\/publica\.jpg/);
  assert.doesNotMatch(clean, /anki-media:|javascript:|alert/i);
  assert.doesNotMatch(sanitizeFlashcardHtml('<img src="http://insegura.example/x.png">'), /src=/i);
});
