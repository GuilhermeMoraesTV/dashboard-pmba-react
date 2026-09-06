import React, { useEffect, useRef, useState } from 'react';
import { ArrowLeft, Check, Trash2, CheckCircle2, Clock } from 'lucide-react';
import { useSupportConversation } from '../../hooks/useSupport.js';
import { createPrivateImageCache, timestampMs } from '../../services/support/supportCore.js';
import { loadSupportImage, manageSupportTicket } from '../../services/support/supportService.js';
import SupportComposer from './SupportComposer.jsx';
import SupportMessage from './SupportMessage.jsx';
import ConfirmModal from '../shared/ConfirmModal.jsx';

const TypingIndicator = () => (
  <div className="flex items-center gap-1.5 px-4 py-2.5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl rounded-bl-none shadow-sm w-fit animate-in fade-in duration-300">
    <span className="w-1.5 h-1.5 rounded-full bg-zinc-400 animate-bounce" style={{ animationDelay: '0ms' }} />
    <span className="w-1.5 h-1.5 rounded-full bg-zinc-400 animate-bounce" style={{ animationDelay: '150ms' }} />
    <span className="w-1.5 h-1.5 rounded-full bg-zinc-400 animate-bounce" style={{ animationDelay: '300ms' }} />
  </div>
);

export default function SupportConversation({ ticketId, user, admin = false, onBack }) {
  const { ticket, messages, more, loadMore, error, patchMessage } = useSupportConversation(ticketId, user.uid);
  const [cache, setCache] = useState(null);
  const [editing, setEditing] = useState(null);
  const [failure, setFailure] = useState('');
  const [deletion, setDeletion] = useState(null);
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(Date.now());

  const scroll = useRef(null);
  const marking = useRef(false);
  const atBottom = useRef(true);
  const role = admin ? 'admin' : 'user';
  const variant = admin ? 'admin' : 'widget';

  useEffect(() => {
    const next = createPrivateImageCache(loadSupportImage);
    setCache(next);
    return () => next.dispose();
  }, []);

  useEffect(() => {
    if (ticket?.deleted) cache?.dispose();
  }, [ticket?.deleted, cache]);

  const unread = admin ? ticket?.unreadAdmin : ticket?.unreadUser;
  useEffect(() => {
    if (!unread || marking.current || ticket?.deleted) return;
    marking.current = true;
    manageSupportTicket({ ticketId, action: 'presence', read: true, role, admin })
      .catch(() => {})
      .finally(() => { marking.current = false; });
  }, [unread, ticketId, ticket?.deleted, role, admin]);

  useEffect(() => {
    const expires = timestampMs(ticket?.attachmentsExpireAt);
    if (!expires) return;
    const timer = setTimeout(() => setNow(Date.now()), Math.max(0, expires - Date.now()) + 30);
    return () => clearTimeout(timer);
  }, [ticket?.attachmentsExpireAt]);

  useEffect(() => {
    if (atBottom.current && !editing && scroll.current) {
      scroll.current.scrollTop = scroll.current.scrollHeight;
    }
  }, [messages, editing]);

  const action = async (payload) => {
    if (busy) return;
    setBusy(true);
    setFailure('');
    try {
      await manageSupportTicket({ ticketId, ...payload });
      return true;
    } catch (err) {
      setFailure(err.message || 'Não foi possível concluir.');
      return false;
    } finally {
      setBusy(false);
    }
  };

  if (error || ticket?.deleted) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-center text-sm text-zinc-500">
        <p className="mb-4">{error || 'Chamado excluído.'}</p>
        <button
          onClick={onBack}
          className="px-4 py-2 bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-200 rounded-xl text-xs font-bold"
        >
          Voltar aos chamados
        </button>
      </div>
    );
  }

  if (!ticket) return <div className="flex-1 flex items-center justify-center p-6 text-xs text-zinc-400">Carregando chamado…</div>;

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col h-full">
      {/* Top Header */}
      {admin ? (
        <div className="z-20 flex items-center justify-between border-b border-zinc-100 bg-white/90 px-6 py-4 backdrop-blur-md dark:border-zinc-700 dark:bg-zinc-900/90 shrink-0">
          <div className="flex items-center gap-4">
            <button onClick={onBack} className="md:hidden p-2 -ml-2 text-zinc-500" aria-label="Voltar">
              <ArrowLeft size={20} />
            </button>
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-zinc-100 to-zinc-200 dark:from-zinc-800 dark:to-zinc-900 flex items-center justify-center text-sm font-black border border-zinc-200 text-zinc-600 dark:text-zinc-300">
              {ticket.userName?.substring(0, 2).toUpperCase() || 'US'}
            </div>
            <div className="min-w-0">
              <h4 className="font-bold text-sm text-zinc-900 dark:text-white truncate flex items-center gap-2">
                {ticket.userName}
              </h4>
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] text-zinc-400 truncate max-w-[200px]">{ticket.userEmail}</span>
                <span className={`text-[10px] font-bold uppercase ${ticket.status === 'resolvido' ? 'text-emerald-600' : 'text-amber-600'}`}>
                  {ticket.status}
                </span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              disabled={busy}
              title={ticket.status === 'resolvido' ? 'Reabrir chamado' : 'Resolver chamado'}
              aria-label={ticket.status === 'resolvido' ? 'Reabrir chamado' : 'Resolver chamado'}
              onClick={() => action({ action: 'status', status: ticket.status === 'resolvido' ? 'pendente' : 'resolvido' })}
              className={`p-2.5 rounded-xl transition-all shadow-sm ${
                ticket.status === 'resolvido'
                  ? 'bg-zinc-100 text-zinc-400 dark:bg-zinc-800'
                  : 'bg-emerald-50 text-emerald-600 border border-emerald-100 dark:bg-emerald-950/30 dark:border-emerald-800'
              }`}
            >
              <Check size={18} />
            </button>
            <button
              aria-label="Excluir chamado"
              onClick={() => setDeletion({ action: 'deleteTicket' })}
              className="p-2.5 rounded-xl bg-white border border-zinc-200 text-zinc-400 hover:text-red-600 dark:bg-zinc-800 dark:border-zinc-700 transition-colors"
            >
              <Trash2 size={18} />
            </button>
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-between p-4 border-b border-zinc-100 dark:border-zinc-800 bg-white dark:bg-zinc-900 shrink-0">
          <div className="flex items-center gap-3">
            <button onClick={onBack} aria-label="Voltar aos chamados" className="p-1 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-full transition-colors">
              <ArrowLeft size={18} className="text-zinc-500" />
            </button>
            <div>
              <h3 className="font-bold text-sm text-zinc-900 dark:text-white">Atendimento</h3>
              <p className="text-[10px] text-zinc-400">Chamado #{ticket.id.substring(0, 6)}</p>
            </div>
          </div>
          <span className={`text-[9px] font-black uppercase px-2.5 py-1 rounded-full flex items-center gap-1 border ${
            ticket.status === 'resolvido'
              ? 'bg-emerald-50 text-emerald-600 border-emerald-200 dark:bg-emerald-950/30 dark:border-emerald-800'
              : 'bg-amber-50 text-amber-600 border-amber-200 dark:bg-amber-950/30 dark:border-amber-800'
          }`}>
            {ticket.status === 'resolvido' ? <Check size={10} /> : <Clock size={10} />}
            {ticket.status}
          </span>
        </div>
      )}

      {failure && <p role="alert" className="p-2 text-xs text-red-600 text-center bg-red-50 dark:bg-red-950/30">{failure}</p>}

      {/* Messages Timeline */}
      <div
        ref={scroll}
        onScroll={() => {
          const el = scroll.current;
          if (el) atBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
        }}
        className={`flex-1 overflow-y-auto space-y-4 p-4 custom-scrollbar ${
          admin ? 'bg-slate-50/50 dark:bg-zinc-800/45 md:p-8' : 'bg-zinc-100/50 dark:bg-black/40'
        }`}
      >
        <div className="flex justify-center my-2">
          <span className="text-[9px] font-bold text-zinc-400 bg-white dark:bg-zinc-900 px-3 py-1 rounded-full border border-zinc-100 dark:border-zinc-800 shadow-sm uppercase tracking-wide">
            Início do atendimento
          </span>
        </div>

        {more && (
          <div className="flex justify-center">
            <button
              onClick={() => { atBottom.current = false; loadMore(); }}
              className="text-xs text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 underline py-1"
            >
              Carregar mensagens anteriores
            </button>
          </div>
        )}

        {!more && ticket.message && (
          <div className="flex justify-start animate-fade-in-up">
            <div className="max-w-[85%] md:max-w-[70%] p-4 rounded-2xl rounded-tl-sm bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-sm shadow-sm text-zinc-700 dark:text-zinc-200 leading-relaxed">
              <span className="block text-[10px] font-bold uppercase text-zinc-400 mb-1">Mensagem Original</span>
              <div className="whitespace-pre-wrap [overflow-wrap:anywhere]">{ticket.message}</div>
            </div>
          </div>
        )}

        {messages.map((message) => (
          <SupportMessage
            key={message.id}
            message={message}
            ticket={ticket}
            cache={cache}
            role={role}
            now={now}
            variant={variant}
            onEdit={!message.deleted && message.senderUid === user.uid ? setEditing : undefined}
            onDelete={admin && message.sender === 'admin' ? (msg) => setDeletion({ action: 'deleteMessage', messageId: msg.id }) : undefined}
          />
        ))}

        {(admin ? ticket.userTyping : ticket.adminTyping) && (
          <div className="flex justify-start">
            <TypingIndicator />
          </div>
        )}

        {ticket.status === 'resolvido' && (
          <div className="flex justify-center py-4 opacity-90 animate-in zoom-in duration-300">
            <div className="flex flex-col items-center gap-2">
              <div className="w-10 h-10 bg-emerald-100 dark:bg-emerald-900/30 rounded-full flex items-center justify-center text-emerald-600 border-2 border-white dark:border-zinc-950 shadow-sm">
                <CheckCircle2 size={20} />
              </div>
              <p className="text-xs font-black text-zinc-600 dark:text-zinc-400 uppercase tracking-wide">Chamado Resolvido</p>
              <p className="text-[10px] text-zinc-400">Imagens disponíveis por até 15 dias após a resolução.</p>
            </div>
          </div>
        )}
      </div>

      {/* Input Composer */}
      <SupportComposer
        key={editing?.id || 'reply'}
        ticketId={ticketId}
        disabled={ticket.status === 'resolvido' && !editing}
        editing={editing}
        variant={variant}
        role={role}
        admin={admin}
        onCancelEdit={() => setEditing(null)}
        onEdited={(messageId, text) => {
          patchMessage(messageId, { text });
          setEditing(null);
        }}
        onSent={() => {
          atBottom.current = true;
        }}
      />

      <ConfirmModal
        isOpen={!!deletion}
        onClose={() => setDeletion(null)}
        title={deletion?.action === 'deleteTicket' ? 'Excluir chamado?' : 'Excluir mensagem?'}
        message={
          deletion?.action === 'deleteTicket'
            ? 'O chamado e todo o histórico serão removidos permanentemente.'
            : 'A mensagem será removida permanentemente do chamado.'
        }
        confirmText="Excluir"
        isDestructive
        onConfirm={async () => {
          if (await action(deletion)) {
            if (deletion.action === 'deleteTicket') {
              onBack();
            } else {
              patchMessage(deletion.messageId, { deleted: true });
              cache?.invalidate(`${deletion.messageId}/`);
            }
            setDeletion(null);
          }
        }}
      />
    </div>
  );
}

