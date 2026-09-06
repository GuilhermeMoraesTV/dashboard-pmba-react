import test from 'node:test';
import assert from 'node:assert/strict';
import { loadGroupChatOpening } from '../src/services/groupChat/groupChatViewport.js';

const message = (seq, authorId = 'other') => ({ id: `m${seq}`, seq, authorId });
const page = (start, end) => ({ messages: Array.from({ length: Math.max(0, end - start + 1) }, (_, i) => message(start + i)), oldestSeq: start || null, highestSeq: end, hasMore: start > 1 });
const open = (state, latest, loadAfter = () => assert.fail('Não deve carregar outra página')) => loadGroupChatOpening({ uid: 'me', loadState: async () => state, loadLatest: async () => latest, loadAfter });

test('chat sem novas mensagens, vazio ou de novo membro abre no final', async () => {
  for (const state of [{ lastReadSeq: 100 }, null]) {
    const result = await open(state, page(71, 100));
    assert.deepEqual(result.initialLocation, { index: 'LAST', align: 'end' });
    assert.equal(result.firstUnreadId, null);
    assert.equal(result.hasNewer, false);
  }
  assert.equal((await open({ lastReadSeq: 0 }, page(0, -1))).firstUnreadId, null);
});

test('chat posiciona a primeira recebida não lida, sem contar mensagens próprias', async () => {
  const latest = page(71, 100);
  latest.messages[20].authorId = 'me';
  const result = await open({ lastReadSeq: 90, sentCountTotal: 1, sentCountAtRead: 0 }, latest);
  assert.equal(result.firstUnreadId, 'm92');
  assert.deepEqual(result.initialLocation, { index: 21, align: 'start' });
  const ownOnly = await open({ lastReadSeq: 90, sentCountTotal: 10, sentCountAtRead: 0 }, latest);
  assert.deepEqual(ownOnly.initialLocation, { index: 'LAST', align: 'end' });
});

test('milhares de não lidas abrem com uma página pelo cursor, sem varrer o intervalo', async () => {
  let calls = 0;
  const result = await open({ lastReadSeq: 100 }, page(9971, 10000), async (seq) => {
    calls++;
    assert.equal(seq, 100);
    return page(101, 130);
  });
  assert.equal(calls, 1);
  assert.equal(result.messages.length, 30);
  assert.equal(result.firstUnreadId, 'm101');
  assert.equal(result.highestKnownSeq, 10000);
  assert.equal(result.highestSeq, 130);
  assert.equal(result.hasNewer, true);
  assert.equal(result.hasMore, true);
  assert.deepEqual(result.initialLocation, { index: 0, align: 'start' });
});

test('retenção com lacunas abre na primeira mensagem disponível sem loop', async () => {
  const result = await open({ lastReadSeq: 1 }, page(471, 500), async () => page(450, 479));
  assert.equal(result.firstUnreadId, 'm450');
  assert.equal(result.hasNewer, true);
});
