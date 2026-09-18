import { DEFAULT_PRODUCT_LIMITS } from '../../config/productLimits.js';

export const STUDY_RECORD_MAX_MINUTES = DEFAULT_PRODUCT_LIMITS.studyRecords.maxMinutesPerRecord;
export const STUDY_RECORD_MINUTES_ERROR_CODE = 'study-record-minutes-out-of-range';

const MAX_HOURS_LABEL = STUDY_RECORD_MAX_MINUTES / 60;

/**
 * Retorna uma mensagem amigavel quando os minutos nao podem ser persistidos.
 * @param {unknown} value
 * @returns {string}
 */
export function getStudyRecordMinutesValidationMessage(value) {
  const minutes = Number(value);
  if (!Number.isFinite(minutes) || minutes < 0) {
    return 'Informe um tempo de estudo válido.';
  }
  if (minutes > STUDY_RECORD_MAX_MINUTES) {
    return `Cada registro aceita no máximo ${MAX_HOURS_LABEL} horas. Ajuste o tempo ou divida o estudo em mais de um registro.`;
  }
  return '';
}

/**
 * Impede que qualquer fluxo do cliente envie um registro fora do contrato das Rules.
 * @param {unknown} value
 * @returns {number}
 */
export function assertStudyRecordMinutesAreValid(value) {
  const message = getStudyRecordMinutesValidationMessage(value);
  if (message) {
    const error = new RangeError(message);
    error.code = STUDY_RECORD_MINUTES_ERROR_CODE;
    throw error;
  }
  return Number(value);
}

/**
 * Preserva mensagens de validacao conhecidas e esconde detalhes internos do Firebase.
 * @param {unknown} error
 * @param {string} fallback
 * @returns {string}
 */
export function getStudyRecordSaveErrorMessage(error, fallback = 'Erro ao salvar. Tente novamente.') {
  return error?.code === STUDY_RECORD_MINUTES_ERROR_CODE && error?.message
    ? error.message
    : fallback;
}
