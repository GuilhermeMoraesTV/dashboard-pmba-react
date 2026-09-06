import { httpsCallable } from 'firebase/functions';
import { functions } from '../firebaseConfig';

export const ALLOWED_IMAGE_TYPES = Object.freeze([
  'image/jpeg',
  'image/jpg',
  'image/pjpeg',
  'image/png',
  'image/webp',
]);
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

const uploadSecureImageCallable = httpsCallable(functions, 'uploadSecureImage');

export const normalizeImageContentType = (type) => {
  const lower = String(type || '').toLowerCase().trim();
  if (lower === 'image/jpg' || lower === 'image/pjpeg') return 'image/jpeg';
  return lower;
};

export const detectImageContentType = (bytes, declaredType = '', fileName = '') => {
  if (bytes && bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return 'image/jpeg';
  }
  if (bytes && bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) {
    return 'image/png';
  }
  if (bytes && bytes.length >= 12
      && String.fromCharCode(...bytes.slice(0, 4)) === 'RIFF'
      && String.fromCharCode(...bytes.slice(8, 12)) === 'WEBP') {
    return 'image/webp';
  }
  const norm = normalizeImageContentType(declaredType);
  if (ALLOWED_IMAGE_TYPES.includes(norm)) return norm;
  const lowerName = String(fileName || '').toLowerCase();
  if (lowerName.endsWith('.jpg') || lowerName.endsWith('.jpeg')) return 'image/jpeg';
  if (lowerName.endsWith('.png')) return 'image/png';
  if (lowerName.endsWith('.webp')) return 'image/webp';
  return null;
};

export const validateImageFile = async (file) => {
  if (!file || typeof file.arrayBuffer !== 'function') throw new Error('Selecione uma imagem válida.');
  if (!Number.isFinite(file.size) || file.size <= 0 || file.size > MAX_IMAGE_BYTES) {
    throw new Error('A imagem deve ter no máximo 5 MB.');
  }
  const bytes = new Uint8Array(await file.slice(0, 16).arrayBuffer());
  const detectedType = detectImageContentType(bytes, file.type, file.name);
  if (!detectedType || !ALLOWED_IMAGE_TYPES.includes(detectedType)) {
    throw new Error('Use somente imagens nos formatos JPEG, PNG ou WebP.');
  }
  return detectedType;
};

const arrayBufferToBase64 = (arrayBuffer) => {
  const bytes = new Uint8Array(arrayBuffer);
  let binary = '';
  const chunkSize = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
  }
  return btoa(binary);
};

export const uploadSecureImage = async (file, { kind, groupId = null } = {}) => {
  const detectedType = await validateImageFile(file);
  const result = await uploadSecureImageCallable({
    kind,
    groupId,
    contentType: detectedType,
    base64: arrayBufferToBase64(await file.arrayBuffer()),
  });
  if (!result.data?.url) throw new Error('O servidor não retornou a URL da imagem.');
  return result.data;
};
