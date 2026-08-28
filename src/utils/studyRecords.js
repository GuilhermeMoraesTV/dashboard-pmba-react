const MANUAL_COMPLETION_SOURCE = 'botao_concluir';
const MANUAL_COMPLETION_TYPE = 'check_manual';

export const isManualCompletionRecord = (record = {}) => {
  const source = String(record?.origemConclusao || '').trim().toLowerCase();
  const type = String(record?.tipoEstudo || '').trim().toLowerCase();
  return source === MANUAL_COMPLETION_SOURCE
    || type === MANUAL_COMPLETION_TYPE
    || record?.conclusaoManual === true;
};

export const getRecordedStudyMinutes = (record = {}) => {
  return Math.max(0, Number(record?.tempoEstudadoMinutos || record?.duracaoMinutos || 0));
};

export const normalizeRecordedStudyMinutes = (record = {}) => ({
  ...record,
  tempoPlanejadoConclusaoMinutos: Math.max(0, Number(
    record?.tempoPlanejadoConclusaoMinutos
    || (isManualCompletionRecord(record) ? record?.tempoEstudadoMinutos || record?.duracaoMinutos : 0)
    || 0
  )),
  tempoEstudadoMinutos: getRecordedStudyMinutes(record),
  duracaoMinutos: getRecordedStudyMinutes(record),
});
