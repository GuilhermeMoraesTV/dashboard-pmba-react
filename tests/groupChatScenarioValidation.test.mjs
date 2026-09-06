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
import { loadGroupChatOpening } from '../src/services/groupChat/groupChatViewport.js';

test('Cenário A: Conversa sem não lidas abre na última mensagem', async () => {
  const page = (start, end) => ({
    messages: Array.from({ length: end - start + 1 }, (_, i) => ({ id: `m${start + i}`, seq: start + i, authorId: 'other' })),
    oldestSeq: start,
    highestSeq: end,
    hasMore: start > 1,
  });

  const result = await loadGroupChatOpening({
    uid: 'user1',
    loadState: async () => ({ lastReadSeq: 100, sentCountTotal: 0, sentCountAtRead: 0 }),
    loadLatest: async () => page(71, 100),
    loadAfter: async () => assert.fail('Não deve paginar para frente'),
  });

  assert.equal(result.unreadCount, 0);
  assert.equal(result.firstUnreadId, null);
  assert.equal(result.hasNewer, false);
  assert.deepEqual(result.initialLocation, { index: 'LAST', align: 'end' });
});

test('Cenário B: Conversa com mensagens não lidas abre na primeira não lida', async () => {
  const page = (start, end) => ({
    messages: Array.from({ length: end - start + 1 }, (_, i) => ({ id: `m${start + i}`, seq: start + i, authorId: 'other' })),
    oldestSeq: start,
    highestSeq: end,
    hasMore: start > 1,
  });

  const result = await loadGroupChatOpening({
    uid: 'user1',
    loadState: async () => ({ lastReadSeq: 85, sentCountTotal: 0, sentCountAtRead: 0 }),
    loadLatest: async () => page(71, 100),
    loadAfter: async () => assert.fail('Não deve paginar'),
  });

  assert.equal(result.unreadCount, 15);
  assert.equal(result.firstUnreadId, 'm86');
  assert.deepEqual(result.initialLocation, { index: 15, align: 'start' });
});

test('Cenários C & D & E & F & G & H: Painel Virtuoso isola rolagem, segue mensagens em tempo real e preserva histórico', async () => {
  const dom = new JSDOM('<div id="root"></div>', { url: 'https://chat.test', pretendToBeVisual: true });
  const prior = Object.fromEntries(['window', 'document', 'IS_REACT_ACT_ENVIRONMENT'].map(key => [key, globalThis[key]]));
  Object.assign(globalThis, { window: dom.window, document: dom.window.document, IS_REACT_ACT_ENVIRONMENT: true });
  const timers = new Map();
  let timerId = 0;
  dom.window.setTimeout = callback => { timers.set(++timerId, callback); return timerId; };
  dom.window.clearTimeout = id => timers.delete(id);

  let listProps, incomingListener, readsLogged = [];
  const initialMessages = Array.from({ length: 30 }, (_, i) => ({ id: `m${71 + i}`, seq: 71 + i, authorId: 'other', text: `Mensagem ${71 + i}` }));

  const require = createRequire(import.meta.url);
  const filename = fileURLToPath(new URL('../src/components/groups/GroupChatPanel.jsx', import.meta.url));
  const module = new Module(filename);
  const service = {
    prepareGroupChat: async () => {},
    loadInitialGroupChatMessages: async () => ({
      messages: initialMessages,
      highestSeq: 100,
      highestKnownSeq: 100,
      oldestSeq: 71,
      hasMore: true,
      hasNewer: false,
      unreadCount: 0,
      firstUnreadId: null,
      initialLocation: { index: 'LAST', align: 'end' },
    }),
    subscribeToNewGroupChatMessages: (_, __, callback) => { incomingListener = callback; return () => {}; },
    subscribeToGroupChatTyping: () => () => {},
    loadOlderGroupChatMessages: async (_, seq) => ({
      messages: Array.from({ length: 30 }, (_, i) => ({ id: `m${seq - 30 + i}`, seq: seq - 30 + i, authorId: 'other', text: `Antiga ${seq - 30 + i}` })),
      oldestSeq: seq - 30,
      hasMore: seq - 30 > 1,
    }),
    markGroupChatRead: async (_, __, seq) => { readsLogged.push(seq); return true; },
  };

  const mocks = {
    react: React,
    'react-dom': { createPortal: () => null },
    'react-virtuoso': {
      Virtuoso: props => {
        listProps = props;
        return React.createElement('div', { 'data-testid': 'timeline' });
      },
    },
    'lucide-react': new Proxy({}, { get: () => () => null }),
    'firebase/firestore': { getDoc: async () => ({ exists: () => false }) },
    '../../config/productLimits.js': { DEFAULT_PRODUCT_LIMITS },
    '../../hooks/useOnlineStatus.js': { useOnlineStatus: () => true },
    '../../services/groupChat/groupChatDomain.js': domain,
    '../../services/groupChat/groupChatService.js': service,
  };

  module.require = id => (id in mocks ? mocks[id] : require(id));
  module._compile(transformSync(fs.readFileSync(filename, 'utf8'), { loader: 'jsx', format: 'cjs' }).code, filename);
  const Panel = module.exports.default;
  const root = createRoot(document.getElementById('root'));

  try {
    await act(async () => root.render(React.createElement(Panel, { group: { id: 'g1' }, user: { uid: 'user1' } })));

    // Cenário A: Inicia com LAST quando não há unread
    assert.deepEqual(listProps.initialTopMostItemIndex, { index: 'LAST', align: 'end' });
    assert.equal(listProps.firstItemIndex, 100000);

    // Cenário F: No bottom, followOutput retorna 'auto'
    assert.equal(listProps.followOutput(true), 'auto', 'No bottom, segue mensagens novas automaticamente');

    // Cenário G: Lendo mensagens anteriores (!isAtBottom), followOutput retorna false
    assert.equal(listProps.followOutput(false), false, 'Lendo mensagens anteriores, não desloca o scroll');

    // Cenário C: Rolagem para cima
    await act(async () => {
      listProps.atBottomStateChange(false);
    });
    assert.equal(timers.size, 0, 'Sair do bottom cancela timer de marcação de leitura');

    // Cenário E: Carregamento de mensagens antigas
    await act(async () => {
      listProps.startReached();
    });
    // Deve deslocar o firstItemIndex para 99970 e manter as 60 mensagens
    assert.equal(listProps.firstItemIndex, 99970, 'Preserva a posição visual diminuindo firstItemIndex exatamente pelo total de mensagens inseridas');
    assert.equal(listProps.data.length, 60);

    // Cenário F: Mensagem nova recebida via realtime enquanto no topo
    await act(async () => {
      incomingListener([{ id: 'm101', seq: 101, authorId: 'user2', text: 'Olá grupo' }]);
    });
    assert.equal(listProps.data.length, 61);
    assert.equal(listProps.followOutput(false), false, 'Permanece sem rolar para baixo enquanto o usuário está no topo');

    // Cenário D & H: Usuário desce até o bottom
    await act(async () => {
      listProps.atBottomStateChange(true);
    });
    assert.equal(timers.size, 1, 'Chegar ao bottom agenda marcação de leitura');
    assert.equal(listProps.followOutput(true), 'auto', 'No bottom, volta a seguir saída');

    // Executar timer de leitura
    const timerCallback = timers.values().next().value;
    await act(async () => {
      await timerCallback();
    });
    assert.equal(readsLogged.length, 1);
    assert.equal(readsLogged[0], 101, 'Marca leitura até a última mensagem visualizada');
  } finally {
    await act(async () => root.unmount());
    Object.assign(globalThis, prior);
    dom.window.close();
  }
});
