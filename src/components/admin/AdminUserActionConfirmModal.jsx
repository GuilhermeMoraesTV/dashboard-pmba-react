import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, Loader2, LockKeyhole, Trash2, X } from 'lucide-react';
import { useBodyScrollLock } from '../../hooks/useBodyScrollLock';

const ACTIONS = {
  deactivate: {
    eyebrow: 'Acesso à plataforma',
    title: 'Desativar esta conta?',
    description: 'O usuário perderá o acesso imediatamente. Os dados serão preservados e a conta poderá ser reativada depois.',
    confirmLabel: 'Desativar conta',
    Icon: LockKeyhole,
  },
  delete: {
    eyebrow: 'Exclusão definitiva',
    title: 'Excluir este usuário?',
    description: 'Esta ação remove a conta, dados acadêmicos, vínculos com grupos e posições nos rankings. Não poderá ser desfeita.',
    confirmLabel: 'Excluir definitivamente',
    Icon: Trash2,
  },
};

const AdminUserActionConfirmModal = ({ open, action = 'deactivate', user, loading = false, onClose, onConfirm }) => {
  const cancelRef = useRef(null);
  const config = ACTIONS[action] || ACTIONS.deactivate;
  const Icon = config.Icon;
  useBodyScrollLock(open, { fixed: false });

  useEffect(() => {
    if (!open) return undefined;
    cancelRef.current?.focus();
    const handleKeyDown = (event) => {
      if (event.key === 'Escape' && !loading) onClose?.();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [loading, onClose, open]);

  if (!open || !user || typeof document === 'undefined') return null;
  const displayName = user.name || user.displayName || user.email || 'Usuário sem nome';

  return createPortal(
    <div className="fixed inset-0 z-[10080] flex items-center justify-center bg-zinc-950/70 p-4 backdrop-blur-sm" onMouseDown={(event) => { if (event.target === event.currentTarget && !loading) onClose?.(); }}>
      <div role="alertdialog" aria-modal="true" aria-labelledby="admin-user-action-title" aria-describedby="admin-user-action-description" className="relative w-full max-w-md overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-2xl dark:border-zinc-700 dark:bg-zinc-900">
        <div className="h-1 bg-red-600" />
        <button type="button" onClick={onClose} disabled={loading} className="absolute right-3 top-4 flex h-9 w-9 items-center justify-center rounded-xl text-zinc-400 transition hover:bg-zinc-100 hover:text-zinc-700 disabled:opacity-40 dark:hover:bg-zinc-800 dark:hover:text-white" aria-label="Fechar confirmação"><X size={18}/></button>
        <div className="p-5 sm:p-6">
          <div className="flex items-start gap-4 pr-8">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-red-50 text-red-600 dark:bg-red-950/40 dark:text-red-400"><Icon size={22}/></span>
            <div className="min-w-0">
              <p className="text-[9px] font-black uppercase tracking-[0.16em] text-red-600 dark:text-red-400">{config.eyebrow}</p>
              <h2 id="admin-user-action-title" className="mt-1 text-xl font-black tracking-tight text-zinc-950 dark:text-white">{config.title}</h2>
            </div>
          </div>

          <div className="mt-5 rounded-xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-950/50">
            <p className="truncate text-sm font-black text-zinc-900 dark:text-white">{displayName}</p>
            <p className="mt-0.5 truncate text-xs font-semibold text-zinc-500">{user.email || 'E-mail não informado'}</p>
          </div>

          <div className="mt-4 flex gap-2.5 rounded-xl border border-red-200 bg-red-50 p-3 text-red-800 dark:border-red-900/50 dark:bg-red-950/25 dark:text-red-300">
            <AlertTriangle size={17} className="mt-0.5 shrink-0"/>
            <p id="admin-user-action-description" className="text-xs font-semibold leading-relaxed">{config.description}</p>
          </div>

          <div className="mt-6 grid grid-cols-2 gap-3">
            <button ref={cancelRef} type="button" onClick={onClose} disabled={loading} className="h-11 rounded-xl border border-zinc-200 text-xs font-black uppercase tracking-wide text-zinc-600 transition hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800">Cancelar</button>
            <button type="button" onClick={onConfirm} disabled={loading} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-red-600 px-3 text-xs font-black uppercase tracking-wide text-white transition hover:bg-red-700 disabled:cursor-wait disabled:opacity-60">
              {loading ? <Loader2 size={15} className="animate-spin"/> : <Icon size={15}/>} {loading ? 'Processando' : config.confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
};

export default AdminUserActionConfirmModal;
