import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { collection, collectionGroup, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../firebaseConfig.js';
import { DEFAULT_PRODUCT_LIMITS } from '../config/productLimits.js';
import {
  calculateGroupChatUnread,
  shouldReconcileRetainedHistory,
  toDate,
} from '../services/groupChat/groupChatDomain.js';
import { reconcileGroupChatRetainedHistory } from '../services/groupChat/groupChatService.js';

const HIDDEN_GRACE_MS = DEFAULT_PRODUCT_LIMITS.groupChat.summaryHiddenGraceMs;

export function useGroupChatSummaries(user) {
  const uid = user?.uid || '';
  const [metas, setMetas] = useState(() => new Map());
  const [states, setStates] = useState(() => new Map());
  const [reconcilingIds, setReconcilingIds] = useState(() => new Set());
  const stopRef = useRef(null);
  const hiddenTimerRef = useRef(null);
  const reconcilingRef = useRef(new Set());

  const stop = useCallback(() => {
    stopRef.current?.forEach((unsubscribe) => unsubscribe());
    stopRef.current = null;
  }, []);

  const start = useCallback(() => {
    if (!uid || stopRef.current) return;
    const metaQuery = query(collectionGroup(db, 'chat_meta'), where('memberIds', 'array-contains', uid));
    const stopMetas = onSnapshot(metaQuery, (snapshot) => {
      const next = new Map();
      snapshot.docs.forEach((item) => {
        if (item.id !== 'current') return;
        const data = item.data() || {};
        const groupId = data.groupId || item.ref.parent.parent?.id;
        if (groupId) next.set(groupId, { ...data, groupId, lastMessageAt: toDate(data.lastMessageAt) });
      });
      setMetas(next);
    }, (error) => console.warn('[Chat] Resumos de grupos indisponíveis:', error?.code, error?.message || error));
    const stopStates = onSnapshot(collection(db, 'users', uid, 'group_chat_states'), (snapshot) => {
      const next = new Map();
      snapshot.docs.forEach((item) => {
        const data = item.data() || {};
        const groupId = data.groupId || item.id;
        next.set(groupId, { ...data, groupId, readAt: toDate(data.readAt), lastSendAt: toDate(data.lastSendAt) });
      });
      setStates(next);
    }, (error) => console.warn('[Chat] Estados de leitura indisponíveis:', error?.code || error));
    stopRef.current = [stopMetas, stopStates];
  }, [uid]);

  useEffect(() => {
    if (!uid) {
      stop();
      setMetas(new Map());
      setStates(new Map());
      return undefined;
    }
    start();
    const onVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        window.clearTimeout(hiddenTimerRef.current);
        hiddenTimerRef.current = window.setTimeout(() => {
          if (document.visibilityState === 'hidden') stop();
        }, HIDDEN_GRACE_MS);
        return;
      }
      window.clearTimeout(hiddenTimerRef.current);
      hiddenTimerRef.current = null;
      start();
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.clearTimeout(hiddenTimerRef.current);
      stop();
    };
  }, [start, stop, uid]);

  useEffect(() => {
    if (!uid) return;
    states.forEach((state, groupId) => {
      if (!metas.has(groupId) || !shouldReconcileRetainedHistory(state) || reconcilingRef.current.has(groupId)) return;
      reconcilingRef.current.add(groupId);
      setReconcilingIds((current) => new Set(current).add(groupId));
      reconcileGroupChatRetainedHistory(groupId, uid)
        .catch((error) => console.warn('[Chat] Reconciliação de retenção adiada:', error?.code || error))
        .finally(() => {
          reconcilingRef.current.delete(groupId);
          setReconcilingIds((current) => {
            const next = new Set(current);
            next.delete(groupId);
            return next;
          });
        });
    });
  }, [metas, states, uid]);

  const summaries = useMemo(() => {
    const result = [];
    metas.forEach((meta, groupId) => {
      if (reconcilingIds.has(groupId)) return;
      const state = states.get(groupId);
      if (!state) return;
      const unread = calculateGroupChatUnread(meta, state);
      if (!unread) return;
      result.push({
        id: `group_chat_summary_${groupId}`,
        _type: 'operational',
        operationalKind: 'group_chat_summary',
        sourceCollection: 'virtual_group_chat',
        groupId,
        title: `${unread > 99 ? '99+' : unread} mensagens não lidas`,
        message: `Novas mensagens em ${meta.groupName || 'seu grupo de estudo'}.`,
        unreadCount: unread,
        timestamp: meta.lastMessageAt || new Date(0),
        virtual: true,
      });
    });
    return result.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }, [metas, reconcilingIds, states]);

  return {
    summaries,
    unreadCount: summaries.reduce((total, item) => total + item.unreadCount, 0),
  };
}
