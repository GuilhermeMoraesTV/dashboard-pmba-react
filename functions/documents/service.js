/**
 * @fileoverview Orquestracao segura do ciclo de vida de documentos privados.
 */

const { DocumentProcessingError, extractPdf } = require('./pdf');
const { FieldValue } = require('firebase-admin/firestore');

function assertIdentifier(value, label) {
  const normalized = String(value || '').trim();
  if (!/^[A-Za-z0-9_-]{1,160}$/.test(normalized)) {
    throw new DocumentProcessingError('invalid-argument', `${label} invalido.`);
  }
  return normalized;
}

async function deleteQueryInBatches(db, query, batchSize = 300) {
  let removed = 0;
  while (true) {
    const snapshot = await query.limit(batchSize).get();
    if (snapshot.empty) break;
    const batch = db.batch();
    snapshot.docs.forEach((item) => batch.delete(item.ref));
    await batch.commit();
    removed += snapshot.size;
    if (snapshot.size < batchSize) break;
  }
  return removed;
}

function createDocumentService({ admin, getProductLimits }) {
  const db = admin.firestore();
  const getBucket = () => admin.storage().bucket();

  async function acquireProcessingLease(uid, documentId, limits, force = false) {
    const ref = db.collection('users').doc(uid).collection('documents').doc(documentId);
    return db.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(ref);
      if (!snapshot.exists) throw new DocumentProcessingError('not-found', 'Documento nao encontrado.');
      const data = snapshot.data() || {};
      if (data.userId !== uid) throw new DocumentProcessingError('permission-denied', 'Documento nao pertence ao usuario autenticado.');
      if (data.fileType !== 'pdf') throw new DocumentProcessingError('invalid-pdf', 'O documento registrado nao e PDF.');
      if (!force && data.status === 'processed') return { ref, data, alreadyProcessed: true };
      const startedAt = data.processingStartedAt?.toMillis?.() || 0;
      if (data.status === 'processing' && Date.now() - startedAt < limits.documents.processingLeaseMs) {
        throw new DocumentProcessingError('already-processing', 'Este documento ja esta em processamento.');
      }
      transaction.update(ref, {
        status: 'processing',
        errorMessage: null,
        errorCode: null,
        processingStartedAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
      if (data.studySourceId) {
        transaction.update(db.collection('users').doc(uid).collection('study_sources').doc(data.studySourceId), {
          status: 'processing',
          errorMessage: null,
          updatedAt: FieldValue.serverTimestamp(),
        });
      }
      return { ref, data, alreadyProcessed: false };
    });
  }

  async function processUserDocument({ uid, documentId, force = false }) {
    const safeUid = assertIdentifier(uid, 'uid');
    const safeDocumentId = assertIdentifier(documentId, 'documentId');
    const limits = await getProductLimits(db);
    const lease = await acquireProcessingLease(safeUid, safeDocumentId, limits, force);
    if (lease.alreadyProcessed) {
      return {
        documentId: safeDocumentId,
        status: 'processed',
        fileSizeBytes: lease.data.fileSizeBytes || null,
        pageCount: lease.data.pageCount || null,
        chunkCount: lease.data.chunkCount || 0,
      };
    }

    const expectedPrefix = `user_uploads/${safeUid}/documents/${safeDocumentId}/`;
    const storagePath = String(lease.data.storagePath || '');

    try {
      if (!storagePath.startsWith(expectedPrefix) || storagePath.slice(expectedPrefix.length).includes('/')) {
        throw new DocumentProcessingError('invalid-storage-path', 'Caminho do PDF nao corresponde ao documento e proprietario registrados.');
      }
      const bucket = getBucket();
      const file = bucket.file(storagePath);
      const [exists] = await file.exists();
      if (!exists) throw new DocumentProcessingError('file-not-found', 'Arquivo PDF nao encontrado no Storage.');
      const [metadata] = await file.getMetadata();
      const declaredSize = Number(metadata?.size || 0);
      if (declaredSize <= 0 || declaredSize > limits.storage.maxPdfSizeBytes) {
        throw new DocumentProcessingError('file-too-large', 'O tamanho server-side do PDF e invalido ou excede o limite.');
      }
      const [buffer] = await file.download();
      const result = await extractPdf(buffer, limits, { metadata });
      const chunksRef = lease.ref.collection('chunks');
      await deleteQueryInBatches(db, chunksRef.orderBy('__name__'));

      for (let offset = 0; offset < result.chunks.length; offset += 300) {
        const batch = db.batch();
        result.chunks.slice(offset, offset + 300).forEach((chunk) => {
          const chunkId = `chunk_${String(chunk.order).padStart(4, '0')}`;
          batch.set(chunksRef.doc(chunkId), {
            documentId: safeDocumentId,
            userId: safeUid,
            order: chunk.order,
            pageStart: chunk.pageStart,
            pageEnd: chunk.pageEnd,
            content: chunk.content,
            charCount: chunk.charCount,
            createdAt: FieldValue.serverTimestamp(),
          });
        });
        await batch.commit();
      }

      const completionBatch = db.batch();
      completionBatch.update(lease.ref, {
        status: 'processed',
        errorMessage: null,
        errorCode: null,
        fileSizeBytes: declaredSize,
        pageCount: result.pageCount,
        processedPageCount: result.processedPageCount,
        chunkCount: result.chunks.length,
        textCharCount: result.textCharCount,
        processingWarning: result.warning,
        processingVersion: 1,
        processedAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
      if (lease.data.studySourceId) {
        completionBatch.update(db.collection('users').doc(safeUid).collection('study_sources').doc(lease.data.studySourceId), {
          status: 'ready',
          sourceRevision: Number(lease.data.sourceRevision || 1),
          chunkCount: result.chunks.length,
          pageCount: result.pageCount,
          processedPageCount: result.processedPageCount,
          processingWarning: result.warning,
          errorMessage: null,
          readyAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        });
      }
      await completionBatch.commit();
      return {
        documentId: safeDocumentId,
        status: 'processed',
        pageCount: result.pageCount,
        processedPageCount: result.processedPageCount,
        chunkCount: result.chunks.length,
        warning: result.warning,
      };
    } catch (error) {
      const safeMessage = String(error?.message || 'Falha ao processar PDF.').slice(0, 500);
      const failureBatch = db.batch();
      failureBatch.update(lease.ref, {
        status: 'error',
        errorCode: String(error?.code || 'processing-failed').slice(0, 80),
        errorMessage: safeMessage,
        processingFinishedAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
      if (lease.data.studySourceId) {
        failureBatch.update(db.collection('users').doc(safeUid).collection('study_sources').doc(lease.data.studySourceId), {
          status: 'error',
          errorMessage: safeMessage,
          updatedAt: FieldValue.serverTimestamp(),
        });
      }
      await failureBatch.commit().catch(() => {});
      throw error;
    }
  }

  async function deleteUserDocument({ uid, documentId }) {
    const safeUid = assertIdentifier(uid, 'uid');
    const safeDocumentId = assertIdentifier(documentId, 'documentId');
    const ref = db.collection('users').doc(safeUid).collection('documents').doc(safeDocumentId);
    const snapshot = await ref.get();
    if (!snapshot.exists) return { documentId: safeDocumentId, deleted: true };
    const data = snapshot.data() || {};
    if (data.userId !== safeUid) throw new DocumentProcessingError('permission-denied', 'Documento nao pertence ao usuario autenticado.');
    const expectedPrefix = `user_uploads/${safeUid}/documents/${safeDocumentId}/`;
    const storagePath = String(data.storagePath || '');

    await deleteQueryInBatches(db, ref.collection('chunks').orderBy('__name__'));
    if (storagePath.startsWith(expectedPrefix) && !storagePath.slice(expectedPrefix.length).includes('/')) {
      await getBucket().file(storagePath).delete({ ignoreNotFound: true });
    }
    await ref.delete();
    if (data.studySourceId) {
      await db.collection('users').doc(safeUid).collection('study_sources').doc(data.studySourceId).delete().catch(() => {});
    }
    return { documentId: safeDocumentId, deleted: true };
  }

  return { deleteUserDocument, processUserDocument };
}

module.exports = {
  createDocumentService,
  deleteQueryInBatches,
};
