const normalizeTopic = (value) => String(value || '')
  .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .replace(/\s+/g, ' ').trim().toLowerCase();

const topicName = (value) => typeof value === 'string'
  ? value : (value?.nome || value?.titulo || value?.label || '');

/**
 * Split the cycle's syllabus using explicit completion records. A study session
 * alone does not prove that theory was finished.
 * @param {Array<object>} disciplinas
 * @param {Array<object>} registros
 * @returns {Array<object>}
 */
export function buildTransformationDisciplines(disciplinas, registros) {
  const finished = new Map();
  for (const record of registros || []) {
    const completedInCycle = record?.tipoEstudo === 'check_manual';
    const completedInSchedule = record?.contextoRegistro === 'cronograma'
      && record?.origemConclusao === 'botao_concluir'
      && record?.isRevisao !== true && record?.revisao !== true;
    if ((!completedInCycle && !completedInSchedule) || !record?.assunto) continue;
    const key = String(record.disciplinaId || record.disciplinaNome || '').trim();
    if (!key) continue;
    if (!finished.has(key)) finished.set(key, new Set());
    finished.get(key).add(normalizeTopic(record.assunto));
  }

  return (disciplinas || []).map((disciplina) => {
    const done = finished.get(String(disciplina.id))
      || finished.get(String(disciplina.nome || '').trim()) || new Set();
    const subjects = (Array.isArray(disciplina.assuntos) ? disciplina.assuntos : [])
      .map(topicName).map((name) => String(name || '').trim()).filter(Boolean);
    return {
      ...disciplina,
      assuntos: subjects.filter((name) => !done.has(normalizeTopic(name))),
      assuntosConcluidosAntesTransformacao: [...new Set([
        ...(disciplina.assuntosConcluidosAntesTransformacao || []),
        ...subjects.filter((name) => done.has(normalizeTopic(name))),
      ])],
      semAssuntosPendentes: subjects.length > 0 && subjects.every((name) => done.has(normalizeTopic(name))),
    };
  });
}

/** @returns {object} Wizard state with the cycle discipline IDs intact. */
export function buildCycleToScheduleWizardState(ciclo, disciplinas, registros, startDate) {
  const converted = buildTransformationDisciplines(disciplinas, registros);
  const horarios = Object.fromEntries(Array.from({ length: 7 }, (_, day) => [day, 0]));
  const weeklyHours = Number(ciclo?.cargaHorariaSemanalTotal) || 0;
  const studyDays = Array.isArray(ciclo?.diasEstudo)
    ? ciclo.diasEstudo.map(Number)
    : Object.entries(ciclo?.diasEstudo || {}).filter(([, value]) => Number(value) > 0).map(([day]) => Number(day));
  const days = studyDays.filter((day) => Number.isInteger(day) && day >= 0 && day <= 6);
  for (const day of days) {
    horarios[day] = Number(ciclo?.diasEstudo?.[day]) > 0
      ? Number(ciclo.diasEstudo[day]) : (weeklyHours > 0 ? weeklyHours / days.length : 1);
  }
  const selecao = Object.fromEntries(converted.map((disciplina) => [disciplina.id, {
    checked: disciplina.inCiclo !== false && disciplina.assuntos.length > 0,
    parcial: false,
    assuntosMarcados: new Set(disciplina.assuntos.map((_, index) => index)),
    conhecimentoNivel: Number(disciplina.conhecimentoNivel) || 3,
    importanciaNivel: Number(disciplina.importanciaNivel) || 3,
  }]));
  return {
    tipo: 'personalizado',
    edital: {
      id: ciclo?.editalId || 'manual',
      titulo: ciclo?.nome || 'Planejamento',
      logoUrl: ciclo?.logoUrl || null,
    },
    disciplinas: converted,
    extraDisciplinas: [],
    selecao,
    horarios,
    cronConfig: {
      nome: ciclo?.nome || 'Planejamento',
      dataInicio: startDate,
      dataInicioManual: true,
      modoMontagem: 'inteligente',
      disciplinasTodosDiasIds: ciclo?.disciplinaTodosDiasIds || [],
      tempoRevisaoMinutos: 20,
      duracaoMinimaSessaoMinutos: ciclo?.duracaoMinimaSessaoMinutos || 40,
      duracaoMaximaSessaoMinutos: ciclo?.duracaoMaximaSessaoMinutos || 80,
    },
  };
}

export function belongsToPlanning(record, planning) {
  if (!record || !planning) return false;
  if (record.planejamentoId === planning.id) return true;
  return (planning.etapas || []).some((stage) => (
    (stage.metodo === 'ciclo' && record.cicloId === stage.id)
    || (stage.metodo === 'cronograma' && record.cronogramaId === stage.id)
  ));
}

/** Keep original stage links and count each persisted record once. */
export function getPlanningStageRecords(records, currentStage) {
  if (!currentStage?.id) return [];
  const cycleIds = new Set((currentStage.etapasPlanejamento || [])
    .filter((stage) => stage.metodo === 'ciclo').map((stage) => stage.id));
  const scheduleIds = new Set((currentStage.etapasPlanejamento || [])
    .filter((stage) => stage.metodo === 'cronograma').map((stage) => stage.id));
  if (currentStage.cicloVinculadoId) cycleIds.add(currentStage.cicloVinculadoId);
  if (currentStage.metodoVigente === 'ciclo') cycleIds.add(currentStage.id);
  else scheduleIds.add(currentStage.id);
  const byId = new Map();
  (records || []).forEach((record, index) => {
    if (!(currentStage.planejamentoId && record?.planejamentoId === currentStage.planejamentoId)
      && !scheduleIds.has(record?.cronogramaId)
      && !cycleIds.has(record?.cicloId)) return;
    byId.set(record.id || `record-${index}`, record);
  });
  return [...byId.values()];
}

export const getSchedulePlanningRecords = getPlanningStageRecords;

export const getCycleStageGoalSnapshot = (cycle) => ({
  dataInicioPlanejamento: cycle?.dataInicioPlanejamento || null,
  diasEstudo: cycle?.diasEstudo || null,
  tempoSessaoMinutos: Number(cycle?.tempoSessaoMinutos) || 60,
});

export const getScheduleStageGoalSnapshot = (schedule, template = schedule?.semanaTemplate || []) => {
  const daily = Object.fromEntries(Array.from({ length: 7 }, (_, day) => [day, {
    dia: day, minutosEstudo: 0, minutosBrutoDia: 0,
  }]));
  for (const slot of template) {
    const day = Number(slot.dia);
    if (!Number.isInteger(day) || day < 0 || day > 6) continue;
    if (!slot.isRevisao && !slot.isRevisaoAuto) {
      daily[day].minutosEstudo += Number(slot.minutosEstudo || slot.tempoMinutos || 0);
    }
    daily[day].minutosBrutoDia = Math.max(daily[day].minutosBrutoDia,
      Number(slot.minutosBrutoDia || 0));
  }
  return {
    dataInicio: schedule?.dataInicio || null,
    diasEstudo: schedule?.diasEstudo || null,
    horariosDetalhados: schedule?.horariosDetalhados || {},
    semanaTemplate: Object.values(daily),
  };
};
