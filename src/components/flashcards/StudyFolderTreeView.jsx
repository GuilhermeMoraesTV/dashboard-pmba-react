import React, { useCallback, useMemo, useState } from 'react';
import {
  BookOpen,
  ChevronDown,
  ChevronRight,
  Edit2,
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

function TreeNode({
  node,
  level = 0,
  expandedIds,
  onToggleExpand,
  onOpenFolder,
  onEditFolder,
  onDeleteFolder,
  onCreateSubfolder,
  onReviewFolder,
  dueByFolder = {},
  totalByFolder = {},
  studiedByFolder = {},
}) {
  const folder = node.folder;
  const hasChildren = node.children && node.children.length > 0;
  const isExpanded = expandedIds.has(folder.id);
  const colorInfo = getFolderColorInfo(folder.color);

  const totalCards = totalByFolder[folder.id] || 0;
  const dueCards = dueByFolder[folder.id] || 0;
  const studiedCards = studiedByFolder[folder.id] || 0;

  return (
    <div className="select-none">
      <div
        className={`group relative flex items-center justify-between rounded-xl px-2.5 py-2 transition-all hover:bg-slate-100/80 dark:hover:bg-slate-800/60 ${
          level > 0 ? 'ml-3 sm:ml-5' : ''
        }`}
        style={{
          borderLeft: level > 0 ? '2px solid rgba(226, 232, 240, 0.6)' : undefined,
        }}
      >
        {/* Lado Esquerdo: Expansão + Ícone + Nome */}
        <div className="flex min-w-0 flex-1 items-center gap-2">
          {hasChildren ? (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onToggleExpand(folder.id);
              }}
              aria-label={isExpanded ? 'Recolher subpastas' : 'Expandir subpastas'}
              className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-200 hover:text-slate-700 dark:hover:bg-slate-700 dark:hover:text-slate-200"
            >
              {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
            </button>
          ) : (
            <span className="w-6 shrink-0" />
          )}

          <div
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg shadow-sm"
            style={{ backgroundColor: colorInfo.hex || '#dc2626', color: '#ffffff' }}
          >
            <Folder size={14} />
          </div>

          <button
            type="button"
            onClick={() => onOpenFolder(folder)}
            className="truncate text-left text-sm font-bold text-slate-900 transition hover:text-red-600 dark:text-white dark:hover:text-red-400"
            title={folder.name}
          >
            {folder.name}
          </button>
        </div>

        {/* Centro / Lado Direito: Estatísticas Compactas */}
        <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
          <span
            className="hidden rounded-lg bg-slate-100 px-2 py-0.5 text-[11px] font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-300 sm:inline-block"
            title="Total de flashcards"
          >
            {totalCards.toLocaleString('pt-BR')} cards
          </span>

          {dueCards > 0 ? (
            <span
              className="rounded-lg bg-red-500/10 px-2 py-0.5 text-[11px] font-black text-red-600 dark:text-red-400"
              title="Flashcards devidos para revisão"
            >
              {dueCards.toLocaleString('pt-BR')} devidos
            </span>
          ) : totalCards > 0 ? (
            <span className="hidden rounded-lg bg-emerald-500/10 px-2 py-0.5 text-[11px] font-bold text-emerald-600 dark:text-emerald-400 md:inline-block">
              Em dia
            </span>
          ) : null}

          {studiedCards > 0 ? (
            <span
              className="hidden rounded-lg bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-500 dark:bg-slate-800 dark:text-slate-400 lg:inline-block"
              title="Cards estudados"
            >
              {studiedCards.toLocaleString('pt-BR')} estudados
            </span>
          ) : null}

          {/* Botões de Ação Rápida */}
          <div className="flex items-center gap-0.5 opacity-80 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
            {totalCards > 0 && onReviewFolder ? (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onReviewFolder(folder);
                }}
                title="Revisar flashcards desta pasta"
                className="rounded-lg p-1 text-slate-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/20"
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
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-200 hover:text-slate-700 dark:hover:bg-slate-700 dark:hover:text-slate-200"
              >
                <FolderPlus size={14} />
              </button>
            ) : null}

            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onEditFolder(folder);
              }}
              title="Editar pasta"
              className="rounded-lg p-1 text-slate-400 hover:bg-slate-200 hover:text-slate-700 dark:hover:bg-slate-700 dark:hover:text-slate-200"
            >
              <Edit2 size={14} />
            </button>

            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onDeleteFolder(folder);
              }}
              title="Excluir pasta"
              className="rounded-lg p-1 text-slate-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/20"
            >
              <Trash2 size={14} />
            </button>
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
              onEditFolder={onEditFolder}
              onDeleteFolder={onDeleteFolder}
              onCreateSubfolder={onCreateSubfolder}
              onReviewFolder={onReviewFolder}
              dueByFolder={dueByFolder}
              totalByFolder={totalByFolder}
              studiedByFolder={studiedByFolder}
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
  dueByFolder = {},
  onOpenFolder,
  onEditFolder,
  onDeleteFolder,
  onCreateSubfolder,
  onReviewFolder,
}) {
  const { totalByFolder, studiedByFolder, tree } = useMemo(() => {
    const directCardsMap = {};
    for (const deck of decks) {
      if (deck.folderId) {
        directCardsMap[deck.folderId] = (directCardsMap[deck.folderId] || 0) + Number(deck.cardCount || 0);
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
    const studiedAccum = {};
    const calcTotals = (node) => {
      let sum = directCardsMap[node.folder.id] || 0;
      let studied = 0;
      for (const child of node.children) {
        const childTotals = calcTotals(child);
        sum += childTotals.total;
        studied += childTotals.studied;
      }
      totalAccum[node.folder.id] = sum;
      studiedAccum[node.folder.id] = studied;
      return { total: sum, studied };
    };
    rootNodes.forEach(calcTotals);

    return { totalByFolder: totalAccum, studiedByFolder: studiedAccum, tree: rootNodes };
  }, [decks, folders]);

  const [expandedIds, setExpandedIds] = useState(() => {
    const initial = new Set();
    for (const node of tree) {
      initial.add(node.folder.id);
    }
    return initial;
  });

  const handleToggleExpand = useCallback((folderId) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(folderId)) next.delete(folderId);
      else next.add(folderId);
      return next;
    });
  }, []);

  const expandAll = () => {
    const all = new Set();
    const collect = (nodes) => {
      nodes.forEach((n) => {
        all.add(n.folder.id);
        collect(n.children);
      });
    };
    collect(tree);
    setExpandedIds(all);
  };

  const collapseAll = () => {
    setExpandedIds(new Set());
  };

  if (!folders.length) {
    return (
      <div className="rounded-3xl border-2 border-dashed border-slate-200 p-8 text-center dark:border-slate-800">
        <Folder size={32} className="mx-auto text-slate-400" />
        <h3 className="mt-3 text-base font-bold text-slate-800 dark:text-slate-200">Nenhuma pasta criada ainda</h3>
        <p className="mt-1 text-xs text-slate-500">Crie uma nova pasta ou importe um pacote Anki para organizar seus flashcards.</p>
      </div>
    );
  }

  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-5">
      <div className="mb-3 flex items-center justify-between border-b border-slate-100 pb-3 dark:border-slate-800">
        <div className="flex items-center gap-2">
          <Layers size={17} className="text-red-600" />
          <h2 className="text-sm font-black uppercase tracking-wider text-slate-900 dark:text-white">
            Árvore de Pastas & Baralhos
          </h2>
        </div>
        <div className="flex items-center gap-2 text-xs font-bold text-slate-400">
          <button
            type="button"
            onClick={expandAll}
            className="hover:text-red-600 transition-colors"
          >
            Expandir tudo
          </button>
          <span>•</span>
          <button
            type="button"
            onClick={collapseAll}
            className="hover:text-red-600 transition-colors"
          >
            Recolher tudo
          </button>
        </div>
      </div>

      <div className="space-y-0.5">
        {tree.map((node) => (
          <TreeNode
            key={node.folder.id}
            node={node}
            level={0}
            expandedIds={expandedIds}
            onToggleExpand={handleToggleExpand}
            onOpenFolder={onOpenFolder}
            onEditFolder={onEditFolder}
            onDeleteFolder={onDeleteFolder}
            onCreateSubfolder={onCreateSubfolder}
            onReviewFolder={onReviewFolder}
            dueByFolder={dueByFolder}
            totalByFolder={totalByFolder}
            studiedByFolder={studiedByFolder}
          />
        ))}
      </div>
    </div>
  );
}
