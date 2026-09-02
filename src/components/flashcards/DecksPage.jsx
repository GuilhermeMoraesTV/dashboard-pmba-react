import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  BookOpen,
  CheckCircle2,
  ChevronRight,
  Edit2,
  FileArchive,
  FileText,
  Folder,
  FolderPlus,
  Layers,
  LayoutGrid,
  ListTree,
  Loader2,
  NotebookPen,
  Pencil,
  Plus,
  Sparkles,
  Trash2,
} from 'lucide-react';
import { useDecks } from '../../hooks/useDecks.js';
import {
  deleteStudySource,
  ensureLegacyStudyFolder,
  subscribeStudyFolders,
  subscribeStudySources,
} from '../../services/studySources/studySourcesService.js';
import { getDueCards, getFolderStudyCards } from '../../services/flashcards/flashcardsService.js';
import AdaptiveStudySession from './AdaptiveStudySession.jsx';
import StudySession from './StudySession.jsx';
import { AddSourceModal, SourceStatus } from './StudySourcesPanel.jsx';
import StudyFolderTreeView from './StudyFolderTreeView.jsx';
import {
  AnkiImportModal,
  AnkiImportSummaryModal,
  ConfirmDeleteModal,
  CreateFlashcardModal,
  CreateFolderModal,
  DeleteFolderModal,
  EditFolderModal,
  EditSourceModal,
} from './FlashcardsModals.jsx';
import { getColorById } from '../../utils/disciplineColors.js';
import { auth } from '../../firebaseConfig.js';

function readableError(error) {
  const details = typeof error?.details === 'string' ? error.details : (error?.details?.message || '');
  const message = error?.message || error?.code || 'Não foi possível carregar Flashcards.';
  const raw = details ? `${message} (${details})` : message;
  return String(raw).replace(/^FirebaseError:\s*/i, '').slice(0, 400);
}

function getDescendantFolderIds(folderId, allFolders) {
  const result = new Set([folderId]);
  let added = true;
  while (added) {
    added = false;
    for (const folder of allFolders) {
      if (!result.has(folder.id) && folder.parentFolderId && result.has(folder.parentFolderId)) {
        result.add(folder.id);
        added = true;
      }
    }
  }
  return Array.from(result);
}

function getBreadcrumbs(folderId, allFolders) {
  const crumbs = [];
  let current = allFolders.find((f) => f.id === folderId);
  const visited = new Set();
  while (current && !visited.has(current.id)) {
    visited.add(current.id);
    crumbs.unshift(current);
    if (!current.parentFolderId) break;
    current = allFolders.find((f) => f.id === current.parentFolderId);
  }
  return crumbs;
}

function ActionButton({ children, onClick, primary = false, disabled = false }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-xs font-black uppercase tracking-wider transition disabled:cursor-not-allowed disabled:opacity-50 ${
        primary
          ? 'bg-red-600 text-white shadow-md shadow-red-600/20 hover:bg-red-700'
          : 'border border-slate-200 bg-white text-slate-700 hover:border-red-300 hover:text-red-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200'
      }`}
    >
      {children}
    </button>
  );
}

function FolderCard({ folder, totalCards, dueCards, studiedCards = 0, sourceCount, subfolderCount, onOpen }) {
  const colorHex = getColorById(folder.color)?.hex || '#dc2626';
  const safeStudied = studiedCards || Math.max(0, totalCards - dueCards);
  return (
    <button
      type="button"
      onClick={onOpen}
      className="group rounded-2xl border border-slate-200 bg-white p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-red-300 hover:shadow-md dark:border-slate-800 dark:bg-slate-900 dark:hover:border-red-900"
    >
      <div className="flex items-start justify-between gap-3">
        <span
          className="flex h-11 w-11 items-center justify-center rounded-2xl text-white shadow-sm"
          style={{ backgroundColor: colorHex }}
        >
          <Folder size={22} />
        </span>
        <ChevronRight size={19} className="mt-2 text-slate-300 transition group-hover:translate-x-1 group-hover:text-red-500" />
      </div>
      <h2 className="mt-4 truncate text-base font-black text-slate-950 dark:text-white">{folder.name}</h2>
      {folder.description ? (
        <p className="mt-1 line-clamp-2 min-h-8 text-xs text-slate-500">{folder.description}</p>
      ) : (
        <p className="mt-1 min-h-8 text-xs text-slate-400">Pasta de Estudos</p>
      )}
      <div className="mt-4 flex flex-wrap gap-x-3 gap-y-1 text-xs font-semibold text-slate-500 dark:text-slate-400">
        <span className="font-bold text-slate-900 dark:text-white">{totalCards.toLocaleString('pt-BR')} cards</span>
        {dueCards > 0 ? (
          <span className="font-bold text-red-600 dark:text-red-400">{dueCards.toLocaleString('pt-BR')} para revisar</span>
        ) : (
          <span className="text-emerald-600 dark:text-emerald-400">Em dia</span>
        )}
        {safeStudied > 0 ? (
          <span>{safeStudied.toLocaleString('pt-BR')} estudados</span>
        ) : null}
        {subfolderCount > 0 ? <span>{subfolderCount} {subfolderCount === 1 ? 'subpasta' : 'subpastas'}</span> : null}
        {sourceCount > 0 ? <span>{sourceCount} {sourceCount === 1 ? 'fonte' : 'fontes'}</span> : null}
      </div>
    </button>
  );
}

function FolderView({
  userId, folder, folders, sources, decks, dueByFolder, onNavigate, onBack, onUpdateFolder, onRefresh,
}) {
  const [addingSource, setAddingSource] = useState(false);
  const [creatingCard, setCreatingCard] = useState(false);
  const [creatingSubfolder, setCreatingSubfolder] = useState(false);
  const [editingFolder, setEditingFolder] = useState(false);
  const [deletingFolder, setDeletingFolder] = useState(false);
  const [editingSource, setEditingSource] = useState(null);
  const [deletingSource, setDeletingSource] = useState(null);
  const [importingAnki, setImportingAnki] = useState(false);
  const [importSummary, setImportSummary] = useState(null);
  const [studySource, setStudySource] = useState(null);
  const [studyingFolderCards, setStudyingFolderCards] = useState(false);
  const [folderCards, setFolderCards] = useState([]);
  const [loadingCards, setLoadingCards] = useState(false);
  const [error, setError] = useState(null);

  const currentFolder = useMemo(() => {
    return folders.find((f) => f.id === folder.id) ||
      (folder.id.startsWith('temp_') ? folders.find((f) => f.name === folder.name && !f.id.startsWith('temp_')) : null) ||
      folder;
  }, [folder, folders]);

  const familyIds = useMemo(() => getDescendantFolderIds(currentFolder.id, folders), [currentFolder.id, folders]);
  const subfolders = useMemo(() => folders.filter((f) => f.parentFolderId === currentFolder.id), [currentFolder.id, folders]);
  const breadcrumbs = useMemo(() => getBreadcrumbs(currentFolder.id, folders), [currentFolder.id, folders]);

  const folderSources = useMemo(() => sources.filter((source) => source.folderId === currentFolder.id), [currentFolder.id, sources]);
  const readySources = folderSources.filter((source) => source.status === 'ready');

  const familyDecks = useMemo(() => decks.filter((deck) => familyIds.includes(deck.folderId)), [decks, familyIds]);
  const totalCardsCount = familyDecks.reduce((sum, deck) => sum + Number(deck.cardCount || 0), 0);
  const dueCardsCount = familyIds.reduce((sum, id) => sum + (dueByFolder[id] || 0), 0);

  const handleStartFolderReview = async (onlyDue = false) => {
    setLoadingCards(true);
    setError(null);
    try {
      const cards = await getFolderStudyCards(userId, familyIds, { onlyDue });
      if (!cards.length) {
        setError('Não há flashcards para revisar nesta pasta ou em suas subpastas.');
        setLoadingCards(false);
        return;
      }
      setFolderCards(cards);
      setStudyingFolderCards(true);
    } catch (err) {
      setError(readableError(err));
    } finally {
      setLoadingCards(false);
    }
  };

  const confirmDeleteSource = async () => {
    if (!deletingSource) return;
    try {
      await deleteStudySource(deletingSource.id);
      setDeletingSource(null);
      onRefresh();
    } catch (err) {
      setError(readableError(err));
    }
  };

  if (studySource) {
    return (
      <AdaptiveStudySession
        folder={folder}
        source={studySource}
        onExit={() => { setStudySource(null); onRefresh(); }}
      />
    );
  }

  if (studyingFolderCards && folderCards.length) {
    return (
      <StudySession
        userId={userId}
        deckId={folder.id}
        deckName={folder.name}
        cards={folderCards}
        onBack={() => { setStudyingFolderCards(false); setFolderCards([]); onRefresh(); }}
      />
    );
  }

  return (
    <main className="mx-auto w-full max-w-6xl px-3 py-4 sm:px-5 sm:py-6">
      <nav aria-label="Navegação hierárquica" className="flex flex-wrap items-center gap-1.5 text-xs font-bold text-slate-500">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1 hover:text-slate-900 dark:hover:text-white"
        >
          <ArrowLeft size={14} /> Flashcards
        </button>
        {breadcrumbs.map((crumb, idx) => (
          <React.Fragment key={crumb.id}>
            <span className="text-slate-300 dark:text-slate-600">/</span>
            {idx === breadcrumbs.length - 1 ? (
              <span className="text-red-600 dark:text-red-400">{crumb.name}</span>
            ) : (
              <button
                type="button"
                onClick={() => onNavigate(crumb.id)}
                className="hover:text-slate-900 dark:hover:text-white"
              >
                {crumb.name}
              </button>
            )}
          </React.Fragment>
        ))}
      </nav>

      <header className="mt-4 flex flex-col gap-4 border-b border-slate-200 pb-6 dark:border-slate-800 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <div
              className="h-4 w-4 shrink-0 rounded-full"
              style={{ backgroundColor: getColorById(currentFolder.color)?.hex || '#dc2626' }}
            />
            <h1 className="text-3xl font-black text-slate-950 dark:text-white">{currentFolder.name}</h1>
            <button
              type="button"
              onClick={() => setEditingFolder(true)}
              title="Editar pasta"
              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
            >
              <Pencil size={16} />
            </button>
            <button
              type="button"
              onClick={() => setDeletingFolder(true)}
              title="Excluir pasta"
              className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/20"
            >
              <Trash2 size={16} />
            </button>
          </div>
          {currentFolder.description ? (
            <p className="mt-2 max-w-2xl text-sm text-slate-500 dark:text-slate-400">{currentFolder.description}</p>
          ) : null}
        </div>

        <div className="flex flex-wrap gap-2">
          <ActionButton
            primary
            disabled={totalCardsCount === 0 || loadingCards}
            onClick={() => handleStartFolderReview(dueCardsCount > 0)}
          >
            {loadingCards ? <Loader2 size={15} className="animate-spin" /> : <BookOpen size={15} />}
            {dueCardsCount > 0 ? `Revisar (${dueCardsCount})` : 'Revisar Flashcards'}
          </ActionButton>
          <ActionButton onClick={() => setCreatingSubfolder(true)}>
            <FolderPlus size={15} /> Subpasta
          </ActionButton>
          <ActionButton onClick={() => setCreatingCard(true)}>
            <Plus size={15} /> Flashcard
          </ActionButton>
          <ActionButton onClick={() => setAddingSource(true)}>
            <FileText size={15} /> Adicionar fonte
          </ActionButton>
          <ActionButton onClick={() => setImportingAnki(true)}>
            <FileArchive size={15} /> Importar Anki
          </ActionButton>
        </div>
      </header>

      {error ? (
        <p role="alert" className="mt-4 rounded-xl bg-red-500/10 px-4 py-3 text-sm text-red-700 dark:text-red-300">
          {error}
        </p>
      ) : null}

      <section className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          ['Total de flashcards', totalCardsCount],
          ['Para revisar', dueCardsCount],
          ['Estudados', Math.max(0, totalCardsCount - dueCardsCount)],
          ['Subpastas', subfolders.length],
        ].map(([label, value]) => (
          <div key={label} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <p className="text-[11px] font-black uppercase tracking-wider text-slate-400">{label}</p>
            <p className="mt-1 text-2xl font-black text-slate-950 dark:text-white">{Number(value).toLocaleString('pt-BR')}</p>
          </div>
        ))}
      </section>

      {/* Árvore / Grid de Subpastas */}
      {subfolders.length ? (
        <section className="mt-8">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-black text-slate-950 dark:text-white">Subpastas</h2>
            <button
              type="button"
              onClick={() => setCreatingSubfolder(true)}
              className="inline-flex items-center gap-1.5 text-xs font-bold text-red-600 hover:text-red-700"
            >
              <FolderPlus size={14} /> Nova subpasta
            </button>
          </div>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {subfolders.map((sub) => {
              const subFamilyIds = getDescendantFolderIds(sub.id, folders);
              const subDecks = decks.filter((d) => subFamilyIds.includes(d.folderId));
              const subTotal = subDecks.reduce((sum, d) => sum + Number(d.cardCount || 0), 0);
              const subDue = subFamilyIds.reduce((sum, id) => sum + (dueByFolder[id] || 0), 0);
              const subDirectSubs = folders.filter((f) => f.parentFolderId === sub.id);
              const subSources = sources.filter((s) => s.folderId === sub.id);
              return (
                <FolderCard
                  key={sub.id}
                  folder={sub}
                  totalCards={subTotal}
                  dueCards={subDue}
                  sourceCount={subSources.length}
                  subfolderCount={subDirectSubs.length}
                  onOpen={() => onNavigate(sub.id)}
                />
              );
            })}
          </div>
        </section>
      ) : null}

      {/* Fontes de Estudo e Tutor */}
      <section className="mt-8">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-black text-slate-950 dark:text-white">Fontes de Estudo & Tutor Adaptativo</h2>
            <p className="text-xs text-slate-500">Documentos e anotações vinculados exclusivamente a esta pasta.</p>
          </div>
          <button
            type="button"
            onClick={() => setAddingSource(true)}
            className="inline-flex items-center gap-1.5 text-xs font-bold text-red-600 hover:text-red-700"
          >
            <Plus size={14} /> Nova fonte
          </button>
        </div>

        {!folderSources.length ? (
          <div className="mt-4 rounded-3xl border-2 border-dashed border-slate-200 p-8 text-center dark:border-slate-800">
            <FileText size={32} className="mx-auto text-slate-300" />
            <h3 className="mt-3 text-sm font-bold text-slate-700 dark:text-slate-300">Nenhuma fonte vinculada a esta pasta</h3>
            <p className="mt-1 text-xs text-slate-400">Adicione uma anotação ou PDF para que o Tutor Adaptativo formule perguntas em tempo real.</p>
            <button
              type="button"
              onClick={() => setAddingSource(true)}
              className="mt-4 inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-slate-800 dark:bg-white dark:text-slate-900"
            >
              <Plus size={14} /> Adicionar primeira fonte
            </button>
          </div>
        ) : (
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {folderSources.map((source) => (
              <div
                key={source.id}
                className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-slate-300 dark:border-slate-800 dark:bg-slate-900"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-red-50 text-red-600 dark:bg-red-950/30">
                      {source.kind === 'document' ? <FileText size={16} /> : <NotebookPen size={16} />}
                    </span>
                    <div className="min-w-0">
                      <h4 className="truncate text-sm font-bold text-slate-950 dark:text-white">{source.title}</h4>
                      <div className="mt-0.5 flex items-center gap-2 text-[11px] text-slate-400">
                        <span>{source.kind === 'document' ? 'Documento PDF' : 'Anotação'}</span>
                        <span>•</span>
                        <SourceStatus status={source.status} errorMessage={source.errorMessage} />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="ml-3 flex shrink-0 items-center gap-1.5">
                  {source.status === 'ready' ? (
                    <button
                      type="button"
                      onClick={() => setStudySource(source)}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-red-600 px-3 py-2 text-xs font-bold text-white shadow-md shadow-red-600/20 hover:bg-red-700"
                    >
                      <Sparkles size={13} />
                      <span>Iniciar Tutor</span>
                    </button>
                  ) : null}

                  <button
                    type="button"
                    onClick={() => setEditingSource(source)}
                    title="Editar título"
                    className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                  >
                    <Pencil size={14} />
                  </button>

                  <button
                    type="button"
                    onClick={() => setDeletingSource(source)}
                    title="Remover fonte"
                    className="rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/20"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Modais */}
      {creatingSubfolder ? (
        <CreateFolderModal
          parentFolder={currentFolder}
          onClose={() => setCreatingSubfolder(false)}
          onCreated={() => onRefresh()}
        />
      ) : null}

      {editingFolder ? (
        <EditFolderModal
          folder={currentFolder}
          onClose={() => setEditingFolder(false)}
          onUpdated={(updated) => {
            if (updated) onUpdateFolder?.(updated);
            onRefresh();
          }}
        />
      ) : null}

      {deletingFolder ? (
        <DeleteFolderModal
          folder={currentFolder}
          onClose={() => setDeletingFolder(false)}
          onDeleted={() => onBack()}
        />
      ) : null}

      {creatingCard ? (
        <CreateFlashcardModal
          userId={userId}
          folders={folders}
          initialFolderId={currentFolder.id}
          onClose={() => setCreatingCard(false)}
          onSaved={onRefresh}
        />
      ) : null}

      {addingSource ? (
        <AddSourceModal
          userId={userId}
          folder={currentFolder}
          onClose={() => setAddingSource(false)}
          onCreated={onRefresh}
        />
      ) : null}

      {editingSource ? (
        <EditSourceModal
          source={editingSource}
          onClose={() => setEditingSource(null)}
          onUpdated={onRefresh}
        />
      ) : null}

      {deletingSource ? (
        <ConfirmDeleteModal
          title="Remover Fonte de Estudo"
          message={
            <span>
              Tem certeza de que deseja remover a fonte <strong>"{deletingSource.title}"</strong>?
              O Tutor Adaptativo deixará de utilizá-la.
            </span>
          }
          confirmLabel="Remover Fonte"
          onClose={() => setDeletingSource(null)}
          onConfirm={confirmDeleteSource}
        />
      ) : null}

      {importingAnki ? (
        <AnkiImportModal
          userId={userId}
          folders={folders}
          lockedFolder={folder}
          onClose={() => setImportingAnki(false)}
          onImported={(destFolderId, report) => {
            onRefresh();
            setImportSummary(report);
          }}
        />
      ) : null}

      {importSummary ? (
        <AnkiImportSummaryModal
          report={importSummary}
          onClose={() => setImportSummary(null)}
          onViewFolder={(destId) => {
            setImportSummary(null);
            if (destId) onNavigate(destId);
          }}
        />
      ) : null}
    </main>
  );
}

export default function DecksPage({ userId, user }) {
  const activeUserId = userId || user?.uid || auth.currentUser?.uid;
  const { decks, loading: decksLoading, error: decksError, reload } = useDecks(activeUserId);
  const [folders, setFolders] = useState([]);
  const [sources, setSources] = useState([]);
  const [dueByFolder, setDueByFolder] = useState({});
  const [loadingFolders, setLoadingFolders] = useState(true);
  const [error, setError] = useState(null);
  const [selectedFolderId, setSelectedFolderId] = useState(null);
  const [viewMode, setViewMode] = useState('tree'); // 'tree' | 'grid'

  // Modais do Topo
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [subfolderParent, setSubfolderParent] = useState(null);
  const [editingFolderTarget, setEditingFolderTarget] = useState(null);
  const [deletingFolderTarget, setDeletingFolderTarget] = useState(null);
  const [creatingCard, setCreatingCard] = useState(false);
  const [importingAnki, setImportingAnki] = useState(false);
  const [importSummary, setImportSummary] = useState(null);
  const [reviewingFolder, setReviewingFolder] = useState(null);
  const [folderReviewCards, setFolderReviewCards] = useState([]);

  useEffect(() => {
    if (!activeUserId) return () => {};
    let unsubFolders = () => {};
    let unsubSources = () => {};
    setLoadingFolders(true);
    ensureLegacyStudyFolder().catch(() => {});
    unsubFolders = subscribeStudyFolders(activeUserId, (nextFolders) => {
      setFolders((prev) => {
        const pendingTemps = prev.filter((p) => p.id.startsWith('temp_') && !nextFolders.some((n) => n.name === p.name));
        return [...pendingTemps, ...nextFolders];
      });
      setLoadingFolders(false);
    }, (err) => {
      setError(readableError(err));
      setLoadingFolders(false);
    });
    unsubSources = subscribeStudySources(activeUserId, setSources, (err) => setError(readableError(err)));
    return () => {
      unsubFolders();
      unsubSources();
    };
  }, [activeUserId]);

  // Contagem de cards devidos por pasta
  useEffect(() => {
    if (!activeUserId || !decks.length) return () => {};
    let active = true;
    getDueCards(activeUserId, { limit: 1000 }).then((dueCards) => {
      if (!active) return;
      const deckFolderMap = new Map(decks.map((deck) => [deck.id, deck.folderId]));
      setDueByFolder(dueCards.reduce((counts, card) => {
        const folderId = card.folderId || deckFolderMap.get(card.deckId);
        if (folderId) counts[folderId] = Number(counts[folderId] || 0) + 1;
        return counts;
      }, {}));
    }).catch(() => {});
    return () => { active = false; };
  }, [decks, activeUserId]);

  const selectedFolder = folders.find((folder) => folder.id === selectedFolderId) || null;
  const rootFolders = useMemo(() => folders.filter((folder) => !folder.parentFolderId), [folders]);

  const handleStartTreeFolderReview = async (folder) => {
    const familyIds = getDescendantFolderIds(folder.id, folders);
    try {
      const cards = await getFolderStudyCards(activeUserId, familyIds, { onlyDue: false });
      if (cards.length) {
        setReviewingFolder(folder);
        setFolderReviewCards(cards);
      }
    } catch (err) {
      console.error(err);
    }
  };

  if (reviewingFolder && folderReviewCards.length) {
    return (
      <StudySession
        userId={activeUserId}
        deckId={reviewingFolder.id}
        deckName={reviewingFolder.name}
        cards={folderReviewCards}
        onBack={() => {
          setReviewingFolder(null);
          setFolderReviewCards([]);
          reload();
        }}
      />
    );
  }

  if (selectedFolder) {
    return (
      <FolderView
        userId={activeUserId}
        folder={selectedFolder}
        folders={folders}
        sources={sources}
        decks={decks}
        dueByFolder={dueByFolder}
        onNavigate={(folderId) => setSelectedFolderId(folderId)}
        onBack={() => {
          if (selectedFolder.parentFolderId) setSelectedFolderId(selectedFolder.parentFolderId);
          else setSelectedFolderId(null);
        }}
        onUpdateFolder={(updated) => {
          if (updated) {
            setFolders((prev) => prev.map((f) => (f.id === updated.id || (f.id.startsWith('temp_') && f.name === updated.name)) ? { ...f, ...updated } : f));
            setSelectedFolderId((curr) => (curr && curr.startsWith('temp_') ? updated.id : curr));
          }
        }}
        onRefresh={reload}
      />
    );
  }

  return (
    <main className="mx-auto w-full max-w-6xl px-3 py-4 sm:px-5 sm:py-6">
      {/* Header Principal */}
      <header className="flex flex-col gap-4 border-b border-slate-200 pb-6 dark:border-slate-800 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-red-600 dark:text-red-400">
            Estudo Ativo & Espaçamento Inteligente
          </p>
          <h1 className="mt-1 text-3xl font-black text-slate-950 dark:text-white">Flashcards</h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-500 dark:text-slate-400">
            Estrutura hierárquica completa de pastas, baralhos Anki e fontes para o Tutor Adaptativo.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <ActionButton primary onClick={() => setCreatingFolder(true)}>
            <FolderPlus size={15} /> Nova pasta
          </ActionButton>
          <ActionButton onClick={() => setCreatingCard(true)}>
            <Plus size={15} /> Novo flashcard
          </ActionButton>
          <ActionButton onClick={() => setImportingAnki(true)}>
            <FileArchive size={15} /> Importar Anki
          </ActionButton>
        </div>
      </header>

      {(error || decksError) ? (
        <p role="alert" className="mt-5 rounded-xl bg-red-500/10 px-4 py-3 text-sm text-red-700 dark:text-red-300">
          {error || decksError}
        </p>
      ) : null}

      {/* Controles de Visualização: Árvore vs Grid */}
      <div className="mt-7 flex items-center justify-between">
        <div>
          <h2 className="text-xl font-black text-slate-950 dark:text-white">Minhas Pastas & Baralhos</h2>
          <p className="mt-0.5 text-xs text-slate-500">
            Navegue pela árvore expansível ou clique no nome da pasta para abrir a visão detalhada.
          </p>
        </div>

        <div className="flex items-center gap-1 rounded-2xl border border-slate-200 bg-white p-1 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <button
            type="button"
            onClick={() => setViewMode('tree')}
            title="Visualização em Árvore"
            className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold transition ${
              viewMode === 'tree'
                ? 'bg-red-600 text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
            }`}
          >
            <ListTree size={14} />
            <span>Árvore</span>
          </button>
          <button
            type="button"
            onClick={() => setViewMode('grid')}
            title="Visualização em Cartões"
            className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold transition ${
              viewMode === 'grid'
                ? 'bg-red-600 text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
            }`}
          >
            <LayoutGrid size={14} />
            <span>Cartões</span>
          </button>
        </div>
      </div>

      {(loadingFolders || decksLoading) ? (
        <div className="flex min-h-64 items-center justify-center">
          <Loader2 size={32} className="animate-spin text-red-600" />
        </div>
      ) : null}

      {/* Estado Vazio */}
      {!loadingFolders && !decksLoading && !folders.length ? (
        <div className="mt-6">
          <div className="rounded-3xl border-2 border-dashed border-slate-200 bg-white/50 p-10 text-center dark:border-slate-800 dark:bg-slate-900/50">
            <Folder size={40} className="mx-auto text-slate-300" />
            <h2 className="mt-4 text-lg font-black text-slate-950 dark:text-white">Crie sua primeira Pasta de Estudos</h2>
            <p className="mx-auto mt-2 max-w-md text-sm text-slate-500">
              Pastas organizam fontes, subpastas e flashcards em uma única estrutura hierárquica.
            </p>
            <button
              type="button"
              onClick={() => setCreatingFolder(true)}
              className="mt-5 inline-flex items-center gap-2 rounded-xl bg-red-600 px-5 py-3 text-sm font-black text-white shadow-md shadow-red-600/20 hover:bg-red-700"
            >
              <FolderPlus size={16} /> Nova pasta
            </button>
          </div>
        </div>
      ) : null}

      {/* Item 17: Tree View estilo Anki como visual principal */}
      {!loadingFolders && folders.length > 0 && viewMode === 'tree' ? (
        <div className="mt-5">
          <StudyFolderTreeView
            folders={folders}
            decks={decks}
            dueByFolder={dueByFolder}
            onOpenFolder={(folder) => setSelectedFolderId(folder.id)}
            onEditFolder={(folder) => setEditingFolderTarget(folder)}
            onDeleteFolder={(folder) => setDeletingFolderTarget(folder)}
            onCreateSubfolder={(parent) => setSubfolderParent(parent)}
            onReviewFolder={handleStartTreeFolderReview}
          />
        </div>
      ) : null}

      {/* Visualização Alternativa em Grid de Cartões */}
      {!loadingFolders && folders.length > 0 && viewMode === 'grid' ? (
        <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {rootFolders.map((folder) => {
            const familyIds = getDescendantFolderIds(folder.id, folders);
            const familyDecks = decks.filter((deck) => familyIds.includes(deck.folderId));
            const directSubs = folders.filter((f) => f.parentFolderId === folder.id);
            const directSources = sources.filter((s) => s.folderId === folder.id);
            const total = familyDecks.reduce((sum, d) => sum + Number(d.cardCount || 0), 0);
            const due = familyIds.reduce((sum, id) => sum + (dueByFolder[id] || 0), 0);

            return (
              <FolderCard
                key={folder.id}
                folder={folder}
                totalCards={total}
                dueCards={due}
                sourceCount={directSources.length}
                subfolderCount={directSubs.length}
                onOpen={() => setSelectedFolderId(folder.id)}
              />
            );
          })}
        </div>
      ) : null}

      {/* Modais Globais */}
      {creatingFolder ? (
        <CreateFolderModal
          onClose={() => setCreatingFolder(false)}
          onCreated={(root, optimisticTree, isServerResult, originalTempId) => {
            if (isServerResult) {
              if (root?.id) {
                setFolders((prev) => [root, ...prev.filter((f) => f.id !== originalTempId && f.id !== root.id)]);
                setSelectedFolderId((curr) => (curr === originalTempId ? root.id : curr));
              }
              reload();
              return;
            }
            if (Array.isArray(optimisticTree) && optimisticTree.length) {
              setFolders((prev) => [...optimisticTree, ...prev.filter((f) => !optimisticTree.some((o) => o.id === f.id))]);
            } else if (root) {
              setFolders((prev) => [root, ...prev.filter((f) => f.id !== root.id)]);
            }
            reload();
            if (root?.id) setSelectedFolderId(root.id);
          }}
        />
      ) : null}

      {subfolderParent ? (
        <CreateFolderModal
          parentFolder={subfolderParent}
          onClose={() => setSubfolderParent(null)}
          onCreated={(root, optimisticTree, isServerResult, originalTempId) => {
            if (isServerResult) {
              if (root?.id) {
                setFolders((prev) => [root, ...prev.filter((f) => f.id !== originalTempId && f.id !== root.id)]);
              }
              reload();
              return;
            }
            if (Array.isArray(optimisticTree) && optimisticTree.length) {
              setFolders((prev) => [...optimisticTree, ...prev.filter((f) => !optimisticTree.some((o) => o.id === f.id))]);
            } else if (root) {
              setFolders((prev) => [root, ...prev.filter((f) => f.id !== root.id)]);
            }
            reload();
          }}
        />
      ) : null}

      {editingFolderTarget ? (
        <EditFolderModal
          folder={editingFolderTarget}
          onClose={() => setEditingFolderTarget(null)}
          onUpdated={() => reload()}
        />
      ) : null}

      {deletingFolderTarget ? (
        <DeleteFolderModal
          folder={deletingFolderTarget}
          onClose={() => setDeletingFolderTarget(null)}
          onDeleted={() => reload()}
        />
      ) : null}

      {creatingCard ? (
        <CreateFlashcardModal
          userId={activeUserId}
          folders={folders}
          onClose={() => setCreatingCard(false)}
          onSaved={reload}
        />
      ) : null}

      {importingAnki ? (
        <AnkiImportModal
          userId={activeUserId}
          folders={folders}
          onClose={() => setImportingAnki(false)}
          onImported={(destFolderId, report) => {
            reload();
            setImportSummary(report);
          }}
        />
      ) : null}

      {importSummary ? (
        <AnkiImportSummaryModal
          report={importSummary}
          onClose={() => setImportSummary(null)}
          onViewFolder={(destId) => {
            setImportSummary(null);
            if (destId) setSelectedFolderId(destId);
          }}
        />
      ) : null}
    </main>
  );
}
