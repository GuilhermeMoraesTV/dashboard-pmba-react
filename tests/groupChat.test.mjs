import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  calculateGroupChatUnread,
  canEditGroupChatMessage,
  estimateGroupChatOperations,
  getMentionAutocompleteQuery,
  getMentionAllUids,
  getTypingLabel,
  mergeGroupChatMessages,
  normalizeMentionUids,
  normalizeMessageText,
  replaceMentionAutocomplete,
  retainedReadFloor,
  shouldReconcileRetainedHistory,
} from '../src/services/groupChat/groupChatDomain.js';
import { DEFAULT_PRODUCT_LIMITS } from '../src/config/productLimits.js';

test('chat normaliza texto e limita conteúdo e menções', () => {
  assert.equal(normalizeMessageText('  Olá, grupo!  '), 'Olá, grupo!');
  assert.throws(() => normalizeMessageText('   '), /Digite uma mensagem/);
  assert.throws(() => normalizeMessageText('a'.repeat(4001)), /4\.000/);
  assert.deepEqual(normalizeMentionUids(['u2', 'u2', 'u1'], 'u1'), ['u2']);
  assert.equal(normalizeMentionUids(Array.from({ length: 10 }, (_, index) => `u${index}`)).length, 10);
  assert.throws(() => normalizeMentionUids(Array.from({ length: 11 }, (_, index) => `u${index}`)), /10 pessoas/);
  assert.deepEqual(getMentionAllUids([{ uid: 'u1' }, { id: 'u2' }, { uid: 'u2' }, { uid: 'u3' }], 'u1'), ['u2', 'u3']);
});

test('unread exclui mensagens próprias desde a última leitura', () => {
  assert.equal(calculateGroupChatUnread({ lastSeq: 110 }, { lastReadSeq: 100, sentCountTotal: 8, sentCountAtRead: 5 }), 7);
  assert.equal(calculateGroupChatUnread({ lastSeq: 3 }, { lastReadSeq: 0, sentCountTotal: 10, sentCountAtRead: 0 }), 0);
});

test('novo membro inicia no final e retenção avança apenas o piso expirado', () => {
  const initialState = { lastReadSeq: 87, sentCountTotal: 0, sentCountAtRead: 0 };
  assert.equal(calculateGroupChatUnread({ lastSeq: 87 }, initialState), 0);
  assert.equal(retainedReadFloor(51, 10), 50);
  assert.equal(retainedReadFloor(51, 70), 70);
  assert.equal(shouldReconcileRetainedHistory({ readAt: new Date(Date.now() - 91 * 86400000) }), true);
  assert.equal(shouldReconcileRetainedHistory({ readAt: new Date() }), false);
});

test('janela de edição respeita quinze minutos e soft delete', () => {
  const recent = { authorId: 'u1', createdAt: new Date(Date.now() - 14 * 60000), deleted: false };
  const old = { ...recent, createdAt: new Date(Date.now() - 16 * 60000) };
  assert.equal(canEditGroupChatMessage(recent, 'u1'), true);
  assert.equal(canEditGroupChatMessage(old, 'u1'), false);
  assert.equal(canEditGroupChatMessage({ ...recent, deleted: true }, 'u1'), false);
  assert.equal(canEditGroupChatMessage(recent, 'u2'), false);
});

test('merge otimista remove duplicação quando o snapshot confirmado chega', () => {
  const merged = mergeGroupChatMessages(
    [{ id: 'm1', seq: Number.MAX_SAFE_INTEGER, text: 'Oi', deliveryState: 'sending' }],
    [{ id: 'm1', seq: 3, text: 'Oi', deliveryState: 'sent' }, { id: 'm2', seq: 4, text: 'Tudo bem?', deliveryState: 'sent' }],
  );
  assert.deepEqual(merged.map((item) => item.id), ['m1', 'm2']);
  assert.equal(merged[0].deliveryState, 'sent');
});

test('autocomplete de menção e typing são determinísticos', () => {
  assert.equal(getMentionAutocompleteQuery('Olá @mar'), 'mar');
  assert.equal(getMentionAutocompleteQuery('Olá @maria tudo bem'), null);
  assert.equal(replaceMentionAutocomplete('Olá @mar', 'Maria Silva'), 'Olá @Maria Silva ');
  const now = Date.now();
  assert.equal(getTypingLabel([{ uid: 'u2', name: 'Maria', typingUntil: new Date(now + 5000) }], 'u1', now), 'Maria está digitando...');
  assert.equal(getTypingLabel([{ uid: 'u1', name: 'Eu', typingUntil: new Date(now + 5000) }], 'u1', now), '');
});

test('instrumentação de custo mantém 1.000 mensagens em crescimento linear', () => {
  const one = estimateGroupChatOperations('send');
  const thousand = { reads: one.reads * 1000, writes: one.writes * 1000 };
  assert.deepEqual(one, { reads: 2, writes: 3, listenerDeliveries: 0 });
  assert.deepEqual(thousand, { reads: 2000, writes: 3000 });
  assert.equal(estimateGroupChatOperations('typing', { typingSeconds: 20 }).writes, 5);
  assert.equal(estimateGroupChatOperations('olderPage').reads, 30);
});

test('arquitetura usa listeners agregados e não cria listener por grupo no resumo', async () => {
  const summaryHook = await readFile(new URL('../src/hooks/useGroupChatSummaries.js', import.meta.url), 'utf8');
  const chatService = await readFile(new URL('../src/services/groupChat/groupChatService.js', import.meta.url), 'utf8');
  const groupsPage = await readFile(new URL('../src/pages/GroupsPage.jsx', import.meta.url), 'utf8');
  assert.match(summaryHook, /collectionGroup\(db, 'chat_meta'\)/);
  assert.match(summaryHook, /collection\(db, 'users', uid, 'group_chat_states'\)/);
  assert.doesNotMatch(summaryHook, /\.map\([^)]*onSnapshot/s);
  assert.doesNotMatch(groupsPage, /(?:map|flatMap)\([^)]*onSnapshot/s);
  assert.match(groupsPage, /where\('groupIds', 'array-contains', selectedGroupId\)/);
  assert.match(chatService, /where\('seq', '>',/);
  assert.doesNotMatch(chatService, /offset\(/);
});

test('limites do chat ficam centralizados em productLimits', () => {
  assert.equal(DEFAULT_PRODUCT_LIMITS.groupChat.maxMessageChars, 4000);
  assert.equal(DEFAULT_PRODUCT_LIMITS.groupChat.maxMentions, 10);
  assert.equal(DEFAULT_PRODUCT_LIMITS.groupChat.pageSize, 30);
  assert.equal(DEFAULT_PRODUCT_LIMITS.groupChat.retentionDays, 90);
  assert.equal(DEFAULT_PRODUCT_LIMITS.groupChat.typingThrottleMs, 4000);
});
