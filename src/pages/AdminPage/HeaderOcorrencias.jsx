
import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import { db } from '../../firebaseConfig';
import {
  collection, query, orderBy, limit, onSnapshot,
  addDoc, updateDoc, deleteDoc, doc, serverTimestamp, setDoc
} from 'firebase/firestore';
import {
  MessageSquare, Loader2, X, Trash2, Check, Send, Search,
  ArrowLeft, Edit2, Bug, FileText, Lightbulb, HelpCircle
} from 'lucide-react';
import { useBodyScrollLock } from '../../hooks/useBodyScrollLock';
import ConfirmModal from '../../components/shared/ConfirmModal';

// --- UTILITÁRIOS INTERNOS ---
const formatTimeAgo = (date) => {
  if (!date) return '-';
  const diff = Math.floor((new Date() - date) / 60000);
  if (diff < 1) return 'Agora';
  if (diff < 60) return `${diff}m`;
  const hours = Math.floor(diff / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
};

// --- COMPONENTE MODAL BASE ---
const ExpandedModal = ({ isOpen, onClose, title, children }) => {
  useBodyScrollLock(isOpen, { fixed: false });
  if (!isOpen) return null;
  return createPortal(
    <div className="fixed inset-0 z-[10020] flex items-center justify-center p-3 sm:p-5 md:p-7 bg-zinc-950/70 backdrop-blur-md animate-fade-in">
      <motion.div
        initial={{ scale: 0.95, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.95, opacity: 0, y: 20 }}
        className="bg-zinc-100 dark:bg-zinc-900 w-full h-[calc(100dvh-1.5rem)] sm:h-[calc(100dvh-2.5rem)] md:w-[90vw] md:max-w-5xl md:h-[calc(100dvh-3.5rem)] lg:h-[78dvh] rounded-2xl md:rounded-3xl border border-zinc-200 dark:border-zinc-800 shadow-2xl flex flex-col overflow-hidden relative"
      >
        <div className="px-6 py-4 border-b border-zinc-200 dark:border-zinc-800 flex justify-between items-center bg-white dark:bg-zinc-950 shadow-sm z-50">
          <h3 className="text-xl font-black text-zinc-900 dark:text-white flex items-center gap-2 tracking-tight">
            {title} <span className="text-red-600 hidden md:inline">.</span>
          </h3>
          <button onClick={onClose} className="p-2 bg-zinc-50 dark:bg-zinc-900 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20 rounded-full transition-colors text-zinc-400">
            <X size={20} />
          </button>
        </div>
        <div className="flex-1 overflow-hidden relative flex flex-col md:flex-row bg-zinc-50 dark:bg-black/20">
          {children}
        </div>
      </motion.div>
    </div>,
    document.body,
  );
};

// --- COMPONENTES AUXILIARES ---
const TypingIndicator = () => (
  <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-1 p-4 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-2xl rounded-tl-none w-fit shadow-sm mb-2">
    <span className="w-1.5 h-1.5 bg-zinc-400 rounded-full animate-bounce [animation-delay:-0.3s]"></span>
    <span className="w-1.5 h-1.5 bg-zinc-400 rounded-full animate-bounce [animation-delay:-0.15s]"></span>
    <span className="w-1.5 h-1.5 bg-zinc-400 rounded-full animate-bounce"></span>
    <span className="text-[10px] text-zinc-400 ml-2 font-medium">Usuário digitando...</span>
  </motion.div>
);

const HeaderOcorrencias = ({ isOpen, onClose }) => {
  const [tickets, setTickets] = useState([]);
  const [activeTicketId, setActiveTicketId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [reply, setReply] = useState('');
  const [filter, setFilter] = useState('pendente');
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTicketData, setActiveTicketData] = useState(null);
  const [editingMessage, setEditingMessage] = useState(null);
  const [deleteRequest, setDeleteRequest] = useState(null);

  const scrollRef = useRef(null);
  const adminTypingTimeoutRef = useRef(null);

  useEffect(() => {
    if (!isOpen) return;
    const q = query(collection(db, 'system_feedback'), orderBy('timestamp', 'desc'), limit(100));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setTickets(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    return () => unsubscribe();
  }, [isOpen]);

  useEffect(() => {
    if (!activeTicketId) { setActiveTicketData(null); setEditingMessage(null); setReply(''); return; }
    updateDoc(doc(db, 'system_feedback', activeTicketId), { unreadAdmin: false });
    const ticketUnsub = onSnapshot(doc(db, 'system_feedback', activeTicketId), (docSnap) => {
      if (docSnap.exists()) setActiveTicketData({ id: docSnap.id, ...docSnap.data() });
    });
    const q = query(collection(db, 'system_feedback', activeTicketId, 'messages'), orderBy('timestamp', 'asc'));
    const msgsUnsub = onSnapshot(q, (snap) => {
      setMessages(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      if (!editingMessage) setTimeout(() => { if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight; }, 100);
    });
    return () => { ticketUnsub(); msgsUnsub(); };
  }, [activeTicketId]);

  const activeTicket = activeTicketData || tickets.find(t => t.id === activeTicketId);

  const handleTyping = (e) => {
    setReply(e.target.value);
    if (!activeTicketId || editingMessage) return;
    if (e.target.value.trim() === '') {
      updateDoc(doc(db, 'system_feedback', activeTicketId), { adminTyping: false });
      if (adminTypingTimeoutRef.current) clearTimeout(adminTypingTimeoutRef.current);
      return;
    }
    updateDoc(doc(db, 'system_feedback', activeTicketId), { adminTyping: true });
    if (adminTypingTimeoutRef.current) clearTimeout(adminTypingTimeoutRef.current);
    adminTypingTimeoutRef.current = setTimeout(() => {
      updateDoc(doc(db, 'system_feedback', activeTicketId), { adminTyping: false });
    }, 2000);
  };

  const handleSendOrUpdate = async (e) => {
    e.preventDefault();
    if (!reply.trim() || !activeTicketId) return;
    if (editingMessage) {
      try {
        await updateDoc(doc(db, 'system_feedback', activeTicketId, 'messages', editingMessage.id), { text: reply });
        setEditingMessage(null); setReply('');
      } catch (error) { console.error("Erro ao editar", error); }
    } else {
      try {
        await addDoc(collection(db, 'system_feedback', activeTicketId, 'messages'), { text: reply, sender: 'admin', timestamp: serverTimestamp() });
        await updateDoc(doc(db, 'system_feedback', activeTicketId), { unreadUser: true, lastUpdate: serverTimestamp(), adminTyping: false });
        setReply('');
        if (adminTypingTimeoutRef.current) clearTimeout(adminTypingTimeoutRef.current);
      } catch (error) { console.error(error); }
    }
  };

  const handleResolve = async () => {
    if (!activeTicketId) return;
    const newStatus = activeTicket?.status === 'resolvido' ? 'pendente' : 'resolvido';
    if (newStatus === 'resolvido') {
      await addDoc(collection(db, 'system_feedback', activeTicketId, 'messages'), {
        text: "Este chamado foi marcado como resolvido. Se precisar de mais ajuda, só abrir um novo chamado.",
        sender: 'system', timestamp: serverTimestamp()
      });
    }
    await updateDoc(doc(db, 'system_feedback', activeTicketId), { status: newStatus });
  };

  const handleDeleteTicket = (id, e) => {
    e.stopPropagation();
    setDeleteRequest({ type: 'ticket', id });
  };

  const startEditing = (msg) => { setEditingMessage({ id: msg.id, text: msg.text }); setReply(msg.text); };
  const cancelEditing = () => { setEditingMessage(null); setReply(''); };
  const deleteMessage = (msgId) => {
    setDeleteRequest({ type: 'message', id: msgId });
  };

  const confirmDelete = async () => {
    if (!deleteRequest) return;
    try {
      if (deleteRequest.type === 'ticket') {
        await deleteDoc(doc(db, 'system_feedback', deleteRequest.id));
        if (activeTicketId === deleteRequest.id) setActiveTicketId(null);
      } else if (activeTicketId) {
        await deleteDoc(doc(db, 'system_feedback', activeTicketId, 'messages', deleteRequest.id));
        if (editingMessage?.id === deleteRequest.id) cancelEditing();
      }
    } catch (error) {
      console.error('Erro ao excluir item de suporte', error);
    } finally {
      setDeleteRequest(null);
    }
  };

  const filteredTickets = tickets.filter(t => {
    const matchFilter = filter === 'todos' ? true : t.status === filter;
    const matchSearch = t.userName?.toLowerCase().includes(searchTerm.toLowerCase()) || t.preview?.toLowerCase().includes(searchTerm.toLowerCase());
    return matchFilter && matchSearch;
  });

  const getTypeColor = (t) => {
    switch (t) {
      case 'edital': return 'text-purple-600 bg-purple-50 border-purple-200';
      case 'bug': return 'text-red-600 bg-red-50 border-red-200';
      default: return 'text-amber-600 bg-amber-50 border-amber-200';
    }
  };

  if (!isOpen) return null;

  return (
    <>
    <ExpandedModal isOpen={isOpen} onClose={onClose} title="Central de Ocorrências">
      <div className="flex w-full h-full overflow-hidden bg-zinc-50 dark:bg-zinc-950">
        <div className={`flex flex-col w-full md:w-80 lg:w-[400px] border-r border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 z-20 absolute md:relative inset-0 transition-transform duration-300 ease-in-out ${activeTicketId ? '-translate-x-full md:translate-x-0' : 'translate-x-0'}`}>
          <div className="p-4 border-b border-zinc-100 dark:border-zinc-800 space-y-3 bg-white dark:bg-zinc-950 z-10">
            <div className="relative group">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 group-focus-within:text-red-500 transition-colors" />
              <input type="text" placeholder="Buscar ticket..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full pl-9 pr-4 py-3 text-xs bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl outline-none dark:text-white" />
            </div>
            <div className="flex gap-1 p-1 bg-zinc-100 dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800">
              {['pendente', 'resolvido', 'todos'].map(f => (
                <button key={f} onClick={() => setFilter(f)} className={`flex-1 py-2 text-[10px] font-bold uppercase rounded-lg transition-all ${filter === f ? 'bg-white dark:bg-zinc-800 shadow-sm text-zinc-900 dark:text-white' : 'text-zinc-400 hover:text-zinc-600'}`}>{f}</button>
              ))}
            </div>
          </div>
          <div className="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-2 bg-zinc-50/30 dark:bg-zinc-950">
            {filteredTickets.map(t => (
              <button key={t.id} onClick={() => setActiveTicketId(t.id)} className={`w-full text-left p-4 rounded-2xl border transition-all relative group overflow-hidden shadow-sm ${activeTicketId === t.id ? 'bg-white dark:bg-zinc-900 border-red-500/30 ring-1 ring-red-500/20' : 'bg-white dark:bg-zinc-900/60 border-zinc-200 dark:border-zinc-800 hover:border-red-200 hover:shadow-md'}`}>
                {t.unreadAdmin && <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-red-600"></div>}
                <div className="flex justify-between items-start mb-2 pl-2">
                  <div className="flex items-center gap-2">
                    <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-md border ${getTypeColor(t.type)}`}>{t.type}</span>
                    {t.unreadAdmin && <span className="flex h-2 w-2 relative"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span><span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span></span>}
                  </div>
                  <span className="text-[10px] text-zinc-400 font-medium">{formatTimeAgo(t.timestamp?.toDate ? t.timestamp.toDate() : new Date())}</span>
                </div>
                <div className="pl-2">
                  <div className="flex items-center gap-2 mb-0.5">
                    <div className="w-5 h-5 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-[9px] font-bold text-zinc-500 border border-zinc-200">{t.userName?.substring(0, 1).toUpperCase()}</div>
                    <p className={`text-xs truncate ${t.unreadAdmin ? 'font-black text-zinc-900 dark:text-white' : 'font-bold text-zinc-700 dark:text-zinc-300'}`}>{t.userName}</p>
                  </div>
                  <p className="text-[11px] text-zinc-500 dark:text-zinc-400 truncate pl-7 opacity-90">{t.preview || t.message}</p>
                </div>
              </button>
            ))}
          </div>
        </div>
        <div className={`flex flex-col flex-1 bg-white dark:bg-zinc-950 z-10 absolute md:relative inset-0 transition-transform duration-300 ${activeTicketId ? 'translate-x-0' : 'translate-x-full md:translate-x-0'}`}>
          {activeTicket ? (
            <>
              <div className="px-6 py-4 border-b border-zinc-100 dark:border-zinc-800 bg-white/90 dark:bg-zinc-950/90 backdrop-blur-md flex justify-between items-center z-20">
                <div className="flex items-center gap-4">
                  <button onClick={() => setActiveTicketId(null)} className="md:hidden p-2 -ml-2 text-zinc-500"><ArrowLeft size={20} /></button>
                  <div className="relative">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-zinc-100 to-zinc-200 dark:from-zinc-800 dark:to-zinc-900 flex items-center justify-center text-sm font-black border border-zinc-200 text-zinc-600">{activeTicket.userName?.substring(0, 2).toUpperCase()}</div>
                  </div>
                  <div className="min-w-0">
                    <h4 className="font-bold text-sm text-zinc-900 dark:text-white truncate flex items-center gap-2">{activeTicket.userName}</h4>
                    <div className="flex items-center gap-1.5"><span className="text-[10px] text-zinc-400 truncate max-w-[200px]">{activeTicket.userEmail}</span><span className={`text-[10px] font-bold uppercase ${activeTicket.status === 'resolvido' ? 'text-emerald-600' : 'text-amber-600'}`}>{activeTicket.status}</span></div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={handleResolve} className={`p-2.5 rounded-xl transition-all shadow-sm ${activeTicket.status === 'resolvido' ? 'bg-zinc-100 text-zinc-400' : 'bg-emerald-50 text-emerald-600 border border-emerald-100'}`}><Check size={18} /></button>
                  <button onClick={(e) => handleDeleteTicket(activeTicket.id, e)} className="p-2.5 rounded-xl bg-white border border-zinc-200 text-zinc-400 hover:text-red-600"><Trash2 size={18} /></button>
                </div>
              </div>
              <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 md:p-8 space-y-6 custom-scrollbar bg-slate-50/50 dark:bg-zinc-950/50">
                {(!messages.length && activeTicket.message) && (
                  <div className="flex justify-start animate-fade-in-up">
                    <div className="max-w-[85%] md:max-w-[70%] p-5 rounded-3xl rounded-tl-sm bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-sm shadow-sm text-zinc-700 dark:text-zinc-200 leading-relaxed">
                      <span className="block text-[10px] font-bold uppercase text-zinc-400 mb-1">Mensagem Original</span>
                      {activeTicket.message}
                    </div>
                  </div>
                )}
                {messages.map((m, i) => {
                  const isAdmin = m.sender === 'admin' || m.sender === 'system';
                  const isSystem = m.sender === 'system';
                  if (isSystem) return <div key={i} className="flex justify-center my-4"><span className="bg-zinc-100 dark:bg-zinc-800 text-zinc-500 text-[10px] px-3 py-1 rounded-full">{m.text}</span></div>;
                  return (
                    <div key={i} className={`flex ${isAdmin ? 'justify-end' : 'justify-start'} animate-fade-in-up group`}>
                      <div className="flex items-end gap-2 max-w-[85%] md:max-w-[70%]">
                        {isAdmin && <div className="opacity-0 group-hover:opacity-100 transition-opacity flex flex-col gap-1 mb-2"><button onClick={() => startEditing(m)} className="p-1 text-zinc-300 hover:text-blue-500"><Edit2 size={12} /></button><button onClick={() => deleteMessage(m.id)} className="p-1 text-zinc-300 hover:text-red-500"><Trash2 size={12} /></button></div>}
                        <div className={`p-4 rounded-3xl text-sm leading-relaxed shadow-sm ${isAdmin ? 'bg-gradient-to-br from-red-600 to-red-700 text-white rounded-tr-sm' : 'bg-white dark:bg-zinc-900 border border-zinc-200 text-zinc-700 rounded-tl-sm'}`}>{m.text}</div>
                      </div>
                    </div>
                  );
                })}
                {activeTicket.userTyping && <div className="flex justify-start"><TypingIndicator /></div>}
              </div>
              <form onSubmit={handleSendOrUpdate} className="p-4 md:p-6 bg-white dark:bg-zinc-950 border-t border-zinc-100 dark:border-zinc-800 flex gap-3 shrink-0 items-end z-30">
                {editingMessage && <button type="button" onClick={cancelEditing} className="p-4 bg-zinc-100 rounded-full"><X size={20} /></button>}
                <div className={`flex-1 rounded-3xl border transition-all flex items-center px-2 ${editingMessage ? 'bg-amber-50 border-amber-200' : 'bg-zinc-100 border-transparent focus-within:bg-white focus-within:shadow-md'}`}>
                  <textarea className="w-full bg-transparent border-none px-4 py-4 text-sm focus:ring-0 outline-none resize-none max-h-32 min-h-[56px] leading-relaxed" placeholder={editingMessage ? "Editando mensagem..." : "Escreva uma resposta..."} value={reply} onChange={handleTyping} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendOrUpdate(e); } }} rows={1} disabled={activeTicket.status === 'resolvido' && !editingMessage} />
                </div>
                <button disabled={!reply.trim() || (activeTicket.status === 'resolvido' && !editingMessage)} className={`p-4 text-white rounded-full shadow-lg transition-all ${editingMessage ? 'bg-amber-500 hover:bg-amber-600' : 'bg-red-600 hover:bg-red-500'}`}>{editingMessage ? <Check size={20} /> : <Send size={20} />}</button>
              </form>
            </>
          ) : (
            <div className="hidden md:flex flex-col items-center justify-center h-full text-zinc-400 bg-zinc-50/50 dark:bg-black/20 p-10 text-center">
              <MessageSquare size={48} className="text-zinc-300 mb-6" /><h3 className="text-xl font-bold text-zinc-800 dark:text-zinc-200">Central de Atendimento</h3>
            </div>
          )}
        </div>
      </div>
    </ExpandedModal>
    <ConfirmModal
      isOpen={!!deleteRequest}
      onClose={() => setDeleteRequest(null)}
      onConfirm={confirmDelete}
      title={deleteRequest?.type === 'ticket' ? 'Excluir chamado?' : 'Excluir mensagem?'}
      message={deleteRequest?.type === 'ticket'
        ? 'O chamado e todo o histórico serão removidos permanentemente.'
        : 'A mensagem será removida permanentemente do chamado.'}
      confirmText="Excluir"
      isDestructive
    />
    </>
  );
};

export default HeaderOcorrencias;
