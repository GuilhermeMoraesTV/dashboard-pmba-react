export const dateToYMDLocal = (date = new Date()) => {
  if (typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date)) return date;
  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) return dateToYMDLocal(new Date());
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const firstPresent = (...values) => values.find((value) => value !== undefined && value !== null && value !== '');

const getMinutes = (item, fallback = 0) => {
  const raw = firstPresent(
    item?.tempoPlanejadoMinutos,
    item?.tempoMinutos,
    item?.duracaoMinutos,
    item?.tempoEstudadoMinutos,
    item?.minutosEstudo,
    fallback
  );
  return Math.max(0, Math.round(Number(raw) || 0));
};

const getCompletionSourceIds = ({ context, item, isReview, assunto }) => {
  if (context === 'ciclo' && !isReview) {
    const ids = [
      item?.globalIndex,
      item?.sessaoGlobalIndex,
      item?.slotId,
      item?.slotIdBase,
      item?.id,
      assunto,
    ];
    return [...new Set(ids.filter((value) => value !== undefined && value !== null && value !== '').map(String))];
  }

  return [firstPresent(item?.slotId, item?.slotIdBase, item?.id, item?.globalIndex, item?.revisaoKey, assunto)];
};

export const buildCompletionRegistro = ({
  context,
  item,
  ciclo = null,
  cronograma = null,
  date = new Date(),
  isReview = false,
  fallbackMinutes = 0,
}) => {
  const data = dateToYMDLocal(firstPresent(item?.dataSlot, item?.dataAgendada, item?.dataConclusao, date));
  const disciplinaId = firstPresent(item?.disciplinaId, item?.disciplina?.id, item?.id);
  const disciplinasFonte = Array.isArray(ciclo?.disciplinas)
    ? ciclo.disciplinas
    : Array.isArray(cronograma?.disciplinasSnapshot)
      ? cronograma.disciplinasSnapshot
      : [];
  const disciplinaFonte = disciplinasFonte.find((disciplina) => String(disciplina?.id) === String(disciplinaId));
  const disciplinaNome = firstPresent(item?.disciplinaNome, item?.disciplina?.nome, item?.disciplina, disciplinaFonte?.nome, 'Disciplina');
  const assunto = firstPresent(item?.assunto, item?.assuntoOriginal, item?.topico, item?.assuntoSugerido?.nome, 'Estudo');
  const sourceIds = getCompletionSourceIds({ context, item, isReview, assunto });
  const sourceId = sourceIds[0];
  const origemConclusaoId = `${context}:${isReview ? 'revisao' : 'estudo'}:${sourceId}:${data}`;
  const alternateOrigemConclusaoIds = sourceIds
    .slice(1)
    .map((id) => `${context}:${isReview ? 'revisao' : 'estudo'}:${id}:${data}`);

  return {
    contextoRegistro: context,
    ...(context === 'ciclo' && (ciclo?.id || item?.cicloId) ? { cicloId: ciclo?.id || item.cicloId } : {}),
    ...(context === 'cronograma' && (cronograma?.id || item?.cronogramaId) ? { cronogramaId: cronograma?.id || item.cronogramaId } : {}),
    disciplinaId,
    disciplinaNome,
    assunto,
    data,
    tempoEstudadoMinutos: getMinutes(item, fallbackMinutes),
    duracaoMinutos: getMinutes(item, fallbackMinutes),
    tempoPlanejadoConclusaoMinutos: getMinutes(item, fallbackMinutes),
    questoesFeitas: 0,
    acertos: 0,
    tipoEstudo: isReview ? 'revisao' : 'Teoria',
    origemConclusao: 'botao_concluir',
    conclusaoManual: true,
    origemConclusaoId,
    ...(alternateOrigemConclusaoIds.length ? { alternateOrigemConclusaoIds } : {}),
    ...(isReview ? { isRevisao: true, revisao: true } : {}),
    ...(Number.isFinite(Number(item?.globalIndex)) ? { sessaoGlobalIndex: Number(item.globalIndex) } : {}),
    ...(Number.isFinite(Number(item?.sessaoGlobalIndex)) ? { sessaoGlobalIndex: Number(item.sessaoGlobalIndex) } : {}),
    ...(context === 'ciclo' && !isReview ? { assuntoFinalizadoCiclo: true, markAsFinished: true } : {}),
  };
};
