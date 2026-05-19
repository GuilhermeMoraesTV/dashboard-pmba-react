import React, { useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowRight, CalendarDays, Layers, CheckCircle2,
  Clock, Zap, AlertTriangle,
} from 'lucide-react';

// ============================================================================
// HELPERS
// ============================================================================
const dateToYMD = (date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

// ============================================================================
// CONTEXTO ATIVO CARD
//
// Lógica de prioridade quando ambos estão ativos:
//
//  1. CRONOGRAMA com tarefas pendentes HOJE → botão principal vai ao cronograma
//     → link secundário discreto leva ao ciclo
//
//  2. CICLO ativo sem cronograma → comportamento original (vai ao ciclo)
//
//  3. CRONOGRAMA ativo sem ciclo → botão vai ao cronograma
//
//  4. Nenhum ativo → não renderiza (null)
//
// Essa lógica faz sentido porque o cronograma tem urgência temporal
// (tarefas do DIA), enquanto o ciclo é sempre disponível.
// ============================================================================
const ContextoAtivoCard = ({
  activeCicloData,
  activeCronogramaData,
  onGoToCiclo,       // () => void — vai para aba ciclos
  onGoToCronograma,  // () => void — vai para aba cronograma
  onPreferredContextChange,
}) => {
  const hasCiclo = !!activeCicloData;
  const hasCronograma = !!activeCronogramaData;
  const hasBoth = hasCiclo && hasCronograma;

  const goToCiclo = () => {
    onPreferredContextChange?.('ciclo');
    onGoToCiclo?.();
  };

  const goToCronograma = () => {
    onPreferredContextChange?.('cronograma');
    onGoToCronograma?.();
  };

  // Calcula tarefas pendentes de hoje no cronograma
  const cronogramaTodayInfo = useMemo(() => {
    if (!activeCronogramaData) return { pendentes: 0, total: 0 };
    const todayIdx = new Date().getDay(); // 0=Dom … 6=Sáb

    // Calcula semana atual
    const dataInicio = activeCronogramaData.dataInicio;
    if (!dataInicio) return { pendentes: 0, total: 0 };

    const inicio = new Date(dataInicio);
    inicio.setHours(0, 0, 0, 0);
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    const diffDays = Math.max(0, Math.floor((hoje - inicio) / (24 * 60 * 60 * 1000)));
    const weekOffset = Math.floor(diffDays / 7);

    const template = activeCronogramaData.semanaTemplate || [];
    const progresso = activeCronogramaData.progresso || {};
    const semKey = `semana_${weekOffset}`;
    const semProgresso = progresso[semKey] || {};

    const tarefasHoje = template.filter(slot => slot.dia === todayIdx);
    const pendentes = tarefasHoje.filter(slot => !semProgresso[slot.slotId]).length;

    return { pendentes, total: tarefasHoje.length };
  }, [activeCronogramaData]);

  // Decide prioridade: cronograma com pendentes hoje > ciclo
  const cronogramaTemPendentesHoje = cronogramaTodayInfo.pendentes > 0;
  const primaryIsCronograma = hasCronograma && (cronogramaTemPendentesHoje || !hasCiclo);

  if (!hasCiclo && !hasCronograma) return null;

  // ── CASO: Apenas ciclo ativo ─────────────────────────────────────────────
  if (hasCiclo && !hasCronograma) {
    return (
      <motion.button
        onClick={goToCiclo}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        className="w-full flex items-center justify-between gap-3 px-4 py-3 bg-red-600 hover:bg-red-700 text-white rounded-2xl font-bold shadow-lg shadow-red-600/25 transition-all duration-200 group"
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className="p-1.5 bg-white/20 rounded-lg shrink-0">
            <Layers size={15} strokeWidth={2.5} />
          </div>
          <div className="text-left min-w-0">
            <div className="text-[9px] font-black uppercase tracking-widest opacity-80">Ciclo Ativo</div>
            <div className="text-sm font-black truncate leading-tight">{activeCicloData.nome || 'Meu Ciclo'}</div>
          </div>
        </div>
        <ArrowRight size={16} className="shrink-0 group-hover:translate-x-1 transition-transform" />
      </motion.button>
    );
  }

  // ── CASO: Apenas cronograma ativo ────────────────────────────────────────
  if (!hasCiclo && hasCronograma) {
    return (
      <motion.button
        onClick={goToCronograma}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        className="w-full flex items-center justify-between gap-3 px-4 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-bold shadow-lg shadow-emerald-600/25 transition-all duration-200 group"
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className="p-1.5 bg-white/20 rounded-lg shrink-0">
            <CalendarDays size={15} strokeWidth={2.5} />
          </div>
          <div className="text-left min-w-0">
            <div className="text-[9px] font-black uppercase tracking-widest opacity-80 flex items-center gap-1.5">
              Cronograma Ativo
              {cronogramaTodayInfo.pendentes > 0 && (
                <span className="bg-white/25 px-1.5 py-0.5 rounded-md font-black">
                  {cronogramaTodayInfo.pendentes} hoje
                </span>
              )}
            </div>
            <div className="text-sm font-black truncate leading-tight">{activeCronogramaData.nome || 'Meu Cronograma'}</div>
          </div>
        </div>
        <ArrowRight size={16} className="shrink-0 group-hover:translate-x-1 transition-transform" />
      </motion.button>
    );
  }

  // ── CASO: AMBOS ativos — layout inteligente com prioridade ───────────────
  return (
    <div className="flex flex-col gap-2">
      {/* Label de contexto duplo */}
      <div className="flex items-center gap-1.5 px-1">
        <Zap size={10} className="text-amber-500" strokeWidth={3} />
        <span className="text-[9px] font-black uppercase tracking-widest text-zinc-400 dark:text-zinc-500">
          Dois contextos ativos
        </span>
      </div>

      {/* Botão principal — cronograma se tiver pendentes hoje, senão ciclo */}
      {primaryIsCronograma ? (
        <motion.button
          onClick={goToCronograma}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          className="w-full flex items-center justify-between gap-3 px-4 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-bold shadow-lg shadow-emerald-600/20 transition-all duration-200 group"
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className="p-1.5 bg-white/20 rounded-lg shrink-0">
              <CalendarDays size={15} strokeWidth={2.5} />
            </div>
            <div className="text-left min-w-0">
              <div className="text-[9px] font-black uppercase tracking-widest opacity-80 flex items-center gap-1.5">
                Cronograma
                {cronogramaTodayInfo.pendentes > 0 && (
                  <span className="bg-white/25 px-1.5 py-0.5 rounded-md">
                    {cronogramaTodayInfo.pendentes} pendente{cronogramaTodayInfo.pendentes !== 1 ? 's' : ''} hoje
                  </span>
                )}
              </div>
              <div className="text-sm font-black truncate leading-tight">{activeCronogramaData.nome || 'Meu Cronograma'}</div>
            </div>
          </div>
          <ArrowRight size={16} className="shrink-0 group-hover:translate-x-1 transition-transform" />
        </motion.button>
      ) : (
        <motion.button
          onClick={goToCiclo}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          className="w-full flex items-center justify-between gap-3 px-4 py-3 bg-red-600 hover:bg-red-700 text-white rounded-2xl font-bold shadow-lg shadow-red-600/20 transition-all duration-200 group"
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className="p-1.5 bg-white/20 rounded-lg shrink-0">
              <Layers size={15} strokeWidth={2.5} />
            </div>
            <div className="text-left min-w-0">
              <div className="text-[9px] font-black uppercase tracking-widest opacity-80">Ciclo Ativo</div>
              <div className="text-sm font-black truncate leading-tight">{activeCicloData.nome || 'Meu Ciclo'}</div>
            </div>
          </div>
          <ArrowRight size={16} className="shrink-0 group-hover:translate-x-1 transition-transform" />
        </motion.button>
      )}

      {/* Botão secundário — o outro contexto, estilo mais discreto */}
      <motion.button
        onClick={primaryIsCronograma ? goToCiclo : goToCronograma}
        whileHover={{ scale: 1.01 }}
        whileTap={{ scale: 0.99 }}
        className="w-full flex items-center justify-between gap-3 px-4 py-2.5 bg-zinc-100 dark:bg-zinc-800/80 hover:bg-zinc-200 dark:hover:bg-zinc-700/80 text-zinc-600 dark:text-zinc-300 rounded-xl font-bold border border-zinc-200 dark:border-zinc-700/60 transition-all duration-150 group"
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="p-1 bg-zinc-200 dark:bg-zinc-700 rounded-lg shrink-0">
            {primaryIsCronograma
              ? <Layers size={13} strokeWidth={2.5} className="text-red-500" />
              : <CalendarDays size={13} strokeWidth={2.5} className="text-emerald-500" />
            }
          </div>
          <div className="text-left min-w-0">
            <div className="text-[9px] font-black uppercase tracking-widest text-zinc-400 dark:text-zinc-500">
              {primaryIsCronograma ? 'Ciclo' : 'Cronograma'}
            </div>
            <div className="text-xs font-bold truncate leading-tight">
              {primaryIsCronograma
                ? (activeCicloData.nome || 'Meu Ciclo')
                : (activeCronogramaData.nome || 'Meu Cronograma')
              }
            </div>
          </div>
        </div>
        <ArrowRight size={13} className="shrink-0 opacity-40 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all" />
      </motion.button>
    </div>
  );
};

export default ContextoAtivoCard;
