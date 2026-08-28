export const NOTIFICATION_TYPES = Object.freeze({
  SYSTEM: 'sistema',
  UPDATE: 'atualizacao',
  EDITAL: 'edital',
  ACTION_REQUIRED: 'acao_necessaria',
  SUPPORT: 'suporte',
});

export const EDITAL_LAUNCH_CATEGORY = 'edital_lancamento';

const ACTION_CATEGORIES = new Set(['urgente', 'aviso', 'acao_necessaria']);

export function isXPNotification(item = {}) {
  const sourceCollection = String(item.sourceCollection || '').trim().toLowerCase();
  const kind = String(item.operationalKind || item.type || item.category || '').trim().toLowerCase();
  const title = String(item.title || item.titulo || '').trim();
  return sourceCollection === 'xp_events'
    || kind === 'xp'
    || /^\+\s*\d+\s*xp\b/i.test(title);
}

export function shouldDisplayGamificationToast(item = {}) {
  return String(item.category || '').trim().toLowerCase() === 'achievement';
}

export function isEditalLaunchNotification(item = {}) {
  return item._type === 'edital_launch'
    || item.type === 'edital_launch'
    || item.category === EDITAL_LAUNCH_CATEGORY;
}

export function buildEditalLaunchNotification({ editalId, title, logoUrl, message, timestamp }) {
  return {
    active: true,
    type: 'edital_launch',
    category: EDITAL_LAUNCH_CATEGORY,
    notificationType: NOTIFICATION_TYPES.EDITAL,
    editalId,
    templateId: editalId,
    title,
    message,
    logoUrl: logoUrl || null,
    imageUrl: logoUrl || null,
    timestamp,
    createdAt: timestamp,
  };
}

export function classifyNotification(item = {}) {
  if (item.notificationType && Object.values(NOTIFICATION_TYPES).includes(item.notificationType)) {
    return item.notificationType;
  }
  if (isEditalLaunchNotification(item) || item._type === 'edital_update' || item.cicloId || item.templateId) {
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
