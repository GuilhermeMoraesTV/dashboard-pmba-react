/**
 * src/services/scheduling/core.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Funções matemáticas puras do sistema de cronograma MODOQAP.
 *
 * REGRAS ABSOLUTAS deste arquivo:
 *   • Zero imports de React, Firebase, fetch ou qualquer pacote externo.
 *   • Todas as exportações são named exports (export function / export const).
 *   • Todas as funções são puras: mesmo input → mesmo output, sem efeitos colaterais.
 *   • arredondar5() é definida UMA única vez aqui (unificada de cronogramaIA.js
 *     e useCronogramaSystem.js, que tinham implementações 100% idênticas).
 *   • distribuirMinutosPorPeso() retorna valores brutos — sem arredondar5() interno.
 *     O arredondamento acontece apenas no ponto de montagem do slot (scheduling/index.js).
 *
 * CORREÇÕES (v2):
 *   [FIX-B] calcularSemanas() — o limite hard de 26 semanas foi substituído por um
 *           limite dinâmico calculado a partir do número real de tópicos e da
 *           capacidade semanal. Isso garante que o cronograma sempre cobre TODO
 *           o edital, independente de quantas disciplinas/assuntos existam.
 *           O limite máximo agora é MAX(semanas_necessárias, semanas_até_prova),
 *           com um teto de segurança de 104 semanas (2 anos) apenas para evitar
 *           loops infinitos em configurações degeneradas.
 *
 *   [FIX-B2] LIMITE_SEMANAS elevado para 104 (2 anos) como teto de segurança,
 *            mas na prática calcularSemanas() retorna o valor exato necessário
 *            para cobrir todos os tópicos — nunca trunca antes disso.
 */

import { calculatePlanningPriority } from '../../utils/planningPriority.js';

// ─── DIAS DA SEMANA ───────────────────────────────────────────────────────────

/** Nomes dos dias da semana indexados por número (0 = Domingo). */
export const DIA_NOMES = [
  'Domingo',
  'Segunda-feira',
  'Terça-feira',
  'Quarta-feira',
  'Quinta-feira',
  'Sexta-feira',
  'Sábado',
];

// ─── ARREDONDAMENTO ───────────────────────────────────────────────────────────

/**
 * Arredonda minutos para o múltiplo de 5 mais próximo, com mínimo de 5.
 * Garante que todos os tempos exibidos no cronograma sejam "redondos".
 *
 * @param {number} minutos - valor bruto de minutos
 * @returns {number} múltiplo de 5 mais próximo, nunca inferior a 5
 */
export function arredondar5(minutos) {
  return Math.max(5, Math.round(minutos / 5) * 5);
}

// ─── NORMALIZAÇÃO DE NÍVEL ────────────────────────────────────────────────────

/**
 * Normaliza o valor de nível para a chave interna sem acento.
 * Aceita qualquer variação de maiúsculas, acentos e aliases
 * (ex: 'médio' → 'intermediario', 'Avançado' → 'avancado').
 *
 * @param {string} nivel - valor recebido do banco/state/UI
 * @returns {'iniciante'|'intermediario'|'avancado'} chave interna normalizada
 */
export function normalizarNivel(nivel) {
  const s = String(nivel || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, ''); // remove diacríticos (acentos, cedilha, etc.)

  if (s === 'iniciante') return 'iniciante';
  if (s === 'avancado')  return 'avancado';
  return 'intermediario';
}

// ─── CONSTANTES DE PESO E PRIORIDADE ─────────────────────────────────────────

/**
 * Peso fixo por nível, usado na distribuição proporcional de blocos/minutos.
 * Iniciante recebe mais tempo; avançado, menos.
 */
export const PESO_ALOCACAO_POR_NIVEL = {
  iniciante:     2.5,
  intermediario: 1.5,
  avancado:      1.0,
};

/**
 * Alias legado de PESO_ALOCACAO_POR_NIVEL.
 * Mantido para compatibilidade com imports existentes de cronogramaAlocacao.js.
 */
export const FATOR_NECESSIDADE = PESO_ALOCACAO_POR_NIVEL;

/**
 * Ordem de prioridade numérica por nível (maior número = maior prioridade).
 * Usado para ordenação de disciplinas em algoritmos de distribuição.
 */
export const ORDEM_PRIORIDADE_NIVEL = {
  iniciante:     3,
  intermediario: 2,
  avancado:      1,
};

/**
 * Intensidade do ajuste proporcional por quantidade de assuntos dentro do mesmo nível.
 *   0   = desativa o ajuste
 *   0.3 = ajuste moderado
 *   0.4 = padrão recomendado (atual)
 *   1.0 = ajuste linear total
 */
export const FATOR_AJUSTE_ASSUNTOS = 0.4;

/**
 * Limites de ajuste por quantidade de assuntos dentro de cada nível.
 * Esses limites preservam a hierarquia rígida:
 *   iniciante > intermediario > avancado, independentemente de nAssuntos.
 */
export const LIMITES_AJUSTE_POR_NIVEL = {
  iniciante:     { min: 1.0, max: 1.25 },
  intermediario: { min: 0.8, max: 1.1 },
  avancado:      { min: 0.75, max: 1.0 },
};

// ─── CONSTANTES DE REVISÃO ESPAÇADA ──────────────────────────────────────────

/**
 * Intervalos (em dias) da revisão espaçada após o estudo original.
 * Padrão: 1d · 7d · 30d.
 */
export const INTERVALOS_REVISAO = [1, 7, 30];

/**
 * Teto base de revisão por dia (25% do tempo disponível).
 * Usado como piso no cálculo do Elastic Cap.
 */
export const BASE_CAP_REVISAO = 0.25;

/**
 * Teto máximo de revisão por dia (25% do tempo disponível).
 * Dias com muita revisão acumulada nunca ultrapassam este valor.
 */
export const MAX_CAP_REVISAO = 0.25;

/**
 * Percentual mínimo de teoria por dia.
 * A teoria nunca fica abaixo de 35% do tempo disponível no dia.
 */
export const MIN_CAP_TEORIA = 0.35;

/**
 * Tempo mínimo digno por revisão individual (em minutos).
 */
export const MIN_MINUTOS_POR_REVISAO = 10;

/**
 * @deprecated Use BASE_CAP_REVISAO.
 * Alias mantido para compatibilidade com código legado.
 */
export const PERCENTUAL_REVISAO = BASE_CAP_REVISAO;

// ─── [FIX-B] LIMITE DE SEMANAS ───────────────────────────────────────────────

/**
 * Teto de segurança máximo de semanas (2 anos).
 * Usado APENAS como proteção contra loops em configurações degeneradas.
 * Na prática, calcularSemanas() retorna o valor real necessário para cobrir
 * todos os tópicos do edital — nunca trunca antes disso.
 *
 * ANTERIOR: 26 semanas (6 meses) — truncava editais grandes prematuramente.
 * ATUAL:   104 semanas (2 anos)  — cobre qualquer edital real.
 */
export const LIMITE_SEMANAS = 104;

// ─── CÁLCULO DE MATERIAIS POR DIA ────────────────────────────────────────────

/**
 * Quantidade de blocos/disciplinas por dia conforme horas disponíveis.
 *
 * REGRA: se o ciclo possui 2 ou mais disciplinas, o mínimo absoluto é 2 blocos
 * por dia, garantindo diversidade diária independente da carga horária.
 *
 * @param {number} horas - horas de estudo disponíveis no dia
 * @param {number} [numDisciplinas=1] - total de disciplinas no ciclo do usuário
 * @returns {number} número de blocos para o dia
 */
export function calcularMateriasPorDia(horas, numDisciplinas = 1) {
  let base;
  if (horas <= 1)      base = 1;
  else if (horas <= 2) base = 2;
  else if (horas <= 4) base = 3;
  else if (horas <= 6) base = 4;
  else                 base = 5;

  const minimo = numDisciplinas >= 2 ? 2 : 1;
  return Math.max(base, minimo);
}

// ─── CÁLCULO DE PESOS ────────────────────────────────────────────────────────

/**
 * Retorna o peso base de alocação para uma disciplina, baseado apenas no nível.
 * O pesoEdital é ignorado na alocação — só o nível importa.
 *
 * @param {number} pesoEdital - ignorado (mantido por compatibilidade)
 * @param {string} nivel - nível de dificuldade da disciplina
 * @returns {number} peso base por nível
 */
export function calcularPesoAlocacao(pesoEdital, nivel) {
  const nivelNorm = normalizarNivel(nivel);
  return PESO_ALOCACAO_POR_NIVEL[nivelNorm] ?? PESO_ALOCACAO_POR_NIVEL.intermediario;
}

/**
 * Calcula a média de assuntos por nível entre todas as disciplinas.
 * Usado como referência para o ajuste proporcional de peso.
 *
 * @param {Array<{nivel: string, assuntos: string[]}>} disciplinas
 * @returns {Object.<string, number>} média de assuntos por nível normalizado
 */
export function calcularMediaAssuntosPorNivel(disciplinas) {
  const soma  = {};
  const conta = {};

  for (const d of disciplinas) {
    const k    = normalizarNivel(d.nivel);
    const n    = Math.max(1, d.assuntos?.length || 1);
    soma[k]    = (soma[k]  || 0) + n;
    conta[k]   = (conta[k] || 0) + 1;
  }

  const media = {};
  for (const k of Object.keys(soma)) {
    media[k] = soma[k] / conta[k];
  }
  return media;
}

/**
 * Calcula o peso efetivo de uma disciplina, combinando o peso base por nível
 * com um ajuste proporcional pela quantidade de assuntos dentro do mesmo nível.
 *
 * @param {string} nivel
 * @param {number} nAssuntos
 * @param {number} mediaNivel - média de assuntos no mesmo nível
 * @returns {number} peso efetivo
 */
export function calcularPesoComAssuntos(nivel, nAssuntos, mediaNivel) {
  const nivelNorm = normalizarNivel(nivel);
  const pesoBase = calcularPesoAlocacao(null, nivel);
  if (mediaNivel <= 0) return pesoBase;

  const ratio  = nAssuntos / mediaNivel;
  const ajusteBruto = 1 + FATOR_AJUSTE_ASSUNTOS * (ratio - 1);
  const limites = LIMITES_AJUSTE_POR_NIVEL[nivelNorm] || LIMITES_AJUSTE_POR_NIVEL.intermediario;
  const ajuste = Math.min(limites.max, Math.max(limites.min, ajusteBruto));

  let pesoEfetivo = pesoBase * ajuste;

  // Garantia explícita da ordem entre níveis.
  const pisoIniciante = PESO_ALOCACAO_POR_NIVEL.iniciante * LIMITES_AJUSTE_POR_NIVEL.iniciante.min;
  const pisoIntermediario = PESO_ALOCACAO_POR_NIVEL.intermediario * LIMITES_AJUSTE_POR_NIVEL.intermediario.min;
  const tetoIntermediarioSeguro = Math.min(
    PESO_ALOCACAO_POR_NIVEL.intermediario * LIMITES_AJUSTE_POR_NIVEL.intermediario.max,
    pisoIniciante - 0.05,
  );
  const tetoAvancadoSeguro = Math.min(
    PESO_ALOCACAO_POR_NIVEL.avancado * LIMITES_AJUSTE_POR_NIVEL.avancado.max,
    pisoIntermediario - 0.05,
  );

  if (nivelNorm === 'intermediario') {
    pesoEfetivo = Math.min(Math.max(pesoEfetivo, pisoIntermediario), tetoIntermediarioSeguro);
  } else if (nivelNorm === 'avancado') {
    pesoEfetivo = Math.min(Math.max(pesoEfetivo, 0.5), tetoAvancadoSeguro);
  } else if (nivelNorm === 'iniciante') {
    pesoEfetivo = Math.max(pesoEfetivo, pisoIniciante);
  }

  return pesoEfetivo;
}

export function calcularMediaAssuntos(disciplinas = []) {
  if (!disciplinas.length) return 1;
  return Math.max(
    1,
    disciplinas.reduce((total, disciplina) => total + Math.max(1, disciplina?.assuntos?.length || 1), 0)
      / disciplinas.length,
  );
}

export function calcularPesoDisciplina(disciplina, mediaAssuntos = 1) {
  return calculatePlanningPriority(disciplina, mediaAssuntos);
}

/**
 * Alias para calcularPesoComAssuntos usando a terminologia de score.
 * Compatibilidade com código que importa calcularScoreEfetivo.
 */
export function calcularScoreEfetivo(pesoEdital, nivel) {
  return calcularPesoAlocacao(pesoEdital, nivel);
}

/**
 * Distribui slots proporcionalmente pelo peso de cada disciplina.
 *
 * @param {Array<{id: string}>} disciplinas
 * @param {Object.<string, number>} pesoPorId
 * @param {number} totalSlots
 * @returns {Object.<string, number>} slots por disciplinaId
 */
export function distribuirSlotsPorPeso(disciplinas, pesoPorId, totalSlots) {
  const pesoTotal = disciplinas.reduce((acc, d) => acc + (pesoPorId[d.id] || 0), 0);
  if (pesoTotal === 0) return {};

  const slots  = {};
  let  restante = totalSlots;

  // Ordena por prioridade decrescente para a distribuição
  const ordem = [...disciplinas].sort(
    (a, b) => (pesoPorId[b.id] || 0) - (pesoPorId[a.id] || 0),
  );

  for (let i = 0; i < ordem.length; i++) {
    const d = ordem[i];
    if (i === ordem.length - 1) {
      // Último: leva o restante
      slots[d.id] = Math.max(1, restante);
    } else {
      const s = Math.max(1, Math.round((pesoPorId[d.id] / pesoTotal) * totalSlots));
      slots[d.id] = s;
      restante   -= s;
    }
  }

  return slots;
}

/**
 * Distribui minutos proporcionalmente pelo peso de cada disciplina.
 * NÃO aplica arredondar5() — o arredondamento é responsabilidade do caller.
 *
 * @param {Array<{id: string}>} disciplinas
 * @param {Object.<string, number>} pesoPorId
 * @param {number} totalMinutos
 * @returns {Object.<string, number>} minutos por disciplinaId
 */
export function distribuirMinutosPorPeso(disciplinas, pesoPorId, totalMinutos) {
  const pesoTotal = disciplinas.reduce((acc, d) => acc + (pesoPorId[d.id] || 0), 0);
  if (pesoTotal === 0) return {};

  const minutos = {};
  let   restante = totalMinutos;

  const ordem = [...disciplinas].sort(
    (a, b) => (pesoPorId[b.id] || 0) - (pesoPorId[a.id] || 0),
  );

  for (let i = 0; i < ordem.length; i++) {
    const d = ordem[i];
    if (i === ordem.length - 1) {
      minutos[d.id] = Math.max(5, restante);
    } else {
      const m = Math.max(5, Math.round((pesoPorId[d.id] / pesoTotal) * totalMinutos));
      minutos[d.id] = m;
      restante      -= m;
    }
  }

  return minutos;
}

// ─── CÁLCULO DO TETO ELÁSTICO ─────────────────────────────────────────────────

/**
 * Calcula o teto de revisão para um dia específico (Elastic Cap).
 *
 * Garante que dias com poucas revisões não "desperdicem" tempo,
 * e dias com muitas não ultrapassem o cap máximo.
 *
 * @param {number} nRevisoes - número de revisões pendentes no dia
 * @param {number} minutosDisponiveis - minutos totais disponíveis no dia
 * @returns {number} fração [0, MAX_CAP_REVISAO] do tempo reservado para revisão
 */
export function calcularTetoElastico(nRevisoes, minutosDisponiveis) {
  if (!nRevisoes || !minutosDisponiveis) return BASE_CAP_REVISAO;

  const necessidade     = nRevisoes * MIN_MINUTOS_POR_REVISAO;
  const tetoNecessidade = necessidade / minutosDisponiveis;

  return Math.min(
    Math.max(BASE_CAP_REVISAO, tetoNecessidade),
    MAX_CAP_REVISAO,
    1 - MIN_CAP_TEORIA,
  );
}

/**
 * Gera a chave composta usada para registrar assuntos dominados no Firestore.
 *
 * @param {string} disciplinaId - id da disciplina
 * @param {string} assunto - nome do assunto
 * @returns {string} chave no formato 'disciplinaId::assunto'
 */
export function chaveAssuntoDominado(disciplinaId, assunto) {
  return `${disciplinaId}::${assunto}`;
}

// ─── CÁLCULO DE COTAS SEMANAIS ────────────────────────────────────────────────

/**
 * Calcula as cotas semanais (blocos e minutos-alvo) por disciplina.
 *
 * O totalMinutos é 100% das horas configuradas — sem desconto de revisão.
 * O desconto de revisão é responsabilidade exclusiva de scheduling/review.js
 * no momento de exibição (via Elastic Cap).
 *
 * @param {Array<{id: string, nome: string, nivel: string, assuntos: string[]}>} disciplinas
 * @param {Object.<number|string, number>} horarios - horas por dia da semana (chave 0–6)
 * @returns {Object.<string, {nome, cotas, minutos, score, nivel, nAssuntos}>} cotas por disciplinaId
 */
export function calcularCotasSemanais(disciplinas, horarios) {
  if (!disciplinas?.length) return {};

  const numDisciplinas = disciplinas.length;
  let totalBlocos  = 0;
  let totalMinutos = 0;

  for (let d = 0; d <= 6; d++) {
    const horas = Number(horarios[d] || horarios[String(d)]) || 0;
    if (horas > 0) {
      totalBlocos  += calcularMateriasPorDia(horas, numDisciplinas);
      totalMinutos += horas * 60;
    }
  }

  if (totalBlocos === 0) return {};

  const mediaAssuntosNivel = calcularMediaAssuntosPorNivel(disciplinas);
  const pesoPorId          = {};

  disciplinas.forEach(d => {
    const nivelNorm = normalizarNivel(d.nivel);
    const nAssuntos = Math.max(1, d.assuntos?.length || 1);
    const media     = mediaAssuntosNivel[nivelNorm] || 1;
    pesoPorId[d.id] = calcularPesoComAssuntos(d.nivel, nAssuntos, media);
  });

  if (typeof debugLogModoqapPesos === 'function' && import.meta.env?.DEV) {
    debugLogModoqapPesos(disciplinas);
  }

  const slotsPorDisc   = distribuirSlotsPorPeso(disciplinas, pesoPorId, totalBlocos);
  const minutosPorDisc = distribuirMinutosPorPeso(disciplinas, pesoPorId, totalMinutos);

  const cotas = {};
  disciplinas.forEach(d => {
    cotas[d.id] = {
      nome:      d.nome,
      cotas:     slotsPorDisc[d.id]   ?? 0,
      minutos:   minutosPorDisc[d.id] ?? 0,
      score:     pesoPorId[d.id],
      nivel:     normalizarNivel(d.nivel),
      nAssuntos: d.assuntos?.length || 0,
    };
  });

  return cotas;
}

// ─── CÁLCULO DE SEMANAS ───────────────────────────────────────────────────────

/**
 * Calcula o número de semanas necessárias para cobrir o edital COMPLETO.
 *
 * [FIX-B] CORREÇÃO PRINCIPAL: O limite anterior de 26 semanas (LIMITE_SEMANAS = 26)
 * truncava o cronograma antes de cobrir todos os tópicos de editais grandes.
 * Agora o número de semanas é calculado para ser exatamente o necessário para
 * cobrir todos os assuntos de todas as disciplinas, respeitando apenas:
 *   1. A data da prova (se informada) como limite superior.
 *   2. Um teto de segurança de 104 semanas (2 anos) para evitar loops infinitos.
 *
 * A lógica de cálculo:
 *   Para cada disciplina: semanas_para_disc = ceil(nTopicos / slotsSemanais)
 *   totalSemanas = max(semanas_para_disc de todas as disciplinas) + margem de 2 semanas
 *
 * @param {Array<{assuntos: string[]}>} disciplinas - disciplinas com seus assuntos
 * @param {Object.<string, {cotas: number}>} cotas - cotas semanais por disciplinaId
 * @param {string|null} [dataInicio=null] - data de início no formato 'YYYY-MM-DD'
 * @param {string|null} [dataProva=null] - data da prova no formato 'YYYY-MM-DD'
 * @returns {{
 *   totalSemanas: number,
 *   ciclosCompletos: number,
 *   semanasParaCiclo: number,
 *   totalTopicosEdital: number,
 *   limitadoPorProva: boolean,
 *   limitadoPor6Meses: boolean
 * }}
 */
export function calcularSemanas(disciplinas, cotas, dataInicio = null, dataProva = null) {
  // Semanas necessárias para cobrir TODOS os tópicos (uma passada completa no edital).
  let semanasEstudoNecessarias = 1;

  disciplinas.forEach(disc => {
    const slotsWeek   = cotas[disc.id]?.cotas || 0;
    if (!slotsWeek) return;
    const totalTopicos = disc.assuntos?.length || 1;
    const semanasDisc  = Math.ceil(totalTopicos / slotsWeek);
    if (semanasDisc > semanasEstudoNecessarias) semanasEstudoNecessarias = semanasDisc;
  });

  // Revisões finais até o maior intervalo (ex.: 30d após o último estudo).
  const maxIntervaloRevisaoDias = Math.max(...INTERVALOS_REVISAO);
  const semanasRevisaoFinal = Math.ceil(maxIntervaloRevisaoDias / 7);

  // Fechamento completo = estudos + cauda final de revisão.
  const totalSemanasFechamento = Math.max(1, semanasEstudoNecessarias + semanasRevisaoFinal);
  let totalSemanasEfetivo = totalSemanasFechamento;

  // Se houver data de prova antes do fechamento, mantém compatibilidade com limite.
  let limitadoPorProva = false;
  if (dataProva) {
    const inicio = dataInicio
      ? new Date(dataInicio + 'T12:00:00')
      : new Date();
    const prova           = new Date(dataProva + 'T12:00:00');
    const semanasAteProva = Math.max(
      1,
      Math.floor((prova - inicio) / (7 * 24 * 60 * 60 * 1000)),
    );
    if (semanasAteProva < totalSemanasEfetivo) {
      totalSemanasEfetivo = semanasAteProva;
      limitadoPorProva    = true;
    }
  }

  // [FIX-B] Teto de segurança: 104 semanas (2 anos) — apenas proteção contra loops
  const limitadoPorTeto = totalSemanasEfetivo > LIMITE_SEMANAS;
  if (limitadoPorTeto) totalSemanasEfetivo = LIMITE_SEMANAS;

  const diasAteFechamento = Math.max(
    0,
    (semanasEstudoNecessarias * 7 - 1) + maxIntervaloRevisaoDias,
  );
  const dataFechamento = dataInicio
    ? (() => {
        const d = new Date(dataInicio + 'T12:00:00');
        d.setDate(d.getDate() + diasAteFechamento);
        return d.toISOString().split('T')[0];
      })()
    : null;

  const totalTopicosEdital = disciplinas.reduce(
    (acc, d) => acc + (d.assuntos?.length || 1),
    0,
  );
  const totalBlocosSemana  = Object.values(cotas).reduce((a, v) => a + v.cotas, 0);
  const semanasParaCiclo   =
    totalTopicosEdital > 0 && totalBlocosSemana > 0
      ? Math.ceil(totalTopicosEdital / totalBlocosSemana)
      : totalSemanasEfetivo;
  const ciclosCompletos = semanasParaCiclo > 0
    ? Math.max(1, Math.floor(totalSemanasEfetivo / semanasParaCiclo))
    : 1;

  return {
    totalSemanas:      totalSemanasEfetivo,
    ciclosCompletos,
    semanasParaCiclo,
    totalTopicosEdital,
    semanasEstudoNecessarias,
    semanasRevisaoFinal,
    diasAteFechamento,
    dataFechamento,
    // [FIX-B] limitadoPorProva agora reflete apenas a data da prova
    limitadoPorProva,
    // [FIX-B] limitadoPor6Meses renomeado conceitualmente para limitadoPorTeto,
    // mas mantém o mesmo campo no retorno para compatibilidade de chamadas existentes.
    limitadoPor6Meses: limitadoPorTeto,
  };
}

// ─── DEBUG (apenas em DEV) ───────────────────────────────────────────────────

/**
 * Loga no console uma tabela com os pesos calculados por disciplina.
 * Só executa em ambiente de desenvolvimento (import.meta.env.DEV).
 *
 * @param {Array<{id: string, nome: string, nivel: string, peso?: number, assuntos?: string[]}>} disciplinas
 * @returns {void}
 */
export function debugLogModoqapPesos(disciplinas) {
  if (!import.meta.env?.DEV) return;
  if (!disciplinas?.length) return;

  const mediaAssuntosNivel = calcularMediaAssuntosPorNivel(disciplinas);

  console.group(
    '%c[MODOQAP | PESOS] Distribuição por nível de dificuldade + ajuste por assuntos',
    'color: #2563eb; font-weight: bold;',
  );

  const porNivel = {};
  disciplinas.forEach(d => {
    const k    = normalizarNivel(d.nivel);
    porNivel[k] = (porNivel[k] || 0) + 1;
  });

  const rows = disciplinas.map(d => {
    const nivelNorm   = normalizarNivel(d.nivel);
    const nAssuntos   = Math.max(1, d.assuntos?.length || 1);
    const media       = mediaAssuntosNivel[nivelNorm] || 1;
    const pesoBase    = calcularPesoAlocacao(d.peso, d.nivel);
    const pesoFinal   = calcularPesoComAssuntos(d.nivel, nAssuntos, media);
    const compartilha = porNivel[nivelNorm] > 1;
    return {
      Disciplina:      d.nome || '(sem nome)',
      'Nível (raw)':   d.nivel ?? '(null)',
      'Nível (norm)':  nivelNorm,
      Assuntos:        nAssuntos,
      'Média/nível':   Number(media).toFixed(1),
      'Peso base':     Number(pesoBase).toFixed(2),
      'Peso c/ajuste': Number(pesoFinal).toFixed(3),
      Obs: compartilha ? `← ajuste proporcional (α=${FATOR_AJUSTE_ASSUNTOS})` : '',
    };
  });

  console.groupCollapsed(
    '%c[MODOQAP | PESOS] Tabela por disciplina ↓',
    'color: #2563eb;',
  );
  console.table(rows);
  console.groupEnd();

  console.info(
    'NOTA: peso do edital ignorado — alocação por nível + ajuste proporcional por assuntos',
  );
  console.info('Médias por nível (chaves normalizadas):', mediaAssuntosNivel);
  console.groupEnd();
}
