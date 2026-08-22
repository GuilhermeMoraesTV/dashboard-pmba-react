import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  collection, query, orderBy, onSnapshot, doc, Timestamp, updateDoc, addDoc, deleteDoc
} from 'firebase/firestore';
import { db } from '../../firebaseConfig';
import { AlertTriangle, ClipboardList, Zap, ArrowRight } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';

// Importação dos Módulos Separados
import HeaderSimulado from './HeaderSimulado';
import SimuladosList from './SimuladosList';
import SimuladoCreationModal from './SimuladoCreationModal';
import SimuladoEditModal from './SimuladoEditModal';
import SimuladoComparisonModal from './SimuladoComparisonModal';
import StartSimuladoModal from './StartSimuladoModal';

// --- GAMIFICAÇÃO ---
import { useLevelSystem } from '../../hooks/useLevelSystem';
import { useForceUnlock } from '../../hooks/useForceUnlock';

const SimuladosPage = ({ user, activeCycleDisciplines, onStartSimulado, initialData, onClearInitialData }) => {
  useForceUnlock();
  const { processSimuladoResult, checkAndAwardMilestone } = useLevelSystem(user);

  const [simulados, setSimulados] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isStartModalOpen, setIsStartModalOpen] = useState(false);
  const [editModal, setEditModal] = useState({ open: false, item: null });

  const [compareMode, setCompareMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState([]);
  const [showArena, setShowArena] = useState(false);
  const simuladosListRef = useRef(null);

  const [finishedSimuladoData, setFinishedSimuladoData] = useState(null);
  const [toast, setToast] = useState(null);

  const showToast = (message, type = 'error') => {
    setToast({ message, type });
    window.setTimeout(() => setToast(null), 3200);
  };

  useEffect(() => {
    if (initialData) {
      setFinishedSimuladoData(initialData);
      setIsModalOpen(true);
    }
  }, [initialData]);

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, 'users', user.uid, 'simulados'), orderBy('data', 'desc'));
    const unsub = onSnapshot(q, (snapshot) => {
      setSimulados(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });
    return () => unsub();
  }, [user]);

  // --- CRUD OPERATIONS ---
  const handleCreate = async (data) => {
    try {
      // 1. Salvar o Simulado no Banco de Dados
      await addDoc(collection(db, 'users', user.uid, 'simulados'), {
        ...data,
        timestamp: Timestamp.now()
      });

      // 2. Processar Gamificação
      await checkAndAwardMilestone('FIRST_SIMULADO');
      await processSimuladoResult(data);

    } catch (e) {
      showToast('Erro ao salvar simulado. Tente novamente.');
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
      showToast('Erro ao atualizar simulado. Tente novamente.');
      console.error(e);
    }
  };

  const handleConfirmDelete = async (item) => {
    if (item) {
      try {
        await deleteDoc(doc(db, 'users', user.uid, 'simulados', item.id));
        if (selectedIds.includes(item.id)) {
          setSelectedIds(prev => prev.filter(id => id !== item.id));
        }
      } catch (e) {
        showToast('Erro ao excluir simulado. Tente novamente.');
      }
    }
  };

  // --- LÓGICA DE NEGÓCIO ---
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
    else setSelectedIds([...selectedIds, id]);
  };

  const filteredSimulados = useMemo(() => {
    const term = searchTerm.toLowerCase();
    return simulados.filter(s => (s.titulo || '').toLowerCase().includes(term) || (s.banca || '').toLowerCase().includes(term));
  }, [simulados, searchTerm]);

  const selectedSimulados = useMemo(() => {
    const map = new Map(simulados.map(s => [s.id, s]));
    return selectedIds.map(id => map.get(id)).filter(Boolean);
  }, [selectedIds, simulados]);

  const handleEnterCompareMode = () => {
    setCompareMode(true);

    if (window.matchMedia('(max-width: 639px)').matches) {
      window.setTimeout(() => {
        simuladosListRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 90);
    }
  };

  return (
    <div className="pb-20 animate-fade-in min-h-screen text-zinc-800 dark:text-zinc-200">
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: -14, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -14, scale: 0.96 }}
            className="fixed left-1/2 top-4 z-[120] flex w-[calc(100%-2rem)] max-w-md -translate-x-1/2 items-center gap-3 rounded-2xl border border-red-200 bg-white px-4 py-3 text-sm font-bold text-red-700 shadow-2xl shadow-red-900/10 dark:border-red-900/40 dark:bg-card-dark dark:text-red-300"
          >
            <AlertTriangle size={18} className="shrink-0" />
            <span>{toast.message}</span>
          </motion.div>
        )}
      </AnimatePresence>

      <SimuladoCreationModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setFinishedSimuladoData(null);
          if (onClearInitialData) onClearInitialData();
        }}
        onSave={handleCreate}
        disciplinasSugestivas={activeCycleDisciplines || []}
        initialData={finishedSimuladoData || initialData}
        onClearInitialData={onClearInitialData}
      />

      <SimuladoEditModal
        isOpen={editModal.open}
        onClose={() => setEditModal({ open: false, item: null })}
        simulado={editModal.item}
        disciplinasSugestivas={activeCycleDisciplines || []}
        onSave={(payload) => handleUpdate(editModal.item.id, payload)}
      />

      <StartSimuladoModal
        isOpen={isStartModalOpen}
        onClose={() => setIsStartModalOpen(false)}
        onStart={onStartSimulado}
      />

      {showArena && selectedIds.length >= 2 && (
        <SimuladoComparisonModal
          simuladosSelecionados={selectedSimulados}
          onClose={() => { setShowArena(false); setSelectedIds([]); setCompareMode(false); }}
        />
      )}

      <div className="desktop-page-zoom desktop-page-zoom--simulados mobile-page-zoom mobile-page-zoom--simulados space-y-6 md:space-y-8">
      <HeaderSimulado
        kpis={kpis}
        simulados={simulados}
        searchTerm={searchTerm}
        setSearchTerm={setSearchTerm}
        compareMode={compareMode}
        setCompareMode={handleEnterCompareMode}
        selectedIds={selectedIds}
        onCompareClick={() => setShowArena(true)}
        onStartClick={() => setIsStartModalOpen(true)}
        onNewClick={() => {
            if (onClearInitialData) onClearInitialData();
            setIsModalOpen(true);
        }}
        onCancelCompare={() => {
            setCompareMode(false);
            setSelectedIds([]);
        }}
      />

      <div ref={simuladosListRef} className="scroll-mt-3">
      {simulados.length === 0 && !loading ? (
        <div className="flex w-full items-center justify-center px-4 py-10">
          <motion.div
            initial={{ opacity: 0, y: 30, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            className="group relative w-full max-w-2xl overflow-hidden rounded-[40px] border border-zinc-200 bg-white p-8 text-center shadow-[0_30px_100px_rgba(0,0,0,0.06)] dark:border-white/10 dark:bg-card-dark dark:shadow-[0_30px_100px_rgba(0,0,0,0.3)] sm:px-12 sm:pb-9 sm:pt-12"
          >
            {/* Decorative background elements */}
            <div className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-red-500/5 blur-[80px] transition-all duration-700 group-hover:bg-red-500/10" />
            <div className="pointer-events-none absolute -bottom-20 -left-20 h-64 w-64 rounded-full bg-zinc-500/5 blur-[80px] transition-all duration-700 group-hover:bg-zinc-500/10" />

            <div className="relative z-10 flex flex-col items-center">
              <div className="relative mb-8">
                <div className="absolute inset-0 animate-ping rounded-full bg-red-500/20 opacity-40 duration-[3s]" />
                <div className="relative flex h-24 w-24 items-center justify-center rounded-[32px] bg-gradient-to-br from-red-600 to-rose-700 text-white shadow-2xl shadow-red-500/30 sm:h-28 sm:w-28">
                  <ClipboardList size={48} strokeWidth={1.5} />
                </div>
                <div className="absolute -bottom-2 -right-2 flex h-10 w-10 items-center justify-center rounded-2xl bg-white text-red-600 shadow-xl dark:bg-zinc-900 dark:text-red-400">
                  <Zap size={20} fill="currentColor" />
                </div>
              </div>

              <p className="text-[11px] font-black uppercase tracking-[0.4em] text-red-600 dark:text-red-400">
                Central de Simulados
              </p>
              
              <h2 className="mt-4 text-3xl font-black uppercase tracking-tight text-zinc-900 dark:text-white sm:text-4xl">
                Sem simulados <span className="bg-gradient-to-r from-red-600 to-rose-600 bg-clip-text text-transparent">ainda</span>
              </h2>
              
              <p className="mt-6 max-w-md text-base font-medium leading-relaxed text-zinc-500 dark:text-zinc-400">
                Registre seu primeiro simulado para desbloquear análises e comparativos. O caminho para a aprovação passa pela prática constante.
              </p>

              <div className="mt-10 flex flex-col items-center gap-3">
                <button
                  type="button"
                  onClick={() => setIsStartModalOpen(true)}
                  className="group/btn relative flex h-14 items-center gap-3 overflow-hidden rounded-2xl bg-zinc-950 px-8 text-xs font-black uppercase tracking-[0.2em] text-white shadow-2xl transition-all hover:scale-105 hover:bg-red-600 active:scale-95 dark:bg-white dark:text-zinc-950 dark:hover:bg-red-500 dark:hover:text-white"
                >
                  <span className="relative z-10 flex items-center gap-2">
                    Iniciar simulado <ArrowRight size={16} />
                  </span>
                </button>
                <img
                  src="/logoModoQAP.png"
                  alt="Logo Modo QAP"
                  className="h-8 w-auto object-contain opacity-90 transition-opacity duration-300 group-hover:opacity-100"
                />
              </div>
            </div>
          </motion.div>
        </div>
      ) : (
        <SimuladosList
            filteredSimulados={filteredSimulados}
            loading={loading}
            onDeleteRequest={null}
            onConfirmDelete={handleConfirmDelete}
            onEditRequest={(item) => setEditModal({ open: true, item })}
            compareMode={compareMode}
            selectedIds={selectedIds}
            toggleSelection={toggleSelection}
        />
      )}
      </div>
      </div>
    </div>
  );
};

export default SimuladosPage;
