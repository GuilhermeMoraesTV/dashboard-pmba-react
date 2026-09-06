import test from 'node:test';
import assert from 'node:assert/strict';
import { getProfileImages, reconcileProfileImages, saveProfileImage, subscribeProfileImages } from '../src/services/profileImageSave.js';

const deferred = () => {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
};

test('imagem é imediata, não regride com snapshot antigo e só confirma após persistir', async () => {
  const upload = deferred();
  const persisted = deferred();
  let updates = 0;
  let authSynced = false;
  const unsubscribe = subscribeProfileImages(() => { updates += 1; });
  const saving = saveProfileImage({
    uid: 'instant', channel: 'avatar', preview: { photoURL: 'blob:preview' },
    upload: () => upload.promise, persist: () => persisted.promise,
    syncAuth: () => { authSynced = true; },
  });
  assert.equal(getProfileImages('instant').avatar.values.photoURL, 'blob:preview');
  reconcileProfileImages('instant', { photoURL: 'https://old/image' });
  assert.equal(getProfileImages('instant').avatar.status, 'saving');
  upload.resolve({ photoURL: 'https://new/image' });
  await Promise.resolve();
  assert.equal(authSynced, false);
  persisted.resolve();
  await saving;
  assert.equal(authSynced, true);
  reconcileProfileImages('instant', { photoURL: 'https://old/image' });
  assert.equal(getProfileImages('instant').avatar.values.photoURL, 'https://new/image');
  reconcileProfileImages('instant', { photoURL: 'https://new/image' });
  assert.deepEqual(getProfileImages('instant'), {});
  assert.ok(updates >= 3);
  unsubscribe();
});

test('rejeição do Firestore desfaz somente a foto e não altera Auth nem capa', async () => {
  const failure = deferred();
  const cover = deferred();
  let syncs = 0;
  let released = 0;
  const coverSave = saveProfileImage({ uid: 'rollback', channel: 'cover', preview: { coverURL: 'blob:cover' }, upload: () => cover.promise, persist: async () => {} });
  const saving = saveProfileImage({ uid: 'rollback', channel: 'avatar', preview: { photoURL: 'blob:photo' }, upload: async () => ({ photoURL: 'https://new' }), persist: () => failure.promise, syncAuth: () => { syncs++; }, releasePreview: () => { released++; } });
  failure.reject(new Error('permission-denied'));
  await assert.rejects(saving, /permission-denied/);
  assert.equal(getProfileImages('rollback').avatar, undefined);
  assert.equal(getProfileImages('rollback').cover.values.coverURL, 'blob:cover');
  assert.equal(syncs, 0);
  assert.equal(released, 1);
  cover.resolve({ coverURL: 'https://cover' });
  await coverSave;
});

test('falha secundária no Auth não transforma perfil salvo em erro nem bloqueia confirmação', async () => {
  const authSync = deferred();
  const saving = saveProfileImage({ uid: 'auth-failure', channel: 'avatar', preview: { photoURL: 'blob:photo' }, upload: async () => ({ photoURL: 'https://saved' }), persist: async () => {}, syncAuth: () => authSync.promise });
  assert.deepEqual(await saving, { photoURL: 'https://saved' });
  authSync.reject(new Error('Auth unavailable'));
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(getProfileImages('auth-failure').avatar.status, 'saved');
});
