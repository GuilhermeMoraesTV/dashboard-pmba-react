/**
 * @fileoverview Upload direto, listagem e ciclo de vida de PDFs privados.
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { deleteObject, ref, uploadBytesResumable } from 'firebase/storage';
import { auth, db, functions, storage } from '../../firebaseConfig.js';
import { DEFAULT_PRODUCT_LIMITS, resolveProductLimits } from '../../config/productLimits.js';

function sanitizeFileName(name, fallback = 'documento.pdf') {
  const normalized = String(name || fallback)
    .normalize('NFC')
    .replace(/[\\/\u0000-\u001F\u007F]/g, '_')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 180);
  return normalized.toLowerCase().endsWith('.pdf') ? normalized : `${normalized || 'documento'}.pdf`;
}

function toDate(value) {
  if (value?.toDate) return value.toDate();
  if (value instanceof Date) return value;
  if (value) {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }
  return null;
}

function mapDocument(snapshot) {
  const data = snapshot.data() || {};
  return {
    id: snapshot.id,
    ...data,
    createdAt: toDate(data.createdAt),
    updatedAt: toDate(data.updatedAt),
    processingStartedAt: toDate(data.processingStartedAt),
    processedAt: toDate(data.processedAt),
  };
}

async function getClientProductLimits() {
  try {
    const snapshot = await getDoc(doc(db, 'system_config', 'product_limits'));
    return resolveProductLimits(snapshot.exists() ? snapshot.data() : {});
  } catch {
    return DEFAULT_PRODUCT_LIMITS;
  }
}

async function validatePdfFile(file, limits = DEFAULT_PRODUCT_LIMITS) {
  if (!(file instanceof Blob)) throw new Error('Selecione um arquivo PDF valido.');
  if (file.size <= 0) throw new Error('O arquivo PDF esta vazio.');
  if (file.size > limits.storage.maxPdfSizeBytes) throw new Error('O PDF excede o limite de tamanho permitido.');
  if (String(file.type || '').toLowerCase() !== 'application/pdf') throw new Error('O arquivo deve possuir MIME application/pdf.');
  const signature = new Uint8Array(await file.slice(0, 8).arrayBuffer());
  if (String.fromCharCode(...signature).slice(0, 5) !== '%PDF-') throw new Error('A assinatura do arquivo nao corresponde a um PDF valido.');
  return true;
}

function uploadWithProgress(storageRef, file, onProgress) {
  return new Promise((resolve, reject) => {
    const task = uploadBytesResumable(storageRef, file, {
      contentType: 'application/pdf',
      customMetadata: { originalName: String(file.name || 'documento.pdf').slice(0, 180) },
    });
    task.on('state_changed', (snapshot) => {
      if (typeof onProgress === 'function') {
        onProgress(snapshot.totalBytes ? snapshot.bytesTransferred / snapshot.totalBytes : 0);
      }
    }, reject, () => resolve(task.snapshot));
  });
}

async function uploadPdfDocument(userId, file, options = {}) {
  if (!userId || auth.currentUser?.uid !== userId) throw new Error('Usuario autenticado invalido para upload.');
  const limits = await getClientProductLimits();
  await validatePdfFile(file, limits);
  const documentRef = doc(collection(db, 'users', userId, 'documents'));
  const safeName = sanitizeFileName(file.name);
  const storagePath = `user_uploads/${userId}/documents/${documentRef.id}/${safeName}`;
  const objectRef = ref(storage, storagePath);
  await uploadWithProgress(objectRef, file, options.onProgress);
  try {
    await setDoc(documentRef, {
      userId,
      name: safeName,
      fileType: 'pdf',
      storagePath,
      fileSizeBytes: file.size,
      status: 'pending',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    await deleteObject(objectRef).catch(() => {});
    throw error;
  }
  const processFn = httpsCallable(functions, 'processUserDocument', { timeout: 540000 });
  const result = await processFn({ documentId: documentRef.id });
  return { id: documentRef.id, ...result.data };
}

async function listUserDocuments(userId) {
  if (!userId) throw new Error('userId e obrigatorio.');
  const snapshot = await getDocs(query(collection(db, 'users', userId, 'documents'), orderBy('createdAt', 'desc')));
  return snapshot.docs.map(mapDocument);
}

async function reprocessUserDocument(documentId) {
  if (!documentId) throw new Error('documentId e obrigatorio.');
  const processFn = httpsCallable(functions, 'processUserDocument', { timeout: 540000 });
  return (await processFn({ documentId, force: true })).data;
}

function subscribeUserDocuments(userId, onData, onError) {
  if (!userId) throw new Error('userId e obrigatorio.');
  const documentsQuery = query(collection(db, 'users', userId, 'documents'), orderBy('createdAt', 'desc'));
  return onSnapshot(documentsQuery, (snapshot) => {
    onData(snapshot.docs.map(mapDocument));
  }, onError);
}

async function deleteUserDocument(documentId) {
  if (!documentId) throw new Error('documentId e obrigatorio.');
  const deleteFn = httpsCallable(functions, 'deleteUserDocument');
  return (await deleteFn({ documentId })).data;
}

export {
  deleteUserDocument,
  getClientProductLimits,
  listUserDocuments,
  mapDocument,
  reprocessUserDocument,
  sanitizeFileName,
  subscribeUserDocuments,
  uploadPdfDocument,
  validatePdfFile,
};
