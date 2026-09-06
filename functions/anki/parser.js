/**
 * @fileoverview Parser das estruturas NoteType -> Note -> Card em SQLite Anki.
 */

const path = require('path');
const initSqlJs = require('sql.js');
const { decodeMessage, firstString, firstVarint } = require('./protobuf');
const { renderCard } = require('./renderer');

class AnkiParserError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'AnkiParserError';
    this.code = code;
  }
}

let sqlPromise = null;

function loadSqlJs() {
  if (!sqlPromise) {
    sqlPromise = initSqlJs({
      locateFile: (file) => path.join(path.dirname(require.resolve('sql.js/dist/sql-wasm.js')), file),
    });
  }
  return sqlPromise;
}

function rows(database, statement) {
  const result = database.exec(statement);
  if (!result.length) return [];
  const { columns, values } = result[0];
  return values.map((valuesRow) => Object.fromEntries(columns.map((column, index) => [column, valuesRow[index]])));
}

function hasTable(database, name) {
  const safe = String(name).replace(/'/g, "''");
  return rows(database, `SELECT name FROM sqlite_master WHERE type='table' AND name='${safe}'`).length > 0;
}

function parseJsonMap(value, label) {
  try {
    const parsed = JSON.parse(String(value || '{}'));
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    throw new AnkiParserError('invalid-collection-json', `${label} da collection Anki e invalido.`);
  }
}

function parseLegacyMetadata(database) {
  const collection = rows(database, 'SELECT models, decks FROM col LIMIT 1')[0];
  if (!collection) throw new AnkiParserError('invalid-collection', 'Tabela col vazia.');
  const models = parseJsonMap(collection.models, 'NoteTypes');
  const decks = parseJsonMap(collection.decks, 'Decks');
  return {
    notetypes: new Map(Object.values(models).map((model) => [String(model.id), {
      id: String(model.id),
      name: String(model.name || 'NoteType Anki'),
      fields: (model.flds || []).sort((a, b) => Number(a.ord) - Number(b.ord)).map((field) => String(field.name || 'Campo')),
      templates: (model.tmpls || []).sort((a, b) => Number(a.ord) - Number(b.ord)).map((template) => ({
        name: String(template.name || 'Card'), qfmt: String(template.qfmt || ''), afmt: String(template.afmt || ''),
      })),
      isCloze: Number(model.type || 0) === 1,
    }])),
    decks: new Map(Object.values(decks).map((deck) => [String(deck.id), String(deck.name || 'Deck Anki')])),
  };
}

function bufferFromSqlValue(value) {
  if (value instanceof Uint8Array) return Buffer.from(value);
  if (Buffer.isBuffer(value)) return value;
  return Buffer.alloc(0);
}

function parseModernMetadata(database) {
  const notetypes = new Map();
  for (const row of rows(database, 'SELECT id, name, config FROM notetypes')) {
    const config = decodeMessage(bufferFromSqlValue(row.config));
    notetypes.set(String(row.id), {
      id: String(row.id), name: String(row.name || 'NoteType Anki'), fields: [], templates: [],
      isCloze: firstVarint(config, 1, 0) === 1,
    });
  }
  for (const row of rows(database, 'SELECT ntid, ord, name FROM fields ORDER BY ntid, ord')) {
    const model = notetypes.get(String(row.ntid));
    if (model) model.fields[Number(row.ord)] = String(row.name || `Campo ${row.ord}`);
  }
  for (const row of rows(database, 'SELECT ntid, ord, name, config FROM templates ORDER BY ntid, ord')) {
    const model = notetypes.get(String(row.ntid));
    if (!model) continue;
    const config = decodeMessage(bufferFromSqlValue(row.config));
    model.templates[Number(row.ord)] = {
      name: String(row.name || `Card ${row.ord}`),
      qfmt: firstString(config, 1),
      afmt: firstString(config, 2),
    };
  }
  const decks = new Map(rows(database, 'SELECT id, name FROM decks').map((row) => [String(row.id), String(row.name || 'Deck Anki')]));
  return { notetypes, decks };
}

function parseTags(value, maxTags) {
  return [...new Set(String(value || '').trim().split(/\s+/).map((tag) => tag.normalize('NFC').trim()).filter(Boolean))].slice(0, maxTags);
}

function incrementCounter(counters, key) {
  counters[key] = Number(counters[key] || 0) + 1;
}

function sqliteCount(database, table) {
  return Number(rows(database, `SELECT COUNT(*) AS total FROM ${table}`)[0]?.total || 0);
}

function prepareAnkiSqliteBuffer(collectionBuffer) {
  if (!collectionBuffer || !collectionBuffer.length) return collectionBuffer;
  const buffer = Buffer.from(collectionBuffer);
  // Anki schemas use COLLATE unicase in SQLite DDLs for columns/indices.
  // We ONLY target SQLite collation keywords (e.g. 'COLLATE unicase'), preserving user data, GUIDs, and note fields intact.
  const targets = [
    { from: Buffer.from('COLLATE unicase', 'utf8'), to: Buffer.from('COLLATE nocase ', 'utf8') },
    { from: Buffer.from('collate unicase', 'utf8'), to: Buffer.from('collate nocase ', 'utf8') },
    { from: Buffer.from('COLLATE UNICASE', 'utf8'), to: Buffer.from('COLLATE NOCASE ', 'utf8') },
    { from: Buffer.from('collate UNICASE', 'utf8'), to: Buffer.from('collate NOCASE ', 'utf8') },
    { from: Buffer.from('COLLATE "unicase"', 'utf8'), to: Buffer.from('COLLATE "nocase "', 'utf8') },
    { from: Buffer.from('collate "unicase"', 'utf8'), to: Buffer.from('collate "nocase "', 'utf8') },
    { from: Buffer.from('COLLATE \'unicase\'', 'utf8'), to: Buffer.from('COLLATE \'nocase \'', 'utf8') },
    { from: Buffer.from('collate \'unicase\'', 'utf8'), to: Buffer.from('collate \'nocase \'', 'utf8') },
  ];
  for (const { from, to } of targets) {
    let pos = 0;
    while ((pos = buffer.indexOf(from, pos)) !== -1) {
      to.copy(buffer, pos);
      pos += from.length;
    }
  }
  return buffer;
}

async function parseAnkiCollection(collectionBuffer, options) {
  const SQL = await loadSqlJs();
  let database;
  try {
    const memoryBuffer = prepareAnkiSqliteBuffer(collectionBuffer);
    database = new SQL.Database(new Uint8Array(memoryBuffer));
  } catch (error) {
    throw new AnkiParserError('invalid-sqlite', `Nao foi possivel abrir a collection Anki: ${error.message}`);
  }
  const warnings = [];
  try {
    const check = rows(database, 'PRAGMA quick_check')[0];
    if (check && !Object.values(check).includes('ok')) throw new AnkiParserError('corrupt-sqlite', 'A collection Anki esta corrompida.');
    if (!hasTable(database, 'notes') || !hasTable(database, 'cards') || !hasTable(database, 'col')) {
      throw new AnkiParserError('invalid-schema', 'A collection nao possui as tabelas Anki obrigatorias.');
    }
    const metadata = hasTable(database, 'notetypes') && hasTable(database, 'fields') && hasTable(database, 'templates')
      ? parseModernMetadata(database)
      : parseLegacyMetadata(database);
    const totalCardsSQLite = sqliteCount(database, 'cards');
    const totalNotesSQLite = sqliteCount(database, 'notes');
    if (totalCardsSQLite > options.maxCards) throw new AnkiParserError('too-many-cards', 'O APKG excede o limite de cards por importacao.');
    const cardsPerDeck = rows(database, 'SELECT did AS deckId, COUNT(*) AS cardCount FROM cards GROUP BY did ORDER BY did')
      .map((entry) => ({
        deckId: String(entry.deckId),
        deckName: metadata.decks.get(String(entry.deckId)) || 'Deck Anki',
        cardCount: Number(entry.cardCount || 0),
      }));
    const cardRows = rows(database, `SELECT c.id AS cardId, c.nid AS noteId, c.did AS deckId, c.ord AS cardOrd,
      n.guid AS noteGuid, n.mid AS noteTypeId, n.tags AS noteTags, n.flds AS noteFields
      FROM cards c LEFT JOIN notes n ON n.id = c.nid ORDER BY c.id`);
    const cards = [];
    const logicalIdentities = new Set();
    const skipReasons = {};
    const skipDetails = {};
    const addSkip = (reason, cardId) => {
      incrementCounter(skipReasons, reason);
      if (!skipDetails[reason]) skipDetails[reason] = [];
      if (skipDetails[reason].length < 20) skipDetails[reason].push(String(cardId));
    };
    let insecureScriptCount = 0;
    let typeFilterCount = 0;
    let missingTemplateCount = 0;
    const unsupportedFilterMap = new Map();
    for (const row of cardRows) {
      const guid = String(row.noteGuid || '').trim();
      const cardOrd = Number(row.cardOrd);
      if (row.noteGuid == null) {
        addSkip('missingNote', row.cardId);
        continue;
      }
      if (!guid || !Number.isInteger(cardOrd) || cardOrd < 0) {
        addSkip('invalidIdentity', row.cardId);
        continue;
      }
      if (row.deckId == null || !String(row.deckId).trim()) {
        addSkip('invalidDeck', row.cardId);
        continue;
      }
      const logicalIdentity = `${guid}\u0000${cardOrd}`;
      if (logicalIdentities.has(logicalIdentity)) {
        addSkip('duplicateIdentity', row.cardId);
        continue;
      }
      logicalIdentities.add(logicalIdentity);
      const notetype = metadata.notetypes.get(String(row.noteTypeId));
      if (!notetype) {
        addSkip('missingNoteType', row.cardId);
        continue;
      }
      const template = notetype.isCloze ? notetype.templates[0] : notetype.templates[cardOrd];
      if (!template) missingTemplateCount += 1;
      const templateSource = `${template?.qfmt || ''}\n${template?.afmt || ''}`;
      if (/<script\b|\son[a-z]+\s*=/i.test(templateSource)) {
        insecureScriptCount += 1;
      }
      const rawFilters = [...templateSource.matchAll(/\{\{([^{}:]+):[^{}]+\}\}/g)]
        .map((match) => match[1].trim().toLowerCase());
      if (rawFilters.includes('type')) {
        typeFilterCount += 1;
      }
      const unsupported = rawFilters.filter((filter) => !['cloze', 'text', 'type'].includes(filter));
      for (const filter of unsupported) {
        unsupportedFilterMap.set(filter, (unsupportedFilterMap.get(filter) || 0) + 1);
      }
      const fieldValues = String(row.noteFields || '').split('\u001f').map((field) => field.normalize('NFC'));
      const rendered = renderCard({
        template,
        fieldNames: notetype.fields,
        fieldValues,
        cardOrd,
        isCloze: notetype.isCloze,
        mediaUris: options.mediaUris,
      });
      if (!rendered.front || !rendered.back) {
        addSkip('unusableContent', row.cardId);
        continue;
      }
      cards.push({
        ankiCardId: String(row.cardId),
        ankiNoteGuid: guid,
        ankiNoteId: String(row.noteId),
        ankiCardOrd: cardOrd,
        ankiDeckId: String(row.deckId),
        deckName: metadata.decks.get(String(row.deckId)) || 'Deck Anki',
        noteTypeName: notetype.name,
        isCloze: notetype.isCloze,
        typedAnswerMode: rendered.typedAnswerMode,
        front: rendered.front,
        back: rendered.back,
        tags: parseTags(row.noteTags, options.maxTags),
      });
    }

    if (typeFilterCount > 0) {
      warnings.push(`${typeFilterCount} cards utilizam resposta digitada do Anki; foram importados em modo compatível.`);
    }
    if (missingTemplateCount > 0) {
      warnings.push(`${missingTemplateCount} cards não possuíam template válido e usaram o fallback seguro de campos.`);
    }
    if (insecureScriptCount > 0) {
      warnings.push(`${insecureScriptCount} cards continham JavaScript/handlers HTML inseguros que foram removidos.`);
    }
    for (const [filter, count] of unsupportedFilterMap.entries()) {
      warnings.push(`${count} cards utilizam filtros de template não suportados (${filter}) e foram simplificados.`);
    }

    const cardsDetected = totalCardsSQLite;
    const cardsParsed = cards.length;
    const cardsSkipped = Object.values(skipReasons).reduce((sum, count) => sum + Number(count || 0), 0);
    if (cardsParsed + cardsSkipped !== cardsDetected) {
      throw new AnkiParserError('parser-accounting-mismatch', 'A contagem do parser Anki não fechou com o SQLite.');
    }
    const skipLabels = {
      missingNote: 'note ausente',
      invalidIdentity: 'identidade inválida',
      invalidDeck: 'deck inválido',
      duplicateIdentity: 'GUID/ordinal duplicado',
      missingNoteType: 'NoteType ausente',
      unusableContent: 'conteúdo sem uso',
    };
    for (const [reason, count] of Object.entries(skipReasons)) {
      warnings.push(`${count} cards foram ignorados por ${skipLabels[reason] || reason}.`);
    }

    return {
      cards,
      warnings,
      decks: [...metadata.decks.entries()].map(([id, name]) => ({ id, name })),
      deckCount: metadata.decks.size,
      metrics: {
        totalCardsSQLite,
        totalNotesSQLite,
        totalDecksSQLite: metadata.decks.size,
        cardsPerDeck,
        cardsDetected,
        cardsParsed,
        cardsSkipped,
        skipReasons,
        skipDetails,
        typedAnswerCards: typeFilterCount,
      },
    };
  } finally {
    database.close();
  }
}

module.exports = {
  AnkiParserError,
  bufferFromSqlValue,
  hasTable,
  loadSqlJs,
  parseAnkiCollection,
  parseLegacyMetadata,
  parseModernMetadata,
  parseTags,
  rows,
};
