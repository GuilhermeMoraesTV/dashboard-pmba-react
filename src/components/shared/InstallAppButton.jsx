import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Download, Smartphone, Share, X } from 'lucide-react';
import {
  getPwaInstallState,
  promptPwaInstall,
  subscribeToPwaInstallState,
} from '../../utils/pwaInstall';

export default function InstallAppButton({ expanded = false, onNavigate }) {
  const [installState, setInstallState] = useState(getPwaInstallState);
  const [showIosHelp, setShowIosHelp] = useState(false);

  useEffect(() => subscribeToPwaInstallState(() => {
    setInstallState(getPwaInstallState());
  }), []);

  if (installState.installed || (!installState.canPrompt && !installState.isIos)) {
    return null;
  }

  const handleInstall = async () => {
    if (installState.isIos && !installState.canPrompt) {
      setShowIosHelp(true);
      return;
    }

    await promptPwaInstall();
    setInstallState(getPwaInstallState());
    onNavigate?.();
  };

  return (
    <>
      <button
        type="button"
        onClick={handleInstall}
        className={`group relative flex w-full items-center overflow-hidden rounded-xl border border-zinc-200 bg-white text-zinc-800 shadow-sm shadow-zinc-950/5 transition-all hover:border-red-200 hover:bg-red-50/70 hover:text-red-700 active:scale-[0.98] dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100 dark:shadow-black/20 dark:hover:border-red-900/60 dark:hover:bg-red-950/20 dark:hover:text-red-300 ${
          expanded ? 'gap-2.5 px-2.5 py-2' : 'justify-center px-2 py-2'
        }`}
        title="Instalar app"
        aria-label="Instalar app ModoQAP"
      >
        <span className="relative flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-zinc-950 text-white shadow-md shadow-zinc-950/20 transition-transform group-hover:scale-105 group-hover:bg-red-600 dark:bg-white dark:text-zinc-950 dark:shadow-white/10 dark:group-hover:bg-red-500 dark:group-hover:text-white">
          <Smartphone size={15} strokeWidth={2.4} />
          <Download size={8} strokeWidth={3} className="absolute bottom-1 right-1" />
        </span>
        {expanded && (
          <span className="min-w-0 text-left">
            <span className="block truncate text-[9px] font-black uppercase tracking-[0.12em]">
              Instale o Modo QAP
            </span>
            <span className="mt-0.5 block truncate text-[9px] font-bold text-zinc-500 group-hover:text-red-600 dark:text-zinc-400 dark:group-hover:text-red-300">
              App rápido agora
            </span>
          </span>
        )}
      </button>

      {showIosHelp && createPortal(
        <div
          className="fixed inset-0 z-[10030] flex items-end justify-center bg-black/55 p-4 backdrop-blur-sm sm:items-center"
          role="presentation"
          onClick={() => setShowIosHelp(false)}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="install-ios-title"
            className="w-full max-w-sm rounded-2xl border border-zinc-200 bg-white p-5 shadow-2xl dark:border-zinc-700 dark:bg-zinc-900"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-600 text-white">
                  <Share size={19} strokeWidth={2.4} />
                </span>
                <div>
                  <h2 id="install-ios-title" className="text-sm font-black text-zinc-950 dark:text-white">
                    Instalar no iPhone
                  </h2>
                  <p className="mt-0.5 text-xs font-medium text-zinc-500 dark:text-zinc-400">
                    Leva apenas alguns segundos.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowIosHelp(false)}
                aria-label="Fechar instruções"
                className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-white"
              >
                <X size={17} />
              </button>
            </div>

            <ol className="mt-5 space-y-3 text-sm font-semibold text-zinc-700 dark:text-zinc-200">
              <li className="flex gap-3"><span className="text-red-600">1.</span> Toque em Compartilhar no Safari.</li>
              <li className="flex gap-3"><span className="text-red-600">2.</span> Selecione Adicionar à Tela de Início.</li>
              <li className="flex gap-3"><span className="text-red-600">3.</span> Confirme em Adicionar.</li>
            </ol>
          </section>
        </div>,
        document.body,
      )}
    </>
  );
}
