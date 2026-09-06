const EMPTY = Object.freeze({});
const previews = new Map();
const listeners = new Set();
let sequence = 0;

export const subscribeProfileImages = (listener) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};
export const getProfileImages = (uid) => previews.get(uid) || EMPTY;

function setChannel(uid, channel, entry) {
  const next = { ...getProfileImages(uid) };
  if (entry) next[channel] = entry;
  else delete next[channel];
  if (Object.keys(next).length) previews.set(uid, next);
  else previews.delete(uid);
  listeners.forEach((listener) => listener());
}

export function reconcileProfileImages(uid, profile) {
  for (const [channel, entry] of Object.entries(getProfileImages(uid))) {
    if (entry.status === 'saved' && Object.entries(entry.values).every(
      ([key, value]) => JSON.stringify(profile?.[key]) === JSON.stringify(value),
    )) setChannel(uid, channel, null);
  }
}

// O Firestore é a confirmação do perfil. Auth é uma projeção secundária:
// uma falha nela não deve transformar uma gravação concluída em falso erro.
export async function saveProfileImage({ uid, channel, preview, upload, persist, syncAuth, releasePreview = () => {} }) {
  if (getProfileImages(uid)[channel]?.status === 'saving') {
    releasePreview();
    throw new Error('Aguarde o salvamento desta imagem.');
  }
  const previous = getProfileImages(uid)[channel];
  const id = ++sequence;
  setChannel(uid, channel, { id, status: 'saving', values: preview });
  try {
    const values = await upload();
    await persist(values);
    setChannel(uid, channel, { id, status: 'saved', values });
    if (syncAuth) {
      Promise.resolve().then(() => syncAuth(values)).catch((error) => {
        console.warn('Perfil salvo; sincronização secundária com Auth pendente:', error);
      });
    }
    return values;
  } catch (error) {
    setChannel(uid, channel, previous);
    throw error;
  } finally {
    releasePreview();
  }
}
