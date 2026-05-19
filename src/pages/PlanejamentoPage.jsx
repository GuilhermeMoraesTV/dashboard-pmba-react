import React, { useEffect, useState } from 'react';
import {
  ArrowRight,
  CalendarClock,
  LayoutGrid,
  Layers,
  Plus,
  RefreshCw,
} from 'lucide-react';
import CiclosList from '../components/ciclos/CiclosList';
import CicloCreateWizard from '../components/ciclos/CicloCreateWizard/CicloCreateWizard';
import CicloEditModal from '../components/ciclos/CicloEditModal';
import CronogramaCreateWizard from '../components/cronograma/WizardShell';
import CronogramaListPage from './CronogramaListPage';
import CicloDetalhePage from './CicloDetalhePage';
import PlanejamentoNovoPage from './PlanejamentoNovoPage';

const ABAS = [
  { id: 'todos', label: 'Todos', icon: LayoutGrid },
  { id: 'ciclos', label: 'Ciclos', icon: RefreshCw },
  { id: 'cronogramas', label: 'Cronogramas', icon: CalendarClock },
];

const AbaBotao = ({ id, label, icon: Icon, ativa, onClick }) => (
  <button
    type="button"
    onClick={() => onClick(id)}
    className={`flex items-center gap-2 px-3.5 py-2 rounded-xl border text-xs font-black uppercase tracking-wider transition-all ${
      ativa
        ? 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 border-zinc-900 dark:border-white shadow-lg'
        : 'bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700 hover:border-zinc-300 dark:hover:border-zinc-600'
    }`}
  >
    <Icon size={14} />
    <span>{label}</span>
  </button>
);

function PlanejamentoPage({
  user,
  addRegistroEstudo,
  onStartStudy,
  onGoToEdital,
  registrosEstudo,
  isTimerActive,
  onGoToCronograma,
  onCicloAtivado,
  onOpenFeedback,
  abrirDiretoSeletor = false,
}) {
  const [aba, setAba] = useState('todos');
  const [telaCriacao, setTelaCriacao] = useState('lista'); // 'lista' | 'seletor'
  const [wizardAberto, setWizardAberto] = useState(null); // 'ciclo' | 'cronograma' | null
  const [selectedCicloId, setSelectedCicloId] = useState(null);
  const [cicloParaEditar, setCicloParaEditar] = useState(null);
  const [cronogramaParaEditar, setCronogramaParaEditar] = useState(null);

  useEffect(() => {
    if (abrirDiretoSeletor && !wizardAberto && !selectedCicloId && !cicloParaEditar && !cronogramaParaEditar) {
      setTelaCriacao('seletor');
    }
  }, [abrirDiretoSeletor, wizardAberto, selectedCicloId, cicloParaEditar, cronogramaParaEditar]);

  const abrirCriacao = (tipo) => {
    setTelaCriacao('lista');
    setWizardAberto(tipo);
  };

  const abrirSeletorCriacao = () => {
    setTelaCriacao('seletor');
  };

  const voltarParaMetodos = () => {
    setWizardAberto(null);
    setTelaCriacao('seletor');
  };

  const abrirEdicaoCiclo = (ciclo) => {
    setWizardAberto(null);
    setTelaCriacao('lista');
    setSelectedCicloId(null);
    setCronogramaParaEditar(null);
    setCicloParaEditar(ciclo);
  };

  const fecharEdicaoCiclo = () => {
    setCicloParaEditar(null);
  };

  const abrirEdicaoCronograma = (cronograma) => {
    setWizardAberto(null);
    setTelaCriacao('lista');
    setSelectedCicloId(null);
    setCicloParaEditar(null);
    setCronogramaParaEditar(cronograma);
  };

  const fecharEdicaoCronograma = () => {
    setCronogramaParaEditar(null);
  };

  if (selectedCicloId) {
    return (
      <CicloDetalhePage
        cicloId={selectedCicloId}
        onBack={() => setSelectedCicloId(null)}
        user={user}
        addRegistroEstudo={addRegistroEstudo}
        onStartStudy={onStartStudy}
        onGoToEdital={onGoToEdital}
      />
    );
  }

  if (cicloParaEditar) {
    return (
      <CicloEditModal
        onClose={fecharEdicaoCiclo}
        user={user}
        ciclo={cicloParaEditar}
      />
    );
  }

  if (cronogramaParaEditar) {
    return (
      <div className="p-0 min-h-[50vh] animate-fade-in pb-12">
        <CronogramaCreateWizard
          user={user}
          mode="edit"
          cronogramaId={cronogramaParaEditar.id}
          initialState={cronogramaParaEditar}
          initialStep={1}
          onClose={fecharEdicaoCronograma}
          onCronogramaCriado={() => setCronogramaParaEditar(null)}
          onOpenFeedback={onOpenFeedback}
        />
      </div>
    );
  }

  if (wizardAberto === 'ciclo') {
    return (
      <div className="p-0 min-h-[50vh] animate-fade-in pb-12">
        <CicloCreateWizard
          onClose={() => setWizardAberto(null)}
          onBackToSelector={voltarParaMetodos}
          user={user}
          onCicloAtivado={(novoCicloId) => {
            setWizardAberto(null);
            onCicloAtivado?.(novoCicloId);
          }}
          onOpenFeedback={onOpenFeedback}
        />
      </div>
    );
  }

  if (wizardAberto === 'cronograma') {
    return (
      <div className="p-0 min-h-[50vh] animate-fade-in pb-12">
        <CronogramaCreateWizard
          user={user}
          onClose={() => setWizardAberto(null)}
          onBackToSelector={voltarParaMetodos}
          onCronogramaCriado={(novoCronogramaId) => {
            setWizardAberto(null);
            onGoToCronograma?.(novoCronogramaId);
          }}
          onOpenFeedback={onOpenFeedback}
        />
      </div>
    );
  }

  if (telaCriacao === 'seletor') {
    return (
      <PlanejamentoNovoPage
        onBack={() => setTelaCriacao('lista')}
        onCriarCiclo={() => abrirCriacao('ciclo')}
        onCriarCronograma={() => abrirCriacao('cronograma')}
      />
    );
  }
  return (
    <div className="p-0 min-h-[50vh] animate-fade-in pb-12">
      <section className="mb-6 md:mb-8 w-full">
        <div className="relative overflow-hidden rounded-3xl border border-red-100/80 bg-white/[0.90] p-5 shadow-2xl shadow-red-950/[0.06] backdrop-blur-2xl dark:border-red-400/15 dark:bg-white/[0.06] dark:shadow-black/25 sm:p-6 lg:p-8">
          <div className="absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-red-700 via-red-600 to-red-500" />
          <div className="absolute -right-16 -top-20 h-56 w-56 rounded-full bg-red-600/[0.10] blur-3xl dark:bg-red-500/12" />
          <div className="absolute -bottom-24 left-10 h-52 w-52 rounded-full bg-zinc-200/[0.28] blur-3xl dark:bg-white/[0.04]" />

          <div className="relative flex flex-col gap-7 lg:flex-row lg:items-end lg:justify-between">
            <div className="min-w-0">
              <div className="flex items-center gap-4">
                <div className="hidden h-20 w-20 shrink-0 items-center justify-center rounded-3xl bg-gradient-to-br from-red-700 to-red-500 text-white shadow-xl shadow-red-950/20 ring-1 ring-red-300/40 sm:flex">
                  <Layers size={34} strokeWidth={2.5} />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-black uppercase tracking-[0.24em] text-red-600 dark:text-red-200">Painel de organizacao</p>
                  <h1 className="mt-1 text-4xl font-black tracking-tight text-zinc-950 dark:text-white sm:text-5xl lg:text-6xl">
                    Planejamento
                  </h1>
                  <p className="mt-3 max-w-3xl text-sm font-semibold leading-relaxed text-zinc-600 dark:text-zinc-300 sm:text-base">
                    Gerencie seus metodos de estudo, alterne entre ciclo e cronograma e mantenha o edital como referencia do plano.
                  </p>
                </div>
              </div>
            </div>

            <div className="flex w-full flex-col gap-3 lg:w-[290px]">
              <button
                type="button"
                onClick={abrirSeletorCriacao}
                className="group relative flex min-h-14 w-full items-center justify-center gap-2 overflow-hidden rounded-2xl bg-red-700 px-5 text-sm font-black uppercase tracking-[0.12em] text-white shadow-xl shadow-red-950/25 transition-all hover:-translate-y-0.5 hover:bg-red-800 hover:shadow-2xl active:translate-y-0 dark:bg-red-500 dark:text-white dark:hover:bg-red-400"
              >
                <div className="absolute inset-0 translate-x-[-100%] bg-white/25 transition-transform duration-500 group-hover:translate-x-[100%]" />
                <Plus size={18} className="relative z-10 transition-transform group-hover:rotate-90" />
                <span className="relative z-10">Novo Planejamento</span>
                <ArrowRight size={16} className="relative z-10 transition-transform group-hover:translate-x-1" />
              </button>
            </div>
          </div>
        </div>
      </section>

      <div className="mb-5 flex flex-wrap items-center gap-2">
        {ABAS.map((item) => (
          <AbaBotao
            key={item.id}
            id={item.id}
            label={item.label}
            icon={item.icon}
            ativa={aba === item.id}
            onClick={setAba}
          />
        ))}
      </div>

      {aba === 'todos' && (
        <div className="space-y-8">
          <section>
            <h2 className="text-lg md:text-xl font-black text-zinc-800 dark:text-white tracking-tight uppercase mb-3">Ciclos</h2>
            <CiclosList
              onCicloClick={(id) => setSelectedCicloId(id)}
              user={user}
              onCicloAtivado={() => {}}
              registrosEstudo={registrosEstudo}
              isTimerActive={isTimerActive}
              hideHeader={true}
              onRequestCreate={() => abrirCriacao('ciclo')}
              onRequestEdit={abrirEdicaoCiclo}
              compact={true}
            />
          </section>

          <section>
            <h2 className="text-lg md:text-xl font-black text-zinc-800 dark:text-white tracking-tight uppercase mb-3">Cronogramas</h2>
            <CronogramaListPage
              user={user}
              onCronogramaAberto={(_, cronograma) => {
                if (cronograma?.ativo && onGoToCronograma) onGoToCronograma(cronograma.id);
              }}
              hideHeader={true}
              onRequestCreate={() => abrirCriacao('cronograma')}
              onRequestEdit={abrirEdicaoCronograma}
              compact={true}
              allowInactiveOpen={false}
            />
          </section>
        </div>
      )}

      {aba === 'ciclos' && (
        <CiclosList
          onCicloClick={(id) => setSelectedCicloId(id)}
          user={user}
          onCicloAtivado={() => {}}
          registrosEstudo={registrosEstudo}
          isTimerActive={isTimerActive}
          hideHeader={true}
          onRequestCreate={() => abrirCriacao('ciclo')}
          onRequestEdit={abrirEdicaoCiclo}
          compact={true}
        />
      )}

      {aba === 'cronogramas' && (
        <CronogramaListPage
          user={user}
          onCronogramaAberto={(_, cronograma) => {
            if (cronograma?.ativo && onGoToCronograma) onGoToCronograma(cronograma.id);
          }}
          hideHeader={true}
          onRequestCreate={() => abrirCriacao('cronograma')}
          onRequestEdit={abrirEdicaoCronograma}
          compact={true}
          allowInactiveOpen={false}
        />
      )}
    </div>
  );
}

export default PlanejamentoPage;
