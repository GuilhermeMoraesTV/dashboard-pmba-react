export const NOTIFICATION_TYPES = Object.freeze({
  SYSTEM: 'sistema',
  UPDATE: 'atualizacao',
  EDITAL: 'edital',
  ACTION_REQUIRED: 'acao_necessaria',
  SUPPORT: 'suporte',
});

const ACTION_CATEGORIES = new Set(['urgente', 'aviso', 'acao_necessaria']);

export function classifyNotification(item = {}) {
  if (item.notificationType && Object.values(NOTIFICATION_TYPES).includes(item.notificationType)) {
    return item.notificationType;
  }
  if (item._type === 'edital_update' || item.cicloId || item.templateId) {
    return NOTIFICATION_TYPES.EDITAL;
  }
  if (item._type === 'support' || item.ticketId || item.category === 'suporte') {
    return NOTIFICATION_TYPES.SUPPORT;
  }
  if (ACTION_CATEGORIES.has(item.category) || item.requiresAction === true) {
    return NOTIFICATION_TYPES.ACTION_REQUIRED;
  }
  if (item.category === 'atualizacao') {
    return NOTIFICATION_TYPES.UPDATE;
  }
  return NOTIFICATION_TYPES.SYSTEM;
}

export function normalizeNotification(item = {}) {
  return {
    ...item,
    notificationType: classifyNotification(item),
  };
}
