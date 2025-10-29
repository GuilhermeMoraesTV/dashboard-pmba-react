import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../firebaseConfig';
import { doc, collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import { AnimatePresence, motion } from 'framer-motion'; // [NOVO] Para animações

// Componentes Reais do seu projeto
import CicloVisual from '../components/ciclos/CicloVisual';
import RegistroEstudoModal from '../components/ciclos/RegistroEstudoModal';
import StudyTimer from '../components/ciclos/StudyTimer'; // [NOVO]
import DisciplinaDetalheModal from '../components/ciclos/DisciplinaDetalheModal'; // [NOVO]
// [REMOVIDO] TopicListPanel não é mais usado diretamente aqui

// ==================== ÍCONES ====================
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
const IconTarget = () => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
    <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1 1 15 0Z" />
  </svg>
);
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

// ==================== COMPONENTE PRINCIPAL (PÁGINA) ====================
function CicloDetalhePage({ cicloId, onBack, user, addRegistroEstudo }) {

  const [ciclo, setCiclo] = useState(null);
  const [disciplinas, setDisciplinas] = useState([]);
  const [allRegistrosEstudo, setAllRegistrosEstudo] = useState([]);

  const [loading, setLoading] = useState(true);
  const [showRegistroModal, setShowRegistroModal] = useState(false);
  const [registroPreenchido, setRegistroPreenchido] = useState(null);
  const [viewModeCiclo, setViewModeCiclo] = useState('semanal'); // 'semanal' ou 'total'

  // --- [NOVOS ESTADOS] ---
  // Para o timer
  const [disciplinaEmEstudo, setDisciplinaEmEstudo] = useState(null);
  // Para o modal de detalhes
  const [disciplinaEmDetalhe, setDisciplinaEmDetalhe] = useState(null);
  // Para o highlight na roda/legenda
  const [selectedDisciplinaId, setSelectedDisciplinaId] = useState(null);

  // --- Carregamento de Dados (sem alterações) ---
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
                tipoEstudo: data.tipoEstudo || 'Teoria', // Garante o campo
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

  // --- [NOVOS HANDLERS] ---

  // Abre o modal de detalhes
  const handleViewDetails = (disciplina) => {
    setDisciplinaEmDetalhe(disciplina);
    setSelectedDisciplinaId(disciplina.id); // Mantém o highlight
  };

  // Inicia a sessão de estudo (timer)
  const handleStartStudy = (disciplina) => {
    if (ciclo.ativo) {
        setDisciplinaEmEstudo(disciplina);
        setDisciplinaEmDetalhe(null); // Fecha o modal se estiver aberto
        setSelectedDisciplinaId(null); // Limpa highlight
    }
  };

  // Para o timer e abre o modal de registro
  const handleStopStudy = (tempoMinutos) => {
    const disciplina = disciplinaEmEstudo;
    setDisciplinaEmEstudo(null); // Fecha o timer

    // Prepara os dados para o modal de registro
    setRegistroPreenchido({
        disciplinaId: disciplina.id,
        tempoEstudadoMinutos: Math.max(1, Math.round(tempoMinutos)), // Mínimo de 1 min
    });
    setShowRegistroModal(true);
  };

  // Cancela o timer
  const handleCancelStudy = () => {
    setDisciplinaEmEstudo(null);
  };

  // Abre o modal de registro pré-preenchido (vindo do TopicListPanel)
  const openRegistroModalWithTopic = (disciplinaId, topico) => {
    const disciplina = disciplinas.find(d => d.id === disciplinaId);
    if (disciplina) {
        setRegistroPreenchido({
            disciplinaId: disciplina.id,
            topicoId: topico.id,
        });
        setShowRegistroModal(true);
        setDisciplinaEmDetalhe(null); // Fecha o modal de detalhes
    }
  };

  // Fecha o modal de registro
  const handleModalClose = () => {
    setShowRegistroModal(false);
    setRegistroPreenchido(null);
  };

  // Fecha o modal de detalhes
  const handleDetalheModalClose = () => {
    setDisciplinaEmDetalhe(null);
    setSelectedDisciplinaId(null); // Limpa highlight
  };

  // --- Renderização ---

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
    <div className="relative flex flex-col flex-grow h-full overflow-y-auto custom-scrollbar">

      {/* Header Fixo */}
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
                  Meta: {((ciclo.totalMetaSemanalMinutos || 0) / 60).toFixed(1)}h/semana
                </p>
                <p className="flex items-center gap-1.5">
                  <IconFire className="w-4 h-4" />
                  {diasEstudados} dias estudados
                </p>
              </div>
            </div>
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

      {/* Container do conteúdo principal (Roda OU Timer) */}
      <div className="flex flex-col flex-grow items-center p-4 md:p-6">
          <div className="w-full max-w-5xl bg-card-background-color dark:bg-dark-card-background-color rounded-xl shadow-lg p-4 md:p-6 border border-border-color dark:border-dark-border-color">

              {/* [NOVO] Animação de troca entre Roda e Timer */}
              <AnimatePresence mode="wait">
                {disciplinaEmEstudo ? (
                    <motion.div
                        key="timer"
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.9 }}
                        transition={{ duration: 0.2 }}
                        className="w-full"
                    >
                        <StudyTimer
                            disciplina={disciplinaEmEstudo}
                            onStop={handleStopStudy}
                            onCancel={handleCancelStudy}
                        />
                    </motion.div>
                ) : (
                    <motion.div
                        key="ciclo"
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.9 }}
                        transition={{ duration: 0.2 }}
                        className="w-full"
                    >
                        <CicloVisual
                            selectedDisciplinaId={selectedDisciplinaId}
                            onSelectDisciplina={setSelectedDisciplinaId} // Seta o highlight
                            onViewDetails={handleViewDetails} // Abre o modal
                            onStartStudy={handleStartStudy}  // Inicia o timer
                            disciplinas={disciplinas}
                            registrosEstudo={registrosDoCiclo}
                            viewMode={viewModeCiclo}
                            key={viewModeCiclo}
                        />
                    </motion.div>
                )}
              </AnimatePresence>
          </div>

          {/* [REMOVIDO] O TopicListPanel não é mais renderizado aqui */}
      </div>


      {/* Botão Flutuante (Registrar Manualmente) */}
      <AnimatePresence>
      {!disciplinaEmEstudo && ( // Esconde o botão se o timer estiver ativo
        <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            className="fixed bottom-6 right-6 z-30 group"
        >
          <button
              onClick={() => ciclo.ativo && setShowRegistroModal(true)}
              disabled={!ciclo.ativo}
              className={`flex items-center justify-center bg-primary-color text-white rounded-full p-4 shadow-lg hover:bg-primary-hover transition-all duration-300 ease-in-out
                         ${!ciclo.ativo ? 'opacity-50 cursor-not-allowed' : ''}
                         w-16 h-16 group-hover:w-48 group-hover:rounded-lg
                         group-hover:justify-start group-hover:gap-3`}
              title="Registrar Estudo Manualmente"
          >
             <IconPlus />
              <span
                 className="opacity-0 group-hover:opacity-100 transition-opacity duration-300 whitespace-nowrap overflow-hidden font-semibold text-sm pointer-events-none"
               >
                 Registrar Estudo
              </span>
          </button>
        </motion.div>
      )}
      </AnimatePresence>


      {/* --- [NOVOS MODAIS] --- */}

      {/* Modal de Detalhes da Disciplina */}
      <AnimatePresence>
      {disciplinaEmDetalhe && (
        <DisciplinaDetalheModal
            disciplina={disciplinaEmDetalhe}
            registrosEstudo={registrosDoCiclo}
            cicloId={cicloId}
            user={user}
            onClose={handleDetalheModalClose}
            onQuickAddTopic={openRegistroModalWithTopic}
        />
      )}
      </AnimatePresence>

      {/* Modal de Registro (Usado para registro manual e pós-timer) */}
      <AnimatePresence>
      {showRegistroModal && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
            <RegistroEstudoModal
              onClose={handleModalClose}
              addRegistroEstudo={addRegistroEstudo}
              cicloId={cicloId}
              userId={user.uid}
              disciplinasDoCiclo={disciplinas}
              initialData={registroPreenchido} // Passa dados iniciais (do timer ou quick add)
            />
        </motion.div>
      )}
      </AnimatePresence>

      {/* Espaçador final */}
      <div className="h-24 flex-shrink-0"></div>
    </div>
  );
}

export default CicloDetalhePage;