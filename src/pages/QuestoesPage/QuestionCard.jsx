import React, { useState } from 'react';
import { motion as Motion, AnimatePresence } from 'framer-motion';
import {
  AlertCircle,
  BookOpen,
  CheckCircle2,
  Edit3,
  HelpCircle,
  Loader2,
  RotateCcw,
  Sparkles,
  Trash2,
  XCircle,
} from 'lucide-react';
import { submitQuestionAnswer } from '../../services/questions/questionsService.js';

const DIFFICULTY_LABELS = {
  easy: { label: 'Fácil', color: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800' },
  medium: { label: 'Média', color: 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 border-amber-200 dark:border-amber-800' },
  hard: { label: 'Difícil', color: 'bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300 border-red-200 dark:border-red-800' },
};

/**
 * Card interativo de visualização e resolução de uma questão.
 */
export default function QuestionCard({
  question,
  currentUser,
  onEdit,
  onDelete,
  onAnswered,
}) {
  const [selectedOptionId, setSelectedOptionId] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submissionResult, setSubmissionResult] = useState(null);
  const [submissionError, setSubmissionError] = useState(null);
  const [showExplanation, setShowExplanation] = useState(false);

  const isAnswered = Boolean(submissionResult);
  const isOwner = currentUser?.uid && question.questionScope === 'private' && question.userId === currentUser.uid;
  const diffInfo = DIFFICULTY_LABELS[question.difficulty] || DIFFICULTY_LABELS.medium;

  const handleSelectOption = (optionId) => {
    if (isAnswered || isSubmitting) return;
    setSelectedOptionId(optionId);
    setSubmissionError(null);
  };

  const handleAnswerSubmit = async () => {
    if (!selectedOptionId || isSubmitting || isAnswered) return;

    setIsSubmitting(true);
    setSubmissionError(null);

    try {
      const result = await submitQuestionAnswer({
        questionId: question.id,
        questionScope: question.questionScope,
        selectedOptionId,
        timeSpentSeconds: 0,
      });

      setSubmissionResult(result);
      setShowExplanation(true);
      if (onAnswered) {
        onAnswered(result);
      }
    } catch (err) {
      console.error('[QuestionCard] Erro ao enviar resposta:', err);
      setSubmissionError(err.message || 'Não foi possível validar a resposta. Tente novamente.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResetForPractice = () => {
    setSelectedOptionId(null);
    setSubmissionResult(null);
    setSubmissionError(null);
    setShowExplanation(false);
  };

  return (
    <div className="rounded-2xl border border-zinc-200/80 bg-white p-5 shadow-sm transition-all duration-200 dark:border-zinc-800/80 dark:bg-card-dark sm:p-6">
      {/* Header com Metadados */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-100 pb-3 dark:border-zinc-800/60">
        <div className="flex flex-wrap items-center gap-2">
          {/* Badge Escopo */}
          <span className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider ${
            question.questionScope === 'private'
              ? 'bg-purple-50 text-purple-700 border border-purple-200 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-800'
              : 'bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800'
          }`}>
            <BookOpen size={12} />
            {question.questionScope === 'private' ? 'Minha Questão' : 'Oficial'}
          </span>

          {/* Disciplina / Matéria */}
          <span className="rounded-lg bg-zinc-100 px-2.5 py-1 text-xs font-semibold text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
            {question.subject || question.disciplineId}
          </span>

          {/* Dificuldade */}
          <span className={`rounded-lg border px-2.5 py-0.5 text-[11px] font-medium ${diffInfo.color}`}>
            {diffInfo.label}
          </span>

          {/* Banca e Ano */}
          {question.banca && (
            <span className="text-xs text-zinc-500 dark:text-zinc-400">
              {question.banca} {question.year ? `(${question.year})` : ''}
            </span>
          )}
        </div>

        {/* Ações de Edição/Exclusão do Dono */}
        {isOwner && (
          <div className="flex items-center gap-1">
            {onEdit && (
              <button
                type="button"
                onClick={() => onEdit(question)}
                className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
                title="Editar questão"
              >
                <Edit3 size={15} />
              </button>
            )}
            {onDelete && (
              <button
                type="button"
                onClick={() => onDelete(question)}
                className="rounded-lg p-1.5 text-zinc-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/30 dark:hover:text-red-400"
                title="Excluir questão"
              >
                <Trash2 size={15} />
              </button>
            )}
          </div>
        )}
      </div>

      {/* Enunciado */}
      <div className="mt-4 text-sm leading-relaxed font-medium text-zinc-800 dark:text-zinc-200 sm:text-base">
        <p className="whitespace-pre-line">{question.statement}</p>
      </div>

      {/* Alternativas */}
      <div className="mt-5 space-y-2.5" role="radiogroup" aria-label="Alternativas da questão">
        {question.options.map((option) => {
          const isSelected = selectedOptionId === option.id;
          const isCorrect = isAnswered && submissionResult?.correctOptionId === option.id;
          const isWrongSelected = isAnswered && isSelected && !submissionResult?.isCorrect;

          let optionStyle = 'border-zinc-200 hover:border-zinc-300 dark:border-zinc-800 dark:hover:border-zinc-700 bg-zinc-50/50 dark:bg-zinc-900/50 text-zinc-800 dark:text-zinc-200';

          if (isSelected && !isAnswered) {
            optionStyle = 'border-red-500 bg-red-50/60 dark:bg-red-950/30 text-red-900 dark:text-red-200 ring-2 ring-red-500/20';
          } else if (isCorrect) {
            optionStyle = 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-200 ring-2 ring-emerald-500/30 font-semibold';
          } else if (isWrongSelected) {
            optionStyle = 'border-red-500 bg-red-50 dark:bg-red-950/40 text-red-900 dark:text-red-200 ring-2 ring-red-500/30 line-through decoration-red-400';
          } else if (isAnswered) {
            optionStyle = 'border-zinc-200/50 bg-zinc-50/30 dark:border-zinc-800/40 dark:bg-zinc-900/20 text-zinc-400 dark:text-zinc-600 opacity-70';
          }

          return (
            <button
              key={option.id}
              type="button"
              role="radio"
              aria-checked={isSelected}
              disabled={isAnswered || isSubmitting}
              onClick={() => handleSelectOption(option.id)}
              className={`flex w-full items-start gap-3 rounded-xl border p-3.5 text-left transition-all duration-150 ${optionStyle}`}
            >
              {/* Identificador da Alternativa (A, B, C...) */}
              <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-xs font-bold ${
                isSelected && !isAnswered
                  ? 'bg-red-600 text-white'
                  : isCorrect
                  ? 'bg-emerald-600 text-white'
                  : isWrongSelected
                  ? 'bg-red-600 text-white'
                  : 'bg-zinc-200/70 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300'
              }`}>
                {isCorrect ? <CheckCircle2 size={15} /> : isWrongSelected ? <XCircle size={15} /> : option.id}
              </span>

              {/* Texto da Alternativa */}
              <span className="mt-0.5 text-xs sm:text-sm leading-relaxed">{option.text}</span>
            </button>
          );
        })}
      </div>

      {/* Erro de Submissão */}
      {submissionError && (
        <div className="mt-3 flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-xs font-medium text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300">
          <AlertCircle size={15} className="shrink-0" />
          <span>{submissionError}</span>
        </div>
      )}

      {/* Barra de Ação (Submissão ou Feedback) */}
      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-zinc-100 dark:border-zinc-800/60">
        {!isAnswered ? (
          <div className="flex w-full items-center justify-end gap-3 sm:w-auto ml-auto">
            <button
              type="button"
              disabled={!selectedOptionId || isSubmitting}
              onClick={handleAnswerSubmit}
              className="flex items-center justify-center gap-2 rounded-xl bg-red-600 px-6 py-2.5 text-xs font-bold text-white shadow-md shadow-red-600/20 transition-all hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed sm:text-sm"
            >
              {isSubmitting ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  <span>Validando resposta...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 size={16} />
                  <span>Responder</span>
                </>
              )}
            </button>
          </div>
        ) : (
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 w-full">
            {/* Feedback de Acerto / Erro */}
            <div className="flex flex-wrap items-center gap-2">
              {submissionResult.isCorrect ? (
                <div className="flex items-center gap-1.5 rounded-lg bg-emerald-100/80 px-3 py-1.5 text-xs font-bold text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-200">
                  <CheckCircle2 size={15} />
                  <span>Parabéns, você acertou!</span>
                </div>
              ) : (
                <div className="flex items-center gap-1.5 rounded-lg bg-red-100/80 px-3 py-1.5 text-xs font-bold text-red-800 dark:bg-red-950/60 dark:text-red-200">
                  <XCircle size={15} />
                  <span>Resposta incorreta — salvo no Caderno de Erros</span>
                </div>
              )}

              {/* XP Ganho */}
              {typeof submissionResult.xpEarned === 'number' && submissionResult.xpEarned > 0 && (
                <span className="inline-flex items-center gap-1 rounded-lg bg-amber-100/80 px-2.5 py-1 text-xs font-black text-amber-800 dark:bg-amber-950/60 dark:text-amber-300">
                  <Sparkles size={13} className="text-amber-500" />
                  +{submissionResult.xpEarned} XP
                </span>
              )}
            </div>

            <div className="flex items-center gap-2 ml-auto">
              <button
                type="button"
                onClick={() => setShowExplanation(!showExplanation)}
                className="flex items-center gap-1 rounded-lg border border-zinc-200 px-3 py-1.5 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
              >
                <HelpCircle size={13} />
                <span>{showExplanation ? 'Ocultar Explicação' : 'Ver Explicação'}</span>
              </button>

              <button
                type="button"
                onClick={handleResetForPractice}
                className="flex items-center gap-1 rounded-lg border border-zinc-200 px-3 py-1.5 text-xs font-semibold text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
                title="Tentar novamente"
              >
                <RotateCcw size={13} />
                <span>Tentar de novo</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Explicação / Comentário Pedagógico */}
      <AnimatePresence>
        {isAnswered && showExplanation && submissionResult?.explanation && (
          <Motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="mt-4 rounded-xl border border-blue-200/80 bg-blue-50/70 p-4 text-xs sm:text-sm text-blue-950 dark:border-blue-900/40 dark:bg-blue-950/30 dark:text-blue-200">
              <div className="flex items-center gap-2 font-bold mb-1.5 text-blue-900 dark:text-blue-300">
                <BookOpen size={15} />
                <span>Comentário do Professor / Explicação</span>
              </div>
              <p className="whitespace-pre-line leading-relaxed">{submissionResult.explanation}</p>
            </div>
          </Motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
