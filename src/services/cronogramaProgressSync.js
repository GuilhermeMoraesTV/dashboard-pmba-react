import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { getAgendaSemana } from './scheduling/review';

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

const getSlotProgressKey = (slot) => slot.slotIdBase || slot.slotId;
const getPendenciaDisciplinaKey = (disciplinaId) => String(disciplinaId || '').trim();

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

  await updateDoc(cronogramaRef, {
    [`pendenciasTeoria.${disciplinaKey}`]: {
      assunto,
      origemSlotIdBase: pendenciaAtual?.origemSlotIdBase || fallbackOrigem,
      criadoEm: pendenciaAtual?.criadoEm || nowIso,
      ultimaMarcacaoEm: nowIso,
    },
  });

  return { synced: true };
}

export async function syncRegistroEstudoWithCronograma({
  db,
  userUid,
  cronogramaId,
  registro,
}) {
  if (!db || !userUid || !cronogramaId || !registro) return { synced: false };

  const minutosRegistrados = Number(registro.tempoEstudadoMinutos || 0);
  const shouldForceComplete = Boolean(registro.markAsFinished || registro.assuntoFinalizado);
  if (minutosRegistrados <= 0 && !shouldForceComplete) return { synced: false, reason: 'no-time' };

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
  const progressoW = cronograma?.progresso?.[semKey] || {};
  const progressoMinutosW = cronograma?.progressoMinutos?.[semKey] || {};
  const dominados = new Set(Object.keys(cronograma?.progresso?.dominios || {}));
  const agendaSemana = getAgendaSemana(cronograma, weekOffset, null, dominados);

  const slotsDia = (agendaSemana || []).filter(
    (slot) => !slot.isRevisaoAuto && slot.dataSlot === dataRegistro
  );
  if (!slotsDia.length) return { synced: false, reason: 'no-slots-for-day' };

  const disciplinaIdRegistro = String(registro.disciplinaId || '').trim();
  const disciplinaNomeRegistroNorm = normalize(registro.disciplinaNome);
  const assuntoRegistroNorm = normalize(registro.assunto);

  const candidatesByDisciplina = slotsDia.filter((slot) => {
    const sameId = disciplinaIdRegistro && String(slot.disciplinaId || '') === disciplinaIdRegistro;
    const sameNome = disciplinaNomeRegistroNorm && normalize(slot.disciplinaNome) === disciplinaNomeRegistroNorm;
    return sameId || sameNome;
  });

  if (!candidatesByDisciplina.length) return { synced: false, reason: 'no-discipline-match' };

  const candidates = assuntoRegistroNorm
    ? candidatesByDisciplina.filter((slot) => normalize(slot.assunto) === assuntoRegistroNorm)
    : candidatesByDisciplina;

  const slotsOrdenados = (candidates.length ? candidates : candidatesByDisciplina)
    .slice()
    .sort((a, b) => {
      const aOrder = Number(a.ordemNoDia ?? 0);
      const bOrder = Number(b.ordemNoDia ?? 0);
      if (aOrder !== bOrder) return aOrder - bOrder;
      const aIdx = Number(a.slotIndexParaDisc ?? 0);
      const bIdx = Number(b.slotIndexParaDisc ?? 0);
      return aIdx - bIdx;
    });

  let minutosRestantes = shouldForceComplete ? Number.POSITIVE_INFINITY : minutosRegistrados;
  let minutosAbatidos = 0;
  const updates = {};
  const pendenciasTeoria = cronograma?.pendenciasTeoria || {};

  for (const slot of slotsOrdenados) {
    if (!shouldForceComplete && minutosRestantes <= 0) break;

    const slotKey = getSlotProgressKey(slot);
    if (!slotKey) continue;

    const minutosPlanejados = Number(slot.tempoMinutos ?? slot.minutosEstudo ?? 0);
    if (minutosPlanejados <= 0) continue;

    const wasDone = progressoW[slotKey] === true;
    const progressoAtual = Number(progressoMinutosW[slotKey] || 0);
    const progressoBase = wasDone ? Math.max(progressoAtual, minutosPlanejados) : progressoAtual;
    const faltantes = Math.max(0, minutosPlanejados - progressoBase);
    if (faltantes <= 0) continue;

    const incremento = shouldForceComplete ? faltantes : Math.min(faltantes, minutosRestantes);
    const novoProgresso = progressoBase + incremento;
    const concluiu = novoProgresso >= minutosPlanejados;

    updates[`progressoMinutos.${semKey}.${slotKey}`] = novoProgresso;
    updates[`progresso.${semKey}.${slotKey}`] = concluiu;
    if (slot.slotId && slot.slotId !== slotKey) {
      updates[`progressoMinutos.${semKey}.${slot.slotId}`] = novoProgresso;
      updates[`progresso.${semKey}.${slot.slotId}`] = concluiu;
    }
    if (concluiu && slot.isPendenciaTeoria) {
      const disciplinaKey = getPendenciaDisciplinaKey(slot.disciplinaId);
      const pendenciaAtiva = pendenciasTeoria?.[disciplinaKey];
      if (disciplinaKey && pendenciaAtiva?.assunto && normalize(pendenciaAtiva.assunto) === normalize(slot.assunto)) {
        updates[`pendenciasTeoria.${disciplinaKey}`] = null;
      }
    }

    if (!shouldForceComplete) minutosRestantes -= incremento;
    minutosAbatidos += incremento;
  }

  if (!Object.keys(updates).length) return { synced: false, reason: 'nothing-to-update' };

  await updateDoc(cronogramaRef, updates);

  return {
    synced: true,
    minutesLogged: minutosRegistrados,
    minutesAppliedToPlan: minutosAbatidos,
    minutesRemainingUnplanned: shouldForceComplete ? 0 : Math.max(0, minutosRestantes),
  };
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
  const disciplinaNomeRegistroNorm = normalize(registro.disciplinaNome);
  const assuntoRegistroNorm = normalize(registro.assunto);

  const candidatesByDisciplina = revisoesDia.filter((slot) => {
    const sameId = disciplinaIdRegistro && String(slot.disciplinaId || '') === disciplinaIdRegistro;
    const sameNome = disciplinaNomeRegistroNorm && normalize(slot.disciplinaNome || slot.disciplina) === disciplinaNomeRegistroNorm;
    return sameId || sameNome;
  });

  if (!candidatesByDisciplina.length) return { synced: false, reason: 'no-review-discipline-match' };

  const candidates = assuntoRegistroNorm
    ? candidatesByDisciplina.filter((slot) => normalize(slot.assunto) === assuntoRegistroNorm)
    : candidatesByDisciplina;

  const slotsOrdenados = (candidates.length ? candidates : candidatesByDisciplina)
    .slice()
    .sort((a, b) => String(a.slotId || '').localeCompare(String(b.slotId || '')));

  const progressoRevisoes = cronograma?.progressoRevisoesMinutos || {};
  const historicoRevisoes = cronograma?.historicoRevisoes || {};
  let minutosRestantes = minutosRegistrados;
  let minutosAbatidos = 0;
  const updates = {};

  for (const slot of slotsOrdenados) {
    if (minutosRestantes <= 0) break;

    const slotKey = slot.slotId;
    if (!slotKey) continue;

    const minutosPlanejados = Number(slot.tempoMinutos ?? slot.minutosEstudo ?? 0);
    if (minutosPlanejados <= 0) continue;

    const wasDone = Boolean(historicoRevisoes?.[slotKey]?.dataConclusao || slot.concluido);
    const progressoAtual = Number(progressoRevisoes?.[slotKey] || slot.progressoMinutos || 0);
    const progressoBase = wasDone ? Math.max(progressoAtual, minutosPlanejados) : progressoAtual;
    const faltantes = Math.max(0, minutosPlanejados - progressoBase);
    if (faltantes <= 0) continue;

    const incremento = Math.min(faltantes, minutosRestantes);
    const novoProgresso = progressoBase + incremento;
    const concluiu = novoProgresso >= minutosPlanejados;

    updates[`progressoRevisoesMinutos.${slotKey}`] = novoProgresso;
    updates[`progresso.${semKey}.${slotKey}`] = concluiu ? true : false;
    if (concluiu) {
      updates[`historicoRevisoes.${slotKey}`] = {
        disciplinaId: slot.disciplinaId || registro.disciplinaId || null,
        disciplinaNome: slot.disciplinaNome || slot.disciplina || registro.disciplinaNome || null,
        assunto: slot.assunto || registro.assunto || null,
        dataConclusao: dataRegistro,
        intervaloDias: slot.intervaloDias ?? 0,
        tempoMinutos: minutosPlanejados,
        weekOffset,
        origem: 'registro_manual',
      };
    }

    minutosRestantes -= incremento;
    minutosAbatidos += incremento;
  }

  if (!Object.keys(updates).length) return { synced: false, reason: 'nothing-to-update' };

  await updateDoc(cronogramaRef, updates);

  return {
    synced: true,
    minutesLogged: minutosRegistrados,
    minutesAppliedToPlan: minutosAbatidos,
    minutesRemainingUnplanned: Math.max(0, minutosRestantes),
  };
}
