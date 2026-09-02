/**
 * @fileoverview Leitura limitada de APKG e compatibilidade Zstd sem binarios nativos.
 */

const crypto = require('crypto');
const yauzl = require('yauzl');
const sanitizeHtml = require('sanitize-html');
const { Decompress } = require('fzstd');
const { decodeMessage, firstString, firstVarint } = require('./protobuf');

class AnkiArchiveError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'AnkiArchiveError';
    this.code = code;
  }
}

function isUnsafeArchiveName(name) {
  return !name
    || name.includes('\u0000')
    || name.includes('\\')
    || name.startsWith('/')
    || /^[A-Za-z]:/.test(name)
    || name.split('/').some((part) => part === '..');
}

function readEntryBuffer(zipFile, entry, maximumBytes) {
  return new Promise((resolve, reject) => {
    zipFile.openReadStream(entry, (error, stream) => {
      if (error) return reject(error);
      const chunks = [];
      let total = 0;
      stream.on('data', (chunk) => {
        total += chunk.length;
        if (total > maximumBytes) {
          stream.destroy(new AnkiArchiveError('entry-too-large', `Entrada ${entry.fileName} excede o limite.`));
          return;
        }
        chunks.push(chunk);
      });
      stream.once('error', reject);
      stream.once('end', () => resolve(Buffer.concat(chunks, total)));
    });
  });
}

function readZip(buffer, limits) {
  return new Promise((resolve, reject) => {
    yauzl.fromBuffer(buffer, { lazyEntries: true, validateEntrySizes: true }, (openError, zipFile) => {
      if (openError) return reject(new AnkiArchiveError('invalid-archive', `APKG invalido: ${openError.message}`));
      const entries = new Map();
      const warnings = [];
      let entryCount = 0;
      let totalUncompressed = 0;
      let settled = false;
      const fail = (error) => {
        if (settled) return;
        settled = true;
        zipFile.close();
        reject(error instanceof AnkiArchiveError ? error : new AnkiArchiveError('invalid-archive', error.message));
      };
      zipFile.once('error', fail);
      zipFile.once('end', () => {
        if (settled) return;
        settled = true;
        resolve({ entries, warnings });
      });
      zipFile.on('entry', async (entry) => {
        try {
          entryCount += 1;
          if (entryCount > limits.anki.maxArchiveEntries) {
            throw new AnkiArchiveError('zip-bomb', 'O APKG possui entradas demais.');
          }
          const name = String(entry.fileName || '').normalize('NFC');
          if (isUnsafeArchiveName(name)) throw new AnkiArchiveError('path-traversal', 'O APKG contem caminho malicioso.');
          if ((entry.generalPurposeBitFlag & 0x1) !== 0) {
            throw new AnkiArchiveError('encrypted-archive', 'APKG criptografado nao e suportado.');
          }
          if (name.endsWith('/')) {
            zipFile.readEntry();
            return;
          }
          totalUncompressed += Number(entry.uncompressedSize || 0);
          if (totalUncompressed > limits.anki.maxArchiveUncompressedBytes) {
            throw new AnkiArchiveError('zip-bomb', 'O APKG excede o limite descompactado.');
          }
          const compressed = Number(entry.compressedSize || 0);
          const ratio = compressed > 0 ? Number(entry.uncompressedSize || 0) / compressed : Number.POSITIVE_INFINITY;
          if (entry.uncompressedSize > 1024 && ratio > limits.anki.maxCompressionRatio) {
            throw new AnkiArchiveError('zip-bomb', 'O APKG possui taxa de compressao abusiva.');
          }
          const known = /^(collection\.(?:anki2|anki21|anki21b|21b)|media|meta|[0-9]+)$/.test(name);
          if (!known) {
            warnings.push(`Entrada ignorada: ${name.slice(0, 120)}`);
            zipFile.readEntry();
            return;
          }
          if (entries.has(name)) {
            throw new AnkiArchiveError('duplicate-entry', `O APKG possui entrada duplicada: ${name.slice(0, 120)}.`);
          }
          const maximum = name.startsWith('collection.')
            ? limits.anki.maxCollectionBytes
            : Math.min(limits.anki.maxArchiveUncompressedBytes, Math.max(limits.anki.maxMediaFileSizeBytes, 4 * 1024 * 1024));
          entries.set(name, await readEntryBuffer(zipFile, entry, maximum));
          zipFile.readEntry();
        } catch (error) {
          fail(error);
        }
      });
      zipFile.readEntry();
    });
  });
}

function decompressZstdLimited(input, maximumBytes) {
  const output = [];
  let total = 0;
  const decompressor = new Decompress((chunk) => {
    total += chunk.length;
    if (total > maximumBytes) throw new AnkiArchiveError('zstd-bomb', 'Conteudo Zstd excede o limite descompactado.');
    output.push(Buffer.from(chunk));
  });
  try {
    const step = 1024 * 1024;
    for (let offset = 0; offset < input.length; offset += step) {
      decompressor.push(input.subarray(offset, Math.min(offset + step, input.length)), offset + step >= input.length);
    }
  } catch (error) {
    if (error instanceof AnkiArchiveError) throw error;
    throw new AnkiArchiveError('invalid-zstd', `Conteudo Zstd invalido: ${error?.message || error}`);
  }
  return Buffer.concat(output, total);
}

function decodeModernMediaManifest(buffer) {
  const root = decodeMessage(buffer);
  return (root.get(1) || []).filter((entry) => entry.wireType === 2).map((entry, index) => {
    const fields = decodeMessage(entry.value);
    const shaEntry = fields.get(3)?.find((field) => field.wireType === 2);
    return {
      zipName: String(index),
      name: firstString(fields, 1),
      size: firstVarint(fields, 2),
      sha1: shaEntry ? shaEntry.value.toString('hex') : '',
      legacyZipFilename: firstVarint(fields, 255, index),
    };
  });
}

function parseMediaManifest(raw, modern, limits) {
  if (!raw) return [];
  if (!modern) {
    let parsed;
    try { parsed = JSON.parse(raw.toString('utf8')); } catch { throw new AnkiArchiveError('invalid-media-map', 'Mapa de midia Anki invalido.'); }
    return Object.entries(parsed).map(([zipName, name]) => ({ zipName, name: String(name), size: null, sha1: '' }));
  }
  const decoded = decompressZstdLimited(raw, Math.min(limits.anki.maxArchiveUncompressedBytes, 20 * 1024 * 1024));
  return decodeModernMediaManifest(decoded).map((entry) => ({ ...entry, zipName: String(entry.legacyZipFilename) }));
}

function validateMediaName(name) {
  const normalized = String(name || '').normalize('NFC');
  if (isUnsafeArchiveName(normalized) || normalized.includes('/') || normalized.length > 240 || /[\u0000-\u001F\u007F]/.test(normalized)) {
    throw new AnkiArchiveError('invalid-media-name', 'Nome de midia Anki inseguro.');
  }
  return normalized;
}

function detectMediaType(buffer, fileName) {
  const extension = String(fileName).split('.').pop().toLowerCase();
  const signature = buffer.subarray(0, 16);
  if (signature[0] === 0xff && signature[1] === 0xd8 && signature[2] === 0xff) return 'image/jpeg';
  if (signature.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return 'image/png';
  if (signature.subarray(0, 4).toString('ascii') === 'GIF8') return 'image/gif';
  if (signature.subarray(0, 4).toString('ascii') === 'RIFF' && signature.subarray(8, 12).toString('ascii') === 'WEBP') return 'image/webp';
  if (signature.subarray(0, 3).toString('ascii') === 'ID3' || (signature[0] === 0xff && (signature[1] & 0xe0) === 0xe0)) return 'audio/mpeg';
  if (signature.subarray(0, 4).toString('ascii') === 'OggS') return 'audio/ogg';
  if (signature.subarray(0, 4).toString('ascii') === 'RIFF' && signature.subarray(8, 12).toString('ascii') === 'WAVE') return 'audio/wav';
  if (signature.subarray(4, 8).toString('ascii') === 'ftyp') return ['m4a'].includes(extension) ? 'audio/mp4' : 'video/mp4';
  if (extension === 'svg' && /^\s*(?:<\?xml[^>]*>\s*)?<svg\b/i.test(buffer.subarray(0, 1024).toString('utf8'))) return 'image/svg+xml';
  return null;
}

function sanitizeSvgBuffer(buffer) {
  const source = String(buffer.toString('utf8') || '').replace(/^\s*<\?xml[^>]*>\s*/i, '');
  if (!/^\s*<svg\b/i.test(source) || /<!DOCTYPE|<!ENTITY/i.test(source)) return null;
  const clean = sanitizeHtml(source, {
    allowedTags: ['svg', 'g', 'path', 'rect', 'circle', 'ellipse', 'line', 'polyline', 'polygon', 'text', 'tspan', 'defs', 'lineargradient', 'radialgradient', 'stop', 'clippath', 'mask', 'use', 'title', 'desc'],
    allowedAttributes: {
      svg: ['xmlns', 'viewBox', 'viewbox', 'width', 'height', 'fill', 'stroke', 'role', 'aria-label'],
      '*': ['id', 'x', 'y', 'x1', 'x2', 'y1', 'y2', 'cx', 'cy', 'r', 'rx', 'ry', 'd', 'points', 'transform', 'fill', 'fill-rule', 'stroke', 'stroke-width', 'stroke-linecap', 'stroke-linejoin', 'opacity', 'offset', 'stop-color', 'stop-opacity', 'clip-path', 'mask', 'href', 'xlink:href', 'font-size', 'text-anchor'],
    },
    allowedSchemes: [],
    allowProtocolRelative: false,
    disallowedTagsMode: 'discard',
    exclusiveFilter(frame) {
      if (!['use'].includes(frame.tag)) return false;
      const href = frame.attribs?.href || frame.attribs?.['xlink:href'] || '';
      return Boolean(href && !href.startsWith('#'));
    },
  }).trim();
  return /^<svg\b/i.test(clean) ? Buffer.from(clean, 'utf8') : null;
}

async function openAnkiArchive(buffer, limits) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 4 || buffer.length > limits.storage.maxApkgSizeBytes) {
    throw new AnkiArchiveError('invalid-archive-size', 'Tamanho do APKG invalido ou acima do limite.');
  }
  if (buffer.subarray(0, 2).toString('binary') !== 'PK') throw new AnkiArchiveError('invalid-archive', 'O arquivo nao possui assinatura ZIP/APKG.');
  const { entries, warnings } = await readZip(buffer, limits);
  const collectionNames = ['collection.anki21b', 'collection.21b', 'collection.anki21', 'collection.anki2'];
  const collectionName = collectionNames.find((name) => entries.has(name));
  if (!collectionName) throw new AnkiArchiveError('missing-collection', 'O APKG nao contem uma collection suportada.');
  const modern = collectionName.endsWith('21b');
  const collectionBuffer = modern
    ? decompressZstdLimited(entries.get(collectionName), limits.anki.maxCollectionBytes)
    : entries.get(collectionName);
  if (collectionBuffer.subarray(0, 16).toString('binary') !== 'SQLite format 3\u0000') {
    throw new AnkiArchiveError('invalid-sqlite', 'A collection Anki nao e um banco SQLite valido.');
  }
  const manifest = parseMediaManifest(entries.get('media'), modern, limits);
  if (manifest.length > limits.anki.maxMediaFiles) throw new AnkiArchiveError('too-many-media', 'O APKG possui midias demais.');
  const media = [];
  for (const item of manifest) {
    let name;
    try { name = validateMediaName(item.name); } catch (_error) { warnings.push(_error.message); continue; }
    const raw = entries.get(String(item.zipName));
    if (!raw) { warnings.push(`Midia ausente no pacote: ${name}`); continue; }
    let data;
    try {
      data = modern ? decompressZstdLimited(raw, limits.anki.maxMediaFileSizeBytes) : raw;
    } catch (_error) {
      warnings.push(`Midia corrompida ignorada: ${name}`);
      continue;
    }
    if (data.length > limits.anki.maxMediaFileSizeBytes || (item.size != null && item.size !== data.length)) {
      warnings.push(`Midia fora do limite ou com tamanho divergente: ${name}`);
      continue;
    }
    if (item.sha1 && crypto.createHash('sha1').update(data).digest('hex') !== item.sha1) {
      warnings.push(`Midia com hash invalido ignorada: ${name}`);
      continue;
    }
    const contentType = detectMediaType(data, name);
    if (!contentType) { warnings.push(`Tipo de midia nao permitido: ${name}`); continue; }
    if (contentType === 'image/svg+xml') {
      data = sanitizeSvgBuffer(data);
      if (!data) { warnings.push(`SVG inseguro ignorado: ${name}`); continue; }
    }
    media.push({ name, data, contentType });
  }
  return { collectionBuffer, collectionName, media, warnings };
}

module.exports = {
  AnkiArchiveError,
  decodeModernMediaManifest,
  decompressZstdLimited,
  detectMediaType,
  isUnsafeArchiveName,
  openAnkiArchive,
  parseMediaManifest,
  readZip,
  sanitizeSvgBuffer,
  validateMediaName,
};
