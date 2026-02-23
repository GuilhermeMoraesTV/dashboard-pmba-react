import React, { useState, useEffect, useMemo, useRef } from 'react';
import { serverTimestamp, doc, getDoc, addDoc, collection, query, where, getDocs, writeBatch } from 'firebase/firestore';
import { db } from '../../firebaseConfig';
import {
  X, Save, Clock, Target, AlertTriangle, ChevronDown, CheckSquare,
  Calendar as CalendarIcon, ChevronUp, CheckCircle2, BookOpen, ChevronLeft, ChevronRight, AlertCircle,
  Plus, Layers, Trash2, Edit3, LogOut
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// --- IMPORTAÇÃO DA GAMIFICAÇÃO ---
import { useLevelSystem } from '../../hooks/useLevelSystem';

// --- ESTILOS CSS ---
const globalStyles = `
  .custom-scrollbar::-webkit-scrollbar { width: 5px; height: 5px; }
  .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
  .custom-scrollbar::-webkit-scrollbar-thumb { background: #e4e4e7; border-radius: 10px; }
  .dark .custom-scrollbar::-webkit-scrollbar-thumb { background: #3f3f46; }

  input[type=number]::-webkit-inner-spin-button,
  input[type=number]::-webkit-outer-spin-button { -webkit-appearance: none; margin: 0; }
`;

// =======================================================
// 🔧 AJUSTES DE TAMANHO (edite aqui para aumentar/diminuir)
// =======================================================
// (Modal)
const MODAL_MAX_W_PX = 860;            // <-- largura máxima do modal (px)
const MODAL_COLLAPSED_MAX_H_PX = 570;  // <-- altura máxima "compacta" (px)
const MODAL_EXPANDED_MAX_H_PX = 860;   // <-- altura máxima "expandida" (px)

// (Fila)
const QUEUE_MOBILE_H_PX = 160;         // <-- altura da fila no mobile (px)
const QUEUE_CARD_MIN_W_MOBILE = 220;   // <-- min width do card da fila no mobile (px)

// (Date card)
const DATE_MONTH_TEXT_CLASS = 'text-[10px]'; // <-- tamanho do mês no card de data
const DATE_DAY_TEXT_CLASS = 'text-base';     // <-- tamanho do dia no card de data

// (Botões no footer)
const FOOTER_PADDING_MOBILE = 'p-4';     // <-- padding do footer no mobile
const FOOTER_PADDING_DESKTOP = 'md:p-6'; // <-- padding do footer no desktop
// =======================================================

// --- FUNÇÕES AUXILIARES ---
const getLocalDateString = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const parseDateLocal = (dateString) => {
  if (!dateString) return new Date();
  const [year, month, day] = dateString.split('-').map(Number);
  return new Date(year, month - 1, day, 12, 0, 0);
};

// --- SUB-COMPONENTES ---

// 1. Modal de Confirmação ao Sair
const ConfirmCloseModal = ({ isOpen, onConfirm, onCancel }) => {
  if (!isOpen) return null;
  return (
    <div
      className="absolute inset-0 z-[60] bg-black/50 backdrop-blur-sm flex items-center justify-center p-6 rounded-[32px]"
      onClick={(e) => e.stopPropagation()}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        // 🔧 tamanho do modal de confirmação: max-w-xs / p-6 / rounded-2xl
        className="bg-white dark:bg-zinc-900 p-6 rounded-2xl shadow-2xl border border-zinc-200 dark:border-zinc-800 w-full max-w-xs text-center"
      >
        <div className="w-12 h-12 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center mx-auto mb-3">
          <LogOut size={24} />
        </div>
        <h3 className="text-lg font-bold text-zinc-900 dark:text-white mb-2">Sair sem salvar?</h3>
        <p className="text-xs text-zinc-500 mb-6">Você tem dados não salvos. Eles serão perdidos.</p>
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 py-2.5 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 font-bold text-xs hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
          >
            Voltar
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 py-2.5 rounded-xl bg-red-600 text-white font-bold text-xs hover:bg-red-700 transition-colors"
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
      <h4 className="text-sm font-black text-zinc-800 dark:text-white">Estudo Registrado!</h4>
      <p className="text-xs text-zinc-500 dark:text-zinc-400 font-medium">Seus estudos foram salvos com sucesso.</p>
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
        // 🔧 altura do select: py-3 / rounded-xl / pl-3 pr-8
        className={`w-full pl-3 pr-8 py-3 bg-zinc-50 dark:bg-zinc-900 border ${isOpen ? 'border-red-500 ring-1 ring-red-500/20' : 'border-zinc-200 dark:border-zinc-800'} rounded-xl flex items-center justify-between cursor-pointer transition-all shadow-sm ${disabled ? 'opacity-60 cursor-not-allowed' : 'hover:border-red-300 dark:hover:border-red-900'}`}
      >
        <span className={`text-xs md:text-sm font-bold truncate ${selectedOption ? 'text-zinc-800 dark:text-white' : 'text-zinc-400'}`}>
          {selectedOption ? selectedOption.label : (loading ? "Carregando..." : placeholder)}
        </span>
        <div className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none">
          {loading ? <div className="animate-spin h-4 w-4 border-2 border-red-500 border-t-transparent rounded-full" /> : (Icon ? <Icon size={16} /> : <ChevronDown size={16} />)}
        </div>
      </div>

      <AnimatePresence>
        {isOpen && !disabled && (
          <motion.div
            initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -5 }}
            // 🔧 altura do dropdown: max-h-60
            className="absolute z-[60] w-full mt-1 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-xl max-h-60 overflow-y-auto custom-scrollbar"
          >
            <div className="p-1">
              {options.length > 0 ? (
                options.map((opt) => (
                  <div
                    key={opt.value} onClick={() => handleSelect(opt.value)}
                    className={`px-3 py-2.5 rounded-lg text-xs md:text-sm cursor-pointer transition-colors flex items-center justify-between ${value === opt.value ? 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 font-bold' : 'text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800'}`}
                  >
                    {opt.label}
                    {value === opt.value && <CheckCircle2 size={14} />}
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
  const weekDisplay = dateObj.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '');

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
    const dateStr = `${year}-${month}-${d}`;
    onChange({ target: { name, value: dateStr } });
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
          onClick={(e) => { e.preventDefault(); handleSelectDay(i); }}
          className={`w-8 h-8 rounded-full text-xs font-bold flex items-center justify-center transition-all ${isSelected ? 'bg-red-600 text-white shadow-md' : 'text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800'}`}
        >
          {i}
        </button>
      );
    }
    return slots;
  };

  return (
    <div className="relative" ref={containerRef}>
      <div onClick={() => setIsOpen(!isOpen)} className="relative group cursor-pointer h-[46px]">
        <div className={`flex h-full bg-zinc-50 dark:bg-zinc-900 border ${isOpen ? 'border-red-500' : 'border-zinc-200 dark:border-zinc-800'} rounded-xl overflow-hidden shadow-sm group-hover:border-red-300 dark:group-hover:border-red-900/50 transition-all`}>
          {/* 🔧 largura do card de data: w-12 */}
          <div className="bg-zinc-100 dark:bg-zinc-800 w-12 flex flex-col items-center justify-center border-r border-zinc-200 dark:border-zinc-700">
            <span className={`${DATE_MONTH_TEXT_CLASS} font-bold uppercase text-red-600`}>{monthDisplay}</span>
            <span className={`${DATE_DAY_TEXT_CLASS} font-black leading-none text-zinc-800 dark:text-white`}>{dayDisplay}</span>
          </div>

          {/* 🔧 padding do lado direito do card: px-3 */}
          <div className="flex-1 px-3 flex items-center justify-between">
            <span className="text-xs font-bold text-zinc-600 dark:text-zinc-300 capitalize">{weekDisplay}</span>
            <CalendarIcon size={16} className="text-zinc-300 group-hover:text-red-500 transition-colors" />
          </div>
        </div>
      </div>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }}
            // 🔧 popup do calendário: w-[260px] / p-4
            className="absolute left-0 top-full mt-2 z-[60] bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-xl p-4 w-[260px]"
          >
            <div className="flex justify-between items-center mb-3">
              <button onClick={(e) => { e.preventDefault(); changeMonth(-1) }} className="p-1 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded text-zinc-500">
                <ChevronLeft size={16} />
              </button>
              <span className="text-xs font-bold text-zinc-800 dark:text-white capitalize">
                {viewDate.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}
              </span>
              <button onClick={(e) => { e.preventDefault(); changeMonth(1) }} className="p-1 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded text-zinc-500">
                <ChevronRight size={16} />
              </button>
            </div>

            <div className="grid grid-cols-7 gap-1 place-items-center">
              {['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].map(d => <span key={d} className="text-[9px] font-bold text-zinc-400">{d}</span>)}
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
      {/* 🔧 tamanho do spinner: w/h e border-2 */}
      <motion.div
        className="absolute inset-0 rounded-full border-2 border-white/35"
        animate={{ opacity: [0.35, 0.6, 0.35] }}
        transition={{ duration: 1.2, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute inset-0 rounded-full border-2 border-white border-t-transparent"
        animate={{ rotate: 360 }}
        transition={{ duration: 0.85, repeat: Infinity, ease: "linear" }}
      />
    </div>

    <div className="flex items-center">
      <span className="text-xs font-black uppercase tracking-wide">Salvando</span>
      <motion.span
        className="ml-1 text-xs font-black"
        animate={{ opacity: [0.2, 1, 0.2] }}
        transition={{ duration: 0.9, repeat: Infinity, ease: "easeInOut" }}
      >
        ...
      </motion.span>
    </div>
  </div>
);

// --- MODAL PRINCIPAL ---
function RegistroEstudoModal({ onClose, addRegistroEstudo, cicloId, userId, disciplinasDoCiclo, initialData }) {
  const { addXP, checkAndAwardMilestone } = useLevelSystem({ uid: userId });

  // --- ESTADO DE ALTURA DA JANELA (PARA EVITAR CORTE NA BARRA DE NAVEGAÇÃO) ---
  const [viewportHeight, setViewportHeight] = useState(window.innerHeight);

  useEffect(() => {
    // 1. Atualiza altura ao redimensionar (barra aparece/some)
    const handleResize = () => setViewportHeight(window.innerHeight);
    window.addEventListener('resize', handleResize);

    // 2. Trava SCROLL GLOBAL (Body) - Opção Nuclear para Tablets
    const scrollY = window.scrollY; // Guarda posição
    document.body.style.position = 'fixed';
    document.body.style.top = `-${scrollY}px`;
    document.body.style.width = '100%';
    document.body.style.overflow = 'hidden';

    return () => {
      window.removeEventListener('resize', handleResize);
      // Restaura Scroll
      document.body.style.position = '';
      document.body.style.top = '';
      document.body.style.width = '';
      document.body.style.overflow = '';
      window.scrollTo(0, scrollY);
    };
  }, []);

  const minutesToHoursMinutes = (totalMinutes) => {
    if (!totalMinutes || totalMinutes <= 0) return { horas: 0, minutos: 0 };
    const h = Math.floor(totalMinutes / 60);
    const m = totalMinutes % 60;
    return { horas: h, minutos: m };
  };

  const initialTime = minutesToHoursMinutes(initialData?.tempoEstudadoMinutos);

  const [queue, setQueue] = useState([]);
  const [editingQueueId, setEditingQueueId] = useState(null);
  const [showCloseConfirm, setShowCloseConfirm] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  // ✅ cresce só depois que adiciona na fila
  const [expanded, setExpanded] = useState(false);

  const [formData, setFormData] = useState({
    disciplinaId: initialData?.disciplinaId || '',
    data: initialData?.data || getLocalDateString(),
    horas: initialTime.horas,
    minutos: initialTime.minutos,
    questoesFeitas: initialData?.questoesFeitas || 0,
    acertos: initialData?.acertos || 0,
    tipoEstudo: 'Teoria',
  });

  const [assuntosDisponiveis, setAssuntosDisponiveis] = useState([]);
  const [selectedAssuntoNome, setSelectedAssuntoNome] = useState('');
  const [loadingAssuntos, setLoadingAssuntos] = useState(false);
  const [markAsFinished, setMarkAsFinished] = useState(false);
  const [checkingFinishedStatus, setCheckingFinishedStatus] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

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
  const disciplinasAtivas = useMemo(
    () => (disciplinasDoCiclo || []).filter(d => d && d.inCiclo !== false),
    [disciplinasDoCiclo]
  );

  useEffect(() => {
    if (queue.length === 0) setExpanded(false);
  }, [queue.length]);

  useEffect(() => {
    const fetchAssuntos = async () => {
      if (!formData.disciplinaId || !cicloId || !userId) {
        setAssuntosDisponiveis([]);
        return;
      }
      const disciplinaLocal = disciplinasAtivas.find(d => d.id === formData.disciplinaId);
      const normalizeAssuntos = (arr) => {
        const list = Array.isArray(arr) ? arr : [];
        return list
          .map(a => (typeof a === 'string' ? { nome: a, inCiclo: true } : { ...a, nome: (a?.nome || '').trim(), inCiclo: a?.inCiclo !== false }))
          .filter(a => a.nome && a.inCiclo !== false);
      };

      if (disciplinaLocal && Array.isArray(disciplinaLocal.assuntos)) {
        setAssuntosDisponiveis(normalizeAssuntos(disciplinaLocal.assuntos));
        return;
      }

      setLoadingAssuntos(true);
      try {
        const docRef = doc(db, 'users', userId, 'ciclos', cicloId, 'disciplinas', formData.disciplinaId);
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
    if (!editingQueueId) {
      setSelectedAssuntoNome('');
      setMarkAsFinished(false);
    }
  }, [formData.disciplinaId, cicloId, userId, disciplinasAtivas, editingQueueId]);

  useEffect(() => {
    if (editingQueueId) return;
    const checkTopic = async () => {
      if (!selectedAssuntoNome || !cicloId || !userId || !formData.disciplinaId) {
        setMarkAsFinished(false);
        return;
      }
      setCheckingFinishedStatus(true);
      try {
        const q = query(
          collection(db, 'users', userId, 'registrosEstudo'),
          where('cicloId', '==', cicloId),
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
  }, [selectedAssuntoNome, cicloId, userId, formData.disciplinaId, editingQueueId]);

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
    if (hasAcertosError) {
      setErrorMessage('Acertos não pode ser maior que questões.');
      return false;
    }
    const totalMin = (Number(formData.horas || 0) * 60) + Number(formData.minutos || 0);
    if (!formData.disciplinaId || !formData.data || (totalMin <= 0 && formData.questoesFeitas <= 0)) {
      setErrorMessage('Preencha os campos obrigatórios.');
      return false;
    }
    if (!selectedAssuntoNome) {
      setErrorMessage('Selecione um assunto.');
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
      disciplinaNome: discNome,
      assunto: selectedAssuntoNome,
      tempoTotal: totalMin,
      markAsFinished,
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
      tipoEstudo: item.tipoEstudo
    });
    setTimeout(() => {
      setSelectedAssuntoNome(item.assunto);
      setMarkAsFinished(item.markAsFinished);
    }, 100);
  };

  const removeFromQueue = (id) => {
    setQueue(queue.filter(item => item.id !== id));
    if (editingQueueId === id) {
      setEditingQueueId(null);
      setFormData(prev => ({ ...prev, disciplinaId: '', horas: 0, minutos: 0, questoesFeitas: 0, acertos: 0 }));
      setSelectedAssuntoNome('');
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
        itemsToSave.push({ ...formData, disciplinaNome: discNome, assunto: selectedAssuntoNome, tempoTotal: totalMin, markAsFinished });
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
          cicloId, disciplinaId: item.disciplinaId, disciplinaNome: item.disciplinaNome, assunto: item.assunto,
          data: item.data, timestamp: serverTimestamp(), tempoEstudadoMinutos: item.tempoTotal,
          questoesFeitas: Number(item.questoesFeitas), acertos: Number(item.acertos),
          tipoEstudo: item.tipoEstudo, duracaoMinutos: item.tempoTotal, questoesAcertadas: Number(item.acertos),
        });

        let itemXP = item.tempoTotal + Number(item.questoesFeitas) + Number(item.acertos);
        if (item.questoesFeitas >= 5 && (item.acertos / item.questoesFeitas) >= 0.85) itemXP += 15;
        totalXP += itemXP;

        if (item.markAsFinished) {
          const q = query(
            collection(db, 'users', userId, 'registrosEstudo'),
            where('cicloId', '==', cicloId),
            where('disciplinaId', '==', item.disciplinaId),
            where('assunto', '==', item.assunto),
            where('tipoEstudo', '==', 'check_manual')
          );
          const snap = await getDocs(q);
          if (snap.empty) {
            await addDoc(collection(db, 'users', userId, 'registrosEstudo'), {
              cicloId, disciplinaId: item.disciplinaId, disciplinaNome: item.disciplinaNome, assunto: item.assunto,
              data: item.data, timestamp: serverTimestamp(), tempoEstudadoMinutos: 0, questoesFeitas: 0, acertos: 0,
              tipoEstudo: 'check_manual', obs: 'Concluído via Registro Manual'
            });
          }
        }
      }

      if (totalXP > 0) await addXP(totalXP, "Sessão de Estudos");
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
  const assuntoOptions = assuntosDisponiveis.map(a => ({ value: typeof a === 'object' ? a.nome : a, label: typeof a === 'object' ? a.nome : a }));

  const summary = useMemo(() => {
    return queue.reduce((acc, curr) => ({ time: acc.time + curr.tempoTotal, questions: acc.questions + curr.questoesFeitas }), { time: 0, questions: 0 });
  }, [queue]);

  // CALCULO DINÂMICO DA ALTURA DO MODAL (Sem estourar tela)
  // Se estiver expandido, tenta usar MODAL_EXPANDED_MAX_H_PX
  // Se não, MODAL_COLLAPSED_MAX_H_PX
  // MAS SEMPRE respeitando viewportHeight - margens (ex: 40px)
  const targetHeight = expanded ? MODAL_EXPANDED_MAX_H_PX : MODAL_COLLAPSED_MAX_H_PX;
  const safeMaxHeight = viewportHeight - 40; // 20px margem cima + 20px baixo
  const finalHeight = Math.min(targetHeight, safeMaxHeight);

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-3 md:p-4 bg-zinc-950/80 backdrop-blur-md animate-fade-in" onClick={handleCloseRequest}>
      <style>{globalStyles}</style>

      <ConfirmCloseModal isOpen={showCloseConfirm} onCancel={() => setShowCloseConfirm(false)} onConfirm={() => { setShowCloseConfirm(false); onClose(); }} />
      <AnimatePresence>{showSuccess && <SuccessToast />}</AnimatePresence>

      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95 }}
        // 🔧 altura/largura dinâmica baseada no viewport real
        style={{
          height: finalHeight,
          maxHeight: finalHeight, // Garante que nunca passe do tamanho da tela
          width: '100%',
          maxWidth: `${MODAL_MAX_W_PX}px`,
        }}
        className="bg-white dark:bg-zinc-950 rounded-[32px] shadow-2xl border border-white/20 dark:border-zinc-800 overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex justify-between items-center px-6 py-5 border-b border-zinc-100 dark:border-zinc-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-red-600 text-white rounded-2xl flex items-center justify-center shadow-lg shadow-red-600/30">
              <Save size={24} />
            </div>
            <div>
              <h2 className="text-xl font-black text-zinc-900 dark:text-white leading-none">Novo Registro</h2>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 font-medium mt-0.5">
                {queue.length > 0 ? `${queue.length} item(s) na fila` : 'Adicione seus estudos'}
              </p>
            </div>
          </div>
          <button onClick={handleCloseRequest} className="p-2.5 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-500 dark:text-zinc-300 rounded-full transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="flex flex-1 overflow-hidden flex-col lg:flex-row">
          {/* Form */}
          <div className="flex-1 overflow-y-auto px-6 py-6 custom-scrollbar space-y-6">
            {errorMessage && (
              <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-900/50 rounded-xl text-red-600 dark:text-red-400 text-xs font-bold flex items-center gap-2 animate-pulse">
                <AlertTriangle size={16} /> {errorMessage}
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5 relative z-50">
                <label className="text-xs font-bold text-zinc-400 uppercase tracking-wide ml-1">Disciplina</label>
                <CustomSelect
                  name="disciplinaId"
                  options={disciplinaOptions}
                  value={formData.disciplinaId}
                  onChange={handleChange}
                  placeholder="Matéria..."
                  icon={BookOpen}
                />
              </div>
              <div className="space-y-1.5 relative z-40">
                <label className="text-xs font-bold text-zinc-400 uppercase tracking-wide ml-1">Data</label>
                <CustomDatePicker name="data" value={formData.data} onChange={handleChange} />
              </div>
            </div>

            {formData.disciplinaId && (
              <div className="space-y-4 animate-in slide-in-from-top-2 duration-300 relative z-30">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-zinc-400 uppercase tracking-wide ml-1 flex justify-between">
                    Assunto {loadingAssuntos && <span className="text-red-500 animate-pulse">...</span>}
                  </label>
                  <CustomSelect
                    name="assunto"
                    options={assuntoOptions}
                    value={selectedAssuntoNome}
                    onChange={(e) => setSelectedAssuntoNome(e.target.value)}
                    placeholder="O que estudou?"
                    icon={Target}
                    disabled={loadingAssuntos || assuntosDisponiveis.length === 0}
                    loading={loadingAssuntos}
                  />
                </div>

                {selectedAssuntoNome && (
                  <div
                    onClick={() => setMarkAsFinished(!markAsFinished)}
                    className={`p-3 rounded-xl border-2 cursor-pointer transition-all flex items-center gap-4 ${markAsFinished ? 'bg-emerald-50 dark:bg-emerald-900/10 border-emerald-500' : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 hover:border-emerald-300'}`}
                  >
                    <div className={`w-6 h-6 rounded-md border-2 flex items-center justify-center transition-colors ${markAsFinished ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-zinc-300 dark:border-zinc-600 text-transparent'}`}>
                      {checkingFinishedStatus ? <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"></div> : <CheckSquare size={14} strokeWidth={4} />}
                    </div>
                    <div>
                      <p className={`text-sm font-bold ${markAsFinished ? 'text-emerald-700 dark:text-emerald-400' : 'text-zinc-700 dark:text-zinc-300'}`}>
                        {markAsFinished ? 'Tópico Concluído' : 'Marcar como Concluído'}
                      </p>
                      <p className="text-xs text-zinc-500">
                        {markAsFinished ? 'Este assunto já está marcado como finalizado.' : 'Clique para marcar este tópico como finalizado.'}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="h-px bg-zinc-100 dark:bg-zinc-800 w-full relative z-0" />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 relative z-0">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-extrabold text-zinc-400 uppercase tracking-widest flex items-center gap-1.5">
                    <Clock size={14} className="text-amber-500" /> Tempo
                  </span>
                </div>

                <div className="flex gap-3">
                  <div className="flex-1 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-2 flex flex-col items-center relative group focus-within:border-amber-500">
                    <input
                      type="number"
                      name="horas"
                      value={formData.horas}
                      onChange={handleChange}
                      min="0"
                      disabled={isTimeFromTimer}
                      className="w-full text-center text-2xl font-black bg-transparent outline-none text-zinc-800 dark:text-white z-10 disabled:opacity-50"
                    />
                    <span className="text-[9px] font-bold text-zinc-400 uppercase">Hr</span>
                    {!isTimeFromTimer && (
                      <div className="absolute right-0 top-0 bottom-0 flex flex-col justify-center px-1 z-20">
                        <button type="button" onClick={() => adjustValue('horas', 1)} className="p-1 text-zinc-400 hover:text-amber-600 active:scale-90"><ChevronUp size={16} /></button>
                        <button type="button" onClick={() => adjustValue('horas', -1)} className="p-1 text-zinc-400 hover:text-amber-600 active:scale-90"><ChevronDown size={16} /></button>
                      </div>
                    )}
                  </div>

                  <div className="flex-1 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-2 flex flex-col items-center relative group focus-within:border-amber-500">
                    <input
                      type="number"
                      name="minutos"
                      value={formData.minutos}
                      onChange={handleChange}
                      min="0"
                      max="59"
                      disabled={isTimeFromTimer}
                      className="w-full text-center text-2xl font-black bg-transparent outline-none text-zinc-800 dark:text-white z-10 disabled:opacity-50"
                    />
                    <span className="text-[9px] font-bold text-zinc-400 uppercase">Min</span>
                    {!isTimeFromTimer && (
                      <div className="absolute right-0 top-0 bottom-0 flex flex-col justify-center px-1 z-20">
                        <button type="button" onClick={() => adjustValue('minutos', 5)} className="p-1 text-zinc-400 hover:text-amber-600 active:scale-90"><ChevronUp size={16} /></button>
                        <button type="button" onClick={() => adjustValue('minutos', -5)} className="p-1 text-zinc-400 hover:text-amber-600 active:scale-90"><ChevronDown size={16} /></button>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className={`bg-zinc-50 dark:bg-zinc-900/50 p-3 rounded-xl border transition-all duration-300 space-y-3 ${hasAcertosError ? 'border-rose-500 bg-rose-50 dark:bg-rose-900/10' : 'border-zinc-200 dark:border-zinc-800'}`}>
                <div className="flex items-center justify-between">
                  <span className={`text-xs font-extrabold uppercase tracking-widest flex items-center gap-1.5 ${hasAcertosError ? 'text-rose-600' : 'text-zinc-400'}`}>
                    {hasAcertosError ? <AlertCircle size={14} /> : <Target size={14} className="text-emerald-500" />} Questões
                  </span>
                  <span className={`text-[10px] font-bold ${hasAcertosError ? 'text-rose-600' : 'text-zinc-500'}`}>{hasAcertosError ? 'Erro' : `${percentage}% Aprov.`}</span>
                </div>

                <div className="flex gap-3">
                  <div className="flex-1 text-center">
                    <label className={`text-[9px] font-bold uppercase block mb-1 ${hasAcertosError ? 'text-rose-400' : 'text-zinc-400'}`}>Feitas</label>
                    <input
                      type="number"
                      name="questoesFeitas"
                      value={formData.questoesFeitas}
                      onChange={handleChange}
                      min="0"
                      className={`w-full border rounded-lg py-2 px-2 text-center font-bold text-lg outline-none transition-all ${hasAcertosError ? 'bg-white dark:bg-zinc-900 border-rose-300 text-rose-600' : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-700 focus:border-indigo-500'}`}
                    />
                  </div>
                  <div className="flex-1 text-center">
                    <label className={`text-[9px] font-bold uppercase block mb-1 ${hasAcertosError ? 'text-rose-600' : 'text-zinc-400'}`}>Acertos</label>
                    <input
                      type="number"
                      name="acertos"
                      value={formData.acertos}
                      onChange={handleChange}
                      min="0"
                      className={`w-full border rounded-lg py-2 px-2 text-center font-bold text-lg outline-none transition-all ${hasAcertosError ? 'bg-rose-100 border-rose-500 text-rose-700 ring-2 ring-rose-500/20' : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-700 text-emerald-600 focus:border-emerald-500'}`}
                    />
                  </div>
                </div>

                {hasAcertosError && <div className="text-[10px] text-rose-600 font-bold text-center animate-pulse">Excede o total de feitas</div>}
              </div>
            </div>
          </div>

          {/* --- FILA --- */}
          {queue.length > 0 && (
            <div
              /**
               * ✅ CORREÇÃO DO “PRETO” NO DESKTOP:
               * antes havia height inline que valia também no desktop.
               * agora a altura fixa é SOMENTE no mobile, via Tailwind:
               * h-[${QUEUE_MOBILE_H_PX}px] lg:h-auto
               */
              className={`w-full lg:w-80 bg-zinc-50 dark:bg-zinc-900/50 border-t lg:border-t-0 lg:border-l border-zinc-200 dark:border-zinc-800 p-3 lg:p-4 flex flex-col shrink-0 overflow-hidden h-[${QUEUE_MOBILE_H_PX}px] lg:h-auto`}
            >
              <div className="flex items-center justify-between mb-3 lg:mb-4">
                <h4 className="text-xs font-extrabold text-zinc-400 uppercase tracking-widest flex items-center gap-2">
                  <Layers size={14} /> Fila ({queue.length})
                </h4>

                <span className="lg:hidden text-[10px] font-bold text-zinc-500 dark:text-zinc-400">
                  {Math.floor(summary.time / 60)}h {summary.time % 60}m • {summary.questions}q
                </span>
              </div>

              <div className="flex-1 overflow-hidden">
                <div className="flex lg:flex-col gap-3 overflow-x-auto lg:overflow-y-auto custom-scrollbar pr-1 pb-1 lg:pb-0">
                  <AnimatePresence>
                    {queue.map((item) => (
                      <motion.div
                        key={item.id}
                        layout
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.9 }}
                        className={`bg-white dark:bg-zinc-900 border rounded-xl p-3 shadow-sm relative group ${editingQueueId === item.id ? 'border-amber-400 ring-1 ring-amber-400/30' : 'border-zinc-200 dark:border-zinc-800'} min-w-[${QUEUE_CARD_MIN_W_MOBILE}px] lg:min-w-0`}
                      >
                        <div className="pr-8">
                          <h5 className="text-xs font-bold text-zinc-800 dark:text-white line-clamp-1">{item.disciplinaNome}</h5>
                          <p className="text-[10px] text-zinc-500 dark:text-zinc-400 line-clamp-1 mt-0.5">{item.assunto}</p>
                          <div className="flex flex-wrap gap-2 mt-2">
                            {item.tempoTotal > 0 && (
                              <span className="text-[9px] font-bold text-amber-600 bg-amber-50 dark:bg-amber-900/20 px-1.5 py-0.5 rounded flex items-center gap-1">
                                <Clock size={10} /> {Math.floor(item.tempoTotal / 60)}h {item.tempoTotal % 60}m
                              </span>
                            )}
                            {item.questoesFeitas > 0 && (
                              <span className="text-[9px] font-bold text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20 px-1.5 py-0.5 rounded flex items-center gap-1">
                                <Target size={10} /> {item.acertos}/{item.questoesFeitas}
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="absolute right-2 top-2 flex flex-col gap-1">
                          <button onClick={() => handleEditQueueItem(item)} className="p-1.5 text-zinc-400 hover:text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-900/20 rounded-lg transition-colors">
                            <Edit3 size={14} />
                          </button>
                          <button onClick={() => removeFromQueue(item.id)} className="p-1.5 text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors">
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
              </div>

              {/* ✅ TOTAL VISÍVEL NO DESKTOP */}
              <div className="hidden lg:block mt-4 pt-3 border-t border-zinc-200 dark:border-zinc-800">
                <div className="flex justify-between items-center text-[10px] font-bold text-zinc-500 dark:text-zinc-400 mb-1">
                  <span>Total Tempo:</span>
                  <span className="text-zinc-800 dark:text-white">{Math.floor(summary.time / 60)}h {summary.time % 60}m</span>
                </div>
                <div className="flex justify-between items-center text-[10px] font-bold text-zinc-500 dark:text-zinc-400">
                  <span>Total Questões:</span>
                  <span className="text-zinc-800 dark:text-white">{summary.questions}</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer (3 botões sempre lado a lado) */}
        <div className={`${FOOTER_PADDING_MOBILE} ${FOOTER_PADDING_DESKTOP} bg-zinc-50 dark:bg-zinc-900 border-t border-zinc-200 dark:border-zinc-800 shrink-0 relative z-50 grid grid-cols-3 gap-2`}>
          <button
            type="button"
            onClick={handleAddToQueue}
            disabled={hasAcertosError || !formData.disciplinaId}
            className={`w-full py-2.5 px-3 rounded-xl border-2 border-dashed border-zinc-300 dark:border-zinc-700 text-zinc-500 dark:text-zinc-400 font-bold text-[10px] md:text-xs uppercase tracking-wide hover:border-red-500 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/10 transition-all flex items-center justify-center gap-2 ${hasAcertosError || !formData.disciplinaId ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            {editingQueueId ? <><Save size={16} /> Atualizar</> : <><Plus size={16} /> Adicionar outro registro</>}
          </button>

          <button
            type="button"
            onClick={handleCloseRequest}
            disabled={loading}
            className="w-full px-3 py-2.5 rounded-xl text-xs md:text-sm font-bold text-zinc-500 hover:bg-zinc-200 dark:hover:bg-zinc-800 transition-colors disabled:opacity-50"
          >
            Cancelar
          </button>

          <button
            onClick={handleSaveAll}
            disabled={loading || (queue.length === 0 && hasAcertosError && !formData.disciplinaId)}
            className={`w-full relative overflow-hidden px-4 py-2.5 rounded-xl text-xs md:text-sm font-bold uppercase tracking-wide text-white shadow-lg transition-all flex items-center justify-center gap-2 ${loading ? 'bg-zinc-400 cursor-not-allowed' : 'bg-red-600 hover:bg-red-700 shadow-red-600/30 hover:shadow-red-600/40 hover:-translate-y-0.5 active:translate-y-0'}`}
          >
            {loading && (
              <motion.div aria-hidden className="absolute inset-0" initial={false}>
                <motion.div
                  className="absolute -inset-y-8 -left-1/2 w-1/2 bg-white/20 blur-sm rotate-12"
                  animate={{ x: ['-120%', '240%'] }}
                  transition={{ duration: 1.1, repeat: Infinity, ease: "linear" }}
                />
              </motion.div>
            )}

            <div className="relative z-10 flex items-center justify-center gap-2">
              {loading ? (
                <SaveButtonLoading />
              ) : (
                <>
                  <Save size={18} /> {queue.length > 0 ? `Salvar Todos (${queue.length})` : 'Confirmar'}
                </>
              )}
            </div>
          </button>
        </div>
      </motion.div>
    </div>
  );
}

export default RegistroEstudoModal;