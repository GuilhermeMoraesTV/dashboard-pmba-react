import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

export default class TabErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('[TabErrorBoundary] Erro ao renderizar secao:', error, errorInfo);
  }

  handleRetry = () => {
    // React.lazy caches rejected imports; resetting the boundary cannot retry them.
    if (/failed to fetch dynamically imported module|loading chunk .* failed|loading css chunk .* failed|importing a module script failed|error loading dynamically imported module|outdated optimize dep/i.test(this.state.error?.message || '')) {
      window.location.reload();
      return;
    }
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="mx-auto my-12 flex max-w-lg flex-col items-center justify-center rounded-3xl border border-red-500/20 bg-white p-8 text-center shadow-lg dark:border-red-500/20 dark:bg-zinc-900">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-red-500/10 text-red-500">
            <AlertTriangle size={28} />
          </div>
          <h2 className="text-lg font-black uppercase tracking-tight text-zinc-900 dark:text-white">
            Nao foi possivel carregar esta secao
          </h2>
          <p className="mt-2 text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">
            Ocorreu uma falha no carregamento do modulo ou conexao. Clique no botao abaixo para tentar recarregar esta area.
          </p>
          <button
            type="button"
            onClick={this.handleRetry}
            className="mt-6 inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-red-600 px-5 text-xs font-black uppercase tracking-widest text-white transition hover:bg-red-700"
          >
            <RefreshCw size={15} />
            Tentar novamente
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
