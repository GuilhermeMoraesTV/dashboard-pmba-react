import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  MessageSquare, X, Plus, ArrowLeft, ArrowRight, Send,
  CheckCircle2, Clock, Bug, FileText, Lightbulb, HelpCircle, Loader2, Paperclip
} from 'lucide-react';
import { useSupportTickets, useSupportUser } from '../hooks/useSupport.js';
import { supportAttempt, validateLocalImage } from '../services/support/supportService.js';
import { validateSupportFiles, SUPPORT_LIMITS as L } from '../services/support/supportCore.js';
import SupportConversation from './support/SupportConversation.jsx';

const TYPES = [
  { id: 'edital', label: 'Solicitar Edital', desc: 'Peça novos editais', icon: FileText, color: 'bg-amber-50 dark:bg-amber-950/30 text-amber-600 border-amber-200 dark:border-amber-800' },
  { id: 'ideia', label: 'Sugestão', desc: 'Ideias de melhorias', icon: Lightbulb, color: 'bg-purple-50 dark:bg-purple-950/30 text-purple-600 border-purple-200 dark:border-purple-800' },
  { id: 'bug', label: 'Problema', desc: 'Reporte erros do sistema', icon: Bug, color: 'bg-rose-50 dark:bg-rose-950/30 text-rose-600 border-rose-200 dark:border-rose-800' },
  { id: 'duvida', label: 'Dúvida', desc: 'Ajuda e orientações', icon: HelpCircle, color: 'bg-blue-50 dark:bg-blue-950/30 text-blue-600 border-blue-200 dark:border-blue-800' },
];

export default function FeedbackWidget({ user, isOpen, onClose, isSidebarOpen, initialView = 'home', initialType = 'ideia', initialTicketId = null }) {
  const authenticated = useSupportUser();
  const [view, setView] = useState(initialTicketId ? 'chat' : initialView);
  const [newType, setNewType] = useState(initialType);
  const [newMsg, setNewMsg] = useState('');
  const [newFiles, setNewFiles] = useState([]);
  const [activeTicketId, setActiveTicketId] = useState(initialTicketId);
  const [sending, setSending] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const { rows: myTickets, more, error: ticketsError, loadMore } = useSupportTickets(isOpen, authenticated?.uid);
  const fileInputRef = useRef(null);
  const newAttempt = useRef(null);

  useEffect(() => {
    if (isOpen) {
      if (initialTicketId) {
        setActiveTicketId(initialTicketId);
        setView('chat');
      } else {
        setActiveTicketId(null);
        setView(initialView);
      }
      setNewType(initialType);
      setErrorMessage('');
    }
  }, [isOpen, initialView, initialType, initialTicketId]);

  useEffect(() => {
    if (isSidebarOpen && isOpen) onClose();
  }, [isSidebarOpen, isOpen, onClose]);

  const handleSelectFiles = async (e) => {
    const picked = Array.from(e.target.files || []);
    e.target.value = '';
    setErrorMessage('');
    try {
      validateSupportFiles([...newFiles.map((item) => item.file), ...picked]);
      for (const file of picked) await validateLocalImage(file);
      const next = [
        ...newFiles,
        ...picked.map((file) => ({
          file,
          url: URL.createObjectURL(file),
          id: crypto.randomUUID(),
        })),
      ];
      setNewFiles(next);
    } catch (err) {
      setErrorMessage(err.message || 'Imagem inválida.');
    }
  };

  const handleRemoveFile = (item) => {
    URL.revokeObjectURL(item.url);
    setNewFiles((prev) => prev.filter((f) => f.id !== item.id));
  };

  const formatFriendlyError = (err) => {
    if (!err) return 'Erro ao enviar chamado. Tente novamente.';
    const code = String(err?.code || '').toLowerCase();
    const rawMsg = String(err?.message || '').toLowerCase();
    if (rawMsg.includes('imagem') || rawMsg.includes('megapixels') || rawMsg.includes('jpeg') || rawMsg.includes('formato') || rawMsg.includes('animad') || rawMsg.includes('5 mb')) {
      return err.message;
    }
    if (rawMsg.includes('limite') || code.includes('resource-exhausted')) {
      return 'Limite de envios atingido. Aguarde alguns instantes antes de tentar novamente.';
    }
    if (code.includes('unauthenticated') || rawMsg.includes('autentica') || rawMsg.includes('login')) {
      return 'Sua sessão expirou. Faça login novamente para enviar solicitações.';
    }
    if (code.includes('permission-denied') || rawMsg.includes('permissão') || rawMsg.includes('negado')) {
      return 'Você não tem permissão para realizar esta operação.';
    }
    if (code.includes('unavailable') || code.includes('internal') || rawMsg.includes('internal') || rawMsg.includes('failed-precondition')) {
      return 'Não foi possível concluir o envio agora. Tente novamente em instantes.';
    }
    if (err?.message && !err.message.toLowerCase().includes('internal')) {
      return err.message;
    }
    return 'Não foi possível enviar o chamado. Verifique sua conexão e tente novamente.';
  };

  const handleCreateTicket = async () => {
    if (!newMsg.trim() || sending) return;
    setSending(true);
    setErrorMessage('');
    if (!newAttempt.current) newAttempt.current = supportAttempt();
    try {
      const result = await newAttempt.current.send({
        type: newType,
        text: newMsg,
        files: newFiles.map((f) => f.file),
      });
      newFiles.forEach((f) => URL.revokeObjectURL(f.url));
      setNewFiles([]);
      setNewMsg('');
      setActiveTicketId(result.ticketId);
      setView('chat');
    } catch (err) {
      setErrorMessage(formatFriendlyError(err));
    } finally {
      setSending(false);
    }
  };

  if (!isOpen || !authenticated || authenticated.uid !== user?.uid) return null;

  const hasUnread = myTickets.some((t) => t.unreadUser);

  const widgetContent = (
    <div className="fixed bottom-[calc(1rem+env(safe-area-inset-bottom,0px))] right-4 sm:bottom-[calc(1.5rem+env(safe-area-inset-bottom,0px))] sm:right-6 z-[100070] font-sans pointer-events-none">
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="pointer-events-auto w-[calc(100vw-2rem)] sm:w-[380px] h-[550px] max-h-[calc(100vh-5rem)] bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl shadow-2xl flex flex-col overflow-hidden text-zinc-900 dark:text-white"
          >
            {/* Header */}
            {view !== 'chat' && (
              <div className="p-4 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between bg-white/80 dark:bg-zinc-900/80 backdrop-blur-md z-10">
                <div className="flex items-center gap-2">
                  {view !== 'home' && (
                    <button
                      onClick={() => {
                        setErrorMessage('');
                        setView(view === 'chat' ? 'list' : 'home');
                      }}
                      className="p-1 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-full transition-colors"
                      aria-label="Voltar"
                    >
                      <ArrowLeft size={18} className="text-zinc-500" />
                    </button>
                  )}
                  <div>
                    <h3 className="font-bold text-sm text-zinc-900 dark:text-white">
                      {view === 'home' && 'Central de Ajuda'}
                      {view === 'new' && 'Novo Chamado'}
                      {view === 'list' && 'Minhas Mensagens'}
                    </h3>
                    <p className="text-[10px] text-zinc-400">
                      {view === 'home' && 'Como podemos te ajudar hoje?'}
                      {view === 'new' && 'Preencha os dados abaixo'}
                      {view === 'list' && 'Acompanhe suas solicitações'}
                    </p>
                  </div>
                </div>
                <button
                  onClick={onClose}
                  className="p-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-full text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 transition-colors"
                  aria-label="Fechar"
                >
                  <X size={18} />
                </button>
              </div>
            )}

            {/* Error banner */}
            {(errorMessage || ticketsError) && (
              <div className="bg-red-50 dark:bg-red-950/30 px-4 py-2 border-b border-red-100 dark:border-red-900/40 text-[11px] text-red-600 dark:text-red-400 font-medium">
                {errorMessage || ticketsError}
              </div>
            )}

            {/* View: Home */}
            {view === 'home' && (
              <div className="flex-1 p-5 flex flex-col justify-center gap-3 bg-zinc-50 dark:bg-zinc-950">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setView('new')}
                  className="p-5 bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 rounded-2xl flex items-center justify-between text-left shadow-sm hover:border-zinc-300 dark:hover:border-zinc-700 transition-all group"
                >
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-red-50 dark:bg-red-950/40 text-red-600 rounded-xl group-hover:scale-110 transition-transform">
                      <Plus size={24} />
                    </div>
                    <div>
                      <h4 className="font-bold text-sm text-zinc-900 dark:text-white">Abrir Novo Chamado</h4>
                      <p className="text-xs text-zinc-400 mt-0.5">Dúvidas, sugestões ou problemas</p>
                    </div>
                  </div>
                  <ArrowRight size={18} className="text-zinc-300 dark:text-zinc-600 group-hover:translate-x-1 transition-transform" />
                </motion.button>

                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setView('list')}
                  className="p-5 bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 rounded-2xl flex items-center justify-between text-left shadow-sm hover:border-zinc-300 dark:hover:border-zinc-700 transition-all group"
                >
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 rounded-xl group-hover:scale-110 transition-transform relative">
                      <MessageSquare size={24} />
                      {hasUnread && (
                        <span className="absolute top-2 right-2 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white dark:border-zinc-900" />
                      )}
                    </div>
                    <div>
                      <h4 className="font-bold text-sm text-zinc-900 dark:text-white flex items-center gap-2">
                        Minhas Mensagens
                        {hasUnread && (
                          <span className="text-[10px] font-bold text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/40 px-1.5 py-0.5 rounded-full">
                            Novo
                          </span>
                        )}
                      </h4>
                      <p className="text-xs text-zinc-400 mt-0.5">
                        {myTickets.length ? `${myTickets.length} chamado(s) registrado(s)` : 'Nenhum chamado ativo'}
                      </p>
                    </div>
                  </div>
                  <ArrowRight size={18} className="text-zinc-300 dark:text-zinc-600 group-hover:translate-x-1 transition-transform" />
                </motion.button>
              </div>
            )}

            {/* View: List */}
            {view === 'list' && (
              <div className="flex-1 flex flex-col bg-zinc-50 dark:bg-zinc-950 min-h-0">
                <div className="flex-1 overflow-y-auto p-4 space-y-2.5 custom-scrollbar">
                  {!myTickets.length ? (
                    <div className="h-full flex flex-col items-center justify-center text-center p-6 text-zinc-400">
                      <MessageSquare size={36} className="text-zinc-300 dark:text-zinc-700 mb-2" />
                      <p className="text-sm font-semibold text-zinc-600 dark:text-zinc-300">Nenhum chamado encontrado</p>
                      <p className="text-xs text-zinc-400 mt-1">Abra um chamado caso precise de suporte.</p>
                    </div>
                  ) : (
                    myTickets.map((ticket) => (
                      <motion.button
                        key={ticket.id}
                        whileHover={{ scale: 1.01 }}
                        whileTap={{ scale: 0.99 }}
                        onClick={() => {
                          setActiveTicketId(ticket.id);
                          setView('chat');
                        }}
                        className={`w-full p-4 rounded-2xl border text-left transition-all shadow-sm group bg-white dark:bg-zinc-900 ${
                          ticket.unreadUser
                            ? 'border-red-400 dark:border-red-500/50 ring-1 ring-red-400/20'
                            : 'border-zinc-200/80 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[10px] font-black uppercase tracking-wide text-zinc-400">
                            {ticket.type}
                          </span>
                          <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full flex items-center gap-1 border ${
                            ticket.status === 'resolvido'
                              ? 'bg-emerald-50 text-emerald-600 border-emerald-200 dark:bg-emerald-950/30 dark:border-emerald-800'
                              : 'bg-amber-50 text-amber-600 border-amber-200 dark:bg-amber-950/30 dark:border-amber-800'
                          }`}>
                            {ticket.status === 'resolvido' ? <CheckCircle2 size={10} /> : <Clock size={10} />}
                            {ticket.status}
                          </span>
                        </div>
                        <div className="flex justify-between items-center mt-2.5">
                          <p className={`text-xs line-clamp-1 flex-1 ${ticket.unreadUser ? 'font-bold text-zinc-900 dark:text-white' : 'font-medium text-zinc-500 dark:text-zinc-400'}`}>
                            {ticket.preview || ticket.message || 'Ver mensagens...'}
                          </p>
                          <ArrowRight size={14} className="text-zinc-300 dark:text-zinc-600 group-hover:translate-x-1 transition-transform ml-2" />
                        </div>
                      </motion.button>
                    ))
                  )}
                  {more && (
                    <button onClick={loadMore} className="w-full py-2 text-xs text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 underline">
                      Carregar chamados anteriores
                    </button>
                  )}
                </div>
                <div className="p-4 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-md border-t border-zinc-100 dark:border-zinc-800 shrink-0">
                  <button
                    onClick={() => setView('new')}
                    className="w-full py-3 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 rounded-xl font-bold text-sm flex items-center justify-center gap-2 hover:scale-[1.02] active:scale-[0.98] transition-all shadow-lg"
                  >
                    <Plus size={18} /> Abrir Novo Chamado
                  </button>
                </div>
              </div>
            )}

            {/* View: New Ticket */}
            {view === 'new' && (
              <div className="flex-1 flex flex-col p-5 overflow-y-auto bg-zinc-50 dark:bg-zinc-950 min-h-0 custom-scrollbar">
                <div className="grid grid-cols-2 gap-2.5 mb-4 shrink-0">
                  {TYPES.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setNewType(t.id)}
                      className={`flex flex-col items-start gap-1.5 p-3 rounded-2xl border-2 transition-all duration-200 shadow-sm ${
                        newType === t.id
                          ? `${t.color} ring-1 ring-inset ring-black/5 dark:ring-white/5`
                          : 'border-white dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-400 hover:border-zinc-200'
                      }`}
                    >
                      <t.icon size={18} />
                      <div className="text-left">
                        <span className="block text-[10px] font-black uppercase tracking-wide">{t.label}</span>
                        <span className="block text-[9px] opacity-70 font-medium">{t.desc}</span>
                      </div>
                    </button>
                  ))}
                </div>

                <div className="flex-1 flex flex-col space-y-1.5 min-h-0">
                  <div className="flex items-center justify-between px-1">
                    <label className="text-[10px] font-bold uppercase text-zinc-400">Descrição</label>
                    <div className="flex items-center gap-1.5">
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        multiple
                        hidden
                        onChange={handleSelectFiles}
                      />
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={sending || newFiles.length >= L.maxAttachments}
                        className="flex items-center gap-1 text-[11px] font-semibold text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 disabled:opacity-40 transition-colors"
                        title="Anexar imagem (máx. 3)"
                      >
                        <Paperclip size={14} />
                        <span>Anexar ({newFiles.length}/3)</span>
                      </button>
                    </div>
                  </div>

                  <textarea
                    value={newMsg}
                    onChange={(e) => setNewMsg(e.target.value)}
                    placeholder={
                      newType === 'edital'
                        ? 'Ex: PM-BA Soldado 2025, banca CEBRASPE...'
                        : 'Descreva sua solicitação com detalhes...'
                    }
                    className="w-full flex-1 min-h-[110px] p-3.5 text-sm bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl resize-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-white outline-none dark:text-white transition-all shadow-sm"
                  />

                  {/* Selected images preview with circular loader */}
                  {newFiles.length > 0 && (
                    <div className="flex flex-wrap gap-2 pt-1.5">
                      {newFiles.map((item, index) => (
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
                            <button
                              type="button"
                              onClick={() => handleRemoveFile(item)}
                              aria-label={`Remover anexo ${index + 1}`}
                              className="absolute top-0.5 right-0.5 rounded-full bg-zinc-900/80 hover:bg-zinc-900 text-white p-0.5 transition-all"
                            >
                              <X size={10} />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <button
                  type="button"
                  onClick={handleCreateTicket}
                  disabled={!newMsg.trim() || sending}
                  className="w-full py-3 mt-4 bg-red-600 text-white rounded-xl font-bold text-sm flex items-center justify-center gap-2 hover:bg-red-500 hover:shadow-xl hover:shadow-red-500/20 disabled:opacity-50 disabled:shadow-none transition-all active:scale-95 shrink-0"
                >
                  {sending ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />} Enviar Solicitação
                </button>
              </div>
            )}

            {/* View: Chat */}
            {view === 'chat' && activeTicketId && (
              <SupportConversation
                key={`${authenticated.uid}/${activeTicketId}`}
                ticketId={activeTicketId}
                user={authenticated}
                admin={false}
                onBack={() => {
                  setActiveTicketId(null);
                  setView('list');
                }}
              />
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );

  if (typeof document === 'undefined') return widgetContent;

  return createPortal(widgetContent, document.body);
}

