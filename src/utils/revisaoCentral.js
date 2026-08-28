import { getCronogramaReviewBuckets } from '../services/scheduling/review.js';

const DAY_MS = 86400000;

const asArray = (value) => (Array.isArray(value) ? value : []);
const clean = (value) => String(value ?? '').trim();
const normalizedText = (value) => clean(value)
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLocaleLowerCase('pt-BR')
  .replace(/\s+/g, ' ');

export const toReviewDate = (value, fallback = new Date()) => {
  if (value?.toDate) return toReviewDate(value.toDate(), fallback);
  if (value?.seconds) return toReviewDate(value.seconds * 1000, fallback);
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value)) {
    const [year, month, day] = value.slice(0, 10).split('-').map(Number);
    return new Date(year, month - 1, day);
  }
  const date = value instanceof Date ? new Date(value) : new Date(value || fallback);
  if (Number.isNaN(date.getTime())) return toReviewDate(fallback, new Date());
  date.setHours(0, 0, 0, 0);
  return date;
};

const dateKey = (value) => {
  const date = toReviewDate(value);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};

const topicName = (topic) => clean(typeof topic === 'string' ? topic : topic?.nome || topic?.titulo || topic?.assunto);
const topicKey = (disciplinaId, disciplinaNome, assunto) => `${clean(disciplinaId) || normalizedText(disciplinaNome)}::${normalizedText(assunto)}`;
const recordIsReview = (record) => record?.isRevisao === true || record?.revisao === true || normalizedText(record?.tipoEstudo) === 'revisao';
const isDone = (item) => item?.concluido === true || item?.concluida === true;

export const filterStudyRecordsByPlanningSource = (records, { source, planId } = {}) => {
  const expectedSource = clean(source);
  const expectedPlanId = clean(planId);
  if (!['ciclo', 'cronograma'].includes(expectedSource)) return asArray(records);

  return asArray(records).filter((record) => {
    const recordContext = clean(record?.contextoRegistro);
    const cycleId = clean(record?.cicloId);
    const scheduleId = clean(record?.cronogramaId);
    if (expectedSource === 'ciclo') {
      if (recordContext && recordContext !== 'ciclo') return false;
      if (scheduleId) return false;
      return expectedPlanId ? cycleId === expectedPlanId : recordContext === 'ciclo' || Boolean(cycleId);
    }
    if (recordContext && recordContext !== 'cronograma') return false;
    if (cycleId) return false;
    return expectedPlanId ? scheduleId === expectedPlanId : recordContext === 'cronograma' || Boolean(scheduleId);
  });
};

const getRecordDate = (record) => {
  const value = record?.data || record?.dataConclusao || record?.timestamp || record?.createdAt;
  if (!value) return null;
  const parsed = toReviewDate(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const buildRecordsIndex = (records) => {
  const index = new Map();
  for (const record of asArray(records)) {
    const assunto = topicName(record?.assunto || record?.topico);
    if (!assunto) continue;
    const key = topicKey(record?.disciplinaId, record?.disciplinaNome || record?.disciplina, assunto);
    const date = getRecordDate(record);
    const current = index.get(key) || { lastStudy: null, lastReview: null, reviewCount: 0 };
    if (date && (!current.lastStudy || date > current.lastStudy)) current.lastStudy = date;
    if (recordIsReview(record)) {
      current.reviewCount += 1;
      if (date && (!current.lastReview || date > current.lastReview)) current.lastReview = date;
    }
    index.set(key, current);
  }
  return index;
};

const collectDisciplines = (cronograma, ciclo) => {
  const result = new Map();
  const sources = [
    ...asArray(cronograma?.disciplinasSnapshot).map((item) => ({ ...item, origem: 'cronograma' })),
    ...asArray(ciclo?.disciplinas).map((item) => ({ ...item, origem: 'ciclo' })),
  ];
  for (const discipline of sources) {
    const id = clean(discipline?.id) || normalizedText(discipline?.nome);
    if (!id) continue;
    const current = result.get(id) || { id, nome: discipline?.nome || 'Disciplina', assuntos: [], origens: new Set() };
    current.origens.add(discipline.origem);
    for (const rawTopic of asArray(discipline?.assuntos)) {
      const assunto = topicName(rawTopic);
      if (assunto && rawTopic?.inCiclo !== false && !current.assuntos.some((item) => normalizedText(item) === normalizedText(assunto))) {
        current.assuntos.push(assunto);
      }
    }
    result.set(id, current);
  }
  return Array.from(result.values()).map((item) => ({ ...item, origens: Array.from(item.origens) }));
};

const collectDominatedTopics = (cronograma) => {
  const values = cronograma?.progresso?.dominios || {};
  return Object.entries(values)
    .filter(([, active]) => active !== false)
    .map(([key]) => {
      const separator = key.indexOf('::');
      return separator >= 0
        ? { disciplinaId: key.slice(0, separator), assunto: key.slice(separator + 2) }
        : null;
    })
    .filter(Boolean);
};

const calculateStatus = ({ completed, dominated, date, today }) => {
  if (dominated) return 'dominada';
  if (completed) return 'concluida';
  if (date < today) return 'atrasada';
  if (date.getTime() === today.getTime()) return 'pendente';
  return 'proxima';
};

const recommendationFor = (item) => {
  if (item.status === 'dominada') return 'Assunto dominado. Mantenha apenas a vigilância.';
  if (item.status === 'concluida') return 'Revisão resolvida. Acompanhe a próxima janela.';
  if (item.diasAtraso >= 7) return 'Recupere hoje: o risco de esquecimento está alto.';
  if (item.diasAtraso > 0) return 'Faça antes das revisões do dia.';
  if (item.intervaloDias >= 30) return 'Priorize a retenção de longo prazo.';
  if (item.diasSemRevisao >= 30) return 'Assunto sem revisão recente.';
  return item.status === 'proxima' ? 'Prepare-se para esta revisão.' : 'Conclua na fila de hoje.';
};

const normalizeReview = ({ item, origem, today, recordsIndex, disciplineLateCount, dominatedKeys }) => {
  const disciplinaId = clean(item?.disciplinaId);
  const disciplinaNome = clean(item?.disciplinaNome || item?.disciplina?.nome || item?.disciplina) || 'Disciplina';
  const assunto = topicName(item?.assunto || item?.assuntoOriginal || item?.topico) || 'Assunto';
  const key = topicKey(disciplinaId, disciplinaNome, assunto);
  const date = toReviewDate(item?.dataSlot || item?.dataAgendada || item?.dataOriginal || item?.data, today);
  const daysDelta = Math.round((today.getTime() - date.getTime()) / DAY_MS);
  const completed = isDone(item);
  const dominated = item?.dominado === true || dominatedKeys.has(key);
  const history = recordsIndex.get(key) || {};
  const diasSemRevisao = history.lastReview ? Math.max(0, Math.round((today - history.lastReview) / DAY_MS)) : 999;
  const intervaloDias = Math.max(0, Number(item?.intervaloDias ?? item?.intervalo ?? 0) || 0);
  const status = calculateStatus({ completed, dominated, date, today });
  const diasAtraso = status === 'atrasada' ? Math.max(1, Number(item?.diasAtraso || daysDelta || 1)) : 0;
  const score = status === 'atrasada' || status === 'pendente'
    ? Math.round(
      (status === 'atrasada' ? 100 + Math.min(diasAtraso, 30) * 6 : 55)
      + Math.min(intervaloDias, 30)
      + Math.min(diasSemRevisao, 60)
      + (disciplineLateCount.get(disciplinaId || normalizedText(disciplinaNome)) || 0) * 12
      + (dominated ? 0 : 18)
    )
    : 0;
  const normalized = {
    ...item,
    idCentral: `${origem}:${item?.id || item?.slotId || item?.idUnique || key}:${dateKey(date)}`,
    _fonte: origem,
    origem,
    disciplinaId,
    disciplinaNome,
    disciplina: disciplinaNome,
    assunto,
    data: date,
    dataSlot: item?.dataSlot || date,
    dataKey: dateKey(date),
    diasAtraso,
    intervaloDias,
    tempoMinutos: Math.max(1, Math.round(Number(item?.tempoMinutos || item?.duracao || item?.minutosEstudo || 20) || 20)),
    concluido: completed,
    concluida: completed,
    dominado: dominated,
    dominio: dominated ? 'dominado' : completed ? 'resolvido' : 'em_construcao',
    status,
    diasSemRevisao,
    ultimaRevisao: history.lastReview || null,
    prioridade: score,
  };
  return { ...normalized, acaoRecomendada: recommendationFor(normalized) };
};

const uniqueReviews = (items) => {
  const seen = new Map();
  for (const item of items) {
    const key = item.idCentral;
    const current = seen.get(key);
    if (!current || item.prioridade > current.prioridade) seen.set(key, item);
  }
  return Array.from(seen.values());
};

const buildCoverage = ({ disciplines, recordsIndex, dominatedKeys, today }) => {
  const staleThreshold = new Date(today);
  staleThreshold.setDate(staleThreshold.getDate() - 30);
  const byDiscipline = disciplines.map((discipline) => {
    const topics = discipline.assuntos.map((assunto) => {
      const key = topicKey(discipline.id, discipline.nome, assunto);
      const history = recordsIndex.get(key) || {};
      const dominated = dominatedKeys.has(key);
      const reviewedRecently = dominated || Boolean(history.lastReview && history.lastReview >= staleThreshold);
      return { disciplinaId: discipline.id, disciplinaNome: discipline.nome, assunto, dominated, reviewedRecently, lastReview: history.lastReview || null };
    });
    const covered = topics.filter((topic) => topic.reviewedRecently).length;
    return {
      id: discipline.id,
      nome: discipline.nome,
      totalAssuntos: topics.length,
      assuntosCobertos: covered,
      cobertura: topics.length ? Math.round((covered / topics.length) * 100) : 0,
      semRevisaoRecente: topics.filter((topic) => !topic.reviewedRecently),
      origens: discipline.origens,
    };
  });
  const totalAssuntos = byDiscipline.reduce((sum, item) => sum + item.totalAssuntos, 0);
  const assuntosCobertos = byDiscipline.reduce((sum, item) => sum + item.assuntosCobertos, 0);
  return {
    totalAssuntos,
    assuntosCobertos,
    percentual: totalAssuntos ? Math.round((assuntosCobertos / totalAssuntos) * 100) : 0,
    semRevisaoRecente: byDiscipline.flatMap((item) => item.semRevisaoRecente),
    porDisciplina: byDiscipline,
  };
};

export const buildRevisaoCentral = ({
  cronograma = null,
  ciclo = null,
  revisoesCiclo = [],
  registrosEstudo = [],
  dataReferencia = new Date(),
} = {}) => {
  const today = toReviewDate(dataReferencia);
  const recordsIndex = buildRecordsIndex(registrosEstudo);
  const disciplines = collectDisciplines(cronograma, ciclo);
  const dominatedTopics = collectDominatedTopics(cronograma);
  const dominatedKeys = new Set(dominatedTopics.map((item) => {
    const discipline = disciplines.find((entry) => clean(entry.id) === clean(item.disciplinaId));
    return topicKey(item.disciplinaId, discipline?.nome, item.assunto);
  }));
  const cronogramaBuckets = cronograma
    ? getCronogramaReviewBuckets(cronograma, today)
    : { hoje: [], atrasadas: [], proximas: [] };
  const raw = [
    ...asArray(cronogramaBuckets.hoje).map((item) => ({ item, origem: 'cronograma' })),
    ...asArray(cronogramaBuckets.atrasadas).map((item) => ({ item, origem: 'cronograma' })),
    ...asArray(cronogramaBuckets.proximas).map((item) => ({ item, origem: 'cronograma' })),
    ...asArray(revisoesCiclo)
      .filter((item) => !ciclo?.id || clean(item?.cicloId) === clean(ciclo.id))
      .map((item) => ({ item, origem: 'ciclo' })),
  ];
  const lateCounts = new Map();
  for (const { item } of raw) {
    const date = toReviewDate(item?.dataSlot || item?.dataAgendada || item?.dataOriginal, today);
    if (!isDone(item) && date < today) {
      const key = clean(item?.disciplinaId) || normalizedText(item?.disciplinaNome || item?.disciplina);
      lateCounts.set(key, (lateCounts.get(key) || 0) + 1);
    }
  }
  let items = uniqueReviews(raw.map((entry) => normalizeReview({ ...entry, today, recordsIndex, disciplineLateCount: lateCounts, dominatedKeys })));

  for (const dominated of dominatedTopics) {
    const discipline = disciplines.find((item) => clean(item.id) === clean(dominated.disciplinaId));
    const key = topicKey(dominated.disciplinaId, discipline?.nome, dominated.assunto);
    if (items.some((item) => topicKey(item.disciplinaId, item.disciplinaNome, item.assunto) === key && item.dominado)) continue;
    items.push(normalizeReview({
      item: { id: `dominio:${key}`, disciplinaId: dominated.disciplinaId, disciplinaNome: discipline?.nome, assunto: dominated.assunto, dominado: true, concluido: true, dataSlot: today, tempoMinutos: 20, somenteLeitura: true },
      origem: 'cronograma', today, recordsIndex, disciplineLateCount: lateCounts, dominatedKeys,
    }));
  }

  items.sort((a, b) => b.prioridade - a.prioridade || a.data - b.data || a.disciplinaNome.localeCompare(b.disciplinaNome));
  const buckets = {
    hoje: items.filter((item) => item.status === 'pendente'),
    atrasadas: items.filter((item) => item.status === 'atrasada'),
    proximas: items.filter((item) => item.status === 'proxima'),
    resolvidas: items.filter((item) => item.status === 'concluida' || item.status === 'dominada'),
  };
  const pendentes = [...buckets.atrasadas, ...buckets.hoje];
  const atrasadasMinutos = buckets.atrasadas.reduce((sum, item) => sum + item.tempoMinutos, 0);
  const coverage = buildCoverage({ disciplines, recordsIndex, dominatedKeys, today });
  const diagnostics = disciplines.map((discipline) => {
    const related = items.filter((item) => clean(item.disciplinaId) === clean(discipline.id) || normalizedText(item.disciplinaNome) === normalizedText(discipline.nome));
    const coverageItem = coverage.porDisciplina.find((item) => item.id === discipline.id);
    const atrasadas = related.filter((item) => item.status === 'atrasada').length;
    const pendentesHoje = related.filter((item) => item.status === 'pendente').length;
    const risco = atrasadas >= 3 || (coverageItem?.cobertura || 0) < 30 ? 'alto' : atrasadas > 0 || (coverageItem?.cobertura || 0) < 70 ? 'medio' : 'baixo';
    return { ...discipline, atrasadas, pendentesHoje, cobertura: coverageItem?.cobertura || 0, semRevisaoRecente: coverageItem?.semRevisaoRecente?.length || 0, risco };
  }).sort((a, b) => b.atrasadas - a.atrasadas || a.cobertura - b.cobertura || a.nome.localeCompare(b.nome));
  const leading = diagnostics[0];
  const insight = leading && (leading.atrasadas || leading.semRevisaoRecente)
    ? `Comece por ${leading.nome}: ${leading.atrasadas} atrasada${leading.atrasadas === 1 ? '' : 's'} e ${leading.risco === 'alto' ? 'maior risco de esquecimento' : `${leading.semRevisaoRecente} assunto${leading.semRevisaoRecente === 1 ? '' : 's'} sem revisão recente`}.`
    : pendentes.length ? `Comece por ${pendentes[0].disciplinaNome}: é a revisão com maior prioridade agora.` : 'Sua fila crítica está sob controle. Acompanhe as próximas revisões.';

  return {
    items,
    buckets,
    prioridadeHoje: pendentes.length,
    facaPrimeiro: pendentes.slice(0, 3),
    diagnosticoDisciplinas: diagnostics,
    cobertura: coverage,
    insight,
    metricas: {
      total: items.length,
      pendentes: pendentes.length,
      atrasadas: buckets.atrasadas.length,
      atrasoCritico: buckets.atrasadas.filter((item) => item.diasAtraso >= 7).length,
      tempoEstimadoHoje: pendentes.reduce((sum, item) => sum + item.tempoMinutos, 0),
      retencao: coverage.totalAssuntos ? coverage.percentual : items.length ? Math.round((buckets.resolvidas.length / items.length) * 100) : 0,
    },
    recuperacao: {
      quantidade: buckets.atrasadas.length,
      minutos: atrasadasMinutos,
      opcoes: [
        { id: 'hoje', label: 'Zerar hoje', dias: 1, minutosPorDia: atrasadasMinutos },
        { id: '3dias', label: 'Distribuir em 3 dias', dias: 3, minutosPorDia: Math.ceil(atrasadasMinutos / 3) },
        { id: 'semana', label: 'Distribuir na semana', dias: 7, minutosPorDia: Math.ceil(atrasadasMinutos / 7) },
      ],
    },
    filtros: {
      disciplinas: Array.from(new Map(items.map((item) => [item.disciplinaId || normalizedText(item.disciplinaNome), { id: item.disciplinaId || normalizedText(item.disciplinaNome), nome: item.disciplinaNome }])).values()).sort((a, b) => a.nome.localeCompare(b.nome)),
      intervalos: Array.from(new Set(items.map((item) => item.intervaloDias).filter((value) => value > 0))).sort((a, b) => a - b),
    },
  };
};

export const filterRevisaoCentralItems = (items, filters = {}) => asArray(items).filter((item) => {
  if (filters.origem && filters.origem !== 'todas' && item.origem !== filters.origem) return false;
  if (filters.disciplina && filters.disciplina !== 'todas' && clean(item.disciplinaId || normalizedText(item.disciplinaNome)) !== clean(filters.disciplina)) return false;
  if (filters.intervalo && filters.intervalo !== 'todos' && Number(item.intervaloDias) !== Number(filters.intervalo)) return false;
  if (filters.status && filters.status !== 'todos') {
    if (filters.status === 'pendente' && !['pendente', 'proxima'].includes(item.status)) return false;
    else if (filters.status !== 'pendente' && item.status !== filters.status) return false;
  }
  if (filters.busca && !normalizedText(`${item.disciplinaNome} ${item.assunto}`).includes(normalizedText(filters.busca))) return false;
  return true;
});
