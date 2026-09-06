import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, ZoomIn, ZoomOut, ChevronLeft, ChevronRight, Edit2, Trash2 } from 'lucide-react';
import { attachmentsExpired } from '../../services/support/supportCore.js';

function PrivateImage({ cache, ticketId, messageId, attachment, variant, onClick }) {
  const root = useRef(null);
  const [visible, setVisible] = useState(variant === 'image'), [url, setUrl] = useState(''), [error, setError] = useState('');
  useEffect(() => {
    if (visible) return;
    const observer = new IntersectionObserver((entries) => { if (entries.some((item) => item.isIntersecting)) { setVisible(true); observer.disconnect(); } }, { rootMargin: '180px' });
    if (root.current) observer.observe(root.current);
    return () => observer.disconnect();
  }, [visible]);
  useEffect(() => {
    if (!visible) return;
    if (attachment.dataUrl || attachment.directUrl) {
      setUrl(attachment.dataUrl || attachment.directUrl);
      return;
    }
    if (!cache) return;
    let current = true;
    cache.get(`${messageId}/${attachment.id}/${variant}`, { ticketId, messageId, attachmentId: attachment.id, variant, ...attachment })
      .then((value) => { if (current) setUrl(value); }).catch((err) => { if (current) setError(err.message); });
    return () => { current = false; };
  }, [cache, ticketId, messageId, attachment, variant, visible]);
  return <div ref={root} className={variant === 'thumbnail' ? 'min-h-20 min-w-20' : ''}>
    {error ? <span role="status" className="text-xs">{error}</span> : url ? variant === 'thumbnail'
      ? <button type="button" onClick={onClick} aria-label="Ampliar imagem"><img src={url} alt="Anexo do chamado" width={attachment.thumbnail?.width || 120} height={attachment.thumbnail?.height || 120} className="max-h-36 max-w-36 rounded-lg object-contain"/></button>
      : <img src={url} alt="Imagem ampliada do chamado" draggable={false} className="max-h-[75dvh] max-w-[90vw] select-none object-contain"/>
      : <span className="text-xs" role="status">Carregando imagem…</span>}
  </div>;
}
function Viewer({ cache, ticketId, message, initialIndex, onClose }) {
  const [index, setIndex] = useState(initialIndex), [zoom, setZoom] = useState(1), [pan, setPan] = useState({ x: 0, y: 0 });
  const dialog = useRef(null), drag = useRef(null), closeRef = useRef(onClose);
  closeRef.current = onClose;
  const go = (delta) => { setIndex((value) => (value + delta + message.attachments.length) % message.attachments.length); setZoom(1); setPan({ x: 0, y: 0 }); };
  useEffect(() => {
    const previous = document.activeElement; dialog.current.focus();
    const key = (event) => {
      if (event.key === 'Escape') { event.preventDefault(); event.stopImmediatePropagation(); closeRef.current(); }
      if (event.key === 'Tab') {
        const buttons = [...dialog.current.querySelectorAll('button')];
        if (event.shiftKey && (document.activeElement === buttons[0] || document.activeElement === dialog.current)) { event.preventDefault(); buttons.at(-1)?.focus(); }
        else if (!event.shiftKey && document.activeElement === buttons.at(-1)) { event.preventDefault(); buttons[0]?.focus(); }
      }
    };
    window.addEventListener('keydown', key, true);
    return () => { window.removeEventListener('keydown', key, true); previous?.focus?.(); };
  }, []);
  return createPortal(<div ref={dialog} role="dialog" aria-modal="true" aria-label="Visualizador de imagens" tabIndex={-1}
    className="fixed inset-0 z-[11000] flex flex-col items-center justify-center bg-black/90 text-white" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
    <div className="absolute top-4 z-10 flex items-center gap-4 rounded-2xl bg-black/80 p-3">
      <button aria-label="Imagem anterior" onClick={() => go(-1)} disabled={message.attachments.length < 2}><ChevronLeft/></button>
      <span>{index + 1}/{message.attachments.length}</span>
      <button aria-label="Próxima imagem" onClick={() => go(1)} disabled={message.attachments.length < 2}><ChevronRight/></button>
      <button aria-label="Diminuir zoom" onClick={() => { setZoom((z) => Math.max(1,z - 0.5)); setPan({ x:0,y:0 }); }}><ZoomOut/></button>
      <button aria-label="Aumentar zoom" onClick={() => setZoom((z) => Math.min(5,z + 0.5))}><ZoomIn/></button>
      <button aria-label="Fechar imagem" onClick={onClose}><X/></button>
    </div>
    <div className="touch-none cursor-grab" style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})` }}
      onPointerDown={(e) => { if (zoom > 1) { drag.current = { x:e.clientX-pan.x,y:e.clientY-pan.y }; e.currentTarget.setPointerCapture(e.pointerId); } }}
      onPointerMove={(e) => { if (drag.current) setPan({ x:e.clientX-drag.current.x,y:e.clientY-drag.current.y }); }} onPointerUp={() => { drag.current = null; }} onPointerCancel={() => { drag.current = null; }}>
      <PrivateImage key={message.attachments[index].id} cache={cache} ticketId={ticketId} messageId={message.id} attachment={message.attachments[index]} variant="image"/>
    </div>
    <p className="absolute bottom-4 text-xs text-white/70">Use + para ampliar e arraste para movimentar.</p>
  </div>, document.body);
}
export default function SupportMessage({
  message,
  ticket,
  cache,
  role,
  now,
  onEdit,
  onDelete,
  variant = 'widget',
}) {
  const [viewer, setViewer] = useState(null);
  const expired = attachmentsExpired(ticket, message, now);
  const attachments = message.attachments || [];

  useEffect(() => {
    if (expired) {
      cache?.invalidate(`${message.id}/`);
      setViewer(null);
    }
  }, [expired, cache, message.id]);

  if (message.deleted) return null;

  const system = message.sender === 'system';
  const mine = message.sender === role;
  const isAdminTheme = variant === 'admin';

  if (system) {
    return (
      <div className="flex justify-center my-4">
        <span className="bg-zinc-100 dark:bg-zinc-800 text-zinc-500 text-[10px] px-3 py-1 rounded-full font-medium">
          {message.text}
        </span>
      </div>
    );
  }

  const bubbleClasses = isAdminTheme
    ? mine
      ? 'bg-gradient-to-br from-red-600 to-red-700 text-white rounded-3xl rounded-tr-sm shadow-sm'
      : 'bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-200 rounded-3xl rounded-tl-sm shadow-sm'
    : mine
    ? 'bg-zinc-900 text-white rounded-2xl rounded-br-none dark:bg-white dark:text-zinc-950 shadow-sm'
    : 'bg-white border border-zinc-200 dark:bg-zinc-900 dark:border-zinc-800 dark:text-zinc-200 rounded-2xl rounded-bl-none shadow-sm';

  return (
    <div className={`flex ${mine ? 'justify-end' : 'justify-start'} group animate-in fade-in slide-in-from-bottom-2`}>
      <div className={`min-w-0 max-w-[85%] md:max-w-[70%] p-3.5 ${bubbleClasses} text-sm leading-relaxed relative`}>
        <div className="whitespace-pre-wrap [overflow-wrap:anywhere]">{message.text || ''}</div>
        {!!attachments.length && (
          expired ? (
            <p className="mt-2 text-xs italic opacity-70">Imagem expirada</p>
          ) : (
            <div className="mt-2.5 flex flex-wrap gap-2">
              {attachments.map((attachment, index) => (
                <PrivateImage
                  key={attachment.id}
                  cache={cache}
                  ticketId={ticket.id}
                  messageId={message.id}
                  attachment={attachment}
                  variant="thumbnail"
                  onClick={() => setViewer(index)}
                />
              ))}
            </div>
          )
        )}
        <div className="mt-1 flex items-center justify-end gap-2 text-[9px] opacity-60 font-medium">
          <span>
            {message.timestamp?.toDate
              ? message.timestamp.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
              : ''}
          </span>
          {onEdit && mine && (
            <button
              type="button"
              aria-label="Editar mensagem"
              onClick={() => onEdit(message)}
              className="hover:opacity-100 transition-opacity"
            >
              <Edit2 size={11} />
            </button>
          )}
          {onDelete && (
            <button
              type="button"
              aria-label="Excluir mensagem"
              onClick={() => onDelete(message)}
              className="hover:opacity-100 hover:text-red-300 transition-opacity"
            >
              <Trash2 size={11} />
            </button>
          )}
        </div>
      </div>
      {viewer !== null && !expired && (
        <Viewer
          cache={cache}
          ticketId={ticket.id}
          message={message}
          initialIndex={viewer}
          onClose={() => setViewer(null)}
        />
      )}
    </div>
  );
}
