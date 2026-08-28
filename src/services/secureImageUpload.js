import { getFunctions, httpsCallable } from 'firebase/functions';
import { app } from '../firebaseConfig';

export const ALLOWED_IMAGE_TYPES = Object.freeze(['image/jpeg', 'image/png', 'image/webp']);
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

const uploadSecureImageCallable = httpsCallable(getFunctions(app, 'us-central1'), 'uploadSecureImage');

const matchesSignature = (bytes, contentType) => {
  if (contentType === 'image/jpeg') return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (contentType === 'image/png') {
    const signature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
    return signature.every((value, index) => bytes[index] === value);
  }
  if (contentType === 'image/webp') {
    return bytes.length >= 12
      && String.fromCharCode(...bytes.slice(0, 4)) === 'RIFF'
      && String.fromCharCode(...bytes.slice(8, 12)) === 'WEBP';
  }
  return false;
};

export const validateImageFile = async (file) => {
  if (!file || typeof file.arrayBuffer !== 'function') throw new Error('Selecione uma imagem valida.');
  if (!ALLOWED_IMAGE_TYPES.includes(file.type)) throw new Error('Use somente imagens JPEG, PNG ou WebP.');
  if (!Number.isFinite(file.size) || file.size <= 0 || file.size > MAX_IMAGE_BYTES) {
    throw new Error('A imagem deve ter no maximo 5 MB.');
  }
  const bytes = new Uint8Array(await file.slice(0, 16).arrayBuffer());
  if (!matchesSignature(bytes, file.type)) throw new Error('O conteudo do arquivo nao corresponde a uma imagem valida.');
  return file;
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
  await validateImageFile(file);
  const result = await uploadSecureImageCallable({
    kind,
    groupId,
    contentType: file.type,
    base64: arrayBufferToBase64(await file.arrayBuffer()),
  });
  if (!result.data?.url) throw new Error('O servidor nao retornou a URL da imagem.');
  return result.data;
};
