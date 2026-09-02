import test, { after, before } from 'node:test';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import admin from 'firebase-admin';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
} from '@firebase/rules-unit-testing';
import {
  collection,
  collectionGroup,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { GAMIFICATION_CONFIG, getNextWeekId, getWeekId, toDateKey } from '../src/utils/gamification.js';

const require = createRequire(import.meta.url);
const gamificationService = require('../functions/gamification/service.js');
const groupService = require('../functions/groups/service.js');
const questionValidation = require('../functions/questions/validation.js');
const { createGenerationService } = require('../functions/ai/generation.js');
const flashcardsBackendService = require('../functions/flashcards/service.js');
const { createAnkiService } = require('../functions/anki/service.js');
const { createAdaptiveStudyService } = require('../functions/adaptiveStudy/service.js');
const { createStudySourceService } = require('../functions/studySources/service.js');
const { DEFAULT_SERVER_PRODUCT_LIMITS } = require('../functions/shared/productLimits.js');
const { migrateLegacyFlashcardsPage } = require('../functions/flashcards/adminMigration.js');

const projectId = 'dashboard-pmba';
let environment;

before(async () => {
  assert.ok(process.env.FIRESTORE_EMULATOR_HOST, 'Execute os testes pelo script npm test.');
  assert.ok(process.env.FIREBASE_STORAGE_EMULATOR_HOST, 'Execute os testes pelo script npm test com o Storage Emulator.');
  const [host, port] = process.env.FIRESTORE_EMULATOR_HOST.split(':');
  const [storageHost, storagePort] = process.env.FIREBASE_STORAGE_EMULATOR_HOST.split(':');
  environment = await initializeTestEnvironment({
    projectId,
    firestore: {
      host,
      port: Number(port),
      rules: await fs.readFile(new URL('../firestore.rules', import.meta.url), 'utf8'),
    },
    storage: {
      host: storageHost,
      port: Number(storagePort),
      rules: await fs.readFile(new URL('../storage.rules', import.meta.url), 'utf8'),
    },
  });
  if (!admin.apps.length) admin.initializeApp({ projectId });
  await environment.clearFirestore();
  await environment.clearStorage();

  await environment.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    await setDoc(doc(db, 'users', 'admin-user'), {
      uid: 'admin-user',
      access: { role: 'admin', adminRole: 'admin', permissions: { adminPanel: true } },
    });
    await setDoc(doc(db, 'users', 'role-only-admin'), {
      uid: 'role-only-admin',
      access: { role: 'admin' },
    });
    await setDoc(doc(db, 'users', 'permission-only-admin'), {
      uid: 'permission-only-admin',
      access: { permissions: { adminPanel: true } },
    });
    await setDoc(doc(db, 'system_feedback', 'ticket-owner'), {
      uid: 'owner-user',
      status: 'pendente',
      timestamp: '2026-08-13T00:00:00.000Z',
      unreadUser: true,
    });
    await setDoc(doc(db, 'users', 'owner-user'), { uid: 'owner-user', name: 'Aluno' });
    await setDoc(doc(db, 'users', 'legacy-owner'), { name: 'Aluno legado' });
    await setDoc(doc(db, 'users', 'owner-user', 'registrosEstudo', 'record-1'), { uid: 'owner-user', tempoEstudadoMinutos: 30 });
    await setDoc(doc(db, 'users', 'owner-user', 'simulados', 'simulation-1'), { uid: 'owner-user', resumo: { totalQuestoes: 10 } });
    await setDoc(doc(db, 'users', 'owner-user', 'ciclos', 'cycle-1'), { uid: 'owner-user', nome: 'Ciclo' });
    await setDoc(doc(db, 'users', 'owner-user', 'cronogramas', 'schedule-1'), { uid: 'owner-user', nome: 'Cronograma' });
    await setDoc(doc(db, 'users', 'owner-user', 'gamification', 'profile'), { totalXP: 100, groupIds: ['private-group'] });
    await setDoc(doc(db, 'users', 'group-member', 'gamification', 'profile'), { totalXP: 50, groupIds: ['private-group'] });
    await setDoc(doc(db, 'users', 'stranger-user', 'gamification', 'profile'), { totalXP: 0, groupIds: [] });
    await setDoc(doc(db, 'weekly_rankings', '2026-08-17', 'members', 'owner-user'), { uid: 'owner-user', minutes: 30 });
    await setDoc(doc(db, 'users', 'owner-user', 'gamification', 'profile', 'achievements', 'first_study'), { unlocked: true, progress: 1, xpGranted: 25 });
    await setDoc(doc(db, 'users', 'owner-user', 'gamification', 'profile', 'xp_events', 'academic_study_record-1'), { xpTotal: 15, xpCompetitive: 15, isRead: false });
    await setDoc(doc(db, 'study_groups', 'public-group'), { name: 'Público', visibility: 'public', ownerId: 'owner-user' });
    await setDoc(doc(db, 'study_groups', 'private-group'), { name: 'Privado', visibility: 'private', ownerId: 'owner-user', inviteCode: 'ABC1234' });
    await setDoc(doc(db, 'study_group_directory', 'private-group'), { groupId: 'private-group', name: 'Privado', visibility: 'private', memberCount: 2 });
    await setDoc(doc(db, 'study_groups', 'private-group', 'members', 'owner-user'), { uid: 'owner-user', role: 'owner', permissions: { manageGroup: true } });
    await setDoc(doc(db, 'study_groups', 'private-group', 'members', 'group-member'), { uid: 'group-member', role: 'member', permissions: { manageGroup: false } });
    await setDoc(doc(db, 'study_group_invites', 'ABC1234'), { code: 'ABC1234', groupId: 'private-group', groupName: 'Privado', ownerId: 'owner-user', active: true });
    await setDoc(doc(db, 'active_timers', 'owner-user'), { uid: 'owner-user', status: 'running', groupIds: ['private-group'] });

    const now = Timestamp.now();
    const safeQuestion = {
      statement: 'Enunciado seguro',
      options: [{ id: 'A', text: 'Alternativa A' }, { id: 'B', text: 'Alternativa B' }],
      disciplineId: 'direito',
      subject: 'Constitucional',
      sourceType: 'official',
      createdAt: now,
      updatedAt: now,
    };
    await setDoc(doc(db, 'questions', 'global-1'), safeQuestion);
    await setDoc(doc(db, 'questions', 'global-1', 'private', 'answerKey'), {
      correctOptionId: 'A', explanation: 'A alternativa A e correta.', createdAt: now, updatedAt: now,
    });
    await setDoc(doc(db, 'users', 'owner-user', 'questions', 'private-1'), {
      ...safeQuestion, userId: 'owner-user', sourceType: 'manual',
    });
    await setDoc(doc(db, 'users', 'owner-user', 'questions', 'private-1', 'private', 'answerKey'), {
      correctOptionId: 'B', explanation: 'A alternativa B e correta.', createdAt: now, updatedAt: now,
    });
    await setDoc(doc(db, 'users', 'owner-user', 'decks', 'deck-1'), { userId: 'owner-user', marker: true });
    await setDoc(doc(db, 'users', 'owner-user', 'decks', 'deck-1', 'cards', 'card-1'), { userId: 'owner-user', deckId: 'deck-1', marker: true });
    await setDoc(doc(db, 'users', 'owner-user', 'error_book', 'question:global:seed'), { userId: 'owner-user', sourceType: 'question', sourceId: 'seed', questionScope: 'global' });
    await setDoc(doc(db, 'users', 'owner-user', 'documents', 'document-1'), { userId: 'owner-user', name: 'material.pdf' });
    await setDoc(doc(db, 'users', 'owner-user', 'generated_items', 'generated-1'), { userId: 'owner-user', type: 'question', status: 'draft' });
  });
});

after(async () => {
  await environment?.cleanup();
  await Promise.all(admin.apps.map((app) => app.delete()));
});

test('Fase 0 isola dados privados e protege tentativas validadas', async () => {
  const ownerDb = environment.authenticatedContext('owner-user').firestore();
  const strangerDb = environment.authenticatedContext('stranger-user').firestore();
  const adminDb = environment.authenticatedContext('admin-user').firestore();

  const ownerDocuments = [
    'users/owner-user/decks/deck-1',
    'users/owner-user/decks/deck-1/cards/card-1',
    'users/owner-user/questions/private-1',
    'users/owner-user/error_book/question:global:seed',
    'users/owner-user/documents/document-1',
    'users/owner-user/generated_items/generated-1',
  ];

  for (const path of ownerDocuments) {
    await assertSucceeds(getDoc(doc(ownerDb, path)));
    await assertFails(getDoc(doc(strangerDb, path)));
    await assertFails(getDoc(doc(adminDb, path)));
  }

  await environment.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), 'users', 'owner-user', 'question_attempts', 'attempt-1'), {
      userId: 'owner-user',
      questionId: 'global-1',
      questionScope: 'global',
      selectedOptionId: 'A',
      correctOptionId: 'A',
      isCorrect: true,
    });
  });

  await assertSucceeds(getDoc(doc(ownerDb, 'users', 'owner-user', 'question_attempts', 'attempt-1')));
  await assertFails(getDoc(doc(strangerDb, 'users', 'owner-user', 'question_attempts', 'attempt-1')));
  await assertFails(setDoc(doc(ownerDb, 'users', 'owner-user', 'question_attempts', 'forged-owner'), { isCorrect: true }));
  await assertFails(setDoc(doc(adminDb, 'users', 'owner-user', 'question_attempts', 'forged-admin'), { isCorrect: true }));
});

test('questoes expõem somente projeção client-safe e bloqueiam answerKeys', async () => {
  const ownerDb = environment.authenticatedContext('owner-user').firestore();
  const strangerDb = environment.authenticatedContext('stranger-user').firestore();
  const adminDb = environment.authenticatedContext('admin-user').firestore();

  await environment.withSecurityRulesDisabled(async (context) => {
    const unsafeDb = context.firestore();
    const unsafePayload = {
      statement: 'Documento legado inseguro',
      options: [{ id: 'A', text: 'A', isCorrect: true }, { id: 'B', text: 'B' }],
      disciplineId: 'direito',
      subject: 'Seguranca',
      sourceType: 'official',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
    await setDoc(doc(unsafeDb, 'questions', 'legacy-unsafe'), unsafePayload);
    await setDoc(doc(unsafeDb, 'users', 'owner-user', 'questions', 'legacy-unsafe'), {
      ...unsafePayload,
      userId: 'owner-user',
      sourceType: 'manual',
    });
  });

  const globalQuestion = await assertSucceeds(getDoc(doc(ownerDb, 'questions', 'global-1')));
  assert.equal(globalQuestion.data().correctOptionId, undefined);
  assert.equal(globalQuestion.data().explanation, undefined);
  await assertFails(getDoc(doc(ownerDb, 'questions', 'global-1', 'private', 'answerKey')));

  const privateQuestion = await assertSucceeds(getDoc(doc(ownerDb, 'users', 'owner-user', 'questions', 'private-1')));
  assert.equal(privateQuestion.data().correctOptionId, undefined);
  await assertFails(getDoc(doc(ownerDb, 'questions', 'legacy-unsafe')));
  await assertFails(getDoc(doc(ownerDb, 'users', 'owner-user', 'questions', 'legacy-unsafe')));
  await assertFails(getDoc(doc(strangerDb, 'users', 'owner-user', 'questions', 'private-1')));
  await assertFails(getDoc(doc(adminDb, 'users', 'owner-user', 'questions', 'private-1')));
  await assertFails(getDoc(doc(ownerDb, 'users', 'owner-user', 'questions', 'private-1', 'private', 'answerKey')));
  await assertFails(setDoc(doc(ownerDb, 'questions', 'global-student'), { statement: 'Conteudo injetado' }));
  await assertFails(setDoc(doc(adminDb, 'questions', 'global-admin-unsafe'), {
    statement: 'Tentativa de vazamento',
    options: [{ id: 'A', text: 'A', isCorrect: true }, { id: 'B', text: 'B' }],
    disciplineId: 'direito',
    subject: 'Seguranca',
    sourceType: 'official',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  }));
  await assertFails(setDoc(doc(adminDb, 'questions', 'global-admin-safe'), {
    statement: 'Mesmo payload seguro deve passar pelo backend',
    options: [{ id: 'A', text: 'A' }, { id: 'B', text: 'B' }],
    disciplineId: 'direito',
    subject: 'Seguranca',
    sourceType: 'official',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  }));
});

test('Storage isola PDFs por UID e recusa upload inválido', async () => {
  const ownerStorage = environment.authenticatedContext('owner-user').storage();
  const strangerStorage = environment.authenticatedContext('stranger-user').storage();
  const adminStorage = environment.authenticatedContext('admin-user').storage();
  const path = 'user_uploads/owner-user/documents/document-1/material.pdf';
  const pdfBytes = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x37]);

  await assertSucceeds(ownerStorage.ref(path).put(pdfBytes, { contentType: 'application/pdf' }));
  await assertSucceeds(ownerStorage.ref(path).getDownloadURL());
  await assertFails(strangerStorage.ref(path).getDownloadURL());
  await assertFails(adminStorage.ref(path).getDownloadURL());
  await assertFails(ownerStorage.ref('user_uploads/stranger-user/documents/document-2/foreign.pdf').put(pdfBytes, { contentType: 'application/pdf' }));
  await assertFails(ownerStorage.ref('user_uploads/owner-user/documents/document-2/not-pdf.txt').put(pdfBytes, { contentType: 'text/plain' }));
});

test('documento aceita somente metadados iniciais e protege campos/chunks controlados pelo backend', async () => {
  const ownerDb = environment.authenticatedContext('owner-user').firestore();
  const strangerDb = environment.authenticatedContext('stranger-user').firestore();
  const documentRef = doc(ownerDb, 'users', 'owner-user', 'documents', 'pdf-create-test');
  await assertSucceeds(setDoc(documentRef, {
    userId: 'owner-user',
    name: 'apostila.pdf',
    fileType: 'pdf',
    storagePath: 'user_uploads/owner-user/documents/pdf-create-test/apostila.pdf',
    fileSizeBytes: 1024,
    status: 'pending',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  }));
  await assertFails(updateDoc(documentRef, { status: 'processed', chunkCount: 1, updatedAt: serverTimestamp() }));
  await assertFails(deleteDoc(documentRef));
  await assertFails(getDoc(doc(ownerDb, 'users', 'owner-user', 'documents', 'pdf-create-test', 'chunks', 'chunk_0000')));
  await assertFails(getDoc(doc(strangerDb, 'users', 'owner-user', 'documents', 'pdf-create-test')));
  await assertFails(setDoc(doc(strangerDb, 'users', 'owner-user', 'documents', 'forged'), {
    userId: 'stranger-user', name: 'forjado.pdf', fileType: 'pdf',
    storagePath: 'user_uploads/stranger-user/documents/forged/forjado.pdf', fileSizeBytes: 10,
    status: 'pending', createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
  }));
});

test('Storage isola APKG e impede cliente de gravar mídia processada', async () => {
  const ownerStorage = environment.authenticatedContext('owner-user').storage();
  const strangerStorage = environment.authenticatedContext('stranger-user').storage();
  const zipBytes = new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0, 0, 0, 0]);
  const path = 'user_uploads/owner-user/anki_imports/import-rules/deck.apkg';
  await assertSucceeds(ownerStorage.ref(path).put(zipBytes, { contentType: 'application/zip' }));
  await assertSucceeds(ownerStorage.ref(path).getDownloadURL());
  await assertFails(strangerStorage.ref(path).getDownloadURL());
  await assertFails(ownerStorage.ref('user_uploads/owner-user/anki_imports/import-rules/deck.zip').put(zipBytes, { contentType: 'application/zip' }));
  await assertFails(ownerStorage.ref('user_uploads/owner-user/anki_media/hash.png').put(zipBytes, { contentType: 'image/png' }));
});

test('geração de documento privado separa questão e gabarito sem publicar no banco global', async () => {
  const uid = 'generation-owner';
  const documentId = 'private-pdf';
  const sourceId = 'source-private-pdf';
  const adminDb = admin.firestore();
  const ownerDb = environment.authenticatedContext(uid).firestore();
  const now = admin.firestore.Timestamp.now();
  await adminDb.collection('users').doc(uid).set({ uid });
  const documentRef = adminDb.collection('users').doc(uid).collection('documents').doc(documentId);
  await documentRef.set({ userId: uid, name: 'privado.pdf', status: 'processed', studySourceId: sourceId, createdAt: now, updatedAt: now });
  await adminDb.collection('users').doc(uid).collection('study_sources').doc(sourceId).set({
    userId: uid, folderId: 'folder-generation', kind: 'document', title: 'PDF privado', status: 'ready',
    sourceRevision: 1, documentId, createdAt: now, updatedAt: now,
  });
  await documentRef.collection('chunks').doc('chunk_0000').set({
    userId: uid, documentId, order: 0, pageStart: 1, pageEnd: 1,
    content: 'A Constituição Federal possui fundamentos e princípios estruturantes.',
  });
  const globalBefore = await adminDb.collection('questions').get();
  const provider = {
    generate: async () => ({
      parsedJson: {
        items: [{
          statement: 'Qual é um fundamento constitucional?',
          options: [{ id: 'A', text: 'Soberania' }, { id: 'B', text: 'Arbitrariedade' }],
          correctOptionId: 'A', explanation: 'Soberania é fundamento.', tags: ['constitucional'],
        }],
      },
    }),
  };
  const limits = {
    ai: { maxInputChars: 10000, dailyGenerationsLimitPerUser: 10, maxGeneratedQuestionsPerBatch: 5, maxOutputTokens: 2048 },
    flashcards: { maxTagsPerCard: 10 },
    questions: { maxPrivateQuestionsPerUser: 5000 },
  };
  const service = createGenerationService({ admin, getProductLimits: async () => limits, getProvider: () => provider });
  const result = await service.generateQuestions({
    uid, sourceId, payload: { targetCount: 1 },
  });
  assert.equal(result.itemCount, 1);
  const privateQuestions = await adminDb.collection('users').doc(uid).collection('questions').get();
  assert.equal(privateQuestions.size, 1);
  const question = privateQuestions.docs[0].data();
  assert.equal(question.correctOptionId, undefined);
  assert.equal(question.explanation, undefined);
  assert.equal(question.sourceDocumentId, documentId);
  assert.equal(question.sourceId, sourceId);
  const answerKey = (await privateQuestions.docs[0].ref.collection('private').doc('answerKey').get()).data();
  assert.equal(answerKey.correctOptionId, 'A');
  const generated = (await adminDb.collection('users').doc(uid).collection('generated_items').get()).docs[0].data();
  assert.equal(generated.content.correctOptionId, undefined);
  assert.equal(generated.content.explanation, undefined);
  assert.equal((await adminDb.collection('questions').get()).size, globalBefore.size);

  const strangerDb = environment.authenticatedContext('stranger-user').firestore();
  await assertSucceeds(getDoc(doc(ownerDb, 'users', uid, 'questions', privateQuestions.docs[0].id)));
  await assertFails(getDoc(doc(ownerDb, 'users', uid, 'questions', privateQuestions.docs[0].id, 'private', 'answerKey')));
  await assertFails(getDoc(doc(strangerDb, 'users', uid, 'questions', privateQuestions.docs[0].id)));
  await assert.rejects(
    service.generateQuestions({ uid: 'stranger-user', sourceId, payload: { targetCount: 1 } }),
    (error) => error.code === 'not-found',
  );
});

test('geração por documento exige autenticação e aplica cota diária transacional', async () => {
  const uid = 'quota-owner';
  const documentId = 'quota-pdf';
  const sourceId = 'source-quota-pdf';
  const adminDb = admin.firestore();
  const now = admin.firestore.Timestamp.now();
  const documentRef = adminDb.collection('users').doc(uid).collection('documents').doc(documentId);
  await adminDb.collection('users').doc(uid).set({ uid });
  await documentRef.set({ userId: uid, status: 'processed', studySourceId: sourceId, createdAt: now, updatedAt: now });
  await adminDb.collection('users').doc(uid).collection('study_sources').doc(sourceId).set({
    userId: uid, folderId: 'folder-quota', kind: 'document', title: 'Fonte quota', status: 'ready',
    sourceRevision: 1, documentId, createdAt: now, updatedAt: now,
  });
  await documentRef.collection('chunks').doc('chunk_0000').set({
    userId: uid, documentId, order: 0, pageStart: 1, pageEnd: 1, content: 'Conteúdo para um flashcard seguro.',
  });
  let providerCalls = 0;
  const service = createGenerationService({
    admin,
    getProductLimits: async () => ({
      ai: { maxInputChars: 10000, dailyGenerationsLimitPerUser: 1, maxGeneratedCardsPerBatch: 5, maxOutputTokens: 2048 },
      flashcards: { maxTagsPerCard: 10 },
    }),
    getProvider: () => ({
      generate: async () => {
        providerCalls += 1;
        return { parsedJson: { items: [{ front: 'Pergunta', back: 'Resposta', tags: [] }] } };
      },
    }),
  });
  await assert.rejects(service.generateFlashcards({ uid: '', sourceId, payload: {} }), (error) => error.code === 'unauthenticated');
  await service.generateFlashcards({ uid, sourceId, payload: { targetCount: 1 } });
  await assert.rejects(
    service.generateFlashcards({ uid, sourceId, payload: { targetCount: 1 } }),
    (error) => error.code === 'quota-exceeded',
  );
  assert.equal(providerCalls, 1);
});

test('submitQuestionAnswer usa answerKey protegido e mantém tentativa, estatísticas e Caderno de Erros consistentes', async () => {
  const adminDb = admin.firestore();
  const attemptsRef = adminDb.collection('users').doc('owner-user').collection('question_attempts');
  const attemptsBefore = await attemptsRef.get();
  const wrong = await questionValidation.processQuestionAnswerSubmission({
    uid: 'owner-user',
    questionId: 'global-1',
    questionScope: 'global',
    selectedOptionId: 'B',
    timeSpentSeconds: 30,
  });
  assert.equal(wrong.isCorrect, false);
  assert.equal(wrong.correctOptionId, 'A');
  assert.equal(wrong.explanation, 'A alternativa A e correta.');

  const errorRef = adminDb.collection('users').doc('owner-user').collection('error_book').doc('question:global:global-1');
  const firstError = (await errorRef.get()).data();
  assert.equal(firstError.wrongCount, 1);
  assert.equal(firstError.correctCount, 0);
  assert.equal(firstError.mastered, false);
  assert.equal(firstError.masteredAt, null);
  assert.ok(firstError.createdAt);
  assert.ok(firstError.updatedAt);
  assert.ok(firstError.lastAttemptAt);
  const createdAtMillis = firstError.createdAt.toMillis();

  const correct = await questionValidation.processQuestionAnswerSubmission({
    uid: 'owner-user',
    questionId: 'global-1',
    questionScope: 'global',
    selectedOptionId: 'A',
    timeSpentSeconds: 15,
  });
  assert.equal(correct.isCorrect, true);
  const updatedError = (await errorRef.get()).data();
  assert.equal(updatedError.wrongCount, 1);
  assert.equal(updatedError.correctCount, 1);
  assert.equal(updatedError.createdAt.toMillis(), createdAtMillis);

  const privateResult = await questionValidation.processQuestionAnswerSubmission({
    uid: 'owner-user',
    questionId: 'private-1',
    questionScope: 'private',
    selectedOptionId: 'B',
  });
  assert.equal(privateResult.isCorrect, true);
  assert.equal(privateResult.correctOptionId, 'B');

  const attempts = await attemptsRef.get();
  assert.equal(attempts.size, attemptsBefore.size + 3);
  const stats = (await adminDb.collection('users').doc('owner-user').collection('question_stats').doc('summary').get()).data();
  assert.equal(stats.totalAttempts, 3);
  assert.equal(stats.totalAttemptEvents, 3);
  assert.equal(stats.questionsResolved, 2);
  assert.equal(stats.correctResolved, 1);
  assert.equal(stats.incorrectResolved, 1);
  assert.equal(stats.correctAttempts, 2);
  assert.equal(stats.wrongAttempts, 1);
  assert.equal(stats.totalXpEarned, wrong.xpEarned + correct.xpEarned + privateResult.xpEarned);
});

test('submitQuestionAnswer deduplica repeticoes e concorrencia e usa XP oficial', async () => {
  const adminDb = admin.firestore();
  const uid = 'question-xp-user';
  const userRef = adminDb.collection('users').doc(uid);
  await userRef.set({ uid, name: 'XP Questões' });

  const now = admin.firestore.Timestamp.now();
  for (let index = 1; index <= 6; index += 1) {
    const questionRef = adminDb.collection('questions').doc(`xp-question-${index}`);
    await questionRef.set({
      statement: `Questao oficial ${index}`,
      options: [{ id: 'A', text: 'Correta' }, { id: 'B', text: 'Errada' }],
      disciplineId: 'direito',
      subject: 'XP oficial',
      sourceType: 'official',
      createdAt: now,
      updatedAt: now,
    });
    await questionRef.collection('private').doc('answerKey').set({
      correctOptionId: 'A',
      explanation: 'Resposta validada no backend.',
      createdAt: now,
      updatedAt: now,
    });
  }

  const results = [];
  for (let index = 1; index <= 5; index += 1) {
    results.push(await questionValidation.processQuestionAnswerSubmission({
      uid,
      questionId: `xp-question-${index}`,
      questionScope: 'global',
      selectedOptionId: 'A',
    }));
  }
  assert.equal(results.slice(0, 4).every((result) => result.xpEarned === 0), true);
  const officialQuestionBlockXP = GAMIFICATION_CONFIG.academic.xpPerQuestionsBlock
    + GAMIFICATION_CONFIG.academic.xpPerCorrectBlock;
  assert.equal(results[4].xpEarned, officialQuestionBlockXP);

  const repeated = await questionValidation.processQuestionAnswerSubmission({
    uid,
    questionId: 'xp-question-5',
    questionScope: 'global',
    selectedOptionId: 'A',
  });
  assert.equal(repeated.xpEarned, 0);
  assert.equal(repeated.attemptId, results[4].attemptId);

  const concurrentWrong = await Promise.all(Array.from({ length: 8 }, () => (
    questionValidation.processQuestionAnswerSubmission({
      uid,
      questionId: 'xp-question-6',
      questionScope: 'global',
      selectedOptionId: 'B',
    })
  )));
  assert.equal(concurrentWrong.every((result) => result.xpEarned === 0), true);
  assert.equal(new Set(concurrentWrong.map((result) => result.attemptId)).size, 1);

  const [attempts, rewards, stats, profile, questionEvents] = await Promise.all([
    userRef.collection('question_attempts').get(),
    userRef.collection('question_reward_sources').get(),
    userRef.collection('question_stats').doc('summary').get(),
    userRef.collection('gamification').doc('profile').get(),
    userRef.collection('gamification').doc('profile').collection('xp_events').where('sourceType', '==', 'question').get(),
  ]);
  assert.equal(attempts.size, 6);
  assert.equal(rewards.size, 6);
  assert.equal(stats.data().totalAttempts, 6);
  assert.equal(stats.data().totalAttemptEvents, 6);
  assert.equal(stats.data().questionsResolved, 6);
  assert.equal(stats.data().correctResolved, 5);
  assert.equal(stats.data().incorrectResolved, 1);
  assert.equal(stats.data().correctAttempts, 5);
  assert.equal(stats.data().wrongAttempts, 1);
  assert.equal(stats.data().totalXpEarned, officialQuestionBlockXP);
  assert.equal(questionEvents.docs.reduce((sum, item) => sum + Number(item.data().xpTotal || 0), 0), officialQuestionBlockXP);
  assert.equal(profile.data().totalXP >= officialQuestionBlockXP, true);

  const ownerDb = environment.authenticatedContext(uid).firestore();
  await assertFails(getDoc(doc(ownerDb, 'users', uid, 'question_reward_sources', rewards.docs[0].id)));
  await assertFails(setDoc(doc(ownerDb, 'users', uid, 'question_reward_sources', 'forged'), { questions: 500 }));
});

test('submitQuestionAnswer recupera de falha parcial, sincroniza firstAttemptId e converge atomicamente', async () => {
  const adminDb = admin.firestore();
  const uid = 'partial-failure-user';
  const userRef = adminDb.collection('users').doc(uid);
  await userRef.set({ uid, name: 'Partial Failure User' });

  const now = admin.firestore.Timestamp.now();
  for (let index = 1; index <= 5; index += 1) {
    const questionRef = adminDb.collection('questions').doc(`pf-question-${index}`);
    await questionRef.set({
      statement: `Questao PF ${index}`,
      options: [{ id: 'A', text: 'Correta' }, { id: 'B', text: 'Errada' }],
      disciplineId: 'direito',
      subject: 'Falha Parcial',
      sourceType: 'official',
      createdAt: now,
      updatedAt: now,
    });
    await questionRef.collection('private').doc('answerKey').set({
      correctOptionId: 'A',
      explanation: 'Gabarito oficial A.',
      createdAt: now,
      updatedAt: now,
    });
  }

  for (let index = 1; index <= 4; index += 1) {
    await questionValidation.processQuestionAnswerSubmission({
      uid,
      questionId: `pf-question-${index}`,
      questionScope: 'global',
      selectedOptionId: 'A',
    });
  }

  const originalRecompute = gamificationService.recomputeUserGamification;
  let simulateFailure = true;
  gamificationService.recomputeUserGamification = async (...args) => {
    if (simulateFailure) {
      throw new Error('Simulated transient gamification network outage');
    }
    return originalRecompute(...args);
  };

  const question5RewardId = questionValidation.deterministicDocumentId(['global', 'pf-question-5']);
  const question5AttemptAId = questionValidation.deterministicDocumentId(['global', 'pf-question-5', 'A']);

  await assert.rejects(
    () => questionValidation.processQuestionAnswerSubmission({
      uid,
      questionId: 'pf-question-5',
      questionScope: 'global',
      selectedOptionId: 'A',
    }),
    /Resposta registrada, mas a gamificacao ainda nao foi sincronizada/,
  );

  const attemptMidSnap = await userRef.collection('question_attempts').doc(question5AttemptAId).get();
  assert.equal(attemptMidSnap.exists, true);
  assert.equal(attemptMidSnap.data().xpEarned, 0);

  const rewardMidSnap = await userRef.collection('question_reward_sources').doc(question5RewardId).get();
  assert.equal(rewardMidSnap.exists, true);
  assert.equal(rewardMidSnap.data().gamificationSynced, false);
  assert.equal(rewardMidSnap.data().firstAttemptId, question5AttemptAId);

  simulateFailure = false;
  const retryResult = await questionValidation.processQuestionAnswerSubmission({
    uid,
    questionId: 'pf-question-5',
    questionScope: 'global',
    selectedOptionId: 'A',
  });

  const expectedBlockXP = GAMIFICATION_CONFIG.academic.xpPerQuestionsBlock
    + GAMIFICATION_CONFIG.academic.xpPerCorrectBlock;

  assert.equal(retryResult.xpEarned, expectedBlockXP);
  assert.equal(retryResult.attemptId, question5AttemptAId);

  const attemptFinalSnap = await userRef.collection('question_attempts').doc(question5AttemptAId).get();
  assert.equal(attemptFinalSnap.data().xpEarned, expectedBlockXP);

  const rewardFinalSnap = await userRef.collection('question_reward_sources').doc(question5RewardId).get();
  assert.equal(rewardFinalSnap.data().gamificationSynced, true);

  const attemptsCount = (await userRef.collection('question_attempts').where('questionId', '==', 'pf-question-5').get()).size;
  assert.equal(attemptsCount, 1);

  await userRef.collection('question_reward_sources').doc(question5RewardId).update({
    gamificationSynced: false,
  });
  await userRef.collection('question_attempts').doc(question5AttemptAId).update({
    xpEarned: 0,
  });

  const retryBResult = await questionValidation.processQuestionAnswerSubmission({
    uid,
    questionId: 'pf-question-5',
    questionScope: 'global',
    selectedOptionId: 'A',
  });
  assert.equal(retryBResult.xpEarned, expectedBlockXP);

  const statsB = (await userRef.collection('question_stats').doc('summary').get()).data();
  assert.equal(statsB.totalXpEarned, expectedBlockXP);

  const questionEventsB = await userRef.collection('gamification').doc('profile').collection('xp_events').where('sourceType', '==', 'question').get();
  assert.equal(questionEventsB.size, 1);
  assert.equal(questionEventsB.docs[0].data().xpTotal, expectedBlockXP);

  await userRef.collection('question_reward_sources').doc(question5RewardId).update({
    gamificationSynced: false,
  });
  await userRef.collection('question_attempts').doc(question5AttemptAId).update({
    xpEarned: 0,
  });

  const concurrentRetries = await Promise.all([
    questionValidation.processQuestionAnswerSubmission({ uid, questionId: 'pf-question-5', questionScope: 'global', selectedOptionId: 'A' }),
    questionValidation.processQuestionAnswerSubmission({ uid, questionId: 'pf-question-5', questionScope: 'global', selectedOptionId: 'A' }),
  ]);

  assert.ok(concurrentRetries.some((res) => res.xpEarned === expectedBlockXP));
  const finalRewardSnap = await userRef.collection('question_reward_sources').doc(question5RewardId).get();
  assert.equal(finalRewardSnap.data().gamificationSynced, true);
  const finalAttemptSnap = await userRef.collection('question_attempts').doc(question5AttemptAId).get();
  assert.equal(finalAttemptSnap.data().xpEarned, expectedBlockXP);

  const orphanRewardId = questionValidation.deterministicDocumentId(['global', 'orphan-q']);
  await userRef.collection('question_reward_sources').doc(orphanRewardId).set({
    userId: uid,
    questionId: 'orphan-q',
    questionScope: 'global',
    questions: 1,
    correct: 0,
    gamificationSynced: false,
  });
  const orphanQRef = adminDb.collection('questions').doc('orphan-q');
  await orphanQRef.set({
    statement: 'Orphan',
    options: [{ id: 'A', text: 'Opt A' }, { id: 'B', text: 'Opt B' }],
    disciplineId: 'direito',
    subject: 'Invariante',
    sourceType: 'official',
    createdAt: now,
    updatedAt: now,
  });
  await orphanQRef.collection('private').doc('answerKey').set({
    correctOptionId: 'A',
    createdAt: now,
    updatedAt: now,
  });

  await assert.rejects(
    () => questionValidation.processQuestionAnswerSubmission({
      uid,
      questionId: 'orphan-q',
      questionScope: 'global',
      selectedOptionId: 'B',
    }),
    /firstAttemptId ausente/,
  );

  gamificationService.recomputeUserGamification = originalRecompute;
});

test('submitQuestionAnswer garante semantica de questoes resolvidas unicas e acuracia da primeira resolucao', async () => {
  const adminDb = admin.firestore();
  const uid = 'semantics-test-user';
  const userRef = adminDb.collection('users').doc(uid);
  await userRef.set({ uid, name: 'Semantics User' });

  const now = admin.firestore.Timestamp.now();
  for (const qId of ['q-sem-1', 'q-sem-2', 'q-sem-3']) {
    const qRef = adminDb.collection('questions').doc(qId);
    await qRef.set({
      statement: `Questao Semantica ${qId}`,
      options: [{ id: 'A', text: 'Opcao A' }, { id: 'B', text: 'Opcao B' }, { id: 'C', text: 'Opcao C' }],
      disciplineId: 'direito',
      subject: 'Semantica',
      sourceType: 'official',
      createdAt: now,
      updatedAt: now,
    });
    await qRef.collection('private').doc('answerKey').set({
      correctOptionId: 'A',
      explanation: 'A e a correta.',
      createdAt: now,
      updatedAt: now,
    });
  }

  const res1 = await questionValidation.processQuestionAnswerSubmission({
    uid,
    questionId: 'q-sem-1',
    questionScope: 'global',
    selectedOptionId: 'A',
  });
  assert.equal(res1.isCorrect, true);

  let statsSnap = await userRef.collection('question_stats').doc('summary').get();
  let statsData = statsSnap.data();
  assert.equal(statsData.questionsResolved, 1);
  assert.equal(statsData.correctResolved, 1);
  assert.equal(statsData.incorrectResolved, 0);
  assert.equal(statsData.totalAttemptEvents, 1);
  assert.equal(statsData.totalAttempts, 1);

  const res2Wrong = await questionValidation.processQuestionAnswerSubmission({
    uid,
    questionId: 'q-sem-2',
    questionScope: 'global',
    selectedOptionId: 'B',
  });
  assert.equal(res2Wrong.isCorrect, false);

  const res2Correct = await questionValidation.processQuestionAnswerSubmission({
    uid,
    questionId: 'q-sem-2',
    questionScope: 'global',
    selectedOptionId: 'A',
  });
  assert.equal(res2Correct.isCorrect, true);

  statsSnap = await userRef.collection('question_stats').doc('summary').get();
  statsData = statsSnap.data();
  assert.equal(statsData.questionsResolved, 2);
  assert.equal(statsData.correctResolved, 1);
  assert.equal(statsData.incorrectResolved, 1);
  assert.equal(statsData.totalAttemptEvents, 3);
  assert.equal(statsData.totalAttempts, 3);
  assert.equal(statsData.correctAttempts, 2);
  assert.equal(statsData.wrongAttempts, 1);

  const errorBookSnap = await userRef.collection('error_book').doc('question:global:q-sem-2').get();
  assert.equal(errorBookSnap.exists, true);
  assert.equal(errorBookSnap.data().wrongCount, 1);
  assert.equal(errorBookSnap.data().correctCount, 1);

  await questionValidation.processQuestionAnswerSubmission({ uid, questionId: 'q-sem-3', questionScope: 'global', selectedOptionId: 'B' });
  await questionValidation.processQuestionAnswerSubmission({ uid, questionId: 'q-sem-3', questionScope: 'global', selectedOptionId: 'C' });
  await questionValidation.processQuestionAnswerSubmission({ uid, questionId: 'q-sem-3', questionScope: 'global', selectedOptionId: 'A' });

  const attemptsQ3 = (await userRef.collection('question_attempts').where('questionId', '==', 'q-sem-3').get()).size;
  assert.equal(attemptsQ3, 3);

  statsSnap = await userRef.collection('question_stats').doc('summary').get();
  statsData = statsSnap.data();
  assert.equal(statsData.questionsResolved, 3);
  assert.equal(statsData.correctResolved, 1);
  assert.equal(statsData.incorrectResolved, 2);
  assert.equal(statsData.totalAttemptEvents, 6);
  assert.equal(statsData.totalAttempts, 6);

  const resRepeat = await questionValidation.processQuestionAnswerSubmission({
    uid,
    questionId: 'q-sem-3',
    questionScope: 'global',
    selectedOptionId: 'A',
  });
  assert.equal(resRepeat.isCorrect, true);
  const attemptsQ3AfterRepeat = (await userRef.collection('question_attempts').where('questionId', '==', 'q-sem-3').get()).size;
  assert.equal(attemptsQ3AfterRepeat, 3);

  statsSnap = await userRef.collection('question_stats').doc('summary').get();
  assert.equal(statsSnap.data().totalAttemptEvents, 6);
  assert.equal(statsSnap.data().questionsResolved, 3);

  const concQId = 'q-concurrent-first';
  const concQRef = adminDb.collection('questions').doc(concQId);
  await concQRef.set({
    statement: 'Concorrencia',
    options: [{ id: 'A', text: 'Opcao A' }, { id: 'B', text: 'Opcao B' }],
    disciplineId: 'direito',
    subject: 'Concorrencia',
    sourceType: 'official',
    createdAt: now,
    updatedAt: now,
  });
  await concQRef.collection('private').doc('answerKey').set({
    correctOptionId: 'A',
    createdAt: now,
    updatedAt: now,
  });

  await Promise.all([
    questionValidation.processQuestionAnswerSubmission({ uid, questionId: concQId, questionScope: 'global', selectedOptionId: 'A' }),
    questionValidation.processQuestionAnswerSubmission({ uid, questionId: concQId, questionScope: 'global', selectedOptionId: 'A' }),
  ]);

  const concRewardsCount = (await userRef.collection('question_reward_sources').where('questionId', '==', concQId).get()).size;
  assert.equal(concRewardsCount, 1);

  statsSnap = await userRef.collection('question_stats').doc('summary').get();
  assert.equal(statsSnap.data().questionsResolved, 4);
});

test('time_sync permite apenas documentos prefixados pelo próprio UID', async () => {
  const ownerDb = environment.authenticatedContext('owner-user').firestore();
  await assertSucceeds(setDoc(doc(ownerDb, 'time_sync', 'owner-user_tab-1'), { ping: true }));
  await assertFails(setDoc(doc(ownerDb, 'time_sync', 'other-user_tab-1'), { ping: true }));
});

test('noticiaCache é legível por autenticado e imutável por qualquer cliente', async () => {
  await environment.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), 'noticiaCache', 'artigo-1'), { titulo: 'Teste' });
  });
  const ownerDb = environment.authenticatedContext('owner-user').firestore();
  const adminDb = environment.authenticatedContext('admin-user').firestore();
  await assertSucceeds(getDoc(doc(ownerDb, 'noticiaCache', 'artigo-1')));
  await assertFails(setDoc(doc(ownerDb, 'noticiaCache', 'artigo-2'), { titulo: 'Injetado' }));
  await assertFails(setDoc(doc(adminDb, 'noticiaCache', 'artigo-2'), { titulo: 'Admin' }));
});

test('system_feedback restringe chamados ao dono e libera gestão ao admin', async () => {
  const ownerDb = environment.authenticatedContext('owner-user').firestore();
  const strangerDb = environment.authenticatedContext('stranger-user').firestore();
  const adminDb = environment.authenticatedContext('admin-user').firestore();
  await assertSucceeds(getDoc(doc(ownerDb, 'system_feedback', 'ticket-owner')));
  await assertSucceeds(getDocs(query(
    collection(ownerDb, 'system_feedback'),
    where('uid', '==', 'owner-user'),
    orderBy('timestamp', 'desc'),
  )));
  await assertSucceeds(getDocs(query(
    collection(ownerDb, 'system_feedback'),
    where('uid', '==', 'owner-user'),
    where('unreadUser', '==', true),
  )));
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
  await assertFails(setDoc(doc(adminDb, 'users', 'created-by-browser-admin'), { uid: 'created-by-browser-admin', access: { role: 'admin' } }));
  await assertFails(updateDoc(doc(adminDb, 'users', 'new-student'), { status: 'blocked', disabled: true }));
  await assertFails(updateDoc(doc(adminDb, 'users', 'new-student'), { access: { role: 'admin', permissions: { adminPanel: true } } }));
  await assertSucceeds(updateDoc(doc(adminDb, 'users', 'new-student'), { name: 'Aluno revisado' }));
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
  const roleOnlyAdminDb = environment.authenticatedContext('role-only-admin').firestore();
  const permissionOnlyAdminDb = environment.authenticatedContext('permission-only-admin').firestore();
  for (const collectionName of ['registrosEstudo', 'simulados', 'ciclos', 'cronogramas']) {
    await assertSucceeds(getDocs(query(collectionGroup(adminDb, collectionName))));
    await assertSucceeds(getDocs(query(collectionGroup(roleOnlyAdminDb, collectionName))));
    await assertSucceeds(getDocs(query(collectionGroup(permissionOnlyAdminDb, collectionName))));
    await assertFails(getDocs(query(collectionGroup(ownerDb, collectionName))));
  }
  await assertSucceeds(getDocs(query(collectionGroup(adminDb, 'gamification'))));
  await assertSucceeds(getDocs(query(collectionGroup(roleOnlyAdminDb, 'gamification'))));
  await assertSucceeds(getDocs(query(collectionGroup(permissionOnlyAdminDb, 'gamification'))));
  await assertFails(getDocs(query(collectionGroup(ownerDb, 'gamification'))));
});

test('fontes acadêmicas validam dono, limites e coerência antes da gamificação', async () => {
  const ownerDb = environment.authenticatedContext('owner-user').firestore();
  const strangerDb = environment.authenticatedContext('stranger-user').firestore();
  const adminDb = environment.authenticatedContext('admin-user').firestore();
  const validRecord = {
    uid: 'owner-user',
    data: '2026-08-28',
    tempoEstudadoMinutos: 120,
    questoesFeitas: 80,
    acertos: 70,
    disciplinaNome: 'Direito Constitucional',
  };

  await assertSucceeds(setDoc(doc(ownerDb, 'users', 'owner-user', 'registrosEstudo', 'safe-record'), validRecord));
  await assertFails(setDoc(doc(ownerDb, 'users', 'owner-user', 'registrosEstudo', 'too-long'), { ...validRecord, tempoEstudadoMinutos: 721 }));
  await assertFails(setDoc(doc(ownerDb, 'users', 'owner-user', 'registrosEstudo', 'too-many-questions'), { ...validRecord, questoesFeitas: 501 }));
  await assertFails(setDoc(doc(ownerDb, 'users', 'owner-user', 'registrosEstudo', 'impossible-correct'), { ...validRecord, questoesFeitas: 10, acertos: 11 }));
  await assertFails(setDoc(doc(strangerDb, 'users', 'owner-user', 'registrosEstudo', 'idor-record'), validRecord));
  await assertFails(setDoc(doc(adminDb, 'users', 'owner-user', 'registrosEstudo', 'browser-admin-record'), validRecord));

  const validSimulation = {
    uid: 'owner-user',
    data: '2026-08-28',
    durationMinutes: 90,
    resumo: { totalQuestoes: 100, totalAcertos: 82 },
  };
  await assertSucceeds(setDoc(doc(ownerDb, 'users', 'owner-user', 'simulados', 'safe-simulation'), validSimulation));
  await assertFails(setDoc(doc(ownerDb, 'users', 'owner-user', 'simulados', 'forged-simulation'), {
    ...validSimulation,
    resumo: { totalQuestoes: 10, totalAcertos: 99 },
  }));
});

test('rodada de ciclo exige incremento atômico e carimbo do servidor', async () => {
  const ownerDb = environment.authenticatedContext('owner-user').firestore();
  const cycleRef = doc(ownerDb, 'users', 'owner-user', 'ciclos', 'cycle-1');
  const roundRef = doc(ownerDb, 'users', 'owner-user', 'ciclos', 'cycle-1', 'rodadas', 'rodada-000001');
  const roundPayload = {
    numeroRodada: 1,
    inicioPlanejado: '2026-08-21',
    fechamentoIdeal: '2026-08-28',
    fechamentoRealData: '2026-08-28',
    fechamentoReal: serverTimestamp(),
    criadoEm: serverTimestamp(),
    atrasoDias: 0,
    cargaPlanejadaMinutos: 300,
    cargaCumpridaAteDataIdealMinutos: 300,
    materiasPendentesNoVencimento: [],
  };
  await assertFails(setDoc(roundRef, roundPayload));

  const batch = writeBatch(ownerDb);
  batch.update(cycleRef, { conclusoes: 1 });
  batch.set(roundRef, roundPayload);
  await assertSucceeds(batch.commit());
  await assertFails(updateDoc(roundRef, { cargaPlanejadaMinutos: 1 }));
});

test('gamificação permite leitura própria e bloqueia autoatribuição de XP e conquistas', async () => {
  const ownerDb = environment.authenticatedContext('owner-user').firestore();
  const strangerDb = environment.authenticatedContext('stranger-user').firestore();
  await assertSucceeds(getDoc(doc(ownerDb, 'users', 'owner-user', 'gamification', 'profile')));
  await assertFails(setDoc(doc(ownerDb, 'users', 'owner-user', 'gamification', 'profile'), { totalXP: 250 }, { merge: true }));
  await assertFails(setDoc(doc(ownerDb, 'users', 'owner-user', 'gamification', 'profile', 'achievements', 'first_study'), {
    unlocked: true,
    progress: 100,
  }, { merge: true }));
  await assertSucceeds(updateDoc(doc(ownerDb, 'users', 'owner-user', 'gamification', 'profile', 'xp_events', 'academic_study_record-1'), {
    isRead: true,
    readAt: new Date(),
  }));
  await assertFails(updateDoc(doc(ownerDb, 'users', 'owner-user', 'gamification', 'profile', 'xp_events', 'academic_study_record-1'), {
    xpTotal: 999,
  }));
  await assertFails(getDoc(doc(strangerDb, 'users', 'owner-user', 'gamification', 'profile')));
  await assertFails(getDoc(doc(strangerDb, 'users', 'owner-user', 'gamification', 'profile', 'achievements', 'first_study')));
  await assertFails(setDoc(doc(strangerDb, 'users', 'owner-user', 'gamification', 'profile'), { totalXP: 999 }, { merge: true }));
  await assertFails(setDoc(doc(strangerDb, 'users', 'stranger-user', 'gamification', 'profile'), {
    groupIds: ['private-group'],
    lastJoinedGroupId: 'private-group',
    mainGroupId: 'private-group',
  }, { merge: true }));
});

test('ranking semanal é legível por autenticados e gravável somente pelo backend', async () => {
  const ownerDb = environment.authenticatedContext('owner-user').firestore();
  const strangerDb = environment.authenticatedContext('stranger-user').firestore();
  const adminDb = environment.authenticatedContext('admin-user').firestore();
  await assertSucceeds(getDocs(collection(strangerDb, 'weekly_rankings', '2026-08-17', 'members')));
  await assertFails(setDoc(doc(strangerDb, 'weekly_rankings', '2026-08-17', 'members', 'stranger-user'), { uid: 'stranger-user', competitiveXP: 40 }));
  await assertFails(setDoc(doc(strangerDb, 'weekly_rankings', '2026-08-17', 'members', 'owner-user'), { uid: 'owner-user', minutes: 999 }));
  await assertFails(setDoc(doc(adminDb, 'weekly_rankings', '2026-08-17', 'members', 'owner-user'), { uid: 'owner-user', minutes: 999 }));
  await assertSucceeds(getDoc(doc(ownerDb, 'weekly_rankings', '2026-08-17', 'members', 'stranger-user')));
});

test('ranking geral é público para autenticados e protegido contra escrita do cliente', async () => {
  const strangerDb = environment.authenticatedContext('stranger-user').firestore();
  const adminDb = environment.authenticatedContext('admin-user').firestore();
  await assertSucceeds(getDocs(collection(strangerDb, 'general_rankings', 'all', 'members')));
  await assertFails(setDoc(doc(strangerDb, 'general_rankings', 'all', 'members', 'stranger-user'), { uid: 'stranger-user', questions: 999 }));
  await assertFails(setDoc(doc(adminDb, 'general_rankings', 'all', 'members', 'stranger-user'), { uid: 'stranger-user', questions: 999 }));
});

test('admin_audit_logs é legível por admin e imutável para clientes', async () => {
  await environment.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), 'admin_audit_logs', 'log-1'), { action: 'user.blocked', actorUid: 'admin-user', targetUid: 'owner-user' });
  });
  const adminDb = environment.authenticatedContext('admin-user').firestore();
  const ownerDb = environment.authenticatedContext('owner-user').firestore();
  await assertSucceeds(getDoc(doc(adminDb, 'admin_audit_logs', 'log-1')));
  await assertFails(getDoc(doc(ownerDb, 'admin_audit_logs', 'log-1')));
  await assertFails(setDoc(doc(adminDb, 'admin_audit_logs', 'manual'), { action: 'manual' }));
});

test('notificação pessoal só permite ao dono marcar como lida', async () => {
  await environment.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), 'users', 'owner-user', 'notifications', 'league-alert'), { title: 'Zona alterada', isRead: false, createdAt: '2026-08-20T12:00:00.000Z' });
  });
  const ownerDb = environment.authenticatedContext('owner-user').firestore();
  const strangerDb = environment.authenticatedContext('stranger-user').firestore();
  await assertSucceeds(getDoc(doc(ownerDb, 'users', 'owner-user', 'notifications', 'league-alert')));
  await assertFails(getDoc(doc(strangerDb, 'users', 'owner-user', 'notifications', 'league-alert')));
  await assertSucceeds(updateDoc(doc(ownerDb, 'users', 'owner-user', 'notifications', 'league-alert'), { isRead: true, readAt: '2026-08-20T12:01:00.000Z', updatedAt: '2026-08-20T12:01:00.000Z' }));
  await assertFails(updateDoc(doc(ownerDb, 'users', 'owner-user', 'notifications', 'league-alert'), { title: 'Alterado' }));
});

test('grupo público é descoberto, grupo privado exige participação', async () => {
  const strangerDb = environment.authenticatedContext('stranger-user').firestore();
  const memberDb = environment.authenticatedContext('group-member').firestore();
  await assertSucceeds(getDoc(doc(strangerDb, 'study_groups', 'public-group')));
  await assertFails(getDoc(doc(strangerDb, 'study_groups', 'private-group')));
  const directoryGroup = await assertSucceeds(getDoc(doc(strangerDb, 'study_group_directory', 'private-group')));
  assert.equal(directoryGroup.data().visibility, 'private');
  assert.equal(Object.hasOwn(directoryGroup.data(), 'inviteCode'), false);
  await assertSucceeds(getDoc(doc(memberDb, 'study_groups', 'private-group')));
  await assertSucceeds(getDocs(collection(memberDb, 'study_groups', 'private-group', 'members')));
  await assertFails(getDocs(collection(strangerDb, 'study_groups', 'private-group', 'members')));
});

test('diretório sanitizado de grupos exige autenticação e rejeita escrita do cliente', async () => {
  const strangerDb = environment.authenticatedContext('stranger-user').firestore();
  const anonymousDb = environment.unauthenticatedContext().firestore();
  await assertSucceeds(getDocs(collection(strangerDb, 'study_group_directory')));
  await assertFails(getDocs(collection(anonymousDb, 'study_group_directory')));
  await assertFails(setDoc(doc(strangerDb, 'study_group_directory', 'forged-group'), {
    groupId: 'forged-group', name: 'Forjado', visibility: 'public', weeklyMinutes: 999999,
  }));
});

test('líder promove vice-líder, que gerencia o grupo e remove apenas membros comuns', async () => {
  const ownerDb = environment.authenticatedContext('owner-user').firestore();
  const memberDb = environment.authenticatedContext('group-member').firestore();
  await assertSucceeds(updateDoc(doc(ownerDb, 'study_groups', 'private-group', 'members', 'group-member'), {
    role: 'vice_leader',
    permissions: { manageGroup: true, manageMembers: true },
    updatedAt: '2026-08-20T12:00:00.000Z',
  }));
  await assertSucceeds(updateDoc(doc(memberDb, 'study_groups', 'private-group'), { description: 'Atualizado por gestor' }));
  await assertFails(deleteDoc(doc(memberDb, 'study_groups', 'private-group')));

  await environment.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    await setDoc(doc(db, 'users', 'removable-user', 'gamification', 'profile'), {
      totalXP: 10,
      groupIds: ['private-group'],
      mainGroupId: 'private-group',
      mainGroupName: 'Privado',
    });
    await setDoc(doc(db, 'study_groups', 'private-group', 'members', 'removable-user'), {
      uid: 'removable-user',
      role: 'member',
      permissions: { manageGroup: false, manageMembers: false },
    });
  });

  const removeBatch = writeBatch(memberDb);
  removeBatch.delete(doc(memberDb, 'study_groups', 'private-group', 'members', 'removable-user'));
  removeBatch.update(doc(memberDb, 'study_groups', 'private-group'), { memberCount: 2, updatedAt: '2026-08-20T12:01:00.000Z' });
  removeBatch.update(doc(memberDb, 'users', 'removable-user', 'gamification', 'profile'), {
    groupIds: [],
    lastRemovedGroupId: 'private-group',
    socialUpdatedAt: '2026-08-20T12:01:00.000Z',
  });
  await assertSucceeds(removeBatch.commit());
  await assertFails(deleteDoc(doc(memberDb, 'study_groups', 'private-group', 'members', 'owner-user')));
});

test('grupo privado exige solicitação e impede entrada direta pelo cliente', async () => {
  const newcomerDb = environment.authenticatedContext('newcomer-user').firestore();
  const ownerDb = environment.authenticatedContext('owner-user').firestore();
  await assertSucceeds(getDoc(doc(newcomerDb, 'study_group_invites', 'ABC1234')));
  await assertFails(getDocs(collection(newcomerDb, 'study_group_invites')));
  await assertFails(setDoc(doc(newcomerDb, 'study_groups', 'private-group', 'members', 'newcomer-user'), {
    uid: 'newcomer-user',
    role: 'admin',
    permissions: { manageGroup: true, manageMembers: true },
    joinSource: 'invite',
    inviteCodeUsed: 'ABC1234',
  }));
  await assertFails(setDoc(doc(newcomerDb, 'study_groups', 'private-group', 'members', 'newcomer-user'), {
    uid: 'newcomer-user',
    role: 'member',
    permissions: { manageGroup: false, manageMembers: false },
    joinSource: 'invite',
    inviteCodeUsed: 'ABC1234',
  }));
  await assertSucceeds(setDoc(doc(newcomerDb, 'study_groups', 'private-group', 'join_requests', 'newcomer-user'), {
    uid: 'newcomer-user',
    status: 'pending',
    displayName: 'Novo membro',
  }));
  await assertSucceeds(getDoc(doc(newcomerDb, 'study_groups', 'private-group', 'join_requests', 'newcomer-user')));
  await assertFails(updateDoc(doc(newcomerDb, 'study_groups', 'private-group', 'join_requests', 'newcomer-user'), { status: 'approved' }));
  await assertSucceeds(getDoc(doc(ownerDb, 'study_groups', 'private-group', 'join_requests', 'newcomer-user')));
});

test('usuário autenticado consegue criar grupo com convite e perfil no mesmo batch', async () => {
  const creatorDb = environment.authenticatedContext('creator-user').firestore();
  const groupRef = doc(collection(creatorDb, 'study_groups'));
  const batch = writeBatch(creatorDb);

  batch.set(groupRef, {
    name: 'Grupo novo',
    description: 'Teste de criação',
    visibility: 'private',
    ownerId: 'creator-user',
    inviteCode: 'NEW1234',
    memberCount: 1,
    weeklyMinutes: 0,
    weeklyQuestions: 0,
    weeklyCorrect: 0,
    weeklyAccuracy: 0,
  });
  batch.set(doc(creatorDb, 'study_groups', groupRef.id, 'members', 'creator-user'), {
    uid: 'creator-user',
    role: 'owner',
    permissions: { manageGroup: true, manageMembers: true },
    minutes: 0,
    questions: 0,
    correct: 0,
  });
  batch.set(doc(creatorDb, 'study_group_invites', 'NEW1234'), {
    code: 'NEW1234',
    groupId: groupRef.id,
    groupName: 'Grupo novo',
    ownerId: 'creator-user',
    active: true,
  });
  batch.set(doc(creatorDb, 'users', 'creator-user', 'gamification', 'profile'), {
    groupIds: [groupRef.id],
    lastJoinedGroupId: groupRef.id,
    mainGroupId: groupRef.id,
    mainGroupName: 'Grupo novo',
    createdGroupCount: 1,
  }, { merge: true });

  await assertSucceeds(batch.commit());
  await assertSucceeds(getDoc(doc(creatorDb, 'study_groups', groupRef.id)));
});

test('backend aprova solicitação privada e exige sucessor para saída de liderança', async () => {
  const adminDb = admin.firestore();
  const groupId = 'managed-request-group';
  await adminDb.collection('study_groups').doc(groupId).set({ name: 'Grupo gerenciado', visibility: 'private', ownerId: 'request-owner', memberCount: 2 });
  await adminDb.collection('study_groups').doc(groupId).collection('members').doc('request-owner').set({ uid: 'request-owner', displayName: 'Líder', role: 'owner', permissions: { manageGroup: true, manageMembers: true } });
  await adminDb.collection('study_groups').doc(groupId).collection('members').doc('successor-user').set({ uid: 'successor-user', displayName: 'Sucessor', role: 'member', permissions: { manageGroup: false, manageMembers: false } });
  await adminDb.collection('users').doc('request-owner').set({ uid: 'request-owner', displayName: 'Líder' });
  await adminDb.collection('users').doc('request-user').set({ uid: 'request-user', displayName: 'Candidato' });
  await adminDb.collection('users').doc('request-user').collection('gamification').doc('profile').set({ groupIds: [] });
  await adminDb.collection('users').doc('request-owner').collection('gamification').doc('profile').set({ groupIds: [groupId], mainGroupId: groupId });

  const requested = await groupService.createJoinRequest({ uid: 'request-user', groupId, caller: { displayName: 'Candidato' } });
  assert.equal(requested.status, 'pending');
  const managerNotification = await adminDb.collection('users').doc('request-owner').collection('notifications').doc(`group_request_${groupId}_request-user`).get();
  assert.equal(managerNotification.data().requiresAction, true);

  const approved = await groupService.respondJoinRequest({ managerUid: 'request-owner', groupId, requestUid: 'request-user', approve: true });
  assert.equal(approved.status, 'approved');
  assert.equal((await adminDb.collection('study_groups').doc(groupId).collection('members').doc('request-user').get()).exists, true);
  assert.ok((await adminDb.collection('users').doc('request-user').collection('gamification').doc('profile').get()).data().groupIds.includes(groupId));

  await assert.rejects(() => groupService.leaveGroup({ uid: 'request-owner', groupId }), /Escolha outro membro/);
  const left = await groupService.leaveGroup({ uid: 'request-owner', groupId, successorUid: 'successor-user' });
  assert.equal(left.status, 'left');
  assert.equal((await adminDb.collection('study_groups').doc(groupId).get()).data().ownerId, 'successor-user');
  assert.equal((await adminDb.collection('study_groups').doc(groupId).collection('members').doc('successor-user').get()).data().role, 'owner');
});

test('código válido libera entrada imediata em grupo privado', async () => {
  const adminDb = admin.firestore();
  const groupId = 'private-code-group';
  await adminDb.collection('study_groups').doc(groupId).set({ name: 'Grupo com código', visibility: 'private', ownerId: 'code-owner', memberCount: 1 });
  await adminDb.collection('study_groups').doc(groupId).collection('members').doc('code-owner').set({ uid: 'code-owner', role: 'owner', permissions: { manageGroup: true, manageMembers: true } });
  await adminDb.collection('study_group_invites').doc('CODE123').set({ groupId, groupName: 'Grupo com código', ownerId: 'code-owner', active: true });
  await adminDb.collection('users').doc('code-user').set({ uid: 'code-user', displayName: 'Entrada por código' });

  const joined = await groupService.joinPrivateGroupByCode({ uid: 'code-user', inviteCode: 'code123' });
  assert.equal(joined.status, 'joined');
  assert.equal(joined.groupId, groupId);
  assert.equal((await adminDb.collection('study_groups').doc(groupId).collection('members').doc('code-user').get()).exists, true);
  assert.ok((await adminDb.collection('users').doc('code-user').collection('gamification').doc('profile').get()).data().groupIds.includes(groupId));
  assert.equal((await adminDb.collection('study_groups').doc(groupId).get()).data().memberCount, 2);
  await adminDb.collection('study_groups').doc(groupId).collection('weekly_rankings').doc(getWeekId()).collection('members').doc('code-user').set({
    uid: 'code-user', minutes: 75, questions: 18, competitiveXP: 93,
  });
  const listedGroup = (await groupService.listGroups()).find((group) => group.id === groupId);
  assert.equal(listedGroup.visibility, 'private');
  assert.equal(listedGroup.memberCount, 2);
  assert.equal(listedGroup.weeklyMinutes, 75);
  assert.equal(listedGroup.weeklyQuestions, 18);
  assert.equal(Object.hasOwn(listedGroup, 'inviteCode'), false);
});

test('listagem de grupos repara contador divergente pela subcolecao de membros', async () => {
  const adminDb = admin.firestore();
  const groupId = 'drifted-member-count-group';
  await adminDb.collection('study_groups').doc(groupId).set({
    name: 'Grupo com contador divergente', visibility: 'public', ownerId: 'owner-user', memberCount: 3,
  });
  await adminDb.collection('study_groups').doc(groupId).collection('members').doc('owner-user').set({
    uid: 'owner-user', role: 'owner', permissions: { manageGroup: true, manageMembers: true },
  });

  const listedGroup = (await groupService.listGroups()).find((group) => group.id === groupId);
  assert.equal(listedGroup.memberCount, 1);
  assert.equal((await adminDb.collection('study_groups').doc(groupId).get()).data().memberCount, 1);
  assert.equal((await adminDb.collection('study_group_directory').doc(groupId).get()).data().memberCount, 1);
});

test('dono consegue sair e encerrar grupo quando é o único membro', async () => {
  const adminDb = admin.firestore();
  const groupId = 'single-owner-group';
  await adminDb.collection('study_groups').doc(groupId).set({ name: 'Grupo vazio', visibility: 'private', ownerId: 'single-owner', inviteCode: 'SINGLE1', memberCount: 1 });
  await adminDb.collection('study_groups').doc(groupId).collection('members').doc('single-owner').set({ uid: 'single-owner', role: 'owner', permissions: { manageGroup: true, manageMembers: true } });
  await adminDb.collection('study_group_invites').doc('SINGLE1').set({ groupId, active: true });
  await adminDb.collection('users').doc('single-owner').collection('gamification').doc('profile').set({ groupIds: [groupId], mainGroupId: groupId, mainGroupName: 'Grupo vazio' });

  const left = await groupService.leaveGroup({ uid: 'single-owner', groupId });
  assert.equal(left.status, 'left');
  assert.equal(left.groupDeleted, true);
  assert.equal((await adminDb.collection('study_groups').doc(groupId).get()).exists, false);
  assert.equal((await adminDb.collection('study_group_invites').doc('SINGLE1').get()).exists, false);
  const profile = (await adminDb.collection('users').doc('single-owner').collection('gamification').doc('profile').get()).data();
  assert.deepEqual(profile.groupIds, []);
  assert.equal(profile.mainGroupId, null);
});

test('timer ao vivo é visível somente para dono, admin ou colega de grupo', async () => {
  const memberDb = environment.authenticatedContext('group-member').firestore();
  const strangerDb = environment.authenticatedContext('stranger-user').firestore();
  await assertSucceeds(getDoc(doc(memberDb, 'active_timers', 'owner-user')));
  await assertFails(getDoc(doc(strangerDb, 'active_timers', 'owner-user')));
});

test('função recalcula estudo, edição e exclusão sem duplicar XP ou ranking', async () => {
  const uid = 'gamification-function-user';
  const adminDb = admin.firestore();
  const dateKey = toDateKey();
  const weekId = getWeekId();
  const groupId = 'function-live-group';
  await adminDb.collection('users').doc(uid).set({ uid, displayName: 'Aluno Função' });
  await adminDb.collection('users').doc(uid).collection('gamification').doc('profile').set({ baseXP: 0, currentLeague: 'iron', groupIds: [groupId] });
  await adminDb.collection('study_groups').doc(groupId).set({ name: 'Grupo agregado', visibility: 'public', ownerId: uid, memberCount: 1 });
  await adminDb.collection('study_groups').doc(groupId).collection('members').doc(uid).set({ uid, role: 'owner', permissions: { manageGroup: true, manageMembers: true } });
  const recordRef = adminDb.collection('users').doc(uid).collection('registrosEstudo').doc('study-1');
  await recordRef.set({
    data: dateKey,
    timestamp: admin.firestore.Timestamp.now(),
    tempoEstudadoMinutos: 180,
    questoesFeitas: 40,
    acertos: 30,
  });

  const first = await gamificationService.recomputeUserGamification(uid);
  const firstProfile = (await adminDb.collection('users').doc(uid).collection('gamification').doc('profile').get()).data();
  const firstEvent = (await adminDb.collection('users').doc(uid).collection('gamification').doc('profile').collection('xp_events').doc('academic_study_study-1').get()).data();
  const firstEvents = await adminDb.collection('users').doc(uid).collection('gamification').doc('profile').collection('xp_events').get();
  assert.equal(firstEvent.xpCompetitive, 255);
  assert.equal(firstProfile.weeklyCompetitiveXP, 255);
  assert.ok(firstProfile.totalXP > 255);
  assert.ok(first.cohortId);
  const firstGroupRanking = (await adminDb.collection('study_groups').doc(groupId).collection('weekly_rankings').doc(weekId).collection('members').doc(uid).get()).data();
  const generalRanking = (await adminDb.collection('general_rankings').doc('all').collection('members').doc(uid).get()).data();
  assert.equal(firstGroupRanking.minutes, 180);
  assert.equal(firstGroupRanking.questions, 40);
  assert.equal(generalRanking.minutes, 180);
  const leagueMember = (await adminDb.collection('weekly_rankings').doc(weekId).collection('cohorts').doc(first.cohortId).collection('members').doc(uid).get()).data();
  assert.equal(leagueMember.position, 1);
  assert.equal(leagueMember.previousPosition, 1);
  assert.equal(leagueMember.positionDelta, 0);

  await gamificationService.recomputeUserGamification(uid);
  const secondProfile = (await adminDb.collection('users').doc(uid).collection('gamification').doc('profile').get()).data();
  const secondEvents = await adminDb.collection('users').doc(uid).collection('gamification').doc('profile').collection('xp_events').get();
  const secondEvent = (await adminDb.collection('users').doc(uid).collection('gamification').doc('profile').collection('xp_events').doc('academic_study_study-1').get()).data();
  const secondGeneralRanking = (await adminDb.collection('general_rankings').doc('all').collection('members').doc(uid).get()).data();
  assert.equal(secondProfile.totalXP, firstProfile.totalXP);
  assert.equal(secondEvents.size, firstEvents.size);
  assert.equal(secondProfile.updatedAt.toMillis(), firstProfile.updatedAt.toMillis());
  assert.equal(secondEvent.updatedAt.toMillis(), firstEvent.updatedAt.toMillis());
  assert.equal(secondGeneralRanking.updatedAt.toMillis(), generalRanking.updatedAt.toMillis());

  await recordRef.set({ tempoEstudadoMinutos: 20, questoesFeitas: 0, acertos: 0 }, { merge: true });
  await gamificationService.recomputeUserGamification(uid);
  const editedEvent = (await adminDb.collection('users').doc(uid).collection('gamification').doc('profile').collection('xp_events').doc('academic_study_study-1').get()).data();
  const editedRanking = (await adminDb.collection('weekly_rankings').doc(weekId).collection('members').doc(uid).get()).data();
  assert.equal(editedEvent.xpCompetitive, 25);
  assert.equal(editedRanking.competitiveXP, 25);

  await recordRef.delete();
  await gamificationService.recomputeUserGamification(uid);
  const deletedEvent = await adminDb.collection('users').doc(uid).collection('gamification').doc('profile').collection('xp_events').doc('academic_study_study-1').get();
  const deletedRanking = await adminDb.collection('weekly_rankings').doc(weekId).collection('members').doc(uid).get();
  const deletedGroupRanking = await adminDb.collection('study_groups').doc(groupId).collection('weekly_rankings').doc(weekId).collection('members').doc(uid).get();
  const preservedAchievement = await adminDb.collection('users').doc(uid).collection('gamification').doc('profile').collection('achievements').doc('first_study').get();
  const finalProfile = (await adminDb.collection('users').doc(uid).collection('gamification').doc('profile').get()).data();
  assert.equal(deletedEvent.exists, false);
  assert.equal(deletedRanking.exists, false);
  assert.equal(deletedGroupRanking.exists, false);
  assert.equal(finalProfile.weeklyCompetitiveXP, 0);
  assert.equal(preservedAchievement.data().unlocked, true);
});

test('pipeline incremental limita o trabalho ao dia e retry não regrava perfil, evento ou outros ranks', async () => {
  const uid = 'gamification-incremental-user';
  const otherUid = 'gamification-unrelated-rank-user';
  const adminDb = admin.firestore();
  const dateKey = toDateKey();
  const fixedTimestamp = admin.firestore.Timestamp.fromMillis(1234567890000);
  const userRef = adminDb.collection('users').doc(uid);
  const profileRef = userRef.collection('gamification').doc('profile');
  const record = {
    data: dateKey,
    timestamp: admin.firestore.Timestamp.now(),
    tempoEstudadoMinutos: 60,
    questoesFeitas: 20,
    acertos: 15,
  };
  await userRef.set({ uid, displayName: 'Aluno Incremental' });
  await profileRef.set({
    baseXP: 0,
    totalXP: 0,
    currentLeague: 'iron',
    groupIds: [],
    achievementIds: [],
    totals: { minutes: 0, questions: 0, correct: 0, studies: 0, simulations: 0, reviews: 0, dailyGoals: 0 },
  });
  await userRef.collection('registrosEstudo').doc('study-incremental').set(record);
  const unrelatedRankRef = adminDb.collection('general_rankings').doc('all').collection('members').doc(otherUid);
  await unrelatedRankRef.set({
    uid: otherUid,
    displayName: 'Outro aluno',
    minutes: 10,
    questions: 5,
    correct: 4,
    rankingEligible: true,
    positions: { minutes: 1, questions: 1 },
    updatedAt: fixedTimestamp,
  });

  const change = {
    uid,
    sourceType: 'study',
    sourceId: 'study-incremental',
    before: null,
    after: record,
    eventId: 'incremental-event-1',
  };
  await gamificationService.processGamificationSourceChange(change);
  const firstProfile = (await profileRef.get()).data();
  const eventRef = profileRef.collection('xp_events').doc('academic_study_study-incremental');
  const firstEvent = (await eventRef.get()).data();
  const firstRank = (await adminDb.collection('general_rankings').doc('all').collection('members').doc(uid).get()).data();
  const unrelatedAfterFirst = (await unrelatedRankRef.get()).data();
  assert.equal(firstProfile.totals.minutes, 60);
  assert.equal(firstProfile.historicalStreakBaseline.value, 0);
  assert.equal(firstRank.minutes, 60);
  assert.ok(firstEvent.xpTotal > 0);
  assert.equal(unrelatedAfterFirst.updatedAt.toMillis(), fixedTimestamp.toMillis());

  await gamificationService.processGamificationSourceChange(change);
  const secondProfile = (await profileRef.get()).data();
  const secondEvent = (await eventRef.get()).data();
  const secondRank = (await adminDb.collection('general_rankings').doc('all').collection('members').doc(uid).get()).data();
  assert.equal(secondProfile.updatedAt.toMillis(), firstProfile.updatedAt.toMillis());
  assert.equal(secondEvent.updatedAt.toMillis(), firstEvent.updatedAt.toMillis());
  assert.equal(secondRank.updatedAt.toMillis(), firstRank.updatedAt.toMillis());
  assert.equal((await unrelatedRankRef.get()).data().updatedAt.toMillis(), fixedTimestamp.toMillis());
});

test('entrada concorrente nunca ultrapassa dez usuários antes da mesclagem', async () => {
  const adminDb = admin.firestore();
  const weekId = getWeekId();
  const rankingRef = adminDb.collection('weekly_rankings').doc(weekId);
  await rankingRef.collection('league_states').doc('iron').set({ leagueId: 'iron', openSequence: 77 });
  await rankingRef.collection('cohorts').doc('iron-0077').set({ id: 'iron-0077', leagueId: 'iron', weekId, sequence: 77, participantCount: 9, status: 'open' });
  const users = ['concurrent-a', 'concurrent-b'];
  for (const uid of users) {
    await adminDb.collection('users').doc(uid).set({ uid, displayName: uid });
    await adminDb.collection('users').doc(uid).collection('gamification').doc('profile').set({ baseXP: 0, currentLeague: 'iron', groupIds: [] });
    await adminDb.collection('users').doc(uid).collection('registrosEstudo').doc('study').set({ data: toDateKey(), timestamp: admin.firestore.Timestamp.now(), tempoEstudadoMinutos: 10 });
  }
  await Promise.all(users.map((uid) => gamificationService.recomputeUserGamification(uid)));
  const cohorts = await rankingRef.collection('cohorts').where('sequence', '>=', 77).get();
  const counts = cohorts.docs.map((item) => Number(item.data().participantCount || 0));
  assert.ok(counts.every((count) => count <= 10));
  assert.ok(counts.includes(10));
  assert.ok(counts.includes(1));
});

test('fechamento semanal repetido não duplica prêmio, promoção ou notificação', async () => {
  const adminDb = admin.firestore();
  const weekId = '2026-08-03';
  const cohortId = 'iron-closure-0001';
  const rankingRef = adminDb.collection('weekly_rankings').doc(weekId);
  const cohortRef = rankingRef.collection('cohorts').doc(cohortId);
  const users = Array.from({ length: 6 }, (_, index) => ({
    uid: `closure-user-${index + 1}`,
    competitiveXP: 600 - (index * 50),
  }));

  await cohortRef.set({
    id: cohortId,
    leagueId: 'iron',
    weekId,
    sequence: 1,
    participantCount: users.length,
    status: 'open',
  });

  for (const [index, member] of users.entries()) {
    const memberData = {
      uid: member.uid,
      displayName: `Aluno ${index + 1}`,
      competitiveXP: member.competitiveXP,
      reachedAtMillis: index + 1,
      highestLeagueIndex: 0,
    };
    await adminDb.collection('users').doc(member.uid).set({ uid: member.uid, displayName: memberData.displayName });
    await adminDb.collection('users').doc(member.uid).collection('gamification').doc('profile').set({
      baseXP: 0,
      totalXP: 0,
      currentLeague: 'iron',
      currentCohortId: cohortId,
      groupIds: [],
    });
    await cohortRef.collection('members').doc(member.uid).set(memberData);
    await rankingRef.collection('members').doc(member.uid).set({ ...memberData, cohortId, leagueId: 'iron' });
  }

  const first = await gamificationService.closeWeeklyGamification(weekId);
  const winnerProfileRef = adminDb.collection('users').doc(users[0].uid).collection('gamification').doc('profile');
  const winnerEventsRef = winnerProfileRef.collection('xp_events');
  const firstWinnerProfile = (await winnerProfileRef.get()).data();
  const firstWinnerEvents = await winnerEventsRef.get();
  const firstWinnerResult = (await cohortRef.collection('members').doc(users[0].uid).get()).data().result;

  assert.equal(first.cohortResults, 6);
  assert.equal(firstWinnerProfile.currentLeague, 'bronze');
  assert.equal(firstWinnerResult.status, 'promoted');
  assert.equal(firstWinnerResult.leagueRewardXP, 100);
  assert.equal(firstWinnerEvents.docs.filter((item) => item.id.startsWith('reward_')).length, 2);

  const repeated = await gamificationService.closeWeeklyGamification(weekId);
  const repeatedWinnerProfile = (await winnerProfileRef.get()).data();
  const repeatedWinnerEvents = await winnerEventsRef.get();
  const repeatedWinnerResult = (await cohortRef.collection('members').doc(users[0].uid).get()).data().result;

  assert.equal(repeated.alreadyClosed, true);
  assert.equal(repeatedWinnerProfile.currentLeague, 'bronze');
  assert.equal(repeatedWinnerProfile.totalXP, firstWinnerProfile.totalXP);
  assert.equal(repeatedWinnerEvents.size, firstWinnerEvents.size);
  assert.deepEqual(
    repeatedWinnerEvents.docs.map((item) => item.id).sort(),
    firstWinnerEvents.docs.map((item) => item.id).sort(),
  );
  assert.equal(repeatedWinnerResult.status, firstWinnerResult.status);
});

test('migração simula, arredonda, aplica em Ferro e repete com segurança', async () => {
  const uid = 'migration-v2-user';
  const adminDb = admin.firestore();
  await adminDb.collection('users').doc(uid).set({ uid, displayName: 'Migrado' });
  await adminDb.collection('users').doc(uid).collection('gamification').doc('profile').set({ totalXP: 74597, groupIds: [] });
  const dryRun = await gamificationService.migrateGamification({ uid, apply: false });
  assert.equal(dryRun.mode, 'dry-run');
  assert.equal(dryRun.users[0].baseXP, 74600);
  assert.equal(dryRun.users[0].roundingXP, 3);

  const applied = await gamificationService.migrateGamification({ uid, apply: true });
  const profile = (await adminDb.collection('users').doc(uid).collection('gamification').doc('profile').get()).data();
  assert.equal(applied.mode, 'apply');
  assert.equal(profile.baseXP, 74600);
  assert.equal(profile.currentLeague, 'iron');
  assert.equal(profile.competitionStartsWeekId, getNextWeekId(getWeekId()));
  const repeated = await gamificationService.migrateGamification({ uid, apply: true });
  const repeatedProfile = (await adminDb.collection('users').doc(uid).collection('gamification').doc('profile').get()).data();
  assert.equal(repeated.users[0].alreadyMigrated, true);
  assert.equal(repeatedProfile.baseXP, 74600);
  assert.equal(repeatedProfile.totalXP, profile.totalXP);
});

test('upsertPrivateQuestion e deletePrivateQuestion gerenciam questao privada e gabarito protegido com seguranca', async () => {
  const adminDb = admin.firestore();
  const uid = 'owner-user';
  await adminDb.collection('users').doc(uid).set({ uid, name: 'Dono' }, { merge: true });

  const created = await questionValidation.upsertPrivateQuestion({
    uid,
    data: {
      question: {
        statement: 'Qual o principio fundamental da CF/88?',
        options: [
          { id: 'A', text: 'Soberania' },
          { id: 'B', text: 'Arbitrariedade' },
        ],
        disciplineId: 'direito',
        subject: 'Constitucional',
        difficulty: 'easy',
      },
      answerKey: {
        correctOptionId: 'A',
        explanation: 'A soberania e um dos fundamentos da RFB conforme art. 1o, I da CF/88.',
      },
    },
  });

  assert.ok(created.id);
  assert.equal(created.questionScope, 'private');
  assert.equal(created.userId, uid);
  assert.equal(created.statement, 'Qual o principio fundamental da CF/88?');

  const ownerDb = environment.authenticatedContext('owner-user').firestore();
  const strangerDb = environment.authenticatedContext('stranger-user').firestore();

  // O dono consegue ler a questão client-safe
  const qSnap = await assertSucceeds(getDoc(doc(ownerDb, 'users', uid, 'questions', created.id)));
  assert.equal(qSnap.data().correctOptionId, undefined);
  assert.equal(qSnap.data().explanation, undefined);

  const updatedWithoutAnswer = await questionValidation.upsertPrivateQuestion({
    uid,
    data: {
      questionId: created.id,
      question: {
        statement: 'Enunciado atualizado sem reenviar gabarito',
        options: created.options,
        disciplineId: created.disciplineId,
        subject: created.subject,
        difficulty: created.difficulty,
        sourceType: created.sourceType,
      },
    },
  });
  assert.equal(updatedWithoutAnswer.statement, 'Enunciado atualizado sem reenviar gabarito');
  const preservedAnswer = await adminDb.collection('users').doc(uid).collection('questions').doc(created.id).collection('private').doc('answerKey').get();
  assert.equal(preservedAnswer.data().correctOptionId, 'A');

  await assert.rejects(
    () => questionValidation.upsertPrivateQuestion({
      uid,
      data: {
        questionId: created.id,
        question: {
          statement: 'Alternativa correta mudou sem confirmação',
          options: [{ id: 'A', text: 'Texto alterado' }, { id: 'B', text: 'Arbitrariedade' }],
          disciplineId: created.disciplineId,
          subject: created.subject,
          difficulty: created.difficulty,
          sourceType: created.sourceType,
        },
      },
    }),
    /incompativeis com o gabarito protegido atual/,
  );

  await questionValidation.upsertPrivateQuestion({
    uid,
    data: {
      questionId: created.id,
      question: {
        statement: 'Novo gabarito confirmado explicitamente',
        options: [{ id: 'A', text: 'Texto alterado' }, { id: 'B', text: 'Resposta nova' }],
        disciplineId: created.disciplineId,
        subject: created.subject,
        difficulty: created.difficulty,
        sourceType: created.sourceType,
      },
      answerKey: { correctOptionId: 'B', explanation: 'Alteracao intencional.' },
    },
  });
  const replacedAnswer = await adminDb.collection('users').doc(uid).collection('questions').doc(created.id).collection('private').doc('answerKey').get();
  assert.equal(replacedAnswer.data().correctOptionId, 'B');

  // Outro usuário NÃO consegue ler
  await assertFails(getDoc(doc(strangerDb, 'users', uid, 'questions', created.id)));

  // Gabarito protegido é bloqueado para qualquer leitura direta no client
  await assertFails(getDoc(doc(ownerDb, 'users', uid, 'questions', created.id, 'private', 'answerKey')));
  await assertFails(getDoc(doc(strangerDb, 'users', uid, 'questions', created.id, 'private', 'answerKey')));

  // Atualização de anotações e domínio no ErrorBookEntry pelo dono
  const errorRef = doc(ownerDb, 'users', uid, 'error_book', 'question:global:seed');
  await assertSucceeds(updateDoc(errorRef, {
    userNotes: 'Preciso revisar este conceito no fim de semana.',
    mastered: true,
    masteredAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  }));
  await assertFails(updateDoc(errorRef, {
    userNotes: 'x'.repeat(4001),
    updatedAt: serverTimestamp(),
  }));
  await assertFails(updateDoc(errorRef, {
    mastered: false,
    masteredAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  }));
  await assertFails(updateDoc(errorRef, {
    wrongCount: 999,
    updatedAt: serverTimestamp(),
  }));

  const strangerErrorRef = doc(strangerDb, 'users', uid, 'error_book', 'question:global:seed');
  await assertFails(updateDoc(strangerErrorRef, {
    userNotes: 'Tentativa de invasão.',
  }));

  // Exclusão segura pelo backend
  const deleted = await questionValidation.deletePrivateQuestion({ uid, questionId: created.id });
  assert.equal(deleted.ok, true);
  assert.equal(deleted.questionId, created.id);

  const afterDeleteSnap = await adminDb.collection('users').doc(uid).collection('questions').doc(created.id).get();
  assert.equal(afterDeleteSnap.exists, false);
});

test('Decks e Cards: Firestore Rules garantem ownership, archived, integridade e isolamento de mutacao', async () => {
  const uid = 'deck-rules-owner';
  const strangerUid = 'deck-rules-stranger';
  const ownerDb = environment.authenticatedContext(uid).firestore();
  const strangerDb = environment.authenticatedContext(strangerUid).firestore();
  const adminDb = admin.firestore();

  await adminDb.collection('users').doc(uid).set({ uid, name: 'Dono Deck' });
  await adminDb.collection('users').doc(strangerUid).set({ uid: strangerUid, name: 'Estranho' });
  await adminDb.collection('users').doc(uid).collection('study_folders').doc('folder-deck-rules').set({
    userId: uid, name: 'Pasta dos Decks', description: '', order: 1, archived: false,
    createdAt: admin.firestore.FieldValue.serverTimestamp(), updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  const deckRef = doc(ownerDb, 'users', uid, 'decks', 'deck-test-1');

  // 1. Criacao valida por owner
  await assertSucceeds(setDoc(deckRef, {
    userId: uid,
    name: 'Direito Constitucional',
    description: 'Deck de revisao de Dir. Const.',
    folderId: 'folder-deck-rules',
    cardCount: 0,
    tags: ['direito', 'cf88'],
    archived: false,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  }));

  await assertFails(setDoc(doc(ownerDb, 'users', uid, 'decks', 'deck-sem-pasta'), {
    userId: uid,
    name: 'Deck sem pasta',
    cardCount: 0,
    tags: [],
    archived: false,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  }));

  // 2. Criacao por outro usuario deve falhar
  await assertFails(setDoc(doc(strangerDb, 'users', uid, 'decks', 'deck-forged'), {
    userId: uid,
    name: 'Deck Forjado',
    folderId: 'folder-deck-rules',
    cardCount: 0,
    tags: [],
    archived: false,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  }));

  // 3. Criacao invalida (cardCount > 0 ou archived == true na criacao)
  await assertFails(setDoc(doc(ownerDb, 'users', uid, 'decks', 'deck-invalid-count'), {
    userId: uid,
    name: 'Invalido',
    folderId: 'folder-deck-rules',
    cardCount: 5,
    tags: [],
    archived: false,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  }));

  // 4. Update de metadados pelo owner mantendo cardCount e archived
  await assertSucceeds(updateDoc(deckRef, {
    name: 'Direito Constitucional - Atualizado',
    description: 'Nova descricao',
    tags: ['direito', 'constitucional', 'art5'],
    updatedAt: serverTimestamp(),
  }));

  // 5. Tentativa de alterar cardCount diretamente via client SDK deve FALHAR
  await assertFails(updateDoc(deckRef, {
    cardCount: 10,
    updatedAt: serverTimestamp(),
  }));

  // 6. Arquivamento e desarquivamento pelo owner
  await assertSucceeds(updateDoc(deckRef, {
    archived: true,
    updatedAt: serverTimestamp(),
  }));
  await assertSucceeds(updateDoc(deckRef, {
    archived: false,
    updatedAt: serverTimestamp(),
  }));

  // 7. Criacao de Card pelo Client SDK e bloqueada; backend cria o card valido
  const cardRef = doc(ownerDb, 'users', uid, 'decks', 'deck-test-1', 'cards', 'card-test-1');
  const schedulerState = {
    algorithm: 'sm2',
    version: 1,
    data: { repetition: 0, interval: 0, easeFactor: 2.5 },
  };
  const cardPayload = {
    userId: uid,
    deckId: 'deck-test-1',
    front: 'Qual o fundamento do art. 1o, I da CF/88?',
    back: 'Soberania.',
    tags: ['art1'],
    status: 'new',
    dueAt: Timestamp.now(),
    lapses: 0,
    reps: 0,
    reviewVersion: 0,
    schedulerState,
    sourceType: 'manual',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
  await assertFails(setDoc(cardRef, cardPayload));
  await adminDb.collection('users').doc(uid).collection('decks').doc('deck-test-1').collection('cards').doc('card-test-1').set({
    ...cardPayload,
    dueAt: admin.firestore.Timestamp.now(),
    createdAt: admin.firestore.Timestamp.now(),
    updatedAt: admin.firestore.Timestamp.now(),
  });

  // 8. Criacao de Card por outro usuario deve falhar
  await assertFails(setDoc(doc(strangerDb, 'users', uid, 'decks', 'deck-test-1', 'cards', 'card-forged'), {
    userId: strangerUid,
    deckId: 'deck-test-1',
    front: 'Pergunta',
    back: 'Resposta',
    tags: [],
    status: 'new',
    dueAt: Timestamp.now(),
    lapses: 0,
    reps: 0,
    schedulerState,
    sourceType: 'manual',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  }));

  // 9. Update de conteudo do card pelo owner
  await assertSucceeds(updateDoc(cardRef, {
    front: 'Pergunta editada',
    back: 'Resposta editada',
    tags: ['editado'],
    updatedAt: serverTimestamp(),
  }));

  // 10. CardReview e exclusivamente backend-authoritative
  const reviewRef = doc(ownerDb, 'users', uid, 'card_reviews', 'rev-1');
  await assertFails(setDoc(reviewRef, {
    userId: uid,
    cardId: 'card-test-1',
    deckId: 'deck-test-1',
    rating: 'good',
    elapsedTimeMs: 2500,
    scheduledDays: 1,
    previousState: schedulerState,
    nextState: { algorithm: 'sm2', version: 1, data: { repetition: 1, interval: 1, easeFactor: 2.5 } },
    reviewVersion: 1,
    reviewRequestId: 'req-test-1',
    isLapse: false,
    reviewedAt: serverTimestamp(),
  }));

  // 11. Update e delete de CardReview sao proibidos
  await assertFails(updateDoc(reviewRef, { rating: 'again' }));
  await assertFails(deleteDoc(reviewRef));

  // 12. Exclusao de Card pelo client tambem e bloqueada
  await assertFails(deleteDoc(cardRef));
  await assertFails(deleteDoc(doc(strangerDb, 'users', uid, 'decks', 'deck-test-1')));
  await adminDb.collection('users').doc(uid).collection('decks').doc('deck-test-1').collection('cards').doc('card-test-1').delete();
  await assertSucceeds(deleteDoc(deckRef));
});

test('reviewCard: concorrencia, idempotencia por reviewRequestId e protecao de versao', async () => {
  const adminDb = admin.firestore();
  const uid = 'review-concurrency-user';
  const deckId = 'deck-conc';
  const cardId = 'card-conc';

  await adminDb.collection('users').doc(uid).set({ uid });
  await adminDb.collection('users').doc(uid).collection('decks').doc(deckId).set({
    userId: uid, name: 'Deck Concorrencia', cardCount: 1, tags: [], archived: false,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  const initialSchedulerState = {
    algorithm: 'sm2',
    version: 1,
    data: { repetition: 2, interval: 6, easeFactor: 2.5 },
  };

  await adminDb.collection('users').doc(uid).collection('decks').doc(deckId).collection('cards').doc(cardId).set({
    userId: uid,
    deckId,
    front: 'Pergunta teste',
    back: 'Resposta teste',
    tags: [],
    status: 'review',
    dueAt: admin.firestore.Timestamp.now(),
    lapses: 0,
    reps: 2,
    reviewVersion: 0, // baseline 0
    schedulerState: initialSchedulerState,
    sourceType: 'manual',
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  // 1. Duas revisões concorrentes 'hard' com mesma expectedReviewVersion: 0
  const [res1, res2] = await Promise.allSettled([
    flashcardsBackendService.reviewCard({ uid, deckId, cardId, rating: 'hard', expectedReviewVersion: 0, reviewRequestId: 'req-A' }),
    flashcardsBackendService.reviewCard({ uid, deckId, cardId, rating: 'hard', expectedReviewVersion: 0, reviewRequestId: 'req-B' }),
  ]);

  const fulfilled = [res1, res2].filter((r) => r.status === 'fulfilled');
  const rejected = [res1, res2].filter((r) => r.status === 'rejected');

  assert.equal(fulfilled.length, 1);
  assert.equal(rejected.length, 1);
  assert.ok(/Stale state/.test(rejected[0].reason?.message));

  // O card foi atualizado para reviewVersion: 1
  const cardSnapAfter = await adminDb.collection('users').doc(uid).collection('decks').doc(deckId).collection('cards').doc(cardId).get();
  assert.equal(cardSnapAfter.data().reviewVersion, 1);

  // 2. Retry idêntico com o MESMO reviewRequestId que venceu (ex: req-A se res1 venceu)
  const winningReqId = fulfilled[0].value.review.reviewRequestId;
  const retryResult = await flashcardsBackendService.reviewCard({ uid, deckId, cardId, rating: 'hard',
    expectedReviewVersion: 0,
    reviewRequestId: winningReqId,
  });

  // Retorno idempotente: mesma versão, sem reaplicar scheduler
  assert.equal(retryResult.card.reviewVersion, 1);
  assert.equal(retryResult.review.reviewRequestId, winningReqId);

  const cardReviewsSnap = await adminDb.collection('users').doc(uid).collection('card_reviews').get();
  assert.equal(cardReviewsSnap.size, 1);
});

test('Flashcards ErrorBook: lapse real em again persiste e reconcilia no Caderno de Erros', async () => {
  const adminDb = admin.firestore();
  const uid = 'errorbook-flashcard-user';
  const deckId = 'deck-eb';
  const cardId = 'card-eb-lapse';

  await adminDb.collection('users').doc(uid).set({ uid });
  await adminDb.collection('users').doc(uid).collection('decks').doc(deckId).set({
    userId: uid, name: 'Deck ErrorBook', cardCount: 1, tags: [], archived: false,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  // Card já consolidado (reps = 3, interval = 15) sofrendo lapse
  await adminDb.collection('users').doc(uid).collection('decks').doc(deckId).collection('cards').doc(cardId).set({
    userId: uid,
    deckId,
    front: 'O que é ato administrativo discricionário?',
    back: 'Ato em que a lei confere margem de liberdade para conveniência e oportunidade.',
    tags: ['administrativo'],
    status: 'review',
    dueAt: admin.firestore.Timestamp.now(),
    lapses: 0,
    reps: 3,
    reviewVersion: 0,
    schedulerState: { algorithm: 'sm2', version: 1, data: { repetition: 3, interval: 15, easeFactor: 2.5 } },
    sourceType: 'manual',
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  const reviewResult = await flashcardsBackendService.reviewCard({ uid, deckId, cardId, rating: 'again',
    expectedReviewVersion: 0,
    reviewRequestId: 'req-lapse-1',
  });

  assert.equal(reviewResult.isLapse, true);
  assert.equal(reviewResult.card.status, 'relearning');

  // Sincronização via backend service
  const syncResult = await flashcardsBackendService.syncFlashcardErrorBook({
    uid,
    deckId,
    cardId,
    reviewId: reviewResult.review.id,
  });

  assert.equal(syncResult.ok, true);
  assert.equal(syncResult.entryId, `flashcard:${deckId}:${cardId}`);

  const errorEntrySnap = await adminDb.collection('users').doc(uid).collection('error_book').doc(`flashcard:${deckId}:${cardId}`).get();
  assert.equal(errorEntrySnap.exists, true);
  const errorData = errorEntrySnap.data();
  assert.equal(errorData.sourceType, 'flashcard');
  assert.equal(errorData.sourceId, cardId);
  assert.equal(errorData.deckId, deckId);
  assert.equal(errorData.wrongCount, 1);
  assert.equal(errorData.mastered, false);
  assert.equal(errorData.preview.front, 'O que é ato administrativo discricionário?');

  // Retry da sincronização do mesmo review não incrementa wrongCount
  const retrySync = await flashcardsBackendService.syncFlashcardErrorBook({
    uid,
    deckId,
    cardId,
    reviewId: reviewResult.review.id,
  });
  assert.equal(retrySync.duplicate, true);
  const errorEntryAfterRetry = await adminDb.collection('users').doc(uid).collection('error_book').doc(`flashcard:${deckId}:${cardId}`).get();
  assert.equal(errorEntryAfterRetry.data().wrongCount, 1);

  // Validação estrita: mismatch de deckId ou cardId deve falhar
  await assert.rejects(
    () => flashcardsBackendService.syncFlashcardErrorBook({ uid, deckId: 'wrong-deck', cardId, reviewId: reviewResult.review.id }),
    /deckId diverge/,
  );
  await assert.rejects(
    () => flashcardsBackendService.syncFlashcardErrorBook({ uid, deckId, cardId: 'wrong-card', reviewId: reviewResult.review.id }),
    /cardId diverge/,
  );
});

test('GeneratedItem -> Card: aprovacao atomica backend-authoritative e idempotente', async () => {
  const adminDb = admin.firestore();
  const uid = 'gen-item-owner';
  const deckId = 'deck-gen-target';
  const itemId = 'gen-item-123';

  await adminDb.collection('users').doc(uid).set({ uid });
  await adminDb.collection('users').doc(uid).collection('study_folders').doc('folder-gen').set({
    userId: uid, name: 'Pasta IA', description: '', order: 1, archived: false,
    createdAt: admin.firestore.FieldValue.serverTimestamp(), updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });
  await adminDb.collection('users').doc(uid).collection('study_sources').doc('source-gen').set({
    userId: uid, folderId: 'folder-gen', kind: 'note', title: 'Fonte IA', status: 'ready', sourceRevision: 1,
    originalText: 'Conteudo factual.', createdAt: admin.firestore.FieldValue.serverTimestamp(), updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });
  await adminDb.collection('users').doc(uid).collection('decks').doc(deckId).set({
    userId: uid, name: 'Deck Destino IA', folderId: 'folder-gen', cardCount: 0, tags: [], archived: false,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });
  await adminDb.collection('users').doc(uid).collection('generated_items').doc(itemId).set({
    userId: uid,
    sourceId: 'source-gen',
    type: 'flashcard',
    status: 'buffer',
    content: {
      front: 'O que é o princípio da impessoalidade?',
      back: 'A administração deve tratar todos sem privilégios ou discriminações.',
    },
    tags: ['constitucional'],
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  // 1. Aprovação normal
  const approval1 = await flashcardsBackendService.materializeGeneratedFlashcard({
    uid,
    generatedItemId: itemId,
    targetDeckId: deckId,
    firstRating: 'good',
    reviewRequestId: 'first-rating-1',
  });

  assert.equal(approval1.ok, true);
  assert.equal(approval1.duplicate, false);
  assert.ok(approval1.cardId);

  const cardSnap = await adminDb.collection('users').doc(uid).collection('decks').doc(deckId).collection('cards').doc(approval1.cardId).get();
  assert.equal(cardSnap.exists, true);
  assert.equal(cardSnap.data().front, 'O que é o princípio da impessoalidade?');
  assert.equal(cardSnap.data().reviewVersion, 0);

  const itemSnap = await adminDb.collection('users').doc(uid).collection('generated_items').doc(itemId).get();
  assert.equal(itemSnap.data().status, 'materialized');
  assert.equal(itemSnap.data().content.materializedCardId, approval1.cardId);
  const deckAfterMaterialization = await adminDb.collection('users').doc(uid).collection('decks').doc(deckId).get();
  assert.equal(deckAfterMaterialization.data().cardCount, 1);

  // 2. Retry / Double-click idempotente
  const approval2 = await flashcardsBackendService.materializeGeneratedFlashcard({
    uid,
    generatedItemId: itemId,
    targetDeckId: deckId,
    firstRating: 'good',
    reviewRequestId: 'first-rating-1',
  });
  assert.equal(approval2.ok, true);
  assert.equal(approval2.duplicate, true);
  assert.equal(approval2.cardId, approval1.cardId);

  const allCardsSnap = await adminDb.collection('users').doc(uid).collection('decks').doc(deckId).collection('cards').get();
  assert.equal(allCardsSnap.size, 1);
});

test('Migracao estrutural e administrativa, paginada e fora do bundle cliente', async () => {
  const adminDb = admin.firestore();
  const uid = 'anki-legacy-user';
  await adminDb.collection('users').doc(uid).set({ uid });

  // Cria deck legado sem archived
  await adminDb.collection('users').doc(uid).collection('decks').doc('legacy-deck-1').set({
    userId: uid,
    name: 'Deck Legado Sem Archived',
    cardCount: 1,
    tags: [],
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });
  await adminDb.collection('users').doc(uid).collection('decks').doc('legacy-deck-1').collection('cards').doc('legacy-card-1').set({
    userId: uid,
    deckId: 'legacy-deck-1',
    front: 'Frente legada',
    back: 'Verso legado',
    tags: [],
    status: 'new',
    dueAt: admin.firestore.Timestamp.now(),
    lapses: 0,
    reps: 0,
    // sem reviewVersion
    schedulerState: { algorithm: 'sm2', version: 1, data: { repetition: 0, interval: 0, easeFactor: 2.5 } },
    sourceType: 'manual',
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  // Query onde archived == false NÃO retornaria o deck legado sem o campo
  const unmigratedQuery = await adminDb.collection('users').doc(uid).collection('decks').where('archived', '==', false).get();
  assert.equal(unmigratedQuery.size, 0);

  // Executa ferramenta de migração
  const migrationResult = await migrateLegacyFlashcardsPage({ admin, uid, pageSize: 50 });
  assert.equal(migrationResult.migratedDecks, 1);
  assert.equal(migrationResult.migratedCards, 1);

  // Agora a query com archived == false retorna o deck migrado
  const migratedQuery = await adminDb.collection('users').doc(uid).collection('decks').where('archived', '==', false).get();
  assert.equal(migratedQuery.size, 1);
  assert.equal(migratedQuery.docs[0].data().archived, false);

  const migratedCard = await adminDb.collection('users').doc(uid).collection('decks').doc('legacy-deck-1').collection('cards').doc('legacy-card-1').get();
  assert.equal(migratedCard.data().reviewVersion, 0);
});

test('StudyFolder/StudySource: ownership de anotacao e PDF e chunks backend-only', async () => {
  const uid = 'study-source-owner';
  const strangerUid = 'study-source-stranger';
  const adminDb = admin.firestore();
  const ownerDb = environment.authenticatedContext(uid).firestore();
  const strangerDb = environment.authenticatedContext(strangerUid).firestore();
  const now = admin.firestore.Timestamp.now();
  await adminDb.collection('users').doc(uid).set({ uid });
  await adminDb.collection('users').doc(strangerUid).set({ uid: strangerUid });
  await adminDb.collection('users').doc(uid).collection('study_folders').doc('folder-1').set({
    userId: uid, name: 'PMBA 2026', description: 'Fontes oficiais', color: 'red', icon: 'folder', order: 1, archived: false, createdAt: now, updatedAt: now,
  });
  await adminDb.collection('users').doc(uid).collection('study_sources').doc('note-1').set({
    userId: uid, folderId: 'folder-1', kind: 'note', title: 'Anotacao original', status: 'ready', sourceRevision: 1,
    originalText: 'Texto original privado e persistente.', documentId: null, chunkCount: 1, createdAt: now, updatedAt: now, readyAt: now,
  });
  await adminDb.collection('users').doc(uid).collection('study_sources').doc('note-1').collection('chunks').doc('chunk_0000').set({
    userId: uid, sourceId: 'note-1', order: 0, content: 'Texto original privado e persistente.', charCount: 38, createdAt: now,
  });
  await adminDb.collection('users').doc(uid).collection('study_sources').doc('pdf-1').set({
    userId: uid, folderId: 'folder-1', kind: 'document', title: 'Edital', status: 'ready', sourceRevision: 1,
    documentId: 'document-pdf-1', chunkCount: 2, createdAt: now, updatedAt: now, readyAt: now,
  });

  const noteRef = doc(ownerDb, 'users', uid, 'study_sources', 'note-1');
  await assertSucceeds(getDocs(collection(ownerDb, 'users', uid, 'study_folders')));
  await assertSucceeds(getDocs(collection(ownerDb, 'users', uid, 'study_sources')));
  await assertFails(getDocs(collection(strangerDb, 'users', uid, 'study_folders')));
  await assertFails(getDocs(collection(strangerDb, 'users', uid, 'study_sources')));
  await assertSucceeds(getDoc(noteRef));
  const note = await getDoc(noteRef);
  assert.equal(note.data().originalText, 'Texto original privado e persistente.');
  await assertSucceeds(getDoc(doc(ownerDb, 'users', uid, 'study_sources', 'pdf-1')));
  await assertFails(getDoc(doc(strangerDb, 'users', uid, 'study_sources', 'note-1')));
  await assertFails(getDoc(doc(ownerDb, 'users', uid, 'study_sources', 'note-1', 'chunks', 'chunk_0000')));
  await assertFails(updateDoc(noteRef, { status: 'ready', updatedAt: serverTimestamp() }));
  await assertFails(setDoc(doc(ownerDb, 'users', uid, 'study_sources', 'forged'), {
    userId: uid, folderId: 'folder-1', kind: 'note', title: 'Forjada', status: 'ready', sourceRevision: 1,
    originalText: 'Forjada no client', createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
  }));
});

test('GeneratedItem: client nao forja aprovacao nem campos de materializacao', async () => {
  const uid = 'generated-forgery-owner';
  const adminDb = admin.firestore();
  const ownerDb = environment.authenticatedContext(uid).firestore();
  const now = admin.firestore.Timestamp.now();
  await adminDb.collection('users').doc(uid).set({ uid });
  await adminDb.collection('users').doc(uid).collection('generated_items').doc('buffer-1').set({
    userId: uid, sourceId: 'source-1', sourceDocumentId: null, type: 'flashcard', status: 'buffer',
    content: { front: 'Frente', back: 'Verso' }, tags: [], createdAt: now, updatedAt: now,
  });
  const itemRef = doc(ownerDb, 'users', uid, 'generated_items', 'buffer-1');
  await assertSucceeds(getDoc(itemRef));
  await assertFails(updateDoc(itemRef, {
    status: 'materialized',
    content: { front: 'Frente', back: 'Verso', materializedCardId: 'card-forjado' },
    updatedAt: serverTimestamp(),
  }));
  await assertFails(deleteDoc(itemRef));
});

test('cardCount: create/delete concorrentes convergem na mesma transacao backend', async () => {
  const uid = 'card-count-concurrency';
  const deckId = 'deck-count';
  const adminDb = admin.firestore();
  const deckRef = adminDb.collection('users').doc(uid).collection('decks').doc(deckId);
  await adminDb.collection('users').doc(uid).set({ uid });
  await adminDb.collection('users').doc(uid).collection('study_folders').doc('folder-count').set({
    userId: uid, name: 'Pasta Concorrencia', description: '', order: 1, archived: false,
    createdAt: admin.firestore.FieldValue.serverTimestamp(), updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });
  await deckRef.set({
    userId: uid, name: 'Concorrencia', folderId: 'folder-count', cardCount: 0, cardMutationVersion: 0, tags: [], archived: false,
    createdAt: admin.firestore.FieldValue.serverTimestamp(), updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });
  const created = await Promise.all(Array.from({ length: 6 }, (_, index) => flashcardsBackendService.createCard({
    uid, deckId, card: { folderId: 'folder-count', front: `Frente ${index}`, back: `Verso ${index}`, tags: [] },
  })));
  await Promise.all(created.slice(0, 2).map((result) => flashcardsBackendService.deleteCard({ uid, deckId, cardId: result.card.id })));
  const [deck, cards] = await Promise.all([deckRef.get(), deckRef.collection('cards').get()]);
  assert.equal(cards.size, 4);
  assert.equal(deck.data().cardCount, 4);
  assert.equal(deck.data().cardMutationVersion, 8);
});

function adaptiveProvider(options = {}) {
  let cardCalls = 0;
  return {
    get cardCalls() { return cardCalls; },
    async generate(request) {
      if (request.surface?.startsWith('adaptive-concepts')) return {
        parsedJson: { concepts: [{
          name: 'Conceito X',
          summary: 'Definicao sustentada pela anotacao.',
          sourceRefKeys: [options.sourceRefKey || 'source-adaptive:chunk_0000'],
        }] },
        usage: { promptTokens: 40, outputTokens: 20 },
      };
      cardCalls += 1;
      if (options.beforeCards) await options.beforeCards(cardCalls);
      const planText = request.prompt.split('PLANOS\n')[1].split('\n\nCHUNKS AUTORIZADOS')[0];
      const plans = JSON.parse(planText);
      return {
        parsedJson: { items: plans.map((plan) => ({
          conceptId: plan.conceptId,
          cognitiveDifficulty: plan.cognitiveDifficulty,
          variantKey: plan.variantKey,
          front: `Pergunta ${plan.variantKey}`,
          back: `Resposta fundamentada ${plan.variantKey}`,
          sourceRefKeys: options.invalidProvenance ? ['ref-inexistente'] : [plan.allowedSourceRefKeys[0]],
        })) },
        usage: { promptTokens: 80, outputTokens: 35 },
      };
    },
  };
}

async function seedAdaptiveSource(uid, { status = 'ready', sourceId = 'source-adaptive', folderId = 'folder-adaptive' } = {}) {
  const adminDb = admin.firestore();
  const now = admin.firestore.Timestamp.now();
  await adminDb.collection('users').doc(uid).set({ uid });
  await adminDb.collection('users').doc(uid).collection('study_folders').doc(folderId).set({
    userId: uid, name: 'Pasta Adaptativa', description: '', color: 'red', icon: 'folder', order: 1,
    archived: false, createdAt: now, updatedAt: now,
  });
  await adminDb.collection('users').doc(uid).collection('study_sources').doc(sourceId).set({
    userId: uid, folderId, kind: 'note', title: 'Fonte Adaptativa', status, sourceRevision: 1,
    originalText: 'Conceito X e definido exclusivamente por esta fonte.', chunkCount: 1,
    createdAt: now, updatedAt: now, readyAt: status === 'ready' ? now : null,
  });
  await adminDb.collection('users').doc(uid).collection('study_sources').doc(sourceId).collection('chunks').doc('chunk_0000').set({
    userId: uid, sourceId, order: 0, content: 'Conceito X e definido exclusivamente por esta fonte.', charCount: 51, createdAt: now,
  });
}

test('Adaptive Tutor: sessao, buffer, primeiro rating e mastery sao autoritativos e idempotentes', async () => {
  const uid = 'adaptive-owner';
  await seedAdaptiveSource(uid);
  const provider = adaptiveProvider();
  const service = createAdaptiveStudyService({
    admin,
    getProductLimits: async () => DEFAULT_SERVER_PRODUCT_LIMITS,
    getProvider: () => provider,
  });
  const started = await service.startSession({ uid, folderId: 'folder-adaptive', sourceId: 'source-adaptive' });
  assert.equal(started.session.status, 'active');
  assert.equal(started.item.queueState, 'served');
  assert.equal(started.item.cognitiveDifficulty, 'easy');
  assert.ok(started.item.sourceRefs.length > 0);

  const itemsAfterStart = await admin.firestore().collection('users').doc(uid).collection('generated_items')
    .where('sessionId', '==', started.session.id).get();
  assert.equal(itemsAfterStart.docs.filter((item) => item.data().queueState === 'ready').length, 2);
  assert.equal(itemsAfterStart.docs.filter((item) => item.data().queueState === 'served').length, 1);

  const first = await service.rateItem({
    uid, sessionId: started.session.id, itemId: started.item.id, rating: 'again', reviewRequestId: 'rating-1',
  });
  const retry = await service.rateItem({
    uid, sessionId: started.session.id, itemId: started.item.id, rating: 'again', reviewRequestId: 'rating-1',
  });
  assert.equal(first.duplicate, false);
  assert.equal(retry.duplicate, true);
  assert.equal(first.nextItem.variantKey !== started.item.variantKey, true);

  const deckRef = admin.firestore().collection('users').doc(uid).collection('decks').doc(started.session.deckId);
  const [cards, reviews, mastery] = await Promise.all([
    deckRef.collection('cards').get(),
    admin.firestore().collection('users').doc(uid).collection('card_reviews').get(),
    admin.firestore().collection('users').doc(uid).collection('concept_mastery').get(),
  ]);
  assert.equal(cards.size, 1);
  assert.equal(reviews.size, 1);
  assert.equal((await deckRef.get()).data().cardCount, 1);
  assert.equal(mastery.size, 1);
  assert.equal(mastery.docs[0].data().exposures, 1);
  assert.equal(mastery.docs[0].data().wrongCount, 1);

  const second = await service.rateItem({
    uid, sessionId: started.session.id, itemId: first.nextItem.id, rating: 'again', reviewRequestId: 'rating-2',
  });
  assert.equal(second.shouldRefill, true);
  await service.refillAndGetNext({ uid, sessionId: started.session.id });
  const itemsAfterRefill = await admin.firestore().collection('users').doc(uid).collection('generated_items')
    .where('sessionId', '==', started.session.id).get();
  const readyVariants = itemsAfterRefill.docs.filter((item) => item.data().queueState === 'ready').map((item) => item.data());
  assert.ok(readyVariants.some((item) => /:v4$/.test(item.variantKey)));
  assert.equal(new Set(itemsAfterRefill.docs.map((item) => item.data().contentFingerprint).filter(Boolean)).size,
    itemsAfterRefill.docs.map((item) => item.data().contentFingerprint).filter(Boolean).length);
  const masteryAfterErrors = (await admin.firestore().collection('users').doc(uid).collection('concept_mastery').get()).docs[0].data();
  assert.equal(masteryAfterErrors.wrongCount, 2);
  assert.equal(masteryAfterErrors.priorityBoost, 4);
});

test('Adaptive Tutor: ownership, source ready, folder coerente e proveniencia sao gates obrigatorios', async () => {
  const uid = 'adaptive-gates-owner';
  await seedAdaptiveSource(uid, { sourceId: 'source-ready', folderId: 'folder-ready' });
  await seedAdaptiveSource(uid, { sourceId: 'source-processing', folderId: 'folder-processing', status: 'processing' });
  const service = createAdaptiveStudyService({
    admin,
    getProductLimits: async () => DEFAULT_SERVER_PRODUCT_LIMITS,
    getProvider: () => adaptiveProvider({ sourceRefKey: 'source-ready:chunk_0000' }),
  });
  await assert.rejects(() => service.startSession({ uid: 'adaptive-stranger', folderId: 'folder-ready', sourceId: 'source-ready' }), /Pasta de Estudos nao encontrada/);
  await assert.rejects(() => service.startSession({ uid, folderId: 'folder-processing', sourceId: 'source-processing' }), /ainda nao esta pronta/);
  await assert.rejects(() => service.startSession({ uid, folderId: 'folder-processing', sourceId: 'source-ready' }), /nao pertence a pasta/);

  const noProvenance = createAdaptiveStudyService({
    admin,
    getProductLimits: async () => DEFAULT_SERVER_PRODUCT_LIMITS,
    getProvider: () => adaptiveProvider({ sourceRefKey: 'source-ready:chunk_0000', invalidProvenance: true }),
  });
  await assert.rejects(() => noProvenance.startSession({ uid, folderId: 'folder-ready', sourceId: 'source-ready' }), /sustentado pela fonte/);
});

test('Adaptive Tutor: refill concorrente usa lock e resultado tardio e descartado apos encerramento', async () => {
  const uid = 'adaptive-cancel-owner';
  await seedAdaptiveSource(uid);
  let releaseLate;
  let markStarted;
  const lateStarted = new Promise((resolve) => { markStarted = resolve; });
  const provider = adaptiveProvider({
    beforeCards: async (call) => {
      if (call === 1) return;
      markStarted();
      await new Promise((resolve) => { releaseLate = resolve; });
    },
  });
  const service = createAdaptiveStudyService({
    admin,
    getProductLimits: async () => DEFAULT_SERVER_PRODUCT_LIMITS,
    getProvider: () => provider,
  });
  const started = await service.startSession({ uid, folderId: 'folder-adaptive', sourceId: 'source-adaptive' });
  const firstRefill = service.refillBuffer({ uid, sessionId: started.session.id, forceTarget: 5 });
  await lateStarted;
  const concurrent = await service.refillBuffer({ uid, sessionId: started.session.id, forceTarget: 5 });
  assert.equal(concurrent.busy, true);
  await service.endSession({ uid, sessionId: started.session.id });
  releaseLate();
  const lateResult = await firstRefill;
  assert.equal(lateResult.discarded, true);
  const session = await admin.firestore().collection('users').doc(uid).collection('adaptive_study_sessions').doc(started.session.id).get();
  assert.equal(session.data().status, 'cancelled');
  const items = await admin.firestore().collection('users').doc(uid).collection('generated_items').where('sessionId', '==', started.session.id).get();
  assert.equal(items.docs.some((item) => ['ready', 'served', 'generating'].includes(item.data().queueState)), false);
  assert.ok(items.docs.some((item) => item.data().errorCode === 'late-result-discarded'));
});

test('Adaptive Tutor: Rules permitem apenas leitura do dono e bloqueiam escrita client-side', async () => {
  const uid = 'adaptive-rules-owner';
  const stranger = 'adaptive-rules-stranger';
  const now = admin.firestore.Timestamp.now();
  const adminDb = admin.firestore();
  await adminDb.collection('users').doc(uid).set({ uid });
  await adminDb.collection('users').doc(stranger).set({ uid: stranger });
  await adminDb.collection('users').doc(uid).collection('adaptive_study_sessions').doc('session-1').set({ userId: uid, status: 'active', createdAt: now });
  await adminDb.collection('users').doc(uid).collection('concept_mastery').doc('mastery-1').set({ userId: uid, sourceId: 'source-1', conceptId: 'concept-1' });
  const ownerDb = environment.authenticatedContext(uid).firestore();
  const strangerDb = environment.authenticatedContext(stranger).firestore();
  await assertSucceeds(getDoc(doc(ownerDb, 'users', uid, 'adaptive_study_sessions', 'session-1')));
  await assertSucceeds(getDoc(doc(ownerDb, 'users', uid, 'concept_mastery', 'mastery-1')));
  await assertFails(getDoc(doc(strangerDb, 'users', uid, 'adaptive_study_sessions', 'session-1')));
  await assertFails(getDoc(doc(strangerDb, 'users', uid, 'concept_mastery', 'mastery-1')));
  await assertFails(updateDoc(doc(ownerDb, 'users', uid, 'adaptive_study_sessions', 'session-1'), { status: 'completed' }));
  await assertFails(setDoc(doc(ownerDb, 'users', uid, 'concept_mastery', 'forged'), { priorityBoost: 999 }));
});

test('Legacy Flashcards: associacao a pasta padrao e idempotente e preserva Card', async () => {
  const uid = 'legacy-folder-owner';
  const adminDb = admin.firestore();
  await adminDb.collection('users').doc(uid).set({ uid });
  const deckRef = adminDb.collection('users').doc(uid).collection('decks').doc('legacy-deck');
  await deckRef.set({ userId: uid, name: 'Deck legado', cardCount: 1, tags: [], archived: false,
    createdAt: admin.firestore.FieldValue.serverTimestamp(), updatedAt: admin.firestore.FieldValue.serverTimestamp() });
  const originalScheduler = { algorithm: 'sm2', version: 1, data: { repetition: 3, interval: 15, easeFactor: 2.5 } };
  await deckRef.collection('cards').doc('legacy-card').set({
    userId: uid, deckId: 'legacy-deck', front: 'Frente', back: 'Verso', schedulerState: originalScheduler,
    status: 'review', dueAt: admin.firestore.Timestamp.now(), lapses: 1, reps: 3, reviewVersion: 7,
    sourceType: 'anki', ankiMetadata: { ankiNoteGuid: 'guid', ankiCardOrd: 0 }, tags: [],
    createdAt: admin.firestore.FieldValue.serverTimestamp(), updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });
  const service = createStudySourceService({ admin, getProductLimits: async () => DEFAULT_SERVER_PRODUCT_LIMITS });
  const first = await service.ensureLegacyFolder({ uid });
  const second = await service.ensureLegacyFolder({ uid });
  assert.equal(first.migratedDecks, 1);
  assert.equal(second.duplicate, true);
  assert.equal((await deckRef.get()).data().folderId, 'legacy_flashcards');
  const card = (await deckRef.collection('cards').doc('legacy-card').get()).data();
  assert.equal(card.reviewVersion, 7);
  assert.deepEqual(card.schedulerState, originalScheduler);
  assert.equal(card.ankiMetadata.ankiNoteGuid, 'guid');
});

test('novo Card sem folderId e importacao Anki sem pasta de destino sao rejeitados', async () => {
  await assert.rejects(() => flashcardsBackendService.createCard({
    uid: 'missing-folder-user', deckId: 'deck', card: { front: 'Frente', back: 'Verso' },
  }), /folderId e obrigatorio/);
  const anki = createAnkiService({ admin, getProductLimits: async () => DEFAULT_SERVER_PRODUCT_LIMITS });
  await assert.rejects(() => anki.importAnkiPackage({
    uid: 'anki-folder-user', importId: 'import-1', storagePath: 'user_uploads/anki-folder-user/anki_imports/import-1/a.apkg', originalName: 'a.apkg',
  }), /folderId invalido/);
});
