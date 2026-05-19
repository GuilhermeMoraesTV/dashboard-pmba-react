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
        className={`w-full flex items-center bg-zinc-50 dark:bg-zinc-900 border rounded-xl shadow-sm transition-all
          ${isOpen || focused ? 'border-red-500 ring-1 ring-red-500/20' : 'border-zinc-200 dark:border-zinc-800'}
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
            className="absolute z-[70] w-full mt-1 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-xl max-h-52 overflow-y-auto custom-scrollbar"
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
    <div className="space-y-2">
      <span className="text-xs font-extrabold text-zinc-400 uppercase tracking-widest flex items-center gap-1.5">
        <Clock size={14} className="text-amber-500" /> Tempo do Tópico
      </span>
      <div className="flex gap-3">
        <div className="flex-1 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-2 flex flex-col items-center relative group focus-within:border-amber-500">
          <input type="number" value={horas} onChange={(e) => handleManualInput('horas', e.target.value)} min="0" className="w-full text-center text-xl font-black bg-transparent outline-none text-zinc-800 dark:text-white z-10" />
          <span className="text-[9px] font-bold text-zinc-400 uppercase">Hr</span>
          <div className="absolute right-0 top-0 bottom-0 flex flex-col justify-center px-1 z-20">
            <button type="button" onClick={() => handleAdjust('horas', 1)} className="p-1 text-zinc-400 hover:text-amber-600 active:scale-90"><ChevronUp size={16} /></button>
            <button type="button" onClick={() => handleAdjust('horas', -1)} className="p-1 text-zinc-400 hover:text-amber-600 active:scale-90"><ChevronDown size={16} /></button>
          </div>
        </div>
        <div className="flex-1 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-2 flex flex-col items-center relative group focus-within:border-amber-500">
          <input type="number" value={minutos} onChange={(e) => handleManualInput('minutos', e.target.value)} min="0" max="59" className="w-full text-center text-xl font-black bg-transparent outline-none text-zinc-800 dark:text-white z-10" />
          <span className="text-[9px] font-bold text-zinc-400 uppercase">Min</span>
          <div className="absolute right-0 top-0 bottom-0 flex flex-col justify-center px-1 z-20">
            <button type="button" onClick={() => handleAdjust('minutos', 1)} className="p-1 text-zinc-400 hover:text-amber-600 active:scale-90"><ChevronUp size={16} /></button>
            <button type="button" onClick={() => handleAdjust('minutos', -1)} className="p-1 text-zinc-400 hover:text-amber-600 active:scale-90"><ChevronDown size={16} /></button>
          </div>
        </div>
      </div>
    </div>
  );
};

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

  const [step, setStep] = useState(1);
  const [hasQuestions, setHasQuestions] = useState(null);
  const [topics, setTopics] = useState([{
    id: 'initial',
    assunto: initialAssunto || '',
    minutes: timeMinutes || 0,
    questions: 0,
    correct: 0,
    revisaoEscolhida: getRevisaoEscolhidaInicial(),
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
        if (raw.step) setStep(raw.step);
        if (typeof raw.hasQuestions === 'boolean') setHasQuestions(raw.hasQuestions);
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
      setErrorMessage('Escolha onde deseja registrar esta sessão.');
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
          const qs = hasQuestions ? (Number(t.questions) || 0) : 0;
          const ac = hasQuestions ? (Number(t.correct) || 0) : 0;

          totalQuestions += qs;
          totalCorrect += ac;

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
            tipoEstudo: tipoRegistro === 'revisao' ? 'revisao' : (hasQuestions ? 'Questoes' : 'Teoria'),
            tipoRegistro,
            ...(tipoRegistro === 'revisao' ? { isRevisao: true, revisao: true } : {}),
            origem: 'timer',
            ...(!hasPendingCicloTopic && Number.isFinite(Number(sessaoGlobalIndex)) ? { sessaoGlobalIndex: Number(sessaoGlobalIndex) } : {}),
            ...(tipoRegistro !== 'revisao' && shouldPersistIntervaloRevisao(selectedContext, t.revisaoEscolhida)
              ? { intervaloRevisaoDias: t.revisaoEscolhida }
              : {}),
            ...(tipoRegistro !== 'revisao' && selectedContext === 'ciclo' && revisaoModoCiclo === REVISAO_MODO_SUGESTAO
              ? { revisaoAutomaticaCiclo: true }
              : {}),
            ...(tipoRegistro !== 'revisao' && selectedContext === 'ciclo' && t.markAsFinished ? { assuntoFinalizadoCiclo: true, markAsFinished: true } : {}),
            ...(tipoRegistro !== 'revisao' && selectedContext === 'ciclo' && t.teoriaNaoFinalizadaCiclo ? { teoriaNaoFinalizadaCiclo: true } : {}),
            ...(tipoRegistro !== 'revisao' && selectedContext === 'cronograma' && t.naoConcluidoCronograma ? { naoConcluidoCronograma: true } : {}),
          });

          let xp = (Number(t.minutes) || 0) + qs + ac;
          if (hasQuestions && qs >= 5 && qs > 0 && (ac / qs) >= 0.85) xp += 15;
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

        if (totalXP > 0) await addXP(totalXP, 'Sessão Cronometrada');
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
        const qs = hasQuestions ? (Number(t.questions) || 0) : 0;
        const ac = hasQuestions ? (Number(t.correct) || 0) : 0;

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
          tipoEstudo: hasQuestions ? 'Questões' : 'Teoria',
          origem: 'timer'
        });

        let xp = (Number(t.minutes) || 0) + qs + ac;
        if (hasQuestions && qs >= 5 && qs > 0 && (ac / qs) >= 0.85) xp += 15;
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

      if (totalXP > 0) await addXP(totalXP, 'Sessão Cronometrada');
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
    <div className="fixed inset-0 z-[10000] bg-black/90 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 animate-fade-in">
      <AnimatePresence>
        {showDiscardModal && (
          <ConfirmCloseModal
            isOpen={true}
            onCancel={() => setShowDiscardModal(false)}
            title="Descartar Sessão?"
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
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-white dark:bg-zinc-950 w-full max-w-2xl rounded-[32px] shadow-2xl border border-zinc-200 dark:border-zinc-800 flex flex-col relative max-h-[90vh] overflow-hidden"
      >
        {/* HEADER */}
        <div className="bg-zinc-50 dark:bg-zinc-900/50 p-6 border-b border-zinc-100 dark:border-zinc-800 flex flex-col sm:flex-row justify-between items-center gap-4 shrink-0">
          <div className="flex items-center gap-3 sm:gap-4 w-full sm:w-auto">
            <div className="w-12 h-12 bg-emerald-100 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-500 rounded-2xl flex items-center justify-center shadow-sm shrink-0">
              <CheckCircle2 size={24} />
            </div>
            <div className="flex-1">
              <h2 className="text-xl font-black text-zinc-800 dark:text-white uppercase tracking-tight leading-none">Sessão Finalizada</h2>
              <p className="text-zinc-500 font-medium text-xs sm:text-sm mt-1 flex items-center gap-2">
                <Clock size={14} /> {formatTimeHeader(timeMinutes)} de foco total
              </p>
            </div>
          </div>

          {/* Disciplina — agora é um ComboBox no header */}
          <div className="w-full sm:w-auto sm:min-w-[220px]">
            <ComboBox
              options={disciplinaOptions}
              value={disciplinaManual || disciplinaNome}
              onChange={handleDisciplinaManualChange}
              placeholder="Selecione ou crie disciplina..."
              icon={BookOpen}
              allowCreate={true}
              createLabel="Nova disciplina"
              loading={loadingAssuntos}
              emptyLabel="Nenhuma disciplina encontrada"
            />
            {erroDisciplina && !disciplinaManual && (
              <p className="text-[10px] text-amber-600 mt-1 font-bold flex items-center gap-1">
                <AlertTriangle size={10} /> Disciplina não reconhecida — selecione ou crie
              </p>
            )}
          </div>
        </div>

        {/* BODY */}
        <div className="p-6 md:p-8 overflow-y-auto flex-1" style={{ scrollbarWidth: 'thin' }}>
          {step === 1 ? (
            <div className="flex flex-col items-center justify-center py-8 space-y-8 h-full">
              <div className="text-center space-y-2">
                <h3 className="text-2xl font-bold text-zinc-800 dark:text-white">Resolveu questões?</h3>
                <p className="text-zinc-500 text-sm max-w-xs mx-auto">Registre seu desempenho para alimentar as estatísticas de acertos.</p>
              </div>
              <div className="grid grid-cols-2 gap-6 w-full max-w-md">
                <button type="button" onClick={() => { setHasQuestions(false); setStep(2); }} className="flex flex-col items-center justify-center gap-3 p-6 rounded-[32px] border-2 border-zinc-100 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-all group h-40">
                  <XCircle size={42} className="text-zinc-300 group-hover:text-red-500 transition-colors" />
                  <span className="font-bold text-base sm:text-lg text-zinc-600 dark:text-zinc-400 text-center">Apenas Estudo</span>
                </button>
                <button type="button" onClick={() => { setHasQuestions(true); setStep(2); }} className="flex flex-col items-center justify-center gap-3 p-6 rounded-[32px] border-2 border-emerald-100 dark:border-emerald-900/30 bg-emerald-50/50 dark:bg-emerald-900/10 hover:border-emerald-500 hover:shadow-xl hover:shadow-emerald-500/20 transition-all group h-40">
                  <Target size={42} className="text-emerald-500 group-hover:scale-110 transition-transform" />
                  <span className="font-bold text-base sm:text-lg text-emerald-700 dark:text-emerald-400 text-center">Sim, resolvi!</span>
                </button>
              </div>
              <div className="flex gap-4 mt-6 w-full max-w-md">
                {onDiscard && (
                  <button type="button" onClick={() => setShowDiscardModal(true)} className="flex-1 flex items-center justify-center gap-2 px-3 py-3 rounded-xl border-2 border-red-100 dark:border-red-900/30 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 font-bold uppercase text-xs tracking-wider transition-all">
                    <Trash2 size={16} /> Descartar
                  </button>
                )}
                <button type="button" onClick={() => { if (onCancel) onCancel(); setTimeout(() => window.dispatchEvent(new CustomEvent('StudyTimer:FinishResume')), 100); }} className="flex-[2] flex items-center justify-center gap-2 px-3 py-3 rounded-xl border-2 border-zinc-200 dark:border-zinc-700 hover:border-zinc-400 dark:hover:border-zinc-600 text-zinc-600 dark:text-zinc-300 hover:text-black dark:hover:text-white font-bold uppercase text-xs tracking-wider transition-all">
                  <RotateCcw size={16} /> Retomar
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSaveSession} className="space-y-6">
              {errorMessage && (
                <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-xl text-red-500 text-sm font-medium flex items-center gap-2">
                  <AlertTriangle size={18} /> {errorMessage}
                </div>
              )}

              {hasMultipleContexts && (
                <div className="space-y-2">
                  <label className="text-xs font-bold text-zinc-400 uppercase tracking-wide ml-1">
                    Registrar em
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {availableContexts.map((context) => {
                      const active = selectedContext === context.type;
                      return (
                        <button
                          key={context.type}
                          type="button"
                          onClick={() => setSelectedContext(context.type)}
                          className={`p-3 rounded-xl border-2 text-left transition-all ${
                            active
                              ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/10'
                              : 'border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700'
                          }`}
                        >
                          <p className={`text-sm font-bold ${active ? 'text-emerald-700 dark:text-emerald-400' : 'text-zinc-700 dark:text-zinc-300'}`}>
                            {context.label}
                          </p>
                          <p className="text-[10px] text-zinc-500 font-medium">
                            {context.type === 'ciclo' ? 'Mantém a conclusão e revisão do ciclo' : 'Permite teoria ainda não concluída'}
                          </p>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <label className="text-xs font-bold text-zinc-400 uppercase tracking-wide ml-1">
                  Tipo de registro
                </label>
                <div className="grid grid-cols-2 gap-2">
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
                          }
                        }}
                        className={`flex items-center justify-center gap-2 rounded-2xl border-2 px-3 py-3 text-sm font-black transition-all ${
                          active
                            ? 'border-emerald-500 bg-emerald-50 text-emerald-700 dark:bg-emerald-900/10 dark:text-emerald-300'
                            : 'border-zinc-200 bg-white text-zinc-600 hover:border-emerald-200 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300'
                        }`}
                      >
                        <Icon size={16} />
                        {option.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-4">
                <AnimatePresence>
                  {topics.map((topic, index) => (
                    <motion.div
                      key={topic.id}
                      initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }}
                      className="bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 relative"
                    >
                      {topics.length > 1 && (
                        <div className="flex justify-between items-center mb-4 pb-3 border-b border-zinc-200 dark:border-zinc-800">
                          <span className="text-xs font-black text-zinc-400 uppercase tracking-wide">Tópico #{index + 1}</span>
                          <button type="button" onClick={() => removeTopic(index)} className="text-zinc-400 hover:text-red-500 transition-colors"><X size={16} /></button>
                        </div>
                      )}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-5">
                          {/* ── ASSUNTO ComboBox ── */}
                          <div className="space-y-1.5 relative z-50">
                            <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest ml-1 flex items-center gap-1.5">
                              Assunto Estudado
                              <span className="text-[9px] normal-case font-normal text-zinc-400">(selecione ou crie)</span>
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
                            <div className="space-y-3">
                              <div className="flex items-center justify-between gap-3">
                                <div>
                                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-zinc-400">Revisao do ciclo</p>
                                  <p className="text-xs text-zinc-500">
                                    {revisaoModoCiclo === 'sugestao_automatica'
                                      ? 'Agenda automatica completa: 1 dia, 7 dias e 30 dias.'
                                      : 'Este ciclo exige escolha explicita ou Nao revisar em cada registro.'}
                                  </p>
                                </div>
                                <span className={`rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-wide ${
                                  revisaoModoCiclo === 'sugestao_automatica'
                                    ? 'bg-blue-50 text-blue-600 border border-blue-200 dark:bg-blue-900/20 dark:text-blue-300 dark:border-blue-800'
                                    : 'bg-zinc-100 text-zinc-600 border border-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-700'
                                }`}>
                                  {revisaoModoCiclo === 'sugestao_automatica' ? '1d + 7d + 30d' : 'Escolha obrigatoria'}
                                </span>
                              </div>

                              <div className="grid grid-cols-2 gap-2">
                                {[
                                  { value: 1, title: '1 dia', subtitle: 'Revisao inicial' },
                                  { value: 7, title: '7 dias', subtitle: 'Revisao semanal' },
                                  { value: 30, title: '30 dias', subtitle: 'Revisao mensal' },
                                  { value: 'skip', title: 'Nao revisar', subtitle: 'Sem agendamento' },
                                ].map((option) => {
                                  const active = topic.revisaoEscolhida === option.value;
                                  return (
                                    <button
                                      key={String(option.value)}
                                      type="button"
                                      onClick={() => updateTopicData(index, { revisaoEscolhida: option.value })}
                                      className={`rounded-2xl border-2 p-3 text-left transition-all ${
                                        active
                                          ? 'border-red-500 bg-red-50 dark:bg-red-900/10'
                                          : 'border-zinc-200 bg-white hover:border-zinc-300 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-zinc-700'
                                      }`}
                                    >
                                      <p className={`text-sm font-bold ${active ? 'text-red-700 dark:text-red-300' : 'text-zinc-700 dark:text-zinc-300'}`}>
                                        {option.title}
                                      </p>
                                      <p className="text-[10px] text-zinc-500 mt-0.5">{option.subtitle}</p>
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          )}

                          {selectedContext === 'ciclo' && tipoRegistro !== 'revisao' && topic.assunto && (
                            <div
                              onClick={() => updateTopicData(index, { markAsFinished: !topic.markAsFinished, teoriaNaoFinalizadaCiclo: false })}
                              className={`p-4 rounded-2xl border-2 cursor-pointer transition-all flex items-center gap-4 ${topic.markAsFinished ? 'bg-emerald-50 dark:bg-emerald-900/10 border-emerald-500' : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 hover:border-emerald-300'}`}
                            >
                              <div className={`w-6 h-6 rounded-md border-2 flex items-center justify-center transition-colors shrink-0 ${topic.markAsFinished ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-zinc-300 dark:border-zinc-600 text-transparent'}`}>
                                <CheckSquare size={14} strokeWidth={4} />
                              </div>
                              <div>
                                <p className={`text-sm font-bold ${topic.markAsFinished ? 'text-emerald-700 dark:text-emerald-400' : 'text-zinc-700 dark:text-zinc-300'}`}>
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
                              className={`p-4 rounded-2xl border-2 cursor-pointer transition-all flex items-center gap-4 ${topic.teoriaNaoFinalizadaCiclo ? 'bg-amber-50 dark:bg-amber-900/10 border-amber-500' : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 hover:border-amber-300'}`}
                            >
                              <div className={`w-6 h-6 rounded-md border-2 flex items-center justify-center transition-colors shrink-0 ${topic.teoriaNaoFinalizadaCiclo ? 'bg-amber-500 border-amber-500 text-white' : 'border-zinc-300 dark:border-zinc-600 text-transparent'}`}>
                                <AlertTriangle size={14} strokeWidth={3} />
                              </div>
                              <div>
                                <p className={`text-sm font-bold ${topic.teoriaNaoFinalizadaCiclo ? 'text-amber-700 dark:text-amber-400' : 'text-zinc-700 dark:text-zinc-300'}`}>
                                  {topic.teoriaNaoFinalizadaCiclo ? 'Teoria ainda nao finalizada' : 'Marcar teoria nao finalizada'}
                                </p>
                                <p className="text-[10px] text-zinc-500 mt-0.5">
                                  {topic.teoriaNaoFinalizadaCiclo ? 'Este assunto volta na proxima sessao desta disciplina.' : 'Outras disciplinas continuam girando normalmente.'}
                                </p>
                              </div>
                            </div>
                          )}
                          {selectedContext === 'cronograma' && tipoRegistro !== 'revisao' && topic.assunto && (
                            <div
                              onClick={() => updateTopicData(index, { naoConcluidoCronograma: !topic.naoConcluidoCronograma })}
                              className={`p-4 rounded-2xl border-2 cursor-pointer transition-all flex items-center gap-4 ${topic.naoConcluidoCronograma ? 'bg-amber-50 dark:bg-amber-900/10 border-amber-500' : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 hover:border-amber-300'}`}
                            >
                              <div className={`w-6 h-6 rounded-md border-2 flex items-center justify-center transition-colors shrink-0 ${topic.naoConcluidoCronograma ? 'bg-amber-500 border-amber-500 text-white' : 'border-zinc-300 dark:border-zinc-600 text-transparent'}`}>
                                <AlertTriangle size={14} strokeWidth={3} />
                              </div>
                              <div>
                                <p className={`text-sm font-bold ${topic.naoConcluidoCronograma ? 'text-amber-700 dark:text-amber-400' : 'text-zinc-700 dark:text-zinc-300'}`}>
                                  {topic.naoConcluidoCronograma ? 'Teoria ainda não concluída' : 'Marcar teoria ainda não concluída'}
                                </p>
                                <p className="text-[10px] text-zinc-500 mt-0.5">
                                  {topic.naoConcluidoCronograma ? 'Esse assunto volta no próximo slot elegível do cronograma.' : 'Use quando o registro precisa voltar como pendência de teoria.'}
                                </p>
                              </div>
                            </div>
                          )}
                        </div>

                        <div className="space-y-5">
                          <TimeInputControl currentMinutes={topic.minutes} onTimeChange={(newMin) => handleTimeUpdate(index, newMin)} />
                          {hasQuestions && (
                            <div className="bg-zinc-50 dark:bg-zinc-900/50 p-3 rounded-xl border border-zinc-200 dark:border-zinc-800 space-y-3">
                              <span className="text-xs font-extrabold text-zinc-400 uppercase tracking-widest flex items-center gap-1.5">
                                <Target size={14} className="text-emerald-500" /> Questões
                              </span>
                              <div className="flex gap-3">
                                <div className="flex-1 text-center">
                                  <label className="text-[9px] font-bold text-zinc-400 uppercase block mb-1">Feitas</label>
                                  <input
                                    type="number"
                                    value={topic.questions}
                                    onChange={(e) => updateTopicData(index, { questions: parseInt(e.target.value) || 0 })}
                                    min="0"
                                    className="w-full border border-zinc-200 dark:border-zinc-700 rounded-lg py-2 text-center font-bold text-lg bg-white dark:bg-zinc-900 focus:border-indigo-500 outline-none"
                                  />
                                </div>
                                <div className="flex-1 text-center">
                                  <label className="text-[9px] font-bold text-zinc-400 uppercase block mb-1">Acertos</label>
                                  <input
                                    type="number"
                                    value={topic.correct}
                                    onChange={(e) => updateTopicData(index, { correct: parseInt(e.target.value) || 0 })}
                                    min="0"
                                    className="w-full border border-zinc-200 dark:border-zinc-700 rounded-lg py-2 text-center font-bold text-lg bg-white dark:bg-zinc-900 text-emerald-600 focus:border-emerald-500 outline-none"
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

                <button type="button" onClick={addTopic} className="w-full py-3 rounded-xl border-2 border-dashed border-zinc-300 dark:border-zinc-700 text-zinc-500 dark:text-zinc-400 font-bold text-xs uppercase tracking-wide hover:border-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-900/10 transition-all flex items-center justify-center gap-2">
                  <Split size={16} /> Dividir Sessão / Adicionar Tópico
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

              <div className="flex gap-4 pt-4 border-t border-zinc-100 dark:border-zinc-800">
                <button type="button" onClick={() => setStep(1)} className="px-6 py-4 rounded-xl font-bold text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors text-sm">Voltar</button>
                <button
                  type="submit"
                  disabled={isSubmitting || (topics.length > 1 && !isTimeBalanced)}
                  className="flex-1 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 disabled:hover:bg-emerald-600  text-white rounded-xl font-bold shadow-xl shadow-emerald-600/20 transition-all transform hover:-translate-y-0.5 active:translate-y-0 flex items-center justify-center gap-3 text-base py-4"
                >
                  <Save size={20} /> {isSubmitting ? 'Salvando...' : 'Salvar Sessão'}
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
