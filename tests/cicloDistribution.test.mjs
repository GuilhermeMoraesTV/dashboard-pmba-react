import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { calcularDistribuicao, gerarOrdemSessoes } from '../src/utils/cicloDistribution.js';

describe('cicloDistribution rotativo livre', () => {
  it('prioriza menor conhecimento quando a importancia e igual', () => {
    const distribuicao = calcularDistribuicao([
      { id: 'baixo', conhecimentoNivel: 1, importanciaNivel: 3, assuntos: ['A'] },
      { id: 'alto', conhecimentoNivel: 5, importanciaNivel: 3, assuntos: ['A'] },
    ], 600, 60, { duracaoMinimaSessaoMinutos: 30, duracaoMaximaSessaoMinutos: 60 });

    const baixo = distribuicao.find((item) => item.id === 'baixo');
    const alto = distribuicao.find((item) => item.id === 'alto');
    assert.ok(baixo.tempoAlocadoMinutos > alto.tempoAlocadoMinutos);
  });

  it('prioriza maior importancia quando o conhecimento e igual', () => {
    const distribuicao = calcularDistribuicao([
      { id: 'essencial', conhecimentoNivel: 3, importanciaNivel: 5, assuntos: ['A'] },
      { id: 'menor', conhecimentoNivel: 3, importanciaNivel: 1, assuntos: ['A'] },
    ], 600, 60, { duracaoMinimaSessaoMinutos: 30, duracaoMaximaSessaoMinutos: 60 });

    const essencial = distribuicao.find((item) => item.id === 'essencial');
    const menor = distribuicao.find((item) => item.id === 'menor');
    assert.ok(essencial.tempoAlocadoMinutos > menor.tempoAlocadoMinutos);
  });

  it('combina conhecimento e importancia em partes iguais', () => {
    const distribuicao = calcularDistribuicao([
      { id: 'necessidade', conhecimentoNivel: 1, importanciaNivel: 1, assuntos: ['A'] },
      { id: 'relevancia', conhecimentoNivel: 5, importanciaNivel: 5, assuntos: ['A'] },
    ], 600, 60, { duracaoMinimaSessaoMinutos: 30, duracaoMaximaSessaoMinutos: 60 });

    assert.equal(distribuicao[0].tempoAlocadoMinutos, distribuicao[1].tempoAlocadoMinutos);
  });

  it('preserva a carga exata e divide em sessoes dentro do intervalo', () => {
    const distribuicao = calcularDistribuicao([
      { id: 'a', conhecimentoNivel: 1, importanciaNivel: 5, assuntos: ['A', 'B'] },
      { id: 'b', conhecimentoNivel: 3, importanciaNivel: 3, assuntos: ['A'] },
      { id: 'c', conhecimentoNivel: 5, importanciaNivel: 1, assuntos: ['A'] },
    ], 480, 60, { duracaoMinimaSessaoMinutos: 30, duracaoMaximaSessaoMinutos: 60 });

    assert.equal(distribuicao.reduce((total, item) => total + item.tempoAlocadoMinutos, 0), 480);
    distribuicao.forEach((disciplina) => {
      assert.equal(disciplina.duracoesSessoes.reduce((total, minutos) => total + minutos, 0), disciplina.tempoAlocadoMinutos);
      disciplina.duracoesSessoes.forEach((minutos) => assert.ok(minutos >= 30 && minutos <= 60));
    });
  });

  it('gera fila estavel em round-robin sem reservar dias ou criar atraso', () => {
    const distribuicao = calcularDistribuicao([
      { id: 'a', conhecimentoNivel: 3, importanciaNivel: 3, assuntos: ['A'] },
      { id: 'b', conhecimentoNivel: 3, importanciaNivel: 3, assuntos: ['A'] },
      { id: 'c', conhecimentoNivel: 3, importanciaNivel: 3, assuntos: ['A'] },
    ], 270, 60, { duracaoMinimaSessaoMinutos: 30, duracaoMaximaSessaoMinutos: 60 });
    const ordem = gerarOrdemSessoes(distribuicao);

    assert.deepEqual(ordem.slice(0, 3).map((item) => item.disciplinaId), ['a', 'b', 'c']);
    assert.equal(
      ordem.reduce((total, item) => total + item.tempoPlanejadoMinutos, 0),
      270,
    );
    assert.equal(ordem.some((item) => item.assignedDate || item.carriedOver), false);
  });
});
