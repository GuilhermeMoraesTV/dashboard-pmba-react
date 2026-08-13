import React from 'react';
import { createPortal } from 'react-dom';
import { Loader2, Undo2 } from 'lucide-react';

const formatDate = (value) => {
  if (!value) return '';
  let date = null;
  if (typeof value?.toDate === 'function') date = value.toDate();
  else if (Number.isFinite(value?.seconds)) date = new Date(value.seconds * 1000);
  else if (value instanceof Date) date = value;
  else if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month, day] = value.split('-').map(Number);
    date = new Date(year, month - 1, day, 12);
  } else date = new Date(value);

  if (!date || Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
};

export default function CronogramaPostponeUndo({ postponement, loading = false, onUndo }) {
  if (!postponement || typeof document === 'undefined') return null;

  const previousStart = postponement.previousDates?.dataInicio;
  const days = Number(postponement.days) || 7;

  return createPortal(
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-5 left-1/2 z-[400] flex w-[calc(100vw-24px)] max-w-md -translate-x-1/2 animate-fade-in items-center justify-between gap-3 rounded-2xl border border-amber-200 bg-white px-4 py-3 text-zinc-900 shadow-2xl shadow-amber-900/10 dark:border-amber-900/40 dark:bg-card-dark dark:text-white"
    >
      <div className="min-w-0">
        <p className="text-[10px] font-black uppercase tracking-widest text-amber-600 dark:text-amber-400">
          Cronograma adiado em {days} {days === 1 ? 'dia' : 'dias'}
        </p>
        <p className="mt-0.5 truncate text-xs font-semibold text-zinc-500 dark:text-zinc-400">
          {previousStart ? `Voltar para ${formatDate(previousStart)}` : 'Restaurar datas anteriores'}
        </p>
      </div>
      <button
        type="button"
        onClick={onUndo}
        disabled={loading}
        className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-amber-600 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-white shadow-sm transition-colors hover:bg-amber-700 disabled:cursor-wait disabled:opacity-60"
      >
        {loading ? <Loader2 size={13} className="animate-spin" /> : <Undo2 size={13} />}
        Desfazer
      </button>
    </div>,
    document.body
  );
}
