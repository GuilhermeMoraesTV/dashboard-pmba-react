import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire, Module } from 'node:module';
import { fileURLToPath } from 'node:url';
import { transformSync } from 'esbuild';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { JSDOM } from 'jsdom';
import * as domain from '../src/services/groupChat/groupChatDomain.js';
import { DEFAULT_PRODUCT_LIMITS } from '../src/config/productLimits.js';

test('painel mantém janela, bloqueia páginas concorrentes e cancela leitura ao sair do final', async () => {
  const dom = new JSDOM('<div id="root"></div>', { url: 'https://chat.test', pretendToBeVisual: true });
  const prior = Object.fromEntries(['window', 'document', 'IS_REACT_ACT_ENVIRONMENT'].map(key => [key, globalThis[key]]));
  Object.assign(globalThis, { window: dom.window, document: dom.window.document, IS_REACT_ACT_ENVIRONMENT: true });
  const timers = new Map();
  let timerId = 0;
  dom.window.setTimeout = callback => { timers.set(++timerId, callback); return timerId; };
  dom.window.clearTimeout = id => timers.delete(id);
  let listProps, incoming, opens = 0, reads = 0, olderCalls = 0, resolveOlder;
  const older = new Promise(resolve => { resolveOlder = resolve; });
  const initialMessages = [11, 12, 13].map(seq => ({ id: `m${seq}`, seq, authorId: 'other' }));
  const require = createRequire(import.meta.url);
  const filename = fileURLToPath(new URL('../src/components/groups/GroupChatPanel.jsx', import.meta.url));
  const module = new Module(filename);
  const service = {
    prepareGroupChat: async () => {},
    loadInitialGroupChatMessages: async () => { opens++; return { messages: initialMessages, highestSeq: 13, highestKnownSeq: 13, oldestSeq: 11, hasMore: true, hasNewer: false, unreadCount: 3, firstUnreadId: 'm11', initialLocation: { index: 0, align: 'start' } }; },
    subscribeToNewGroupChatMessages: (_, __, callback) => { incoming = callback; return () => {}; },
    subscribeToGroupChatTyping: () => () => {},
    loadOlderGroupChatMessages: () => { olderCalls++; return older; },
    markGroupChatRead: async () => { reads++; },
  };
  const mocks = {
    react: React,
    'react-dom': { createPortal: () => null },
    'react-virtuoso': { Virtuoso: props => { listProps = props; return React.createElement('div', { 'data-testid': 'timeline' }); } },
    'lucide-react': new Proxy({}, { get: () => () => null }),
    'firebase/firestore': { getDoc: async () => ({ exists: () => false }) },
    '../../config/productLimits.js': { DEFAULT_PRODUCT_LIMITS },
    '../../hooks/useOnlineStatus.js': { useOnlineStatus: () => true },
    '../../services/groupChat/groupChatDomain.js': domain,
    '../../services/groupChat/groupChatService.js': service,
  };
  module.require = id => id in mocks ? mocks[id] : require(id);
  module._compile(transformSync(fs.readFileSync(filename, 'utf8'), { loader: 'jsx', format: 'cjs' }).code, filename);
  const Panel = module.exports.default;
  const root = createRoot(document.getElementById('root'));
  const props = { group: { id: 'g' }, user: { uid: 'me' } };
  try {
    await act(async () => root.render(React.createElement(Panel, props)));
    assert.equal(opens, 1);
    assert.equal(reads, 0);
    assert.equal(timers.size, 0, 'abrir no início das não lidas não agenda leitura');
    assert.deepEqual(listProps.initialTopMostItemIndex, { index: 100000, align: 'start' });
    const header = listProps.components.Header;
    await act(async () => {
      listProps.isScrolling(true);
      listProps.atTopStateChange(true);
      listProps.startReached();
      listProps.startReached();
    });
    assert.equal(olderCalls, 0, 'não insere páginas durante a inércia do scroll');
    act(() => { listProps.isScrolling(false); });
    assert.equal(olderCalls, 1, 'lock síncrono evita duas páginas antes do render');
    await act(async () => resolveOlder({ messages: [{ id: 'm10', seq: 10 }, initialMessages[0]], oldestSeq: 10, hasMore: false }));
    assert.equal(listProps.firstItemIndex, 99999, 'desloca apenas pelos IDs novos');
    assert.equal(listProps.components.Header, header, 'cabeçalho não remonta');
    await act(async () => incoming([{ id: 'm14', seq: 14, authorId: 'other' }]));
    await act(async () => incoming([{ id: 'm14', seq: 14, authorId: 'other' }]));
    assert.match(document.body.textContent, /Novas mensagens \(4\)/, 'snapshot repetido não duplica badge');
    assert.equal(listProps.followOutput(false), false);
    assert.equal(listProps.followOutput(true), 'auto');
    await act(async () => listProps.atBottomStateChange(true));
    assert.equal(timers.size, 1);
    await act(async () => listProps.atBottomStateChange(false));
    assert.equal(timers.size, 0, 'sair do final cancela leitura pendente');
    await act(async () => root.render(React.createElement(Panel, { ...props, onUnreadChange: () => {} })));
    assert.equal(opens, 1, 'callback novo do pai não reinicia a conversa');
    assert.equal(reads, 0);
  } finally {
    await act(async () => root.unmount());
    Object.assign(globalThis, prior);
    dom.window.close();
  }
});
