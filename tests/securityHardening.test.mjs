import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { JSDOM } from 'jsdom';

const require = createRequire(import.meta.url);
const imageSecurity = require('../functions/security/imageUpload.js');
const { __test } = require('../functions/index.js');
const { escapeCsvValue, openExecutivePdfWindow } = await import('../src/pages/AdminPage/adminOperations.js');

test('CSV neutraliza formulas mesmo quando começam após espaços', () => {
  for (const value of ['=HYPERLINK("https://evil")', ' +SUM(1,1)', '\t@SUM(1,1)', '-2+3']) {
    assert.match(escapeCsvValue(value), /^"'/);
  }
  assert.equal(escapeCsvValue('Aluno "normal"'), '"Aluno ""normal"""');
});

test('relatório executivo cria texto, sem interpretar HTML do usuário', () => {
  const reportDom = new JSDOM('<!doctype html><html><head></head><body></body></html>', { url: 'https://app.local/' });
  let printed = false;
  const originalWindow = globalThis.window;
  globalThis.window = {
    open: () => {
      reportDom.window.print = () => { printed = true; };
      return reportDom.window;
    },
  };
  try {
    assert.equal(openExecutivePdfWindow({
      title: '<img src=x onerror=alert(1)>',
      audience: { label: '<script>bad()</script>', count: 1, description: '<svg onload=bad()>' },
      filters: ['<img src=x>'],
      kpis: [{ label: '<b>XP</b>', value: 10, detail: '<iframe src=x>' }],
      topUsers: [{ name: '<img src=x onerror=bad()>', email: 'x@example.com', status: 'active', hours: 1, questions: 2, accuracy: 50 }],
    }), true);
    assert.equal(reportDom.window.document.querySelectorAll('script,img,svg,iframe').length, 0);
    assert.match(reportDom.window.document.body.textContent, /<img src=x onerror=bad\(\)>/);
    reportDom.window.document.querySelector('button').click();
    assert.equal(printed, true);
  } finally {
    globalThis.window = originalWindow;
    reportDom.window.close();
  }
});

test('cache de notícia elimina marcação ativa e limita o esquema', () => {
  const clean = __test.sanitizeNewsArticle({
    tipo: 'concurso',
    status: 'Edital Publicado',
    conteudo_formatado: '<h3 onclick="bad()">Título</h3><script>bad()</script><p style="color:red">Texto</p><a href="javascript:bad()">link</a>',
    tags: Array.from({ length: 20 }, (_, index) => `tag-${index}`),
    quadro: { banca: '<img src=x>', situacao: 'Edital Publicado' },
    campoInesperado: 'não deve persistir',
  });
  assert.match(clean.conteudo_formatado, /<h3>Título<\/h3>/);
  assert.doesNotMatch(clean.conteudo_formatado, /script|onclick|style=|href=/i);
  assert.equal(clean.tags.length, 8);
  assert.equal(Object.hasOwn(clean, 'campoInesperado'), false);
});

test('normalizador de upload confirma assinatura e reencoda imagem', async () => {
  const onePixelPng = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';
  const normalized = await imageSecurity.normalizeImage({ base64: onePixelPng, contentType: 'image/png' });
  assert.equal(normalized.contentType, 'image/png');
  assert.equal(normalized.extension, 'png');
  assert.ok(normalized.buffer.length > 0);
  await assert.rejects(
    imageSecurity.normalizeImage({ base64: onePixelPng, contentType: 'image/jpeg' }),
    (error) => error.code === 'invalid-argument',
  );
  await assert.rejects(
    imageSecurity.normalizeImage({ base64: Buffer.from('<svg><script>bad()</script></svg>').toString('base64'), contentType: 'image/png' }),
    (error) => error.code === 'invalid-argument',
  );
});
