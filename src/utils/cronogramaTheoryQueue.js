const normalizeTopic = (value) => String(value || '').replace(/\s+/g, ' ').trim();

const normalizeQueueEntry = (entry) => {
  if (typeof entry === 'string') {
    const assunto = normalizeTopic(entry);
    return assunto ? { assunto, origemSlotIdBase: null } : null;
  }

  const assunto = normalizeTopic(entry?.assunto);
  if (!assunto) return null;
  return {
    assunto,
    origemSlotIdBase: entry?.origemSlotIdBase || null,
  };
};

export const getTheoryPendingQueue = (pending) => (
  Array.isArray(pending?.filaAssuntos)
    ? pending.filaAssuntos.map(normalizeQueueEntry).filter(Boolean)
    : []
);

export const captureDisplacedTheoryTopic = (pending, slot) => {
  if (!pending?.assunto) return pending || null;

  const assuntoAtual = normalizeTopic(slot?.assunto);
  const assuntoOriginal = normalizeTopic(slot?.assuntoOriginal);
  if (!assuntoOriginal || assuntoOriginal === assuntoAtual) return pending;

  const origemSlotIdBase = slot?.slotIdBase || slot?.slotId || null;
  const filaAssuntos = getTheoryPendingQueue(pending);
  const alreadyQueued = filaAssuntos.some((entry) => (
    origemSlotIdBase
      ? entry.origemSlotIdBase === origemSlotIdBase
      : entry.assunto === assuntoOriginal
  ));

  if (!alreadyQueued) filaAssuntos.push({ assunto: assuntoOriginal, origemSlotIdBase });
  return { ...pending, filaAssuntos };
};

const getOriginFields = (slot, dataSlot) => {
  const ordem = Number(slot?.ordemNoDia);
  return {
    origemSlotIdBase: slot?.slotIdBase || slot?.slotId || null,
    origemDataSlot: slot?.dataSlot || dataSlot || null,
    ...(slot?.ordemNoDia != null && Number.isFinite(ordem) ? { origemOrdemNoDia: ordem } : {}),
    ...(slot?.hora != null ? { origemHora: slot.hora } : {}),
  };
};

export const buildTheoryContinuationPending = ({
  assunto,
  currentPending = null,
  slot = null,
  dataSlot = null,
  nowIso = new Date().toISOString(),
  fallbackOrigin = null,
}) => {
  const normalizedAssunto = normalizeTopic(assunto);
  if (!normalizedAssunto) return null;

  const withDisplacedTopic = captureDisplacedTheoryTopic(currentPending, slot);
  const originFields = getOriginFields(slot, dataSlot);
  const currentAssunto = normalizeTopic(withDisplacedTopic?.assunto);

  // Já existe outra continuação para a disciplina: preserve a mais antiga e
  // coloque a nova no fim da fila, em vez de sobrescrever conteúdo do usuário.
  if (currentAssunto && currentAssunto !== normalizedAssunto) {
    const filaAssuntos = getTheoryPendingQueue(withDisplacedTopic);
    const queuedOrigin = originFields.origemSlotIdBase || fallbackOrigin || null;
    const alreadyQueued = filaAssuntos.some((entry) => (
      queuedOrigin
        ? entry.origemSlotIdBase === queuedOrigin
        : entry.assunto === normalizedAssunto
    ));
    if (!alreadyQueued) {
      filaAssuntos.push({
        assunto: normalizedAssunto,
        origemSlotIdBase: queuedOrigin,
      });
    }
    return {
      ...withDisplacedTopic,
      filaAssuntos,
      ultimaMarcacaoEm: nowIso,
    };
  }

  return {
    assunto: normalizedAssunto,
    filaAssuntos: getTheoryPendingQueue(withDisplacedTopic),
    ...originFields,
    origemSlotIdBase: originFields.origemSlotIdBase || fallbackOrigin || currentPending?.origemSlotIdBase || null,
    criadoEm: currentPending?.criadoEm || nowIso,
    ultimaMarcacaoEm: nowIso,
    tipo: 'continuidade',
  };
};

export const advanceTheoryPendingAfterCompletion = ({
  pending,
  slot,
  nowIso = new Date().toISOString(),
}) => {
  const withDisplacedTopic = captureDisplacedTheoryTopic(pending, slot);
  const [nextEntry, ...remainingQueue] = getTheoryPendingQueue(withDisplacedTopic);
  if (!nextEntry?.assunto) return null;

  return {
    assunto: nextEntry.assunto,
    filaAssuntos: remainingQueue,
    ...getOriginFields(slot, slot?.dataSlot || null),
    criadoEm: pending?.criadoEm || nowIso,
    ultimaMarcacaoEm: nowIso,
    tipo: 'fila_reprogramada',
  };
};
