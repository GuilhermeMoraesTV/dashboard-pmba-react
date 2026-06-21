import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><html><body></body></html>');
globalThis.window = dom.window;
globalThis.document = dom.window.document;

const { sanitizeArticleHtml } = await import('../src/utils/sanitizeHtml.js');

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
