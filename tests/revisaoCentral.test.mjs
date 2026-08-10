import test from 'node:test';
import assert from 'node:assert/strict';
import { buildRevisaoCentral, filterRevisaoCentralItems } from '../src/utils/revisaoCentral.js';

const reference = new Date(2026, 7, 6);

test('normaliza ciclo, ranqueia atrasos e calcula recuperacao', () => {
  const result = buildRevisaoCentral({
    ciclo: { id: 'c1', disciplinas: [{ id: 'penal', nome: 'Direito Penal', assuntos: ['Crime', 'Pena'] }] },
    revisoesCiclo: [
      { id: 'r1', cicloId: 'c1', disciplinaId: 'penal', disciplinaNome: 'Direito Penal', assunto: 'Crime', dataAgendada: '2026-08-01', intervaloDias: 30, tempoMinutos: 25, concluida: false },
      { id: 'r2', cicloId: 'c1', disciplinaId: 'penal', disciplinaNome: 'Direito Penal', assunto: 'Pena', dataAgendada: '2026-08-06', intervaloDias: 7, tempoMinutos: 15, concluida: false },
    ],
    dataReferencia: reference,
  });

  assert.equal(result.buckets.atrasadas.length, 1);
  assert.equal(result.buckets.hoje.length, 1);
  assert.equal(result.facaPrimeiro[0].assunto, 'Crime');
  assert.equal(result.recuperacao.minutos, 25);
  assert.equal(result.recuperacao.opcoes[1].minutosPorDia, 9);
  assert.match(result.insight, /Direito Penal/);
});

test('usa registros de revisao na cobertura e separa resolvidas', () => {
  const result = buildRevisaoCentral({
    ciclo: { id: 'c1', disciplinas: [{ id: 'const', nome: 'Constitucional', assuntos: ['Direitos fundamentais', 'Estado'] }] },
    revisoesCiclo: [
      { id: 'r1', cicloId: 'c1', disciplinaId: 'const', disciplinaNome: 'Constitucional', assunto: 'Direitos fundamentais', dataAgendada: '2026-08-06', intervaloDias: 7, concluida: true },
    ],
    registrosEstudo: [
      { disciplinaId: 'const', disciplinaNome: 'Constitucional', assunto: 'Direitos fundamentais', data: '2026-08-01', tipoEstudo: 'revisao', isRevisao: true },
    ],
    dataReferencia: reference,
  });

  assert.equal(result.buckets.resolvidas.length, 1);
  assert.equal(result.cobertura.percentual, 50);
  assert.equal(result.cobertura.semRevisaoRecente[0].assunto, 'Estado');
});

test('filtra por origem, disciplina, intervalo, status e busca sem acento', () => {
  const items = [
    { origem: 'ciclo', disciplinaId: 'pt', disciplinaNome: 'Língua Portuguesa', assunto: 'Acentuação', intervaloDias: 7, status: 'atrasada' },
    { origem: 'cronograma', disciplinaId: 'mat', disciplinaNome: 'Matemática', assunto: 'Razão', intervaloDias: 30, status: 'proxima' },
  ];
  const filtered = filterRevisaoCentralItems(items, { origem: 'ciclo', disciplina: 'pt', intervalo: '7', status: 'atrasada', busca: 'acentuacao' });
  assert.equal(filtered.length, 1);
  assert.equal(filtered[0].disciplinaId, 'pt');
});
