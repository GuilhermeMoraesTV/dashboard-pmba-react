import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  AlertTriangle,
  BookOpen,
  Check,
  CheckCircle2,
  Circle,
  Clock3,
  Coffee,
  Loader2,
  Play,
  RotateCw,
  Trophy,
  Zap,
} from 'lucide-react';
import { getCycleDailyGuide } from '../../utils/studyDayStatus';
import { getDisciplineCardVars, getDisciplineColorForSlot } from '../../utils/disciplineColors';

const fmtMin = (min) => {
  if (!min || min <= 0) return '0m';
  if (min < 60) return `${min}m`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m > 0 ? `${h}h${String(m).padStart(2, '0')}` : `${h}h`;
};

function CardSessoesCicloHoje({
  ciclo,
  disciplinas,
  onIniciarSessao,
  onToggleSessao,
  onMarcarTeoriaPendente,
  loadingSessionId = null,
  variant = 'home',
  showAssuntos: showAssuntosProp,
}) {
  const cicloComDisciplinas = useMemo(() => ({ ...(ciclo || {}), disciplinas }), [ciclo, disciplinas]);
  const showAssuntos = typeof showAssuntosProp === 'boolean'
    ? showAssuntosProp
    : ciclo?.modoExibirAssuntos !== false;

  const guiaHoje = useMemo(() => getCycleDailyGuide(cicloComDisciplinas), [cicloComDisciplinas]);
  const {
    sessions: sessoesDoDiaHoje,
    isRestDay: isRestDayToday,
    plannedMinutes,
    remainingMinutes,
  } = guiaHoje;

  const tempoSessaoMinutos = Math.max(1, Number(ciclo?.tempoSessaoMinutos || 50));
  const totalPlanejadoHoje = Math.max(
    Number(plannedMinutes || 0),
    sessoesDoDiaHoje.length * tempoSessaoMinutos
  );
  const totalProgressoHoje = sessoesDoDiaHoje.reduce((acc, sessao) => {
    const progressoSessao = sessao.concluida
      ? tempoSessaoMinutos
      : Math.min(Number(sessao.progressoMinutos || 0), tempoSessaoMinutos);
    return acc + progressoSessao;
  }, 0);
  const progressoHoje = totalPlanejadoHoje > 0 ? (totalProgressoHoje / totalPlanejadoHoje) * 100 : 0;
  const progressoHojeLimitado = Math.min(Math.round(progressoHoje), 100);

  const isCycleVariant = variant === 'cycle';
  const activeSessaoIndex = sessoesDoDiaHoje.findIndex((s) => !s.concluida);
  const allSessionsDone = !isRestDayToday
    && sessoesDoDiaHoje.length > 0
    && sessoesDoDiaHoje.every((sessao) => sessao.concluida);

  if (!isCycleVariant) {
    return (
      <div className="space-y-3">
        {!isRestDayToday && totalPlanejadoHoje > 0 && (
          <div className="relative overflow-hidden rounded-2xl border border-red-500/15 bg-gradient-to-br from-red-50 via-white to-zinc-50 p-3 shadow-sm dark:border-red-500/20 dark:from-red-950/20 dark:via-zinc-950/40 dark:to-zinc-900/40">
            <div className="pointer-events-none absolute -right-8 -top-10 h-24 w-24 rounded-full bg-red-500/10 blur-2xl" />
            <div className="relative flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[8px] font-black uppercase tracking-[0.22em] text-red-600 dark:text-red-400">Meta de hoje</p>
                <p className="mt-1 text-lg font-black tabular-nums text-zinc-950 dark:text-white">
                  {fmtMin(totalProgressoHoje)}
                  <span className="mx-1 text-xs text-zinc-400">/</span>
                  {fmtMin(totalPlanejadoHoje)}
                </p>
              </div>
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-red-500/15 bg-white text-[11px] font-black text-red-600 shadow-sm dark:bg-zinc-900 dark:text-red-400">
                {progressoHojeLimitado}%
              </div>
            </div>
            <div className="relative mt-3 h-1.5 overflow-hidden rounded-full bg-zinc-200/80 dark:bg-zinc-800">
              <motion.div
                initial={false}
                animate={{ width: `${Math.min(progressoHoje, 100)}%` }}
                transition={{ duration: 0.35 }}
                className="h-full rounded-full bg-gradient-to-r from-red-600 via-rose-500 to-orange-500"
              />
            </div>
          </div>
        )}
        {isRestDayToday ? (
          <div className="flex flex-col items-center justify-center p-8 rounded-3xl border-2 border-dashed border-emerald-100 dark:border-emerald-900/30 bg-emerald-50/20">
            <Coffee size={32} className="text-emerald-500 mb-2" />
            <p className="text-[11px] font-black uppercase tracking-widest text-emerald-600">Dia de Descanso</p>
            <p className="text-[9px] text-emerald-500/70 text-center mt-1">Recarregue as energias!</p>
          </div>
        ) : (
          sessoesDoDiaHoje.map((s, idx) => {
            const disc = disciplinas.find((d) => d.id === s.disciplinaId);
            const isCompleted = s.concluida;
            const isActive = idx === activeSessaoIndex;
            const disciplinaColor = getDisciplineColorForSlot({
              disciplinaId: disc?.id || s.disciplinaId,
              disciplinaNome: disc?.nome || s.disciplinaNome,
              disciplina: disc?.nome || s.disciplina,
              cor: disc?.cor || s.cor,
            });
            const disciplinaStyle = getDisciplineCardVars(disciplinaColor);

            return (
              <motion.div
                key={s.globalIndex}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                whileHover={{ x: 4 }}
                style={disciplinaStyle}
                className={`group relative flex items-center gap-4 p-4 rounded-2xl border transition-all duration-300 ${
                  isCompleted
                    ? 'bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-200/60 dark:border-emerald-900/40'
                  : isActive
                    ? 'bg-white dark:bg-zinc-900 border-[rgba(var(--discipline-rgb),0.32)] shadow-lg shadow-[rgba(var(--discipline-rgb),0.12)]'
                    : 'bg-zinc-50/50 dark:bg-zinc-950/30 border-[rgba(var(--discipline-rgb),0.18)] opacity-90'
                }`}
              >
                {!isCompleted && (
                  <div className="pointer-events-none absolute inset-y-0 left-0 w-1.5 bg-[rgb(var(--discipline-rgb))]" />
                )}
                {!isCompleted && (
                  <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_10%_0%,rgba(var(--discipline-rgb),0.13),transparent_34%)] opacity-90" />
                )}
                {/* Indicador de Status */}
                <div className={`relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full shadow-sm transition-all duration-500 ${
                  isCompleted 
                    ? 'bg-emerald-500 text-white' 
                    : isActive 
                    ? 'bg-[rgb(var(--discipline-rgb))] text-white shadow-[0_12px_24px_rgba(var(--discipline-rgb),0.22)]' 
                    : 'bg-white dark:bg-zinc-800 text-zinc-400 border border-zinc-200 dark:border-zinc-700'
                }`}>
                  {isCompleted ? <Check size={18} strokeWidth={4} /> : isActive ? <Play size={16} fill="currentColor" /> : <span className="text-xs font-black">{idx + 1}</span>}
                </div>

                <div className="relative z-10 flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <h4 className={`text-[12px] font-black uppercase tracking-tight truncate ${
                      isCompleted ? 'text-emerald-700 dark:text-emerald-400 line-through opacity-70' : disciplinaColor.text
                    }`}>
                      {disc?.nome || 'Disciplina'}
                    </h4>
                    {isActive && (
                      <span className="flex h-1.5 w-1.5 rounded-full bg-[rgb(var(--discipline-rgb))] animate-pulse" />
                    )}
                  </div>
                  
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-[10px] font-bold text-zinc-400 truncate uppercase tracking-tighter">
                      Sessao {s.sessaoIndex + 1}
                    </p>
                    <span className="inline-flex items-center gap-1 rounded-full border border-[rgba(var(--discipline-rgb),0.18)] bg-[rgba(var(--discipline-rgb),0.08)] px-2 py-0.5 text-[9px] font-black tabular-nums text-zinc-600 dark:text-zinc-200">
                      <Clock3 size={10} />
                      {fmtMin(ciclo?.tempoSessaoMinutos || 50)}
                    </span>
                  </div>

                  {isActive && s.assuntoSugerido?.nome && (
                    <p className="mt-1 truncate rounded-md bg-[rgba(var(--discipline-rgb),0.1)] px-2 py-1 text-[9px] font-black uppercase tracking-wide text-[rgb(var(--discipline-rgb))]">
                      Foco: {s.assuntoSugerido.nome}
                    </p>
                  )}
                </div>

                <div className="relative z-10 flex items-center gap-2">
                  {!isCompleted && (
                    <motion.button
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.9 }}
                      onClick={() => onIniciarSessao?.(disc, s.globalIndex, s)}
                      className="w-9 h-9 rounded-xl flex items-center justify-center bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 hover:bg-[rgb(var(--discipline-rgb))] dark:hover:bg-[rgb(var(--discipline-rgb))] hover:text-white dark:hover:text-white transition-all shadow-md"
                    >
                      <Play size={14} fill="currentColor" />
                    </motion.button>
                  )}
                  
                  <motion.button
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                    onClick={() => onToggleSessao?.(s)}
                    disabled={loadingSessionId === s.globalIndex}
                    className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all shadow-sm ${
                      isCompleted
                        ? 'bg-emerald-100 text-emerald-600 hover:bg-emerald-500 hover:text-white dark:bg-emerald-900/30'
                        : 'bg-emerald-600 text-white shadow-md shadow-emerald-600/20 hover:bg-emerald-700'
                    }`}
                  >
                    {loadingSessionId === s.globalIndex ? <Loader2 size={14} className="animate-spin" /> : isCompleted ? <RotateCw size={14} /> : <Check size={16} strokeWidth={3} />}
                  </motion.button>
                </div>
              </motion.div>
            );
          })
        )}
      </div>
    );
  }

  return (
    <div className="relative flex flex-col">
      <div className={`relative z-30 mb-3 shrink-0 overflow-hidden rounded-2xl border p-3 shadow-md backdrop-blur-xl transition-all duration-500 sm:mb-4 sm:p-4 ${
        allSessionsDone
          ? 'border-emerald-300/70 bg-emerald-50/90 shadow-emerald-500/20 dark:border-emerald-900/40 dark:bg-emerald-950/40'
          : 'border-zinc-200/80 bg-white/90 shadow-red-500/10 dark:border-zinc-800 dark:bg-zinc-950/85 dark:shadow-red-950/20 sm:shadow-red-500/15'
      }`}>
        <div className={`pointer-events-none absolute right-0 top-0 h-20 w-20 rounded-full blur-[44px] sm:h-24 sm:w-24 sm:blur-[52px] ${
          allSessionsDone ? 'bg-emerald-500/20' : 'bg-red-500/10'
        }`} />

        <div className="relative z-10 flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-white shadow-lg sm:h-12 sm:w-12 ${
              allSessionsDone ? 'bg-emerald-600 shadow-emerald-600/25' : 'bg-red-600 shadow-red-600/25'
            }`}>
              {allSessionsDone ? <Trophy size={20} className="sm:h-6 sm:w-6" /> : <Zap size={20} className="sm:h-6 sm:w-6" fill="currentColor" />}
            </div>
            <div className="min-w-0">
              <p className={`text-[8px] font-black uppercase tracking-[0.24em] sm:text-[9px] ${
                allSessionsDone ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'
              }`}>Guia de estudo</p>
              <h2 className="mt-0.5 text-base font-black uppercase leading-none tracking-tight text-zinc-900 dark:text-white sm:text-xl">
                {allSessionsDone ? 'Estudo do dia concluido' : 'Sessoes de hoje'}
              </h2>
            </div>
          </div>

          <div className="shrink-0 text-right">
            <div className="min-w-0">
              <p className="text-[8px] font-black uppercase tracking-widest text-zinc-400">Meta de hoje</p>
              <div className="mt-1 flex items-center justify-end gap-1.5">
                <Clock3 size={13} className={allSessionsDone ? 'text-emerald-500' : 'text-red-500'} />
                <span className="text-base font-black tabular-nums text-zinc-900 dark:text-white sm:text-xl">
                  {fmtMin(totalProgressoHoje)}
                  <span className="mx-1 text-xs font-medium text-zinc-400">/</span>
                  {fmtMin(totalPlanejadoHoje)}
                </span>
              </div>
              <p className={`mt-1 text-[9px] font-black uppercase tracking-widest ${allSessionsDone ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                {progressoHojeLimitado}% concluido
              </p>
            </div>
          </div>
        </div>

        <div className="mt-3">
          <div className="mb-1.5 flex items-center justify-between">
            <span className="text-[8px] font-black uppercase tracking-widest text-zinc-500">Progresso de Hoje</span>
            <span className={`text-xs font-black ${allSessionsDone ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>{progressoHojeLimitado}%</span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full border border-zinc-200/50 bg-zinc-100 p-0.5 dark:border-zinc-700/50 dark:bg-zinc-800">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${Math.min(progressoHoje, 100)}%` }}
              transition={{ duration: 1.5, ease: 'circOut' }}
              className={`h-full rounded-full shadow-[0_0_8px_rgba(220,38,38,0.4)] ${
                allSessionsDone ? 'bg-gradient-to-r from-emerald-500 via-green-500 to-teal-500' : 'bg-gradient-to-r from-red-600 via-rose-500 to-orange-500'
              }`}
            />
          </div>
        </div>
      </div>

      {allSessionsDone && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="mx-1 mb-5 overflow-hidden rounded-[28px] border border-emerald-300/70 bg-gradient-to-br from-emerald-500 via-green-500 to-teal-500 p-5 text-center text-white shadow-2xl shadow-emerald-500/25 sm:mx-4 sm:mb-8 sm:p-6"
        >
          <motion.div
            className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-white text-emerald-600 shadow-xl"
            animate={{ scale: [1, 1.08, 1], rotate: [0, -3, 3, 0] }}
            transition={{ duration: 1.9, repeat: Infinity }}
          >
            <Trophy size={28} />
          </motion.div>
          <p className="text-[10px] font-black uppercase tracking-[0.28em] text-white/80">Meta do dia completa</p>
          <h3 className="mt-1 text-lg font-black uppercase tracking-tight">Todas as sessoes concluidas</h3>
        </motion.div>
      )}

      <div className="relative px-1 pr-3 sm:px-4 sm:pr-5">
        <div className="absolute bottom-0 left-[21px] top-0 w-0.5 bg-zinc-200 dark:bg-zinc-800 sm:left-[39px]" />

        <div className="relative z-10 space-y-4 pb-6 sm:space-y-5 sm:pb-8">
          {isRestDayToday ? (
            <div className="ml-9 py-6 sm:ml-16 sm:py-10">
              <div className="flex flex-col items-center justify-center rounded-2xl border border-emerald-200/50 bg-emerald-50/30 p-5 text-center backdrop-blur-sm dark:border-emerald-900/30 dark:bg-emerald-950/20 sm:rounded-[32px] sm:p-8">
                <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-500 text-white shadow-lg shadow-emerald-500/20 sm:mb-4 sm:h-16 sm:w-16 sm:rounded-2xl">
                  <Coffee size={24} className="sm:h-8 sm:w-8" />
                </div>
                <h3 className="text-sm font-black uppercase text-emerald-800 dark:text-emerald-400 sm:text-lg">Dia de Descanso</h3>
                <p className="mt-2 text-xs text-emerald-600/70 dark:text-emerald-400/60 sm:text-sm">Hoje o seu foco deve ser o descanso. Aproveite para renovar as energias para os proximos estudos.</p>
              </div>
            </div>
          ) : (
            sessoesDoDiaHoje.map((sessao, idx) => {
              const disc = disciplinas.find((d) => d.id === sessao.disciplinaId);
              if (!disc) return null;

              const isCompleted = sessao.concluida;
              const isActive = idx === activeSessaoIndex;
              const assuntoNome = sessao.assuntoSugerido?.nome || sessao.assuntoSugerido || '';
              const disciplinaColor = getDisciplineColorForSlot({
                disciplinaId: disc.id,
                disciplinaNome: disc.nome,
                disciplina: disc.nome,
                cor: disc.cor,
              });
              const disciplinaStyle = getDisciplineCardVars(disciplinaColor);
              const progressoSessao = isCompleted
                ? tempoSessaoMinutos
                : Math.min(Number(sessao.progressoMinutos || 0), tempoSessaoMinutos);
              const progressoSessaoPercentual = Math.min(
                Math.round((progressoSessao / tempoSessaoMinutos) * 100),
                100
              );

              return (
                <div key={sessao.globalIndex} className="group flex items-start gap-3 sm:gap-8">
                  <div className="relative mt-2 flex shrink-0 items-center justify-center" style={disciplinaStyle}>
                    {isCompleted ? (
                      <div className="z-10 flex h-8 w-8 items-center justify-center rounded-full bg-emerald-500 text-white shadow-lg shadow-emerald-500/40 ring-4 ring-white dark:ring-zinc-950 sm:h-10 sm:w-10">
                        <Check size={16} className="sm:h-5 sm:w-5" strokeWidth={4} />
                      </div>
                    ) : isActive ? (
                      <div className="relative z-10 flex h-8 w-8 items-center justify-center rounded-full bg-[rgb(var(--discipline-rgb))] text-white shadow-[0_0_18px_rgba(var(--discipline-rgb),0.45)] ring-4 ring-white dark:ring-zinc-950 sm:h-10 sm:w-10">
                        <span className="absolute inset-0 animate-ping rounded-full bg-[rgb(var(--discipline-rgb))] opacity-40" />
                        <Play size={14} className="sm:h-[18px] sm:w-[18px]" fill="currentColor" />
                      </div>
                    ) : (
                      <div className="z-10 flex h-8 w-8 items-center justify-center rounded-full border-2 border-[rgba(var(--discipline-rgb),0.42)] bg-[rgba(var(--discipline-rgb),0.2)] text-[rgb(var(--discipline-rgb))] ring-4 ring-white dark:bg-[rgba(var(--discipline-rgb),0.26)] dark:ring-zinc-950 sm:h-10 sm:w-10">
                        <span className="text-[10px] font-black sm:text-xs">{idx + 1}</span>
                      </div>
                    )}
                  </div>

                  <motion.div
                    whileHover={{ x: 4 }}
                    style={disciplinaStyle}
                    className={`flex-1 overflow-hidden rounded-2xl border transition-all sm:rounded-[28px] ${
                      isActive
                        ? 'border-[rgba(var(--discipline-rgb),0.34)] bg-white shadow-2xl shadow-[rgba(var(--discipline-rgb),0.1)] dark:bg-zinc-900'
                        : isCompleted
                          ? 'border-emerald-200 bg-emerald-50/80 shadow-lg shadow-emerald-500/10 dark:border-emerald-900/40 dark:bg-emerald-950/20'
                          : 'border-[rgba(var(--discipline-rgb),0.5)] bg-[rgba(var(--discipline-rgb),0.24)] shadow-md shadow-[rgba(var(--discipline-rgb),0.08)] dark:border-[rgba(var(--discipline-rgb),0.55)] dark:bg-[rgba(var(--discipline-rgb),0.3)]'
                    }`}
                  >
                    <div className="p-3 sm:p-5">
                      <div className="flex items-start justify-between gap-3 sm:gap-4">
                        <div className="min-w-0">
                          <div className="mb-1 flex flex-wrap items-center gap-1.5 sm:gap-2">
                            <span className={`rounded-md px-2 py-0.5 text-[9px] font-black uppercase tracking-widest ${
                              isCompleted
                                ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300'
                                : isActive
                                  ? 'bg-[rgba(var(--discipline-rgb),0.14)] text-[rgb(var(--discipline-rgb))]'
                                  : 'bg-white/70 text-[rgb(var(--discipline-rgb))] dark:bg-white/10'
                            }`}>
                              {isCompleted ? 'Concluida' : isActive ? 'Agora' : 'Proxima'}
                            </span>
                            <span className="text-[10px] font-medium text-zinc-400">Sessao {sessao.sessaoIndex + 1}</span>
                          </div>
                          <h3 className={`text-sm font-black uppercase tracking-tight sm:text-lg ${
                            isCompleted ? 'text-emerald-800 dark:text-emerald-200' : disciplinaColor.text
                          }`}>
                            {disc.nome}
                          </h3>
                        </div>

                        <div className="flex shrink-0 items-center gap-1.5 rounded-lg border border-zinc-200/50 bg-zinc-100 px-2 py-1 dark:border-zinc-700/50 dark:bg-zinc-800 sm:rounded-xl sm:px-2.5 sm:py-1.5">
                          <Clock3 size={12} className="text-zinc-400" />
                          <span className="text-sm font-black tabular-nums text-zinc-700 dark:text-zinc-200 sm:text-base">
                            {fmtMin(ciclo?.tempoSessaoMinutos || 50)}
                          </span>
                        </div>
                      </div>

                      {showAssuntos && assuntoNome && (
                        <div className={`mt-3 flex items-center gap-2 rounded-xl border p-2.5 sm:mt-4 sm:gap-3 sm:rounded-2xl sm:p-3 ${
                          sessao.hasPendenciaTeoria
                            ? 'border-amber-200 bg-amber-50/50 text-amber-700 dark:border-amber-900/30 dark:bg-amber-950/20 dark:text-amber-300'
                            : 'border-zinc-100 bg-zinc-50 text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900/30'
                        }`}>
                          <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full sm:h-8 sm:w-8 ${
                            sessao.hasPendenciaTeoria ? 'bg-amber-500 text-white' : 'bg-white shadow-sm dark:bg-zinc-800'
                          }`}>
                            {sessao.hasPendenciaTeoria ? <AlertTriangle size={14} /> : <BookOpen size={14} />}
                          </div>
                          <div className="min-w-0">
                            <p className="text-[9px] font-black uppercase tracking-widest opacity-60">
                              {sessao.hasPendenciaTeoria ? 'Retomar Assunto' : 'Assunto Sugerido'}
                            </p>
                            <p className="truncate text-[11px] font-bold sm:text-xs">{assuntoNome}</p>
                          </div>
                        </div>
                      )}

                      <div className="mt-2.5 sm:mt-3">
                        <div className="mb-1.5 flex items-center justify-between gap-2 text-[11px] font-black uppercase tracking-wide sm:text-xs">
                          <span className={isCompleted ? 'text-emerald-600 dark:text-emerald-400' : progressoSessao > 0 ? 'text-orange-600 dark:text-orange-400' : 'text-zinc-400'}>
                            {fmtMin(progressoSessao)} / {fmtMin(tempoSessaoMinutos)}
                          </span>
                          <span className="text-zinc-400">{progressoSessaoPercentual}%</span>
                        </div>
                        <div className="h-1.5 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800">
                          <motion.div
                            initial={false}
                            animate={{ width: `${progressoSessaoPercentual}%` }}
                            transition={{ duration: 0.25 }}
                            className={`h-full rounded-full ${isCompleted ? 'bg-emerald-500' : progressoSessao > 0 ? 'bg-orange-500' : disciplinaColor.progress}`}
                          />
                        </div>
                      </div>

                      {!isCompleted && (
                        <div className="mt-3 flex flex-wrap items-center gap-2 sm:mt-4">
                          <button
                            onClick={() => onIniciarSessao?.(disc, sessao.globalIndex, sessao)}
                            className="inline-flex h-8 items-center justify-center gap-1.5 rounded-xl bg-red-600 px-3 text-[9px] font-black uppercase tracking-wider text-white shadow-md shadow-red-600/15 transition-all hover:bg-red-700 hover:shadow-red-700/20 active:scale-95 sm:h-9 sm:px-4"
                          >
                            <Play size={14} fill="currentColor" />
                            Iniciar Estudo
                          </button>
                          <button
                            onClick={() => onToggleSessao?.(sessao)}
                            disabled={loadingSessionId === sessao.globalIndex}
                            className="inline-flex h-8 items-center justify-center gap-1.5 rounded-xl bg-emerald-600 px-3 text-[9px] font-black uppercase tracking-wider text-white shadow-md shadow-emerald-600/20 transition-all hover:bg-emerald-700 active:scale-95 disabled:opacity-60 sm:h-9 sm:px-4"
                          >
                            {loadingSessionId === sessao.globalIndex ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} strokeWidth={3} />}
                            Concluir
                          </button>
                        </div>
                      )}

                      {isCompleted && (
                        <div className="mt-4 flex flex-wrap items-center gap-2">
                          <div className="flex h-9 items-center gap-2 rounded-xl border border-emerald-200 bg-white/70 px-3 text-[10px] font-black uppercase tracking-wider text-emerald-700 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-300">
                            <CheckCircle2 size={14} />
                            Estudo concluido
                          </div>
                          <button
                            onClick={() => onToggleSessao?.(sessao)}
                            disabled={loadingSessionId === sessao.globalIndex}
                            className="flex h-9 items-center gap-2 rounded-xl bg-white/70 px-4 text-[10px] font-black uppercase tracking-wider text-zinc-500 transition-colors hover:text-zinc-800 disabled:opacity-60 dark:bg-zinc-900/50 dark:hover:text-white"
                          >
                            {loadingSessionId === sessao.globalIndex ? <Loader2 size={14} className="animate-spin" /> : <RotateCw size={14} />}
                            Refazer
                          </button>
                        </div>
                      )}
                    </div>
                  </motion.div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {!isRestDayToday && remainingMinutes > 0 && (
        <div className="mx-1 mt-3 flex items-center gap-3 rounded-2xl border border-dashed border-zinc-300 bg-zinc-50/50 p-3 dark:border-zinc-700 dark:bg-zinc-900/20 sm:mx-4 sm:mt-4 sm:rounded-3xl sm:p-4">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-zinc-100 text-zinc-400 dark:bg-zinc-800">
            <Clock3 size={14} />
          </div>
          <p className="text-[11px] font-medium text-zinc-500">
            Sobraram <span className="font-black text-zinc-800 dark:text-zinc-200">{fmtMin(remainingMinutes)}</span> fora dos blocos de {fmtMin(ciclo?.tempoSessaoMinutos || 50)} configurados.
          </p>
        </div>
      )}
    </div>
  );
}

export default CardSessoesCicloHoje;
