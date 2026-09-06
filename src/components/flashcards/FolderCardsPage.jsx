import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, ArrowUpRight, Eye, Folder, Layers, Loader2, Pencil, Search, Trash2 } from 'lucide-react';
import { getFolderStudyCardsPage, updateCard, deleteCard } from '../../services/flashcards/flashcardsService.js';
import { resolveAnkiMediaHtml } from '../../services/anki/ankiMedia.js';
import { getDescendantFolderIds, getBreadcrumbs } from '../../utils/folderHierarchy.js';
import { sanitizeFlashcardHtml } from '../../utils/sanitizeHtml.js';
import FlashcardEditor from './FlashcardEditor.jsx';
import { ConfirmDeleteModal, CustomFolderSelect, FlashcardsDialog } from './FlashcardsModals.jsx';
const readableError = (error) => error?.message || 'Não foi possível carregar os flashcards.';

function CardContent({ html, className }) {
  const [resolved, setResolved] = useState(() => sanitizeFlashcardHtml(html));
  useEffect(() => {
    let active = true;
    setResolved(sanitizeFlashcardHtml(html));
    resolveAnkiMediaHtml(html).then((content) => { if (active) setResolved(content); });
    return () => { active = false; };
  }, [html]);
  return <div className={className} dangerouslySetInnerHTML={{ __html: resolved }} />;
}

function questionPreview(html) {
  const template = document.createElement('template');
  template.innerHTML = sanitizeFlashcardHtml(String(html || '').replace(/\{\{c\d+::([\s\S]*?)(?:::(.*?))?\}\}/g, '[…]'));
  return template.content.textContent.replace(/\s+/g, ' ').trim() || 'Pergunta com imagem ou mídia. Clique para visualizar.';
}

function CardDetails({ card, onClose, onEdit, onDelete }) {
  const contentRef = useRef(null);
  useEffect(() => {
    const previousFocus = document.activeElement;
    const dialog = contentRef.current?.closest('[role="dialog"]');
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    dialog?.querySelector('button')?.focus();
    const handleKey = (event) => {
      if (event.key === 'Escape') { event.preventDefault(); onClose(); }
      if (event.key !== 'Tab') return;
      const controls = [...dialog.querySelectorAll('button, a[href], input, textarea, select, [tabindex="0"]')].filter((element) => !element.disabled);
      const first = controls[0]; const last = controls.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    document.addEventListener('keydown', handleKey);
    return () => { document.removeEventListener('keydown', handleKey); document.body.style.overflow = previousOverflow; previousFocus?.focus(); };
  }, [onClose]);
  return <FlashcardsDialog title="Visualizar flashcard" eyebrow="Seu material de estudo" onClose={onClose} maxWidth="max-w-3xl" dialogClassName="flashcards-detail-dialog" bodyClassName="flex min-h-0 flex-col">
    <div ref={contentRef} className="min-h-0 flex-1 space-y-5 overflow-y-auto pr-1">
      {[['Frente · Pergunta', card.front], ['Verso · Resposta', card.back]].map(([title, html]) => <section key={title} className="rounded-xl border border-zinc-200 bg-zinc-50/60 p-4 dark:border-zinc-800 dark:bg-zinc-900/40">
        <h3 className="mb-3 text-xs font-black uppercase tracking-wider text-red-600 dark:text-red-400">{title}</h3>
        <CardContent html={String(html || '')} className="flashcards-detail-content text-base leading-relaxed text-zinc-800 dark:text-zinc-100" />
      </section>)}
      {card.tags?.length > 0 && <p className="break-words text-xs text-zinc-500">{card.tags.map((tag) => `#${tag}`).join(' · ')}</p>}
    </div>
    <div className="mt-4 flex shrink-0 flex-wrap justify-end gap-2 border-t border-zinc-200 pt-3 dark:border-zinc-800">
      <button type="button" onClick={onDelete} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-zinc-200 px-4 text-sm font-bold text-red-600 dark:border-zinc-700 dark:text-red-400"><Trash2 size={16} /> Excluir</button>
      <button type="button" onClick={onEdit} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-red-600 px-4 text-sm font-bold text-white hover:bg-red-700"><Pencil size={16} /> Editar flashcard</button>
    </div>
  </FlashcardsDialog>;
}

/**
 * Página de Gerenciamento e Listagem de Flashcards da Pasta e Subpastas
 * Permite visualizar, buscar, paginar, editar e excluir cards.
 */
export default function FolderCardsPage({
  userId,
  folder,
  folders = [],
  decks = [],
  onBack,
  onRefresh,
}) {
  const [cards, setCards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [editingCard, setEditingCard] = useState(null);
  const [deletingCard, setDeletingCard] = useState(null);
  const [deletingBusy, setDeletingBusy] = useState(false);
  const [error, setError] = useState(null);
  const [deckId, setDeckId] = useState('');
  const [selectedFolderId, setSelectedFolderId] = useState(folder.id);
  const [viewingCard, setViewingCard] = useState(null);
  const closeDetails = useCallback(() => setViewingCard(null), []);
  const generationRef = useRef(0);
  const loadingMoreRef = useRef(false);

  const cursorRef = useRef(null);
  const familyIds = useMemo(() => getDescendantFolderIds(selectedFolderId, folders), [selectedFolderId, folders]);
  const folderNameById = useMemo(() => {
    const map = new Map(folders.map((f) => [f.id, f.name]));
    return map;
  }, [folders]);


  const loadCards = useCallback(async () => {
    const generation = ++generationRef.current;
    setLoading(true);
    setCards([]);
    setHasMore(false);
    cursorRef.current = null;
    setError(null);
    try {
      const page = await getFolderStudyCardsPage(userId, familyIds, { deckId });
      if (generation !== generationRef.current) return;
      setCards(page.cards || []);
      cursorRef.current = page.cursor || null;
      setHasMore(Boolean(page.hasMore));
    } catch (err) {
      if (generation === generationRef.current) setError(readableError(err));
    } finally {
      if (generation === generationRef.current) setLoading(false);
    }
  }, [deckId, familyIds, userId]);

  useEffect(() => {
    loadCards();
    return () => { generationRef.current += 1; };
  }, [loadCards]);

  const handleLoadMore = async () => {
    if (!hasMore || loadingMoreRef.current || !cursorRef.current) return;
    loadingMoreRef.current = true;
    const generation = generationRef.current;
    setLoadingMore(true);
    try {
      const page = await getFolderStudyCardsPage(userId, familyIds, {
        deckId,
        cursor: cursorRef.current,
      });
      if (generation !== generationRef.current) return;
      setCards((prev) => [...new Map([...prev, ...(page.cards || [])].map((card) => [`${card.deckId}/${card.id}`, card])).values()]);
      cursorRef.current = page.cursor || null;
      setHasMore(Boolean(page.hasMore));
    } catch (err) {
      if (generation === generationRef.current) setError(readableError(err));
    } finally {
      loadingMoreRef.current = false;
      setLoadingMore(false);
    }
  };

  const activeFolder = folders.find((item) => item.id === selectedFolderId) || folder;
  const availableDecks = decks.filter((deck) => familyIds.includes(deck.folderId));
  const deckOptions = [{ id: '', name: 'Todos os baralhos', color: activeFolder.color }, ...availableDecks.map((deck) => ({ id: deck.id, name: deck.name || deck.title || 'Baralho', color: activeFolder.color }))];

  const handleSaveEdit = async (updatedData) => {
    if (!editingCard) return;
    await updateCard(userId, editingCard.deckId, editingCard.id, updatedData);
    setCards((prev) =>
      prev.map((c) => (c.id === editingCard.id && c.deckId === editingCard.deckId ? { ...c, ...updatedData } : c)),
    );
    setViewingCard((current) => current?.id === editingCard.id && current?.deckId === editingCard.deckId ? { ...current, ...updatedData } : current);
    setEditingCard(null);
    onRefresh?.();
  };

  const handleConfirmDelete = async () => {
    if (!deletingCard) return;
    setDeletingBusy(true);
    try {
      await deleteCard(userId, deletingCard.deckId, deletingCard.id);
      setCards((prev) => prev.filter((c) => !(c.id === deletingCard.id && c.deckId === deletingCard.deckId)));
      setDeletingCard(null);
      setViewingCard(null);
      onRefresh?.();
    } catch (err) {
      setError(readableError(err));
    } finally {
      setDeletingBusy(false);
    }
  };

  const filteredCards = useMemo(() => {
    if (!searchTerm.trim()) return cards;
    const term = searchTerm.toLowerCase();
    return cards.filter((c) =>
      String(c.front || '').toLowerCase().includes(term) ||
      String(c.back || '').toLowerCase().includes(term) ||
      (Array.isArray(c.tags) && c.tags.some((t) => String(t).toLowerCase().includes(term)))
    );
  }, [cards, searchTerm]);

  return (
    <>
      <main className="flashcards-manager-page mx-auto w-full min-w-0 max-w-7xl px-3 py-4 sm:px-5 sm:py-6">
        <header className="mb-4 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-card-dark sm:p-5">
          <div className="flex min-w-0 flex-1 items-start gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-red-500/10 text-red-600 dark:text-red-400"><Layers size={23} /></span>
            <div className="min-w-0">
              <p className="text-[11px] font-black uppercase tracking-wider text-red-600 dark:text-red-400">Sua biblioteca de flashcards</p>
              <h1 className="mt-1 break-words text-xl font-black text-zinc-950 dark:text-white sm:text-2xl">{activeFolder.name}</h1>
              <p className="mt-1 truncate text-xs text-zinc-500 dark:text-zinc-400">{getBreadcrumbs(selectedFolderId, folders).map((item) => item.name).join(' / ')}</p>
            </div>
          </div>
          <button type="button" onClick={onBack} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-zinc-200 bg-zinc-50 px-4 text-xs font-bold text-zinc-600 hover:border-red-300 hover:text-red-600 dark:border-zinc-700 dark:bg-zinc-900/50 dark:text-zinc-300"><ArrowLeft size={16} /> Voltar às pastas</button>
        </header>
        <div className="space-y-4">
          <div className="flashcards-gallery-filters relative z-10 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-card-dark">
            <div className="min-w-0 space-y-2">
              <p className="text-[11px] font-black uppercase tracking-wider text-zinc-500">Pasta ou subpasta</p>
              <CustomFolderSelect folders={folders} selectedFolderId={selectedFolderId} onSelectFolder={(id) => { setSelectedFolderId(id); setDeckId(''); }} />
            </div>
            {availableDecks.length > 1 && <div className="min-w-0 space-y-2">
              <p className="text-[11px] font-black uppercase tracking-wider text-zinc-500">Baralho</p>
              <CustomFolderSelect folders={deckOptions} selectedFolderId={deckId} onSelectFolder={setDeckId} searchPlaceholder="Buscar baralho..." />
            </div>}
            <div className="min-w-0 space-y-2">
              <p className="text-[11px] font-black uppercase tracking-wider text-zinc-500">Buscar flashcard</p>
          {/* Barra de Busca */}
          <div className="flex min-h-11 items-center gap-2 rounded-xl border border-zinc-200 bg-white px-3 focus-within:border-red-500 dark:border-zinc-700 dark:bg-card-dark">
            <Search size={18} className="shrink-0 text-zinc-400" />
            <input
              type="text"
              aria-label="Buscar nos flashcards carregados" placeholder="Buscar nos flashcards carregados..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="!min-h-11 min-w-0 w-full !border-0 !bg-transparent !px-0 !text-[16px] text-zinc-900 outline-none !shadow-none dark:text-zinc-100"
            />
          </div>

            </div>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-zinc-500 dark:text-zinc-400">
            <span>{filteredCards.length}{hasMore ? '+' : ''} flashcards · Inclui subpastas</span>
            <span>Clique em uma pergunta para ver o flashcard completo</span>
          </div>

          {error && (
            <div className="rounded-xl bg-red-500/10 border border-red-500/20 p-3 text-xs font-semibold text-red-700 dark:text-red-300">
              {error}
              <button type="button" onClick={loadCards} className="ml-3 underline">Tentar novamente</button>
            </div>
          )}

          {/* Lista de Cards com Scroll */}
          <div className="flashcards-gallery-grid">
            {loading ? (
              <div className="col-span-full flex min-h-40 items-center justify-center">
                <Loader2 size={24} className="animate-spin text-red-600" />
              </div>
            ) : filteredCards.length === 0 ? (
              <div className="col-span-full rounded-2xl border border-dashed border-zinc-200 p-8 text-center dark:border-zinc-800">
                <Eye size={28} className="mx-auto text-zinc-300" />
                <p className="mt-2 text-xs font-bold text-zinc-600 dark:text-zinc-400">
                  {searchTerm ? 'Nenhum card corresponde à busca.' : 'Nenhum flashcard encontrado nesta pasta.'}
                </p>
              </div>
            ) : (
              filteredCards.map((card, index) => (
                <button key={`${card.deckId}/${card.id}`} type="button" onClick={() => setViewingCard(card)} aria-label={`Abrir flashcard ${index + 1}`} className="flashcards-gallery-card group rounded-2xl border border-zinc-200 bg-white p-4 text-left shadow-sm transition hover:border-red-300 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 dark:border-zinc-800 dark:bg-card-dark dark:hover:border-red-800">
                  <span className="flex min-w-0 items-center gap-2 text-[11px] font-semibold text-zinc-500 dark:text-zinc-400"><Folder size={14} className="shrink-0 text-red-500" /><span className="truncate">{folderNameById.get(card.folderId) || activeFolder.name}</span></span>
                  <span className="text-[10px] font-black uppercase tracking-wider text-red-600 dark:text-red-400">Pergunta</span>
                  <span className="flashcards-question-preview text-sm font-bold leading-relaxed text-zinc-800 dark:text-zinc-100">{questionPreview(card.front)}</span>
                  <span className="mt-auto flex items-center justify-between border-t border-zinc-100 pt-3 text-xs font-bold text-zinc-400 group-hover:text-red-600 dark:border-zinc-800 dark:group-hover:text-red-400">Ver flashcard <ArrowUpRight size={16} /></span>
                </button>
              ))
            )}

            {hasMore && !loading && (
              <div className="col-span-full pt-2 text-center">
                <button
                  type="button"
                  onClick={handleLoadMore}
                  disabled={loadingMore}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-zinc-200 px-4 py-2 text-xs font-bold text-zinc-700 hover:bg-zinc-100 dark:border-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-800 transition disabled:opacity-50"
                >
                  {loadingMore ? <Loader2 size={13} className="animate-spin" /> : null}
                  Carregar mais flashcards
                </button>
              </div>
            )}
          </div>
        </div>
      </main>

      {viewingCard && !editingCard && !deletingCard && <CardDetails card={viewingCard} onClose={closeDetails} onEdit={() => setEditingCard(viewingCard)} onDelete={() => { setError(null); setDeletingCard(viewingCard); }} />}

      {/* Modal de Edição */}
      {editingCard && (
        <FlashcardEditor
          isOpen={Boolean(editingCard)}
          mode="edit"
          initialData={editingCard}
          onClose={() => setEditingCard(null)}
          onSave={handleSaveEdit}
        />
      )}

      {/* Modal de Exclusão */}
      {deletingCard && (
        <ConfirmDeleteModal
          title="Excluir Flashcard"
          message={
            <span>
              Tem certeza de que deseja excluir este flashcard permanentemente? Esta ação não pode ser desfeita.
              {error && <span role="alert" className="mt-2 block text-red-600">{error}</span>}
            </span>
          }
          confirmLabel="Excluir Flashcard"
          busy={deletingBusy}
          onClose={() => setDeletingCard(null)}
          onConfirm={handleConfirmDelete}
        />
      )}
    </>
  );
}

