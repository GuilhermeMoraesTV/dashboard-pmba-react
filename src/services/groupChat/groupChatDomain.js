import { DEFAULT_PRODUCT_LIMITS } from '../../config/productLimits.js';

const CHAT_LIMITS = DEFAULT_PRODUCT_LIMITS.groupChat;

function collectMentionUids(values = [], authorUid = '') {
  return [...new Set((Array.isArray(values) ? values : [])
    .map((value) => String(value || '').trim())
    .filter((value) => value && value !== authorUid))];
}

export function normalizeMessageText(value) {
  const text = String(value ?? '').trim();
  if (!text) throw new Error('Digite uma mensagem.');
  if (text.length > CHAT_LIMITS.maxMessageChars) {
    throw new Error(`A mensagem pode ter no máximo ${CHAT_LIMITS.maxMessageChars.toLocaleString('pt-BR')} caracteres.`);
  }
  return text;
}

export function normalizeMentionUids(values = [], authorUid = '') {
  const unique = collectMentionUids(values, authorUid);
  if (unique.length > CHAT_LIMITS.maxMentions) {
    throw new Error(`Uma mensagem pode mencionar no máximo ${CHAT_LIMITS.maxMentions} pessoas.`);
  }
  return unique;
}

export function getMentionAllUids(members = [], authorUid = '') {
  return collectMentionUids(
    (Array.isArray(members) ? members : []).map((member) => member?.uid || member?.id),
    authorUid,
  );
}

export function calculateGroupChatUnread(meta = {}, state = {}) {
  const lastSeq = Math.max(0, Number(meta.lastSeq || 0));
  const lastReadSeq = Math.max(0, Math.min(lastSeq, Number(state.lastReadSeq || 0)));
  const sentCountTotal = Math.max(0, Number(state.sentCountTotal || 0));
  const sentCountAtRead = Math.max(0, Math.min(sentCountTotal, Number(state.sentCountAtRead || 0)));
  return Math.max(0, (lastSeq - lastReadSeq) - (sentCountTotal - sentCountAtRead));
}

export function toMillis(value) {
  if (!value) return 0;
  if (typeof value.toMillis === 'function') return value.toMillis();
  if (typeof value.toDate === 'function') return value.toDate().getTime();
  if (value instanceof Date) return value.getTime();
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
}

export function toDate(value) {
  const millis = toMillis(value);
  return millis ? new Date(millis) : null;
}

export function shouldReconcileRetainedHistory(state = {}, nowMs = Date.now()) {
  const readAtMs = toMillis(state.readAt);
  return readAtMs > 0 && nowMs - readAtMs > CHAT_LIMITS.retentionDays * 24 * 60 * 60 * 1000;
}

export function retainedReadFloor(firstRetainedSeq, currentLastReadSeq = 0) {
  if (!Number.isFinite(Number(firstRetainedSeq))) return Math.max(0, Number(currentLastReadSeq || 0));
  return Math.max(Number(currentLastReadSeq || 0), Math.max(0, Number(firstRetainedSeq) - 1));
}

export function canEditGroupChatMessage(message = {}, userId = '', nowMs = Date.now()) {
  return !message.deleted
    && message.authorId === userId
    && toMillis(message.createdAt) > 0
    && nowMs - toMillis(message.createdAt) <= CHAT_LIMITS.editWindowMinutes * 60 * 1000;
}

export function mergeGroupChatMessages(current = [], incoming = []) {
  const byId = new Map(current.map((message) => [message.id, message]));
  for (const message of incoming) {
    const previous = byId.get(message.id);
    byId.set(message.id, previous?.deliveryState === 'sending' && message.deliveryState !== 'error'
      ? { ...previous, ...message, deliveryState: 'sent' }
      : { ...previous, ...message });
  }
  return [...byId.values()].sort((a, b) => Number(a.seq || Number.MAX_SAFE_INTEGER) - Number(b.seq || Number.MAX_SAFE_INTEGER));
}

export function getTypingLabel(entries = [], currentUid = '', nowMs = Date.now()) {
  const names = entries
    .filter((entry) => entry.uid !== currentUid && toMillis(entry.typingUntil) > nowMs)
    .map((entry) => entry.name || 'Alguém');
  if (!names.length) return '';
  if (names.length === 1) return `${names[0]} está digitando...`;
  if (names.length <= 5) return `${names.slice(0, -1).join(', ')} e ${names.at(-1)} estão digitando...`;
  return `${names[0]}, ${names[1]} e outros estão digitando...`;
}

export function getMentionAutocompleteQuery(text = '') {
  const match = String(text).match(/(?:^|\s)@([^\s@]{0,40})$/u);
  return match ? match[1] : null;
}

export function replaceMentionAutocomplete(text, displayName) {
  const cleanName = String(displayName || '').trim().replace(/\s+/g, ' ');
  return String(text).replace(/(^|\s)@[^\s@]*$/u, `$1@${cleanName} `);
}

export function estimateGroupChatOperations(flow, options = {}) {
  const mentions = Math.min(CHAT_LIMITS.maxMentions, Math.max(0, Number(options.mentions || 0)));
  const typingSeconds = Math.max(0, Number(options.typingSeconds || 0));
  const observers = Math.max(0, Number(options.observers || 0));
  const table = {
    open: { reads: CHAT_LIMITS.pageSize, writes: 0, listenerDeliveries: 0 },
    send: { reads: 2, writes: 3, listenerDeliveries: observers },
    sendWithMention: { reads: 2, writes: 4 + mentions + 1, listenerDeliveries: observers },
    typing: { reads: 0, writes: typingSeconds > 0 ? 1 + Math.floor((typingSeconds - 1) / (CHAT_LIMITS.typingThrottleMs / 1000)) : 0, listenerDeliveries: observers },
    markRead: { reads: 2, writes: 1, listenerDeliveries: 1 },
    receiveOpen: { reads: 1, writes: 0, listenerDeliveries: 1 },
    receiveClosed: { reads: 1, writes: 0, listenerDeliveries: 1 },
    olderPage: { reads: CHAT_LIMITS.pageSize, writes: 0, listenerDeliveries: 0 },
  };
  return table[flow] || { reads: 0, writes: 0, listenerDeliveries: 0 };
}

export { CHAT_LIMITS };
