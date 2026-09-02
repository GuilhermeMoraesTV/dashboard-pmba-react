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

function uploadApkg(storageRef, file, onProgress) {
  return new Promise((resolve, reject) => {
    const task = uploadBytesResumable(storageRef, file, {
      contentType: 'application/zip',
      customMetadata: { originalName: String(file.name || 'deck.apkg').slice(0, 180) },
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
  const storagePath = `user_uploads/${userId}/anki_imports/${importRef.id}/${safeName}`;
  await uploadApkg(ref(storage, storagePath), file, options.onProgress);
  try {
    const importFn = httpsCallable(functions, 'importAnkiPackage', { timeout: 540000 });
    const result = await importFn({
      importId: importRef.id,
      storagePath,
      originalName: safeName,
      folderId: String(options.folderId).trim(),
    });
    return result.data;
  } catch (err) {
    const idToken = await auth.currentUser?.getIdToken();
    if (!idToken) throw err;
    const directRes = await fetch('https://importankipackage-oxsjiftliq-uc.a.run.app', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${idToken}`,
      },
      body: JSON.stringify({
        data: {
          importId: importRef.id,
          storagePath,
          originalName: safeName,
          folderId: String(options.folderId).trim(),
        },
      }),
    });
    const directJson = await directRes.json().catch(() => ({}));
    if (directJson?.error) {
      throw new Error(directJson.error.message || err.message || 'Falha ao importar Anki.');
    }
    if (directJson?.result) return directJson.result;
    throw err;
  }
}

export { importAnkiPackage, sanitizeApkgName, validateApkgFile };
