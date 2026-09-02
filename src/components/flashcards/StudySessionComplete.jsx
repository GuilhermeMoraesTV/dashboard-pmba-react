import React from 'react';
import { Trophy, RotateCcw, ArrowLeft, CheckCircle2 } from 'lucide-react';

/**
 * Tela de conclusao da sessao de estudo com estatisticas.
 * @param {{
 *   stats: { again: number, hard: number, good: number, easy: number, total: number },
 *   deckName: string,
 *   onBack: () => void,
 *   onRestart?: () => void,
 * }} props
 */
export default function StudySessionComplete({ stats, deckName, onBack, onRestart }) {
  const accuracy = stats.total > 0
    ? Math.round(((stats.good + stats.easy) / stats.total) * 100)
    : 0;

  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] p-8 text-center space-y-6">
      <div className="flex items-center justify-center h-20 w-20 rounded-full bg-gradient-to-br from-yellow-400 to-orange-500 shadow-2xl shadow-yellow-500/30">
        <Trophy size={36} className="text-white" />
      </div>

      <div>
        <h2 className="text-2xl font-black text-zinc-900 dark:text-white">Sessao Concluida!</h2>
        <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">{deckName}</p>
      </div>

      <div className="grid grid-cols-2 gap-3 w-full max-w-xs">
        <StatBadge label="Total" value={stats.total} className="col-span-2 bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200" />
        <StatBadge label="Errei" value={stats.again} className="bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300" />
        <StatBadge label="Dificil" value={stats.hard} className="bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300" />
        <StatBadge label="Bom" value={stats.good} className="bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300" />
        <StatBadge label="Facil" value={stats.easy} className="bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300" />
      </div>

      <div className="flex items-center gap-2 text-sm font-semibold text-zinc-600 dark:text-zinc-400">
        <CheckCircle2 size={16} className="text-emerald-500" />
        Taxa de acerto: <span className="font-black text-emerald-600 dark:text-emerald-400">{accuracy}%</span>
      </div>

      <div className="flex gap-3 w-full max-w-xs">
        <button
          type="button"
          onClick={onBack}
          className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 font-bold px-4 py-3 text-sm transition-all hover:bg-zinc-50 dark:hover:bg-zinc-700 active:scale-95"
        >
          <ArrowLeft size={15} strokeWidth={2.5} />
          Voltar
        </button>
        {onRestart && (
          <button
            type="button"
            onClick={onRestart}
            className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-red-600 text-white font-bold px-4 py-3 text-sm transition-all hover:bg-red-700 active:scale-95 shadow-lg shadow-red-600/20"
          >
            <RotateCcw size={15} strokeWidth={2.5} />
            Reiniciar
          </button>
        )}
      </div>
    </div>
  );
}

function StatBadge({ label, value, className }) {
  return (
    <div className={`rounded-xl px-4 py-3 font-bold ${className}`}>
      <div className="text-2xl font-black">{value}</div>
      <div className="text-xs uppercase tracking-wider opacity-80">{label}</div>
    </div>
  );
}
