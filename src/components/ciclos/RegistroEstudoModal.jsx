import React, { useState, useEffect, useMemo, useRef } from 'react';
import { serverTimestamp, doc, getDoc, addDoc, collection, query, where, getDocs, writeBatch } from 'firebase/firestore';
import { db } from '../../firebaseConfig';
import {
  X, Save, Clock, Target, AlertTriangle, ChevronDown, CheckSquare,
  Calendar as CalendarIcon, ChevronUp, CheckCircle2, BookOpen, ChevronLeft, ChevronRight, AlertCircle,
  Plus, Layers, Trash2, Edit3, LogOut, CalendarDays, RotateCcw
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// --- IMPORTAÇÃO DA GAMIFICAÇÃO ---
import { useLevelSystem } from '../../hooks/useLevelSystem';
import {
  getRevisaoEscolhidaInicial,
  getRevisaoEscolhidaPlaceholder,
  normalizeRevisaoModoCiclo,
  REVISAO_MODO_FLEXIVEL,
  REVISAO_MODO_SUGESTAO,
  shouldPersistIntervaloRevisao,
} from '../../utils/cicloReviewMode';

// --- ESTILOS CSS ---
const globalStyles = `
  .custom-scrollbar::-webkit-scrollbar { width: 4px; height: 4px; }
  .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
  .custom-scrollbar::-webkit-scrollbar-thumb { background: #e4e4e7; border-radius: 10px; }
  .dark .custom-scrollbar::-webkit-scrollbar-thumb { background: #3f3f46; }

  input[type=number]::-webkit-inner-spin-button,
  input[type=number]::-webkit-outer-spin-button { -webkit-appearance: none; margin: 0; }

  .registro-modal-form-section {
    background: white;
    border-radius: 16px;
    border: 1px solid #e4e4e7;
    box-shadow: 0 1px 3px rgba(0,0,0,0.04);
  }
  .dark .registro-modal-form-section {
    background: rgba(24,24,27,0.7);
    border-color: #27272a;
  }

  .context-pill-active-ciclo {
    background: linear-gradient(135deg, #dc2626 0%, #b91c1c 100%);
    color: white;
    box-shadow: 0 2px 8px rgba(220,38,38,0.35);
  }
  .context-pill-active-cronograma {
    background: linear-gradient(135deg, #0284c7 0%, #0369a1 100%);
    color: white;
    box-shadow: 0 2px 8px rgba(2,132,199,0.35);
  }

  .revisao-chip {
    position: relative;
    overflow: hidden;
    transition: all 0.18s ease;
  }
  .revisao-chip::after {
    content: '';
    position: absolute;
    inset: 0;
    background: linear-gradient(135deg, rgba(255,255,255,0.15) 0%, transparent 100%);
    opacity: 0;
    transition: opacity 0.15s;
  }
  .revisao-chip:hover::after { opacity: 1; }

  @keyframes shimmer-btn {
    0% { transform: translateX(-120%) skewX(-12deg); }
    100% { transform: translateX(300%) skewX(-12deg); }
  }
  .btn-shimmer::before {
    content: '';
    position: absolute;
    top: -8px; bottom: -8px; left: 0;
    width: 40%;
    background: linear-gradient(90deg, transparent, rgba(255,255,255,0.18), transparent);
    animation: shimmer-btn 1.2s linear infinite;
  }
`;

// =======================================================
// 🔧 AJUSTES DE TAMANHO
// =======================================================
const MODAL_MAX_W_PX = 960;
const MODAL_COLLAPSED_MAX_H_PX = 620;
const MODAL_EXPANDED_MAX_H_PX = 900;

const QUEUE_MOBILE_H_PX = 160;
const QUEUE_CARD_MIN_W_MOBILE = 220;

const DATE_MONTH_TEXT_CLASS = 'text-[10px]';
const DATE_DAY_TEXT_CLASS = 'text-base';

const FOOTER_PADDING_MOBILE = 'p-4';
const FOOTER_PADDING_DESKTOP = 'md:p-5';
// =======================================================

// --- FUNÇÕES AUXILIARES ---
const getLocalDateString = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
};

const parseDateLocal = (dateString) => {
  if (!dateString) return new Date();
  const [year, month, day] = dateString.split('-').map(Number);
  return new Date(year, month - 1, day, 12, 0, 0);
};

const isRegistroContext = (value) => value === 'ciclo' || value === 'cronograma';

const normalizeAssuntos = (arr) => {
  const list = Array.isArray(arr) ? arr : [];
  return list
    .map(a => (typeof a === 'string' ? { nome: a, inCiclo: true } : { ...a, nome: (a?.nome || '').trim(), inCiclo: a?.inCiclo !== false }))
    .filter(a => a.nome && a.inCiclo !== false);
};

const normalizeDisciplina = (disciplina) => {
  if (!disciplina) return null;
  const nome = disciplina.nome || disciplina.disciplinaNome || disciplina.label || '';
  const id = disciplina.id || disciplina.disciplinaId || nome;
  if (!id || !nome) return null;
  return {
    ...disciplina,
    id,
    nome,
    assuntos: normalizeAssuntos(disciplina.assuntos || disciplina.topicos || disciplina.temas || []),
    inCiclo: disciplina.inCiclo !== false,
  };
};

// --- SUB-COMPONENTES ---

// 1. Modal de Confirmação ao Sair
const ConfirmCloseModal = ({ isOpen, onConfirm, onCancel }) => {
  if (!isOpen) return null;
  return (
    <div
      className="absolute inset-0 z-[60] bg-black/50 backdrop-blur-sm flex items-center justify-center p-6 rounded-[28px]"
      onClick={(e) => e.stopPropagation()}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="bg-white dark:bg-zinc-900 p-6 rounded-2xl shadow-2xl border border-zinc-200 dark:border-zinc-800 w-full max-w-xs text-center"
      >
        <div className="w-11 h-11 bg-amber-100 dark:bg-amber-900/30 text-amber-600 rounded-full flex items-center justify-center mx-auto mb-3">
          <LogOut size={22} />
        </div>
        <h3 className="text-base font-bold text-zinc-900 dark:text-white mb-1">Sair sem salvar?</h3>
        <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-5">Você tem dados não salvos. Eles serão perdidos.</p>
        <div className="flex gap-2">
          <button
            onClick={onCancel}
            className="flex-1 py-2.5 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 font-semibold text-xs hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
          >
            Voltar
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 py-2.5 rounded-xl bg-red-600 text-white font-semibold text-xs hover:bg-red-700 transition-colors"
          >
            Sair
          </button>
        </div>
      </motion.div>
    </div>
  );
};

// 2. TOAST DE SUCESSO FLUTUANTE
const SuccessToast = () => (
  <motion.div
    initial={{ opacity: 0, y: -50, x: 50 }}
    animate={{ opacity: 1, y: 0, x: 0 }}
    exit={{ opacity: 0, y: -20 }}
    className="fixed top-6 right-6 z-[9999] bg-white dark:bg-zinc-900 border border-emerald-500/20 shadow-2xl rounded-2xl p-4 flex items-center gap-4 max-w-sm pointer-events-none"
  >
    <div className="w-10 h-10 bg-emerald-500 text-white rounded-full flex items-center justify-center shadow-lg shadow-emerald-500/30">
      <CheckCircle2 size={20} />
    </div>
    <div>
      <h4 className="text-sm font-bold text-zinc-800 dark:text-white">Estudo Registrado!</h4>
      <p className="text-xs text-zinc-500 dark:text-zinc-400">Seus estudos foram salvos com sucesso.</p>
    </div>
  </motion.div>
);

// 3. Select Customizado
const CustomSelect = ({ options, value, onChange, placeholder, icon: Icon, disabled, loading, name }) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) setIsOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selectedOption = options.find(opt => opt.value === value);
  const handleSelect = (selectedValue) => {
    onChange({ target: { name, value: selectedValue } });
    setIsOpen(false);
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <div
        onClick={() => !disabled && setIsOpen(!isOpen)}
        className={`w-full pl-3.5 pr-9 py-2.5 bg-zinc-50 dark:bg-zinc-900/80 border ${isOpen ? 'border-red-500 ring-2 ring-red-500/10' : 'border-zinc-200 dark:border-zinc-800'} rounded-xl flex items-center justify-between cursor-pointer transition-all ${disabled ? 'opacity-50 cursor-not-allowed' : 'hover:border-zinc-300 dark:hover:border-zinc-700'}`}
      >
        <span className={`text-sm truncate ${selectedOption ? 'text-zinc-800 dark:text-white font-medium' : 'text-zinc-400 dark:text-zinc-500'}`}>
          {selectedOption ? selectedOption.label : (loading ? 'Carregando...' : placeholder)}
        </span>
        <div className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none">
          {loading
            ? <div className="animate-spin h-3.5 w-3.5 border-2 border-red-500 border-t-transparent rounded-full" />
            : <ChevronDown size={15} className={`transition-transform ${isOpen ? 'rotate-180' : ''}`} />
          }
        </div>
      </div>

      <AnimatePresence>
        {isOpen && !disabled && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98 }}
            transition={{ duration: 0.12 }}
            className="absolute z-[60] w-full mt-1.5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-xl max-h-56 overflow-y-auto custom-scrollbar"
          >
            <div className="p-1">
              {options.length > 0 ? (
                options.map((opt) => (
                  <div
                    key={opt.value}
                    onClick={() => handleSelect(opt.value)}
                    className={`px-3 py-2.5 rounded-lg text-sm cursor-pointer transition-colors flex items-center justify-between gap-2 ${value === opt.value
                      ? 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 font-semibold'
                      : 'text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800'
                    }`}
                  >
                    <span className="truncate">{opt.label}</span>
                    {value === opt.value && <CheckCircle2 size={13} className="shrink-0" />}
                  </div>
                ))
              ) : (
                <div className="p-4 text-center text-xs text-zinc-400">Nenhum item disponível</div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// 4. Date Picker Customizado
const CustomDatePicker = ({ value, onChange, name }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [viewDate, setViewDate] = useState(parseDateLocal(value));
  const containerRef = useRef(null);

  const dateObj = parseDateLocal(value);
  const dayDisplay = dateObj.getDate();
  const monthDisplay = dateObj.toLocaleDateString('pt-BR', { month: 'short' }).toUpperCase().replace('.', '');
  const weekDisplay = dateObj.toLocaleDateString('pt-BR', { weekday: 'long' });

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) setIsOpen(false);
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
    onChange({ target: { name, value: `${year}-${month}-${d}` } });
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
      const isToday = new Date().getDate() === i && new Date().getMonth() === month && new Date().getFullYear() === year;
      slots.push(
        <button
          key={i}
          onClick={(e) => { e.preventDefault(); handleSelectDay(i); }}
          className={`w-8 h-8 rounded-full text-xs font-medium flex items-center justify-center transition-all ${isSelected
            ? 'bg-red-600 text-white shadow-md shadow-red-500/30'
            : isToday
              ? 'bg-red-50 dark:bg-red-900/20 text-red-600 font-semibold'
              : 'text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800'
          }`}
        >
          {i}
        </button>
      );
    }
    return slots;
  };

  return (
    <div className="relative" ref={containerRef}>
      <div
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center gap-3 w-full bg-zinc-50 dark:bg-zinc-900/80 border ${isOpen ? 'border-red-500 ring-2 ring-red-500/10' : 'border-zinc-200 dark:border-zinc-800'} rounded-xl overflow-hidden cursor-pointer transition-all hover:border-zinc-300 dark:hover:border-zinc-700`}
      >
        {/* Date badge */}
        <div className="bg-red-600 w-14 shrink-0 flex flex-col items-center justify-center py-2.5">
          <span className="text-[9px] font-bold uppercase text-red-200 tracking-wider">{monthDisplay}</span>
          <span className="text-xl font-black leading-none text-white">{dayDisplay}</span>
        </div>
        {/* Day label */}
        <div className="flex-1 flex items-center justify-between pr-3">
          <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300 capitalize">{weekDisplay}</span>
          <CalendarIcon size={15} className={`transition-colors ${isOpen ? 'text-red-500' : 'text-zinc-300 dark:text-zinc-600'}`} />
        </div>
      </div>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -4 }}
            transition={{ duration: 0.15 }}
            className="absolute left-0 top-full mt-2 z-[60] bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-xl p-4 w-[272px]"
          >
            <div className="flex justify-between items-center mb-3">
              <button onClick={(e) => { e.preventDefault(); changeMonth(-1); }} className="p-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg text-zinc-500 transition-colors">
                <ChevronLeft size={15} />
              </button>
              <span className="text-sm font-semibold text-zinc-800 dark:text-white capitalize">
                {viewDate.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}
              </span>
              <button onClick={(e) => { e.preventDefault(); changeMonth(1); }} className="p-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg text-zinc-500 transition-colors">
                <ChevronRight size={15} />
              </button>
            </div>
            <div className="grid grid-cols-7 gap-1 place-items-center mb-1">
              {['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].map((d, i) => (
                <span key={i} className="text-[9px] font-bold text-zinc-400 uppercase">{d}</span>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-1 place-items-center">
              {renderCalendarGrid()}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// 5. Loading bonito do botão de salvar
const SaveButtonLoading = () => (
  <div className="relative flex items-center justify-center gap-2">
    <div className="relative w-[18px] h-[18px]">
      <motion.div
        className="absolute inset-0 rounded-full border-2 border-white/35"
        animate={{ opacity: [0.35, 0.6, 0.35] }}
        transition={{ duration: 1.2, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        className="absolute inset-0 rounded-full border-2 border-white border-t-transparent"
        animate={{ rotate: 360 }}
        transition={{ duration: 0.85, repeat: Infinity, ease: 'linear' }}
      />
    </div>
    <div className="flex items-center">
      <span className="text-xs font-bold uppercase tracking-wide">Salvando</span>
      <motion.span
        className="ml-0.5 text-xs font-bold"
        animate={{ opacity: [0.2, 1, 0.2] }}
        transition={{ duration: 0.9, repeat: Infinity, ease: 'easeInOut' }}
      >
        ...
      </motion.span>
    </div>
  </div>
);

// 6. Logo de contexto (ciclo/cronograma) — com ícone de "edital"
const ContextLogo = ({ type, active }) => {
  const isCiclo = type === 'ciclo';
  return (
    <span className={`relative flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border-2 transition-all ${
      active && isCiclo
        ? 'border-red-400/60 bg-red-600 text-white shadow-sm shadow-red-500/30'
        : active && !isCiclo
          ? 'border-sky-400/60 bg-sky-600 text-white shadow-sm shadow-sky-500/30'
          : 'border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-400'
    }`}>
      {isCiclo ? <Layers size={14} strokeWidth={2.2} /> : <CalendarDays size={14} strokeWidth={2.2} />}
    </span>
  );
};

// 7. Chip de revisão individual — dias melhorados
const RevisaoChip = ({ value, label, active, onClick, autoMode }) => {
  const isSkip = value === 'skip';
  return (
    <button
      type="button"
      onClick={onClick}
      className={`revisao-chip flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold border transition-all ${
        active
          ? isSkip
            ? 'bg-zinc-700 dark:bg-zinc-600 border-zinc-600 dark:border-zinc-500 text-white'
            : 'bg-red-600 border-red-600 text-white shadow-sm shadow-red-500/25'
          : isSkip
            ? 'border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-500 dark:text-zinc-400 hover:border-zinc-400 dark:hover:border-zinc-500'
            : autoMode
              ? 'border-blue-200 dark:border-blue-900/60 bg-blue-50 dark:bg-blue-900/10 text-blue-600 dark:text-blue-400 hover:border-blue-400'
              : 'border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-300 hover:border-red-300 dark:hover:border-red-800'
      }`}
    >
      {!isSkip && (
        <span className={`text-[9px] font-black tracking-wide ${
          active ? 'text-white/80' : autoMode ? 'text-blue-400' : 'text-zinc-400'
        }`}>
          +
        </span>
      )}
      {label}
    </button>
  );
};

// --- MODAL PRINCIPAL ---
function RegistroEstudoModal({
  onClose,
  addRegistroEstudo,
  cicloId,
  userId,
  disciplinasDoCiclo,
  initialData,
  availableContexts = [],
  defaultContext = null,
  requireExplicitContextSelection = false,
}) {
  const { addXP, checkAndAwardMilestone } = useLevelSystem({ uid: userId });

  const [viewportHeight, setViewportHeight] = useState(window.innerHeight);

  useEffect(() => {
    const handleResize = () => setViewportHeight(window.innerHeight);
    window.addEventListener('resize', handleResize);

    const scrollY = window.scrollY;
    document.body.style.position = 'fixed';
    document.body.style.top = `-${scrollY}px`;
    document.body.style.width = '100%';
    document.body.style.overflow = 'hidden';

    return () => {
      window.removeEventListener('resize', handleResize);
      document.body.style.position = '';
      document.body.style.top = '';
      document.body.style.width = '';
      document.body.style.overflow = '';
      window.scrollTo(0, scrollY);
    };
  }, []);

  const minutesToHoursMinutes = (totalMinutes) => {
    if (!totalMinutes || totalMinutes <= 0) return { horas: 0, minutos: 0 };
    return { horas: Math.floor(totalMinutes / 60), minutos: totalMinutes % 60 };
  };

  const initialTime = minutesToHoursMinutes(initialData?.tempoEstudadoMinutos);

  const [queue, setQueue] = useState([]);
  const [editingQueueId, setEditingQueueId] = useState(null);
  const [showCloseConfirm, setShowCloseConfirm] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const [formData, setFormData] = useState({
    disciplinaId: initialData?.disciplinaId || '',
    data: initialData?.data || getLocalDateString(),
    horas: initialTime.horas,
    minutos: initialTime.minutos,
    questoesFeitas: initialData?.questoesFeitas || 0,
    acertos: initialData?.acertos || 0,
    tipoEstudo: 'Teoria',
    tipoRegistro: initialData?.tipoRegistro || 'estudo',
  });

  const [assuntosDisponiveis, setAssuntosDisponiveis] = useState([]);
  const [selectedAssuntoNome, setSelectedAssuntoNome] = useState('');
  const [loadingAssuntos, setLoadingAssuntos] = useState(false);
  const [markAsFinished, setMarkAsFinished] = useState(false);
  const [revisaoEscolhida, setRevisaoEscolhida] = useState(() => getRevisaoEscolhidaInicial());
  const [revisaoModoCiclo, setRevisaoModoCiclo] = useState(REVISAO_MODO_FLEXIVEL);
  const [checkingFinishedStatus, setCheckingFinishedStatus] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const contextOptions = useMemo(() => {
    const fromProps = Array.isArray(availableContexts) ? availableContexts.filter(c => isRegistroContext(c?.type)) : [];
    if (fromProps.length > 0) return fromProps;
    if (cicloId || (disciplinasDoCiclo || []).length > 0) {
      return [{ type: 'ciclo', id: cicloId, label: 'Ciclo', disciplinas: disciplinasDoCiclo || [] }];
    }
    return [];
  }, [availableContexts, cicloId, disciplinasDoCiclo]);

  const contextTypes = useMemo(() => contextOptions.map(c => c.type), [contextOptions]);
  const hasMultipleContexts = contextTypes.length > 1;

  const [selectedContext, setSelectedContext] = useState(() => {
    if (requireExplicitContextSelection && contextTypes.length > 1) return null;
    if (contextTypes.length === 1) return contextTypes[0];
    if (contextTypes.includes(defaultContext)) return defaultContext;
    return contextTypes[0] || null;
  });

  const hasAcertosError = Number(formData.acertos) > Number(formData.questoesFeitas);
  const isFormDirty = formData.disciplinaId || formData.questoesFeitas > 0 || formData.horas > 0 || queue.length > 0;

  const percentage = useMemo(() => {
    const q = Number(formData.questoesFeitas) || 0;
    const a = Number(formData.acertos) || 0;
    if (a > q) return 0;
    return q > 0 ? Math.min(Math.round((a / q) * 100), 100) : 0;
  }, [formData.questoesFeitas, formData.acertos]);

  const isTimeFromTimer = useMemo(
    () => initialData?.tempoEstudadoMinutos !== undefined && initialData.tempoEstudadoMinutos > 0,
    [initialData]
  );

  const selectedContextMeta = useMemo(
    () => contextOptions.find(c => c.type === selectedContext) || null,
    [contextOptions, selectedContext]
  );

  const selectedContextId = selectedContextMeta?.id || (selectedContext === 'ciclo' ? cicloId : null);

  const disciplinasAtivas = useMemo(() => {
    const source = Array.isArray(selectedContextMeta?.disciplinas) && selectedContextMeta.disciplinas.length > 0
      ? selectedContextMeta.disciplinas
      : (selectedContext === 'ciclo' ? disciplinasDoCiclo : []);
    return (source || []).map(normalizeDisciplina).filter(d => d && d.inCiclo !== false);
  }, [disciplinasDoCiclo, selectedContext, selectedContextMeta]);

  useEffect(() => {
    if (requireExplicitContextSelection && contextTypes.length > 1 && selectedContext === null) return;
    if (contextTypes.length === 1) { setSelectedContext(contextTypes[0]); return; }
    if (selectedContext && contextTypes.includes(selectedContext)) return;
    if (defaultContext && contextTypes.includes(defaultContext)) { setSelectedContext(defaultContext); return; }
    setSelectedContext(contextTypes[0] || null);
  }, [contextTypes, defaultContext, requireExplicitContextSelection, selectedContext]);

  useEffect(() => {
    setFormData(prev => ({ ...prev, disciplinaId: '' }));
    setSelectedAssuntoNome('');
    setAssuntosDisponiveis([]);
    setMarkAsFinished(false);
    setRevisaoEscolhida(getRevisaoEscolhidaPlaceholder(selectedContext, revisaoModoCiclo));
  }, [selectedContext, revisaoModoCiclo]);

  useEffect(() => {
    let ignore = false;
    const carregarModoRevisao = async () => {
      if (selectedContext !== 'ciclo' || !selectedContextId || !userId) {
        if (!ignore) { setRevisaoModoCiclo(REVISAO_MODO_FLEXIVEL); setRevisaoEscolhida('skip'); }
        return;
      }
      try {
        const cicloSnap = await getDoc(doc(db, 'users', userId, 'ciclos', selectedContextId));
        if (!ignore) {
          const modo = normalizeRevisaoModoCiclo(cicloSnap.data()?.revisaoModo);
          setRevisaoModoCiclo(modo);
          setRevisaoEscolhida(prev =>
            prev === null || prev === undefined || prev === 'skip'
              ? getRevisaoEscolhidaPlaceholder('ciclo', modo)
              : prev
          );
        }
      } catch {
        if (!ignore) {
          setRevisaoModoCiclo(REVISAO_MODO_FLEXIVEL);
          setRevisaoEscolhida(getRevisaoEscolhidaPlaceholder('ciclo', REVISAO_MODO_FLEXIVEL));
        }
      }
    };
    carregarModoRevisao();
    return () => { ignore = true; };
  }, [selectedContext, selectedContextId, userId]);

  useEffect(() => {
    if (queue.length === 0) setExpanded(false);
  }, [queue.length]);

  useEffect(() => {
    const fetchAssuntos = async () => {
      if (!formData.disciplinaId || !selectedContext) { setAssuntosDisponiveis([]); return; }
      const disciplinaLocal = disciplinasAtivas.find(d => d.id === formData.disciplinaId);
      if (disciplinaLocal && Array.isArray(disciplinaLocal.assuntos)) {
        setAssuntosDisponiveis(normalizeAssuntos(disciplinaLocal.assuntos));
        return;
      }
      if (selectedContext !== 'ciclo' || !selectedContextId || !userId) { setAssuntosDisponiveis([]); return; }
      setLoadingAssuntos(true);
      try {
        const docRef = doc(db, 'users', userId, 'ciclos', selectedContextId, 'disciplinas', formData.disciplinaId);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) setAssuntosDisponiveis(normalizeAssuntos(docSnap.data().assuntos));
        else setAssuntosDisponiveis([]);
      } catch (error) {
        console.error(error);
        setAssuntosDisponiveis([]);
      } finally {
        setLoadingAssuntos(false);
      }
    };
    fetchAssuntos();
    if (!editingQueueId) { setSelectedAssuntoNome(''); setMarkAsFinished(false); }
  }, [formData.disciplinaId, selectedContext, selectedContextId, userId, disciplinasAtivas, editingQueueId]);

  useEffect(() => {
    if (editingQueueId) return;
    const checkTopic = async () => {
      if (selectedContext !== 'ciclo' || !selectedAssuntoNome || !selectedContextId || !userId || !formData.disciplinaId) {
        setMarkAsFinished(false);
        return;
      }
      setCheckingFinishedStatus(true);
      try {
        const q = query(
          collection(db, 'users', userId, 'registrosEstudo'),
          where('cicloId', '==', selectedContextId),
          where('disciplinaId', '==', formData.disciplinaId),
          where('assunto', '==', selectedAssuntoNome),
          where('tipoEstudo', '==', 'check_manual')
        );
        const snap = await getDocs(q);
        setMarkAsFinished(!snap.empty);
      } catch (e) {
        console.error(e);
      } finally {
        setCheckingFinishedStatus(false);
      }
    };
    checkTopic();
  }, [selectedAssuntoNome, selectedContext, selectedContextId, userId, formData.disciplinaId, editingQueueId]);

  const handleChange = (e) => {
    const { name, value, type } = e.target;
    let val = type === 'number' ? Number(value) : value;
    setFormData(prev => ({ ...prev, [name]: val }));
  };

  const adjustValue = (field, amount) => {
    if (isTimeFromTimer) return;
    setFormData(prev => {
      let newVal = Number(prev[field]) + amount;
      if (newVal < 0) newVal = 0;
      if (field === 'minutos' && newVal > 59) newVal = 59;
      return { ...prev, [field]: newVal };
    });
  };

  const validateForm = () => {
    if (hasAcertosError) { setErrorMessage('Acertos não pode ser maior que questões.'); return false; }
    if (!selectedContext) { setErrorMessage('Escolha se o registro pertence ao ciclo ou ao cronograma.'); return false; }
    const totalMin = (Number(formData.horas || 0) * 60) + Number(formData.minutos || 0);
    if (!formData.disciplinaId || !formData.data || (totalMin <= 0 && formData.questoesFeitas <= 0)) {
      setErrorMessage('Preencha os campos obrigatórios.');
      return false;
    }
    if (!selectedAssuntoNome) { setErrorMessage('Selecione um assunto.'); return false; }
    if (selectedContext === 'ciclo' && formData.tipoRegistro !== 'revisao' && revisaoEscolhida === null) {
      setErrorMessage('Escolha quando revisar ou marque Não revisar.');
      return false;
    }
    return true;
  };

  const handleAddToQueue = () => {
    if (!validateForm()) return;
    setErrorMessage('');
    const totalMin = (Number(formData.horas || 0) * 60) + Number(formData.minutos || 0);
    const discNome = disciplinasAtivas.find(d => d.id === formData.disciplinaId)?.nome || 'Desconhecida';
    const newItem = {
      ...formData,
      contextoRegistro: selectedContext,
      contextId: selectedContextId,
      disciplinaNome: discNome,
      assunto: selectedAssuntoNome,
      tempoTotal: totalMin,
      markAsFinished,
      revisaoEscolhida,
      tipoRegistro: formData.tipoRegistro || 'estudo',
      id: editingQueueId || Date.now()
    };
    if (editingQueueId) {
      setQueue(queue.map(item => item.id === editingQueueId ? newItem : item));
      setEditingQueueId(null);
    } else {
      setQueue([...queue, newItem]);
      setExpanded(true);
    }
    setFormData(prev => ({ ...prev, disciplinaId: '', horas: 0, minutos: 0, questoesFeitas: 0, acertos: 0 }));
    setSelectedAssuntoNome('');
    setMarkAsFinished(false);
    setRevisaoEscolhida(getRevisaoEscolhidaPlaceholder(selectedContext, revisaoModoCiclo));
  };

  const handleEditQueueItem = (item) => {
    setEditingQueueId(item.id);
    const { horas, minutos } = minutesToHoursMinutes(item.tempoTotal);
    setFormData({
      disciplinaId: item.disciplinaId,
      data: item.data,
      horas,
      minutos,
      questoesFeitas: item.questoesFeitas,
      acertos: item.acertos,
      tipoEstudo: item.tipoEstudo,
      tipoRegistro: item.tipoRegistro || 'estudo'
    });
    setTimeout(() => {
      setSelectedAssuntoNome(item.assunto);
      setMarkAsFinished(item.markAsFinished);
      setRevisaoEscolhida(item.revisaoEscolhida ?? getRevisaoEscolhidaPlaceholder(item.contextoRegistro || selectedContext, revisaoModoCiclo));
    }, 100);
  };

  const removeFromQueue = (id) => {
    setQueue(queue.filter(item => item.id !== id));
    if (editingQueueId === id) {
      setEditingQueueId(null);
      setFormData(prev => ({ ...prev, disciplinaId: '', horas: 0, minutos: 0, questoesFeitas: 0, acertos: 0 }));
      setSelectedAssuntoNome('');
      setRevisaoEscolhida(getRevisaoEscolhidaPlaceholder(selectedContext, revisaoModoCiclo));
    }
  };

  const handleCloseRequest = () => {
    if (isFormDirty) setShowCloseConfirm(true);
    else onClose();
  };

  const handleSaveAll = async () => {
    setLoading(true);
    setErrorMessage('');
    let itemsToSave = [...queue];
    if (itemsToSave.length === 0) {
      if (validateForm()) {
        const totalMin = (Number(formData.horas || 0) * 60) + Number(formData.minutos || 0);
        const discNome = disciplinasAtivas.find(d => d.id === formData.disciplinaId)?.nome || 'Desconhecida';
        itemsToSave.push({
          ...formData,
          contextoRegistro: selectedContext,
          contextId: selectedContextId,
          disciplinaNome: discNome,
          assunto: selectedAssuntoNome,
          tempoTotal: totalMin,
          markAsFinished,
          revisaoEscolhida,
          tipoRegistro: formData.tipoRegistro || 'estudo',
        });
      } else {
        setLoading(false);
        return;
      }
    }

    try {
      let totalXP = 0;
      const batch = writeBatch(db);
      for (const item of itemsToSave) {
        await addRegistroEstudo({
          contextoRegistro: item.contextoRegistro || selectedContext,
          ...((item.contextoRegistro || selectedContext) === 'ciclo' && (item.contextId || selectedContextId) ? { cicloId: item.contextId || selectedContextId } : {}),
          ...((item.contextoRegistro || selectedContext) === 'cronograma' && (item.contextId || selectedContextId) ? { cronogramaId: item.contextId || selectedContextId } : {}),
          disciplinaId: item.disciplinaId, disciplinaNome: item.disciplinaNome, assunto: item.assunto,
          data: item.data, timestamp: serverTimestamp(), tempoEstudadoMinutos: item.tempoTotal,
          questoesFeitas: Number(item.questoesFeitas), acertos: Number(item.acertos),
          tipoEstudo: item.tipoRegistro === 'revisao' ? 'revisao' : item.tipoEstudo,
          tipoRegistro: item.tipoRegistro || 'estudo',
          duracaoMinutos: item.tempoTotal,
          questoesAcertadas: Number(item.acertos),
          ...(item.tipoRegistro === 'revisao' ? { isRevisao: true, revisao: true } : {}),
          ...(item.tipoRegistro !== 'revisao' && shouldPersistIntervaloRevisao(item.contextoRegistro || selectedContext, item.revisaoEscolhida)
            ? { intervaloRevisaoDias: item.revisaoEscolhida } : {}),
          ...(item.tipoRegistro !== 'revisao' && (item.contextoRegistro || selectedContext) === 'ciclo' && revisaoModoCiclo === REVISAO_MODO_SUGESTAO
            ? { revisaoAutomaticaCiclo: true } : {}),
        });

        let itemXP = item.tempoTotal + Number(item.questoesFeitas) + Number(item.acertos);
        if (item.questoesFeitas >= 5 && (item.acertos / item.questoesFeitas) >= 0.85) itemXP += 15;
        totalXP += itemXP;

        if ((item.contextoRegistro || selectedContext) === 'ciclo' && item.markAsFinished) {
          const q = query(
            collection(db, 'users', userId, 'registrosEstudo'),
            where('cicloId', '==', item.contextId || selectedContextId),
            where('disciplinaId', '==', item.disciplinaId),
            where('assunto', '==', item.assunto),
            where('tipoEstudo', '==', 'check_manual')
          );
          const snap = await getDocs(q);
          if (snap.empty) {
            await addDoc(collection(db, 'users', userId, 'registrosEstudo'), {
              cicloId: item.contextId || selectedContextId, contextoRegistro: 'ciclo',
              disciplinaId: item.disciplinaId, disciplinaNome: item.disciplinaNome,
              assunto: item.assunto, data: item.data, timestamp: serverTimestamp(),
              tempoEstudadoMinutos: 0, questoesFeitas: 0, acertos: 0,
              tipoEstudo: 'check_manual', obs: 'Concluído via Registro Manual'
            });
          }
        }
      }

      if (totalXP > 0) await addXP(totalXP, 'Sessão de Estudos');
      await checkAndAwardMilestone('FIRST_STUDY');
      setShowSuccess(true);
      setTimeout(() => { setLoading(false); onClose(); }, 1500);
    } catch (error) {
      console.error(error);
      setErrorMessage('Erro ao salvar.');
      setLoading(false);
    }
  };

  const disciplinaOptions = disciplinasAtivas.map(d => ({ value: d.id, label: d.nome }));
  const assuntoOptions = useMemo(() => {
    const base = assuntosDisponiveis.map(a => ({ value: typeof a === 'object' ? a.nome : a, label: typeof a === 'object' ? a.nome : a }));
    if (base.length > 0 || !formData.disciplinaId) return base;
    return [{ value: 'Estudo de Conteúdo', label: 'Estudo de Conteúdo' }];
  }, [assuntosDisponiveis, formData.disciplinaId]);

  const summary = useMemo(() =>
    queue.reduce((acc, curr) => ({ time: acc.time + curr.tempoTotal, questions: acc.questions + curr.questoesFeitas }), { time: 0, questions: 0 }),
    [queue]
  );

  const targetHeight = expanded ? MODAL_EXPANDED_MAX_H_PX : MODAL_COLLAPSED_MAX_H_PX;
  const safeMaxHeight = viewportHeight - 40;
  const finalHeight = Math.min(targetHeight, safeMaxHeight);

  const isAutoRevisao = revisaoModoCiclo === REVISAO_MODO_SUGESTAO;
  const revisaoOptions = [
    { value: 1, label: '1 dia' },
    { value: 7, label: '7 dias' },
    { value: 30, label: '30 dias' },
    { value: 'skip', label: 'Não revisar' },
  ];

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-3 md:p-4 bg-zinc-950/75 backdrop-blur-md"
      onClick={handleCloseRequest}
    >
      <style>{globalStyles}</style>
      <ConfirmCloseModal isOpen={showCloseConfirm} onCancel={() => setShowCloseConfirm(false)} onConfirm={() => { setShowCloseConfirm(false); onClose(); }} />
      <AnimatePresence>{showSuccess && <SuccessToast />}</AnimatePresence>

      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 8 }}
        transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
        style={{ height: finalHeight, maxHeight: finalHeight, width: '100%', maxWidth: `${MODAL_MAX_W_PX}px` }}
        className="bg-white dark:bg-zinc-950 rounded-[24px] shadow-2xl border border-zinc-200/80 dark:border-zinc-800/80 overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── HEADER ── */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-100 dark:border-zinc-800/80 bg-white dark:bg-zinc-950 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-red-600 text-white rounded-xl flex items-center justify-center shadow-md shadow-red-600/25">
              <Save size={18} />
            </div>
            <div>
              <h2 className="text-base font-bold text-zinc-900 dark:text-white leading-tight">Novo Registro</h2>
              <p className="text-[11px] text-zinc-400 dark:text-zinc-500 leading-none mt-0.5">
                {queue.length > 0 ? `${queue.length} item${queue.length > 1 ? 's' : ''} na fila` : 'Registre sua sessão de estudos'}
              </p>
            </div>
          </div>
          <button
            onClick={handleCloseRequest}
            className="p-2 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-500 dark:text-zinc-400 rounded-full transition-colors"
          >
            <X size={17} />
          </button>
        </div>

        <div className="flex flex-1 overflow-hidden flex-col lg:flex-row">
          {/* ── FORM ── */}
          <div className="flex-1 overflow-y-auto px-5 py-5 custom-scrollbar space-y-4 bg-zinc-50/40 dark:bg-zinc-950">

            {/* Error */}
            {errorMessage && (
              <motion.div
                initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}
                className="px-4 py-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-900/50 rounded-xl text-red-600 dark:text-red-400 text-xs font-medium flex items-center gap-2"
              >
                <AlertTriangle size={15} className="shrink-0" /> {errorMessage}
              </motion.div>
            )}

            {/* ── SEÇÃO: CONTEXTO + TIPO ── */}
            <div className="registro-modal-form-section p-4">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">

                {/* CONTEXTO / PLANEJAMENTO */}
                {hasMultipleContexts && (
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-zinc-400 dark:text-zinc-500 mb-2">
                      Planejamento
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {contextOptions.map((context) => {
                        const active = selectedContext === context.type;
                        const isCiclo = context.type === 'ciclo';
                        const label = context.label || (isCiclo ? 'Ciclo' : 'Cronograma');
                        return (
                          <button
                            key={context.type}
                            type="button"
                            onClick={() => setSelectedContext(context.type)}
                            className={`flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold border transition-all ${
                              active
                                ? isCiclo
                                  ? 'context-pill-active-ciclo border-transparent'
                                  : 'context-pill-active-cronograma border-transparent'
                                : 'border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-300 hover:border-zinc-300 dark:hover:border-zinc-600'
                            }`}
                          >
                            <ContextLogo type={context.type} active={active} />
                            <span>{label}</span>
                            {active && (
                              <span className="ml-0.5 opacity-75">
                                <CheckCircle2 size={12} />
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* TIPO DE REGISTRO */}
                <div className={hasMultipleContexts ? 'sm:text-right' : 'w-full'}>
                  <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-zinc-400 dark:text-zinc-500 mb-2">
                    Tipo de Registro
                  </p>
                  <div className="inline-flex items-center gap-1 bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-1">
                    {[
                      { value: 'estudo', label: 'Estudo', icon: BookOpen },
                      { value: 'revisao', label: 'Revisão', icon: RotateCcw },
                    ].map((option) => {
                      const Icon = option.icon;
                      const active = formData.tipoRegistro === option.value;
                      return (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() => {
                            setFormData(prev => ({ ...prev, tipoRegistro: option.value }));
                            if (option.value === 'revisao') {
                              setMarkAsFinished(false);
                              setRevisaoEscolhida('skip');
                            } else {
                              setRevisaoEscolhida(getRevisaoEscolhidaPlaceholder(selectedContext, revisaoModoCiclo));
                            }
                          }}
                          className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition-all ${
                            active
                              ? option.value === 'estudo'
                                ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white shadow-sm border border-zinc-200 dark:border-zinc-700'
                                : 'bg-white dark:bg-zinc-800 text-indigo-600 dark:text-indigo-400 shadow-sm border border-zinc-200 dark:border-zinc-700'
                              : 'text-zinc-400 dark:text-zinc-500 hover:text-zinc-600 dark:hover:text-zinc-400'
                          }`}
                        >
                          <Icon size={13} />
                          {option.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>

            {/* ── SEÇÃO: DISCIPLINA + DATA ── */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="registro-modal-form-section p-4 space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-[0.15em] text-zinc-400 dark:text-zinc-500 block">
                  Disciplina
                </label>
                <div className="relative z-50">
                  <CustomSelect
                    name="disciplinaId"
                    options={disciplinaOptions}
                    value={formData.disciplinaId}
                    onChange={handleChange}
                    placeholder="Selecione a matéria..."
                    icon={BookOpen}
                    disabled={!selectedContext || disciplinasAtivas.length === 0}
                  />
                </div>
              </div>

              <div className="registro-modal-form-section p-4 space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-[0.15em] text-zinc-400 dark:text-zinc-500 block">
                  Data do Estudo
                </label>
                <div className="relative z-40">
                  <CustomDatePicker name="data" value={formData.data} onChange={handleChange} />
                </div>
              </div>
            </div>

            {/* ── SEÇÃO: ASSUNTO (aparece após escolher disciplina) ── */}
            {formData.disciplinaId && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-3"
              >
                <div className="registro-modal-form-section p-4 space-y-2 relative z-30">
                  <label className="text-[10px] font-bold uppercase tracking-[0.15em] text-zinc-400 dark:text-zinc-500 flex items-center justify-between">
                    Assunto
                    {loadingAssuntos && <span className="text-red-500 text-[10px] animate-pulse">carregando...</span>}
                  </label>
                  <CustomSelect
                    name="assunto"
                    options={assuntoOptions}
                    value={selectedAssuntoNome}
                    onChange={(e) => setSelectedAssuntoNome(e.target.value)}
                    placeholder="O que você estudou?"
                    icon={Target}
                    disabled={loadingAssuntos || assuntoOptions.length === 0}
                    loading={loadingAssuntos}
                  />
                </div>

                {/* ── REVISÃO ── */}
                {selectedContext === 'ciclo' && formData.tipoRegistro !== 'revisao' && selectedAssuntoNome && (
                  <div className="registro-modal-form-section p-4 space-y-3 relative z-20">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-zinc-400 dark:text-zinc-500">Agendar Revisão</p>
                        <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                          {isAutoRevisao
                            ? 'Revisões automáticas: 1d, 7d e 30d já agendadas.'
                            : 'Escolha quando este assunto deve voltar.'}
                        </p>
                      </div>
                      {isAutoRevisao && (
                        <span className="text-[10px] font-semibold bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-900/50 px-2 py-1 rounded-lg">
                          Auto
                        </span>
                      )}
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {revisaoOptions.map((option) => (
                        <RevisaoChip
                          key={String(option.value)}
                          value={option.value}
                          label={option.label}
                          active={revisaoEscolhida === option.value}
                          onClick={() => setRevisaoEscolhida(option.value)}
                          autoMode={isAutoRevisao && option.value !== 'skip'}
                        />
                      ))}
                    </div>
                  </div>
                )}

                {/* ── MARCAR COMO CONCLUÍDO ── */}
                {selectedContext === 'ciclo' && formData.tipoRegistro !== 'revisao' && selectedAssuntoNome && (
                  <button
                    type="button"
                    onClick={() => setMarkAsFinished(!markAsFinished)}
                    className={`w-full flex items-center gap-3 p-3.5 rounded-xl border transition-all text-left ${
                      markAsFinished
                        ? 'bg-emerald-50 dark:bg-emerald-900/10 border-emerald-300 dark:border-emerald-800'
                        : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 hover:border-emerald-200 dark:hover:border-emerald-900'
                    }`}
                  >
                    <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-colors ${
                      markAsFinished
                        ? 'bg-emerald-500 border-emerald-500 text-white'
                        : 'border-zinc-300 dark:border-zinc-600'
                    }`}>
                      {checkingFinishedStatus
                        ? <div className="w-3 h-3 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
                        : markAsFinished ? <CheckSquare size={12} strokeWidth={3} /> : null
                      }
                    </div>
                    <div>
                      <p className={`text-sm font-semibold ${markAsFinished ? 'text-emerald-700 dark:text-emerald-400' : 'text-zinc-700 dark:text-zinc-300'}`}>
                        {markAsFinished ? 'Tópico marcado como concluído' : 'Marcar tópico como concluído'}
                      </p>
                      <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-0.5">
                        {markAsFinished ? 'Este assunto está finalizado no ciclo.' : 'Indica que você finalizou este assunto.'}
                      </p>
                    </div>
                  </button>
                )}
              </motion.div>
            )}

            <div className="h-px bg-zinc-100 dark:bg-zinc-800" />

            {/* ── SEÇÃO: TEMPO + QUESTÕES ── */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 relative z-0">

              {/* Tempo */}
              <div className="registro-modal-form-section p-4 space-y-3">
                <div className="flex items-center gap-1.5">
                  <Clock size={13} className="text-amber-500" />
                  <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-zinc-400 dark:text-zinc-500">
                    Tempo Estudado
                  </span>
                  {isTimeFromTimer && (
                    <span className="ml-auto text-[9px] font-bold bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 px-2 py-0.5 rounded-full">
                      Timer
                    </span>
                  )}
                </div>
                <div className="flex gap-2">
                  {/* Horas */}
                  <div className="flex-1 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-2.5 flex flex-col items-center relative focus-within:border-amber-400 transition-colors">
                    <input
                      type="number"
                      name="horas"
                      value={formData.horas}
                      onChange={handleChange}
                      min="0"
                      disabled={isTimeFromTimer}
                      className="w-full text-center text-2xl font-black bg-transparent outline-none text-zinc-800 dark:text-white disabled:opacity-50"
                    />
                    <span className="text-[9px] font-bold text-zinc-400 uppercase tracking-wider">Horas</span>
                    {!isTimeFromTimer && (
                      <div className="absolute right-0 top-0 bottom-0 flex flex-col justify-center px-1">
                        <button type="button" onClick={() => adjustValue('horas', 1)} className="p-1 text-zinc-300 hover:text-amber-500 transition-colors"><ChevronUp size={14} /></button>
                        <button type="button" onClick={() => adjustValue('horas', -1)} className="p-1 text-zinc-300 hover:text-amber-500 transition-colors"><ChevronDown size={14} /></button>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center text-zinc-300 dark:text-zinc-700 font-black text-lg pb-4">:</div>
                  {/* Minutos */}
                  <div className="flex-1 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-2.5 flex flex-col items-center relative focus-within:border-amber-400 transition-colors">
                    <input
                      type="number"
                      name="minutos"
                      value={formData.minutos}
                      onChange={handleChange}
                      min="0"
                      max="59"
                      disabled={isTimeFromTimer}
                      className="w-full text-center text-2xl font-black bg-transparent outline-none text-zinc-800 dark:text-white disabled:opacity-50"
                    />
                    <span className="text-[9px] font-bold text-zinc-400 uppercase tracking-wider">Min</span>
                    {!isTimeFromTimer && (
                      <div className="absolute right-0 top-0 bottom-0 flex flex-col justify-center px-1">
                        <button type="button" onClick={() => adjustValue('minutos', 5)} className="p-1 text-zinc-300 hover:text-amber-500 transition-colors"><ChevronUp size={14} /></button>
                        <button type="button" onClick={() => adjustValue('minutos', -5)} className="p-1 text-zinc-300 hover:text-amber-500 transition-colors"><ChevronDown size={14} /></button>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Questões */}
              <div className={`registro-modal-form-section p-4 space-y-3 transition-all ${hasAcertosError ? '!border-rose-400 dark:!border-rose-700 !bg-rose-50 dark:!bg-rose-900/10' : ''}`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    {hasAcertosError
                      ? <AlertCircle size={13} className="text-rose-500" />
                      : <Target size={13} className="text-emerald-500" />
                    }
                    <span className={`text-[10px] font-bold uppercase tracking-[0.15em] ${hasAcertosError ? 'text-rose-500' : 'text-zinc-400 dark:text-zinc-500'}`}>
                      Questões
                    </span>
                  </div>
                  <span className={`text-[10px] font-semibold ${hasAcertosError ? 'text-rose-500' : 'text-zinc-400'}`}>
                    {hasAcertosError ? '⚠ Erro' : percentage > 0 ? `${percentage}% de aproveitamento` : ''}
                  </span>
                </div>

                <div className="flex gap-2">
                  <div className="flex-1 text-center">
                    <label className={`text-[9px] font-bold uppercase block mb-1 ${hasAcertosError ? 'text-rose-400' : 'text-zinc-400'}`}>Feitas</label>
                    <input
                      type="number"
                      name="questoesFeitas"
                      value={formData.questoesFeitas}
                      onChange={handleChange}
                      min="0"
                      className={`w-full border rounded-xl py-2.5 px-2 text-center font-black text-xl outline-none transition-all ${
                        hasAcertosError
                          ? 'bg-white dark:bg-zinc-900 border-rose-300 dark:border-rose-700 text-rose-600'
                          : 'bg-zinc-50 dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-800 dark:text-white focus:border-zinc-400'
                      }`}
                    />
                  </div>
                  <div className="flex items-center text-zinc-300 dark:text-zinc-700 font-black text-sm pb-5">/</div>
                  <div className="flex-1 text-center">
                    <label className={`text-[9px] font-bold uppercase block mb-1 ${hasAcertosError ? 'text-rose-400' : 'text-zinc-400'}`}>Acertos</label>
                    <input
                      type="number"
                      name="acertos"
                      value={formData.acertos}
                      onChange={handleChange}
                      min="0"
                      className={`w-full border rounded-xl py-2.5 px-2 text-center font-black text-xl outline-none transition-all ${
                        hasAcertosError
                          ? 'bg-rose-100 dark:bg-rose-900/20 border-rose-500 text-rose-700 dark:text-rose-400'
                          : 'bg-zinc-50 dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-emerald-600 dark:text-emerald-400 focus:border-emerald-400'
                      }`}
                    />
                  </div>
                </div>

                {hasAcertosError && (
                  <p className="text-[10px] text-rose-500 font-semibold text-center">Acertos não pode exceder o total de questões</p>
                )}
              </div>
            </div>
          </div>

          {/* ── FILA ── */}
          {queue.length > 0 && (
            <div className={`w-full lg:w-72 bg-white dark:bg-zinc-900/50 border-t lg:border-t-0 lg:border-l border-zinc-100 dark:border-zinc-800 p-3 lg:p-4 flex flex-col shrink-0 overflow-hidden h-[${QUEUE_MOBILE_H_PX}px] lg:h-auto`}>
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-widest flex items-center gap-1.5">
                  <Layers size={13} /> Fila ({queue.length})
                </h4>
                <span className="lg:hidden text-[10px] font-semibold text-zinc-400">
                  {Math.floor(summary.time / 60)}h {summary.time % 60}m • {summary.questions}q
                </span>
              </div>

              <div className="flex-1 overflow-hidden">
                <div className="flex lg:flex-col gap-2 overflow-x-auto lg:overflow-y-auto custom-scrollbar pr-1 pb-1 lg:pb-0">
                  <AnimatePresence>
                    {queue.map((item) => (
                      <motion.div
                        key={item.id}
                        layout
                        initial={{ opacity: 0, scale: 0.92 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.92 }}
                        className={`bg-zinc-50 dark:bg-zinc-900 border rounded-xl p-3 relative group transition-all ${
                          editingQueueId === item.id
                            ? 'border-amber-400 ring-1 ring-amber-400/20'
                            : 'border-zinc-200 dark:border-zinc-800'
                        } min-w-[${QUEUE_CARD_MIN_W_MOBILE}px] lg:min-w-0`}
                      >
                        <div className="pr-8">
                          <h5 className="text-xs font-semibold text-zinc-800 dark:text-white line-clamp-1">{item.disciplinaNome}</h5>
                          <p className="text-[10px] text-zinc-500 dark:text-zinc-400 line-clamp-1 mt-0.5">{item.assunto}</p>
                          <div className="flex flex-wrap gap-1.5 mt-2">
                            {item.tempoTotal > 0 && (
                              <span className="text-[9px] font-semibold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 px-1.5 py-0.5 rounded-md flex items-center gap-1">
                                <Clock size={9} /> {Math.floor(item.tempoTotal / 60)}h {item.tempoTotal % 60}m
                              </span>
                            )}
                            {item.questoesFeitas > 0 && (
                              <span className="text-[9px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 px-1.5 py-0.5 rounded-md flex items-center gap-1">
                                <Target size={9} /> {item.acertos}/{item.questoesFeitas}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="absolute right-2 top-2 flex flex-col gap-1">
                          <button onClick={() => handleEditQueueItem(item)} className="p-1 text-zinc-300 hover:text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-900/20 rounded-lg transition-colors">
                            <Edit3 size={12} />
                          </button>
                          <button onClick={() => removeFromQueue(item.id)} className="p-1 text-zinc-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors">
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
              </div>

              <div className="hidden lg:block mt-3 pt-3 border-t border-zinc-100 dark:border-zinc-800">
                <div className="flex justify-between items-center text-[10px] text-zinc-400 dark:text-zinc-500 mb-1">
                  <span>Tempo total</span>
                  <span className="font-semibold text-zinc-700 dark:text-zinc-300">{Math.floor(summary.time / 60)}h {summary.time % 60}m</span>
                </div>
                <div className="flex justify-between items-center text-[10px] text-zinc-400 dark:text-zinc-500">
                  <span>Questões</span>
                  <span className="font-semibold text-zinc-700 dark:text-zinc-300">{summary.questions}</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ── FOOTER ── */}
        <div className={`${FOOTER_PADDING_MOBILE} ${FOOTER_PADDING_DESKTOP} bg-white dark:bg-zinc-950 border-t border-zinc-100 dark:border-zinc-800 shrink-0 relative z-50 flex items-center gap-2`}>
          {/* Adicionar outro */}
          <button
            type="button"
            onClick={handleAddToQueue}
            disabled={hasAcertosError || !formData.disciplinaId}
            className={`flex-1 py-2.5 px-3 rounded-xl border border-dashed text-xs font-semibold transition-all flex items-center justify-center gap-1.5 ${
              hasAcertosError || !formData.disciplinaId
                ? 'border-zinc-200 dark:border-zinc-800 text-zinc-300 dark:text-zinc-700 cursor-not-allowed'
                : 'border-zinc-300 dark:border-zinc-700 text-zinc-500 dark:text-zinc-400 hover:border-red-400 hover:text-red-500 hover:bg-red-50 dark:hover:border-red-800 dark:hover:bg-red-900/10'
            }`}
          >
            {editingQueueId ? <><Save size={14} /> Atualizar</> : <><Plus size={14} /> Adicionar à fila</>}
          </button>

          {/* Cancelar */}
          <button
            type="button"
            onClick={handleCloseRequest}
            disabled={loading}
            className="px-4 py-2.5 rounded-xl text-xs font-semibold text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors disabled:opacity-50"
          >
            Cancelar
          </button>

          {/* Salvar */}
          <button
            onClick={handleSaveAll}
            disabled={loading || (queue.length === 0 && hasAcertosError && !formData.disciplinaId)}
            className={`relative overflow-hidden px-5 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wide text-white shadow-lg transition-all flex items-center justify-center gap-2 ${
              loading
                ? 'bg-zinc-400 cursor-not-allowed'
                : 'bg-red-600 hover:bg-red-700 shadow-red-600/25 hover:-translate-y-px active:translate-y-0'
            } ${loading ? '' : 'btn-shimmer'}`}
          >
            <div className="relative z-10 flex items-center justify-center gap-2">
              {loading
                ? <SaveButtonLoading />
                : <><Save size={15} /> {queue.length > 0 ? `Salvar (${queue.length})` : 'Confirmar'}</>
              }
            </div>
          </button>
        </div>
      </motion.div>
    </div>
  );
}

export default RegistroEstudoModal;