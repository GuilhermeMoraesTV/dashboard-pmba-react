import React, { useMemo, useState } from 'react';
import { Trophy, AlertTriangle, BarChart2, ArrowUpRight, ArrowDownRight, Minus } from 'lucide-react';

const formatTime = (minutes) => {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}h ${m}m`;
};

function DisciplineSummaryTable({ registrosEstudo }) {
  const [rankingMode, setRankingMode] = useState('time');

  const { topDisciplines, lowDisciplines, hasData } = useMemo(() => {
    const disciplinas = {};

    registrosEstudo.forEach(item => {
      const disciplinaKey = item.disciplinaId || 'desconhecida';
      if (!disciplinas[disciplinaKey]) {
        disciplinas[disciplinaKey] = {
          nome: item.disciplinaNome || 'Disciplina sem nome',
          tempo: 0,
          questoes: 0,
          acertos: 0,
        };
      }
      const minutos = item.tempoEstudadoMinutos || item.duracaoMinutos || 0;
      const questoes = item.questoesFeitas || 0;
      const acertos = item.acertos || item.questoesAcertadas || 0;

      if (minutos > 0) disciplinas[disciplinaKey].tempo += minutos;
      if (questoes > 0) {
        disciplinas[disciplinaKey].questoes += questoes;
        disciplinas[disciplinaKey].acertos += acertos;
      }
    });

    let data = Object.values(disciplinas).filter(d => d.tempo > 0 || d.questoes > 0);
    const hasData = data.length > 0;

    // Ordenação
    if (rankingMode === 'time') {
        data.sort((a, b) => b.tempo - a.tempo);
    } else {
        data.sort((a, b) => {
            const percA = a.questoes > 0 ? (a.acertos / a.questoes) : -1;
            const percB = b.questoes > 0 ? (b.acertos / b.questoes) : -1;
            return percB - percA;
        });
    }

    // --- AQUI ESTÁ A MUDANÇA PRINCIPAL ---
    // Limitamos estritamente a 4 itens
    const top = data.slice(0, 4);

    let low = [];
    if (data.length > 4) {
        // Pega os últimos 4, invertendo para mostrar do pior para o "menos pior"
        low = [...data].reverse().slice(0, 4);
    } else if (data.length > 0 && data.length <= 4) {
        // Se tiver 4 ou menos, não faz sentido mostrar "Atenção" duplicado do "Top"
        // Ou podemos deixar vazio, ou mostrar mensagem
        low = [];
    }

    return { topDisciplines: top, lowDisciplines: low, hasData };
  }, [registrosEstudo, rankingMode]);

  const DisciplineRow = ({ item, type, index }) => {
      const isTime = rankingMode === 'time';
      const value = isTime ? item.tempo : (item.questoes > 0 ? (item.acertos / item.questoes) * 100 : 0);
      const displayValue = isTime ? formatTime(item.tempo) : `${value.toFixed(0)}%`;

      const accentColor = type === 'top' ? 'text-emerald-500' : 'text-red-500';
      const iconBg = type === 'top' ? 'bg-emerald-500/10' : 'bg-red-500/10';

      return (
        <div className="flex items-center justify-between py-3 px-3 mx-1 mb-2 bg-white dark:bg-zinc-800/40 rounded-xl border border-zinc-100 dark:border-zinc-700/50 shadow-sm h-[70px]"> {/* Altura fixa para consistência */}
            <div className="flex items-center gap-3 overflow-hidden flex-1">
                {/* Ícone Indicador */}
                <div className={`flex-shrink-0 w-10 h-10 rounded-full ${iconBg} flex items-center justify-center`}>
                    {type === 'top'
                        ? <ArrowUpRight size={20} className={accentColor} />
                        : <ArrowDownRight size={20} className={accentColor} />
                    }
                </div>
                {/* Texto */}
                <div className="flex flex-col truncate pr-2 justify-center">
                    <span className="text-base font-bold text-zinc-800 dark:text-zinc-100 truncate leading-tight">
                        {item.nome}
                    </span>
                    <span className="text-xs text-zinc-400 font-medium mt-0.5">
                       #{index + 1} Geral
                    </span>
                </div>
            </div>
            {/* Valor */}
            <div className="flex flex-col items-end justify-center min-w-[70px]">
                <span className={`text-lg font-black ${accentColor} leading-none`}>
                    {displayValue}
                </span>
                <span className="text-[9px] uppercase font-bold text-zinc-400 tracking-wider mt-1">
                   {isTime ? 'HORAS' : 'PRECISÃO'}
                </span>
            </div>
        </div>
      );
  };

  return (
    <div className="h-full flex flex-col gap-4">

      {/* Header */}
      <div className="flex flex-row justify-between items-center gap-3 min-h-[40px] px-1">
        <h3 className="text-xs font-bold uppercase tracking-wider text-text-secondary dark:text-text-dark-secondary flex items-center gap-2">
            <BarChart2 size={18} className="text-indigo-500" />
            Ranking Tático
        </h3>

        <div className="flex bg-zinc-200 dark:bg-zinc-900 p-1 rounded-lg">
            <button
                onClick={() => setRankingMode('time')}
                className={`px-3 py-1.5 text-[10px] uppercase font-bold rounded-md transition-all ${rankingMode === 'time' ? 'bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-400'}`}
            >
                Horas
            </button>
            <button
                onClick={() => setRankingMode('performance')}
                className={`px-3 py-1.5 text-[10px] uppercase font-bold rounded-md transition-all ${rankingMode === 'performance' ? 'bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-400'}`}
            >
                Desempenho
            </button>
        </div>
      </div>

      {!hasData ? (
          <div className="dashboard-card p-6 flex flex-col items-center justify-center text-zinc-400 h-full">
             <BarChart2 size={48} className="mb-4 opacity-20" />
             <p className="text-base font-medium">Sem dados de missão neste ciclo.</p>
          </div>
      ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 h-full flex-1 min-h-0">

            {/* Card Destaques (Top 4) */}
            <div className="dashboard-card p-0 flex flex-col h-full overflow-hidden border-t-4 border-t-emerald-500 border-l-0 border-r-0 border-b-0">
                <div className="pt-4 px-4 pb-2 bg-gradient-to-b from-emerald-500/5 to-transparent flex-shrink-0">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <Trophy size={18} className="text-emerald-500" />
                            <h4 className="text-sm font-bold text-zinc-800 dark:text-white uppercase tracking-wide">Melhores Disciplinas</h4>
                        </div>

                    </div>
                </div>

                <div className="flex-1 p-2 flex flex-col justify-start gap-1 overflow-hidden"> {/* Sem scroll se couber, ou overflow hidden */}
                    {topDisciplines.map((item, idx) => (
                        <DisciplineRow key={`top-${idx}`} item={item} type="top" index={idx} />
                    ))}
                    {/* Se tiver menos de 4, preenche com espaço vazio para alinhar (opcional) */}
                    {Array.from({ length: Math.max(0, 4 - topDisciplines.length) }).map((_, idx) => (
                        <div key={`empty-top-${idx}`} className="flex-1 min-h-[60px]"></div>
                    ))}
                </div>
            </div>

            {/* Card Atenção (Bottom 4) */}
            <div className="dashboard-card p-0 flex flex-col h-full overflow-hidden border-t-4 border-t-red-500 border-l-0 border-r-0 border-b-0">
                 <div className="pt-4 px-4 pb-2 bg-gradient-to-b from-red-500/5 to-transparent flex-shrink-0">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <AlertTriangle size={18} className="text-red-500" />
                            <h4 className="text-sm font-bold text-zinc-800 dark:text-white uppercase tracking-wide">Piores Disciplinas</h4>
                        </div>
                        <span className="text-[13px] font-bold text-red-600 bg-red-100 dark:bg-red-500/20 dark:text-red-400 px-4 py-0.5 rounded">Revisar</span>
                    </div>
                </div>

                <div className="flex-1 p-2 flex flex-col justify-start gap-1 overflow-hidden">
                    {lowDisciplines.length > 0 ? (
                        lowDisciplines.map((item, idx) => (
                            <DisciplineRow key={`low-${idx}`} item={item} type="low" index={topDisciplines.length - 1 - idx} /> // Index fictício apenas para ilustrar
                        ))
                    ) : (
                        <div className="h-full flex flex-col items-center justify-center text-zinc-500 gap-2 opacity-50">
                            <Minus size={24} />
                            <span className="text-xs">Sem pontos críticos ainda</span>
                        </div>
                    )}
                     {/* Preenchimento visual se tiver menos de 4 */}
                     {lowDisciplines.length > 0 && Array.from({ length: Math.max(0, 4 - lowDisciplines.length) }).map((_, idx) => (
                        <div key={`empty-low-${idx}`} className="flex-1 min-h-[60px]"></div>
                    ))}
                </div>
            </div>

          </div>
      )}
    </div>
  );
}

export default DisciplineSummaryTable;