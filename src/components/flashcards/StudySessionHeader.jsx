import React from 'react';
import { ArrowLeft, Square } from 'lucide-react';

/**
 * Cabeçalho compartilhado por todas as experiências de estudo com flashcards.
 */
export default function StudySessionHeader({ folderPath, progressLabel, onBack, onEnd }) {
  return (
    <header className="flex items-center justify-between gap-3">
      <button
        type="button"
        onClick={onBack}
        className="inline-flex min-w-0 items-center gap-2 text-sm font-bold text-zinc-500 transition-colors hover:text-zinc-900 dark:hover:text-white"
      >
        <ArrowLeft size={17} className="shrink-0" />
        <span className="hidden sm:inline">Voltar para pasta</span>
        <span className="sm:hidden">Voltar</span>
      </button>
      <div className="min-w-0 flex-1 text-center">
        <p className="truncate text-xs font-bold text-zinc-700 dark:text-zinc-200" title={folderPath}>
          {folderPath}
        </p>
        {progressLabel ? <p className="text-[11px] font-semibold text-zinc-400">{progressLabel}</p> : null}
      </div>
      <button
        type="button"
        onClick={onEnd || onBack}
        className="inline-flex shrink-0 items-center gap-2 rounded-xl border border-zinc-200 px-3 py-2 text-xs font-bold text-zinc-600 transition hover:border-red-300 hover:text-red-600 dark:border-zinc-800 dark:text-zinc-300"
      >
        <Square size={13} />
        <span className="hidden sm:inline">Encerrar estudo</span>
        <span className="sm:hidden">Encerrar</span>
      </button>
    </header>
  );
}
