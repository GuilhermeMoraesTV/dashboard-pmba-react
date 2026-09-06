import { httpsCallable } from 'firebase/functions';
import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { db, auth, storage, functions, firebaseHttpFunctionUrl } from '../../firebaseConfig.js';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { createSupportAttempt, hasAnimation, SUPPORT_LIMITS } from './supportCore.js';

const call = (name) => async (data) => (await httpsCallable(functions, name)(data)).data;

export async function validateLocalImage(file) {
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (hasAnimation(bytes, file.type)) throw new Error('Imagens animadas não são permitidas.');
  const bitmap = await createImageBitmap(file);
  const pixels = bitmap.width * bitmap.height;
  bitmap.close();
  if (pixels > SUPPORT_LIMITS.maxPixels) throw new Error('A imagem deve ter até 25 megapixels.');
}

async function prepare(files) {
  const prepared = [];
  for (const file of files) {
    const bytes = await file.arrayBuffer();
    const sha256 = Array.from(
      new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)),
      (b) => b.toString(16).padStart(2, '0')
    ).join('');
    const base64 = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result).split(',')[1]);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
    prepared.push({ id: `a${prepared.length}`, contentType: file.type, size: file.size, sha256, base64 });
  }
  return prepared;
}

export async function manageSupportTicket(data) {
  try {
    return await call('manageSupportTicket')(data);
  } catch (err) {
    const { ticketId, action, status, messageId, text, read, typing, role, admin } = data || {};
    const user = auth.currentUser;
    if (!ticketId || !user) throw err;
    const ticketDocRef = doc(db, 'system_feedback', ticketId);

    if (action === 'presence') {
      const updateData = {};
      const currentRole = role || (admin ? 'admin' : 'user');
      if (typeof read === 'boolean') {
        if (currentRole === 'admin') updateData.unreadAdmin = false;
        else updateData.unreadUser = false;
      }
      if (typeof typing === 'boolean') {
        if (currentRole === 'admin') updateData.adminTyping = typing;
        else updateData.userTyping = typing;
      }
      if (Object.keys(updateData).length) await updateDoc(ticketDocRef, updateData).catch(() => {});
      return { ok: true };
    }

    if (action === 'status') {
      await updateDoc(ticketDocRef, {
        status,
        lastUpdate: serverTimestamp(),
      });
      return { ok: true, status };
    }

    if (action === 'deleteTicket') {
      await deleteDoc(ticketDocRef);
      return { ok: true };
    }

    if (action === 'edit' && messageId) {
      await updateDoc(doc(db, 'system_feedback', ticketId, 'messages', messageId), {
        text,
        editedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      return { ok: true };
    }

    if (action === 'deleteMessage' && messageId) {
      await updateDoc(doc(db, 'system_feedback', ticketId, 'messages', messageId), {
        deleted: true,
        text: 'Mensagem removida.',
        updatedAt: serverTimestamp(),
      });
      return { ok: true };
    }

    throw err;
  }
}

async function clientDirectSend(draft) {
  const user = auth.currentUser;
  if (!user) throw new Error('Faça login novamente para enviar mensagens.');
  const text = String(draft.text || '');
  const files = draft.files || [];
  const sender = draft.sender || (draft.admin || draft.role === 'admin' ? 'admin' : 'user');

  const tempTicketId = draft.ticketId || `ticket_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const messageTempId = `msg_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

  const attachments = [];
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const attachmentId = `a${i}_${Date.now()}`;
    const path = `support_attachments/${tempTicketId}/${messageTempId}/${attachmentId}`;
    let downloadUrl = '';

    try {
      const fileRef = storageRef(storage, path);
      const snapshot = await uploadBytes(fileRef, file, {
        contentType: file.type,
      });
      downloadUrl = await getDownloadURL(snapshot.ref);
    } catch (storageErr) {
      console.warn('[Suporte] Falha no upload Storage direto, usando imagem redimensionada:', storageErr?.message || storageErr);
      try {
        const bmp = await createImageBitmap(file);
        const scale = Math.min(1, 600 / Math.max(bmp.width, bmp.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(bmp.width * scale);
        canvas.height = Math.round(bmp.height * scale);
        const ctx = canvas.getContext('2d');
        ctx.drawImage(bmp, 0, 0, canvas.width, canvas.height);
        bmp.close();
        downloadUrl = canvas.toDataURL('image/jpeg', 0.6);
      } catch (_) {}
    }

    let width = 800;
    let height = 600;
    try {
      const bmp = await createImageBitmap(file);
      width = bmp.width;
      height = bmp.height;
      bmp.close();
    } catch (_) {}

    attachments.push({
      id: attachmentId,
      url: downloadUrl,
      directUrl: downloadUrl,
      path,
      contentType: file.type,
      size: file.size,
      thumbnail: { width: Math.min(width, 480), height: Math.min(height, 480) },
      image: { width, height },
    });
  }

  let ticketId = draft.ticketId;
  const timestamp = serverTimestamp();
  const previewText = text.slice(0, 80) || (attachments.length ? 'Anexo enviado' : '');

  if (!ticketId) {
    const ticketDoc = await addDoc(collection(db, 'system_feedback'), {
      uid: user.uid,
      userName: user.displayName || 'Usuário',
      userEmail: user.email || '',
      type: draft.type || 'duvida',
      preview: previewText,
      status: 'pendente',
      timestamp,
      lastUpdate: timestamp,
      unreadAdmin: sender === 'user',
      unreadUser: sender === 'admin',
      userTyping: false,
      adminTyping: false,
      deleted: false,
    });
    ticketId = ticketDoc.id;
  } else {
    const updatePayload = {
      lastUpdate: timestamp,
      preview: previewText,
    };
    if (sender === 'admin') {
      updatePayload.unreadUser = true;
      updatePayload.unreadAdmin = false;
      updatePayload.adminTyping = false;
    } else {
      updatePayload.unreadAdmin = true;
      updatePayload.unreadUser = false;
      updatePayload.userTyping = false;
    }
    await updateDoc(doc(db, 'system_feedback', ticketId), updatePayload).catch(() => {});
  }

  const messageDoc = await addDoc(collection(db, 'system_feedback', ticketId, 'messages'), {
    text,
    sender,
    senderUid: user.uid,
    timestamp,
    attachments,
    hasAttachments: attachments.length > 0,
    deleted: false,
  });

  return { ticketId, messageId: messageDoc.id };
}

export const supportAttempt = () => {
  const primary = createSupportAttempt({
    reserve: call('reserveSupportMessage'),
    upload: call('uploadSupportAttachment'),
    finalize: call('finalizeSupportMessage'),
    prepare,
  });

  return {
    reset: primary.reset,
    send: async (draft, progress = () => {}) => {
      try {
        return await primary.send(draft, progress);
      } catch (err) {
        const code = String(err?.code || '').toLowerCase();
        const msg = String(err?.message || '').toLowerCase();
        const isBackendMissing =
          code.includes('not-found') ||
          code.includes('unavailable') ||
          code.includes('internal') ||
          msg.includes('internal') ||
          msg.includes('not found') ||
          msg.includes('não foi possível');

        if (isBackendMissing) {
          console.warn('[Suporte] Enviando via gravação direta no Firestore...');
          return await clientDirectSend(draft);
        }
        throw err;
      }
    },
  };
};

export async function loadSupportImage(data, signal) {
  if (data?.directUrl || data?.dataUrl) {
    const res = await fetch(data.directUrl || data.dataUrl);
    return res.blob();
  }

  const user = auth.currentUser;
  if (!user) throw new Error('Entre novamente para ver esta imagem.');
  const token = await user.getIdToken();
  const url = new URL(firebaseHttpFunctionUrl('readSupportAttachment'));
  Object.entries(data || {}).forEach(([key, value]) => {
    if (value && typeof value === 'string') url.searchParams.set(key, value);
  });

  const response = await fetch(url, { headers: { Authorization: `Bearer ${token}` }, signal, cache: 'no-store' });
  if (!response.ok) {
    if (data?.url) {
      const direct = await fetch(data.url, { signal });
      if (direct.ok) return direct.blob();
    }
    throw new Error(response.status === 404 ? 'Imagem expirada ou excluída.' : 'Não foi possível carregar a imagem.');
  }
  return response.blob();
}
