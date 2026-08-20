const DATE_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const pad2 = (value) => String(value).padStart(2, '0');

export const dateToLocalKey = (value = new Date()) => {
  if (typeof value === 'string' && DATE_KEY_PATTERN.test(value)) return value;
  const raw = value?.toDate ? value.toDate() : value;
  const date = raw instanceof Date ? raw : new Date(raw);
  if (Number.isNaN(date.getTime())) return null;
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
};

export const parseLocalDateKey = (dateKey) => {
  if (!DATE_KEY_PATTERN.test(String(dateKey || ''))) return null;
  const [year, month, day] = String(dateKey).split('-').map(Number);
  const date = new Date(year, month - 1, day);
  return Number.isNaN(date.getTime()) ? null : date;
};

export const addDaysToDateKey = (dateKey, days) => {
  const date = parseLocalDateKey(dateKey);
  if (!date) return null;
  date.setDate(date.getDate() + Number(days || 0));
  return dateToLocalKey(date);
};

export const differenceInCalendarDays = (laterKey, earlierKey) => {
  const later = parseLocalDateKey(laterKey);
  const earlier = parseLocalDateKey(earlierKey);
  if (!later || !earlier) return 0;
  const laterUtc = Date.UTC(later.getFullYear(), later.getMonth(), later.getDate());
  const earlierUtc = Date.UTC(earlier.getFullYear(), earlier.getMonth(), earlier.getDate());
  return Math.round((laterUtc - earlierUtc) / 86400000);
};

export const getCicloRoundStartKey = (ciclo = {}, today = new Date()) => {
  const hasCompletedRound = Number(ciclo?.conclusoes || 0) > 0;
  if (hasCompletedRound && ciclo?.ultimaConclusao) {
    return dateToLocalKey(ciclo.ultimaConclusao);
  }
  return dateToLocalKey(ciclo?.dataInicioPlanejamento)
    || dateToLocalKey(ciclo?.dataCriacao)
    || dateToLocalKey(today);
};

export const isCicloRoundComplete = (ciclo = {}) => {
  const total = Number(ciclo?.totalSessoesCiclo || ciclo?.ordemSessoes?.length || 0);
  const completed = new Set((ciclo?.sessoesConcluidas || []).map(Number)).size;
  return total > 0 && completed >= total;
};

export const getCicloWeeklyStatus = ({ ciclo = {}, today = new Date(), isRoundComplete = null } = {}) => {
  const todayKey = dateToLocalKey(today);
  const inicioRodada = getCicloRoundStartKey(ciclo, today);
  const fechamentoIdeal = addDaysToDateKey(inicioRodada, 7);
  const complete = typeof isRoundComplete === 'boolean' ? isRoundComplete : isCicloRoundComplete(ciclo);
  const diasAteInicio = differenceInCalendarDays(inicioRodada, todayKey);
  const diasRestantes = differenceInCalendarDays(fechamentoIdeal, todayKey);

  let estado = 'em_dia';
  if (complete) estado = 'pronto_para_fechar';
  else if (diasAteInicio > 0) estado = 'nao_iniciado';
  else if (diasRestantes < 0) estado = 'atrasado';
  else if (diasRestantes === 0) estado = 'vence_hoje';
  else if (diasRestantes <= 2) estado = 'perto_de_vencer';

  return {
    estado,
    inicioRodada,
    fechamentoIdeal,
    hoje: todayKey,
    diasAteInicio: Math.max(0, diasAteInicio),
    diasRestantes: Math.max(0, diasRestantes),
    diasAtraso: Math.max(0, -diasRestantes),
    rodadaCompleta: complete,
  };
};

const getRegistroDateKey = (registro = {}) => (
  dateToLocalKey(registro.data)
  || dateToLocalKey(registro.dataRegistro)
  || dateToLocalKey(registro.timestamp)
  || dateToLocalKey(registro.createdAt)
);

export const mergeOptimisticCycleRecords = (persistedRecords = [], optimisticRecordsById = {}) => {
  const optimisticRecords = Object.values(optimisticRecordsById || {});
  const optimisticIds = new Set(
    optimisticRecords.map((record) => record?.origemConclusaoId).filter(Boolean),
  );
  return [
    ...optimisticRecords,
    ...(persistedRecords || []).filter((record) => !optimisticIds.has(record?.origemConclusaoId)),
  ];
};

export const buildCycleRoundSummary = ({
  ciclo = {},
  disciplinas = [],
  registros = [],
  closedAt = new Date(),
} = {}) => {
  const inicioPlanejado = getCicloRoundStartKey(ciclo, closedAt);
  const fechamentoIdeal = addDaysToDateKey(inicioPlanejado, 7);
  const fechamentoRealData = dateToLocalKey(closedAt);
  const atrasoDias = Math.max(0, differenceInCalendarDays(fechamentoRealData, fechamentoIdeal));
  const currentRoundRecords = (registros || []).filter((registro) => registro?.conclusaoId == null);
  const minutosAteIdealPorDisciplina = new Map();

  currentRoundRecords.forEach((registro) => {
    const dateKey = getRegistroDateKey(registro);
    if (!dateKey || dateKey < inicioPlanejado || dateKey > fechamentoIdeal || !registro?.disciplinaId) return;
    const key = String(registro.disciplinaId);
    minutosAteIdealPorDisciplina.set(
      key,
      (minutosAteIdealPorDisciplina.get(key) || 0) + Number(registro.tempoEstudadoMinutos || 0),
    );
  });

  const disciplinasAtivas = (disciplinas || []).filter((disciplina) => disciplina?.inCiclo !== false);
  const cargaPlanejadaMinutos = Math.round(disciplinasAtivas.reduce(
    (total, disciplina) => total + Number(disciplina.tempoAlocadoSemanalMinutos || 0),
    0,
  ));
  const cargaCumpridaAteDataIdealMinutos = Math.round(
    [...minutosAteIdealPorDisciplina.values()].reduce((total, minutos) => total + Number(minutos || 0), 0),
  );
  const materiasPendentesNoVencimento = disciplinasAtivas
    .map((disciplina) => {
      const planejado = Number(disciplina.tempoAlocadoSemanalMinutos || 0);
      const cumprido = Number(minutosAteIdealPorDisciplina.get(String(disciplina.id)) || 0);
      return {
        disciplinaId: String(disciplina.id || ''),
        nome: disciplina.nome || 'Materia sem nome',
        minutosPendentes: Math.max(0, Math.round(planejado - cumprido)),
      };
    })
    .filter((item) => item.minutosPendentes > 0)
    .sort((a, b) => b.minutosPendentes - a.minutosPendentes || a.nome.localeCompare(b.nome));

  return {
    numeroRodada: Number(ciclo?.conclusoes || 0) + 1,
    inicioPlanejado,
    fechamentoIdeal,
    fechamentoRealData,
    atrasoDias,
    cargaPlanejadaMinutos,
    cargaCumpridaAteDataIdealMinutos,
    materiasPendentesNoVencimento,
  };
};

export const aggregateCycleRoundStats = (rodadas = []) => {
  const normalized = [...(rodadas || [])]
    .map((rodada) => ({ ...rodada, atrasoDias: Math.max(0, Number(rodada?.atrasoDias || 0)) }))
    .sort((a, b) => Number(b.numeroRodada || 0) - Number(a.numeroRodada || 0));
  const atrasadas = normalized.filter((rodada) => rodada.atrasoDias > 0);
  const pendencias = new Map();

  normalized.forEach((rodada) => {
    (rodada.materiasPendentesNoVencimento || []).forEach((materia) => {
      const key = String(materia.disciplinaId || materia.nome || 'sem-id');
      const current = pendencias.get(key) || {
        disciplinaId: materia.disciplinaId || null,
        nome: materia.nome || 'Materia sem nome',
        rodadasPendentes: 0,
        minutosPendentes: 0,
      };
      current.rodadasPendentes += 1;
      current.minutosPendentes += Number(materia.minutosPendentes || 0);
      pendencias.set(key, current);
    });
  });

  return {
    totalRodadas: normalized.length,
    rodadasAtrasadas: atrasadas.length,
    mediaDiasAtraso: atrasadas.length
      ? Math.round((atrasadas.reduce((total, rodada) => total + rodada.atrasoDias, 0) / atrasadas.length) * 10) / 10
      : 0,
    maiorAtraso: atrasadas.reduce((max, rodada) => Math.max(max, rodada.atrasoDias), 0),
    materiasMaisPendentes: [...pendencias.values()].sort(
      (a, b) => b.rodadasPendentes - a.rodadasPendentes || b.minutosPendentes - a.minutosPendentes,
    ),
    historico: normalized,
  };
};

export const buildCicloWeeklyAlert = (ciclo, status = getCicloWeeklyStatus({ ciclo })) => {
  const cicloId = ciclo?.id || 'ativo';
  const common = {
    cicloId,
    navigateTo: 'ciclos',
    actionLabel: 'Abrir ciclo semanal',
  };

  if (status.estado === 'nao_iniciado') return {
    ...common,
    id: `alerta_ciclo_nao_iniciado_${cicloId}_${status.inicioRodada}`,
    type: 'ciclo_nao_iniciado',
    title: 'Ciclo semanal ainda não começou',
    message: `A rodada começa em ${status.diasAteInicio} dia(s), no dia ${status.inicioRodada.split('-').reverse().join('/')}.`,
  };
  if (status.estado === 'perto_de_vencer') return {
    ...common,
    id: `alerta_ciclo_perto_vencer_${cicloId}_${status.fechamentoIdeal}`,
    type: 'ciclo_perto_vencer',
    title: status.diasRestantes === 2 ? 'Faltam 2 dias' : 'Falta 1 dia',
    message: 'Conclua os blocos pendentes para fechar a rodada dentro da meta.',
  };
  if (status.estado === 'vence_hoje') return {
    ...common,
    id: `alerta_ciclo_vence_hoje_${cicloId}_${status.fechamentoIdeal}`,
    type: 'ciclo_vence_hoje',
    title: 'O ciclo semanal vence hoje',
    message: 'A meta de 7 dias termina hoje. As pendências continuam disponíveis até a conclusão.',
  };
  if (status.estado === 'atrasado') return {
    ...common,
    id: `alerta_ciclo_atrasado_${cicloId}_${status.fechamentoIdeal}`,
    type: 'ciclo_atrasado',
    title: 'Ciclo semanal atrasado',
    message: `A rodada está ${status.diasAtraso} dia(s) atrasada. Conclua as pendências antes de fechar.`,
  };
  if (status.estado === 'pronto_para_fechar') return {
    ...common,
    id: `alerta_finalizar_ciclo_${cicloId}`,
    type: 'ciclo_finalizacao',
    title: 'Pronto para fechar',
    message: `${ciclo?.nome || 'Seu ciclo semanal'} foi concluído. Feche a rodada para iniciar a próxima.`,
    actionLabel: 'Fechar rodada',
  };
  return null;
};
