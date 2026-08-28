import test from 'node:test';
import assert from 'node:assert/strict';
import { buildBancaOptions, PRINCIPAIS_BANCAS_CONCURSO } from '../src/utils/bancasConcurso.js';

test('oferece as principais bancas de concurso', () => {
  const options = buildBancaOptions();

  for (const banca of ['Cebraspe', 'FGV', 'FCC', 'Vunesp', 'Instituto AOCP']) {
    assert.ok(options.includes(banca));
  }
  assert.equal(options.length, PRINCIPAIS_BANCAS_CONCURSO.length);
});

test('ordena alfabeticamente toda a lista, incluindo bancas já cadastradas', () => {
  const options = buildBancaOptions([
    { banca: 'Zênite Concursos' },
    { banca: 'Banca Regional' },
  ]);
  const expected = [...options].sort((a, b) => a.localeCompare(b, 'pt-BR', { sensitivity: 'base' }));

  assert.deepEqual(options, expected);
  assert.ok(options.indexOf('Banca Regional') < options.indexOf('Cebraspe'));
  assert.equal(options.at(-1), 'Zênite Concursos');
});

test('incorpora bancas já cadastradas e remove duplicatas sem diferenciar caixa ou acento', () => {
  const options = buildBancaOptions([
    { banca: 'Banca Regional' },
    { banca: 'cebraspe' },
    { banca: 'Fundacao Cesgranrio' },
    { banca: ' Banca Regional ' },
  ]);

  assert.equal(options.filter(banca => banca.toLowerCase() === 'cebraspe').length, 1);
  assert.equal(options.filter(banca => banca === 'Banca Regional').length, 1);
  assert.equal(options.filter(banca => banca.includes('Cesgranrio')).length, 1);
});

test('mantém selecionável uma banca antiga do edital em edição', () => {
  const options = buildBancaOptions([], 'Comissão própria do órgão');

  assert.ok(options.includes('Comissão própria do órgão'));
});
