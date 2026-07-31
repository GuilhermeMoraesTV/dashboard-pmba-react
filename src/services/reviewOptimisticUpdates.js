import { getAgendaSemana, getWeekOffsetFromDate } from './scheduling/review';
import {
  applyReviewProgress,
  getReviewPlannedMinutes,
  normalizeReviewText,
} from './reviewProgressRules';

export const REGISTRO_PROGRESS_OPTIMISTIC_EVENT = 'modoqap:registro-progress-optimistic';

const isReviewRegistro = (registro) =>
  registro?.isRevisao || registro?.revisao || registro?.tipoEstudo === 'revisao' || registro?.tipoRegistro === 'revisao';

const omitKey = (obj = {}, key) => {
  const next = { ...(obj || {}) };
  delete next[key];
  return next;
};

const matchRegistroToSlot = (registro, slot) => {
  const disciplinaIdRegistro = String(registro?.disciplinaId || '').trim();
  const disciplinaNomeRegistro = normalizeReviewText(registro?.disciplinaNome);
  const assuntoRegistro = normalizeReviewText(registro?.assunto);
  const sameDisciplina =
    (disciplinaIdRegistro && String(slot?.disciplinaId || '') === disciplinaIdRegistro)
    || (disciplinaNomeRegistro && normalizeReviewText(slot?.disciplinaNome || slot?.disciplina) === disciplinaNomeRegistro);
  if (!sameDisciplina) return false;
  return !assuntoRegistro || normalizeReviewText(slot?.assunto) === assuntoRegistro;
};

export const applyCronogramaRegistroProgress = (cronograma, registro) => {
  if (!cronograma?.id || !cronograma?.dataInicio || !registro) return cronograma;
  const minutos = Math.max(0, Math.round(Number(registro.tempoEstudadoMinutos || registro.duracaoMinutos || 0)));
  if (minutos <= 0) return cronograma;

  const dataRegistro = String(registro.data || '');
  const weekOffset = getWeekOffsetFromDate(cronograma.dataInicio, dataRegistro || new Date());
  if (!Number.isFinite(Number(weekOffset))) return cronograma;

  const semKey = `w${weekOffset}`;
  const agenda = getAgendaSemana(cronograma, weekOffset) || [];
  const revisao = isReviewRegistro(registro);
  const candidates = agenda
    .filter((slot) => Boolean(slot?.isRevisaoAuto) === revisao)
    .filter((slot) => !dataRegistro || slot.dataSlot === dataRegistro)
    .filter((slot) => matchRegistroToSlot(registro, slot))
    .sort((a, b) => String(a.slotId || '').localeCompare(String(b.slotId || '')));

  const slot = candidates[0];
  if (!slot) return cronograma;

  const slotKey = revisao ? slot.slotId : (slot.slotIdBase || slot.slotId);
  if (!slotKey) return cronograma;

  const planned = revisao
    ? getReviewPlannedMinutes(slot, 20)
    : Math.max(1, Math.round(Number(slot.tempoMinutos ?? slot.minutosEstudo ?? 0) || 0));
  const progresso = cronograma.progresso || {};
  const progressoSemana = progresso?.[semKey] || {};

  if (revisao) {
    const progressoRevisoesMinutos = cronograma.progressoRevisoesMinutos || {};
    const historicoRevisoes = cronograma.historicoRevisoes || {};
    const revisoesDesmarcadas = cronograma.revisoesDesmarcadas || {};
    const wasDone = revisoesDesmarcadas?.[slotKey] === true
      ? false
      : Boolean(historicoRevisoes?.[slotKey]?.dataConclusao || slot.concluido);
    const progress = applyReviewProgress({
      currentMinutes: Number(progressoRevisoesMinutos?.[slotKey] || slot.progressoMinutos || 0),
      plannedMinutes: planned,
      addedMinutes: minutos,
      wasDone,
    });

    return {
      ...cronograma,
      progresso: {
        ...progresso,
        [semKey]: { ...progressoSemana, [slotKey]: progress.done },
      },
      progressoRevisoesMinutos: {
        ...progressoRevisoesMinutos,
        [slotKey]: progress.nextProgress,
      },
      revisoesDesmarcadas: omitKey(revisoesDesmarcadas, slotKey),
      historicoRevisoes: progress.done
        ? {
            ...historicoRevisoes,
            [slotKey]: {
              disciplinaId: slot.disciplinaId || registro.disciplinaId || null,
              disciplinaNome: slot.disciplinaNome || slot.disciplina || registro.disciplinaNome || null,
              assunto: slot.assunto || registro.assunto || null,
              dataConclusao: dataRegistro,
              intervaloDias: slot.intervaloDias ?? 0,
              tempoMinutos: planned,
              weekOffset,
              origem: 'registro_manual',
            },
          }
        : historicoRevisoes,
    };
  }

  const progressoMinutos = cronograma.progressoMinutos || {};
  const progressoMinutosSemana = progressoMinutos?.[semKey] || {};
  const atual = Math.max(
    Number(progressoMinutosSemana?.[slotKey] || 0),
    Number(slot.progressoMinutos || 0),
  );
  const nextProgress = atual + minutos;
  const done = Boolean(registro.markAsFinished || registro.assuntoFinalizado) || nextProgress >= planned;

  return {
    ...cronograma,
    progresso: {
      ...progresso,
      [semKey]: { ...progressoSemana, [slotKey]: done },
    },
    progressoMinutos: {
      ...progressoMinutos,
      [semKey]: { ...progressoMinutosSemana, [slotKey]: nextProgress },
    },
  };
};

export const applyCicloRevisaoRegistroProgress = (revisoes = [], registro) => {
  if (!Array.isArray(revisoes) || !isReviewRegistro(registro)) return revisoes;
  const minutos = Math.max(0, Math.round(Number(registro?.tempoEstudadoMinutos || registro?.duracaoMinutos || 0)));
  if (minutos <= 0) return revisoes;

  let applied = false;
  const dataRegistro = String(registro?.data || '');
  const disciplinaIdRegistro = String(registro?.disciplinaId || '').trim();
  const assuntoRegistro = normalizeReviewText(registro?.assunto);

  return revisoes.map((rev) => {
    if (applied || rev.concluida) return rev;
    if (registro?.cicloId && String(rev.cicloId || '') !== String(registro.cicloId)) return rev;
    if (disciplinaIdRegistro && String(rev.disciplinaId || '') !== disciplinaIdRegistro) return rev;
    if (assuntoRegistro && normalizeReviewText(rev.assunto) !== assuntoRegistro) return rev;
    if (dataRegistro && rev.dataAgendada && String(rev.dataAgendada) > dataRegistro) return rev;

    const planned = getReviewPlannedMinutes(rev, 20);
    const progress = applyReviewProgress({
      currentMinutes: Number(rev.progressoMinutos || 0),
      plannedMinutes: planned,
      addedMinutes: minutos,
      wasDone: rev.concluida,
    });
    applied = true;
    return {
      ...rev,
      progressoMinutos: progress.nextProgress,
      tempoMinutos: planned,
      concluida: progress.done,
      bloqueiaDesmarcar: progress.done ? true : rev.bloqueiaDesmarcar,
      origemConclusao: progress.done ? 'registro_manual' : rev.origemConclusao,
    };
  });
};

export const emitRegistroProgressOptimisticUpdate = (registro) => {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(REGISTRO_PROGRESS_OPTIMISTIC_EVENT, { detail: registro }));
};
