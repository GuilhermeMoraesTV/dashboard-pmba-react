import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { db } from '../../firebaseConfig';
import {
  collection, query, orderBy, limit, onSnapshot,
  addDoc, updateDoc, deleteDoc, doc, serverTimestamp, where
} from 'firebase/firestore';
import {
  Bell, MessageSquare, Megaphone, Lock, Loader2, X, Zap, History,
  AlertTriangle, Clock, Trash2, Check, Send, Search, Filter, ArrowLeft, Circle, User,
  FileText, Bug, Lightbulb, HelpCircle
} from 'lucide-react';

// --- UTILITÁRIOS E HELPERS ---

const formatTimeAgo = (date) => {
  if (!date) return '-';
  const diff = Math.floor((new Date() - date) / 60000);
  if (diff < 1) return 'Agora';
  if (diff < 60) return `${diff}m`;
  const hours = Math.floor(diff / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
};

// --- COMPONENTE VISUAL: MODAL EXPANDIDO ---
const ExpandedModal = ({ isOpen, onClose, title, children }) => {
  useEffect(() => {
    if (isOpen) document.body.style.overflow = 'hidden';
    else document.body.style.overflow = 'unset';
    return () => { document.body.style.overflow = 'unset'; };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-0 md:p-4 bg-zinc-950/70 backdrop-blur-md animate-fade-in">
      <motion.div
        initial={{ scale: 0.95, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.95, opacity: 0, y: 20 }}
        className="bg-zinc-100 dark:bg-zinc-900 w-full h-full md:w-[95%] md:max-w-6xl md:h-[85vh] md:rounded-3xl border border-zinc-200 dark:border-zinc-800 shadow-2xl flex flex-col overflow-hidden relative"
      >
        <div className="px-6 py-4 border-b border-zinc-200 dark:border-zinc-800 flex justify-between items-center bg-white dark:bg-zinc-950 shadow-sm z-50">
          <h3 className="text-xl font-black text-zinc-900 dark:text-white flex items-center gap-2 tracking-tight">
            {title} <span className="text-red-600 hidden md:inline">.</span>
          </h3>
          <button
            onClick={onClose}
            className="p-2 bg-zinc-50 dark:bg-zinc-900 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20 rounded-full transition-colors text-zinc-400"
          >
            <X size={20} />
          </button>
        </div>
        <div className="flex-1 overflow-hidden relative flex flex-col md:flex-row bg-zinc-50 dark:bg-black/20">
            {children}
        </div>
      </motion.div>
    </div>
  );
};

// --- COMPONENTE VISUAL: INDICADOR DE DIGITANDO ---
const TypingIndicator = () => (
  <motion.div
    initial={{ opacity: 0, y: 10 }}
    animate={{ opacity: 1, y: 0 }}
    className="flex items-center gap-1 p-4 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-2xl rounded-tl-none w-fit shadow-sm mb-2"
  >
    <span className="w-1.5 h-1.5 bg-zinc-400 rounded-full animate-bounce [animation-delay:-0.3s]"></span>
    <span className="w-1.5 h-1.5 bg-zinc-400 rounded-full animate-bounce [animation-delay:-0.15s]"></span>
    <span className="w-1.5 h-1.5 bg-zinc-400 rounded-full animate-bounce"></span>
    <span className="text-[10px] text-zinc-400 ml-2 font-medium">Usuário digitando...</span>
  </motion.div>
);

// --- MODAL DE BROADCAST (Transmissão Global) ---
const BroadcastModal = ({ isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState('send');
  const [message, setMessage] = useState('');
  const [category, setCategory] = useState('comunicado');
  const [sending, setSending] = useState(false);
  const [history, setHistory] = useState([]);

  useEffect(() => {
    if (!isOpen) return;
    const q = query(collection(db, 'system_broadcasts'), orderBy('timestamp', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setHistory(snapshot.docs.map(doc => ({
        id: doc.id, ...doc.data(),
        timestamp: doc.data().timestamp?.toDate ? doc.data().timestamp.toDate() : new Date()
      })));
    });
    return () => unsubscribe();
  }, [isOpen]);

  const handleSend = async () => {
    if (!message.trim()) return;
    setSending(true);
    try {
      await addDoc(collection(db, 'system_broadcasts'), {
        message, category, timestamp: serverTimestamp(), active: true, type: 'admin_push'
      });
      setMessage(''); setCategory('comunicado'); setActiveTab('history');
    } catch (error) { console.error(error); alert("Erro ao enviar."); }
    finally { setSending(false); }
  };

  const handleDeleteBroadcast = async (id) => {
    if (window.confirm("Excluir esta mensagem?")) await deleteDoc(doc(db, 'system_broadcasts', id));
  };

  const categoryStyles = {
    comunicado: 'bg-red-50 text-red-600 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-900/40',
    atualizacao: 'bg-blue-50 text-blue-600 border-blue-200 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-900/40',
    aviso: 'bg-amber-50 text-amber-600 border-amber-200 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-900/40'
  };

  if (!isOpen) return null;

  return (
    <ExpandedModal isOpen={isOpen} onClose={onClose} title="Transmissão Global">
      <div className="w-full h-full flex flex-col p-4 md:p-8 overflow-y-auto custom-scrollbar bg-white dark:bg-zinc-950">
          <div className="flex p-1 bg-zinc-100 dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 mb-6 shrink-0 max-w-md mx-auto w-full">
            {['send', 'history'].map(t => (
               <button key={t} onClick={() => setActiveTab(t)} className={`flex-1 py-2 text-xs font-bold uppercase rounded-lg transition-all ${activeTab === t ? 'bg-white dark:bg-zinc-800 shadow text-zinc-900 dark:text-white' : 'text-zinc-500'}`}>
                 {t === 'send' ? 'Nova Mensagem' : 'Histórico'}
               </button>
            ))}
          </div>

          {activeTab === 'send' ? (
            <div className="space-y-6 max-w-2xl mx-auto w-full">
              <div className="grid grid-cols-3 gap-3">
                {['comunicado', 'atualizacao', 'aviso'].map(c => (
                    <button key={c} onClick={() => setCategory(c)} className={`py-4 px-2 rounded-2xl border-2 text-[10px] font-bold uppercase transition-all ${category === c ? categoryStyles[c] : 'bg-zinc-50 dark:bg-zinc-900 border-transparent text-zinc-400 hover:bg-zinc-100'}`}>{c}</button>
                ))}
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase text-zinc-400 ml-1">Mensagem do Push</label>
                <textarea className="w-full h-48 bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5 text-sm focus:ring-2 focus:ring-red-500 outline-none resize-none dark:text-white" placeholder="Digite a mensagem para todos os usuários..." value={message} onChange={(e) => setMessage(e.target.value)}/>
              </div>
              <div className="flex justify-end"><button onClick={handleSend} disabled={!message || sending} className="px-8 py-3 text-sm font-bold bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 rounded-xl hover:scale-105 hover:shadow-lg transition-all disabled:opacity-50 flex items-center gap-2">{sending ? <Loader2 size={16} className="animate-spin" /> : <Zap size={16} />} Enviar Push</button></div>
            </div>
          ) : (
            <div className="space-y-3 max-w-3xl mx-auto w-full">
              {history.map((msg) => (
                <div key={msg.id} className="p-5 rounded-2xl border border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/30 flex justify-between gap-4 group hover:border-red-100 transition-colors">
                  <div className="flex-1">
                      <span className={`text-[9px] font-bold uppercase px-2 py-0.5 rounded ${categoryStyles[msg.category]}`}>{msg.category}</span>
                      <p className="mt-3 text-sm text-zinc-700 dark:text-zinc-300 whitespace-pre-wrap leading-relaxed">{msg.message}</p>
                      <p className="mt-3 text-[10px] text-zinc-400 flex items-center gap-1"><Clock size={12}/> {formatTimeAgo(msg.timestamp)}</p>
                  </div>
                  <button onClick={() => handleDeleteBroadcast(msg.id)} className="self-start p-2 text-zinc-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"><Trash2 size={16} /></button>
                </div>
              ))}
            </div>
          )}
      </div>
    </ExpandedModal>
  );
};

// --- MODAL DE INBOX (CHAT SUPORTE) ---
const InboxModal = ({ isOpen, onClose }) => {
  const [tickets, setTickets] = useState([]);
  const [activeTicketId, setActiveTicketId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [reply, setReply] = useState('');
  const [filter, setFilter] = useState('pendente');
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTicketData, setActiveTicketData] = useState(null); // Dados real-time do ticket aberto

  const scrollRef = useRef(null);
  const adminTypingTimeoutRef = useRef(null);

  // 1. Carregar Todos os Tickets
  useEffect(() => {
    if (!isOpen) return;
    const q = query(collection(db, 'system_feedback'), orderBy('timestamp', 'desc'), limit(100));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setTickets(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    return () => unsubscribe();
  }, [isOpen]);

  // 2. Monitorar Ticket Ativo (Status e Digitando do Usuário)
  useEffect(() => {
    if (!activeTicketId) {
        setActiveTicketData(null);
        return;
    }

    // Marca como lido pelo admin ao abrir
    updateDoc(doc(db, 'system_feedback', activeTicketId), { unreadAdmin: false });

    // Listener para o documento do ticket (dados meta: status, typing)
    const ticketUnsub = onSnapshot(doc(db, 'system_feedback', activeTicketId), (docSnap) => {
        if(docSnap.exists()) setActiveTicketData({ id: docSnap.id, ...docSnap.data() });
    });

    // Listener para as mensagens do chat
    const q = query(collection(db, 'system_feedback', activeTicketId, 'messages'), orderBy('timestamp', 'asc'));
    const msgsUnsub = onSnapshot(q, (snap) => {
      setMessages(snap.docs.map(d => d.data()));
      setTimeout(() => { if(scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight; }, 100);
    });

    return () => { ticketUnsub(); msgsUnsub(); };
  }, [activeTicketId]);

  const activeTicket = activeTicketData || tickets.find(t => t.id === activeTicketId);

  // Lógica de Digitando do Admin (Envia para o Usuário ver)
  const handleTyping = (e) => {
      setReply(e.target.value);
      if(!activeTicketId) return;

      // Se limpar, para de digitar
      if(e.target.value.trim() === '') {
         updateDoc(doc(db, 'system_feedback', activeTicketId), { adminTyping: false });
         if(adminTypingTimeoutRef.current) clearTimeout(adminTypingTimeoutRef.current);
         return;
      }

      // Atualiza: Admin está digitando
      updateDoc(doc(db, 'system_feedback', activeTicketId), { adminTyping: true });

      if(adminTypingTimeoutRef.current) clearTimeout(adminTypingTimeoutRef.current);
      adminTypingTimeoutRef.current = setTimeout(() => {
          updateDoc(doc(db, 'system_feedback', activeTicketId), { adminTyping: false });
      }, 2000);
  };

  const handleSendAdminReply = async (e) => {
    e.preventDefault();
    if (!reply.trim() || !activeTicketId) return;
    try {
      await addDoc(collection(db, 'system_feedback', activeTicketId, 'messages'), { text: reply, sender: 'admin', timestamp: serverTimestamp() });
      await updateDoc(doc(db, 'system_feedback', activeTicketId), {
          unreadUser: true,
          lastUpdate: serverTimestamp(),
          adminTyping: false
      });
      setReply('');
      if(adminTypingTimeoutRef.current) clearTimeout(adminTypingTimeoutRef.current);
    } catch (error) { console.error(error); }
  };

  // Resolver e mandar mensagem automática
  const handleResolve = async () => {
    if(!activeTicketId) return;
    const newStatus = activeTicket?.status === 'resolvido' ? 'pendente' : 'resolvido';

    // Se for resolver, manda msg automatica
    if(newStatus === 'resolvido') {
        await addDoc(collection(db, 'system_feedback', activeTicketId, 'messages'), {
            text: "Este chamado foi marcado como resolvido. Se precisar de mais ajuda, pode responder aqui para reabrir.",
            sender: 'system',
            timestamp: serverTimestamp()
        });
    }

    await updateDoc(doc(db, 'system_feedback', activeTicketId), { status: newStatus });
  };

  const handleDelete = async (id, e) => {
    e.stopPropagation();
    if(window.confirm('Apagar ticket e todo histórico?')) {
        await deleteDoc(doc(db, 'system_feedback', id));
        if(activeTicketId === id) setActiveTicketId(null);
    }
  };

  const filteredTickets = tickets.filter(t => {
      const matchFilter = filter === 'todos' ? true : t.status === filter;
      const matchSearch = t.userName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          t.preview?.toLowerCase().includes(searchTerm.toLowerCase());
      return matchFilter && matchSearch;
  });

  const getTypeColor = (t) => {
      switch(t) {
          case 'edital': return 'text-purple-600 bg-purple-50 dark:bg-purple-900/20 border-purple-200 dark:border-purple-900/30';
          case 'bug': return 'text-red-600 bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-900/30';
          default: return 'text-amber-600 bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-900/30';
      }
  };

  if (!isOpen) return null;

  return (
    <ExpandedModal isOpen={isOpen} onClose={onClose} title="Central de Ocorrências">
      {/* Container Layout */}
      <div className="flex w-full h-full overflow-hidden bg-zinc-50 dark:bg-zinc-950">

        {/* --- LADO ESQUERDO: LISTA DE TICKETS (SIDEBAR) --- */}
        <div className={`
            flex flex-col w-full md:w-80 lg:w-[400px] border-r border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 z-20
            absolute md:relative inset-0 transition-transform duration-300 ease-in-out
            ${activeTicketId ? '-translate-x-full md:translate-x-0' : 'translate-x-0'}
        `}>
           {/* Filtros */}
           <div className="p-4 border-b border-zinc-100 dark:border-zinc-800 space-y-3 bg-white dark:bg-zinc-950 z-10">
               <div className="relative group">
                   <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 group-focus-within:text-red-500 transition-colors"/>
                   <input
                    type="text"
                    placeholder="Buscar ticket..."
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    className="w-full pl-9 pr-4 py-3 text-xs bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl focus:ring-2 focus:ring-red-500/20 focus:border-red-500/50 outline-none dark:text-white transition-all"
                   />
               </div>
               <div className="flex gap-1 p-1 bg-zinc-100 dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800">
                   {['pendente', 'resolvido', 'todos'].map(f => (
                       <button
                        key={f} onClick={() => setFilter(f)}
                        className={`flex-1 py-2 text-[10px] font-bold uppercase rounded-lg transition-all ${filter === f ? 'bg-white dark:bg-zinc-800 shadow-sm text-zinc-900 dark:text-white' : 'text-zinc-400 hover:text-zinc-600'}`}
                       >
                           {f}
                       </button>
                   ))}
               </div>
           </div>

           {/* Lista com Scroll */}
           <div className="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-2 bg-zinc-50/30 dark:bg-zinc-950">
               {filteredTickets.length === 0 && (
                   <div className="flex flex-col items-center justify-center h-64 text-zinc-400 opacity-60">
                       <MessageSquare size={40} className="mb-2"/>
                       <p className="text-xs">Nenhum ticket encontrado.</p>
                   </div>
               )}

               {filteredTickets.map(t => (
                   <button
                    key={t.id}
                    onClick={() => setActiveTicketId(t.id)}
                    className={`
                        w-full text-left p-4 rounded-2xl border transition-all relative group overflow-hidden shadow-sm
                        ${activeTicketId === t.id
                            ? 'bg-white dark:bg-zinc-900 border-red-500/30 ring-1 ring-red-500/20'
                            : 'bg-white dark:bg-zinc-900/60 border-zinc-200 dark:border-zinc-800 hover:border-red-200 hover:shadow-md'
                        }
                    `}
                   >
                       {/* Indicador de não lido (Barra lateral) */}
                       {t.unreadAdmin && (
                           <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-red-600"></div>
                       )}

                       <div className="flex justify-between items-start mb-2 pl-2">
                           <div className="flex items-center gap-2">
                               <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-md border ${getTypeColor(t.type)}`}>{t.type}</span>
                               {t.unreadAdmin && <span className="flex h-2 w-2 relative">
                                 <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                                 <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                               </span>}
                           </div>
                           <span className="text-[10px] text-zinc-400 font-medium">{formatTimeAgo(t.timestamp?.toDate ? t.timestamp.toDate() : new Date())}</span>
                       </div>

                       <div className="pl-2">
                           <div className="flex items-center gap-2 mb-0.5">
                               <div className="w-5 h-5 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-[9px] font-bold text-zinc-500 border border-zinc-200 dark:border-zinc-700">
                                   {t.userName?.substring(0,1).toUpperCase()}
                               </div>
                               <p className={`text-xs truncate ${t.unreadAdmin ? 'font-black text-zinc-900 dark:text-white' : 'font-bold text-zinc-700 dark:text-zinc-300'}`}>{t.userName}</p>
                           </div>
                           <p className="text-[11px] text-zinc-500 dark:text-zinc-400 truncate pl-7 opacity-90">{t.preview || t.message}</p>
                       </div>
                   </button>
               ))}
           </div>
        </div>

        {/* --- LADO DIREITO: CHAT (Content) --- */}
        <div className={`
            flex flex-col flex-1 bg-white dark:bg-zinc-950 z-10
            absolute md:relative inset-0 transition-transform duration-300
            ${activeTicketId ? 'translate-x-0' : 'translate-x-full md:translate-x-0'}
        `}>
            {activeTicket ? (
                <>
                    {/* Header do Chat */}
                    <div className="px-6 py-4 border-b border-zinc-100 dark:border-zinc-800 bg-white/90 dark:bg-zinc-950/90 backdrop-blur-md flex justify-between items-center z-20">
                        <div className="flex items-center gap-4">
                            {/* Botão voltar no mobile */}
                            <button onClick={() => setActiveTicketId(null)} className="md:hidden p-2 -ml-2 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-full transition-colors"><ArrowLeft size={20}/></button>

                            <div className="relative">
                                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-zinc-100 to-zinc-200 dark:from-zinc-800 dark:to-zinc-900 flex items-center justify-center text-sm font-black border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300 shadow-inner">
                                    {activeTicket.userName?.substring(0,2).toUpperCase()}
                                </div>
                                <div className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 border-2 border-white dark:border-zinc-950 rounded-full ${activeTicket.status === 'resolvido' ? 'bg-emerald-500' : 'bg-amber-500'}`}></div>
                            </div>

                            <div className="min-w-0">
                                <h4 className="font-bold text-sm text-zinc-900 dark:text-white truncate flex items-center gap-2">
                                    {activeTicket.userName}
                                </h4>
                                <div className="flex items-center gap-1.5">
                                    <span className="text-[10px] text-zinc-400 truncate max-w-[200px]">{activeTicket.userEmail}</span>
                                    <span className="text-[10px] text-zinc-300 dark:text-zinc-700">•</span>
                                    <span className={`text-[10px] font-bold uppercase ${activeTicket.status === 'resolvido' ? 'text-emerald-600' : 'text-amber-600'}`}>{activeTicket.status}</span>
                                </div>
                            </div>
                        </div>

                        <div className="flex items-center gap-2">
                            <button
                                onClick={handleResolve}
                                title={activeTicket.status === 'resolvido' ? "Reabrir" : "Marcar Resolvido"}
                                className={`p-2.5 rounded-xl transition-all shadow-sm ${activeTicket.status === 'resolvido' ? 'bg-zinc-100 text-zinc-400 dark:bg-zinc-800 hover:bg-zinc-200' : 'bg-emerald-50 text-emerald-600 border border-emerald-100 hover:bg-emerald-100 hover:shadow-emerald-100'}`}
                            >
                                <Check size={18}/>
                            </button>
                            <button
                                onClick={(e) => handleDelete(activeTicket.id, e)}
                                className="p-2.5 rounded-xl bg-white border border-zinc-200 text-zinc-400 hover:text-red-600 hover:border-red-200 hover:bg-red-50 dark:bg-zinc-900 dark:border-zinc-800 dark:hover:bg-red-900/20 transition-all shadow-sm"
                            >
                                <Trash2 size={18}/>
                            </button>
                        </div>
                    </div>

                    {/* Área de Mensagens */}
                    <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 md:p-8 space-y-6 custom-scrollbar bg-slate-50/50 dark:bg-zinc-950/50">
                        {/* Mensagem Inicial */}
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
                            return (
                                <div key={i} className={`flex ${isAdmin ? 'justify-end' : 'justify-start'} animate-fade-in-up`}>
                                    <div
                                        className={`
                                            max-w-[85%] md:max-w-[65%] p-4 rounded-3xl text-sm leading-relaxed shadow-sm relative group transition-all
                                            ${isAdmin
                                                ? 'bg-gradient-to-br from-red-600 to-red-700 text-white rounded-tr-sm shadow-red-600/20'
                                                : 'bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-200 rounded-tl-sm hover:shadow-md'
                                            }
                                        `}
                                    >
                                        {m.text}
                                        <div className={`text-[9px] mt-1.5 text-right font-medium opacity-70 ${isAdmin ? 'text-red-100' : 'text-zinc-400'}`}>
                                            {m.timestamp?.toDate ? m.timestamp.toDate().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : ''}
                                        </div>
                                    </div>
                                </div>
                            )
                        })}

                        {/* ANIMAÇÃO DE USUÁRIO DIGITANDO */}
                        {activeTicket.userTyping && (
                            <div className="flex justify-start">
                                <TypingIndicator />
                            </div>
                        )}

                        {activeTicket.status === 'resolvido' && (
                            <div className="flex justify-center py-8 opacity-80">
                                <div className="flex flex-col items-center gap-2">
                                    <div className="w-10 h-10 bg-emerald-100 dark:bg-emerald-900/30 rounded-full flex items-center justify-center text-emerald-600">
                                        <Check size={20} />
                                    </div>
                                    <span className="text-xs font-bold text-zinc-500 dark:text-zinc-400">Atendimento Finalizado</span>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Input Area */}
                    <form onSubmit={handleSendAdminReply} className="p-4 md:p-6 bg-white dark:bg-zinc-950 border-t border-zinc-100 dark:border-zinc-800 flex gap-3 shrink-0 items-end z-30">
                        <div className="flex-1 bg-zinc-100 dark:bg-zinc-900 rounded-3xl border border-transparent focus-within:border-zinc-300 dark:focus-within:border-zinc-700 focus-within:bg-white dark:focus-within:bg-black focus-within:shadow-md transition-all flex items-center px-2">
                            <textarea
                                className="w-full bg-transparent border-none px-4 py-4 text-sm focus:ring-0 outline-none dark:text-white resize-none max-h-32 min-h-[56px] leading-relaxed"
                                placeholder={activeTicket.status === 'resolvido' ? "Reabra o ticket para responder" : "Escreva uma resposta..."}
                                value={reply}
                                onChange={handleTyping} // <-- Digitando
                                onKeyDown={e => { if(e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendAdminReply(e); } }}
                                rows={1}
                                disabled={activeTicket.status === 'resolvido'}
                            />
                        </div>
                        <button
                            disabled={!reply.trim() || activeTicket.status === 'resolvido'}
                            className="p-4 bg-red-600 hover:bg-red-500 text-white rounded-full shadow-lg shadow-red-600/30 disabled:opacity-50 disabled:shadow-none transition-all hover:scale-110 active:scale-95"
                        >
                            <Send size={20} fill="currentColor" className="ml-0.5"/>
                        </button>
                    </form>
                </>
            ) : (
                <div className="hidden md:flex flex-col items-center justify-center h-full text-zinc-400 bg-zinc-50/50 dark:bg-black/20 p-10 text-center">
                    <div className="w-32 h-32 bg-white dark:bg-zinc-900 rounded-full flex items-center justify-center mb-6 shadow-sm border border-zinc-100 dark:border-zinc-800">
                        <MessageSquare size={48} className="text-zinc-300 dark:text-zinc-700"/>
                    </div>
                    <h3 className="text-xl font-bold text-zinc-800 dark:text-zinc-200 mb-2">Central de Atendimento</h3>
                    <p className="text-sm max-w-sm opacity-60 leading-relaxed">Selecione uma ocorrência na lista ao lado para visualizar o histórico completo e responder ao aluno em tempo real.</p>
                </div>
            )}
        </div>
      </div>
    </ExpandedModal>
  );
};

// --- HEADER DO ADMIN (COM TOOLTIP DE CONTAGEM POR TIPO) ---
const HeaderAdmin = ({ newUsersCount }) => {
  const [showInbox, setShowInbox] = useState(false);
  const [showBroadcast, setShowBroadcast] = useState(false);
  const [counts, setCounts] = useState({ total: 0, bug: 0, ideia: 0, edital: 0, duvida: 0 });

  // Listener para contar ocorrências pendentes (Detalhado)
  useEffect(() => {
      const q = query(collection(db, 'system_feedback'), where('status', '==', 'pendente'));

      const unsub = onSnapshot(q, (snap) => {
          let newCounts = { total: 0, bug: 0, ideia: 0, edital: 0, duvida: 0 };

          snap.docs.forEach(doc => {
              const data = doc.data();
              newCounts.total++;
              if (data.type) {
                  const type = data.type.toLowerCase();
                  if (newCounts[type] !== undefined) newCounts[type]++;
              }
          });
          setCounts(newCounts);
      });
      return () => unsub();
  }, []);

  return (
    <>
      <InboxModal isOpen={showInbox} onClose={() => setShowInbox(false)} />
      <BroadcastModal isOpen={showBroadcast} onClose={() => setShowBroadcast(false)} />

      <header className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 border-b border-zinc-200 dark:border-zinc-800 pb-6 sticky top-0 bg-white/90 dark:bg-zinc-950/90 backdrop-blur-md z-40 pt-4 px-4 md:px-0">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-red-600 text-white rounded-full text-[10px] font-bold uppercase tracking-widest shadow-lg shadow-red-600/20">
              <Lock size={10} /> Admin Zone
            </div>
          </div>
          <h1 className="text-3xl font-black text-zinc-900 dark:text-white uppercase tracking-tighter flex items-center gap-2">
            Painel de Controle <span className="text-red-600">.</span>
          </h1>
        </div>

        <div className="flex items-center gap-3">

          {/* Botão Ocorrências (Com Dropdown de Notificações) */}
          <div className="relative group">
            <button
                onClick={() => setShowInbox(true)}
                className="relative flex items-center gap-2 px-5 py-3 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-200 rounded-xl font-bold hover:border-red-200 dark:hover:border-red-900/50 hover:shadow-lg hover:shadow-red-900/10 transition-all active:scale-95"
            >
                <div className="relative">
                    <MessageSquare size={18} className="group-hover:text-red-600 transition-colors" />
                    {counts.total > 0 && (
                        <span className="absolute -top-2 -right-2 flex h-4 w-4">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-4 w-4 bg-red-600 text-[9px] text-white font-black items-center justify-center border-2 border-white dark:border-zinc-900">
                                {counts.total > 9 ? '9+' : counts.total}
                            </span>
                        </span>
                    )}
                </div>
                <span className="hidden sm:inline group-hover:text-red-600 transition-colors">Ocorrências</span>
            </button>

            {/* TOOLTIP DETALHADO (Hover) */}
            {counts.total > 0 && (
                <div className="absolute top-full right-0 mt-2 w-48 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-xl p-2 opacity-0 group-hover:opacity-100 invisible group-hover:visible transition-all transform origin-top-right z-50">
                    <p className="text-[10px] font-bold uppercase text-zinc-400 px-2 mb-1 tracking-widest">Pendentes</p>
                    <div className="space-y-1">
                        {counts.bug > 0 && (
                            <div className="flex items-center justify-between px-2 py-1.5 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 text-xs font-bold">
                                <span className="flex items-center gap-1"><Bug size={12}/> Bugs</span>
                                <span>{counts.bug}</span>
                            </div>
                        )}
                        {counts.edital > 0 && (
                            <div className="flex items-center justify-between px-2 py-1.5 rounded-lg bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300 text-xs font-bold">
                                <span className="flex items-center gap-1"><FileText size={12}/> Editais</span>
                                <span>{counts.edital}</span>
                            </div>
                        )}
                        {counts.ideia > 0 && (
                            <div className="flex items-center justify-between px-2 py-1.5 rounded-lg bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300 text-xs font-bold">
                                <span className="flex items-center gap-1"><Lightbulb size={12}/> Ideias</span>
                                <span>{counts.ideia}</span>
                            </div>
                        )}
                         {counts.duvida > 0 && (
                            <div className="flex items-center justify-between px-2 py-1.5 rounded-lg bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 text-xs font-bold">
                                <span className="flex items-center gap-1"><HelpCircle size={12}/> Dúvidas</span>
                                <span>{counts.duvida}</span>
                            </div>
                        )}
                    </div>
                </div>
            )}
          </div>

          <button
            onClick={() => setShowBroadcast(true)}
            className="flex items-center gap-2 px-5 py-3 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 rounded-xl font-bold hover:scale-105 transition-transform shadow-xl"
          >
            <Megaphone size={18} /> <span className="hidden sm:inline">Broadcast</span>
          </button>

          {newUsersCount > 0 && (
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="flex items-center gap-3 px-4 py-2 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-800 rounded-xl">
              <div className="relative"><Bell size={18} className="text-emerald-600" /><span className="absolute top-0 right-0 w-2 h-2 bg-red-500 rounded-full animate-pulse"></span></div>
              <span className="text-xs font-bold text-emerald-700 dark:text-emerald-300">+{newUsersCount} Novos</span>
            </motion.div>
          )}
        </div>
      </header>
    </>
  );
};

export default HeaderAdmin;