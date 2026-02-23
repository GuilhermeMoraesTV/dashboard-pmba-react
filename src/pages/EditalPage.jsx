import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../firebaseConfig';
import {
  collection, getDoc, doc, getDocs, query, where,
  addDoc, serverTimestamp, deleteDoc, onSnapshot, writeBatch, updateDoc
} from 'firebase/firestore';
import {
  BookOpen, CheckCircle2, ChevronDown,
  Search, AlertCircle, Play,
  Target, CheckSquare, Clock,
  Flame, AlertTriangle, Trophy, LayoutDashboard,
  ChevronRight, LayoutGrid, GraduationCap, X, Ban, RefreshCw, ArrowUpCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

import { CATALOGO_EDITAIS } from '../pages/AdminPage/EditaisManager';
import { useForceUnlock } from '../hooks/useForceUnlock';

// --- UTILITÁRIOS ---
const normalize = (str) => str ? str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase() : "";

const formatDateRelative = (dateString) => {
    if (!dateString) return '-';
    let date;
    try {
        if (dateString.toDate) date = dateString.toDate();
        else if (typeof dateString === 'string') date = new Date(dateString);
        else if (typeof dateString === 'number') date = new Date(dateString);
        else date = new Date();
    } catch (e) { return '-'; }

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

const getProgressStats = (acertos, total) => {
    const nTotal = Number(total) || 0;
    const nAcertos = Number(acertos) || 0;
    if (nTotal === 0) return { width: 0, colorBg: 'bg-zinc-200 dark:bg-zinc-700', colorText: 'text-zinc-400', perc: 0 };
    const perc = Math.round((nAcertos / nTotal) * 100);
    let colorBg = 'bg-red-500';
    let colorText = 'text-red-600 dark:text-red-400';
    if (perc >= 50) { colorBg = 'bg-amber-500'; colorText = 'text-amber-600 dark:text-amber-400'; }
    if (perc >= 80) { colorBg = 'bg-emerald-500'; colorText = 'text-emerald-600 dark:text-emerald-400'; }
    return { width: perc, colorBg, colorText, perc };
};

const getDesempenhoConfig = (perc, questoes) => {
    if (!questoes || questoes === 0) return { style: 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-500 border border-zinc-200 dark:border-zinc-700', icon: Target, label: '0%' };
    if (perc >= 85) return { style: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 border border-yellow-200 dark:border-yellow-700/50 shadow-sm shadow-yellow-500/10', icon: Trophy, label: `${perc}%` };
    if (perc >= 70) return { style: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-700/50', icon: CheckCircle2, label: `${perc}%` };
    return { style: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-700/50', icon: AlertTriangle, label: `${perc}%` };
};

const getLogo = (ciclo) => {
    if (!ciclo) return null;
    if (ciclo.logoUrl) return ciclo.logoUrl;
    if (ciclo.templateId && ciclo.templateId !== 'manual') {
        const editalTemplate = CATALOGO_EDITAIS.find(e => e.id === ciclo.templateId);
        if (editalTemplate) return editalTemplate.logoUrl || editalTemplate.logo;
        const idLimpo = ciclo.templateId.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
        return `/logosEditais/logo-${idLimpo}.png`;
    }
    const nomeLower = ciclo.nome?.toLowerCase() || "";
    if (nomeLower.includes("pmba")) return "/logosEditais/logo-pmba.png";
    return null;
};

// ==================================================================================
// 📚 BOOK STACK BADGE
// ==================================================================================
const BookStackBadge = ({ count }) => {
    const visualStackCount = Math.min(count, 5);
    const isZero = count <= 0;

    let colorClass = 'bg-zinc-300 dark:bg-zinc-700';
    let textColor = 'text-zinc-400';

    if (count >= 1 && count <= 2) {
        colorClass = 'bg-emerald-500 shadow-emerald-500/30';
        textColor = 'text-emerald-600 dark:text-emerald-400';
    } else if (count >= 3 && count <= 4) {
        colorClass = 'bg-blue-500 shadow-blue-500/30';
        textColor = 'text-blue-600 dark:text-blue-400';
    } else if (count >= 5 && count <= 6) {
        colorClass = 'bg-amber-500 shadow-amber-500/30';
        textColor = 'text-amber-600 dark:text-amber-400';
    } else if (count >= 7) {
        colorClass = 'bg-red-600 shadow-red-600/40 animate-pulse';
        textColor = 'text-red-600 dark:text-red-400';
    }

    return (
        <div className="flex flex-col items-end w-14 shrink-0">
            <span className="text-[9px] font-bold text-zinc-400 uppercase tracking-wider mb-0.5">
                Revisões
            </span>
            <div className="flex items-center gap-1.5">
                 <span className={`text-xs font-black ${isZero ? 'text-zinc-300 dark:text-zinc-600' : textColor}`}>
                    {count}x
                </span>
                <div className="flex items-end gap-[2px] h-3">
                    {isZero ? (
                         <div className="w-1.5 h-1 rounded-[1px] bg-zinc-200 dark:bg-zinc-800" />
                    ) : (
                        Array.from({ length: visualStackCount }).map((_, i) => (
                            <motion.div
                                key={i}
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: `${(i + 1) * 3}px`, opacity: 1 }}
                                transition={{ duration: 0.3, delay: i * 0.1 }}
                                className={`w-1.5 rounded-[1px] ${colorClass} shadow-sm`}
                            />
                        ))
                    )}
                </div>
            </div>
        </div>
    );
};

const StartStudyModal = ({ disciplina, assunto, onClose, onConfirm }) => {
    if (!disciplina) return null;
    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in" onClick={onClose}>
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} onClick={(e) => e.stopPropagation()} className="bg-white dark:bg-zinc-900 w-full max-w-sm rounded-3xl p-6 shadow-2xl border border-zinc-200 dark:border-zinc-800 text-center relative">
                <div className="w-16 h-16 bg-red-100 dark:bg-red-900/20 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg shadow-red-500/20"><Clock size={32} /></div>
                <h3 className="text-xl font-black text-zinc-900 dark:text-white mb-2">Iniciar Sessão?</h3>
                <div className="text-sm text-zinc-500 mb-6 px-4">Você vai iniciar o cronômetro para estudar:<br/><strong className="text-zinc-800 dark:text-zinc-200 text-base block mt-1">{disciplina.nome}</strong>{assunto && (<span className="block mt-1 text-emerald-600 dark:text-emerald-400 font-bold text-xs bg-emerald-100 dark:bg-emerald-900/30 py-1 px-2 rounded-lg mx-auto w-fit">{assunto}</span>)}</div>
                <div className="flex gap-3"><button onClick={onClose} className="flex-1 py-3 rounded-xl font-bold text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors">Cancelar</button><button onClick={() => onConfirm(disciplina, assunto)} className="flex-1 py-3 rounded-xl bg-red-600 text-white font-bold hover:bg-red-700 shadow-lg shadow-red-600/30 transition-transform active:scale-95 flex items-center justify-center gap-2"><Play size={18} fill="currentColor"/> Iniciar</button></div>
            </motion.div>
        </div>
    );
};

// ============================================================================
// 🔥 COMPONENTE PRINCIPAL
// ============================================================================
function EditalPage({ user, activeCicloId, onStartStudy, onBack }) {
  useForceUnlock();
  const [ciclo, setCiclo] = useState(null);
  const [disciplinas, setDisciplinas] = useState([]);
  const [registros, setRegistros] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedDisciplinas, setExpandedDisciplinas] = useState({});
  const [searchTerm, setSearchTerm] = useState('');
  const [optimisticChecks, setOptimisticChecks] = useState({});
  const [loadingCheck, setLoadingCheck] = useState({});
  const [studyModalData, setStudyModalData] = useState(null);

  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [templateData, setTemplateData] = useState(null);
  const [updatingEdital, setUpdatingEdital] = useState(false);

  useEffect(() => {
    let unsubscribeDisciplinas = () => {};
    let unsubscribeCiclo = () => {};
    let unsubscribeTemplate = () => {};
    let unsubscribeRegistros = () => {};

    const fetchData = async () => {
      if (!user || !activeCicloId) {
          setLoading(false);
          return;
      }

      try {
        setLoading(true);

        const cicloRef = doc(db, 'users', user.uid, 'ciclos', activeCicloId);
        unsubscribeCiclo = onSnapshot(cicloRef, (docSnap) => {
            if (!docSnap.exists()) return;

            const data = docSnap.data();
            setCiclo({ id: docSnap.id, ...data, computedLogo: getLogo(data) });

            const hasTemplate = data.templateId && data.templateId !== 'manual';
            if (!hasTemplate) {
                if (unsubscribeTemplate) unsubscribeTemplate();
                return;
            }

            let cicloDate = new Date(0);
            if (data.lastEditalUpdate?.toDate) {
                cicloDate = data.lastEditalUpdate.toDate();
            } else if (data.criadoEm?.toDate) {
                cicloDate = data.criadoEm.toDate();
            } else if (data.criadoEm instanceof Date) {
                cicloDate = data.criadoEm;
            } else if (data.criadoEm) {
                cicloDate = new Date(data.criadoEm);
            }

            const templateRef = doc(db, 'editais_templates', data.templateId);
            if (unsubscribeTemplate) unsubscribeTemplate();

            unsubscribeTemplate = onSnapshot(templateRef, (tSnap) => {
                if (!tSnap.exists()) return;

                const tData = tSnap.data();
                let templateDate = null;

                if (tData.lastUpdate?.toDate) {
                    templateDate = tData.lastUpdate.toDate();
                }

                const temUpdate = !!(templateDate && templateDate > cicloDate);

                if (temUpdate) {
                    setTemplateData(tData);
                    setUpdateAvailable(true);
                } else {
                    setUpdateAvailable(false);
                }
            });
        });

        const disciplinasRef = collection(db, 'users', user.uid, 'ciclos', activeCicloId, 'disciplinas');
        unsubscribeDisciplinas = onSnapshot(query(disciplinasRef), (snapshot) => {
             const listaDisciplinas = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
             listaDisciplinas.sort((a, b) => {
                 const idxA = a.index !== undefined ? Number(a.index) : 9999;
                 const idxB = b.index !== undefined ? Number(b.index) : 9999;
                 if (idxA !== idxB) return idxA - idxB;
                 return (a.nome || '').localeCompare(b.nome || '');
             });
             setDisciplinas(listaDisciplinas);
             setLoading(false);
        });

        const registrosRef = collection(db, 'users', user.uid, 'registrosEstudo');
        const qRegistros = query(registrosRef, where('cicloId', '==', activeCicloId));

        unsubscribeRegistros = onSnapshot(qRegistros, (snapshot) => {
             const listaRegistros = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
             setRegistros(listaRegistros);
        });

      } catch (error) {
          console.error("Erro geral no useEffect:", error);
          setLoading(false);
      }
    };

    fetchData();

    return () => {
        unsubscribeCiclo();
        unsubscribeDisciplinas();
        unsubscribeRegistros();
        if (unsubscribeTemplate) unsubscribeTemplate();
    };
  }, [user, activeCicloId]);

  const handleUpdateEdital = async () => {
      if (!templateData || !user || !activeCicloId) return;
      setUpdatingEdital(true);
      try {
          const batch = writeBatch(db);
          const userDisciplinasMap = {};
          disciplinas.forEach(d => { userDisciplinasMap[normalize(d.nome)] = d; });
          const novasDisciplinas = templateData.disciplinas || [];

          for (let i = 0; i < novasDisciplinas.length; i++) {
              const novaDiscTemplate = novasDisciplinas[i];
              const nomeNorm = normalize(novaDiscTemplate.nome);
              const discExistente = userDisciplinasMap[nomeNorm];
              const assuntosTemplate = (novaDiscTemplate.assuntos || []).map(a =>
                  typeof a === 'string' ? { nome: a, relevancia: 1 } : a
              ).filter(a => a && a.nome);

              if (discExistente) {
                  const discRef = doc(db, 'users', user.uid, 'ciclos', activeCicloId, 'disciplinas', discExistente.id);
                  const updatePayload = { index: i, nome: novaDiscTemplate.nome };
                  const assuntosUsuarioExistentes = new Set(
                      (discExistente.assuntos || []).map(a =>
                          typeof a === 'string' ? normalize(a) : normalize(a.nome || '')
                      )
                  );
                  const novosAssuntosParaAdicionar = assuntosTemplate.filter(at =>
                      !assuntosUsuarioExistentes.has(normalize(at.nome))
                  );
                  if (novosAssuntosParaAdicionar.length > 0) {
                      updatePayload.assuntos = [...(discExistente.assuntos || []), ...novosAssuntosParaAdicionar];
                  }
                  batch.update(discRef, updatePayload);
              } else {
                  const novaDiscRef = doc(collection(db, 'users', user.uid, 'ciclos', activeCicloId, 'disciplinas'));
                  batch.set(novaDiscRef, {
                      nome: novaDiscTemplate.nome, assuntos: assuntosTemplate,
                      peso: novaDiscTemplate.peso || 3, tempoAlocadoSemanalMinutos: 60,
                      inCiclo: true, index: i, criadoEm: serverTimestamp()
                  });
              }
          }

          const cicloRef = doc(db, 'users', user.uid, 'ciclos', activeCicloId);
          batch.update(cicloRef, { lastEditalUpdate: serverTimestamp(), editalVersion: templateData.version || serverTimestamp() });
          await batch.commit();
          setUpdateAvailable(false);
          alert("✅ Ciclo atualizado com sucesso!");
      } catch (error) {
          console.error("Erro ao atualizar:", error);
          alert("❌ Erro ao atualizar o edital. Tente novamente.");
      } finally {
          setUpdatingEdital(false);
      }
  };

  const { editalProcessado, statsGlobal } = useMemo(() => {
    if (!disciplinas.length) return { editalProcessado: [], statsGlobal: { total: 0, concluidos: 0, percentual: 0 } };
    const mapaDetalhado = {};
    const statsPorDisciplina = {};
    registros.forEach(reg => {
        if (!statsPorDisciplina[reg.disciplinaNome]) statsPorDisciplina[reg.disciplinaNome] = { acertos: 0, questoes: 0, lastDate: null, minutes: 0 };
        const s = statsPorDisciplina[reg.disciplinaNome];
        s.acertos += Number(reg.acertos || 0);
        s.questoes += Number(reg.questoesFeitas || 0);
        s.minutes += Number(reg.tempoEstudadoMinutos || 0);
        if (!s.lastDate || reg.data > s.lastDate) s.lastDate = reg.data;
        if (reg.assunto) {
            const key = `${reg.disciplinaNome}-${reg.assunto}`.toLowerCase().trim();
            if (!mapaDetalhado[key]) mapaDetalhado[key] = { count: 0, minutes: 0, questions: 0, correct: 0, lastDate: null, hasManualCheck: false };
            mapaDetalhado[key].count += 1;
            mapaDetalhado[key].minutes += Number(reg.tempoEstudadoMinutos || 0);
            mapaDetalhado[key].questions += Number(reg.questoesFeitas || 0);
            mapaDetalhado[key].correct += Number(reg.acertos || 0);
            if (reg.tipoEstudo === 'check_manual') mapaDetalhado[key].hasManualCheck = true;
            if (!mapaDetalhado[key].lastDate || reg.data > mapaDetalhado[key].lastDate) mapaDetalhado[key].lastDate = reg.data;
        }
    });
    let totalTopicosGlobal = 0;
    let totalConcluidosGlobal = 0;
    const listaProcessada = disciplinas.map(disc => {
        const listaAssuntos = Array.isArray(disc.assuntos) ? disc.assuntos : [];
        const statsDisc = statsPorDisciplina[disc.nome] || { acertos: 0, questoes: 0, lastDate: null, minutes: 0 };
        const desempenhoDisc = statsDisc.questoes > 0 ? Math.round((statsDisc.acertos / statsDisc.questoes) * 100) : 0;
        const assuntosProcessados = listaAssuntos.map(itemAssunto => {
            const nomeAssunto = typeof itemAssunto === 'string' ? itemAssunto : itemAssunto.nome;
            const relevanciaAssunto = typeof itemAssunto === 'object' ? (itemAssunto.relevancia || 1) : 1;
            const isTopicInCiclo = typeof itemAssunto === 'object' ? (itemAssunto.inCiclo !== false) : true;
            const key = `${disc.nome}-${nomeAssunto}`.toLowerCase().trim();
            const dadosDB = mapaDetalhado[key];
            const isOptimistic = optimisticChecks[key];
            const estudadoFinal = isOptimistic !== undefined ? isOptimistic : !!dadosDB?.hasManualCheck;
            return { nome: nomeAssunto, relevancia: relevanciaAssunto, estudado: estudadoFinal, qtdVezes: dadosDB?.count || 0, ultimaVez: dadosDB?.lastDate || null, minutos: dadosDB?.minutes || 0, questoes: dadosDB?.questions || 0, acertos: dadosDB?.correct || 0, inCiclo: isTopicInCiclo };
        });
        const totalAssuntos = assuntosProcessados.length;
        const concluidos = assuntosProcessados.filter(a => a.estudado).length;
        totalTopicosGlobal += totalAssuntos;
        totalConcluidosGlobal += concluidos;
        return { ...disc, assuntos: assuntosProcessados, progresso: totalAssuntos > 0 ? (concluidos / totalAssuntos) * 100 : 0, totalAssuntos, concluidos, inCiclo: disc.inCiclo !== false, stats: { desempenho: desempenhoDisc, questoes: statsDisc.questoes, ultimaData: statsDisc.lastDate, minutos: statsDisc.minutes } };
    }).filter(d => {
        const termo = searchTerm.toLowerCase();
        return d.nome.toLowerCase().includes(termo) || d.assuntos.some(a => a.nome.toLowerCase().includes(termo));
    });
    return { editalProcessado: listaProcessada, statsGlobal: { total: totalTopicosGlobal, concluidos: totalConcluidosGlobal, percentual: totalTopicosGlobal > 0 ? (totalConcluidosGlobal / totalTopicosGlobal) * 100 : 0 } };
  }, [disciplinas, registros, searchTerm, optimisticChecks]);

  const handleToggleCheck = async (disciplinaId, disciplinaNome, assuntoNome, estadoAtual) => {
      const key = `${disciplinaNome}-${assuntoNome}`.toLowerCase().trim();
      const novoEstado = !estadoAtual;
      setOptimisticChecks(prev => ({ ...prev, [key]: novoEstado }));
      setLoadingCheck(prev => ({ ...prev, [key]: true }));
      try {
          if (novoEstado) {
              await addDoc(collection(db, 'users', user.uid, 'registrosEstudo'), { cicloId: activeCicloId, disciplinaId, disciplinaNome, assunto: assuntoNome, data: new Date().toISOString().split('T')[0], timestamp: serverTimestamp(), tempoEstudadoMinutos: 0, questoesFeitas: 0, acertos: 0, tipoEstudo: 'check_manual', obs: 'Check Manual' });
          } else {
              const regRef = collection(db, 'users', user.uid, 'registrosEstudo');
              const q = query(regRef, where('cicloId', '==', activeCicloId), where('assunto', '==', assuntoNome));
              const snapshot = await getDocs(q);
              const docParaDeletar = snapshot.docs.find(d => { const data = d.data(); return normalize(data.disciplinaNome) === normalize(disciplinaNome) && data.tipoEstudo === 'check_manual'; }) || snapshot.docs.find(d => normalize(d.data().disciplinaNome) === normalize(disciplinaNome));
              if (docParaDeletar) await deleteDoc(docParaDeletar.ref);
          }
          setOptimisticChecks(prev => { const s = { ...prev }; delete s[key]; return s; });
      } catch (error) {
          setOptimisticChecks(prev => ({ ...prev, [key]: estadoAtual }));
          alert("Erro de conexão. Tente novamente.");
      } finally {
          setLoadingCheck(prev => ({ ...prev, [key]: false }));
      }
  };

  const toggleDisciplina = (nome) => setExpandedDisciplinas(prev => ({ ...prev, [nome]: !prev[nome] }));
  const confirmStartStudy = (disciplina, assunto) => { if (onStartStudy) { onStartStudy(disciplina, assunto); setStudyModalData(null); } };
  const handleStartTopicStudy = (disciplina, assuntoNome) => setStudyModalData({ disciplina, assunto: assuntoNome });

  if (loading) return (
      <div className="flex h-96 items-center justify-center">
          <div className="animate-spin w-8 h-8 border-4 border-red-600 rounded-full border-t-transparent"></div>
      </div>
  );

  // ── EMPTY STATE (sem ciclo ativo) — padrão CiclosList ──
  if (!activeCicloId || !ciclo) {
      return (
          <div className="p-0 min-h-[50vh] animate-fade-in pb-12">
              {/* Título */}
              <div className="mb-6 md:mb-8 flex flex-col md:flex-row justify-between items-start md:items-end gap-4 border-b border-zinc-200 dark:border-zinc-800 pb-4 md:pb-6">
                  <div>
                      <div className="flex items-center gap-3 mb-1 md:mb-2">
                          <div className="p-2 md:p-2.5 bg-red-100 dark:bg-red-900/20 text-red-600 dark:text-red-500 rounded-xl">
                              <BookOpen size={24} className="md:w-7 md:h-7" strokeWidth={2} />
                          </div>
                          <h1 className="text-2xl md:text-3xl font-black text-zinc-800 dark:text-white tracking-tight uppercase">
                              Edital
                          </h1>
                      </div>
                  </div>
              </div>

              {/* Empty state */}
              <div className="flex flex-col items-center justify-center py-20 text-center bg-zinc-50 dark:bg-zinc-900/50 rounded-3xl border-2 border-dashed border-zinc-200 dark:border-zinc-800">
                  <LayoutDashboard size={40} className="md:w-12 md:h-12 text-zinc-300 mb-4" />
                  <h3 className="text-lg md:text-xl font-bold text-zinc-700 dark:text-zinc-300 mb-1">Nenhum Ciclo Ativo</h3>
                  <p className="text-zinc-500 text-sm mb-6">Parece que você ainda não ativou uma missão.</p>
                  {onBack && (
                      <button
                          onClick={onBack}
                          className="px-6 py-2 bg-red-600 text-white rounded-lg font-bold text-sm hover:bg-red-700"
                      >
                          Ir para Ciclos
                      </button>
                  )}
              </div>
          </div>
      );
  }

  return (
    <div className="w-full space-y-6 animate-fade-in pb-24">
        {studyModalData && (<StartStudyModal disciplina={studyModalData.disciplina} assunto={studyModalData.assunto} onClose={() => setStudyModalData(null)} onConfirm={confirmStartStudy} />)}

        {/* ALERTA DE ATUALIZAÇÃO */}
        <AnimatePresence>
            {updateAvailable && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.3 }} className="overflow-hidden">
                    <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-sm mx-4 md:mx-0">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-blue-100 dark:bg-blue-800/50 rounded-full text-blue-600 dark:text-blue-300 flex-shrink-0">
                                <RefreshCw size={20} className={updatingEdital ? "animate-spin" : ""} />
                            </div>
                            <div>
                                <h3 className="text-sm font-bold text-blue-800 dark:text-blue-200">Atualização Disponível</h3>
                                <p className="text-xs text-blue-600 dark:text-blue-300/80">O edital base foi atualizado. Sincronize para receber novos tópicos sem perder seu progresso.</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2 w-full sm:w-auto flex-shrink-0">
                            <button onClick={() => setUpdateAvailable(false)} className="px-4 py-2 rounded-xl text-xs font-bold text-blue-600 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-800/30 transition-colors">Ignorar</button>
                            <button onClick={handleUpdateEdital} disabled={updatingEdital} className="flex-1 sm:flex-none px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-md shadow-blue-500/20 transition-all active:scale-95 flex items-center justify-center gap-2 disabled:opacity-60">
                                {updatingEdital ? "Atualizando..." : <><ArrowUpCircle size={14} /> Atualizar Agora</>}
                            </button>
                        </div>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>

        {/* HEADER */}
        <div className="w-full">
            <div className="bg-white dark:bg-zinc-900 rounded-3xl p-6 md:p-8 border border-zinc-200 dark:border-zinc-800 shadow-sm relative overflow-hidden flex flex-col md:flex-row items-center md:items-start gap-6 text-center md:text-left">
                <div className="w-20 h-20 md:w-28 md:h-28 bg-zinc-50 dark:bg-zinc-950 rounded-full border-4 border-white dark:border-zinc-800 shadow-xl flex items-center justify-center flex-shrink-0 relative z-10">
                    {ciclo?.computedLogo ? (<img src={ciclo.computedLogo} alt="Logo" className="w-14 h-14 md:w-16 md:h-16 object-contain" />) : (<GraduationCap size={40} className="text-zinc-300 dark:text-zinc-600" />)}
                    <div className="absolute -bottom-2 px-2 py-0.5 bg-emerald-500 text-white text-[9px] font-bold uppercase tracking-widest rounded-full shadow-md border-2 border-white dark:border-zinc-900">Ativo</div>
                </div>
                <div className="flex-1 z-10 w-full">
                    <div className="flex items-start justify-between w-full mb-2">
                        <div className="inline-flex items-center gap-2 px-3 py-1 bg-red-50 dark:bg-red-900/20 rounded-full text-[13px] font-bold uppercase tracking-wider border border-red-100 dark:border-red-900/50 text-red-600 dark:text-red-400">
                            <CheckCircle2 size={17} /> Edital Verticalizado
                        </div>
                        {onBack && (
                            <button onClick={onBack} className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white hover:bg-red-50 border border-zinc-200 hover:border-red-200 dark:bg-zinc-800 dark:hover:bg-red-900/10 dark:border-zinc-700 dark:hover:border-red-900/30 text-zinc-600 hover:text-red-700 dark:text-zinc-300 dark:hover:text-red-400 text-[11px] font-bold uppercase tracking-wide transition-all group w-fit shadow-sm z-20">
                                <LayoutDashboard size={14} className="text-red-600 dark:text-red-500 group-hover:scale-110 transition-transform" />
                                <span className="hidden sm:inline">Painel do Ciclo</span>
                                <ChevronRight size={12} className="opacity-60 group-hover:translate-x-1 transition-transform" />
                            </button>
                        )}
                    </div>
                    <h1 className="text-2xl md:text-4xl font-black text-zinc-900 dark:text-white uppercase tracking-tight leading-none mb-3">{ciclo?.nome || 'Missão Sem Nome'}</h1>
                    <div className="mt-6 w-full">
                        <div className="flex justify-between items-end mb-2">
                            <span className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Cobertura Global</span>
                            <div className="flex items-baseline gap-1"><span className="text-2xl font-black text-red-600 dark:text-red-500">{statsGlobal.percentual.toFixed(0)}</span><span className="text-sm font-bold text-zinc-400">%</span></div>
                        </div>
                        <div className="flex gap-1 h-2.5 w-full">{Array.from({ length: 30 }).map((_, i) => (<div key={i} className={`flex-1 rounded-sm transition-all duration-700 ${i < (statsGlobal.percentual / 3.33) ? 'bg-red-600 dark:bg-red-500' : 'bg-zinc-100 dark:bg-zinc-800'}`} />))}</div>
                        <div className="flex justify-between text-[10px] text-zinc-400 font-bold uppercase mt-2"><span>{statsGlobal.concluidos} Itens Concluídos</span><span>{statsGlobal.total} Itens Totais</span></div>
                    </div>
                </div>
                <div className="absolute right-0 top-0 p-10 opacity-5 pointer-events-none transform rotate-12"><BookOpen size={200} /></div>
            </div>
        </div>

        {/* BARRA DE BUSCA */}
        <div className="sticky top-4 z-20 px-1">
            <div className="relative group">
                <div className="absolute -inset-0.5 bg-gradient-to-r from-red-500 to-orange-500 rounded-2xl opacity-0 group-focus-within:opacity-20 transition duration-500 blur-md"></div>
                <div className="relative flex items-center bg-white dark:bg-zinc-950/90 backdrop-blur-md rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-xl">
                    <Search className="ml-4 text-zinc-400" size={20} />
                    <input type="text" placeholder="Filtrar disciplina ou tópico..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full p-4 bg-transparent text-sm font-bold text-zinc-800 dark:text-white outline-none placeholder:text-zinc-500" />
                    {searchTerm && <button onClick={() => setSearchTerm('')} className="mr-4 text-zinc-400 hover:text-red-500"><X size={16} /></button>}
                </div>
            </div>
        </div>

        {/* LISTA DE DISCIPLINAS */}
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
                const isInCiclo = disc.inCiclo;
                return (
                <div key={idx} className={`bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-2xl overflow-hidden shadow-sm transition-all duration-300 ${isInCiclo ? 'hover:border-red-200 dark:hover:border-red-900/30' : 'opacity-70 hover:opacity-100'}`}>

                    <div className="flex flex-col md:flex-row md:items-stretch">

                        <div
                            onClick={() => toggleDisciplina(disc.nome)}
                            className="flex-1 flex items-center gap-5 p-5 text-left cursor-pointer group"
                        >
                            <div className="relative flex-shrink-0">
                                <div className={`w-12 h-12 rounded-xl flex items-center justify-center border transition-colors ${!isInCiclo ? 'bg-zinc-50 dark:bg-zinc-900/50 border-dashed border-zinc-300 dark:border-zinc-700 text-zinc-300' : disc.progresso === 100 ? 'bg-emerald-100 dark:bg-emerald-900/20 text-emerald-600 border-emerald-200 dark:border-emerald-800' : 'bg-zinc-100 dark:bg-zinc-900 text-zinc-500 border-zinc-200 dark:border-zinc-800 group-hover:text-red-500'}`}>
                                    {disc.progresso === 100 ? <CheckCircle2 size={22} /> : <LayoutGrid size={22} />}
                                </div>
                                {isInCiclo && (<svg className="absolute -top-1 -left-1 w-14 h-14 pointer-events-none" viewBox="0 0 100 100"><circle cx="50" cy="50" r="48" fill="none" stroke="currentColor" className="text-zinc-200 dark:text-zinc-800" strokeWidth="2" /><circle cx="50" cy="50" r="48" fill="none" stroke={disc.progresso === 100 ? '#10b981' : '#dc2626'} strokeWidth="2" strokeDasharray="301.59" strokeDashoffset={301.59 * (1 - disc.progresso / 100)} transform="rotate(-90 50 50)" className="transition-all duration-1000 ease-out" /></svg>)}
                            </div>

                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                    <h3 className={`font-bold text-base md:text-lg truncate transition-colors ${isInCiclo ? 'text-zinc-900 dark:text-white group-hover:text-red-600 dark:group-hover:text-red-400' : 'text-zinc-500 dark:text-zinc-500 line-through'}`}>{disc.nome}</h3>
                                    {!isInCiclo && (<div className="flex items-center gap-1 px-2 py-0.5 bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 rounded-full border border-zinc-200 dark:border-zinc-700"><Ban size={10} /><span className="text-[9px] font-bold uppercase tracking-wide">Fora do Ciclo</span></div>)}
                                    {isInCiclo && Number(disc.peso) >= 3 && (<div className="hidden sm:flex items-center gap-1 px-2 py-0.5 bg-orange-100 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400 rounded-full border border-orange-200 dark:border-orange-900/30 animate-pulse"><Flame size={10} fill="currentColor" /><span className="text-[9px] font-bold uppercase tracking-wide">Alta Relevância</span></div>)}
                                </div>

                                <div className="flex flex-wrap items-center gap-2 mt-2">
                                    <span className="px-2 py-1 rounded-md bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 text-[10px] font-bold uppercase flex items-center gap-1"><CheckSquare size={12} /> {disc.concluidos}/{disc.totalAssuntos} Tópicos</span>
                                    {isInCiclo && (
                                        <>
                                            <span className="px-2 py-1 rounded-md bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300 text-[10px] font-bold uppercase flex items-center gap-1"><Clock size={12} /> {formatMinutesToTime(disc.stats.minutos)}</span>
                                            <span className={`px-2 py-1 rounded-md text-[10px] font-bold uppercase flex items-center gap-1 ${desempenhoConfig.style}`}><DesempenhoIcon size={12} /> {desempenhoConfig.label} De Precisão</span>

                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setStudyModalData({ disciplina: disc, assunto: null });
                                                }}
                                                className="md:hidden flex items-center gap-1 px-2.5 py-1 bg-zinc-900 dark:bg-white hover:bg-red-600 dark:hover:bg-red-600 text-white dark:text-black hover:text-white dark:hover:text-white rounded-md text-[10px] font-bold uppercase tracking-wide shadow transition-all active:scale-95"
                                            >
                                                <Play size={10} fill="currentColor" /> Estudar
                                            </button>
                                        </>
                                    )}
                                </div>
                            </div>

                            <ChevronDown size={20} className={`text-zinc-400 transition-transform flex-shrink-0 ${expandedDisciplinas[disc.nome] ? 'rotate-180' : ''}`}/>
                        </div>

                        {isInCiclo ? (
                            <div className="hidden md:flex items-center justify-end gap-3 p-5 border-l border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-black/10">
                                <div className="flex flex-col items-end mr-2">
                                    <span className="text-[10px] font-bold text-zinc-400 uppercase">Último Estudo</span>
                                    <span className="text-xs font-mono text-zinc-700 dark:text-zinc-300">{formatDateRelative(disc.stats.ultimaData)}</span>
                                </div>
                                <button
                                    onClick={() => setStudyModalData({ disciplina: disc, assunto: null })}
                                    className="px-5 py-2.5 bg-zinc-900 dark:bg-white hover:bg-red-600 dark:hover:bg-red-600 text-white dark:text-black hover:text-white dark:hover:text-white rounded-lg font-bold text-xs uppercase tracking-wide shadow transition-all active:scale-95 flex items-center justify-center gap-2"
                                >
                                    <Play size={12} fill="currentColor" /> Estudar
                                </button>
                            </div>
                        ) : (
                            <div className="hidden md:flex items-center justify-end p-5 border-l border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-black/10">
                                <span className="text-xs font-bold text-zinc-400 uppercase px-4">Disciplina Inativa</span>
                            </div>
                        )}
                    </div>

                    {/* TÓPICOS EXPANDIDOS */}
                    <AnimatePresence>
                        {expandedDisciplinas[disc.nome] && (
                            <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} className="border-t border-zinc-100 dark:border-zinc-800 bg-zinc-50/30 dark:bg-black/20">
                                <div className="divide-y divide-zinc-100 dark:divide-zinc-800/50">
                                    {disc.assuntos.map((assunto, i) => {
                                        const questStats = getProgressStats(assunto.acertos, assunto.questoes);
                                        const hasActivity = assunto.minutos > 0 || assunto.questoes > 0;
                                        const isHot = assunto.relevancia >= 4 && !assunto.estudado;
                                        const isTopicInCiclo = assunto.inCiclo;

                                        return (
                                        <div key={i} className={`flex flex-col md:flex-row md:items-center p-4 sm:px-6 transition-all gap-4 hover:bg-white dark:hover:bg-zinc-800/50 ${assunto.estudado ? 'bg-emerald-50/40 dark:bg-emerald-900/10' : ''} ${!isTopicInCiclo ? 'opacity-60 bg-zinc-100/50 dark:bg-zinc-900/50' : ''}`}>

                                            <div className="flex items-start gap-4 flex-1 relative">
                                                <button onClick={() => handleToggleCheck(disc.id, disc.nome, assunto.nome, assunto.estudado)} disabled={loadingCheck[`${disc.nome}-${assunto.nome}`.toLowerCase().trim()] || !isTopicInCiclo} className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all flex-shrink-0 shadow-sm z-10 ${!isTopicInCiclo ? 'bg-zinc-100 dark:bg-zinc-800 text-zinc-300 cursor-not-allowed' : assunto.estudado ? 'bg-emerald-500 text-white shadow-emerald-500/20' : 'bg-white dark:bg-zinc-800 border-2 border-zinc-200 dark:border-zinc-700 text-zinc-300 dark:text-zinc-600 hover:border-red-400 hover:text-red-400'}`}>
                                                    {loadingCheck[`${disc.nome}-${assunto.nome}`.toLowerCase().trim()] ? <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin"/> : <CheckSquare size={18} strokeWidth={3} />}
                                                </button>
                                                <div className="flex-1 min-w-0 z-10">
                                                    <div className="flex items-center gap-2 flex-wrap">
                                                        <p className={`text-[15px] leading-snug ${assunto.estudado ? 'text-zinc-500 dark:text-zinc-500 line-through decoration-2 decoration-emerald-500/50 font-medium' : isTopicInCiclo ? 'text-zinc-800 dark:text-zinc-100 font-bold' : 'text-zinc-500 dark:text-zinc-500 line-through decoration-zinc-400'}`}>{assunto.nome}</p>
                                                        {!isTopicInCiclo && (<div className="flex items-center gap-1 px-1.5 py-0.5 bg-zinc-200 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 rounded text-[9px] font-bold uppercase tracking-wide">Fora do Ciclo</div>)}
                                                        {isHot && isInCiclo && isTopicInCiclo && (<div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-gradient-to-r from-orange-500 to-red-500 text-white shadow-sm ml-2"><Flame size={14} fill="currentColor" className="drop-shadow-sm" /><span className="text-[10px] font-bold uppercase tracking-wider leading-none whitespace-nowrap">Altas Chances</span></div>)}
                                                    </div>
                                                    {!hasActivity && !assunto.estudado && isTopicInCiclo && (<p className="text-xs text-red-500 font-medium mt-1 flex items-center gap-1"><AlertCircle size={10}/> Não iniciado</p>)}
                                                </div>
                                            </div>

                                            <div className="flex items-center justify-end gap-3 w-full md:w-auto pl-14 md:pl-0 z-10">
                                                <div className="mr-1">
                                                    <BookStackBadge count={assunto.qtdVezes} />
                                                </div>
                                                <div className="flex items-center gap-4 mr-2">
                                                    <div className="flex flex-col items-end w-14"><span className="text-[9px] font-bold text-zinc-400 uppercase tracking-wider mb-0.5">Tempo</span><span className="text-xs font-black text-zinc-700 dark:text-zinc-300">{formatMinutesToTime(assunto.minutos)}</span></div>
                                                    <div className="flex flex-col items-end w-20"><span className="text-[9px] font-bold text-zinc-400 uppercase tracking-wider mb-0.5">Questões</span><div className="flex items-center gap-1.5"><span className={`text-xs font-black ${questStats.colorText}`}>{questStats.perc}%</span><span className="text-[10px] font-medium text-zinc-400">({assunto.acertos}/{assunto.questoes})</span></div></div>
                                                </div>
                                                <button onClick={() => handleStartTopicStudy(disc, assunto.nome)} className="p-2.5 rounded-xl bg-zinc-100 dark:bg-zinc-800 hover:bg-red-500 hover:text-white dark:hover:bg-red-600 transition-all text-zinc-400 dark:text-zinc-500 shadow-sm" title="Estudar este tópico"><Play size={16} fill="currentColor" /></button>
                                            </div>
                                        </div>
                                    )})}
                                    {disc.assuntos.length === 0 && (<div className="p-6 text-center text-xs text-zinc-400 italic">Sem tópicos cadastrados.</div>)}
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