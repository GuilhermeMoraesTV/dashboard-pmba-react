import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X, Users, Clock, Zap, Target, LayoutDashboard,
  Calendar, Award, ChevronRight,
  Activity, BarChart3, FileText, Settings, BookOpen
} from 'lucide-react';
import { collection, query, where, getDocs, limit } from 'firebase/firestore';
import { db } from '../../firebaseConfig';

// --- UTILS DE DATA ROBUSTOS ---
const parseDate = (value) => {
  if (!value) return null;
  if (value.toDate && typeof value.toDate === 'function') {
    return value.toDate();
  }
  return new Date(value);
};

const formatTimeAgo = (rawDate) => {
  const d = parseDate(rawDate);
  if (!d) return '-';

  const diff = Math.floor((new Date() - d) / 60000);
  if (diff < 1) return 'Agora mesmo';
  if (diff < 60) return `${diff}m atrás`;
  const hours = Math.floor(diff / 60);
  if (hours < 24) return `${hours}h atrás`;
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
};

const formatDuration = (minutes) => {
  const m = Math.max(0, Number(minutes) || 0);
  const h = Math.floor(m / 60);
  const mm = m % 60;
  if (h > 0) return `${h}h ${mm}m`;
  return `${mm}m`;
};

// --- COMPONENTES VISUAIS ---

const StatCard = ({ icon: Icon, label, value, subtext, color = "zinc", delay = 0 }) => {
  const colors = {
    red: "text-red-600 bg-red-50 dark:bg-red-900/20 border-red-100 dark:border-red-900/30",
    zinc: "text-zinc-600 dark:text-zinc-400 bg-zinc-50 dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800",
    blue: "text-blue-600 bg-blue-50 dark:bg-blue-900/20 border-blue-100 dark:border-blue-900/30",
    green: "text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20 border-emerald-100 dark:border-emerald-900/30",
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
      className={`p-4 rounded-2xl border ${colors[color].split(' ')[2]} ${colors[color].split(' ')[3]} ${colors[color].split(' ')[1]} relative overflow-hidden group`}
    >
      <div className="flex items-start justify-between relative z-10">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest opacity-70 mb-1">{label}</p>
          <h4 className="text-2xl font-black tracking-tight text-zinc-900 dark:text-white">{value}</h4>
          {subtext && <p className="text-xs font-medium opacity-60 mt-1">{subtext}</p>}
        </div>
        <div className={`p-2.5 rounded-xl ${colors[color].split(' ')[1]} dark:bg-black/20`}>
          <Icon size={18} className={colors[color].split(' ')[0]} />
        </div>
      </div>
    </motion.div>
  );
};

const Avatar = ({ user }) => {
  return (
    <div className={`w-20 h-20 rounded-3xl flex-shrink-0 bg-gradient-to-br from-zinc-100 to-zinc-200 dark:from-zinc-800 dark:to-zinc-900 border-4 border-white dark:border-zinc-800 shadow-xl overflow-hidden flex items-center justify-center relative ring-1 ring-zinc-200 dark:ring-zinc-700`}>
      {user?.photoURL ? (
        <img src={user.photoURL} alt={user?.name} className="w-full h-full object-cover" />
      ) : (
        <span className="font-black text-zinc-400 dark:text-zinc-500 text-2xl">
          {user?.name ? user.name.substring(0, 2).toUpperCase() : <Users size={24} />}
        </span>
      )}
    </div>
  );
};

// --- MODAL PRINCIPAL ---

const UserDetailModal = ({ isOpen, onClose, user, records = [] }) => {
  const [activeTab, setActiveTab] = useState('overview');
  const [liveActiveCycle, setLiveActiveCycle] = useState(null);
  const [isLoadingCycle, setIsLoadingCycle] = useState(false);

  // 1. EFEITO PARA BUSCAR CICLO ATIVO (Dependência corrigida para evitar piscar)
  useEffect(() => {
    if (isOpen && user?.uid) {
      const fetchActiveCycle = async () => {
        setIsLoadingCycle(true);
        try {
          const ciclosRef = collection(db, 'users', user.uid, 'ciclos');
          const q = query(ciclosRef, where('ativo', '==', true), limit(1));
          const querySnapshot = await getDocs(q);

          if (!querySnapshot.empty) {
            const docData = querySnapshot.docs[0].data();

            // Verifica se tem editalId OU templateId (para compatibilidade com ciclos antigos)
            const isEdital = !!docData.editalId || !!docData.templateId;

            setLiveActiveCycle({
              id: querySnapshot.docs[0].id,
              ...docData,
              tipoInferido: isEdital ? 'Edital Base' : 'Ciclo Manual'
            });
          } else {
            setLiveActiveCycle(null);
          }
        } catch (error) {
          console.error("Erro ao buscar ciclo ativo:", error);
        } finally {
          setIsLoadingCycle(false);
        }
      };
      fetchActiveCycle();
    }
  }, [isOpen, user?.uid]);

  // Bloqueio de scroll
  useEffect(() => {
    if (isOpen) document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = 'unset'; };
  }, [isOpen]);

  // Cálculos Estatísticos
  const stats = useMemo(() => {
    if (!user) return null;

    // Parse correto das datas
    const userRecords = records
      .filter(r => r.uid === user.id || r.uid === user.uid)
      .sort((a, b) => {
        const dateA = parseDate(a.timestamp) || new Date(0);
        const dateB = parseDate(b.timestamp) || new Date(0);
        return dateB - dateA;
      });

    const totalMinutes = userRecords.reduce((acc, r) => acc + Number(r.tempoEstudadoMinutos || r.duracaoMinutos || 0), 0);
    const totalQuestions = userRecords.reduce((acc, r) => acc + Number(r.questoesFeitas || 0), 0);
    const totalCorrect = userRecords.reduce((acc, r) => acc + Number(r.acertos || 0), 0);
    const accuracy = totalQuestions > 0 ? Math.round((totalCorrect / totalQuestions) * 100) : 0;

    const activeCycleId = liveActiveCycle?.id;
    const activeCycleRecords = activeCycleId
      ? userRecords.filter(r => r.cicloId === activeCycleId)
      : [];

    const cycleDisciplines = {};
    activeCycleRecords.forEach(r => {
      const discName = r.disciplinaNome || 'Geral';
      if (!cycleDisciplines[discName]) {
        cycleDisciplines[discName] = { time: 0, questions: 0, correct: 0, count: 0 };
      }
      cycleDisciplines[discName].time += Number(r.tempoEstudadoMinutos || 0);
      cycleDisciplines[discName].questions += Number(r.questoesFeitas || 0);
      cycleDisciplines[discName].correct += Number(r.acertos || 0);
      cycleDisciplines[discName].count += 1;
    });

    const level = Math.floor((totalMinutes / 60) / 5) + 1;

    return {
      userRecords,
      totalMinutes,
      totalQuestions,
      accuracy,
      level,
      cycleStats: activeCycleRecords,
      cycleDisciplines: Object.entries(cycleDisciplines).sort((a, b) => b[1].time - a[1].time)
    };
  }, [user, records, liveActiveCycle]);

  if (!isOpen || !user) return null;

  // --- ABAS ---

  const OverviewTab = () => (
    <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} className="space-y-6 pb-12">
      {/* Cards de Topo */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={Clock} label="Tempo Total" value={Math.floor(stats.totalMinutes / 60) + "h"} subtext={`${stats.totalMinutes % 60}min exatos`} color="zinc" delay={0.1} />
        <StatCard icon={Zap} label="Questões" value={stats.totalQuestions} subtext="Resolvidas" color="blue" delay={0.2} />
        <StatCard icon={Target} label="Precisão Global" value={`${stats.accuracy}%`} subtext="Taxa de acerto" color={stats.accuracy > 70 ? "green" : "red"} delay={0.3} />
        <StatCard icon={Award} label="Nível Atual" value={`Lvl ${stats.level}`} subtext="Empenho" color="red" delay={0.4} />
      </div>

      {/* Card Ciclo Ativo */}
      <div className="relative group overflow-hidden rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 shadow-lg">
        <div className="absolute top-0 left-0 w-1 h-full bg-red-600"></div>
        <div className="p-6 relative z-10">
          <div className="flex justify-between items-start mb-4">
            <div>
              <span className="flex items-center gap-2 text-red-600 font-bold uppercase text-[10px] tracking-widest mb-1">
                <Activity size={12} /> Ciclo Ativo Agora
              </span>

              {isLoadingCycle ? (
                <div className="animate-pulse h-8 w-48 bg-zinc-200 dark:bg-zinc-800 rounded mt-2"></div>
              ) : liveActiveCycle ? (
                <>
                  <h3 className="text-2xl font-black text-zinc-900 dark:text-white">{liveActiveCycle.nome}</h3>
                  <div className="flex gap-2 mt-2">
                    <span className={`text-[10px] font-bold px-2 py-1 rounded border uppercase tracking-wider ${
                      liveActiveCycle.tipoInferido === 'Edital Base'
                        ? 'bg-blue-50 text-blue-700 border-blue-100'
                        : 'bg-amber-50 text-amber-700 border-amber-100'
                    }`}>
                      {liveActiveCycle.tipoInferido === 'Edital Base' ? <FileText size={10} className="inline mr-1"/> : <Settings size={10} className="inline mr-1"/>}
                      {liveActiveCycle.tipoInferido}
                    </span>
                    <span className="text-[10px] font-bold px-2 py-1 rounded bg-zinc-100 text-zinc-600 border border-zinc-200 uppercase tracking-wider">
                        {/* Exibe Data N/A se o campo não existir (ciclos antigos) */}
                        Criado em {liveActiveCycle.criadoEm ? parseDate(liveActiveCycle.criadoEm).toLocaleDateString() : 'Data N/A'}
                    </span>
                  </div>
                </>
              ) : (
                <div className="text-zinc-400 font-medium italic">O usuário não possui nenhum ciclo ativo no momento.</div>
              )}
            </div>

            {liveActiveCycle && (
               <button onClick={() => setActiveTab('ciclo')} className="p-3 bg-red-50 hover:bg-red-100 text-red-600 rounded-xl transition-colors">
                 <ChevronRight size={20} />
               </button>
            )}
          </div>

          {liveActiveCycle && stats.cycleStats.length > 0 && (
             <div className="mt-4 pt-4 border-t border-zinc-100 dark:border-zinc-800 flex gap-6">
                <div>
                   <p className="text-[10px] uppercase text-zinc-400 font-bold">Tempo Dedicado</p>
                   <p className="font-bold text-zinc-800 dark:text-zinc-200">{formatDuration(stats.cycleStats.reduce((a,b)=>a+(b.tempoEstudadoMinutos||0),0))}</p>
                </div>
                <div>
                   <p className="text-[10px] uppercase text-zinc-400 font-bold">Sessões</p>
                   <p className="font-bold text-zinc-800 dark:text-zinc-200">{stats.cycleStats.length}</p>
                </div>
             </div>
          )}
        </div>
        <div className="absolute right-0 top-0 h-full w-32 bg-gradient-to-l from-zinc-50 to-transparent dark:from-zinc-900 opacity-50 pointer-events-none"></div>
      </div>
    </motion.div>
  );

  const CycleTab = () => (
    <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} className="space-y-4 pb-12">
      {!liveActiveCycle ? (
        <div className="flex flex-col items-center justify-center py-20 text-zinc-400">
          <BookOpen size={48} className="mb-4 opacity-20" />
          <p>Nenhum ciclo ativo encontrado para exibir detalhes.</p>
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between bg-red-50 dark:bg-red-900/10 p-4 rounded-xl border border-red-100 dark:border-red-900/20">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-red-100 dark:bg-red-900/40 rounded-lg text-red-600 dark:text-red-400">
                <LayoutDashboard size={20} />
              </div>
              <div>
                <p className="text-xs font-bold text-red-600 dark:text-red-400 uppercase tracking-wider">
                  {liveActiveCycle.tipoInferido}
                </p>
                <h3 className="text-lg font-black text-zinc-900 dark:text-white">{liveActiveCycle.nome}</h3>
              </div>
            </div>
          </div>

          {stats.cycleDisciplines.length === 0 ? (
             <div className="p-8 text-center bg-zinc-50 dark:bg-zinc-900/30 rounded-xl border border-dashed border-zinc-300 dark:border-zinc-700">
                <p className="text-zinc-500 font-medium">O aluno ativou este ciclo mas ainda não registrou estudos nele.</p>
             </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {stats.cycleDisciplines.map(([name, data], idx) => (
                <div key={idx} className="bg-white dark:bg-zinc-950 p-4 rounded-xl border border-zinc-100 dark:border-zinc-800 hover:border-red-200 transition-all">
                  <div className="flex justify-between items-start mb-3">
                    <h4 className="font-bold text-zinc-800 dark:text-zinc-200 line-clamp-1">{name}</h4>
                    <span className="text-[10px] font-bold bg-zinc-100 dark:bg-zinc-800 px-2 py-1 rounded text-zinc-500">
                      {data.count} sessões
                    </span>
                  </div>
                   <div className="space-y-3">
                    <div>
                        <div className="flex justify-between text-xs mb-1">
                        <span className="text-zinc-500 flex items-center gap-1"><Clock size={12}/> Tempo</span>
                        <span className="font-bold text-zinc-900 dark:text-white">{formatDuration(data.time)}</span>
                        </div>
                        <div className="h-1.5 w-full bg-zinc-100 dark:bg-zinc-900 rounded-full overflow-hidden">
                        <div className="h-full bg-zinc-800 dark:bg-zinc-600 rounded-full" style={{width: '100%'}} />
                        </div>
                    </div>
                    </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </motion.div>
  );

  const RecordsTab = () => (
    <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} className="space-y-3 pb-12">
      {stats.userRecords.length === 0 ? <div className="text-center py-10 text-zinc-400">Nenhum registro.</div> :
        stats.userRecords.slice(0, 50).map((r, i) => {
          const dateObj = parseDate(r.timestamp);
          return (
            <div key={r.id || i} className="group relative pl-6 pb-2 border-l-2 border-zinc-100 dark:border-zinc-800 last:border-0">
               <div className="absolute left-[-5px] top-0 w-2.5 h-2.5 rounded-full bg-zinc-200 dark:bg-zinc-700 border-2 border-white dark:border-zinc-950 group-hover:bg-red-500 transition-colors" />
               <div className="bg-white dark:bg-zinc-950 p-3 rounded-xl border border-zinc-100 dark:border-zinc-800 shadow-sm flex justify-between items-start gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                       <span className="text-[10px] uppercase font-bold text-zinc-400">
                          <Calendar size={10} className="inline mr-1"/>
                          {dateObj ? dateObj.toLocaleString('pt-BR') : '-'}
                       </span>

                       {/* TAG DO TIPO DE CICLO - Verifica se existe, senão usa manual como fallback */}
                       <span className={`text-[9px] font-black px-1.5 py-0.5 rounded border uppercase ${
                          (r.cicloTipo === 'Edital Base')
                          ? 'bg-blue-50 text-blue-600 border-blue-100'
                          : 'bg-amber-50 text-amber-600 border-amber-100'
                       }`}>
                          {(r.cicloTipo === 'Edital Base') ? 'Edital' : 'Manual'}
                       </span>
                    </div>
                    <h5 className="font-bold text-sm text-zinc-900 dark:text-white truncate">{r.disciplinaNome}</h5>
                    <p className="text-xs text-zinc-500 truncate mt-0.5">{r.assunto || 'Assunto Geral'}</p>
                    {r.cicloNome && <p className="text-[10px] text-zinc-400 mt-1 truncate">Ciclo: {r.cicloNome}</p>}
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <span className="text-xs font-black px-2 py-1 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-700">{formatDuration(r.tempoEstudadoMinutos || 0)}</span>
                    {r.questoesFeitas > 0 && (
                        <span className={`text-[10px] font-bold ${r.acertos/r.questoesFeitas >= 0.7 ? 'text-emerald-600' : 'text-red-600'}`}>
                          {Math.round((r.acertos/r.questoesFeitas)*100)}% acertos
                        </span>
                    )}
                  </div>
               </div>
            </div>
          );
        })
      }
    </motion.div>
  );

  return (
    <div className="fixed inset-0 z-[250] flex items-center justify-center p-4">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} className="absolute inset-0 bg-zinc-900/60 backdrop-blur-sm"/>
      <motion.div initial={{ scale: 0.9, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} className="relative bg-white dark:bg-zinc-950 w-full max-w-4xl max-h-[90vh] rounded-[32px] border border-white/20 shadow-2xl flex flex-col overflow-hidden">
        {/* HEADER */}
        <div className="relative z-10 p-6 pb-0 flex flex-col md:flex-row md:items-end justify-between gap-6 bg-gradient-to-b from-zinc-50/80 to-white/0 dark:from-zinc-900/80 dark:to-zinc-950/0">
          <div className="flex items-center gap-5">
            <Avatar user={user} size="lg" />
            <div>
              <h2 className="text-2xl md:text-3xl font-black text-zinc-900 dark:text-white tracking-tight">{user.name} <span className="text-red-600">.</span></h2>
              <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">{user.email}</p>
            </div>
          </div>
          <button onClick={onClose} className="absolute top-4 right-4 p-2 bg-zinc-100 hover:bg-red-50 hover:text-red-600 rounded-full transition-colors"><X size={20} /></button>
        </div>

        {/* NAVEGAÇÃO */}
        <div className="px-6 mt-6 mb-2">
          <div className="flex gap-1 p-1 bg-zinc-100 dark:bg-zinc-900/50 rounded-xl w-full sm:w-fit">
            {[ { id: 'overview', label: 'Visão Geral', icon: BarChart3 }, { id: 'ciclo', label: 'Ciclo Atual', icon: LayoutDashboard }, { id: 'records', label: 'Histórico', icon: Activity } ].map((tab) => (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`relative px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wide flex items-center gap-2 transition-all ${activeTab === tab.id ? 'text-white' : 'text-zinc-500 hover:text-zinc-900'}`}>
                {activeTab === tab.id && <motion.div layoutId="activeTab" className="absolute inset-0 bg-red-600 rounded-lg -z-10" />}
                <tab.icon size={14} /> {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* CONTEÚDO */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-6 bg-zinc-50/50 dark:bg-black/20 relative">
          <AnimatePresence mode="wait">
            {activeTab === 'overview' && <OverviewTab key="overview" />}
            {activeTab === 'ciclo' && <CycleTab key="ciclo" />}
            {activeTab === 'records' && <RecordsTab key="records" />}
          </AnimatePresence>
        </div>

        {/* FOOTER - MARCA D'ÁGUA PEQUENA */}
        <div className="absolute bottom-6 right-6 pointer-events-none z-50">
           <h1 className="text-red-600 font-black tracking-widest uppercase text-xs opacity-80">MODOQAP</h1>
        </div>

      </motion.div>
    </div>
  );
};

export default UserDetailModal;