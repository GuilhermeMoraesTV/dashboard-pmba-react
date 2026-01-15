import React, { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { db } from '../firebaseConfig';
import {
  collection, query, where, collectionGroup, Timestamp, doc, deleteDoc, onSnapshot, limit, orderBy, addDoc, serverTimestamp
} from 'firebase/firestore';

// --- IMPORTAÇÃO DOS SCRIPTS DE SEED ---
import SeedEditalPMBA from '../components/admin/SeedEditalPMBA';
import SeedEditalPPMG from '../components/admin/SeedEditalPPMG';
import SeedEditalPCBA from '../components/admin/SeedEditalPCBA';
import SeedEditalPMSE from '../components/admin/SeedEditalPMSE';
import SeedEditalPMGO from '../components/admin/SeedEditalPMGO';
import SeedEditalGCMAquiraz from '../components/admin/SeedEditalGCMAquiraz';
import SeedEditalPMAL from '../components/admin/SeedEditalPMAL';
import SeedEditalPMPE from '../components/admin/SeedEditalPMPE';
import SeedEditalPMPI from '../components/admin/SeedEditalPMPI';
import SeedEditalCBMERJ from '../components/admin/SeedEditalCBMERJ';
import SeedEditalCBMMG from '../components/admin/SeedEditalCBMMG';

import {
  ShieldAlert, Database, Users, Activity, Server, Lock,
  Loader2, Search, Crown, Maximize2, Trash2, X, Download,
  RefreshCw, Bell, ExternalLink, LayoutGrid, Flame, Siren,
  BadgeAlert, StickyNote, Save, Megaphone, FileSpreadsheet,
  Target, Zap
} from 'lucide-react';

// --- CONFIGURAÇÃO DE EDITAIS ---
const CATALOGO_EDITAIS = [
    { id: 'pmba_soldado', titulo: 'Soldado PMBA', banca: 'FCC', logo: '/logosEditais/logo-pmba.png', SeedComponent: SeedEditalPMBA, type: 'pm' },
    { id: 'ppmg_policial_penal', titulo: 'Policial Penal MG', banca: 'AOCP', logo: '/logosEditais/logo-ppmg.png', SeedComponent: SeedEditalPPMG, type: 'pp' },
    { id: 'pcba_investigador', titulo: 'Investigador PCBA', banca: 'IBFC', logo: '/logosEditais/logo-pcba.png', SeedComponent: SeedEditalPCBA, type: 'pc' },
    { id: 'pmse_soldado', titulo: 'Soldado PMSE', banca: 'SELECON', logo: '/logosEditais/logo-pmse.png', SeedComponent: SeedEditalPMSE, type: 'pm' },
    { id: 'pmgo_soldado', titulo: 'Soldado PMGO', banca: 'Inst. AOCP', logo: '/logosEditais/logo-pmgo.png', SeedComponent: SeedEditalPMGO, type: 'pm' },
    { id: 'pmal_soldado', titulo: 'Soldado PMAL', banca: 'Cebraspe', logo: '/logosEditais/logo-pmal.png', SeedComponent: SeedEditalPMAL, type: 'pm' },
    { id: 'pmpe_soldado', titulo: 'Soldado PMPE', banca: 'Inst. AOCP', logo: '/logosEditais/logo-pmpe.png', SeedComponent: SeedEditalPMPE, type: 'pm' },
    { id: 'pmpi_soldado', titulo: 'Soldado PMPI', banca: 'NUCEPE', logo: '/logosEditais/logo-pmpi.png', SeedComponent: SeedEditalPMPI, type: 'pm' },
    { id: 'cbmerj_oficial', titulo: 'Oficial CBMERJ', banca: 'UERJ', logo: '/logosEditais/logo-cbmerj.png', SeedComponent: SeedEditalCBMERJ, type: 'cbm' },
    { id: 'cbmmg_soldado', titulo: 'Soldado CBMMG', banca: 'IDECAN', logo: '/logosEditais/logo-cbmmg.png', SeedComponent: SeedEditalCBMMG, type: 'cbm' },
    { id: 'gcm_aquiraz', titulo: 'GCM Aquiraz', banca: 'Consulpam', logo: '/logosEditais/logo-aquiraz.png', SeedComponent: SeedEditalGCMAquiraz, type: 'gcm' }
];

// --- UTILITÁRIOS ---
const exportToCSV = (data, filename) => {
    const csvContent = "data:text/csv;charset=utf-8,"
        + "Nome,Email,Cadastro,UltimoEstudo,HorasTotais\n"
        + data.map(e => `${e.name},${e.email},${e.createdAt ? e.createdAt.toISOString() : ''},${e.lastStudy ? e.lastStudy.toISOString() : ''},${e.totalHours}`).join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
};

// --- COMPONENTES VISUAIS ---

const PerformanceMetricCard = ({ title, value, subValue, icon: Icon, color, trend }) => {
    const colorStyles = {
        blue: { iconBg: 'bg-blue-50 dark:bg-blue-900/20', iconColor: 'text-blue-600 dark:text-blue-400', watermark: 'text-blue-600', border: 'border-blue-100 dark:border-blue-900/30' },
        emerald: { iconBg: 'bg-emerald-50 dark:bg-emerald-900/20', iconColor: 'text-emerald-600 dark:text-emerald-400', watermark: 'text-emerald-600', border: 'border-emerald-100 dark:border-emerald-900/30' },
        red: { iconBg: 'bg-red-50 dark:bg-red-900/20', iconColor: 'text-red-600 dark:text-red-400', watermark: 'text-red-600', border: 'border-red-100 dark:border-red-900/30' },
        amber: { iconBg: 'bg-amber-50 dark:bg-amber-900/20', iconColor: 'text-amber-600 dark:text-amber-400', watermark: 'text-amber-600', border: 'border-amber-100 dark:border-amber-900/30' },
        zinc: { iconBg: 'bg-zinc-50 dark:bg-zinc-800', iconColor: 'text-zinc-600 dark:text-zinc-400', watermark: 'text-zinc-600', border: 'border-zinc-200 dark:border-zinc-800' },
    };
    const style = colorStyles[color] || colorStyles.blue;

    return (
        <div className={`relative overflow-hidden bg-white dark:bg-zinc-950 border ${style.border} rounded-2xl p-5 flex flex-col justify-between shadow-sm hover:shadow-md transition-all duration-300 group min-h-[140px]`}>
            <Icon className={`absolute -bottom-6 -right-6 w-32 h-32 opacity-[0.08] dark:opacity-[0.04] pointer-events-none transform -rotate-12 transition-transform duration-500 group-hover:scale-110 group-hover:-rotate-6 ${style.watermark}`} />

            <div className="flex justify-between items-start mb-4 relative z-10">
                <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 mb-1 flex items-center gap-1">
                        {title}
                        {trend && (
                            <span className={`ml-2 px-1.5 py-0.5 rounded text-[9px] ${trend > 0 ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-400' : 'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-400'}`}>
                                {trend > 0 ? '+' : ''}{trend}%
                            </span>
                        )}
                    </p>
                    <h3 className="text-2xl lg:text-3xl font-black text-zinc-900 dark:text-white tracking-tighter leading-none">{value}</h3>
                </div>
                <div className={`p-3 rounded-xl ${style.iconBg} ${style.iconColor} group-hover:scale-110 transition-transform shadow-inner`}>
                    <Icon size={20} strokeWidth={2.5} />
                </div>
            </div>

            <div className="relative z-10 mt-auto">
                <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 flex items-center gap-1.5">
                    {subValue}
                </p>
            </div>

            <div className="absolute inset-0 bg-gradient-to-tr from-white/0 via-white/0 to-white/10 dark:to-white/5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"/>
        </div>
    );
};

const CardContainer = ({ title, subtitle, icon: Icon, children, className = "", action, footer, isLive = false }) => (
    <div className={`bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-sm flex flex-col ${className}`}>
        <div className="p-5 md:p-6 pb-2 flex items-center justify-between">
            <div className="flex items-center gap-3">
                <div className="p-2 bg-zinc-100 dark:bg-zinc-900 rounded-lg text-zinc-500 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-800 relative">
                    <Icon size={18} strokeWidth={2.5} />
                    {isLive && (
                        <span className="absolute -top-1 -right-1 flex h-3 w-3">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
                        </span>
                    )}
                </div>
                <div>
                    <h3 className="text-sm font-extrabold text-zinc-900 dark:text-white uppercase tracking-tight flex items-center gap-2">
                        {title}
                    </h3>
                    {subtitle && <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">{subtitle}</p>}
                </div>
            </div>
            {action}
        </div>
        <div className="flex-1 w-full min-h-0 relative p-5 md:p-6 pt-2">
            {children}
        </div>
        {footer && (
             <div className="border-t border-zinc-100 dark:border-zinc-800 p-3 bg-zinc-50/50 dark:bg-zinc-900/50 rounded-b-2xl">
                 {footer}
             </div>
        )}
    </div>
);

const Avatar = ({ user, size = "md" }) => {
    const sizeClasses = { sm: "w-8 h-8 text-[10px]", md: "w-10 h-10 text-xs", lg: "w-16 h-16 text-lg" };
    return (
        <div className={`${sizeClasses[size]} rounded-full flex-shrink-0 bg-gradient-to-br from-zinc-100 to-zinc-200 dark:from-zinc-800 dark:to-zinc-900 border-2 border-white dark:border-zinc-700 shadow-sm overflow-hidden flex items-center justify-center relative`}>
            {user.photoURL ? (
                <img src={user.photoURL} alt={user.name} className="w-full h-full object-cover" />
            ) : (
                <span className="font-black text-zinc-500 dark:text-zinc-400">
                    {user.name ? user.name.substring(0, 2).toUpperCase() : <Users size={14} />}
                </span>
            )}
        </div>
    );
};

const formatTimeAgo = (date) => {
    if (!date) return '-';
    const diff = Math.floor((new Date() - date) / 60000);
    if (diff < 1) return 'Agora mesmo';
    if (diff < 60) return `${diff}m atrás`;
    const hours = Math.floor(diff / 60);
    if (hours < 24) return `${hours}h atrás`;
    return `${Math.floor(hours / 24)}d atrás`;
};

// --- MODAL EXPANDIDO ---
const ExpandedModal = ({ isOpen, onClose, title, children }) => {
    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-zinc-900/60 backdrop-blur-md animate-fade-in">
            <motion.div initial={{ scale: 0.95, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} className="bg-white dark:bg-zinc-950 w-full max-w-6xl max-h-[90vh] rounded-3xl border border-zinc-200 dark:border-zinc-800 shadow-2xl flex flex-col overflow-hidden">
                <div className="p-6 border-b border-zinc-100 dark:border-zinc-800 flex justify-between items-center bg-zinc-50/50 dark:bg-zinc-900/50">
                    <h3 className="text-2xl font-black text-zinc-900 dark:text-white flex items-center gap-3">{title}</h3>
                    <button onClick={onClose} className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-full transition-colors"><X size={24} /></button>
                </div>
                <div className="flex-1 overflow-y-auto p-6 bg-zinc-50/30 dark:bg-black/20 custom-scrollbar">{children}</div>
            </motion.div>
        </div>
    );
};

// --- MODAL DE BROADCAST (INTEGRADO AO FIREBASE) ---
const BroadcastModal = ({ isOpen, onClose }) => {
    const [message, setMessage] = useState('');
    const [sending, setSending] = useState(false);

    if(!isOpen) return null;

    const handleSend = async () => {
        if(!message.trim()) return;
        setSending(true);
        try {
            // Grava na coleção 'system_broadcasts' para que todos os usuários recebam
            await addDoc(collection(db, 'system_broadcasts'), {
                message: message,
                timestamp: serverTimestamp(),
                active: true,
                type: 'admin_push'
            });

            setMessage('');
            onClose();
            alert("📣 Broadcast enviado! A notificação aparecerá para os usuários conectados.");
        } catch (error) {
            console.error("Erro ao enviar broadcast:", error);
            alert("Erro ao enviar.");
        } finally {
            setSending(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-zinc-900/70 backdrop-blur-sm animate-fade-in">
             <motion.div initial={{scale:0.9}} animate={{scale:1}} className="bg-white dark:bg-zinc-950 w-full max-w-md rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-2xl p-6">
                <div className="flex items-center gap-3 mb-4 text-red-600">
                    <Megaphone size={28} />
                    <h3 className="text-xl font-bold text-zinc-900 dark:text-white">Central de Transmissão</h3>
                </div>
                <p className="text-sm text-zinc-500 mb-4">Isso enviará um popup flutuante para <b>todos</b> os alunos online agora.</p>

                <textarea
                    className="w-full h-32 bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-3 text-sm focus:ring-2 focus:ring-red-500 outline-none resize-none dark:text-white"
                    placeholder="Digite o aviso (ex: Manutenção em 10min...)"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                />

                <div className="flex gap-3 mt-4 justify-end">
                    <button onClick={onClose} className="px-4 py-2 text-sm font-bold text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg">Cancelar</button>
                    <button
                        onClick={handleSend}
                        disabled={!message || sending}
                        className="px-4 py-2 text-sm font-bold bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 flex items-center gap-2 shadow-lg shadow-red-600/20"
                    >
                        {sending ? <Loader2 size={16} className="animate-spin"/> : <Zap size={16} fill="currentColor"/>}
                        {sending ? 'Transmitindo...' : 'Enviar Push'}
                    </button>
                </div>
             </motion.div>
        </div>
    );
}

// --- MODAL GERENCIADOR DE EDITAIS ---
const EditaisManagerModal = ({ isOpen, onClose }) => {
    const [installedTemplates, setInstalledTemplates] = useState([]);
    const [activeTab, setActiveTab] = useState('todos');

    useEffect(() => {
        if (!isOpen) return;
        const unsub = onSnapshot(collection(db, 'editais_templates'), (snap) => {
            setInstalledTemplates(snap.docs.map(d => d.id));
        });
        return () => unsub();
    }, [isOpen]);

    const categories = [
        { id: 'todos', label: 'Todos', icon: LayoutGrid },
        { id: 'pm', label: 'Polícia Militar', icon: ShieldAlert },
        { id: 'pc', label: 'Polícia Civil', icon: BadgeAlert },
        { id: 'pp', label: 'Polícia Penal', icon: Lock },
        { id: 'cbm', label: 'Bombeiros', icon: Flame },
        { id: 'gcm', label: 'Guarda Municipal', icon: Siren },
    ];

    const filteredEditais = activeTab === 'todos' ? CATALOGO_EDITAIS : CATALOGO_EDITAIS.filter(e => e.type === activeTab);

    if (!isOpen) return null;

    const SecureWrapper = ({ children, isInstalled, editalTitle }) => {
        const btnRef = useRef(null);
        return (
            <div className="flex items-center gap-2">
                <button
                    onClick={() => {
                        if(window.confirm(`Deseja ${isInstalled ? 'REINSTALAR' : 'INSTALAR'} o edital ${editalTitle}?`)) {
                            const btn = btnRef.current.querySelector('button');
                            if(btn) {
                                const originalConfirm = window.confirm;
                                window.confirm = () => true;
                                btn.click();
                                setTimeout(() => window.confirm = originalConfirm, 100);
                            }
                        }
                    }}
                    className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wide flex items-center gap-2 transition-all ${isInstalled ? 'bg-zinc-100 text-zinc-500 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-400' : 'bg-red-600 text-white hover:bg-red-700 shadow-lg shadow-red-600/20'}`}
                >
                    {isInstalled ? <><RefreshCw size={12}/> Reinstalar</> : <><Download size={12}/> Instalar</>}
                </button>
                <div ref={btnRef} className="hidden">{children}</div>
            </div>
        );
    };

    return (
        <ExpandedModal isOpen={isOpen} onClose={onClose} title="Central de Comandos e Editais">
            <div className="flex flex-col h-full">
                <div className="flex border-b border-zinc-100 dark:border-zinc-800 overflow-x-auto mb-6 scrollbar-hide">
                    {categories.map(cat => (
                        <button
                            key={cat.id}
                            onClick={() => setActiveTab(cat.id)}
                            className={`flex items-center gap-2 px-6 py-4 text-xs font-bold uppercase tracking-wide border-b-2 transition-all whitespace-nowrap ${activeTab === cat.id ? 'border-red-600 text-red-600 bg-red-50/50 dark:bg-red-900/10' : 'border-transparent text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200'}`}
                        >
                            <cat.icon size={16} /> {cat.label}
                        </button>
                    ))}
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {filteredEditais.map((edital) => {
                        const isInstalled = installedTemplates.includes(edital.id);
                        const SeedBtn = edital.SeedComponent;
                        return (
                            <div key={edital.id} className={`p-4 rounded-2xl border transition-all flex items-center justify-between gap-4 ${isInstalled ? 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800' : 'bg-zinc-50 dark:bg-zinc-900/50 border-dashed border-zinc-300 dark:border-zinc-700 opacity-80 hover:opacity-100'}`}>
                                <div className="flex items-center gap-3">
                                    <div className="w-12 h-12 bg-white dark:bg-zinc-800 rounded-xl border border-zinc-100 dark:border-zinc-700 flex items-center justify-center p-2 shadow-sm">
                                        <img src={edital.logo} className="w-full h-full object-contain" alt="logo"/>
                                    </div>
                                    <div>
                                        <h4 className="font-bold text-sm text-zinc-900 dark:text-white">{edital.titulo}</h4>
                                        <p className="text-[10px] text-zinc-500 font-medium uppercase tracking-wide">{edital.banca}</p>
                                    </div>
                                </div>
                                <SecureWrapper isInstalled={isInstalled} editalTitle={edital.titulo}>
                                    <SeedBtn isInstalled={isInstalled} />
                                </SecureWrapper>
                            </div>
                        )
                    })}
                    {filteredEditais.length === 0 && <div className="col-span-full py-10 text-center text-zinc-400">Nenhum edital encontrado nesta categoria.</div>}
                </div>
            </div>
        </ExpandedModal>
    );
};

// --- COMPONENTE: BLOCO DE NOTAS DO ADMIN ---
const AdminNotepad = () => {
    const [note, setNote] = useState(() => localStorage.getItem('admin_notepad') || '');

    const handleSave = (e) => {
        const val = e.target.value;
        setNote(val);
        localStorage.setItem('admin_notepad', val);
    };

    return (
        <CardContainer title="Bloco de Notas Operacional" icon={StickyNote} className="h-full">
            <textarea
                className="w-full h-full min-h-[150px] bg-yellow-50 dark:bg-yellow-900/10 border-0 resize-none outline-none text-sm text-zinc-700 dark:text-zinc-300 font-mono p-2 rounded-lg"
                placeholder="Anote pendências, ideias ou logs manuais aqui..."
                value={note}
                onChange={handleSave}
            />
            <div className="mt-2 text-[10px] text-zinc-400 flex items-center justify-end gap-1">
                <Save size={10}/> Salvo localmente
            </div>
        </CardContainer>
    );
};

// --- PÁGINA ADMIN PRINCIPAL ---

function AdminPage() {
    // --- ESTADOS DE DADOS (REAL-TIME) ---
    const [users, setUsers] = useState([]);
    const [studyRecords, setStudyRecords] = useState([]);

    // --- ESTADOS DE UI ---
    const [loading, setLoading] = useState(true);
    const [expandedView, setExpandedView] = useState(null);
    const [showEditaisModal, setShowEditaisModal] = useState(false);
    const [showBroadcastModal, setShowBroadcastModal] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');

    // --- 1. LISTENERS REAL-TIME ---

    // USUÁRIOS
    useEffect(() => {
        const q = query(collection(db, 'users'), orderBy('createdAt', 'desc'));
        // 8. CAPTURA DE EXCLUSÃO: O onSnapshot atualiza automaticamente o estado 'users' quando um doc é deletado no Firebase
        const unsub = onSnapshot(q, (snap) => {
            const data = snap.docs.map(doc => {
                const d = doc.data();
                const createdAt = d.createdAt?.toDate ? d.createdAt.toDate() : new Date();
                return { id: doc.id, ...d, createdAt };
            });
            setUsers(data);
            setLoading(false);
        });
        return () => unsub();
    }, []);

    // REGISTROS (Global - Últimos 1000)
    useEffect(() => {
        const q = query(collectionGroup(db, 'registrosEstudo'), orderBy('timestamp', 'desc'), limit(1000));
        const unsub = onSnapshot(q, (snap) => {
            const data = snap.docs.map(doc => {
                const d = doc.data();
                const uid = d.uid || doc.ref.path.split('/')[1];
                return { id: doc.id, uid, ...d, timestamp: d.timestamp?.toDate() || new Date() };
            });
            setStudyRecords(data);
        });
        return () => unsub();
    }, []);

    // --- PROCESSAMENTO DE DADOS (MEMOIZED) ---
    const dashboardData = useMemo(() => {
        const now = new Date();
        const active7Days = new Set();
        const active24Hours = new Set();
        let totalMinutes = 0;

        studyRecords.forEach(reg => {
            if(!reg.uid) return;
            totalMinutes += Number(reg.tempoEstudadoMinutos || 0);

            // Atividade
            const diffTime = now - reg.timestamp;
            if (diffTime < 604800000) active7Days.add(reg.uid); // 7 dias
            if (diffTime < 86400000) active24Hours.add(reg.uid); // 24h
        });

        // Enriquecer Usuários
        const enrichedUsers = users.map(u => {
            const userRecs = studyRecords.filter(r => r.uid === u.id);
            const totalUserMin = userRecs.reduce((acc, r) => acc + (r.tempoEstudadoMinutos || 0), 0);
            const lastStudy = userRecs.length > 0 ? userRecs[0].timestamp : null;

            let status = 'inactive';
            if (lastStudy && (now - lastStudy) < 604800000) status = 'active';
            else if (lastStudy) status = 'churn_risk';
            else if ((now - u.createdAt) > 259200000) status = 'dropout';

            return { ...u, totalHours: Math.round(totalUserMin/60), lastStudy, status };
        }).sort((a,b) => (b.lastStudy || 0) - (a.lastStudy || 0));

        return {
            totalUsers: users.length,
            newUsers24h: users.filter(u => (now - u.createdAt) < 86400000).length,
            active7d: active7Days.size,
            active24h: active24Hours.size,
            enrichedUsers,
            topUsers: enrichedUsers.sort((a,b) => b.totalHours - a.totalHours).slice(0, 5),
        };
    }, [users, studyRecords]);

    const getUser = (uid) => users.find(u => u.id === uid) || { name: 'Usuário', email: '...', photoURL: null };

    // Função de Deletar Usuário (Real Time Update - Item 8)
    const handleDeleteUser = async (uid) => {
        if(window.confirm("⚠️ OPERAÇÃO IRREVERSÍVEL\n\nIsso apagará o usuário e desvinculará todos os dados. Confirmar exclusão?")) {
            try {
                await deleteDoc(doc(db, 'users', uid));
                // O onSnapshot acima vai rodar e atualizar 'users' e os KPIs automaticamente
                alert("Usuário excluído com sucesso.");
            } catch (error) {
                alert("Erro ao eliminar usuário: " + error.message);
            }
        }
    };

    return (
        <div className="w-full pb-20 animate-slide-up space-y-6 max-w-7xl mx-auto px-4 pt-8">

            {/* MODAIS */}
            <EditaisManagerModal isOpen={showEditaisModal} onClose={() => setShowEditaisModal(false)} />
            <BroadcastModal isOpen={showBroadcastModal} onClose={() => setShowBroadcastModal(false)} />

            {/* EXPANDED MODAL (Tabelas Completas) */}
            <ExpandedModal isOpen={!!expandedView} onClose={() => setExpandedView(null)} title={expandedView === 'users' ? 'Base de Alunos (QAP)' : 'Registro de Estudos (Log)'}>
                <div className="space-y-4">
                    <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                        <div className="flex items-center gap-2 bg-zinc-100 dark:bg-zinc-900 p-2 rounded-xl w-full md:w-96 border border-zinc-200 dark:border-zinc-800 transition-colors focus-within:ring-2 focus-within:ring-red-500/20">
                            <Search size={18} className="text-zinc-400 ml-2"/>
                            <input type="text" placeholder="Filtrar dados por nome, email..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="bg-transparent outline-none w-full text-sm text-zinc-700 dark:text-zinc-300"/>
                        </div>
                        {expandedView === 'users' && (
                            <button
                                onClick={() => exportToCSV(dashboardData.enrichedUsers, 'alunos_modoqap.csv')}
                                className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 font-bold text-xs shadow-lg shadow-emerald-600/20 transition-transform hover:scale-105"
                            >
                                <FileSpreadsheet size={16}/> Exportar Excel
                            </button>
                        )}
                    </div>

                    {expandedView === 'users' && (
                        <div className="overflow-x-auto rounded-2xl border border-zinc-200 dark:border-zinc-800">
                            <table className="w-full text-left border-collapse">
                                <thead className="bg-zinc-100 dark:bg-zinc-900 text-xs uppercase text-zinc-500 font-bold">
                                    <tr>
                                        <th className="p-4">Aluno</th>
                                        <th className="p-4">Email</th>
                                        <th className="p-4 text-center">Status</th>
                                        <th className="p-4 text-center">Cadastro</th>
                                        <th className="p-4 text-center">Último Estudo</th>
                                        <th className="p-4 text-center">Total Horas</th>
                                        <th className="p-4 text-right">Ação</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800 text-sm">
                                    {dashboardData.enrichedUsers.filter(u => u.name.toLowerCase().includes(searchTerm.toLowerCase()) || u.email.toLowerCase().includes(searchTerm.toLowerCase())).map(u => (
                                        <tr key={u.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-900/50 bg-white dark:bg-zinc-950 transition-colors">
                                            <td className="p-4"><div className="flex items-center gap-3"><Avatar user={u} size="sm"/><span className="font-bold text-zinc-800 dark:text-zinc-200">{u.name}</span></div></td>
                                            <td className="p-4 text-zinc-500">{u.email}</td>
                                            <td className="p-4 text-center">
                                                <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase ${
                                                    u.status === 'active' ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30' :
                                                    u.status === 'churn_risk' ? 'bg-amber-100 text-amber-600 dark:bg-amber-900/30' :
                                                    'bg-zinc-100 text-zinc-400 dark:bg-zinc-800'
                                                }`}>
                                                    {u.status === 'active' ? 'Ativo' : u.status === 'churn_risk' ? 'Risco' : 'Inativo'}
                                                </span>
                                            </td>
                                            <td className="p-4 text-center text-zinc-400 text-xs">{formatTimeAgo(u.createdAt)}</td>
                                            <td className="p-4 text-center text-zinc-400 text-xs">{formatTimeAgo(u.lastStudy)}</td>
                                            <td className="p-4 text-center font-mono font-bold text-red-600 dark:text-red-400">{u.totalHours}h</td>
                                            <td className="p-4 text-right"><button onClick={() => handleDeleteUser(u.id)} className="p-2 bg-zinc-100 dark:bg-zinc-900 rounded hover:bg-red-100 hover:text-red-600 transition-colors"><Trash2 size={16}/></button></td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                    {expandedView === 'studies' && (
                        /* Tabela de Registros simplificada para o modal */
                        <div className="overflow-x-auto rounded-2xl border border-zinc-200 dark:border-zinc-800">
                             <table className="w-full text-left border-collapse">
                                <thead className="bg-zinc-100 dark:bg-zinc-900 text-xs uppercase text-zinc-500 font-bold">
                                    <tr>
                                        <th className="p-4">Aluno</th>
                                        <th className="p-4">Disciplina</th>
                                        <th className="p-4">Assunto</th>
                                        <th className="p-4 text-center">Tempo</th>
                                        <th className="p-4 text-right">Quando</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800 text-sm">
                                    {studyRecords.filter(r => r.disciplinaNome?.toLowerCase().includes(searchTerm.toLowerCase())).slice(0, 100).map(r => {
                                         const user = getUser(r.uid);
                                         return (
                                            <tr key={r.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-900/50 bg-white dark:bg-zinc-950 transition-colors">
                                                <td className="p-4"><div className="flex items-center gap-2"><Avatar user={user} size="sm"/><span className="font-medium">{user.name}</span></div></td>
                                                <td className="p-4 font-bold text-zinc-700 dark:text-zinc-300">{r.disciplinaNome}</td>
                                                <td className="p-4 text-zinc-500 text-xs">{r.assunto || '-'}</td>
                                                <td className="p-4 text-center font-mono font-bold text-emerald-600">+{r.tempoEstudadoMinutos}m</td>
                                                <td className="p-4 text-right text-zinc-400 text-xs">{formatTimeAgo(r.timestamp)}</td>
                                            </tr>
                                         )
                                    })}
                                </tbody>
                             </table>
                        </div>
                    )}
                </div>
            </ExpandedModal>

            {/* HEADER */}
            <header className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 border-b border-zinc-200 dark:border-zinc-800 pb-6">
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
                    {/* Botão de Broadcast */}
                    <button
                        onClick={() => setShowBroadcastModal(true)}
                        className="flex items-center gap-2 px-5 py-3 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 rounded-xl font-bold hover:scale-105 transition-transform shadow-xl"
                    >
                        <Megaphone size={18} /> <span className="hidden sm:inline">Broadcast</span>
                    </button>

                    {dashboardData.newUsers24h > 0 && (
                        <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="flex items-center gap-3 px-4 py-2 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-800 rounded-xl">
                            <div className="relative"><Bell size={18} className="text-emerald-600"/><span className="absolute top-0 right-0 w-2 h-2 bg-red-500 rounded-full animate-pulse"></span></div>
                            <span className="text-xs font-bold text-emerald-700 dark:text-emerald-300">+{dashboardData.newUsers24h} Novos</span>
                        </motion.div>
                    )}
                </div>
            </header>

            {loading ? (
                <div className="flex flex-col items-center justify-center h-64"><Loader2 size={48} className="text-red-600 animate-spin mb-4"/><span className="text-zinc-400 font-bold uppercase text-xs tracking-widest">Carregando inteligência...</span></div>
            ) : (
                <>
                    {/* 1. KPIs (Reduzidos e Limpos) */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4">
                        <PerformanceMetricCard color="zinc" icon={Users} title="Total Alunos" value={dashboardData.totalUsers} subValue="Na plataforma" trend={2} />
                        <PerformanceMetricCard color="red" icon={Target} title="Ativos (7d)" value={dashboardData.active7d} subValue="Engajamento Real" />
                        <PerformanceMetricCard color="amber" icon={Activity} title="Online (24h)" value={dashboardData.active24h} subValue="Plantão QAP" />
                    </div>

                    {/* 2. LINHA DE COMANDO & UTILITÁRIOS */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        {/* Gerenciador de Editais */}
                        <div
                            onClick={() => setShowEditaisModal(true)}
                            className="lg:col-span-2 bg-gradient-to-r from-zinc-900 to-zinc-800 dark:from-zinc-950 dark:to-zinc-900 text-white p-6 rounded-2xl shadow-lg cursor-pointer hover:shadow-red-900/20 transition-all flex items-center justify-between group relative overflow-hidden border border-zinc-800"
                        >
                             <div className="absolute right-0 top-0 p-6 opacity-10 group-hover:opacity-20 transition-opacity transform group-hover:scale-110 duration-700"><Database size={120}/></div>
                             <div className="relative z-10 flex items-center gap-5">
                                 <div className="p-4 bg-white/10 rounded-2xl backdrop-blur-sm border border-white/10"><Server size={32} className="text-red-500"/></div>
                                 <div>
                                     <h3 className="text-xl font-black uppercase tracking-tight">Instalação de Editais</h3>
                                     <p className="text-sm text-zinc-400 mt-1">Gerenciar catálogo, seeds e templates de prova.</p>
                                     <div className="flex gap-2 mt-3">
                                         <span className="px-2 py-1 bg-white/5 rounded text-[10px] border border-white/10">PMBA</span>
                                         <span className="px-2 py-1 bg-white/5 rounded text-[10px] border border-white/10">PPMG</span>
                                         <span className="px-2 py-1 bg-white/5 rounded text-[10px] border border-white/10 text-zinc-500">+8</span>
                                     </div>
                                 </div>
                             </div>
                             <div className="relative z-10 bg-red-600 p-3 rounded-full group-hover:bg-red-500 transition-colors shadow-lg shadow-red-900/50"><ExternalLink size={24}/></div>
                        </div>

                        {/* Admin Notepad */}
                        <div className="lg:col-span-1">
                            <AdminNotepad />
                        </div>
                    </div>

                    {/* 3. COLUNAS: FEED E USUÁRIOS */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

                        {/* COLUNA ESQUERDA: FEED AO VIVO (Item 9: Ícone Pulsante) */}
                        <CardContainer
                            title="Feed Ao Vivo"
                            subtitle="Monitoramento em Tempo Real"
                            icon={Activity}
                            isLive={true}
                            className="h-[500px]"
                            action={<button onClick={() => setExpandedView('studies')} className="p-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg text-zinc-400 transition-colors"><Maximize2 size={14}/></button>}
                        >
                            <div className="overflow-y-auto space-y-3 custom-scrollbar pr-1 h-full pb-4">
                                <AnimatePresence>
                                    {studyRecords.slice(0, 15).map(r => {
                                        const user = getUser(r.uid);
                                        return (
                                            <motion.div key={r.id} initial={{opacity:0, x:-10}} animate={{opacity:1, x:0}} className="flex items-center gap-3 p-3 bg-zinc-50 dark:bg-zinc-900/40 rounded-xl border border-zinc-100 dark:border-zinc-800/50 hover:border-zinc-300 dark:hover:border-zinc-700 transition-colors">
                                                <Avatar user={user} size="sm"/>
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-xs font-bold text-zinc-800 dark:text-zinc-200 truncate">{user.name}</p>
                                                    <div className="text-[10px] text-zinc-500 truncate flex items-center gap-1">
                                                        <div className="w-1.5 h-1.5 rounded-full bg-red-500"/>
                                                        {r.disciplinaNome}
                                                    </div>
                                                </div>
                                                <div className="text-right">
                                                    <span className="block text-xs font-black text-red-600">+{r.tempoEstudadoMinutos}m</span>
                                                    <span className="text-[9px] text-zinc-400">{formatTimeAgo(r.timestamp)}</span>
                                                </div>
                                            </motion.div>
                                        )
                                    })}
                                </AnimatePresence>
                            </div>
                        </CardContainer>

                        {/* COLUNA DIREITA: TOP USUÁRIOS */}
                        <CardContainer title="Elite da Tropa (Top 10)" subtitle="Maior carga horária" icon={Crown}
                            className="h-[500px]"
                            action={<button onClick={() => setExpandedView('users')} className="text-xs font-bold text-red-600 hover:text-red-700">Ver Base Completa</button>}
                        >
                            <div className="overflow-y-auto h-full space-y-3 custom-scrollbar pr-1 pb-4">
                                {dashboardData.topUsers.concat(dashboardData.enrichedUsers.slice(5, 10)).map((u, i) => (
                                    <div key={u.id} className="flex items-center justify-between p-2 rounded-xl hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-colors group">
                                        <div className="flex items-center gap-4">
                                            <div className={`font-black text-lg w-6 text-center ${i===0 ? 'text-yellow-500 drop-shadow-md' : i===1 ? 'text-zinc-400' : i===2 ? 'text-amber-700' : 'text-zinc-300'}`}>{i+1}</div>
                                            <Avatar user={u} size="md"/>
                                            <div>
                                                <p className="text-sm font-bold text-zinc-900 dark:text-white group-hover:text-red-600 transition-colors">{u.name}</p>
                                                <p className="text-[10px] text-zinc-500">{u.email.substring(0, 20)}...</p>
                                            </div>
                                        </div>
                                        <div className="text-right bg-zinc-100 dark:bg-zinc-800 px-2 py-1 rounded-lg">
                                            <span className="block text-xs font-black text-zinc-800 dark:text-white">{u.totalHours}h</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </CardContainer>

                    </div>
                </>
            )}
        </div>
    );
}

export default AdminPage;