import React, { useEffect, useRef, useState } from 'react';
import { Paperclip, Send, X, Check, Loader2 } from 'lucide-react';
import { SUPPORT_LIMITS as L, validateSupportFiles, shouldSendOnEnter, createTypingTransitions } from '../../services/support/supportCore.js';
import { supportAttempt, validateLocalImage, manageSupportTicket } from '../../services/support/supportService.js';

export default function SupportComposer({
  ticketId,
  type,
  disabled = false,
  onSent,
  editing,
  onCancelEdit,
  onEdited,
  variant = 'widget',
  role,
  admin = false,
  placeholder,
}) {
  const [text, setText] = useState(editing?.text || '');
  const [files, setFiles] = useState([]);
  const [error, setError] = useState('');
  const [sending, setSending] = useState(false);
  const [selecting, setSelecting] = useState(false);

  const sender = variant === 'admin' || role === 'admin' || admin ? 'admin' : 'user';

  const attempt = useRef(null);
  const busy = useRef(false);
  const previews = useRef([]);
  const input = useRef(null);
  const typing = useRef(false);
  const timer = useRef(null);
  const mounted = useRef(true);

  if (!attempt.current) attempt.current = supportAttempt();
  const transitions = useRef(null);
  if (!transitions.current) {
    transitions.current = createTypingTransitions((next) =>
      manageSupportTicket({ ticketId, action: 'presence', typing: next, role: sender, admin: sender === 'admin' })
    );
  }

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      previews.current.forEach((item) => URL.revokeObjectURL(item.url));
      clearTimeout(timer.current);
      if (typing.current && ticketId) transitions.current(false).catch(() => {});
    };
  }, [ticketId]);

  const stopTyping = () => {
    clearTimeout(timer.current);
    if (typing.current && ticketId) {
      typing.current = false;
      transitions.current(false).catch(() => {});
    }
  };

  const changeText = (value) => {
    setText(value);
    if (!ticketId || editing) return;
    clearTimeout(timer.current);
    if (value.trim() && !typing.current) {
      typing.current = true;
      transitions.current(true).catch(() => {});
    }
    if (!value.trim()) stopTyping();
    else timer.current = setTimeout(stopTyping, 2000);
  };

  const select = async (event) => {
    const picked = Array.from(event.target.files || []);
    event.target.value = '';
    setError('');
    setSelecting(true);
    try {
      validateSupportFiles([...files.map((item) => item.file), ...picked]);
      for (const file of picked) await validateLocalImage(file);
      if (!mounted.current) return;
      const next = [
        ...files,
        ...picked.map((file) => ({
          file,
          url: URL.createObjectURL(file),
          id: crypto.randomUUID(),
        })),
      ];
      previews.current = next;
      setFiles(next);
    } catch (err) {
      if (mounted.current) setError(err.message || 'Imagem inválida.');
    } finally {
      if (mounted.current) setSelecting(false);
    }
  };

  const remove = (item) => {
    URL.revokeObjectURL(item.url);
    const next = files.filter((file) => file !== item);
    previews.current = next;
    setFiles(next);
  };

  const send = async (event) => {
    event?.preventDefault();
    if (
      busy.current ||
      disabled ||
      selecting ||
      (!text.trim() && (!files.length || !ticketId) && !editing?.attachments?.length)
    ) {
      return;
    }
    busy.current = true;
    setSending(true);
    setError('');
    stopTyping();
    try {
      if (editing) {
        await manageSupportTicket({ ticketId, action: 'edit', messageId: editing.id, text });
        onEdited?.(editing.id, text);
        return;
      }
      const result = await attempt.current.send(
        {
          ticketId,
          type,
          text,
          files: files.map((item) => item.file),
          sender,
          role: sender,
          admin: sender === 'admin',
        },
        () => {}
      );
      if (!mounted.current) return;
      previews.current.forEach((item) => URL.revokeObjectURL(item.url));
      previews.current = [];
      setFiles([]);
      setText('');
      onSent?.(result);
    } catch (err) {
      if (mounted.current) {
        const code = String(err?.code || '').toLowerCase();
        const rawMsg = String(err?.message || '').toLowerCase();
        let friendly = 'Falha no envio. Tente novamente.';
        if (rawMsg.includes('imagem') || rawMsg.includes('megapixels') || rawMsg.includes('jpeg') || rawMsg.includes('formato') || rawMsg.includes('animad') || rawMsg.includes('5 mb')) {
          friendly = err.message;
        } else if (rawMsg.includes('limite') || code.includes('resource-exhausted')) {
          friendly = 'Limite de envios atingido. Aguarde alguns instantes.';
        } else if (code.includes('unauthenticated') || rawMsg.includes('autentica') || rawMsg.includes('login')) {
          friendly = 'Sua sessão expirou. Faça login novamente.';
        } else if (code.includes('permission-denied') || rawMsg.includes('permissão') || rawMsg.includes('negado')) {
          friendly = 'Você não tem permissão para realizar esta operação.';
        } else if (code.includes('unavailable') || code.includes('internal') || rawMsg.includes('internal') || rawMsg.includes('failed-precondition')) {
          friendly = 'Não foi possível enviar a mensagem agora. Tente novamente em instantes.';
        } else if (err?.message && !err.message.toLowerCase().includes('internal')) {
          friendly = err.message;
        }
        setError(friendly);
      }
    } finally {
      busy.current = false;
      if (mounted.current) setSending(false);
    }
  };

  const locked = disabled || sending || selecting;
  const isAdmin = variant === 'admin';

  return (
    <div className={`shrink-0 bg-white dark:bg-zinc-900 ${isAdmin ? 'border-t border-zinc-100 dark:border-zinc-700 p-4 md:p-6' : 'border-t border-zinc-100 dark:border-zinc-800 p-3 shadow-lg z-20'}`}>
      {editing && (
        <div className="mb-2 flex items-center justify-between text-xs px-1 text-zinc-500">
          <span className="font-semibold text-red-600 dark:text-red-400">Editando mensagem</span>
          <button type="button" onClick={onCancelEdit} aria-label="Cancelar edição" className="p-1 hover:text-zinc-900 dark:hover:text-white">
            <X size={14} />
          </button>
        </div>
      )}

      {!editing && files.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-2 px-1">
          {files.map((item, index) => (
            <div key={item.id} className="relative h-12 w-12 rounded-xl overflow-hidden border border-zinc-200 dark:border-zinc-700 bg-zinc-100 dark:bg-zinc-800 shrink-0">
              <img src={item.url} alt={`Anexo ${index + 1}`} className="h-full w-full object-cover" />
              {sending && (
                <div className="absolute inset-0 bg-black/60 backdrop-blur-[1px] flex items-center justify-center">
                  <svg className="h-5 w-5 animate-spin text-white" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
                    <path className="opacity-90" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                </div>
              )}
              {!sending && (
                <button type="button" onClick={() => remove(item)} aria-label={`Remover anexo ${index + 1}`} className="absolute top-0.5 right-0.5 rounded-full bg-zinc-900/80 hover:bg-zinc-900 text-white p-0.5 transition-all">
                  <X size={10} />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {error && <p role="alert" className="text-xs text-red-600 dark:text-red-400 mb-2 px-1">{error}</p>}

      <form onSubmit={send} className={`flex items-center gap-2 ${isAdmin ? 'rounded-3xl' : ''}`}>
        {!editing && (
          <>
            <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" multiple hidden onChange={select} />
            <button
              type="button"
              onClick={() => input.current?.click()}
              disabled={locked || files.length >= L.maxAttachments}
              className={`p-2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 transition-colors disabled:opacity-40 shrink-0 ${isAdmin ? 'p-3' : ''}`}
              title="Anexar imagem (máx. 3)"
              aria-label="Anexar imagem"
            >
              <Paperclip size={isAdmin ? 20 : 19} />
            </button>
          </>
        )}

        {isAdmin ? (
          <div className={`flex-1 rounded-3xl border transition-all flex items-center px-2 ${editing ? 'bg-amber-50 border-amber-200 dark:bg-amber-950/30' : 'bg-zinc-100 dark:bg-zinc-800 border-transparent focus-within:bg-white dark:focus-within:bg-black focus-within:shadow-md'}`}>
            <textarea
              aria-label="Mensagem"
              value={text}
              onChange={(e) => changeText(e.target.value)}
              onKeyDown={(e) => {
                if (shouldSendOnEnter(e.nativeEvent, window.matchMedia('(pointer: coarse), (max-width: 767px)').matches)) send(e);
              }}
              disabled={locked}
              maxLength={L.maxTextChars}
              rows={1}
              placeholder={disabled ? 'Este chamado foi resolvido.' : placeholder || (editing ? 'Editando mensagem...' : 'Escreva uma resposta...')}
              className="w-full bg-transparent border-none px-4 py-3.5 text-sm focus:ring-0 outline-none resize-none max-h-32 min-h-[50px] leading-relaxed dark:text-white"
            />
          </div>
        ) : (
          <textarea
            aria-label={ticketId ? 'Mensagem' : 'Descrição do chamado'}
            value={text}
            onChange={(e) => changeText(e.target.value)}
            onKeyDown={(e) => {
              if (shouldSendOnEnter(e.nativeEvent, window.matchMedia('(pointer: coarse), (max-width: 767px)').matches)) send(e);
            }}
            disabled={locked}
            maxLength={L.maxTextChars}
            rows={1}
            placeholder={disabled ? 'Este chamado foi resolvido.' : placeholder || (ticketId ? 'Digite sua mensagem...' : 'Descreva sua solicitação com detalhes...')}
            className="flex-1 bg-zinc-100 dark:bg-zinc-800 border-transparent focus:bg-white dark:focus:bg-black focus:border-zinc-300 dark:focus:border-zinc-700 rounded-xl px-4 py-2.5 text-sm focus:ring-0 outline-none dark:text-white transition-all disabled:opacity-50 resize-none max-h-28 leading-relaxed"
          />
        )}

        <button
          type="submit"
          disabled={locked || (!text.trim() && (!ticketId || (!files.length && !editing?.attachments?.length)))}
          aria-label={editing ? 'Salvar edição' : 'Enviar mensagem'}
          className={
            isAdmin
              ? `p-3.5 text-white rounded-full shadow-lg transition-all shrink-0 ${editing ? 'bg-amber-500 hover:bg-amber-600' : 'bg-red-600 hover:bg-red-500'} disabled:opacity-50 disabled:scale-100`
              : 'p-3 bg-red-600 text-white rounded-xl hover:bg-red-500 hover:scale-105 disabled:opacity-50 disabled:scale-100 disabled:bg-zinc-300 dark:disabled:bg-zinc-700 transition-all shadow-md shadow-red-600/20 shrink-0'
          }
        >
          {sending || selecting ? (
            <Loader2 size={isAdmin ? 20 : 18} className="animate-spin" />
          ) : editing ? (
            <Check size={isAdmin ? 20 : 18} />
          ) : (
            <Send size={isAdmin ? 20 : 18} fill="currentColor" className="ml-0.5" />
          )}
        </button>
      </form>
    </div>
  );
}
