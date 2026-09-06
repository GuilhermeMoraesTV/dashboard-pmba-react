// Validates the exact isolated deployment artifact against local emulators only.
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { doc, setDoc, getDoc, deleteDoc } from 'firebase/firestore';
import { makeAnkiPackage } from '../tests/fixtures/ankiImportFixture.mjs';
for (const key of ['FIRESTORE_EMULATOR_HOST', 'FIREBASE_STORAGE_EMULATOR_HOST']) {
  assert.match(process.env[key] || '', /^(127\.0\.0\.1|localhost):\d+$/);
}
const projectId = 'demo-anki-release';
process.env.NODE_TEST_CONTEXT = 'anki-release-validation';
const { getFolderStudyCardsPage } = await import('../src/services/flashcards/flashcardsService.js');
process.env.GCLOUD_PROJECT = projectId;
process.env.FIREBASE_STORAGE_BUCKET = `${projectId}.appspot.com`;
const releaseRequire = createRequire(new URL('../tmp/anki-release-20260903/functions/index.js', import.meta.url));
const callables = releaseRequire('./index.js');
assert.deepEqual(Object.keys(callables).sort(), ['createStudyFolder', 'createStudyFolderTree', 'deleteStudyFolder', 'importAnkiPackage']);
const admin = releaseRequire('firebase-admin');
const { Timestamp } = releaseRequire('firebase-admin/firestore');
const db = admin.firestore(), bucket = admin.storage().bucket();
const [host, port] = process.env.FIRESTORE_EMULATOR_HOST.split(':');
const environment = await initializeTestEnvironment({ projectId, firestore: { host, port: Number(port),
  rules: await fs.readFile(new URL('../tmp/anki-release-20260903/firestore.rules', import.meta.url), 'utf8') } });
const uid = `release-${Date.now()}`, user = db.collection('users').doc(uid);
const invoke = (name, data) => callables[name].run({ auth: { uid }, data });
try {
  const client = environment.authenticatedContext(uid).firestore();
  const lock = doc(client, 'users', uid, 'anki_import_locks', 'active');
  await assertFails(setDoc(lock, { expiresAt: 0 }));
  await assertFails(getDoc(lock));
  await assertFails(deleteDoc(lock));
  await assertSucceeds(setDoc(doc(client, 'users', uid, 'legacy_test', 'allowed'), { value: 1 }));
  for (const name of Object.keys(callables)) await assert.rejects(callables[name].run({ data: {} }), { code: 'unauthenticated' });
  console.log('PASS deployed-rules delta: lease denied, legacy untouched, unauthenticated callables denied');

  const root = await invoke('createStudyFolder', { name: 'ROOT' });
  const folderId = root.folder.id;
  const fixture = await makeAnkiPackage({ count: 5200, deckCount: 60, depth: 4 });
  const runImport = async (attempt) => {
    const importId = `release-${attempt}`, storagePath = `user_uploads/${uid}/anki_imports/${importId}/fixture.apkg`;
    await bucket.file(storagePath).save(fixture, { resumable: false, metadata: { contentType: 'application/zip' } });
    return invoke('importAnkiPackage', { folderId, importId, storagePath, originalName: 'fixture.apkg' });
  };
  const first = await runImport(1);
  assert.equal(first.isComplete, true); assert.equal(first.cardsAdded, 5200);
  const cards = await db.collectionGroup('cards').where('userId', '==', uid).get();
  assert.equal(cards.size, 5200);
  const sample = cards.docs[0];
  await sample.ref.update({ reps: 5, status: 'review' });
  const repeated = await runImport(2);
  assert.equal(repeated.cardsUnchanged, 5200); assert.equal(repeated.cardsAdded, 0);
  assert.equal(repeated.isComplete, true); assert.equal((await sample.ref.get()).data().reps, 5);
  console.log('PASS exact release callables: 5200 cards persisted; repeat unchanged; review preserved');

  const folders = user.collection('study_folders');
  for (let offset = 0; offset < 520; offset += 400) {
    const batch = db.batch();
    for (let i = offset; i < Math.min(offset + 400, 520); i++) batch.create(folders.doc(`extra-${i}`), {
      userId: uid, name: `Extra ${i}`, sourceType: 'anki', archived: false, parentFolderId: folderId, ancestorFolderIds: [folderId] });
    await batch.commit();
  }
  assert.ok((await invoke('createStudyFolder', { name: 'Outra raiz' })).folder.id);
  assert.equal((await invoke('createStudyFolderTree', { names: ['A', 'B'], structure: 'chain' })).folders.length, 2);
  const descendants = await folders.where('ancestorFolderIds', 'array-contains', folderId).get();
  const deletion = await invoke('deleteStudyFolder', { folderId });
  assert.equal(deletion.archivedCount, descendants.size + 1);
  assert.equal((await folders.where('archived', '==', true).get()).size, descendants.size + 1);
  console.log('PASS manual folder quota and archive of large imported tree');

  const deck = user.collection('decks').doc('pagination'), stamp = new Timestamp(1788400000, 123456789);
  await deck.set({ userId: uid, folderId: 'pagination', name: 'Legacy', cardCount: 225, createdAt: stamp, updatedAt: stamp });
  const batch = db.batch();
  for (let i = 0; i < 225; i++) batch.create(deck.collection('cards').doc(`c-${String(i).padStart(4, '0')}`), {
    userId: uid, deckId: deck.id, folderId: 'pagination', front: `F${i}`, back: `B${i}`, status: 'new', createdAt: stamp, updatedAt: stamp, dueAt: stamp });
  await batch.commit();
  for (const onlyDue of [false, true]) {
    let cursor = null; const seen = new Set();
    for (let i = 0; i < 4; i++) {
      const page = await getFolderStudyCardsPage(uid, ['pagination'], { firestoreDb: client, pageSize: 100, cursor, onlyDue, targetDate: new Date('2030-01-01') });
      for (const card of page.cards) { assert.equal(seen.has(card.id), false); seen.add(card.id); }
      cursor = page.cursor; if (!page.hasMore) break;
    }
    assert.equal(seen.size, 225);
  }
  console.log('PASS client pagination: 225 unique cards with nanosecond timestamp, both study filters');
} finally { await environment.cleanup(); await admin.app().delete(); }
