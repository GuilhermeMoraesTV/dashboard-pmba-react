import { calculateGroupChatUnread } from './groupChatDomain.js';

// Reads at most two pages, even when the unread interval spans months.
export async function loadGroupChatOpening({ uid, loadState, loadLatest, loadAfter }) {
  const [state, latest] = await Promise.all([loadState(), loadLatest()]);
  const unreadCount = state ? calculateGroupChatUnread({ lastSeq: latest.highestSeq }, state) : 0;
  const lastReadSeq = Number(state?.lastReadSeq || 0);
  const page = unreadCount > 0 && latest.oldestSeq > lastReadSeq + 1
    ? await loadAfter(lastReadSeq) : latest;
  const unreadIndex = unreadCount > 0
    ? page.messages.findIndex((message) => message.seq > lastReadSeq && message.authorId !== uid) : -1;
  return {
    ...page,
    highestKnownSeq: Math.max(latest.highestSeq, page.highestSeq),
    hasNewer: page.highestSeq < latest.highestSeq,
    hasMore: page === latest ? latest.hasMore : lastReadSeq > 0,
    unreadCount,
    firstUnreadId: unreadIndex >= 0 ? page.messages[unreadIndex].id : null,
    initialLocation: unreadCount > 0 && unreadIndex >= 0
      ? { index: unreadIndex, align: 'start' }
      : { index: 'LAST', align: 'end' },
  };
}
