import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire, Module } from 'node:module';
import { fileURLToPath } from 'node:url';
import { transformSync } from 'esbuild';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { JSDOM } from 'jsdom';
import { createAdaptiveSessionController } from '../src/services/adaptiveStudy/adaptiveSessionController.js';

test('P0 real AdaptiveStudySession: React StrictMode cleanup + real remount still sends ratings and end waits', async () => {
  const dom = new JSDOM('<div id="root"></div>', { url: 'https://tutor.test' });
  const prior = Object.fromEntries(['window', 'document', 'IS_REACT_ACT_ENVIRONMENT'].map((key) => [key, globalThis[key]]));
  Object.assign(globalThis, { window: dom.window, document: dom.window.document, IS_REACT_ACT_ENVIRONMENT: true });
  let rateProps, headerProps, resolveRating;
  let starts = 0, rates = 0, ends = 0, exits = 0;
  const pending = new Promise((resolve) => { resolveRating = resolve; });
  const require = createRequire(import.meta.url);
  const filename = fileURLToPath(new URL('../src/components/flashcards/AdaptiveStudySession.jsx', import.meta.url));
  const module = new Module(filename);
  const mocks = {
    react: React,
    'lucide-react': { AlertTriangle: () => null, BrainCircuit: () => null, Loader2: () => null, Sparkles: () => null },
    './StudyCard.jsx': (props) => React.createElement('button', { onClick: () => props.onReveal(true) }, props.card.front),
    './ReviewControls.jsx': (props) => { rateProps = props; return null; },
    './StudySessionHeader.jsx': (props) => { headerProps = props; return null; },
    '../../firebaseConfig.js': { auth: { currentUser: { uid: 'strict-owner' } } },
    '../../services/flashcards/cardScheduler.js': { getCardScheduler: () => ({ preview: () => ({}), createInitialState: () => ({}) }) },
    '../../utils/sanitizeHtml.js': { sanitizeFlashcardHtml: (value) => value },
    '../../services/adaptiveStudy/adaptiveSessionController.js': { createAdaptiveSessionController },
    '../../services/adaptiveStudy/adaptiveStudyService.js': {
      startAdaptiveFlashcardSession: async () => { starts++; return { session: { id: 's' }, item: { id: 'A', front: 'A' }, prefetchedItems: [{ id: 'B', front: 'B' }] }; },
      rateAdaptiveFlashcard: () => { rates++; return pending; },
      refillAdaptiveFlashcardSession: () => assert.fail('must not refill during end'),
      endAdaptiveFlashcardSession: async () => { ends++; },
      createReviewRequestId: () => 'strict-review',
    },
  };
  module.require = (id) => id in mocks ? mocks[id] : require(id);
  module._compile(transformSync(fs.readFileSync(filename, 'utf8'), { loader: 'jsx', format: 'cjs', jsx: 'transform' }).code, filename);
  const Component = module.exports.default;
  const props = { folder: { id: 'f', name: 'Pasta' }, source: { id: 'source', title: 'Fonte' }, onExit: () => { exits++; } };
  let root = createRoot(document.getElementById('root'));
  try {
    await act(async () => root.render(React.createElement(React.StrictMode, null, React.createElement(Component, props))));
    assert.equal(starts, 1);
    assert.equal(ends, 0, 'StrictMode cleanup must not cancel session');
    await act(async () => root.unmount());
    root = createRoot(document.getElementById('root'));
    await act(async () => root.render(React.createElement(React.StrictMode, null, React.createElement(Component, props))));
    assert.equal(starts, 1, 'real remount reuses active controller');
    await act(async () => document.querySelector('button').click());
    await act(async () => rateProps.onRate('good'));
    assert.equal(rates, 1);
    let ending;
    await act(async () => { ending = headerProps.onEnd(); });
    assert.equal(ends, 0);
    assert.equal(exits, 0);
    await act(async () => { resolveRating({ nextItem: { id: 'A', front: 'A' } }); await ending; });
    assert.equal(ends, 1);
    assert.equal(exits, 1);
  } finally {
    await act(async () => root.unmount());
    Object.assign(globalThis, prior);
    dom.window.close();
  }
});
