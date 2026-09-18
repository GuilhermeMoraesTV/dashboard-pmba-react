process.env.FIRESTORE_EMULATOR_HOST ||= '127.0.0.1:8085';
process.env.FIREBASE_AUTH_EMULATOR_HOST ||= '127.0.0.1:9099';

if (!process.env.FIRESTORE_EMULATOR_HOST.startsWith('127.0.0.1:')
  || !process.env.FIREBASE_AUTH_EMULATOR_HOST.startsWith('127.0.0.1:')) {
  throw new Error('Este seed só pode executar contra Emulators locais.');
}

const [{ initializeApp }, { getAuth }, { FieldValue, Timestamp, getFirestore }] = await Promise.all([
  import('firebase-admin/app'),
  import('firebase-admin/auth'),
  import('firebase-admin/firestore'),
]);

const projectId = process.env.FIREBASE_PROJECT_ID || 'demo-dashboard-pmba-local';
if (!projectId.startsWith('demo-')) throw new Error('O seed do chat exige um projeto Firebase demo isolado.');
const app = initializeApp({ projectId }, `group-chat-seed-${Date.now()}`);
const auth = getAuth(app);
const database = getFirestore(app);
const groupId = 'qa-chat-local';
const owner = { uid: 'qa-chat-owner', email: 'chat.owner@local.test', password: 'ChatLocal123!', displayName: 'Ana QA' };
const member = { uid: 'qa-chat-member', email: 'chat.member@local.test', password: 'ChatLocal123!', displayName: 'Bruno QA' };

for (const person of [owner, member]) {
  try {
    await auth.createUser(person);
  } catch (error) {
    if (error?.code !== 'auth/uid-already-exists' && error?.code !== 'auth/email-already-exists') throw error;
    await auth.updateUser(person.uid, { email: person.email, password: person.password, displayName: person.displayName });
  }
  await database.collection('users').doc(person.uid).set({
    uid: person.uid,
    email: person.email,
    displayName: person.displayName,
    name: person.displayName,
    status: 'active',
    onboardingCompleted: true,
    tutorialCompleted: true,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  }, { merge: true });
  await database.collection('users').doc(person.uid).collection('gamification').doc('profile').set({
    groupIds: [groupId],
    mainGroupId: groupId,
    mainGroupName: 'Grupo QA Chat',
    totalXP: 0,
    currentLeague: 'iron',
    updatedAt: FieldValue.serverTimestamp(),
  }, { merge: true });
}

await database.collection('study_groups').doc(groupId).set({
  name: 'Grupo QA Chat',
  description: 'Grupo local para validar o chat interno.',
  visibility: 'private',
  ownerId: owner.uid,
  memberCount: 2,
  weeklyMinutes: 0,
  weeklyQuestions: 0,
  weeklyCorrect: 0,
  weeklyAccuracy: 0,
  createdAt: FieldValue.serverTimestamp(),
  updatedAt: FieldValue.serverTimestamp(),
});
await database.collection('study_group_directory').doc(groupId).set({
  groupId,
  name: 'Grupo QA Chat',
  description: 'Grupo local para validar o chat interno.',
  visibility: 'private',
  memberCount: 2,
  status: 'active',
  createdAt: FieldValue.serverTimestamp(),
  updatedAt: FieldValue.serverTimestamp(),
});

const batch = database.batch();
for (const [index, person] of [owner, member].entries()) {
  batch.set(database.collection('study_groups').doc(groupId).collection('members').doc(person.uid), {
    uid: person.uid,
    displayName: person.displayName,
    photoURL: null,
    role: index === 0 ? 'owner' : 'member',
    permissions: { manageGroup: index === 0, manageMembers: index === 0 },
    joinedAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });
  batch.set(database.collection('users').doc(person.uid).collection('group_chat_states').doc(groupId), {
    groupId,
    lastReadSeq: person.uid === owner.uid ? 30 : 35,
    readAt: Timestamp.fromMillis(Date.now() - 60_000),
    lastSendAt: null,
    sentCountTotal: 0,
    sentCountAtRead: 0,
    updatedAt: FieldValue.serverTimestamp(),
  });
}
for (let seq = 1; seq <= 35; seq += 1) {
  const messageId = `seed-${String(seq).padStart(3, '0')}`;
  batch.set(database.collection('study_groups').doc(groupId).collection('messages').doc(messageId), {
    seq,
    authorId: member.uid,
    authorName: member.displayName,
    authorPhotoURL: null,
    text: seq === 35 ? 'Última mensagem para testar resposta e não lidos.' : `Mensagem histórica ${seq}`,
    replyToMessageId: null,
    mentionUids: [],
    createdAt: Timestamp.fromMillis(Date.now() - (36 - seq) * 60_000),
    updatedAt: Timestamp.fromMillis(Date.now() - (36 - seq) * 60_000),
    editedAt: null,
    deleted: false,
    deletedAt: null,
    deletedBy: null,
    expiresAt: Timestamp.fromMillis(Date.now() + 90 * 86400000),
  });
}
batch.set(database.collection('study_groups').doc(groupId).collection('chat_meta').doc('current'), {
  groupId,
  groupName: 'Grupo QA Chat',
  memberIds: [owner.uid, member.uid],
  lastSeq: 35,
  lastMessageId: 'seed-035',
  lastMessageAt: Timestamp.fromMillis(Date.now() - 60_000),
  lastAuthorId: member.uid,
  createdAt: FieldValue.serverTimestamp(),
  updatedAt: FieldValue.serverTimestamp(),
});
await batch.commit();

process.stdout.write(JSON.stringify({
  url: `http://127.0.0.1:5179/app/grupos?group=${groupId}&panel=chat`,
  email: owner.email,
  password: owner.password,
  groupId,
}) + '\n');
