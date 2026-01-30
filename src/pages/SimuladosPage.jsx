
import React, { useState, useEffect, useMemo } from 'react';
import {
  collection, query, orderBy, onSnapshot, addDoc, deleteDoc, doc, Timestamp, updateDoc
} from 'firebase/firestore';
import { db } from '../firebaseConfig';
import {
  Plus, Trash2, ChevronDown, Trophy, Target, TrendingUp, Calendar,
  Save, X, Search, ArrowUpRight, ArrowDownRight,
  CheckCircle2, RotateCcw, ArrowLeftRight, BarChart2, AlertTriangle, Layers,
  ClipboardList, Lightbulb, TrendingDown, Activity, Zap, Minus, Pencil
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// ============================================================================
// UTILITÁRIOS E HELPERS
// ============================================================================

const formatDate = (dateString) => {
  if (!dateString) return '-';
  const [year, month, day] = dateString.split('-');
  return `${day}/${month}/${year}`;
};

const getScoreColor = (score, type = 'text') => {
  if (score >= 80) return type === 'bg' ? 'bg-emerald-500' : 'text-emerald-600';
  if (score >= 70) return type === 'bg' ? 'bg-blue-500' : 'text-blue-600';
  if (score >= 50) return type === 'bg' ? 'bg-amber-500' : 'text-amber-600';
  return type === 'bg' ? 'bg-red-500' : 'text-red-600';
};

const getStatusColor = (status) => {
  switch (status) {
    case 'growth': return 'bg-emerald-100 text-emerald-700 border-emerald-200';
    case 'drop': return 'bg-red-100 text-red-700 border-red-200';
    case 'new': return 'bg-blue-100 text-blue-700 border-blue-200';
    case 'stable': return 'bg-zinc-100 text-zinc-600 border-zinc-200';
    default: return 'bg-zinc-50 text-zinc-400';
  }
};

const normName = (s) => (s || '').trim().toLowerCase();

const calcResumoFromDisciplinas = (disciplinasRaw) => {
  let totalQuestoes = 0;
  let totalAcertos = 0;
  let totalBrancos = 0;
  let pontosPossiveis = 0;
  let pontosObtidos = 0;

  (disciplinasRaw || []).forEach(d => {
    const total = Number(d.total ?? d.questoes) || 0;
    const acertos = Number(d.acertos) || 0;
    const branco = Number(d.branco) || 0;
    const peso = Number(d.peso) || 1;

    if (total > 0) {
      totalQuestoes += total;
      totalAcertos += acertos;
      totalBrancos += branco;
      pontosPossiveis += total * peso;
      pontosObtidos += acertos * peso;
    }
  });

  const porcentagem = pontosPossiveis > 0 ? (pontosObtidos / pontosPossiveis) * 100 : 0;

  return {
    totalQuestoes,
    totalAcertos,
    totalBrancos,
    pontosObtidos,
    pontosPossiveis,
    porcentagem
  };
};

// Pequeno helper para ícone de seta
const ArrowRightIcon = ({ size = 12, className = '' }) => (
  <svg
    width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
    className={`text-zinc-300 ${className}`}
  >
    <path d="M5 12h14" />
    <path d="m12 5 7 7-7 7" />
  </svg>
);

// ============================================================================
// COMPONENTE: GRÁFICO DE RADAR SVG (2 séries, responsivo)
// ============================================================================

const SimpleRadarChart = ({ data, colorA, colorB, labelA, labelB }) => {
  const size = 320;
  const center = size / 2;
  const radius = (size / 2) - 50;

  if (!data || data.length < 3) return (
    <div className="flex items-center justify-center h-full text-xs text-zinc-400">
      Dados insuficientes para radar (min 3 matérias)
    </div>
  );

  const angleSlice = (Math.PI * 2) / data.length;

  const getCoords = (value, index) => {
    const angle = index * angleSlice - Math.PI / 2;
    const r = (Math.min(value, 100) / 100) * radius;
    return [center + Math.cos(angle) * r, center + Math.sin(angle) * r];
  };

  const buildPath = (key) => {
    const points = data.map((d, i) => getCoords(d[key], i));
    return points.map(p => p.join(',')).join(' ');
  };

  const pathA = buildPath('valA');
  const pathB = buildPath('valB');

  const axes = data.map((_, i) => {
    const [x, y] = getCoords(100, i);
    return <line key={i} x1={center} y1={center} x2={x} y2={y} stroke="#e4e4e7" strokeWidth="1" strokeDasharray="4 2" />;
  });

  const levels = [20, 40, 60, 80, 100];

  return (
    <div className="relative w-full h-full flex flex-col items-center">
      <svg width="100%" height="100%" viewBox={`0 0 ${size} ${size}`} className="overflow-visible font-sans">
        {levels.map(l => (
          <circle
            key={l}
            cx={center}
            cy={center}
            r={(l / 100) * radius}
            fill="none"
            stroke="#f4f4f5"
            strokeWidth="1"
          />
        ))}

        {axes}

        <motion.polygon
          initial={{ opacity: 0, scale: 0 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
          points={pathA}
          fill={colorA}
          fillOpacity="0.25"
          stroke={colorA}
          strokeWidth="2"
        />

        <motion.polygon
          initial={{ opacity: 0, scale: 0 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.7, delay: 0.2 }}
          points={pathB}
          fill={colorB}
          fillOpacity="0.2"
          stroke={colorB}
          strokeWidth="3"
        />

        {data.map((d, i) => {
          const [x, y] = getCoords(115, i);
          return (
            <text
              key={i}
              x={x}
              y={y}
              textAnchor="middle"
              alignmentBaseline="middle"
              className="text-[9px] font-bold fill-zinc-500 uppercase tracking-wide"
              style={{ textShadow: '0px 0px 4px white' }}
            >
              {d.subject.split(' ').slice(0, 2).join(' ')}
              {d.subject.split(' ').length > 2 ? '...' : ''}
            </text>
          );
        })}
      </svg>

      <div className="flex gap-4 mt-2 flex-wrap justify-center">
        <div className="flex items-center gap-2 text-xs font-bold text-zinc-500">
          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: colorA, opacity: 0.5 }} />
          {labelA}
        </div>
        <div className="flex items-center gap-2 text-xs font-bold text-zinc-800 dark:text-white">
          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: colorB }} />
          {labelB}
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// COMPONENTE: MODAL DE CONFIRMAÇÃO DE EXCLUSÃO
// ============================================================================

const DeleteConfirmationModal = ({ isOpen, onClose, onConfirm, item }) => {
  if (!isOpen || !item) return null;

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-fade-in">
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        className="bg-white dark:bg-zinc-950 rounded-3xl shadow-2xl border border-zinc-200 dark:border-zinc-800 w-full max-w-md overflow-hidden"
      >
        <div className="bg-red-50 dark:bg-red-900/10 p-6 flex flex-col items-center border-b border-red-100 dark:border-red-800/30">
          <div className="w-20 h-20 bg-red-100 dark:bg-red-500/20 rounded-full flex items-center justify-center mb-4 text-red-600 dark:text-red-500 ring-8 ring-red-50/50 dark:ring-red-900/10">
            <Trash2 size={40} />
          </div>
          <h3 className="text-xl font-black text-zinc-900 dark:text-white mb-1">Excluir Simulado?</h3>
          <p className="text-zinc-500 dark:text-zinc-400 text-sm text-center">
            Esta ação é irreversível e removerá todos os dados estatísticos associados.
          </p>
        </div>

        <div className="p-6">
          <div className="bg-zinc-50 dark:bg-zinc-900 rounded-xl p-4 border border-zinc-200 dark:border-zinc-800 mb-6 flex items-center gap-4">
            <div className="p-3 bg-white dark:bg-zinc-800 rounded-lg border border-zinc-200 dark:border-zinc-700 shadow-sm">
              <ClipboardList size={24} className="text-zinc-400" />
            </div>
            <div className="overflow-hidden">
              <p className="text-xs font-bold text-zinc-400 uppercase">Simulado Selecionado</p>
              <p className="text-sm font-bold text-zinc-800 dark:text-white truncate">{item.titulo}</p>
              <p className="text-xs text-zinc-500">{formatDate(item.data)} • {item.banca || 'Sem banca'}</p>
            </div>
          </div>

          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 py-3.5 rounded-xl font-bold text-zinc-600 dark:text-zinc-300 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={onConfirm}
              className="flex-1 py-3.5 rounded-xl font-bold text-white bg-red-600 hover:bg-red-700 shadow-lg shadow-red-600/20 transition-all flex items-center justify-center gap-2"
            >
              <Trash2 size={18} /> Confirmar
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

// ============================================================================
// MODAL: EDITAR SIMULADO (pedido: edição + alterar nome e demais parâmetros)
// - Valida duplicadas (case-insensitive)
// - Mesma estrutura do NovoSimuladoModal (sem geral/manual)
// ============================================================================

const EditSimuladoModal = ({ isOpen, onClose, simulado, onSave, disciplinasSugestivas }) => {
  const [titulo, setTitulo] = useState('');
  const [banca, setBanca] = useState('');
  const [data, setData] = useState(new Date().toISOString().split('T')[0]);
  const [disciplinas, setDisciplinas] = useState([]);
  const [activeTab, setActiveTab] = useState('details');
  const [loading, setLoading] = useState(false);

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

    // se estiver vazio, coloca 1 linha (ou sugestões)
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

    setActiveTab('details');
    setLoading(false);
  }, [isOpen, simulado, disciplinasSugestivas]);

  const handleChange = (idx, field, val) => {
    const arr = [...disciplinas];
    arr[idx][field] = val;
    setDisciplinas(arr);
  };

  const addMateria = () => setDisciplinas([{ _id: Date.now(), nome: '', questoes: '', acertos: '', branco: '', peso: 1 }, ...disciplinas]);
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
    const validas = disciplinas
      .map(d => ({ ...d, nome: (d.nome || '').trim() }))
      .filter(d => d.nome && Number(d.questoes) > 0);

    if (!titulo || !data || validas.length === 0) {
      return alert("Preencha Título, Data e pelo menos uma disciplina válida.");
    }

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
    <div className="fixed inset-0 z-[75] flex items-center justify-center p-3 md:p-4 bg-black/80 backdrop-blur-md animate-fade-in">
      <div className="bg-white dark:bg-zinc-950 rounded-2xl shadow-2xl border border-zinc-200 dark:border-zinc-800 w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden relative">
        <div className="p-4 md:p-6 border-b border-zinc-100 dark:border-zinc-800 flex justify-between items-center">
          <div className="flex items-center gap-3 md:gap-4">
            <div className="w-11 h-11 md:w-12 md:h-12 bg-blue-100 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 rounded-2xl flex items-center justify-center">
              <Pencil size={22} />
            </div>
            <div>
              <h2 className="text-lg md:text-xl font-black text-zinc-900 dark:text-white uppercase tracking-tight">Editar Simulado</h2>
              <p className="text-[11px] md:text-xs text-zinc-500">Atualize título, data, banca e disciplinas.</p>
            </div>
          </div>

          <button onClick={onClose} className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-full text-zinc-400 transition-colors">
            <X size={22} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 md:p-6 bg-zinc-50/50 dark:bg-zinc-900/50 custom-scrollbar">
          <div className="flex gap-2 mb-5 border-b border-zinc-200 dark:border-zinc-700 pb-1">
            <button
              onClick={() => setActiveTab('details')}
              className={`pb-2 px-3 md:px-4 text-sm font-bold border-b-2 transition-colors ${
                activeTab === 'details' ? 'border-blue-600 text-blue-700 dark:text-blue-400' : 'border-transparent text-zinc-400 hover:text-zinc-600'
              }`}
            >
              Dados Básicos
            </button>
            <button
              onClick={() => setActiveTab('subjects')}
              className={`pb-2 px-3 md:px-4 text-sm font-bold border-b-2 transition-colors ${
                activeTab === 'subjects' ? 'border-blue-600 text-blue-700 dark:text-blue-400' : 'border-transparent text-zinc-400 hover:text-zinc-600'
              }`}
            >
              Disciplinas & Notas
            </button>
          </div>

          {activeTab === 'details' && (
            <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} className="space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                <div className="md:col-span-2">
                  <label className="block text-xs font-bold text-zinc-500 uppercase mb-1">Título do Simulado</label>
                  <input
                    value={titulo}
                    onChange={e => setTitulo(e.target.value)}
                    className="w-full p-3 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 focus:ring-2 focus:ring-blue-600 outline-none transition-all font-semibold"
                    placeholder="Ex: Simulado PMBA 2025 - Estratégia"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-zinc-500 uppercase mb-1">Banca Organizadora</label>
                  <input
                    value={banca}
                    onChange={e => setBanca(e.target.value)}
                    className="w-full p-3 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 focus:ring-2 focus:ring-blue-600 outline-none transition-all font-semibold"
                    placeholder="Ex: FCC, Cebraspe..."
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-zinc-500 uppercase mb-1">Data de Realização</label>
                  <input
                    type="date"
                    value={data}
                    onChange={e => setData(e.target.value)}
                    className="w-full p-3 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 focus:ring-2 focus:ring-blue-600 outline-none transition-all font-semibold"
                  />
                </div>
              </div>

              <div className="p-4 bg-blue-50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-800 rounded-xl flex items-start gap-3">
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
            <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}>
              <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-3 mb-4">
                <div className="text-[11px] text-zinc-500">
                  Edite a lista com cuidado — duplicadas não são permitidas.
                </div>

                <button
                  onClick={addMateria}
                  className="flex items-center justify-center gap-1 bg-blue-100 text-blue-700 hover:bg-blue-200 px-3 py-2 rounded-lg text-xs font-bold transition-colors"
                >
                  <Plus size={14} /> Adicionar Linha
                </button>
              </div>

              <div className="hidden md:grid grid-cols-12 gap-2 px-2 text-[10px] font-bold text-zinc-400 uppercase tracking-wider text-center">
                <div className="col-span-4 text-left pl-2">Disciplina</div>
                <div className="col-span-2">Questões</div>
                <div className="col-span-2 text-emerald-600">Acertos</div>
                <div className="col-span-2">Branco</div>
                <div className="col-span-1 text-amber-600">Peso</div>
                <div className="col-span-1"></div>
              </div>

              <div className="space-y-3">
                <AnimatePresence>
                  {disciplinas.map((disc, idx) => {
                    const isError = (Number(disc.acertos) + Number(disc.branco)) > Number(disc.questoes) && Number(disc.questoes) > 0;
                    const k = normName(disc.nome);
                    const isDup = k && (dupMap.get(k) || 0) > 1;

                    return (
                      <motion.div
                        key={disc._id}
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className={`rounded-xl border transition-colors shadow-sm ${
                          isError ? 'bg-red-50 border-red-300' :
                          isDup ? 'bg-amber-50 border-amber-300' :
                          'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800'
                        }`}
                      >
                        {/* Desktop row */}
                        <div className="hidden md:grid grid-cols-12 gap-2 items-center p-2">
                          <div className="col-span-4 relative">
                            <input
                              list={`edit-sug-${idx}`}
                              value={disc.nome}
                              onChange={e => handleChange(idx, 'nome', e.target.value)}
                              className={`w-full bg-transparent border rounded-lg px-2 py-1.5 text-sm font-semibold outline-none ${
                                isDup ? 'border-amber-400 focus:border-amber-500' : 'border-zinc-200 dark:border-zinc-700 focus:border-zinc-400'
                              }`}
                              placeholder="Matéria..."
                            />
                            <datalist id={`edit-sug-${idx}`}>
                              {disciplinasSugestivas?.map((s, i) => <option key={i} value={s.nome || s.disciplinaNome} />)}
                            </datalist>
                            {isDup && (
                              <p className="text-[10px] font-bold text-amber-700 mt-1 pl-1">
                                Disciplina repetida — ajuste o nome.
                              </p>
                            )}
                          </div>

                          <div className="col-span-2">
                            <input
                              type="number"
                              value={disc.questoes}
                              onChange={e => handleChange(idx, 'questoes', e.target.value)}
                              className="w-full text-center bg-zinc-50 dark:bg-zinc-800 border-none rounded-lg py-1.5 text-sm font-bold outline-none"
                              placeholder="0"
                            />
                          </div>

                          <div className="col-span-2">
                            <input
                              type="number"
                              value={disc.acertos}
                              onChange={e => handleChange(idx, 'acertos', e.target.value)}
                              className="w-full text-center bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 border border-emerald-100 dark:border-emerald-800 rounded-lg py-1.5 text-sm font-black outline-none"
                              placeholder="0"
                            />
                          </div>

                          <div className="col-span-2">
                            <input
                              type="number"
                              value={disc.branco}
                              onChange={e => handleChange(idx, 'branco', e.target.value)}
                              className="w-full text-center bg-zinc-50 dark:bg-zinc-800 border-none rounded-lg py-1.5 text-sm outline-none"
                              placeholder="0"
                            />
                          </div>

                          <div className="col-span-1">
                            <input
                              type="number"
                              value={disc.peso}
                              onChange={e => handleChange(idx, 'peso', e.target.value)}
                              className="w-full text-center bg-amber-50 dark:bg-amber-900/20 text-amber-600 border border-amber-100 dark:border-amber-800 rounded-lg py-1.5 text-xs font-bold outline-none"
                              placeholder="1"
                            />
                          </div>

                          <div className="col-span-1 flex justify-center">
                            <button onClick={() => removeMateria(idx)} className="text-zinc-300 hover:text-red-500 transition-colors">
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </div>

                        {/* Mobile card */}
                        <div className="md:hidden p-3">
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex-1">
                              <label className="block text-[10px] font-black uppercase tracking-wider text-zinc-400 mb-1">
                                Disciplina
                              </label>
                              <input
                                list={`edit-sug-m-${idx}`}
                                value={disc.nome}
                                onChange={e => handleChange(idx, 'nome', e.target.value)}
                                className={`w-full bg-white/60 dark:bg-zinc-950/40 border rounded-lg px-3 py-2 text-sm font-semibold outline-none ${
                                  isDup ? 'border-amber-400 focus:border-amber-500' : 'border-zinc-200 dark:border-zinc-700 focus:border-zinc-400'
                                }`}
                                placeholder="Ex: Português"
                              />
                              <datalist id={`edit-sug-m-${idx}`}>
                                {disciplinasSugestivas?.map((s, i) => <option key={i} value={s.nome || s.disciplinaNome} />)}
                              </datalist>

                              {isDup && (
                                <p className="text-[10px] font-bold text-amber-700 mt-1">
                                  Disciplina repetida — ajuste o nome.
                                </p>
                              )}
                              {isError && (
                                <p className="text-[10px] font-bold text-red-700 mt-1">
                                  Acertos + branco maior que questões.
                                </p>
                              )}
                            </div>

                            <button
                              onClick={() => removeMateria(idx)}
                              className="p-2 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-400 hover:text-red-500 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
                              title="Remover"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>

                          <div className="grid grid-cols-2 gap-3 mt-3">
                            <div>
                              <label className="block text-[10px] font-black uppercase tracking-wider text-zinc-400 mb-1">
                                Questões
                              </label>
                              <input
                                type="number"
                                value={disc.questoes}
                                onChange={e => handleChange(idx, 'questoes', e.target.value)}
                                className="w-full text-center bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg py-2 text-sm font-bold outline-none"
                                placeholder="0"
                              />
                            </div>

                            <div>
                              <label className="block text-[10px] font-black uppercase tracking-wider text-zinc-400 mb-1">
                                Peso
                              </label>
                              <input
                                type="number"
                                value={disc.peso}
                                onChange={e => handleChange(idx, 'peso', e.target.value)}
                                className="w-full text-center bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800 rounded-lg py-2 text-sm font-black outline-none"
                                placeholder="1"
                              />
                            </div>

                            <div>
                              <label className="block text-[10px] font-black uppercase tracking-wider text-zinc-400 mb-1">
                                Acertos
                              </label>
                              <input
                                type="number"
                                value={disc.acertos}
                                onChange={e => handleChange(idx, 'acertos', e.target.value)}
                                className="w-full text-center bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 rounded-lg py-2 text-sm font-black outline-none"
                                placeholder="0"
                              />
                            </div>

                            <div>
                              <label className="block text-[10px] font-black uppercase tracking-wider text-zinc-400 mb-1">
                                Branco
                              </label>
                              <input
                                type="number"
                                value={disc.branco}
                                onChange={e => handleChange(idx, 'branco', e.target.value)}
                                className="w-full text-center bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg py-2 text-sm font-bold outline-none"
                                placeholder="0"
                              />
                            </div>
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

        <div className="bg-white dark:bg-zinc-950 border-t border-zinc-200 dark:border-zinc-800 p-3 md:p-4 relative z-20">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mb-3 md:mb-4">
            <div className="text-center bg-zinc-50 dark:bg-zinc-900/50 rounded-xl py-2">
              <span className="text-[9px] font-bold text-zinc-400 uppercase">Questões</span>
              <p className="text-lg font-bold text-zinc-700 dark:text-white">{totais.tQuestoes}</p>
            </div>

            <div className="text-center bg-emerald-50 dark:bg-emerald-900/10 rounded-xl py-2">
              <span className="text-[9px] font-bold text-emerald-500 uppercase">Acertos</span>
              <p className="text-lg font-bold text-emerald-600">{totais.tAcertos}</p>
            </div>

            <div className="hidden md:block text-center bg-zinc-50 dark:bg-zinc-900/50 rounded-xl py-2">
              <span className="text-[9px] font-bold text-zinc-400 uppercase">Pontos Possíveis</span>
              <p className="text-lg font-bold text-zinc-500">{totais.tPontosPossiveis}</p>
            </div>

            <div className="text-center bg-zinc-900 dark:bg-zinc-100 rounded-xl flex flex-col justify-center shadow-lg py-2">
              <span className="text-[9px] font-bold text-zinc-400 dark:text-zinc-500 uppercase">Pontos</span>
              <p className="text-xl font-black text-white dark:text-zinc-900">{totais.tPontosObtidos.toFixed(1)}</p>
            </div>
          </div>

          <div className="flex justify-end items-center gap-2 md:gap-3">
            <button onClick={onClose} disabled={loading} className="px-4 md:px-6 py-2.5 md:py-3 rounded-xl text-sm font-bold text-zinc-500 hover:bg-zinc-100 transition-colors">
              Cancelar
            </button>

            <button
              onClick={handleSave}
              disabled={loading}
              className="px-5 md:px-8 py-2.5 md:py-3 rounded-xl text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-600/30 transition-all flex items-center gap-2"
            >
              {loading
                ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                : (<><Save size={18} /> Salvar Alterações</>)
              }
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// ARENA DE EVOLUÇÃO: MULTI-COMPARAÇÃO (seleciona N simulados, compara 2 por vez)
// - Mobile: cards e radar menores + tabela compacta (pedido)
// ============================================================================

const SimuladoEvolutionArena = ({ simuladosSelecionados, onClose }) => {
  if (!simuladosSelecionados || simuladosSelecionados.length < 2) return null;

  const ordered = useMemo(() => {
    return [...simuladosSelecionados].sort((a, b) => new Date(a.data) - new Date(b.data));
  }, [simuladosSelecionados]);

  const base = ordered[0];
  const targets = ordered.slice(1);

  const [activeTargetId, setActiveTargetId] = useState(targets[targets.length - 1]?.id);

  useEffect(() => {
    if (!targets.find(t => t.id === activeTargetId)) {
      setActiveTargetId(targets[targets.length - 1]?.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targets.length]);

  const target = targets.find(t => t.id === activeTargetId) || targets[targets.length - 1];

  const scoreBase = base?.resumo?.pontosObtidos || 0;
  const scoreTarget = target?.resumo?.pontosObtidos || 0;
  const deltaPontos = scoreTarget - scoreBase;
  const isPositive = deltaPontos >= 0;
  const growthPerc = scoreBase > 0 ? (deltaPontos / scoreBase) * 100 : 100;

  const allDisciplines = useMemo(() => {
    const map = new Map();

    (base?.disciplinas || []).forEach(d => {
      const peso = d.peso || 1;
      map.set(d.nome, {
        name: d.nome,
        baseRaw: d.acertos,
        baseTotal: d.total,
        basePoints: d.acertos * peso,
        baseMaxPoints: d.total * peso,
        targetRaw: 0,
        targetTotal: 0,
        targetPoints: 0,
        targetMaxPoints: 0,
        weight: peso
      });
    });

    (target?.disciplinas || []).forEach(d => {
      const peso = d.peso || 1;
      const current = map.get(d.nome) || {
        name: d.nome,
        baseRaw: 0,
        baseTotal: 0,
        basePoints: 0,
        baseMaxPoints: 0,
        weight: peso
      };

      current.targetRaw = d.acertos;
      current.targetTotal = d.total;
      current.targetPoints = d.acertos * peso;
      current.targetMaxPoints = d.total * peso;

      map.set(d.nome, current);
    });

    return Array.from(map.values()).map(item => {
      const diff = item.targetPoints - item.basePoints;
      const basePerc = item.baseTotal > 0 ? (item.baseRaw / item.baseTotal) * 100 : 0;
      const targetPerc = item.targetTotal > 0 ? (item.targetRaw / item.targetTotal) * 100 : 0;

      let status = 'stable';
      if (item.baseTotal === 0 && item.targetTotal > 0) status = 'new';
      else if (item.baseTotal > 0 && item.targetTotal === 0) status = 'removed';
      else if (diff > 0.5) status = 'growth';
      else if (diff < -0.5) status = 'drop';

      return {
        ...item,
        diff,
        basePerc,
        targetPerc,
        status,
        relevance: Math.abs(diff) + (item.weight * 2)
      };
    }).sort((a, b) => b.relevance - a.relevance);
  }, [base, target]);

  const radarData = allDisciplines.slice(0, 7).map(d => ({
    subject: d.name,
    valA: d.basePerc,
    valB: d.targetPerc
  }));

  const topDrops = useMemo(() => {
    return allDisciplines
      .filter(d => d.diff < -0.5)
      .sort((a, b) => a.diff - b.diff)
      .slice(0, 4);
  }, [allDisciplines]);

  const topGrowth = useMemo(() => {
    return allDisciplines
      .filter(d => d.diff > 0.5)
      .sort((a, b) => b.diff - a.diff)
      .slice(0, 4);
  }, [allDisciplines]);

  return (
    <div className="fixed inset-0 z-[70] bg-zinc-100/95 dark:bg-black/95 backdrop-blur-xl flex items-center justify-center p-3 md:p-4 animate-fade-in overflow-hidden">
      <div className="bg-white dark:bg-zinc-950 w-full max-w-7xl h-[94vh] md:h-[92vh] rounded-[1.5rem] md:rounded-[2rem] shadow-2xl border border-zinc-200 dark:border-zinc-800 flex flex-col relative overflow-hidden">

        {/* HEADER */}
        <div className="p-4 md:p-6 border-b border-zinc-100 dark:border-zinc-800 bg-white/50 dark:bg-zinc-900/50 backdrop-blur-sm flex justify-between items-center z-20">
          <div className="flex items-center gap-3 md:gap-4 min-w-0">
            <div className="p-2.5 md:p-3 bg-blue-50 dark:bg-blue-900/20 rounded-2xl text-blue-600 border border-blue-100 dark:border-blue-800 shrink-0">
              <TrendingUp size={24} className="md:hidden" />
              <TrendingUp size={28} className="hidden md:block" />
            </div>

            <div className="min-w-0">
              <h2 className="text-lg md:text-2xl font-black text-zinc-800 dark:text-white uppercase tracking-tight truncate">
                Análise Evolutiva
              </h2>

              <div className="flex items-center gap-2 text-xs md:text-sm text-zinc-500 flex-wrap">
                <span className="flex items-center gap-1 bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 rounded text-zinc-600 dark:text-zinc-300 font-bold">
                  <Calendar size={10} /> {formatDate(base.data)}
                </span>
                <ArrowRightIcon />
                <span className="flex items-center gap-1 bg-blue-50 dark:bg-blue-900/30 px-2 py-0.5 rounded text-blue-700 dark:text-blue-400 font-bold border border-blue-100 dark:border-blue-800">
                  <Calendar size={10} /> {formatDate(target.data)}
                </span>
              </div>

              {/* TÍTULOS (sem base/alvo) */}
              <div className="mt-2 flex items-center gap-2 flex-wrap">
                <span className="text-[10px] md:text-xs font-black bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 px-2.5 py-1 rounded-full truncate max-w-[13rem] md:max-w-none">
                  {base.titulo}
                </span>
                <ArrowRightIcon size={14} className="text-zinc-400" />
                <span className="text-[10px] md:text-xs font-black bg-blue-600 text-white px-2.5 py-1 rounded-full truncate max-w-[13rem] md:max-w-none">
                  {target.titulo}
                </span>
              </div>
            </div>
          </div>

          <button onClick={onClose} className="p-2.5 md:p-3 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-full transition-colors group">
            <X size={22} className="text-zinc-400 group-hover:text-red-500 transition-colors" />
          </button>
        </div>

        {/* ABAS DE ALVO (multi) */}
        {targets.length > 1 && (
          <div className="px-4 md:px-6 py-3 border-b border-zinc-100 dark:border-zinc-800 bg-white/40 dark:bg-zinc-900/30">
            <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
              <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400 mr-2 shrink-0">
                Comparar com:
              </span>
              {targets.map(t => {
                const active = t.id === activeTargetId;
                return (
                  <button
                    key={t.id}
                    onClick={() => setActiveTargetId(t.id)}
                    className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-black border transition-all ${
                      active
                        ? 'bg-blue-600 text-white border-blue-600 shadow-lg shadow-blue-600/20'
                        : 'bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-300 border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-900/60'
                    }`}
                    title={`${t.titulo} • ${formatDate(t.data)}`}
                  >
                    {t.titulo}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* CONTEÚDO */}
        <div className="flex-1 overflow-y-auto custom-scrollbar bg-zinc-50/50 dark:bg-zinc-950/50 p-4 md:p-6">

          {/* SECTION 1 */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 md:gap-6 mb-6 md:mb-8">
            {/* KPI: Variação Líquida */}
            <div className="lg:col-span-3 flex flex-col gap-4">
              <div className={`p-4 md:p-6 rounded-3xl border flex flex-col items-center justify-center text-center shadow-sm relative overflow-hidden ${
                isPositive
                  ? 'bg-emerald-50 border-emerald-100 dark:bg-emerald-900/10 dark:border-emerald-800'
                  : 'bg-red-50 border-red-100 dark:bg-red-900/10 dark:border-red-800'
              }`}>
                <div className="relative z-10">
                  <span className={`text-[10px] md:text-xs font-bold uppercase tracking-widest mb-2 md:mb-3 block ${
                    isPositive ? 'text-emerald-700' : 'text-red-700'
                  }`}>
                    Variação Líquida
                  </span>

                  <div className="flex items-center justify-center gap-1">
                    <span className={`text-4xl md:text-6xl font-black tracking-tighter ${
                      isPositive ? 'text-emerald-600' : 'text-red-600'
                    }`}>
                      {isPositive ? '+' : ''}{deltaPontos.toFixed(1)}
                    </span>
                  </div>

                  <div className={`inline-flex items-center gap-1 mt-2 md:mt-3 px-3 py-1 rounded-full text-[11px] md:text-xs font-bold ${
                    isPositive ? 'bg-emerald-200/50 text-emerald-800' : 'bg-red-200/50 text-red-800'
                  }`}>
                    {isPositive ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                    {Math.abs(growthPerc).toFixed(1)}% {isPositive ? 'Crescimento' : 'Retração'}
                  </div>
                </div>

                <div className={`absolute -right-4 -bottom-4 opacity-10 transform rotate-12 ${
                  isPositive ? 'text-emerald-600' : 'text-red-600'
                }`}>
                  <Activity size={120} />
                </div>
              </div>

              {/* Cards: negativas e positivas */}
              <div className="grid grid-cols-2 lg:grid-cols-1 gap-3">
                <div className="p-4 rounded-3xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm">
                  <h4 className="text-[10px] font-bold text-zinc-400 uppercase mb-2 flex items-center gap-2">
                    <AlertTriangle size={14} className="text-red-500" /> Atenção
                  </h4>
                  {topDrops.length === 0 ? (
                    <p className="text-xs text-zinc-500">Nenhuma queda relevante 🎯</p>
                  ) : (
                    <div className="space-y-2">
                      {topDrops.map((d, i) => (
                        <div key={i} className="flex items-center justify-between gap-2">
                          <span className="text-xs font-bold text-zinc-700 dark:text-zinc-200 truncate">{d.name}</span>
                          <span className="text-xs font-black text-red-600 shrink-0">{d.diff.toFixed(1)} pts</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="p-4 rounded-3xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm">
                  <h4 className="text-[10px] font-bold text-zinc-400 uppercase mb-2 flex items-center gap-2">
                    <Zap size={14} className="text-emerald-500" /> Positivas
                  </h4>
                  {topGrowth.length === 0 ? (
                    <p className="text-xs text-zinc-500">Sem ganhos relevantes ainda 👊</p>
                  ) : (
                    <div className="space-y-2">
                      {topGrowth.map((d, i) => (
                        <div key={i} className="flex items-center justify-between gap-2">
                          <span className="text-xs font-bold text-zinc-700 dark:text-zinc-200 truncate">{d.name}</span>
                          <span className="text-xs font-black text-emerald-600 shrink-0">+{d.diff.toFixed(1)} pts</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Radar (mobile menor) */}
            <div className="lg:col-span-5 bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-200 dark:border-zinc-800 shadow-sm p-2 flex flex-col items-center justify-center relative min-h-[260px] md:min-h-[400px]">
              <div className="absolute top-4 md:top-6 left-4 md:left-6 z-10">
                <h3 className="font-bold text-zinc-800 dark:text-white flex items-center gap-2">
                  <Target className="text-purple-500" size={18} /> Radar
                </h3>
                <p className="text-[11px] md:text-xs text-zinc-500 mt-1">Aproveitamento por disciplina</p>
              </div>

              <div className="w-full h-full p-2 md:p-4">
                <SimpleRadarChart
                  data={radarData}
                  colorA="#9ca3af"
                  colorB="#2563eb"
                  labelA={base.titulo}
                  labelB={target.titulo}
                />
              </div>
            </div>

            {/* Destaques (compacto) */}
            <div className="lg:col-span-4 flex flex-col gap-4">
              <div className="flex-1 bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-200 dark:border-zinc-800 shadow-sm p-4 md:p-6 overflow-hidden relative">
                <h4 className="text-[10px] md:text-xs font-bold text-zinc-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                  <Zap size={14} className="text-amber-500" /> Destaques
                </h4>

                <div className="space-y-3 relative z-10">
                  {topGrowth[0] && (
                    <div className="flex items-start gap-3 p-3 rounded-2xl bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-100 dark:border-emerald-800/30">
                      <div className="p-2 bg-emerald-100 dark:bg-emerald-800 rounded-lg text-emerald-700 dark:text-emerald-300">
                        <ArrowUpRight size={18} />
                      </div>
                      <div className="min-w-0">
                        <p className="text-[10px] font-bold text-emerald-600 uppercase">Maior ganho</p>
                        <p className="font-bold text-zinc-800 dark:text-white text-sm truncate">{topGrowth[0].name}</p>
                        <p className="text-xs font-bold text-emerald-600 mt-0.5">+{topGrowth[0].diff.toFixed(1)} pts</p>
                      </div>
                    </div>
                  )}

                  {topDrops[0] && (
                    <div className="flex items-start gap-3 p-3 rounded-2xl bg-red-50 dark:bg-red-900/10 border border-red-100 dark:border-red-800/30">
                      <div className="p-2 bg-red-100 dark:bg-red-800 rounded-lg text-red-700 dark:text-red-300">
                        <ArrowDownRight size={18} />
                      </div>
                      <div className="min-w-0">
                        <p className="text-[10px] font-bold text-red-600 uppercase">Maior queda</p>
                        <p className="font-bold text-zinc-800 dark:text-white text-sm truncate">{topDrops[0].name}</p>
                        <p className="text-xs font-bold text-red-600 mt-0.5">{topDrops[0].diff.toFixed(1)} pts</p>
                      </div>
                    </div>
                  )}

                  {(!topGrowth[0] && !topDrops[0]) && (
                    <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-950/40 border border-zinc-200 dark:border-zinc-800 text-sm text-zinc-500">
                      Sem variações relevantes — continue registrando.
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* SECTION 2: Detalhamento por disciplina */}
          <div className="bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-200 dark:border-zinc-800 shadow-sm overflow-hidden">
            <div className="p-4 md:p-6 border-b border-zinc-100 dark:border-zinc-800 flex flex-col md:flex-row md:justify-between md:items-center gap-2">
              <h3 className="font-black text-base md:text-lg text-zinc-800 dark:text-white flex items-center gap-2">
                <Layers className="text-blue-500" size={20} /> Detalhamento
              </h3>
              <div className="text-[11px] md:text-xs font-medium text-zinc-500">
                Ordenado por relevância
              </div>
            </div>

            {/* MOBILE: tabela compacta (pedido) */}
            <div className="md:hidden">
              <div className="grid grid-cols-12 gap-2 px-4 py-3 bg-zinc-50 dark:bg-zinc-950 text-[10px] font-black uppercase tracking-wider text-zinc-400">
                <div className="col-span-6">Disciplina</div>
                <div className="col-span-2 text-center">% {base.titulo?.slice(0, 6)}</div>
                <div className="col-span-2 text-center">% {target.titulo?.slice(0, 6)}</div>
                <div className="col-span-2 text-right">Δ pts</div>
              </div>

              <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {allDisciplines.map((d, i) => (
                  <div key={i} className="px-4 py-3">
                    <div className="grid grid-cols-12 gap-2 items-center">
                      <div className="col-span-6 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase border ${getStatusColor(d.status)}`}>
                            {d.status === 'growth' ? 'Up' : d.status === 'drop' ? 'Down' : d.status === 'new' ? 'New' : 'Ok'}
                          </span>
                          <span className="text-xs font-bold text-zinc-800 dark:text-zinc-100 truncate">{d.name}</span>
                        </div>
                      </div>

                      <div className="col-span-2 text-center text-xs font-bold text-zinc-600 dark:text-zinc-300">
                        {Math.round(d.basePerc)}%
                      </div>
                      <div className="col-span-2 text-center text-xs font-bold text-blue-600 dark:text-blue-400">
                        {Math.round(d.targetPerc)}%
                      </div>

                      <div className={`col-span-2 text-right text-xs font-black ${
                        d.diff > 0 ? 'text-emerald-600' : d.diff < 0 ? 'text-red-600' : 'text-zinc-400'
                      }`}>
                        {d.diff > 0 ? '+' : ''}{d.diff.toFixed(1)}
                      </div>
                    </div>

                    <div className="mt-2 flex items-center justify-between text-[11px] text-zinc-500">
                      <span>Peso <b className="text-zinc-700 dark:text-zinc-300">{d.weight}</b></span>
                      <span className="text-zinc-500">
                        {d.targetRaw}/{d.targetTotal} acertos
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* DESKTOP: mantém visual detalhado */}
            <div className="hidden md:block divide-y divide-zinc-100 dark:divide-zinc-800">
              {allDisciplines.map((item, idx) => (
                <div key={idx} className="p-4 hover:bg-zinc-50 dark:hover:bg-zinc-900/50 transition-colors group">
                  <div className="flex flex-col md:flex-row gap-4 items-center">
                    <div className="flex-1 w-full md:w-auto min-w-0 md:min-w-[250px]">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase border ${getStatusColor(item.status)}`}>
                          {item.status === 'growth' ? 'Evolução' : item.status === 'drop' ? 'Queda' : item.status === 'new' ? 'Nova' : 'Estável'}
                        </span>
                        <h4 className="font-bold text-sm text-zinc-700 dark:text-zinc-200 truncate" title={item.name}>
                          {item.name}
                        </h4>
                      </div>

                      <div className="flex items-center gap-3 text-[11px] text-zinc-500 flex-wrap">
                        <span className="flex items-center gap-1">
                          Peso <b className="text-zinc-700 dark:text-zinc-300">{item.weight}</b>
                        </span>
                        <span className="w-1 h-1 rounded-full bg-zinc-300 hidden md:inline-block" />
                        <span className="truncate">
                          <b className="text-zinc-700 dark:text-zinc-300">{base.titulo}:</b> {item.basePoints.toFixed(1)}
                        </span>
                        <ArrowRightIcon size={10} />
                        <span className="truncate text-blue-600 dark:text-blue-400">
                          <b>{target.titulo}:</b> {item.targetPoints.toFixed(1)}
                        </span>
                      </div>
                    </div>

                    <div className="flex-[2] w-full md:w-auto px-1 md:px-2">
                      <div className="flex justify-between mb-1.5">
                        <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wide">Progresso</span>
                        <span className={`text-xs font-bold ${item.diff > 0 ? 'text-emerald-600' : item.diff < 0 ? 'text-red-600' : 'text-zinc-400'}`}>
                          {item.diff > 0 ? '+' : ''}{item.diff.toFixed(1)} pts
                        </span>
                      </div>

                      <div className="h-3 w-full bg-zinc-100 dark:bg-zinc-800 rounded-full relative overflow-hidden">
                        <div
                          className="absolute top-0 left-0 bottom-0 bg-zinc-400 dark:bg-zinc-600 opacity-30 z-10 border-r border-white dark:border-zinc-900"
                          style={{ width: `${item.basePerc}%` }}
                        />
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${item.targetPerc}%` }}
                          transition={{ duration: 1, delay: 0.2 }}
                          className={`absolute top-0 left-0 bottom-0 z-20 opacity-90 ${
                            item.status === 'growth' ? 'bg-emerald-500' :
                            item.status === 'drop' ? 'bg-red-500' :
                            item.status === 'new' ? 'bg-blue-500' :
                            'bg-zinc-400'
                          }`}
                        />
                      </div>
                    </div>

                    <div className="w-full md:w-32 flex justify-between md:flex-col md:items-end gap-1 border-t md:border-t-0 border-zinc-100 pt-2 md:pt-0">
                      <div className="text-right">
                        <span className="text-[9px] font-bold text-zinc-400 uppercase block">Acertos</span>
                        <span className="text-xs font-bold text-zinc-700 dark:text-zinc-300">
                          {item.targetRaw} <span className="text-zinc-400">/ {item.targetTotal}</span>
                        </span>
                      </div>
                    </div>

                  </div>
                </div>
              ))}
            </div>

          </div>
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// MODAL: NOVO REGISTRO (sem "geral/manual" + valida duplicados)
// ============================================================================

const NovoSimuladoModal = ({ isOpen, onClose, onSave, disciplinasSugestivas }) => {
  const DRAFT_KEY = 'simulado_draft_v7_ultra';

  const [titulo, setTitulo] = useState('');
  const [banca, setBanca] = useState('');
  const [data, setData] = useState(new Date().toISOString().split('T')[0]);
  const [disciplinas, setDisciplinas] = useState([]);
  const [draftLoaded, setDraftLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('details'); // details | subjects

  const initDisciplinas = () => {
    const baseObj = { _id: Date.now(), nome: '', questoes: '', acertos: '', branco: '', peso: 1 };
    if (disciplinasSugestivas?.length > 0) {
      setDisciplinas(disciplinasSugestivas.map((d, i) => ({
        ...baseObj,
        _id: Date.now() + i,
        nome: d.nome || d.disciplinaNome || ''
      })));
    } else {
      setDisciplinas([baseObj]);
    }
  };

  useEffect(() => {
    if (isOpen) {
      const savedDraft = localStorage.getItem(DRAFT_KEY);
      if (savedDraft) {
        try {
          const parsed = JSON.parse(savedDraft);
          const hasData = parsed.titulo || parsed.banca || (parsed.disciplinas && parsed.disciplinas.some(d => d.nome || d.questoes));
          if (hasData) {
            setTitulo(parsed.titulo || '');
            setBanca(parsed.banca || '');
            setData(parsed.data || new Date().toISOString().split('T')[0]);
            setDisciplinas(parsed.disciplinas || []);
            setDraftLoaded(true);
            return;
          }
        } catch (e) { console.error("Erro ao ler draft", e); }
      }
      initDisciplinas();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) {
      const payload = { titulo, banca, data, disciplinas };
      const isDirty = titulo || banca || disciplinas.some(d => d.nome || d.questoes);
      if (isDirty) localStorage.setItem(DRAFT_KEY, JSON.stringify(payload));
    }
  }, [titulo, banca, data, disciplinas, isOpen]);

  const handleDiscardDraft = () => {
    localStorage.removeItem(DRAFT_KEY);
    setTitulo('');
    setBanca('');
    setDraftLoaded(false);
    initDisciplinas();
  };

  const handleChange = (idx, field, val) => {
    const arr = [...disciplinas];
    arr[idx][field] = val;
    setDisciplinas(arr);
  };

  const addMateria = () => setDisciplinas([{ _id: Date.now(), nome: '', questoes: '', acertos: '', branco: '', peso: 1 }, ...disciplinas]);
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
    const validas = disciplinas
      .map(d => ({ ...d, nome: (d.nome || '').trim() }))
      .filter(d => d.nome && Number(d.questoes) > 0);

    if (!titulo || !data || validas.length === 0) {
      return alert("Preencha Título, Data e pelo menos uma disciplina válida.");
    }

    for (let d of validas) {
      if ((Number(d.acertos) + Number(d.branco)) > Number(d.questoes)) {
        return alert(`Erro em "${d.nome}": A soma de Acertos + Brancos não pode ser maior que o total de Questões.`);
      }
    }

    const seen = new Set();
    for (let d of validas) {
      const k = normName(d.nome);
      if (seen.has(k)) {
        return alert(`Disciplina duplicada: "${d.nome}". Remova/renomeie para não repetir disciplinas no mesmo simulado.`);
      }
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
    localStorage.removeItem(DRAFT_KEY);
    setLoading(false);
    onClose();

    setTitulo('');
    setDisciplinas([]);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-3 md:p-4 bg-black/80 backdrop-blur-md animate-fade-in">
      <div className="bg-white dark:bg-zinc-950 rounded-2xl shadow-2xl border border-zinc-200 dark:border-zinc-800 w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden relative">

        <AnimatePresence>
          {draftLoaded && (
            <motion.div
              initial={{ y: -40 }}
              animate={{ y: 0 }}
              exit={{ y: -40 }}
              className="bg-blue-600 text-white px-4 py-1 text-[10px] font-bold uppercase tracking-wider text-center flex items-center justify-center gap-2 absolute top-0 w-full z-50 shadow-md"
            >
              <RotateCcw size={10} /> Rascunho automático recuperado
            </motion.div>
          )}
        </AnimatePresence>

        <div className={`p-4 md:p-6 border-b border-zinc-100 dark:border-zinc-800 flex justify-between items-center ${draftLoaded ? 'mt-4' : ''}`}>
          <div className="flex items-center gap-3 md:gap-4">
            <div className="w-11 h-11 md:w-12 md:h-12 bg-red-100 dark:bg-red-900/20 text-red-600 rounded-2xl flex items-center justify-center">
              <Plus size={22} />
            </div>
            <div>
              <h2 className="text-lg md:text-xl font-black text-zinc-900 dark:text-white uppercase tracking-tight">Novo Simulado</h2>
              <p className="text-[11px] md:text-xs text-zinc-500">Registre seu desempenho com precisão.</p>
            </div>
          </div>

          <button onClick={onClose} className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-full text-zinc-400 transition-colors">
            <X size={22} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 md:p-6 bg-zinc-50/50 dark:bg-zinc-900/50 custom-scrollbar">
          <div className="flex gap-2 mb-5 border-b border-zinc-200 dark:border-zinc-700 pb-1">
            <button
              onClick={() => setActiveTab('details')}
              className={`pb-2 px-3 md:px-4 text-sm font-bold border-b-2 transition-colors ${
                activeTab === 'details' ? 'border-red-500 text-red-600' : 'border-transparent text-zinc-400 hover:text-zinc-600'
              }`}
            >
              Dados Básicos
            </button>
            <button
              onClick={() => setActiveTab('subjects')}
              className={`pb-2 px-3 md:px-4 text-sm font-bold border-b-2 transition-colors ${
                activeTab === 'subjects' ? 'border-red-500 text-red-600' : 'border-transparent text-zinc-400 hover:text-zinc-600'
              }`}
            >
              Disciplinas & Notas
            </button>
          </div>

          {activeTab === 'details' && (
            <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} className="space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                <div className="md:col-span-2">
                  <label className="block text-xs font-bold text-zinc-500 uppercase mb-1">Título do Simulado</label>
                  <input
                    value={titulo}
                    onChange={e => setTitulo(e.target.value)}
                    className="w-full p-3 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 focus:ring-2 focus:ring-red-500 outline-none transition-all font-semibold"
                    placeholder="Ex: Simulado PMBA 2025 - Estratégia"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-zinc-500 uppercase mb-1">Banca Organizadora</label>
                  <input
                    value={banca}
                    onChange={e => setBanca(e.target.value)}
                    className="w-full p-3 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 focus:ring-2 focus:ring-red-500 outline-none transition-all font-semibold"
                    placeholder="Ex: FCC, Cebraspe..."
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-zinc-500 uppercase mb-1">Data de Realização</label>
                  <input
                    type="date"
                    value={data}
                    onChange={e => setData(e.target.value)}
                    className="w-full p-3 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 focus:ring-2 focus:ring-red-500 outline-none transition-all font-semibold"
                  />
                </div>
              </div>

              <div className="p-4 bg-blue-50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-800 rounded-xl flex items-start gap-3">
                <Lightbulb className="text-blue-500 mt-1" size={18} />
                <div>
                  <p className="text-sm font-bold text-blue-700 dark:text-blue-300">Dica</p>
                  <p className="text-xs text-blue-600/80 dark:text-blue-400">
                    Depois de preencher os dados básicos, vá para “Disciplinas” e lance as notas.
                  </p>
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'subjects' && (
            <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}>
              <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-3 mb-4">
                <div className="text-[11px] text-zinc-500">
                  Dica: não repita disciplinas — o sistema bloqueia duplicados.
                </div>

                <button
                  onClick={addMateria}
                  className="flex items-center justify-center gap-1 bg-red-100 text-red-600 hover:bg-red-200 px-3 py-2 rounded-lg text-xs font-bold transition-colors"
                >
                  <Plus size={14} /> Adicionar Linha
                </button>
              </div>

              <div className="hidden md:grid grid-cols-12 gap-2 px-2 text-[10px] font-bold text-zinc-400 uppercase tracking-wider text-center">
                <div className="col-span-4 text-left pl-2">Disciplina</div>
                <div className="col-span-2">Questões</div>
                <div className="col-span-2 text-emerald-600">Acertos</div>
                <div className="col-span-2">Branco</div>
                <div className="col-span-1 text-amber-600">Peso</div>
                <div className="col-span-1"></div>
              </div>

              <div className="space-y-3">
                <AnimatePresence>
                  {disciplinas.map((disc, idx) => {
                    const isError = (Number(disc.acertos) + Number(disc.branco)) > Number(disc.questoes) && Number(disc.questoes) > 0;
                    const k = normName(disc.nome);
                    const isDup = k && (dupMap.get(k) || 0) > 1;

                    return (
                      <motion.div
                        key={disc._id}
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className={`rounded-xl border transition-colors shadow-sm ${
                          isError ? 'bg-red-50 border-red-300' :
                          isDup ? 'bg-amber-50 border-amber-300' :
                          'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800'
                        }`}
                      >
                        {/* Desktop row */}
                        <div className="hidden md:grid grid-cols-12 gap-2 items-center p-2">
                          <div className="col-span-4 relative">
                            <input
                              list={`sug-${idx}`}
                              value={disc.nome}
                              onChange={e => handleChange(idx, 'nome', e.target.value)}
                              className={`w-full bg-transparent border rounded-lg px-2 py-1.5 text-sm font-semibold outline-none ${
                                isDup ? 'border-amber-400 focus:border-amber-500' : 'border-zinc-200 dark:border-zinc-700 focus:border-zinc-400'
                              }`}
                              placeholder="Matéria..."
                            />
                            <datalist id={`sug-${idx}`}>
                              {disciplinasSugestivas?.map((s, i) => <option key={i} value={s.nome || s.disciplinaNome} />)}
                            </datalist>
                            {isDup && (
                              <p className="text-[10px] font-bold text-amber-700 mt-1 pl-1">
                                Disciplina repetida — ajuste o nome.
                              </p>
                            )}
                          </div>

                          <div className="col-span-2">
                            <input
                              type="number"
                              value={disc.questoes}
                              onChange={e => handleChange(idx, 'questoes', e.target.value)}
                              className="w-full text-center bg-zinc-50 dark:bg-zinc-800 border-none rounded-lg py-1.5 text-sm font-bold outline-none"
                              placeholder="0"
                            />
                          </div>

                          <div className="col-span-2">
                            <input
                              type="number"
                              value={disc.acertos}
                              onChange={e => handleChange(idx, 'acertos', e.target.value)}
                              className="w-full text-center bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 border border-emerald-100 dark:border-emerald-800 rounded-lg py-1.5 text-sm font-black outline-none"
                              placeholder="0"
                            />
                          </div>

                          <div className="col-span-2">
                            <input
                              type="number"
                              value={disc.branco}
                              onChange={e => handleChange(idx, 'branco', e.target.value)}
                              className="w-full text-center bg-zinc-50 dark:bg-zinc-800 border-none rounded-lg py-1.5 text-sm outline-none"
                              placeholder="0"
                            />
                          </div>

                          <div className="col-span-1">
                            <input
                              type="number"
                              value={disc.peso}
                              onChange={e => handleChange(idx, 'peso', e.target.value)}
                              className="w-full text-center bg-amber-50 dark:bg-amber-900/20 text-amber-600 border border-amber-100 dark:border-amber-800 rounded-lg py-1.5 text-xs font-bold outline-none"
                              placeholder="1"
                            />
                          </div>

                          <div className="col-span-1 flex justify-center">
                            <button onClick={() => removeMateria(idx)} className="text-zinc-300 hover:text-red-500 transition-colors">
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </div>

                        {/* Mobile card */}
                        <div className="md:hidden p-3">
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex-1">
                              <label className="block text-[10px] font-black uppercase tracking-wider text-zinc-400 mb-1">
                                Disciplina
                              </label>
                              <input
                                list={`sug-m-${idx}`}
                                value={disc.nome}
                                onChange={e => handleChange(idx, 'nome', e.target.value)}
                                className={`w-full bg-white/60 dark:bg-zinc-950/40 border rounded-lg px-3 py-2 text-sm font-semibold outline-none ${
                                  isDup ? 'border-amber-400 focus:border-amber-500' : 'border-zinc-200 dark:border-zinc-700 focus:border-zinc-400'
                                }`}
                                placeholder="Ex: Português"
                              />
                              <datalist id={`sug-m-${idx}`}>
                                {disciplinasSugestivas?.map((s, i) => <option key={i} value={s.nome || s.disciplinaNome} />)}
                              </datalist>
                              {isDup && (
                                <p className="text-[10px] font-bold text-amber-700 mt-1">
                                  Disciplina repetida — ajuste o nome.
                                </p>
                              )}
                              {isError && (
                                <p className="text-[10px] font-bold text-red-700 mt-1">
                                  Acertos + branco maior que questões.
                                </p>
                              )}
                            </div>

                            <button
                              onClick={() => removeMateria(idx)}
                              className="p-2 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-400 hover:text-red-500 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
                              title="Remover"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>

                          <div className="grid grid-cols-2 gap-3 mt-3">
                            <div>
                              <label className="block text-[10px] font-black uppercase tracking-wider text-zinc-400 mb-1">
                                Questões
                              </label>
                              <input
                                type="number"
                                value={disc.questoes}
                                onChange={e => handleChange(idx, 'questoes', e.target.value)}
                                className="w-full text-center bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg py-2 text-sm font-bold outline-none"
                                placeholder="0"
                              />
                            </div>

                            <div>
                              <label className="block text-[10px] font-black uppercase tracking-wider text-zinc-400 mb-1">
                                Peso
                              </label>
                              <input
                                type="number"
                                value={disc.peso}
                                onChange={e => handleChange(idx, 'peso', e.target.value)}
                                className="w-full text-center bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800 rounded-lg py-2 text-sm font-black outline-none"
                                placeholder="1"
                              />
                            </div>

                            <div>
                              <label className="block text-[10px] font-black uppercase tracking-wider text-zinc-400 mb-1">
                                Acertos
                              </label>
                              <input
                                type="number"
                                value={disc.acertos}
                                onChange={e => handleChange(idx, 'acertos', e.target.value)}
                                className="w-full text-center bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 rounded-lg py-2 text-sm font-black outline-none"
                                placeholder="0"
                              />
                            </div>

                            <div>
                              <label className="block text-[10px] font-black uppercase tracking-wider text-zinc-400 mb-1">
                                Branco
                              </label>
                              <input
                                type="number"
                                value={disc.branco}
                                onChange={e => handleChange(idx, 'branco', e.target.value)}
                                className="w-full text-center bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg py-2 text-sm font-bold outline-none"
                                placeholder="0"
                              />
                            </div>
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

        {/* Footer: Totais e ações */}
        <div className="bg-white dark:bg-zinc-950 border-t border-zinc-200 dark:border-zinc-800 p-3 md:p-4 relative z-20">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mb-3 md:mb-4">
            <div className="text-center bg-zinc-50 dark:bg-zinc-900/50 rounded-xl py-2">
              <span className="text-[9px] font-bold text-zinc-400 uppercase">Questões</span>
              <p className="text-lg font-bold text-zinc-700 dark:text-white">{totais.tQuestoes}</p>
            </div>

            <div className="text-center bg-emerald-50 dark:bg-emerald-900/10 rounded-xl py-2">
              <span className="text-[9px] font-bold text-emerald-500 uppercase">Acertos</span>
              <p className="text-lg font-bold text-emerald-600">{totais.tAcertos}</p>
            </div>

            <div className="hidden md:block text-center bg-zinc-50 dark:bg-zinc-900/50 rounded-xl py-2">
              <span className="text-[9px] font-bold text-zinc-400 uppercase">Pontos Possíveis</span>
              <p className="text-lg font-bold text-zinc-500">{totais.tPontosPossiveis}</p>
            </div>

            <div className="text-center bg-zinc-900 dark:bg-zinc-100 rounded-xl flex flex-col justify-center shadow-lg py-2">
              <span className="text-[9px] font-bold text-zinc-400 dark:text-zinc-500 uppercase">Pontos</span>
              <p className="text-xl font-black text-white dark:text-zinc-900">{totais.tPontosObtidos.toFixed(1)}</p>
            </div>
          </div>

          <div className="flex justify-between items-center pt-1">
            <div className="flex-1">
              {draftLoaded && (
                <button onClick={handleDiscardDraft} className="text-xs text-red-500 font-bold hover:underline flex items-center gap-1">
                  <Trash2 size={12} /> Descartar Rascunho
                </button>
              )}
            </div>

            <div className="flex gap-2 md:gap-3">
              <button onClick={onClose} disabled={loading} className="px-4 md:px-6 py-2.5 md:py-3 rounded-xl text-sm font-bold text-zinc-500 hover:bg-zinc-100 transition-colors">
                Cancelar
              </button>

              <button
                onClick={handleSave}
                disabled={loading}
                className="px-5 md:px-8 py-2.5 md:py-3 rounded-xl text-sm font-bold text-white bg-red-600 hover:bg-red-700 shadow-lg shadow-red-600/30 transition-all flex items-center gap-2"
              >
                {loading
                  ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  : (<><Save size={18} /> Salvar</>)
                }
              </button>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};

// ============================================================================
// LINHA EXPANSÍVEL
// - Mobile: lista bem compacta (acertos/pontos alinhados ao lado) (pedido)
// - Detalhes: tabela compacta no mobile (pedido)
// - Ações: Editar + Excluir lado a lado e menores (pedido)
// ============================================================================

const SimuladoTableRow = ({ item, onDeleteRequest, onEditRequest, compareMode, isSelected, onToggleSelect }) => {
  const [expanded, setExpanded] = useState(false);
  const points = item.resumo.pontosObtidos || 0;
  const badgeColor = getScoreColor(item.resumo.porcentagem, 'bg');

  const stats = useMemo(() => {
    if (!item.disciplinas?.length) return null;

    const sorted = [...item.disciplinas].sort((a, b) => (b.acertos * b.peso) - (a.acertos * a.peso));
    const totalBrancos = item.disciplinas.reduce((acc, curr) => acc + (curr.branco || 0), 0);
    const totalRespondidas = item.resumo.totalQuestoes - totalBrancos;
    const precisao = totalRespondidas > 0 ? (item.resumo.totalAcertos / totalRespondidas) * 100 : 0;

    return {
      best: sorted[0],
      worst: sorted[sorted.length - 1],
      totalBrancos,
      precisao
    };
  }, [item]);

  const onRowClick = () => {
    if (compareMode) onToggleSelect();
    else setExpanded(!expanded);
  };

  return (
    <div className={`group transition-all duration-200 border-b border-zinc-100 dark:border-zinc-800 ${
      isSelected ? 'bg-blue-50 dark:bg-blue-900/10'
      : expanded ? 'bg-zinc-50 dark:bg-zinc-900/30'
      : 'bg-white dark:bg-zinc-900 hover:bg-zinc-50 dark:hover:bg-zinc-900/50'
    }`}>

      {/* MOBILE: super compacto (pedido) */}
      <div className="md:hidden px-4 py-3 cursor-pointer select-none" onClick={onRowClick}>
        <div className="flex items-start gap-3">
          {compareMode && (
            <div className={`mt-1 w-5 h-5 min-w-[20px] rounded-full border-2 flex items-center justify-center transition-all ${
              isSelected ? 'bg-blue-600 border-blue-600 text-white' : 'border-zinc-300 dark:border-zinc-600'
            }`}>
              {isSelected && <CheckCircle2 size={12} />}
            </div>
          )}

          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <div className="bg-zinc-100 dark:bg-zinc-800 rounded-lg px-2 py-1 text-center shrink-0">
                    <span className="block text-xs font-bold text-zinc-600">{item.data.split('-')[2]}</span>
                    <span className="block text-[9px] font-bold text-zinc-400 uppercase">
                      {new Date(item.data).toLocaleString('default', { month: 'short' })}
                    </span>
                  </div>

                  <div className="min-w-0">
                    <span className="block font-black text-sm text-zinc-800 dark:text-zinc-100 truncate">
                      {item.titulo}
                    </span>
                    <span className="block text-[10px] text-zinc-400 font-bold uppercase tracking-wider truncate">
                      {item.banca || 'Sem banca'} • {item.resumo.totalQuestoes}q
                    </span>
                  </div>
                </div>
              </div>

              <div className="shrink-0 flex flex-col items-end gap-1">
                <div className={`px-2.5 py-1 rounded-full text-xs font-black ${badgeColor}`}>
                  {item.resumo.porcentagem ? item.resumo.porcentagem.toFixed(0) : 0}%
                </div>

                <div className="flex items-center gap-2 text-[11px] font-black">
                  <span className="text-emerald-600">A {item.resumo.totalAcertos}</span>
                  <span className={`text-zinc-800 dark:text-zinc-100 ${points < 0 ? 'text-red-500' : ''}`}>
                    P {points.toFixed(1)}
                  </span>
                </div>

                <div className="text-zinc-400">
                  {expanded ? <Minus size={18} /> : <ChevronDown size={18} />}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* DESKTOP */}
      <div className="hidden md:grid grid-cols-12 gap-4 p-4 items-center cursor-pointer select-none" onClick={onRowClick}>
        <div className="col-span-1 text-center">
          <div className="bg-zinc-100 dark:bg-zinc-800 rounded-lg p-1">
            <span className="block text-xs font-bold text-zinc-500">{item.data.split('-')[2]}</span>
            <span className="block text-[9px] font-bold text-zinc-400 uppercase">{new Date(item.data).toLocaleString('default', { month: 'short' })}</span>
          </div>
        </div>

        <div className="col-span-4 flex items-center gap-3 overflow-hidden">
          {compareMode && (
            <div className={`w-5 h-5 min-w-[20px] rounded-full border-2 flex items-center justify-center transition-all ${
              isSelected ? 'bg-blue-600 border-blue-600 text-white' : 'border-zinc-300 dark:border-zinc-600'
            }`}>
              {isSelected && <CheckCircle2 size={12} />}
            </div>
          )}

          <div className="truncate">
            <span className="block font-bold text-sm text-zinc-800 dark:text-zinc-200 truncate">{item.titulo}</span>
            <span className="flex items-center gap-2 text-[10px] text-zinc-400 font-bold uppercase tracking-wider">
              {item.banca || 'Sem Banca'}
              {item.resumo.totalQuestoes > 0 && <span className="w-1 h-1 rounded-full bg-zinc-300"></span>}
              {item.resumo.totalQuestoes} Questões
            </span>
          </div>
        </div>

        <div className="col-span-2 text-center flex flex-col items-center">
          <span className="text-xs font-bold text-emerald-600">{item.resumo.totalAcertos}</span>
          <span className="text-[9px] text-zinc-400 uppercase">Acertos</span>
        </div>

        <div className="col-span-2 text-center flex flex-col items-center">
          <span className={`text-xs font-bold ${points >= 0 ? 'text-zinc-700 dark:text-zinc-300' : 'text-red-500'}`}>{points.toFixed(1)}</span>
          <span className="text-[9px] text-zinc-400 uppercase">Pontos</span>
        </div>

        <div className="col-span-2 text-center flex justify-center">
          <div className={`px-3 py-1 rounded-full text-xs font-black ${badgeColor}`}>
            {item.resumo.porcentagem ? item.resumo.porcentagem.toFixed(0) : 0}%
          </div>
        </div>

        <div className="col-span-1 flex justify-center text-zinc-400">
          {expanded ? <Minus size={18} /> : <ChevronDown size={18} />}
        </div>
      </div>

      {/* Expansão (fora do compare mode) */}
      <AnimatePresence>
        {expanded && !compareMode && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950/50"
          >
            <div className="p-4 md:p-6">
              {stats && (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-4 mb-5 md:mb-6">
                  <div className="bg-white dark:bg-zinc-900 p-3 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow">
                    <div className="flex items-center gap-2 mb-2 text-emerald-500">
                      <Trophy size={16} />
                      <span className="text-[10px] font-bold text-zinc-400 uppercase">Destaque</span>
                    </div>
                    <div>
                      <p className="font-bold text-zinc-800 dark:text-white text-xs truncate" title={stats.best.nome}>{stats.best.nome}</p>
                      <p className="text-[10px] text-zinc-500">{(stats.best.acertos * stats.best.peso).toFixed(1)} pontos</p>
                    </div>
                  </div>

                  <div className="bg-white dark:bg-zinc-900 p-3 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow">
                    <div className="flex items-center gap-2 mb-2 text-red-500">
                      <AlertTriangle size={16} />
                      <span className="text-[10px] font-bold text-zinc-400 uppercase">Atenção</span>
                    </div>
                    <div>
                      <p className="font-bold text-zinc-800 dark:text-white text-xs truncate" title={stats.worst.nome}>{stats.worst.nome}</p>
                      <p className="text-[10px] text-zinc-500">{(stats.worst.acertos * stats.worst.peso).toFixed(1)} pontos</p>
                    </div>
                  </div>

                  <div className="bg-white dark:bg-zinc-900 p-3 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow">
                    <div className="flex items-center gap-2 mb-2 text-blue-500">
                      <Target size={16} />
                      <span className="text-[10px] font-bold text-zinc-400 uppercase">Precisão</span>
                    </div>
                    <div>
                      <p className="font-bold text-zinc-800 dark:text-white text-xl">{stats.precisao.toFixed(0)}%</p>
                      <p className="text-[10px] text-zinc-500">Nas respondidas</p>
                    </div>
                  </div>

                  {/* AÇÕES: Editar + Excluir lado a lado e menores (pedido) */}
                  <div className="bg-white dark:bg-zinc-900 p-3 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
                    <div className="text-[10px] font-bold text-zinc-400 uppercase mb-2">Ações</div>
                    <div className="flex gap-2">
                      <button
                        onClick={(e) => { e.stopPropagation(); onEditRequest(item); }}
                        className="flex-1 px-3 py-2 rounded-lg text-xs font-black bg-blue-600 hover:bg-blue-700 text-white shadow-sm flex items-center justify-center gap-2"
                      >
                        <Pencil size={14} /> Editar Simulado
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); onDeleteRequest(item); }}
                        className="flex-1 px-3 py-2 rounded-lg text-xs font-black bg-red-600 hover:bg-red-700 text-white shadow-sm flex items-center justify-center gap-2"
                      >
                        <Trash2 size={14} /> Excluir Simulado
                      </button>
                    </div>
                    <div className="mt-2 text-[10px] text-zinc-500">
                      Edita título, data, banca e disciplinas.
                    </div>
                  </div>
                </div>
              )}

              {/* Disciplinas: tabela compacta no mobile (pedido) */}
              <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden shadow-sm">
                <div className="hidden md:grid grid-cols-12 p-3 bg-zinc-100 dark:bg-zinc-800 text-[10px] font-bold text-zinc-500 uppercase tracking-wider text-center">
                  <div className="col-span-4 text-left pl-2">Disciplina</div>
                  <div className="col-span-1">Total</div>
                  <div className="col-span-1 text-emerald-600">Acertos</div>
                  <div className="col-span-1 text-red-500">Erros</div>
                  <div className="col-span-1 text-zinc-400">Branco</div>
                  <div className="col-span-1 text-amber-600">Peso</div>
                  <div className="col-span-1">Pts</div>
                  <div className="col-span-2">Aproveitamento</div>
                </div>

                {/* MOBILE HEADER */}
                <div className="md:hidden grid grid-cols-12 gap-2 px-4 py-3 bg-zinc-50 dark:bg-zinc-950 text-[10px] font-black uppercase tracking-wider text-zinc-400">
                  <div className="col-span-6">Disciplina</div>
                  <div className="col-span-2 text-center">A/T</div>
                  <div className="col-span-2 text-center">Pts</div>
                  <div className="col-span-2 text-right">%</div>
                </div>

                <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
                  {item.disciplinas.map((d, i) => {
                    const perc = d.total > 0 ? (d.acertos / d.total) * 100 : 0;
                    const erros = d.total - d.acertos - (d.branco || 0);
                    const pontos = d.acertos * (d.peso || 1);

                    return (
                      <div key={i} className="p-3 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors">
                        {/* MOBILE row compacta */}
                        <div className="md:hidden grid grid-cols-12 gap-2 items-center">
                          <div className="col-span-6 min-w-0">
                            <div className="text-xs font-bold text-zinc-800 dark:text-zinc-100 truncate">{d.nome}</div>
                            <div className="mt-1 text-[10px] text-zinc-500 flex items-center gap-2">
                              <span>Erros <b className="text-red-600">{erros}</b></span>
                              <span>Branco <b className="text-zinc-700 dark:text-zinc-300">{d.branco || 0}</b></span>
                              <span>Peso <b className="text-amber-600">{d.peso}</b></span>
                            </div>
                          </div>

                          <div className="col-span-2 text-center text-xs font-black text-zinc-700 dark:text-zinc-200">
                            {d.acertos}/{d.total}
                          </div>

                          <div className="col-span-2 text-center text-xs font-black text-zinc-800 dark:text-zinc-100">
                            {pontos.toFixed(1)}
                          </div>

                          <div className="col-span-2 text-right text-xs font-black text-zinc-600 dark:text-zinc-300">
                            {Math.round(perc)}%
                          </div>

                          <div className="col-span-12 mt-2 flex items-center gap-2">
                            <div className="flex-1 h-1.5 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full ${perc >= 80 ? 'bg-emerald-500' : perc >= 60 ? 'bg-amber-500' : 'bg-red-500'}`}
                                style={{ width: `${perc}%` }}
                              />
                            </div>
                          </div>
                        </div>

                        {/* DESKTOP row */}
                        <div className="hidden md:grid md:grid-cols-12 md:items-center md:text-center">
                          <div className="md:col-span-4 md:text-left md:pl-2 font-bold text-zinc-700 dark:text-zinc-300 truncate" title={d.nome}>
                            {d.nome}
                          </div>
                          <div className="md:col-span-1 text-zinc-500">{d.total}</div>
                          <div className="md:col-span-1 font-bold text-emerald-600">{d.acertos}</div>
                          <div className="md:col-span-1 font-bold text-red-500">{erros}</div>
                          <div className="md:col-span-1 text-zinc-400">{d.branco || 0}</div>
                          <div className="md:col-span-1 font-bold text-amber-600">{d.peso}</div>
                          <div className="md:col-span-1 font-black text-zinc-800 dark:text-white">{pontos.toFixed(1)}</div>
                          <div className="md:col-span-2 px-2 flex items-center gap-2">
                            <div className="flex-1 h-1.5 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full ${perc >= 80 ? 'bg-emerald-500' : perc >= 60 ? 'bg-amber-500' : 'bg-red-500'}`}
                                style={{ width: `${perc}%` }}
                              />
                            </div>
                            <span className="text-[10px] text-zinc-400 w-6 text-right">{Math.round(perc)}%</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// ============================================================================
// PÁGINA PRINCIPAL
// - Mobile: KPI “Recorde” e “Último” lado a lado (pedido)
// - Lista mobile compacta e organizada (feito no row)
// - Comparação N simulados (já)
// - Edição: modal e updateDoc (pedido)
// ============================================================================

const SimuladosPage = ({ user, activeCycleDisciplines }) => {
  const [simulados, setSimulados] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const [compareMode, setCompareMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState([]);
  const [showArena, setShowArena] = useState(false);

  const [deleteModal, setDeleteModal] = useState({ open: false, item: null });

  // EDIT
  const [editModal, setEditModal] = useState({ open: false, item: null });

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, 'users', user.uid, 'simulados'), orderBy('data', 'desc'));
    const unsub = onSnapshot(q, (snapshot) => {
      setSimulados(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });
    return () => unsub();
  }, [user]);

  const handleCreate = async (data) => {
    try {
      await addDoc(collection(db, 'users', user.uid, 'simulados'), {
        ...data,
        timestamp: Timestamp.now()
      });
    } catch (e) {
      alert("Erro ao salvar simulado.");
      console.error(e);
    }
  };

  const handleUpdate = async (simId, data) => {
    try {
      await updateDoc(doc(db, 'users', user.uid, 'simulados', simId), {
        ...data,
        updatedAt: Timestamp.now()
      });
    } catch (e) {
      alert("Erro ao atualizar simulado.");
      console.error(e);
    }
  };

  const confirmDelete = async () => {
    if (deleteModal.item) {
      try {
        await deleteDoc(doc(db, 'users', user.uid, 'simulados', deleteModal.item.id));
        setDeleteModal({ open: false, item: null });
        if (selectedIds.includes(deleteModal.item.id)) {
          setSelectedIds(prev => prev.filter(id => id !== deleteModal.item.id));
        }
      } catch (e) {
        alert("Erro ao excluir.");
      }
    }
  };

  const kpis = useMemo(() => {
    if (simulados.length === 0) return null;
    const totalSimulados = simulados.length;
    const scores = simulados.map(s => s.resumo?.pontosObtidos || 0);
    const mediaPontos = scores.reduce((acc, curr) => acc + curr, 0) / totalSimulados;
    const melhorNotaPontos = Math.max(...scores);
    const ultimo = simulados[0];
    let trend = 0;
    if (simulados.length > 1) {
      trend = (simulados[0].resumo?.pontosObtidos || 0) - (simulados[1].resumo?.pontosObtidos || 0);
    }
    return { totalSimulados, mediaPontos, melhorNotaPontos, ultimo, trend };
  }, [simulados]);

  const toggleSelection = (id) => {
    if (selectedIds.includes(id)) setSelectedIds(selectedIds.filter(i => i !== id));
    else setSelectedIds([...selectedIds, id]); // sem limite
  };

  const filteredSimulados = useMemo(() => {
    const term = searchTerm.toLowerCase();
    return simulados.filter(s => (s.titulo || '').toLowerCase().includes(term) || (s.banca || '').toLowerCase().includes(term));
  }, [simulados, searchTerm]);

  const selectedSimulados = useMemo(() => {
    const map = new Map(simulados.map(s => [s.id, s]));
    return selectedIds.map(id => map.get(id)).filter(Boolean);
  }, [selectedIds, simulados]);

  return (
    <div className="space-y-6 md:space-y-8 pb-20 animate-fade-in min-h-screen text-zinc-800 dark:text-zinc-200">

      <DeleteConfirmationModal
        isOpen={deleteModal.open}
        onClose={() => setDeleteModal({ open: false, item: null })}
        onConfirm={confirmDelete}
        item={deleteModal.item}
      />

      <NovoSimuladoModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={handleCreate}
        disciplinasSugestivas={activeCycleDisciplines || []}
      />

      <EditSimuladoModal
        isOpen={editModal.open}
        onClose={() => setEditModal({ open: false, item: null })}
        simulado={editModal.item}
        disciplinasSugestivas={activeCycleDisciplines || []}
        onSave={(payload) => handleUpdate(editModal.item.id, payload)}
      />

      {showArena && selectedIds.length >= 2 && (
        <SimuladoEvolutionArena
          simuladosSelecionados={selectedSimulados}
          onClose={() => { setShowArena(false); setSelectedIds([]); setCompareMode(false); }}
        />
      )}

      {/* CABEÇALHO */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-zinc-200 dark:border-zinc-800 pb-5 md:pb-6">
        <div className="min-w-0">
          <h1 className="text-2xl md:text-3xl font-black text-zinc-800 dark:text-white tracking-tight flex items-center gap-3">
            <ClipboardList className="text-red-600" size={30} />
            Simulados
          </h1>
          <p className="text-zinc-500 dark:text-zinc-400 mt-2 text-sm max-w-xl">
            Registre seus simulados, acompanhe histórico e compare evolução.
          </p>
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto">
          <button
            onClick={() => { setCompareMode(!compareMode); setSelectedIds([]); }}
            className={`flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-bold transition-all border ${
              compareMode
                ? 'bg-blue-600 border-blue-600 text-white shadow-lg shadow-blue-500/30'
                : 'bg-zinc-100 dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700'
            }`}
          >
            <ArrowLeftRight size={18} /> {compareMode ? 'Cancelar' : 'Comparar'}
          </button>

          {!compareMode && (
            <button
              onClick={() => setIsModalOpen(true)}
              className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700 text-white px-5 py-2.5 rounded-xl font-bold shadow-lg shadow-red-600/30 transition-transform active:scale-95 whitespace-nowrap"
            >
              <Plus size={20} /> Novo Registro
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="py-16 text-center text-zinc-400 font-medium animate-pulse flex flex-col items-center gap-4">
          <div className="w-8 h-8 border-4 border-red-500 border-t-transparent rounded-full animate-spin" />
          Carregando histórico...
        </div>
      ) : simulados.length === 0 ? (
        <div className="bg-zinc-50 dark:bg-zinc-900/50 p-10 rounded-3xl border-2 border-dashed border-zinc-200 dark:border-zinc-800 text-center max-w-2xl mx-auto mt-6">
          <div className="w-16 h-16 bg-zinc-100 dark:bg-zinc-800 rounded-full flex items-center justify-center mx-auto mb-4">
            <ClipboardList size={32} className="text-zinc-400" />
          </div>
          <h3 className="text-2xl font-black text-zinc-800 dark:text-white mb-2">Sem registros ainda</h3>
          <p className="text-zinc-500 mb-6">Registre seu primeiro simulado para desbloquear análises.</p>
          <button
            onClick={() => setIsModalOpen(true)}
            className="bg-red-600 text-white px-8 py-3 rounded-xl font-bold shadow-lg shadow-red-600/20 hover:bg-red-700 transition-colors"
          >
            Registrar Primeiro Simulado
          </button>
        </div>
      ) : (
        <>
          {/* KPI CARDS (mobile: 2 colunas; Recorde + Último lado a lado) */}
          {kpis && (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
              <div className="bg-white dark:bg-zinc-900 p-4 md:p-5 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm relative overflow-hidden group hover:border-red-500/30 transition-colors">
                <div className="absolute right-0 top-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity"><Target size={80} /></div>
                <span className="text-[10px] md:text-xs font-bold text-zinc-400 uppercase tracking-wider">Total</span>
                <div className="text-2xl md:text-3xl font-black text-zinc-800 dark:text-white mt-1">{kpis.totalSimulados}</div>
                <div className="text-[10px] md:text-xs text-zinc-400 mt-1">Registros</div>
              </div>

              <div className="bg-white dark:bg-zinc-900 p-4 md:p-5 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm relative overflow-hidden group hover:border-blue-500/30 transition-colors">
                <div className="absolute right-0 top-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity"><BarChart2 size={80} /></div>
                <span className="text-[10px] md:text-xs font-bold text-zinc-400 uppercase tracking-wider">Média</span>
                <div className="text-2xl md:text-3xl font-black text-blue-600 mt-1">{kpis.mediaPontos.toFixed(1)}</div>
                <div className="text-[10px] md:text-xs text-zinc-400 mt-1">Pontos</div>
              </div>

              {/* Recorde (col-span-1 no mobile) */}
              <div className="bg-white dark:bg-zinc-900 p-4 md:p-5 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm relative overflow-hidden group hover:border-emerald-500/30 transition-colors">
                <div className="absolute right-0 top-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity"><Trophy size={80} /></div>
                <span className="text-[10px] md:text-xs font-bold text-zinc-400 uppercase tracking-wider">Recorde</span>
                <div className="text-2xl md:text-3xl font-black text-emerald-600 mt-1">{kpis.melhorNotaPontos.toFixed(1)}</div>
                <div className="text-[10px] md:text-xs text-zinc-400 mt-1">Maior nota</div>
              </div>

              {/* Último (col-span-1 no mobile) */}
              <div className="bg-zinc-900 dark:bg-black p-4 md:p-5 rounded-2xl border border-zinc-800 shadow-lg relative overflow-hidden group">
                <div className="absolute inset-0 bg-gradient-to-br from-red-600/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                <span className="text-[10px] md:text-xs font-bold text-zinc-500 uppercase tracking-wider block mb-2 flex justify-between">
                  Último
                  {kpis.trend !== 0 && (
                    <span className={kpis.trend > 0 ? 'text-emerald-500' : 'text-red-500'}>
                      {kpis.trend > 0 ? '+' : ''}{kpis.trend.toFixed(1)}
                    </span>
                  )}
                </span>
                <div className="relative z-10">
                  <h3 className="text-white font-bold truncate mb-1 text-base md:text-lg">{kpis.ultimo.titulo}</h3>
                  <div className="flex items-end gap-2">
                    <span className="text-2xl md:text-3xl font-black text-red-500">{(kpis.ultimo.resumo.pontosObtidos || 0).toFixed(1)}</span>
                    <span className="text-[10px] md:text-xs text-zinc-400 mb-1.5 font-bold uppercase">Pontos</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* LISTA */}
          <div className="mt-6 md:mt-8 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl overflow-hidden shadow-sm">
            {/* Toolbar */}
            <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 flex flex-col md:flex-row md:justify-between md:items-center gap-3 bg-zinc-50/50 dark:bg-zinc-900/50 backdrop-blur-sm sticky top-0 z-10">
              <div className="relative w-full md:w-80">
                <Search className="absolute left-3 top-3 text-zinc-400" size={16} />
                <input
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Buscar por título ou banca..."
                  className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-sm outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 transition-all shadow-sm"
                />
              </div>

              {compareMode && (
                <motion.div
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="flex items-center justify-between md:justify-end gap-3 w-full md:w-auto"
                >
                  <span className="text-sm font-bold text-zinc-600 dark:text-zinc-300 bg-white dark:bg-zinc-800 px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700">
                    {selectedIds.length} selecionados
                  </span>

                  <button
                    disabled={selectedIds.length < 2}
                    onClick={() => setShowArena(true)}
                    className="bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-bold shadow-lg shadow-blue-600/20 transition-all flex items-center gap-2"
                  >
                    <TrendingUp size={16} /> Analisar Evolução
                  </button>
                </motion.div>
              )}
            </div>

            {/* Header colunas (desktop apenas) */}
            <div className="hidden md:grid grid-cols-12 gap-4 p-4 text-xs font-bold text-zinc-400 uppercase tracking-wider border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950">
              <div className="col-span-1 text-center">Data</div>
              <div className="col-span-4">Simulado</div>
              <div className="col-span-2 text-center">Acertos</div>
              <div className="col-span-2 text-center">Pontos</div>
              <div className="col-span-2 text-center">Precisão %</div>
              <div className="col-span-1 text-center">Detalhes</div>
            </div>

            <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {filteredSimulados.map((sim) => (
                <SimuladoTableRow
                  key={sim.id}
                  item={sim}
                  onDeleteRequest={(item) => setDeleteModal({ open: true, item })}
                  onEditRequest={(item) => setEditModal({ open: true, item })}
                  compareMode={compareMode}
                  isSelected={selectedIds.includes(sim.id)}
                  onToggleSelect={() => toggleSelection(sim.id)}
                />
              ))}

              {filteredSimulados.length === 0 && (
                <div className="p-8 text-center text-zinc-400 text-sm">
                  Nenhum simulado encontrado para a busca.
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default SimuladosPage;
