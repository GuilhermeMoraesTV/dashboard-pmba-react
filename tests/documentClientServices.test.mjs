import assert from 'node:assert/strict';
import test from 'node:test';
import {
  sanitizeFileName,
  validatePdfFile,
} from '../src/services/documents/documentsService.js';
import {
  sanitizeApkgName,
  validateApkgFile,
} from '../src/services/anki/ankiService.js';

function namedBlob(parts, options, name) {
  const blob = new Blob(parts, options);
  Object.defineProperty(blob, 'name', { value: name, configurable: true });
  return blob;
}

test('cliente valida PDF por tamanho, MIME e assinatura antes do upload', async () => {
  const limits = { storage: { maxPdfSizeBytes: 100 } };
  const valid = namedBlob(['%PDF-1.7\ntexto'], { type: 'application/pdf' }, 'apostila.pdf');
  await assert.doesNotReject(validatePdfFile(valid, limits));
  await assert.rejects(
    validatePdfFile(namedBlob(['%PDF-1.7'], { type: 'text/plain' }, 'falso.pdf'), limits),
    /MIME application\/pdf/,
  );
  await assert.rejects(
    validatePdfFile(namedBlob(['não é pdf'], { type: 'application/pdf' }, 'falso.pdf'), limits),
    /assinatura/,
  );
  await assert.rejects(
    validatePdfFile(namedBlob(['%PDF-', 'x'.repeat(200)], { type: 'application/pdf' }, 'grande.pdf'), limits),
    /limite/,
  );
  assert.equal(sanitizeFileName('../material perigoso'), '.._material perigoso.pdf');
});

test('cliente valida extensão, assinatura e limite do APKG', async () => {
  const limits = { storage: { maxApkgSizeBytes: 100 } };
  const valid = namedBlob([new Uint8Array([0x50, 0x4b, 0x03, 0x04])], { type: 'application/zip' }, 'deck.apkg');
  await assert.doesNotReject(validateApkgFile(valid, limits));
  await assert.rejects(
    validateApkgFile(namedBlob(['não zip'], { type: 'application/zip' }, 'deck.apkg'), limits),
    /assinatura/,
  );
  await assert.rejects(
    validateApkgFile(namedBlob(['PKxx'], { type: 'application/zip' }, 'deck.zip'), limits),
    /extensao/,
  );
  assert.equal(sanitizeApkgName('..\\deck'), '.._deck.apkg');
});
