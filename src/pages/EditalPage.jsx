import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../firebaseConfig';
import { collection, getDoc, doc, getDocs, query, where, addDoc, serverTimestamp, deleteDoc } from 'firebase/firestore';
import {
  BookOpen, CheckCircle2, ChevronDown,
  Search, AlertCircle, Play,
  Target, CheckSquare, BarChart2, Clock,
  Zap, GraduationCap, X, Hourglass, LayoutGrid, Flame, Star, AlertTriangle, RefreshCcw, TrendingUp,
  LayoutDashboard, ChevronRight, Trophy, PlusCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// --- UTILITÁRIOS ---
const normalize = (str) => str ? str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase() : "";

const formatDateRelative = (dateString) => {
    if (!dateString) return '-';
    const date = new Date(dateString.includes('T') ? dateString : dateString + 'T00:00:00');
    const today = new Date();
    const diffTime = Math.abs(today - date);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays <= 1) return 'Hoje';
    if (diffDays === 2) return 'Ontem';
    return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
};

const formatMinutesToTime = (totalMinutes) => {
    if (!totalMinutes || totalMinutes === 0) return '0m';
    const h = Math.floor(totalMinutes / 60);
    const m = totalMinutes % 60;
    if (h > 0 && m > 0) return `${h}h ${m}m`;
    if (h > 0) return `${h}h`;
    return `${m}m`;
};

// --- VISUAL HELPERS ---
const getProgressStats = (acertos, total) => {
    if (!total || total === 0) return { width: 0, colorBg: 'bg-zinc-200 dark:bg-zinc-700', colorText: 'text-zinc-400' };
    const perc = Math.round((acertos / total) * 100);
    let colorBg = 'bg-red-500';
    let colorText = 'text-red-600 dark:text-red-400';
    if (perc >= 50) { colorBg = 'bg-amber-500'; colorText = 'text-amber-600 dark:text-amber-400'; }
    if (perc >= 80) { colorBg = 'bg-emerald-500'; colorText = 'text-emerald-600 dark:text-emerald-400'; }
    return { width: perc, colorBg, colorText, perc };
};

// --- FUNÇÃO PARA ESTILO DE ACERTOS ---
const getDesempenhoConfig = (perc, questoes) => {
    if (!questoes || questoes === 0) return {
        style: 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-500 border border-zinc-200 dark:border-zinc-700',
        icon: Target,
        label: '0%'
    };

    if (perc >= 85) return {
        style: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 border border-yellow-200 dark:border-yellow-700/50 shadow-sm shadow-yellow-500/10',
        icon: Trophy,
        label: `${perc}%`
    };

    if (perc >= 70) return {
        style: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-700/50',
        icon: CheckCircle2,
        label: `${perc}%`
    };

    return {
        style: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-700/50',
        icon: AlertTriangle,
        label: `${perc}%`
    };
};

// --- MODAL DE CONFIRMAÇÃO ---
const StartStudyModal = ({ disciplina, assunto, onClose, onConfirm }) => {
    if (!disciplina) return null;
    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in" onClick={onClose}>
            <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                onClick={(e) => e.stopPropagation()}
                className="bg-white dark:bg-zinc-900 w-full max-w-sm rounded-3xl p-6 shadow-2xl border border-zinc-200 dark:border-zinc-800 text-center relative"
            >
                <div className="w-16 h-16 bg-red-100 dark:bg-red-900/20 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg shadow-red-500/20">
                    <Clock size={32} />
                </div>
                <h3 className="text-xl font-black text-zinc-900 dark:text-white mb-2">Iniciar Sessão?</h3>
                <div className="text-sm text-zinc-500 mb-6 px-4">
                    Você vai iniciar o cronômetro para estudar:<br/>
                    <strong className="text-zinc-800 dark:text-zinc-200 text-base block mt-1">{disciplina.nome}</strong>
                    {assunto && (
                         <span className="block mt-1 text-emerald-600 dark:text-emerald-400 font-bold text-xs bg-emerald-100 dark:bg-emerald-900/30 py-1 px-2 rounded-lg mx-auto w-fit">
                            {assunto}
                         </span>
                    )}
                </div>
                <div className="flex gap-3">
                    <button onClick={onClose} className="flex-1 py-3 rounded-xl font-bold text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors">
                        Cancelar
                    </button>
                    <button onClick={() => onConfirm(disciplina, assunto)} className="flex-1 py-3 rounded-xl bg-red-600 text-white font-bold hover:bg-red-700 shadow-lg shadow-red-600/30 transition-transform active:scale-95 flex items-center justify-center gap-2">
                        <Play size={18} fill="currentColor"/> Iniciar
                    </button>
                </div>
            </motion.div>
        </div>
    );
};

// --- COMPONENTE PRINCIPAL ---
function EditalPage({ user, activeCicloId, onStartStudy, onBack }) {
  const [ciclo, setCiclo] = useState(null);
  const [disciplinas, setDisciplinas] = useState([]);
  const [registros, setRegistros] = useState([]);
  const [loading, setLoading] = useState(true);

  const [expandedDisciplinas, setExpandedDisciplinas] = useState({});
  const [searchTerm, setSearchTerm] = useState('');

  const [optimisticChecks, setOptimisticChecks] = useState({});
  const [loadingCheck, setLoadingCheck] = useState({});
  const [studyModalData, setStudyModalData] = useState(null);

  const getLogoUrl = (cicloData) => {
      if (cicloData.logoUrl) return cicloData.logoUrl;
      if (cicloData.templateOrigem?.includes('pmba')) return '/logo-pmba.png';
      if (cicloData.templateOrigem?.includes('ppmg')) return '/logosEditais/logo-ppmg.png';
      if (cicloData.templateOrigem?.includes('pcba')) return '/logosEditais/logo-pcba.png';
      return null;
  };

  useEffect(() => {
    const fetchData = async () => {
      // Se não tiver ID ou User, paramos de carregar, mas não retornamos nada ainda (tratado no render)
      if (!user || !activeCicloId) {
          setLoading(false);
          return;
      }

      try {
        setLoading(true); // Garante que o loading comece
        const cicloRef = doc(db, 'users', user.uid, 'ciclos', activeCicloId);
        const cicloSnap = await getDoc(cicloRef);

        if (cicloSnap.exists()) {
            const data = cicloSnap.data();
            setCiclo({ id: cicloSnap.id, ...data, computedLogo: getLogoUrl(data) });
        } else {
            // Ciclo não existe (pode ter sido apagado), remove loading
            setLoading(false);
            return;
        }

        const disciplinasRef = collection(db, 'users', user.uid, 'ciclos', activeCicloId, 'disciplinas');
        const disciplinasSnap = await getDocs(disciplinasRef);

        const listaDisciplinas = disciplinasSnap.docs
            .map(doc => ({ id: doc.id, ...doc.data() }))
            .sort((a, b) => (a.id > b.id ? 1 : -1));

        setDisciplinas(listaDisciplinas);

        const registrosRef = collection(db, 'users', user.uid, 'registrosEstudo');
        const qRegistros = query(registrosRef, where('cicloId', '==', activeCicloId));
        const registrosSnap = await getDocs(qRegistros);
        const regs = registrosSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setRegistros(regs);
      } catch (error) {
          console.error("Erro:", error);
      } finally {
          setLoading(false);
      }
    };
    fetchData();
  }, [user, activeCicloId]);

  const refreshRegistros = async () => {
      const registrosRef = collection(db, 'users', user.uid, 'registrosEstudo');
      const qRegistros = query(registrosRef, where('cicloId', '==', activeCicloId));
      const registrosSnap = await getDocs(qRegistros);
      setRegistros(registrosSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
  };

  const { editalProcessado, statsGlobal, disciplinaPrioritaria } = useMemo(() => {
    if (!disciplinas.length) return { editalProcessado: [], statsGlobal: { total: 0, concluidos: 0, percentual: 0 }, disciplinaPrioritaria: null };

    const mapaDetalhado = {};
    const statsPorDisciplina = {};

    registros.forEach(reg => {
        if (!statsPorDisciplina[reg.disciplinaNome]) {
            statsPorDisciplina[reg.disciplinaNome] = { acertos: 0, questoes: 0, lastDate: null, minutes: 0 };
        }
        const s = statsPorDisciplina[reg.disciplinaNome];
        s.acertos += Number(reg.acertos || 0);
        s.questoes += Number(reg.questoesFeitas || 0);
        s.minutes += Number(reg.tempoEstudadoMinutos || 0);

        if (!s.lastDate || reg.data > s.lastDate) s.lastDate = reg.data;

        if(reg.assunto) {
            const key = `${reg.disciplinaNome}-${reg.assunto}`.toLowerCase().trim();
            if(!mapaDetalhado[key]) mapaDetalhado[key] = { count: 0, minutes: 0, questions: 0, correct: 0, lastDate: null, hasManualCheck: false };
            mapaDetalhado[key].count += 1;
            mapaDetalhado[key].minutes += Number(reg.tempoEstudadoMinutos || 0);
            mapaDetalhado[key].questions += Number(reg.questoesFeitas || 0);
            mapaDetalhado[key].correct += Number(reg.acertos || 0);
            if (reg.tipoEstudo === 'check_manual') mapaDetalhado[key].hasManualCheck = true;
            if(!mapaDetalhado[key].lastDate || reg.data > mapaDetalhado[key].lastDate) mapaDetalhado[key].lastDate = reg.data;
        }
    });

    let totalTopicosGlobal = 0;
    let totalConcluidosGlobal = 0;
    let candidatesForPriority = [];

    const listaProcessada = disciplinas.map(disc => {
        const listaAssuntos = Array.isArray(disc.assuntos) ? disc.assuntos : [];
        const statsDisc = statsPorDisciplina[disc.nome] || { acertos: 0, questoes: 0, lastDate: null, minutes: 0 };
        const desempenhoDisc = statsDisc.questoes > 0 ? Math.round((statsDisc.acertos / statsDisc.questoes) * 100) : 0;

        const assuntosProcessados = listaAssuntos.map(itemAssunto => {
            const nomeAssunto = typeof itemAssunto === 'string' ? itemAssunto : itemAssunto.nome;
            const relevanciaAssunto = typeof itemAssunto === 'object' ? (itemAssunto.relevancia || 1) : 1;

            const key = `${disc.nome}-${nomeAssunto}`.toLowerCase().trim();
            const dadosDB = mapaDetalhado[key];
            const isOptimistic = optimisticChecks[key];
            const estudadoReal = !!dadosDB?.hasManualCheck;
            const estudadoFinal = isOptimistic !== undefined ? isOptimistic : estudadoReal;

            return {
                nome: nomeAssunto,
                relevancia: relevanciaAssunto,
                estudado: estudadoFinal,
                qtdVezes: dadosDB?.count || (estudadoFinal ? 1 : 0),
                ultimaVez: dadosDB?.lastDate || (estudadoFinal ? 'Agora' : null),
                minutos: dadosDB?.minutes || 0,
                questoes: dadosDB?.questions || 0,
                acertos: dadosDB?.correct || 0
            };
        });

        const totalAssuntos = assuntosProcessados.length;
        const concluidos = assuntosProcessados.filter(a => a.estudado).length;
        const progresso = totalAssuntos > 0 ? (concluidos / totalAssuntos) * 100 : 0;

        totalTopicosGlobal += totalAssuntos;
        totalConcluidosGlobal += concluidos;

        const objDisciplina = {
            ...disc,
            assuntos: assuntosProcessados,
            progresso,
            totalAssuntos,
            concluidos,
            stats: {
                desempenho: desempenhoDisc,
                questoes: statsDisc.questoes,
                ultimaData: statsDisc.lastDate,
                minutos: statsDisc.minutes
            }
        };

        if (progresso < 100) {
            const pesoDisciplina = Number(disc.peso) || 1;
            let score = 0;
            let motivo = "";
            let detalhe = "";
            let tipoPrioridade = "normal";

            if (statsDisc.questoes >= 10 && desempenhoDisc < 60) {
                score = 500 + (100 - desempenhoDisc);
                motivo = "Desempenho Baixo";
                detalhe = `Apenas ${desempenhoDisc}% de acertos`;
                tipoPrioridade = "critical";
            }
            else if (statsDisc.lastDate) {
                const daysSince = Math.ceil(Math.abs(new Date() - new Date(statsDisc.lastDate)) / (1000 * 60 * 60 * 24));
                if (daysSince > 7) {
                    score = 400 + daysSince;
                    motivo = "Revisão Necessária";
                    detalhe = `Não estudado há ${daysSince} dias`;
                    tipoPrioridade = "warning";
                }
            }
            else if (progresso === 0 && pesoDisciplina >= 3) {
                score = 300 + (pesoDisciplina * 10);
                motivo = "Conteúdo Base";
                detalhe = "Alta relevância no edital";
                tipoPrioridade = "info";
            }
            else {
                score = 100 + (pesoDisciplina * 10) + (100 - progresso);
                motivo = "Avançar Conteúdo";
                detalhe = `${Math.round(100 - progresso)}% pendente`;
                tipoPrioridade = "normal";
            }

            candidatesForPriority.push({ ...objDisciplina, scorePrioridade: score, motivoPrioridade: motivo, detalhePrioridade: detalhe, tipoPrioridade });
        }

        return objDisciplina;
    }).filter(d => {
        const termo = searchTerm.toLowerCase();
        return d.nome.toLowerCase().includes(termo) || d.assuntos.some(a => a.nome.toLowerCase().includes(termo));
    });

    candidatesForPriority.sort((a, b) => b.scorePrioridade - a.scorePrioridade);
    const disciplinaPrioritaria = candidatesForPriority.length > 0 ? candidatesForPriority[0] : null;

    const percentualGlobal = totalTopicosGlobal > 0 ? (totalConcluidosGlobal / totalTopicosGlobal) * 100 : 0;

    return {
        editalProcessado: listaProcessada,
        statsGlobal: { total: totalTopicosGlobal, concluidos: totalConcluidosGlobal, percentual: percentualGlobal },
        disciplinaPrioritaria
    };

  }, [disciplinas, registros, searchTerm, optimisticChecks]);

  const handleToggleCheck = async (disciplinaId, disciplinaNome, assuntoNome, estadoAtual) => {
      const key = `${disciplinaNome}-${assuntoNome}`.toLowerCase().trim();
      const novoEstado = !estadoAtual;
      setOptimisticChecks(prev => ({ ...prev, [key]: novoEstado }));
      setLoadingCheck(prev => ({ ...prev, [key]: true }));

      try {
          if (novoEstado) {
              const novoRegistro = { cicloId: activeCicloId, disciplinaId, disciplinaNome, assunto: assuntoNome, data: new Date().toISOString().split('T')[0], timestamp: serverTimestamp(), tempoEstudadoMinutos: 0, questoesFeitas: 0, acertos: 0, tipoEstudo: 'check_manual', obs: 'Check Manual' };
              await addDoc(collection(db, 'users', user.uid, 'registrosEstudo'), novoRegistro);
          } else {
              const regRef = collection(db, 'users', user.uid, 'registrosEstudo');
              const q = query(regRef, where('cicloId', '==', activeCicloId), where('assunto', '==', assuntoNome));
              const snapshot = await getDocs(q);
              const docParaDeletar = snapshot.docs.find(doc => {
                  const data = doc.data();
                  const mesmoNome = normalize(data.disciplinaNome) === normalize(disciplinaNome);
                  return mesmoNome && data.tipoEstudo === 'check_manual';
              }) || snapshot.docs.find(doc => {
                  const data = doc.data();
                  return normalize(data.disciplinaNome) === normalize(disciplinaNome);
              });
              if (docParaDeletar) await deleteDoc(docParaDeletar.ref);
          }
          await refreshRegistros();
          setOptimisticChecks(prev => { const newState = { ...prev }; delete newState[key]; return newState; });
      } catch (error) {
          console.error("Erro:", error);
          setOptimisticChecks(prev => ({ ...prev, [key]: estadoAtual }));
          alert("Erro de conexão.");
      } finally { setLoadingCheck(prev => ({ ...prev, [key]: false })); }
  };

  const toggleDisciplina = (nome) => setExpandedDisciplinas(prev => ({ ...prev, [nome]: !prev[nome] }));

  const confirmStartStudy = (disciplina, assunto) => {
      if (onStartStudy) {
          onStartStudy(disciplina, assunto);
          setStudyModalData(null);
      }
  };

  const handleStartTopicStudy = (disciplina, assuntoNome) => {
      setStudyModalData({ disciplina, assunto: assuntoNome });
  };

  // --- TRATAMENTO DE ESTADOS (LOADING E VAZIO) ---

  // 1. Carregando
  if (loading) return (
      <div className="flex h-96 items-center justify-center">
          <div className="animate-spin w-8 h-8 border-4 border-red-600 rounded-full border-t-transparent"></div>
      </div>
  );

  // 2. Sem Ciclo Ativo (Empty State)
  if (!activeCicloId || !ciclo) {
      return (
          <div className="flex flex-col items-center justify-center h-[60vh] text-center px-4 animate-fade-in">
              <div className="w-24 h-24 bg-zinc-100 dark:bg-zinc-800 rounded-full flex items-center justify-center mb-6 shadow-inner">
                  <LayoutDashboard size={40} className="text-zinc-400" strokeWidth={1.5} />
              </div>
              <h2 className="text-2xl font-black text-zinc-900 dark:text-white mb-2">Nenhum Ciclo Ativo</h2>
              <p className="text-zinc-500 max-w-md text-sm mb-8 leading-relaxed">
                  Parece que você ainda não ativou uma missão. Vá para a área de <strong>Ciclos</strong> para selecionar ou criar seu novo plano de estudos.
              </p>

              {/* Botão de ação opcional (se tiver onBack ou lógica de navegação) */}
              {onBack && (
                  <button
                      onClick={onBack}
                      className="flex items-center gap-2 px-6 py-3 bg-red-600 text-white rounded-xl font-bold hover:bg-red-700 transition-all shadow-lg shadow-red-600/20 active:scale-95"
                  >
                      <PlusCircle size={18} />
                      Ativar Novo Ciclo
                  </button>
              )}
          </div>
      );
  }

  // --- CONTEÚDO PRINCIPAL (COM DADOS) ---
  return (
    <div className="w-full space-y-6 animate-fade-in pb-24">
        {studyModalData && (
            <StartStudyModal
                disciplina={studyModalData.disciplina}
                assunto={studyModalData.assunto}
                onClose={() => setStudyModalData(null)}
                onConfirm={confirmStartStudy}
            />
        )}

        {/* --- HEADER DASHBOARD --- */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">

            {/* CARD 1: INFO DO CICLO */}
            <div className="lg:col-span-2 bg-white dark:bg-zinc-900 rounded-3xl p-6 md:p-8 border border-zinc-200 dark:border-zinc-800 shadow-sm relative overflow-hidden flex flex-col md:flex-row items-center md:items-start gap-6 text-center md:text-left">
                <div className="w-20 h-20 md:w-28 md:h-28 bg-zinc-50 dark:bg-zinc-950 rounded-full border-4 border-white dark:border-zinc-800 shadow-xl flex items-center justify-center flex-shrink-0 relative z-10">
                    {ciclo?.computedLogo ? (
                        <img src={ciclo.computedLogo} alt="Logo" className="w-14 h-14 md:w-16 md:h-16 object-contain" />
                    ) : (
                        <GraduationCap size={40} className="text-zinc-300 dark:text-zinc-600" />
                    )}
                    <div className="absolute -bottom-2 px-2 py-0.5 bg-emerald-500 text-white text-[9px] font-bold uppercase tracking-widest rounded-full shadow-md border-2 border-white dark:border-zinc-900">
                        Ativo
                    </div>
                </div>

                <div className="flex-1 z-10 w-full">
                    <div className="flex items-start justify-between w-full mb-2">
                        <div className="inline-flex items-center gap-2 px-3 py-1 bg-red-50 dark:bg-red-900/20 rounded-full text-[13px] font-bold uppercase tracking-wider border border-red-100 dark:border-red-900/50 text-red-600 dark:text-red-400">
                            <CheckCircle2 size={17} /> Edital Verticalizado
                        </div>

                        {onBack && (
                            <button
                                onClick={onBack}
                                className="flex items-center gap-2 px-3 py-1.5 rounded-lg
                                           bg-white hover:bg-red-50 border border-zinc-200 hover:border-red-200
                                           dark:bg-zinc-800 dark:hover:bg-red-900/10 dark:border-zinc-700 dark:hover:border-red-900/30
                                           text-zinc-600 hover:text-red-700 dark:text-zinc-300 dark:hover:text-red-400
                                           text-[11px] font-bold uppercase tracking-wide transition-all group w-fit shadow-sm z-20"
                            >
                                <LayoutDashboard size={14} className="text-red-600 dark:text-red-500 group-hover:scale-110 transition-transform" />
                                <span className="hidden sm:inline">Painel do Ciclo</span>
                                <ChevronRight size={12} className="opacity-60 group-hover:translate-x-1 transition-transform" />
                            </button>
                        )}
                    </div>

                    <h1 className="text-2xl md:text-4xl font-black text-zinc-900 dark:text-white uppercase tracking-tight leading-none mb-3">
                        {ciclo?.nome || 'Missão Sem Nome'}
                    </h1>

                    <div className="mt-6 w-full">
                        <div className="flex justify-between items-end mb-2">
                            <span className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Cobertura Global</span>
                            <div className="flex items-baseline gap-1">
                                <span className="text-2xl font-black text-red-600 dark:text-red-500">{statsGlobal.percentual.toFixed(0)}</span>
                                <span className="text-sm font-bold text-zinc-400">%</span>
                            </div>
                        </div>
                        <div className="flex gap-1 h-2.5 w-full">
                            {Array.from({ length: 30 }).map((_, i) => (
                                <div key={i} className={`flex-1 rounded-sm transition-all duration-700 ${i < (statsGlobal.percentual / 3.33) ? 'bg-red-600 dark:bg-red-500' : 'bg-zinc-100 dark:bg-zinc-800'}`} />
                            ))}
                        </div>
                        <div className="flex justify-between text-[10px] text-zinc-400 font-bold uppercase mt-2">
                            <span>{statsGlobal.concluidos} Itens Concluídos</span>
                            <span>{statsGlobal.total} Itens Totais</span>
                        </div>
                    </div>
                </div>

                <div className="absolute right-0 top-0 p-10 opacity-5 pointer-events-none transform rotate-12">
                    <BookOpen size={200} />
                </div>
            </div>

            {/* CARD 2: RADAR DE PRIORIDADE */}
            <div className={`rounded-3xl p-6 relative overflow-hidden flex flex-col justify-center shadow-lg border transition-all
                ${disciplinaPrioritaria?.tipoPrioridade === 'critical' ? 'bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-900' :
                  disciplinaPrioritaria?.tipoPrioridade === 'warning' ? 'bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900' :
                  'bg-gradient-to-br from-zinc-50 to-white dark:from-zinc-900 dark:to-black border-zinc-200 dark:border-zinc-800'}`
            }>
                {disciplinaPrioritaria ? (
                    <>
                        <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none text-red-500"><Target size={120}/></div>
                        <div className="relative z-10">
                            <div className="flex items-center gap-2 mb-4">
                                <div className={`p-2 rounded-lg animate-pulse ${
                                    disciplinaPrioritaria.tipoPrioridade === 'critical' ? 'bg-red-200 text-red-700 dark:bg-red-900/50 dark:text-red-400' :
                                    disciplinaPrioritaria.tipoPrioridade === 'warning' ? 'bg-amber-200 text-amber-700 dark:bg-amber-900/50 dark:text-amber-400' :
                                    'bg-indigo-100 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400'
                                }`}>
                                    {disciplinaPrioritaria.tipoPrioridade === 'critical' ? <AlertTriangle size={18} /> :
                                     disciplinaPrioritaria.tipoPrioridade === 'warning' ? <RefreshCcw size={18} /> :
                                     <Zap size={18} fill="currentColor" />}
                                </div>
                                <span className={`text-xs font-black uppercase tracking-widest ${
                                    disciplinaPrioritaria.tipoPrioridade === 'critical' ? 'text-red-700 dark:text-red-400' :
                                    disciplinaPrioritaria.tipoPrioridade === 'warning' ? 'text-amber-700 dark:text-amber-400' :
                                    'text-indigo-600 dark:text-indigo-400'
                                }`}>
                                    {disciplinaPrioritaria.motivoPrioridade}
                                </span>
                            </div>

                            <h3 className="text-xl font-black text-zinc-800 dark:text-white mb-2 line-clamp-2 leading-tight">
                                {disciplinaPrioritaria.nome}
                            </h3>

                            <div className="flex flex-col gap-1 mb-5">
                                <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400 flex items-center gap-1.5">
                                    <TrendingUp size={14} className="text-zinc-400"/>
                                    {disciplinaPrioritaria.detalhePrioridade}
                                </p>
                            </div>

                            <button onClick={() => setStudyModalData({ disciplina: disciplinaPrioritaria, assunto: null })} className={`w-full py-3.5 text-white font-bold rounded-xl shadow-lg flex items-center justify-center gap-2 transition-all active:scale-95 group text-sm uppercase tracking-wide
                                ${disciplinaPrioritaria.tipoPrioridade === 'critical' ? 'bg-red-600 hover:bg-red-700 shadow-red-600/30' :
                                  disciplinaPrioritaria.tipoPrioridade === 'warning' ? 'bg-amber-600 hover:bg-amber-700 shadow-amber-600/30' :
                                  'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-600/30'}`
                            }>
                                <Play size={14} fill="currentColor" /> Iniciar Sessão
                            </button>
                        </div>
                    </>
                ) : (
                    <div className="flex flex-col items-center justify-center text-center h-full text-zinc-400">
                        <CheckCircle2 size={48} className="mb-2 text-emerald-500"/>
                        <p className="font-bold text-zinc-700 dark:text-zinc-300">Edital Dominado!</p>
                        <p className="text-xs">Você concluiu todos os tópicos.</p>
                    </div>
                )}
            </div>
        </div>

        {/* --- BARRA DE BUSCA --- */}
        <div className="sticky top-4 z-20 px-1">
            <div className="relative group">
                <div className="absolute -inset-0.5 bg-gradient-to-r from-red-500 to-orange-500 rounded-2xl opacity-0 group-focus-within:opacity-20 transition duration-500 blur-md"></div>
                <div className="relative flex items-center bg-white dark:bg-zinc-950/90 backdrop-blur-md rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-xl">
                    <Search className="ml-4 text-zinc-400" size={20} />
                    <input
                        type="text"
                        placeholder="Filtrar disciplina ou tópico..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full p-4 bg-transparent text-sm font-bold text-zinc-800 dark:text-white outline-none placeholder:text-zinc-500"
                    />
                    {searchTerm && <button onClick={() => setSearchTerm('')} className="mr-4 text-zinc-400 hover:text-red-500"><X size={16} /></button>}
                </div>
            </div>
        </div>

        {/* --- LISTA DE DISCIPLINAS --- */}
        <div className="space-y-4 px-4 md:px-0">
            {editalProcessado.length === 0 && (
                <div className="text-center py-20 bg-zinc-50 dark:bg-zinc-900/50 rounded-3xl border-2 border-dashed border-zinc-200 dark:border-zinc-800">
                    <AlertCircle size={40} className="mx-auto text-zinc-300 mb-4"/>
                    <p className="text-zinc-500 font-bold">Nenhum conteúdo encontrado.</p>
                </div>
            )}

            {editalProcessado.map((disc, idx) => {
                const desempenhoConfig = getDesempenhoConfig(disc.stats.desempenho, disc.stats.questoes);
                const DesempenhoIcon = desempenhoConfig.icon;

                return (
                <div key={idx} className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-2xl overflow-hidden shadow-sm hover:border-red-200 dark:hover:border-red-900/30 transition-all duration-300">

                    {/* CABEÇALHO DA DISCIPLINA */}
                    <div className="flex flex-col lg:flex-row lg:items-stretch">
                        <button onClick={() => toggleDisciplina(disc.nome)} className="flex-1 flex items-center gap-5 p-5 text-left cursor-pointer group">
                            <div className="relative">
                                <div className={`w-12 h-12 rounded-xl flex items-center justify-center border transition-colors ${disc.progresso === 100 ? 'bg-emerald-100 dark:bg-emerald-900/20 text-emerald-600 border-emerald-200 dark:border-emerald-800' : 'bg-zinc-100 dark:bg-zinc-900 text-zinc-500 border-zinc-200 dark:border-zinc-800 group-hover:text-red-500'}`}>
                                    {disc.progresso === 100 ? <CheckCircle2 size={22} /> : <LayoutGrid size={22} />}
                                </div>
                                <svg className="absolute -top-1 -left-1 w-14 h-14 pointer-events-none" viewBox="0 0 100 100">
                                    <circle cx="50" cy="50" r="48" fill="none" stroke="currentColor" className="text-zinc-200 dark:text-zinc-800" strokeWidth="2" />
                                    <circle cx="50" cy="50" r="48" fill="none" stroke={disc.progresso === 100 ? '#10b981' : '#dc2626'} strokeWidth="2" strokeDasharray="301.59" strokeDashoffset={301.59 * (1 - disc.progresso / 100)} transform="rotate(-90 50 50)" className="transition-all duration-1000 ease-out" />
                                </svg>
                            </div>

                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                    <h3 className="font-bold text-zinc-900 dark:text-white text-base md:text-lg truncate group-hover:text-red-600 dark:group-hover:text-red-400 transition-colors">{disc.nome}</h3>

                                    {Number(disc.peso) >= 3 && (
                                        <div className="hidden sm:flex items-center gap-1 px-2 py-0.5 bg-orange-100 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400 rounded-full border border-orange-200 dark:border-orange-900/30 animate-pulse">
                                            <Flame size={10} fill="currentColor" />
                                            <span className="text-[9px] font-bold uppercase tracking-wide">Alta Relevância</span>
                                        </div>
                                    )}
                                </div>

                                <div className="flex flex-wrap items-center gap-2 mt-2">
                                    <span className="px-2 py-1 rounded-md bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 text-[10px] font-bold uppercase flex items-center gap-1">
                                        <CheckSquare size={12} /> {disc.concluidos}/{disc.totalAssuntos} Tópicos
                                    </span>

                                    <span className="px-2 py-1 rounded-md bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300 text-[10px] font-bold uppercase flex items-center gap-1">
                                        <Clock size={12} /> {formatMinutesToTime(disc.stats.minutos)}
                                    </span>

                                    <span className={`px-2 py-1 rounded-md text-[10px] font-bold uppercase flex items-center gap-1 ${desempenhoConfig.style}`}>
                                        <DesempenhoIcon size={12} /> {desempenhoConfig.label} De Precisão
                                    </span>
                                </div>
                            </div>
                            <ChevronDown size={20} className={`text-zinc-400 transition-transform ${expandedDisciplinas[disc.nome] ? 'rotate-180' : ''}`}/>
                        </button>

                        <div className="flex items-center justify-end gap-3 p-4 lg:p-5 border-t lg:border-t-0 lg:border-l border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-black/10">
                            <div className="hidden sm:flex flex-col items-end mr-2">
                                <span className="text-[10px] font-bold text-zinc-400 uppercase">Último Estudo</span>
                                <span className="text-xs font-mono text-zinc-700 dark:text-zinc-300">{formatDateRelative(disc.stats.ultimaData)}</span>
                            </div>
                            <button onClick={() => setStudyModalData({ disciplina: disc, assunto: null })} className="w-full sm:w-auto px-5 py-2.5 bg-zinc-900 dark:bg-white hover:bg-red-600 dark:hover:bg-red-600 text-white dark:text-black hover:text-white dark:hover:text-white rounded-lg font-bold text-xs uppercase tracking-wide shadow transition-all active:scale-95 flex items-center justify-center gap-2">
                                <Play size={12} fill="currentColor" /> Estudar
                            </button>
                        </div>
                    </div>

                    <AnimatePresence>
                        {expandedDisciplinas[disc.nome] && (
                            <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} className="border-t border-zinc-100 dark:border-zinc-800 bg-zinc-50/30 dark:bg-black/20">
                                <div className="divide-y divide-zinc-100 dark:divide-zinc-800/50">
                                    {disc.assuntos.map((assunto, i) => {
                                        const questStats = getProgressStats(assunto.acertos, assunto.questoes);
                                        const hasActivity = assunto.minutos > 0 || assunto.questoes > 0;
                                        const isHot = assunto.relevancia >= 4 && !assunto.estudado;

                                        return (
                                        <div
                                            key={i}
                                            className={`flex flex-col md:flex-row md:items-center p-4 sm:px-6 transition-all gap-4 hover:bg-white dark:hover:bg-zinc-800/50
                                                ${assunto.estudado ? 'bg-emerald-50/40 dark:bg-emerald-900/10' : ''}
                                            `}
                                        >
                                            <div className="flex items-start gap-4 flex-1 relative">
                                                <button
                                                    onClick={() => handleToggleCheck(disc.id, disc.nome, assunto.nome, assunto.estudado)}
                                                    disabled={loadingCheck[`${disc.nome}-${assunto.nome}`.toLowerCase().trim()]}
                                                    className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all flex-shrink-0 shadow-sm z-10 ${
                                                        assunto.estudado
                                                        ? 'bg-emerald-500 text-white shadow-emerald-500/20'
                                                        : 'bg-white dark:bg-zinc-800 border-2 border-zinc-200 dark:border-zinc-700 text-zinc-300 dark:text-zinc-600 hover:border-red-400 hover:text-red-400'
                                                    }`}
                                                >
                                                    {loadingCheck[`${disc.nome}-${assunto.nome}`.toLowerCase().trim()] ? <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin"/> : <CheckSquare size={18} strokeWidth={3} />}
                                                </button>

                                                <div className="flex-1 min-w-0 z-10">
                                                    <div className="flex items-center gap-2 flex-wrap">
                                                        <p className={`text-[15px] leading-snug ${assunto.estudado ? 'text-zinc-500 dark:text-zinc-500 line-through decoration-2 decoration-emerald-500/50 font-medium' : 'text-zinc-800 dark:text-zinc-100 font-bold'}`}>{assunto.nome}</p>

                                                        {isHot && (
                                                            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-gradient-to-r from-orange-500 to-red-500 text-white shadow-sm ml-2">
                                                                <Flame size={14} fill="currentColor" className="drop-shadow-sm" />
                                                                <span className="text-[10px] font-bold uppercase tracking-wider leading-none whitespace-nowrap">
                                                                    Altas Chances
                                                                </span>
                                                            </div>
                                                        )}
                                                    </div>
                                                    {!hasActivity && !assunto.estudado && <p className="text-xs text-red-500 font-medium mt-1 flex items-center gap-1"><AlertCircle size={10}/> Não iniciado</p>}
                                                </div>
                                            </div>

                                            <div className="flex items-center justify-end gap-4 w-full md:w-auto pl-14 md:pl-0 z-10">
                                                {(hasActivity || assunto.estudado) && (
                                                    <>
                                                        <div className="flex flex-col items-center justify-center bg-white dark:bg-zinc-800 rounded-lg border border-zinc-200 dark:border-zinc-700 p-2 min-w-[70px] shadow-sm" title="Tempo Total Estudado">
                                                            <Clock size={16} className="text-zinc-400 mb-1"/>
                                                            <span className="text-xs font-black text-zinc-700 dark:text-zinc-300">{formatMinutesToTime(assunto.minutos)}</span>
                                                        </div>

                                                        <div className="flex-1 md:flex-none md:w-36 flex flex-col gap-1.5" title={`Desempenho: ${questStats.perc}% (${assunto.acertos}/${assunto.questoes})`}>
                                                            <div className="flex justify-between items-center text-xs font-bold">
                                                                <span className={`flex items-center gap-1 ${questStats.colorText}`}><Target size={12}/> {questStats.perc}%</span>
                                                                <span className="text-zinc-400 text-[10px]">{assunto.acertos}/{assunto.questoes}</span>
                                                            </div>
                                                            <div className="h-2.5 w-full bg-zinc-100 dark:bg-zinc-700 rounded-full overflow-hidden shadow-inner">
                                                                <motion.div
                                                                    initial={{ width: 0 }} animate={{ width: `${questStats.width}%` }} transition={{ duration: 0.5, ease: "easeOut" }}
                                                                    className={`h-full rounded-full ${questStats.colorBg} shadow-sm relative`}
                                                                >
                                                                    <div className="absolute inset-0 bg-white/20 animate-pulse hidden sm:block"></div>
                                                                </motion.div>
                                                            </div>
                                                        </div>
                                                    </>
                                                )}

                                                <button
                                                    onClick={() => handleStartTopicStudy(disc, assunto.nome)}
                                                    className="p-2.5 rounded-xl bg-zinc-100 dark:bg-zinc-800 hover:bg-red-500 hover:text-white dark:hover:bg-red-600 transition-all text-zinc-400 dark:text-zinc-500"
                                                    title="Estudar este tópico"
                                                >
                                                    <Play size={16} fill="currentColor" />
                                                </button>
                                            </div>
                                        </div>
                                    )})}
                                    {disc.assuntos.length === 0 && <div className="p-6 text-center text-xs text-zinc-400 italic">Sem tópicos cadastrados.</div>}
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            )})}
        </div>
    </div>
  );
}

export default EditalPage;