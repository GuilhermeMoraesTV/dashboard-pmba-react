import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { db } from '../firebaseConfig';
import { collection, getDocs, query, where, collectionGroup, Timestamp } from 'firebase/firestore';

// --- IMPORTAÇÃO DOS SCRIPTS DE SEED ---
import SeedEditalPMBA from '../components/admin/SeedEditalPMBA';
import SeedEditalPPMG from '../components/admin/SeedEditalPPMG';
import SeedEditalPCBA from '../components/admin/SeedEditalPCBA';
import SeedEditalPMSE from '../components/admin/SeedEditalPMSE'; // Importado

import {
  ShieldAlert, Database, Users, Activity, Server, Lock,
  FileJson, Loader2, CheckCircle2, AlertTriangle, Search, HardDrive, Check, FileText
} from 'lucide-react';

// --- IDs DOS DOCUMENTOS NO FIREBASE ---
const TEMPLATE_IDS = {
    PMBA: 'pmba_soldado',
    PPMG: 'ppmg_policial_penal',
    PCBA: 'pcba_investigador', // <--- Faltava essa vírgula
    PMSE: 'pmse_soldado'       // Novo ID adicionado
};

const AdminStatCard = ({ icon: Icon, label, value, subtext, colorClass, loading, delay }) => (
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
            <h4 className="text-3xl font-black text-zinc-900 dark:text-white tracking-tight">{loading ? <Loader2 className="animate-spin h-6 w-6 text-zinc-300" /> : value}</h4>
            <p className="text-xs font-bold text-zinc-500 uppercase tracking-wide mt-1">{label}</p>
            {subtext && <p className="text-[10px] text-zinc-400 mt-2 font-medium">{subtext}</p>}
        </div>
    </motion.div>
);

function AdminPage() {
  const [stats, setStats] = useState({ activeUsers: 0, totalEditais: 0, dbStatus: 'Verificando...' });
  const [loading, setLoading] = useState(true);

  // Estado para armazenar quais editais já estão instalados
  const [installedTemplates, setInstalledTemplates] = useState([]);

  // Função para recarregar status após uma instalação
  const refreshData = async () => {
      try {
          // 1. Verificar Templates Instalados
          const editaisSnap = await getDocs(collection(db, 'editais_templates'));
          const installedIds = editaisSnap.docs.map(doc => doc.id);
          setInstalledTemplates(installedIds);

          // 2. Stats Gerais
          const editaisCount = editaisSnap.size;

          // 3. Usuários Ativos (7 dias)
          const sevenDaysAgo = new Date();
          sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
          const activeUsersQuery = query(collectionGroup(db, 'registrosEstudo'), where('timestamp', '>=', Timestamp.fromDate(sevenDaysAgo)));
          const querySnapshot = await getDocs(activeUsersQuery);
          const uniqueUserIds = new Set();
          querySnapshot.forEach((doc) => { if (doc.ref.parent.parent?.id) uniqueUserIds.add(doc.ref.parent.parent.id); });

          setStats({ activeUsers: uniqueUserIds.size, totalEditais: editaisCount, dbStatus: 'Operacional' });
      } catch (error) {
          console.error("Erro ao carregar dados:", error);
          setStats(prev => ({ ...prev, dbStatus: 'Erro' }));
      } finally {
          setLoading(false);
      }
  };

  useEffect(() => { refreshData(); }, []);

  // Configuração da Tabela
  const CATALOGO_EDITAIS = [
    {
        id: TEMPLATE_IDS.PMBA,
        titulo: 'Soldado PMBA',
        banca: 'FCC (Edital 2022)',
        logo: '/logo-pmba.png',
        SeedComponent: SeedEditalPMBA
    },
    {
        id: TEMPLATE_IDS.PPMG,
        titulo: 'Policial Penal MG',
        banca: 'AOCP 2025',
        logo: '/logosEditais/logo-ppmg.png',
        SeedComponent: SeedEditalPPMG
    },
    {
        id: TEMPLATE_IDS.PCBA,
        titulo: 'Investigador PCBA',
        banca: 'IBFC (Edital 2022)',
        logo: '/logosEditais/logo-pcba.png',
        SeedComponent: SeedEditalPCBA
    }, // <--- Faltava essa vírgula aqui
    {  // <--- Faltava abrir o objeto corretamente
        id: TEMPLATE_IDS.PMSE,
        titulo: 'Soldado PMSE',
        banca: 'SELECON (Edital 2024)',
        logo: '/logosEditais/logo-pmse.png',
        SeedComponent: SeedEditalPMSE
    }
  ];

  return (
    <div className="space-y-8 animate-fade-in max-w-6xl mx-auto pb-20 pt-10 px-4">
      {/* HEADER */}
      <div className="flex flex-col md:flex-row items-center md:items-center gap-8 mb-12">
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
              <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400 max-w-xl mx-auto md:mx-0">Gestão global de editais e monitoramento.</p>
          </div>
      </div>

      {/* STATS */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <AdminStatCard icon={Activity} label="Usuários Ativos (7d)" value={stats.activeUsers} subtext="Com registros recentes" colorClass="text-indigo-600" loading={loading} delay={0.1} />
          <AdminStatCard icon={FileJson} label="Editais no Banco" value={stats.totalEditais} subtext="Templates disponíveis" colorClass="text-emerald-600" loading={loading} delay={0.2} />
          <AdminStatCard icon={Server} label="Status da API" value={stats.dbStatus} subtext="Conexão Firestore" colorClass={stats.dbStatus === 'Operacional' ? 'text-blue-600' : 'text-red-600'} loading={loading} delay={0.3} />
          <AdminStatCard icon={ShieldAlert} label="Modo Admin" value="Ativo" subtext="Permissões de escrita" colorClass="text-red-600" loading={false} delay={0.4} />
      </div>

      {/* ÁREA PRINCIPAL */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 pt-4">
          {/* TABELA DE EDITAIS */}
          <div className="lg:col-span-2 space-y-6">
              <div className="bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-200 dark:border-zinc-800 shadow-xl overflow-hidden">
                  <div className="p-6 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div className="flex items-center gap-3">
                          <div className="p-2 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 rounded-lg"><Database size={20}/></div>
                          <div><h3 className="text-lg font-bold text-zinc-900 dark:text-white">Banco de Editais</h3><p className="text-xs text-zinc-500">Instalação e atualização de templates.</p></div>
                      </div>
                      <div className="flex items-center gap-2 px-3 py-1.5 bg-amber-50 dark:bg-amber-900/10 border border-amber-100 dark:border-amber-900/30 rounded-lg">
                          <AlertTriangle size={14} className="text-amber-500" /><span className="text-[10px] font-bold text-amber-700 dark:text-amber-500 uppercase">Modo de Gravação</span>
                      </div>
                  </div>

                  <div className="divide-y divide-zinc-100 dark:divide-zinc-800/50">
                      {CATALOGO_EDITAIS.map((edital) => {
                          const SeedBtn = edital.SeedComponent;
                          const isInstalled = installedTemplates.includes(edital.id);

                          return (
                              <div key={edital.id} className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-zinc-50 dark:hover:bg-zinc-800/30 transition-colors">
                                  <div className="flex items-center gap-4">
                                      <div className="w-16 h-16 bg-zinc-100 dark:bg-black/40 rounded-xl border border-zinc-200 dark:border-zinc-700 flex items-center justify-center p-2 shrink-0">
                                          {edital.logo ? <img src={edital.logo} alt={edital.titulo} className="w-full h-full object-contain" /> : <FileText size={24} className="text-zinc-300" />}
                                      </div>
                                      <div>
                                          <div className="flex items-center gap-2">
                                              <h4 className="font-bold text-zinc-800 dark:text-white text-base">{edital.titulo}</h4>
                                              {isInstalled && <span className="text-[10px] font-bold text-emerald-600 bg-emerald-100 dark:bg-emerald-900/30 px-2 py-0.5 rounded-full flex items-center gap-1"><Check size={10} /> Instalado</span>}
                                          </div>
                                          <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3 text-xs text-zinc-500 mt-1">
                                              <span className="flex items-center gap-1"><Search size={10} /> {edital.banca}</span>
                                          </div>
                                      </div>
                                  </div>
                                  <div className="shrink-0 flex justify-end">
                                      {/* Passamos o estado e a função de refresh para o componente filho */}
                                      <SeedBtn isInstalled={isInstalled} onSuccess={refreshData} />
                                  </div>
                              </div>
                          );
                      })}
                  </div>
                  <div className="p-3 bg-zinc-50 dark:bg-black/20 border-t border-zinc-200 dark:border-zinc-800 text-center"><p className="text-[10px] text-zinc-400">Total de {CATALOGO_EDITAIS.length} templates configurados no sistema.</p></div>
              </div>
          </div>

          {/* COLUNA DIREITA */}
          <div className="space-y-6">
               <div className="bg-zinc-900 dark:bg-zinc-800 text-white rounded-3xl p-6 shadow-xl relative overflow-hidden group">
                   <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-110 transition-transform duration-500"><Users size={120}/></div>
                   <div className="relative z-10">
                       <h4 className="text-xl font-black mb-1">Gestão de Usuários</h4>
                       <p className="text-xs font-bold text-zinc-400 uppercase tracking-widest mb-6">Em Desenvolvimento</p>
                       <button disabled className="w-full py-3 bg-white/10 border border-white/10 rounded-xl text-xs font-bold uppercase tracking-wide flex items-center justify-center gap-2 backdrop-blur-sm cursor-not-allowed opacity-70"><Lock size={14}/> Acesso Bloqueado</button>
                   </div>
               </div>
               <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 relative overflow-hidden">
                    <div className="flex items-center gap-3 mb-3">
                        <div className="p-2 bg-zinc-100 dark:bg-zinc-800 text-zinc-500 rounded-lg"><Activity size={20}/></div>
                        <div><h4 className="text-sm font-bold text-zinc-800 dark:text-white uppercase tracking-wide">Logs</h4><p className="text-[10px] text-zinc-500">Tempo real</p></div>
                    </div>
                    <div className="mt-4 pt-4 border-t border-zinc-100 dark:border-zinc-800"><div className="flex items-center gap-2 text-[10px] text-emerald-600 dark:text-emerald-400 font-bold bg-emerald-50 dark:bg-emerald-900/20 px-2 py-1 rounded w-fit"><CheckCircle2 size={12} /> API Status: OK</div></div>
               </div>
          </div>
      </div>
    </div>
  );
}

export default AdminPage;