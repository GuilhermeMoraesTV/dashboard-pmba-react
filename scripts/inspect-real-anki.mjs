import fs from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { openAnkiArchive } = require('../functions/anki/archive.js');
const { parseAnkiCollection } = require('../functions/anki/parser.js');
const { planAnkiFolderTree, splitAnkiDeckPath } = require('../functions/anki/service.js');

const limits = {
  storage: { maxApkgSizeBytes: 256 * 1024 * 1024 },
  anki: {
    maxArchiveEntries: 20000,
    maxArchiveUncompressedBytes: 1024 * 1024 * 1024,
    maxCollectionBytes: 256 * 1024 * 1024,
    maxMediaFileSizeBytes: 32 * 1024 * 1024,
    maxMediaFiles: 20000,
    maxCompressionRatio: 1000,
  },
};

for (const filePath of process.argv.slice(2)) {
  const archive = await openAnkiArchive(await fs.readFile(filePath), limits);
  const mediaUris = new Map(archive.media.map((media) => [media.name, `anki-media://${encodeURIComponent(`user_uploads/test/anki_media/${media.name}`)}`]));
  const parsed = await parseAnkiCollection(archive.collectionBuffer, { maxCards: 50000, maxTags: 100, mediaUris });
  const targetName = path.basename(filePath).startsWith('Realidade') ? 'Realidade Brasileira' : 'PMBA';
  const plan = planAnkiFolderTree({
    decks: parsed.decks,
    targetFolder: { name: targetName, color: 'red', ancestorFolderIds: [] },
    targetFolderId: 'root',
    existingFolders: [],
  });
  const depths = parsed.decks.map((deck) => splitAnkiDeckPath(deck.name).length);
  console.log(JSON.stringify({
    file: path.basename(filePath),
    format: archive.collectionName,
    cards: parsed.cards.length,
    decks: parsed.deckCount,
    maxDepth: Math.max(...depths),
    roots: [...new Set(parsed.decks.map((deck) => splitAnkiDeckPath(deck.name)[0]))].slice(0, 12),
    createdFolders: plan.newFolders.length,
    assignedDecks: plan.folderIdByDeckId.size,
    media: archive.media.length,
    imageCards: parsed.cards.filter((card) => /<img\b/i.test(`${card.front}${card.back}`)).length,
    svgMedia: archive.media.filter((media) => media.contentType === 'image/svg+xml').length,
    warnings: [...archive.warnings, ...parsed.warnings].length,
  }, null, 2));
}
