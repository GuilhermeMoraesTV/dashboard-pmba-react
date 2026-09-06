/** @fileoverview Upload direto e importacao server-side de pacotes Anki. */

import { collection, doc } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { ref, uploadBytesResumable } from 'firebase/storage';
import { auth, db, functions, storage } from '../../firebaseConfig.js';
import { getClientProductLimits } from '../documents/documentsService.js';

function sanitizeApkgName(name) {
  const safe = String(name || 'deck.apkg').normalize('NFC')
    .replace(/[\\/\u0000-\u001F\u007F]/g, '_')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 180);
  return safe.toLowerCase().endsWith('.apkg') ? safe : `${safe || 'deck'}.apkg`;
}

async function validateApkgFile(file, limits) {
  if (!(file instanceof Blob) || file.size <= 0) throw new Error('Selecione um arquivo .apkg valido.');
  if (file.size > limits.storage.maxApkgSizeBytes) throw new Error('O APKG excede o limite de tamanho permitido.');
  if (!String(file.name || '').toLowerCase().endsWith('.apkg')) throw new Error('O arquivo deve possuir extensao .apkg.');
  const signature = new Uint8Array(await file.slice(0, 4).arrayBuffer());
  if (String.fromCharCode(...signature).slice(0, 2) !== 'PK') throw new Error('O arquivo nao possui assinatura ZIP/APKG valida.');
}

function buildApkgStoragePath(userId, importId) {
  return `user_uploads/${userId}/anki_imports/${importId}/package.apkg`;
}

function normalizeFolderName(value) {
  return String(value || '').normalize('NFC').trim().replace(/\s+/g, ' ').toLocaleLowerCase('pt-BR');
}

function findReusableAnkiFolder(folders, requestedName) {
  const normalizedName = normalizeFolderName(requestedName);
  if (!normalizedName) return null;
  const candidates = (folders || []).filter((folder) => (
    folder?.id
    && !folder.parentFolderId
    && folder.archived !== true
    && normalizeFolderName(folder.name) === normalizedName
    && normalizeFolderName(folder.description) === 'importado do anki'
  ));
  if (!candidates.length) return null;
  return [...candidates].sort((left, right) => {
    const leftDescendants = (folders || []).filter((folder) => folder.ancestorFolderIds?.includes(left.id)).length;
    const rightDescendants = (folders || []).filter((folder) => folder.ancestorFolderIds?.includes(right.id)).length;
    return rightDescendants - leftDescendants;
  })[0];
}

function uploadApkg(storageRef, file, originalName, onProgress) {
  return new Promise((resolve, reject) => {
    const task = uploadBytesResumable(storageRef, file, {
      contentType: 'application/zip',
      customMetadata: { originalName },
    });
    task.on('state_changed', (snapshot) => {
      onProgress?.(snapshot.totalBytes ? snapshot.bytesTransferred / snapshot.totalBytes : 0);
    }, reject, () => resolve(task.snapshot));
  });
}

async function importAnkiPackage(userId, file, options = {}) {
  if (!userId || auth.currentUser?.uid !== userId) throw new Error('Usuario autenticado invalido para importacao.');
  if (!String(options.folderId || '').trim()) throw new Error('Selecione uma Pasta de Estudos para importar o APKG.');
  const limits = await getClientProductLimits();
  await validateApkgFile(file, limits);
  const importRef = doc(collection(db, 'users', userId, 'anki_imports'));
  const safeName = sanitizeApkgName(file.name);
  const storagePath = buildApkgStoragePath(userId, importRef.id);
  await uploadApkg(ref(storage, storagePath), file, safeName, options.onProgress);
  const importFn = httpsCallable(functions, 'importAnkiPackage', { timeout: 540000 });
  const result = await importFn({
    importId: importRef.id,
    storagePath,
    originalName: safeName,
    folderId: String(options.folderId).trim(),
  });
  return result.data;
}

export { buildApkgStoragePath, findReusableAnkiFolder, importAnkiPackage, sanitizeApkgName, validateApkgFile };
