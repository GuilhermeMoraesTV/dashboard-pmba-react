import React, { useState, useEffect } from 'react';
import { ArrowRight, Layers, Plus } from 'lucide-react';
import { CicloDetalhePage } from './CicloDetalhePage';

// AQUI: Recebe 'registrosEstudo' do Dashboard
function CiclosPage({ user, addRegistroEstudo, deleteCompletionRegistro, onDeleteRegistro, onCicloAtivado, onStartStudy, activeCicloId, forceOpenVisual, targetOpenCicloId, onTargetOpenHandled, onGoToEdital, onGoToRevisao, onCreateNewCycle, registrosEstudo, isTimerActive, onRegistroModalOpenChange }) {
  const [selectedCicloId, setSelectedCicloId] = useState(null);

  useEffect(() => {
    const cicloIdParaAbrir = targetOpenCicloId || activeCicloId;
    if (forceOpenVisual && cicloIdParaAbrir) {
      setSelectedCicloId(cicloIdParaAbrir);
      if (targetOpenCicloId) onTargetOpenHandled?.();
    }
  }, [forceOpenVisual, activeCicloId, targetOpenCicloId, onTargetOpenHandled]);

  const cicloIdAberto = selectedCicloId || targetOpenCicloId || activeCicloId;

  if (cicloIdAberto && typeof cicloIdAberto === 'string') {
    return (
      <CicloDetalhePage
        cicloId={cicloIdAberto}
        onBack={() => onCreateNewCycle?.()}
        user={user}
        addRegistroEstudo={addRegistroEstudo}
        deleteCompletionRegistro={deleteCompletionRegistro}
        onDeleteRegistro={onDeleteRegistro}
        onStartStudy={onStartStudy}
        onGoToEdital={onGoToEdital}
        onGoToRevisao={onGoToRevisao}
        onCreateNewCycle={onCreateNewCycle}
        onRegistroModalOpenChange={onRegistroModalOpenChange}
        registrosEstudo={registrosEstudo}
      />
    );
  }

  return (
    <div className="mx-auto flex min-h-[55vh] w-full max-w-3xl items-center justify-center px-4 py-10">
      <div className="w-full rounded-3xl border border-zinc-200 bg-white p-6 shadow-xl shadow-zinc-200/40 dark:border-zinc-800 dark:bg-card-dark dark:shadow-none sm:p-8">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-red-50 text-red-600 dark:bg-red-950/30 dark:text-red-300">
              <Layers size={24} />
            </div>
            <p className="text-[10px] font-black uppercase tracking-[0.22em] text-zinc-400">
              Ciclos
            </p>
            <h1 className="mt-1 text-2xl font-black uppercase tracking-tight text-zinc-900 dark:text-white">
              Use a central de planejamento
            </h1>
            <p className="mt-2 text-sm font-semibold leading-relaxed text-zinc-500 dark:text-zinc-400">
              A lista antiga foi removida para evitar abertura duplicada. Crie ou acesse seus planejamentos pela central atual.
            </p>
          </div>
          <button
            type="button"
            onClick={() => onCreateNewCycle?.()}
            className="inline-flex h-12 shrink-0 items-center justify-center gap-2 rounded-xl bg-red-600 px-5 text-xs font-black uppercase tracking-widest text-white shadow-lg shadow-red-600/25 transition hover:bg-red-700 active:scale-95"
          >
            <Plus size={16} />
            Planejamento
            <ArrowRight size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}

export default CiclosPage;
