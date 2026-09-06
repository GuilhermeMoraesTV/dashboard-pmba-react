// Instrumented, atomic test double. Integration tests additionally run the same
// service against the real Firestore Emulator; this double measures operations.
export function ankiMemoryDb() {
  const documents = new Map();
  const stats = { reads: 0, writes: 0, cardWrites: 0, indexWrites: 0, commits: 0, maxBatch: 0 };
  let failCardCommit = 0, cardCommits = 0;
  const snapshot = (ref) => {
    const value = documents.get(ref.path);
    return { id: ref.id, ref, exists: value !== undefined, data: () => structuredClone(value) };
  };
  function collection(path, filter = null) {
    return {
      path, id: path.split('/').at(-1), get parent() { return doc(path.split('/').slice(0, -1).join('/')); },
      doc(id) { return doc(`${path}/${id}`); },
      where(_field, _operator, ids) { return collection(path, new Set(ids)); },
      async get() {
        const docs = [...documents.keys()].filter((key) => key.startsWith(`${path}/`)
          && key.split('/').length === path.split('/').length + 1 && (!filter || filter.has(key.split('/').at(-1))))
          .map((key) => snapshot(doc(key)));
        stats.reads += Math.max(1, docs.length);
        return { docs, size: docs.length };
      },
      count() { return { get: async () => {
        const size = [...documents.keys()].filter((key) => key.startsWith(`${path}/`)
          && key.split('/').length === path.split('/').length + 1).length;
        stats.reads += Math.max(1, Math.ceil(size / 1000));
        return { data: () => ({ count: size }) };
      } }; },
    };
  }
  function doc(path) {
    return {
      path, id: path.split('/').at(-1), get parent() { return collection(path.split('/').slice(0, -1).join('/')); },
      collection(name) { return collection(`${path}/${name}`); },
      async get() { stats.reads++; return snapshot(this); },
      async set(data, options) { const b = batch(); b.set(this, data, options); await b.commit(); },
      async update(data) { const b = batch(); b.update(this, data); await b.commit(); },
    };
  }
  function batch() {
    const ops = [];
    const b = {
      set(ref, data, options) { ops.push({ ref, data, type: options?.merge ? 'merge' : 'set' }); return b; },
      create(ref, data) { ops.push({ ref, data, type: 'create' }); return b; },
      update(ref, data) { ops.push({ ref, data, type: 'update' }); return b; },
      delete(ref) { ops.push({ ref, type: 'delete' }); return b; },
      async commit() {
        if (ops.some((op) => /\/cards\//.test(op.ref.path))) {
          cardCommits++;
          if (cardCommits === failCardCommit) throw Object.assign(new Error('injected failure'), { code: 'unavailable' });
        }
        if (ops.length > 500) throw new Error('batch > 500');
        for (const op of ops) {
          if (op.type === 'create' && documents.has(op.ref.path)) throw new Error('already exists');
          if (op.type === 'update' && !documents.has(op.ref.path)) throw new Error('not found');
        }
        stats.maxBatch = Math.max(stats.maxBatch, ops.length); stats.commits++;
        for (const op of ops) {
          stats.writes++;
          if (/\/cards\//.test(op.ref.path)) stats.cardWrites++;
          if (/\/anki_card_index\//.test(op.ref.path)) stats.indexWrites++;
          if (op.type === 'delete') { documents.delete(op.ref.path); continue; }
          const previous = documents.get(op.ref.path) || {};
          const value = op.type === 'merge' || op.type === 'update' ? { ...previous } : {};
          for (const [key, field] of Object.entries(op.data)) {
            if (field?.op === 'delete') delete value[key];
            else if (field?.op === 'increment') value[key] = (previous[key] || 0) + field.by;
            else value[key] = structuredClone(field);
          }
          documents.set(op.ref.path, value);
        }
        return ops.map(() => ({ writeTime: Date.now() }));
      },
    };
    return b;
  }
  let transactionTail = Promise.resolve();
  const db = {
    collection, batch,
    async getAll(...refs) { return Promise.all(refs.map((ref) => ref.get())); },
    runTransaction(callback) {
      const result = transactionTail.then(async () => {
        const b = batch();
        const response = await callback({ ...b, get: (ref) => ref.get() });
        await b.commit(); return response;
      });
      transactionTail = result.catch(() => {}); return result;
    },
  };
  const firestore = Object.assign(() => db, {
    FieldValue: { serverTimestamp: () => new Date(), increment: (by) => ({ op: 'increment', by }), delete: () => ({ op: 'delete' }) },
    FieldPath: { documentId: () => '__name__' },
    Timestamp: { now: () => new Date() },
  });
  return { db, firestore, documents, stats, failOnCardCommit: (n) => { failCardCommit = n; cardCommits = 0; } };
}
