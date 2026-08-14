import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X, Send, Plus, MessageSquare, ChevronLeft,
  CheckCircle2, Clock, FileText, Lightbulb, Bug, HelpCircle, Loader2, ArrowRight,
} from 'lucide-react';
import {
  collection, addDoc, serverTimestamp, query, where, orderBy, onSnapshot, updateDoc, deleteDoc, doc
} from 'firebase/firestore';
import { db } from '../firebaseConfig';

// ─── INDICADOR DE DIGITANDO ───────────────────────────────────────────────────
const TypingIndicator = () => (
  <motion.div
    initial={{ opacity: 0, y: 5 }}
    animate={{ opacity: 1, y: 0 }}
    className="flex items-center gap-1 p-3 bg-zinc-100 dark:bg-zinc-800 rounded-2xl rounded-tl-none w-fit shadow-sm mb-2 ml-1"
  >
    <span className="w-1.5 h-1.5 bg-zinc-400 rounded-full animate-bounce [animation-delay:-0.3s]" />
    <span className="w-1.5 h-1.5 bg-zinc-400 rounded-full animate-bounce [animation-delay:-0.15s]" />
    <span className="w-1.5 h-1.5 bg-zinc-400 rounded-full animate-bounce" />
    <span className="text-[10px] text-zinc-500 dark:text-zinc-400 ml-2 font-medium">Suporte digitando...</span>
  </motion.div>
);

// ─── TIPOS DE CHAMADO ─────────────────────────────────────────────────────────
const TYPES = [
  { id: 'edital',  label: 'Solicitar Edital', desc: 'Pedir novo concurso',   icon: FileText,    color: 'bg-purple-100 dark:bg-purple-900/30 border-purple-200 dark:border-purple-800 text-purple-700 dark:text-purple-300' },
  { id: 'ideia',   label: 'Sugestão',         desc: 'Melhoria para o app',   icon: Lightbulb,   color: 'bg-amber-100 dark:bg-amber-900/30 border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-300' },
  { id: 'bug',     label: 'Problema',         desc: 'Algo não funciona',      icon: Bug,         color: 'bg-red-100 dark:bg-red-900/30 border-red-200 dark:border-red-800 text-red-700 dark:text-red-300' },
  { id: 'duvida',  label: 'Dúvida',           desc: 'Sobre estudos/app',      icon: HelpCircle,  color: 'bg-blue-100 dark:bg-blue-900/30 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300' },
];

const getTypeIcon = (t) => {
  switch (t) {
    case 'edital': return <FileText  size={18} className="text-purple-600 dark:text-purple-400" />;
    case 'bug':    return <Bug       size={18} className="text-red-600 dark:text-red-400" />;
    case 'duvida': return <HelpCircle size={18} className="text-blue-600 dark:text-blue-400" />;
    default:       return <Lightbulb size={18} className="text-amber-600 dark:text-amber-400" />;
  }
};

// ─── COMPONENTE PRINCIPAL ─────────────────────────────────────────────────────
/**
 * Props:
 *   user           — usuário autenticado
 *   isOpen         — booleano que controla visibilidade
 *   onClose        — fecha o widget
 *   isSidebarOpen  — fecha widget quando sidebar abre (mobile)
 *
 *   initialView    — 'home' | 'new' (padrão: 'home')
 *                    Passa 'new' para abrir diretamente na tela de novo chamado
 *   initialType    — 'edital' | 'ideia' | 'bug' | 'duvida' (padrão: 'ideia')
 *                    Pré-seleciona o tipo quando initialView='new'
 */
const FeedbackWidget = ({
  user,
  isOpen,
  onClose,
  isSidebarOpen,
  initialView = 'home',
  initialType = 'ideia',
}) => {
  const [view,         setView]         = useState('home'); // home | list | new | chat
  const [myTickets,    setMyTickets]    = useState([]);
  const [activeTicket, setActiveTicket] = useState(null);

  const [newType, setNewType] = useState(initialType);
  const [newMsg,  setNewMsg]  = useState('');
  const [sending, setSending] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const [chatMessages, setChatMessages] = useState([]);
  const [replyText,    setReplyText]    = useState('');

  const scrollRef        = useRef(null);
  const typingTimeoutRef = useRef(null);

  // ── Quando o widget abre, respeita initialView / initialType ─────────────
  useEffect(() => {
    if (isOpen) {
      setView(initialView);
      setNewType(initialType);
    }
  }, [isOpen, initialView, initialType]);

  // ── Fecha quando sidebar abre (mobile) ────────────────────────────────────
  useEffect(() => {
    if (isSidebarOpen && isOpen) onClose();
  }, [isSidebarOpen, isOpen, onClose]);

  // ── Reset ao fechar (preserva rascunho) ───────────────────────────────────
  useEffect(() => {
    if (!isOpen) {
      const hasDraftNew   = newMsg.trim().length > 0;
      const hasDraftReply = replyText.trim().length > 0;
      setTimeout(() => {
        if (!hasDraftNew && !hasDraftReply) {
          setView('home');
          setActiveTicket(null);
          setNewMsg('');
          setReplyText('');
        }
      }, 300);
    }
  }, [isOpen, newMsg, replyText]);

  // ── Carrega tickets do usuário ────────────────────────────────────────────
  useEffect(() => {
    if (!user?.uid || !isOpen) return undefined;
    const q = query(
      collection(db, 'system_feedback'),
      where('uid', '==', user.uid),
      orderBy('timestamp', 'desc')
    );
    return onSnapshot(
      q,
      (snap) => {
        const tickets = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        setMyTickets(tickets);
        setActiveTicket((current) => {
          if (!current) return current;
          const updated = tickets.find(t => t.id === current.id);
          if (!updated) return current;
          if (
            updated.status === current.status
            && updated.adminTyping === current.adminTyping
            && updated.unreadUser === current.unreadUser
          ) return current;
          return { ...current, ...updated };
        });
      },
      (error) => {
        setMyTickets([]);
        setErrorMessage('Nao foi possivel carregar seus chamados agora. Tente novamente mais tarde.');
        console.warn('[Suporte] Falha ao carregar chamados:', error.code || error);
      }
    );
  }, [user?.uid, isOpen]);

  // ── Carrega mensagens do ticket ativo ─────────────────────────────────────
  useEffect(() => {
    if (!activeTicket?.id) return undefined;
    const q = query(
      collection(db, 'system_feedback', activeTicket.id, 'messages'),
      orderBy('timestamp', 'asc')
    );
    return onSnapshot(
      q,
      (snap) => {
        setChatMessages(snap.docs.map(d => d.data()));
        setTimeout(() => {
          if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }, 100);
      },
      (error) => {
        setChatMessages([]);
        setErrorMessage('Nao foi possivel carregar as mensagens deste chamado.');
        console.warn('[Suporte] Falha ao carregar mensagens:', error.code || error);
      }
    );
  }, [activeTicket?.id]);

  useEffect(() => {
    if (!activeTicket?.id || !activeTicket.unreadUser) return;
    updateDoc(doc(db, 'system_feedback', activeTicket.id), { unreadUser: false })
      .catch((error) => console.warn('[Suporte] Falha ao marcar chamado como lido:', error.code || error));
  }, [activeTicket?.id, activeTicket?.unreadUser]);

  const handleTyping = (e) => {
    const text = e.target.value;
    setReplyText(text);
    if (!activeTicket) return;
    if (!text.trim()) {
      updateDoc(doc(db, 'system_feedback', activeTicket.id), { userTyping: false });
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      return;
    }
    updateDoc(doc(db, 'system_feedback', activeTicket.id), { userTyping: true });
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      updateDoc(doc(db, 'system_feedback', activeTicket.id), { userTyping: false });
    }, 2000);
  };

  const handleCreateTicket = async (e) => {
    e.preventDefault();
    if (!newMsg.trim()) return;
    setErrorMessage('');
    setSending(true);
    try {
      const docRef = await addDoc(collection(db, 'system_feedback'), {
        uid:         user.uid,
        userName:    user.displayName || 'Usuário',
        userEmail:   user.email,
        type:        newType,
        preview:     newMsg.substring(0, 50) + '...',
        status:      'pendente',
        timestamp:   serverTimestamp(),
        lastUpdate:  serverTimestamp(),
        unreadAdmin: true,
        unreadUser:  false,
        userTyping:  false,
        adminTyping: false,
      });
      await addDoc(collection(db, 'system_feedback', docRef.id, 'messages'), {
        text:      newMsg,
        sender:    'user',
        timestamp: serverTimestamp(),
      });
      setNewMsg('');
      setSending(false);
      const newTicket = { id: docRef.id, type: newType, status: 'pendente', userName: user.displayName, unreadUser: false };
      setActiveTicket(newTicket);
      setView('chat');

      // A resposta do sistema/admin deve ser criada pelo painel ou backend.
      // O cliente comum nao escreve mais mensagens "system" por seguranca.
    } catch (err) {
      console.error(err);
      setErrorMessage('Nao foi possivel criar o chamado agora. Verifique sua conexao e tente novamente.');
      setSending(false);
    }
  };

  const handleSendReply = async (e) => {
    e.preventDefault();
    if (!replyText.trim() || !activeTicket) return;
    setErrorMessage('');
    try {
      await addDoc(collection(db, 'system_feedback', activeTicket.id, 'messages'), {
        text: replyText, sender: 'user', timestamp: serverTimestamp(),
      });
      await updateDoc(doc(db, 'system_feedback', activeTicket.id), {
        unreadAdmin: true, lastUpdate: serverTimestamp(), userTyping: false,
      });
      setReplyText('');
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    } catch (err) {
      console.error(err);
      setErrorMessage('Nao foi possivel enviar a mensagem agora.');
    }
  };

  return (
    <div className="fixed bottom-4 right-4 z-[9990] flex flex-col items-end pointer-events-none font-sans">
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ type: 'spring', stiffness: 350, damping: 25 }}
            className="support-card-zoom pointer-events-auto w-[90vw] max-w-[350px] h-[550px] bg-zinc-50 dark:bg-black rounded-[24px] shadow-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden flex flex-col ring-1 ring-black/5 relative"
          >
            {/* ── HEADER ── */}
            <div className="flex-none px-5 py-4 bg-white dark:bg-zinc-900 border-b border-zinc-100 dark:border-zinc-800 flex justify-between items-center z-20 shadow-sm">
              <div className="flex items-center gap-3">
                {view !== 'home' && (
                  <button
                    onClick={() => { if (view === 'chat') setView('list'); else setView('home'); setActiveTicket(null); }}
                    className="p-1.5 -ml-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-full transition-colors text-zinc-500"
                  >
                    <ChevronLeft size={20} />
                  </button>
                )}
                <div>
                  <h3 className="text-sm font-black text-zinc-900 dark:text-white leading-none tracking-tight">
                    {view === 'home' ? 'Central de Suporte'
                     : view === 'list' ? 'Meus Chamados'
                     : view === 'new'  ? 'Novo Chamado'
                     : 'Atendimento'}
                  </h3>
                  <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider mt-0.5">
                    {view === 'chat' && activeTicket ? activeTicket.type : 'Modo QAP'}
                  </p>
                </div>
              </div>
              <button onClick={onClose} className="p-2 bg-zinc-100 dark:bg-zinc-800 hover:bg-red-50 hover:text-red-500 rounded-full transition-colors text-zinc-400">
                <X size={18} />
              </button>
            </div>

            {/* ── VIEW: HOME ── */}
            {errorMessage && (
              <div className="mx-4 mt-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-[11px] font-bold leading-relaxed text-red-700 dark:border-red-900/40 dark:bg-red-950/25 dark:text-red-300">
                {errorMessage}
              </div>
            )}

            {view === 'home' && (
              <div className="flex-1 p-5 flex flex-col justify-center gap-3 bg-zinc-50 dark:bg-zinc-950">
                <motion.button
                  whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                  onClick={() => setView('new')}
                  className="flex flex-col items-center justify-center gap-3 p-6 rounded-[20px] bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-sm hover:shadow-lg hover:border-red-200 dark:hover:border-red-900/30 transition-all group"
                >
                  <div className="w-14 h-14 rounded-full bg-red-50 dark:bg-red-900/20 text-red-600 flex items-center justify-center group-hover:scale-110 transition-transform shadow-inner">
                    <Plus size={28} strokeWidth={2.5} />
                  </div>
                  <div className="text-center">
                    <h4 className="text-base font-black text-zinc-900 dark:text-white">Novo Chamado</h4>
                    <p className="text-[11px] text-zinc-500 mt-1 font-medium">
                      {newMsg ? <span className="text-red-500 font-bold">Rascunho salvo</span> : 'Dúvidas, sugestões ou problemas'}
                    </p>
                  </div>
                </motion.button>

                <motion.button
                  whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                  onClick={() => setView('list')}
                  className="flex flex-col items-center justify-center gap-3 p-6 rounded-[20px] bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-sm hover:shadow-lg hover:border-zinc-300 dark:hover:border-zinc-700 transition-all group relative overflow-hidden"
                >
                  {myTickets.some(t => t.unreadUser) && (
                    <span className="absolute top-5 right-5 flex h-3 w-3">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                      <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500" />
                    </span>
                  )}
                  <div className="w-14 h-14 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 flex items-center justify-center group-hover:scale-110 transition-transform shadow-inner">
                    <MessageSquare size={26} strokeWidth={2.5} />
                  </div>
                  <div className="text-center">
                    <h4 className="text-base font-black text-zinc-900 dark:text-white">Meus Chamados</h4>
                    <p className="text-[11px] text-zinc-500 mt-1 font-medium">Acompanhe suas solicitações</p>
                  </div>
                </motion.button>
              </div>
            )}

            {/* ── VIEW: LISTA ── */}
            {view === 'list' && (
              <div className="flex-1 flex flex-col bg-zinc-50 dark:bg-zinc-950 overflow-hidden">
                <div className="flex-1 overflow-y-auto p-4 custom-scrollbar space-y-3">
                  {myTickets.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-zinc-400 gap-4 opacity-60">
                      <MessageSquare size={48} strokeWidth={1.5} />
                      <p className="text-sm font-medium">Nenhum chamado aberto.</p>
                      <button onClick={() => setView('new')} className="text-xs font-bold text-red-600 hover:underline bg-red-50 px-3 py-1 rounded-full">Criar agora</button>
                    </div>
                  ) : myTickets.map(ticket => (
                    <div key={ticket.id} className="relative group">
                      <motion.button
                        initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                        onClick={() => { setActiveTicket(ticket); setView('chat'); }}
                        className={`w-full text-left p-4 rounded-2xl border transition-all relative overflow-hidden shadow-sm ${
                          ticket.unreadUser
                            ? 'bg-white dark:bg-zinc-900 border-red-200 dark:border-red-900/30 ring-1 ring-red-500/10'
                            : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 hover:border-zinc-300'
                        }`}
                      >
                        {ticket.unreadUser && <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-red-500" />}
                        <div className="flex justify-between items-start mb-2 pl-2">
                          <div className="flex items-center gap-2">
                            {getTypeIcon(ticket.type)}
                            <span className="text-[10px] font-black uppercase text-zinc-700 dark:text-zinc-300 tracking-wider">{ticket.type}</span>
                          </div>
                          {ticket.status === 'resolvido' ? (
                            <span className="flex items-center gap-1 text-[9px] font-black text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20 px-2 py-0.5 rounded-md">
                              <CheckCircle2 size={10} /> RESOLVIDO
                            </span>
                          ) : (
                            <span className="flex items-center gap-1 text-[9px] font-black text-amber-600 bg-amber-50 dark:bg-amber-900/20 px-2 py-0.5 rounded-md">
                              <Clock size={10} /> PENDENTE
                            </span>
                          )}
                        </div>
                        <div className="pl-2 flex justify-between items-center mt-3">
                          <p className={`text-xs line-clamp-1 flex-1 ${ticket.unreadUser ? 'font-bold text-zinc-900 dark:text-white' : 'font-medium text-zinc-500 dark:text-zinc-400'}`}>
                            {ticket.preview || 'Ver mensagens...'}
                          </p>
                          <ArrowRight size={14} className="text-zinc-300 dark:text-zinc-600 group-hover:translate-x-1 transition-all" />
                        </div>
                      </motion.button>
                    </div>
                  ))}
                </div>
                <div className="p-4 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-md border-t border-zinc-100 dark:border-zinc-800">
                  <button onClick={() => setView('new')} className="w-full py-3.5 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 rounded-xl font-bold text-sm flex items-center justify-center gap-2 hover:scale-[1.02] active:scale-[0.98] transition-all shadow-lg">
                    <Plus size={18} /> Abrir Novo Chamado
                  </button>
                </div>
              </div>
            )}

            {/* ── VIEW: NOVO TICKET ── */}
            {view === 'new' && (
              <div className="flex-1 flex flex-col p-5 overflow-y-auto bg-zinc-50 dark:bg-zinc-950">
                <div className="grid grid-cols-2 gap-3 mb-5">
                  {TYPES.map((t) => (
                    <button key={t.id} onClick={() => setNewType(t.id)}
                      className={`flex flex-col items-start gap-2 p-3.5 rounded-2xl border-2 transition-all duration-200 shadow-sm ${
                        newType === t.id
                          ? `${t.color} ring-1 ring-inset ring-black/5 dark:ring-white/5`
                          : 'border-white dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-400 hover:border-zinc-200'
                      }`}
                    >
                      <t.icon size={20} />
                      <div className="text-left">
                        <span className="block text-[10px] font-black uppercase tracking-wide">{t.label}</span>
                        <span className="block text-[9px] opacity-70 font-medium">{t.desc}</span>
                      </div>
                    </button>
                  ))}
                </div>
                <div className="flex-1 space-y-2">
                  <label className="text-[10px] font-bold uppercase text-zinc-400 ml-1">Descrição</label>
                  <textarea
                    value={newMsg}
                    onChange={e => setNewMsg(e.target.value)}
                    placeholder={
                      newType === 'edital'
                        ? 'Ex: PM-BA Soldado 2025, banca CEBRASPE...'
                        : 'Descreva sua solicitação com detalhes...'
                    }
                    className="w-full h-40 p-4 text-sm bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl resize-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-white outline-none dark:text-white transition-all shadow-sm"
                  />
                </div>
                <button
                  onClick={handleCreateTicket}
                  disabled={!newMsg.trim() || sending}
                  className="w-full py-3.5 mt-4 bg-red-600 text-white rounded-xl font-bold text-sm flex items-center justify-center gap-2 hover:bg-red-500 hover:shadow-xl hover:shadow-red-500/20 disabled:opacity-50 disabled:shadow-none transition-all active:scale-95"
                >
                  {sending ? <Loader2 className="animate-spin" /> : <Send size={18} />} Enviar Solicitação
                </button>
              </div>
            )}

            {/* ── VIEW: CHAT ── */}
            {view === 'chat' && (
              <>
                <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4 bg-zinc-100/50 dark:bg-black/40 custom-scrollbar">
                  <div className="flex justify-center my-4">
                    <span className="text-[9px] font-bold text-zinc-400 bg-white dark:bg-zinc-900 px-3 py-1 rounded-full border border-zinc-100 dark:border-zinc-800 shadow-sm uppercase tracking-wide">
                      Início do atendimento
                    </span>
                  </div>
                  {chatMessages.map((msg, idx) => {
                    const isMe = msg.sender === 'user';
                    return (
                      <div key={idx} className={`flex ${isMe ? 'justify-end' : 'justify-start'} animate-in fade-in slide-in-from-bottom-2`}>
                        <div className={`max-w-[85%] p-3.5 rounded-2xl text-sm leading-relaxed shadow-sm relative group ${
                          isMe
                            ? 'bg-zinc-900 text-white rounded-br-none dark:bg-white dark:text-zinc-950'
                            : 'bg-white border border-zinc-200 dark:bg-zinc-900 dark:border-zinc-800 dark:text-zinc-200 rounded-bl-none'
                        }`}>
                          {msg.text}
                          <span className="text-[9px] block mt-1 text-right opacity-60 font-medium text-zinc-400">
                            {msg.timestamp?.toDate ? msg.timestamp.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '...'}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                  {activeTicket?.adminTyping && (
                    <div className="flex justify-start"><TypingIndicator /></div>
                  )}
                  {activeTicket?.status === 'resolvido' && (
                    <div className="flex justify-center py-6 opacity-90 animate-in zoom-in duration-300">
                      <div className="flex flex-col items-center gap-2">
                        <div className="w-12 h-12 bg-emerald-100 dark:bg-emerald-900/30 rounded-full flex items-center justify-center text-emerald-600 border-4 border-white dark:border-zinc-950 shadow-sm">
                          <CheckCircle2 size={24} />
                        </div>
                        <p className="text-xs font-black text-zinc-600 dark:text-zinc-400 uppercase tracking-wide">Chamado Resolvido</p>
                      </div>
                    </div>
                  )}
                </div>
                <div className="p-3 bg-white dark:bg-zinc-900 border-t border-zinc-100 dark:border-zinc-800 flex gap-2 shadow-lg z-20">
                  <input
                    type="text"
                    value={replyText}
                    onChange={handleTyping}
                    placeholder={activeTicket?.status === 'resolvido' ? 'Este chamado foi encerrado.' : 'Digite sua mensagem...'}
                    disabled={activeTicket?.status === 'resolvido'}
                    className="flex-1 bg-zinc-100 dark:bg-zinc-800 border-transparent focus:bg-white dark:focus:bg-black focus:border-zinc-300 dark:focus:border-zinc-700 rounded-xl px-4 text-sm focus:ring-0 outline-none dark:text-white transition-all disabled:opacity-50"
                  />
                  <button
                    onClick={handleSendReply}
                    disabled={!replyText.trim() || activeTicket?.status === 'resolvido'}
                    className="p-3 bg-red-600 text-white rounded-xl hover:bg-red-500 hover:scale-105 disabled:opacity-50 disabled:scale-100 disabled:bg-zinc-300 dark:disabled:bg-zinc-700 transition-all shadow-md shadow-red-600/20"
                  >
                    <Send size={20} fill="currentColor" className="ml-0.5" />
                  </button>
                </div>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default FeedbackWidget;
