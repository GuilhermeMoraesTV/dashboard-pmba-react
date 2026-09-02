import React from 'react';
import { RotateCcw, ChevronDown, Star, Zap } from 'lucide-react';

/**
 * Formata o intervalo em dias para texto legivel.
 * @param {number | undefined} days
 * @returns {string}
 */
function formatInterval(days, minutes) {
  if (Number.isFinite(minutes) && minutes < 24 * 60) {
    if (minutes <= 1) return '<1 min';
    return `${Math.round(minutes)} min`;
  }
  if (!days || days < 1) return '<1 dia';
  if (days === 1) return '1d';
  if (days < 30) return `${days}d`;
  const months = Math.round(days / 30);
  return `${months}m`;
}

const RATING_CONFIG = {
  again: {
    label: 'Errei',
    icon: RotateCcw,
    className: 'bg-red-600 hover:bg-red-700 text-white border-red-700',
    badgeClass: 'bg-red-800/60',
  },
  hard: {
    label: 'Difícil',
    icon: ChevronDown,
    className: 'bg-orange-500 hover:bg-orange-600 text-white border-orange-600',
    badgeClass: 'bg-orange-700/60',
  },
  good: {
    label: 'Bom',
    icon: Star,
    className: 'bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-700',
    badgeClass: 'bg-emerald-800/60',
  },
  easy: {
    label: 'Fácil',
    icon: Zap,
    className: 'bg-blue-600 hover:bg-blue-700 text-white border-blue-700',
    badgeClass: 'bg-blue-800/60',
  },
};

/**
 * Botoes de avaliacao da sessao de estudo com preview de intervalo.
 *
 * Os intervalos previstos vem do scheduler — nao sao hardcoded na UI.
 *
 * @param {{
 *   preview: import('../../contracts/flashcards.js').SchedulerPreview | null,
 *   onRate: (rating: string) => void,
 *   disabled?: boolean,
 * }} props
 */
export default function ReviewControls({ preview, onRate, disabled = false }) {
  return (
    <div className="flex items-stretch justify-center gap-2 w-full max-w-lg mx-auto">
      {['again', 'hard', 'good', 'easy'].map((rating) => {
        const cfg = RATING_CONFIG[rating];
        const Icon = cfg.icon;
        const intervalDays = preview?.[rating]?.intervalDays;
        const intervalMinutes = preview?.[rating]?.intervalMinutes;

        return (
          <button
            key={rating}
            type="button"
            disabled={disabled}
            onClick={() => onRate(rating)}
            className={`
              flex flex-1 flex-col items-center justify-center gap-1.5 rounded-xl border
              px-2 py-3 font-bold transition-all active:scale-95
              disabled:opacity-50 disabled:cursor-not-allowed
              ${cfg.className}
            `}
          >
            <Icon size={18} strokeWidth={2.5} />
            <span className="text-[11px] font-black uppercase tracking-wider">{cfg.label}</span>
            {(intervalDays !== undefined || intervalMinutes !== undefined) ? (
              <span className={`text-[10px] font-semibold rounded-full px-2 py-0.5 ${cfg.badgeClass}`}>
                {formatInterval(intervalDays, intervalMinutes)}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
