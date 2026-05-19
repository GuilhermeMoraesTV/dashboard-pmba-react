import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Target, BookOpen, Check, Play, ChevronRight,
  Sword, Flame, ShieldAlert, Trophy,
  ListTodo, Clock, CheckCircle2, Loader2, CalendarPlus
} from 'lucide-react';
import { formatDateKeyLocal, getAgendaSemana, getCronogramaReviewBuckets, getWeekOffsetFromDate } from '../../services/scheduling/review';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../../firebaseConfig';
import { useCicloRevisoes } from '../../hooks/useCicloRevisoes';
import { useCiclos } from '../../hooks/useCiclos';
import { useCronogramaSystem } from '../../hooks/useCronogramaSystem';
import { buildCompletionRegistro } from '../../utils/completionRegistro';
import { getCycleDailyGuide } from '../../utils/studyDayStatus';

// --- Helpers ---
const fmtMin = (min) => {
  if (!min || min <= 0) return '0m';
  if (min < 60) return `${min}m`;
  const h = Math.floor(min / 60), m = min % 60;
  return m > 0 ? `${h}h${String(m).padStart(2, '0')}` : `${h}h`;
};

const intervaloLabel = (dias) => {
  if (dias === 1) return 'Amanha';
  if (dias === 7) return '7 dias';
  if (dias === 30) return '30 dias';
  return `${dias || 0} dias`;
};

const getOptimisticKey = (sourceMode, slot) => {
  const tipo = slot?.isRevisaoAuto ? 'revisao' : 'estudo';
  const id = sourceMode === 'ciclo'
    ? (slot?.globalIndex ?? slot?.id ?? slot?.slotId)
    : (slot?.slotIdBase || slot?.slotId || slot?.id);
  return id === null || id === undefined ? null : `${sourceMode}:${tipo}:${id}`;
};

const applyOptimisticDone = (slot, done) => {
  const tempo = Number(slot?.tempoPlanejadoMinutos ?? slot?.tempoMinutos ?? 0);
  return {
    ...slot,
    concluido: done,
    concluida: done,
    progressoMinutos: done ? Math.max(Number(slot?.progressoMinutos || 0), tempo) : slot?.progressoMinutos,
  };
};

// --- Slot de Missão ---
function MissionSlot({ slot, isDone, onToggle, onMarkPending, onPlay, variant, sourceMode = 'cronograma', isLoading = false }) {
  const isEstudo = variant === 'estudo';
  const isCycle = sourceMode === 'ciclo';
  const tempoPlanejado = Number(slot.tempoPlanejadoMinutos ?? slot.tempoMinutos ?? 0);
  const progressoAtual = Number(slot.progressoMinutos || 0);
  const progressoLimitado = Math.min(progressoAtual, tempoPlanejado || progressoAtual);
  const progressoPercentual = tempoPlanejado > 0
    ? Math.min(100, Math.round((progressoLimitado / tempoPlanejado) * 100))
    : (isDone ? 100 : 0);
  const emAndamento = !isDone && progressoLimitado > 0 && progressoPercentual < 100;
  const canMarkPending = isEstudo && !slot.isRevisaoAuto && !isDone && typeof onMarkPending === 'function';
return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -1 }}
      className={`group relative flex items-center gap-3 border transition-all duration-300 ${
        isCycle ? 'rounded-[22px] p-3.5' : 'rounded-2xl p-3'
      } ${
        isDone
          ? isCycle
            ? 'bg-emerald-50/70 dark:bg-emerald-950/25 border-emerald-300/70 dark:border-emerald-900/50 shadow-sm'
            : 'bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-200/60 dark:border-emerald-900/40 shadow-sm'
          : emAndamento
          ? isCycle
            ? 'bg-amber-50/60 dark:bg-amber-950/15 border-amber-300/70 dark:border-amber-900/50 shadow-md shadow-amber-500/5'
            : 'bg-white dark:bg-zinc-900 border-amber-200/80 dark:border-amber-900/40 shadow-md shadow-amber-500/5'
          : isEstudo
            ? isCycle
              ? 'bg-gradient-to-br from-red-50/70 via-white to-zinc-50 dark:from-red-950/15 dark:via-zinc-900 dark:to-zinc-950 border-red-200/70 dark:border-red-900/35 hover:border-red-300 hover:shadow-xl hover:shadow-red-500/10'
              : 'bg-white dark:bg-zinc-900 border-zinc-100 dark:border-zinc-800 hover:border-red-200 dark:hover:border-red-900/40 hover:shadow-xl hover:shadow-red-500/10'
            : 'bg-white dark:bg-zinc-900 border-zinc-100 dark:border-zinc-800 hover:border-blue-200 dark:hover:border-blue-900/40 hover:shadow-xl hover:shadow-blue-500/10'
      }`}
    >
      {/* Indicador Lateral */}
      <div className={`${isCycle ? 'w-10 self-auto rounded-2xl h-10 items-center justify-center' : 'w-1.5 self-stretch rounded-full'} flex shrink-0 transition-all duration-500 ${
        isDone 
          ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]' 
          : emAndamento 
          ? 'bg-amber-500' 
          : isEstudo 
          ? 'bg-red-600 shadow-[0_0_8px_rgba(220,38,38,0.2)]'
          : 'bg-blue-600 shadow-[0_0_8px_rgba(37,99,235,0.2)]'
      }`}>
        {isCycle && (isDone ? <Check size={16} className="text-white" strokeWidth={4} /> : <BookOpen size={16} className="text-white" />)}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <h4 className={`text-[12px] font-black uppercase tracking-tight truncate ${
            isDone
              ? 'text-emerald-700 dark:text-emerald-400 line-through opacity-70'
              : 'text-zinc-900 dark:text-zinc-100'
          }`}>
            {slot.disciplinaNome || slot.disciplina}
          </h4>
          {!isDone && tempoPlanejado > 0 && (
            <div className="flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 text-[8px] font-bold border border-zinc-200/50 dark:border-zinc-700/50">
              <Clock size={8} className={isEstudo ? "text-red-500" : "text-blue-500"} />
              {fmtMin(tempoPlanejado)}
            </div>
          )}
          {isDone && <CheckCircle2 size={12} className="text-emerald-500 ml-auto" />}
        </div>

        <div className="flex items-center gap-2">
          <p className="text-[10px] font-bold text-zinc-400 truncate uppercase tracking-tighter">
            {slot.assunto || (isEstudo ? 'Teoria e Base' : 'Revisão de Elite')}
          </p>
        </div>

        {tempoPlanejado > 0 && !isDone && (
          <div className="mt-2">
            <div className="flex items-center justify-between gap-2 text-[8px] font-bold mb-1">
              <span className={`px-1 rounded-md ${emAndamento ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30' : 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800'}`}>
                {fmtMin(progressoLimitado)} / {fmtMin(tempoPlanejado)}
              </span>
              <span className="text-zinc-400">
                {progressoPercentual}%
              </span>
            </div>
            <div className="h-1.5 rounded-full bg-zinc-100 dark:bg-zinc-800/50 overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${progressoPercentual}%` }}
                transition={{ duration: 0.8, ease: "circOut" }}
                className={`h-full rounded-full ${
                  emAndamento 
                    ? 'bg-gradient-to-r from-amber-400 to-amber-600' 
                    : isEstudo 
                    ? 'bg-gradient-to-r from-red-500 to-red-700'
                    : 'bg-gradient-to-r from-blue-500 to-blue-700'
                }`}
              />
            </div>
          </div>
        )}
      </div>

      <div className="flex items-center gap-1.5 shrink-0">
        {!isDone && (
          <motion.button
            whileHover={{ scale: 1.05, y: -1 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => onPlay?.(slot)}
            className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all shadow-sm border ${
              isEstudo 
                ? 'bg-red-50 dark:bg-red-900/20 text-red-600 border-red-100 dark:border-red-900/30 hover:bg-red-600 hover:text-white' 
                : 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 border-blue-100 dark:border-blue-900/30 hover:bg-blue-600 hover:text-white'
            }`}
            title="Iniciar Estudo"
          >
            <Play size={14} fill="currentColor" />
          </motion.button>
        )}

        <motion.button
          whileHover={{ scale: 1.05, y: -1 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => onToggle(slot)}
          className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all shadow-md ${
            isDone
              ? 'bg-emerald-500 text-white shadow-emerald-500/20'
              : isEstudo
                ? 'bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 hover:bg-red-600 dark:hover:bg-red-600 hover:text-white dark:hover:text-white'
                : 'bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 hover:bg-blue-600 dark:hover:bg-blue-600 hover:text-white dark:hover:text-white'
          }`}
          title={isDone ? 'Concluído' : 'Marcar como Feito'}
        >
          {isDone ? <Check size={16} strokeWidth={4} /> : isLoading ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} strokeWidth={3} />}
        </motion.button>

        {canMarkPending && (
          <motion.button
            whileHover={{ scale: 1.05, y: -1 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => onMarkPending(slot)}
            className="w-9 h-9 rounded-xl flex items-center justify-center bg-amber-50 dark:bg-amber-900/20 text-amber-600 hover:bg-amber-500 hover:text-white transition-all shadow-sm border border-amber-100 dark:border-amber-900/30"
            title="Ainda não concluída"
          >
            <CalendarPlus size={14} />
          </motion.button>
        )}
      </div>
    </motion.div>
  );
}

function CompletedTodayCelebration({ label = 'Tudo concluido' }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      className="relative flex min-h-[220px] flex-col items-center justify-center overflow-hidden rounded-[28px] border border-emerald-200/70 bg-gradient-to-br from-white via-emerald-50 to-teal-50 p-6 text-center text-emerald-900 shadow-2xl shadow-emerald-500/10 dark:border-emerald-900/40 dark:from-zinc-950 dark:via-emerald-950/30 dark:to-zinc-900 dark:text-emerald-100"
    >
      <motion.div
        className="absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-emerald-400 via-green-500 to-teal-400"
        animate={{ opacity: [0.65, 1, 0.65] }}
        transition={{ duration: 2.4, repeat: Infinity }}
      />
      <motion.div
        className="relative mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-600 text-white shadow-xl shadow-emerald-600/20"
        animate={{ scale: [1, 1.08, 1], rotate: [0, -3, 3, 0] }}
        transition={{ duration: 1.9, repeat: Infinity }}
      >
        <Trophy size={30} />
      </motion.div>
      <p className="relative text-[11px] font-black uppercase tracking-[0.32em] text-emerald-600 dark:text-emerald-300">Meta do dia completa</p>
      <h4 className="relative mt-2 text-xl font-black uppercase tracking-tight">{label}</h4>
      <p className="relative mt-2 max-w-xs text-xs font-semibold uppercase tracking-wider text-emerald-700/70 dark:text-emerald-200/70">
        Estudo e revisao do dia estao fechados.
      </p>
    </motion.div>
  );
}

function HojeCard({
  className = '',
  activeCicloData,
  activeCronogramaData,
  cronogramaId,
  user,
  setActiveTab,
  onGoToStudySession,
  onGoToCiclo,
  onGoToCronograma,
  onGoToRevisao,
  addRegistroEstudo,
  deleteCompletionRegistro,
  preferredContext,
  onPreferredContextChange,
}) {
  const [loading, setLoading] = useState(null);
  const loadingRef = useRef(null);
  const [loadingCicloSessao, setLoadingCicloSessao] = useState(null);
  const [acaoRevisaoCiclo, setAcaoRevisaoCiclo] = useState(null);
  const [sucessoRevisaoCiclo, setSucessoRevisaoCiclo] = useState(null);
  const sucessoRevisaoCicloRef = useRef(null);
  const [disciplinasCiclo, setDisciplinasCiclo] = useState([]);
  const [modoPreferido, setModoPreferido] = useState(() => {
    try { return localStorage.getItem('homeContextPreferred') || 'cronograma'; } catch { return 'cronograma'; }
  });
  const [activePanel, setActivePanel] = useState('estudo');
  const [optimisticDone, setOptimisticDone] = useState({});

  const hasCronograma = !!activeCronogramaData?.id;
  const hasCiclo = !!activeCicloData?.id;
  const modoCicloAtivo = hasCiclo && (!hasCronograma || modoPreferido === 'ciclo');
  const { marcarSessaoConcluida, salvarPendenciaTeoriaCiclo, limparPendenciaTeoriaCiclo } = useCiclos(user);
  const { toggleSlotConcluido, concluirRevisaoCronograma, marcarTeoriaAindaNaoConcluida } = useCronogramaSystem(user);

  const hojeIdx = useMemo(() => new Date().getDay(), []);
  const { revisoesHoje, concluirRevisao, reagendarRevisao } = useCicloRevisoes(user, activeCicloData?.id || null);

  useEffect(() => () => {
    if (sucessoRevisaoCicloRef.current) clearTimeout(sucessoRevisaoCicloRef.current);
  }, []);

  useEffect(() => {
    if (!hasCiclo || !user?.uid) {
      setDisciplinasCiclo([]);
      return;
    }
    const ref = collection(db, 'users', user.uid, 'ciclos', activeCicloData.id, 'disciplinas');
    const unsub = onSnapshot(ref, (snap) => {
      setDisciplinasCiclo(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, [hasCiclo, user?.uid, activeCicloData?.id]);

  useEffect(() => {
    if (preferredContext === 'ciclo' || preferredContext === 'cronograma') {
      setModoPreferido(preferredContext);
    }
  }, [preferredContext]);

  const handleSetModoPreferido = useCallback((value) => {
    setModoPreferido(value);
    onPreferredContextChange?.(value);
    try {
      localStorage.setItem('homeContextPreferred', value);
      window.dispatchEvent(new CustomEvent('home-context-preferred-change', { detail: value }));
    } catch {}
  }, [onPreferredContextChange]);

  useEffect(() => {
    const sync = () => {
      try { setModoPreferido(localStorage.getItem('homeContextPreferred') || 'cronograma'); } catch {}
    };
    sync();
    window.addEventListener('storage', sync);
    window.addEventListener('home-context-preferred-change', sync);
    return () => {
      window.removeEventListener('storage', sync);
      window.removeEventListener('home-context-preferred-change', sync);
    };
  }, []);

  const { slotsEstudo, slotsRevisao } = useMemo(() => {
    if (!activeCronogramaData?.semanaTemplate?.length || !activeCronogramaData?.dataInicio) {
      return { slotsEstudo: [], slotsRevisao: [] };
    }
    const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
    const wOff = getWeekOffsetFromDate(activeCronogramaData.dataInicio, hoje);
    const sk = `w${wOff}`;
    const progressoW = activeCronogramaData?.progresso?.[sk] || {};
    const progressoMinutosW = activeCronogramaData?.progressoMinutos?.[sk] || {};
    const agenda = getAgendaSemana(activeCronogramaData, wOff) || [];
    const estudo = agenda
      .filter(s => !s.isRevisaoAuto && s.dia === hojeIdx)
      .map((slot) => {
        const slotIdNoProgresso = slot.slotIdBase || slot.slotId;
        const tempoPlanejadoMinutos = Number(slot.tempoMinutos ?? slot.minutosEstudo ?? 0);
        const progressoCru = Number(progressoMinutosW[slotIdNoProgresso] || slot.progressoMinutos || 0);
        const concluido = progressoW[slotIdNoProgresso] === true || progressoW[slot.slotId] === true || slot.concluido === true;
        const progressoMinutos = concluido ? Math.max(progressoCru, tempoPlanejadoMinutos) : progressoCru;
        return { ...slot, slotIdNoProgresso, concluido, tempoPlanejadoMinutos, progressoMinutos };
      });
    const buckets = getCronogramaReviewBuckets(activeCronogramaData, hoje);
    const revisao = [...buckets.hoje]
      .sort((a, b) => {
        const dataDiff = new Date(a.dataSlot) - new Date(b.dataSlot);
        if (dataDiff !== 0) return dataDiff;
        return String(a.slotId).localeCompare(String(b.slotId));
      })
      .map((slot) => ({ ...slot, concluido: Boolean(slot.concluido) }));
    return { slotsEstudo: estudo, slotsRevisao: revisao };
  }, [activeCronogramaData, hojeIdx]);

  const cicloGuide = useMemo(() => {
    if (!activeCicloData?.id) return { sessions: [], isRestDay: false, plannedMinutes: 0 };
    return getCycleDailyGuide({ ...activeCicloData, disciplinas: disciplinasCiclo });
  }, [activeCicloData, disciplinasCiclo]);

  const cicloSlotsEstudo = useMemo(() => {
    const tempoSessao = Math.max(1, Number(activeCicloData?.tempoSessaoMinutos || 50));
    return (cicloGuide.sessions || []).map((sessao) => {
      const disc = disciplinasCiclo.find((d) => d.id === sessao.disciplinaId);
      const progressoMinutos = sessao.concluida
        ? tempoSessao
        : Math.min(Number(sessao.progressoMinutos || 0), tempoSessao);
      return {
        ...sessao,
        slotId: `ciclo-${sessao.globalIndex}`,
        disciplinaNome: disc?.nome || 'Disciplina',
        disciplina: disc?.nome || 'Disciplina',
        disciplinaObj: disc,
        assunto: sessao.assuntoSugerido?.nome || sessao.assuntoSugerido || '',
        tempoPlanejadoMinutos: tempoSessao,
        progressoMinutos,
        concluido: Boolean(sessao.concluida),
        isRevisaoAuto: false,
      };
    });
  }, [activeCicloData?.tempoSessaoMinutos, cicloGuide.sessions, disciplinasCiclo]);

  const cicloSlotsRevisao = useMemo(() => revisoesHoje.map((rev) => ({
    ...rev,
    slotId: `revisao-ciclo-${rev.id}`,
    disciplinaNome: rev.disciplinaNome || 'Disciplina',
    disciplina: rev.disciplinaNome || 'Disciplina',
    assunto: rev.assunto || 'Revisao geral',
    tempoPlanejadoMinutos: Number(rev.tempoPlanejadoMinutos || rev.tempoMinutos || 20),
    progressoMinutos: rev.concluida ? Number(rev.tempoPlanejadoMinutos || rev.tempoMinutos || 20) : 0,
    concluido: Boolean(rev.concluida),
    isRevisaoAuto: true,
    intervaloLabel: intervaloLabel(rev.intervaloDias),
  })), [revisoesHoje]);

  const estudosVisiveisBase = modoCicloAtivo ? cicloSlotsEstudo : slotsEstudo;
  const revisoesVisiveisBase = modoCicloAtivo ? cicloSlotsRevisao : slotsRevisao;
  const estudosVisiveis = useMemo(() => {
    const sourceMode = modoCicloAtivo ? 'ciclo' : 'cronograma';
    return estudosVisiveisBase.map((slot) => {
      const key = getOptimisticKey(sourceMode, slot);
      return key && Object.prototype.hasOwnProperty.call(optimisticDone, key)
        ? applyOptimisticDone(slot, optimisticDone[key])
        : slot;
    });
  }, [estudosVisiveisBase, modoCicloAtivo, optimisticDone]);
  const revisoesVisiveis = useMemo(() => {
    const sourceMode = modoCicloAtivo ? 'ciclo' : 'cronograma';
    return revisoesVisiveisBase.map((slot) => {
      const key = getOptimisticKey(sourceMode, slot);
      return key && Object.prototype.hasOwnProperty.call(optimisticDone, key)
        ? applyOptimisticDone(slot, optimisticDone[key])
        : slot;
    });
  }, [modoCicloAtivo, optimisticDone, revisoesVisiveisBase]);

  const progressoCard = useMemo(() => {
    const itens = activePanel === 'estudo' ? estudosVisiveis : revisoesVisiveis;
    const total = itens.reduce((acc, item) => acc + Number(item.tempoPlanejadoMinutos ?? item.tempoMinutos ?? 0), 0);
    const feito = itens.reduce((acc, item) => {
      const tempo = Number(item.tempoPlanejadoMinutos ?? item.tempoMinutos ?? 0);
      if (item.concluido) return acc + tempo;
      return acc + Math.min(Number(item.progressoMinutos || 0), tempo || Number(item.progressoMinutos || 0));
    }, 0);
    const pct = total > 0 ? Math.min(100, Math.round((feito / total) * 100)) : (itens.length === 0 ? 100 : 0);
    return { total, feito, pct, itens: itens.length, concluidos: itens.filter((item) => item.concluido).length };
  }, [activePanel, estudosVisiveis, revisoesVisiveis]);

  const totalItensDia = estudosVisiveis.length + revisoesVisiveis.length;
  const totalConcluidosDia = estudosVisiveis.filter((s) => s.concluido).length + revisoesVisiveis.filter((s) => s.concluido).length;
  const diaTodoConcluido = totalItensDia > 0 && totalConcluidosDia === totalItensDia;

  const handleToggle = useCallback(async (slot) => {
    if (!cronogramaId || !user || loadingRef.current) return;
    const loadingId = slot.slotIdBase || slot.slotId;
    const optimisticKey = getOptimisticKey('cronograma', slot);
    const previousDone = Boolean(slot.concluido);
    const nextDone = !previousDone;
    loadingRef.current = loadingId;
    setLoading(loadingId);
    if (optimisticKey) {
      setOptimisticDone((prev) => ({ ...prev, [optimisticKey]: nextDone }));
    }
    try {
      let ok = false;
      if (slot.isRevisaoAuto) {
        ok = await concluirRevisaoCronograma(cronogramaId, slot, activeCronogramaData?.dataInicio);
      } else {
        ok = await toggleSlotConcluido(cronogramaId, slot);
      }
      if (!ok && optimisticKey) {
        setOptimisticDone((prev) => ({ ...prev, [optimisticKey]: previousDone }));
        return;
      }
      const completionRegistro = buildCompletionRegistro({
        context: 'cronograma',
        item: slot,
        cronograma: activeCronogramaData,
        isReview: !!slot.isRevisaoAuto,
      });
      if (ok && !slot.concluido && addRegistroEstudo) {
        try {
          await addRegistroEstudo(completionRegistro);
        } catch (error) {
          console.error(error);
        }
      } else if (ok && slot.concluido && deleteCompletionRegistro) {
        await deleteCompletionRegistro(completionRegistro);
      }
    } catch (error) {
      if (optimisticKey) {
        setOptimisticDone((prev) => ({ ...prev, [optimisticKey]: previousDone }));
      }
      console.error(error);
    } finally { loadingRef.current = null; setLoading(null); }
  }, [activeCronogramaData, addRegistroEstudo, concluirRevisaoCronograma, cronogramaId, deleteCompletionRegistro, toggleSlotConcluido, user]);

  const handleMarkPending = useCallback(async (slot) => {
    if (!cronogramaId || !user || loadingRef.current) return;
    const loadingId = slot.slotIdBase || slot.slotId;
    loadingRef.current = loadingId;
    setLoading(loadingId);
    try {
      const weekOffset = Number.isFinite(Number(slot?.weekOffset))
        ? Number(slot.weekOffset)
        : getWeekOffsetFromDate(activeCronogramaData?.dataInicio, slot?.dataSlot || new Date());
      await marcarTeoriaAindaNaoConcluida(cronogramaId, slot, weekOffset);
    } finally { loadingRef.current = null; setLoading(null); }
  }, [activeCronogramaData?.dataInicio, cronogramaId, marcarTeoriaAindaNaoConcluida, user]);

  const handlePlay = (slot) => {
    if (onGoToStudySession) {
      onGoToStudySession(
        { id: slot.disciplinaId || slot.id || slot.slotId, nome: slot.disciplinaNome || slot.disciplina || 'Disciplina' },
        slot.assunto || null,
        { defaultContext: 'cronograma' }
      );
      return;
    }
    setActiveTab('ciclos');
  };

  const handleIniciarSessaoCiclo = (disciplina, globalIndex, sessao = null) => {
    if (onGoToStudySession) {
      onGoToStudySession(
        { id: disciplina.id, nome: disciplina.nome },
        sessao?.assuntoSugerido?.nome || null,
        { defaultContext: 'ciclo', sessaoGlobalIndex: globalIndex }
      );
      return;
    }
    if (onGoToCiclo) onGoToCiclo();
    else setActiveTab('ciclos');
  };

  const handleToggleSessaoCiclo = useCallback(async (sessao) => {
    if (!activeCicloData?.id || loadingCicloSessao !== null) return;
    const optimisticKey = getOptimisticKey('ciclo', sessao);
    const previousDone = Boolean(sessao.concluido || sessao.concluida);
    const nextDone = !previousDone;
    setLoadingCicloSessao(sessao.globalIndex);
    if (optimisticKey) {
      setOptimisticDone((prev) => ({ ...prev, [optimisticKey]: nextDone }));
    }
    try {
      const ok = await marcarSessaoConcluida(activeCicloData.id, sessao.globalIndex);
      if (!ok && optimisticKey) {
        setOptimisticDone((prev) => ({ ...prev, [optimisticKey]: previousDone }));
        return;
      }
      limparPendenciaTeoriaCiclo(activeCicloData.id, sessao.disciplinaId).catch(console.error);
      const completionRegistro = buildCompletionRegistro({
        context: 'ciclo',
        item: sessao,
        ciclo: { ...activeCicloData, disciplinas: disciplinasCiclo },
        fallbackMinutes: activeCicloData?.tempoSessaoMinutos || 50,
      });
      if (ok && !previousDone && addRegistroEstudo) {
        try {
          await addRegistroEstudo(completionRegistro);
        } catch (error) {
          console.error(error);
        }
      } else if (ok && previousDone && deleteCompletionRegistro) {
        await deleteCompletionRegistro(completionRegistro);
      }
    } catch (error) {
      if (optimisticKey) {
        setOptimisticDone((prev) => ({ ...prev, [optimisticKey]: previousDone }));
      }
      console.error(error);
    } finally {
      setLoadingCicloSessao(null);
    }
  }, [activeCicloData, addRegistroEstudo, deleteCompletionRegistro, disciplinasCiclo, loadingCicloSessao, limparPendenciaTeoriaCiclo, marcarSessaoConcluida]);

  const handleMarcarPendenciaCiclo = useCallback(async (sessao) => {
    const assuntoAtual = sessao?.assuntoSugerido?.nome || '';
    if (!activeCicloData?.id || !sessao?.disciplinaId || !assuntoAtual || loadingCicloSessao !== null) return;
    setLoadingCicloSessao(sessao.globalIndex);
    try {
      await salvarPendenciaTeoriaCiclo({
        cicloId: activeCicloData.id,
        disciplinaId: sessao.disciplinaId,
        assuntoAtual,
        minutosAcumulados: 0,
      });
    } catch (error) {
      console.error(error);
    } finally {
      setLoadingCicloSessao(null);
    }
  }, [activeCicloData?.id, loadingCicloSessao, salvarPendenciaTeoriaCiclo]);

  const marcarSucessoRevisaoCiclo = useCallback((id, tipo) => {
    setSucessoRevisaoCiclo({ id, tipo });
    if (sucessoRevisaoCicloRef.current) clearTimeout(sucessoRevisaoCicloRef.current);
    sucessoRevisaoCicloRef.current = setTimeout(() => {
      setSucessoRevisaoCiclo(null);
      sucessoRevisaoCicloRef.current = null;
    }, 1400);
  }, []);

  const handleIniciarRevisaoCiclo = useCallback((rev) => {
    if (onGoToStudySession) {
      onGoToStudySession(
        { id: rev.disciplinaId || rev.id || rev.revisaoKey, nome: rev.disciplinaNome || 'Disciplina' },
        rev.assunto || null
      );
      return;
    }
    if (onGoToCiclo) onGoToCiclo();
    else setActiveTab('ciclos');
  }, [onGoToCiclo, onGoToStudySession, setActiveTab]);

  const handleConcluirRevisaoCiclo = useCallback(async (rev) => {
    if (!rev?.id || acaoRevisaoCiclo) return;
    setAcaoRevisaoCiclo({ id: rev.id, tipo: 'concluir' });
    try {
      await concluirRevisao(rev.id);
      const completionRegistro = buildCompletionRegistro({
          context: 'ciclo',
          item: rev,
          ciclo: { ...activeCicloData, disciplinas: disciplinasCiclo },
          isReview: true,
          fallbackMinutes: 20,
        });
      const wasDone = Boolean(rev.concluida || rev.concluido);
      if (!wasDone && addRegistroEstudo) {
        await addRegistroEstudo(completionRegistro);
      } else if (wasDone && deleteCompletionRegistro) {
        await deleteCompletionRegistro(completionRegistro);
      }
      marcarSucessoRevisaoCiclo(rev.id, 'concluir');
    } catch (error) {
      console.error(error);
    } finally {
      setAcaoRevisaoCiclo(null);
    }
  }, [acaoRevisaoCiclo, activeCicloData, addRegistroEstudo, concluirRevisao, deleteCompletionRegistro, disciplinasCiclo, marcarSucessoRevisaoCiclo]);

  const handleReagendarRevisaoCiclo = useCallback(async (rev) => {
    if (!rev?.id || acaoRevisaoCiclo) return;
    setAcaoRevisaoCiclo({ id: rev.id, tipo: 'reagendar' });
    try {
      await reagendarRevisao(rev.id, new Date());
      marcarSucessoRevisaoCiclo(rev.id, 'reagendar');
    } catch (error) {
      console.error(error);
    } finally {
      setAcaoRevisaoCiclo(null);
    }
  }, [acaoRevisaoCiclo, marcarSucessoRevisaoCiclo, reagendarRevisao]);

  const isRevisaoCicloAtrasada = useCallback(
    (rev) => String(rev?.dataAgendada || '') < formatDateKeyLocal(new Date()),
    []
  );

  if (!hasCronograma && !hasCiclo) return null;

  return (
    <motion.div
      animate={diaTodoConcluido ? { boxShadow: ['0 24px 70px rgba(16,185,129,0.16)', '0 28px 90px rgba(16,185,129,0.28)', '0 24px 70px rgba(16,185,129,0.16)'] } : {}}
      transition={diaTodoConcluido ? { duration: 2.4, repeat: Infinity, ease: 'easeInOut' } : {}}
      className={`dashboard-card group relative flex min-h-[300px] flex-col overflow-visible border-l-[6px] transition-all duration-500 hover:shadow-xl md:p-6 ${className} ${
      diaTodoConcluido
        ? 'border-emerald-500 bg-emerald-50/70 shadow-2xl shadow-emerald-500/15 hover:shadow-emerald-500/20 dark:bg-emerald-950/20'
        : activePanel === 'estudo'
          ? 'border-red-600 hover:shadow-red-500/10 dark:bg-zinc-900'
          : 'border-blue-600 hover:shadow-blue-500/10 dark:bg-zinc-900'
    }`}>
      <div className={`absolute -right-16 -top-16 h-48 w-48 rounded-full blur-3xl transition-all group-hover:opacity-20 ${
        diaTodoConcluido ? 'bg-emerald-500/20 opacity-70' : activePanel === 'estudo' ? 'bg-red-600/5' : 'bg-blue-600/5'
      }`} />

      <div className="relative z-20 flex h-full w-full min-h-0 flex-col gap-5">
        <div className="sticky top-0 z-30 overflow-visible rounded-2xl border-b border-zinc-200/70 bg-white/95 px-5 pt-5 pb-5 backdrop-blur-xl dark:border-zinc-800/80 dark:bg-zinc-900/95">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h3 className={`truncate text-[13px] font-black uppercase tracking-[0.18em] ${
                diaTodoConcluido ? 'text-emerald-600 dark:text-emerald-400' : activePanel === 'estudo' ? 'text-red-600 dark:text-red-400' : 'text-blue-600 dark:text-blue-400'
              }`}>
                Guia de estudo
              </h3>
              <p className="mt-1 text-[10px] font-bold uppercase tracking-widest text-zinc-400">
                {activePanel === 'estudo' ? 'Missoes do dia' : 'Revisoes estrategicas'} · {modoCicloAtivo ? 'Ciclo' : 'Cronograma'}
              </p>
            </div>
            <div className="shrink-0 text-right">
              <p className="text-[8px] font-black uppercase tracking-widest text-zinc-400">Meta de hoje</p>
              <p className="mt-1 text-sm font-black tabular-nums text-zinc-900 dark:text-white">
                {fmtMin(progressoCard.feito)} / {fmtMin(progressoCard.total)}
              </p>
            </div>
          </div>

          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            <div className="flex max-w-full shrink-0 items-center gap-1 rounded-lg bg-zinc-100 p-0.5 dark:bg-zinc-800/80">
              <button
                type="button"
                onClick={() => setActivePanel('estudo')}
                className={`flex min-w-0 items-center gap-1 rounded-md px-2 py-1 text-[8px] font-black uppercase tracking-wide transition-all duration-300 ${
                  activePanel === 'estudo'
                    ? 'bg-red-600 text-white shadow-sm shadow-red-500/20 dark:bg-red-500 dark:text-white'
                    : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'
                }`}
              >
                <Sword size={10} /> Estudo
              </button>
              <button
                type="button"
                onClick={() => setActivePanel('revisao')}
                className={`flex min-w-0 items-center gap-1 rounded-md px-2 py-1 text-[8px] font-black uppercase tracking-wide transition-all duration-300 ${
                  activePanel === 'revisao'
                    ? 'bg-blue-600 text-white shadow-sm shadow-blue-500/20 dark:bg-blue-500 dark:text-white'
                    : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'
                }`}
              >
                <Target size={10} /> Revisao
              </button>
            </div>
            <span className={`rounded-lg px-2.5 py-1.5 text-[9px] font-black uppercase tracking-widest ${
              diaTodoConcluido
                ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'
                : modoCicloAtivo
                  ? 'bg-red-50 text-red-600 dark:bg-red-950/25 dark:text-red-400'
                  : 'bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-300'
            }`}>
              {progressoCard.concluidos}/{progressoCard.itens}
            </span>
          </div>
        </div>
        {diaTodoConcluido ? (
          <CompletedTodayCelebration label={modoCicloAtivo ? 'Ciclo do dia finalizado' : 'Cronograma do dia finalizado'} />
        ) : activePanel === 'estudo' ? (
          <div className="custom-scrollbar min-h-0 flex-1 space-y-3 overflow-y-auto pr-1">
            {estudosVisiveis.length > 0 ? estudosVisiveis.map((s) => {
              const key = s.slotIdBase || s.slotId || s.globalIndex;
              const isCycleSlot = modoCicloAtivo;
              return (
                <MissionSlot
                  key={key}
                  slot={s}
                  isDone={Boolean(s.concluido)}
                  isLoading={isCycleSlot ? loadingCicloSessao === s.globalIndex : loading === (s.slotIdBase || s.slotId)}
                  onToggle={isCycleSlot ? handleToggleSessaoCiclo : handleToggle}
                  onMarkPending={isCycleSlot ? handleMarcarPendenciaCiclo : handleMarkPending}
                  onPlay={isCycleSlot
                    ? (slot) => handleIniciarSessaoCiclo(slot.disciplinaObj || { id: slot.disciplinaId, nome: slot.disciplinaNome }, slot.globalIndex, slot)
                    : handlePlay}
                  variant="estudo"
                  sourceMode={isCycleSlot ? 'ciclo' : 'cronograma'}
                />
              );
            }) : (
              <div className="flex min-h-[160px] flex-col items-center justify-center rounded-3xl border-2 border-dashed border-zinc-100 dark:border-zinc-800/50">
                <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-red-50 text-red-600 dark:bg-red-950/20">
                  <Flame size={28} />
                </div>
                <p className="text-[11px] font-black uppercase tracking-[0.2em] text-zinc-400">Fim de missao</p>
                <p className="mt-1 text-[9px] font-bold text-zinc-300 uppercase tracking-widest">Aproveite o descanso</p>
              </div>
            )}
          </div>
        ) : (
          <div className="custom-scrollbar min-h-0 flex-1 space-y-3 overflow-y-auto pr-1">
            {revisoesVisiveis.length > 0 ? revisoesVisiveis.map((s) => {
              const isCycleReview = modoCicloAtivo;
              const actionId = isCycleReview ? s.id : (s.slotIdBase || s.slotId);
              return (
                <MissionSlot
                  key={s.slotId || s.id}
                  slot={s}
                  isDone={Boolean(s.concluido)}
                  isLoading={isCycleReview ? acaoRevisaoCiclo?.id === s.id : loading === actionId}
                  onToggle={isCycleReview ? handleConcluirRevisaoCiclo : handleToggle}
                  onPlay={isCycleReview ? handleIniciarRevisaoCiclo : handlePlay}
                  variant="revisao"
                  sourceMode={isCycleReview ? 'ciclo' : 'cronograma'}
                />
              );
            }) : (
              <div className="flex min-h-[160px] flex-col items-center justify-center rounded-3xl border-2 border-dashed border-zinc-100 dark:border-zinc-800/50">
                <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-blue-50 text-blue-500 dark:bg-blue-950/20">
                  <Trophy size={28} />
                </div>
                <p className="text-[11px] font-black uppercase tracking-[0.2em] text-zinc-400">Revisoes ok</p>
                <p className="mt-1 text-[9px] font-bold text-zinc-300 uppercase tracking-widest">Memoria de longo prazo</p>
              </div>
            )}
          </div>
        )}
        <div className="pt-4 border-t border-zinc-100 dark:border-zinc-800/50">
          <button
            onClick={() => {
              if (activePanel === 'estudo') {
                if (modoCicloAtivo) {
                  if (onGoToCiclo) onGoToCiclo();
                  else setActiveTab?.('ciclos');
                } else if (onGoToCronograma) onGoToCronograma();
                else setActiveTab?.('cronograma');
              } else if (onGoToRevisao) onGoToRevisao();
              else setActiveTab?.('revisoes');
            }}
            className={`group/btn relative flex w-full items-center justify-center gap-3 overflow-hidden rounded-[20px] py-3.5 text-[10px] font-black uppercase tracking-[0.25em] text-white shadow-xl transition-all dark:hover:text-white ${
              diaTodoConcluido
                ? 'bg-emerald-600 shadow-emerald-600/20 hover:bg-emerald-700 dark:bg-emerald-600 dark:text-white'
                : activePanel === 'estudo'
                  ? 'bg-zinc-900 hover:bg-red-600 dark:bg-white dark:text-zinc-900 dark:hover:bg-red-600'
                  : 'bg-zinc-900 hover:bg-blue-600 dark:bg-white dark:text-zinc-900 dark:hover:bg-blue-600'
            }`}
          >
            <span className="relative z-10 flex items-center gap-2">
              {activePanel === 'estudo' ? (modoCicloAtivo ? 'Explorar Ciclo Completo' : 'Ver Cronograma Estratégico') : 'Ver Todas as Revisões'}
              <ChevronRight size={14} className="transition-transform duration-300 group-hover/btn:translate-x-1" />
            </span>
          </button>
        </div>
      </div>

      <div className={`pointer-events-none absolute bottom-3 right-3 z-0 transition-all duration-1000 group-hover:scale-105 group-hover:rotate-[-8deg] ${
        diaTodoConcluido ? 'text-emerald-600/10 dark:text-emerald-500/10' : activePanel === 'estudo' ? 'text-red-600/5 dark:text-red-500/5' : 'text-blue-600/5 dark:text-blue-500/5'
      }`}>
        {diaTodoConcluido ? <Trophy strokeWidth={0.5} className="h-36 w-36" /> : activePanel === 'estudo' ? <ShieldAlert strokeWidth={0.5} className="h-36 w-36" /> : <BookOpen strokeWidth={0.5} className="h-36 w-36" />}
      </div>
    </motion.div>
  );
}

export { HojeCard };
export default HojeCard;
