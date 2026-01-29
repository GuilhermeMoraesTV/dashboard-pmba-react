import React, { useState, useEffect, useMemo } from 'react';
import {
  collection, query, orderBy, onSnapshot, addDoc, deleteDoc, doc, Timestamp
} from 'firebase/firestore';
import { db } from '../firebaseConfig';
import {
  Plus, Trash2, ChevronDown, ChevronUp, Trophy, Target, TrendingUp, Calendar,
  Save, X, AlertTriangle, Scale, Search, ArrowUpRight, ArrowDownRight, Minus, Filter
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// ============================================================================
// MODAL DE REGISTRO DE SIMULADO (PREMIUM VISUAL)
// ============================================================================
const NovoSimuladoModal = ({ isOpen, onClose, onSave, disciplinasSugestivas }) => {
  const [titulo, setTitulo] = useState('');
  const [banca, setBanca] = useState('');
  const [data, setData] = useState(new Date().toISOString().split('T')[0]);

  // Estrutura: { nome, acertos, total, peso }
  const [disciplinas, setDisciplinas] = useState([]);
  const [loading, setLoading] = useState(false);

  // Inicializa matérias com base no ciclo
  useEffect(() => {
    if (isOpen) {
      if (disciplinasSugestivas?.length > 0 && disciplinas.length === 0) {
        setDisciplinas(disciplinasSugestivas.map(d => ({
          nome: d.nome || d.disciplinaNome,
          acertos: '',
          total: '',
          peso: 1 // Peso padrão
        })));
      } else if (disciplinas.length === 0) {
        setDisciplinas([{ nome: 'Português', acertos: '', total: '', peso: 1 }]);
      }
    }
  }, [isOpen, disciplinasSugestivas]);

  const handleChange = (idx, field, val) => {
    const arr = [...disciplinas];
    arr[idx][field] = val;
    setDisciplinas(arr);
  };

  const addMateria = () => setDisciplinas([...disciplinas, { nome: '', acertos: '', total: '', peso: 1 }]);
  const removeMateria = (idx) => setDisciplinas(disciplinas.filter((_, i) => i !== idx));

  // Totais em tempo real para o rodapé do modal
  const totais = useMemo(() => {
    let tQuestoes = 0;
    let tPontosPossiveis = 0;
    let tPontosObtidos = 0;

    disciplinas.forEach(d => {
      const a = Number(d.acertos) || 0;
      const t = Number(d.total) || 0;
      const p = Number(d.peso) || 1;

      if (t > 0) {
        tQuestoes += t;
        tPontosPossiveis += (t * p);
        tPontosObtidos += (a * p);
      }
    });

    return { tQuestoes, tPontosPossiveis, tPontosObtidos };
  }, [disciplinas]);

  const handleSave = () => {
    if (!titulo || !data) return alert("Preencha o título e a data do simulado.");

    // Filtra linhas vazias
    const validas = disciplinas.filter(d => d.nome && d.total > 0);
    if (validas.length === 0) return alert("Adicione pelo menos uma disciplina com questões.");

    setLoading(true);

    const disciplinasFormatadas = validas.map(d => ({
      nome: d.nome,
      acertos: Number(d.acertos),
      total: Number(d.total),
      peso: Number(d.peso) || 1
    }));

    const totalAcertos = disciplinasFormatadas.reduce((acc, d) => acc + d.acertos, 0);
    const totalQuestoes = disciplinasFormatadas.reduce((acc, d) => acc + d.total, 0);

    // Cálculo Ponderado
    const pontosObtidos = disciplinasFormatadas.reduce((acc, d) => acc + (d.acertos * d.peso), 0);
    const pontosTotais = disciplinasFormatadas.reduce((acc, d) => acc + (d.total * d.peso), 0);
    const porcentagem = pontosTotais > 0 ? (pontosObtidos / pontosTotais) * 100 : 0;

    onSave({
      titulo,
      banca,
      data,
      disciplinas: disciplinasFormatadas,
      resumo: {
        totalQuestoes,
        totalAcertos,
        pontosObtidos,
        pontosTotais,
        porcentagem
      }
    });

    setLoading(false);
    onClose();
    // Reset
    setTitulo('');
    setBanca('');
    setDisciplinas([]);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in" onClick={onClose}>
      <div
        className="bg-white dark:bg-zinc-950 rounded-2xl shadow-2xl border border-zinc-200 dark:border-zinc-800 w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* HEADER */}
        <div className="relative flex justify-between items-center p-6 border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50">
          <div className="flex items-center gap-4 relative z-10">
            <div className="w-12 h-12 bg-red-500/10 text-red-600 dark:text-red-500 rounded-xl flex items-center justify-center shadow-sm ring-1 ring-red-500/20">
              <Trophy size={24} />
            </div>
            <div>
              <h2 className="text-xl font-black text-zinc-900 dark:text-white uppercase tracking-tight leading-none">
                Novo Simulado
              </h2>
              <p className="text-xs text-zinc-500 mt-1">Cadastre notas e pesos para gerar métricas.</p>
            </div>
          </div>
          <button onClick={onClose} className="relative z-10 p-2 text-zinc-400 hover:text-red-500 hover:bg-white dark:hover:bg-zinc-800 rounded-full transition-all">
            <X size={24} />
          </button>
        </div>

        {/* BODY */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar bg-white dark:bg-zinc-950">

          {/* Dados Gerais */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
            <div className="md:col-span-6 group">
              <label className="block text-xs font-bold text-zinc-500 uppercase mb-1.5">Título do Simulado</label>
              <input
                value={titulo} onChange={e => setTitulo(e.target.value)}
                placeholder="Ex: Simulado PMBA 01 - Caveira"
                className="w-full p-3 border border-zinc-200 dark:border-zinc-700 rounded-xl bg-zinc-50 dark:bg-zinc-900/50 focus:ring-2 focus:ring-red-500 outline-none text-zinc-800 dark:text-white font-medium"
              />
            </div>
            <div className="md:col-span-3 group">
              <label className="block text-xs font-bold text-zinc-500 uppercase mb-1.5">Banca / Origem</label>
              <input
                value={banca} onChange={e => setBanca(e.target.value)}
                placeholder="FCC"
                className="w-full p-3 border border-zinc-200 dark:border-zinc-700 rounded-xl bg-zinc-50 dark:bg-zinc-900/50 focus:ring-2 focus:ring-red-500 outline-none text-zinc-800 dark:text-white font-medium"
              />
            </div>
            <div className="md:col-span-3 group">
              <label className="block text-xs font-bold text-zinc-500 uppercase mb-1.5">Data</label>
              <input
                type="date"
                value={data} onChange={e => setData(e.target.value)}
                className="w-full p-3 border border-zinc-200 dark:border-zinc-700 rounded-xl bg-zinc-50 dark:bg-zinc-900/50 focus:ring-2 focus:ring-red-500 outline-none text-zinc-800 dark:text-white font-medium"
              />
            </div>
          </div>

          <div className="border-t border-zinc-200 dark:border-zinc-800 my-4"></div>

          {/* Lista de Disciplinas */}
          <div>
            <div className="flex justify-between items-end mb-4">
              <h3 className="text-sm font-bold text-zinc-700 dark:text-zinc-300 uppercase flex items-center gap-2">
                <Target size={16} className="text-red-500"/> Notas por Disciplina
              </h3>
              <button onClick={addMateria} className="text-xs flex items-center gap-1 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 px-3 py-1.5 rounded-lg text-zinc-600 dark:text-zinc-300 font-bold transition-all">
                <Plus size={14}/> Adicionar Matéria
              </button>
            </div>

            <div className="space-y-3">
              {/* Header da Tabela */}
              <div className="grid grid-cols-12 gap-2 text-[10px] font-bold text-zinc-400 uppercase tracking-wider px-2">
                <div className="col-span-5 md:col-span-6">Disciplina</div>
                <div className="col-span-2 text-center">Acertos</div>
                <div className="col-span-2 text-center">Total</div>
                <div className="col-span-2 text-center">Peso</div>
                <div className="col-span-1"></div>
              </div>

              {disciplinas.map((disc, idx) => (
                <motion.div
                  key={idx} layout initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                  className="grid grid-cols-12 gap-2 items-center bg-zinc-50 dark:bg-zinc-900/30 p-2 rounded-xl border border-zinc-100 dark:border-zinc-800/50 hover:border-zinc-300 dark:hover:border-zinc-700 transition-colors"
                >
                  <div className="col-span-5 md:col-span-6">
                    <input
                      placeholder="Nome da Disciplina"
                      value={disc.nome} onChange={e => handleChange(idx, 'nome', e.target.value)}
                      className="w-full bg-transparent p-1.5 outline-none text-sm font-medium text-zinc-800 dark:text-white placeholder:text-zinc-400"
                    />
                  </div>
                  <div className="col-span-2">
                    <input
                      type="number" placeholder="0" min="0"
                      value={disc.acertos} onChange={e => handleChange(idx, 'acertos', e.target.value)}
                      className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg p-1.5 text-center text-sm font-bold text-emerald-600 dark:text-emerald-400 outline-none focus:border-emerald-500"
                    />
                  </div>
                  <div className="col-span-2">
                    <input
                      type="number" placeholder="0" min="0"
                      value={disc.total} onChange={e => handleChange(idx, 'total', e.target.value)}
                      className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg p-1.5 text-center text-sm text-zinc-600 dark:text-zinc-400 outline-none focus:border-blue-500"
                    />
                  </div>
                  <div className="col-span-2 relative">
                    <input
                      type="number" placeholder="1" min="0.1" step="0.1"
                      value={disc.peso} onChange={e => handleChange(idx, 'peso', e.target.value)}
                      className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg p-1.5 text-center text-sm text-amber-600 dark:text-amber-400 outline-none focus:border-amber-500 font-bold"
                    />
                    <Scale size={10} className="absolute top-1 right-1 text-zinc-300 pointer-events-none"/>
                  </div>
                  <div className="col-span-1 flex justify-center">
                    <button onClick={() => removeMateria(idx)} className="p-1.5 text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors">
                      <Trash2 size={16} />
                    </button>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </div>

        {/* FOOTER & TOTALS */}
        <div className="bg-zinc-50 dark:bg-zinc-900 border-t border-zinc-200 dark:border-zinc-800 p-4 relative z-20">

          <div className="flex flex-col md:flex-row justify-between items-center gap-4 mb-4">
             <div className="flex items-center gap-6 text-sm">
                 <div>
                    <span className="block text-[10px] uppercase font-bold text-zinc-400">Total Questões</span>
                    <span className="font-bold text-zinc-700 dark:text-white">{totais.tQuestoes}</span>
                 </div>
                 <div>
                    <span className="block text-[10px] uppercase font-bold text-zinc-400">Pontos Possíveis</span>
                    <span className="font-bold text-zinc-700 dark:text-white">{totais.tPontosPossiveis}</span>
                 </div>
                 <div>
                    <span className="block text-[10px] uppercase font-bold text-zinc-400">Nota Projetada</span>
                    <span className="font-black text-xl text-red-600">{totais.tPontosObtidos.toFixed(1)}</span>
                 </div>
             </div>
          </div>

          <div className="flex justify-end gap-3">
            <button
              type="button" onClick={onClose} disabled={loading}
              className="px-6 py-2.5 rounded-xl text-sm font-bold text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-800 transition-colors disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              onClick={handleSave} disabled={loading}
              className="px-8 py-2.5 rounded-xl text-sm font-bold uppercase tracking-wide text-white bg-red-600 hover:bg-red-700 shadow-lg shadow-red-600/30 transition-all transform hover:-translate-y-0.5 active:translate-y-0 flex items-center gap-2 disabled:opacity-70"
            >
              {loading ? 'Salvando...' : <><Save size={18} /> Salvar Resultado</>}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};

// ============================================================================
// COMPONENTE CARD: INTELIGENTE E COMPARATIVO
// ============================================================================
const SimuladoCard = ({ item, previousItem, onDelete }) => {
    const [isExpanded, setExpanded] = useState(false);

    // Cores baseadas na porcentagem
    const getScoreColor = (p) => {
        if (p >= 80) return { bg: 'bg-emerald-500', text: 'text-emerald-500', ring: 'ring-emerald-500/20', badge: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400' };
        if (p >= 60) return { bg: 'bg-amber-500', text: 'text-amber-500', ring: 'ring-amber-500/20', badge: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400' };
        return { bg: 'bg-red-500', text: 'text-red-500', ring: 'ring-red-500/20', badge: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400' };
    };

    const styles = getScoreColor(item.resumo.porcentagem);

    // Lógica de Comparação
    let comparison = null;
    if (previousItem) {
        const diff = item.resumo.porcentagem - previousItem.resumo.porcentagem;
        if (diff > 0) comparison = { icon: <ArrowUpRight size={14}/>, color: 'text-emerald-500', val: `+${diff.toFixed(1)}%` };
        else if (diff < 0) comparison = { icon: <ArrowDownRight size={14}/>, color: 'text-red-500', val: `${diff.toFixed(1)}%` };
        else comparison = { icon: <Minus size={14}/>, color: 'text-zinc-400', val: '0%' };
    }

    return (
        <motion.div
            layout
            className="group relative bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl overflow-hidden shadow-sm hover:shadow-xl transition-all duration-300"
        >
            {/* Barra lateral colorida de status */}
            <div className={`absolute left-0 top-0 bottom-0 w-1.5 ${styles.bg} opacity-80`} />

            <div
                className="p-5 pl-7 cursor-pointer"
                onClick={() => setExpanded(!isExpanded)}
            >
                <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">

                    {/* INFO ESQUERDA: Título e Meta */}
                    <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                            {item.banca && (
                                <span className="px-2 py-0.5 rounded-md bg-zinc-100 dark:bg-zinc-800 text-[10px] font-bold uppercase text-zinc-500 tracking-wider">
                                    {item.banca}
                                </span>
                            )}
                            <span className="flex items-center gap-1 text-xs text-zinc-400 font-medium">
                                <Calendar size={12}/> {item.data.split('-').reverse().join('/')}
                            </span>
                        </div>
                        <h3 className="font-bold text-zinc-800 dark:text-white text-lg leading-tight group-hover:text-red-600 transition-colors">
                            {item.titulo}
                        </h3>
                    </div>

                    {/* INFO CENTRO/DIREITA: Métricas Visuais */}
                    <div className="flex items-center gap-6 w-full md:w-auto justify-between md:justify-end">

                        {/* Pontos Totais (Peso) */}
                        <div className="text-right hidden sm:block">
                            <span className="block text-[10px] font-bold text-zinc-400 uppercase">Pontuação</span>
                            <span className="font-mono font-bold text-zinc-700 dark:text-zinc-200 text-sm">
                                {item.resumo.pontosObtidos?.toFixed(1) || item.resumo.totalAcertos} <span className="text-zinc-400">/ {item.resumo.pontosTotais?.toFixed(1) || item.resumo.totalQuestoes}</span>
                            </span>
                        </div>

                        {/* Comparativo */}
                        {comparison && (
                            <div className="flex flex-col items-end min-w-[60px]">
                                <span className="text-[10px] font-bold text-zinc-400 uppercase">Evolução</span>
                                <div className={`flex items-center gap-0.5 font-bold text-sm ${comparison.color}`}>
                                    {comparison.icon} {comparison.val}
                                </div>
                            </div>
                        )}

                        {/* Badge da Nota */}
                        <div className={`flex items-center justify-center w-16 h-16 rounded-2xl ${styles.badge} ring-1 ${styles.ring} relative`}>
                            <div className="flex flex-col items-center leading-none">
                                <span className="text-lg font-black">{Math.round(item.resumo.porcentagem)}%</span>
                                <span className="text-[9px] font-bold opacity-70">NOTA</span>
                            </div>
                        </div>

                        {/* Botão Expandir */}
                        <div className={`p-2 rounded-full bg-zinc-50 dark:bg-zinc-800 text-zinc-400 transition-transform duration-300 ${isExpanded ? 'rotate-180 bg-zinc-200 dark:bg-zinc-700' : ''}`}>
                            <ChevronDown size={20} />
                        </div>
                    </div>
                </div>

                {/* Barra de Progresso Geral */}
                <div className="mt-4 w-full h-1.5 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                    <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${item.resumo.porcentagem}%` }}
                        transition={{ duration: 1, ease: "easeOut" }}
                        className={`h-full ${styles.bg}`}
                    />
                </div>
            </div>

            {/* DETALHES (ACCORDION) */}
            <AnimatePresence>
                {isExpanded && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="bg-zinc-50/50 dark:bg-zinc-950 border-t border-zinc-200 dark:border-zinc-800"
                    >
                        <div className="p-5">
                            <div className="flex justify-between items-center mb-4">
                                <h4 className="text-sm font-bold text-zinc-500 uppercase flex items-center gap-2">
                                    <List size={16}/> Detalhamento por Matéria
                                </h4>
                                <button
                                    onClick={(e) => { e.stopPropagation(); onDelete(item.id); }}
                                    className="text-xs flex items-center gap-1 text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20 px-3 py-1.5 rounded-lg transition-colors"
                                >
                                    <Trash2 size={14}/> Excluir Registro
                                </button>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {item.disciplinas.map((disc, idx) => {
                                    const perc = disc.total > 0 ? (disc.acertos / disc.total) * 100 : 0;
                                    const pontos = (disc.acertos * (disc.peso || 1));
                                    // Cor da barra individual
                                    const barColor = perc >= 80 ? 'bg-emerald-500' : perc >= 60 ? 'bg-amber-500' : 'bg-red-500';

                                    return (
                                        <div key={idx} className="bg-white dark:bg-zinc-900 p-3 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm relative overflow-hidden">
                                            {/* Header do Card Mini */}
                                            <div className="flex justify-between items-start mb-2 relative z-10">
                                                <span className="font-bold text-sm text-zinc-700 dark:text-zinc-200 truncate pr-2" title={disc.nome}>
                                                    {disc.nome}
                                                </span>
                                                <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${perc >= 70 ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'}`}>
                                                    {Math.round(perc)}%
                                                </span>
                                            </div>

                                            {/* Detalhes Numéricos */}
                                            <div className="flex justify-between text-xs text-zinc-500 dark:text-zinc-400 mb-2 relative z-10">
                                                <span>{disc.acertos}/{disc.total} questões</span>
                                                {disc.peso > 1 && (
                                                    <span className="flex items-center gap-1 text-amber-600 dark:text-amber-500 font-bold">
                                                        <Scale size={10}/> {disc.peso}x ({pontos.toFixed(1)} pts)
                                                    </span>
                                                )}
                                            </div>

                                            {/* Barra de Progresso Mini */}
                                            <div className="w-full h-1.5 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden relative z-10">
                                                <div className={`h-full rounded-full ${barColor}`} style={{ width: `${perc}%` }}></div>
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.div>
    );
};

// ============================================================================
// PÁGINA PRINCIPAL
// ============================================================================
const SimuladosPage = ({ user, activeCycleDisciplines }) => {
  const [simulados, setSimulados] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  // Fetch Simulados
  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, 'users', user.uid, 'simulados'), orderBy('data', 'desc'));
    const unsub = onSnapshot(q, (snapshot) => {
        const docs = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        setSimulados(docs);
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
         console.error("Erro ao criar simulado", e);
         alert("Erro ao salvar.");
     }
  };

  const handleDelete = async (id) => {
      if(window.confirm("Esta ação é irreversível. Deseja realmente excluir este histórico?")) {
          await deleteDoc(doc(db, 'users', user.uid, 'simulados', id));
      }
  };

  const filteredSimulados = useMemo(() => {
      return simulados.filter(s =>
        s.titulo.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (s.banca && s.banca.toLowerCase().includes(searchTerm.toLowerCase()))
      );
  }, [simulados, searchTerm]);

  // KPIs Calculations
  const kpis = useMemo(() => {
      if (simulados.length === 0) return null;

      const totalSimulados = simulados.length;
      const mediaGeral = simulados.reduce((acc, curr) => acc + curr.resumo.porcentagem, 0) / totalSimulados;
      const melhorNota = Math.max(...simulados.map(s => s.resumo.porcentagem));
      const ultimo = simulados[0]; // já está ordenado desc

      // Tendência (comparar médias dos últimos 3 vs total)
      const trend = simulados.length >= 2 ? (simulados[0].resumo.porcentagem - simulados[1].resumo.porcentagem) : 0;

      return { totalSimulados, mediaGeral, melhorNota, ultimo, trend };
  }, [simulados]);

  // Chart Data (Simple SVG Polyline)
  const chartData = useMemo(() => {
      const reversed = [...simulados].reverse();
      if(reversed.length < 2) return null;
      return reversed.map(s => ({
          label: s.titulo,
          value: s.resumo.porcentagem
      }));
  }, [simulados]);

  return (
    <div className="space-y-8 pb-20 animate-fade-in">

      {/* --- HEADER DA PÁGINA --- */}
      <div className="flex flex-col md:flex-row justify-between items-end md:items-center gap-4 border-b border-zinc-200 dark:border-zinc-800 pb-6">
        <div>
            <h1 className="text-3xl font-black text-zinc-800 dark:text-white tracking-tight flex items-center gap-3">
               <Target className="text-red-600" size={32} /> Central de Simulados
            </h1>
            <p className="text-zinc-500 dark:text-zinc-400 mt-2 text-sm max-w-xl">
               Acompanhe sua performance em provas reais. Utilize o sistema de pesos para simular editais específicos e visualize sua evolução histórica.
            </p>
        </div>
        <div className="flex items-center gap-3 w-full md:w-auto">
             <div className="relative flex-1 md:w-64">
                <Search className="absolute left-3 top-3 text-zinc-400" size={18} />
                <input
                    type="text"
                    placeholder="Filtrar por nome ou banca..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-sm focus:ring-2 focus:ring-red-500 outline-none transition-all"
                />
             </div>
             <button
                onClick={() => setIsModalOpen(true)}
                className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white px-5 py-2.5 rounded-xl font-bold shadow-lg shadow-red-600/30 transition-transform active:scale-95 whitespace-nowrap"
            >
                <Plus size={20} /> Novo Registro
            </button>
        </div>
      </div>

      {loading ? (
           <div className="py-20 flex flex-col items-center justify-center text-zinc-400 animate-pulse">
               <Target size={48} className="mb-4 opacity-50"/>
               <span className="text-sm font-medium">Carregando seus dados...</span>
           </div>
      ) : simulados.length === 0 ? (
           <div className="bg-zinc-50 dark:bg-zinc-900/50 p-12 rounded-3xl border-2 border-dashed border-zinc-200 dark:border-zinc-800 text-center max-w-2xl mx-auto mt-10">
               <div className="w-20 h-20 bg-white dark:bg-zinc-800 rounded-full flex items-center justify-center mx-auto mb-6 text-red-500 shadow-sm">
                   <Target size={40} />
               </div>
               <h3 className="text-2xl font-black text-zinc-800 dark:text-white mb-2">Comece sua Jornada de Provas</h3>
               <p className="text-zinc-500 dark:text-zinc-400 mb-8 max-w-md mx-auto">
                   Simulados são a melhor forma de medir sua preparação real. Registre seu primeiro treino e desbloqueie análises detalhadas.
               </p>
               <button onClick={() => setIsModalOpen(true)} className="bg-red-600 hover:bg-red-700 text-white px-8 py-3 rounded-xl font-bold shadow-lg shadow-red-600/20 transition-all">
                   Registrar Primeiro Simulado
               </button>
           </div>
      ) : (
        <>
            {/* --- DASHBOARD KPIs --- */}
            {kpis && (
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    {/* KPI 1 */}
                    <div className="bg-white dark:bg-zinc-900 p-5 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm relative overflow-hidden group hover:border-zinc-300 dark:hover:border-zinc-700 transition-all">
                        <div className="absolute right-0 top-0 p-4 opacity-10 group-hover:scale-110 transition-transform"><Target size={60}/></div>
                        <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Simulados Feitos</span>
                        <div className="text-3xl font-black text-zinc-800 dark:text-white mt-1">{kpis.totalSimulados}</div>
                        <div className="text-xs text-zinc-500 mt-2 font-medium">Total acumulado</div>
                    </div>

                    {/* KPI 2 */}
                    <div className="bg-white dark:bg-zinc-900 p-5 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm relative overflow-hidden group hover:border-zinc-300 dark:hover:border-zinc-700 transition-all">
                         <div className="absolute right-0 top-0 p-4 opacity-10 group-hover:scale-110 transition-transform"><TrendingUp size={60}/></div>
                        <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Média Geral</span>
                        <div className="text-3xl font-black text-zinc-800 dark:text-white mt-1">{kpis.mediaGeral.toFixed(1)}%</div>
                         <div className={`text-xs mt-2 font-bold flex items-center gap-1 ${kpis.trend >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                            {kpis.trend >= 0 ? <ArrowUpRight size={12}/> : <ArrowDownRight size={12}/>}
                            {Math.abs(kpis.trend).toFixed(1)}% vs anterior
                         </div>
                    </div>

                    {/* KPI 3 */}
                    <div className="bg-white dark:bg-zinc-900 p-5 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm relative overflow-hidden group hover:border-zinc-300 dark:hover:border-zinc-700 transition-all">
                        <div className="absolute right-0 top-0 p-4 opacity-10 group-hover:scale-110 transition-transform"><Trophy size={60}/></div>
                        <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Recorde Pessoal</span>
                        <div className="text-3xl font-black text-zinc-800 dark:text-white mt-1">{kpis.melhorNota.toFixed(1)}%</div>
                        <div className="text-xs text-zinc-500 mt-2 font-medium">Melhor desempenho histórico</div>
                    </div>

                    {/* KPI 4 - Gráfico Mini */}
                    <div className="bg-zinc-900 dark:bg-black p-5 rounded-2xl border border-zinc-800 shadow-sm relative overflow-hidden flex flex-col justify-between">
                        <div className="flex justify-between items-start z-10">
                            <div>
                                <span className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Último Resultado</span>
                                <div className="text-3xl font-black text-white mt-1">{Math.round(kpis.ultimo.resumo.porcentagem)}%</div>
                            </div>
                            <div className={`px-2 py-1 rounded text-[10px] font-bold uppercase ${kpis.ultimo.resumo.porcentagem >= 80 ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}`}>
                                {kpis.ultimo.resumo.porcentagem >= 80 ? 'Aprovado' : 'Em risco'}
                            </div>
                        </div>
                        {/* Mini Sparkline decorativo */}
                        <div className="absolute bottom-0 left-0 right-0 h-10 flex items-end gap-1 px-4 opacity-30">
                            {chartData && chartData.slice(-10).map((d, i) => (
                                <div key={i} style={{ height: `${d.value}%` }} className="flex-1 bg-red-500 rounded-t-sm"></div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* --- LISTA DETALHADA --- */}
            <div className="space-y-4">
                <div className="flex justify-between items-center mt-8 mb-4">
                   <h3 className="text-lg font-bold text-zinc-700 dark:text-zinc-300 flex items-center gap-2">
                       <Filter size={18}/> Histórico de Provas
                   </h3>
                   <span className="text-xs font-medium text-zinc-400 bg-zinc-100 dark:bg-zinc-800 px-3 py-1 rounded-full">
                       {filteredSimulados.length} Registros
                   </span>
                </div>

                <div className="flex flex-col gap-4">
                    {filteredSimulados.map((sim, index) => {
                        // Passa o item anterior para comparação (lembrando que a lista está desc)
                        const prevItem = filteredSimulados[index + 1];
                        return (
                            <SimuladoCard
                                key={sim.id}
                                item={sim}
                                previousItem={prevItem}
                                onDelete={handleDelete}
                            />
                        );
                    })}
                </div>
            </div>
        </>
      )}

      <NovoSimuladoModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={handleCreate}
        disciplinasSugestivas={activeCycleDisciplines || []}
      />
    </div>
  );
};

export default SimuladosPage;