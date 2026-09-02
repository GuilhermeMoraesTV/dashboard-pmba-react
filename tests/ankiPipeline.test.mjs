import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import test from 'node:test';
import * as zlib from 'node:zlib';

const require = createRequire(import.meta.url);
const {
  detectMediaType,
  isUnsafeArchiveName,
  openAnkiArchive,
  readZip,
  sanitizeSvgBuffer,
} = require('../functions/anki/archive.js');
const { loadSqlJs, parseAnkiCollection } = require('../functions/anki/parser.js');
const { renderCard, sanitizeRenderedHtml } = require('../functions/anki/renderer.js');
const { buildImportedCardContent, chooseAnkiDeckDocumentId, planAnkiFolderTree, splitAnkiDeckPath, stableId } = require('../functions/anki/service.js');
const { createInitialState } = require('../functions/flashcards/schedulerInitialState.js');

const limits = {
  storage: { maxApkgSizeBytes: 8 * 1024 * 1024 },
  anki: {
    maxArchiveEntries: 50,
    maxArchiveUncompressedBytes: 16 * 1024 * 1024,
    maxCollectionBytes: 8 * 1024 * 1024,
    maxMediaFileSizeBytes: 1024 * 1024,
    maxMediaFiles: 20,
    maxCompressionRatio: 250,
  },
};

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function storedZip(entries) {
  const localParts = [];
  const centralParts = [];
  let offset = 0;
  for (const [name, raw] of entries) {
    const nameBuffer = Buffer.from(name, 'utf8');
    const data = Buffer.from(raw);
    const checksum = crc32(data);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt32LE(checksum, 14);
    local.writeUInt32LE(data.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(nameBuffer.length, 26);
    localParts.push(local, nameBuffer, data);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt32LE(checksum, 16);
    central.writeUInt32LE(data.length, 20);
    central.writeUInt32LE(data.length, 24);
    central.writeUInt16LE(nameBuffer.length, 28);
    central.writeUInt32LE(offset, 42);
    centralParts.push(central, nameBuffer);
    offset += local.length + nameBuffer.length + data.length;
  }
  const centralDirectory = Buffer.concat(centralParts);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(centralDirectory.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...localParts, centralDirectory, end]);
}

async function legacyCollectionBuffer() {
  const SQL = await loadSqlJs();
  const database = new SQL.Database();
  database.run('CREATE TABLE col (models TEXT NOT NULL, decks TEXT NOT NULL)');
  database.run('CREATE TABLE notes (id INTEGER PRIMARY KEY, guid TEXT NOT NULL, mid INTEGER NOT NULL, tags TEXT NOT NULL, flds TEXT NOT NULL)');
  database.run('CREATE TABLE cards (id INTEGER PRIMARY KEY, nid INTEGER NOT NULL, did INTEGER NOT NULL, ord INTEGER NOT NULL)');
  const models = {
    100: {
      id: 100, name: 'Basico', type: 0,
      flds: [{ name: 'Front', ord: 0 }, { name: 'Back', ord: 1 }],
      tmpls: [{ name: 'Card 1', ord: 0, qfmt: '<script>alert(1)</script>{{Front}}', afmt: '{{FrontSide}}<hr>{{Back}}' }],
    },
    101: {
      id: 101, name: 'Cloze', type: 1,
      flds: [{ name: 'Text', ord: 0 }, { name: 'Extra', ord: 1 }],
      tmpls: [{ name: 'Cloze', ord: 0, qfmt: '{{cloze:Text}}', afmt: '{{cloze:Text}}<br>{{Extra}}' }],
    },
  };
  const decks = { 1: { id: 1, name: 'Direito::Constitucional' } };
  database.run('INSERT INTO col VALUES (?, ?)', [JSON.stringify(models), JSON.stringify(decks)]);
  database.run('INSERT INTO notes VALUES (?, ?, ?, ?, ?)', [10, 'guid-basico', 100, ' lei prova ', '<img src=x onerror=alert(1)>Frente\u001fVerso']);
  database.run('INSERT INTO notes VALUES (?, ?, ?, ?, ?)', [11, 'guid-cloze', 101, ' cloze ', 'A {{c1::Constituição::norma}} é suprema.\u001fExplicação']);
  database.run('INSERT INTO cards VALUES (?, ?, ?, ?)', [20, 10, 1, 0]);
  database.run('INSERT INTO cards VALUES (?, ?, ?, ?)', [21, 11, 1, 0]);
  database.run('INSERT INTO cards VALUES (?, ?, ?, ?)', [22, 10, 1, 0]);
  const exported = Buffer.from(database.export());
  database.close();
  return exported;
}

function protobufText(fieldNumber, value) {
  const data = Buffer.from(value, 'utf8');
  assert.ok(data.length < 128, 'Fixture protobuf usa strings curtas.');
  return Buffer.concat([Buffer.from([(fieldNumber << 3) | 2, data.length]), data]);
}

async function modernCollectionBuffer() {
  const SQL = await loadSqlJs();
  const database = new SQL.Database();
  database.run('CREATE TABLE col (id INTEGER PRIMARY KEY)');
  database.run('CREATE TABLE notes (id INTEGER PRIMARY KEY, guid TEXT NOT NULL, mid INTEGER NOT NULL, tags TEXT NOT NULL, flds TEXT NOT NULL)');
  database.run('CREATE TABLE cards (id INTEGER PRIMARY KEY, nid INTEGER NOT NULL, did INTEGER NOT NULL, ord INTEGER NOT NULL)');
  database.run('CREATE TABLE notetypes (id INTEGER PRIMARY KEY, name TEXT NOT NULL, config BLOB NOT NULL)');
  database.run('CREATE TABLE fields (ntid INTEGER NOT NULL, ord INTEGER NOT NULL, name TEXT NOT NULL)');
  database.run('CREATE TABLE templates (ntid INTEGER NOT NULL, ord INTEGER NOT NULL, name TEXT NOT NULL, config BLOB NOT NULL)');
  database.run('CREATE TABLE decks (id INTEGER PRIMARY KEY, name TEXT NOT NULL)');
  database.run('INSERT INTO col VALUES (1)');
  database.run('INSERT INTO notetypes VALUES (?, ?, ?)', [200, 'Moderno', new Uint8Array()]);
  database.run('INSERT INTO fields VALUES (?, ?, ?)', [200, 0, 'Pergunta']);
  database.run('INSERT INTO fields VALUES (?, ?, ?)', [200, 1, 'Resposta']);
  const templateConfig = Buffer.concat([protobufText(1, '{{Pergunta}}'), protobufText(2, '{{FrontSide}}<hr>{{Resposta}}')]);
  database.run('INSERT INTO templates VALUES (?, ?, ?, ?)', [200, 0, 'Card moderno', templateConfig]);
  database.run('INSERT INTO decks VALUES (?, ?)', [2, 'Deck moderno']);
  database.run('INSERT INTO notes VALUES (?, ?, ?, ?, ?)', [30, 'guid-moderno', 200, ' moderna ', 'Pergunta moderna\u001fResposta moderna']);
  database.run('INSERT INTO cards VALUES (?, ?, ?, ?)', [40, 30, 2, 0]);
  const exported = Buffer.from(database.export());
  database.close();
  return exported;
}

test('parser preserva NoteType, Note, Card, GUID, ordinal, tags, deck e cloze', async () => {
  const result = await parseAnkiCollection(await legacyCollectionBuffer(), {
    maxCards: 10, maxTags: 10, mediaUris: new Map(),
  });
  assert.equal(result.cards.length, 2);
  assert.ok(result.warnings.some((warning) => /duplicada/i.test(warning)));
  assert.deepEqual(result.cards[0].tags, ['lei', 'prova']);
  assert.equal(result.cards[0].ankiNoteGuid, 'guid-basico');
  assert.equal(result.cards[0].ankiNoteId, '10');
  assert.equal(result.cards[0].ankiCardOrd, 0);
  assert.equal(result.cards[0].deckName, 'Direito::Constitucional');
  assert.doesNotMatch(result.cards[0].front, /script|onerror/i);
  assert.ok(result.warnings.some((warning) => /inseguro foi removido/i.test(warning)));
  assert.equal(result.cards[1].isCloze, true);
  assert.match(result.cards[1].front, /norma|\.\.\./i);
  assert.match(result.cards[1].back, /Constituição/);
});

test('parser lê metadados normalizados do schema moderno do Anki', async () => {
  const result = await parseAnkiCollection(await modernCollectionBuffer(), {
    maxCards: 10, maxTags: 10, mediaUris: new Map(),
  });
  assert.equal(result.cards.length, 1);
  assert.equal(result.cards[0].noteTypeName, 'Moderno');
  assert.equal(result.cards[0].deckName, 'Deck moderno');
  assert.match(result.cards[0].front, /Pergunta moderna/);
  assert.match(result.cards[0].back, /Resposta moderna/);
});

test('renderizador Anki nao executa JavaScript e resolve mídia permitida', () => {
  const card = renderCard({
    template: { qfmt: '{{Front}}', afmt: '{{FrontSide}} {{Back}}' },
    fieldNames: ['Front', 'Back'],
    fieldValues: ['<img src="foto.png" onerror="alert(1)"><script>alert(2)</script>', '[sound:aula.mp3]'],
    cardOrd: 0,
    isCloze: false,
    mediaUris: new Map([
      ['foto.png', 'anki-media://user_uploads%2Fu%2Fanki_media%2Ffoto.png'],
      ['aula.mp3', 'anki-media://user_uploads%2Fu%2Fanki_media%2Faula.mp3'],
    ]),
  });
  assert.doesNotMatch(`${card.front}${card.back}`, /script|onerror|alert\(/i);
  assert.match(card.front, /anki-media:/);
  assert.match(card.back, /data-anki-audio/);
  assert.equal(sanitizeRenderedHtml('<a href="javascript:alert(1)">x</a>'), 'x');
});

test('identidade de reimportacao usa GUID + ordinal e estado inicial e opaco', () => {
  assert.equal(stableId('card', 'guid\u00000'), stableId('card', 'guid\u00000'));
  assert.notEqual(stableId('card', 'guid\u00000'), stableId('card', 'guid\u00001'));
  assert.deepEqual(createInitialState(), {
    algorithm: 'sm2', version: 2, data: {
      repetition: 0, interval: 0, easeFactor: 2.5, phase: 'learning', stepIndex: 0,
      learningStepsMinutes: [1, 10], relearningStepsMinutes: [1, 10], hardMinutes: 6,
      graduatingIntervalDays: 1, easyIntervalDays: 3,
    },
  });
});

test('reimportacao atualiza conteudo sem sobrescrever schedulerState ou progresso', () => {
  const update = buildImportedCardContent({
    source: {
      front: 'Frente atualizada', back: 'Verso atualizado', tags: ['lei'],
      ankiNoteGuid: 'guid', ankiNoteId: '99', ankiCardOrd: 2,
    },
    uid: 'user-a', importId: 'import-2', deckId: 'deck-a', now: 'agora',
    limits: { anki: { maxCardHtmlChars: 2000 } },
  });
  assert.equal(update.front, 'Frente atualizada');
  assert.deepEqual(update.ankiMetadata, { ankiNoteGuid: 'guid', ankiNoteId: '99', ankiCardOrd: 2 });
  for (const protectedField of ['schedulerState', 'status', 'dueAt', 'lapses', 'reps', 'createdAt']) {
    assert.equal(Object.hasOwn(update, protectedField), false);
  }
});

test('arquivo ZIP rejeita path traversal, excesso de entradas e assinatura invalida', async () => {
  assert.equal(isUnsafeArchiveName('../collection.anki2'), true);
  assert.equal(isUnsafeArchiveName('C:\\evil'), true);
  await assert.rejects(
    readZip(storedZip([['../collection.anki2', Buffer.from('x')]]), limits),
    (error) => ['path-traversal', 'invalid-archive'].includes(error.code),
  );
  const strict = { ...limits, anki: { ...limits.anki, maxArchiveEntries: 1 } };
  await assert.rejects(
    readZip(storedZip([['collection.anki2', Buffer.from('x')], ['media', Buffer.from('{}')]]), strict),
    (error) => error.code === 'zip-bomb',
  );
  await assert.rejects(
    readZip(storedZip([['collection.anki2', Buffer.from('x')], ['collection.anki2', Buffer.from('y')]]), limits),
    (error) => error.code === 'duplicate-entry',
  );
  await assert.rejects(openAnkiArchive(Buffer.from('nao e zip'), limits), (error) => error.code === 'invalid-archive');
});

test('mídia usa assinatura real, corrige extensão divergente e sanitiza SVG', () => {
  const png = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 0]);
  assert.equal(detectMediaType(png, 'imagem.png'), 'image/png');
  assert.equal(detectMediaType(png, 'imagem.jpg'), 'image/png');
  assert.equal(detectMediaType(Buffer.from('<svg><script/></svg>'), 'imagem.svg'), 'image/svg+xml');
  assert.doesNotMatch(sanitizeSvgBuffer(Buffer.from('<svg><script>alert(1)</script><path d="M0 0"/></svg>')).toString('utf8'), /script|alert/i);
  assert.equal(detectMediaType(Buffer.from('nao-png'), 'imagem.png'), null);
});

test('hierarquia Anki aceita :: e U+001F, reaproveita a pasta raiz e preserva profundidade', () => {
  assert.deepEqual(splitAnkiDeckPath('PMBA::Direito Penal::Crimes'), ['PMBA', 'Direito Penal', 'Crimes']);
  assert.deepEqual(splitAnkiDeckPath('Realidade Brasileira\u001fGeografia\u001fBahia'), ['Realidade Brasileira', 'Geografia', 'Bahia']);
  const plan = planAnkiFolderTree({
    decks: [
      { id: '1', name: 'PMBA::Direito Penal::Crimes' },
      { id: '2', name: 'PMBA::Direito Penal::Teoria do Crime::Iter Criminis' },
    ],
    targetFolder: { name: 'PMBA', color: 'red', ancestorFolderIds: [] },
    targetFolderId: 'root',
    existingFolders: [],
  });
  const crimesId = plan.folderIdByDeckId.get('1');
  const iterId = plan.folderIdByDeckId.get('2');
  assert.notEqual(crimesId, 'root');
  assert.notEqual(iterId, crimesId);
  assert.equal(plan.newFolders.find((folder) => folder.id === iterId).ancestorFolderIds.length, 3);
});

test('IDs numericos iguais em pacotes Anki diferentes nao colidem entre decks', () => {
  const pmba = chooseAnkiDeckDocumentId({ ankiDeckId: '1', deckName: 'PMBA::Direito Penal' });
  const realidade = chooseAnkiDeckDocumentId({ ankiDeckId: '1', deckName: 'Realidade Brasileira::Geografia' });
  assert.notEqual(pmba, realidade);
});

for (const collectionName of ['collection.anki2', 'collection.anki21']) {
  test(`${collectionName} abre e entrega SQLite validado`, async () => {
    const collection = await legacyCollectionBuffer();
    const result = await openAnkiArchive(storedZip([[collectionName, collection], ['media', Buffer.from('{}')]]), limits);
    assert.equal(result.collectionName, collectionName);
    assert.equal(result.collectionBuffer.subarray(0, 16).toString('binary'), 'SQLite format 3\u0000');
  });
}

test('collection.anki2 com COLLATE unicase e index e parseado com sucesso', async () => {
  const SQL = await loadSqlJs();
  const database = new SQL.Database();
  database.run('CREATE TABLE col (models TEXT NOT NULL, decks TEXT NOT NULL)');
  database.run('CREATE TABLE notes (id INTEGER PRIMARY KEY, guid TEXT NOT NULL COLLATE NOCASE , mid INTEGER NOT NULL, tags TEXT NOT NULL, flds TEXT NOT NULL)');
  database.run('CREATE INDEX ix_notes_guid ON notes (guid COLLATE NOCASE )');
  database.run('CREATE TABLE cards (id INTEGER PRIMARY KEY, nid INTEGER NOT NULL, did INTEGER NOT NULL, ord INTEGER NOT NULL)');
  const models = {
    100: {
      id: 100, name: 'Basico', type: 0,
      flds: [{ name: 'Front', ord: 0 }, { name: 'Back', ord: 1 }],
      tmpls: [{ name: 'Card 1', ord: 0, qfmt: '{{Front}}', afmt: '{{FrontSide}}<hr>{{Back}}' }],
    },
  };
  const decks = { 1: { id: 1, name: 'Direito Constitucional' } };
  database.run('INSERT INTO col VALUES (?, ?)', [JSON.stringify(models), JSON.stringify(decks)]);
  database.run('INSERT INTO notes VALUES (?, ?, ?, ?, ?)', [1, 'guid-unicase-test', 100, 'tag1', 'Pergunta\u001fResposta']);
  database.run('INSERT INTO cards VALUES (?, ?, ?, ?)', [1, 1, 1, 0]);
  const rawBuffer = Buffer.from(database.export());
  database.close();

  // Emula APKG real do Anki com collation unicase
  const ankiBuffer = Buffer.from(rawBuffer);
  let pos = 0;
  while ((pos = ankiBuffer.indexOf('NOCASE ', pos)) !== -1) {
    ankiBuffer.write('unicase', pos, 7, 'ascii');
    pos += 7;
  }

  const parsed = await parseAnkiCollection(ankiBuffer, {
    maxCards: 10, maxTags: 10, mediaUris: new Map(),
  });
  assert.equal(parsed.cards.length, 1);
  assert.equal(parsed.cards[0].ankiNoteGuid, 'guid-unicase-test');
  assert.equal(parsed.cards[0].front, 'Pergunta');
  assert.equal(parsed.cards[0].back, 'Pergunta<hr />Resposta');
});
