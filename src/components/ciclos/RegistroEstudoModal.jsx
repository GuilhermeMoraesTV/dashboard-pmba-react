import React, { useState, useEffect, useMemo, useRef } from 'react';
import { serverTimestamp, doc, getDoc, addDoc, collection, query, where, getDocs, writeBatch, setDoc, updateDoc, arrayUnion } from 'firebase/firestore';
import { db } from '../../firebaseConfig';
import {
  X, Save, Clock, Target, AlertTriangle, ChevronDown, CheckSquare,
  Calendar as CalendarIcon, ChevronUp, CheckCircle2, BookOpen, ChevronLeft, ChevronRight, AlertCircle,
  Plus, Layers, Trash2, Edit3, LogOut, CalendarDays, RotateCcw, Info
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useBodyScrollLock } from '../../hooks/useBodyScrollLock';

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
  .custom-scrollbar::-webkit-scrollbar-thumb { background: #d4d4d8; border-radius: 10px; }
  .dark .custom-scrollbar::-webkit-scrollbar-thumb { background: #3f3f46; }

  input[type=number]::-webkit-inner-spin-button,
  input[type=number]::-webkit-outer-spin-button { -webkit-appearance: none; margin: 0; }

  .registro-modal-form-section {
    position: relative;
    overflow: visible;
    background: #ededee;
    border-radius: 18px;
    border: 1px solid rgba(161, 161, 170, 0.58);
    box-shadow:
      0 16px 38px rgba(15, 23, 42, 0.12),
      0 10px 28px rgba(239, 68, 68, 0.07),
      inset 0 1px 0 rgba(255,255,255,0.72);
    transition: border-color 0.25s ease, box-shadow 0.25s ease, transform 0.25s ease, background 0.25s ease;
  }
  .dark .registro-modal-form-section {
    background: #171717;
    border: 1px solid rgba(82, 82, 91, 0.86);
    box-shadow:
      0 18px 44px rgba(0, 0, 0, 0.42),
      0 0 32px rgba(239, 68, 68, 0.11),
      inset 0 1px 0 rgba(255,255,255,0.05);
  }
  .registro-modal-form-section::before {
    content: "";
    position: absolute;
    inset: 0;
    pointer-events: none;
    border-radius: inherit;
    background:
      linear-gradient(90deg, rgba(239,68,68,0.12), transparent 28%),
      radial-gradient(circle at top left, rgba(239,68,68,0.10), transparent 38%);
    opacity: 0;
    transition: opacity 0.25s ease;
  }
  .registro-modal-form-section:focus-within {
    border-color: #ef4444;
    box-shadow:
      0 0 0 3px rgba(239, 68, 68, 0.12),
      0 18px 44px rgba(239, 68, 68, 0.16),
      inset 0 1px 0 rgba(255,255,255,0.08);
    transform: translateY(-1px);
  }
  .registro-modal-form-section:focus-within::before { opacity: 1; }

  .registro-modal-form-section:hover {
    border-color: rgba(239, 68, 68, 0.34);
    box-shadow:
      0 18px 42px rgba(15, 23, 42, 0.13),
      0 0 34px rgba(239, 68, 68, 0.12),
      inset 0 1px 0 rgba(255,255,255,0.72);
  }
  .dark .registro-modal-form-section:hover {
    border-color: rgba(239, 68, 68, 0.42);
    box-shadow:
      0 20px 48px rgba(0, 0, 0, 0.48),
      0 0 36px rgba(239, 68, 68, 0.16),
      inset 0 1px 0 rgba(255,255,255,0.06);
  }

  .registro-section-kicker {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    padding: 0;
    background: transparent;
    border: 0;
    color: #52525b;
    box-shadow: none;
    font-size: 9px;
    font-weight: 900;
    letter-spacing: 0.18em;
    text-transform: uppercase;
  }
  .dark .registro-section-kicker {
    background: transparent;
    border-color: transparent;
    color: #d4d4d8;
  }
  .registro-section-kicker::before {
    content: "";
    width: 4px;
    height: 4px;
    border-radius: 999px;
    background: #ef4444;
    box-shadow: 0 0 8px rgba(239, 68, 68, 0.60);
  }

  .registro-modal-header {
    background: rgba(237, 237, 238, 0.96);
  }
  .dark .registro-modal-header {
    background: rgba(5, 5, 5, 0.98) !important;
    border-color: rgba(39, 39, 42, 0.95) !important;
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
      linear-gradient(rgba(244, 244, 245, 0.82) 1px, transparent 1px),
      linear-gradient(90deg, rgba(244, 244, 245, 0.82) 1px, transparent 1px);
    background-size: 28px 28px;
  }
  .dark .registro-ambient-grid {
    background-image:
      linear-gradient(rgba(39, 39, 42, 0.52) 1px, transparent 1px),
      linear-gradient(90deg, rgba(39, 39, 42, 0.52) 1px, transparent 1px);
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

  .revisao-chip {
    position: relative;
    overflow: hidden;
    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  }
  .revisao-chip:active { transform: scale(0.95); }
`;

// =======================================================
// 🔧 AJUSTES DE TAMANHO
// =======================================================
const MODAL_MAX_W_PX = 880;
const MODAL_WITH_QUEUE_MAX_W_PX = 1080;
const MODAL_COLLAPSED_MAX_H_PX = 860;
const MODAL_EXPANDED_MAX_H_PX = 900;

const QUEUE_MOBILE_H_PX = 150;
const FOOTER_PADDING_MOBILE = 'p-3';
const FOOTER_PADDING_DESKTOP = 'md:p-3';
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
      className="absolute inset-0 z-[60] bg-black/60 backdrop-blur-sm flex items-center justify-center p-6 rounded-[24px]"
      onClick={(e) => e.stopPropagation()}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="bg-white dark:bg-[#1E1E1E] p-6 rounded-2xl shadow-2xl border border-zinc-200 dark:border-[#333] w-full max-w-xs text-center"
      >
        <div className="w-11 h-11 bg-amber-100 dark:bg-amber-900/30 text-amber-600 rounded-full flex items-center justify-center mx-auto mb-3">
          <LogOut size={22} />
        </div>
        <h3 className="text-base font-bold text-zinc-900 dark:text-white mb-1">Sair sem salvar?</h3>
        <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-5">Você tem dados não salvos. Eles serão perdidos.</p>
        <div className="flex gap-2">
          <button
            onClick={onCancel}
            className="flex-1 py-2.5 rounded-xl bg-zinc-100 dark:bg-[#2A2A2A] text-zinc-700 dark:text-zinc-300 font-semibold text-xs hover:bg-zinc-200 dark:hover:bg-[#333] transition-colors border border-transparent dark:border-[#444]"
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

// 2. TOAST DE SUCESSO
const SuccessToast = () => (
  <motion.div
    initial={{ opacity: 0, y: -50, x: 50 }}
    animate={{ opacity: 1, y: 0, x: 0 }}
    exit={{ opacity: 0, y: -20 }}
    className="fixed top-6 right-6 z-[9999] bg-white dark:bg-[#1E1E1E] border border-emerald-500/30 shadow-2xl rounded-2xl p-4 flex items-center gap-4 max-w-sm pointer-events-none"
  >
    <div className="w-10 h-10 bg-emerald-500 text-white rounded-full flex items-center justify-center shadow-lg shadow-emerald-500/30">
      <CheckCircle2 size={20} />
    </div>
    <div>
      <h4 className="text-sm font-bold text-zinc-800 dark:text-white">Estudo Registrado!</h4>
      <p className="text-xs text-zinc-500 dark:text-zinc-400">Sessão gravada com sucesso.</p>
    </div>
  </motion.div>
);

// 3. Select Customizado
const CustomSelect = ({
  options,
  value,
  onChange,
  placeholder,
  icon: Icon,
  disabled,
  loading,
  name,
  allowCreate = false,
  createLabel = 'Criar',
  onCreate,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [creating, setCreating] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) setIsOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selectedOption = options.find(opt => opt.value === value);
  const filteredOptions = useMemo(() => {
    const term = normalizeTextKey(search);
    if (!term) return options;
    return options.filter(opt => normalizeTextKey(opt.label).includes(term));
  }, [options, search]);
  const trimmedSearch = search.trim();
  const canCreate = allowCreate
    && trimmedSearch
    && !options.some(opt => normalizeTextKey(opt.label) === normalizeTextKey(trimmedSearch));

  const handleSelect = (selectedValue) => {
    onChange({ target: { name, value: selectedValue } });
    setSearch('');
    setIsOpen(false);
  };

  const handleCreate = async () => {
    if (!canCreate || !onCreate || creating) return;
    setCreating(true);
    try {
      const createdValue = await onCreate(trimmedSearch);
      onChange({ target: { name, value: createdValue || trimmedSearch } });
      setSearch('');
      setIsOpen(false);
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <div
        onClick={() => !disabled && setIsOpen(!isOpen)}
        className={`w-full pl-3 pr-8 py-2 bg-white dark:bg-zinc-950 border ${isOpen ? 'border-red-500' : 'border-zinc-300 dark:border-zinc-700'} rounded-xl flex items-center justify-between cursor-pointer transition-all ${disabled ? 'opacity-50 cursor-not-allowed' : 'hover:border-zinc-400 dark:hover:border-zinc-500'}`}
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
            className="absolute z-[220] w-full mt-1 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-700 rounded-xl shadow-2xl max-h-48 overflow-y-auto custom-scrollbar"
          >
            <div className="p-1 space-y-0.5">
              {allowCreate && (
                <div className="p-1">
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleCreate();
                      }
                    }}
                    autoFocus
                    placeholder="Digite para buscar ou criar..."
                    className="w-full px-3 py-2 rounded-lg bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 text-sm text-zinc-800 dark:text-white placeholder:text-zinc-400 outline-none focus:border-red-500"
                  />
                </div>
              )}

              {filteredOptions.length > 0 ? (
                filteredOptions.map((opt) => (
                  <div
                    key={opt.value}
                    onClick={() => handleSelect(opt.value)}
                    className={`px-3 py-2 rounded-lg text-sm cursor-pointer transition-colors flex items-center justify-between gap-2 ${value === opt.value
                      ? 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 font-semibold'
                      : 'text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-900'
                    }`}
                  >
                    <span className="truncate">{opt.label}</span>
                    {value === opt.value && <CheckCircle2 size={13} className="shrink-0" />}
                  </div>
                ))
              ) : allowCreate && trimmedSearch ? null : (
                <div className="p-3 text-center text-xs text-zinc-400">Nenhum item disponível</div>
              )}

              {canCreate && (
                <button
                  type="button"
                  onClick={handleCreate}
                  disabled={creating}
                  className="w-full px-3 py-2 rounded-lg text-sm cursor-pointer transition-colors flex items-center gap-2 text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/30 font-semibold disabled:opacity-60"
                >
                  {creating ? (
                    <span className="animate-spin h-3.5 w-3.5 border-2 border-red-500 border-t-transparent rounded-full" />
                  ) : (
                    <Plus size={14} />
                  )}
                  <span className="truncate">{createLabel} "{trimmedSearch}"</span>
                </button>
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
    for (let i = 0; i < firstDay; i++) slots.push(<div key={`empty-${i}`} className="w-7 h-7" />);
    for (let i = 1; i <= daysInMonth; i++) {
      const isSelected = dateObj.getDate() === i && dateObj.getMonth() === month && dateObj.getFullYear() === year;
      const isToday = new Date().getDate() === i && new Date().getMonth() === month && new Date().getFullYear() === year;
      slots.push(
        <button
          key={i}
          onClick={(e) => { e.preventDefault(); handleSelectDay(i); }}
          className={`w-7 h-7 rounded-lg text-xs font-medium flex items-center justify-center transition-all ${isSelected
            ? 'bg-red-600 text-white shadow-md shadow-red-500/20'
            : isToday
              ? 'bg-zinc-200 dark:bg-[#333] text-zinc-900 dark:text-white font-bold'
              : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-[#2A2A2A]'
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
        className={`flex items-center gap-3 w-full bg-white dark:bg-[#2A2A2A] border ${isOpen ? 'border-red-500' : 'border-zinc-300 dark:border-[#444]'} rounded-xl overflow-hidden cursor-pointer transition-all hover:border-zinc-400 dark:hover:border-[#555]`}
      >
        <div className="bg-red-600 w-12 shrink-0 flex flex-col items-center justify-center py-1.5">
          <span className="text-[8px] font-bold uppercase text-red-100 tracking-wider">{monthDisplay}</span>
          <span className="text-lg font-black leading-none text-white">{dayDisplay}</span>
        </div>
        <div className="flex-1 flex items-center justify-between pr-3">
          <span className="text-xs font-bold text-zinc-700 dark:text-zinc-200 capitalize">{weekDisplay}</span>
          <CalendarIcon size={14} className={`transition-colors ${isOpen ? 'text-red-500' : 'text-zinc-400 dark:text-zinc-500'}`} />
        </div>
      </div>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -4 }}
            transition={{ duration: 0.15 }}
            className="absolute left-0 top-full mt-2 z-[220] bg-white dark:bg-[#1E1E1E] border border-zinc-200 dark:border-[#333] rounded-2xl shadow-xl p-3 w-[240px]"
          >
            <div className="flex justify-between items-center mb-2">
              <button onClick={(e) => { e.preventDefault(); changeMonth(-1); }} className="p-1 hover:bg-zinc-100 dark:hover:bg-[#2A2A2A] rounded-lg text-zinc-500 transition-colors">
                <ChevronLeft size={14} />
              </button>
              <span className="text-xs font-semibold text-zinc-800 dark:text-white capitalize">
                {viewDate.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}
              </span>
              <button onClick={(e) => { e.preventDefault(); changeMonth(1); }} className="p-1 hover:bg-zinc-100 dark:hover:bg-[#2A2A2A] rounded-lg text-zinc-500 transition-colors">
                <ChevronRight size={14} />
              </button>
            </div>
            <div className="grid grid-cols-7 gap-1 place-items-center mb-1">
              {['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].map((d, i) => (
                <span key={i} className="text-[8px] font-bold text-zinc-400 uppercase">{d}</span>
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

// 5. Loading do botão
const SaveButtonLoading = () => (
  <div className="relative flex items-center justify-center gap-2">
    <div className="animate-spin h-3.5 w-3.5 border-2 border-white border-t-transparent rounded-full" />
    <span className="text-[11px] font-bold uppercase tracking-wide">Salvando...</span>
  </div>
);

// 6. Logo de contexto (Tamanho Menor)
const ContextLogo = ({ type, logoUrl, active }) => {
  const isCiclo = type === 'ciclo';
  return (
    <div className={`relative flex h-12 w-12 md:h-14 md:w-14 shrink-0 items-center justify-center overflow-hidden rounded-2xl border transition-all duration-300 ${
      active
        ? isCiclo
          ? 'border-red-500 bg-red-50 dark:bg-red-900/10'
          : 'border-zinc-500 dark:border-zinc-400 bg-zinc-100 dark:bg-[#2A2A2A]'
        : 'border-transparent bg-white dark:bg-[#2A2A2A]'
    }`}>
      {logoUrl ? (
        <img
          src={logoUrl}
          alt=""
          className="h-full w-full object-contain p-1 mix-blend-multiply dark:mix-blend-normal"
          onError={(event) => { event.currentTarget.style.display = 'none'; }}
        />
      ) : (
        isCiclo ? <Layers size={24} className={active ? "text-red-600" : "text-zinc-400"} /> : <CalendarDays size={24} className={active ? "text-zinc-800 dark:text-white" : "text-zinc-400"} />
      )}
    </div>
  );
};

const normalizeTextKey = (value) =>
  String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();

// 7. Chip de revisão
const RevisaoChip = ({ value, label, active, onClick, autoMode }) => {
  const isSkip = value === 'skip';
  return (
    <button
      type="button"
      onClick={onClick}
      className={`revisao-chip flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[11px] font-semibold border transition-all ${
        active
          ? isSkip
            ? 'bg-zinc-800 dark:bg-zinc-200 border-zinc-800 dark:border-zinc-200 text-white dark:text-zinc-900'
            : 'bg-red-600 border-red-600 text-white'
          : isSkip
            ? 'border-zinc-300 dark:border-[#444] bg-white dark:bg-[#2A2A2A] text-zinc-500 dark:text-zinc-400 hover:border-zinc-400 dark:hover:border-[#555]'
            : autoMode
              ? 'border-emerald-200 dark:border-emerald-900/30 bg-emerald-50 dark:bg-emerald-900/10 text-emerald-700 dark:text-emerald-400 hover:border-emerald-400'
              : 'border-zinc-300 dark:border-[#444] bg-white dark:bg-[#2A2A2A] text-zinc-600 dark:text-zinc-300 hover:border-red-300 dark:hover:border-red-800'
      }`}
    >
      {!isSkip && (
        <span className={`text-[8px] font-black tracking-wide ${
          active ? 'text-white/80' : autoMode ? 'text-emerald-400' : 'text-zinc-400'
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
  useBodyScrollLock(true, { bodyClass: 'registro-modal-open' });

  const [viewportHeight, setViewportHeight] = useState(window.innerHeight);

  useEffect(() => {
    const handleResize = () => setViewportHeight(window.innerHeight);
    window.addEventListener('resize', handleResize);

    const footer = document.querySelector('.app-global-footer');
    const previousFooterDisplay = footer?.style?.display || '';
    if (footer) footer.style.display = 'none';

    return () => {
      window.removeEventListener('resize', handleResize);
      if (footer) footer.style.display = previousFooterDisplay;
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
  const [disciplinasCriadas, setDisciplinasCriadas] = useState([]);
  const [assuntosCriadosPorDisciplina, setAssuntosCriadosPorDisciplina] = useState({});
  const [selectedAssuntoNome, setSelectedAssuntoNome] = useState('');
  const [loadingAssuntos, setLoadingAssuntos] = useState(false);
  const [markAsFinished, setMarkAsFinished] = useState(false);
  const [naoConcluidoCronograma, setNaoConcluidoCronograma] = useState(false);
  const [showPendenciaInfo, setShowPendenciaInfo] = useState(false);
  const [revisaoEscolhida, setRevisaoEscolhida] = useState(() => getRevisaoEscolhidaInicial());
  const [revisaoModoCiclo, setRevisaoModoCiclo] = useState(REVISAO_MODO_FLEXIVEL);
  const [checkingFinishedStatus, setCheckingFinishedStatus] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const assuntosLoadKeyRef = useRef('');

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
  const hasQuestionPerformance = Number(formData.questoesFeitas) > 0 && !hasAcertosError;
  const percentageTone = percentage >= 80
    ? 'bg-emerald-100 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-500/25'
    : percentage >= 60
      ? 'bg-amber-100 dark:bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-500/25'
      : 'bg-red-100 dark:bg-red-500/15 text-red-700 dark:text-red-300 border-red-200 dark:border-red-500/25';

  const isTimeFromTimer = useMemo(
    () => initialData?.tempoEstudadoMinutos !== undefined && initialData.tempoEstudadoMinutos > 0,
    [initialData]
  );

  const selectedContextMeta = useMemo(
    () => contextOptions.find(c => c.type === selectedContext) || null,
    [contextOptions, selectedContext]
  );

  const disciplinasAtivas = useMemo(() => {
    const source = Array.isArray(selectedContextMeta?.disciplinas) && selectedContextMeta.disciplinas.length > 0
      ? selectedContextMeta.disciplinas
      : (selectedContext === 'ciclo' ? disciplinasDoCiclo : []);
    const normalized = (source || []).map(normalizeDisciplina).filter(d => d && d.inCiclo !== false);
    const existingKeys = new Set(normalized.flatMap(d => [String(d.id), normalizeTextKey(d.nome)]));
    const extras = disciplinasCriadas
      .filter(d => d.contextType === selectedContext && d.contextId === selectedContextMeta?.id)
      .map(normalizeDisciplina)
      .filter(d => d && !existingKeys.has(String(d.id)) && !existingKeys.has(normalizeTextKey(d.nome)));
    return [...normalized, ...extras];
  }, [disciplinasCriadas, disciplinasDoCiclo, selectedContext, selectedContextMeta]);

  const selectedContextId = selectedContextMeta?.id || (selectedContext === 'ciclo' ? cicloId : null);

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
    setNaoConcluidoCronograma(false);
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
    const loadKey = `${selectedContext || ''}|${selectedContextId || ''}|${formData.disciplinaId || ''}`;
    const fetchAssuntos = async () => {
      if (!formData.disciplinaId || !selectedContext) { setAssuntosDisponiveis([]); return; }
      const disciplinaLocal = disciplinasAtivas.find(d => d.id === formData.disciplinaId);
      const assuntosExtras = assuntosCriadosPorDisciplina[formData.disciplinaId] || [];
      if (disciplinaLocal && Array.isArray(disciplinaLocal.assuntos)) {
        setAssuntosDisponiveis(normalizeAssuntos([...disciplinaLocal.assuntos, ...assuntosExtras]));
        return;
      }
      if (selectedContext !== 'ciclo' || !selectedContextId || !userId) { setAssuntosDisponiveis([]); return; }
      setLoadingAssuntos(true);
      try {
        const docRef = doc(db, 'users', userId, 'ciclos', selectedContextId, 'disciplinas', formData.disciplinaId);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) setAssuntosDisponiveis(normalizeAssuntos([...(docSnap.data().assuntos || []), ...assuntosExtras]));
        else setAssuntosDisponiveis([]);
      } catch (error) {
        console.error(error);
        setAssuntosDisponiveis([]);
      } finally {
        setLoadingAssuntos(false);
      }
    };
    fetchAssuntos();
    if (!editingQueueId && assuntosLoadKeyRef.current !== loadKey) {
      setSelectedAssuntoNome('');
      setMarkAsFinished(false);
      setNaoConcluidoCronograma(false);
      assuntosLoadKeyRef.current = loadKey;
    }
  }, [formData.disciplinaId, selectedContext, selectedContextId, userId, disciplinasAtivas, editingQueueId, assuntosCriadosPorDisciplina]);

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

  const persistCronogramaDisciplina = async (disciplina) => {
    if (selectedContext !== 'cronograma' || !selectedContextId || !userId) return;
    try {
      const cronogramaRef = doc(db, 'users', userId, 'cronogramas', selectedContextId);
      const cronogramaSnap = await getDoc(cronogramaRef);
      const snapshot = Array.isArray(cronogramaSnap.data()?.disciplinasSnapshot)
        ? cronogramaSnap.data().disciplinasSnapshot
        : [];
      if (snapshot.some(d => String(d.id) === String(disciplina.id) || normalizeTextKey(d.nome) === normalizeTextKey(disciplina.nome))) {
        return;
      }
      await updateDoc(cronogramaRef, { disciplinasSnapshot: [...snapshot, disciplina] });
    } catch (error) {
      console.error(error);
    }
  };

  const persistCronogramaAssunto = async (disciplinaId, assuntoNome) => {
    if (selectedContext !== 'cronograma' || !selectedContextId || !userId || !disciplinaId || !assuntoNome) return;
    try {
      const cronogramaRef = doc(db, 'users', userId, 'cronogramas', selectedContextId);
      const cronogramaSnap = await getDoc(cronogramaRef);
      const snapshot = Array.isArray(cronogramaSnap.data()?.disciplinasSnapshot)
        ? cronogramaSnap.data().disciplinasSnapshot
        : [];
      const nextSnapshot = snapshot.map((disciplina) => {
        if (String(disciplina.id) !== String(disciplinaId)) return disciplina;
        const assuntos = Array.isArray(disciplina.assuntos) ? disciplina.assuntos : [];
        const exists = assuntos.some(a => normalizeTextKey(typeof a === 'string' ? a : a?.nome) === normalizeTextKey(assuntoNome));
        return exists ? disciplina : { ...disciplina, assuntos: [...assuntos, assuntoNome] };
      });
      await updateDoc(cronogramaRef, { disciplinasSnapshot: nextSnapshot });
    } catch (error) {
      console.error(error);
    }
  };

  const handleCreateDisciplina = async (nomeDigitado) => {
    const nome = nomeDigitado.trim();
    const existente = disciplinasAtivas.find(d => normalizeTextKey(d.nome) === normalizeTextKey(nome));
    if (existente) return existente.id;

    let novaDisciplina = {
      id: `manual-${Date.now()}`,
      nome,
      peso: 3,
      assuntos: [],
      tempoAlocadoSemanalMinutos: 0,
      inCiclo: true,
      criadaViRegistro: true,
      contextType: selectedContext,
      contextId: selectedContextId,
    };

    if (selectedContext === 'ciclo' && selectedContextId && userId) {
      try {
        const disciplinaRef = doc(collection(db, 'users', userId, 'ciclos', selectedContextId, 'disciplinas'));
        novaDisciplina = { ...novaDisciplina, id: disciplinaRef.id };
        await setDoc(disciplinaRef, {
          nome,
          peso: 3,
          assuntos: [],
          tempoAlocadoSemanalMinutos: 0,
          inCiclo: true,
          criadaViRegistro: true,
        }, { merge: true });
      } catch (error) {
        console.error(error);
      }
    }

    setDisciplinasCriadas(prev => [...prev, novaDisciplina]);
    await persistCronogramaDisciplina(novaDisciplina);
    setAssuntosDisponiveis([]);
    setSelectedAssuntoNome('');
    return novaDisciplina.id;
  };

  const handleCreateAssunto = async (nomeDigitado) => {
    const nome = nomeDigitado.trim();
    const existente = assuntoOptions.find(opt => normalizeTextKey(opt.label) === normalizeTextKey(nome));
    if (existente) return existente.value;

    const disciplinaId = formData.disciplinaId;
    setAssuntosCriadosPorDisciplina(prev => ({
      ...prev,
      [disciplinaId]: [...(prev[disciplinaId] || []), nome],
    }));
    setAssuntosDisponiveis(prev => normalizeAssuntos([...prev, nome]));

    if (selectedContext === 'ciclo' && selectedContextId && userId && disciplinaId) {
      try {
        const disciplinaRef = doc(db, 'users', userId, 'ciclos', selectedContextId, 'disciplinas', disciplinaId);
        await updateDoc(disciplinaRef, { assuntos: arrayUnion(nome) });
      } catch (error) {
        console.error(error);
      }
    }

    await persistCronogramaAssunto(disciplinaId, nome);
    return nome;
  };

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
    if (!selectedContext) { setErrorMessage('Escolha o planejamento (Ciclo ou Cronograma).'); return false; }
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
      naoConcluidoCronograma,
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
    setNaoConcluidoCronograma(false);
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
      setNaoConcluidoCronograma(Boolean(item.naoConcluidoCronograma));
      setRevisaoEscolhida(item.revisaoEscolhida ?? getRevisaoEscolhidaPlaceholder(item.contextoRegistro || selectedContext, revisaoModoCiclo));
    }, 100);
  };

  const removeFromQueue = (id) => {
    setQueue(queue.filter(item => item.id !== id));
    if (editingQueueId === id) {
      setEditingQueueId(null);
      setFormData(prev => ({ ...prev, disciplinaId: '', horas: 0, minutos: 0, questoesFeitas: 0, acertos: 0 }));
      setSelectedAssuntoNome('');
      setMarkAsFinished(false);
      setNaoConcluidoCronograma(false);
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
          naoConcluidoCronograma,
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
          ...(item.tipoRegistro !== 'revisao' && item.markAsFinished ? { markAsFinished: true, assuntoFinalizado: true } : {}),
          ...(item.tipoRegistro !== 'revisao' && (item.contextoRegistro || selectedContext) === 'cronograma' && item.naoConcluidoCronograma ? { naoConcluidoCronograma: true } : {}),
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
    const unique = base.filter((item, index, arr) =>
      arr.findIndex(other => normalizeTextKey(other.label) === normalizeTextKey(item.label)) === index
    );
    if (unique.length > 0 || !formData.disciplinaId) return unique;
    return [{ value: 'Estudo de Conteúdo', label: 'Estudo de Conteúdo' }];
  }, [assuntosDisponiveis, formData.disciplinaId]);

  const summary = useMemo(() =>
    queue.reduce((acc, curr) => ({ time: acc.time + curr.tempoTotal, questions: acc.questions + curr.questoesFeitas }), { time: 0, questions: 0 }),
    [queue]
  );

  const targetHeight = expanded ? MODAL_EXPANDED_MAX_H_PX : MODAL_COLLAPSED_MAX_H_PX;
  const safeMaxHeight = viewportHeight - (viewportHeight >= 760 ? 40 : 32);
  const finalHeight = Math.min(targetHeight, safeMaxHeight);
  const modalMaxWidth = queue.length > 0 ? MODAL_WITH_QUEUE_MAX_W_PX : MODAL_MAX_W_PX;

  const isAutoRevisao = revisaoModoCiclo === REVISAO_MODO_SUGESTAO;
  const revisaoOptions = [
    { value: 1, label: '1 dia' },
    { value: 7, label: '7 dias' },
    { value: 30, label: '30 dias' },
    { value: 'skip', label: 'Não revisar' },
  ];

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-4 md:p-5 bg-zinc-950/78 backdrop-blur-xl registro-ambient-grid"
      onClick={handleCloseRequest}
    >
      <style>{globalStyles}</style>
      <ConfirmCloseModal isOpen={showCloseConfirm} onCancel={() => setShowCloseConfirm(false)} onConfirm={() => { setShowCloseConfirm(false); onClose(); }} />
      <AnimatePresence>{showSuccess && <SuccessToast />}</AnimatePresence>

      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 8 }}
        transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
        style={{ maxHeight: finalHeight, width: '100%', maxWidth: `${modalMaxWidth}px` }}
        className="group relative bg-[#e6e6e8] dark:bg-[#070707] rounded-[26px] shadow-[0_28px_90px_rgba(0,0,0,0.42)] border border-zinc-300/80 dark:border-zinc-800 overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="registro-flow-strip h-1.5 w-full shrink-0" />
        {/* ── HEADER ── */}
        <div className="registro-modal-header relative z-10 flex flex-col gap-3 px-4 py-3 md:px-5 border-b border-zinc-300/80 dark:border-zinc-800 shrink-0">
          <div className="flex items-center justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3">
            <motion.div
              animate={{ rotate: [0, -4, 4, 0], scale: [1, 1.03, 1] }}
              transition={{ duration: 4.5, repeat: Infinity, ease: 'easeInOut' }}
              className="relative flex h-10 w-10 items-center justify-center rounded-2xl bg-red-600 text-white shadow-lg shadow-red-500/25"
            >
              <Save size={20} strokeWidth={1.8} />
            </motion.div>
            <div className="min-w-0">
              <p className="text-[9px] font-black uppercase tracking-[0.24em] text-red-600 dark:text-red-400 mb-0.5">
                MODOQAP • ATIVO E OPERANTE
              </p>
              <h2 className="truncate text-xl font-black tracking-tight text-zinc-950 dark:text-white leading-tight">
                Nova Sessão <span className="text-red-600">Registro</span>
              </h2>
            </div>
          </div>
          <button
            onClick={handleCloseRequest}
            className="p-2.5 bg-zinc-100 hover:bg-zinc-200 dark:bg-white/5 dark:hover:bg-white/10 text-zinc-500 dark:text-zinc-300 rounded-xl transition-all duration-300 hover:rotate-90"
          >
            <X size={18} />
          </button>
          </div>
        </div>

        <div className="pointer-events-none absolute left-1/2 top-[58%] z-0 h-72 w-[62%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-red-500/22 blur-[90px] dark:bg-red-600/24" />
        <div className="relative z-10 flex min-h-0 flex-1 overflow-hidden flex-col lg:flex-row">
          {/* ── FORM ── */}
          <div className="flex-1 overflow-y-auto md:overflow-visible px-4 py-3 md:px-4 md:py-2.5 custom-scrollbar space-y-3 md:space-y-2 bg-transparent">

            {/* Error */}
            {errorMessage && (
              <motion.div
                initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}
                className="px-3 py-2.5 bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-900/30 rounded-lg text-red-600 dark:text-red-400 text-[11px] font-medium flex items-center gap-2"
              >
                <AlertTriangle size={14} className="shrink-0" /> {errorMessage}
              </motion.div>
            )}

            {/* ── SEÇÃO: CONTEXTO (MENOR) ── */}
            {hasMultipleContexts && (
              <div className="registro-modal-form-section p-3 md:p-2.5">
                <p className="registro-section-kicker mb-2.5">
                  Planejamento
                </p>
                <div className="grid grid-cols-2 gap-1.5 sm:gap-2">
                  {contextOptions.map((context) => {
                    const active = selectedContext === context.type;
                    const isCiclo = context.type === 'ciclo';
                    const label = context.label || (isCiclo ? 'Ciclo' : 'Cronograma');
                    const title = isCiclo ? 'Ciclo' : 'Cronograma';
                    return (
                      <button
                        key={context.type}
                        type="button"
                        onClick={() => setSelectedContext(context.type)}
                        className={`group relative flex items-center gap-2 sm:gap-3 rounded-xl sm:rounded-2xl p-2 sm:p-2.5 text-left border transition-all duration-300 overflow-hidden hover:-translate-y-0.5 ${
                          active
                            ? isCiclo
                              ? 'border-red-500 bg-white/80 dark:bg-[#1f1f1f] shadow-lg shadow-red-500/10'
                              : 'border-red-500/40 dark:border-red-500/30 bg-white/80 dark:bg-[#1f1f1f] shadow-lg shadow-red-500/10'
                            : 'border-white/70 dark:border-zinc-700 bg-white/70 dark:bg-[#141414] hover:border-red-300 dark:hover:border-red-500/40'
                        }`}
                      >
                        <ContextLogo type={context.type} active={active} logoUrl={context.logoUrl || context.logo || context.editalLogoUrl} />
                        <div className="min-w-0 flex-1">
                          <span className={`block text-[9px] font-black uppercase tracking-[0.2em] ${active ? 'text-red-500' : 'text-zinc-400'}`}>
                            {title}
                          </span>
                          <span className={`block truncate text-xs font-black mt-0.5 ${active ? 'text-zinc-900 dark:text-white' : 'text-zinc-600 dark:text-zinc-300'}`}>
                            {label}
                          </span>
                        </div>
                        {active && (
                          <div className="absolute top-2.5 right-2.5 text-red-500">
                            <CheckCircle2 size={15} strokeWidth={2.5} />
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ── SEÇÃO: DISCIPLINA, DATA E TIPO ── */}
            <div className="registro-modal-form-section relative z-[90] p-3 md:p-2.5">
              <div className="mb-3 md:mb-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                   <p className="registro-section-kicker">
                    Modo da Sessão
                  </p>
                  <div className="inline-flex w-full items-center gap-1 rounded-2xl border border-red-500/25 bg-red-500/10 p-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.18),0_8px_20px_rgba(239,68,68,0.08)] sm:w-auto">
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
                              setNaoConcluidoCronograma(false);
                              setRevisaoEscolhida('skip');
                            } else {
                              setRevisaoEscolhida(getRevisaoEscolhidaPlaceholder(selectedContext, revisaoModoCiclo));
                            }
                          }}
                          className={`flex-1 md:flex-none flex items-center justify-center gap-1.5 rounded-xl px-3.5 py-1.5 text-[11px] font-black transition-all duration-300 ${
                            active
                              ? 'bg-red-600 text-white shadow-lg shadow-red-500/25'
                              : 'text-red-700 dark:text-red-300 hover:bg-red-500/10 hover:text-red-800 dark:hover:text-red-200'
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
                <div className="space-y-1 md:space-y-0.5">
                  <label className="registro-small-label text-[9px] uppercase tracking-[0.2em] flex items-center gap-1.5">
                    <BookOpen size={11} className="text-zinc-400" /> Disciplina
                  </label>
                  <div className="relative z-50">
                    <CustomSelect
                      name="disciplinaId"
                      options={disciplinaOptions}
                      value={formData.disciplinaId}
                      onChange={handleChange}
                      placeholder="Selecione a matéria..."
                      icon={BookOpen}
                      disabled={!selectedContext}
                      allowCreate
                      createLabel="Criar disciplina"
                      onCreate={handleCreateDisciplina}
                    />
                  </div>
                </div>

                <div className="space-y-1 md:space-y-0.5">
                  <label className="registro-small-label text-[9px] uppercase tracking-[0.2em] flex items-center gap-1.5">
                    <CalendarIcon size={11} className="text-zinc-400" /> Data do Estudo
                  </label>
                  <div className="relative z-40">
                    <CustomDatePicker name="data" value={formData.data} onChange={handleChange} />
                  </div>
                </div>
              </div>
            </div>

            {/* ── SEÇÃO: ASSUNTO E REVISÃO ── */}
            {formData.disciplinaId && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                className="registro-modal-form-section p-3 md:p-2.5 space-y-3 md:space-y-2 relative z-[80]"
              >
                <div className="space-y-1 md:space-y-0.5">
                  <label className="registro-small-label text-[9px] uppercase tracking-[0.2em] flex items-center justify-between">
                    <span className="flex items-center gap-1.5"><Target size={11} className="text-zinc-400" /> O que você estudou?</span>
                    {loadingAssuntos && <span className="text-red-500 text-[9px] animate-pulse font-black tracking-widest uppercase">carregando...</span>}
                  </label>
                  <CustomSelect
                    name="assunto"
                    options={assuntoOptions}
                    value={selectedAssuntoNome}
                    onChange={(e) => setSelectedAssuntoNome(e.target.value)}
                    placeholder="Selecione o assunto..."
                    icon={Target}
                    disabled={loadingAssuntos}
                    loading={loadingAssuntos}
                    allowCreate
                    createLabel="Criar assunto"
                    onCreate={handleCreateAssunto}
                  />
                </div>

                {/* ── REVISÃO ── */}
                {formData.tipoRegistro !== 'revisao' && selectedAssuntoNome && (
                  <div className={`grid grid-cols-1 gap-3 md:gap-2 pt-3 md:pt-2 border-t border-zinc-200 dark:border-[#333] ${selectedContext === 'ciclo' ? 'lg:grid-cols-2' : ''}`}>
                    {selectedContext === 'ciclo' && (
                      <div className="space-y-2 relative z-20">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="registro-small-label text-[9px] uppercase tracking-[0.18em] flex items-center gap-1.5">
                              <RotateCcw size={11} /> Agendar Revisão
                            </p>
                            <p className="text-[9px] font-semibold text-zinc-400 dark:text-zinc-500 mt-0.5 leading-snug">
                              {isAutoRevisao
                                ? 'Revisões automáticas ativas.'
                                : 'Escolha quando revisar.'}
                            </p>
                          </div>
                          {isAutoRevisao && (
                            <span className="text-[8px] font-black uppercase tracking-widest bg-emerald-500/10 text-emerald-600 px-2 py-0.5 rounded-[6px]">
                              Smart
                            </span>
                          )}
                        </div>

                        <div className="flex flex-wrap gap-1.5">
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

                    {/* ── MARCAR COMO CONCLUÍDO (Design Verde Bonito) ── */}
                    <div className={`grid gap-2 ${selectedContext === 'cronograma' ? 'grid-cols-2' : 'grid-cols-1'} items-end`}>
                      <button
                        type="button"
                        onClick={() => {
                          const next = !markAsFinished;
                          setMarkAsFinished(next);
                          if (next) setNaoConcluidoCronograma(false);
                        }}
                        className={`relative w-full min-h-[52px] md:min-h-[46px] overflow-hidden flex items-center gap-3 px-3.5 py-2.5 md:py-2 rounded-xl border transition-all duration-300 text-left ${
                          markAsFinished
                            ? 'bg-gradient-to-r from-emerald-600 to-teal-500 border-emerald-400 text-white shadow-lg shadow-emerald-600/25'
                            : 'bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-950/40 dark:to-teal-950/25 border-emerald-200 dark:border-emerald-800/60 hover:border-emerald-400 dark:hover:border-emerald-500 text-zinc-700 dark:text-zinc-300 hover:shadow-md hover:shadow-emerald-500/10'
                        }`}
                      >
                        <span className="pointer-events-none absolute inset-y-0 right-0 w-16 bg-white/20 blur-2xl" />
                        <div className={`relative w-7 h-7 md:h-6 md:w-6 rounded-lg border-2 flex items-center justify-center shrink-0 transition-all duration-300 ${
                          markAsFinished
                            ? 'bg-white border-white text-emerald-600 scale-105 shadow-sm'
                            : 'bg-white/70 dark:bg-zinc-950/70 border-emerald-400 dark:border-emerald-600 text-emerald-500'
                        }`}>
                          {checkingFinishedStatus
                            ? <div className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
                            : markAsFinished ? <CheckSquare size={15} strokeWidth={3} /> : <CheckCircle2 size={15} strokeWidth={3} />
                          }
                        </div>
                        <div className="relative min-w-0">
                          <p className={`text-[10px] font-black uppercase tracking-tight leading-tight ${markAsFinished ? 'text-white' : 'text-emerald-700 dark:text-emerald-300'}`}>
                            Marcar tópico como concluído
                          </p>
                        </div>
                      </button>

                      {selectedContext === 'cronograma' && (
                        <div className="relative">
                          <button
                            type="button"
                            onClick={() => {
                              const next = !naoConcluidoCronograma;
                              setNaoConcluidoCronograma(next);
                              if (next) setMarkAsFinished(false);
                            }}
                            className={`w-full min-h-[52px] md:min-h-[46px] flex items-center gap-2.5 px-3 py-2.5 md:py-2 pr-9 rounded-xl border transition-all duration-300 text-left ${
                              naoConcluidoCronograma
                                ? 'bg-amber-500 border-amber-500 text-white shadow-md shadow-amber-500/20'
                                : 'bg-amber-50/50 dark:bg-amber-900/10 border-amber-200 dark:border-amber-800/50 hover:border-amber-400 dark:hover:border-amber-600 text-zinc-700 dark:text-zinc-300'
                            }`}
                          >
                            <div className={`w-5 h-5 rounded-[6px] border-2 flex items-center justify-center shrink-0 transition-all duration-300 ${
                              naoConcluidoCronograma
                                ? 'bg-white border-white text-amber-500 scale-105'
                                : 'border-amber-400 dark:border-amber-600 text-transparent'
                            }`}>
                              {naoConcluidoCronograma && <AlertTriangle size={12} strokeWidth={3} />}
                            </div>
                            <div className="min-w-0">
                              <p className={`text-[10px] font-black uppercase tracking-tight leading-tight ${naoConcluidoCronograma ? 'text-white' : 'text-amber-700 dark:text-amber-400'}`}>
                                {naoConcluidoCronograma ? 'Assunto Pendente' : 'Manter Pendente'}
                              </p>
                            </div>
                          </button>
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              setShowPendenciaInfo((prev) => !prev);
                            }}
                            className={`absolute right-2 top-2 flex h-5 w-5 items-center justify-center rounded-full border transition-colors ${
                              naoConcluidoCronograma
                                ? 'border-white/40 bg-white/15 text-white hover:bg-white/25'
                                : 'border-amber-300 bg-white/80 text-amber-700 hover:bg-amber-50 dark:border-amber-700 dark:bg-zinc-950/80 dark:text-amber-400'
                            }`}
                            aria-label="Explicar manter pendente"
                          >
                            <Info size={12} strokeWidth={2.5} />
                          </button>
                          {showPendenciaInfo && (
                            <div className="absolute right-0 top-[calc(100%+0.45rem)] z-[260] w-64 rounded-xl border border-amber-200 bg-white p-3 text-[11px] font-semibold leading-snug text-zinc-600 shadow-2xl shadow-zinc-950/10 dark:border-amber-800/60 dark:bg-zinc-950 dark:text-zinc-300">
                              Use quando você estudou, mas ainda não concluiu o assunto. Ele fica pendente no cronograma e volta em um próximo bloco de estudo.
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </motion.div>
            )}

            {/* ── SEÇÃO: TEMPO + QUESTÕES ── */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 relative z-0">

              {/* Tempo */}
              <div className="registro-modal-form-section p-3 md:p-2.5 space-y-2 md:space-y-1.5">
                <div className="flex items-center gap-2 mb-1">
                  <span className="registro-section-kicker">
                    Tempo de Estudo
                  </span>
                  {isTimeFromTimer && (
                    <span className="ml-auto text-[8px] font-black uppercase tracking-widest bg-zinc-200 dark:bg-[#333] text-zinc-800 dark:text-zinc-200 px-1.5 py-0.5 rounded-md">
                      Timer On
                    </span>
                  )}
                </div>
                <div className="flex gap-2">
                  <div className="flex-1 bg-white/90 dark:bg-white/5 border border-zinc-200 dark:border-white/10 rounded-xl px-2 py-1 md:py-0.5 flex flex-col items-center relative focus-within:border-red-400 dark:focus-within:border-red-500 transition-all shadow-inner">
                    <input
                      type="number"
                      name="horas"
                      value={formData.horas}
                      onChange={handleChange}
                      min="0"
                      disabled={isTimeFromTimer}
                    className="w-full text-center text-xl md:text-lg font-black bg-transparent outline-none text-zinc-900 dark:text-white disabled:opacity-50"
                    />
                    <span className="registro-small-label text-[8px] uppercase tracking-widest mt-0.5">Horas</span>
                    {!isTimeFromTimer && (
                      <div className="absolute right-1 top-0 bottom-0 flex flex-col justify-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button type="button" onClick={() => adjustValue('horas', 1)} className="p-0.5 text-zinc-400 hover:text-zinc-800 dark:hover:text-white"><ChevronUp size={14} /></button>
                        <button type="button" onClick={() => adjustValue('horas', -1)} className="p-0.5 text-zinc-400 hover:text-zinc-800 dark:hover:text-white"><ChevronDown size={14} /></button>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center text-zinc-400 font-black text-base pb-3">:</div>
                  <div className="flex-1 bg-white/90 dark:bg-white/5 border border-zinc-200 dark:border-white/10 rounded-xl px-2 py-1 md:py-0.5 flex flex-col items-center relative focus-within:border-red-400 dark:focus-within:border-red-500 transition-all shadow-inner">
                    <input
                      type="number"
                      name="minutos"
                      value={formData.minutos}
                      onChange={handleChange}
                      min="0"
                      max="59"
                      disabled={isTimeFromTimer}
                    className="w-full text-center text-xl md:text-lg font-black bg-transparent outline-none text-zinc-900 dark:text-white disabled:opacity-50"
                    />
                    <span className="registro-small-label text-[8px] uppercase tracking-widest mt-0.5">Minutos</span>
                    {!isTimeFromTimer && (
                      <div className="absolute right-1 top-0 bottom-0 flex flex-col justify-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button type="button" onClick={() => adjustValue('minutos', 5)} className="p-0.5 text-zinc-400 hover:text-zinc-800 dark:hover:text-white"><ChevronUp size={14} /></button>
                        <button type="button" onClick={() => adjustValue('minutos', -5)} className="p-0.5 text-zinc-400 hover:text-zinc-800 dark:hover:text-white"><ChevronDown size={14} /></button>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Questões */}
              <div className={`registro-modal-form-section p-3 md:p-2.5 space-y-2 md:space-y-1.5 transition-all duration-500 ${hasAcertosError ? '!border-red-500 !bg-red-50/50 dark:!bg-red-900/10' : ''}`}>
                <div className="flex items-center justify-between mb-1">
                  <span className={`registro-section-kicker ${hasAcertosError ? '!text-red-500' : ''}`}>
                    Questões
                  </span>
                  {hasQuestionPerformance && (
                    <span className={`text-[8px] font-black px-1.5 py-0.5 rounded-md uppercase tracking-widest border ${percentageTone}`}>
                      {percentage}% Precisão
                    </span>
                  )}
                </div>

                <div className="flex gap-2">
                  <div className="flex-1 text-center">
                    <label className={`registro-small-label text-[8px] uppercase tracking-widest block mb-1 ${hasAcertosError ? '!text-red-500' : ''}`}>Resolvidas</label>
                    <input
                      type="number"
                      name="questoesFeitas"
                      value={formData.questoesFeitas}
                      onChange={handleChange}
                      min="0"
                      className={`w-full border rounded-xl py-1 md:py-0.5 px-2 text-center font-black text-xl md:text-lg outline-none transition-all duration-300 shadow-inner ${
                        hasAcertosError
                          ? 'bg-white dark:bg-[#2A2A2A] border-red-500 text-red-600'
                          : 'bg-white dark:bg-[#2A2A2A] border-zinc-200 dark:border-[#444] text-zinc-900 dark:text-white focus:border-zinc-400 dark:focus:border-zinc-500'
                      }`}
                    />
                  </div>
                  <div className="flex items-center text-zinc-400 font-black text-base pb-1">/</div>
                  <div className="flex-1 text-center">
                    <label className={`registro-small-label text-[8px] uppercase tracking-widest block mb-1 ${hasAcertosError ? '!text-red-500' : ''}`}>Acertos</label>
                    <input
                      type="number"
                      name="acertos"
                      value={formData.acertos}
                      onChange={handleChange}
                      min="0"
                      className={`w-full border rounded-xl py-1 md:py-0.5 px-2 text-center font-black text-xl md:text-lg outline-none transition-all duration-300 shadow-inner ${
                        hasAcertosError
                          ? 'bg-white dark:bg-[#2A2A2A] border-red-500 text-red-600'
                          : 'bg-white dark:bg-[#2A2A2A] border-zinc-200 dark:border-[#444] text-zinc-900 dark:text-white focus:border-zinc-400 dark:focus:border-zinc-500'
                      }`}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* ── FILA LATERAL ── */}
          {queue.length > 0 && (
            <div className="w-full lg:w-80 bg-[#dedee1]/95 dark:bg-[#080808] border-t lg:border-t-0 lg:border-l border-zinc-300/80 dark:border-zinc-800 p-4 flex flex-col shrink-0 overflow-hidden h-40 lg:h-auto backdrop-blur">
              <div className="flex items-center justify-between mb-4">
                <h4 className="registro-section-kicker">
                  Sessões ({queue.length})
                </h4>
                <div className="lg:hidden flex items-center gap-2">
                   <span className="text-[9px] font-black text-zinc-900 dark:text-white bg-zinc-200 dark:bg-[#2A2A2A] px-1.5 py-0.5 rounded-md">
                    {Math.floor(summary.time / 60)}h {summary.time % 60}m
                  </span>
                </div>
              </div>

              <div className="flex-1 overflow-hidden">
                <div className="flex lg:flex-col gap-2 overflow-x-auto lg:overflow-y-auto custom-scrollbar pr-1 pb-2 lg:pb-0">
                  <AnimatePresence>
                    {queue.map((item) => (
                      <motion.div
                        key={item.id}
                        layout
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        className={`bg-[#ededee] dark:bg-[#171717] border rounded-2xl p-3 relative group transition-all duration-300 shadow-[0_10px_28px_rgba(239,68,68,0.08)] hover:-translate-y-0.5 hover:shadow-[0_16px_36px_rgba(239,68,68,0.16)] ${
                          editingQueueId === item.id
                            ? 'border-red-500'
                            : 'border-zinc-300/80 dark:border-zinc-700/80'
                        } min-w-[200px] lg:min-w-0`}
                      >
                        <div className="pr-7">
                          <h5 className="text-[11px] font-black tracking-tight text-zinc-900 dark:text-white line-clamp-1">{item.disciplinaNome}</h5>
                          <p className="text-[9px] font-semibold text-zinc-500 dark:text-zinc-400 line-clamp-1 mt-0.5">{item.assunto}</p>
                          <div className="flex flex-wrap gap-1.5 mt-2">
                            {item.tempoTotal > 0 && (
                              <span className="text-[8px] font-black uppercase tracking-widest text-zinc-700 dark:text-zinc-300 bg-zinc-100 dark:bg-[#2A2A2A] px-1.5 py-0.5 rounded-md flex items-center gap-1">
                                <Clock size={8} /> {Math.floor(item.tempoTotal / 60)}h {item.tempoTotal % 60}m
                              </span>
                            )}
                            {item.questoesFeitas > 0 && (
                              <span className="text-[8px] font-black uppercase tracking-widest text-zinc-700 dark:text-zinc-300 bg-zinc-100 dark:bg-[#2A2A2A] px-1.5 py-0.5 rounded-md flex items-center gap-1">
                                <Target size={8} /> {item.acertos}/{item.questoesFeitas}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="absolute right-1 top-2 flex flex-col gap-0.5 opacity-0 group-hover:opacity-100 transition-all duration-300 translate-x-2 group-hover:translate-x-0">
                          <button onClick={() => handleEditQueueItem(item)} className="p-1 text-zinc-400 hover:text-zinc-800 dark:hover:text-white rounded-md transition-all">
                            <Edit3 size={12} />
                          </button>
                          <button onClick={() => removeFromQueue(item.id)} className="p-1 text-zinc-400 hover:text-red-600 rounded-md transition-all">
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
              </div>

              <div className="hidden lg:block mt-4 pt-4 border-t border-zinc-200 dark:border-[#2A2A2A] space-y-2">
                <div className="flex justify-between items-center text-[9px] font-black uppercase tracking-widest text-zinc-500">
                  <span>Tempo total</span>
                  <span className="text-zinc-900 dark:text-white bg-zinc-200 dark:bg-[#2A2A2A] px-1.5 py-0.5 rounded-md">
                    {Math.floor(summary.time / 60)}h {summary.time % 60}m
                  </span>
                </div>
                <div className="flex justify-between items-center text-[9px] font-black uppercase tracking-widest text-zinc-500">
                  <span>Questões</span>
                  <span className="text-zinc-900 dark:text-white bg-zinc-200 dark:bg-[#2A2A2A] px-1.5 py-0.5 rounded-md">
                    {summary.questions}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ── FOOTER ── */}
        <div className={`${FOOTER_PADDING_MOBILE} ${FOOTER_PADDING_DESKTOP} bg-[#dedee1]/96 dark:bg-[#080808]/96 border-t border-zinc-300/80 dark:border-zinc-800 shrink-0 relative z-50 flex items-center gap-3`}>
          {/* Adicionar outro */}
          <button
            type="button"
            onClick={handleAddToQueue}
            disabled={hasAcertosError || !formData.disciplinaId}
            className={`flex-1 py-3 md:py-2.5 px-3 rounded-2xl border text-[11px] font-bold uppercase tracking-wide transition-all flex items-center justify-center gap-1.5 ${
              hasAcertosError || !formData.disciplinaId
                ? 'border-zinc-200 dark:border-white/10 text-zinc-400 dark:text-zinc-600 cursor-not-allowed'
                : 'border-zinc-300 dark:border-white/10 bg-zinc-50 dark:bg-white/5 text-zinc-700 dark:text-zinc-300 hover:-translate-y-0.5 hover:border-zinc-800 dark:hover:border-zinc-200 hover:text-zinc-900 dark:hover:text-white hover:shadow-lg'
            }`}
          >
            {editingQueueId ? <><Save size={14} /> Atualizar</> : <><Plus size={14} /> Adicionar à Fila</>}
          </button>

          {/* Salvar */}
          <button
            onClick={handleSaveAll}
            disabled={loading || (queue.length === 0 && hasAcertosError && !formData.disciplinaId)}
            className={`flex-1 overflow-hidden px-4 py-3 md:py-2.5 rounded-2xl text-[11px] font-bold uppercase tracking-wide text-white transition-all flex items-center justify-center gap-1.5 shadow-lg ${
              loading
                ? 'bg-zinc-600 cursor-not-allowed'
                : 'bg-red-600 hover:bg-red-700 hover:-translate-y-0.5 hover:shadow-red-500/25'
            }`}
          >
            <div className="relative z-10 flex items-center justify-center gap-1.5">
              {loading
                ? <SaveButtonLoading />
                : <><Save size={14} /> {queue.length > 0 ? `Gravar Sessões (${queue.length})` : 'Gravar Sessão'}</>
              }
            </div>
          </button>
        </div>
      </motion.div>
    </div>
  );
}

export default RegistroEstudoModal;
