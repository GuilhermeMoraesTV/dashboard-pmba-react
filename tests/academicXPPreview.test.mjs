import test from 'node:test';
import assert from 'node:assert/strict';
import { estimateAcademicXPForRecord } from '../src/utils/academicXPPreview.js';

test('checkout de 60 minutos mostra imediatamente XP de registro e tempo', () => {
  assert.equal(estimateAcademicXPForRecord({
    existingRecords: [],
    record: { data: '2026-08-24', tempoEstudadoMinutos: 60 },
  }), 65);
});

test('prévia respeita blocos já acumulados e limite de registros', () => {
  const existingRecords = Array.from({ length: 10 }, (_, index) => ({
    id: `r-${index}`,
    data: '2026-08-24',
    tempoEstudadoMinutos: 1,
  }));
  assert.equal(estimateAcademicXPForRecord({
    existingRecords,
    record: { data: '2026-08-24', tempoEstudadoMinutos: 10 },
  }), 10);
});

test('revisão usa o mesmo evento e inclui bônus de revisão', () => {
  assert.equal(estimateAcademicXPForRecord({
    existingRecords: [],
    record: { data: '2026-08-24', tempoEstudadoMinutos: 20, tipoEstudo: 'revisao' },
  }), 45);
});

test('prévia compartilha os blocos diários com simulados como o backend', () => {
  assert.equal(estimateAcademicXPForRecord({
    existingRecords: [],
    existingSimulations: [{ data: '2026-08-24', durationMinutes: 9, resumo: { totalQuestoes: 4, totalAcertos: 4 } }],
    record: { data: '2026-08-24', tempoEstudadoMinutos: 1, questoesFeitas: 1, acertos: 1 },
  }), 25);
});
