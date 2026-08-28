import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Target, BookOpen, Check, CheckCircle2, Play, ChevronRight,
  Sword, Flame, ShieldAlert, Trophy,
  ListTodo, Clock, Loader2, CalendarPlus, Eye, EyeOff
} from 'lucide-react';
import { formatDateKeyLocal, getAgendaSemana, getCronogramaReviewBuckets, getWeekOffsetFromDate } from '../../services/scheduling/review';
import { collection, doc, onSnapshot, updateDoc } from 'firebase/firestore';
import { db } from '../../firebaseConfig';
import { useCicloRevisoes } from '../../hooks/useCicloRevisoes';
import { useCiclos } from '../../hooks/useCiclos';
import { useCronogramaSystem } from '../../hooks/useCronogramaSystem';
import { resolveLogoUrl } from '../../components/admin/config/editalAssets';
import DailyGoalCompletedModal from '../../components/shared/DailyGoalCompletedModal.jsx';
import CardSessoesCicloHoje from '../../components/ciclos/CardSessoesCicloHoje.jsx';
import { buildCompletionRegistro } from '../../utils/completionRegistro';
import { getCronogramaSlotRecordedMinutes, getCycleDayTargetMinutesMap, getCycleFreeQueue } from '../../utils/studyDayStatus';
import { getDisciplineCardVars, getDisciplineColorForSlot } from '../../utils/disciplineColors';
import HomeEmptyState from './HomeEmptyState.jsx';
import { setLatestToggleIntent, takeLatestToggleIntent } from '../../utils/latestToggleIntent';

// --- Helpers ---
const fmtMin = (min) => {
  if (!min || min <= 0) return '0m';
  if (min < 60) return `${min}m`;
  const h = Math.floor(min / 60), m = min % 60;
  return m > 0 ? `${h}h${String(m).padStart(2, '0')}` : `${h}h`;
};

const normalizarModoTempo = (modo) => (modo === 'oculto' || modo === 'nenhum' ? 'total' : (modo || 'detalhado'));

const TechBackground = ({ activePanel, diaTodoConcluido }) => (
  <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden">
    <div className={`absolute inset-0 opacity-[0.04] transition-colors duration-1000 ${
      diaTodoConcluido ? 'bg-emerald-500' : activePanel === 'estudo' ? 'bg-red-500' : 'bg-blue-500'
    }`} />
    <div className="absolute -top-[10%] -left-[10%] w-[40%] h-[40%] rounded-full blur-[100px] bg-current opacity-[0.03]" />
    <div className="absolute -bottom-[10%] -right-[10%] w-[40%] h-[40%] rounded-full blur-[100px] bg-current opacity-[0.03]" />
  </div>
);

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
  const progressoAtual = Number(slot?.progressoMinutos || 0);
  return {
    ...slot,
    concluido: done,
    concluida: done,
    progressoMinutos: progressoAtual,
  };
};

const removeOptimisticKey = (state, key) => {
  if (!key || !Object.prototype.hasOwnProperty.call(state, key)) return state;
  const next = { ...state };
  delete next[key];
  return next;
};

const getRegistroDateKey = (registro) => {
  if (registro?.data) return registro.data;
  if (registro?.dataRegistro) return registro.dataRegistro;
  if (registro?.timestamp?.toDate) return formatDateKeyLocal(registro.timestamp.toDate());
  if (registro?.createdAt?.toDate) return formatDateKeyLocal(registro.createdAt.toDate());
  return null;
};

const isInteractiveClick = (target) => Boolean(target?.closest?.('button, a, input, textarea, select, [role="button"]'));

const NEUTRAL_DISCIPLINE_COLOR = {
  id: 'neutral',
  hex: '#71717a',
  bg: 'bg-zinc-500',
  text: 'text-zinc-700 dark:text-zinc-200',
  progress: 'bg-zinc-500',
};

// --- Slot de Missão ---
function MissionSlot({ slot, isDone, onToggle, onMarkPending, onPlay, variant, sourceMode = 'cronograma', isLoading = false, useDisciplineColors = true, modoExibirTempo = 'detalhado' }) {
  const isEstudo = variant === 'estudo';
  const isCycle = sourceMode === 'ciclo';
  const modoTempo = isCycle ? 'detalhado' : normalizarModoTempo(modoExibirTempo);
  const mostrarTempoBloco = modoTempo === 'detalhado';
  const shouldUseDisciplineColors = !isCycle || useDisciplineColors !== false;
  const tempoPlanejado = Number(slot.tempoPlanejadoMinutos ?? slot.tempoMinutos ?? 0);
  const progressoAtual = Number(slot.progressoMinutos || 0);
  const effectiveDone = Boolean(isDone) || (tempoPlanejado > 0 && progressoAtual >= tempoPlanejado);
  const progressoPercentualReal = tempoPlanejado > 0
    ? Math.round((progressoAtual / tempoPlanejado) * 100)
    : (effectiveDone ? 100 : 0);
  const progressoPercentual = Math.min(100, progressoPercentualReal);
  const emAndamento = !effectiveDone && progressoAtual > 0 && progressoPercentual < 100;
  const disciplinaColor = shouldUseDisciplineColors ? getDisciplineColorForSlot(slot) : NEUTRAL_DISCIPLINE_COLOR;
  const useDisciplineColor = isEstudo && !emAndamento && shouldUseDisciplineColors;
  const progressoExibido = progressoPercentualReal;
  const progressoBarra = Math.min(100, Math.max(0, progressoExibido));
  const progressoMinutosExibido = progressoAtual;
  const desmarcarBloqueado = effectiveDone && Boolean(slot.bloqueiaDesmarcar || slot.bloqueiaDesmarcarConclusao);
  const toggleTitle = desmarcarBloqueado
    ? 'Conclusao protegida por registro de estudo'
    : effectiveDone ? 'Marcar como pendente' : 'Marcar como concluido';

return (
    <div
      className={`home-mission-slot group relative min-h-[92px] overflow-hidden border transition-all duration-200 ${
        isCycle ? 'rounded-[22px]' : 'rounded-2xl'
      } ${
        useDisciplineColor ? 'discipline-tinted-card' : ''
      } ${
        effectiveDone
          ? 'discipline-completed-card'
        : emAndamento
          ? 'bg-orange-50/80 dark:bg-orange-500/5 border-orange-200 dark:border-orange-500/20'
        : isEstudo
            ? 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-700/50 shadow-sm hover:shadow-lg'
            : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-700/50 shadow-sm hover:border-blue-200 dark:hover:border-blue-900/40 hover:shadow-lg hover:shadow-blue-500/10'
      }`}
      style={useDisciplineColor ? getDisciplineCardVars(disciplinaColor) : undefined}
    >
      <div className={`absolute bottom-0 left-0 top-0 w-1.5 transition-colors duration-300 ${
        effectiveDone ? 'bg-emerald-500/45'
        : emAndamento ? 'bg-orange-500'
        : useDisciplineColor ? 'bg-[rgba(var(--discipline-rgb),0.35)]'
        : isEstudo ? disciplinaColor.bg
        : 'bg-blue-500'
      }`} />

      <div className="flex h-full flex-col gap-2 px-3 py-2.5">
        <div className="grid min-w-0 grid-cols-[2rem_minmax(0,1fr)_auto] items-start gap-2 pr-1">
            <button
              onClick={() => {
                if (desmarcarBloqueado) return;
                onToggle(slot);
              }}
              disabled={desmarcarBloqueado}
              aria-busy={isLoading}
              className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border shadow-sm transition-all disabled:opacity-60 ${
                effectiveDone
                  ? 'border-emerald-500 bg-emerald-500 text-white shadow-none'
                  : 'border-emerald-200 bg-white text-emerald-600 shadow-none hover:border-emerald-300 hover:bg-emerald-50 dark:border-emerald-900/40 dark:bg-white/10 dark:text-emerald-300 dark:hover:bg-emerald-900/35'
              } ${desmarcarBloqueado ? 'cursor-not-allowed' : ''}`}
              title={toggleTitle}
            >
              <Check size={15} strokeWidth={3.5} />
            </button>
            <h4 className={`min-w-0 flex-1 truncate text-[11px] sm:text-xs font-black uppercase tracking-wide leading-tight ${
              effectiveDone ? `${disciplinaColor.text} line-through opacity-75`
              : emAndamento ? 'text-orange-700 dark:text-orange-400'
              : useDisciplineColor ? disciplinaColor.text
              : 'text-zinc-900 dark:text-zinc-100'
            }`}>
              {slot.disciplinaNome || slot.disciplina}
            </h4>
          {mostrarTempoBloco && tempoPlanejado > 0 && (
            <span className="inline-flex min-w-[3.75rem] shrink-0 items-center justify-center gap-1 rounded-full border border-white/70 bg-white/85 px-2 py-0.5 text-[10px] font-black tabular-nums text-zinc-800 shadow-sm dark:border-white/15 dark:bg-white/15 dark:text-white">
              <Clock size={12} className="text-zinc-600 dark:text-zinc-200" />
              {fmtMin(tempoPlanejado)}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <p className={`truncate text-[10px] sm:text-[11px] font-bold leading-snug tracking-tight text-zinc-500 dark:text-zinc-300 ${effectiveDone ? 'line-through decoration-emerald-500/60' : ''}`}>
            {slot.assunto || (isEstudo ? 'Teoria e Base' : 'Revisão de Elite')}
          </p>
        </div>

        {mostrarTempoBloco && tempoPlanejado > 0 && (
          <div className="flex items-end gap-2">
            <div className="min-w-0 flex-1">
              <div className="mb-1 flex items-center justify-between gap-2 text-[10px] font-black text-zinc-700 dark:text-zinc-100">
              <span className="tabular-nums">
                {fmtMin(progressoMinutosExibido)} / {fmtMin(tempoPlanejado)}
              </span>
              <span className="font-black tabular-nums">
                {progressoExibido}%
              </span>
            </div>
            <div className="h-1 overflow-hidden rounded-full bg-white/55 dark:bg-black/25">
              <div
                style={{ width: `${progressoBarra}%` }}
                className={`h-full rounded-full ${
                  effectiveDone
                    ? disciplinaColor.progress
                    : emAndamento
                    ? 'bg-orange-500'
                    : isEstudo 
                    ? disciplinaColor.progress
                    : 'bg-gradient-to-r from-blue-500 to-blue-700'
                }`}
              />
            </div>
            </div>
            {!effectiveDone && (
              <button
                onClick={() => onPlay?.(slot)}
                title="Iniciar estudo"
                className={`inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-white shadow-sm transition-all active:scale-95 ${
                  isEstudo
                    ? 'bg-red-600 shadow-red-600/20 hover:bg-red-700'
                    : 'bg-blue-600 shadow-blue-600/20 hover:bg-blue-700'
                }`}
              >
                <Play size={13} fill="currentColor" />
              </button>
            )}
          </div>
        )}
        {!mostrarTempoBloco && !effectiveDone && (
          <div className="mt-auto flex justify-end">
            <button
              onClick={() => onPlay?.(slot)}
              title="Iniciar estudo"
              className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-white shadow-sm transition-all active:scale-95 ${
                isEstudo
                  ? 'bg-red-600 shadow-red-600/20 hover:bg-red-700'
                  : 'bg-blue-600 shadow-blue-600/20 hover:bg-blue-700'
              }`}
            >
              <Play size={14} fill="currentColor" />
            </button>
          </div>
        )}
      </div>

      <div className="hidden">
        {!effectiveDone && (
          <button
            onClick={() => onPlay?.(slot)}
            className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all shadow-sm border ${
              isEstudo 
                ? 'bg-white dark:bg-red-900/20 text-red-600 border-red-200 dark:border-red-900/30 hover:bg-red-600 hover:text-white' 
                : 'bg-white dark:bg-blue-900/20 text-blue-600 border-blue-200 dark:border-blue-900/30 hover:bg-blue-600 hover:text-white'
            }`}
            title="Iniciar Estudo"
          >
            <Play size={14} fill="currentColor" />
          </button>
        )}
        <button
          onClick={() => onToggle(slot)}
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border shadow-sm transition-all ${
            isDone
              ? 'border-emerald-500 bg-emerald-500 text-white shadow-none'
              : 'border-emerald-200 bg-white text-emerald-600 shadow-none hover:border-emerald-300 hover:bg-emerald-50 dark:border-emerald-900/40 dark:bg-white/10 dark:text-emerald-300 dark:hover:bg-emerald-900/35'
          }`}
          title={isDone ? 'Concluido' : 'Marcar como concluido'}
        >
          {isLoading ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} strokeWidth={3.5} />}
        </button>

        {false && (
          <button
            onClick={() => onMarkPending(slot)}
            className="w-9 h-9 rounded-xl flex items-center justify-center bg-amber-50 dark:bg-amber-900/20 text-amber-600 hover:bg-amber-500 hover:text-white transition-all shadow-sm border border-amber-100 dark:border-amber-900/30"
            title="Ainda não concluída"
          >
            <CalendarPlus size={14} />
          </button>
        )}
      </div>
    </div>
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
  registrosEstudo = [],
  preferredContext,
  onPreferredContextChange,
  dailyGoalModalBlocked = false,
}) {
  const [loading, setLoading] = useState(null);
  const loadingRef = useRef(null);
  const cronogramaToggleInFlightRef = useRef(new Set());
  const desiredCronogramaToggleRef = useRef(new Map());
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
  const lastCycleStudySlotsRef = useRef([]);
  const lastCycleReviewSlotsRef = useRef([]);
  const [completionModalOpen, setCompletionModalOpen] = useState(false);
  const [pendingCompletionModal, setPendingCompletionModal] = useState(false);
  const [showCycleSubjects, setShowCycleSubjects] = useState(activeCicloData?.modoExibirAssuntos !== false);
  const [cycleSubjectsLoading, setCycleSubjectsLoading] = useState(false);
  const completionStateRef = useRef({ initialized: false, wasDone: false });
  const cycleToggleInFlightRef = useRef(new Set());
  const desiredCycleToggleRef = useRef(new Map());

  const hasCronograma = !!activeCronogramaData?.id;
  const hasCiclo = !!activeCicloData?.id;
  const modoCicloAtivo = hasCiclo && (!hasCronograma || modoPreferido === 'ciclo');
  const modoTempoHome = modoCicloAtivo ? 'detalhado' : normalizarModoTempo(activeCronogramaData?.modoExibirTempo);
  const mostrarTempoHomeTotal = modoTempoHome !== 'nenhum';
  const mostrarTempoHomeDetalhado = modoTempoHome === 'detalhado';
  const { salvarPendenciaTeoriaCiclo, limparPendenciaTeoriaCiclo, marcarSessaoConcluida } = useCiclos(user);
  const { toggleSlotConcluido, concluirRevisaoCronograma, marcarTeoriaAindaNaoConcluida } = useCronogramaSystem(user);

  const hojeIdx = useMemo(() => new Date().getDay(), []);
  const { revisoesHoje, concluirRevisao, reagendarRevisao } = useCicloRevisoes(user, activeCicloData?.id || null);

  useEffect(() => {
    setShowCycleSubjects(activeCicloData?.modoExibirAssuntos !== false);
  }, [activeCicloData?.id, activeCicloData?.modoExibirAssuntos]);

  const handleToggleCycleSubjects = useCallback(async () => {
    if (!user?.uid || !activeCicloData?.id || cycleSubjectsLoading) return;
    const previousValue = showCycleSubjects;
    const nextValue = !previousValue;
    setShowCycleSubjects(nextValue);
    setCycleSubjectsLoading(true);
    try {
      await updateDoc(doc(db, 'users', user.uid, 'ciclos', activeCicloData.id), {
        modoExibirAssuntos: nextValue,
      });
    } catch (error) {
      setShowCycleSubjects(previousValue);
      console.error('Erro ao atualizar exibicao de assuntos do ciclo:', error);
    } finally {
      setCycleSubjectsLoading(false);
    }
  }, [activeCicloData?.id, cycleSubjectsLoading, showCycleSubjects, user?.uid]);

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
        const progressoRegistrado = getCronogramaSlotRecordedMinutes({
          cronograma: activeCronogramaData,
          slot,
          registrosEstudo,
          dateKey: formatDateKeyLocal(hoje),
        });
        const progressoRegistroReal = getCronogramaSlotRecordedMinutes({
          cronograma: activeCronogramaData,
          slot,
          registrosEstudo,
          dateKey: formatDateKeyLocal(hoje),
          onlyRealStudyRecords: true,
        });
        const progressoPersistido = Math.max(
          Number(progressoMinutosW[slotIdNoProgresso] || 0),
          Number(slot.slotId ? progressoMinutosW[slot.slotId] || 0 : 0),
          Number(slot.slotIdBase ? progressoMinutosW[slot.slotIdBase] || 0 : 0),
          Number(slot.progressoMinutos || 0)
        );
        const concluidoPorTempo = tempoPlanejadoMinutos > 0 && progressoRegistrado >= tempoPlanejadoMinutos;
        const bloqueiaDesmarcarConclusao = tempoPlanejadoMinutos > 0 && progressoRegistroReal >= tempoPlanejadoMinutos;
        const concluido = progressoW[slotIdNoProgresso] === true
          || progressoW[slot.slotId] === true
          || slot.concluido === true
          || concluidoPorTempo;
        return {
          ...slot,
          slotIdNoProgresso,
          concluido,
          tempoPlanejadoMinutos,
          progressoMinutos: progressoRegistrado,
          progressoRegistradoMinutos: progressoRegistrado,
          progressoPersistidoMinutos: progressoPersistido,
          progressoRegistroRealMinutos: progressoRegistroReal,
          bloqueiaDesmarcarConclusao,
          concluidoManual: concluido && !bloqueiaDesmarcarConclusao,
        };
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
  }, [activeCronogramaData, hojeIdx, registrosEstudo]);

  const cicloGuide = useMemo(() => {
    if (!activeCicloData?.id) return { sessions: [], isRestDay: false, plannedMinutes: 0 };
    return getCycleFreeQueue({ ...activeCicloData, disciplinas: disciplinasCiclo }, registrosEstudo);
  }, [activeCicloData, disciplinasCiclo, registrosEstudo]);

  const cicloSlotsEstudo = useMemo(() => {
    const tempoSessao = Math.max(1, Number(activeCicloData?.tempoSessaoMinutos || 50));
    return (cicloGuide.sessions || []).map((sessao) => {
      const disc = disciplinasCiclo.find((d) => d.id === sessao.disciplinaId);
      const globalIndex = Number(sessao.globalIndex);
      const hasGlobalIndex = sessao.globalIndex !== null
        && sessao.globalIndex !== undefined
        && Number.isInteger(globalIndex);
      const tempoPlanejadoMinutos = Math.max(1, Number(sessao.tempoPlanejadoMinutos || sessao.tempoMinutos || tempoSessao));
      const progressoRaw = Number(sessao.progressoMinutos || 0);
      const concluidoPorProgresso = tempoPlanejadoMinutos > 0 && progressoRaw >= tempoPlanejadoMinutos;
      return {
        ...sessao,
        slotId: hasGlobalIndex
          ? `ciclo-${globalIndex}`
          : `ciclo-disciplina-${sessao.disciplinaId}`,
        disciplinaNome: disc?.nome || 'Disciplina',
        disciplina: disc?.nome || 'Disciplina',
        disciplinaObj: disc,
        cor: disc?.cor,
        assunto: sessao.assuntoSugerido?.nome || sessao.assuntoSugerido || '',
        tempoPlanejadoMinutos,
        tempoMinutos: tempoPlanejadoMinutos,
        progressoMinutos: progressoRaw,
        concluido: Boolean(sessao.concluida) || concluidoPorProgresso,
        isRevisaoAuto: false,
      };
    });
  }, [activeCicloData?.tempoSessaoMinutos, cicloGuide.sessions, disciplinasCiclo]);

  const cicloSlotsRevisao = useMemo(() => revisoesHoje.map((rev) => {
    const tempoPlanejadoMinutos = Number(rev.tempoPlanejadoMinutos || rev.tempoMinutos || 20);
    const progressoMinutos = rev.concluida
      ? tempoPlanejadoMinutos
      : Number(rev.progressoMinutos || 0);
    return {
      ...rev,
      slotId: `revisao-ciclo-${rev.id}`,
      disciplinaNome: rev.disciplinaNome || 'Disciplina',
      disciplina: rev.disciplinaNome || 'Disciplina',
      assunto: rev.assunto || 'Revisao geral',
      tempoPlanejadoMinutos,
      progressoMinutos,
      concluido: Boolean(rev.concluida) || (tempoPlanejadoMinutos > 0 && progressoMinutos >= tempoPlanejadoMinutos),
      isRevisaoAuto: true,
      intervaloLabel: intervaloLabel(rev.intervaloDias),
    };
  }), [revisoesHoje]);

  useEffect(() => {
    if (modoCicloAtivo && cicloSlotsEstudo.length > 0) {
      lastCycleStudySlotsRef.current = cicloSlotsEstudo;
    }
  }, [cicloSlotsEstudo, modoCicloAtivo]);

  useEffect(() => {
    if (modoCicloAtivo && cicloSlotsRevisao.length > 0) {
      lastCycleReviewSlotsRef.current = cicloSlotsRevisao;
    }
  }, [cicloSlotsRevisao, modoCicloAtivo]);

  useEffect(() => {
    if (!modoCicloAtivo) return;
    setOptimisticDone((prev) => {
      let next = prev;

      cicloSlotsEstudo.forEach((slot) => {
        const key = getOptimisticKey('ciclo', slot);
        if (key && Object.prototype.hasOwnProperty.call(next, key) && Boolean(slot.concluido) === Boolean(next[key])) {
          next = removeOptimisticKey(next, key);
        }
      });

      cicloSlotsRevisao.forEach((slot) => {
        const key = getOptimisticKey('ciclo', slot);
        if (key && Object.prototype.hasOwnProperty.call(next, key) && Boolean(slot.concluido) === Boolean(next[key])) {
          next = removeOptimisticKey(next, key);
        }
      });

      return next;
    });
  }, [cicloSlotsEstudo, cicloSlotsRevisao, modoCicloAtivo]);

  const estudosVisiveisBase = useMemo(() => {
    if (!modoCicloAtivo) return slotsEstudo;
    const optimisticKeys = Object.keys(optimisticDone).filter((key) => key.startsWith('ciclo:estudo:'));
    if (!optimisticKeys.length) return cicloSlotsEstudo;

    const keepKeys = new Set(optimisticKeys);
    const byKey = new Map();
    cicloSlotsEstudo.forEach((slot) => {
      const key = getOptimisticKey('ciclo', slot);
      if (key) byKey.set(key, slot);
    });
    lastCycleStudySlotsRef.current.forEach((slot) => {
      const key = getOptimisticKey('ciclo', slot);
      if (key && keepKeys.has(key) && !byKey.has(key)) byKey.set(key, slot);
    });
    return Array.from(byKey.values()).sort((a, b) => Number(a.globalIndex || 0) - Number(b.globalIndex || 0));
  }, [cicloSlotsEstudo, modoCicloAtivo, optimisticDone, slotsEstudo]);

  const revisoesVisiveisBase = useMemo(() => {
    if (!modoCicloAtivo) return slotsRevisao;
    const optimisticKeys = Object.keys(optimisticDone).filter((key) => key.startsWith('ciclo:revisao:'));
    if (!optimisticKeys.length) return cicloSlotsRevisao;

    const keepKeys = new Set(optimisticKeys);
    const byKey = new Map();
    cicloSlotsRevisao.forEach((slot) => {
      const key = getOptimisticKey('ciclo', slot);
      if (key) byKey.set(key, slot);
    });
    lastCycleReviewSlotsRef.current.forEach((slot) => {
      const key = getOptimisticKey('ciclo', slot);
      if (key && keepKeys.has(key) && !byKey.has(key)) byKey.set(key, slot);
    });
    return Array.from(byKey.values()).sort((a, b) => String(a.id || a.slotId || '').localeCompare(String(b.id || b.slotId || '')));
  }, [cicloSlotsRevisao, modoCicloAtivo, optimisticDone, slotsRevisao]);
  const estudosVisiveis = useMemo(() => {
    const sourceMode = modoCicloAtivo ? 'ciclo' : 'cronograma';
    return estudosVisiveisBase.map((slot) => {
      const key = getOptimisticKey(sourceMode, slot);
      return key && Object.prototype.hasOwnProperty.call(optimisticDone, key)
        ? applyOptimisticDone(slot, optimisticDone[key])
        : slot;
    });
  }, [estudosVisiveisBase, modoCicloAtivo, optimisticDone]);
  const cycleSessionCompletionOverrides = useMemo(() => {
    const overrides = {};
    cicloSlotsEstudo.forEach((slot) => {
      const key = getOptimisticKey('ciclo', slot);
      if (key && Object.prototype.hasOwnProperty.call(optimisticDone, key)) {
        overrides[slot.globalIndex] = optimisticDone[key];
      }
    });
    return overrides;
  }, [cicloSlotsEstudo, optimisticDone]);
  const revisoesVisiveis = useMemo(() => {
    const sourceMode = modoCicloAtivo ? 'ciclo' : 'cronograma';
    return revisoesVisiveisBase.map((slot) => {
      const key = getOptimisticKey(sourceMode, slot);
      return key && Object.prototype.hasOwnProperty.call(optimisticDone, key)
        ? applyOptimisticDone(slot, optimisticDone[key])
        : slot;
    });
  }, [modoCicloAtivo, optimisticDone, revisoesVisiveisBase]);
  const revisoesPendentesCount = useMemo(
    () => revisoesVisiveis.filter((slot) => !slot.concluido).length,
    [revisoesVisiveis]
  );
  const hojeKey = useMemo(() => formatDateKeyLocal(new Date()), []);
  const cicloMetaHojeMinutos = useMemo(() => {
    if (!modoCicloAtivo) return 0;
    return Number(getCycleDayTargetMinutesMap(activeCicloData)?.[hojeIdx] || 0);
  }, [activeCicloData, hojeIdx, modoCicloAtivo]);
  const cicloEstudadoHojeMinutos = useMemo(() => {
    if (!modoCicloAtivo) return 0;
    return (Array.isArray(registrosEstudo) ? registrosEstudo : []).reduce((total, registro) => {
      if (getRegistroDateKey(registro) !== hojeKey) return total;
      if (String(registro.cicloId || '') !== String(activeCicloData?.id || '') || registro.cronogramaId) return total;
      return total + Math.max(0, Number(registro.tempoEstudadoMinutos || registro.tempoMinutos || 0));
    }, 0);
  }, [activeCicloData?.id, hojeKey, modoCicloAtivo, registrosEstudo]);

  const progressoCard = useMemo(() => {
    const itens = activePanel === 'estudo' ? estudosVisiveis : revisoesVisiveis;
    const totalFila = itens.reduce((acc, item) => acc + Number(item.tempoPlanejadoMinutos ?? item.tempoMinutos ?? 0), 0);
    const feitoFila = itens.reduce((acc, item) => {
      const tempo = Number(item.tempoPlanejadoMinutos ?? item.tempoMinutos ?? 0);
      if (item.concluido) return acc + Math.max(Number(item.progressoMinutos || 0), tempo);
      return acc + Math.min(Number(item.progressoMinutos || 0), tempo || Number(item.progressoMinutos || 0));
    }, 0);
    const usaMetaDiariaCiclo = modoCicloAtivo && activePanel === 'estudo' && cicloMetaHojeMinutos > 0;
    const total = usaMetaDiariaCiclo ? cicloMetaHojeMinutos : totalFila;
    const feito = usaMetaDiariaCiclo ? cicloEstudadoHojeMinutos : feitoFila;
    const pct = total > 0 ? Math.min(100, Math.round((feito / total) * 100)) : 0;
    return { total, feito, pct, itens: itens.length, concluidos: itens.filter((item) => item.concluido).length };
  }, [activePanel, cicloEstudadoHojeMinutos, cicloMetaHojeMinutos, estudosVisiveis, modoCicloAtivo, revisoesVisiveis]);

  const totalItensDia = estudosVisiveis.length + revisoesVisiveis.length;
  const totalConcluidosDia = estudosVisiveis.filter((s) => s.concluido).length + revisoesVisiveis.filter((s) => s.concluido).length;
  const metaCicloConcluida = modoCicloAtivo && cicloMetaHojeMinutos > 0 && cicloEstudadoHojeMinutos >= cicloMetaHojeMinutos;
  const diaTodoConcluido = modoCicloAtivo
    ? metaCicloConcluida && revisoesPendentesCount === 0
    : totalItensDia > 0 && totalConcluidosDia === totalItensDia;
  const completionGlowActive = diaTodoConcluido && totalItensDia > 0;
  const itensDoDia = useMemo(() => [...estudosVisiveis, ...revisoesVisiveis], [estudosVisiveis, revisoesVisiveis]);
  const progressoDiaResumo = useMemo(() => {
    if (modoCicloAtivo && cicloMetaHojeMinutos > 0) {
      return { total: cicloMetaHojeMinutos, feito: cicloEstudadoHojeMinutos };
    }
    const total = itensDoDia.reduce((acc, item) => acc + Number(item.tempoPlanejadoMinutos ?? item.tempoMinutos ?? 0), 0);
    const feito = itensDoDia.reduce((acc, item) => {
      const tempo = Number(item.tempoPlanejadoMinutos ?? item.tempoMinutos ?? 0);
      if (item.concluido) return acc + Math.max(Number(item.progressoMinutos || 0), tempo);
      return acc + Math.min(Number(item.progressoMinutos || 0), tempo || Number(item.progressoMinutos || 0));
    }, 0);
    return { total, feito };
  }, [cicloEstudadoHojeMinutos, cicloMetaHojeMinutos, itensDoDia, modoCicloAtivo]);
  const registrosHoje = useMemo(() => {
    const source = Array.isArray(registrosEstudo) ? registrosEstudo : [];
    return source.filter((registro) => {
      if (getRegistroDateKey(registro) !== hojeKey) return false;
      if (modoCicloAtivo) return registro.cicloId === activeCicloData?.id && !registro.cronogramaId;
      return registro.cronogramaId === activeCronogramaData?.id;
    });
  }, [activeCicloData?.id, activeCronogramaData?.id, hojeKey, modoCicloAtivo, registrosEstudo]);
  const questoesHoje = registrosHoje.reduce((acc, registro) => acc + Number(registro.questoesFeitas || 0), 0);
  const acertosHoje = registrosHoje.reduce((acc, registro) => acc + Number(registro.acertos || 0), 0);
  const activePlanForModal = modoCicloAtivo ? activeCicloData : activeCronogramaData;
  const editalLogo = activePlanForModal?.logoUrl
    || activePlanForModal?.logo
    || activePlanForModal?.editalLogoUrl
    || resolveLogoUrl({ ciclo: activePlanForModal });
  const editalName = activePlanForModal?.editalNome
    || activePlanForModal?.titulo
    || activePlanForModal?.nome
    || (modoCicloAtivo ? 'Ciclo ativo' : 'Cronograma ativo');

  useEffect(() => {
    if (totalItensDia === 0) return;
    const state = completionStateRef.current;
    if (state.initialized && !state.wasDone && diaTodoConcluido) {
      if (dailyGoalModalBlocked) {
        setPendingCompletionModal(true);
      } else {
        setCompletionModalOpen(true);
      }
    }
    completionStateRef.current = { initialized: true, wasDone: diaTodoConcluido };
  }, [dailyGoalModalBlocked, diaTodoConcluido, totalItensDia]);

  useEffect(() => {
    if (!pendingCompletionModal || dailyGoalModalBlocked) return;
    setCompletionModalOpen(true);
    setPendingCompletionModal(false);
  }, [dailyGoalModalBlocked, pendingCompletionModal]);

  const openCompletionModal = useCallback(() => {
    if (!diaTodoConcluido) return;
    if (dailyGoalModalBlocked) {
      setPendingCompletionModal(true);
      return;
    }
    setCompletionModalOpen(true);
  }, [dailyGoalModalBlocked, diaTodoConcluido]);

  const handleToggle = useCallback(async (slot) => {
    const loadingId = slot.slotIdBase || slot.slotId;
    if (!cronogramaId || !user || !loadingId) return;
    const optimisticKey = getOptimisticKey('cronograma', slot);
    const previousDone = Boolean(slot.concluido);
    if (previousDone && slot.bloqueiaDesmarcarConclusao) return;
    const nextDone = !previousDone;
    if (optimisticKey) {
      setOptimisticDone((prev) => ({ ...prev, [optimisticKey]: nextDone }));
    }
    const completionRegistro = buildCompletionRegistro({
      context: 'cronograma',
      item: slot,
      cronograma: activeCronogramaData,
      isReview: !!slot.isRevisaoAuto,
    });
    setLatestToggleIntent(desiredCronogramaToggleRef.current, loadingId, { targetCompleted: nextDone, slot, completionRegistro });
    if (cronogramaToggleInFlightRef.current.has(loadingId)) return;

    cronogramaToggleInFlightRef.current.add(loadingId);
    loadingRef.current = loadingId;
    setLoading(loadingId);
    let committedState = previousDone;
    try {
      while (desiredCronogramaToggleRef.current.has(loadingId)) {
        const intent = takeLatestToggleIntent(desiredCronogramaToggleRef.current, loadingId);
        if (intent.targetCompleted === committedState) continue;
        const completionPersistence = intent.slot.isRevisaoAuto
          ? concluirRevisaoCronograma(cronogramaId, { ...intent.slot, concluido: committedState }, activeCronogramaData?.dataInicio)
          : toggleSlotConcluido(cronogramaId, { ...intent.slot, concluido: committedState }, null, { targetCompleted: intent.targetCompleted });
        const registroPromise = intent.targetCompleted && addRegistroEstudo
          ? addRegistroEstudo(intent.completionRegistro, { waitForCompletion: completionPersistence })
          : null;
        const ok = await completionPersistence;
        if (!ok) {
          if (!desiredCronogramaToggleRef.current.has(loadingId) && optimisticKey) {
            setOptimisticDone((prev) => ({ ...prev, [optimisticKey]: committedState }));
          }
          continue;
        }
        committedState = intent.targetCompleted;
        const newerIntent = desiredCronogramaToggleRef.current.get(loadingId);
        if (!newerIntent || newerIntent.targetCompleted === committedState) {
          if (committedState && addRegistroEstudo) await registroPromise;
          else if (!committedState && deleteCompletionRegistro) await deleteCompletionRegistro(intent.completionRegistro);
        }
      }
    } catch (error) {
      if (optimisticKey) setOptimisticDone((prev) => ({ ...prev, [optimisticKey]: committedState }));
      console.error(error);
    } finally {
      cronogramaToggleInFlightRef.current.delete(loadingId);
      if (loadingRef.current === loadingId) loadingRef.current = null;
      setLoading((current) => current === loadingId ? null : current);
    }
  }, [activeCronogramaData, addRegistroEstudo, concluirRevisaoCronograma, cronogramaId, deleteCompletionRegistro, toggleSlotConcluido, user]);

  const handleMarkPending = useCallback(async (slot) => {
    const loadingId = slot.slotIdBase || slot.slotId;
    if (!cronogramaId || !user || loadingRef.current === loadingId) return;
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
        {
          defaultContext: 'ciclo',
          sessaoGlobalIndex: globalIndex,
          tempoPlanejadoMinutos: sessao?.tempoPlanejadoMinutos || sessao?.tempoMinutos,
        }
      );
      return;
    }
    if (onGoToCiclo) onGoToCiclo();
    else setActiveTab('ciclos');
  };

  const handleToggleSessaoCiclo = useCallback((sessao) => {
    if (!activeCicloData?.id || !user?.uid) return;
    const sessaoIndex = Number(sessao.globalIndex);
    if (!Number.isFinite(sessaoIndex)) return;
    const tempoSessao = Number(sessao.tempoPlanejadoMinutos || activeCicloData?.tempoSessaoMinutos || 50);
    const progressoSessao = Number(sessao.progressoMinutos || 0);
    const previousDone = Boolean(sessao.concluido || sessao.concluida) || (tempoSessao > 0 && progressoSessao >= tempoSessao);
    if (previousDone && sessao.bloqueiaDesmarcarConclusao) return;
    const optimisticKey = getOptimisticKey('ciclo', sessao);
    const nextDone = !previousDone;
    if (optimisticKey) {
      setOptimisticDone((prev) => ({ ...prev, [optimisticKey]: nextDone }));
    }

    const completionRegistro = buildCompletionRegistro({
      context: 'ciclo',
      item: sessao,
      ciclo: { ...activeCicloData, disciplinas: disciplinasCiclo },
      fallbackMinutes: activeCicloData?.tempoSessaoMinutos || 50,
    });
    setLatestToggleIntent(desiredCycleToggleRef.current, sessaoIndex, {
      targetCompleted: nextDone,
      sessao,
      completionRegistro,
    });
    if (cycleToggleInFlightRef.current.has(sessaoIndex)) return;

    cycleToggleInFlightRef.current.add(sessaoIndex);
    (async () => {
      let committedState = (activeCicloData.sessoesConcluidas || []).map(Number).includes(sessaoIndex);
      try {
        while (desiredCycleToggleRef.current.has(sessaoIndex)) {
          const intent = takeLatestToggleIntent(desiredCycleToggleRef.current, sessaoIndex);
          if (intent.targetCompleted === committedState) continue;
          const completionPersistence = marcarSessaoConcluida(activeCicloData.id, sessaoIndex, {
            targetCompleted: intent.targetCompleted,
            tempoPlanejadoMinutos: intent.sessao.tempoPlanejadoMinutos || intent.sessao.tempoMinutos,
          });
          const registroPromise = intent.targetCompleted && addRegistroEstudo
            ? addRegistroEstudo(intent.completionRegistro, { waitForCompletion: completionPersistence })
            : null;
          const ok = await completionPersistence;
          if (!ok) {
            if (!desiredCycleToggleRef.current.has(sessaoIndex) && optimisticKey) {
              setOptimisticDone((prev) => ({ ...prev, [optimisticKey]: committedState }));
            }
            continue;
          }
          committedState = intent.targetCompleted;
          const newerIntent = desiredCycleToggleRef.current.get(sessaoIndex);
          if (!newerIntent || newerIntent.targetCompleted === committedState) {
            if (committedState && addRegistroEstudo) {
              await registroPromise;
              limparPendenciaTeoriaCiclo(activeCicloData.id, intent.sessao.disciplinaId).catch(console.error);
            } else if (!committedState && deleteCompletionRegistro) {
              await deleteCompletionRegistro(intent.completionRegistro);
            }
          }
        }
      } catch (error) {
        if (optimisticKey) {
          setOptimisticDone((prev) => ({ ...prev, [optimisticKey]: committedState }));
        }
        console.error(error);
      } finally {
        cycleToggleInFlightRef.current.delete(sessaoIndex);
      }
    })();
  }, [activeCicloData, addRegistroEstudo, deleteCompletionRegistro, disciplinasCiclo, limparPendenciaTeoriaCiclo, marcarSessaoConcluida, user?.uid]);

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
        rev.assunto || null,
        { defaultContext: 'ciclo', tipoRegistro: 'revisao' }
      );
      return;
    }
    if (onGoToCiclo) onGoToCiclo();
    else setActiveTab('ciclos');
  }, [onGoToCiclo, onGoToStudySession, setActiveTab]);

  const handleConcluirRevisaoCiclo = useCallback(async (rev) => {
    if (!rev?.id || acaoRevisaoCiclo) return;
    const optimisticKey = getOptimisticKey('ciclo', rev);
    const wasDone = Boolean(rev.concluida || rev.concluido);
    if (optimisticKey) {
      setOptimisticDone((prev) => ({ ...prev, [optimisticKey]: !wasDone }));
    }
    setAcaoRevisaoCiclo({ id: rev.id, tipo: 'concluir' });
    try {
      const completionRegistro = buildCompletionRegistro({
          context: 'ciclo',
          item: rev,
          ciclo: { ...activeCicloData, disciplinas: disciplinasCiclo },
          isReview: true,
          fallbackMinutes: 20,
        });
      const completionPersistence = concluirRevisao(rev.id, !wasDone);
      const registroPromise = !wasDone && addRegistroEstudo
        ? addRegistroEstudo(completionRegistro, { waitForCompletion: completionPersistence })
        : null;
      const ok = await completionPersistence;
      if (ok === false) throw new Error('revisao-ciclo-nao-concluida');
      if (!wasDone && addRegistroEstudo) {
        await registroPromise;
      } else if (wasDone && deleteCompletionRegistro) {
        await deleteCompletionRegistro(completionRegistro);
      }
      marcarSucessoRevisaoCiclo(rev.id, 'concluir');
    } catch (error) {
      if (optimisticKey) {
        setOptimisticDone((prev) => ({ ...prev, [optimisticKey]: wasDone }));
      }
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

  if (!hasCronograma && !hasCiclo) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className={`group relative z-20 flex min-h-[400px] flex-col overflow-hidden rounded-xl border-2 border-l-4 border-zinc-200 !border-l-red-500/20 bg-white p-6 transition-all duration-300 hover:-translate-y-0.5 hover:border-accent-light/50 hover:!border-l-red-500 hover:shadow-lg dark:border-white/10 dark:!border-l-red-500/25 dark:bg-card-dark dark:hover:border-accent-light/30 dark:hover:!border-l-red-500 ${className}`}
      >
        <div className="pointer-events-none absolute inset-0 z-0 bg-white dark:bg-card-dark" />

        <div className="pointer-events-none absolute -right-24 -top-24 h-56 w-56 rounded-full bg-gradient-to-br from-red-600 to-rose-700 opacity-10 blur-[90px] transition-all duration-700 group-hover:opacity-20" />
        <div className="pointer-events-none absolute -bottom-20 -left-20 h-64 w-64 rounded-full bg-zinc-500/5 opacity-40 blur-[80px] transition-all duration-700" />

        <div className="relative z-20 flex h-full min-h-0 flex-col">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-[10px] font-black uppercase tracking-[0.3em] text-red-600 dark:text-red-400">
                  Guia de estudo
                </p>
                <div className="h-1.5 w-1.5 animate-pulse rounded-full bg-red-500" />
              </div>
              <h2 className="mt-1 text-2xl font-black uppercase tracking-tight text-zinc-900 dark:text-white">
                Comece seu <span className="bg-gradient-to-r from-red-600 to-rose-600 bg-clip-text text-transparent">plano</span>
              </h2>
              <div className="mt-2 flex items-center gap-2 text-[9px] font-black uppercase tracking-widest text-zinc-400">
                <span>0 de 0 concluidos</span>
              </div>
            </div>
            <div className="flex flex-col items-end">
              <p className="text-[8px] font-black uppercase tracking-widest text-zinc-400">Progresso Geral</p>
              <p className="mt-1 text-xl font-black tabular-nums text-zinc-900 dark:text-white">0%</p>
            </div>
          </div>

          <div className="mt-6 rounded-2xl border border-zinc-100 bg-zinc-50 p-1.5 dark:border-white/5 dark:bg-white/5">
            <div className="flex items-center justify-center gap-2 rounded-xl bg-white py-3 text-[10px] font-black uppercase tracking-widest text-zinc-950 shadow-sm dark:bg-zinc-800 dark:text-white">
              <BookOpen size={14} className="text-red-500" />
              Estudo
            </div>
          </div>

          <div className="flex min-h-0 flex-1 items-center justify-center py-8">
            <HomeEmptyState
              icon={ListTodo}
              title="Seu guia ainda nao foi criado"
              description="Crie um ciclo ou cronograma para a Home mostrar as missoes de estudo do dia."
              className="min-h-[220px]"
            />
          </div>

          <div className="border-t border-zinc-100 pt-6 dark:border-white/5">
            <button
              type="button"
              onClick={() => setActiveTab?.('planejamento')}
              className="group/btn relative flex w-full items-center justify-center gap-3 overflow-hidden rounded-2xl bg-zinc-950 py-4 text-[10px] font-black uppercase tracking-[0.2em] text-white shadow-xl transition-all hover:bg-red-600 dark:bg-white dark:text-zinc-950 dark:hover:bg-red-600 dark:hover:text-white"
            >
              <span className="relative z-10 flex items-center gap-2">
                Criar guia de estudo
                <ChevronRight size={14} className="transition-transform duration-300 group-hover/btn:translate-x-1" />
              </span>
            </button>
          </div>
        </div>

        <div className="pointer-events-none absolute bottom-3 right-3 z-0 text-red-600/5 transition-all duration-1000 group-hover:scale-105 group-hover:rotate-[-8deg] dark:text-red-500/5">
          <ShieldAlert strokeWidth={0.5} className="h-48 w-48" />
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      onClick={(event) => {
        if (!completionGlowActive || isInteractiveClick(event.target)) return;
        openCompletionModal();
      }}
      className={`group relative z-20 flex h-[min(42rem,calc(100dvh-8.5rem))] min-h-[400px] max-h-[42rem] flex-col overflow-hidden rounded-xl border-2 border-l-4 border-zinc-200 bg-white p-4 transition-all duration-300 hover:-translate-y-0.5 hover:border-accent-light/50 hover:shadow-lg dark:border-white/10 dark:bg-card-dark sm:h-auto sm:max-h-none sm:p-5 ${completionGlowActive ? '!border-l-emerald-500/35 hover:!border-l-emerald-500 dark:!border-l-emerald-500/35 dark:hover:!border-l-emerald-500 dark:shadow-[0_0_24px_rgba(16,185,129,0.1)] dark:hover:shadow-[0_0_36px_rgba(16,185,129,0.16)] cursor-pointer' : '!border-l-red-500/20 hover:!border-l-red-500 dark:!border-l-red-500/25 dark:hover:!border-l-red-500'} ${className}`}
    >
      <div className="pointer-events-none absolute inset-0 z-0 bg-white dark:bg-card-dark" />

      <div className={`pointer-events-none absolute -right-24 -top-24 h-56 w-56 rounded-full opacity-10 blur-[90px] transition-all duration-700 group-hover:opacity-20 ${
        completionGlowActive ? 'bg-gradient-to-br from-emerald-500 to-teal-600' : activePanel === 'estudo' ? 'bg-gradient-to-br from-red-600 to-rose-700' : 'bg-gradient-to-br from-blue-600 to-indigo-700'
      }`} />
      <div className="pointer-events-none absolute -bottom-20 -left-20 h-64 w-64 rounded-full bg-zinc-500/5 opacity-40 blur-[80px] transition-all duration-700" />

      <div className="relative z-20 flex h-full w-full min-h-0 flex-col">
        <div className={`mb-3 shrink-0 overflow-hidden rounded-2xl border p-2.5 shadow-md backdrop-blur-xl transition-all duration-500 dark:border-zinc-800 dark:bg-card-dark/85 sm:p-3 ${
          completionGlowActive
            ? 'border-emerald-200/80 bg-white/90 shadow-emerald-500/10 dark:shadow-emerald-950/20'
            : activePanel === 'estudo'
              ? 'border-zinc-200/80 bg-white/90 shadow-zinc-500/10 dark:shadow-black/20'
              : 'border-zinc-200/80 bg-white/90 shadow-blue-500/10 dark:shadow-blue-950/20'
        }`}>
          <div className="relative z-10 flex items-start justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-white shadow-lg sm:h-12 sm:w-12 ${
                completionGlowActive
                  ? 'bg-emerald-600 shadow-emerald-600/25'
                  : activePanel === 'estudo'
                    ? 'bg-red-600 shadow-red-600/25'
                    : 'bg-blue-600 shadow-blue-600/25'
              }`}>
                {completionGlowActive ? <CheckCircle2 size={20} className="sm:h-6 sm:w-6" /> : activePanel === 'estudo' ? <BookOpen size={20} className="sm:h-6 sm:w-6" /> : <Target size={20} className="sm:h-6 sm:w-6" />}
              </div>
              <div className="min-w-0">
                <p className={`text-[8px] font-black uppercase tracking-[0.24em] sm:text-[9px] ${
                  completionGlowActive ? 'text-emerald-600 dark:text-emerald-400' : activePanel === 'estudo' ? 'text-red-600 dark:text-red-400' : 'text-blue-600 dark:text-blue-400'
                }`}>
                  {modoCicloAtivo ? 'Fila do ciclo' : 'Estudo do dia'}
                </p>
                <h2 className="mt-0.5 text-base font-black uppercase leading-none tracking-tight text-zinc-900 dark:text-white sm:text-xl">
                  {completionGlowActive ? 'ESTUDO DO DIA CONCLUIDO' : activePanel === 'estudo' ? (modoCicloAtivo ? 'Blocos do ciclo' : 'Sessoes ativas') : 'Revisoes ativas'}
                </h2>
              </div>
            </div>

            {mostrarTempoHomeTotal && (
            <div className="shrink-0 text-right">
              <p className="text-[8px] font-black uppercase tracking-widest text-zinc-400">Meta de hoje</p>
              <div className="mt-1 flex items-center justify-end gap-1.5">
                <Clock size={13} className={completionGlowActive ? 'text-emerald-500' : activePanel === 'estudo' ? 'text-red-500' : 'text-blue-500'} />
                <span className="text-base font-black tabular-nums text-zinc-900 dark:text-white sm:text-xl">
                  {mostrarTempoHomeDetalhado && (
                    <>
                      {fmtMin(progressoCard.feito)}
                      <span className="mx-1 text-xs font-medium text-zinc-400">/</span>
                    </>
                  )}
                  {fmtMin(mostrarTempoHomeDetalhado ? progressoCard.total : progressoDiaResumo.total)}
                </span>
              </div>
            </div>
            )}
          </div>

          <div className="relative z-10 mt-2 flex items-center justify-between gap-2">
            {modoCicloAtivo && activePanel === 'estudo' ? (
              <button
                type="button"
                role="switch"
                aria-checked={showCycleSubjects}
                aria-label={showCycleSubjects ? 'Ocultar assuntos sugeridos' : 'Exibir assuntos sugeridos'}
                title={showCycleSubjects ? 'Ocultar assuntos sugeridos' : 'Exibir assuntos sugeridos'}
                disabled={cycleSubjectsLoading}
                onClick={handleToggleCycleSubjects}
                className={`inline-flex h-7 shrink-0 items-center gap-1.5 rounded-xl border px-2 text-[8px] font-black uppercase tracking-wider transition-colors disabled:cursor-wait disabled:opacity-60 sm:text-[9px] ${showCycleSubjects
                  ? 'border-red-200 bg-red-50 text-red-600 dark:border-red-900/50 dark:bg-red-950/25 dark:text-red-400'
                  : 'border-zinc-200 bg-zinc-50 text-zinc-400 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300'
                }`}
              >
                {showCycleSubjects ? <Eye size={12} /> : <EyeOff size={12} />}
                <span>Assuntos</span>
              </button>
            ) : (
              <span aria-hidden="true" className="min-w-0" />
            )}
            <div className="flex shrink-0 items-center rounded-xl border border-zinc-100 bg-zinc-50 p-0.5 dark:border-white/5 dark:bg-white/5">
              <button
                type="button"
                onClick={() => setActivePanel('estudo')}
                className={`flex items-center gap-1 rounded-lg px-2 py-1 text-[8px] font-black uppercase tracking-wider transition-all duration-300 ${
                  activePanel === 'estudo'
                    ? 'bg-white text-zinc-950 shadow-sm dark:bg-zinc-800 dark:text-white'
                    : 'text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300'
                }`}
              >
                <BookOpen size={10} className={activePanel === 'estudo' ? 'text-red-500' : ''} /> Estudo
              </button>
              <button
                type="button"
                onClick={() => setActivePanel('revisao')}
                className={`relative flex items-center gap-1 rounded-lg px-2 py-1 text-[8px] font-black uppercase tracking-wider transition-all duration-300 ${
                  activePanel === 'revisao'
                    ? 'bg-white text-zinc-950 shadow-sm dark:bg-zinc-800 dark:text-white'
                    : 'text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300'
                }`}
              >
                <Target size={10} className={activePanel === 'revisao' ? 'text-blue-500' : ''} /> Revisao
                {revisoesPendentesCount > 0 && (
                  <span className="absolute -right-1.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full border-2 border-white bg-red-600 px-1 text-[8px] font-black leading-none text-white shadow-md shadow-red-600/25 dark:border-zinc-900">
                    {revisoesPendentesCount > 9 ? '9+' : revisoesPendentesCount}
                  </span>
                )}
              </button>
            </div>
          </div>

          <div className="hidden">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <p className={`text-[9px] font-black uppercase tracking-[0.22em] ${
                  completionGlowActive ? 'text-emerald-600 dark:text-emerald-400' : activePanel === 'estudo' ? 'text-red-600 dark:text-red-400' : 'text-blue-600 dark:text-blue-400'
                }`}>
                  Estudo do Dia
                </p>
                <div className={`h-1.5 w-1.5 rounded-full animate-pulse ${
                  completionGlowActive ? 'bg-emerald-500' : activePanel === 'estudo' ? 'bg-red-500' : 'bg-blue-500'
                }`} />
              </div>
              <h2 className="mt-0.5 text-xl font-black uppercase leading-none tracking-tight text-zinc-900 dark:text-white">
                {activePanel === 'estudo' ? 'Sessões' : 'Revisões'} <span className={`bg-gradient-to-r ${activePanel === 'estudo' ? 'from-red-600 to-rose-600' : 'from-blue-600 to-indigo-600'} bg-clip-text text-transparent`}>Ativas</span>
              </h2>              <div className="mt-1.5 flex items-center gap-2 text-[8px] font-black uppercase tracking-widest text-zinc-400">
                <span className="flex items-center gap-1 rounded bg-zinc-100 px-1.5 py-0.5 text-zinc-600 dark:bg-white/5 dark:text-zinc-400">
                  {modoCicloAtivo ? 'Modo Ciclo' : 'Cronograma'}
                </span>
                <span className="opacity-30">|</span>
                <span className={completionGlowActive ? 'text-emerald-500' : ''}>{progressoCard.concluidos} de {progressoCard.itens} concluidos</span>
              </div>
            </div>
            <div className="flex flex-col items-end">
              <p className="text-[8px] font-black uppercase tracking-widest text-zinc-400">Progresso Geral</p>
              <p className="mt-0.5 text-lg font-black tabular-nums leading-none text-zinc-900 dark:text-white">
                {progressoCard.pct}%
              </p>
              <div className="mt-1.5 flex items-center rounded-xl border border-zinc-100 bg-zinc-50 p-0.5 dark:border-white/5 dark:bg-white/5">
                <button
                  type="button"
                  onClick={() => setActivePanel('estudo')}
                  className={`flex items-center gap-1 rounded-lg px-2 py-1 text-[8px] font-black uppercase tracking-wider transition-all duration-300 ${
                    activePanel === 'estudo'
                      ? 'bg-white text-zinc-950 shadow-sm dark:bg-zinc-800 dark:text-white'
                      : 'text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300'
                  }`}
                >
                  <BookOpen size={10} className={activePanel === 'estudo' ? 'text-red-500' : ''} /> Estudo
                </button>
                <button
                  type="button"
                  onClick={() => setActivePanel('revisao')}
                  className={`flex items-center gap-1 rounded-lg px-2 py-1 text-[8px] font-black uppercase tracking-wider transition-all duration-300 ${
                    activePanel === 'revisao'
                      ? 'bg-white text-zinc-950 shadow-sm dark:bg-zinc-800 dark:text-white'
                      : 'text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300'
                  }`}
                >
                  <Target size={10} className={activePanel === 'revisao' ? 'text-blue-500' : ''} /> Revisao
                </button>
              </div>
            </div>
          </div>

          <div className="hidden">
            <div className="flex flex-1 items-center">
              <button
                type="button"
                onClick={() => setActivePanel('estudo')}
                className={`flex flex-1 items-center justify-center gap-2 rounded-xl py-3 text-[10px] font-black uppercase tracking-widest transition-all duration-300 ${
                  activePanel === 'estudo'
                    ? 'bg-white text-zinc-950 shadow-sm dark:bg-zinc-800 dark:text-white'
                    : 'text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300'
                }`}
              >
                <BookOpen size={14} className={activePanel === 'estudo' ? 'text-red-500' : ''} /> Estudo
              </button>
              <button
                type="button"
                onClick={() => setActivePanel('revisao')}
                className={`flex flex-1 items-center justify-center gap-2 rounded-xl py-3 text-[10px] font-black uppercase tracking-widest transition-all duration-300 ${
                  activePanel === 'revisao'
                    ? 'bg-white text-zinc-950 shadow-sm dark:bg-zinc-800 dark:text-white'
                    : 'text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300'
                }`}
              >
                <Target size={14} className={activePanel === 'revisao' ? 'text-blue-500' : ''} /> Revisão
              </button>
            </div>
            <span className={`hidden rounded-lg px-2.5 py-1.5 text-[9px] font-black uppercase tracking-widest ${
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
        {activePanel === 'estudo' ? (
          <div className="study-guide-scroll custom-scrollbar min-h-0 flex-1 space-y-3 overflow-y-auto pr-1.5">
            {modoCicloAtivo ? (
              <CardSessoesCicloHoje
                ciclo={activeCicloData}
                disciplinas={disciplinasCiclo}
                onIniciarSessao={handleIniciarSessaoCiclo}
                onToggleSessao={handleToggleSessaoCiclo}
                loadingSessionId={loadingCicloSessao}
                useDisciplineColors={activeCicloData?.coresDisciplinasAtivas !== false}
                registrosEstudo={registrosEstudo}
                sessionCompletionOverrides={cycleSessionCompletionOverrides}
                showAssuntos={showCycleSubjects}
                onToggleAssuntos={handleToggleCycleSubjects}
                assuntosToggleLoading={cycleSubjectsLoading}
                hideHeader
              />
            ) : estudosVisiveis.length > 0 ? estudosVisiveis.map((s) => {
              const key = s.slotIdBase || s.slotId || s.globalIndex;
              return (
                <MissionSlot
                  key={key}
                  slot={s}
                  isDone={Boolean(s.concluido)}
                  isLoading={loading === (s.slotIdBase || s.slotId)}
                  onToggle={handleToggle}
                  onMarkPending={handleMarkPending}
                  onPlay={handlePlay}
                  variant="estudo"
                  sourceMode="cronograma"
                  useDisciplineColors={activeCicloData?.coresDisciplinasAtivas !== false}
                  modoExibirTempo={modoTempoHome}
                />
              );
            }) : (
              <div className="flex min-h-[200px] flex-col items-center justify-center rounded-xl border-2 border-dashed border-zinc-100 dark:border-zinc-800/50">
                <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-zinc-50 text-zinc-300 dark:bg-white/5">
                  <Flame size={32} />
                </div>
                <p className="text-[11px] font-black uppercase tracking-[0.2em] text-zinc-400">Fim de missao</p>
                <p className="mt-1 text-[9px] font-bold text-zinc-300 uppercase tracking-widest">Aproveite o descanso</p>
              </div>
            )}
          </div>
        ) : (
          <div className="study-guide-scroll custom-scrollbar min-h-0 flex-1 space-y-4 overflow-y-auto pr-2">
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
                  modoExibirTempo={modoTempoHome}
                />
              );
            }) : (
              <div className="flex min-h-[200px] flex-col items-center justify-center rounded-xl border-2 border-dashed border-zinc-100 dark:border-zinc-800/50">
                <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-zinc-50 text-zinc-300 dark:bg-white/5">
                  <Trophy size={32} />
                </div>
                <p className="text-[11px] font-black uppercase tracking-[0.2em] text-zinc-400">Revisoes ok</p>
                <p className="mt-1 text-[9px] font-bold text-zinc-300 uppercase tracking-widest">Memoria de longo prazo</p>
              </div>
            )}
          </div>
        )}
        <div className="mt-3 shrink-0 border-t border-zinc-100 pt-3 dark:border-white/5">
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
            className={`group/btn relative flex w-full items-center justify-center gap-3 overflow-hidden rounded-2xl py-4 text-[10px] font-black uppercase tracking-[0.2em] text-white shadow-xl transition-all ${
              completionGlowActive
                ? 'bg-zinc-950 hover:bg-emerald-600 dark:bg-white dark:text-zinc-950 dark:hover:bg-emerald-600 dark:hover:text-white'
                : activePanel === 'estudo'
                  ? 'bg-zinc-950 hover:bg-red-600 dark:bg-white dark:text-zinc-950 dark:hover:bg-red-600 dark:hover:text-white'
                  : 'bg-zinc-950 hover:bg-blue-600 dark:bg-white dark:text-zinc-950 dark:hover:bg-blue-600 dark:hover:text-white'
            }`}
          >
            <span className="relative z-10 flex items-center gap-2">
              {activePanel === 'estudo' ? (modoCicloAtivo ? 'Explorar Ciclo Completo' : 'Ver Cronograma Estratégico') : 'Ver Todas as Revisões'}
              <ChevronRight size={14} className="transition-transform duration-300 group-hover/btn:translate-x-1" />
            </span>
          </button>
        </div>
      </div>
      <DailyGoalCompletedModal
        open={completionModalOpen}
        onClose={() => setCompletionModalOpen(false)}
        contextLabel={modoCicloAtivo ? 'Ciclo do dia' : 'Cronograma do dia'}
        planName={activePlanForModal?.nome || (modoCicloAtivo ? 'Ciclo ativo' : 'Cronograma ativo')}
        editalName={editalName}
        editalLogo={editalLogo}
        minutes={progressoDiaResumo.feito}
        plannedMinutes={progressoDiaResumo.total}
        questions={questoesHoje}
        correct={acertosHoje}
      />

    </motion.div>
  );
}

export { HojeCard };
export default HojeCard;
