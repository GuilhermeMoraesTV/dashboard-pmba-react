const topicName = (topic) => (
  typeof topic === 'string'
    ? topic
    : topic?.nome || topic?.titulo || topic?.label || ''
);

export const normalizeEditalSearch = (value) => String(value ?? '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .trim()
  .toLocaleLowerCase('pt-BR');

export const formatEditalStudyDate = (value) => {
  if (!value) return '-';

  try {
    const date = typeof value?.toDate === 'function' ? value.toDate() : new Date(value);
    if (Number.isNaN(date.getTime())) return '-';
    return date.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  } catch {
    return '-';
  }
};

export const formatEditalProgressText = (completed, total) => (
  `${Math.max(0, Number(completed) || 0)}/${Math.max(0, Number(total) || 0)} tópicos concluídos`
);

export const filterEditalDisciplines = (disciplines = [], searchTerm = '') => {
  const term = normalizeEditalSearch(searchTerm);
  if (!term) {
    return {
      disciplines: Array.isArray(disciplines) ? disciplines : [],
      autoExpandedNames: [],
    };
  }

  const autoExpandedNames = [];
  const filtered = (Array.isArray(disciplines) ? disciplines : []).flatMap((discipline) => {
    const disciplineMatches = normalizeEditalSearch(discipline?.nome).includes(term);
    const topics = Array.isArray(discipline?.assuntos) ? discipline.assuntos : [];
    const matchingTopics = topics.filter((topic) => normalizeEditalSearch(topicName(topic)).includes(term));

    if (!disciplineMatches && matchingTopics.length === 0) return [];
    if (!disciplineMatches && matchingTopics.length > 0) autoExpandedNames.push(discipline.nome);

    return [{
      ...discipline,
      assuntos: disciplineMatches ? topics : matchingTopics,
    }];
  });

  return { disciplines: filtered, autoExpandedNames };
};

export const prepareExternalEditalDisciplines = (edital = {}) => (
  (Array.isArray(edital?.disciplinas) ? edital.disciplinas : []).map((discipline, disciplineIndex) => {
    const name = discipline?.nome || discipline?.titulo || `Disciplina ${disciplineIndex + 1}`;
    const topics = (Array.isArray(discipline?.assuntos) ? discipline.assuntos : [])
      .map((topic, topicIndex) => ({
        ...(typeof topic === 'object' && topic ? topic : {}),
        id: topic?.id || `external-topic-${disciplineIndex}-${topicIndex}`,
        nome: topicName(topic),
        estudado: false,
        qtdVezes: 0,
        minutos: 0,
        questoes: 0,
        acertos: 0,
      }))
      .filter((topic) => topic.nome);

    return {
      ...(typeof discipline === 'object' && discipline ? discipline : {}),
      id: discipline?.id || `external-discipline-${disciplineIndex}`,
      nome: name,
      assuntos: topics,
      totalAssuntos: topics.length,
      concluidos: 0,
      progresso: 0,
      inCiclo: true,
      isNew: false,
      stats: { desempenho: 0, questoes: 0, ultimaData: null, minutos: 0 },
    };
  }).filter((discipline) => discipline.nome)
);
