import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { db } from '../firebaseConfig';
import {
    collection, getDocs, query, where, collectionGroup, Timestamp, doc, getDoc, deleteDoc
} from 'firebase/firestore';
import {
    BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell
} from 'recharts';

// --- IMPORTAÇÃO DOS SCRIPTS DE SEED ---
import SeedEditalPMBA from '../components/admin/SeedEditalPMBA';
import SeedEditalPPMG from '../components/admin/SeedEditalPPMG';
import SeedEditalPCBA from '../components/admin/SeedEditalPCBA';
import SeedEditalPMSE from '../components/admin/SeedEditalPMSE';
import SeedEditalPMGO from '../components/admin/SeedEditalPMGO';
import SeedEditalGCMAquiraz from '../components/admin/SeedEditalGCMAquiraz';
import SeedEditalPMAL from '../components/admin/SeedEditalPMAL';
import SeedEditalPMPE from '../components/admin/SeedEditalPMPE';
import SeedEditalPMPI from '../components/admin/SeedEditalPMPI'; // <--- IMPORT ADICIONADO CORRETAMENTE

import {
  ShieldAlert, Database, Users, Activity, Server, Lock,
  FileJson, Loader2, CheckCircle2, AlertTriangle, Search,
  Trophy, Clock, Target, TrendingUp, TrendingDown, Crown, Medal,
  Trash2, X, AlertOctagon, Download, RefreshCw
} from 'lucide-react';

// --- CONFIGURAÇÃO ---
const TEMPLATE_IDS = {
    PMBA: 'pmba_soldado',
    PPMG: 'ppmg_policial_penal',
    PCBA: 'pcba_investigador',
    PMSE: 'pmse_soldado',
    PMGO: 'pmgo_soldado',
    PMAL: 'pmal_soldado',
    PMPE: 'pmpe_soldado',
    PMPI: 'pmpi_soldado', // Corrigido espaço extra no nome
    GCMAquiraz: 'gcm_aquiraz'
};

const COLORS = ['#ef4444', '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#0ea5e9'];

// --- COMPONENTES VISUAIS ---

// 1. MODAL DE CONFIRMAÇÃO
const ConfirmationModal = ({ isOpen, onClose, onConfirm, title, message, variant = 'danger', loading }) => {
    if (!isOpen) return null;

    const isDanger = variant === 'danger';
    const Icon = isDanger ? AlertOctagon : AlertTriangle;
    const btnColor = isDanger ? 'bg-red-600 hover:bg-red-700' : 'bg-indigo-600 hover:bg-indigo-700';

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
            <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                className="bg-white dark:bg-zinc-900 w-full max-w-md rounded-2xl shadow-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden"
            >
                <div className="p-6">
                    <div className="flex items-start gap-4">
                        <div className={`p-3 rounded-full ${isDanger ? 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-500' : 'bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-500'}`}>
                            <Icon size={24} />
                        </div>
                        <div className="flex-1">
                            <h3 className="text-lg font-black text-zinc-900 dark:text-white mb-2">{title}</h3>
                            <p className="text-sm text-zinc-500 dark:text-zinc-400 leading-relaxed whitespace-pre-line">
                                {message}
                            </p>
                        </div>
                    </div>
                </div>
                <div className="bg-zinc-50 dark:bg-zinc-950/50 p-4 flex justify-end gap-3 border-t border-zinc-100 dark:border-zinc-800">
                    <button
                        onClick={onClose}
                        disabled={loading}
                        className="px-4 py-2 text-sm font-bold text-zinc-600 dark:text-zinc-400 hover:bg-white dark:hover:bg-zinc-800 rounded-lg border border-transparent hover:border-zinc-200 dark:hover:border-zinc-700 transition-all"
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={onConfirm}
                        disabled={loading}
                        className={`px-4 py-2 text-sm font-bold text-white rounded-lg shadow-lg shadow-indigo-500/20 transition-all flex items-center gap-2 ${btnColor} ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                        {loading ? <Loader2 size={16} className="animate-spin"/> : "Confirmar"}
                    </button>
                </div>
            </motion.div>
        </div>
    );
};

// 2. WRAPPER PARA INTERCEPTAR O BOTÃO DE INSTALAÇÃO
const SecureInstallWrapper = ({ children, isInstalled, editalTitle, onRequestInstall }) => {
    // Referência para o container escondido
    const hiddenContainerRef = useRef(null);

    // Função que "engana" o sistema: quando o modal confirma, clicamos no botão original escondido
    const triggerHiddenButton = () => {
        if (hiddenContainerRef.current) {
            const btn = hiddenContainerRef.current.querySelector('button');
            if (btn) {
                // Sobrescreve o window.confirm para retornar true automaticamente apenas para este clique
                const originalConfirm = window.confirm;
                window.confirm = () => true;
                btn.click();
                // Restaura o confirm original logo depois
                setTimeout(() => { window.confirm = originalConfirm; }, 100);
            }
        }
    };

    // Expomos a função de trigger para o componente pai via callback no Modal
    useEffect(() => {
        if(children.props.triggerRef) {
             children.props.triggerRef.current = triggerHiddenButton;
        }
    }, [children]);

    return (
        <>
            {/* Botão Visual Seguro */}
            <button
                onClick={() => onRequestInstall(triggerHiddenButton, isInstalled, editalTitle)}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wide transition-all shadow-sm ${
                    isInstalled
                    ? 'bg-white dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-700'
                    : 'bg-indigo-600 text-white hover:bg-indigo-700 hover:shadow-indigo-500/20'
                }`}
            >
                {isInstalled ? <><RefreshCw size={14}/> Reinstalar</> : <><Download size={14}/> Instalar</>}
            </button>

            {/* O Botão Original fica escondido aqui, mas funcional */}
            <div ref={hiddenContainerRef} style={{ display: 'none' }}>
                {children}
            </div>
        </>
    );
};

const AdminStatCardOriginal = ({ icon: Icon, label, value, subtext, colorClass, loading, delay }) => (
    <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay }}
        className="relative overflow-hidden bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-6 rounded-2xl shadow-sm group hover:border-zinc-300 dark:hover:border-zinc-700 transition-all"
    >
        <div className={`absolute -right-4 -bottom-4 opacity-10 group-hover:opacity-20 transition-opacity ${colorClass} rotate-12`}><Icon size={100} /></div>
        <div className="relative z-10">
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-4 ${colorClass.replace('text-', 'bg-').replace('600', '100').replace('500', '100')} dark:bg-opacity-10`}>
                <Icon size={24} className={colorClass} />
            </div>
            <h4 className="text-3xl font-black text-zinc-900 dark:text-white tracking-tight">
                {loading ? <Loader2 className="animate-spin h-6 w-6 text-zinc-300" /> : value}
            </h4>
            <p className="text-xs font-bold text-zinc-500 uppercase tracking-wide mt-1">{label}</p>
            {subtext && <p className="text-[10px] text-zinc-400 mt-2 font-medium">{subtext}</p>}
        </div>
    </motion.div>
);

const MiniStatCard = ({ icon: Icon, label, value, colorClass, loading }) => (
    <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-4 rounded-2xl shadow-sm flex items-center gap-4">
        <div className={`p-3 rounded-xl ${colorClass.replace('text-', 'bg-').replace('600', '100')} bg-opacity-20 text-opacity-100`}>
            <Icon size={20} className={colorClass} />
        </div>
        <div>
            <h4 className="text-2xl font-black text-zinc-900 dark:text-white leading-none">
                {loading ? "..." : value}
            </h4>
            <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider mt-1">{label}</p>
        </div>
    </div>
);

const LeaderboardRow = ({ rank, user, hours }) => (
    <div className="flex items-center justify-between p-3 rounded-xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-100 dark:border-zinc-800 hover:bg-white dark:hover:bg-zinc-800 transition-colors">
        <div className="flex items-center gap-3">
            <div className={`font-black text-lg w-6 text-center ${rank === 1 ? "text-yellow-500" : rank === 2 ? "text-zinc-400" : "text-amber-700"}`}>{rank}º</div>
            <div className="w-8 h-8 rounded-full bg-zinc-200 dark:bg-zinc-700 flex items-center justify-center text-xs font-bold text-zinc-600 dark:text-zinc-300">
                {user ? user.substring(0,2).toUpperCase() : '?'}
            </div>
            <div>
                <p className="text-xs font-bold text-zinc-800 dark:text-white capitalize truncate max-w-[120px]">
                    {user || 'Anônimo'}
                </p>
                {rank === 1 && <span className="text-[9px] text-yellow-600 font-bold flex items-center gap-0.5"><Crown size={10}/> Líder</span>}
            </div>
        </div>
        <div className="text-right">
            <span className="block text-sm font-black text-zinc-900 dark:text-white">{hours.toFixed(1)}h</span>
        </div>
    </div>
);

function AdminPage() {
  const [stats, setStats] = useState({
      activeUsers: 0, totalEditais: 0, dbStatus: 'Verificando...',
      totalHours: 0, totalQuestions: 0, globalAccuracy: 0
  });
  const [popularityData, setPopularityData] = useState([]);
  const [weakestSubjects, setWeakestSubjects] = useState([]);
  const [topStudents, setTopStudents] = useState([]);
  const [installedTemplates, setInstalledTemplates] = useState([]);
  const [loading, setLoading] = useState(true);

  // Estados do Modal
  const [modalConfig, setModalConfig] = useState({ isOpen: false, title: '', message: '', onConfirm: () => {}, variant: 'danger' });

  // --- ENGINE DE INTELIGÊNCIA ---
  const refreshData = async () => {
      setLoading(true);
      try {
          const editaisSnap = await getDocs(collection(db, 'editais_templates'));
          setInstalledTemplates(editaisSnap.docs.map(doc => doc.id));

          const thirtyDaysAgo = new Date();
          thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
          const recordsQuery = query(collectionGroup(db, 'registrosEstudo'), where('timestamp', '>=', Timestamp.fromDate(thirtyDaysAgo)));
          const recordsSnap = await getDocs(recordsQuery);
          const ciclosQuery = query(collectionGroup(db, 'ciclos'), where('ativo', '==', true));
          const ciclosSnap = await getDocs(ciclosQuery);

          const popMap = {};
          ciclosSnap.forEach(doc => {
              const tid = doc.data().templateId;
              let name = tid;
              Object.keys(TEMPLATE_IDS).forEach(key => { if (TEMPLATE_IDS[key] === tid) name = key; });
              if (tid) popMap[name] = (popMap[name] || 0) + 1;
          });

          let sumHours = 0, sumQuestions = 0, sumCorrect = 0;
          const subjectStats = {}, userStats = {}, uniqueUserIds = new Set();

          recordsSnap.forEach(doc => {
              const d = doc.data();
              const uid = doc.ref.path.split('/')[1];
              if (uid) uniqueUserIds.add(uid);
              const min = Number(d.tempoEstudadoMinutos) || 0;
              const q = Number(d.questoesFeitas) || 0;
              const c = Number(d.acertos) || 0;
              const subj = d.disciplinaNome || 'Geral';

              sumHours += min; sumQuestions += q; sumCorrect += c;
              if(q > 0) {
                  if(!subjectStats[subj]) subjectStats[subj] = { q: 0, c: 0 };
                  subjectStats[subj].q += q; subjectStats[subj].c += c;
              }
              if(uid) { userStats[uid] = (userStats[uid] || 0) + min; }
          });

          const weakSubjectsArr = Object.entries(subjectStats)
              .map(([name, data]) => ({ name, accuracy: (data.c / data.q) * 100, volume: data.q }))
              .filter(s => s.volume >= 1).sort((a, b) => a.accuracy - b.accuracy).slice(0, 4);

          const rankingArr = Object.entries(userStats)
              .map(([uid, minutes]) => ({ uid, hours: minutes / 60 })).sort((a, b) => b.hours - a.hours).slice(0, 3);

          const rankingWithNames = await Promise.all(rankingArr.map(async (student) => {
              let name = 'Desconhecido';
              try {
                  const uSnap = await getDoc(doc(db, 'users', student.uid));
                  if (uSnap.exists()) {
                      const ud = uSnap.data();
                      name = ud.displayName || ud.nome || (ud.email ? ud.email.split('@')[0] : 'Desconhecido');
                  }
              } catch (e) {}
              return { ...student, name };
          }));

          setStats({
              activeUsers: uniqueUserIds.size, totalEditais: editaisSnap.size, dbStatus: 'Operacional',
              totalHours: Math.round(sumHours / 60), totalQuestions: sumQuestions,
              globalAccuracy: sumQuestions > 0 ? Math.round((sumCorrect / sumQuestions) * 100) : 0
          });
          setPopularityData(Object.entries(popMap).map(([name, value]) => ({ name, value })));
          setWeakestSubjects(weakSubjectsArr);
          setTopStudents(rankingWithNames);
      } catch (error) {
          console.error(error);
          setStats(prev => ({ ...prev, dbStatus: 'Erro Leitura' }));
      } finally {
          setLoading(false);
      }
  };

  useEffect(() => { refreshData(); }, []);

  // --- HANDLERS COM MODAL ---

  // 1. Abertura do Modal de Delete
  const handleDeleteRequest = (id, titulo) => {
      setModalConfig({
          isOpen: true,
          title: `Excluir Edital: ${titulo}?`,
          message: `Esta ação removerá o template do banco de dados permanentemente.\nUsuários que já utilizam este edital não serão afetados, mas novos usuários não poderão selecioná-lo.`,
          variant: 'danger',
          onConfirm: async () => {
              try {
                  setLoading(true);
                  await deleteDoc(doc(db, "editais_templates", id));
                  setModalConfig(prev => ({ ...prev, isOpen: false }));
                  await refreshData();
              } catch (error) {
                  alert("Erro ao excluir.");
              } finally {
                  setLoading(false);
              }
          }
      });
  };

  // 2. Abertura do Modal de Install (Usando o Trigger do Wrapper)
  const handleInstallRequest = (triggerHiddenBtnFn, isInstalled, titulo) => {
      const action = isInstalled ? "REINSTALAR (Resetar)" : "INSTALAR";
      setModalConfig({
          isOpen: true,
          title: `Confirmar Instalação?`,
          message: `Você está prestes a ${action} o edital do concurso: \n\n**${titulo}**\n\nCertifique-se de que esta é a ação desejada.`,
          variant: 'info',
          onConfirm: () => {
              setModalConfig(prev => ({ ...prev, isOpen: false }));
              triggerHiddenBtnFn(); // Chama a função que clica no botão escondido
          }
      });
  };

  const CATALOGO_EDITAIS = [
    { id: TEMPLATE_IDS.PMBA, titulo: 'Soldado PMBA', banca: 'FCC', logo: '/logosEditais/logo-pmba.png', SeedComponent: SeedEditalPMBA },
    { id: TEMPLATE_IDS.PPMG, titulo: 'Policial Penal MG', banca: 'AOCP', logo: '/logosEditais/logo-ppmg.png', SeedComponent: SeedEditalPPMG },
    { id: TEMPLATE_IDS.PCBA, titulo: 'Investigador PCBA', banca: 'IBFC', logo: '/logosEditais/logo-pcba.png', SeedComponent: SeedEditalPCBA },
    { id: TEMPLATE_IDS.PMSE, titulo: 'Soldado PMSE', banca: 'SELECON', logo: '/logosEditais/logo-pmse.png', SeedComponent: SeedEditalPMSE },
    { id: TEMPLATE_IDS.PMGO, titulo: 'Soldado PMGO', banca: 'Inst. AOCP', logo: '/logosEditais/logo-pmgo.png', SeedComponent: SeedEditalPMGO },
    { id: TEMPLATE_IDS.PMAL, titulo: 'Soldado PMAL', banca: 'Cebraspe', logo: '/logosEditais/logo-pmal.png', SeedComponent: SeedEditalPMAL },
    { id: TEMPLATE_IDS.PMPE, titulo: 'Soldado PMPE', banca: 'Inst. AOCP', logo: '/logosEditais/logo-pmpe.png', SeedComponent: SeedEditalPMPE },
    { id: TEMPLATE_IDS.PMPI, titulo: 'Soldado PMPI', banca: 'NUCEPE', logo: '/logosEditais/logo-pmpi.png', SeedComponent: SeedEditalPMPI },
    { id: TEMPLATE_IDS.GCMAquiraz, titulo: 'GCM Aquiraz', banca: 'Consulpam', logo: '/logosEditais/logo-aquiraz.png', SeedComponent: SeedEditalGCMAquiraz }
  ];

  return (
    <div className="space-y-8 animate-fade-in max-w-6xl mx-auto pb-20 pt-10 px-4">
      <ConfirmationModal {...modalConfig} onClose={() => setModalConfig(prev => ({ ...prev, isOpen: false }))} loading={loading} />

      {/* HEADER */}
      <div className="flex flex-col md:flex-row items-center gap-8 mb-8">
          <div className="relative group flex-shrink-0">
              <div className="w-32 h-32 md:w-40 md:h-40 rounded-full border-4 border-white dark:border-zinc-800 bg-zinc-100 dark:bg-zinc-900 shadow-2xl flex items-center justify-center relative ring-4 ring-zinc-100 dark:ring-zinc-900/50">
                  <ShieldAlert size={64} className="text-red-600 dark:text-red-500" />
                  <div className={`absolute bottom-2 right-2 w-6 h-6 border-4 border-white dark:border-zinc-950 rounded-full z-10 ${stats.dbStatus === 'Operacional' ? 'bg-emerald-500' : 'bg-red-500'}`}></div>
              </div>
          </div>
          <div className="text-center md:text-left space-y-2">
              <div className="inline-flex items-center gap-2 px-3 py-1 bg-red-100 dark:bg-red-900/30 rounded-full text-[10px] font-bold text-red-600 dark:text-red-400 uppercase tracking-widest border border-red-200 dark:border-red-800/50"><Lock size={10} /> Admin Zone</div>
              <h1 className="text-4xl md:text-5xl font-black text-zinc-900 dark:text-white tracking-tight">Central de Comando</h1>
              <p className="text-sm font-medium text-zinc-500 max-w-xl">Gestão global de editais e inteligência.</p>
          </div>
      </div>

      {/* STATS */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <AdminStatCardOriginal icon={Activity} label="Usuários Ativos (30d)" value={stats.activeUsers} subtext="Com registros" colorClass="text-indigo-600" loading={loading} delay={0.1} />
          <AdminStatCardOriginal icon={FileJson} label="Editais no Banco" value={stats.totalEditais} subtext="Templates" colorClass="text-emerald-600" loading={loading} delay={0.2} />
          <AdminStatCardOriginal icon={Server} label="Status API" value={stats.dbStatus} subtext="Firestore" colorClass={stats.dbStatus === 'Operacional' ? 'text-blue-600' : 'text-red-600'} loading={loading} delay={0.3} />
          <AdminStatCardOriginal icon={ShieldAlert} label="Modo Admin" value="Ativo" subtext="Full Access" colorClass="text-red-600" loading={false} delay={0.4} />
      </div>

      {/* INTELLIGENCE SECTION */}
      <div className="pt-6">
          <h2 className="text-xl font-black text-zinc-800 dark:text-white flex items-center gap-2 mb-4"><Database size={20} className="text-zinc-400" /> Inteligência</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <MiniStatCard icon={Clock} label="Horas (30d)" value={stats.totalHours} colorClass="text-blue-600" loading={loading} />
              <MiniStatCard icon={Target} label="Questões" value={stats.totalQuestions} colorClass="text-violet-600" loading={loading} />
              <MiniStatCard icon={TrendingUp} label="Precisão Global" value={`${stats.globalAccuracy}%`} colorClass={stats.globalAccuracy > 70 ? "text-emerald-600" : "text-amber-500"} loading={loading} />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Popularidade */}
              <div className="bg-white dark:bg-zinc-900 rounded-3xl p-6 border border-zinc-200 dark:border-zinc-800 shadow-sm flex flex-col h-64">
                   <h3 className="text-sm font-bold text-zinc-900 dark:text-white mb-4 flex items-center gap-2"><Users size={14} className="text-blue-500"/> Popularidade</h3>
                   <div className="flex-1">
                      <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={popularityData} layout="vertical" margin={{ left: 0, right: 10 }}>
                              <XAxis type="number" hide />
                              <YAxis type="category" dataKey="name" width={50} tick={{ fontSize: 9, fontWeight: 'bold' }} />
                              <Tooltip cursor={{fill: 'transparent'}} contentStyle={{ borderRadius: '8px', border: 'none', backgroundColor: '#18181b', color: '#fff', fontSize: '12px' }} />
                              <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={15}>
                                  {popularityData.map((entry, index) => (<Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />))}
                              </Bar>
                          </BarChart>
                      </ResponsiveContainer>
                   </div>
              </div>

              {/* Ranking */}
              <div className="bg-white dark:bg-zinc-900 rounded-3xl p-6 border border-zinc-200 dark:border-zinc-800 shadow-sm flex flex-col h-64 overflow-y-auto">
                   <h3 className="text-sm font-bold text-zinc-900 dark:text-white mb-4 flex items-center gap-2"><Trophy size={14} className="text-yellow-500"/> Top Estudantes</h3>
                   <div className="space-y-2">
                      {topStudents.map((s, i) => <LeaderboardRow key={s.uid} rank={i+1} user={s.name} hours={s.hours} />)}
                   </div>
              </div>

              {/* Fracas */}
              <div className="bg-white dark:bg-zinc-900 rounded-3xl p-6 border border-zinc-200 dark:border-zinc-800 shadow-sm flex flex-col h-64">
                   <h3 className="text-sm font-bold text-zinc-900 dark:text-white mb-4 flex items-center gap-2"><TrendingDown size={14} className="text-red-500"/> Atenção (Precisão Baixa)</h3>
                   <div className="space-y-3 overflow-y-auto">
                      {weakestSubjects.map((s, i) => (
                          <div key={i} className="group">
                              <div className="flex justify-between text-xs font-bold mb-1"><span>{s.name}</span><span className="text-red-500">{s.accuracy.toFixed(0)}%</span></div>
                              <div className="w-full h-1.5 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden"><div className="h-full bg-red-500" style={{ width: `${s.accuracy}%` }}></div></div>
                          </div>
                      ))}
                   </div>
              </div>
          </div>
      </div>

      {/* CATALOGO */}
      <div className="pt-8">
          <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-black text-zinc-900 dark:text-white flex items-center gap-3"><Database className="text-zinc-400"/> Instalação de Editais</h2>
              <div className="flex items-center gap-2 px-3 py-1 bg-amber-50 dark:bg-amber-900/10 border border-amber-100 dark:border-amber-900/30 rounded-full">
                  <AlertTriangle size={12} className="text-amber-500" /><span className="text-[10px] font-bold text-amber-700 dark:text-amber-500 uppercase">Gravação</span>
              </div>
          </div>

          <div className="bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-200 dark:border-zinc-800 shadow-xl overflow-hidden divide-y divide-zinc-100 dark:divide-zinc-800">
              {CATALOGO_EDITAIS.map((edital) => {
                  const SeedBtn = edital.SeedComponent;
                  const isInstalled = installedTemplates.includes(edital.id);

                  return (
                      <div key={edital.id} className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-zinc-50 dark:hover:bg-black/20 transition-colors">
                          <div className="flex items-center gap-4">
                              <div className="w-14 h-14 bg-zinc-100 dark:bg-black/40 rounded-xl border border-zinc-200 dark:border-zinc-700 flex items-center justify-center p-2">
                                  {edital.logo ? <img src={edital.logo} alt={edital.titulo} className="w-full h-full object-contain opacity-80" /> : <FileJson size={24} className="text-zinc-300" />}
                              </div>
                              <div>
                                  <div className="flex items-center gap-2">
                                      <h4 className="font-bold text-zinc-900 dark:text-white text-base">{edital.titulo}</h4>
                                      {isInstalled ?
                                          <span className="text-[9px] font-bold text-emerald-600 bg-emerald-100 dark:bg-emerald-900/30 px-2 py-0.5 rounded-full flex items-center gap-1"><CheckCircle2 size={10} /> ATIVO</span> :
                                          <span className="text-[9px] font-bold text-zinc-400 bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 rounded-full">NÃO INSTALADO</span>
                                      }
                                  </div>
                                  <p className="text-xs text-zinc-500 mt-0.5 flex items-center gap-1"><Search size={10}/> {edital.banca}</p>
                              </div>
                          </div>

                          <div className="flex items-center gap-2">
                              {/* Botão de Instalação "Seguro" (Intercepta o clique) */}
                              <SecureInstallWrapper
                                  isInstalled={isInstalled}
                                  editalTitle={edital.titulo}
                                  onRequestInstall={handleInstallRequest}
                              >
                                  <SeedBtn isInstalled={isInstalled} onSuccess={refreshData} />
                              </SecureInstallWrapper>

                              {/* Botão de Deletar com Modal */}
                              {isInstalled && (
                                  <button
                                      onClick={() => handleDeleteRequest(edital.id, edital.titulo)}
                                      title="Excluir edital do banco"
                                      className="flex items-center justify-center w-10 h-10 rounded-xl bg-red-50 dark:bg-red-900/20 text-red-500 hover:bg-red-100 dark:hover:bg-red-900/40 hover:text-red-600 transition-colors border border-red-100 dark:border-red-900/50"
                                  >
                                      <Trash2 size={16} />
                                  </button>
                              )}
                          </div>
                      </div>
                  );
              })}
          </div>
      </div>
    </div>
  );
}

export default AdminPage;