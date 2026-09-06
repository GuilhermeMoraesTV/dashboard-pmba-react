const crypto = require('node:crypto');
const { HttpsError } = require('firebase-functions/v2/https');
const { Timestamp } = require('firebase-admin/firestore');
const { DEFAULT_SERVER_PRODUCT_LIMITS } = require('../shared/productLimits');
const { normalizeSupportImage } = require('../security/imageUpload');
const L = DEFAULT_SERVER_PRODUCT_LIMITS.support;
const stamp = (ms) => Timestamp.fromMillis(ms);
const millis = (value) => value?.toMillis?.() || 0;
const fail = (code, message) => { throw new HttpsError(code, message); };
const id = (value) => {
  if (!/^[a-zA-Z0-9_-]{1,128}$/.test(value || '')) fail('invalid-argument', 'Identificador inválido.');
  return value;
};
const digest = (value) => crypto.createHash('sha256').update(value).digest('hex');
const adminAccess = (uid, profile) => uid === 'OLoJi457GQNE2eTSOcz9DAD6ppZ2'
  || profile?.access?.permissions?.adminPanel === true
  || ['admin', 'super_admin'].includes(profile?.access?.adminRole) || profile?.access?.role === 'admin';
const checkTicket = (ticket, actor, writable = false) => {
  if (!ticket || ticket.deleted) fail('not-found', 'Chamado indisponível.');
  if (ticket.uid !== actor.uid && !actor.admin) fail('permission-denied', 'Acesso negado.');
  if (writable && ticket.status === 'resolvido') fail('failed-precondition', 'Chamado resolvido.');
};
const validateText = (text, required) => {
  if (typeof text !== 'string' || text.length > L.maxTextChars || (required && !text.trim())) {
    fail('invalid-argument', 'Informe a descrição, com até 12.000 caracteres.');
  }
  return text; // Deliberately preserve all whitespace.
};
function identity(uid, operationId, now) {
  id(operationId);
  const created = Number(operationId.split('_')[0]);
  if (!Number.isSafeInteger(created) || created > now + 60000 || now - created >= L.operationTtlMs) {
    fail('failed-precondition', 'Envio expirado. Inicie um novo envio.');
  }
  const key = digest(`${uid}:${operationId}`);
  return { key, messageId: key, newTicketId: key };
}
function manifest(files) {
  if (!Array.isArray(files) || files.length < 1 || files.length > L.maxAttachments) fail('invalid-argument', 'Selecione até 3 imagens.');
  const result = files.map((f) => {
    if (!Number.isInteger(f.size) || f.size < 1 || f.size > L.maxImageBytes
      || !['image/jpeg', 'image/png', 'image/webp'].includes(f.contentType)
      || !/^[a-f0-9]{64}$/.test(f.sha256 || '')) fail('invalid-argument', 'Imagem inválida ou acima de 5 MB.');
    return { id: id(f.id), size: f.size, contentType: f.contentType, sha256: f.sha256 };
  });
  if (new Set(result.map((f) => f.id)).size !== result.length) fail('invalid-argument', 'Identificador repetido.');
  return result;
}

function createSupportService({ db, bucket, now = Date.now, normalize = normalizeSupportImage }) {
  const ticketRef = (ticketId) => db.collection('system_feedback').doc(id(ticketId));
  const opRef = (key) => db.collection('support_operations').doc(key);
  const actor = async (tx, auth) => {
    if (!auth?.uid) fail('unauthenticated', 'Autenticação obrigatória.');
    const profile = (await tx.get(db.collection('users').doc(auth.uid))).data();
    return { uid: auth.uid, admin: adminAccess(auth.uid, profile), name: profile?.displayName || auth.token?.name || 'Usuário', email: auth.token?.email || '' };
  };
  const requestIdentity = (auth, data) => {
    if (!auth?.uid) fail('unauthenticated', 'Autenticação obrigatória.');
    const ident = identity(auth.uid, data.operationId, now());
    return { ...ident, ticketId: data.ticketId ? id(data.ticketId) : ident.newTicketId, opening: !data.ticketId };
  };
  async function reserve(auth, data) {
    const ident = requestIdentity(auth, data);
    const files = manifest(data.files);
    const text = validateText(data.text, ident.opening);
    const type = ['edital', 'ideia', 'bug', 'duvida'].includes(data.type) ? data.type : 'duvida';
    const fingerprint = digest(JSON.stringify({ files, text, type, ticketId: ident.ticketId, opening: ident.opening }));
    return db.runTransaction(async (tx) => {
      const who = await actor(tx, auth);
      const ref = opRef(ident.key);
      const op = (await tx.get(ref)).data();
      const message = (await tx.get(ticketRef(ident.ticketId).collection('messages').doc(ident.messageId))).data();
      if (message) {
        if (message.deleted || message.fingerprint !== fingerprint) fail('failed-precondition', 'Envio já utilizado.');
        return { ...ident, committed: true, completed: files.map((f) => f.id) };
      }
      const ticket = (await tx.get(ticketRef(ident.ticketId))).data();
      if (!ident.opening) checkTicket(ticket, who, true);
      else if (ticket) fail('already-exists', 'Chamado já existente.');
      if (op) {
        if (op.fingerprint !== fingerprint || op.cancelled) fail('failed-precondition', 'Envio já reservado com outro conteúdo.');
        return { ...ident, completed: Object.keys(op.attachments || {}) };
      }
      const quotaRef = db.collection('support_quotas').doc(who.uid);
      const quota = (await tx.get(quotaRef)).data() || {};
      const day = new Date(now()).toISOString().slice(0, 10);
      const starts = (quota.starts || []).filter((at) => at > now() - 60000);
      const used = quota.day === day ? quota.images || 0 : 0;
      if (starts.length >= L.operationsPerMinute || used + files.length > (who.admin ? L.adminDailyImages : L.userDailyImages)) {
        fail('resource-exhausted', 'Limite de imagens ou envios atingido. Aguarde antes de tentar novamente.');
      }
      tx.set(quotaRef, { day, images: used + files.length, starts: [...starts, now()], expiresAt: stamp(now() + 2 * L.operationTtlMs) });
      tx.create(ref, { ...ident, uid: who.uid, sender: who.admin && !ident.opening ? 'admin' : 'user', text, type, files, fingerprint,
        attachments: {}, expiresAt: stamp(now() + L.operationTtlMs), leaseUntil: stamp(0), committed: false });
      return { ...ident, completed: [] };
    });
  }

  async function upload(auth, data) {
    const ident = requestIdentity(auth, data);
    // Reject oversized transport before allocating a decoded buffer or invoking sharp.
    if (typeof data.base64 !== 'string' || data.base64.length > Math.ceil(L.maxImageBytes / 3) * 4) fail('invalid-argument', 'Imagem acima de 5 MB.');
    const attachmentId = id(data.attachmentId);
    const ref = opRef(ident.key);
    const lease = crypto.randomUUID();
    const operation = await db.runTransaction(async (tx) => {
      const who = await actor(tx, auth);
      const op = (await tx.get(ref)).data();
      if (!op || op.cancelled || op.uid !== who.uid || op.ticketId !== ident.ticketId) fail('not-found', 'Operação indisponível.');
      const ticket = (await tx.get(ticketRef(op.ticketId))).data();
      if (!op.opening || op.committed) checkTicket(ticket, who, true);
      else if (ticket) fail('failed-precondition', 'Chamado indisponível.');
      if (!op.files.some((f) => f.id === attachmentId)) fail('invalid-argument', 'Anexo não reservado.');
      if (op.attachments[attachmentId]) return { ...op, done: true };
      if (millis(op.leaseUntil) > now()) fail('aborted', 'Outro arquivo está sendo processado. Aguarde e repita.');
      tx.update(ref, { lease, leaseUntil: stamp(now() + L.leaseMs) });
      return op;
    });
    if (operation.done) return operation.attachments[attachmentId];
    try {
      const file = operation.files.find((f) => f.id === attachmentId);
      const buffer = Buffer.from(data.base64, 'base64');
      if (buffer.length !== file.size || digest(buffer) !== file.sha256) fail('invalid-argument', 'O arquivo mudou após a reserva.');
      const prefix = `support_attachments/${operation.ticketId}/${operation.messageId}/${attachmentId}`;
      const versions = {};
      // A crash after Storage commit can recover both versions without sharp.
      for (const variant of ['image', 'thumbnail']) {
        const path = `${prefix}/${variant}.webp`;
        try {
          const [exists] = await bucket.file(path).exists();
          if (exists) {
            const [meta] = await bucket.file(path).getMetadata();
            if (meta.metadata?.sha256 === file.sha256) {
              versions[variant] = { path, width: Number(meta.metadata.width), height: Number(meta.metadata.height), bytes: Number(meta.size) };
            }
          }
        } catch (_) { /* Continue and regenerate if check fails */ }
      }
      if (!versions.image || !versions.thumbnail) {
        const normalized = await normalize({ base64: data.base64, contentType: file.contentType });
        for (const variant of ['image', 'thumbnail']) {
          if (versions[variant]) continue;
          const value = normalized[variant];
          const path = `${prefix}/${variant}.webp`;
          await bucket.file(path).save(value.data, { resumable: false, metadata: { contentType: 'image/webp', cacheControl: 'private, no-store',
            metadata: { sha256: file.sha256, width: String(value.info.width), height: String(value.info.height) } } });
          versions[variant] = { path, width: value.info.width, height: value.info.height, bytes: value.data.length };
        }
      }
      const attachment = { id: attachmentId, ...versions };
      await db.runTransaction(async (tx) => {
        const op = (await tx.get(ref)).data();
        if (!op || op.lease !== lease || op.cancelled) fail('aborted', 'Operação interrompida.');
        tx.update(ref, { attachments: { ...op.attachments, [attachmentId]: attachment }, leaseUntil: stamp(0), lease: null });
      });
      return attachment;
    } catch (error) {
      await db.runTransaction(async (tx) => {
        const op = (await tx.get(ref)).data();
        if (op?.lease === lease) tx.update(ref, { leaseUntil: stamp(0), lease: null });
      });
      if (error.code === 'invalid-argument') fail('invalid-argument', error.message);
      throw error;
    }
  }

  async function finalize(auth, data) {
    const ident = requestIdentity(auth, data);
    const text = validateText(data.text, ident.opening || !data.withAttachments);
    return db.runTransaction(async (tx) => {
      const who = await actor(tx, auth);
      const tRef = ticketRef(ident.ticketId);
      const mRef = tRef.collection('messages').doc(ident.messageId);
      const previous = (await tx.get(mRef)).data();
      const ticket = (await tx.get(tRef)).data();
      if (previous) {
        checkTicket(ticket, who);
        if (previous.deleted || previous.senderUid !== who.uid || previous.text !== text) fail('failed-precondition', 'Envio já utilizado.');
        return ident;
      }
      if (ident.opening) { if (ticket) fail('already-exists', 'Chamado já existente.'); }
      else checkTicket(ticket, who, true);
      let attachments = [], op;
      if (data.withAttachments) {
        op = (await tx.get(opRef(ident.key))).data();
        if (!op || op.cancelled || op.uid !== who.uid || op.ticketId !== ident.ticketId || op.text !== text) fail('failed-precondition', 'Reserva inválida.');
        attachments = op.files.map((file) => op.attachments[file.id]);
        if (attachments.some((file) => !file)) fail('failed-precondition', 'Envie todos os anexos antes de publicar.');
      }
      const sender = ident.opening || !who.admin ? 'user' : 'admin';
      const timestamp = stamp(now());
      const message = { text, sender, senderUid: who.uid, timestamp, attachments, hasAttachments: !!attachments.length,
        fingerprint: op?.fingerprint || digest(text), deleted: false };
      tx.create(mRef, message);
      const fields = { lastUpdate: timestamp, unreadAdmin: sender === 'user', unreadUser: sender === 'admin', [`${sender}Typing`]: false };
      if (ident.opening) tx.create(tRef, { ...fields, uid: who.uid, userName: who.name, userEmail: who.email,
        type: op?.type || (['edital','bug','ideia','duvida'].includes(data.type) ? data.type : 'duvida'), preview: text.slice(0, 80),
        status: 'pendente', timestamp, userTyping: false, adminTyping: false, deleted: false });
      else tx.update(tRef, fields);
      if (op) tx.update(opRef(ident.key), { committed: true });
      return ident;
    });
  }

  async function manage(auth, data) {
    const tRef = ticketRef(data.ticketId);
    return db.runTransaction(async (tx) => {
      const who = await actor(tx, auth);
      const ticket = (await tx.get(tRef)).data();
      if (data.action === 'deleteTicket' && who.admin && (!ticket || ticket.deleted)) return { ok: true };
      checkTicket(ticket, who);
      if (data.action === 'presence') {
        const patch = {};
        const role = who.admin ? 'admin' : 'user';
        const unread = who.admin ? 'unreadAdmin' : 'unreadUser';
        if (data.read === true && ticket[unread] === true) patch[unread] = false;
        const typing = ticket.status !== 'resolvido' && data.typing === true;
        if (typeof data.typing === 'boolean' && Boolean(ticket[`${role}Typing`]) !== typing) patch[`${role}Typing`] = typing;
        if (Object.keys(patch).length) tx.update(tRef, patch);
      } else if (data.action === 'status') {
        if (!who.admin) fail('permission-denied', 'Somente administradores.');
        if (!['pendente', 'resolvido'].includes(data.status)) fail('invalid-argument', 'Status inválido.');
        if (ticket.status === data.status) return { ok: true };
        const expired = millis(ticket.attachmentsExpireAt) > 0 && millis(ticket.attachmentsExpireAt) <= now();
        const patch = { status: data.status, userTyping: false, adminTyping: false,
          attachmentsExpireAt: data.status === 'resolvido' ? stamp(now() + L.retentionMs) : null };
        if (expired) { patch.attachmentsExpiredThrough = ticket.attachmentsExpireAt; patch.cleanupBefore = ticket.attachmentsExpireAt; }
        tx.update(tRef, patch);
        if (data.status === 'resolvido') tx.create(tRef.collection('messages').doc(), {
          text: 'Este chamado foi marcado como resolvido.', sender: 'system', timestamp: stamp(now()), attachments: [], hasAttachments: false,
        });
      } else if (data.action === 'deleteTicket') {
        if (!who.admin) fail('permission-denied', 'Somente administradores.');
        tx.update(tRef, { deleted: true, status: 'excluido', unreadAdmin: false, unreadUser: false, cleanupAt: stamp(now() + L.operationTtlMs) });
      } else if (['edit', 'deleteMessage'].includes(data.action)) {
        const mRef = tRef.collection('messages').doc(id(data.messageId));
        const msg = (await tx.get(mRef)).data();
        if (!msg || msg.deleted) { if (data.action === 'deleteMessage') return { ok: true }; fail('not-found', 'Mensagem indisponível.'); }
        if (data.action === 'edit') {
          if (msg.senderUid !== who.uid) fail('permission-denied', 'Acesso negado.');
          const text = validateText(data.text, !(msg.attachments || []).length);
          if (msg.text !== text) tx.update(mRef, { text });
        } else {
          if (!who.admin) fail('permission-denied', 'Somente administradores.');
          tx.update(mRef, { deleted: true, text: '' });
          tx.set(db.collection('support_cleanup').doc(digest(mRef.path)), { ticketId: tRef.id, messageId: mRef.id,
            attachments: msg.attachments || [], expiresAt: stamp(now() + L.operationTtlMs) });
        }
      } else fail('invalid-argument', 'Ação inválida.');
      return { ok: true };
    });
  }

  async function read(auth, data) {
    if (!['image', 'thumbnail'].includes(data.variant)) fail('invalid-argument', 'Versão inválida.');
    const attachmentId = id(data.attachmentId);
    const file = await db.runTransaction(async (tx) => {
      const who = await actor(tx, auth);
      const tRef = ticketRef(data.ticketId);
      const ticket = (await tx.get(tRef)).data();
      checkTicket(ticket, who);
      const msg = (await tx.get(tRef.collection('messages').doc(id(data.messageId)))).data();
      if (!msg || msg.deleted || msg.attachmentsExpired || (millis(ticket.attachmentsExpireAt) && millis(ticket.attachmentsExpireAt) <= now())
        || (millis(ticket.attachmentsExpiredThrough) && millis(msg.timestamp) <= millis(ticket.attachmentsExpiredThrough))) fail('not-found', 'Imagem expirada ou excluída.');
      const value = (msg.attachments || []).find((a) => a.id === attachmentId)?.[data.variant];
      const expected = `support_attachments/${tRef.id}/${data.messageId}/${attachmentId}/${data.variant}.webp`;
      if (!value || value.path !== expected) fail('not-found', 'Imagem indisponível.');
      return value;
    });
    const [bytes] = await bucket.file(file.path).download();
    return bytes;
  }

  const removeFiles = async (attachments) => {
    for (const attachment of attachments || []) for (const variant of ['image', 'thumbnail']) {
      if (attachment?.[variant]?.path) await bucket.file(attachment[variant].path).delete({ ignoreNotFound: true });
    }
  };
  async function maintenance() {
    const summary = {};
    // Every queue is indexed and bounded. Failures remain queued for next run.
    const stage = async (name, task) => { try { summary[name] = await task(); } catch (error) { summary[name] = { error: error.code || 'internal' }; } };
    await stage('operations', async () => {
      const ops = await db.collection('support_operations').where('expiresAt', '<=', stamp(now())).limit(L.maintenanceBatch).get();
      for (const snap of ops.docs) {
        const op = snap.data();
        if (millis(op.leaseUntil) > now()) continue;
        if (!op.committed) {
          // Deterministic paths include versions saved before a crashed transaction.
          for (const file of op.files) for (const variant of ['image','thumbnail']) {
            await bucket.file(`support_attachments/${op.ticketId}/${op.messageId}/${file.id}/${variant}.webp`).delete({ ignoreNotFound: true });
          }
        }
        await snap.ref.delete();
      }
      return ops.size;
    });
    await stage('quotas', async () => {
      const expired = await db.collection('support_quotas').where('expiresAt', '<=', stamp(now())).limit(L.maintenanceBatch).get();
      for (const snap of expired.docs) await db.runTransaction(async (tx) => {
        const current = (await tx.get(snap.ref)).data();
        if (current && millis(current.expiresAt) <= now()) tx.delete(snap.ref);
      });
      return expired.size;
    });
    await stage('messages', async () => {
      const queued = await db.collection('support_cleanup').where('expiresAt', '<=', stamp(now())).limit(L.maintenanceBatch).get();
      for (const snap of queued.docs) {
        const data = snap.data(); await removeFiles(data.attachments);
        await ticketRef(data.ticketId).collection('messages').doc(data.messageId).delete(); await snap.ref.delete();
      }
      return queued.size;
    });
    await stage('expiration', async () => {
      const due = await db.collection('system_feedback').where('attachmentsExpireAt', '<=', stamp(now())).limit(L.maintenanceBatch).get();
      for (const snap of due.docs) await db.runTransaction(async (tx) => {
        const ticket = (await tx.get(snap.ref)).data();
        if (millis(ticket?.attachmentsExpireAt) && millis(ticket.attachmentsExpireAt) <= now()) {
          tx.update(snap.ref, { attachmentsExpireAt: null, attachmentsExpiredThrough: ticket.attachmentsExpireAt, cleanupBefore: ticket.attachmentsExpireAt });
        }
      });
      return due.size;
    });
    await stage('retention', async () => {
      const tickets = await db.collection('system_feedback').where('cleanupBefore', '>', stamp(0)).limit(L.maintenanceBatch).get();
      let budget = L.maintenanceBatch;
      for (const snap of tickets.docs) {
        if (!budget) break;
        const cutoff = snap.data().cleanupBefore;
        const msgs = await snap.ref.collection('messages').where('hasAttachments', '==', true).where('timestamp', '<=', cutoff).limit(budget).get();
        for (const msg of msgs.docs) { await removeFiles(msg.data().attachments); await msg.ref.update({ attachmentsExpired: true, hasAttachments: false }); }
        budget -= msgs.size;
        if (msgs.empty) await db.runTransaction(async (tx) => {
          const current = (await tx.get(snap.ref)).data();
          if (millis(current?.cleanupBefore) === millis(cutoff)) tx.update(snap.ref, { cleanupBefore: null });
        });
      }
      return L.maintenanceBatch - budget;
    });
    await stage('tickets', async () => {
      const tickets = await db.collection('system_feedback').where('cleanupAt', '<=', stamp(now())).limit(L.maintenanceBatch).get();
      let budget = L.maintenanceBatch;
      for (const snap of tickets.docs) {
        if (!budget) break;
        const msgs = await snap.ref.collection('messages').limit(budget).get();
        for (const msg of msgs.docs) { await removeFiles(msg.data().attachments); await msg.ref.delete(); }
        budget -= msgs.size;
        if (msgs.empty) await snap.ref.delete();
      }
      return L.maintenanceBatch - budget;
    });
    return summary;
  }
  return { reserve, upload, finalize, manage, read, maintenance };
}
module.exports = { createSupportService, manifest, identity, adminAccess };
