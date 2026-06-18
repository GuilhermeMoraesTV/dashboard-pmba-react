import React from 'react';
import { ArrowRight, Inbox, Loader2 } from 'lucide-react';

const VARIANT_STYLES = {
  default: {
    shell: 'border-zinc-200/80 bg-white/92 shadow-[0_24px_80px_rgba(15,23,42,0.08)] dark:border-white/10 dark:bg-zinc-950/82 dark:shadow-[0_24px_80px_rgba(0,0,0,0.28)]',
    icon: 'bg-gradient-to-br from-red-600 to-rose-700 text-white shadow-2xl shadow-red-500/25',
    eyebrow: 'text-red-600 dark:text-red-300',
    title: 'text-zinc-900 dark:text-white',
    cta: 'bg-zinc-950 text-white hover:bg-red-600 shadow-xl shadow-zinc-950/10 dark:bg-white dark:text-zinc-950 dark:hover:bg-red-500 dark:hover:text-white',
  },
  cta: {
    shell: 'border-red-200/90 bg-gradient-to-br from-white via-red-50/65 to-white shadow-[0_28px_90px_rgba(239,68,68,0.12)] dark:border-red-500/25 dark:from-zinc-950 dark:via-red-950/20 dark:to-zinc-950',
    icon: 'bg-gradient-to-br from-red-600 to-rose-700 text-white shadow-2xl shadow-red-500/30',
    eyebrow: 'text-red-600 dark:text-red-300',
    title: 'text-zinc-950 dark:text-white',
    cta: 'bg-red-600 text-white hover:bg-red-700 shadow-xl shadow-red-600/24',
  },
  loading: {
    shell: 'border-red-100 bg-white/90 shadow-[0_24px_80px_rgba(239,68,68,0.10)] dark:border-red-500/20 dark:bg-zinc-950/82',
    icon: 'bg-gradient-to-br from-red-600 to-rose-700 text-white shadow-2xl shadow-red-500/25',
    eyebrow: 'text-red-500 dark:text-red-300',
    title: 'text-zinc-900 dark:text-white',
    cta: 'bg-red-600 text-white hover:bg-red-700',
  },
  compact: {
    shell: 'border-red-100/80 bg-white/86 shadow-[0_14px_45px_rgba(15,23,42,0.06)] dark:border-red-500/15 dark:bg-zinc-950/65',
    icon: 'bg-gradient-to-br from-red-600 to-rose-700 text-white shadow-lg shadow-red-500/20',
    eyebrow: 'text-red-500 dark:text-red-300',
    title: 'text-zinc-900 dark:text-white',
    cta: 'bg-zinc-950 text-white hover:bg-red-600 dark:bg-white dark:text-zinc-950',
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
      className={`group relative flex h-full min-h-[180px] flex-col items-center justify-center overflow-hidden rounded-[28px] border border-l-4 !border-l-red-500/40 p-5 text-center transition-all duration-300 ${styles.shell} ${compact ? 'min-h-[132px] rounded-2xl p-4' : ''} ${className}`}
    >
      <div className="pointer-events-none absolute -right-14 -top-14 h-44 w-44 rounded-full bg-red-500/10 blur-[70px] transition-all duration-500 group-hover:bg-red-500/15" />
      <div className="pointer-events-none absolute -bottom-16 left-6 h-36 w-36 rounded-full bg-zinc-500/8 blur-[64px]" />
      <div className="pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-red-400/30 to-transparent" />

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
