import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire, Module } from 'node:module';
import { fileURLToPath } from 'node:url';
import { transformSync } from 'esbuild';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

test('modal diário real renderiza 4h23 estudados e 6h planejadas sem montar animações', () => {
  const filename = fileURLToPath(new URL('../src/components/shared/DailyGoalCompletedModal.jsx', import.meta.url));
  const require = createRequire(import.meta.url);
  const compiled = new Module(filename);
  const mocks = {
    'react-dom': { createPortal: (children) => children },
    'framer-motion': { AnimatePresence: ({ children }) => children,
      motion: new Proxy({}, { get: () => () => { throw new Error('Animação montada no modal instantâneo'); } }) },
    'lucide-react': new Proxy({}, { get: () => () => null }),
  };
  compiled.require = (id) => id in mocks ? mocks[id] : require(id);
  compiled._compile(transformSync(readFileSync(filename, 'utf8'), { loader: 'jsx', format: 'cjs' }).code, filename);
  const before = globalThis.document;
  globalThis.document = { body: {} };
  try {
    const Modal = compiled.exports.default;
    const html = renderToStaticMarkup(React.createElement(Modal, { open: true, minutes: 263, plannedMinutes: 360 }));
    assert.match(html, /4h23/);
    assert.match(html, /Planejado: 6h/);
    assert.match(html, /text-2xl sm:text-3xl/);
    assert.match(html, /width:100%/);
    assert.doesNotMatch(html, /-inset-y-20/);
    assert.equal(renderToStaticMarkup(React.createElement(Modal, { open: false })), '');
  } finally {
    if (before === undefined) delete globalThis.document;
    else globalThis.document = before;
  }
});

test('Home não celebra na hidratação; Dashboard é o ponto de celebração após salvamento', () => {
  const home = readFileSync(new URL('../src/pages/HomePage/HojeCard.jsx', import.meta.url), 'utf8');
  const dashboard = readFileSync(new URL('../src/components/Dashboard.jsx', import.meta.url), 'utf8');
  const actions = readFileSync(new URL('../src/hooks/useStudyRecordActions.js', import.meta.url), 'utf8');
  assert.doesNotMatch(home, /completionStateRef|dailyGoalReady/);
  assert.match(dashboard, /@ModoQAP:DailyGoalShown:/);
  assert.match(actions, /await syncRegistroAfterSave\([\s\S]*?await checkDailyGoalAfterPlanSync\(\)/);
});
