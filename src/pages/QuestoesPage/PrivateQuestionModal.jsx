import React, { useState, useEffect, useRef } from 'react';
import { motion as Motion, AnimatePresence } from 'framer-motion';
import {
  AlertCircle,
  CheckCircle2,
  HelpCircle,
  Loader2,
  Plus,
  Trash2,
  X,
} from 'lucide-react';
import {
  createPrivateQuestion,
  updatePrivateQuestion,
} from '../../services/questions/questionsService.js';

const DEFAULT_OPTIONS = [
  { id: 'A', text: '' },
  { id: 'B', text: '' },
  { id: 'C', text: '' },
  { id: 'D', text: '' },
];

export default function PrivateQuestionModal({
  isOpen,
  onClose,
  onSaved,
  questionToEdit = null,
  currentUser,
}) {
  const [statement, setStatement] = useState('');
  const [disciplineId, setDisciplineId] = useState('Direito Constitucional');
  const [subject, setSubject] = useState('');
  const [banca, setBanca] = useState('');
  const [year, setYear] = useState('');
  const [difficulty, setDifficulty] = useState('medium');
  const [options, setOptions] = useState(DEFAULT_OPTIONS);
  const [correctOptionId, setCorrectOptionId] = useState(null);
  const [explanation, setExplanation] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);
  const dialogRef = useRef(null);

  const isEditMode = Boolean(questionToEdit?.id);

  useEffect(() => {
    if (questionToEdit) {
      setStatement(questionToEdit.statement || '');
      setDisciplineId(questionToEdit.disciplineId || 'geral');
      setSubject(questionToEdit.subject || '');
      setBanca(questionToEdit.banca || '');
      setYear(questionToEdit.year ? String(questionToEdit.year) : '');
      setDifficulty(questionToEdit.difficulty || 'medium');
      setOptions(
        Array.isArray(questionToEdit.options) && questionToEdit.options.length >= 2
          ? questionToEdit.options
          : DEFAULT_OPTIONS
      );
      setCorrectOptionId(null);
      setExplanation('');
    } else {
      setStatement('');
      setDisciplineId('Direito Constitucional');
      setSubject('');
      setBanca('');
      setYear('');
      setDifficulty('medium');
      setOptions(DEFAULT_OPTIONS);
      setCorrectOptionId(null);
      setExplanation('');
    }
    setErrorMessage(null);
  }, [questionToEdit, isOpen]);

  useEffect(() => {
    if (!isOpen) return undefined;
    const previouslyFocused = document.activeElement;
    const handleKeyDown = (event) => {
      if (event.key === 'Escape' && !isSaving) onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    requestAnimationFrame(() => dialogRef.current?.focus());
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      previouslyFocused?.focus?.();
    };
  }, [isOpen, isSaving, onClose]);

  if (!isOpen) return null;

  const handleOptionTextChange = (index, text) => {
    setOptions((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], text };
      return updated;
    });
  };

  const handleAddOption = () => {
    if (options.length >= 5) return;
    const nextId = String.fromCharCode(65 + options.length);
    setOptions((prev) => [...prev, { id: nextId, text: '' }]);
  };

  const handleRemoveOption = (indexToRemove) => {
    if (options.length <= 2) return;
    const filtered = options.filter((_, idx) => idx !== indexToRemove);
    const reindexed = filtered.map((opt, idx) => ({
      id: String.fromCharCode(65 + idx),
      text: opt.text,
    }));
    setOptions(reindexed);
    if (!reindexed.some((opt) => opt.id === correctOptionId)) {
      setCorrectOptionId(null);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!currentUser?.uid) {
      setErrorMessage('Você precisa estar autenticado para salvar questões.');
      return;
    }

    const trimmedStatement = statement.trim();
    if (!trimmedStatement) {
      setErrorMessage('O enunciado da questão é obrigatório.');
      return;
    }

    const emptyOptionIndex = options.findIndex((opt) => !opt.text.trim());
    if (emptyOptionIndex !== -1) {
      setErrorMessage(`Preencha o texto da alternativa ${options[emptyOptionIndex].id}.`);
      return;
    }

    if ((!isEditMode || correctOptionId) && (!correctOptionId || !options.some((opt) => opt.id === correctOptionId))) {
      setErrorMessage('Selecione uma alternativa como gabarito correto.');
      return;
    }

    setIsSaving(true);
    setErrorMessage(null);

    const payload = {
      question: {
        statement: trimmedStatement,
        options: options.map((opt) => ({ id: opt.id, text: opt.text.trim() })),
        disciplineId: disciplineId.trim() || 'geral',
        subject: subject.trim() || 'Geral',
        difficulty,
        sourceType: 'manual',
        ...(banca.trim() ? { banca: banca.trim() } : {}),
        ...(year.trim() ? { year: Number(year) } : {}),
      },
      ...((!isEditMode || correctOptionId) ? {
        answerKey: {
          correctOptionId,
          explanation: explanation.trim() || '',
        },
      } : {}),
    };

    try {
      let savedQuestion;
      if (isEditMode) {
        savedQuestion = await updatePrivateQuestion(currentUser.uid, questionToEdit.id, payload);
      } else {
        savedQuestion = await createPrivateQuestion(currentUser.uid, payload);
      }

      if (onSaved) onSaved(savedQuestion);
      onClose();
    } catch (err) {
      console.error('[PrivateQuestionModal] Erro ao salvar questão:', err);
      setErrorMessage(err.message || 'Não foi possível salvar a questão. Tente novamente.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/60 p-4 backdrop-blur-sm">
      <Motion.div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="private-question-modal-title"
        tabIndex={-1}
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl border border-zinc-200 bg-white p-6 shadow-2xl dark:border-zinc-800 dark:bg-card-dark"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-100 pb-4 dark:border-zinc-800/80">
          <div>
            <h3 id="private-question-modal-title" className="text-lg font-bold text-zinc-900 dark:text-white">
              {isEditMode ? 'Editar Questão Privada' : 'Criar Nova Questão Privada'}
            </h3>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              O gabarito e a explicação são armazenados com segurança e protegidos no backend.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar modal de questão privada"
            className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
          >
            <X size={18} />
          </button>
        </div>

        {/* Formulário */}
        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          {errorMessage && (
            <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-xs font-medium text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300">
              <AlertCircle size={16} className="shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Enunciado */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-zinc-600 dark:text-zinc-400 mb-1.5">
              Enunciado da Questão *
            </label>
            <textarea
              required
              rows={4}
              value={statement}
              onChange={(e) => setStatement(e.target.value)}
              placeholder="Digite o enunciado completo da questão..."
              className="w-full rounded-xl border border-zinc-200 bg-zinc-50/50 p-3 text-sm text-zinc-800 placeholder-zinc-400 focus:border-red-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-red-500/20 dark:border-zinc-800 dark:bg-zinc-900/50 dark:text-zinc-200 dark:focus:bg-zinc-900"
            />
          </div>

          {/* Metadados: Disciplina, Assunto, Dificuldade */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div>
              <label className="block text-xs font-semibold text-zinc-600 dark:text-zinc-400 mb-1">
                Disciplina *
              </label>
              <input
                type="text"
                required
                value={disciplineId}
                onChange={(e) => setDisciplineId(e.target.value)}
                placeholder="Ex: Direito Penal"
                className="w-full rounded-xl border border-zinc-200 bg-zinc-50/50 p-2.5 text-xs text-zinc-800 focus:border-red-500 focus:bg-white focus:outline-none dark:border-zinc-800 dark:bg-zinc-900/50 dark:text-zinc-200"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-zinc-600 dark:text-zinc-400 mb-1">
                Assunto / Tópico *
              </label>
              <input
                type="text"
                required
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Ex: Crimes contra a vida"
                className="w-full rounded-xl border border-zinc-200 bg-zinc-50/50 p-2.5 text-xs text-zinc-800 focus:border-red-500 focus:bg-white focus:outline-none dark:border-zinc-800 dark:bg-zinc-900/50 dark:text-zinc-200"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-zinc-600 dark:text-zinc-400 mb-1">
                Dificuldade
              </label>
              <select
                value={difficulty}
                onChange={(e) => setDifficulty(e.target.value)}
                className="w-full rounded-xl border border-zinc-200 bg-zinc-50/50 p-2.5 text-xs text-zinc-800 focus:border-red-500 focus:bg-white focus:outline-none dark:border-zinc-800 dark:bg-zinc-900/50 dark:text-zinc-200"
              >
                <option value="easy">Fácil</option>
                <option value="medium">Média</option>
                <option value="hard">Difícil</option>
              </select>
            </div>
          </div>

          {/* Banca e Ano */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-semibold text-zinc-600 dark:text-zinc-400 mb-1">
                Banca (opcional)
              </label>
              <input
                type="text"
                value={banca}
                onChange={(e) => setBanca(e.target.value)}
                placeholder="Ex: FCC, Cebraspe, FGV"
                className="w-full rounded-xl border border-zinc-200 bg-zinc-50/50 p-2.5 text-xs text-zinc-800 focus:border-red-500 focus:bg-white focus:outline-none dark:border-zinc-800 dark:bg-zinc-900/50 dark:text-zinc-200"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-zinc-600 dark:text-zinc-400 mb-1">
                Ano (opcional)
              </label>
              <input
                type="number"
                min="1990"
                max="2030"
                value={year}
                onChange={(e) => setYear(e.target.value)}
                placeholder="Ex: 2024"
                className="w-full rounded-xl border border-zinc-200 bg-zinc-50/50 p-2.5 text-xs text-zinc-800 focus:border-red-500 focus:bg-white focus:outline-none dark:border-zinc-800 dark:bg-zinc-900/50 dark:text-zinc-200"
              />
            </div>
          </div>

          {/* Alternativas */}
          <div className="pt-2">
            <div className="flex items-center justify-between mb-2">
              <label className="block text-xs font-bold uppercase tracking-wider text-zinc-600 dark:text-zinc-400">
                Alternativas (marque a correta) *
              </label>
              {options.length < 5 && (
                <button
                  type="button"
                  onClick={handleAddOption}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-red-600 hover:text-red-700 dark:text-red-400"
                >
                  <Plus size={14} />
                  <span>Adicionar Alternativa</span>
                </button>
              )}
            </div>

            <div className="space-y-2.5" role="radiogroup" aria-label="Gabarito correto">
              {options.map((option, index) => {
                const isCorrect = correctOptionId === option.id;
                return (
                  <div
                    key={option.id}
                    className={`flex items-center gap-2.5 rounded-xl border p-2.5 transition-all ${
                      isCorrect
                        ? 'border-emerald-500/80 bg-emerald-50/50 dark:border-emerald-700/60 dark:bg-emerald-950/20 ring-1 ring-emerald-500/30'
                        : 'border-zinc-200 bg-zinc-50/40 dark:border-zinc-800 dark:bg-zinc-900/30'
                    }`}
                  >
                    {/* Radio para definir o Gabarito Correto */}
                  <button
                    type="button"
                    onClick={() => setCorrectOptionId(option.id)}
                    role="radio"
                    aria-checked={isCorrect}
                      className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-xs font-bold transition-all ${
                        isCorrect
                          ? 'bg-emerald-600 text-white shadow-sm'
                          : 'bg-zinc-200 text-zinc-700 hover:bg-zinc-300 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700'
                      }`}
                      title={isCorrect ? 'Alternativa correta (gabarito)' : 'Clique para definir como gabarito correto'}
                    >
                      {option.id}
                    </button>

                    {/* Texto da Alternativa */}
                    <input
                      type="text"
                      required
                      value={option.text}
                      onChange={(e) => handleOptionTextChange(index, e.target.value)}
                      placeholder={`Texto da alternativa ${option.id}...`}
                      className="flex-1 bg-transparent text-xs sm:text-sm text-zinc-800 placeholder-zinc-400 focus:outline-none dark:text-zinc-200"
                    />

                    {/* Badge ou Ação de Remover */}
                    {isCorrect && (
                      <span className="hidden sm:inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                        <CheckCircle2 size={13} />
                        Gabarito
                      </span>
                    )}

                    {options.length > 2 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveOption(index)}
                        className="rounded-lg p-1 text-zinc-400 hover:text-red-500"
                        title="Remover alternativa"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
            {isEditMode && !correctOptionId && (
              <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
                O gabarito protegido atual será preservado. Se você remover a alternativa correta, selecione explicitamente um novo gabarito.
              </p>
            )}
          </div>

          {/* Explicação / Comentário */}
          <div className="pt-2">
            <label className="block text-xs font-bold uppercase tracking-wider text-zinc-600 dark:text-zinc-400 mb-1.5">
              Comentário / Explicação da Resposta (revelada após resolução)
            </label>
            <textarea
              rows={3}
              value={explanation}
              onChange={(e) => setExplanation(e.target.value)}
              placeholder="Explique por que o gabarito está correto para auxiliar nos seus estudos futuros..."
              className="w-full rounded-xl border border-zinc-200 bg-zinc-50/50 p-3 text-xs sm:text-sm text-zinc-800 placeholder-zinc-400 focus:border-red-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-red-500/20 dark:border-zinc-800 dark:bg-zinc-900/50 dark:text-zinc-200 dark:focus:bg-zinc-900"
            />
          </div>

          {/* Footer / Botões */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-zinc-100 dark:border-zinc-800/80">
            <button
              type="button"
              disabled={isSaving}
              onClick={onClose}
              className="rounded-xl border border-zinc-200 px-4 py-2.5 text-xs font-semibold text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="flex items-center gap-2 rounded-xl bg-red-600 px-6 py-2.5 text-xs font-bold text-white shadow-md shadow-red-600/20 hover:bg-red-700 disabled:opacity-50"
            >
              {isSaving ? (
                <>
                  <Loader2 size={15} className="animate-spin" />
                  <span>Salvando...</span>
                </>
              ) : (
                <span>{isEditMode ? 'Atualizar Questão' : 'Salvar Questão'}</span>
              )}
            </button>
          </div>
        </form>
      </Motion.div>
    </div>
  );
}
