import React, { useState, useEffect } from 'react';

// --- Ícones ---
const IconTarget = () => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 text-gray-400">
    <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 6h9.75M10.5 6a1.5 1.5 0 1 1-3 0m3 0a1.5 1.5 0 1 0-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m-9.75 0h3.75" />
  </svg>
);
const IconClock = () => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 text-gray-400">
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
  </svg>
);
const IconCheck = () => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
    <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
  </svg>
);
// Novos Ícones
const IconTrophy = () => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-10 h-10 text-yellow-500">
    <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
  </svg>
);
const IconPlus = () => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
  </svg>
);
const IconMinus = () => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 12h-15" />
  </svg>
);
const IconLoader = () => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 animate-spin">
    <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
  </svg>
);
// --- Fim Ícones ---


function GoalsTab({ onSetGoal, goalsHistory }) {
  const currentGoal = goalsHistory && goalsHistory[0];
  const [questionsGoal, setQuestionsGoal] = useState(0);
  const [hoursGoal, setHoursGoal] = useState(0);
  const [isLoading, setIsLoading] = useState(false); // Estado de carregamento

  useEffect(() => {
    if (currentGoal) {
      setQuestionsGoal(currentGoal.questions || 0);
      setHoursGoal(currentGoal.hours || 0);
    }
  }, [currentGoal]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true); // Ativa o loading
    try {
      await onSetGoal({
        questions: parseInt(questionsGoal, 10),
        hours: parseFloat(hoursGoal)
      });
    } catch (error) {
      console.error("Erro ao salvar meta:", error);
    } finally {
      setIsLoading(false); // Desativa o loading
    }
  };

  // Funções para os botões +/-
  const handleQuestionsChange = (amount) => {
    setQuestionsGoal(q => Math.max(0, (parseInt(q, 10) || 0) + amount));
  };
  const handleHoursChange = (amount) => {
    setHoursGoal(h => Math.max(0, (parseFloat(h) || 0) + amount));
  };

  return (
    <div>
      <h1 className="text-3xl font-semibold text-heading-color dark:text-dark-heading-color mb-6">
        Defina Suas Metas
      </h1>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Coluna da Esquerda (Formulário) */}
        <div className="lg:col-span-2 space-y-6">

          {/* Cartão "Hero" */}
          <div className="bg-card-background-color dark:bg-dark-card-background-color rounded-xl shadow-card-shadow p-6 flex items-center gap-6 border border-border-color dark:border-dark-border-color">
            <div className="flex-shrink-0 bg-yellow-100 dark:bg-yellow-900 p-4 rounded-full">
              <IconTrophy />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-heading-color dark:text-dark-heading-color mb-1">
                Ajuste seu Foco
              </h2>
              <p className="text-sm text-subtle-text-color dark:text-dark-subtle-text-color">
                Definir metas diárias é o primeiro passo para criar constância.
                Sua meta atual é usada para medir seu progresso no calendário.
              </p>
            </div>
          </div>

          {/* Cartão do Formulário */}
          <div className="bg-card-background-color dark:bg-dark-card-background-color rounded-xl shadow-card-shadow p-6 border border-border-color dark:border-dark-border-color">
            <form onSubmit={handleSubmit} className="space-y-6">

              {/* Input de Questões com botões +/- */}
              <div>
                <label htmlFor="questions-goal" className="block text-sm font-medium text-text-color dark:text-dark-text-color mb-2">
                  Meta de Questões (por dia)
                </label>
                <div className="flex items-center gap-2">
                  <button type="button" onClick={() => handleQuestionsChange(-10)} className="p-3 bg-background-color dark:bg-dark-background-color border border-border-color dark:border-dark-border-color rounded-lg hover:bg-gray-100 dark:hover:bg-dark-border-color text-text-color dark:text-dark-text-color">
                    <IconMinus />
                  </button>
                  <div className="relative flex-1">
                    <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                      <IconTarget />
                    </div>
                    <input
                      id="questions-goal"
                      type="number" min="0"
                      value={questionsGoal}
                      onChange={(e) => setQuestionsGoal(e.target.value)}
                      className="w-full p-3 pl-10 rounded-lg bg-background-color dark:bg-dark-background-color border border-border-color dark:border-dark-border-color focus:outline-none focus:ring-2 focus:ring-primary-color"
                    />
                  </div>
                  <button type="button" onClick={() => handleQuestionsChange(10)} className="p-3 bg-background-color dark:bg-dark-background-color border border-border-color dark:border-dark-border-color rounded-lg hover:bg-gray-100 dark:hover:bg-dark-border-color text-text-color dark:text-dark-text-color">
                    <IconPlus />
                  </button>
                </div>
              </div>

              {/* Input de Horas com botões +/- */}
              <div>
                <label htmlFor="hours-goal" className="block text-sm font-medium text-text-color dark:text-dark-text-color mb-2">
                  Meta de Horas (por dia)
                </label>
                <div className="flex items-center gap-2">
                  <button type="button" onClick={() => handleHoursChange(-0.5)} className="p-3 bg-background-color dark:bg-dark-background-color border border-border-color dark:border-dark-border-color rounded-lg hover:bg-gray-100 dark:hover:bg-dark-border-color text-text-color dark:text-dark-text-color">
                    <IconMinus />
                  </button>
                  <div className="relative flex-1">
                    <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                      <IconClock />
                    </div>
                    <input
                      id="hours-goal"
                      type="number" step="0.5" min="0"
                      value={hoursGoal}
                      onChange={(e) => setHoursGoal(e.target.value)}
                      className="w-full p-3 pl-10 rounded-lg bg-background-color dark:bg-dark-background-color border border-border-color dark:border-dark-border-color focus:outline-none focus:ring-2 focus:ring-primary-color"
                    />
                  </div>
                   <button type="button" onClick={() => handleHoursChange(0.5)} className="p-3 bg-background-color dark:bg-dark-background-color border border-border-color dark:border-dark-border-color rounded-lg hover:bg-gray-100 dark:hover:bg-dark-border-color text-text-color dark:text-dark-text-color">
                    <IconPlus />
                  </button>
                </div>
              </div>

              {/* Botão Salvar com estado de loading */}
              <button
                type="submit"
                disabled={isLoading}
                className="w-full flex items-center justify-center gap-2 px-5 py-3 bg-primary-color text-white rounded-lg font-semibold shadow-lg hover:brightness-110 transition-all
                           disabled:opacity-70 disabled:cursor-not-allowed"
              >
                {isLoading ? (
                  <>
                    <IconLoader />
                    Salvando...
                  </>
                ) : (
                  <>
                    <IconCheck />
                    Salvar e Ativar Nova Meta
                  </>
                )}
              </button>
            </form>
          </div>
        </div>

        {/* Coluna da Direita (Histórico) */}
        <div className="lg:col-span-1">
           <div className="bg-card-background-color dark:bg-dark-card-background-color rounded-xl shadow-card-shadow p-6 border border-border-color dark:border-dark-border-color">
            <h2 className="text-xl font-semibold text-heading-color dark:text-dark-heading-color mb-4">
              Histórico de Metas
            </h2>
            <div className="space-y-3 max-h-[500px] overflow-y-auto pr-2">
              {goalsHistory && goalsHistory.length > 0 ? (
                goalsHistory.map((goal, index) => {
                  const isActive = index === 0;
                  const date = new Date(goal.startDate?.includes('-') ? goal.startDate + 'T03:00:00' : (goal.timestamp?.toDate() || goal.startDate));

                  return (
                    <div
                      key={goal.id}
                      className={`p-4 bg-background-color dark:bg-dark-background-color rounded-lg border-2
                                 ${isActive ? 'border-primary-color' : 'border-border-color dark:border-dark-border-color'}`}
                    >
                      <div className="flex justify-between items-center mb-2">
                        <p className={`text-sm font-semibold ${isActive ? 'text-primary-color' : 'text-heading-color dark:text-dark-heading-color'}`}>
                          Iniciada em: {date.toLocaleDateString('pt-BR')}
                        </p>
                        {isActive && (
                          <span className="text-xs font-bold bg-primary-color/20 text-primary-color py-0.5 px-2 rounded-full">
                            ATIVA
                          </span>
                        )}
                      </div>
                      <div className="flex justify-between items-center text-sm gap-4">
                        <span className="flex items-center gap-1.5 text-subtle-text-color dark:text-dark-subtle-text-color">
                          <IconTarget />
                          <span className="font-medium text-text-color dark:text-dark-text-color">{goal.questions || 0}</span>
                          qst
                        </span>
                        <span className="flex items-center gap-1.5 text-subtle-text-color dark:text-dark-subtle-text-color">
                          <IconClock />
                          <span className="font-medium text-text-color dark:text-dark-text-color">{goal.hours || 0}</span>
                          h
                        </span>
                      </div>
                    </div>
                  );
                })
              ) : (
                <p className="text-subtle-text-color dark:text-dark-subtle-text-color text-sm text-center py-10">
                  Nenhuma meta definida ainda.
                </p>
              )}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}

export default GoalsTab;