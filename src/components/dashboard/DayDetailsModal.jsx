import React, { useMemo } from 'react';

// --- Ícones ---

// Ícones de Estatística
const IconClock = () => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 text-primary-color">
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
  </svg>
);
const IconList = () => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 text-green-500">
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 21l-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
  </svg>
);
const IconTarget = () => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 text-yellow-500">
    <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 6h9.75M10.5 6a1.5 1.5 0 1 1-3 0m3 0a1.5 1.5 0 1 0-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m-9.75 0h3.75" />
  </svg>
);

// Ícones de Tipo de Estudo
const IconBook = () => ( // Teoria
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 flex-shrink-0">
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 0 0 6 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 0 1 6 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 0 1 6-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0 0 18 18c-2.305 0-4.408.867-6 2.292m0-14.25v14.25" />
  </svg>
);
const IconCheck = () => ( // Questões
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 flex-shrink-0">
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 21l-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
  </svg>
);
const IconRefresh = () => ( // Revisão
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 flex-shrink-0">
    <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" />
  </svg>
);

// --- Funções Helper ---
const formatTime = (minutes) => {
  if (!minutes || minutes === 0) return '0m';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h > 0) {
    return `${h}h ${m}m`;
  }
  return `${m}m`;
};

// Componente do Ícone de Tipo
const TipoEstudoIcon = ({ tipo }) => {
  if (tipo === 'Teoria') return <IconBook />;
  if (tipo === 'Questões') return <IconCheck />;
  if (tipo === 'Revisão') return <IconRefresh />;
  return null;
};

// --- Componente Principal ---
function DayDetailsModal({ date, dayData, onClose }) { // Remove 'onDeleteRegistro'

  const formattedDate = useMemo(() => {
    const [year, month, day] = date.split('-').map(Number);
    const dateObj = new Date(year, month - 1, day);
    return dateObj.toLocaleDateString('pt-BR', {
      day: 'numeric',
      month: 'long',
      timeZone: 'UTC', // Garante que a data não mude por fuso horário
    });
  }, [date]);

  const { totalHorasStr, totalQuestoes, totalAcertos, totalPercentual } = useMemo(() => {
    const totalMinutos = dayData.dayHours.reduce((acc, r) => {
      return acc + Number(r.tempoEstudadoMinutos || 0);
    }, 0);
    const { totalQuestoes, totalAcertos } = dayData.dayQuestions.reduce((acc, r) => {
      acc.totalQuestoes += Number(r.questoesFeitas || 0);
      acc.totalAcertos += Number(r.acertos || 0);
      return acc;
    }, { totalQuestoes: 0, totalAcertos: 0 });

    const totalPercentual = totalQuestoes > 0 ? (totalAcertos / totalQuestoes) * 100 : 0;

    return {
      totalHorasStr: formatTime(totalMinutos),
      totalQuestoes,
      totalAcertos,
      totalPercentual,
    };
  }, [dayData]);

  const todosRegistros = useMemo(() => {
    // Combina e remove duplicatas (um registro pode ter tempo E questões)
    const all = new Map();
    dayData.dayHours.forEach(r => all.set(r.id, r));
    dayData.dayQuestions.forEach(r => all.set(r.id, r));
    return Array.from(all.values()).sort((a, b) => (a.timestamp > b.timestamp ? 1 : -1));
  }, [dayData.dayHours, dayData.dayQuestions]);

  return (
    <div
      className="fixed inset-0 bg-black/60 z-40 flex justify-center items-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-card-background-color dark:bg-dark-card-background-color p-6 rounded-lg shadow-xl z-50 w-full max-w-lg mx-4 max-h-[85vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Cabeçalho */}
        <div className="flex justify-between items-center mb-5 pb-4 border-b border-border-color dark:border-dark-border-color">
          <h2 className="text-xl font-bold text-heading-color dark:text-dark-heading-color">
            Resumo de {formattedDate}
          </h2>
          <button onClick={onClose} className="text-3xl text-subtle-text-color dark:text-dark-subtle-text-color hover:text-danger-color">&times;</button>
        </div>

        {/* Resumo do Dia */}
        <div className="grid grid-cols-3 gap-3 mb-5">
          <div className="bg-background-color dark:bg-dark-background-color p-3 rounded-lg flex items-center gap-3">
            <IconClock />
            <div>
              <div className="text-xs text-subtle-text-color dark:text-dark-subtle-text-color uppercase font-semibold">Tempo</div>
              <div className="text-base font-bold text-heading-color dark:text-dark-heading-color">{totalHorasStr}</div>
            </div>
          </div>
          <div className="bg-background-color dark:bg-dark-background-color p-3 rounded-lg flex items-center gap-3">
            <IconList />
            <div>
              <div className="text-xs text-subtle-text-color dark:text-dark-subtle-text-color uppercase font-semibold">Questões</div>
              <div className="text-base font-bold text-heading-color dark:text-dark-heading-color">{totalQuestoes}</div>
            </div>
          </div>
          <div className="bg-background-color dark:bg-dark-background-color p-3 rounded-lg flex items-center gap-3">
            <IconTarget />
             <div>
              <div className="text-xs text-subtle-text-color dark:text-dark-subtle-text-color uppercase font-semibold">Desempenho</div>
              <div className="text-base font-bold text-heading-color dark:text-dark-heading-color">{totalPercentual.toFixed(0)}%</div>
            </div>
          </div>
        </div>

        {/* Lista de Registros */}
        <h3 className="font-semibold text-text-color dark:text-dark-text-color mb-3 text-lg">
          Registros do Dia
        </h3>
        <div className="overflow-y-auto space-y-3 pr-2 flex-1">
          {todosRegistros.length === 0 ? (
            <p className="text-subtle-text-color dark:text-dark-subtle-text-color text-center py-4">Nenhum registro encontrado.</p>
          ) : (
            todosRegistros.map(r => {
              const minutos = Number(r.tempoEstudadoMinutos || 0);
              const questoes = Number(r.questoesFeitas || 0);
              const acertos = Number(r.acertos || 0);
              const percentual = questoes > 0 ? ((acertos / questoes) * 100).toFixed(0) : 0;

              return (
                <div key={r.id} className="flex items-center gap-4 bg-background-color dark:bg-dark-background-color p-3 rounded-lg border border-border-color dark:border-dark-border-color">
                  <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center text-subtle-text-color dark:text-dark-subtle-text-color
                    ${r.tipoEstudo === 'Teoria' ? 'bg-blue-100 dark:bg-blue-900' : ''}
                    ${r.tipoEstudo === 'Questões' ? 'bg-green-100 dark:bg-green-900' : ''}
                    ${r.tipoEstudo === 'Revisão' ? 'bg-yellow-100 dark:bg-yellow-900' : ''}
                  `}>
                    <TipoEstudoIcon tipo={r.tipoEstudo} />
                  </div>

                  <div className="flex-1 text-sm">
                    <span className="font-semibold text-heading-color dark:text-dark-heading-color">{r.disciplinaNome || 'Disciplina'}</span>
                    <span className="text-subtle-text-color dark:text-dark-subtle-text-color"> ({r.tipoEstudo})</span>
                    {r.topicoNome && <span className="text-xs text-subtle-text-color dark:text-dark-subtle-text-color block truncate">{r.topicoNome}</span>}
                  </div>

                  <div className="flex-shrink-0 text-right text-sm">
                    {minutos > 0 && (
                      <div className="font-semibold text-text-color dark:text-dark-text-color">
                        {formatTime(minutos)}
                      </div>
                    )}
                    {questoes > 0 && (
                       <div className="font-semibold text-text-color dark:text-dark-text-color">
                        {acertos} / {questoes}
                        <span className="text-subtle-text-color dark:text-dark-subtle-text-color"> ({percentual}%)</span>
                      </div>
                    )}
                  </div>

                  {/* Botão Excluir REMOVIDO */}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

export default DayDetailsModal;