import React, { useCallback, useMemo, useRef, useState, useEffect } from 'react';
import {
  BookOpen,
  ChevronDown,
  ChevronRight,
  CornerDownRight,
  Edit2,
  Eye,
  Folder,
  FolderPlus,
  Layers,
  MoreVertical,
  Plus,
  Sparkles,
  Trash2,
} from 'lucide-react';
import { DISCIPLINE_COLOR_PALETTE, getColorByHex, getColorById } from '../../utils/disciplineColors.js';

function getFolderColorInfo(colorKey) {
  if (!colorKey) return DISCIPLINE_COLOR_PALETTE[0];
  return getColorById(colorKey) || getColorByHex(colorKey) || DISCIPLINE_COLOR_PALETTE[0];
}

function FolderActionsDropdown({
  folder,
  totalCards,
  dueCards,
  sources = [],
  onOpenFolder,
  onStudyAI,
  onReviewFolder,
  onManageCards,
  onManageFolder,
  onCreateSubfolder,
  onEditFolder,
  onDeleteFolder,
}) {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef(null);

  const hasReadySource = sources.some((s) => s.folderId === folder.id && s.status === 'ready');

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  return (
    <div className="relative inline-flex items-center" ref={menuRef}>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen((prev) => !prev);
        }}
        title="Mais opções da pasta"
        aria-label="Mais opções da pasta"
        className="flex h-7 w-7 items-center justify-center rounded-lg text-zinc-400 transition hover:bg-zinc-200 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
      >
        <MoreVertical size={15} />
      </button>

      {isOpen && (
        <div
          role="menu"
          onClick={(e) => e.stopPropagation()}
          className="absolute right-0 top-full z-50 mt-1 w-52 rounded-xl border border-zinc-200 bg-white py-1.5 shadow-xl dark:border-zinc-800 dark:bg-card-dark animate-in fade-in zoom-in-95 duration-150"
        >
          {hasReadySource && onStudyAI && (
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setIsOpen(false);
                onStudyAI(folder);
              }}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-semibold text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/30"
            >
              <Sparkles size={14} />
              <span>Estudar com IA</span>
            </button>
          )}

          {totalCards > 0 && onReviewFolder && (
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setIsOpen(false);
                onReviewFolder(folder);
              }}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-semibold text-zinc-700 hover:bg-zinc-100 dark:text-zinc-200 dark:hover:bg-zinc-800/60"
            >
              <BookOpen size={14} className="text-zinc-500 dark:text-zinc-400" />
              <span>Revisar Flashcards</span>
            </button>
          )}

          {onManageCards && (
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setIsOpen(false);
                onManageCards(folder);
              }}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-semibold text-zinc-700 hover:bg-zinc-100 dark:text-zinc-200 dark:hover:bg-zinc-800/60"
            >
              <Eye size={14} className="text-zinc-400" />
              <span>Ver Flashcards</span>
            </button>
          )}

          {onManageFolder && (
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setIsOpen(false);
                onManageFolder(folder);
              }}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-semibold text-zinc-700 hover:bg-zinc-100 dark:text-zinc-200 dark:hover:bg-zinc-800/60"
            >
              <Layers size={14} className="text-zinc-400" />
              <span>Gerenciar Pasta & Fontes</span>
            </button>
          )}

          {onCreateSubfolder && (
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setIsOpen(false);
                onCreateSubfolder(folder);
              }}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-semibold text-zinc-700 hover:bg-zinc-100 dark:text-zinc-200 dark:hover:bg-zinc-800/60"
            >
              <FolderPlus size={14} className="text-zinc-400" />
              <span>Nova subpasta</span>
            </button>
          )}

          {onEditFolder && (
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setIsOpen(false);
                onEditFolder(folder);
              }}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-semibold text-zinc-700 hover:bg-zinc-100 dark:text-zinc-200 dark:hover:bg-zinc-800/60"
            >
              <Edit2 size={14} className="text-zinc-400" />
              <span>Editar pasta</span>
            </button>
          )}

          {onDeleteFolder && (
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setIsOpen(false);
                onDeleteFolder(folder);
              }}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-semibold text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/30"
            >
              <Trash2 size={14} />
              <span>Excluir pasta</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function TreeNode({
  node,
  level = 0,
  expandedIds,
  onToggleExpand,
  onOpenFolder,
  onStudyAI,
  onManageCards,
  onManageFolder,
  onEditFolder,
  onDeleteFolder,
  onCreateSubfolder,
  onReviewFolder,
  sources = [],
  dueByFolder = {},
  totalByFolder = {},
  studiedByFolder = {},
  loadingMetrics = false,
}) {
  const folder = node.folder;
  const hasChildren = node.children && node.children.length > 0;
  const isExpanded = expandedIds.has(folder.id);
  const colorInfo = getFolderColorInfo(folder.color);

  const totalCards = Number(totalByFolder[folder.id] ?? 0);
  const dueCards = Number(dueByFolder[folder.id] ?? 0);
  const studiedCards = Number(studiedByFolder[folder.id] ?? 0);

  // Indentação cumulativa precisa somente na coluna de nome
  const indentPx = level * 20;

  return (
    <div className="select-none">
      <div
        role="button"
        tabIndex={0}
        onClick={() => onOpenFolder(folder)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onOpenFolder(folder);
          }
        }}
        className="group relative flex items-center justify-between rounded-xl border border-transparent px-2.5 py-1.5 transition-all hover:border-zinc-200/60 hover:bg-zinc-100/70 focus:outline-none focus:ring-1 focus:ring-red-500/40 dark:hover:border-zinc-800/80 dark:hover:bg-zinc-800/40 cursor-pointer"
      >
        {/* Coluna 1: Nome da Pasta com Indentação Cumulativa */}
        <div
          className="flex min-w-0 flex-1 items-center gap-1.5 sm:gap-2"
          style={{ paddingLeft: `${indentPx}px` }}
        >
          {/* Indicador visual de hierarquia em níveis > 0 */}
          {level > 0 && (
            <span
              aria-hidden="true"
              className="mr-0.5 inline-block shrink-0 text-zinc-300 dark:text-zinc-600"
            >
              <CornerDownRight size={13} strokeWidth={2.5} />
            </span>
          )}

          {/* Botão de Expansão / Chevron */}
          {hasChildren ? (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onToggleExpand(folder.id);
              }}
              aria-label={isExpanded ? 'Recolher subpastas' : 'Expandir subpastas'}
              className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg text-zinc-400 transition hover:bg-zinc-200 hover:text-zinc-800 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
            >
              {isExpanded ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
            </button>
          ) : (
            <span className="w-6 shrink-0" aria-hidden="true" />
          )}

          {/* Ícone com Cor da Pasta */}
          <div
            className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg shadow-sm"
            style={{ backgroundColor: colorInfo.hex || '#dc2626', color: '#ffffff' }}
          >
            <Folder size={13} />
          </div>

          {/* Nome da Pasta */}
          <span
            className="truncate text-left text-xs sm:text-sm font-bold text-zinc-900 transition group-hover:text-red-600 dark:text-zinc-100 dark:group-hover:text-red-400"
            title={folder.name}
          >
            {folder.name}
          </span>
        </div>

        {/* Colunas Compartilhadas: Total | Para revisar | Estudados | Ações */}
        <div className="flex shrink-0 items-center gap-1 sm:gap-2 text-xs">
          {/* Coluna Total */}
          <div className="w-16 sm:w-20 text-right">
            {loadingMetrics ? (
              <span className="inline-block h-4 w-10 animate-pulse rounded bg-zinc-200 dark:bg-zinc-800" />
            ) : (
              <span
                className="inline-block font-bold text-zinc-700 dark:text-zinc-300"
                title={`${totalCards.toLocaleString('pt-BR')} cards no total`}
              >
                {totalCards.toLocaleString('pt-BR')}
                <span className="ml-1 text-[10px] font-normal text-zinc-400 hidden md:inline">cards</span>
              </span>
            )}
          </div>

          {/* Coluna Para revisar */}
          <div className="w-20 sm:w-24 text-right">
            {loadingMetrics ? (
              <span className="inline-block h-4 w-10 animate-pulse rounded bg-zinc-200 dark:bg-zinc-800" />
            ) : dueCards > 0 ? (
              <span
                className="inline-flex items-center rounded-md bg-red-500/10 px-2 py-0.5 text-[11px] font-black text-red-600 dark:text-red-400"
                title={`${dueCards.toLocaleString('pt-BR')} devidos para revisão`}
              >
                {dueCards.toLocaleString('pt-BR')}
                <span className="ml-1 text-[9px] font-bold uppercase hidden md:inline">pendentes</span>
              </span>
            ) : (
              <span
                className="inline-block font-semibold text-zinc-400 dark:text-zinc-500 text-[11px]"
                title="Nenhum card pendente"
              >
                0
                <span className="ml-1 text-[9px] hidden md:inline font-normal">pendentes</span>
              </span>
            )}
          </div>

          {/* Coluna Estudados */}
          <div className="w-16 sm:w-20 text-right">
            {loadingMetrics ? (
              <span className="inline-block h-4 w-10 animate-pulse rounded bg-zinc-200 dark:bg-zinc-800" />
            ) : (
              <span
                className="inline-block font-medium text-zinc-500 dark:text-zinc-400 text-[11px]"
                title={`${studiedCards.toLocaleString('pt-BR')} cards já estudados`}
              >
                {studiedCards.toLocaleString('pt-BR')}
                <span className="ml-1 text-[9px] font-normal text-zinc-400 hidden lg:inline">estudados</span>
              </span>
            )}
          </div>

          {/* Coluna Ações */}
          <div
            className="w-20 sm:w-24 flex items-center justify-end gap-1"
            onClick={(e) => e.stopPropagation()}
          >
            {totalCards > 0 ? (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onOpenFolder(folder);
                }}
                title={dueCards > 0 ? `Revisar ${dueCards} pendentes` : 'Estudar flashcards'}
                className="flex h-7 w-7 items-center justify-center rounded-lg text-zinc-400 transition hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/20"
              >
                <BookOpen size={14} />
              </button>
            ) : null}

            {onCreateSubfolder ? (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onCreateSubfolder(folder);
                }}
                title="Adicionar subpasta"
                className="hidden sm:flex h-7 w-7 items-center justify-center rounded-lg text-zinc-400 transition hover:bg-zinc-200 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
              >
                <FolderPlus size={14} />
              </button>
            ) : null}

            <FolderActionsDropdown
              folder={folder}
              totalCards={totalCards}
              dueCards={dueCards}
              sources={sources}
              onOpenFolder={onOpenFolder}
              onStudyAI={onStudyAI}
              onReviewFolder={onReviewFolder}
              onManageCards={onManageCards}
              onManageFolder={onManageFolder}
              onCreateSubfolder={onCreateSubfolder}
              onEditFolder={onEditFolder}
              onDeleteFolder={onDeleteFolder}
            />
          </div>
        </div>
      </div>

      {/* Filhos Recursivos */}
      {hasChildren && isExpanded && (
        <div className="space-y-0.5">
          {node.children.map((child) => (
            <TreeNode
              key={child.folder.id}
              node={child}
              level={level + 1}
              expandedIds={expandedIds}
              onToggleExpand={onToggleExpand}
              onOpenFolder={onOpenFolder}
              onStudyAI={onStudyAI}
              onManageCards={onManageCards}
              onManageFolder={onManageFolder}
              onEditFolder={onEditFolder}
              onDeleteFolder={onDeleteFolder}
              onCreateSubfolder={onCreateSubfolder}
              onReviewFolder={onReviewFolder}
              sources={sources}
              dueByFolder={dueByFolder}
              totalByFolder={totalByFolder}
              studiedByFolder={studiedByFolder}
              loadingMetrics={loadingMetrics}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function StudyFolderTreeView({
  folders = [],
  decks = [],
  sources = [],
  directDueByFolder = {},
  directTotalByFolder = {},
  directStudiedByFolder = {},
  loadingMetrics = false,
  onOpenFolder,
  onStudyAI,
  onManageCards,
  onManageFolder,
  onEditFolder,
  onDeleteFolder,
  onCreateSubfolder,
  onReviewFolder,
  expandedIds: externalExpandedIds,
  onToggleExpand: externalOnToggleExpand,
  onExpandAll,
  onCollapseAll,
}) {
  const { totalByFolder, dueByFolder, studiedByFolder, tree } = useMemo(() => {
    const directCardsMap = { ...directTotalByFolder };
    if (Object.keys(directTotalByFolder).length === 0) {
      for (const deck of decks) {
        if (deck.folderId) {
          directCardsMap[deck.folderId] = (directCardsMap[deck.folderId] || 0) + Number(deck.cardCount || 0);
        }
      }
    }

    const folderMap = new Map();
    for (const folder of folders) {
      folderMap.set(folder.id, { folder, children: [] });
    }

    const rootNodes = [];
    for (const folder of folders) {
      const node = folderMap.get(folder.id);
      if (folder.parentFolderId && folderMap.has(folder.parentFolderId)) {
        folderMap.get(folder.parentFolderId).children.push(node);
      } else {
        rootNodes.push(node);
      }
    }

    const sortNodes = (nodes) => {
      nodes.sort((a, b) => {
        const orderA = a.folder.order != null ? Number(a.folder.order) : 999999;
        const orderB = b.folder.order != null ? Number(b.folder.order) : 999999;
        if (orderA !== orderB) return orderA - orderB;
        return (a.folder.name || '').localeCompare(b.folder.name || '', 'pt-BR', { numeric: true, sensitivity: 'base' });
      });
      nodes.forEach((n) => sortNodes(n.children));
    };
    sortNodes(rootNodes);

    const totalAccum = {};
    const dueAccum = {};
    const studiedAccum = {};
    const calcTotals = (node) => {
      let sum = directCardsMap[node.folder.id] || 0;
      let due = directDueByFolder[node.folder.id] || 0;
      let studied = directStudiedByFolder[node.folder.id] || 0;
      for (const child of node.children) {
        const childTotals = calcTotals(child);
        sum += childTotals.total;
        due += childTotals.due;
        studied += childTotals.studied;
      }
      totalAccum[node.folder.id] = sum;
      dueAccum[node.folder.id] = due;
      studiedAccum[node.folder.id] = studied;
      return { total: sum, due, studied };
    };
    rootNodes.forEach(calcTotals);

    return { totalByFolder: totalAccum, dueByFolder: dueAccum, studiedByFolder: studiedAccum, tree: rootNodes };
  }, [decks, directDueByFolder, directStudiedByFolder, directTotalByFolder, folders]);

  const [internalExpandedIds, setInternalExpandedIds] = useState(() => {
    const initial = new Set();
    for (const node of tree) {
      initial.add(node.folder.id);
    }
    return initial;
  });

  const expandedIds = externalExpandedIds || internalExpandedIds;

  const handleToggleExpand = useCallback((folderId) => {
    if (externalOnToggleExpand) {
      externalOnToggleExpand(folderId);
      return;
    }
    setInternalExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(folderId)) next.delete(folderId);
      else next.add(folderId);
      return next;
    });
  }, [externalOnToggleExpand]);

  const expandAll = () => {
    if (onExpandAll) {
      onExpandAll();
      return;
    }
    const all = new Set();
    const collect = (nodes) => {
      nodes.forEach((n) => {
        all.add(n.folder.id);
        collect(n.children);
      });
    };
    collect(tree);
    setInternalExpandedIds(all);
  };

  const collapseAll = () => {
    if (onCollapseAll) {
      onCollapseAll();
      return;
    }
    setInternalExpandedIds(new Set());
  };

  if (!folders.length) {
    return (
      <div className="rounded-3xl border-2 border-dashed border-zinc-200 p-8 text-center dark:border-zinc-800">
        <Folder size={32} className="mx-auto text-zinc-400" />
        <h3 className="mt-3 text-base font-bold text-zinc-800 dark:text-zinc-200">Nenhuma pasta criada ainda</h3>
        <p className="mt-1 text-xs text-zinc-500">Crie uma nova pasta ou importe um pacote Anki para organizar seus flashcards.</p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-3 shadow-sm dark:border-zinc-800 dark:bg-card-dark sm:p-4 overflow-hidden">
      {/* Cabeçalho da Tabela Compartilhada */}
      <div className="overflow-x-auto custom-scrollbar">
        <div className="min-w-[480px] sm:min-w-0">
          <div className="mb-2 flex items-center justify-between border-b border-zinc-100 pb-2.5 px-2.5 text-[11px] font-black uppercase tracking-wider text-zinc-400 dark:border-zinc-800/80">
            <div className="flex-1">
              <span>Pasta</span>
            </div>
            <div className="flex shrink-0 items-center gap-1 sm:gap-2">
              <span className="w-16 sm:w-20 text-right">Total</span>
              <span className="w-20 sm:w-24 text-right">Para revisar</span>
              <span className="w-16 sm:w-20 text-right">Estudados</span>
              <span className="w-20 sm:w-24 text-right pr-2">Ações</span>
            </div>
          </div>

          {/* Linhas da Árvore */}
          <div className="space-y-0.5">
            {tree.map((node) => (
              <TreeNode
                key={node.folder.id}
                node={node}
                level={0}
                expandedIds={expandedIds}
                onToggleExpand={handleToggleExpand}
                onOpenFolder={onOpenFolder}
                onStudyAI={onStudyAI}
                onManageCards={onManageCards}
                onManageFolder={onManageFolder}
                onEditFolder={onEditFolder}
                onDeleteFolder={onDeleteFolder}
                onCreateSubfolder={onCreateSubfolder}
                onReviewFolder={onReviewFolder}
                sources={sources}
                dueByFolder={dueByFolder}
                totalByFolder={totalByFolder}
                studiedByFolder={studiedByFolder}
                loadingMetrics={loadingMetrics}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
