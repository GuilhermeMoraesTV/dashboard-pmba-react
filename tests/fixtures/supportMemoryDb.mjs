import { randomUUID } from 'node:crypto';
const clone = (value) => value?.toMillis ? value : Array.isArray(value) ? value.map(clone) : value && typeof value === 'object' ? Object.fromEntries(Object.entries(value).map(([k,v]) => [k,clone(v)])) : value;
export function supportMemoryDb() {
  const docs = new Map(), stats = { reads:0,writes:0 }, files = new Map(), storage = { reads:0,writes:0,deletes:0,bytes:0 };
  let queue = Promise.resolve();
  const snapshot = (ref) => ({ ref,id:ref.id,exists:docs.has(ref.path),data:() => clone(docs.get(ref.path)) });
  const doc = (path) => ({ path,id:path.split('/').at(-1),collection:(name) => collection(`${path}/${name}`),
    async get() { stats.reads++; return snapshot(this); }, async set(data) { stats.writes++; docs.set(path,clone(data)); },
    async update(data) { stats.writes++; docs.set(path,{...docs.get(path),...clone(data)}); }, async delete() { stats.writes++; docs.delete(path); } });
  const collection = (path, filters=[], cap=Infinity) => ({ path,doc:(key=randomUUID()) => doc(`${path}/${key}`),
    where:(field,op,value) => collection(path,[...filters,{field,op,value}],cap), limit:(size) => collection(path,filters,size),
    async get() {
      const rows = [...docs.entries()].filter(([key,value]) => key.startsWith(`${path}/`) && key.split('/').length === path.split('/').length+1 && filters.every((f) => {
        const actual=value[f.field]; if (actual === undefined || actual === null) return false;
        const a=actual?.toMillis?.() ?? actual,b=f.value?.toMillis?.() ?? f.value;
        return f.op === '==' ? a === b : f.op === '<=' ? a <= b : a > b;
      })).slice(0,cap).map(([key]) => snapshot(doc(key)));
      stats.reads+=Math.max(1,rows.length); return { docs:rows,size:rows.length,empty:!rows.length };
    } });
  const db = { collection,runTransaction(fn) {
    const task = queue.then(async () => {
      const writes=[];
      const result=await fn({ get:(ref) => ref.get(),set:(ref,data) => writes.push(['set',ref,data]),create:(ref,data) => writes.push(['create',ref,data]),update:(ref,data) => writes.push(['update',ref,data]),delete:(ref) => writes.push(['delete',ref]) });
      for (const [type,ref,data] of writes) {
        if (type === 'create' && docs.has(ref.path)) throw new Error('already-exists');
        stats.writes++; if (type === 'delete') docs.delete(ref.path); else docs.set(ref.path,clone(type === 'update' ? {...docs.get(ref.path),...data} : data));
      }
      return result;
    }); queue=task.catch(() => {}); return task;
  } };
  const bucket={ file:(path) => ({ async getMetadata() { storage.reads++; if (!files.has(path)) throw Object.assign(new Error('not found'),{code:404}); return [files.get(path).meta]; },
    async save(data,options) { storage.writes++; storage.bytes+=data.length; files.set(path,{data,meta:{...options.metadata,size:data.length}}); },
    async delete() { storage.deletes++; files.delete(path); }, async download() { storage.reads++; if (!files.has(path)) throw Object.assign(new Error('not found'),{code:404}); return [files.get(path).data]; } }) };
  return {db,bucket,docs,files,stats,storage};
}
