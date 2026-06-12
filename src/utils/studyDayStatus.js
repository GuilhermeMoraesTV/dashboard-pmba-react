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

export const buildStudyDaysMap = (registrosEstudo = []) => {
  const days = {};

  registrosEstudo.forEach((item) => {
    if (!item?.data) return;

    if (!days[item.data]) {
      days[item.data] = { questions: 0, correct: 0, minutes: 0 };
    }

    days[item.data].questions += Number(item.questoesFeitas || 0);
    days[item.data].correct += Number(item.acertos || 0);
    days[item.data].minutes += Number(item.tempoEstudadoMinutos || 0);
  });

  return days;
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

const getCycleSessionCompletionDate = (ciclo, globalIndex) => {
  const details = ciclo?.sessoesConcluidasDetalhes;
  if (!details) return null;

  if (Array.isArray(details)) {
    const item = details.find((entry) => Number(entry?.globalIndex ?? entry?.index) === Number(globalIndex));
    return item?.concluidaEm || item?.data || null;
  }

  if (typeof details === 'object') {
    const item = details[globalIndex] || details[String(globalIndex)];
    if (typeof item === 'string') return item;
    return item?.concluidaEm || item?.data || null;
  }

  return null;
};

const isCycleSessionCompletedByDate = (ciclo, globalIndex, dateKey = null) => {
  const sessoesConcluidas = new Set((ciclo?.sessoesConcluidas || []).map(Number));
  if (!sessoesConcluidas.has(Number(globalIndex))) return false;

  const completionDate = getCycleSessionCompletionDate(ciclo, globalIndex);
  if (!completionDate || !dateKey) return true;

  return String(completionDate) <= String(dateKey);
};

const buildCycleOrderedSessions = (ciclo, dateKey = null) => {
  const ordemSessoes = Array.isArray(ciclo?.ordemSessoes) ? ciclo.ordemSessoes : [];
  const progressoSessoes = ciclo?.progressoSessoes || {};
  const tempoSessaoMinutos = Math.max(1, Number(ciclo?.tempoSessaoMinutos) || 50);

  return ordemSessoes
    .map((sessao, globalIndex) => {
      const concluidaEm = getCycleSessionCompletionDate(ciclo, globalIndex);
      const concluida = isCycleSessionCompletedByDate(ciclo, globalIndex, dateKey);
      const progressoMinutos = Number(progressoSessoes?.[globalIndex] || progressoSessoes?.[String(globalIndex)] || 0);
      return {
        ...sessao,
        globalIndex,
        concluida,
        concluidaEm,
        progressoMinutos: concluida ? Math.max(progressoMinutos, tempoSessaoMinutos) : progressoMinutos,
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

const enrichCycleSessionsWithAssuntos = (ciclo, sessions) => (
  sessions.map((session) => ({
    ...session,
    ...getCycleAssuntoForSession(ciclo, session),
  }))
);

export const getCycleDailyGuide = (ciclo, date = new Date()) => {
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
  const orderedSessions = buildCycleOrderedSessions(ciclo, currentDateKey);
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
  let cursor = 0;
  const currentDate = new Date(anchorDate);

  while (currentDate.getTime() <= dayDate.getTime() && cursor < orderedSessions.length) {
    const weekday = currentDate.getDay();
    const dayCapacity = Number(targetMinutesByDay[weekday] || 0);

    if (dayCapacity > 0) {
      let usedMinutes = 0;
      const dateKey = dateToYMDLocal(currentDate);
      const dayAssignments = [];

      while (cursor < orderedSessions.length && usedMinutes + tempoSessaoMinutos <= dayCapacity) {
        dayAssignments.push({
          ...orderedSessions[cursor],
          assignedDate: dateKey,
          carriedOver: false,
        });
        usedMinutes += tempoSessaoMinutos;
        cursor += 1;
      }

      assignments.set(dateKey, {
        date: dateKey,
        targetMinutes: dayCapacity,
        plannedMinutes: usedMinutes,
        remainingMinutes: Math.max(0, dayCapacity - usedMinutes),
        sessions: dayAssignments,
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
      if (usedCarriedOverMinutes + tempoSessaoMinutos > targetMinutes) return;
      carriedOverSessions.push({
        ...session,
        carriedOver: true,
        originalAssignedDate: assignmentDate,
      });
      usedCarriedOverMinutes += tempoSessaoMinutos;
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
    if (usedFreshMinutes + tempoSessaoMinutos > remainingCapacityMinutes) return;
    todayFreshSessions.push(session);
    usedFreshMinutes += tempoSessaoMinutos;
  });

  const sessions = enrichCycleSessionsWithAssuntos(ciclo, [...carriedOverSessions, ...todayFreshSessions]);
  const plannedMinutes = sessions.length * tempoSessaoMinutos;

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

export const getCronogramaStudyDays = (cronograma) => {
  if (!cronograma) return [];

  const explicitDays = normalizeStudyDays(cronograma.diasEstudo, []);
  if (explicitDays.length > 0) return explicitDays;

  const rawTemplate = Array.isArray(cronograma.semanaTemplate)
    ? cronograma.semanaTemplate
    : cronograma.semanaTemplate && typeof cronograma.semanaTemplate === 'object'
      ? Object.values(cronograma.semanaTemplate)
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
  let cursor = 0;

  while (cursor < orderedSessions.length) {
    const weekday = currentDate.getDay();
    const targetMinutes = Number(targetMinutesByDay[weekday] || 0);

    if (targetMinutes > 0) {
      let usedMinutes = 0;
      while (cursor < orderedSessions.length && usedMinutes + tempoSessaoMinutos <= targetMinutes) {
        sessionsByDay[weekday].push(orderedSessions[cursor]);
        usedMinutes += tempoSessaoMinutos;
        cursor += 1;
      }
    }

    currentDate.setDate(currentDate.getDate() + 1);
  }

  return { studyDays, targetMinutesByDay, sessionsByDay };
};

export const getCycleSessionsForDay = (ciclo, date) => {
  if (!ciclo) return null;

  const guide = getCycleDailyGuide(ciclo, date);
  return {
    isRestDay: guide.isRestDay,
    totalSlots: guide.sessions.length,
    completedSlots: guide.sessions.filter((sessao) => sessao.concluida).length,
  };
};

export const getCronogramaDayStatus = (activeCronogramaData, dateToCheck, getAgendaSemana) => {
  const studyDays = getCronogramaStudyDays(activeCronogramaData);
  const hasCronogramaSchedule = !!activeCronogramaData?.id
    && !!activeCronogramaData?.dataInicio
    && studyDays.length > 0;

  if (!hasCronogramaSchedule) return null;

  const dateStr = dateToYMDLocal(dateToCheck);
  const dataInicioCronograma = startOfLocalDay(new Date(`${activeCronogramaData.dataInicio}T12:00:00`));
  const dayDate = startOfLocalDay(dateToCheck);
  const dayOfWeek = dayDate.getDay();

  if (!studyDays.includes(dayOfWeek)) {
    return { isRestDay: true, totalSlots: 0, completedSlots: 0 };
  }

  if (dayDate.getTime() < dataInicioCronograma.getTime()) return null;

  const weekOffset = Math.max(0, Math.floor((dayDate.getTime() - dataInicioCronograma.getTime()) / MS_PER_WEEK));
  const semKey = `w${weekOffset}`;
  const progressoW = activeCronogramaData?.progresso?.[semKey] || {};
  const agenda = getAgendaSemana(activeCronogramaData, weekOffset) || [];
  const slotsDoDia = agenda.filter((slot) => slot.dataSlot === dateStr && !slot.isRevisaoAuto);

  if (slotsDoDia.length === 0) {
    return { isRestDay: true, totalSlots: 0, completedSlots: 0 };
  }

  const completedSlots = slotsDoDia.filter((slot) => {
    const slotKey = slot.slotIdBase || slot.slotId;
    return Boolean(
      slot.concluido ||
      progressoW[slotKey] === true ||
      progressoW[slot.slotId] === true ||
      (slot.slotIdBase && progressoW[slot.slotIdBase] === true)
    );
  }).length;

  return {
    isRestDay: false,
    totalSlots: slotsDoDia.length,
    completedSlots,
  };
};

export const getDailyStudyStatus = ({
  date,
  studyDaysMap,
  activeCronogramaData,
  activeCicloData,
  getAgendaSemana,
  contextMode = 'all',
}) => {
  const dateStr = typeof date === 'string' ? date : dateToYMDLocal(date);
  const dayDate = startOfLocalDay(typeof date === 'string' ? new Date(`${date}T12:00:00`) : date);
  const todayDate = startOfLocalDay(new Date());
  const isFutureDay = dayDate.getTime() > todayDate.getTime();
  const cronogramaStatus = getCronogramaDayStatus(activeCronogramaData, dayDate, getAgendaSemana);
  const cicloStatus = getCycleSessionsForDay(activeCicloData, dayDate);
  const dayData = studyDaysMap?.[dateStr];
  const hasStudyData = !!dayData && (dayData.minutes > 0 || dayData.questions > 0);

  let statuses = [cronogramaStatus, cicloStatus].filter(Boolean);
  if (contextMode === 'cronograma') statuses = [cronogramaStatus].filter(Boolean);
  if (contextMode === 'ciclo') statuses = [cicloStatus].filter(Boolean);

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

  const hasScheduledSurface = statuses.some((status) => status.totalSlots > 0 || status.isRestDay);
  const totalSlots = statuses.reduce((acc, status) => acc + (status.totalSlots || 0), 0);
  const completedSlots = statuses.reduce((acc, status) => acc + (status.completedSlots || 0), 0);

  if (hasScheduledSurface && totalSlots === 0) {
    return {
      status: 'goal-met-both',
      goalMet: true,
      hasData: hasStudyData,
      isRestDay: true,
      totalSlots: 0,
      completedSlots: 0,
    };
  }

  if (totalSlots > 0) {
    const allDone = completedSlots === totalSlots;
    const started = completedSlots > 0 || hasStudyData;
    return {
      status: allDone ? 'goal-met-both' : started ? 'goal-met-one' : 'goal-not-met',
      goalMet: allDone,
      hasData: started,
      isRestDay: false,
      totalSlots,
      completedSlots,
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

export const calculateCurrentStudyStreak = ({
  studyDaysMap = {},
  goalsHistory = [],
  activeCronogramaData,
  activeCicloData,
  getAgendaSemana,
  contextMode = 'all',
  today = new Date(),
  lookbackDays = 90,
}) => {
  let currentStreak = 0;
  const todayStr = dateToYMDLocal(today);
  const oldestGoal = (goalsHistory || [])
    .filter((goal) => goal?.startDate)
    .sort((a, b) => new Date(a.startDate) - new Date(b.startDate))[0];
  const firstGoalDateStr = oldestGoal?.startDate || null;

  for (let i = 0; i < lookbackDays; i += 1) {
    const dateToCheck = new Date(today);
    dateToCheck.setDate(today.getDate() - i);
    const dateStr = dateToYMDLocal(dateToCheck);
    const dayStatus = getDailyStudyStatus({
      date: dateToCheck,
      studyDaysMap,
      activeCronogramaData,
      activeCicloData,
      getAgendaSemana,
      contextMode,
    });

    if (firstGoalDateStr && dateStr < firstGoalDateStr && !dayStatus.goalMet) break;
    if (dayStatus.goalMet) currentStreak += 1;
    else if (dateStr === todayStr) continue;
    else break;
  }

  return currentStreak;
};
