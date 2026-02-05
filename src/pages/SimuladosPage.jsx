import React, { useState, useEffect, useMemo } from 'react';
import {
  collection, query, orderBy, onSnapshot, addDoc, deleteDoc, doc, Timestamp, updateDoc
} from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { ClipboardList } from 'lucide-react';

// Importação dos Módulos Separados
import HeaderSimulado from './SimuladosPage/HeaderSimulado';
import SimuladosList from './SimuladosPage/SimuladosList';
import SimuladoCreationModal from './SimuladosPage/SimuladoCreationModal';
import SimuladoEditModal from './SimuladosPage/SimuladoEditModal';
import SimuladoComparisonModal from './SimuladosPage/SimuladoComparisonModal';
import StartSimuladoModal from './SimuladosPage/StartSimuladoModal';

const SimuladosPage = ({ user, activeCycleDisciplines, onStartSimulado, initialData, onClearInitialData }) => {
  const [simulados, setSimulados] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  // Modais de Controle
  const [isModalOpen, setIsModalOpen] = useState(false); // Novo Registro (Manual e Finish Timer)
  const [isStartModalOpen, setIsStartModalOpen] = useState(false); // Iniciar Timer
  const [editModal, setEditModal] = useState({ open: false, item: null });

  // Comparação
  const [compareMode, setCompareMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState([]);
  const [showArena, setShowArena] = useState(false);

  // Estado do Timer Finalizado
  const [finishedSimuladoData, setFinishedSimuladoData] = useState(null);

  // Efeito para abrir o modal quando o simulado termina via timer externo (Dashboard)
  useEffect(() => {
    if (initialData) {
      setFinishedSimuladoData(initialData);
      setIsModalOpen(true);
    }
  }, [initialData]);

  // Carregar dados do Firebase
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

  const handleConfirmDelete = async (item) => {
    if (item) {
      try {
        await deleteDoc(doc(db, 'users', user.uid, 'simulados', item.id));
        if (selectedIds.includes(item.id)) {
          setSelectedIds(prev => prev.filter(id => id !== item.id));
        }
      } catch (e) {
        alert("Erro ao excluir.");
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

  return (
    <div className="space-y-6 md:space-y-8 pb-20 animate-fade-in min-h-screen text-zinc-800 dark:text-zinc-200">

      {/* MODAL DE CRIAÇÃO (Manual ou Finalizado via Timer) */}
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

      {/* MODAL DE EDIÇÃO */}
      <SimuladoEditModal
        isOpen={editModal.open}
        onClose={() => setEditModal({ open: false, item: null })}
        simulado={editModal.item}
        disciplinasSugestivas={activeCycleDisciplines || []}
        onSave={(payload) => handleUpdate(editModal.item.id, payload)}
      />

      {/* MODAL DE START TIMER */}
      <StartSimuladoModal
        isOpen={isStartModalOpen}
        onClose={() => setIsStartModalOpen(false)}
        onStart={onStartSimulado}
      />

      {/* ARENA DE COMPARAÇÃO */}
      {showArena && selectedIds.length >= 2 && (
        <SimuladoComparisonModal
          simuladosSelecionados={selectedSimulados}
          onClose={() => { setShowArena(false); setSelectedIds([]); setCompareMode(false); }}
        />
      )}

      {/* CABEÇALHO E KPIS */}
      <HeaderSimulado
        kpis={kpis}
        searchTerm={searchTerm}
        setSearchTerm={setSearchTerm}
        compareMode={compareMode}
        setCompareMode={setCompareMode}
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

      {/* TABELA PRINCIPAL */}
      {simulados.length === 0 && !loading ? (
        <div className="bg-zinc-50 dark:bg-zinc-900/50 p-10 rounded-3xl border-2 border-dashed border-zinc-200 dark:border-zinc-800 text-center max-w-2xl mx-auto mt-6">
          <div className="w-16 h-16 bg-zinc-100 dark:bg-zinc-800 rounded-full flex items-center justify-center mx-auto mb-4">
            <ClipboardList size={32} className="text-zinc-400" />
          </div>
          <h3 className="text-2xl font-black text-zinc-800 dark:text-white mb-2">Sem registros ainda</h3>
          <p className="text-zinc-500 mb-6">Registre seu primeiro simulado para desbloquear análises.</p>
          <button onClick={() => setIsStartModalOpen(true)} className="bg-emerald-600 text-white px-8 py-3 rounded-xl font-bold shadow-lg shadow-emerald-600/20 hover:bg-emerald-700 transition-colors">
            Iniciar Simulado
          </button>
        </div>
      ) : (
        <SimuladosList
            filteredSimulados={filteredSimulados}
            loading={loading}
            onDeleteRequest={null} // Gerenciado internamente no List agora, mas precisamos da função de confirmação
            onConfirmDelete={handleConfirmDelete}
            onEditRequest={(item) => setEditModal({ open: true, item })}
            compareMode={compareMode}
            selectedIds={selectedIds}
            toggleSelection={toggleSelection}
        />
      )}
    </div>
  );
};

export default SimuladosPage;