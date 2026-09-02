import React, { useState } from 'react';
import { ArrowLeft, Plus, BookOpen, Pencil, Trash2, Loader2 } from 'lucide-react';
import { useCards } from '../../hooks/useCards.js';
import FlashcardEditor from './FlashcardEditor.jsx';
import StudySession from './StudySession.jsx';
import { getDueCards, getNewCards } from '../../services/flashcards/flashcardsService.js';
import { DEFAULT_PRODUCT_LIMITS } from '../../config/productLimits.js';

/**
 * Detalhe de um Deck: lista de cards e acao de estudo.
 * @param {{
 *   userId: string,
 *   deck: import('../../contracts/flashcards.js').Deck,
 *   onBack: () => void,
 * }} props
 */
export default function DeckDetails({ userId, deck, onBack }) {
  const { cards, loading, error, create, update, remove } = useCards(userId, deck.id);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingCard, setEditingCard] = useState(null);
  const [studying, setStudying] = useState(false);
  const [studyCards, setStudyCards] = useState([]);
  const [loadingStudy, setLoadingStudy] = useState(false);

  const handleCreate = async (data) => { await create({ ...data, folderId: deck.folderId }); };
  const handleUpdate = async (data) => { await update(editingCard.id, data); setEditingCard(null); };
  const handleDelete = async (cardId) => { await remove(cardId); };

  const startStudy = async () => {
    setLoadingStudy(true);
    try {
      const limits = DEFAULT_PRODUCT_LIMITS.flashcards;
      const [due, newCards] = await Promise.all([
        getDueCards(userId, deck.id, { limit: limits.defaultMaxReviewsPerDay }),
        getNewCards(userId, deck.id, { limit: limits.defaultNewCardsPerDay }),
      ]);
      // Combina devidos + novos (evitando duplicatas)
      const dueIds = new Set(due.map((c) => c.id));
      const combined = [...due, ...newCards.filter((c) => !dueIds.has(c.id))];
      setStudyCards(combined);
      setStudying(true);
    } catch (err) {
      console.error('[DeckDetails] Erro ao carregar cards para estudo:', err);
    } finally {
      setLoadingStudy(false);
    }
  };

  if (studying) {
    return (
      <StudySession
        userId={userId}
        deckId={deck.id}
        deckName={deck.name}
        cards={studyCards}
        onBack={() => setStudying(false)}
      />
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1.5 text-sm font-bold text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200 transition-colors"
        >
          <ArrowLeft size={16} strokeWidth={2.5} />
          Voltar
        </button>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setEditorOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 font-bold text-xs px-3 py-2 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
          >
            <Plus size={14} strokeWidth={2.5} />
            Novo Card
          </button>

          <button
            type="button"
            onClick={startStudy}
            disabled={loadingStudy || deck.cardCount === 0}
            className="inline-flex items-center gap-1.5 rounded-xl bg-red-600 text-white font-bold text-xs px-3 py-2 hover:bg-red-700 transition-all shadow-md shadow-red-600/20 disabled:opacity-50 disabled:cursor-not-allowed active:scale-95"
          >
            {loadingStudy ? <Loader2 size={13} className="animate-spin" /> : <BookOpen size={13} strokeWidth={2.5} />}
            Estudar
          </button>
        </div>
      </div>

      <div>
        <h2 className="text-lg font-black text-zinc-900 dark:text-white">{deck.name}</h2>
        {deck.description && <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">{deck.description}</p>}
      </div>

      {/* Lista de cards */}
      {loading && (
        <div className="flex items-center justify-center min-h-[150px]">
          <Loader2 size={24} className="animate-spin text-red-500" />
        </div>
      )}

      {!loading && error && (
        <div className="rounded-xl bg-red-50 dark:bg-red-900/30 p-4 text-sm text-red-700 dark:text-red-400">{error}</div>
      )}

      {!loading && !error && cards.length === 0 && (
        <div className="rounded-2xl border-2 border-dashed border-zinc-200 dark:border-zinc-700 p-12 text-center flex flex-col items-center gap-3">
          <p className="text-sm font-semibold text-zinc-500 dark:text-zinc-400">Nenhum card neste baralho</p>
          <button type="button" onClick={() => setEditorOpen(true)} className="inline-flex items-center gap-1.5 rounded-xl bg-red-600 text-white font-bold text-xs px-4 py-2.5 hover:bg-red-700 transition-all">
            <Plus size={13} strokeWidth={2.5} /> Criar primeiro card
          </button>
        </div>
      )}

      {!loading && cards.length > 0 && (
        <div className="flex flex-col gap-2">
          {cards.map((card) => (
            <div key={card.id} className="flex items-start gap-3 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-4 hover:shadow-sm transition-all">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-zinc-800 dark:text-zinc-100 line-clamp-1">{card.front}</p>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 line-clamp-1">{card.back}</p>
                {card.tags?.length > 0 && (
                  <div className="flex gap-1 mt-2">
                    {card.tags.slice(0, 3).map((t) => (
                      <span key={t} className="text-[10px] rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 px-2 py-0.5 font-medium">{t}</span>
                    ))}
                  </div>
                )}
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                <button type="button" onClick={() => { setEditingCard(card); }} className="rounded-lg p-1.5 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors">
                  <Pencil size={13} strokeWidth={2.5} />
                </button>
                <button type="button" onClick={() => handleDelete(card.id)} className="rounded-lg p-1.5 text-zinc-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors">
                  <Trash2 size={13} strokeWidth={2.5} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modais */}
      <FlashcardEditor
        isOpen={editorOpen}
        onClose={() => setEditorOpen(false)}
        onSave={handleCreate}
        mode="create"
      />
      <FlashcardEditor
        isOpen={!!editingCard}
        onClose={() => setEditingCard(null)}
        onSave={handleUpdate}
        initialData={editingCard || {}}
        mode="edit"
      />
    </div>
  );
}
