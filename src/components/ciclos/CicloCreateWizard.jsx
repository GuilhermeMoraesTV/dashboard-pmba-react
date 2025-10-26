import React, { useState } from 'react';
import { useCiclos } from '../../hooks/useCiclos';
import TopicsManagerModal from './TopicsManagerModal';

// Ícones (sem alteração)
const IconTrash = () => <span>🗑️</span>;
const IconTopic = () => <span>📚</span>;

function CicloCreateWizard({ onClose, user }) {
  const [step, setStep] = useState(1);
  const [nomeCiclo, setNomeCiclo] = useState('');
  const [cargaHoraria, setCargaHoraria] = useState('');

  const [disciplinas, setDisciplinas] = useState([]);
  const [nomeNovaDisciplina, setNomeNovaDisciplina] = useState('');
  const [nivelNovaDisciplina, setNivelNovaDisciplina] = useState('Iniciante');
  const [managingTopicsFor, setManagingTopicsFor] = useState(null);

  const { criarCiclo, loading, error } = useCiclos(user);

  const handleAddDisciplina = (e) => {
    e.preventDefault();
    if (!nomeNovaDisciplina.trim()) return;
    setDisciplinas([
      ...disciplinas,
      {
        id: Date.now(),
        nome: nomeNovaDisciplina.trim(),
        nivel: nivelNovaDisciplina,
        topicos: [],
      },
    ]);
    setNomeNovaDisciplina('');
    setNivelNovaDisciplina('Iniciante');
  };

  const handleRemoveDisciplina = (id) => {
    setDisciplinas(disciplinas.filter(d => d.id !== id));
  };

  const handleSaveTopics = (disciplinaIndex, topicosAtualizados) => {
    const novasDisciplinas = [...disciplinas];
    novasDisciplinas[disciplinaIndex].topicos = topicosAtualizados;
    setDisciplinas(novasDisciplinas);
    setManagingTopicsFor(null);
  };

  const handleFinalSubmit = async () => {
    const cicloData = {
      nome: nomeCiclo,
      cargaHorariaTotal: parseFloat(cargaHoraria) || 0,
      disciplinas: disciplinas,
    };
    if (cicloData.cargaHorariaTotal <= 0 || cicloData.disciplinas.length === 0) {
        alert("Verifique a carga horária e se adicionou disciplinas.");
        return;
    }
    const sucesso = await criarCiclo(cicloData);
    if (sucesso) {
      onClose();
    }
  };

  const isStep1Valid = nomeCiclo.trim() !== '' && (parseFloat(cargaHoraria) || 0) > 0;
  const isStep2Valid = disciplinas.length > 0;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex justify-center items-center z-50 p-4">
      <div className="bg-card-background-color dark:bg-dark-card-background-color p-6 rounded-xl shadow-xl w-full max-w-2xl border border-border-color dark:border-dark-border-color">

        {step === 1 && (
          // --- PASSO 1 (sem alteração) ---
          <div>
            <h2 className="text-xl font-bold text-heading-color dark:text-dark-heading-color mb-6 border-b border-border-color dark:border-dark-border-color pb-2">
              Novo Ciclo (Passo 1 de 2): Detalhes
            </h2>
            <div className="mb-4">
              <label className="block text-sm font-medium text-subtle-text-color dark:text-dark-subtle-text-color mb-1">Nome do Ciclo</label>
              <input
                type="text"
                value={nomeCiclo}
                onChange={(e) => setNomeCiclo(e.target.value)}
                className="w-full p-3 rounded bg-background-color dark:bg-dark-background-color text-text-color dark:text-dark-text-color border border-border-color dark:border-dark-border-color focus:outline-none focus:ring-2 focus:ring-primary-color"
                placeholder="Ex: PMBA 2025 - Soldado"
              />
            </div>
            <div className="mb-6">
              <label className="block text-sm font-medium text-subtle-text-color dark:text-dark-subtle-text-color mb-1">Carga Horária Semanal Total (horas)</label>
              <input
                type="number"
                step="0.1"
                value={cargaHoraria}
                onChange={(e) => setCargaHoraria(e.target.value)}
                className="w-full p-3 rounded bg-background-color dark:bg-dark-background-color text-text-color dark:text-dark-text-color border border-border-color dark:border-dark-border-color focus:outline-none focus:ring-2 focus:ring-primary-color"
                placeholder="Ex: 30.5"
              />
            </div>
            <div className="flex justify-end gap-4 mt-6 pt-4 border-t border-border-color dark:border-dark-border-color">
                <button
                  onClick={onClose}
                  className="px-5 py-2 bg-gray-500 text-white rounded-lg font-semibold hover:bg-gray-600 transition-colors"
                >
                  Cancelar
                </button>
                <button
                    onClick={() => setStep(2)}
                    disabled={!isStep1Valid}
                    className="px-6 py-2 bg-primary-color text-white rounded-lg font-semibold enabled:hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
                >
                    Próximo
                </button>
            </div>
          </div>
        )}

        {step === 2 && (
          // --- PASSO 2 ---
          <div>
            <h2 className="text-xl font-bold text-heading-color dark:text-dark-heading-color mb-4 border-b border-border-color dark:border-dark-border-color pb-2">
              Adicionar Disciplinas (Passo 2 de 2)
            </h2>

            {/* Formulário Add Disciplina (sem alteração) */}
            <form onSubmit={handleAddDisciplina} className="flex flex-col sm:flex-row gap-2 mb-4">
              <input
                type="text"
                value={nomeNovaDisciplina}
                onChange={(e) => setNomeNovaDisciplina(e.target.value)}
                placeholder="Nome da Disciplina"
                className="flex-grow p-3 rounded bg-background-color dark:bg-dark-background-color text-text-color dark:text-dark-text-color border border-border-color dark:border-dark-border-color focus:outline-none focus:ring-2 focus:ring-primary-color"
              />
              <select
                value={nivelNovaDisciplina}
                onChange={(e) => setNivelNovaDisciplina(e.target.value)}
                className="p-3 rounded bg-background-color dark:bg-dark-background-color text-text-color dark:text-dark-text-color border border-border-color dark:border-dark-border-color focus:outline-none focus:ring-2 focus:ring-primary-color"
              >
                <option value="Iniciante">Iniciante</option>
                <option value="Medio">Médio</option>
                <option value="Avançado">Avançado</option>
              </select>
              <button
                type="submit"
                className="px-5 py-3 bg-success-color text-white rounded-lg font-semibold hover:brightness-110 transition-colors"
              >
                + Adicionar
              </button>
            </form>

            {/* Lista de disciplinas */}
            <h3 className="text-md font-semibold text-heading-color dark:text-dark-heading-color mb-2">Disciplinas Adicionadas</h3>
            <div className="max-h-60 overflow-y-auto space-y-2 mb-6 p-3 bg-background-color dark:bg-dark-background-color rounded-lg border border-border-color dark:border-dark-border-color">
              {disciplinas.length === 0 && <p className='text-subtle-text-color dark:text-dark-subtle-text-color text-center py-4'>Nenhuma disciplina adicionada.</p>}
              {disciplinas.map((disciplina, index) => (
                <div key={disciplina.id} className="flex justify-between items-center bg-card-background-color dark:bg-dark-card-background-color border border-border-color dark:border-dark-border-color p-3 rounded-md shadow-sm">
                  <div>
                    <span className="font-semibold text-text-color dark:text-dark-text-color">{disciplina.nome}</span>
                    {/* --- LINHA CORRIGIDA --- */}
                    <span className={`text-xs ml-2 py-0.5 px-2 rounded-full ${
                        disciplina.nivel === 'Iniciante' ? 'bg-red-200 text-red-900' :
                        disciplina.nivel === 'Medio' ? 'bg-yellow-200 text-yellow-900' :
                        'bg-green-200 text-green-900'
                    }`}>
                    {/* --- FIM DA CORREÇÃO --- */}
                      {disciplina.nivel}
                    </span>
                  </div>
                  <div className="flex gap-4 items-center">
                    <button
                      onClick={() => setManagingTopicsFor({ index: index, nome: disciplina.nome })}
                      className="flex items-center gap-1 text-xs text-blue-500 hover:text-blue-400 font-medium"
                      title="Gerenciar tópicos"
                    >
                      <IconTopic /> Tópicos ({disciplina.topicos.length})
                    </button>
                    <button onClick={() => handleRemoveDisciplina(disciplina.id)} className="text-danger-color hover:brightness-125" title="Excluir disciplina">
                      <IconTrash />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {error && <p className="text-danger-color text-sm mb-4 text-center">Erro ao salvar: {error}</p>}

            {/* Botões de Navegação (sem alteração) */}
            <div className="flex justify-between mt-6 pt-4 border-t border-border-color dark:border-dark-border-color">
              <button
                onClick={() => setStep(1)}
                className="px-5 py-2 bg-gray-500 text-white rounded-lg font-semibold hover:bg-gray-600 transition-colors"
              >
                Voltar
              </button>
              <button
                onClick={handleFinalSubmit}
                disabled={!isStep2Valid || loading}
                className="px-6 py-2 bg-primary-color text-white rounded-lg font-semibold enabled:hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
              >
                {loading ? "Salvando..." : "Finalizar e Criar Ciclo"}
              </button>
            </div>
          </div>
        )}

        {/* Modal de Tópicos (sem alteração) */}
        {managingTopicsFor !== null && (
          <TopicsManagerModal
            disciplinaNome={managingTopicsFor.nome}
            initialTopics={disciplinas[managingTopicsFor.index].topicos}
            onClose={() => setManagingTopicsFor(null)}
            onSave={(topicosAtualizados) => handleSaveTopics(managingTopicsFor.index, topicosAtualizados)}
          />
        )}

      </div>
    </div>
  );
}

export default CicloCreateWizard;