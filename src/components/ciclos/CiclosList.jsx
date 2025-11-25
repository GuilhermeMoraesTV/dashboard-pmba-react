import React, { useState, useEffect } from 'react';
import { db } from '../../firebaseConfig';
import { collection, query, onSnapshot, orderBy } from 'firebase/firestore';
import CicloCreateWizard from './CicloCreateWizard';
import { useCiclos } from '../../hooks/useCiclos';
import CicloEditModal from './CicloEditModal';
import {
  MoreVertical,
  Plus,
  Clock,
  Zap,
  Archive,
  Edit,
  AlertTriangle,
  BookOpen,
  Calendar,
  Target,
  ArrowRight,
  RotateCw,
  Trophy,
  Map
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// --- MODAL DE CONFIRMAÇÃO ---
function ModalConfirmacaoArquivamento({ ciclo, onClose, onConfirm, loading }) {
  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[60] flex justify-center items-center p-4 animate-fade-in" onClick={onClose}>
      <div
        className="bg-white dark:bg-zinc-950 p-0 rounded-2xl shadow-2xl border border-zinc-200 dark:border-zinc-800 w-full max-w-md relative overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="bg-red-500/10 p-6 flex flex-col items-center border-b border-red-500/20">
            <div className="w-16 h-16 bg-red-500/20 text-red-600 dark:text-red-500 rounded-full flex items-center justify-center mb-4 shadow-[0_0_15px_rgba(239,68,68,0.4)]">
                <Archive size={32} />
            </div>
            <h2 className="text-xl font-black text-zinc-900 dark:text-white uppercase tracking-tight">
              Arquivar Ciclo?
            </h2>
        </div>
        <div className="p-6 text-center">
            <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-6">
              O ciclo <strong className="text-zinc-900 dark:text-white">"{ciclo.nome}"</strong> será movido para o arquivo morto.
            </p>
            <div className="flex gap-3">
              <button onClick={onClose} disabled={loading} className="flex-1 px-4 py-3 bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 rounded-xl font-bold text-xs uppercase tracking-wider hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors">Cancelar</button>
              <button onClick={onConfirm} disabled={loading} className="flex-1 px-4 py-3 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold text-xs uppercase tracking-wider shadow-lg shadow-red-900/20 transition-all flex items-center justify-center gap-2">{loading ? "Processando..." : "Confirmar"}</button>
            </div>
        </div>
      </div>
    </div>
  );
}

// --- CARD TÁTICO ---
const CicloCard = ({ ciclo, onClick, onMenuToggle, isMenuOpen, onAction }) => {
    const concluidos = ciclo.conclusoes || 0;

    return (
        <div
            onClick={() => onClick(ciclo.id)}
            className="group relative bg-white dark:bg-zinc-900/50 rounded-2xl p-6 cursor-pointer border border-zinc-200 dark:border-zinc-800 overflow-hidden transition-all duration-500 hover:-translate-y-1 hover:shadow-2xl"
        >
            <div className="absolute left-0 top-0 bottom-0 w-1 bg-transparent group-hover:bg-red-500 transition-colors duration-300 z-20"></div>
            <div className="absolute -bottom-6 -right-6 text-red-500/15 dark:text-red-500/5 transition-all duration-700 ease-out group-hover:scale-125 group-hover:rotate-[-10deg] group-hover:text-red-500/15 dark:group-hover:text-red-500/10 z-0 pointer-events-none">
                {ciclo.ativo ? <Target strokeWidth={1.5} size={140} /> : <BookOpen strokeWidth={1.5} size={140} />}
            </div>

            <div className="relative z-10">
                <div className="flex justify-between items-start mb-6">
                    <div className="flex flex-wrap gap-2">
                        <div className={`px-3 py-1 rounded-md text-[10px] font-black uppercase tracking-widest border flex items-center gap-1.5 ${ciclo.ativo ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20 shadow-[0_0_10px_rgba(16,185,129,0.2)]' : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500 border-zinc-200 dark:border-zinc-700'}`}>
                            {ciclo.ativo && (<span className="relative flex h-1.5 w-1.5"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span><span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span></span>)}
                            {ciclo.ativo ? 'ATIVO' : 'INATIVO'}
                        </div>
                        <div className={`px-3 py-1 rounded-md text-[10px] font-black uppercase tracking-widest border flex items-center gap-1.5 transition-all ${concluidos > 0 ? 'bg-amber-500/10 text-amber-600 dark:text-amber-500 border-amber-500/20 shadow-[0_0_10px_rgba(245,158,11,0.2)]' : 'bg-zinc-50 dark:bg-zinc-800/50 text-zinc-400 border-zinc-200 dark:border-zinc-700'}`} title="Conclusões">
                            {concluidos > 0 ? <Trophy size={12} /> : <RotateCw size={12} />}
                            <span>{concluidos} {concluidos === 1 ? 'Conclusão' : 'Conclusões'}</span>
                        </div>
                    </div>

                    <div className="relative">
                        <button onClick={(e) => onMenuToggle(e, ciclo.id)} className="p-2 -mr-2 -mt-2 text-zinc-400 hover:text-zinc-800 dark:hover:text-white rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"><MoreVertical size={20} /></button>
                        <AnimatePresence>
                            {isMenuOpen && (
                                <motion.div initial={{ opacity: 0, y: 5, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} onClick={(e) => e.stopPropagation()} className="absolute top-8 right-0 w-48 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-xl py-1 z-50 overflow-hidden ring-1 ring-black/5">
                                    {!ciclo.ativo && (<button onClick={(e) => onAction(e, 'ativar', ciclo)} className="w-full text-left px-4 py-2.5 text-xs font-bold uppercase tracking-wide text-emerald-600 dark:text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-900/10 flex items-center gap-2 transition-colors"><Zap size={14} /> Ativar Ciclo</button>)}
                                    <button onClick={(e) => onAction(e, 'editar', ciclo)} className="w-full text-left px-4 py-2.5 text-xs font-bold uppercase tracking-wide text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 flex items-center gap-2 transition-colors"><Edit size={14} /> Editar</button>
                                    <div className="h-px bg-zinc-100 dark:bg-zinc-800 my-1"></div>
                                    <button onClick={(e) => onAction(e, 'arquivar', ciclo)} className="w-full text-left px-4 py-2.5 text-xs font-bold uppercase tracking-wide text-red-600 dark:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/10 flex items-center gap-2 transition-colors"><Archive size={14} /> Arquivar</button>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                </div>

                <div className="mb-8">
                    <h3 className="text-2xl font-black text-zinc-800 dark:text-white leading-none mb-2 line-clamp-1 group-hover:text-red-600 dark:group-hover:text-red-500 transition-colors">{ciclo.nome}</h3>
                    <div className="w-8 h-1 bg-red-500 rounded-full mb-4 group-hover:w-16 transition-all duration-500"></div>
                    <div className="flex flex-col gap-2">
                        <div className="flex items-center gap-2 text-zinc-500 dark:text-zinc-400 text-sm"><Clock size={16} className="text-red-500/70" /><span className="font-mono font-bold text-zinc-700 dark:text-zinc-300">{ciclo.cargaHorariaSemanalTotal}h</span><span className="text-xs uppercase font-bold opacity-70">Carga Semanal</span></div>
                        <div className="flex items-center gap-2 text-zinc-500 dark:text-zinc-400 text-sm"><Calendar size={16} className="text-red-500/70" /><span className="text-xs font-medium">Criado em {new Date(ciclo.dataCriacao?.toDate ? ciclo.dataCriacao.toDate() : Date.now()).toLocaleDateString('pt-BR')}</span></div>
                    </div>
                </div>

                <div className="flex items-center justify-between pt-4 border-t border-zinc-100 dark:border-zinc-800/50">
                    <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest group-hover:text-red-500 transition-colors">Acessar Ciclo</span>
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-all duration-300 ${ciclo.ativo ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/30' : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-400 group-hover:bg-red-500 group-hover:text-white'}`}><ArrowRight size={16} /></div>
                </div>
            </div>
        </div>
    );
};

function CiclosList({ onCicloClick, user, onCicloAtivado }) {
  const [ciclos, setCiclos] = useState([]);
  const [loadingList, setLoadingList] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [menuAberto, setMenuAberto] = useState(null);
  const [cicloParaArquivar, setCicloParaArquivar] = useState(null);
  const [cicloParaEditar, setCicloParaEditar] = useState(null);

  const { ativarCiclo, arquivarCiclo, loading: actionLoading, error: actionError } = useCiclos(user);

  useEffect(() => {
      const closeMenu = () => setMenuAberto(null);
      document.addEventListener('click', closeMenu);
      return () => document.removeEventListener('click', closeMenu);
  }, []);

  useEffect(() => {
    if (!user) { setLoadingList(false); return; };
    setLoadingList(true);
    const ciclosRef = collection(db, 'users', user.uid, 'ciclos');
    const q = query(ciclosRef, orderBy('dataCriacao', 'desc'));
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const ciclosData = [];
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        if (!data.arquivado) {
          ciclosData.push({ id: doc.id, ...data });
        }
      });
      setCiclos(ciclosData);
      setLoadingList(false);
    }, (error) => { console.error("Erro ao buscar ciclos: ", error); setLoadingList(false); });
    return () => unsubscribe();
  }, [user]);

  const handleMenuToggle = (e, cicloId) => { e.stopPropagation(); setMenuAberto(prev => (prev === cicloId ? null : cicloId)); };

  const handleAction = async (e, action, ciclo) => {
      e.stopPropagation();
      setMenuAberto(null);
      if (action === 'ativar') {
          if (actionLoading) return;
          const sucesso = await ativarCiclo(ciclo.id);
          if (sucesso && onCicloAtivado) onCicloAtivado(ciclo.id);
      } else if (action === 'editar') { setCicloParaEditar(ciclo);
      } else if (action === 'arquivar') { setCicloParaArquivar(ciclo); }
  };

  const handleConfirmarArquivamento = async () => {
    if (actionLoading || !cicloParaArquivar) return;
    await arquivarCiclo(cicloParaArquivar.id);
    setCicloParaArquivar(null);
  };

  return (
    <div className="p-0 min-h-[50vh] animate-fade-in pb-12">
      <AnimatePresence>
        {cicloParaArquivar && <ModalConfirmacaoArquivamento ciclo={cicloParaArquivar} onClose={() => setCicloParaArquivar(null)} onConfirm={handleConfirmarArquivamento} loading={actionLoading} />}
        {showCreateModal && <CicloCreateWizard onClose={() => setShowCreateModal(false)} user={user} />}
        {cicloParaEditar && <CicloEditModal onClose={() => setCicloParaEditar(null)} user={user} ciclo={cicloParaEditar} />}
      </AnimatePresence>

      {/* --- CABEÇALHO INTERNO DA PÁGINA --- */}
      <div className="mb-8 flex flex-col md:flex-row justify-between items-start md:items-end gap-4 border-b border-zinc-200 dark:border-zinc-800 pb-6">
        <div>
            <div className="flex items-center gap-3 mb-2">
                <div className="p-2.5 bg-red-100 dark:bg-red-900/20 text-red-600 dark:text-red-500 rounded-xl">
                    <Map size={28} strokeWidth={2} />
                </div>
                <h1 className="text-3xl font-black text-zinc-800 dark:text-white tracking-tight uppercase">
                    Meus Ciclos
                </h1>
            </div>

        </div>

        <button
          onClick={() => setShowCreateModal(true)}
          disabled={actionLoading}
          className="group relative px-5 py-3 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 rounded-xl font-bold shadow-lg hover:shadow-xl transition-all transform hover:-translate-y-0.5 active:translate-y-0 flex items-center gap-2 overflow-hidden shrink-0"
        >
          <div className="absolute inset-0 bg-white/20 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-500"></div>
          <Plus size={20} className="group-hover:rotate-90 transition-transform" />
          <span>Novo Ciclo</span>
        </button>
      </div>

      {/* Resto do conteúdo (Erro, Loading, Empty, Lista) */}
      {actionError && <div className="mb-6 p-4 bg-red-100 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 rounded-xl flex items-center gap-3"><AlertTriangle size={20} /><p>{actionError}</p></div>}

      {loadingList ? (
          <div className="flex justify-center py-20"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-500"></div></div>
      ) : ciclos.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center bg-zinc-50 dark:bg-zinc-900/50 rounded-3xl border-2 border-dashed border-zinc-200 dark:border-zinc-800">
            <BookOpen size={48} className="text-zinc-300 mb-4" />
            <h3 className="text-xl font-bold text-zinc-700 dark:text-zinc-300 mb-1">Nenhum ciclo encontrado</h3>
            <p className="text-zinc-500 text-sm mb-6">Crie seu primeiro plano de estudos agora.</p>
            <button onClick={() => setShowCreateModal(true)} className="px-6 py-2 bg-red-600 text-white rounded-lg font-bold text-sm hover:bg-red-700">Criar Ciclo</button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {ciclos.map((ciclo) => (
            <CicloCard key={ciclo.id} ciclo={ciclo} onClick={onCicloClick} onMenuToggle={handleMenuToggle} isMenuOpen={menuAberto === ciclo.id} onAction={handleAction} />
            ))}
        </div>
      )}
    </div>
  );
}

export default CiclosList;