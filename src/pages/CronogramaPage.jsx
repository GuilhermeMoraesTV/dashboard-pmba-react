import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  ChevronLeft, ChevronRight, Play, CheckCircle2, Hourglass,
  Layers, Bookmark, Plus, Zap, Map as MapIcon, CalendarDays, Shield,
  TrendingUp, Target, SkipForward, Trash2, AlertTriangle, X,
  BookOpen, Clock, Star, Flame, BarChart2, Sun, LayoutList,
  GripVertical, Calendar, LayoutGrid, Check, MoreHorizontal,
  BadgeCheck, Loader2, Trophy, History, Cog, RefreshCw, Printer,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { createPortal } from 'react-dom';
import {
  DndContext, DragOverlay, PointerSensor, closestCorners, pointerWithin, rectIntersection,
  useDroppable, useSensor, useSensors,
} from '@dnd-kit/core';
import {
  SortableContext, arrayMove, useSortable, verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  collection, query, where, onSnapshot,
  writeBatch, doc, updateDoc, getDoc, getDocs, limit,
  deleteDoc,
} from 'firebase/firestore';
import { db } from '../firebaseConfig';
import CronogramaCreateWizard from '../components/cronograma/WizardShell';
import ModalEditarCronograma from '../components/cronograma/ModalEditarCronograma';
import TimerSettingsModal from '../components/ciclos/StudyTimer/TimerSettingsModal';
import HistoricoModal from '../components/dashboard/HistoricoModal';
import { useCronogramaSystem, getAgendaSemana, chaveAssuntoDominado } from '../hooks/useCronogramaSystem';
import { buildCompletionRegistro } from '../utils/completionRegistro';
import { getDisciplineCardVars, getDisciplineColor, getDisciplineColorForSlot } from '../utils/disciplineColors';
import { openCronogramaWeekPdf } from './CronogramaWeekPdf';
import { resolveLogoUrl } from '../components/admin/config/editalAssets';
import DailyGoalCompletedModal from '../components/shared/DailyGoalCompletedModal.jsx';
import { getCronogramaSlotRecordedMinutes } from '../utils/studyDayStatus';
import {
  REGISTRO_PROGRESS_OPTIMISTIC_EVENT,
  applyCronogramaRegistroProgress,
} from '../services/reviewOptimisticUpdates';

// --- CONSTANTES ---------------------------------------------------------------
const MESES_PT   = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
const MESES_FULL = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
const DIAS_CURTO = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];
const DIAS_LONGO = ['Domingo','Segunda','Terça','Quarta','Quinta','Sexta','Sábado'];
const INTERVALOS_REVISAO = [1, 7, 30];
const getCronogramaTemplateId = (cronograma) => (
  cronograma?.editalId
  || cronograma?.templateId
  || cronograma?.templateOrigem
  || cronograma?.templateOrigemId
  || cronograma?.editalBaseId
  || null
);

// --- UTILITÁRIOS --------------------------------------------------------------
const getCalendarDays = (year, month) => {
  const first    = new Date(year, month, 1);
  const last     = new Date(year, month + 1, 0);
  const days     = [];
  const prevLast = new Date(year, month, 0).getDate();
  for (let i = first.getDay() - 1; i >= 0; i--)
    days.push({ day: prevLast - i, type: 'prev', date: new Date(year, month - 1, prevLast - i) });
  for (let i = 1; i <= last.getDate(); i++)
    days.push({ day: i, type: 'current', date: new Date(year, month, i) });
  while (days.length < 42)
    days.push({ day: days.length - first.getDay() - last.getDate() + 1, type: 'next', date: new Date(year, month + 1, days.length - first.getDay() - last.getDate() + 1) });
  return days;
};

const getDocTimestamp = (d) => {
  const ts = d.criadoEm || d.dataCriacao;
  if (!ts) return 0;
  if (ts?.toDate)  return ts.toDate().getTime();
  if (ts?.seconds) return ts.seconds * 1000;
  return new Date(ts).getTime();
};

const formatarDuracao = (minutos = 0) => {
  if (!minutos || minutos <= 0) return '0m';
  if (minutos < 60) return `${minutos}m`;
  const h = Math.floor(minutos / 60);
  const m = minutos % 60;
  return m > 0 ? `${h}h${String(m).padStart(2, '0')}` : `${h}h`;
};

const dateToYMDLocal = (date) => {
  const d = new Date(date);
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().split('T')[0];
};

const getRegistroDateKey = (registro) => {
  if (registro?.data) return registro.data;
  if (registro?.dataRegistro) return registro.dataRegistro;
  if (registro?.timestamp?.toDate) return dateToYMDLocal(registro.timestamp.toDate());
  if (registro?.createdAt?.toDate) return dateToYMDLocal(registro.createdAt.toDate());
  return null;
};

const formatarDataHeader = (data) => {
  if (!data) return '...';
  const d = typeof data === 'string' ? new Date(`${data}T12:00:00`) : new Date(data);
  if (Number.isNaN(d.getTime())) return '...';
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
};

const getDateForWeekSlot = (weekStart, diaSemanaAbsoluto) => {
  const inicio = new Date(weekStart);
  const diaInicio = inicio.getDay();
  let delta = Number(diaSemanaAbsoluto) - diaInicio;
  if (delta < 0) delta += 7;
  const data = new Date(inicio);
  data.setDate(data.getDate() + delta);
  return data;
};

const calcularDataFimConteudoCronograma = (cronograma) => {
  if (!cronograma?.dataInicio || !Array.isArray(cronograma?.semanaTemplate)) return null;

  const inicio = new Date(`${cronograma.dataInicio}T12:00:00`);
  if (Number.isNaN(inicio.getTime())) return null;

  const disciplinas = Array.isArray(cronograma.disciplinasSnapshot) ? cronograma.disciplinasSnapshot : [];
  const disciplinasPorId = new Map(disciplinas.map((disciplina) => [String(disciplina.id), disciplina]));
  const slotsTeoria = cronograma.semanaTemplate.filter((slot) => (
    slot &&
    !slot.isRevisao &&
    !slot.isRevisaoAuto &&
    !slot.isConsolidada &&
    slot.disciplinaId
  ));

  if (!slotsTeoria.length) return null;

  const slotsPorDisciplina = slotsTeoria.reduce((acc, slot) => {
    const key = String(slot.disciplinaId);
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});

  let ultimaData = null;

  slotsTeoria.forEach((slot) => {
    const disciplina = disciplinasPorId.get(String(slot.disciplinaId));
    const totalAssuntos = Array.isArray(disciplina?.assuntos) && disciplina.assuntos.length > 0
      ? disciplina.assuntos.length
      : 1;
    const totalSlotsParaDisc = Number(slot.totalSlotsParaDisc || slotsPorDisciplina[String(slot.disciplinaId)] || 1);
    const slotIndexParaDisc = Number(slot.slotIndexParaDisc || 0);
    const ultimoTopicIndexDoSlot = totalAssuntos - 1 - slotIndexParaDisc;

    if (ultimoTopicIndexDoSlot < 0 || totalSlotsParaDisc <= 0) return;

    const weekOffset = Math.floor(ultimoTopicIndexDoSlot / totalSlotsParaDisc);
    const inicioSemana = new Date(inicio);
    inicioSemana.setDate(inicioSemana.getDate() + weekOffset * 7);
    const dataEstudo = getDateForWeekSlot(inicioSemana, slot.dia);

    if (!ultimaData || dataEstudo > ultimaData) ultimaData = dataEstudo;
  });

  return ultimaData ? dateToYMDLocal(ultimaData) : null;
};

const getNomeDisc = (item) => {
  if (item?.isConsolidada) return 'Revisão Consolidada';
  if (item?.isRevisao || item?.isRevisaoAuto) return item?.disciplinaNome || 'Revisão';
  return item?.disciplinaNome || 'Disciplina';
};

const getTextoAssunto = (item, cronograma = {}) => {
  if (item?.isConsolidada) {
    const topicos = item?.topicosRevisao || [];
    if (!topicos.length) return 'Revisão espaçada consolidada';
    return topicos.slice(0, 2).map((t) => t.assunto).join(' · ') + (topicos.length > 2 ? ` +${topicos.length - 2}` : '');
  }
  if (item?.isRevisao || item?.isRevisaoAuto) return item?.assunto || item?.assuntoOriginal || 'Revisão espaçada';
  if (cronograma?.modoExibirAssuntos === false) return 'Estudo de conteúdo';
  return item?.assunto || 'Tópico de estudo';
};

const getLabelTipo = (item) => {
  if (item?.isConsolidada) return 'Revisão Consolidada';
  if (item?.isRevisao || item?.isRevisaoAuto) return `Revisão Espaçada · +${item?.intervaloDias ?? '?'}d`;
  return 'Missão de Teoria';
};

const isMovableTask = (tarefa) => !tarefa?.isRevisao && !tarefa?.isRevisaoAuto && !tarefa?.isConsolidada;
const getTemplateSlotId = (slot) => slot?.id || slot?.slotId;
const getDragTaskId = (tarefa) => `task-${tarefa?.slotIdNoProgresso || tarefa?.slotId}`;
const getTaskTemplateSlotId = (tarefa) => tarefa?.slotIdNoProgresso || tarefa?.slotIdBase || tarefa?.slotId;
const getCompletionKey = (slot) => String(slot?.slotIdNoProgresso || slot?.slotIdBase || slot?.slotId || '');

const applyCompletionOverride = (slot, done) => {
  const tempo = Number(slot?.tempoPlanejadoMinutos ?? slot?.tempoMinutos ?? slot?.minutosEstudo ?? 0);
  const progressoAtual = Number(slot?.progressoMinutos || 0);
  return {
    ...slot,
    concluido: done,
    progressoMinutos: done ? Math.max(progressoAtual, tempo) : progressoAtual,
  };
};

const buildCronogramaTaskState = ({
  cronograma,
  slot,
  weekOffset = 0,
  registrosEstudo = [],
  optimisticDone = {},
}) => {
  const semKey = `w${weekOffset}`;
  const progressoW = cronograma?.progresso?.[semKey] || {};
  const progressoMinutosW = cronograma?.progressoMinutos?.[semKey] || {};
  const slotIdNoProgresso = slot?.slotIdBase || slot?.slotId;
  const tempoPlanejadoMinutos = Number(slot?.tempoMinutos ?? slot?.minutosEstudo ?? 0);
  const progressoRegistrado = getCronogramaSlotRecordedMinutes({
    cronograma,
    slot,
    registrosEstudo,
    dateKey: slot?.dataSlot,
  });
  const progressoCru = Math.max(
    Number(progressoMinutosW[slotIdNoProgresso] || 0),
    Number(slot?.slotId ? progressoMinutosW[slot.slotId] || 0 : 0),
    Number(slot?.slotIdBase ? progressoMinutosW[slot.slotIdBase] || 0 : 0),
    Number(slot?.progressoMinutos || 0),
    progressoRegistrado
  );
  const concluido = slot?.isRevisaoAuto
    ? Boolean(slot?.concluido || progressoW[slot?.slotId] === true)
    : Boolean(
      progressoW[slotIdNoProgresso] === true ||
      progressoW[slot?.slotId] === true ||
      slot?.concluido === true ||
      (tempoPlanejadoMinutos > 0 && progressoCru >= tempoPlanejadoMinutos)
    );
  const tarefaMontada = {
    ...slot,
    slotIdNoProgresso,
    tempoPlanejadoMinutos,
    progressoMinutos: concluido ? Math.max(progressoCru, tempoPlanejadoMinutos) : progressoCru,
    concluido,
  };
  const optimisticKey = getCompletionKey(tarefaMontada);
  return optimisticKey && Object.prototype.hasOwnProperty.call(optimisticDone, optimisticKey)
    ? applyCompletionOverride(tarefaMontada, optimisticDone[optimisticKey])
    : tarefaMontada;
};

const isWeekPanIgnoredTarget = (target) => {
  if (!target?.closest) return false;
  return Boolean(target.closest('button, input, textarea, select, a, [data-cronograma-task-card]'));
};

const cronogramaCollisionDetection = (args) => {
  const pointerCollisions = pointerWithin(args);
  const dayCollision = pointerCollisions.find((collision) => String(collision.id).startsWith('day-'));
  if (dayCollision) return [dayCollision];

  const rectCollisions = rectIntersection(args);
  const rectDayCollision = rectCollisions.find((collision) => String(collision.id).startsWith('day-'));
  if (rectDayCollision) return [rectDayCollision];

  return closestCorners(args);
};

const getTaskPlannedMinutes = (tarefa) => Number(
  tarefa?.tempoPlanejadoMinutos ?? tarefa?.tempoMinutos ?? tarefa?.minutosEstudo ?? 0
);

const getTaskProgressMinutes = (tarefa) => {
  const tempo = getTaskPlannedMinutes(tarefa);
  const progressoRaw = Number(tarefa?.progressoMinutos || 0);
  if (tarefa?.concluido) return Math.max(progressoRaw, tempo);
  return Math.min(progressoRaw, tempo || progressoRaw);
};

const getDayStudySummary = (date, tarefas = []) => {
  const total = tarefas.length;
  const concluidos = tarefas.filter((tarefa) => tarefa.concluido).length;
  const totalMinutos = tarefas.reduce((acc, tarefa) => acc + getTaskPlannedMinutes(tarefa), 0);
  const progressoMinutos = tarefas.reduce((acc, tarefa) => acc + getTaskProgressMinutes(tarefa), 0);
  const progresso = totalMinutos > 0 ? Math.round((progressoMinutos / totalMinutos) * 100) : (total > 0 ? Math.round((concluidos / total) * 100) : 0);
  const todoConcluido = total > 0 && concluidos === total;
  const dayDate = new Date(date);
  dayDate.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const isPast = dayDate.getTime() < today.getTime();
  const status = todoConcluido ? 'done' : total > 0 && isPast ? 'late' : total > 0 ? 'pending' : 'empty';
  const label = status === 'done' ? 'Concluido' : status === 'late' ? 'Atrasado' : status === 'pending' ? 'Pendente' : 'Livre';

  return {
    total,
    concluidos,
    totalMinutos,
    progressoMinutos,
    progresso,
    todoConcluido,
    isPast,
    status,
    label,
  };
};

const formatarDataCurta = (data) => {
  if (!data) return 'Data não definida';
  const d = typeof data === 'string' ? new Date(`${data}T12:00:00`) : new Date(data);
  if (Number.isNaN(d.getTime())) return 'Data não definida';
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
};

const formatarDataLonga = (data) => {
  if (!data) return 'Data não definida';
  const d = typeof data === 'string' ? new Date(`${data}T12:00:00`) : new Date(data);
  if (Number.isNaN(d.getTime())) return 'Data não definida';
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
};

const somarDias = (data, dias) => {
  if (!data) return null;
  const base = typeof data === 'string' ? new Date(`${data}T12:00:00`) : new Date(data);
  if (Number.isNaN(base.getTime())) return null;
  const nova = new Date(base);
  nova.setDate(nova.getDate() + dias);
  return nova;
};

// --- MODAL DE CONFIRMAÇÃO ------------------------------------------------------
const ModalConfirm = ({ msg, onConfirm, onCancel, loading, title = 'Confirmar ação', confirmLabel = 'Confirmar', confirmIcon: ConfirmIcon = Trash2, tone = 'red' }) => (
  <motion.div
    initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
    className="fixed inset-0 z-[100120] flex items-center justify-center bg-zinc-950/70 p-4 backdrop-blur-sm"
  >
    <motion.div
      initial={{ scale: 0.95, y: 10 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 10 }}
      className="bg-white dark:bg-zinc-900 rounded-2xl p-6 max-w-sm w-full shadow-2xl border border-zinc-200 dark:border-zinc-800"
    >
      <div className={`w-12 h-12 ${tone === 'amber' ? 'bg-amber-100 dark:bg-amber-500/10' : 'bg-red-100 dark:bg-red-500/10'} rounded-full flex items-center justify-center mx-auto mb-4`}>
        <AlertTriangle size={24} className={tone === 'amber' ? 'text-amber-600 dark:text-amber-500' : 'text-red-600 dark:text-red-500'}/>
      </div>
      <h3 className="mb-2 text-center text-sm font-black uppercase tracking-widest text-zinc-900 dark:text-white">{title}</h3>
      <p className="text-sm font-medium text-zinc-600 dark:text-zinc-300 text-center mb-6 leading-relaxed">{msg}</p>
      <div className="flex gap-3">
        <button onClick={onCancel} className="flex-1 py-2.5 bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 rounded-xl font-bold text-xs uppercase tracking-wide hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors">Cancelar</button>
        <button onClick={onConfirm} disabled={loading} className={`flex-1 py-2.5 ${tone === 'amber' ? 'bg-amber-600 hover:bg-amber-700' : 'bg-red-600 hover:bg-red-700'} text-white rounded-xl font-bold text-xs uppercase tracking-wide transition-colors disabled:opacity-60 flex items-center justify-center gap-2 shadow-sm`}>
          {loading ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"/> : <ConfirmIcon size={14}/>}
          {confirmLabel}
        </button>
      </div>
    </motion.div>
  </motion.div>
);

// --- ESTADO VAZIO --------------------------------------------------------------
const EstadoVazio = ({ onNovo }) => (
  <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col items-center justify-center min-h-[60vh] p-8 text-center">
    <div className="relative mb-8">
      <div className="w-28 h-28 bg-zinc-100 dark:bg-zinc-800/50 rounded-3xl flex items-center justify-center border border-zinc-200 dark:border-zinc-800 rotate-3">
        <MapIcon size={48} className="text-zinc-400 dark:text-zinc-500 -rotate-3"/>
      </div>
      <div className="absolute -top-2 -right-2 w-10 h-10 bg-red-600 rounded-xl flex items-center justify-center shadow-lg shadow-red-600/20 rotate-12">
        <Zap size={20} className="text-white -rotate-12" fill="white"/>
      </div>
    </div>
    <h2 className="text-3xl font-black text-zinc-900 dark:text-white mb-3 uppercase tracking-tight">QG Desativado</h2>
    <p className="text-zinc-500 dark:text-zinc-400 text-sm mb-8 max-w-sm leading-relaxed">Nenhuma operação tática em andamento. Inicie seu cronograma para organizar suas missões com eficiência.</p>
    <button onClick={onNovo} className="px-8 py-3.5 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold shadow-md hover:-translate-y-0.5 transition-all duration-200 flex items-center gap-2 uppercase tracking-wide text-xs">
      <Plus size={18}/> Iniciar Operação
    </button>
  </motion.div>
);

// --- MODAL DE REVISÃO CONSOLIDADA ---------------------------------------------
const ModalRevisaoConsolidada = ({ slot, onClose, onDominar, onStart, onToggle, dominiosLocal, toggleLoadingId, optimisticDone = {} }) => {
  if (!slot?.isConsolidada) return null;

  const buildReviewTask = (topico, idx) => ({
    ...topico,
    disciplinaId: topico.disciplinaId,
    disciplinaNome: topico.disciplinaNome || 'Revisao',
    assunto: topico.assunto || 'Revisao agendada',
    isRevisaoAuto: true,
    slotId: topico.slotId || topico.slotIdBase || `${slot.slotId || 'review'}-${idx}`,
    slotIdBase: topico.slotIdBase || topico.slotId,
    slotIdNoProgresso: topico.slotIdNoProgresso || topico.slotIdBase || topico.slotId,
    weekOffset: topico.weekOffset ?? slot.weekOffset,
    concluido: Boolean(topico.concluido),
    tempoMinutos: topico.tempoMinutos ?? topico.tempoPlanejadoMinutos ?? slot.tempoMinutos,
    tempoPlanejadoMinutos: topico.tempoPlanejadoMinutos ?? topico.tempoMinutos ?? slot.tempoPlanejadoMinutos,
    progressoMinutos: topico.progressoMinutos ?? slot.progressoMinutos,
    bloqueiaDesmarcar: Boolean(topico.bloqueiaDesmarcar || slot.bloqueiaDesmarcar),
  });

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[250] flex items-end justify-center bg-zinc-950/70 p-0 backdrop-blur-sm sm:items-center sm:p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ y: 60, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 60, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 350, damping: 30 }}
        className="w-full overflow-hidden rounded-t-3xl border border-blue-200 bg-white shadow-2xl shadow-blue-950/20 dark:border-blue-900/40 dark:bg-zinc-900 sm:max-w-xl sm:rounded-2xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-blue-100 bg-blue-50/75 px-5 pb-4 pt-5 dark:border-blue-900/35 dark:bg-blue-950/20">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-blue-200 bg-white text-blue-600 shadow-sm shadow-blue-500/10 dark:border-blue-900/40 dark:bg-blue-900/20 dark:text-blue-300">
              <BarChart2 size={20}/>
            </div>
            <div>
              <p className="mb-1 text-[10px] font-black uppercase leading-none tracking-widest text-blue-600 dark:text-blue-300">{slot.titulo || 'Revisoes do Dia'}</p>
              <p className="text-sm font-bold text-zinc-900 dark:text-zinc-100">{slot.topicosRevisao?.length || 0} tópicos agendados</p>
            </div>
          </div>
          <button onClick={onClose} className="rounded-xl p-2 text-zinc-500 transition-colors hover:bg-blue-100 hover:text-blue-700 dark:hover:bg-blue-900/35 dark:hover:text-blue-200">
            <X size={18}/>
          </button>
        </div>

        <div className="max-h-[60vh] overflow-y-auto divide-y divide-blue-100/70 dark:divide-blue-900/25">
          {(slot.topicosRevisao || []).map((t, idx) => {
            const chave    = chaveAssuntoDominado(t.disciplinaId, t.assunto);
            const dominado = !!(dominiosLocal[chave]);
            const revisaoTaskBase = buildReviewTask(t, idx);
            const optimisticKey = getCompletionKey(revisaoTaskBase);
            const revisaoTask = optimisticKey && Object.prototype.hasOwnProperty.call(optimisticDone, optimisticKey)
              ? applyCompletionOverride(revisaoTaskBase, optimisticDone[optimisticKey])
              : revisaoTaskBase;
            const isDone = Boolean(revisaoTask.concluido);
            const isLoading = toggleLoadingId === (revisaoTask.slotIdBase || revisaoTask.slotId);
            const tempoRevisao = Number(revisaoTask.tempoPlanejadoMinutos ?? revisaoTask.tempoMinutos ?? 0);
            const progressoRevisaoRaw = Number(revisaoTask.progressoMinutos || 0);
            const progressoRevisao = isDone ? Math.max(progressoRevisaoRaw, tempoRevisao) : progressoRevisaoRaw;
            const desmarcarBloqueado = isDone && Boolean(revisaoTask.bloqueiaDesmarcar);
            return (
              <div key={`${revisaoTask.slotId || idx}-${idx}`} className="px-4 py-3">
                <div className={`group rounded-2xl border p-3 transition-all ${isDone ? 'border-blue-200 bg-blue-50/80 dark:border-blue-900/40 dark:bg-blue-950/20' : 'border-blue-100 bg-white hover:border-blue-200 hover:bg-blue-50/60 dark:border-blue-900/30 dark:bg-zinc-900/70 dark:hover:bg-blue-950/20'}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 flex-1 items-start gap-2">
                      <motion.button
                        whileHover={{ scale: 1.05, y: -1 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => {
                          if (desmarcarBloqueado) return;
                          onToggle?.(revisaoTask);
                        }}
                        disabled={isLoading || desmarcarBloqueado}
                        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border shadow-sm transition-all disabled:opacity-60 ${
                          isDone
                            ? 'border-emerald-500 bg-emerald-500 text-white shadow-emerald-500/20'
                            : 'border-emerald-200 bg-white text-emerald-600 shadow-emerald-500/10 hover:border-emerald-300 hover:bg-emerald-50 dark:border-emerald-900/40 dark:bg-white/10 dark:text-emerald-300 dark:hover:bg-emerald-900/35'
                        }`}
                        title={desmarcarBloqueado ? 'Conclusao protegida por registro de revisao' : isDone ? 'Revisao concluida' : 'Marcar revisao como concluida'}
                      >
                        {isLoading ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} strokeWidth={3.5} />}
                      </motion.button>
                      <div className="min-w-0 flex-1">
                        <p className={`truncate text-xs font-black uppercase tracking-tight ${isDone ? 'text-blue-700 line-through decoration-emerald-500/60 dark:text-blue-200' : 'text-zinc-900 dark:text-zinc-100'}`}>{revisaoTask.disciplinaNome}</p>
                        <p className={`mt-0.5 truncate text-[11px] font-semibold leading-snug ${isDone ? 'text-zinc-400 line-through decoration-emerald-500/60' : 'text-zinc-600 dark:text-zinc-300'}`}>{revisaoTask.assunto}</p>
                      </div>
                    </div>
                    <span className="shrink-0 rounded-lg border border-blue-200 bg-blue-50 px-2 py-1 text-[9px] font-black uppercase tracking-wide text-blue-700 dark:border-blue-900/40 dark:bg-blue-900/20 dark:text-blue-300">
                      +{revisaoTask.intervaloDias ?? '?'}d
                    </span>
                  </div>

                  <div className="mt-2.5 flex items-end gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="mb-1 flex items-center justify-between gap-2 text-[8px] font-black uppercase tracking-wide text-blue-500 dark:text-blue-300">
                        <span>{isDone ? 'Revisao concluida' : 'Revisao agendada'}</span>
                        {tempoRevisao > 0 && <span>{formatarDuracao(progressoRevisao)} / {formatarDuracao(tempoRevisao)}</span>}
                      </div>
                      <div className="h-1 overflow-hidden rounded-full bg-blue-100 dark:bg-blue-950/50">
                        <motion.div
                          initial={false}
                          animate={{ width: isDone ? '100%' : '0%' }}
                          transition={{ duration: 0.25 }}
                          className="h-full rounded-full bg-gradient-to-r from-blue-500 to-blue-700"
                        />
                      </div>
                    </div>
                    {!isDone && (
                      <motion.button
                        whileHover={{ scale: 1.05, y: -1 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => onStart?.(revisaoTask)}
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-blue-200 bg-white text-blue-600 shadow-sm transition-all hover:bg-blue-600 hover:text-white dark:border-blue-900/40 dark:bg-blue-900/20 dark:text-blue-300 dark:hover:bg-blue-600 dark:hover:text-white"
                        title="Iniciar cronometro desta revisao"
                      >
                        <Play size={14} fill="currentColor" />
                      </motion.button>
                    )}
                  </div>

                  <div className="flex h-0 items-center overflow-hidden opacity-0 transition-all duration-200 group-hover:mt-2 group-hover:h-8 group-hover:opacity-100 group-focus-within:mt-2 group-focus-within:h-8 group-focus-within:opacity-100">
                    <button
                      onClick={() => onDominar(t.disciplinaId, t.assunto, dominado)}
                      title={dominado ? 'Assunto ja dominado' : 'Marcar assunto como ja dominado'}
                      className={`flex h-8 min-w-0 flex-1 items-center justify-center gap-1.5 rounded-lg border px-3 text-[9px] font-black uppercase tracking-wide transition-colors active:scale-95
                        ${dominado
                          ? 'border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-300 dark:hover:bg-amber-950/30'
                          : 'border-dashed border-zinc-300 bg-transparent text-zinc-500 hover:border-amber-300 hover:bg-amber-50 hover:text-amber-600 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-amber-950/20 dark:hover:text-amber-300'
                        }`}
                    >
                      <BadgeCheck size={14} className={dominado ? 'fill-amber-400 text-amber-500' : ''} strokeWidth={dominado ? 0 : 2}/>
                      {dominado ? 'Dominado' : 'Marcar dominio'}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="border-t border-blue-100 bg-blue-50/70 px-5 py-4 dark:border-blue-900/35 dark:bg-blue-950/20">
          <p className="text-center text-[10px] leading-relaxed text-zinc-500 dark:text-zinc-400">
            Use <span className="font-bold text-blue-600 dark:text-blue-300">play</span> para iniciar o cronometro ou <span className="font-bold text-emerald-600">check</span> para concluir a revisão.
          </p>
        </div>
      </motion.div>
    </motion.div>
  );
};

// --- CARD DE TAREFA ARRASTÁVEL -------------------------------------------------
const TarefaCardDraggable = ({
  tarefa,
  onToggle,
  onMarkPendencia,
  onStart,
  onDominar,
  onOpenConsolidada,
  onOpenDetails,
  cronograma,
  dragAttributes = {},
  dragListeners = {},
  dragRef = null,
  dragStyle = {},
  isDragging = false,
  isSortable = false,
}) => {
  const isDominado    = tarefa.dominado === true;
  const isConsolidada = tarefa.isConsolidada === true;
  const canMarkPendencia = Boolean(
    onMarkPendencia &&
    !tarefa.isRevisao &&
    !tarefa.isRevisaoAuto &&
    !tarefa.concluido
  );

  const modoExibirAssuntos = cronograma?.modoExibirAssuntos !== false;
  const modoExibirTempo    = cronograma?.modoExibirTempo || 'detalhado';

  const assuntoTexto = tarefa.isRevisaoAuto
    ? (tarefa.assunto || 'Revisão Geral do Conteúdo')
    : (modoExibirAssuntos ? (tarefa.assunto || 'Tópico de Estudo') : 'Estudo de Conteúdo');

  const tempoPlanejadoMinutos = Number(tarefa.tempoPlanejadoMinutos ?? tarefa.tempoMinutos ?? tarefa.minutosEstudo ?? 0);
  const progressoAtualMinutos = Number(tarefa.progressoMinutos || 0);
  const progressoLimitado = Math.min(progressoAtualMinutos, tempoPlanejadoMinutos || progressoAtualMinutos);
  const progressoExibidoMinutos = tarefa.concluido
    ? Math.max(progressoAtualMinutos, tempoPlanejadoMinutos)
    : progressoLimitado;
  const progressoPercentual = tempoPlanejadoMinutos > 0
    ? Math.min(100, Math.round((progressoLimitado / tempoPlanejadoMinutos) * 100))
    : (tarefa.concluido ? 100 : 0);
  const emAndamento = !tarefa.concluido && !tarefa.isRevisaoAuto && progressoLimitado > 0 && progressoPercentual < 100;
  const desmarcarBloqueado = tarefa.concluido && Boolean(tarefa.bloqueiaDesmarcar);
  const disciplinaColor = getDisciplineColorForSlot(tarefa);
  const useDisciplineColor = !isDominado && !emAndamento && !tarefa.isRevisao && !tarefa.isRevisaoAuto;
  const cardStyle = useDisciplineColor
    ? { ...dragStyle, ...getDisciplineCardVars(disciplinaColor) }
    : dragStyle;

  return (
    <motion.div
      data-cronograma-task-card
      ref={dragRef}
      style={cardStyle}
      {...dragAttributes}
      {...dragListeners}
      layout={isSortable ? 'position' : false}
      initial={false}
      animate={false}
      exit={false}
      onClick={!isDragging ? () => onOpenDetails?.(tarefa) : undefined}
      className={`relative min-h-[104px] rounded-2xl border overflow-hidden group mb-2.5 select-none
        ${isSortable ? 'cursor-grab active:cursor-grabbing' : onOpenDetails ? 'cursor-pointer' : 'cursor-default'}
        ${isDragging ? 'opacity-80 scale-100 rotate-1 shadow-2xl z-20' : ''}
        ${useDisciplineColor ? 'discipline-tinted-card' : ''}
        ${tarefa.concluido
          ? 'discipline-completed-card'
          : isDominado
          ? 'bg-amber-50/80 dark:bg-amber-500/5 border-amber-200 dark:border-amber-500/20'
          : emAndamento
          ? 'bg-orange-50/80 dark:bg-orange-500/5 border-orange-200 dark:border-orange-500/20'
          : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-700/50 shadow-sm hover:shadow-lg'
        }`}
    >
      {/* Linha lateral tática */}
      <div className={`absolute left-0 top-0 bottom-0 w-1.5 ${
        tarefa.concluido   ? disciplinaColor.bg
        : isDominado       ? 'bg-amber-500'
        : tarefa.isRevisao ? 'bg-blue-500'
        : emAndamento      ? 'bg-orange-500'
        : disciplinaColor.bg
      }`}/>

      <div className="flex h-full flex-col gap-2 px-3.5 py-3">
        <div className="flex min-w-0 items-start justify-between gap-2 pr-1">
          <div className="flex min-w-0 flex-1 items-start gap-2">
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (desmarcarBloqueado) return;
                onToggle(tarefa);
              }}
              disabled={desmarcarBloqueado}
              title={desmarcarBloqueado ? 'Conclusao protegida por registro de revisao' : tarefa.concluido ? 'Marcar como pendente' : 'Marcar como concluido'}
              className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border shadow-sm disabled:cursor-not-allowed ${
                tarefa.concluido
                  ? 'border-emerald-500 bg-emerald-500 text-white shadow-emerald-500/20'
                  : 'border-emerald-200 bg-white text-emerald-600 shadow-emerald-500/10 hover:border-emerald-300 hover:bg-emerald-50 dark:border-emerald-900/40 dark:bg-white/10 dark:text-emerald-300 dark:hover:bg-emerald-900/35'
              }`}
            >
              <Check size={15} strokeWidth={3.5} />
            </button>
            <h4 className={`min-w-0 flex-1 truncate text-[11px] font-black uppercase tracking-wide leading-tight ${
              tarefa.concluido ? `${disciplinaColor.text} line-through opacity-75`
              : isDominado     ? 'text-amber-700 dark:text-amber-400'
              : emAndamento    ? 'text-orange-700 dark:text-orange-400'
              : disciplinaColor.text
            }`}>
              {tarefa.disciplinaNome}
            </h4>
          </div>
          {modoExibirTempo !== 'oculto' && tempoPlanejadoMinutos > 0 && (
            <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-white/70 bg-white/75 px-2 py-0.5 text-[11px] font-black tabular-nums text-zinc-700 shadow-sm dark:border-white/10 dark:bg-white/10 dark:text-zinc-100">
              <Clock size={11} className="text-zinc-500 dark:text-zinc-300"/>
              {formatarDuracao(tempoPlanejadoMinutos)}
            </span>
          )}
        </div>

        <p className={`line-clamp-3 w-full pr-1 text-xs font-semibold leading-snug ${
          tarefa.concluido ? 'text-zinc-500 dark:text-zinc-400 line-through decoration-emerald-500/60' : isDominado ? 'text-amber-700/80 dark:text-amber-300/80' : 'text-zinc-600 dark:text-zinc-300'
        }`}>
          {assuntoTexto}
        </p>
        {tarefa.isPendenciaTeoria && tarefa.assuntoOriginal && tarefa.assuntoOriginal !== tarefa.assunto && (
          <div className="text-[9px] font-semibold uppercase tracking-wide text-amber-600 dark:text-amber-400">
            Original: {tarefa.assuntoOriginal}
          </div>
        )}

        {modoExibirTempo !== 'oculto' && tempoPlanejadoMinutos > 0 && (
          <div className="flex items-end gap-2">
            <div className="min-w-0 flex-1">
              <div className="mb-1 flex items-center justify-between gap-2 text-[10px] font-bold text-zinc-500 dark:text-zinc-400">
                <span className="font-black tabular-nums">
                  {formatarDuracao(progressoExibidoMinutos)} / {formatarDuracao(tempoPlanejadoMinutos)}
                </span>
                <span className="text-[11px] font-black tabular-nums">
                  {tarefa.concluido ? 100 : progressoPercentual}%
                </span>
              </div>
              <div className="h-1 overflow-hidden rounded-full bg-white/55 dark:bg-black/25">
                <div
                  style={{ width: `${tarefa.concluido ? 100 : progressoPercentual}%` }}
                  className={`h-full rounded-full ${tarefa.concluido ? disciplinaColor.progress : emAndamento ? 'bg-orange-500' : disciplinaColor.progress}`}
                />
              </div>
            </div>
            {!tarefa.isRevisaoAuto && !tarefa.concluido && (
              <button
                onClick={(e) => { e.stopPropagation(); onStart(tarefa); }}
                title="Iniciar estudo"
                className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-red-600 text-white shadow-sm shadow-red-600/20 transition-all hover:bg-red-700 active:scale-95"
              >
                <Play size={13} fill="currentColor"/>
              </button>
            )}
          </div>
        )}

        <div className="flex h-0 w-full items-center overflow-hidden border-t border-transparent pt-0 opacity-0 transition-all duration-200 group-hover:h-11 group-hover:border-white/50 group-hover:pt-2 group-hover:pb-1 group-hover:opacity-100 group-focus-within:h-11 group-focus-within:border-white/50 group-focus-within:pt-2 group-focus-within:pb-1 group-focus-within:opacity-100 dark:group-hover:border-white/10 dark:group-focus-within:border-white/10">
      <div className="pointer-events-none flex w-full items-center gap-1.5 transition-all duration-200 group-hover:pointer-events-auto group-focus-within:pointer-events-auto">
          {tarefa.isConsolidada && !tarefa.concluido && (
            <button
              onClick={(e) => { e.stopPropagation(); onOpenConsolidada(tarefa); }}
              title="Ver revisao consolidada"
              className="inline-flex h-8 min-w-0 flex-1 items-center justify-center gap-1.5 rounded-lg bg-white/65 px-2 text-[9px] font-black uppercase tracking-wide text-blue-700 transition-colors hover:bg-blue-50 active:scale-95 dark:bg-white/10 dark:text-blue-300 dark:hover:bg-blue-950/30"
            >
              <BarChart2 size={14}/>
              Revisao
            </button>
          )}

          {!tarefa.isRevisaoAuto && (
            <button
              onClick={(e) => { e.stopPropagation(); onDominar(tarefa); }}
                title={isDominado ? 'Assunto ja dominado: nao priorizar novas revisoes desse topico.' : 'Ja dominei: marque quando voce domina o assunto e quer reduzir revisoes futuras.'}
                className={`inline-flex h-8 min-w-0 flex-1 items-center justify-center gap-1.5 rounded-lg border px-2 text-[9px] font-black uppercase tracking-wide transition-colors active:scale-95 ${
                isDominado
                  ? 'border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-300 dark:hover:bg-amber-950/30'
                  : 'border-dashed border-zinc-300 bg-transparent text-zinc-500 hover:border-amber-300 hover:bg-amber-50 hover:text-amber-600 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-amber-950/20 dark:hover:text-amber-300'
              }`}
            >
              <BadgeCheck size={14} className={isDominado ? 'fill-amber-400' : ''} strokeWidth={isDominado ? 0 : 2}/>
              {isDominado ? 'Dominado' : 'Marcar dominio'}
            </button>
          )}

          {canMarkPendencia && (
            <button
              onClick={(e) => { e.stopPropagation(); onMarkPendencia(tarefa); }}
              title="Pendente: mova este assunto para retomar depois sem marcar como concluido."
                className="inline-flex h-8 min-w-0 flex-1 items-center justify-center gap-1.5 rounded-lg bg-white/65 px-2 text-[9px] font-black uppercase tracking-wide text-amber-700 hover:bg-amber-100 dark:bg-white/10 dark:text-amber-300 dark:hover:bg-amber-950/30"
            >
              <SkipForward size={15}/>
              Pendente
            </button>
          )}
      </div>
        </div>
      </div>
    </motion.div>
  );
};

const ModalDetalhesCronograma = ({ slot, cronograma, onClose, onStart, onToggle, optimisticDone = {} }) => {
  if (!slot) return null;

  const optimisticKey = getCompletionKey(slot);
  const isConclusaoOverride = optimisticKey && Object.prototype.hasOwnProperty.call(optimisticDone, optimisticKey);
  const slotAtual = isConclusaoOverride ? applyCompletionOverride(slot, optimisticDone[optimisticKey]) : slot;
  const isRevisao = slot.isRevisaoAuto || slot.isRevisao;
  const isConsolidada = slot.isConsolidada === true;
  const disciplinaColor = getDisciplineColorForSlot(slot);
  const useDisciplineTheme = !isRevisao && !isConsolidada;
  const accentBgClass = useDisciplineTheme ? disciplinaColor.bg : 'bg-blue-600';
  const accentTextClass = useDisciplineTheme ? disciplinaColor.text : 'text-blue-600 dark:text-blue-500';
  const accentProgressClass = useDisciplineTheme ? disciplinaColor.progress : 'bg-blue-500';
  const tempoPlanejado = Number(slot.tempoPlanejadoMinutos ?? slot.tempoMinutos ?? slot.minutosEstudo ?? 0);
  const progressoRaw = Number(slot.progressoMinutos || 0);
  const progressoMinutos = slotAtual.concluido
    ? Math.max(progressoRaw, tempoPlanejado)
    : Math.min(progressoRaw, tempoPlanejado || progressoRaw);
  const progressoPercentual = tempoPlanejado > 0
    ? Math.min(100, Math.round((progressoMinutos / tempoPlanejado) * 100))
    : (slotAtual.concluido ? 100 : 0);
  const dataSlot = slot.dataSlot || null;
  const dataBaseRevisao = isRevisao && slot.intervaloDias ? somarDias(dataSlot, -Number(slot.intervaloDias)) : null;
  const proximasRevisoes = !isRevisao && dataSlot
    ? INTERVALOS_REVISAO.map((dias) => ({ dias, data: somarDias(dataSlot, dias) }))
    : [];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
      className="fixed inset-0 z-[260] flex items-start justify-center overflow-hidden bg-zinc-950/80 px-3 pb-3 pt-16 backdrop-blur-sm sm:px-4 sm:pt-20"
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        transition={{ type: 'spring', stiffness: 350, damping: 30 }}
        onClick={e => e.stopPropagation()}
        className="w-full max-w-2xl overflow-hidden rounded-3xl border border-zinc-200 bg-white shadow-2xl dark:border-zinc-800 dark:bg-zinc-900"
      >
        <div className={`h-2 w-full ${accentBgClass}`} />

        <div className="p-3 sm:p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="mb-2 flex flex-wrap gap-1.5">
                <span className={`rounded-md px-2 py-0.5 text-[8px] font-black uppercase tracking-widest text-white sm:text-[10px] ${accentBgClass}`}>
                  {getLabelTipo(slot)}
                </span>
                {slotAtual.concluido && (
                  <span className="rounded-md bg-emerald-100 px-2 py-0.5 text-[8px] font-black uppercase tracking-widest text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400 sm:text-[10px]">
                    Concluído
                  </span>
                )}
                {slot.dominado && (
                  <span className="rounded-md bg-amber-100 px-2 py-0.5 text-[8px] font-black uppercase tracking-widest text-amber-700 dark:bg-amber-500/20 dark:text-amber-400 sm:text-[10px]">
                    Dominado
                  </span>
                )}
              </div>

              <h3 className="text-lg font-black uppercase tracking-tight text-zinc-900 dark:text-white sm:text-2xl">
                {getNomeDisc(slot)}
              </h3>
              <p className="mt-1 line-clamp-1 text-xs font-medium leading-relaxed text-zinc-600 dark:text-zinc-400 sm:line-clamp-2 sm:text-sm">
                {getTextoAssunto(slot, cronograma)}
              </p>
            </div>

            <button
              onClick={onClose}
              className="rounded-lg bg-zinc-100 p-1.5 text-zinc-500 transition-all hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700 sm:rounded-xl sm:p-2"
            >
              <X size={18} />
            </button>
          </div>

          <div className="mt-3 grid gap-2 sm:mt-4 sm:gap-3">
            <div className="min-w-0 space-y-2 sm:space-y-3">
              <div className="grid grid-cols-3 gap-2 sm:gap-3">
                <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-2 dark:border-zinc-800 dark:bg-zinc-950/50 sm:rounded-xl sm:p-3">
                  <p className="text-[7px] font-black uppercase tracking-widest text-zinc-500 dark:text-zinc-400 sm:text-[9px]">Tempo</p>
                  <p className="mt-1 text-base font-black text-zinc-900 dark:text-white sm:text-xl">{formatarDuracao(tempoPlanejado)}</p>
                  {tempoPlanejado > 0 && (
                    <div className="mt-1 sm:mt-2">
                      <div className="flex items-center justify-between gap-1 text-[7px] font-black uppercase tracking-wide sm:text-[9px]">
                        <span className={slotAtual.concluido ? 'text-emerald-600 dark:text-emerald-400' : progressoMinutos > 0 ? 'text-orange-500' : 'text-zinc-400'}>
                          {formatarDuracao(progressoMinutos)} / {formatarDuracao(tempoPlanejado)}
                        </span>
                        <span className="text-zinc-400">{progressoPercentual}%</span>
                      </div>
                      <div className="mt-1 h-1 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800 sm:h-1.5">
                        <div
                          style={{ width: `${progressoPercentual}%` }}
                          className={`h-full rounded-full ${slotAtual.concluido ? 'bg-emerald-500' : progressoMinutos > 0 ? 'bg-orange-500' : accentProgressClass}`}
                        />
                      </div>
                    </div>
                  )}
                </div>

                <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-2 dark:border-zinc-800 dark:bg-zinc-950/50 sm:rounded-xl sm:p-3">
                  <p className="text-[7px] font-black uppercase tracking-widest text-zinc-500 dark:text-zinc-400 sm:text-[9px]">Dia</p>
                  <p className="mt-1 line-clamp-2 text-[10px] font-black uppercase tracking-wide text-zinc-900 dark:text-white sm:text-sm">
                    {formatarDataLonga(dataSlot)}
                  </p>
                  <p className="mt-0.5 text-[8px] font-bold uppercase tracking-wide text-zinc-500 sm:mt-1 sm:text-[10px]">
                    Semana {Number(slot.weekOffset ?? 0) + 1}
                  </p>
                </div>

                <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-2 dark:border-zinc-800 dark:bg-zinc-950/50 sm:rounded-xl sm:p-3">
                  <p className="text-[7px] font-black uppercase tracking-widest text-zinc-500 dark:text-zinc-400 sm:text-[9px]">
                    {isRevisao ? 'Origem' : 'Status'}
                  </p>
                  <p className="mt-1 line-clamp-2 text-[10px] font-black uppercase tracking-wide text-zinc-900 dark:text-white sm:text-sm">
                    {isRevisao
                      ? formatarDataLonga(dataBaseRevisao)
                      : slotAtual.concluido
                      ? 'Finalizada'
                      : progressoMinutos > 0
                      ? 'Em andamento'
                      : 'Planejada'}
                  </p>
                  <p className="mt-0.5 text-[8px] font-bold uppercase tracking-wide text-zinc-500 sm:mt-1 sm:text-[10px]">
                    {isRevisao
                      ? `Intervalo de ${slot.intervaloDias ?? 0} dia(s)`
                      : `${proximasRevisoes.length} revisão(ões) previstas`}
                  </p>
                </div>
              </div>

              <div className="rounded-lg border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900 sm:rounded-xl sm:p-4">
                <p className={`text-[9px] font-black uppercase tracking-widest sm:text-[10px] ${accentTextClass}`}>
                  {isConsolidada ? 'Tópicos consolidados' : 'Foco desta sessão'}
                </p>

                {isConsolidada && slot.topicosRevisao?.length > 0 ? (
                  <div className="mt-2 grid gap-2 sm:mt-3 sm:grid-cols-2">
                    {slot.topicosRevisao.slice(0, 2).map((topico, index) => (
                      <div key={`${topico.disciplinaId || topico.disciplinaNome}-${index}`} className="flex items-start gap-2 rounded-lg bg-zinc-50 px-3 py-2 dark:bg-zinc-800/50">
                        <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-blue-500" />
                        <div className="min-w-0">
                          <p className="truncate text-[11px] font-black uppercase tracking-wide text-zinc-900 dark:text-zinc-100">
                            {topico.disciplinaNome}
                          </p>
                          <p className="mt-0.5 line-clamp-2 text-[11px] leading-snug text-zinc-600 dark:text-zinc-400">
                            {topico.assunto}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="mt-2 line-clamp-2 text-xs font-medium leading-relaxed text-zinc-700 dark:text-zinc-300 sm:mt-3 sm:text-sm">
                    {isRevisao
                      ? slot.assunto || slot.assuntoOriginal || 'Revisão espaçada agendada para reforço do conteúdo.'
                      : slot.assunto || 'Sessão planejada para avançar no conteúdo principal da disciplina.'}
                  </p>
                )}
              </div>
            </div>

            <div className="flex min-w-0 flex-col gap-2 sm:gap-3">
              <div className="rounded-lg border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900 sm:rounded-xl sm:p-4">
                <p className="text-[9px] font-black uppercase tracking-widest text-zinc-500 dark:text-zinc-400 sm:text-[10px]">
                  {isRevisao ? 'Leitura estratégica' : 'Próximas revisões'}
                </p>

                {isRevisao ? (
                  <div className="mt-2 grid grid-cols-2 gap-2 sm:mt-3">
                    <div className="rounded-lg bg-zinc-50 px-2 py-2 dark:bg-zinc-800/50 sm:px-3">
                      <p className="text-[11px] font-black uppercase tracking-wide text-zinc-900 dark:text-zinc-100">Próximo marco</p>
                      <p className="mt-1 line-clamp-2 text-[10px] leading-snug text-zinc-600 dark:text-zinc-400 sm:text-xs">
                        Revisão do estudo iniciado em {formatarDataCurta(dataBaseRevisao)}.
                      </p>
                    </div>
                    <div className="rounded-lg bg-blue-50 px-2 py-2 dark:bg-blue-500/10 sm:px-3">
                      <p className="text-[11px] font-black uppercase tracking-wide text-blue-700 dark:text-blue-400">Janela atual</p>
                      <p className="mt-1 line-clamp-2 text-[10px] leading-snug text-blue-800/70 dark:text-blue-300/70 sm:text-xs">
                        {formatarDataCurta(dataSlot)} · intervalo de {slot.intervaloDias ?? 0} dia(s).
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="mt-2 grid grid-cols-3 gap-2 sm:mt-3">
                    {proximasRevisoes.map((revisao) => (
                      <div key={revisao.dias} className="min-w-0 rounded-lg bg-zinc-50 px-2 py-2 dark:bg-zinc-800/50 sm:px-3">
                        <div className="min-w-0">
                          <p className="text-[10px] font-black uppercase tracking-wide text-zinc-900 dark:text-zinc-100 sm:text-[11px]">+{revisao.dias}d</p>
                          <p className="mt-0.5 truncate text-[9px] font-medium uppercase tracking-wide text-zinc-500 sm:text-[10px]">
                            {formatarDataCurta(revisao.data)}
                          </p>
                        </div>
                        <div className="mt-1 w-fit rounded px-1.5 py-0.5 text-[7px] font-black uppercase tracking-wide text-red-600 bg-red-100 dark:bg-red-500/20 dark:text-red-400 sm:text-[9px]">
                          Prevista
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="hidden grid-cols-3 gap-2 sm:grid">
                {!isRevisao && onStart && !slotAtual.concluido && (
                  <button
                    onClick={() => onStart(slot)}
                    className={`inline-flex h-10 items-center justify-center gap-2 rounded-xl px-3 text-[10px] font-black uppercase tracking-widest text-white transition-all ${accentBgClass}`}
                  >
                    <Play size={14} fill="currentColor" />
                    Iniciar Estudo
                  </button>
                )}
                {onToggle && (
                  <button
                    onClick={() => onToggle(slot)}
                    className={`inline-flex h-10 items-center justify-center gap-2 rounded-xl px-3 text-[10px] font-black uppercase tracking-widest text-white ${
                      slotAtual.concluido ? 'bg-zinc-700 hover:bg-zinc-800 dark:bg-zinc-700 dark:hover:bg-zinc-600' : 'bg-emerald-600 hover:bg-emerald-700'
                    }`}
                  >
                    <CheckCircle2 size={15} />
                    {slotAtual.concluido ? 'Marcar como pendente' : 'Marcar como concluido'}
                  </button>
                )}
                <button
                  onClick={onClose}
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-zinc-200 bg-white px-3 text-[10px] font-black uppercase tracking-widest text-zinc-700 transition-all hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700"
                >
                  Fechar
                </button>
              </div>
            </div>
          </div>
          <div className="mt-2 grid grid-cols-2 gap-2 sm:hidden">
            <button
              onClick={() => onToggle?.(slot)}
              disabled={!onToggle}
              className={`inline-flex h-9 items-center justify-center gap-1.5 rounded-xl px-3 text-[10px] font-black uppercase tracking-widest text-white disabled:opacity-70 ${
                slotAtual.concluido ? 'bg-zinc-700' : 'bg-emerald-600'
              }`}
            >
              <CheckCircle2 size={14} />
              {slotAtual.concluido ? 'Pendente' : 'Concluir'}
            </button>
            {!isRevisao && onStart && !slotAtual.concluido ? (
              <button
                onClick={() => onStart(slot)}
                className={`inline-flex h-9 items-center justify-center gap-1.5 rounded-xl px-3 text-[10px] font-black uppercase tracking-widest text-white ${accentBgClass}`}
              >
                <Play size={13} fill="currentColor" />
                Iniciar
              </button>
            ) : (
              <button
                onClick={onClose}
                className="inline-flex h-9 items-center justify-center rounded-xl border border-zinc-200 bg-white px-3 text-[10px] font-black uppercase tracking-widest text-zinc-700 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200"
              >
                Fechar
              </button>
            )}
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
};

const SortableTarefaCard = ({ tarefa, diaSemanaIdx, ...props }) => {
  const sortable = useSortable({
    id: getDragTaskId(tarefa),
    data: {
      type: 'task',
      dia: diaSemanaIdx,
      tarefa,
    },
  });

  const style = {
    transform: CSS.Transform.toString(sortable.transform),
    transition: sortable.isDragging ? undefined : sortable.transition,
    willChange: sortable.isDragging ? 'transform' : undefined,
  };

  return (
    <TarefaCardDraggable
      tarefa={tarefa}
      dragRef={sortable.setNodeRef}
      dragStyle={style}
      dragAttributes={sortable.attributes}
      dragListeners={sortable.listeners}
      isDragging={sortable.isDragging}
      isSortable
      {...props}
    />
  );
};

const RevisoesAgrupadasCard = ({ revisoes = [], onOpenConsolidada }) => {
  if (!revisoes.length) return null;

  const concluidas = revisoes.filter((tarefa) => tarefa.concluido).length;
  const totalMinutos = revisoes.reduce((acc, tarefa) => (
    acc + Number(tarefa.tempoMinutos ?? tarefa.tempoPlanejadoMinutos ?? tarefa.minutosEstudo ?? 0)
  ), 0);
  const totalFeito = revisoes.reduce((acc, tarefa) => {
    const planned = Number(tarefa.tempoMinutos ?? tarefa.tempoPlanejadoMinutos ?? tarefa.minutosEstudo ?? 0);
    const done = Number(tarefa.progressoMinutos || 0);
    return acc + (tarefa.concluido ? Math.max(done, planned) : done);
  }, 0);
  const topicosRevisao = revisoes.flatMap((tarefa) => {
    const dadosSlot = {
      slotId: tarefa.slotId,
      slotIdBase: tarefa.slotIdBase,
      slotIdNoProgresso: tarefa.slotIdNoProgresso,
      weekOffset: tarefa.weekOffset,
      concluido: tarefa.concluido,
      tempoMinutos: tarefa.tempoMinutos,
      tempoPlanejadoMinutos: tarefa.tempoPlanejadoMinutos,
      progressoMinutos: tarefa.progressoMinutos,
      bloqueiaDesmarcar: tarefa.bloqueiaDesmarcar,
      isRevisaoAuto: true,
    };
    if (Array.isArray(tarefa.topicosRevisao) && tarefa.topicosRevisao.length > 0) {
      return tarefa.topicosRevisao.map((topico) => ({
        ...topico,
        ...dadosSlot,
      }));
    }
    return [{
      ...dadosSlot,
      disciplinaId: tarefa.disciplinaId,
      disciplinaNome: tarefa.disciplinaNome || 'Revisão',
      assunto: tarefa.assunto || tarefa.assuntoOriginal || 'Revisão agendada',
      intervaloDias: tarefa.intervaloDias ?? '?',
    }];
  });
  const preview = topicosRevisao
    .slice(0, 2)
    .map((topico) => topico.disciplinaNome || topico.assunto)
    .join(' · ');

  return (
    <motion.button
      type="button"
      layout
      initial={{ opacity: 0, y: 8, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95, y: -4 }}
      whileHover={{ y: -2, scale: 1.01 }}
      onClick={() => onOpenConsolidada?.({
        isConsolidada: true,
        titulo: 'Revisões do Dia',
        topicosRevisao,
      })}
      className="mb-2.5 w-full overflow-hidden rounded-2xl border border-blue-200 bg-blue-50/70 text-left shadow-sm transition-all hover:border-blue-300 hover:bg-blue-50 hover:shadow-lg hover:shadow-blue-500/10 dark:border-blue-900/40 dark:bg-blue-950/10 dark:hover:border-blue-800"
    >
      <div className="flex items-center gap-3 px-3 py-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white shadow-md shadow-blue-600/20">
          <BarChart2 size={18} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <p className="text-[11px] font-black uppercase leading-tight tracking-wide text-blue-800 dark:text-blue-300">
              Revisões agrupadas
            </p>
            <span className="rounded bg-blue-600 px-1.5 py-0.5 text-[9px] font-black uppercase leading-none text-white">
              {concluidas}/{revisoes.length}
            </span>
          </div>
          <p className="mt-1 truncate text-[11px] font-semibold text-blue-700/80 dark:text-blue-300/80">
            {preview || 'Clique para ver os tópicos'}
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          {totalMinutos > 0 && (
            <span className="inline-flex items-center gap-1 rounded bg-white/80 px-1.5 py-0.5 text-[9px] font-black text-blue-700 dark:bg-blue-950/40 dark:text-blue-300">
              <Clock size={10} />
              {formatarDuracao(totalFeito)} / {formatarDuracao(totalMinutos)}
            </span>
          )}
          <span className="text-[9px] font-black uppercase tracking-wide text-blue-500">
            Ver
          </span>
        </div>
      </div>
    </motion.button>
  );
};

// ZONA DE DROP POR DIA
const DayDropZone = ({
  diaSemanaIdx, date, tarefas, isHoje,
  onToggle, onMarkPendencia, onStart,
  onDominar, onOpenConsolidada, onOpenDetails, onOpenCompletion, cronograma
}) => {
  const resumoDia = getDayStudySummary(date, tarefas);
  const {
    concluidos,
    total,
    totalMinutos: totalMinutosDia,
    progresso,
    todoConcluido,
  } = resumoDia;
  const { isOver, setNodeRef } = useDroppable({
    id: `day-${diaSemanaIdx}`,
    data: {
      type: 'day',
      dia: diaSemanaIdx,
    },
  });
  const draggablesNoDia = tarefas.filter(isMovableTask).map(getDragTaskId);
  const revisoesAgrupadas = tarefas.filter((tarefa) => tarefa.isRevisao || tarefa.isRevisaoAuto || tarefa.isConsolidada);
  const tarefasVisiveis = tarefas.filter((tarefa) => !(tarefa.isRevisao || tarefa.isRevisaoAuto || tarefa.isConsolidada));

  return (
    <div
      ref={setNodeRef}
      className={`flex flex-col rounded-[22px] border transition-all duration-300 relative
        ${isOver
          ? 'border-dashed border-red-500 bg-red-50/50 p-2 dark:bg-red-500/10 scale-[1.01] ring-2 ring-red-500/20'
          : todoConcluido
          ? isHoje
            ? 'border-emerald-400 bg-emerald-50/60 p-2 shadow-[0_22px_60px_rgba(16,185,129,0.22)] ring-2 ring-emerald-400/35 dark:border-emerald-700 dark:bg-emerald-950/20 dark:shadow-emerald-950/30 dark:ring-emerald-500/25'
            : 'border-emerald-300/70 bg-emerald-50/45 p-2 shadow-2xl shadow-emerald-500/10 dark:border-emerald-800/45 dark:bg-emerald-950/10 dark:shadow-emerald-950/20'
          : isHoje
          ? 'border-red-500 bg-white/85 p-2 shadow-[0_24px_70px_rgba(239,68,68,0.2)] ring-2 ring-red-500/35 dark:bg-zinc-950/60 dark:ring-red-500/30'
          : 'border-zinc-200 bg-zinc-50/70 p-2 shadow-sm hover:border-zinc-300 dark:border-zinc-800 dark:bg-zinc-950/30 dark:hover:border-zinc-700'
        }`}
    >
      {isHoje && (
        <div className={`pointer-events-none absolute inset-x-4 -top-px h-1 rounded-b-full ${
          todoConcluido ? 'bg-emerald-500 shadow-[0_0_18px_rgba(16,185,129,0.55)]' : 'bg-red-600 shadow-[0_0_18px_rgba(239,68,68,0.55)]'
        }`} />
      )}
      {/* Header do dia */}
      <div
        onClick={() => todoConcluido && onOpenCompletion?.({ date, tarefas })}
        title={todoConcluido ? 'Ver resumo da meta concluida' : undefined}
        className={`mb-3 shrink-0 rounded-2xl px-4 py-3 transition-all duration-300 border shadow-sm ${todoConcluido ? 'cursor-pointer hover:shadow-emerald-500/20' : ''}
        ${todoConcluido
          ? isHoje
            ? 'bg-emerald-700 text-white border-emerald-400/50 dark:bg-emerald-900 dark:text-white dark:border-emerald-500/40'
            : 'bg-zinc-900 text-white border-emerald-500/30 dark:bg-zinc-900 dark:text-white dark:border-emerald-500/30'
          : isHoje
          ? 'bg-red-700 text-white border-red-400/60 shadow-lg shadow-red-600/20 dark:bg-red-950 dark:text-white dark:border-red-500/40'
          : 'bg-zinc-900 text-white border-zinc-800 dark:bg-zinc-900 dark:text-white dark:border-zinc-800'
        }`}
      >
          <div className="flex justify-between items-start gap-3">
            <div>
              <p className={`text-[10px] font-black uppercase tracking-widest ${todoConcluido ? 'text-emerald-300 dark:text-emerald-600' : isHoje ? 'text-red-200 dark:text-red-600' : 'text-zinc-400 dark:text-zinc-500'}`}>
                {MESES_FULL[date.getMonth()]}
              </p>
              <h3 className="mt-0.5 text-lg font-black leading-none uppercase tracking-tight text-white">
                {DIAS_LONGO[diaSemanaIdx]}
              </h3>
              <div className={`mt-1 text-[11px] font-bold uppercase tracking-widest ${todoConcluido ? 'text-emerald-200 dark:text-emerald-600/80' : isHoje ? 'text-red-100 dark:text-red-600' : 'text-zinc-300 dark:text-zinc-500'}`}>
                {date.getDate()} {MESES_PT[date.getMonth()]}
              </div>
            </div>

          <div className="flex flex-col items-end gap-2">
            {todoConcluido && (
              <span className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-100 px-2 py-1 text-[9px] font-black uppercase tracking-widest text-emerald-700 shadow-sm dark:bg-emerald-500/20 dark:text-emerald-200">
                <CheckCircle2 size={12} />
                Concluido
              </span>
            )}
            <div className={`rounded-lg border px-2 py-1.5 ${
              isHoje
                ? 'border-white/20 bg-white/10 text-white dark:border-white/10 dark:bg-white/10 dark:text-white'
                : todoConcluido
                ? 'border-white/10 bg-white/10 text-white dark:border-white/10 dark:bg-white/10 dark:text-white'
                : 'border-white/10 bg-white/10 text-white dark:border-white/10 dark:bg-white/10 dark:text-white'
            }`}>
              <div className="flex items-center gap-1.5">
                <Clock size={12} className={todoConcluido ? 'text-emerald-300' : isHoje ? 'text-white' : 'text-zinc-300'} />
                <div className="flex flex-col items-end leading-none">
                  <span className={`text-[8px] font-black uppercase tracking-widest ${
                    todoConcluido ? 'text-emerald-200' : isHoje ? 'text-red-100' : 'text-zinc-300'
                  }`}>
                    Tempo
                  </span>
                  <span className="mt-0.5 text-[11px] font-black tabular-nums text-white">
                    {formatarDuracao(totalMinutosDia)}
                  </span>
                </div>
              </div>
            </div>
            {total > 0 && !todoConcluido && (
              <div className="rounded bg-white/10 px-2 py-0.5 text-[10px] font-black text-white">
                {concluidos}/{total}
              </div>
            )}
          </div>
        </div>

        {/* Progress bar no header */}
        {total > 0 && (
          <div className={`mt-3 h-1.5 rounded-full overflow-hidden ${isHoje && !todoConcluido ? 'bg-white/20' : 'bg-white/15'}`}>
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${progresso}%` }}
              transition={{ duration: 0.7, ease: 'easeOut', delay: 0.1 }}
              className={`h-full rounded-full ${todoConcluido ? 'bg-emerald-500' : isHoje ? 'bg-red-400 dark:bg-red-600' : 'bg-red-500'}`}
            />
          </div>
        )}
      </div>

      {/* Lista de tarefas */}
      <div className={`transition-opacity duration-200 ${isOver ? 'opacity-30' : 'opacity-100'}`}>
        {total === 0 ? (
          <div className="min-h-[120px] flex flex-col items-center justify-center gap-2 opacity-40 pointer-events-none">
            <div className="w-10 h-10 rounded-xl border-2 border-dashed border-zinc-300 dark:border-zinc-700 flex items-center justify-center">
              <Layers size={18} className="text-zinc-400"/>
            </div>
            <span className="text-[10px] font-bold uppercase text-zinc-400 tracking-widest">Dia Livre</span>
          </div>
        ) : (
          <SortableContext items={draggablesNoDia} strategy={verticalListSortingStrategy}>
            <AnimatePresence>
              {revisoesAgrupadas.length > 0 && (
                <RevisoesAgrupadasCard
                  key={`reviews-${diaSemanaIdx}`}
                  revisoes={revisoesAgrupadas}
                  onOpenConsolidada={onOpenConsolidada}
                />
              )}
              {tarefasVisiveis.map(t => (
                isMovableTask(t) ? (
                  <SortableTarefaCard
                    key={getDragTaskId(t)}
                    tarefa={t}
                    diaSemanaIdx={diaSemanaIdx}
                    onToggle={onToggle}
                    onMarkPendencia={onMarkPendencia}
                    onStart={onStart}
                    onDominar={onDominar}
                    onOpenConsolidada={onOpenConsolidada}
                    onOpenDetails={onOpenDetails}
                    cronograma={cronograma}
                  />
                ) : (
                  <TarefaCardDraggable
                    key={t.slotId}
                    tarefa={t}
                    onToggle={onToggle}
                    onMarkPendencia={onMarkPendencia}
                    onStart={onStart}
                    onDominar={onDominar}
                    onOpenConsolidada={onOpenConsolidada}
                    onOpenDetails={onOpenDetails}
                    cronograma={cronograma}
                  />
                )
              ))}
            </AnimatePresence>
          </SortableContext>
        )}
      </div>

      {/* Overlay de drag */}
      <AnimatePresence>
        {isOver && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="absolute inset-0 z-10 flex items-center justify-center pointer-events-none bg-red-500/5 rounded-2xl"
          >
            <motion.div
              initial={{ scale: 0.9, y: 10 }} animate={{ scale: 1, y: 0 }}
              className="bg-red-600 text-white text-[11px] font-black uppercase tracking-widest px-4 py-2 rounded-xl shadow-lg flex items-center gap-2"
            >
              <CheckCircle2 size={14}/> Mover p/ {DIAS_CURTO[diaSemanaIdx]}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// --- VISUALIZAÇÃO MENSAL -------------------------------------------------------
const VisualizacaoMensal = ({ cronograma, dataInicio, onStart, registrosEstudo = [], optimisticDone = {} }) => {
  const [mesAtual, setMesAtual] = useState(() => new Date());
  const [diaSelecionado, setDiaSelecionado] = useState(null);

  const days = useMemo(() => getCalendarDays(mesAtual.getFullYear(), mesAtual.getMonth()), [mesAtual]);
  const hojeDate = new Date();
  hojeDate.setHours(0, 0, 0, 0);
  const hoje = hojeDate.toDateString();

  const corPorDisciplina = useMemo(() => {
    const mapa = {};
    (cronograma?.semanaTemplate || []).forEach((slot) => {
      if (slot.disciplinaId && !(slot.disciplinaId in mapa)) {
        mapa[slot.disciplinaId] = getDisciplineColorForSlot(slot).hex;
      }
    });
    return mapa;
  }, [cronograma]);

  const agendaMes = useMemo(() => {
    if (!dataInicio || !cronograma?.semanaTemplate?.length || days.length === 0) {
      return { slotsPorData: {}, revisoesPorData: new Set(), metricas: { diasComEstudo: 0, blocos: 0, minutos: 0 } };
    }

    const slotsPorData = {};
    const revisoesPorData = new Set();
    const metricas = { diasComEstudo: 0, blocos: 0, minutos: 0 };
    const dominios = new Set(Object.keys(cronograma?.progresso?.dominios || {}));
    const inicio = new Date(`${dataInicio}T12:00:00`);
    const firstDate = new Date(days[0].date);
    const lastDate = new Date(days[days.length - 1].date);
    firstDate.setHours(12, 0, 0, 0);
    lastDate.setHours(12, 0, 0, 0);

    const firstDiff = Math.floor((firstDate - inicio) / (1000 * 60 * 60 * 24));
    const lastDiff = Math.floor((lastDate - inicio) / (1000 * 60 * 60 * 24));
    const weekStart = Math.max(0, Math.floor(firstDiff / 7));
    const weekEnd = Math.min((cronograma?.totalSemanasNecessarias || 26) - 1, Math.floor(lastDiff / 7));

    for (let week = weekStart; week <= weekEnd; week++) {
      const agendaSemana = getAgendaSemana(cronograma, week, null, dominios);
      agendaSemana.forEach((slot) => {
        const dataKey = slot.dataSlot;
        if (!dataKey) return;
        if (!slotsPorData[dataKey]) slotsPorData[dataKey] = [];
        const tarefa = buildCronogramaTaskState({
          cronograma,
          slot,
          weekOffset: week,
          registrosEstudo,
          optimisticDone,
        });
        const tempoMinutos = Number(tarefa.tempoMinutos ?? tarefa.minutosEstudo ?? tarefa.tempoPlanejadoMinutos ?? 0);
        slotsPorData[dataKey].push({ ...tarefa, tempoMinutos });
        if (tarefa.isRevisaoAuto) revisoesPorData.add(dataKey);
      });
    }

    Object.values(slotsPorData).forEach((slotsDia) => {
      if (!slotsDia.length) return;
      metricas.diasComEstudo += 1;
      metricas.blocos += slotsDia.length;
      metricas.minutos += slotsDia.reduce((acc, slot) => acc + Number(slot.tempoMinutos || 0), 0);
    });

    return { slotsPorData, revisoesPorData, metricas };
  }, [cronograma, dataInicio, days, optimisticDone, registrosEstudo]);

  const getSlotsEstudo = useCallback((item) => {
    if (item.type !== 'current') return [];
    const dataKey = dateToYMDLocal(item.date);
    return agendaMes.slotsPorData[dataKey] || [];
  }, [agendaMes]);

  const resumirDisciplinasDia = useCallback((slotsDia = []) => {
    const mapa = {};
    slotsDia.forEach((slot) => {
      const nome = slot.disciplinaNome || (slot.isRevisaoAuto ? 'Revisão' : 'Disciplina');
      const key = `${slot.disciplinaId || nome}`;
      if (!mapa[key]) {
        mapa[key] = {
          key,
          nome,
          disciplinaId: slot.disciplinaId,
          minutos: 0,
          blocos: 0,
          revisoes: 0,
        };
      }
      mapa[key].minutos += Number(slot.tempoMinutos ?? slot.minutosEstudo ?? 0);
      mapa[key].blocos += 1;
      if (slot.isRevisaoAuto) mapa[key].revisoes += 1;
    });
    return Object.values(mapa).sort((a, b) => b.minutos - a.minutos);
  }, []);

  const slotsDiaSelecionado = useMemo(() => {
    if (!diaSelecionado) return [];
    return getSlotsEstudo(diaSelecionado);
  }, [diaSelecionado, getSlotsEstudo]);

  const totalDiaSelecionado = useMemo(
    () => slotsDiaSelecionado.reduce((acc, slot) => acc + Number(slot.tempoMinutos ?? slot.minutosEstudo ?? 0), 0),
    [slotsDiaSelecionado],
  );

  const resumoDiaSelecionado = useMemo(() => resumirDisciplinasDia(slotsDiaSelecionado), [slotsDiaSelecionado, resumirDisciplinasDia]);

  return (
    <div className="relative flex flex-col w-full h-full bg-transparent">
      <div className="shrink-0 px-2 sm:px-3 py-4">
        <div className="flex items-center justify-between gap-4 rounded-2xl border border-zinc-200 bg-white px-4 py-3 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMesAtual((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1))}
              className="rounded-lg border border-zinc-200 bg-zinc-50 px-2 py-2 text-zinc-500 hover:text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-100 transition-colors"
            >
              <ChevronLeft size={18} />
            </button>
            <div className="flex min-w-[160px] flex-col items-center">
              <span className="mb-0.5 text-[9px] font-black uppercase tracking-widest text-zinc-500">Período</span>
              <h3 className="text-sm font-black uppercase tracking-widest text-zinc-900 dark:text-zinc-100">
                {MESES_FULL[mesAtual.getMonth()]} {mesAtual.getFullYear()}
              </h3>
            </div>
            <button
              onClick={() => setMesAtual((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1))}
              className="rounded-lg border border-zinc-200 bg-zinc-50 px-2 py-2 text-zinc-500 hover:text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-100 transition-colors"
            >
              <ChevronRight size={18} />
            </button>
          </div>

          <div className="hidden rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-2 text-[10px] font-bold uppercase tracking-widest text-zinc-600 sm:flex dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-400">
            {agendaMes.metricas.diasComEstudo} dias ativos • {agendaMes.metricas.blocos} blocos • {formatarDuracao(agendaMes.metricas.minutos)}
          </div>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col">
        <div className="min-h-0 flex-1 overflow-x-auto overflow-y-auto px-2 sm:px-3 pb-3 custom-scrollbar">
          <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            className="grid min-w-[560px] grid-cols-7 gap-1 rounded-2xl border-2 border-l-4 border-zinc-200 !border-l-red-500/20 bg-white p-2 shadow-soft dark:border-white/10 dark:!border-l-red-500/25 dark:bg-zinc-950 sm:min-w-0 sm:gap-3 sm:p-4"
          >
            {DIAS_CURTO.map((dia) => (
              <div
                key={dia}
                className="rounded-lg border border-zinc-200 bg-zinc-50 px-1 py-2 text-center text-[9px] font-black uppercase tracking-widest text-zinc-500 dark:border-white/10 dark:bg-zinc-900 dark:text-zinc-400 sm:text-[10px]"
              >
                {dia}
              </div>
            ))}

            {days.map((item, i) => {
              const slots = getSlotsEstudo(item);
              const isHoje = item.date.toDateString() === hoje;
              const isSelected = diaSelecionado?.date.toDateString() === item.date.toDateString();
              const isMesAtual = item.type === 'current';
              const dataKey = dateToYMDLocal(item.date);
              const totalMinutosDia = slots.reduce((acc, slot) => acc + Number(slot.tempoMinutos ?? slot.minutosEstudo ?? 0), 0);
              const temRevisao = agendaMes.revisoesPorData.has(dataKey) && isMesAtual;
              const concluidos = slots.filter((slot) => slot.concluido).length;
              const resumoDia = getDayStudySummary(item.date, slots);
              const diaCompleto = resumoDia.todoConcluido;
              const diaAtrasado = resumoDia.status === 'late';
              const diaPendente = resumoDia.status === 'pending' && isHoje;
              const statusLabel = resumoDia.label;
              const statusColor = diaCompleto ? 'emerald' : diaAtrasado ? 'red' : diaPendente ? 'amber' : 'zinc';
              const resumoPorDiscMap = {};

              slots.forEach((slot) => {
                const nome = getNomeDisc(slot);
                const chave = `${slot.disciplinaId || nome}::${slot.isRevisao || slot.isRevisaoAuto ? 'rev' : 'std'}`;
                if (!resumoPorDiscMap[chave]) {
                  resumoPorDiscMap[chave] = {
                    chave,
                    nome,
                    minutos: 0,
                    isRevisao: Boolean(slot.isRevisao || slot.isRevisaoAuto),
                    cor: getDisciplineColorForSlot(slot).hex || (slot.isRevisao || slot.isRevisaoAuto ? '#3b82f6' : (corPorDisciplina[slot.disciplinaId] || '#94a3b8')),
                  };
                }
                resumoPorDiscMap[chave].minutos += Number(slot.tempoMinutos ?? slot.minutosEstudo ?? 0);
              });

              const resumoPorDisc = Object.values(resumoPorDiscMap).sort((a, b) => b.minutos - a.minutos);

              return (
                <motion.button
                  key={i}
                  type="button"
                  whileHover={isMesAtual ? { y: -2, scale: 1.02 } : {}}
                  whileTap={isMesAtual ? { scale: 0.98 } : {}}
                  onClick={() => isMesAtual && slots.length > 0 && setDiaSelecionado(isSelected ? null : item)}
                  className={`group relative min-h-[92px] overflow-hidden rounded-xl border p-1.5 text-left transition-all sm:min-h-[150px] sm:p-2 ${
                    diaCompleto
                      ? 'border-emerald-300 bg-emerald-50/70 shadow-sm dark:border-emerald-900/45 dark:bg-emerald-950/15'
                      : diaAtrasado
                      ? 'border-red-300 bg-red-50/80 shadow-sm dark:border-red-900/45 dark:bg-red-950/15'
                      : diaPendente
                      ? 'border-amber-300 bg-amber-50/80 shadow-sm dark:border-amber-900/45 dark:bg-amber-950/15'
                      : isHoje
                      ? 'border-red-500 bg-red-50 shadow-sm ring-1 ring-red-500/30 dark:bg-red-500/10'
                      : isMesAtual
                      ? 'border-zinc-200 bg-white shadow-sm hover:border-zinc-300 hover:shadow-md dark:border-white/10 dark:bg-zinc-900 dark:hover:border-zinc-600'
                      : 'border-transparent bg-zinc-50 opacity-35 dark:bg-zinc-950'
                  } ${isSelected ? 'ring-2 ring-red-500 ring-offset-2 ring-offset-zinc-50 dark:ring-red-500 dark:ring-offset-zinc-950' : ''}`}
                >
                  {(isHoje || diaCompleto || diaAtrasado || diaPendente) && (
                    <div className={`pointer-events-none absolute inset-x-2 top-0 h-1 rounded-b-full ${
                      statusColor === 'emerald' ? 'bg-emerald-500' : statusColor === 'red' ? 'bg-red-600' : statusColor === 'amber' ? 'bg-amber-500' : 'bg-zinc-500'
                    }`} />
                  )}

                  <div className="relative z-10 mb-2 flex items-start justify-between gap-2">
                    <span className={`flex h-7 w-7 items-center justify-center rounded-lg text-sm font-black ${
                      diaCompleto
                        ? 'bg-emerald-600 text-white shadow-sm shadow-emerald-600/20'
                        : diaAtrasado
                        ? 'bg-red-600 text-white shadow-sm shadow-red-600/20'
                        : diaPendente
                        ? 'bg-amber-500 text-white shadow-sm shadow-amber-500/20'
                        : isHoje
                        ? 'bg-red-600 text-white shadow-sm shadow-red-600/20'
                        : isMesAtual
                        ? 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300'
                        : 'bg-transparent text-zinc-400'
                    }`}>
                      {item.day}
                    </span>
                    <div className="flex min-w-0 flex-col items-end gap-1">
                      {slots.length > 0 ? (
                        <>
                          <span className="inline-flex items-center gap-1 rounded-md border border-zinc-200 bg-white/80 px-1.5 py-0.5 text-[8px] font-black uppercase tracking-wide text-zinc-600 dark:border-white/10 dark:bg-white/10 dark:text-zinc-300">
                            <Clock size={9} />
                            {formatarDuracao(totalMinutosDia)}
                          </span>
                          <span className={`rounded-md px-1.5 py-0.5 text-[8px] font-black uppercase tracking-wide ${
                            diaCompleto
                              ? 'bg-emerald-600 text-white'
                              : diaAtrasado
                              ? 'bg-red-600 text-white'
                              : diaPendente
                              ? 'bg-amber-500 text-white'
                              : 'bg-zinc-900 text-white dark:bg-zinc-700'
                          }`}>
                            {concluidos}/{slots.length}
                          </span>
                          <span className={`rounded-md px-1.5 py-0.5 text-[8px] font-black uppercase tracking-wide ${
                            diaCompleto
                              ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300'
                              : diaAtrasado
                              ? 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300'
                              : diaPendente
                              ? 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300'
                              : 'bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400'
                          }`}>
                            {statusLabel}
                          </span>
                        </>
                      ) : isMesAtual ? (
                        <span className="rounded-md bg-zinc-100 px-1.5 py-0.5 text-[8px] font-black uppercase tracking-wide text-zinc-400 dark:bg-zinc-800/60 dark:text-zinc-500">
                          Livre
                        </span>
                      ) : null}
                    </div>
                  </div>

                  <div className="relative z-10 flex flex-col gap-1.5">
                    {resumoPorDisc.slice(0, 3).map((disc) => (
                      <div key={disc.chave} className="flex items-center justify-between gap-1.5 rounded-lg border border-zinc-100 bg-zinc-50/90 px-1.5 py-1.5 dark:border-white/5 dark:bg-zinc-800/70">
                        <div className="flex min-w-0 items-center gap-1.5">
                          <span className="h-2 w-2 shrink-0 rounded-full shadow-sm" style={{ backgroundColor: disc.cor }} />
                          <span className={`truncate text-[9px] font-black uppercase leading-none ${disc.isRevisao ? 'text-blue-600 dark:text-blue-400' : 'text-zinc-700 dark:text-zinc-300'}`}>
                            {disc.nome}
                          </span>
                        </div>
                        <span className="shrink-0 text-[9px] font-black tabular-nums text-zinc-500 dark:text-zinc-400">
                          {formatarDuracao(disc.minutos)}
                        </span>
                      </div>
                    ))}

                    {resumoPorDisc.length > 3 && (
                      <span className="mt-1 text-center text-[9px] font-black text-zinc-400 dark:text-zinc-500">
                        +{resumoPorDisc.length - 3} DISCIPLINAS
                      </span>
                    )}

                    {slots.length === 0 && isMesAtual && (
                      <div className="flex min-h-[76px] items-center justify-center rounded-lg border border-dashed border-zinc-200 bg-zinc-50/60 text-[9px] font-black uppercase tracking-widest text-zinc-400 dark:border-zinc-800 dark:bg-zinc-900/40 dark:text-zinc-600">
                        {temRevisao ? 'Revisao' : 'Sem blocos'}
                      </div>
                    )}
                  </div>
                </motion.button>
              );
            })}
          </motion.div>
        </div>
      </div>

      {typeof document !== 'undefined' && createPortal((
        <AnimatePresence>
          {diaSelecionado && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[9999] flex items-start justify-center overflow-y-auto p-3 sm:p-6"
          >
            <div className="fixed inset-0 bg-zinc-950/75 backdrop-blur-md" onClick={() => setDiaSelecionado(null)} />
            <motion.div
              initial={{ opacity: 0, y: 24, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 24, scale: 0.98 }}
              className="relative my-auto w-full max-w-2xl overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-2xl dark:border-zinc-800 dark:bg-zinc-900"
            >
              <div className="h-1.5 w-full bg-red-600 rounded-t-2xl" />
              <div className="border-b border-zinc-100 dark:border-zinc-800 px-5 py-4 bg-zinc-50 dark:bg-zinc-950/50">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-red-600 dark:text-red-500">{DIAS_LONGO[diaSelecionado.date.getDay()]}</p>
                    <h3 className="mt-1 text-xl font-black tracking-tight text-zinc-900 dark:text-white uppercase">
                      {diaSelecionado.day} {MESES_FULL[diaSelecionado.date.getMonth()]}
                    </h3>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <span className="rounded bg-zinc-200/50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                        {slotsDiaSelecionado.length} bloco{slotsDiaSelecionado.length !== 1 ? 's' : ''}
                      </span>
                      <span className="rounded bg-emerald-100 px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400">
                        {formatarDuracao(totalDiaSelecionado)}
                      </span>
                    </div>
                  </div>
                  <button onClick={() => setDiaSelecionado(null)} className="rounded-lg bg-zinc-200/50 p-2 text-zinc-500 transition-colors hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700">
                    <X size={18} />
                  </button>
                </div>
              </div>

              <div className="max-h-[70vh] overflow-y-auto p-5 space-y-4">
                {resumoDiaSelecionado.length > 0 && (
                  <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
                    <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500 dark:text-zinc-400">Mapa do Dia</p>
                    <div className="mt-3 grid gap-2">
                      {resumoDiaSelecionado.map((disc) => (
                        <div key={disc.key} className="flex items-center justify-between gap-2 rounded-lg bg-zinc-50 px-3 py-2.5 dark:bg-zinc-800/50">
                          <div className="flex min-w-0 items-center gap-2.5">
                            <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: corPorDisciplina[disc.disciplinaId] || '#94a3b8' }} />
                            <span className="truncate text-[11px] font-bold uppercase tracking-wide text-zinc-800 dark:text-zinc-200">{disc.nome}</span>
                          </div>
                          <span className="text-[11px] font-black text-zinc-500 dark:text-zinc-400 tabular-nums">{formatarDuracao(disc.minutos)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {slotsDiaSelecionado.length === 0 ? (
                  <div className="flex min-h-[200px] flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-zinc-300 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950">
                    <Layers size={24} className="text-zinc-400 dark:text-zinc-600" />
                    <p className="text-center text-[11px] font-bold uppercase tracking-widest text-zinc-500">Nenhum estudo planejado</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {slotsDiaSelecionado.map((slot, i) => (
                      <div
                        key={`${slot.slotId}-${i}`}
                        className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2.5">
                              <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: slot.isRevisaoAuto ? '#3b82f6' : (corPorDisciplina[slot.disciplinaId] || '#94a3b8') }} />
                              <p className="truncate text-xs font-black uppercase tracking-wide text-zinc-900 dark:text-zinc-100">{getNomeDisc(slot)}</p>
                            </div>
                            <p className="mt-1 text-[11px] font-medium leading-relaxed text-zinc-600 dark:text-zinc-400">
                              {getTextoAssunto(slot, cronograma)}
                            </p>
                          </div>
                          <span className="rounded bg-zinc-100 px-2 py-1 text-[10px] font-black uppercase tracking-wide text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                            {formatarDuracao(Number(slot.tempoMinutos ?? slot.minutosEstudo ?? 0))}
                          </span>
                        </div>

                        <div className="mt-3 flex flex-wrap items-center gap-2">
                          <span className={`rounded px-2 py-0.5 text-[9px] font-black uppercase tracking-wide ${slot.isRevisaoAuto ? 'bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400' : 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300'}`}>
                            {getLabelTipo(slot)}
                          </span>
                          {!slot.isRevisaoAuto && onStart && (
                            <button
                              type="button"
                              onClick={() => onStart(slot)}
                              className="ml-auto inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-white transition-colors hover:bg-red-700"
                            >
                              <Play size={12} fill="currentColor" />
                              Estudar
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
          )}
        </AnimatePresence>
      ), document.body)}
    </div>
  );
};

const VisualizacaoLista = ({ cronograma, weekDates, tarefasPorDia, onStart, onOpenConsolidada, onOpenCompletion, onToggle, onMarkPendencia, onDominar }) => {
  const hojeDate = new Date();
  hojeDate.setHours(0, 0, 0, 0);
  const hojeStr = hojeDate.toDateString();
  const semanaExibidaContemHoje = weekDates.some((date) => date.toDateString() === hojeStr);
  const diasComItens = weekDates
    .map((date) => {
      const dia = date.getDay();
      const tarefas = tarefasPorDia[dia] || [];
      return { date, dia, tarefas };
    })
    .filter(({ date, tarefas }) => {
      const isHoje = date.toDateString() === hojeStr;
      if (isHoje) return true;
      if (tarefas.length === 0) return false;
      if (!semanaExibidaContemHoje) return true;

      const dataDia = new Date(date);
      dataDia.setHours(0, 0, 0, 0);
      return dataDia.getTime() > hojeDate.getTime();
    })
    .sort((a, b) => {
      const aHoje = a.date.toDateString() === hojeStr;
      const bHoje = b.date.toDateString() === hojeStr;
      if (aHoje && !bHoje) return -1;
      if (!aHoje && bHoje) return 1;
      return a.date.getTime() - b.date.getTime();
    });
  const tarefasTimeline = diasComItens.flatMap(({ date, dia, tarefas }) => (
    tarefas.map((tarefa) => ({ date, dia, tarefa }))
  ));
  const totalPlanejado = tarefasTimeline.reduce((acc, item) => (
    acc + Number(item.tarefa.tempoPlanejadoMinutos ?? item.tarefa.tempoMinutos ?? item.tarefa.minutosEstudo ?? 0)
  ), 0);
  const totalProgresso = tarefasTimeline.reduce((acc, item) => {
    const tempo = Number(item.tarefa.tempoPlanejadoMinutos ?? item.tarefa.tempoMinutos ?? item.tarefa.minutosEstudo ?? 0);
    const progresso = item.tarefa.concluido
      ? Math.max(Number(item.tarefa.progressoMinutos || 0), tempo)
      : Math.min(Number(item.tarefa.progressoMinutos || 0), tempo || Number(item.tarefa.progressoMinutos || 0));
    return acc + progresso;
  }, 0);
  const progressoSemana = totalPlanejado > 0 ? Math.round((totalProgresso / totalPlanejado) * 100) : 0;
  const activeIndex = tarefasTimeline.findIndex(({ tarefa }) => !tarefa.concluido && tarefa.dominado !== true);
  let indiceInicial = 0;
  const diasComIndice = diasComItens.map((diaItem) => {
    const inicio = indiceInicial;
    indiceInicial += diaItem.tarefas.length;
      const totalMinutos = diaItem.tarefas.reduce((acc, tarefa) => (
        acc + Number(tarefa.tempoPlanejadoMinutos ?? tarefa.tempoMinutos ?? tarefa.minutosEstudo ?? 0)
      ), 0);
    return {
      ...diaItem,
      inicio,
      totalMinutos,
      concluidos: diaItem.tarefas.filter((tarefa) => tarefa.concluido).length,
      revisoes: diaItem.tarefas.filter((tarefa) => tarefa.isRevisao || tarefa.isRevisaoAuto).length,
    };
  });

  return (
    <motion.div
      key="list"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 16 }}
      className="mx-auto w-full max-w-5xl px-1 sm:px-4"
    >
      <div className="relative mb-5 overflow-hidden rounded-2xl border border-zinc-200/80 bg-white/70 p-4 shadow-lg shadow-red-500/10 backdrop-blur-md dark:border-zinc-800 dark:bg-zinc-950/40 dark:shadow-red-950/20 sm:mb-8 sm:rounded-[32px] sm:p-6 sm:shadow-xl sm:shadow-red-500/15">
        <div className="pointer-events-none absolute right-0 top-0 h-24 w-24 rounded-full bg-red-500/10 blur-[50px] sm:h-32 sm:w-32 sm:blur-[60px]" />

        <div className="relative z-10 flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3 sm:gap-4">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-red-600 text-white shadow-lg shadow-red-600/25 sm:h-14 sm:w-14 sm:rounded-2xl">
              <Zap size={22} className="sm:h-7 sm:w-7" fill="currentColor" />
            </div>
            <div className="min-w-0">
              <p className="text-[9px] font-black uppercase tracking-[0.24em] text-red-600 dark:text-red-400 sm:text-[10px] sm:tracking-[0.3em]">Guia da semana</p>
              <h2 className="truncate text-lg font-black uppercase leading-none tracking-tight text-zinc-900 dark:text-white sm:text-2xl">Sugestão de Estudo</h2>
            </div>
          </div>

          <div className="shrink-0 text-right">
            <div className="flex items-center justify-end gap-1.5">
              <Clock size={14} className="text-red-500 sm:h-4 sm:w-4" />
              <span className="text-sm font-black tabular-nums text-zinc-900 dark:text-white sm:text-xl">
                {formatarDuracao(totalProgresso)}
                <span className="mx-1 text-xs font-medium text-zinc-400 sm:text-sm">/</span>
                {formatarDuracao(totalPlanejado)}
              </span>
            </div>
            <p className="text-[8px] font-black uppercase tracking-widest text-zinc-400 sm:text-[10px]">Horas da semana</p>
          </div>
        </div>

        <div className="mt-4 sm:mt-6">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-[9px] font-black uppercase tracking-widest text-zinc-500 sm:text-[10px]">Progresso da lista</span>
            <span className="text-sm font-black text-red-600 dark:text-red-400">{progressoSemana}%</span>
          </div>
          <div className="h-2.5 w-full overflow-hidden rounded-full border border-zinc-200/50 bg-zinc-100 p-0.5 dark:border-zinc-700/50 dark:bg-zinc-800 sm:h-3">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${Math.min(progressoSemana, 100)}%` }}
              transition={{ duration: 1.2, ease: 'circOut' }}
              className="h-full rounded-full bg-gradient-to-r from-red-600 via-rose-500 to-orange-500 shadow-[0_0_8px_rgba(220,38,38,0.4)]"
            />
          </div>
        </div>
      </div>

      {tarefasTimeline.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-zinc-300 bg-zinc-50/60 p-8 text-center dark:border-zinc-700 dark:bg-zinc-900/30 sm:rounded-[32px]">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-zinc-100 text-zinc-400 dark:bg-zinc-800">
            <Clock size={22} />
          </div>
          <h3 className="text-sm font-black uppercase text-zinc-800 dark:text-zinc-200">Semana sem blocos</h3>
          <p className="mt-2 text-xs font-medium text-zinc-500 dark:text-zinc-400">Nao ha estudos agendados para esta lista.</p>
        </div>
      ) : (
        <div className="space-y-5 pb-6 sm:space-y-6 sm:pb-8">
          {diasComIndice.map(({ date, dia, tarefas, inicio, totalMinutos, concluidos, revisoes }) => {
            const hojeDia = date.toDateString() === hojeStr;
            const resumoDia = getDayStudySummary(date, tarefas);
            const diaCompleto = resumoDia.todoConcluido;

            return (
              <section
                key={date.getTime()}
                className={`overflow-hidden rounded-3xl border shadow-sm ${
                  diaCompleto
                      ? 'border-emerald-200 bg-emerald-50/40 dark:border-emerald-900/40 dark:bg-emerald-950/10'
                    : hojeDia
                      ? 'border-red-200 bg-white shadow-red-500/10 dark:border-red-900/50 dark:bg-zinc-950/50'
                      : 'border-zinc-200 bg-white/70 dark:border-zinc-800 dark:bg-zinc-950/40'
                }`}
              >
                <div
                  onClick={() => diaCompleto && onOpenCompletion?.({ date, tarefas })}
                  title={diaCompleto ? 'Ver resumo da meta concluida' : undefined}
                  className={`flex flex-col gap-3 border-b px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5 ${diaCompleto ? 'cursor-pointer' : ''} ${
                  diaCompleto
                      ? 'border-emerald-100 bg-emerald-50/70 dark:border-emerald-900/30 dark:bg-emerald-950/10'
                    : hojeDia
                      ? 'border-red-100 bg-red-50/70 dark:border-red-900/40 dark:bg-red-950/10'
                      : 'border-zinc-100 bg-zinc-50/80 dark:border-zinc-800 dark:bg-zinc-900/40'
                }`}>
                  <div className="flex min-w-0 items-center gap-3">
                    <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-white shadow-lg ${
                      diaCompleto ? 'bg-emerald-600 shadow-emerald-600/20' : hojeDia ? 'bg-red-600 shadow-red-600/20' : 'bg-zinc-900 shadow-zinc-900/10 dark:bg-zinc-800'
                    }`}>
                      {diaCompleto ? <Trophy size={19} /> : hojeDia ? <Flame size={19} /> : <CalendarDays size={19} />}
                    </div>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-base font-black uppercase leading-none tracking-tight text-zinc-900 dark:text-white sm:text-lg">
                          {DIAS_LONGO[dia]}
                        </h3>
                        {hojeDia && (
                          <span className="rounded-md bg-red-600 px-2 py-0.5 text-[9px] font-black uppercase tracking-widest text-white">
                            Hoje
                          </span>
                        )}
                        {diaCompleto && (
                          <span className="inline-flex items-center gap-1 rounded-md bg-emerald-600 px-2 py-0.5 text-[9px] font-black uppercase tracking-widest text-white">
                            <CheckCircle2 size={11} />
                            Concluido
                          </span>
                        )}
                      </div>
                      <p className="mt-1 text-[10px] font-black uppercase tracking-widest text-zinc-400">
                        {date.getDate()} {MESES_FULL[date.getMonth()]} • {tarefas.length} bloco{tarefas.length === 1 ? '' : 's'}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                    <span className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-zinc-600 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300">
                      <Clock size={12} />
                      {formatarDuracao(totalMinutos)}
                    </span>
                    {revisoes > 0 && (
                      <span className="inline-flex items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-blue-700 dark:border-blue-900/40 dark:bg-blue-950/20 dark:text-blue-300">
                        <BarChart2 size={12} />
                        {revisoes} rev.
                      </span>
                    )}
                    {tarefas.length > 0 ? (
                      <span className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[10px] font-black uppercase tracking-wider ${
                        diaCompleto
                          ? 'bg-emerald-600 text-white'
                          : 'bg-zinc-900 text-white dark:bg-zinc-800'
                      }`}>
                        {concluidos}/{tarefas.length}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 rounded-lg bg-zinc-100 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
                        Dia livre
                      </span>
                    )}
                  </div>
                </div>

                  <div className="relative px-3 py-4 sm:px-5">
                  <div className="absolute bottom-4 left-[31px] top-4 w-0.5 bg-zinc-200 dark:bg-zinc-800 sm:left-[47px]" />

                  <div className="relative z-10 space-y-3 sm:space-y-4">
                    {tarefas.length === 0 && (
                      <div className="ml-0 rounded-2xl border border-dashed border-zinc-200 bg-white/70 px-4 py-4 text-sm font-semibold text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900/40 dark:text-zinc-400 sm:ml-16">
                        Hoje está livre no seu cronograma. Os próximos blocos aparecem abaixo.
                      </div>
                    )}
                    {tarefas.map((tarefa, tarefaIdx) => {
                      const idx = inicio + tarefaIdx;
              const hoje = date.toDateString() === hojeStr;
              const isRevisao = tarefa.isRevisao || tarefa.isRevisaoAuto;
              const isDominado = tarefa.dominado === true;
              const isCompleted = tarefa.concluido;
              const isActive = idx === activeIndex;
              const tempo = Number(tarefa.tempoPlanejadoMinutos ?? tarefa.tempoMinutos ?? tarefa.minutosEstudo ?? 0);
              const progressoRaw = Number(tarefa.progressoMinutos || 0);
              const progressoMinutos = isCompleted
                ? Math.max(progressoRaw, tempo)
                : Math.min(progressoRaw, tempo || progressoRaw);
              const progressoPercentual = tempo > 0
                ? Math.min(100, Math.round((progressoMinutos / tempo) * 100))
                : (isCompleted ? 100 : 0);
              const emAndamento = !isCompleted && progressoMinutos > 0 && progressoPercentual < 100;
              const canStart = !tarefa.isRevisaoAuto && !isCompleted;

                      return (
                <div key={`${date.getTime()}-${tarefa.slotId || idx}`} className="group flex items-start gap-3 sm:gap-8">
                  <div className="relative mt-2 flex shrink-0 items-center justify-center">
                    {isCompleted ? (
                      <div className="z-10 flex h-8 w-8 items-center justify-center rounded-full bg-emerald-500 text-white shadow-lg shadow-emerald-500/40 ring-4 ring-white dark:ring-zinc-950 sm:h-10 sm:w-10">
                        <Check size={16} className="sm:h-5 sm:w-5" strokeWidth={4} />
                      </div>
                    ) : isActive ? (
                      <div className={`relative z-10 flex h-8 w-8 items-center justify-center rounded-full text-white ring-4 ring-white dark:ring-zinc-950 sm:h-10 sm:w-10 ${
                        isRevisao
                          ? 'bg-blue-600 shadow-[0_0_15px_rgba(37,99,235,0.45)]'
                          : 'bg-red-600 shadow-[0_0_15px_rgba(220,38,38,0.5)]'
                      }`}>
                        <span className={`absolute inset-0 animate-ping rounded-full opacity-35 ${isRevisao ? 'bg-blue-500' : 'bg-red-500'}`} />
                        {isRevisao ? <BarChart2 size={14} className="sm:h-[18px] sm:w-[18px]" /> : <Play size={14} className="sm:h-[18px] sm:w-[18px]" fill="currentColor" />}
                      </div>
                    ) : (
                      <div className="z-10 flex h-8 w-8 items-center justify-center rounded-full border-2 border-zinc-200 bg-zinc-100 text-zinc-400 ring-4 ring-white dark:border-zinc-700 dark:bg-zinc-800 dark:ring-zinc-950 sm:h-10 sm:w-10">
                        <span className="text-[10px] font-black sm:text-xs">{idx + 1}</span>
                      </div>
                    )}
                  </div>

                  <div
                    className={`flex-1 overflow-hidden rounded-2xl border sm:rounded-3xl ${
                      isActive
                        ? isRevisao
                          ? 'border-blue-500/35 bg-blue-50/70 shadow-2xl shadow-blue-500/10 dark:border-blue-900/50 dark:bg-blue-950/10'
                          : 'border-red-200 bg-red-50/70 shadow-2xl shadow-red-500/10 dark:border-red-900/50 dark:bg-red-950/10'
                        : isCompleted
                          ? 'border-emerald-200 bg-emerald-50/60 shadow-lg dark:border-emerald-900/40 dark:bg-emerald-950/10'
                          : isDominado
                            ? 'border-amber-200 bg-amber-50/70 shadow-lg shadow-amber-500/10 dark:border-amber-900/30 dark:bg-amber-950/10'
                            : isRevisao
                              ? 'border-blue-100 bg-blue-50/30 shadow-lg shadow-blue-500/5 dark:border-blue-900/30 dark:bg-blue-950/10'
                              : 'border-zinc-200 bg-white shadow-sm hover:border-zinc-300 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-zinc-700'
                    }`}
                  >
                    <div className="p-3 sm:p-4">
                      <div className="flex items-start justify-between gap-2 sm:gap-3">
                        <div className="flex min-w-0 items-start gap-2">
                          <button
                            onClick={() => onToggle(tarefa)}
                            title={isCompleted ? 'Marcar como pendente' : 'Marcar como concluido'}
                            className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border shadow-sm ${
                              isCompleted
                                ? 'border-emerald-500 bg-emerald-500 text-white shadow-emerald-500/20'
                                : 'border-emerald-200 bg-white text-emerald-600 shadow-emerald-500/10 hover:border-emerald-300 hover:bg-emerald-50 dark:border-emerald-900/40 dark:bg-white/10 dark:text-emerald-300 dark:hover:bg-emerald-900/35'
                            }`}
                          >
                            <Check size={15} strokeWidth={3.5} />
                          </button>
                          <div className="min-w-0">
                          <h3 className={`text-sm font-black uppercase leading-tight tracking-tight sm:text-base ${
                            isCompleted ? 'text-emerald-800 dark:text-emerald-200' : 'text-zinc-900 dark:text-white'
                          }`}>
                            {getNomeDisc(tarefa)}
                          </h3>
                          </div>
                        </div>

                        {tempo > 0 && (
                          <div className="flex shrink-0 items-center gap-1.5 rounded-lg border border-zinc-200/50 bg-zinc-100 px-2 py-1 dark:border-zinc-700/50 dark:bg-zinc-800">
                            <Clock size={12} className="text-zinc-400" />
                            <span className="text-sm font-black tabular-nums text-zinc-600 dark:text-zinc-300">
                              {formatarDuracao(tempo)}
                            </span>
                          </div>
                        )}
                      </div>

                      <div className={`mt-2.5 flex items-center gap-2 rounded-xl border p-2 sm:mt-3 sm:gap-2.5 ${
                        tarefa.isPendenciaTeoria
                          ? 'border-amber-200 bg-amber-50/50 text-amber-700 dark:border-amber-900/30 dark:bg-amber-950/20 dark:text-amber-300'
                          : isRevisao
                            ? 'border-blue-100 bg-blue-50/60 text-blue-700 dark:border-blue-900/30 dark:bg-blue-950/20 dark:text-blue-300'
                            : 'border-zinc-100 bg-zinc-50 text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900/30'
                      }`}>
                        <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${
                          tarefa.isPendenciaTeoria ? 'bg-amber-500 text-white' : isRevisao ? 'bg-blue-500 text-white' : 'bg-white shadow-sm dark:bg-zinc-800'
                        }`}>
                          {tarefa.isPendenciaTeoria ? <AlertTriangle size={14} /> : isRevisao ? <BarChart2 size={14} /> : <BookOpen size={14} />}
                        </div>
                        <div className="min-w-0">
                          <p className="text-[9px] font-black uppercase tracking-widest opacity-60">
                            {tarefa.isPendenciaTeoria ? 'Retomar Assunto' : isRevisao ? 'Revisao Agendada' : 'Assunto Sugerido'}
                          </p>
                          <p className="truncate text-[11px] font-bold sm:text-xs">{getTextoAssunto(tarefa, cronograma)}</p>
                        </div>
                      </div>

                      {tempo > 0 && (
                        <div className="mt-2.5 flex items-end gap-2 sm:mt-3">
                          <div className="min-w-0 flex-1">
                            <div className="mb-1 flex items-center justify-between gap-2 text-[10px] font-black uppercase tracking-wide">
                              <span className={isCompleted ? 'text-emerald-600 dark:text-emerald-400' : emAndamento ? 'text-orange-600 dark:text-orange-400' : 'text-zinc-400'}>
                                {formatarDuracao(progressoMinutos)} / {formatarDuracao(tempo)}
                              </span>
                              <span className="text-[11px] text-zinc-400">{progressoPercentual}%</span>
                            </div>
                            <div className="h-1 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800">
                              <div
                                style={{ width: `${progressoPercentual}%` }}
                                className={`h-full rounded-full ${isCompleted ? 'bg-emerald-500' : emAndamento ? 'bg-orange-500' : isRevisao ? 'bg-blue-500' : 'bg-red-500'}`}
                              />
                            </div>
                          </div>
                          {canStart && (
                            <button
                              onClick={() => onStart(tarefa)}
                              title="Iniciar estudo"
                              className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-red-600 text-white shadow-sm shadow-red-600/20 transition-all hover:bg-red-700 active:scale-95"
                            >
                              <Play size={14} fill="currentColor" />
                            </button>
                          )}
                        </div>
                      )}

                      {isActive && tarefa.isConsolidada && !isCompleted && (
                        <div className="mt-3 flex w-full items-center gap-2">
                          {tarefa.isConsolidada && !isCompleted && (
                            <button
                              onClick={() => onOpenConsolidada(tarefa)}
                              className="inline-flex h-8 min-w-0 flex-1 items-center justify-center gap-1.5 rounded-lg bg-blue-600 px-3 text-[9px] font-black uppercase tracking-wide text-white shadow-md shadow-blue-600/15 transition-all hover:bg-blue-700 active:scale-95 sm:h-9 sm:px-4"
                            >
                              <BarChart2 size={14} />
                              Ver Revisao
                            </button>
                          )}
                        </div>
                      )}

                      {!isCompleted && (
                        <div className="mt-0 flex h-0 w-full items-center gap-2 overflow-hidden opacity-0 transition-all duration-200 group-hover:mt-2.5 group-hover:h-9 group-hover:opacity-100 group-focus-within:mt-2.5 group-focus-within:h-9 group-focus-within:opacity-100 sm:group-hover:mt-3 sm:group-focus-within:mt-3">
                          {!tarefa.isRevisaoAuto && (
                            <button
                              onClick={() => onDominar(tarefa)}
                              title={isDominado ? 'Assunto ja dominado: nao priorizar novas revisoes desse topico.' : 'Ja dominei: marque quando voce domina o assunto e quer reduzir revisoes futuras.'}
                              className={`flex h-8 min-w-0 flex-1 items-center justify-center gap-1.5 rounded-lg border px-3 text-[9px] font-black uppercase tracking-wide transition-colors ${
                                isDominado
                                  ? 'border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-300 dark:hover:bg-amber-950/30'
                                  : 'border-dashed border-zinc-300 bg-transparent text-zinc-500 hover:border-amber-300 hover:bg-amber-50 hover:text-amber-600 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-amber-950/20 dark:hover:text-amber-300'
                              }`}
                            >
                              <BadgeCheck size={14} className={isDominado ? 'fill-amber-400 text-amber-500' : ''} strokeWidth={isDominado ? 0 : 2} />
                              {isDominado ? 'Dominado' : 'Marcar dominio'}
                            </button>
                          )}
                          {!isRevisao && (
                            <button
                              onClick={() => onMarkPendencia(tarefa)}
                              title="Pendente: mova este assunto para retomar depois sem marcar como concluido."
                              className="flex h-8 min-w-0 flex-1 items-center justify-center gap-1.5 rounded-lg bg-amber-50 px-3 text-[9px] font-black uppercase tracking-wide text-amber-700 transition-colors hover:bg-amber-100 dark:bg-amber-950/20 dark:text-amber-300 dark:hover:bg-amber-950/30"
                            >
                              <SkipForward size={14} />
                              Pendente
                            </button>
                          )}
                        </div>
                      )}

                      {isCompleted && (
                        <div className="mt-3 flex w-full items-center gap-2">
                          <div className="flex h-8 min-w-0 flex-1 items-center justify-center gap-1.5 rounded-xl border border-emerald-200 bg-white/70 px-3 text-[9px] font-black uppercase tracking-wider text-emerald-700 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-300">
                            <CheckCircle2 size={14} />
                            Estudo concluido
                          </div>
                          <button
                            onClick={() => onToggle(tarefa)}
                            className="flex h-8 min-w-0 flex-1 items-center justify-center gap-1.5 rounded-xl bg-white/70 px-3 text-[9px] font-black uppercase tracking-wider text-zinc-500 transition-colors hover:text-zinc-800 dark:bg-zinc-900/50 dark:hover:text-white"
                          >
                            <MoreHorizontal size={14} />
                            Alterar
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
                    })}
                  </div>
                </div>
              </section>
            );
          })}
        </div>
      )}
    </motion.div>
  );
};

const SemanaHojeHero = ({ date, tarefas }) => {
  if (!date) return null;

  const total = tarefas.length;
  const concluidos = tarefas.filter((t) => t.concluido).length;
  const pendencias = tarefas.filter((t) => t.isPendenciaTeoria && !t.concluido).length;
  const revisoes = tarefas.filter((t) => t.isRevisao || t.isRevisaoAuto).length;
  const totalMinutos = tarefas.reduce((acc, tarefa) => (
    acc + Number(tarefa.tempoMinutos ?? tarefa.tempoPlanejadoMinutos ?? tarefa.minutosEstudo ?? 0)
  ), 0);
  const progresso = total > 0 ? Math.round((concluidos / total) * 100) : 0;
  const diaConcluido = total > 0 && concluidos === total;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className={`mb-4 overflow-hidden rounded-3xl border bg-white dark:bg-zinc-900 ${
        diaConcluido
          ? 'border-emerald-200 shadow-[0_24px_60px_rgba(16,185,129,0.12)] dark:border-emerald-900/50 dark:shadow-emerald-950/20'
          : 'border-red-200 shadow-[0_24px_60px_rgba(239,68,68,0.12)] dark:border-red-900/50 dark:shadow-red-950/20'
      }`}
    >
      <div className="relative grid gap-5 p-5 sm:grid-cols-[1.2fr_0.8fr] sm:p-6">
        <div className={`absolute inset-x-0 top-0 h-1 ${diaConcluido ? 'bg-gradient-to-r from-emerald-400 via-green-500 to-teal-400' : 'bg-red-600'}`} />
        <div className="min-w-0">
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <span className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[10px] font-black uppercase tracking-widest text-white ${
              diaConcluido ? 'bg-emerald-600' : 'bg-red-600'
            }`}>
              {diaConcluido ? <CheckCircle2 size={12} /> : <Flame size={12} />} Hoje
            </span>
            <span className="rounded-lg bg-zinc-100 px-2.5 py-1 text-[10px] font-black uppercase tracking-widest text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
              {formatarDataLonga(date)}
            </span>
          </div>
          <h3 className="text-2xl font-black uppercase leading-tight tracking-tight text-zinc-900 dark:text-white">
            {DIAS_LONGO[date.getDay()]} em foco
          </h3>
          <p className="mt-2 max-w-2xl text-sm font-medium leading-relaxed text-zinc-600 dark:text-zinc-400">
            Os blocos de hoje aparecem primeiro para facilitar iniciar, concluir e ajustar pendências sem disputar espaço com o restante da semana.
          </p>

          <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-800 dark:bg-zinc-950/50">
              <p className="text-[9px] font-black uppercase tracking-widest text-zinc-400">Blocos</p>
              <p className="mt-1 text-xl font-black text-zinc-900 dark:text-white">{total}</p>
            </div>
            <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-800 dark:bg-zinc-950/50">
              <p className="text-[9px] font-black uppercase tracking-widest text-zinc-400">Tempo</p>
              <p className="mt-1 text-xl font-black text-zinc-900 dark:text-white">{formatarDuracao(totalMinutos)}</p>
            </div>
            <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-800 dark:bg-zinc-950/50">
              <p className="text-[9px] font-black uppercase tracking-widest text-zinc-400">Revisões</p>
              <p className="mt-1 text-xl font-black text-blue-600 dark:text-blue-400">{revisoes}</p>
            </div>
            <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-800 dark:bg-zinc-950/50">
              <p className="text-[9px] font-black uppercase tracking-widest text-zinc-400">Pendências</p>
              <p className="mt-1 text-xl font-black text-amber-600 dark:text-amber-400">{pendencias}</p>
            </div>
          </div>
        </div>

        <div className="relative flex min-h-[180px] items-center justify-center overflow-hidden rounded-3xl bg-zinc-950 p-5 text-white dark:bg-zinc-950">
            <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(127,29,29,0.92),rgba(24,24,27,0.98)_48%,rgba(9,9,11,1))]" />
            <div className="relative z-10 flex flex-col items-center text-center">
              <div className="relative mb-3 h-28 w-28">
                <svg className="h-28 w-28 -rotate-90" viewBox="0 0 112 112">
                  <circle cx="56" cy="56" r="48" fill="none" stroke="currentColor" className="text-white/10" strokeWidth="8" />
                  <motion.circle
                    cx="56"
                    cy="56"
                    r="48"
                    fill="none"
                    stroke="currentColor"
                    className={diaConcluido ? 'text-emerald-400' : 'text-red-500'}
                    strokeWidth="8"
                    strokeLinecap="round"
                    strokeDasharray={2 * Math.PI * 48}
                    initial={{ strokeDashoffset: 2 * Math.PI * 48 }}
                    animate={{ strokeDashoffset: 2 * Math.PI * 48 * (1 - Math.min(progresso, 100) / 100) }}
                    transition={{ duration: 1, ease: 'easeOut' }}
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-3xl font-black">{progresso}%</span>
                  <span className="text-[9px] font-black uppercase tracking-widest text-white/50">
                    {diaConcluido ? 'Concluido' : 'Hoje'}
                  </span>
                </div>
              </div>
              <p className={`text-xs font-black uppercase tracking-widest ${diaConcluido ? 'text-emerald-200' : 'text-white/70'}`}>
                {concluidos}/{total || 0} concluídos
              </p>
            </div>
        </div>
      </div>
    </motion.div>
  );
};

// --- PÁGINA PRINCIPAL ----------------------------------------------------------
const CronogramaPage = ({ user, onStartStudy, addRegistroEstudo, deleteCompletionRegistro, registrosEstudo = [], onDeleteRegistro, onGoToEdital }) => {
  const [cronograma,        setCronograma]        = useState(null);
  const [loadingPage,       setLoadingPage]       = useState(true);
  const [showWizard,        setShowWizard]        = useState(false);
  const [weekOffset,        setWeekOffset]        = useState(0);
  const [toast,             setToast]             = useState(null);
  const [loadingAction,     setLoadingAction]     = useState(false);
  const [toggleLoadingId,   setToggleLoadingId]   = useState(null);
  const [viewMode,          setViewMode]          = useState('week');
  const [slotConsolidado,   setSlotConsolidado]   = useState(null);
  const [mostrandoEditar,   setMostrandoEditar]   = useState(false);
  const [dominiosLocal,     setDominiosLocal]     = useState({});
  const [activeDragTask,    setActiveDragTask]    = useState(null);
  const [slotDetalhes,      setSlotDetalhes]      = useState(null);
  const [showHistoryModal,  setShowHistoryModal]  = useState(false);
  const [recordToDelete,    setRecordToDelete]    = useState(null);
  const [showTimerSettings, setShowTimerSettings] = useState(false);
  const [delayConfirmation, setDelayConfirmation] = useState(null);
  const [undoDelayData,     setUndoDelayData]     = useState(null);
  const [optimisticDone,    setOptimisticDone]    = useState({});
  const [configMenuOpen,    setConfigMenuOpen]    = useState(false);
  const [editInitialMode,   setEditInitialMode]   = useState('simple');
  const [completionModalData, setCompletionModalData] = useState(null);
  const [editalTemplateData, setEditalTemplateData] = useState(null);

  const weekScrollRef = useRef(null);
  const configMenuRef = useRef(null);
  const weekPanRef = useRef({ active: false, moved: false, startX: 0, currentX: 0, scrollLeft: 0, pointerId: null, rafId: null });
  const didInitWeekOffsetRef = useRef(false);
  const toggleQueueRef = useRef({});
  const toggleIntentRef = useRef({});
  const dragSensors = useSensors(useSensor(PointerSensor, {
    activationConstraint: {
      distance: 6,
    },
  }));

  const {
    getWeekDates,
    getCurrentWeekOffset,
    toggleSlotConcluido,
    marcarTeoriaAindaNaoConcluida,
    toggleAssuntoDominado,
  } = useCronogramaSystem(user);

  const showToast = useCallback((msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2800);
  }, []);

  const handleCronogramaCriado = useCallback(async (cronogramaId) => {
    setShowWizard(false);
    if (!cronogramaId || !user?.uid) {
      setLoadingPage(false);
      return;
    }

    try {
      const snap = await getDoc(doc(db, 'users', user.uid, 'cronogramas', cronogramaId));
      if (!snap.exists()) {
        setLoadingPage(false);
        return;
      }

      const novoCronograma = { id: snap.id, ref: snap.ref, ...snap.data() };
      setCronograma(novoCronograma);
      setWeekOffset(getCurrentWeekOffset(novoCronograma.dataInicio));
      didInitWeekOffsetRef.current = true;
      setDominiosLocal(novoCronograma.progresso?.dominios || {});
      setLoadingPage(false);
      showToast('? Cronograma criado!');
    } catch (error) {
      console.error('[CronogramaPage] Falha ao abrir cronograma criado:', error);
      setLoadingPage(false);
    }
  }, [getCurrentWeekOffset, showToast, user?.uid]);

  const adiarCronograma = async (cronogramaId, cronogramaAtual) => {
    try {
      const dataAtual = new Date(cronogramaAtual.dataInicio + 'T12:00:00');
      const dataAnterior = cronogramaAtual.dataInicio;
      dataAtual.setDate(dataAtual.getDate() + 7);
      const novaData = dataAtual.toISOString().split('T')[0];
      await updateDoc(doc(db, 'users', user.uid, 'cronogramas', cronogramaId), { dataInicio: novaData });
      setUndoDelayData({ cronogramaId, previousDate: dataAnterior, nextDate: novaData });
      showToast('?? Cronograma adiado em 1 semana!');
    } catch (e) {
      showToast('? Erro ao adiar. Tente novamente.');
    }
  };

  const desfazerAdiamentoCronograma = async () => {
    if (!undoDelayData?.cronogramaId || !undoDelayData?.previousDate) return;
    setLoadingAction(true);
    try {
      await updateDoc(doc(db, 'users', user.uid, 'cronogramas', undoDelayData.cronogramaId), { dataInicio: undoDelayData.previousDate });
      setUndoDelayData(null);
      showToast('?? Adiamento revertido!');
    } catch (e) {
      showToast('? Erro ao reverter adiamento.');
    } finally {
      setLoadingAction(false);
    }
  };

  // Listener Firestore
  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, 'users', user.uid, 'cronogramas'), where('ativo', '==', true));
    return onSnapshot(q, async snap => {
      if (snap.empty) { setCronograma(null); setLoadingPage(false); return; }
      const docs = snap.docs.map(d => ({ id: d.id, ref: d.ref, ...d.data() })).sort((a, b) => getDocTimestamp(b) - getDocTimestamp(a));
      const maisRecente = docs[0];
      if (docs.length > 1) {
        try {
          const batch = writeBatch(db);
          docs.slice(1).forEach(d => batch.update(doc(db, 'users', user.uid, 'cronogramas', d.id), { ativo: false }));
          await batch.commit();
        } catch (e) { console.error(e); }
      }
      setCronograma(maisRecente);
      if (!didInitWeekOffsetRef.current) {
        setWeekOffset(getCurrentWeekOffset(maisRecente.dataInicio));
        didInitWeekOffsetRef.current = true;
      }
      setLoadingPage(false);
      setDominiosLocal(maisRecente.progresso?.dominios || {});
    });
  }, [user]);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const onOptimisticProgress = (event) => {
      const registro = event?.detail || {};
      if (registro?.contextoRegistro !== 'cronograma') return;
      setCronograma((prev) => (
        prev?.id === registro.cronogramaId
          ? applyCronogramaRegistroProgress(prev, registro)
          : prev
      ));
    };
    window.addEventListener(REGISTRO_PROGRESS_OPTIMISTIC_EVENT, onOptimisticProgress);
    return () => window.removeEventListener(REGISTRO_PROGRESS_OPTIMISTIC_EVENT, onOptimisticProgress);
  }, []);
  useEffect(() => {
    let cancelado = false;

    const carregarTemplateDoEdital = async () => {
      setEditalTemplateData(null);
      if (!cronograma) return;

      const templateId = getCronogramaTemplateId(cronograma);
      const aplicarTemplate = (data) => {
        if (!cancelado && data) setEditalTemplateData(data);
      };

      try {
        if (templateId && templateId !== 'manual') {
          const templateSnap = await getDoc(doc(db, 'editais_templates', templateId));
          if (templateSnap.exists()) {
            aplicarTemplate({ id: templateSnap.id, ...templateSnap.data() });
            return;
          }
        }

        const editalNome = cronograma.editalNome || cronograma.titulo || cronograma.nome;
        if (editalNome) {
          const templateQuery = query(
            collection(db, 'editais_templates'),
            where('titulo', '==', editalNome),
            limit(1),
          );
          const templateSnap = await getDocs(templateQuery);
          const primeiro = templateSnap.docs[0];
          if (primeiro) aplicarTemplate({ id: primeiro.id, ...primeiro.data() });
        }
      } catch (error) {
        console.warn('[CronogramaPage] Nao foi possivel carregar logo do edital para PDF:', error);
      }
    };

    carregarTemplateDoEdital();
    return () => { cancelado = true; };
  }, [
    cronograma?.id,
    cronograma?.editalId,
    cronograma?.templateId,
    cronograma?.templateOrigem,
    cronograma?.templateOrigemId,
    cronograma?.editalBaseId,
    cronograma?.editalNome,
    cronograma?.titulo,
    cronograma?.nome,
  ]);

  // Cálculos derivados
  const dynamicLogo = editalTemplateData?.logoUrl || editalTemplateData?.logo || cronograma?.editalLogoUrl || cronograma?.logoUrl || cronograma?.logo || resolveLogoUrl({ ciclo: cronograma }) || null;

  const weekDates = useMemo(() => {
    if (!cronograma?.dataInicio) return [];
    const inicio = new Date(cronograma.dataInicio + 'T12:00:00');
    inicio.setDate(inicio.getDate() + weekOffset * 7);
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(inicio);
      d.setDate(d.getDate() + i);
      return d;
    });
  }, [cronograma, weekOffset]);

  const agendaSemana = useMemo(() => {
    if (!cronograma) return [];
    const dominados = new Set(Object.keys(cronograma.progresso?.dominios || {}));
    return getAgendaSemana(cronograma, weekOffset, null, dominados);
  }, [cronograma, weekOffset]);

  const tarefasPorDia = useMemo(() => {
    const mapa = { 0: [], 1: [], 2: [], 3: [], 4: [], 5: [], 6: [] };
    agendaSemana.forEach(slot => {
      const chave = chaveAssuntoDominado(slot.disciplinaId, slot.assunto);
      const tarefaMontada = buildCronogramaTaskState({
        cronograma,
        slot,
        weekOffset,
        registrosEstudo,
        optimisticDone,
      });
      mapa[slot.dia]?.push({ ...tarefaMontada, dominado: !!(dominiosLocal[chave]) });
    });
    return mapa;
  }, [agendaSemana, dominiosLocal, cronograma, optimisticDone, registrosEstudo, weekOffset]);

  const progressoGeral = useMemo(() => {
    const todos = Object.values(tarefasPorDia).flat();
    if (!todos.length) return 0;
    return Math.round((todos.filter(t => t.concluido).length / todos.length) * 100);
  }, [tarefasPorDia]);

  const buildCompletionModalData = useCallback(({ date, tarefas }) => {
    if (!date || !Array.isArray(tarefas) || tarefas.length === 0) return null;
    const resumo = getDayStudySummary(date, tarefas);
    if (!resumo.todoConcluido) return null;

    const dateKey = dateToYMDLocal(date);
    const registrosDoDia = (registrosEstudo || []).filter((registro) => (
      getRegistroDateKey(registro) === dateKey
      && (!cronograma?.id || registro.cronogramaId === cronograma.id)
    ));
    const questions = registrosDoDia.reduce((acc, registro) => acc + Number(registro.questoesFeitas || 0), 0);
    const correct = registrosDoDia.reduce((acc, registro) => acc + Number(registro.acertos || 0), 0);

    return {
      contextLabel: 'Cronograma do dia',
      planName: cronograma?.nome || 'Cronograma ativo',
      editalName: cronograma?.editalNome || cronograma?.titulo || cronograma?.nome || 'Edital ativo',
      editalLogo: dynamicLogo,
      minutes: resumo.progressoMinutos,
      plannedMinutes: resumo.totalMinutos,
      questions,
      correct,
    };
  }, [cronograma, dynamicLogo, registrosEstudo]);

  const openCompletionForDay = useCallback(({ date, tarefas }) => {
    const data = buildCompletionModalData({ date, tarefas });
    if (data) setCompletionModalData(data);
  }, [buildCompletionModalData]);

  const handlePrintWeek = useCallback(() => {
    openCronogramaWeekPdf({
      cronograma,
      weekDates,
      weekOffset,
      tarefasPorDia,
      dynamicLogo,
      showToast,
      formatarDuracao,
      getDisciplineColorForSlot,
      getNomeDisc,
      getTextoAssunto,
      getLabelTipo,
      meses: MESES_PT,
      diasLongo: DIAS_LONGO,
    });
  }, [cronograma, weekDates, weekOffset, tarefasPorDia, dynamicLogo, showToast]);

  const progressoMinutosHeader = useMemo(() => {
    const todos = Object.values(tarefasPorDia).flat();
    return todos.reduce((acc, tarefa) => {
      const tempo = Number(tarefa.tempoPlanejadoMinutos ?? tarefa.tempoMinutos ?? tarefa.minutosEstudo ?? 0);
      const progresso = tarefa.concluido
        ? Math.max(Number(tarefa.progressoMinutos || 0), tempo)
        : Math.min(Number(tarefa.progressoMinutos || 0), tempo || Number(tarefa.progressoMinutos || 0));
      return {
        totalMeta: acc.totalMeta + tempo,
        totalFeito: acc.totalFeito + progresso,
      };
    }, { totalMeta: 0, totalFeito: 0 });
  }, [tarefasPorDia]);

  const hojeNaSemana = useMemo(() => {
    const hojeStr = new Date().toDateString();
    return weekDates.find(d => d.toDateString() === hojeStr) || null;
  }, [weekDates]);

  const datasSemanaPosteriores = useMemo(() => {
    if (!hojeNaSemana) return weekDates;
    return weekDates.filter(d => d.getTime() > hojeNaSemana.getTime());
  }, [hojeNaSemana, weekDates]);

  const totalSemanas = cronograma?.totalSemanasNecessarias || 26;

  const concluidosSemanas = useMemo(() => {
    if (!cronograma?.progresso) return 0;
    const totalPorSemana = cronograma.semanaTemplate?.length || 0;
    if (totalPorSemana === 0) return 0;
    let count = 0;
    Object.keys(cronograma.progresso).filter(k => k.startsWith('w')).forEach(key => {
      const slots = cronograma.progresso[key];
      if (typeof slots !== 'object') return;
      if (Object.values(slots).filter(Boolean).length >= totalPorSemana) count++;
    });
    return count;
  }, [cronograma]);

  const registrosHistoricoCronograma = useMemo(() => {
    if (!cronograma?.id) return [];
    return (registrosEstudo || []).filter((registro) => registro.cronogramaId === cronograma.id);
  }, [cronograma?.id, registrosEstudo]);

  const dataFimConteudoCronograma = useMemo(
    () => calcularDataFimConteudoCronograma(cronograma),
    [cronograma],
  );

  let formattedStartDate = '...';
  if (cronograma?.dataInicio) {
    formattedStartDate = formatarDataHeader(cronograma.dataInicio);
  }
  let formattedEndDate = '...';
  const dataFinalCronograma = dataFimConteudoCronograma || cronograma?.dataFim || cronograma?.dataFechamento || null;
  if (dataFinalCronograma) {
    formattedEndDate = formatarDataHeader(dataFinalCronograma);
  }

  // Handlers
  const handleToggle = (tarefa) => {
    if (!cronograma) return;
    const toggleId = tarefa.slotIdBase || tarefa.slotId;
    if (!toggleId) return;
    const optimisticKey = getCompletionKey(tarefa);
    const previousDone = Boolean(tarefa.concluido);
    const nextDone = !previousDone;
    if (optimisticKey) setOptimisticDone(prev => ({ ...prev, [optimisticKey]: nextDone }));
    toggleIntentRef.current[toggleId] = (toggleIntentRef.current[toggleId] || 0) + 1;
    const intentVersion = toggleIntentRef.current[toggleId];
    const semanaDoSlot = Number.isFinite(Number(tarefa.weekOffset)) ? Number(tarefa.weekOffset) : weekOffset;
    const completionRegistro = buildCompletionRegistro({
      context: 'cronograma',
      item: tarefa,
      cronograma,
      isReview: !!tarefa.isRevisaoAuto,
    });
    const persistToggle = async () => {
      const ok = await toggleSlotConcluido(cronograma.id, tarefa, semanaDoSlot);
      const isLatestIntent = toggleIntentRef.current[toggleId] === intentVersion;
    if (!ok) {
      if (optimisticKey && isLatestIntent) setOptimisticDone(prev => ({ ...prev, [optimisticKey]: previousDone }));
    } else if (!previousDone && addRegistroEstudo) {
      await addRegistroEstudo(completionRegistro);
    } else if (previousDone && deleteCompletionRegistro) {
      await deleteCompletionRegistro(completionRegistro);
    }
    if (ok && !previousDone && isLatestIntent) {
      const diaSemana = Number(tarefa.dia);
      const date = tarefa.dataSlot
        ? new Date(`${tarefa.dataSlot}T12:00:00`)
        : weekDates.find((item) => item.getDay() === diaSemana);
      const tarefasDoDia = (tarefasPorDia[diaSemana] || []).map((item) => (
        getCompletionKey(item) === optimisticKey ? applyCompletionOverride(item, true) : item
      ));
      openCompletionForDay({ date, tarefas: tarefasDoDia });
    }
    if (isLatestIntent) {
    showToast(ok
      ? (previousDone ? 'Marcado como pendente' : 'Concluído com sucesso')
      : 'Erro ao salvar. Tente novamente.'
    );
    }
    };

    const previousQueue = toggleQueueRef.current[toggleId] || Promise.resolve();
    toggleQueueRef.current[toggleId] = previousQueue
      .catch(() => {})
      .then(persistToggle)
      .finally(() => {
        if (toggleIntentRef.current[toggleId] === intentVersion) {
          delete toggleQueueRef.current[toggleId];
          delete toggleIntentRef.current[toggleId];
        }
      });
  };

  const handleConfirmDeleteRegistro = async () => {
    if (!recordToDelete) return;
    setLoadingAction(true);
    try {
      if (onDeleteRegistro) await onDeleteRegistro(recordToDelete.id);
      else await deleteDoc(doc(db, 'users', user.uid, 'registrosEstudo', recordToDelete.id));
      setRecordToDelete(null);
    } finally {
      setLoadingAction(false);
    }
  };

  const handleHistoryDeleteRegistro = async (registro) => {
    if (!registro) return;
    setLoadingAction(true);
    try {
      if (onDeleteRegistro) await onDeleteRegistro(registro.id);
      else await deleteDoc(doc(db, 'users', user.uid, 'registrosEstudo', registro.id));
    } finally {
      setLoadingAction(false);
    }
  };

  const handleUpdateRegistro = async (id, data) => {
    await updateDoc(doc(db, 'users', user.uid, 'registrosEstudo', id), data);
  };

  const handleMarkPendencia = async (tarefa) => {
    if (!cronograma || toggleLoadingId) return;
    const toggleId = tarefa.slotIdBase || tarefa.slotId;
    setToggleLoadingId(toggleId);
    const semanaDoSlot = Number.isFinite(Number(tarefa.weekOffset)) ? Number(tarefa.weekOffset) : weekOffset;
    const ok = await marcarTeoriaAindaNaoConcluida(cronograma.id, tarefa, semanaDoSlot);
    setToggleLoadingId(null);
    showToast(ok
      ? 'Assunto marcado como teoria ainda nao concluida'
      : 'Erro ao salvar pendencia de teoria.'
    );
  };

  const handleStart = (tarefa) => {
    if (onStartStudy) onStartStudy(
      { id: tarefa.disciplinaId, nome: tarefa.disciplinaNome },
      tarefa.assunto || null,
      { defaultContext: 'cronograma' }
    );
  };

  const buildTemplateFromOrders = useCallback((ordersByDay) => {
    if (!cronograma?.semanaTemplate?.length) return null;

    const templateMap = new Map(cronograma.semanaTemplate.map((slot) => [getTemplateSlotId(slot), slot]));
    const touchedIds = new Set();
    const updatedTemplate = [];

    for (let dia = 0; dia < 7; dia++) {
      (ordersByDay[dia] || []).forEach((slotId, index) => {
        const original = templateMap.get(slotId);
        if (!original) return;
        touchedIds.add(slotId);
        updatedTemplate.push({
          ...original,
          dia,
          ordemManual: index,
        });
      });
    }

    cronograma.semanaTemplate.forEach((slot) => {
      const slotId = getTemplateSlotId(slot);
      if (!touchedIds.has(slotId)) updatedTemplate.push(slot);
    });

    return updatedTemplate;
  }, [cronograma]);

  const persistTemplateReorder = useCallback(async (ordersByDay) => {
    const updatedTemplate = buildTemplateFromOrders(ordersByDay);
    if (!updatedTemplate) return false;

    try {
      await updateDoc(doc(db, 'users', user.uid, 'cronogramas', cronograma.id), { semanaTemplate: updatedTemplate });
      setCronograma(prev => prev?.id === cronograma.id ? { ...prev, semanaTemplate: updatedTemplate } : prev);
      return true;
    } catch (error) {
      console.error('[CronogramaPage] Erro ao mover estudo:', error);
      return false;
    }
  }, [buildTemplateFromOrders, cronograma?.id, user?.uid]);

  const handleDragStart = useCallback((event) => {
    const tarefa = event.active.data.current?.tarefa;
    if (tarefa) setActiveDragTask(tarefa);
  }, []);

  const handleDragEnd = useCallback(async (event) => {
    setActiveDragTask(null);

    const { active, over } = event;
    if (!over || !cronograma) return;

    const activeData = active.data.current;
    const overData = over.data.current;
    const tarefa = activeData?.tarefa;

    if (!tarefa || !isMovableTask(tarefa)) return;

    const sourceDay = Number(activeData?.dia);
    const targetDay = Number.isInteger(Number(overData?.dia))
      ? Number(overData.dia)
      : (typeof over.id === 'string' && over.id.startsWith('day-') ? Number(over.id.replace('day-', '')) : NaN);
    if (!Number.isInteger(sourceDay) || !Number.isInteger(targetDay)) return;

    const ordersByDay = { 0: [], 1: [], 2: [], 3: [], 4: [], 5: [], 6: [] };
    cronograma.semanaTemplate.forEach((slot) => {
      const dia = Number(slot.dia);
      if (!Number.isInteger(dia)) return;
      ordersByDay[dia].push(getTemplateSlotId(slot));
    });

    const activeTemplateId = getTaskTemplateSlotId(tarefa);
    const sourceOrder = [...(ordersByDay[sourceDay] || [])];
    const oldIndex = sourceOrder.indexOf(activeTemplateId);
    if (oldIndex === -1) return;

    if (sourceDay === targetDay) {
      const targetTask = overData?.tarefa;
      const targetId = targetTask ? getTaskTemplateSlotId(targetTask) : activeTemplateId;
      const newIndex = sourceOrder.indexOf(targetId);
      if (newIndex === -1 || newIndex === oldIndex) return;
      ordersByDay[sourceDay] = arrayMove(sourceOrder, oldIndex, newIndex);
    } else {
      sourceOrder.splice(oldIndex, 1);
      ordersByDay[sourceDay] = sourceOrder;

      const targetOrder = [...(ordersByDay[targetDay] || [])];
      const targetTask = overData?.tarefa;
      const targetId = targetTask ? getTaskTemplateSlotId(targetTask) : null;
      const insertAt = targetId ? targetOrder.indexOf(targetId) : -1;
      if (insertAt >= 0) targetOrder.splice(insertAt, 0, activeTemplateId);
      else targetOrder.push(activeTemplateId);
      ordersByDay[targetDay] = targetOrder;
    }

    const ok = await persistTemplateReorder(ordersByDay);
    showToast(ok ? '?? Cronograma reorganizado com sucesso!' : '? Erro ao mover tarefa.');
  }, [cronograma, persistTemplateReorder, showToast]);

  const handleWeekPanStart = useCallback((event) => {
    if (event.button !== 0 || isWeekPanIgnoredTarget(event.target)) return;
    const node = weekScrollRef.current;
    if (!node) return;

    weekPanRef.current = {
      active: true,
      moved: false,
      startX: event.clientX,
      currentX: event.clientX,
      scrollLeft: node.scrollLeft,
      pointerId: event.pointerId,
      rafId: null,
    };
    node.setPointerCapture?.(event.pointerId);
  }, []);

  const handleWeekPanMove = useCallback((event) => {
    const pan = weekPanRef.current;
    const node = weekScrollRef.current;
    if (!pan.active || !node) return;

    pan.currentX = event.clientX;
    const delta = pan.currentX - pan.startX;
    if (!pan.moved && Math.abs(delta) < 4) return;
    pan.moved = true;
    event.preventDefault();
    if (pan.rafId) return;
    pan.rafId = requestAnimationFrame(() => {
      const latest = weekPanRef.current;
      node.scrollLeft = latest.scrollLeft - (latest.currentX - latest.startX);
      latest.rafId = null;
    });
  }, []);

  const handleWeekPanEnd = useCallback(() => {
    const node = weekScrollRef.current;
    const pan = weekPanRef.current;
    if (pan.rafId) cancelAnimationFrame(pan.rafId);
    if (node && weekPanRef.current.pointerId !== null) {
      node.releasePointerCapture?.(weekPanRef.current.pointerId);
    }
    weekPanRef.current = { active: false, moved: false, startX: 0, currentX: 0, scrollLeft: 0, pointerId: null, rafId: null };
  }, []);

  const handleWeekWheel = useCallback((event) => {
    const node = weekScrollRef.current;
    if (!node || Math.abs(event.deltaX) >= Math.abs(event.deltaY)) return;
    if (!event.shiftKey && event.deltaY < 24) return;
    node.scrollLeft += event.deltaY;
  }, []);

  useEffect(() => {
    if (viewMode !== 'week') return;
    const node = weekScrollRef.current;
    if (!node) return;

    const todayCard = node.querySelector('[data-week-today="true"]');
    if (!todayCard) return;

    requestAnimationFrame(() => {
      const targetLeft = Math.max(0, todayCard.offsetLeft - 16);
      node.scrollTo({ left: targetLeft, behavior: 'smooth' });
    });
  }, [viewMode, weekOffset]);

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

  const handleDominar = useCallback(async (tarefa) => {
    if (!cronograma) return;
    const chave = chaveAssuntoDominado(tarefa.disciplinaId, tarefa.assunto);
    const dominadoAtual = !!(dominiosLocal[chave]);
    setDominiosLocal(prev => ({ ...prev, [chave]: !dominadoAtual }));
    showToast(dominadoAtual ? '?? Domínio removido — revisões reativadas' : '? Assunto dominado!');
    const resultado = await toggleAssuntoDominado(cronograma.id, tarefa.disciplinaId, tarefa.assunto, dominadoAtual);
    if (resultado === null) {
      setDominiosLocal(prev => ({ ...prev, [chave]: dominadoAtual }));
      showToast('? Erro ao salvar. Tente novamente.');
    }
  }, [cronograma, dominiosLocal, toggleAssuntoDominado, showToast]);

  const handleDominarDoModal = useCallback(async (disciplinaId, assunto, dominadoAtual) => {
    if (!cronograma) return;
    const chave = chaveAssuntoDominado(disciplinaId, assunto);
    setDominiosLocal(prev => ({ ...prev, [chave]: !dominadoAtual }));
    showToast(!dominadoAtual ? '? Assunto dominado!' : '?? Domínio removido');
    const resultado = await toggleAssuntoDominado(cronograma.id, disciplinaId, assunto, dominadoAtual);
    if (resultado === null) {
      setDominiosLocal(prev => ({ ...prev, [chave]: dominadoAtual }));
      showToast('? Erro ao salvar. Tente novamente.');
    }
  }, [cronograma, dominiosLocal, toggleAssuntoDominado, showToast]);

  // Early returns
  if (loadingPage) return <div className="min-h-[calc(100vh-120px)]" />;

  if (showWizard) return (
    <CronogramaCreateWizard
      user={user}
      onClose={() => setShowWizard(false)}
      onCronogramaCriado={handleCronogramaCriado}
    />
  );

  if (!cronograma) return <EstadoVazio onNovo={() => setShowWizard(true)}/>;

  if (mostrandoEditar && cronograma) {
    return (
      <ModalEditarCronograma
        user={user}
        cronograma={cronograma}
        onFechar={() => setMostrandoEditar(false)}
        onCronogramaAtualizado={() => {
          setMostrandoEditar(false);
          showToast('? Cronograma atualizado!');
        }}
        initialMode={editInitialMode}
      />
    );
  }

  // --- RENDER PRINCIPAL ------------------------------------------------------
  return (
    <div className="relative flex min-h-[calc(100vh-120px)] min-w-0 flex-col animate-fade-in">
      {/* -- MODAIS -- */}
      <AnimatePresence>
        {recordToDelete && typeof document !== 'undefined' && createPortal(
          <ModalConfirm
            msg="Deseja excluir este registro de estudo? As estatísticas serão atualizadas automaticamente."
            onConfirm={handleConfirmDeleteRegistro}
            onCancel={() => setRecordToDelete(null)}
            loading={loadingAction}
          />,
          document.body
        )}

        {delayConfirmation && typeof document !== 'undefined' && createPortal(
          <ModalConfirm
            title="Adiar semana"
            msg="Deseja empurrar o cronograma uma semana para frente? Depois da confirmação, você poderá desfazer e voltar para a data atual."
            confirmLabel="Adiar"
            confirmIcon={SkipForward}
            tone="amber"
            onConfirm={() => {
              setLoadingAction(true);
              adiarCronograma(delayConfirmation.id, delayConfirmation)
                .finally(() => {
                  setLoadingAction(false);
                  setDelayConfirmation(null);
                });
            }}
            onCancel={() => setDelayConfirmation(null)}
            loading={loadingAction}
          />,
          document.body
        )}

        {showHistoryModal && (
          <HistoricoModal
            isOpen={showHistoryModal}
            onClose={() => setShowHistoryModal(false)}
            registros={registrosHistoricoCronograma}
            onDeleteRequest={handleHistoryDeleteRegistro}
            onUpdateRecord={handleUpdateRegistro}
            title="Histórico do Cronograma"
            confirmDeleteInModal
            deleteLoading={loadingAction}
          />
        )}

        {slotConsolidado && (
          <ModalRevisaoConsolidada
            slot={slotConsolidado}
            onClose={() => setSlotConsolidado(null)}
            onDominar={handleDominarDoModal}
            onStart={handleStart}
            onToggle={handleToggle}
            dominiosLocal={dominiosLocal}
            optimisticDone={optimisticDone}
          />
        )}

        {slotDetalhes && (
          <ModalDetalhesCronograma
            slot={slotDetalhes}
            cronograma={cronograma}
            onClose={() => setSlotDetalhes(null)}
            onStart={handleStart}
            onToggle={handleToggle}
            toggleLoadingId={toggleLoadingId}
            optimisticDone={optimisticDone}
          />
        )}

        {toast && (
          <motion.div
            initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -16 }}
            className="fixed top-6 left-1/2 -translate-x-1/2 z-[300] bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 px-5 py-2.5 rounded-xl shadow-lg text-[11px] font-bold pointer-events-none flex items-center gap-2"
          >
            {toast}
          </motion.div>
        )}

        {undoDelayData && (
          <motion.div
            initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 18 }}
            className="fixed bottom-5 left-1/2 z-[300] flex w-[calc(100vw-24px)] max-w-md -translate-x-1/2 items-center justify-between gap-3 rounded-2xl border border-amber-200 bg-white px-4 py-3 text-zinc-900 shadow-2xl shadow-amber-900/10 dark:border-amber-900/40 dark:bg-zinc-950 dark:text-white"
          >
            <div className="min-w-0">
              <p className="text-[10px] font-black uppercase tracking-widest text-amber-600 dark:text-amber-400">Semana adiada</p>
              <p className="mt-0.5 truncate text-xs font-semibold text-zinc-500 dark:text-zinc-400">Voltar para {formatarDataHeader(undoDelayData.previousDate)}</p>
            </div>
            <button
              type="button"
              onClick={desfazerAdiamentoCronograma}
              disabled={loadingAction}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-amber-600 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-white shadow-sm transition-colors hover:bg-amber-700 disabled:opacity-60"
            >
              {loadingAction ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
              Desfazer
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* -- HEADER (MESMO ENVELOPE DO CICLO) -- */}
      <div className="mb-3">

        {/* Card principal do cronograma */}
        <div className="flex flex-row items-center justify-between gap-2 bg-zinc-50 dark:bg-zinc-900 px-3 py-3 sm:px-4 md:gap-6 md:px-6 md:py-4 rounded-2xl border border-zinc-300 dark:border-zinc-800 shadow-sm relative overflow-hidden">

          {/* Logo de fundo */}
          {dynamicLogo ? (
            <div className="absolute -bottom-2 right-1 h-20 w-20 opacity-25 pointer-events-none transform rotate-[-10deg] z-0 filter saturate-150 transition-all duration-500 dark:opacity-35 md:-bottom-4 md:-right-4 md:h-44 md:w-44 md:opacity-20">
              <img src={dynamicLogo} alt="Logo" className="w-full h-full object-contain" onError={e => { e.target.style.display = 'none'; }}/>
            </div>
          ) : (
            <div className="absolute -bottom-4 -right-4 w-32 h-32 md:w-44 md:h-44 opacity-10 dark:opacity-20 pointer-events-none flex items-center justify-center">
              <Shield size={120} className="text-zinc-400 dark:text-zinc-500"/>
            </div>
          )}

          {/* Lado esquerdo — info */}
          <div className="min-w-0 flex-1 z-10">
            <div className="flex flex-col gap-1.5 md:gap-3">
              {cronograma.ativo ? (
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
                <h1 className="min-w-0 truncate text-sm font-black text-zinc-900 dark:text-white uppercase tracking-tight leading-none sm:text-lg md:text-3xl">{cronograma.nome}</h1>
                {onGoToEdital && (
                  <button onClick={onGoToEdital} className="flex shrink-0 items-center gap-1 rounded-lg border border-zinc-200 bg-white/90 px-2 py-1 text-[8px] font-black uppercase tracking-widest text-zinc-600 shadow-sm transition-all hover:border-red-200 hover:bg-red-50 hover:text-red-700 dark:border-zinc-700 dark:bg-zinc-800/90 dark:text-zinc-300 dark:hover:border-red-900/30 dark:hover:bg-red-900/10 dark:hover:text-red-400 md:gap-2 md:px-3 md:py-1.5 md:text-[11px]">
                    <BookOpen size={11} className="text-red-600 dark:text-red-500 md:h-3.5 md:w-3.5"/>
                    EDITAL
                  </button>
                )}
                <div className={`hidden items-center gap-1 rounded-lg border px-1.5 py-1 transition-all sm:flex md:gap-2 md:pl-1.5 md:pr-3 ${
                    concluidosSemanas > 0
                    ? 'bg-amber-50 dark:bg-amber-900/10 border-amber-500/20 shadow-[0_0_10px_rgba(245,158,11,0.1)]'
                    : 'bg-zinc-100 dark:bg-zinc-800/50 border-zinc-200 dark:border-zinc-700'
                }`}>
                  <div className="relative flex h-6 w-6 shrink-0 items-center justify-center md:h-8 md:w-8">
                    <motion.svg animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 15, ease: 'linear' }} className="absolute inset-0 w-full h-full" viewBox="0 0 100 100">
                      <circle cx="50" cy="50" r="44" fill="none" stroke="currentColor" strokeWidth="6" strokeDasharray="16 12" strokeLinecap="round" className={concluidosSemanas > 0 ? 'text-amber-500/60' : 'text-zinc-300 dark:text-zinc-600'} />
                    </motion.svg>
                    <div className={`absolute inset-0 z-10 flex items-center justify-center rounded-full ${concluidosSemanas > 0 ? 'text-amber-600 dark:text-amber-500' : 'text-zinc-500'}`}>
                      <span className="text-sm font-black leading-none md:text-xl">{concluidosSemanas}</span>
                    </div>
                  </div>
                  <div className="hidden flex-col justify-center ml-1 md:flex">
                    <span className="text-[8px] font-bold uppercase tracking-widest text-zinc-500 dark:text-zinc-400 leading-none mb-0.5">Semanas</span>
                    <span className={`text-[10px] font-black uppercase tracking-wide leading-none ${concluidosSemanas > 0 ? 'text-amber-600 dark:text-amber-500' : 'text-zinc-600 dark:text-zinc-400'}`}>Concluídas</span>
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-zinc-400">
                <div className="flex items-center gap-1">
                  <CalendarDays size={10} className="md:h-3.5 md:w-3.5"/>
                  <p className="text-[8px] font-bold uppercase tracking-wide md:text-[10px]">
                    Início: <span className="text-zinc-600 dark:text-zinc-300">{formattedStartDate}</span>
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <Target size={10} className="md:h-3.5 md:w-3.5"/>
                  <p className="text-[8px] font-bold uppercase tracking-wide md:text-[10px]">
                    Final: <span className="text-zinc-600 dark:text-zinc-300">{formattedEndDate}</span>
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Lado direito — mesmo padrão de progresso do Ciclo */}
          <div className="z-10 flex w-[104px] shrink-0 items-center justify-between gap-1.5 rounded-xl border border-zinc-200 bg-white/75 p-1.5 shadow-sm dark:border-zinc-800 dark:bg-zinc-950/55 sm:w-[132px] md:w-auto md:min-w-[240px] md:gap-3 md:p-2.5">
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2 md:gap-5">
                <div>
                  <p className="text-[7px] font-black uppercase tracking-wider text-zinc-400 md:text-[8px] md:tracking-widest">Meta</p>
                  <p className="font-mono text-[10px] font-black text-zinc-900 dark:text-white md:text-sm">{formatarDuracao(progressoMinutosHeader.totalMeta)}</p>
                </div>
                <div className="text-right">
                  <p className="text-[7px] font-black uppercase tracking-wider text-zinc-400 md:text-[8px] md:tracking-widest">Feito</p>
                  <p className="font-mono text-[10px] font-black text-zinc-900 dark:text-white md:text-sm">{formatarDuracao(progressoMinutosHeader.totalFeito)}</p>
                </div>
              </div>
              <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-zinc-100 ring-1 ring-zinc-200/70 dark:bg-zinc-800 dark:ring-zinc-700/70 md:mt-2 md:h-1.5">
                <motion.div
                  initial={false}
                  animate={{ width: `${Math.min(progressoGeral, 100)}%` }}
                  transition={{ duration: 0.45, ease: 'easeOut' }}
                  className={`h-full rounded-full ${progressoGeral >= 100 ? 'bg-gradient-to-r from-emerald-500 to-teal-400' : 'bg-gradient-to-r from-red-600 via-rose-500 to-orange-400'}`}
                />
              </div>
            </div>
            <div className="relative shrink-0">
              <svg className="h-9 w-9 -rotate-90 sm:h-10 sm:w-10 md:h-14 md:w-14" viewBox="0 0 80 80">
                <circle cx="40" cy="40" r="34" fill="none" stroke="currentColor" className="text-zinc-200 dark:text-zinc-800" strokeWidth="6"/>
                <motion.circle
                  cx="40" cy="40" r="34" fill="none" stroke="currentColor"
                  className={progressoGeral >= 100 ? 'text-emerald-500' : progressoGeral > 0 ? 'text-yellow-500' : 'text-zinc-400'}
                  strokeWidth="6" strokeLinecap="round"
                  strokeDasharray={2 * Math.PI * 34}
                  initial={{ strokeDashoffset: 2 * Math.PI * 34 }}
                  animate={{ strokeDashoffset: 2 * Math.PI * 34 * (1 - Math.min(progressoGeral, 100) / 100) }}
                  transition={{ duration: 1.5, ease: 'easeOut' }}
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className={`text-[9px] font-black sm:text-[10px] md:text-sm ${progressoGeral >= 100 ? 'text-emerald-500' : progressoGeral > 0 ? 'text-yellow-500' : 'text-zinc-400'}`}>
                  {progressoGeral}%
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* -- BARRA DE FERRAMENTAS -- */}
        <div className="mt-4 mb-2 px-1 sm:px-2">
          <div className="flex flex-col items-center gap-2 lg:grid lg:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] lg:items-center">
          <div className="flex w-full items-start justify-between gap-2 lg:contents">
          <div className="flex min-w-0 flex-col items-start gap-1.5 lg:col-start-1 lg:row-start-1 lg:justify-self-start">
            <h3 className="flex items-center gap-1.5 text-[8px] font-bold uppercase tracking-widest text-zinc-400 sm:text-sm lg:text-[10px]">
              <LayoutList size={12} className="sm:size-3.5" /> MODOS DE VIZUALIZAÇÃO
            </h3>

            {/* View Toggles */}
            <div className="flex min-w-0 items-center gap-0.5 rounded-lg bg-zinc-200/50 p-0.5 dark:bg-zinc-800 sm:gap-1 sm:p-1 lg:gap-0.5 lg:p-0.5">
              <button
                onClick={() => setViewMode('list')}
                className={`flex items-center justify-center gap-1 rounded px-1.5 py-1.5 text-[9px] font-black uppercase tracking-widest transition-colors sm:gap-1.5 sm:px-3 sm:text-[10px] lg:h-7 lg:gap-1 lg:px-2 lg:py-0 lg:text-[8px] lg:tracking-wide ${viewMode === 'list' ? 'bg-white text-zinc-900 shadow-sm dark:bg-zinc-700 dark:text-white' : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'}`}
              >
                <LayoutList size={12}/> Lista
              </button>
              <button
                onClick={() => setViewMode('week')}
                className={`flex items-center justify-center gap-1 rounded px-1.5 py-1.5 text-[9px] font-black uppercase tracking-widest transition-colors sm:gap-1.5 sm:px-3 sm:text-[10px] lg:h-7 lg:gap-1 lg:px-2 lg:py-0 lg:text-[8px] lg:tracking-wide ${viewMode === 'week' ? 'bg-white text-zinc-900 shadow-sm dark:bg-zinc-700 dark:text-white' : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'}`}
              >
                <LayoutGrid size={12}/> Semanal
              </button>
              <button
                onClick={() => setViewMode('month')}
                className={`flex items-center justify-center gap-1 rounded px-1.5 py-1.5 text-[9px] font-black uppercase tracking-widest transition-colors sm:gap-1.5 sm:px-3 sm:text-[10px] lg:h-7 lg:gap-1 lg:px-2 lg:py-0 lg:text-[8px] lg:tracking-wide ${viewMode === 'month' ? 'bg-white text-zinc-900 shadow-sm dark:bg-zinc-700 dark:text-white' : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'}`}
              >
                <Calendar size={12}/> Mensal
              </button>
            </div>
          </div>

          <div className="flex shrink-0 items-center justify-end gap-1.5 lg:col-start-3 lg:row-start-1 lg:w-full lg:gap-1 lg:justify-self-stretch">
            <div className="relative" ref={configMenuRef}>
              <button
                onClick={() => setConfigMenuOpen((open) => !open)}
                className="group flex h-8 w-8 items-center justify-center rounded-lg border border-red-600 bg-red-600 text-[9px] font-bold uppercase tracking-wide text-white shadow-sm shadow-red-600/20 transition-all hover:bg-red-700 sm:w-auto sm:gap-1.5 sm:px-2.5"
                title="Configuração de cronograma"
                aria-label="Configuração de cronograma"
              >
                <Cog size={14} className="transition-transform group-hover:rotate-45"/>
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
                        <span className="block text-[9px] font-black uppercase tracking-[0.18em] text-zinc-900 dark:text-white">Configurar cronograma</span>
                        <span className="mt-0.5 block text-[8px] font-semibold text-zinc-400">Escolha como deseja ajustar</span>
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setEditInitialMode('simple');
                        setConfigMenuOpen(false);
                        setMostrandoEditar(true);
                      }}
                      className="group relative flex w-full items-center gap-3 overflow-hidden rounded-xl border border-red-200 bg-red-50 p-3 text-left shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-red-300 hover:bg-red-100 hover:shadow-md hover:shadow-red-600/10 dark:border-red-900/50 dark:bg-red-950/20 dark:hover:border-red-800 dark:hover:bg-red-950/35"
                    >
                      <span className="absolute right-2 top-2 rounded-full bg-white/80 px-1.5 py-0.5 text-[7px] font-black uppercase tracking-widest text-red-600 ring-1 ring-red-100 dark:bg-red-950/60 dark:text-red-300 dark:ring-red-900/50">
                        rápido
                      </span>
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-600 text-white shadow-sm shadow-red-600/20"><Cog size={16} /></span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-[11px] font-black uppercase tracking-wide text-zinc-900 dark:text-white">Ajuste simples</span>
                        <span className="mt-1 block text-[9px] font-semibold leading-snug text-red-700/80 dark:text-red-200/80">Nome, datas e preferências sem recalcular a distribuição.</span>
                      </span>
                      <ChevronRight size={14} className="shrink-0 text-red-300 transition-transform group-hover:translate-x-0.5 group-hover:text-red-600 dark:text-red-800 dark:group-hover:text-red-400" />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setEditInitialMode('recalculate');
                        setConfigMenuOpen(false);
                        setMostrandoEditar(true);
                      }}
                      className="group relative mt-1.5 flex w-full items-center gap-2.5 rounded-xl border border-zinc-200/80 bg-zinc-50/80 p-2.5 text-left transition-all duration-200 hover:-translate-y-0.5 hover:border-zinc-300 hover:bg-white hover:shadow-md hover:shadow-zinc-900/5 dark:border-zinc-800 dark:bg-zinc-900/60 dark:hover:border-zinc-700 dark:hover:bg-zinc-900"
                    >
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-zinc-900 text-white shadow-sm dark:bg-white dark:text-zinc-950"><RefreshCw size={14} /></span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-[10px] font-black uppercase tracking-wide text-zinc-900 dark:text-white">Recalcular</span>
                        <span className="mt-0.5 block text-[9px] font-medium leading-snug text-zinc-500 dark:text-zinc-400">Refaça rotina, disciplinas e distribuição pelo assistente.</span>
                      </span>
                      <ChevronRight size={14} className="shrink-0 text-zinc-300 transition-transform group-hover:translate-x-0.5 group-hover:text-zinc-700 dark:text-zinc-700 dark:group-hover:text-zinc-300" />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setConfigMenuOpen(false);
                        setShowTimerSettings(true);
                      }}
                      className="group relative mt-1.5 flex w-full items-center gap-2.5 rounded-xl border border-zinc-200/80 bg-white p-2.5 text-left transition-all duration-200 hover:-translate-y-0.5 hover:border-zinc-300 hover:bg-zinc-50 hover:shadow-md hover:shadow-zinc-900/5 dark:border-zinc-800 dark:bg-zinc-900/70 dark:hover:border-zinc-700 dark:hover:bg-zinc-900"
                    >
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-zinc-100 text-zinc-700 shadow-sm dark:bg-zinc-800 dark:text-zinc-200"><Clock size={14} /></span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-[10px] font-black uppercase tracking-wide text-zinc-900 dark:text-white">Configurar timer</span>
                        <span className="mt-0.5 block text-[9px] font-medium leading-snug text-zinc-500 dark:text-zinc-400">Ajuste modo, foco, descanso, cor e sons do cronometro.</span>
                      </span>
                      <ChevronRight size={14} className="shrink-0 text-zinc-300 transition-transform group-hover:translate-x-0.5 group-hover:text-zinc-700 dark:text-zinc-700 dark:group-hover:text-zinc-300" />
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <button
              onClick={() => setDelayConfirmation(cronograma)}
              disabled={loadingAction}
              className="group flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-200 bg-white text-[9px] font-bold uppercase tracking-wide text-zinc-600 shadow-sm transition-all hover:border-amber-200 hover:bg-amber-50 hover:text-amber-700 disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:border-amber-900/30 dark:hover:bg-amber-900/10 dark:hover:text-amber-400 sm:w-auto sm:gap-1.5 sm:px-2.5"
              title="Adiar semana"
              aria-label="Adiar semana"
            >
              <SkipForward size={14} className="text-amber-500 group-hover:scale-110 transition-transform"/>
              <span className="hidden sm:inline">Adiar</span>
            </button>

            <button
              onClick={handlePrintWeek}
              className="group flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-200 bg-white text-[9px] font-bold uppercase tracking-wide text-zinc-600 shadow-sm transition-all hover:border-red-200 hover:bg-red-50 hover:text-red-700 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:border-red-900/30 dark:hover:bg-red-900/10 dark:hover:text-red-400 sm:w-auto sm:gap-1.5 sm:px-2.5"
              title="Imprimir semana ou salvar em PDF"
              aria-label="Imprimir semana ou salvar em PDF"
            >
              <Printer size={14} className="text-red-500 group-hover:scale-110 transition-transform"/>
              <span className="hidden sm:inline">PDF</span>
            </button>

            <button
              onClick={() => setShowHistoryModal(true)}
              className="group flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-200 bg-white text-[9px] font-bold uppercase tracking-wide text-zinc-600 shadow-sm transition-all hover:border-red-200 hover:bg-red-50 hover:text-red-700 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:border-red-900/30 dark:hover:bg-red-900/10 dark:hover:text-red-400 sm:w-auto sm:gap-1.5 sm:px-2.5"
              title="Ver Histórico Completo"
              aria-label="Ver histórico completo"
            >
              <History size={14} className="text-red-600 dark:text-red-500 group-hover:scale-110 transition-transform"/>
              <span className="hidden sm:inline">Histórico</span>
            </button>

          </div>
          </div>

          {(viewMode === 'week' || viewMode === 'list') && (
            <div className="flex w-full items-center justify-between gap-2 rounded-xl border border-zinc-200 bg-zinc-50 px-2.5 py-1.5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 sm:w-[258px] lg:col-start-2 lg:row-start-1 lg:mx-0 lg:justify-self-center">
              <button
                onClick={() => setWeekOffset(w => Math.max(0, w - 1))}
                disabled={weekOffset === 0}
                className="p-1.5 rounded text-zinc-500 hover:text-zinc-900 hover:bg-zinc-200 dark:text-zinc-400 dark:hover:text-white dark:hover:bg-zinc-800 disabled:opacity-30 transition-colors"
              >
                <ChevronLeft size={16}/>
              </button>
              <div className="flex min-w-0 flex-1 flex-col items-center justify-center text-center">
                <div className="text-[10px] font-black uppercase tracking-widest text-zinc-900 dark:text-white leading-none mb-1">
                  Semana {weekOffset + 1} de {totalSemanas}
                </div>
                <div className="text-[9px] font-medium text-zinc-500 dark:text-zinc-400">
                  {weekDates.length > 0 ? `${weekDates[0].getDate()} ${MESES_PT[weekDates[0].getMonth()]} – ${weekDates[6].getDate()} ${MESES_PT[weekDates[6].getMonth()]}` : ''}
                </div>
              </div>
              <button
                onClick={() => setWeekOffset(w => Math.min(totalSemanas - 1, w + 1))}
                disabled={weekOffset >= totalSemanas - 1}
                className="p-1.5 rounded text-zinc-500 hover:text-zinc-900 hover:bg-zinc-200 dark:text-zinc-400 dark:hover:text-white dark:hover:bg-zinc-800 disabled:opacity-30 transition-colors"
              >
                <ChevronRight size={16}/>
              </button>
            </div>
          )}
        </div>
          </div>
        </div>

      {/* -- ÁREA PRINCIPAL -- */}
      <div className="-mx-2 min-h-0 flex-grow pb-8 pt-0 sm:-mx-4 md:-mx-6 lg:-mx-8">
        {viewMode === 'week' ? (
          <div className="px-2 sm:px-4 md:px-6 lg:px-8">
            <DndContext sensors={dragSensors} collisionDetection={cronogramaCollisionDetection} onDragStart={handleDragStart} onDragEnd={handleDragEnd} onDragCancel={() => setActiveDragTask(null)}>
              <motion.div
                ref={weekScrollRef}
                key="week"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
                onPointerDown={handleWeekPanStart}
                onPointerMove={handleWeekPanMove}
                onPointerUp={handleWeekPanEnd}
                onPointerCancel={handleWeekPanEnd}
                onPointerLeave={handleWeekPanEnd}
                onWheel={handleWeekWheel}
                className="flex cursor-grab select-none gap-4 overflow-x-auto overflow-y-hidden overscroll-x-contain scroll-smooth pb-5 active:cursor-grabbing [scrollbar-width:thin] [scrollbar-color:rgb(220_38_38)_transparent]"
              >
                {weekDates.map((date) => {
                  const diaReal = date.getDay();
                  const isHoje = new Date().toDateString() === date.toDateString();
                  return (
                    <div
                      key={date.getTime()}
                      data-week-today={isHoje ? 'true' : undefined}
                      className={`w-[252px] min-w-[252px] self-start scroll-mx-4 sm:w-[276px] sm:min-w-[276px] xl:w-[292px] xl:min-w-[292px] ${isHoje ? 'relative z-10' : ''}`}
                    >
                      <DayDropZone
                        diaSemanaIdx={diaReal}
                        date={date}
                        tarefas={tarefasPorDia[diaReal] || []}
                        isHoje={isHoje}
                        onToggle={handleToggle}
                        onMarkPendencia={handleMarkPendencia}
                        onStart={handleStart}
                        onDominar={handleDominar}
                        onOpenConsolidada={slot => setSlotConsolidado(slot)}
                        onOpenDetails={setSlotDetalhes}
                        onOpenCompletion={openCompletionForDay}
                        cronograma={cronograma}
                      />
                    </div>
                  );
                })}
                <div aria-hidden="true" className="w-2 shrink-0 sm:w-4 md:w-6 lg:w-8" />
              </motion.div>

              <DragOverlay dropAnimation={{ duration: 220, easing: 'ease' }}>
                {activeDragTask ? (
                  <div className="w-[280px] xl:w-[310px]">
                    <TarefaCardDraggable
                      tarefa={activeDragTask}
                      onToggle={() => {}}
                      onMarkPendencia={() => {}}
                      onStart={() => {}}
                      onDominar={() => {}}
                      onOpenConsolidada={() => {}}
                      cronograma={cronograma}
                      isDragging
                      isSortable
                    />
                  </div>
                ) : null}
              </DragOverlay>
            </DndContext>
          </div>
        ) : viewMode === 'list' ? (
          <div className="px-2 sm:px-4 md:px-6 lg:px-8">
            <VisualizacaoLista
              cronograma={cronograma}
              weekDates={weekDates}
              tarefasPorDia={tarefasPorDia}
              onStart={handleStart}
              onOpenConsolidada={(slot) => setSlotConsolidado(slot)}
              onOpenCompletion={openCompletionForDay}
              onToggle={handleToggle}
              onMarkPendencia={handleMarkPendencia}
              onDominar={handleDominar}
            />
          </div>
        ) : (
          <motion.div
            key="month"
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -10 }}
            className="min-h-0 flex-1 px-2 sm:px-4 md:px-6 lg:px-8"
          >
            <VisualizacaoMensal
              cronograma={cronograma}
              dataInicio={cronograma.dataInicio}
              onStart={handleStart}
              registrosEstudo={registrosEstudo}
              optimisticDone={optimisticDone}
            />
          </motion.div>
        )}
      </div>
      <DailyGoalCompletedModal
        open={Boolean(completionModalData)}
        onClose={() => setCompletionModalData(null)}
        {...(completionModalData || {})}
      />
      <TimerSettingsModal
        isOpen={showTimerSettings}
        onClose={() => setShowTimerSettings(false)}
        userUid={user?.uid}
      />
    </div>
  );
};

export default CronogramaPage;
