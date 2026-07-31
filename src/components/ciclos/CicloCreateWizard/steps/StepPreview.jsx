import React, { useMemo, useState } from 'react';
import { CalendarCheck2, Clock3, Layers3, Target } from 'lucide-react';

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
  <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl sm:rounded-3xl p-2.5 sm:p-5 flex items-center sm:items-start gap-2 sm:gap-4 text-left relative overflow-hidden shadow-[0_8px_30px_rgba(239,68,68,0.15)] dark:shadow-[0_8px_30px_rgba(239,68,68,0.08)] min-h-0 sm:min-h-[140px]">
    <div className="absolute top-0 inset-x-0 h-20 bg-gradient-to-b from-red-50 dark:from-red-900/10 to-transparent pointer-events-none" />
    <span className="absolute top-2 left-2 sm:top-4 sm:left-4 z-10 inline-block px-2 py-0.5 sm:px-2.5 sm:py-1 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 text-[8px] sm:text-[9px] font-black uppercase tracking-widest rounded-lg">
      {editalSelecionado ? 'Edital Alvo' : 'Ciclo Manual'}
    </span>
    <div className="relative z-10 mt-5 flex h-14 w-14 shrink-0 items-center justify-center rounded-xl border-2 border-red-100 bg-white p-1 shadow-lg shadow-red-500/20 dark:border-red-900/30 dark:bg-zinc-800 sm:mt-6 sm:h-28 sm:w-28 sm:rounded-2xl sm:p-2">
      {editalSelecionado?.logo || editalSelecionado?.logoUrl ? (
        <img src={editalSelecionado.logo || editalSelecionado.logoUrl} alt="Logo Edital" className="w-full h-full object-contain" />
      ) : <Target size={36} className="text-red-500" />}
    </div>
    <div className="relative z-10 min-w-0 flex-1 pt-5 sm:w-full sm:pt-8">
      <h3 className="text-[10px] font-black uppercase leading-tight text-zinc-900 line-clamp-3 dark:text-white sm:text-base sm:line-clamp-2">
        {nomeCiclo || editalSelecionado?.titulo || editalSelecionado?.nome || 'Novo Ciclo'}
      </h3>
      {(editalSelecionado?.cargo || editalSelecionado?.titulo || editalSelecionado?.nome) && (
        <p className="hidden sm:block text-xs font-bold text-zinc-500 dark:text-zinc-400 mt-1.5 line-clamp-2">
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
  coresDisciplinasAtivas = true,
  disciplinasPreview,
  cicloPreview,
}) {
  const [selectedDisciplinaId, setSelectedDisciplinaId] = useState(null);

  const cicloInterativo = useMemo(() => ({
    ...(cicloPreview || {}),
    coresDisciplinasAtivas: coresDisciplinasAtivas !== false,
    sessoesConcluidas: [],
  }), [cicloPreview, coresDisciplinasAtivas]);

  const totalSessoesPreview = useMemo(
    () => disciplinasPreview.reduce((total, disciplina) => total + (disciplina.sessoesPorCiclo || 0), 0),
    [disciplinasPreview]
  );
  const totalPlanejadoMinutos = totalSessoesPreview * tempoSessaoMinutos;
  const totalDisponivelMinutos = Math.round(horasTotais * 60);
  const minutosLivres = Math.max(0, totalDisponivelMinutos - totalPlanejadoMinutos);
  const maxSessoesDisciplina = Math.max(
    1,
    ...disciplinasPreview.map((disciplina) => Number(disciplina.sessoesPorCiclo) || 0)
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
        <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_320px] gap-4 md:gap-5 items-start">
          <div className="order-2 xl:order-1 h-[520px] sm:h-auto rounded-[24px] border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/70 shadow-sm p-1.5 sm:p-3 lg:p-4 sm:min-h-[740px] xl:min-h-[780px]">
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

          <div className="order-1 grid grid-cols-[minmax(0,0.78fr)_minmax(0,1.22fr)] items-start gap-2 sm:grid-cols-2 sm:gap-4 xl:order-2 xl:block xl:space-y-4">
            <EditalSidebarCard editalSelecionado={editalSelecionado} nomeCiclo={nomeCiclo} />

            <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900 sm:rounded-3xl xl:max-h-[560px]">
              <div className="bg-gradient-to-br from-zinc-950 via-zinc-900 to-red-950 p-2.5 text-white sm:p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[8px] sm:text-[10px] font-black uppercase tracking-[0.18em] text-red-300">Distribuicao prevista</p>
                    <p className="mt-1 text-xl font-black sm:text-2xl">{formatarHoras(totalPlanejadoMinutos / 60)}</p>
                    <p className="text-[9px] font-bold text-zinc-400">{totalSessoesPreview} blocos de {tempoSessaoMinutos} min</p>
                  </div>
                  <div className="hidden h-14 w-14 place-items-center rounded-2xl border border-white/10 bg-white/10 shadow-inner sm:grid">
                    <Layers3 size={22} className="text-red-400" />
                  </div>
                </div>

                <div className="mt-2 grid grid-cols-2 gap-1.5 sm:mt-3 sm:gap-2">
                  <div className="rounded-xl border border-white/10 bg-white/5 px-2 py-1.5 sm:px-2.5 sm:py-2">
                    <p className="flex items-center gap-1 text-[7px] font-black uppercase tracking-widest text-zinc-400"><Clock3 size={9} /> Disponivel</p>
                    <p className="mt-1 text-xs font-black">{formatarHoras(horasTotais)}</p>
                  </div>
                  <div className="rounded-xl border border-white/10 bg-white/5 px-2 py-1.5 sm:px-2.5 sm:py-2">
                    <p className="text-[7px] font-black uppercase tracking-widest text-zinc-400">Fora dos blocos</p>
                    <p className="mt-1 text-xs font-black">{formatarHoras(minutosLivres / 60)}</p>
                  </div>
                </div>
              </div>

              <div className="p-2.5 sm:p-4">
              <div className="mb-2 flex flex-col gap-1 sm:mb-3 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="text-[8px] sm:text-[10px] font-black uppercase tracking-widest text-zinc-400">Peso por dificuldade</p>
                  <p className="text-[10px] sm:text-[11px] font-bold text-zinc-500 dark:text-zinc-400 mt-1">
                    Mais dificuldade recebe mais blocos no radar.
                  </p>
                </div>
              </div>
              <div className="grid max-h-[176px] grid-cols-1 gap-1.5 overflow-y-auto pr-1 custom-scrollbar sm:max-h-[238px] sm:grid-cols-2 sm:gap-2 xl:max-h-[340px] xl:grid-cols-1">
                {disciplinasPreview.map((disciplina) => (
                  <div key={disciplina.id} className="rounded-lg sm:rounded-xl bg-zinc-50 dark:bg-zinc-800/60 px-2 py-1.5 sm:px-3 sm:py-2 border border-zinc-100 dark:border-zinc-800">
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-[9px] sm:text-[13px] font-black text-zinc-900 dark:text-white leading-tight line-clamp-1">{disciplina.nome}</p>
                        <p className="hidden sm:flex items-center gap-1 text-[10px] text-zinc-500 mt-0.5 capitalize line-clamp-1">
                          {disciplina.nivelDominio || 'nivel nao definido'}
                          {disciplina.estudarTodosDias && <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-1.5 py-0.5 text-[7px] font-black uppercase text-red-600 dark:bg-red-950/40 dark:text-red-300"><CalendarCheck2 size={8} /> diaria</span>}
                        </p>
                      </div>
                      <span className="rounded-full bg-white dark:bg-zinc-900 px-1.5 py-0.5 sm:px-2 sm:py-1 text-[8px] sm:text-[10px] font-black uppercase tracking-wide whitespace-nowrap border border-zinc-100 dark:border-zinc-800" style={{ color: disciplina.cor || '#dc2626' }}>
                        {disciplina.sessoesPorCiclo}x
                      </span>
                    </div>
                    <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-700">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${Math.max(8, ((disciplina.sessoesPorCiclo || 0) / maxSessoesDisciplina) * 100)}%`,
                          backgroundColor: disciplina.cor || '#dc2626',
                        }}
                      />
                    </div>
                    <div className="hidden sm:flex items-center justify-between mt-1.5 text-[10px] font-semibold text-zinc-500">
                      <span>{formatarHoras((disciplina.tempoAlocadoMinutos || 0) / 60)}</span>
                      <span>{disciplina.sessoesPorCiclo} blocos</span>
                    </div>
                  </div>
                ))}
              </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
