import React, { useEffect, useState } from 'react';
import { CheckCircle2, CloudOff, Download, X } from 'lucide-react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { useOnlineStatus } from '../../hooks/useOnlineStatus';

const STATUS_HIDE_DELAY = 3500;

export default function PwaStatus({ hasPendingWrites = false }) {
  const isOnline = useOnlineStatus();
  const [firestorePending, setFirestorePending] = useState(hasPendingWrites);
  const [wasOffline, setWasOffline] = useState(false);
  const [showBackOnline, setShowBackOnline] = useState(false);
  const {
    offlineReady: [offlineReady, setOfflineReady],
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisterError(error) {
      console.error('[PWA] Falha ao registrar o modo offline:', error);
    },
  });

  useEffect(() => {
    setFirestorePending(hasPendingWrites);
  }, [hasPendingWrites]);

  useEffect(() => {
    const handleSyncState = (event) => setFirestorePending(Boolean(event.detail?.hasPendingWrites));
    window.addEventListener('modoqap-firestore-sync-state', handleSyncState);
    return () => window.removeEventListener('modoqap-firestore-sync-state', handleSyncState);
  }, []);

  useEffect(() => {
    if (!isOnline) {
      setWasOffline(true);
      setShowBackOnline(false);
      return undefined;
    }

    if (!wasOffline) return undefined;
    setShowBackOnline(true);
    const timeoutId = window.setTimeout(() => {
      setShowBackOnline(false);
      setWasOffline(false);
    }, STATUS_HIDE_DELAY);
    return () => window.clearTimeout(timeoutId);
  }, [isOnline, wasOffline]);

  useEffect(() => {
    if (!offlineReady) return undefined;
    const timeoutId = window.setTimeout(() => setOfflineReady(false), STATUS_HIDE_DELAY);
    return () => window.clearTimeout(timeoutId);
  }, [offlineReady, setOfflineReady]);

  let content = null;

  if (needRefresh) {
    content = {
      icon: Download,
      tone: 'border-red-500/30 bg-zinc-950 text-white',
      title: 'Nova versão disponível',
      detail: 'Atualize para usar a versão mais recente.',
      action: (
        <button
          type="button"
          onClick={() => updateServiceWorker(true)}
          className="rounded-lg bg-red-600 px-3 py-2 text-[10px] font-black uppercase tracking-wider text-white hover:bg-red-700"
        >
          Atualizar
        </button>
      ),
      onClose: () => setNeedRefresh(false),
    };
  } else if (!isOnline) {
    content = {
      icon: CloudOff,
      tone: 'border-amber-500/30 bg-zinc-950 text-white',
      title: 'Modo offline',
      detail: firestorePending
        ? 'Alterações salvas neste dispositivo. Sincronizaremos quando a internet voltar.'
        : 'Usando os dados disponíveis neste dispositivo.',
    };
  } else if (showBackOnline) {
    content = {
      icon: CheckCircle2,
      tone: 'border-emerald-500/30 bg-zinc-950 text-white',
      title: 'Conexão restaurada',
      detail: 'Seus dados estão sendo atualizados.',
    };
  } else if (offlineReady) {
    content = {
      icon: CheckCircle2,
      tone: 'border-emerald-500/30 bg-zinc-950 text-white',
      title: 'Pronto para uso offline',
      detail: 'O aplicativo essencial foi salvo neste dispositivo.',
    };
  }

  if (!content) return null;

  const Icon = content.icon;
  return (
    <aside
      aria-live="polite"
      className={`fixed bottom-4 left-1/2 z-[10020] flex w-[min(92vw,430px)] -translate-x-1/2 items-center gap-3 rounded-2xl border px-4 py-3 shadow-2xl ${content.tone}`}
    >
      <Icon size={19} className={`shrink-0 ${content.spin ? 'animate-spin' : ''}`} />
      <div className="min-w-0 flex-1">
        <p className="text-xs font-black uppercase tracking-wider">{content.title}</p>
        <p className="mt-0.5 text-[11px] font-medium leading-snug text-zinc-300">{content.detail}</p>
      </div>
      {content.action}
      {content.onClose && (
        <button
          type="button"
          aria-label="Fechar aviso"
          onClick={content.onClose}
          className="rounded-lg p-1.5 text-zinc-400 hover:bg-white/10 hover:text-white"
        >
          <X size={15} />
        </button>
      )}
    </aside>
  );
}
