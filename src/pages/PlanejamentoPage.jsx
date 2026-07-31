import React, { useEffect, useState } from 'react';
import {
  ArrowRight,
  CalendarClock,
  Edit3,
  LayoutGrid,
  Layers,
  Plus,
  RefreshCw,
} from 'lucide-react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import CicloCreateWizard from '../components/ciclos/CicloCreateWizard/CicloCreateWizard';
import CicloEditModal from '../components/ciclos/CicloEditModal';
import CiclosList from '../components/ciclos/CiclosList';
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

const CiclosCentralizadosPanel = ({ user, activeCicloId, onOpenActive, onRequestCreate, onRequestEdit, onCicloAtivado }) => {
  const [ciclos, setCiclos] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.uid) {
      setCiclos([]);
      setLoading(false);
      return undefined;
    }
    const ref = collection(db, 'users', user.uid, 'ciclos');
    return onSnapshot(ref, (snapshot) => {
      const lista = snapshot.docs
        .map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }))
        .sort((a, b) => Number(b.ativo === true) - Number(a.ativo === true));
      setCiclos(lista);
      setLoading(false);
    }, () => setLoading(false));
  }, [user?.uid]);

  return (
    <section className="p-0">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-red-50 text-red-600 dark:bg-red-950/30 dark:text-red-300">
            <RefreshCw size={20} />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-black uppercase tracking-[0.22em] text-zinc-400">Ciclos</p>
            <h2 className="mt-1 text-lg font-black uppercase tracking-tight text-zinc-900 dark:text-white">Lista de ciclos</h2>
          </div>
        </div>
        <button
          type="button"
          onClick={onRequestCreate}
          className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-red-600 px-4 text-xs font-black uppercase tracking-widest text-white shadow-lg shadow-red-600/20 transition hover:bg-red-700 active:scale-95"
        >
          <Plus size={15} />
          Novo ciclo
        </button>
      </div>

      {loading ? (
        <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-5 text-sm font-bold text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400">
          Carregando ciclos...
        </div>
      ) : ciclos.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-zinc-300 bg-zinc-50 p-5 text-sm font-bold text-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400">
          Nenhum ciclo criado ainda.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-6">
          {ciclos.map((ciclo) => {
            const active = ciclo.ativo === true || ciclo.id === activeCicloId;
            const totalBlocos = Number(ciclo.totalSessoesCiclo || ciclo.ordemSessoes?.length || ciclo.disciplinas?.reduce?.((acc, disciplina) => acc + Number(disciplina.sessoesPorCiclo || 0), 0) || ciclo.disciplinas?.length || 0);
            const concluidos = Array.isArray(ciclo.sessoesConcluidas) ? ciclo.sessoesConcluidas.length : 0;
            const progresso = totalBlocos > 0 ? Math.min(100, Math.round((concluidos / totalBlocos) * 100)) : 0;
            const tempoSessao = Number(ciclo.tempoSessaoMinutos || 50);
            const horasCiclo = totalBlocos > 0 ? Math.round((totalBlocos * tempoSessao) / 60) : 0;
            return (
              <article key={ciclo.id} onClick={() => active && onOpenActive?.(ciclo.id)} className={`group relative flex h-full min-h-[170px] flex-col justify-between overflow-hidden rounded-2xl border border-zinc-200 bg-white p-4 transition-all duration-500 hover:-translate-y-1 hover:shadow-2xl dark:border-zinc-800 dark:bg-zinc-900/50 sm:min-h-[220px] sm:p-5 ${active ? 'cursor-pointer' : 'cursor-default'}`}>
                <div className="absolute left-0 top-0 bottom-0 z-20 w-1 bg-transparent transition-colors duration-300 group-hover:bg-red-500" />
                <div className="relative z-10 mb-3 flex items-start gap-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
                    {ciclo.logoUrl ? (
                      <img src={ciclo.logoUrl} alt={ciclo.nome || 'Ciclo'} className="h-full w-full object-contain p-1.5" />
                    ) : (
                      <RefreshCw size={18} className="text-red-500" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className={`mb-2 inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-[9px] font-black uppercase tracking-widest ${active ? 'border-red-500/20 bg-red-500/10 text-red-500' : 'border-zinc-200 bg-zinc-100 text-zinc-500 dark:border-zinc-700 dark:bg-zinc-800'}`}>
                      {active && (<span className="relative flex h-1.5 w-1.5"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" /><span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-red-500" /></span>)}
                      {active ? 'ATIVO' : 'INATIVO'}
                    </div>
                    <h3 className="line-clamp-2 text-lg font-black leading-tight text-zinc-900 transition-colors group-hover:text-red-600 dark:text-white dark:group-hover:text-red-500 sm:text-xl md:text-2xl">{ciclo.nome || 'Ciclo sem nome'}</h3>
                    <p className="mt-1 text-[10px] font-bold uppercase tracking-widest text-zinc-400">
                      {active ? 'Ativo' : 'Inativo'} • {ciclo.totalSessoesCiclo || ciclo.disciplinas?.length || 0} blocos
                    </p>
                  </div>
                </div>
                <div className="relative z-10 mt-1 flex flex-col gap-3 border-t border-zinc-100 pt-3 dark:border-zinc-800/50">
                  <div className="mb-1.5 flex items-end justify-between">
                    <span className="flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-zinc-400 dark:text-zinc-500">
                      <RefreshCw size={12} /> Progresso
                    </span>
                    <span className="text-[11px] font-black tabular-nums text-zinc-600 dark:text-zinc-300">{progresso}%</span>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800/80 sm:h-2">
                    <div className="h-full rounded-full bg-red-600 transition-all duration-700" style={{ width: `${progresso}%` }} />
                  </div>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                    <span className="text-[9px] font-bold tabular-nums text-zinc-500 dark:text-zinc-400 sm:text-[10px]">{totalBlocos} blocos</span>
                    {horasCiclo > 0 && <span className="text-[9px] font-bold tabular-nums text-zinc-500 dark:text-zinc-400 sm:text-[10px]">{horasCiclo}h/ciclo</span>}
                    {ciclo.disciplinas?.length > 0 && <span className="text-[9px] font-bold tabular-nums text-zinc-500 dark:text-zinc-400 sm:text-[10px]">{ciclo.disciplinas.length} disc.</span>}
                  </div>
                <div className="grid grid-cols-2 gap-2">
                  {active ? (
                    <button type="button" onClick={(event) => { event.stopPropagation(); onOpenActive?.(ciclo.id); }} className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-red-600 px-3 py-2 text-[9px] font-black uppercase tracking-widest text-white shadow-lg shadow-red-600/20 transition hover:bg-red-700 sm:text-[10px]">
                      Acessar <ArrowRight size={13} />
                    </button>
                  ) : (
                    <button type="button" onClick={(event) => { event.stopPropagation(); onCicloAtivado?.(ciclo.id); }} className="inline-flex items-center justify-center rounded-xl bg-red-600 px-3 py-2 text-[9px] font-black uppercase tracking-widest text-white shadow-lg shadow-red-600/20 transition hover:bg-red-700 sm:text-[10px]">
                      Ativar
                    </button>
                  )}
                  <button type="button" onClick={(event) => { event.stopPropagation(); onRequestEdit?.(ciclo); }} className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-zinc-200 bg-white px-3 py-2 text-[9px] font-black uppercase tracking-widest text-zinc-700 shadow-sm transition hover:border-red-200 hover:bg-red-50 hover:text-red-700 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 sm:text-[10px]">
                    <Edit3 size={13} /> Editar
                  </button>
                </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
};

function PlanejamentoPage({
  user,
  addRegistroEstudo,
  onStartStudy,
  onGoToEdital,
  onGoToRevisao,
  registrosEstudo,
  isTimerActive,
  onGoToCronograma,
  onCicloAtivado,
  activeCicloId = null,
  onOpenFeedback,
  abrirDiretoSeletor = false,
  onSeletorDiretoAberto,
  onRegistroModalOpenChange,
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
        onGoToRevisao={onGoToRevisao}
        onRegistroModalOpenChange={onRegistroModalOpenChange}
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
    <div className="mobile-page-zoom mobile-page-zoom--planejamento mx-auto w-full max-w-7xl p-0 min-h-[50vh] animate-fade-in pb-12">
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
              user={user}
              onCicloClick={(id) => setSelectedCicloId(id)}
              onCicloAtivado={onCicloAtivado}
              registrosEstudo={registrosEstudo}
              isTimerActive={isTimerActive}
              onRequestCreate={() => abrirCriacao('ciclo')}
              onRequestEdit={abrirEdicaoCiclo}
              hideHeader={true}
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
          user={user}
          onCicloClick={(id) => setSelectedCicloId(id)}
          onCicloAtivado={onCicloAtivado}
          registrosEstudo={registrosEstudo}
          isTimerActive={isTimerActive}
          onRequestCreate={() => abrirCriacao('ciclo')}
          onRequestEdit={abrirEdicaoCiclo}
          hideHeader={true}
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
