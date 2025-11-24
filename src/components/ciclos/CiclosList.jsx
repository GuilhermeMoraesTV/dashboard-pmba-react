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
  Map
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// --- MODAL DE CONFIRMAÇÃO ESTILIZADO (TÁTICO) ---
function ModalConfirmacaoArquivamento({ ciclo, onClose, onConfirm, loading }) {
  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[60] flex justify-center items-center p-4 animate-fade-in" onClick={onClose}>
      <div
        className="bg-white dark:bg-zinc-950 p-0 rounded-2xl shadow-2xl border border-zinc-200 dark:border-zinc-800 w-full max-w-md relative overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Topo de Alerta */}
        <div className="bg-red-500/10 p-6 flex flex-col items-center border-b border-red-500/20">
            <div className="w-16 h-16 bg-red-500/20 text-red-600 dark:text-red-500 rounded-full flex items-center justify-center mb-4 shadow-[0_0_15px_rgba(239,68,68,0.4)]">
                <Archive size={32} />
            </div>
            <h2 className="text-xl font-black text-zinc-900 dark:text-white uppercase tracking-tight">
              Arquivar Operação?
            </h2>
        </div>

        <div className="p-6 text-center">
            <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-6">
              O ciclo <strong className="text-zinc-900 dark:text-white">"{ciclo.nome}"</strong> será movido para o arquivo morto. Todos os dados estatísticos serão preservados, mas ele sairá do painel principal.
            </p>

            <div className="flex gap-3">
              <button
                onClick={onClose}
                disabled={loading}
                className="flex-1 px-4 py-3 bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 rounded-xl font-bold text-xs uppercase tracking-wider hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={onConfirm}
                disabled={loading}
                className="flex-1 px-4 py-3 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold text-xs uppercase tracking-wider shadow-lg shadow-red-900/20 transition-all flex items-center justify-center gap-2"
              >
                {loading ? "Processando..." : "Confirmar Arquivamento"}
              </button>
            </div>
        </div>
      </div>
    </div>
  );
}

// --- COMPONENTE DE CARD TÁTICO ---
const CicloCard = ({ ciclo, onClick, onMenuToggle, isMenuOpen, onAction }) => {
    return (
        <div
            onClick={() => onClick(ciclo.id)}
            className="group relative bg-white dark:bg-zinc-900/50 rounded-2xl p-6 cursor-pointer border border-zinc-200 dark:border-zinc-800 overflow-hidden transition-all duration-500 hover:-translate-y-1 hover:shadow-2xl"
        >
            {/* 1. Borda Vermelha no Hover (Igual Home) */}
            <div className="absolute left-0 top-0 bottom-0 w-1 bg-transparent group-hover:bg-red-500 transition-colors duration-300 z-20"></div>

            {/* 2. Ícone de Fundo Gigante (CORRIGIDO PARA MODO CLARO) */}
            {/* Aumentei a opacidade base para 10% no modo claro e 15% no hover */}
            <div className="absolute -bottom-6 -right-6 text-red-500/15 dark:text-red-500/5 transition-all duration-700 ease-out group-hover:scale-125 group-hover:rotate-[-10deg] group-hover:text-red-500/15 dark:group-hover:text-red-500/10 z-0 pointer-events-none">
                {ciclo.ativo ? <Target strokeWidth={1.5} size={140} /> : <BookOpen strokeWidth={1.5} size={140} />}
            </div>

            {/* Conteúdo (z-10) */}
            <div className="relative z-10">

                {/* Header do Card */}
                <div className="flex justify-between items-start mb-4">
                    {/* Badge de Status */}
                    <div className={`
                        px-3 py-1 rounded-md text-[10px] font-black uppercase tracking-widest border
                        ${ciclo.ativo
                            ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20 shadow-[0_0_10px_rgba(16,185,129,0.2)]'
                            : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500 border-zinc-200 dark:border-zinc-700'
                        }
                    `}>
                        {ciclo.ativo ? (
                            <span className="flex items-center gap-1.5">
                                <span className="relative flex h-1.5 w-1.5">
                                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
                                </span>
                                CICLO ATIVO
                            </span>
                        ) : 'CICLO INATIVO'}
                    </div>

                    {/* Botão Menu */}
                    <div className="relative">
                        <button
                            onClick={(e) => onMenuToggle(e, ciclo.id)}
                            className="p-2 -mr-2 -mt-2 text-zinc-400 hover:text-zinc-800 dark:hover:text-white rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                        >
                            <MoreVertical size={20} />
                        </button>

                        {/* Dropdown Menu */}
                        <AnimatePresence>
                            {isMenuOpen && (
                                <motion.div
                                    initial={{ opacity: 0, y: 5, scale: 0.95 }}
                                    animate={{ opacity: 1, y: 0, scale: 1 }}
                                    exit={{ opacity: 0, scale: 0.95 }}
                                    onClick={(e) => e.stopPropagation()}
                                    className="absolute top-8 right-0 w-48 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-xl py-1 z-50 overflow-hidden ring-1 ring-black/5"
                                >
                                    {!ciclo.ativo && (
                                        <button
                                            onClick={(e) => onAction(e, 'ativar', ciclo)}
                                            className="w-full text-left px-4 py-2.5 text-xs font-bold uppercase tracking-wide text-emerald-600 dark:text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-900/10 flex items-center gap-2 transition-colors"
                                        >
                                            <Zap size={14} /> Ativar Ciclo
                                        </button>
                                    )}
                                    <button
                                        onClick={(e) => onAction(e, 'editar', ciclo)}
                                        className="w-full text-left px-4 py-2.5 text-xs font-bold uppercase tracking-wide text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 flex items-center gap-2 transition-colors"
                                    >
                                        <Edit size={14} /> Editar
                                    </button>
                                    <div className="h-px bg-zinc-100 dark:bg-zinc-800 my-1"></div>
                                    <button
                                        onClick={(e) => onAction(e, 'arquivar', ciclo)}
                                        className="w-full text-left px-4 py-2.5 text-xs font-bold uppercase tracking-wide text-red-600 dark:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/10 flex items-center gap-2 transition-colors"
                                    >
                                        <Archive size={14} /> Arquivar
                                    </button>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                </div>

                {/* Título e Info */}
                <div className="mb-8">
                    <h3 className="text-2xl font-black text-zinc-800 dark:text-white leading-none mb-2 line-clamp-1 group-hover:text-red-600 dark:group-hover:text-red-500 transition-colors">
                        {ciclo.nome}
                    </h3>
                    <div className="w-8 h-1 bg-red-500 rounded-full mb-4 group-hover:w-16 transition-all duration-500"></div>

                    <div className="flex flex-col gap-2">
                        <div className="flex items-center gap-2 text-zinc-500 dark:text-zinc-400 text-sm">
                            <Clock size={16} className="text-red-500/70" />
                            <span className="font-mono font-bold text-zinc-700 dark:text-zinc-300">{ciclo.cargaHorariaSemanalTotal}h</span>
                            <span className="text-xs uppercase font-bold opacity-70">Carga Semanal</span>
                        </div>
                        <div className="flex items-center gap-2 text-zinc-500 dark:text-zinc-400 text-sm">
                            <Calendar size={16} className="text-red-500/70" />
                            <span className="text-xs font-medium">
                                Criado em {new Date(ciclo.dataCriacao?.toDate ? ciclo.dataCriacao.toDate() : Date.now()).toLocaleDateString('pt-BR')}
                            </span>
                        </div>
                    </div>
                </div>

                {/* Footer Ação */}
                <div className="flex items-center justify-between pt-4 border-t border-zinc-100 dark:border-zinc-800/50">
                    <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest group-hover:text-red-500 transition-colors">
                        Acessar
                    </span>
                    <div className={`
                        w-8 h-8 rounded-full flex items-center justify-center transition-all duration-300
                        ${ciclo.ativo
                            ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/30'
                            : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-400 group-hover:bg-red-500 group-hover:text-white'
                        }
                    `}>
                        <ArrowRight size={16} />
                    </div>
                </div>
            </div>
        </div>
    );
};

// --- COMPONENTE PRINCIPAL ---
function CiclosList({ onCicloClick, user, onCicloAtivado }) {
  const [ciclos, setCiclos] = useState([]);
  const [loadingList, setLoadingList] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [menuAberto, setMenuAberto] = useState(null);
  const [cicloParaArquivar, setCicloParaArquivar] = useState(null);
  const [cicloParaEditar, setCicloParaEditar] = useState(null);

  const { ativarCiclo, arquivarCiclo, loading: actionLoading, error: actionError } = useCiclos(user);

  // Fecha menu ao clicar fora
  useEffect(() => {
      const closeMenu = () => setMenuAberto(null);
      document.addEventListener('click', closeMenu);
      return () => document.removeEventListener('click', closeMenu);
  }, []);

  useEffect(() => {
    if (!user) {
        setLoadingList(false);
        return;
    };
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
    }, (error) => {
      console.error("Erro ao buscar ciclos: ", error);
      setLoadingList(false);
    });
    return () => unsubscribe();
  }, [user]);

  const handleMenuToggle = (e, cicloId) => {
    e.stopPropagation();
    setMenuAberto(prev => (prev === cicloId ? null : cicloId));
  };

  const handleAction = async (e, action, ciclo) => {
      e.stopPropagation();
      setMenuAberto(null);

      if (action === 'ativar') {
          if (actionLoading) return;
          const sucesso = await ativarCiclo(ciclo.id);
          if (sucesso && onCicloAtivado) onCicloAtivado(ciclo.id);
      } else if (action === 'editar') {
          setCicloParaEditar(ciclo);
      } else if (action === 'arquivar') {
          setCicloParaArquivar(ciclo);
      }
  };

  const handleConfirmarArquivamento = async () => {
    if (actionLoading || !cicloParaArquivar) return;
    const cicloArquivado = cicloParaArquivar;
    const sucesso = await arquivarCiclo(cicloArquivado.id);
    setCicloParaArquivar(null);
    if (sucesso && cicloArquivado.ativo && onCicloAtivado) {
      onCicloAtivado(null);
    }
  };

  return (
    <div className="p-0 min-h-[50vh] animate-fade-in">

      {/* Modais */}
      <AnimatePresence>
        {cicloParaArquivar && (
            <ModalConfirmacaoArquivamento
                ciclo={cicloParaArquivar}
                onClose={() => setCicloParaArquivar(null)}
                onConfirm={handleConfirmarArquivamento}
                loading={actionLoading}
            />
        )}
        {showCreateModal && (
            <CicloCreateWizard onClose={() => setShowCreateModal(false)} user={user} />
        )}
        {cicloParaEditar && (
            <CicloEditModal onClose={() => setCicloParaEditar(null)} user={user} ciclo={cicloParaEditar} />
        )}
      </AnimatePresence>

      {/* Cabeçalho da Página */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4">
        <div>
            <h1 className="text-2xl md:text-3xl font-black text-zinc-800 dark:text-white uppercase tracking-tight flex items-center gap-3">
                <Map className="text-red-600 dark:text-red-500" size={32} />
                Ciclos Operacionais
            </h1>
            <p className="text-zinc-500 dark:text-zinc-400 text-sm font-medium mt-1">
                Planejamento estratégico e tático dos seus estudos.
            </p>
        </div>

        <button
          onClick={() => setShowCreateModal(true)}
          disabled={actionLoading}
          className="group relative px-6 py-3 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 rounded-xl font-bold shadow-lg hover:shadow-xl transition-all transform hover:-translate-y-0.5 active:translate-y-0 flex items-center gap-2 overflow-hidden"
        >
          {/* Efeito de Brilho no Botão */}
          <div className="absolute inset-0 bg-white/20 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-500"></div>

          <Plus size={20} className="group-hover:rotate-90 transition-transform" />
          <span>Nova Missão</span>
        </button>
      </div>

      {/* Feedback de Erro */}
      {actionError && (
        <div className="mb-6 p-4 bg-red-100 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 rounded-xl flex items-center gap-3">
            <AlertTriangle size={20} />
            <p>{actionError}</p>
        </div>
      )}

      {/* Loading */}
      {loadingList && (
          <div className="flex justify-center py-20">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-500"></div>
          </div>
      )}

      {/* Empty State */}
      {!loadingList && ciclos.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-center bg-zinc-100 dark:bg-zinc-900/50 rounded-3xl border-2 border-dashed border-zinc-300 dark:border-zinc-800">
            <div className="w-20 h-20 bg-zinc-200 dark:bg-zinc-800 rounded-full flex items-center justify-center mb-4 text-zinc-400">
                <BookOpen size={40} />
            </div>
            <h3 className="text-xl font-bold text-zinc-700 dark:text-zinc-300 mb-2">Nenhuma missão encontrada</h3>
            <p className="text-zinc-500 max-w-md mb-6 text-sm">
                Sua base de operações está vazia. Inicie um novo ciclo para começar a rastrear seu progresso.
            </p>
            <button
                onClick={() => setShowCreateModal(true)}
                className="px-6 py-3 bg-red-600 text-white rounded-xl font-bold hover:bg-red-700 transition-colors shadow-lg shadow-red-900/20"
            >
                Criar Primeiro Ciclo
            </button>
        </div>
      )}

      {/* Grid de Ciclos */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {ciclos.map((ciclo) => (
          <CicloCard
            key={ciclo.id}
            ciclo={ciclo}
            onClick={onCicloClick}
            onMenuToggle={handleMenuToggle}
            isMenuOpen={menuAberto === ciclo.id}
            onAction={handleAction}
          />
        ))}
      </div>
    </div>
  );
}

export default CiclosList;