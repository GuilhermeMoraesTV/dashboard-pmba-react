import {
  collection,
  doc,
  getDocs,
  increment,
  query,
  runTransaction,
  setDoc,
  Timestamp,
  where,
} from 'firebase/firestore';
import { upsertCicloRevisao } from '../cicloRevisoes';
import {
  marcarPendenciaTeoriaPorRegistro,
  syncRegistroEstudoWithCronograma,
  syncRegistroRevisaoWithCronograma,
} from '../cronogramaProgressSync';
import { applyReviewProgress, getReviewPlannedMinutes, normalizeReviewText } from '../reviewProgressRules';
import { dateToYMD, ymdToDateLocal } from './utils';
import {
  getCycleRecordRoundVersion,
  getCycleRoundVersion,
} from '../../utils/cycleSessionCompletion';
import {
  CYCLE_PROGRESS_CONTRACT_VERSION,
  buildCycleProgressRollbackFromRecord,
  buildCycleProgressUpdateFromRecord,
  isCycleProgressRecord,
} from '../../utils/cycleProgressPersistence';
import {
  addDaysToDateKey,
  dateToLocalKey,
  getCicloRoundStartKey,
} from '../../utils/cicloWeeklyStatus';

const getRoundMinutesByDisciplineUpdate = (cicloData, payload, direction = 1) => {
  const disciplinaId = String(payload?.disciplinaId || '').trim();
  const minutes = Math.max(0, Number(payload?.tempoEstudadoMinutos || 0));
  if (!disciplinaId || minutes <= 0) return cicloData?.cycleRoundMinutesByDisciplineUntilIdeal || {};
  const startKey = getCicloRoundStartKey(cicloData, new Date());
  const idealKey = addDaysToDateKey(startKey, 7);
  const recordKey = dateToLocalKey(payload?.data || payload?.timestamp || new Date());
  if (!recordKey || recordKey < startKey || recordKey > idealKey) {
    return cicloData?.cycleRoundMinutesByDisciplineUntilIdeal || {};
  }
  const current = { ...(cicloData?.cycleRoundMinutesByDisciplineUntilIdeal || {}) };
  current[disciplinaId] = Math.max(0, Number(current[disciplinaId] || 0) + (minutes * direction));
  return current;
};

const getPendingTheoryUpdate = (cicloData, payload) => {
  const disciplinaKey = String(payload?.disciplinaId || '').trim();
  const assuntoAtual = String(payload?.assunto || '').trim();
  if (!disciplinaKey || !assuntoAtual) return cicloData?.pendenciasTeoria || {};
  const next = { ...(cicloData?.pendenciasTeoria || {}) };
  if (payload.teoriaNaoFinalizadaCiclo) {
    next[disciplinaKey] = {
      assuntoAtual,
      minutosAcumulados: Number(payload.tempoEstudadoMinutos || 0),
      status: 'pendente',
      atualizadoEm: payload.timestamp || Timestamp.now(),
    };
  } else if (payload.assuntoFinalizadoCiclo || payload.markAsFinished) {
    next[disciplinaKey] = {
      assuntoAtual: '',
      minutosAcumulados: 0,
      status: 'finalizado',
      atualizadoEm: payload.timestamp || Timestamp.now(),
    };
  }
  return next;
};

export const persistCycleStudyRecordWithProgress = async ({
  db,
  userUid,
  registroRef,
  payload,
  disciplinas = [],
}) => runTransaction(db, async (transaction) => {
  const operationId = String(payload?.cycleProgressOperationId || '').trim();
  if (!operationId) throw new Error('ciclo-operacao-id-obrigatoria');
  const cicloRef = doc(db, 'users', userUid, 'ciclos', payload.cicloId);
  const cicloSnap = await transaction.get(cicloRef);
  if (!cicloSnap.exists()) throw new Error('ciclo-nao-encontrado');

  const cicloData = cicloSnap.data() || {};
  const appliedOperations = cicloData.cycleProgressOperations && typeof cicloData.cycleProgressOperations === 'object'
    ? cicloData.cycleProgressOperations
    : {};
  if (appliedOperations[operationId]) {
    return { payload, staleRound: false, duplicate: true };
  }
  const currentRoundVersion = getCycleRoundVersion(cicloData);
  const requestedRoundVersion = getCycleRecordRoundVersion(payload);
  if (requestedRoundVersion === null) {
    throw new Error('ciclo-identidade-da-rodada-obrigatoria');
  }
  const recordRoundVersion = requestedRoundVersion;
  if (recordRoundVersion !== currentRoundVersion) throw new Error('ciclo-rodada-desatualizada');

  const persistedPayload = {
    ...payload,
    cicloRoundVersion: recordRoundVersion,
    cycleProgressContractVersion: CYCLE_PROGRESS_CONTRACT_VERSION,
  };

  const progressResult = buildCycleProgressUpdateFromRecord({
    cicloData,
    payload: persistedPayload,
    disciplinas,
  });
  persistedPayload.cycleProgressAllocations = progressResult.allocations || {};
  transaction.set(registroRef, persistedPayload);
  transaction.update(cicloRef, {
    ...(progressResult.update || {}),
    pendenciasTeoria: getPendingTheoryUpdate(cicloData, persistedPayload),
    cycleRoundMinutesByDisciplineUntilIdeal: getRoundMinutesByDisciplineUpdate(cicloData, persistedPayload),
    cycleProgressOperations: {
      ...appliedOperations,
      [operationId]: {
        roundVersion: currentRoundVersion,
        appliedAt: persistedPayload.timestamp || Timestamp.now(),
      },
    },
    lastCycleProgressOperationId: operationId,
    cycleProgressContractVersion: CYCLE_PROGRESS_CONTRACT_VERSION,
    roundIdentityVersion: 1,
  });
  transaction.set(doc(db, 'users', userUid, 'stats', 'geral'), {
    totalHorasMinutos: increment(Number(persistedPayload.tempoEstudadoMinutos || 0)),
    totalQuestoes: increment(Number(persistedPayload.questoesFeitas || 0)),
    totalAcertos: increment(Number(persistedPayload.acertos || 0)),
  }, { merge: true });

  return { payload: persistedPayload, staleRound: false, duplicate: false };
});

export const deleteCycleStudyRecordWithProgress = async ({ db, userUid, registroRef }) => (
  runTransaction(db, async (transaction) => {
    const registroSnap = await transaction.get(registroRef);
    if (!registroSnap.exists()) return { deleted: false, payload: null };
    const payload = registroSnap.data() || {};
    if (payload.contextoRegistro !== 'ciclo' || !payload.cicloId) {
      throw new Error('registro-nao-pertence-a-ciclo');
    }
    const cicloRef = doc(db, 'users', userUid, 'ciclos', payload.cicloId);
    const cicloSnap = await transaction.get(cicloRef);
    const cicloData = cicloSnap.exists() ? (cicloSnap.data() || {}) : null;
    const rollback = cicloData ? buildCycleProgressRollbackFromRecord({ cicloData, payload }) : null;
    transaction.delete(registroRef);
    if (cicloData && rollback) {
      const operationId = `delete:${String(payload.cycleProgressOperationId || registroRef.id)}`;
      transaction.update(cicloRef, {
        ...rollback,
        cycleRoundMinutesByDisciplineUntilIdeal: getRoundMinutesByDisciplineUpdate(cicloData, payload, -1),
        lastCycleProgressOperationId: operationId,
        cycleProgressContractVersion: CYCLE_PROGRESS_CONTRACT_VERSION,
      });
    }
    transaction.set(doc(db, 'users', userUid, 'stats', 'geral'), {
      totalHorasMinutos: increment(-Number(payload.tempoEstudadoMinutos || 0)),
      totalQuestoes: increment(-Number(payload.questoesFeitas || 0)),
      totalAcertos: increment(-Number(payload.acertos || 0)),
    }, { merge: true });
    return { deleted: true, payload };
  })
);

export const updateCycleStudyRecordWithProgress = async ({
  db,
  userUid,
  registroRef,
  updates,
  disciplinas = [],
}) => runTransaction(db, async (transaction) => {
  const registroSnap = await transaction.get(registroRef);
  if (!registroSnap.exists()) throw new Error('registro-nao-encontrado');
  const previousPayload = registroSnap.data() || {};
  if (previousPayload.contextoRegistro !== 'ciclo' || !previousPayload.cicloId) {
    throw new Error('registro-nao-pertence-a-ciclo');
  }
  const cicloRef = doc(db, 'users', userUid, 'ciclos', previousPayload.cicloId);
  const cicloSnap = await transaction.get(cicloRef);
  if (!cicloSnap.exists()) throw new Error('ciclo-nao-encontrado');
  const cicloData = cicloSnap.data() || {};

  const nextPayload = {
    ...previousPayload,
    ...updates,
    tempoEstudadoMinutos: Number(updates?.tempoEstudadoMinutos ?? previousPayload.tempoEstudadoMinutos ?? 0),
    questoesFeitas: Number(updates?.questoesFeitas ?? previousPayload.questoesFeitas ?? 0),
    acertos: Number(updates?.acertos ?? previousPayload.acertos ?? 0),
    cycleProgressEditVersion: Number(previousPayload.cycleProgressEditVersion || 0) + 1,
    cycleProgressContractVersion: CYCLE_PROGRESS_CONTRACT_VERSION,
  };
  const previousComparable = JSON.stringify({
    tempo: Number(previousPayload.tempoEstudadoMinutos || 0),
    questoes: Number(previousPayload.questoesFeitas || 0),
    acertos: Number(previousPayload.acertos || 0),
    data: previousPayload.data || null,
  });
  const nextComparable = JSON.stringify({
    tempo: nextPayload.tempoEstudadoMinutos,
    questoes: nextPayload.questoesFeitas,
    acertos: nextPayload.acertos,
    data: nextPayload.data || null,
  });
  if (previousComparable === nextComparable) return { updated: false, payload: previousPayload };

  const statsDelta = {
    minutes: nextPayload.tempoEstudadoMinutos - Number(previousPayload.tempoEstudadoMinutos || 0),
    questions: nextPayload.questoesFeitas - Number(previousPayload.questoesFeitas || 0),
    correct: nextPayload.acertos - Number(previousPayload.acertos || 0),
  };
  if (getCycleRecordRoundVersion(previousPayload) !== getCycleRoundVersion(cicloData)) {
    transaction.set(registroRef, nextPayload);
    if (statsDelta.minutes || statsDelta.questions || statsDelta.correct) {
      transaction.set(doc(db, 'users', userUid, 'stats', 'geral'), {
        totalHorasMinutos: increment(statsDelta.minutes),
        totalQuestoes: increment(statsDelta.questions),
        totalAcertos: increment(statsDelta.correct),
      }, { merge: true });
    }
    return { updated: true, payload: nextPayload };
  }

  const rollback = buildCycleProgressRollbackFromRecord({ cicloData, payload: previousPayload });
  if (!rollback) throw new Error('registro-sem-alocacao-de-progresso');
  const cycleWithoutPrevious = { ...cicloData, ...rollback };
  const progressResult = buildCycleProgressUpdateFromRecord({
    cicloData: cycleWithoutPrevious,
    payload: nextPayload,
    disciplinas,
  });
  nextPayload.cycleProgressAllocations = progressResult.allocations || {};

  const accumulatorWithoutPrevious = getRoundMinutesByDisciplineUpdate(cicloData, previousPayload, -1);
  const cycleForAccumulator = {
    ...cycleWithoutPrevious,
    cycleRoundMinutesByDisciplineUntilIdeal: accumulatorWithoutPrevious,
  };
  const editOperationId = `edit:${previousPayload.cycleProgressOperationId}:${nextPayload.cycleProgressEditVersion}`;
  transaction.set(registroRef, nextPayload);
  transaction.update(cicloRef, {
    ...(progressResult.update || rollback),
    cycleRoundMinutesByDisciplineUntilIdeal: getRoundMinutesByDisciplineUpdate(cycleForAccumulator, nextPayload),
    lastCycleProgressOperationId: editOperationId,
    cycleProgressContractVersion: CYCLE_PROGRESS_CONTRACT_VERSION,
    roundIdentityVersion: 1,
  });
  if (statsDelta.minutes || statsDelta.questions || statsDelta.correct) {
    transaction.set(doc(db, 'users', userUid, 'stats', 'geral'), {
      totalHorasMinutos: increment(statsDelta.minutes),
      totalQuestoes: increment(statsDelta.questions),
      totalAcertos: increment(statsDelta.correct),
    }, { merge: true });
  }
  return { updated: true, payload: nextPayload };
});

export const syncRegistroEstudoWithCiclo = async ({ db, userUid, payload, disciplinas = [] }) => {
  if (!isCycleProgressRecord(payload) || Number(payload.tempoEstudadoMinutos || 0) <= 0) return;
  const cicloRef = doc(db, 'users', userUid, 'ciclos', payload.cicloId);
  await runTransaction(db, async (transaction) => {
    const cicloSnap = await transaction.get(cicloRef);
    if (!cicloSnap.exists()) return;
    const result = buildCycleProgressUpdateFromRecord({ cicloData: cicloSnap.data() || {}, payload, disciplinas });
    if (result.update) transaction.update(cicloRef, {
      ...result.update,
      cycleProgressContractVersion: CYCLE_PROGRESS_CONTRACT_VERSION,
      roundIdentityVersion: 1,
      lastCycleProgressOperationId: `legacy-sync:${Date.now()}`,
    });
  });
};

export const syncRegistroRevisaoWithCiclo = async ({ db, userUid, payload }) => {
  if (!payload?.cicloId) return;
  const minutosRegistrados = Number(payload.tempoEstudadoMinutos || 0);
  if (minutosRegistrados <= 0) return;

  const revisoesRef = collection(db, 'users', userUid, 'revisoesCiclo');
  const snap = await getDocs(query(revisoesRef, where('cicloId', '==', payload.cicloId)));
  const disciplinaIdRegistro = String(payload.disciplinaId || '').trim();
  const assuntoRegistroNorm = normalizeReviewText(payload.assunto);
  const dataRegistro = String(payload.data || '');
  const revisoes = snap.docs
    .map((document) => ({ id: document.id, ...document.data() }))
    .filter((revisao) => {
      if (revisao.concluida) return false;
      if (disciplinaIdRegistro && String(revisao.disciplinaId || '') !== disciplinaIdRegistro) return false;
      if (assuntoRegistroNorm && normalizeReviewText(revisao.assunto) !== assuntoRegistroNorm) return false;
      if (dataRegistro && revisao.dataAgendada && String(revisao.dataAgendada) > dataRegistro) return false;
      return true;
    })
    .sort((a, b) => String(a.dataAgendada || '').localeCompare(String(b.dataAgendada || '')));

  let minutosRestantes = minutosRegistrados;
  for (const revisao of revisoes) {
    if (minutosRestantes <= 0) break;
    const tempoPlanejado = getReviewPlannedMinutes(revisao, 20);
    const { appliedMinutes, nextProgress, done } = applyReviewProgress({
      currentMinutes: Number(revisao.progressoMinutos || 0),
      plannedMinutes: tempoPlanejado,
      addedMinutes: minutosRestantes,
      wasDone: revisao.concluida,
    });
    if (appliedMinutes <= 0) continue;

    await setDoc(doc(revisoesRef, revisao.id), {
      progressoMinutos: nextProgress,
      tempoMinutos: tempoPlanejado,
      ...(done ? {
        concluida: true,
        concluidaEm: Timestamp.now(),
        bloqueiaDesmarcar: true,
        origemConclusao: 'registro_manual',
      } : {}),
      atualizadaEm: Timestamp.now(),
    }, { merge: true });
    minutosRestantes -= appliedMinutes;
  }
};

export const syncRegistroAfterSave = async ({
  db,
  userUid,
  payload,
  registroRef = null,
  isCompletionRegistro,
  isRegistroRevisao,
  activeCycleDisciplines,
  cycleProgressAlreadyPersisted = false,
}) => {
  if (!isCompletionRegistro && payload.contextoRegistro === 'ciclo' && payload.cicloId) {
    const cicloRef = doc(db, 'users', userUid, 'ciclos', payload.cicloId);
    const disciplinaKey = payload.disciplinaId || null;
    const assuntoAtual = String(payload.assunto || '').trim();
    if (!cycleProgressAlreadyPersisted && payload.teoriaNaoFinalizadaCiclo && disciplinaKey && assuntoAtual) {
      await setDoc(cicloRef, {
        pendenciasTeoria: {
          [disciplinaKey]: {
            assuntoAtual,
            minutosAcumulados: Number(payload.tempoEstudadoMinutos || 0),
            status: 'pendente',
            atualizadoEm: Timestamp.now(),
          },
        },
      }, { merge: true });
    } else if (!cycleProgressAlreadyPersisted && disciplinaKey && assuntoAtual && (payload.assuntoFinalizadoCiclo || payload.markAsFinished)) {
      await setDoc(cicloRef, {
        pendenciasTeoria: {
          [disciplinaKey]: {
            assuntoAtual: '',
            minutosAcumulados: 0,
            status: 'finalizado',
            atualizadoEm: Timestamp.now(),
          },
        },
      }, { merge: true });
    }
    if (!payload.teoriaNaoFinalizadaCiclo && !cycleProgressAlreadyPersisted) {
      await syncRegistroEstudoWithCiclo({ db, userUid, payload, disciplinas: activeCycleDisciplines });
    }
  }

  if (!isCompletionRegistro && payload.contextoRegistro === 'cronograma' && payload.cronogramaId) {
    if (isRegistroRevisao) {
      await syncRegistroRevisaoWithCronograma({ db, userUid, cronogramaId: payload.cronogramaId, registro: payload });
    } else if (payload.naoConcluidoCronograma) {
      // A sessão realizada continua contando no progresso/minutos do dia; apenas
      // o conteúdo permanece na fila para a próxima ocorrência da disciplina.
      await syncRegistroEstudoWithCronograma({ db, userUid, cronogramaId: payload.cronogramaId, registro: payload, registroRef });
      await marcarPendenciaTeoriaPorRegistro({ db, userUid, cronogramaId: payload.cronogramaId, registro: payload });
    } else {
      await syncRegistroEstudoWithCronograma({ db, userUid, cronogramaId: payload.cronogramaId, registro: payload, registroRef });
    }
  }

  if (!isCompletionRegistro && payload.contextoRegistro === 'ciclo' && payload.cicloId && isRegistroRevisao) {
    await syncRegistroRevisaoWithCiclo({ db, userUid, payload });
  }
};

export const scheduleCycleReviewsForRecord = async ({ db, userUid, payload, isCompletionRegistro }) => {
  const intervaloRevisaoDias = Number(payload.intervaloRevisaoDias);
  const intervalos = payload.revisaoAutomaticaCiclo === true
    ? [1, 7, 30]
    : [intervaloRevisaoDias].filter((intervalo) => Number.isFinite(intervalo) && intervalo > 0);
  if (isCompletionRegistro || !payload.cicloId || !payload.assunto || !intervalos.length) return;

  for (const intervalo of intervalos) {
    const baseDate = ymdToDateLocal(payload.data);
    baseDate.setDate(baseDate.getDate() + intervalo);
    await upsertCicloRevisao(db, userUid, {
      cicloId: payload.cicloId,
      disciplinaId: payload.disciplinaId || null,
      disciplinaNome: payload.disciplinaNome || 'Disciplina',
      assunto: payload.assunto,
      dataAgendada: dateToYMD(baseDate),
      intervaloDias: intervalo,
      origem: payload.revisaoAutomaticaCiclo === true ? 'registro_estudo_auto_1_7_30' : 'registro_estudo',
    });
  }
};
