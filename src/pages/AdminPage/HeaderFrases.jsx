import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { app, db } from '../../firebaseConfig';
import {
  collection, query, orderBy, onSnapshot, addDoc, updateDoc, deleteDoc,
  doc, serverTimestamp, setDoc, writeBatch, getDocs, where
} from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import {
  X, Loader2, Calendar, Star, Edit2, Trash2, Check, Plus, Upload,
  Search, Sparkles, ChevronRight, CheckCircle2, Quote, Clock
} from 'lucide-react';
import { useBodyScrollLock } from '../../hooks/useBodyScrollLock';
import ConfirmModal from '../../components/shared/ConfirmModal';

// --- UTILITÁRIOS INTERNOS ---
const dateToYMD = (date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};
const ymdToDisplay = (ymd) => {
  if (!ymd) return '—';
  const [y, m, d] = ymd.split('-');
  return `${d}/${m}/${y}`;
};
const addDays = (ymd, n) => {
  const d = new Date(ymd + 'T00:00:00');
  d.setDate(d.getDate() + n);
  return dateToYMD(d);
};
const isToday = (ymd) => ymd === dateToYMD(new Date());
const isPast = (ymd) => ymd < dateToYMD(new Date());
const isFuture = (ymd) => ymd > dateToYMD(new Date());

// Encontra a próxima data livre (Gap ou Fim)
const getNextAvailableDate = (existingQuotes) => {
  const today = dateToYMD(new Date());
  const scheduled = existingQuotes.map(q => q.scheduledDate).filter(Boolean).sort();

  if (scheduled.length === 0) return today;

  // Verifica se hoje está livre
  if (!scheduled.includes(today)) return today;

  // Procura o primeiro buraco a partir de hoje
  let checkDate = today;
  while (scheduled.includes(checkDate)) {
    checkDate = addDays(checkDate, 1);
  }
  return checkDate;
};

// --- FUNÇÃO DE REAGENDAMENTO EM CASCATA (SHIFT) ---
// Empurra frases para frente a partir de uma data para evitar colisão
const shiftQuotesFromDate = async (startDate, excludeId = null) => {
  try {
    // Busca todas as frases agendadas a partir da data de conflito
    const q = query(
      collection(db, 'system_quotes'),
      where('scheduledDate', '>=', startDate),
      orderBy('scheduledDate', 'asc')
    );
    const snapshot = await getDocs(q);

    if (snapshot.empty) return;

    const batch = writeBatch(db);
    let currentDate = startDate;
    let quotesToShift = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));

    // Se estamos editando uma, removemos ela da lista de "empurradas" para não mover a si mesma duplamente
    if (excludeId) {
      quotesToShift = quotesToShift.filter(q => q.id !== excludeId);
    }

    // Como vamos inserir uma nova frase em 'startDate', a primeira frase existente
    // que estava em 'startDate' deve ir para 'startDate + 1', e assim por diante.
    // Mas precisamos verificar buracos. Se houver um buraco, o shift para ali.

    // Simplificação robusta: Movemos TUDO um dia para frente a partir da colisão
    // Mas apenas se houver colisão exata no dia.

    // Vamos reprocessar:
    // 1. Verificamos se existe ALGUÉM exatamente na startDate (além da que estamos salvando)
    const collision = quotesToShift.find(q => q.scheduledDate === startDate);

    if (!collision) return; // Não tem ninguém no dia, não precisa empurrar nada.

    // 2. Se tem colisão, precisamos empurrar essa e as subsequentes que estiverem em sequencia
    // Ex: Dia 10 (Ocupado), Dia 11 (Ocupado), Dia 13 (Livre).
    // Insiro no Dia 10 -> Ocupado vai p/ 11, O do 11 vai p/ 12. O do 13 fica quieto.

    let nextDateToCheck = startDate;

    for (const quote of quotesToShift) {
        if (quote.scheduledDate === nextDateToCheck) {
            // Está na data que precisamos usar, move para a próxima
            const newDate = addDays(nextDateToCheck, 1);
            const ref = doc(db, 'system_quotes', quote.id);
            batch.update(ref, { scheduledDate: newDate });
            nextDateToCheck = newDate; // O próximo tem que ser verificado contra a nova data
        } else if (quote.scheduledDate > nextDateToCheck) {
            // Encontramos um buraco, a cascata para aqui
            break;
        }
    }

    await batch.commit();
  } catch (error) {
    console.error("Erro ao reagendar frases:", error);
    throw error; // Propaga erro para alertar usuário
  }
};


// --- COMPONENTE MODAL BASE ---
const ExpandedModal = ({ isOpen, onClose, title, children }) => {
  useBodyScrollLock(isOpen, { fixed: false });
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-0 md:p-4 bg-zinc-950/70 backdrop-blur-md animate-fade-in">
      <motion.div
        initial={{ scale: 0.95, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.95, opacity: 0, y: 20 }}
        className="bg-zinc-100 dark:bg-zinc-900 w-full h-full md:w-[95%] md:max-w-6xl md:h-[85vh] md:rounded-3xl border border-zinc-200 dark:border-zinc-800 shadow-2xl flex flex-col overflow-hidden relative"
      >
        <div className="px-6 py-4 border-b border-zinc-200 dark:border-zinc-800 flex justify-between items-center bg-white dark:bg-zinc-950 shadow-sm z-50">
          <h3 className="text-xl font-black text-zinc-900 dark:text-white flex items-center gap-2 tracking-tight">
            {title} <span className="text-red-600 hidden md:inline">.</span>
          </h3>
          <button onClick={onClose} className="p-2 bg-zinc-50 dark:bg-zinc-900 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20 rounded-full transition-colors text-zinc-400">
            <X size={20} />
          </button>
        </div>
        <div className="flex-1 overflow-hidden relative flex flex-col md:flex-row bg-zinc-50 dark:bg-black/20">
          {children}
        </div>
      </motion.div>
    </div>
  );
};

// --- COMPONENTE PRINCIPAL ---
const HeaderFrases = ({ isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState('all');
  const [quotes, setQuotes] = useState([]);
  const [featuredConfig, setFeaturedConfig] = useState(null);
  const [newText, setNewText] = useState('');
  const [newAuthor, setNewAuthor] = useState('');
  const [newDate, setNewDate] = useState('');
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');

  // Bulk import
  const [bulkText, setBulkText] = useState('');
  const [bulkParsed, setBulkParsed] = useState([]);
  const [bulkSaving, setBulkSaving] = useState(false);
  const [bulkSaved, setBulkSaved] = useState(false);
  const [automationConfig, setAutomationConfig] = useState(null);
  const [automationRunning, setAutomationRunning] = useState(false);
  const [automationResult, setAutomationResult] = useState(null);

  const [schedulingQuote, setSchedulingQuote] = useState(null);
  const [scheduleDate, setScheduleDate] = useState(dateToYMD(new Date()));
  const [editingQuote, setEditingQuote] = useState(null);
  const [editText, setEditText] = useState('');
  const [editAuthor, setEditAuthor] = useState('');
  const [editDate, setEditDate] = useState('');
  const [feedback, setFeedback] = useState(null);
  const [confirmRequest, setConfirmRequest] = useState(null);

  useEffect(() => {
    if (!isOpen) return;
    const q = query(collection(db, 'system_quotes'), orderBy('scheduledDate', 'asc'));
    const unsub = onSnapshot(q, (snap) => {
      setQuotes(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const unsub = onSnapshot(doc(db, 'system_config', 'quotes_settings'), (snap) => {
      setFeaturedConfig(snap.exists() ? snap.data() : null);
    });
    return () => unsub();
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const unsub = onSnapshot(doc(db, 'system_config', 'quotes_automation'), (snap) => {
      setAutomationConfig(snap.exists() ? snap.data() : null);
    });
    return () => unsub();
  }, [isOpen]);

  useEffect(() => {
    if (activeTab === 'add') {
      setNewDate(getNextAvailableDate(quotes));
    }
  }, [quotes, activeTab]);

  useEffect(() => {
    if (!bulkText.trim()) { setBulkParsed([]); return; }
    const lines = bulkText.split('\n').filter(l => l.trim());
    const nextBase = getNextAvailableDate(quotes);
    const parsed = lines.map((line, i) => {
      const sepMatch = line.match(/^(.*?)\s*[\|—–]\s*(.+)$/);
      if (sepMatch) {
        return {
          text: sepMatch[1].trim().replace(/^[""]|[""]$/g, ''),
          author: sepMatch[2].trim(),
          scheduledDate: addDays(nextBase, i),
        };
      }
      return {
        text: line.trim().replace(/^[""]|[""]$/g, ''),
        author: 'Autor Desconhecido',
        scheduledDate: addDays(nextBase, i),
      };
    });
    setBulkParsed(parsed);
  }, [bulkText, quotes]);

  const handleAddQuote = async () => {
    if (!newText.trim()) return;
    setSaving(true);
    try {
      // 1. Verificar conflito e fazer shift se necessário
      if (newDate) {
          await shiftQuotesFromDate(newDate);
      }

      // 2. Salvar
      await addDoc(collection(db, 'system_quotes'), {
        text: newText.trim(),
        author: newAuthor.trim() || 'Autor Desconhecido',
        scheduledDate: newDate || getNextAvailableDate(quotes),
        createdAt: serverTimestamp(),
      });
      setNewText(''); setNewAuthor(''); setNewDate(''); setActiveTab('all');
    } catch (e) { console.error(e); setFeedback({ type: 'error', message: 'Erro ao salvar frase.' }); } finally { setSaving(false); }
  };

  const handleBulkImport = async () => {
    if (!bulkParsed.length) return;
    setBulkSaving(true);
    try {
      // Importação em massa assume datas sequenciais a partir do próximo livre
      // Não faz shift complexo aqui para performance, apenas insere nos espaços livres (lógica do useEffect já calcula)
      const BATCH_SIZE = 500;
      for (let i = 0; i < bulkParsed.length; i += BATCH_SIZE) {
        const batch = writeBatch(db);
        const chunk = bulkParsed.slice(i, i + BATCH_SIZE);
        chunk.forEach(q => {
          const ref = doc(collection(db, 'system_quotes'));
          batch.set(ref, { ...q, createdAt: serverTimestamp() });
        });
        await batch.commit();
      }
      setBulkText(''); setBulkParsed([]); setBulkSaved(true);
      setTimeout(() => setBulkSaved(false), 3000);
      setActiveTab('all');
    } catch (e) { console.error(e); setFeedback({ type: 'error', message: 'Erro ao importar frases.' }); } finally { setBulkSaving(false); }
  };

  const handleAutoReplenish = async () => {
    if (automationRunning) return;
    setAutomationRunning(true);
    setAutomationResult(null);
    try {
      const functions = getFunctions(app, 'us-central1');
      const abastecerFrases = httpsCallable(functions, 'abastecerFrasesMotivacionais');
      const result = await abastecerFrases({});
      setAutomationResult(result?.data || null);
      setActiveTab('all');
    } catch (e) {
      console.error(e);
      setFeedback({ type: 'error', message: 'Erro ao abastecer frases com IA.' });
    } finally {
      setAutomationRunning(false);
    }
  };

  const handleDeleteQuote = async (q) => {
    setConfirmRequest({ type: 'quote', quote: q });
  };

  const confirmDeleteQuote = async (q) => {
    try {
      await deleteDoc(doc(db, 'system_quotes', q.id));
      if (featuredConfig?.featuredQuoteId === q.id) {
        await setDoc(doc(db, 'system_config', 'quotes_settings'), {
          featuredDate: null, featuredText: null, featuredAuthor: null, featuredQuoteId: null,
        }, { merge: true });
      }
      if (editingQuote?.id === q.id) setEditingQuote(null);
    } catch (e) {
      console.error(e);
      setFeedback({ type: 'error', message: 'Erro ao excluir frase.' });
    }
  };

  const handleStartEdit = (q) => {
    setEditingQuote(q); setEditText(q.text); setEditAuthor(q.author); setEditDate(q.scheduledDate || ''); setSchedulingQuote(null);
  };

  const handleSaveEdit = async () => {
    if (!editText.trim() || !editingQuote) return;
    setSaving(true);
    try {
      const updates = { text: editText.trim(), author: editAuthor.trim() || 'Autor Desconhecido' };

      // Se a data mudou, precisamos verificar conflito e fazer shift
      if (editDate && editDate !== editingQuote.scheduledDate) {
          await shiftQuotesFromDate(editDate, editingQuote.id); // Exclui a própria frase do shift
          updates.scheduledDate = editDate;
      } else if (editDate === '') {
          updates.scheduledDate = null; // Remove data se limpou
      }

      await updateDoc(doc(db, 'system_quotes', editingQuote.id), updates);

      if (featuredConfig?.featuredQuoteId === editingQuote.id) {
        await setDoc(doc(db, 'system_config', 'quotes_settings'), {
          featuredText: updates.text, featuredAuthor: updates.author,
        }, { merge: true });
      }
      setEditingQuote(null);
    } catch (e) { console.error(e); setFeedback({ type: 'error', message: 'Erro ao salvar edição.' }); } finally { setSaving(false); }
  };

  const handleSchedule = async () => {
    if (!schedulingQuote || !scheduleDate) return;
    setSaving(true);
    try {
      await setDoc(doc(db, 'system_config', 'quotes_settings'), {
        featuredDate: scheduleDate, featuredText: schedulingQuote.text, featuredAuthor: schedulingQuote.author,
        featuredQuoteId: schedulingQuote.id || null, updatedAt: serverTimestamp(),
      }, { merge: true });
      setSchedulingQuote(null);
    } catch (e) { console.error(e); setFeedback({ type: 'error', message: 'Erro ao agendar frase.' }); } finally { setSaving(false); }
  };

  const handleClearFeatured = async () => {
    setConfirmRequest({ type: 'featured' });
  };

  const confirmClearFeatured = async () => {
    await setDoc(doc(db, 'system_config', 'quotes_settings'), {
      featuredDate: null, featuredText: null, featuredAuthor: null, featuredQuoteId: null,
    }, { merge: true });
  };

  const handleConfirmRequest = async () => {
    const request = confirmRequest;
    setConfirmRequest(null);
    if (request?.type === 'quote') await confirmDeleteQuote(request.quote);
    if (request?.type === 'featured') await confirmClearFeatured();
  };

  const todayStr = dateToYMD(new Date());
  const isTodayFeaturedManual = featuredConfig?.featuredDate === todayStr && !!featuredConfig?.featuredText;

  const filteredQuotes = useMemo(() =>
    quotes.filter(q => !search || q.text?.toLowerCase().includes(search.toLowerCase()) || q.author?.toLowerCase().includes(search.toLowerCase())),
    [quotes, search]
  );

  const { pastQuotes, todayQuotes, futureQuotes } = useMemo(() => ({
      pastQuotes: filteredQuotes.filter(q => q.scheduledDate && isPast(q.scheduledDate)),
      todayQuotes: filteredQuotes.filter(q => q.scheduledDate && isToday(q.scheduledDate)),
      futureQuotes: filteredQuotes.filter(q => !q.scheduledDate || isFuture(q.scheduledDate)),
  }), [filteredQuotes]);

  const tabs = [
    { key: 'all', label: 'Calendário', icon: Calendar },
    { key: 'auto', label: 'Automacao IA', icon: Sparkles },
    { key: 'add', label: 'Nova Frase', icon: Plus },
    { key: 'bulk', label: 'Importar em Massa', icon: Upload },
  ];

  if (!isOpen) return null;

  const QuoteCard = ({ q, idx }) => {
    const isThisFeatured = isTodayFeaturedManual && featuredConfig?.featuredText === q.text && featuredConfig?.featuredAuthor === q.author;
    const isTodayCard = q.scheduledDate && isToday(q.scheduledDate);
    const isPastCard = q.scheduledDate && isPast(q.scheduledDate);
    const isSchedulingThis = schedulingQuote?.id === q.id;
    const isEditingThis = editingQuote?.id === q.id;

    return (
      <motion.div
        key={q.id}
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: idx * 0.015 }}
        className={`relative group p-4 rounded-2xl border transition-all ${
          isEditingThis ? 'bg-red-50 dark:bg-red-900/10 border-red-300 dark:border-red-700/50 ring-1 ring-red-400/30'
            : isThisFeatured ? 'bg-amber-50 dark:bg-amber-900/10 border-amber-300 dark:border-amber-700/50 ring-1 ring-amber-400/30'
            : isTodayCard ? 'bg-emerald-50 dark:bg-emerald-900/10 border-emerald-300 dark:border-emerald-700/50 ring-1 ring-emerald-400/30'
            : isPastCard ? 'bg-zinc-50 dark:bg-zinc-900/30 border-zinc-200 dark:border-zinc-800 opacity-60'
            : 'bg-white dark:bg-zinc-900/60 border-zinc-200 dark:border-zinc-800 hover:border-red-300 dark:hover:border-red-700 hover:shadow-sm'
        }`}
      >
        <div className="flex items-start justify-between gap-2 mb-2">
            <div className="flex items-center gap-1.5 flex-wrap">
                <span className={`flex items-center gap-1 text-[9px] font-black uppercase px-2 py-0.5 rounded-md border ${isTodayCard ? 'bg-emerald-100 text-emerald-700 border-emerald-200' : isPastCard ? 'bg-zinc-100 text-zinc-400 border-zinc-200' : 'bg-red-50 text-red-600 border-red-200'}`}>
                <Calendar size={8} /> {q.scheduledDate ? ymdToDisplay(q.scheduledDate) : 'Sem data'}
                </span>
                {isTodayCard && <span className="flex items-center gap-1 text-[9px] font-black text-emerald-700 uppercase bg-emerald-100 px-2 py-0.5 rounded-md border border-emerald-200"><Sparkles size={8} /> Hoje</span>}
                {isThisFeatured && <span className="flex items-center gap-1 text-[9px] font-black text-amber-600 uppercase bg-amber-100 px-2 py-0.5 rounded-md"><Star size={9} fill="currentColor" /> Destaque Manual</span>}
                {isEditingThis && <span className="flex items-center gap-1 text-[9px] font-black text-red-600 uppercase bg-red-100 px-2 py-0.5 rounded-md"><Edit2 size={9} /> Editando</span>}
            </div>
        </div>

        {isEditingThis ? (
          <div className="space-y-3 mb-3">
            <textarea value={editText} onChange={e => setEditText(e.target.value)} rows={3} autoFocus className="w-full bg-white dark:bg-zinc-800 border border-red-200 focus:border-red-500 rounded-xl px-3 py-2 text-sm outline-none resize-none dark:text-white transition-colors" />
            <div className="flex flex-col sm:flex-row gap-2">
              <input type="text" value={editAuthor} onChange={e => setEditAuthor(e.target.value)} placeholder="Autor" className="flex-1 bg-white dark:bg-zinc-800 border border-red-200 focus:border-red-500 rounded-xl px-3 py-2 text-sm outline-none dark:text-white transition-colors" />
              {/* DATE PICKER VISUALMENTE MELHORADO */}
              <div className="relative group">
                  <div className="absolute left-3 top-1/2 -translate-y-1/2 text-red-500 pointer-events-none">
                      <Calendar size={14} />
                  </div>
                  <input
                    type="date"
                    value={editDate}
                    onChange={e => setEditDate(e.target.value)}
                    className="bg-white dark:bg-zinc-800 border border-red-200 focus:border-red-500 rounded-xl pl-9 pr-3 py-2 text-sm outline-none dark:text-white transition-colors cursor-pointer w-full sm:w-auto"
                  />
              </div>
            </div>
          </div>
        ) : (
          <>
            <p className="text-sm font-bold text-zinc-800 dark:text-zinc-200 italic leading-snug mb-1">"{q.text}"</p>
            <p className="text-[11px] text-zinc-500 mb-3">— {q.author}</p>
          </>
        )}

        <AnimatePresence>
          {isSchedulingThis && !isEditingThis && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
              <div className="pt-3 border-t border-zinc-100 dark:border-zinc-800 mt-1 flex items-center gap-2">
                <Calendar size={13} className="text-zinc-400 shrink-0" />
                <span className="text-[10px] text-zinc-400 font-medium">Destacar para:</span>
                <input type="date" value={scheduleDate} onChange={e => setScheduleDate(e.target.value)} className="flex-1 text-xs bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 rounded-lg px-2 py-1.5 outline-none dark:text-white focus:border-red-500 transition-colors" />
                <button onClick={handleSchedule} disabled={saving} className="flex items-center gap-1 px-3 py-1.5 bg-red-600 hover:bg-red-500 text-white text-[10px] font-black uppercase rounded-lg">
                  {saving ? <Loader2 size={11} className="animate-spin" /> : <Check size={11} />} OK
                </button>
                <button onClick={() => setSchedulingQuote(null)} className="p-1.5 text-zinc-400 hover:text-zinc-700 rounded-lg"><X size={13} /></button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="flex items-center gap-2 mt-2">
          {isEditingThis ? (
            <>
              <button onClick={handleSaveEdit} disabled={saving || !editText.trim()} className="flex items-center gap-1.5 px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white text-[10px] font-black uppercase rounded-xl transition-all shadow-md">
                {saving ? <Loader2 size={10} className="animate-spin" /> : <Check size={10} />} Salvar
              </button>
              <button onClick={() => setEditingQuote(null)} className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-100 dark:bg-zinc-800 text-zinc-500 hover:bg-zinc-200 text-[10px] font-bold uppercase rounded-xl transition-all"><X size={10} /> Cancelar</button>
            </>
          ) : (
            <>
              <button onClick={() => { if (isSchedulingThis) setSchedulingQuote(null); else { setSchedulingQuote(q); setScheduleDate(todayStr); setEditingQuote(null); } }} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-bold uppercase transition-all ${isSchedulingThis ? 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500' : 'bg-zinc-50 dark:bg-zinc-800/80 hover:bg-red-50 text-zinc-500 hover:text-red-600 border border-zinc-200 dark:border-zinc-700'}`}>
                <Star size={10} /> {isSchedulingThis ? 'Cancelar' : isThisFeatured ? 'Reagendar' : 'Destacar'}
              </button>
              <div className="flex items-center gap-1.5 ml-auto">
                <button onClick={() => { handleStartEdit(q); setSchedulingQuote(null); }} className="p-1.5 text-zinc-300 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors" title="Editar"><Edit2 size={13} /></button>
                <button onClick={() => handleDeleteQuote(q)} className="p-1.5 text-zinc-300 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors" title="Excluir"><Trash2 size={13} /></button>
              </div>
            </>
          )}
        </div>
      </motion.div>
    );
  };

  return (
    <>
    <ExpandedModal isOpen={isOpen} onClose={onClose} title="Gerenciar Frases">
      <div className="flex flex-col w-full h-full overflow-hidden">
        <div className="flex items-center justify-between px-6 pt-4 pb-0 bg-white dark:bg-zinc-950 border-b border-zinc-100 dark:border-zinc-800 shrink-0 gap-4">
          <div className="flex gap-1 overflow-x-auto">
            {tabs.map(t => (
              <button key={t.key} onClick={() => setActiveTab(t.key)} className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-bold uppercase tracking-wide border-b-2 transition-all -mb-px whitespace-nowrap ${activeTab === t.key ? 'border-red-500 text-red-600 dark:text-red-400' : 'border-transparent text-zinc-400 hover:text-zinc-700'}`}>
                <t.icon size={13} /> {t.label}
              </button>
            ))}
          </div>
          {isTodayFeaturedManual && (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 rounded-xl mb-1">
              <span className="relative flex h-2 w-2"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span><span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span></span>
              <span className="text-[10px] font-black text-amber-700 dark:text-amber-400 uppercase tracking-wider">Destaque manual ativo</span>
              <button onClick={handleClearFeatured} className="ml-1 text-amber-400 hover:text-red-500"><X size={12} /></button>
            </div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {activeTab === 'all' && (
            <>
              {featuredConfig?.featuredText && (
                <div className={`p-4 rounded-2xl border flex items-start gap-3 ${isTodayFeaturedManual ? 'bg-amber-50 dark:bg-amber-900/10 border-amber-200' : 'bg-zinc-50 border-zinc-200'}`}>
                  <Star size={16} className={isTodayFeaturedManual ? 'text-amber-500' : 'text-zinc-300'} fill={isTodayFeaturedManual ? 'currentColor' : 'none'} />
                  <div className="flex-1 min-w-0">
                    <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400">{isTodayFeaturedManual ? 'Destaque Manual — Hoje' : `Destaque Manual Agendado para ${ymdToDisplay(featuredConfig.featuredDate)}`}</span>
                    <p className="text-sm font-bold text-zinc-800 dark:text-zinc-200 italic mt-1">"{featuredConfig.featuredText}"</p>
                    <p className="text-[11px] text-zinc-500 mt-0.5">— {featuredConfig.featuredAuthor}</p>
                  </div>
                  <button onClick={handleClearFeatured} className="p-1.5 text-zinc-300 hover:text-red-500 rounded-lg"><Trash2 size={14} /></button>
                </div>
              )}

              <div className="flex gap-3 items-center">
                <div className="relative flex-1">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
                  <input type="text" placeholder="Buscar frases..." value={search} onChange={e => setSearch(e.target.value)} className="w-full pl-9 pr-4 py-2.5 text-sm bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl outline-none dark:text-white focus:border-red-500 transition-colors" />
                </div>
                <div className="flex gap-2 shrink-0">
                  <div className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-100 rounded-xl"><span className="w-2 h-2 rounded-full bg-emerald-500"></span><span className="text-[10px] font-black text-emerald-700">{todayQuotes.length} hoje</span></div>
                  <div className="flex items-center gap-1.5 px-3 py-1.5 bg-red-50 dark:bg-red-900/20 border border-red-100 rounded-xl"><span className="w-2 h-2 rounded-full bg-red-500"></span><span className="text-[10px] font-black text-red-700">{futureQuotes.length} agendadas</span></div>
                </div>
              </div>

              {todayQuotes.length > 0 && <div><p className="text-[10px] font-black uppercase tracking-widest text-emerald-600 mb-3 flex items-center gap-1.5"><Sparkles size={11} /> Exibindo Hoje</p><div className="grid gap-3 md:grid-cols-2">{todayQuotes.map((q, i) => <QuoteCard key={q.id} q={q} idx={i} />)}</div></div>}
              {futureQuotes.length > 0 && <div><p className="text-[10px] font-black uppercase tracking-widest text-red-600 mb-3 flex items-center gap-1.5 mt-2"><Calendar size={11} /> Próximas Datas</p><div className="grid gap-3 md:grid-cols-2">{futureQuotes.map((q, i) => <QuoteCard key={q.id} q={q} idx={i} />)}</div></div>}
              {pastQuotes.length > 0 && <details className="group"><summary className="text-[10px] font-black uppercase tracking-widest text-zinc-400 mb-3 flex items-center gap-1.5 cursor-pointer mt-2 select-none"><Clock size={11} /> Exibidas Anteriormente ({pastQuotes.length}) <ChevronRight size={11} className="ml-auto transition-transform group-open:rotate-90" /></summary><div className="grid gap-3 md:grid-cols-2 mt-3">{pastQuotes.map((q, i) => <QuoteCard key={q.id} q={q} idx={i} />)}</div></details>}
              {filteredQuotes.length === 0 && <div className="flex flex-col items-center justify-center py-16 text-zinc-400"><Quote size={40} className="mb-4" /><p className="font-bold">Nenhuma frase cadastrada</p></div>}
            </>
          )}

          {activeTab === 'auto' && (
            <div className="max-w-3xl mx-auto w-full space-y-6">
              <div className="p-5 bg-violet-50 dark:bg-violet-900/10 border border-violet-100 dark:border-violet-900/40 rounded-2xl flex items-start gap-3">
                <Sparkles size={17} className="text-violet-600 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="text-xs font-black text-violet-700 dark:text-violet-300 uppercase tracking-widest">Abastecimento automatico</p>
                  <p className="text-xs font-medium text-violet-700/80 dark:text-violet-200/80 leading-relaxed">
                    O sistema roda sozinho todos os dias as 05:20, mantem ate 21 frases futuras, aprende o padrao das frases ja usadas, usa frases online com autor ou Autor Desconhecido e reaproveita antigas ocasionalmente.
                  </p>
                </div>
              </div>

              <div className="bg-white dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 space-y-5">
                <div className="grid sm:grid-cols-3 gap-3">
                  <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/40 p-4">
                    <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400 mb-1">Estoque atual</p>
                    <p className="text-2xl font-black text-zinc-900 dark:text-white">{futureQuotes.length}</p>
                    <p className="text-[11px] text-zinc-500">frases futuras</p>
                  </div>
                  <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/40 p-4">
                    <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400 mb-1">Meta</p>
                    <p className="text-2xl font-black text-zinc-900 dark:text-white">21</p>
                    <p className="text-[11px] text-zinc-500">dias abastecidos</p>
                  </div>
                  <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/40 p-4">
                    <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400 mb-1">Ultimo status</p>
                    <p className={`text-sm font-black uppercase ${automationConfig?.status === 'error' ? 'text-red-600' : 'text-emerald-600'}`}>
                      {automationConfig?.status || 'Aguardando'}
                    </p>
                    <p className="text-[11px] text-zinc-500 truncate">{automationConfig?.message || 'Sem execucao registrada'}</p>
                  </div>
                </div>

                {automationConfig?.status === 'error' && automationConfig?.error && (
                  <div className="p-3 rounded-xl border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-900/10 text-xs font-medium text-red-700 dark:text-red-300">
                    {automationConfig.error}
                  </div>
                )}

                {automationResult && (
                  <div className="p-3 rounded-xl border border-emerald-200 dark:border-emerald-900/50 bg-emerald-50 dark:bg-emerald-900/10 text-xs font-bold text-emerald-700 dark:text-emerald-300">
                    {automationResult.message} Novas: {automationResult.created || 0}. Reaproveitadas: {automationResult.reused || 0}. Duplicatas removidas: {automationResult.prunedDuplicates || 0}. Fontes online lidas: {automationResult.onlineSourcesRead || 0}.
                  </div>
                )}

                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
                  <div>
                    <p className="text-sm font-black text-zinc-900 dark:text-white">Rodar reposicao agora</p>
                    <p className="text-xs text-zinc-500">Use quando quiser completar o calendario imediatamente.</p>
                  </div>
                  <button
                    onClick={handleAutoReplenish}
                    disabled={automationRunning}
                    className="flex items-center justify-center gap-2 px-5 py-3 bg-violet-600 hover:bg-violet-700 text-white rounded-xl font-bold text-sm transition-all shadow-lg disabled:opacity-60 disabled:cursor-wait"
                  >
                    {automationRunning ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
                    {automationRunning ? 'Gerando...' : 'Abastecer com IA'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'add' && (
            <div className="max-w-2xl mx-auto w-full space-y-6">
              <div className="p-5 bg-red-50 dark:bg-red-900/10 border border-red-100 rounded-2xl flex items-start gap-3"><Sparkles size={16} className="text-red-500 shrink-0 mt-0.5" /><p className="text-xs font-medium text-red-700 dark:text-red-300">A data é preenchida automaticamente com o próximo dia disponível.</p></div>
              <div className="space-y-4 bg-white dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6">
                <div className="space-y-2"><label className="text-xs font-black uppercase tracking-widest text-zinc-400 ml-1">Texto da Frase *</label><textarea value={newText} onChange={e => setNewText(e.target.value)} placeholder='"A consistência bate o talento..."' rows={4} className="w-full bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 rounded-xl px-4 py-3 text-sm outline-none resize-none dark:text-white focus:border-red-500 transition-colors" /></div>
                <div className="flex flex-col sm:flex-row gap-3">
                    <div className="flex-1 space-y-2"><label className="text-xs font-black uppercase tracking-widest text-zinc-400 ml-1">Autor</label><input type="text" value={newAuthor} onChange={e => setNewAuthor(e.target.value)} className="w-full bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 rounded-xl px-4 py-2.5 text-sm outline-none dark:text-white focus:border-red-500 transition-colors" /></div>
                    <div className="space-y-2">
                        <label className="text-xs font-black uppercase tracking-widest text-zinc-400 ml-1 flex items-center gap-1"><Calendar size={10} /> Data</label>
                        <div className="relative">
                            <input type="date" value={newDate} onChange={e => setNewDate(e.target.value)} className="bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 rounded-xl px-4 py-2.5 text-sm outline-none dark:text-white focus:border-red-500 transition-colors w-full sm:w-auto" />
                        </div>
                    </div>
                </div>
                <div className="flex justify-end pt-2"><button onClick={handleAddQuote} disabled={!newText.trim() || saving} className="flex items-center gap-2 px-6 py-3 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold text-sm hover:scale-105 transition-all shadow-lg disabled:opacity-50">{saving ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />} Salvar Frase</button></div>
              </div>
            </div>
          )}

          {activeTab === 'bulk' && (
            <div className="max-w-3xl mx-auto w-full space-y-6">
              <div className="p-5 bg-blue-50 dark:bg-blue-900/10 border border-blue-100 rounded-2xl flex items-start gap-3"><Upload size={16} className="text-blue-500 shrink-0 mt-0.5" /><div><p className="text-xs font-black text-blue-700 mb-1 uppercase">Formato aceito</p><p className="text-xs font-medium text-blue-600">Uma frase por linha. Use <code className="bg-blue-100 px-1 rounded">|</code> para separar texto do autor.</p></div></div>
              <div className="bg-white dark:bg-zinc-900/60 border border-zinc-200 rounded-2xl p-6 space-y-4">
                <textarea value={bulkText} onChange={e => setBulkText(e.target.value)} placeholder="Frase... | Autor" rows={12} className="w-full bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 rounded-xl px-4 py-3 text-sm outline-none dark:text-white font-mono focus:border-red-500 transition-colors" />
                {bulkParsed.length > 0 && <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400 flex items-center gap-1.5"><CheckCircle2 size={11} className="text-emerald-500" /> {bulkParsed.length} frases detectadas</p>}
                {bulkSaved && <p className="text-emerald-600 font-bold">Importadas com sucesso!</p>}
                <div className="flex justify-end pt-2"><button onClick={handleBulkImport} disabled={bulkParsed.length === 0 || bulkSaving} className="flex items-center gap-2 px-6 py-3 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 rounded-xl font-bold text-sm hover:scale-105 transition-all shadow-lg disabled:opacity-50">{bulkSaving ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />} Importar</button></div>
              </div>
            </div>
          )}
        </div>
      </div>
    </ExpandedModal>
    {feedback && (
      <div className={`fixed top-5 left-1/2 -translate-x-1/2 z-[320] px-4 py-3 rounded-xl text-sm font-bold text-white shadow-xl ${feedback.type === 'error' ? 'bg-red-600' : 'bg-emerald-600'}`}>
        {feedback.message}
        <button onClick={() => setFeedback(null)} className="ml-3 opacity-80 hover:opacity-100">×</button>
      </div>
    )}
    <ConfirmModal
      isOpen={!!confirmRequest}
      onClose={() => setConfirmRequest(null)}
      onConfirm={handleConfirmRequest}
      title={confirmRequest?.type === 'quote' ? 'Excluir frase?' : 'Remover destaque manual?'}
      message={confirmRequest?.type === 'quote'
        ? 'A frase será removida permanentemente.'
        : 'A configuração de destaque manual será removida.'}
      confirmText="Confirmar"
      isDestructive
    />
    </>
  );
};

export default HeaderFrases;
