import React, { useEffect, useMemo, useRef, useState } from 'react';
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
import { getBrasiliaToday } from '../../utils/planningDates';

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

const getHoje = () => getBrasiliaToday();

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

const GLOBAL_SLIDER_CSS = `
  .montagem-time-slider::-webkit-slider-thumb {
    -webkit-appearance: none; appearance: none;
    width: 15px; height: 15px; border-radius: 50%;
    background: #09090b; border: 2px solid #ffffff;
    box-shadow: 0 1px 4px rgba(9,9,11,0.28); cursor: ew-resize;
    margin-top: -4.5px;
  }
  .montagem-time-slider::-webkit-slider-runnable-track {
    width: 100%; height: 6px; border: 0; border-radius: 999px; background: transparent;
  }
  .montagem-time-slider::-moz-range-thumb {
    width: 15px; height: 15px; border-radius: 50%;
    background: #09090b; border: 2px solid #ffffff;
    box-shadow: 0 1px 4px rgba(9,9,11,0.28); cursor: ew-resize;
  }
  .montagem-time-slider::-moz-range-track {
    width: 100%; height: 6px; border: 0; border-radius: 999px; background: transparent;
  }
  .montagem-time-slider::-moz-focus-outer { border: 0; }
  .montagem-time-slider {
    -webkit-appearance: none; appearance: none;
    width: 100%; height: 24px;
    border: 0; border-radius: 0; background: transparent;
    outline: none; box-shadow: none;
  }
`;

const SlotCard = React.memo(({
  slot,
  diaIdx,
  revisionTopics = [],
  hasPendingTopics = true,
  onRemove,
  onMinutesChange,
  onRevisionTopicChange,
  onDropOnSlot,
  onTouchDragStart,
}) => {
  const color = getDisciplineColorForSlot(slot);
  const cardStyle = getDisciplineCardVars(color);
  const slotMinutos = getSlotMinutes(slot, 60);
  const [localMinutos, setLocalMinutos] = useState(slotMinutos);
  const [canDrag, setCanDrag] = useState(true);

  useEffect(() => {
    setLocalMinutos(slotMinutos);
  }, [slotMinutos]);

  const percent = Math.min(100, (localMinutos / 720) * 100);

  const handleSliderChange = (event) => {
    const nextVal = normalizeSlotMinutes(event.target.value, localMinutos);
    setLocalMinutos(nextVal);
    onMinutesChange(nextVal);
  };

  return (
    <div
      data-slot-id={slot.id}
      draggable={canDrag}
      onDragStart={(event) => {
        if (!canDrag || event.target.closest?.('input, button, label, [data-no-drag]')) {
          event.preventDefault();
          event.stopPropagation();
          return false;
        }
        event.stopPropagation();
        event.dataTransfer.effectAllowed = 'move';
        event.dataTransfer.setData('application/json', JSON.stringify({
          type: 'move_slot',
          fromDia: diaIdx,
          slotId: slot.id,
          slot,
        }));
      }}
      onPointerDown={(event) => {
        if (!canDrag || event.target?.closest?.('input, button, label, [data-no-drag]')) {
          return;
        }
        onTouchDragStart?.(event, {
          type: 'move_slot',
          fromDia: diaIdx,
          slotId: slot.id,
          slot,
        });
      }}
      onDragOver={(event) => {
        event.preventDefault();
        event.stopPropagation();
      }}
      onDrop={(event) => {
        event.preventDefault();
        event.stopPropagation();
        onDropOnSlot?.(event, diaIdx, slot.id);
      }}
      onClick={(event) => event.stopPropagation()}
      style={cardStyle}
      className={`discipline-tinted-card group relative min-h-[74px] ${canDrag ? 'cursor-grab active:cursor-grabbing' : 'cursor-default'} overflow-hidden rounded-2xl border shadow-sm transition-all hover:-translate-y-0.5 dark:border-zinc-800 ${color.text}`}
    >
      <div className="flex h-full flex-col gap-2 px-3 py-2 pr-9 sm:px-3 sm:pr-9">
        <div
          className="flex min-w-0 flex-col gap-0.5 cursor-grab active:cursor-grabbing"
          onMouseEnter={() => setCanDrag(true)}
        >
          <div className="flex min-w-0 items-center gap-1.5 sm:gap-2">
            <GripVertical size={13} className="shrink-0 text-zinc-400 opacity-60 group-hover:opacity-100" />
            <span className="h-2.5 w-2.5 shrink-0 rounded-full shadow-sm ring-1 ring-white/50" style={{ backgroundColor: color.hex }} />
            <h4 className={`min-w-0 flex-1 line-clamp-2 text-[8.5px] font-black uppercase leading-tight tracking-normal sm:text-[10px] ${color.text}`}>
              {slot.disciplinaNome}
            </h4>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-fit rounded-md bg-white/80 px-2 py-0.5 text-[11px] font-black leading-none tracking-tight text-zinc-800 tabular-nums shadow-xs dark:bg-card-dark/70 dark:text-zinc-100 sm:text-sm">
              {fmtMin(localMinutos)}
            </span>
          </div>
          {revisionTopics.length > 0 && (
            <select
              value={slot.tipoSlot === 'revisao_concluida' ? slot.assunto || '' : ''}
              onChange={(event) => onRevisionTopicChange?.(event.target.value)}
              onClick={(event) => event.stopPropagation()}
              className="mt-1 w-full rounded-lg border border-blue-200 bg-white px-2 py-1 text-[10px] font-semibold text-blue-800 dark:border-blue-900 dark:bg-zinc-900 dark:text-blue-200"
              aria-label={`Escolher assunto concluido para revisao em ${slot.disciplinaNome}`}
              data-no-drag
            >
              <option value="" disabled={!hasPendingTopics}>Teoria pendente</option>
              {revisionTopics.map((topic) => <option key={topic} value={topic}>Revisao: {topic}</option>)}
            </select>
          )}
        </div>

        <button
          type="button"
          onMouseEnter={() => setCanDrag(false)}
          onMouseLeave={() => setCanDrag(true)}
          onClick={(event) => {
            event.stopPropagation();
            onRemove();
          }}
          className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-lg border border-zinc-200 bg-white/95 text-zinc-500 shadow-sm transition-colors hover:border-red-200 hover:bg-red-50 hover:text-red-600 dark:border-zinc-700 dark:bg-card-dark/95 dark:text-zinc-300 dark:hover:border-red-900/60 dark:hover:bg-red-950/30 dark:hover:text-red-300 sm:top-1/2 sm:-translate-y-1/2"
          aria-label="Remover bloco"
          data-no-drag
          data-no-touch-drag
        >
          <Trash2 size={12} />
        </button>

        {/* Time slider area - exact implementation pattern from Step 2 / Step 3 */}
        <div
          className="relative flex h-6 w-full items-center"
          data-no-drag
          data-no-touch-drag
          onMouseEnter={() => setCanDrag(false)}
          onMouseLeave={() => setCanDrag(true)}
          onMouseDown={(e) => { e.stopPropagation(); setCanDrag(false); }}
          onPointerDown={(e) => { e.stopPropagation(); setCanDrag(false); }}
          onTouchStart={(e) => { e.stopPropagation(); setCanDrag(false); }}
        >
          <div className="pointer-events-none absolute inset-x-0 h-1.5 overflow-hidden rounded-full bg-zinc-200/90 shadow-inner dark:bg-zinc-700/80">
            <div
              className="h-full rounded-full bg-zinc-950 dark:bg-white"
              style={{ width: `${percent}%`, transition: 'width 0.05s ease-out' }}
            />
          </div>
          <input
            type="range"
            min="15"
            max="720"
            step="15"
            value={localMinutos}
            onPointerDown={() => setCanDrag(false)}
            onPointerUp={() => setCanDrag(true)}
            onPointerCancel={() => setCanDrag(true)}
            onFocus={() => setCanDrag(false)}
            onBlur={() => setCanDrag(true)}
            onChange={handleSliderChange}
            style={{ '--planning-level-color': '#09090b' }}
            className="planning-level-range absolute inset-x-0 z-10 m-0 h-6 w-full cursor-pointer bg-transparent"
            aria-label={`Tempo de estudo para ${slot.disciplinaNome}`}
          />
        </div>
      </div>
    </div>
  );
});

const DayColumn = React.memo(({
  dia,
  slots,
  selected,
  selectedDisciplina,
  isHoveredDrop,
  onSelect,
  onDropDisciplina,
  onRemoveSlot,
  onUpdateSlotTime,
  onRevisionTopicChange,
  onTouchDragStart,
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
        isHoveredDrop
          ? 'border-red-500 bg-red-50/70 shadow-lg ring-2 ring-red-500/50 scale-[1.01] dark:border-red-500 dark:bg-red-950/30 dark:ring-red-500/40'
          : selected || isHoje
            ? 'border-zinc-300 bg-white/80 shadow-md ring-1 ring-zinc-300/70 dark:border-zinc-700 dark:bg-card-dark dark:ring-zinc-700/60'
            : 'border-zinc-200 bg-zinc-50/70 shadow-sm hover:border-zinc-300 dark:border-zinc-800 dark:bg-card-dark dark:hover:border-zinc-700'
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
          activateDay(true);
        }}
        className={`mb-1.5 flex h-7 shrink-0 items-center justify-center gap-1 rounded-xl border text-[7px] font-black uppercase tracking-[0.08em] shadow-sm transition sm:mb-2 sm:h-9 sm:gap-1.5 sm:text-[9px] sm:tracking-widest ${
          selectedDisciplina
            ? 'border-red-400 bg-red-500 text-white shadow-red-500/20 hover:bg-red-600 animate-pulse'
            : 'border-zinc-200 bg-white text-zinc-500 hover:border-red-200 hover:bg-red-50 hover:text-red-600 dark:border-zinc-800 dark:bg-card-dark dark:text-zinc-400 dark:hover:border-red-900/60 dark:hover:bg-red-950/20'
        }`}
      >
        <Plus size={13} />
        {selectedDisciplina ? `Adicionar ${selectedDisciplina.nome}` : 'Escolher disciplina'}
      </button>

      {pickerOpen && (
        <div
          className="mb-2 shrink-0 overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-lg shadow-zinc-950/10 dark:border-zinc-800 dark:bg-card-dark"
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
            className={`flex flex-1 flex-col items-center justify-center rounded-2xl border-2 border-dashed px-2 py-8 text-center transition sm:rounded-3xl sm:px-3 sm:py-16 ${
              isHoveredDrop
                ? 'border-red-500 bg-red-100/50 opacity-100 dark:border-red-400 dark:bg-red-950/40'
                : 'border-zinc-200 opacity-45 hover:border-red-200 hover:opacity-100 dark:border-zinc-800 dark:hover:border-red-900/60'
            }`}
          >
            <div>
              <Moon size={20} className="mx-auto mb-2 text-zinc-400 sm:h-6 sm:w-6" />
              <p className="text-[8px] font-black uppercase tracking-widest text-zinc-400 sm:text-[10px]">
                {isHoveredDrop ? 'Solte para adicionar' : 'Solte aqui'}
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
              diaIdx={dia.idx}
              revisionTopics={disciplinasDisponiveis.find((disciplina) => disciplina.id === slot.disciplinaId)?.assuntosConcluidosAntesTransformacao || []}
              hasPendingTopics={!disciplinasDisponiveis.find((disciplina) => disciplina.id === slot.disciplinaId)?.semAssuntosPendentes}
              onRemove={() => onRemoveSlot(dia.idx, slot.id)}
              onMinutesChange={(minutes) => onUpdateSlotTime(dia.idx, slot.id, minutes)}
              onRevisionTopicChange={(topic) => onRevisionTopicChange(dia.idx, slot.id, topic)}
              onDropOnSlot={onDropDisciplina}
              onTouchDragStart={onTouchDragStart}
            />
          ))
        )}
      </div>
    </div>
  );
});

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
  const [touchDrag, setTouchDrag] = useState({
    active: false,
    item: null,
    x: 0,
    y: 0,
    hoveredDayIdx: null,
    hoveredSlotId: null,
  });

  const weekScrollRef = useRef(null);
  const dragScrollRef = useRef({ active: false, startX: 0, scrollLeft: 0, pointerId: null, moved: false });
  const ignoreNextClickRef = useRef(false);

  const modo = config.modoMontagem || 'inteligente';
  const grade = config.gradePersonalizada || {};
  const disciplinaCores = useMemo(
    () => config.disciplinaCoresPersonalizadas || {},
    [config.disciplinaCoresPersonalizadas],
  );
  const disciplinasDisponiveis = useMemo(() => (
    [...disciplinas, ...extraDisciplinas].map((disciplina) => ({
      ...disciplina,
      assuntosConcluidosAntesTransformacao: (disciplina.assuntosConcluidosAntesTransformacao || [])
        .filter((topic) => !(config.revisoesHerdadas || []).some((review) =>
          review.disciplinaId === disciplina.id
          && String(review.assunto || '').trim().toLowerCase() === String(topic).trim().toLowerCase())),
      cor: disciplinaCores[disciplina.id] || disciplina.cor || null,
    }))
  ), [disciplinas, extraDisciplinas, disciplinaCores, config.revisoesHerdadas]);
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
        conhecimentoNivel: Number(selecao[disciplina.id]?.conhecimentoNivel) || 0,
        importanciaNivel: Number(selecao[disciplina.id]?.importanciaNivel) || 0,
      },
    });
  };

  const addSlot = (disciplina, diaIdx = diaSelecionado, targetSlotId = null) => {
    if (!disciplina) return;
    const completedTopics = disciplina.assuntosConcluidosAntesTransformacao || [];
    if (disciplina.semAssuntosPendentes && completedTopics.length === 0) return;
    const defaultReviewTopic = disciplina.semAssuntosPendentes ? completedTopics[0] : null;
    const slot = {
      id: `custom-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      disciplinaId: disciplina.id,
      disciplinaNome: disciplina.nome,
      cor: disciplinaCores[disciplina.id] || disciplina.cor || null,
      minutos: normalizeSlotMinutes(config.tempoSessaoMinutos || 60),
      ...(defaultReviewTopic ? { assunto: defaultReviewTopic, tipoSlot: 'revisao_concluida' } : {}),
    };
    ensureSelected(disciplina);
    const targetList = [...(grade[diaIdx] || [])];
    if (targetSlotId) {
      const targetIdx = targetList.findIndex((s) => s.id === targetSlotId);
      if (targetIdx >= 0) {
        targetList.splice(targetIdx, 0, slot);
      } else {
        targetList.push(slot);
      }
    } else {
      targetList.push(slot);
    }
    updateGrade({
      ...grade,
      [diaIdx]: targetList,
    });
    setDisciplinaToqueId(null);
  };

  const moveSlot = (fromDiaIdx, targetDiaIdx, slot, targetSlotId = null) => {
    if (!slot) return;
    const currentGrade = { ...grade };
    const fromList = [...(currentGrade[fromDiaIdx] || [])];
    const slotIdx = fromList.findIndex((s) => s.id === slot.id);
    if (slotIdx >= 0) {
      fromList.splice(slotIdx, 1);
    }

    let targetList;
    if (fromDiaIdx === targetDiaIdx) {
      targetList = fromList;
    } else {
      targetList = [...(currentGrade[targetDiaIdx] || [])];
    }

    if (targetSlotId) {
      const targetIdx = targetList.findIndex((s) => s.id === targetSlotId);
      if (targetIdx >= 0) {
        targetList.splice(targetIdx, 0, slot);
      } else {
        targetList.push(slot);
      }
    } else {
      targetList.push(slot);
    }

    const nextGrade = {
      ...currentGrade,
      [fromDiaIdx]: fromList,
      [targetDiaIdx]: targetList,
    };
    setDiaSelecionado(targetDiaIdx);
    updateGrade(nextGrade);
  };

  const handleDragStartDisciplina = (event, disciplina) => {
    event.dataTransfer.effectAllowed = 'copy';
    event.dataTransfer.setData('application/json', JSON.stringify({
      disciplinaId: disciplina.id,
      disciplinaNome: disciplina.nome,
    }));
  };

  const handleDropDisciplina = (event, diaIdx, targetSlotId = null) => {
    event.preventDefault();
    const payload = event.dataTransfer.getData('application/json');
    if (!payload) return;
    try {
      const data = JSON.parse(payload);
      if (data.type === 'move_slot' && data.slot) {
        moveSlot(data.fromDia, diaIdx, data.slot, targetSlotId);
        return;
      }
      const disciplina = disciplinasDisponiveis.find((item) => item.id === data.disciplinaId || item.nome === data.disciplinaNome);
      if (disciplina) {
        setDiaSelecionado(diaIdx);
        addSlot(disciplina, diaIdx, targetSlotId);
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

  const updateRevisionTopic = (diaIdx, slotId, topic) => {
    updateGrade({
      ...grade,
      [diaIdx]: (grade[diaIdx] || []).map((slot) => slot.id === slotId
        ? { ...slot, assunto: topic || null, tipoSlot: topic ? 'revisao_concluida' : 'teoria' }
        : slot),
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
    if (event.pointerType !== 'mouse') return;
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

  const selectDisciplinaForTouch = (disciplina) => {
    if (!disciplina?.id) return;
    setDisciplinaToqueId((prev) => (String(prev) === String(disciplina.id) ? null : disciplina.id));
    setDiaSelecionado((diaAtual) => diaAtual ?? 1);
    ensureSelected(disciplina);
  };

  const handleDisciplinaClick = (disciplina) => {
    if (ignoreNextClickRef.current) {
      ignoreNextClickRef.current = false;
      return;
    }
    selectDisciplinaForTouch(disciplina);
  };

  // Touch & Pointer Drag Engine for Tablet and Touch Devices
  const handleUniversalPointerDown = (event, item) => {
    if (event.target?.closest?.('input, button, label, [data-no-touch-drag]')) return;

    const startX = event.clientX;
    const startY = event.clientY;
    let isDragging = false;

    const onPointerMove = (moveEvent) => {
      const deltaX = moveEvent.clientX - startX;
      const deltaY = moveEvent.clientY - startY;
      const distance = Math.hypot(deltaX, deltaY);

      if (!isDragging && distance > 6) {
        isDragging = true;
      }

      if (isDragging) {
        moveEvent.preventDefault();

        // Query drop targets under pointer
        const elements = document.elementsFromPoint(moveEvent.clientX, moveEvent.clientY) || [];
        let hoveredDayIdx = null;
        let hoveredSlotId = null;

        for (const el of elements) {
          if (!hoveredSlotId) {
            const slotEl = el.closest?.('[data-slot-id]');
            if (slotEl?.dataset?.slotId) {
              hoveredSlotId = slotEl.dataset.slotId;
            }
          }
          const dayDropEl = el.closest?.('[data-day-drop]');
          if (dayDropEl && dayDropEl.dataset.dayIdx !== undefined) {
            const parsed = Number(dayDropEl.dataset.dayIdx);
            if (Number.isFinite(parsed)) {
              hoveredDayIdx = parsed;
              break;
            }
          }
        }

        // Auto-scroll horizontally if near edge of week container
        if (weekScrollRef.current) {
          const bounds = weekScrollRef.current.getBoundingClientRect();
          const threshold = 60;
          if (moveEvent.clientX < bounds.left + threshold) {
            weekScrollRef.current.scrollLeft -= 10;
          } else if (moveEvent.clientX > bounds.right - threshold) {
            weekScrollRef.current.scrollLeft += 10;
          }
        }

        setTouchDrag({
          active: true,
          item,
          x: moveEvent.clientX,
          y: moveEvent.clientY,
          hoveredDayIdx,
          hoveredSlotId,
        });
      }
    };

    const onPointerUp = (upEvent) => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointercancel', onPointerUp);

      if (isDragging) {
        ignoreNextClickRef.current = true;
        const elements = document.elementsFromPoint(upEvent.clientX, upEvent.clientY) || [];
        let dropDayIdx = null;
        let dropSlotId = null;

        for (const el of elements) {
          if (!dropSlotId) {
            const slotEl = el.closest?.('[data-slot-id]');
            if (slotEl?.dataset?.slotId) {
              dropSlotId = slotEl.dataset.slotId;
            }
          }
          const dayDropEl = el.closest?.('[data-day-drop]');
          if (dayDropEl && dayDropEl.dataset.dayIdx !== undefined) {
            const parsed = Number(dayDropEl.dataset.dayIdx);
            if (Number.isFinite(parsed)) {
              dropDayIdx = parsed;
              break;
            }
          }
        }

        if (dropDayIdx !== null) {
          if (item.type === 'disciplina' && item.disciplina) {
            addSlot(item.disciplina, dropDayIdx, dropSlotId);
            setDiaSelecionado(dropDayIdx);
          } else if (item.type === 'move_slot' && item.slot) {
            moveSlot(item.fromDia, dropDayIdx, item.slot, dropSlotId);
            setDiaSelecionado(dropDayIdx);
          }
        }
      }

      setTouchDrag({
        active: false,
        item: null,
        x: 0,
        y: 0,
        hoveredDayIdx: null,
        hoveredSlotId: null,
      });
    };

    window.addEventListener('pointermove', onPointerMove, { passive: false });
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('pointercancel', onPointerUp);
  };

  return (
    <div className="flex h-full w-full flex-col overflow-hidden">
      <style>{GLOBAL_SLIDER_CSS}</style>
      {/* Floating Drag Avatar for Tablet and Touch Devices */}
      {touchDrag.active && (
        <div
          className="pointer-events-none fixed z-[99999] flex -translate-x-1/2 -translate-y-1/2 items-center gap-2 rounded-2xl border-2 border-red-500 bg-white/95 px-3 py-2 shadow-2xl shadow-zinc-950/30 backdrop-blur-md dark:border-red-400 dark:bg-zinc-900/95"
          style={{ left: touchDrag.x, top: touchDrag.y }}
        >
          <span
            className="h-3.5 w-3.5 shrink-0 rounded-full shadow-sm ring-2 ring-white dark:ring-zinc-900"
            style={{
              backgroundColor:
                touchDrag.item?.type === 'disciplina'
                  ? (disciplinaCores[touchDrag.item.disciplina.id] || touchDrag.item.disciplina.cor || '#ef4444')
                  : (touchDrag.item?.slot?.cor || '#ef4444'),
            }}
          />
          <span className="text-xs font-black uppercase text-zinc-900 dark:text-white">
            {touchDrag.item?.type === 'disciplina'
              ? touchDrag.item.disciplina.nome
              : touchDrag.item?.slot?.disciplinaNome}
          </span>
          {touchDrag.hoveredDayIdx !== null ? (
            <span className="rounded-lg bg-red-600 px-2 py-0.5 text-[10px] font-black uppercase text-white shadow-xs">
              {DIAS[touchDrag.hoveredDayIdx]?.curto}
            </span>
          ) : (
            <span className="rounded-lg bg-zinc-100 px-1.5 py-0.5 text-[9px] font-bold text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
              Solte em um dia
            </span>
          )}
        </div>
      )}

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
              Use a distribuicao automatica ou monte manualmente escolhendo cada dia.
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
                        : 'border-dashed border-zinc-300 bg-zinc-50 hover:border-zinc-400 hover:bg-white hover:shadow-zinc-900/10 dark:border-zinc-700 dark:bg-zinc-800/55 dark:hover:border-zinc-500 dark:hover:bg-zinc-800'
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
                  <div className="inline-flex w-fit items-center gap-1.5 rounded-xl border border-red-100 bg-white px-2.5 py-1.5 shadow-sm dark:border-red-900/40 dark:bg-card-dark sm:gap-2 sm:rounded-2xl sm:px-3.5 sm:py-2.5">
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

            {/* Layout: Sidebar visible on tablets (md) and desktop (lg/xl) */}
            <div className="grid min-h-0 flex-1 gap-3 md:grid-cols-[minmax(0,1fr)_260px] lg:grid-cols-[minmax(0,1fr)_320px] xl:grid-cols-[minmax(0,1fr)_360px]">
              <div
                ref={weekScrollRef}
                onPointerDown={handleWeekPointerDown}
                onPointerMove={handleWeekPointerMove}
                onPointerCancel={stopWeekPointerDrag}
                onPointerUp={stopWeekPointerDrag}
                onClickCapture={handleWeekClickCapture}
                className="min-w-0 flex-1 cursor-grab overflow-x-auto pb-4 select-none custom-scrollbar sm:pb-6"
                style={{ touchAction: 'pan-x pan-y', WebkitOverflowScrolling: 'touch' }}
              >
                <div className="flex min-w-max gap-2 px-0 xl:gap-3">
                  {DIAS.map((dia) => (
                    <DayColumn
                      key={dia.idx}
                      dia={dia}
                      slots={grade[dia.idx] || []}
                      selected={diaSelecionado === dia.idx}
                      selectedDisciplina={disciplinaToque}
                      isHoveredDrop={touchDrag.hoveredDayIdx === dia.idx}
                      onSelect={setDiaSelecionado}
                      onDropDisciplina={handleDropDisciplina}
                      onRemoveSlot={removeSlot}
                      onUpdateSlotTime={updateSlotTime}
                      onRevisionTopicChange={updateRevisionTopic}
                      onTouchDragStart={handleUniversalPointerDown}
                      disciplinasDisponiveis={disciplinasDisponiveis}
                      pickerOpen={pickerDia === dia.idx}
                      onOpenPicker={setPickerDia}
                      onClosePicker={() => setPickerDia(null)}
                      onAddDisciplina={addSlot}
                    />
                  ))}
                </div>
              </div>

              {/* Sidebar with discipline cards and descriptive instructions */}
              <aside className="hidden min-w-0 overflow-hidden rounded-2xl border border-zinc-200 bg-white p-2.5 shadow-sm dark:border-zinc-800 dark:bg-card-dark md:block md:self-start md:rounded-[24px] md:p-3 lg:rounded-[28px] lg:p-4">
                <div className="mb-2.5 flex items-start gap-2.5 border-b border-zinc-100 pb-2.5 dark:border-zinc-800 sm:mb-3 sm:gap-3 sm:pb-3 lg:mb-4 lg:pb-4">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-red-50 text-red-600 dark:bg-red-950/40 dark:text-red-400 sm:h-9 sm:w-9 sm:rounded-2xl lg:h-10 lg:w-10">
                    <Layers size={17} className="sm:h-[18px] sm:w-[18px]" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <p className="text-[8.5px] font-black uppercase tracking-[0.18em] text-zinc-400 sm:text-[10px] sm:tracking-[0.22em]">
                        Disciplinas
                      </p>
                      <span className="rounded-full bg-zinc-100 px-1.5 py-0.2 text-[8px] font-bold text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
                        {disciplinasDisponiveis.length}
                      </span>
                    </div>
                    <p className="mt-0.5 text-[10px] font-semibold leading-tight text-zinc-700 dark:text-zinc-200 sm:text-xs">
                      {disciplinaToque
                        ? `Selecionada: "${disciplinaToque.nome}". Toque em um dia para adicionar.`
                        : 'Arraste a disciplina para o dia desejado ou toque no botão +.'}
                    </p>
                    <p className="mt-1 flex items-center gap-1 text-[8.5px] font-semibold text-zinc-500 dark:text-zinc-400 sm:text-[11px]">
                      <span className="inline-block h-2.5 w-2.5 shrink-0 rounded-full bg-gradient-to-tr from-amber-400 via-red-500 to-indigo-500 shadow-xs" />
                      Você também pode clicar no círculo colorido para alterar a cor da disciplina.
                    </p>
                  </div>
                </div>

                <div className="grid max-h-[300px] min-w-0 grid-cols-1 gap-1.5 overflow-x-hidden overflow-y-auto pr-0.5 custom-scrollbar sm:gap-2 sm:pr-1 md:max-h-[480px] lg:max-h-[560px]">
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
                        onPointerDown={(event) => handleUniversalPointerDown(event, { type: 'disciplina', disciplina })}
                        onClick={() => handleDisciplinaClick(disciplina)}
                        className={`flex min-w-0 w-full cursor-grab items-center gap-2 rounded-xl border px-2 py-1.5 text-left transition select-none active:cursor-grabbing sm:gap-2.5 sm:rounded-2xl sm:px-2.5 sm:py-2 lg:gap-3 lg:px-3 lg:py-2.5 ${
                          activeDisciplina
                            ? 'border-red-400 bg-red-50 ring-2 ring-red-500/40 dark:border-red-900/70 dark:bg-red-950/20'
                            : 'border-zinc-200 bg-zinc-50 hover:border-red-300 hover:bg-red-50/50 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-red-900/50 dark:hover:bg-red-950/10'
                        }`}
                      >
                        <GripVertical size={13} className="shrink-0 text-zinc-300" />
                        <label
                          className="relative h-5 w-5 shrink-0 cursor-pointer rounded-full border-2 border-white shadow-sm ring-1 ring-zinc-300 transition-transform hover:scale-110 active:scale-95 dark:border-zinc-900 dark:ring-zinc-600 sm:h-5.5 sm:w-5.5"
                          style={{ backgroundColor: color.hex }}
                          title={`Clique para alterar a cor de ${disciplina.nome}`}
                          data-no-touch-drag
                          onClick={(event) => event.stopPropagation()}
                        >
                          <input
                            type="color"
                            value={color.hex}
                            onChange={(event) => updateDisciplineColor(disciplina, event.target.value)}
                            onClick={(event) => event.stopPropagation()}
                            className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                            aria-label={`Alterar cor de ${disciplina.nome}`}
                          />
                        </label>
                        <span className="min-w-0 flex-1 text-left">
                          <span className="block line-clamp-2 text-[8px] font-black uppercase leading-tight tracking-normal text-zinc-800 dark:text-zinc-100 sm:text-[9.5px] sm:tracking-wide lg:text-[10.5px]">
                            {disciplina.nome}
                          </span>
                          <span className="mt-0.5 hidden truncate text-[8px] font-bold text-zinc-400 dark:text-zinc-500 sm:block">
                            Arraste para o dia • Toque na cor para mudar
                          </span>
                        </span>
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            addSlot(disciplina);
                          }}
                          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border border-zinc-200 bg-white text-red-600 shadow-xs transition hover:bg-red-50 hover:border-red-200 dark:border-zinc-700 dark:bg-card-dark sm:h-7 sm:w-7 sm:rounded-xl"
                          aria-label={`Adicionar ${disciplina.nome}`}
                          data-no-touch-drag
                        >
                          <Plus size={13} className="sm:h-3.5 sm:w-3.5" />
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
