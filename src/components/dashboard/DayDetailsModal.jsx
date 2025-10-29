import React, { useMemo } from 'react';

const formatTime = (minutes) => {
  if (!minutes || minutes === 0) return '0m';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h > 0) {
    return `${h}h ${m}m`;
  }
  return `${m}m`;
};

function DayDetailsModal({ date, dayData, onClose, onDeleteRegistro }) {

  const formattedDate = useMemo(() => {
    const [year, month, day] = date.split('-').map(Number);
    const dateObj = new Date(year, month - 1, day);
    return dateObj.toLocaleDateString('pt-BR', {
      day: 'numeric',
      month: 'long',
      timeZone: 'UTC',
    });
  }, [date]);

  const { totalHorasStr, totalQuestoes, totalAcertos, totalPercentual } = useMemo(() => {
    const totalMinutos = dayData.dayHours.reduce((acc, r) => {
      return acc + Number(r.tempoEstudadoMinutos || 0);
    }, 0);

    const totalQuestoes = dayData.dayQuestions.reduce((acc, r) => {
      return acc + Number(r.questoesFeitas || 0);
    }, 0);

    const totalAcertos = dayData.dayQuestions.reduce((acc, r) => {
      return acc + Number(r.acertos || 0);
    }, 0);

    const totalPercentual = totalQuestoes > 0 ? (totalAcertos / totalQuestoes) * 100 : 0;

    return {
      totalHorasStr: formatTime(totalMinutos),
      totalQuestoes,
      totalAcertos,
      totalPercentual,
    };
  }, [dayData]);

  return (
    <div
      className="fixed inset-0 bg-black/60 z-40 flex justify-center items-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-card-background-color dark:bg-dark-card-background-color p-6 rounded-lg shadow-xl z-50 w-full max-w-2xl mx-4 max-h-[80vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Cabeçalho */}
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold text-heading-color dark:text-dark-heading-color">
            Detalhes de {formattedDate}
          </h2>
          <button onClick={onClose} className="text-2xl text-subtle-text-color dark:text-dark-subtle-text-color">&times;</button>
        </div>

        {/* Resumo do Dia */}
        <div className="grid grid-cols-3 gap-4 mb-4 text-center">
          <div className="bg-background-color dark:bg-dark-background-color p-3 rounded-lg">
            <div className="text-xs text-subtle-text-color dark:text-dark-subtle-text-color uppercase font-semibold">Tempo</div>
            <div className="text-lg font-bold text-heading-color dark:text-dark-heading-color">{totalHorasStr}</div>
          </div>
          <div className="bg-background-color dark:bg-dark-background-color p-3 rounded-lg">
            <div className="text-xs text-subtle-text-color dark:text-dark-subtle-text-color uppercase font-semibold">Questões</div>
            <div className="text-lg font-bold text-heading-color dark:text-dark-heading-color">{totalQuestoes}</div>
          </div>
          <div className="bg-background-color dark:bg-dark-background-color p-3 rounded-lg">
            <div className="text-xs text-subtle-text-color dark:text-dark-subtle-text-color uppercase font-semibold">Desempenho</div>
            <div className="text-lg font-bold text-heading-color dark:text-dark-heading-color">{totalPercentual.toFixed(0)}%</div>
          </div>
        </div>

        {/* Lista de Registros */}
        <div className="overflow-y-auto space-y-3 pr-2">
          {/* Registros de Horas */}
          {dayData.dayHours.length > 0 && (
            <div>
              <h3 className="font-semibold text-text-color dark:text-dark-text-color mb-2">Registros de Tempo</h3>
              {dayData.dayHours.map(r => (
                <div key={r.id} className="flex justify-between items-center bg-background-color dark:bg-dark-background-color p-3 rounded-lg mb-2">
                  <div className="text-sm">
                    <span className="font-medium text-heading-color dark:text-dark-heading-color">{r.disciplinaNome || `ID: ${r.disciplinaId}`}</span>
                    <span className="text-subtle-text-color dark:text-dark-subtle-text-color"> ({r.tipoEstudo})</span>
                    {r.topicoNome && <span className="text-xs text-subtle-text-color dark:text-dark-subtle-text-color block">{r.topicoNome}</span>}
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-semibold text-text-color dark:text-dark-text-color">
                      {formatTime(Number(r.tempoEstudadoMinutos || 0))}
                    </span>
                    <button onClick={() => onDeleteRegistro(r.id)} className="text-red-500 text-xs hover:brightness-125">Excluir</button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Registros de Questões */}
          {dayData.dayQuestions.length > 0 && (
            <div>
              <h3 className="font-semibold text-text-color dark:text-dark-text-color mb-2">Registros de Questões</h3>
              {dayData.dayQuestions.map(r => {
                const questoes = Number(r.questoesFeitas || 0);
                const acertos = Number(r.acertos || 0);
                const percentual = questoes > 0 ? ((acertos / questoes) * 100).toFixed(0) : 0;

                return (
                  <div key={r.id} className="flex justify-between items-center bg-background-color dark:bg-dark-background-color p-3 rounded-lg mb-2">
                    <div className="text-sm">
                      <span className="font-medium text-heading-color dark:text-dark-heading-color">{r.disciplinaNome || `ID: ${r.disciplinaId}`}</span>
                      <span className="text-subtle-text-color dark:text-dark-subtle-text-color"> ({r.tipoEstudo})</span>
                      {r.topicoNome && <span className="text-xs text-subtle-text-color dark:text-dark-subtle-text-color block">{r.topicoNome}</span>}
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-semibold text-text-color dark:text-dark-text-color">
                        {acertos} / {questoes} ({percentual}%)
                      </span>
                      <button onClick={() => onDeleteRegistro(r.id)} className="text-red-500 text-xs hover:brightness-125">Excluir</button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default DayDetailsModal;