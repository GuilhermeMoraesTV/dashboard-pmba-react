import { readdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const testsDirectory = dirname(fileURLToPath(import.meta.url));
const files = (await readdir(testsDirectory))
  .filter((file) => file.endsWith('.test.mjs') && file !== 'firestoreRules.test.mjs')
  .sort();

for (const file of files) {
  await import(pathToFileURL(join(testsDirectory, file)).href);
}
