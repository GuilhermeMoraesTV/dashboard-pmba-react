import {
  CYCLE_ROUND_IDENTITY_VERSION,
  getCycleRecordRoundVersion,
  getCycleRoundVersion,
  getStudyBackedCycleCompletionState,
} from './cycleSessionCompletion.js';

export const CYCLE_PROGRESS_CONTRACT_VERSION = 1;

const normalizeText = (value) => String(value || '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .trim();

const getAssuntoCicloPorSessao = (ciclo, disciplinas, sessao) => {
  const disciplina = (disciplinas || []).find((item) => String(item?.id) === String(sessao?.disciplinaId));
  const assuntos = Array.isArray(disciplina?.assuntos) ? disciplina.assuntos : [];
  const assunto = assuntos[Number(sessao?.sessaoIndex || 0) % Math.max(1, assuntos.length)];
  if (typeof assunto === 'string') return assunto;
  return assunto?.nome || assunto?.titulo || assunto?.label || '';
};

export const isCycleProgressRecord = (payload = {}) => !(
  !payload?.cicloId
  || payload?.isRevisao
  || payload?.revisao
  || payload?.tipoEstudo === 'revisao'
  || String(payload?.tipoEstudo || '').trim().toLowerCase() === 'check_manual'
  || payload?.conclusaoManual === true
  || payload?.origemConclusao === 'botao_concluir'
  || payload?.origem === 'checkout_manual'
  || payload?.teoriaNaoFinalizadaCiclo
);

export const getCycleSessionPlannedMinutes = (ciclo, disciplinas, sessao) => {
  const disciplina = (disciplinas || []).find((item) => String(item?.id) === String(sessao?.disciplinaId));
  const duracaoConfigurada = Number(disciplina?.duracoesSessoes?.[Number(sessao?.sessaoIndex)] || 0);
  return Math.max(1, Number(
    duracaoConfigurada
    || sessao?.tempoMinutos
    || sessao?.tempoPlanejadoMinutos
    || ciclo?.tempoSessaoMinutos
    || 50
  ));
};

export const buildCycleProgressUpdateFromRecord = ({ cicloData = {}, payload = {}, disciplinas = [] }) => {
  if (!isCycleProgressRecord(payload)) return { update: null, staleRound: false };
  const minutosRegistrados = Number(payload.tempoEstudadoMinutos || 0);
  if (minutosRegistrados <= 0) return { update: null, staleRound: false };

  const currentRoundVersion = getCycleRoundVersion(cicloData);
  const recordRoundVersion = getCycleRecordRoundVersion(payload);
  if (
    recordRoundVersion === null
    && Number(cicloData.roundIdentityVersion || 0) >= CYCLE_ROUND_IDENTITY_VERSION
  ) {
    return { update: null, staleRound: true, currentRoundVersion, recordRoundVersion };
  }
  if (recordRoundVersion !== null && recordRoundVersion !== currentRoundVersion) {
    return { update: null, staleRound: true, currentRoundVersion, recordRoundVersion };
  }
  const ordemSessoes = Array.isArray(cicloData.ordemSessoes) ? cicloData.ordemSessoes : [];
  if (!ordemSessoes.length) return { update: null, staleRound: false, currentRoundVersion };

  const completionState = getStudyBackedCycleCompletionState(cicloData);
  const concluidas = completionState.sessoesConcluidas;
  const progressoSessoes = completionState.progressoSessoes;
  const disciplinaIdRegistro = String(payload.disciplinaId || '').trim();
  const assuntoRegistroNorm = normalizeText(payload.assunto);
  const hasExplicitSessionIndex = payload.sessaoGlobalIndex !== null
    && payload.sessaoGlobalIndex !== undefined
    && payload.sessaoGlobalIndex !== ''
    && Number.isInteger(Number(payload.sessaoGlobalIndex));

  const candidatosPorDisciplina = ordemSessoes
    .map((sessao, globalIndex) => ({ ...sessao, globalIndex }))
    .filter((sessao) => {
      if (concluidas.includes(Number(sessao.globalIndex))) return false;
      if (hasExplicitSessionIndex && Number(payload.sessaoGlobalIndex) !== Number(sessao.globalIndex)) return false;
      if (disciplinaIdRegistro && String(sessao.disciplinaId || '') !== disciplinaIdRegistro) return false;
      return true;
    });
  const candidatosPorAssunto = assuntoRegistroNorm
    ? candidatosPorDisciplina.filter((sessao) => {
      const assuntoSessao = getAssuntoCicloPorSessao(cicloData, disciplinas, sessao);
      return !assuntoSessao || normalizeText(assuntoSessao) === assuntoRegistroNorm;
    })
    : [];
  const candidatos = (candidatosPorAssunto.length ? candidatosPorAssunto : candidatosPorDisciplina)
    .slice()
    .sort((a, b) => Number(a.globalIndex) - Number(b.globalIndex));
  if (!candidatos.length) return { update: null, staleRound: false, currentRoundVersion };

  let minutosRestantes = minutosRegistrados;
  const allocations = {};
  const nextProgressSessoes = { ...progressoSessoes };
  const nextCompletionDetails = { ...completionState.sessoesConcluidasDetalhes };
  const novasConcluidas = [...concluidas];
  let lastTouchedIndex = null;
  let changed = completionState.removedManualCheckoutCount > 0;

  for (const sessao of candidatos) {
    if (minutosRestantes <= 0) break;
    const index = Number(sessao.globalIndex);
    const progressoAtual = Number(nextProgressSessoes?.[index] || nextProgressSessoes?.[String(index)] || 0);
    const tempoPlanejado = getCycleSessionPlannedMinutes(cicloData, disciplinas, sessao);
    const faltantes = Math.max(0, tempoPlanejado - progressoAtual);
    if (faltantes <= 0) {
      if (minutosRestantes > 0) {
        nextProgressSessoes[String(index)] = progressoAtual + minutosRestantes;
        allocations[String(index)] = {
          minutes: minutosRestantes,
          plannedMinutes: tempoPlanejado,
        };
        changed = true;
        lastTouchedIndex = index;
        minutosRestantes = 0;
      }
      if (progressoAtual >= tempoPlanejado && !novasConcluidas.includes(index)) {
        novasConcluidas.push(index);
        nextCompletionDetails[String(index)] = {
          concluidaEm: payload.data,
          atualizadoEm: payload.timestamp || payload.data,
          origem: payload.origem === 'timer' ? 'timer' : 'registro_manual',
        };
        changed = true;
      }
      continue;
    }

    const incremento = Math.min(faltantes, minutosRestantes);
    const novoProgresso = progressoAtual + incremento;
    nextProgressSessoes[String(index)] = novoProgresso;
    allocations[String(index)] = {
      minutes: Number(allocations[String(index)]?.minutes || 0) + incremento,
      plannedMinutes: tempoPlanejado,
    };
    changed = true;
    lastTouchedIndex = index;
    if (novoProgresso >= tempoPlanejado && !novasConcluidas.includes(index)) {
      novasConcluidas.push(index);
      nextCompletionDetails[String(index)] = {
        concluidaEm: payload.data,
        atualizadoEm: payload.timestamp || payload.data,
        origem: payload.origem === 'timer' ? 'timer' : 'registro_manual',
      };
    }
    minutosRestantes -= incremento;
  }

  if (minutosRestantes > 0 && lastTouchedIndex !== null) {
    nextProgressSessoes[String(lastTouchedIndex)] =
      Number(nextProgressSessoes[String(lastTouchedIndex)] || progressoSessoes?.[lastTouchedIndex] || progressoSessoes?.[String(lastTouchedIndex)] || 0)
      + minutosRestantes;
    allocations[String(lastTouchedIndex)] = {
      minutes: Number(allocations[String(lastTouchedIndex)]?.minutes || 0) + minutosRestantes,
      plannedMinutes: Number(allocations[String(lastTouchedIndex)]?.plannedMinutes || 1),
    };
    changed = true;
  }

  return {
    update: changed ? {
      progressoSessoes: nextProgressSessoes,
      sessoesConcluidas: [...new Set(novasConcluidas)].sort((a, b) => a - b),
      sessoesConcluidasDetalhes: nextCompletionDetails,
    } : null,
    staleRound: false,
    currentRoundVersion,
    allocations,
  };
};

export const buildCycleProgressRollbackFromRecord = ({ cicloData = {}, payload = {} }) => {
  const allocations = payload?.cycleProgressAllocations;
  if (!allocations || typeof allocations !== 'object' || Array.isArray(allocations)) return null;
  if (getCycleRecordRoundVersion(payload) !== getCycleRoundVersion(cicloData)) return null;

  const completionState = getStudyBackedCycleCompletionState(cicloData);
  const nextProgress = { ...completionState.progressoSessoes };
  const nextDetails = { ...completionState.sessoesConcluidasDetalhes };
  const completed = new Set(completionState.sessoesConcluidas.map(Number));
  let changed = false;

  Object.entries(allocations).forEach(([rawIndex, rawAllocation]) => {
    const index = Number(rawIndex);
    const allocation = rawAllocation && typeof rawAllocation === 'object'
      ? rawAllocation
      : { minutes: rawAllocation, plannedMinutes: 1 };
    const removedMinutes = Math.max(0, Number(allocation.minutes || 0));
    if (!Number.isInteger(index) || removedMinutes <= 0) return;
    const current = Math.max(0, Number(nextProgress[String(index)] ?? nextProgress[index] ?? 0));
    const next = Math.max(0, current - removedMinutes);
    const planned = Math.max(1, Number(allocation.plannedMinutes || 1));
    nextProgress[String(index)] = next;
    if (next < planned) {
      completed.delete(index);
      delete nextDetails[String(index)];
    }
    changed = true;
  });

  if (!changed) return null;
  return {
    progressoSessoes: nextProgress,
    sessoesConcluidas: [...completed].sort((a, b) => a - b),
    sessoesConcluidasDetalhes: nextDetails,
  };
};
