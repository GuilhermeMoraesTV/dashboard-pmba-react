/**
 * @fileoverview Importacao/reimportacao idempotente de APKG para decks privados.
 */

const crypto = require('crypto');
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

function planAnkiFolderTree({ decks, targetFolder, targetFolderId, existingFolders }) {
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
    if (decks.length > 1 && (deck.id === '1' || normalizeFolderName(deck.name) === 'default') && !deck.hasCards) {
      return false;
    }
    return true;
  });

  // Sort decks naturally respecting numeric prefixes (e.g. 01 Portugues, 02 Historia...)
  const orderedDecks = [...usefulDecks].sort((left, right) =>
    left.name.localeCompare(right.name, 'pt-BR', { numeric: true, sensitivity: 'base' })
  );

  for (const deck of orderedDecks) {
    let parentId = targetFolderId;
    let ancestors = [...targetAncestors, targetFolderId];
    let parentName = normalizeFolderName(targetFolder?.name);
    const segments = splitAnkiDeckPath(deck.name);
    if (segments.length && normalizeFolderName(segments[0]) === parentName) segments.shift();
    for (const segment of segments) {
      const normalizedSegment = normalizeFolderName(segment);
      if (!normalizedSegment || normalizedSegment === parentName) continue;
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
  return {
    userId: uid,
    deckId,
    folderId,
    front: source.front.slice(0, limits.anki.maxCardHtmlChars),
    back: source.back.slice(0, limits.anki.maxCardHtmlChars),
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

async function getSnapshotsInChunks(db, refs, chunkSize = 300) {
  const snapshots = [];
  for (let offset = 0; offset < refs.length; offset += chunkSize) {
    snapshots.push(...await db.getAll(...refs.slice(offset, offset + chunkSize)));
  }
  return snapshots;
}

async function reconcileDeckCardCount(db, deckRef, admin, maxAttempts = 5) {
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
        transaction.update(deckRef, {
          cardCount: authoritativeCount,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      });
      return authoritativeCount;
    } catch (error) {
      if (error?.code !== 'deck-mutated' || attempt === maxAttempts - 1) throw error;
    }
  }
  return null;
}

function createAnkiService({ admin, getProductLimits }) {
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
    await importRef.set({
      userId: safeUid,
      originalName: normalizedName.slice(0, 240),
      storagePath: safeStoragePath,
      status: 'processing',
      folderId: safeFolderId,
      startedAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });

    const bucket = getBucket();
    const sourceFile = bucket.file(safeStoragePath);
    try {
      const [metadata] = await sourceFile.getMetadata();
      const size = Number(metadata?.size || 0);
      const contentType = String(metadata?.contentType || '').toLowerCase();
      if (size <= 0 || size > limits.storage.maxApkgSizeBytes) throw new AnkiImportError('file-too-large', 'APKG vazio ou acima do limite configurado.');
      if (!['application/zip', 'application/octet-stream', 'application/x-zip-compressed'].includes(contentType)) {
        throw new AnkiImportError('invalid-mime', 'MIME do APKG nao permitido.');
      }
      const [archiveBuffer] = await sourceFile.download();
      const archive = await openAnkiArchive(archiveBuffer, limits);
      const mediaUris = new Map();
      for (let offset = 0; offset < archive.media.length; offset += 8) {
        await Promise.all(archive.media.slice(offset, offset + 8).map(async (media) => {
          const extension = {
            'image/jpeg': '.jpg', 'image/png': '.png', 'image/gif': '.gif', 'image/svg+xml': '.svg',
            'image/webp': '.webp', 'audio/mpeg': '.mp3', 'audio/ogg': '.ogg', 'audio/wav': '.wav',
            'audio/mp4': '.m4a', 'video/mp4': '.mp4',
          }[media.contentType] || '';
          const digest = crypto.createHash('sha256').update(media.data).digest('hex');
          const mediaPath = `user_uploads/${safeUid}/anki_media/${digest}${extension}`;
          await bucket.file(mediaPath).save(media.data, {
            resumable: false,
            validation: 'crc32c',
            metadata: {
              contentType: media.contentType,
              cacheControl: 'private,max-age=31536000,immutable',
              metadata: { ownerUid: safeUid, ankiOriginalName: media.name.slice(0, 240) },
            },
          });
          mediaUris.set(media.name, `anki-media://${encodeURIComponent(mediaPath)}`);
        }));
      }

      const parsed = await parseAnkiCollection(archive.collectionBuffer, {
        maxCards: Math.min(limits.anki.maxCardsPerImport, limits.flashcards.maxCardsPerDeck * limits.flashcards.maxDecksPerUser),
        maxTags: limits.flashcards.maxTagsPerCard,
        mediaUris,
      });
      const warnings = [...archive.warnings, ...parsed.warnings];
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
      const availableFolderSlots = Math.max(0, limits.studySources.maxFoldersPerUser - existingFoldersSnapshot.size);
      if (folderPlan.newFolders.length > availableFolderSlots) {
        throw new AnkiImportError('folder-limit', 'A hierarquia Anki excede o limite de pastas do usuario.');
      }
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
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          });
        });
        await folderBatch.commit();
      }
      const existingDecksSnapshot = await userRef.collection('decks').get();
      const existingDeckIds = new Set(existingDecksSnapshot.docs.map((snapshot) => snapshot.id));
      const existingDeckById = new Map(existingDecksSnapshot.docs.map((snapshot) => [snapshot.id, snapshot.data() || {}]));
      const deckDefinitions = new Map();
      const deckIdByAnkiDeckId = new Map();
      for (const card of parsed.cards) {
        const leafName = splitAnkiDeckPath(card.deckName).at(-1) || 'Deck Anki';
        const deckId = chooseAnkiDeckDocumentId(card, existingDeckById);
        deckIdByAnkiDeckId.set(card.ankiDeckId, deckId);
        if (!deckDefinitions.has(deckId)) deckDefinitions.set(deckId, {
          deckId,
          name: leafName,
          ankiDeckId: card.ankiDeckId,
          folderId: folderPlan.folderIdByDeckId.get(card.ankiDeckId) || safeFolderId,
        });
      }
      const definitionDeckIds = new Set(deckDefinitions.keys());
      const existingDefinitionDeckIds = new Set([...definitionDeckIds].filter((deckId) => existingDeckIds.has(deckId)));
      const newDecks = [...deckDefinitions.values()].filter((deck) => !existingDeckIds.has(deck.deckId));
      const availableDeckSlots = Math.max(0, limits.flashcards.maxDecksPerUser - existingDeckIds.size);
      const allowedNewDeckIds = new Set(newDecks.slice(0, availableDeckSlots).map((deck) => deck.deckId));
      if (newDecks.length > availableDeckSlots) warnings.push('Alguns decks foram ignorados porque o limite de decks do usuario foi atingido.');
      const allowedDeckIds = new Set([...existingDefinitionDeckIds, ...allowedNewDeckIds]);

      const deckBatch = db.batch();
      for (const definition of deckDefinitions.values()) {
        if (!allowedDeckIds.has(definition.deckId)) continue;
        const deckRef = userRef.collection('decks').doc(definition.deckId);
        if (existingDeckIds.has(definition.deckId)) {
          deckBatch.set(deckRef, {
            name: String(definition.name || 'Deck Anki').slice(0, 160),
            folderId: definition.folderId,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          }, { merge: true });
        } else {
          deckBatch.set(deckRef, {
            userId: safeUid,
            name: String(definition.name || 'Deck Anki').slice(0, 160),
            folderId: definition.folderId,
            description: 'Importado do Anki',
            cardCount: 0,
            cardMutationVersion: 0,
            tags: ['anki'],
            archived: false,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          });
        }
      }
      await deckBatch.commit();

      const acceptedCards = parsed.cards.filter((card) => allowedDeckIds.has(deckIdByAnkiDeckId.get(card.ankiDeckId)));
      const indexRefs = acceptedCards.map((card) => userRef.collection('anki_card_index').doc(stableId('card', `${card.ankiNoteGuid}\u0000${card.ankiCardOrd}`)));
      const indexSnapshots = await getSnapshotsInChunks(db, indexRefs);
      const candidateCardRefs = acceptedCards.map((card, index) => {
        const indexData = indexSnapshots[index]?.data() || {};
        const indexedDeckId = String(indexData.deckId || '');
        const indexedCardId = String(indexData.cardId || '');
        if (/^[A-Za-z0-9_-]{1,160}$/.test(indexedDeckId) && /^[A-Za-z0-9_-]{1,160}$/.test(indexedCardId)) {
          return userRef.collection('decks').doc(indexedDeckId).collection('cards').doc(indexedCardId);
        }
        const targetDeckId = deckIdByAnkiDeckId.get(card.ankiDeckId);
        const cardId = stableId('card', `${card.ankiNoteGuid}\u0000${card.ankiCardOrd}`);
        return userRef.collection('decks').doc(targetDeckId).collection('cards').doc(cardId);
      });
      const cardSnapshots = await getSnapshotsInChunks(db, candidateCardRefs);
      cardSnapshots.forEach((snapshot) => {
        if (snapshot?.exists) allowedDeckIds.add(snapshot.ref.parent.parent.id);
      });
      const deckCounts = new Map();
      for (const deckId of allowedDeckIds) {
        const aggregate = await userRef.collection('decks').doc(deckId).collection('cards').count().get();
        deckCounts.set(deckId, Number(aggregate.data().count || 0));
      }

      let added = 0;
      let updated = 0;
      let skipped = 0;
      for (let offset = 0; offset < acceptedCards.length; offset += 180) {
        const batch = db.batch();
        for (let index = offset; index < Math.min(offset + 180, acceptedCards.length); index += 1) {
          const source = acceptedCards[index];
          const existing = cardSnapshots[index];
          const targetDeckId = existing?.exists ? existing.ref.parent.parent.id : deckIdByAnkiDeckId.get(source.ankiDeckId);
          const importedDeckId = deckIdByAnkiDeckId.get(source.ankiDeckId);
          const targetFolderId = existing?.exists
            ? (existingDecksSnapshot.docs.find((snapshot) => snapshot.id === targetDeckId)?.data()?.folderId || folderPlan.folderIdByDeckId.get(source.ankiDeckId) || safeFolderId)
            : (folderPlan.folderIdByDeckId.get(source.ankiDeckId) || safeFolderId);
          if (existing?.exists && targetDeckId !== importedDeckId) {
            warnings.push(`Card ${source.ankiNoteGuid}/${source.ankiCardOrd}: deck atual do ModoQAP preservado durante a reimportacao.`);
          }
          const identity = stableId('card', `${source.ankiNoteGuid}\u0000${source.ankiCardOrd}`);
          const cardRef = existing?.exists ? existing.ref : userRef.collection('decks').doc(targetDeckId).collection('cards').doc(identity);
          if (!existing?.exists && Number(deckCounts.get(targetDeckId) || 0) >= limits.flashcards.maxCardsPerDeck) {
            skipped += 1;
            warnings.push(`Card ignorado: limite do deck ${source.deckName} atingido.`);
            continue;
          }
          const now = admin.firestore.FieldValue.serverTimestamp();
          const common = buildImportedCardContent({
            source, uid: safeUid, importId: safeImportId, deckId: targetDeckId, folderId: targetFolderId, now, limits,
          });
          if (existing?.exists) {
            batch.set(cardRef, common, { merge: true });
            updated += 1;
          } else {
            batch.set(cardRef, {
              ...common,
              status: 'new',
              dueAt: admin.firestore.Timestamp.now(),
              lapses: 0,
              reps: 0,
              reviewVersion: 0,
              schedulerState: createInitialState(limits.scheduler),
              createdAt: now,
            });
            deckCounts.set(targetDeckId, Number(deckCounts.get(targetDeckId) || 0) + 1);
            added += 1;
          }
          batch.set(indexRefs[index], {
            userId: safeUid,
            identity,
            ankiNoteGuid: source.ankiNoteGuid,
            ankiCardOrd: source.ankiCardOrd,
            deckId: targetDeckId,
            cardId: cardRef.id,
            updatedAt: now,
            createdAt: indexSnapshots[index]?.data()?.createdAt || now,
          }, { merge: true });
        }
        await batch.commit();
      }

      for (const deckId of allowedDeckIds) {
        await reconcileDeckCardCount(db, userRef.collection('decks').doc(deckId), admin);
      }

      const safeWarnings = boundedWarnings(warnings, limits.anki.maxWarnings);
      const totalCardsAnalyzed = parsed.cards.length;
      const totalCardsAccounted = added + updated + skipped + (parsed.cards.length - acceptedCards.length);
      const isComplete = totalCardsAccounted === totalCardsAnalyzed;

      const result = {
        importId: safeImportId,
        folderId: safeFolderId,
        targetFolderId: safeFolderId,
        rootFolderId: safeFolderId,
        status: isComplete ? 'completed' : 'completed_with_warnings',
        collectionFormat: archive.collectionName,
        deckCount: parsed.deckCount,
        folderCount: folderPlan.folderIdByDeckId.size,
        foldersCreated: folderPlan.newFolders.length,
        totalCardsAnalyzed,
        cardsFound: totalCardsAnalyzed,
        cardsAdded: added,
        cardsUpdated: updated,
        cardsSkipped: skipped + (parsed.cards.length - acceptedCards.length),
        mediaImported: archive.media.length,
        isComplete,
        warnings: safeWarnings,
      };
      await importRef.set({
        ...result,
        userId: safeUid,
        storagePath: admin.firestore.FieldValue.delete(),
        completedAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      }, { merge: true });
      return result;
    } catch (error) {
      await importRef.set({
        status: 'error',
        errorCode: String(error?.code || 'import-failed').slice(0, 80),
        errorMessage: String(error?.message || 'Falha ao importar APKG.').slice(0, 500),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      }, { merge: true }).catch(() => {});
      throw error;
    } finally {
      await sourceFile.delete({ ignoreNotFound: true }).catch(() => {});
    }
  }

  return { importAnkiPackage };
}

module.exports = {
  AnkiImportError,
  buildImportedCardContent,
  boundedWarnings,
  chooseAnkiDeckDocumentId,
  createAnkiService,
  reconcileDeckCardCount,
  planAnkiFolderTree,
  splitAnkiDeckPath,
  stableId,
};
