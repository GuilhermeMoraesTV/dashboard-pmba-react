import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { db } from '../firebaseConfig';
import { collection, query, collectionGroup, deleteDoc, doc, onSnapshot, orderBy, limit } from 'firebase/firestore';
import {
  Users, Activity, Server, Loader2, Search, Maximize2, Trash2, X, FileSpreadsheet, Target,
  SlidersHorizontal, ListFilter, Clock, Zap, ArrowUpRight, ArrowDownRight, ExternalLink, Database, Trophy
} from 'lucide-react';

// --- IMPORTS DOS COMPONENTES SEPARADOS ---
import HeaderAdmin from './AdminPage/HeaderAdmin';
import EditaisManagerModal from './AdminPage/EditaisManager';
import StudyingNowPanel from './AdminPage/LiveStudyMonitor'; // LiveStudyMonitor renomeado
import UserDetailModal from './AdminPage/UserDetailModal';

// --- HELPERS E COMPONENTES VISUAIS DA PÁGINA ---
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

const Avatar = ({ user, size = "md" }) => {
    const sizeClasses = { sm: "w-8 h-8 text-[10px]", md: "w-10 h-10 text-xs" };
    return (
      <div className={`${sizeClasses[size]} rounded-full flex-shrink-0 bg-zinc-100 dark:bg-zinc-800 border-2 border-white dark:border-zinc-700 shadow-sm overflow-hidden flex items-center justify-center`}>
        {user?.photoURL ? <img src={user.photoURL} className="w-full h-full object-cover" /> : <Users size={14} className="text-zinc-500" />}
      </div>
    );
};

// Modal Genérico para Tabelas
const ExpandedModal = ({ isOpen, onClose, title, children }) => {
    useEffect(() => { document.body.style.overflow = isOpen ? 'hidden' : 'unset'; }, [isOpen]);
    if (!isOpen) return null;
    return (
      <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-fade-in">
        <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-white dark:bg-zinc-950 w-full max-w-6xl max-h-[90vh] rounded-3xl border border-zinc-200 shadow-2xl flex flex-col overflow-hidden">
          <div className="p-6 border-b border-zinc-100 flex justify-between items-center bg-zinc-50/50">
            <h3 className="text-2xl font-black">{title}</h3>
            <button onClick={onClose}><X size={24} /></button>
          </div>
          <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">{children}</div>
        </motion.div>
      </div>
    );
};

const PerformanceMetricCard = ({ title, value, subValue, icon: Icon, color, trend }) => {
    const style = {
      zinc: { iconBg: 'bg-zinc-50', iconColor: 'text-zinc-600', border: 'border-zinc-200' },
      red: { iconBg: 'bg-red-50', iconColor: 'text-red-600', border: 'border-red-100' },
      amber: { iconBg: 'bg-amber-50', iconColor: 'text-amber-600', border: 'border-amber-100' },
    }[color] || { iconBg: 'bg-blue-50', iconColor: 'text-blue-600', border: 'border-blue-100' };

    return (
      <div className={`relative overflow-hidden bg-white dark:bg-zinc-950 border ${style.border} rounded-2xl p-5 flex flex-col justify-between shadow-sm min-h-[140px]`}>
        <div className="flex justify-between items-start mb-4 relative z-10">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 mb-1 flex items-center gap-1">
              {title} {trend && <span className="ml-2 px-1.5 py-0.5 rounded text-[9px] bg-emerald-100 text-emerald-700">+{trend}%</span>}
            </p>
            <h3 className="text-3xl font-black tracking-tighter leading-none">{value}</h3>
          </div>
          <div className={`p-3 rounded-xl ${style.iconBg} ${style.iconColor}`}><Icon size={20} /></div>
        </div>
        <p className="text-xs font-medium text-zinc-500 relative z-10">{subValue}</p>
        <Icon className={`absolute -bottom-6 -right-6 w-32 h-32 opacity-[0.05] pointer-events-none transform -rotate-12 ${style.iconColor}`} />
      </div>
    );
};

const CardContainer = ({ title, subtitle, icon: Icon, children, className = "", action, footer, isLive = false }) => (
    <div className={`bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-sm flex flex-col ${className}`}>
      <div className="p-5 md:p-6 pb-2 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-zinc-100 dark:bg-zinc-900 rounded-lg text-zinc-500 border border-zinc-200 relative">
            <Icon size={18} />
            {isLive && <span className="absolute -top-1 -right-1 flex h-3 w-3"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span><span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span></span>}
          </div>
          <div>
            <h3 className="text-sm font-extrabold uppercase tracking-tight flex items-center gap-2">{title}</h3>
            {subtitle && <p className="text-xs font-medium text-zinc-500">{subtitle}</p>}
          </div>
        </div>
        {action}
      </div>
      <div className="flex-1 w-full min-h-0 relative p-5 md:p-6 pt-2">{children}</div>
      {footer && <div className="border-t border-zinc-100 p-3 bg-zinc-50/50 rounded-b-2xl">{footer}</div>}
    </div>
);

// --- PÁGINA ADMIN PRINCIPAL ---
function AdminPage() {
  const [users, setUsers] = useState([]);
  const [studyRecords, setStudyRecords] = useState([]);
  const [activeSessions, setActiveSessions] = useState([]);
  const [loading, setLoading] = useState(true);

  // Modais e Views
  const [expandedView, setExpandedView] = useState(null); // 'users', 'studies', 'newUsers'
  const [showEditaisModal, setShowEditaisModal] = useState(false);
  const [detailUser, setDetailUser] = useState(null);

  // Filtros e Rankings
  const [searchTerm, setSearchTerm] = useState('');
  const [rankingMetric, setRankingMetric] = useState('hours');
  const [rankingLimit, setRankingLimit] = useState(10);
  const [selectedFeedUid, setSelectedFeedUid] = useState('all');

  // Cache de Ciclos
  const [cicloNameByKey, setCicloNameByKey] = useState(new Map());

  // 1. Fetch Users
  useEffect(() => {
    const q = query(collection(db, 'users'), orderBy('createdAt', 'desc'));
    return onSnapshot(q, (snap) => {
      setUsers(snap.docs.map(doc => ({ id: doc.id, ...doc.data(), createdAt: doc.data().createdAt?.toDate ? doc.data().createdAt.toDate() : new Date() })));
      setLoading(false);
    });
  }, []);

  // 2. Fetch Records
  useEffect(() => {
    const q = query(collectionGroup(db, 'registrosEstudo'), orderBy('timestamp', 'desc'), limit(1000));
    return onSnapshot(q, (snap) => setStudyRecords(snap.docs.map(doc => ({ id: doc.id, uid: doc.data().uid || doc.ref.path.split('/')[1], ...doc.data(), timestamp: doc.data().timestamp?.toDate?.() || new Date() }))));
  }, []);

  // 3. Fetch Active Sessions
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

  // 4. Cache Ciclos
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

  // Cálculos de Dashboard
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

      const accuracy = stats.questions > 0 ? Math.round((stats.correct / stats.questions) * 100) : null;
      return { ...u, totalHours: Math.round(stats.minutes / 60), lastStudy, status, totalQuestions: stats.questions, accuracy };
    }).sort((a, b) => (b.lastStudy || 0) - (a.lastStudy || 0));

    return {
      totalUsers: users.length,
      newUsers24h: users.filter(u => (new Date() - u.createdAt) < 86400000).length,
      active7d: active7Days.size,
      active24h: active24Hours.size,
      enrichedUsers,
    };
  }, [users, studyRecords]);

  // Listas Processadas
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
     // Sort simples: Foco -> Descanso -> Pausado
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
    <div className="w-full pb-20 animate-slide-up space-y-6 max-w-7xl mx-auto px-4 pt-8">
      {/* COMPONENTES MODAIS */}
      <EditaisManagerModal isOpen={showEditaisModal} onClose={() => setShowEditaisModal(false)} />
      <UserDetailModal isOpen={!!detailUser} onClose={() => setDetailUser(null)} user={detailUser} records={studyRecords} />

      {/* HEADER ISOLADO */}
      <HeaderAdmin newUsersCount={dashboardData.newUsers24h} />

      {/* MODAL EXPANDIDO (VISÃO DE TABELA) */}
      <ExpandedModal isOpen={!!expandedView} onClose={() => setExpandedView(null)} title="Visão Detalhada">
        <div className="space-y-4">
            <div className="flex justify-between">
                <div className="flex items-center gap-2 bg-zinc-100 p-2 rounded-xl w-96"><Search size={18} className="text-zinc-400"/><input className="bg-transparent outline-none w-full text-sm" placeholder="Buscar..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)}/></div>
                {expandedView === 'users' && <button onClick={exportToCSV} className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-xl font-bold text-xs"><FileSpreadsheet size={16}/> CSV</button>}
            </div>
            {expandedView === 'users' ? (
                <table className="w-full text-left text-sm"><thead className="bg-zinc-100 font-bold uppercase text-xs text-zinc-500"><tr><th className="p-3">Aluno</th><th className="p-3">Email</th><th className="p-3 text-center">Horas</th><th className="p-3 text-right">Ação</th></tr></thead>
                <tbody>{dashboardData.enrichedUsers.filter(u => u.name?.toLowerCase().includes(searchTerm.toLowerCase())).map(u => (
                    <tr key={u.id} className="border-b border-zinc-100"><td className="p-3 font-bold" onClick={() => setDetailUser(u)}>{u.name}</td><td className="p-3 text-zinc-500">{u.email}</td><td className="p-3 text-center text-red-600 font-black">{u.totalHours}h</td><td className="p-3 text-right"><button onClick={() => handleDeleteUser(u.id)}><Trash2 size={16}/></button></td></tr>
                ))}</tbody></table>
            ) : (
                <div className="space-y-2">{feedList.map(r => <div key={r.id} className="p-3 border rounded">{r.disciplinaNome} - {formatTimeAgo(r.timestamp)}</div>)}</div>
            )}
        </div>
      </ExpandedModal>

      {loading ? <div className="flex justify-center py-20"><Loader2 size={48} className="animate-spin text-red-600"/></div> : (
        <>
          {/* KPI CARDS */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4">
            <PerformanceMetricCard color="zinc" icon={Users} title="Total Alunos" value={dashboardData.totalUsers} subValue="Na plataforma" trend={2} />
            <PerformanceMetricCard color="red" icon={Target} title="Ativos (7d)" value={dashboardData.active7d} subValue="Engajamento Real" />
            <PerformanceMetricCard color="amber" icon={Activity} title="Online (24h)" value={dashboardData.active24h} subValue="Plantão QAP" />
          </div>

          {/* GRID PRINCIPAL */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div onClick={() => setShowEditaisModal(true)} className="lg:col-span-2 bg-gradient-to-r from-zinc-900 to-zinc-800 text-white p-6 rounded-2xl shadow-lg cursor-pointer hover:shadow-red-900/20 transition-all flex items-center justify-between group relative overflow-hidden border border-zinc-800">
               <div className="relative z-10 flex items-center gap-5">
                 <div className="p-4 bg-white/10 rounded-2xl"><Server size={32} className="text-red-500" /></div>
                 <div><h3 className="text-xl font-black uppercase">Instalação de Editais</h3><p className="text-sm text-zinc-400">Gerenciar Seeds e Templates.</p></div>
               </div>
               <ExternalLink className="relative z-10 text-red-500" size={32} />
               <Database className="absolute right-0 top-0 opacity-10 w-40 h-40" />
            </div>

            <CardContainer title="Novos Usuários" subtitle="Entradas recentes" icon={Users} isLive={true} className="h-[220px]" action={<button onClick={() => setExpandedView('users')}><Maximize2 size={16} /></button>}>
                <div className="space-y-2 overflow-y-auto h-full pr-1">{users.slice(0, 8).map(u => (
                    <div key={u.id} onClick={() => setDetailUser(u)} className="flex items-center gap-2 p-2 rounded-xl bg-zinc-50 border hover:bg-zinc-100 cursor-pointer">
                        <Avatar user={u} size="sm" /><div className="flex-1 min-w-0"><p className="text-xs font-bold truncate">{u.name}</p><p className="text-[10px] text-zinc-400">{formatTimeAgo(u.createdAt)}</p></div>
                    </div>
                ))}</div>
            </CardContainer>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <StudyingNowPanel sessions={studyingNowSessions} getUser={getUser} cicloNameByKey={cicloNameByKey} onOpenUser={setDetailUser} />

            <CardContainer title="Ranking" subtitle="Melhores Alunos" icon={Trophy} className="h-[520px]" action={
                <div className="flex gap-2">
                    <select value={rankingLimit} onChange={(e) => setRankingLimit(Number(e.target.value))} className="bg-transparent text-[10px] font-bold"><option value={10}>Top 10</option><option value={50}>Top 50</option></select>
                    <button onClick={() => setRankingMetric('hours')} className={`px-2 py-1 text-[10px] font-bold rounded ${rankingMetric==='hours'?'bg-red-600 text-white':'bg-zinc-100'}`}>Horas</button>
                    <button onClick={() => setRankingMetric('questions')} className={`px-2 py-1 text-[10px] font-bold rounded ${rankingMetric==='questions'?'bg-red-600 text-white':'bg-zinc-100'}`}>Questões</button>
                </div>
            }>
                <div className="overflow-y-auto h-full space-y-2 pr-1">
                    {rankingList.map((u, i) => (
                        <div key={u.id} onClick={() => setDetailUser(u)} className="flex items-center gap-3 p-3 rounded-2xl bg-zinc-50 border cursor-pointer hover:border-red-200">
                            <span className="font-black w-6 text-center text-zinc-400">{i+1}</span>
                            <Avatar user={u} />
                            <div className="flex-1"><p className="font-bold text-sm">{u.name}</p><div className="flex gap-2 text-[10px] font-black text-zinc-500"><span>⏱ {u.totalHours}h</span><span>🎯 {u.totalQuestions}q</span></div></div>
                        </div>
                    ))}
                </div>
            </CardContainer>
          </div>

          <CardContainer title="Feed Ao Vivo" subtitle="Últimas sessões" icon={Activity} isLive={true} className="h-[620px]" action={
              <div className="flex gap-2 items-center">
                  <ListFilter size={14}/><select value={selectedFeedUid} onChange={(e) => setSelectedFeedUid(e.target.value)} className="bg-transparent text-[10px] font-bold max-w-[150px]"><option value="all">Todos</option>{dashboardData.enrichedUsers.slice(0,50).map(u=><option key={u.id} value={u.id}>{u.name}</option>)}</select>
                  <button onClick={() => setExpandedView('studies')}><Maximize2 size={16}/></button>
              </div>
          }>
               <div className="overflow-y-auto h-full space-y-3 pr-1">
                   {feedList.map(r => {
                       const u = getUser(r.uid);
                       return (
                           <div key={r.id} onClick={() => setDetailUser(u)} className="p-3 rounded-xl bg-white border hover:border-red-200 cursor-pointer">
                               <div className="flex gap-3">
                                   <Avatar user={u} size="sm" />
                                   <div>
                                       <p className="text-xs font-black">{u.name} <span className="text-zinc-400">• {r.disciplinaNome}</span></p>
                                       <div className="flex gap-2 mt-1 text-[10px] font-bold bg-zinc-50 w-fit px-2 rounded border"><Clock size={10}/> {formatHMFromMinutes(r.tempoEstudadoMinutos)}</div>
                                   </div>
                               </div>
                           </div>
                       )
                   })}
               </div>
          </CardContainer>
        </>
      )}
    </div>
  );
}

export default AdminPage;