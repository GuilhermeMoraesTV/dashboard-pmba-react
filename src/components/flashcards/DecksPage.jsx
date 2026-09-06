import FolderCardsPage from './FolderCardsPage.jsx';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  BookOpen,
  ChevronRight,
  ChevronDown,
  ChevronUp,
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
  deleteStudyFolder,
  ensureLegacyStudyFolder,
  subscribeStudyFolders,
  subscribeStudySources,
} from '../../services/studySources/studySourcesService.js';
import {
  getAuthoritativeFolderMetrics,
  getFolderStudyCardsPage,
} from '../../services/flashcards/flashcardsService.js';
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
  FolderStudyPrepModal,
  folderColorHex,
  getBreadcrumbs,
  getDescendantFolderIds,
} from './FlashcardsModals.jsx';
import { auth } from '../../firebaseConfig.js';
import { DEFAULT_PRODUCT_LIMITS } from '../../config/productLimits.js';

function readableError(error) {
  const details = typeof error?.details === 'string' ? error.details : (error?.details?.message || '');
  const message = error?.message || error?.code || 'Não foi possível carregar Flashcards.';
  const raw = details ? `${message} (${details})` : message;
  return String(raw).replace(/^FirebaseError:\s*/i, '').slice(0, 400);
}

function ActionButton({ children, onClick, primary = false, disabled = false, size = 'default' }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center justify-center gap-1.5 rounded-xl font-black uppercase tracking-wider transition disabled:cursor-not-allowed disabled:opacity-50 ${
        size === 'sm' ? 'px-3 py-2 text-[11px]' : 'px-3.5 py-2.5 text-xs'
      } ${
        primary
          ? 'bg-red-600 text-white shadow-md shadow-red-600/20 hover:bg-red-700'
          : 'border border-zinc-200 bg-white text-zinc-700 hover:border-red-300 hover:text-red-600 dark:border-zinc-800 dark:bg-card-dark dark:text-zinc-200 dark:hover:border-zinc-700'
      }`}
    >
      {children}
    </button>
  );
}

function FolderCard({ folder, totalCards, dueCards, studiedCards = 0, sourceCount, subfolderCount, onOpen }) {
  const colorHex = folderColorHex(folder.color);
  const safeStudied = studiedCards || Math.max(0, totalCards - dueCards);
  return (
    <button
      type="button"
      onClick={onOpen}
      className="group rounded-2xl border border-zinc-200 bg-white p-4 sm:p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-red-300 hover:shadow-md dark:border-zinc-800 dark:bg-card-dark dark:hover:border-red-900"
    >
      <div className="flex items-start justify-between gap-3">
        <span
          className="flex h-10 w-10 items-center justify-center rounded-2xl text-white shadow-sm"
          style={{ backgroundColor: colorHex }}
        >
          <Folder size={20} />
        </span>
        <ChevronRight size={18} className="mt-1 text-zinc-300 transition group-hover:translate-x-1 group-hover:text-red-500 dark:text-zinc-600" />
      </div>
      <h2 className="mt-3 truncate text-base font-black text-zinc-950 dark:text-white">{folder.name}</h2>
      {folder.description ? (
        <p className="mt-1 line-clamp-2 min-h-8 text-xs text-zinc-500 dark:text-zinc-400">{folder.description}</p>
      ) : (
        <p className="mt-1 min-h-8 text-xs text-zinc-400">Pasta de Estudos</p>
      )}
      <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-xs font-semibold text-zinc-500 dark:text-zinc-400">
        <span className="font-bold text-zinc-900 dark:text-white">{totalCards.toLocaleString('pt-BR')} cards</span>
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
  userId, folder, folders, decks, sources, dueByFolder, totalByFolder, studiedByFolder,
  onNavigate, onBack, onUpdateFolder, onDeleteFolder, onRefresh,
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
  const [managingCards, setManagingCards] = useState(false);
  const [folderCards, setFolderCards] = useState([]);
  const [loadingCards, setLoadingCards] = useState(false);
  const [error, setError] = useState(null);
  const [sourceSearchTerm, setSourceSearchTerm] = useState('');
  const folderStudyCursorRef = useRef(null);
  const folderStudyHasMoreRef = useRef(false);
  const folderStudyOnlyDueRef = useRef(false);

  const currentFolder = useMemo(() => {
    return folders.find((f) => f.id === folder.id) ||
      (folder.id.startsWith('temp_') ? folders.find((f) => f.name === folder.name && !f.id.startsWith('temp_')) : null) ||
      folder;
  }, [folder, folders]);

  const familyIds = useMemo(() => getDescendantFolderIds(currentFolder.id, folders), [currentFolder.id, folders]);
  const subfolders = useMemo(() => folders.filter((f) => f.parentFolderId === currentFolder.id), [currentFolder.id, folders]);
  const breadcrumbs = useMemo(() => getBreadcrumbs(currentFolder.id, folders), [currentFolder.id, folders]);

  const folderSources = useMemo(() => sources.filter((source) => source.folderId === currentFolder.id), [currentFolder.id, sources]);
  const filteredFolderSources = useMemo(() => {
    if (!sourceSearchTerm.trim()) return folderSources;
    const term = sourceSearchTerm.toLowerCase();
    return folderSources.filter((s) => (s.title || '').toLowerCase().includes(term));
  }, [folderSources, sourceSearchTerm]);
  const totalCardsCount = familyIds.reduce((sum, id) => sum + Number(totalByFolder[id] || 0), 0);
  const dueCardsCount = familyIds.reduce((sum, id) => sum + (dueByFolder[id] || 0), 0);
  const studiedCardsCount = familyIds.reduce((sum, id) => sum + Number(studiedByFolder[id] || 0), 0);

  const handleStartFolderReview = async (onlyDue = false) => {
    setLoadingCards(true);
    setError(null);
    try {
      const page = await getFolderStudyCardsPage(userId, familyIds, { onlyDue, pageSize: 100 });
      if (!page.cards.length) {
        setError('Não há flashcards para revisar nesta pasta ou em suas subpastas.');
        setLoadingCards(false);
        return;
      }
      setFolderCards(page.cards);
      folderStudyCursorRef.current = page.cursor;
      folderStudyHasMoreRef.current = page.hasMore;
      folderStudyOnlyDueRef.current = onlyDue;
      setStudyingFolderCards(true);
    } catch (err) {
      setError(readableError(err));
    } finally {
      setLoadingCards(false);
    }
  };

  const loadMoreFolderCards = useCallback(async () => {
    if (!folderStudyHasMoreRef.current) return { cards: [], hasMore: false };
    const page = await getFolderStudyCardsPage(userId, familyIds, {
      onlyDue: folderStudyOnlyDueRef.current,
      pageSize: 100,
      cursor: folderStudyCursorRef.current,
    });
    folderStudyCursorRef.current = page.cursor;
    folderStudyHasMoreRef.current = page.hasMore;
    return page;
  }, [familyIds, userId]);

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

  if (managingCards) {
    return <FolderCardsPage userId={userId} folder={currentFolder} folders={folders} decks={decks} onBack={() => setManagingCards(false)} onRefresh={onRefresh} />;
  }

  if (studySource) {
    return (
      <AdaptiveStudySession
        folder={{ ...currentFolder, path: breadcrumbs.map((item) => item.name).join(' / ') }}
        source={studySource}
        onExit={() => { setStudySource(null); }}
      />
    );
  }

  if (studyingFolderCards && folderCards.length) {
    return (
      <StudySession
        userId={userId}
        deckId={folder.id}
        deckName={folder.name}
        folderPath={breadcrumbs.map((item) => item.name).join(' / ') || folder.name}
        cards={folderCards}
        totalCards={folderStudyOnlyDueRef.current ? dueCardsCount : totalCardsCount}
        hasMoreCards={folderStudyHasMoreRef.current}
        loadMoreCards={loadMoreFolderCards}
        onBack={() => { setStudyingFolderCards(false); setFolderCards([]); onRefresh(); }}
      />
    );
  }

  return (
    <main className="mx-auto w-full max-w-6xl px-3 py-4 sm:px-5 sm:py-6">
      <nav aria-label="Navegação hierárquica" className="flex flex-wrap items-center gap-1.5 text-xs font-bold text-zinc-500">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1 hover:text-zinc-900 dark:hover:text-white"
        >
          <ArrowLeft size={14} /> Flashcards
        </button>
        {breadcrumbs.map((crumb, idx) => (
          <React.Fragment key={crumb.id}>
            <span className="text-zinc-300 dark:text-zinc-600">/</span>
            {idx === breadcrumbs.length - 1 ? (
              <span className="text-red-600 dark:text-red-400">{crumb.name}</span>
            ) : (
              <button
                type="button"
                onClick={() => onNavigate(crumb.id)}
                className="hover:text-zinc-900 dark:hover:text-white"
              >
                {crumb.name}
              </button>
            )}
          </React.Fragment>
        ))}
      </nav>

      <header className="mt-4 flex flex-col gap-4 border-b border-zinc-200 pb-6 dark:border-zinc-800 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <div
              className="h-4 w-4 shrink-0 rounded-full"
              style={{ backgroundColor: folderColorHex(currentFolder.color) }}
            />
            <h1 className="text-2xl sm:text-3xl font-black text-zinc-950 dark:text-white">{currentFolder.name}</h1>
            <button
              type="button"
              onClick={() => setEditingFolder(true)}
              title="Editar pasta"
              className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
            >
              <Pencil size={16} />
            </button>
            <button
              type="button"
              onClick={() => setDeletingFolder(true)}
              title="Excluir pasta"
              className="rounded-lg p-1.5 text-zinc-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/20"
            >
              <Trash2 size={16} />
            </button>
          </div>
          {currentFolder.description ? (
            <p className="mt-2 max-w-2xl text-sm text-zinc-500 dark:text-zinc-400">{currentFolder.description}</p>
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
          <ActionButton onClick={() => setManagingCards(true)}>
            <Layers size={15} /> Ver Flashcards
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
          ['Estudados', studiedCardsCount],
          ['Subpastas', subfolders.length],
        ].map(([label, value]) => (
          <div key={label} className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-card-dark">
            <p className="text-[11px] font-black uppercase tracking-wider text-zinc-400">{label}</p>
            <p className="mt-1 text-2xl font-black text-zinc-950 dark:text-white">{Number(value).toLocaleString('pt-BR')}</p>
          </div>
        ))}
      </section>

      {/* Árvore / Grid de Subpastas */}
      {subfolders.length ? (
        <section className="mt-8">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-black text-zinc-950 dark:text-white">Subpastas</h2>
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
              const subTotal = subFamilyIds.reduce((sum, id) => sum + Number(totalByFolder[id] || 0), 0);
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
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-black text-zinc-950 dark:text-white">Fontes de Estudo & Tutor Adaptativo</h2>
              {folderSources.length > 0 && (
                <span className="rounded-full bg-zinc-100 px-2.5 py-0.5 text-[11px] font-bold text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                  {folderSources.length} {folderSources.length === 1 ? 'fonte' : 'fontes'}
                </span>
              )}
            </div>
            <p className="text-xs text-zinc-500">Documentos e anotações vinculados exclusivamente a esta pasta.</p>
          </div>
          <div className="flex items-center gap-2">
            {folderSources.length > 4 && (
              <input
                type="text"
                value={sourceSearchTerm}
                onChange={(e) => setSourceSearchTerm(e.target.value)}
                placeholder="Filtrar fontes..."
                className="w-36 sm:w-48 rounded-xl border border-zinc-200 bg-white px-2.5 py-1.5 text-xs text-zinc-800 outline-none focus:border-red-500 dark:border-zinc-800 dark:bg-card-dark dark:text-zinc-200"
              />
            )}
            <button
              type="button"
              onClick={() => setAddingSource(true)}
              className="inline-flex items-center gap-1.5 text-xs font-bold text-red-600 hover:text-red-700"
            >
              <Plus size={14} /> Nova fonte
            </button>
          </div>
        </div>

        {!folderSources.length ? (
          <div className="mt-4 rounded-3xl border-2 border-dashed border-zinc-200 p-8 text-center dark:border-zinc-800">
            <FileText size={32} className="mx-auto text-zinc-300 dark:text-zinc-600" />
            <h3 className="mt-3 text-sm font-bold text-zinc-700 dark:text-zinc-300">Nenhuma fonte vinculada a esta pasta</h3>
            <p className="mt-1 text-xs text-zinc-400">Adicione uma anotação ou PDF para que o Tutor Adaptativo formule perguntas em tempo real.</p>
            <button
              type="button"
              onClick={() => setAddingSource(true)}
              className="mt-4 inline-flex items-center gap-2 rounded-xl bg-zinc-900 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-zinc-800 dark:bg-white dark:text-zinc-900"
            >
              <Plus size={14} /> Adicionar primeira fonte
            </button>
          </div>
        ) : (
          <div className="mt-4 max-h-[480px] overflow-y-auto pr-1 custom-scrollbar">
            {filteredFolderSources.length === 0 ? (
              <div className="py-8 text-center text-xs text-zinc-400">
                Nenhuma fonte encontrada com o filtro informado.
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {filteredFolderSources.map((source) => (
                  <div
                    key={source.id}
                    className="flex items-center justify-between rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm transition hover:border-zinc-300 dark:border-zinc-800 dark:bg-card-dark"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-red-50 text-red-600 dark:bg-red-950/30">
                          {source.kind === 'document' ? <FileText size={16} /> : <NotebookPen size={16} />}
                        </span>
                        <div className="min-w-0">
                          <h4 className="truncate text-sm font-bold text-zinc-950 dark:text-white">{source.title}</h4>
                          <div className="mt-0.5 flex items-center gap-2 text-[11px] text-zinc-400">
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
                        className="rounded-lg p-2 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
                      >
                        <Pencil size={14} />
                      </button>

                      <button
                        type="button"
                        onClick={() => setDeletingSource(source)}
                        title="Remover fonte"
                        className="rounded-lg p-2 text-zinc-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/20"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
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
          onDeleted={onDeleteFolder}
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
          sources={sources}
          onClose={() => setAddingSource(false)}
          onCreated={() => {}}
          onStartStudy={(source) => {
            setAddingSource(false);
            setStudySource(source);
          }}
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
  const [totalByFolder, setTotalByFolder] = useState({});
  const [studiedByFolder, setStudiedByFolder] = useState({});
  const [loadingFolders, setLoadingFolders] = useState(true);
  const [error, setError] = useState(null);
  const [selectedFolderId, setSelectedFolderId] = useState(null);
  const [viewMode, setViewMode] = useState('tree'); // 'tree' | 'grid'

  // Tree expansion state preserved across sessions & modals
  const [expandedIds, setExpandedIds] = useState(() => new Set());
  const hasInitializedExpansionRef = useRef(false);

  // Modais
  const [prepFolder, setPrepFolder] = useState(null);
  const [managingCardsFolder, setManagingCardsFolder] = useState(null);
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [subfolderParent, setSubfolderParent] = useState(null);
  const [editingFolderTarget, setEditingFolderTarget] = useState(null);
  const [deletingFolderTarget, setDeletingFolderTarget] = useState(null);
  const [creatingCard, setCreatingCard] = useState(false);
  const [creatingCardFolderId, setCreatingCardFolderId] = useState(null);
  const [addingSourceFolder, setAddingSourceFolder] = useState(null);
  const [importingAnki, setImportingAnki] = useState(false);
  const [importingAnkiFolder, setImportingAnkiFolder] = useState(null);
  const [importSummary, setImportSummary] = useState(null);

  // Sessão de Estudo
  const [activeStudySource, setActiveStudySource] = useState(null);
  const [activeStudyFolder, setActiveStudyFolder] = useState(null);
  const [reviewingFolder, setReviewingFolder] = useState(null);
  const [folderReviewCards, setFolderReviewCards] = useState([]);
  const [folderReviewTotalCards, setFolderReviewTotalCards] = useState(0);
  const pendingFolderDeletionsRef = useRef(new Set());
  const treeStudyCursorRef = useRef(null);
  const treeStudyHasMoreRef = useRef(false);
  const treeStudyFolderIdsRef = useRef([]);
  const treeStudyOnlyDueRef = useRef(false);

  useEffect(() => {
    if (!activeUserId) return () => {};
    let unsubFolders = () => {};
    let unsubSources = () => {};
    setLoadingFolders(true);
    ensureLegacyStudyFolder().catch(() => {});
    unsubFolders = subscribeStudyFolders(activeUserId, (nextFolders) => {
      const nextIds = new Set(nextFolders.map((folder) => folder.id));
      for (const folderId of pendingFolderDeletionsRef.current) {
        if (!nextIds.has(folderId)) pendingFolderDeletionsRef.current.delete(folderId);
      }
      const visibleFolders = nextFolders.filter((folder) => !pendingFolderDeletionsRef.current.has(folder.id));
      setFolders((prev) => {
        const pendingTemps = prev.filter((p) => p.id.startsWith('temp_') && !visibleFolders.some((n) => n.name === p.name));
        return [...pendingTemps, ...visibleFolders];
      });

      // Expand all roots/nodes by default on first load
      if (!hasInitializedExpansionRef.current && visibleFolders.length > 0) {
        hasInitializedExpansionRef.current = true;
        setExpandedIds(new Set(visibleFolders.map((f) => f.id)));
      }

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

  // Contadores agregados e independentes dos cards carregados no navegador.
  useEffect(() => {
    if (!activeUserId) return () => {};
    if (!decks.length) {
      setDueByFolder({});
      setTotalByFolder({});
      setStudiedByFolder({});
      return () => {};
    }
    let active = true;
    const timer = setTimeout(() => {
      getAuthoritativeFolderMetrics(activeUserId, decks, { isCancelled: () => !active }).then((metrics) => {
        if (!active) return;
        setDueByFolder(metrics.dueByFolder);
        setTotalByFolder(metrics.totalByFolder);
        setStudiedByFolder(metrics.studiedByFolder);
      }).catch((failure) => {
        if (active) setError(readableError(failure));
      });
    }, DEFAULT_PRODUCT_LIMITS.anki.metricsDebounceMs);
    return () => { active = false; clearTimeout(timer); };
  }, [decks, activeUserId]);

  const selectedFolder = folders.find((folder) => folder.id === selectedFolderId) || null;
  const rootFolders = useMemo(() => folders.filter((folder) => !folder.parentFolderId), [folders]);

  const handleToggleExpand = useCallback((folderId) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(folderId)) next.delete(folderId);
      else next.add(folderId);
      return next;
    });
  }, []);

  const handleExpandAll = useCallback(() => {
    setExpandedIds(new Set(folders.map((f) => f.id)));
  }, [folders]);

  const handleCollapseAll = useCallback(() => {
    setExpandedIds(new Set());
  }, []);

  const handleDeleteFolder = useCallback((folder) => {
    if (!folder?.id) return;
    const previousFolders = folders;
    const previousDueByFolder = dueByFolder;
    const previousTotalByFolder = totalByFolder;
    const previousStudiedByFolder = studiedByFolder;
    const previousSelectedFolderId = selectedFolderId;
    const removedIds = new Set(getDescendantFolderIds(folder.id, folders));
    for (const folderId of removedIds) pendingFolderDeletionsRef.current.add(folderId);

    setDeletingFolderTarget(null);
    setPrepFolder((curr) => (curr && removedIds.has(curr.id) ? null : curr));
    setManagingCardsFolder((curr) => (curr && removedIds.has(curr.id) ? null : curr));
    setFolders((current) => current.filter((candidate) => !removedIds.has(candidate.id)));
    setDueByFolder((current) => Object.fromEntries(
      Object.entries(current).filter(([folderId]) => !removedIds.has(folderId)),
    ));
    setTotalByFolder((current) => Object.fromEntries(
      Object.entries(current).filter(([folderId]) => !removedIds.has(folderId)),
    ));
    setStudiedByFolder((current) => Object.fromEntries(
      Object.entries(current).filter(([folderId]) => !removedIds.has(folderId)),
    ));
    if (previousSelectedFolderId && removedIds.has(previousSelectedFolderId)) {
      setSelectedFolderId(folder.parentFolderId || null);
    }

    void deleteStudyFolder(folder.id).catch((failure) => {
      for (const folderId of removedIds) pendingFolderDeletionsRef.current.delete(folderId);
      setFolders((current) => {
        const restored = new Map(previousFolders.map((candidate) => [candidate.id, candidate]));
        current.forEach((candidate) => restored.set(candidate.id, candidate));
        return [...restored.values()];
      });
      setDueByFolder((current) => ({ ...previousDueByFolder, ...current }));
      setTotalByFolder((current) => ({ ...previousTotalByFolder, ...current }));
      setStudiedByFolder((current) => ({ ...previousStudiedByFolder, ...current }));
      setSelectedFolderId(previousSelectedFolderId);
      setError(`A exclusão não foi concluída e a pasta foi restaurada. ${readableError(failure)}`);
    });
  }, [dueByFolder, folders, selectedFolderId, studiedByFolder, totalByFolder]);

  const handleStartFolderStudy = async (targetFolder, onlyDue = false) => {
    const familyIds = getDescendantFolderIds(targetFolder.id, folders);
    const dueCount = familyIds.reduce((sum, id) => sum + Number(dueByFolder[id] || 0), 0);
    const totalCount = familyIds.reduce((sum, id) => sum + Number(totalByFolder[id] || 0), 0);
    const targetCount = onlyDue ? dueCount : totalCount;

    if (targetCount === 0) {
      setError(onlyDue ? 'Nenhum flashcard pendente para revisão nesta pasta.' : 'Esta pasta não possui flashcards.');
      return;
    }

    try {
      const page = await getFolderStudyCardsPage(activeUserId, familyIds, { onlyDue, pageSize: 100 });
      if (page.cards.length) {
        treeStudyFolderIdsRef.current = familyIds;
        treeStudyCursorRef.current = page.cursor;
        treeStudyHasMoreRef.current = page.hasMore;
        treeStudyOnlyDueRef.current = onlyDue;
        setFolderReviewTotalCards(targetCount);
        setReviewingFolder(targetFolder);
        setFolderReviewCards(page.cards);
        setPrepFolder(null);
      } else {
        setError('Não foi possível carregar os flashcards para estudo.');
      }
    } catch (err) {
      setError(readableError(err));
    }
  };

  const handleStudyAI = useCallback((targetFolder) => {
    const readySources = sources.filter((s) => s.folderId === targetFolder.id && s.status === 'ready');
    if (readySources.length === 1) {
      setActiveStudyFolder(targetFolder);
      setActiveStudySource(readySources[0]);
    } else {
      setPrepFolder(targetFolder);
    }
  }, [sources]);

  const handleDirectStudyFolder = useCallback((targetFolder) => {
    const familyIds = getDescendantFolderIds(targetFolder.id, folders);
    const dueCount = familyIds.reduce((sum, id) => sum + Number(dueByFolder[id] || 0), 0);
    const totalCount = familyIds.reduce((sum, id) => sum + Number(totalByFolder[id] || 0), 0);

    // 1. Se tiver flashcards normais, inicia direto o estudo (priorizando os pendentes se houver)
    if (totalCount > 0) {
      handleStartFolderStudy(targetFolder, dueCount > 0);
      return;
    }

    // 2. Se a pasta tiver apenas uma fonte de IA pronta, inicia direto o estudo da IA
    const readySources = sources.filter((s) => s.folderId === targetFolder.id && s.status === 'ready');
    if (readySources.length === 1) {
      setActiveStudyFolder(targetFolder);
      setActiveStudySource(readySources[0]);
      return;
    }

    // 3. Se tiver múltiplas fontes de IA ou nenhum flashcard/fonte, abre a preparação/gerenciamento
    setPrepFolder(targetFolder);
  }, [folders, dueByFolder, totalByFolder, sources]);

  const loadMoreTreeFolderCards = useCallback(async () => {
    if (!treeStudyHasMoreRef.current) return { cards: [], hasMore: false };
    const page = await getFolderStudyCardsPage(activeUserId, treeStudyFolderIdsRef.current, {
      onlyDue: treeStudyOnlyDueRef.current,
      pageSize: 100,
      cursor: treeStudyCursorRef.current,
    });
    treeStudyCursorRef.current = page.cursor;
    treeStudyHasMoreRef.current = page.hasMore;
    return page;
  }, [activeUserId]);

  if (activeStudySource && activeStudyFolder) {
    return (
      <AdaptiveStudySession
        folder={{
          ...activeStudyFolder,
          path: getBreadcrumbs(activeStudyFolder.id, folders).map((item) => item.name).join(' / ') || activeStudyFolder.name,
        }}
        source={activeStudySource}
        onExit={() => {
          setActiveStudySource(null);
          setActiveStudyFolder(null);
        }}
      />
    );
  }

  if (reviewingFolder && folderReviewCards.length) {
    return (
      <StudySession
        userId={activeUserId}
        deckId={reviewingFolder.id}
        deckName={reviewingFolder.name}
        folderPath={getBreadcrumbs(reviewingFolder.id, folders).map((item) => item.name).join(' / ') || reviewingFolder.name}
        cards={folderReviewCards}
        totalCards={folderReviewTotalCards}
        hasMoreCards={treeStudyHasMoreRef.current}
        loadMoreCards={loadMoreTreeFolderCards}
        onBack={() => {
          setReviewingFolder(null);
          setFolderReviewCards([]);
          reload();
        }}
      />
    );
  }

  if (managingCardsFolder) {
    return <FolderCardsPage userId={activeUserId} folder={managingCardsFolder} folders={folders} decks={decks} onBack={() => setManagingCardsFolder(null)} onRefresh={reload} />;
  }

  if (selectedFolder) {
    return (
      <FolderView
        decks={decks}
        userId={activeUserId}
        folder={selectedFolder}
        folders={folders}
        sources={sources}
        dueByFolder={dueByFolder}
        totalByFolder={totalByFolder}
        studiedByFolder={studiedByFolder}
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
        onDeleteFolder={handleDeleteFolder}
        onRefresh={reload}
      />
    );
  }

  return (
    <main className="mx-auto w-full max-w-6xl px-3 py-3 sm:px-5 sm:py-5 space-y-3 sm:space-y-4">
      {/* Cabeçalho Único Consolidado */}
      <header className="flex flex-col gap-3 rounded-2xl border border-zinc-200 bg-white p-3.5 shadow-sm dark:border-zinc-800 dark:bg-card-dark sm:p-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] sm:text-[11px] font-black uppercase tracking-wider text-red-600 dark:text-red-400">
              Estudo Ativo & Espaçamento Inteligente
            </span>
          </div>
          <h1 className="mt-0.5 text-xl sm:text-2xl font-black text-zinc-950 dark:text-white">
            Flashcards
          </h1>
          <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
            Estrutura hierárquica de pastas, baralhos e fontes para estudo ativo.
          </p>
        </div>

        {/* Barra de Ações e Controles */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Ações Principais */}
          <ActionButton primary size="sm" onClick={() => setCreatingFolder(true)}>
            <FolderPlus size={14} /> Nova pasta
          </ActionButton>
          <ActionButton size="sm" onClick={() => { setCreatingCardFolderId(null); setCreatingCard(true); }}>
            <Plus size={14} /> Novo flashcard
          </ActionButton>
          <ActionButton size="sm" onClick={() => { setImportingAnkiFolder(null); setImportingAnki(true); }}>
            <FileArchive size={14} /> Importar Anki
          </ActionButton>

          {/* Controles de Visualização e Expansão */}
          {folders.length > 0 && (
            <div className="flex items-center gap-1.5 border-l border-zinc-200 pl-2 dark:border-zinc-800">
              {viewMode === 'tree' && (
                <div className="hidden sm:flex items-center gap-1">
                  <button
                    type="button"
                    onClick={handleExpandAll}
                    title="Expandir todas as pastas"
                    className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200 transition"
                  >
                    <ChevronDown size={15} />
                  </button>
                  <button
                    type="button"
                    onClick={handleCollapseAll}
                    title="Recolher todas as pastas"
                    className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200 transition"
                  >
                    <ChevronUp size={15} />
                  </button>
                </div>
              )}

              <div className="flex items-center rounded-xl border border-zinc-200 bg-zinc-50/50 p-0.5 dark:border-zinc-800 dark:bg-zinc-900/60">
                <button
                  type="button"
                  onClick={() => setViewMode('tree')}
                  title="Visualização em Árvore"
                  className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-bold transition ${
                    viewMode === 'tree'
                      ? 'bg-red-600 text-white shadow-sm'
                      : 'text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white'
                  }`}
                >
                  <ListTree size={13} />
                  <span className="hidden sm:inline">Árvore</span>
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('grid')}
                  title="Visualização em Cartões"
                  className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-bold transition ${
                    viewMode === 'grid'
                      ? 'bg-red-600 text-white shadow-sm'
                      : 'text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white'
                  }`}
                >
                  <LayoutGrid size={13} />
                  <span className="hidden sm:inline">Cartões</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </header>

      {(error || decksError) ? (
        <p role="alert" className="rounded-xl bg-red-500/10 px-4 py-3 text-sm text-red-700 dark:text-red-300">
          {error || decksError}
        </p>
      ) : null}

      {(loadingFolders || decksLoading) ? (
        <div className="flex min-h-64 items-center justify-center">
          <Loader2 size={32} className="animate-spin text-red-600" />
        </div>
      ) : null}

      {/* Estado Vazio */}
      {!loadingFolders && !decksLoading && !folders.length ? (
        <div className="rounded-3xl border-2 border-dashed border-zinc-200 bg-white/50 p-10 text-center dark:border-zinc-800 dark:bg-card-dark/50">
          <Folder size={40} className="mx-auto text-zinc-300 dark:text-zinc-600" />
          <h2 className="mt-4 text-lg font-black text-zinc-950 dark:text-white">Crie sua primeira Pasta de Estudos</h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-zinc-500 dark:text-zinc-400">
            Pastas organizam fontes, subpastas e flashcards em uma única estrutura hierárquica.
          </p>
          <button
            type="button"
            onClick={() => setCreatingFolder(true)}
            className="mt-5 inline-flex items-center gap-2 rounded-xl bg-red-600 px-5 py-3 text-sm font-black text-white shadow-md shadow-red-600/20 hover:bg-red-700 transition"
          >
            <FolderPlus size={16} /> Nova pasta
          </button>
        </div>
      ) : null}

      {/* Árvore de Pastas Diretamente Abaixo do Cabeçalho */}
      {!loadingFolders && folders.length > 0 && viewMode === 'tree' ? (
        <StudyFolderTreeView
          folders={folders}
          decks={decks}
          sources={sources}
          directDueByFolder={dueByFolder}
          directTotalByFolder={totalByFolder}
          directStudiedByFolder={studiedByFolder}
          expandedIds={expandedIds}
          onToggleExpand={handleToggleExpand}
          onExpandAll={handleExpandAll}
          onCollapseAll={handleCollapseAll}
          onOpenFolder={handleDirectStudyFolder}
          onStudyAI={handleStudyAI}
          onManageFolder={(folder) => setSelectedFolderId(folder.id)}
          onManageCards={(folder) => setManagingCardsFolder(folder)}
          onEditFolder={(folder) => setEditingFolderTarget(folder)}
          onDeleteFolder={(folder) => setDeletingFolderTarget(folder)}
          onCreateSubfolder={(parent) => setSubfolderParent(parent)}
          onReviewFolder={(folder) => handleStartFolderStudy(folder, false)}
        />
      ) : null}

      {/* Visualização Alternativa em Cartões */}
      {!loadingFolders && folders.length > 0 && viewMode === 'grid' ? (
        <div className="grid gap-3 sm:gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {rootFolders.map((folder) => {
            const familyIds = getDescendantFolderIds(folder.id, folders);
            const directSubs = folders.filter((f) => f.parentFolderId === folder.id);
            const directSources = sources.filter((s) => s.folderId === folder.id);
            const total = familyIds.reduce((sum, id) => sum + Number(totalByFolder[id] || 0), 0);
            const due = familyIds.reduce((sum, id) => sum + (dueByFolder[id] || 0), 0);
            const studied = familyIds.reduce((sum, id) => sum + Number(studiedByFolder[id] || 0), 0);

            return (
              <FolderCard
                key={folder.id}
                folder={folder}
                totalCards={total}
                dueCards={due}
                studiedCards={studied}
                sourceCount={directSources.length}
                subfolderCount={directSubs.length}
                onOpen={() => handleDirectStudyFolder(folder)}
              />
            );
          })}
        </div>
      ) : null}

      {/* Modal 1: Preparação de Estudo (Fluxo em 2 Passos) */}
      {prepFolder && (
        <FolderStudyPrepModal
          folder={prepFolder}
          folders={folders}
          sources={sources}
          dueByFolder={dueByFolder}
          totalByFolder={totalByFolder}
          studiedByFolder={studiedByFolder}
          onClose={() => setPrepFolder(null)}
          onStartReview={(onlyDue) => handleStartFolderStudy(prepFolder, onlyDue)}
          onStartStudySource={(source) => {
            const target = prepFolder;
            setPrepFolder(null);
            setActiveStudyFolder(target);
            setActiveStudySource(source);
          }}
          onViewCards={(folder) => {
            setPrepFolder(null);
            setManagingCardsFolder(folder);
          }}
          onManageFolder={(folder) => {
            setPrepFolder(null);
            setSelectedFolderId(folder.id);
          }}
          onCreateCard={(folderId) => {
            setPrepFolder(null);
            setCreatingCardFolderId(folderId);
            setCreatingCard(true);
          }}
          onImportAnki={(folder) => {
            setPrepFolder(null);
            setImportingAnkiFolder(folder);
            setImportingAnki(true);
          }}
          onAddSource={(folder) => {
            setPrepFolder(null);
            setAddingSourceFolder(folder);
          }}
        />
      )}



      {/* Modais Globais */}
      {creatingFolder && (
        <CreateFolderModal
          onClose={() => setCreatingFolder(false)}
          onCreated={(root, optimisticTree, isServerResult, originalTempId) => {
            if (isServerResult) {
              if (root?.id) {
                setFolders((prev) => [root, ...prev.filter((f) => f.id !== originalTempId && f.id !== root.id)]);
                setExpandedIds((prev) => new Set([...prev, root.id]));
              }
              reload();
              return;
            }
            if (Array.isArray(optimisticTree) && optimisticTree.length) {
              setFolders((prev) => [...optimisticTree, ...prev.filter((f) => !optimisticTree.some((o) => o.id === f.id))]);
              setExpandedIds((prev) => new Set([...prev, ...optimisticTree.map((o) => o.id)]));
            } else if (root) {
              setFolders((prev) => [root, ...prev.filter((f) => f.id !== root.id)]);
              setExpandedIds((prev) => new Set([...prev, root.id]));
            }
            reload();
          }}
        />
      )}

      {subfolderParent && (
        <CreateFolderModal
          parentFolder={subfolderParent}
          onClose={() => setSubfolderParent(null)}
          onCreated={(root, optimisticTree, isServerResult, originalTempId) => {
            if (isServerResult) {
              if (root?.id) {
                setFolders((prev) => [root, ...prev.filter((f) => f.id !== originalTempId && f.id !== root.id)]);
                setExpandedIds((prev) => new Set([...prev, root.id]));
              }
              reload();
              return;
            }
            if (Array.isArray(optimisticTree) && optimisticTree.length) {
              setFolders((prev) => [...optimisticTree, ...prev.filter((f) => !optimisticTree.some((o) => o.id === f.id))]);
              setExpandedIds((prev) => new Set([...prev, ...optimisticTree.map((o) => o.id)]));
            } else if (root) {
              setFolders((prev) => [root, ...prev.filter((f) => f.id !== root.id)]);
              setExpandedIds((prev) => new Set([...prev, root.id]));
            }
            reload();
          }}
        />
      )}

      {editingFolderTarget && (
        <EditFolderModal
          folder={editingFolderTarget}
          onClose={() => setEditingFolderTarget(null)}
          onUpdated={() => reload()}
        />
      )}

      {deletingFolderTarget && (
        <DeleteFolderModal
          folder={deletingFolderTarget}
          onClose={() => setDeletingFolderTarget(null)}
          onDeleted={handleDeleteFolder}
        />
      )}

      {creatingCard && (
        <CreateFlashcardModal
          userId={activeUserId}
          folders={folders}
          initialFolderId={creatingCardFolderId || ''}
          onClose={() => { setCreatingCard(false); setCreatingCardFolderId(null); }}
          onSaved={reload}
        />
      )}

      {addingSourceFolder && (
        <AddSourceModal
          userId={activeUserId}
          folder={addingSourceFolder}
          sources={sources}
          onClose={() => setAddingSourceFolder(null)}
          onCreated={() => {}}
          onStartStudy={(source) => {
            const target = addingSourceFolder;
            setAddingSourceFolder(null);
            setActiveStudyFolder(target);
            setActiveStudySource(source);
          }}
        />
      )}

      {importingAnki && (
        <AnkiImportModal
          userId={activeUserId}
          folders={folders}
          lockedFolder={importingAnkiFolder}
          onClose={() => { setImportingAnki(false); setImportingAnkiFolder(null); }}
          onImported={(destFolderId, report) => {
            reload();
            setImportSummary(report);
          }}
        />
      )}

      {importSummary && (
        <AnkiImportSummaryModal
          report={importSummary}
          onClose={() => setImportSummary(null)}
          onViewFolder={(destId) => {
            setImportSummary(null);
            const found = folders.find((f) => f.id === destId);
            if (found) setPrepFolder(found);
          }}
        />
      )}
    </main>
  );
}
