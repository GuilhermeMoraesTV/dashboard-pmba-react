import React, { useState, useEffect } from 'react';
import { db } from '../../firebaseConfig';
import { collection, query, onSnapshot, orderBy } from 'firebase/firestore';
import CicloCreateWizard from './CicloCreateWizard';
import { useCiclos } from '../../hooks/useCiclos';
import CicloEditModal from './CicloEditModal'; // <-- 1. IMPORTAR

// Modal de Confirmação (Sem alteração)
function ModalConfirmacaoArquivamento({ ciclo, onClose, onConfirm, loading }) {
  // ... (código do modal de arquivamento)
  return (
    <div
      className="fixed inset-0 bg-black/60 z-40 flex justify-center items-center"
      onClick={onClose}
    >
      <div
        className="bg-card-background-color dark:bg-dark-card-background-color p-8 rounded-lg shadow-xl z-50 w-full max-w-md mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-2xl font-bold text-heading-color dark:text-dark-heading-color mb-4">
          Confirmar Arquivamento
        </h2>
        <p className="text-text-color dark:text-dark-text-color mb-6">
          Você tem certeza que deseja arquivar o ciclo "<strong>{ciclo.nome}</strong>"?
          <br/>
          <span className="text-sm text-subtle-text-color dark:text-dark-subtle-text-color">
            Ele será movido para a sua "Área do Estudante" e não aparecerá mais aqui.
          </span>
        </p>
        <div className="flex justify-end gap-4">
          <button
            onClick={onClose}
            disabled={loading}
            className="px-5 py-2 bg-gray-200 text-gray-800 rounded-lg font-semibold hover:bg-gray-300 transition-all disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className="px-5 py-2 bg-primary-color text-white rounded-lg font-semibold shadow-lg hover:brightness-110 transition-all disabled:opacity-50"
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
  const [cicloParaEditar, setCicloParaEditar] = useState(null); // <-- 2. NOVO ESTADO

  const {
    ativarCiclo,
    arquivarCiclo,
    // editarCiclo não é necessário aqui, é usado dentro do Modal
    loading: actionLoading,
    error: actionError
  } = useCiclos(user);

  // useEffect (Sem alteração)
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

  // Handlers (ativar, arquivar, menu) (Sem alteração)
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

  // --- 3. ATUALIZAR handleEditar ---
  const handleEditar = (e, ciclo) => {
    e.stopPropagation();
    setCicloParaEditar(ciclo); // <-- Define o objeto 'ciclo' para edição
    setMenuAberto(null);
  };

  const IconeMenu = () => (
    // ... (SVG do menu)
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.75a.75.75 0 110-1.5.75.75 0 010 1.5zM12 12.75a.75.75 0 110-1.5.75.75 0 010 1.5zM12 18.75a.75.75 0 110-1.5.75.75 0 010 1.5z" />
    </svg>
  );

  return (
    <div className="p-0" onClick={() => setMenuAberto(null)}>
      {/* Modais */}
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

      {/* --- 4. RENDERIZAR MODAL DE EDIÇÃO --- */}
      {cicloParaEditar && (
        <CicloEditModal
          onClose={() => setCicloParaEditar(null)}
          user={user}
          ciclo={cicloParaEditar} // Passa o objeto 'ciclo'
        />
      )}

      {/* Cabeçalho e Botão (Sem alteração) */}
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-semibold text-heading-color dark:text-dark-heading-color">
          Meus Ciclos de Estudo
        </h1>
        <button
          onClick={() => setShowCreateModal(true)}
          className="px-5 py-2 bg-primary-color text-white rounded-lg font-semibold shadow-lg hover:brightness-110 transition-all"
          disabled={actionLoading}
        >
          + Cadastrar Novo Ciclo
        </button>
      </div>

      {/* Status de Loading (Sem alteração) */}
      {loadingList && <p className="text-subtle-text-color dark:text-dark-subtle-text-color">Carregando ciclos...</p>}
      {actionLoading && !cicloParaArquivar && <p className="text-primary-color dark:text-primary-color">Executando ação...</p>}
      {actionError && <p className="text-red-500">Erro: {actionError}</p>}
      {!loadingList && ciclos.length === 0 && (
        <div className="text-center text-subtle-text-color dark:text-dark-subtle-text-color bg-card-background-color dark:bg-dark-card-background-color p-10 rounded-lg shadow-inner">
            <p>Nenhum ciclo de estudo encontrado.</p>
            <p>Clique em "Cadastrar Novo Ciclo" para começar.</p>
        </div>
      )}

      {/* Grid de Ciclos */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {ciclos.map((ciclo) => (
          <div
            key={ciclo.id}
            className="bg-card-background-color dark:bg-dark-card-background-color p-5 rounded-xl shadow-card-shadow border border-border-color dark:border-dark-border-color flex flex-col justify-between text-left transition-transform transform hover:scale-105 hover:border-primary-color relative"
          >
            {/* Menu Dropdown (Atualizado) */}
            <div className="absolute top-3 right-3 z-10">
              <button
                onClick={(e) => handleMenuToggle(e, ciclo.id)}
                className="p-2 rounded-full text-subtle-text-color dark:text-dark-subtle-text-color hover:bg-background-color dark:hover:bg-dark-background-color transition-colors"
              >
                <IconeMenu />
              </button>

              {menuAberto === ciclo.id && (
                <div
                  onClick={(e) => e.stopPropagation()}
                  className="absolute right-0 mt-1 w-48 bg-card-background-color dark:bg-dark-card-background-color border border-border-color dark:border-dark-border-color rounded-lg shadow-xl py-1 z-20"
                >
                  <button
                    onClick={(e) => handleAtivar(e, ciclo.id)}
                    disabled={ciclo.ativo || actionLoading}
                    className="w-full text-left px-4 py-2 text-sm text-text-color dark:text-dark-text-color hover:bg-background-color dark:hover:bg-dark-background-color disabled:opacity-50 disabled:hover:bg-transparent"
                  >
                    Ativar Ciclo
                  </button>
                  <button
                    onClick={(e) => handleEditar(e, ciclo)} // <-- Passa o objeto 'ciclo'
                    disabled={actionLoading}
                    className="w-full text-left px-4 py-2 text-sm text-text-color dark:text-dark-text-color hover:bg-background-color dark:hover:bg-dark-background-color disabled:opacity-50"
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

            {/* Conteúdo do Card (Sem alteração) */}
            <div
              onClick={() => onCicloClick(ciclo.id)}
              className="cursor-pointer"
            >
              <div>
                <div className="flex justify-between items-center mb-3">
                  <h2 className="text-xl font-bold text-heading-color dark:text-dark-heading-color pr-10">{ciclo.nome}</h2>
                  {ciclo.ativo && (
                    <span className="text-xs font-semibold bg-green-500 text-green-900 py-1 px-3 rounded-full absolute top-5 right-14">
                      ATIVO
                    </span>
                  )}
                </div>
                <p className="text-subtle-text-color dark:text-dark-subtle-text-color text-sm">
                  Carga Horária: <span className='font-semibold text-text-color dark:text-dark-text-color'>{ciclo.cargaHorariaSemanalTotal} horas/semana</span>
                </p>
              </div>
              <div className="mt-4 w-full text-center py-2 bg-background-color dark:bg-dark-background-color text-text-color dark:text-dark-text-color rounded-lg hover:bg-border-color dark:hover:bg-dark-border-color transition-colors text-sm font-medium">
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