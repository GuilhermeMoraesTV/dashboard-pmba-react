import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { db } from '../firebaseConfig';
import {
    collection, getDocs, query, where, collectionGroup, Timestamp
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

import {
  ShieldAlert, Database, Users, Activity, Server, Lock,
  FileJson, Loader2, CheckCircle2, AlertTriangle, Search,
  Trophy, Clock, Target, TrendingUp, TrendingDown, Crown, Medal
} from 'lucide-react';

// --- CONFIGURAÇÃO ---
const TEMPLATE_IDS = {
    PMBA: 'pmba_soldado',
    PPMG: 'ppmg_policial_penal',
    PCBA: 'pcba_investigador',
    PMSE: 'pmse_soldado',
    PMGO: 'pmgo_soldado'

};

const COLORS = ['#ef4444', '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6'];

// --- COMPONENTES VISUAIS ---

// 1. Card Original (Estilo Antigo que você gostou)
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

// 2. Card Pequeno para KPIs (Novos)
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

const LeaderboardRow = ({ rank, user, hours }) => {
    let medalColor = "text-zinc-400";
    let Icon = Medal;
    if (rank === 1) { medalColor = "text-yellow-500"; Icon = Crown; }
    if (rank === 2) { medalColor = "text-zinc-400"; }
    if (rank === 3) { medalColor = "text-amber-700"; }

    return (
        <div className="flex items-center justify-between p-3 rounded-xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-100 dark:border-zinc-800 hover:bg-white dark:hover:bg-zinc-800 transition-colors">
            <div className="flex items-center gap-3">
                <div className={`font-black text-lg w-6 text-center ${medalColor}`}>{rank}º</div>
                <div className="w-8 h-8 rounded-full bg-zinc-200 dark:bg-zinc-700 flex items-center justify-center text-xs font-bold text-zinc-600 dark:text-zinc-300">
                    {user ? user.slice(0, 2).toUpperCase() : '?'}
                </div>
                <div>
                    <p className="text-xs font-bold text-zinc-800 dark:text-white">UID: {user ? user.slice(0, 5) : 'Anon'}...</p>
                    <div className="flex items-center gap-1 text-[10px] text-zinc-500">
                        {rank === 1 && <span className="text-yellow-600 font-bold flex items-center gap-0.5"><Icon size={10}/> Líder</span>}
                    </div>
                </div>
            </div>
            <div className="text-right">
                <span className="block text-sm font-black text-zinc-900 dark:text-white">{hours.toFixed(1)}h</span>
                <span className="text-[9px] text-zinc-400 uppercase font-bold">Estudadas</span>
            </div>
        </div>
    );
};

function AdminPage() {
  const [stats, setStats] = useState({
      activeUsers: 0,
      totalEditais: 0,
      dbStatus: 'Verificando...',
      totalHours: 0,
      totalQuestions: 0,
      globalAccuracy: 0
  });

  const [popularityData, setPopularityData] = useState([]);
  const [weakestSubjects, setWeakestSubjects] = useState([]);
  const [topStudents, setTopStudents] = useState([]);
  const [installedTemplates, setInstalledTemplates] = useState([]);
  const [loading, setLoading] = useState(true);

  // --- ENGINE DE INTELIGÊNCIA ---
  const refreshData = async () => {
      setLoading(true);
      try {
          // 1. Templates Instalados
          const editaisSnap = await getDocs(collection(db, 'editais_templates'));
          setInstalledTemplates(editaisSnap.docs.map(doc => doc.id));

          // 2. Coletar Dados Globais (Últimos 30 dias)
          const thirtyDaysAgo = new Date();
          thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

          // IMPORTANTE: Se der erro de índice no console, clique no link fornecido pelo Firebase.
          const recordsQuery = query(collectionGroup(db, 'registrosEstudo'), where('timestamp', '>=', Timestamp.fromDate(thirtyDaysAgo)));
          const recordsSnap = await getDocs(recordsQuery);

          // Buscar todos os ciclos ativos
          const ciclosQuery = query(collectionGroup(db, 'ciclos'), where('ativo', '==', true));
          const ciclosSnap = await getDocs(ciclosQuery);

          // --- PROCESSAMENTO ---

          // A. Popularidade
          const popMap = {};
          ciclosSnap.forEach(doc => {
              const tid = doc.data().templateId;
              let name = tid;
              Object.keys(TEMPLATE_IDS).forEach(key => {
                  if (TEMPLATE_IDS[key] === tid) name = key;
              });
              if (tid) popMap[name] = (popMap[name] || 0) + 1;
          });
          const popChartData = Object.entries(popMap).map(([name, value]) => ({ name, value }));

          // B. Métricas Globais
          let sumHours = 0;
          let sumQuestions = 0;
          let sumCorrect = 0;
          const subjectStats = {};
          const userStats = {};
          const uniqueUserIds = new Set();

          recordsSnap.forEach(doc => {
              const d = doc.data();
              // Tenta pegar o ID do usuário através da referência do pai (users/{uid}/...)
              const pathSegments = doc.ref.path.split('/');
              const uid = pathSegments[1];

              if (uid) uniqueUserIds.add(uid);

              const min = Number(d.tempoEstudadoMinutos) || 0;
              const q = Number(d.questoesFeitas) || 0;
              const c = Number(d.acertos) || 0;
              const subj = d.disciplinaNome || 'Geral';

              sumHours += min;
              sumQuestions += q;
              sumCorrect += c;

              if(q > 0) {
                  if(!subjectStats[subj]) subjectStats[subj] = { q: 0, c: 0 };
                  subjectStats[subj].q += q;
                  subjectStats[subj].c += c;
              }

              if(uid) {
                  if(!userStats[uid]) userStats[uid] = 0;
                  userStats[uid] += min;
              }
          });

          // Processar Fracas
          const weakSubjectsArr = Object.entries(subjectStats)
              .map(([name, data]) => ({
                  name,
                  accuracy: (data.c / data.q) * 100,
                  volume: data.q
              }))
              .filter(s => s.volume >= 1)
              .sort((a, b) => a.accuracy - b.accuracy)
              .slice(0, 4);

          // Processar Ranking
          const rankingArr = Object.entries(userStats)
              .map(([uid, minutes]) => ({ uid, hours: minutes / 60 }))
              .sort((a, b) => b.hours - a.hours)
              .slice(0, 3);

          setStats({
              activeUsers: uniqueUserIds.size, // Contagem real baseada nos registros
              totalEditais: editaisSnap.size,
              dbStatus: 'Operacional',
              totalHours: Math.round(sumHours / 60),
              totalQuestions: sumQuestions,
              globalAccuracy: sumQuestions > 0 ? Math.round((sumCorrect / sumQuestions) * 100) : 0
          });

          setPopularityData(popChartData);
          setWeakestSubjects(weakSubjectsArr);
          setTopStudents(rankingArr);

      } catch (error) {
          console.error("Erro Dashboard Admin:", error);
          setStats(prev => ({ ...prev, dbStatus: 'Erro Leitura' }));
      } finally {
          setLoading(false);
      }
  };

  useEffect(() => { refreshData(); }, []);

  const CATALOGO_EDITAIS = [
    { id: TEMPLATE_IDS.PMBA, titulo: 'Soldado PMBA', banca: 'FCC', logo: '/logo-pmba.png', SeedComponent: SeedEditalPMBA },
    { id: TEMPLATE_IDS.PPMG, titulo: 'Policial Penal MG', banca: ' Instituto AOCP', logo: '/logosEditais/logo-ppmg.png', SeedComponent: SeedEditalPPMG },
    { id: TEMPLATE_IDS.PCBA, titulo: 'Investigador PCBA', banca: 'IBFC', logo: '/logosEditais/logo-pcba.png', SeedComponent: SeedEditalPCBA },
    { id: TEMPLATE_IDS.PMSE, titulo: 'Soldado PMSE', banca: 'SELECON', logo: '/logosEditais/logo-pmse.png', SeedComponent: SeedEditalPMSE },
    { id: TEMPLATE_IDS.PMGO, titulo: 'Soldado PMGO', banca: 'Instituto AOCP', logo: '/logosEditais/logo-pmgo.png', SeedComponent: SeedEditalPMGO }
  ];

  return (
    <div className="space-y-8 animate-fade-in max-w-6xl mx-auto pb-20 pt-10 px-4">

      {/* 1. HEADER (Design Original) */}
      <div className="flex flex-col md:flex-row items-center md:items-center gap-8 mb-8">
          <div className="relative group flex-shrink-0">
              <div className="w-32 h-32 md:w-40 md:h-40 rounded-full border-4 border-white dark:border-zinc-800 bg-zinc-100 dark:bg-zinc-900 shadow-2xl overflow-hidden relative ring-4 ring-zinc-100 dark:ring-zinc-900/50 flex items-center justify-center">
                  <ShieldAlert size={64} className="text-red-600 dark:text-red-500" />
                  <div className="absolute inset-0 bg-red-600/10 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
              </div>
              <div className={`absolute bottom-2 right-2 w-6 h-6 border-4 border-white dark:border-zinc-950 rounded-full shadow-sm z-10 ${stats.dbStatus === 'Operacional' ? 'bg-emerald-500' : 'bg-red-500'}`} title="Status"></div>
          </div>
          <div className="flex-1 text-center md:text-left space-y-2">
              <div className="inline-flex items-center gap-2 px-3 py-1 bg-red-100 dark:bg-red-900/30 rounded-full text-[10px] font-bold text-red-600 dark:text-red-400 uppercase tracking-widest mb-1 border border-red-200 dark:border-red-800/50"><Lock size={10} /> Admin Zone</div>
              <h1 className="text-4xl md:text-5xl font-black text-zinc-900 dark:text-white tracking-tight leading-none">Central de Comando</h1>
              <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400 max-w-xl mx-auto md:mx-0">Gestão global de editais e monitoramento de inteligência.</p>
          </div>
      </div>

      {/* 2. STATS ORIGINAIS (Cards Grandes) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <AdminStatCardOriginal icon={Activity} label="Usuários Ativos (30d)" value={stats.activeUsers} subtext="Com registros recentes" colorClass="text-indigo-600" loading={loading} delay={0.1} />
          <AdminStatCardOriginal icon={FileJson} label="Editais no Banco" value={stats.totalEditais} subtext="Templates disponíveis" colorClass="text-emerald-600" loading={loading} delay={0.2} />
          <AdminStatCardOriginal icon={Server} label="Status da API" value={stats.dbStatus} subtext="Conexão Firestore" colorClass={stats.dbStatus === 'Operacional' ? 'text-blue-600' : 'text-red-600'} loading={loading} delay={0.3} />
          <AdminStatCardOriginal icon={ShieldAlert} label="Modo Admin" value="Ativo" subtext="Permissões Totais" colorClass="text-red-600" loading={false} delay={0.4} />
      </div>

      {/* 3. SECTION TITLE: INTELIGÊNCIA */}
      <div className="pt-6">
          <h2 className="text-xl font-black text-zinc-800 dark:text-white flex items-center gap-2 mb-4">
              <Database size={20} className="text-zinc-400" /> Inteligência do Sistema
          </h2>

          {/* Mini Cards de Métricas Globais */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <MiniStatCard icon={Clock} label="Horas Estudadas (30d)" value={stats.totalHours.toLocaleString()} colorClass="text-blue-600" loading={loading} />
              <MiniStatCard icon={Target} label="Questões Resolvidas" value={stats.totalQuestions.toLocaleString()} colorClass="text-violet-600" loading={loading} />
              <MiniStatCard icon={TrendingUp} label="Taxa de Acerto Global" value={`${stats.globalAccuracy}%`} colorClass={stats.globalAccuracy > 70 ? "text-emerald-600" : "text-amber-500"} loading={loading} />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

              {/* A. Popularidade */}
              <div className="bg-white dark:bg-zinc-900 rounded-3xl p-6 border border-zinc-200 dark:border-zinc-800 shadow-sm flex flex-col">
                  <div className="mb-4">
                      <h3 className="text-base font-bold text-zinc-900 dark:text-white flex items-center gap-2"><Users size={16} className="text-blue-500"/> Popularidade</h3>
                      <p className="text-[10px] text-zinc-500 uppercase tracking-wider">Ciclos ativos por concurso</p>
                  </div>
                  <div className="flex-1 min-h-[180px]">
                      {popularityData.length > 0 ? (
                          <ResponsiveContainer width="100%" height="100%">
                              <BarChart data={popularityData} layout="vertical" margin={{ left: 0, right: 10 }}>
                                  <XAxis type="number" hide />
                                  <YAxis type="category" dataKey="name" width={50} tick={{ fontSize: 9, fontWeight: 'bold', fill: '#71717a' }} />
                                  <Tooltip cursor={{fill: 'transparent'}} contentStyle={{ borderRadius: '8px', border: 'none', backgroundColor: '#18181b', color: '#fff', fontSize: '12px' }} />
                                  <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={15}>
                                      {popularityData.map((entry, index) => (
                                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                      ))}
                                  </Bar>
                              </BarChart>
                          </ResponsiveContainer>
                      ) : (
                          <div className="h-full flex items-center justify-center text-zinc-400 text-xs">Sem dados</div>
                      )}
                  </div>
              </div>

              {/* B. Ranking */}
              <div className="bg-white dark:bg-zinc-900 rounded-3xl p-6 border border-zinc-200 dark:border-zinc-800 shadow-sm flex flex-col">
                  <div className="mb-4">
                      <h3 className="text-base font-bold text-zinc-900 dark:text-white flex items-center gap-2"><Trophy size={16} className="text-yellow-500"/> Top Estudantes</h3>
                      <p className="text-[10px] text-zinc-500 uppercase tracking-wider">Ranking por horas (30d)</p>
                  </div>
                  <div className="space-y-2">
                      {topStudents.length > 0 ? (
                          topStudents.map((student, idx) => (
                              <LeaderboardRow key={student.uid} rank={idx + 1} user={student.uid} hours={student.hours} />
                          ))
                      ) : (
                          <div className="text-center py-10 text-zinc-400 text-xs">Aguardando dados...</div>
                      )}
                  </div>
              </div>

              {/* C. Disciplinas Fracas */}
              <div className="bg-white dark:bg-zinc-900 rounded-3xl p-6 border border-zinc-200 dark:border-zinc-800 shadow-sm flex flex-col">
                  <div className="mb-4">
                      <h3 className="text-base font-bold text-zinc-900 dark:text-white flex items-center gap-2"><TrendingDown size={16} className="text-red-500"/> Pontos de Atenção</h3>
                      <p className="text-[10px] text-zinc-500 uppercase tracking-wider">Menor precisão global</p>
                  </div>
                  <div className="space-y-3">
                      {weakestSubjects.length > 0 ? (
                          weakestSubjects.map((subj, idx) => (
                              <div key={idx} className="group">
                                  <div className="flex justify-between items-end mb-1">
                                      <span className="text-xs font-bold text-zinc-700 dark:text-zinc-300 truncate max-w-[150px]">{subj.name}</span>
                                      <span className="text-xs font-black text-red-500">{subj.accuracy.toFixed(0)}%</span>
                                  </div>
                                  <div className="w-full h-1.5 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                                      <div className="h-full bg-red-500 rounded-full" style={{ width: `${subj.accuracy}%` }}></div>
                                  </div>
                              </div>
                          ))
                      ) : (
                          <div className="h-full flex items-center justify-center text-zinc-400 text-xs">Dados insuficientes</div>
                      )}
                  </div>
              </div>
          </div>
      </div>

      {/* 4. GESTÃO DE EDITAIS */}
      <div className="pt-8">
          <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-black text-zinc-900 dark:text-white flex items-center gap-3">
                  <Database className="text-zinc-400"/> Instalação de Editais
              </h2>
              <div className="flex items-center gap-2 px-3 py-1 bg-amber-50 dark:bg-amber-900/10 border border-amber-100 dark:border-amber-900/30 rounded-full">
                  <AlertTriangle size={12} className="text-amber-500" /><span className="text-[10px] font-bold text-amber-700 dark:text-amber-500 uppercase">Modo de Gravação</span>
              </div>
          </div>

          <div className="bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-200 dark:border-zinc-800 shadow-xl overflow-hidden">
              <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
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
                              <div>
                                  <SeedBtn isInstalled={isInstalled} onSuccess={refreshData} />
                              </div>
                          </div>
                      );
                  })}
              </div>
          </div>
      </div>
    </div>
  );
}

export default AdminPage;