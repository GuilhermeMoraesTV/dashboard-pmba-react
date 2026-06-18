import React from 'react';
import { ArrowRight } from 'lucide-react';

export default function HomeEmptyState({
  icon: Icon,
  title,
  description,
  actionLabel,
  onAction,
  className = '',
  iconTone = 'bg-red-50 text-red-600 ring-1 ring-inset ring-red-100 dark:bg-red-500/10 dark:text-red-300 dark:ring-red-400/10',
}) {
  return (
    <div className={`relative flex min-h-[160px] w-full flex-col items-center justify-center rounded-2xl border border-dashed border-zinc-300/75 bg-zinc-50/45 px-5 py-7 text-center transition-colors duration-300 dark:border-white/10 dark:bg-white/[0.025] ${className}`}>
      {Icon && (
        <div className={`mb-4 flex h-11 w-11 items-center justify-center rounded-xl ${iconTone}`}>
          <Icon size={21} strokeWidth={2} />
        </div>
      )}
      <h4 className="max-w-xs text-sm font-black leading-tight text-zinc-900 dark:text-white">
        {title}
      </h4>
      {description && (
        <p className="mt-2 max-w-sm text-[11px] font-medium leading-relaxed text-zinc-500 dark:text-zinc-400">
          {description}
        </p>
      )}
      {actionLabel && typeof onAction === 'function' && (
        <button
          type="button"
          onClick={onAction}
          className="mt-5 inline-flex items-center justify-center gap-2 rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-[10px] font-black uppercase tracking-[0.14em] text-zinc-800 shadow-sm transition-colors hover:border-red-200 hover:text-red-600 active:scale-95 dark:border-white/10 dark:bg-white/5 dark:text-zinc-200 dark:hover:border-red-400/25 dark:hover:text-red-300"
        >
          {actionLabel}
          <ArrowRight size={13} strokeWidth={3} />
        </button>
      )}
    </div>
  );
}
