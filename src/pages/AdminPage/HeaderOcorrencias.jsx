import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import { MessageSquare, Search, Clock, CheckCircle2, X } from 'lucide-react';
import { useBodyScrollLock } from '../../hooks/useBodyScrollLock';
import { useSupportUser, useSupportTickets } from '../../hooks/useSupport.js';
import SupportConversation from '../../components/support/SupportConversation.jsx';

const ExpandedModal = ({ isOpen, onClose, title, children }) => {
  useBodyScrollLock(isOpen, { fixed: false });
  if (!isOpen) return null;
  return createPortal(
    <div className="fixed inset-0 z-[10020] flex items-center justify-center bg-zinc-900/70 p-3 backdrop-blur-md animate-fade-in sm:p-5 md:p-7">
      <motion.div
        initial={{ scale: 0.95, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.95, opacity: 0, y: 20 }}
        className="admin-modal-shell admin-modal-shell--ocorrencias modal-zoom modal-zoom--admin-ocorrencias w-full h-[calc(100dvh-1.5rem)] sm:h-[calc(100dvh-2.5rem)] md:w-[94vw] md:max-w-6xl md:h-[calc(100dvh-3.5rem)] lg:h-[84dvh] rounded-2xl md:rounded-[2rem] border border-zinc-200 dark:border-zinc-800 shadow-2xl flex flex-col overflow-hidden relative"
      >
        <div className="admin-modal-heading flex items-center justify-between gap-4 px-5 py-4 sm:px-6 z-50">
          <div className="flex min-w-0 items-center gap-3">
            <span className="admin-modal-heading__icon"><MessageSquare size={21} /></span>
            <div className="min-w-0">
              <h3 className="truncate text-lg font-black tracking-tight text-zinc-900 dark:text-white sm:text-xl">{title}</h3>
              <p className="hidden text-xs font-semibold text-zinc-500 sm:block">Triagem, conversa e resolução do suporte em um só lugar.</p>
            </div>
          </div>
          <button onClick={onClose} aria-label="Fechar ocorrências" className="admin-modal-close">
            <X size={20} />
          </button>
        </div>
        <div className="admin-modal-body flex-1 overflow-hidden relative flex flex-col md:flex-row">
          {children}
        </div>
      </motion.div>
    </div>,
    document.body,
  );
};

const getTypeColor = (type) => {
  switch (type) {
    case 'edital': return 'bg-amber-50 text-amber-600 border-amber-200 dark:bg-amber-950/30 dark:border-amber-800';
    case 'ideia': return 'bg-purple-50 text-purple-600 border-purple-200 dark:bg-purple-950/30 dark:border-purple-800';
    case 'bug': return 'bg-rose-50 text-rose-600 border-rose-200 dark:bg-rose-950/30 dark:border-rose-800';
    case 'duvida': return 'bg-blue-50 text-blue-600 border-blue-200 dark:bg-blue-950/30 dark:border-blue-800';
    default: return 'bg-zinc-100 text-zinc-600 border-zinc-200 dark:bg-zinc-800 dark:border-zinc-700';
  }
};

const formatTimeAgo = (date) => {
  if (!date) return '';
  const now = new Date();
  const diffInMinutes = Math.floor((now - date) / (1000 * 60));
  if (diffInMinutes < 1) return 'Agora';
  if (diffInMinutes < 60) return `${diffInMinutes}m atrás`;
  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) return `${diffInHours}h atrás`;
  return `${Math.floor(diffInHours / 24)}d atrás`;
};

export default function HeaderOcorrencias({ isOpen, onClose }) {
  const user = useSupportUser();
  const { rows, more, error, loadMore } = useSupportTickets(isOpen, user?.uid, true);
  const [activeTicketId, setActiveTicketId] = useState(null);
  const [filter, setFilter] = useState('pendente');
  const [search, setSearch] = useState('');

  useBodyScrollLock(isOpen, { fixed: false });

  if (!isOpen || !user) return null;

  const counts = {
    all: rows.length,
    pending: rows.filter((t) => t.status !== 'resolvido').length,
    resolved: rows.filter((t) => t.status === 'resolvido').length,
  };

  const filteredTickets = rows.filter((ticket) => {
    const matchesFilter =
      filter === 'todos' ||
      (filter === 'pendente' && ticket.status !== 'resolvido') ||
      (filter === 'resolvido' && ticket.status === 'resolvido');

    const matchesSearch =
      `${ticket.userName || ''} ${ticket.userEmail || ''} ${ticket.preview || ticket.message || ''}`
        .toLowerCase()
        .includes(search.toLowerCase());

    return matchesFilter && matchesSearch;
  });

  return (
    <ExpandedModal
      isOpen={isOpen}
      onClose={onClose}
      title="Central de Ocorrências"
    >
      <div className="flex h-full w-full overflow-hidden bg-white dark:bg-zinc-900">
        {/* Sidebar: Ticket List */}
        <div
          className={`admin-ocorrencias-list flex w-full flex-col border-r border-zinc-100 bg-zinc-50/50 dark:border-zinc-800 dark:bg-zinc-950 md:w-80 md:flex-shrink-0 ${
            activeTicketId ? 'hidden md:flex' : 'flex'
          }`}
        >
          {/* Search and Filters */}
          <div className="space-y-3 p-4 border-b border-zinc-100 dark:border-zinc-800">
            <div className="relative">
              <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400" />
              <input
                type="text"
                placeholder="Buscar por usuário, e-mail..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl text-xs outline-none focus:ring-1 focus:ring-zinc-900 dark:focus:ring-white dark:text-white transition-all shadow-sm"
              />
            </div>

            <div className="flex gap-1.5 p-1 bg-zinc-200/50 dark:bg-zinc-900 rounded-xl">
              <button
                type="button"
                onClick={() => setFilter('pendente')}
                className={`flex-1 py-1.5 text-[10px] font-black uppercase rounded-lg transition-all ${
                  filter === 'pendente'
                    ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white shadow-sm'
                    : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-white'
                }`}
              >
                Pendentes ({counts.pending})
              </button>
              <button
                type="button"
                onClick={() => setFilter('resolvido')}
                className={`flex-1 py-1.5 text-[10px] font-black uppercase rounded-lg transition-all ${
                  filter === 'resolvido'
                    ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white shadow-sm'
                    : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-white'
                }`}
              >
                Resolvidos ({counts.resolved})
              </button>
              <button
                type="button"
                onClick={() => setFilter('todos')}
                className={`flex-1 py-1.5 text-[10px] font-black uppercase rounded-lg transition-all ${
                  filter === 'todos'
                    ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white shadow-sm'
                    : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-white'
                }`}
              >
                Todos ({counts.all})
              </button>
            </div>
          </div>

          {/* List items */}
          <div className="flex-1 overflow-y-auto p-3 space-y-2 custom-scrollbar">
            {error && <p role="alert" className="p-3 text-xs text-red-600">{error}</p>}

            {!filteredTickets.length ? (
              <div className="py-12 text-center text-zinc-400">
                <MessageSquare size={28} className="mx-auto text-zinc-300 dark:text-zinc-700 mb-2 opacity-50" />
                <p className="text-xs font-semibold">Nenhum chamado encontrado</p>
              </div>
            ) : (
              filteredTickets.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setActiveTicketId(t.id)}
                  className={`w-full p-3.5 rounded-2xl text-left border transition-all duration-200 group relative ${
                    activeTicketId === t.id
                      ? 'bg-white dark:bg-zinc-900 border-zinc-900 dark:border-white shadow-md ring-1 ring-zinc-900 dark:ring-white'
                      : 'bg-white dark:bg-zinc-900 border-zinc-200/80 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <div className="flex items-center gap-1.5">
                      <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-md border ${getTypeColor(t.type)}`}>
                        {t.type}
                      </span>
                      {t.unreadAdmin && (
                        <span className="flex h-2 w-2 relative">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500" />
                        </span>
                      )}
                    </div>
                    <span className="text-[10px] text-zinc-400 font-medium">
                      {formatTimeAgo(t.timestamp?.toDate ? t.timestamp.toDate() : (t.timestamp?.seconds ? new Date(t.timestamp.seconds * 1000) : new Date()))}
                    </span>
                  </div>

                  <div className="pl-1">
                    <div className="flex items-center gap-2 mb-1">
                      <div className="w-5 h-5 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-[9px] font-bold text-zinc-500 border border-zinc-200 dark:border-zinc-700 shrink-0">
                        {t.userName?.substring(0, 1).toUpperCase() || 'U'}
                      </div>
                      <p className={`text-xs truncate ${t.unreadAdmin ? 'font-black text-zinc-900 dark:text-white' : 'font-bold text-zinc-700 dark:text-zinc-300'}`}>
                        {t.userName || 'Usuário'}
                      </p>
                    </div>
                    <p className="text-[11px] text-zinc-500 dark:text-zinc-400 truncate pl-7 opacity-90">
                      {t.preview || t.message || 'Ver mensagem...'}
                    </p>
                  </div>
                </button>
              ))
            )}

            {more && (
              <button
                type="button"
                onClick={loadMore}
                className="w-full py-2 text-xs text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 underline"
              >
                Carregar chamados anteriores
              </button>
            )}
          </div>
        </div>

        {/* Chat Area on Right */}
        <div
          className={`admin-ocorrencias-chat flex-1 flex flex-col bg-white dark:bg-zinc-900 min-w-0 ${
            activeTicketId ? 'flex' : 'hidden md:flex'
          }`}
        >
          {activeTicketId ? (
            <SupportConversation
              key={`${user.uid}/${activeTicketId}`}
              ticketId={activeTicketId}
              user={user}
              admin={true}
              onBack={() => setActiveTicketId(null)}
            />
          ) : (
            <div className="hidden h-full flex-col items-center justify-center bg-zinc-50/50 dark:bg-zinc-800/45 p-10 text-center text-zinc-400 md:flex">
              <MessageSquare size={48} className="text-zinc-300 dark:text-zinc-700 mb-4" />
              <h3 className="text-xl font-bold text-zinc-800 dark:text-zinc-200">Central de Atendimento</h3>
              <p className="max-w-xs text-xs text-zinc-400 mt-2">
                Selecione um chamado ao lado para visualizar o histórico e responder ao aluno.
              </p>
            </div>
          )}
        </div>
      </div>
    </ExpandedModal>
  );
}

