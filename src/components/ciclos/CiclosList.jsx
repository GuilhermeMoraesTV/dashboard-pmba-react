import React, { useState, useEffect } from 'react';
import { db } from '../../firebaseConfig';
import { collection, query, onSnapshot, orderBy } from 'firebase/firestore';
import CicloCreateWizard from './CicloCreateWizard';
import { useCiclos } from '../../hooks/useCiclos';
import CicloEditModal from './CicloEditModal';

function ModalConfirmacaoArquivamento({ ciclo, onClose, onConfirm, loading }) {
  return (
    <div
      className="fixed inset-0 bg-black/60 z-40 flex justify-center items-center"
      onClick={onClose}
    >
      <div
        className="bg-zinc-200 dark:bg-zinc-800 p-8 rounded-lg shadow-xl z-50 w-full max-w-md mx-4 border border-zinc-300 dark:border-zinc-700"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-2xl font-bold text-zinc-800 dark:text-white mb-4">
          Confirmar Arquivamento
        </h2>
        <p className="text-zinc-700 dark:text-zinc-300 mb-6">
          Você tem certeza que deseja arquivar o ciclo "<strong>{ciclo.nome}</strong>"?
          <br/>
          <span className="text-sm text-zinc-600 dark:text-zinc-400">
            Ele será movido para a sua "Área do Estudante" e não aparecerá mais aqui.
          </span>
        </p>
        <div className="flex justify-end gap-4">
          <button
            onClick={onClose}
            disabled={loading}
            className="px-5 py-2 bg-zinc-300 dark:bg-zinc-700 text-zinc-800 dark:text-white rounded-lg font-semibold hover:bg-zinc-400 dark:hover:bg-zinc-600 transition-all disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className="px-5 py-2 bg-neutral-500 text-white rounded-lg font-semibold shadow-lg hover:bg-neutral-600 transition-all disabled:opacity-50"
          >
            {loading ? "Arquivando..." : "Arquivar"}
          </button>
        </div>
      </div>
    </div>
  );
}


function CiclosList({ onCicloClick, user, onCicloAtivado }) {
  const [ciclos, setCiclos] = useState([]);
  const [loadingList, setLoadingList] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [menuAberto, setMenuAberto] = useState(null);
  const [cicloParaArquivar, setCicloParaArquivar] = useState(null);
  const [cicloParaEditar, setCicloParaEditar] = useState(null);

  const {
    ativarCiclo,
    arquivarCiclo,
    loading: actionLoading,
    error: actionError
  } = useCiclos(user);

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
  const handleAtivar = async (e, cicloId) => {
    e.stopPropagation();
    if (actionLoading) return;
    const sucesso = await ativarCiclo(cicloId);
    setMenuAberto(null);
    if (sucesso && onCicloAtivado) {
      onCicloAtivado(cicloId);
    }
  };
  const handleArquivar = (e, ciclo) => {
    e.stopPropagation();
    setCicloParaArquivar(ciclo);
    setMenuAberto(null);
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

  const handleEditar = (e, ciclo) => {
    e.stopPropagation();
    setCicloParaEditar(ciclo);
    setMenuAberto(null);
  };

  const IconeMenu = () => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.75a.75.75 0 110-1.5.75.75 0 010 1.5zM12 12.75a.75.75 0 110-1.5.75.75 0 010 1.5zM12 18.75a.75.75 0 110-1.5.75.75 0 010 1.5z" />
    </svg>
  );

  return (
    <div className="p-0" onClick={() => setMenuAberto(null)}>
      {cicloParaArquivar && (
        <ModalConfirmacaoArquivamento
          ciclo={cicloParaArquivar}
          onClose={() => setCicloParaArquivar(null)}
          onConfirm={handleConfirmarArquivamento}
          loading={actionLoading}
        />
      )}

      {showCreateModal && (
        <CicloCreateWizard
          onClose={() => setShowCreateModal(false)}
          user={user}
        />
      )}

      {cicloParaEditar && (
        <CicloEditModal
          onClose={() => setCicloParaEditar(null)}
          user={user}
          ciclo={cicloParaEditar}
        />
      )}

      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-semibold text-zinc-800 dark:text-white">
          Meus Ciclos de Estudo
        </h1>
        <button
          onClick={() => setShowCreateModal(true)}
          className="px-5 py-2 bg-neutral-500 text-white rounded-lg font-semibold shadow-lg hover:bg-neutral-600 transition-all"
          disabled={actionLoading}
        >
          + Cadastrar Novo Ciclo
        </button>
      </div>

      {loadingList && <p className="text-zinc-600 dark:text-zinc-400">Carregando ciclos...</p>}
      {actionLoading && !cicloParaArquivar && <p className="text-neutral-500 dark:text-neutral-500">Executando ação...</p>}
      {actionError && <p className="text-red-500">Erro: {actionError}</p>}
      {!loadingList && ciclos.length === 0 && (
        <div className="text-center text-zinc-600 dark:text-zinc-400 bg-zinc-200 dark:bg-zinc-800 p-10 rounded-lg shadow-inner border border-zinc-300 dark:border-zinc-700">
            <p>Nenhum ciclo de estudo encontrado.</p>
            <p>Clique em "Cadastrar Novo Ciclo" para começar.</p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {ciclos.map((ciclo) => (
          <div
            key={ciclo.id}
            className="bg-zinc-200 dark:bg-zinc-800 p-5 rounded-xl shadow-card-shadow border border-zinc-300 dark:border-zinc-700 flex flex-col justify-between text-left transition-transform transform hover:scale-105 hover:border-neutral-500 relative"
          >
            <div className="absolute top-3 right-3 z-10">
              <button
                onClick={(e) => handleMenuToggle(e, ciclo.id)}
                className="p-2 rounded-full text-zinc-600 dark:text-zinc-400 hover:bg-zinc-300 dark:hover:bg-zinc-700 transition-colors"
              >
                <IconeMenu />
              </button>

              {menuAberto === ciclo.id && (
                <div
                  onClick={(e) => e.stopPropagation()}
                  className="absolute right-0 mt-1 w-48 bg-zinc-200 dark:bg-zinc-800 border border-zinc-400 dark:border-zinc-600 rounded-lg shadow-xl py-1 z-20"
                >
                  <button
                    onClick={(e) => handleAtivar(e, ciclo.id)}
                    disabled={ciclo.ativo || actionLoading}
                    className="w-full text-left px-4 py-2 text-sm text-zinc-800 dark:text-white hover:bg-zinc-300 dark:hover:bg-zinc-700 disabled:opacity-50 disabled:hover:bg-transparent"
                  >
                    Ativar Ciclo
                  </button>
                  <button
                    onClick={(e) => handleEditar(e, ciclo)}
                    disabled={actionLoading}
                    className="w-full text-left px-4 py-2 text-sm text-zinc-800 dark:text-white hover:bg-zinc-300 dark:hover:bg-zinc-700 disabled:opacity-50"
                  >
                    Editar
                  </button>
                  <button
                    onClick={(e) => handleArquivar(e, ciclo)}
                    disabled={actionLoading}
                    className="w-full text-left px-4 py-2 text-sm text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 disabled:opacity-50"
                  >
                    Arquivar Ciclo
                  </button>
                </div>
              )}
            </div>

            <div
              onClick={() => onCicloClick(ciclo.id)}
              className="cursor-pointer"
            >
              <div>
                <div className="flex justify-between items-center mb-3">
                  <h2 className="text-xl font-bold text-zinc-800 dark:text-white pr-10">{ciclo.nome}</h2>
                  {ciclo.ativo && (
                    <span className="text-xs font-semibold bg-green-500 text-green-900 py-1 px-3 rounded-full absolute top-5 right-14">
                      ATIVO
                    </span>
                  )}
                </div>
                <p className="text-zinc-600 dark:text-zinc-400 text-sm">
                  Carga Horária: <span className='font-semibold text-zinc-800 dark:text-white'>{ciclo.cargaHorariaSemanalTotal} horas/semana</span>
                </p>
              </div>
              <div className="mt-4 w-full text-center py-2 bg-zinc-100 dark:bg-zinc-900 text-zinc-800 dark:text-white rounded-lg hover:bg-zinc-300 dark:hover:bg-zinc-700 transition-colors text-sm font-medium">
                Ver Detalhes do Ciclo
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default CiclosList;