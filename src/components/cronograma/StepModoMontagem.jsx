import React, { useMemo, useState } from 'react';
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
} from 'lucide-react';
import { getDisciplineColorForSlot } from '../../utils/disciplineColors';

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

const gradeToHorarios = (grade) => {
  const next = {};
  DIAS.forEach((dia) => {
    const minutos = (grade?.[dia.idx] || []).reduce((acc, slot) => acc + Number(slot.minutos || 0), 0);
    next[dia.idx] = Math.round((minutos / 60) * 100) / 100;
  });
  return next;
};

const normalizeSlotMinutes = (value, fallback = 60) => {
  const minutes = Number(value);
  if (!Number.isFinite(minutes)) return fallback;
  return Math.max(15, Math.min(240, Math.round(minutes / 15) * 15));
};

const minutesToHours = (minutes) => {
  const value = Number(minutes || 0) / 60;
  return Number.isInteger(value) ? String(value) : String(Math.round(value * 100) / 100);
};

const hoursToMinutes = (hours, fallback) => {
  const value = Number(String(hours).replace(',', '.'));
  if (!Number.isFinite(value)) return fallback;
  return normalizeSlotMinutes(value * 60, fallback);
};

const SlotCard = ({ slot, onRemove, onMinutesChange }) => {
  const color = getDisciplineColorForSlot(slot);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="group relative min-h-[76px] overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md dark:border-zinc-800 dark:bg-zinc-950 sm:min-h-[88px]"
    >
      <div className="absolute bottom-0 left-0 top-0 w-1 sm:w-1.5" style={{ backgroundColor: color.hex }} />
      <div className="flex h-full flex-col gap-2 px-2 py-2 pl-3 sm:px-2.5 sm:py-2.5 sm:pl-3.5">
        <div className="flex items-start justify-between gap-1.5">
          <div className="min-w-0 flex-1">
            <div className="mb-1 flex items-center gap-2">
              <span className="h-2.5 w-2.5 shrink-0 rounded-full shadow-sm" style={{ backgroundColor: color.hex }} />
              <h4 className="truncate text-[10px] font-black uppercase tracking-normal text-zinc-900 dark:text-white sm:text-[11px]">
                {slot.disciplinaNome}
              </h4>
            </div>
            <p className="line-clamp-2 text-[9px] font-semibold leading-snug text-zinc-500 dark:text-zinc-400 sm:text-[10px]">
              Ajuste a carga deste bloco em horas.
            </p>
          </div>
          <button
            type="button"
            onClick={onRemove}
            className="rounded-lg p-1 text-zinc-300 transition-colors hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/30"
            aria-label="Remover bloco"
          >
            <Trash2 size={13} />
          </button>
        </div>

        <label className="mt-auto flex items-center justify-between gap-1.5 rounded-xl border border-zinc-200 bg-zinc-50 px-2 py-1.5 dark:border-zinc-800 dark:bg-zinc-900">
          <span className="flex items-center gap-1 text-[8px] font-black uppercase tracking-wide text-zinc-400 sm:text-[9px]">
            <Clock size={11} /> Horas
          </span>
          <span className="flex items-center gap-1">
            <input
              type="number"
              min="0.25"
              max="4"
              step="0.25"
              value={minutesToHours(slot.minutos)}
              onChange={(event) => onMinutesChange(hoursToMinutes(event.target.value, slot.minutos))}
              className="h-7 w-12 rounded-lg border border-zinc-200 bg-white px-1 text-center text-[10px] font-black text-zinc-700 outline-none focus:border-red-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-200 sm:w-14 sm:text-[11px]"
              aria-label={`Horas para ${slot.disciplinaNome}`}
            />
            <span className="text-[9px] font-black text-zinc-400">h</span>
          </span>
        </label>
      </div>
    </motion.div>
  );
};

const DayColumn = ({
  dia,
  slots,
  selected,
  onSelect,
  onDropDisciplina,
  onRemoveSlot,
  onUpdateSlotTime,
}) => {
  const minutosDia = slots.reduce((acc, slot) => acc + Number(slot.minutos || 0), 0);
  const hoje = getHoje();
  const offset = (dia.idx - hoje.getDay() + 7) % 7;
  const isHoje = offset === 0;

  return (
    <div
      onDragOver={(event) => event.preventDefault()}
      onDrop={(event) => onDropDisciplina(event, dia.idx)}
      className={`relative flex min-h-[250px] min-w-0 flex-col rounded-[16px] border p-1.5 transition-all duration-300 sm:min-h-[360px] sm:rounded-[18px] lg:min-h-[470px] xl:min-h-[520px] ${
        selected || isHoje
          ? 'border-red-500/60 bg-white/70 shadow-md ring-1 ring-red-500/30 dark:bg-zinc-950/40'
          : 'border-zinc-200 bg-zinc-50/70 shadow-sm hover:border-zinc-300 dark:border-zinc-800 dark:bg-zinc-950/30 dark:hover:border-zinc-700'
      }`}
    >
      {(selected || isHoje) && <div className="absolute -left-1 top-0 bottom-0 w-1.5 rounded-l-2xl bg-red-600" />}

      <button
        type="button"
        onClick={() => onSelect(dia.idx)}
        className={`mb-2 shrink-0 rounded-xl border px-2.5 py-2 text-left shadow-sm transition-all duration-300 sm:mb-3 sm:rounded-2xl sm:px-3 sm:py-2.5 ${
          selected || isHoje
            ? 'border-red-500/60 bg-zinc-950 text-white dark:border-red-500/40 dark:bg-zinc-900'
            : 'border-zinc-800 bg-zinc-900 text-white dark:border-zinc-800 dark:bg-zinc-900'
        }`}
      >
        <span className="flex items-center justify-between gap-2">
          <span className="min-w-0">
            <span className="block truncate text-sm font-black uppercase leading-none tracking-tight text-white sm:text-base">
              <span className="sm:hidden">{dia.curto}</span>
              <span className="hidden sm:inline">{dia.longo}</span>
            </span>
          </span>
          <span className="shrink-0 rounded-lg border border-white/10 bg-white/10 px-1.5 py-1 text-white sm:px-2">
              <span className="flex items-center gap-1">
                <Clock size={12} className={selected || isHoje ? 'text-white' : 'text-zinc-300'} />
                <span className="text-[10px] font-black tabular-nums text-white sm:text-[11px]">{fmtMin(minutosDia)}</span>
            </span>
          </span>
        </span>
      </button>

      <div className="flex flex-1 flex-col gap-2 sm:gap-3">
        {slots.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center rounded-2xl border-2 border-dashed border-zinc-200 px-2 py-8 text-center opacity-40 dark:border-zinc-800 sm:rounded-3xl sm:px-3 sm:py-16">
            <div>
              <Moon size={20} className="mx-auto mb-2 text-zinc-400 sm:h-6 sm:w-6" />
              <p className="text-[8px] font-black uppercase tracking-widest text-zinc-400 sm:text-[10px]">
                Solte aqui
              </p>
            </div>
          </div>
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
}) {
  const [diaSelecionado, setDiaSelecionado] = useState(1);
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
    (acc, slots) => acc + (Array.isArray(slots) ? slots.reduce((sum, slot) => sum + Number(slot.minutos || 0), 0) : 0),
    0,
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

  return (
    <div className="flex h-full w-full flex-col overflow-hidden">
      {modo !== 'personalizado' && (
        <motion.div
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          className="mx-auto mb-6 max-w-2xl px-4 text-center"
        >
          <h2 className="mb-3 text-3xl font-black uppercase leading-none tracking-tight text-zinc-900 dark:text-white sm:text-4xl">
            Como montar<br /><span className="text-red-600">sua semana?</span>
          </h2>
          <p className="mx-auto max-w-lg text-sm font-medium leading-relaxed text-zinc-500 dark:text-zinc-400">
            Use a distribuicao automatica ou arraste cada disciplina para montar uma agenda manual.
          </p>
        </motion.div>
      )}

      {modo !== 'personalizado' && (
        <div className="grid gap-3 px-1 sm:grid-cols-2 sm:px-4">
          {[
            { id: 'inteligente', title: 'Distribuicao automatica', desc: 'O sistema equilibra disciplinas, revisoes e carga semanal.', icon: Wand2 },
            { id: 'personalizado', title: 'Montagem personalizada', desc: 'Voce arrasta disciplinas para uma semana vazia e controla os blocos.', icon: CalendarDays },
          ].map((option) => {
            const Icon = option.icon;
            const active = modo === option.id;
            return (
              <button
                key={option.id}
                type="button"
                onClick={() => setModo(option.id)}
                className={`relative flex min-h-[104px] items-start gap-3 overflow-hidden rounded-2xl border p-4 text-left transition-all ${
                  active
                    ? 'border-red-400 bg-red-50/70 shadow-lg shadow-red-600/10 dark:border-red-900/60 dark:bg-red-950/20'
                    : 'border-zinc-200 bg-white hover:border-zinc-300 dark:border-zinc-800 dark:bg-zinc-900/70 dark:hover:border-zinc-700'
                }`}
              >
                <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ${active ? 'bg-red-600 text-white' : 'bg-zinc-100 text-zinc-400 dark:bg-zinc-800'}`}>
                  <Icon size={19} />
                </span>
                <span className="min-w-0">
                  <span className={`block text-xs font-black uppercase tracking-widest ${active ? 'text-red-700 dark:text-red-300' : 'text-zinc-800 dark:text-white'}`}>
                    {option.title}
                  </span>
                  <span className="mt-1 block text-xs font-semibold leading-relaxed text-zinc-500 dark:text-zinc-400">
                    {option.desc}
                  </span>
                </span>
                {active && <CheckCircle2 size={17} className="absolute right-3 top-3 text-red-600 dark:text-red-300" />}
              </button>
            );
          })}
        </div>
      )}

      {modo === 'personalizado' && (
        <div className="grid min-h-0 flex-1 gap-2 overflow-y-auto px-0 pb-8 custom-scrollbar lg:grid-cols-[minmax(0,1fr)_240px] xl:grid-cols-[minmax(0,1fr)_260px] sm:px-2">
          <section className="order-2 flex min-h-[520px] min-w-0 flex-col lg:order-1">
            <div className="mb-4 flex flex-col gap-3 px-0 sm:flex-row sm:items-end sm:justify-between">
              <div className="min-w-0">
                <p className="text-[10px] font-black uppercase tracking-[0.22em] text-red-600 dark:text-red-400">Preview semanal</p>
                <h3 className="mt-1 text-2xl font-black uppercase tracking-tight text-zinc-900 dark:text-white">Cronograma vazio</h3>
                <p className="mt-1 text-xs font-semibold text-zinc-500 dark:text-zinc-400">
                  Toque numa disciplina para adicionar ao dia selecionado, arraste para outro dia e ajuste cada bloco em horas de 15 em 15 minutos. {totalBlocos} blocos, {fmtMin(totalMinutos)} por semana.
                </p>
              </div>
              <div className="flex items-center gap-2 rounded-2xl border border-zinc-200 bg-zinc-50 px-3 py-2 dark:border-zinc-800 dark:bg-zinc-900">
                <CalendarDays size={15} className="text-red-500" />
                <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500 dark:text-zinc-400">
                  Semana personalizada
                </span>
              </div>
            </div>

            <div className="grid flex-1 grid-cols-2 gap-2 px-0 pb-6 sm:gap-2 lg:grid-cols-7 xl:gap-2">
              {DIAS.map((dia) => (
                <DayColumn
                  key={dia.idx}
                  dia={dia}
                  slots={grade[dia.idx] || []}
                  selected={diaSelecionado === dia.idx}
                  onSelect={setDiaSelecionado}
                  onDropDisciplina={handleDropDisciplina}
                  onRemoveSlot={removeSlot}
                  onUpdateSlotTime={updateSlotTime}
                />
              ))}
            </div>
          </section>

          <aside className="order-1 rounded-[22px] border border-zinc-200 bg-white p-3 shadow-sm dark:border-zinc-800 dark:bg-zinc-950/60 lg:sticky lg:top-4 lg:order-2 lg:self-start lg:rounded-[28px] lg:p-4">
            <div className="mb-3 flex items-center gap-3 border-b border-zinc-100 pb-3 dark:border-zinc-800 lg:mb-4 lg:pb-4">
              <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-zinc-100 text-zinc-500 dark:bg-zinc-900 lg:h-10 lg:w-10">
                <Layers size={18} />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] font-black uppercase tracking-[0.22em] text-zinc-400">Disciplinas</p>
                <p className="truncate text-xs font-semibold text-zinc-500 dark:text-zinc-400">
                  Escolha cor, toque para adicionar ou arraste para {DIAS.find((dia) => dia.idx === diaSelecionado)?.longo}.
                </p>
              </div>
            </div>

            <div className="grid max-h-[220px] grid-cols-1 gap-2 overflow-y-auto pr-1 custom-scrollbar sm:grid-cols-2 lg:max-h-[560px] lg:grid-cols-1">
              {disciplinasDisponiveis.map((disciplina) => {
                const color = getDisciplineColorForSlot({
                  disciplinaId: disciplina.id,
                  disciplinaNome: disciplina.nome,
                  cor: disciplina.cor,
                });
                return (
                  <div
                    key={disciplina.id || disciplina.nome}
                    draggable
                    onDragStart={(event) => handleDragStartDisciplina(event, disciplina)}
                    className="flex w-full cursor-grab items-center gap-2 rounded-2xl border border-zinc-200 bg-zinc-50 px-2.5 py-2 text-left transition hover:border-red-300 hover:bg-red-50/50 active:cursor-grabbing dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-red-900/50 dark:hover:bg-red-950/10 lg:gap-3 lg:px-3 lg:py-2.5"
                  >
                    <GripVertical size={14} className="shrink-0 text-zinc-300" />
                    <label className="relative h-5 w-5 shrink-0 cursor-pointer rounded-full border-2 border-white shadow ring-1 ring-zinc-200 dark:border-zinc-900 dark:ring-zinc-700" style={{ backgroundColor: color.hex }} title={`Escolher cor de ${disciplina.nome}`}>
                      <input
                        type="color"
                        value={color.hex}
                        onChange={(event) => updateDisciplineColor(disciplina, event.target.value)}
                        onClick={(event) => event.stopPropagation()}
                        className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                        aria-label={`Escolher cor de ${disciplina.nome}`}
                      />
                    </label>
                    <button
                      type="button"
                      onClick={() => addSlot(disciplina)}
                      className="min-w-0 flex-1 text-left"
                    >
                      <span className="block truncate text-[10px] font-black uppercase tracking-wide text-zinc-700 dark:text-zinc-200 lg:text-[11px]">
                        {disciplina.nome}
                      </span>
                      <span className="mt-0.5 block truncate text-[9px] font-bold uppercase tracking-widest text-zinc-400">
                        Clique para adicionar
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => addSlot(disciplina)}
                      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-xl bg-white text-red-600 dark:bg-zinc-950"
                      aria-label={`Adicionar ${disciplina.nome}`}
                    >
                      <Plus size={14} />
                    </button>
                  </div>
                );
              })}
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}
