import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../firebaseConfig';
import { doc, collection, query, orderBy, onSnapshot, deleteDoc, updateDoc, getDoc } from 'firebase/firestore';
import { AnimatePresence, motion } from 'framer-motion';

import CicloVisual from '../components/ciclos/CicloVisual';
import RegistroEstudoModal from '../components/ciclos/RegistroEstudoModal';
import DisciplinaDetalheModal from '../components/ciclos/DisciplinaDetalheModal';
import ModalConclusaoCiclo from '../components/ciclos/ModalConclusaoCiclo';
import HistoricoModal from '../components/dashboard/HistoricoModal';
import { useCiclos } from '../hooks/useCiclos';
import { useCicloRevisoes } from '../hooks/useCicloRevisoes';
import TimerSettingsModal, { useTimerSettings } from '../components/ciclos/StudyTimer/TimerSettingsModal';
import CardSessoesCicloHoje from '../components/ciclos/CardSessoesCicloHoje';
import { formatDateKeyLocal } from '../services/scheduling/review';
import { buildCompletionRegistro } from '../utils/completionRegistro';

import {
  ArrowLeft, Trophy, Target, CalendarDays,
  BookOpen, ChevronRight, History, Timer, X, Trash2,
  AlertOctagon, Shield, LayoutList, RotateCw,
  Check, CheckCircle2, Clock3, Loader2, Play, CalendarPlus, Sparkles
} from 'lucide-react';

// --- FUNÇÕES AUXILIARES ---
const formatVisualNumber = (minutes) => {
  if (!minutes || isNaN(minutes)) return '0h';
  let totalMinutes = Math.round(Number(minutes));
  const remainder = totalMinutes % 60;
  if (remainder > 50) totalMinutes = Math.ceil(totalMinutes / 60) * 60;
  const hours = Math.floor(totalMinutes / 60);
  const mins = totalMinutes % 60;
  if (hours === 0) return `${mins}m`;
  else if (mins === 0) return `${hours}h`;
  return `${hours}h ${mins}m`;
};

// --- MODAL DE CONFIRMAÇÃO DE EXCLUSÃO ---
const DeleteConfirmationModal = ({ isOpen, onClose, onConfirm, loading }) => {
    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="bg-white dark:bg-zinc-950 w-full max-w-xs rounded-2xl p-5 border border-zinc-200 dark:border-zinc-800 shadow-2xl text-center relative overflow-hidden max-h-[90vh] overflow-y-auto"
            >
                <div className="flex justify-center mb-3">
                    <div className="w-12 h-12 bg-red-50 dark:bg-red-900/20 text-red-600 rounded-full flex items-center justify-center shadow-inner">
                        <AlertOctagon size={24} />
                    </div>
                </div>
                <h3 className="text-base font-black text-zinc-900 dark:text-white uppercase mb-1">Excluir Registro?</h3>
                <p className="text-xs text-zinc-500 mb-4 px-2">Essa ação não pode ser desfeita.</p>
                <div className="flex gap-2">
                    <button onClick={onClose} className="flex-1 py-2 bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 rounded-lg font-bold text-[10px] uppercase tracking-wide hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors">Cancelar</button>
                    <button onClick={onConfirm} disabled={loading} className="flex-1 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-bold text-[10px] uppercase tracking-wide shadow-md flex items-center justify-center gap-1.5">{loading ? "..." : <><Trash2 size={12} /> Excluir</>}</button>
                </div>
            </motion.div>
        </div>
    );
};

const intervaloLabel = (dias) => {
  if (dias === 1) return 'Amanha';
  if (dias === 7) return '7 dias';
  if (dias === 30) return '30 dias';
  return `${dias || 0} dias`;
};

const formatReviewDateLabel = (dateKey) => {
  if (!dateKey) return 'Sem data';
  const [year, month, day] = String(dateKey).split('-').map(Number);
  if (!year || !month || !day) return String(dateKey);
  return new Date(year, month - 1, day).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
  });
};

const CicloRevisoesOperacionaisCard = ({
  revisoesAtrasadas,
  revisoesHoje,
  totalPendentes,
  loading,
  acaoRevisao,
  onIniciar,
  onConcluir,
  onReagendar,
}) => {
  const totalAtrasadas = revisoesAtrasadas.length;
  const totalHoje = revisoesHoje.length;
  const todas = [
    ...revisoesAtrasadas.map((rev) => ({ ...rev, _bucket: 'atrasada' })),
    ...revisoesHoje.map((rev) => ({ ...rev, _bucket: 'hoje' })),
  ];

  return (
    <section className="relative h-full overflow-hidden rounded-2xl border border-zinc-200/80 bg-gradient-to-br from-white via-zinc-50 to-blue-50/30 p-3 shadow-[0_18px_50px_-30px_rgba(15,23,42,0.35)] dark:border-zinc-800/80 dark:from-zinc-950 dark:via-zinc-900 dark:to-blue-950/10 sm:rounded-[28px] sm:p-4 md:p-5">
      <div className="pointer-events-none absolute right-0 top-0 h-28 w-28 rounded-full bg-blue-500/8 blur-3xl dark:bg-blue-500/10" />
      <div className="pointer-events-none absolute -bottom-10 left-8 h-24 w-24 rounded-full bg-zinc-900/5 blur-3xl dark:bg-white/5" />

      <div className="relative z-10">
        <div className="mb-3 flex flex-col justify-between gap-3 xl:flex-row xl:items-start sm:mb-4 sm:gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-600 text-white shadow-lg shadow-blue-600/20 sm:h-9 sm:w-9 sm:rounded-2xl">
                <RotateCw size={14} className="sm:h-4 sm:w-4" />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] font-black uppercase tracking-[0.22em] text-zinc-400">Revisões do Ciclo</p>
                <h3 className="truncate text-sm font-black text-zinc-800 dark:text-white sm:text-base">
                  Pendências de Revisão
                </h3>
              </div>
            </div>
            <p className="mt-2 max-w-sm text-[10px] leading-relaxed text-zinc-500 dark:text-zinc-400 sm:text-[11px]">
              Mantenha seu conhecimento fresco revisando os assuntos nos intervalos ideais.
            </p>
          </div>

          <div className="shrink-0 flex items-center gap-1.5 self-start">
            <div className="rounded-2xl border border-red-200/80 bg-white/80 px-3 py-1.5 text-center shadow-sm dark:border-red-900/40 dark:bg-zinc-900/80">
              <p className="text-sm font-black tabular-nums text-red-600 dark:text-red-400 leading-none">{totalAtrasadas}</p>
              <p className="text-[8px] font-black uppercase tracking-widest text-zinc-500 dark:text-zinc-400 mt-0.5">Atraso</p>
            </div>
            <div className="rounded-2xl border border-blue-200/80 bg-white/80 px-3 py-1.5 text-center shadow-sm dark:border-blue-900/40 dark:bg-zinc-900/80">
              <p className="text-sm font-black tabular-nums text-blue-600 dark:text-blue-400 leading-none">{totalHoje}</p>
              <p className="text-[8px] font-black uppercase tracking-widest text-zinc-500 dark:text-zinc-400 mt-0.5">Hoje</p>
            </div>
            <div className="rounded-2xl border border-zinc-200/80 bg-white/80 px-3 py-1.5 text-center shadow-sm dark:border-zinc-800 dark:bg-zinc-900/80">
              <p className="text-sm font-black tabular-nums text-zinc-900 dark:text-white leading-none">{totalPendentes}</p>
              <p className="text-[8px] font-black uppercase tracking-widest text-zinc-400 mt-0.5">Total</p>
            </div>
          </div>
        </div>

        <div className="mt-4">
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-12 text-[10px] font-black uppercase tracking-widest text-zinc-400">
              <Loader2 size={16} className="animate-spin" />
              Sincronizando revisões
            </div>
          ) : todas.length > 0 ? (
            <div className="space-y-2.5">
              {todas.map((rev) => {
                const isAtrasada = rev._bucket === 'atrasada';
                const isConcluirLoading = acaoRevisao?.id === rev.id && acaoRevisao?.tipo === 'concluir';
                const isReagendarLoading = acaoRevisao?.id === rev.id && acaoRevisao?.tipo === 'reagendar';

                return (
                  <div
                    key={rev.id}
                    className={`group flex flex-col gap-2 rounded-xl border p-2.5 transition-all hover:-translate-y-0.5 md:flex-row md:items-center sm:gap-3 sm:rounded-2xl sm:p-3 ${
                      isAtrasada
                        ? 'border-red-200/60 bg-white/90 shadow-sm hover:border-red-300 hover:shadow-red-500/10 dark:border-red-900/20 dark:bg-red-950/10 dark:hover:border-red-800/40'
                        : 'border-zinc-200/80 bg-white/80 shadow-sm hover:border-blue-200 hover:shadow-blue-500/10 dark:border-zinc-800 dark:bg-zinc-900/40 dark:hover:border-blue-900/30'
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate text-xs font-black text-zinc-900 dark:text-white sm:text-sm">
                          {rev.disciplinaNome || 'Disciplina'}
                        </p>
                        <span className={`rounded-full px-2 py-0.5 text-[8px] font-black uppercase tracking-widest ${
                          isAtrasada
                            ? 'bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400 border border-red-100 dark:border-red-900/30'
                            : 'bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400 border border-blue-100 dark:border-blue-900/30'
                        }`}>
                          {isAtrasada ? 'Atrasada' : 'Hoje'}
                        </span>
                      </div>
                      <p className="mt-1 flex items-center gap-1.5 truncate text-[10px] font-medium text-zinc-500 dark:text-zinc-400 sm:text-[11px]">
                        <BookOpen size={10} className="opacity-70" />
                        {rev.assunto || 'Revisão geral'} <span className="opacity-50">•</span> {intervaloLabel(rev.intervaloDias)} <span className="opacity-50">•</span> {formatReviewDateLabel(rev.dataAgendada)}
                      </p>
                    </div>

                    <div className="flex shrink-0 flex-wrap items-center gap-1.5 md:justify-end">
                      <button
                        type="button"
                        onClick={() => onIniciar?.(rev)}
                        className="flex h-8 items-center gap-1.5 rounded-xl bg-zinc-100 px-3 text-[10px] font-black uppercase tracking-wider text-zinc-600 transition-all hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
                        title="Iniciar estudo"
                      >
                        <Play size={12} fill="currentColor" />
                        Iniciar
                      </button>

                      <button
                        type="button"
                        onClick={() => onReagendar?.(rev)}
                        disabled={Boolean(acaoRevisao)}
                        className="flex h-8 items-center justify-center rounded-xl bg-zinc-100 w-8 text-zinc-400 transition-all hover:bg-zinc-200 hover:text-zinc-600 disabled:opacity-60 dark:bg-zinc-800 dark:hover:bg-zinc-700 dark:hover:text-zinc-300"
                        title="Reagendar para amanhã"
                      >
                        {isReagendarLoading ? <Loader2 size={12} className="animate-spin" /> : <CalendarPlus size={12} />}
                      </button>

                      <button
                        type="button"
                        onClick={() => onConcluir?.(rev)}
                        disabled={Boolean(acaoRevisao)}
                        className="flex h-8 items-center gap-1.5 rounded-xl bg-zinc-900 px-3 text-[10px] font-black uppercase tracking-wider text-white shadow-md transition-all hover:bg-emerald-500 disabled:opacity-60 dark:bg-white dark:text-zinc-900 dark:hover:bg-emerald-400"
                        title="Concluir revisão"
                      >
                        {isConcluirLoading ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} strokeWidth={3} />}
                        Concluir
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-zinc-200/50 bg-white/50 px-4 py-10 text-center dark:border-zinc-800/50 dark:bg-zinc-900/20">
              <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-500 shadow-inner dark:bg-emerald-900/20">
                <CheckCircle2 size={24} />
              </div>
              <p className="text-xs font-black uppercase tracking-widest text-zinc-700 dark:text-zinc-200">
                Tudo em dia!
              </p>
              <p className="mt-1 text-[11px] text-zinc-400 max-w-[200px] leading-relaxed">
                Nenhuma revisão atrasada ou marcada para hoje neste ciclo.
              </p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
};

// --- PÁGINA PRINCIPAL DO CICLO ---
function CicloDetalhePage({ cicloId, onBack, user, addRegistroEstudo, deleteCompletionRegistro, onStartStudy, onGoToEdital }) {
  const [ciclo, setCiclo] = useState(null);
  const [disciplinas, setDisciplinas] = useState([]);
  const [allRegistrosEstudo, setAllRegistrosEstudo] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showRegistroModal, setShowRegistroModal] = useState(false);
  const [registroPreenchido, setRegistroPreenchido] = useState(null);
  const [disciplinaEmDetalhe, setDisciplinaEmDetalhe] = useState(null);
  const [selectedDisciplinaId, setSelectedDisciplinaId] = useState(null);
  const [showConclusaoModal, setShowConclusaoModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [loadingCicloSessao, setLoadingCicloSessao] = useState(null);
  const [acaoRevisaoCiclo, setAcaoRevisaoCiclo] = useState(null);
  const [cicloResetAnimation, setCicloResetAnimation] = useState(false);
  // ESTADO DA LOGO DINÃ‚MICA
  const [dynamicLogo, setDynamicLogo] = useState(null);

  const [showTimerSettings, setShowTimerSettings] = useState(false);
  const { updateSettings } = useTimerSettings(user?.uid);

  const [recordToDelete, setRecordToDelete] = useState(null);

  const {
    concluirCicloSemanal,
    marcarSessaoConcluida,
    salvarPendenciaTeoriaCiclo,
    limparPendenciaTeoriaCiclo,
    loading: cicloActionLoading,
  } = useCiclos(user);
  const {
    revisoes: revisoesPendentesCiclo,
    revisoesHoje: revisoesHojeCiclo,
    totalPendentes: totalPendentesRevisoesCiclo,
    loading: loadingRevisoesCiclo,
    concluirRevisao: concluirRevisaoCiclo,
    reagendarRevisao: reagendarRevisaoCiclo,
  } = useCicloRevisoes(user, cicloId);
  const [cicloLoaded, setCicloLoaded] = useState(false);
  const [disciplinasLoaded, setDisciplinasLoaded] = useState(false);
  const [registrosLoaded, setRegistrosLoaded] = useState(false);

  // === BUSCA ROBUSTA DA LOGO ===
  useEffect(() => {
    const fetchEditalLogo = async () => {
        if (!ciclo || !user) return;

        if (ciclo.logoUrl && ciclo.logoUrl.trim() !== '') {
            setDynamicLogo(ciclo.logoUrl);
            return;
        }

        const editalId = ciclo.editalId || ciclo.templateId || ciclo.templateOrigem;
        if (editalId && editalId !== 'manual') {
            try {
                const docRef = doc(db, 'editais_templates', editalId);
                const docSnap = await getDoc(docRef);
                if (docSnap.exists()) {
                    const data = docSnap.data();
                    const foundLogo = data.logoUrl || data.logo;
                    if (foundLogo) {
                        setDynamicLogo(foundLogo);
                        try {
                            const cicloRef = doc(db, 'users', user.uid, 'ciclos', cicloId);
                            await updateDoc(cicloRef, { logoUrl: foundLogo });
                        } catch (err) { console.warn("Erro no auto-reparo da logo:", err); }
                        return;
                    }
                }
            } catch (err) { console.error("Erro ao buscar logo do edital:", err); }
        }

        const nomeLower = (ciclo.nome || '').toLowerCase();
        let logoFallback = null;
        if (nomeLower.includes('pm') && !nomeLower.includes('gcm')) logoFallback = '/logosEditais/logo-pm.png';
        else if (nomeLower.includes('pc')) logoFallback = '/logosEditais/logo-pc.png';
        else if (nomeLower.includes('cbm') || nomeLower.includes('bombeiro')) logoFallback = '/logosEditais/logo-cbm.png';
        setDynamicLogo(logoFallback);
    };

    if (cicloLoaded && ciclo) {
        fetchEditalLogo();
    }
  }, [ciclo, cicloLoaded, user, cicloId]);

  // === CONTROLE DA POSIÇÃO DO TIMER ===
  useEffect(() => {
    const shouldRaiseTop = showTimerSettings;
    if (shouldRaiseTop) {
        window.dispatchEvent(new CustomEvent('toggle-timer-raise', { detail: 'top' }));
    } else {
        window.dispatchEvent(new CustomEvent('toggle-timer-raise', { detail: true }));
    }
  }, [showTimerSettings]);

  useEffect(() => {
    return () => {
        window.dispatchEvent(new CustomEvent('toggle-timer-raise', { detail: false }));
    };
  }, []);

  // UseEffects de carregamento de dados
  useEffect(() => { if (!user || !cicloId) return; const cicloRef = doc(db, 'users', user.uid, 'ciclos', cicloId); const unsubscribe = onSnapshot(cicloRef, (docSnap) => { if (docSnap.exists()) { const data = docSnap.data(); const rawDate = (data.ultimaConclusao?.toDate) ? data.ultimaConclusao.toDate() : (data.dataCriacao?.toDate ? data.dataCriacao.toDate() : new Date()); const cicloCompleto = { id: docSnap.id, ...data, cargaHorariaSemanalTotal: Number(data.cargaHorariaSemanalTotal || 0), conclusoes: Number(data.conclusoes || 0), dataInicioAtual: rawDate }; setCiclo(cicloCompleto); setCicloLoaded(true); } else { setCiclo(null); setCicloLoaded(true); } }, (error) => { console.error("Erro no snapshot do ciclo:", error); setCicloLoaded(true); }); return () => unsubscribe(); }, [user, cicloId]);
  useEffect(() => { if (!user || !cicloId) return; const q = query(collection(db, 'users', user.uid, 'ciclos', cicloId, 'disciplinas'), orderBy('nome')); const unsubscribe = onSnapshot(q, (snap) => { setDisciplinas(snap.docs.map(doc => ({ id: doc.id, ...doc.data() }))); setDisciplinasLoaded(true); }, (error) => { console.error(error); setDisciplinasLoaded(true); }); return () => unsubscribe(); }, [user, cicloId]);
  useEffect(() => { if (!user) return; const q = query(collection(db, 'users', user.uid, 'registrosEstudo'), orderBy('timestamp', 'desc')); const unsubscribe = onSnapshot(q, (snap) => { setAllRegistrosEstudo(snap.docs.map(doc => { const data = doc.data(); let finalDataStr = data.data; return { id: doc.id, ...data, tempoEstudadoMinutos: Number(data.tempoEstudadoMinutos || 0), questoesFeitas: Number(data.questoesFeitas || 0), acertos: Number(data.acertos || 0), data: finalDataStr, timestamp: (data.timestamp && typeof data.timestamp.toDate === 'function') ? data.timestamp.toDate() : new Date(0) }; })); setRegistrosLoaded(true); }, (error) => { console.error(error); setRegistrosLoaded(true); }); return () => unsubscribe(); }, [user]);
  useEffect(() => { if (cicloLoaded && disciplinasLoaded && registrosLoaded) setLoading(false); }, [cicloLoaded, disciplinasLoaded, registrosLoaded]);
  useEffect(() => {
    if (!cicloResetAnimation) return undefined;
    const timeoutId = window.setTimeout(() => setCicloResetAnimation(false), 2600);
    return () => window.clearTimeout(timeoutId);
  }, [cicloResetAnimation]);

  // Cálculos
  const registrosAtivosDaSemana = useMemo(() => allRegistrosEstudo.filter(reg => reg.cicloId === cicloId && !reg.conclusaoId), [allRegistrosEstudo, cicloId]);
  const registrosHistoricoCompleto = useMemo(() => allRegistrosEstudo.filter(reg => reg.cicloId === cicloId), [allRegistrosEstudo, cicloId]);
  const hojeRevisaoKey = useMemo(() => formatDateKeyLocal(new Date()), []);
  const { revisoesAtrasadasCiclo, revisoesDoDiaCiclo, revisoesProgramadasCiclo } = useMemo(() => {
    const atrasadas = [];
    const hoje = [];
    const programadas = [];
    revisoesHojeCiclo.forEach((rev) => {
      if (String(rev?.dataAgendada || '') < hojeRevisaoKey) atrasadas.push(rev);
      else hoje.push(rev);
    });
    revisoesPendentesCiclo.forEach((rev) => {
      if (String(rev?.dataAgendada || '') > hojeRevisaoKey) programadas.push(rev);
    });
    const ordenar = (a, b) => {
      const dataDiff = String(a?.dataAgendada || '').localeCompare(String(b?.dataAgendada || ''));
      if (dataDiff !== 0) return dataDiff;
      return String(a?.assunto || '').localeCompare(String(b?.assunto || ''));
    };
    return {
      revisoesAtrasadasCiclo: atrasadas.sort(ordenar),
      revisoesDoDiaCiclo: hoje.sort(ordenar),
      revisoesProgramadasCiclo: programadas.sort(ordenar),
    };
  }, [hojeRevisaoKey, revisoesHojeCiclo, revisoesPendentesCiclo]);
  const { totalEstudado, totalMeta, progressoGeral, registrosPorDisciplina } = useMemo(() => { if (!disciplinas.length) return { totalEstudado: 0, totalMeta: 0, progressoGeral: 0, registrosPorDisciplina: {} }; const totalMetaRaw = disciplinas.reduce((acc, d) => acc + Number(d.tempoAlocadoSemanalMinutos || 0), 0); const totalMetaCalc = Math.round(totalMetaRaw); const registrosPorDisciplina = {}; let totalEstudadoCalc = 0; registrosAtivosDaSemana.forEach(reg => { const minutos = Number(reg.tempoEstudadoMinutos); totalEstudadoCalc += minutos; const discId = reg.disciplinaId; if (discId) registrosPorDisciplina[discId] = (registrosPorDisciplina[discId] || 0) + minutos; }); const prog = totalMetaCalc > 0 ? (totalEstudadoCalc / totalMetaCalc) * 100 : 0; return { totalEstudado: Math.round(totalEstudadoCalc), totalMeta: totalMetaCalc, progressoGeral: prog, registrosPorDisciplina }; }, [disciplinas, registrosAtivosDaSemana]);
  const isAllDisciplinesMet = useMemo(() => { if (!ciclo?.ativo || !disciplinas.length || totalMeta === 0) return false; return disciplinas.every(d => { const meta = Number(d.tempoAlocadoSemanalMinutos || 0); const feito = registrosPorDisciplina[d.id] || 0; return meta > 0 ? feito >= meta : true; }); }, [disciplinas, registrosPorDisciplina, ciclo?.ativo, totalMeta]);

  // Handlers
  const handleConfirmDeleteRegistro = async () => { if(recordToDelete) await deleteDoc(doc(db,'users',user.uid,'registrosEstudo', recordToDelete.id)); setRecordToDelete(null); };
  const handleUpdateRegistro = async (id, data) => { await updateDoc(doc(db,'users',user.uid,'registrosEstudo', id), data); };
  const handleViewDetails = (d) => { setDisciplinaEmDetalhe(d); setSelectedDisciplinaId(d.id); };
  const handleStartStudy = (d, assunto = null, options = {}) => { if(onStartStudy) onStartStudy(d, assunto, { defaultContext: 'ciclo', ...options }); };
  const openRegistroModalWithTopic = (dId, t) => { const d = disciplinas.find(x=>x.id===dId); if(d) { setRegistroPreenchido({disciplinaId: d.id, topicoId: t.id}); setShowRegistroModal(true); } };
  const handleConcluirCiclo = async ({ resetarRevisoesPendentes = false } = {}) => {
    setShowConclusaoModal(false);
    const ok = await concluirCicloSemanal(cicloId, { resetarRevisoesPendentes });
    if (!ok) {
      setShowConclusaoModal(true);
      return;
    }
    setSelectedDisciplinaId(null);
    setCicloResetAnimation(false);
    window.setTimeout(() => {
      window.requestAnimationFrame(() => setCicloResetAnimation(true));
    }, 180);
  };
  const handleMarcarSessaoDoVisual = async (sessaoGlobalIndex, sessao = null) => {
    const ok = await marcarSessaoConcluida(cicloId, sessaoGlobalIndex);
    if (sessao?.disciplina?.id || sessao?.disciplinaId) {
      await limparPendenciaTeoriaCiclo(cicloId, sessao.disciplina?.id || sessao.disciplinaId);
    }
    const completionRegistro = sessao ? buildCompletionRegistro({
        context: 'ciclo',
        item: { ...sessao, globalIndex: sessaoGlobalIndex },
        ciclo: { ...ciclo, disciplinas },
        fallbackMinutes: ciclo?.tempoSessaoMinutos || 50,
      }) : null;
    const wasDone = Boolean(sessao?.concluida || sessao?.concluido);
    if (ok && sessao && !wasDone && addRegistroEstudo) {
      await addRegistroEstudo(completionRegistro);
    } else if (ok && wasDone && deleteCompletionRegistro) {
      await deleteCompletionRegistro(completionRegistro);
    }
  };
  const handleIniciarSessaoSugerida = (disciplina, globalIndex, sessao = null) => {
    if (onStartStudy) {
      onStartStudy(disciplina, sessao?.assuntoSugerido?.nome || null, {
        defaultContext: 'ciclo',
        sessaoGlobalIndex: globalIndex,
      });
    }
  };
  const handleToggleSessaoSugerida = async (sessao) => {
    if (!sessao || loadingCicloSessao !== null) return;
    setLoadingCicloSessao(sessao.globalIndex);
    try {
      const ok = await marcarSessaoConcluida(cicloId, sessao.globalIndex);
      await limparPendenciaTeoriaCiclo(cicloId, sessao.disciplinaId);
      const completionRegistro = buildCompletionRegistro({
          context: 'ciclo',
          item: sessao,
          ciclo: { ...ciclo, disciplinas },
          fallbackMinutes: ciclo?.tempoSessaoMinutos || 50,
        });
      const wasDone = Boolean(sessao.concluida || sessao.concluido);
      if (ok && !wasDone && addRegistroEstudo) {
        await addRegistroEstudo(completionRegistro);
      } else if (ok && wasDone && deleteCompletionRegistro) {
        await deleteCompletionRegistro(completionRegistro);
      }
    } finally {
      setLoadingCicloSessao(null);
    }
  };
  const handleMarcarTeoriaPendente = async (sessao) => {
    const assuntoAtual = sessao?.assuntoSugerido?.nome || '';
    if (!sessao?.disciplinaId || !assuntoAtual || loadingCicloSessao !== null) return;
    setLoadingCicloSessao(sessao.globalIndex);
    try {
      await salvarPendenciaTeoriaCiclo({
        cicloId,
        disciplinaId: sessao.disciplinaId,
        assuntoAtual,
        minutosAcumulados: 0,
      });
    } finally {
      setLoadingCicloSessao(null);
    }
  };
  const handleIniciarRevisaoCiclo = (revisao) => {
    if (!onStartStudy || !revisao) return;
    onStartStudy(
      { id: revisao.disciplinaId || revisao.id || revisao.revisaoKey, nome: revisao.disciplinaNome || 'Disciplina' },
      revisao.assunto || null,
      { defaultContext: 'ciclo' }
    );
  };
  const handleConcluirRevisaoCiclo = async (revisao) => {
    if (!revisao?.id || acaoRevisaoCiclo) return;
    setAcaoRevisaoCiclo({ id: revisao.id, tipo: 'concluir' });
    try {
      await concluirRevisaoCiclo(revisao.id);
      const completionRegistro = buildCompletionRegistro({
          context: 'ciclo',
          item: revisao,
          ciclo: { ...ciclo, disciplinas },
          isReview: true,
          fallbackMinutes: 20,
        });
      const wasDone = Boolean(revisao.concluida || revisao.concluido);
      if (!wasDone && addRegistroEstudo) {
        await addRegistroEstudo(completionRegistro);
      } else if (wasDone && deleteCompletionRegistro) {
        await deleteCompletionRegistro(completionRegistro);
      }
    } catch (error) {
      console.error(error);
    } finally {
      setAcaoRevisaoCiclo(null);
    }
  };
  const handleReagendarRevisaoCiclo = async (revisao) => {
    if (!revisao?.id || acaoRevisaoCiclo) return;
    const isAtrasada = String(revisao?.dataAgendada || '') < hojeRevisaoKey;
    const novaData = isAtrasada ? new Date() : new Date(Date.now() + 24 * 60 * 60 * 1000);
    setAcaoRevisaoCiclo({ id: revisao.id, tipo: 'reagendar' });
    try {
      await reagendarRevisaoCiclo(revisao.id, novaData);
    } catch (error) {
      console.error(error);
    } finally {
      setAcaoRevisaoCiclo(null);
    }
  };

  // Concluir direto do CicloVisual (sem modal intermediário)
  const handleConcluirCicloDoVisual = () => setShowConclusaoModal(true);

  const canConcludeCiclo = ciclo?.ativo && progressoGeral >= 100 && isAllDisciplinesMet;
  const showEmptyMessage = !disciplinas.length;
  const showAssuntosCiclo = ciclo?.modoExibirAssuntos !== false;

  if (loading) return <div className="flex justify-center p-10"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-red-500"></div></div>;
  if (!ciclo) return <div className="p-10 text-center text-zinc-500">Ciclo não encontrado.</div>;

  let formattedStartDate = '...';
  if (ciclo.dataInicioAtual) {
      const start = new Date(ciclo.dataInicioAtual);
      formattedStartDate = start.toLocaleDateString('pt-BR', {day:'2-digit', month:'2-digit'});
  }

  const concluidos = ciclo.conclusoes || 0;

  // --- RENDERIZAÇÃO ---
  return (
    <div className="relative flex flex-col h-full animate-fade-in">
      <div className="mb-4">
          {/* HEADER SUPERIOR — botão "Concluir Missão" removido daqui, agora está no CicloVisual */}
          <div className="flex items-center justify-between mb-4">
              <button onClick={onBack} className="flex items-center gap-2 text-zinc-500 hover:text-zinc-800 dark:hover:text-white text-xs font-bold uppercase tracking-wider transition-colors"><ArrowLeft size={16} /> Voltar</button>
          </div>

          {/* CARD DO CICLO (RESUMO GERAL) */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-zinc-50 dark:bg-zinc-900 px-6 py-4 rounded-2xl border border-zinc-300 dark:border-zinc-800 shadow-sm relative overflow-hidden">
              {dynamicLogo ? (
                  <div className="absolute -bottom-4 -right-4 w-32 h-32 md:w-44 md:h-44 opacity-20 md:opacity-10 dark:opacity-30 dark:md:opacity-20 pointer-events-none transform rotate-[-10deg] z-0 filter saturate-150 transition-all duration-500">
                      <img src={dynamicLogo} alt="Logo Edital" className="w-full h-full object-contain" onError={(e) => { e.target.style.display = 'none'; }} />
                  </div>
              ) : (
                  <div className="absolute -bottom-4 -right-4 w-32 h-32 md:w-44 md:h-44 opacity-5 dark:opacity-10 pointer-events-none flex items-center justify-center">
                      <Shield size={120} className="text-zinc-400 dark:text-zinc-500" />
                  </div>
              )}

              <div className="flex-1 z-10">
                  <div className="flex flex-col gap-3">

                      {/* --- TÍTULO E BADGES --- */}
                      <div className="flex flex-wrap items-center gap-3">
                          <h1 className="text-3xl font-black text-zinc-900 dark:text-white uppercase tracking-tight leading-none">{ciclo.nome}</h1>
                          <div className="flex flex-wrap gap-2 items-center w-full sm:w-auto mt-1 sm:mt-0">

                            {/* Status Badge */}
                            {ciclo.ativo ? (
                                <span className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20 text-[10px] font-bold text-emerald-600 dark:text-emerald-500 uppercase tracking-widest">
                                    <span className="flex h-2 w-2 relative">
                                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                        <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                                    </span>
                                    Ativo
                                </span>
                            ) : (
                                <span className="px-2 py-0.5 rounded bg-zinc-200 dark:bg-zinc-800 text-[10px] font-bold text-zinc-500 uppercase">Arquivado</span>
                            )}

                            {/* --- RODA "CICLO" DE CONCLUSÕES --- */}
                            <div className={`flex items-center gap-2 pl-1.5 pr-3 py-1 rounded-lg border transition-all ${
                                concluidos > 0
                                ? 'bg-amber-50 dark:bg-amber-900/10 border-amber-500/20 shadow-[0_0_10px_rgba(245,158,11,0.1)]'
                                : 'bg-zinc-100 dark:bg-zinc-800/50 border-zinc-200 dark:border-zinc-700'
                            }`}>
                                <div className="relative flex items-center justify-center w-8 h-8 shrink-0">
                                    <motion.svg
                                        animate={{ rotate: 360 }}
                                        transition={{ repeat: Infinity, duration: 15, ease: "linear" }}
                                        className="absolute inset-0 w-full h-full"
                                        viewBox="0 0 100 100"
                                    >
                                        <circle
                                            cx="50" cy="50" r="44"
                                            fill="none" stroke="currentColor" strokeWidth="6"
                                            strokeDasharray="16 12" strokeLinecap="round"
                                            className={concluidos > 0 ? "text-amber-500/60" : "text-zinc-300 dark:text-zinc-600"}
                                        />
                                    </motion.svg>
                                    <div className={`absolute inset-0 flex items-center justify-center z-10 rounded-full ${
                                        concluidos > 0 ? 'text-amber-600 dark:text-amber-500' : 'text-zinc-500'
                                    }`}>
                                        <span className="text-xl font-black leading-none mt-[1px]">{concluidos}</span>
                                    </div>
                                </div>
                                <div className="flex flex-col justify-center ml-1">
                                    <span className="text-[8px] font-bold uppercase tracking-widest text-zinc-500 dark:text-zinc-400 leading-none mb-0.5">
                                        Ciclos
                                    </span>
                                    <span className={`text-[10px] font-black uppercase tracking-wide leading-none ${
                                        concluidos > 0 ? 'text-amber-600 dark:text-amber-500' : 'text-zinc-600 dark:text-zinc-400'
                                    }`}>
                                        Concluídos
                                    </span>
                                </div>
                            </div>

                          </div>
                      </div>

                      <div className="flex flex-col sm:flex-row gap-3 sm:gap-6 mt-1">
                        <div className="flex items-center gap-4">
                            <div className="flex items-center gap-1.5 text-zinc-400"><CalendarDays size={13} /><p className="text-[10px] font-bold uppercase tracking-wide">Início: <span className="text-zinc-600 dark:text-zinc-300">{formattedStartDate}</span></p></div>
                        </div>
                        <button onClick={onGoToEdital} className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white hover:bg-red-50 border border-zinc-200 hover:border-red-200 dark:bg-zinc-800 dark:hover:bg-red-900/10 dark:border-zinc-700 dark:hover:border-red-900/30 text-zinc-600 hover:text-red-700 dark:text-zinc-300 dark:hover:text-red-400 text-[11px] font-bold uppercase tracking-wide transition-all group w-fit shadow-sm z-20">
                            <BookOpen size={14} className="text-red-600 dark:text-red-500 group-hover:scale-110 transition-transform" /><span>Ir para o edital</span><ChevronRight size={12} className="opacity-60 group-hover:translate-x-1 transition-transform" />
                        </button>
                      </div>
                  </div>
              </div>

              <div className="flex items-center gap-6 z-10">
                  <div className="text-center hidden sm:block"><p className="text-[10px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-1">Meta</p><p className="text-xl font-black text-zinc-800 dark:text-white font-mono">{formatVisualNumber(totalMeta)}</p></div>
                  <div className="w-px h-10 bg-zinc-200 dark:bg-zinc-700 hidden sm:block"></div>
                  <div className="text-center hidden sm:block"><p className="text-[10px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-1">Feito</p><p className="text-xl font-black text-zinc-800 dark:text-white font-mono">{formatVisualNumber(totalEstudado)}</p></div>
                  <div className="relative">
                      <svg className="w-24 h-24 -rotate-90" viewBox="0 0 80 80">
                          <circle cx="40" cy="40" r="34" fill="none" stroke="currentColor" className="text-zinc-200 dark:text-zinc-800" strokeWidth="6" />
                          <motion.circle cx="40" cy="40" r="34" fill="none" stroke="currentColor" className={progressoGeral >= 100 && isAllDisciplinesMet ? 'text-emerald-500' : progressoGeral > 0 ? 'text-yellow-500' : 'text-zinc-400'} strokeWidth="6" strokeLinecap="round" strokeDasharray={2 * Math.PI * 34} initial={{ strokeDashoffset: 2 * Math.PI * 34 }} animate={{ strokeDashoffset: 2 * Math.PI * 34 * (1 - Math.min(progressoGeral, 100) / 100) }} transition={{ duration: 1.5, ease: "easeOut" }} />
                      </svg>
                      <div className="absolute inset-0 flex flex-col items-center justify-center"><span className={`text-xl font-black ${progressoGeral >= 100 && isAllDisciplinesMet ? 'text-emerald-500' : progressoGeral > 0 ? 'text-yellow-500' : 'text-zinc-400'}`}>{progressoGeral.toFixed(0)}%</span></div>
                  </div>
              </div>
          </div>

          {/* --- BARRA DE FERRAMENTAS --- */}
          <div className="flex items-center justify-between mt-8 mb-4 px-2">
              <h3 className="text-sm font-bold text-zinc-400 uppercase tracking-widest flex items-center gap-2">
                 <LayoutList size={16} /> Meu Progresso
              </h3>

              <div className="flex items-center gap-2">
                   <button
                      onClick={() => setShowTimerSettings(true)}
                      className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white hover:bg-red-50 border border-zinc-200 hover:border-red-200 dark:bg-zinc-800 dark:hover:bg-red-900/10 dark:border-zinc-700 dark:hover:border-red-900/30 text-zinc-600 hover:text-red-700 dark:text-zinc-300 dark:hover:text-red-400 text-[10px] font-bold uppercase tracking-wide transition-all group shadow-sm"
                      title="Configurar Cronômetro"
                  >
                      <Timer size={14} className="text-red-600 dark:text-red-500 group-hover:scale-110 transition-transform" />
                      <span className="hidden sm:inline">Configuração do Cronômetro</span>
                  </button>

                   <button
                      onClick={() => setShowHistoryModal(true)}
                      className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white hover:bg-red-50 border border-zinc-200 hover:border-red-200 dark:bg-zinc-800 dark:hover:bg-red-900/10 dark:border-zinc-700 dark:hover:border-red-900/30 text-zinc-600 hover:text-red-700 dark:text-zinc-300 dark:hover:text-red-400 text-[10px] font-bold uppercase tracking-wide transition-all group shadow-sm"
                      title="Ver Histórico Completo"
                  >
                      <History size={14} className="text-red-600 dark:text-red-500 group-hover:scale-110 transition-transform" />
                      <span className="hidden sm:inline">Histórico de Estudos</span>
                  </button>
              </div>
          </div>
      </div>

      {!showEmptyMessage && (
          <div className="flex-grow space-y-8">
              <CicloVisual
                  selectedDisciplinaId={selectedDisciplinaId}
                  onSelectDisciplina={setSelectedDisciplinaId}
                  onViewDetails={handleViewDetails}
                  onStartStudy={handleStartStudy}
                  disciplinas={disciplinas.map(d => ({ ...d, progressoEstudadoMinutos: registrosPorDisciplina[d.id] || 0 }))}
                  registrosEstudo={registrosAtivosDaSemana}
                  viewMode={'total'}
                  ciclo={ciclo}
                  showAssuntos={showAssuntosCiclo}
                  canConcludeCiclo={canConcludeCiclo}
                  onMarcarSessao={handleMarcarSessaoDoVisual}
                  onConcluirCiclo={handleConcluirCicloDoVisual}
                  cicloActionLoading={cicloActionLoading}
                  isResetAnimating={cicloResetAnimation}
              />

              <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-[1.2fr,0.8fr] lg:gap-10">
                  {/* COLUNA: GUIA DE ESTUDO DO DIA (A ESTRELA DA PÁGINA) */}
                  <div className="h-full">
                      <CardSessoesCicloHoje
                          ciclo={ciclo}
                          disciplinas={disciplinas}
                          onIniciarSessao={handleIniciarSessaoSugerida}
                          onToggleSessao={handleToggleSessaoSugerida}
                          onMarcarTeoriaPendente={handleMarcarTeoriaPendente}
                          loadingSessionId={loadingCicloSessao}
                          variant="cycle"
                          showAssuntos={showAssuntosCiclo}
                      />
                  </div>

                  {/* COLUNA: REVISÕES DO CICLO (SIDEBAR SLEEK) */}
                  <div className="space-y-4 lg:sticky lg:top-4 lg:space-y-6">
                      <div className="relative overflow-hidden rounded-2xl border border-zinc-200/60 bg-white/40 p-1 shadow-xl shadow-zinc-200/20 backdrop-blur-xl dark:border-zinc-800/40 dark:bg-zinc-950/20 dark:shadow-none sm:rounded-[32px] sm:shadow-2xl">
                         <div className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-blue-500/5 blur-3xl" />
                         
                         <CicloRevisoesOperacionaisCard
                            revisoesAtrasadas={revisoesAtrasadasCiclo}
                            revisoesHoje={revisoesDoDiaCiclo}
                            totalPendentes={totalPendentesRevisoesCiclo}
                            loading={loadingRevisoesCiclo}
                            acaoRevisao={acaoRevisaoCiclo}
                            onIniciar={handleIniciarRevisaoCiclo}
                            onConcluir={handleConcluirRevisaoCiclo}
                            onReagendar={handleReagendarRevisaoCiclo}
                        />
                      </div>
                      
                      {/* CARD ADICIONAL DE DICA ESTRATÉGICA (DANDO MAIS VIDA À PÁGINA) */}
                      <div className="relative overflow-hidden rounded-2xl bg-zinc-900 p-4 text-white shadow-xl sm:rounded-[28px] sm:p-6 group">
                          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-110 transition-transform">
                              <Trophy size={80} />
                          </div>
                          <div className="relative z-10">
                              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-red-600 mb-4">
                                  <Sparkles size={16} />
                              </div>
                              <h4 className="mb-1 text-sm font-black uppercase tracking-widest">Dica de Estudo</h4>
                              <p className="text-[11px] text-zinc-400 leading-relaxed">
                                  Tente manter o ritmo constante. Se uma materia estiver dificil, reduza o tempo, mas nao pule a sessao.
                              </p>
                          </div>
                      </div>
                  </div>
              </div>
          </div>
      )}

      {showEmptyMessage && (
        <div className="flex flex-col items-center justify-center py-20 text-center bg-zinc-50 dark:bg-zinc-900/50 rounded-3xl border-2 border-dashed border-zinc-200 dark:border-zinc-800 mt-8">
            <Target size={48} className="text-zinc-300 mb-4" />
            <h3 className="text-xl font-bold text-zinc-700 dark:text-zinc-300 mb-1">Ciclo Sem Disciplinas</h3>
            <p className="text-zinc-500 text-sm mb-6">Adicione matérias para começar.</p>
        </div>
      )}


      {/* Modais */}
      <AnimatePresence>
        {showTimerSettings && (
            <TimerSettingsModal
                isOpen={showTimerSettings}
                onClose={() => setShowTimerSettings(false)}
                onSave={updateSettings}
                className="md:max-h-[85vh] md:overflow-y-auto"
            />
        )}

        {showConclusaoModal && (
          <ModalConclusaoCiclo
            ciclo={ciclo}
            onClose={() => setShowConclusaoModal(false)}
            onConfirm={handleConcluirCiclo}
            loading={cicloActionLoading}
            progressoGeral={progressoGeral}
            revisoesPendentes={revisoesPendentesCiclo.length}
            revisoesAtrasadas={revisoesAtrasadasCiclo.length}
            revisoesHoje={revisoesDoDiaCiclo.length}
            revisoesProgramadas={revisoesProgramadasCiclo.length}
          />
        )}
        {disciplinaEmDetalhe && <DisciplinaDetalheModal disciplina={disciplinaEmDetalhe} registrosEstudo={registrosAtivosDaSemana} cicloId={cicloId} user={user.uid} onClose={() => { setDisciplinaEmDetalhe(null); setSelectedDisciplinaId(null); }} onQuickAddTopic={openRegistroModalWithTopic} />}
        {showRegistroModal && <RegistroEstudoModal onClose={() => setShowRegistroModal(false)} addRegistroEstudo={addRegistroEstudo} cicloId={cicloId} userId={user.uid} availableContexts={[{ type: 'ciclo', id: cicloId, label: 'Ciclo', disciplinas }]} defaultContext="ciclo" disciplinasDoCiclo={disciplinas} initialData={registroPreenchido} />}

        {showHistoryModal && (
            <HistoricoModal
                isOpen={showHistoryModal}
                onClose={() => setShowHistoryModal(false)}
                registros={registrosHistoricoCompleto}
                onDeleteRequest={(r) => setRecordToDelete(r)}
                onUpdateRecord={handleUpdateRegistro}
                title="Histórico do Ciclo"
                className="md:max-h-[85vh] md:overflow-y-auto"
            />
        )}

        {recordToDelete && <DeleteConfirmationModal isOpen={!!recordToDelete} onClose={() => setRecordToDelete(null)} onConfirm={handleConfirmDeleteRegistro} />}
      </AnimatePresence>
      <div className="h-12"></div>
    </div>
  );
}

export { CicloDetalhePage };
export default CicloDetalhePage;
