import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import {
  sanitizeFileName,
  validatePdfFile,
} from '../src/services/documents/documentsService.js';
import {
  buildApkgStoragePath,
  findReusableAnkiFolder,
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
  assert.equal(buildApkgStoragePath('user-1', 'import-1'), 'user_uploads/user-1/anki_imports/import-1/package.apkg');
  assert.equal(sanitizeApkgName('..\\deck'), '.._deck.apkg');
});

test('cliente executa uma única chamada de importação e não repete contra URL direta', async () => {
  const source = await readFile(new URL('../src/services/anki/ankiService.js', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /fetch\s*\(\s*['"]https:\/\/importankipackage/i);
  assert.equal((source.match(/httpsCallable\(functions, 'importAnkiPackage'/g) || []).length, 1);
});

test('cliente reutiliza a árvore Anki mais completa de uma tentativa anterior', () => {
  const folders = [
    { id: 'root-empty', name: 'PMBA', description: 'Importado do Anki', parentFolderId: null },
    { id: 'root-filled', name: 'PMBA', description: 'Importado do Anki', parentFolderId: null },
    { id: 'subject', name: 'Direito', parentFolderId: 'root-filled', ancestorFolderIds: ['root-filled'] },
    { id: 'manual', name: 'PMBA', description: 'Pasta manual', parentFolderId: null },
  ];
  assert.equal(findReusableAnkiFolder(folders, '  pmba ').id, 'root-filled');
  assert.equal(findReusableAnkiFolder(folders, 'Outro'), null);
});
