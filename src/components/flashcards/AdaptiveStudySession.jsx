import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, ArrowLeft, BrainCircuit, Loader2, Sparkles, Square } from 'lucide-react';
import StudyCard from './StudyCard.jsx';
import ReviewControls from './ReviewControls.jsx';
import { getCardScheduler } from '../../services/flashcards/cardScheduler.js';
import { sanitizeFlashcardHtml } from '../../utils/sanitizeHtml.js';
import {
  createReviewRequestId,
  endAdaptiveFlashcardSession,
  rateAdaptiveFlashcard,
  refillAdaptiveFlashcardSession,
  startAdaptiveFlashcardSession,
} from '../../services/adaptiveStudy/adaptiveStudyService.js';

const LOADING_STEPS = [
  'Analisando sua fonte de estudo',
  'Identificando os principais conceitos',
  'Preparando seu roteiro adaptativo',
];

function stripInternalRefTokens(text) {
  return String(text || '')
    .replace(/\[\s*REF\s+[^\]]+\]/gi, '')
    .replace(/\bREF\s+[A-Za-z0-9_:-]+\b/gi, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function readableError(error) {
  const details = typeof error?.details === 'string' ? error.details : (error?.details?.message || '');
  const message = error?.message || error?.code || 'Não foi possível continuar o estudo.';
  return String(details ? `${message} (${details})` : message).replace(/^FirebaseError:\s*/i, '').slice(0, 400);
}

function mergeItems(current, incoming, displayedId = '') {
  const byId = new Map();
  for (const candidate of [...(current || []), ...(incoming || [])]) {
    if (candidate?.id && candidate.id !== displayedId) byId.set(candidate.id, candidate);
  }
  return [...byId.values()];
}

export default function AdaptiveStudySession({ folder, source, onExit }) {
  const [session, setSession] = useState(null);
  const [item, setItem] = useState(null);
  const [prefetchedItems, setPrefetchedItems] = useState([]);
  const [revealed, setRevealed] = useState(false);
  const [loadingStep, setLoadingStep] = useState(0);
  const [refilling, setRefilling] = useState(false);
  const [ending, setEnding] = useState(false);
  const [fatalError, setFatalError] = useState(null);
  const [syncError, setSyncError] = useState(null);
  const [pendingSyncCount, setPendingSyncCount] = useState(0);
  const [answered, setAnswered] = useState(0);

  const shownAtRef = useRef(Date.now());
  const aliveRef = useRef(true);
  const sessionIdRef = useRef(null);
  const itemRef = useRef(null);
  const reviewQueueRef = useRef([]);
  const processingRef = useRef(false);
  const refillRef = useRef(false);
  const startedRef = useRef(false);

  const showItem = useCallback((nextItem) => {
    itemRef.current = nextItem || null;
    setItem(nextItem || null);
    setRevealed(false);
    shownAtRef.current = Date.now();
  }, []);

  const mergePrefetched = useCallback((incoming) => {
    setPrefetchedItems((current) => mergeItems(current, incoming, itemRef.current?.id));
  }, []);

  const prepareMore = useCallback(async (sessionId) => {
    if (!sessionId || refillRef.current) return null;
    refillRef.current = true;
    setRefilling(true);
    try {
      const result = await refillAdaptiveFlashcardSession(sessionId);
      if (!aliveRef.current) return null;
      mergePrefetched(result.prefetchedItems);

      // Apenas atribuir se NÃO houver nenhum card sendo exibido no momento
      if (!itemRef.current) {
        if (result.item) {
          showItem(result.item);
        } else if (result.prefetchedItems?.length) {
          const next = result.prefetchedItems[0];
          setPrefetchedItems((current) => current.filter((cand) => cand.id !== next.id));
          showItem(next);
        }
      }
      return result.item || null;
    } catch (failure) {
      console.warn('[AdaptiveStudySession] Refill em background:', failure);
      return null;
    } finally {
      refillRef.current = false;
      if (aliveRef.current) setRefilling(false);
    }
  }, [mergePrefetched, showItem]);

  const drainReviewQueue = useCallback(async () => {
    if (processingRef.current) return;
    processingRef.current = true;
    try {
      while (aliveRef.current && reviewQueueRef.current.length > 0) {
        const task = reviewQueueRef.current[0];
        let result = null;
        let lastFailure = null;
        for (let attempt = 0; attempt < 2; attempt += 1) {
          try {
            result = await rateAdaptiveFlashcard(task);
            break;
          } catch (failure) {
            lastFailure = failure;
          }
        }
        if (!result) {
          setSyncError(readableError(lastFailure));
          break;
        }
        reviewQueueRef.current.shift();
        setPendingSyncCount(reviewQueueRef.current.length);
        setSyncError(null);

        if (!aliveRef.current) break;

        if (!itemRef.current) {
          if (result.nextItem) {
            showItem(result.nextItem);
          } else if (result.prefetchedItems?.length) {
            const next = result.prefetchedItems[0];
            setPrefetchedItems((current) => current.filter((cand) => cand.id !== next.id));
            showItem(next);
          }
        }
        mergePrefetched(result.prefetchedItems);

        // Sempre repor o buffer se estiver abaixo da meta de 4
        if (result.shouldRefill || prefetchedItems.length < 3) {
          void prepareMore(task.sessionId);
        }
      }
    } finally {
      processingRef.current = false;
    }
  }, [mergePrefetched, prefetchedItems.length, prepareMore, showItem]);

  const sessionStartedRef = useRef(false);

  useEffect(() => {
    if (sessionStartedRef.current) return;
    sessionStartedRef.current = true;
    aliveRef.current = true;

    const interval = window.setInterval(() => {
      setLoadingStep((current) => Math.min(current + 1, LOADING_STEPS.length - 1));
    }, 1000);

    startAdaptiveFlashcardSession({ folderId: folder.id, sourceId: source.id })
      .then((result) => {
        console.log('[AdaptiveStudySession started]:', { session: result?.session?.id, item: result?.item?.id, front: result?.item?.front });
        sessionIdRef.current = result.session.id;
        setSession(result.session);
        showItem(result.item);
        mergePrefetched(result.prefetchedItems);
      })
      .catch((failure) => {
        setFatalError(readableError(failure));
      })
      .finally(() => window.clearInterval(interval));

    return () => {
      window.clearInterval(interval);
    };
  }, [folder.id, mergePrefetched, showItem, source.id]);

  useEffect(() => {
    return () => {
      aliveRef.current = false;
      if (sessionIdRef.current) {
        void endAdaptiveFlashcardSession(sessionIdRef.current).catch(() => {});
      }
    };
  }, []);

  const rate = useCallback((rating) => {
    const currentItem = itemRef.current;
    if (!session?.id || !currentItem?.id) return;
    const elapsedTimeMs = Math.max(0, Date.now() - shownAtRef.current);

    // Pop do próximo item do buffer instantaneamente
    const nextItem = prefetchedItems[0] || null;
    setPrefetchedItems((current) => current.slice(1));
    showItem(nextItem);
    setAnswered((value) => value + 1);
    setSyncError(null);

    reviewQueueRef.current.push({
      sessionId: session.id,
      itemId: currentItem.id,
      rating,
      reviewRequestId: createReviewRequestId(),
      elapsedTimeMs,
    });
    setPendingSyncCount(reviewQueueRef.current.length);
    queueMicrotask(() => void drainReviewQueue());

    // Disparar reposição do buffer imediatamente após cada consumo para manter em 4
    void prepareMore(session.id);
  }, [drainReviewQueue, prefetchedItems, prepareMore, session?.id, showItem]);

  const retryFailedSync = useCallback(() => {
    setSyncError(null);
    void drainReviewQueue();
  }, [drainReviewQueue]);

  // Item 11: Resposta Imediata ao Encerrar Estudo
  const handleExit = useCallback(() => {
    if (ending) return;
    setEnding(true);
    const sid = sessionIdRef.current || session?.id;
    if (sid) {
      void endAdaptiveFlashcardSession(sid).catch(() => {});
      sessionIdRef.current = null;
    }
    onExit();
  }, [ending, onExit, session?.id]);

  useEffect(() => {
    const onKeyDown = (event) => {
      const tag = event.target?.tagName?.toUpperCase();
      if (tag === 'INPUT' || tag === 'TEXTAREA' || event.isComposing) return;
      if (event.key === 'Escape') {
        event.preventDefault();
        handleExit();
      }
      if (!itemRef.current) return;
      if (!revealed && (event.key === ' ' || event.key === 'Enter')) {
        event.preventDefault();
        setRevealed(true);
      } else if (revealed && (event.key === ' ' || event.key === 'Enter')) {
        event.preventDefault();
        setRevealed(false); // Permite desvirar via espaço
      }
      if (revealed && ['1', '2', '3', '4'].includes(event.key)) {
        event.preventDefault();
        rate(['again', 'hard', 'good', 'easy'][Number(event.key) - 1]);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handleExit, rate, revealed]);

  const defaultPreview = useMemo(() => {
    try {
      const scheduler = getCardScheduler('sm2');
      return scheduler.preview(scheduler.createInitialState());
    } catch {
      return {
        again: { intervalMinutes: 1, intervalDays: 0 },
        hard: { intervalMinutes: 6, intervalDays: 0 },
        good: { intervalMinutes: 10, intervalDays: 0 },
        easy: { intervalDays: 3, intervalMinutes: 0 },
      };
    }
  }, []);

  const safeItemFront = sanitizeFlashcardHtml(stripInternalRefTokens(item?.front || ''));
  const safeItemBack = sanitizeFlashcardHtml(stripInternalRefTokens(item?.back || ''));

  // Estado Inicial de Carregamento
  if (!session && !fatalError) {
    return (
      <main className="mx-auto flex min-h-[68vh] w-full max-w-3xl flex-col items-center justify-center px-4 text-center">
        <div className="relative flex h-20 w-20 items-center justify-center rounded-3xl bg-red-600 text-white shadow-xl shadow-red-600/20">
          <BrainCircuit size={36} />
          <span className="absolute inset-0 animate-ping rounded-3xl bg-red-500/20" />
        </div>
        <p className="mt-7 text-xs font-black uppercase tracking-[0.2em] text-red-600 dark:text-red-400">
          Tutor Adaptativo
        </p>
        <h1 className="mt-2 text-2xl font-black text-slate-950 dark:text-white">
          {LOADING_STEPS[loadingStep]}
        </h1>
        <p className="mt-2 max-w-md text-sm text-slate-500 dark:text-slate-400">
          Usando exclusivamente “{source.title}” para preparar conceitos e evidências.
        </p>
        <div className="mt-6 flex gap-2">
          {LOADING_STEPS.map((step, index) => (
            <span
              key={step}
              className={`h-1.5 rounded-full transition-all ${
                index <= loadingStep ? 'w-10 bg-red-600' : 'w-5 bg-slate-200 dark:bg-slate-800'
              }`}
            />
          ))}
        </div>
      </main>
    );
  }

  // Falha Crítica ao Iniciar
  if (fatalError && !session) {
    return (
      <main className="mx-auto flex min-h-[55vh] w-full max-w-xl flex-col items-center justify-center px-4 text-center">
        <BrainCircuit size={40} className="text-red-600" />
        <h1 className="mt-4 text-xl font-black text-slate-950 dark:text-white">
          Não foi possível iniciar o estudo
        </h1>
        <p className="mt-2 text-sm text-red-700 dark:text-red-300">{fatalError}</p>
        <button
          type="button"
          onClick={handleExit}
          className="mt-5 rounded-xl bg-slate-900 px-5 py-3 text-sm font-bold text-white shadow-md hover:bg-slate-800 dark:bg-white dark:text-slate-900"
        >
          Voltar para a pasta
        </button>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-3xl px-3 py-4 sm:px-5 sm:py-6">
      {/* Header da Sessão */}
      <header className="mb-5 flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={handleExit}
          className="inline-flex items-center gap-2 text-sm font-bold text-slate-500 hover:text-slate-900 dark:hover:text-white"
        >
          <ArrowLeft size={17} /> {folder.name}
        </button>
        <div className="flex items-center gap-3">
          <span className="hidden text-xs font-semibold text-slate-400 sm:block">
            {answered} respondidos
          </span>
          <button
            type="button"
            onClick={handleExit}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-600 transition hover:border-red-300 hover:text-red-600 dark:border-slate-800 dark:text-slate-300"
          >
            <Square size={13} /> Encerrar estudo
          </button>
        </div>
      </header>

      {/* Item 9: Estado Gracioso quando Buffer Chega a Zero (Sem Erro Técnico) */}
      {!item ? (
        <section className="flex min-h-[380px] flex-col items-center justify-center rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="relative flex h-14 w-14 items-center justify-center rounded-2xl bg-red-50 text-red-600 dark:bg-red-950/40">
            <Loader2 size={28} className="animate-spin text-red-600" />
          </div>
          <h2 className="mt-4 text-lg font-black text-slate-950 dark:text-white">
            Preparando o próximo flashcard...
          </h2>
          <p className="mt-1.5 max-w-sm text-xs text-slate-500 dark:text-slate-400">
            O Tutor Adaptativo está formulando uma pergunta com base no seu desempenho.
          </p>
        </section>
      ) : (
        <>
          {/* Badge de Conceito e Dificuldade */}
          <div className="mb-3 flex items-center justify-between gap-3 text-xs">
            <span className="inline-flex items-center gap-1.5 font-bold text-slate-600 dark:text-slate-300">
              <BrainCircuit size={14} className="text-red-600" /> {item.conceptName}
            </span>
            <span
              className={`rounded-full px-2.5 py-1 font-black uppercase tracking-wider ${
                item.cognitiveDifficulty === 'hard'
                  ? 'bg-violet-500/10 text-violet-700 dark:text-violet-300'
                  : 'bg-sky-500/10 text-sky-700 dark:text-sky-300'
              }`}
            >
              {item.cognitiveDifficulty === 'hard' ? 'Desafio' : 'Fundamento'}
            </span>
          </div>

          {/* Card com Flip Bidirecional */}
          <StudyCard
            card={{ front: safeItemFront, back: safeItemBack }}
            revealed={revealed}
            onReveal={(isRev) => setRevealed(typeof isRev === 'boolean' ? isRev : true)}
            onToggleReveal={() => setRevealed((v) => !v)}
          />

          {/* Controles de Avaliação SM-2 */}
          {revealed ? (
            <div className="mt-6">
              <ReviewControls
                preview={session?.reviewPreview || defaultPreview}
                onRate={rate}
                disabled={false}
              />
            </div>
          ) : null}
        </>
      )}

      {/* Rodapé de Status do Buffer */}
      <div className="mt-4 flex min-h-6 items-center justify-center gap-2 text-xs font-semibold text-slate-400">
        {syncError ? (
          <>
            <AlertTriangle size={13} className="text-amber-600" />
            <span className="text-amber-700 dark:text-amber-300">Sincronizando em segundo plano...</span>
          </>
        ) : pendingSyncCount > 0 ? (
          <>
            <Loader2 size={13} className="animate-spin" />
            <span>Sincronizando {pendingSyncCount} revisão{pendingSyncCount === 1 ? '' : 'ões'}...</span>
          </>
        ) : refilling ? (
          <>
            <Loader2 size={13} className="animate-spin text-red-600" />
            <span>IA recompondo o buffer de flashcards...</span>
          </>
        ) : (
          <>
            <Sparkles size={13} className="text-red-500" />
            <span>{prefetchedItems.length} próximo{prefetchedItems.length === 1 ? '' : 's'} pronto{prefetchedItems.length === 1 ? '' : 's'}</span>
          </>
        )}
      </div>
    </main>
  );
}
