import React from 'react';
import { Trophy, RotateCcw, ArrowLeft, CheckCircle2, Clock } from 'lucide-react';

/**
 * Tela de conclusao da sessao de estudo estilo Anki com estatisticas e proxima revisao.
 * @param {{
 *   stats: { again: number, hard: number, good: number, easy: number, total: number },
 *   deckName: string,
 *   nextReviewLabel?: string,
 *   onBack: () => void,
 *   onRestart?: () => void,
 * }} props
 */
export default function StudySessionComplete({ stats, deckName, nextReviewLabel, onBack, onRestart }) {
  const accuracy = stats.total > 0
    ? Math.round(((stats.good + stats.easy) / stats.total) * 100)
    : 0;

  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] p-6 sm:p-8 text-center space-y-5 sm:space-y-6">
      <div className="flex items-center justify-center h-20 w-20 rounded-full bg-gradient-to-br from-yellow-400 to-orange-500 shadow-2xl shadow-yellow-500/30 animate-in zoom-in-90 duration-300">
        <Trophy size={36} className="text-white" />
      </div>

      <div>
        <h2 className="text-2xl font-black text-zinc-900 dark:text-white">Você concluiu suas revisões por agora!</h2>
        <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">{deckName}</p>
      </div>

      {nextReviewLabel && (
        <div className="inline-flex items-center gap-2 rounded-2xl bg-zinc-100 dark:bg-zinc-800 px-4 py-2.5 text-xs font-bold text-zinc-700 dark:text-zinc-300">
          <Clock size={15} className="text-red-600 dark:text-red-400" />
          <span>Próxima revisão: <strong className="text-zinc-950 dark:text-white">{nextReviewLabel}</strong></span>
        </div>
      )}

      <div className="grid grid-cols-2 gap-2.5 sm:gap-3 w-full max-w-xs">
        <StatBadge label="Total Respondidos" value={stats.total} className="col-span-2 bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200" />
        <StatBadge label="Errei" value={stats.again} className="bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300" />
        <StatBadge label="Difícil" value={stats.hard} className="bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300" />
        <StatBadge label="Bom" value={stats.good} className="bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300" />
        <StatBadge label="Fácil" value={stats.easy} className="bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300" />
      </div>

      <div className="flex items-center gap-2 text-sm font-semibold text-zinc-600 dark:text-zinc-400">
        <CheckCircle2 size={16} className="text-emerald-500" />
        Taxa de acerto: <span className="font-black text-emerald-600 dark:text-emerald-400">{accuracy}%</span>
      </div>

      <div className="flex gap-3 w-full max-w-xs">
        <button
          type="button"
          onClick={onBack}
          className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 font-bold px-4 py-3 text-sm transition-all hover:bg-zinc-800 dark:hover:bg-zinc-100 active:scale-95 shadow-md"
        >
          <ArrowLeft size={15} strokeWidth={2.5} />
          Voltar ao Deck
        </button>
        {onRestart && (
          <button
            type="button"
            onClick={onRestart}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 font-bold px-4 py-3 text-sm transition-all hover:bg-zinc-50 dark:hover:bg-zinc-700 active:scale-95"
            title="Revisar cards devidos novamente"
          >
            <RotateCcw size={15} strokeWidth={2.5} />
            Revisar
          </button>
        )}
      </div>
    </div>
  );
}

function StatBadge({ label, value, className }) {
  return (
    <div className={`rounded-xl px-3.5 py-2.5 sm:py-3 font-bold ${className}`}>
      <div className="text-xl sm:text-2xl font-black">{value}</div>
      <div className="text-[10px] sm:text-xs uppercase tracking-wider opacity-80">{label}</div>
    </div>
  );
}

