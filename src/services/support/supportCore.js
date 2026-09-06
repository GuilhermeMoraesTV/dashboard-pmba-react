import { DEFAULT_PRODUCT_LIMITS } from '../../config/productLimits.js';
export const SUPPORT_LIMITS = DEFAULT_PRODUCT_LIMITS.support;
export function validateSupportFiles(files) {
  if (files.length > SUPPORT_LIMITS.maxAttachments) throw new Error('Selecione no máximo 3 imagens.');
  for (const file of files) {
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) throw new Error('Use JPEG, PNG ou WebP estático.');
    if (!file.size || file.size > SUPPORT_LIMITS.maxImageBytes) throw new Error('Cada imagem deve ter até 5 MB.');
  }
}
export function hasAnimation(bytes, type) {
  const ascii = (offset, count) => String.fromCharCode(...bytes.subarray(offset, offset + count));
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (type === 'image/png') for (let offset = 8; offset + 12 <= bytes.length;) {
    if (ascii(offset + 4, 4) === 'acTL') return true;
    offset += 12 + view.getUint32(offset);
  }
  if (type === 'image/webp') for (let offset = 12; offset + 8 <= bytes.length;) {
    if (['ANIM','ANMF'].includes(ascii(offset, 4))) return true;
    const size = view.getUint32(offset + 4, true); offset += 8 + size + (size % 2);
  }
  return false;
}
export function shouldSendOnEnter(event, coarsePointer) {
  return event.key === 'Enter' && !event.shiftKey && !event.isComposing && !coarsePointer;
}
// Ordered transitions prevent a delayed 'true' from overtaking 'false'.
export function createTypingTransitions(write) {
  let state = false, tail = Promise.resolve();
  return (next) => {
    if (state === next) return tail;
    state = next;
    tail = tail.catch(() => {}).then(() => write(next));
    return tail;
  };
}
export const timestampMs = (value) => value?.toMillis?.() || (value?.seconds ? value.seconds * 1000 : 0);
export function attachmentsExpired(ticket, message, now = Date.now()) {
  return !!(ticket.deleted || message.deleted || message.attachmentsExpired
    || (timestampMs(ticket.attachmentsExpireAt) && timestampMs(ticket.attachmentsExpireAt) <= now)
    || (timestampMs(ticket.attachmentsExpiredThrough) && timestampMs(message.timestamp) <= timestampMs(ticket.attachmentsExpiredThrough)));
}
// The controller owns the immutable attempt; a retry executes only unfinished steps.
export function createSupportAttempt({ reserve, upload, finalize, prepare, clock = Date.now, uuid = () => crypto.randomUUID() }) {
  let attempt, pending;
  return {
    reset() { if (pending) throw new Error('Aguarde o envio.'); attempt = null; },
    send(draft, progress = () => {}) {
      if (pending) return pending;
      pending = (async () => {
        if (!attempt) {
          validateSupportFiles(draft.files);
          attempt = { ...draft, files: [...draft.files], operationId: `${clock()}_${uuid()}`, completed: new Set() };
        }
        const current = attempt;
        if (!current.prepared) current.prepared = await prepare(current.files);
        const payload = { operationId: current.operationId, ticketId: current.ticketId || null, text: current.text, type: current.type || 'duvida' };
        if (current.files.length && !current.reserved) {
          const result = await reserve({ ...payload, files: current.prepared.map(({ base64: _bytes, ...file }) => file) });
          current.reserved = true;
          (result.completed || []).forEach((key) => current.completed.add(key));
        }
        for (const file of current.prepared) {
          if (current.completed.has(file.id)) continue;
          progress({ done: current.completed.size, total: current.files.length, stage: 'Enviando e validando' });
          await upload({ ...payload, attachmentId: file.id, base64: file.base64 });
          current.completed.add(file.id);
        }
        progress({ done: current.files.length, total: current.files.length, stage: 'Publicando mensagem' });
        const result = await finalize({ ...payload, withAttachments: current.files.length > 0 });
        attempt = null;
        return result;
      })().finally(() => { pending = null; });
      return pending;
    },
  };
}
export function createPrivateImageCache(load, urls = URL) {
  const entries = new Map();
  let disposed = false;
  const revoke = (entry) => { entry.controller.abort(); if (entry.url) urls.revokeObjectURL(entry.url); };
  return {
    get(key, data) {
      if (disposed) return Promise.reject(new Error('Conversa fechada.'));
      if (!entries.has(key)) {
        const entry = { controller: new AbortController() };
        entry.promise = load(data, entry.controller.signal).then((blob) => {
          if (disposed || entries.get(key) !== entry) throw new Error('Conversa fechada.');
          entry.url = urls.createObjectURL(blob); return entry.url;
        }).catch((error) => { if (entries.get(key) === entry) entries.delete(key); throw error; });
        entries.set(key, entry);
      }
      return entries.get(key).promise;
    },
    invalidate(prefix) { for (const [key, entry] of entries) if (key.startsWith(prefix)) { revoke(entry); entries.delete(key); } },
    dispose() { disposed = true; entries.forEach(revoke); entries.clear(); },
  };
}
