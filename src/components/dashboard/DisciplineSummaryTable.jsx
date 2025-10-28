import React, { useMemo } from 'react';

// Função para formatar o tempo (sem alteração)
const formatTime = (minutes) => {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}h ${m}m`;
};

function DisciplineSummaryTable({ registrosEstudo }) {
  const disciplineData = useMemo(() => {
    const disciplinas = {};

    registrosEstudo.forEach(item => {
      const disciplinaKey = item.disciplinaId || 'desconhecida';

      if (!disciplinas[disciplinaKey]) {
        disciplinas[disciplinaKey] = {
          nome: item.disciplinaNome || `ID: ${disciplinaKey}`,
          tempo: 0,
          questoes: 0,
          acertos: 0,
        };
      }

      // NORMALIZAÇÃO
      const minutos = item.tempoEstudadoMinutos || item.duracaoMinutos || 0;
      const questoes = item.questoesFeitas || 0;
      const acertos = item.acertos || item.questoesAcertadas || 0;

      if (minutos > 0) {
        disciplinas[disciplinaKey].tempo += minutos;
      }

      if (questoes > 0) {
        disciplinas[disciplinaKey].questoes += questoes;
        disciplinas[disciplinaKey].acertos += acertos;
      }
    });

    return Object.values(disciplinas)
      .filter(d => d.tempo > 0 || d.questoes > 0)
      .sort((a, b) => b.tempo - a.tempo);
  }, [registrosEstudo]);

  if (disciplineData.length === 0) {
    return (
      <div className="bg-card-background-color dark:bg-dark-card-background-color rounded-xl shadow-card-shadow p-4 md:p-6 col-span-1 lg:col-span-1">
        <h3 className="text-lg font-semibold text-heading-color dark:text-dark-heading-color mb-4">
          Resumo por Disciplina
        </h3>
        <p className="text-subtle-text-color dark:text-dark-subtle-text-color text-center py-8">
          Nenhum registro de estudo encontrado para o ciclo ativo.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-card-background-color dark:bg-dark-card-background-color rounded-xl shadow-card-shadow p-4 md:p-6 col-span-1 lg:col-span-1">
      <h3 className="text-lg font-semibold text-heading-color dark:text-dark-heading-color mb-4">
        Resumo por Disciplina
      </h3>
      <div className="max-h-80 overflow-y-auto">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-border-color dark:border-dark-border-color">
              <th className="py-2 text-sm font-semibold text-subtle-text-color dark:text-dark-subtle-text-color">Disciplina</th>
              <th className="py-2 text-sm font-semibold text-subtle-text-color dark:text-dark-subtle-text-color text-right">Tempo</th>
              <th className="py-2 text-sm font-semibold text-subtle-text-color dark:text-dark-subtle-text-color text-right">Desempenho</th>
            </tr>
          </thead>
          <tbody>
            {disciplineData.map((disciplina) => {
              const percentual = disciplina.questoes > 0
                ? (disciplina.acertos / disciplina.questoes) * 100
                : 0;

              return (
                <tr key={disciplina.nome} className="border-b border-border-color dark:border-dark-border-color last:border-b-0">
                  <td className="py-3 text-sm font-medium text-text-color dark:text-dark-text-color truncate pr-2">{disciplina.nome}</td>
                  <td className="py-3 text-sm text-text-color dark:text-dark-text-color text-right font-medium">{formatTime(disciplina.tempo)}</td>
                  <td className="py-3 text-sm text-text-color dark:text-dark-text-color text-right font-medium">
                    {disciplina.questoes > 0 ? `${percentual.toFixed(0)}%` : '--'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default DisciplineSummaryTable;