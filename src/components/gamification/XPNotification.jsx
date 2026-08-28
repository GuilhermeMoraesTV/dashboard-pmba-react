import React, { useCallback, useEffect, useRef, useState } from 'react';
import { collection, doc, limit, onSnapshot, orderBy, query, serverTimestamp, where, writeBatch } from 'firebase/firestore';
import { AnimatePresence, motion as Motion } from 'framer-motion';
import { Trophy } from 'lucide-react';
import { db } from '../../firebaseConfig';
import { sanitizeLeagueXPEvent } from '../../config/featureFlags';
import { shouldDisplayGamificationToast } from '../../services/notificationContract';

const eventMillis = (event) => event.occurredAt?.toMillis?.() || event.createdAt?.toMillis?.() || 0;
const BULK_EVENT_THRESHOLD = 8;
const BULK_WRITE_LIMIT = 100;
const presentedStorageKey = (uid) => `modoqap:xp-presented:${uid}`;

const loadPresentedIds = (uid) => {
  try {
    const values = JSON.parse(window.sessionStorage.getItem(presentedStorageKey(uid)) || '[]');
    return new Set(Array.isArray(values) ? values.filter(Boolean).map(String) : []);
  } catch {
    return new Set();
  }
};

const persistPresentedIds = (uid, ids) => {
  try {
    window.sessionStorage.setItem(presentedStorageKey(uid), JSON.stringify([...ids].slice(-200)));
  } catch {}
};

const collapseIncomingEvents = (incoming) => {
  if (incoming.length < BULK_EVENT_THRESHOLD) return incoming;
  return [{
    id: `xp-sync-${incoming.length}-${incoming[0]?.id || 'first'}-${incoming[incoming.length - 1]?.id || 'last'}`,
    eventIds: incoming.map((item) => item.id),
    category: 'achievement',
    message: `${incoming.length.toLocaleString('pt-BR')} conquistas desbloqueadas`,
    xpTotal: incoming.reduce((total, item) => total + Math.max(0, Number(item.xpTotal || 0)), 0),
    occurredAt: incoming[incoming.length - 1]?.occurredAt || null,
  }];
};

const markEventsAsRead = async (userId, eventIds) => {
  for (let start = 0; start < eventIds.length; start += BULK_WRITE_LIMIT) {
    const batch = writeBatch(db);
    eventIds.slice(start, start + BULK_WRITE_LIMIT).forEach((eventId) => {
      batch.update(doc(db, 'users', userId, 'gamification', 'profile', 'xp_events', eventId), {
        isRead: true,
        readAt: serverTimestamp(),
      });
    });
    await batch.commit();
  }
};

const XPNotification = ({ user }) => {
  const [queue, setQueue] = useState([]);
  const [active, setActive] = useState(null);
  const [tourActive, setTourActive] = useState(false);
  const knownIdsRef = useRef(new Set());
  const tourActiveRef = useRef(false);

  const enqueueEvents = useCallback((events) => {
    const incoming = events
      .map(sanitizeLeagueXPEvent)
      .filter((item) => item?.id && item.isRead !== true && shouldDisplayGamificationToast(item))
      .sort((a, b) => eventMillis(a) - eventMillis(b) || a.id.localeCompare(b.id));
    if (!incoming.length) return [];
    const fresh = [];
    incoming.forEach((item) => {
      if (knownIdsRef.current.has(item.id)) return;
      knownIdsRef.current.add(item.id);
      fresh.push(item);
    });
    if (fresh.length) {
      persistPresentedIds(user?.uid, knownIdsRef.current);
      setQueue((current) => [...current, ...collapseIncomingEvents(fresh)]);
    }
    return fresh;
  }, [user?.uid]);

  useEffect(() => {
    const handleTour = (event) => {
      tourActiveRef.current = Boolean(event.detail);
      setTourActive(Boolean(event.detail));
    };
    window.addEventListener('tour-active', handleTour);
    return () => window.removeEventListener('tour-active', handleTour);
  }, []);

  useEffect(() => {
    knownIdsRef.current = loadPresentedIds(user?.uid);
    setQueue([]);
    setActive(null);
    if (!user?.uid) return undefined;
    const eventsRef = query(
      collection(db, 'users', user.uid, 'gamification', 'profile', 'xp_events'),
      where('isRead', '==', false),
      orderBy('occurredAt', 'desc'),
      limit(30),
    );
    const consumeSnapshot = (snapshot) => {
      const fresh = enqueueEvents(snapshot.docs.map((item) => ({ id: item.id, ...item.data() })));
      if (fresh.length) {
        void markEventsAsRead(user.uid, fresh.map((item) => item.id)).catch((error) => {
          console.error('[Gamification] Erro ao confirmar notificações recebidas:', error);
        });
      }
    };
    let stopFallback = null;
    const stopPrimary = onSnapshot(eventsRef, { includeMetadataChanges: true }, consumeSnapshot, (error) => {
      console.warn('[Gamification] Índice otimizado de XP indisponível; usando fila compatível:', error.code || error);
      stopFallback = onSnapshot(
        query(collection(db, 'users', user.uid, 'gamification', 'profile', 'xp_events'), orderBy('occurredAt', 'desc'), limit(30)),
        { includeMetadataChanges: true },
        consumeSnapshot,
        (fallbackError) => console.error('[Gamification] Erro ao carregar fila de XP:', fallbackError),
      );
    });
    return () => { stopPrimary(); stopFallback?.(); };
  }, [enqueueEvents, user?.uid]);

  useEffect(() => {
    if (active || !queue.length || tourActiveRef.current) return undefined;
    setActive(queue[0]);
    return undefined;
  }, [active, queue, tourActive]);

  useEffect(() => {
    if (!active || !user?.uid) return undefined;
    const timer = window.setTimeout(() => {
      setQueue((current) => current.filter((item) => item.id !== active.id));
      setActive(null);
    }, 4200);
    return () => window.clearTimeout(timer);
  }, [active, user?.uid]);

  return (
    <div className="pointer-events-none fixed left-1/2 top-14 z-[100005] w-[min(86vw,320px)] -translate-x-1/2 sm:top-16 sm:w-[min(92vw,380px)]">
      <AnimatePresence mode="wait">
        {active && (
          <Motion.div
            key={active.id}
            initial={{ opacity: 0, y: -22, scale: 0.94 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -12, scale: 0.97 }}
            className="flex items-center gap-2 rounded-xl border border-amber-300/50 bg-amber-50/95 px-2.5 py-1.5 text-amber-950 shadow-lg backdrop-blur-xl dark:border-amber-700/50 dark:bg-zinc-900/95 dark:text-amber-100 sm:gap-3 sm:rounded-2xl sm:px-3 sm:py-2.5 sm:shadow-2xl"
          >
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-500 text-white sm:h-10 sm:w-10 sm:rounded-xl"><Trophy size={16} className="sm:h-[19px] sm:w-[19px]"/></span>
            <span className="min-w-0 flex-1"><span className="block text-[7px] font-black uppercase tracking-[0.14em] opacity-60 sm:text-[9px] sm:tracking-[0.18em]">Conquista</span><span className="block text-[11px] font-black leading-tight sm:text-xs sm:leading-snug">{active.message || 'Nova conquista desbloqueada'}</span>{queue.length > 1 && <span className="mt-0.5 block text-[7px] font-bold uppercase tracking-wider opacity-45 sm:text-[8px]">+{queue.length - 1} na fila</span>}</span>
            {Number(active.xpTotal) > 0 && <span className="text-sm font-black text-amber-600 sm:text-lg">+{Number(active.xpTotal)}</span>}
          </Motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default XPNotification;
