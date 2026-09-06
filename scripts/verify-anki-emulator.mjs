/** Read real APKGs, write ONLY a demo project on local emulators. */
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import adminSdk from 'firebase-admin';
import { makeAnkiPackage } from '../tests/fixtures/ankiImportFixture.mjs';
const require = createRequire(import.meta.url);
const { createAnkiService, planAnkiFolderTree } = require('../functions/anki/service.js');
const { openAnkiArchive } = require('../functions/anki/archive.js');
const { parseAnkiCollection } = require('../functions/anki/parser.js');
const { DEFAULT_SERVER_PRODUCT_LIMITS: limits } = require('../functions/shared/productLimits.js');

for (const name of ['FIRESTORE_EMULATOR_HOST', 'FIREBASE_STORAGE_EMULATOR_HOST']) {
  assert.match(process.env[name] || '', /^(127\.0\.0\.1|localhost):\d+$/, `Local ${name} is mandatory`);
}
const projectId = 'demo-anki-local';
const app = adminSdk.initializeApp({ projectId, storageBucket: `${projectId}.appspot.com` }, `anki-${Date.now()}`);
const db = app.firestore(), bucket = app.storage().bucket();
const firestore = Object.assign(() => db, { FieldValue: adminSdk.firestore.FieldValue,
  FieldPath: adminSdk.firestore.FieldPath, Timestamp: adminSdk.firestore.Timestamp });
const service = createAnkiService({ admin: { firestore, storage: () => ({ bucket: () => bucket }) }, getProductLimits: async () => limits });
try {
  const packages = [];
  for (const file of process.argv.slice(2)) packages.push({ name: path.basename(file), buffer: await fs.readFile(file) });
  packages.push({ name: 'scale-5200.apkg', buffer: await makeAnkiPackage() });
  for (const [index, item] of packages.entries()) {
    const started = Date.now(), uid = `verify-${started}-${index}`, rootId = 'root';
    const user = db.collection('users').doc(uid);
    const folder = { userId: uid, name: item.name.replace(/\.apkg$/i, ''), ancestorFolderIds: [], archived: false, order: 0 };
    await user.collection('study_folders').doc(rootId).set(folder);
    const archive = await openAnkiArchive(item.buffer, limits);
    const parsed = await parseAnkiCollection(archive.collectionBuffer, { maxCards: limits.anki.maxCardsPerImport, maxTags: 10, mediaUris: new Map() });
    const withFlags = parsed.decks.map((deck) => ({ ...deck, hasCards: parsed.cards.some((card) => card.ankiDeckId === deck.id) }));
    const expectedPlan = planAnkiFolderTree({ decks: withFlags, targetFolderId: rootId, targetFolder: folder, existingFolders: [] });
    const importFile = async (attempt) => {
      const importId = `attempt-${attempt}`, storagePath = `user_uploads/${uid}/anki_imports/${importId}/file.apkg`;
      await bucket.file(storagePath).save(item.buffer, { resumable: false, metadata: { contentType: 'application/zip' } });
      return service.importAnkiPackage({ uid, importId, folderId: rootId, storagePath, originalName: item.name });
    };
    const first = await importFile(1);
    assert.equal(first.isComplete, parsed.metrics.cardsSkipped === 0);
    assert.equal(first.cardsAdded, parsed.cards.length);
    const storedCards = await db.collectionGroup('cards').where('userId', '==', uid).get();
    const storedFolders = await user.collection('study_folders').get();
    const storedDecks = await user.collection('decks').get();
    assert.equal(storedCards.size, parsed.cards.length);
    assert.equal(storedFolders.size, expectedPlan.newFolders.length + 1);
    assert.equal(storedDecks.docs.reduce((sum, doc) => sum + doc.data().cardCount, 0), storedCards.size);
    const sources = new Map(parsed.cards.map((card) => [`${card.ankiNoteGuid}:${card.ankiCardOrd}`, card]));
    for (const doc of storedCards.docs) {
      const card = doc.data(), source = sources.get(`${card.ankiMetadata.ankiNoteGuid}:${card.ankiMetadata.ankiCardOrd}`);
      assert.ok(source, doc.id);
      assert.equal(card.folderId, expectedPlan.folderIdByDeckId.get(source.ankiDeckId));
    }
    const sample = storedCards.docs[0];
    await sample.ref.update({ reps: 7, status: 'review', dueAt: adminSdk.firestore.Timestamp.fromDate(new Date('2030-01-01')) });
    const second = await importFile(2);
    assert.equal(second.isComplete, parsed.metrics.cardsSkipped === 0);
    assert.equal(second.cardsUnchanged, parsed.cards.length);
    assert.equal(second.cardsUpdated, 0);
    assert.equal(second.cardsAdded, 0);
    assert.equal(second.mediaUploaded, 0);
    assert.equal((await sample.ref.get()).data().reps, 7);
    console.log(JSON.stringify({ name: item.name, cards: storedCards.size, folders: storedFolders.size,
      decks: storedDecks.size, media: first.mediaUploaded, repeatUnchanged: second.cardsUnchanged,
      repeatMediaReused: second.mediaReused, elapsedMs: Date.now() - started, uid }));
  }
} finally {
  await app.delete();
}
