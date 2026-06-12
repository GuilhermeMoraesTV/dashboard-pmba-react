import React, { useMemo, useState } from 'react';
import { Target } from 'lucide-react';

import CicloVisual from '../../CicloVisual';

const formatarHoras = (horasDecimais) => {
  if (!horasDecimais || isNaN(horasDecimais)) return '0h';
  const totalMinutos = Math.round(horasDecimais * 60);
  const horas = Math.floor(totalMinutos / 60);
  const minutos = totalMinutos % 60;
  if (horas > 0 && minutos > 0) return `${horas}h ${minutos}m`;
  if (horas > 0) return `${horas}h`;
  return `${minutos}m`;
};

const EditalSidebarCard = ({ editalSelecionado, nomeCiclo }) => (
  <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-4 sm:p-5 flex flex-col sm:flex-row items-center sm:items-start gap-4 text-center sm:text-left relative overflow-hidden shadow-[0_8px_30px_rgba(239,68,68,0.15)] dark:shadow-[0_8px_30px_rgba(239,68,68,0.08)] min-h-[140px]">
    <div className="absolute top-0 inset-x-0 h-20 bg-gradient-to-b from-red-50 dark:from-red-900/10 to-transparent pointer-events-none" />
    <span className="absolute top-4 left-4 z-10 inline-block px-2.5 py-1 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 text-[9px] font-black uppercase tracking-widest rounded-lg">
      {editalSelecionado ? 'Edital Alvo' : 'Ciclo Manual'}
    </span>
    <div className="relative z-10 w-20 h-20 sm:w-24 sm:h-24 shrink-0 rounded-2xl bg-white dark:bg-zinc-800 border-2 border-red-100 dark:border-red-900/30 flex items-center justify-center p-3 mt-5 sm:mt-6 shadow-lg shadow-red-500/20">
      {editalSelecionado?.logo || editalSelecionado?.logoUrl ? (
        <img src={editalSelecionado.logo || editalSelecionado.logoUrl} alt="Logo Edital" className="w-full h-full object-contain" />
      ) : <Target size={36} className="text-red-500" />}
    </div>
    <div className="relative z-10 w-full pt-2 sm:pt-8">
      <h3 className="text-sm sm:text-base font-black text-zinc-900 dark:text-white uppercase leading-tight line-clamp-2">
        {nomeCiclo || editalSelecionado?.titulo || editalSelecionado?.nome || 'Novo Ciclo'}
      </h3>
      {(editalSelecionado?.cargo || editalSelecionado?.titulo || editalSelecionado?.nome) && (
        <p className="text-[11px] sm:text-xs font-bold text-zinc-500 dark:text-zinc-400 mt-1.5 line-clamp-2">
          {editalSelecionado?.cargo || 'Preview da distribuicao final do ciclo'}
        </p>
      )}
    </div>
  </div>
);

export default function StepPreview({
  editalSelecionado,
  nomeCiclo,
  horasTotais,
  tempoSessaoMinutos,
  modoExibirAssuntos = true,
  disciplinasPreview,
  cicloPreview,
}) {
  const [selectedDisciplinaId, setSelectedDisciplinaId] = useState(null);

  const cicloInterativo = useMemo(() => ({
    ...(cicloPreview || {}),
    sessoesConcluidas: [],
  }), [cicloPreview]);

  const totalSessoesPreview = useMemo(
    () => disciplinasPreview.reduce((total, disciplina) => total + (disciplina.sessoesPorCiclo || 0), 0),
    [disciplinasPreview]
  );

  return (
    <div className="flex flex-col h-full overflow-hidden w-full">
      <div className="text-center mb-6 md:mb-8 px-3 sm:px-6 lg:px-8">
        <h2 className="text-3xl sm:text-4xl font-black text-zinc-900 dark:text-white uppercase tracking-tight leading-none mb-3">
          Veja como seu<br />
          <span className="text-red-600">ciclo vai ficar</span>
        </h2>
        <p className="text-zinc-500 dark:text-zinc-400 text-sm font-medium leading-relaxed max-w-2xl mx-auto">
          Esta previa usa a mesma distribuicao real de sessoes do ciclo final. Voce pode alternar a visualizacao, focar por disciplina e conferir a divisao antes de criar.
        </p>
      </div>

      <div className="w-full px-2 sm:px-4 lg:px-8 overflow-y-auto custom-scrollbar pb-10">
        <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_340px] gap-4 md:gap-5 items-start">
          <div className="rounded-[28px] border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/70 shadow-sm p-2 sm:p-4 lg:p-6 min-h-[520px] sm:min-h-[640px]">
            <CicloVisual
              selectedDisciplinaId={selectedDisciplinaId}
              onSelectDisciplina={setSelectedDisciplinaId}
              onViewDetails={() => {}}
              onStartStudy={() => {}}
              disciplinas={disciplinasPreview}
              registrosEstudo={[]}
              viewMode="semana"
              ciclo={cicloInterativo}
              isLoading={false}
              canConcludeCiclo={false}
              onMarcarSessao={() => {}}
              onConcluirCiclo={() => {}}
              cicloActionLoading={false}
              showAssuntos={modoExibirAssuntos !== false}
              hideActionButtons
            />
          </div>

          <div className="space-y-4">
            <EditalSidebarCard editalSelecionado={editalSelecionado} nomeCiclo={nomeCiclo} />

            <div className="rounded-3xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 shadow-sm xl:max-h-[476px]">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between mb-3">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Distribuicao prevista</p>
                  <p className="text-[11px] font-bold text-zinc-500 dark:text-zinc-400 mt-1">
                    {disciplinasPreview.length} disciplinas em {totalSessoesPreview} sessoes por volta
                  </p>
                </div>
                <span className="w-fit rounded-full bg-red-50 dark:bg-red-950/30 px-2.5 py-1 text-[10px] font-black uppercase tracking-wide text-red-600 dark:text-red-400">
                  apoio visual
                </span>
              </div>
              <div className="grid max-h-[292px] grid-cols-1 gap-2 overflow-y-auto pr-1 custom-scrollbar sm:grid-cols-2 xl:max-h-[390px] xl:grid-cols-1">
                {disciplinasPreview.map((disciplina) => (
                  <div key={disciplina.id} className="rounded-xl bg-zinc-50 dark:bg-zinc-800/60 px-3 py-2 border border-zinc-100 dark:border-zinc-800">
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-[13px] font-black text-zinc-900 dark:text-white leading-tight line-clamp-1">{disciplina.nome}</p>
                        <p className="text-[10px] text-zinc-500 mt-0.5 capitalize line-clamp-1">{disciplina.nivelDominio || 'nivel nao definido'}</p>
                      </div>
                      <span className="rounded-full bg-white dark:bg-zinc-900 px-2 py-1 text-[10px] font-black uppercase tracking-wide text-red-600 whitespace-nowrap border border-zinc-100 dark:border-zinc-800">
                        {disciplina.sessoesPorCiclo}x
                      </span>
                    </div>
                    <div className="mt-1.5 text-[10px] font-semibold text-zinc-500">
                      {formatarHoras((disciplina.tempoAlocadoMinutos || 0) / 60)} por volta
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
