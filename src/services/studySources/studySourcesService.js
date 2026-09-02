/** @fileoverview Cliente das Pastas e Fontes de Estudo; mutacoes sensiveis passam por Callables. */

import { collection, onSnapshot, orderBy, query } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { ref, uploadBytesResumable } from 'firebase/storage';
import { auth, db, functions, storage } from '../../firebaseConfig.js';
import { getClientProductLimits, sanitizeFileName, validatePdfFile } from '../documents/documentsService.js';

function toDate(value) {
  if (value?.toDate) return value.toDate();
  if (value instanceof Date) return value;
  if (value) {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }
  return null;
}

function mapSnapshot(snapshot) {
  const data = snapshot.data() || {};
  return { id: snapshot.id, ...data, createdAt: toDate(data.createdAt), updatedAt: toDate(data.updatedAt), readyAt: toDate(data.readyAt) };
}

export function subscribeStudyFolders(userId, onData, onError) {
  if (!userId) return () => {};
  return onSnapshot(query(collection(db, 'users', userId, 'study_folders'), orderBy('order', 'asc')), (snapshot) => {
    onData(snapshot.docs.map(mapSnapshot).filter((folder) => !folder.archived));
  }, onError);
}

export function subscribeStudySources(userId, onData, onError) {
  if (!userId) return () => {};
  return onSnapshot(query(collection(db, 'users', userId, 'study_sources'), orderBy('createdAt', 'desc')), (snapshot) => {
    onData(snapshot.docs.map(mapSnapshot));
  }, onError);
}

export async function createStudyFolder(data) {
  const callable = httpsCallable(functions, 'createStudyFolder');
  return (await callable(data)).data.folder;
}

export async function createStudyFolderTree(data) {
  const callable = httpsCallable(functions, 'createStudyFolderTree');
  return (await callable(data)).data;
}

export async function updateStudyFolder(folderId, data) {
  const callable = httpsCallable(functions, 'updateStudyFolder');
  return (await callable({ folderId, data })).data;
}

export async function deleteStudyFolder(folderId) {
  const callable = httpsCallable(functions, 'deleteStudyFolder');
  return (await callable({ folderId })).data;
}

export async function updateStudySourceTitle(sourceId, title) {
  const callable = httpsCallable(functions, 'updateStudySourceTitle');
  return (await callable({ sourceId, title })).data;
}

export async function ensureLegacyStudyFolder() {
  const callable = httpsCallable(functions, 'ensureLegacyStudyFolder', { timeout: 540000 });
  return (await callable({})).data;
}

export async function createNoteStudySource({ folderId, title, content }) {
  const callable = httpsCallable(functions, 'createNoteStudySource', { timeout: 540000 });
  return (await callable({ folderId, title, content })).data;
}

export async function deleteStudySource(sourceId) {
  const callable = httpsCallable(functions, 'deleteStudySource', { timeout: 540000 });
  return (await callable({ sourceId })).data;
}

function upload(storageRef, file, onProgress) {
  return new Promise((resolve, reject) => {
    const task = uploadBytesResumable(storageRef, file, { contentType: 'application/pdf', customMetadata: { originalName: file.name.slice(0, 180) } });
    task.on('state_changed', (snapshot) => {
      onProgress?.(snapshot.totalBytes ? snapshot.bytesTransferred / snapshot.totalBytes : 0);
    }, reject, () => resolve(task.snapshot));
  });
}

export async function uploadDocumentStudySource(userId, { folderId, title, file, onProgress }) {
  if (!userId || auth.currentUser?.uid !== userId) throw new Error('Usuario autenticado invalido para upload.');
  const limits = await getClientProductLimits();
  await validatePdfFile(file, limits);
  const safeName = sanitizeFileName(file.name);
  const prepare = httpsCallable(functions, 'prepareDocumentStudySource', { timeout: 540000 });
  const prepared = (await prepare({ folderId, title, originalName: safeName, fileSizeBytes: file.size })).data;
  try {
    await upload(ref(storage, prepared.storagePath), file, onProgress);
    const process = httpsCallable(functions, 'processUserDocument', { timeout: 540000 });
    await process({ documentId: prepared.documentId });
    return { ...prepared, status: 'ready' };
  } catch (error) {
    const markError = httpsCallable(functions, 'markStudySourceError');
    await markError({ sourceId: prepared.sourceId, message: error?.message || 'Falha no upload/processamento.' }).catch(() => {});
    throw error;
  }
}
