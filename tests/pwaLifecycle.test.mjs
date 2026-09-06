import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';

test('PWA usa manifesto único, identidade estável e verificação ativa de atualização', async () => {
  const [indexHtml, viteConfig, statusSource] = await Promise.all([
    readFile(new URL('../index.html', import.meta.url), 'utf8'),
    readFile(new URL('../vite.config.js', import.meta.url), 'utf8'),
    readFile(new URL('../src/components/shared/PwaStatus.jsx', import.meta.url), 'utf8'),
  ]);

  assert.doesNotMatch(indexHtml, /rel=["']manifest["']/i);
  assert.match(viteConfig, /id:\s*['"]\/app\/home['"]/);
  assert.match(viteConfig, /manifestFilename:\s*['"]manifest\.webmanifest['"]/);
  assert.match(statusSource, /registration\.update\(\)/);
  assert.match(statusSource, /visibilitychange/);
});
