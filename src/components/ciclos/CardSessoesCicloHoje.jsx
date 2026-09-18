import React, { useState, useMemo } from 'react';
import { Check, Clock3, Play } from 'lucide-react';
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

function CardSessoesCicloSubjects({ session }) {
  const [expandido, setExpandido] = useState(false);
  const assuntos = session.assuntosEstudados || [];
  const temEstudos = assuntos.length > 0;

  if (!temEstudos) {
    return (
      <p className="truncate text-[11px] font-medium text-zinc-400 dark:text-zinc-500">
        Escolha o assunto ao finalizar
      </p>
    );
  }

  if (assuntos.length === 1) {
    const item = assuntos[0];
    return (
      <div className="flex items-center gap-1.5 text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 truncate">
        <span className="font-black text-emerald-600 dark:text-emerald-400 shrink-0">✓</span>
        <span className="truncate">{item.assunto}</span>
        <span className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 shrink-0 tabular-nums">({fmtMin(item.minutos)})</span>
      </div>
    );
  }

  return (
    <div className="text-[11px]">
      {!expandido ? (
        <div className="flex items-center justify-between gap-1">
          <div className="flex items-center gap-1 min-w-0 truncate">
            <span className="font-black text-emerald-600 dark:text-emerald-400 shrink-0">✓</span>
            <span className="font-bold text-emerald-700 dark:text-emerald-400 shrink-0">
              {assuntos.length} assuntos
            </span>
            <span className="text-zinc-400 dark:text-zinc-500 shrink-0">·</span>
            <span className="truncate font-medium text-zinc-600 dark:text-zinc-300">
              {assuntos.map((a) => a.assunto).join(' · ')}
            </span>
          </div>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setExpandido(true);
            }}
            className="text-[10px] font-bold text-blue-600 dark:text-blue-400 hover:underline shrink-0 ml-1"
          >
            Ver lista
          </button>
        </div>
      ) : (
        <div className="space-y-1">
          <div className="flex items-center justify-between text-[10px] font-black uppercase text-emerald-700 dark:text-emerald-400">
            <span>{assuntos.length} assuntos estudados</span>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setExpandido(false);
              }}
              className="text-blue-600 dark:text-blue-400 lowercase font-bold hover:underline"
            >
              recolher
            </button>
          </div>
          <div className="space-y-0.5 max-h-32 overflow-y-auto custom-scrollbar pr-1">
            {assuntos.map((item, idx) => (
              <div key={idx} className="flex items-center justify-between gap-1 text-[11px] font-medium text-zinc-700 dark:text-zinc-200">
                <span className="truncate">✓ {item.assunto}</span>
                <span className="text-[10px] font-bold text-zinc-400 shrink-0 tabular-nums">{fmtMin(item.minutos)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function CardSessoesCicloHoje({
  ciclo,
  disciplinas = [],
  onIniciarSessao,
  useDisciplineColors = true,
  registrosEstudo = [],
  fillAvailableHeight = false,
  hideHeader = false,
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
    <section className={`cycle-block-list-card-zoom ${fillAvailableHeight || hideHeader ? 'cycle-block-list-card-zoom--fill h-full max-h-[min(62dvh,560px)] sm:max-h-[min(68dvh,620px)] xl:max-h-none' : 'max-h-[430px] sm:max-h-[460px]'} box-border flex min-h-0 w-full max-w-full flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900`}>
      {!hideHeader && (
        <div className="border-b border-zinc-100 px-3 py-2 dark:border-zinc-800 sm:px-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-red-600 dark:text-red-400">Fila do ciclo</p>
              <h3 className="text-sm sm:text-base font-black text-zinc-900 dark:text-white">Blocos do ciclo</h3>
            </div>
            <span className="text-xs font-bold text-zinc-400">{queue.sessions.length} blocos</span>
          </div>
        </div>
      )}

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
            const completedByRecordedStudy = Boolean(session.bloqueiaDesmarcarConclusao);
            const completed = Boolean(session.concluida) || completedByRecordedStudy;
            const progressMinutes = Math.max(
              0,
              Number(session.progressoMinutos || 0),
              Number(session.progressoRegistroRealMinutos || 0),
            );
            const progressPercent = Math.min(100, Math.round((progressMinutes / plannedMinutes) * 100));
            const completedByStudy = progressMinutes >= plannedMinutes || completedByRecordedStudy;
            const hasSession = !session.filaSemSessao && session.globalIndex !== null;
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
              roundVersion: Number(ciclo?.conclusoes || 0),
              concluida: completed,
              concluido: completed,
              progressoMinutos: progressMinutes,
            };

            return (
              <div
                key={`${session.disciplinaId}-${session.globalIndex ?? `sem-sessao-${listIndex}`}`}
                className="relative flex min-w-0 flex-col overflow-hidden border-l-4 px-3 py-2 sm:px-3.5 sm:py-2.5"
                style={{
                  borderLeftColor: color,
                  backgroundImage: `linear-gradient(90deg, ${color}14 0%, transparent 24%)`,
                }}
              >
                <div className="flex items-center justify-between gap-2 min-w-0">
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <span
                      aria-label={completedByStudy ? 'Bloco concluído pelo tempo registrado' : 'Bloco pendente de estudo'}
                      title={completedByStudy ? 'Bloco concluído pelo tempo registrado' : 'Conclua pelo cronômetro ou por um registro manual de estudo'}
                      className={`inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border text-xs shadow-xs ${completed
                        ? 'border-emerald-500 bg-emerald-500 text-white'
                        : 'border-zinc-200 bg-white text-zinc-400 dark:border-zinc-700 dark:bg-white/10 dark:text-zinc-400'
                      }`}
                    >
                      {completed ? <Check size={13} strokeWidth={3.5} /> : <Clock3 size={13} strokeWidth={2.5} />}
                    </span>
                    <span className="truncate text-xs sm:text-sm font-black text-zinc-900 dark:text-white">
                      {disciplina?.nome || session.disciplinaNome || 'Disciplina'}
                    </span>
                    <span className="shrink-0 rounded px-1.5 py-0.5 text-[9px] font-bold tracking-tight text-zinc-400 dark:text-zinc-500 bg-zinc-100/90 dark:bg-zinc-800/70 border border-zinc-200/60 dark:border-zinc-700/50">
                      Bloco {hasSession ? Number(session.globalIndex) + 1 : listIndex + 1}
                    </span>
                  </div>
                  <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-zinc-200/80 bg-zinc-100/80 dark:border-zinc-700/80 dark:bg-zinc-800/80 px-2 py-0.5 text-[10px] font-black tabular-nums text-zinc-600 dark:text-zinc-300">
                    {progressMinutes > 0 ? `${fmtMin(progressMinutes)} / ${fmtMin(plannedMinutes)}` : fmtMin(plannedMinutes)}
                  </span>
                </div>

                <div className="mt-1 min-w-0">
                  <CardSessoesCicloSubjects session={session} />
                </div>

                <div className="mt-1.5 flex items-center justify-between gap-2.5">
                  <div className="min-w-0 flex-1 flex items-center gap-2">
                    <div className="h-1.5 flex-1 min-w-0 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
                      <div
                        className={`h-full rounded-full transition-all ${completed ? 'bg-emerald-500' : 'bg-amber-500'}`}
                        style={{ width: `${progressPercent}%` }}
                      />
                    </div>
                    <span className="shrink-0 text-[10px] font-bold tabular-nums text-zinc-400 dark:text-zinc-500">
                      {progressPercent}%
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => onIniciarSessao?.(disciplinaAcao, session.globalIndex, displayedSession)}
                    disabled={!hasSession}
                    className="inline-flex h-6 sm:h-7 shrink-0 items-center justify-center gap-1 rounded-md bg-red-600 px-2.5 text-[9px] font-black uppercase tracking-wide text-white transition-colors hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Play size={11} fill="currentColor" /> Iniciar
                  </button>
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
