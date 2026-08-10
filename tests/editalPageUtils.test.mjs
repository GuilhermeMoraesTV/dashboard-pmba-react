import test from 'node:test';
import assert from 'node:assert/strict';

import {
  filterEditalDisciplines,
  formatEditalProgressText,
  formatEditalStudyDate,
  prepareExternalEditalDisciplines,
} from '../src/utils/editalPageUtils.js';

test('ultimo estudo sempre exibe dia, mes e ano', () => {
  assert.equal(formatEditalStudyDate('2026-08-07T12:00:00-03:00'), '07/08/2026');
  assert.equal(formatEditalStudyDate(null), '-');
  assert.equal(formatEditalStudyDate('data-invalida'), '-');
});

test('progresso usa feitos/total topicos concluidos em uma unica linha', () => {
  assert.equal(formatEditalProgressText(50, 100), '50/100 tópicos concluídos');
});

test('busca por assunto filtra os topicos e expande a disciplina encontrada', () => {
  const result = filterEditalDisciplines([
    {
      nome: 'Língua Portuguesa',
      assuntos: [{ nome: 'Crase' }, { nome: 'Interpretação de textos' }],
    },
    {
      nome: 'Informática',
      assuntos: [{ nome: 'Segurança da informação' }],
    },
  ], 'interpretacao');

  assert.equal(result.disciplines.length, 1);
  assert.equal(result.disciplines[0].nome, 'Língua Portuguesa');
  assert.deepEqual(result.disciplines[0].assuntos.map((topic) => topic.nome), ['Interpretação de textos']);
  assert.deepEqual(result.autoExpandedNames, ['Língua Portuguesa']);
});

test('visualizacao externa prepara edital sem dados de progresso', () => {
  const [discipline] = prepareExternalEditalDisciplines({
    disciplinas: [{ nome: 'Direito Penal', assuntos: ['Teoria do crime'] }],
  });

  assert.equal(discipline.progresso, 0);
  assert.equal(discipline.stats.ultimaData, null);
  assert.equal(discipline.assuntos[0].estudado, false);
  assert.equal(discipline.assuntos[0].questoes, 0);
});
