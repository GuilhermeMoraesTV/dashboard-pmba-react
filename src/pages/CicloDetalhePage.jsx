import React, { useState, useEffect } from 'react';
import { db } from '../firebaseConfig';
import { doc, collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import CicloVisual from '../components/ciclos/CicloVisual';
import RegistroEstudoModal from '../components/ciclos/RegistroEstudoModal';
import TopicListPanel from '../components/ciclos/TopicListPanel';

const IconArrowLeft = () => <span>←</span>;

function CicloDetalhePage({ cicloId, onBack, user, addRegistroEstudo }) {
  const [ciclo, setCiclo] = useState(null);
  const [loadingCiclo, setLoadingCiclo] = useState(true);
  const [showRegistroModal, setShowRegistroModal] = useState(false);
  const [selectedDisciplinaId, setSelectedDisciplinaId] = useState(null); // Estado para o ID selecionado
  const [registrosEstudo, setRegistrosEstudo] = useState([]);
  const [loadingRegistros, setLoadingRegistros] = useState(true);

  // Hook Ciclo (sem alteração)
  useEffect(() => {
    // ... busca ciclo ...
     if (!user || !cicloId) return; setLoadingCiclo(true); const cicloRef = doc(db, 'users', user.uid, 'ciclos', cicloId); const unsubscribe = onSnapshot(cicloRef, (doc) => { if (doc.exists()) setCiclo({ id: doc.id, ...doc.data() }); else setCiclo(null); setLoadingCiclo(false); }, (error) => { console.error("Erro ciclo:", error); setLoadingCiclo(false); }); return () => unsubscribe();
  }, [user, cicloId]);

  // Hook Registros (sem alteração)
  useEffect(() => {
    // ... busca registros ...
     if (!user) return; setLoadingRegistros(true); const q = query(collection(db, 'users', user.uid, 'registrosEstudo'), orderBy('data', 'desc')); const unsubscribe = onSnapshot(q, (snapshot) => { setRegistrosEstudo(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))); setLoadingRegistros(false); }, (error) => { console.error("Erro registros:", error); setLoadingRegistros(false); }); return () => unsubscribe();
  }, [user]);

  // --- FUNÇÃO DE SELEÇÃO (VERIFICADA) ---
  // Esta função é passada para o CicloVisual e atualiza o estado AQUI
  const handleSelectDisciplina = (disciplinaId) => {
    console.log("Selecionando disciplina:", disciplinaId); // Para Debug
    // Se clicar na mesma disciplina, deseleciona (null), senão, seleciona a nova
    setSelectedDisciplinaId(prevId => (prevId === disciplinaId ? null : disciplinaId));
  };
  // --- FIM DA FUNÇÃO ---

  if (loadingCiclo || loadingRegistros) {
    return <div className="p-6 text-text-color dark:text-dark-text-color">Carregando dados...</div>;
  }

  if (!ciclo) {
    return <div className="p-6 text-danger-color">Ciclo não encontrado.</div>;
  }

  return (
    <div className="p-0">
      {/* Cabeçalho (sem alteração) */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <button onClick={onBack} className="inline-flex items-center gap-2 text-primary-color hover:brightness-125 mb-1 font-semibold"> <IconArrowLeft /> Voltar </button>
          <h1 className="text-3xl font-semibold text-heading-color dark:text-dark-heading-color"> {ciclo.nome} </h1>
        </div>
        <button onClick={() => setShowRegistroModal(true)} className="px-5 py-3 bg-primary-color text-white rounded-lg font-semibold shadow-lg hover:brightness-110 transition-all"> + Registrar Estudo </button>
      </div>

      {/* Modal de Registro (sem alteração) */}
      {showRegistroModal && (
        <RegistroEstudoModal
          user={user} cicloId={cicloId} onClose={() => setShowRegistroModal(false)} onAddRegistro={addRegistroEstudo}
        />
      )}

      {/* Layout da Página */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Roda (Ocupa 2 colunas) */}
        <div className="lg:col-span-2 bg-card-background-color dark:bg-dark-card-background-color p-6 rounded-xl shadow-card-shadow border border-border-color dark:border-dark-border-color">
          <CicloVisual
            cicloId={cicloId}
            user={user}
            selectedDisciplinaId={selectedDisciplinaId} // <-- Passa o ID selecionado
            onSelectDisciplina={handleSelectDisciplina} // <-- Passa a função de seleção
          />
        </div>

        {/* Painel Lateral (1 coluna) */}
        <div className="lg:col-span-1 space-y-6">
            {/* Painel de Tópicos (Renderização Condicional Verificada) */}
            <div className="bg-card-background-color dark:bg-dark-card-background-color p-6 rounded-xl shadow-card-shadow border border-border-color dark:border-dark-border-color min-h-[400px]"> {/* Altura mínima */}
              {/* Renderiza o painel SÓ SE uma disciplina estiver selecionada */}
              {selectedDisciplinaId ? (
                <TopicListPanel
                  user={user}
                  cicloId={cicloId}
                  disciplinaId={selectedDisciplinaId} // Passa o ID selecionado
                  registrosEstudo={registrosEstudo}
                />
              ) : (
                // Mensagem padrão quando nada está selecionado
                 <div className="flex flex-col items-center justify-center h-full text-center text-subtle-text-color dark:text-dark-subtle-text-color py-10">
                    <span className="text-4xl mb-4">📚</span>
                    <p className="font-semibold">Selecione uma disciplina</p>
                    <p className="text-sm">Clique em uma disciplina na legenda ao lado para ver seus tópicos e progresso detalhado.</p>
                 </div>
              )}
            </div>

            {/* Painel de Estatísticas (placeholder) */}
            <div className="bg-card-background-color dark:bg-dark-card-background-color p-6 rounded-xl shadow-card-shadow border border-border-color dark:border-dark-border-color">
                <h2 className="text-xl font-bold text-heading-color dark:text-dark-heading-color mb-4">Estatísticas Gerais</h2>
                <p className="text-subtle-text-color dark:text-dark-subtle-text-color">(Em breve)</p>
            </div>
        </div>

      </div>
    </div>
  );
}

export default CicloDetalhePage;