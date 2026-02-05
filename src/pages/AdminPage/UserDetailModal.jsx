import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { X, Users, Clock, Zap, Target } from 'lucide-react';

// --- UTILS DE FORMATAÇÃO ---
const formatTimeAgo = (date) => {
  if (!date) return '-';
  const diff = Math.floor((new Date() - date) / 60000);
  if (diff < 1) return 'Agora mesmo';
  if (diff < 60) return `${diff}m atrás`;
  const hours = Math.floor(diff / 60);
  if (hours < 24) return `${hours}h atrás`;
  return `${Math.floor(hours / 24)}d atrás`;
};

const formatHMFromMinutes = (minutes) => {
  const m = Math.max(0, Number(minutes) || 0);
  const h = Math.floor(m / 60);
  const mm = m % 60;
  if (h > 0) return `${h}h ${mm}m`;
  return `${mm}m`;
};

// --- COMPONENTE AVATAR LOCAL ---
const Avatar = ({ user, size = "md" }) => {
  const sizeClasses = { sm: "w-8 h-8 text-[10px]", md: "w-10 h-10 text-xs", lg: "w-16 h-16 text-lg" };
  return (
    <div className={`${sizeClasses[size]} rounded-full flex-shrink-0 bg-gradient-to-br from-zinc-100 to-zinc-200 dark:from-zinc-800 dark:to-zinc-900 border-2 border-white dark:border-zinc-700 shadow-sm overflow-hidden flex items-center justify-center relative`}>
      {user?.photoURL ? (
        <img src={user.photoURL} alt={user?.name || 'user'} className="w-full h-full object-cover" />
      ) : (
        <span className="font-black text-zinc-500 dark:text-zinc-400">
          {user?.name ? user.name.substring(0, 2).toUpperCase() : <Users size={14} />}
        </span>
      )}
    </div>
  );
};

const UserDetailModal = ({ isOpen, onClose, user, records = [] }) => {
  const [tab, setTab] = useState('perfil');

  useEffect(() => {
    if (isOpen) document.body.style.overflow = 'hidden';
    else document.body.style.overflow = 'unset';
    return () => { document.body.style.overflow = 'unset'; };
  }, [isOpen]);

  if (!isOpen || !user) return null;

  const userRecords = records.filter(r => r.uid === user.id);
  const totalMinutes = userRecords.reduce((acc, r) => acc + Number(r.tempoEstudadoMinutos || r.duracaoMinutos || 0), 0);
  const totalQuestions = userRecords.reduce((acc, r) => acc + Number(r.questoesFeitas || 0), 0);
  const totalCorrect = userRecords.reduce((acc, r) => acc + Number(r.acertos || 0), 0);
  const accuracy = totalQuestions > 0 ? Math.round((totalCorrect / totalQuestions) * 100) : null;
  const lastStudy = userRecords.length ? userRecords[0].timestamp : null;

  return (
    <div className="fixed inset-0 z-[250] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <motion.div
        initial={{ scale: 0.95, opacity: 0, y: 10 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        className="bg-white dark:bg-zinc-950 w-full max-w-5xl max-h-[92vh] rounded-3xl border border-zinc-200 dark:border-zinc-800 shadow-2xl flex flex-col overflow-hidden"
      >
        <div className="p-5 md:p-6 border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50/60 dark:bg-zinc-900/40 flex items-center justify-between">
          <div className="flex items-center gap-4 min-w-0">
            <Avatar user={user} size="lg" />
            <div className="min-w-0">
              <h3 className="text-xl md:text-2xl font-black text-zinc-900 dark:text-white truncate">
                {user.name || 'Usuário'} <span className="text-red-600">.</span>
              </h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 truncate">
                {user.email || 'sem email'} • Cadastro: {formatTimeAgo(user.createdAt)}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-full transition-colors"><X size={22} /></button>
        </div>

        <div className="px-5 md:px-6 pt-4">
          <div className="flex items-center gap-2 bg-zinc-100 dark:bg-zinc-900 rounded-2xl p-1 border border-zinc-200 dark:border-zinc-800 w-fit">
            {['perfil', 'registros'].map(t => (
                <button key={t} onClick={() => setTab(t)} className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wide transition-all ${tab === t ? 'bg-red-600 text-white' : 'text-zinc-500 hover:text-zinc-800'}`}>
                    {t}
                </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar p-5 md:p-6">
          {tab === 'perfil' ? (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <div className="lg:col-span-2 bg-white dark:bg-zinc-950 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-5">
                <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">Resumo</p>
                <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {[
                      { l: 'Horas', v: Math.round(totalMinutes / 60) + 'h' },
                      { l: 'Questões', v: totalQuestions },
                      { l: 'Precisão', v: accuracy === null ? '-' : accuracy + '%' }
                  ].map((s, i) => (
                      <div key={i} className="p-4 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-900/40">
                        <p className="text-[10px] font-bold uppercase text-zinc-400">{s.l}</p>
                        <p className="text-2xl font-black text-zinc-900 dark:text-white">{s.v}</p>
                      </div>
                  ))}
                </div>
                <div className="mt-5 flex items-center justify-between text-xs text-zinc-500">
                  <span>Último estudo: <b className="text-zinc-700 dark:text-zinc-200">{formatTimeAgo(lastStudy)}</b></span>
                </div>
              </div>
              <div className="bg-gradient-to-br from-zinc-950 to-zinc-900 text-white rounded-2xl border border-zinc-800 p-5 shadow-xl">
                <p className="text-[10px] font-bold uppercase tracking-widest text-white/60">Perfil</p>
                <div className="mt-4 space-y-2 text-sm">
                    <div><span className="text-white/70">Nome:</span> <span className="font-black">{user.name}</span></div>
                    <div><span className="text-white/70">Email:</span> <span className="font-black">{user.email}</span></div>
                    <div><span className="text-white/70">Cadastro:</span> <span className="font-black">{formatTimeAgo(user.createdAt)}</span></div>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {userRecords.length === 0 ? <div className="text-zinc-500">Nenhum registro.</div> :
                userRecords.slice(0, 250).map(r => (
                    <div key={r.id} className="p-4 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 hover:border-red-200 transition-colors">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-xs font-black text-zinc-900 dark:text-white truncate">
                            {r.cicloNome || 'Ciclo'} <span className="text-red-600">•</span> {r.disciplinaNome}
                          </p>
                          <p className="text-[11px] text-zinc-500 dark:text-zinc-400 truncate">{r.assunto || 'Sem assunto'}</p>
                          <div className="mt-2 flex flex-wrap gap-2">
                            <span className="text-[10px] font-black px-2 py-1 rounded-full bg-red-50 text-red-700 border border-red-100 flex items-center gap-2"><Clock size={12} /> {formatHMFromMinutes(r.tempoEstudadoMinutos || 0)}</span>
                            <span className="text-[10px] font-black px-2 py-1 rounded-full bg-zinc-50 border border-zinc-200 flex items-center gap-2"><Zap size={12} /> {Number(r.questoesFeitas||0)} q</span>
                            <span className="text-[10px] font-black px-2 py-1 rounded-full bg-zinc-50 border border-zinc-200 flex items-center gap-2"><Target size={12} /> {r.acertos ? Math.round((r.acertos/r.questoesFeitas)*100)+'%' : '-'}</span>
                          </div>
                        </div>
                        <span className="text-[10px] text-zinc-400">{formatTimeAgo(r.timestamp)}</span>
                      </div>
                    </div>
                  ))
              }
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
};

export default UserDetailModal;