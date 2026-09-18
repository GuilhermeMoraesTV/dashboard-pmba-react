import { useCallback } from 'react';
import { collection, doc, increment, setDoc, Timestamp } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { applyCronogramaRegistroProgress, emitRegistroProgressOptimisticUpdate } from '../services/reviewOptimisticUpdates';
import {
  persistCycleStudyRecordWithProgress,
  scheduleCycleReviewsForRecord,
  syncRegistroAfterSave,
} from '../services/studyRecords/creation';
import {
  dateToYMD,
  getCompletionDocId,
  isRegistroContext,
  normalizeRegistroPayload,
  sortRegistrosEstudo,
} from '../services/studyRecords/utils';
import { estimateAcademicXPForRecord } from '../utils/academicXPPreview';
import { notifyGamificationSaveFailed, requestGamificationRefresh } from '../utils/gamificationRealtime';
import {
  assertStudyRecordMinutesAreValid,
  STUDY_RECORD_MINUTES_ERROR_CODE,
} from '../services/studyRecords/validation';

export const useStudyRecordActions = ({
  userUid,
  activeCicloId,
  activeCicloRoundVersion,
  activeCronogramaId,
  activeCycleDisciplines,
  cicloPendenteFinalizacao,
  cicloFinalizacaoMessage,
  allRegistrosEstudo,
  allSimulados,
  pendingRegistrosEstudoRef,
  setAllRegistrosEstudo,
  setActiveCronogramaData,
  setWarningAlert,
  getDailyGoalStatusForPlan,
  maybeShowDailyGoalCompleted,
}) => {
  const applyRegistroProgressOptimistic = useCallback((payload) => {
    if (!payload) return;
    emitRegistroProgressOptimisticUpdate(payload);
    if (payload.contextoRegistro === 'cronograma' && payload.cronogramaId) {
      setActiveCronogramaData((previous) => (
        previous?.id === payload.cronogramaId
          ? applyCronogramaRegistroProgress(previous, payload)
          : previous
      ));
    }
  }, [setActiveCronogramaData]);

  const addRegistroEstudo = useCallback(async (data, options = {}) => {
    if (!userUid) throw new Error('usuario-obrigatorio');
    try {
      const explicitContext = data?.contextoRegistro;
      const hasCicloDisponivel = Boolean(activeCicloId);
      const hasCronogramaDisponivel = Boolean(activeCronogramaId);
      let contextoRegistro = isRegistroContext(explicitContext) ? explicitContext : null;
      if (!contextoRegistro) {
        if (data?.cronogramaId && !data?.cicloId) contextoRegistro = 'cronograma';
        else if (data?.cicloId && !data?.cronogramaId) contextoRegistro = 'ciclo';
        else if (hasCicloDisponivel && !hasCronogramaDisponivel) contextoRegistro = 'ciclo';
        else if (!hasCicloDisponivel && hasCronogramaDisponivel) contextoRegistro = 'cronograma';
      }

      const cicloIdResolved = contextoRegistro === 'ciclo' ? (data?.cicloId || activeCicloId || null) : null;
      const cronogramaIdResolved = contextoRegistro === 'cronograma' ? (data?.cronogramaId || activeCronogramaId || null) : null;
      if (contextoRegistro === 'cronograma' && !cronogramaIdResolved) throw new Error('cronograma-id-obrigatorio');
      if (
        contextoRegistro === 'ciclo'
        && String(cicloIdResolved || '') === String(activeCicloId || '')
        && cicloPendenteFinalizacao
        && data?.origemConclusao !== 'botao_concluir'
      ) {
        setWarningAlert({ isOpen: true, title: 'Ciclo aguardando finalizacao', message: cicloFinalizacaoMessage });
        return;
      }

      const hasRequestedCycleRoundVersion = Object.prototype.hasOwnProperty.call(data || {}, 'cicloRoundVersion');
      const requestedCycleRoundVersion = hasRequestedCycleRoundVersion
        ? data.cicloRoundVersion
        : activeCicloRoundVersion;
      const hasCycleRoundVersion = requestedCycleRoundVersion !== null
        && requestedCycleRoundVersion !== undefined
        && requestedCycleRoundVersion !== ''
        && Number.isInteger(Number(requestedCycleRoundVersion));
      const tempoEstudadoMinutos = assertStudyRecordMinutesAreValid(data?.tempoEstudadoMinutos || 0);
      const hasDuracaoMinutos = Object.prototype.hasOwnProperty.call(data || {}, 'duracaoMinutos');
      const hasLegacyMinutes = Object.prototype.hasOwnProperty.call(data || {}, 'minutes');
      const duracaoMinutos = hasDuracaoMinutos
        ? assertStudyRecordMinutesAreValid(data.duracaoMinutos)
        : null;
      const legacyMinutes = hasLegacyMinutes
        ? assertStudyRecordMinutesAreValid(data.minutes)
        : null;
      const payload = {
        ...data,
        data: data?.data || dateToYMD(new Date()),
        tempoEstudadoMinutos,
        ...(hasDuracaoMinutos ? { duracaoMinutos } : {}),
        ...(hasLegacyMinutes ? { minutes: legacyMinutes } : {}),
        questoesFeitas: Number(data?.questoesFeitas || 0),
        acertos: Number(data?.acertos || 0),
        timestamp: Timestamp.now(),
        ...(contextoRegistro ? { contextoRegistro } : {}),
        ...(cicloIdResolved ? { cicloId: cicloIdResolved } : {}),
        ...(contextoRegistro === 'ciclo' && hasCycleRoundVersion
          ? { cicloRoundVersion: Number(requestedCycleRoundVersion) }
          : {}),
        ...(cronogramaIdResolved ? { cronogramaId: cronogramaIdResolved } : {}),
        ...(contextoRegistro === 'cronograma' && data?.naoConcluidoCronograma ? { naoConcluidoCronograma: true } : {}),
      };
      const dailyGoalBeforeStatus = getDailyGoalStatusForPlan({ context: payload.contextoRegistro, dateKey: payload.data });
      let dailyGoalModalChecked = false;
      const checkDailyGoalAfterPlanSync = async () => {
        if (dailyGoalModalChecked) return;
        dailyGoalModalChecked = true;
        await maybeShowDailyGoalCompleted({
          payload: { ...payload, id: savedRegistroId },
          wasGoalMet: Boolean(dailyGoalBeforeStatus?.goalMet),
          forceAfterCompletionAction: payload.origemConclusao === 'botao_concluir',
        });
      };

      const completionDocId = getCompletionDocId(payload.origemConclusaoId);
      const cycleProgressOperationId = String(payload.cycleProgressOperationId || '').trim();
      const hasValidCycleOperationId = /^[A-Za-z0-9_-]{8,180}$/.test(cycleProgressOperationId);
      const isRegistroRevisao = payload.isRevisao || payload.revisao || payload.tipoEstudo === 'revisao';
      const isCompletionRegistro = payload.origemConclusao === 'botao_concluir' || Boolean(completionDocId);
      const shouldPersistCycleProgressAtomically = Boolean(
        payload.contextoRegistro === 'ciclo'
        && payload.cicloId
        && !isRegistroRevisao
        && !isCompletionRegistro
      );
      if (shouldPersistCycleProgressAtomically && !hasValidCycleOperationId) {
        throw new Error('ciclo-operacao-id-obrigatoria');
      }
      const registroRef = completionDocId
        ? doc(db, 'users', userUid, 'registrosEstudo', completionDocId)
        : shouldPersistCycleProgressAtomically
          ? doc(db, 'users', userUid, 'registrosEstudo', `cycle_${cycleProgressOperationId}`)
        : doc(collection(db, 'users', userUid, 'registrosEstudo'));
      const savedRegistroId = registroRef.id;
      const registroAnterior = allRegistrosEstudo.find((item) => item.id === savedRegistroId) || null;
      const registroJaExistia = Boolean(registroAnterior);
      const xpPreview = estimateAcademicXPForRecord({
        existingRecords: allRegistrosEstudo,
        existingSimulations: allSimulados,
        record: payload,
        excludeId: savedRegistroId,
      });

      const optimisticRegistro = normalizeRegistroPayload(savedRegistroId, payload);
      pendingRegistrosEstudoRef.current.set(savedRegistroId, optimisticRegistro);
      setAllRegistrosEstudo((previous) => sortRegistrosEstudo([
        optimisticRegistro,
        ...previous.filter((item) => item.id !== savedRegistroId),
      ]));
      if (!isCompletionRegistro || payload.contextoRegistro === 'cronograma' || isRegistroRevisao) {
        applyRegistroProgressOptimistic(payload);
      }

      const rollbackOptimisticRegistro = () => {
        pendingRegistrosEstudoRef.current.delete(savedRegistroId);
        setAllRegistrosEstudo((previous) => {
          const withoutCurrent = previous.filter((item) => item.id !== savedRegistroId);
          return registroAnterior ? sortRegistrosEstudo([registroAnterior, ...withoutCurrent]) : withoutCurrent;
        });
        notifyGamificationSaveFailed({ uid: userUid, sourceType: 'study', sourceId: savedRegistroId });
      };

      if (options.waitForCompletion) {
        try {
          const completionConfirmed = await options.waitForCompletion;
          if (completionConfirmed === false) {
            rollbackOptimisticRegistro();
            return false;
          }
        } catch (error) {
          rollbackOptimisticRegistro();
          console.error('[Dashboard] Conclusão não confirmada; registro otimista revertido:', error);
          return false;
        }
      }

      try {
        let wasDuplicate = false;
        if (shouldPersistCycleProgressAtomically) {
          const result = await persistCycleStudyRecordWithProgress({
            db,
            userUid,
            registroRef,
            payload,
            disciplinas: activeCycleDisciplines,
          });
          wasDuplicate = result.duplicate === true;
          Object.assign(payload, result.payload);
          const persistedOptimisticRegistro = normalizeRegistroPayload(savedRegistroId, payload);
          pendingRegistrosEstudoRef.current.set(savedRegistroId, persistedOptimisticRegistro);
          setAllRegistrosEstudo((previous) => sortRegistrosEstudo([
            persistedOptimisticRegistro,
            ...previous.filter((item) => item.id !== savedRegistroId),
          ]));
        } else {
          await setDoc(registroRef, payload);
        }
        if (wasDuplicate) {
          pendingRegistrosEstudoRef.current.delete(savedRegistroId);
          return true;
        }
      } catch (error) {
        rollbackOptimisticRegistro();
        throw error;
      }

      if (!registroJaExistia && savedRegistroId) {
        requestGamificationRefresh({
          uid: userUid,
          sourceType: 'study',
          sourceId: savedRegistroId,
          message: isRegistroRevisao
            ? 'Revisão concluída.'
            : payload.conclusaoManual
              ? 'Bloco concluído.'
              : 'Estudo registrado.',
          xpTotal: xpPreview,
        });
      }

      if (registroJaExistia) {
        await maybeShowDailyGoalCompleted({
          payload: { ...payload, id: savedRegistroId },
          wasGoalMet: Boolean(dailyGoalBeforeStatus?.goalMet),
          forceAfterCompletionAction: payload.origemConclusao === 'botao_concluir',
        });
        return;
      }

      const postSaveTasks = [
        (async () => {
          await syncRegistroAfterSave({
            db,
            userUid,
            payload,
            registroRef,
            isCompletionRegistro,
            isRegistroRevisao,
            activeCycleDisciplines,
            cycleProgressAlreadyPersisted: shouldPersistCycleProgressAtomically,
          });
          await checkDailyGoalAfterPlanSync();
        })(),
        scheduleCycleReviewsForRecord({ db, userUid, payload, isCompletionRegistro }),
        ...(!shouldPersistCycleProgressAtomically ? [setDoc(doc(db, 'users', userUid, 'stats', 'geral'), {
          totalHorasMinutos: increment(payload.tempoEstudadoMinutos),
          totalQuestoes: increment(payload.questoesFeitas),
          totalAcertos: increment(payload.acertos),
        }, { merge: true })] : []),
      ];

      Promise.allSettled(postSaveTasks).then((results) => {
        results.forEach((result) => {
          if (result.status === 'rejected') console.error('[Dashboard] Erro em pos-salvamento do registro:', result.reason);
        });
      });
      return true;
    } catch (error) {
      if (error?.code !== STUDY_RECORD_MINUTES_ERROR_CODE) console.error(error);
      throw error;
    }
  }, [
    activeCicloId,
    activeCicloRoundVersion,
    activeCronogramaId,
    activeCycleDisciplines,
    allRegistrosEstudo,
    allSimulados,
    applyRegistroProgressOptimistic,
    cicloFinalizacaoMessage,
    cicloPendenteFinalizacao,
    getDailyGoalStatusForPlan,
    maybeShowDailyGoalCompleted,
    pendingRegistrosEstudoRef,
    setAllRegistrosEstudo,
    setWarningAlert,
    userUid,
  ]);

  return { addRegistroEstudo };
};
