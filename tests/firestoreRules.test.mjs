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
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { getNextWeekId, getWeekId, toDateKey } from '../src/utils/gamification.js';

const require = createRequire(import.meta.url);
const gamificationService = require('../functions/gamification/service.js');
const groupService = require('../functions/groups/service.js');

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
  if (!admin.apps.length) admin.initializeApp({ projectId });
  await environment.clearFirestore();

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
    await setDoc(doc(db, 'study_groups', 'private-group', 'members', 'owner-user'), { uid: 'owner-user', role: 'owner', permissions: { manageGroup: true } });
    await setDoc(doc(db, 'study_groups', 'private-group', 'members', 'group-member'), { uid: 'group-member', role: 'member', permissions: { manageGroup: false } });
    await setDoc(doc(db, 'study_group_invites', 'ABC1234'), { code: 'ABC1234', groupId: 'private-group', groupName: 'Privado', ownerId: 'owner-user', active: true });
    await setDoc(doc(db, 'active_timers', 'owner-user'), { uid: 'owner-user', status: 'running', groupIds: ['private-group'] });
  });
});

after(async () => {
  await environment?.cleanup();
  await Promise.all(admin.apps.map((app) => app.delete()));
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
  await assertSucceeds(getDoc(doc(memberDb, 'study_groups', 'private-group')));
  await assertSucceeds(getDocs(collection(memberDb, 'study_groups', 'private-group', 'members')));
  await assertFails(getDocs(collection(strangerDb, 'study_groups', 'private-group', 'members')));
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
  assert.equal(secondProfile.totalXP, firstProfile.totalXP);
  assert.equal(secondEvents.size, firstEvents.size);

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
