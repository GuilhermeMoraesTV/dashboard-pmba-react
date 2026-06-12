import React from 'react';
import { ArrowRight, Inbox, Loader2 } from 'lucide-react';

const VARIANT_STYLES = {
  default: {
    shell: 'border-zinc-200 bg-white/85 dark:border-zinc-800 dark:bg-zinc-950/55',
    icon: 'bg-zinc-100 text-zinc-500 dark:bg-zinc-900 dark:text-zinc-400',
    eyebrow: 'text-zinc-400',
    title: 'text-zinc-900 dark:text-white',
    cta: 'bg-zinc-950 text-white hover:bg-red-700 dark:bg-white dark:text-zinc-950 dark:hover:bg-red-500 dark:hover:text-white',
  },
  cta: {
    shell: 'border-red-200 bg-gradient-to-br from-white via-red-50/55 to-white dark:border-red-500/25 dark:from-zinc-950 dark:via-red-950/18 dark:to-zinc-950',
    icon: 'bg-red-600 text-white shadow-lg shadow-red-600/20',
    eyebrow: 'text-red-600 dark:text-red-300',
    title: 'text-zinc-950 dark:text-white',
    cta: 'bg-red-600 text-white hover:bg-red-700 shadow-lg shadow-red-600/20',
  },
  loading: {
    shell: 'border-red-100 bg-white/80 dark:border-red-500/20 dark:bg-zinc-950/55',
    icon: 'bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-300',
    eyebrow: 'text-red-500 dark:text-red-300',
    title: 'text-zinc-900 dark:text-white',
    cta: 'bg-red-600 text-white hover:bg-red-700',
  },
  compact: {
    shell: 'border-zinc-200 bg-white/80 dark:border-zinc-800 dark:bg-zinc-950/45',
    icon: 'bg-zinc-100 text-zinc-500 dark:bg-zinc-900 dark:text-zinc-400',
    eyebrow: 'text-zinc-400',
    title: 'text-zinc-900 dark:text-white',
    cta: 'bg-zinc-950 text-white hover:bg-red-700 dark:bg-white dark:text-zinc-950',
  },
};

export default function EmptyStateCard({
  icon: Icon = Inbox,
  title,
  description,
  actionLabel,
  onAction,
  variant = 'default',
  className = '',
  compact = false,
}) {
  const styles = VARIANT_STYLES[variant] || VARIANT_STYLES.default;
  const isLoading = variant === 'loading';
  const DisplayIcon = isLoading ? Loader2 : Icon;

  return (
    <div
      className={`relative flex h-full min-h-[180px] flex-col items-center justify-center overflow-hidden rounded-2xl border border-dashed p-5 text-center shadow-sm ${styles.shell} ${compact ? 'min-h-[132px] p-4' : ''} ${className}`}
    >
      <div className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-red-500/5 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-12 left-6 h-28 w-28 rounded-full bg-zinc-500/5 blur-3xl" />

      <div className={`relative flex ${compact ? 'h-11 w-11 rounded-xl' : 'h-14 w-14 rounded-2xl'} items-center justify-center ${styles.icon}`}>
        <DisplayIcon size={compact ? 21 : 27} strokeWidth={2.2} className={isLoading ? 'animate-spin' : ''} />
      </div>

      <p className={`relative mt-4 text-[9px] font-black uppercase tracking-[0.22em] ${styles.eyebrow}`}>
        Modo QAP
      </p>
      <h3 className={`relative mt-1 max-w-[320px] text-sm font-black leading-tight ${styles.title}`}>
        {title}
      </h3>
      {description && (
        <p className="relative mt-2 max-w-[360px] text-[11px] font-semibold leading-relaxed text-zinc-500 dark:text-zinc-400">
          {description}
        </p>
      )}

      {actionLabel && typeof onAction === 'function' && (
        <button
          type="button"
          onClick={onAction}
          className={`relative mt-5 inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-[10px] font-black uppercase tracking-[0.14em] transition-all active:scale-95 ${styles.cta}`}
        >
          {actionLabel}
          <ArrowRight size={13} strokeWidth={3} />
        </button>
      )}
    </div>
  );
}
