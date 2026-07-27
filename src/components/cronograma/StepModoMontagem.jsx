import React, { useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import {
  CalendarDays,
  CheckCircle2,
  Clock,
  GripVertical,
  Layers,
  Moon,
  Plus,
  Trash2,
  Wand2,
  X,
} from 'lucide-react';
import { getDisciplineCardVars, getDisciplineColorForSlot } from '../../utils/disciplineColors';

const DIAS = [
  { idx: 0, curto: 'Dom', longo: 'Domingo' },
  { idx: 1, curto: 'Seg', longo: 'Segunda' },
  { idx: 2, curto: 'Ter', longo: 'Terca' },
  { idx: 3, curto: 'Qua', longo: 'Quarta' },
  { idx: 4, curto: 'Qui', longo: 'Quinta' },
  { idx: 5, curto: 'Sex', longo: 'Sexta' },
  { idx: 6, curto: 'Sab', longo: 'Sabado' },
];

const fmtMin = (min) => {
  const value = Number(min || 0);
  if (value < 60) return `${value}m`;
  const h = Math.floor(value / 60);
  const m = value % 60;
  return m ? `${h}h${String(m).padStart(2, '0')}` : `${h}h`;
};

const getHoje = () => {
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  return d;
};

const normalizeSlotMinutes = (value, fallback = 60) => {
  const minutes = Number(value);
  if (!Number.isFinite(minutes)) return fallback;
  return Math.max(15, Math.min(720, Math.round(minutes / 15) * 15));
};

const getSlotMinutes = (slot, fallback = 60) => (
  normalizeSlotMinutes(slot?.minutos ?? slot?.tempoMinutos ?? slot?.minutosEstudo, fallback)
);

const gradeToHorarios = (grade) => {
  const next = {};
  DIAS.forEach((dia) => {
    const minutos = (grade?.[dia.idx] || []).reduce((acc, slot) => acc + getSlotMinutes(slot, 0), 0);
    next[dia.idx] = Math.round((minutos / 60) * 100) / 100;
  });
  return next;
};

const SlotCard = ({ slot, onRemove, onMinutesChange }) => {
  const color = getDisciplineColorForSlot(slot);
  const cardStyle = getDisciplineCardVars(color);
  const minutos = getSlotMinutes(slot, 60);
  const percent = Math.min(100, (minutos / 720) * 100);
  const sliderClass = `slider-slot-${String(slot.id || '').replace(/[^a-zA-Z0-9_-]/g, '-')}`;
  const sliderStyle = `
    .${sliderClass}::-webkit-slider-thumb {
      -webkit-appearance: none; appearance: none;
      width: 12px; height: 12px; border-radius: 50%;
      background: #09090b; border: 2px solid #ffffff;
      box-shadow: 0 1px 4px rgba(9,9,11,0.22); cursor: pointer;
      margin-top: -4px;
    }
    .${sliderClass}::-webkit-slider-runnable-track {
      width: 100%; height: 4px; border: 0; border-radius: 999px; background: transparent;
    }
    .${sliderClass}::-moz-range-thumb {
      width: 12px; height: 12px; border-radius: 50%;
      background: #09090b; border: 2px solid #ffffff;
      box-shadow: 0 1px 4px rgba(9,9,11,0.22); cursor: pointer;
    }
    .${sliderClass}::-moz-range-track {
      width: 100%; height: 4px; border: 0; border-radius: 999px; background: transparent;
    }
    .${sliderClass}::-moz-focus-outer { border: 0; }
    .${sliderClass} {
      -webkit-appearance: none; appearance: none;
      width: 100%; height: 18px;
      border: 0; border-radius: 0; background: transparent;
      outline: none; box-shadow: none;
    }
  `;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      onClick={(event) => event.stopPropagation()}
      style={cardStyle}
      className={`discipline-tinted-card group relative min-h-[70px] overflow-hidden rounded-2xl border shadow-sm transition-all hover:-translate-y-0.5 dark:border-zinc-800 ${color.text}`}
    >
      <style>{sliderStyle}</style>

      <div className="flex h-full flex-col gap-2 px-2.5 py-2 pr-10 sm:px-3 sm:pr-10">
        <div className="flex min-w-0 flex-col gap-1">
          <div className="flex min-w-0 items-center gap-2">
            <span className="h-2.5 w-2.5 shrink-0 rounded-full shadow-sm" style={{ backgroundColor: color.hex }} />
            <h4 className={`min-w-0 flex-1 line-clamp-2 text-[8px] font-black uppercase leading-tight tracking-normal sm:text-[10px] ${color.text}`}>
              {slot.disciplinaNome}
            </h4>
          </div>
          <span className="w-fit rounded-md bg-white/75 px-1.5 py-0.5 text-[10px] font-black leading-none tracking-tight text-zinc-700 tabular-nums dark:bg-zinc-950/60 dark:text-zinc-200 sm:text-sm">
            {fmtMin(minutos)}
          </span>
        </div>

        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onRemove();
          }}
          className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-lg border border-zinc-200 bg-white/90 text-zinc-500 shadow-sm transition-colors hover:border-red-200 hover:bg-red-50 hover:text-red-600 dark:border-zinc-700 dark:bg-zinc-950/90 dark:text-zinc-300 dark:hover:border-red-900/60 dark:hover:bg-red-950/30 dark:hover:text-red-300 sm:top-1/2 sm:-translate-y-1/2"
          aria-label="Remover bloco"
        >
          <Trash2 size={13} />
        </button>

        <div className="relative h-5 w-full" data-no-pan>
          <div className="absolute inset-x-0 top-1/2 h-1 -translate-y-1/2 overflow-hidden rounded-full bg-zinc-200/65 dark:bg-zinc-700/60">
            <div
              className="h-full rounded-full bg-zinc-950/75 dark:bg-white/70"
              style={{ width: `${percent}%`, transition: 'width 0.1s ease-out' }}
            />
          </div>
          <div
            className="pointer-events-none absolute top-1/2 z-10 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-zinc-950 shadow-sm dark:bg-white dark:border-zinc-900"
            style={{ left: `${percent}%`, transition: 'left 0.1s ease-out' }}
          />
          <input
            type="range"
            min="15"
            max="720"
            step="15"
            value={minutos}
            onChange={(event) => onMinutesChange(normalizeSlotMinutes(event.target.value, minutos))}
            className={`absolute inset-x-0 top-1/2 z-20 m-0 h-5 -translate-y-1/2 cursor-pointer border-0 bg-transparent p-0 opacity-0 shadow-none ${sliderClass}`}
            aria-label={`Tempo de estudo para ${slot.disciplinaNome}`}
          />
        </div>
      </div>
    </motion.div>
  );
};

const DayColumn = ({
  dia,
  slots,
  selected,
  selectedDisciplina,
  onSelect,
  onDropDisciplina,
  onRemoveSlot,
  onUpdateSlotTime,
  disciplinasDisponiveis,
  pickerOpen,
  onOpenPicker,
  onClosePicker,
  onAddDisciplina,
}) => {
  const minutosDia = slots.reduce((acc, slot) => acc + getSlotMinutes(slot, 0), 0);
  const hoje = getHoje();
  const offset = (dia.idx - hoje.getDay() + 7) % 7;
  const isHoje = offset === 0;
  const activateDay = (openPicker = false) => {
    onSelect(dia.idx);
    if (selectedDisciplina) {
      onAddDisciplina(selectedDisciplina, dia.idx);
      onClosePicker();
      return;
    }
    if (openPicker) onOpenPicker(dia.idx);
  };

  return (
    <div
      data-day-drop
      data-day-idx={dia.idx}
      onDragOver={(event) => event.preventDefault()}
      onDrop={(event) => onDropDisciplina(event, dia.idx)}
      onClick={() => activateDay(true)}
      className={`relative flex min-h-[340px] w-[216px] shrink-0 flex-col overflow-hidden rounded-[18px] border p-2 transition-all duration-300 sm:min-h-[480px] sm:w-[300px] sm:rounded-[20px] sm:p-2.5 lg:min-h-[470px] lg:w-[264px] xl:min-h-[500px] xl:w-[280px] ${
        selected || isHoje
          ? 'border-zinc-300 bg-white/80 shadow-md ring-1 ring-zinc-300/70 dark:border-zinc-700 dark:bg-zinc-950/50 dark:ring-zinc-700/60'
          : 'border-zinc-200 bg-zinc-50/70 shadow-sm hover:border-zinc-300 dark:border-zinc-800 dark:bg-zinc-950/30 dark:hover:border-zinc-700'
      }`}
    >
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          activateDay(true);
        }}
        className="mb-1.5 shrink-0 rounded-[14px] border border-zinc-800 bg-zinc-950 px-2.5 py-2 text-left shadow-sm transition-all duration-300 dark:border-zinc-800 dark:bg-zinc-900 sm:mb-3 sm:rounded-[20px] sm:px-3 sm:py-3"
      >
        <span className="flex items-start justify-between gap-2 sm:gap-3">
          <span className="min-w-0 pt-0.5">
            <span className="block truncate text-[12px] font-black uppercase leading-none tracking-tight text-white sm:text-base">
              {dia.longo}
            </span>
          </span>
          <span className="shrink-0 rounded-lg border border-white/10 bg-white/10 px-1.5 py-1 text-white sm:px-2 sm:py-1.5">
            <span className="flex items-center gap-1 sm:gap-1.5">
              <Clock size={11} className="text-zinc-300 sm:h-3 sm:w-3" />
              <span className="flex flex-col items-end leading-none">
                <span className="hidden text-[8px] font-black uppercase tracking-widest text-zinc-300 sm:block">Tempo</span>
                <span className="mt-0.5 text-[10px] font-black tabular-nums text-white sm:text-[11px]">{fmtMin(minutosDia)}</span>
              </span>
            </span>
          </span>
        </span>
      </button>

      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          onSelect(dia.idx);
          onOpenPicker(dia.idx);
        }}
        className="mb-1.5 flex h-7 shrink-0 items-center justify-center gap-1 rounded-xl border border-zinc-200 bg-white text-[7px] font-black uppercase tracking-[0.08em] text-zinc-500 shadow-sm transition hover:border-red-200 hover:bg-red-50 hover:text-red-600 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-400 dark:hover:border-red-900/60 dark:hover:bg-red-950/20 sm:mb-2 sm:h-9 sm:gap-1.5 sm:text-[9px] sm:tracking-widest"
      >
        <Plus size={13} />
        Escolher disciplina
      </button>

      {pickerOpen && (
        <div
          className="mb-2 shrink-0 overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-lg shadow-zinc-950/10 dark:border-zinc-800 dark:bg-zinc-950"
          onClick={(event) => event.stopPropagation()}
        >
          <div className="flex items-center justify-between gap-2 border-b border-zinc-100 px-3 py-2 dark:border-zinc-800">
            <p className="text-[9px] font-black uppercase tracking-widest text-zinc-400">Adicionar em {dia.curto}</p>
            <button
              type="button"
              onClick={onClosePicker}
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-zinc-400 transition hover:bg-zinc-100 hover:text-red-600 dark:hover:bg-zinc-900"
              aria-label="Fechar lista de disciplinas"
            >
              <X size={14} />
            </button>
          </div>
          <div className="max-h-[170px] overflow-y-auto p-1.5 custom-scrollbar sm:max-h-[220px]">
            {disciplinasDisponiveis.map((disciplina) => {
              const color = getDisciplineColorForSlot({
                disciplinaId: disciplina.id,
                disciplinaNome: disciplina.nome,
                cor: disciplina.cor,
              });
              return (
                <button
                  key={`${dia.idx}-${disciplina.id || disciplina.nome}`}
                  type="button"
                  onClick={() => {
                    onAddDisciplina(disciplina, dia.idx);
                    onClosePicker();
                  }}
                  className="flex w-full items-center gap-2 rounded-xl px-2 py-2 text-left transition hover:bg-red-50 dark:hover:bg-red-950/20"
                >
                  <span className="h-2.5 w-2.5 shrink-0 rounded-full shadow-sm" style={{ backgroundColor: color.hex }} />
                  <span className="min-w-0 flex-1 truncate text-[8px] font-black uppercase tracking-normal text-zinc-700 dark:text-zinc-200 sm:text-[10px]">
                    {disciplina.nome}
                  </span>
                  <Plus size={13} className="shrink-0 text-red-500" />
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div className="flex flex-1 flex-col gap-2 sm:gap-3">
        {slots.length === 0 ? (
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              activateDay(true);
            }}
            className="flex flex-1 flex-col items-center justify-center rounded-2xl border-2 border-dashed border-zinc-200 px-2 py-8 text-center opacity-45 transition hover:border-red-200 hover:opacity-100 dark:border-zinc-800 dark:hover:border-red-900/60 sm:rounded-3xl sm:px-3 sm:py-16"
          >
            <div>
              <Moon size={20} className="mx-auto mb-2 text-zinc-400 sm:h-6 sm:w-6" />
              <p className="text-[8px] font-black uppercase tracking-widest text-zinc-400 sm:text-[10px]">
                Solte aqui
              </p>
              <p className="mt-2 text-[8px] font-black uppercase tracking-widest text-red-500">
                Ou escolha
              </p>
            </div>
          </button>
        ) : (
          slots.map((slot) => (
            <SlotCard
              key={slot.id}
              slot={slot}
              onRemove={() => onRemoveSlot(dia.idx, slot.id)}
              onMinutesChange={(minutes) => onUpdateSlotTime(dia.idx, slot.id, minutes)}
            />
          ))
        )}
      </div>
    </div>
  );
};

export default function StepModoMontagem({
  disciplinas = [],
  extraDisciplinas = [],
  config = {},
  onConfigChange,
  onHorariosChange,
  selecao = {},
  onSelecaoChange,
  onModoEscolhido,
}) {
  const [diaSelecionado, setDiaSelecionado] = useState(1);
  const [pickerDia, setPickerDia] = useState(null);
  const [disciplinaToqueId, setDisciplinaToqueId] = useState(null);
  const weekScrollRef = useRef(null);
  const dragScrollRef = useRef({ active: false, startX: 0, scrollLeft: 0, pointerId: null, moved: false });
  const touchDisciplinaRef = useRef({ active: false, pointerId: null, disciplina: null, startX: 0, startY: 0, moved: false });
  const ignoreNextDisciplinaClickRef = useRef(false);
  const modo = config.modoMontagem || 'inteligente';
  const grade = config.gradePersonalizada || {};
  const disciplinaCores = config.disciplinaCoresPersonalizadas || {};
  const disciplinasDisponiveis = useMemo(() => (
    [...disciplinas, ...extraDisciplinas].map((disciplina) => ({
      ...disciplina,
      cor: disciplinaCores[disciplina.id] || disciplina.cor || null,
    }))
  ), [disciplinas, extraDisciplinas, disciplinaCores]);
  const totalBlocos = Object.values(grade).reduce((acc, slots) => acc + (Array.isArray(slots) ? slots.length : 0), 0);
  const totalMinutos = Object.values(grade).reduce(
    (acc, slots) => acc + (Array.isArray(slots) ? slots.reduce((sum, slot) => sum + getSlotMinutes(slot, 0), 0) : 0),
    0,
  );
  const disciplinaToque = useMemo(
    () => disciplinasDisponiveis.find((item) => String(item.id) === String(disciplinaToqueId)) || null,
    [disciplinasDisponiveis, disciplinaToqueId],
  );

  const updateGrade = (nextGrade) => {
    onConfigChange?.({
      ...config,
      modoMontagem: 'personalizado',
      disciplinaCoresPersonalizadas: disciplinaCores,
      gradePersonalizada: nextGrade,
    });
    onHorariosChange?.(gradeToHorarios(nextGrade));
  };

  const setModo = (nextMode) => {
    onConfigChange?.({ ...config, modoMontagem: nextMode });
    onModoEscolhido?.(nextMode);
  };

  const ensureSelected = (disciplina) => {
    if (!disciplina?.id) return;
    onSelecaoChange?.({
      ...selecao,
      [disciplina.id]: {
        ...(selecao[disciplina.id] || {}),
        checked: true,
        parcial: false,
        nivel: selecao[disciplina.id]?.nivel || disciplina.nivelDominio || disciplina.nivel || 'intermediario',
      },
    });
  };

  const addSlot = (disciplina, diaIdx = diaSelecionado) => {
    if (!disciplina) return;
    const slot = {
      id: `custom-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      disciplinaId: disciplina.id,
      disciplinaNome: disciplina.nome,
      cor: disciplinaCores[disciplina.id] || disciplina.cor || null,
      minutos: normalizeSlotMinutes(config.tempoSessaoMinutos || 60),
    };
    ensureSelected(disciplina);
    updateGrade({
      ...grade,
      [diaIdx]: [...(grade[diaIdx] || []), slot],
    });
    setDisciplinaToqueId(null);
  };

  const handleDragStartDisciplina = (event, disciplina) => {
    event.dataTransfer.effectAllowed = 'copy';
    event.dataTransfer.setData('application/json', JSON.stringify({
      disciplinaId: disciplina.id,
      disciplinaNome: disciplina.nome,
    }));
  };

  const handleDropDisciplina = (event, diaIdx) => {
    event.preventDefault();
    const payload = event.dataTransfer.getData('application/json');
    if (!payload) return;
    try {
      const data = JSON.parse(payload);
      const disciplina = disciplinasDisponiveis.find((item) => item.id === data.disciplinaId || item.nome === data.disciplinaNome);
      if (disciplina) {
        setDiaSelecionado(diaIdx);
        addSlot(disciplina, diaIdx);
      }
    } catch {
      // Ignore drags from outside this planner.
    }
  };

  const removeSlot = (diaIdx, slotId) => {
    updateGrade({
      ...grade,
      [diaIdx]: (grade[diaIdx] || []).filter((slot) => slot.id !== slotId),
    });
  };

  const updateSlotTime = (diaIdx, slotId, minutos) => {
    updateGrade({
      ...grade,
      [diaIdx]: (grade[diaIdx] || []).map((slot) => (
        slot.id === slotId ? { ...slot, minutos: normalizeSlotMinutes(minutos, slot.minutos) } : slot
      )),
    });
  };

  const updateDisciplineColor = (disciplina, hex) => {
    if (!disciplina?.id || !hex) return;
    const nextCores = { ...disciplinaCores, [disciplina.id]: hex };
    const nextGrade = Object.fromEntries(
      Object.entries(grade).map(([diaIdx, slots]) => [
        diaIdx,
        (Array.isArray(slots) ? slots : []).map((slot) => (
          String(slot.disciplinaId) === String(disciplina.id)
            ? { ...slot, cor: hex }
            : slot
        )),
      ]),
    );
    onConfigChange?.({
      ...config,
      modoMontagem: 'personalizado',
      disciplinaCoresPersonalizadas: nextCores,
      gradePersonalizada: nextGrade,
    });
    onHorariosChange?.(gradeToHorarios(nextGrade));
  };

  const shouldIgnorePan = (target) => (
    target?.closest?.('button, a, input, select, textarea, [data-no-pan]')
  );

  const handleWeekPointerDown = (event) => {
    if (event.button !== 0 || !weekScrollRef.current || shouldIgnorePan(event.target)) return;
    dragScrollRef.current = {
      active: true,
      startX: event.clientX,
      scrollLeft: weekScrollRef.current.scrollLeft,
      pointerId: event.pointerId,
      moved: false,
    };
    event.currentTarget.setPointerCapture?.(event.pointerId);
    event.currentTarget.classList.add('cursor-grabbing');
  };

  const handleWeekPointerMove = (event) => {
    const state = dragScrollRef.current;
    if (!state.active || !weekScrollRef.current || state.pointerId !== event.pointerId) return;
    const delta = event.clientX - state.startX;
    if (Math.abs(delta) > 4) state.moved = true;
    event.preventDefault();
    weekScrollRef.current.scrollLeft = state.scrollLeft - (delta * 1.35);
  };

  const stopWeekPointerDrag = (event) => {
    if (event?.pointerId && dragScrollRef.current.pointerId !== event.pointerId) return;
    dragScrollRef.current.active = false;
    dragScrollRef.current.pointerId = null;
    weekScrollRef.current?.classList.remove('cursor-grabbing');
  };

  const handleWeekClickCapture = (event) => {
    if (!dragScrollRef.current.moved) return;
    event.preventDefault();
    event.stopPropagation();
    dragScrollRef.current.moved = false;
  };

  const isCoarsePointer = () => (
    typeof window !== 'undefined'
      && typeof window.matchMedia === 'function'
      && window.matchMedia('(pointer: coarse)').matches
  );

  const selectDisciplinaForTouch = (disciplina) => {
    if (!disciplina?.id) return;
    setDisciplinaToqueId(disciplina.id);
    setDiaSelecionado((diaAtual) => diaAtual ?? 1);
    ensureSelected(disciplina);
  };

  const handleDisciplinaClick = (disciplina) => {
    if (ignoreNextDisciplinaClickRef.current) {
      ignoreNextDisciplinaClickRef.current = false;
      return;
    }
    if (isCoarsePointer()) {
      selectDisciplinaForTouch(disciplina);
      return;
    }
    addSlot(disciplina);
  };

  const handleDisciplinaPointerDown = (event, disciplina) => {
    if (event.pointerType === 'mouse' || event.target?.closest?.('input, button, label, [data-no-touch-drag]')) return;
    touchDisciplinaRef.current = {
      active: true,
      pointerId: event.pointerId,
      disciplina,
      startX: event.clientX,
      startY: event.clientY,
      moved: false,
    };
    event.currentTarget.setPointerCapture?.(event.pointerId);
    selectDisciplinaForTouch(disciplina);
  };

  const handleDisciplinaPointerMove = (event) => {
    const state = touchDisciplinaRef.current;
    if (!state.active || state.pointerId !== event.pointerId) return;
    const deltaX = event.clientX - state.startX;
    const deltaY = event.clientY - state.startY;
    if (Math.hypot(deltaX, deltaY) > 8) {
      state.moved = true;
      event.preventDefault();
    }
  };

  const finishDisciplinaPointer = (event) => {
    const state = touchDisciplinaRef.current;
    if (!state.active || state.pointerId !== event.pointerId) return;
    const dropTarget = document
      .elementFromPoint(event.clientX, event.clientY)
      ?.closest?.('[data-day-drop]');
    if (state.moved && dropTarget?.dataset?.dayIdx) {
      const diaIdx = Number(dropTarget.dataset.dayIdx);
      if (Number.isFinite(diaIdx)) {
        setDiaSelecionado(diaIdx);
        addSlot(state.disciplina, diaIdx);
        ignoreNextDisciplinaClickRef.current = true;
      }
    }
    touchDisciplinaRef.current = { active: false, pointerId: null, disciplina: null, startX: 0, startY: 0, moved: false };
  };

  return (
    <div className="flex h-full w-full flex-col overflow-hidden">
      {modo !== 'personalizado' && (
        <div className="mx-auto flex min-h-[calc(100vh-12rem)] w-full max-w-5xl flex-col items-center justify-center py-4 md:min-h-0 md:justify-start md:pt-0">
        <motion.div
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-5 max-w-2xl px-2 text-center sm:mb-7 sm:px-4"
        >
          <h2 className="mb-2 text-4xl font-black uppercase leading-[0.95] tracking-tighter text-zinc-900 dark:text-white sm:mb-3 sm:text-4xl">
            Como montar<br /><span className="text-red-600">sua semana?</span>
          </h2>
          <p className="mx-auto max-w-lg text-[12px] font-black uppercase leading-relaxed tracking-[0.16em] text-zinc-500 dark:text-zinc-400 sm:text-sm sm:font-semibold sm:normal-case sm:tracking-normal">
            Use a distribuicao automatica ou arraste cada disciplina para montar uma agenda manual.
          </p>
        </motion.div>
        <div className="grid w-full max-w-5xl grid-cols-2 gap-2 px-1 sm:gap-6 sm:px-4 lg:gap-10">
          {[
            {
              id: 'inteligente',
              title: 'Distribuicao automatica',
              subtitle: 'Rapida e equilibrada',
              desc: 'O sistema equilibra disciplinas, revisoes e carga semanal.',
              icon: Wand2,
              benefits: ['Distribuicao inteligente', 'Ajuste automatico da carga', 'Menos trabalho manual'],
            },
            {
              id: 'personalizado',
              title: 'Montagem personalizada',
              subtitle: 'Controle por dia',
              desc: 'Ideal para quem ja tem um cronograma pronto em outro lugar e quer adicionar na plataforma.',
              icon: CalendarDays,
              benefits: ['Agenda pronta externa', 'Arraste disciplinas', 'Edite as horas por bloco'],
            },
          ].map((option) => {
            const Icon = option.icon;
            const active = modo === option.id;
            const isAutomatico = option.id === 'inteligente';
            return (
              <button
                key={option.id}
                type="button"
                onClick={() => setModo(option.id)}
                className={`group relative flex min-h-[168px] w-full flex-col overflow-hidden rounded-2xl border-2 p-3 text-left shadow-md transition-all duration-500 hover:-translate-y-2 dark:bg-zinc-900 sm:min-h-[260px] sm:rounded-[2.2rem] sm:p-6 sm:shadow-xl md:p-7 ${
                  active
                    ? 'border-red-500 bg-white shadow-red-500/10 dark:border-red-900/50'
                    : isAutomatico
                      ? 'border-zinc-100 bg-white hover:border-red-600 hover:shadow-red-600/10 dark:border-zinc-800'
                      : 'border-dashed border-zinc-300 bg-zinc-50 hover:border-zinc-400 hover:bg-white hover:shadow-zinc-900/10 dark:border-zinc-700 dark:bg-zinc-900/60 dark:hover:border-zinc-500 dark:hover:bg-zinc-900'
                }`}
              >
                <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-[2.2rem]">
                  <Icon
                    size={160}
                    strokeWidth={1.5}
                    className={`absolute -bottom-6 -right-6 opacity-[0.05] transition-all duration-700 group-hover:-rotate-12 group-hover:scale-110 dark:opacity-[0.08] ${isAutomatico ? 'text-red-600 dark:text-red-500' : 'text-zinc-500 dark:text-zinc-400'}`}
                  />
                  <div className={`absolute inset-0 opacity-0 transition-opacity duration-500 group-hover:opacity-100 ${isAutomatico ? 'bg-gradient-to-br from-red-500/[0.06] to-transparent' : 'bg-[radial-gradient(circle_at_bottom_right,rgba(113,113,122,0.12),transparent_55%)]'}`} />
                </div>

                <span className={`relative z-10 flex h-7 w-7 items-center justify-center rounded-xl shadow-lg transition-all duration-500 group-hover:rotate-6 sm:h-12 sm:w-12 ${
                  isAutomatico
                    ? 'bg-red-600 text-white shadow-red-500/20'
                    : 'border border-zinc-200 bg-zinc-100 text-zinc-600 shadow-zinc-900/10 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300'
                }`}>
                  <Icon size={16} strokeWidth={2.5} className="sm:h-6 sm:w-6" />
                </span>

                <span className="relative z-10 mt-2 flex h-full flex-col sm:mt-6">
                  <span className="block text-[18px] font-black uppercase leading-none tracking-tighter text-zinc-900 dark:text-white min-[390px]:text-[20px] sm:text-xl md:text-2xl">
                    <span className="sm:hidden">{option.id === 'inteligente' ? 'Automatico' : 'Personalizado'}</span>
                    <span className="hidden sm:inline">{option.title}</span>
                  </span>
                  <span className={`mt-1 block text-[7px] font-black uppercase tracking-[0.1em] sm:mt-2 sm:text-[9px] sm:tracking-[0.2em] ${isAutomatico ? 'text-red-600 dark:text-red-500' : 'text-zinc-500 dark:text-zinc-400'}`}>
                    {option.subtitle}
                  </span>
                  <span className="mt-2 line-clamp-3 text-[11px] font-semibold leading-snug text-zinc-500 dark:text-zinc-400 min-[390px]:text-[12px] sm:mt-4 sm:text-[12px] md:text-[13px] lg:text-sm">
                    {option.desc}
                  </span>

                  <span className="mt-3 hidden flex-col gap-1.5 sm:mt-5 sm:flex sm:gap-2.5">
                    {option.benefits.map((item) => (
                      <span key={item} className="flex items-center gap-1.5 sm:gap-2.5">
                        <span className="shrink-0 rounded-full bg-red-600/10 p-0.5 text-red-600">
                          <CheckCircle2 size={9} strokeWidth={3} className="sm:h-3 sm:w-3" />
                        </span>
                        <span className="truncate text-[8px] font-bold text-zinc-600 dark:text-zinc-300 sm:text-[11px]">
                          {item}
                        </span>
                      </span>
                    ))}
                  </span>

                  <span className="mt-auto hidden pt-3 text-[7px] font-black uppercase tracking-[0.1em] text-zinc-400 transition-colors group-hover:text-red-600 sm:block sm:pt-5 sm:text-[10px] sm:tracking-[0.14em]">
                    Clique no card para continuar
                  </span>
                </span>
                {active && (
                  <span className="absolute bottom-3 right-3 rounded-full bg-red-600 p-1 text-white shadow-lg shadow-red-600/20 sm:bottom-5 sm:right-5">
                    <CheckCircle2 size={13} className="sm:h-4 sm:w-4" />
                  </span>
                )}
              </button>
            );
          })}
        </div>
        </div>
      )}

      {modo === 'personalizado' && (
        <div className="grid min-h-0 flex-1 gap-2 overflow-y-auto px-0 pb-8 custom-scrollbar sm:px-2">
          <section className="flex min-h-[420px] min-w-0 flex-col lg:min-h-[520px]">
            <div className="mb-3 flex flex-col items-center gap-2 px-0 text-center sm:mb-4 sm:gap-3 md:mb-2">
              <div className="min-w-0 flex-1">
                <h2 className="text-4xl font-black uppercase leading-[0.95] tracking-tighter text-zinc-900 dark:text-white sm:text-4xl">
                  Montagem<br /><span className="text-red-600">Personalizada</span>
                </h2>
                <p className="mx-auto mt-3 max-w-2xl text-base font-semibold leading-relaxed text-zinc-500 dark:text-zinc-400 sm:text-sm">
                  Monte sua semana manualmente: escolha um dia, adicione as disciplinas que quer estudar e ajuste a duração de cada bloco.
                </p>
                <div className="mt-2 flex flex-row flex-wrap items-center justify-center gap-2">
                  <div className="inline-flex w-fit items-center gap-1.5 rounded-xl border border-red-100 bg-white px-2.5 py-1.5 shadow-sm dark:border-red-900/40 dark:bg-zinc-950 sm:gap-2 sm:rounded-2xl sm:px-3.5 sm:py-2.5">
                    <Clock size={14} className="text-red-500 sm:h-[17px] sm:w-[17px]" />
                    <span className="text-[9px] font-black uppercase tracking-widest text-zinc-400">Total da semana</span>
                    <span className="text-sm font-black leading-none tabular-nums text-zinc-900 dark:text-white sm:text-lg">{fmtMin(totalMinutos)}</span>
                  </div>
                </div>
                <p className="mt-1 hidden text-xs font-semibold text-zinc-500 dark:text-zinc-400 sm:block">
                  Clique em um dia ou em escolher disciplina para abrir a lista naquele bloco. {totalBlocos} blocos, {fmtMin(totalMinutos)} por semana.
                </p>
              </div>
            </div>

            <div className="grid min-h-0 flex-1 gap-2 lg:grid-cols-[minmax(0,1fr)_320px] xl:grid-cols-[minmax(0,1fr)_360px]">
              <div
                ref={weekScrollRef}
                onPointerDown={handleWeekPointerDown}
                onPointerMove={handleWeekPointerMove}
                onPointerCancel={stopWeekPointerDrag}
                onPointerUp={stopWeekPointerDrag}
                onClickCapture={handleWeekClickCapture}
                className="min-w-0 flex-1 cursor-grab touch-pan-y overflow-x-auto pb-4 select-none custom-scrollbar sm:pb-6"
              >
                <div className="flex min-w-max gap-2 px-0 xl:gap-3">
                {DIAS.map((dia) => (
                  <DayColumn
                    key={dia.idx}
                    dia={dia}
                    slots={grade[dia.idx] || []}
                    selected={diaSelecionado === dia.idx}
                    selectedDisciplina={disciplinaToque}
                    onSelect={setDiaSelecionado}
                    onDropDisciplina={handleDropDisciplina}
                    onRemoveSlot={removeSlot}
                    onUpdateSlotTime={updateSlotTime}
                    disciplinasDisponiveis={disciplinasDisponiveis}
                    pickerOpen={pickerDia === dia.idx}
                    onOpenPicker={setPickerDia}
                    onClosePicker={() => setPickerDia(null)}
                    onAddDisciplina={addSlot}
                  />
                ))}
                </div>
              </div>

              <aside className="hidden min-w-0 overflow-hidden rounded-xl border border-zinc-200 bg-white p-1.5 shadow-sm dark:border-zinc-800 dark:bg-zinc-950/60 sm:rounded-2xl sm:p-3 lg:block lg:self-start lg:rounded-[28px] lg:p-4">
            <div className="mb-1.5 flex items-center gap-2 border-b border-zinc-100 pb-1.5 dark:border-zinc-800 sm:mb-3 sm:gap-3 sm:pb-3 lg:mb-4 lg:pb-4">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-zinc-100 text-zinc-500 dark:bg-zinc-900 sm:h-9 sm:w-9 sm:rounded-2xl lg:h-10 lg:w-10">
                <Layers size={16} className="sm:h-[18px] sm:w-[18px]" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[8px] font-black uppercase tracking-[0.16em] text-zinc-400 sm:text-[10px] sm:tracking-[0.22em]">Disciplinas</p>
                <p className="truncate text-[9px] font-semibold text-zinc-500 dark:text-zinc-400 sm:text-xs">
                  {disciplinaToque ? `Toque no dia para adicionar ${disciplinaToque.nome}.` : `Toque ou arraste para ${DIAS.find((dia) => dia.idx === diaSelecionado)?.longo}.`}
                </p>
              </div>
            </div>

            <div className="grid max-h-[112px] min-w-0 grid-cols-2 gap-1 overflow-x-hidden overflow-y-auto pr-0.5 custom-scrollbar sm:max-h-[220px] sm:gap-2 sm:pr-1 lg:max-h-[560px] lg:grid-cols-1">
              {disciplinasDisponiveis.map((disciplina) => {
                const color = getDisciplineColorForSlot({
                  disciplinaId: disciplina.id,
                  disciplinaNome: disciplina.nome,
                  cor: disciplina.cor,
                });
                const activeDisciplina = String(disciplinaToqueId) === String(disciplina.id);
                return (
                  <div
                    key={disciplina.id || disciplina.nome}
                    draggable
                    onDragStart={(event) => handleDragStartDisciplina(event, disciplina)}
                    onPointerDown={(event) => handleDisciplinaPointerDown(event, disciplina)}
                    onPointerMove={handleDisciplinaPointerMove}
                    onPointerUp={finishDisciplinaPointer}
                    onPointerCancel={finishDisciplinaPointer}
                    onClick={() => handleDisciplinaClick(disciplina)}
                    className={`flex min-w-0 w-full cursor-grab items-center gap-1 rounded-lg border px-1.5 py-1 text-left transition active:cursor-grabbing sm:gap-2 sm:rounded-2xl sm:px-2.5 sm:py-2 lg:gap-3 lg:px-3 lg:py-2.5 ${
                      activeDisciplina
                        ? 'border-red-400 bg-red-50 ring-1 ring-red-500/30 dark:border-red-900/70 dark:bg-red-950/20'
                        : 'border-zinc-200 bg-zinc-50 hover:border-red-300 hover:bg-red-50/50 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-red-900/50 dark:hover:bg-red-950/10'
                    }`}
                  >
                    <GripVertical size={12} className="hidden shrink-0 text-zinc-300 sm:block" />
                    <label className="relative h-3.5 w-3.5 shrink-0 cursor-pointer rounded-full border-2 border-white shadow ring-1 ring-zinc-200 dark:border-zinc-900 dark:ring-zinc-700 sm:h-5 sm:w-5" style={{ backgroundColor: color.hex }} title={`Escolher cor de ${disciplina.nome}`} data-no-touch-drag>
                      <input
                        type="color"
                        value={color.hex}
                        onChange={(event) => updateDisciplineColor(disciplina, event.target.value)}
                        onClick={(event) => event.stopPropagation()}
                        className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                        aria-label={`Escolher cor de ${disciplina.nome}`}
                      />
                    </label>
                    <span className="min-w-0 flex-1 text-left">
                      <span className="block line-clamp-2 text-[7px] font-black uppercase leading-tight tracking-normal text-zinc-700 dark:text-zinc-200 sm:text-[9px] sm:tracking-wide lg:text-[10px]">
                        {disciplina.nome}
                      </span>
                      <span className="mt-0.5 hidden truncate text-[9px] font-bold uppercase tracking-widest text-zinc-400 sm:block">
                        Clique para adicionar
                      </span>
                    </span>
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        addSlot(disciplina);
                      }}
                      className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-white text-red-600 dark:bg-zinc-950 sm:h-7 sm:w-7 sm:rounded-xl"
                      aria-label={`Adicionar ${disciplina.nome}`}
                      data-no-touch-drag
                    >
                      <Plus size={11} className="sm:h-[13px] sm:w-[13px]" />
                    </button>
                  </div>
                );
              })}
            </div>
              </aside>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
