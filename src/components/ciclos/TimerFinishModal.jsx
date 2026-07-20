import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  CheckCircle2, XCircle, Target, Save, Clock,
  BookOpen, List, AlertTriangle, CheckSquare, RotateCcw,
  Trash2, Split, X, AlertCircle, ChevronDown, ChevronUp, LogOut, Plus
} from 'lucide-react';
import { db } from '../../firebaseConfig';
import {
  doc, getDoc, collection, getDocs, query, where,
  writeBatch, Timestamp, increment, setDoc, updateDoc, arrayUnion, onSnapshot
} from 'firebase/firestore';
import { useLevelSystem } from '../../hooks/useLevelSystem';
import {
  getRevisaoEscolhidaInicial,
  getRevisaoEscolhidaPlaceholder,
  normalizeRevisaoModoCiclo,
  REVISAO_MODO_FLEXIVEL,
  REVISAO_MODO_SUGESTAO,
  shouldPersistIntervaloRevisao,
} from '../../utils/cicloReviewMode';

// ----------------------------------------------------
// UTILITÁRIOS
// ----------------------------------------------------
const normalize = (str) =>
  str ? str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase() : '';

const buildDraftKey = ({ uid, cicloId, disciplinaNome, timeMinutes }) => {
  const d = normalize(disciplinaNome || 'disciplina');
  return `ModoQAP:TimerDraftV11:${uid}:${cicloId}:${d}:${timeMinutes}`;
};

const safeJsonParse = (str) => {
  try { return JSON.parse(str); } catch { return null; }
};

const minutesToHoursMinutes = (totalMinutes) => {
  if (!totalMinutes || totalMinutes <= 0) return { horas: 0, minutos: 0 };
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return { horas: h, minutos: m };
};

const dateToYMDLocal = (date = new Date()) => {
  const d = date.getDate();
  const m = date.getMonth() + 1;
  const y = date.getFullYear();
  return `${y}-${m <= 9 ? '0' + m : m}-${d <= 9 ? '0' + d : d}`;
};

const resolveIntervaloRevisao = (topic) => {
  if (topic?.revisaoEscolhida === 'custom') {
    const dias = Number(topic?.revisaoPersonalizadaDias);
    return Number.isFinite(dias) && dias >= 1 ? Math.floor(dias) : null;
  }
  return topic?.revisaoEscolhida;
};

// =======================================================
// 🔧 UTILITÁRIO — Persistir nova disciplina / assunto no ciclo
// Garante que o que foi digitado aparece no edital igual ao wizard
// =======================================================
const persistirNovosCamposNoCiclo = async (userId, cicloId, disciplinasExistentes, itens) => {
  if (!userId || !cicloId || !itens?.length) return;

  const porDisc = new Map();
  for (const item of itens) {
    const key = item.disciplinaId || item.disciplinaNome;
    if (!porDisc.has(key)) porDisc.set(key, { disciplinaId: key, disciplinaNome: item.disciplinaNome, assuntos: new Set() });
    if (item.assunto) porDisc.get(key).assuntos.add(item.assunto);
  }

  const promessas = [];
  for (const { disciplinaId, disciplinaNome, assuntos } of porDisc.values()) {
    const assuntosArray = Array.from(assuntos);
    const discRef = doc(db, 'users', userId, 'ciclos', cicloId, 'disciplinas', disciplinaId);

    const existeNaLista = disciplinasExistentes.some(d => d.id === disciplinaId || d.nome === disciplinaNome);

    if (existeNaLista) {
      if (assuntosArray.length > 0) {
        promessas.push(
          updateDoc(discRef, { assuntos: arrayUnion(...assuntosArray) }).catch(() => {})
        );
      }
    } else {
      promessas.push(
        setDoc(discRef, {
          nome: disciplinaNome,
          peso: 3,
          assuntos: assuntosArray,
          tempoAlocadoSemanalMinutos: 0,
          inCiclo: true,
          criadaViRegistro: true,
        }, { merge: true }).catch(() => {})
      );
    }
  }

  await Promise.all(promessas);
};

// ----------------------------------------------------
// 🔧 COMBOBOX — Selecionar OU digitar para criar novo
// ----------------------------------------------------
const ComboBox = ({
  options,
  value,
  onChange,
  placeholder,
  icon: Icon,
  disabled,
  loading,
  allowCreate = true,
  createLabel = 'Criar',
  emptyLabel = 'Nenhum item disponível',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [inputText, setInputText] = useState('');
  const [focused, setFocused] = useState(false);
  const containerRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    if (!focused) {
      const selected = options.find(o => o.value === value);
      setInputText(selected ? selected.label : value || '');
    }
  }, [value, options, focused]);

  useEffect(() => {
    const h = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
        setFocused(false);
        const selected = options.find(o => o.value === value);
        setInputText(selected ? selected.label : value || '');
      }
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [value, options]);

  const filtered = useMemo(() => {
    if (!inputText.trim()) return options;
    const term = inputText.trim().toLowerCase();
    return options.filter(o => o.label.toLowerCase().includes(term));
  }, [inputText, options]);

  const showCreateOption =
    allowCreate &&
    inputText.trim().length > 0 &&
    !options.some(o => o.label.toLowerCase() === inputText.trim().toLowerCase());

  const handleSelect = (val, label) => {
    onChange(val);
    setInputText(label);
    setIsOpen(false);
    setFocused(false);
  };

  const handleCreate = () => {
    const newVal = inputText.trim();
    if (!newVal) return;
    onChange(newVal);
    setIsOpen(false);
    setFocused(false);
  };

  const handleInputChange = (e) => {
    setInputText(e.target.value);
    setIsOpen(true);
  };

  const handleFocus = () => {
    if (disabled) return;
    setFocused(true);
    setIsOpen(true);
    setInputText('');
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (showCreateOption) handleCreate();
      else if (filtered.length === 1) handleSelect(filtered[0].value, filtered[0].label);
    }
    if (e.key === 'Escape') {
      setIsOpen(false);
      setFocused(false);
      const selected = options.find(o => o.value === value);
      setInputText(selected ? selected.label : value || '');
    }
  };

  return (
    <div className="relative" ref={containerRef}>
      <div
        className={`w-full flex items-center bg-white dark:bg-zinc-950 border rounded-xl transition-all
          ${isOpen || focused ? 'border-red-500' : 'border-zinc-300 dark:border-zinc-700'}
          ${disabled ? 'opacity-60 cursor-not-allowed' : ''}
        `}
      >
        {Icon && (
          <div className="pl-3 pr-1 shrink-0 text-zinc-400 pointer-events-none">
            <Icon size={15} />
          </div>
        )}
        <input
          ref={inputRef}
          type="text"
          value={inputText}
          onChange={handleInputChange}
          onFocus={handleFocus}
          onKeyDown={handleKeyDown}
          placeholder={loading ? 'Carregando...' : placeholder}
          disabled={disabled}
          className="flex-1 py-3 px-2 text-xs md:text-sm font-bold bg-transparent outline-none text-zinc-800 dark:text-white placeholder:text-zinc-400  min-w-0"
        />
        <div className="pr-3 pl-1 shrink-0 text-zinc-400 pointer-events-none">
          {loading
            ? <div className="animate-spin h-4 w-4 border-2 border-red-500 border-t-transparent rounded-full" />
            : <ChevronDown size={15} className={`transition-transform ${isOpen ? 'rotate-180' : ''}`} />
          }
        </div>
      </div>

      <AnimatePresence>
        {isOpen && !disabled && (
          <motion.div
            initial={{ opacity: 0, y: -5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -5 }}
            transition={{ duration: 0.12 }}
          className="absolute z-[220] w-full mt-1 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-700 rounded-xl shadow-2xl max-h-48 overflow-y-auto custom-scrollbar"
            style={{ '--scrollbar-thumb': '#e4e4e7' }}
          >
            <div className="p-1">
              {showCreateOption && (
                <div
                  onMouseDown={(e) => { e.preventDefault(); handleCreate(); }}
                  className="flex items-center gap-2 px-3 py-2.5 rounded-lg cursor-pointer bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors"
                >
                  <div className="w-5 h-5 bg-red-600 text-white rounded-md flex items-center justify-center shrink-0">
                    <Plus size={12} strokeWidth={3} />
                  </div>
                  <div className="flex flex-col min-w-0">
                    <span className="text-[10px] font-black uppercase tracking-wider opacity-70">{createLabel}</span>
                    <span className="text-xs font-bold truncate">"{inputText.trim()}"</span>
                  </div>
                </div>
              )}

              {filtered.length > 0 ? (
                filtered.map((opt) => (
                  <div
                    key={opt.value}
                    onMouseDown={(e) => { e.preventDefault(); handleSelect(opt.value, opt.label); }}
                    className={`px-3 py-2.5 rounded-lg text-xs md:text-sm cursor-pointer transition-colors flex items-center justify-between
                      ${value === opt.value
                        ? 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 font-bold'
                        : 'text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800'
                      }`}
                  >
                    <span className="truncate">{opt.label}</span>
                    {value === opt.value && <CheckCircle2 size={13} className="shrink-0 ml-2" />}
                  </div>
                ))
              ) : !showCreateOption ? (
                <div className="p-4 text-center text-xs text-zinc-400">{emptyLabel}</div>
              ) : null}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// ----------------------------------------------------
// COMPONENTES VISUAIS
// ----------------------------------------------------
const timerFinishStyles = `
  .custom-scrollbar::-webkit-scrollbar { width: 4px; height: 4px; }
  .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
  .custom-scrollbar::-webkit-scrollbar-thumb { background: #d4d4d8; border-radius: 10px; }
  .dark .custom-scrollbar::-webkit-scrollbar-thumb { background: #3f3f46; }

  .registro-modal-form-section {
    position: relative;
    overflow: visible;
    background: #ededee;
    border-radius: 18px;
    border: 1px solid rgba(161, 161, 170, 0.58);
    box-shadow: 0 10px 24px rgba(15, 23, 42, 0.08), inset 0 1px 0 rgba(255,255,255,0.66);
    transition: border-color 0.25s ease, box-shadow 0.25s ease, transform 0.25s ease, background 0.25s ease;
  }
  .dark .registro-modal-form-section {
    background: #171717;
    border-color: rgba(82, 82, 91, 0.86);
    box-shadow: 0 14px 32px rgba(0, 0, 0, 0.34), inset 0 1px 0 rgba(255,255,255,0.05);
  }
  .registro-modal-form-section::before {
    content: "";
    position: absolute;
    inset: 0;
    pointer-events: none;
    border-radius: inherit;
    background:
      linear-gradient(90deg, rgba(239,68,68,0.06), transparent 32%),
      radial-gradient(circle at top left, rgba(239,68,68,0.04), transparent 42%);
    opacity: 0;
    transition: opacity 0.25s ease;
  }
  .registro-modal-form-section:focus-within {
    border-color: rgba(113, 113, 122, 0.88);
    box-shadow: 0 0 0 2px rgba(113, 113, 122, 0.14), 0 12px 28px rgba(15, 23, 42, 0.10), inset 0 1px 0 rgba(255,255,255,0.08);
    transform: translateY(-1px);
  }
  .registro-modal-form-section:focus-within::before { opacity: 1; }
  .registro-modal-form-section:hover {
    border-color: rgba(161, 161, 170, 0.78);
    box-shadow: 0 12px 28px rgba(15, 23, 42, 0.10), inset 0 1px 0 rgba(255,255,255,0.72);
  }
  .dark .registro-modal-form-section:hover {
    border-color: rgba(113, 113, 122, 0.88);
    box-shadow: 0 16px 34px rgba(0, 0, 0, 0.42), inset 0 1px 0 rgba(255,255,255,0.06);
  }
  .registro-modal-header { background: rgba(237, 237, 238, 0.96); }
  .dark .registro-modal-header { background: rgba(5, 5, 5, 0.98) !important; border-color: rgba(39, 39, 42, 0.95) !important; }
  .registro-section-kicker {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    color: #52525b;
    font-size: 9px;
    font-weight: 900;
    letter-spacing: 0.18em;
    text-transform: uppercase;
  }
  .dark .registro-section-kicker { color: #d4d4d8; }
  .registro-section-kicker::before {
    content: "";
    width: 4px;
    height: 4px;
    border-radius: 999px;
    background: #ef4444;
    box-shadow: 0 0 8px rgba(239, 68, 68, 0.60);
  }
  .registro-flow-strip {
    background: linear-gradient(90deg, #ef4444, #dc2626, #991b1b, #ef4444);
    background-size: 220% 100%;
    animation: registro-flow 6s ease-in-out infinite;
  }
  @keyframes registro-flow {
    0%, 100% { background-position: 0% 50%; }
    50% { background-position: 100% 50%; }
  }
  .registro-small-label {
    color: #52525b;
    font-weight: 900;
  }
  .dark .registro-small-label {
    color: #e4e4e7;
  }
  .registro-ambient-grid {
    background-image:
      linear-gradient(rgba(161, 161, 170, 0.18) 1px, transparent 1px),
      linear-gradient(90deg, rgba(161, 161, 170, 0.18) 1px, transparent 1px);
    background-size: 28px 28px;
  }
  .dark .registro-ambient-grid {
    background-image:
      linear-gradient(rgba(255, 255, 255, 0.035) 1px, transparent 1px),
      linear-gradient(90deg, rgba(255, 255, 255, 0.035) 1px, transparent 1px);
  }
  .revisao-chip {
    position: relative;
    overflow: hidden;
    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  }
  .revisao-chip:active { transform: scale(0.95); }
`;

const SuccessToast = () => (
  <motion.div
    initial={{ opacity: 0, y: -50, x: 50 }}
    animate={{ opacity: 1, y: 0, x: 0 }}
    exit={{ opacity: 0, y: -20 }}
    className="fixed top-6 right-6 z-[10005] bg-white dark:bg-zinc-900 border border-emerald-500/20 shadow-2xl rounded-2xl p-4 flex items-center gap-4 max-w-sm pointer-events-none"
  >
    <div className="w-10 h-10 bg-emerald-500 text-white rounded-full flex items-center justify-center shadow-lg shadow-emerald-500/30">
      <CheckCircle2 size={20} />
    </div>
    <div>
      <h4 className="text-sm font-black text-zinc-800 dark:text-white">Registrado!</h4>
      <p className="text-xs text-zinc-500 dark:text-zinc-400 font-medium">Seus estudos foram salvos com sucesso.</p>
    </div>
  </motion.div>
);

const ConfirmCloseModal = ({ isOpen, onConfirm, onCancel, title, desc, confirmText, icon: Icon = LogOut }) => {
  if (!isOpen) return null;
  return (
    <div className="absolute inset-0 z-[10001] bg-black/50 backdrop-blur-sm flex items-center justify-center p-6 rounded-[32px]" onClick={(e) => e.stopPropagation()}>
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
        className="bg-white dark:bg-zinc-900 p-6 rounded-2xl shadow-2xl border border-zinc-200 dark:border-zinc-800 w-full max-w-xs text-center"
      >
        <div className="w-12 h-12 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center mx-auto mb-3">
          <Icon size={24} />
        </div>
        <h3 className="text-lg font-bold text-zinc-900 dark:text-white mb-2">{title}</h3>
        <p className="text-xs text-zinc-500 mb-6">{desc}</p>
        <div className="flex gap-3">
          <button onClick={onCancel} className="flex-1 py-2.5 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 font-bold text-xs hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors">Voltar</button>
          <button onClick={onConfirm} className="flex-1 py-2.5 rounded-xl bg-red-600 text-white font-bold text-xs hover:bg-red-700 transition-colors">{confirmText}</button>
        </div>
      </motion.div>
    </div>
  );
};

const TimeInputControl = ({ currentMinutes, onTimeChange }) => {
  const { horas, minutos } = minutesToHoursMinutes(currentMinutes);

  const handleAdjust = (type, amount) => {
    let newTotal = currentMinutes;
    if (type === 'horas') newTotal += amount * 60;
    if (type === 'minutos') newTotal += amount;
    if (newTotal < 0) newTotal = 0;
    onTimeChange(newTotal);
  };

  const handleManualInput = (type, valStr) => {
    let val = parseInt(valStr);
    if (isNaN(val) || val < 0) val = 0;
    let newTotal = 0;
    if (type === 'horas') newTotal = (val * 60) + minutos;
    if (type === 'minutos') { if (val > 59) val = 59; newTotal = (horas * 60) + val; }
    onTimeChange(newTotal);
  };

  return (
    <div className="registro-modal-form-section p-2 md:p-2 space-y-1.5">
      <div className="flex items-center gap-2 mb-1">
        <span className="registro-section-kicker">
          Tempo de Estudo
        </span>
        <span className="ml-auto text-[8px] font-black uppercase tracking-widest bg-zinc-200 dark:bg-[#333] text-zinc-800 dark:text-zinc-200 px-1.5 py-0.5 rounded-md">
          Timer On
        </span>
      </div>
      <div className="flex gap-2">
        <div className="flex-1 bg-white/90 dark:bg-white/5 border border-zinc-200 dark:border-white/10 rounded-xl px-2 py-0.5 flex flex-col items-center relative group focus-within:border-zinc-400 dark:focus-within:border-zinc-500 transition-all shadow-inner">
          <input type="number" value={horas} onChange={(e) => handleManualInput('horas', e.target.value)} min="0" className="w-full text-center text-lg md:text-base font-black bg-transparent outline-none text-zinc-900 dark:text-white z-10" />
          <span className="registro-small-label text-[8px] uppercase tracking-widest mt-0.5">Horas</span>
          <div className="absolute right-1 top-0 bottom-0 flex flex-col justify-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity z-20">
            <button type="button" onClick={() => handleAdjust('horas', 1)} className="p-0.5 text-zinc-400 hover:text-zinc-800 dark:hover:text-white"><ChevronUp size={14} /></button>
            <button type="button" onClick={() => handleAdjust('horas', -1)} className="p-0.5 text-zinc-400 hover:text-zinc-800 dark:hover:text-white"><ChevronDown size={14} /></button>
          </div>
        </div>
        <div className="flex items-center text-zinc-400 font-black text-base pb-3">:</div>
        <div className="flex-1 bg-white/90 dark:bg-white/5 border border-zinc-200 dark:border-white/10 rounded-xl px-2 py-0.5 flex flex-col items-center relative group focus-within:border-zinc-400 dark:focus-within:border-zinc-500 transition-all shadow-inner">
          <input type="number" value={minutos} onChange={(e) => handleManualInput('minutos', e.target.value)} min="0" max="59" className="w-full text-center text-lg md:text-base font-black bg-transparent outline-none text-zinc-900 dark:text-white z-10" />
          <span className="registro-small-label text-[8px] uppercase tracking-widest mt-0.5">Minutos</span>
          <div className="absolute right-1 top-0 bottom-0 flex flex-col justify-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity z-20">
            <button type="button" onClick={() => handleAdjust('minutos', 1)} className="p-0.5 text-zinc-400 hover:text-zinc-800 dark:hover:text-white"><ChevronUp size={14} /></button>
            <button type="button" onClick={() => handleAdjust('minutos', -1)} className="p-0.5 text-zinc-400 hover:text-zinc-800 dark:hover:text-white"><ChevronDown size={14} /></button>
          </div>
        </div>
      </div>
    </div>
  );
};

const RevisaoChip = ({ value, label, active, onClick, autoMode }) => (
  <button
    type="button"
    onClick={onClick}
    className={`revisao-chip flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[11px] font-semibold border transition-all ${
      active
        ? 'bg-red-600 text-white border-red-600 shadow-md shadow-red-500/20'
        : autoMode
          ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-300 dark:border-emerald-900/50'
          : 'bg-white/80 text-zinc-600 border-zinc-200 hover:border-red-300 hover:text-red-600 dark:bg-zinc-900 dark:text-zinc-300 dark:border-zinc-800'
    }`}
  >
    <span>{label}</span>
  </button>
);

// ----------------------------------------------------
// COMPONENTE PRINCIPAL
// ----------------------------------------------------
function TimerFinishModal({
  timeMinutes,
  disciplinaNome,
  activeCicloId,
  userUid,
  addRegistroEstudo,
  availableContexts = [],
  defaultContext = null,
  requireExplicitContextSelection = false,
  onConfirm,
  onCancel,
  onDiscard,
  initialAssunto,
  activeCicloData,
  sessaoGlobalIndex = null,
}) {
  const { addXP, checkAndAwardMilestone } = useLevelSystem({ uid: userUid });

  const draftKey = useMemo(
    () => buildDraftKey({ uid: userUid, cicloId: activeCicloId, disciplinaNome, timeMinutes }),
    [userUid, activeCicloId, disciplinaNome, timeMinutes]
  );

  const [step, setStep] = useState(2);
  const [hasQuestions, setHasQuestions] = useState(true);
  const [topics, setTopics] = useState([{
    id: 'initial',
    assunto: initialAssunto || '',
    minutes: timeMinutes || 0,
    questions: 0,
    correct: 0,
    revisaoEscolhida: getRevisaoEscolhidaInicial(),
    revisaoPersonalizadaDias: 14,
    markAsFinished: false,
    teoriaNaoFinalizadaCiclo: false,
    naoConcluidoCronograma: false,
  }]);

  const [loadingAssuntos, setLoadingAssuntos] = useState(false);
  const [disciplinaManual, setDisciplinaManual] = useState('');
  const [todasDisciplinas, setTodasDisciplinas] = useState([]);
  const [erroDisciplina, setErroDisciplina] = useState(false);
  const [assuntosDisponiveis, setAssuntosDisponiveis] = useState([]);
  // Assuntos criados pelo usuário durante essa sessão
  const [assuntosExtras, setAssuntosExtras] = useState([]);

  const [errorMessage, setErrorMessage] = useState('');
  const [showDiscardModal, setShowDiscardModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccessToast, setShowSuccessToast] = useState(false);
  const [revisaoModoCiclo, setRevisaoModoCiclo] = useState(REVISAO_MODO_FLEXIVEL);
  const [tipoRegistro, setTipoRegistro] = useState('estudo');
  const contextTypes = useMemo(
    () => availableContexts.map((context) => context?.type).filter(Boolean),
    [availableContexts]
  );
  const hasMultipleContexts = contextTypes.length > 1;
  const [selectedContext, setSelectedContext] = useState(() => {
    if (requireExplicitContextSelection && contextTypes.length > 1) return null;
    if (contextTypes.length === 1) return contextTypes[0];
    if (contextTypes.includes(defaultContext)) return defaultContext;
    return contextTypes[0] || null;
  });

  const draftLoadedRef = useRef(false);

  // Opções de assunto: lista do ciclo + criados pelo usuário
  const assuntoOptions = useMemo(() => {
    const base = assuntosDisponiveis.map(a => {
      const nome = typeof a === 'object' ? a.nome : a;
      return { value: nome, label: nome };
    });
    const extras = assuntosExtras.map(e => ({ value: e, label: e }));
    const map = new Map();
    [...base, ...extras].forEach(o => map.set(o.value, o));
    return Array.from(map.values());
  }, [assuntosDisponiveis, assuntosExtras]);

  // Opções de disciplinas do ciclo
  const selectedContextMeta = useMemo(
    () => availableContexts.find((context) => context?.type === selectedContext) || null,
    [availableContexts, selectedContext]
  );
  const selectedContextLogo = selectedContextMeta?.logoUrl
    || selectedContextMeta?.logo
    || selectedContextMeta?.editalLogoUrl
    || (selectedContext === 'ciclo' ? activeCicloData?.logoUrl || activeCicloData?.logo : null);
  const selectedContextLabel = selectedContextMeta?.label
    || (selectedContext === 'cronograma' ? 'Cronograma' : selectedContext === 'ciclo' ? 'Ciclo' : 'Planejamento');
  const selectedCronogramaId = selectedContext === 'cronograma'
    ? (selectedContextMeta?.id || null)
    : null;
  const contextDisciplines = useMemo(
    () => (Array.isArray(selectedContextMeta?.disciplinas) ? selectedContextMeta.disciplinas : []),
    [selectedContextMeta]
  );
  const disciplinasDisponiveis = useMemo(
    () => (todasDisciplinas.length > 0 ? todasDisciplinas : contextDisciplines),
    [contextDisciplines, todasDisciplinas]
  );
  const disciplinaOptions = useMemo(() =>
    disciplinasDisponiveis.map(d => ({ value: d.nome, label: d.nome })),
    [disciplinasDisponiveis]
  );
  const previousReviewPlaceholderRef = useRef(
    getRevisaoEscolhidaPlaceholder(selectedContext, revisaoModoCiclo)
  );

  useEffect(() => {
    if (requireExplicitContextSelection && contextTypes.length > 1 && selectedContext === null) {
      return;
    }
    if (contextTypes.length === 1) {
      setSelectedContext(contextTypes[0]);
      return;
    }
    if (selectedContext && contextTypes.includes(selectedContext)) return;
    if (defaultContext && contextTypes.includes(defaultContext)) {
      setSelectedContext(defaultContext);
      return;
    }
    setSelectedContext(contextTypes[0] || null);
  }, [contextTypes, defaultContext, requireExplicitContextSelection, selectedContext]);

  useEffect(() => {
    if (selectedContext !== 'cronograma') {
      setTopics((prev) => prev.map((topic) => (
        topic.naoConcluidoCronograma
          ? { ...topic, naoConcluidoCronograma: false }
          : topic
      )));
      return;
    }

    setTopics((prev) => prev.map((topic) => (
      topic.markAsFinished || topic.teoriaNaoFinalizadaCiclo
        ? { ...topic, markAsFinished: false, teoriaNaoFinalizadaCiclo: false }
        : topic
    )));
  }, [selectedContext]);

  useEffect(() => {
    let ignore = false;

    const carregarRevisaoModo = async () => {
      if (!userUid || !activeCicloId) {
        if (!ignore) setRevisaoModoCiclo(REVISAO_MODO_FLEXIVEL);
        return;
      }

      try {
        const cicloSnap = await getDoc(doc(db, 'users', userUid, 'ciclos', activeCicloId));
        if (!ignore) {
          setRevisaoModoCiclo(normalizeRevisaoModoCiclo(cicloSnap.data()?.revisaoModo));
        }
      } catch {
        if (!ignore) setRevisaoModoCiclo(REVISAO_MODO_FLEXIVEL);
      }
    };

    carregarRevisaoModo();
    return () => { ignore = true; };
  }, [activeCicloId, userUid]);

  useEffect(() => {
    const nextPlaceholder = getRevisaoEscolhidaPlaceholder(selectedContext, revisaoModoCiclo);
    const previousPlaceholder = previousReviewPlaceholderRef.current;

    setTopics((prev) => prev.map((topic) => {
      if (
        topic.revisaoEscolhida === previousPlaceholder ||
        topic.revisaoEscolhida === null ||
        topic.revisaoEscolhida === undefined
      ) {
        return { ...topic, revisaoEscolhida: nextPlaceholder };
      }
      return topic;
    }));

    previousReviewPlaceholderRef.current = nextPlaceholder;
  }, [revisaoModoCiclo, selectedContext]);

  const updateTopicData = useCallback((index, data) => {
    setTopics(prev => {
      const newTopics = [...prev];
      newTopics[index] = { ...newTopics[index], ...data };
      const q = Number(newTopics[index].questions) || 0;
      const c = Number(newTopics[index].correct) || 0;
      if (c > q) newTopics[index].correct = q;
      return newTopics;
    });
  }, []);

  // Handler de assunto com suporte a criar novo
  const handleAssuntoChange = useCallback((index, newValue) => {
    updateTopicData(index, { assunto: newValue });
    // Se não está na lista existente, adiciona aos extras
    const exists = assuntoOptions.some(o => o.value === newValue);
    if (!exists && newValue.trim()) {
      setAssuntosExtras(prev => prev.includes(newValue) ? prev : [...prev, newValue]);
    }
    checkTopicFinishedRef.current(newValue, index);
  }, [assuntoOptions, updateTopicData]);

  const totalAllocatedTime = useMemo(
    () => topics.reduce((acc, t) => acc + (Number(t.minutes) || 0), 0),
    [topics]
  );
  const isTimeBalanced = Math.abs(totalAllocatedTime - timeMinutes) < 1;

  const handleTimeUpdate = useCallback((index, newMinutes) => {
    setTopics(prev => {
      let safeMinutes = Math.max(0, Math.min(newMinutes, timeMinutes));
      const newTopics = [...prev];
      if (newTopics.length === 1) { newTopics[0].minutes = timeMinutes; return newTopics; }

      let balanceIndex = newTopics.length - 1;
      if (balanceIndex === index) balanceIndex = index - 1;

      const currentMinutes = newTopics[index].minutes;
      const diff = safeMinutes - currentMinutes;

      if (diff > 0 && newTopics[balanceIndex].minutes - diff < 0) {
        safeMinutes = currentMinutes + newTopics[balanceIndex].minutes;
      }

      newTopics[index].minutes = safeMinutes;

      const sumOthers = newTopics.reduce((acc, t, i) => i !== balanceIndex ? acc + (t.minutes || 0) : acc, 0);
      newTopics[balanceIndex].minutes = timeMinutes - sumOthers;

      return newTopics;
    });
  }, [timeMinutes]);

  const addTopic = useCallback(() => {
    setTopics(prev => {
      const newTopics = [...prev];
      const count = newTopics.length + 1;
      const splitTime = Math.floor(timeMinutes / count);
      const remainder = timeMinutes % count;
      newTopics.forEach(t => t.minutes = splitTime);
      newTopics.push({
        id: Date.now().toString(),
        assunto: '',
        minutes: splitTime + remainder,
        questions: 0,
        correct: 0,
        revisaoEscolhida: getRevisaoEscolhidaPlaceholder(selectedContext, revisaoModoCiclo),
        revisaoPersonalizadaDias: 14,
        markAsFinished: false,
        teoriaNaoFinalizadaCiclo: false,
        naoConcluidoCronograma: false,
      });
      return newTopics;
    });
  }, [revisaoModoCiclo, selectedContext, timeMinutes]);

  const removeTopic = useCallback((index) => {
    setTopics(prev => {
      const remainingTopics = prev.filter((_, i) => i !== index);
      if (remainingTopics.length > 0) {
        const splitTime = Math.floor(timeMinutes / remainingTopics.length);
        const remainder = timeMinutes % remainingTopics.length;
        remainingTopics.forEach(t => t.minutes = splitTime);
        remainingTopics[remainingTopics.length - 1].minutes += remainder;
      }
      return remainingTopics;
    });
  }, [timeMinutes]);

  // Draft restore
  useEffect(() => {
    if (!draftKey) return;
    const raw = safeJsonParse(localStorage.getItem(draftKey));
    if (raw && typeof raw === 'object') {
      const ageMs = Date.now() - (Number(raw.savedAt) || 0);
      if (ageMs < 24 * 60 * 60 * 1000) {
        setStep(2);
        setHasQuestions(true);
        if (Array.isArray(raw.topics)) setTopics(raw.topics);
        if (raw.disciplinaManual) setDisciplinaManual(raw.disciplinaManual);
        if (Array.isArray(raw.assuntosExtras)) setAssuntosExtras(raw.assuntosExtras);
      } else {
        localStorage.removeItem(draftKey);
      }
    }
    draftLoadedRef.current = true;
  }, [draftKey]);

  // Draft save
  useEffect(() => {
    if (!draftLoadedRef.current || isSubmitting) return;
    const timer = setTimeout(() => {
      localStorage.setItem(draftKey, JSON.stringify({
        savedAt: Date.now(),
        step,
        hasQuestions,
        topics,
        disciplinaManual,
        assuntosExtras,
      }));
    }, 500);
    return () => clearTimeout(timer);
  }, [step, hasQuestions, topics, disciplinaManual, assuntosExtras, draftKey, isSubmitting]);

  // Carrega TODAS as disciplinas da sub-coleção com onSnapshot (reage a mudanças em tempo real)
  useEffect(() => {
    if (!activeCicloId || !userUid) return;
    setLoadingAssuntos(true);

    const discRef = collection(db, 'users', userUid, 'ciclos', activeCicloId, 'disciplinas');
    const unsub = onSnapshot(discRef, (snap) => {
      const lista = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setTodasDisciplinas(lista);

      // Atualiza assuntos da disciplina atual (se já estiver selecionada)
      setDisciplinaManual(prev => {
        const nome = prev || disciplinaNome;
        let alvo = lista.find(d => normalize(d.nome) === normalize(nome));
        if (!alvo) alvo = lista.find(d => normalize(d.nome).includes(normalize(nome)) || normalize(nome).includes(normalize(d.nome)));
        if (alvo) {
          setAssuntosDisponiveis(Array.isArray(alvo.assuntos) ? alvo.assuntos : []);
          setErroDisciplina(false);
          return alvo.nome;
        } else {
          setErroDisciplina(lista.length > 0);
          return prev || '';
        }
      });

      setLoadingAssuntos(false);
    }, (e) => {
      console.error('[TimerFinishModal] Erro ao buscar disciplinas:', e);
      setLoadingAssuntos(false);
    });

    return () => unsub();
  }, [activeCicloId, userUid, disciplinaNome]);

  useEffect(() => {
    if (activeCicloId || contextDisciplines.length === 0) return;
    const nome = disciplinaManual || disciplinaNome;
    const alvo = contextDisciplines.find(d =>
      normalize(d.nome) === normalize(nome) ||
      normalize(d.nome).includes(normalize(nome)) ||
      normalize(nome).includes(normalize(d.nome))
    );
    setAssuntosDisponiveis(alvo && Array.isArray(alvo.assuntos) ? alvo.assuntos : []);
    setErroDisciplina(Boolean(nome && contextDisciplines.length > 0 && !alvo));
  }, [activeCicloId, contextDisciplines, disciplinaManual, disciplinaNome]);

  const checkTopicFinished = useCallback(async (topicName, index) => {
    if (!topicName || !activeCicloId || !userUid) return;
    try {
      const q = query(
        collection(db, 'users', userUid, 'registrosEstudo'),
        where('cicloId', '==', activeCicloId),
        where('assunto', '==', topicName),
        where('tipoEstudo', '==', 'check_manual')
      );
      const snap = await getDocs(q);
      if (!snap.empty) updateTopicData(index, { markAsFinished: true });
    } catch (e) {
      console.error(e);
    }
  }, [activeCicloId, userUid, updateTopicData]);

  // Ref para evitar dependência circular no handleAssuntoChange
  const checkTopicFinishedRef = useRef(checkTopicFinished);
  useEffect(() => { checkTopicFinishedRef.current = checkTopicFinished; }, [checkTopicFinished]);

  // Handler de disciplina via ComboBox
  const handleDisciplinaManualChange = (newValue) => {
    setDisciplinaManual(newValue);
    // todasDisciplinas já está atualizado via onSnapshot — busca direta
    const d = disciplinasDisponiveis.find(i =>
      normalize(i.nome) === normalize(newValue) || i.id === newValue
    );
    if (d) {
      setAssuntosDisponiveis(Array.isArray(d.assuntos) ? d.assuntos : []);
      setErroDisciplina(false);
    } else {
      // Disciplina nova digitada que ainda não existe no ciclo
      setAssuntosDisponiveis([]);
      setErroDisciplina(false);
    }
    setTopics(prev => prev.map(t => ({ ...t, assunto: '' })));
    setAssuntosExtras([]);
  };

  // SAVE
  const handleSaveSession = async (e) => {
    e.preventDefault();
    if (isSubmitting) return;
    setErrorMessage('');

    if (!selectedContext) {
      setErrorMessage('Escolha onde deseja registrar este bloco de estudo.');
      return;
    }
    if (selectedContext === 'cronograma' && !selectedCronogramaId) {
      setErrorMessage('Cronograma ativo obrigatório para registrar neste contexto.');
      return;
    }
    if (topics.some(t => !t.assunto)) {
      setErrorMessage('Selecione ou crie o assunto para todos os itens.');
      return;
    }
    if (selectedContext === 'ciclo' && tipoRegistro !== 'revisao' && topics.some((t) => t.revisaoEscolhida === null)) {
      setErrorMessage('Escolha explicitamente a revisao ou marque Nao revisar em todos os topicos do ciclo.');
      return;
    }
    if (
      selectedContext === 'ciclo' &&
      tipoRegistro !== 'revisao' &&
      topics.some((t) => t.revisaoEscolhida === 'custom' && !resolveIntervaloRevisao(t))
    ) {
      setErrorMessage('Informe um intervalo valido para a revisao personalizada.');
      return;
    }
    if (!isTimeBalanced) {
      setErrorMessage(`Erro de balanceamento: ${totalAllocatedTime}m vs ${timeMinutes}m.`);
      return;
    }

    setIsSubmitting(true);
    try {
      if (addRegistroEstudo) {
        const today = dateToYMDLocal(new Date());
        const finalDiscName = disciplinaManual || disciplinaNome;
        const discObj = disciplinasDisponiveis.find(d => normalize(d.nome) === normalize(finalDiscName));
        const finalDiscId = discObj?.id || finalDiscName;
        const isEdital = Boolean(activeCicloData?.editalId || activeCicloData?.templateId);
        const cicloTipo = isEdital ? 'Edital Base' : 'Ciclo Manual';
        const cicloNome = activeCicloData?.nome || null;

        let totalXP = 0;
        let totalQuestions = 0;
        let totalCorrect = 0;
        const hasPendingCicloTopic = selectedContext === 'ciclo' && tipoRegistro !== 'revisao' && topics.some((topic) => topic.teoriaNaoFinalizadaCiclo);

        for (const t of topics) {
          const qs = Number(t.questions) || 0;
          const ac = Number(t.correct) || 0;

          totalQuestions += qs;
          totalCorrect += ac;

          const intervaloRevisaoResolvido = resolveIntervaloRevisao(t);
          await addRegistroEstudo({
            ...(selectedContext === 'ciclo' && activeCicloId ? { cicloId: activeCicloId } : {}),
            ...(selectedContext === 'cronograma' && selectedCronogramaId ? { cronogramaId: selectedCronogramaId } : {}),
            ...(selectedContext ? { contextoRegistro: selectedContext } : {}),
            ...(selectedContext === 'ciclo' && cicloNome ? { cicloNome } : {}),
            ...(selectedContext === 'ciclo' && cicloTipo ? { cicloTipo } : {}),
            disciplinaId: finalDiscId,
            disciplinaNome: finalDiscName,
            assunto: t.assunto,
            data: today,
            tempoEstudadoMinutos: Number(t.minutes) || 0,
            duracaoMinutos: Number(t.minutes) || 0,
            questoesFeitas: qs,
            acertos: ac,
            questoesAcertadas: ac,
            tipoEstudo: tipoRegistro === 'revisao' ? 'revisao' : (qs > 0 ? 'Questoes' : 'Teoria'),
            tipoRegistro,
            ...(tipoRegistro === 'revisao' ? { isRevisao: true, revisao: true } : {}),
            origem: 'timer',
            ...(!hasPendingCicloTopic && Number.isFinite(Number(sessaoGlobalIndex)) ? { sessaoGlobalIndex: Number(sessaoGlobalIndex) } : {}),
            ...(tipoRegistro !== 'revisao' && shouldPersistIntervaloRevisao(selectedContext, intervaloRevisaoResolvido)
              ? { intervaloRevisaoDias: intervaloRevisaoResolvido }
              : {}),
            ...(tipoRegistro !== 'revisao' && selectedContext === 'ciclo' && revisaoModoCiclo === REVISAO_MODO_SUGESTAO
              ? { revisaoAutomaticaCiclo: true }
              : {}),
            ...(tipoRegistro !== 'revisao' && selectedContext === 'ciclo' && t.markAsFinished ? { assuntoFinalizadoCiclo: true, markAsFinished: true } : {}),
            ...(tipoRegistro !== 'revisao' && selectedContext === 'ciclo' && t.teoriaNaoFinalizadaCiclo ? { teoriaNaoFinalizadaCiclo: true } : {}),
            ...(tipoRegistro !== 'revisao' && selectedContext === 'cronograma' && t.naoConcluidoCronograma ? { naoConcluidoCronograma: true } : {}),
          });

          let xp = (Number(t.minutes) || 0) + qs + ac;
          if (qs >= 5 && (ac / qs) >= 0.85) xp += 15;
          totalXP += xp;

          if (tipoRegistro !== 'revisao' && selectedContext === 'ciclo' && t.markAsFinished) {
            const q = query(
              collection(db, 'users', userUid, 'registrosEstudo'),
              where('cicloId', '==', activeCicloId),
              where('assunto', '==', t.assunto),
              where('tipoEstudo', '==', 'check_manual')
            );
            const snap = await getDocs(q);
            if (snap.empty) {
              await setDoc(doc(collection(db, 'users', userUid, 'registrosEstudo')), {
                cicloId: activeCicloId,
                ...(cicloNome ? { cicloNome } : {}),
                ...(cicloTipo ? { cicloTipo } : {}),
                contextoRegistro: 'ciclo',
                disciplinaId: finalDiscId,
                disciplinaNome: finalDiscName,
                assunto: t.assunto,
                data: today,
                tempoEstudadoMinutos: 0,
                duracaoMinutos: 0,
                questoesFeitas: 0,
                acertos: 0,
                questoesAcertadas: 0,
                tipoEstudo: 'check_manual',
                obs: 'Concluído via Timer',
                origem: 'timer'
              });
            }
          }
        }

        const assuntosNovos = topics.map(t => t.assunto).filter(Boolean);
        const existeNaLista = disciplinasDisponiveis.some(d =>
          normalize(d.nome) === normalize(finalDiscName) || d.id === finalDiscId
        );
        const discSubRef = doc(db, 'users', userUid, 'ciclos', activeCicloId, 'disciplinas', finalDiscId);

        if (selectedContext === 'ciclo' && activeCicloId) {
          if (existeNaLista && assuntosNovos.length > 0) {
            updateDoc(discSubRef, { assuntos: arrayUnion(...assuntosNovos) }).catch(() => {});
          } else if (!existeNaLista) {
            await setDoc(discSubRef, {
              nome: finalDiscName,
              peso: 3,
              assuntos: assuntosNovos,
              tempoAlocadoSemanalMinutos: 0,
              inCiclo: true,
              criadaViRegistro: true,
            }, { merge: true });
          }
        }

        if (totalXP > 0) await addXP(totalXP, 'Bloco cronometrado');
        await checkAndAwardMilestone('FIRST_STUDY');

        const summaryPayload = {
          questions: totalQuestions,
          correct: totalCorrect,
          assunto: topics.length > 1 ? `${topics[0].assunto} +${topics.length - 1}` : topics[0].assunto,
          markAsFinished: topics.some((topic) => topic.markAsFinished),
          contextoRegistro: selectedContext,
          tipoRegistro,
          teoriaNaoFinalizadaCiclo: tipoRegistro !== 'revisao' && topics.some((topic) => topic.teoriaNaoFinalizadaCiclo),
          naoConcluidoCronograma: tipoRegistro !== 'revisao' && topics.some((topic) => topic.naoConcluidoCronograma),
          disciplinaNomeCorrigido: disciplinaManual !== disciplinaNome ? disciplinaManual : null,
          savedInternal: true
        };

        setShowSuccessToast(true);
        localStorage.removeItem(draftKey);

        setTimeout(() => {
          if (onConfirm) onConfirm(summaryPayload);
          window.dispatchEvent(new CustomEvent('StudyTimer:FinishFinalize', { detail: { uid: userUid } }));
        }, 1500);

        return;
      }

      const batch = writeBatch(db);
      const collectionRef = collection(db, 'users', userUid, 'registrosEstudo');
      const today = dateToYMDLocal(new Date());

      const finalDiscName = disciplinaManual || disciplinaNome;
      const discObj = disciplinasDisponiveis.find(d => normalize(d.nome) === normalize(finalDiscName));
      const finalDiscId = discObj?.id || finalDiscName; // usa nome como ID se não encontrar
      const now = Timestamp.now();

      const isEdital = Boolean(activeCicloData?.editalId || activeCicloData?.templateId);
      const cicloTipo = isEdital ? 'Edital Base' : 'Ciclo Manual';
      const cicloNome = activeCicloData?.nome || null;

      let totalXP = 0;
      let totalQuestions = 0;
      let totalCorrect = 0;

      for (const t of topics) {
        const newDocRef = doc(collectionRef);
        const qs = Number(t.questions) || 0;
        const ac = Number(t.correct) || 0;

        totalQuestions += qs;
        totalCorrect += ac;

        batch.set(newDocRef, {
          cicloId: activeCicloId,
          ...(cicloNome ? { cicloNome } : {}),
          ...(cicloTipo ? { cicloTipo } : {}),
          disciplinaId: finalDiscId,
          disciplinaNome: finalDiscName,
          assunto: t.assunto,
          data: today,
          timestamp: now,
          tempoEstudadoMinutos: Number(t.minutes) || 0,
          duracaoMinutos: Number(t.minutes) || 0,
          questoesFeitas: qs,
          acertos: ac,
          questoesAcertadas: ac,
          tipoEstudo: qs > 0 ? 'Questões' : 'Teoria',
          origem: 'timer'
        });

        let xp = (Number(t.minutes) || 0) + qs + ac;
        if (qs >= 5 && (ac / qs) >= 0.85) xp += 15;
        totalXP += xp;

        if (t.markAsFinished) {
          const checkRef = doc(collectionRef);
          batch.set(checkRef, {
            cicloId: activeCicloId,
            ...(cicloNome ? { cicloNome } : {}),
            ...(cicloTipo ? { cicloTipo } : {}),
            disciplinaId: finalDiscId,
            disciplinaNome: finalDiscName,
            assunto: t.assunto,
            data: today,
            timestamp: now,
            tempoEstudadoMinutos: 0,
            duracaoMinutos: 0,
            questoesFeitas: 0,
            acertos: 0,
            questoesAcertadas: 0,
            tipoEstudo: 'check_manual',
            obs: 'Concluído via Timer',
            origem: 'timer'
          });
        }
      }

      // Agregação de stats
      const statsRef = doc(db, 'users', userUid, 'stats', 'geral');
      batch.set(statsRef, {
        totalHorasMinutos: increment(timeMinutes),
        totalQuestoes: increment(totalQuestions),
        totalAcertos: increment(totalCorrect),
        lastUpdated: now
      }, { merge: true });

      // ── Persiste novas disciplinas/assuntos dentro do mesmo batch ──
      const assuntosNovos = topics.map(t => t.assunto).filter(Boolean);
      const existeNaLista = disciplinasDisponiveis.some(d =>
        normalize(d.nome) === normalize(finalDiscName) || d.id === finalDiscId
      );
      const discSubRef = doc(db, 'users', userUid, 'ciclos', activeCicloId, 'disciplinas', finalDiscId);

      if (existeNaLista && assuntosNovos.length > 0) {
        // Disciplina existe: apenas garante os assuntos novos
        // arrayUnion não é suportado diretamente no batch.set, mas podemos fazer setDoc com merge
        // Para não bloquear o batch, fazemos updateDoc fora mas em paralelo ao commit
        // (já é fast por ser uma única operação)
      } else if (!existeNaLista) {
        // Disciplina nova: cria o doc na sub-coleção dentro do batch
        batch.set(discSubRef, {
          nome: finalDiscName,
          peso: 3,
          assuntos: assuntosNovos,
          tempoAlocadoSemanalMinutos: 0,
          inCiclo: true,
          criadaViRegistro: true,
        }, { merge: true });
      }

      await batch.commit();

      // Adiciona assuntos novos a disciplina existente (arrayUnion, fora do batch pois não suporta)
      if (existeNaLista && assuntosNovos.length > 0) {
        updateDoc(discSubRef, { assuntos: arrayUnion(...assuntosNovos) }).catch(() => {});
      }

      if (totalXP > 0) await addXP(totalXP, 'Bloco cronometrado');
      await checkAndAwardMilestone('FIRST_STUDY');

      const summaryPayload = {
        questions: totalQuestions,
        correct: totalCorrect,
        assunto: topics.length > 1 ? `${topics[0].assunto} +${topics.length - 1}` : topics[0].assunto,
        markAsFinished: false,
        disciplinaNomeCorrigido: disciplinaManual !== disciplinaNome ? disciplinaManual : null,
        savedInternal: true
      };

      setShowSuccessToast(true);
      localStorage.removeItem(draftKey);

      setTimeout(() => {
        if (onConfirm) onConfirm(summaryPayload);
        window.dispatchEvent(new CustomEvent('StudyTimer:FinishFinalize', { detail: { uid: userUid } }));
      }, 1500);

    } catch (err) {
      console.error('[TimerFinishModal] Erro ao salvar:', err);
      setErrorMessage('Erro ao salvar. Tente novamente.');
      setIsSubmitting(false);
    }
  };

  const formatTimeHeader = (min) => {
    const h = Math.floor(min / 60);
    const m = min % 60;
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
  };

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 md:p-5 bg-zinc-950/78 backdrop-blur-xl registro-ambient-grid">
      <style>{timerFinishStyles}</style>
      <AnimatePresence>
        {showDiscardModal && (
          <ConfirmCloseModal
            isOpen={true}
            onCancel={() => setShowDiscardModal(false)}
            title="Descartar bloco?"
            desc="Todo o progresso deste cronômetro será perdido permanentemente."
            confirmText="Sim, Descartar"
            icon={Trash2}
            onConfirm={() => {
              setShowDiscardModal(false);
              localStorage.removeItem(draftKey);
              window.dispatchEvent(new CustomEvent('StudyTimer:FinishDiscard'));
              if (onDiscard) onDiscard();
            }}
          />
        )}
        {showSuccessToast && <SuccessToast />}
      </AnimatePresence>

      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 8 }}
        transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
        style={{ width: '100%', maxWidth: '720px', maxHeight: 'min(705px, calc(100dvh - 40px))' }}
        className="group relative bg-[#e6e6e8] dark:bg-[#070707] rounded-[26px] shadow-[0_28px_90px_rgba(0,0,0,0.42)] border border-zinc-300/80 dark:border-zinc-800 overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="registro-flow-strip h-1 w-full shrink-0" />
        {/* HEADER */}
        <div className="registro-modal-header relative z-10 flex flex-col gap-1.5 px-3 py-1.5 md:px-4 md:py-1.5 border-b border-zinc-300/80 dark:border-zinc-800 shrink-0">
          <div className="flex items-center justify-between gap-4">
            <div className="flex min-w-0 items-center gap-2.5">
              <motion.div
                animate={{ rotate: [0, -4, 4, 0], scale: [1, 1.03, 1] }}
                transition={{ duration: 4.5, repeat: Infinity, ease: 'easeInOut' }}
                className="relative flex h-7 w-7 md:h-8 md:w-8 items-center justify-center overflow-hidden rounded-xl bg-red-600 text-white shadow-lg shadow-red-500/25"
              >
                {selectedContextLogo ? (
                  <img src={selectedContextLogo} alt={selectedContextLabel} className="h-full w-full object-contain bg-white p-1" />
                ) : (
                  <Save size={16} strokeWidth={1.8} />
                )}
              </motion.div>
              <div className="min-w-0">
                <h2 className="truncate text-base md:text-lg font-black uppercase tracking-tight text-zinc-950 dark:text-white leading-tight">
                  Finalizar <span className="text-red-600">Sessão de Estudo</span>
                </h2>
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                if (onCancel) onCancel();
                setTimeout(() => window.dispatchEvent(new CustomEvent('StudyTimer:FinishResume')), 100);
              }}
              className="p-2 bg-zinc-100 hover:bg-zinc-200 dark:bg-white/5 dark:hover:bg-white/10 text-zinc-500 dark:text-zinc-300 rounded-xl transition-all duration-300 hover:rotate-90"
              aria-label="Fechar"
            >
              <X size={17} />
            </button>
          </div>
        </div>

        {/* BODY */}
        <div className="pointer-events-none absolute left-1/2 top-[58%] z-0 h-72 w-[62%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-red-500/10 blur-[90px] dark:bg-red-600/12" />
        <div className="relative z-10 flex-1 overflow-y-auto px-4 py-3 md:px-4 md:py-2.5 custom-scrollbar space-y-3 md:space-y-2 bg-transparent" style={{ scrollbarWidth: 'thin' }}>
          {step === 1 ? (
            <div className="flex min-h-[430px] flex-col justify-center space-y-3">
              <div className="registro-modal-form-section p-3 md:p-2.5 space-y-2 text-center">
                <p className="registro-section-kicker justify-center">Bloco finalizado</p>
                <h3 className="text-lg md:text-xl font-black tracking-tight text-zinc-950 dark:text-white">Resolveu questoes?</h3>
                <p className="mx-auto max-w-xs text-xs font-semibold text-zinc-500 dark:text-zinc-400">
                  {formatTimeHeader(timeMinutes)} de foco total em {selectedContextLabel}.
                </p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <button type="button" onClick={() => { setHasQuestions(false); setStep(2); }} className="registro-modal-form-section flex min-h-[96px] flex-col items-center justify-center gap-2 p-3 text-center transition-all hover:-translate-y-0.5">
                  <XCircle size={26} className="text-zinc-400" />
                  <span className="text-[11px] font-black uppercase tracking-wide text-zinc-700 dark:text-zinc-300">Apenas Estudo</span>
                </button>
                <button type="button" onClick={() => { setHasQuestions(true); setStep(2); }} className="registro-modal-form-section flex min-h-[96px] flex-col items-center justify-center gap-2 p-3 text-center transition-all hover:-translate-y-0.5 !border-red-500/60">
                  <Target size={26} className="text-red-500" />
                  <span className="text-[11px] font-black uppercase tracking-wide text-red-700 dark:text-red-300">Sim, resolvi</span>
                </button>
              </div>
              <div className="flex gap-3">
                {onDiscard && (
                  <button type="button" onClick={() => setShowDiscardModal(true)} className="flex-1 py-3 md:py-2.5 px-3 rounded-2xl border border-zinc-300 dark:border-white/10 bg-zinc-50 dark:bg-white/5 text-zinc-700 dark:text-zinc-300 hover:-translate-y-0.5 hover:border-zinc-800 dark:hover:border-zinc-200 hover:text-zinc-900 dark:hover:text-white hover:shadow-lg text-[11px] font-bold uppercase tracking-wide transition-all flex items-center justify-center gap-1.5">
                    <Trash2 size={16} /> Descartar
                  </button>
                )}
                <button type="button" onClick={() => { if (onCancel) onCancel(); setTimeout(() => window.dispatchEvent(new CustomEvent('StudyTimer:FinishResume')), 100); }} className="flex-1 overflow-hidden px-4 py-3 md:py-2.5 rounded-2xl text-[11px] font-bold uppercase tracking-wide text-white transition-all flex items-center justify-center gap-1.5 shadow-lg bg-red-600 hover:bg-red-700 hover:-translate-y-0.5 hover:shadow-red-500/25">
                  <RotateCcw size={16} /> Retomar
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSaveSession} className="space-y-3 md:space-y-2">
              {errorMessage && (
                <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-xl text-red-500 text-sm font-medium flex items-center gap-2">
                  <AlertTriangle size={18} /> {errorMessage}
                </div>
              )}

              {hasMultipleContexts && (
                <div className="registro-modal-form-section p-2 md:p-2">
                  <p className="registro-section-kicker mb-1.5">
                    Planejamento
                  </p>
                  <div className="grid grid-cols-2 gap-1.5 sm:gap-2">
                    {availableContexts.map((context) => {
                      const active = selectedContext === context.type;
                      const isCiclo = context.type === 'ciclo';
                      const label = context.label || (isCiclo ? 'Ciclo' : 'Cronograma');
                      const title = isCiclo ? 'Ciclo' : 'Cronograma';
                      return (
                        <button
                          key={context.type}
                          type="button"
                          onClick={() => setSelectedContext(context.type)}
                          className={`group relative flex min-h-[72px] flex-col items-center justify-center gap-1.5 rounded-xl p-1.5 text-center border transition-all duration-300 overflow-hidden hover:-translate-y-0.5 ${
                            active
                              ? 'border-zinc-400 bg-white/90 dark:border-zinc-500 dark:bg-[#1f1f1f] shadow-sm'
                              : 'border-white/70 dark:border-zinc-700 bg-white/70 dark:bg-[#141414] hover:border-zinc-300 dark:hover:border-zinc-500'
                          }`}
                        >
                          <span className={`relative flex h-9 w-9 md:h-10 md:w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl border transition-all duration-300 ${
                            active
                              ? 'border-zinc-400 dark:border-zinc-500 bg-zinc-100/80 dark:bg-[#2A2A2A]'
                              : 'border-transparent bg-white dark:bg-[#2A2A2A]'
                          }`}>
                            {context.logoUrl || context.logo || context.editalLogoUrl ? (
                              <img src={context.logoUrl || context.logo || context.editalLogoUrl} alt={context.label} className="h-full w-full object-contain p-1" />
                            ) : (
                              <BookOpen size={15} className="text-zinc-400" />
                            )}
                          </span>
                          <span className="min-w-0 w-full">
                            <span className={`block text-[8px] font-black uppercase tracking-[0.18em] ${active ? 'text-zinc-700 dark:text-zinc-200' : 'text-zinc-400'}`}>
                              {title}
                            </span>
                            <span className={`block truncate text-[11px] font-black ${active ? 'text-zinc-900 dark:text-white' : 'text-zinc-600 dark:text-zinc-300'}`}>
                              {label}
                            </span>
                          </span>
                          {active && (
                            <div className="absolute top-2.5 right-2.5 text-zinc-500 dark:text-zinc-300">
                              <CheckCircle2 size={15} strokeWidth={2.5} />
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="registro-modal-form-section relative z-[90] p-3 md:p-2.5">
                <div className="mb-3 md:mb-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <p className="registro-section-kicker">
                    Modo da Sessao
                  </p>
                  <div className="inline-flex w-full items-center gap-1 rounded-2xl border border-zinc-300/80 bg-zinc-100/70 p-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.18)] dark:border-zinc-700 dark:bg-zinc-900/70 sm:w-auto">
                    {[
                      { value: 'estudo', label: 'Estudo', icon: BookOpen },
                      { value: 'revisao', label: 'Revisao', icon: RotateCcw },
                    ].map((option) => {
                      const Icon = option.icon;
                      const active = tipoRegistro === option.value;
                      return (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() => {
                            setTipoRegistro(option.value);
                            if (option.value === 'revisao') {
                              setTopics((prev) => prev.map((topic) => ({
                                ...topic,
                                revisaoEscolhida: 'skip',
                                markAsFinished: false,
                                teoriaNaoFinalizadaCiclo: false,
                                naoConcluidoCronograma: false,
                              })));
                            } else {
                              setTopics((prev) => prev.map((topic) => ({
                                ...topic,
                                revisaoEscolhida: getRevisaoEscolhidaPlaceholder(selectedContext, revisaoModoCiclo),
                              })));
                            }
                          }}
                          className={`flex-1 md:flex-none flex items-center justify-center gap-1.5 rounded-xl px-3.5 py-1.5 text-[11px] font-black transition-all duration-300 ${
                            active
                              ? 'bg-zinc-900 text-white shadow-sm dark:bg-zinc-100 dark:text-zinc-950'
                              : 'text-zinc-600 dark:text-zinc-300 hover:bg-white/70 dark:hover:bg-white/10'
                          }`}
                        >
                          <Icon size={12} strokeWidth={2.5} />
                          {option.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-2.5">
                  <div className="space-y-1 md:space-y-0.5 relative z-[120]">
                    <label className="registro-small-label text-[9px] uppercase tracking-[0.2em] flex items-center gap-1.5">
                      <BookOpen size={11} className="text-zinc-400" /> Disciplina
                    </label>
                    <div className="relative z-[120]">
                      <ComboBox
                        options={disciplinaOptions}
                        value={disciplinaManual || disciplinaNome}
                        onChange={handleDisciplinaManualChange}
                        placeholder="Selecione ou crie disciplina..."
                        icon={BookOpen}
                        allowCreate={true}
                        createLabel="Criar disciplina"
                        loading={loadingAssuntos}
                        emptyLabel="Nenhuma disciplina encontrada"
                      />
                    </div>
                    {erroDisciplina && !disciplinaManual && (
                      <p className="text-[10px] text-amber-600 mt-1 font-bold flex items-center gap-1">
                        <AlertTriangle size={10} /> Disciplina nao reconhecida - selecione ou crie
                      </p>
                    )}
                  </div>

                  {topics.length === 1 && (
                    <div className="space-y-1 md:space-y-0.5 relative z-[130]">
                      <label className="registro-small-label text-[9px] uppercase tracking-[0.2em] flex items-center justify-between">
                        <span className="flex items-center gap-1.5"><Target size={11} className="text-zinc-400" /> Assunto</span>
                        {loadingAssuntos && <span className="text-zinc-500 text-[9px] animate-pulse font-black tracking-widest uppercase">carregando...</span>}
                      </label>
                      <div className="relative z-[130]">
                        <ComboBox
                          options={assuntoOptions}
                          value={topics[0]?.assunto || ''}
                          onChange={(val) => handleAssuntoChange(0, val)}
                          placeholder="Selecione ou crie assunto..."
                          icon={List}
                          allowCreate={true}
                          createLabel="Novo assunto"
                          loading={loadingAssuntos}
                          emptyLabel="Nenhum assunto - digite para criar"
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-3 md:space-y-2">
                <AnimatePresence>
                  {topics.map((topic, index) => (
                    <motion.div
                      key={topic.id}
                      initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }}
                      className="registro-modal-form-section p-3 md:p-2.5 relative z-[80]"
                    >
                      {topics.length > 1 && (
                        <div className="flex justify-between items-center mb-3 pb-2 border-b border-zinc-200 dark:border-zinc-800">
                          <span className="text-xs font-black text-zinc-400 uppercase tracking-wide">Tópico #{index + 1}</span>
                          <button type="button" onClick={() => removeTopic(index)} className="text-zinc-400 hover:text-red-500 transition-colors"><X size={16} /></button>
                        </div>
                      )}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-2.5">
                        <div className="grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_minmax(158px,0.52fr)] gap-2 md:gap-2.5 content-start">
                          {/* ── ASSUNTO ComboBox ── */}
                          <div className={`${topics.length === 1 ? 'hidden' : 'space-y-1 md:space-y-0.5'} relative z-50 md:col-span-2`}>
                            <label className="registro-small-label text-[9px] uppercase tracking-[0.2em] flex items-center justify-between">
                              <span className="flex items-center gap-1.5"><Target size={11} className="text-zinc-400" /> O que voce estudou?</span>
                              {loadingAssuntos && <span className="text-red-500 text-[9px] animate-pulse font-black tracking-widest uppercase">carregando...</span>}
                            </label>
                            <ComboBox
                              options={assuntoOptions}
                              value={topic.assunto}
                              onChange={(val) => handleAssuntoChange(index, val)}
                              placeholder="Selecione ou crie assunto..."
                              icon={List}
                              allowCreate={true}
                              createLabel="Novo assunto"
                              loading={loadingAssuntos}
                              emptyLabel="Nenhum assunto — digite para criar"
                            />
                          </div>

                          {selectedContext === 'ciclo' && tipoRegistro !== 'revisao' && topic.assunto && (
                            <div className="space-y-2 border-t border-zinc-200 pt-3 dark:border-zinc-800 md:row-span-2">
                              <div className="flex items-center justify-between gap-3">
                                <div>
                                  <p className="registro-small-label text-[9px] uppercase tracking-[0.18em] flex items-center gap-1.5">
                                    <RotateCcw size={11} /> Revisao do ciclo
                                  </p>
                                  <p className="text-[9px] font-semibold text-zinc-400 dark:text-zinc-500 mt-0.5 leading-snug">
                                    {revisaoModoCiclo === 'sugestao_automatica'
                                      ? 'Revisoes automaticas ativas.'
                                      : 'Escolha quando revisar.'}
                                  </p>
                                </div>
                                <span className={`rounded-[6px] px-2 py-0.5 text-[8px] font-black uppercase tracking-widest ${
                                  revisaoModoCiclo === 'sugestao_automatica'
                                    ? 'bg-emerald-500/10 text-emerald-600'
                                    : 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300'
                                }`}>
                                  {revisaoModoCiclo === 'sugestao_automatica' ? 'Smart' : 'Obrigatorio'}
                                </span>
                              </div>

                              <div className="flex flex-wrap gap-1.5">
                                {[
                                  { value: 1, label: '1 dia' },
                                  { value: 7, label: '7 dias' },
                                  { value: 30, label: '30 dias' },
                                  { value: 'custom', label: 'Personalizado' },
                                  { value: 'skip', label: 'Nao revisar' },
                                ].map((option) => {
                                  return (
                                    <RevisaoChip
                                      key={String(option.value)}
                                      value={option.value}
                                      label={option.label}
                                      active={topic.revisaoEscolhida === option.value}
                                      onClick={() => updateTopicData(index, { revisaoEscolhida: option.value })}
                                      autoMode={revisaoModoCiclo === 'sugestao_automatica' && option.value !== 'skip'}
                                    />
                                  );
                                })}
                              </div>
                              {topic.revisaoEscolhida === 'custom' && (
                                <label className="flex items-center gap-3 rounded-xl border border-zinc-200 bg-white p-2 text-xs font-bold text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300">
                                  <span className="shrink-0 uppercase tracking-wide text-zinc-400">Revisar em</span>
                                  <input
                                    type="number"
                                    min="1"
                                    max="365"
                                    value={topic.revisaoPersonalizadaDias ?? 14}
                                    onChange={(e) => updateTopicData(index, { revisaoPersonalizadaDias: Math.max(1, Number(e.target.value) || 1) })}
                                    className="h-9 w-20 rounded-xl border border-zinc-200 bg-zinc-50 px-2 text-center font-black text-zinc-900 outline-none focus:border-red-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-white"
                                  />
                                  <span className="shrink-0 text-zinc-500">dia(s)</span>
                                </label>
                              )}
                            </div>
                          )}

                          {selectedContext === 'ciclo' && tipoRegistro !== 'revisao' && topic.assunto && (
                            <div
                              onClick={() => updateTopicData(index, { markAsFinished: !topic.markAsFinished, teoriaNaoFinalizadaCiclo: false })}
                              className={`relative w-full min-h-[44px] overflow-hidden flex items-center gap-2.5 px-3 py-2 rounded-xl border cursor-pointer transition-all duration-300 text-left md:col-start-2 ${topic.markAsFinished ? 'bg-emerald-600 border-emerald-500 text-white shadow-sm' : 'bg-emerald-50/70 dark:bg-emerald-950/25 border-emerald-200 dark:border-emerald-800/60 hover:border-emerald-400 dark:hover:border-emerald-500 text-zinc-700 dark:text-zinc-300'}`}
                            >
                              <div className={`relative w-7 h-7 md:h-6 md:w-6 rounded-lg border-2 flex items-center justify-center transition-all duration-300 shrink-0 ${topic.markAsFinished ? 'bg-white border-white text-emerald-600 scale-105 shadow-sm' : 'bg-white/70 dark:bg-zinc-950/70 border-emerald-400 dark:border-emerald-600 text-emerald-500'}`}>
                                {topic.markAsFinished ? <CheckSquare size={15} strokeWidth={3} /> : <CheckCircle2 size={15} strokeWidth={3} />}
                              </div>
                              <div className="relative min-w-0">
                                <p className={`text-[10px] font-black uppercase tracking-tight leading-tight ${topic.markAsFinished ? 'text-white' : 'text-emerald-700 dark:text-emerald-300'}`}>
                                  {topic.markAsFinished ? 'Tópico Concluído' : 'Marcar como Concluído'}
                                </p>
                                <p className="text-[10px] text-zinc-500 mt-0.5">
                                  {topic.markAsFinished ? 'Assunto finalizado.' : 'Clique para finalizar.'}
                                </p>
                              </div>
                            </div>
                          )}
                          {selectedContext === 'ciclo' && tipoRegistro !== 'revisao' && topic.assunto && (
                            <div
                              onClick={() => updateTopicData(index, { teoriaNaoFinalizadaCiclo: !topic.teoriaNaoFinalizadaCiclo, markAsFinished: false })}
                              className={`w-full min-h-[44px] flex items-center gap-2.5 px-3 py-2 rounded-xl border cursor-pointer transition-all duration-300 text-left md:col-start-2 ${topic.teoriaNaoFinalizadaCiclo ? 'bg-amber-500 border-amber-500 text-white shadow-sm' : 'bg-amber-50/50 dark:bg-amber-900/10 border-amber-200 dark:border-amber-800/50 hover:border-amber-400 dark:hover:border-amber-600 text-zinc-700 dark:text-zinc-300'}`}
                            >
                              <div className={`w-5 h-5 rounded-[6px] border-2 flex items-center justify-center shrink-0 transition-all duration-300 ${topic.teoriaNaoFinalizadaCiclo ? 'bg-white border-white text-amber-500 scale-105' : 'border-amber-400 dark:border-amber-600 text-transparent'}`}>
                                {topic.teoriaNaoFinalizadaCiclo && <AlertTriangle size={12} strokeWidth={3} />}
                              </div>
                              <div>
                                <p className={`text-[10px] font-black uppercase tracking-tight leading-tight ${topic.teoriaNaoFinalizadaCiclo ? 'text-white' : 'text-amber-700 dark:text-amber-400'}`}>
                                  {topic.teoriaNaoFinalizadaCiclo ? 'Assunto Pendente' : 'Manter Pendente'}
                                </p>
                                <p className="hidden text-[10px] text-zinc-500 mt-0.5">
                                  {topic.teoriaNaoFinalizadaCiclo ? 'Este assunto volta no proximo bloco desta disciplina.' : 'Outras disciplinas continuam girando normalmente.'}
                                </p>
                              </div>
                            </div>
                          )}
                          {selectedContext === 'cronograma' && tipoRegistro !== 'revisao' && topic.assunto && (
                            <div
                              onClick={() => updateTopicData(index, { naoConcluidoCronograma: !topic.naoConcluidoCronograma })}
                              className={`w-full min-h-[44px] flex items-center gap-2.5 px-3 py-2 rounded-xl border cursor-pointer transition-all duration-300 text-left md:col-start-2 ${topic.naoConcluidoCronograma ? 'bg-amber-500 border-amber-500 text-white shadow-sm' : 'bg-amber-50/50 dark:bg-amber-900/10 border-amber-200 dark:border-amber-800/50 hover:border-amber-400 dark:hover:border-amber-600 text-zinc-700 dark:text-zinc-300'}`}
                            >
                              <div className={`w-5 h-5 rounded-[6px] border-2 flex items-center justify-center shrink-0 transition-all duration-300 ${topic.naoConcluidoCronograma ? 'bg-white border-white text-amber-500 scale-105' : 'border-amber-400 dark:border-amber-600 text-transparent'}`}>
                                {topic.naoConcluidoCronograma && <AlertTriangle size={12} strokeWidth={3} />}
                              </div>
                              <div className="min-w-0">
                                <p className={`text-[10px] font-black uppercase tracking-tight leading-tight ${topic.naoConcluidoCronograma ? 'text-white' : 'text-amber-700 dark:text-amber-400'}`}>
                                  {topic.naoConcluidoCronograma ? 'Teoria ainda não concluída' : 'Marcar teoria ainda não concluída'}
                                </p>
                                <p className="hidden text-[10px] text-zinc-500 mt-0.5">
                                  {topic.naoConcluidoCronograma ? 'Esse assunto volta no próximo slot elegível do cronograma.' : 'Use quando o registro precisa voltar como pendência de teoria.'}
                                </p>
                              </div>
                            </div>
                          )}
                        </div>

                          <div className="space-y-3 md:space-y-2">
                          <TimeInputControl currentMinutes={topic.minutes} onTimeChange={(newMin) => handleTimeUpdate(index, newMin)} />
                          {hasQuestions && (
                            <div className="registro-modal-form-section p-2 md:p-2 space-y-1.5">
                              <span className="registro-section-kicker">
                                Questões
                              </span>
                              <div className="flex gap-2">
                                <div className="flex-1 text-center">
                                  <label className="registro-small-label text-[8px] uppercase tracking-widest block mb-1">Resolvidas</label>
                                  <input
                                    type="number"
                                    value={topic.questions}
                                    onChange={(e) => updateTopicData(index, { questions: parseInt(e.target.value) || 0 })}
                                    min="0"
                                    className="w-full border rounded-xl py-0.5 px-2 text-center font-black text-lg md:text-base outline-none transition-all duration-300 shadow-inner bg-white dark:bg-[#2A2A2A] border-zinc-200 dark:border-[#444] text-zinc-900 dark:text-white focus:border-zinc-400 dark:focus:border-zinc-500"
                                  />
                                </div>
                                <div className="flex items-center text-zinc-400 font-black text-base pb-1">/</div>
                                <div className="flex-1 text-center">
                                  <label className="registro-small-label text-[8px] uppercase tracking-widest block mb-1">Acertos</label>
                                  <input
                                    type="number"
                                    value={topic.correct}
                                    onChange={(e) => updateTopicData(index, { correct: parseInt(e.target.value) || 0 })}
                                    min="0"
                                    className="w-full border rounded-xl py-0.5 px-2 text-center font-black text-lg md:text-base outline-none transition-all duration-300 shadow-inner bg-white dark:bg-[#2A2A2A] border-zinc-200 dark:border-[#444] text-zinc-900 dark:text-white focus:border-zinc-400 dark:focus:border-zinc-500"
                                  />
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>

                <button type="button" onClick={addTopic} className="w-full py-3 rounded-xl border-2 border-dashed border-zinc-300 dark:border-zinc-700 text-zinc-500 dark:text-zinc-400 font-bold text-xs uppercase tracking-wide hover:border-red-500 hover:bg-red-50 dark:hover:bg-red-900/10 transition-all flex items-center justify-center gap-2">
                  <Split size={16} /> Dividir bloco / adicionar topico
                </button>
              </div>

              {topics.length > 1 && (
                <div className={`p-4 rounded-xl flex justify-between items-center text-xs font-bold ${isTimeBalanced ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'}`}>
                  <span>Distribuído: {Math.floor(totalAllocatedTime / 60)}h {totalAllocatedTime % 60}m / {Math.floor(timeMinutes / 60)}h {timeMinutes % 60}m</span>
                  {!isTimeBalanced
                    ? <span className="flex items-center gap-1"><AlertCircle size={14} /> Ajuste os valores</span>
                    : <span className="flex items-center gap-1"><CheckCircle2 size={14} /> Balanceado</span>}
                </div>
              )}

              <div className="sticky bottom-0 bg-[#dedee1]/96 dark:bg-[#080808]/96 border-t border-zinc-300/80 dark:border-zinc-800 -mx-4 -mb-3 mt-3 p-3 md:p-3 shrink-0 z-50 flex items-center gap-3 backdrop-blur">
                <button
                  type="button"
                  onClick={() => {
                    if (onCancel) onCancel();
                    setTimeout(() => window.dispatchEvent(new CustomEvent('StudyTimer:FinishResume')), 100);
                  }}
                  className="flex-1 py-3 md:py-2.5 px-3 rounded-2xl border border-zinc-300 dark:border-white/10 bg-zinc-50 dark:bg-white/5 text-zinc-700 dark:text-zinc-300 hover:-translate-y-0.5 hover:border-zinc-800 dark:hover:border-zinc-200 hover:text-zinc-900 dark:hover:text-white hover:shadow-lg text-[11px] font-bold uppercase tracking-wide transition-all flex items-center justify-center gap-1.5"
                >
                  <RotateCcw size={14} /> Retomar
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || (topics.length > 1 && !isTimeBalanced)}
                  className={`flex-1 overflow-hidden px-4 py-3 md:py-2.5 rounded-2xl text-[11px] font-bold uppercase tracking-wide text-white transition-all flex items-center justify-center gap-1.5 shadow-lg ${
                    isSubmitting || (topics.length > 1 && !isTimeBalanced)
                      ? 'bg-zinc-600 cursor-not-allowed'
                      : 'bg-red-600 hover:bg-red-700 hover:-translate-y-0.5 hover:shadow-red-500/25'
                  }`}
                >
                  <Save size={14} /> {isSubmitting ? 'Salvando...' : 'Gravar Sessão'}
                </button>
              </div>
            </form>
          )}
        </div>
      </motion.div>
    </div>
  );
}

export default TimerFinishModal;
