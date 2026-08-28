const sharp = require('sharp');

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const MAX_IMAGE_DIMENSION = 4096;
const MAX_IMAGE_PIXELS = 20_000_000;
const ALLOWED_CONTENT_TYPES = Object.freeze({
  'image/jpeg': { format: 'jpeg', extension: 'jpg' },
  'image/png': { format: 'png', extension: 'png' },
  'image/webp': { format: 'webp', extension: 'webp' },
});
const ALLOWED_KINDS = new Set(['profile-avatar', 'profile-cover', 'group', 'edital-logo', 'broadcast']);

const securityError = (code, message) => Object.assign(new Error(message), { code });

const decodeBase64Image = (value) => {
  if (typeof value !== 'string' || !value || !/^[A-Za-z0-9+/]+={0,2}$/.test(value)) {
    throw securityError('invalid-argument', 'Conteudo da imagem invalido.');
  }
  const estimatedBytes = Math.floor((value.length * 3) / 4);
  if (estimatedBytes > MAX_IMAGE_BYTES + 2) {
    throw securityError('invalid-argument', 'A imagem deve ter no maximo 5 MB.');
  }
  const buffer = Buffer.from(value, 'base64');
  if (!buffer.length || buffer.length > MAX_IMAGE_BYTES) {
    throw securityError('invalid-argument', 'A imagem deve ter no maximo 5 MB.');
  }
  return buffer;
};

const normalizeImage = async ({ base64, contentType }) => {
  const expected = ALLOWED_CONTENT_TYPES[contentType];
  if (!expected) {
    throw securityError('invalid-argument', 'Use somente imagens JPEG, PNG ou WebP.');
  }
  const input = decodeBase64Image(base64);
  let metadata;
  try {
    metadata = await sharp(input, { failOn: 'error', limitInputPixels: MAX_IMAGE_PIXELS }).metadata();
  } catch {
    throw securityError('invalid-argument', 'O arquivo nao e uma imagem valida ou segura.');
  }
  if (metadata.format !== expected.format || !metadata.width || !metadata.height) {
    throw securityError('invalid-argument', 'O conteudo do arquivo nao corresponde ao tipo informado.');
  }
  if ((metadata.pages || 1) !== 1) {
    throw securityError('invalid-argument', 'Imagens animadas nao sao permitidas.');
  }
  if (metadata.width > MAX_IMAGE_DIMENSION || metadata.height > MAX_IMAGE_DIMENSION || metadata.width * metadata.height > MAX_IMAGE_PIXELS) {
    throw securityError('invalid-argument', 'A imagem excede as dimensoes permitidas.');
  }

  let pipeline = sharp(input, { failOn: 'error', limitInputPixels: MAX_IMAGE_PIXELS })
    .rotate()
    .resize({
      width: MAX_IMAGE_DIMENSION,
      height: MAX_IMAGE_DIMENSION,
      fit: 'inside',
      withoutEnlargement: true,
    });
  if (metadata.format === 'jpeg') pipeline = pipeline.jpeg({ quality: 88, mozjpeg: true });
  if (metadata.format === 'png') pipeline = pipeline.png({ compressionLevel: 9, adaptiveFiltering: true });
  if (metadata.format === 'webp') pipeline = pipeline.webp({ quality: 88, effort: 5 });

  let output;
  try {
    output = await pipeline.toBuffer();
  } catch {
    throw securityError('invalid-argument', 'Nao foi possivel normalizar a imagem.');
  }
  if (!output.length || output.length > MAX_IMAGE_BYTES) {
    throw securityError('invalid-argument', 'A imagem processada excede 5 MB.');
  }
  return {
    buffer: output,
    contentType,
    extension: expected.extension,
    width: metadata.width,
    height: metadata.height,
  };
};

const assertSafeGroupId = (groupId) => {
  const normalized = String(groupId || '').trim();
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(normalized)) {
    throw securityError('invalid-argument', 'Identificador de grupo invalido.');
  }
  return normalized;
};

const buildStoragePath = ({ kind, uid, groupId, randomId }) => {
  if (!ALLOWED_KINDS.has(kind)) throw securityError('invalid-argument', 'Destino de upload invalido.');
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(String(uid || ''))) throw securityError('unauthenticated', 'Usuario invalido.');
  if (kind === 'profile-avatar') return `profile_images/${uid}/avatar`;
  if (kind === 'profile-cover') return `profile_images/${uid}/covers/cover`;
  if (kind === 'group') return `study_group_images/${uid}/${assertSafeGroupId(groupId)}/profile`;
  const safeRandomId = String(randomId || '').replace(/[^A-Za-z0-9_-]/g, '').slice(0, 80);
  if (!safeRandomId) throw securityError('internal', 'Identificador interno de upload ausente.');
  return kind === 'edital-logo' ? `editais_logos/${safeRandomId}` : `broadcasts/${safeRandomId}`;
};

module.exports = {
  ALLOWED_CONTENT_TYPES,
  ALLOWED_KINDS,
  MAX_IMAGE_BYTES,
  MAX_IMAGE_DIMENSION,
  MAX_IMAGE_PIXELS,
  buildStoragePath,
  decodeBase64Image,
  normalizeImage,
};
