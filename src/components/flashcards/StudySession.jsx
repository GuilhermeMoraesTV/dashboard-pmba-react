import React, { useMemo, useEffect } from 'react';
import { Loader2, AlertTriangle, Inbox } from 'lucide-react';
import { useStudySession } from '../../hooks/useStudySession.js';
import StudyCard from './StudyCard.jsx';
import ReviewControls from './ReviewControls.jsx';
import StudySessionComplete from './StudySessionComplete.jsx';

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
export default function StudySession({ userId, deckId, deckName, cards, onBack }) {
  const {
    phase,
    currentCard,
    preview,
    sessionStats,
    error,
    pendingSyncCount,
    syncError,
    reveal,
    submitReview,
    retryFailedSync,
    restart,
  } = useStudySession(userId, deckId, cards);

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
          // Espaço na resposta avalia como "good" (progressão padrão estilo Anki)
          e.preventDefault();
          submitReview('good');
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [phase, reveal, submitReview, onBack]);

  const progress = useMemo(() => {
    if (!cards?.length) return 0;
    return Math.round((sessionStats.total / cards.length) * 100);
  }, [sessionStats.total, cards?.length]);

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
        <h3 className="text-lg font-black text-zinc-800 dark:text-zinc-100">Nenhum card para revisar</h3>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">Todos os cards foram revisados ou nao ha cards devidos.</p>
        <button
          type="button"
          onClick={onBack}
          className="rounded-xl bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 font-bold px-6 py-3 text-sm hover:bg-red-600 hover:text-white transition-all active:scale-95"
        >
          Voltar ao Deck
        </button>
      </div>
    );
  }

  if (phase === 'done') {
    return (
      <div>
        <StudySessionComplete
          stats={sessionStats}
          deckName={deckName}
          onBack={onBack}
          onRestart={cards?.length > 0 && pendingSyncCount === 0 ? restart : undefined}
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
    <div className="flex flex-col gap-4 w-full max-w-2xl mx-auto">
      {/* Header com progresso */}
      <div className="flex items-center justify-between text-xs font-semibold text-zinc-500 dark:text-zinc-400">
        <span>{deckName}</span>
        <span>{sessionStats.total}/{cards?.length || 0}</span>
      </div>

      {/* Barra de progresso */}
      <div className="h-1.5 w-full rounded-full bg-zinc-200 dark:bg-zinc-700 overflow-hidden">
        <div
          className="h-full rounded-full bg-red-500 transition-all duration-500"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Card */}
      {currentCard && (
        <StudyCard
          card={currentCard}
          revealed={phase === 'revealed'}
          onReveal={reveal}
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
    </div>
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
