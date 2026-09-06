import React, { useMemo, useEffect, useRef, useState } from 'react';
import { Loader2, AlertTriangle, Inbox } from 'lucide-react';
import { useStudySession } from '../../hooks/useStudySession.js';
import StudyCard from './StudyCard.jsx';
import ReviewControls from './ReviewControls.jsx';
import StudySessionComplete from './StudySessionComplete.jsx';
import StudySessionHeader from './StudySessionHeader.jsx';

/**
 * Componente orquestrador da sessao de estudo estilo Anki.
 *
 * @param {{
 *   userId: string,
 *   deckId: string,
 *   deckName: string,
 *   cards: import('../../contracts/flashcards.js').Card[],
 *   onBack: () => void,
 * }} props
 */
export default function StudySession({
  userId,
  deckId,
  deckName,
  folderPath,
  cards,
  totalCards,
  hasMoreCards = false,
  loadMoreCards,
  onBack,
}) {
  const {
    phase,
    currentCard,
    preview,
    sessionStats,
    error,
    pendingSyncCount,
    syncError,
    reveal,
    toggleReveal,
    setRevealState,
    submitReview,
    retryFailedSync,
    restart,
    appendCards,
    currentIndex,
    queueLength,
    activeCount,
    intradayCount,
    nextReviewLabel,
    nextIntradaySeconds,
  } = useStudySession(userId, deckId, cards);
  const [hasMore, setHasMore] = useState(hasMoreCards);
  const [loadingMore, setLoadingMore] = useState(false);
  const loadingMoreRef = useRef(false);

  useEffect(() => {
    setHasMore(hasMoreCards);
  }, [hasMoreCards]);

  useEffect(() => {
    const remaining = Math.max(0, queueLength - currentIndex - 1);
    if (!loadMoreCards || !hasMore || loadingMoreRef.current || remaining > 10) return;
    loadingMoreRef.current = true;
    setLoadingMore(true);
    void loadMoreCards().then((page) => {
      appendCards(page?.cards || []);
      setHasMore(Boolean(page?.hasMore));
    }).catch(() => {
      setHasMore(false);
    }).finally(() => {
      loadingMoreRef.current = false;
      setLoadingMore(false);
    });
  }, [appendCards, currentIndex, hasMore, loadMoreCards, queueLength]);

  // Atalhos de teclado estilo Anki (Space para revelar, 1-4 para ratings, Esc para voltar)
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Ignora se estiver digitando em campo de texto
      const tag = e.target?.tagName?.toUpperCase();
      if (tag === 'INPUT' || tag === 'TEXTAREA' || e.isComposing) return;

      if (e.key === 'Escape') {
        e.preventDefault();
        onBack();
        return;
      }

      if (phase === 'front') {
        if (e.key === ' ' || e.key === 'Enter') {
          e.preventDefault();
          reveal();
        }
      } else if (phase === 'revealed') {
        if (e.key === '1') {
          e.preventDefault();
          submitReview('again');
        } else if (e.key === '2') {
          e.preventDefault();
          submitReview('hard');
        } else if (e.key === '3') {
          e.preventDefault();
          submitReview('good');
        } else if (e.key === '4') {
          e.preventDefault();
          submitReview('easy');
        } else if (e.key === ' ' || e.key === 'Enter') {
          e.preventDefault();
          toggleReveal();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [phase, reveal, submitReview, toggleReveal, onBack]);

  const progress = useMemo(() => {
    const denominator = Math.max(1, Number(totalCards || (sessionStats.total + queueLength)));
    return Math.min(100, Math.round((sessionStats.total / denominator) * 100));
  }, [queueLength, sessionStats.total, totalCards]);

  const progressLabel = `${sessionStats.total} respondidos${activeCount > 0 ? ` · ${activeCount} na fila` : ''}${intradayCount > 0 ? ` · ${intradayCount} em espera` : ''}`;

  if (phase === 'loading') {
    return (
      <div className="flex items-center justify-center min-h-[300px]">
        <Loader2 size={32} className="animate-spin text-red-500" />
      </div>
    );
  }

  if (phase === 'empty') {
    return (
      <div className="flex flex-col items-center justify-center min-h-[300px] gap-4 text-center p-8">
        <div className="h-16 w-16 rounded-2xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center">
          <Inbox size={28} className="text-zinc-400" />
        </div>
        <h3 className="text-lg font-black text-zinc-800 dark:text-zinc-100">Nenhum card para revisar agora</h3>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          {nextReviewLabel ? `Próxima revisão: ${nextReviewLabel}.` : 'Todos os cards foram revisados ou não há cards devidos.'}
        </p>
        <button
          type="button"
          onClick={onBack}
          className="rounded-xl bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 font-bold px-6 py-3 text-sm hover:bg-red-600 hover:text-white transition-all active:scale-95 shadow-md"
        >
          Voltar ao Deck
        </button>
      </div>
    );
  }

  if (phase === 'waiting_intraday') {
    return (
      <div className="mx-auto flex flex-col gap-4 w-full max-w-3xl px-3 py-4 sm:px-5 sm:py-6">
        <StudySessionHeader
          folderPath={folderPath || deckName}
          progressLabel={progressLabel}
          onBack={onBack}
          onEnd={onBack}
        />
        <div className="flex flex-col items-center justify-center min-h-[320px] gap-4 text-center p-8 rounded-3xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-card-dark shadow-sm animate-in fade-in duration-300">
          <div className="h-16 w-16 rounded-2xl bg-red-50 dark:bg-red-950/40 flex items-center justify-center text-red-600">
            <Loader2 size={28} className="animate-spin text-red-600" />
          </div>
          <h3 className="text-lg font-black text-zinc-950 dark:text-white">
            Próxima revisão em instantes…
          </h3>
          <p className="max-w-md text-xs sm:text-sm text-zinc-500 dark:text-zinc-400">
            Você completou a fila atual. {intradayCount} card{intradayCount === 1 ? '' : 's'} com revisão recente {intradayCount === 1 ? 'estará' : 'estarão'} pronto{intradayCount === 1 ? '' : 's'} {nextIntradaySeconds ? `em ${nextIntradaySeconds}s` : 'em instantes'}.
          </p>
          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={onBack}
              className="rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-card-dark text-zinc-700 dark:text-zinc-300 font-bold px-5 py-2.5 text-xs hover:bg-zinc-100 transition"
            >
              Concluir por agora
            </button>
          </div>
        </div>
        <SyncStatus pending={pendingSyncCount} error={syncError} onRetry={retryFailedSync} />
      </div>
    );
  }

  if (phase === 'done' && loadingMore) {
    return (
      <div className="mx-auto w-full max-w-3xl px-3 py-4 sm:px-5 sm:py-6">
        <StudySessionHeader folderPath={folderPath || deckName} progressLabel={progressLabel} onBack={onBack} onEnd={onBack} />
        <div className="flex min-h-[260px] items-center justify-center gap-2 text-sm font-bold text-zinc-500">
          <Loader2 size={20} className="animate-spin text-red-500" /> Carregando o próximo lote…
        </div>
      </div>
    );
  }

  if (phase === 'done') {
    return (
      <div className="mx-auto w-full max-w-3xl px-3 py-4 sm:px-5 sm:py-6">
        <StudySessionHeader
          folderPath={folderPath || deckName}
          progressLabel={progressLabel}
          onBack={onBack}
          onEnd={onBack}
        />
        <StudySessionComplete
          stats={sessionStats}
          deckName={deckName}
          nextReviewLabel={nextReviewLabel}
          onBack={onBack}
          onRestart={activeCount > 0 && pendingSyncCount === 0 ? restart : undefined}
        />
        <SyncStatus pending={pendingSyncCount} error={syncError} onRetry={retryFailedSync} />
      </div>
    );
  }

  if (phase === 'error') {
    return (
      <div className="flex flex-col items-center justify-center min-h-[300px] gap-4 text-center p-8">
        <div className="h-16 w-16 rounded-2xl bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
          <AlertTriangle size={28} className="text-red-600" />
        </div>
        <h3 className="text-lg font-black text-zinc-800 dark:text-zinc-100">Erro na revisao</h3>
        <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        <button
          type="button"
          onClick={restart}
          className="rounded-xl bg-red-600 text-white font-bold px-6 py-3 text-sm hover:bg-red-700 transition-all active:scale-95"
        >
          Tentar novamente
        </button>
      </div>
    );
  }

  return (
    <main className="mx-auto flex flex-col gap-4 w-full max-w-3xl px-3 py-4 sm:px-5 sm:py-6">
      <StudySessionHeader
        folderPath={folderPath || deckName}
        progressLabel={progressLabel}
        onBack={onBack}
        onEnd={onBack}
      />

      {/* Barra de progresso */}
      <div className="h-1.5 w-full rounded-full bg-zinc-200 dark:bg-zinc-700 overflow-hidden">
        <div
          className="h-full rounded-full bg-red-500 transition-all duration-500"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Card com Flip Bidirecional */}
      {currentCard && (
        <StudyCard
          card={currentCard}
          revealed={phase === 'revealed'}
          onReveal={setRevealState}
          onToggleReveal={toggleReveal}
        />
      )}

      {/* Controles de avaliacao */}
      {(phase === 'revealed') && (
        <ReviewControls
          preview={preview}
          onRate={submitReview}
          disabled={false}
        />
      )}

      <SyncStatus pending={pendingSyncCount} error={syncError} onRetry={retryFailedSync} />
    </main>
  );
}

function SyncStatus({ pending, error, onRetry }) {
  if (!pending && !error) return <div className="min-h-6 text-center text-xs font-semibold text-emerald-600">Revisões sincronizadas</div>;
  if (error) return (
    <div className="flex min-h-6 items-center justify-center gap-2 text-xs font-semibold text-amber-700 dark:text-amber-300">
      <AlertTriangle size={13} /> Sincronização pendente.
      <button type="button" onClick={onRetry} className="font-black underline">Tentar novamente</button>
    </div>
  );
  return <div className="flex min-h-6 items-center justify-center gap-2 text-xs font-semibold text-zinc-400"><Loader2 size={13} className="animate-spin" /> Sincronizando {pending} revisão{pending === 1 ? '' : 'ões'}...</div>;
}
