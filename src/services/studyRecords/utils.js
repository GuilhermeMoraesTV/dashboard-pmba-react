import { normalizeRecordedStudyMinutes } from '../../utils/studyRecords.js';

export const dateToYMD = (date) => {
  const day = date.getDate();
  const month = date.getMonth() + 1;
  const year = date.getFullYear();
  return `${year}-${month <= 9 ? `0${month}` : month}-${day <= 9 ? `0${day}` : day}`;
};

export const ymdToDateLocal = (value) => {
  if (!value || typeof value !== 'string') return new Date();
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, (month || 1) - 1, day || 1, 12, 0, 0);
};

export const isRegistroContext = (value) => value === 'ciclo' || value === 'cronograma';

const normalizeRegistroData = (id, data = {}) => {
  let dataStr = data.data;
  if (data.data?.toDate) dataStr = dateToYMD(data.data.toDate());
  if (!dataStr && data.timestamp?.toDate) dataStr = dateToYMD(data.timestamp.toDate());
  return normalizeRecordedStudyMinutes({
    id,
    ...data,
    data: dataStr,
    tempoEstudadoMinutos: Number(data.tempoEstudadoMinutos || 0),
    questoesFeitas: Number(data.questoesFeitas || 0),
    acertos: Number(data.acertos || 0),
  });
};

export const normalizeRegistroEstudo = (docSnap) => normalizeRegistroData(docSnap.id, docSnap.data());

export const normalizeRegistroPayload = (id, data = {}) => normalizeRegistroData(id, data);

export const sortRegistrosEstudo = (items = []) => [...items].sort((a, b) => {
  const timestampA = a.timestamp?.seconds || (a.timestamp instanceof Date ? a.timestamp.getTime() / 1000 : 0);
  const timestampB = b.timestamp?.seconds || (b.timestamp instanceof Date ? b.timestamp.getTime() / 1000 : 0);
  if (a.data === b.data) return timestampB - timestampA;
  return a.data < b.data ? 1 : -1;
});

export const getCompletionDocId = (origemConclusaoId) => {
  if (!origemConclusaoId) return null;
  return `completion_${encodeURIComponent(String(origemConclusaoId)).replace(/\./g, '%2E')}`;
};
