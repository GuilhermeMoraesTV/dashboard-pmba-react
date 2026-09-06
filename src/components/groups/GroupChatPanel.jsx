import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Virtuoso } from 'react-virtuoso';
import {
  AlertCircle,
  ArrowDown,
  CornerUpLeft,
  LoaderCircle,
  MoreHorizontal,
  Pencil,
  Send,
  Trash2,
  Users,
  WifiOff,
  X,
} from 'lucide-react';
import { getDoc } from 'firebase/firestore';
import { DEFAULT_PRODUCT_LIMITS } from '../../config/productLimits.js';
import { useOnlineStatus } from '../../hooks/useOnlineStatus.js';
import {
  canEditGroupChatMessage,
  getMentionAllUids,
  getMentionAutocompleteQuery,
  getTypingLabel,
  mergeGroupChatMessages,
  normalizeMessageText,
  replaceMentionAutocomplete,
} from '../../services/groupChat/groupChatDomain.js';
import {
  catchUpGroupChatMessages,
  deleteGroupChatMessage,
  editGroupChatMessage,
  getReplyMessage,
  loadInitialGroupChatMessages,
  loadLatestGroupChatMessages,
  loadNewerGroupChatMessages,
  loadOlderGroupChatMessages,
  markGroupChatRead,
  metaDocument,
  prepareGroupChat,
  publishGroupChatTyping,
  recoverOrRetryGroupChatMessage,
  sendGroupChatMessage,
  subscribeToGroupChatTyping,
  subscribeToNewGroupChatMessages,
} from '../../services/groupChat/groupChatService.js';

const LIMITS = DEFAULT_PRODUCT_LIMITS.groupChat;
const FIRST_ITEM_INDEX = 100000;
const messageKey = (_, message) => message.id;

function HistoryHeader({ context }) {
  return <div className="flex h-7 items-center justify-center">{context.loadingOlder ? <LoaderCircle size={14} className="animate-spin text-zinc-400"/> : null}</div>;
}

const timelineComponents = { Header: HistoryHeader };

function MessageAvatar({ message }) {
  return (
    <span className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-zinc-200 text-[10px] font-black text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
      {message.authorPhotoURL ? <img src={message.authorPhotoURL} alt="" className="h-full w-full object-cover"/> : message.authorName?.slice(0, 1).toUpperCase()}
    </span>
  );
}

function formatTime(value) {
  if (!(value instanceof Date) || Number.isNaN(value.getTime())) return 'agora';
  return new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' }).format(value);
}

function ReplyPreview({ message, groupId, messagesById }) {
  const local = messagesById.get(message.replyToMessageId);
  const [remote, setRemote] = useState(null);
  const [resolved, setResolved] = useState(Boolean(local));
  useEffect(() => {
    let active = true;
    if (!message.replyToMessageId || local) {
      setResolved(Boolean(local));
      return undefined;
    }
    getReplyMessage(groupId, message.replyToMessageId).then((value) => {
      if (active) { setRemote(value); setResolved(true); }
    }).catch(() => { if (active) setResolved(true); });
    return () => { active = false; };
  }, [groupId, local, message.replyToMessageId]);
  if (!message.replyToMessageId) return null;
  const reply = local || remote;
  return (
    <div className="mb-2 rounded-lg border-l-2 border-red-500 bg-black/5 px-2.5 py-2 text-[10px] dark:bg-white/5">
      <strong className="block truncate text-red-600 dark:text-red-400">{reply?.authorName || 'Resposta'}</strong>
      <span className="line-clamp-2 text-zinc-500 dark:text-zinc-400">{reply ? (reply.deleted ? 'Mensagem indisponível' : reply.text) : resolved ? 'Mensagem indisponível' : 'Carregando…'}</span>
    </div>
  );
}

function ChatMessage({ message, currentUid, groupId, messagesById, canModerate, onReply, onEdit, onDelete, onRetry }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const own = message.authorId === currentUid;
  const editable = canEditGroupChatMessage(message, currentUid);
  return (
    <article data-message-id={message.id} data-message-seq={message.seq} className={`group flex items-end gap-2 px-3 py-1.5 sm:px-5 ${own ? 'flex-row-reverse' : ''}`}>
      <MessageAvatar message={message}/>
      <div className={`min-w-0 max-w-[82%] sm:max-w-[72%] ${own ? 'items-end' : 'items-start'}`}>
        <div className={`mb-1 flex items-center gap-2 px-1 ${own ? 'justify-end' : ''}`}>
          {!own ? <strong className="truncate text-[10px] font-black text-zinc-600 dark:text-zinc-300">{message.authorName}</strong> : null}
          <span className="text-[9px] font-semibold text-zinc-400">{formatTime(message.createdAt)}{message.editedAt ? ' · editada' : ''}</span>
        </div>
        <div className="relative flex items-center gap-1">
          <div className={`min-w-0 rounded-2xl px-3.5 py-2.5 text-xs leading-relaxed shadow-sm ${message.deleted ? 'border border-dashed border-zinc-300 bg-zinc-50 italic text-zinc-400 dark:border-zinc-700 dark:bg-zinc-900' : own ? 'rounded-br-md bg-red-600 text-white' : 'rounded-bl-md border border-zinc-200 bg-white text-zinc-700 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200'}`}>
            <ReplyPreview message={message} groupId={groupId} messagesById={messagesById}/>
            <p className="whitespace-pre-wrap break-words">{message.deleted ? 'Mensagem removida' : message.text}</p>
            {message.deliveryState === 'sending' ? <span className="mt-1 flex items-center justify-end gap-1 text-[8px] opacity-75"><LoaderCircle size={9} className="animate-spin"/> Enviando</span> : null}
            {message.deliveryState === 'error' ? <button type="button" onClick={() => onRetry(message)} className="mt-2 flex items-center gap-1 rounded-lg bg-white/15 px-2 py-1 text-[9px] font-black"><AlertCircle size={10}/> Mensagem não enviada · Tentar novamente</button> : null}
          </div>
          {!message.deleted && message.deliveryState !== 'sending' ? (
            <div className="relative">
              <button type="button" onClick={() => setMenuOpen((value) => !value)} aria-label="Ações da mensagem" className="rounded-lg p-1.5 text-zinc-400 opacity-60 transition hover:bg-zinc-100 hover:opacity-100 dark:hover:bg-zinc-800 sm:opacity-0 sm:group-hover:opacity-100"><MoreHorizontal size={14}/></button>
              {menuOpen ? <div className={`absolute bottom-full z-30 mb-1 flex overflow-hidden rounded-xl border border-zinc-200 bg-white p-1 shadow-xl dark:border-zinc-700 dark:bg-zinc-900 ${own ? 'right-0' : 'left-0'}`}>
                <button type="button" onClick={() => { onReply(message); setMenuOpen(false); }} className="rounded-lg p-2 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800" title="Responder"><CornerUpLeft size={14}/></button>
                {editable ? <button type="button" onClick={() => { onEdit(message); setMenuOpen(false); }} className="rounded-lg p-2 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800" title="Editar"><Pencil size={14}/></button> : null}
                {(own || canModerate) ? <button type="button" onClick={() => { onDelete(message); setMenuOpen(false); }} className="rounded-lg p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30" title="Excluir"><Trash2 size={14}/></button> : null}
              </div> : null}
            </div>
          ) : null}
        </div>
      </div>
    </article>
  );
}

export default function GroupChatPanel({ group, user, members = [], canModerate = false, onUnreadChange }) {
  const online = useOnlineStatus();
  const virtuosoRef = useRef(null);
  const scrollerRef = useRef(null);
  const highestSeqRef = useRef(0);
  const realtimeStopRef = useRef(null);
  const typingStopRef = useRef(null);
  const readTimerRef = useRef(null);
  const deleteCancelButtonRef = useRef(null);
  const lastTypingWriteRef = useRef(0);
  const atBottomRef = useRef(true);
  const atTopRef = useRef(false);
  const scrollingRef = useRef(false);
  const pendingOlderRef = useRef(false);
  const initializedRef = useRef(false);
  const generationRef = useRef(0);
  const pagingOlderRef = useRef(false);
  const pagingNewerRef = useRef(false);
  const hasNewerRef = useRef(false);
  const loadedSeqRef = useRef(0);
  const onlineRef = useRef(online);
  const onUnreadChangeRef = useRef(onUnreadChange);
  onlineRef.current = online;
  onUnreadChangeRef.current = onUnreadChange;
  const [messages, setMessages] = useState([]);
  const messagesRef = useRef(messages);
  messagesRef.current = messages;
  const [firstItemIndex, setFirstItemIndex] = useState(FIRST_ITEM_INDEX);
  const [initialLocation, setInitialLocation] = useState({ index: 'LAST', align: 'end' });
  const [firstUnreadId, setFirstUnreadId] = useState(null);
  const [hasNewer, setHasNewer] = useState(false);
  const [loadingNewer, setLoadingNewer] = useState(false);
  const [timelineVersion, setTimelineVersion] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [oldestSeq, setOldestSeq] = useState(null);
  const [newMessageCount, setNewMessageCount] = useState(0);
  const [typingEntries, setTypingEntries] = useState([]);
  const [composer, setComposer] = useState('');
  const [mentions, setMentions] = useState([]);
  const [mentionAll, setMentionAll] = useState(false);
  const [replyingTo, setReplyingTo] = useState(null);
  const [editing, setEditing] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!deleteTarget) return undefined;
    if (!deleting) deleteCancelButtonRef.current?.focus();
    const onKeyDown = (event) => {
      if (event.key === 'Escape' && !deleting) setDeleteTarget(null);
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [deleteTarget, deleting]);

  const messagesById = useMemo(() => new Map(messages.map((message) => [message.id, message])), [messages]);
  const mentionAllUids = useMemo(() => getMentionAllUids(members, user.uid), [members, user.uid]);
  const mentionQuery = getMentionAutocompleteQuery(composer);
  const mentionSuggestions = useMemo(() => {
    if (mentionQuery == null) return [];
    const normalized = mentionQuery.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    const people = members.filter((member) => {
      const uid = member.uid || member.id;
      const name = member.displayName || member.name || '';
      return uid !== user.uid && !mentions.some((item) => item.uid === uid)
        && name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().includes(normalized);
    }).slice(0, 5);
    const includeAll = !mentionAll && mentionAllUids.length > 0 && 'todos'.includes(normalized);
    return includeAll ? [{ uid: '__all__', name: 'Todos', isAll: true }, ...people] : people;
  }, [members, mentionAll, mentionAllUids.length, mentionQuery, mentions, user.uid]);
  const typingLabel = getTypingLabel(typingEntries, user.uid);

  useEffect(() => {
    const now = Date.now();
    const nextExpiry = typingEntries
      .filter((entry) => entry.uid !== user.uid)
      .map((entry) => entry.typingUntil?.getTime?.() || 0)
      .filter((millis) => millis > now)
      .sort((left, right) => left - right)[0];
    if (!nextExpiry) return undefined;
    const timer = window.setTimeout(() => {
      const cutoff = Date.now();
      setTypingEntries((current) => current.filter((entry) => (entry.typingUntil?.getTime?.() || 0) > cutoff));
    }, Math.max(0, nextExpiry - now) + 25);
    return () => window.clearTimeout(timer);
  }, [typingEntries, user.uid]);

  const scheduleMarkRead = useCallback(() => {
    if (!initializedRef.current || !atBottomRef.current || hasNewerRef.current || !onlineRef.current || document.visibilityState === 'hidden') return;
    window.clearTimeout(readTimerRef.current);
    readTimerRef.current = window.setTimeout(() => {
      if (!atBottomRef.current || hasNewerRef.current || !onlineRef.current || document.visibilityState === 'hidden') return;
      const generation = generationRef.current;
      markGroupChatRead(group.id, user.uid, loadedSeqRef.current).then((changed) => {
        if (generation !== generationRef.current) return;
        if (changed !== false && atBottomRef.current && !hasNewerRef.current) setNewMessageCount(0);
        onUnreadChangeRef.current?.();
      }).catch((readError) => {
        if (generation === generationRef.current && onlineRef.current) setError(readError?.message || 'Não foi possível salvar a leitura da conversa.');
      });
    }, LIMITS.readDebounceMs);
  }, [group.id, user.uid]);

  // Virtuoso measures its viewport via getBoundingClientRect (scaled by CSS zoom),
  // but browser scrolling uses layout pixels. Read detection must use native metrics with a flexible threshold.
  const syncScrollPosition = useCallback((explicitAtBottom) => {
    const scroller = scrollerRef.current;
    const atBottom = typeof explicitAtBottom === 'boolean'
      ? explicitAtBottom
      : (scroller ? scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight <= 12 : false);
    atBottomRef.current = atBottom;
    if (atBottom && !hasNewerRef.current) scheduleMarkRead();
    else window.clearTimeout(readTimerRef.current);
  }, [scheduleMarkRead]);

  useLayoutEffect(() => {
    const scroller = scrollerRef.current;
    if (loading || !scroller) return undefined;
    scroller.addEventListener('scroll', syncScrollPosition, { passive: true });
    const observer = new ResizeObserver(syncScrollPosition);
    observer.observe(scroller);
    syncScrollPosition();
    return () => { scroller.removeEventListener('scroll', syncScrollPosition); observer.disconnect(); };
  }, [loading, timelineVersion, group.id, syncScrollPosition]);

  const stopRealtime = useCallback(() => {
    realtimeStopRef.current?.();
    typingStopRef.current?.();
    realtimeStopRef.current = null;
    typingStopRef.current = null;
  }, []);

  const startRealtime = useCallback((afterSeq) => {
    stopRealtime();
    realtimeStopRef.current = subscribeToNewGroupChatMessages(group.id, afterSeq, (incoming) => {
      if (!incoming.length) return;
      const previousHighest = highestSeqRef.current;
      highestSeqRef.current = Math.max(highestSeqRef.current, ...incoming.map((item) => item.seq));
      // Keep the visible history contiguous while paging towards the present.
      if (!hasNewerRef.current) {
        loadedSeqRef.current = highestSeqRef.current;
        setMessages((current) => mergeGroupChatMessages(current, incoming));
      }
      if (atBottomRef.current && !hasNewerRef.current) scheduleMarkRead();
      else setNewMessageCount((count) => count + incoming.filter((item) => item.seq > previousHighest && item.authorId !== user.uid).length);
    }, (listenerError) => setError(listenerError?.message || 'O realtime do chat foi interrompido.'));
    typingStopRef.current = subscribeToGroupChatTyping(group.id, setTypingEntries, () => setTypingEntries([]));
  }, [group.id, scheduleMarkRead, stopRealtime, user.uid]);

  useEffect(() => {
    let active = true;
    generationRef.current += 1;
    initializedRef.current = false;
    scrollingRef.current = false;
    pendingOlderRef.current = false;
    pagingOlderRef.current = false;
    pagingNewerRef.current = false;
    hasNewerRef.current = false;
    atBottomRef.current = false;
    setLoading(true);
    setMessages([]);
    setFirstItemIndex(FIRST_ITEM_INDEX);
    setLoadingOlder(false);
    setLoadingNewer(false);
    setHasNewer(false);
    setFirstUnreadId(null);
    setNewMessageCount(0);
    setTypingEntries([]);
    setError('');
    const initialize = async () => {
      if (onlineRef.current) await prepareGroupChat(group.id);
      if (!active) return;
      const initial = await loadInitialGroupChatMessages(group.id, user.uid);
      if (!active) return;
      highestSeqRef.current = initial.highestKnownSeq;
      loadedSeqRef.current = initial.highestSeq;
      hasNewerRef.current = initial.hasNewer;
      initializedRef.current = true;
      setMessages(initial.messages);
      setOldestSeq(initial.oldestSeq);
      setHasMore(initial.hasMore);
      setHasNewer(initial.hasNewer);
      setFirstUnreadId(initial.firstUnreadId);
      const rawLocation = initial.initialLocation;
      const computedLocation = typeof rawLocation?.index === 'number'
        ? { ...rawLocation, index: FIRST_ITEM_INDEX + rawLocation.index }
        : (rawLocation || { index: 'LAST', align: 'end' });
      setInitialLocation(computedLocation);
      setNewMessageCount(initial.unreadCount);
      setLoading(false);
      if (onlineRef.current && document.visibilityState !== 'hidden') startRealtime(initial.highestKnownSeq);
    };
    initialize().catch((initialError) => {
      if (!active) return;
      setLoading(false);
      setError(onlineRef.current ? (initialError?.message || 'Não foi possível abrir o chat.') : 'Você está offline e este histórico ainda não está no cache.');
    });
    return () => {
      active = false;
      initializedRef.current = false;
      generationRef.current += 1;
      stopRealtime();
      window.clearTimeout(readTimerRef.current);
    };
  }, [group.id, user.uid, startRealtime, stopRealtime]);

  useEffect(() => {
    let active = true;
    const onVisibility = async () => {
      if (document.visibilityState === 'hidden' || !onlineRef.current) {
        stopRealtime();
        window.clearTimeout(readTimerRef.current);
        setTypingEntries([]);
        return;
      }
      if (!initializedRef.current) return;
      try {
        const metaSnapshot = await getDoc(metaDocument(group.id));
        if (!active) return;
        const targetSeq = metaSnapshot.exists() ? Number(metaSnapshot.data().lastSeq || 0) : highestSeqRef.current;
        const missed = hasNewerRef.current ? [] : await catchUpGroupChatMessages(group.id, highestSeqRef.current, targetSeq);
        if (!active || document.visibilityState === 'hidden' || !onlineRef.current) return;
        highestSeqRef.current = targetSeq;
        if (missed.length) {
          loadedSeqRef.current = missed.at(-1).seq;
          setMessages((current) => mergeGroupChatMessages(current, missed));
        }
        startRealtime(highestSeqRef.current);
      } catch (visibilityError) {
        setError(visibilityError?.message || 'Não foi possível retomar o chat.');
      }
    };
    onVisibility();
    document.addEventListener('visibilitychange', onVisibility);
    return () => { active = false; document.removeEventListener('visibilitychange', onVisibility); };
  }, [group.id, online, startRealtime, stopRealtime]);

  const loadOlder = useCallback(async () => {
    if (!initializedRef.current || !hasMore || pagingOlderRef.current || oldestSeq == null) return;
    if (scrollingRef.current) { pendingOlderRef.current = true; return; }
    pendingOlderRef.current = false;
    pagingOlderRef.current = true;
    const generation = generationRef.current;
    setLoadingOlder(true);
    try {
      const page = await loadOlderGroupChatMessages(group.id, oldestSeq);
      if (generation !== generationRef.current) return;
      const existingIds = new Set(messagesRef.current.map((message) => message.id));
      const newMessages = page.messages.filter((message) => !existingIds.has(message.id));
      const addedCount = newMessages.length;
      if (addedCount > 0) {
        setFirstItemIndex((current) => current - addedCount);
        setMessages((current) => mergeGroupChatMessages(page.messages, current));
      }
      setOldestSeq(page.oldestSeq ?? oldestSeq);
      setHasMore(page.hasMore);
    } catch (pageError) {
      if (generation === generationRef.current) setError(pageError?.message || 'Não foi possível carregar mensagens antigas.');
    } finally {
      if (generation === generationRef.current) { pagingOlderRef.current = false; setLoadingOlder(false); }
    }
  }, [group.id, hasMore, oldestSeq]);

  const loadNewer = useCallback(async () => {
    if (!hasNewerRef.current || pagingNewerRef.current) return;
    pagingNewerRef.current = true;
    const generation = generationRef.current;
    setLoadingNewer(true);
    try {
      const page = await loadNewerGroupChatMessages(group.id, loadedSeqRef.current);
      if (generation !== generationRef.current) return;
      loadedSeqRef.current = page.highestSeq;
      const more = page.hasMore && page.highestSeq < highestSeqRef.current;
      hasNewerRef.current = more;
      setHasNewer(more);
      setMessages((current) => mergeGroupChatMessages(current, page.messages));
      if (!more) startRealtime(loadedSeqRef.current);
    } catch (pageError) {
      if (generation === generationRef.current) setError(pageError?.message || 'Não foi possível carregar as próximas mensagens.');
    } finally {
      if (generation === generationRef.current) { pagingNewerRef.current = false; setLoadingNewer(false); }
    }
  }, [group.id, startRealtime]);

  const notifyTyping = useCallback(() => {
    if (!online || document.visibilityState === 'hidden') return;
    const now = Date.now();
    if (now - lastTypingWriteRef.current < LIMITS.typingThrottleMs) return;
    lastTypingWriteRef.current = now;
    publishGroupChatTyping(group.id, user).catch(() => {});
  }, [group.id, online, user]);

  const onComposerChange = (value) => {
    setComposer(value);
    setMentions((current) => current.filter((mention) => value.includes(`@${mention.name}`)));
    if (!/(^|\s)@Todos(?:\s|$)/iu.test(value)) setMentionAll(false);
    if (value.trim()) notifyTyping();
  };

  const chooseMention = (member) => {
    if (member.isAll) {
      setComposer((current) => replaceMentionAutocomplete(current, 'Todos'));
      setMentionAll(true);
      setMentions([]);
      return;
    }
    const uid = member.uid || member.id;
    const name = member.displayName || member.name || 'Membro';
    setComposer((current) => replaceMentionAutocomplete(current, name));
    setMentions((current) => [...current, { uid, name }].slice(0, LIMITS.maxMentions));
  };

  const resetComposer = () => {
    setComposer('');
    setMentions([]);
    setMentionAll(false);
    setReplyingTo(null);
    setEditing(null);
  };

  const submit = async (event) => {
    event.preventDefault();
    setError('');
    if (!online) { setError('Você está offline'); return; }
    let cleanText;
    try { cleanText = normalizeMessageText(composer); } catch (validationError) { setError(validationError.message); return; }
    setSending(true);
    const selectedMentionUids = mentionAll ? mentionAllUids : mentions.map((item) => item.uid);
    if (editing) {
      try {
        await editGroupChatMessage({ groupId: group.id, messageId: editing.id, text: cleanText, mentionUids: selectedMentionUids, authorUid: user.uid });
        setMessages((current) => current.map((message) => message.id === editing.id ? { ...message, text: cleanText, mentionUids: selectedMentionUids, editedAt: new Date() } : message));
        resetComposer();
      } catch (editError) { setError(editError?.message || 'Não foi possível editar a mensagem.'); }
      finally { setSending(false); }
      return;
    }
    if (hasNewerRef.current && !await jumpToLatest()) { setSending(false); return; }
    const provisionalId = crypto.randomUUID().replaceAll('-', '');
    const optimistic = {
      id: provisionalId,
      seq: Number.MAX_SAFE_INTEGER,
      authorId: user.uid,
      authorName: user.displayName || user.name || 'Estudante',
      authorPhotoURL: user.photoURL || null,
      text: cleanText,
      replyToMessageId: replyingTo?.id || null,
      mentionUids: selectedMentionUids,
      createdAt: new Date(),
      updatedAt: new Date(),
      editedAt: null,
      deleted: false,
      deletedAt: null,
      deletedBy: null,
      deliveryState: 'sending',
    };
    const payload = { groupId: group.id, author: user, text: cleanText, replyToMessageId: optimistic.replyToMessageId, mentionUids: optimistic.mentionUids, messageId: provisionalId };
    setMessages((current) => mergeGroupChatMessages(current, [{ ...optimistic, retryPayload: payload }]));
    resetComposer();
    try {
      const result = await sendGroupChatMessage(payload);
      highestSeqRef.current = Math.max(highestSeqRef.current, result.seq);
      setMessages((current) => current.map((message) => message.id === provisionalId ? { ...message, seq: result.seq, deliveryState: 'sent', sendAttempts: result.attempts, sendLatencyMs: result.latencyMs } : message).sort((a, b) => a.seq - b.seq));
      scheduleMarkRead();
    } catch (sendError) {
      setMessages((current) => current.map((message) => message.id === provisionalId ? { ...message, deliveryState: 'error', errorMessage: sendError?.message } : message));
      setError(sendError?.code === 'failed-precondition' ? 'Aguarde um instante antes de enviar outra mensagem.' : (sendError?.message || 'Mensagem não enviada'));
    } finally { setSending(false); }
  };

  const retry = async (message) => {
    if (!online || !message.retryPayload) { setError('Você está offline'); return; }
    setMessages((current) => current.map((item) => item.id === message.id ? { ...item, deliveryState: 'sending' } : item));
    try {
      const result = await recoverOrRetryGroupChatMessage(message.retryPayload);
      highestSeqRef.current = Math.max(highestSeqRef.current, Number(result.seq || 0));
      setMessages((current) => current.map((item) => item.id === message.id ? { ...item, seq: result.seq, deliveryState: 'sent' } : item).sort((a, b) => a.seq - b.seq));
    } catch (retryError) {
      setMessages((current) => current.map((item) => item.id === message.id ? { ...item, deliveryState: 'error' } : item));
      setError(retryError?.message || 'Mensagem não enviada');
    }
  };

  const startEdit = (message) => {
    setEditing(message);
    setReplyingTo(null);
    setComposer(message.text);
    const editsMentionAll = /(^|\s)@Todos(?:\s|$)/iu.test(message.text || '');
    setMentionAll(editsMentionAll);
    setMentions(editsMentionAll ? [] : (message.mentionUids || []).map((uid) => {
      const member = members.find((item) => (item.uid || item.id) === uid);
      return { uid, name: member?.displayName || member?.name || uid };
    }));
  };

  const removeMessage = (message) => setDeleteTarget(message);

  const confirmRemoveMessage = async () => {
    if (!deleteTarget || deleting) return;
    setDeleting(true);
    try {
      await deleteGroupChatMessage({ groupId: group.id, messageId: deleteTarget.id, deletedBy: user.uid });
      setMessages((current) => current.map((item) => item.id === deleteTarget.id ? { ...item, text: '', deleted: true, deletedAt: new Date(), deletedBy: user.uid } : item));
      setDeleteTarget(null);
    } catch (deleteError) {
      setError(deleteError?.message || 'Não foi possível remover a mensagem.');
    } finally {
      setDeleting(false);
    }
  };

  const jumpToLatest = async () => {
    if (hasNewerRef.current) {
      if (pagingNewerRef.current) return false;
      pagingNewerRef.current = true;
      const generation = generationRef.current;
      setLoadingNewer(true);
      try {
        const latest = await loadLatestGroupChatMessages(group.id);
        if (generation !== generationRef.current) return false;
        loadedSeqRef.current = latest.highestSeq;
        highestSeqRef.current = Math.max(highestSeqRef.current, latest.highestSeq);
        hasNewerRef.current = false;
        setHasNewer(false);
        setMessages(latest.messages);
        setOldestSeq(latest.oldestSeq);
        setHasMore(latest.hasMore);
        setFirstItemIndex(FIRST_ITEM_INDEX);
        setInitialLocation({ index: 'LAST', align: 'end' });
        setTimelineVersion((version) => version + 1);
        startRealtime(latest.highestSeq);
      } catch (jumpError) {
        if (generation === generationRef.current) setError(jumpError?.message || 'Não foi possível ir à última mensagem.');
        return false;
      } finally {
        if (generation === generationRef.current) { pagingNewerRef.current = false; setLoadingNewer(false); }
      }
    } else {
      virtuosoRef.current?.scrollToIndex({ index: 'LAST', align: 'end', behavior: 'auto' });
    }
    return true;
  };

  return (
    <section className="relative flex h-[min(680px,calc(100dvh-185px))] min-h-[500px] flex-col overflow-hidden rounded-3xl border border-zinc-200 bg-zinc-50 shadow-sm dark:border-zinc-800 dark:bg-zinc-950/45 max-sm:h-[calc(100dvh-145px)] max-sm:min-h-0 max-sm:rounded-2xl">
      <header className="flex shrink-0 items-center justify-between border-b border-zinc-200 bg-white px-4 py-3 dark:border-zinc-800 dark:bg-card-dark">
        <div><h2 className="text-sm font-black text-zinc-900 dark:text-white">Conversa do grupo</h2><p className="text-[9px] font-bold uppercase tracking-wider text-zinc-400">{online ? 'Em tempo real' : 'Histórico offline'}</p></div>
        {!online ? <span className="flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-1 text-[9px] font-black text-amber-700 dark:bg-amber-950/30 dark:text-amber-300"><WifiOff size={11}/> Offline</span> : null}
      </header>
      {error ? <div role="alert" className="mx-3 mt-2 flex shrink-0 items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-[10px] font-bold text-red-700 dark:border-red-900/50 dark:bg-red-950/25 dark:text-red-300"><span>{error}</span><button type="button" onClick={() => setError('')} aria-label="Fechar aviso"><X size={13}/></button></div> : null}
      <div className="relative min-h-0 flex-1">
        {loading ? <div className="grid h-full place-items-center text-xs font-bold text-zinc-400"><span className="flex items-center gap-2"><LoaderCircle size={16} className="animate-spin"/> Abrindo conversa…</span></div> : messages.length ? (
          <Virtuoso
            key={`${group.id}:${timelineVersion}`}
            ref={virtuosoRef}
            scrollerRef={(element) => { scrollerRef.current = element; }}
            data={messages}
            computeItemKey={messageKey}
            firstItemIndex={firstItemIndex}
            initialTopMostItemIndex={initialLocation}
            defaultItemHeight={72}
            increaseViewportBy={{ top: 800, bottom: 800 }}
            style={{ height: '100%', overflowAnchor: 'none' }}
            startReached={loadOlder}
            endReached={loadNewer}
            atBottomThreshold={10}
            atTopThreshold={10}
            isScrolling={(scrolling) => {
              scrollingRef.current = scrolling;
              if (!scrolling && pendingOlderRef.current && atTopRef.current) loadOlder();
            }}
            atTopStateChange={(atTop) => { atTopRef.current = atTop; }}
            atBottomStateChange={syncScrollPosition}
            followOutput={(isAtBottom) => (isAtBottom && !hasNewerRef.current && !pagingOlderRef.current && !pagingNewerRef.current ? 'auto' : false)}
            components={timelineComponents}
            context={{ loadingOlder }}
            itemContent={(_, message) => <>{message.id === firstUnreadId ? <div className="py-3 text-center text-[10px] font-black uppercase tracking-wider text-zinc-500" role="separator" aria-label="Mensagens não lidas">Mensagens não lidas</div> : null}<ChatMessage message={message} currentUid={user.uid} groupId={group.id} messagesById={messagesById} canModerate={canModerate} onReply={(item) => { setReplyingTo(item); setEditing(null); }} onEdit={startEdit} onDelete={removeMessage} onRetry={retry}/></>}
          />
        ) : <div className="grid h-full place-items-center px-8 text-center"><div><Send size={25} className="mx-auto mb-2 text-zinc-300"/><p className="text-xs font-black text-zinc-600 dark:text-zinc-300">Comece a conversa</p><p className="mt-1 text-[10px] text-zinc-400">As mensagens deste grupo aparecem aqui em tempo real.</p></div></div>}
        {newMessageCount > 0 || hasNewer ? <button type="button" disabled={loadingNewer} onClick={jumpToLatest} className="absolute bottom-3 left-1/2 z-20 flex -translate-x-1/2 items-center gap-1.5 rounded-full bg-zinc-950 px-3 py-2 text-[10px] font-black text-white shadow-xl dark:bg-white dark:text-zinc-900">{loadingNewer ? <LoaderCircle size={12} className="animate-spin"/> : <ArrowDown size={12}/>} Novas mensagens{newMessageCount > 1 ? ` (${newMessageCount > 99 ? '99+' : newMessageCount})` : ''}</button> : null}
      </div>
      {typingLabel ? <div className="shrink-0 px-4 pb-1 text-[9px] font-semibold italic text-zinc-400">{typingLabel}</div> : <div className="h-4 shrink-0"/>}
      <form onSubmit={submit} className="relative shrink-0 border-t border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-card-dark">
        {(replyingTo || editing) ? <div className="mb-2 flex items-center justify-between rounded-xl bg-zinc-100 px-3 py-2 text-[10px] dark:bg-zinc-800"><div className="min-w-0"><strong className="block text-red-600">{editing ? 'Editando mensagem' : `Respondendo a ${replyingTo.authorName}`}</strong><span className="block truncate text-zinc-500">{editing?.text || replyingTo?.text}</span></div><button type="button" onClick={resetComposer} className="ml-3 p-1 text-zinc-400"><X size={13}/></button></div> : null}
        {mentionSuggestions.length ? <div className="absolute bottom-full left-3 right-3 z-30 mb-1 overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-xl dark:border-zinc-700 dark:bg-zinc-900">{mentionSuggestions.map((member) => <button type="button" key={member.uid || member.id} onClick={() => chooseMention(member)} className={`flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-bold hover:bg-zinc-50 dark:hover:bg-zinc-800 ${member.isAll ? 'text-red-600 dark:text-red-400' : 'text-zinc-700 dark:text-zinc-200'}`}><span className={`flex h-6 w-6 items-center justify-center overflow-hidden rounded-full ${member.isAll ? 'bg-red-100 dark:bg-red-950/50' : 'bg-zinc-200 dark:bg-zinc-800'}`}>{member.isAll ? <Users size={13}/> : member.photoURL ? <img src={member.photoURL} alt="" className="h-full w-full object-cover"/> : null}</span><span>{member.isAll ? `Todos do grupo (${mentionAllUids.length})` : (member.displayName || member.name || 'Membro')}</span></button>)}</div> : null}
        <div className="flex items-end gap-2">
          <textarea value={composer} onChange={(event) => onComposerChange(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); event.currentTarget.form?.requestSubmit(); } }} maxLength={LIMITS.maxMessageChars} rows={1} placeholder={online ? 'Escreva uma mensagem…' : 'Você está offline'} disabled={!online || sending} className="max-h-32 min-h-11 flex-1 resize-none rounded-2xl border border-zinc-200 bg-zinc-50 px-3.5 py-3 text-xs text-zinc-900 outline-none transition focus:border-red-400 dark:border-zinc-700 dark:bg-zinc-900 dark:text-white"/>
          <button type="submit" disabled={!online || sending || !composer.trim()} aria-label={editing ? 'Salvar edição' : 'Enviar mensagem'} className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-red-600 text-white shadow-lg shadow-red-600/20 transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-40">{sending ? <LoaderCircle size={17} className="animate-spin"/> : editing ? <Pencil size={16}/> : <Send size={16}/>}</button>
        </div>
        <div className="mt-1 flex justify-between px-1 text-[8px] font-semibold text-zinc-400"><span>{mentionAll ? `@Todos · ${mentionAllUids.length} membros` : mentions.length ? `${mentions.length}/${LIMITS.maxMentions} menções` : 'Use @ ou @Todos para mencionar'}</span><span>{composer.length.toLocaleString('pt-BR')}/{LIMITS.maxMessageChars.toLocaleString('pt-BR')}</span></div>
      </form>
      {deleteTarget ? createPortal(
        <div
          className="fixed inset-0 z-[10050] grid place-items-center bg-zinc-950/65 p-4 backdrop-blur-sm"
          role="presentation"
          onClick={() => { if (!deleting) setDeleteTarget(null); }}
        >
          <section
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="delete-chat-message-title"
            aria-describedby="delete-chat-message-description"
            onClick={(event) => event.stopPropagation()}
            className="w-full max-w-sm overflow-hidden rounded-3xl border border-red-100 bg-white shadow-2xl dark:border-red-950/60 dark:bg-zinc-900"
          >
            <div className="bg-gradient-to-br from-red-600 to-red-700 px-5 py-5 text-white">
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/15 ring-1 ring-white/20"><Trash2 size={21}/></span>
              <h2 id="delete-chat-message-title" className="mt-4 text-lg font-black">Excluir mensagem?</h2>
              <p id="delete-chat-message-description" className="mt-1 text-xs font-medium text-red-100">Ela será substituída por “Mensagem removida” para preservar a ordem da conversa.</p>
            </div>
            <div className="p-5">
              <div className="rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 dark:border-zinc-800 dark:bg-zinc-950/60">
                <p className="text-[9px] font-black uppercase tracking-wider text-zinc-400">Mensagem selecionada</p>
                <p className="mt-1.5 line-clamp-3 whitespace-pre-wrap break-words text-xs font-semibold text-zinc-700 dark:text-zinc-200">{deleteTarget.text}</p>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-2">
                <button ref={deleteCancelButtonRef} type="button" disabled={deleting} onClick={() => setDeleteTarget(null)} className="rounded-xl border border-zinc-200 px-4 py-2.5 text-xs font-black text-zinc-600 transition hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800">Cancelar</button>
                <button type="button" disabled={deleting} onClick={confirmRemoveMessage} className="inline-flex items-center justify-center gap-2 rounded-xl bg-red-600 px-4 py-2.5 text-xs font-black text-white shadow-lg shadow-red-600/20 transition hover:bg-red-700 disabled:opacity-60">{deleting ? <LoaderCircle size={14} className="animate-spin"/> : <Trash2 size={14}/>} {deleting ? 'Excluindo…' : 'Excluir'}</button>
              </div>
            </div>
          </section>
        </div>,
        document.body,
      ) : null}
    </section>
  );
}
