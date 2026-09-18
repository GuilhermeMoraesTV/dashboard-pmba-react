import {
  collection,
  doc,
  getDocs,
  limit,
  query,
  setDoc,
  Timestamp,
  where,
} from 'firebase/firestore';

const TOPIC_COMPLETION_LOOKUP_LIMIT = 10;

const normalizeText = (value) => String(value || '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .trim()
  .toLowerCase();

const getContextConfig = (contextoRegistro, contextId) => {
  if (contextoRegistro === 'ciclo' && contextId) {
    return { field: 'cicloId', value: contextId };
  }
  if (contextoRegistro === 'cronograma' && contextId) {
    return { field: 'cronogramaId', value: contextId };
  }
  return null;
};

const matchesDiscipline = (record, disciplinaId, disciplinaNome) => {
  const expectedId = String(disciplinaId || '').trim();
  const actualId = String(record?.disciplinaId || '').trim();
  if (expectedId && actualId && expectedId === actualId) return true;

  const expectedName = normalizeText(disciplinaNome);
  const actualName = normalizeText(record?.disciplinaNome);
  return Boolean(expectedName && actualName && expectedName === actualName);
};

const hashText = (value, seed) => {
  let hash = seed >>> 0;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
};

export const getTopicCompletionRecordId = ({
  contextoRegistro,
  contextId,
  disciplinaId,
  disciplinaNome,
  assunto,
}) => {
  const identity = [
    contextoRegistro,
    contextId,
    disciplinaId || normalizeText(disciplinaNome),
    normalizeText(assunto),
  ].map((value) => String(value || '')).join('\u001f');

  return `topic-completion-${hashText(identity, 2166136261)}${hashText(identity, 2246822519)}`;
};

export const buildTopicCompletionRecord = ({
  contextoRegistro,
  contextId,
  disciplinaId,
  disciplinaNome,
  assunto,
  data,
  obs,
  origem,
  cicloNome,
  cicloTipo,
}) => {
  const context = getContextConfig(contextoRegistro, contextId);
  if (!context || !assunto) return null;

  return {
    [context.field]: context.value,
    contextoRegistro,
    ...(contextoRegistro === 'ciclo' && cicloNome ? { cicloNome } : {}),
    ...(contextoRegistro === 'ciclo' && cicloTipo ? { cicloTipo } : {}),
    disciplinaId: disciplinaId || null,
    disciplinaNome: disciplinaNome || 'Disciplina',
    assunto,
    data,
    timestamp: Timestamp.now(),
    tempoEstudadoMinutos: 0,
    duracaoMinutos: 0,
    questoesFeitas: 0,
    acertos: 0,
    questoesAcertadas: 0,
    tipoEstudo: 'check_manual',
    obs,
    origem,
  };
};

export const findTopicCompletionRecord = async ({
  db,
  userUid,
  contextoRegistro,
  contextId,
  disciplinaId,
  disciplinaNome,
  assunto,
}) => {
  const context = getContextConfig(contextoRegistro, contextId);
  if (!db || !userUid || !context || !assunto) return null;

  const registrosRef = collection(db, 'users', userUid, 'registrosEstudo');
  const snapshot = await getDocs(query(
    registrosRef,
    where(context.field, '==', context.value),
    where('assunto', '==', assunto),
    where('tipoEstudo', '==', 'check_manual'),
    limit(TOPIC_COMPLETION_LOOKUP_LIMIT),
  ));

  return snapshot.docs.find((document) => (
    matchesDiscipline(document.data(), disciplinaId, disciplinaNome)
  )) || null;
};

export const hasTopicCompletionRecord = async (params) => (
  Boolean(await findTopicCompletionRecord(params))
);

export const ensureTopicCompletionRecord = async (params) => {
  const existing = await findTopicCompletionRecord(params);
  if (existing) return { created: false, id: existing.id };

  const payload = buildTopicCompletionRecord(params);
  if (!payload) return { created: false, id: null };

  const registroRef = doc(
    collection(params.db, 'users', params.userUid, 'registrosEstudo'),
    getTopicCompletionRecordId(params),
  );
  await setDoc(registroRef, payload);
  return { created: true, id: registroRef.id };
};
