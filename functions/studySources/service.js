/**
 * @fileoverview Autoridade persistente de Pastas e Fontes de Estudo.
 */

const { HttpsError } = require('firebase-functions/v2/https');

function identifier(value, label) {
  const normalized = String(value || '').trim();
  if (!/^[A-Za-z0-9_-]{1,160}$/.test(normalized)) throw new HttpsError('invalid-argument', `${label} invalido.`);
  return normalized;
}

function text(value, label, maximum) {
  const normalized = String(value || '').normalize('NFC').trim();
  if (!normalized) throw new HttpsError('invalid-argument', `${label} e obrigatorio.`);
  if (normalized.length > maximum) throw new HttpsError('invalid-argument', `${label} excede o limite configurado.`);
  return normalized;
}

function splitNoteIntoChunks(content, limits) {
  const target = Math.max(500, Number(limits.documents.chunkTargetChars));
  const overlap = Math.min(Math.max(0, Number(limits.documents.chunkOverlapChars)), Math.floor(target / 3));
  const chunks = [];
  let cursor = 0;
  while (cursor < content.length && chunks.length < limits.documents.maxChunks) {
    const hardEnd = Math.min(cursor + target, content.length);
    let end = hardEnd;
    if (hardEnd < content.length) {
      const paragraph = content.lastIndexOf('\n\n', hardEnd);
      const sentence = content.lastIndexOf('. ', hardEnd);
      const candidate = Math.max(paragraph, sentence);
      if (candidate > cursor + Math.floor(target * 0.6)) end = candidate + (candidate === paragraph ? 2 : 1);
    }
    const chunk = content.slice(cursor, end).trim();
    if (chunk) chunks.push({ order: chunks.length, content: chunk, charCount: chunk.length });
    if (end >= content.length) {
      cursor = content.length;
      break;
    }
    cursor = Math.max(cursor + 1, end - overlap);
  }
  if (cursor < content.length) throw new HttpsError('resource-exhausted', 'A anotacao excede o limite de chunks configurado.');
  return chunks;
}

function createStudySourceService({
  admin,
  getProductLimits,
  Timestamp = admin.firestore.Timestamp,
  FieldValue = admin.firestore.FieldValue,
}) {
  const db = admin.firestore();

  async function assertFolder(uid, folderId) {
    const safeFolderId = identifier(folderId, 'folderId');
    const ref = db.collection('users').doc(uid).collection('study_folders').doc(safeFolderId);
    const snapshot = await ref.get();
    if (!snapshot.exists || snapshot.data()?.userId !== uid) throw new HttpsError('not-found', 'Pasta de Estudos nao encontrada.');
    if (snapshot.data()?.archived === true) throw new HttpsError('failed-precondition', 'A Pasta de Estudos esta arquivada.');
    return { ref, id: safeFolderId };
  }

  async function createFolder({ uid, data }) {
    if (!uid) throw new HttpsError('unauthenticated', 'Usuario nao autenticado.');
    const limits = await getProductLimits(db);
    const folders = db.collection('users').doc(uid).collection('study_folders');
    const count = await folders.count().get();
    if (Number(count.data().count || 0) >= limits.studySources.maxFoldersPerUser) throw new HttpsError('resource-exhausted', 'Limite de pastas atingido.');
    let parentFolderId = null;
    let ancestorFolderIds = [];
    if (data?.parentFolderId) {
      parentFolderId = identifier(data.parentFolderId, 'parentFolderId');
      const parentSnapshot = await folders.doc(parentFolderId).get();
      if (!parentSnapshot.exists || parentSnapshot.data()?.userId !== uid) {
        throw new HttpsError('not-found', 'Pasta pai nao encontrada.');
      }
      if (parentSnapshot.data()?.archived === true) {
        throw new HttpsError('failed-precondition', 'A pasta pai esta arquivada.');
      }
      ancestorFolderIds = [
        ...(Array.isArray(parentSnapshot.data()?.ancestorFolderIds) ? parentSnapshot.data().ancestorFolderIds : []),
        parentFolderId,
      ];
    }

    const ref = folders.doc();
    const now = Timestamp.now();
    const payload = {
      userId: uid,
      name: text(data?.name, 'name', limits.studySources.maxFolderNameChars),
      description: String(data?.description || '').normalize('NFC').trim().slice(0, limits.studySources.maxFolderDescriptionChars),
      color: String(data?.color || 'red').slice(0, 32),
      icon: String(data?.icon || 'folder').slice(0, 32),
      order: Number.isFinite(Number(data?.order)) ? Number(data.order) : Date.now(),
      parentFolderId,
      ancestorFolderIds,
      archived: false,
      createdAt: now,
      updatedAt: now,
    };
    await ref.create(payload);
    return { folder: { id: ref.id, ...payload, createdAt: now.toDate().toISOString(), updatedAt: now.toDate().toISOString() } };
  }

  async function createFolderTree({ uid, data }) {
    if (!uid) throw new HttpsError('unauthenticated', 'Usuario nao autenticado.');
    const limits = await getProductLimits(db);
    const folders = db.collection('users').doc(uid).collection('study_folders');

    let initialParentFolderId = null;
    let initialAncestorFolderIds = [];
    if (data?.parentFolderId) {
      initialParentFolderId = identifier(data.parentFolderId, 'parentFolderId');
      const parentSnapshot = await folders.doc(initialParentFolderId).get();
      if (!parentSnapshot.exists || parentSnapshot.data()?.userId !== uid) throw new HttpsError('not-found', 'Pasta pai nao encontrada.');
      if (parentSnapshot.data()?.archived === true) throw new HttpsError('failed-precondition', 'A pasta pai esta arquivada.');
      initialAncestorFolderIds = [
        ...(Array.isArray(parentSnapshot.data()?.ancestorFolderIds) ? parentSnapshot.data().ancestorFolderIds : []),
        initialParentFolderId,
      ];
    }

    // Support structured items or names array
    let itemsToCreate = [];
    if (Array.isArray(data?.items) && data.items.length > 0) {
      itemsToCreate = data.items.map((item, idx) => ({
        name: text(item.name, 'name', limits.studySources.maxFolderNameChars),
        description: String(item.description || (idx === 0 ? data?.description : '') || '').normalize('NFC').trim().slice(0, limits.studySources.maxFolderDescriptionChars),
        color: String(item.color || data?.color || 'red').slice(0, 32),
        parentIndex: Number.isInteger(item.parentIndex) ? item.parentIndex : (item.parentIndex === null ? null : (idx === 0 ? null : 0)),
      }));
    } else {
      const names = Array.isArray(data?.names)
        ? data.names.map((name) => text(name, 'name', limits.studySources.maxFolderNameChars))
        : [];
      if (!names.length) throw new HttpsError('invalid-argument', 'Informe ao menos uma pasta para criar.');

      const isChain = data?.structure === 'chain';
      itemsToCreate = names.map((name, index) => ({
        name,
        description: index === 0 ? String(data?.description || '').normalize('NFC').trim().slice(0, limits.studySources.maxFolderDescriptionChars) : '',
        color: String(data?.color || 'red').slice(0, 32),
        parentIndex: index === 0 ? null : (isChain ? index - 1 : 0),
      }));
    }

    const count = Number((await folders.count().get()).data().count || 0);
    if (count + itemsToCreate.length > limits.studySources.maxFoldersPerUser) {
      throw new HttpsError('resource-exhausted', 'A arvore excede o limite de pastas do usuario.');
    }

    const now = Timestamp.now();
    const batch = db.batch();
    const created = [];
    const docRefs = itemsToCreate.map(() => folders.doc());

    for (const [index, item] of itemsToCreate.entries()) {
      const ref = docRefs[index];
      let itemParentId = initialParentFolderId;
      let itemAncestors = [...initialAncestorFolderIds];

      if (item.parentIndex !== null && item.parentIndex >= 0 && item.parentIndex < index) {
        const parentRef = docRefs[item.parentIndex];
        const parentItem = created[item.parentIndex];
        itemParentId = parentRef.id;
        itemAncestors = [...(parentItem?.ancestorFolderIds || []), parentRef.id];
      }

      const payload = {
        userId: uid,
        name: item.name,
        description: item.description || '',
        color: item.color || 'red',
        icon: 'folder',
        order: Number.isFinite(Number(data?.order)) ? Number(data.order) + index : Date.now() + index,
        parentFolderId: itemParentId,
        ancestorFolderIds: itemAncestors,
        archived: false,
        createdAt: now,
        updatedAt: now,
      };
      batch.create(ref, payload);
      created.push({ id: ref.id, ...payload, createdAt: now.toDate().toISOString(), updatedAt: now.toDate().toISOString() });
    }

    await batch.commit();
    return { folders: created, rootFolder: created[0], leafFolder: created.at(-1) };
  }

  async function updateFolder({ uid, folderId, data }) {
    if (!uid) throw new HttpsError('unauthenticated', 'Usuario nao autenticado.');
    const safeFolderId = identifier(folderId, 'folderId');
    const limits = await getProductLimits(db);
    const ref = db.collection('users').doc(uid).collection('study_folders').doc(safeFolderId);
    const snapshot = await ref.get();
    if (!snapshot.exists || snapshot.data()?.userId !== uid) throw new HttpsError('not-found', 'Pasta nao encontrada.');
    const updates = { updatedAt: FieldValue.serverTimestamp() };
    if (data?.name !== undefined) updates.name = text(data.name, 'name', limits.studySources.maxFolderNameChars);
    if (data?.description !== undefined) updates.description = String(data.description || '').normalize('NFC').trim().slice(0, limits.studySources.maxFolderDescriptionChars);
    if (data?.color !== undefined) updates.color = String(data.color).slice(0, 32);
    if (data?.icon !== undefined) updates.icon = String(data.icon).slice(0, 32);
    await ref.update(updates);
    return { folderId: safeFolderId, ok: true };
  }

  async function deleteFolder({ uid, folderId }) {
    if (!uid) throw new HttpsError('unauthenticated', 'Usuario nao autenticado.');
    const safeFolderId = identifier(folderId, 'folderId');
    const foldersRef = db.collection('users').doc(uid).collection('study_folders');
    const targetRef = foldersRef.doc(safeFolderId);
    const snapshot = await targetRef.get();
    if (!snapshot.exists || snapshot.data()?.userId !== uid) throw new HttpsError('not-found', 'Pasta nao encontrada.');

    const descendants = await foldersRef.where('ancestorFolderIds', 'array-contains', safeFolderId).get();
    const batch = db.batch();
    batch.update(targetRef, { archived: true, updatedAt: FieldValue.serverTimestamp() });
    descendants.docs.forEach((docSnap) => {
      batch.update(docSnap.ref, { archived: true, updatedAt: FieldValue.serverTimestamp() });
    });
    await batch.commit();
    return { folderId: safeFolderId, archivedCount: 1 + descendants.size, ok: true };
  }

  async function updateSourceTitle({ uid, sourceId, title }) {
    if (!uid) throw new HttpsError('unauthenticated', 'Usuario nao autenticado.');
    const safeSourceId = identifier(sourceId, 'sourceId');
    const limits = await getProductLimits(db);
    const safeTitle = text(title, 'title', limits.studySources.maxTitleChars);
    const ref = db.collection('users').doc(uid).collection('study_sources').doc(safeSourceId);
    const snapshot = await ref.get();
    if (!snapshot.exists || snapshot.data()?.userId !== uid) throw new HttpsError('not-found', 'Fonte nao encontrada.');
    await ref.update({ title: safeTitle, updatedAt: FieldValue.serverTimestamp() });
    return { sourceId: safeSourceId, title: safeTitle, ok: true };
  }

  async function ensureLegacyFolder({ uid }) {
    if (!uid) throw new HttpsError('unauthenticated', 'Usuario nao autenticado.');
    const userRef = db.collection('users').doc(uid);
    const decks = await userRef.collection('decks').get();
    const legacyDecks = decks.docs.filter((snapshot) => {
      const folderId = String(snapshot.data()?.folderId || '').trim();
      return snapshot.data()?.userId === uid && !folderId;
    });
    if (!legacyDecks.length) return { folderId: null, migratedDecks: 0, duplicate: true };
    const folderId = 'legacy_flashcards';
    const folderRef = userRef.collection('study_folders').doc(folderId);
    const now = Timestamp.now();
    await db.runTransaction(async (transaction) => {
      const folder = await transaction.get(folderRef);
      if (!folder.exists) transaction.create(folderRef, {
        userId: uid,
        name: 'Meus Flashcards',
        description: 'Conteudo existente organizado automaticamente, sem alterar revisoes ou agendamento.',
        color: 'slate',
        icon: 'archive',
        order: -1,
        parentFolderId: null,
        ancestorFolderIds: [],
        archived: false,
        legacyDefault: true,
        createdAt: now,
        updatedAt: now,
      });
    });
    for (let offset = 0; offset < legacyDecks.length; offset += 300) {
      const batch = db.batch();
      legacyDecks.slice(offset, offset + 300).forEach((snapshot) => batch.update(snapshot.ref, {
        folderId,
        updatedAt: now,
      }));
      await batch.commit();
    }
    return { folderId, migratedDecks: legacyDecks.length, duplicate: false };
  }

  async function assertSourceCapacity(uid, limits) {
    const aggregate = await db.collection('users').doc(uid).collection('study_sources').count().get();
    if (Number(aggregate.data().count || 0) >= limits.studySources.maxSourcesPerUser) throw new HttpsError('resource-exhausted', 'Limite de fontes de estudo atingido.');
  }

  async function createNote({ uid, folderId, title, content }) {
    if (!uid) throw new HttpsError('unauthenticated', 'Usuario nao autenticado.');
    const limits = await getProductLimits(db);
    const folder = await assertFolder(uid, folderId);
    await assertSourceCapacity(uid, limits);
    const safeTitle = text(title, 'title', limits.studySources.maxTitleChars);
    const originalText = text(content, 'content', limits.studySources.maxNoteChars);
    const chunks = splitNoteIntoChunks(originalText, limits);
    const sourceRef = db.collection('users').doc(uid).collection('study_sources').doc();
    const now = Timestamp.now();
    await sourceRef.create({
      userId: uid, folderId: folder.id, kind: 'note', title: safeTitle, status: 'processing',
      sourceRevision: 1, originalText, documentId: null, chunkCount: 0,
      createdAt: now, updatedAt: now,
    });
    try {
      const batch = db.batch();
      chunks.forEach((chunk) => batch.create(sourceRef.collection('chunks').doc(`chunk_${String(chunk.order).padStart(4, '0')}`), {
        userId: uid, sourceId: sourceRef.id, ...chunk, createdAt: now,
      }));
      batch.update(sourceRef, {
        status: 'ready', chunkCount: chunks.length, readyAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp(),
      });
      await batch.commit();
    } catch (error) {
      await sourceRef.update({
        status: 'error', errorMessage: 'Nao foi possivel preparar a anotacao.', updatedAt: FieldValue.serverTimestamp(),
      }).catch(() => {});
      throw error;
    }
    return { sourceId: sourceRef.id, status: 'ready' };
  }

  async function prepareDocument({ uid, folderId, title, originalName, fileSizeBytes }) {
    if (!uid) throw new HttpsError('unauthenticated', 'Usuario nao autenticado.');
    const limits = await getProductLimits(db);
    const folder = await assertFolder(uid, folderId);
    await assertSourceCapacity(uid, limits);
    const size = Number(fileSizeBytes || 0);
    if (!Number.isFinite(size) || size <= 0 || size > limits.storage.maxPdfSizeBytes) throw new HttpsError('invalid-argument', 'Tamanho do PDF invalido.');
    const safeTitle = text(title, 'title', limits.studySources.maxTitleChars);
    const safeName = Array.from(text(originalName, 'originalName', 180))
      .map((character) => (character === '/' || character === '\\' || character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127 ? '_' : character))
      .join('');
    if (!safeName.toLowerCase().endsWith('.pdf')) throw new HttpsError('invalid-argument', 'A fonte documental deve ser PDF.');
    const userRef = db.collection('users').doc(uid);
    const sourceRef = userRef.collection('study_sources').doc();
    const documentRef = userRef.collection('documents').doc();
    const storagePath = `user_uploads/${uid}/documents/${documentRef.id}/${safeName}`;
    const now = Timestamp.now();
    const batch = db.batch();
    batch.create(sourceRef, {
      userId: uid, folderId: folder.id, kind: 'document', title: safeTitle, status: 'processing',
      sourceRevision: 1, documentId: documentRef.id, createdAt: now, updatedAt: now,
    });
    batch.create(documentRef, {
      userId: uid, name: safeName, fileType: 'pdf', storagePath, fileSizeBytes: size,
      status: 'pending', studySourceId: sourceRef.id, createdAt: now, updatedAt: now,
    });
    await batch.commit();
    return { sourceId: sourceRef.id, documentId: documentRef.id, storagePath, status: 'processing' };
  }

  async function markError({ uid, sourceId, message }) {
    if (!uid) throw new HttpsError('unauthenticated', 'Usuario nao autenticado.');
    const safeSourceId = identifier(sourceId, 'sourceId');
    const ref = db.collection('users').doc(uid).collection('study_sources').doc(safeSourceId);
    const snapshot = await ref.get();
    if (!snapshot.exists || snapshot.data()?.userId !== uid) throw new HttpsError('not-found', 'Fonte nao encontrada.');
    await ref.update({ status: 'error', errorMessage: String(message || 'Falha no processamento.').slice(0, 500), updatedAt: FieldValue.serverTimestamp() });
    return { sourceId: safeSourceId, status: 'error' };
  }

  async function deleteSource({ uid, sourceId }) {
    if (!uid) throw new HttpsError('unauthenticated', 'Usuario nao autenticado.');
    const safeSourceId = identifier(sourceId, 'sourceId');
    const ref = db.collection('users').doc(uid).collection('study_sources').doc(safeSourceId);
    const snapshot = await ref.get();
    if (!snapshot.exists) return { sourceId: safeSourceId, deleted: true, documentId: null };
    const source = snapshot.data() || {};
    if (source.userId !== uid) throw new HttpsError('permission-denied', 'Fonte nao pertence ao usuario.');
    let cursor = null;
    while (true) {
      let chunksQuery = ref.collection('chunks').orderBy('__name__').limit(300);
      if (cursor) chunksQuery = chunksQuery.startAfter(cursor);
      const chunks = await chunksQuery.get();
      if (chunks.empty) break;
      const batch = db.batch();
      chunks.docs.forEach((chunk) => batch.delete(chunk.ref));
      await batch.commit();
      if (chunks.size < 300) break;
      cursor = chunks.docs.at(-1);
    }
    await ref.delete();
    return { sourceId: safeSourceId, deleted: true, documentId: source.kind === 'document' ? source.documentId || null : null };
  }

  return { createFolder, createFolderTree, createNote, deleteFolder, deleteSource, ensureLegacyFolder, markError, prepareDocument, splitNoteIntoChunks, updateFolder, updateSourceTitle };
}

module.exports = { createStudySourceService, splitNoteIntoChunks };
