import {
  calculatePlanningPriority,
  getKnowledgeLevel,
  getImportanceLevel,
} from './planningPriority.js';

export const PESO_POR_NIVEL = {
  iniciante: 5,
  intermediario: 3,
  avancado: 1,
};

export const normalizarNivelDominio = (nivel, pesoFallback = 3) => {
  if (nivel === 'iniciante' || nivel === 'intermediario' || nivel === 'avancado') return nivel;
  const peso = Number(pesoFallback) || 3;
  if (peso >= 4) return 'iniciante';
  if (peso <= 1) return 'avancado';
  return 'intermediario';
};

export const obterPesoDisciplina = (disciplina, mediaAssuntos = 1) => (
  calculatePlanningPriority(disciplina, mediaAssuntos)
);

const normalizeSessionRange = (legacyDuration, options = {}) => {
  const legacy = Math.max(5, Math.round(Number(legacyDuration) || 50));
  const min = Math.max(5, Math.round(Number(options.duracaoMinimaSessaoMinutos) || legacy));
  const max = Math.max(min, Math.round(Number(options.duracaoMaximaSessaoMinutos) || legacy));
  return { min, max };
};

const allocateExactMinutes = (weightedItems, totalMinutes) => {
  const totalWeight = weightedItems.reduce((total, item) => total + item.weight, 0);
  if (totalWeight <= 0 || totalMinutes <= 0) return weightedItems.map(() => 0);

  const allocations = weightedItems.map((item, index) => {
    const raw = totalMinutes * (item.weight / totalWeight);
    return { index, minutes: Math.floor(raw), fraction: raw - Math.floor(raw) };
  });
  let remainder = totalMinutes - allocations.reduce((total, item) => total + item.minutes, 0);
  allocations
    .slice()
    .sort((a, b) => b.fraction - a.fraction || a.index - b.index)
    .forEach((item) => {
      if (remainder <= 0) return;
      allocations[item.index].minutes += 1;
      remainder -= 1;
    });
  return allocations.map((item) => item.minutes);
};

const splitMinutesIntoSessions = (minutes, min, max) => {
  const total = Math.max(0, Math.round(Number(minutes) || 0));
  if (total <= 0) return [];
  if (total <= max) return [total];

  const minimumCount = Math.ceil(total / max);
  const maximumCount = Math.max(minimumCount, Math.floor(total / min));
  const targetCount = Math.round(total / ((min + max) / 2));
  const count = Math.min(maximumCount, Math.max(minimumCount, targetCount));
  const base = Math.floor(total / count);
  let remainder = total - (base * count);

  return Array.from({ length: count }, () => {
    const duration = base + (remainder > 0 ? 1 : 0);
    remainder = Math.max(0, remainder - 1);
    return duration;
  });
};

export const calcularDistribuicao = (
  disciplinas,
  cargaHorariaTotalMinutos,
  tempoSessaoMinutos = 50,
  options = {},
) => {
  if (!Array.isArray(disciplinas) || disciplinas.length === 0) return [];

  const totalMinutes = Math.max(0, Math.round(Number(cargaHorariaTotalMinutos) || 0));
  const { min, max } = normalizeSessionRange(tempoSessaoMinutos, options);
  const averageTopics = Math.max(
    1,
    disciplinas.reduce((total, disciplina) => total + Math.max(1, disciplina?.assuntos?.length || 1), 0)
      / disciplinas.length,
  );
  const weightedItems = disciplinas.map((disciplina) => ({
    weight: obterPesoDisciplina(disciplina, averageTopics),
  }));
  const minuteAllocations = allocateExactMinutes(weightedItems, totalMinutes);

  return disciplinas.map((disciplina, index) => {
    const tempoAlocadoMinutos = minuteAllocations[index] || 0;
    const duracoesSessoes = splitMinutesIntoSessions(tempoAlocadoMinutos, min, max);
    return {
      ...disciplina,
      conhecimentoNivel: getKnowledgeLevel(disciplina),
      importanciaNivel: getImportanceLevel(disciplina),
      peso: weightedItems[index].weight,
      tempoAlocadoMinutos,
      sessoesPorCiclo: duracoesSessoes.length,
      duracoesSessoes,
    };
  });
};

export const gerarOrdemSessoes = (disciplinas, embaralharOffset = 0) => {
  if (!Array.isArray(disciplinas) || disciplinas.length === 0) return [];

  const offset = Math.max(0, Number(embaralharOffset) || 0) % disciplinas.length;
  const orderedDisciplines = [
    ...disciplinas.slice(offset),
    ...disciplinas.slice(0, offset),
  ];
  const remaining = new Map(
    orderedDisciplines.map((disciplina) => [disciplina.id, Math.max(0, Number(disciplina.sessoesPorCiclo) || 0)]),
  );
  const sessionIndexes = new Map(orderedDisciplines.map((disciplina) => [disciplina.id, 0]));
  const queue = [];

  let added = true;
  while (added) {
    added = false;
    orderedDisciplines.forEach((disciplina) => {
      const count = remaining.get(disciplina.id) || 0;
      if (count <= 0) return;
      const sessaoIndex = sessionIndexes.get(disciplina.id) || 0;
      const tempoPlanejadoMinutos = Number(disciplina.duracoesSessoes?.[sessaoIndex]) || null;
      queue.push({ disciplinaId: disciplina.id, sessaoIndex, tempoPlanejadoMinutos });
      remaining.set(disciplina.id, count - 1);
      sessionIndexes.set(disciplina.id, sessaoIndex + 1);
      added = true;
    });
  }

  return queue;
};
