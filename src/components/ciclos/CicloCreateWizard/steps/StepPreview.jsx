import React, { useMemo, useState } from 'react';
import { CalendarCheck2, Clock3, Target } from 'lucide-react';

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

const CycleSummaryCard = ({ horasTotais, totalSessoesPreview, tempoSessaoMinutos, totalPlanejadoMinutos, compact = false }) => (
  <div className={`overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900 ${compact ? 'p-2.5' : 'p-4 sm:rounded-3xl'}`}>
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <p className="text-[8px] font-black uppercase tracking-[0.18em] text-red-500 sm:text-[10px]">Resumo</p>
        <p className={`${compact ? 'text-lg' : 'text-2xl'} mt-1 font-black text-zinc-900 dark:text-white`}>
          {formatarHoras(horasTotais)}
        </p>
        <p className="text-[9px] font-bold text-zinc-500 dark:text-zinc-400">por semana</p>
      </div>
      <div className="hidden h-12 w-12 place-items-center rounded-2xl bg-red-50 text-red-600 dark:bg-red-950/20 sm:grid">
        <Clock3 size={20} />
      </div>
    </div>
    <div className={`mt-3 grid ${compact ? 'grid-cols-2 gap-1.5' : 'grid-cols-2 gap-2'}`}>
      <div className="rounded-xl border border-zinc-100 bg-zinc-50 px-2 py-1.5 dark:border-zinc-800 dark:bg-zinc-950">
        <p className="text-[7px] font-black uppercase tracking-widest text-zinc-400">Blocos</p>
        <p className="mt-0.5 text-xs font-black text-zinc-900 dark:text-white">{totalSessoesPreview}</p>
      </div>
      <div className="rounded-xl border border-zinc-100 bg-zinc-50 px-2 py-1.5 dark:border-zinc-800 dark:bg-zinc-950">
        <p className="text-[7px] font-black uppercase tracking-widest text-zinc-400">Cada bloco</p>
        <p className="mt-0.5 text-xs font-black text-zinc-900 dark:text-white">{tempoSessaoMinutos} min</p>
      </div>
    </div>
    {!compact && (
      <p className="mt-3 text-[11px] font-bold text-zinc-500 dark:text-zinc-400">
        O ciclo planeja {formatarHoras(totalPlanejadoMinutos / 60)} dentro da sua carga semanal.
      </p>
    )}
  </div>
);

const DisciplineDistributionCard = ({ disciplinasPreview, maxSessoesDisciplina }) => (
  <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900 sm:rounded-3xl xl:max-h-[560px]">
    <div className="border-b border-zinc-100 bg-zinc-50 px-3 py-2.5 dark:border-zinc-800 dark:bg-zinc-950 sm:px-4 sm:py-4">
      <p className="text-[9px] font-black uppercase tracking-widest text-zinc-500 dark:text-zinc-400 sm:text-[10px]">Disciplinas do ciclo</p>
      <p className="mt-1 text-[10px] font-bold text-zinc-500 dark:text-zinc-400 sm:text-[11px]">
        Quantidade de blocos prevista para cada materia.
      </p>
    </div>

    <div className="grid max-h-[220px] grid-cols-1 gap-1.5 overflow-y-auto p-2.5 pr-1 custom-scrollbar sm:max-h-[300px] sm:grid-cols-2 sm:gap-2 sm:p-4 xl:max-h-[445px] xl:grid-cols-1">
      {disciplinasPreview.map((disciplina) => (
        <div key={disciplina.id} className="rounded-lg border border-zinc-100 bg-zinc-50 px-2 py-1.5 dark:border-zinc-800 dark:bg-zinc-800/60 sm:rounded-xl sm:px-3 sm:py-2">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="text-[10px] font-black leading-tight text-zinc-900 line-clamp-1 dark:text-white sm:text-[13px]">{disciplina.nome}</p>
              <p className="hidden items-center gap-1 text-[10px] text-zinc-500 mt-0.5 capitalize line-clamp-1 sm:flex">
                {disciplina.nivelDominio || 'nivel nao definido'}
                {disciplina.estudarTodosDias && <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-1.5 py-0.5 text-[7px] font-black uppercase text-red-600 dark:bg-red-950/40 dark:text-red-300"><CalendarCheck2 size={8} /> diaria</span>}
              </p>
            </div>
            <span className="rounded-full border border-zinc-100 bg-white px-1.5 py-0.5 text-[8px] font-black uppercase tracking-wide dark:border-zinc-800 dark:bg-zinc-900 sm:px-2 sm:py-1 sm:text-[10px]" style={{ color: disciplina.cor || '#dc2626' }}>
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
          <div className="hidden items-center justify-between mt-1.5 text-[10px] font-semibold text-zinc-500 sm:flex">
            <span>{formatarHoras((disciplina.tempoAlocadoMinutos || 0) / 60)}</span>
            <span>{disciplina.sessoesPorCiclo} blocos</span>
          </div>
        </div>
      ))}
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
        <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_340px] gap-4 md:gap-5 items-start">
          <div className="order-1 grid grid-cols-[minmax(0,0.86fr)_minmax(0,1.14fr)] items-stretch gap-2 sm:hidden">
            <EditalSidebarCard editalSelecionado={editalSelecionado} nomeCiclo={nomeCiclo} />
            <CycleSummaryCard
              horasTotais={horasTotais}
              totalSessoesPreview={totalSessoesPreview}
              tempoSessaoMinutos={tempoSessaoMinutos}
              totalPlanejadoMinutos={totalPlanejadoMinutos}
              compact
            />
          </div>

          <div className="order-2 h-[610px] rounded-[24px] border border-zinc-200 bg-white p-1.5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/70 sm:h-auto sm:min-h-[760px] sm:p-3 lg:p-4 xl:order-1 xl:min-h-[760px]">
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
              sizePreset="preview"
            />
          </div>

          <div className="order-3 grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 xl:order-2 xl:block xl:space-y-4">
            <div className="hidden sm:block">
              <EditalSidebarCard editalSelecionado={editalSelecionado} nomeCiclo={nomeCiclo} />
            </div>
            <div className="hidden sm:block">
              <CycleSummaryCard
                horasTotais={horasTotais}
                totalSessoesPreview={totalSessoesPreview}
                tempoSessaoMinutos={tempoSessaoMinutos}
                totalPlanejadoMinutos={totalPlanejadoMinutos}
              />
            </div>
            <div className="sm:col-span-2 xl:col-span-1">
              <DisciplineDistributionCard
                disciplinasPreview={disciplinasPreview}
                maxSessoesDisciplina={maxSessoesDisciplina}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
