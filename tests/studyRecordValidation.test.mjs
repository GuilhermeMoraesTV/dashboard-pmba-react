import test from 'node:test';
import assert from 'node:assert/strict';

import {
  assertStudyRecordMinutesAreValid,
  getStudyRecordMinutesValidationMessage,
  getStudyRecordSaveErrorMessage,
  STUDY_RECORD_MAX_MINUTES,
  STUDY_RECORD_MINUTES_ERROR_CODE,
} from '../src/services/studyRecords/validation.js';

test('limite de minutos do cliente permanece alinhado ao Firestore', () => {
  assert.equal(STUDY_RECORD_MAX_MINUTES, 720);
  assert.equal(assertStudyRecordMinutesAreValid(720), 720);
  assert.equal(getStudyRecordMinutesValidationMessage(720), '');
});

test('registro acima de 12 horas falha antes de chegar ao Firestore', () => {
  assert.throws(
    () => assertStudyRecordMinutesAreValid(1080),
    (error) => {
      assert.equal(error.code, STUDY_RECORD_MINUTES_ERROR_CODE);
      assert.match(error.message, /no máximo 12 horas/);
      return true;
    },
  );
  assert.throws(() => assertStudyRecordMinutesAreValid(Number.NaN), /tempo de estudo válido/);
  assert.throws(() => assertStudyRecordMinutesAreValid(-1), /tempo de estudo válido/);
});

test('mensagem conhecida e fallback de persistencia sao amigaveis', () => {
  const rangeError = new RangeError(getStudyRecordMinutesValidationMessage(721));
  rangeError.code = STUDY_RECORD_MINUTES_ERROR_CODE;
  assert.match(getStudyRecordSaveErrorMessage(rangeError), /divida o estudo/);
  assert.equal(getStudyRecordSaveErrorMessage({ code: 'permission-denied' }), 'Erro ao salvar. Tente novamente.');
});
