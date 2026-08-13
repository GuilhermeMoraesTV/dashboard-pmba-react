import React from 'react';
import { normalizePostponeDays } from '../../utils/cronogramaPostponement';

const QUICK_OPTIONS = [1, 7, 15, 30];

export default function PostponeDaysField({ value, onChange, disabled = false }) {
  const normalized = normalizePostponeDays(value);

  return (
    <div className="mb-6 text-left">
      <label htmlFor="postpone-days" className="mb-2 block text-[10px] font-black uppercase tracking-widest text-zinc-500 dark:text-zinc-400">
        Quantos dias deseja adiar?
      </label>
      <div className="flex items-stretch gap-2">
        <input
          id="postpone-days"
          type="number"
          inputMode="numeric"
          min="1"
          max="365"
          step="1"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          disabled={disabled}
          className="min-w-0 flex-1 rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-sm font-black text-zinc-900 outline-none transition focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
          aria-describedby="postpone-days-help"
        />
        <span className="flex items-center rounded-xl border border-zinc-200 bg-zinc-50 px-3 text-xs font-bold text-zinc-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
          {normalized === 1 ? 'dia' : 'dias'}
        </span>
      </div>
      <div className="mt-2 grid grid-cols-4 gap-1.5">
        {QUICK_OPTIONS.map((days) => (
          <button
            key={days}
            type="button"
            onClick={() => onChange(String(days))}
            disabled={disabled}
            className={`rounded-lg border px-2 py-1.5 text-[10px] font-black transition ${normalized === days
              ? 'border-amber-500 bg-amber-500/10 text-amber-700 dark:text-amber-400'
              : 'border-zinc-200 text-zinc-500 hover:border-amber-300 hover:text-amber-700 dark:border-zinc-700 dark:text-zinc-400 dark:hover:border-amber-700 dark:hover:text-amber-400'
            }`}
          >
            {days}d
          </button>
        ))}
      </div>
      <p id="postpone-days-help" className="mt-2 text-[10px] font-medium text-zinc-400">
        Escolha entre 1 e 365 dias. O progresso será preservado.
      </p>
    </div>
  );
}
