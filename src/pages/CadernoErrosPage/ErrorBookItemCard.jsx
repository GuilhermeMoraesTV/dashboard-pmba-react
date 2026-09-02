import React, { useState } from 'react';
import { motion as Motion, AnimatePresence } from 'framer-motion';
import {
  AlertTriangle,
  Award,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Edit2,
  FileText,
  HelpCircle,
  Loader2,
  RotateCcw,
  Save,
  Sparkles,
  XCircle,
} from 'lucide-react';
import {
  getErrorBookEntryById,
  markErrorBookEntryMastered,
  updateErrorBookUserNotes,
} from '../../services/errorBook/errorBookService.js';
import { submitQuestionAnswer } from '../../services/questions/questionsService.js';

/**
 * Card individual do Caderno de Erros (Polimórfico).
 */
export default function ErrorBookItemCard({
  entry,
  currentUser,
  onEntryUpdated,
}) {
  const [isEditingNotes, setIsEditingNotes] = useState(false);
  const [notesDraft, setNotesDraft] = useState(entry.userNotes || '');
  const [isSavingNotes, setIsSavingNotes] = useState(false);

  const [isTogglingMastered, setIsTogglingMastered] = useState(false);

  // Modo de re-resolução da questão
  const [isResolving, setIsResolving] = useState(false);
  const [selectedOptionId, setSelectedOptionId] = useState(null);
  const [isSubmittingAnswer, setIsSubmittingAnswer] = useState(false);
  const [resolutionResult, setResolutionResult] = useState(null);

  const isQuestion = entry.sourceType === 'question';
  const preview = entry.preview || {};

  // Salva anotações pessoais
  const handleSaveNotes = async () => {
    if (!currentUser?.uid) return;
    setIsSavingNotes(true);
    try {
      await updateErrorBookUserNotes(currentUser.uid, entry.id, notesDraft);
      setIsEditingNotes(false);
      if (onEntryUpdated) onEntryUpdated({ ...entry, userNotes: notesDraft.trim() || null });
    } catch (err) {
      console.error('[ErrorBookItemCard] Erro ao salvar notas:', err);
      alert('Não foi possível salvar as anotações: ' + (err.message || 'Tente novamente.'));
    } finally {
      setIsSavingNotes(false);
    }
  };

  // Alterna o status de dominado
  const handleToggleMastered = async () => {
    if (!currentUser?.uid || isTogglingMastered) return;
    setIsTogglingMastered(true);
    const newMastered = !entry.mastered;

    try {
      await markErrorBookEntryMastered(currentUser.uid, entry.id, newMastered);
      if (onEntryUpdated) {
        onEntryUpdated({
          ...entry,
          mastered: newMastered,
          masteredAt: newMastered ? new Date() : null,
        });
      }
    } catch (err) {
      console.error('[ErrorBookItemCard] Erro ao alternar dominio:', err);
      alert('Não foi possível atualizar o status de domínio.');
    } finally {
      setIsTogglingMastered(false);
    }
  };

  // Re-resolve a questão
  const handleReAnswerSubmit = async () => {
    if (!selectedOptionId || isSubmittingAnswer || !isQuestion) return;

    setIsSubmittingAnswer(true);
    try {
      const result = await submitQuestionAnswer({
        questionId: entry.sourceId,
        questionScope: entry.questionScope || 'global',
        selectedOptionId,
        timeSpentSeconds: 0,
      });

      setResolutionResult(result);
      if (onEntryUpdated) {
        const refreshedEntry = await getErrorBookEntryById(currentUser.uid, entry.id);
        if (refreshedEntry) onEntryUpdated(refreshedEntry);
      }
    } catch (err) {
      console.error('[ErrorBookItemCard] Erro ao re-resolver questao:', err);
      alert('Erro ao enviar resposta: ' + (err.message || 'Tente novamente.'));
    } finally {
      setIsSubmittingAnswer(false);
    }
  };

  const formattedDate = entry.lastAttemptAt instanceof Date
    ? entry.lastAttemptAt.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
    : 'Recentemente';

  return (
    <div className={`rounded-2xl border bg-white p-5 shadow-sm transition-all duration-200 dark:bg-card-dark sm:p-6 ${
      entry.mastered
        ? 'border-emerald-200/90 dark:border-emerald-800/60 bg-emerald-50/20 dark:bg-emerald-950/10'
        : 'border-zinc-200/80 dark:border-zinc-800/80'
    }`}>
      {/* Header do Item de Erro */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-100 pb-3 dark:border-zinc-800/60">
        <div className="flex flex-wrap items-center gap-2">
          {/* Badge Tipo de Origem */}
          <span className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider ${
            isQuestion
              ? 'bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800'
              : 'bg-purple-50 text-purple-700 border border-purple-200 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-800'
          }`}>
            <HelpCircle size={12} />
            Questão
          </span>

          {/* Matéria / Assunto */}
          {(entry.subject || entry.disciplineId) && (
            <span className="rounded-lg bg-zinc-100 px-2.5 py-1 text-xs font-semibold text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
              {entry.subject || entry.disciplineId}
            </span>
          )}

          {/* Badge Dominado / Em Aberto */}
          {entry.mastered ? (
            <span className="inline-flex items-center gap-1 rounded-lg bg-emerald-100/90 px-2.5 py-1 text-[11px] font-bold text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
              <Award size={13} />
              Dominado
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-lg bg-amber-100/80 px-2.5 py-1 text-[11px] font-bold text-amber-800 dark:bg-amber-950/50 dark:text-amber-300">
              <AlertTriangle size={12} />
              Pendente de Fixação
            </span>
          )}
        </div>

        {/* Contadores e Data */}
        <div className="flex items-center gap-3 text-xs">
          <div className="flex items-center gap-1.5 font-bold">
            <span className="text-red-500 font-black">❌ {entry.wrongCount || 1} erro(s)</span>
            <span className="text-zinc-300 dark:text-zinc-700">|</span>
            <span className="text-emerald-600 dark:text-emerald-400 font-black">✅ {entry.correctCount || 0} acerto(s)</span>
          </div>

          <span className="text-zinc-400 text-[11px]">{formattedDate}</span>
        </div>
      </div>

      {/* Preview do Conteúdo (Enunciado / Frente) */}
      <div className="mt-4 space-y-3 text-sm leading-relaxed text-zinc-800 dark:text-zinc-200">
        <p className="whitespace-pre-line font-medium">
          {preview.statement || preview.front || preview.snippet || 'Detalhes do item...'}
        </p>

        {/* Alternativas (se questão e não estiver em modo de resolução) */}
        {!isResolving && Array.isArray(preview.options) && preview.options.length > 0 && (
          <div className="space-y-1.5 pt-1">
            {preview.options.map((opt) => {
              const isCorrectOpt = preview.correctOptionId === opt.id;
              const isUserSelected = preview.userSelectedOptionId === opt.id;

              return (
                <div
                  key={opt.id}
                  className={`flex items-start gap-2.5 rounded-xl border p-2.5 text-xs ${
                    isCorrectOpt
                      ? 'border-emerald-500/80 bg-emerald-50/60 dark:border-emerald-800/60 dark:bg-emerald-950/30 text-emerald-900 dark:text-emerald-200 font-semibold'
                      : isUserSelected
                      ? 'border-red-400/80 bg-red-50/60 dark:border-red-900/40 dark:bg-red-950/20 text-red-900 dark:text-red-300'
                      : 'border-zinc-200/60 bg-zinc-50/40 dark:border-zinc-800/40 dark:bg-zinc-900/30 text-zinc-600 dark:text-zinc-400 opacity-80'
                  }`}
                >
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded text-[11px] font-bold bg-white/80 dark:bg-zinc-800">
                    {opt.id}
                  </span>
                  <span className="mt-0.5">{opt.text}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Painel de Resolução Interativa Integrada */}
      <AnimatePresence>
        {isResolving && isQuestion && (
          <Motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mt-4 rounded-xl border border-blue-200 bg-blue-50/40 p-4 dark:border-blue-900/40 dark:bg-blue-950/20 space-y-3"
          >
            <div className="flex items-center justify-between text-xs font-bold text-blue-900 dark:text-blue-300">
              <span className="flex items-center gap-1.5">
                <RotateCcw size={14} />
                Re-resolvendo Questão
              </span>
              <button
                type="button"
                onClick={() => {
                  setIsResolving(false);
                  setResolutionResult(null);
                  setSelectedOptionId(null);
                }}
                className="text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200"
              >
                Fechar
              </button>
            </div>

            {/* Alternativas Interativas */}
            <div className="space-y-2" role="radiogroup" aria-label="Alternativas para re-resolver a questão">
              {(preview.options || []).map((opt) => {
                const isSelected = selectedOptionId === opt.id;
                const isResultDone = Boolean(resolutionResult);
                const isCorrect = isResultDone && resolutionResult?.correctOptionId === opt.id;
                const isWrong = isResultDone && isSelected && !resolutionResult?.isCorrect;

                return (
                  <button
                    key={opt.id}
                    type="button"
                    role="radio"
                    aria-checked={isSelected}
                    disabled={isResultDone || isSubmittingAnswer}
                    onClick={() => setSelectedOptionId(opt.id)}
                    className={`flex w-full items-start gap-2.5 rounded-xl border p-2.5 text-left text-xs transition-all ${
                      isSelected && !isResultDone
                        ? 'border-red-500 bg-red-50/70 text-red-900 ring-2 ring-red-500/20'
                        : isCorrect
                        ? 'border-emerald-500 bg-emerald-50 text-emerald-900 font-bold ring-2 ring-emerald-500/30'
                        : isWrong
                        ? 'border-red-500 bg-red-50 text-red-900 line-through'
                        : 'border-zinc-200 bg-white hover:border-zinc-300 dark:border-zinc-800 dark:bg-zinc-900 text-zinc-800 dark:text-zinc-200'
                    }`}
                  >
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded text-[11px] font-bold bg-zinc-100 dark:bg-zinc-800">
                      {opt.id}
                    </span>
                    <span className="mt-0.5">{opt.text}</span>
                  </button>
                );
              })}
            </div>

            {/* Botão de Envio de Resposta */}
            {!resolutionResult ? (
              <div className="flex justify-end pt-2">
                <button
                  type="button"
                  disabled={!selectedOptionId || isSubmittingAnswer}
                  onClick={handleReAnswerSubmit}
                  className="flex items-center gap-1.5 rounded-xl bg-red-600 px-4 py-2 text-xs font-bold text-white shadow-md shadow-red-600/20 hover:bg-red-700 disabled:opacity-50"
                >
                  {isSubmittingAnswer ? (
                    <>
                      <Loader2 size={13} className="animate-spin" />
                      <span>Validando...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 size={14} />
                      <span>Confirmar Resposta</span>
                    </>
                  )}
                </button>
              </div>
            ) : (
              <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-blue-200/60 dark:border-blue-900/60 text-xs">
                <div className="flex items-center gap-1.5 font-bold">
                  {resolutionResult.isCorrect ? (
                    <span className="text-emerald-600 flex items-center gap-1">
                      <CheckCircle2 size={14} />
                      Acertou! Contador atualizado.
                    </span>
                  ) : (
                    <span className="text-red-500 flex items-center gap-1">
                      <XCircle size={14} />
                      Ainda incorreto. Revise suas anotações!
                    </span>
                  )}
                </div>

                {resolutionResult.explanation && (
                  <p className="w-full mt-1 text-[11px] text-zinc-600 dark:text-zinc-300 italic">
                    {resolutionResult.explanation}
                  </p>
                )}
              </div>
            )}
          </Motion.div>
        )}
      </AnimatePresence>

      {/* Seção de Anotações Pessoais do Estudante */}
      <div className="mt-4 rounded-xl border border-zinc-200/70 bg-zinc-50/60 p-3 dark:border-zinc-800/60 dark:bg-zinc-900/40">
        <div className="flex items-center justify-between text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1.5">
          <div className="flex items-center gap-1.5">
            <FileText size={14} className="text-amber-500" />
            <span>Minhas Anotações de Aprendizado</span>
          </div>
          {!isEditingNotes && (
            <button
              type="button"
              onClick={() => {
                setNotesDraft(entry.userNotes || '');
                setIsEditingNotes(true);
              }}
              className="inline-flex items-center gap-1 text-[11px] font-semibold text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200"
            >
              <Edit2 size={12} />
              <span>{entry.userNotes ? 'Editar' : 'Adicionar Anotação'}</span>
            </button>
          )}
        </div>

        {isEditingNotes ? (
          <div className="space-y-2 mt-2">
            <textarea
              rows={3}
              value={notesDraft}
              onChange={(e) => setNotesDraft(e.target.value)}
              placeholder="O que causou o erro? Qual conceito ou pegadinha você precisa memorizar?"
              className="w-full rounded-xl border border-zinc-300 bg-white p-2.5 text-xs text-zinc-800 placeholder-zinc-400 focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-500/20 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200"
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                disabled={isSavingNotes}
                onClick={() => setIsEditingNotes(false)}
                className="rounded-lg px-3 py-1.5 text-xs font-semibold text-zinc-600 hover:bg-zinc-200 dark:text-zinc-300 dark:hover:bg-zinc-800"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={isSavingNotes}
                onClick={handleSaveNotes}
                className="flex items-center gap-1 rounded-lg bg-red-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-red-700 disabled:opacity-50"
              >
                {isSavingNotes ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
                <span>Salvar Notas</span>
              </button>
            </div>
          </div>
        ) : (
          <p className="text-xs leading-relaxed text-zinc-600 dark:text-zinc-400 italic">
            {entry.userNotes ? `"${entry.userNotes}"` : 'Nenhuma anotação pessoal ainda. Registre o motivo do erro para acelerar sua retenção.'}
          </p>
        )}
      </div>

      {/* Rodapé do Card com Ações */}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-zinc-100 dark:border-zinc-800/60">
        {/* Toggle Dominado / Superado */}
        <button
          type="button"
          disabled={isTogglingMastered}
          onClick={handleToggleMastered}
          className={`inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-bold transition-all ${
            entry.mastered
              ? 'border border-emerald-300 bg-emerald-100 text-emerald-800 hover:bg-emerald-200 dark:border-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
              : 'border border-zinc-200 bg-zinc-100 text-zinc-700 hover:bg-zinc-200 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300'
          }`}
        >
          {isTogglingMastered ? (
            <Loader2 size={13} className="animate-spin" />
          ) : (
            <Award size={14} className={entry.mastered ? 'text-emerald-600' : 'text-zinc-400'} />
          )}
          <span>{entry.mastered ? 'Superado / Dominado' : 'Marcar como Dominado'}</span>
        </button>

        {/* Botão de Resolução para Questões */}
        {isQuestion && !isResolving && (
          <button
            type="button"
            onClick={() => {
              setIsResolving(true);
              setResolutionResult(null);
              setSelectedOptionId(null);
            }}
            className="flex items-center gap-1.5 rounded-xl bg-zinc-900 px-4 py-2 text-xs font-bold text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white transition-all shadow-sm"
          >
            <RotateCcw size={13} />
            <span>Resolver Novamente</span>
          </button>
        )}

      </div>
    </div>
  );
}
