import React, { useState, useEffect } from 'react';
import { db } from '../../firebaseConfig'; // 'auth' não é mais necessário aqui
import { collection, query, onSnapshot, orderBy } from 'firebase/firestore';
// 'useAuthState' foi REMOVIDO
import CicloCreateWizard from './CicloCreateWizard';

// Recebe 'onCicloClick' e 'user' como props
function CiclosList({ onCicloClick, user }) {
  // 'user' vem das props, não do hook
  const [ciclos, setCiclos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);

  useEffect(() => {
    // O useEffect agora depende do 'user' recebido via props
    if (!user) {
        setLoading(false);
        return;
    };

    setLoading(true);
    const ciclosRef = collection(db, 'users', user.uid, 'ciclos');
    const q = query(ciclosRef, orderBy('dataCriacao', 'desc'));

    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const ciclosData = [];
      querySnapshot.forEach((doc) => {
        ciclosData.push({ id: doc.id, ...doc.data() });
      });
      setCiclos(ciclosData);
      setLoading(false);
    }, (error) => {
      console.error("Erro ao buscar ciclos: ", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user]); // Depende do 'user' da prop

  return (
    <div className="p-0">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-semibold text-heading-color dark:text-dark-heading-color">
          Meus Ciclos de Estudo
        </h1>
        <button
          onClick={() => setShowCreateModal(true)}
          className="px-5 py-2 bg-primary-color text-white rounded-lg font-semibold shadow-lg hover:brightness-110 transition-all"
        >
          + Cadastrar Novo Ciclo
        </button>
      </div>

      {showCreateModal && (
        // Passa o 'user' para o modal de criação
        <CicloCreateWizard onClose={() => setShowCreateModal(false)} user={user} />
      )}

      {loading && <p className="text-subtle-text-color dark:text-dark-subtle-text-color">Carregando ciclos...</p>}

      {!loading && ciclos.length === 0 && (
        <div className="text-center text-subtle-text-color dark:text-dark-subtle-text-color bg-card-background-color dark:bg-dark-card-background-color p-10 rounded-lg shadow-inner">
            <p>Nenhum ciclo de estudo encontrado.</p>
            <p>Clique em "Cadastrar Novo Ciclo" para começar.</p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {ciclos.map((ciclo) => (
          <button
            onClick={() => onCicloClick(ciclo.id)}
            key={ciclo.id}
            className="bg-card-background-color dark:bg-dark-card-background-color p-5 rounded-xl shadow-card-shadow border border-border-color dark:border-dark-border-color flex flex-col justify-between text-left transition-transform transform hover:scale-105 hover:border-primary-color"
          >
            <div>
              <div className="flex justify-between items-center mb-3">
                <h2 className="text-xl font-bold text-heading-color dark:text-dark-heading-color">{ciclo.nome}</h2>
                {ciclo.ativo && (
                  <span className="text-xs font-semibold bg-green-500 text-green-900 py-1 px-3 rounded-full">
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
          </button>
        ))}
      </div>
    </div>
  );
}

export default CiclosList;