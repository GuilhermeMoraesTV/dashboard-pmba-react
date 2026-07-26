import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Hash, CalendarDays, CalendarClock, Layers, BookOpen,
  Target, AlertCircle, Info, Clock, Timer, Eye, EyeOff,
  LayoutList, Shuffle, ChevronLeft, ChevronRight, Calendar, Flame
} from 'lucide-react';

// ─── CONSTANTES E AUXILIARES DO CALENDÁRIO ─────────────────────────────────────
const DATE_MONTH_TEXT_CLASS = 'text-[9px]';
const DATE_DAY_TEXT_CLASS = 'text-base';

const parseDateLocal = (dateString) => {
  if (!dateString) return new Date();
  const [year, month, day] = dateString.split('-').map(Number);
  return new Date(year, month - 1, day, 12, 0, 0);
};

// ─── DIAS DA SEMANA ────────────────────────────────────────────────────────────
const DIAS_SEMANA = [
  { idx: 0, curto: 'Dom', longo: 'Domingo' },
  { idx: 1, curto: 'Seg', longo: 'Segunda' },
  { idx: 2, curto: 'Ter', longo: 'Terça'   },
  { idx: 3, curto: 'Qua', longo: 'Quarta'  },
  { idx: 4, curto: 'Qui', longo: 'Quinta'  },
  { idx: 5, curto: 'Sex', longo: 'Sexta'   },
  { idx: 6, curto: 'Sáb', longo: 'Sábado'  },
];

// ─── CUSTOM DATE PICKER (DESIGN REGISTRO ESTUDO MODAL) ──────────────────────
const CustomDatePicker = ({ value, onChange, name, color = 'blue' }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [viewDate, setViewDate] = useState(parseDateLocal(value));
  const containerRef = useRef(null);
  const calendarRef = useRef(null);

  const dateObj = parseDateLocal(value);
  const dayDisplay = dateObj.getDate();
  const monthDisplay = dateObj.toLocaleDateString('pt-BR', { month: 'short' }).toUpperCase().replace('.', '');
  const weekDisplay = dateObj.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '');

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target) &&
        !calendarRef.current?.contains(event.target)
      ) setIsOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const getDaysInMonth = (year, month) => new Date(year, month + 1, 0).getDate();
  const getFirstDayOfMonth = (year, month) => new Date(year, month, 1).getDay();

  const changeMonth = (offset) => {
    const newDate = new Date(viewDate.getFullYear(), viewDate.getMonth() + offset, 1);
    setViewDate(newDate);
  };

  const handleSelectDay = (day) => {
    const year = viewDate.getFullYear();
    const month = String(viewDate.getMonth() + 1).padStart(2, '0');
    const d = String(day).padStart(2, '0');
    const dateStr = `${year}-${month}-${d}`;
    onChange(dateStr);
    setIsOpen(false);
  };

  const renderCalendarGrid = () => {
    const year = viewDate.getFullYear();
    const month = viewDate.getMonth();
    const daysInMonth = getDaysInMonth(year, month);
    const firstDay = getFirstDayOfMonth(year, month);
    const slots = [];
    for (let i = 0; i < firstDay; i++) slots.push(<div key={`empty-${i}`} className="w-8 h-8" />);
    for (let i = 1; i <= daysInMonth; i++) {
      const isSelected = dateObj.getDate() === i && dateObj.getMonth() === month && dateObj.getFullYear() === year;
      slots.push(
        <button
          key={i}
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleSelectDay(i); }}
          className={`w-8 h-8 rounded-full text-[10px] font-bold flex items-center justify-center transition-all ${isSelected ? (color === 'red' ? 'bg-red-600 text-white shadow-md' : 'bg-blue-600 text-white shadow-md') : 'text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800'}`}
        >
          {i}
        </button>
      );
    }
    return slots;
  };

  const colorClass = color === 'red' ? 'text-red-600' : 'text-blue-600';
  const bgColorClass = color === 'red' ? 'bg-red-50 dark:bg-red-900/20' : 'bg-blue-50 dark:bg-blue-900/20';
  const borderActive = color === 'red' ? 'border-red-500' : 'border-blue-500';

  return (
    <div className="relative" ref={containerRef}>
      <div onClick={(e) => { e.stopPropagation(); setIsOpen(!isOpen); }} className="relative group cursor-pointer h-[52px]">
        <div className={`flex h-full bg-zinc-50 dark:bg-zinc-950 border-2 ${isOpen ? borderActive : 'border-transparent'} rounded-2xl overflow-hidden shadow-sm transition-all group-hover:border-zinc-300 dark:group-hover:border-zinc-700`}>
          <div className={`${bgColorClass} w-14 flex flex-col items-center justify-center border-r border-zinc-200 dark:border-zinc-800`}>
            <span className={`${DATE_MONTH_TEXT_CLASS} font-black uppercase ${colorClass}`}>{monthDisplay}</span>
            <span className={`${DATE_DAY_TEXT_CLASS} font-black leading-none text-zinc-900 dark:text-white`}>{dayDisplay}</span>
          </div>
          <div className="flex-1 px-4 flex items-center justify-between">
            <span className="text-[11px] font-black text-zinc-500 dark:text-zinc-400 capitalize tracking-wide">{weekDisplay}</span>
            <Calendar size={16} className="text-zinc-300 group-hover:text-zinc-500 transition-colors" />
          </div>
        </div>
      </div>

      {typeof document !== 'undefined' && createPortal(
        <AnimatePresence>
          {isOpen && (
          <motion.div
            className="fixed inset-0 z-[100059] flex items-center justify-center bg-zinc-950/25 p-3 backdrop-blur-[2px] sm:bg-transparent sm:backdrop-blur-none"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onMouseDown={() => setIsOpen(false)}
          >
          <motion.div
            ref={calendarRef}
            initial={{ opacity: 0, y: 10, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 10, scale: 0.95 }}
            className="w-[min(280px,calc(100vw-24px))] rounded-[24px] border border-zinc-200 bg-white p-5 shadow-2xl dark:border-zinc-800 dark:bg-zinc-900"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center mb-4">
              <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); changeMonth(-1) }} className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl text-zinc-400 transition-colors">
                <ChevronLeft size={18} />
              </button>
              <span className="text-[11px] font-black text-zinc-800 dark:text-white capitalize tracking-widest">
                {viewDate.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}
              </span>
              <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); changeMonth(1) }} className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl text-zinc-400 transition-colors">
                <ChevronRight size={18} />
              </button>
            </div>
            <div className="grid grid-cols-7 gap-1 place-items-center">
              {['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].map((d, i) => <span key={i} className="text-[9px] font-black text-zinc-300 mb-2">{d}</span>)}
              {renderCalendarGrid()}
            </div>
          </motion.div>
          </motion.div>
          )}
        </AnimatePresence>,
        document.body,
      )}
    </div>
  );
};

// ─── TOGGLE SWITCH ────────────────────────────────────────────────────────────
const ToggleSwitch = ({ checked, onChange }) => (
  <label className="relative inline-flex items-center cursor-pointer group">
    <input
      type="checkbox"
      className="sr-only peer"
      checked={checked || false}
      onChange={e => onChange(e.target.checked)}
    />
    <div className="w-11 h-6 bg-zinc-300 dark:bg-zinc-700 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-zinc-400 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-zinc-500 peer-checked:bg-red-600 shadow-inner border border-zinc-400/20" />
  </label>
);

// ─── CARD EDITAL SIDEBAR (MANTIDO) ─────────────────────────────────────────────
const EditalSidebarCard = ({ editalSelecionado }) => (
  <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 shadow-sm flex flex-col items-center text-center relative overflow-hidden">
    <div className="absolute top-0 inset-x-0 h-24 bg-gradient-to-b from-red-50 dark:from-red-900/10 to-transparent pointer-events-none" />
    <span className="relative z-10 inline-block px-2.5 py-1 mb-4 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 text-[9px] font-black uppercase tracking-widest rounded-lg">
      Edital Alvo
    </span>
    <div className="relative z-10 w-28 h-28 shrink-0 rounded-2xl bg-white dark:bg-zinc-800 border-2 border-zinc-100 dark:border-zinc-700 flex items-center justify-center p-2 mb-4 shadow-md">
      {editalSelecionado?.logo || editalSelecionado?.logoUrl ? (
        <img src={editalSelecionado.logo || editalSelecionado.logoUrl} alt="Logo" className="w-full h-full object-contain" />
      ) : <Target size={36} className="text-red-500" />}
    </div>
    <div className="relative z-10 w-full">
      <h3 className="text-base font-black text-zinc-900 dark:text-white uppercase leading-tight line-clamp-2">
        {editalSelecionado?.titulo || editalSelecionado?.nome || 'Cronograma Manual'}
      </h3>
      {editalSelecionado?.cargo && (
        <p className="text-xs font-bold text-zinc-500 dark:text-zinc-400 mt-1.5 line-clamp-1">{editalSelecionado.cargo}</p>
      )}
    </div>
  </div>
);

const EditalMiniCard = ({ editalSelecionado }) => (
  <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-3 shadow-sm flex flex-col items-center text-center justify-center relative overflow-hidden h-full min-h-[120px]">
    <div className="absolute top-0 inset-x-0 h-1 bg-red-500 rounded-t-2xl" />
    <div className="w-16 h-16 shrink-0 rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-100 dark:border-zinc-700 flex items-center justify-center p-1 mb-2 z-10">
      {editalSelecionado?.logo || editalSelecionado?.logoUrl ? (
        <img src={editalSelecionado.logo || editalSelecionado.logoUrl} alt="Logo" className="w-full h-full object-contain" />
      ) : <Target size={20} className="text-red-500" />}
    </div>
    <h3 className="text-[11px] font-black text-zinc-900 dark:text-white uppercase line-clamp-2 leading-tight">
      {editalSelecionado?.titulo || editalSelecionado?.nome || 'Cronograma Manual'}
    </h3>
  </div>
);

// ─── CABEÇALHO (MANTIDO) ──────────────────────────────────────────────────────
const PageHeader = () => (
  <motion.div
    initial={{ opacity: 0, y: -12 }}
    animate={{ opacity: 1, y: 0 }}
    className="text-center mb-3 max-w-2xl mx-auto px-2 shrink-0 sm:mb-8 sm:px-4"
  >
    <h2 className="text-xl sm:text-4xl font-black text-zinc-900 dark:text-white uppercase tracking-tight leading-none mb-1 sm:mb-3">
      Ajuste fino do seu<br /><span className="text-red-600">Plano</span>
    </h2>
    <p className="hidden text-zinc-500 dark:text-zinc-400 text-sm font-medium leading-relaxed max-w-md mx-auto sm:block">
      Defina o nome, datas e como o cronograma vai se comportar no dia a dia.
    </p>
  </motion.div>
);

// ─── SELECTOR DE MODO (REFINADO) ──────────────────────────────────────────────
const ModeSelector = ({ options, value, onChange }) => (
  <div className={`grid gap-2 ${options.length === 3 ? 'grid-cols-3 2xl:grid-cols-3' : 'grid-cols-2 xl:grid-cols-2'}`}>
    {options.map(opt => {
      const active = value === opt.id;
      const Icon = opt.icon;
      return (
        <button
          key={opt.id}
          onClick={() => onChange(opt.id)}
          className={`
            relative flex min-h-[82px] flex-col items-start gap-2 p-2 sm:min-h-0 sm:gap-2.5 sm:p-4 rounded-2xl border-2 text-left
            transition-all duration-300 group overflow-hidden
            ${active
              ? `${opt.activeBorder} ${opt.activeBg} shadow-md scale-[1.02] z-10`
              : 'border-zinc-100 dark:border-zinc-800 bg-white dark:bg-zinc-900/50 hover:border-zinc-200 dark:hover:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800/80'
            }
          `}
        >
          {/* Faixa superior colorida quando ativo */}
          <div className={`absolute top-0 left-0 right-0 h-1 transition-all ${active ? opt.activeBar : 'bg-transparent'}`} />

          <div className="flex items-center gap-2.5 w-full">
            <div className={`w-7 h-7 rounded-xl flex items-center justify-center shrink-0 transition-all shadow-sm sm:h-8 sm:w-8 ${active ? opt.activeIcon : 'bg-zinc-100 dark:bg-zinc-800'}`}>
              <Icon size={14} className={active ? 'text-white' : 'text-zinc-400'} />
            </div>
            <div className="flex flex-col">
              <span className={`text-[10px] font-black uppercase tracking-wider ${active ? opt.activeText : 'text-zinc-500 dark:text-zinc-400'}`}>
                {opt.label}
              </span>
              {active && (
                <div className={`w-fit text-[7px] font-black px-1.5 py-0.5 rounded-full mt-0.5 ${opt.activeBadge}`}>
                  ATIVO
                </div>
              )}
            </div>
          </div>
          <p className={`hidden text-[9px] leading-relaxed font-medium sm:block ${active ? opt.activeDesc : 'text-zinc-400 dark:text-zinc-500'}`}>
            {opt.desc}
          </p>
        </button>
      );
    })}
  </div>
);

// ─── COMPONENTE PRINCIPAL ─────────────────────────────────────────────────────
const Step4_Config = ({ config, onConfigChange, editalSelecionado, horarios = {} }) => {
  const setField = (key, val) => onConfigChange({ ...config, [key]: val });

  useEffect(() => {
    const updates = {};
    if (!config.dataInicio) {
      const t = new Date();
      updates.dataInicio = `${t.getFullYear()}-${String(t.getMonth()+1).padStart(2,'0')}-${String(t.getDate()).padStart(2,'0')}`;
    }
    if (config.modoMontagem === undefined) updates.modoMontagem = 'inteligente';
    if (config.modoExibirAssuntos === undefined) updates.modoExibirAssuntos = true;
    if (config.modoExibirTempo === undefined)    updates.modoExibirTempo    = 'detalhado'; // 'detalhado' | 'total' | 'nenhum'
    if (Object.keys(updates).length > 0) onConfigChange({ ...config, ...updates });
  }, []);

  const hasEdital = !!editalSelecionado && editalSelecionado.id !== 'manual';
  const diasComEstudo = DIAS_SEMANA.filter(d => (horarios[d.idx] || 0) > 0);

  const handleToggleLimitar = (val) => {
    if (val && !config.limitesPorDia) {
      const limites = {};
      diasComEstudo.forEach(d => { limites[d.idx] = config.materiasPorDia || 3; });
      setField('limitesPorDia', limites);
    }
    setField('limitarMaterias', val);
  };

  const setLimiteDia = (diaIdx, val) =>
    setField('limitesPorDia', { ...(config.limitesPorDia || {}), [diaIdx]: val });

  const diasAteProva = config.dataInicio && config.dataProva
    ? Math.max(0, Math.floor((new Date(config.dataProva + 'T12:00') - new Date(config.dataInicio + 'T12:00')) / 86400000))
    : null;
  const semanasAteProva = diasAteProva ? Math.floor(diasAteProva / 7) : null;

  // Total horas semanais (para cálculo do tempo por slot)
  const totalHorasSem = Object.values(horarios).reduce((a, h) => a + (Number(h) || 0), 0);

  // Opções para o modo de exibição de assuntos
  const OPCOES_MONTAGEM = [
    {
      id: 'inteligente',
      label: 'Inteligente',
      icon: Flame,
      desc: 'O sistema otimiza a semana e distribui as disciplinas automaticamente.',
      activeBorder: 'border-red-500/50',
      activeBg: 'bg-red-50/30 dark:bg-red-950/10',
      activeBar: 'bg-red-500',
      activeIcon: 'bg-red-500',
      activeText: 'text-red-600 dark:text-red-400',
      activeDesc: 'text-red-700/70 dark:text-red-400/70',
      activeBadge: 'bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400',
    },
    {
      id: 'personalizado',
      label: 'Personalizado',
      icon: CalendarDays,
      desc: 'Cria uma grade base editavel usando suas disciplinas e horarios.',
      activeBorder: 'border-emerald-500/50',
      activeBg: 'bg-emerald-50/30 dark:bg-emerald-950/10',
      activeBar: 'bg-emerald-500',
      activeIcon: 'bg-emerald-500',
      activeText: 'text-emerald-600 dark:text-emerald-400',
      activeDesc: 'text-emerald-700/70 dark:text-emerald-400/70',
      activeBadge: 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400',
    },
  ];

  const modoMontagem = config.modoMontagem || 'inteligente';

  const OPCOES_ASSUNTOS = [
    {
      id: 'guiado',
      label: 'Guiado',
      icon: LayoutList,
      desc: 'Assuntos distribuídos automaticamente pelo algoritmo.',
      activeBorder: 'border-red-500/50',
      activeBg: 'bg-red-50/30 dark:bg-red-950/10',
      activeBar: 'bg-red-500',
      activeIcon: 'bg-red-500',
      activeText: 'text-red-600 dark:text-red-400',
      activeDesc: 'text-red-700/70 dark:text-red-400/70',
      activeBadge: 'bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400',
    },
    {
      id: 'livre',
      label: 'Livre',
      icon: Shuffle,
      desc: 'Só a disciplina é exibida. Você escolhe o assunto.',
      activeBorder: 'border-amber-400/50',
      activeBg: 'bg-amber-50/30 dark:bg-amber-950/10',
      activeBar: 'bg-amber-400',
      activeIcon: 'bg-amber-400',
      activeText: 'text-amber-600 dark:text-amber-400',
      activeDesc: 'text-amber-700/70 dark:text-amber-400/70',
      activeBadge: 'bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400',
    },
  ];

  // Opções para o modo de exibição de tempo
  const OPCOES_TEMPO = [
    {
      id: 'detalhado',
      label: 'Detalhado',
      icon: Timer,
      desc: 'Tempo por slot calculado e exibido no cronograma.',
      activeBorder: 'border-blue-500/50',
      activeBg: 'bg-blue-50/30 dark:bg-blue-950/10',
      activeBar: 'bg-blue-500',
      activeIcon: 'bg-blue-500',
      activeText: 'text-blue-600 dark:text-blue-400',
      activeDesc: 'text-blue-700/70 dark:text-blue-400/70',
      activeBadge: 'bg-blue-100 dark:bg-red-900/40 text-blue-600 dark:text-blue-400',
    },
    {
      id: 'total',
      label: 'Só Total',
      icon: Clock,
      desc: 'Apenas o tempo total do dia. Sem divisão.',
      activeBorder: 'border-violet-500/50',
      activeBg: 'bg-violet-50/30 dark:bg-violet-950/10',
      activeBar: 'bg-violet-500',
      activeIcon: 'bg-violet-500',
      activeText: 'text-violet-600 dark:text-violet-400',
      activeDesc: 'text-violet-700/70 dark:text-violet-400/70',
      activeBadge: 'bg-violet-100 dark:bg-red-900/40 text-violet-600 dark:text-violet-400',
    },
    {
      id: 'nenhum',
      label: 'Ocultar',
      icon: EyeOff,
      desc: 'Sem tempo. Foco total no conteúdo.',
      activeBorder: 'border-zinc-400/50',
      activeBg: 'bg-zinc-50/50 dark:bg-zinc-800/50',
      activeBar: 'bg-zinc-400',
      activeIcon: 'bg-zinc-400',
      activeText: 'text-zinc-600 dark:text-zinc-300',
      activeDesc: 'text-zinc-500/70',
      activeBadge: 'bg-zinc-200 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-300',
    },
  ];

  const modoAssuntos   = config.modoExibirAssuntos === false ? 'livre' : 'guiado';
  const modoTempo      = config.modoExibirTempo || 'detalhado';

  const handleModoMontagem = (id) => setField('modoMontagem', id === 'personalizado' ? 'personalizado' : 'inteligente');
  const handleModoAssuntos = (id) => setField('modoExibirAssuntos', id !== 'livre');
  const handleModoTempo    = (id) => setField('modoExibirTempo', id);

  // Cálculo ilustrativo: minutos por slot se detalhado
  const horasHoje      = diasComEstudo.length > 0 ? totalHorasSem / diasComEstudo.length : 0;
  const slotsEstimados = config.materiasPorDia || 3;
  const minsPorSlot    = slotsEstimados > 0 ? Math.round((horasHoje * 60) / slotsEstimados) : 0;

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <PageHeader />

      <div className="flex flex-col lg:flex-row gap-3 lg:gap-8 flex-1 min-h-0 overflow-y-auto overflow-x-hidden custom-scrollbar pb-10 px-2 sm:px-0">

        {/* ── Coluna Principal ──────────────────────────────────────────────── */}
        <div className="flex-1 min-w-0 flex flex-col gap-3 sm:gap-6">

          <div className={hasEdital ? 'grid grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] gap-3 lg:block' : ''}>
            {/* Edital mini (mobile) */}
            {hasEdital && (
              <div className="lg:hidden">
                <EditalMiniCard editalSelecionado={editalSelecionado} />
              </div>
            )}

            {/* ── Nome do Cronograma ─────────────────────────────────────── */}
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 }}
              className="group bg-white dark:bg-zinc-900 rounded-2xl sm:rounded-3xl border border-zinc-100 dark:border-zinc-800/50 p-4 sm:p-6 shadow-sm hover:shadow-md transition-all duration-300"
            >
              <div className="flex items-center gap-2 sm:gap-3 mb-3 sm:mb-4">
                <div className="w-8 h-8 rounded-xl bg-zinc-50 dark:bg-zinc-800 flex items-center justify-center text-zinc-400 group-focus-within:text-red-500 transition-colors">
                  <Hash size={16} />
                </div>
                <label className="text-[9px] sm:text-[11px] font-black uppercase tracking-[0.12em] sm:tracking-[0.15em] text-zinc-400 group-focus-within:text-zinc-600 dark:group-focus-within:text-zinc-300 transition-colors">
                  Nome do Cronograma
                </label>
              </div>
              <input
                type="text"
                value={config.nome || ''}
                onChange={e => setField('nome', e.target.value)}
                placeholder="Ex: Reta Final PMBA"
                className="w-full px-3 py-3 sm:px-5 sm:py-4 text-sm sm:text-lg font-black bg-zinc-50 dark:bg-zinc-950 border-2 border-transparent focus:bg-white dark:focus:bg-zinc-900 focus:border-red-500/20 focus:ring-4 focus:ring-red-500/5 rounded-xl sm:rounded-2xl outline-none transition-all text-zinc-900 dark:text-white placeholder:text-zinc-300 dark:placeholder:text-zinc-700"
              />
              <div className="mt-3 hidden sm:flex items-center gap-2 text-[10px] text-zinc-400 font-medium">
                <span className="w-1 h-1 rounded-full bg-zinc-300 dark:bg-zinc-700" />
                <span>Use um nome que identifique claramente seu objetivo</span>
              </div>
            </motion.div>
          </div>

          {/* ── Datas (REVISITADO) ────────────────────────────────────────── */}
          <div className="grid grid-cols-2 gap-3 sm:gap-6">
            {/* Data de Início */}
            <motion.div
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.1 }}
              className="bg-white dark:bg-zinc-900 rounded-2xl sm:rounded-3xl border border-zinc-100 dark:border-zinc-800/50 p-4 sm:p-6 shadow-sm relative overflow-visible group"
            >
              <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 blur-3xl rounded-full -mr-16 -mt-16 transition-all group-hover:bg-blue-500/10 pointer-events-none" />
              <div className="flex items-center gap-3 mb-4 relative z-10">
                <div className="w-8 h-8 rounded-xl bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center text-blue-500">
                  <CalendarDays size={16} />
                </div>
                <label className="text-[11px] font-black uppercase tracking-[0.15em] text-blue-500/80">
                  Data de Início
                </label>
              </div>
              <p className="text-[11px] text-zinc-400 mb-4 font-medium leading-relaxed relative z-10">
                Quando os motores começam a girar?
              </p>
              <div className="relative z-10">
                <CustomDatePicker
                  name="dataInicio"
                  value={config.dataInicio || ''}
                  onChange={val => setField('dataInicio', val)}
                  color="blue"
                />
              </div>
            </motion.div>

            {/* Data da Prova */}
            <motion.div
              initial={{ opacity: 0, x: 12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.12 }}
              className={`bg-white dark:bg-zinc-900 rounded-2xl sm:rounded-3xl border transition-all duration-300 p-4 sm:p-6 shadow-sm relative overflow-visible group ${config.retaFinal ? 'border-red-500/30' : 'border-zinc-100 dark:border-zinc-800/50'}`}
            >
              <div className={`absolute top-0 right-0 w-32 h-32 blur-3xl rounded-full -mr-16 -mt-16 transition-all ${config.retaFinal ? 'bg-red-500/10' : 'bg-zinc-500/5'} pointer-events-none`} />
              <div className="flex items-center justify-between mb-4 relative z-10">
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center transition-colors ${config.retaFinal ? 'bg-red-50 dark:bg-red-900/20 text-red-500' : 'bg-zinc-50 dark:bg-zinc-800 text-zinc-400'}`}>
                    <CalendarClock size={16} />
                  </div>
                  <label className={`text-[11px] font-black uppercase tracking-[0.15em] ${config.retaFinal ? 'text-red-500/80' : 'text-zinc-400'}`}>
                    Data da Prova
                  </label>
                </div>
                <ToggleSwitch checked={config.retaFinal || false} onChange={val => setField('retaFinal', val)} />
              </div>
              <p className="text-[11px] text-zinc-400 mb-4 font-medium leading-relaxed relative z-10">
                Ative para o algoritmo priorizar a reta final.
              </p>
              
              <div className="relative z-10 min-h-[50px]">
                <AnimatePresence mode="wait">
                  {config.retaFinal ? (
                    <motion.div
                      key="active"
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                    >
                      <CustomDatePicker
                        name="dataProva"
                        value={config.dataProva || ''}
                        onChange={val => setField('dataProva', val)}
                        color="red"
                      />
                      {config.dataProva && semanasAteProva !== null && (
                        <div className={`mt-3 py-2 px-3 rounded-xl border flex items-center justify-between ${
                          semanasAteProva < 4 ? 'bg-red-50/50 dark:bg-red-900/20 border-red-100/50 dark:border-red-800/30 text-red-600 dark:text-red-400' : 
                          semanasAteProva < 8 ? 'bg-amber-50/50 dark:bg-amber-900/20 border-amber-100/50 dark:border-amber-800/30 text-amber-600 dark:text-amber-400' : 
                          'bg-emerald-50/50 dark:bg-emerald-900/20 border-emerald-100/50 dark:border-emerald-800/30 text-emerald-600 dark:text-emerald-400'
                        }`}>
                          <span className="text-[10px] font-black uppercase tracking-tight">Faltam {diasAteProva} dias</span>
                          <span className="text-[9px] font-bold opacity-80">{semanasAteProva} semanas</span>
                        </div>
                      )}
                    </motion.div>
                  ) : (
                    <motion.div
                      key="inactive"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="h-[52px] flex items-center justify-center bg-zinc-50/50 dark:bg-zinc-950/30 border-2 border-dashed border-zinc-100 dark:border-zinc-800 rounded-2xl"
                    >
                      <span className="text-[10px] text-zinc-300 dark:text-zinc-700 font-black uppercase tracking-widest">Inativo</span>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </motion.div>
          </div>

          {/* ── Limitar Disciplinas (REVISITADO) ─────────────────────────── */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className={`bg-white dark:bg-zinc-900 rounded-3xl border transition-all duration-300 p-4 sm:p-7 shadow-sm relative overflow-visible ${config.limitarMaterias ? 'border-red-500/20 ring-4 ring-red-500/5' : 'border-zinc-100 dark:border-zinc-800/50'}`}
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 relative z-10">
              <div className="flex items-center gap-4">
                <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shadow-sm transition-colors ${config.limitarMaterias ? 'bg-red-500 text-white' : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-400'}`}>
                  <Layers size={20} />
                </div>
                <div>
                  <label className={`text-xs font-black uppercase tracking-widest mb-0.5 block ${config.limitarMaterias ? 'text-red-600 dark:text-red-400' : 'text-zinc-500'}`}>
                    Limitar Disciplinas por Dia
                  </label>
                  <p className="text-[11px] text-zinc-400 font-medium">
                    Quantas matérias diferentes por dia?
                  </p>
                </div>
              </div>
              <ToggleSwitch checked={config.limitarMaterias || false} onChange={handleToggleLimitar} />
            </div>

            <AnimatePresence>
              {config.limitarMaterias && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden"
                >
                  <div className="pt-6 border-t border-zinc-50 dark:border-zinc-800/50">
                    {diasComEstudo.length === 0 ? (
                      <div className="flex items-center gap-3 p-4 bg-amber-50 dark:bg-amber-900/10 rounded-2xl border border-amber-100 dark:border-amber-800/30">
                        <AlertCircle size={16} className="text-amber-500 shrink-0" />
                        <p className="text-[11px] text-amber-700 dark:text-amber-400 font-bold">
                          Configure suas horas de estudo no passo anterior para ajustar os limites.
                        </p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-7 gap-2 sm:gap-3">
                        {diasComEstudo.map(dia => {
                          const val = config.limitesPorDia?.[dia.idx] ?? config.materiasPorDia ?? 3;
                          return (
                            <div key={dia.idx} className="bg-zinc-50 dark:bg-zinc-800/40 rounded-xl sm:rounded-2xl p-2 sm:p-4 border border-zinc-100 dark:border-zinc-700/50 flex flex-col items-center hover:bg-white dark:hover:bg-zinc-800 hover:shadow-sm transition-all group">
                              <span className="text-[9px] font-black uppercase text-zinc-400 mb-3 tracking-tighter group-hover:text-red-500 transition-colors">
                                {dia.curto}
                              </span>
                              <div className="flex items-center gap-1.5 sm:flex-col sm:gap-2">
                                <button
                                  onClick={() => setLimiteDia(dia.idx, Math.min(7, val + 1))}
                                  className="w-6 h-6 rounded-lg bg-white dark:bg-zinc-700 border border-zinc-200 dark:border-zinc-600 flex items-center justify-center text-zinc-400 hover:text-red-500 hover:border-red-200 transition-all shadow-sm"
                                >+</button>
                                <span className="min-w-4 text-center text-base sm:text-xl font-black text-zinc-900 dark:text-white tabular-nums">{val}</span>
                                <button
                                  onClick={() => setLimiteDia(dia.idx, Math.max(1, val - 1))}
                                  className="w-6 h-6 rounded-lg bg-white dark:bg-zinc-700 border border-zinc-200 dark:border-zinc-600 flex items-center justify-center text-zinc-400 hover:text-red-500 hover:border-red-200 transition-all shadow-sm"
                                >−</button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
            {!config.limitarMaterias && (
              <div className="mt-4 pt-4 border-t border-zinc-50 dark:border-zinc-800/50 flex items-center justify-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-zinc-200 dark:bg-zinc-700 animate-pulse" />
                <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-widest italic">
                  Distribuição Automática Inteligente
                </p>
              </div>
            )}
          </motion.div>

          {/* ── Seção: Modos de Visualização ─────────────────────────────── */}
          <div className="grid grid-cols-1 gap-3 sm:gap-6">
            {false && (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.16 }}
              className="bg-white dark:bg-zinc-900 rounded-2xl sm:rounded-3xl border border-zinc-100 dark:border-zinc-800/50 p-4 sm:p-7 shadow-sm"
            >
              <div className="flex items-center gap-4 mb-6">
                <div className="w-10 h-10 rounded-2xl bg-zinc-50 dark:bg-zinc-800 flex items-center justify-center text-zinc-400">
                  <Target size={20} />
                </div>
                <div>
                  <h4 className="text-xs font-black uppercase tracking-widest text-zinc-900 dark:text-white">
                    Como deseja montar sua semana?
                  </h4>
                  <p className="text-[11px] text-zinc-500 font-medium mt-0.5">
                    Escolha entre otimizacao inteligente ou uma grade base editavel por edital.
                  </p>
                </div>
              </div>
              <ModeSelector
                options={OPCOES_MONTAGEM}
                value={modoMontagem}
                onChange={handleModoMontagem}
              />
            </motion.div>
            )}
            {/* Modo de Assuntos */}
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="bg-white dark:bg-zinc-900 rounded-2xl sm:rounded-3xl border border-zinc-100 dark:border-zinc-800/50 p-4 sm:p-7 shadow-sm"
            >
              <div className="flex items-center gap-4 mb-6">
                <div className="w-10 h-10 rounded-2xl bg-zinc-50 dark:bg-zinc-800 flex items-center justify-center text-zinc-400">
                  <BookOpen size={20} />
                </div>
                <div>
                  <h4 className="text-xs font-black uppercase tracking-widest text-zinc-900 dark:text-white">
                    Foco do Conteúdo
                  </h4>
                  <p className="text-[11px] text-zinc-500 font-medium mt-0.5">
                    Como os tópicos serão exibidos no seu dia a dia?
                  </p>
                </div>
              </div>
              <ModeSelector
                options={OPCOES_ASSUNTOS}
                value={modoAssuntos}
                onChange={handleModoAssuntos}
              />
            </motion.div>

            {/* Modo de Tempo */}
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.25 }}
              className="bg-white dark:bg-zinc-900 rounded-2xl sm:rounded-3xl border border-zinc-100 dark:border-zinc-800/50 p-4 sm:p-7 shadow-sm"
            >
              <div className="flex items-center gap-4 mb-6">
                <div className="w-10 h-10 rounded-2xl bg-zinc-50 dark:bg-zinc-800 flex items-center justify-center text-zinc-400">
                  <Clock size={20} />
                </div>
                <div>
                  <h4 className="text-xs font-black uppercase tracking-widest text-zinc-900 dark:text-white">
                    Gestão do Tempo
                  </h4>
                  <p className="text-[11px] text-zinc-500 font-medium mt-0.5">
                    Defina o nível de detalhamento do cronômetro.
                  </p>
                </div>
              </div>
              <ModeSelector
                options={OPCOES_TEMPO}
                value={modoTempo}
                onChange={handleModoTempo}
              />

              {/* Preview Refinado */}
              <AnimatePresence mode="wait">
                <motion.div
                  key={modoTempo}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.2 }}
                  className="mt-8 relative"
                >
                  <div className="absolute inset-0 bg-zinc-50/50 dark:bg-zinc-950/20 rounded-2xl -m-4 pointer-events-none" />
                  <div className="relative p-1">
                    <div className="flex items-center justify-between mb-4 px-2">
                      <span className="text-[9px] font-black uppercase tracking-widest text-zinc-400">Preview no Cronograma</span>
                      <div className="flex gap-1">
                        <div className="w-1.5 h-1.5 rounded-full bg-zinc-200 dark:bg-zinc-800" />
                        <div className="w-1.5 h-1.5 rounded-full bg-zinc-200 dark:bg-zinc-800" />
                        <div className="w-1.5 h-1.5 rounded-full bg-zinc-200 dark:bg-zinc-800" />
                      </div>
                    </div>
                    
                    <div className="bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 rounded-2xl p-5 shadow-sm space-y-4">
                      {modoTempo === 'detalhado' && (
                        <>
                          {[
                            { m: 'Direito Constitucional', a: 'Art. 5º - Direitos Fundamentais', t: minsPorSlot > 0 ? `${minsPorSlot}min` : '60min', c: 'blue' },
                            { m: 'Matemática', a: 'Porcentagem e Proporção', t: minsPorSlot > 0 ? `${minsPorSlot}min` : '60min', c: 'blue' }
                          ].map((item, i) => (
                            <div key={i} className="flex items-center justify-between group">
                              <div className="flex items-center gap-3">
                                <div className="w-1 h-8 bg-blue-500/20 rounded-full group-hover:bg-blue-500 transition-colors" />
                                <div>
                                  <div className="text-[10px] font-black uppercase text-zinc-700 dark:text-zinc-200">{item.m}</div>
                                  <div className="text-[9px] text-zinc-400 font-medium">{item.a}</div>
                                </div>
                              </div>
                              <div className="flex items-center gap-1.5 text-[9px] font-black text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 px-2.5 py-1 rounded-lg border border-blue-100/50 dark:border-blue-800/30 shadow-sm">
                                <Timer size={10} />
                                {item.t}
                              </div>
                            </div>
                          ))}
                          <div className="pt-3 border-t border-zinc-50 dark:border-zinc-800/50 flex justify-end">
                            <span className="text-[9px] font-black text-zinc-400 uppercase tracking-widest">Total: {minsPorSlot > 0 ? `${minsPorSlot * 2}min` : '2h'}</span>
                          </div>
                        </>
                      )}
                      {modoTempo === 'total' && (
                        <>
                          <div className="space-y-3">
                            <div className="flex items-center gap-3">
                              <div className="w-1 h-4 bg-zinc-200 dark:bg-zinc-700 rounded-full" />
                              <div className="text-[10px] font-black uppercase text-zinc-700 dark:text-zinc-200">Direito Constitucional</div>
                            </div>
                            <div className="flex items-center gap-3">
                              <div className="w-1 h-4 bg-zinc-200 dark:bg-zinc-700 rounded-full" />
                              <div className="text-[10px] font-black uppercase text-zinc-700 dark:text-zinc-200">Matemática</div>
                            </div>
                          </div>
                          <div className="pt-4 border-t border-zinc-50 dark:border-zinc-800/50 flex items-center justify-between">
                            <span className="text-[9px] text-zinc-400 font-black uppercase tracking-tight">Tempo total do dia</span>
                            <div className="flex items-center gap-1.5 text-[9px] font-black text-violet-600 dark:text-violet-400 bg-violet-50 dark:bg-violet-900/30 px-3 py-1.5 rounded-xl border border-violet-100/50 dark:border-violet-800/30 shadow-sm">
                              <Clock size={10} />
                              {totalHorasSem > 0 && diasComEstudo.length > 0 ? `${Math.round(totalHorasSem / diasComEstudo.length * 10) / 10}h` : '2h'}
                            </div>
                          </div>
                        </>
                      )}
                      {modoTempo === 'nenhum' && (
                        <>
                          <div className="space-y-3">
                            <div className="text-[10px] font-black uppercase text-zinc-700 dark:text-zinc-200 opacity-60">Direito Constitucional</div>
                            <div className="text-[10px] font-black uppercase text-zinc-700 dark:text-zinc-200 opacity-60">Matemática</div>
                          </div>
                          <div className="pt-4 border-t border-zinc-50 dark:border-zinc-800/50 flex items-center justify-center">
                            <span className="text-[9px] text-zinc-300 dark:text-zinc-700 font-black uppercase tracking-[0.2em] italic">Foco No Conteúdo</span>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                </motion.div>
              </AnimatePresence>
            </motion.div>
          </div>

        </div>

        {/* ── Sidebar (REVISITADO) ─────────────────────────────────────────── */}
        <div className="hidden lg:block lg:w-80 shrink-0">
          <div className="sticky top-6 self-start space-y-6">

            {/* Edital card (MANTIDO) */}
            {hasEdital && (
              <div className="hidden lg:block">
                <EditalSidebarCard editalSelecionado={editalSelecionado} />
              </div>
            )}

            {/* Resumo Dinâmico */}
            <div className="bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-100 dark:border-zinc-800/50 p-6 shadow-sm relative overflow-hidden">
              <div className="absolute top-0 right-0 w-24 h-24 bg-zinc-500/5 blur-2xl rounded-full -mr-12 -mt-12" />
              <div className="flex items-center justify-between mb-6 relative z-10">
                <p className="text-[11px] font-black uppercase tracking-[0.2em] text-zinc-400">Resumo do Plano</p>
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
              </div>
              
              <div className="space-y-4 relative z-10">
                {[
                  { l: 'Projeto',        v: config.nome || 'Padrão', icon: Hash, color: 'zinc' },
                  { l: 'Início',         v: config.dataInicio ? new Date(config.dataInicio + 'T12:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }) : 'Hoje', icon: CalendarDays, color: 'blue' },
                  { l: 'Prova',          v: config.retaFinal ? (config.dataProva ? new Date(config.dataProva + 'T12:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }) : 'Setar data') : 'Livre', icon: CalendarClock, color: 'red' },
                  { l: 'Disciplinas',    v: config.limitarMaterias ? 'Limites Ativos' : 'Automático', icon: Layers, color: 'amber' },
                  { l: 'Visualização',   v: modoAssuntos === 'livre' ? 'Livre' : 'Guiado', icon: BookOpen, color: 'zinc' },
                  { l: 'Gestão Tempo',   v: modoTempo === 'detalhado' ? 'Analítico' : modoTempo === 'total' ? 'Sintético' : 'Oculto', icon: Timer, color: 'zinc' },
                ].map((item) => (
                  <div key={item.l} className="flex items-center justify-between group">
                    <div className="flex items-center gap-2.5">
                      <div className={`w-6 h-6 rounded-lg bg-zinc-50 dark:bg-zinc-800 flex items-center justify-center text-zinc-400 group-hover:scale-110 transition-transform`}>
                        <item.icon size={11} />
                      </div>
                      <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-tight">{item.l}</span>
                    </div>
                    <span className="text-xs font-black text-zinc-900 dark:text-white truncate max-w-[120px]">{item.v}</span>
                  </div>
                ))}
              </div>

              {/* Barra de Progresso Visual (Ilustrativa) */}
              <div className="mt-8 pt-6 border-t border-zinc-50 dark:border-zinc-800/50">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[9px] font-black text-zinc-400 uppercase tracking-widest">Configuração</span>
                  <span className="text-[9px] font-black text-red-500 uppercase">80% Concluído</span>
                </div>
                <div className="h-1.5 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: '80%' }}
                    className="h-full bg-gradient-to-r from-red-500 to-red-600 rounded-full" 
                  />
                </div>
              </div>
            </div>

            {/* Dica Contextual */}
            <div className="bg-gradient-to-br from-blue-600 to-blue-700 rounded-3xl p-6 text-white shadow-lg shadow-blue-500/20 relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 blur-3xl rounded-full -mr-16 -mt-16" />
              <div className="flex items-start gap-4 relative z-10">
                <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center backdrop-blur-sm shadow-sm shrink-0">
                  <Info size={14} className="text-white" />
                </div>
                <div>
                  <h5 className="text-[11px] font-black uppercase tracking-widest mb-1.5">Dica de Especialista</h5>
                  <p className="text-[11px] text-blue-50 font-medium leading-relaxed opacity-90">
                    O modo <span className="font-black underline decoration-blue-300 underline-offset-2">Analítico</span> (Detalhado) ajuda iniciantes a manter a disciplina, enquanto veteranos costumam preferir o modo <span className="font-black underline decoration-blue-300 underline-offset-2">Livre</span>.
                  </p>
                </div>
              </div>
              <div className="mt-4 flex justify-end relative z-10">
                <div className="text-[8px] font-black uppercase tracking-widest bg-white/10 px-2 py-1 rounded-lg">Passo 4 de 5</div>
              </div>
            </div>

          </div>
        </div>

      </div>
    </div>
  );
};

export default Step4_Config;
