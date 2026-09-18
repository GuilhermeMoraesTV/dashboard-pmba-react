import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import {
  notifyBeforePwaReload,
  PWA_BEFORE_RELOAD_EVENT,
  PWA_UPDATE_CHECK_INTERVAL_MS,
} from '../src/utils/pwaLifecycle.js';

test('PWA usa manifesto único, identidade estável e verificação ativa de atualização', async () => {
  const [indexHtml, viteConfig, firebaseConfig, statusSource, studyTimerSource, simuladoTimerSource] = await Promise.all([
    readFile(new URL('../index.html', import.meta.url), 'utf8'),
    readFile(new URL('../vite.config.js', import.meta.url), 'utf8'),
    readFile(new URL('../firebase.json', import.meta.url), 'utf8'),
    readFile(new URL('../src/components/shared/PwaStatus.jsx', import.meta.url), 'utf8'),
    readFile(new URL('../src/components/ciclos/StudyTimer/StudyTimer.jsx', import.meta.url), 'utf8'),
    readFile(new URL('../src/pages/SimuladosPage/SimuladoTimer.jsx', import.meta.url), 'utf8'),
  ]);

  assert.doesNotMatch(indexHtml, /rel=["']manifest["']/i);
  assert.match(viteConfig, /id:\s*['"]\/app\/home['"]/);
  assert.match(viteConfig, /manifestFilename:\s*['"]manifest\.webmanifest['"]/);
  assert.match(viteConfig, /registerType:\s*['"]autoUpdate['"]/);
  assert.match(firebaseConfig, /"source":\s*"\/sw\.js"/);
  assert.match(firebaseConfig, /"value":\s*"no-cache, max-age=0, must-revalidate"/);
  assert.match(statusSource, /registration\.update\(\)/);
  assert.match(statusSource, /visibilitychange/);
  assert.match(statusSource, /onNeedReload/);
  assert.doesNotMatch(statusSource, /Nova versão disponível/);
  assert.match(studyTimerSource, /PWA_BEFORE_RELOAD_EVENT/);
  assert.match(simuladoTimerSource, /PWA_BEFORE_RELOAD_EVENT/);
  assert.equal(PWA_UPDATE_CHECK_INTERVAL_MS, 60_000);
});

test('PWA avisa os cronômetros antes do recarregamento automático', () => {
  const target = new EventTarget();
  let received = 0;
  target.addEventListener(PWA_BEFORE_RELOAD_EVENT, () => { received += 1; });

  notifyBeforePwaReload(target);

  assert.equal(received, 1);
});
