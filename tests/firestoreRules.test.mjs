import test, { after, before } from 'node:test';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
} from '@firebase/rules-unit-testing';
import {
  collectionGroup,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
  updateDoc,
} from 'firebase/firestore';

const projectId = 'dashboard-pmba';
let environment;

before(async () => {
  assert.ok(process.env.FIRESTORE_EMULATOR_HOST, 'Execute os testes pelo script npm test.');
  const [host, port] = process.env.FIRESTORE_EMULATOR_HOST.split(':');
  environment = await initializeTestEnvironment({
    projectId,
    firestore: {
      host,
      port: Number(port),
      rules: await fs.readFile(new URL('../firestore.rules', import.meta.url), 'utf8'),
    },
  });
  await environment.clearFirestore();

  await environment.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    await setDoc(doc(db, 'users', 'admin-user'), {
      uid: 'admin-user',
      access: { role: 'admin', adminRole: 'admin', permissions: { adminPanel: true } },
    });
    await setDoc(doc(db, 'system_feedback', 'ticket-owner'), {
      uid: 'owner-user',
      status: 'pendente',
    });
    await setDoc(doc(db, 'users', 'owner-user'), { uid: 'owner-user', name: 'Aluno' });
    await setDoc(doc(db, 'users', 'legacy-owner'), { name: 'Aluno legado' });
    await setDoc(doc(db, 'users', 'owner-user', 'registrosEstudo', 'record-1'), { uid: 'owner-user', tempoEstudadoMinutos: 30 });
    await setDoc(doc(db, 'users', 'owner-user', 'simulados', 'simulation-1'), { uid: 'owner-user', resumo: { totalQuestoes: 10 } });
    await setDoc(doc(db, 'users', 'owner-user', 'ciclos', 'cycle-1'), { uid: 'owner-user', nome: 'Ciclo' });
    await setDoc(doc(db, 'users', 'owner-user', 'cronogramas', 'schedule-1'), { uid: 'owner-user', nome: 'Cronograma' });
  });
});

after(async () => {
  await environment?.cleanup();
});

test('time_sync permite apenas documentos prefixados pelo próprio UID', async () => {
  const ownerDb = environment.authenticatedContext('owner-user').firestore();
  await assertSucceeds(setDoc(doc(ownerDb, 'time_sync', 'owner-user_tab-1'), { ping: true }));
  await assertFails(setDoc(doc(ownerDb, 'time_sync', 'other-user_tab-1'), { ping: true }));
});

test('noticiaCache é legível por autenticado e gravável apenas pelo backend/admin', async () => {
  await environment.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), 'noticiaCache', 'artigo-1'), { titulo: 'Teste' });
  });
  const ownerDb = environment.authenticatedContext('owner-user').firestore();
  const adminDb = environment.authenticatedContext('admin-user').firestore();
  await assertSucceeds(getDoc(doc(ownerDb, 'noticiaCache', 'artigo-1')));
  await assertFails(setDoc(doc(ownerDb, 'noticiaCache', 'artigo-2'), { titulo: 'Injetado' }));
  await assertSucceeds(setDoc(doc(adminDb, 'noticiaCache', 'artigo-2'), { titulo: 'Admin' }));
});

test('system_feedback restringe chamados ao dono e libera gestão ao admin', async () => {
  const ownerDb = environment.authenticatedContext('owner-user').firestore();
  const strangerDb = environment.authenticatedContext('stranger-user').firestore();
  const adminDb = environment.authenticatedContext('admin-user').firestore();
  await assertSucceeds(getDoc(doc(ownerDb, 'system_feedback', 'ticket-owner')));
  await assertFails(getDoc(doc(strangerDb, 'system_feedback', 'ticket-owner')));
  await assertSucceeds(updateDoc(doc(ownerDb, 'system_feedback', 'ticket-owner'), { userTyping: true }));
  await assertFails(updateDoc(doc(ownerDb, 'system_feedback', 'ticket-owner'), { status: 'resolvido' }));
  await assertSucceeds(deleteDoc(doc(adminDb, 'system_feedback', 'ticket-owner')));
});

test('users impede autopromoção e mantém leitura administrativa', async () => {
  const studentDb = environment.authenticatedContext('new-student').firestore();
  const adminDb = environment.authenticatedContext('admin-user').firestore();
  await assertFails(setDoc(doc(studentDb, 'users', 'new-student'), {
    uid: 'new-student',
    access: { role: 'admin', adminRole: 'admin', permissions: { adminPanel: true } },
  }));
  await assertSucceeds(setDoc(doc(studentDb, 'users', 'new-student'), {
    uid: 'new-student',
    name: 'Aluno',
  }));
  await assertSucceeds(getDoc(doc(adminDb, 'users', 'new-student')));
});

test('users permite ao dono atualizar a capa e a posicao do proprio perfil', async () => {
  const ownerDb = environment.authenticatedContext('owner-user').firestore();
  const strangerDb = environment.authenticatedContext('stranger-user').firestore();

  await assertSucceeds(updateDoc(doc(ownerDb, 'users', 'owner-user'), {
    coverURL: 'https://firebasestorage.googleapis.com/profile-cover.jpg',
    coverPosition: { x: 38, y: 72 },
  }));
  await assertSucceeds(updateDoc(doc(ownerDb, 'users', 'owner-user'), {
    coverURL: null,
    coverPosition: { x: 50, y: 50 },
  }));
  const legacyDb = environment.authenticatedContext('legacy-owner').firestore();
  await assertSucceeds(updateDoc(doc(legacyDb, 'users', 'legacy-owner'), {
    coverURL: 'https://firebasestorage.googleapis.com/legacy-profile-cover.jpg',
    coverPosition: { x: 44, y: 61 },
  }));
  await assertFails(updateDoc(doc(strangerDb, 'users', 'owner-user'), {
    coverURL: 'https://example.com/unauthorized.jpg',
  }));
});

test('system_ai_usage é somente leitura para admin no cliente', async () => {
  await environment.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), 'system_ai_usage', '2026-06-19_owner-user'), { calls: 1 });
  });
  const ownerDb = environment.authenticatedContext('owner-user').firestore();
  const adminDb = environment.authenticatedContext('admin-user').firestore();
  await assertFails(getDoc(doc(ownerDb, 'system_ai_usage', '2026-06-19_owner-user')));
  await assertSucceeds(getDoc(doc(adminDb, 'system_ai_usage', '2026-06-19_owner-user')));
  await assertFails(setDoc(doc(adminDb, 'system_ai_usage', 'manual'), { calls: 2 }));
});

test('collection groups acadêmicos são legíveis somente pelo admin', async () => {
  const ownerDb = environment.authenticatedContext('owner-user').firestore();
  const adminDb = environment.authenticatedContext('admin-user').firestore();
  for (const collectionName of ['registrosEstudo', 'simulados', 'ciclos', 'cronogramas']) {
    await assertSucceeds(getDocs(query(collectionGroup(adminDb, collectionName))));
    await assertFails(getDocs(query(collectionGroup(ownerDb, collectionName))));
  }
});
