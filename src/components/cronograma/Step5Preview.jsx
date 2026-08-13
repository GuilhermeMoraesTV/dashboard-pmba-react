/**
 * Step5Preview.jsx — REDESIGN CRIATIVO v7
 * Foco em Timeline de Elite, Calendário Holográfico e Destaque Imediato.
 *
 * CORREÇÕES:
 *   [FIX-A] SlotCard e cards de revisão: revisões agora exibem o nome da
 *           disciplina e o assunto corretamente.
 *           Problema anterior: slot.disc era undefined para revisões porque
 *           disciplinaId === '_revisao_agrupada' não existe no array disciplinas.
 *           Solução: usa slot.disciplinaNome como fallback quando disc não existe,
 *           e slot.assunto para o conteúdo — ambos campos sempre presentes no slot.
 *
 *   [FIX-B] Revisões individuais (não consolidadas): exibe "Disciplina · Assunto"
 *           usando disciplinaNome + assunto do slot de revisão.
 *
 *   [FIX-C] Modal de detalhes: revisões consolidadas listam os tópicos;
 *           revisões individuais mostram disciplina + assunto + intervalo.
 */

import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronLeft, ChevronRight, BookOpen, RefreshCw,
  Clock, Target, Calendar, Sparkles,
  CheckCircle2, Brain, AlertCircle, CalendarDays,
  X, List, GripVertical, Moon, Sun, Zap,
  Shield, Check, LayoutGrid, LayoutList, Flame,
  ArrowDownCircle, Flag, MapPin, Cpu, Bot, Loader2
} from 'lucide-react';

import { getAgendaSemana } from '../../hooks/useCronogramaSystem';
import {
  REVIEW_COLOR,
  buildDisciplineColorMap,
  getDisciplineCardVars,
  getDisciplineColorForSlot,
  getDisciplineKey,
} from '../../utils/disciplineColors';

// ─── HELPERS ──────────────────────────────────────────────────────────────────
const fmtMin = (min) => {
  if (!min || min <= 0) return '0m';
  if (min < 60) return `${min}m`;
  const h = Math.floor(min/60), m = min%60;
  return m > 0 ? `${h}h${String(m).padStart(2,'0')}` : `${h}h`;
};

const fmtDate = (value) => {
  if (!value) return '-';
  const date = typeof value === 'string' ? new Date(`${value}T12:00:00`) : new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
};

const addDias = (d, n) => { const r = new Date(d); r.setDate(r.getDate() + n); return r; };
const isoKey  = (d) => d.toISOString().split('T')[0];
const getHoje = () => { const d = new Date(); d.setHours(12,0,0,0); return d; };
const getCalendarDays = (year, month) => {
  const first = new Date(year, month, 1, 12, 0, 0, 0);
  const last  = new Date(year, month + 1, 0, 12, 0, 0, 0);
  const days = [];
  const prevLast = new Date(year, month, 0, 12, 0, 0, 0).getDate();
  for (let i = first.getDay() - 1; i >= 0; i--) {
    days.push({ day: prevLast - i, type: 'prev', date: new Date(year, month - 1, prevLast - i, 12, 0, 0, 0) });
  }
  for (let i = 1; i <= last.getDate(); i++) {
    days.push({ day: i, type: 'current', date: new Date(year, month, i, 12, 0, 0, 0) });
  }
  while (days.length < 42) {
    const day = days.length - first.getDay() - last.getDate() + 1;
    days.push({ day, type: 'next', date: new Date(year, month + 1, day, 12, 0, 0, 0) });
  }
  return days;
};

const DIAS_CURTO  = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];
const MESES_FULL  = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

// ─── [FIX-A] Helpers de exibição para revisões ────────────────────────────────

/**
 * Retorna o nome de exibição da disciplina para um slot.
 * Para revisões: usa disciplinaNome do slot (sempre preenchido pelo review.js).
 * Para estudo: usa disc.nome (disciplina encontrada no array).
 * Para revisões consolidadas: usa "Revisão Consolidada".
 */
function getNomeDisc(item) {
  if (item.isConsolidada) return item.titulo || 'Revisões';
  if (item.isRevisao || item.isRevisaoAuto) {
    return item.disciplinaNome || item.disc?.nome || 'Revisão';
  }
  return item.disc?.nome || item.disciplinaNome || 'Disciplina';
}

/**
 * Retorna o texto do assunto para um slot.
 * Para revisões individuais: mostra o assunto original que está sendo revisado.
 * Para revisões consolidadas: mostra a lista compacta de tópicos.
 * Para estudo: mostra o assunto ou a disciplina quando os assuntos estao ocultos.
 */
function getTextoAssunto(item, config) {
  if (item.isConsolidada) {
    const topicos = item.topicosRevisao || [];
    if (topicos.length === 0) return 'Revisões espaçadas do dia';
    return `${topicos.length} revisão${topicos.length === 1 ? '' : 'ões'} agrupada${topicos.length === 1 ? '' : 's'}`;
  }
  if (item.isRevisao || item.isRevisaoAuto) {
    // [FIX-B] Revisões individuais: mostra o assunto que está sendo revisado
    return item.assunto || item.assuntoOriginal || 'Revisão espaçada';
  }
  // Estudo normal
  return config?.modoExibirAssuntos !== false
    ? (item.assunto || 'Tópico inicial')
    : (item.disciplinaNome || item.disciplina || 'Disciplina');
}

/**
 * Retorna o label do tipo de slot para o modal.
 */
function getLabelTipo(item) {
  if (item.isConsolidada)                    return 'Revisões';
  if (item.isRevisao || item.isRevisaoAuto)  return `Revisão Espaçada · +${item.intervaloDias ?? '?'}d`;
  return 'Missão de Teoria';
}

const isReviewSlot = (item) => Boolean(item?.isRevisao || item?.isRevisaoAuto || item?.isConsolidada);
const getStudyItems = (items = []) => items.filter((item) => !isReviewSlot(item));
const getItemMinutes = (item) => Number(item?.tempoMinutos ?? item?.minutosEstudo ?? item?.tempoPlanejadoMinutos ?? 0) || 0;
const getDayMinutesTotal = (items = []) => items.reduce((acc, item) => acc + getItemMinutes(item), 0);
const normalizarModoTempo = (modo) => (modo === 'oculto' || modo === 'nenhum' ? 'total' : (modo || 'detalhado'));

const topicosFromReviewSlot = (item) => {
  const dadosSlot = {
    slotId: item.slotId,
    slotIdBase: item.slotIdBase,
    dataSlot: item.dataSlot,
    intervaloDias: item.intervaloDias ?? '?',
    tempoMinutos: item.tempoMinutos ?? item.minutosEstudo ?? 0,
    isRevisaoAuto: true,
  };

  if (Array.isArray(item.topicosRevisao) && item.topicosRevisao.length > 0) {
    return item.topicosRevisao.map((topico) => ({ ...topico, ...dadosSlot }));
  }

  return [{
    ...dadosSlot,
    disciplinaId: item.disciplinaId,
    disciplinaNome: item.disciplinaNome || getNomeDisc(item) || 'Revisão',
    assunto: item.assunto || item.assuntoOriginal || 'Revisão agendada',
  }];
};

const agruparRevisoesDoDia = (items = [], dayKey = '') => {
  const revisoes = items.filter(isReviewSlot);
  if (revisoes.length <= 1) return items;

  const teorias = items.filter((item) => !isReviewSlot(item));
  const primeiraRevisaoIndex = items.findIndex(isReviewSlot);
  const topicosRevisao = revisoes.flatMap(topicosFromReviewSlot);
  const blocoRevisoes = {
    ...revisoes[0],
    idUnique: `revisoes-${dayKey}`,
    slotId: `revisoes-${dayKey}`,
    titulo: 'Revisões',
    disciplinaNome: 'Revisões',
    assunto: `${topicosRevisao.length} revisões agrupadas`,
    isConsolidada: true,
    isRevisao: true,
    isRevisaoAuto: true,
    topicosRevisao,
    tempoMinutos: revisoes.reduce((acc, item) => acc + Number(item.tempoMinutos ?? item.minutosEstudo ?? 0), 0),
  };

  const resultado = [...teorias];
  resultado.splice(Math.max(0, primeiraRevisaoIndex), 0, blocoRevisoes);
  return resultado;
};

// ─── COMPONENTES ──────────────────────────────────────────────────────────────

const SlotCard = ({ item, onDragStart, onClick, compact = false, config = {}, colorMap = null, isToday = false }) => {
  const isRev = item.isRevisao || item.isRevisaoAuto || item.isConsolidada;
  const modoTempo = normalizarModoTempo(config.modoExibirTempo);
  const mostrarTempoBloco = modoTempo === 'detalhado';
  const isDone = Boolean(item.concluido);
  const disciplinaColor = getDisciplineColorForSlot(item, colorMap);
  const cardStyle = getDisciplineCardVars(isRev ? REVIEW_COLOR : disciplinaColor);
  const tempoPlanejadoMinutos = Number(item.tempoPlanejadoMinutos ?? item.tempoMinutos ?? item.minutosEstudo ?? 0);
  const progressoAtualMinutos = Number(item.progressoMinutos || 0);
  const progressoLimitado = Math.min(progressoAtualMinutos, tempoPlanejadoMinutos || progressoAtualMinutos);
  const progressoPercentual = tempoPlanejadoMinutos > 0
    ? Math.min(100, Math.round((progressoLimitado / tempoPlanejadoMinutos) * 100))
    : (isDone ? 100 : 0);
  const emAndamento = !isDone && progressoLimitado > 0 && progressoPercentual < 100;

  // [FIX-A] Usa helpers para nome e assunto — funciona para teoria E revisão
  const nomeDisc   = getNomeDisc(item);
  const assuntoTxt = getTextoAssunto(item, config);

  if (compact) {
    return (
      <div
        onClick={(e) => { e.stopPropagation(); onClick(item); }}
        style={cardStyle}
        className={`discipline-tinted-card ${isDone ? 'discipline-completed-card' : ''} relative px-1.5 py-0.5 rounded-md text-[7px] font-black uppercase truncate border shadow-sm transition-transform active:scale-95 ${isRev ? 'text-blue-700 dark:text-blue-300' : disciplinaColor.text}`}
      >
        {nomeDisc}
      </div>
    );
  }

  return (
    <motion.div
      draggable={!item.isConsolidada}
      onDragStart={(e) => {
        if (item.isConsolidada) {
          e.preventDefault();
          return;
        }
        onDragStart?.(e, item);
      }}
      onClick={() => onClick(item)}
      whileHover={{ y: -1, scale: 1.01 }}
      style={cardStyle}
      className={`discipline-tinted-card ${isDone ? 'discipline-completed-card' : ''} group relative min-h-[104px] ${item.isConsolidada ? 'cursor-pointer' : 'cursor-grab active:cursor-grabbing'} select-none overflow-hidden rounded-2xl border transition-all duration-200 shadow-sm ${isToday ? (isRev ? 'ring-1 ring-blue-500/45' : 'ring-1 ring-red-500/45') : ''}`}
    >
      <div className="flex h-full flex-col gap-2 px-3.5 py-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <div className={`w-2.5 h-2.5 rounded-full shrink-0 shadow-sm ${isRev ? 'bg-blue-500' : disciplinaColor.bg || 'bg-zinc-400'}`} />
            {/* [FIX-A] Nome da disciplina — funciona para revisões individuais e consolidadas */}
            <h4 className={`text-[12px] font-black uppercase tracking-wide truncate ${isDone ? `${isRev ? 'text-blue-700' : disciplinaColor.text} line-through opacity-75` : isRev ? 'text-blue-700 dark:text-blue-300' : disciplinaColor.text}`}>
              {nomeDisc}
            </h4>
            {isRev && (
              <span className="shrink-0 rounded-md bg-blue-600 px-1.5 py-0.5 text-[7px] font-black uppercase tracking-wider text-white">
                Revisão
              </span>
            )}
            {isDone && <CheckCircle2 size={11} className="shrink-0 text-emerald-500" strokeWidth={3} />}
          </div>
          {/* [FIX-B] Assunto — para revisões exibe o assunto revisado */}
          <p className={`line-clamp-2 text-[11px] font-semibold leading-snug ${isToday ? 'text-zinc-700 dark:text-red-50/90' : 'text-zinc-600 dark:text-zinc-300'}`}>
            {assuntoTxt}
          </p>
        </div>
        {mostrarTempoBloco && (
          <span className={`pt-0.5 text-[10px] font-black tabular-nums ${isToday ? 'text-red-950 dark:text-white' : 'text-zinc-900 dark:text-white'}`}>
            {fmtMin(tempoPlanejadoMinutos)}
          </span>
        )}
      </div>
      {mostrarTempoBloco && tempoPlanejadoMinutos > 0 && (
        <div className="mt-auto">
          <div className={`mb-1.5 flex items-center justify-between gap-2 text-[10px] font-black ${isToday ? 'text-red-900 dark:text-red-50/90' : 'text-zinc-600 dark:text-zinc-300'}`}>
            <span className="tabular-nums">
              {fmtMin(isDone ? tempoPlanejadoMinutos : progressoLimitado)} / {fmtMin(tempoPlanejadoMinutos)}
            </span>
            <span className="font-black tabular-nums">
              {isDone ? 100 : progressoPercentual}%
            </span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-white/65 dark:bg-black/25">
            <motion.div
              initial={false}
              animate={{ width: `${isDone ? 100 : progressoPercentual}%` }}
              transition={{ duration: 0.25 }}
              className={`h-full rounded-full ${isRev ? REVIEW_COLOR.progress : isDone ? disciplinaColor.progress : emAndamento ? 'bg-orange-500' : disciplinaColor.progress}`}
            />
          </div>
        </div>
      )}
      </div>
    </motion.div>
  );
};

const Step5_Preview = ({
  disciplinas,
  selecao,
  horarios,
  config,
  edital,
  loadingIA         = false,
  statusIA          = null,
  percent           = 0,
  resultado         = null,
  erroGeracao       = null,
  setErroGeracao    = () => {},
  handleGerarPrevia = () => {},
}) => {
  const [viewMode,     setViewMode]     = useState('semana');
  const [semanaOffset, setSemanaOffset] = useState(0);
  const [mesCursor,    setMesCursor]    = useState(() => {
    const d = getHoje();
    d.setDate(1);
    return d;
  });
  const [modalSlot,    setModalSlot]    = useState(null);
  const [agendaOverride, setAgendaOverride] = useState(null);
  const modoTempo = normalizarModoTempo(config?.modoExibirTempo);
  const mostrarTempoTotal = modoTempo !== 'nenhum';
  const mostrarTempoBloco = modoTempo === 'detalhado';

  const scrollRef = useRef(null);
  const isDraggingScroll = useRef(false);
  const startX = useRef(0);
  const scrollLeft = useRef(0);

  // ── Mouse Grab Scroll ──────────────────────────────────────────────────────
  const handleMouseDown = (e) => {
    if (e.target.closest('[draggable]')) return;
    isDraggingScroll.current = true;
    startX.current = e.pageX - scrollRef.current.offsetLeft;
    scrollLeft.current = scrollRef.current.scrollLeft;
    scrollRef.current.style.cursor = 'grabbing';
  };
  const handleMouseLeave = () => { isDraggingScroll.current = false; scrollRef.current.style.cursor = 'grab'; };
  const handleMouseUp = () => { isDraggingScroll.current = false; scrollRef.current.style.cursor = 'grab'; };
  const handleMouseMove = (e) => {
    if (!isDraggingScroll.current) return;
    e.preventDefault();
    const x = e.pageX - scrollRef.current.offsetLeft;
    const walk = (x - startX.current) * 1.5;
    scrollRef.current.scrollLeft = scrollLeft.current - walk;
  };

  // ── Lógica de Agenda ───────────────────────────────────────────────────────
  const colorMap = useMemo(() => {
    const disciplinasPorChave = new Map();
    (disciplinas || []).forEach((disciplina) => {
      [disciplina?.id, disciplina?.nome, disciplina?.disciplinaNome]
        .filter(Boolean)
        .map(getDisciplineKey)
        .forEach((key) => disciplinasPorChave.set(key, disciplina));
    });

    const vistas = new Set();
    const disciplinasPresentes = [];
    (resultado?.semanaTemplate || [])
      .filter((slot) => !slot?.isRevisao && !slot?.isRevisaoAuto && !slot?.isConsolidada)
      .forEach((slot) => {
        const referencias = [slot?.disciplinaId, slot?.disciplinaNome, slot?.disciplina].filter(Boolean);
        const key = getDisciplineKey(referencias[0]);
        if (vistas.has(key)) return;
        vistas.add(key);

        const disciplinaCadastrada = referencias
          .map(getDisciplineKey)
          .map((ref) => disciplinasPorChave.get(ref))
          .find(Boolean);
        disciplinasPresentes.push(disciplinaCadastrada || {
          id: slot?.disciplinaId || slot?.disciplinaNome || slot?.disciplina,
          nome: slot?.disciplinaNome || slot?.disciplina || slot?.disciplinaId,
        });
      });

    return buildDisciplineColorMap(disciplinasPresentes, {
      preserveStored: false,
      excludeReviewBlue: true,
    });
  }, [disciplinas, resultado?.semanaTemplate]);

  // CORREÇÃO: startDate é o primeiro dia com horas > 0 a partir de hoje.
  const startDate = useMemo(() => {
    const hoje = getHoje();
    const diaSemanaHoje = hoje.getDay();
    for (let offset = 0; offset < 7; offset++) {
      const diaIdx = (diaSemanaHoje + offset) % 7;
      const horas = Number(horarios?.[diaIdx] || horarios?.[String(diaIdx)] || 0);
      if (horas > 0) {
        const d = new Date(hoje);
        d.setDate(d.getDate() + offset);
        return d;
      }
    }
    return hoje;
  }, [horarios]);

  useEffect(() => {
    const d = new Date(startDate);
    d.setDate(1);
    d.setHours(12, 0, 0, 0);
    setMesCursor(d);
  }, [startDate]);

  const monthDays = useMemo(
    () => getCalendarDays(mesCursor.getFullYear(), mesCursor.getMonth()),
    [mesCursor],
  );

  const agendaBase = useMemo(() => {
    if (!resultado?.semanaTemplate?.length) return {};
    const map = {};

    const cronogramaMock = {
      semanaTemplate: resultado.semanaTemplate,
      disciplinasSnapshot: disciplinas || [],
      progresso: {},
      historicoRevisoes: {},
      dataInicio: isoKey(startDate),
      tempoRevisaoMinutos: config?.tempoRevisaoMinutos ?? 20,
      modoExibirAssuntos: config?.modoExibirAssuntos !== false,
      limitarMaterias: config?.limitarMaterias || false,
      limitesPorDia: config?.limitesPorDia || {},
    };

    const processSemana = (currentOffset) => {
      const agendaSemana = getAgendaSemana(cronogramaMock, currentOffset, null, null, horarios);

      agendaSemana.forEach((slot, idx) => {
        const key = slot.dataSlot ?? isoKey(addDias(startDate, currentOffset * 7 + slot.dia));
        const horasNoDia = Number(horarios?.[slot.dia] || horarios?.[String(slot.dia)] || 0);

        if (horasNoDia <= 0) {
          if (!map[key]) map[key] = [];
          return;
        }

        if (!map[key]) map[key] = [];

        // [FIX-A] Para revisões: disc pode ser null (disciplinaId fictício).
        // getNomeDisc() e getTextoAssunto() usam disciplinaNome do slot como fallback.
        const disc = (disciplinas || []).find(d => d.id === slot.disciplinaId) || null;

        if (!map[key].some(item => item.slotId === slot.slotId && item.dia === slot.dia)) {
          map[key].push({
            ...slot,
            idUnique:     `${key}-${currentOffset}-${idx}`,
            disc,
            cor:          getDisciplineColorForSlot(slot, colorMap),
            isRevisao:    slot.isRevisao || slot.isRevisaoAuto || false,
            tempoMinutos: slot.tempoMinutos ?? slot.minutosEstudo ?? 0
          });
        }
      });
    };

    if (viewMode === 'mes') {
      const firstDate = monthDays[0]?.date;
      const lastDate = monthDays[monthDays.length - 1]?.date;
      if (!firstDate || !lastDate) return map;

      const dayMs = 24 * 60 * 60 * 1000;
      const startRef = new Date(startDate);
      startRef.setHours(12, 0, 0, 0);
      const firstDiff = Math.floor((firstDate - startRef) / dayMs);
      const lastDiff = Math.floor((lastDate - startRef) / dayMs);
      const weekStart = Math.floor(firstDiff / 7);
      const weekEnd = Math.floor(lastDiff / 7);

      for (let currentOffset = weekStart; currentOffset <= weekEnd; currentOffset++) {
        processSemana(currentOffset);
      }
      return map;
    }

    const numSemanas = viewMode === 'semana' ? 1 : 4;
    for (let i = 0; i < numSemanas; i++) {
      processSemana(semanaOffset + i);
    }
    return map;
  }, [resultado, semanaOffset, colorMap, disciplinas, startDate, horarios, config, viewMode, monthDays]);

  const displayAgenda = useMemo(() => {
    const source = agendaOverride || agendaBase;
    return Object.fromEntries(
      Object.entries(source).map(([key, items]) => [key, agruparRevisoesDoDia(items, key)])
    );
  }, [agendaOverride, agendaBase]);

  // Preview budget guard
  useEffect(() => {
    if (!import.meta.env?.DEV || !displayAgenda) return;

    Object.entries(displayAgenda).forEach(([key, items]) => {
      if (!items?.length) return;
      const data = new Date(`${key}T12:00:00`);
      const diaSemana = data.getDay();
      const minutosConfigurados = Math.round(Number(horarios?.[diaSemana] ?? horarios?.[String(diaSemana)] ?? 0) * 60);
      if (minutosConfigurados <= 0) return;

      const totalRenderizado = getDayMinutesTotal(items);
      if (totalRenderizado > minutosConfigurados + 5) {
        console.warn('[Step5Preview] Total diario acima do configurado no preview.', {
          data: key,
          totalRenderizado,
          minutosConfigurados,
          itens: items.map((item) => ({
            slotId: item.slotId,
            tipo: isReviewSlot(item) ? 'revisao' : 'estudo',
            minutos: getItemMinutes(item),
          })),
        });
      }
    });
  }, [displayAgenda, horarios]);

  // ── Drag and Drop ──────────────────────────────────────────────────────────
  const onDragStart = (e, item) => { e.dataTransfer.setData('text/plain', JSON.stringify(item)); };
  const onDrop = (e, targetDayKey) => {
    e.preventDefault();
    const itemStr = e.dataTransfer.getData('text/plain');
    if (!itemStr) return;
    const item = JSON.parse(itemStr);
    const sourceDayKey = Object.keys(displayAgenda).find(key => displayAgenda[key].some(i => i.idUnique === item.idUnique));
    if (!sourceDayKey || sourceDayKey === targetDayKey) return;
    const newAgenda = { ...displayAgenda };
    newAgenda[sourceDayKey] = newAgenda[sourceDayKey].filter(i => i.idUnique !== item.idUnique);
    newAgenda[targetDayKey] = [...(newAgenda[targetDayKey] || []), { ...item, idUnique: `${targetDayKey}-${Date.now()}` }];
    setAgendaOverride(newAgenda);
  };

  if (loadingIA) return <AILoadingState statusMsg={statusIA} percent={percent} />;

  const totalHorasSemanais = Object.values(horarios || {}).reduce((a, h) => a + (Number(h) || 0), 0);
  const totalSemanas = resultado?.meta?.totalSemanas ?? resultado?.totalSemanasNecessarias ?? 12;
  const dataFinalCronograma = resultado?.dataFim || resultado?.dataFechamento || resultado?.meta?.dataFechamento || null;

  return (
    <div className="flex flex-col gap-4 pb-20 w-full max-w-full sm:gap-6">

      {/* ── HEADER PADRONIZADO ── */}
      <motion.div
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center mb-2 w-full mx-auto px-2 sm:mb-4 sm:px-4"
      >
        <h2 className="text-4xl sm:text-4xl font-black text-zinc-900 dark:text-white uppercase tracking-tighter leading-[0.95] mb-2 sm:mb-3">
          Tudo pronto para<br />
          <span className="text-red-600">Começar?</span>
        </h2>
        <p className="text-base text-zinc-500 dark:text-zinc-400 font-semibold leading-relaxed max-w-md mx-auto sm:text-sm">
          Revise seu plano estratégico final e faça ajustes finos se necessário antes de confirmar.
        </p>
      </motion.div>

      {/* ── HEADER TOOLBAR ── */}
      <div className="mx-auto grid w-full max-w-3xl grid-cols-3 gap-1.5 px-1 sm:gap-2.5">
        <div className="min-w-0 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800/55 px-2 py-2.5 sm:px-3">
          <p className="mb-0.5 text-[9px] font-black uppercase tracking-[0.18em] text-zinc-400 dark:text-zinc-500">Início</p>
          <p className="truncate text-[10px] font-black text-zinc-900 dark:text-white sm:text-[13px]">{fmtDate(resultado?.dataInicio || isoKey(startDate))}</p>
        </div>
        <div className="min-w-0 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800/55 px-2 py-2.5 sm:px-3">
          <p className="mb-0.5 text-[9px] font-black uppercase tracking-[0.18em] text-zinc-400 dark:text-zinc-500">Data Final</p>
          <p className="truncate text-[10px] font-black text-zinc-900 dark:text-white sm:text-[13px]">{fmtDate(dataFinalCronograma)}</p>
        </div>
        <div className="min-w-0 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800/55 px-2 py-2.5 sm:px-3">
          <p className="mb-0.5 text-[9px] font-black uppercase tracking-[0.18em] text-zinc-400 dark:text-zinc-500">Duração</p>
          <p className="truncate text-[10px] font-black text-zinc-900 dark:text-white sm:text-[13px]">{totalSemanas} sem. · {totalHorasSemanais}h/sem</p>
        </div>
      </div>

      <div className="grid gap-2 px-1 lg:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] lg:items-center lg:gap-4">
        <div className="flex items-center justify-center gap-3 lg:justify-start">
          <div className="w-1.5 h-6 rounded-full bg-red-600 shadow-[0_0_10px_rgba(220,38,38,0.3)]" />
          <h2 className="text-2xl font-black uppercase tracking-tight text-zinc-900 dark:text-white leading-none sm:text-lg sm:tracking-widest">Visão do Plano</h2>
        </div>

        <div className="flex justify-center">
          <div className="inline-flex w-fit items-center gap-2 rounded-2xl border border-zinc-100 bg-white px-2 py-1.5 shadow-sm dark:border-zinc-700 dark:bg-zinc-800/55">
            <button
              onClick={() => {
                if (viewMode === 'mes') {
                  setMesCursor((p) => new Date(p.getFullYear(), p.getMonth() - 1, 1, 12, 0, 0, 0));
                } else {
                  setSemanaOffset(p => Math.max(0, p - 1));
                }
              }}
              className="p-2 rounded-xl bg-zinc-50 dark:bg-zinc-800 hover:text-red-600 transition-all active:scale-90 border border-zinc-200 dark:border-zinc-700"
            >
              <ChevronLeft size={18} />
            </button>
            <div className="flex min-w-[126px] flex-col items-center sm:min-w-[150px]">
              <span className="mb-1 text-[8px] font-black uppercase tracking-[0.24em] text-zinc-400">Período</span>
              <h3 className="text-xs font-black uppercase tracking-widest text-zinc-900 dark:text-white">
                {viewMode === 'mes'
                  ? `${MESES_FULL[mesCursor.getMonth()]} ${mesCursor.getFullYear()}`
                  : `Semana ${semanaOffset + 1}`}
              </h3>
            </div>
            <button
              onClick={() => {
                if (viewMode === 'mes') {
                  setMesCursor((p) => new Date(p.getFullYear(), p.getMonth() + 1, 1, 12, 0, 0, 0));
                } else {
                  setSemanaOffset(p => p + 1);
                }
              }}
              className="p-2 rounded-xl bg-zinc-50 dark:bg-zinc-800 hover:text-red-600 transition-all active:scale-90 border border-zinc-200 dark:border-zinc-700"
            >
              <ChevronRight size={18} />
            </button>
          </div>
        </div>

        <div className="flex flex-col items-center gap-1.5 lg:items-end">
          <span className="text-[8px] font-black uppercase tracking-[0.22em] text-zinc-400 dark:text-zinc-500">
            Modos de visualização
          </span>
          <div className="flex items-center justify-center gap-1 rounded-2xl bg-zinc-100 p-1 dark:bg-zinc-800">
            {[
              { id: 'semana', icon: CalendarDays, label: 'Semana' },
              { id: 'mes',    icon: LayoutGrid,   label: 'Mês' },
              { id: 'lista',  icon: LayoutList,   label: 'Lista' },
            ].map(v => (
              <button key={v.id} onClick={() => setViewMode(v.id)} className={`flex items-center gap-2 px-3 py-2 rounded-xl transition-all duration-300 sm:px-4 ${viewMode === v.id ? 'bg-white dark:bg-zinc-700 text-red-600 shadow-md scale-[1.02]' : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'}`}>
                <v.icon size={16} />
                <span className="text-[10px] font-black uppercase tracking-widest hidden md:inline">{v.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {agendaOverride && (
        <div className="flex justify-center lg:justify-end">
          <button onClick={() => setAgendaOverride(null)} className="flex items-center gap-2 px-4 py-2 rounded-xl text-amber-600 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 text-[10px] font-black uppercase animate-pulse">
            <RefreshCw size={14} /> Resetar Alterações
          </button>
        </div>
      )}

      {/* ── CONTEÚDO DINÂMICO ── */}
      <div className="w-full">
        <AnimatePresence mode="wait">
          {viewMode === 'semana' && (
            <motion.div
              key="semana" initial={{ opacity:0, x: 20 }} animate={{ opacity:1, x:0 }} exit={{ opacity:0, x:-20 }}
              ref={scrollRef}
              onMouseDown={handleMouseDown} onMouseLeave={handleMouseLeave} onMouseUp={handleMouseUp} onMouseMove={handleMouseMove}
              className="flex gap-2 sm:gap-4 overflow-x-auto custom-scrollbar pb-5 cursor-grab active:cursor-grabbing px-1 select-none sm:pb-6"
              style={{ scrollBehavior: isDraggingScroll.current ? 'auto' : 'smooth', WebkitOverflowScrolling: 'touch', touchAction: 'pan-x pan-y' }}
            >
              {[0, 1, 2, 3, 4, 5, 6].map((diaOffset) => {
                const data = addDias(startDate, (semanaOffset * 7) + diaOffset);
                const diaNome = DIAS_CURTO[data.getDay()];
                const key  = isoKey(data);
                const items = displayAgenda[key] || [];
                const hoje = isoKey(new Date()) === key;
                const totalDia = getDayMinutesTotal(items);
                const totalBlocos = items.length;

                return (
                  <div key={diaOffset} onDragOver={(e) => e.preventDefault()} onDrop={(e) => onDrop(e, key)}
                    className={`relative flex min-h-[280px] min-w-[168px] max-w-[168px] flex-col rounded-[16px] border p-1.5 transition-all duration-300 sm:min-h-[440px] sm:min-w-[260px] sm:max-w-[260px] sm:rounded-[18px] sm:p-2 xl:min-w-[284px] xl:max-w-[284px] ${hoje ? 'border-red-500/60 bg-white/70 shadow-md ring-1 ring-red-500/30 dark:bg-card-dark' : 'border-zinc-200 bg-zinc-50/70 shadow-sm hover:border-zinc-300 dark:border-zinc-800 dark:bg-card-dark dark:hover:border-zinc-700'}`}
                  >
                    <div className={`mb-1.5 shrink-0 rounded-[14px] border px-2.5 py-2 shadow-sm transition-all duration-300 sm:mb-3 sm:rounded-[20px] sm:px-4 sm:py-3 ${hoje ? 'border-red-500/60 bg-zinc-950 text-white dark:border-red-500/40 dark:bg-zinc-900' : 'border-zinc-800 bg-zinc-900 text-white dark:border-zinc-800 dark:bg-zinc-900'}`}>
                      {hoje && (
                        <>
                        </>
                      )}
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <p className={`hidden text-[10px] font-black uppercase tracking-widest sm:block ${hoje ? 'text-red-200 dark:text-red-600' : 'text-zinc-400 dark:text-zinc-500'}`}>
                            {MESES_FULL[data.getMonth()]}
                          </p>
                          <h3 className="mt-0.5 truncate text-[14px] font-black uppercase leading-none tracking-tight text-white sm:text-lg">
                            <span className="sm:hidden">{diaNome}</span>
                            <span className="hidden sm:inline">{data.toLocaleDateString('pt-BR', { weekday: 'long' })}</span>
                          </h3>
                          <div className={`mt-1 text-[9px] font-bold uppercase tracking-widest sm:text-[11px] ${hoje ? 'text-red-100 dark:text-red-600' : 'text-zinc-300 dark:text-zinc-500'}`}>
                            {data.getDate()} {data.toLocaleDateString('pt-BR', { month: 'short' })}
                          </div>
                        </div>
                        <div className="flex shrink-0 flex-col items-end gap-1.5">
                          {mostrarTempoTotal && (
                            <div className="rounded-lg border border-white/10 bg-white/10 px-1.5 py-1.5 text-white sm:px-2">
                              <div className="flex items-center gap-1 sm:gap-1.5">
                                <Clock size={11} className={hoje ? 'text-white' : 'text-zinc-300'} />
                                <div className="flex flex-col items-end leading-none">
                                  <span className={`hidden text-[8px] font-black uppercase tracking-widest sm:block ${hoje ? 'text-red-100' : 'text-zinc-300'}`}>Tempo</span>
                                  <span className="mt-0.5 whitespace-nowrap text-[10px] font-black tabular-nums text-white sm:text-[11px]">{fmtMin(totalDia)}</span>
                                </div>
                              </div>
                            </div>
                          )}
                          {hoje ? (
                            <span className="rounded bg-white px-1.5 py-0.5 text-[8px] font-black uppercase tracking-wide text-red-600 shadow-sm sm:px-2 sm:text-[9px] sm:tracking-widest">
                              Hoje
                            </span>
                          ) : totalBlocos > 0 ? (
                            <div className="rounded bg-white/10 px-1.5 py-0.5 text-[8px] font-black text-white sm:px-2 sm:text-[10px]">
                              {totalBlocos} blocos
                            </div>
                          ) : null}
                        </div>
                      </div>
                      <div className="hidden">
                      <div className="flex flex-col">
                        <span className={`text-[10px] font-black uppercase tracking-[0.24em] ${hoje ? 'text-red-600 dark:text-red-300' : 'text-zinc-500 dark:text-zinc-400'}`}>{diaNome}</span>
                        <div className="mt-1 flex items-end gap-2">
                          <span className={`text-2xl font-black leading-none ${hoje ? 'text-red-700 dark:text-red-200' : 'text-zinc-800 dark:text-zinc-100'}`}>{data.getDate()}</span>
                          <span className={`pb-0.5 text-[11px] font-bold uppercase tracking-[0.18em] ${hoje ? 'text-red-500 dark:text-red-400' : 'text-zinc-400 dark:text-zinc-500'}`}>Dia</span>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        <div className={`rounded-2xl border px-3 py-2 shadow-sm ${hoje ? 'bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-900/60' : 'bg-zinc-50 dark:bg-zinc-800/55 border-zinc-200 dark:border-zinc-700'}`}>
                          <div className="flex items-center gap-2">
                            <Clock size={12} className={hoje ? 'text-red-500 dark:text-red-400' : 'text-zinc-400 dark:text-zinc-500'} />
                            <div className="flex flex-col items-end leading-none">
                              <span className={`text-[8px] font-black uppercase tracking-[0.18em] ${hoje ? 'text-red-500/90 dark:text-red-300/90' : 'text-zinc-400 dark:text-zinc-500'}`}>Tempo Total</span>
                              <span className={`mt-1 text-[12px] font-black tabular-nums ${hoje ? 'text-red-700 dark:text-red-100' : 'text-zinc-800 dark:text-zinc-100'}`}>{fmtMin(totalDia)}</span>
                            </div>
                          </div>
                        </div>
                        {hoje && <div className="mt-2 px-2 py-0.5 rounded-full bg-red-600 text-white text-[7px] font-black uppercase tracking-widest">Início Hoje</div>}
                      </div>
                      </div>
                    </div>
                    <div className="flex flex-col gap-2 sm:gap-3">
                      {items.length > 0 ? items.map((item) => (
                        <SlotCard key={item.idUnique} item={item} onDragStart={onDragStart} onClick={setModalSlot} config={config} colorMap={colorMap} isToday={hoje} />
                      )) : (
                        <div className="flex flex-col items-center justify-center py-16 opacity-30 border-2 border-dashed border-zinc-200 dark:border-zinc-800 rounded-3xl">
                          <Moon size={24} className="text-zinc-400 mb-2" />
                          <span className="text-[9px] font-black uppercase tracking-widest">Recuperação</span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </motion.div>
          )}

          {viewMode === 'mes' && (
            <div className="w-full overflow-x-auto pb-2 custom-scrollbar">
            <motion.div key="mes" initial={{ opacity:0, scale:0.98 }} animate={{ opacity:1, scale:1 }} exit={{ opacity:0, scale:0.98 }} className="grid min-w-[720px] grid-cols-7 gap-1.5 rounded-2xl border-2 border-l-4 border-zinc-200 !border-l-red-500/20 bg-white p-2 shadow-soft dark:border-white/10 dark:!border-l-red-500/25 dark:bg-none dark:bg-card-dark sm:min-w-0 sm:gap-3 sm:p-4">
              {monthDays.map((dayObj, i) => {
                const data = dayObj.date;
                const key = isoKey(data);
                const items = displayAgenda[key] || [];
                const isMesAtual = dayObj.type === 'current';
                const hoje = isoKey(new Date()) === key;
                const diaNome = DIAS_CURTO[data.getDay()];
                const totalDia = getDayMinutesTotal(items);
                const resumoPorDiscMap = {};
                items.forEach((item) => {
                  const nome = getNomeDisc(item);
                  const isReviewItem = Boolean(item.isRevisao || item.isRevisaoAuto || item.isConsolidada);
                  const chave = `${item.disciplinaId || nome}::${isReviewItem ? 'rev' : 'std'}`;
                  const cor = getDisciplineColorForSlot(item, colorMap);
                  if (!resumoPorDiscMap[chave]) {
                    resumoPorDiscMap[chave] = {
                      chave,
                      nome,
                      minutos: 0,
                      isRevisao: isReviewItem,
                      cor,
                    };
                  }
                  resumoPorDiscMap[chave].minutos += (item.tempoMinutos || 0);
                });
                const resumoPorDisc = Object.values(resumoPorDiscMap)
                  .sort((a, b) => b.minutos - a.minutos);

                return (
                  <div
                    key={i}
                    onClick={() => {
                      if (!items.length) return;
                      const dayMs = 24 * 60 * 60 * 1000;
                      const startRef = new Date(startDate);
                      startRef.setHours(12, 0, 0, 0);
                      const dataRef = new Date(data);
                      dataRef.setHours(12, 0, 0, 0);
                      const diffDays = Math.floor((dataRef - startRef) / dayMs);
                      const targetWeek = Math.max(0, Math.floor(diffDays / 7));
                      setSemanaOffset(targetWeek);
                      setViewMode('semana');
                    }}
                    className={`relative min-h-[110px] overflow-hidden rounded-xl border p-1.5 text-left transition-all cursor-pointer group sm:min-h-[110px] sm:rounded-2xl sm:p-2 ${hoje ? 'border-red-300 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(254,226,226,0.95))] ring-2 ring-red-300/40 shadow-[0_18px_40px_rgba(239,68,68,0.18)] dark:border-red-500/50 dark:bg-zinc-800/70 dark:ring-red-500/20 dark:shadow-lg dark:shadow-red-500/10' : isMesAtual ? 'border-red-100 bg-white/95 shadow-[0_10px_26px_rgba(15,23,42,0.06)] hover:border-red-200 hover:shadow-[0_18px_34px_rgba(239,68,68,0.12)] dark:border-zinc-700 dark:bg-zinc-800/55 dark:hover:border-red-900/40 dark:hover:bg-zinc-800 dark:hover:shadow-md' : 'border-transparent bg-white/20 opacity-30 grayscale dark:bg-zinc-800/25'}`}
                  >
                    <div className="relative z-10 mb-1 flex items-start justify-between">
                      <span className={`text-[10px] font-black uppercase tracking-tighter ${hoje ? 'text-red-500' : 'text-zinc-400 dark:text-zinc-500'}`}>{diaNome}</span>
                      <span className={`text-xs font-black ${hoje ? 'text-red-500' : 'text-zinc-500 dark:text-zinc-500'}`}>{data.getDate()}</span>
                    </div>
                    <div className="relative z-10 flex flex-col gap-1">
                      {items.length > 0 && mostrarTempoTotal && (
                        <div className="w-fit rounded-md border border-red-100 bg-red-50/80 px-1.5 py-0.5 text-[8px] font-black tabular-nums text-red-600 dark:border-zinc-700 dark:bg-zinc-800/90 dark:text-zinc-200">
                          Total: {fmtMin(totalDia)}
                        </div>
                      )}
                      {resumoPorDisc.slice(0, 3).map((disc) => (
                        <div key={disc.chave} className="flex items-center justify-between gap-1 rounded-md border border-red-50 bg-white/90 px-1.5 py-1 shadow-sm dark:border-zinc-700 dark:bg-zinc-800/90 dark:shadow-none">
                          <div className="flex items-center gap-1 min-w-0">
                            <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${disc.cor?.bg || 'bg-zinc-400'}`} />
                            <span className={`text-[8px] font-bold truncate ${disc.isRevisao ? 'text-blue-600 dark:text-blue-300' : 'text-zinc-700 dark:text-zinc-200'}`}>
                              {disc.nome}
                            </span>
                          </div>
                          {mostrarTempoBloco && (
                            <span className="text-[8px] font-black tabular-nums text-zinc-500 dark:text-zinc-400">
                              {fmtMin(disc.minutos)}
                            </span>
                          )}
                        </div>
                      ))}
                      {resumoPorDisc.length > 3 && <span className="mt-0.5 text-center text-[8px] font-black text-zinc-400 dark:text-zinc-500">+{resumoPorDisc.length-3} DISCIPLINAS</span>}
                    </div>
                    {hoje && <div className="absolute top-0 right-0 p-1 pointer-events-none opacity-20"><Flag size={14} className="text-red-500 fill-red-500" /></div>}
                  </div>
                );
              })}
            </motion.div>
            </div>
          )}

          {viewMode === 'lista' && (
            <motion.div key="lista" initial={{ opacity:0, y: 20 }} animate={{ opacity:1, y:0 }} exit={{ opacity:0, y: 20 }} className="max-w-3xl mx-auto px-4 relative">
              {/* Linha vertical da Timeline */}
              <div className="absolute left-10 top-0 bottom-0 w-1 bg-gradient-to-b from-red-500/50 via-zinc-200 dark:via-zinc-800 to-zinc-200/20 rounded-full hidden sm:block" />

              <div className="space-y-8">
                {Object.entries(displayAgenda)
                  .filter(([key]) => key >= isoKey(startDate))
                  .sort()
                  .map(([key, items]) => {
                    const data = new Date(key + 'T12:00:00');
                    const hoje = isoKey(new Date()) === key;

                    // Não renderiza dias sem items
                    if (!items || items.length === 0) return null;

                    return (
                      <div key={key} className={`relative flex flex-col sm:flex-row gap-6 group transition-all ${hoje ? 'scale-[1.02]' : ''}`}>
                        {/* Indicador de Data na Timeline */}
                        <div className="flex flex-row sm:flex-col items-center gap-3 sm:w-20 shrink-0">
                          <div className={`w-14 h-14 rounded-2xl flex flex-col items-center justify-center border-2 transition-all shadow-lg ${hoje ? 'bg-red-600 border-red-400 text-white ring-4 ring-red-500/20' : 'bg-white dark:bg-zinc-900 border-zinc-100 dark:border-zinc-800 text-zinc-900 dark:text-white'}`}>
                            <span className={`text-[10px] font-black uppercase tracking-tight ${hoje ? 'text-red-100' : 'text-zinc-400'}`}>{DIAS_CURTO[data.getDay()]}</span>
                            <span className="text-xl font-black">{data.getDate()}</span>
                          </div>
                          {hoje && <div className="flex items-center gap-1 sm:hidden px-3 py-1 rounded-full bg-red-600 text-white text-[10px] font-black uppercase tracking-widest">Início Hoje</div>}
                        </div>

                        {/* Card do Conteúdo */}
                        <div className={`flex-1 p-6 rounded-[32px] border transition-all relative overflow-hidden ${hoje ? 'bg-white dark:bg-zinc-900 border-red-200 dark:border-red-900/50 shadow-2xl shadow-red-500/10' : 'bg-white dark:bg-zinc-900 border-zinc-100 dark:border-zinc-800 shadow-sm hover:shadow-md'}`}>
                          {hoje && (
                            <>
                              <div className="absolute top-0 right-0 px-4 py-1.5 bg-red-600 text-white text-[9px] font-black uppercase tracking-[0.2em] rounded-bl-2xl">Ponto de Partida</div>
                            </>
                          )}

                          <div className="flex items-center justify-between mb-4">
                            <h4 className="text-xs font-black uppercase tracking-widest text-zinc-400 flex items-center gap-2">
                              <Zap size={14} className={hoje ? 'text-red-500' : 'text-zinc-300'} /> Missões do Dia
                            </h4>
                            {items.length > 0 && mostrarTempoTotal && (
                              <div className="text-[10px] font-black bg-zinc-50 dark:bg-zinc-800 px-2 py-1 rounded-lg text-zinc-600 dark:text-zinc-300 border border-zinc-100 dark:border-zinc-700">
                                Total: {fmtMin(getDayMinutesTotal(items))}
                              </div>
                            )}
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {items.map((item, i) => {
                              const isDone = Boolean(item.concluido);
                              // [FIX-A] Usa helpers para todos os tipos de slot
                              const nomeDisc   = getNomeDisc(item);
                              const assuntoTxt = getTextoAssunto(item, config);
                              const isRev = item.isRevisao || item.isRevisaoAuto || item.isConsolidada;
                              const disciplinaColor = getDisciplineColorForSlot(item, colorMap);
                              const cardStyle = getDisciplineCardVars(isRev ? REVIEW_COLOR : disciplinaColor);

                              return (
                                <div key={i} onClick={() => setModalSlot(item)}
                                  style={cardStyle}
                                  className={`discipline-tinted-card relative flex items-center justify-between p-3 rounded-2xl border transition-all cursor-pointer group/item dark:border-zinc-800 ${isDone ? 'discipline-completed-card opacity-75' : ''}`}
                                >
                                  <div className="flex items-center gap-3 min-w-0">
                                    <div className="w-2 h-2 rounded-full shrink-0 shadow-sm" style={{ backgroundColor: disciplinaColor.hex }} />
                                    <div className="min-w-0">
                                      {/* [FIX-A] Nome da disciplina — sempre correto para revisões */}
                                      <p className={`text-[11px] font-black uppercase truncate leading-none mb-1 ${isDone ? `${isRev ? 'text-blue-700' : disciplinaColor.text} line-through opacity-75` : isRev ? 'text-blue-700 dark:text-blue-300' : disciplinaColor.text}`}>
                                        {nomeDisc}
                                      </p>
                                      {/* [FIX-B] Assunto — para revisões mostra o assunto revisado */}
                                      <p className="text-[9px] font-bold text-zinc-400 truncate uppercase tracking-tighter">
                                        {assuntoTxt}
                                      </p>
                                    </div>
                                  </div>
                                  {mostrarTempoBloco && (
                                    <span className="text-[10px] font-black tabular-nums text-zinc-600 group-hover/item:text-red-600 transition-colors ml-2">
                                      {fmtMin(item.tempoMinutos)}
                                    </span>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    );
                  })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="flex items-center gap-3 px-4 py-3 bg-zinc-900 dark:bg-white rounded-2xl border border-zinc-800 dark:border-zinc-200 mt-4 shadow-xl">
        <MapPin size={16} className="text-red-500" />
        <p className="text-[10px] font-black text-white dark:text-zinc-900 uppercase tracking-widest">Dica: Arraste os blocos na visão de semana para personalizar seu cronograma.</p>
      </div>

      {/* MODAL DE DETALHES */}
      <AnimatePresence>
        {modalSlot && (
          <div className="fixed inset-0 z-[20000] flex items-center justify-center px-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setModalSlot(null)} className="absolute inset-0 bg-zinc-950/80 backdrop-blur-sm" />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-sm bg-white dark:bg-zinc-900 rounded-[40px] overflow-hidden shadow-2xl border border-zinc-200 dark:border-zinc-800"
            >
              <div className={`h-2 w-full ${(modalSlot.isRevisao || modalSlot.isRevisaoAuto || modalSlot.isConsolidada) ? 'bg-blue-600 shadow-[0_0_15px_rgba(37,99,235,0.5)]' : (modalSlot.cor?.bg || 'bg-red-600 shadow-[0_0_15px_rgba(220,38,38,0.5)]')}`} />
              <div className="p-8">
                <div className="flex justify-between items-start mb-6">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      {/* [FIX-C] Label do tipo com intervalo de revisão */}
                      <span className={`px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest text-white ${(modalSlot.isRevisao || modalSlot.isRevisaoAuto || modalSlot.isConsolidada) ? 'bg-blue-600' : 'bg-red-600'}`}>
                        {getLabelTipo(modalSlot)}
                      </span>
                    </div>
                    {/* [FIX-A] Nome da disciplina no modal */}
                    <h3 className="text-2xl font-black uppercase tracking-tight text-zinc-900 dark:text-white leading-tight">
                      {getNomeDisc(modalSlot)}
                    </h3>
                  </div>
                  <button onClick={() => setModalSlot(null)} className="p-2 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-400 hover:text-red-500 transition-all">
                    <X size={20} />
                  </button>
                </div>
                <div className="space-y-4">
                  <div className="flex items-center gap-4 bg-zinc-50 dark:bg-zinc-800/50 p-4 rounded-2xl border border-zinc-100 dark:border-zinc-700">
                    <div className="w-12 h-12 rounded-2xl bg-white dark:bg-zinc-900 flex items-center justify-center shadow-md shadow-zinc-200/50 dark:shadow-none">
                      <Clock size={24} className="text-red-500" />
                    </div>
                    <div>
                      <p className="text-[9px] font-black uppercase tracking-widest text-zinc-400 mb-0.5">Tempo da Missão</p>
                      <p className="text-xl font-black text-zinc-900 dark:text-white leading-none">{fmtMin(modalSlot.tempoMinutos)}</p>
                    </div>
                  </div>

                  <div className="p-5 rounded-2xl bg-zinc-50 dark:bg-zinc-800/50 border border-dashed border-zinc-200 dark:border-zinc-700">
                    <p className="text-[9px] font-black uppercase tracking-widest text-zinc-400 mb-2">
                      {modalSlot.isConsolidada ? 'Tópicos para Revisar' : 'Objetivo do Estudo'}
                    </p>

                    {/* [FIX-C] Revisão consolidada: lista os tópicos */}
                    {modalSlot.isConsolidada && modalSlot.topicosRevisao?.length > 0 ? (
                      <ul className="space-y-2">
                        {modalSlot.topicosRevisao.map((t, i) => (
                          <li key={i} className="flex items-start gap-2">
                            <div className="w-1.5 h-1.5 rounded-full bg-blue-500 mt-1.5 shrink-0" />
                            <div>
                              <p className="text-[10px] font-black uppercase text-zinc-700 dark:text-zinc-300">{t.disciplinaNome}</p>
                              <p className="text-xs text-zinc-500 dark:text-zinc-400">{t.assunto}</p>
                            </div>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      /* [FIX-B] Revisão individual: mostra assunto revisado */
                      <p className="text-sm font-bold text-zinc-700 dark:text-zinc-300 leading-relaxed">
                        {(modalSlot.isRevisao || modalSlot.isRevisaoAuto)
                          ? (modalSlot.assunto || modalSlot.assuntoOriginal || 'Consolidação via revisão espaçada.')
                          : (modalSlot.assunto || 'Exploração teórica dos fundamentos da disciplina.')}
                      </p>
                    )}
                  </div>
                </div>
                <button onClick={() => setModalSlot(null)} className="w-full mt-8 py-4 bg-red-600 hover:bg-red-700 text-white rounded-2xl font-black uppercase text-xs tracking-[0.2em] active:scale-95 transition-all shadow-xl shadow-red-500/20">
                  {modalSlot.isConsolidada ? 'Fechar' : 'Confirmar Leitura'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

const AILoadingState = ({ statusMsg, percent = 0 }) => {
  const fases = [
    { icon: <Brain className="text-red-500" />, label: 'Analisando o Edital', desc: 'Mapeando os tópicos mais importantes para sua prova...' },
    { icon: <Cpu className="text-blue-500" />, label: 'Estratégia de Estudo', desc: 'Priorizando o que mais cai e o que você precisa dominar...' },
    { icon: <Calendar className="text-emerald-500" />, label: 'Montando seu Ciclo', desc: 'Distribuindo as matérias de forma inteligente na sua semana...' },
    { icon: <Sparkles className="text-amber-500" />, label: 'Sistema de Revisão', desc: 'Configurando seus gatilhos de memorização e revisões...' },
    { icon: <Bot className="text-indigo-500" />, label: 'Plano de Aprovação', desc: 'Seu guia definitivo de estudos está quase pronto!' }
  ];

  const faseIdx = useMemo(() => {
    if (percent <= 20) return 0;
    if (percent <= 45) return 1;
    if (percent <= 70) return 2;
    if (percent <= 90) return 3;
    return 4;
  }, [percent]);

  return (
    <div className="flex min-h-[calc(100vh-9rem)] w-full flex-col items-center justify-center overflow-hidden px-4 py-0 relative">
      <div className="relative z-10 flex w-full max-w-lg flex-col items-center justify-center text-center">
        {/* Main Scanner Circle */}
        <div className="relative mb-12 flex h-48 w-48 items-center justify-center sm:h-56 sm:w-56">

          {/* Progress Ring */}
          <svg viewBox="0 0 200 200" className="h-full w-full -rotate-90 overflow-visible">
            <defs>
              <linearGradient id="grad-red" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#ef4444" />
                <stop offset="100%" stopColor="#b91c1c" />
              </linearGradient>
            </defs>
            <motion.circle
              cx="100" cy="100" r="88"
              stroke="url(#grad-red)" strokeWidth="6"
              fill="transparent"
              strokeDasharray={552.9}
              initial={{ strokeDashoffset: 552.9 }}
              animate={{ strokeDashoffset: 552.9 - (552.9 * (percent / 100)) }}
              transition={{ duration: 0.8, ease: "easeOut" }}
              strokeLinecap="round"
              className="drop-shadow-[0_0_12px_rgba(239,68,68,0.5)]"
            />
          </svg>

          {/* Central Icon & Percentage */}
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <AnimatePresence mode="wait">
              <motion.div
                key={faseIdx}
                initial={{ scale: 0.5, opacity: 0, y: 10 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 1.2, opacity: 0, y: -10 }}
                transition={{ type: "spring", damping: 15 }}
                className="mb-1 rounded-3xl p-4"
              >
                {React.cloneElement(fases[faseIdx].icon, { size: 32 })}
              </motion.div>
            </AnimatePresence>
            <div className="flex flex-col items-center">
              <motion.span
                key={percent}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-3xl font-black text-zinc-900 dark:text-white tabular-nums tracking-tighter"
              >
                {Math.round(percent)}%
              </motion.span>
              <div className="flex gap-1 mt-1">
                {[0, 1, 2].map(i => (
                  <motion.div
                    key={i}
                    animate={{ opacity: [0.2, 1, 0.2] }}
                    transition={{ duration: 1, repeat: Infinity, delay: i * 0.2 }}
                    className="w-1 h-1 rounded-full bg-red-500"
                  />
                ))}
              </div>
            </div>
          </div>

          {/* Orbiting Particles */}
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
            className="absolute inset-0 pointer-events-none"
          >
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-2 h-2 rounded-full bg-red-500 shadow-[0_0_10px_#ef4444]" />
          </motion.div>
        </div>

        {/* Textual Status */}
        <div className="space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700">
            <Loader2 size={12} className="animate-spin text-red-500" />
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500 dark:text-zinc-400">Inteligência Estratégica</span>
          </div>

          <h3 className="text-2xl font-black text-zinc-900 dark:text-white uppercase tracking-tighter leading-none">
            {fases[faseIdx].label}
          </h3>

          <AnimatePresence mode="wait">
            <motion.p
              key={faseIdx}
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -5 }}
              className="text-sm text-zinc-500 dark:text-zinc-400 font-medium max-w-[320px] mx-auto italic"
            >
              {statusMsg || fases[faseIdx].desc}
            </motion.p>
          </AnimatePresence>
        </div>

        {/* Phase Progress Bar */}
        <div className="mt-12 flex gap-2 w-full px-8">
          {fases.map((_, i) => (
            <div key={i} className="flex-1 h-1.5 rounded-full overflow-hidden bg-zinc-100 dark:bg-zinc-800">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: i < faseIdx ? '100%' : (i === faseIdx ? '100%' : '0%') }}
                transition={{ duration: 0.5 }}
                className={`h-full ${i <= faseIdx ? 'bg-red-500 shadow-[0_0_8px_#ef4444]' : 'bg-transparent'}`}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Step5_Preview;
