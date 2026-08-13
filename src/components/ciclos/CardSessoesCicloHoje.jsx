import React, { useMemo } from 'react';
import { Check, Play } from 'lucide-react';
import { getCycleFreeQueue } from '../../utils/studyDayStatus';
import { getDisciplineColorForSlot } from '../../utils/disciplineColors';

const NEUTRAL_COLOR = '#71717a';

const fmtMin = (value) => {
  const minutes = Math.max(0, Math.round(Number(value) || 0));
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours}h${String(rest).padStart(2, '0')}` : `${hours}h`;
};

function CardSessoesCicloHoje({
  ciclo,
  disciplinas = [],
  onIniciarSessao,
  onToggleSessao,
  loadingSessionId = null,
  loadingSessionIds = {},
  useDisciplineColors = true,
  registrosEstudo = [],
  fillAvailableHeight = false,
  sessionCompletionOverrides = {},
}) {
  const cicloComDisciplinas = useMemo(
    () => ({ ...(ciclo || {}), disciplinas }),
    [ciclo, disciplinas],
  );
  const queue = useMemo(
    () => getCycleFreeQueue(cicloComDisciplinas, registrosEstudo),
    [cicloComDisciplinas, registrosEstudo],
  );
  const disciplineMap = useMemo(
    () => new Map(disciplinas.map((disciplina) => [String(disciplina.id), disciplina])),
    [disciplinas],
  );

  return (
    <section className={`cycle-block-list-card-zoom ${fillAvailableHeight ? 'cycle-block-list-card-zoom--fill h-full max-h-none' : 'max-h-[430px] sm:max-h-[460px]'} box-border flex min-h-0 w-full max-w-full flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900`}>
      <div className="border-b border-zinc-100 px-3 py-2.5 dark:border-zinc-800 sm:px-4">
        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-red-600 dark:text-red-400">Fila do ciclo</p>
        <div className="mt-1 flex items-end justify-between gap-3">
          <h3 className="text-base font-black text-zinc-900 dark:text-white">Blocos do ciclo</h3>
          <span className="text-xs font-bold text-zinc-400">{queue.sessions.length} blocos</span>
        </div>
      </div>

      {queue.sessions.length === 0 ? (
        <div className="px-5 py-10 text-center text-sm font-semibold text-zinc-400">
          Nenhum bloco ativo neste ciclo.
        </div>
      ) : (
        <div className="min-h-0 min-w-0 flex-1 divide-y divide-zinc-100 overflow-x-hidden overflow-y-auto custom-scrollbar dark:divide-zinc-800">
          {queue.sessions.map((session, listIndex) => {
            const disciplina = disciplineMap.get(String(session.disciplinaId));
            const disciplinaAcao = disciplina || {
              id: session.disciplinaId,
              nome: session.disciplinaNome || 'Disciplina',
            };
            const plannedMinutes = Math.max(1, Number(session.tempoPlanejadoMinutos || session.tempoMinutos || ciclo?.tempoSessaoMinutos || 1));
            const completionOverride = session.globalIndex !== null
              ? sessionCompletionOverrides?.[session.globalIndex]
              : undefined;
            const completed = typeof completionOverride === 'boolean'
              ? completionOverride
              : Boolean(session.concluida);
            const progressMinutes = typeof completionOverride === 'boolean'
              ? (completionOverride ? plannedMinutes : 0)
              : completed
                ? Math.max(plannedMinutes, Number(session.progressoMinutos || 0))
                : Math.min(plannedMinutes, Math.max(0, Number(session.progressoMinutos || 0)));
            const progressPercent = Math.min(100, Math.round((progressMinutes / plannedMinutes) * 100));
            const hasSession = !session.filaSemSessao && session.globalIndex !== null;
            const loading = hasSession
              && (
                Boolean(loadingSessionIds?.[session.globalIndex])
                || (
                  loadingSessionId !== null
                  && loadingSessionId !== undefined
                  && Number(loadingSessionId) === Number(session.globalIndex)
                )
              );
            const color = useDisciplineColors !== false && ciclo?.coresDisciplinasAtivas !== false
              ? getDisciplineColorForSlot({
                disciplinaId: disciplina?.id || session.disciplinaId,
                disciplinaNome: disciplina?.nome,
                disciplina: disciplina?.nome,
                cor: disciplina?.cor || session.cor,
              })?.hex || NEUTRAL_COLOR
              : NEUTRAL_COLOR;
            const displayedSession = {
              ...session,
              concluida: completed,
              concluido: completed,
              progressoMinutos: progressMinutes,
            };

            return (
              <div
                key={`${session.disciplinaId}-${session.globalIndex ?? `sem-sessao-${listIndex}`}`}
                className="relative flex min-w-0 flex-col overflow-hidden border-l-[7px] px-3 py-2.5 sm:border-l-[5px] sm:px-4"
                style={{
                  borderLeftColor: color,
                  backgroundImage: `linear-gradient(90deg, ${color}20 0%, transparent 28%)`,
                }}
              >
                <span
                  aria-hidden="true"
                  className="absolute inset-y-0 left-0 w-2 sm:w-[5px]"
                  style={{ backgroundColor: color }}
                />
                <div className="flex min-w-0 flex-1 items-center gap-2.5">
                  <button
                    type="button"
                    onClick={() => onToggleSessao?.(displayedSession)}
                    disabled={!hasSession}
                    aria-busy={loading}
                    aria-label={completed ? 'Marcar bloco como pendente' : 'Marcar bloco como concluido'}
                    title={completed ? 'Marcar bloco como pendente' : 'Marcar bloco como concluido'}
                    className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border shadow-sm transition-all disabled:cursor-not-allowed disabled:opacity-60 ${completed
                      ? 'border-emerald-500 bg-emerald-500 text-white shadow-emerald-500/20'
                      : 'border-emerald-200 bg-white text-emerald-600 shadow-emerald-500/10 hover:border-emerald-300 hover:bg-emerald-50 dark:border-emerald-900/40 dark:bg-white/10 dark:text-emerald-300 dark:hover:bg-emerald-900/35'
                    }`}
                  >
                    <Check size={15} strokeWidth={3.5} />
                  </button>
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-[0.18em] text-zinc-400">
                      <span aria-hidden="true" className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: color }} />
                      Bloco {hasSession ? Number(session.globalIndex) + 1 : listIndex + 1}
                    </p>
                    <p className="min-w-0 break-words text-sm font-black leading-snug text-zinc-900 dark:text-white">
                      {disciplina?.nome || session.disciplinaNome || 'Disciplina'}
                    </p>
                    <div className="mt-1.5 grid min-w-0 max-w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-2.5">
                      <div className="min-w-0">
                        <div className="h-1.5 min-w-0 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
                          <div
                            className={`h-full rounded-full transition-all ${completed ? 'bg-emerald-500' : 'bg-amber-500'}`}
                            style={{ width: `${progressPercent}%` }}
                          />
                        </div>
                        <span className="min-w-0 truncate text-[11px] font-black tabular-nums text-zinc-500 dark:text-zinc-300 sm:text-xs">
                          {fmtMin(progressMinutes)} / {fmtMin(plannedMinutes)}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => onIniciarSessao?.(disciplinaAcao, session.globalIndex, displayedSession)}
                        disabled={!hasSession}
                        className="inline-flex h-8 shrink-0 items-center justify-center gap-1.5 rounded-lg bg-red-600 px-2.5 text-[9px] font-black uppercase tracking-wide text-white transition-colors hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <Play size={13} fill="currentColor" /> Iniciar
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

export default CardSessoesCicloHoje;
