import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Pencil, X, Clock, Lightbulb, Plus, Trash2, Save,
  ClipboardList, AlertTriangle, ListChecks, RotateCcw, AlertCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// --- HELPERS LOCAIS ---
const normName = (s) => (s || '').trim().toLowerCase();

// ============================================================================
// COMPONENTE: MODAL DE CONFIRMAÇÃO DE SAÍDA (Igual ao de Criação)
// ============================================================================
const CloseConfirmationModal = ({ isOpen, onCancel, onConfirm }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-fade-in font-sans">
      <motion.div
        initial={{ scale: 0.92, opacity: 0, y: 10 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.92, opacity: 0, y: 10 }}
        transition={{ type: "spring", duration: 0.45 }}
        className="bg-white dark:bg-zinc-950 rounded-2xl md:rounded-3xl shadow-2xl border border-zinc-200 dark:border-zinc-800 w-full max-w-sm md:max-w-md overflow-hidden"
      >
        <div className="bg-amber-50 dark:bg-amber-900/10 p-5 md:p-6 flex flex-col items-center border-b border-amber-100 dark:border-amber-800/30">
          <div className="w-14 h-14 md:w-20 md:h-20 bg-amber-100 dark:bg-amber-500/20 rounded-full flex items-center justify-center mb-3 md:mb-4 text-amber-700 dark:text-amber-400 ring-4 md:ring-8 ring-amber-50/50 dark:ring-amber-900/10">
            <AlertTriangle className="w-7 h-7 md:w-10 md:h-10" />
          </div>
          <h3 className="text-lg md:text-xl font-black text-zinc-900 dark:text-white mb-1">
            Descartar alterações?
          </h3>
          <p className="text-zinc-500 dark:text-zinc-400 text-xs md:text-sm text-center px-2 md:px-4 leading-relaxed">
            Você editou este simulado. Se sair agora, <strong>as mudanças serão perdidas</strong>.
          </p>
        </div>

        <div className="p-4 md:p-6 flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 py-3 rounded-xl font-bold text-xs md:text-sm text-zinc-600 dark:text-zinc-300 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
          >
            Voltar
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 py-3 rounded-xl font-bold text-xs md:text-sm text-white bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-600/20 transition-all"
          >
            Sim, descartar
          </button>
        </div>
      </motion.div>
    </div>
  );
};

// ============================================================================
// COMPONENTE PRINCIPAL: EDITAR SIMULADO
// ============================================================================
const EditSimuladoModal = ({ isOpen, onClose, simulado, onSave, disciplinasSugestivas }) => {
  const [titulo, setTitulo] = useState('');
  const [banca, setBanca] = useState('');
  const [data, setData] = useState(new Date().toISOString().split('T')[0]);
  const [disciplinas, setDisciplinas] = useState([]);
  const [activeTab, setActiveTab] = useState('details');
  const [loading, setLoading] = useState(false);
  const [durationMinutes, setDurationMinutes] = useState(null);

  // Controle de Alterações e Confirmação
  const [confirmCloseOpen, setConfirmCloseOpen] = useState(false);
  const initialSnapshotRef = useRef('');

  // Estado para Erros Visuais
  const [fieldErrors, setFieldErrors] = useState({ titulo: false, data: false, disciplinas: false });

  // Inicialização
  useEffect(() => {
    if (!isOpen || !simulado) return;

    setTitulo(simulado.titulo || '');
    setBanca(simulado.banca || '');
    setData(simulado.data || new Date().toISOString().split('T')[0]);

    const d = (simulado.disciplinas || []).map((x, i) => ({
      _id: Date.now() + i,
      nome: x.nome || '',
      questoes: String(x.total ?? x.questoes ?? ''),
      acertos: String(x.acertos ?? ''),
      branco: String(x.branco ?? 0),
      peso: Number(x.peso ?? 1)
    }));

    setDurationMinutes(simulado.durationMinutes ?? null);

    if (d.length > 0) setDisciplinas(d);
    else {
      const baseObj = { _id: Date.now(), nome: '', questoes: '', acertos: '', branco: '', peso: 1 };
      if (disciplinasSugestivas?.length > 0) {
        setDisciplinas(disciplinasSugestivas.map((s, idx) => ({
          ...baseObj,
          _id: Date.now() + idx,
          nome: s.nome || s.disciplinaNome || ''
        })));
      } else {
        setDisciplinas([baseObj]);
      }
    }

    // Salva o estado inicial para comparar depois (isDirty)
    initialSnapshotRef.current = JSON.stringify({
      titulo: simulado.titulo || '',
      banca: simulado.banca || '',
      data: simulado.data || new Date().toISOString().split('T')[0],
      durationMinutes: simulado.durationMinutes ?? null,
      disciplinas: d
    });

    setActiveTab('details');
    setFieldErrors({ titulo: false, data: false, disciplinas: false });
    setLoading(false);
    setConfirmCloseOpen(false);
  }, [isOpen, simulado, disciplinasSugestivas]);

  // Verifica se houve alteração
  const isDirty = useMemo(() => {
    if (!isOpen) return false;
    const currentSnap = JSON.stringify({ titulo, banca, data, durationMinutes, disciplinas });
    return currentSnap !== initialSnapshotRef.current;
  }, [isOpen, titulo, banca, data, durationMinutes, disciplinas]);

  const handleClose = () => {
    onClose();
  };

  const requestClose = () => {
    if (isDirty) {
      setConfirmCloseOpen(true);
    } else {
      handleClose();
    }
  };

  const handleChange = (idx, field, val) => {
    const arr = [...disciplinas];
    arr[idx][field] = val;
    setDisciplinas(arr);
    if (fieldErrors.disciplinas) setFieldErrors(prev => ({ ...prev, disciplinas: false }));
  };

  const addMateria = () => {
    setDisciplinas([{ _id: Date.now(), nome: '', questoes: '', acertos: '', branco: '', peso: 1 }, ...disciplinas]);
    if (fieldErrors.disciplinas) setFieldErrors(prev => ({ ...prev, disciplinas: false }));
  };

  const removeMateria = (idx) => setDisciplinas(disciplinas.filter((_, i) => i !== idx));

  const dupMap = useMemo(() => {
    const counts = new Map();
    disciplinas.forEach(d => {
      const k = normName(d.nome);
      if (!k) return;
      counts.set(k, (counts.get(k) || 0) + 1);
    });
    return counts;
  }, [disciplinas]);

  const totais = useMemo(() => {
    let tQuestoes = 0, tAcertos = 0, tBrancos = 0, tPontosPossiveis = 0, tPontosObtidos = 0;
    disciplinas.forEach(d => {
      const q = Number(d.questoes) || 0;
      const a = Number(d.acertos) || 0;
      const b = Number(d.branco) || 0;
      const p = Number(d.peso) || 1;
      if (q > 0) {
        tQuestoes += q;
        tAcertos += a;
        tBrancos += b;
        tPontosPossiveis += (q * p);
        tPontosObtidos += (a * p);
      }
    });
    const notaFinal = tPontosPossiveis > 0 ? (tPontosObtidos / tPontosPossiveis) * 100 : 0;
    return { tQuestoes, tAcertos, tBrancos, tPontosPossiveis, tPontosObtidos, notaFinal };
  }, [disciplinas]);

  const handleSave = () => {
    // 1. Resetar erros
    const newErrors = { titulo: false, data: false, disciplinas: false };
    let hasError = false;

    // 2. Validações
    if (!titulo.trim()) { newErrors.titulo = true; hasError = true; }
    if (!data) { newErrors.data = true; hasError = true; }

    const validas = disciplinas
      .map(d => ({ ...d, nome: (d.nome || '').trim() }))
      .filter(d => d.nome && Number(d.questoes) > 0);

    if (validas.length === 0) {
        newErrors.disciplinas = true;
        hasError = true;
    }

    // 3. Aplica erros e muda de aba se necessário
    if (hasError) {
        setFieldErrors(newErrors);
        if (newErrors.disciplinas && activeTab !== 'subjects') setActiveTab('subjects');
        else if ((newErrors.titulo || newErrors.data) && activeTab !== 'details') setActiveTab('details');
        return;
    }

    // 4. Validação Lógica (Alertas)
    for (let d of validas) {
      if ((Number(d.acertos) + Number(d.branco)) > Number(d.questoes)) {
        return alert(`Erro em "${d.nome}": A soma de Acertos + Brancos não pode ser maior que o total de Questões.`);
      }
    }

    const seen = new Set();
    for (let d of validas) {
      const k = normName(d.nome);
      if (seen.has(k)) return alert(`Disciplina duplicada: "${d.nome}". Remova/renomeie para não repetir disciplinas no mesmo simulado.`);
      seen.add(k);
    }

    setLoading(true);

    const payload = {
      titulo,
      banca,
      data,
      disciplinas: validas.map(d => ({
        nome: d.nome,
        total: Number(d.questoes),
        acertos: Number(d.acertos),
        branco: Number(d.branco) || 0,
        peso: Number(d.peso) || 1
      })),
      resumo: {
        totalQuestoes: totais.tQuestoes,
        totalAcertos: totais.tAcertos,
        totalBrancos: totais.tBrancos,
        pontosObtidos: totais.tPontosObtidos,
        pontosPossiveis: totais.tPontosPossiveis,
        porcentagem: totais.notaFinal
      }
    };

    onSave(payload);
    setLoading(false);
    onClose();
  };

  if (!isOpen || !simulado) return null;

  return (
    <div className="fixed inset-0 z-[75] flex items-center justify-center p-3 md:p-4 bg-zinc-900/60 backdrop-blur-md animate-fade-in">

      <CloseConfirmationModal
        isOpen={confirmCloseOpen}
        onCancel={() => setConfirmCloseOpen(false)}
        onConfirm={() => { setConfirmCloseOpen(false); onClose(); }}
      />

      <div className="bg-white dark:bg-zinc-950 rounded-3xl shadow-2xl border border-zinc-200 dark:border-zinc-800 w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden relative">

        {/* HEADER AZUL (Estilo "StartSimulado" mas azul para diferenciar Edit) */}
        <div className="relative bg-blue-600 pt-6 pb-6 px-6 overflow-hidden shrink-0">
          <div className="absolute -right-6 -bottom-8 opacity-20 transform -rotate-12 pointer-events-none">
            <Pencil size={140} className="text-white" />
          </div>
          <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-b from-white/10 to-transparent pointer-events-none" />

          <div className="relative z-10 flex justify-between items-start">
            <div>
              <div className="flex items-center gap-2 text-white/90 mb-1">
                <span className="bg-white/20 backdrop-blur-sm px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest border border-white/10">
                  Edição
                </span>
              </div>
              <h2 className="text-2xl font-black text-white tracking-tight">Editar Simulado</h2>
              <p className="text-blue-100 text-xs font-medium mt-1">Atualize as informações do seu registro.</p>
            </div>
            <button onClick={requestClose} className="text-white/70 hover:text-white bg-white/10 hover:bg-white/20 rounded-full p-2 transition-colors backdrop-blur-sm">
              <X size={20} />
            </button>
          </div>
        </div>

        {/* TABS */}
        <div className="flex border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50">
            <button onClick={() => setActiveTab('details')} className={`flex-1 py-3 text-xs md:text-sm font-bold border-b-2 transition-colors flex items-center justify-center gap-2 relative ${activeTab === 'details' ? 'border-blue-600 text-blue-600 bg-blue-50/50 dark:bg-blue-900/10' : 'border-transparent text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 dark:hover:bg-zinc-800'} ${(fieldErrors.titulo || fieldErrors.data) ? 'text-red-500' : ''}`}>
              <ClipboardList size={16} /> Dados Básicos
              {(fieldErrors.titulo || fieldErrors.data) && <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse absolute top-2 right-4 md:right-10" />}
            </button>
            <button onClick={() => setActiveTab('subjects')} className={`flex-1 py-3 text-xs md:text-sm font-bold border-b-2 transition-colors flex items-center justify-center gap-2 relative ${activeTab === 'subjects' ? 'border-blue-600 text-blue-600 bg-blue-50/50 dark:bg-blue-900/10' : 'border-transparent text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 dark:hover:bg-zinc-800'} ${fieldErrors.disciplinas ? 'text-red-500' : ''}`}>
              <ListChecks size={16} /> Disciplinas & Notas
              {fieldErrors.disciplinas && <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse absolute top-2 right-4 md:right-10" />}
            </button>
        </div>

        {/* BODY */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6 bg-white dark:bg-zinc-950 custom-scrollbar">

          {activeTab === 'details' && (
            <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} className="space-y-5">

              <div className="space-y-2">
                  <div className="flex justify-between">
                    <label className="text-xs font-bold text-zinc-500 uppercase tracking-wide ml-1">Título do Simulado</label>
                    {fieldErrors.titulo && (<span className="text-[10px] font-bold text-red-500 flex items-center gap-1 animate-pulse"><AlertCircle size={12}/> Obrigatório</span>)}
                  </div>
                  <div className="relative">
                    <input
                        value={titulo}
                        onChange={e => { setTitulo(e.target.value); if(fieldErrors.titulo) setFieldErrors(prev=>({...prev, titulo:false})); }}
                        className={`w-full p-4 pl-4 rounded-2xl border-2 outline-none font-bold text-zinc-800 dark:text-white transition-all shadow-sm text-sm ${fieldErrors.titulo ? 'border-red-500 bg-red-50 dark:bg-red-900/10 focus:border-red-600' : 'border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 focus:border-blue-500'}`}
                        placeholder="Ex: Simulado PMBA 2025 - Estratégia"
                    />
                    <div className={`absolute right-4 top-1/2 -translate-y-1/2 transition-colors ${fieldErrors.titulo ? 'text-red-500' : 'text-zinc-400'}`}>
                        {fieldErrors.titulo ? <AlertCircle size={20}/> : <Pencil size={16} />}
                    </div>
                  </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-zinc-500 uppercase tracking-wide ml-1">Banca</label>
                    <input
                        value={banca}
                        onChange={e => setBanca(e.target.value)}
                        className="w-full p-4 rounded-2xl border-2 border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 focus:border-blue-500 outline-none font-bold text-zinc-800 dark:text-white transition-all shadow-sm text-sm"
                        placeholder="Ex: FCC, Cebraspe..."
                    />
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between">
                        <label className="text-xs font-bold text-zinc-500 uppercase tracking-wide ml-1">Data</label>
                        {fieldErrors.data && (<span className="text-[10px] font-bold text-red-500 flex items-center gap-1 animate-pulse"><AlertCircle size={12}/> Obrigatório</span>)}
                    </div>
                    <input
                        type="date"
                        value={data}
                        onChange={e => { setData(e.target.value); if(fieldErrors.data) setFieldErrors(prev=>({...prev, data:false})); }}
                        className={`w-full p-4 rounded-2xl border-2 outline-none font-bold text-zinc-800 dark:text-white transition-all shadow-sm text-sm ${fieldErrors.data ? 'border-red-500 bg-red-50 dark:bg-red-900/10 focus:border-red-600' : 'border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 focus:border-blue-500'}`}
                    />
                  </div>
              </div>

              {durationMinutes !== null && (
                <div className="p-4 bg-blue-50 dark:bg-blue-900/10 rounded-2xl border border-blue-200 dark:border-blue-800">
                  <div className="flex items-center gap-3">
                    <Clock size={24} className="text-blue-600" />
                    <div>
                      <span className="text-xs font-bold text-blue-600 uppercase">Tempo Gasto</span>
                      <p className="text-xl font-black text-blue-700 dark:text-blue-400">
                        {Math.floor(durationMinutes / 60)}h {durationMinutes % 60}min
                      </p>
                    </div>
                  </div>
                </div>
              )}

              <div className="p-4 bg-blue-50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-800 rounded-2xl flex items-start gap-3">
                <Lightbulb className="text-blue-500 mt-1" size={18} />
                <div>
                  <p className="text-sm font-bold text-blue-700 dark:text-blue-300">Dica</p>
                  <p className="text-xs text-blue-600/80 dark:text-blue-400">
                    Evite disciplinas duplicadas — o sistema bloqueia repetição.
                  </p>
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'subjects' && (
            <motion.div initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }}>
              <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-3 mb-4">
                <div className="text-[11px] text-zinc-500 font-medium">Edite a lista com cuidado.</div>
                <button onClick={addMateria} className="flex items-center justify-center gap-2 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-200 px-4 py-2.5 rounded-xl text-xs font-bold transition-colors w-full md:w-auto">
                  <Plus size={16} /> Adicionar Linha
                </button>
              </div>

              {/* Erro de validação visual */}
              <AnimatePresence>
                {fieldErrors.disciplinas && disciplinas.filter(d => d.nome && d.questoes > 0).length === 0 && (
                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800 rounded-xl p-3 mb-4 flex items-center gap-3">
                        <AlertTriangle className="text-red-500" size={20}/>
                        <p className="text-xs font-bold text-red-600 dark:text-red-400">Adicione pelo menos uma disciplina válida (com nome e quantidade de questões maior que zero).</p>
                    </motion.div>
                )}
              </AnimatePresence>

              <div className="hidden md:grid grid-cols-12 gap-2 px-2 text-[10px] font-bold text-zinc-400 uppercase tracking-wider text-center mb-2">
                <div className="col-span-4 text-left pl-2">Disciplina</div><div className="col-span-2">Questões</div><div className="col-span-2 text-emerald-600">Acertos</div><div className="col-span-2">Branco</div><div className="col-span-1 text-amber-600">Peso</div><div className="col-span-1"></div>
              </div>

              <div className="space-y-3">
                <AnimatePresence>
                  {disciplinas.map((disc, idx) => {
                    const isError = (Number(disc.acertos) + Number(disc.branco)) > Number(disc.questoes) && Number(disc.questoes) > 0;
                    const k = normName(disc.nome);
                    const isDup = k && (dupMap.get(k) || 0) > 1;

                    return (
                      <motion.div key={disc._id} initial={{ opacity: 0, height: 0, scale: 0.95 }} animate={{ opacity: 1, height: 'auto', scale: 1 }} exit={{ opacity: 0, height: 0, scale: 0.95 }} className={`rounded-2xl border transition-all shadow-sm overflow-hidden ${isError ? 'bg-red-50 border-red-300' : isDup ? 'bg-amber-50 border-amber-300' : 'bg-zinc-50/50 dark:bg-zinc-900/50 border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700'}`}>
                        {/* Desktop row */}
                        <div className="hidden md:grid grid-cols-12 gap-2 items-center p-3">
                          <div className="col-span-4 relative">
                            <input list={`edit-sug-${idx}`} value={disc.nome} onChange={e => handleChange(idx, 'nome', e.target.value)} className={`w-full bg-white dark:bg-zinc-950 border rounded-xl px-3 py-2 text-sm font-bold outline-none transition-colors ${isDup ? 'border-amber-400 focus:border-amber-500' : 'border-zinc-200 dark:border-zinc-700 focus:border-blue-500'}`} placeholder="Matéria..." />
                            <datalist id={`edit-sug-${idx}`}>{disciplinasSugestivas?.map((s, i) => <option key={i} value={s.nome || s.disciplinaNome} />)}</datalist>
                          </div>
                          <div className="col-span-2"><input type="number" value={disc.questoes} onChange={e => handleChange(idx, 'questoes', e.target.value)} className="w-full text-center bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-700 rounded-xl py-2 text-sm font-bold outline-none focus:border-zinc-400" placeholder="0" /></div>
                          <div className="col-span-2"><input type="number" value={disc.acertos} onChange={e => handleChange(idx, 'acertos', e.target.value)} className="w-full text-center bg-white dark:bg-zinc-950 border border-emerald-200 dark:border-emerald-900/50 text-emerald-600 rounded-xl py-2 text-sm font-black outline-none focus:border-emerald-500" placeholder="0" /></div>
                          <div className="col-span-2"><input type="number" value={disc.branco} onChange={e => handleChange(idx, 'branco', e.target.value)} className="w-full text-center bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-700 rounded-xl py-2 text-sm outline-none focus:border-zinc-400" placeholder="0" /></div>
                          <div className="col-span-1"><input type="number" value={disc.peso} onChange={e => handleChange(idx, 'peso', e.target.value)} className="w-full text-center bg-white dark:bg-zinc-950 border border-amber-200 dark:border-amber-900/50 text-amber-600 rounded-xl py-2 text-xs font-bold outline-none focus:border-amber-500" placeholder="1" /></div>
                          <div className="col-span-1 flex justify-center"><button onClick={() => removeMateria(idx)} className="p-2 rounded-lg text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"><Trash2 size={18} /></button></div>
                        </div>

                        {/* Mobile card (Optimized) */}
                        <div className="md:hidden p-3">
                          <div className="flex items-center gap-2 mb-2">
                             <div className="flex-1 relative">
                                <input list={`edit-sug-m-${idx}`} value={disc.nome} onChange={e => handleChange(idx, 'nome', e.target.value)} className={`w-full bg-white dark:bg-zinc-950 border rounded-xl px-3 py-2.5 text-sm font-bold outline-none shadow-sm ${isDup ? 'border-amber-400 focus:border-amber-500' : 'border-zinc-200 dark:border-zinc-700 focus:border-blue-500'}`} placeholder="Disciplina..." />
                                <datalist id={`edit-sug-m-${idx}`}>{disciplinasSugestivas?.map((s, i) => <option key={i} value={s.nome || s.disciplinaNome} />)}</datalist>
                                {isError && <span className="absolute right-3 top-2.5 text-[10px] text-red-600 font-bold bg-red-100 px-1.5 rounded">Erro!</span>}
                             </div>
                             <button onClick={() => removeMateria(idx)} className="p-2.5 rounded-xl bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-700 text-zinc-400 hover:text-red-500 shadow-sm"><Trash2 size={18} /></button>
                          </div>
                          <div className="grid grid-cols-4 gap-2">
                             <div><label className="block text-[9px] font-black uppercase text-zinc-400 mb-1 text-center tracking-tighter">Questões</label><input type="number" value={disc.questoes} onChange={e => handleChange(idx, 'questoes', e.target.value)} className="w-full text-center bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-700 rounded-xl py-2 text-sm font-bold outline-none shadow-sm" placeholder="0" /></div>
                             <div><label className="block text-[9px] font-black uppercase text-emerald-600 mb-1 text-center tracking-tighter">Acertos</label><input type="number" value={disc.acertos} onChange={e => handleChange(idx, 'acertos', e.target.value)} className="w-full text-center bg-white dark:bg-zinc-950 border border-emerald-200 dark:border-emerald-900/30 text-emerald-600 rounded-xl py-2 text-sm font-black outline-none shadow-sm" placeholder="0" /></div>
                             <div><label className="block text-[9px] font-black uppercase text-zinc-400 mb-1 text-center tracking-tighter">Branco</label><input type="number" value={disc.branco} onChange={e => handleChange(idx, 'branco', e.target.value)} className="w-full text-center bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-700 rounded-xl py-2 text-sm font-bold outline-none shadow-sm" placeholder="0" /></div>
                             <div><label className="block text-[9px] font-black uppercase text-amber-500 mb-1 text-center tracking-tighter">Peso</label><input type="number" value={disc.peso} onChange={e => handleChange(idx, 'peso', e.target.value)} className="w-full text-center bg-white dark:bg-zinc-950 border border-amber-200 dark:border-amber-900/30 text-amber-600 rounded-xl py-2 text-sm font-black outline-none shadow-sm" placeholder="1" /></div>
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
              </div>
            </motion.div>
          )}
        </div>

        <div className="bg-white dark:bg-zinc-950 border-t border-zinc-200 dark:border-zinc-800 p-4 md:p-6 relative z-20">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-6 mb-4 md:mb-5">
            <div className="text-center bg-zinc-50 dark:bg-zinc-900/50 rounded-xl py-2"><span className="text-[9px] md:text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Total</span><p className="text-lg md:text-xl font-bold text-zinc-700 dark:text-white">{totais.tQuestoes}</p></div>
            <div className="text-center bg-emerald-50 dark:bg-emerald-900/10 rounded-xl py-2"><span className="text-[9px] md:text-[10px] font-bold text-emerald-600 uppercase tracking-wider">Acertos</span><p className="text-lg md:text-xl font-bold text-emerald-600">{totais.tAcertos}</p></div>
            <div className="hidden md:block text-center bg-zinc-50 dark:bg-zinc-900/50 rounded-xl py-2"><span className="text-[9px] md:text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Pontos Máx</span><p className="text-lg md:text-xl font-bold text-zinc-500">{totais.tPontosPossiveis}</p></div>
            <div className="text-center bg-zinc-900 dark:bg-zinc-100 rounded-xl flex flex-col justify-center shadow-lg py-2"><span className="text-[9px] md:text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">Nota Final</span><p className="text-xl md:text-2xl font-black text-white dark:text-zinc-900">{totais.tPontosObtidos.toFixed(1)}</p></div>
          </div>

          <div className="flex gap-3">
            <button onClick={requestClose} disabled={loading} className="flex-1 py-3.5 rounded-xl font-bold text-sm text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors">Cancelar</button>
            <button onClick={handleSave} disabled={loading} className="flex-[2] py-3.5 rounded-xl font-bold text-sm text-white bg-blue-600 hover:bg-blue-700 shadow-xl shadow-blue-600/20 hover:shadow-blue-600/30 transition-all flex items-center justify-center gap-2">
              {loading ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" /> : (<><Save size={18} /> Salvar Alterações</>)}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EditSimuladoModal;