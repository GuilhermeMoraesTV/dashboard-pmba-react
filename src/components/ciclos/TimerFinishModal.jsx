import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  CheckCircle2, XCircle, Target, Save, Clock,
  BookOpen, List, AlertTriangle, CheckSquare, RotateCcw,
  Trash2, Split, X, AlertCircle, ChevronDown, ChevronUp, LogOut
} from 'lucide-react';
import { db } from '../../firebaseConfig';
import {
  doc, getDoc, collection, getDocs, query, where,
  writeBatch, Timestamp, increment // <--- IMPORTANTE: Adicionado increment
} from 'firebase/firestore';
import { useLevelSystem } from '../../hooks/useLevelSystem';

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

// ✅ DATA LOCAL (evita bug de UTC do toISOString())
const dateToYMDLocal = (date = new Date()) => {
  const d = date.getDate();
  const m = date.getMonth() + 1;
  const y = date.getFullYear();
  return `${y}-${m <= 9 ? '0' + m : m}-${d <= 9 ? '0' + d : d}`;
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

const CustomSelect = ({ options, value, onChange, placeholder, icon: Icon, disabled, loading }) => {
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

  const handleSelect = (val, e) => {
    e.stopPropagation();
    onChange(val);
    setIsOpen(false);
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <div
        onClick={(e) => { e.stopPropagation(); if (!disabled) setIsOpen(!isOpen); }}
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
            className="absolute z-[60] w-full mt-1 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-xl max-h-60 overflow-y-auto custom-scrollbar"
          >
            <div className="p-1">
              {options.length > 0 ? (
                options.map((opt, idx) => (
                  <div
                    key={`${opt.value}-${idx}`}
                    onClick={(e) => handleSelect(opt.value, e)}
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
  onConfirm,
  onCancel,
  onDiscard,
  initialAssunto,
  activeCicloData,
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
    markAsFinished: false
  }]);

  const [loadingAssuntos, setLoadingAssuntos] = useState(false);
  const [disciplinaManual, setDisciplinaManual] = useState('');
  const [todasDisciplinas, setTodasDisciplinas] = useState([]);
  const [erroDisciplina, setErroDisciplina] = useState(false);
  const [assuntosDisponiveis, setAssuntosDisponiveis] = useState([]);

  const [errorMessage, setErrorMessage] = useState('');
  const [showDiscardModal, setShowDiscardModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccessToast, setShowSuccessToast] = useState(false);

  const draftLoadedRef = useRef(false);

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
        markAsFinished: false
      });
      return newTopics;
    });
  }, [timeMinutes]);

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

  // ---------------------------
  // Draft restore
  // ---------------------------
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
        disciplinaManual
      }));
    }, 500);
    return () => clearTimeout(timer);
  }, [step, hasQuestions, topics, disciplinaManual, draftKey, isSubmitting]);

  // ---------------------------
  // Carrega assuntos
  // ---------------------------
  useEffect(() => {
    const fetchAssuntos = async () => {
      if (!activeCicloId || !userUid) return;
      setLoadingAssuntos(true);
      try {
        const cicloDoc = await getDoc(doc(db, 'users', userUid, 'ciclos', activeCicloId));
        let lista = [];
        if (cicloDoc.exists()) {
          const data = cicloDoc.data();
          if (Array.isArray(data.disciplinas)) lista = data.disciplinas;
        }
        if (lista.length === 0) {
          const snap = await getDocs(collection(db, 'users', userUid, 'ciclos', activeCicloId, 'disciplinas'));
          lista = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        }
        setTodasDisciplinas(lista);

        let alvo = lista.find(d => normalize(d.nome) === normalize(disciplinaNome));
        if (!alvo) alvo = lista.find(d => normalize(d.nome).includes(normalize(disciplinaNome)) || normalize(disciplinaNome).includes(normalize(d.nome)));

        if (alvo) {
          if (!disciplinaManual) setDisciplinaManual(alvo.nome);
          const rawAssuntos = Array.isArray(alvo.assuntos) ? alvo.assuntos : [];
          const mappedAssuntos = rawAssuntos.map(a => {
            const nome = typeof a === 'object' ? a.nome : a;
            return { value: nome, label: nome };
          });
          setAssuntosDisponiveis(mappedAssuntos);
          setErroDisciplina(false);
        } else {
          setErroDisciplina(true);
        }
      } catch (e) {
        console.error('[TimerFinishModal] Erro ao buscar assuntos:', e);
      } finally {
        setLoadingAssuntos(false);
      }
    };
    fetchAssuntos();
  }, [activeCicloId, userUid, disciplinaNome]);

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

  // ---------------------------
  // SAVE (COM AGREGAÇÃO "BALA DE PRATA")
  // ---------------------------
  const handleSaveSession = async (e) => {
    e.preventDefault();
    if (isSubmitting) return;
    setErrorMessage('');

    if (topics.some(t => !t.assunto)) {
      setErrorMessage('Selecione o assunto para todos os itens.');
      return;
    }
    if (!isTimeBalanced) {
      setErrorMessage(`Erro de balanceamento: ${totalAllocatedTime}m vs ${timeMinutes}m.`);
      return;
    }

    setIsSubmitting(true);
    try {
      const batch = writeBatch(db);
      const collectionRef = collection(db, 'users', userUid, 'registrosEstudo');
      const today = dateToYMDLocal(new Date());

      const finalDiscName = disciplinaManual || disciplinaNome;
      const discObj = todasDisciplinas.find(d => normalize(d.nome) === normalize(finalDiscName));
      const finalDiscId = discObj?.id || 'unknown';
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

      // --- AGREGAÇÃO DE DADOS (BALA DE PRATA) ---
      // Atualiza o documento de totais gerais com os dados desta sessão
      const statsRef = doc(db, 'users', userUid, 'stats', 'geral');
      // Usamos 'merge: true' para garantir que se o documento não existir, ele seja criado
      batch.set(statsRef, {
        totalHorasMinutos: increment(timeMinutes), // timeMinutes é o total da sessão
        totalQuestoes: increment(totalQuestions),
        totalAcertos: increment(totalCorrect),
        lastUpdated: now
      }, { merge: true });
      // ------------------------------------------

      await batch.commit();

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
          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <div className="flex items-center gap-2 bg-white dark:bg-zinc-800 px-4 py-2 rounded-xl border border-zinc-200 dark:border-zinc-700 shadow-sm w-full sm:w-auto">
              <BookOpen size={18} className="text-zinc-400" />
              <span className="font-bold text-zinc-700 dark:text-zinc-200 text-sm truncate max-w-[200px]">
                {erroDisciplina ? 'Selecione...' : disciplinaManual || disciplinaNome}
              </span>
            </div>
          </div>
        </div>

        {/* BODY */}
        <div className="p-6 md:p-8 overflow-y-auto flex-1 custom-scrollbar">
          {step === 1 ? (
            <div className="flex flex-col items-center justify-center py-8 space-y-8 h-full">
              <div className="text-center space-y-2">
                <h3 className="text-2xl font-bold text-zinc-800 dark:text-white">Resolveu questões?</h3>
                <p className="text-zinc-500 text-sm max-w-xs mx-auto">Registre seu desempenho para alimentar as estatísticas de acertos.</p>
              </div>
              <div className="grid grid-cols-2 gap-6 w-full max-w-md">
                <button type="button" onClick={() => { setHasQuestions(false); setStep(2); }} className="flex flex-col items-center justify-center gap-3 p-6 rounded-[32px] border-2 border-zinc-100 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-all group h-40">
                  <XCircle size={48} className="text-zinc-300 group-hover:text-red-500 transition-colors" />
                  <span className="font-bold text-lg text-zinc-600 dark:text-zinc-400 text-center">Apenas Estudo</span>
                </button>
                <button type="button" onClick={() => { setHasQuestions(true); setStep(2); }} className="flex flex-col items-center justify-center gap-3 p-6 rounded-[32px] border-2 border-emerald-100 dark:border-emerald-900/30 bg-emerald-50/50 dark:bg-emerald-900/10 hover:border-emerald-500 hover:shadow-xl hover:shadow-emerald-500/20 transition-all group h-40">
                  <Target size={48} className="text-emerald-500 group-hover:scale-110 transition-transform" />
                  <span className="font-bold text-lg text-emerald-700 dark:text-emerald-400 text-center">Sim, resolvi!</span>
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

              {(erroDisciplina || !assuntosDisponiveis.length) && (
                <div className="p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-2xl flex items-center gap-4">
                  <div className="p-2 bg-amber-100 dark:bg-amber-900/40 rounded-full text-amber-600 shrink-0">
                    <AlertTriangle size={20} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-amber-700 dark:text-amber-400 uppercase mb-1">Disciplina não reconhecida</p>
                    <select
                      value={disciplinaManual}
                      onChange={(e) => {
                        const nova = e.target.value;
                        setDisciplinaManual(nova);
                        const d = todasDisciplinas.find(i => i.nome === nova);
                        if (d) {
                          const rawAssuntos = d.assuntos || [];
                          setAssuntosDisponiveis(rawAssuntos.map(a => ({
                            value: typeof a === 'object' ? a.nome : a,
                            label: typeof a === 'object' ? a.nome : a
                          })));
                          setErroDisciplina(false);
                        }
                      }}
                      className="w-full p-2 rounded-lg bg-white dark:bg-zinc-950 border border-amber-300 dark:border-amber-700 text-sm font-bold text-zinc-700 dark:text-zinc-200 outline-none focus:ring-2 focus:ring-amber-500"
                    >
                      <option value="">-- Selecione a Disciplina Correta --</option>
                      {todasDisciplinas.map((d, i) => <option key={i} value={d.nome}>{d.nome}</option>)}
                    </select>
                  </div>
                </div>
              )}

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
                          <div className="space-y-1.5">
                            <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest ml-1">Assunto Estudado</label>
                            <CustomSelect
                              options={assuntosDisponiveis}
                              value={topic.assunto}
                              onChange={(val) => {
                                updateTopicData(index, { assunto: val });
                                checkTopicFinished(val, index);
                              }}
                              placeholder="Selecione o assunto..."
                              icon={List}
                              disabled={loadingAssuntos}
                              loading={loadingAssuntos}
                            />
                          </div>
                          {topic.assunto && (
                            <div
                              onClick={() => updateTopicData(index, { markAsFinished: !topic.markAsFinished })}
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

                <button type="button" onClick={addTopic} className="w-full py-3 rounded-xl border-2 border-dashed border-zinc-300 dark:border-zinc-700 text-zinc-500 dark:text-zinc-400 font-bold text-xs uppercase tracking-wide hover:border-emerald-500 hover:text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-900/10 transition-all flex items-center justify-center gap-2">
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
                  className="flex-1 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 disabled:hover:bg-emerald-600 text-white rounded-xl font-bold shadow-xl shadow-emerald-600/20 transition-all transform hover:-translate-y-0.5 active:translate-y-0 flex items-center justify-center gap-3 text-base py-4"
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