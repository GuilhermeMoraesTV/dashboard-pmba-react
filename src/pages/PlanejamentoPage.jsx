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
import { CicloDetalhePage } from './CicloDetalhePage';
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
  onSeletorDiretoAberto,
}) {
  const [aba, setAba] = useState('todos');
  const [telaCriacao, setTelaCriacao] = useState('lista'); // 'lista' | 'seletor'
  const [wizardAberto, setWizardAberto] = useState(null); // 'ciclo' | 'cronograma' | null
  const [selectedCicloId, setSelectedCicloId] = useState(null);
  const [cicloParaEditar, setCicloParaEditar] = useState(null);
  const [cronogramaParaEditar, setCronogramaParaEditar] = useState(null);
  const [seletorDiretoAtivo, setSeletorDiretoAtivo] = useState(false);

  useEffect(() => {
    if (abrirDiretoSeletor && !wizardAberto && !selectedCicloId && !cicloParaEditar && !cronogramaParaEditar) {
      setTelaCriacao('seletor');
      setSeletorDiretoAtivo(true);
      onSeletorDiretoAberto?.();
    }
  }, [abrirDiretoSeletor, wizardAberto, selectedCicloId, cicloParaEditar, cronogramaParaEditar, onSeletorDiretoAberto]);

  const abrirCriacao = (tipo) => {
    setTelaCriacao('lista');
    setWizardAberto(tipo);
  };

  const abrirSeletorCriacao = () => {
    setSeletorDiretoAtivo(false);
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
      <div className="p-0 min-h-[50vh] animate-fade-in">
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
      <div className="p-0 min-h-[50vh] animate-fade-in">
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
      <div className="p-0 min-h-[50vh] animate-fade-in">
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
        onBack={() => {
          setSeletorDiretoAtivo(false);
          setTelaCriacao('lista');
        }}
        hideBack={seletorDiretoAtivo}
        onCriarCiclo={() => abrirCriacao('ciclo')}
        onCriarCronograma={() => abrirCriacao('cronograma')}
      />
    );
  }
  return (
    <div className="mx-auto w-full max-w-7xl p-0 min-h-[50vh] animate-fade-in pb-12">
      <section className="mb-5 w-full">
        <div className="group relative overflow-hidden rounded-xl border-2 border-l-4 border-zinc-200 !border-l-red-500/20 bg-white p-4 shadow-soft transition-all duration-300 hover:border-accent-light/40 hover:!border-l-red-500 hover:shadow-[0_0_18px_rgba(239,68,68,0.07)] dark:border-white/10 dark:!border-l-red-500/25 dark:bg-zinc-950 dark:hover:border-accent-light/20 dark:hover:!border-l-red-500 dark:hover:shadow-[0_0_22px_rgba(239,68,68,0.08)]">
          <div className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-red-500/5 blur-[80px] transition-all duration-700 group-hover:bg-red-500/10" />
          <div className="pointer-events-none absolute -bottom-20 -left-20 h-64 w-64 rounded-full bg-zinc-500/5 blur-[80px]" />

          <div className="relative z-10 flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
            <div className="flex min-w-0 items-start gap-3">
              <div className="relative">
                <div className="absolute inset-0 animate-ping rounded-full bg-red-500/20 opacity-30 duration-[3s]" />
                <div className="relative flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-red-600 to-rose-700 text-white shadow-xl shadow-red-500/20">
                  <Layers size={22} strokeWidth={2.1} />
                </div>
              </div>
              <div className="min-w-0">
                <h1 className="text-2xl font-black uppercase leading-none tracking-tight text-zinc-900 dark:text-white sm:text-3xl">
                  Planejamento <span className="bg-gradient-to-r from-red-600 to-rose-700 bg-clip-text text-transparent">de Estudos</span>
                </h1>
                <p className="mt-2 max-w-2xl text-xs font-semibold leading-relaxed text-zinc-500 dark:text-zinc-400 sm:text-sm">
                  Organize ciclos, cronogramas e metodos de estudo em uma central clara para manter sua rotina no caminho certo.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={abrirSeletorCriacao}
              className="group/cta relative flex h-11 w-full items-center justify-center gap-2 overflow-hidden rounded-xl bg-red-600 px-4 text-xs font-black uppercase tracking-[0.12em] text-white shadow-lg shadow-red-600/30 transition-all hover:-translate-y-0.5 hover:bg-red-700 active:translate-y-0 sm:w-auto sm:min-w-[210px]"
            >
              <div className="absolute inset-0 translate-x-[-100%] bg-white/20 transition-transform duration-500 group-hover/cta:translate-x-[100%]" />
              <Plus size={16} className="relative z-10 transition-transform group-hover/cta:rotate-90" />
              <span className="relative z-10">Novo Planejamento</span>
              <ArrowRight size={15} className="relative z-10 transition-transform group-hover/cta:translate-x-1" />
            </button>
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
