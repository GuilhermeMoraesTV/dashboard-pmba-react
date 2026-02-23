import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../firebaseConfig';
import { doc, collection, query, orderBy, onSnapshot, deleteDoc, updateDoc, getDoc } from 'firebase/firestore';
import { AnimatePresence, motion } from 'framer-motion';

import CicloVisual from '../components/ciclos/CicloVisual';
import RegistroEstudoModal from '../components/ciclos/RegistroEstudoModal';
import DisciplinaDetalheModal from '../components/ciclos/DisciplinaDetalheModal';
import ModalConclusaoCiclo from '../components/ciclos/ModalConclusaoCiclo';
import HistoricoModal from '../components/Dashboard/HistoricoModal';
import { useCiclos } from '../hooks/useCiclos';
import TimerSettingsModal, { useTimerSettings } from '../components/ciclos/StudyTimer/TimerSettingsModal';

import {
  ArrowLeft, Trophy, Target, CalendarDays,
  BookOpen, ChevronRight, History, Timer, X, Trash2,
  AlertOctagon, Shield, Plus, LayoutList
} from 'lucide-react';

// --- FUNÇÕES AUXILIARES ---
const formatVisualNumber = (minutes) => {
  if (!minutes || isNaN(minutes)) return '0h';
  let totalMinutes = Math.round(Number(minutes));
  const remainder = totalMinutes % 60;
  if (remainder > 50) totalMinutes = Math.ceil(totalMinutes / 60) * 60;
  const hours = Math.floor(totalMinutes / 60);
  const mins = totalMinutes % 60;
  if (hours === 0) return `${mins}m`;
  else if (mins === 0) return `${hours}h`;
  return `${hours}h ${mins}m`;
};

// --- MODAL DE CONFIRMAÇÃO DE EXCLUSÃO (ATUALIZADO PARA NÃO CORTAR) ---
const DeleteConfirmationModal = ({ isOpen, onClose, onConfirm, loading }) => {
    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="bg-white dark:bg-zinc-950 w-full max-w-xs rounded-2xl p-5 border border-zinc-200 dark:border-zinc-800 shadow-2xl text-center relative overflow-hidden max-h-[90vh] overflow-y-auto"
            >
                <div className="flex justify-center mb-3">
                    <div className="w-12 h-12 bg-red-50 dark:bg-red-900/20 text-red-600 rounded-full flex items-center justify-center shadow-inner">
                        <AlertOctagon size={24} />
                    </div>
                </div>
                <h3 className="text-base font-black text-zinc-900 dark:text-white uppercase mb-1">Excluir Registro?</h3>
                <p className="text-xs text-zinc-500 mb-4 px-2">Essa ação não pode ser desfeita.</p>
                <div className="flex gap-2">
                    <button onClick={onClose} className="flex-1 py-2 bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 rounded-lg font-bold text-[10px] uppercase tracking-wide hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors">Cancelar</button>
                    <button onClick={onConfirm} disabled={loading} className="flex-1 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-bold text-[10px] uppercase tracking-wide shadow-md flex items-center justify-center gap-1.5">{loading ? "..." : <><Trash2 size={12} /> Excluir</>}</button>
                </div>
            </motion.div>
        </div>
    );
};

// --- PÁGINA PRINCIPAL DO CICLO ---
function CicloDetalhePage({ cicloId, onBack, user, addRegistroEstudo, onStartStudy, onGoToEdital }) {
  const [ciclo, setCiclo] = useState(null);
  const [disciplinas, setDisciplinas] = useState([]);
  const [allRegistrosEstudo, setAllRegistrosEstudo] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showRegistroModal, setShowRegistroModal] = useState(false);
  const [registroPreenchido, setRegistroPreenchido] = useState(null);
  const [disciplinaEmDetalhe, setDisciplinaEmDetalhe] = useState(null);
  const [selectedDisciplinaId, setSelectedDisciplinaId] = useState(null);
  const [showConclusaoModal, setShowConclusaoModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);

  // ESTADO DA LOGO DINÂMICA
  const [dynamicLogo, setDynamicLogo] = useState(null);

  const [showTimerSettings, setShowTimerSettings] = useState(false);
  const { updateSettings } = useTimerSettings(user?.uid);

  const [recordToDelete, setRecordToDelete] = useState(null);

  const { concluirCicloSemanal, loading: cicloActionLoading } = useCiclos(user);
  const [cicloLoaded, setCicloLoaded] = useState(false);
  const [disciplinasLoaded, setDisciplinasLoaded] = useState(false);
  const [registrosLoaded, setRegistrosLoaded] = useState(false);

  // === 🔥 BUSCA ROBUSTA DA LOGO ===
  useEffect(() => {
    const fetchEditalLogo = async () => {
        if (!ciclo || !user) return;

        if (ciclo.logoUrl && ciclo.logoUrl.trim() !== '') {
            setDynamicLogo(ciclo.logoUrl);
            return;
        }

        const editalId = ciclo.editalId || ciclo.templateId || ciclo.templateOrigem;
        if (editalId && editalId !== 'manual') {
            try {
                const docRef = doc(db, 'editais_templates', editalId);
                const docSnap = await getDoc(docRef);
                if (docSnap.exists()) {
                    const data = docSnap.data();
                    const foundLogo = data.logoUrl || data.logo;
                    if (foundLogo) {
                        setDynamicLogo(foundLogo);
                        try {
                            const cicloRef = doc(db, 'users', user.uid, 'ciclos', cicloId);
                            await updateDoc(cicloRef, { logoUrl: foundLogo });
                        } catch (err) { console.warn("Erro no auto-reparo da logo:", err); }
                        return;
                    }
                }
            } catch (err) { console.error("Erro ao buscar logo do edital:", err); }
        }

        const nomeLower = (ciclo.nome || '').toLowerCase();
        let logoFallback = null;
        if (nomeLower.includes('pm') && !nomeLower.includes('gcm')) logoFallback = '/logosEditais/logo-pm.png';
        else if (nomeLower.includes('pc')) logoFallback = '/logosEditais/logo-pc.png';
        else if (nomeLower.includes('cbm') || nomeLower.includes('bombeiro')) logoFallback = '/logosEditais/logo-cbm.png';
        setDynamicLogo(logoFallback);
    };

    if (cicloLoaded && ciclo) {
        fetchEditalLogo();
    }
  }, [ciclo, cicloLoaded, user, cicloId]);

  // === CONTROLE DA POSIÇÃO DO TIMER ===
  useEffect(() => {
    const shouldRaiseTop = showTimerSettings;
    if (shouldRaiseTop) {
        window.dispatchEvent(new CustomEvent('toggle-timer-raise', { detail: 'top' }));
    } else {
        window.dispatchEvent(new CustomEvent('toggle-timer-raise', { detail: true }));
    }
  }, [showTimerSettings]);

  useEffect(() => {
    return () => {
        window.dispatchEvent(new CustomEvent('toggle-timer-raise', { detail: false }));
    };
  }, []);

  // UseEffects de carregamento de dados
  useEffect(() => { if (!user || !cicloId) return; const cicloRef = doc(db, 'users', user.uid, 'ciclos', cicloId); const unsubscribe = onSnapshot(cicloRef, (docSnap) => { if (docSnap.exists()) { const data = docSnap.data(); const rawDate = (data.ultimaConclusao?.toDate) ? data.ultimaConclusao.toDate() : (data.dataCriacao?.toDate ? data.dataCriacao.toDate() : new Date()); const cicloCompleto = { id: docSnap.id, ...data, cargaHorariaSemanalTotal: Number(data.cargaHorariaSemanalTotal || 0), conclusoes: Number(data.conclusoes || 0), dataInicioAtual: rawDate }; setCiclo(cicloCompleto); setCicloLoaded(true); } else { setCiclo(null); setCicloLoaded(true); } }, (error) => { console.error("Erro no snapshot do ciclo:", error); setCicloLoaded(true); }); return () => unsubscribe(); }, [user, cicloId]);
  useEffect(() => { if (!user || !cicloId) return; const q = query(collection(db, 'users', user.uid, 'ciclos', cicloId, 'disciplinas'), orderBy('nome')); const unsubscribe = onSnapshot(q, (snap) => { setDisciplinas(snap.docs.map(doc => ({ id: doc.id, ...doc.data() }))); setDisciplinasLoaded(true); }, (error) => { console.error(error); setDisciplinasLoaded(true); }); return () => unsubscribe(); }, [user, cicloId]);
  useEffect(() => { if (!user) return; const q = query(collection(db, 'users', user.uid, 'registrosEstudo'), orderBy('timestamp', 'desc')); const unsubscribe = onSnapshot(q, (snap) => { setAllRegistrosEstudo(snap.docs.map(doc => { const data = doc.data(); let finalDataStr = data.data; return { id: doc.id, ...data, tempoEstudadoMinutos: Number(data.tempoEstudadoMinutos || 0), questoesFeitas: Number(data.questoesFeitas || 0), acertos: Number(data.acertos || 0), data: finalDataStr, timestamp: (data.timestamp && typeof data.timestamp.toDate === 'function') ? data.timestamp.toDate() : new Date(0) }; })); setRegistrosLoaded(true); }, (error) => { console.error(error); setRegistrosLoaded(true); }); return () => unsubscribe(); }, [user]);
  useEffect(() => { if (cicloLoaded && disciplinasLoaded && registrosLoaded) setLoading(false); }, [cicloLoaded, disciplinasLoaded, registrosLoaded]);

  // Cálculos
  const registrosAtivosDaSemana = useMemo(() => allRegistrosEstudo.filter(reg => reg.cicloId === cicloId && !reg.conclusaoId), [allRegistrosEstudo, cicloId]);
  const registrosHistoricoCompleto = useMemo(() => allRegistrosEstudo.filter(reg => reg.cicloId === cicloId), [allRegistrosEstudo, cicloId]);
  const { totalEstudado, totalMeta, progressoGeral, registrosPorDisciplina } = useMemo(() => { if (!disciplinas.length) return { totalEstudado: 0, totalMeta: 0, progressoGeral: 0, registrosPorDisciplina: {} }; const totalMetaRaw = disciplinas.reduce((acc, d) => acc + Number(d.tempoAlocadoSemanalMinutos || 0), 0); const totalMetaCalc = Math.round(totalMetaRaw); const registrosPorDisciplina = {}; let totalEstudadoCalc = 0; registrosAtivosDaSemana.forEach(reg => { const minutos = Number(reg.tempoEstudadoMinutos); totalEstudadoCalc += minutos; const discId = reg.disciplinaId; if (discId) registrosPorDisciplina[discId] = (registrosPorDisciplina[discId] || 0) + minutos; }); const prog = totalMetaCalc > 0 ? (totalEstudadoCalc / totalMetaCalc) * 100 : 0; return { totalEstudado: Math.round(totalEstudadoCalc), totalMeta: totalMetaCalc, progressoGeral: prog, registrosPorDisciplina }; }, [disciplinas, registrosAtivosDaSemana]);
  const isAllDisciplinesMet = useMemo(() => { if (!ciclo?.ativo || !disciplinas.length || totalMeta === 0) return false; return disciplinas.every(d => { const meta = Number(d.tempoAlocadoSemanalMinutos || 0); const feito = registrosPorDisciplina[d.id] || 0; return meta > 0 ? feito >= meta : true; }); }, [disciplinas, registrosPorDisciplina, ciclo?.ativo, totalMeta]);

  // Handlers
  const handleConfirmDeleteRegistro = async () => { if(recordToDelete) await deleteDoc(doc(db,'users',user.uid,'registrosEstudo', recordToDelete.id)); setRecordToDelete(null); };
  const handleUpdateRegistro = async (id, data) => { await updateDoc(doc(db,'users',user.uid,'registrosEstudo', id), data); };
  const handleViewDetails = (d) => { setDisciplinaEmDetalhe(d); setSelectedDisciplinaId(d.id); };
  const handleStartStudy = (d) => { if(onStartStudy) onStartStudy(d); };
  const openRegistroModalWithTopic = (dId, t) => { const d = disciplinas.find(x=>x.id===dId); if(d) { setRegistroPreenchido({disciplinaId: d.id, topicoId: t.id}); setShowRegistroModal(true); } };
  const handleConcluirCiclo = async () => { await concluirCicloSemanal(cicloId); setShowConclusaoModal(false); onBack(); };
  const canConcludeCiclo = ciclo?.ativo && progressoGeral >= 100 && isAllDisciplinesMet;
  const showEmptyMessage = !disciplinas.length;

  if (loading) return <div className="flex justify-center p-10"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-red-500"></div></div>;
  if (!ciclo) return <div className="p-10 text-center text-zinc-500">Ciclo não encontrado.</div>;

  let formattedStartDate = '...';
  if (ciclo.dataInicioAtual) {
      const start = new Date(ciclo.dataInicioAtual);
      formattedStartDate = start.toLocaleDateString('pt-BR', {day:'2-digit', month:'2-digit'});
  }

  // Variantes para animação dos botões flutuantes (FAB)
  const fabContainerVariants = {
    rest: { width: 56, transition: { type: "tween", duration: 0.15, ease: "easeOut" } },
    hover: { width: "auto", transition: { type: "tween", duration: 0.15, ease: "easeOut" } }
  };
  const fabTextVariants = {
    rest: { opacity: 0, width: 0, marginLeft: 0, display: "none" },
    hover: { opacity: 1, width: "auto", marginLeft: 8, display: "block" }
  };

  // --- RENDERIZAÇÃO ---
  return (
    <div className="relative flex flex-col h-full animate-fade-in">
      <div className="mb-4">
          {/* HEADER SUPERIOR */}
          <div className="flex items-center justify-between mb-4">
              <button onClick={onBack} className="flex items-center gap-2 text-zinc-500 hover:text-zinc-800 dark:hover:text-white text-xs font-bold uppercase tracking-wider transition-colors"><ArrowLeft size={16} /> Voltar</button>
              <div className="flex items-center gap-3">
                  {ciclo.ativo && canConcludeCiclo && (
                      <button onClick={() => setShowConclusaoModal(true)} disabled={cicloActionLoading} className="flex items-center justify-center gap-2 px-4 py-2 bg-emerald-600 text-white text-xs font-bold uppercase tracking-wide rounded-xl shadow-md hover:bg-emerald-700 transition-colors animate-pulse"><Trophy size={16} /> Concluir Missão ({ciclo.conclusoes}x)</button>
                  )}
              </div>
          </div>

          {/* CARD DO CICLO (RESUMO GERAL) */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-zinc-50 dark:bg-zinc-900 px-6 py-4 rounded-2xl border border-zinc-300 dark:border-zinc-800 shadow-sm relative overflow-hidden">
              {dynamicLogo ? (
                  <div className="absolute -bottom-4 -right-4 w-32 h-32 md:w-44 md:h-44 opacity-20 md:opacity-10 dark:opacity-30 dark:md:opacity-20 pointer-events-none transform rotate-[-10deg] z-0 filter saturate-150 transition-all duration-500">
                      <img src={dynamicLogo} alt="Logo Edital" className="w-full h-full object-contain" onError={(e) => { e.target.style.display = 'none'; }} />
                  </div>
              ) : (
                  <div className="absolute -bottom-4 -right-4 w-32 h-32 md:w-44 md:h-44 opacity-5 dark:opacity-10 pointer-events-none flex items-center justify-center">
                      <Shield size={120} className="text-zinc-400 dark:text-zinc-500" />
                  </div>
              )}

              <div className="flex-1 z-10">
                  <div className="flex flex-col gap-3">
                      <div className="flex items-center gap-3">
                          <h1 className="text-3xl font-black text-zinc-900 dark:text-white uppercase tracking-tight leading-none">{ciclo.nome}</h1>
                          {ciclo.ativo ? (<span className="flex h-3 w-3 relative"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span><span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span></span>) : (<span className="px-2 py-0.5 rounded bg-zinc-200 dark:bg-zinc-800 text-[10px] font-bold text-zinc-500 uppercase">Arquivado</span>)}
                      </div>
                      <div className="flex flex-col sm:flex-row gap-3 sm:gap-6">
                        <div className="flex items-center gap-4">
                            <div className="flex items-center gap-1.5 text-zinc-400"><CalendarDays size={13} /><p className="text-[10px] font-bold uppercase tracking-wide">Início: <span className="text-zinc-600 dark:text-zinc-300">{formattedStartDate}</span></p></div>
                        </div>
                        <button onClick={onGoToEdital} className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white hover:bg-red-50 border border-zinc-200 hover:border-red-200 dark:bg-zinc-800 dark:hover:bg-red-900/10 dark:border-zinc-700 dark:hover:border-red-900/30 text-zinc-600 hover:text-red-700 dark:text-zinc-300 dark:hover:text-red-400 text-[11px] font-bold uppercase tracking-wide transition-all group w-fit shadow-sm z-20">
                            <BookOpen size={14} className="text-red-600 dark:text-red-500 group-hover:scale-110 transition-transform" /><span>Acessar Edital</span><ChevronRight size={12} className="opacity-60 group-hover:translate-x-1 transition-transform" />
                        </button>
                      </div>
                  </div>
              </div>

              <div className="flex items-center gap-6 z-10">
                  <div className="text-center hidden sm:block"><p className="text-[10px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-1">Meta</p><p className="text-xl font-black text-zinc-800 dark:text-white font-mono">{formatVisualNumber(totalMeta)}</p></div>
                  <div className="w-px h-10 bg-zinc-200 dark:bg-zinc-700 hidden sm:block"></div>
                  <div className="text-center hidden sm:block"><p className="text-[10px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-1">Feito</p><p className="text-xl font-black text-zinc-800 dark:text-white font-mono">{formatVisualNumber(totalEstudado)}</p></div>
                  <div className="relative">
                      <svg className="w-24 h-24 -rotate-90" viewBox="0 0 80 80">
                          <circle cx="40" cy="40" r="34" fill="none" stroke="currentColor" className="text-zinc-200 dark:text-zinc-800" strokeWidth="6" />
                          <motion.circle cx="40" cy="40" r="34" fill="none" stroke="currentColor" className={progressoGeral >= 100 && isAllDisciplinesMet ? 'text-emerald-500' : progressoGeral > 0 ? 'text-yellow-500' : 'text-zinc-400'} strokeWidth="6" strokeLinecap="round" strokeDasharray={2 * Math.PI * 34} initial={{ strokeDashoffset: 2 * Math.PI * 34 }} animate={{ strokeDashoffset: 2 * Math.PI * 34 * (1 - Math.min(progressoGeral, 100) / 100) }} transition={{ duration: 1.5, ease: "easeOut" }} />
                      </svg>
                      <div className="absolute inset-0 flex flex-col items-center justify-center"><span className={`text-xl font-black ${progressoGeral >= 100 && isAllDisciplinesMet ? 'text-emerald-500' : progressoGeral > 0 ? 'text-yellow-500' : 'text-zinc-400'}`}>{progressoGeral.toFixed(0)}%</span></div>
                  </div>
              </div>
          </div>

          {/* --- NOVA BARRA DE FERRAMENTAS MINIMALISTA (OPÇÃO 1) --- */}
          <div className="flex items-center justify-between mt-8 mb-4 px-2">
              <h3 className="text-sm font-bold text-zinc-400 uppercase tracking-widest flex items-center gap-2">
                 <LayoutList size={16} /> Meu Progresso
              </h3>

              <div className="flex items-center gap-1 bg-zinc-100 dark:bg-zinc-800/50 p-1 rounded-lg">
                   <button
                      onClick={() => setShowTimerSettings(true)}
                      className="flex items-center gap-2 px-3 py-1.5 rounded-md text-[10px] font-bold uppercase tracking-wide text-zinc-500 hover:text-blue-600 hover:bg-white dark:hover:bg-zinc-800 transition-all"
                      title="Configurar Cronômetro"
                  >
                      <Timer size={14} />
                      <span className="hidden sm:inline">Configuração do Cronômetro</span>
                  </button>

                  <div className="w-px h-4 bg-zinc-300 dark:bg-zinc-700 mx-1"></div>

                   <button
                      onClick={() => setShowHistoryModal(true)}
                      className="flex items-center gap-2 px-3 py-1.5 rounded-md text-[10px] font-bold uppercase tracking-wide text-zinc-500 hover:text-indigo-600 hover:bg-white dark:hover:bg-zinc-800 transition-all"
                      title="Ver Histórico Completo"
                  >
                      <History size={14} />
                      <span className="hidden sm:inline">Histórico de Estudos</span>
                  </button>
              </div>
          </div>
      </div>

      {!showEmptyMessage && (
          <div className="flex-grow">
              <CicloVisual
                  selectedDisciplinaId={selectedDisciplinaId}
                  onSelectDisciplina={setSelectedDisciplinaId}
                  onViewDetails={handleViewDetails}
                  onStartStudy={handleStartStudy}
                  disciplinas={disciplinas.map(d => ({ ...d, progressoEstudadoMinutos: registrosPorDisciplina[d.id] || 0 }))}
                  registrosEstudo={registrosAtivosDaSemana}
                  viewMode={'total'}
                  ciclo={ciclo}
              />
          </div>
      )}

      {showEmptyMessage && (
        <div className="flex flex-col items-center justify-center py-20 text-center bg-zinc-50 dark:bg-zinc-900/50 rounded-3xl border-2 border-dashed border-zinc-200 dark:border-zinc-800 mt-8">
            <Target size={48} className="text-zinc-300 mb-4" />
            <h3 className="text-xl font-bold text-zinc-700 dark:text-zinc-300 mb-1">Ciclo Sem Disciplinas</h3>
            <p className="text-zinc-500 text-sm mb-6">Adicione matérias para começar.</p>
        </div>
      )}

      {/* --- BOTÃO FLUTUANTE SIMPLIFICADO (SÓ REGISTRAR) --- */}
      {ciclo.ativo && (
          <div className="fixed bottom-8 right-8 z-50 flex flex-col items-end gap-3 pointer-events-none">
                <div className="relative flex items-center justify-end pointer-events-auto">
                    <motion.button layout onClick={() => setShowRegistroModal(true)} className="bg-red-600 hover:bg-red-700 text-white shadow-2xl flex items-center justify-center border-4 border-white dark:border-zinc-950 overflow-hidden h-16 rounded-full" variants={fabContainerVariants} initial="rest" whileHover="hover" whileTap="rest">
                        <div className="flex items-center px-5 min-w-[64px] justify-center">
                            <Plus size={30} strokeWidth={3} className="shrink-0" />
                            <motion.span className="whitespace-nowrap text-sm font-bold uppercase tracking-wide overflow-hidden ml-2" variants={fabTextVariants}>Registrar Estudo</motion.span>
                        </div>
                    </motion.button>
                </div>
          </div>
      )}

      {/* Modais */}
      <AnimatePresence>
        {/* Passando className para garantir altura máxima no desktop */}
        {showTimerSettings && (
            <TimerSettingsModal
                isOpen={showTimerSettings}
                onClose={() => setShowTimerSettings(false)}
                onSave={updateSettings}
                className="md:max-h-[85vh] md:overflow-y-auto"
            />
        )}

        {showConclusaoModal && <ModalConclusaoCiclo ciclo={ciclo} onClose={() => setShowConclusaoModal(false)} onConfirm={handleConcluirCiclo} loading={cicloActionLoading} progressoGeral={progressoGeral} />}
        {disciplinaEmDetalhe && <DisciplinaDetalheModal disciplina={disciplinaEmDetalhe} registrosEstudo={registrosAtivosDaSemana} cicloId={cicloId} user={user.uid} onClose={() => { setDisciplinaEmDetalhe(null); setSelectedDisciplinaId(null); }} onQuickAddTopic={openRegistroModalWithTopic} />}
        {showRegistroModal && <RegistroEstudoModal onClose={() => setShowRegistroModal(false)} addRegistroEstudo={addRegistroEstudo} cicloId={cicloId} userId={user.uid} disciplinasDoCiclo={disciplinas} initialData={registroPreenchido} />}

        {showHistoryModal && (
            <HistoricoModal
                isOpen={showHistoryModal}
                onClose={() => setShowHistoryModal(false)}
                registros={registrosHistoricoCompleto}
                onDeleteRequest={(r) => setRecordToDelete(r)}
                onUpdateRecord={handleUpdateRegistro}
                title="Histórico do Ciclo"
                className="md:max-h-[85vh] md:overflow-y-auto"
            />
        )}

        {recordToDelete && <DeleteConfirmationModal isOpen={!!recordToDelete} onClose={() => setRecordToDelete(null)} onConfirm={handleConfirmDeleteRegistro} />}
      </AnimatePresence>
      <div className="h-12"></div>
    </div>
  );
}

export default CicloDetalhePage;