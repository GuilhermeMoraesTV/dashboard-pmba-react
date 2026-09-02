import React, { useState, useEffect } from 'react';
import { X, Plus } from 'lucide-react';
import { DEFAULT_PRODUCT_LIMITS } from '../../config/productLimits.js';

const MAX_TAGS = DEFAULT_PRODUCT_LIMITS.flashcards.maxTagsPerCard;

/**
 * Modal para criar ou editar um Flashcard.
 * @param {{
 *   isOpen: boolean,
 *   onClose: () => void,
 *   onSave: (data: { front: string, back: string, tags: string[] }) => Promise<void>,
 *   initialData?: { front?: string, back?: string, tags?: string[] },
 *   mode?: 'create' | 'edit',
 * }} props
 */
export default function FlashcardEditor({ isOpen, onClose, onSave, initialData, mode = 'create' }) {
  const [front, setFront] = useState(initialData?.front || '');
  const [back, setBack] = useState(initialData?.back || '');
  const [tags, setTags] = useState(initialData?.tags || []);
  const [tagInput, setTagInput] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (isOpen) {
      setFront(initialData?.front || '');
      setBack(initialData?.back || '');
      setTags(initialData?.tags || []);
      setTagInput('');
      setSaving(false);
      setError(null);
    }
  }, [isOpen, initialData?.front, initialData?.back, initialData?.tags]);

  const addTag = () => {
    const tag = tagInput.trim().toLowerCase();
    if (!tag || tags.includes(tag) || tags.length >= MAX_TAGS) return;
    setTags((prev) => [...prev, tag]);
    setTagInput('');
  };

  const removeTag = (t) => setTags((prev) => prev.filter((x) => x !== t));

  const handleTagKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addTag();
    }
  };

  const handleSave = async () => {
    if (!front.trim()) { setError('A frente do card e obrigatoria.'); return; }
    if (!back.trim()) { setError('O verso do card e obrigatorio.'); return; }
    setSaving(true);
    setError(null);
    try {
      await onSave({ front: front.trim(), back: back.trim(), tags });
      onClose();
    } catch (err) {
      setError(err?.message || 'Erro ao salvar card.');
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-lg rounded-2xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 shadow-2xl p-6 flex flex-col gap-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-base font-black text-zinc-900 dark:text-white">
            {mode === 'edit' ? 'Editar Flashcard' : 'Novo Flashcard'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {error && (
          <div className="rounded-lg bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 p-3 text-sm text-red-700 dark:text-red-400">
            {error}
          </div>
        )}

        <div className="flex flex-col gap-1">
          <label className="text-xs font-black uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
            Frente
          </label>
          <textarea
            value={front}
            onChange={(e) => setFront(e.target.value)}
            rows={3}
            placeholder="Pergunta ou conceito..."
            className="w-full rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-100 p-3 text-sm font-medium resize-none focus:outline-none focus:ring-2 focus:ring-red-500"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs font-black uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
            Verso
          </label>
          <textarea
            value={back}
            onChange={(e) => setBack(e.target.value)}
            rows={4}
            placeholder="Resposta ou explicacao..."
            className="w-full rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-100 p-3 text-sm font-medium resize-none focus:outline-none focus:ring-2 focus:ring-red-500"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs font-black uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
            Tags {tags.length > 0 && `(${tags.length}/${MAX_TAGS})`}
          </label>
          <div className="flex flex-wrap gap-1.5 mb-1">
            {tags.map((tag) => (
              <span key={tag} className="inline-flex items-center gap-1 rounded-full bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300 text-xs font-semibold px-2.5 py-1">
                {tag}
                <button type="button" onClick={() => removeTag(tag)} className="hover:text-red-900 dark:hover:text-red-100"><X size={10} /></button>
              </span>
            ))}
          </div>
          {tags.length < MAX_TAGS && (
            <div className="flex gap-2">
              <input
                type="text"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={handleTagKeyDown}
                placeholder="Adicionar tag..."
                className="flex-1 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-100 p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
              />
              <button
                type="button"
                onClick={addTag}
                className="rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 p-2.5 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
              >
                <Plus size={16} />
              </button>
            </div>
          )}
        </div>

        <div className="flex gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="flex-1 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 font-bold py-3 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-700 transition-all disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || !front.trim() || !back.trim()}
            className="flex-1 rounded-xl bg-red-600 text-white font-bold py-3 text-sm hover:bg-red-700 transition-all shadow-lg shadow-red-600/20 disabled:opacity-50 disabled:cursor-not-allowed active:scale-95"
          >
            {saving ? 'Salvando...' : mode === 'edit' ? 'Salvar' : 'Criar Card'}
          </button>
        </div>
      </div>
    </div>
  );
}
