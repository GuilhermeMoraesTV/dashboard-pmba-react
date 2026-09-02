/** @fileoverview Sessao manual com avanço otimista e revisoes idempotentes em background. */
import { useCallback, useMemo, useRef, useState } from 'react';
import { getCardScheduler } from '../services/flashcards/cardScheduler.js';
import { reviewCard, shouldCreateErrorBookEntry, syncFlashcardErrorBook } from '../services/flashcards/flashcardsService.js';

function createRequestId() {
  return globalThis.crypto?.randomUUID?.() || `req_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

function wait(milliseconds) {
  return new Promise((resolve) => globalThis.setTimeout(resolve, milliseconds));
}

export function useStudySession(userId, deckId, initialCards) {
  const [queue, setQueue] = useState(() => [...(initialCards || [])]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [phase, setPhase] = useState(!initialCards?.length ? 'empty' : 'front');
  const [sessionStats, setSessionStats] = useState({ again: 0, hard: 0, good: 0, easy: 0, total: 0 });
  const [pendingSyncCount, setPendingSyncCount] = useState(0);
  const [syncError, setSyncError] = useState(null);
  const taskQueueRef = useRef([]);
  const processingRef = useRef(false);
  const clickGuardRef = useRef(false);

  const currentCard = queue[currentIndex] || null;
  const preview = useMemo(() => {
    if (!currentCard?.schedulerState) return null;
    try { return getCardScheduler('sm2').preview(currentCard.schedulerState); } catch { return null; }
  }, [currentCard]);

  const reveal = useCallback(() => {
    if (phase === 'front') setPhase('revealed');
  }, [phase]);

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
          setSyncError(failure?.message || 'Nao foi possivel sincronizar uma revisao.');
          break;
        }

        taskQueueRef.current.shift();
        setPendingSyncCount(taskQueueRef.current.length);
        setSyncError(null);
        setQueue((cards) => cards.map((card) => (card.id === task.card.id ? result.card : card)));
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

  const submitReview = useCallback((rating) => {
    if (!currentCard || phase !== 'revealed' || clickGuardRef.current) return Promise.resolve();
    clickGuardRef.current = true;
    const targetDeckId = currentCard.deckId || deckId;
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
    const nextIndex = currentIndex + 1;
    if (nextIndex >= queue.length) setPhase('done');
    else {
      setCurrentIndex(nextIndex);
      setPhase('front');
    }
    queueMicrotask(() => {
      clickGuardRef.current = false;
      void drainQueue();
    });
    return Promise.resolve();
  }, [currentCard, currentIndex, deckId, drainQueue, phase, queue.length]);

  const retryFailedSync = useCallback(() => {
    setSyncError(null);
    void drainQueue();
  }, [drainQueue]);

  const restart = useCallback(() => {
    if (taskQueueRef.current.length) return;
    setQueue([...(initialCards || [])]);
    setCurrentIndex(0);
    setPhase(!initialCards?.length ? 'empty' : 'front');
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
    submitReview,
    retryFailedSync,
    restart,
  };
}
