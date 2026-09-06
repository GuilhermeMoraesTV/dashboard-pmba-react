import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { makeAnkiPackage, memoryBucket } from './fixtures/ankiImportFixture.mjs';
import { ankiMemoryDb } from './fixtures/ankiMemoryDb.mjs';
const require = createRequire(import.meta.url);
const { createAnkiService, importedContentChanged, planAnkiFolderTree, planCardBatches, buildImportAccounting } = require('../functions/anki/service.js');
const { DEFAULT_SERVER_PRODUCT_LIMITS: defaults } = require('../functions/shared/productLimits.js');

function harness(overrides = {}, modularSdk = false) {
  const memory = ankiMemoryDb(), bucket = memoryBucket();
  const limits = { ...defaults, anki: { ...defaults.anki, ...overrides } };
  const admin = { firestore: modularSdk ? () => memory.firestore() : memory.firestore, storage: () => ({ bucket: () => bucket }) };
  const service = createAnkiService({ admin, getProductLimits: async () => limits,
    ...(modularSdk ? { FieldValue: memory.firestore.FieldValue, FieldPath: memory.firestore.FieldPath, Timestamp: memory.firestore.Timestamp } : {}) });
  memory.documents.set('users/test/study_folders/root', { userId: 'test', name: 'ROOT', ancestorFolderIds: [], archived: false, order: 0 });
  let sequence = 0;
  return {
    ...memory, bucket, service,
    async run(buffer) {
      const importId = `import-${++sequence}`, storagePath = `user_uploads/test/anki_imports/${importId}/test.apkg`;
      bucket.objects.set(storagePath, buffer);
      return service.importAnkiPackage({ uid: 'test', folderId: 'root', importId, storagePath, originalName: 'test.apkg' });
    },
  };
}

test('SDK modular sem propriedades estáticas importa e reimporta pela injeção explícita', async () => {
  const h = harness({}, true), fixture = await makeAnkiPackage({ count: 20, deckCount: 2, depth: 1 });
  assert.equal((await h.run(fixture)).cardsAdded, 20);
  assert.equal((await h.run(fixture)).cardsUnchanged, 20);
});

test('relatório grande preserva detalhes em Storage sem ultrapassar documento Firestore', async () => {
  const h = harness({ maxInlineReportBytes: 1 });
  const result = await h.run(await makeAnkiPackage({ count: 20, deckCount: 2, depth: 1 }));
  assert.equal(result.isComplete, true);
  assert.equal(result.cardsPerDeck.length, 0);
  const detail = JSON.parse(h.bucket.objects.get(result.cardsPerDeckReportPath).toString());
  assert.equal(detail.length, result.cardsPerDeckCount);
  assert.ok(detail.length >= 2);
});

test('card acima do orçamento de bytes rejeita antes de gravar conteúdo ou estrutura', async () => {
  const h = harness({ maxCardBytes: 1 });
  await assert.rejects(h.run(await makeAnkiPackage({ count: 20, deckCount: 2, depth: 1 })), { code: 'card-too-large' });
  assert.equal([...h.documents.keys()].filter((key) => /\/cards\//.test(key)).length, 0);
});

test('5.200 cards, 520 decks, 6.762 subpastas: íntegro e reimportação sem regravar conteúdo', async () => {
  const fixture = await makeAnkiPackage();
  const h = harness();
  const first = await h.run(fixture);
  assert.equal(first.isComplete, true);
  assert.equal(first.cardsAdded, 5200);
  assert.equal(first.cardsPersisted, 5200);
  assert.equal(first.foldersCreated, 6762);
  assert.equal(first.cardsSkipped, 0);
  const cards = [...h.documents.entries()].filter(([path]) => /\/cards\//.test(path));
  assert.equal(cards.length, 5200);
  assert.equal(new Set(cards.map(([, card]) => card.ankiMetadata.ankiNoteGuid)).size, 5200);
  for (const [, card] of cards) {
    const folder = h.documents.get(`users/test/study_folders/${card.folderId}`);
    assert.equal(folder.name, 'Nível 11');
    assert.equal(folder.ancestorFolderIds.length, 13);
  }
  const decks = [...h.documents.entries()].filter(([path]) => /^users\/test\/decks\/[^/]+$/.test(path));
  assert.equal(decks.length, 520);
  assert.equal(decks.reduce((total, [, deck]) => total + deck.cardCount, 0), 5200);
  assert.ok(h.stats.maxBatch <= 400);
  const before = { ...h.stats };
  const second = await h.run(fixture);
  assert.equal(second.isComplete, true);
  assert.equal(second.cardsUnchanged, 5200);
  assert.equal(second.cardsUpdated, 0);
  assert.equal(second.cardsAdded, 0);
  assert.equal(second.foldersCreated, 0);
  assert.equal(h.stats.cardWrites, before.cardWrites);
  assert.equal(h.stats.indexWrites, before.indexWrites);
  console.log('APKG_SCALE_OPERATIONS', JSON.stringify({ first: before,
    repeat: Object.fromEntries(Object.entries(h.stats).map(([key, value]) => [key, value - before[key]])) }));
});

test('um único deck pode receber 5.200 cards sem corte no antigo limite 2.000', async () => {
  const h = harness();
  const report = await h.run(await makeAnkiPackage({ deckCount: 1, depth: 1 }));
  assert.equal(report.isComplete, true);
  assert.equal(report.cardsAdded, 5200);
  assert.equal(report.cardsSkipped, 0);
});

test('falha parcial é explícita, preserva APKG e retoma sem duplicar ou perder progresso', async () => {
  const fixture = await makeAnkiPackage({ count: 300, deckCount: 3, depth: 1 });
  const h = harness();
  h.failOnCardCommit(2);
  const failed = await h.run(fixture);
  assert.equal(failed.isComplete, false);
  assert.equal(failed.cardsAdded, 80);
  assert.equal(failed.cardsPersisted, 80);
  assert.equal(failed.failedBatches, 1);
  assert.equal(h.bucket.objects.size, 1);
  const [path, card] = [...h.documents].find(([key]) => /\/cards\//.test(key));
  h.documents.set(path, { ...card, reps: 7, status: 'review', dueAt: new Date('2030-01-01'), schedulerState: { version: 2, reviewed: true } });
  h.failOnCardCommit(0);
  const resumed = await h.run(fixture);
  assert.equal(resumed.isComplete, true);
  assert.equal(resumed.cardsAdded, 220);
  assert.equal(resumed.cardsUnchanged, 80);
  assert.equal(resumed.cardsPersisted, 300);
  assert.equal(h.documents.get(path).reps, 7);
  assert.equal(h.documents.get(path).status, 'review');
  assert.deepEqual(h.documents.get(path).schedulerState, { version: 2, reviewed: true });
});

test('reimportar altera só o card modificado, mantém índice e restaura card excluído', async () => {
  const h = harness();
  const options = { count: 20, deckCount: 2, depth: 1 };
  await h.run(await makeAnkiPackage(options));
  const before = { ...h.stats };
  const changed = await h.run(await makeAnkiPackage({ ...options, changed: 3 }));
  assert.equal(changed.cardsUpdated, 1);
  assert.equal(changed.cardsUnchanged, 19);
  assert.equal(h.stats.cardWrites - before.cardWrites, 1);
  assert.equal(h.stats.indexWrites - before.indexWrites, 0);
  const path = [...h.documents.keys()].find((key) => /\/cards\//.test(key));
  h.documents.delete(path);
  const restored = await h.run(await makeAnkiPackage({ ...options, changed: 3 }));
  assert.equal(restored.cardsAdded, 1);
  assert.equal(restored.cardsPersisted, 20);
  assert.equal(h.documents.has(path), true);
  assert.equal([...h.documents].filter(([key]) => /^users\/test\/decks\/[^/]+$/.test(key)).reduce((s, [, d]) => s + d.cardCount, 0), 20);
});

test('cotas de decks, pastas e cards rejeitam antes de gravar a estrutura, nunca selecionam parte', async () => {
  const fixture = await makeAnkiPackage({ count: 20, deckCount: 2, depth: 1 });
  for (const limits of [{ maxCardsPerDeck: 5 }, { maxDecksPerUser: 1 }, { maxFoldersPerUser: 2 }]) {
    const h = harness(limits);
    await assert.rejects(h.run(fixture), (error) => ['card-limit', 'deck-limit', 'folder-limit'].includes(error.code));
    assert.equal([...h.documents.keys()].filter((key) => /\/decks\//.test(key)).length, 0);
    assert.equal([...h.documents.keys()].filter((key) => /\/study_folders\//.test(key)).length, 1);
    assert.equal(h.bucket.objects.size, 1);
    assert.equal(h.documents.has('users/test/anki_import_locks/active'), false);
  }
});

test('pastas homônimas pai/filho, decks vazios e cards próprios não se fundem', () => {
  const plan = planAnkiFolderTree({ targetFolderId: 'root', targetFolder: { name: 'ROOT' }, existingFolders: [],
    decks: [{ id: 'a', name: 'ROOT' }, { id: 'b', name: 'ROOT::ROOT' }, { id: 'c', name: 'ROOT::ROOT::Folha' }, { id: 'd', name: 'ROOT::Vazia' }] });
  assert.equal(plan.newFolders.length, 3);
  assert.notEqual(plan.folderIdByDeckId.get('a'), plan.folderIdByDeckId.get('b'));
  assert.notEqual(plan.folderIdByDeckId.get('b'), plan.folderIdByDeckId.get('c'));
});

test('comparação ignora ordem das chaves, timestamps e progresso, mas detecta conteúdo', () => {
  const incoming = { front: 'F', back: 'B', ankiMetadata: { guid: 'a', ord: 0 }, sourceId: 'new' };
  assert.equal(importedContentChanged({ ...incoming, ankiMetadata: { ord: 0, guid: 'a' }, sourceId: 'old', reps: 5 }, incoming), false);
  assert.equal(importedContentChanged({ ...incoming, back: 'X' }, incoming), true);
});

test('lotes respeitam bytes além da quantidade e não perdem nenhum índice', () => {
  const cards = Array.from({ length: 250 }, () => ({ front: 'á'.repeat(200000), back: 'b'.repeat(200000) }));
  const batches = planCardBatches(cards);
  assert.deepEqual(batches.flat(), Array.from({ length: 250 }, (_, i) => i));
  assert.ok(batches.every((batch) => batch.length <= 10));
});

test('nenhum descarte pode ser anunciado como importação completa', () => {
  const result = buildImportAccounting({ cardsDetected: 2, cardsParsed: 1, parserCardsSkipped: 1,
    cardsAdded: 1, cardsPersisted: 1, batchesStarted: 1, batchesCompleted: 1 });
  assert.equal(result.accountingComplete, true);
  assert.equal(result.isComplete, false);
});

test('reimportação repara folhas ausentes e atribuições antigas sem apagar revisões', async () => {
  const h = harness();
  const fixture = await makeAnkiPackage({ count: 30, deckCount: 3, depth: 2 });
  await h.run(fixture);
  const cardPaths = [...h.documents.keys()].filter((key) => /\/cards\//.test(key));
  for (const path of cardPaths) {
    const card = h.documents.get(path);
    const leaf = h.documents.get(`users/test/study_folders/${card.folderId}`);
    h.documents.set(path, { ...card, folderId: leaf.parentFolderId, reps: 8 });
    const deckPath = `users/test/decks/${card.deckId}`;
    const deck = h.documents.get(deckPath);
    const { archived: _archived, ...legacyDeck } = deck;
    h.documents.set(deckPath, { ...legacyDeck, folderId: leaf.parentFolderId });
  }
  for (const [key, folder] of [...h.documents]) {
    if (/\/study_folders\//.test(key) && folder.name === 'Nível 1') h.documents.delete(key);
  }
  const repaired = await h.run(fixture);
  assert.equal(repaired.foldersCreated, 3);
  assert.equal(repaired.cardsUpdated, 30);
  assert.equal(repaired.cardsAdded, 0);
  for (const path of cardPaths) {
    const card = h.documents.get(path);
    assert.equal(card.reps, 8);
    assert.equal(h.documents.get(`users/test/study_folders/${card.folderId}`).name, 'Nível 1');
    assert.equal(h.documents.get(`users/test/decks/${card.deckId}`).archived, false);
  }
});

test('reimportação migra cards de deck Anki legado para os decks e folhas canônicos', async () => {
  const h = harness();
  const fixture = await makeAnkiPackage({ count: 30, deckCount: 3, depth: 2 });
  await h.run(fixture);
  const originalCardPaths = [...h.documents.keys()].filter((key) => /\/cards\//.test(key));
  const legacyDeckId = 'anki_legacy_consolidated';
  const legacyFolderId = 'anki_folder_orphan';
  h.documents.set(`users/test/study_folders/${legacyFolderId}`, {
    userId: 'test', name: 'Importação antiga', sourceType: 'anki', parentFolderId: 'root',
    ancestorFolderIds: ['root'], archived: true, order: 999,
  });
  h.documents.set(`users/test/decks/${legacyDeckId}`, {
    userId: 'test', name: 'Importação antiga', description: 'Importado do Anki', tags: ['anki'],
    sourceType: 'anki', folderId: legacyFolderId, cardCount: originalCardPaths.length,
    cardMutationVersion: 0, archived: true,
  });
  for (const originalPath of originalCardPaths) {
    const card = h.documents.get(originalPath);
    const cardId = originalPath.split('/').at(-1);
    h.documents.delete(originalPath);
    h.documents.set(`users/test/decks/${legacyDeckId}/cards/${cardId}`, {
      ...card, deckId: legacyDeckId, folderId: legacyFolderId, reps: 9,
    });
    const indexEntry = [...h.documents.entries()].find(([path, value]) =>
      /\/anki_card_index\//.test(path) && value.cardId === cardId);
    h.documents.set(indexEntry[0], { ...indexEntry[1], deckId: legacyDeckId });
  }
  for (const [path, deck] of [...h.documents]) {
    if (/^users\/test\/decks\/[^/]+$/.test(path) && path !== `users/test/decks/${legacyDeckId}`) {
      h.documents.set(path, { ...deck, cardCount: 0 });
    }
  }

  const repaired = await h.run(fixture);
  assert.equal(repaired.cardsUpdated, 30);
  assert.equal(repaired.cardsAdded, 0);
  assert.equal(repaired.cardsPersisted, 30);
  assert.equal([...h.documents.keys()].filter((key) => key.startsWith(`users/test/decks/${legacyDeckId}/cards/`)).length, 0);
  const repairedCards = [...h.documents.entries()].filter(([path]) => /\/cards\//.test(path));
  assert.equal(repairedCards.length, 30);
  for (const [, card] of repairedCards) {
    assert.notEqual(card.deckId, legacyDeckId);
    assert.equal(card.reps, 9);
    assert.equal(h.documents.get(`users/test/study_folders/${card.folderId}`)?.archived, false);
  }
  const activeDecks = [...h.documents.entries()].filter(([path, deck]) =>
    /^users\/test\/decks\/[^/]+$/.test(path) && deck.archived !== true);
  assert.equal(activeDecks.reduce((sum, [, deck]) => sum + Number(deck.cardCount || 0), 0), 30);
});

test('lease bloqueia importações simultâneas do mesmo usuário e é liberado ao terminar', async () => {
  const h = harness(), fixture = await makeAnkiPackage({ count: 20, deckCount: 2, depth: 1 });
  const results = await Promise.allSettled([h.run(fixture), h.run(fixture)]);
  assert.equal(results.filter((item) => item.status === 'fulfilled').length, 1);
  assert.equal(results.find((item) => item.status === 'rejected').reason.code, 'import-in-progress');
  assert.equal([...h.documents.keys()].filter((key) => /\/cards\//.test(key)).length, 20);
  assert.equal(h.documents.has('users/test/anki_import_locks/active'), false);
});
