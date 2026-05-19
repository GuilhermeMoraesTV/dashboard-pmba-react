// src/services/cronogramaIA.js
// ─── Wrapper de compatibilidade — NÃO contém algoritmos de distribuição ───────
// Toda matemática: scheduling/core.js + scheduling/index.js
// Otimização de assuntos + funções IA: scheduling/aiAdapter.js

import { gerarSchedule } from './scheduling/index.js';
import { otimizarComIA } from './scheduling/aiAdapter.js';

// Re-exporta funções puras para imports existentes em outros módulos
export {
  normalizarNivel, calcularPesoComAssuntos, calcularMediaAssuntosPorNivel,
  calcularScoreEfetivo, calcularCotasSemanais,
  FATOR_NECESSIDADE, FATOR_AJUSTE_ASSUNTOS, calcularMateriasPorDia,
} from './scheduling/core.js';

// Re-exporta funções de IA auxiliares (prompts Gemini) do aiAdapter
export {
  sugerirNivelDisciplinas, detectarSobrecarga,
  analisarProgressoIA, gerarMensagemDia,
} from './scheduling/aiAdapter.js';

// ─── FUNÇÃO PRINCIPAL ─────────────────────────────────────────────────────────
//
// onProgress agora emite (percent: number, msg: string) em cada etapa.
// Isso elimina a necessidade de inferir o progresso por msg.includes() no wizard.
//
export async function gerarCronogramaIA(
  disciplinas, horarios, opcoes = {}, _ignorado = {}, onProgress = null,
) {
  if (!disciplinas?.length) return null;

  const {
    dataInicio          = new Date().toISOString().split('T')[0],
    dataFim             = null,
    tempoRevisaoMinutos = 20,
  } = opcoes;

  const horariosNorm = {};
  for (let d = 0; d <= 6; d++) horariosNorm[d] = Number(horarios[d] ?? horarios[String(d)]) || 0;

  onProgress?.(10, 'Analisando disciplinas e pesos...');

  let resultado;
  try {
    onProgress?.(25, 'Calculando distribuição de carga horária...');
    resultado = gerarSchedule(disciplinas, horariosNorm, { ...opcoes, dataInicio, dataFim, tempoRevisaoMinutos });
    onProgress?.(55, 'Montando semana base...');
  } catch (err) {
    console.error('[cronogramaIA] gerarSchedule falhou:', err?.message);
    return null;
  }
  if (!resultado) return null;

  // Critério de conclusão: loga desvio para validação durante integração
  const somaReal = resultado.slots.reduce((a, s) => a + s.minutosEstudo, 0);
  if (import.meta.env.DEV) console.info(
    `[cronogramaIA] ✅ somaReal=${somaReal}min | ` +
    `alvoTeoria=${resultado.meta?.totalMinutosTeoria ?? resultado.totalMinutosTeoria}min | ` +
    `bruto=${resultado.totalMinutosSemana}min | ` +
    `desvio=${Math.abs(somaReal - (resultado.meta?.totalMinutosTeoria ?? resultado.totalMinutosSemana))}min | ` +
    `revisãoReservada=${resultado.meta?.totalMinutosRevisao ?? 0}min (${Math.round((resultado.meta?.percentualRevisao ?? 0.25)*100)}%)`
  );

  onProgress?.(70, 'Otimizando assuntos com IA...');
  const slots = await otimizarComIA(resultado.slots, disciplinas);
  onProgress?.(92, 'Finalizando cronograma...');

  return { ...resultado, slots, semanaTemplate: slots, geradoPorIA: true };
}

export async function gerarCronogramaExpressoIA(disciplinas, horasPorDia, onProgress = null) {
  if (!disciplinas?.length) return null;
  const horarios = { 1: horasPorDia, 2: horasPorDia, 3: horasPorDia, 4: horasPorDia, 5: horasPorDia };
  return gerarCronogramaIA(disciplinas, horarios, { tempoRevisaoMinutos: 20 }, {}, onProgress);
}

// cache eliminado — gerarSchedule é determinístico e não precisa de memoização
export function limparCacheIA() {}