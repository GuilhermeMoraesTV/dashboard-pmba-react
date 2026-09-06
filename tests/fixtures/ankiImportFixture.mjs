import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { loadSqlJs } = require('../../functions/anki/parser.js');

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return (crc ^ 0xffffffff) >>> 0;
}

export function storedZip(entries) {
  const localParts = [], centralParts = [];
  let offset = 0;
  for (const [name, raw] of entries) {
    const nameBuffer = Buffer.from(name), data = Buffer.from(raw), checksum = crc32(data);
    const local = Buffer.alloc(30), central = Buffer.alloc(46);
    local.writeUInt32LE(0x04034b50); local.writeUInt16LE(20, 4);
    local.writeUInt32LE(checksum, 14); local.writeUInt32LE(data.length, 18);
    local.writeUInt32LE(data.length, 22); local.writeUInt16LE(nameBuffer.length, 26);
    localParts.push(local, nameBuffer, data);
    central.writeUInt32LE(0x02014b50); central.writeUInt16LE(20, 4); central.writeUInt16LE(20, 6);
    central.writeUInt32LE(checksum, 16); central.writeUInt32LE(data.length, 20);
    central.writeUInt32LE(data.length, 24); central.writeUInt16LE(nameBuffer.length, 28);
    central.writeUInt32LE(offset, 42); centralParts.push(central, nameBuffer);
    offset += local.length + nameBuffer.length + data.length;
  }
  const directory = Buffer.concat(centralParts), end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50); end.writeUInt16LE(entries.length, 8); end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(directory.length, 12); end.writeUInt32LE(offset, 16);
  return Buffer.concat([...localParts, directory, end]);
}

export async function makeAnkiPackage({ count = 5200, deckCount = 520, changed = -1, depth = 12 } = {}) {
  const SQL = await loadSqlJs(), db = new SQL.Database();
  db.run('CREATE TABLE col (models TEXT, decks TEXT)');
  db.run('CREATE TABLE notes (id INTEGER PRIMARY KEY, guid TEXT, mid INTEGER, tags TEXT, flds TEXT)');
  db.run('CREATE TABLE cards (id INTEGER PRIMARY KEY, nid INTEGER, did INTEGER, ord INTEGER)');
  const models = { 1: { id: 1, type: 0, name: 'Basic', flds: [{ name: 'Front' }, { name: 'Back' }],
    tmpls: [{ ord: 0, qfmt: '{{Front}}', afmt: '{{Back}}' }] } };
  const decks = { 1: { id: 1, name: 'Default' }, 2: { id: 2, name: 'ROOT' },
    3: { id: 3, name: 'ROOT::Vazia' }, 4: { id: 4, name: 'ROOT::ROOT' } };
  for (let i = 0; i < deckCount; i++) {
    decks[100 + i] = { id: 100 + i, name: `ROOT::Disciplina ${i}::${Array.from({ length: depth }, (_, j) => `Nível ${j}`).join('::')}` };
  }
  db.run('INSERT INTO col VALUES (?, ?)', [JSON.stringify(models), JSON.stringify(decks)]);
  const note = db.prepare('INSERT INTO notes VALUES (?, ?, ?, ?, ?)');
  const card = db.prepare('INSERT INTO cards VALUES (?, ?, ?, ?)');
  for (let i = 0; i < count; i++) {
    note.run([i + 1, `guid-${i}`, 1, ' teste ', `Pergunta ${i}\u001fResposta ${i}${changed === i ? ' alterada' : ''}`]);
    card.run([i + 1, i + 1, 100 + i % deckCount, 0]);
  }
  note.free(); card.free();
  const collection = Buffer.from(db.export()); db.close();
  return storedZip([['collection.anki2', collection], ['media', '{}']]);
}

export function memoryBucket() {
  const objects = new Map();
  let saves = 0;
  return {
    objects, get saves() { return saves; },
    file(name) {
      return {
        name,
        async exists() { return [objects.has(name)]; },
        async getMetadata() {
          if (!objects.has(name)) throw Object.assign(new Error('not found'), { code: 404 });
          return [{ size: objects.get(name).length, contentType: 'application/zip' }];
        },
        async download() { return [objects.get(name)]; },
        async save(data, options = {}) {
          if (options.preconditionOpts?.ifGenerationMatch === 0 && objects.has(name)) {
            throw Object.assign(new Error('exists'), { code: 412 });
          }
          saves++; objects.set(name, data);
        },
        async delete() { objects.delete(name); },
      };
    },
  };
}
