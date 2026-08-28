import { useCallback } from 'react';
import { collection, doc, increment, setDoc, Timestamp } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { applyCronogramaRegistroProgress, emitRegistroProgressOptimisticUpdate } from '../services/reviewOptimisticUpdates';
import { scheduleCycleReviewsForRecord, syncRegistroAfterSave } from '../services/studyRecords/creation';
import {
  dateToYMD,
  getCompletionDocId,
  isRegistroContext,
  normalizeRegistroPayload,
  sortRegistrosEstudo,
} from '../services/studyRecords/utils';
import { estimateAcademicXPForRecord } from '../utils/academicXPPreview';
import { notifyGamificationSaveFailed, requestGamificationRefresh } from '../utils/gamificationRealtime';

export const useStudyRecordActions = ({
  userUid,
  activeCicloId,
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

      const payload = {
        ...data,
        data: data?.data || dateToYMD(new Date()),
        tempoEstudadoMinutos: Number(data?.tempoEstudadoMinutos || 0),
        questoesFeitas: Number(data?.questoesFeitas || 0),
        acertos: Number(data?.acertos || 0),
        timestamp: Timestamp.now(),
        ...(contextoRegistro ? { contextoRegistro } : {}),
        ...(cicloIdResolved ? { cicloId: cicloIdResolved } : {}),
        ...(cronogramaIdResolved ? { cronogramaId: cronogramaIdResolved } : {}),
        ...(contextoRegistro === 'cronograma' && data?.naoConcluidoCronograma ? { naoConcluidoCronograma: true } : {}),
      };
      const dailyGoalBeforeStatus = getDailyGoalStatusForPlan({ context: payload.contextoRegistro, dateKey: payload.data });
      let dailyGoalModalChecked = false;
      const checkDailyGoalAfterPlanSync = async () => {
        if (dailyGoalModalChecked) return;
        dailyGoalModalChecked = true;
        await maybeShowDailyGoalCompleted({
          payload,
          wasGoalMet: Boolean(dailyGoalBeforeStatus?.goalMet),
          forceAfterCompletionAction: payload.origemConclusao === 'botao_concluir',
        });
      };

      const completionDocId = getCompletionDocId(payload.origemConclusaoId);
      const registroRef = completionDocId
        ? doc(db, 'users', userUid, 'registrosEstudo', completionDocId)
        : doc(collection(db, 'users', userUid, 'registrosEstudo'));
      const savedRegistroId = registroRef.id;
      const registroAnterior = allRegistrosEstudo.find((item) => item.id === savedRegistroId) || null;
      const registroJaExistia = Boolean(registroAnterior);
      const isRegistroRevisao = payload.isRevisao || payload.revisao || payload.tipoEstudo === 'revisao';
      const isCompletionRegistro = payload.origemConclusao === 'botao_concluir' || Boolean(completionDocId);
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
        await setDoc(registroRef, payload);
      } catch (error) {
        rollbackOptimisticRegistro();
        throw error;
      }

      if (registroJaExistia) {
        await maybeShowDailyGoalCompleted({
          payload,
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
            isCompletionRegistro,
            isRegistroRevisao,
            activeCycleDisciplines,
          });
          await checkDailyGoalAfterPlanSync();
        })(),
        scheduleCycleReviewsForRecord({ db, userUid, payload, isCompletionRegistro }),
        setDoc(doc(db, 'users', userUid, 'stats', 'geral'), {
          totalHorasMinutos: increment(payload.tempoEstudadoMinutos),
          totalQuestoes: increment(payload.questoesFeitas),
          totalAcertos: increment(payload.acertos),
        }, { merge: true }),
      ];

      Promise.allSettled(postSaveTasks).then((results) => {
        results.forEach((result) => {
          if (result.status === 'rejected') console.error('[Dashboard] Erro em pos-salvamento do registro:', result.reason);
        });
      });
      return true;
    } catch (error) {
      console.error(error);
      throw error;
    }
  }, [
    activeCicloId,
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
