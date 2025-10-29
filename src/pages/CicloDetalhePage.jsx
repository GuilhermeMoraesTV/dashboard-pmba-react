import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../firebaseConfig';
import { doc, collection, query, orderBy, onSnapshot } from 'firebase/firestore';

// Componentes Reais do seu projeto
// IMPORTANTE: Precisaremos de um novo CicloVisual aprimorado
import CicloVisual from '../components/ciclos/CicloVisual';
import RegistroEstudoModal from '../components/ciclos/RegistroEstudoModal';
// IMPORTANTE: Precisaremos de um novo TopicListPanel aprimorado
import TopicListPanel from '../components/ciclos/TopicListPanel';

// ==================== ÍCONES ====================
// (Reutilizando os ícones anteriores e adicionando novos se necessário)
const IconArrowLeft = () => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
    <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
  </svg>
);
const IconPlus = () => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6">
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
  </svg>
);
const IconInfo = () => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
    <path strokeLinecap="round" strokeLinejoin="round" d="m11.25 11.25.041-.02a.75.75 0 0 1 1.063.852l-.708 2.836a.75.75 0 0 0 1.063.853l.041-.021M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9-3.75h.008v.008H12V8.25Z" />
  </svg>
);
const IconFire = () => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
    <path strokeLinecap="round" strokeLinejoin="round" d="M15.362 5.214A8.252 8.252 0 0 1 12 21 8.25 8.25 0 0 1 6.038 7.047 8.287 8.287 0 0 0 9 9.601a8.983 8.983 0 0 1 3.361-6.867 8.21 8.21 0 0 0 3 2.48Z" />
  </svg>
);
const IconClock = () => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
  </svg>
);
const IconTarget = () => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
    <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1 1 15 0Z" />
  </svg>
);
const IconClose = () => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
    </svg>
);
// Ícone para Quick Add no TopicListPanel (opcional)
const IconPlusCircle = () => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v6m3-3H9m12 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
    </svg>
);
// Ícones para os tópicos
const IconTopicTime = () => (<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4 text-blue-500"><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" /></svg>);
const IconTopicQuestions = () => (<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4 text-green-500"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" /></svg>);
const IconTopicPerformance = () => (<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4 text-yellow-500"><path strokeLinecap="round" strokeLinejoin="round" d="M10.5 6h9.75M10.5 6a1.5 1.5 0 1 1-3 0m3 0a1.5 1.5 0 1 0-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m-9.75 0h3.75" /></svg>);
// Ícone para alternar progresso Total/Semanal
const IconSwitch = () => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21 3 16.5m0 0L7.5 12M3 16.5h18M16.5 3 21 7.5m0 0L16.5 12M21 7.5H3" />
    </svg>
);


// ==================== HELPERS ====================
const dateToYMD_local = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const formatDecimalHours = (minutos) => {
  if (!minutos || minutos < 0) return '0h 0m';
  const h = Math.floor(minutos / 60);
  const m = Math.round(minutos % 60);
  return `${h}h ${m}m`;
};

// ==================== COMPONENTE PRINCIPAL (PÁGINA) ====================
function CicloDetalhePage({ cicloId, onBack, user, addRegistroEstudo }) {

  const [ciclo, setCiclo] = useState(null);
  const [disciplinas, setDisciplinas] = useState([]);
  const [allRegistrosEstudo, setAllRegistrosEstudo] = useState([]);

  const [loading, setLoading] = useState(true);
  const [showRegistroModal, setShowRegistroModal] = useState(false);
  const [registroPreenchido, setRegistroPreenchido] = useState(null); // Para pré-preencher o modal
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [selectedDisciplinaForDrawer, setSelectedDisciplinaForDrawer] = useState(null);
  const [selectedDisciplinaIdVisual, setSelectedDisciplinaIdVisual] = useState(null);
  const [viewModeCiclo, setViewModeCiclo] = useState('semanal'); // 'semanal' ou 'total'

  useEffect(() => {
     if (!user || !cicloId) return;
     setLoading(true);
     const cicloRef = doc(db, 'users', user.uid, 'ciclos', cicloId);
     const unsubscribe = onSnapshot(cicloRef, (doc) => {
       if (doc.exists()) {
         setCiclo({ id: doc.id, ...doc.data() });
       } else {
         setCiclo(null);
       }
     });
     return () => unsubscribe();
  }, [user, cicloId]);

  useEffect(() => {
    if (!user || !cicloId) return;
    const disciplinasRef = collection(db, 'users', user.uid, 'ciclos', cicloId, 'disciplinas');
    const q = query(disciplinasRef, orderBy('nome'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setDisciplinas(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    return () => unsubscribe();
  }, [user, cicloId]);

  useEffect(() => {
     if (!user) return;
     const q = query(collection(db, 'users', user.uid, 'registrosEstudo'), orderBy('timestamp', 'desc'));
     const unsubscribe = onSnapshot(q, (snapshot) => {
        const todosRegistros = snapshot.docs.map(doc => {
            const data = doc.data();
            return {
                id: doc.id,
                ...data,
                tempoEstudadoMinutos: Number(data.tempoEstudadoMinutos || data.duracaoMinutos || 0),
                questoesFeitas: Number(data.questoesFeitas || 0),
                acertos: Number(data.acertos || data.questoesAcertadas || 0),
                data: typeof data.data === 'string' ? data.data : (data.data?.toDate ? dateToYMD_local(data.data.toDate()) : dateToYMD_local(new Date())),
            };
        });
        setAllRegistrosEstudo(todosRegistros);
        setLoading(false);
     }, (error) => {
       console.error("Erro ao buscar registros:", error);
       setLoading(false);
     });
     return () => unsubscribe();
  }, [user]);

  const registrosDoCiclo = useMemo(() => {
      if (loading) return [];
      return allRegistrosEstudo.filter(reg => reg.cicloId === cicloId);
  }, [allRegistrosEstudo, cicloId, loading]);

  const diasEstudados = useMemo(() => {
      const dias = new Set(registrosDoCiclo.map(r => r.data));
      return dias.size;
  }, [registrosDoCiclo]);

  const handleSelectDisciplina = (disciplinaId) => {
    const disciplinaSelecionada = disciplinas.find(d => d.id === disciplinaId);
    if (disciplinaSelecionada) {
        if (isDrawerOpen && selectedDisciplinaForDrawer?.id === disciplinaId) {
            setIsDrawerOpen(false);
            setSelectedDisciplinaForDrawer(null);
            setSelectedDisciplinaIdVisual(null);
        } else {
            setSelectedDisciplinaForDrawer({ id: disciplinaId, nome: disciplinaSelecionada.nome });
            setIsDrawerOpen(true);
            setSelectedDisciplinaIdVisual(disciplinaId);
        }
    } else {
        setIsDrawerOpen(false);
        setSelectedDisciplinaForDrawer(null);
        setSelectedDisciplinaIdVisual(null);
    }
  };

  const openRegistroModalWithTopic = (disciplinaId, topico) => {
    const disciplina = disciplinas.find(d => d.id === disciplinaId);
    if (disciplina) {
        setRegistroPreenchido({
            disciplinaId: disciplina.id,
            topicoId: topico.id,
        });
        setShowRegistroModal(true);
    }
  };

  const handleModalClose = () => {
    setShowRegistroModal(false);
    setRegistroPreenchido(null); // Limpa o pré-preenchimento ao fechar
  };

  if (loading) {
    return (
        <div className="flex flex-col flex-grow items-center justify-center p-6">
            <p className="text-text-color dark:text-dark-text-color">Carregando dados do ciclo...</p>
        </div>
    );
  }

  if (!ciclo) {
    return (
        <div className="flex flex-col flex-grow items-center justify-center p-6">
            <p className="text-danger-color mb-4">Ciclo não encontrado.</p>
            <button onClick={onBack} className="text-primary-color underline">Voltar para Meus Ciclos</button>
        </div>
    );
  }

  return (
    <div className="relative flex flex-col flex-grow h-full">

      <div className="relative overflow-hidden bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-800 rounded-b-3xl shadow-lg p-6 flex-shrink-0">
        <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)', backgroundSize: '40px 40px' }}></div>
        <div className="relative z-10">
          <button onClick={onBack} className="inline-flex items-center gap-2 text-white/90 hover:text-white mb-4 font-semibold transition-all hover:gap-3">
            <IconArrowLeft /> Voltar para Meus Ciclos
          </button>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <div className="flex items-center gap-3 mb-1">
                <h1 className="text-2xl md:text-3xl font-bold text-white truncate max-w-xs md:max-w-md lg:max-w-lg">
                  {ciclo.nome}
                </h1>
                {ciclo.ativo && (
                  <span className="px-3 py-1 bg-white/20 backdrop-blur-sm text-white text-xs font-bold rounded-full animate-pulse flex-shrink-0">
                    ● ATIVO
                  </span>
                )}
              </div>
              <div className="flex items-center gap-4 text-white/80 text-xs">
                <p className="flex items-center gap-1.5">
                  <IconTarget className="w-4 h-4" />
                  Meta: {(ciclo.totalMetaSemanalMinutos / 60).toFixed(1) || 0}h/semana
                </p>
                <p className="flex items-center gap-1.5">
                  <IconFire className="w-4 h-4" />
                  {diasEstudados} dias estudados
                </p>
              </div>
            </div>
             {/* Botão de Toggle Visualização */}
            <button
                onClick={() => setViewModeCiclo(prev => prev === 'semanal' ? 'total' : 'semanal')}
                className="flex items-center gap-2 px-3 py-1.5 bg-white/20 backdrop-blur-sm text-white text-xs font-semibold rounded-full hover:bg-white/30 transition-colors"
                title={viewModeCiclo === 'semanal' ? 'Ver Progresso Total' : 'Ver Progresso Semanal'}
            >
                <IconSwitch className="w-4 h-4" />
                {viewModeCiclo === 'semanal' ? 'Semanal' : 'Total'}
            </button>
          </div>
        </div>
      </div>

      {!ciclo.ativo && (
        <div className="m-4 p-4 rounded-lg bg-yellow-100 dark:bg-yellow-900 border border-yellow-300 dark:border-yellow-700 flex items-center gap-3 flex-shrink-0">
          <IconInfo className="text-yellow-600 dark:text-yellow-300 flex-shrink-0" />
          <div className="text-yellow-800 dark:text-yellow-200">
            <h3 className="font-semibold">Este ciclo não está ativo.</h3>
            <p className="text-sm">Você não pode registrar novos estudos neste ciclo.</p>
          </div>
        </div>
      )}

      <div className="flex flex-grow justify-center items-center p-4 md:p-6 overflow-hidden">
          <div className="w-full h-full max-w-5xl max-h-[calc(100vh-250px)] bg-card-background-color dark:bg-dark-card-background-color rounded-xl shadow-lg p-4 md:p-6 border border-border-color dark:border-dark-border-color flex justify-center items-center">
              <div className="w-full h-full">
                <CicloVisual
                    selectedDisciplinaId={selectedDisciplinaIdVisual}
                    onSelectDisciplina={handleSelectDisciplina}
                    disciplinas={disciplinas}
                    registrosEstudo={registrosDoCiclo}
                    viewMode={viewModeCiclo} // Passa o modo de visualização
                    key={viewModeCiclo} // Força re-renderização ao mudar modo
                />
              </div>
          </div>
      </div>

      <div className="fixed bottom-6 right-6 z-30 group">
          <button
              onClick={() => ciclo.ativo && setShowRegistroModal(true)}
              disabled={!ciclo.ativo}
              className={`flex items-center justify-center bg-primary-color text-white rounded-full p-4 shadow-lg hover:bg-primary-hover transition-all duration-300 ease-in-out
                         ${!ciclo.ativo ? 'opacity-50 cursor-not-allowed' : ''}
                         w-16 h-16 group-hover:w-48 group-hover:rounded-lg`}
              title="Registrar Estudo"
          >
             <IconPlus />
              <span
                 className="absolute left-16 opacity-0 group-hover:opacity-100 transition-opacity duration-300 whitespace-nowrap overflow-hidden font-semibold text-sm pointer-events-none"
               >
                 Registrar Estudo
              </span>
          </button>
      </div>

      <div
        className={`fixed top-0 right-0 h-full w-full max-w-md bg-card-background-color dark:bg-dark-card-background-color shadow-2xl z-40 transform transition-transform duration-300 ease-in-out border-l border-border-color dark:border-dark-border-color flex flex-col
                   ${isDrawerOpen ? 'translate-x-0' : 'translate-x-full'}`}
      >
          {selectedDisciplinaForDrawer && (
            <>
              <div className="flex justify-between items-center p-4 border-b border-border-color dark:border-dark-border-color">
                  <h2 className="text-lg font-semibold text-heading-color dark:text-dark-heading-color">
                     Tópicos de: {selectedDisciplinaForDrawer.nome}
                  </h2>
                  <button onClick={() => { setIsDrawerOpen(false); setSelectedDisciplinaForDrawer(null); setSelectedDisciplinaIdVisual(null); }} className="text-subtle-text-color dark:text-dark-subtle-text-color hover:text-danger-color">
                      <IconClose />
                  </button>
              </div>
              <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                  <TopicListPanel
                      user={user}
                      cicloId={cicloId}
                      disciplinaId={selectedDisciplinaForDrawer.id}
                      registrosEstudo={registrosDoCiclo}
                      disciplinaNome={selectedDisciplinaForDrawer.nome}
                      onQuickAddTopic={openRegistroModalWithTopic} // Passa a função para quick add
                  />
              </div>
            </>
          )}
      </div>

      {isDrawerOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-30"
          onClick={() => { setIsDrawerOpen(false); setSelectedDisciplinaForDrawer(null); setSelectedDisciplinaIdVisual(null); }}
        ></div>
      )}


      {showRegistroModal && (
        <RegistroEstudoModal
          onClose={handleModalClose}
          addRegistroEstudo={addRegistroEstudo}
          cicloId={cicloId}
          userId={user.uid}
          disciplinasDoCiclo={disciplinas}
          initialData={registroPreenchido} // Passa dados iniciais se houver
        />
      )}
    </div>
  );
}

export default CicloDetalhePage;