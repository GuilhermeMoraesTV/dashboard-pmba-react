import React, { useMemo } from 'react';
import { getDisciplineCardVars } from '../../utils/disciplineColors';
import { groupConsolidatedReviewTopics } from '../../utils/consolidatedReviews';

const ConsolidatedReviewGroups = ({
  topics = [],
  colorMap = null,
  className = '',
  renderLeading = null,
  renderTrailing = null,
  renderBelow = null,
}) => {
  const groups = useMemo(() => groupConsolidatedReviewTopics(topics, colorMap), [topics, colorMap]);

  return (
    <div className={`grid gap-3 lg:grid-cols-2 ${className}`}>
      {groups.map((group) => (
        <section
          key={group.key}
          style={getDisciplineCardVars(group.color)}
          className="discipline-tinted-card min-w-0 overflow-hidden rounded-2xl border shadow-sm"
        >
          <div className="flex items-center justify-between gap-3 border-b border-black/5 px-3 py-2.5 dark:border-white/10 sm:px-3.5 sm:py-3">
            <div className="flex min-w-0 items-center gap-2.5">
              <span className={`h-3 w-3 shrink-0 rounded-full shadow-sm ${group.color.bg}`} />
              <div className="min-w-0">
                <h4 className={`truncate text-[11px] font-black uppercase tracking-wide ${group.color.text} dark:text-white`}>
                  {group.name}
                </h4>
                <p className="mt-0.5 text-[9px] font-bold text-zinc-500 dark:text-zinc-400">
                  {group.topics.length} {group.topics.length === 1 ? 'assunto' : 'assuntos'}
                </p>
              </div>
            </div>
            <span className={`shrink-0 rounded-lg border px-2 py-1 text-[9px] font-black ${group.color.soft}`}>
              {group.minutes} min
            </span>
          </div>

          <ul className="space-y-1.5 p-2.5">
            {group.topics.map((topic, index) => (
              <li
                key={`${topic?.slotId || topic?.slotIdBase || group.key}-${index}`}
                className="min-w-0 rounded-xl border border-white/70 bg-white/80 px-2.5 py-2.5 dark:border-white/5 dark:bg-zinc-900/65"
              >
                <div className="flex min-w-0 items-start gap-2.5">
                  {renderLeading ? renderLeading({ topic, index, group }) : (
                    <span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[9px] font-black text-white ${group.color.bg}`}>
                      {index + 1}
                    </span>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex min-w-0 items-start justify-between gap-2">
                      <p className="line-clamp-2 text-[11px] font-semibold leading-snug text-zinc-700 dark:text-zinc-200">
                        {topic?.assunto || 'Revisão agendada'}
                      </p>
                      {renderTrailing ? renderTrailing({ topic, index, group }) : (
                        <span className={`shrink-0 rounded-md px-1.5 py-0.5 text-[9px] font-black tabular-nums ${group.color.soft}`}>
                          {Number(topic?.tempoMinutos ?? topic?.tempoPlanejadoMinutos ?? 5)} min
                        </span>
                      )}
                    </div>
                    {topic?.reagendadaPorFila && (
                      <span className="mt-1 inline-flex rounded-full bg-amber-100 px-1.5 py-0.5 text-[8px] font-black uppercase tracking-wide text-amber-700 dark:bg-amber-500/15 dark:text-amber-300">
                        Pendente priorizada
                      </span>
                    )}
                    {renderBelow?.({ topic, index, group })}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
};

export default ConsolidatedReviewGroups;
