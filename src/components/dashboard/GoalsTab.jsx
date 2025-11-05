import React, { useState, useEffect } from 'react';

const IconTarget = () => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 text-zinc-500 dark:text-zinc-400">
    <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 6h9.75M10.5 6a1.5 1.5 0 1 1-3 0m3 0a1.5 1.5 0 1 0-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m-9.75 0h3.75" />
  </svg>
);
const IconClock = () => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 text-zinc-500 dark:text-zinc-400">
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
  </svg>
);
const IconCheck = () => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
    <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
  </svg>
);
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

function GoalsTab({ onSetGoal, goalsHistory }) {
  const currentGoal = goalsHistory && goalsHistory[0];
  const [questionsGoal, setQuestionsGoal] = useState(0);
  const [hoursGoal, setHoursGoal] = useState(0);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (currentGoal) {
      setQuestionsGoal(currentGoal.questions || 0);
      setHoursGoal(currentGoal.hours || 0);
    }
  }, [currentGoal]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      await onSetGoal({
        questions: parseInt(questionsGoal, 10),
        hours: parseFloat(hoursGoal)
      });
    } catch (error) {
      console.error("Erro ao salvar meta:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleQuestionsChange = (amount) => {
    setQuestionsGoal(q => Math.max(0, (parseInt(q, 10) || 0) + amount));
  };
  const handleHoursChange = (amount) => {
    setHoursGoal(h => Math.max(0, (parseFloat(h) || 0) + amount));
  };

  return (
    <div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        <div className="lg:col-span-2 space-y-4">

          <div className="bg-zinc-200 dark:bg-zinc-800 rounded-xl shadow-sm p-5 flex items-center gap-5 border border-zinc-300 dark:border-zinc-700 transition-all duration-300 hover:shadow-md">
            <div className="flex-shrink-0 bg-yellow-100 dark:bg-yellow-900 p-3 rounded-full">
              <IconTrophy />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-zinc-800 dark:text-white mb-1">
                Ajuste seu Foco
              </h2>
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                Definir metas diárias é o primeiro passo para criar constância.
                Sua meta atual é usada para medir seu progresso no calendário.
              </p>
            </div>
          </div>

          <div className="bg-zinc-200 dark:bg-zinc-800 rounded-xl shadow-sm p-5 border border-zinc-300 dark:border-zinc-700 transition-all duration-300 hover:shadow-md">
            <div className="space-y-5">

              <div>
                <label htmlFor="questions-goal" className="block text-sm font-medium text-zinc-800 dark:text-white mb-2">
                  Meta de Questões (por dia)
                </label>
                <div className="flex items-center gap-2">
                  <button type="button" onClick={() => handleQuestionsChange(-10)} className="p-2.5 bg-zinc-300 dark:bg-zinc-700 border border-zinc-400 dark:border-zinc-600 rounded-lg hover:bg-zinc-400 dark:hover:bg-zinc-600 text-zinc-800 dark:text-white transition-all">
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
                      className="w-full p-2.5 pl-10 rounded-lg bg-zinc-100 dark:bg-zinc-900 border border-zinc-400 dark:border-zinc-600 focus:outline-none focus:ring-2 focus:ring-neutral-500 text-zinc-800 dark:text-white transition-all"
                    />
                  </div>
                  <button type="button" onClick={() => handleQuestionsChange(10)} className="p-2.5 bg-zinc-300 dark:bg-zinc-700 border border-zinc-400 dark:border-zinc-600 rounded-lg hover:bg-zinc-400 dark:hover:bg-zinc-600 text-zinc-800 dark:text-white transition-all">
                    <IconPlus />
                  </button>
                </div>
              </div>

              <div>
                <label htmlFor="hours-goal" className="block text-sm font-medium text-zinc-800 dark:text-white mb-2">
                  Meta de Horas (por dia)
                </label>
                <div className="flex items-center gap-2">
                  <button type="button" onClick={() => handleHoursChange(-0.5)} className="p-2.5 bg-zinc-300 dark:bg-zinc-700 border border-zinc-400 dark:border-zinc-600 rounded-lg hover:bg-zinc-400 dark:hover:bg-zinc-600 text-zinc-800 dark:text-white transition-all">
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
                      className="w-full p-2.5 pl-10 rounded-lg bg-zinc-100 dark:bg-zinc-900 border border-zinc-400 dark:border-zinc-600 focus:outline-none focus:ring-2 focus:ring-neutral-500 text-zinc-800 dark:text-white transition-all"
                    />
                  </div>
                   <button type="button" onClick={() => handleHoursChange(0.5)} className="p-2.5 bg-zinc-300 dark:bg-zinc-700 border border-zinc-400 dark:border-zinc-600 rounded-lg hover:bg-zinc-400 dark:hover:bg-zinc-600 text-zinc-800 dark:text-white transition-all">
                    <IconPlus />
                  </button>
                </div>
              </div>

              <button
                onClick={handleSubmit}
                disabled={isLoading}
                className="w-full flex items-center justify-center gap-2 px-5 py-2.5 bg-neutral-500 text-white rounded-lg font-semibold shadow-sm hover:bg-neutral-600 transition-all disabled:opacity-70 disabled:cursor-not-allowed"
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
            </div>
          </div>
        </div>

        <div className="lg:col-span-1">
           <div className="bg-zinc-200 dark:bg-zinc-800 rounded-xl shadow-sm p-5 border border-zinc-300 dark:border-zinc-700 transition-all duration-300 hover:shadow-md">
            <h2 className="text-lg font-semibold text-zinc-800 dark:text-white mb-3">
              Histórico de Metas
            </h2>
            <div className="space-y-2.5 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
              {goalsHistory && goalsHistory.length > 0 ? (
                goalsHistory.map((goal, index) => {
                  const isActive = index === 0;
                  const date = new Date(goal.startDate?.includes('-') ? goal.startDate + 'T03:00:00' : (goal.timestamp?.toDate() || goal.startDate));

                  return (
                    <div
                      key={goal.id}
                      className={`p-3.5 bg-zinc-100 dark:bg-zinc-900 rounded-lg border-2 transition-all duration-200 ${isActive ? 'border-neutral-500' : 'border-zinc-300 dark:border-zinc-700'}`}
                    >
                      <div className="flex justify-between items-center mb-2">
                        <p className={`text-xs font-semibold ${isActive ? 'text-neutral-500' : 'text-zinc-800 dark:text-white'}`}>
                          Iniciada em: {date.toLocaleDateString('pt-BR')}
                        </p>
                        {isActive && (
                          <span className="text-xs font-bold bg-neutral-500/20 text-neutral-500 py-0.5 px-2 rounded-full">
                            ATIVA
                          </span>
                        )}
                      </div>
                      <div className="flex justify-between items-center text-xs gap-3">
                        <span className="flex items-center gap-1.5 text-zinc-600 dark:text-zinc-400">
                          <IconTarget />
                          <span className="font-medium text-zinc-800 dark:text-white">{goal.questions || 0}</span>
                          qst
                        </span>
                        <span className="flex items-center gap-1.5 text-zinc-600 dark:text-zinc-400">
                          <IconClock />
                          <span className="font-medium text-zinc-800 dark:text-white">{goal.hours || 0}</span>
                          h
                        </span>
                      </div>
                    </div>
                  );
                })
              ) : (
                <p className="text-zinc-600 dark:text-zinc-400 text-sm text-center py-10">
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