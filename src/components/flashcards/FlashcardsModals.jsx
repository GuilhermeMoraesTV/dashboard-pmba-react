import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  AlertTriangle,
  ArrowRight,
  BookOpen,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Edit2,
  ExternalLink,
  Eye,
  FileArchive,
  Folder,
  FolderPlus,
  HelpCircle,
  Layers,
  Loader2,
  Pencil,
  Plus,
  RotateCcw,
  Search,
  Sparkles,
  Tag,
  Trash2,
  X,
} from 'lucide-react';
import {
  createStudyFolder,
  createStudyFolderTree,
  deleteStudyFolder,
  updateStudyFolder,
  updateStudySourceTitle,
} from '../../services/studySources/studySourcesService.js';
import { auth } from '../../firebaseConfig.js';
import {
  createFolderFlashcard,
} from '../../services/flashcards/flashcardsService.js';
import { findReusableAnkiFolder, importAnkiPackage } from '../../services/anki/ankiService.js';
import { DISCIPLINE_COLOR_PALETTE, getColorByHex, getColorById } from '../../utils/disciplineColors.js';
import ColorisSwatch from '../shared/ColorisSwatch.jsx';
import FlashcardEditor from './FlashcardEditor.jsx';
import {
  getDescendantFolderIds,
  getBreadcrumbs,
  folderColorHex,
} from '../../utils/folderHierarchy.js';

export { getDescendantFolderIds, getBreadcrumbs, folderColorHex };

function readableError(error) {
  const details = typeof error?.details === 'string' ? error.details : (error?.details?.message || '');
  const message = error?.message || error?.code || 'Não foi possível concluir a operação.';
  const raw = details ? `${message} (${details})` : message;
  return String(raw).replace(/^FirebaseError:\s*/i, '').slice(0, 400);
}

export function FlashcardsDialog({ title, eyebrow, onClose, children, maxWidth = 'max-w-lg', bodyClassName = 'overflow-y-auto pr-1', dialogClassName = '' }) {
  return createPortal(
    <div
      role="presentation"
      onClick={onClose}
      className="fixed inset-0 z-[10040] flex items-center justify-center bg-black/65 p-3 backdrop-blur-sm animate-in fade-in duration-200 sm:p-4"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        onClick={(e) => e.stopPropagation()}
        className={`flex max-h-[calc(100dvh-1.5rem)] w-full ${maxWidth} flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white p-4 shadow-2xl dark:border-zinc-800 dark:bg-card-dark animate-in zoom-in-95 duration-200 sm:max-h-[calc(100dvh-2rem)] sm:rounded-3xl sm:p-6 ${dialogClassName}`}
      >
        <div className="flex items-center justify-between border-b border-zinc-100 pb-3.5 dark:border-zinc-800">
          <div>
            {eyebrow ? (
              <p className="text-[11px] font-black uppercase tracking-wider text-red-600 dark:text-red-400">
                {eyebrow}
              </p>
            ) : null}
            <h2 id="modal-title" className="text-lg font-black text-zinc-950 dark:text-white">
              {title}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="rounded-full p-2 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-800 dark:hover:text-zinc-200 transition"
          >
            <X size={18} />
          </button>
        </div>
        <div className={`mt-4 min-h-0 flex-1 ${bodyClassName}`}>
          {children}
        </div>
      </div>
    </div>,
    document.body,
  );
}

const Modal = FlashcardsDialog;

/**
 * Seletor de Cores reutilizando a paleta do Ciclo + CorisSwatch Personalizada
 */
function ColorPaletteSelector({ selectedColor, onSelectColor }) {
  const currentHex = selectedColor?.startsWith?.('#')
    ? selectedColor
    : (getColorById(selectedColor)?.hex || '#dc2626');

  return (
    <div className="space-y-3">
      <label className="block text-sm font-bold text-zinc-700 dark:text-zinc-200">
        Cor da Pasta
      </label>
      <div className="flex flex-wrap gap-2">
        {DISCIPLINE_COLOR_PALETTE.map((color) => {
          const isSelected = selectedColor === color.id || selectedColor === color.hex;
          return (
            <button
              key={color.id}
              type="button"
              onClick={() => onSelectColor(color.id)}
              title={color.name}
              aria-label={`Cor ${color.name}`}
              className={`h-7 w-7 rounded-full transition-transform hover:scale-110 ${
                isSelected
                  ? 'ring-2 ring-zinc-950 ring-offset-2 dark:ring-white dark:ring-offset-zinc-900 scale-110 shadow-sm'
                  : 'opacity-90 hover:opacity-100'
              }`}
              style={{ backgroundColor: color.hex }}
            />
          );
        })}
      </div>

      {/* Cor personalizada com ColorisSwatch */}
      <div className="flex items-center gap-3 p-3 bg-zinc-50 dark:bg-zinc-900/60 rounded-xl border border-zinc-200 dark:border-zinc-800">
        <ColorisSwatch
          value={currentHex}
          onChange={(color) => onSelectColor(color)}
          label="Escolher cor personalizada da pasta"
          sizeClass="h-8 w-8"
        />
        <div className="flex-1">
          <p className="text-xs font-bold text-zinc-700 dark:text-zinc-300">Cor Personalizada</p>
          <p className="text-xs font-mono text-zinc-500 dark:text-zinc-400 mt-0.5">{currentHex}</p>
        </div>
      </div>
    </div>
  );
}

/**
 * Modal de Confirmação Visual Padrão ModoQAP
 */
export function ConfirmDeleteModal({
  title = 'Excluir Item',
  message,
  confirmLabel = 'Confirmar Exclusão',
  onClose,
  onConfirm,
  busy = false,
  error = null,
}) {
  return (
    <Modal title={title} eyebrow="Atenção" onClose={onClose} maxWidth="max-w-md">
      <div className="space-y-4">
        <div className="flex items-start gap-3 rounded-2xl bg-red-500/10 p-4 dark:bg-red-950/30">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-600 text-white shadow-sm">
            <Trash2 size={20} />
          </div>
          <div className="text-sm text-zinc-700 dark:text-zinc-300">
            {message}
          </div>
        </div>

        {error ? (
          <p role="alert" className="rounded-xl bg-red-500/10 px-3 py-2 text-sm text-red-700 dark:text-red-300">
            {error}
          </p>
        ) : null}

        <div className="flex justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="rounded-xl px-4 py-2.5 text-sm font-bold text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800 transition"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className="inline-flex items-center gap-2 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-bold text-white shadow-md shadow-red-600/20 hover:bg-red-700 disabled:opacity-50 transition"
          >
            {busy ? <Loader2 size={16} className="animate-spin" /> : null}
            {confirmLabel}
          </button>
        </div>
      </div>
    </Modal>
  );
}

/**
 * Seletor Hierárquico de Pastas com Busca e Caminho Completo (Padrão RegistroEstudoModal)
 */
export function CustomFolderSelect({
  folders = [],
  selectedFolderId,
  onSelectFolder,
  placeholder = 'Selecione uma pasta...',
  searchPlaceholder = 'Buscar pasta...',
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const containerRef = useRef(null);

  const folderPaths = useMemo(() => {
    const folderById = new Map(folders.map((f) => [f.id, f]));
    return folders.map((folder) => {
      const parts = [folder.name];
      let current = folder;
      const visited = new Set([folder.id]);
      while (current.parentFolderId && folderById.has(current.parentFolderId) && !visited.has(current.parentFolderId)) {
        current = folderById.get(current.parentFolderId);
        visited.add(current.id);
        parts.unshift(current.name);
      }
      return {
        id: folder.id,
        name: folder.name,
        color: folder.color,
        fullPath: parts.join(' › '),
        level: parts.length - 1,
      };
    });
  }, [folders]);

  const filtered = useMemo(() => {
    if (!searchTerm.trim()) return folderPaths;
    const term = searchTerm.toLowerCase();
    return folderPaths.filter((item) => item.fullPath.toLowerCase().includes(term));
  }, [folderPaths, searchTerm]);

  const selectedItem = folderPaths.find((item) => item.id === selectedFolderId);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex w-full items-center justify-between rounded-xl border border-zinc-300 bg-white px-3 py-2.5 text-left text-sm transition focus:border-red-500 focus:outline-none dark:border-zinc-700 dark:bg-card-dark dark:text-white"
      >
        <div className="flex min-w-0 items-center gap-2">
          {selectedItem ? (
            <>
              <div
                className="h-3 w-3 shrink-0 rounded-full"
                style={{ backgroundColor: folderColorHex(selectedItem.color) }}
              />
              <span className="truncate font-semibold">{selectedItem.fullPath}</span>
            </>
          ) : (
            <span className="text-zinc-400">{placeholder}</span>
          )}
        </div>
        <ChevronDown size={16} className="shrink-0 text-zinc-400" />
      </button>

      {isOpen && (
        <div className="absolute left-0 right-0 top-full z-50 mt-1 max-h-60 overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-xl dark:border-zinc-800 dark:bg-card-dark">
          <div className="border-b border-zinc-100 p-2 dark:border-zinc-800">
            <div className="relative">
              <Search size={14} className="absolute left-2.5 top-2.5 text-zinc-400" />
              <input
                type="text"
                autoFocus
                placeholder={searchPlaceholder}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full rounded-xl bg-zinc-50 py-1.5 pl-8 pr-3 text-xs outline-none focus:bg-white dark:bg-zinc-900/60 dark:text-white"
              />
            </div>
          </div>

          <div className="max-h-48 overflow-y-auto p-1 custom-scrollbar">
            {filtered.length === 0 ? (
              <div className="p-3 text-center text-xs text-zinc-400">Nenhuma pasta encontrada</div>
            ) : (
              filtered.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    onSelectFolder(item.id);
                    setIsOpen(false);
                    setSearchTerm('');
                  }}
                  className={`flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-xs transition ${
                    item.id === selectedFolderId
                      ? 'bg-red-50 font-bold text-red-600 dark:bg-red-950/30 dark:text-red-400'
                      : 'text-zinc-700 hover:bg-zinc-50 dark:text-zinc-200 dark:hover:bg-zinc-800/50'
                  }`}
                  style={{ paddingLeft: `${Math.max(12, item.level * 16 + 12)}px` }}
                >
                  <div
                    className="h-2 w-2 shrink-0 rounded-full"
                    style={{ backgroundColor: folderColorHex(item.color) }}
                  />
                  <span className="truncate">{item.name}</span>
                  {item.level > 0 ? (
                    <span className="ml-auto text-[10px] text-zinc-400 opacity-60">
                      {item.fullPath}
                    </span>
                  ) : null}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Modal de Criação de Pasta com suporte a Subpastas Irmãs e UX Otimista
 */
export function CreateFolderModal({ parentFolder = null, onClose, onCreated }) {
  const [rootName, setRootName] = useState('');
  const [subfolderNames, setSubfolderNames] = useState([]);
  const [description, setDescription] = useState('');
  const [color, setColor] = useState(parentFolder?.color || 'red');

  const addSubfolderField = () => {
    setSubfolderNames((prev) => [...prev, '']);
  };

  const updateSubfolder = (index, value) => {
    setSubfolderNames((prev) => prev.map((item, i) => (i === index ? value : item)));
  };

  const removeSubfolder = (index) => {
    setSubfolderNames((prev) => prev.filter((_, i) => i !== index));
  };

  const save = async () => {
    const cleanRoot = rootName.trim();
    if (!cleanRoot) return;

    const validSubs = subfolderNames.map((s) => s.trim()).filter(Boolean);
    const tempId = `temp_${Date.now()}`;
    const optimisticRoot = {
      id: tempId,
      name: cleanRoot,
      description: description.trim(),
      color,
      icon: 'folder',
      parentFolderId: parentFolder?.id || null,
      ancestorFolderIds: parentFolder ? [...(parentFolder.ancestorFolderIds || []), parentFolder.id] : [],
      archived: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const optimisticTree = [optimisticRoot];
    validSubs.forEach((subName, idx) => {
      optimisticTree.push({
        id: `${tempId}_sub_${idx}`,
        name: subName,
        description: '',
        color,
        icon: 'folder',
        parentFolderId: tempId,
        ancestorFolderIds: [...optimisticRoot.ancestorFolderIds, tempId],
        archived: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    });

    onCreated?.(optimisticRoot, optimisticTree);
    onClose();

    try {
      let realRoot = null;
      if (validSubs.length > 0) {
        const res = await createStudyFolderTree({
          names: [cleanRoot, ...validSubs],
          description: description.trim(),
          color,
          icon: 'folder',
          parentFolderId: parentFolder?.id || null,
          structure: 'siblings',
        });
        realRoot = res?.folders?.[0] || null;
      } else {
        realRoot = await createStudyFolder({
          name: cleanRoot,
          description: description.trim(),
          color,
          icon: 'folder',
          parentFolderId: parentFolder?.id || null,
        });
      }
      if (realRoot?.id) {
        onCreated?.(realRoot, null, true, tempId);
      }
    } catch (failure) {
      console.error('[CreateFolderModal] Falha na sincronização em background:', failure);
    }
  };

  return (
    <Modal
      title={parentFolder ? 'Nova Subpasta' : 'Nova Pasta de Estudos'}
      eyebrow={parentFolder ? `Dentro de: ${parentFolder.name}` : 'Organização'}
      onClose={onClose}
    >
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-bold text-zinc-700 dark:text-zinc-200">
            {parentFolder ? 'Nome da subpasta' : 'Nome da pasta principal'}
          </label>
          <input
            autoFocus
            value={rootName}
            maxLength={120}
            onChange={(e) => setRootName(e.target.value)}
            className="mt-1.5 w-full rounded-xl border border-zinc-300 bg-transparent px-3 py-2.5 text-sm outline-none focus:border-red-500 dark:border-zinc-700 dark:text-white"
            placeholder={parentFolder ? 'Ex.: Teoria do Crime' : 'Ex.: PMBA'}
          />
        </div>

        {!parentFolder && (
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                Subpastas Irmãs (opcional)
              </label>
              <button
                type="button"
                onClick={addSubfolderField}
                className="inline-flex items-center gap-1 text-xs font-bold text-red-600 hover:text-red-700"
              >
                <Plus size={14} /> Adicionar subpasta
              </button>
            </div>

            {subfolderNames.length > 0 && (
              <div className="space-y-2 rounded-2xl border border-zinc-100 bg-zinc-50/50 p-3 dark:border-zinc-800 dark:bg-zinc-900/30">
                <p className="text-[11px] text-zinc-400">
                  Todas serão criadas diretamente dentro de <strong>{rootName || 'pasta principal'}</strong>.
                </p>
                {subfolderNames.map((name, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <div className="text-xs font-bold text-zinc-400 w-4 text-center">
                      {index + 1}
                    </div>
                    <input
                      value={name}
                      maxLength={120}
                      onChange={(e) => updateSubfolder(index, e.target.value)}
                      placeholder={`Ex.: Subpasta ${index + 1}`}
                      className="min-w-0 flex-1 rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs outline-none focus:border-red-500 dark:border-zinc-700 dark:bg-card-dark dark:text-white"
                    />
                    <button
                      type="button"
                      onClick={() => removeSubfolder(index)}
                      className="rounded-lg p-1 text-zinc-400 hover:bg-zinc-200 hover:text-zinc-700 dark:hover:bg-zinc-700"
                    >
                      <X size={15} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <div>
          <label className="block text-sm font-bold text-zinc-700 dark:text-zinc-200">
            Descrição <span className="font-normal text-zinc-400">(opcional)</span>
          </label>
          <textarea
            value={description}
            maxLength={1000}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            className="mt-1.5 w-full resize-none rounded-xl border border-zinc-300 bg-transparent px-3 py-2 text-sm outline-none focus:border-red-500 dark:border-zinc-700 dark:text-white"
            placeholder="Ex.: Flashcards para o concurso de Soldado PMBA"
          />
        </div>

        <ColorPaletteSelector selectedColor={color} onSelectColor={setColor} />

        <button
          type="button"
          onClick={save}
          disabled={!rootName.trim()}
          className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-red-600 px-4 py-3 text-sm font-black text-white shadow-md shadow-red-600/20 hover:bg-red-700 disabled:opacity-50 transition"
        >
          <FolderPlus size={17} />
          {subfolderNames.filter((s) => s.trim()).length > 0
            ? `Criar pasta com ${subfolderNames.filter((s) => s.trim()).length} subpastas`
            : parentFolder ? 'Criar subpasta' : 'Criar pasta'}
        </button>
      </div>
    </Modal>
  );
}

/**
 * Modal de Edição de Pasta
 */
export function EditFolderModal({ folder, onClose, onUpdated }) {
  const [name, setName] = useState(folder.name || '');
  const [description, setDescription] = useState(folder.description || '');
  const [color, setColor] = useState(folder.color || 'red');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const save = async () => {
    if (!name.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await updateStudyFolder(folder.id, {
        name: name.trim(),
        description: description.trim(),
        color,
      });
      onUpdated?.({ ...folder, name: name.trim(), description: description.trim(), color });
      onClose();
    } catch (failure) {
      setError(readableError(failure));
      setBusy(false);
    }
  };

  return (
    <Modal title="Editar Pasta" eyebrow="Configurações" onClose={onClose}>
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-bold text-zinc-700 dark:text-zinc-200">
            Nome da Pasta
          </label>
          <input
            autoFocus
            value={name}
            maxLength={120}
            onChange={(e) => setName(e.target.value)}
            className="mt-1.5 w-full rounded-xl border border-zinc-300 bg-transparent px-3 py-2.5 text-sm outline-none focus:border-red-500 dark:border-zinc-700 dark:text-white"
          />
        </div>

        <div>
          <label className="block text-sm font-bold text-zinc-700 dark:text-zinc-200">
            Descrição <span className="font-normal text-zinc-400">(opcional)</span>
          </label>
          <textarea
            value={description}
            maxLength={1000}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            className="mt-1.5 w-full resize-none rounded-xl border border-zinc-300 bg-transparent px-3 py-2 text-sm outline-none focus:border-red-500 dark:border-zinc-700 dark:text-white"
          />
        </div>

        <ColorPaletteSelector selectedColor={color} onSelectColor={setColor} />

        {error ? (
          <p role="alert" className="rounded-xl bg-red-500/10 px-3 py-2 text-sm text-red-700 dark:text-red-300">
            {error}
          </p>
        ) : null}

        <button
          type="button"
          onClick={save}
          disabled={busy || !name.trim()}
          className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-red-600 px-4 py-3 text-sm font-black text-white shadow-md shadow-red-600/20 hover:bg-red-700 disabled:opacity-50 transition"
        >
          {busy ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
          Salvar alterações
        </button>
      </div>
    </Modal>
  );
}

/**
 * Modal de Exclusão de Pasta
 */
export function DeleteFolderModal({ folder, onClose, onDeleted }) {
  const remove = () => {
    onClose();
    onDeleted?.(folder);
  };

  return (
    <ConfirmDeleteModal
      title="Excluir Pasta"
      message={
        <span>
          Tem certeza de que deseja excluir a pasta <strong className="font-bold text-zinc-950 dark:text-white">"{folder.name}"</strong>?
          Todas as subpastas e fontes associadas serão arquivadas com segurança.
        </span>
      }
      confirmLabel="Excluir Pasta"
      onClose={onClose}
      onConfirm={remove}
    />
  );
}

export function EditSourceModal({ source, onClose, onUpdated }) {
  const [title, setTitle] = useState(source.title || '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const save = async () => {
    if (!title.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await updateStudySourceTitle(source.id, title.trim());
      onUpdated?.();
      onClose();
    } catch (failure) {
      setError(readableError(failure));
      setBusy(false);
    }
  };

  return (
    <Modal title="Renomear Fonte" eyebrow="Organização" onClose={onClose}>
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-bold text-zinc-700 dark:text-zinc-200">
            Título da Fonte
          </label>
          <input
            autoFocus
            value={title}
            maxLength={180}
            onChange={(e) => setTitle(e.target.value)}
            className="mt-1.5 w-full rounded-xl border border-zinc-300 bg-transparent px-3 py-2.5 text-sm outline-none focus:border-red-500 dark:border-zinc-700 dark:text-white"
          />
        </div>

        {error ? (
          <p role="alert" className="rounded-xl bg-red-500/10 px-3 py-2 text-sm text-red-700 dark:text-red-300">
            {error}
          </p>
        ) : null}

        <button
          type="button"
          onClick={save}
          disabled={busy || !title.trim()}
          className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-red-600 px-4 py-3 text-sm font-black text-white shadow-md shadow-red-600/20 hover:bg-red-700 disabled:opacity-50 transition"
        >
          {busy ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
          Salvar título
        </button>
      </div>
    </Modal>
  );
}

/**
 * Modal de Criação de Flashcard com CustomFolderSelect
 */
export function CreateFlashcardModal({ userId, folders = [], initialFolderId = '', onClose, onSaved }) {
  const [folderId, setFolderId] = useState(
    initialFolderId && !initialFolderId.startsWith('temp_')
      ? initialFolderId
      : folders.find((f) => !f.id.startsWith('temp_'))?.id || ''
  );
  const [front, setFront] = useState('');
  const [back, setBack] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (initialFolderId) {
      if (!initialFolderId.startsWith('temp_')) {
        setFolderId(initialFolderId);
      } else {
        const match = folders.find((f) => !f.id.startsWith('temp_'));
        if (match) setFolderId(match.id);
      }
    } else if (folders[0]?.id) {
      const match = folders.find((f) => !f.id.startsWith('temp_')) || folders[0];
      setFolderId(match.id);
    }
  }, [initialFolderId, folders]);

  const save = async () => {
    const activeUserId = userId || auth.currentUser?.uid;
    if (!activeUserId) {
      setError('Usuário não autenticado.');
      return;
    }
    if (!folderId) {
      setError('Selecione uma Pasta de Estudos.');
      return;
    }
    if (!front.trim() || !back.trim()) return;

    setBusy(true);
    setError(null);
    try {
      await createFolderFlashcard(activeUserId, folderId, { front: front.trim(), back: back.trim(), tags: [] });
      onSaved?.();
      onClose();
    } catch (failure) {
      setError(readableError(failure));
      setBusy(false);
    }
  };

  return (
    <Modal title="Criar Flashcard" eyebrow="Flashcard Manual" onClose={onClose}>
      <div className="space-y-4">
        <div>
          <label className="mb-1.5 block text-sm font-bold text-zinc-700 dark:text-zinc-200">
            Pasta de Destino
          </label>
          <CustomFolderSelect
            folders={folders}
            selectedFolderId={folderId}
            onSelectFolder={setFolderId}
          />
        </div>

        <div>
          <label className="block text-sm font-bold text-zinc-700 dark:text-zinc-200">
            Frente (Pergunta ou Conceito)
          </label>
          <textarea
            value={front}
            onChange={(e) => setFront(e.target.value)}
            rows={3}
            className="mt-1.5 w-full resize-none rounded-xl border border-zinc-300 bg-transparent px-3 py-2.5 text-sm outline-none focus:border-red-500 dark:border-zinc-700 dark:text-white"
            placeholder="Ex.: Quais são os elementos do fato típico?"
          />
        </div>

        <div>
          <label className="block text-sm font-bold text-zinc-700 dark:text-zinc-200">
            Verso (Resposta)
          </label>
          <textarea
            value={back}
            onChange={(e) => setBack(e.target.value)}
            rows={4}
            className="mt-1.5 w-full resize-none rounded-xl border border-zinc-300 bg-transparent px-3 py-2.5 text-sm outline-none focus:border-red-500 dark:border-zinc-700 dark:text-white"
            placeholder="Ex.: Conduta, resultado, nexo causal e tipicidade."
          />
        </div>

        {error ? (
          <p role="alert" className="rounded-xl bg-red-500/10 px-3 py-2 text-sm text-red-700 dark:text-red-300">
            {error}
          </p>
        ) : null}

        <button
          type="button"
          onClick={save}
          disabled={busy || !folderId || !front.trim() || !back.trim()}
          className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-red-600 px-4 py-3 text-sm font-black text-white shadow-md shadow-red-600/20 hover:bg-red-700 disabled:opacity-50 transition"
        >
          {busy ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
          Salvar Flashcard
        </button>
      </div>
    </Modal>
  );
}

/**
 * Modal de Importação Anki (.apkg)
 */
export function AnkiImportModal({ userId, folders = [], lockedFolder = null, onClose, onImported }) {
  const [file, setFile] = useState(null);
  const [mode, setMode] = useState(lockedFolder ? 'existing' : 'new');
  const [folderId, setFolderId] = useState(lockedFolder?.id || folders[0]?.id || '');
  const [newFolderName, setNewFolderName] = useState('');
  const [progress, setProgress] = useState(null);
  const [error, setError] = useState(null);
  const reusableFolder = useMemo(
    () => (!lockedFolder && mode === 'new' ? findReusableAnkiFolder(folders, newFolderName) : null),
    [folders, lockedFolder, mode, newFolderName],
  );

  const chooseFile = (selected) => {
    setFile(selected);
    if (selected && !newFolderName) {
      setNewFolderName(String(selected.name || '').replace(/\.apkg$/i, '').trim().slice(0, 120));
    }
  };

  const start = async () => {
    if (!file) return;
    setProgress(0);
    setError(null);
    let createdFolderId = null;
    try {
      let targetFolderId = lockedFolder?.id || folderId;
      if (!lockedFolder && mode === 'new') {
        if (reusableFolder) {
          targetFolderId = reusableFolder.id;
        } else {
          const folder = await createStudyFolder({
            name: newFolderName.trim() || String(file.name).replace(/\.apkg$/i, ''),
            description: 'Importado do Anki',
            color: 'red',
          });
          targetFolderId = folder.id;
          createdFolderId = folder.id;
        }
      }
      if (!targetFolderId) throw new Error('Selecione uma pasta de destino.');

      const result = await importAnkiPackage(userId, file, {
        folderId: targetFolderId,
        onProgress: setProgress,
      });

      onImported?.(targetFolderId, result);
      onClose();
    } catch (failure) {
      const message = readableError(failure);
      if (createdFolderId && /limite de pastas/i.test(message)) {
        await deleteStudyFolder(createdFolderId).catch(() => {});
      }
      setError(message);
      setProgress(null);
    }
  };

  return (
    <Modal title="Importar Anki" eyebrow={lockedFolder?.name || 'Pacote .apkg'} onClose={onClose}>
      <div className="space-y-4">
        <label className="flex min-h-28 cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-zinc-300 p-4 text-center transition hover:border-red-400 dark:border-zinc-700">
          <FileArchive size={32} className="text-red-600" />
          <span className="mt-2 text-sm font-bold text-zinc-900 dark:text-white">
            {file?.name || 'Selecionar arquivo .apkg'}
          </span>
          <span className="mt-1 text-xs text-zinc-400">
            {file ? `${(file.size / (1024 * 1024)).toFixed(1)} MB` : 'Clique ou arraste o arquivo APKG'}
          </span>
          <input
            type="file"
            accept=".apkg,application/zip,application/octet-stream"
            className="sr-only"
            onChange={(e) => chooseFile(e.target.files?.[0] || null)}
          />
        </label>

        {!lockedFolder && (
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setMode('new')}
              className={`rounded-xl border p-2.5 text-center text-xs font-bold transition ${
                mode === 'new'
                  ? 'border-red-500 bg-red-50 text-red-700 dark:bg-red-950/20 dark:text-red-300'
                  : 'border-zinc-200 dark:border-zinc-700 dark:text-zinc-300'
              }`}
            >
              Criar pasta pelo arquivo
            </button>
            <button
              type="button"
              onClick={() => setMode('existing')}
              className={`rounded-xl border p-2.5 text-center text-xs font-bold transition ${
                mode === 'existing'
                  ? 'border-red-500 bg-red-50 text-red-700 dark:bg-red-950/20 dark:text-red-300'
                  : 'border-zinc-200 dark:border-zinc-700 dark:text-zinc-300'
              }`}
            >
              Pasta existente
            </button>
          </div>
        )}

        {!lockedFolder && mode === 'new' && (
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
              Nome da nova pasta
            </label>
            <input
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              className="mt-1 w-full rounded-xl border border-zinc-300 bg-transparent px-3 py-2 text-sm outline-none focus:border-red-500 dark:border-zinc-700 dark:text-white"
              placeholder="Nome da pasta"
            />
            {reusableFolder ? (
              <p className="mt-2 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
                Uma pasta desta importação já existe e será reutilizada sem duplicar a estrutura.
              </p>
            ) : null}
          </div>
        )}

        {!lockedFolder && mode === 'existing' && (
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
              Pasta de Destino
            </label>
            <div className="mt-1">
              <CustomFolderSelect
                folders={folders}
                selectedFolderId={folderId}
                onSelectFolder={setFolderId}
              />
            </div>
          </div>
        )}

        {progress !== null && (
          <div className="rounded-xl bg-blue-500/10 p-3.5 text-xs font-bold text-blue-700 dark:text-blue-300">
            <div className="flex items-center gap-2">
              <Loader2 size={14} className="animate-spin" />
              {progress < 1 ? `Enviando arquivo: ${Math.round(progress * 100)}%` : 'Processando e salvando decks e cards no servidor...'}
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-blue-100 dark:bg-blue-950">
              <div
                className="h-full rounded-full bg-blue-600 transition-all duration-300"
                style={{ width: `${Math.max(8, progress * 100)}%` }}
              />
            </div>
          </div>
        )}

        {error ? (
          <p role="alert" className="rounded-xl bg-red-500/10 px-3 py-2 text-sm text-red-700 dark:text-red-300">
            {error}
          </p>
        ) : null}

        <button
          type="button"
          onClick={start}
          disabled={!file || progress !== null || (!lockedFolder && mode === 'existing' && !folderId)}
          className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-red-600 px-4 py-3 text-sm font-black text-white shadow-md shadow-red-600/20 hover:bg-red-700 disabled:opacity-50 transition"
        >
          <FileArchive size={17} />
          {progress !== null ? 'Importando...' : 'Iniciar Importação'}
        </button>
      </div>
    </Modal>
  );
}

/**
 * Modal de Resumo Pós-Importação Anki
 */
export function AnkiImportSummaryModal({
  report,
  onClose,
  onViewFolder,
}) {
  if (!report) return null;

  const incomplete = report.status === 'incomplete' || report.isComplete === false;
  const hasWarnings = incomplete || (report.warnings && report.warnings.length > 0) || Number(report.cardsSkipped || 0) > 0;
  const totalDetected = Number(report.cardsDetected || report.totalCardsAnalyzed || report.cardsFound || 0);
  const cardsPersisted = Number(report.cardsPersisted ?? report.cardsParsed ?? totalDetected);
  const mobileSummaryItems = [
    ['Confirmados', cardsPersisted],
    ['Novos', Number(report.cardsAdded || report.cardsCreated || 0)],
    [Number(report.cardsSkipped || 0) > 0 ? 'Ignorados' : 'Atualizados', Number(report.cardsSkipped || report.cardsUpdated || 0)],
  ];
  const summaryItems = [
    ['Flashcards encontrados', totalDetected],
    ['Flashcards novos', Number(report.cardsAdded || report.cardsCreated || 0)],
    ['Flashcards atualizados', Number(report.cardsUpdated || 0)],
    ['Sem alterações (reutilizados)', Number(report.cardsUnchanged || 0)],
    ['Flashcards ignorados', Number(report.cardsSkipped || 0)],
    ['Pastas na árvore', Number(report.folderCount ?? report.deckCount ?? 0)],
    ['Mídias', Number(report.mediaImported || 0)],
    ['Mídias reutilizadas', Number(report.mediaReused || 0)],
  ];

  return (
    <Modal
      title={incomplete ? 'Importação incompleta' : 'Importação concluída'}
      eyebrow={incomplete ? 'Ação necessária' : (hasWarnings ? 'Concluída com avisos' : 'Sucesso')}
      onClose={onClose}
      maxWidth="max-w-xl"
      bodyClassName="overflow-hidden"
    >
      <div className="space-y-3 sm:space-y-4">
        {/* Banner de Status */}
        <div
          className={`flex items-start gap-3 rounded-2xl p-3 sm:p-4 ${
            incomplete || hasWarnings
              ? 'bg-amber-500/10 text-amber-900 dark:text-amber-200'
              : 'bg-emerald-500/10 text-emerald-900 dark:text-emerald-200'
          }`}
        >
          <div
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white shadow-sm ${
              incomplete || hasWarnings ? 'bg-amber-500' : 'bg-emerald-600'
            }`}
          >
            {incomplete || hasWarnings ? <AlertTriangle size={20} /> : <CheckCircle2 size={20} />}
          </div>
          <div>
            <h3 className="font-bold text-sm">
              {incomplete
                ? 'As contagens não fecharam ou um lote falhou'
                : hasWarnings
                  ? 'O pacote foi importado com observações'
                : 'Todos os cards foram importados com sucesso'}
            </h3>
            <p className="mt-0.5 text-xs opacity-80">
              {incomplete
                ? 'Os dados já gravados foram preservados. Consulte os avisos antes de tentar novamente.'
               : `${cardsPersisted.toLocaleString('pt-BR')} cards válidos foram confirmados no Firestore.`}
            </p>
          </div>
        </div>

        {/* Estatísticas Autoritativas */}
        <div className="grid grid-cols-3 gap-2 sm:hidden">
          {mobileSummaryItems.map(([label, value]) => (
            <div key={label} className="rounded-xl border border-zinc-200 bg-zinc-50/50 p-2 text-center dark:border-zinc-800 dark:bg-card-dark">
              <span className="block text-lg font-black text-zinc-950 dark:text-white">{value.toLocaleString('pt-BR')}</span>
              <span className="text-[9px] font-bold text-zinc-500">{label}</span>
            </div>
          ))}
        </div>
        <div className="hidden grid-cols-3 gap-2 sm:grid">
          {summaryItems.map(([label, value]) => (
            <div key={label} className="rounded-2xl border border-zinc-200 bg-zinc-50/50 p-3 dark:border-zinc-800 dark:bg-card-dark">
              <span className="block text-xl font-black text-zinc-950 dark:text-white">
                {value.toLocaleString('pt-BR')}
              </span>
              <span className="text-[11px] font-semibold text-zinc-500">{label}</span>
            </div>
          ))}
        </div>

        {/* Detalhes de Atualizados / Ignorados se houver */}
        {(Number(report.cardsUpdated || 0) > 0 || Number(report.cardsSkipped || 0) > 0 || incomplete) && (
          <div className="hidden rounded-xl bg-zinc-100 p-3 text-xs text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300 sm:block">
            {Number(report.cardsUpdated || 0) > 0 ? (
              <p>• <strong>{report.cardsUpdated}</strong> cards já existentes foram atualizados.</p>
            ) : null}
            {Number(report.cardsSkipped || 0) > 0 ? (
              <p>• <strong>{report.cardsSkipped}</strong> cards foram ignorados.</p>
            ) : null}
            {incomplete ? (
              <p>• Lotes: <strong>{Number(report.batchesCompleted || 0)}/{Number(report.batchesStarted || 0)}</strong> concluídos; <strong>{Number(report.writeFailures || 0)}</strong> falhas de escrita.</p>
            ) : null}
          </div>
        )}

        {/* Lista de Avisos (se houver) */}
        {report.warnings && report.warnings.length > 0 && (
          <div className="hidden max-h-28 overflow-y-auto rounded-xl border border-amber-200/50 bg-amber-50/30 p-2.5 text-[11px] text-amber-800 dark:border-amber-900/30 dark:text-amber-300 sm:block custom-scrollbar">
            <p className="font-bold mb-1">Observações do arquivo:</p>
            <ul className="list-disc pl-4 space-y-0.5">
              {report.warnings.map((w, idx) => (
                <li key={idx}>{w}</li>
              ))}
            </ul>
          </div>
        )}

        {hasWarnings ? (
          <p className="line-clamp-2 rounded-xl bg-amber-500/10 px-3 py-2 text-[10px] font-semibold text-amber-800 dark:text-amber-300 sm:hidden">
            {incomplete ? 'A importação precisa de atenção antes de uma nova tentativa.' : `${report.warnings?.length || report.cardsSkipped || 1} observação(ões) registrada(s) no pacote.`}
          </p>
        ) : null}

        {/* Ações */}
        <div className="grid grid-cols-[0.8fr_1.2fr] gap-2 pt-1 sm:grid-cols-2 sm:pt-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-xl border border-zinc-200 py-2.5 text-xs font-bold text-zinc-700 hover:bg-zinc-100 dark:border-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-800 transition"
          >
            Fechar
          </button>
          <button
            type="button"
            onClick={() => {
              onViewFolder?.(report.targetFolderId || report.folderId || report.rootFolderId);
              onClose();
            }}
            className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl bg-red-600 py-2.5 text-xs font-black text-white shadow-md shadow-red-600/20 hover:bg-red-700 transition"
          >
            <span className="sm:hidden">Ver pasta</span>
            <span className="hidden sm:inline">Ver pasta importada</span>
            <ArrowRight size={14} />
          </button>
        </div>
      </div>
    </Modal>
  );
}

/**
 * Modal de Preparação de Estudo (Fluxo em 2 Passos: Clicar na Pasta -> Escolher Estudo)
 */
export function FolderStudyPrepModal({
  folder,
  folders = [],
  sources = [],
  dueByFolder = {},
  totalByFolder = {},
  studiedByFolder = {},
  onClose,
  onStartReview,
  onStartStudySource,
  onViewCards,
  onManageFolder,
  onCreateCard,
  onImportAnki,
  onAddSource,
}) {
  const [startingReview, setStartingReview] = useState(false);
  const [startingStudySource, setStartingStudySource] = useState(false);
  const [error, setError] = useState(null);

  const familyIds = useMemo(() => getDescendantFolderIds(folder.id, folders), [folder.id, folders]);
  const breadcrumbs = useMemo(() => getBreadcrumbs(folder.id, folders), [folder.id, folders]);
  const colorHex = folderColorHex(folder.color);

  const totalCards = familyIds.reduce((sum, id) => sum + Number(totalByFolder[id] || 0), 0);
  const dueCards = familyIds.reduce((sum, id) => sum + Number(dueByFolder[id] || 0), 0);
  const studiedCards = familyIds.reduce((sum, id) => sum + Number(studiedByFolder[id] || 0), 0);
  const directSubs = folders.filter((f) => f.parentFolderId === folder.id);

  // Fontes vinculadas à pasta
  const folderSources = useMemo(() => sources.filter((s) => s.folderId === folder.id), [folder.id, sources]);
  const readySources = useMemo(() => folderSources.filter((s) => s.status === 'ready'), [folderSources]);
  const processingSources = useMemo(() => folderSources.filter((s) => s.status === 'processing'), [folderSources]);

  // Seleção reativa: se houver fonte pronta e a seleção anterior for inválida, pré-seleciona a primeira pronta
  const [selectedSourceId, setSelectedSourceId] = useState(() => readySources[0]?.id || null);

  const selectedSource = useMemo(() => {
    return readySources.find((s) => s.id === selectedSourceId) || readySources[0] || null;
  }, [readySources, selectedSourceId]);

  const handleStartStudySource = async () => {
    if (startingStudySource || !selectedSource || selectedSource.status !== 'ready') return;
    setStartingStudySource(true);
    setError(null);
    try {
      await onStartStudySource?.(selectedSource);
      onClose();
    } catch (err) {
      setError(readableError(err));
      setStartingStudySource(false);
    }
  };

  const handleStartReview = async (onlyDue = false) => {
    if (startingReview || totalCards === 0) return;
    setStartingReview(true);
    setError(null);
    try {
      await onStartReview?.(onlyDue);
    } catch (err) {
      setError(readableError(err));
      setStartingReview(false);
    }
  };

  const hasZeroCards = totalCards === 0;
  const hasZeroSources = folderSources.length === 0;
  const hasReadySources = readySources.length > 0;
  const hasProcessingOnly = folderSources.length > 0 && readySources.length === 0 && processingSources.length > 0;

  return (
    <Modal
      title={folder.name}
      eyebrow={breadcrumbs.length > 1 ? breadcrumbs.map((b) => b.name).join(' › ') : 'Preparação de Estudo'}
      onClose={onClose}
      maxWidth="max-w-xl"
    >
      <div className="space-y-4">
        {/* Cabeçalho da Pasta */}
        <div className="flex items-start gap-3 rounded-2xl border border-zinc-200/80 bg-zinc-50/50 p-4 dark:border-zinc-800 dark:bg-card-dark">
          <div
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-white shadow-sm"
            style={{ backgroundColor: colorHex }}
          >
            <Folder size={22} />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="truncate text-base font-black text-zinc-950 dark:text-white">
              {folder.name}
            </h3>
            {folder.description ? (
              <p className="mt-1 line-clamp-2 text-xs text-zinc-500 dark:text-zinc-400">
                {folder.description}
              </p>
            ) : (
              <p className="mt-1 text-xs text-zinc-400">Pasta de Estudos</p>
            )}
          </div>
          {directSubs.length > 0 && (
            <span className="shrink-0 rounded-lg bg-zinc-200/60 px-2.5 py-1 text-[11px] font-bold text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
              {directSubs.length} {directSubs.length === 1 ? 'subpasta' : 'subpastas'}
            </span>
          )}
        </div>

        {error && (
          <div className="rounded-xl bg-red-500/10 border border-red-500/20 p-3 text-xs font-semibold text-red-700 dark:text-red-300">
            {error}
          </div>
        )}

        {/* CASO A: 0 cards e 0 fontes */}
        {hasZeroCards && hasZeroSources ? (
          <div className="space-y-3 rounded-2xl border-2 border-dashed border-zinc-200 p-6 text-center dark:border-zinc-800">
            <p className="text-xs font-bold text-zinc-700 dark:text-zinc-300">
              Adicione uma fonte, crie um card ou importe um baralho Anki.
            </p>
            <p className="text-[11px] text-zinc-400">
              Escolha uma forma de iniciar seus estudos nesta pasta:
            </p>
            <div className="grid grid-cols-3 gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onAddSource?.(folder);
                }}
                className="flex flex-col items-center justify-center gap-1.5 rounded-xl border border-zinc-200 bg-white p-3 text-[11px] font-bold text-zinc-800 shadow-sm hover:border-red-400 hover:text-red-600 dark:border-zinc-800 dark:bg-card-dark dark:text-zinc-200 transition"
              >
                <Sparkles size={18} className="text-red-600" />
                <span>Adicionar fonte</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  onClose();
                  onCreateCard?.(folder.id);
                }}
                className="flex flex-col items-center justify-center gap-1.5 rounded-xl border border-zinc-200 bg-white p-3 text-[11px] font-bold text-zinc-800 shadow-sm hover:border-red-400 hover:text-red-600 dark:border-zinc-800 dark:bg-card-dark dark:text-zinc-200 transition"
              >
                <Plus size={18} className="text-zinc-500" />
                <span>Novo card</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  onClose();
                  onImportAnki?.(folder);
                }}
                className="flex flex-col items-center justify-center gap-1.5 rounded-xl border border-zinc-200 bg-white p-3 text-[11px] font-bold text-zinc-800 shadow-sm hover:border-red-400 hover:text-red-600 dark:border-zinc-800 dark:bg-card-dark dark:text-zinc-200 transition"
              >
                <FileArchive size={18} className="text-zinc-500" />
                <span>Importar Anki</span>
              </button>
            </div>
          </div>
        ) : null}

        {/* SEÇÃO 1: ESTUDAR COM IA (TUTOR ADAPTATIVO) */}
        <div className="rounded-2xl border border-red-500/20 bg-gradient-to-br from-red-50/30 via-white to-white p-4 shadow-sm dark:border-red-950/40 dark:from-red-950/10 dark:via-card-dark dark:to-card-dark">
          <div className="flex items-center justify-between gap-2 pb-3 border-b border-zinc-100 dark:border-zinc-800/80">
            <div className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-red-600 text-white shadow-sm">
                <Sparkles size={14} />
              </span>
              <div>
                <h4 className="text-sm font-black text-zinc-950 dark:text-white">Estudar com IA</h4>
                <p className="text-[11px] text-zinc-500 dark:text-zinc-400">Tutor Adaptativo formula perguntas em tempo real</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                onClose();
                onAddSource?.(folder);
              }}
              className="inline-flex items-center gap-1 text-xs font-bold text-red-600 hover:text-red-700"
            >
              <Plus size={13} /> Adicionar fonte
            </button>
          </div>

          {/* CASO B: 0 cards e >= 1 fonte pronta */}
          {hasZeroCards && hasReadySources ? (
            <div className="mt-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 p-2.5 text-xs font-bold text-emerald-800 dark:text-emerald-300">
              Seu material está pronto. Escolha uma fonte para começar a estudar com IA.
            </div>
          ) : null}

          {/* CASO D: Fontes apenas em processamento */}
          {hasProcessingOnly ? (
            <div className="mt-3 rounded-xl bg-blue-500/10 border border-blue-500/20 p-2.5 text-xs font-bold text-blue-800 dark:text-blue-300 flex items-center gap-2">
              <Loader2 size={14} className="animate-spin" />
              <span>Preparando sua fonte... Extraindo e organizando o conteúdo</span>
            </div>
          ) : null}

          {/* Lista de Fontes */}
          {folderSources.length > 0 ? (
            <div className="mt-3 space-y-2 max-h-48 overflow-y-auto pr-0.5 custom-scrollbar">
              {folderSources.map((source) => {
                const isReady = source.status === 'ready';
                const isSelected = selectedSource?.id === source.id;
                const isProcessing = source.status === 'processing';
                const isError = source.status === 'error';

                return (
                  <div
                    key={source.id}
                    onClick={() => {
                      if (isReady) setSelectedSourceId(source.id);
                    }}
                    className={`flex items-center justify-between gap-3 rounded-xl border p-3 transition ${
                      isReady
                        ? isSelected
                          ? 'border-red-500 bg-red-50/50 dark:border-red-600 dark:bg-red-950/20 cursor-pointer shadow-sm'
                          : 'border-zinc-200 bg-white hover:border-zinc-300 dark:border-zinc-800 dark:bg-card-dark cursor-pointer'
                        : 'border-zinc-200/60 bg-zinc-50/60 opacity-75 dark:border-zinc-800/60 dark:bg-zinc-900/40 cursor-not-allowed'
                    }`}
                  >
                    <div className="flex min-w-0 flex-1 items-center gap-2.5">
                      {isReady && (
                        <div className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${
                          isSelected ? 'border-red-600 bg-red-600 text-white' : 'border-zinc-300 dark:border-zinc-600'
                        }`}>
                          {isSelected && <div className="h-1.5 w-1.5 rounded-full bg-white" />}
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-bold text-zinc-950 dark:text-white">
                          {source.title}
                        </p>
                        <p className="mt-0.5 text-[11px] text-zinc-400">
                          {source.kind === 'document' ? 'Documento PDF' : 'Anotação'}
                        </p>
                      </div>
                    </div>

                    <div className="shrink-0 text-right">
                      {isReady ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:text-emerald-300">
                          <CheckCircle2 size={11} /> Pronta
                        </span>
                      ) : isProcessing ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-blue-500/10 px-2 py-0.5 text-[10px] font-bold text-blue-700 dark:text-blue-300">
                          <Loader2 size={11} className="animate-spin" /> Processando...
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-red-500/10 px-2 py-0.5 text-[10px] font-bold text-red-700 dark:text-red-300">
                          Erro
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : !hasZeroCards ? (
            <p className="mt-3 text-xs text-zinc-500 dark:text-zinc-400">
              Nenhuma fonte de estudo vinculada a esta pasta. Adicione uma anotação ou PDF para ativar o Tutor Adaptativo.
            </p>
          ) : null}

          {/* Botão Estudar com IA */}
          {folderSources.length > 0 && (
            <div className="pt-3">
              <button
                type="button"
                onClick={handleStartStudySource}
                disabled={startingStudySource || !selectedSource || selectedSource.status !== 'ready'}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-red-600 px-4 py-3 text-sm font-black text-white shadow-md shadow-red-600/20 hover:bg-red-700 transition disabled:cursor-not-allowed disabled:opacity-50"
              >
                {startingStudySource ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <Sparkles size={16} />
                )}
                <span>
                  {startingStudySource
                    ? 'Iniciando Tutor...'
                    : hasProcessingOnly
                      ? 'Aguardando processamento...'
                      : selectedSource
                        ? `Estudar com IA${readySources.length > 1 ? ` (${selectedSource.title})` : ''}`
                        : 'Selecione uma fonte pronta'}
                </span>
              </button>
            </div>
          )}
        </div>

        {/* SEÇÃO 2: REVISAR FLASHCARDS (ESTUDO TRADICIONAL) */}
        <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-card-dark">
          <div className="flex items-center gap-2 pb-3 border-b border-zinc-100 dark:border-zinc-800/80">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
              <BookOpen size={14} />
            </span>
            <div>
              <h4 className="text-sm font-black text-zinc-950 dark:text-white">Revisar Flashcards</h4>
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400">Espaçamento inteligente e revisão de cards criados</p>
            </div>
          </div>

          {/* Grade de Estatísticas */}
          <div className="grid grid-cols-3 gap-2 mt-3">
            <div className="rounded-xl border border-zinc-100 bg-zinc-50/60 p-2.5 text-center dark:border-zinc-800/60 dark:bg-zinc-900/30">
              <span className="block text-lg font-black text-zinc-950 dark:text-white">
                {totalCards.toLocaleString('pt-BR')}
              </span>
              <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Total Cards</span>
            </div>

            <div className="rounded-xl border border-zinc-100 bg-zinc-50/60 p-2.5 text-center dark:border-zinc-800/60 dark:bg-zinc-900/30">
              <span className={`block text-lg font-black ${dueCards > 0 ? 'text-red-600 dark:text-red-400' : 'text-zinc-950 dark:text-white'}`}>
                {dueCards.toLocaleString('pt-BR')}
              </span>
              <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Para Revisar</span>
            </div>

            <div className="rounded-xl border border-zinc-100 bg-zinc-50/60 p-2.5 text-center dark:border-zinc-800/60 dark:bg-zinc-900/30">
              <span className="block text-lg font-black text-zinc-950 dark:text-white">
                {studiedCards.toLocaleString('pt-BR')}
              </span>
              <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Estudados</span>
            </div>
          </div>

          {/* Ações de Revisão */}
          <div className="space-y-2 pt-3">
            {totalCards > 0 ? (
              <>
                {dueCards > 0 ? (
                  <button
                    type="button"
                    onClick={() => handleStartReview(true)}
                    disabled={startingReview}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-zinc-900 px-4 py-3 text-sm font-black text-white hover:bg-zinc-800 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-100 transition disabled:opacity-50"
                  >
                    {startingReview ? <Loader2 size={16} className="animate-spin" /> : <BookOpen size={16} />}
                    Revisar pendentes ({dueCards})
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleStartReview(false)}
                    disabled={startingReview}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-zinc-900 px-4 py-3 text-sm font-black text-white hover:bg-zinc-800 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-100 transition disabled:opacity-50"
                  >
                    {startingReview ? <Loader2 size={16} className="animate-spin" /> : <BookOpen size={16} />}
                    Estudar todos ({totalCards})
                  </button>
                )}

                {dueCards > 0 && (
                  <button
                    type="button"
                    onClick={() => handleStartReview(false)}
                    disabled={startingReview}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-zinc-200 py-2 text-xs font-bold text-zinc-700 hover:bg-zinc-100 dark:border-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-800 transition"
                  >
                    <BookOpen size={13} />
                    Estudar todos os {totalCards} cards
                  </button>
                )}
              </>
            ) : (
              <button
                type="button"
                disabled
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-zinc-200 bg-zinc-50/50 py-2.5 text-xs font-bold text-zinc-400 cursor-not-allowed dark:border-zinc-800 dark:bg-zinc-900/40 dark:text-zinc-600"
              >
                <BookOpen size={14} />
                Revisar flashcards (0 cards criados)
              </button>
            )}

            <div className="grid grid-cols-2 gap-2 pt-1">
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onViewCards?.(folder);
                }}
                className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-zinc-200 py-2.5 text-xs font-bold text-zinc-700 hover:bg-zinc-100 dark:border-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-800 transition"
              >
                <Eye size={14} />
                Ver flashcards
              </button>

              <button
                type="button"
                onClick={() => {
                  onClose();
                  onManageFolder?.(folder);
                }}
                className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-zinc-200 py-2.5 text-xs font-bold text-zinc-700 hover:bg-zinc-100 dark:border-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-800 transition"
              >
                <Layers size={14} />
                Gerenciar pasta
              </button>
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
}
