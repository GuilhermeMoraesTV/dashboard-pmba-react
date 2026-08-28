import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
  Timestamp,
  updateDoc,
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

const getAssuntoCicloPorSessao = (ciclo, disciplinas, sessao) => {
  const disciplina = (disciplinas || []).find((item) => String(item?.id) === String(sessao?.disciplinaId));
  const assuntos = Array.isArray(disciplina?.assuntos) ? disciplina.assuntos : [];
  const assunto = assuntos[Number(sessao?.sessaoIndex || 0) % Math.max(1, assuntos.length)];
  if (typeof assunto === 'string') return assunto;
  return assunto?.nome || assunto?.titulo || assunto?.label || '';
};

export const syncRegistroEstudoWithCiclo = async ({ db, userUid, payload, disciplinas = [] }) => {
  if (!payload?.cicloId || payload?.isRevisao || payload?.revisao || payload?.tipoEstudo === 'revisao') return;
  const minutosRegistrados = Number(payload.tempoEstudadoMinutos || 0);
  if (minutosRegistrados <= 0) return;

  const cicloRef = doc(db, 'users', userUid, 'ciclos', payload.cicloId);
  const cicloSnap = await getDoc(cicloRef);
  const cicloData = cicloSnap.data() || {};
  const ordemSessoes = Array.isArray(cicloData.ordemSessoes) ? cicloData.ordemSessoes : [];
  if (!ordemSessoes.length) return;

  const tempoSessaoMinutos = Math.max(1, Number(cicloData.tempoSessaoMinutos || 50));
  const concluidas = Array.isArray(cicloData.sessoesConcluidas) ? cicloData.sessoesConcluidas.map(Number) : [];
  const progressoSessoes = cicloData.progressoSessoes || {};
  const disciplinaIdRegistro = String(payload.disciplinaId || '').trim();
  const assuntoRegistroNorm = normalizeReviewText(payload.assunto);

  const candidatosPorDisciplina = ordemSessoes
    .map((sessao, globalIndex) => ({ ...sessao, globalIndex }))
    .filter((sessao) => {
      if (concluidas.includes(Number(sessao.globalIndex))) return false;
      if (Number.isFinite(Number(payload.sessaoGlobalIndex)) && Number(payload.sessaoGlobalIndex) !== Number(sessao.globalIndex)) return false;
      if (disciplinaIdRegistro && String(sessao.disciplinaId || '') !== disciplinaIdRegistro) return false;
      return true;
    });
  const candidatosPorAssunto = assuntoRegistroNorm
    ? candidatosPorDisciplina.filter((sessao) => {
      const assuntoSessao = getAssuntoCicloPorSessao(cicloData, disciplinas, sessao);
      return !assuntoSessao || normalizeReviewText(assuntoSessao) === assuntoRegistroNorm;
    })
    : [];
  const candidatos = (candidatosPorAssunto.length ? candidatosPorAssunto : candidatosPorDisciplina)
    .slice()
    .sort((a, b) => Number(a.globalIndex) - Number(b.globalIndex));
  if (!candidatos.length) return;

  let minutosRestantes = minutosRegistrados;
  const nextProgressSessoes = { ...progressoSessoes };
  const nextCompletionDetails = { ...(cicloData.sessoesConcluidasDetalhes || {}) };
  const novasConcluidas = [...concluidas];
  let lastTouchedIndex = null;
  let changed = false;

  for (const sessao of candidatos) {
    if (minutosRestantes <= 0) break;
    const index = Number(sessao.globalIndex);
    const progressoAtual = Number(progressoSessoes?.[index] || progressoSessoes?.[String(index)] || 0);
    const faltantes = Math.max(0, tempoSessaoMinutos - progressoAtual);
    if (faltantes <= 0) {
      if (minutosRestantes > 0) {
        nextProgressSessoes[String(index)] = progressoAtual + minutosRestantes;
        changed = true;
        lastTouchedIndex = index;
        minutosRestantes = 0;
      }
      if (progressoAtual >= tempoSessaoMinutos && !novasConcluidas.includes(index)) {
        novasConcluidas.push(index);
        nextCompletionDetails[String(index)] = {
          concluidaEm: payload.data,
          atualizadoEm: Timestamp.now(),
          origem: 'registro_manual',
        };
        changed = true;
      }
      continue;
    }

    const incremento = Math.min(faltantes, minutosRestantes);
    const novoProgresso = progressoAtual + incremento;
    nextProgressSessoes[String(index)] = novoProgresso;
    changed = true;
    lastTouchedIndex = index;
    if (novoProgresso >= tempoSessaoMinutos && !novasConcluidas.includes(index)) {
      novasConcluidas.push(index);
      nextCompletionDetails[String(index)] = {
        concluidaEm: payload.data,
        atualizadoEm: Timestamp.now(),
        origem: 'registro_manual',
      };
    }
    minutosRestantes -= incremento;
  }

  if (minutosRestantes > 0 && lastTouchedIndex !== null) {
    nextProgressSessoes[String(lastTouchedIndex)] =
      Number(nextProgressSessoes[String(lastTouchedIndex)] || progressoSessoes?.[lastTouchedIndex] || progressoSessoes?.[String(lastTouchedIndex)] || 0)
      + minutosRestantes;
    changed = true;
  }

  if (changed) await updateDoc(cicloRef, {
    progressoSessoes: nextProgressSessoes,
    sessoesConcluidas: [...new Set(novasConcluidas)].sort((a, b) => a - b),
    sessoesConcluidasDetalhes: nextCompletionDetails,
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
  isCompletionRegistro,
  isRegistroRevisao,
  activeCycleDisciplines,
}) => {
  if (!isCompletionRegistro && payload.contextoRegistro === 'ciclo' && payload.cicloId) {
    const cicloRef = doc(db, 'users', userUid, 'ciclos', payload.cicloId);
    const disciplinaKey = payload.disciplinaId || null;
    const assuntoAtual = String(payload.assunto || '').trim();
    if (payload.teoriaNaoFinalizadaCiclo && disciplinaKey && assuntoAtual) {
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
    } else if (disciplinaKey && assuntoAtual && (payload.assuntoFinalizadoCiclo || payload.markAsFinished)) {
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
    if (!payload.teoriaNaoFinalizadaCiclo) {
      await syncRegistroEstudoWithCiclo({ db, userUid, payload, disciplinas: activeCycleDisciplines });
    }
  }

  if (!isCompletionRegistro && payload.contextoRegistro === 'cronograma' && payload.cronogramaId) {
    if (isRegistroRevisao) {
      await syncRegistroRevisaoWithCronograma({ db, userUid, cronogramaId: payload.cronogramaId, registro: payload });
    } else if (payload.naoConcluidoCronograma) {
      await marcarPendenciaTeoriaPorRegistro({ db, userUid, cronogramaId: payload.cronogramaId, registro: payload });
    } else {
      await syncRegistroEstudoWithCronograma({ db, userUid, cronogramaId: payload.cronogramaId, registro: payload });
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
