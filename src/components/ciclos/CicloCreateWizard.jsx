import React, { useState } from 'react';
import { useCiclos } from '../../hooks/useCiclos';

const IconTrash = () => <span>🗑️</span>;

// Recebe 'onClose' e 'user' como props
function CicloCreateWizard({ onClose, user }) {
  const [step, setStep] = useState(1);
  const [nomeCiclo, setNomeCiclo] = useState('');
  const [cargaHoraria, setCargaHoraria] = useState('');

  const [disciplinas, setDisciplinas] = useState([]);
  const [nomeNovaDisciplina, setNomeNovaDisciplina] = useState('');
  const [nivelNovaDisciplina, setNivelNovaDisciplina] = useState('Iniciante');

  // Passa o 'user' da prop para o hook
  const { criarCiclo, loading, error } = useCiclos(user);

  const handleAddDisciplina = (e) => {
    e.preventDefault();
    if (!nomeNovaDisciplina) return;
    setDisciplinas([
      ...disciplinas,
      {
        id: Date.now(),
        nome: nomeNovaDisciplina,
        nivel: nivelNovaDisciplina,
      },
    ]);
    setNomeNovaDisciplina('');
    setNivelNovaDisciplina('Iniciante');
  };

  const handleRemoveDisciplina = (id) => {
    setDisciplinas(disciplinas.filter(d => d.id !== id));
  };

  const handleFinalSubmit = async () => {
    const cicloData = {
      nome: nomeCiclo,
      cargaHorariaTotal: parseFloat(cargaHoraria),
      disciplinas: disciplinas,
    };
    const sucesso = await criarCiclo(cicloData);
    if (sucesso) {
      onClose();
    }
  };

  const isStep1Valid = nomeCiclo && cargaHoraria > 0;
  const isStep2Valid = disciplinas.length > 0;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex justify-center items-center z-50 p-4">
      <div className="bg-card-background-color dark:bg-dark-card-background-color p-6 rounded-lg shadow-xl w-full max-w-2xl border border-border-color dark:border-dark-border-color">

        {step === 1 && (
          <div>
            <h2 className="text-xl font-bold text-heading-color dark:text-dark-heading-color mb-6">Novo Ciclo (Passo 1 de 2): Detalhes</h2>
            <div className="mb-4">
              <label className="block text-subtle-text-color dark:text-dark-subtle-text-color mb-2 font-medium">Nome do Ciclo</label>
              <input
                type="text"
                value={nomeCiclo}
                onChange={(e) => setNomeCiclo(e.target.value)}
                className="w-full p-3 rounded bg-background-color dark:bg-dark-background-color text-text-color dark:text-dark-text-color border border-border-color dark:border-dark-border-color focus:outline-none focus:ring-2 focus:ring-primary-color"
                placeholder="Ex: PMBA 2025 - Soldado"
              />
            </div>
            <div className="mb-6">
              <label className="block text-subtle-text-color dark:text-dark-subtle-text-color mb-2 font-medium">Carga Horária Semanal Total (horas)</label>
              <input
                type="number"
                value={cargaHoraria}
                onChange={(e) => setCargaHoraria(e.target.value)}
                className="w-full p-3 rounded bg-background-color dark:bg-dark-background-color text-text-color dark:text-dark-text-color border border-border-color dark:border-dark-border-color focus:outline-none focus:ring-2 focus:ring-primary-color"
                placeholder="Ex: 30.5"
              />
            </div>
            <div className="flex justify-end gap-4">
                <button onClick={onClose} className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600">Cancelar</button>
                <button
                    onClick={() => setStep(2)}
                    disabled={!isStep1Valid}
                    className="px-6 py-2 bg-primary-color text-white rounded font-semibold enabled:hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    Próximo
                </button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div>
            <h2 className="text-xl font-bold text-heading-color dark:text-dark-heading-color mb-4">Adicionar Disciplinas (Passo 2 de 2)</h2>

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
              <button type="submit" className="px-5 py-3 bg-green-500 text-white rounded font-semibold hover:bg-green-600">+</button>
            </form>

            <div className="max-h-60 overflow-y-auto space-y-2 mb-6 p-2 bg-background-color dark:bg-dark-background-color rounded-lg">
              {disciplinas.length === 0 && <p className='text-subtle-text-color dark:text-dark-subtle-text-color text-center p-4'>Nenhuma disciplina adicionada.</p>}
              {disciplinas.map((disciplina) => (
                <div key={disciplina.id} className="flex justify-between items-center bg-card-background-color dark:bg-dark-card-background-color border border-border-color dark:border-dark-border-color p-3 rounded-md">
                  <div>
                    <span className="font-semibold text-text-color dark:text-dark-text-color">{disciplina.nome}</span>
                    <span className={`text-xs ml-2 py-0.5 px-2 rounded-full ${
                        disciplina.nivel === 'Iniciante' ? 'bg-red-200 text-red-900' :
                        disciplina.nivel === 'Medio' ? 'bg-yellow-200 text-yellow-900' :
                        'bg-green-200 text-green-900'
                    }`}>
                      {disciplina.nivel}
                    </span>
                  </div>
                  <div className="flex gap-4 items-center">
                    <button
                      disabled
                      className="text-xs text-blue-400 opacity-50 cursor-not-allowed"
                    >
                      Tópicos (em breve)
                    </button>
                    <button onClick={() => handleRemoveDisciplina(disciplina.id)} className="text-danger-color hover:brightness-125">
                      <IconTrash />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {error && <p className="text-danger-color text-sm mb-4">Erro: {error}</p>}

            <div className="flex justify-between mt-6">
              <button onClick={() => setStep(1)} className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600">Voltar</button>
              <button
                onClick={handleFinalSubmit}
                disabled={!isStep2Valid || loading}
                className="px-6 py-2 bg-primary-color text-white rounded font-semibold enabled:hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? "Salvando..." : "Finalizar e Criar Ciclo"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default CicloCreateWizard;