/**
 * @fileoverview Importacao/reimportacao idempotente de APKG para decks privados.
 */

const crypto = require('crypto');
const { isDeepStrictEqual } = require('node:util');
const { FieldValue: AdminFieldValue, FieldPath: AdminFieldPath, Timestamp: AdminTimestamp } = require('firebase-admin/firestore');
const { openAnkiArchive } = require('./archive');
const { parseAnkiCollection } = require('./parser');
const { createInitialState } = require('../flashcards/schedulerInitialState');

class AnkiImportError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'AnkiImportError';
    this.code = code;
  }
}

function safeIdentifier(value, label) {
  const normalized = String(value || '').trim();
  if (!/^[A-Za-z0-9_-]{1,160}$/.test(normalized)) throw new AnkiImportError('invalid-argument', `${label} invalido.`);
  return normalized;
}

function stableId(prefix, value, length = 24) {
  const digest = crypto.createHash('sha256').update(String(value)).digest('base64url').slice(0, length);
  return `${prefix}_${digest}`;
}

function boundedWarnings(warnings, maximum) {
  return [...new Set(warnings.map((warning) => String(warning || '').slice(0, 500)).filter(Boolean))].slice(0, maximum);
}

function isStorageObjectMissing(error) {
  return error?.code === 404
    || error?.code === 'storage/object-not-found'
    || /no such object|not found/i.test(String(error?.message || ''));
}

async function resolveUploadedPackage(bucket, requestedPath, expectedPrefix) {
  let sourceFile = bucket.file(requestedPath);
  try {
    const [metadata] = await sourceFile.getMetadata();
    return { sourceFile, metadata, recoveredPath: false };
  } catch (error) {
    if (!isStorageObjectMissing(error)) throw error;
    const [files] = await bucket.getFiles({ prefix: expectedPrefix, maxResults: 3, autoPaginate: false });
    const candidates = files.filter((file) => {
      const relativeName = String(file.name || '').slice(expectedPrefix.length);
      return relativeName
        && !relativeName.includes('/')
        && relativeName.toLowerCase().endsWith('.apkg');
    });
    if (candidates.length !== 1) throw error;
    sourceFile = candidates[0];
    const [metadata] = await sourceFile.getMetadata();
    return { sourceFile, metadata, recoveredPath: true };
  }
}

function buildImportAccounting({
  cardsDetected,
  cardsParsed,
  parserCardsSkipped,
  cardsAdded,
  cardsUpdated,
  cardsUnchanged,
  importCardsSkipped,
  unacceptedCards,
  cardsPersisted,
  writeFailures,
  batchesStarted,
  batchesCompleted,
  reconciliationFailures,
}) {
  const cardsSkipped = Number(parserCardsSkipped || 0)
    + Number(importCardsSkipped || 0)
    + Number(unacceptedCards || 0);
  const accountingComplete = Number(cardsAdded || 0) + Number(cardsUpdated || 0) + Number(cardsUnchanged || 0) + cardsSkipped
    === Number(cardsDetected || 0);
  const persistenceComplete = Number(cardsPersisted || 0) === Number(cardsParsed || 0);
  return {
    cardsSkipped,
    accountingComplete,
    persistenceComplete,
    isComplete: accountingComplete
      && persistenceComplete
      && cardsSkipped === 0
      && Number(writeFailures || 0) === 0
      && Number(batchesStarted || 0) === Number(batchesCompleted || 0)
      && Number(reconciliationFailures || 0) === 0,
  };
}

function shouldDeleteUploadedPackage(result) {
  return result?.isComplete === true;
}

function normalizeFolderName(value) {
  return String(value || '').normalize('NFC').trim().replace(/\s+/g, ' ').toLocaleLowerCase('pt-BR');
}

function splitAnkiDeckPath(value) {
  return String(value || 'Deck Anki').normalize('NFC').split('\u001f').join('::').split('::').map((part) => part.trim()).filter(Boolean);
}

function chooseAnkiDeckDocumentId(card, existingDeckById = new Map()) {
  const leafName = splitAnkiDeckPath(card?.deckName).at(-1) || 'Deck Anki';
  const legacyDeckId = stableId('anki', card?.ankiDeckId);
  const namespacedDeckId = stableId('anki', `${card?.ankiDeckId}\u0000${card?.deckName}`);
  return existingDeckById.has(legacyDeckId)
    && normalizeFolderName(existingDeckById.get(legacyDeckId)?.name) === normalizeFolderName(leafName)
    ? legacyDeckId
    : namespacedDeckId;
}

function isManagedAnkiDeck(deck) {
  return deck?.sourceType === 'anki'
    || (Array.isArray(deck?.tags) && deck.tags.includes('anki'))
    || normalizeFolderName(deck?.description) === 'importado do anki';
}

function planAnkiFolderTree({ decks, targetFolder, targetFolderId, existingFolders, includeLeaves = true }) {
  const targetAncestors = Array.isArray(targetFolder?.ancestorFolderIds) ? targetFolder.ancestorFolderIds : [];
  const byParentAndName = new Map();
  const folderById = new Map([[targetFolderId, { id: targetFolderId, ...targetFolder }]]);
  for (const folder of existingFolders || []) {
    if (!folder?.id || folder.archived === true) continue;
    folderById.set(folder.id, folder);
    byParentAndName.set(`${folder.parentFolderId || ''}\u0000${normalizeFolderName(folder.name)}`, folder);
  }
  const newFolders = [];
  const folderIdByDeckId = new Map();
  let nextFolderOrder = 1;

  // Filter empty Default deck if other decks exist
  const usefulDecks = (decks || []).filter((deck) => {
    if (decks.length > 1 && normalizeFolderName(deck.name) === 'default' && !deck.hasCards) {
      return false;
    }
    return true;
  });

  // Sort decks naturally respecting numeric prefixes (e.g. 01 Portugues, 02 Historia...)
  const orderedDecks = [...usefulDecks].sort((left, right) =>
    left.name.localeCompare(right.name, 'pt-BR', { numeric: true, sensitivity: 'base' })
  );
  const rootNames = new Set(orderedDecks
    .map((deck) => normalizeFolderName(splitAnkiDeckPath(deck.name)[0]))
    .filter(Boolean));
  const sharedPackageRoot = rootNames.size === 1 ? [...rootNames][0] : '';

  for (const deck of orderedDecks) {
    let parentId = targetFolderId;
    let ancestors = [...targetAncestors, targetFolderId];
    let parentName = normalizeFolderName(targetFolder?.name);
    const segments = splitAnkiDeckPath(deck.name);
    if (segments.length && [parentName, sharedPackageRoot].includes(normalizeFolderName(segments[0]))) segments.shift();
    // A deck may contain both its own cards and child decks. Every path segment
    // must have its own folder; omitting the leaf loses it in the folder-only UI.
    const folderSegments = includeLeaves ? segments : segments.slice(0, -1);
    for (const segment of folderSegments) {
      const normalizedSegment = normalizeFolderName(segment);
      if (!normalizedSegment) continue;
      const key = `${parentId}\u0000${normalizedSegment}`;
      let folder = byParentAndName.get(key);
      if (!folder) {
        const pathKey = `${ancestors.join('/')}\u0000${normalizedSegment}`;
        folder = {
          id: stableId('ankifolder', pathKey),
          name: segment.slice(0, 160),
          description: 'Estrutura importada do Anki',
          color: targetFolder?.color || 'red',
          icon: 'folder',
          order: nextFolderOrder++,
          parentFolderId: parentId,
          ancestorFolderIds: [...ancestors],
          archived: false,
        };
        byParentAndName.set(key, folder);
        folderById.set(folder.id, folder);
        newFolders.push(folder);
      }
      parentId = folder.id;
      ancestors = [...(Array.isArray(folder.ancestorFolderIds) ? folder.ancestorFolderIds : []), folder.id];
      parentName = normalizeFolderName(folder.name);
    }
    folderIdByDeckId.set(String(deck.id), parentId);
  }
  return { folderIdByDeckId, newFolders };
}

function buildImportedCardContent({ source, uid, importId, deckId, folderId, now, limits }) {
  if (source.front.length > limits.anki.maxCardHtmlChars || source.back.length > limits.anki.maxCardHtmlChars
    || Buffer.byteLength(JSON.stringify({ front: source.front, back: source.back, tags: source.tags }), 'utf8') > limits.anki.maxCardBytes) {
    throw new AnkiImportError('card-too-large', `O card ${source.ankiNoteGuid} excede o limite de conteúdo; nenhum texto será cortado.`);
  }
  return {
    userId: uid,
    deckId,
    folderId,
    front: source.front,
    back: source.back,
    tags: source.tags,
    ankiMetadata: {
      ankiNoteGuid: source.ankiNoteGuid,
      ankiNoteId: source.ankiNoteId,
      ankiCardOrd: source.ankiCardOrd,
    },
    sourceType: 'anki',
    sourceId: importId,
    updatedAt: now,
  };
}

// Provenance timestamps are not functional changes. Never overwrite scheduling
// or progress, and never bill another write just to change an import timestamp.
function importedContentChanged(existing, incoming) {
  return ['userId', 'deckId', 'folderId', 'front', 'back', 'tags', 'ankiMetadata', 'sourceType']
    .some((field) => !isDeepStrictEqual(existing?.[field], incoming[field]));
}

async function mapConcurrent(items, mapper, concurrency = 8) {
  let cursor = 0;
  const results = new Array(items.length);
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor++;
      results[index] = await mapper(items[index], index);
    }
  }));
  return results;
}

async function getSnapshotsInChunks(db, refs, chunkSize = 300) {
  const snapshots = [];
  for (let offset = 0; offset < refs.length; offset += chunkSize) {
    snapshots.push(...await db.getAll(...refs.slice(offset, offset + chunkSize)));
  }
  return snapshots;
}

function planCardBatches(cards) {
  const batches = [];
  let indices = [];
  let bytes = 0;
  cards.forEach((card, index) => {
    const size = Buffer.byteLength(JSON.stringify(card), 'utf8') + 4096;
    // Up to two card/index writes + one deck update per card, with headroom
    // below Firestore's request byte limit even for large rendered cards.
    if (indices.length && (indices.length >= 80 || bytes + size > 6 * 1024 * 1024)) {
      batches.push(indices);
      indices = [];
      bytes = 0;
    }
    indices.push(index);
    bytes += size;
  });
  if (indices.length) batches.push(indices);
  return batches;
}

async function reconcileDeckCardCount(db, deckRef, admin, maxAttempts = 5, FieldValue = admin?.firestore?.FieldValue || AdminFieldValue) {
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const before = await deckRef.get();
    if (!before.exists) return null;
    const expectedVersion = Number(before.data()?.cardMutationVersion || 0);
    const aggregate = await deckRef.collection('cards').count().get();
    const authoritativeCount = Number(aggregate.data().count || 0);
    try {
      await db.runTransaction(async (transaction) => {
        const current = await transaction.get(deckRef);
        if (!current.exists) return;
        if (Number(current.data()?.cardMutationVersion || 0) !== expectedVersion) {
          const error = new Error('deck-mutated-during-reconciliation');
          error.code = 'deck-mutated';
          throw error;
        }
        if (Number(current.data()?.cardCount || 0) === authoritativeCount) return;
        transaction.update(deckRef, {
          cardCount: authoritativeCount,
          updatedAt: FieldValue.serverTimestamp(),
        });
      });
      return authoritativeCount;
    } catch (error) {
      if (error?.code !== 'deck-mutated' || attempt === maxAttempts - 1) throw error;
    }
  }
  return null;
}

function createAnkiService({ admin, getProductLimits, FieldValue = admin?.firestore?.FieldValue || AdminFieldValue,
  FieldPath = admin?.firestore?.FieldPath || AdminFieldPath, Timestamp = admin?.firestore?.Timestamp || AdminTimestamp }) {
  const db = admin.firestore();
  const getBucket = () => admin.storage().bucket();

  async function importAnkiPackage({ uid, importId, storagePath, originalName, folderId }) {
    const safeUid = safeIdentifier(uid, 'uid');
    const safeImportId = safeIdentifier(importId, 'importId');
    const safeFolderId = safeIdentifier(folderId, 'folderId');
    const expectedPrefix = `user_uploads/${safeUid}/anki_imports/${safeImportId}/`;
    const safeStoragePath = String(storagePath || '');
    if (!safeStoragePath.startsWith(expectedPrefix) || safeStoragePath.slice(expectedPrefix.length).includes('/')) {
      throw new AnkiImportError('invalid-storage-path', 'Caminho do APKG nao pertence ao usuario/importacao informados.');
    }
    const normalizedName = String(originalName || safeStoragePath.split('/').pop() || '').normalize('NFC').trim();
    if (!normalizedName.toLowerCase().endsWith('.apkg')) throw new AnkiImportError('invalid-file-type', 'A importacao exige um arquivo .apkg.');

    const limits = await getProductLimits(db);
    const userRef = db.collection('users').doc(safeUid);
    const folderSnapshot = await userRef.collection('study_folders').doc(safeFolderId).get();
    if (!folderSnapshot.exists || folderSnapshot.data()?.userId !== safeUid || folderSnapshot.data()?.archived === true) {
      throw new AnkiImportError('not-found', 'Pasta de Estudos de destino nao encontrada.');
    }
    const importRef = userRef.collection('anki_imports').doc(safeImportId);
    // Serialize APKG imports for one user; separate users remain independent.
    // A crashed invocation expires after the callable's maximum execution time.
    const lockRef = userRef.collection('anki_import_locks').doc('active');
    const lockToken = crypto.randomUUID();
    await db.runTransaction(async (transaction) => {
      const lock = await transaction.get(lockRef);
      if (Number(lock.data()?.expiresAt || 0) > Date.now()) {
        throw new AnkiImportError('import-in-progress', 'Já existe uma importação em andamento. Aguarde sua conclusão antes de tentar novamente.');
      }
      transaction.set(lockRef, { token: lockToken, expiresAt: Date.now() + limits.anki.importLeaseMs });
    });
    const bucket = getBucket();
    let sourceFile = bucket.file(safeStoragePath);
    let shouldDeleteSource = false;
    try {
      await importRef.set({
        userId: safeUid,
        originalName: normalizedName.slice(0, 240),
        storagePath: safeStoragePath,
        status: 'processing',
        folderId: safeFolderId,
        startedAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      }, { merge: true });

      const resolvedPackage = await resolveUploadedPackage(bucket, safeStoragePath, expectedPrefix);
      sourceFile = resolvedPackage.sourceFile;
      const metadata = resolvedPackage.metadata;
      if (resolvedPackage.recoveredPath) {
        console.warn('[AnkiImport] Pacote recuperado pelo prefixo isolado após divergência no nome do objeto.', {
          importId: safeImportId,
        });
      }
      const size = Number(metadata?.size || 0);
      const contentType = String(metadata?.contentType || '').toLowerCase();
      if (size <= 0 || size > limits.storage.maxApkgSizeBytes) throw new AnkiImportError('file-too-large', 'APKG vazio ou acima do limite configurado.');
      if (!['application/zip', 'application/octet-stream', 'application/x-zip-compressed'].includes(contentType)) {
        throw new AnkiImportError('invalid-mime', 'MIME do APKG nao permitido.');
      }
      const [archiveBuffer] = await sourceFile.download();
      const archive = await openAnkiArchive(archiveBuffer, limits);
      const mediaUris = new Map();
      const mediaToStore = new Map();
      for (const media of archive.media) {
          const extension = {
            'image/jpeg': '.jpg', 'image/png': '.png', 'image/gif': '.gif', 'image/svg+xml': '.svg',
            'image/webp': '.webp', 'audio/mpeg': '.mp3', 'audio/ogg': '.ogg', 'audio/wav': '.wav',
            'audio/mp4': '.m4a', 'video/mp4': '.mp4',
          }[media.contentType] || '';
          const digest = crypto.createHash('sha256').update(media.data).digest('hex');
          const mediaPath = `user_uploads/${safeUid}/anki_media/${digest}${extension}`;
          mediaToStore.set(mediaPath, media);
          mediaUris.set(media.name, `anki-media://${encodeURIComponent(mediaPath)}`);
      }

      const parsed = await parseAnkiCollection(archive.collectionBuffer, {
        maxCards: limits.anki.maxCardsPerImport,
        maxTags: limits.flashcards.maxTagsPerCard,
        mediaUris,
      });
      if (parsed.cards.length === 0) {
        throw new AnkiImportError('no-cards', 'Nenhum flashcard válido ou utilizável foi encontrado no pacote Anki.');
      }
      // Validate all content before uploading media or writing any deck/card.
      for (const source of parsed.cards) {
        buildImportedCardContent({ source, limits });
      }
      const warnings = [...archive.warnings, ...parsed.warnings];
      if (parsed.metrics.cardsSkipped > 0) {
        warnings.push(`O pacote contém ${parsed.metrics.cardsSkipped} cards vazios ou inválidos que foram ignorados (${JSON.stringify(parsed.metrics.skipReasons)}).`);
      }
      const existingFoldersSnapshot = await userRef.collection('study_folders').get();
      const deckCardCounts = new Map();
      for (const card of parsed.cards) {
        deckCardCounts.set(card.ankiDeckId, (deckCardCounts.get(card.ankiDeckId) || 0) + 1);
      }
      const decksWithFlags = parsed.decks.map((deck) => ({
        ...deck,
        hasCards: Number(deckCardCounts.get(deck.id) || 0) > 0,
      }));

      const folderPlan = planAnkiFolderTree({
        decks: decksWithFlags,
        targetFolder: folderSnapshot.data(),
        targetFolderId: safeFolderId,
        existingFolders: existingFoldersSnapshot.docs.map((snapshot) => ({ id: snapshot.id, ...snapshot.data() })),
      });
      const activeFolderCount = existingFoldersSnapshot.docs
        .filter((snapshot) => snapshot.data()?.archived !== true).length;
      const availableFolderSlots = Math.max(0, limits.anki.maxFoldersPerUser - activeFolderCount);
      if (folderPlan.newFolders.length > availableFolderSlots) {
        throw new AnkiImportError('folder-limit', `A árvore requer ${folderPlan.newFolders.length} novas pastas, mas há ${availableFolderSlots} vagas. Nenhuma parte da árvore foi importada.`);
      }
      const existingDecksSnapshot = await userRef.collection('decks').get();
      const existingDeckIds = new Set(existingDecksSnapshot.docs.map((snapshot) => snapshot.id));
      const existingDeckById = new Map(existingDecksSnapshot.docs.map((snapshot) => [snapshot.id, snapshot.data() || {}]));
      const legacyFolderPlan = planAnkiFolderTree({
        decks: decksWithFlags, targetFolder: folderSnapshot.data(), targetFolderId: safeFolderId,
        existingFolders: existingFoldersSnapshot.docs.map((snapshot) => ({ id: snapshot.id, ...snapshot.data() })),
        includeLeaves: false,
      });
      const deckDefinitions = new Map();
      const deckIdByAnkiDeckId = new Map();
      for (const card of parsed.cards) {
        const leafName = splitAnkiDeckPath(card.deckName).at(-1) || 'Deck Anki';
        const deckId = chooseAnkiDeckDocumentId(card, existingDeckById);
        const previousDeck = existingDeckById.get(deckId);
        const previousFolder = previousDeck?.folderId;
        const plannedFolder = folderPlan.folderIdByDeckId.get(card.ankiDeckId) || safeFolderId;
        const assignedFolder = previousFolder
          && !isManagedAnkiDeck(previousDeck)
          && previousFolder !== legacyFolderPlan.folderIdByDeckId.get(card.ankiDeckId)
          ? previousFolder : plannedFolder;
        deckIdByAnkiDeckId.set(card.ankiDeckId, deckId);
        if (!deckDefinitions.has(deckId)) deckDefinitions.set(deckId, {
          deckId,
          name: leafName,
          ankiDeckId: card.ankiDeckId,
          folderId: assignedFolder,
        });
      }
      const newDecks = [...deckDefinitions.values()].filter((deck) => !existingDeckIds.has(deck.deckId));
      const availableDeckSlots = Math.max(0, limits.anki.maxDecksPerUser - existingDeckIds.size);
      if (newDecks.length > availableDeckSlots) {
        throw new AnkiImportError('deck-limit', `O pacote requer ${newDecks.length} novos decks, mas há ${availableDeckSlots} vagas. Nenhum deck ou card foi importado.`);
      }
      const allowedDeckIds = new Set(deckDefinitions.keys());
      // Group by deck to amortize its atomic counter update across many cards.
      const acceptedCards = [...parsed.cards].sort((a, b) => a.ankiDeckId.localeCompare(b.ankiDeckId));
      const indexRefs = acceptedCards.map((card) => userRef.collection('anki_card_index').doc(stableId('card', `${card.ankiNoteGuid}\u0000${card.ankiCardOrd}`)));
      // Queries bill only existing index documents (+ a minimum per query),
      // unlike getAll of thousands of missing documents on a first import.
      const indexById = new Map();
      if (existingDeckIds.size) {
        const groups = [];
        for (let offset = 0; offset < indexRefs.length; offset += 30) groups.push(indexRefs.slice(offset, offset + 30));
        await mapConcurrent(groups, async (group) => {
          const snapshot = await userRef.collection('anki_card_index')
            .where(FieldPath.documentId(), 'in', group.map((ref) => ref.id)).get();
          snapshot.docs.forEach((doc) => indexById.set(doc.id, doc));
        });
      }
      const indexSnapshots = indexRefs.map((ref) => indexById.get(ref.id));
      const candidateCardRefs = acceptedCards.map((card, index) => {
        const indexData = indexSnapshots[index]?.data() || {};
        const indexedDeckId = String(indexData.deckId || '');
        const indexedCardId = String(indexData.cardId || '');
        if (existingDeckIds.has(indexedDeckId) && /^[A-Za-z0-9_-]{1,160}$/.test(indexedCardId)) {
          return userRef.collection('decks').doc(indexedDeckId).collection('cards').doc(indexedCardId);
        }
        return userRef.collection('decks').doc(deckIdByAnkiDeckId.get(card.ankiDeckId)).collection('cards').doc(indexRefs[index].id);
      });
      const existingCardSnapshots = await getSnapshotsInChunks(db,
        candidateCardRefs.filter((ref) => existingDeckIds.has(ref.parent.parent.id)));
      const cardByPath = new Map(existingCardSnapshots.map((snapshot) => [snapshot.ref.path, snapshot]));
      const cardSnapshots = candidateCardRefs.map((ref) => cardByPath.get(ref.path));
      const canonicalCardRefs = acceptedCards.map((card, index) => userRef.collection('decks')
        .doc(deckIdByAnkiDeckId.get(card.ankiDeckId)).collection('cards').doc(indexRefs[index].id));
      const migrationTargetRefs = canonicalCardRefs.filter((ref, index) => {
        const existing = cardSnapshots[index];
        return existing?.exists
          && existing.ref.path !== ref.path
          && isManagedAnkiDeck(existingDeckById.get(existing.ref.parent.parent.id));
      });
      const migrationTargetSnapshots = await getSnapshotsInChunks(db, migrationTargetRefs);
      const migrationTargetByPath = new Map(migrationTargetSnapshots.map((snapshot) => [snapshot.ref.path, snapshot]));
      const deckCounts = new Map();
      cardSnapshots.forEach((snapshot) => {
        if (snapshot?.exists) allowedDeckIds.add(snapshot.ref.parent.parent.id);
      });
      await mapConcurrent([...allowedDeckIds], async (deckId) => {
        const count = existingDeckIds.has(deckId)
          ? Number((await userRef.collection('decks').doc(deckId).collection('cards').count().get()).data().count || 0)
          : 0;
        deckCounts.set(deckId, count);
      });
      const projectedCounts = new Map(deckCounts);
      acceptedCards.forEach((card, index) => {
        const existing = cardSnapshots[index];
        const importedDeckId = deckIdByAnkiDeckId.get(card.ankiDeckId);
        if (!existing?.exists) {
          projectedCounts.set(importedDeckId, (projectedCounts.get(importedDeckId) || 0) + 1);
          return;
        }
        const currentDeckId = existing.ref.parent.parent.id;
        const canonicalRef = canonicalCardRefs[index];
        if (currentDeckId !== importedDeckId && isManagedAnkiDeck(existingDeckById.get(currentDeckId))) {
          projectedCounts.set(currentDeckId, Math.max(0, (projectedCounts.get(currentDeckId) || 0) - 1));
          if (!migrationTargetByPath.get(canonicalRef.path)?.exists) {
            projectedCounts.set(importedDeckId, (projectedCounts.get(importedDeckId) || 0) + 1);
          }
        }
      });
      for (const [deckId, count] of projectedCounts) {
        if (count > limits.anki.maxCardsPerDeck) {
          throw new AnkiImportError('card-limit', `O deck ${deckDefinitions.get(deckId)?.name || deckId} ficaria com ${count} cards (limite ${limits.anki.maxCardsPerDeck}). Nenhum card foi cortado ou gravado.`);
        }
      }

      let mediaUploaded = 0;
      let mediaReused = 0;
      await mapConcurrent([...mediaToStore], async ([mediaPath, media]) => {
        const object = bucket.file(mediaPath);
        const [exists] = await object.exists();
        if (exists) { mediaReused += 1; return; }
        try {
          await object.save(media.data, {
            resumable: false,
            validation: 'crc32c',
            preconditionOpts: { ifGenerationMatch: 0 },
            metadata: {
              contentType: media.contentType,
              cacheControl: 'private,max-age=31536000,immutable',
              metadata: { ownerUid: safeUid, ankiOriginalName: media.name.slice(0, 240) },
            },
          });
          mediaUploaded += 1;
        } catch (error) {
          if (Number(error?.code) !== 412) throw error;
          mediaReused += 1;
        }
      });
      for (let offset = 0; offset < folderPlan.newFolders.length; offset += 400) {
        const folderBatch = db.batch();
        folderPlan.newFolders.slice(offset, offset + 400).forEach((folder, index) => {
          folderBatch.create(userRef.collection('study_folders').doc(folder.id), {
            userId: safeUid,
            name: folder.name,
            description: folder.description,
            color: folder.color,
            icon: folder.icon,
            order: folder.order != null ? folder.order : (offset + index + 1),
            parentFolderId: folder.parentFolderId,
            ancestorFolderIds: folder.ancestorFolderIds,
            archived: false,
            sourceType: 'anki',
            createdAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp(),
          });
        });
        await folderBatch.commit();
      }
      const definitions = [...deckDefinitions.values()];
      for (let offset = 0; offset < definitions.length; offset += 400) {
        const deckBatch = db.batch();
        let deckWrites = 0;
        for (const definition of definitions.slice(offset, offset + 400)) {
          const deckRef = userRef.collection('decks').doc(definition.deckId);
          if (existingDeckIds.has(definition.deckId)) {
            const previous = existingDeckById.get(definition.deckId);
            const next = {
              name: String(definition.name || 'Deck Anki').slice(0, 160),
              folderId: definition.folderId,
              archived: isManagedAnkiDeck(previous) ? false : previous.archived === true,
              sourceType: 'anki',
              ankiDeckId: definition.ankiDeckId,
            };
            if (Object.entries(next).every(([key, value]) => previous[key] === value)) continue;
            deckBatch.update(deckRef, { ...next, updatedAt: FieldValue.serverTimestamp() });
          } else {
            deckBatch.create(deckRef, {
              userId: safeUid,
              name: String(definition.name || 'Deck Anki').slice(0, 160),
              folderId: definition.folderId,
              description: 'Importado do Anki',
              cardCount: 0,
              cardMutationVersion: 0,
              tags: ['anki'],
              sourceType: 'anki',
              ankiDeckId: definition.ankiDeckId,
              archived: false,
              createdAt: FieldValue.serverTimestamp(),
              updatedAt: FieldValue.serverTimestamp(),
            });
          }
          deckWrites += 1;
        }
        if (deckWrites) await deckBatch.commit();
      }

      let added = 0;
      let updated = 0;
      let unchanged = 0;
      const skipped = 0;
      let preservedDeckAssignments = 0;
      let batchesStarted = 0;
      let batchesCompleted = 0;
      let writeFailures = 0;
      let failedBatches = 0;
      const changedDeckIds = new Set();
      for (const indices of planCardBatches(acceptedCards)) {
        const batch = db.batch();
        let batchAdded = 0;
        let batchUpdated = 0;
        let batchUnchanged = 0;
        let batchWrites = 0;
        const deckDeltas = new Map();
        for (const index of indices) {
          const source = acceptedCards[index];
          const existing = cardSnapshots[index];
          const importedDeckId = deckIdByAnkiDeckId.get(source.ankiDeckId);
          const existingDeckId = existing?.exists ? existing.ref.parent.parent.id : '';
          const migrateManagedDeck = existing?.exists
            && existingDeckId !== importedDeckId
            && isManagedAnkiDeck(existingDeckById.get(existingDeckId));
          const targetDeckId = migrateManagedDeck ? importedDeckId : (existingDeckId || importedDeckId);
          const targetFolderId = deckDefinitions.get(targetDeckId)?.folderId
            || existingDeckById.get(targetDeckId)?.folderId || safeFolderId;
          if (existing?.exists && !migrateManagedDeck && targetDeckId !== importedDeckId) {
            preservedDeckAssignments += 1;
          }
          const identity = stableId('card', `${source.ankiNoteGuid}\u0000${source.ankiCardOrd}`);
          const cardRef = migrateManagedDeck ? canonicalCardRefs[index]
            : existing?.exists ? existing.ref : userRef.collection('decks').doc(targetDeckId).collection('cards').doc(identity);
          const now = FieldValue.serverTimestamp();
          const common = buildImportedCardContent({
            source, uid: safeUid, importId: safeImportId, deckId: targetDeckId, folderId: targetFolderId, now, limits,
          });
          if (migrateManagedDeck) {
            const canonicalAlreadyExists = migrationTargetByPath.get(cardRef.path)?.exists;
            batch.set(cardRef, {
              ...existing.data(),
              ...common,
              updatedAt: now,
            });
            batch.delete(existing.ref);
            deckDeltas.set(existingDeckId, (deckDeltas.get(existingDeckId) || 0) - 1);
            if (!canonicalAlreadyExists) deckDeltas.set(targetDeckId, (deckDeltas.get(targetDeckId) || 0) + 1);
            batchUpdated += 1;
            batchWrites += 2;
          } else if (existing?.exists) {
            if (importedContentChanged(existing.data(), common)) {
              batch.update(cardRef, common);
              batchUpdated += 1;
              batchWrites += 1;
              deckDeltas.set(targetDeckId, deckDeltas.get(targetDeckId) || 0);
            } else {
              batchUnchanged += 1;
            }
          } else {
            batch.create(cardRef, {
              ...common,
              status: 'new',
              dueAt: Timestamp.now(),
              lapses: 0,
              reps: 0,
              reviewVersion: 0,
              schedulerState: createInitialState(limits.scheduler),
              createdAt: now,
            });
            deckDeltas.set(targetDeckId, (deckDeltas.get(targetDeckId) || 0) + 1);
            batchAdded += 1;
            batchWrites += 1;
          }
          const indexContent = {
            userId: safeUid,
            identity,
            ankiNoteGuid: source.ankiNoteGuid,
            ankiCardOrd: source.ankiCardOrd,
            deckId: targetDeckId,
            cardId: cardRef.id,
          };
          if (Object.entries(indexContent).some(([key, value]) => indexSnapshots[index]?.data()?.[key] !== value)) {
            batch.set(indexRefs[index], {
              ...indexContent, updatedAt: now, createdAt: indexSnapshots[index]?.data()?.createdAt || now,
            }, { merge: true });
            batchWrites += 1;
          }
        }
        for (const [deckId, delta] of deckDeltas) {
          batch.update(userRef.collection('decks').doc(deckId), {
            cardCount: FieldValue.increment(delta),
            cardMutationVersion: FieldValue.increment(1),
            updatedAt: FieldValue.serverTimestamp(),
          });
        }
        if (batchWrites === 0) {
          unchanged += batchUnchanged;
          continue;
        }
        batchesStarted += 1;
        try {
          await batch.commit();
          batchesCompleted += 1;
          added += batchAdded;
          updated += batchUpdated;
          unchanged += batchUnchanged;
          deckDeltas.forEach((_delta, deckId) => changedDeckIds.add(deckId));
        } catch (batchError) {
          failedBatches += 1;
          writeFailures += batchWrites;
          warnings.push(`Um lote com ${batchWrites} cards falhou e a importação foi interrompida com segurança.`);
          console.error('[AnkiImport] Falha de escrita em lote.', {
            importId: safeImportId,
            offset: indices[0],
            batchWrites,
            code: batchError?.code || 'batch-write-failed',
            message: batchError?.message || String(batchError),
          });
          break;
        }
      }

      let reconciliationFailures = 0;
      // Known-new decks have exact atomic counters. Reconcile legacy decks only
      // when touched or when preflight found a stale counter.
      const decksToReconcile = [...allowedDeckIds].filter((id) =>
        existingDeckIds.has(id) && (changedDeckIds.has(id)
          || Number(existingDeckById.get(id)?.cardCount || 0) !== deckCounts.get(id)));
      await mapConcurrent(decksToReconcile, async (deckId) => {
        try {
          await reconcileDeckCardCount(db, userRef.collection('decks').doc(deckId), admin, 5, FieldValue);
        } catch (reconcileError) {
          reconciliationFailures += 1;
          console.error('[AnkiImport] Falha ao reconciliar cardCount.', {
            importId: safeImportId,
            deckId,
            code: reconcileError?.code || 'reconciliation-failed',
          });
        }
      });

      if (preservedDeckAssignments > 0) {
        warnings.push(`${preservedDeckAssignments} cards mantiveram o deck atual do ModoQAP durante a reimportação.`);
      }
      // Acknowledged atomic commits are persistence evidence. Only re-read on
      // an ambiguous failed commit; normal imports need no third full scan.
      const cardsPersisted = failedBatches
        ? (await getSnapshotsInChunks(db, candidateCardRefs)).filter((snapshot) => snapshot?.exists).length
        : cardSnapshots.filter((snapshot) => snapshot?.exists).length + added;

      const safeWarnings = boundedWarnings(warnings, limits.anki.maxWarnings);
      const parserMetrics = parsed.metrics || {};
      const cardsDetected = Number(parserMetrics.cardsDetected || parsed.cards.length);
      const cardsParsed = Number(parserMetrics.cardsParsed || parsed.cards.length);
      const parserCardsSkipped = Number(parserMetrics.cardsSkipped || 0);
      const unacceptedCount = parsed.cards.length - acceptedCards.length;
      const accounting = buildImportAccounting({
        cardsDetected,
        cardsParsed,
        parserCardsSkipped,
        cardsAdded: added,
        cardsUpdated: updated,
        cardsUnchanged: unchanged,
        importCardsSkipped: skipped,
        unacceptedCards: unacceptedCount,
        cardsPersisted,
        writeFailures,
        batchesStarted,
        batchesCompleted,
        reconciliationFailures,
      });
      const { cardsSkipped: totalSkipped, accountingComplete, persistenceComplete, isComplete } = accounting;

      const result = {
        importId: safeImportId,
        folderId: safeFolderId,
        targetFolderId: safeFolderId,
        rootFolderId: safeFolderId,
        status: isComplete ? (safeWarnings.length > 0 ? 'completed_with_warnings' : 'completed') : 'incomplete',
        collectionFormat: archive.collectionName,
        totalCardsSQLite: Number(parserMetrics.totalCardsSQLite || cardsDetected),
        totalNotesSQLite: Number(parserMetrics.totalNotesSQLite || 0),
        totalDecksSQLite: Number(parserMetrics.totalDecksSQLite || parsed.deckCount),
        cardsPerDeck: Array.isArray(parserMetrics.cardsPerDeck) ? parserMetrics.cardsPerDeck : [],
        cardsDetected,
        cardsParsed,
        parserCardsSkipped,
        parserSkipReasons: parserMetrics.skipReasons || {},
        typedAnswerCards: Number(parserMetrics.typedAnswerCards || 0),
        deckCount: parsed.deckCount,
        folderCount: folderPlan.folderIdByDeckId.size,
        foldersCreated: folderPlan.newFolders.length,
        totalCardsAnalyzed: cardsDetected,
        cardsFound: cardsDetected,
        cardsAdded: added,
        cardsCreated: added,
        cardsUpdated: updated,
        cardsUnchanged: unchanged,
        duplicates: updated + unchanged,
        cardsSkipped: totalSkipped,
        cardsPersisted,
        writeFailures,
        failedBatches,
        batchesStarted,
        batchesCompleted,
        reconciliationFailures,
        accountingComplete,
        persistenceComplete,
        mediaImported: archive.media.length,
        mediaUploaded,
        mediaReused,
        persistenceVerification: failedBatches ? 'read_after_failure' : 'snapshots_and_atomic_commits',
        isComplete,
        warnings: safeWarnings,
      };
      // Deep/wide paths can make the detailed report exceed Firestore's document
      // size even though every card fits. Keep all detail in private Storage.
      const deckReport = JSON.stringify(result.cardsPerDeck);
      if (Buffer.byteLength(deckReport, 'utf8') > limits.anki.maxInlineReportBytes) {
        const reportPath = `${expectedPrefix}deck-report.json`;
        await bucket.file(reportPath).save(Buffer.from(deckReport), {
          resumable: false, metadata: { contentType: 'application/json', cacheControl: 'private,max-age=31536000,immutable' },
        });
        result.cardsPerDeckCount = result.cardsPerDeck.length;
        result.cardsPerDeckReportPath = reportPath;
        result.cardsPerDeck = [];
      }
      await importRef.set({
        ...result,
        userId: safeUid,
        storagePath: safeStoragePath,
        sourceRetained: true,
        completedAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      }, { merge: true });
      shouldDeleteSource = shouldDeleteUploadedPackage(result);
      return result;
    } catch (error) {
      console.error('[AnkiImport] Importação interrompida; APKG preservado para diagnóstico ou nova tentativa.', {
        importId: safeImportId,
        code: error?.code || 'import-failed',
        message: error?.message || String(error),
      });
      await importRef.set({
        status: 'error',
        errorCode: String(error?.code || 'import-failed').slice(0, 80),
        errorMessage: String(error?.message || 'Falha ao importar APKG.').slice(0, 500),
        storagePath: safeStoragePath,
        sourceRetained: true,
        updatedAt: FieldValue.serverTimestamp(),
      }, { merge: true }).catch(() => {});
      throw error;
    } finally {
      if (shouldDeleteSource) {
        const sourceDeleted = await sourceFile.delete({ ignoreNotFound: true })
          .then(() => true)
          .catch((cleanupError) => {
            console.error('[AnkiImport] Falha ao remover APKG após importação concluída.', {
              importId: safeImportId,
              code: cleanupError?.code || 'source-cleanup-failed',
            });
            return false;
          });
        if (sourceDeleted) {
          await importRef.set({
            storagePath: FieldValue.delete(),
            sourceRetained: false,
            updatedAt: FieldValue.serverTimestamp(),
          }, { merge: true }).catch(() => {});
        }
      }
      await db.runTransaction(async (transaction) => {
        const lock = await transaction.get(lockRef);
        if (lock.data()?.token === lockToken) transaction.delete(lockRef);
      }).catch((error) => console.error('[AnkiImport] Falha ao liberar lease; expira automaticamente.', error?.code));
    }
  }

  return { importAnkiPackage };
}

module.exports = {
  AnkiImportError,
  buildImportedCardContent,
  buildImportAccounting,
  importedContentChanged,
  isManagedAnkiDeck,
  planCardBatches,
  boundedWarnings,
  chooseAnkiDeckDocumentId,
  createAnkiService,
  reconcileDeckCardCount,
  planAnkiFolderTree,
  resolveUploadedPackage,
  shouldDeleteUploadedPackage,
  splitAnkiDeckPath,
  stableId,
};
