import React, { useState } from 'react';
import { BookOpen, Pencil, Archive, ChevronRight, Layers } from 'lucide-react';

/**
 * Card visual de um Deck na listagem.
 * Mostra nome, descricao, tags, contadores e acoes.
 *
 * @param {{
 *   deck: import('../../contracts/flashcards.js').Deck & { archived?: boolean },
 *   onStudy: () => void,
 *   onEdit: () => void,
 *   onArchive: () => void,
 * }} props
 */
export default function DeckCard({ deck, onStudy, onEdit, onArchive }) {
  const [confirmArchive, setConfirmArchive] = useState(false);

  const handleArchive = () => {
    if (!confirmArchive) { setConfirmArchive(true); return; }
    onArchive();
  };

  return (
    <div className="group relative flex flex-col rounded-2xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 shadow-sm hover:shadow-md transition-all duration-200 overflow-hidden">
      {/* Accent line */}
      <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-red-500 to-rose-400" />

      <div className="flex-1 p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-red-600/10 dark:bg-red-500/15">
              <Layers size={20} className="text-red-600 dark:text-red-400" />
            </div>
            <div>
              <h3 className="text-sm font-black text-zinc-900 dark:text-white leading-tight">{deck.name}</h3>
              {deck.description && (
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5 line-clamp-1">{deck.description}</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <span className="text-xs font-black text-zinc-500 dark:text-zinc-400">
              {deck.cardCount} {deck.cardCount === 1 ? 'card' : 'cards'}
            </span>
          </div>
        </div>

        {deck.tags && deck.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-3">
            {deck.tags.slice(0, 4).map((tag) => (
              <span key={tag} className="text-[10px] font-semibold rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 px-2 py-0.5">
                {tag}
              </span>
            ))}
            {deck.tags.length > 4 && (
              <span className="text-[10px] font-semibold text-zinc-400">+{deck.tags.length - 4}</span>
            )}
          </div>
        )}
      </div>

      {/* Acoes */}
      <div className="flex items-center gap-1 px-4 py-3 border-t border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-800/30">
        <button
          type="button"
          onClick={onStudy}
          disabled={deck.cardCount === 0}
          className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl bg-red-600 text-white font-bold text-[11px] uppercase tracking-wider px-3 py-2 hover:bg-red-700 transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <BookOpen size={13} strokeWidth={2.5} />
          Estudar
          <ChevronRight size={12} strokeWidth={3} />
        </button>

        <button
          type="button"
          onClick={onEdit}
          className="rounded-xl p-2 text-zinc-500 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700 hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors"
          title="Editar deck"
        >
          <Pencil size={14} strokeWidth={2.5} />
        </button>

        <button
          type="button"
          onClick={handleArchive}
          onBlur={() => setConfirmArchive(false)}
          className={`rounded-xl p-2 transition-colors ${confirmArchive ? 'bg-red-100 dark:bg-red-900/40 text-red-600' : 'text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700 hover:text-zinc-600'}`}
          title={confirmArchive ? 'Clique novamente para confirmar' : 'Arquivar deck'}
        >
          <Archive size={14} strokeWidth={2.5} />
        </button>
      </div>
    </div>
  );
}
