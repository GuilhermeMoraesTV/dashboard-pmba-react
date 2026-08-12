import React, { useState, useEffect, useMemo, useRef } from 'react';
import { db } from '../firebaseConfig';
import { doc, collection, query, orderBy, onSnapshot, deleteDoc, updateDoc, getDoc } from 'firebase/firestore';
import { AnimatePresence, motion } from 'framer-motion';
import { createPortal } from 'react-dom';

import CicloVisual, { CicloViewToggle } from '../components/ciclos/CicloVisual';
import RegistroEstudoModal from '../components/ciclos/RegistroEstudoModal';
import DisciplinaDetalheModal from '../components/ciclos/DisciplinaDetalheModal';
import ModalConclusaoCiclo from '../components/ciclos/ModalConclusaoCiclo';
import DailyGoalCompletedModal from '../components/shared/DailyGoalCompletedModal';
import HistoricoModal from '../components/dashboard/HistoricoModal';
import CicloEditModal from '../components/ciclos/CicloEditModal';
import TimerSettingsModal from '../components/ciclos/StudyTimer/TimerSettingsModal';
import { useCiclos } from '../hooks/useCiclos';
import { useCicloRevisoes } from '../hooks/useCicloRevisoes';
import CardSessoesCicloHoje from '../components/ciclos/CardSessoesCicloHoje';
import { formatDateKeyLocal } from '../services/scheduling/review';
import { buildCompletionRegistro } from '../utils/completionRegistro';
import { getCycleFreeQueue, getRegistroDateKey } from '../utils/studyDayStatus';
import { isCicloLegacyForGuide } from '../utils/cicloLegacyUpgrade';

import {
  ArrowLeft, Target, CalendarDays,
  BookOpen, ChevronRight, History, X, Trash2,
  AlertOctagon, Shield, LayoutList, RotateCw,
  Check, CheckCircle2, Clock3, Loader2, Play, CalendarPlus,
  Sparkles, Settings2, Cog, PlusCircle, Palette
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
const getDisciplinaOrderValue = (disciplina, fallbackIndex = 9999) => {
  const value = disciplina?.index ?? disciplina?.ordem ?? disciplina?.position ?? disciplina?.posicao ?? disciplina?.ordemDisciplina;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallbackIndex;
};

const sortDisciplinasByEditalOrder = (disciplinas = []) => (
  [...disciplinas].sort((a, b) => {
    const orderA = getDisciplinaOrderValue(a, a.__sourceOrder ?? 9999);
    const orderB = getDisciplinaOrderValue(b, b.__sourceOrder ?? 9999);
    if (orderA !== orderB) return orderA - orderB;
    const sourceA = Number(a.__sourceOrder ?? 9999);
    const sourceB = Number(b.__sourceOrder ?? 9999);
    if (sourceA !== sourceB) return sourceA - sourceB;
    return (a.nome || '').localeCompare(b.nome || '');
  }).map(({ __sourceOrder, ...disciplina }) => disciplina)
);

const DeleteConfirmationModal = ({ isOpen, onClose, onConfirm, loading }) => {
    if (!isOpen || typeof document === 'undefined') return null;
    return createPortal(
        <div className="fixed inset-0 z-[100120] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
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
        </div>,
        document.body
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

const CicloLegacyUpgradeModal = ({ ciclo, logoUrl, onClose, onConfirm, onRecalculate, loading }) => {
  const [nome, setNome] = useState(() => ciclo?.nome || '');
  const [dataFim, setDataFim] = useState(() => ciclo?.dataFim || ciclo?.dataFechamento || ciclo?.dataArquivamento || '');
  const [modoExibirAssuntos, setModoExibirAssuntos] = useState(() => ciclo?.modoExibirAssuntos !== false);
  const [coresDisciplinasAtivas, setCoresDisciplinasAtivas] = useState(() => ciclo?.coresDisciplinasAtivas !== false);

  const handleSubmit = () => {
    onConfirm({
      nome: nome.trim() || ciclo?.nome || 'Meu ciclo',
      dataFim: dataFim || null,
      modoExibirAssuntos,
      coresDisciplinasAtivas,
    });
  };

  return createPortal(
    <div className="fixed inset-0 z-[20000] flex items-center justify-center bg-zinc-950/70 px-3 py-3 backdrop-blur-sm sm:px-4">
      <motion.div
        initial={{ opacity: 0, y: 16, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 16, scale: 0.98 }}
        className="relative flex max-h-[calc(100dvh-24px)] w-full max-w-4xl flex-col overflow-hidden rounded-[32px] border border-zinc-200 bg-zinc-50 shadow-2xl dark:border-zinc-800 dark:bg-zinc-950"
      >
        <div className="relative overflow-hidden border-b border-zinc-200 bg-white px-4 py-4 dark:border-zinc-800 dark:bg-zinc-900 sm:px-6">
          {logoUrl && (
            <img
              src={logoUrl}
              alt=""
              aria-hidden="true"
              className="pointer-events-none absolute -bottom-12 -right-5 h-40 w-40 rotate-[-12deg] object-contain opacity-[0.06] saturate-0 dark:opacity-[0.08]"
            />
          )}
          <div className="relative z-10 flex items-start justify-between gap-4">
            <div className="flex min-w-0 items-start gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-red-600 text-white shadow-lg shadow-red-600/20">
                <Settings2 size={21} strokeWidth={2.5} />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] font-black uppercase tracking-[0.22em] text-red-600">Edicao simples</p>
                <h2 className="mt-0.5 text-xl font-black uppercase tracking-tight text-zinc-900 dark:text-white">Ajustes rapidos</h2>
                <p className="mt-1 max-w-xl text-xs font-semibold leading-relaxed text-zinc-500 dark:text-zinc-400">Atualize os detalhes visuais do ciclo sem redistribuir sessoes, dias ou disciplinas.</p>
              </div>
            </div>
            <button onClick={onClose} className="shrink-0 rounded-2xl border border-zinc-200 bg-zinc-50 p-2 text-zinc-400 transition hover:border-red-200 hover:bg-red-50 hover:text-red-600 dark:border-zinc-800 dark:bg-zinc-950 dark:hover:border-red-900/50 dark:hover:bg-red-950/20">
              <X size={18} />
            </button>
          </div>
        </div>

        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-3 dark:bg-zinc-950 sm:p-4">
            <div className="grid gap-3 md:grid-cols-2">
              <label className="group block rounded-3xl border border-zinc-100 bg-white p-4 shadow-sm transition-all focus-within:border-red-200 focus-within:ring-4 focus-within:ring-red-500/5 dark:border-zinc-800 dark:bg-zinc-900">
                <span className="flex items-center gap-3 text-[10px] font-black uppercase tracking-wider text-zinc-500">
                  <span className="flex h-9 w-9 items-center justify-center rounded-2xl bg-zinc-50 text-red-600 dark:bg-zinc-800"><Cog size={15} /></span>
                  Nome do planejamento
                </span>
                <input
                  value={nome}
                  onChange={(event) => setNome(event.target.value)}
                  className="mt-3 h-11 w-full rounded-2xl border-2 border-zinc-200 bg-zinc-50 px-4 text-sm font-black text-zinc-900 outline-none transition-all focus:border-red-500 focus:bg-white dark:border-zinc-700 dark:bg-zinc-950 dark:text-white"
                  placeholder="Ex: Ciclo PMBA"
                />
              </label>

              <label className="group block rounded-3xl border border-zinc-100 bg-white p-4 shadow-sm transition-all focus-within:border-red-200 focus-within:ring-4 focus-within:ring-red-500/5 dark:border-zinc-800 dark:bg-zinc-900">
                <span className="flex items-center gap-3 text-[10px] font-black uppercase tracking-wider text-zinc-500">
                  <span className="flex h-9 w-9 items-center justify-center rounded-2xl bg-zinc-50 text-red-600 dark:bg-zinc-800"><CalendarDays size={15} /></span>
                  Data de termino
                </span>
                <input
                  type="date"
                  value={dataFim}
                  onChange={(event) => setDataFim(event.target.value)}
                  className="mt-3 h-11 w-full rounded-2xl border-2 border-zinc-200 bg-zinc-50 px-4 text-sm font-black text-zinc-900 outline-none transition-all focus:border-red-500 focus:bg-white dark:border-zinc-700 dark:bg-zinc-950 dark:text-white"
                />
              </label>
            </div>

            <label className={`flex items-center justify-between gap-4 rounded-3xl border bg-white p-4 shadow-sm transition-all dark:bg-zinc-900 ${modoExibirAssuntos ? 'border-red-200 ring-4 ring-red-500/5 dark:border-red-900/50' : 'border-zinc-100 dark:border-zinc-800'}`}>
              <div>
                <div className="flex items-center gap-3">
                  <span className={`flex h-9 w-9 items-center justify-center rounded-2xl ${modoExibirAssuntos ? 'bg-red-600 text-white' : 'bg-zinc-50 text-zinc-400 dark:bg-zinc-800'}`}><BookOpen size={15} /></span>
                  <p className="text-[10px] font-black uppercase tracking-wider text-zinc-900 dark:text-white">Guia por assunto</p>
                </div>
                <p className="mt-2 text-[11px] font-semibold leading-relaxed text-zinc-500">Mostra disciplina e assunto sugerido em cada sessao.</p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={modoExibirAssuntos}
                onClick={() => setModoExibirAssuntos((current) => !current)}
                className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${modoExibirAssuntos ? 'bg-red-600' : 'bg-zinc-300 dark:bg-zinc-700'}`}
              >
                <span className={`absolute top-1 h-4 w-4 rounded-full bg-white shadow transition-all ${modoExibirAssuntos ? 'right-1' : 'left-1'}`} />
              </button>
            </label>

            <label className={`flex items-center justify-between gap-4 rounded-3xl border bg-white p-4 shadow-sm transition-all dark:bg-zinc-900 ${coresDisciplinasAtivas ? 'border-red-200 ring-4 ring-red-500/5 dark:border-red-900/50' : 'border-zinc-100 dark:border-zinc-800'}`}>
              <div>
                <div className="flex items-center gap-3">
                  <span className={`flex h-9 w-9 items-center justify-center rounded-2xl ${coresDisciplinasAtivas ? 'bg-red-600 text-white' : 'bg-zinc-50 text-zinc-400 dark:bg-zinc-800'}`}><Palette size={15} /></span>
                  <p className="text-[10px] font-black uppercase tracking-wider text-zinc-900 dark:text-white">Cores no radar</p>
                </div>
                <p className="mt-2 text-[11px] font-semibold leading-relaxed text-zinc-500">Desligue para mostrar os blocos em cinza.</p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={coresDisciplinasAtivas}
                onClick={() => setCoresDisciplinasAtivas((current) => !current)}
                className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${coresDisciplinasAtivas ? 'bg-red-600' : 'bg-zinc-300 dark:bg-zinc-700'}`}
              >
                <span className={`absolute top-1 h-4 w-4 rounded-full bg-white shadow transition-all ${coresDisciplinasAtivas ? 'right-1' : 'left-1'}`} />
              </button>
            </label>
        </div>

        <div className="flex items-center justify-between gap-2 border-t border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900 sm:p-4">
          <button
            onClick={onRecalculate}
            className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-zinc-200 px-3 py-2.5 text-[9px] font-black uppercase text-zinc-600 transition hover:bg-white dark:border-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-900"
          >
            <Settings2 size={13} />
            Recalcular planejamento
          </button>
          <div className="flex items-center gap-2">
            <button onClick={onClose} className="rounded-xl border border-zinc-200 px-3 py-2.5 text-[9px] font-black uppercase text-zinc-500 transition hover:bg-white dark:border-zinc-800 dark:hover:bg-zinc-900">
              Agora nao
            </button>
            <button
              onClick={handleSubmit}
              disabled={loading}
              className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-red-600 px-3 py-2.5 text-[9px] font-black uppercase text-white shadow-lg shadow-red-600/20 transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
              Salvar ajustes
            </button>
          </div>
        </div>
      </motion.div>
    </div>,
    document.body
  );
};

const CicloRevisoesShortcutButton = ({
  totalAtrasadas,
  totalHoje,
  totalPendentes,
  loading,
  onClick,
}) => {
  const hasAtrasadas = totalAtrasadas > 0;
  const hasHoje = totalHoje > 0;
  const hasPendentes = totalPendentes > 0;
  const tone = hasAtrasadas ? 'red' : hasHoje ? 'blue' : hasPendentes ? 'amber' : 'emerald';
  const title = hasAtrasadas
    ? 'Revisoes atrasadas'
    : hasHoje
      ? 'Revisoes para hoje'
      : hasPendentes
        ? 'Revisoes programadas'
        : 'Revisoes em dia';
  const subtitle = hasAtrasadas
    ? `${totalAtrasadas} atrasada${totalAtrasadas === 1 ? '' : 's'} precisam de atencao`
    : hasHoje
      ? `${totalHoje} para fazer hoje`
      : hasPendentes
        ? `${totalPendentes} no ciclo`
        : 'Nenhuma pendencia agora';

  const styles = {
    red: {
      shell: 'border-red-200/80 bg-red-50/90 text-red-700 shadow-red-500/10 hover:border-red-300 dark:border-red-900/40 dark:bg-red-950/20 dark:text-red-300',
      icon: 'bg-red-600 text-white shadow-red-600/25',
      badge: 'bg-red-600 text-white',
    },
    blue: {
      shell: 'border-blue-200/80 bg-blue-50/90 text-blue-700 shadow-blue-500/10 hover:border-blue-300 dark:border-blue-900/40 dark:bg-blue-950/20 dark:text-blue-300',
      icon: 'bg-blue-600 text-white shadow-blue-600/25',
      badge: 'bg-blue-600 text-white',
    },
    amber: {
      shell: 'border-amber-200/80 bg-amber-50/90 text-amber-700 shadow-amber-500/10 hover:border-amber-300 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-300',
      icon: 'bg-amber-500 text-white shadow-amber-500/25',
      badge: 'bg-amber-500 text-white',
    },
    emerald: {
      shell: 'border-emerald-200/80 bg-emerald-50/90 text-emerald-700 shadow-emerald-500/10 hover:border-emerald-300 dark:border-emerald-900/40 dark:bg-emerald-950/20 dark:text-emerald-300',
      icon: 'bg-emerald-500 text-white shadow-emerald-500/25',
      badge: 'bg-emerald-500 text-white',
    },
  }[tone];

  return (
    <button
      type="button"
      onClick={onClick}
      className={`group flex w-full items-center justify-between gap-3 rounded-2xl border px-3 py-2.5 text-left shadow-lg transition-all hover:-translate-y-0.5 sm:px-4 ${styles.shell}`}
    >
      <div className="flex min-w-0 items-center gap-3">
        <div className={`relative flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl shadow-lg ${styles.icon}`}>
          {loading ? <Loader2 size={17} className="animate-spin" /> : <RotateCw size={17} />}
          {(hasAtrasadas || hasHoje) && (
            <span className="absolute -right-0.5 -top-0.5 h-3 w-3 rounded-full border-2 border-white bg-white dark:border-zinc-950">
              <span className={`block h-full w-full animate-pulse rounded-full ${hasAtrasadas ? 'bg-red-500' : 'bg-blue-500'}`} />
            </span>
          )}
        </div>
        <div className="min-w-0">
          <p className="truncate text-[10px] font-black uppercase tracking-[0.2em] opacity-70">Atalho de revisao</p>
          <p className="truncate text-sm font-black text-zinc-900 dark:text-white">{title}</p>
          <p className="truncate text-[11px] font-bold opacity-75">{subtitle}</p>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <span className={`flex h-8 min-w-8 items-center justify-center rounded-full px-2 text-xs font-black tabular-nums shadow-sm ${styles.badge}`}>
          {loading ? '...' : totalAtrasadas + totalHoje}
        </span>
        <ChevronRight size={18} className="opacity-60 transition-transform group-hover:translate-x-0.5" />
      </div>
    </button>
  );
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

  if (!loading && todas.length === 0) return null;

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
                const tempoPlanejado = Number(rev.tempoMinutos || rev.tempoPlanejadoMinutos || 20);
                const tempoFeitoRaw = Number(rev.progressoMinutos || 0);
                const tempoFeito = rev.concluida || rev.concluido ? Math.max(tempoFeitoRaw, tempoPlanejado) : tempoFeitoRaw;
                const desmarcarBloqueado = (rev.concluida || rev.concluido) && Boolean(rev.bloqueiaDesmarcar || rev.bloqueiaDesmarcarConclusao);

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
                      <p className="mt-1 flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wide text-blue-600 dark:text-blue-300">
                        <Clock3 size={10} />
                        {formatVisualNumber(tempoFeito)} / {formatVisualNumber(tempoPlanejado)}
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
                        onClick={() => {
                          if (desmarcarBloqueado) return;
                          onConcluir?.(rev);
                        }}
                        disabled={Boolean(acaoRevisao) || desmarcarBloqueado}
                        className={`flex h-8 items-center gap-1.5 rounded-xl px-3 text-[10px] font-black uppercase tracking-wider text-white shadow-md transition-all disabled:opacity-60 dark:bg-white dark:text-zinc-900 ${desmarcarBloqueado ? 'cursor-not-allowed bg-emerald-600' : 'bg-zinc-900 hover:bg-emerald-500 dark:hover:bg-emerald-400'}`}
                        title="Concluir revisão"
                      >
                        {isConcluirLoading ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} strokeWidth={3} />}
                        {desmarcarBloqueado ? 'Registrada' : 'Concluir'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-emerald-200/50 bg-emerald-50/30 p-5 text-center backdrop-blur-sm dark:border-emerald-900/30 dark:bg-emerald-950/20 sm:rounded-[32px] sm:p-8">
              <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-500 text-white shadow-lg shadow-emerald-500/20 sm:mb-4 sm:h-16 sm:w-16 sm:rounded-2xl">
                <CheckCircle2 size={24} className="sm:h-8 sm:w-8" />
              </div>
              <h3 className="text-sm font-black uppercase text-emerald-800 dark:text-emerald-400 sm:text-lg">
                Tudo em dia!
              </h3>
              <p className="mt-2 max-w-sm text-xs text-emerald-600/70 dark:text-emerald-400/60 sm:text-sm">
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
export function CicloDetalhePage({ cicloId, onBack, user, addRegistroEstudo, deleteCompletionRegistro, onDeleteRegistro, onStartStudy, onGoToEdital, onGoToRevisao, onCreateNewCycle, onRegistroModalOpenChange, registrosEstudo: registrosEstudoExterno = null }) {
  const [ciclo, setCiclo] = useState(null);
  const [disciplinas, setDisciplinas] = useState([]);
  const [allRegistrosEstudo, setAllRegistrosEstudo] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showRegistroModal, setShowRegistroModal] = useState(false);
  const [registroPreenchido, setRegistroPreenchido] = useState(null);
  const [disciplinaEmDetalhe, setDisciplinaEmDetalhe] = useState(null);
  const [selectedDisciplinaId, setSelectedDisciplinaId] = useState(null);
  const [showConclusaoModal, setShowConclusaoModal] = useState(false);
  const [dailyGoalModalData, setDailyGoalModalData] = useState(null);
  const [pendingDailyGoalModalData, setPendingDailyGoalModalData] = useState(null);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [showUpgradeWizard, setShowUpgradeWizard] = useState(false);
  const [configMenuOpen, setConfigMenuOpen] = useState(false);
  const [showTimerSettings, setShowTimerSettings] = useState(false);
  const [cycleViewMode, setCycleViewMode] = useState('completo');
  const [loadingCicloSessoes, setLoadingCicloSessoes] = useState({});
  const [loadingTeoriaSessao, setLoadingTeoriaSessao] = useState(null);
  const [sessionCompletionOverrides, setSessionCompletionOverrides] = useState({});
  const [acaoRevisaoCiclo, setAcaoRevisaoCiclo] = useState(null);
  const [cicloResetAnimation, setCicloResetAnimation] = useState(false);
  const [optimisticReviewDone, setOptimisticReviewDone] = useState({});
  const previousDailyGoalDoneRef = useRef(null);
  const dailyGoalShownRef = useRef(new Set());
  const configMenuRef = useRef(null);

  useEffect(() => {
    onRegistroModalOpenChange?.(showRegistroModal);
    return () => onRegistroModalOpenChange?.(false);
  }, [onRegistroModalOpenChange, showRegistroModal]);
  // ESTADO DA LOGO DINÃ‚MICA
  const [dynamicLogo, setDynamicLogo] = useState(null);

  const [recordToDelete, setRecordToDelete] = useState(null);
  const hasBlockingModalOpen = Boolean(
    showConclusaoModal
    || showRegistroModal
    || disciplinaEmDetalhe
    || showHistoryModal
    || showUpgradeModal
    || showUpgradeWizard
    || showTimerSettings
    || recordToDelete
  );

  const {
    concluirCicloSemanal,
    marcarSessaoConcluida,
    salvarPendenciaTeoriaCiclo,
    limparPendenciaTeoriaCiclo,
    atualizarCicloLegadoParaGuia,
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
  const cicloLegadoParaGuia = useMemo(() => isCicloLegacyForGuide(ciclo), [ciclo]);

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
  // UseEffects de carregamento de dados
  useEffect(() => { if (!user || !cicloId) return; const cicloRef = doc(db, 'users', user.uid, 'ciclos', cicloId); const unsubscribe = onSnapshot(cicloRef, (docSnap) => { if (docSnap.exists()) { const data = docSnap.data(); const rawDate = (data.ultimaConclusao?.toDate) ? data.ultimaConclusao.toDate() : (data.dataCriacao?.toDate ? data.dataCriacao.toDate() : new Date()); const cicloCompleto = { id: docSnap.id, ...data, cargaHorariaSemanalTotal: Number(data.cargaHorariaSemanalTotal || 0), conclusoes: Number(data.conclusoes || 0), dataInicioAtual: rawDate }; setCiclo(cicloCompleto); setCicloLoaded(true); } else { setCiclo(null); setCicloLoaded(true); } }, (error) => { console.error("Erro no snapshot do ciclo:", error); setCicloLoaded(true); }); return () => unsubscribe(); }, [user, cicloId]);
  useEffect(() => { if (!user || !cicloId) return; const q = query(collection(db, 'users', user.uid, 'ciclos', cicloId, 'disciplinas')); const unsubscribe = onSnapshot(q, (snap) => { setDisciplinas(sortDisciplinasByEditalOrder(snap.docs.map((doc, __sourceOrder) => ({ id: doc.id, ...doc.data(), __sourceOrder })))); setDisciplinasLoaded(true); }, (error) => { console.error(error); setDisciplinasLoaded(true); }); return () => unsubscribe(); }, [user, cicloId]);
  useEffect(() => {
    if (Array.isArray(registrosEstudoExterno)) {
      setAllRegistrosEstudo(registrosEstudoExterno);
      setRegistrosLoaded(true);
      return undefined;
    }
    if (!user) return undefined;
    const q = query(collection(db, 'users', user.uid, 'registrosEstudo'), orderBy('timestamp', 'desc'));
    const unsubscribe = onSnapshot(q, (snap) => {
      setAllRegistrosEstudo(snap.docs.map(doc => {
        const data = doc.data();
        const finalDataStr = data.data;
        return {
          id: doc.id,
          ...data,
          tempoEstudadoMinutos: Number(data.tempoEstudadoMinutos || 0),
          questoesFeitas: Number(data.questoesFeitas || 0),
          acertos: Number(data.acertos || 0),
          data: finalDataStr,
          timestamp: (data.timestamp && typeof data.timestamp.toDate === 'function') ? data.timestamp.toDate() : new Date(0),
        };
      }));
      setRegistrosLoaded(true);
    }, (error) => {
      console.error(error);
      setRegistrosLoaded(true);
    });
    return () => unsubscribe();
  }, [user, registrosEstudoExterno]);
  useEffect(() => { if (cicloLoaded && disciplinasLoaded && registrosLoaded) setLoading(false); }, [cicloLoaded, disciplinasLoaded, registrosLoaded]);
  useEffect(() => {
    if (!cicloLegadoParaGuia || !cicloId) return;
    try {
      const pendingUpgradeId = sessionStorage.getItem('modoqap_open_cycle_upgrade');
      if (pendingUpgradeId === cicloId) {
        sessionStorage.removeItem('modoqap_open_cycle_upgrade');
        setShowUpgradeWizard(true);
      }
    } catch {}
  }, [cicloId, cicloLegadoParaGuia]);
  useEffect(() => {
    const handleOpenUpgrade = (event) => {
      const requestedId = event?.detail?.cicloId;
      if (cicloLegadoParaGuia && (!requestedId || requestedId === cicloId)) setShowUpgradeWizard(true);
    };
    window.addEventListener('modoqap:open-cycle-upgrade', handleOpenUpgrade);
    return () => window.removeEventListener('modoqap:open-cycle-upgrade', handleOpenUpgrade);
  }, [cicloId, cicloLegadoParaGuia]);
  useEffect(() => {
    if (!cicloResetAnimation) return undefined;
    const timeoutId = window.setTimeout(() => setCicloResetAnimation(false), 2600);
    return () => window.clearTimeout(timeoutId);
  }, [cicloResetAnimation]);
  useEffect(() => {
    if (!configMenuOpen) return undefined;
    const handlePointerDown = (event) => {
      if (configMenuRef.current && !configMenuRef.current.contains(event.target)) {
        setConfigMenuOpen(false);
      }
    };
    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, [configMenuOpen]);

  // Cálculos
  const registrosAtivosDaSemana = useMemo(() => allRegistrosEstudo.filter(reg => reg.cicloId === cicloId && !reg.conclusaoId), [allRegistrosEstudo, cicloId]);
  const registrosHistoricoCompleto = useMemo(() => allRegistrosEstudo.filter(reg => reg.cicloId === cicloId), [allRegistrosEstudo, cicloId]);
  const totalAcumuladoCiclo = useMemo(() => registrosHistoricoCompleto.reduce(
    (total, registro) => total + Math.max(0, Number(registro.tempoEstudadoMinutos || registro.duracaoMinutos || 0)),
    0,
  ), [registrosHistoricoCompleto]);
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
  const revisoesDoDiaCicloVisiveis = useMemo(() => (
    revisoesDoDiaCiclo.map((rev) => (
      Object.prototype.hasOwnProperty.call(optimisticReviewDone, rev.id)
        ? { ...rev, concluida: optimisticReviewDone[rev.id], concluido: optimisticReviewDone[rev.id] }
        : rev
    ))
  ), [optimisticReviewDone, revisoesDoDiaCiclo]);
  const revisoesAtrasadasCicloVisiveis = useMemo(() => (
    revisoesAtrasadasCiclo.map((rev) => (
      Object.prototype.hasOwnProperty.call(optimisticReviewDone, rev.id)
        ? { ...rev, concluida: optimisticReviewDone[rev.id], concluido: optimisticReviewDone[rev.id] }
        : rev
    ))
  ), [optimisticReviewDone, revisoesAtrasadasCiclo]);
  const { totalEstudado, totalMeta, progressoGeral, registrosPorDisciplina } = useMemo(() => { if (!disciplinas.length) return { totalEstudado: 0, totalMeta: 0, progressoGeral: 0, registrosPorDisciplina: {} }; const totalMetaRaw = disciplinas.reduce((acc, d) => acc + Number(d.tempoAlocadoSemanalMinutos || 0), 0); const totalMetaCalc = Math.round(totalMetaRaw); const registrosPorDisciplina = {}; let totalEstudadoCalc = 0; registrosAtivosDaSemana.forEach(reg => { const minutos = Number(reg.tempoEstudadoMinutos); totalEstudadoCalc += minutos; const discId = reg.disciplinaId; if (discId) registrosPorDisciplina[discId] = (registrosPorDisciplina[discId] || 0) + minutos; }); const prog = totalMetaCalc > 0 ? (totalEstudadoCalc / totalMetaCalc) * 100 : 0; return { totalEstudado: Math.round(totalEstudadoCalc), totalMeta: totalMetaCalc, progressoGeral: prog, registrosPorDisciplina }; }, [disciplinas, registrosAtivosDaSemana]);
  const isAllDisciplinesMet = useMemo(() => { if (!ciclo?.ativo || !disciplinas.length || totalMeta === 0) return false; return disciplinas.every(d => { const meta = Number(d.tempoAlocadoSemanalMinutos || 0); const feito = registrosPorDisciplina[d.id] || 0; return meta > 0 ? feito >= meta : true; }); }, [disciplinas, registrosPorDisciplina, ciclo?.ativo, totalMeta]);
  const hojeKey = useMemo(() => formatDateKeyLocal(new Date()), []);
  const cicloGuideHoje = useMemo(() => {
    if (!ciclo?.id) return { sessions: [], plannedMinutes: 0, isRestDay: false };
    return getCycleFreeQueue({ ...ciclo, disciplinas }, allRegistrosEstudo);
  }, [allRegistrosEstudo, ciclo, disciplinas]);
  const estudosDiaConcluidos = false;
  const registrosHojeCiclo = useMemo(() => (
    allRegistrosEstudo.filter((registro) => (
      getRegistroDateKey(registro) === hojeKey
      && String(registro.cicloId || '') === String(cicloId || '')
      && !registro.cronogramaId
    ))
  ), [allRegistrosEstudo, cicloId, hojeKey]);

  useEffect(() => {
    if (loading || !ciclo?.id) return;
    const modalKey = `ciclo:${ciclo.id}:${hojeKey}`;
    const wasDone = previousDailyGoalDoneRef.current;
    previousDailyGoalDoneRef.current = estudosDiaConcluidos;
    if (wasDone === null || !estudosDiaConcluidos || wasDone === true || dailyGoalShownRef.current.has(modalKey)) return;

    dailyGoalShownRef.current.add(modalKey);
    const plannedMinutes = (cicloGuideHoje.sessions || []).reduce(
      (acc, sessao) => acc + Number(sessao.tempoPlanejadoMinutos || ciclo?.tempoSessaoMinutos || 50),
      0
    );
    const minutes = (cicloGuideHoje.sessions || []).reduce(
      (acc, sessao) => acc + Number(sessao.progressoMinutos || 0),
      0
    );
    const questions = registrosHojeCiclo.reduce((acc, registro) => acc + Number(registro.questoesFeitas || 0), 0);
    const correct = registrosHojeCiclo.reduce((acc, registro) => acc + Number(registro.acertos || registro.questoesAcertadas || 0), 0);

    const nextModalData = {
      contextLabel: 'Ciclo do dia',
      planName: ciclo.nome || 'Ciclo ativo',
      editalName: ciclo.editalNome || ciclo.titulo || ciclo.nome || 'Ciclo ativo',
      editalLogo: dynamicLogo || ciclo.logoUrl || ciclo.logo || null,
      minutes,
      plannedMinutes,
      questions,
      correct,
    };
    if (hasBlockingModalOpen) {
      setPendingDailyGoalModalData(nextModalData);
      return;
    }
    setDailyGoalModalData(nextModalData);
  }, [ciclo, cicloGuideHoje, dynamicLogo, estudosDiaConcluidos, hasBlockingModalOpen, hojeKey, loading, registrosHojeCiclo]);

  useEffect(() => {
    if (!pendingDailyGoalModalData || hasBlockingModalOpen || dailyGoalModalData) return;
    setDailyGoalModalData(pendingDailyGoalModalData);
    setPendingDailyGoalModalData(null);
  }, [dailyGoalModalData, hasBlockingModalOpen, pendingDailyGoalModalData]);

  const applyLocalSessionCompletion = (sessaoGlobalIndex, done) => {
    const idx = Number(sessaoGlobalIndex);
    if (!Number.isFinite(idx)) return;
    setSessionCompletionOverrides((prev) => ({ ...prev, [idx]: Boolean(done) }));
  };

  useEffect(() => {
    setSessionCompletionOverrides((prev) => {
      const entries = Object.entries(prev);
      if (entries.length === 0) return prev;
      const next = { ...prev };
      let changed = false;
      entries.forEach(([rawIndex, expected]) => {
        if (loadingCicloSessoes?.[rawIndex]) return;
        const session = cicloGuideHoje.sessions.find((item) => Number(item.globalIndex) === Number(rawIndex));
        if (session && Boolean(session.concluida) === expected) {
          delete next[rawIndex];
          changed = true;
        }
      });
      return changed ? next : prev;
    });
  }, [cicloGuideHoje.sessions, loadingCicloSessoes]);

  // Handlers
  const handleConfirmDeleteRegistro = async () => {
    if (!recordToDelete) return;
    const record = recordToDelete;
    setRecordToDelete(null);
    if (onDeleteRegistro) await onDeleteRegistro(record.id);
    else await deleteDoc(doc(db,'users',user.uid,'registrosEstudo', record.id));
  };
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
    const resetOverrides = Object.fromEntries(
      (Array.isArray(ciclo?.ordemSessoes) ? ciclo.ordemSessoes : []).map((_, index) => [index, false])
    );
    setSessionCompletionOverrides(resetOverrides);
    setSelectedDisciplinaId(null);
    setCicloResetAnimation(false);
    window.setTimeout(() => {
      window.requestAnimationFrame(() => setCicloResetAnimation(true));
    }, 180);
  };
  const persistSessionToggle = async (sessaoGlobalIndex, sessao = null) => {
    const sessionIndex = Number(sessaoGlobalIndex);
    if (!sessao || !Number.isFinite(sessionIndex) || loadingCicloSessoes?.[sessionIndex]) return;
    const completionOverride = sessionCompletionOverrides?.[sessionIndex];
    const wasDone = typeof completionOverride === 'boolean'
      ? completionOverride
      : Boolean(
        sessao.concluida
        || sessao.concluido
        || ciclo?.sessoesConcluidas?.map(Number).includes(sessionIndex)
      );
    const completionRegistro = buildCompletionRegistro({
      context: 'ciclo',
      item: { ...sessao, globalIndex: sessionIndex },
      ciclo: { ...ciclo, disciplinas },
      fallbackMinutes: ciclo?.tempoSessaoMinutos || 50,
    });

    applyLocalSessionCompletion(sessionIndex, !wasDone);
    setLoadingCicloSessoes((prev) => ({ ...prev, [sessionIndex]: true }));
    try {
      // Ao desmarcar, remova primeiro o registro sintetico. Assim ele nao
      // reativa o mesmo bloco enquanto o snapshot do ciclo esta chegando.
      if (wasDone && deleteCompletionRegistro) {
        await deleteCompletionRegistro(completionRegistro);
      }
      const ok = await marcarSessaoConcluida(cicloId, sessionIndex, {
        tempoPlanejadoMinutos: sessao.tempoPlanejadoMinutos || sessao.tempoMinutos,
      });
      if (!ok) {
        applyLocalSessionCompletion(sessionIndex, wasDone);
        return;
      }
      if (!wasDone && addRegistroEstudo) {
        await addRegistroEstudo(completionRegistro);
      }
      const disciplinaId = sessao.disciplina?.id || sessao.disciplinaId;
      if (disciplinaId) limparPendenciaTeoriaCiclo(cicloId, disciplinaId).catch(console.error);
    } catch (error) {
      applyLocalSessionCompletion(sessionIndex, wasDone);
      console.error('Erro ao atualizar bloco do ciclo:', error);
    } finally {
      setLoadingCicloSessoes((prev) => {
        const next = { ...prev };
        delete next[sessionIndex];
        return next;
      });
    }
  };
  const handleMarcarSessaoDoVisual = async (sessaoGlobalIndex, sessao = null) => {
    await persistSessionToggle(sessaoGlobalIndex, sessao);
  };
  const handleIniciarSessaoSugerida = (disciplina, globalIndex, sessao = null) => {
    if (onStartStudy) {
      onStartStudy(disciplina, sessao?.assuntoSugerido?.nome || null, {
        defaultContext: 'ciclo',
        sessaoGlobalIndex: globalIndex,
        tempoPlanejadoMinutos: sessao?.tempoPlanejadoMinutos || sessao?.tempoMinutos,
      });
    }
  };
  const handleToggleSessaoSugerida = async (sessao) => {
    if (!sessao) return;
    await persistSessionToggle(sessao.globalIndex, sessao);
  };
  const handleMarcarTeoriaPendente = async (sessao) => {
    const assuntoAtual = sessao?.assuntoSugerido?.nome || '';
    if (!sessao?.disciplinaId || !assuntoAtual || loadingTeoriaSessao !== null) return;
    setLoadingTeoriaSessao(sessao.globalIndex);
    try {
      await salvarPendenciaTeoriaCiclo({
        cicloId,
        disciplinaId: sessao.disciplinaId,
        assuntoAtual,
        minutosAcumulados: 0,
      });
    } finally {
      setLoadingTeoriaSessao(null);
    }
  };
  const handleConfirmUpgrade = async (config) => {
    if (!user?.uid || !cicloId) return;
    try {
      await updateDoc(doc(db, 'users', user.uid, 'ciclos', cicloId), {
        nome: config.nome || ciclo?.nome || 'Meu ciclo',
        dataFim: config.dataFim || null,
        modoExibirAssuntos: config.modoExibirAssuntos !== false,
        coresDisciplinasAtivas: config.coresDisciplinasAtivas !== false,
      });
      setShowUpgradeModal(false);
    } catch (error) {
      console.error('Erro ao salvar ajustes simples do ciclo:', error);
    }
  };
  const handleIniciarRevisaoCiclo = (revisao) => {
    if (!onStartStudy || !revisao) return;
    onStartStudy(
      { id: revisao.disciplinaId || revisao.id || revisao.revisaoKey, nome: revisao.disciplinaNome || 'Disciplina' },
      revisao.assunto || null,
      { defaultContext: 'ciclo', tipoRegistro: 'revisao' }
    );
  };
  const handleConcluirRevisaoCiclo = async (revisao) => {
    if (!revisao?.id || acaoRevisaoCiclo) return;
    const wasDone = Boolean(revisao.concluida || revisao.concluido);
    if (wasDone && revisao.bloqueiaDesmarcar) return;
    setOptimisticReviewDone(prev => ({ ...prev, [revisao.id]: !wasDone }));
    setAcaoRevisaoCiclo({ id: revisao.id, tipo: 'concluir' });
    try {
      await concluirRevisaoCiclo(revisao.id, !wasDone);
      const completionRegistro = buildCompletionRegistro({
          context: 'ciclo',
          item: revisao,
          ciclo: { ...ciclo, disciplinas },
          isReview: true,
          fallbackMinutes: 20,
        });
      if (!wasDone && addRegistroEstudo) {
        await addRegistroEstudo(completionRegistro);
      } else if (wasDone && deleteCompletionRegistro) {
        await deleteCompletionRegistro(completionRegistro);
      }
    } catch (error) {
      setOptimisticReviewDone(prev => ({ ...prev, [revisao.id]: wasDone }));
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
  const handleGoToRevisoesCiclo = () => {
    onGoToRevisao?.();
  };

  // Concluir direto do CicloVisual (sem modal intermediário)
  const handleConcluirCicloDoVisual = () => setShowConclusaoModal(true);

  const canConcludeCiclo = ciclo?.ativo && progressoGeral >= 100 && isAllDisciplinesMet;
  const showEmptyMessage = !disciplinas.length;
  const showAssuntosCiclo = ciclo?.modoExibirAssuntos !== false;

  if (loading) return <div className="min-h-[calc(100vh-120px)]" />;
  if (!ciclo) return <div className="p-10 text-center text-zinc-500">Ciclo não encontrado.</div>;

  let formattedStartDate = '...';
  if (ciclo.dataInicioAtual) {
      const start = new Date(ciclo.dataInicioAtual);
      formattedStartDate = start.toLocaleDateString('pt-BR', {day:'2-digit', month:'2-digit'});
  }
  let formattedEndDate = ciclo.ativo ? 'Em aberto' : '...';
  const cicloEndDate = ciclo.dataFim || ciclo.dataFechamento || ciclo.dataArquivamento || null;
  if (cicloEndDate) {
      const end = cicloEndDate?.toDate ? cicloEndDate.toDate() : new Date(cicloEndDate);
      if (!Number.isNaN(end.getTime())) {
          formattedEndDate = end.toLocaleDateString('pt-BR', {day:'2-digit', month:'2-digit'});
      }
  }

  const concluidos = ciclo.conclusoes || 0;

  if (showUpgradeWizard) {
    return (
      <CicloEditModal
        onClose={() => setShowUpgradeWizard(false)}
        user={user}
        ciclo={ciclo}
        upgradeMode={true}
      />
    );
  }

  // --- RENDERIZAÇÃO ---
  return (
    <div className="desktop-page-zoom desktop-page-zoom--ciclo mobile-page-zoom mobile-page-zoom--ciclo relative flex min-h-[calc(100vh-120px)] flex-col animate-fade-in">
      <div className="mb-4">
          {/* HEADER SUPERIOR — botão "Concluir Missão" removido daqui, agora está no CicloVisual */}
          <div className="flex items-center justify-between mb-4">
              <button onClick={onBack} className="flex items-center gap-2 text-zinc-500 hover:text-zinc-800 dark:hover:text-white text-xs font-bold uppercase tracking-wider transition-colors"><ArrowLeft size={16} /> Voltar</button>
          </div>

          {cicloLegadoParaGuia && (
              <div className="mb-4 overflow-hidden rounded-2xl border border-red-200 bg-gradient-to-br from-red-50 via-white to-zinc-50 p-4 shadow-sm dark:border-red-900/40 dark:from-red-950/30 dark:via-zinc-950/60 dark:to-zinc-900/60">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                      <div className="flex min-w-0 gap-3">
                          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-red-600 text-white shadow-lg shadow-red-600/20">
                              <Sparkles size={20} />
                          </div>
                          <div className="min-w-0">
                              <p className="text-[10px] font-black uppercase tracking-[0.24em] text-red-600 dark:text-red-400">Plataforma atualizada</p>
                              <h2 className="mt-1 text-base font-black text-zinc-950 dark:text-white">Atualize seu ciclo para ativar o guia por assunto</h2>
                              <p className="mt-1 max-w-3xl text-sm font-medium text-zinc-600 dark:text-zinc-400">
                                  Seu edital, disciplinas, assuntos e historico serao mantidos. A atualizacao adiciona apenas a rotina do guia de estudos.
                              </p>
                          </div>
                      </div>
                      <div className="flex flex-col gap-2 sm:flex-row">
                          <button
                              onClick={() => setShowUpgradeWizard(true)}
                              className="inline-flex items-center justify-center gap-2 rounded-xl bg-red-600 px-4 py-2.5 text-xs font-black uppercase tracking-wider text-white shadow-lg shadow-red-600/20 transition hover:bg-red-700"
                          >
                              <Settings2 size={14} />
                              Atualizar ciclo
                          </button>
                          <button
                              onClick={onCreateNewCycle}
                              className="inline-flex items-center justify-center gap-2 rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-xs font-black uppercase tracking-wider text-zinc-600 transition hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
                          >
                              <PlusCircle size={14} />
                              Criar novo do zero
                          </button>
                      </div>
                  </div>
              </div>
          )}

          {/* CARD DO CICLO (RESUMO GERAL) */}
          <div className="flex flex-row items-center justify-between gap-2 bg-zinc-50 dark:bg-zinc-900 px-3 py-2 sm:px-4 md:gap-5 md:px-5 md:py-3 rounded-2xl border border-zinc-300 dark:border-zinc-800 shadow-sm relative overflow-hidden">
              {dynamicLogo ? (
                  <div className="absolute -bottom-2 right-1 h-20 w-20 opacity-25 pointer-events-none transform rotate-[-10deg] z-0 filter saturate-150 transition-all duration-500 dark:opacity-35 md:-bottom-4 md:-right-4 md:h-44 md:w-44 md:opacity-20">
                      <img src={dynamicLogo} alt="Logo Edital" className="w-full h-full object-contain" onError={(e) => { e.target.style.display = 'none'; }} />
                  </div>
              ) : (
                  <div className="absolute -bottom-4 -right-4 w-32 h-32 md:w-44 md:h-44 opacity-10 dark:opacity-20 pointer-events-none flex items-center justify-center">
                      <Shield size={120} className="text-zinc-400 dark:text-zinc-500" />
                  </div>
              )}

              <div className="min-w-0 flex-1 z-10">
                  <div className="flex flex-col gap-3">
                      <div className="flex flex-col gap-1.5 md:gap-3">
                          {ciclo.ativo ? (
                              <span className="flex w-fit items-center gap-1.5 rounded border border-emerald-500/20 bg-emerald-500/10 px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-widest text-emerald-600 dark:text-emerald-500 md:px-2 md:text-[10px]">
                                  <span className="relative flex h-1.5 w-1.5 md:h-2 md:w-2">
                                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
                                      <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500 md:h-2 md:w-2"></span>
                                  </span>
                                  Ativo
                              </span>
                          ) : (
                              <span className="w-fit rounded bg-zinc-200 px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-widest text-zinc-500 dark:bg-zinc-800 md:px-2 md:text-[10px]">Arquivado</span>
                          )}
                          <div className="flex min-w-0 items-center gap-2 md:gap-3">
                              <h1 className="min-w-0 truncate text-sm font-black text-zinc-900 dark:text-white uppercase tracking-tight leading-none sm:text-lg md:text-3xl">{ciclo.nome}</h1>
                              <button onClick={onGoToEdital} className="flex shrink-0 items-center gap-1 rounded-lg border border-zinc-200 bg-white/90 px-2 py-1 text-[8px] font-black uppercase tracking-widest text-zinc-600 shadow-sm transition-all hover:border-red-200 hover:bg-red-50 hover:text-red-700 dark:border-zinc-700 dark:bg-zinc-800/90 dark:text-zinc-300 dark:hover:border-red-900/30 dark:hover:bg-red-900/10 dark:hover:text-red-400 md:gap-2 md:px-3 md:py-1.5 md:text-[11px]">
                                  <BookOpen size={11} className="text-red-600 dark:text-red-500 md:h-3.5 md:w-3.5" />
                                  EDITAL
                              </button>
                              <div className={`hidden items-center gap-1 rounded-lg border px-1.5 py-1 transition-all sm:flex md:gap-2 md:pl-1.5 md:pr-3 ${
                                  concluidos > 0
                                  ? 'bg-amber-50 dark:bg-amber-900/10 border-amber-500/20 shadow-[0_0_10px_rgba(245,158,11,0.1)]'
                                  : 'bg-zinc-100 dark:bg-zinc-800/50 border-zinc-200 dark:border-zinc-700'
                              }`}>
                                  <div className="relative flex h-6 w-6 shrink-0 items-center justify-center md:h-8 md:w-8">
                                      <motion.svg animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 15, ease: "linear" }} className="absolute inset-0 w-full h-full" viewBox="0 0 100 100">
                                          <circle cx="50" cy="50" r="44" fill="none" stroke="currentColor" strokeWidth="6" strokeDasharray="16 12" strokeLinecap="round" className={concluidos > 0 ? "text-amber-500/60" : "text-zinc-300 dark:text-zinc-600"} />
                                      </motion.svg>
                                      <div className={`absolute inset-0 z-10 flex items-center justify-center rounded-full ${concluidos > 0 ? 'text-amber-600 dark:text-amber-500' : 'text-zinc-500'}`}>
                                          <span className="text-sm font-black leading-none md:text-xl">{concluidos}</span>
                                      </div>
                                  </div>
                                  <div className="hidden flex-col justify-center ml-1 md:flex">
                                      <span className="text-[8px] font-bold uppercase tracking-widest text-zinc-500 dark:text-zinc-400 leading-none mb-0.5">Ciclos</span>
                                      <span className={`text-[10px] font-black uppercase tracking-wide leading-none ${concluidos > 0 ? 'text-amber-600 dark:text-amber-500' : 'text-zinc-600 dark:text-zinc-400'}`}>Concluídos</span>
                                  </div>
                              </div>
                          </div>
                          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-zinc-400">
                            <div className="flex items-center gap-1"><CalendarDays size={10} className="md:h-3.5 md:w-3.5" /><p className="text-[8px] font-bold uppercase tracking-wide md:text-[10px]">Início: <span className="text-zinc-600 dark:text-zinc-300">{formattedStartDate}</span></p></div>
                            <div className="flex items-center gap-1"><Target size={10} className="md:h-3.5 md:w-3.5" /><p className="text-[8px] font-bold uppercase tracking-wide md:text-[10px]">Final: <span className="text-zinc-600 dark:text-zinc-300">{formattedEndDate}</span></p></div>
                          </div>
                      </div>

                      {/* --- TÍTULO E BADGES --- */}
                      <div className="hidden min-w-0 items-center gap-2 md:flex-wrap md:gap-3">
                          <h1 className="min-w-0 truncate text-sm font-black text-zinc-900 dark:text-white uppercase tracking-tight leading-none sm:text-lg md:text-3xl">{ciclo.nome}</h1>
                          <div className="flex shrink-0 items-center gap-1.5 md:flex-wrap md:gap-2">

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
                            <div className={`flex items-center gap-1 px-1.5 py-1 rounded-lg border transition-all md:gap-2 md:pl-1.5 md:pr-3 ${
                                concluidos > 0
                                ? 'bg-amber-50 dark:bg-amber-900/10 border-amber-500/20 shadow-[0_0_10px_rgba(245,158,11,0.1)]'
                                : 'bg-zinc-100 dark:bg-zinc-800/50 border-zinc-200 dark:border-zinc-700'
                            }`}>
                                <div className="relative flex h-6 w-6 shrink-0 items-center justify-center md:h-8 md:w-8">
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
                                        <span className="text-sm font-black leading-none md:text-xl">{concluidos}</span>
                                    </div>
                                </div>
                                <div className="hidden flex-col justify-center ml-1 sm:flex">
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

                      <div className="mt-1 hidden flex-col gap-3 sm:flex-row sm:gap-6">
                        <div className="flex items-center gap-4">
                            <div className="flex items-center gap-1.5 text-zinc-400"><CalendarDays size={13} /><p className="text-[10px] font-bold uppercase tracking-wide">Início: <span className="text-zinc-600 dark:text-zinc-300">{formattedStartDate}</span></p></div>
                        </div>
                        <button onClick={onGoToEdital} className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white hover:bg-red-50 border border-zinc-200 hover:border-red-200 dark:bg-zinc-800 dark:hover:bg-red-900/10 dark:border-zinc-700 dark:hover:border-red-900/30 text-zinc-600 hover:text-red-700 dark:text-zinc-300 dark:hover:text-red-400 text-[11px] font-bold uppercase tracking-wide transition-all group w-fit shadow-sm z-20">
                            <BookOpen size={14} className="text-red-600 dark:text-red-500 group-hover:scale-110 transition-transform" /><span>Ir para o edital</span><ChevronRight size={12} className="opacity-60 group-hover:translate-x-1 transition-transform" />
                        </button>
                      </div>
                  </div>
              </div>

              <div className="z-10 flex w-[132px] shrink-0 items-center justify-between gap-1.5 rounded-xl border border-zinc-200 bg-white/75 p-1.5 shadow-sm dark:border-zinc-800 dark:bg-zinc-950/55 sm:w-[164px] md:w-auto md:min-w-[286px] md:gap-3 md:p-2.5">
                  <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2 md:gap-5">
                          <div>
                              <p className="text-[7px] font-black uppercase tracking-wider text-zinc-400 md:text-[8px] md:tracking-widest">Meta</p>
                              <p className="font-mono text-[10px] font-black text-zinc-900 dark:text-white md:text-sm">{formatVisualNumber(totalMeta)}</p>
                          </div>
                          <div className="text-right">
                              <p className="text-[7px] font-black uppercase tracking-wider text-zinc-400 md:text-[8px] md:tracking-widest">Feito</p>
                              <p className="font-mono text-[10px] font-black text-zinc-900 dark:text-white md:text-sm">{formatVisualNumber(totalEstudado)}</p>
                          </div>
                      </div>
                      <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-zinc-100 ring-1 ring-zinc-200/70 dark:bg-zinc-800 dark:ring-zinc-700/70 md:mt-2 md:h-1.5">
                          <motion.div
                              initial={false}
                              animate={{ width: `${Math.min(progressoGeral, 100)}%` }}
                              transition={{ duration: 0.45, ease: 'easeOut' }}
                              className={`h-full rounded-full ${progressoGeral >= 100 && isAllDisciplinesMet ? 'bg-gradient-to-r from-emerald-500 to-teal-400' : 'bg-gradient-to-r from-red-600 via-rose-500 to-orange-400'}`}
                          />
                      </div>
                      <div className="mt-1.5 flex min-w-0 items-center justify-between gap-2 rounded-md bg-red-50/90 px-1.5 py-1 dark:bg-red-950/20 md:mt-2 md:px-2">
                          <span className="min-w-0 truncate text-[6px] font-black uppercase tracking-wide text-red-500 md:text-[8px]">Total do ciclo</span>
                          <span className="shrink-0 font-mono text-[9px] font-black text-red-700 dark:text-red-300 md:text-xs">{formatVisualNumber(totalAcumuladoCiclo)}</span>
                      </div>
                  </div>
                  <div className="relative shrink-0">
                      <svg className="h-9 w-9 -rotate-90 sm:h-10 sm:w-10 md:h-14 md:w-14" viewBox="0 0 80 80">
                          <circle cx="40" cy="40" r="34" fill="none" stroke="currentColor" className="text-zinc-200 dark:text-zinc-800" strokeWidth="6" />
                          <motion.circle cx="40" cy="40" r="34" fill="none" stroke="currentColor" className={progressoGeral >= 100 && isAllDisciplinesMet ? 'text-emerald-500' : progressoGeral > 0 ? 'text-yellow-500' : 'text-zinc-400'} strokeWidth="6" strokeLinecap="round" strokeDasharray={2 * Math.PI * 34} initial={{ strokeDashoffset: 2 * Math.PI * 34 }} animate={{ strokeDashoffset: 2 * Math.PI * 34 * (1 - Math.min(progressoGeral, 100) / 100) }} transition={{ duration: 1.5, ease: "easeOut" }} />
                      </svg>
                      <div className="absolute inset-0 flex flex-col items-center justify-center"><span className={`text-[9px] font-black sm:text-[10px] md:text-sm ${progressoGeral >= 100 && isAllDisciplinesMet ? 'text-emerald-500' : progressoGeral > 0 ? 'text-yellow-500' : 'text-zinc-400'}`}>{progressoGeral.toFixed(0)}%</span></div>
                  </div>
              </div>
          </div>

          {/* --- BARRA DE FERRAMENTAS --- */}
          <div className="flex items-center justify-between mt-4 mb-2 px-2 md:mt-5">
              <h3 className="text-sm font-bold text-zinc-400 uppercase tracking-widest flex items-center gap-2">
                 <LayoutList size={16} /> Meu Progresso
              </h3>

              <div className="flex items-center gap-1">
                  <div className="relative" ref={configMenuRef}>
                      <button
                          onClick={() => setConfigMenuOpen((open) => !open)}
                          className="group flex h-8 w-8 items-center justify-center rounded-lg border border-red-600 bg-red-600 text-[9px] font-bold uppercase tracking-wide text-white shadow-sm shadow-red-600/20 transition-all hover:bg-red-700 sm:w-auto sm:gap-1.5 sm:px-2.5"
                          title="Configuração de ciclo"
                      >
                          <Cog size={14} className="group-hover:rotate-45 transition-transform" />
                          <span className="hidden sm:inline">Configurar</span>
                      </button>

                      <AnimatePresence>
                          {configMenuOpen && (
                              <motion.div
                                  initial={{ opacity: 0, y: -6, scale: 0.98 }}
                                  animate={{ opacity: 1, y: 0, scale: 1 }}
                                  exit={{ opacity: 0, y: -6, scale: 0.98 }}
                                  className="absolute right-0 top-full z-40 mt-2 w-[264px] overflow-hidden rounded-2xl border border-zinc-200/80 bg-white/95 p-2 shadow-[0_18px_55px_-22px_rgba(0,0,0,0.45)] ring-1 ring-white/70 backdrop-blur-xl dark:border-zinc-800 dark:bg-zinc-950/95 dark:ring-white/5"
                              >
                                  <div className="pointer-events-none absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-red-500/10 to-transparent" />
                                  <div className="relative mb-1.5 flex items-center gap-2.5 px-2 py-1.5">
                                      <span className="flex h-7 w-7 items-center justify-center rounded-lg border border-red-200/70 bg-red-50 text-red-600 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-400">
                                          <Cog size={13} />
                                      </span>
                                      <span>
                                          <span className="block text-[9px] font-black uppercase tracking-[0.18em] text-zinc-900 dark:text-white">Configurar ciclo</span>
                                          <span className="mt-0.5 block text-[8px] font-semibold text-zinc-400">Escolha como deseja ajustar</span>
                                      </span>
                                  </div>
                                  <button
                                      type="button"
                                      onClick={() => {
                                          setConfigMenuOpen(false);
                                          setShowTimerSettings(true);
                                      }}
                                      className="group relative mt-1.5 flex w-full items-center gap-2.5 rounded-xl border border-zinc-200/80 bg-white p-2.5 text-left transition-all duration-200 hover:-translate-y-0.5 hover:border-zinc-300 hover:bg-zinc-50 hover:shadow-md hover:shadow-zinc-900/5 dark:border-zinc-800 dark:bg-zinc-900/70 dark:hover:border-zinc-700 dark:hover:bg-zinc-900"
                                  >
                                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-zinc-100 text-zinc-700 shadow-sm dark:bg-zinc-800 dark:text-zinc-200"><Clock3 size={14} /></span>
                                      <span className="min-w-0 flex-1">
                                          <span className="block text-[10px] font-black uppercase tracking-wide text-zinc-900 dark:text-white">Configurar timer</span>
                                          <span className="mt-0.5 block text-[10px] font-medium leading-snug text-zinc-500 dark:text-zinc-400">Ajuste modo, foco, descanso, cor e sons do cronometro.</span>
                                      </span>
                                      <ChevronRight size={14} className="shrink-0 text-zinc-300 transition-transform group-hover:translate-x-0.5 group-hover:text-zinc-700 dark:text-zinc-700 dark:group-hover:text-zinc-300" />
                                  </button>
                                  <button
                                      type="button"
                                      onClick={() => {
                                          setConfigMenuOpen(false);
                                          setShowUpgradeWizard(true);
                                      }}
                                      className="group relative mt-1.5 flex w-full items-center gap-2.5 rounded-xl border border-zinc-200/80 bg-zinc-50/80 p-2.5 text-left transition-all duration-200 hover:-translate-y-0.5 hover:border-zinc-300 hover:bg-white hover:shadow-md hover:shadow-zinc-900/5 dark:border-zinc-800 dark:bg-zinc-900/60 dark:hover:border-zinc-700 dark:hover:bg-zinc-900"
                                  >
                                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-zinc-900 text-white shadow-sm dark:bg-white dark:text-zinc-950"><RotateCw size={14} /></span>
                                      <span className="min-w-0 flex-1">
                                          <span className="block text-[10px] font-black uppercase tracking-wide text-zinc-900 dark:text-white">Recalcular</span>
                                          <span className="mt-0.5 block text-[10px] font-medium leading-snug text-zinc-500 dark:text-zinc-400">Refaça rotina, matérias e distribuição pelo assistente.</span>
                                      </span>
                                      <ChevronRight size={14} className="shrink-0 text-zinc-300 transition-transform group-hover:translate-x-0.5 group-hover:text-zinc-700 dark:text-zinc-700 dark:group-hover:text-zinc-300" />
                                  </button>
                              </motion.div>
                          )}
                      </AnimatePresence>
                  </div>

                  <button
                      onClick={() => setShowHistoryModal(true)}
                      className="group flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-200 bg-white text-[9px] font-bold uppercase tracking-wide text-zinc-600 shadow-sm transition-all hover:border-red-200 hover:bg-red-50 hover:text-red-700 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:border-red-900/30 dark:hover:bg-red-900/10 dark:hover:text-red-400 sm:w-auto sm:gap-1.5 sm:px-2.5"
                      title="Ver Histórico Completo"
                  >
                      <History size={14} className="text-red-600 dark:text-red-500 group-hover:scale-110 transition-transform" />
                      <span className="hidden sm:inline">Histórico</span>
                  </button>
              </div>
          </div>
      </div>

      {!showEmptyMessage && (
          <div className="-mx-2 min-h-0 sm:-mx-4 md:-mx-6 lg:-mx-8">
              <div className="grid min-h-0 grid-cols-1 items-stretch gap-3 xl:grid-cols-[minmax(0,1.08fr)_minmax(380px,0.62fr)] 2xl:grid-cols-[minmax(0,1.12fr)_minmax(410px,0.64fr)]">
                  <section className="ciclo-visual-card-shell relative flex h-full w-full flex-col overflow-hidden rounded-2xl border border-zinc-200/70 bg-white/80 px-2.5 py-2.5 shadow-lg shadow-zinc-200/30 backdrop-blur-xl dark:border-zinc-800/70 dark:bg-zinc-950/35 dark:shadow-none sm:px-4 sm:py-3">
                      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-red-500/40 to-transparent" />
                      <div className="relative mb-2 flex items-center justify-between gap-2 px-1 sm:px-2">
                          <div className="min-w-0">
                              <p className="text-[9px] font-black uppercase tracking-[0.24em] text-red-600 dark:text-red-400">Ciclo de Estudos</p>
                              <h2 className="mt-0.5 whitespace-nowrap text-sm font-black uppercase tracking-tight text-zinc-900 dark:text-white sm:text-lg">Mapa visual do ciclo</h2>
                          </div>
                          <div className="flex shrink-0 items-center gap-2">
                              <CicloViewToggle value={cycleViewMode} onChange={setCycleViewMode} className="p-1" />
                          </div>
                      </div>

                      <div className="ciclo-visual-card-stage relative flex flex-1 items-stretch justify-center">
                          <CicloVisual
                              selectedDisciplinaId={selectedDisciplinaId}
                              onSelectDisciplina={setSelectedDisciplinaId}
                              onViewDetails={handleViewDetails}
                              onStartStudy={handleStartStudy}
                              disciplinas={disciplinas.map(d => ({ ...d, progressoEstudadoMinutos: registrosPorDisciplina[d.id] || 0 }))}
                              registrosEstudo={registrosAtivosDaSemana}
                              viewMode={'total'}
                              ciclo={ciclo}
                              showAssuntos={false}
                              canConcludeCiclo={canConcludeCiclo}
                              onMarcarSessao={handleMarcarSessaoDoVisual}
                              onConcluirCiclo={handleConcluirCicloDoVisual}
                              cicloActionLoading={cicloActionLoading}
                              isResetAnimating={cicloResetAnimation}
                              viewCiclo={cycleViewMode}
                              onViewCicloChange={setCycleViewMode}
                              showViewToggle={false}
                              sessionCompletionOverrides={sessionCompletionOverrides}
                              loadingSessionIds={loadingCicloSessoes}
                          />
                      </div>
                  </section>

                  <aside className="cycle-detail-blocks-column min-w-0 max-w-full space-y-4 overflow-hidden xl:flex xl:min-h-0 xl:flex-col xl:space-y-4 xl:pr-1">
                  {/* COLUNA: GUIA DE ESTUDO DO DIA (A ESTRELA DA PÁGINA) */}
                  <div className="space-y-3 xl:order-1 xl:flex xl:min-h-0 xl:flex-1 xl:flex-col xl:space-y-3">
                      <div className="xl:shrink-0">
                      <CicloRevisoesShortcutButton
                          totalAtrasadas={revisoesAtrasadasCiclo.length}
                          totalHoje={revisoesDoDiaCicloVisiveis.length}
                          totalPendentes={totalPendentesRevisoesCiclo}
                          loading={loadingRevisoesCiclo}
                          onClick={handleGoToRevisoesCiclo}
                      />
                      </div>
                        <div className="xl:min-h-0 xl:flex-1">
                        <CardSessoesCicloHoje
                            ciclo={ciclo}
                            disciplinas={disciplinas}
                            onIniciarSessao={handleIniciarSessaoSugerida}
                            onToggleSessao={handleToggleSessaoSugerida}
                            loadingSessionIds={loadingCicloSessoes}
                            useDisciplineColors={ciclo?.coresDisciplinasAtivas !== false}
                            registrosEstudo={allRegistrosEstudo}
                            fillAvailableHeight
                            sessionCompletionOverrides={sessionCompletionOverrides}
                        />
                        </div>
                  </div>

                   </aside>
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
        {showConclusaoModal && (
          <ModalConclusaoCiclo
            ciclo={ciclo}
            onClose={() => setShowConclusaoModal(false)}
            onConfirm={handleConcluirCiclo}
            loading={cicloActionLoading}
            progressoGeral={progressoGeral}
            disciplinas={disciplinas}
            registrosSemana={registrosAtivosDaSemana}
            totalEstudado={totalEstudado}
            totalMeta={totalMeta}
            revisoesPendentes={revisoesPendentesCiclo.length}
            revisoesAtrasadas={revisoesAtrasadasCiclo.length}
            revisoesHoje={revisoesDoDiaCiclo.length}
            revisoesProgramadas={revisoesProgramadasCiclo.length}
            editalLogo={dynamicLogo || ciclo?.logoUrl || ciclo?.logo || null}
            editalName={ciclo?.editalNome || ciclo?.titulo || ciclo?.nome || 'Ciclo ativo'}
          />
        )}
        {disciplinaEmDetalhe && <DisciplinaDetalheModal disciplina={disciplinaEmDetalhe} registrosEstudo={registrosAtivosDaSemana} cicloId={cicloId} user={user.uid} onClose={() => { setDisciplinaEmDetalhe(null); setSelectedDisciplinaId(null); }} onQuickAddTopic={openRegistroModalWithTopic} />}
        {showRegistroModal && <RegistroEstudoModal onClose={() => setShowRegistroModal(false)} addRegistroEstudo={addRegistroEstudo} cicloId={cicloId} userId={user.uid} availableContexts={[{ type: 'ciclo', id: cicloId, label: 'Ciclo', disciplinas }]} defaultContext="ciclo" disciplinasDoCiclo={disciplinas} initialData={registroPreenchido} />}

        {showUpgradeModal && (
            <CicloLegacyUpgradeModal
                ciclo={ciclo}
                disciplinas={disciplinas}
                registros={allRegistrosEstudo}
                logoUrl={dynamicLogo}
                onClose={() => setShowUpgradeModal(false)}
                onConfirm={handleConfirmUpgrade}
                onRecalculate={() => {
                  setShowUpgradeModal(false);
                  setShowUpgradeWizard(true);
                }}
                loading={cicloActionLoading}
            />
        )}

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
      <DailyGoalCompletedModal
        open={Boolean(dailyGoalModalData)}
        onClose={() => setDailyGoalModalData(null)}
        {...(dailyGoalModalData || {})}
      />
      <TimerSettingsModal
        isOpen={showTimerSettings}
        onClose={() => setShowTimerSettings(false)}
        userUid={user?.uid}
      />
      <div className="h-12"></div>
    </div>
  );
}

export default CicloDetalhePage;

