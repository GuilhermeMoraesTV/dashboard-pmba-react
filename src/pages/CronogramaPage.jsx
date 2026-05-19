import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  ChevronLeft, ChevronRight, Play, CheckCircle2, Hourglass,
  Layers, Bookmark, Plus, Zap, Map as MapIcon, CalendarDays, Shield,
  TrendingUp, Target, SkipForward, Trash2, AlertTriangle, X,
  BookOpen, Clock, Star, Flame, BarChart2, Sun, LayoutList,
  GripVertical, Calendar, LayoutGrid, Check, MoreHorizontal,
  BadgeCheck, Settings, FilePenLine, Loader2, Trophy,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
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
  writeBatch, doc, updateDoc, getDoc,
} from 'firebase/firestore';
import { db } from '../firebaseConfig';
import CronogramaCreateWizard from '../components/cronograma/WizardShell';
import ModalEditarCronograma from '../components/cronograma/ModalEditarCronograma';
import { useCronogramaSystem, getAgendaSemana, chaveAssuntoDominado } from '../hooks/useCronogramaSystem';
import { buildCompletionRegistro } from '../utils/completionRegistro';

// ─── CONSTANTES ───────────────────────────────────────────────────────────────
const MESES_PT   = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
const MESES_FULL = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
const DIAS_CURTO = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];
const DIAS_LONGO = ['Domingo','Segunda','Terça','Quarta','Quinta','Sexta','Sábado'];
const PALETA_CORES_HEX = [
  '#ef4444','#3b82f6','#10b981','#f59e0b','#8b5cf6',
  '#ec4899','#06b6d4','#f97316','#14b8a6','#84cc16',
];
const INTERVALOS_REVISAO = [1, 7, 30];

// ─── UTILITÁRIOS ──────────────────────────────────────────────────────────────
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

const CronogramaDiaConcluidoCard = ({ className = '', title = 'Cronograma do dia finalizado' }) => (
  <motion.div
    initial={{ opacity: 0, y: -8 }}
    animate={{ opacity: 1, y: 0 }}
    className={`relative overflow-hidden rounded-[28px] border border-emerald-300/70 bg-gradient-to-br from-emerald-500 via-green-500 to-teal-500 p-5 text-center text-white shadow-2xl shadow-emerald-500/25 sm:p-6 ${className}`}
  >
    <motion.div
      className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.35),transparent_36%)]"
      animate={{ opacity: [0.45, 0.75, 0.45] }}
      transition={{ duration: 2.4, repeat: Infinity }}
    />
    <motion.div
      className="relative mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-white text-emerald-600 shadow-xl"
      animate={{ scale: [1, 1.08, 1], rotate: [0, -3, 3, 0] }}
      transition={{ duration: 1.9, repeat: Infinity }}
    >
      <Trophy size={28} />
    </motion.div>
    <p className="relative text-[10px] font-black uppercase tracking-[0.28em] text-white/80">Meta do dia completa</p>
    <h3 className="relative mt-1 text-lg font-black uppercase tracking-tight">{title}</h3>
    <p className="relative mt-2 text-xs font-semibold uppercase tracking-wider text-white/75">
      Estudo e revisao do dia estao fechados.
    </p>
  </motion.div>
);

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

// ─── MODAL DE CONFIRMAÇÃO ──────────────────────────────────────────────────────
const ModalConfirm = ({ msg, onConfirm, onCancel, loading }) => (
  <motion.div
    initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
    className="fixed inset-0 bg-zinc-950/70 backdrop-blur-sm z-[200] flex items-center justify-center p-4"
  >
    <motion.div
      initial={{ scale: 0.95, y: 10 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 10 }}
      className="bg-white dark:bg-zinc-900 rounded-2xl p-6 max-w-sm w-full shadow-2xl border border-zinc-200 dark:border-zinc-800"
    >
      <div className="w-12 h-12 bg-red-100 dark:bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
        <AlertTriangle size={24} className="text-red-600 dark:text-red-500"/>
      </div>
      <p className="text-sm font-medium text-zinc-600 dark:text-zinc-300 text-center mb-6 leading-relaxed">{msg}</p>
      <div className="flex gap-3">
        <button onClick={onCancel} className="flex-1 py-2.5 bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 rounded-xl font-bold text-xs uppercase tracking-wide hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors">Cancelar</button>
        <button onClick={onConfirm} disabled={loading} className="flex-1 py-2.5 bg-red-600 text-white rounded-xl font-bold text-xs uppercase tracking-wide hover:bg-red-700 transition-colors disabled:opacity-60 flex items-center justify-center gap-2 shadow-sm">
          {loading ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"/> : <Trash2 size={14}/>}
          Confirmar
        </button>
      </div>
    </motion.div>
  </motion.div>
);

// ─── ESTADO VAZIO ──────────────────────────────────────────────────────────────
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

// ─── MODAL DE REVISÃO CONSOLIDADA ─────────────────────────────────────────────
const ModalRevisaoConsolidada = ({ slot, onClose, onDominar, dominiosLocal }) => {
  if (!slot?.isConsolidada) return null;
  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 bg-zinc-950/70 backdrop-blur-sm z-[250] flex items-end sm:items-center justify-center p-0 sm:p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ y: 60, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 60, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 350, damping: 30 }}
        className="bg-white dark:bg-zinc-900 rounded-t-3xl sm:rounded-2xl w-full sm:max-w-md shadow-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-500/10 flex items-center justify-center">
              <BarChart2 size={20} className="text-blue-600 dark:text-blue-500"/>
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-blue-600 dark:text-blue-500 leading-none mb-1">{slot.titulo || 'Revisão Consolidada'}</p>
              <p className="text-sm font-bold text-zinc-900 dark:text-zinc-100">{slot.topicosRevisao?.length || 0} tópicos agendados</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-zinc-200 dark:hover:bg-zinc-800 text-zinc-500 transition-colors">
            <X size={18}/>
          </button>
        </div>

        <div className="overflow-y-auto max-h-[60vh] divide-y divide-zinc-100 dark:divide-zinc-800/50">
          {(slot.topicosRevisao || []).map((t, idx) => {
            const chave    = chaveAssuntoDominado(t.disciplinaId, t.assunto);
            const dominado = !!(dominiosLocal[chave]);
            return (
              <div key={idx} className={`flex items-center gap-3 px-5 py-4 transition-colors ${dominado ? 'bg-amber-50/50 dark:bg-amber-900/10' : 'hover:bg-zinc-50 dark:hover:bg-zinc-800/50'}`}>
                <div className={`shrink-0 w-2 h-2 rounded-full ${dominado ? 'bg-amber-400' : 'bg-blue-500'}`}/>
                <div className="flex-1 min-w-0">
                  <p className={`text-xs font-black uppercase tracking-tight truncate ${dominado ? 'text-zinc-400 line-through' : 'text-zinc-900 dark:text-zinc-100'}`}>{t.disciplinaNome}</p>
                  <p className={`text-[11px] font-medium leading-snug truncate ${dominado ? 'text-zinc-400' : 'text-zinc-500 dark:text-zinc-400'}`}>{t.assunto}</p>
                  <p className="text-[10px] text-blue-500 font-bold mt-1">Revisão +{t.intervaloDias}d</p>
                </div>
                <button
                  onClick={() => onDominar(t.disciplinaId, t.assunto, dominado)}
                  className={`shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-xl border text-[10px] font-black uppercase tracking-wide transition-all duration-200 active:scale-95
                    ${dominado
                      ? 'bg-amber-100 dark:bg-amber-500/20 border-amber-300 dark:border-amber-500/30 text-amber-700 dark:text-amber-400'
                      : 'bg-white dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-zinc-500 hover:border-amber-300 hover:text-amber-600 dark:hover:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-900/20'
                    }`}
                >
                  <BadgeCheck size={14} className={dominado ? 'fill-amber-400 text-amber-500' : ''} strokeWidth={dominado ? 0 : 2}/>
                  {dominado ? 'Dominado' : 'Dominei'}
                </button>
              </div>
            );
          })}
        </div>

        <div className="px-5 py-4 border-t border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/50">
          <p className="text-[10px] text-zinc-500 dark:text-zinc-400 text-center leading-relaxed">
            Tópicos <span className="text-amber-500 font-bold">Dominados</span> não gerarão revisões futuras.
          </p>
        </div>
      </motion.div>
    </motion.div>
  );
};

// ─── CARD DE TAREFA ARRASTÁVEL ─────────────────────────────────────────────────
const TarefaCardDraggable = ({
  tarefa,
  onToggle,
  onMarkPendencia,
  onStart,
  onDominar,
  onOpenConsolidada,
  onOpenDetails,
  cronograma,
  isToggling = false,
  dragAttributes = {},
  dragListeners = {},
  dragRef = null,
  dragStyle = {},
  isDragging = false,
  isSortable = false,
}) => {
  const [showHint, setShowHint] = useState(false);

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
  const progressoPercentual = tempoPlanejadoMinutos > 0
    ? Math.min(100, Math.round((progressoLimitado / tempoPlanejadoMinutos) * 100))
    : (tarefa.concluido ? 100 : 0);
  const emAndamento = !tarefa.concluido && !tarefa.isRevisaoAuto && progressoLimitado > 0 && progressoPercentual < 100;

  return (
    <motion.div
      data-cronograma-task-card
      ref={dragRef}
      style={dragStyle}
      {...dragAttributes}
      {...dragListeners}
      layout
      initial={{ opacity: 0, y: 8, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95, y: -4 }}
      whileHover={!isDragging ? { y: -2, scale: 1.01 } : {}}
      onClick={!isDragging ? () => onOpenDetails?.(tarefa) : undefined}
      className={`relative min-h-[112px] rounded-2xl border overflow-hidden transition-all duration-200 group mb-2.5 select-none
        ${isSortable ? 'cursor-grab active:cursor-grabbing' : onOpenDetails ? 'cursor-pointer' : 'cursor-default'}
        ${isDragging ? 'opacity-80 scale-100 rotate-1 shadow-2xl z-20' : ''}
        ${tarefa.concluido
          ? 'bg-zinc-50 dark:bg-zinc-900/50 border-zinc-200 dark:border-zinc-800 opacity-70'
          : isDominado
          ? 'bg-amber-50/80 dark:bg-amber-500/5 border-amber-200 dark:border-amber-500/20'
          : emAndamento
          ? 'bg-orange-50/80 dark:bg-orange-500/5 border-orange-200 dark:border-orange-500/20'
          : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-700/50 shadow-sm hover:shadow-lg hover:border-red-200 dark:hover:border-red-900/60'
        }`}
    >
      {/* Linha lateral tática */}
      <div className={`absolute left-0 top-0 bottom-0 w-1.5 transition-colors duration-300 ${
        tarefa.concluido   ? 'bg-emerald-500'
        : isDominado       ? 'bg-amber-500'
        : tarefa.isRevisao ? 'bg-blue-500'
        : emAndamento      ? 'bg-orange-500'
        : 'bg-red-600'
      }`}/>

      <div className="flex h-full flex-col pl-4 pr-3 py-2.5 gap-2.5">
        <div className="flex items-start gap-3">
        <div
          {...dragListeners}
          onClick={(e) => e.stopPropagation()}
          className={`shrink-0 -ml-1 rounded-lg p-1 transition-all ${
            isSortable
              ? 'text-zinc-300 dark:text-zinc-600 opacity-0 group-hover:opacity-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-grab active:cursor-grabbing'
              : 'text-zinc-200 dark:text-zinc-800 opacity-50'
          }`}
        >
          <GripVertical size={14}/>
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-1.5 mb-1.5">
            <h4 className={`min-w-0 flex-1 text-[11px] font-black uppercase tracking-wide leading-tight ${
              tarefa.concluido ? 'text-zinc-400 line-through'
              : isDominado     ? 'text-amber-700 dark:text-amber-400'
              : emAndamento    ? 'text-orange-700 dark:text-orange-400'
              : 'text-zinc-900 dark:text-zinc-100'
            }`}>
              {tarefa.disciplinaNome}
            </h4>
            {tarefa.concluido && <CheckCircle2 size={12} className="text-emerald-500 shrink-0" strokeWidth={3}/>}
            {isDominado && !tarefa.concluido && <BadgeCheck size={12} className="text-amber-500 shrink-0 fill-amber-400" strokeWidth={0}/>}
            {emAndamento && (
              <span className="text-[9px] bg-orange-500 text-white px-1.5 py-0.5 rounded-sm font-bold shrink-0 leading-none">
                EM ANDAMENTO
              </span>
            )}
            {tarefa.isRevisao && !tarefa.concluido && !isDominado && (
              <span className="text-[9px] bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-400 px-1.5 py-0.5 rounded-sm font-bold shrink-0 leading-none">
                {isConsolidada ? 'CONSOL.' : 'REV'}
              </span>
            )}
            {tarefa.isPendenciaTeoria && !tarefa.concluido && (
              <span className="text-[9px] bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300 px-1.5 py-0.5 rounded-sm font-bold shrink-0 leading-none">
                PENDENTE
              </span>
            )}
          </div>
          <div className="flex items-start gap-2">
            <Bookmark size={11} className={`mt-0.5 shrink-0 ${tarefa.concluido ? 'text-zinc-300 dark:text-zinc-600' : isDominado ? 'text-amber-400' : 'text-red-500'}`} fill="currentColor"/>
            <span className={`text-xs font-semibold leading-snug line-clamp-2 ${
              tarefa.concluido ? 'text-zinc-400 dark:text-zinc-500' : isDominado ? 'text-amber-600 dark:text-amber-500/80' : 'text-zinc-500 dark:text-zinc-400'
            }`}>
              {assuntoTexto}
            </span>
          </div>
          {tarefa.isPendenciaTeoria && tarefa.assuntoOriginal && tarefa.assuntoOriginal !== tarefa.assunto && (
            <div className="mt-1 text-[9px] font-semibold uppercase tracking-wide text-amber-600 dark:text-amber-400">
              Assunto original: {tarefa.assuntoOriginal}
            </div>
          )}

        </div>
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-zinc-100 pt-2 dark:border-zinc-800/80">
          <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wide ${
              tarefa.isRevisao
                ? 'bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400'
                : emAndamento
                ? 'bg-orange-50 text-orange-600 dark:bg-orange-500/10 dark:text-orange-400'
                : isDominado
                ? 'bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400'
                : 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300'
            }`}>
              {tarefa.isRevisao ? 'Revisão' : 'Foco'}
            </span>
            {isSortable && !tarefa.concluido && (
              <span className="text-[9px] font-bold uppercase tracking-wide text-zinc-400 dark:text-zinc-600">
                Arraste p/ mover
              </span>
            )}
          </div>
          {modoExibirTempo !== 'oculto' && tempoPlanejadoMinutos > 0 && (
            <div className="mt-1.5">
              <div className="flex items-center justify-between gap-2">
                <span className="flex min-w-0 items-center gap-1.5 text-[10px] font-semibold text-zinc-500 dark:text-zinc-400 tabular-nums">
                  <Clock size={10} className="text-zinc-400 shrink-0"/>
                  {formatarDuracao(tarefa.concluido ? tempoPlanejadoMinutos : progressoLimitado)} / {formatarDuracao(tempoPlanejadoMinutos)}
                </span>
                <span className="text-[9px] font-black uppercase tracking-wide text-zinc-400">
                  {tarefa.concluido ? 100 : progressoPercentual}%
                </span>
              </div>
              <div className="mt-1 h-1.5 rounded-full bg-zinc-200 dark:bg-zinc-800 overflow-hidden">
                <motion.div
                  initial={false}
                  animate={{ width: `${tarefa.concluido ? 100 : progressoPercentual}%` }}
                  transition={{ duration: 0.25 }}
                  className={`h-full rounded-full ${tarefa.concluido ? 'bg-emerald-500' : emAndamento ? 'bg-orange-500' : 'bg-red-500'}`}
                />
              </div>
            </div>
          )}
        </div>

        {/* Ações */}
        <div className="shrink-0 flex items-center gap-0.5">
          {tarefa.isConsolidada && !tarefa.concluido && (
            <button
              onClick={(e) => { e.stopPropagation(); onOpenConsolidada(tarefa); }}
              className="p-1.5 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-500/10 text-blue-500 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
            >
              <BarChart2 size={14}/>
            </button>
          )}

          {!tarefa.isRevisaoAuto && !tarefa.concluido && (
            <button
              onClick={(e) => { e.stopPropagation(); onStart(tarefa); }}
              className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-500/10 text-zinc-400 hover:text-red-600 dark:hover:text-red-500 transition-colors"
            >
              <Play size={14} fill="currentColor"/>
            </button>
          )}

          <button
            onClick={(e) => { e.stopPropagation(); onToggle(tarefa); }}
            disabled={isToggling}
            className={`p-1.5 rounded-lg transition-all active:scale-95 ${
              tarefa.concluido
                ? 'text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-500/10'
                : 'text-zinc-300 dark:text-zinc-600 hover:text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-500/10'
            }`}
          >
            {isToggling
              ? <div className="w-4 h-4 border-2 border-current/30 border-t-current rounded-full animate-spin"/>
              : <CheckCircle2 size={16} strokeWidth={tarefa.concluido ? 2.5 : 2}/>
            }
          </button>

          {canMarkPendencia && (
            <button
              onClick={(e) => { e.stopPropagation(); onMarkPendencia(tarefa); }}
              disabled={isToggling}
              title="Ainda nao concluida"
              className="p-1.5 rounded-lg transition-all active:scale-95 text-zinc-300 dark:text-zinc-600 hover:text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-500/10 disabled:opacity-50"
            >
              <SkipForward size={15}/>
            </button>
          )}

          {!tarefa.isRevisaoAuto && (
            <button
              onMouseEnter={() => setShowHint(true)}
              onMouseLeave={() => setShowHint(false)}
              onClick={(e) => { e.stopPropagation(); setShowHint(false); onDominar(tarefa); }}
              className={`p-1.5 rounded-lg transition-all active:scale-95 ${
                isDominado
                  ? 'text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-500/10'
                  : 'text-zinc-300 dark:text-zinc-600 hover:text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-500/10'
              }`}
            >
              <BadgeCheck size={14} className={isDominado ? 'fill-amber-400' : ''} strokeWidth={isDominado ? 0 : 2}/>
            </button>
          )}
        </div>
        </div>
      </div>

      <AnimatePresence>
        {showHint && !isDominado && (
          <motion.div
            initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 4 }}
            className="absolute right-10 bottom-2 z-50 bg-zinc-800 dark:bg-zinc-100 text-white dark:text-zinc-900 text-[9px] font-bold px-2 py-1 rounded shadow-lg pointer-events-none whitespace-nowrap"
          >
            Dominei o assunto
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

const ModalDetalhesCronograma = ({ slot, cronograma, onClose, onStart }) => {
  if (!slot) return null;

  const isRevisao = slot.isRevisaoAuto || slot.isRevisao;
  const isConsolidada = slot.isConsolidada === true;
  const tempoPlanejado = Number(slot.tempoPlanejadoMinutos ?? slot.tempoMinutos ?? slot.minutosEstudo ?? 0);
  const progressoMinutos = slot.concluido
    ? tempoPlanejado
    : Math.min(Number(slot.progressoMinutos || 0), tempoPlanejado || Number(slot.progressoMinutos || 0));
  const progressoPercentual = tempoPlanejado > 0
    ? Math.min(100, Math.round((progressoMinutos / tempoPlanejado) * 100))
    : (slot.concluido ? 100 : 0);
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
      className="fixed inset-0 z-[260] flex items-center justify-center px-4"
    >
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-zinc-950/80 backdrop-blur-sm"
      />

      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="relative w-full max-w-2xl overflow-hidden rounded-3xl border border-zinc-200 bg-white shadow-2xl dark:border-zinc-800 dark:bg-zinc-900"
      >
        <div className={`h-2 w-full ${isRevisao ? 'bg-blue-600' : 'bg-red-600'}`} />

        <div className="p-6 sm:p-8">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <div className="mb-4 flex flex-wrap gap-2">
                <span className={`rounded-md px-2.5 py-1 text-[10px] font-black uppercase tracking-widest text-white ${isRevisao ? 'bg-blue-600' : 'bg-red-600'}`}>
                  {getLabelTipo(slot)}
                </span>
                {slot.concluido && (
                  <span className="rounded-md bg-emerald-100 px-2.5 py-1 text-[10px] font-black uppercase tracking-widest text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400">
                    Concluído
                  </span>
                )}
                {slot.dominado && (
                  <span className="rounded-md bg-amber-100 px-2.5 py-1 text-[10px] font-black uppercase tracking-widest text-amber-700 dark:bg-amber-500/20 dark:text-amber-400">
                    Dominado
                  </span>
                )}
              </div>

              <h3 className="text-2xl font-black uppercase tracking-tight text-zinc-900 dark:text-white">
                {getNomeDisc(slot)}
              </h3>
              <p className="mt-2 text-sm font-medium leading-relaxed text-zinc-600 dark:text-zinc-400">
                {getTextoAssunto(slot, cronograma)}
              </p>
            </div>

            <button
              onClick={onClose}
              className="rounded-xl bg-zinc-100 p-2 text-zinc-500 transition-all hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700"
            >
              <X size={20} />
            </button>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-3">
            <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-950/50">
              <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500 dark:text-zinc-400">Tempo planejado</p>
              <p className="mt-2 text-2xl font-black text-zinc-900 dark:text-white">{formatarDuracao(tempoPlanejado)}</p>
              {tempoPlanejado > 0 && (
                <div className="mt-3">
                  <div className="flex items-center justify-between gap-2 text-[10px] font-black uppercase tracking-wide">
                    <span className={slot.concluido ? 'text-emerald-600 dark:text-emerald-400' : progressoMinutos > 0 ? 'text-orange-500' : 'text-zinc-400'}>
                      {formatarDuracao(progressoMinutos)} / {formatarDuracao(tempoPlanejado)}
                    </span>
                    <span className="text-zinc-400">{progressoPercentual}%</span>
                  </div>
                  <div className="mt-1.5 h-2 rounded-full bg-zinc-200 dark:bg-zinc-800 overflow-hidden">
                    <motion.div
                      initial={false}
                      animate={{ width: `${progressoPercentual}%` }}
                      transition={{ duration: 0.25 }}
                      className={`h-full rounded-full ${slot.concluido ? 'bg-emerald-500' : progressoMinutos > 0 ? 'bg-orange-500' : 'bg-red-500'}`}
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-950/50">
              <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500 dark:text-zinc-400">Dia agendado</p>
              <p className="mt-2 text-base font-black uppercase tracking-wide text-zinc-900 dark:text-white">
                {formatarDataLonga(dataSlot)}
              </p>
              <p className="mt-1 text-[11px] font-bold uppercase tracking-wide text-zinc-500">
                Semana {Number(slot.weekOffset ?? 0) + 1}
              </p>
            </div>

            <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-950/50">
              <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500 dark:text-zinc-400">
                {isRevisao ? 'Origem da revisão' : 'Status da missão'}
              </p>
              <p className="mt-2 text-base font-black uppercase tracking-wide text-zinc-900 dark:text-white">
                {isRevisao
                  ? formatarDataLonga(dataBaseRevisao)
                  : slot.concluido
                  ? 'Finalizada'
                  : progressoMinutos > 0
                  ? 'Em andamento'
                  : 'Planejada'}
              </p>
              <p className="mt-1 text-[11px] font-bold uppercase tracking-wide text-zinc-500">
                {isRevisao
                  ? `Intervalo de ${slot.intervaloDias ?? 0} dia(s)`
                  : `${proximasRevisoes.length} revisão(ões) previstas`}
              </p>
            </div>
          </div>

          <div className="mt-6 grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
            <div className="rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
              <p className="text-[10px] font-black uppercase tracking-widest text-red-600 dark:text-red-500">
                {isConsolidada ? 'Tópicos consolidados' : 'Foco desta sessão'}
              </p>

              {isConsolidada && slot.topicosRevisao?.length > 0 ? (
                <div className="mt-4 space-y-3">
                  {slot.topicosRevisao.map((topico, index) => (
                    <div key={`${topico.disciplinaId || topico.disciplinaNome}-${index}`} className="flex items-start gap-3 rounded-xl bg-zinc-50 px-3 py-3 dark:bg-zinc-800/50">
                      <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-blue-500" />
                      <div className="min-w-0">
                        <p className="text-xs font-black uppercase tracking-wide text-zinc-900 dark:text-zinc-100">
                          {topico.disciplinaNome}
                        </p>
                        <p className="mt-1 text-xs leading-relaxed text-zinc-600 dark:text-zinc-400">
                          {topico.assunto}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-4 text-sm font-medium leading-relaxed text-zinc-700 dark:text-zinc-300">
                  {isRevisao
                    ? slot.assunto || slot.assuntoOriginal || 'Revisão espaçada agendada para reforço do conteúdo.'
                    : slot.assunto || 'Sessão planejada para avançar no conteúdo principal da disciplina.'}
                </p>
              )}
            </div>

            <div className="rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
              <p className="text-[10px] font-black uppercase tracking-widest text-red-600 dark:text-red-500">
                {isRevisao ? 'Leitura estratégica' : 'Próximas revisões'}
              </p>

              {isRevisao ? (
                <div className="mt-4 space-y-3">
                  <div className="rounded-xl bg-zinc-50 px-4 py-3 dark:bg-zinc-800/50">
                    <p className="text-[11px] font-black uppercase tracking-wide text-zinc-900 dark:text-zinc-100">Próximo marco</p>
                    <p className="mt-1 text-xs leading-relaxed text-zinc-600 dark:text-zinc-400">
                      Esta revisão reforça o estudo iniciado em {formatarDataCurta(dataBaseRevisao)} e mantém o ciclo ativo.
                    </p>
                  </div>
                  <div className="rounded-xl bg-blue-50 px-4 py-3 dark:bg-blue-500/10">
                    <p className="text-[11px] font-black uppercase tracking-wide text-blue-700 dark:text-blue-400">Janela atual</p>
                    <p className="mt-1 text-xs leading-relaxed text-blue-800/70 dark:text-blue-300/70">
                      Revisão programada para {formatarDataCurta(dataSlot)} com intervalo de {slot.intervaloDias ?? 0} dia(s).
                    </p>
                  </div>
                </div>
              ) : (
                <div className="mt-4 space-y-3">
                  {proximasRevisoes.map((revisao) => (
                    <div key={revisao.dias} className="flex items-center justify-between rounded-xl bg-zinc-50 px-4 py-3 dark:bg-zinc-800/50">
                      <div>
                        <p className="text-[11px] font-black uppercase tracking-wide text-zinc-900 dark:text-zinc-100">Revisão +{revisao.dias}d</p>
                        <p className="mt-0.5 text-[10px] font-medium uppercase tracking-wide text-zinc-500">
                          {formatarDataLonga(revisao.data)}
                        </p>
                      </div>
                      <div className="rounded px-2 py-1 text-[9px] font-black uppercase tracking-wide text-red-600 bg-red-100 dark:bg-red-500/20 dark:text-red-400">
                        Prevista
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            {!isRevisao && onStart && (
              <button
                onClick={() => onStart(slot)}
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-red-600 px-4 py-3.5 text-xs font-black uppercase tracking-widest text-white transition-all hover:bg-red-700"
              >
                <Play size={14} fill="currentColor" />
                Iniciar Estudo
              </button>
            )}
            <button
              onClick={onClose}
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl border border-zinc-200 bg-white px-4 py-3.5 text-xs font-black uppercase tracking-widest text-zinc-700 transition-all hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700"
            >
              Fechar
            </button>
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
    transition: sortable.transition,
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
  const topicosRevisao = revisoes.flatMap((tarefa) => {
    if (Array.isArray(tarefa.topicosRevisao) && tarefa.topicosRevisao.length > 0) {
      return tarefa.topicosRevisao;
    }
    return [{
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
              {formatarDuracao(totalMinutos)}
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
  onDominar, onOpenConsolidada, onOpenDetails, cronograma, toggleLoadingId
}) => {
  const concluidos    = tarefas.filter(t => t.concluido).length;
  const total         = tarefas.length;
  const totalMinutosDia = tarefas.reduce((acc, tarefa) => (
    acc + Number(tarefa.tempoMinutos ?? tarefa.tempoPlanejadoMinutos ?? tarefa.minutosEstudo ?? 0)
  ), 0);
  const progressoMinutosDia = tarefas.reduce((acc, tarefa) => {
    const tempo = Number(tarefa.tempoMinutos ?? tarefa.tempoPlanejadoMinutos ?? tarefa.minutosEstudo ?? 0);
    const progresso = tarefa.concluido ? tempo : Math.min(Number(tarefa.progressoMinutos || 0), tempo || Number(tarefa.progressoMinutos || 0));
    return acc + progresso;
  }, 0);
  const todoConcluido = total > 0 && concluidos === total;
  const { isOver, setNodeRef } = useDroppable({
    id: `day-${diaSemanaIdx}`,
    data: {
      type: 'day',
      dia: diaSemanaIdx,
    },
  });
  const draggablesNoDia = tarefas.filter(isMovableTask).map(getDragTaskId);
  const progresso = totalMinutosDia > 0 ? Math.round((progressoMinutosDia / totalMinutosDia) * 100) : 0;
  const revisoesAgrupadas = tarefas.filter((tarefa) => tarefa.isRevisao || tarefa.isRevisaoAuto || tarefa.isConsolidada);
  const tarefasVisiveis = tarefas.filter((tarefa) => !(tarefa.isRevisao || tarefa.isRevisaoAuto || tarefa.isConsolidada));

  return (
    <div
      ref={setNodeRef}
      className={`flex flex-col rounded-[22px] border transition-all duration-300 relative
        ${isOver
          ? 'border-dashed border-red-500 bg-red-50/50 p-2 dark:bg-red-500/10 scale-[1.01] ring-2 ring-red-500/20'
          : isHoje
          ? 'border-red-500/60 ring-1 ring-red-500/30 shadow-md bg-white/70 p-2 dark:bg-zinc-950/40'
          : todoConcluido
          ? 'border-emerald-200 bg-zinc-50/70 p-2 dark:border-emerald-800/40 dark:bg-zinc-950/30'
          : 'border-zinc-200 bg-zinc-50/70 p-2 shadow-sm hover:border-zinc-300 dark:border-zinc-800 dark:bg-zinc-950/30 dark:hover:border-zinc-700'
        }`}
    >
      {/* Header do dia */}
      <div className={`mb-3 shrink-0 rounded-2xl px-4 py-3 transition-all duration-300 border shadow-sm
        ${isHoje
          ? 'bg-zinc-950 text-white border-red-500/60 dark:bg-zinc-900 dark:text-white dark:border-red-500/40'
          : todoConcluido
          ? 'bg-zinc-900 text-white border-emerald-500/30 dark:bg-zinc-900 dark:text-white dark:border-emerald-500/30'
          : 'bg-zinc-900 text-white border-zinc-800 dark:bg-zinc-900 dark:text-white dark:border-zinc-800'
        }`}
      >
          <div className="flex justify-between items-start gap-3">
            <div>
              <p className={`text-[10px] font-black uppercase tracking-widest ${isHoje ? 'text-red-200 dark:text-red-600' : todoConcluido ? 'text-emerald-300 dark:text-emerald-600' : 'text-zinc-400 dark:text-zinc-500'}`}>
                {MESES_FULL[date.getMonth()]}
              </p>
              <h3 className="mt-0.5 text-lg font-black leading-none uppercase tracking-tight text-white">
                {DIAS_LONGO[diaSemanaIdx]}
              </h3>
              <div className={`mt-1 text-[11px] font-bold uppercase tracking-widest ${isHoje ? 'text-red-100 dark:text-red-600' : todoConcluido ? 'text-emerald-200 dark:text-emerald-600/80' : 'text-zinc-300 dark:text-zinc-500'}`}>
                {date.getDate()} {MESES_PT[date.getMonth()]}
              </div>
            </div>

          <div className="flex flex-col items-end gap-2">
            <div className={`rounded-lg border px-2 py-1.5 ${
              isHoje
                ? 'border-white/20 bg-white/10 text-white dark:border-white/10 dark:bg-white/10 dark:text-white'
                : todoConcluido
                ? 'border-white/10 bg-white/10 text-white dark:border-white/10 dark:bg-white/10 dark:text-white'
                : 'border-white/10 bg-white/10 text-white dark:border-white/10 dark:bg-white/10 dark:text-white'
            }`}>
              <div className="flex items-center gap-1.5">
                <Clock size={12} className={isHoje ? 'text-white' : todoConcluido ? 'text-emerald-300' : 'text-zinc-300'} />
                <div className="flex flex-col items-end leading-none">
                  <span className={`text-[8px] font-black uppercase tracking-widest ${
                    isHoje ? 'text-red-100' : 'text-zinc-300'
                  }`}>
                    Tempo
                  </span>
                  <span className="mt-0.5 text-[11px] font-black tabular-nums text-white">
                    {formatarDuracao(totalMinutosDia)}
                  </span>
                </div>
              </div>
            </div>
            {isHoje && (
              <span className="text-[9px] font-black bg-white text-red-600 px-2 py-0.5 rounded shadow-sm uppercase flex items-center gap-1">
                <Flame size={10}/> Hoje
              </span>
            )}
            {todoConcluido && !isHoje && (
              <motion.div
                initial={{ scale: 0 }} animate={{ scale: 1 }}
                className="w-6 h-6 rounded-full bg-emerald-100 dark:bg-emerald-500/20 flex items-center justify-center"
              >
                <CheckCircle2 size={14} className="text-emerald-600 dark:text-emerald-400"/>
              </motion.div>
            )}
            {total > 0 && !todoConcluido && (
              <div className="rounded bg-white/10 px-2 py-0.5 text-[10px] font-black text-white">
                {concluidos}/{total}
              </div>
            )}
          </div>
        </div>

        {/* Progress bar no header */}
        {total > 0 && (
          <div className={`mt-3 h-1.5 rounded-full overflow-hidden ${isHoje ? 'bg-white/20' : 'bg-white/15'}`}>
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${progresso}%` }}
              transition={{ duration: 0.7, ease: 'easeOut', delay: 0.1 }}
              className={`h-full rounded-full ${isHoje ? 'bg-red-400 dark:bg-red-600' : todoConcluido ? 'bg-emerald-500' : 'bg-red-500'}`}
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
            <span className="text-[10px] font-bold uppercase text-zinc-400 tracking-widest">Área Livre</span>
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
                    isToggling={toggleLoadingId === (t.slotIdBase || t.slotId)}
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
                    isToggling={toggleLoadingId === (t.slotIdBase || t.slotId)}
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

// ─── VISUALIZAÇÃO MENSAL ───────────────────────────────────────────────────────
const VisualizacaoMensal = ({ cronograma, dataInicio, onStart }) => {
  const [mesAtual, setMesAtual] = useState(() => new Date());
  const [diaSelecionado, setDiaSelecionado] = useState(null);

  const days = useMemo(() => getCalendarDays(mesAtual.getFullYear(), mesAtual.getMonth()), [mesAtual]);
  const hoje = new Date().toDateString();

  const corPorDisciplina = useMemo(() => {
    const mapa = {};
    let idx = 0;
    (cronograma?.semanaTemplate || []).forEach((slot) => {
      if (slot.disciplinaId && !(slot.disciplinaId in mapa)) {
        mapa[slot.disciplinaId] = PALETA_CORES_HEX[idx % PALETA_CORES_HEX.length];
        idx++;
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
        const tempoMinutos = Number(slot.tempoMinutos ?? slot.minutosEstudo ?? 0);
        slotsPorData[dataKey].push({ ...slot, tempoMinutos });
        if (slot.isRevisaoAuto) revisoesPorData.add(dataKey);
      });
    }

    Object.values(slotsPorData).forEach((slotsDia) => {
      if (!slotsDia.length) return;
      metricas.diasComEstudo += 1;
      metricas.blocos += slotsDia.length;
      metricas.minutos += slotsDia.reduce((acc, slot) => acc + Number(slot.tempoMinutos || 0), 0);
    });

    return { slotsPorData, revisoesPorData, metricas };
  }, [cronograma, dataInicio, days]);

  const getSlotsEstudo = useCallback((item) => {
    if (item.type !== 'current') return [];
    const dataKey = item.date.toISOString().split('T')[0];
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
        <div className="min-h-0 flex-1 overflow-y-auto px-2 sm:px-3 pb-3">
          <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            className="grid grid-cols-7 gap-2 sm:gap-3 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
          >
            {days.map((item, i) => {
              const slots = getSlotsEstudo(item);
              const isHoje = item.date.toDateString() === hoje;
              const isSelected = diaSelecionado?.date.toDateString() === item.date.toDateString();
              const isMesAtual = item.type === 'current';
              const dataKey = item.date.toISOString().split('T')[0];
              const totalMinutosDia = slots.reduce((acc, slot) => acc + Number(slot.tempoMinutos ?? slot.minutosEstudo ?? 0), 0);
              const temRevisao = agendaMes.revisoesPorData.has(dataKey) && isMesAtual;
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
                    cor: slot.isRevisao || slot.isRevisaoAuto ? '#3b82f6' : (corPorDisciplina[slot.disciplinaId] || '#94a3b8'),
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
                  className={`relative min-h-[110px] overflow-hidden rounded-xl border p-2 text-left transition-all ${
                    isHoje
                      ? 'border-red-500 bg-red-50 ring-1 ring-red-500/30 dark:bg-red-500/10'
                      : isMesAtual
                      ? 'border-zinc-200 bg-white hover:border-zinc-300 dark:border-zinc-700/50 dark:bg-zinc-800/30 dark:hover:border-zinc-500'
                      : 'border-transparent bg-zinc-50 opacity-40 dark:bg-zinc-950'
                  } ${isSelected ? 'ring-2 ring-red-500 dark:ring-red-500' : ''}`}
                >
                  <div className="relative z-10 mb-2 flex items-start justify-between">
                    <span className={`text-[10px] font-black uppercase tracking-widest ${isHoje ? 'text-red-600 dark:text-red-500' : 'text-zinc-500 dark:text-zinc-500'}`}>
                      {DIAS_CURTO[item.date.getDay()]}
                    </span>
                    <span className={`text-sm font-black ${isHoje ? 'text-red-600 dark:text-red-500' : 'text-zinc-700 dark:text-zinc-400'}`}>
                      {item.day}
                    </span>
                  </div>

                  <div className="relative z-10 flex flex-col gap-1">
                    {slots.length > 0 && (
                      <div className="w-fit rounded border border-zinc-200 bg-zinc-100 px-1.5 py-0.5 text-[9px] font-bold tabular-nums text-zinc-600 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 mb-1">
                        Total: {formatarDuracao(totalMinutosDia)}
                      </div>
                    )}

                    {resumoPorDisc.slice(0, 3).map((disc) => (
                      <div key={disc.chave} className="flex items-center justify-between gap-1 rounded bg-zinc-50 px-1.5 py-1 dark:bg-zinc-800/80">
                        <div className="flex min-w-0 items-center gap-1.5">
                          <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: disc.cor }} />
                          <span className={`truncate text-[9px] font-bold uppercase ${disc.isRevisao ? 'text-blue-600 dark:text-blue-400' : 'text-zinc-700 dark:text-zinc-300'}`}>
                            {disc.nome}
                          </span>
                        </div>
                        <span className="text-[9px] font-black tabular-nums text-zinc-500 dark:text-zinc-400">
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
                      <div className="pt-2 text-[9px] font-bold uppercase tracking-widest text-zinc-400 dark:text-zinc-600">
                        {temRevisao ? 'Revisão' : 'Livre'}
                      </div>
                    )}
                  </div>
                </motion.button>
              );
            })}
          </motion.div>
        </div>
      </div>

      <AnimatePresence>
        {diaSelecionado && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[220] flex items-center justify-center p-4"
          >
            <div className="absolute inset-0 bg-zinc-950/70 backdrop-blur-sm" onClick={() => setDiaSelecionado(null)} />
            <motion.div
              initial={{ opacity: 0, y: 24, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 24, scale: 0.98 }}
              className="relative w-full max-w-2xl rounded-2xl border border-zinc-200 bg-white shadow-2xl dark:border-zinc-800 dark:bg-zinc-900"
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
    </div>
  );
};

const VisualizacaoLista = ({ cronograma, weekDates, tarefasPorDia, onStart, onOpenConsolidada, onToggle, onMarkPendencia, onDominar, toggleLoadingId }) => {
  const hojeStr = new Date().toDateString();
  const diasComItens = weekDates
    .map((date) => {
      const dia = date.getDay();
      const tarefas = tarefasPorDia[dia] || [];
      return { date, dia, tarefas };
    })
    .filter(({ tarefas }) => tarefas.length > 0)
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
      ? tempo
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
      className="mx-auto w-full max-w-4xl px-1 sm:px-4"
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
            const diaCompleto = tarefas.length > 0 && concluidos === tarefas.length;

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
                <div className={`flex flex-col gap-3 border-b px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5 ${
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
                    <span className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[10px] font-black uppercase tracking-wider ${
                      diaCompleto
                        ? 'bg-emerald-600 text-white'
                        : 'bg-zinc-900 text-white dark:bg-zinc-800'
                    }`}>
                      {concluidos}/{tarefas.length}
                    </span>
                  </div>
                </div>

                <div className="relative px-3 py-4 sm:px-5">
                  <div className="absolute bottom-4 left-[31px] top-4 w-0.5 bg-zinc-200 dark:bg-zinc-800 sm:left-[47px]" />

                  <div className="relative z-10 space-y-3 sm:space-y-4">
                    {diaCompleto && (
                      <CronogramaDiaConcluidoCard
                        className="mb-4 ml-0 sm:ml-16"
                        title="Dia do cronograma finalizado"
                      />
                    )}
                    {tarefas.map((tarefa, tarefaIdx) => {
                      const idx = inicio + tarefaIdx;
              const hoje = date.toDateString() === hojeStr;
              const isRevisao = tarefa.isRevisao || tarefa.isRevisaoAuto;
              const isDominado = tarefa.dominado === true;
              const isCompleted = tarefa.concluido;
              const isActive = idx === activeIndex;
              const tempo = Number(tarefa.tempoPlanejadoMinutos ?? tarefa.tempoMinutos ?? tarefa.minutosEstudo ?? 0);
              const progressoMinutos = isCompleted
                ? tempo
                : Math.min(Number(tarefa.progressoMinutos || 0), tempo || Number(tarefa.progressoMinutos || 0));
              const progressoPercentual = tempo > 0
                ? Math.min(100, Math.round((progressoMinutos / tempo) * 100))
                : (isCompleted ? 100 : 0);
              const emAndamento = !isCompleted && progressoMinutos > 0 && progressoPercentual < 100;
              const canStart = !tarefa.isRevisaoAuto && !isCompleted;
              const isLoading = toggleLoadingId === (tarefa.slotIdBase || tarefa.slotId);

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

                  <motion.div
                    whileHover={{ x: 4 }}
                    className={`flex-1 overflow-hidden rounded-2xl border transition-all sm:rounded-3xl ${
                      isActive
                        ? isRevisao
                          ? 'border-blue-500/35 bg-blue-50/70 shadow-2xl shadow-blue-500/10 dark:border-blue-900/50 dark:bg-blue-950/10'
                          : 'border-red-500/30 bg-white shadow-2xl shadow-red-500/10 dark:bg-zinc-900'
                        : isCompleted
                          ? 'border-emerald-200 bg-emerald-50/80 shadow-lg shadow-emerald-500/10 dark:border-emerald-900/40 dark:bg-emerald-950/20'
                          : isDominado
                            ? 'border-amber-200 bg-amber-50/70 shadow-lg shadow-amber-500/10 dark:border-amber-900/30 dark:bg-amber-950/10'
                            : isRevisao
                              ? 'border-blue-100 bg-blue-50/30 shadow-lg shadow-blue-500/5 dark:border-blue-900/30 dark:bg-blue-950/10'
                              : 'border-zinc-100 bg-transparent dark:border-zinc-800'
                    }`}
                  >
                    <div className="p-3 sm:p-4">
                      <div className="flex items-start justify-between gap-2 sm:gap-3">
                        <div className="min-w-0">
                          <div className="mb-1 flex flex-wrap items-center gap-1.5">
                            <span className={`rounded-md px-2 py-0.5 text-[9px] font-black uppercase tracking-widest ${
                              isCompleted
                                ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300'
                                : isActive
                                  ? isRevisao
                                    ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
                                    : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                                  : isDominado
                                    ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'
                                    : 'bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400'
                            }`}>
                              {isCompleted ? 'Concluida' : isActive ? 'Agora' : isDominado ? 'Dominado' : 'Proxima'}
                            </span>
                            <span className="text-[10px] font-medium text-zinc-400">
                              {DIAS_CURTO[dia]}, {date.getDate()} {MESES_PT[date.getMonth()]}
                            </span>
                            {hoje && (
                              <span className={`rounded-md px-2 py-0.5 text-[9px] font-black uppercase tracking-widest text-white ${isRevisao ? 'bg-blue-600' : 'bg-red-600'}`}>
                                Hoje
                              </span>
                            )}
                          </div>
                          <h3 className={`text-sm font-black uppercase leading-tight tracking-tight sm:text-base ${
                            isCompleted ? 'text-emerald-800 dark:text-emerald-200' : 'text-zinc-900 dark:text-white'
                          }`}>
                            {getNomeDisc(tarefa)}
                          </h3>
                        </div>

                        {tempo > 0 && (
                          <div className="flex shrink-0 items-center gap-1.5 rounded-lg border border-zinc-200/50 bg-zinc-100 px-2 py-1 dark:border-zinc-700/50 dark:bg-zinc-800">
                            <Clock size={12} className="text-zinc-400" />
                            <span className="text-xs font-black tabular-nums text-zinc-600 dark:text-zinc-300">
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
                        <div className="mt-2.5 sm:mt-3">
                          <div className="mb-1.5 flex items-center justify-between gap-2 text-[9px] font-black uppercase tracking-wide">
                            <span className={isCompleted ? 'text-emerald-600 dark:text-emerald-400' : emAndamento ? 'text-orange-600 dark:text-orange-400' : 'text-zinc-400'}>
                              {formatarDuracao(progressoMinutos)} / {formatarDuracao(tempo)}
                            </span>
                            <span className="text-zinc-400">{progressoPercentual}%</span>
                          </div>
                          <div className="h-1.5 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800">
                            <motion.div
                              initial={false}
                              animate={{ width: `${progressoPercentual}%` }}
                              transition={{ duration: 0.25 }}
                              className={`h-full rounded-full ${isCompleted ? 'bg-emerald-500' : emAndamento ? 'bg-orange-500' : isRevisao ? 'bg-blue-500' : 'bg-red-500'}`}
                            />
                          </div>
                        </div>
                      )}

                      {isActive && (
                        <div className="mt-3 flex flex-wrap items-center gap-2">
                          {canStart && (
                            <button
                              onClick={() => onStart(tarefa)}
                              className="inline-flex h-8 items-center justify-center gap-1.5 rounded-xl bg-red-600 px-3 text-[9px] font-black uppercase tracking-wider text-white shadow-md shadow-red-600/15 transition-all hover:bg-red-700 hover:shadow-red-700/20 active:scale-95 sm:h-9 sm:px-4"
                            >
                              <Play size={14} fill="currentColor" />
                              Iniciar Estudo
                            </button>
                          )}
                          {tarefa.isConsolidada && !isCompleted && (
                            <button
                              onClick={() => onOpenConsolidada(tarefa)}
                              className="inline-flex h-8 items-center justify-center gap-1.5 rounded-xl bg-blue-600 px-3 text-[9px] font-black uppercase tracking-wider text-white shadow-md shadow-blue-600/15 transition-all hover:bg-blue-700 active:scale-95 sm:h-9 sm:px-4"
                            >
                              <BarChart2 size={14} />
                              Ver Revisao
                            </button>
                          )}
                          <button
                            onClick={() => onToggle(tarefa)}
                            disabled={isLoading}
                            className="inline-flex h-8 items-center justify-center gap-1.5 rounded-xl bg-emerald-600 px-3 text-[9px] font-black uppercase tracking-wider text-white shadow-md shadow-emerald-600/20 transition-all hover:bg-emerald-700 active:scale-95 disabled:opacity-60 sm:h-9 sm:px-4"
                          >
                            {isLoading ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} strokeWidth={3} />}
                            Concluir
                          </button>
                        </div>
                      )}

                      {!isCompleted && (
                        <div className="mt-2.5 flex flex-wrap items-center gap-2 sm:mt-3">
                          {!isRevisao && (
                            <button
                              onClick={() => onMarkPendencia(tarefa)}
                              disabled={isLoading}
                              className="flex h-8 items-center gap-1.5 rounded-xl bg-amber-50 px-3 text-[9px] font-black uppercase tracking-wider text-amber-700 transition-colors hover:bg-amber-100 disabled:opacity-60 dark:bg-amber-950/20 dark:text-amber-300 dark:hover:bg-amber-950/30"
                            >
                              <SkipForward size={14} />
                              Ainda nao conclui
                            </button>
                          )}
                          {!tarefa.isRevisaoAuto && (
                            <button
                              onClick={() => onDominar(tarefa)}
                              className="flex h-8 items-center gap-1.5 rounded-xl bg-white/70 px-3 text-[9px] font-black uppercase tracking-wider text-zinc-500 transition-colors hover:text-amber-600 dark:bg-zinc-900/50 dark:hover:text-amber-300"
                            >
                              <BadgeCheck size={14} className={isDominado ? 'fill-amber-400 text-amber-500' : ''} strokeWidth={isDominado ? 0 : 2} />
                              {isDominado ? 'Dominado' : 'Dominei'}
                            </button>
                          )}
                        </div>
                      )}

                      {isCompleted && (
                        <div className="mt-3 flex flex-wrap items-center gap-2">
                          <div className="flex h-8 items-center gap-1.5 rounded-xl border border-emerald-200 bg-white/70 px-3 text-[9px] font-black uppercase tracking-wider text-emerald-700 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-300">
                            <CheckCircle2 size={14} />
                            Estudo concluido
                          </div>
                          <button
                            onClick={() => onToggle(tarefa)}
                            disabled={isLoading}
                            className="flex h-8 items-center gap-1.5 rounded-xl bg-white/70 px-3 text-[9px] font-black uppercase tracking-wider text-zinc-500 transition-colors hover:text-zinc-800 disabled:opacity-60 dark:bg-zinc-900/50 dark:hover:text-white"
                          >
                            {isLoading ? <Loader2 size={14} className="animate-spin" /> : <MoreHorizontal size={14} />}
                            Alterar
                          </button>
                        </div>
                      )}
                    </div>
                  </motion.div>
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

        {diaConcluido ? (
          <CronogramaDiaConcluidoCard className="min-h-[180px] flex flex-col items-center justify-center" />
        ) : (
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
                    className="text-red-500"
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
                  <span className="text-[9px] font-black uppercase tracking-widest text-white/50">Hoje</span>
                </div>
              </div>
              <p className="text-xs font-black uppercase tracking-widest text-white/70">
                {concluidos}/{total || 0} concluídos
              </p>
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
};

// ─── PÁGINA PRINCIPAL ──────────────────────────────────────────────────────────
const CronogramaPage = ({ user, onStartStudy, addRegistroEstudo, deleteCompletionRegistro, onGoToEdital }) => {
  const [cronograma,        setCronograma]        = useState(null);
  const [loadingPage,       setLoadingPage]       = useState(true);
  const [showWizard,        setShowWizard]        = useState(false);
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);
  const [weekOffset,        setWeekOffset]        = useState(0);
  const [toast,             setToast]             = useState(null);
  const [loadingAction,     setLoadingAction]     = useState(false);
  const [toggleLoadingId,   setToggleLoadingId]   = useState(null);
  const [viewMode,          setViewMode]          = useState('list');
  const [slotConsolidado,   setSlotConsolidado]   = useState(null);
  const [mostrandoEditar,   setMostrandoEditar]   = useState(false);
  const [settingsOpen,      setSettingsOpen]      = useState(false);
  const [settingsPos,       setSettingsPos]       = useState(null);
  const [dominiosLocal,     setDominiosLocal]     = useState({});
  const [activeDragTask,    setActiveDragTask]    = useState(null);
  const [slotDetalhes,      setSlotDetalhes]      = useState(null);

  const settingsBtnRef = useRef(null);
  const weekScrollRef = useRef(null);
  const weekPanRef = useRef({ active: false, startX: 0, scrollLeft: 0, pointerId: null });
  const dragSensors = useSensors(useSensor(PointerSensor, {
    activationConstraint: {
      distance: 8,
    },
  }));

  const {
    getWeekDates,
    getCurrentWeekOffset,
    toggleSlotConcluido,
    marcarTeoriaAindaNaoConcluida,
    toggleAssuntoDominado,
    excluirCronograma,
  } = useCronogramaSystem(user);

  const showToast = useCallback((msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2800);
  }, []);

  const adiarCronograma = async (cronogramaId, cronogramaAtual) => {
    try {
      const dataAtual = new Date(cronogramaAtual.dataInicio + 'T12:00:00');
      dataAtual.setDate(dataAtual.getDate() + 7);
      const novaData = dataAtual.toISOString().split('T')[0];
      await updateDoc(doc(db, 'users', user.uid, 'cronogramas', cronogramaId), { dataInicio: novaData });
      showToast('📅 Cronograma adiado em 1 semana!');
    } catch (e) {
      showToast('❌ Erro ao adiar. Tente novamente.');
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
      setWeekOffset(getCurrentWeekOffset(maisRecente.dataInicio));
      setLoadingPage(false);
      setDominiosLocal(maisRecente.progresso?.dominios || {});
    });
  }, [user]);

  // Cálculos derivados
  const dynamicLogo = cronograma?.logoUrl || cronograma?.editalLogoUrl || null;

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
    const semKey = `w${weekOffset}`;
    const progressoW = cronograma?.progresso?.[semKey] || {};
    const progressoMinutosW = cronograma?.progressoMinutos?.[semKey] || {};
    agendaSemana.forEach(slot => {
      const chave = chaveAssuntoDominado(slot.disciplinaId, slot.assunto);
      const slotIdNoProgresso = slot.slotIdBase || slot.slotId;
      const tempoPlanejadoMinutos = Number(slot.tempoMinutos ?? slot.minutosEstudo ?? 0);
      const concluido = slot.isRevisaoAuto
        ? Boolean(slot.concluido || progressoW[slot.slotId] === true)
        : (progressoW[slotIdNoProgresso] === true || progressoW[slot.slotId] === true || slot.concluido === true);
      const progressoCru = Number(progressoMinutosW[slotIdNoProgresso] || slot.progressoMinutos || 0);
      const progressoMinutos = concluido ? Math.max(progressoCru, tempoPlanejadoMinutos) : progressoCru;
      mapa[slot.dia]?.push({
        ...slot,
        slotIdNoProgresso,
        tempoPlanejadoMinutos,
        progressoMinutos,
        dominado: !!(dominiosLocal[chave]),
        concluido,
      });
    });
    return mapa;
  }, [agendaSemana, dominiosLocal, cronograma, weekOffset]);

  const progressoGeral = useMemo(() => {
    const todos = Object.values(tarefasPorDia).flat();
    if (!todos.length) return 0;
    return Math.round((todos.filter(t => t.concluido).length / todos.length) * 100);
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

  let formattedStartDate = '...';
  if (cronograma?.dataInicio) {
    formattedStartDate = new Date(cronograma.dataInicio).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
  }
  let formattedEndDate = '...';
  const dataFinalCronograma = cronograma?.dataFim || cronograma?.dataFechamento || null;
  if (dataFinalCronograma) {
    formattedEndDate = new Date(dataFinalCronograma).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
  }

  // Handlers
  const handleToggle = async (tarefa) => {
    if (!cronograma || toggleLoadingId) return;
    const toggleId = tarefa.slotIdBase || tarefa.slotId;
    setToggleLoadingId(toggleId);
    const semanaDoSlot = Number.isFinite(Number(tarefa.weekOffset)) ? Number(tarefa.weekOffset) : weekOffset;
    const ok = await toggleSlotConcluido(cronograma.id, tarefa, semanaDoSlot);
    const completionRegistro = buildCompletionRegistro({
      context: 'cronograma',
      item: tarefa,
      cronograma,
      isReview: !!tarefa.isRevisaoAuto,
    });
    if (ok && !tarefa.concluido && addRegistroEstudo) {
      await addRegistroEstudo(completionRegistro);
    } else if (ok && tarefa.concluido && deleteCompletionRegistro) {
      await deleteCompletionRegistro(completionRegistro);
    }
    setToggleLoadingId(null);
    showToast(ok
      ? (tarefa.concluido ? 'Marcado como pendente' : 'Concluído com sucesso')
      : 'Erro ao salvar. Tente novamente.'
    );
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
    showToast(ok ? '🔄 Cronograma reorganizado com sucesso!' : '❌ Erro ao mover tarefa.');
  }, [cronograma, persistTemplateReorder, showToast]);

  const handleWeekPanStart = useCallback((event) => {
    if (event.button !== 0 || isWeekPanIgnoredTarget(event.target)) return;
    const node = weekScrollRef.current;
    if (!node) return;

    weekPanRef.current = {
      active: true,
      startX: event.clientX,
      scrollLeft: node.scrollLeft,
      pointerId: event.pointerId,
    };
    node.setPointerCapture?.(event.pointerId);
  }, []);

  const handleWeekPanMove = useCallback((event) => {
    const pan = weekPanRef.current;
    const node = weekScrollRef.current;
    if (!pan.active || !node) return;

    event.preventDefault();
    node.scrollLeft = pan.scrollLeft - (event.clientX - pan.startX);
  }, []);

  const handleWeekPanEnd = useCallback((event) => {
    const node = weekScrollRef.current;
    if (node && weekPanRef.current.pointerId !== null) {
      node.releasePointerCapture?.(weekPanRef.current.pointerId);
    }
    weekPanRef.current = { active: false, startX: 0, scrollLeft: 0, pointerId: null };
  }, []);

  const handleDominar = useCallback(async (tarefa) => {
    if (!cronograma) return;
    const chave = chaveAssuntoDominado(tarefa.disciplinaId, tarefa.assunto);
    const dominadoAtual = !!(dominiosLocal[chave]);
    setDominiosLocal(prev => ({ ...prev, [chave]: !dominadoAtual }));
    showToast(dominadoAtual ? '↩️ Domínio removido — revisões reativadas' : '⭐ Assunto dominado!');
    const resultado = await toggleAssuntoDominado(cronograma.id, tarefa.disciplinaId, tarefa.assunto, dominadoAtual);
    if (resultado === null) {
      setDominiosLocal(prev => ({ ...prev, [chave]: dominadoAtual }));
      showToast('❌ Erro ao salvar. Tente novamente.');
    }
  }, [cronograma, dominiosLocal, toggleAssuntoDominado, showToast]);

  const handleDominarDoModal = useCallback(async (disciplinaId, assunto, dominadoAtual) => {
    if (!cronograma) return;
    const chave = chaveAssuntoDominado(disciplinaId, assunto);
    setDominiosLocal(prev => ({ ...prev, [chave]: !dominadoAtual }));
    showToast(!dominadoAtual ? '⭐ Assunto dominado!' : '↩️ Domínio removido');
    const resultado = await toggleAssuntoDominado(cronograma.id, disciplinaId, assunto, dominadoAtual);
    if (resultado === null) {
      setDominiosLocal(prev => ({ ...prev, [chave]: dominadoAtual }));
      showToast('❌ Erro ao salvar. Tente novamente.');
    }
  }, [cronograma, dominiosLocal, toggleAssuntoDominado, showToast]);

  const handleToggleSettings = () => {
    setSettingsOpen(prev => {
      if (!prev) {
        const rect = settingsBtnRef.current?.getBoundingClientRect?.();
        if (rect) setSettingsPos({ top: rect.bottom + 6, right: window.innerWidth - rect.right });
      }
      return !prev;
    });
  };

  useEffect(() => {
    const handler = (e) => {
      if (settingsBtnRef.current && !settingsBtnRef.current.contains(e.target)) setSettingsOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Early returns
  if (loadingPage) return (
    <div className="flex justify-center items-center h-[calc(100vh-80px)]">
      <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-red-600"/>
    </div>
  );

  if (showWizard) return (
    <CronogramaCreateWizard
      user={user}
      onClose={() => setShowWizard(false)}
      onCronogramaCriado={() => setShowWizard(false)}
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
          showToast('✅ Cronograma atualizado!');
        }}
      />
    );
  }

  // ─── RENDER PRINCIPAL ──────────────────────────────────────────────────────
  return (
    <div className="relative flex flex-col bg-transparent">
      {/* Background simplificado e tático */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute bottom-0 left-0 h-[400px] w-[400px] translate-y-1/3 -translate-x-1/3 rounded-full bg-red-500/5 dark:bg-red-900/10 blur-[80px]" />
      </div>

      {/* ── MODAIS ── */}
      <AnimatePresence>
        {showConfirmDelete && (
          <ModalConfirm
            msg="Deseja encerrar esta operação? Todo o progresso será perdido."
            onConfirm={async () => {
              setLoadingAction(true);
              await excluirCronograma(cronograma.id, cronograma.cicloVinculadoId);
              setLoadingAction(false);
              setShowConfirmDelete(false);
            }}
            onCancel={() => setShowConfirmDelete(false)}
            loading={loadingAction}
          />
        )}

        {slotConsolidado && (
          <ModalRevisaoConsolidada
            slot={slotConsolidado}
            onClose={() => setSlotConsolidado(null)}
            onDominar={handleDominarDoModal}
            dominiosLocal={dominiosLocal}
          />
        )}

        {slotDetalhes && (
          <ModalDetalhesCronograma
            slot={slotDetalhes}
            cronograma={cronograma}
            onClose={() => setSlotDetalhes(null)}
            onStart={handleStart}
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
      </AnimatePresence>

      {/* ── HEADER (ESTILO CICLO DETALHE) ── */}
      <div className="shrink-0 px-4 sm:px-6 pt-4 pb-3 z-10">

        {/* Card principal do cronograma */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-zinc-50 dark:bg-zinc-900 px-6 py-4 rounded-2xl border border-zinc-300 dark:border-zinc-800 shadow-sm relative overflow-hidden mb-4">

          {/* Logo de fundo */}
          {dynamicLogo ? (
            <div className="absolute -bottom-4 -right-4 w-32 h-32 md:w-44 md:h-44 opacity-20 md:opacity-10 dark:opacity-30 dark:md:opacity-20 pointer-events-none transform rotate-[-10deg] z-0 filter saturate-150 transition-all duration-500">
              <img src={dynamicLogo} alt="Logo" className="w-full h-full object-contain" onError={e => { e.target.style.display = 'none'; }}/>
            </div>
          ) : (
            <div className="absolute -bottom-4 -right-4 w-32 h-32 md:w-44 md:h-44 opacity-5 dark:opacity-10 pointer-events-none flex items-center justify-center">
              <Shield size={120} className="text-zinc-400 dark:text-zinc-500"/>
            </div>
          )}

          {/* Lado esquerdo — info */}
          <div className="flex-1 z-10">
            <div className="flex flex-col gap-3">

              {/* Título + badges */}
              <div className="flex flex-wrap items-center gap-3">
                <h1 className="text-3xl font-black text-zinc-900 dark:text-white uppercase tracking-tight leading-none">{cronograma.nome}</h1>
                <div className="flex flex-wrap gap-2 items-center w-full sm:w-auto mt-1 sm:mt-0">

                  {/* Badge Ativo */}
                  {cronograma.ativo ? (
                      <span className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20 text-[10px] font-bold text-emerald-600 dark:text-emerald-500 uppercase tracking-widest">
                          <span className="flex h-2 w-2 relative">
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                          </span>
                          Operação Ativa
                      </span>
                  ) : (
                      <span className="px-2 py-0.5 rounded bg-zinc-200 dark:bg-zinc-800 text-[10px] font-bold text-zinc-500 uppercase">Arquivado</span>
                  )}

                  {/* Roda de Semanas Concluídas */}
                  <div className={`flex items-center gap-2 pl-1.5 pr-3 py-1 rounded-lg border transition-all ${
                      concluidosSemanas > 0
                      ? 'bg-amber-50 dark:bg-amber-900/10 border-amber-500/20 shadow-[0_0_10px_rgba(245,158,11,0.1)]'
                      : 'bg-zinc-100 dark:bg-zinc-800/50 border-zinc-200 dark:border-zinc-700'
                  }`}>
                      <div className="relative flex items-center justify-center w-8 h-8 shrink-0">
                          <motion.svg
                              animate={{ rotate: 360 }}
                              transition={{ repeat: Infinity, duration: 15, ease: 'linear' }}
                              className="absolute inset-0 w-full h-full"
                              viewBox="0 0 100 100"
                          >
                              <circle
                                  cx="50" cy="50" r="44"
                                  fill="none" stroke="currentColor" strokeWidth="6"
                                  strokeDasharray="16 12" strokeLinecap="round"
                                  className={concluidosSemanas > 0 ? 'text-amber-500/60' : 'text-zinc-300 dark:text-zinc-600'}
                              />
                          </motion.svg>
                          <div className={`absolute inset-0 flex items-center justify-center z-10 rounded-full ${
                              concluidosSemanas > 0 ? 'text-amber-600 dark:text-amber-500' : 'text-zinc-500'
                          }`}>
                              <span className="text-xl font-black leading-none mt-[1px]">{concluidosSemanas}</span>
                          </div>
                      </div>
                      <div className="flex flex-col justify-center ml-1">
                          <span className="text-[8px] font-bold uppercase tracking-widest text-zinc-500 dark:text-zinc-400 leading-none mb-0.5">Semanas</span>
                          <span className={`text-[10px] font-black uppercase tracking-wide leading-none ${
                              concluidosSemanas > 0 ? 'text-amber-600 dark:text-amber-500' : 'text-zinc-600 dark:text-zinc-400'
                          }`}>Concluídas</span>
                      </div>
                  </div>

                </div>
              </div>

              {/* Linha de info + acesso edital */}
              <div className="flex flex-col sm:flex-row gap-3 sm:gap-6 mt-1">
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-1.5 text-zinc-400">
                    <CalendarDays size={13}/>
                    <p className="text-[10px] font-bold uppercase tracking-wide">
                      Início: <span className="text-zinc-600 dark:text-zinc-300">{formattedStartDate}</span>
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 text-zinc-400">
                    <Target size={13}/>
                    <p className="text-[10px] font-bold uppercase tracking-wide">
                      Final: <span className="text-zinc-600 dark:text-zinc-300">{formattedEndDate}</span>
                    </p>
                  </div>
                </div>
                {onGoToEdital && (
                  <button onClick={onGoToEdital} className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white hover:bg-red-50 border border-zinc-200 hover:border-red-200 dark:bg-zinc-800 dark:hover:bg-red-900/10 dark:border-zinc-700 dark:hover:border-red-900/30 text-zinc-600 hover:text-red-700 dark:text-zinc-300 dark:hover:text-red-400 text-[11px] font-bold uppercase tracking-wide transition-all group w-fit shadow-sm z-20">
                    <BookOpen size={14} className="text-red-600 dark:text-red-500 group-hover:scale-110 transition-transform"/>
                    <span>Ir para o edital</span>
                    <ChevronRight size={12} className="opacity-60 group-hover:translate-x-1 transition-transform"/>
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Lado direito — progresso circular + stats */}
          <div className="flex items-center gap-6 z-10">
            <div className="text-center hidden sm:block">
              <p className="text-[10px] font-black text-zinc-500 dark:text-zinc-400 uppercase tracking-widest mb-1">Semana</p>
              <p className="text-2xl font-black text-zinc-900 dark:text-white">
                {weekOffset + 1}<span className="text-sm text-zinc-400 font-bold">/{totalSemanas}</span>
              </p>
            </div>
            <div className="w-px h-12 bg-zinc-200 dark:bg-zinc-800 hidden sm:block"/>
            <div className="relative">
              <svg className="w-20 h-20 -rotate-90" viewBox="0 0 80 80">
                <circle cx="40" cy="40" r="34" fill="none" stroke="currentColor" className="text-zinc-200 dark:text-zinc-800" strokeWidth="6"/>
                <motion.circle
                  cx="40" cy="40" r="34" fill="none" stroke="currentColor"
                  className={progressoGeral >= 100 ? 'text-emerald-500' : progressoGeral > 0 ? 'text-blue-600 dark:text-blue-500' : 'text-zinc-300 dark:text-zinc-700'}
                  strokeWidth="6" strokeLinecap="round"
                  strokeDasharray={2 * Math.PI * 34}
                  initial={{ strokeDashoffset: 2 * Math.PI * 34 }}
                  animate={{ strokeDashoffset: 2 * Math.PI * 34 * (1 - Math.min(progressoGeral, 100) / 100) }}
                  transition={{ duration: 1.5, ease: 'easeOut' }}
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className={`text-lg font-black ${progressoGeral >= 100 ? 'text-emerald-500' : progressoGeral > 0 ? 'text-blue-600 dark:text-blue-500' : 'text-zinc-400'}`}>
                  {progressoGeral}%
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* ── BARRA DE FERRAMENTAS ── */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mt-8 mb-4 px-2 gap-4">
          <div className="flex items-center gap-4">
            <h3 className="text-sm font-bold text-zinc-400 uppercase tracking-widest flex items-center gap-2">
              <LayoutList size={16} /> Painel Tático
            </h3>

            {/* View Toggles (Desktop) */}
            <div className="hidden sm:flex items-center gap-1 rounded-lg bg-zinc-200/50 p-1 dark:bg-zinc-800">
              <button
                onClick={() => setViewMode('list')}
                className={`flex items-center justify-center gap-1.5 rounded px-3 py-1.5 text-[10px] font-black uppercase tracking-widest transition-colors ${viewMode === 'list' ? 'bg-white text-zinc-900 shadow-sm dark:bg-zinc-700 dark:text-white' : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'}`}
              >
                <LayoutList size={12}/> Lista
              </button>
              <button
                onClick={() => setViewMode('week')}
                className={`flex items-center justify-center gap-1.5 rounded px-3 py-1.5 text-[10px] font-black uppercase tracking-widest transition-colors ${viewMode === 'week' ? 'bg-white text-zinc-900 shadow-sm dark:bg-zinc-700 dark:text-white' : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'}`}
              >
                <LayoutGrid size={12}/> Semanal
              </button>
              <button
                onClick={() => setViewMode('month')}
                className={`flex items-center justify-center gap-1.5 rounded px-3 py-1.5 text-[10px] font-black uppercase tracking-widest transition-colors ${viewMode === 'month' ? 'bg-white text-zinc-900 shadow-sm dark:bg-zinc-700 dark:text-white' : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'}`}
              >
                <Calendar size={12}/> Mensal
              </button>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
            <button
              onClick={() => { setLoadingAction(true); adiarCronograma(cronograma.id, cronograma).finally(() => setLoadingAction(false)); }}
              disabled={loadingAction}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white hover:bg-amber-50 border border-zinc-200 hover:border-amber-200 dark:bg-zinc-800 dark:hover:bg-amber-900/10 dark:border-zinc-700 dark:hover:border-amber-900/30 text-zinc-600 hover:text-amber-700 dark:text-zinc-300 dark:hover:text-amber-400 text-[10px] font-bold uppercase tracking-wide transition-all group shadow-sm"
            >
              <SkipForward size={14} className="text-amber-500 group-hover:scale-110 transition-transform"/>
              <span className="hidden sm:inline">Adiar Semana</span>
            </button>

            <button
              ref={settingsBtnRef}
              onClick={handleToggleSettings}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white hover:bg-red-50 border border-zinc-200 hover:border-red-200 dark:bg-zinc-800 dark:hover:bg-red-900/10 dark:border-zinc-700 dark:hover:border-red-900/30 text-zinc-600 hover:text-red-700 dark:text-zinc-300 dark:hover:text-red-400 text-[10px] font-bold uppercase tracking-wide transition-all group shadow-sm"
            >
              <Settings size={14} className="text-red-600 dark:text-red-500 group-hover:scale-110 transition-transform"/>
              <span className="hidden sm:inline">Ajustes</span>
            </button>

            <button
              onClick={() => setShowConfirmDelete(true)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white hover:bg-red-50 border border-zinc-200 hover:border-red-200 dark:bg-zinc-800 dark:hover:bg-red-900/10 dark:border-zinc-700 dark:hover:border-red-900/30 text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 text-[10px] font-bold uppercase tracking-wide transition-all group shadow-sm"
            >
              <Trash2 size={14} className="group-hover:scale-110 transition-transform"/>
              <span className="hidden sm:inline">Encerrar</span>
            </button>
          </div>
        </div>

        {/* View Toggles (Mobile) */}
        <div className="flex sm:hidden items-center gap-1 rounded-lg bg-zinc-200/50 p-1 dark:bg-zinc-800 mb-4 mx-2">
            <button
              onClick={() => setViewMode('list')}
              className={`flex-1 flex items-center justify-center gap-1.5 rounded px-3 py-1.5 text-[10px] font-black uppercase tracking-widest transition-colors ${viewMode === 'list' ? 'bg-white text-zinc-900 shadow-sm dark:bg-zinc-700 dark:text-white' : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'}`}
            >
              <LayoutList size={12}/> Lista
            </button>
            <button
              onClick={() => setViewMode('week')}
              className={`flex-1 flex items-center justify-center gap-1.5 rounded px-3 py-1.5 text-[10px] font-black uppercase tracking-widest transition-colors ${viewMode === 'week' ? 'bg-white text-zinc-900 shadow-sm dark:bg-zinc-700 dark:text-white' : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'}`}
            >
              <LayoutGrid size={12}/> Semanal
            </button>
            <button
              onClick={() => setViewMode('month')}
              className={`flex-1 flex items-center justify-center gap-1.5 rounded px-3 py-1.5 text-[10px] font-black uppercase tracking-widest transition-colors ${viewMode === 'month' ? 'bg-white text-zinc-900 shadow-sm dark:bg-zinc-700 dark:text-white' : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'}`}
            >
              <Calendar size={12}/> Mensal
            </button>
        </div>

        {/* Navegação de semana (só no modo semanal e lista) */}
        {(viewMode === 'week' || viewMode === 'list') && (
          <div className="flex items-center gap-3 mt-3 w-full sm:w-auto bg-zinc-50 dark:bg-zinc-900 px-3 py-2 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
            <button
              onClick={() => setWeekOffset(w => Math.max(0, w - 1))}
              disabled={weekOffset === 0}
              className="p-1.5 rounded text-zinc-500 hover:text-zinc-900 hover:bg-zinc-200 dark:text-zinc-400 dark:hover:text-white dark:hover:bg-zinc-800 disabled:opacity-30 transition-colors"
            >
              <ChevronLeft size={16}/>
            </button>
            <div className="flex flex-col flex-1 items-center justify-center text-center">
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

      {/* ── ÁREA PRINCIPAL ── */}
      <div className="flex-1 overflow-y-auto px-4 sm:px-6 pb-8 pt-1">
        {viewMode === 'week' ? (
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
              className="flex cursor-grab gap-4 overflow-x-auto overflow-y-hidden pb-5 pr-2 active:cursor-grabbing [scrollbar-width:thin] [scrollbar-color:rgb(220_38_38)_transparent]"
            >
              {weekDates.map((date) => {
                const diaReal = date.getDay();
                return (
                  <div key={date.getTime()} className="w-[292px] min-w-[292px] self-start sm:w-[320px] sm:min-w-[320px] xl:w-[340px] xl:min-w-[340px]">
                    <DayDropZone
                      diaSemanaIdx={diaReal}
                      date={date}
                      tarefas={tarefasPorDia[diaReal] || []}
                      isHoje={new Date().toDateString() === date.toDateString()}
                      onToggle={handleToggle}
                      onMarkPendencia={handleMarkPendencia}
                      onStart={handleStart}
                      onDominar={handleDominar}
                      onOpenConsolidada={slot => setSlotConsolidado(slot)}
                      onOpenDetails={setSlotDetalhes}
                      cronograma={cronograma}
                      toggleLoadingId={toggleLoadingId}
                    />
                  </div>
                );
              })}
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
        ) : viewMode === 'list' ? (
          <VisualizacaoLista
            cronograma={cronograma}
            weekDates={weekDates}
            tarefasPorDia={tarefasPorDia}
            onStart={handleStart}
            onOpenConsolidada={(slot) => setSlotConsolidado(slot)}
            onToggle={handleToggle}
            onMarkPendencia={handleMarkPendencia}
            onDominar={handleDominar}
            toggleLoadingId={toggleLoadingId}
          />
        ) : (
          <motion.div
            key="month"
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -10 }}
            className="flex-1 min-h-0"
          >
            <VisualizacaoMensal
              cronograma={cronograma}
              dataInicio={cronograma.dataInicio}
              onStart={handleStart}
            />
          </motion.div>
        )}
      </div>
    </div>
  );
};

export default CronogramaPage;
