// Regra pura compartilhada: concluir conteúdo não cria minutos de estudo.
export const normalizeScheduleText = (value) => String(value || '')
  .normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();

export const getScheduleSlotKey = (slot) => String(slot?.slotIdBase || slot?.slotId || '');

export const isScheduleProgressOnlyUpdate = (before, after) => {
  if (!before || !after) return false;
  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
  const changed = [...keys].filter((key) => JSON.stringify(before[key]) !== JSON.stringify(after[key]));
  return changed.length > 0 && changed.every((key) =>
    key === 'cronogramaProgressApplied' || key === 'cronogramaProgressAllocations');
};

/** @param {object} record @param {object[]} slots @returns {object[]} */
export const getScheduleStudyCandidates = (record, slots) => {
  const id = String(record.disciplinaId || '').trim();
  const name = normalizeScheduleText(record.disciplinaNome);
  const discipline = slots.filter((slot) => !slot.isRevisaoAuto && !slot.isRevisao && (
    id && slot.disciplinaId ? id === String(slot.disciplinaId)
      : name && name === normalizeScheduleText(slot.disciplinaNome || slot.disciplina)
  )).slice().sort((a, b) => Number(a.ordemNoDia ?? a.ordem ?? 0) - Number(b.ordemNoDia ?? b.ordem ?? 0)
    || Number(a.slotIndexParaDisc || 0) - Number(b.slotIndexParaDisc || 0));
  const origin = String(record.cronogramaSlotIdBase || record.cronogramaSlotId || '');
  const completionOrigin = String(record.origemConclusaoId || '').match(/^cronograma:estudo:(.+):\d{4}-\d{2}-\d{2}$/)?.[1];
  const exact = discipline.filter((slot) => [getScheduleSlotKey(slot), String(slot.slotId || '')]
    .some((key) => key && (key === origin || key === completionOrigin)));
  if (exact.length) return exact;
  const subject = normalizeScheduleText(record.assunto);
  const matching = subject ? discipline.filter((slot) =>
    normalizeScheduleText(slot.assunto || slot.assuntoOriginal) === subject) : [];
  return matching.length ? matching : discipline;
};

/**
 * Distribui somente os minutos informados, preservando excedentes e conclusão de conteúdo.
 * @param {{slots: object[], record: object, currentMinutes?: object, completed?: object}} options
 * @returns {{minutes: object, completed: object, allocations: object}}
 */
export const allocateScheduleStudyRecord = ({ slots, record, currentMinutes = {}, completed = {} }) => {
  const candidates = getScheduleStudyCandidates(record, slots);
  const minutes = { ...currentMinutes };
  const done = { ...completed };
  const allocations = {};
  let remaining = Math.max(0, Number(record.tempoEstudadoMinutos ?? record.duracaoMinutos ?? 0) || 0);
  const finish = Boolean(record.markAsFinished || record.assuntoFinalizado);
  let positive = candidates.filter((slot) => Number(slot.tempoMinutos ?? slot.minutosEstudo ?? slot.tempoPlanejadoMinutos ?? 0) > 0);
  const scoped = Boolean(record.cronogramaSlotIdBase || record.cronogramaSlotId || record.origemConclusaoId)
    || candidates.some((slot) => normalizeScheduleText(record.assunto)
      && normalizeScheduleText(record.assunto) === normalizeScheduleText(slot.assunto || slot.assuntoOriginal));
  if (finish && !scoped) {
    const pending = positive.find((slot) => !done[getScheduleSlotKey(slot)]);
    if (pending) positive = [pending];
  }
  for (let index = 0; index < positive.length; index += 1) {
    const slot = positive[index];
    const key = getScheduleSlotKey(slot);
    if (!key || (remaining <= 0 && !(finish && index === 0))) break;
    const planned = Number(slot.tempoMinutos ?? slot.minutosEstudo ?? slot.tempoPlanejadoMinutos ?? 0);
    const current = Math.max(0, Number(minutes[key] || 0));
    const added = finish || index === positive.length - 1
      ? remaining : Math.min(remaining, Math.max(0, planned - current));
    minutes[key] = current + added;
    done[key] = Boolean(done[key]) || finish || minutes[key] >= planned;
    allocations[key] = added;
    remaining -= added;
    if (finish) break; // Concluir um assunto não conclui todos os blocos da disciplina.
  }
  return { minutes, completed: done, allocations };
};

/** Reconstrói somente os registros já carregados do dia, sem utilizar minutos inflados do plano. */
export const buildScheduleRecordedProgress = ({ slots, records = [], getMinutes = (record) =>
  Math.max(0, Number(record.tempoEstudadoMinutos ?? record.duracaoMinutos ?? 0) || 0) }) => {
  let minutes = {};
  let completed = {};
  const subjects = {};
  const allSubjects = {};
  const subjectDetails = {};
  const seen = new Set();
  const ordered = records.slice().sort((a, b) => {
    const time = (record) => record.timestamp?.toMillis?.()
      ?? (record.timestamp?.seconds ? record.timestamp.seconds * 1000 : Date.parse(record.timestamp || '') || 0);
    return time(a) - time(b);
  });
  for (const record of ordered) {
    if (record.id && seen.has(record.id)) continue;
    if (record.id) seen.add(record.id);
    const recorded = getMinutes(record);
    if (recorded <= 0) continue; // Checks de conteúdo com zero minutos não são estudo.
    const savedAllocations = record.cronogramaProgressAllocations;
    const validKeys = new Set(getScheduleStudyCandidates({ ...record, assunto: '', cronogramaSlotIdBase: '',
      cronogramaSlotId: '', origemConclusaoId: '' }, slots).map(getScheduleSlotKey));
    const useSaved = record.cronogramaProgressApplied === true && savedAllocations
      && Object.entries(savedAllocations).every(([key, value]) => validKeys.has(key) && Number.isFinite(value) && value >= 0)
      && Math.abs(Object.values(savedAllocations).reduce((total, value) => total + value, 0) - recorded) < 0.001;
    let result;
    if (useSaved) {
      result = { minutes: { ...minutes }, completed: { ...completed }, allocations: savedAllocations };
      for (const [key, value] of Object.entries(savedAllocations)) {
        result.minutes[key] = Number(minutes[key] || 0) + value;
        const slot = slots.find((candidate) => getScheduleSlotKey(candidate) === key);
        const planned = Number(slot.tempoMinutos ?? slot.minutosEstudo ?? slot.tempoPlanejadoMinutos ?? 0);
        result.completed[key] = completed[key] === true || Boolean(record.markAsFinished || record.assuntoFinalizado)
          || (planned > 0 && result.minutes[key] >= planned);
      }
    } else {
      result = allocateScheduleStudyRecord({ slots, record: { ...record, tempoEstudadoMinutos: recorded },
        currentMinutes: minutes, completed });
    }
    minutes = result.minutes;
    completed = result.completed;
    for (const [key, added] of Object.entries(result.allocations)) {
      if (added <= 0 || !record.assunto || record.conclusaoManual || record.origemConclusao === 'botao_concluir') continue;
      const slot = slots.find((candidate) => getScheduleSlotKey(candidate) === key);
      const subjectName = String(record.assunto).trim();
      const isPlanned = normalizeScheduleText(subjectName) === normalizeScheduleText(slot?.assunto || slot?.assuntoOriginal);
      if (!isPlanned) {
        subjects[key] = [...new Set([...(subjects[key] || []), subjectName])];
      }
      if (!allSubjects[key]) allSubjects[key] = [];
      if (!allSubjects[key].includes(subjectName)) {
        allSubjects[key].push(subjectName);
      }
      if (!subjectDetails[key]) subjectDetails[key] = [];
      const existing = subjectDetails[key].find((item) => normalizeScheduleText(item.assunto) === normalizeScheduleText(subjectName));
      if (existing) {
        existing.minutos += added;
        existing.markAsFinished = existing.markAsFinished || Boolean(record.markAsFinished || record.assuntoFinalizado);
      } else {
        subjectDetails[key].push({
          assunto: subjectName,
          minutos: added,
          isPlanned,
          isExtra: !isPlanned,
          markAsFinished: Boolean(record.markAsFinished || record.assuntoFinalizado),
        });
      }
    }
  }
  const hasPlannedStudied = {};
  for (const [key, details] of Object.entries(subjectDetails)) {
    hasPlannedStudied[key] = details.some((d) => d.isPlanned);
  }
  return { minutes, completed, subjects, allSubjects, subjectDetails, hasPlannedStudied };
};
