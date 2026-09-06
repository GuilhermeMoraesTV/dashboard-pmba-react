import React, { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { AlertTriangle, BrainCircuit, Loader2, Sparkles } from 'lucide-react';
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
import StudySessionHeader from './StudySessionHeader.jsx';
import { auth } from '../../firebaseConfig.js';
import { createAdaptiveSessionController } from '../../services/adaptiveStudy/adaptiveSessionController.js';

// Retain the same in-flight outbox across StrictMode and real route remounts.
const controllers = new Map();
const api = { start: startAdaptiveFlashcardSession, rate: rateAdaptiveFlashcard,
  refill: refillAdaptiveFlashcardSession, end: endAdaptiveFlashcardSession, createRequestId: createReviewRequestId };
function getController(userId, folderId, sourceId) {
  const key = `adaptive-outbox:v1:${auth.app?.options?.projectId}:${userId}:${folderId}:${sourceId}`;
  let controller = controllers.get(key);
  if (!controller || controller.getSnapshot().ended) {
    controller = createAdaptiveSessionController({ api, folderId, sourceId, storage: window.sessionStorage, storageKey: key });
    controllers.set(key, controller);
  }
  return controller;
}

const LOADING_STEPS = [
  'Lendo fonte',
  'Identificando conceitos',
  'Preparando flashcards',
  'Quase pronto',
];

function stripInternalRefTokens(text) {
  return String(text || '')
    .replace(/\[\s*REF\s+[^\]]+\]/gi, '')
    .replace(/\bREF\s+[A-Za-z0-9_:-]+\b/gi, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

export default function AdaptiveStudySession({ folder, source, onExit }) {
  const userId = auth.currentUser?.uid;
  const controller = useMemo(() => getController(userId, folder.id, source.id), [userId, folder.id, source.id]);
  const { session, item, prefetchedItems, refilling, ending, fatalError, syncError,
    bufferError, pendingSyncCount, answered, closingRequested } = useSyncExternalStore(controller.subscribe, controller.getSnapshot);
  const [revealedItemId, setRevealedItemId] = useState(null);
  const revealed = Boolean(item && revealedItemId === item.id);
  const setRevealed = useCallback((value) => {
    setRevealedItemId((current) => {
      const next = typeof value === 'function' ? value(current === item?.id) : value;
      return next ? item?.id : null;
    });
  }, [item?.id]);

  useEffect(() => {
    void controller.start();
    // Unsubscribing the view must never cancel delivery of accepted ratings.
    const beforeUnload = (event) => {
      if (!controller.getSnapshot().pendingSyncCount) return;
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', beforeUnload);
    return () => window.removeEventListener('beforeunload', beforeUnload);
  }, [controller]);

  const rate = useCallback((rating) => {
    if (controller.rate(rating, item?.id)) setRevealedItemId(null);
  }, [controller, item?.id]);
  const handleExit = useCallback(async () => {
    if (controller.getSnapshot().ending) return;
    if (await controller.end()) onExit();
  }, [controller, onExit]);
  const retryFailedSync = useCallback(() => {
    if (controller.getSnapshot().closingRequested) void handleExit();
    else void controller.drain();
  }, [controller, handleExit]);

  useEffect(() => {
    const onKeyDown = (event) => {
      const tag = event.target?.tagName?.toUpperCase();
      if (tag === 'INPUT' || tag === 'TEXTAREA' || event.isComposing) return;
      if (event.key === 'Escape') {
        event.preventDefault();
        handleExit();
      }
      if (!item || ending) return;
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
  }, [ending, handleExit, item, rate, revealed, setRevealed]);

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
      <main className="relative mx-auto flex min-h-[68vh] w-full max-w-3xl flex-col items-center justify-center px-4 text-center">
        <div className="absolute top-4 w-full max-w-3xl px-4 text-left">
          <StudySessionHeader
            folderPath={folder.path || folder.name}
            progressLabel="Preparando a sessão"
            onBack={handleExit}
            onEnd={handleExit}
          />
        </div>
        <div className="relative flex h-20 w-20 items-center justify-center rounded-3xl bg-red-600 text-white shadow-xl shadow-red-600/20">
          <BrainCircuit size={36} />
          <span className="absolute inset-0 animate-ping rounded-3xl bg-red-500/20" />
        </div>
        <p className="mt-7 text-xs font-black uppercase tracking-[0.2em] text-red-600 dark:text-red-400">
          Tutor Adaptativo
        </p>
        <h1 className="mt-2 text-2xl font-black text-zinc-950 dark:text-white">Preparando seu estudo...</h1>
        <p className="mt-2 max-w-md text-sm text-zinc-500 dark:text-zinc-400">
          Lendo “{source.title}”, identificando conceitos e preparando os primeiros flashcards.
        </p>
        <div className="mt-6 h-1.5 w-full max-w-sm overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800">
          <span className="block h-full w-2/5 animate-pulse rounded-full bg-red-600" />
        </div>
        <div className="mt-4 flex max-w-lg flex-wrap justify-center gap-2">
          {LOADING_STEPS.map((step) => (
            <span key={step} className="rounded-full bg-zinc-100 px-3 py-1 text-[11px] font-bold text-zinc-500 dark:bg-zinc-800 dark:text-zinc-300">
              {step}
            </span>
          ))}
        </div>
      </main>
    );
  }

  // Falha Crítica ao Iniciar
  if (fatalError && !session) {
    return (
      <main className="relative mx-auto flex min-h-[55vh] w-full max-w-3xl flex-col items-center justify-center px-4 text-center">
        <div className="absolute top-4 w-full max-w-3xl px-4 text-left">
          <StudySessionHeader
            folderPath={folder.path || folder.name}
            progressLabel="Falha ao preparar a sessão"
            onBack={handleExit}
            onEnd={handleExit}
          />
        </div>
        <BrainCircuit size={40} className="text-red-600" />
        <h1 className="mt-4 text-xl font-black text-zinc-950 dark:text-white">
          Não foi possível iniciar o estudo
        </h1>
        <p className="mt-2 text-sm text-red-700 dark:text-red-300">{fatalError}</p>
        <button
          type="button"
          onClick={handleExit}
          className="mt-5 rounded-xl bg-zinc-900 px-5 py-3 text-sm font-bold text-white shadow-md hover:bg-zinc-800 dark:bg-white dark:text-zinc-900"
        >
          Voltar para a pasta
        </button>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-3xl px-3 py-4 sm:px-5 sm:py-6">
      <div className="mb-5">
        <StudySessionHeader
          folderPath={folder.path || folder.name}
          progressLabel={ending ? 'Salvando respostas e encerrando...' : closingRequested ? 'Encerramento pendente — tente encerrar novamente' : `${answered} respondidos · sessão contínua`}
          onBack={handleExit}
          onEnd={handleExit}
        />
      </div>

      {/* Item 9: Estado Gracioso quando Buffer Chega a Zero (Sem Erro Técnico) */}
      {!item ? (
        <section className="flex min-h-[380px] flex-col items-center justify-center rounded-3xl border border-zinc-200 bg-white p-8 text-center shadow-sm dark:border-zinc-800 dark:bg-card-dark">
          <div className="relative flex h-14 w-14 items-center justify-center rounded-2xl bg-red-50 text-red-600 dark:bg-red-950/40">
            {refilling || pendingSyncCount > 0 || ending ? <Loader2 size={28} className="animate-spin text-red-600" /> : <AlertTriangle size={28} />}
          </div>
          <h2 className="mt-4 text-lg font-black text-zinc-950 dark:text-white">
            {ending ? 'Salvando respostas...' : syncError || bufferError ? 'Estudo aguardando sua ação' : 'Preparando o próximo flashcard...'}
          </h2>
          <p className="mt-1.5 max-w-sm text-xs text-zinc-500 dark:text-zinc-400">
            {bufferError || (pendingSyncCount > 0 ? 'Aguardando a confirmação das suas respostas.' : 'O Tutor Adaptativo está formulando uma pergunta com base no seu desempenho.')}
          </p>
          {bufferError && !pendingSyncCount && !ending ? (
            <button type="button" disabled={refilling} onClick={() => void controller.refill()} className="mt-4 font-bold text-red-600 underline">
              Tentar continuar
            </button>
          ) : null}
        </section>
      ) : (
        <>
          {/* Badge de Conceito e Dificuldade */}
          <div className="mb-3 flex items-center justify-between gap-3 text-xs">
            <span className="inline-flex items-center gap-1.5 font-bold text-zinc-600 dark:text-zinc-300">
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
                disabled={closingRequested || Boolean(pendingSyncCount && syncError)}
              />
            </div>
          ) : null}
        </>
      )}

      {/* Rodapé de Status do Buffer */}
      <div className="mt-4 flex min-h-6 items-center justify-center gap-2 text-xs font-semibold text-zinc-400">
        {syncError ? (
          <>
            <AlertTriangle size={13} className="text-amber-600" />
            <span className="text-amber-700 dark:text-amber-300">{syncError}</span>
            <button type="button" onClick={retryFailedSync} className="font-black text-amber-700 underline dark:text-amber-300">
              Tentar novamente
            </button>
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
