import React, { useState, useEffect } from 'react';
import { db } from '../../firebaseConfig';
import { collection, getDocs, doc, getDoc } from 'firebase/firestore';
import { useCiclos } from '../../hooks/useCiclos';
import TopicsManagerModal from './TopicsManagerModal';

// Componente para Etapa 1: Info Básica (Sem alteração)
function EtapaInfoBasica({ nome, setNome, cargaHoraria, setCargaHoraria }) {
  return (
    <div>
      <h3 className="text-xl font-semibold mb-4 text-heading-color dark:text-dark-heading-color">1. Informações Básicas</h3>
      <div className="mb-4">
        <label className="block text-sm font-medium text-text-color dark:text-dark-text-color mb-1">
          Nome do Ciclo
        </label>
        <input
          type="text"
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          placeholder="Ex: PMBA Pós-Edital"
          className="w-full p-2 rounded-lg bg-background-color dark:bg-dark-background-color border border-border-color dark:border-dark-border-color focus:outline-none focus:ring-2 focus:ring-primary-color"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-text-color dark:text-dark-text-color mb-1">
          Carga Horária Semanal Total (horas)
        </label>
        <input
          type="number"
          value={cargaHoraria}
          onChange={(e) => setCargaHoraria(e.target.value)}
          placeholder="Ex: 25"
          className="w-full p-2 rounded-lg bg-background-color dark:bg-dark-background-color border border-border-color dark:border-dark-border-color focus:outline-none focus:ring-2 focus:ring-primary-color"
        />
      </div>
    </div>
  );
}

// Componente para Etapa 2: Disciplinas e Tópicos (Sem alteração)
function EtapaDisciplinas({ disciplinas, setDisciplinas, openTopicsManager }) {
  const addDisciplina = () => {
    setDisciplinas([...disciplinas, { id: null, nome: '', nivelProficiencia: 'Iniciante', topicos: [] }]);
  };

  const updateDisciplina = (index, campo, valor) => {
    const novasDisciplinas = [...disciplinas];
    novasDisciplinas[index][campo] = valor;
    setDisciplinas(novasDisciplinas);
  };

  const removeDisciplina = (index) => {
    const novasDisciplinas = disciplinas.filter((_, i) => i !== index);
    setDisciplinas(novasDisciplinas);
  };

  return (
    <div>
      <h3 className="text-xl font-semibold mb-4 text-heading-color dark:text-dark-heading-color">2. Disciplinas e Tópicos</h3>
      {disciplinas.map((disciplina, index) => (
        <div key={index} className="p-4 mb-3 border border-border-color dark:border-dark-border-color rounded-lg">
          <div className="flex flex-col md:flex-row gap-4">
            <input
              type="text"
              value={disciplina.nome}
              onChange={(e) => updateDisciplina(index, 'nome', e.target.value)}
              placeholder="Nome da Disciplina"
              className="flex-grow p-2 rounded-lg bg-background-color dark:bg-dark-background-color border border-border-color dark:border-dark-border-color"
            />
            <select
              value={disciplina.nivelProficiencia}
              onChange={(e) => updateDisciplina(index, 'nivelProficiencia', e.target.value)}
              className="p-2 rounded-lg bg-background-color dark:bg-dark-background-color border border-border-color dark:border-dark-border-color"
            >
              <option value="Iniciante">Iniciante</option>
              <option value="Medio">Médio</option>
              <option value="Avançado">Avançado</option>
            </select>
          </div>
          <div className="flex justify-between items-center mt-3">
            <button
              onClick={() => openTopicsManager(index)}
              className="text-sm text-primary-color hover:underline"
            >
              {disciplina.topicos.length} Tópicos
            </button>
            <button
              onClick={() => removeDisciplina(index)}
              className="text-sm text-red-500 hover:underline"
            >
              Remover Disciplina
            </button>
          </div>
        </div>
      ))}
      <button
        onClick={addDisciplina}
        className="mt-2 px-4 py-2 bg-primary-color/20 text-primary-color rounded-lg font-semibold hover:bg-primary-color/30"
      >
        + Adicionar Disciplina
      </button>
    </div>
  );
}

function ValidationAlert({ message, onClose }) {
  return (
    <div className="fixed inset-0 bg-black/60 z-[70] flex justify-center items-center p-4">
      <div className="bg-card-background-color dark:bg-dark-card-background-color p-6 rounded-lg shadow-xl max-w-md w-full border-2 border-warning-color">
        <div className="flex items-center gap-3 mb-4">
          <span className="text-3xl">⚠️</span>
          <h3 className="text-lg font-bold text-heading-color dark:text-dark-heading-color">
            Atenção
          </h3>
        </div>
        <p className="text-text-color dark:text-dark-text-color mb-6">
          {message}
        </p>
        <button
          onClick={onClose}
          className="w-full px-5 py-2 bg-primary-color text-white rounded-lg font-semibold hover:brightness-110 transition-all"
        >
          Entendi
        </button>
      </div>
    </div>
  );
}


// --- Componente Principal do Modal de Edição ---
function CicloEditModal({ onClose, user, ciclo }) {
  const [etapa, setEtapa] = useState(1);
  const [nome, setNome] = useState('');
  const [cargaHoraria, setCargaHoraria] = useState(0);
  const [disciplinas, setDisciplinas] = useState([]);

  const [showValidation, setShowValidation] = useState(false);
    const [validationMessage, setValidationMessage] = useState('');

  const [showTopicsModal, setShowTopicsModal] = useState(false);
  const [disciplinaIndex, setDisciplinaIndex] = useState(null);

  const { editarCiclo, loading, error } = useCiclos(user);
  const [loadingData, setLoadingData] = useState(true);

  // Carregamento dos dados (Sem alteração)
  useEffect(() => {
    if (!user || !ciclo) return;

    const carregarDadosCiclo = async () => {
      setLoadingData(true);

      setNome(ciclo.nome);
      setCargaHoraria(ciclo.cargaHorariaSemanalTotal);

      const disciplinasRef = collection(db, 'users', user.uid, 'ciclos', ciclo.id, 'disciplinas');
      const disciplinasSnap = await getDocs(disciplinasRef);
      const disciplinasData = disciplinasSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

      const topicosRef = collection(db, 'users', user.uid, 'ciclos', ciclo.id, 'topicos');
      const topicosSnap = await getDocs(topicosRef);
      const topicosData = topicosSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

      const disciplinasComTopicos = disciplinasData.map(d => ({
        ...d,
        topicos: topicosData
          .filter(t => t.disciplinaId === d.id)
          .map(t => ({ id: t.id, nome: t.nome }))
      }));

      setDisciplinas(disciplinasComTopicos);
      setLoadingData(false);
    };

    carregarDadosCiclo();
  }, [user, ciclo]);


  // Funções de Navegação e Modais (Sem alteração)
  const proximaEtapa = () => {
    if (etapa === 1 && (!nome || cargaHoraria <= 0)) {
      alert("Por favor, preencha o nome e a carga horária.");
      return;
    }
    setEtapa(etapa + 1);
  };
  const etapaAnterior = () => setEtapa(etapa - 1);

  const openTopicsManager = (index) => {
    setDisciplinaIndex(index);
    setShowTopicsModal(true);
  };

  const handleTopicsSave = (novosTopicos) => {
    const novasDisciplinas = [...disciplinas];
    novasDisciplinas[disciplinaIndex].topicos = novosTopicos;
    setDisciplinas(novasDisciplinas);
    setShowTopicsModal(false);
    setDisciplinaIndex(null);
  };

  // Submissão (Sem alteração)
  const handleSave = async () => {
    if (disciplinas.length === 0) {
          setValidationMessage("Adicione pelo menos uma disciplina antes de salvar.");
          setShowValidation(true);
          return;
        }

    const cicloData = {
      nome,
      cargaHorariaTotal: parseFloat(cargaHoraria),
      disciplinas,
    };

    const sucesso = await editarCiclo(ciclo.id, cicloData);
    if (sucesso) {
      onClose();
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/60 z-40 flex justify-center items-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-card-background-color dark:bg-dark-card-background-color p-8 rounded-lg shadow-xl z-50 w-full max-w-3xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()} // <-- Isso já estava certo
      >
        <h2 className="text-2xl font-bold text-heading-color dark:text-dark-heading-color mb-6">
          Editar Ciclo de Estudo
        </h2>

        {loadingData ? (
          <p>Carregando dados do ciclo...</p>
        ) : (
          <>
            {etapa === 1 && (
              <EtapaInfoBasica
                nome={nome}
                setNome={setNome}
                cargaHoraria={cargaHoraria}
                setCargaHoraria={setCargaHoraria}
              />
            )}
            {etapa === 2 && (
              <EtapaDisciplinas
                disciplinas={disciplinas}
                setDisciplinas={setDisciplinas}
                openTopicsManager={openTopicsManager}
              />
            )}

            <div className="flex justify-between mt-8">
              <button
                onClick={etapa === 1 ? onClose : etapaAnterior}
                disabled={loading}
                className="px-5 py-2 bg-gray-200 text-gray-800 rounded-lg font-semibold hover:bg-gray-300 disabled:opacity-50"
              >
                {etapa === 1 ? 'Cancelar' : 'Voltar'}
              </button>

              {etapa === 1 && (
                <button
                  onClick={proximaEtapa}
                  className="px-5 py-2 bg-primary-color text-white rounded-lg font-semibold shadow-lg hover:brightness-110"
                >
                  Próximo
                </button>
              )}
              {etapa === 2 && (
                <button
                  onClick={handleSave}
                  disabled={loading}
                  className="px-5 py-2 bg-green-500 text-white rounded-lg font-semibold shadow-lg hover:bg-green-600 disabled:opacity-50"
                >
                  {loading ? "Salvando..." : "Salvar Alterações"}
                </button>
              )}
            </div>

            {error && <p className="text-red-500 mt-4">Erro: {error}</p>}
          </>
        )}
      </div>

      {/* Modal de Tópicos (CORRIGIDO) */}
      {showTopicsModal && (
        <TopicsManagerModal
          // A prop aqui deve ser 'initialTopics' e não 'topicosIniciais'
          initialTopics={disciplinas[disciplinaIndex].topicos} // <-- CORRIGIDO
          onClose={() => setShowTopicsModal(false)}
          onSave={handleTopicsSave}
          disciplinaNome={disciplinas[disciplinaIndex].nome}
        />
      )}

  {showValidation && (
          <ValidationAlert
            message={validationMessage}
            onClose={() => setShowValidation(false)}
          />
        )}
    </div>
  );
}

export default CicloEditModal;