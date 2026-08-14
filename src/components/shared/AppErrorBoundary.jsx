import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

export default class AppErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    window.__dismissModoQapLoading?.();
    console.error('[Aplicacao] Falha inesperada capturada:', error, info?.componentStack);
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <main className="flex min-h-screen items-center justify-center bg-zinc-950 p-6 text-white">
        <section className="w-full max-w-lg rounded-3xl border border-red-500/30 bg-zinc-900 p-7 text-center shadow-2xl">
          <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-red-500/15 text-red-400">
            <AlertTriangle size={28} aria-hidden="true" />
          </div>
          <h1 className="text-xl font-black uppercase tracking-tight">Nao foi possivel carregar esta tela</h1>
          <p className="mt-3 text-sm leading-relaxed text-zinc-400">
            O sistema encontrou uma falha inesperada. Recarregue a pagina para restabelecer a conexao.
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="mt-6 inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-red-600 px-5 text-xs font-black uppercase tracking-widest text-white transition hover:bg-red-700"
          >
            <RefreshCw size={16} aria-hidden="true" />
            Recarregar pagina
          </button>
        </section>
      </main>
    );
  }
}
