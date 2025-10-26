import React, { useState, useEffect } from 'react';
import { db } from '../firebaseConfig';
import { doc, collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import CicloVisual from '../components/ciclos/CicloVisual';
import RegistroEstudoModal from '../components/ciclos/RegistroEstudoModal';
import TopicListPanel from '../components/ciclos/TopicListPanel';

const IconArrowLeft = () => <span>←</span>;
const IconInfo = () => ( // Ícone para o aviso
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
    <path strokeLinecap="round" strokeLinejoin="round" d="m11.25 11.25.041-.02a.75.75 0 0 1 1.063.852l-.708 2.836a.75.75 0 0 0 1.063.853l.041-.021M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9-3.75h.008v.008H12V8.25Z" />
  </svg>
);


function CicloDetalhePage({ cicloId, onBack, user, addRegistroEstudo }) {
  const [ciclo, setCiclo] = useState(null);
  const [disciplinas, setDisciplinas] = useState([]); // <-- 1. ADICIONADO ESTADO
  const [loadingCiclo, setLoadingCiclo] = useState(true);
  const [showRegistroModal, setShowRegistroModal] = useState(false);
  const [selectedDisciplinaId, setSelectedDisciplinaId] = useState(null);
  const [registrosEstudo, setRegistrosEstudo] = useState([]);
  const [loadingRegistros, setLoadingRegistros] = useState(true);
  const [loadingDisciplinas, setLoadingDisciplinas] = useState(true); // <-- ADICIONADO LOADING

  // Hook Ciclo (sem alteração)
  useEffect(() => {
     if (!user || !cicloId) return; setLoadingCiclo(true); const cicloRef = doc(db, 'users', user.uid, 'ciclos', cicloId); const unsubscribe = onSnapshot(cicloRef, (doc) => { if (doc.exists()) setCiclo({ id: doc.id, ...doc.data() }); else setCiclo(null); setLoadingCiclo(false); }, (error) => { console.error("Erro ciclo:", error); setLoadingCiclo(false); }); return () => unsubscribe();
  }, [user, cicloId]);

  // --- 2. ADICIONADO: Hook para buscar Disciplinas ---
  // (Necessário para o Modal de Registro)
  useEffect(() => {
    if (!user || !cicloId) return;
    setLoadingDisciplinas(true);
    const disciplinasRef = collection(db, 'users', user.uid, 'ciclos', cicloId, 'disciplinas');
    const q = query(disciplinasRef, orderBy('nome'));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const disciplinasData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setDisciplinas(disciplinasData);
      setLoadingDisciplinas(false);
    }, (error) => {
      console.error("Erro ao buscar disciplinas:", error);
      setLoadingDisciplinas(false);
    });
    return () => unsubscribe();
  }, [user, cicloId]);

  // Hook Registros (sem alteração)
  useEffect(() => {
     if (!user) return; setLoadingRegistros(true); const q = query(collection(db, 'users', user.uid, 'registrosEstudo'), orderBy('data', 'desc')); const unsubscribe = onSnapshot(q, (snapshot) => { setRegistrosEstudo(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))); setLoadingRegistros(false); }, (error) => { console.error("Erro registros:", error); setLoadingRegistros(false); }); return () => unsubscribe();
  }, [user]);

  // Função de Seleção (sem alteração)
  const handleSelectDisciplina = (disciplinaId) => {
    console.log("Selecionando disciplina:", disciplinaId);
    setSelectedDisciplinaId(prevId => (prevId === disciplinaId ? null : disciplinaId));
  };

  // Atualiza o check de loading
  if (loadingCiclo || loadingRegistros || loadingDisciplinas) {
    return <div className="p-6 text-text-color dark:text-dark-text-color">Carregando dados...</div>;
  }

  if (!ciclo) {
    return <div className="p-6 text-danger-color">Ciclo não encontrado.</div>;
  }

  return (
    <div className="p-0">
      {/* Cabeçalho */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <button onClick={onBack} className="inline-flex items-center gap-2 text-primary-color hover:brightness-125 mb-1 font-semibold"> <IconArrowLeft /> Voltar </button>
          <h1 className="text-3xl font-semibold text-heading-color dark:text-dark-heading-color"> {ciclo.nome} </h1>
        </div>
        <button
          onClick={() => setShowRegistroModal(true)}
          disabled={!ciclo.ativo} // <-- 3. ADICIONADO: Desativa se não estiver ativo
          className="px-5 py-3 bg-primary-color text-white rounded-lg font-semibold shadow-lg hover:brightness-110 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
           + Registrar Estudo
        </button>
      </div>

      {/* --- 4. ADICIONADO: Aviso de Ciclo Inativo --- */}
      {!ciclo.ativo && (
        <div className="mb-6 p-4 rounded-lg bg-yellow-100 dark:bg-yellow-900 border border-yellow-300 dark:border-yellow-700 flex items-center gap-3">
          <IconInfo className="text-yellow-600 dark:text-yellow-300 flex-shrink-0" />
          <div className="text-yellow-800 dark:text-yellow-200">
            <h3 className="font-semibold">Este ciclo não está ativo.</h3>
            <p className="text-sm">Você não pode registrar novos estudos em um ciclo inativo. Para registrar, ative este ciclo na página "Meus Ciclos".</p>
          </div>
        </div>
      )}

      {/* --- 5. CORRIGIDO: Modal de Registro --- */}
      {showRegistroModal && (
        <RegistroEstudoModal
          onClose={() => setShowRegistroModal(false)}
          addRegistroEstudo={addRegistroEstudo} // <-- Prop 'addRegistroEstudo' (nome correto)
          cicloId={cicloId}
          userId={user.uid} // <-- Passando 'userId'
          disciplinasDoCiclo={disciplinas} // <-- Passando as disciplinas buscadas
        />
      )}

      {/* Layout da Página */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Roda (Ocupa 2 colunas) */}
        <div className="lg:col-span-2 bg-card-background-color dark:bg-dark-card-background-color p-6 rounded-xl shadow-card-shadow border border-border-color dark:border-dark-border-color">
          <CicloVisual
            cicloId={cicloId}
            user={user}
            selectedDisciplinaId={selectedDisciplinaId}
            onSelectDisciplina={handleSelectDisciplina}
            disciplinas={disciplinas} // Otimização: passa as disciplinas que já buscamos
          />
        </div>

        {/* Painel Lateral (1 coluna) */}
        <div className="lg:col-span-1 space-y-6">
            <div className="bg-card-background-color dark:bg-dark-card-background-color p-6 rounded-xl shadow-card-shadow border border-border-color dark:border-dark-border-color min-h-[400px]">
              {/* --- 6. ADICIONADO: Lógica para esconder painel se inativo --- */}
              {selectedDisciplinaId && ciclo.ativo ? (
                <TopicListPanel
                  user={user}
                  cicloId={cicloId}
                  disciplinaId={selectedDisciplinaId}
                  registrosEstudo={registrosEstudo}
                  disciplinaNome={disciplinas.find(d => d.id === selectedDisciplinaId)?.nome}
                />
              ) : (
                 <div className="flex flex-col items-center justify-center h-full text-center text-subtle-text-color dark:text-dark-subtle-text-color py-10">
                    <span className="text-4xl mb-4">📚</span>
                    <p className="font-semibold">
                      {/* Mensagem muda se o ciclo estiver inativo */}
                      {!ciclo.ativo ? "Ciclo Inativo" : "Selecione uma disciplina"}
                    </p>
                    <p className="text-sm">
                      {!ciclo.ativo
                        ? "O desempenho não é exibido para ciclos inativos."
                        : "Clique em uma disciplina na legenda ao lado para ver seus tópicos e progresso detalhado."
                      }
                    </p>
                 </div>
              )}
            </div>

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