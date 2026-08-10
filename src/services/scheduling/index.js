/**
 * src/services/scheduling/index.js
 * ─────────────────────────────────────────────────────────────────────────────
 * API pública do sistema de geração de cronograma MODOQAP.
 *
 * REGRAS ABSOLUTAS deste arquivo:
 *   • Zero imports de React, Firebase ou fetch.
 *   • arredondar5() é chamada APENAS no Passo 5 (atribuição de minutosEstudo).
 *   • O tempo total por dia (teoria + revisão) NUNCA ultrapassa o configurado.
 *   • PERCENTUAL_REVISAO_DIARIA (25%) é reservado ANTES de distribuir teoria.
 *   • distribuirSlotsPorPeso e distribuirMinutosPorPeso recebem valores brutos.
 *   • A validação final de desvio de minutos lança exceção — nunca silencia.
 *
 * Pipeline de gerarSchedule():
 *   Passo 1 → calcularPesos
 *   Passo 2 → totalMinutos BRUTO e totalSlots; desconta PERCENTUAL_REVISAO_DIARIA
 *             → totalMinutosTeoria (o que realmente vai para os slots de teoria)
 *   Passo 3 → distribuirSlotsPorPeso + distribuirMinutosPorPeso (sobre totalMinutosTeoria)
 *   Passo 4 → seleção de disciplinas por dia (round-robin ponderado)
 *   Passo 5 → Hamilton intra-disciplina com arredondar5() — único ponto de uso
 *   Passo 6 → assuntos por índice circular
 *   Validação → invariante: |somaReal - totalMinutosTeoriaArredondado| ≤ tolerancia
 *
 * INVARIANTE DE TEMPO:
 *   Para cada dia d:
 *     minutosEstudo(dia d) = horarios[d]*60 × (1 - PERCENTUAL_REVISAO_DIARIA)
 *     minutosRevisao(dia d) ≤ horarios[d]*60 × PERCENTUAL_REVISAO_DIARIA   ← garantido por review.js
 *     minutosEstudo + minutosRevisao ≤ horarios[d]*60                        ← GARANTIDO
 */

import {
  arredondar5,
  calcularMediaAssuntos,
  calcularPesoDisciplina,
  calcularMateriasPorDia,
  calcularSemanas,
  DIA_NOMES,
  INTERVALOS_REVISAO,
  BASE_CAP_REVISAO,
} from './core.js';
import { calcularDataRevisaoAlocada, parseDateOnlyLocal, startOfLocalDay, formatDateKeyLocal } from './review.js';

// ─── CONSTANTES LOCAIS ────────────────────────────────────────────────────────

const PALETA_CORES = [
  'red', 'blue', 'emerald', 'amber', 'violet',
  'pink', 'cyan', 'orange', 'teal', 'lime',
];

const MIN_MINUTOS_SLOT = 15;
const MAX_MINUTOS_SLOT = 60;

function getDisciplinasDiarias(disciplinas = []) {
  return disciplinas.filter((disciplina) => disciplina?.estudarTodosDias === true);
}

function distribuirSlotsComMinimos(disciplinas, pesoPorId, totalSlots, minimosPorId = {}) {
  const slots = {};
  let usados = 0;

  disciplinas.forEach((disciplina) => {
    const minimo = Math.max(0, Number(minimosPorId[disciplina.id] || 0));
    slots[disciplina.id] = minimo;
    usados += minimo;
  });

  let restantes = Math.max(0, Number(totalSlots || 0) - usados);
  if (restantes <= 0) return slots;

  const pesoTotal = disciplinas.reduce((acc, disciplina) => acc + (pesoPorId[disciplina.id] || 0), 0);
  if (pesoTotal <= 0) return slots;

  const rateio = disciplinas.map((disciplina, index) => {
    const peso = pesoPorId[disciplina.id] || 0;
    const exato = restantes * (peso / pesoTotal);
    const inteiro = Math.floor(exato);
    return { disciplina, index, inteiro, resto: exato - inteiro, peso };
  });

  let alocados = 0;
  rateio.forEach((item) => {
    slots[item.disciplina.id] += item.inteiro;
    alocados += item.inteiro;
  });

  let sobras = restantes - alocados;
  rateio
    .slice()
    .sort((a, b) => b.resto - a.resto || b.peso - a.peso || a.index - b.index)
    .forEach((item) => {
      if (sobras <= 0) return;
      slots[item.disciplina.id] += 1;
      sobras -= 1;
    });

  return slots;
}

function distribuirMinutosComMinimos(disciplinas, pesoPorId, totalMinutos, minimosPorId = {}) {
  const minutos = {};
  let usados = 0;

  disciplinas.forEach((disciplina) => {
    const minimo = Math.max(0, Number(minimosPorId[disciplina.id] || 0));
    minutos[disciplina.id] = minimo;
    usados += minimo;
  });

  let restantes = Math.max(0, Number(totalMinutos || 0) - usados);
  if (restantes <= 0) return minutos;

  const pesoTotal = disciplinas.reduce((acc, disciplina) => acc + (pesoPorId[disciplina.id] || 0), 0);
  if (pesoTotal <= 0) return minutos;

  const rateio = disciplinas.map((disciplina, index) => {
    const peso = pesoPorId[disciplina.id] || 0;
    const exato = restantes * (peso / pesoTotal);
    const inteiro = Math.floor(exato);
    return { disciplina, index, inteiro, resto: exato - inteiro, peso };
  });

  let alocados = 0;
  rateio.forEach((item) => {
    minutos[item.disciplina.id] += item.inteiro;
    alocados += item.inteiro;
  });

  let sobras = restantes - alocados;
  rateio
    .slice()
    .sort((a, b) => b.resto - a.resto || b.peso - a.peso || a.index - b.index)
    .forEach((item) => {
      if (sobras <= 0) return;
      minutos[item.disciplina.id] += 1;
      sobras -= 1;
    });

  return minutos;
}

function criarVerificadorDisponibilidadeSemanal(disponibilidade = {}) {
  return (date) => {
    const diaSemana = startOfLocalDay(date).getDay();
    const horas = Number(disponibilidade[diaSemana] ?? disponibilidade[String(diaSemana)] ?? 0);
    return horas > 0;
  };
}

function dataDoSlotNaSemana(inicioSemana, diaSemanaAbsoluto) {
  const inicio = startOfLocalDay(inicioSemana);
  const diaInicio = inicio.getDay();
  let delta = diaSemanaAbsoluto - diaInicio;
  if (delta < 0) delta += 7;
  const data = new Date(inicio);
  data.setDate(data.getDate() + delta);
  return data;
}

function agruparAlocacoesPorDia(alocacoes = []) {
  return alocacoes.reduce((acc, aloc, idx) => {
    const dia = Number(aloc?.dia);
    if (!acc[dia]) acc[dia] = [];
    acc[dia].push({ idx, aloc });
    return acc;
  }, {});
}

function contarDisciplinasDistintasDia(alocacoes, dia, substituicao = null) {
  const ids = new Set();

  alocacoes.forEach((aloc, idx) => {
    if (Number(aloc?.dia) !== Number(dia)) return;
    const id = substituicao?.idx === idx ? substituicao.disciplinaId : aloc?.disc?.id;
    if (id) ids.add(id);
  });

  return ids.size;
}

function trocaRespeitaLimiteDia(alocacoes, idxAloc, novaDisciplinaId, limitesPorDia = null) {
  if (!limitesPorDia) return true;
  const aloc = alocacoes[idxAloc];
  if (!aloc) return false;
  const dia = Number(aloc.dia);
  const limite = Number(limitesPorDia[dia] ?? limitesPorDia[String(dia)] ?? 0);
  if (!limite) return true;
  return contarDisciplinasDistintasDia(alocacoes, dia, { idx: idxAloc, disciplinaId: novaDisciplinaId }) <= limite;
}

function escolherIdxDoador(alocacoes, indices = [], novaDisciplinaId, limitesPorDia = null) {
  return indices.find((idx) => trocaRespeitaLimiteDia(alocacoes, idx, novaDisciplinaId, limitesPorDia));
}

function escolherDiaParaBlocoExtra(alocacoes, disciplinaId, diasOrdenados, horarios, limitesPorDia = null) {
  const grupos = agruparAlocacoesPorDia(alocacoes);

  const candidatos = diasOrdenados.map((dia) => {
    const itensDia = grupos[dia] || [];
    const jaTemDisciplina = itensDia.some(({ aloc }) => aloc?.disc?.id === disciplinaId);
    const limite = Number(limitesPorDia?.[dia] ?? limitesPorDia?.[String(dia)] ?? 0);
    const distintas = new Set(itensDia.map(({ aloc }) => aloc?.disc?.id).filter(Boolean)).size;
    const podeAdicionarDisciplina = !limite || jaTemDisciplina || distintas < limite;

    return {
      dia,
      jaTemDisciplina,
      podeAdicionarDisciplina,
      ocupacao: itensDia.length,
      horas: Number(horarios[dia] || 0),
    };
  }).filter((item) => item.podeAdicionarDisciplina);

  candidatos.sort((a, b) => {
    if (limitesPorDia && a.jaTemDisciplina !== b.jaTemDisciplina) {
      return Number(b.jaTemDisciplina) - Number(a.jaTemDisciplina);
    }
    if (!limitesPorDia && a.jaTemDisciplina !== b.jaTemDisciplina) {
      return Number(a.jaTemDisciplina) - Number(b.jaTemDisciplina);
    }
    if (a.ocupacao !== b.ocupacao) return a.ocupacao - b.ocupacao;
    return b.horas - a.horas;
  });

  return candidatos[0]?.dia ?? (limitesPorDia ? null : (diasOrdenados[0] ?? 0));
}

function normalizarDisciplinaUnicaPorDia(alocacoes, diasOrdenados) {
  let houveTroca = true;
  let guard = 0;

  while (houveTroca && guard < 200) {
    houveTroca = false;
    guard += 1;

    const grupos = agruparAlocacoesPorDia(alocacoes);

    for (const dia of diasOrdenados) {
      const itensDia = (grupos[dia] || []).sort((a, b) => a.aloc.ordemNoDia - b.aloc.ordemNoDia);
      const disciplinasNoDia = new Set();
      const duplicados = [];

      itensDia.forEach((item) => {
        const disciplinaId = item.aloc?.disc?.id;
        if (!disciplinaId) return;
        if (disciplinasNoDia.has(disciplinaId)) {
          duplicados.push(item);
          return;
        }
        disciplinasNoDia.add(disciplinaId);
      });

      for (const duplicado of duplicados) {
        const disciplinaDuplicada = duplicado.aloc?.disc?.id;
        if (!disciplinaDuplicada) continue;

        for (const outroDia of diasOrdenados) {
          if (outroDia === dia) continue;

          const itensOutroDia = grupos[outroDia] || [];
          const outroDiaJaTemDuplicada = itensOutroDia.some(
            ({ aloc }) => aloc?.disc?.id === disciplinaDuplicada
          );
          if (outroDiaJaTemDuplicada) continue;

          const disciplinasOutroDia = new Set(
            itensOutroDia.map(({ aloc }) => aloc?.disc?.id).filter(Boolean)
          );

          const candidatoTroca = itensOutroDia.find(({ aloc }) => {
            const disciplinaCandidata = aloc?.disc?.id;
            return disciplinaCandidata && !disciplinasNoDia.has(disciplinaCandidata);
          });

          if (!candidatoTroca) continue;

          const disciplinaCandidata = candidatoTroca.aloc.disc;
          if (!disciplinaCandidata || disciplinasOutroDia.has(disciplinaDuplicada) || !disciplinaDuplicada) {
            continue;
          }

          alocacoes[duplicado.idx] = {
            ...alocacoes[duplicado.idx],
            disc: candidatoTroca.aloc.disc,
          };
          alocacoes[candidatoTroca.idx] = {
            ...alocacoes[candidatoTroca.idx],
            disc: duplicado.aloc.disc,
          };

          houveTroca = true;
          break;
        }

        if (houveTroca) break;
      }

      if (houveTroca) break;
    }
  }
}

function rebalancearMinutosTeoriaPorDia(alocacoes, minutosEstudoPorIdx, minutosTeoriaPorDia, maxMinutosSlot = MAX_MINUTOS_SLOT, minMinutosSlot = MIN_MINUTOS_SLOT) {
  const getSomaDia = (dia) => alocacoes.reduce((acc, aloc, idx) => (
    Number(aloc.dia) === Number(dia) ? acc + (minutosEstudoPorIdx[idx] || 0) : acc
  ), 0);

  const dias = Object.keys(minutosTeoriaPorDia).map(Number);
  let guard = 0;

  while (guard < 2000) {
    guard += 1;

    const diaExcedente = dias
      .map(dia => ({
        dia,
        excesso: getSomaDia(dia) - (minutosTeoriaPorDia[dia] || 0),
      }))
      .filter(item => item.excesso >= 5)
      .sort((a, b) => b.excesso - a.excesso)[0];

    if (!diaExcedente) break;

    const idxDoador = alocacoes
      .map((aloc, idx) => ({ aloc, idx, minutos: minutosEstudoPorIdx[idx] || 0 }))
      .filter(item => Number(item.aloc.dia) === diaExcedente.dia && item.minutos - 5 >= minMinutosSlot)
      .sort((a, b) => b.minutos - a.minutos)[0]?.idx;

    if (idxDoador == null) break;

    const diaReceptor = dias
      .map(dia => ({
        dia,
        folga: (minutosTeoriaPorDia[dia] || 0) - getSomaDia(dia),
      }))
      .filter(item => item.dia !== diaExcedente.dia && item.folga >= 5)
      .sort((a, b) => b.folga - a.folga)[0];

    if (!diaReceptor) {
      minutosEstudoPorIdx[idxDoador] -= 5;
      continue;
    }

    const idxReceptor = alocacoes
      .map((aloc, idx) => ({ aloc, idx, minutos: minutosEstudoPorIdx[idx] || 0 }))
      .filter(item => Number(item.aloc.dia) === diaReceptor.dia && item.minutos + 5 <= maxMinutosSlot)
      .sort((a, b) => a.minutos - b.minutos)[0]?.idx;

    if (idxReceptor == null) {
      minutosEstudoPorIdx[idxDoador] -= 5;
      continue;
    }

    minutosEstudoPorIdx[idxDoador] -= 5;
    minutosEstudoPorIdx[idxReceptor] += 5;
  }
}

function calcularFechamentoReal(slots, disciplinas, dataInicio, disponibilidade, dataLimite = null) {
  if (!slots?.length || !disciplinas?.length || !dataInicio) {
    return { dataFim: dataLimite || dataInicio || null, diasAteFechamento: 0, totalSemanas: 1 };
  }

  const inicio = startOfLocalDay(parseDateOnlyLocal(dataInicio));
  const isDiaDisponivel = criarVerificadorDisponibilidadeSemanal(disponibilidade);
  const slotsPorDisciplina = slots.reduce((acc, slot) => {
    if (!acc[slot.disciplinaId]) acc[slot.disciplinaId] = [];
    acc[slot.disciplinaId].push(slot);
    return acc;
  }, {});

  let ultimaData = new Date(inicio);

  disciplinas.forEach((disciplina) => {
    const assuntos = disciplina?.assuntos || [];
    const slotsDisciplina = (slotsPorDisciplina[disciplina.id] || []).sort(
      (a, b) => (a.slotIndexParaDisc || 0) - (b.slotIndexParaDisc || 0)
    );

    slotsDisciplina.forEach((slot) => {
      const totalSlotsParaDisc = slot.totalSlotsParaDisc || 1;
      const slotIndex = slot.slotIndexParaDisc || 0;

      for (let topicIdx = slotIndex; topicIdx < assuntos.length; topicIdx += totalSlotsParaDisc) {
        const weekOffset = Math.floor((topicIdx - slotIndex) / totalSlotsParaDisc);
        const dataEstudo = dataDoSlotNaSemana(
          new Date(inicio.getFullYear(), inicio.getMonth(), inicio.getDate() + weekOffset * 7, 12, 0, 0, 0),
          slot.dia
        );

        if (dataEstudo > ultimaData) ultimaData = dataEstudo;

        INTERVALOS_REVISAO.forEach((intervaloDias) => {
          const dataRevisao = calcularDataRevisaoAlocada(dataEstudo, intervaloDias, isDiaDisponivel);
          if (dataRevisao > ultimaData) ultimaData = dataRevisao;
        });
      }
    });
  });

  let dataFimReal = formatDateKeyLocal(ultimaData);

  if (dataLimite) {
    const limite = startOfLocalDay(parseDateOnlyLocal(dataLimite));
    if (limite < ultimaData) {
      dataFimReal = formatDateKeyLocal(limite);
      ultimaData = limite;
    }
  }

  const diasAteFechamento = Math.max(0, Math.round((ultimaData - inicio) / 86400000));
  const totalSemanas = Math.max(1, Math.floor(diasAteFechamento / 7) + 1);

  return {
    dataFim: dataFimReal,
    diasAteFechamento,
    totalSemanas,
  };
}

/**
 * Fração do tempo diário reservada para revisões espaçadas.
 * Deve ser igual a BASE_CAP_REVISAO de core.js.
 *
 * CONTRATO: os slots de teoria gerados aqui usam apenas (1 - PERCENTUAL_REVISAO_DIARIA)
 * do tempo disponível. O restante fica disponível para review.js encaixar revisões.
 *
 * Resultado:
 *   minutosTeoriaPorDia[d] = horarios[d] * 60 * (1 - PERCENTUAL_REVISAO_DIARIA)
 *   minutosRevisaoPorDia[d] ≤ horarios[d] * 60 * PERCENTUAL_REVISAO_DIARIA
 *   SOMA ≤ horarios[d] * 60  ✓
 */
const PERCENTUAL_REVISAO_DIARIA = BASE_CAP_REVISAO; // 0.25

// ─── FUNÇÃO PRINCIPAL ─────────────────────────────────────────────────────────

/**
 * Gera o cronograma semanal completo de forma puramente local, sem IA.
 *
 * @param {Array<{
 *   id: string,
 *   nome: string,
 *   nivel: string,
 *   assuntos?: string[],
 *   peso?: number
 * }>} disciplinas
 *
 * @param {Object.<number|string, number>} disponibilidade
 *   Horas de estudo TOTAIS (teoria + revisão) por dia (chave 0–6).
 *
 * @param {{
 *   nomeEstudo?: string,
 *   dataInicio?: string,
 *   dataFim?: string,
 *   tempoRevisaoMinutos?: number
 * }} [opcoes={}]
 *
 * @returns {ScheduleResult}
 * @throws {Error} se a invariante de minutos for violada
 */
export function gerarSchedule(disciplinas, disponibilidade, opcoes = {}) {

  // ── Guarda de entrada ─────────────────────────────────────────────────────
  if (!disciplinas?.length) return null;

  const minMinutosSlot = Math.max(5, Math.round(Number(opcoes.duracaoMinimaSessaoMinutos) || MIN_MINUTOS_SLOT));
  const maxMinutosSlot = Math.max(minMinutosSlot, Math.round(Number(opcoes.duracaoMaximaSessaoMinutos) || 60));

  const disciplinasValidas = disciplinas.filter(d => {
    if (!d?.id   || typeof d.id   !== 'string') return false;
    if (!d?.nome || typeof d.nome !== 'string') return false;
    return true;
  });

  if (import.meta.env?.DEV && disciplinasValidas.length !== disciplinas.length) {
    console.warn(
      `[gerarSchedule] ${disciplinas.length - disciplinasValidas.length} disciplina(s) inválidas ignoradas.`,
      disciplinas.filter(d => !d?.id || !d?.nome),
    );
  }

  if (!disciplinasValidas.length) return null;
  disciplinas = disciplinasValidas;

  const {
    nomeEstudo          = 'Cronograma',
    dataFim             = null,
    tempoRevisaoMinutos = 20,
    dataProva           = null,
    retaFinal           = false,
  } = opcoes;

  // Normaliza disponibilidade
  const horarios = {};
  for (let d = 0; d <= 6; d++) {
    horarios[d] = Math.max(0, Number(disponibilidade[d] ?? disponibilidade[String(d)]) || 0);
  }

  const diasAtivos = [0,1,2,3,4,5,6].filter(d => horarios[d] > 0);
  if (!diasAtivos.length) return null;

  // ── dataInicio: avança para o próximo dia de estudo a partir de hoje ─────────
  // Se hoje NÃO é um dia de estudo (horarios[hoje] === 0), o cronograma deve
  // começar no próximo dia configurado — nunca num dia de descanso.
  // Se opcoes.dataInicio foi passado explicitamente, respeita sem alteração.
  let dataInicio = opcoes.dataInicio ?? null;
  if (!dataInicio) {
    const hoje = new Date();
    hoje.setHours(12, 0, 0, 0);
    for (let offset = 0; offset < 7; offset++) {
      const diaIdx = (hoje.getDay() + offset) % 7;
      if (horarios[diaIdx] > 0) {
        const candidata = new Date(hoje);
        candidata.setDate(candidata.getDate() + offset);
        dataInicio = candidata.toISOString().split('T')[0];
        break;
      }
    }
    // Fallback improvável (nenhum dia ativo): usa hoje mesmo
    if (!dataInicio) dataInicio = hoje.toISOString().split('T')[0];
  }

  let disciplinasDiarias = getDisciplinasDiarias(disciplinas);
  if (opcoes.limitarMaterias && opcoes.limitesPorDia) {
    const capacidadeNaoDiaria = diasAtivos.reduce((acc, dia) => {
      const limiteDia = Number(opcoes.limitesPorDia[dia] ?? opcoes.limitesPorDia[String(dia)] ?? disciplinas.length);
      return acc + Math.max(0, limiteDia - disciplinasDiarias.length);
    }, 0);
    const idsDiarias = new Set(disciplinasDiarias.map((disciplina) => disciplina.id));
    const naoDiarias = disciplinas
      .filter((disciplina) => !idsDiarias.has(disciplina.id))
      .sort((a, b) => {
        const pesoA = calcularPesoDisciplina(a, 1);
        const pesoB = calcularPesoDisciplina(b, 1);
        return pesoB - pesoA;
      });
    const naoDiariasQueCabem = capacidadeNaoDiaria >= naoDiarias.length
      ? naoDiarias
      : naoDiarias.slice(0, Math.max(0, capacidadeNaoDiaria));
    disciplinas = [...disciplinasDiarias, ...naoDiariasQueCabem];
    if (!disciplinas.length) return null;
    disciplinasDiarias = getDisciplinasDiarias(disciplinas);
  }

  const numDisciplinas = disciplinas.length;
  const idsDisciplinasDiarias = new Set(disciplinasDiarias.map((disciplina) => disciplina.id));

  // ── PASSO 1: Calcular pesos ───────────────────────────────────────────────
  const mediaAssuntosGeral = calcularMediaAssuntos(disciplinas);

  const pesoPorId = {};
  disciplinas.forEach(d => {
    pesoPorId[d.id] = calcularPesoDisciplina(d, mediaAssuntosGeral);
  });

  // ── PASSO 2: totalMinutos BRUTO e totalMinutosTeoria ─────────────────────
  //
  // totalMinutosBruto  = soma de horarios[d]*60 (o que o usuário configurou)
  // totalMinutosTeoria = totalMinutosBruto * (1 - percentual de revisão)
  // Assim, os blocos de teoria não crescem demais e as revisões já entram
  // no orçamento semanal desde a geração do plano base.

  let totalMinutosBruto  = 0;
  let totalMinutosTeoria = 0;
  let totalSlots         = 0;

  const slotsPorDiaConfig     = {};
  const disciplinasDistintasPorDiaConfig = {};
  const minutosBrutoPorDia    = {}; // tempo total configurado pelo usuário (para validação)
  const minutosTeoriaPorDia   = {}; // tempo real alocado para teoria no plano base

  diasAtivos.forEach(d => {
    const horasBrutas   = horarios[d];
    const minBrutos     = horasBrutas * 60;
    const minTeoriaBase = Math.floor(minBrutos * (1 - PERCENTUAL_REVISAO_DIARIA));
    const minTeoriaDiarias = disciplinasDiarias.length * minMinutosSlot;
    const minTeoria = Math.min(minBrutos, Math.max(minTeoriaBase, minTeoriaDiarias));
    const limiteConfigurado = opcoes.limitarMaterias && opcoes.limitesPorDia
      ? Number(opcoes.limitesPorDia[d] ?? opcoes.limitesPorDia[String(d)] ?? 0)
      : 0;
    const limiteDisciplinasDia = limiteConfigurado > 0
      ? Math.max(disciplinasDiarias.length, Math.min(numDisciplinas, limiteConfigurado))
      : null;
    
    let nBlocos;
    if (opcoes.limitarMaterias && opcoes.limitesPorDia && (opcoes.limitesPorDia[d] || opcoes.limitesPorDia[String(d)])) {
      nBlocos = limiteDisciplinasDia || calcularMateriasPorDia(horasBrutas, numDisciplinas);
    } else {
      nBlocos = calcularMateriasPorDia(horasBrutas, numDisciplinas);
    }
    const blocosMinPorDuracao = Math.max(1, Math.ceil(minTeoria / maxMinutosSlot));
    const blocosMaxPorDuracao = Math.max(1, Math.floor(minTeoria / minMinutosSlot));
    nBlocos = opcoes.limitarMaterias
      ? Math.max(nBlocos, disciplinasDiarias.length)
      : Math.max(nBlocos, blocosMinPorDuracao, disciplinasDiarias.length);
    nBlocos = Math.max(blocosMinPorDuracao, Math.min(nBlocos, blocosMaxPorDuracao));

    totalMinutosBruto  += minBrutos;
    totalMinutosTeoria += minTeoria;
    totalSlots         += nBlocos;

    slotsPorDiaConfig[d]   = nBlocos;
    disciplinasDistintasPorDiaConfig[d] = limiteDisciplinasDia || Math.min(nBlocos, numDisciplinas);
    minutosBrutoPorDia[d]  = minBrutos;
    minutosTeoriaPorDia[d] = minTeoria;
  });

  if (totalSlots === 0 || totalMinutosTeoria === 0) return null;

  // ── PASSO 3: Distribuição de slots e MINUTOS DE TEORIA por disciplina ─────
  //
  // Distribuímos totalMinutosTeoria em todo o tempo configurado do dia.

  const minimosSlotsPorDisc = {};
  const minimosMinutosPorDisc = {};
  disciplinas.forEach((disciplina) => {
    if (!idsDisciplinasDiarias.has(disciplina.id)) return;
    minimosSlotsPorDisc[disciplina.id] = diasAtivos.length;
    minimosMinutosPorDisc[disciplina.id] = diasAtivos.length * minMinutosSlot;
  });

  const slotsPorDisc = distribuirSlotsComMinimos(
    disciplinas,
    pesoPorId,
    totalSlots,
    minimosSlotsPorDisc
  );

  const maxMinutosSlotGeracao = maxMinutosSlot;
  const minutosPorDisc = distribuirMinutosComMinimos(
    disciplinas,
    pesoPorId,
    totalMinutosTeoria,
    minimosMinutosPorDisc
  );

  // ── PASSO 4: Seleção de disciplinas por dia — round-robin ponderado ───────
  const ticketsPorDisc           = {};
  const minutosAcumuladosPorDisc = {};
  const assuntoIdxPorDisc        = {};

  disciplinas.forEach(d => {
    ticketsPorDisc[d.id]           = slotsPorDisc[d.id] ?? 0;
    minutosAcumuladosPorDisc[d.id] = 0;
    assuntoIdxPorDisc[d.id]        = 0;
  });

  const diasOrdenados = [...diasAtivos].sort((a, b) => horarios[b] - horarios[a]);

  const alocacoes = [];
  const discUsadaNosDias = {};

  diasOrdenados.forEach(dia => {
    const nBlocos    = slotsPorDiaConfig[dia];
    const maxDisciplinasDistintasDia = disciplinasDistintasPorDiaConfig[dia] || Math.min(nBlocos, numDisciplinas);
    const horasDia   = horarios[dia];
    const minDiscsDistintas = Math.min(
      maxDisciplinasDistintasDia,
      numDisciplinas >= 2 ? Math.min(2, numDisciplinas) : 1,
    );

    const diasAnteriores = discUsadaNosDias[diasOrdenados[diasOrdenados.indexOf(dia) - 1]];

    const candidatas = [...disciplinas].sort((a, b) => {
      const temTickA = (ticketsPorDisc[a.id] || 0) > 0 ? 1 : 0;
      const temTickB = (ticketsPorDisc[b.id] || 0) > 0 ? 1 : 0;
      if (temTickB !== temTickA) return temTickB - temTickA;

      const defA = (minutosPorDisc[a.id] || 0) - (minutosAcumuladosPorDisc[a.id] || 0);
      const defB = (minutosPorDisc[b.id] || 0) - (minutosAcumuladosPorDisc[b.id] || 0);
      if (defB !== defA) return defB - defA;

      const altA = diasAnteriores?.has(a.id) ? 1 : 0;
      const altB = diasAnteriores?.has(b.id) ? 1 : 0;
      if (altB !== altA) return altA - altB;

      const tA = ticketsPorDisc[a.id] || 0;
      const tB = ticketsPorDisc[b.id] || 0;
      if (tB !== tA) return tB - tA;

      return pesoPorId[b.id] - pesoPorId[a.id];
    });

    const diariasDoDia = disciplinasDiarias
      .filter((disciplina) => (ticketsPorDisc[disciplina.id] || 0) > 0)
      .sort((a, b) => {
        const defA = (minutosPorDisc[a.id] || 0) - (minutosAcumuladosPorDisc[a.id] || 0);
        const defB = (minutosPorDisc[b.id] || 0) - (minutosAcumuladosPorDisc[b.id] || 0);
        return defB - defA || (pesoPorId[b.id] || 0) - (pesoPorId[a.id] || 0);
      })
      .slice(0, maxDisciplinasDistintasDia);

    const escolhidasUnicas = [...diariasDoDia];
    const escolhidasSet    = new Set(escolhidasUnicas.map((disciplina) => disciplina.id));

    for (const d of candidatas) {
      if (escolhidasUnicas.length >= Math.min(maxDisciplinasDistintasDia, numDisciplinas)) break;
      if (!escolhidasSet.has(d.id)) {
        escolhidasSet.add(d.id);
        escolhidasUnicas.push(d);
      }
    }

    if (escolhidasUnicas.length < minDiscsDistintas && disciplinas.length >= minDiscsDistintas) {
      for (const d of disciplinas) {
        if (escolhidasUnicas.length >= minDiscsDistintas) break;
        if (!escolhidasSet.has(d.id)) {
          escolhidasSet.add(d.id);
          escolhidasUnicas.push(d);
        }
      }
    }

    const escolhidasOrdem = [];
    let rodada = 0;
    while (escolhidasOrdem.length < nBlocos) {
      for (let i = 0; i < escolhidasUnicas.length && escolhidasOrdem.length < nBlocos; i++) {
        escolhidasOrdem.push(escolhidasUnicas[i]);
      }
      rodada++;
      if (rodada > nBlocos) break;
    }

    discUsadaNosDias[dia] = new Set(escolhidasOrdem.map(d => d.id));

    escolhidasOrdem.forEach((disc, ordemNoDia) => {
      ticketsPorDisc[disc.id] = Math.max(0, (ticketsPorDisc[disc.id] || 0) - 1);
      alocacoes.push({ dia, ordemNoDia, disc, horasDia });
    });
  });

  // Rebalanceia alocacoes para evitar disciplinas sem bloco mesmo com minutos-alvo.
  // Isso evita desvio sistematico na invariante final (esperado x real).
  const alocacoesPorDiscBalance = {};
  alocacoes.forEach((aloc, idx) => {
    const id = aloc.disc.id;
    if (!alocacoesPorDiscBalance[id]) alocacoesPorDiscBalance[id] = [];
    alocacoesPorDiscBalance[id].push(idx);
  });

  const disciplinasSemBloco = disciplinas.filter(d =>
    (minutosPorDisc[d.id] || 0) > 0 && (alocacoesPorDiscBalance[d.id]?.length || 0) === 0
  );

  disciplinasSemBloco.forEach(discAlvo => {
    const idxDoador = disciplinas
      .map(d => {
        const qtdAlocada = alocacoesPorDiscBalance[d.id]?.length || 0;
        const excesso = qtdAlocada - (slotsPorDisc[d.id] || 0);
        return { id: d.id, qtdAlocada, excesso };
      })
      .filter(x => x.qtdAlocada > 1 && (!idsDisciplinasDiarias.has(x.id) || x.qtdAlocada > diasAtivos.length))
      .sort((a, b) => {
        if (b.excesso !== a.excesso) return b.excesso - a.excesso;
        return b.qtdAlocada - a.qtdAlocada;
      })[0];

    if (!idxDoador) return;

    const idxAloc = escolherIdxDoador(
      alocacoes,
      alocacoesPorDiscBalance[idxDoador.id] || [],
      discAlvo.id,
      opcoes.limitarMaterias ? disciplinasDistintasPorDiaConfig : null,
    );
    if (idxAloc == null) return;

    alocacoes[idxAloc] = { ...alocacoes[idxAloc], disc: discAlvo };

    alocacoesPorDiscBalance[idxDoador.id] =
      (alocacoesPorDiscBalance[idxDoador.id] || []).filter(i => i !== idxAloc);
    if (!alocacoesPorDiscBalance[discAlvo.id]) alocacoesPorDiscBalance[discAlvo.id] = [];
    alocacoesPorDiscBalance[discAlvo.id].push(idxAloc);
  });

  // Garante slots mínimos por disciplina para evitar blocos longos.
  // Exemplo: alvo de 150min precisa de pelo menos 3 blocos para manter <= 60min/bloco.
  const slotsMinimosPorDisc = {};
  disciplinas.forEach(d => {
    const minutosAlvo = minutosPorDisc[d.id] || 0;
    slotsMinimosPorDisc[d.id] = Math.max(
      idsDisciplinasDiarias.has(d.id) ? diasAtivos.length : 1,
      Math.ceil(minutosAlvo / maxMinutosSlotGeracao)
    );
  });

  const excessosPorDisc = (discId) =>
    (alocacoesPorDiscBalance[discId]?.length || 0) - (slotsMinimosPorDisc[discId] || 1);

  if (!opcoes.limitarMaterias) disciplinas.forEach(discAlvo => {
    const alvoId = discAlvo.id;
    let faltam = (slotsMinimosPorDisc[alvoId] || 1) - (alocacoesPorDiscBalance[alvoId]?.length || 0);

    while (faltam > 0) {
      const doador = disciplinas
        .map(d => ({ id: d.id, excesso: excessosPorDisc(d.id) }))
        .filter(x => x.id !== alvoId && x.excesso > 0)
        .sort((a, b) => b.excesso - a.excesso)[0];

      if (!doador) {
        // Sem doador disponível: cria um bloco extra para a própria disciplina.
        const diaPreferido = escolherDiaParaBlocoExtra(
          alocacoes,
          alvoId,
          diasOrdenados,
          horarios,
          opcoes.limitarMaterias ? disciplinasDistintasPorDiaConfig : null,
        );
        if (diaPreferido == null) break;
        const ordemNoDia = alocacoes.filter(a => a.dia === diaPreferido).length;

        alocacoes.push({
          dia: diaPreferido,
          ordemNoDia,
          disc: discAlvo,
          horasDia: horarios[diaPreferido],
        });
        const novoIdx = alocacoes.length - 1;
        if (!alocacoesPorDiscBalance[alvoId]) alocacoesPorDiscBalance[alvoId] = [];
        alocacoesPorDiscBalance[alvoId].push(novoIdx);
        faltam--;
        continue;
      }

      const idxAloc = escolherIdxDoador(
        alocacoes,
        alocacoesPorDiscBalance[doador.id] || [],
        alvoId,
        opcoes.limitarMaterias ? disciplinasDistintasPorDiaConfig : null,
      );
      if (idxAloc == null) break;

      alocacoes[idxAloc] = { ...alocacoes[idxAloc], disc: discAlvo };

      alocacoesPorDiscBalance[doador.id] =
        (alocacoesPorDiscBalance[doador.id] || []).filter(i => i !== idxAloc);
      if (!alocacoesPorDiscBalance[alvoId]) alocacoesPorDiscBalance[alvoId] = [];
      alocacoesPorDiscBalance[alvoId].push(idxAloc);

      faltam--;
    }
  });

  if (!opcoes.limitarMaterias) {
    normalizarDisciplinaUnicaPorDia(alocacoes, diasOrdenados);
  }

  // ── PASSO 5: minutosEstudo — Hamilton intra-disciplina com arredondar5() ──
  //
  // ÚNICO ponto onde arredondar5() é chamada neste pipeline.
  //
  // Distribuímos minutosPorDisc[id] no total semanal configurado da disciplina
  // pelos blocos dela, proporcionalmente ao peso do dia.
  //
  // GARANTIA: soma(minutosEstudo) ~ totalMinutosTeoria com tolerância de arredondamento.

  const alocacoesPorDisc = {};
  alocacoes.forEach((aloc, idx) => {
    const id = aloc.disc.id;
    if (!alocacoesPorDisc[id]) alocacoesPorDisc[id] = [];
    alocacoesPorDisc[id].push({ aloc, idx });
  });

  const minutosEstudoPorIdx = {};

  Object.entries(alocacoesPorDisc).forEach(([discId, blocos]) => {
    const alvoDisc = arredondar5(minutosPorDisc[discId] || 0);

    if (blocos.length === 0 || alvoDisc === 0) {
      blocos.forEach(({ idx }) => { minutosEstudoPorIdx[idx] = minMinutosSlot; });
      return;
    }

    if (blocos.length === 1) {
      minutosEstudoPorIdx[blocos[0].idx] = Math.min(
        maxMinutosSlotGeracao,
        Math.max(minMinutosSlot, alvoDisc),
      );
      return;
    }

    const somaHoras = blocos.reduce((acc, { aloc }) => acc + aloc.horasDia, 0);

    const linhas = blocos.map(({ aloc, idx }) => {
      const frac    = somaHoras > 0 ? aloc.horasDia / somaHoras : 1 / blocos.length;
      const exato   = frac * alvoDisc;
      const base5   = Math.floor(exato / 5) * 5;
      const inteiro = Math.max(minMinutosSlot, base5);
      return { idx, exato, inteiro, resto: exato - base5 };
    });

    let alocados  = linhas.reduce((a, l) => a + l.inteiro, 0);
    let restantes = alvoDisc - alocados;

    if (restantes > 0) {
      linhas
        .slice()
        .sort((a, b) => b.resto - a.resto)
        .forEach(l => {
          if (restantes <= 0) return;
          l.inteiro += 5;
          restantes -= 5;
        });
    } else if (restantes < 0) {
      linhas
        .slice()
        .sort((a, b) => b.inteiro - a.inteiro)
        .forEach(l => {
          if (restantes >= 0) return;
          if (l.inteiro - 5 >= minMinutosSlot) {
            l.inteiro -= 5;
            restantes += 5;
          }
        });
    }

    // Preferencia: quando possivel, troca 55m por 60m dentro da mesma disciplina.
    const alvos55 = linhas.filter(l => l.inteiro === 55);
    alvos55.forEach(alvo => {
      const doador = linhas
        .filter(l => l.idx !== alvo.idx && l.inteiro >= minMinutosSlot + 5)
        .sort((a, b) => b.inteiro - a.inteiro)[0];
      if (!doador) return;
      alvo.inteiro += 5;
      doador.inteiro -= 5;
    });

    // Hard cap: nenhum bloco passa do teto calculado para este modo.
    // Move excedente (de 5 em 5) para blocos abaixo do teto.
    let guard = 0;
    while (guard < 1000) {
      guard++;
      const acima = linhas
        .filter(l => l.inteiro > maxMinutosSlotGeracao)
        .sort((a, b) => b.inteiro - a.inteiro)[0];
      if (!acima) break;

      const receptor = linhas
        .filter(l => l.idx !== acima.idx && l.inteiro + 5 <= maxMinutosSlotGeracao)
        .sort((a, b) => a.inteiro - b.inteiro)[0];
      if (!receptor) break;

      acima.inteiro -= 5;
      receptor.inteiro += 5;
    }

    linhas.forEach(l => { minutosEstudoPorIdx[l.idx] = l.inteiro; });
  });

  rebalancearMinutosTeoriaPorDia(alocacoes, minutosEstudoPorIdx, minutosTeoriaPorDia, maxMinutosSlotGeracao, minMinutosSlot);

  // ── PASSO 6: Assuntos por índice circular ─────────────────────────────────
  const discById = {};
  disciplinas.forEach(d => { discById[d.id] = d; });

  const slots = alocacoes.map((aloc, idx) => {
    const { dia, ordemNoDia, disc } = aloc;
    const minutosEstudo = minutosEstudoPorIdx[idx] ?? minMinutosSlot;

    const assuntos        = disc.assuntos || [];
    // ✅ CORREÇÃO: variável local se chama slotIdxParaDisc (com Idx),
    //    mas o campo do objeto deve ser slotIndexParaDisc (com Index).
    //    Usar shorthand causava ReferenceError pois o JS procurava
    //    uma variável chamada exatamente "slotIndexParaDisc" no escopo.
    const slotIdxParaDisc = assuntoIdxPorDisc[disc.id] ?? 0;
    const assunto         = assuntos.length > 0
      ? assuntos[slotIdxParaDisc % assuntos.length]
      : 'Conteúdo Base';

    assuntoIdxPorDisc[disc.id]        = slotIdxParaDisc + 1;
    minutosAcumuladosPorDisc[disc.id] =
      (minutosAcumuladosPorDisc[disc.id] || 0) + minutosEstudo;

    return {
      slotId:             `s${dia}-${ordemNoDia}`,
      dia,
      hora:               8 + ordemNoDia,
      ordemNoDia,
      disciplinaId:       disc.id,
      disciplinaNome:     disc.nome,
      conhecimentoNivel:  disc.conhecimentoNivel,
      importanciaNivel:   disc.importanciaNivel,
      pesoEfetivo:        pesoPorId[disc.id],
      assunto,
      acao_metodologica:  `${minutosEstudo}m Teoria/Questões`,
      foco_recomendado:   '',
      minutosEstudo,
      minutosRevisao:     0,        // revisões são gerenciadas por review.js
      isRevisao:          false,
      pinned:             false,
      // ✅ CORREÇÃO APLICADA AQUI: atribuição explícita em vez de shorthand
      slotIndexParaDisc:  slotIdxParaDisc,
      totalSlotsParaDisc: 0,       // preenchido abaixo

      // Metadados para que review.js saiba quanto tempo há disponível no dia
      // (25% do tempo bruto do dia = slot de revisão máximo)
      minutosRevisaoReservados: Math.floor(minutosBrutoPorDia[dia] * PERCENTUAL_REVISAO_DIARIA),
      minutosBrutoDia:          minutosBrutoPorDia[dia],
    };
  });

  // Ordena por dia → ordemNoDia
  slots.sort((a, b) => {
    if (a.dia !== b.dia) return a.dia - b.dia;
    return a.ordemNoDia - b.ordemNoDia;
  });

  // Preenche totalSlotsParaDisc
  const contadorSlots = {};
  slots.forEach(s => {
    contadorSlots[s.disciplinaId] = (contadorSlots[s.disciplinaId] || 0) + 1;
  });
  slots.forEach(s => {
    s.totalSlotsParaDisc = contadorSlots[s.disciplinaId] || 1;
  });

  // ── VALIDAÇÃO: invariante de minutos ─────────────────────────────────────
  //
  // Valida contra totalMinutosTeoria (não o bruto) pois os slots são apenas teoria.
  // Tolerância = 5 min por disciplina.

  const somaReal = slots.reduce((a, s) => a + s.minutosEstudo, 0);
  const totalMinutosTeoriaArredondado = disciplinas.reduce(
    (a, d) => a + arredondar5(minutosPorDisc[d.id] || 0), 0
  );
  const tolerancia = Math.max(5, disciplinas.length * 5);

  if (Math.abs(somaReal - totalMinutosTeoriaArredondado) > tolerancia) {
    throw new Error(
      `[scheduling/index] Invariante violado: desvio de minutos de teoria. ` +
      `esperado=${totalMinutosTeoriaArredondado}, real=${somaReal}, ` +
      `desvio=${Math.abs(somaReal - totalMinutosTeoriaArredondado)}min.`
    );
  }

  // ── VALIDAÇÃO EXTRA: nenhum slot de teoria ultrapassa o tempo bruto do dia ─
  const somaTeoriaPorDia = {};
  slots.forEach(s => {
    somaTeoriaPorDia[s.dia] = (somaTeoriaPorDia[s.dia] || 0) + s.minutosEstudo;
  });
  Object.entries(somaTeoriaPorDia).forEach(([dia, soma]) => {
    const tetoTeoria = minutosTeoriaPorDia[Number(dia)] || 0;
    if (soma > tetoTeoria) {
      throw new Error(
        `[scheduling/index] Invariante diario violado: teoria(${soma}) > ` +
        `tetoTeoria(${tetoTeoria}) no dia ${dia}.`
      );
    }
  });

  if (import.meta.env?.DEV) {
    const somaPorDia = {};
    slots.forEach(s => {
      somaPorDia[s.dia] = (somaPorDia[s.dia] || 0) + s.minutosEstudo;
    });
    let ok = true;
    Object.entries(somaPorDia).forEach(([dia, soma]) => {
      const bruto = minutosBrutoPorDia[Number(dia)] || 0;
      if (soma > bruto) {
        console.error(
          `[scheduling/index] Dia ${dia}: minutosEstudo(${soma}) > brutoDia(${bruto})!`
        );
        ok = false;
      }
    });
    if (ok) {
      console.info(
        `[scheduling/index] ✅ Validação passou. ` +
        `Bruto/semana=${totalMinutosBruto}min | Teoria=${somaReal}min (${Math.round(somaReal/totalMinutosBruto*100)}%) | ` +
        `Revisão reservada=${totalMinutosBruto - totalMinutosTeoria}min (${Math.round(PERCENTUAL_REVISAO_DIARIA*100)}%)`
      );
    }
  }

  // ── Meta: distribuição e semanas ─────────────────────────────────────────
  const cotasParaMeta = {};
  disciplinas.forEach(d => {
    cotasParaMeta[d.id] = {
      nome:    d.nome,
      cotas:   slotsPorDisc[d.id] ?? 0,
      minutos: minutosPorDisc[d.id] ?? 0,
    };
  });

  const infoSemanas = calcularSemanas(
    disciplinas,
    cotasParaMeta,
    dataInicio,
    dataProva || opcoes.dataFim || null,
  );

  const colorMap = {};
  disciplinas.forEach((d, i) => { colorMap[d.id] = PALETA_CORES[i % PALETA_CORES.length]; });

  const distribuicao = disciplinas
    .filter(d => cotasParaMeta[d.id])
    .map(d => {
      const cota = cotasParaMeta[d.id];
      return {
        id:         d.id,
        nome:       cota.nome,
        minutos:    cota.minutos,
        blocos:     contadorSlots[d.id] || cota.cotas,
        color:      colorMap[d.id] || 'zinc',
        horas:      Math.round((cota.minutos / 60) * 10) / 10,
        percentual: totalMinutosTeoria > 0
          ? Math.round((cota.minutos / totalMinutosTeoria) * 1000) / 10
          : 0,
      };
    })
    .sort((a, b) => b.minutos - a.minutos);

  const dataLimiteExplicita = dataFim || dataProva || null;
  const fechamentoReal = calcularFechamentoReal(
    slots,
    disciplinas,
    dataInicio,
    horarios,
    dataLimiteExplicita
  );
  const dtInicio = dataInicio;
  const dtFim = fechamentoReal.dataFim || dataLimiteExplicita || infoSemanas.dataFechamento || dataInicio;

  // ── Monta ScheduleResult ──────────────────────────────────────────────────
  const result = {
    slots,
    semanaTemplate: slots,

    meta: {
      distribuicao,
      totalSemanas:            fechamentoReal.totalSemanas,
      totalMinutosSemana:      totalMinutosBruto,  // bruto para exibição
      totalMinutosTeoria,                          // real alocado para teoria
      totalMinutosRevisao:     totalMinutosBruto - totalMinutosTeoria,
      percentualRevisao:       PERCENTUAL_REVISAO_DIARIA,
      ciclosCompletos:         infoSemanas.ciclosCompletos,
      totalTopicosEdital:      infoSemanas.totalTopicosEdital,
      semanasEstudoNecessarias: infoSemanas.semanasEstudoNecessarias ?? null,
      semanasRevisaoFinal:      infoSemanas.semanasRevisaoFinal ?? null,
      diasAteFechamento:        fechamentoReal.diasAteFechamento ?? infoSemanas.diasAteFechamento ?? null,
      dataFechamento:           dtFim,
    },

    totalSemanasNecessarias: fechamentoReal.totalSemanas,
    ciclosCompletos:         infoSemanas.ciclosCompletos,
    semanasParaCiclo:        infoSemanas.semanasParaCiclo,
    totalTopicosEdital:      infoSemanas.totalTopicosEdital,
    semanasEstudoNecessarias: infoSemanas.semanasEstudoNecessarias ?? null,
    semanasRevisaoFinal:      infoSemanas.semanasRevisaoFinal ?? null,
    diasAteFechamento:        fechamentoReal.diasAteFechamento ?? infoSemanas.diasAteFechamento ?? null,
    dataFechamento:           dtFim,
    limitadoPorProva:        infoSemanas.limitadoPorProva,
    limitadoPor6Meses:       infoSemanas.limitadoPor6Meses,

    dataInicio: dtInicio,
    dataFim:    dtFim,

    distribuicaoTempo:   distribuicao,
    totalMinutosSemana:  totalMinutosBruto,
    colorMap,
    cotasCalculadas:     cotasParaMeta,

    geradoPorIA:       false,
    usouFallbackLocal: true,

    metodologiasAplicadas: {
      cronograma:              'ciclo_intercalado',
      revisao:                 'revisao_espacada',
      intervalosRevisao:       INTERVALOS_REVISAO,  // [1, 7, 30]
      estudo:                  [],
      tempoRevisaoMinutos,
      percentualRevisao:       PERCENTUAL_REVISAO_DIARIA,
      retaFinal,
      dataProva,
    },

    resumoGeracao: (
      `${infoSemanas.ciclosCompletos} ciclo(s) do edital em ` +
      `${fechamentoReal.totalSemanas} semanas. ${slots.length} blocos/semana. ` +
      `${Math.round(PERCENTUAL_REVISAO_DIARIA * 100)}% do tempo reservado para revisões.`
    ),
  };

  return result;
}

// ─── ALIAS DE COMPATIBILIDADE ─────────────────────────────────────────────────
export const gerarScheduleFallback = gerarSchedule;
