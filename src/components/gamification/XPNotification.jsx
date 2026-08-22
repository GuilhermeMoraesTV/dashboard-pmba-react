import React, { useCallback, useEffect, useRef, useState } from 'react';
import { collection, doc, getDocFromServer, onSnapshot, serverTimestamp, writeBatch } from 'firebase/firestore';
import { AnimatePresence, motion } from 'framer-motion';
import { Gift, Trophy, Zap } from 'lucide-react';
import { db } from '../../firebaseConfig';
import { GAMIFICATION_SOURCE_SAVED_EVENT, getAcademicXPEventId } from '../../utils/gamificationRealtime';
import { sanitizeLeagueXPEvent } from '../../config/featureFlags';

const eventMillis = (event) => event.occurredAt?.toMillis?.() || event.createdAt?.toMillis?.() || 0;
const BULK_EVENT_THRESHOLD = 8;
const BULK_WRITE_LIMIT = 100;

const collapseIncomingEvents = (incoming) => {
  if (incoming.length < BULK_EVENT_THRESHOLD) return incoming;
  return [{
    id: `xp-sync-${incoming.length}-${incoming[0]?.id || 'first'}-${incoming[incoming.length - 1]?.id || 'last'}`,
    eventIds: incoming.map((item) => item.id),
    category: 'academic',
    message: `XP sincronizado de ${incoming.length.toLocaleString('pt-BR')} atividades`,
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
      .filter((item) => item?.id && item.isRead !== true && !knownIdsRef.current.has(item.id))
      .sort((a, b) => eventMillis(a) - eventMillis(b) || a.id.localeCompare(b.id));
    if (!incoming.length) return false;
    incoming.forEach((item) => knownIdsRef.current.add(item.id));
    setQueue((current) => [...current, ...collapseIncomingEvents(incoming)]);
    return true;
  }, []);

  useEffect(() => {
    const handleTour = (event) => {
      tourActiveRef.current = Boolean(event.detail);
      setTourActive(Boolean(event.detail));
    };
    window.addEventListener('tour-active', handleTour);
    return () => window.removeEventListener('tour-active', handleTour);
  }, []);

  useEffect(() => {
    knownIdsRef.current = new Set();
    setQueue([]);
    setActive(null);
    if (!user?.uid) return undefined;
    const eventsRef = collection(db, 'users', user.uid, 'gamification', 'profile', 'xp_events');
    return onSnapshot(eventsRef, { includeMetadataChanges: true }, (snapshot) => {
      enqueueEvents(snapshot.docs.map((item) => ({ id: item.id, ...item.data() })));
    }, (error) => console.error('[Gamification] Erro ao carregar fila de XP:', error));
  }, [enqueueEvents, user?.uid]);

  useEffect(() => {
    if (!user?.uid) return undefined;
    let disposed = false;
    const wait = (delay) => new Promise((resolve) => window.setTimeout(resolve, delay));
    const handleSourceSaved = async (event) => {
      if (event.detail?.uid !== user.uid) return;
      const eventId = getAcademicXPEventId(event.detail);
      if (!eventId) return;
      const eventRef = doc(db, 'users', user.uid, 'gamification', 'profile', 'xp_events', eventId);

      for (const delay of [0, 400, 800, 1200, 2000, 3200]) {
        if (knownIdsRef.current.has(eventId)) return;
        if (delay) await wait(delay);
        if (disposed) return;
        try {
          const snapshot = await getDocFromServer(eventRef);
          if (snapshot.exists() && enqueueEvents([{ id: snapshot.id, ...snapshot.data() }])) return;
        } catch (error) {
          if (delay === 3200) console.warn('[Gamification] Atualização direta da notificação indisponível:', error);
        }
      }
    };

    window.addEventListener(GAMIFICATION_SOURCE_SAVED_EVENT, handleSourceSaved);
    return () => {
      disposed = true;
      window.removeEventListener(GAMIFICATION_SOURCE_SAVED_EVENT, handleSourceSaved);
    };
  }, [enqueueEvents, user?.uid]);

  useEffect(() => {
    if (active || !queue.length || tourActiveRef.current) return undefined;
    setActive(queue[0]);
    return undefined;
  }, [active, queue, tourActive]);

  useEffect(() => {
    if (!active || !user?.uid) return undefined;
    const timer = window.setTimeout(() => {
      const eventIds = active.eventIds || [active.id];
      setQueue((current) => current.filter((item) => item.id !== active.id));
      setActive(null);
      void markEventsAsRead(user.uid, eventIds).catch((error) => {
        console.error('[Gamification] Erro ao confirmar notificação de XP:', error);
      });
    }, 4200);
    return () => window.clearTimeout(timer);
  }, [active, user?.uid]);

  const category = active?.category || 'academic';
  const isAchievement = category === 'achievement';
  const isReward = category === 'reward';
  const Icon = isAchievement ? Trophy : isReward ? Gift : Zap;

  return (
    <div className="pointer-events-none fixed left-1/2 top-16 z-[100005] w-[min(92vw,380px)] -translate-x-1/2">
      <AnimatePresence mode="wait">
        {active && (
          <motion.div
            key={active.id}
            initial={{ opacity: 0, y: -22, scale: 0.94 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -12, scale: 0.97 }}
            className={`flex items-center gap-3 rounded-2xl border px-3 py-2.5 shadow-2xl backdrop-blur-xl ${
              isAchievement
                ? 'border-amber-300/50 bg-amber-50/95 text-amber-950 dark:border-amber-700/50 dark:bg-zinc-900/95 dark:text-amber-100'
                : isReward
                  ? 'border-violet-300/50 bg-violet-50/95 text-violet-950 dark:border-violet-800/50 dark:bg-zinc-900/95 dark:text-violet-100'
                  : 'border-zinc-200 bg-white/95 text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900/95 dark:text-white'
            }`}
          >
            <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white ${isAchievement ? 'bg-amber-500' : isReward ? 'bg-violet-600' : 'bg-red-600'}`}><Icon size={19} fill={isAchievement || isReward ? 'none' : 'currentColor'}/></span>
            <span className="min-w-0 flex-1"><span className="block text-[9px] font-black uppercase tracking-[0.18em] opacity-60">{isAchievement ? 'Conquista' : isReward ? 'Prêmio recebido' : 'XP acadêmico'}</span><span className="block text-xs font-black leading-snug">{active.message || 'XP recebido'}</span>{queue.length > 1 && <span className="mt-0.5 block text-[8px] font-bold uppercase tracking-wider opacity-45">+{queue.length - 1} na fila</span>}</span>
            {Number(active.xpTotal) > 0 && <span className={`text-lg font-black ${isAchievement ? 'text-amber-600' : isReward ? 'text-violet-600' : 'text-red-600'}`}>+{Number(active.xpTotal)}</span>}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default XPNotification;
