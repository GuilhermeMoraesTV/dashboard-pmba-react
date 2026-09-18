import { normalizarDuracaoSessao } from './cicloDistribution.js';
import { getRecordedStudyMinutes, isManualCompletionRecord } from './studyRecords.js';
import { buildScheduleRecordedProgress, getScheduleSlotKey } from '../../functions/gamification/scheduleStudyProgress.mjs';
import {
  isCycleRecordInRound,
  isStudyBackedCycleCompletion,
} from './cycleSessionCompletion.js';

export const MS_PER_WEEK = 7 * 24 * 60 * 60 * 1000;

export const dateToYMDLocal = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const startOfLocalDay = (date) => {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
};

const toMillis = (value) => {
  if (!value) return null;
  if (typeof value.toDate === 'function') return value.toDate().getTime();
  const parsed = new Date(value).getTime();
  return Number.isNaN(parsed) ? null : parsed;
};

const ymdToMillis = (value) => {
  if (!value || typeof value !== 'string') return null;
  const parsed = new Date(`${value}T12:00:00`).getTime();
  return Number.isNaN(parsed) ? null : parsed;
};
export const getRegistroDateKey = (registro) => {
  if (registro?.data) return registro.data;
  if (registro?.dataRegistro) return registro.dataRegistro;
  if (registro?.timestamp?.toDate) return dateToYMDLocal(registro.timestamp.toDate());
  if (registro?.createdAt?.toDate) return dateToYMDLocal(registro.createdAt.toDate());
  return null;
};

const normalizeRecordText = (value) => (
  String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
);

const getRecordMinutes = (registro) => getRecordedStudyMinutes(registro);

const isCycleStudyRegistro = (registro, cicloId) => {
  if (!registro || getRecordMinutes(registro) <= 0) return false;
  if (registro.isRevisao || registro.revisao || registro.tipoEstudo === 'revisao') return false;
  if (String(registro.cicloId || '') !== String(cicloId || '')) return false;
  if (registro.contextoRegistro && registro.contextoRegistro !== 'ciclo') return false;
  return true;
};

export const getCronogramaSlotRecordedMinutes = ({
  cronograma,
  slot,
  registrosEstudo = [],
  dateKey = null,
  onlyRealStudyRecords = false,
  slotsDia = null,
}) => {
  if (!cronograma?.id || !slot) return 0;
  const slotDateKey = dateKey || slot.dataSlot || null;
  const disciplinaId = String(slot.disciplinaId || '').trim();
  const disciplinaNomeNorm = normalizeRecordText(slot.disciplinaNome || slot.disciplina);
  const assuntoNorm = normalizeRecordText(slot.assunto || slot.assuntoOriginal);

  if (Array.isArray(slotsDia) && slotsDia.length) {
    const records = registrosEstudo.filter((record) => record
      && (!onlyRealStudyRecords || !isManualCompletionRecord(record))
      && !record.isRevisao && !record.revisao && record.tipoEstudo !== 'revisao' && record.tipoRegistro !== 'revisao'
      && String(record.cronogramaId || '') === String(cronograma.id)
      && (!record.contextoRegistro || record.contextoRegistro === 'cronograma')
      && (!slotDateKey || getRegistroDateKey(record) === slotDateKey));
    return Number(buildScheduleRecordedProgress({ slots: slotsDia, records,
      getMinutes: getRecordedStudyMinutes }).minutes[getScheduleSlotKey(slot)] || 0);
  }

  return (Array.isArray(registrosEstudo) ? registrosEstudo : []).reduce((acc, registro) => {
    if (!registro || getRecordMinutes(registro) <= 0) return acc;
    if (onlyRealStudyRecords && isManualCompletionRecord(registro)) return acc;
    if (registro.isRevisao || registro.revisao || registro.tipoEstudo === 'revisao') return acc;
    if (String(registro.cronogramaId || '') !== String(cronograma.id || '')) return acc;
    if (registro.contextoRegistro && registro.contextoRegistro !== 'cronograma') return acc;
    if (slotDateKey && getRegistroDateKey(registro) !== slotDateKey) return acc;

    const sameDisciplinaId = disciplinaId && String(registro.disciplinaId || '') === disciplinaId;
    const sameDisciplinaNome = disciplinaNomeNorm && normalizeRecordText(registro.disciplinaNome) === disciplinaNomeNorm;
    if (!sameDisciplinaId && !sameDisciplinaNome) return acc;

    const registroAssuntoNorm = normalizeRecordText(registro.assunto);
    if (assuntoNorm && registroAssuntoNorm && registroAssuntoNorm !== assuntoNorm) {
      return acc;
    }

    return acc + getRecordMinutes(registro);
  }, 0);
};

export const buildStudyDaysMap = (registrosEstudo = [], options = {}) => {
  const days = {};
  const { planId = null, contextMode = null } = typeof options === 'string'
    ? { contextMode: options }
    : (options || {});

  (Array.isArray(registrosEstudo) ? registrosEstudo : []).forEach((item) => {
    if (!item) return;

    if (contextMode === 'ciclo') {
      if (item.cronogramaId) return;
      if (item.contextoRegistro && item.contextoRegistro !== 'ciclo') return;
      if (planId && item.cicloId && String(item.cicloId) !== String(planId)) return;
    } else if (contextMode === 'cronograma') {
      if (item.cicloId) return;
      if (item.contextoRegistro && item.contextoRegistro !== 'cronograma') return;
      if (planId && item.cronogramaId && String(item.cronogramaId) !== String(planId)) return;
    }

    const dateKey = getRegistroDateKey(item);
    if (!dateKey) return;

    if (!days[dateKey]) {
      days[dateKey] = { questions: 0, correct: 0, minutes: 0, confirmedMinutes: 0 };
    }

    days[dateKey].questions += Number(item.questoesFeitas || 0);
    days[dateKey].correct += Number(item.acertos || item.questoesAcertadas || 0);
    days[dateKey].minutes += getRecordMinutes(item);
    if (isConfirmedStudyRecord(item)) {
      days[dateKey].confirmedMinutes += getRecordMinutes(item);
    }
  });

  return days;
};

export const isConfirmedStudyRecord = (registro) => {
  if (!registro) return false;
  return getRecordedStudyMinutes(registro) > 0;
};

const DEFAULT_CYCLE_STUDY_DAYS = [1, 2, 3, 4, 5];

const normalizeStudyDays = (rawStudyDays, fallbackDays = []) => {
  if (Array.isArray(rawStudyDays)) {
    const days = rawStudyDays
      .map(Number)
      .filter((day) => Number.isInteger(day) && day >= 0 && day <= 6);
    return [...new Set(days)].sort((a, b) => a - b);
  }

  if (rawStudyDays && typeof rawStudyDays === 'object') {
    const days = Object.entries(rawStudyDays)
      .filter(([, value]) => value === true || Number(value) > 0)
      .map(([day]) => Number(day))
      .filter((day) => Number.isInteger(day) && day >= 0 && day <= 6);
    return [...new Set(days)].sort((a, b) => a - b);
  }

  return [...fallbackDays];
};

export const getCycleStudyDays = (ciclo) => {
  if (!ciclo) return [];
  return normalizeStudyDays(ciclo.diasEstudo, DEFAULT_CYCLE_STUDY_DAYS);
};

export const getCycleDayTargetMinutesMap = (ciclo) => {
  const studyDays = getCycleStudyDays(ciclo);
  const rawDays = ciclo?.diasEstudo;
  const targetMinutesByDay = {};

  studyDays.forEach((day) => {
    let rawValue = null;
    if (Array.isArray(rawDays)) {
      rawValue = 1;
    } else if (rawDays && typeof rawDays === 'object') {
      rawValue = rawDays[day];
    }

    const numericHours = Number(rawValue);
    const targetMinutes = numericHours > 0
      ? Math.round(numericHours * 60)
      : 60;

    targetMinutesByDay[day] = targetMinutes;
  });

  return targetMinutesByDay;
};

export const getCycleMinimumActiveDayMinutes = (ciclo) => {
  const values = Object.values(getCycleDayTargetMinutesMap(ciclo))
    .map(Number)
    .filter((value) => value > 0);

  return values.length > 0 ? Math.min(...values) : null;
};

const getCycleAnchorDate = (ciclo) => {
  const anchorMillis = toMillis(ciclo?.dataCriacao || ciclo?.createdAt || ciclo?.dataInicio);
  return anchorMillis !== null ? startOfLocalDay(new Date(anchorMillis)) : startOfLocalDay(new Date());
};

const getCycleSessionCompletionDetail = (ciclo, globalIndex) => {
  const details = ciclo?.sessoesConcluidasDetalhes;
  if (!details) return null;

  if (Array.isArray(details)) {
    return details.find((entry) => Number(entry?.globalIndex ?? entry?.index) === Number(globalIndex)) || null;
  }

  if (typeof details === 'object') {
    const item = details[globalIndex] || details[String(globalIndex)];
    return typeof item === 'string' ? { concluidaEm: item } : (item || null);
  }

  return null;
};

const getCycleSessionCompletionDate = (ciclo, globalIndex) => {
  const detail = getCycleSessionCompletionDetail(ciclo, globalIndex);
  return detail?.concluidaEm || detail?.data || null;
};

export const getCycleSessionStudyDetails = ({
  ciclo,
  registrosEstudo = [],
  dateKey = null,
}) => {
  const ordemSessoes = Array.isArray(ciclo?.ordemSessoes) ? ciclo.ordemSessoes : [];
  const tempoSessaoMinutos = Math.max(1, Number(ciclo?.tempoSessaoMinutos) || 50);

  const sessionAllocations = new Map();
  ordemSessoes.forEach((sessao, index) => {
    const disciplina = Array.isArray(ciclo?.disciplinas)
      ? ciclo.disciplinas.find((item) => String(item?.id) === String(sessao?.disciplinaId))
      : null;
    const duracaoConfigurada = Number(disciplina?.duracoesSessoes?.[Number(sessao?.sessaoIndex)] || 0);
    const planned = normalizarDuracaoSessao(
      duracaoConfigurada || sessao?.tempoPlanejadoMinutos || sessao?.tempoMinutos || tempoSessaoMinutos,
      {
        min: ciclo?.duracaoMinimaSessaoMinutos || 10,
        max: ciclo?.duracaoMaximaSessaoMinutos || 240,
        allowPartial: true,
      },
    );
    sessionAllocations.set(index, {
      planned,
      disciplinaId: String(sessao?.disciplinaId || '').trim(),
      minutes: 0,
      subjectsMap: new Map(),
    });
  });

  const validRecords = (Array.isArray(registrosEstudo) ? registrosEstudo : [])
    .filter((r) => isCycleStudyRegistro(r, ciclo?.id)
      && isCycleRecordInRound(r, ciclo)
      && isConfirmedStudyRecord(r)
      && !isManualCompletionRecord(r)
      && !r.isEstudoExtra
      && (!dateKey || getRegistroDateKey(r) === dateKey))
    .slice()
    .sort((a, b) => {
      const time = (rec) => rec.timestamp?.toMillis?.()
        ?? (rec.timestamp?.seconds ? rec.timestamp.seconds * 1000 : Date.parse(rec.timestamp || '') || 0);
      return time(a) - time(b);
    });

  const unindexedRecords = [];
  for (const record of validRecords) {
    const sIndex = Number(record.sessaoGlobalIndex);
    if (Number.isFinite(sIndex) && sessionAllocations.has(sIndex)) {
      const alloc = sessionAllocations.get(sIndex);
      const mins = getRecordMinutes(record);
      alloc.minutes += mins;
      const subjectName = String(record.assunto || '').trim();
      if (subjectName) {
        const key = normalizeRecordText(subjectName);
        const existing = alloc.subjectsMap.get(key);
        if (existing) {
          existing.minutos += mins;
          existing.markAsFinished = existing.markAsFinished || Boolean(record.markAsFinished || record.assuntoFinalizadoCiclo || record.assuntoFinalizado);
        } else {
          alloc.subjectsMap.set(key, {
            assunto: subjectName,
            minutos: mins,
            markAsFinished: Boolean(record.markAsFinished || record.assuntoFinalizadoCiclo || record.assuntoFinalizado),
          });
        }
      }
    } else {
      unindexedRecords.push(record);
    }
  }

  for (const record of unindexedRecords) {
    const discId = String(record.disciplinaId || '').trim();
    const remainingMins = getRecordMinutes(record);
    const subjectName = String(record.assunto || '').trim();

    const matchingSessions = [...sessionAllocations.entries()]
      .filter(([, alloc]) => alloc.disciplinaId === discId);

    if (matchingSessions.length === 0) continue;

    let targetEntry = matchingSessions.find(([, alloc]) => alloc.minutes < alloc.planned);
    if (!targetEntry) {
      targetEntry = matchingSessions[0];
    }

    const [, alloc] = targetEntry;
    alloc.minutes += remainingMins;
    if (subjectName) {
      const key = normalizeRecordText(subjectName);
      const existing = alloc.subjectsMap.get(key);
      if (existing) {
        existing.minutos += remainingMins;
        existing.markAsFinished = existing.markAsFinished || Boolean(record.markAsFinished || record.assuntoFinalizadoCiclo || record.assuntoFinalizado);
      } else {
        alloc.subjectsMap.set(key, {
          assunto: subjectName,
          minutos: remainingMins,
          markAsFinished: Boolean(record.markAsFinished || record.assuntoFinalizadoCiclo || record.assuntoFinalizado),
        });
      }
    }
  }

  const result = {};
  for (const [globalIndex, alloc] of sessionAllocations.entries()) {
    result[globalIndex] = {
      minutes: alloc.minutes,
      assuntosEstudados: Array.from(alloc.subjectsMap.values()),
    };
  }
  return result;
};

export const buildCycleOrderedSessions = (ciclo, dateKey = null, registrosEstudo = []) => {
  const ordemSessoes = Array.isArray(ciclo?.ordemSessoes) ? ciclo.ordemSessoes : [];
  const progressoSessoes = ciclo?.progressoSessoes || {};
  const tempoSessaoMinutos = Math.max(1, Number(ciclo?.tempoSessaoMinutos) || 50);
  const sessionStudyDetails = getCycleSessionStudyDetails({ ciclo, registrosEstudo, dateKey });

  return ordemSessoes
    .map((sessao, globalIndex) => {
      const disciplina = Array.isArray(ciclo?.disciplinas)
        ? ciclo.disciplinas.find((item) => String(item?.id) === String(sessao?.disciplinaId))
        : null;
      const duracaoConfigurada = Number(disciplina?.duracoesSessoes?.[Number(sessao?.sessaoIndex)] || 0);
      const tempoPlanejadoMinutos = normalizarDuracaoSessao(
        duracaoConfigurada || sessao?.tempoPlanejadoMinutos || sessao?.tempoMinutos || tempoSessaoMinutos,
        {
          min: ciclo?.duracaoMinimaSessaoMinutos || 10,
          max: ciclo?.duracaoMaximaSessaoMinutos || 240,
          allowPartial: true,
        },
      );
      const concluidaEm = getCycleSessionCompletionDate(ciclo, globalIndex);
      const completionDetail = getCycleSessionCompletionDetail(ciclo, globalIndex);
      const progressoPersistido = Number(progressoSessoes?.[globalIndex] || progressoSessoes?.[String(globalIndex)] || 0);
      const sessionStudy = sessionStudyDetails[globalIndex] || { minutes: 0, assuntosEstudados: [] };
      const progressoRegistroReal = sessionStudy.minutes;
      const progressoRegistrado = progressoRegistroReal;
      const conclusaoPersistidaPorEstudo = isStudyBackedCycleCompletion(completionDetail);
      const progressoPersistidoReal = conclusaoPersistidaPorEstudo
        || !(ciclo?.sessoesConcluidas || []).map(Number).includes(globalIndex)
        ? progressoPersistido
        : 0;
      const bloqueiaDesmarcarConclusao = progressoRegistroReal >= tempoPlanejadoMinutos;
      const progressoMinutos = Math.max(
        progressoRegistroReal,
        progressoPersistidoReal,
      );
      const concluidaPorRegistroDoDia = dateKey && progressoMinutos >= tempoPlanejadoMinutos;
      const concluida = progressoMinutos >= tempoPlanejadoMinutos;
      const assuntosEstudados = sessionStudy.assuntosEstudados || [];
      return {
        ...sessao,
        globalIndex,
        concluida,
        concluidaEm: concluida ? (concluidaEm || (concluidaPorRegistroDoDia ? dateKey : null)) : null,
        tempoPlanejadoMinutos,
        progressoMinutos,
        progressoRegistradoMinutos: progressoRegistrado,
        progressoRegistroRealMinutos: progressoRegistroReal,
        progressoPersistidoMinutos: progressoPersistido,
        bloqueiaDesmarcarConclusao,
        concluidaManual: false,
        concluidaPorTempoRegistrado: progressoMinutos >= tempoPlanejadoMinutos,
        assuntosEstudados,
        totalAssuntosEstudados: assuntosEstudados.length,
      };
    });
};

const getDisciplinaById = (ciclo, disciplinaId) => {
  const disciplinas = Array.isArray(ciclo?.disciplinas) ? ciclo.disciplinas : [];
  return disciplinas.find((disciplina) => String(disciplina?.id) === String(disciplinaId)) || null;
};

const normalizeAssuntoValue = (assunto, index = 0) => {
  if (typeof assunto === 'string') {
    const nome = assunto.trim();
    return nome ? { id: `${index}`, nome, index } : null;
  }

  if (assunto && typeof assunto === 'object') {
    const nome = String(assunto.nome || assunto.titulo || assunto.label || '').trim();
    if (!nome) return null;
    return {
      ...assunto,
      id: assunto.id || assunto.key || `${index}`,
      nome,
      index,
    };
  }

  return null;
};

const getAssuntosDisciplina = (disciplina) => (
  Array.isArray(disciplina?.assuntos)
    ? disciplina.assuntos.map(normalizeAssuntoValue).filter(Boolean)
    : []
);

const getPendenciaDisciplina = (ciclo, disciplinaId) => {
  const pendencias = ciclo?.pendenciasTeoria;
  if (!pendencias || typeof pendencias !== 'object') return null;
  const pendencia = pendencias[disciplinaId] || pendencias[String(disciplinaId)];
  if (!pendencia || pendencia.status !== 'pendente' || !pendencia.assuntoAtual) return null;
  return pendencia;
};

export const getCycleAssuntoForSession = (ciclo, session, disciplinaArg = null) => {
  const disciplinaId = session?.disciplinaId || disciplinaArg?.id;
  if (!disciplinaId) {
    return {
      assuntoSugerido: null,
      hasPendenciaTeoria: false,
      retomada: null,
    };
  }

  const pendencia = getPendenciaDisciplina(ciclo, disciplinaId);
  if (pendencia) {
    const nome = String(pendencia.assuntoAtual || '').trim();
    return {
      assuntoSugerido: nome ? { nome, origem: 'pendencia' } : null,
      hasPendenciaTeoria: true,
      retomada: {
        assuntoAtual: nome,
        minutosAcumulados: Number(pendencia.minutosAcumulados || 0),
        status: pendencia.status,
        atualizadoEm: pendencia.atualizadoEm || null,
      },
    };
  }

  const disciplina = disciplinaArg || getDisciplinaById(ciclo, disciplinaId);
  const assuntos = getAssuntosDisciplina(disciplina);
  if (assuntos.length === 0) {
    return {
      assuntoSugerido: null,
      hasPendenciaTeoria: false,
      retomada: null,
    };
  }

  const sessionIndex = Number.isFinite(Number(session?.sessaoIndex)) ? Number(session.sessaoIndex) : 0;
  const assunto = assuntos[sessionIndex % assuntos.length];

  return {
    assuntoSugerido: assunto ? { ...assunto, origem: 'normal' } : null,
    hasPendenciaTeoria: false,
    retomada: null,
  };
};

export const getCycleSessionRecordedMinutes = ({
  ciclo,
  session,
  globalIndex,
  registrosEstudo = [],
  dateKey = null,
  disciplina = null,
  allowLooseMatch = true,
  onlyRealStudyRecords = false,
}) => {
  if (!ciclo?.id || !session) return 0;

  const sessionIndex = Number(globalIndex ?? session.globalIndex);
  const disciplinaId = String(session.disciplinaId || disciplina?.id || '').trim();
  const assuntoInfo = getCycleAssuntoForSession(ciclo, { ...session, globalIndex: sessionIndex }, disciplina);
  const assuntoNorm = normalizeRecordText(assuntoInfo?.assuntoSugerido?.nome || session.assunto || session.assuntoOriginal);

  return (Array.isArray(registrosEstudo) ? registrosEstudo : []).reduce((acc, registro) => {
    if (!isCycleStudyRegistro(registro, ciclo.id)) return acc;
    // A identidade explícita da rodada impede que um snapshot atrasado da
    // rodada anterior preencha a nova fila, mesmo antes de `conclusaoId`
    // aparecer no listener de registros.
    if (!isCycleRecordInRound(registro, ciclo)) return acc;
    if (registro.isEstudoExtra) return acc;
    if (onlyRealStudyRecords && (!isConfirmedStudyRecord(registro) || isManualCompletionRecord(registro))) return acc;
    if (dateKey && getRegistroDateKey(registro) !== dateKey) return acc;

    const registroSessaoIndex = Number(registro.sessaoGlobalIndex);
    if (Number.isFinite(registroSessaoIndex)) {
      return registroSessaoIndex === sessionIndex ? acc + getRecordMinutes(registro) : acc;
    }

    if (!allowLooseMatch) return acc;

    if (disciplinaId && String(registro.disciplinaId || '') !== disciplinaId) return acc;

    const firstMatchingSessionIndex = (Array.isArray(ciclo?.ordemSessoes) ? ciclo.ordemSessoes : [])
      .findIndex((candidate) => disciplinaId && String(candidate?.disciplinaId || '') === disciplinaId);
    if (firstMatchingSessionIndex >= 0 && firstMatchingSessionIndex !== sessionIndex) return acc;

    return acc + getRecordMinutes(registro);
  }, 0);
};

const enrichCycleSessionsWithAssuntos = (ciclo, sessions) => (
  sessions.map((session) => ({
    ...session,
    ...getCycleAssuntoForSession(ciclo, session),
  }))
);

export const getCycleFreeQueue = (ciclo, registrosEstudo = []) => {
  if (!ciclo) {
    return { sessions: [], plannedMinutes: 0, remainingMinutes: 0, isRestDay: false };
  }

  const orderedSessions = buildCycleOrderedSessions(ciclo, null, registrosEstudo);
  const disciplines = Array.isArray(ciclo.disciplinas) ? ciclo.disciplinas : [];
  const disciplineMap = new Map(disciplines.map((disciplina) => [String(disciplina.id), disciplina]));
  const sessions = orderedSessions.filter((session) => disciplineMap.has(String(session.disciplinaId))).map((session) => {
    const disciplinaId = String(session.disciplinaId || '');
    const disciplina = disciplineMap.get(disciplinaId);
    return {
      ...session,
      disciplinaNome: session.disciplinaNome || disciplina?.nome || 'Disciplina',
    };
  });
  const enriched = enrichCycleSessionsWithAssuntos(ciclo, sessions);
  const plannedMinutes = enriched.reduce(
    (total, session) => total + Number(session.tempoPlanejadoMinutos || 0),
    0,
  );
  const remainingMinutes = enriched.reduce(
    (total, session) => total + Math.max(0, Number(session.tempoPlanejadoMinutos || 0) - Number(session.progressoMinutos || 0)),
    0,
  );

  return {
    sessions: enriched,
    plannedMinutes,
    targetMinutes: plannedMinutes,
    remainingMinutes,
    isRestDay: false,
    carriedOverCount: 0,
    carriedOverFromDates: [],
  };
};

const getSessionDisciplineKey = (session) => String(session?.disciplinaId ?? '');

const applyCycleSessionPlan = (session, plannedMinutes, options = {}) => {
  const tempoPlanejadoMinutos = Math.max(1, Math.round(Number(plannedMinutes) || 1));
  const progressoMinutos = Number(session?.progressoMinutos || 0);
  const concluidaPeloPlanejado = progressoMinutos >= tempoPlanejadoMinutos;

  return {
    ...session,
    ...options,
    tempoPlanejadoMinutos,
    tempoMinutos: tempoPlanejadoMinutos,
    concluida: Boolean(session?.concluida) || concluidaPeloPlanejado,
  };
};

const takeNextCycleSessionForDay = (pendingSessions, usedDisciplineIds) => {
  if (!pendingSessions.length) return null;

  const preferredIndex = pendingSessions.findIndex((session) => {
    const disciplinaKey = getSessionDisciplineKey(session);
    return !disciplinaKey || !usedDisciplineIds.has(disciplinaKey);
  });
  const index = preferredIndex >= 0 ? preferredIndex : 0;
  const [session] = pendingSessions.splice(index, 1);
  return session;
};

const buildDayCycleAssignment = ({
  pendingSessions,
  dateKey,
  dayCapacity,
  tempoSessaoMinutos,
}) => {
  let usedMinutes = 0;
  const dayAssignments = [];
  const usedDisciplineIds = new Set();

  while (pendingSessions.length > 0 && usedMinutes + tempoSessaoMinutos <= dayCapacity) {
    const session = takeNextCycleSessionForDay(pendingSessions, usedDisciplineIds);
    if (!session) break;
    const disciplinaKey = getSessionDisciplineKey(session);
    if (disciplinaKey) usedDisciplineIds.add(disciplinaKey);
    dayAssignments.push(applyCycleSessionPlan(session, tempoSessaoMinutos, {
      assignedDate: dateKey,
      carriedOver: false,
    }));
    usedMinutes += tempoSessaoMinutos;
  }

  const remainingForPartial = Math.max(0, dayCapacity - usedMinutes);
  if (remainingForPartial > 0 && pendingSessions.length > 0) {
    const session = takeNextCycleSessionForDay(pendingSessions, usedDisciplineIds);
    if (session) {
      const disciplinaKey = getSessionDisciplineKey(session);
      if (disciplinaKey) usedDisciplineIds.add(disciplinaKey);
      dayAssignments.push(applyCycleSessionPlan(session, remainingForPartial, {
        assignedDate: dateKey,
        carriedOver: false,
        sessaoParcial: remainingForPartial < tempoSessaoMinutos,
        tempoSessaoOriginalMinutos: tempoSessaoMinutos,
      }));
      usedMinutes += remainingForPartial;
    }
  }

  return {
    sessions: dayAssignments,
    plannedMinutes: usedMinutes,
    remainingMinutes: Math.max(0, dayCapacity - usedMinutes),
  };
};

const getCyclePlannedMinutes = (session, fallbackMinutes) => (
  Math.max(1, Number(session?.tempoPlanejadoMinutos || session?.tempoMinutos || fallbackMinutes || 1))
);

export const getCycleDailyGuide = (ciclo, date = new Date(), registrosEstudo = []) => {
  const dayDate = startOfLocalDay(date);
  const dayOfWeek = dayDate.getDay();
  const studyDays = getCycleStudyDays(ciclo);
  const targetMinutesByDay = getCycleDayTargetMinutesMap(ciclo);
  const hasConfiguredStudyDays = studyDays.length > 0;
  const targetMinutes = Number(targetMinutesByDay[dayOfWeek] || 0);
  const tempoSessaoMinutos = Math.max(1, Number(ciclo?.tempoSessaoMinutos) || 50);

  if (!hasConfiguredStudyDays || targetMinutes <= 0) {
    return {
      studyDays,
      targetMinutesByDay,
      targetMinutes: 0,
      plannedMinutes: 0,
      remainingMinutes: 0,
      sessions: [],
      isRestDay: true,
      carriedOverCount: 0,
      carriedOverFromDates: [],
    };
  }

  const anchorDate = getCycleAnchorDate(ciclo);
  if (dayDate.getTime() < anchorDate.getTime()) {
    return {
      studyDays,
      targetMinutesByDay,
      targetMinutes,
      plannedMinutes: 0,
      remainingMinutes: targetMinutes,
      sessions: [],
      isRestDay: false,
      carriedOverCount: 0,
      carriedOverFromDates: [],
    };
  }

  const currentDateKey = dateToYMDLocal(dayDate);
  const orderedSessions = buildCycleOrderedSessions(ciclo, currentDateKey, registrosEstudo);
  if (orderedSessions.length === 0) {
    return {
      studyDays,
      targetMinutesByDay,
      targetMinutes,
      plannedMinutes: 0,
      remainingMinutes: targetMinutes,
      sessions: [],
      isRestDay: false,
      carriedOverCount: 0,
      carriedOverFromDates: [],
    };
  }

  const assignments = new Map();
  const pendingSessions = orderedSessions.slice();
  const currentDate = new Date(anchorDate);

  while (currentDate.getTime() <= dayDate.getTime() && pendingSessions.length > 0) {
    const weekday = currentDate.getDay();
    const dayCapacity = Number(targetMinutesByDay[weekday] || 0);

    if (dayCapacity > 0) {
      const dateKey = dateToYMDLocal(currentDate);
      const dayAssignment = buildDayCycleAssignment({
        pendingSessions,
        dateKey,
        dayCapacity,
        tempoSessaoMinutos,
      });

      assignments.set(dateKey, {
        date: dateKey,
        targetMinutes: dayCapacity,
        plannedMinutes: dayAssignment.plannedMinutes,
        remainingMinutes: dayAssignment.remainingMinutes,
        sessions: dayAssignment.sessions,
      });
    }

    currentDate.setDate(currentDate.getDate() + 1);
  }

  const todayAssignment = assignments.get(currentDateKey) || {
    date: currentDateKey,
    targetMinutes,
    plannedMinutes: 0,
    remainingMinutes: targetMinutes,
    sessions: [],
  };

  const carriedOverSessions = [];
  const carriedOverFromDates = [];
  let usedCarriedOverMinutes = 0;
  assignments.forEach((assignment, assignmentDate) => {
    if (assignmentDate >= currentDateKey) return;
    const pendingFromDay = assignment.sessions.filter((session) => (
      !session.concluida || String(session.concluidaEm || '') === currentDateKey
    ));
    if (pendingFromDay.length === 0) return;

    let addedFromDate = false;
    pendingFromDay.forEach((session) => {
      const sessionMinutes = getCyclePlannedMinutes(session, tempoSessaoMinutos);
      if (usedCarriedOverMinutes + sessionMinutes > targetMinutes) return;
      carriedOverSessions.push({
        ...session,
        carriedOver: true,
        originalAssignedDate: assignmentDate,
      });
      usedCarriedOverMinutes += sessionMinutes;
      addedFromDate = true;
    });
    if (addedFromDate) carriedOverFromDates.push(assignmentDate);
  });

  const seenSessionIndexes = new Set(carriedOverSessions.map((session) => session.globalIndex));
  const remainingCapacityMinutes = Math.max(0, targetMinutes - usedCarriedOverMinutes);
  const todayFreshSessions = [];
  let usedFreshMinutes = 0;

  todayAssignment.sessions.forEach((session) => {
    if (seenSessionIndexes.has(session.globalIndex)) return;
    const sessionMinutes = getCyclePlannedMinutes(session, tempoSessaoMinutos);
    if (usedFreshMinutes + sessionMinutes > remainingCapacityMinutes) return;
    todayFreshSessions.push(session);
    usedFreshMinutes += sessionMinutes;
  });

  const sessions = enrichCycleSessionsWithAssuntos(ciclo, [...carriedOverSessions, ...todayFreshSessions]);
  const plannedMinutes = sessions.reduce((total, session) => (
    total + getCyclePlannedMinutes(session, tempoSessaoMinutos)
  ), 0);

  return {
    studyDays,
    targetMinutesByDay,
    targetMinutes,
    plannedMinutes,
    remainingMinutes: Math.max(0, targetMinutes - plannedMinutes),
    sessions,
    isRestDay: false,
    carriedOverCount: carriedOverSessions.length,
    carriedOverFromDates,
  };
};

export const getCronogramaStudyDays = (cronograma, weekOffset = null) => {
  if (!cronograma) return [];

  const explicitDays = normalizeStudyDays(cronograma.diasEstudo, []);
  if (explicitDays.length > 0) return explicitDays;

  let template = cronograma.semanaTemplate;
  if (cronograma.historicoSemanasTemplate && typeof weekOffset === 'number') {
    const vigDesde = Number(cronograma.semanaTemplateVigenteDesde ?? 0);
    if (weekOffset < vigDesde) {
      const match = Object.values(cronograma.historicoSemanasTemplate).find((v) => (
        weekOffset >= Number(v.deSemana) && weekOffset <= Number(v.ateSemana)
      ));
      if (match?.semanaTemplate) {
        template = match.semanaTemplate;
      }
    }
  }

  const rawTemplate = Array.isArray(template)
    ? template
    : template && typeof template === 'object'
      ? Object.values(template)
      : [];

  const templateDays = rawTemplate
    .map((slot) => Number(slot?.dia))
    .filter((day) => Number.isInteger(day) && day >= 0 && day <= 6);

  return [...new Set(templateDays)].sort((a, b) => a - b);
};

export const getCycleSessionsByDay = (ciclo) => {
  const studyDays = getCycleStudyDays(ciclo);
  const sessionsByDay = Object.fromEntries(studyDays.map((day) => [day, []]));
  const targetMinutesByDay = getCycleDayTargetMinutesMap(ciclo);
  const anchorDate = getCycleAnchorDate(ciclo);
  const tempoSessaoMinutos = Math.max(1, Number(ciclo?.tempoSessaoMinutos) || 50);
  const orderedSessions = buildCycleOrderedSessions(ciclo);

  if (!orderedSessions.length || !studyDays.length) {
    return { studyDays, targetMinutesByDay, sessionsByDay };
  }

  const currentDate = new Date(anchorDate);
  const pendingSessions = orderedSessions.slice();

  while (pendingSessions.length > 0) {
    const weekday = currentDate.getDay();
    const targetMinutes = Number(targetMinutesByDay[weekday] || 0);

    if (targetMinutes > 0) {
      const dayAssignment = buildDayCycleAssignment({
        pendingSessions,
        dateKey: dateToYMDLocal(currentDate),
        dayCapacity: targetMinutes,
        tempoSessaoMinutos,
      });
      sessionsByDay[weekday].push(...dayAssignment.sessions);
    }

    currentDate.setDate(currentDate.getDate() + 1);
  }

  return { studyDays, targetMinutesByDay, sessionsByDay };
};

export const getCycleSessionsForDay = (ciclo, date, registrosEstudo = []) => {
  if (!ciclo) return null;

  const guide = getCycleDailyGuide(ciclo, date, registrosEstudo);
  return {
    isRestDay: guide.isRestDay,
    totalSlots: guide.sessions.length,
    completedSlots: guide.sessions.filter((sessao) => sessao.concluida).length,
  };
};

export const getCronogramaDayStatus = (activeCronogramaData, dateToCheck, getAgendaSemana, confirmedMinutes = 0) => {
  if (!activeCronogramaData?.id || !activeCronogramaData?.dataInicio) return null;

  const dateStr = dateToYMDLocal(dateToCheck);
  const dataInicioCronograma = startOfLocalDay(new Date(`${activeCronogramaData.dataInicio}T12:00:00`));
  const dayDate = startOfLocalDay(dateToCheck);
  const dayOfWeek = dayDate.getDay();

  if (dayDate.getTime() < dataInicioCronograma.getTime()) return null;

  const weekOffset = Math.max(0, Math.floor((dayDate.getTime() - dataInicioCronograma.getTime()) / MS_PER_WEEK));
  const studyDays = getCronogramaStudyDays(activeCronogramaData, weekOffset);

  if (!studyDays.length) return null;

  if (!studyDays.includes(dayOfWeek)) {
    return { isRestDay: true, totalSlots: 0, completedSlots: 0 };
  }

  const semKey = `w${weekOffset}`;
  const progressoW = activeCronogramaData?.progresso?.[semKey] || {};
  const agenda = getAgendaSemana(activeCronogramaData, weekOffset) || [];
  const slotsDoDia = agenda.filter((slot) => slot.dataSlot === dateStr);

  if (slotsDoDia.length === 0) {
    return { isRestDay: true, totalSlots: 0, completedSlots: 0 };
  }

  const plannedMinutes = slotsDoDia.reduce((total, slot) => total + Number(slot.tempoMinutos ?? slot.minutosEstudo ?? 0), 0);
  const timeGoalMet = plannedMinutes > 0 && confirmedMinutes >= plannedMinutes;

  const isSlotDone = (slot) => {
    const slotKey = slot.slotIdBase || slot.slotId;
    if (
      progressoW[slotKey] === false ||
      progressoW[slot.slotId] === false ||
      (slot.slotIdBase && progressoW[slot.slotIdBase] === false)
    ) {
      return false;
    }
    const slotPlannedMinutes = Number(slot.tempoMinutos ?? slot.minutosEstudo ?? 0);
    const progressMap = activeCronogramaData?.progressoMinutos?.[semKey] || {};
    const progressMinutes = Math.max(
      Number(progressMap[slotKey] || 0),
      Number(progressMap[slot.slotId] || 0),
      Number(slot.slotIdBase ? progressMap[slot.slotIdBase] || 0 : 0),
      Number(slot.progressoMinutos || 0)
    );
    return Boolean(
      progressoW[slotKey] === true ||
      progressoW[slot.slotId] === true ||
      (slot.slotIdBase && progressoW[slot.slotIdBase] === true) ||
      slot.concluido ||
      (slotPlannedMinutes > 0 && progressMinutes >= slotPlannedMinutes)
    );
  };

  const theorySlots = slotsDoDia.filter((slot) => !slot.isRevisaoAuto && !slot.isRevisao && !slot.isConsolidada);
  const reviewSlots = slotsDoDia.filter((slot) => slot.isRevisaoAuto || slot.isRevisao || slot.isConsolidada);

  const hasUnmarkedTheorySlot = theorySlots.some((slot) => {
    const slotKey = slot.slotIdBase || slot.slotId;
    return progressoW[slotKey] === false || progressoW[slot.slotId] === false || (slot.slotIdBase && progressoW[slot.slotIdBase] === false);
  });
  const completedTheorySlots = hasUnmarkedTheorySlot
    ? theorySlots.filter(isSlotDone).length
    : (timeGoalMet ? theorySlots.length : theorySlots.filter(isSlotDone).length);
  const completedReviewSlots = reviewSlots.filter(isSlotDone).length;
  const completedSlots = completedTheorySlots + completedReviewSlots;

  return {
    isRestDay: false,
    totalSlots: slotsDoDia.length,
    completedSlots,
    plannedMinutes,
  };
};

export const getDailyStudyStatus = ({
  date,
  studyDaysMap,
  activeCronogramaData,
  activeCicloData,
  getAgendaSemana,
  contextMode = 'all',
  cycleReviews = [],
}) => {
  const dateStr = typeof date === 'string' ? date : dateToYMDLocal(date);
  const dayDate = startOfLocalDay(typeof date === 'string' ? new Date(`${date}T12:00:00`) : date);
  const todayDate = startOfLocalDay(new Date());
  const isFutureDay = dayDate.getTime() > todayDate.getTime();
  const dayData = studyDaysMap?.[dateStr];
  const confirmedMinutes = Math.max(0, Number(dayData?.confirmedMinutes ?? dayData?.minutes ?? 0));
  const cronogramaStatus = getCronogramaDayStatus(activeCronogramaData, dayDate, getAgendaSemana, confirmedMinutes);
  const hasRawStudyData = !!dayData && (dayData.minutes > 0 || dayData.questions > 0);
  const hasConfirmedStudyData = confirmedMinutes > 0;
  const cycleTargetMinutes = Number(getCycleDayTargetMinutesMap(activeCicloData)?.[dayDate.getDay()] || 0);
  const cycleReviewRequirements = activeCicloData?.id
    ? (Array.isArray(cycleReviews) ? cycleReviews : []).filter((review) => {
        if (String(review?.cicloId || '') !== String(activeCicloData.id)) return false;
        const dueDate = String(review?.dataAgendada || review?.dataPrevista || review?.dataRevisao || review?.dataSlot || '');
        if (!dueDate || dueDate > dateStr) return false;
        const completed = review?.concluida === true || review?.concluido === true;
        if (!completed) return true;
        const completionDate = review?.concluidaEm?.toDate
          ? dateToYMDLocal(review.concluidaEm.toDate())
          : String(review?.concluidaEm || review?.concluidoEm || review?.dataConclusao || '');
        return dueDate === dateStr || Boolean(completionDate && completionDate >= dateStr);
      })
    : [];
  const completedCycleReviews = cycleReviewRequirements.filter((review) => {
    if (review?.concluida !== true && review?.concluido !== true) return false;
    const completionDate = review?.concluidaEm?.toDate
      ? dateToYMDLocal(review.concluidaEm.toDate())
      : String(review?.concluidaEm || review?.concluidoEm || review?.dataConclusao || '');
    return !completionDate || completionDate <= dateStr;
  }).length;
  const cicloStatus = activeCicloData?.id && cycleTargetMinutes > 0
    ? {
        isRestDay: false,
        totalSlots: 1 + cycleReviewRequirements.length,
        completedSlots: (confirmedMinutes >= cycleTargetMinutes ? 1 : 0) + completedCycleReviews,
        targetMinutes: cycleTargetMinutes,
        confirmedMinutes,
      }
    : null;

  let statuses = [cronogramaStatus, cicloStatus].filter(Boolean);
  if (contextMode === 'cronograma') statuses = [cronogramaStatus].filter(Boolean);
  if (contextMode === 'ciclo') statuses = [cicloStatus].filter(Boolean);
  const hasStudyData = contextMode === 'ciclo' ? hasConfirmedStudyData : hasRawStudyData;

  const isRestDay = statuses.length > 0 && statuses.every((status) => Boolean(status?.isRestDay));
  if (isRestDay) {
    return {
      status: 'rest',
      goalMet: false,
      hasData: hasStudyData,
      isRestDay: true,
      totalSlots: 0,
      completedSlots: 0,
      plannedMinutes: 0,
    };
  }

  const recordDates = Object.keys(studyDaysMap || {})
    .map(ymdToMillis)
    .filter((millis) => millis !== null);
  const anchorDates = [
    ...recordDates,
    ymdToMillis(activeCronogramaData?.dataInicio),
    toMillis(activeCicloData?.dataCriacao || activeCicloData?.createdAt || activeCicloData?.dataInicio),
  ].filter((millis) => millis !== null);
  const earliestRelevantMillis = anchorDates.length > 0 ? Math.min(...anchorDates) : null;

  if (!hasStudyData && earliestRelevantMillis !== null && dayDate.getTime() < startOfLocalDay(new Date(earliestRelevantMillis)).getTime()) {
    return {
      status: 'no-data',
      goalMet: false,
      hasData: false,
      isRestDay: false,
      totalSlots: 0,
      completedSlots: 0,
    };
  }

  if (!hasStudyData && isFutureDay) {
    return {
      status: 'no-data',
      goalMet: false,
      hasData: false,
      isRestDay: false,
      totalSlots: 0,
      completedSlots: 0,
    };
  }

  const plannedMinutes = statuses.reduce((total, status) => total + Number(status.plannedMinutes || status.targetMinutes || 0), 0);
  const timeGoalMet = plannedMinutes > 0 && confirmedMinutes >= plannedMinutes;
  const totalSlots = statuses.reduce((acc, status) => acc + (status.totalSlots || 0), 0);
  const completedSlots = statuses.reduce((acc, status) => acc + (status.completedSlots || 0), 0);

  if (totalSlots > 0) {
    const allDone = completedSlots === totalSlots;
    const started = completedSlots > 0 || hasStudyData;
    const isPastDay = dayDate.getTime() < todayDate.getTime();
    return {
      status: allDone ? 'goal-met-both' : started || !isPastDay ? 'goal-met-one' : 'goal-not-met',
      goalMet: allDone,
      hasData: started,
      isRestDay: false,
      totalSlots,
      completedSlots,
      plannedMinutes,
    };
  }

  return {
    status: hasStudyData ? 'goal-met-both' : 'no-data',
    goalMet: hasStudyData,
    hasData: hasStudyData,
    isRestDay: false,
    totalSlots: 0,
    completedSlots: hasStudyData ? 1 : 0,
  };
};

export { calculateCanonicalStudyStreak } from './gamification.js';
