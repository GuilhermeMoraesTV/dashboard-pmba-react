import { FieldPath, doc, getDoc, runTransaction, updateDoc } from 'firebase/firestore';
import { getAgendaSemana } from './scheduling/review.js';
import {
  applyReviewProgress,
  getReviewPlannedMinutes,
  normalizeReviewText,
} from './reviewProgressRules.js';
import {
  advanceTheoryPendingAfterCompletion,
  buildTheoryContinuationPending,
  captureDisplacedTheoryTopic,
} from '../utils/cronogramaTheoryQueue.js';
import { allocateScheduleStudyRecord, getScheduleSlotKey } from '../../functions/gamification/scheduleStudyProgress.mjs';

const normalize = (value) =>
  String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

const toYMD = (value) => {
  if (!value) {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) return null;
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, '0');
  const d = String(dt.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

const calculateWeekOffset = (dataInicio, dataRegistroYmd) => {
  if (!dataInicio || !dataRegistroYmd) return null;
  const start = new Date(`${dataInicio}T12:00:00`);
  const target = new Date(`${dataRegistroYmd}T12:00:00`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(target.getTime())) return null;
  const diff = Math.floor((target - start) / (7 * 24 * 60 * 60 * 1000));
  if (diff < 0) return null;
  return diff;
};

const getPendenciaDisciplinaKey = (disciplinaId) => String(disciplinaId || '').trim();

const updateDocFieldEntries = async (docRef, entries = []) => {
  const args = entries.flatMap(([segments, value]) => [
    new FieldPath(...segments.map((segment) => String(segment))),
    value,
  ]);
  if (!args.length) return;
  await updateDoc(docRef, ...args);
};

export async function marcarPendenciaTeoriaPorRegistro({
  db,
  userUid,
  cronogramaId,
  registro,
}) {
  if (!db || !userUid || !cronogramaId || !registro) return { synced: false };

  const disciplinaKey = getPendenciaDisciplinaKey(registro.disciplinaId);
  const assunto = String(registro.assunto || '').trim();
  if (!disciplinaKey || !assunto) return { synced: false, reason: 'missing-pendencia-data' };

  const cronogramaRef = doc(db, 'users', userUid, 'cronogramas', cronogramaId);
  const cronogramaSnap = await getDoc(cronogramaRef);
  if (!cronogramaSnap.exists()) return { synced: false, reason: 'missing-cronograma' };

  const cronograma = cronogramaSnap.data() || {};
  const pendenciaAtual = cronograma?.pendenciasTeoria?.[disciplinaKey] || null;
  const nowIso = new Date().toISOString();
  const fallbackOrigem = `registro-manual:${disciplinaKey}:${normalize(assunto) || 'assunto'}`;
  const slotContext = registro.cronogramaSlotIdBase || registro.cronogramaSlotData
    ? {
      slotIdBase: registro.cronogramaSlotIdBase || null,
      slotId: registro.cronogramaSlotId || null,
      dataSlot: registro.cronogramaSlotData || toYMD(registro.data),
      ordemNoDia: registro.cronogramaSlotOrdem,
      hora: registro.cronogramaSlotHora,
      assunto: registro.assunto,
      assuntoOriginal: registro.cronogramaAssuntoOriginal || registro.assunto,
    }
    : null;
  const pendenciaPayload = buildTheoryContinuationPending({
    assunto,
    currentPending: pendenciaAtual,
    slot: slotContext,
    dataSlot: toYMD(registro.data),
    nowIso,
    fallbackOrigin: fallbackOrigem,
  });

  await updateDoc(cronogramaRef, {
    [`pendenciasTeoria.${disciplinaKey}`]: pendenciaPayload,
  });

  return { synced: true };
}

export async function syncRegistroEstudoWithCronograma({
  db,
  userUid,
  cronogramaId,
  registro,
  registroRef,
}) {
  if (!db || !userUid || !cronogramaId || !registro) return { synced: false };

  const minutosRegistrados = Number(registro.tempoEstudadoMinutos || 0);
  const shouldForceComplete = Boolean(registro.markAsFinished || registro.assuntoFinalizado);
  if (minutosRegistrados <= 0 && !shouldForceComplete) return { synced: false, reason: 'no-time' };

  const dataRegistro = toYMD(registro.data);
  if (!dataRegistro) return { synced: false, reason: 'invalid-date' };
  if (!registroRef) throw new Error('registro-ref-obrigatoria-para-sincronizacao');

  const cronogramaRef = doc(db, 'users', userUid, 'cronogramas', cronogramaId);
  return runTransaction(db, async (transaction) => {
    const registroSnap = await transaction.get(registroRef);
    if (!registroSnap.exists()) return { synced: false, reason: 'missing-registro' };
    if (registroSnap.data()?.cronogramaProgressApplied === true) return { synced: true, duplicate: true };
    const savedRegistro = registroSnap.data();
    if (savedRegistro.cronogramaId !== cronogramaId || toYMD(savedRegistro.data) !== dataRegistro) {
      return { synced: false, reason: 'registro-context-changed' };
    }
    const cronogramaSnap = await transaction.get(cronogramaRef);
    if (!cronogramaSnap.exists()) return { synced: false, reason: 'missing-cronograma' };

    const cronograma = { id: cronogramaSnap.id, ...cronogramaSnap.data() };
    if (!cronograma.ativo || !cronograma.dataInicio || !Array.isArray(cronograma.semanaTemplate)) {
      return { synced: false, reason: 'invalid-cronograma' };
    }

    const weekOffset = calculateWeekOffset(cronograma.dataInicio, dataRegistro);
    if (weekOffset === null) return { synced: false, reason: 'invalid-week-offset' };

    const semKey = `w${weekOffset}`;
    const progressoW = cronograma?.progresso?.[semKey] || {};
    const progressoMinutosW = cronograma?.progressoMinutos?.[semKey] || {};
    const dominados = new Set(Object.keys(cronograma?.progresso?.dominios || {}));
    const agendaSemana = getAgendaSemana(cronograma, weekOffset, null, dominados);

    const slotsDia = (agendaSemana || []).filter(
      (slot) => !slot.isRevisaoAuto && slot.dataSlot === dataRegistro
    );
    if (!slotsDia.length) return { synced: false, reason: 'no-slots-for-day' };

    const currentMinutes = {};
    const completed = {};
    slotsDia.forEach((slot) => {
      const key = getScheduleSlotKey(slot);
      currentMinutes[key] = Math.max(Number(progressoMinutosW[key] || 0), Number(progressoMinutosW[slot.slotId] || 0));
      completed[key] = progressoW[key] === true || progressoW[slot.slotId] === true;
  });
  const result = allocateScheduleStudyRecord({ slots: slotsDia, record: savedRegistro, currentMinutes, completed });
  const updates = {};
  const pendenciasTeoria = cronograma?.pendenciasTeoria || {};
  const touched = Object.keys(result.allocations);
  if (!touched.length) return { synced: false, reason: 'no-discipline-match' };
  for (const slot of slotsDia.filter((item) => touched.includes(getScheduleSlotKey(item)))) {
    const slotKey = getScheduleSlotKey(slot);
    const concluiu = result.completed[slotKey];
    for (const key of [...new Set([slotKey, slot.slotId].filter(Boolean))]) {
      if (Number(progressoMinutosW[key] || 0) !== result.minutes[slotKey]) updates[`progressoMinutos.${semKey}.${key}`] = result.minutes[slotKey];
      if (Boolean(progressoW[key]) !== concluiu) updates[`progresso.${semKey}.${key}`] = concluiu;
    }
    if (slot.isFilaTeoriaOverride) {
      const disciplinaKey = getPendenciaDisciplinaKey(slot.disciplinaId);
      const pendenciaAtiva = pendenciasTeoria?.[disciplinaKey];
      if (disciplinaKey && pendenciaAtiva?.assunto && normalize(pendenciaAtiva.assunto) === normalize(registro.assunto)) {
        const nextPending = concluiu && !registro.naoConcluidoCronograma
          ? advanceTheoryPendingAfterCompletion({ pending: pendenciaAtiva, slot })
          : captureDisplacedTheoryTopic(pendenciaAtiva, slot);
        if (JSON.stringify(nextPending) !== JSON.stringify(pendenciaAtiva)) updates[`pendenciasTeoria.${disciplinaKey}`] = nextPending;
      }
    }
  }
  if (Object.keys(updates).length) transaction.update(cronogramaRef, updates);
  transaction.update(registroRef, { cronogramaProgressApplied: true, cronogramaProgressAllocations: result.allocations });
  const minutosAbatidos = Object.values(result.allocations).reduce((total, minutes) => total + minutes, 0);

  return {
    synced: true,
    minutesLogged: minutosRegistrados,
    minutesAppliedToPlan: minutosAbatidos,
    minutesRemainingUnplanned: Math.max(0, minutosRegistrados - minutosAbatidos),
  };
  });
}

export async function syncRegistroRevisaoWithCronograma({
  db,
  userUid,
  cronogramaId,
  registro,
}) {
  if (!db || !userUid || !cronogramaId || !registro) return { synced: false };

  const minutosRegistrados = Number(registro.tempoEstudadoMinutos || 0);
  if (minutosRegistrados <= 0) return { synced: false, reason: 'no-time' };

  const dataRegistro = toYMD(registro.data);
  if (!dataRegistro) return { synced: false, reason: 'invalid-date' };

  const cronogramaRef = doc(db, 'users', userUid, 'cronogramas', cronogramaId);
  const cronogramaSnap = await getDoc(cronogramaRef);
  if (!cronogramaSnap.exists()) return { synced: false, reason: 'missing-cronograma' };

  const cronograma = { id: cronogramaSnap.id, ...cronogramaSnap.data() };
  if (!cronograma.ativo || !cronograma.dataInicio || !Array.isArray(cronograma.semanaTemplate)) {
    return { synced: false, reason: 'invalid-cronograma' };
  }

  const weekOffset = calculateWeekOffset(cronograma.dataInicio, dataRegistro);
  if (weekOffset === null) return { synced: false, reason: 'invalid-week-offset' };

  const semKey = `w${weekOffset}`;
  const agendaSemana = getAgendaSemana(cronograma, weekOffset);
  const revisoesDia = (agendaSemana || []).filter(
    (slot) => slot.isRevisaoAuto && slot.dataSlot === dataRegistro
  );
  if (!revisoesDia.length) return { synced: false, reason: 'no-review-slots-for-day' };

  const disciplinaIdRegistro = String(registro.disciplinaId || '').trim();
  const disciplinaNomeRegistroNorm = normalizeReviewText(registro.disciplinaNome);
  const assuntoRegistroNorm = normalizeReviewText(registro.assunto);

  const candidatesByDisciplina = revisoesDia.filter((slot) => {
    const sameId = disciplinaIdRegistro && String(slot.disciplinaId || '') === disciplinaIdRegistro;
    const sameNome = disciplinaNomeRegistroNorm && normalizeReviewText(slot.disciplinaNome || slot.disciplina) === disciplinaNomeRegistroNorm;
    return sameId || sameNome;
  });

  if (!candidatesByDisciplina.length) return { synced: false, reason: 'no-review-discipline-match' };

  const candidates = assuntoRegistroNorm
    ? candidatesByDisciplina.filter((slot) => normalizeReviewText(slot.assunto) === assuntoRegistroNorm)
    : candidatesByDisciplina;

  const slotsOrdenados = (candidates.length ? candidates : candidatesByDisciplina)
    .slice()
    .sort((a, b) => String(a.slotId || '').localeCompare(String(b.slotId || '')));

  const progressoRevisoes = cronograma?.progressoRevisoesMinutos || {};
  const historicoRevisoes = cronograma?.historicoRevisoes || {};
  const revisoesDesmarcadas = cronograma?.revisoesDesmarcadas || {};
  let minutosRestantes = minutosRegistrados;
  let minutosAbatidos = 0;
  const fieldEntries = [];

  for (const slot of slotsOrdenados) {
    if (minutosRestantes <= 0) break;

    const slotKey = slot.slotId;
    if (!slotKey) continue;

    const minutosPlanejados = getReviewPlannedMinutes(slot, 20);
    if (minutosPlanejados <= 0) continue;

    const wasDone = revisoesDesmarcadas?.[slotKey] === true
      ? false
      : Boolean(historicoRevisoes?.[slotKey]?.dataConclusao || slot.concluido);
    const progressoAtual = Number(progressoRevisoes?.[slotKey] || slot.progressoMinutos || 0);
    const {
      appliedMinutes,
      nextProgress: novoProgresso,
      done: concluiu,
    } = applyReviewProgress({
      currentMinutes: progressoAtual,
      plannedMinutes: minutosPlanejados,
      addedMinutes: minutosRestantes,
      wasDone,
    });
    if (appliedMinutes <= 0) continue;

    fieldEntries.push([['progressoRevisoesMinutos', slotKey], novoProgresso]);
    fieldEntries.push([['progresso', semKey, slotKey], concluiu ? true : false]);
    fieldEntries.push([['revisoesDesmarcadas', slotKey], null]);
    if (concluiu) {
      fieldEntries.push([['historicoRevisoes', slotKey], {
        disciplinaId: slot.disciplinaId || registro.disciplinaId || null,
        disciplinaNome: slot.disciplinaNome || slot.disciplina || registro.disciplinaNome || null,
        assunto: slot.assunto || registro.assunto || null,
        dataConclusao: dataRegistro,
        intervaloDias: slot.intervaloDias ?? 0,
        tempoMinutos: minutosPlanejados,
        weekOffset,
        origem: 'registro_manual',
      }]);
    }

    minutosRestantes -= appliedMinutes;
    minutosAbatidos += appliedMinutes;
  }

  if (!fieldEntries.length) return { synced: false, reason: 'nothing-to-update' };

  await updateDocFieldEntries(cronogramaRef, fieldEntries);

  return {
    synced: true,
    minutesLogged: minutosRegistrados,
    minutesAppliedToPlan: minutosAbatidos,
    minutesRemainingUnplanned: Math.max(0, minutosRestantes),
  };
}
