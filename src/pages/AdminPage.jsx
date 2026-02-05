import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { db } from '../firebaseConfig';
import { collection, query, collectionGroup, deleteDoc, doc, onSnapshot, orderBy, limit } from 'firebase/firestore';
import {
  Users, Activity, Server, Loader2, Search, Maximize2, Trash2, X, FileSpreadsheet, Target,
  Clock, Zap, Trophy, ChevronRight, MoreHorizontal, Radio, LayoutGrid
} from 'lucide-react';

// --- IMPORTS DOS COMPONENTES ---
import HeaderAdmin from './AdminPage/HeaderAdmin';
import EditaisManagerModal from './AdminPage/EditaisManager';
import StudyingNowPanel from './AdminPage/LiveStudyMonitor';
import UserDetailModal from './AdminPage/UserDetailModal';

// --- HELPERS ---
const toDateSafe = (value) => {
    if (!value) return null;
    if (value?.toDate) return value.toDate();
    if (value instanceof Date) return value;
    const n = Number(value);
    if (!Number.isNaN(n) && n > 0) return new Date(n);
    return null;
};

const toMillisSafe = (value) => toDateSafe(value)?.getTime() || null;

const formatTimeAgo = (date) => {
    if (!date) return '-';
    const diff = Math.floor((new Date() - date) / 60000);
    if (diff < 1) return 'Agora';
    if (diff < 60) return `${diff}m`;
    const hours = Math.floor(diff / 60);
    if (hours < 24) return `${hours}h`;
    return `${Math.floor(hours / 24)}d`;
};

const formatHMFromMinutes = (minutes) => {
    const m = Math.max(0, Number(minutes) || 0);
    const h = Math.floor(m / 60);
    const mm = m % 60;
    if (h > 0) return `${h}h ${mm}m`;
    return `${mm}m`;
};

const Avatar = ({ user, size = "md", className="" }) => {
    const sizeClasses = { sm: "w-8 h-8 text-[10px]", md: "w-10 h-10 text-xs", lg: "w-12 h-12 text-sm" };
    return (
      <div className={`${sizeClasses[size]} ${className} rounded-2xl flex-shrink-0 bg-gradient-to-br from-zinc-100 to-zinc-200 dark:from-zinc-800 dark:to-zinc-900 border border-white/50 dark:border-zinc-700 shadow-sm overflow-hidden flex items-center justify-center relative`}>
        {user?.photoURL ? <img src={user.photoURL} className="w-full h-full object-cover" alt="avatar" /> : <Users size={14} className="text-zinc-400" />}
      </div>
    );
};

// --- COMPONENTES VISUAIS ---

// Modal Genérico Expandido
const ExpandedModal = ({ isOpen, onClose, title, children }) => {
    useEffect(() => { document.body.style.overflow = isOpen ? 'hidden' : 'unset'; }, [isOpen]);
    if (!isOpen) return null;
    return (
      <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-zinc-900/60 backdrop-blur-md animate-fade-in">
        <motion.div
            initial={{ scale: 0.95, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            className="bg-white dark:bg-zinc-950 w-full max-w-6xl max-h-[90vh] rounded-[32px] border border-zinc-200 dark:border-zinc-800 shadow-2xl flex flex-col overflow-hidden"
        >
          <div className="p-6 border-b border-zinc-100 dark:border-zinc-800 flex justify-between items-center bg-zinc-50/50 dark:bg-zinc-900/50">
            <h3 className="text-2xl font-black text-zinc-900 dark:text-white tracking-tight">{title}</h3>
            <button onClick={onClose} className="p-2 hover:bg-zinc-200 dark:hover:bg-zinc-800 rounded-full transition-colors"><X size={24} /></button>
          </div>
          <div className="flex-1 overflow-y-auto p-6 custom-scrollbar bg-zinc-50/30 dark:bg-black/20">{children}</div>
        </motion.div>
      </div>
    );
};

// Card KPI
const KpiCard = ({ title, value, subValue, icon: Icon, color, trend }) => {
    const theme = {
      zinc: "from-zinc-500 to-zinc-600",
      red: "from-red-500 to-red-600",
      amber: "from-amber-500 to-amber-600",
      emerald: "from-emerald-500 to-emerald-600",
    }[color] || "from-blue-500 to-blue-600";

    return (
      <motion.div whileHover={{ y: -2 }} className="relative overflow-hidden bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-5 flex flex-col justify-between shadow-sm group min-h-[140px]">
        <div className="flex justify-between items-start mb-4 relative z-10">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 mb-1 flex items-center gap-2">
              {title}
            </p>
            <h3 className="text-3xl lg:text-4xl font-black tracking-tighter text-zinc-900 dark:text-white leading-none">{value}</h3>
          </div>
          <div className={`p-2.5 rounded-2xl bg-gradient-to-br ${theme} text-white shadow-lg`}>
            <Icon size={18} />
          </div>
        </div>
        <div className="flex items-center justify-between relative z-10">
            <p className="text-[10px] sm:text-xs font-semibold text-zinc-500 dark:text-zinc-400">{subValue}</p>
            {trend && <span className="px-2 py-1 rounded-lg text-[9px] font-bold bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 flex items-center gap-1">+{trend}% <Activity size={10}/></span>}
        </div>
        <div className={`absolute top-0 right-0 w-24 h-24 bg-gradient-to-br ${theme} opacity-[0.03] rounded-full blur-2xl -mr-8 -mt-8 group-hover:opacity-[0.07] transition-opacity`} />
      </motion.div>
    );
};

// Card Bento Box
const BentoCard = ({ title, subtitle, icon: Icon, children, className = "", action, isLive = false, headerColor = "text-zinc-900 dark:text-white" }) => (
    <div className={`bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-[32px] shadow-sm flex flex-col overflow-hidden relative group ${className}`}>
      <div className="p-5 pb-3 flex items-center justify-between relative z-10 border-b border-zinc-50 dark:border-zinc-900/50">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-xl border border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 text-zinc-500 relative shadow-sm`}>
            <Icon size={18} />
            {isLive && (
                <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500 border-2 border-white dark:border-zinc-950"></span>
                </span>
            )}
          </div>
          <div>
            <h3 className={`text-sm font-black uppercase tracking-tight ${headerColor}`}>{title}</h3>
            {subtitle && <p className="text-[10px] font-medium text-zinc-400">{subtitle}</p>}
          </div>
        </div>
        {action}
      </div>
      <div className="flex-1 w-full min-h-0 relative px-2 sm:px-5 pb-5 pt-2">
        {children}
      </div>
    </div>
);

// --- PÁGINA ADMIN ---
function AdminPage() {
  const [users, setUsers] = useState([]);
  const [studyRecords, setStudyRecords] = useState([]);
  const [activeSessions, setActiveSessions] = useState([]);
  const [loading, setLoading] = useState(true);

  // Estados UI
  const [expandedView, setExpandedView] = useState(null);
  const [showEditaisModal, setShowEditaisModal] = useState(false);
  const [detailUser, setDetailUser] = useState(null);

  // Filtros
  const [searchTerm, setSearchTerm] = useState('');
  const [rankingMetric, setRankingMetric] = useState('hours');
  const [rankingLimit, setRankingLimit] = useState(10);
  const [selectedFeedUid, setSelectedFeedUid] = useState('all');

  // Cache
  const [cicloNameByKey, setCicloNameByKey] = useState(new Map());

  // --- DATA FETCHING ---
  useEffect(() => {
    const q = query(collection(db, 'users'), orderBy('createdAt', 'desc'));
    return onSnapshot(q, (snap) => {
      setUsers(snap.docs.map(doc => ({ id: doc.id, ...doc.data(), createdAt: doc.data().createdAt?.toDate ? doc.data().createdAt.toDate() : new Date() })));
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    const q = query(collectionGroup(db, 'registrosEstudo'), orderBy('timestamp', 'desc'), limit(1000));
    return onSnapshot(q, (snap) => setStudyRecords(snap.docs.map(doc => ({ id: doc.id, uid: doc.data().uid || doc.ref.path.split('/')[1], ...doc.data(), timestamp: doc.data().timestamp?.toDate?.() || new Date() }))));
  }, []);

  useEffect(() => {
    const q = query(collection(db, 'active_timers'), orderBy('updatedAt', 'desc'), limit(160));
    return onSnapshot(q, (snap) => {
        const nowAt = Date.now();
        const nowPerf = (typeof performance !== 'undefined' && performance.now) ? performance.now() : null;
        setActiveSessions(snap.docs.map(d => ({
            id: d.id, uid: d.data().uid || d.id, ...d.data(),
            updatedAt: d.data().updatedAt?.toDate?.() || new Date(),
            displaySecondsSnapshot: Number(d.data().displaySecondsSnapshot ?? d.data().seconds ?? 0),
            _receivedAt: nowAt, _receivedPerf: typeof nowPerf === 'number' ? nowPerf : undefined
        })));
    });
  }, []);

  useEffect(() => {
    const q = query(collectionGroup(db, 'ciclos'), limit(800));
    return onSnapshot(q, (snap) => {
      const next = new Map();
      snap.docs.forEach(docu => {
        const parts = docu.ref.path.split('/');
        if (parts[1] && parts[3] && (docu.data().nome || docu.data().titulo)) next.set(`${parts[1]}_${parts[3]}`, docu.data().nome || docu.data().titulo);
      });
      setCicloNameByKey(next);
    });
  }, []);

  const getUser = (uid) => users.find(u => u.id === uid) || { id: uid, name: 'Usuário', email: '...', createdAt: new Date() };

  // --- DATA PROCESSING ---
  const dashboardData = useMemo(() => {
    const now = new Date();
    const statsByUid = new Map();
    const active7Days = new Set();
    const active24Hours = new Set();

    studyRecords.forEach(reg => {
      if (!reg.uid) return;
      const cur = statsByUid.get(reg.uid) || { minutes: 0, questions: 0, correct: 0 };
      cur.minutes += Number(reg.tempoEstudadoMinutos || reg.duracaoMinutos || 0);
      cur.questions += Number(reg.questoesFeitas || 0);
      cur.correct += Number(reg.acertos || 0);
      statsByUid.set(reg.uid, cur);

      if ((now - reg.timestamp) < 604800000) active7Days.add(reg.uid);
      if ((now - reg.timestamp) < 86400000) active24Hours.add(reg.uid);
    });

    const enrichedUsers = users.map(u => {
      const stats = statsByUid.get(u.id) || { minutes: 0, questions: 0, correct: 0 };
      const userRecs = studyRecords.filter(r => r.uid === u.id);
      const lastStudy = userRecs.length > 0 ? userRecs[0].timestamp : null;

      let status = 'inactive';
      if (lastStudy && (now - lastStudy) < 604800000) status = 'active';
      else if (lastStudy) status = 'churn_risk';

      return { ...u, totalHours: Math.round(stats.minutes / 60), lastStudy, status, totalQuestions: stats.questions };
    }).sort((a, b) => (b.lastStudy || 0) - (a.lastStudy || 0));

    return {
      totalUsers: users.length,
      newUsers24h: users.filter(u => (new Date() - u.createdAt) < 86400000).length,
      active7d: active7Days.size,
      active24h: active24Hours.size,
      enrichedUsers,
    };
  }, [users, studyRecords]);

  const rankingList = useMemo(() => {
    const arr = [...dashboardData.enrichedUsers];
    if (rankingMetric === 'hours') arr.sort((a, b) => b.totalHours - a.totalHours);
    else arr.sort((a, b) => b.totalQuestions - a.totalQuestions);
    return arr.slice(0, rankingLimit);
  }, [dashboardData.enrichedUsers, rankingMetric, rankingLimit]);

  const feedList = useMemo(() => {
    const base = studyRecords;
    if (selectedFeedUid === 'all') return base.slice(0, 60);
    return base.filter(r => r.uid === selectedFeedUid).slice(0, 200);
  }, [studyRecords, selectedFeedUid]);

  const activeSessionsFresh = useMemo(() => {
    const TTL = 2 * 60 * 1000;
    return activeSessions.filter(s => (Date.now() - (toMillisSafe(s.updatedAt) || 0)) <= TTL);
  }, [activeSessions]);

  const studyingNowSessions = useMemo(() => {
     const rank = (s) => (!s.isPaused && s.phase !== 'rest' ? 0 : !s.isPaused ? 1 : 2);
     return [...activeSessionsFresh].sort((a, b) => rank(a) - rank(b));
  }, [activeSessionsFresh]);

  const exportToCSV = () => {
      const csv = "Nome,Email,Horas,Questões\n" + dashboardData.enrichedUsers.map(e => `${e.name},${e.email},${e.totalHours},${e.totalQuestions}`).join("\n");
      const link = document.createElement("a");
      link.href = encodeURI("data:text/csv;charset=utf-8," + csv);
      link.download = "alunos.csv";
      link.click();
  };

  const handleDeleteUser = async (uid) => {
    if (window.confirm("Apagar usuário e dados?")) await deleteDoc(doc(db, 'users', uid));
  };

  return (
    <div className="w-full pb-20 animate-slide-up space-y-8 max-w-[1600px] mx-auto px-4 sm:px-6 pt-10">

      {/* --- MODAIS DE SUPORTE --- */}
      <EditaisManagerModal isOpen={showEditaisModal} onClose={() => setShowEditaisModal(false)} />
      <UserDetailModal isOpen={!!detailUser} onClose={() => setDetailUser(null)} user={detailUser} records={studyRecords} />

      {/* --- MODAL EXPANDIDO (Tabelas) --- */}
      <ExpandedModal isOpen={!!expandedView} onClose={() => setExpandedView(null)} title={expandedView === 'users' ? "Base de Alunos" : "Feed Completo"}>
        <div className="space-y-6">
            <div className="flex justify-between items-center sticky top-0 bg-white dark:bg-zinc-950 z-20 py-2">
                <div className="flex items-center gap-3 bg-zinc-100 dark:bg-zinc-900 p-2.5 rounded-2xl w-96 border border-zinc-200 dark:border-zinc-800">
                    <Search size={18} className="text-zinc-400"/>
                    <input className="bg-transparent outline-none w-full text-sm font-medium text-zinc-900 dark:text-white placeholder:text-zinc-500" placeholder="Buscar aluno..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)}/>
                </div>
                {expandedView === 'users' && (
                    <button onClick={exportToCSV} className="flex items-center gap-2 px-5 py-2.5 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 rounded-xl font-bold text-xs hover:opacity-90 transition-opacity">
                        <FileSpreadsheet size={16}/> Exportar CSV
                    </button>
                )}
            </div>
            {expandedView === 'users' ? (
                <div className="grid grid-cols-1 gap-2">
                    <div className="grid grid-cols-12 gap-4 px-4 py-2 bg-zinc-50 dark:bg-zinc-900/50 rounded-lg text-xs font-bold uppercase text-zinc-400 tracking-wider">
                        <div className="col-span-4">Aluno</div>
                        <div className="col-span-4">Email</div>
                        <div className="col-span-2 text-center">Horas</div>
                        <div className="col-span-2 text-right">Ação</div>
                    </div>
                    {dashboardData.enrichedUsers.filter(u => u.name?.toLowerCase().includes(searchTerm.toLowerCase())).map(u => (
                        <div key={u.id} className="grid grid-cols-12 gap-4 items-center p-3 rounded-2xl hover:bg-zinc-50 dark:hover:bg-zinc-900 border border-transparent hover:border-zinc-200 dark:hover:border-zinc-800 transition-all cursor-pointer group" onClick={() => setDetailUser(u)}>
                            <div className="col-span-4 flex items-center gap-3">
                                <Avatar user={u} size="sm" />
                                <span className="font-bold text-zinc-900 dark:text-white">{u.name}</span>
                            </div>
                            <div className="col-span-4 text-sm text-zinc-500">{u.email}</div>
                            <div className="col-span-2 text-center"><span className="px-2 py-1 rounded bg-zinc-100 dark:bg-zinc-800 font-bold text-xs text-zinc-700 dark:text-zinc-300">{u.totalHours}h</span></div>
                            <div className="col-span-2 text-right">
                                <button onClick={(e) => { e.stopPropagation(); handleDeleteUser(u.id); }} className="p-2 text-zinc-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg opacity-0 group-hover:opacity-100 transition-all"><Trash2 size={16}/></button>
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <div className="space-y-2">
                    {feedList.map(r => (
                        <div key={r.id} className="p-4 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 flex justify-between items-center">
                            <div className="flex items-center gap-3">
                                <Avatar user={getUser(r.uid)} size="sm" />
                                <div>
                                    <p className="font-bold text-sm text-zinc-900 dark:text-white">{getUser(r.uid).name}</p>
                                    <p className="text-xs text-zinc-500">{r.disciplinaNome} • {r.assunto || 'Geral'}</p>
                                </div>
                            </div>
                            <span className="text-xs font-medium text-zinc-400">{formatTimeAgo(r.timestamp)}</span>
                        </div>
                    ))}
                </div>
            )}
        </div>
      </ExpandedModal>

      {/* --- HEADER DE BOAS VINDAS --- */}
      <HeaderAdmin newUsersCount={dashboardData.newUsers24h} />

      {loading ? (
        <div className="flex flex-col items-center justify-center py-32 space-y-4">
            <Loader2 size={48} className="animate-spin text-red-600"/>
            <p className="text-zinc-400 font-medium animate-pulse">Sincronizando QG...</p>
        </div>
      ) : (
        <div className="space-y-6">

          {/* --- [LINHA 1] KPIs e Ações --- */}
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            <div className="lg:col-span-3 grid grid-cols-1 md:grid-cols-3 gap-6">
                <KpiCard color="zinc" icon={Users} title="Total Alunos" value={dashboardData.totalUsers} subValue="Cadastrados" trend={Math.round((dashboardData.newUsers24h / dashboardData.totalUsers) * 100)} />
                <KpiCard color="emerald" icon={Target} title="Engajados (7d)" value={dashboardData.active7d} subValue="Estudaram essa semana" />
                <KpiCard color="amber" icon={Radio} title="Online (24h)" value={dashboardData.active24h} subValue="Plantão Ativo" />
            </div>

            {/* Card de Gerenciar Editais (Botão de Ação Destacado) */}
            <div onClick={() => setShowEditaisModal(true)} className="bg-zinc-900 text-white rounded-3xl p-6 flex flex-col justify-between cursor-pointer group shadow-xl shadow-zinc-900/20 hover:scale-[1.02] transition-all relative overflow-hidden h-full min-h-[140px]">
                <div className="relative z-10">
                    <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center mb-3 backdrop-blur-sm">
                        <Server size={20} className="text-red-500" />
                    </div>
                    <h3 className="text-xl font-black uppercase leading-tight">Gerenciar<br/>Editais</h3>
                </div>
                <div className="relative z-10 flex justify-between items-end">
                    <p className="text-xs text-zinc-400 font-medium">Templates & Seeds</p>
                    <ChevronRight className="opacity-50 group-hover:translate-x-1 transition-transform" />
                </div>
                <div className="absolute top-0 right-0 w-32 h-32 bg-red-600/20 blur-3xl rounded-full -mr-10 -mt-10 pointer-events-none"></div>
            </div>
          </div>

          {/* --- [LINHA 2] Live Monitor (Dividido 50/50) --- */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-auto lg:h-[600px]">

            {/* Esquerda: Estudando Agora */}
            <div className="h-full flex flex-col">
                <StudyingNowPanel
                    sessions={studyingNowSessions}
                    getUser={getUser}
                    cicloNameByKey={cicloNameByKey}
                    onOpenUser={setDetailUser}
                />
            </div>

            {/* Direita: Feed de Guerra */}
            <BentoCard
                title="Feed de Guerra"
                subtitle="Registro de atividades em tempo real"
                icon={Activity}
                className="h-full bg-zinc-50/50 dark:bg-zinc-900/50"
                isLive={true}
                action={
                    <button onClick={() => setExpandedView('studies')} className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg text-zinc-400 transition-colors">
                        <Maximize2 size={16}/>
                    </button>
                }
            >
               <div className="relative h-full overflow-hidden">
                   <div className="absolute left-[19px] top-0 bottom-0 w-px bg-zinc-200 dark:bg-zinc-800 z-0"></div>
                   <div className="overflow-y-auto h-full space-y-4 pr-2 pb-4 relative z-10 custom-scrollbar">
                       {feedList.map((r, i) => {
                           const u = getUser(r.uid);
                           return (
                               <div key={r.id} onClick={() => setDetailUser(u)} className="flex gap-4 group cursor-pointer pl-1">
                                   <div className="mt-1 relative flex-shrink-0">
                                       <div className={`w-9 h-9 rounded-full border-[3px] border-white dark:border-zinc-950 flex items-center justify-center z-10 relative ${i===0 ? 'bg-red-500 shadow-lg shadow-red-500/30' : 'bg-zinc-200 dark:bg-zinc-800'}`}>
                                            {i===0 ? <Zap size={14} className="text-white fill-white"/> : <Clock size={14} className="text-zinc-500"/>}
                                       </div>
                                   </div>
                                   <div className="flex-1 bg-white dark:bg-zinc-900 p-3 rounded-2xl border border-zinc-100 dark:border-zinc-800 shadow-sm group-hover:border-red-200 dark:group-hover:border-red-900/30 transition-all">
                                       <div className="flex justify-between items-start mb-1">
                                           <div className="flex items-center gap-2">
                                               <Avatar user={u} size="sm" className="w-5 h-5 rounded-md" />
                                               <p className="text-xs font-bold text-zinc-900 dark:text-white truncate max-w-[100px]">{u.name}</p>
                                           </div>
                                           <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wide">{formatTimeAgo(r.timestamp)}</span>
                                       </div>
                                       <p className="text-xs font-medium text-zinc-600 dark:text-zinc-400 line-clamp-1 mt-1">
                                           Estudou <span className="text-red-600 dark:text-red-400 font-bold">{r.disciplinaNome}</span>
                                       </p>
                                       <div className="flex items-center gap-2 mt-2">
                                            <span className="text-[9px] font-black bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 rounded text-zinc-500">{formatHMFromMinutes(r.tempoEstudadoMinutos)}</span>
                                            {r.questoesFeitas > 0 && <span className="text-[9px] font-black bg-emerald-50 dark:bg-emerald-900/20 px-2 py-0.5 rounded text-emerald-600">{r.questoesFeitas}q</span>}
                                       </div>
                                   </div>
                               </div>
                           )
                       })}
                   </div>
                   {/* Fade Bottom */}
                   <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-white dark:from-zinc-950 to-transparent pointer-events-none z-20"></div>
               </div>
            </BentoCard>
          </div>

          {/* --- [LINHA 3] Novos Alunos e Ranking --- */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

            {/* Coluna 1: Novos Alunos */}
            <BentoCard title="Novos Alunos" icon={Users} className="h-[500px]" action={<button onClick={() => setExpandedView('users')} className="text-zinc-400 hover:text-red-500"><MoreHorizontal size={20}/></button>}>
                <div className="space-y-2 overflow-y-auto h-full pr-1 pb-4 custom-scrollbar">
                    {users.slice(0, 15).map(u => (
                        <div key={u.id} onClick={() => setDetailUser(u)} className="flex items-center gap-3 p-3 rounded-2xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 hover:border-red-200 cursor-pointer transition-colors group">
                            <Avatar user={u} size="md" />
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-bold text-zinc-900 dark:text-white truncate group-hover:text-red-600 transition-colors">{u.name}</p>
                                <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wide">{formatTimeAgo(u.createdAt)}</p>
                            </div>
                        </div>
                    ))}
                </div>
            </BentoCard>

            {/* Coluna 2 e 3: Ranking Global */}
            <div className="lg:col-span-2">
                <BentoCard title="Ranking Global" subtitle="Melhores desempenhos da plataforma" icon={Trophy} className="h-[500px]"
                    action={
                        <div className="flex gap-2 p-1 bg-zinc-100 dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800">
                            <button onClick={() => setRankingMetric('hours')} className={`px-3 py-1.5 text-[10px] font-black uppercase rounded-lg transition-all ${rankingMetric==='hours'?'bg-white dark:bg-zinc-800 shadow text-red-600':'text-zinc-400 hover:text-zinc-600'}`}>Horas</button>
                            <button onClick={() => setRankingMetric('questions')} className={`px-3 py-1.5 text-[10px] font-black uppercase rounded-lg transition-all ${rankingMetric==='questions'?'bg-white dark:bg-zinc-800 shadow text-red-600':'text-zinc-400 hover:text-zinc-600'}`}>Questões</button>
                        </div>
                    }
                >
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 h-full overflow-y-auto pr-2 pb-4 custom-scrollbar content-start">
                        {rankingList.map((u, i) => (
                            <div key={u.id} onClick={() => setDetailUser(u)} className="flex items-center gap-4 p-4 rounded-3xl bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-100 dark:border-zinc-800 cursor-pointer hover:border-red-200 dark:hover:border-red-900/50 hover:bg-white dark:hover:bg-zinc-900 transition-all group">
                                <div className={`w-8 h-8 rounded-xl flex items-center justify-center font-black text-sm ${i < 3 ? 'bg-gradient-to-br from-yellow-400 to-orange-500 text-white shadow-lg shadow-orange-500/20' : 'bg-zinc-200 dark:bg-zinc-800 text-zinc-500'}`}>
                                    {i+1}
                                </div>
                                <Avatar user={u} />
                                <div className="flex-1 min-w-0">
                                    <p className="font-bold text-sm text-zinc-900 dark:text-white truncate group-hover:text-red-600 transition-colors">{u.name}</p>
                                    <div className="flex gap-3 text-[10px] font-bold text-zinc-400 mt-0.5 uppercase tracking-wide">
                                        <span className={rankingMetric === 'hours' ? 'text-zinc-800 dark:text-zinc-200' : ''}>{u.totalHours}h Estudo</span>
                                        <span className={rankingMetric === 'questions' ? 'text-zinc-800 dark:text-zinc-200' : ''}>{u.totalQuestions} Questões</span>
                                    </div>
                                </div>
                                {i < 3 && <Trophy size={16} className="text-yellow-500 opacity-0 group-hover:opacity-100 transition-opacity" />}
                            </div>
                        ))}
                    </div>
                </BentoCard>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}

export default AdminPage;