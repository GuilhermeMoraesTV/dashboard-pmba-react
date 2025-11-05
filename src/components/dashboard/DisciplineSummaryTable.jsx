import React, { useMemo } from 'react';

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
      <div className="bg-zinc-200 dark:bg-zinc-800 rounded-xl shadow-card-shadow p-4 md:p-6 col-span-1 lg:col-span-1 border border-zinc-300 dark:border-zinc-700">
        <h3 className="text-lg font-semibold text-zinc-800 dark:text-white mb-4">
          Resumo por Disciplina
        </h3>
        <p className="text-zinc-600 dark:text-zinc-400 text-center py-8">
          Nenhum registro de estudo encontrado para o ciclo ativo.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-zinc-200 dark:bg-zinc-800 rounded-xl shadow-card-shadow p-4 md:p-6 col-span-1 lg:col-span-1 border border-zinc-300 dark:border-zinc-700">
      <h3 className="text-lg font-semibold text-zinc-800 dark:text-white mb-4">
        Resumo por Disciplina
      </h3>
      <div className="max-h-80 overflow-y-auto">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-zinc-400 dark:border-zinc-600">
              <th className="py-2 text-sm font-semibold text-zinc-600 dark:text-zinc-400">Disciplina</th>
              <th className="py-2 text-sm font-semibold text-zinc-600 dark:text-zinc-400 text-right">Tempo</th>
              <th className="py-2 text-sm font-semibold text-zinc-600 dark:text-zinc-400 text-right">Desempenho</th>
            </tr>
          </thead>
          <tbody>
            {disciplineData.map((disciplina) => {
              const percentual = disciplina.questoes > 0
                ? (disciplina.acertos / disciplina.questoes) * 100
                : 0;

              return (
                <tr key={disciplina.nome} className="border-b border-zinc-400 dark:border-zinc-600 last:border-b-0">
                  <td className="py-3 text-sm font-medium text-zinc-800 dark:text-white truncate pr-2">{disciplina.nome}</td>
                  <td className="py-3 text-sm text-zinc-800 dark:text-white text-right font-medium">{formatTime(disciplina.tempo)}</td>
                  <td className="py-3 text-sm text-zinc-800 dark:text-white text-right font-medium">
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