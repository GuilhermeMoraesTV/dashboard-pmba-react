const sharp = require('sharp');

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const MAX_IMAGE_DIMENSION = 4096;
const MAX_IMAGE_PIXELS = 20_000_000;
const ALLOWED_CONTENT_TYPES = Object.freeze({
  'image/jpeg': { format: 'jpeg', extension: 'jpg' },
  'image/jpg': { format: 'jpeg', extension: 'jpg' },
  'image/pjpeg': { format: 'jpeg', extension: 'jpg' },
  'image/png': { format: 'png', extension: 'png' },
  'image/webp': { format: 'webp', extension: 'webp' },
});
const ALLOWED_KINDS = new Set(['profile-avatar', 'profile-cover', 'group', 'edital-logo', 'broadcast']);

const securityError = (code, message) => Object.assign(new Error(message), { code });

const decodeBase64Image = (value) => {
  if (typeof value !== 'string' || !value) {
    throw securityError('invalid-argument', 'Conteúdo da imagem inválido.');
  }
  const cleanBase64 = value.replace(/^data:image\/[a-zA-Z0-9+.-]+;base64,/, '').replace(/\s+/g, '');
  if (!/^[A-Za-z0-9+/_-]+={0,2}$/.test(cleanBase64)) {
    throw securityError('invalid-argument', 'Conteúdo da imagem inválido.');
  }
  const buffer = Buffer.from(cleanBase64, 'base64');
  if (!buffer.length || buffer.length > MAX_IMAGE_BYTES) {
    throw securityError('invalid-argument', 'A imagem deve ter no máximo 5 MB.');
  }
  return buffer;
};

const normalizeImage = async ({ base64, contentType }) => {
  const normalizedType = String(contentType || '').toLowerCase().trim();
  const expected = ALLOWED_CONTENT_TYPES[normalizedType];
  if (!expected) throw securityError('invalid-argument', 'Use somente imagens JPEG, PNG ou WebP.');
  const input = decodeBase64Image(base64);
  let metadata;
  try {
    metadata = await sharp(input, { failOn: 'error', limitInputPixels: MAX_IMAGE_PIXELS }).metadata();
  } catch {
    throw securityError('invalid-argument', 'O arquivo não é uma imagem válida ou segura.');
  }
  if (!metadata.format || !metadata.width || !metadata.height) {
    throw securityError('invalid-argument', 'Não foi possível ler as dimensões da imagem.');
  }
  if (!['jpeg', 'png', 'webp'].includes(metadata.format)) {
    throw securityError('invalid-argument', 'Use somente imagens nos formatos JPEG, PNG ou WebP.');
  }
  if (metadata.format !== expected.format) {
    throw securityError('invalid-argument', 'O conteúdo do arquivo não corresponde ao tipo informado.');
  }
  if ((metadata.pages || 1) !== 1) {
    throw securityError('invalid-argument', 'Imagens animadas não são permitidas.');
  }
  if (metadata.width > MAX_IMAGE_DIMENSION || metadata.height > MAX_IMAGE_DIMENSION || metadata.width * metadata.height > MAX_IMAGE_PIXELS) {
    throw securityError('invalid-argument', 'A imagem excede as dimensões máximas permitidas.');
  }

  let pipeline = sharp(input, { failOn: 'error', limitInputPixels: MAX_IMAGE_PIXELS })
    .rotate()
    .resize({
      width: MAX_IMAGE_DIMENSION,
      height: MAX_IMAGE_DIMENSION,
      fit: 'inside',
      withoutEnlargement: true,
    });
  if (metadata.format === 'jpeg') {
    try {
      pipeline = pipeline.jpeg({ quality: 88, mozjpeg: true });
    } catch {
      pipeline = pipeline.jpeg({ quality: 88 });
    }
  }
  if (metadata.format === 'png') pipeline = pipeline.png({ compressionLevel: 9, adaptiveFiltering: true });
  if (metadata.format === 'webp') pipeline = pipeline.webp({ quality: 88, effort: 5 });

  let output;
  try {
    output = await pipeline.toBuffer();
  } catch {
    throw securityError('invalid-argument', 'Não foi possível processar a imagem.');
  }
  if (!output.length || output.length > MAX_IMAGE_BYTES) {
    throw securityError('invalid-argument', 'A imagem processada excede 5 MB.');
  }
  const canonicalContentType = metadata.format === 'jpeg' ? 'image/jpeg' : metadata.format === 'png' ? 'image/png' : 'image/webp';
  const canonicalExtension = metadata.format === 'jpeg' ? 'jpg' : metadata.format === 'png' ? 'png' : 'webp';
  return {
    buffer: output,
    contentType: canonicalContentType,
    extension: canonicalExtension,
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

// Private support uses the same decoder, with stricter static-image checks.
const normalizeSupportImage = async ({ base64, contentType }) => {
  const limits = require('../shared/productLimits').DEFAULT_SERVER_PRODUCT_LIMITS.support;
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(contentType)
      || typeof base64 !== 'string' || base64.length > Math.ceil(limits.maxImageBytes / 3) * 4) {
    throw securityError('invalid-argument', 'Use JPEG, PNG ou WebP estático de até 5 MB.');
  }
  const input = decodeBase64Image(base64);
  try {
    const png = input.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]));
    const jpeg = input[0] === 255 && input[1] === 216 && input[2] === 255;
    const webp = input.toString('ascii', 0, 4) === 'RIFF' && input.toString('ascii', 8, 12) === 'WEBP';
    if (!(contentType === 'image/png' ? png : contentType === 'image/jpeg' ? jpeg : webp)) throw new Error('signature');
    // libvips may expose APNG as one page: inspect the actual PNG chunks too.
    if (png) for (let offset = 8; offset + 12 <= input.length;) {
      const length = input.readUInt32BE(offset);
      if (offset + 12 + length > input.length) throw new Error('truncated');
      if (input.toString('ascii', offset + 4, offset + 8) === 'acTL') throw new Error('animation');
      offset += length + 12;
    }
    const options = { failOn: 'warning', limitInputPixels: limits.maxPixels };
    const metadata = await sharp(input, options).metadata();
    if (metadata.format !== ALLOWED_CONTENT_TYPES[contentType].format || (metadata.pages || 1) !== 1
        || metadata.delay?.length || !metadata.width || !metadata.height
        || metadata.width * metadata.height > limits.maxPixels) throw new Error('dimensions/animation');
    const image = await sharp(input, options).rotate().resize({ width: limits.imageSide, height: limits.imageSide,
      fit: 'inside', withoutEnlargement: true }).webp({ quality: limits.imageQuality }).toBuffer({ resolveWithObject: true });
    const thumbnail = await sharp(image.data, options).resize({ width: limits.thumbnailSide, height: limits.thumbnailSide,
      fit: 'inside', withoutEnlargement: true }).webp({ quality: limits.thumbnailQuality }).toBuffer({ resolveWithObject: true });
    return { image, thumbnail };
  } catch {
    throw securityError('invalid-argument', 'Imagem inválida, corrompida, animada ou acima de 25 megapixels.');
  }
};

const buildStoragePath = ({ kind, uid, groupId, randomId }) => {
  if (!ALLOWED_KINDS.has(kind)) throw securityError('invalid-argument', 'Destino de upload invalido.');
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(String(uid || ''))) throw securityError('unauthenticated', 'Usuario invalido.');
  if (kind === 'group') return `study_group_images/${uid}/${assertSafeGroupId(groupId)}/profile`;
  const safeRandomId = String(randomId || '').replace(/[^A-Za-z0-9_-]/g, '').slice(0, 80);
  if (!safeRandomId) throw securityError('internal', 'Identificador interno de upload ausente.');
  // Cada envio tem identidade própria: limpar a imagem anterior ou desfazer
  // uma gravação de perfil malsucedida não pode apagar a outra versão.
  if (kind === 'profile-avatar') return `profile_images/${uid}/avatar-${safeRandomId}`;
  if (kind === 'profile-cover') return `profile_images/${uid}/covers/cover-${safeRandomId}`;
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
  normalizeSupportImage,
};
