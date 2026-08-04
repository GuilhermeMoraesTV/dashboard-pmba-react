import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  calcularDistribuicao,
  gerarOrdemSessoes,
} from '../src/utils/cicloDistribution.js';

const diasUteisComUmaHora = {
  1: 1,
  2: 1,
  3: 1,
  4: 1,
  5: 1,
};

describe('cicloDistribution', () => {
  it('prioriza disciplinas com maior dificuldade no rateio de sessoes', () => {
    const distribuicao = calcularDistribuicao(
      [
        { id: 'mat', nome: 'Matematica', nivelDominio: 'iniciante' },
        { id: 'pt', nome: 'Portugues', nivelDominio: 'avancado' },
      ],
      600,
      60
    );

    const matematica = distribuicao.find((item) => item.id === 'mat');
    const portugues = distribuicao.find((item) => item.id === 'pt');

    assert.ok(matematica.sessoesPorCiclo > portugues.sessoesPorCiclo);
    assert.ok(matematica.tempoAlocadoMinutos > portugues.tempoAlocadoMinutos);
  });

  it('mantem a soma da distribuicao alinhada com a carga planejada', () => {
    const distribuicao = calcularDistribuicao(
      [
        { id: 'a', nivelDominio: 'iniciante' },
        { id: 'b', nivelDominio: 'intermediario' },
        { id: 'c', nivelDominio: 'avancado' },
      ],
      480,
      60
    );

    const totalMinutos = distribuicao.reduce((total, item) => total + item.tempoAlocadoMinutos, 0);
    const totalSessoes = distribuicao.reduce((total, item) => total + item.sessoesPorCiclo, 0);

    assert.equal(totalMinutos, 480);
    assert.equal(totalSessoes, 8);
  });

  it('conta sobras de tempo como sessoes parciais sem inflar a carga planejada', () => {
    const distribuicao = calcularDistribuicao(
      [
        { id: 'a', nivelDominio: 'intermediario' },
        { id: 'b', nivelDominio: 'intermediario' },
        { id: 'c', nivelDominio: 'intermediario' },
      ],
      130,
      60,
      { diasEstudo: { 1: 2.1667 } }
    );

    const totalMinutos = distribuicao.reduce((total, item) => total + item.tempoAlocadoMinutos, 0);
    const totalSessoes = distribuicao.reduce((total, item) => total + item.sessoesPorCiclo, 0);

    assert.equal(totalMinutos, 130);
    assert.equal(totalSessoes, 3);
  });

  it('reserva uma sessao por dia ativo para a disciplina marcada como todos os dias', () => {
    const distribuicao = calcularDistribuicao(
      [
        { id: 'lei', nome: 'Legislacao', nivelDominio: 'intermediario', estudarTodosDias: true },
        { id: 'inf', nome: 'Informatica', nivelDominio: 'iniciante' },
      ],
      300,
      60,
      { diasEstudo: diasUteisComUmaHora }
    );

    const diaria = distribuicao.find((item) => item.id === 'lei');
    const ordem = gerarOrdemSessoes(distribuicao, 0, {
      diasEstudo: diasUteisComUmaHora,
      tempoSessaoMinutos: 60,
    });

    assert.ok(diaria.sessoesPorCiclo >= 5);
    assert.equal(ordem.length, distribuicao.reduce((total, item) => total + item.sessoesPorCiclo, 0));
    assert.deepEqual(ordem.slice(0, 5).map((item) => item.disciplinaId), ['lei', 'lei', 'lei', 'lei', 'lei']);
  });

  it('reserva sessoes diarias para mais de uma disciplina marcada', () => {
    const diasComDuasSessoes = {
      1: 2,
      2: 2,
      3: 2,
    };
    const distribuicao = calcularDistribuicao(
      [
        { id: 'lei', nome: 'Legislacao', nivelDominio: 'intermediario', estudarTodosDias: true },
        { id: 'pt', nome: 'Portugues', nivelDominio: 'intermediario', estudarTodosDias: true },
        { id: 'inf', nome: 'Informatica', nivelDominio: 'iniciante' },
      ],
      360,
      60,
      { diasEstudo: diasComDuasSessoes }
    );

    const ordem = gerarOrdemSessoes(distribuicao, 0, {
      diasEstudo: diasComDuasSessoes,
      tempoSessaoMinutos: 60,
    });

    const blocosPorDia = [ordem.slice(0, 2), ordem.slice(2, 4), ordem.slice(4, 6)];
    blocosPorDia.forEach((blocos) => {
      assert.deepEqual(blocos.map((item) => item.disciplinaId).sort(), ['lei', 'pt']);
    });
  });
});
