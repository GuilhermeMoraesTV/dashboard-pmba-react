import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  FileArchive,
  Folder,
  FolderPlus,
  HelpCircle,
  Layers,
  Loader2,
  Plus,
  Search,
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
import { createFolderFlashcard } from '../../services/flashcards/flashcardsService.js';
import { importAnkiPackage } from '../../services/anki/ankiService.js';
import { DISCIPLINE_COLOR_PALETTE, getColorByHex, getColorById } from '../../utils/disciplineColors.js';

function readableError(error) {
  const details = typeof error?.details === 'string' ? error.details : (error?.details?.message || '');
  const message = error?.message || error?.code || 'Não foi possível concluir a operação.';
  const raw = details ? `${message} (${details})` : message;
  return String(raw).replace(/^FirebaseError:\s*/i, '').slice(0, 400);
}

function Modal({ title, eyebrow, onClose, children, maxWidth = 'max-w-lg' }) {
  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div className={`flex max-h-[85vh] w-full ${maxWidth} flex-col rounded-3xl border border-white/10 bg-white shadow-2xl dark:bg-slate-900`}>
        {/* Header Fixo */}
        <div className="flex shrink-0 items-start justify-between border-b border-slate-100 p-5 dark:border-slate-800 sm:px-6">
          <div>
            {eyebrow ? (
              <p className="text-xs font-black uppercase tracking-[0.16em] text-red-600 dark:text-red-400">
                {eyebrow}
              </p>
            ) : null}
            <h2 className="mt-1 text-xl font-black text-slate-950 dark:text-white">{title}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="rounded-xl p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <X size={18} />
          </button>
        </div>

        {/* Corpo com Scroll */}
        <div className="flex-1 overflow-y-auto p-5 sm:px-6">
          {children}
        </div>
      </div>
    </div>
  );
}

/**
 * Seletor de Cores reutilizando a paleta exata do Ciclos (DISCIPLINE_COLOR_PALETTE)
 */
function ColorPaletteSelector({ selectedColor, onSelectColor }) {
  return (
    <div>
      <label className="block text-sm font-bold text-slate-700 dark:text-slate-200">
        Cor da Pasta
      </label>
      <div className="mt-2.5 flex flex-wrap gap-2">
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
                  ? 'ring-2 ring-slate-950 ring-offset-2 dark:ring-white dark:ring-offset-slate-900 scale-110 shadow-sm'
                  : 'opacity-90 hover:opacity-100'
              }`}
              style={{ backgroundColor: color.hex }}
            />
          );
        })}
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
          <div className="text-sm text-slate-700 dark:text-slate-300">
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
            className="rounded-xl px-4 py-2.5 text-sm font-bold text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className="inline-flex items-center gap-2 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-bold text-white shadow-md shadow-red-600/20 hover:bg-red-700 disabled:opacity-50"
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
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const containerRef = useRef(null);

  // Mapear caminho hierárquico para cada pasta
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
        className="flex w-full items-center justify-between rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-left text-sm transition focus:border-red-500 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-white"
      >
        <div className="flex min-w-0 items-center gap-2">
          {selectedItem ? (
            <>
              <div
                className="h-3 w-3 shrink-0 rounded-full"
                style={{ backgroundColor: getColorById(selectedItem.color)?.hex || '#dc2626' }}
              />
              <span className="truncate font-semibold">{selectedItem.fullPath}</span>
            </>
          ) : (
            <span className="text-slate-400">{placeholder}</span>
          )}
        </div>
        <ChevronDown size={16} className="shrink-0 text-slate-400" />
      </button>

      {isOpen && (
        <div className="absolute left-0 right-0 top-full z-50 mt-1 max-h-60 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl dark:border-slate-800 dark:bg-slate-900">
          <div className="border-b border-slate-100 p-2 dark:border-slate-800">
            <div className="relative">
              <Search size={14} className="absolute left-2.5 top-2.5 text-slate-400" />
              <input
                type="text"
                autoFocus
                placeholder="Buscar pasta..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full rounded-xl bg-slate-50 py-1.5 pl-8 pr-3 text-xs outline-none focus:bg-white dark:bg-slate-800 dark:text-white"
              />
            </div>
          </div>

          <div className="max-h-48 overflow-y-auto p-1">
            {filtered.length === 0 ? (
              <div className="p-3 text-center text-xs text-slate-400">Nenhuma pasta encontrada</div>
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
                      : 'text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800/50'
                  }`}
                  style={{ paddingLeft: `${Math.max(12, item.level * 16 + 12)}px` }}
                >
                  <div
                    className="h-2 w-2 shrink-0 rounded-full"
                    style={{ backgroundColor: getColorById(item.color)?.hex || '#dc2626' }}
                  />
                  <span className="truncate">{item.name}</span>
                  {item.level > 0 ? (
                    <span className="ml-auto text-[10px] text-slate-400 opacity-60">
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
 * Modal de Criação de Pasta com suporte a Subpastas Irmãs (Default) e UX Otimista
 */
export function CreateFolderModal({ parentFolder = null, onClose, onCreated }) {
  const [rootName, setRootName] = useState('');
  const [subfolderNames, setSubfolderNames] = useState([]);
  const [description, setDescription] = useState('');
  const [color, setColor] = useState(parentFolder?.color || 'red');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

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

    // UX OTIMISTA: Gerar ID temporário e notificar a UI imediatamente
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

    // Callback imediato para UI responsiva
    onCreated?.(optimisticRoot, optimisticTree);
    onClose();

    // Sincronização em background com resolução do ID real
    try {
      let realRoot = null;
      if (validSubs.length > 0) {
        const res = await createStudyFolderTree({
          names: [cleanRoot, ...validSubs],
          description: description.trim(),
          color,
          icon: 'folder',
          parentFolderId: parentFolder?.id || null,
          structure: 'siblings', // Todas as subpastas são filhas diretas da raiz!
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
        {/* Nome Principal / Raiz */}
        <div>
          <label className="block text-sm font-bold text-slate-700 dark:text-slate-200">
            {parentFolder ? 'Nome da subpasta' : 'Nome da pasta principal'}
          </label>
          <input
            autoFocus
            value={rootName}
            maxLength={120}
            onChange={(e) => setRootName(e.target.value)}
            className="mt-1.5 w-full rounded-xl border border-slate-300 bg-transparent px-3 py-2.5 text-sm outline-none focus:border-red-500 dark:border-slate-700 dark:text-white"
            placeholder={parentFolder ? 'Ex.: Teoria do Crime' : 'Ex.: PMBA'}
          />
        </div>

        {/* Subpastas Irmãs (Filhas Diretas da Raiz) */}
        {!parentFolder && (
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
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
              <div className="space-y-2 rounded-2xl border border-slate-100 bg-slate-50/50 p-3 dark:border-slate-800 dark:bg-slate-800/30">
                <p className="text-[11px] text-slate-400">
                  Todas serão criadas diretamente dentro de <strong>{rootName || 'pasta principal'}</strong>.
                </p>
                {subfolderNames.map((name, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <div className="text-xs font-bold text-slate-400 w-4 text-center">
                      {index + 1}
                    </div>
                    <input
                      value={name}
                      maxLength={120}
                      onChange={(e) => updateSubfolder(index, e.target.value)}
                      placeholder={`Ex.: Subpasta ${index + 1}`}
                      className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs outline-none focus:border-red-500 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                    />
                    <button
                      type="button"
                      onClick={() => removeSubfolder(index)}
                      className="rounded-lg p-1 text-slate-400 hover:bg-slate-200 hover:text-slate-700 dark:hover:bg-slate-700"
                    >
                      <X size={15} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Descrição */}
        <div>
          <label className="block text-sm font-bold text-slate-700 dark:text-slate-200">
            Descrição <span className="font-normal text-slate-400">(opcional)</span>
          </label>
          <textarea
            value={description}
            maxLength={1000}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            className="mt-1.5 w-full resize-none rounded-xl border border-slate-300 bg-transparent px-3 py-2 text-sm outline-none focus:border-red-500 dark:border-slate-700 dark:text-white"
            placeholder="Ex.: Flashcards para o concurso de Soldado PMBA"
          />
        </div>

        {/* Seletor de Cores Ciclos */}
        <ColorPaletteSelector selectedColor={color} onSelectColor={setColor} />

        {error ? (
          <p role="alert" className="rounded-xl bg-red-500/10 px-3 py-2 text-sm text-red-700 dark:text-red-300">
            {error}
          </p>
        ) : null}

        {/* Botão de Criação */}
        <button
          type="button"
          onClick={save}
          disabled={!rootName.trim()}
          className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-red-600 px-4 py-3 text-sm font-black text-white shadow-md shadow-red-600/20 hover:bg-red-700 disabled:opacity-50"
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
          <label className="block text-sm font-bold text-slate-700 dark:text-slate-200">
            Nome da Pasta
          </label>
          <input
            autoFocus
            value={name}
            maxLength={120}
            onChange={(e) => setName(e.target.value)}
            className="mt-1.5 w-full rounded-xl border border-slate-300 bg-transparent px-3 py-2.5 text-sm outline-none focus:border-red-500 dark:border-slate-700 dark:text-white"
          />
        </div>

        <div>
          <label className="block text-sm font-bold text-slate-700 dark:text-slate-200">
            Descrição <span className="font-normal text-slate-400">(opcional)</span>
          </label>
          <textarea
            value={description}
            maxLength={1000}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            className="mt-1.5 w-full resize-none rounded-xl border border-slate-300 bg-transparent px-3 py-2 text-sm outline-none focus:border-red-500 dark:border-slate-700 dark:text-white"
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
          className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-red-600 px-4 py-3 text-sm font-black text-white shadow-md shadow-red-600/20 hover:bg-red-700 disabled:opacity-50"
        >
          {busy ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
          Salvar alterações
        </button>
      </div>
    </Modal>
  );
}

/**
 * Modal de Exclusão de Pasta com Modal Visual ModoQAP
 */
export function DeleteFolderModal({ folder, onClose, onDeleted }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const remove = async () => {
    setBusy(true);
    setError(null);
    try {
      await deleteStudyFolder(folder.id);
      onDeleted?.();
      onClose();
    } catch (failure) {
      setError(readableError(failure));
      setBusy(false);
    }
  };

  return (
    <ConfirmDeleteModal
      title="Excluir Pasta"
      message={
        <span>
          Tem certeza de que deseja excluir a pasta <strong className="font-bold text-slate-950 dark:text-white">"{folder.name}"</strong>?
          Todas as subpastas e fontes associadas serão arquivadas com segurança.
        </span>
      }
      confirmLabel="Excluir Pasta"
      busy={busy}
      error={error}
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
          <label className="block text-sm font-bold text-slate-700 dark:text-slate-200">
            Título da Fonte
          </label>
          <input
            autoFocus
            value={title}
            maxLength={180}
            onChange={(e) => setTitle(e.target.value)}
            className="mt-1.5 w-full rounded-xl border border-slate-300 bg-transparent px-3 py-2.5 text-sm outline-none focus:border-red-500 dark:border-slate-700 dark:text-white"
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
          className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-red-600 px-4 py-3 text-sm font-black text-white shadow-md shadow-red-600/20 hover:bg-red-700 disabled:opacity-50"
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
    console.log('[CreateFlashcardModal save clicked]:', { folderId, front, back, busy, userId: activeUserId });
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
      console.log('[CreateFlashcardModal calling createFolderFlashcard]...');
      const res = await createFolderFlashcard(activeUserId, folderId, { front: front.trim(), back: back.trim(), tags: [] });
      console.log('[CreateFlashcardModal card created]:', res);
      onSaved?.();
      onClose();
    } catch (failure) {
      console.error('[CreateFlashcardModal error]:', failure);
      setError(readableError(failure));
      setBusy(false);
    }
  };

  return (
    <Modal title="Criar Flashcard" eyebrow="Flashcard Manual" onClose={onClose}>
      <div className="space-y-4">
        <div>
          <label className="mb-1.5 block text-sm font-bold text-slate-700 dark:text-slate-200">
            Pasta de Destino
          </label>
          <CustomFolderSelect
            folders={folders}
            selectedFolderId={folderId}
            onSelectFolder={setFolderId}
          />
        </div>

        <div>
          <label className="block text-sm font-bold text-slate-700 dark:text-slate-200">
            Frente (Pergunta ou Conceito)
          </label>
          <textarea
            value={front}
            onChange={(e) => setFront(e.target.value)}
            rows={3}
            className="mt-1.5 w-full resize-none rounded-xl border border-slate-300 bg-transparent px-3 py-2.5 text-sm outline-none focus:border-red-500 dark:border-slate-700 dark:text-white"
            placeholder="Ex.: Quais são os elementos do fato típico?"
          />
        </div>

        <div>
          <label className="block text-sm font-bold text-slate-700 dark:text-slate-200">
            Verso (Resposta)
          </label>
          <textarea
            value={back}
            onChange={(e) => setBack(e.target.value)}
            rows={4}
            className="mt-1.5 w-full resize-none rounded-xl border border-slate-300 bg-transparent px-3 py-2.5 text-sm outline-none focus:border-red-500 dark:border-slate-700 dark:text-white"
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
          className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-red-600 px-4 py-3 text-sm font-black text-white shadow-md shadow-red-600/20 hover:bg-red-700 disabled:opacity-50"
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
    try {
      let targetFolderId = lockedFolder?.id || folderId;
      if (!lockedFolder && mode === 'new') {
        const folder = await createStudyFolder({
          name: newFolderName.trim() || String(file.name).replace(/\.apkg$/i, ''),
          description: 'Importado do Anki',
          color: 'red',
        });
        targetFolderId = folder.id;
      }
      if (!targetFolderId) throw new Error('Selecione uma pasta de destino.');

      const result = await importAnkiPackage(userId, file, {
        folderId: targetFolderId,
        onProgress: setProgress,
      });

      onImported?.(targetFolderId, result);
      onClose();
    } catch (failure) {
      setError(readableError(failure));
      setProgress(null);
    }
  };

  return (
    <Modal title="Importar Anki" eyebrow={lockedFolder?.name || 'Pacote .apkg'} onClose={onClose}>
      <div className="space-y-4">
        <label className="flex min-h-28 cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-300 p-4 text-center transition hover:border-red-400 dark:border-slate-700">
          <FileArchive size={32} className="text-red-600" />
          <span className="mt-2 text-sm font-bold text-slate-900 dark:text-white">
            {file?.name || 'Selecionar arquivo .apkg'}
          </span>
          <span className="mt-1 text-xs text-slate-400">
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
                  : 'border-slate-200 dark:border-slate-700 dark:text-slate-300'
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
                  : 'border-slate-200 dark:border-slate-700 dark:text-slate-300'
              }`}
            >
              Pasta existente
            </button>
          </div>
        )}

        {!lockedFolder && mode === 'new' && (
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Nome da nova pasta
            </label>
            <input
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-300 bg-transparent px-3 py-2 text-sm outline-none focus:border-red-500 dark:border-slate-700 dark:text-white"
              placeholder="Nome da pasta"
            />
          </div>
        )}

        {!lockedFolder && mode === 'existing' && (
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
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
          className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-red-600 px-4 py-3 text-sm font-black text-white shadow-md shadow-red-600/20 hover:bg-red-700 disabled:opacity-50"
        >
          <FileArchive size={17} />
          {progress !== null ? 'Importando...' : 'Iniciar Importação'}
        </button>
      </div>
    </Modal>
  );
}

/**
 * Modal de Resumo Pós-Importação Anki (Item 18)
 */
export function AnkiImportSummaryModal({
  report,
  onClose,
  onViewFolder,
}) {
  if (!report) return null;

  const hasWarnings = (report.warnings && report.warnings.length > 0) || Number(report.cardsSkipped || 0) > 0;
  const cardsImported = Number(report.cardsAdded || 0) + Number(report.cardsUpdated || 0);
  const totalAnalyzed = Number(report.totalCardsAnalyzed || report.cardsFound || cardsImported);

  return (
    <Modal
      title={hasWarnings ? 'Importação Concluída com Avisos' : 'Importação Concluída'}
      eyebrow={hasWarnings ? 'Avisos da Importação' : 'Sucesso'}
      onClose={onClose}
      maxWidth="max-w-md"
    >
      <div className="space-y-4">
        {/* Banner de Status */}
        <div
          className={`flex items-start gap-3 rounded-2xl p-4 ${
            hasWarnings
              ? 'bg-amber-500/10 text-amber-900 dark:text-amber-200'
              : 'bg-emerald-500/10 text-emerald-900 dark:text-emerald-200'
          }`}
        >
          <div
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white shadow-sm ${
              hasWarnings ? 'bg-amber-500' : 'bg-emerald-600'
            }`}
          >
            {hasWarnings ? <AlertTriangle size={20} /> : <CheckCircle2 size={20} />}
          </div>
          <div>
            <h3 className="font-bold text-sm">
              {hasWarnings
                ? 'O pacote foi importado com observações'
                : 'Todos os cards foram importados com sucesso'}
            </h3>
            <p className="mt-0.5 text-xs opacity-80">
              A árvore de pastas e baralhos foi estruturada no seu ambiente.
            </p>
          </div>
        </div>

        {/* Estatísticas Autoritativas */}
        <div className="grid grid-cols-3 gap-2">
          <div className="rounded-2xl border border-slate-200 bg-slate-50/50 p-3 text-center dark:border-slate-800 dark:bg-slate-800/40">
            <span className="block text-xl font-black text-slate-950 dark:text-white">
              {cardsImported.toLocaleString('pt-BR')}
            </span>
            <span className="text-[11px] font-semibold text-slate-500">Flashcards</span>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50/50 p-3 text-center dark:border-slate-800 dark:bg-slate-800/40">
            <span className="block text-xl font-black text-slate-950 dark:text-white">
              {Number(report.foldersCreated || report.deckCount || 0).toLocaleString('pt-BR')}
            </span>
            <span className="text-[11px] font-semibold text-slate-500">Pastas/Decks</span>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50/50 p-3 text-center dark:border-slate-800 dark:bg-slate-800/40">
            <span className="block text-xl font-black text-slate-950 dark:text-white">
              {Number(report.mediaImported || 0).toLocaleString('pt-BR')}
            </span>
            <span className="text-[11px] font-semibold text-slate-500">Mídias</span>
          </div>
        </div>

        {/* Detalhes de Atualizados / Ignorados se houver */}
        {(Number(report.cardsUpdated || 0) > 0 || Number(report.cardsSkipped || 0) > 0) && (
          <div className="rounded-xl bg-slate-100 p-3 text-xs text-slate-600 dark:bg-slate-800 dark:text-slate-300">
            {Number(report.cardsUpdated || 0) > 0 ? (
              <p>• <strong>{report.cardsUpdated}</strong> cards já existentes foram atualizados.</p>
            ) : null}
            {Number(report.cardsSkipped || 0) > 0 ? (
              <p>• <strong>{report.cardsSkipped}</strong> cards foram ignorados.</p>
            ) : null}
          </div>
        )}

        {/* Lista de Avisos (se houver) */}
        {report.warnings && report.warnings.length > 0 && (
          <div className="max-h-28 overflow-y-auto rounded-xl border border-amber-200/50 bg-amber-50/30 p-2.5 text-[11px] text-amber-800 dark:border-amber-900/30 dark:text-amber-300">
            <p className="font-bold mb-1">Observações do arquivo:</p>
            <ul className="list-disc pl-4 space-y-0.5">
              {report.warnings.map((w, idx) => (
                <li key={idx}>{w}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Ações */}
        <div className="flex gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-xl border border-slate-200 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-100 dark:border-slate-800 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            Fechar
          </button>
          <button
            type="button"
            onClick={() => {
              onViewFolder?.(report.targetFolderId || report.folderId || report.rootFolderId);
              onClose();
            }}
            className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl bg-red-600 py-2.5 text-xs font-black text-white shadow-md shadow-red-600/20 hover:bg-red-700"
          >
            <span>Ver pasta importada</span>
            <ArrowRight size={14} />
          </button>
        </div>
      </div>
    </Modal>
  );
}
