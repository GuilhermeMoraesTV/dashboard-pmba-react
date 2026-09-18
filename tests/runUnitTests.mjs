import { readdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import test from 'node:test';

const testsDirectory = dirname(fileURLToPath(import.meta.url));
const files = (await readdir(testsDirectory))
  .filter((file) => file.endsWith('.test.mjs') && file !== 'firestoreRules.test.mjs')
  .sort();

for (const file of files) {
  try {
    await import(pathToFileURL(join(testsDirectory, file)).href);
  } catch (error) {
    test(`carregamento da suíte ${file}`, () => { throw error; });
  }
}
