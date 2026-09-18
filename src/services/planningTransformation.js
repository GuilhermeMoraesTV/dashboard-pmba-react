import {
  collection, doc, documentId, getDocFromServer, getDocsFromServer,
  limit, orderBy, query, runTransaction, startAfter, where,
} from 'firebase/firestore';
import { db } from '../firebaseConfig.js';
import {
  buildCycleToScheduleWizardState, buildTransformationDisciplines,
  getCycleStageGoalSnapshot, getScheduleStageGoalSnapshot,
} from '../utils/planningTransformation.js';
import { getBrasiliaTodayKey } from '../utils/planningDates.js';

const PAGE_SIZE = 100;

/** One paginated read pass, only when the user opens the transformation. */
async function readAllPages(ref, filters = []) {
  const result = [];
  let cursor = null;
  for (;;) {
    const parts = [...filters, orderBy(documentId()), limit(PAGE_SIZE)];
    if (cursor) parts.push(startAfter(cursor));
    const page = await getDocsFromServer(query(ref, ...parts));
    result.push(...page.docs.map((item) => ({ id: item.id, ...item.data() })));
    if (page.size < PAGE_SIZE) return result;
    cursor = page.docs[page.docs.length - 1];
  }
}

export async function prepareCycleToSchedule(userId, cycleId) {
  const cycleRef = doc(db, 'users', userId, 'ciclos', cycleId);
  const cycleSnap = await getDocFromServer(cycleRef);
  if (!cycleSnap.exists()) throw new Error('Ciclo não encontrado.');
  const ciclo = { id: cycleId, ...cycleSnap.data() };
  if (!ciclo.ativo || ciclo.arquivado || ciclo.metodoVigente === 'cronograma') {
    throw new Error('Abra um ciclo vigente para transformá-lo.');
  }
  const [disciplinas, registros, revisoesHerdadas] = await Promise.all([
    readAllPages(collection(db, 'users', userId, 'ciclos', cycleId, 'disciplinas')),
    readAllPages(collection(db, 'users', userId, 'registrosEstudo'), [where('cicloId', '==', cycleId)]),
    readAllPages(collection(db, 'users', userId, 'revisoesCiclo'), [where('cicloId', '==', cycleId)]),
  ]);
  const state = buildCycleToScheduleWizardState(ciclo, disciplinas, registros, getBrasiliaTodayKey());
  state.cronConfig.revisoesHerdadas = revisoesHerdadas
    .filter((item) => !item.concluida && !item.concluido)
    .map((item) => ({ id: item.id, disciplinaId: item.disciplinaId, assunto: item.assunto, dataAgendada: item.dataAgendada }));
  return {
    ciclo,
    state,
  };
}

/**
 * A fixed schedule ID and one transaction make repeated confirmations safe.
 * The cycle remains current if any read, validation or write fails.
 */
export async function confirmCycleToSchedule({ userId, cycleId, schedule, semanaTemplate, disciplinas }) {
  if (!userId || !cycleId || !semanaTemplate?.length || !disciplinas?.length) {
    throw new Error('Dados incompletos para transformar o planejamento.');
  }
  const cycleRef = doc(db, 'users', userId, 'ciclos', cycleId);
  const sourceCycleSnap = await getDocFromServer(cycleRef);
  if (!sourceCycleSnap.exists()) throw new Error('O ciclo não existe mais.');
  const planningId = sourceCycleSnap.data().planejamentoId || cycleId;
  const planningRef = doc(db, 'users', userId, 'planejamentos', planningId);
  const sourcePlanningSnap = await getDocFromServer(planningRef);
  const sourcePlanning = sourcePlanningSnap.exists() ? sourcePlanningSnap.data() : null;
  if (sourcePlanning?.metodoVigente === 'cronograma') return sourcePlanning.etapaVigenteId;
  const scheduleCount = (sourcePlanning?.etapas || []).filter((stage) => stage.metodo === 'cronograma').length;
  const scheduleId = scheduleCount === 0 ? planningId : `${planningId}-cronograma-${scheduleCount + 1}`;
  const scheduleRef = doc(db, 'users', userId, 'cronogramas', scheduleId);
  const timerRef = doc(db, 'active_timers', userId);
  const simulationRef = doc(db, 'users', userId, 'personal_timers', 'active_simulado');

  return runTransaction(db, async (transaction) => {
    const [planningSnap, cycleSnap, scheduleSnap, timerSnap, simulationSnap] = await Promise.all([
      transaction.get(planningRef), transaction.get(cycleRef), transaction.get(scheduleRef),
      transaction.get(timerRef), transaction.get(simulationRef),
    ]);
    if (!cycleSnap.exists()) throw new Error('O ciclo não existe mais.');
    const cycle = cycleSnap.data();
    const planning = planningSnap.exists() ? planningSnap.data() : null;
    if (planning?.metodoVigente === 'cronograma' && planning?.etapaVigenteId === scheduleId && scheduleSnap.exists()) {
      return scheduleId;
    }
    if (scheduleSnap.exists() || planning?.metodoVigente === 'cronograma') {
      throw new Error('Este planejamento já possui um cronograma. Reabra a página.');
    }
    if (!cycle.ativo || cycle.arquivado) throw new Error('O ciclo deixou de estar vigente.');
    if (planning && (planning.metodoVigente !== 'ciclo' || planning.etapaVigenteId !== cycleId)) {
      throw new Error('A etapa vigente mudou. Reabra o planejamento.');
    }
    if (timerSnap.exists() && !['finished', 'finishing'].includes(timerSnap.data()?.status)) {
      throw new Error('Finalize ou cancele o estudo ativo antes de transformar o planejamento.');
    }
    if (simulationSnap.exists() && !['finished', 'finishing'].includes(simulationSnap.data()?.status)) {
      throw new Error('Finalize ou cancele o cronômetro ativo antes de transformar o planejamento.');
    }

    const now = new Date().toISOString();
    const etapas = planning?.etapas || [{ metodo: 'ciclo', id: cycleId, inicioEm: now }];
    const pastStages = etapas.map((stage) => stage.id === cycleId
      ? { ...stage, metas: getCycleStageGoalSnapshot(cycle) } : stage);
    const nextStages = [...pastStages, {
      metodo: 'cronograma', id: scheduleId, inicioEm: now,
      metas: getScheduleStageGoalSnapshot(schedule, semanaTemplate),
    }];
    transaction.set(scheduleRef, {
      ...schedule,
      planejamentoId: planningId,
      cicloVinculadoId: cycleId,
      etapasPlanejamento: nextStages,
      ativo: true,
      arquivado: false,
      criadoEm: now,
      semanaTemplate,
      disciplinasSnapshot: disciplinas,
      semanaTemplateVigenteDesde: 0,
      historicoSemanasTemplate: {},
      progresso: {},
      progressoMinutos: {},
      pendenciasTeoria: {},
      historicoRevisoes: {},
    });
    transaction.update(cycleRef, {
      planejamentoId: planningId,
      metodoVigente: 'cronograma',
      cronogramaVinculadoId: scheduleId,
      ativo: false,
    });
    transaction.set(planningRef, {
      nome: cycle.nome || schedule.nome || 'Planejamento',
      editalId: cycle.editalId || schedule.editalId || null,
      metodoVigente: 'cronograma',
      etapaVigenteId: scheduleId,
      etapas: nextStages,
      arquivado: false,
      criadoEm: planning?.criadoEm || now,
    });
    return scheduleId;
  });
}

/** A new cycle stage starts an empty round while all previous stages remain intact. */
export async function returnScheduleToCycle(userId, scheduleId) {
  const scheduleRef = doc(db, 'users', userId, 'cronogramas', scheduleId);
  const sourceSnap = await getDocFromServer(scheduleRef);
  if (!sourceSnap.exists()) throw new Error('Cronograma não encontrado.');
  const schedule = sourceSnap.data();
  const planningId = schedule.planejamentoId;
  if (!planningId) throw new Error('Este cronograma ainda não tem identidade de planejamento.');
  const planningRef = doc(db, 'users', userId, 'planejamentos', planningId);
  const sourcePlanningSnap = await getDocFromServer(planningRef);
  if (!sourcePlanningSnap.exists()) throw new Error('Planejamento não encontrado.');
  const sourcePlanning = sourcePlanningSnap.data();
  if (sourcePlanning.metodoVigente === 'ciclo') return sourcePlanning.etapaVigenteId;
  if (sourcePlanning.metodoVigente !== 'cronograma' || sourcePlanning.etapaVigenteId !== scheduleId) {
    throw new Error('Abra o cronograma vigente para voltar ao ciclo.');
  }
  const priorCycleId = [...sourcePlanning.etapas].reverse().find((stage) => stage.metodo === 'ciclo')?.id;
  if (!priorCycleId) throw new Error('A etapa anterior de ciclo não foi encontrada.');
  const priorCycleRef = doc(db, 'users', userId, 'ciclos', priorCycleId);
  const priorCycleSnap = await getDocFromServer(priorCycleRef);
  if (!priorCycleSnap.exists()) throw new Error('O ciclo anterior não existe mais.');
  const [priorDisciplines, scheduleRecords] = await Promise.all([
    readAllPages(collection(db, 'users', userId, 'ciclos', priorCycleId, 'disciplinas')),
    readAllPages(collection(db, 'users', userId, 'registrosEstudo'), [where('cronogramaId', '==', scheduleId)]),
  ]);
  if (priorDisciplines.length > 450) throw new Error('O ciclo excede o limite seguro de disciplinas para uma troca atômica.');
  const pendingById = new Map(buildTransformationDisciplines(
    schedule.disciplinasSnapshot || priorDisciplines, scheduleRecords,
  ).map((item) => [item.id, item]));
  const cycleCount = sourcePlanning.etapas.filter((stage) => stage.metodo === 'ciclo').length;
  const newCycleId = `${planningId}-ciclo-${cycleCount + 1}`;
  const newCycleRef = doc(db, 'users', userId, 'ciclos', newCycleId);
  const timerRef = doc(db, 'active_timers', userId);
  const simulationRef = doc(db, 'users', userId, 'personal_timers', 'active_simulado');
  const today = getBrasiliaTodayKey();

  return runTransaction(db, async (transaction) => {
    const [planningSnap, scheduleSnap, previousCycleSnap, newCycleSnap, timerSnap, simulationSnap] = await Promise.all([
      transaction.get(planningRef), transaction.get(scheduleRef), transaction.get(priorCycleRef),
      transaction.get(newCycleRef), transaction.get(timerRef), transaction.get(simulationRef),
    ]);
    if (planningSnap.data()?.metodoVigente === 'ciclo' && newCycleSnap.exists()) return newCycleId;
    if (!scheduleSnap.exists() || !previousCycleSnap.exists()
      || planningSnap.data()?.metodoVigente !== 'cronograma'
      || planningSnap.data()?.etapaVigenteId !== scheduleId || !scheduleSnap.data()?.ativo) {
      throw new Error('O método vigente mudou. Reabra o planejamento.');
    }
    if (newCycleSnap.exists()) throw new Error('A nova etapa já existe. Reabra o planejamento.');
    if ((timerSnap.exists() && !['finished', 'finishing'].includes(timerSnap.data()?.status))
      || (simulationSnap.exists() && !['finished', 'finishing'].includes(simulationSnap.data()?.status))) {
      throw new Error('Finalize ou cancele o cronômetro ativo antes de voltar ao ciclo.');
    }

    const stages = [
      ...planningSnap.data().etapas.map((stage) => stage.id === scheduleId
        ? { ...stage, metas: getScheduleStageGoalSnapshot(scheduleSnap.data()) } : stage),
      {
        metodo: 'ciclo', id: newCycleId, inicioEm: new Date().toISOString(),
        metas: getCycleStageGoalSnapshot({ ...previousCycleSnap.data(), dataInicioPlanejamento: today }),
      },
    ];
    transaction.set(newCycleRef, {
      ...previousCycleSnap.data(),
      nome: planningSnap.data().nome || scheduleSnap.data().nome,
      planejamentoId: planningId,
      dataInicioPlanejamento: today,
      dataCriacao: new Date(),
      ultimaConclusao: null,
      conclusoes: 0,
      ativo: true,
      arquivado: false,
      cronogramaVinculadoId: null,
      metodoVigente: 'ciclo',
      sessoesConcluidas: [],
      progressoSessoes: {},
      sessoesConcluidasDetalhes: {},
      cycleProgressOperations: {},
      cycleRoundMinutesByDisciplineUntilIdeal: {},
      lastCycleProgressOperationId: `return:${newCycleId}`,
      etapasPlanejamento: stages,
    });
    for (const discipline of priorDisciplines) {
      const pending = pendingById.get(discipline.id);
      const { id, ...payload } = discipline;
      transaction.set(doc(db, 'users', userId, 'ciclos', newCycleId, 'disciplinas', id), {
        ...payload,
        assuntos: pending?.assuntos || payload.assuntos || [],
        assuntosConcluidosAntesTransformacao: [
          ...(payload.assuntosConcluidosAntesTransformacao || []),
          ...(pending?.assuntosConcluidosAntesTransformacao || []),
        ],
      });
    }
    transaction.update(scheduleRef, { ativo: false, metodoVigente: 'ciclo' });
    transaction.update(planningRef, { metodoVigente: 'ciclo', etapaVigenteId: newCycleId, etapas: stages });
    return newCycleId;
  });
}
