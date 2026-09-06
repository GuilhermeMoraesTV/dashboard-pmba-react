/**
 * @fileoverview Hook de Sessão de Estudo com Repetição Espaçada Real (SRS estilo Anki).
 * Gerencia fila dinâmica de cards devidos, prioridade de revisões intradiárias,
 * maturação automática por timer e projeção de próxima revisão sem repetições infinitas.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getCardScheduler } from '../services/flashcards/cardScheduler.js';
import { reviewCard, shouldCreateErrorBookEntry, syncFlashcardErrorBook } from '../services/flashcards/flashcardsService.js';

function createRequestId() {
  return globalThis.crypto?.randomUUID?.() || `req_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

function wait(milliseconds) {
  return new Promise((resolve) => globalThis.setTimeout(resolve, milliseconds));
}

function toEpoch(val) {
  if (!val) return 0;
  if (val instanceof Date) return val.getTime();
  if (typeof val.toMillis === 'function') return val.toMillis();
  if (typeof val.toDate === 'function') return val.toDate().getTime();
  const parsed = new Date(val).getTime();
  return Number.isNaN(parsed) ? 0 : parsed;
}

/**
 * Formata a data/hora da próxima revisão de forma humana e amigável.
 * @param {Date | null} nextDate
 * @returns {string}
 */
export function formatNextReviewTime(nextDate) {
  if (!nextDate || !(nextDate instanceof Date) || Number.isNaN(nextDate.getTime())) {
    return 'Nenhuma revisão agendada';
  }

  const now = new Date();
  const diffMs = nextDate.getTime() - now.getTime();
  const diffMinutes = Math.round(diffMs / 60000);

  if (diffMinutes <= 0) return 'Agora';
  if (diffMinutes < 60) return `em ${diffMinutes} minuto${diffMinutes === 1 ? '' : 's'}`;

  const sameDay = now.getFullYear() === nextDate.getFullYear()
    && now.getMonth() === nextDate.getMonth()
    && now.getDate() === nextDate.getDate();

  const timeString = nextDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

  if (sameDay) {
    return `hoje às ${timeString}`;
  }

  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const isTomorrow = tomorrow.getFullYear() === nextDate.getFullYear()
    && tomorrow.getMonth() === nextDate.getMonth()
    && tomorrow.getDate() === nextDate.getDate();

  if (isTomorrow) {
    return `amanhã às ${timeString}`;
  }

  return `em ${nextDate.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })} às ${timeString}`;
}

/**
 * Separa os cards iniciais entre disponíveis para estudo agora (devidos e novos)
 * e cards futuros (agendados para mais tarde).
 */
export function partitionInitialCards(cards) {
  if (!Array.isArray(cards) || !cards.length) {
    return { dueCards: [], newCards: [], futureCards: [] };
  }

  const nowMs = Date.now();
  const dueCards = [];
  const newCards = [];
  const futureCards = [];

  for (const card of cards) {
    if (!card?.id) continue;
    const isNew = card.status === 'new' || !card.schedulerState;
    const dueMs = toEpoch(card.dueAt);

    if (isNew) {
      newCards.push(card);
    } else if (dueMs <= nowMs) {
      dueCards.push(card);
    } else {
      futureCards.push(card);
    }
  }

  // Ordena devidos por data de vencimento mais antiga primeiro
  dueCards.sort((a, b) => toEpoch(a.dueAt) - toEpoch(b.dueAt));
  // Ordena novos por data de criação
  newCards.sort((a, b) => toEpoch(a.createdAt) - toEpoch(b.createdAt));

  return { dueCards, newCards, futureCards };
}

export function useStudySession(userId, deckId, initialCards) {
  // Inicialização categorizada
  const partition = useMemo(() => partitionInitialCards(initialCards), [initialCards]);

  // Fila ativa (cards que serão estudados na ordem: devidos -> novos)
  const [activeQueue, setActiveQueue] = useState(() => [...partition.dueCards, ...partition.newCards]);

  // Fila de cards respondidos na sessão que vencerão durante a própria sessão (intradiários)
  const [intradayQueue, setIntradayQueue] = useState([]);

  // Cards já graduados para dias futuros nesta sessão
  const [graduatedCards, setGraduatedCards] = useState([]);

  // Cards que vieram na carga inicial mas já estavam agendados para o futuro
  const [futureCards, setFutureCards] = useState(() => partition.futureCards);

  // Fase da interface: 'front' | 'revealed' | 'waiting_intraday' | 'empty' | 'done'
  const [phase, setPhase] = useState(() => {
    if (partition.dueCards.length > 0 || partition.newCards.length > 0) return 'front';
    return 'empty';
  });

  const [sessionStats, setSessionStats] = useState({ again: 0, hard: 0, good: 0, easy: 0, total: 0 });
  const [pendingSyncCount, setPendingSyncCount] = useState(0);
  const [syncError, setSyncError] = useState(null);

  const taskQueueRef = useRef([]);
  const processingRef = useRef(false);
  const clickGuardRef = useRef(false);

  // O card atual é sempre o primeiro da fila ativa
  const currentCard = activeQueue[0] || null;

  // Projeção prévia SM-2 para o card atual
  const preview = useMemo(() => {
    if (!currentCard) return null;
    try {
      const scheduler = getCardScheduler('sm2');
      const state = currentCard.schedulerState || scheduler.createInitialState();
      return scheduler.preview(state);
    } catch {
      return null;
    }
  }, [currentCard]);

  // Cálculo da próxima revisão mais próxima entre todos os cards conhecidos
  const earliestNextReview = useMemo(() => {
    const allFutureDates = [];

    // Intradiários pendentes
    for (const item of intradayQueue) {
      if (item.dueAt) allFutureDates.push(item.dueAt instanceof Date ? item.dueAt : new Date(item.dueAt));
    }
    // Graduados na sessão
    for (const card of graduatedCards) {
      if (card.dueAt) allFutureDates.push(card.dueAt instanceof Date ? card.dueAt : new Date(card.dueAt));
    }
    // Cards futuros da carga inicial
    for (const card of futureCards) {
      if (card.dueAt) allFutureDates.push(card.dueAt instanceof Date ? card.dueAt : new Date(card.dueAt));
    }

    const validDates = allFutureDates.filter((d) => d instanceof Date && !Number.isNaN(d.getTime()) && d.getTime() > Date.now());
    if (!validDates.length) return null;

    validDates.sort((a, b) => a.getTime() - b.getTime());
    return validDates[0];
  }, [futureCards, graduatedCards, intradayQueue]);

  const nextReviewLabel = useMemo(() => formatNextReviewTime(earliestNextReview), [earliestNextReview]);

  const [countdownNowMs, setCountdownNowMs] = useState(() => Date.now());

  // Controles de revelação
  const reveal = useCallback(() => {
    if (phase === 'front') setPhase('revealed');
  }, [phase]);

  const toggleReveal = useCallback(() => {
    setPhase((p) => (p === 'front' ? 'revealed' : p === 'revealed' ? 'front' : p));
  }, []);

  const setRevealState = useCallback((isRevealed) => {
    setPhase(isRevealed ? 'revealed' : 'front');
  }, []);

  // Promove cards intradiários cuja data de vencimento (dueAt) já chegou
  const promoteMaturedCards = useCallback(() => {
    const nowMs = Date.now();
    setIntradayQueue((prevIntraday) => {
      if (!prevIntraday.length) return prevIntraday;

      const matured = [];
      const remaining = [];

      for (const item of prevIntraday) {
        const dueMs = toEpoch(item.dueAt);
        if (dueMs <= nowMs) {
          matured.push(item.card);
        } else {
          remaining.push(item);
        }
      }

      if (matured.length > 0) {
        setActiveQueue((prevActive) => {
          const activeIds = new Set(prevActive.map((c) => c.id));
          const newMatured = matured.filter((c) => !activeIds.has(c.id));
          if (!newMatured.length) return prevActive;

          // Insere revisões vencidas com PRIORIDADE MÁXIMA sobre cards novos
          if (prevActive.length === 0) {
            return newMatured;
          }

          // Se o usuário está lendo o card [0], preserva ele e organiza o restante:
          // [cardAtual, ...outrosDevidos, ...novosMaturados, ...cardsNovos]
          const current = prevActive[0];
          const rest = prevActive.slice(1);
          const restDue = rest.filter((c) => c.status !== 'new');
          const restNew = rest.filter((c) => c.status === 'new');

          return [current, ...restDue, ...newMatured, ...restNew];
        });

        // Se a sessão estava aguardando intradiário ou vazia, reativa imediatamente
        setPhase((currentPhase) => {
          if (currentPhase === 'waiting_intraday' || currentPhase === 'empty' || currentPhase === 'done') {
            return 'front';
          }
          return currentPhase;
        });
      }

      return remaining;
    });
  }, []);

  // 1. Agendamento pontual: setTimeout para o exato momento de maturação do próximo card intradiário
  useEffect(() => {
    if (!intradayQueue.length) return undefined;

    const nowMs = Date.now();
    const sorted = [...intradayQueue].sort((a, b) => toEpoch(a.dueAt) - toEpoch(b.dueAt));
    const earliestDue = toEpoch(sorted[0]?.dueAt);
    const delayMs = Math.max(50, earliestDue - nowMs);

    const timerId = setTimeout(() => {
      promoteMaturedCards();
    }, delayMs);

    return () => clearTimeout(timerId);
  }, [intradayQueue, promoteMaturedCards]);

  // 2. Revalidação em eventos de ciclo de vida (retorno de aba suspensa, foco, reconexão de rede)
  useEffect(() => {
    const handleRevalidate = () => {
      promoteMaturedCards();
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        promoteMaturedCards();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleRevalidate);
    window.addEventListener('online', handleRevalidate);
    window.addEventListener('pageshow', handleRevalidate);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleRevalidate);
      window.removeEventListener('online', handleRevalidate);
      window.removeEventListener('pageshow', handleRevalidate);
    };
  }, [promoteMaturedCards]);

  // 3. Atualização do contador visual (somente enquanto estiver na tela 'waiting_intraday')
  useEffect(() => {
    if (phase !== 'waiting_intraday' || !intradayQueue.length) return undefined;
    const interval = setInterval(() => {
      setCountdownNowMs(Date.now());
    }, 1000);
    return () => clearInterval(interval);
  }, [phase, intradayQueue.length]);

  // Tempo restante em segundos para o próximo card intradiário
  const nextIntradaySeconds = useMemo(() => {
    if (!intradayQueue.length) return null;
    const sorted = [...intradayQueue].sort((a, b) => toEpoch(a.dueAt) - toEpoch(b.dueAt));
    const earliestMs = toEpoch(sorted[0].dueAt);
    return Math.max(1, Math.round((earliestMs - countdownNowMs) / 1000));
  }, [intradayQueue, countdownNowMs]);

  // Fila de sincronização atômica em background
  const drainQueue = useCallback(async () => {
    if (processingRef.current) return;
    processingRef.current = true;
    try {
      while (taskQueueRef.current.length) {
        const task = taskQueueRef.current[0];
        let result = null;
        let failure = null;

        for (let attempt = 0; attempt < 2; attempt += 1) {
          try {
            result = await reviewCard(userId, task.deckId, task.card.id, task.rating, {
              expectedReviewVersion: Number(task.card.reviewVersion || 0),
              expectedSchedulerState: task.card.schedulerState,
              reviewRequestId: task.reviewRequestId,
              elapsedTimeMs: task.elapsedTimeMs,
            });
            failure = null;
            break;
          } catch (error) {
            failure = error;
            if (attempt === 0) await wait(250);
          }
        }

        if (failure || !result) {
          setSyncError(failure?.message || 'Não foi possível sincronizar uma revisão.');
          break;
        }

        taskQueueRef.current.shift();
        setPendingSyncCount(taskQueueRef.current.length);
        setSyncError(null);

        // Atualiza referências locais do card sincronizado
        setActiveQueue((cards) => cards.map((c) => (c.id === task.card.id ? result.card : c)));
        setIntradayQueue((items) => items.map((i) => (i.card.id === task.card.id ? { ...i, card: result.card } : i)));

        if (shouldCreateErrorBookEntry(task.rating, result.isLapse) && result.review?.id) {
          void syncFlashcardErrorBook(userId, {
            deckId: task.deckId,
            cardId: result.card.id,
            reviewId: result.review.id,
          }).catch(() => {});
        }
      }
    } finally {
      processingRef.current = false;
    }
  }, [userId]);

  // Submissão de avaliação de card (Again / Hard / Good / Easy)
  const submitReview = useCallback((rating) => {
    if (!currentCard || phase !== 'revealed' || clickGuardRef.current) return Promise.resolve();
    clickGuardRef.current = true;

    const targetDeckId = currentCard.deckId || deckId;
    const now = new Date();
    const scheduler = getCardScheduler('sm2');
    const state = currentCard.schedulerState || scheduler.createInitialState();

    let outcome;
    try {
      outcome = scheduler.schedule(state, rating, { now });
    } catch {
      outcome = {
        nextState: state,
        intervalMinutes: 1,
        intervalDays: 1 / 1440,
        dueAt: new Date(now.getTime() + 60000),
        isLapse: rating === 'again',
        status: rating === 'again' ? 'relearning' : 'learning',
      };
    }

    const updatedCard = {
      ...currentCard,
      schedulerState: outcome.nextState,
      status: outcome.status,
      dueAt: outcome.dueAt,
      lapses: outcome.isLapse ? Number(currentCard.lapses || 0) + 1 : Number(currentCard.lapses || 0),
      reps: outcome.isLapse ? 0 : Number(currentCard.reps || 0) + 1,
      reviewVersion: Number(currentCard.reviewVersion || 0) + 1,
      updatedAt: now,
    };

    taskQueueRef.current.push({
      card: currentCard,
      deckId: targetDeckId,
      rating,
      reviewRequestId: createRequestId(),
      elapsedTimeMs: null,
    });

    setPendingSyncCount(taskQueueRef.current.length);
    setSessionStats((previous) => ({
      ...previous,
      [rating]: Number(previous[rating] || 0) + 1,
      total: previous.total + 1,
    }));

    // Remove o card avaliado da fila ativa imediatamente
    const nextActive = activeQueue.slice(1);
    setActiveQueue(nextActive);

    // Verifica se a próxima revisão é intradiária (< 24 horas ou fase learning/relearning)
    const isIntraday = (outcome.intervalMinutes != null && outcome.intervalMinutes < 24 * 60)
      || outcome.status === 'learning' || outcome.status === 'relearning';

    if (isIntraday) {
      setIntradayQueue((prev) => [...prev, { card: updatedCard, dueAt: outcome.dueAt, rating, addedAt: now }]);
    } else {
      setGraduatedCards((prev) => [...prev, updatedCard]);
    }

    // Transição de estado para o próximo card ou estado de espera/conclusão
    if (nextActive.length > 0) {
      setPhase('front');
    } else if (isIntraday || intradayQueue.length > 0) {
      setPhase('waiting_intraday');
    } else {
      setPhase('done');
    }

    queueMicrotask(() => {
      clickGuardRef.current = false;
      void drainQueue();
    });

    return Promise.resolve();
  }, [activeQueue, currentCard, deckId, drainQueue, intradayQueue.length, phase]);

  const retryFailedSync = useCallback(() => {
    setSyncError(null);
    void drainQueue();
  }, [drainQueue]);

  // Adição dinâmica de novos cards (ex: paginação assíncrona)
  const appendCards = useCallback((nextCards) => {
    if (!Array.isArray(nextCards) || nextCards.length === 0) return;

    const { dueCards: nextDue, newCards: nextNew, futureCards: nextFuture } = partitionInitialCards(nextCards);

    setFutureCards((prev) => {
      const seen = new Set(prev.map((c) => c.id));
      const additions = nextFuture.filter((c) => !seen.has(c.id));
      return additions.length ? [...prev, ...additions] : prev;
    });

    setActiveQueue((current) => {
      const seen = new Set(current.map((card) => `${card.deckId || deckId}:${card.id}`));
      const eligible = [...nextDue, ...nextNew].filter((card) => {
        const key = `${card.deckId || deckId}:${card.id}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });

      if (!eligible.length) return current;

      if (phase === 'done' || phase === 'waiting_intraday' || phase === 'empty' || current.length === 0) {
        setPhase('front');
      }

      return [...current, ...eligible];
    });
  }, [deckId, phase]);

  // Reinício seguro: somente reinicia se houver cards devidos agora (nunca força cards futuros)
  const restart = useCallback(() => {
    if (taskQueueRef.current.length) return;
    const repartition = partitionInitialCards(initialCards);
    const availableNow = [...repartition.dueCards, ...repartition.newCards];

    setActiveQueue(availableNow);
    setIntradayQueue([]);
    setGraduatedCards([]);
    setFutureCards(repartition.futureCards);
    setPhase(!availableNow.length ? 'empty' : 'front');
    setSessionStats({ again: 0, hard: 0, good: 0, easy: 0, total: 0 });
    setSyncError(null);
  }, [initialCards]);

  return {
    phase,
    currentCard,
    preview,
    sessionStats,
    error: null,
    pendingSyncCount,
    syncError,
    reveal,
    toggleReveal,
    setRevealState,
    submitReview,
    retryFailedSync,
    restart: activeQueue.length > 0 ? restart : undefined,
    appendCards,
    currentIndex: sessionStats.total,
    queueLength: activeQueue.length + intradayQueue.length,
    activeCount: activeQueue.length,
    intradayCount: intradayQueue.length,
    graduatedCount: graduatedCards.length,
    earliestNextReview,
    nextReviewLabel,
    nextIntradaySeconds,
  };
}
