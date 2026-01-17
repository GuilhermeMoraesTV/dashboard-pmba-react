import React, { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { db } from '../firebaseConfig';
import {
  collection, query, collectionGroup, doc, deleteDoc, onSnapshot, limit, orderBy, addDoc, serverTimestamp
} from 'firebase/firestore';
import {
  ShieldAlert, Database, Users, Activity, Server, Lock,
  Loader2, Search, Crown, Maximize2, Trash2, X, Bell, ExternalLink, LayoutGrid, Flame, Siren,
  BadgeAlert, Megaphone, FileSpreadsheet, Target, Zap, AlertTriangle, CheckCircle2,
  ChevronDown, ChevronUp, Timer, Trophy
} from 'lucide-react';

// ==================================================================================
// 🚀 AUTOMATIZAÇÃO DE EDITAIS (VITE GLOB IMPORT) - VERSÃO DEFINITIVA (NAMED EXPORTS)
// ==================================================================================
const seedModules = import.meta.glob('../components/admin/SeedEdital*.jsx', { eager: true });

const CATALOGO_EDITAIS = Object.entries(seedModules)
  .map(([path, module]) => {
    const Component = module.default;
    if (!Component) return null;

    const config = module.editalConfig || {};
    const fileName = path.split('/').pop().replace('.jsx', '');
    const siglaBruta = fileName.replace('SeedEdital', '');
    const siglaLower = siglaBruta.toLowerCase();

    const idFinal = config.id || siglaLower;
    const tituloFinal = config.titulo || `Edital ${siglaBruta}`;
    const bancaFinal = config.banca || 'A Definir';

    let tipoFinal = config.tipo;
    if (!tipoFinal) {
      if (idFinal.includes('pm')) tipoFinal = 'pm';
      else if (idFinal.includes('pc')) tipoFinal = 'pc';
      else if (idFinal.includes('pp')) tipoFinal = 'pp';
      else if (idFinal.includes('cbm') || idFinal.includes('bm')) tipoFinal = 'cbm';
      else if (idFinal.includes('gcm') || idFinal.includes('gm')) tipoFinal = 'gcm';
      else tipoFinal = 'outros';
    }

    let logoFinal = config.logo || `/logosEditais/logo-${siglaLower}.png`;
    if (!config.logo && siglaLower.includes('aquiraz')) logoFinal = '/logosEditais/logo-aquiraz.png';

    return {
      id: idFinal,
      titulo: tituloFinal,
      banca: bancaFinal,
      logo: logoFinal,
      SeedComponent: Component,
      type: tipoFinal
    };
  })
  .filter(Boolean);

// --- UTILITÁRIOS ---
const exportToCSV = (data, filename) => {
  const csvContent = "data:text/csv;charset=utf-8,"
    + "Nome,Email,Cadastro,UltimoEstudo,HorasTotais,Acertos,Questoes\n"
    + data.map(e => `${e.name},${e.email},${e.createdAt ? e.createdAt.toISOString() : ''},${e.lastStudy ? e.lastStudy.toISOString() : ''},${e.totalHours},${e.totalCorrect},${e.totalQuestions}`).join("\n");

  const encodedUri = encodeURI(csvContent);
  const link = document.createElement("a");
  link.setAttribute("href", encodedUri);
  link.setAttribute("download", filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
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

const formatClock = (totalSeconds) => {
  const safe = Math.max(0, Number(totalSeconds) || 0);
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const seconds = safe % 60;
  return [hours, minutes, seconds].map(v => String(v).padStart(2, '0')).join(':');
};

const formatHMFromMinutes = (minutes) => {
  const m = Math.max(0, Number(minutes) || 0);
  const h = Math.floor(m / 60);
  const mm = m % 60;
  if (h > 0) return `${h}h ${mm}m`;
  return `${mm}m`;
};

// --- COMPONENTES VISUAIS ---
const PerformanceMetricCard = ({ title, value, subValue, icon: Icon, color, trend }) => {
  const colorStyles = {
    blue: { iconBg: 'bg-blue-50 dark:bg-blue-900/20', iconColor: 'text-blue-600 dark:text-blue-400', watermark: 'text-blue-600', border: 'border-blue-100 dark:border-blue-900/30' },
    emerald: { iconBg: 'bg-emerald-50 dark:bg-emerald-900/20', iconColor: 'text-emerald-600 dark:text-emerald-400', watermark: 'text-emerald-600', border: 'border-emerald-100 dark:border-emerald-900/30' },
    red: { iconBg: 'bg-red-50 dark:bg-red-900/20', iconColor: 'text-red-600 dark:text-red-400', watermark: 'text-red-600', border: 'border-red-100 dark:border-blue-900/30' },
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

      <div className="absolute inset-0 bg-gradient-to-tr from-white/0 via-white/0 to-white/10 dark:to-white/5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
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
        <img src={user.photoURL} alt={user.name || 'user'} className="w-full h-full object-cover" />
      ) : (
        <span className="font-black text-zinc-500 dark:text-zinc-400">
          {user.name ? user.name.substring(0, 2).toUpperCase() : <Users size={14} />}
        </span>
      )}
    </div>
  );
};

// --- MODAL EXPANDIDO (SCROLL LOCK) ---
const ExpandedModal = ({ isOpen, onClose, title, children }) => {
  useEffect(() => {
    if (isOpen) document.body.style.overflow = 'hidden';
    else document.body.style.overflow = 'unset';
    return () => { document.body.style.overflow = 'unset'; };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-fade-in">
      <motion.div
        initial={{ scale: 0.95, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        className="bg-white dark:bg-zinc-950 w-full max-w-6xl max-h-[90vh] rounded-3xl border border-zinc-200 dark:border-zinc-800 shadow-2xl flex flex-col overflow-hidden"
      >
        <div className="p-6 border-b border-zinc-100 dark:border-zinc-800 flex justify-between items-center bg-zinc-50/50 dark:bg-zinc-900/50">
          <h3 className="text-2xl font-black text-zinc-900 dark:text-white flex items-center gap-3">{title}</h3>
          <button onClick={onClose} className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-full transition-colors"><X size={24} /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-6 bg-zinc-50/30 dark:bg-black/20 custom-scrollbar">{children}</div>
      </motion.div>
    </div>
  );
};

// --- MODAL DE BROADCAST ---
const BroadcastModal = ({ isOpen, onClose }) => {
  const [message, setMessage] = useState('');
  const [category, setCategory] = useState('comunicado');
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (isOpen) document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = 'unset'; };
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSend = async () => {
    if (!message.trim()) return;
    setSending(true);
    try {
      await addDoc(collection(db, 'system_broadcasts'), {
        message,
        category,
        timestamp: serverTimestamp(),
        active: true,
        type: 'admin_push'
      });

      setMessage('');
      setCategory('comunicado');
      onClose();
      alert("📣 Broadcast enviado com sucesso!");
    } catch (error) {
      console.error("Erro ao enviar broadcast:", error);
      alert("Erro ao enviar.");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-fade-in">
      <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} className="bg-white dark:bg-zinc-950 w-full max-w-md rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-2xl p-6">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 bg-indigo-50 dark:bg-indigo-900/20 rounded-xl text-indigo-600">
            <Megaphone size={24} />
          </div>
          <div>
            <h3 className="text-xl font-bold text-zinc-900 dark:text-white">Transmissão</h3>
            <p className="text-xs text-zinc-500">Enviar push para todos online.</p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2 mb-4 mt-4">
          <button
            onClick={() => setCategory('comunicado')}
            className={`flex flex-col items-center gap-1 p-2 rounded-xl border-2 transition-all ${category === 'comunicado' ? 'border-red-500 bg-red-50 dark:bg-red-900/20 text-red-600' : 'border-transparent bg-zinc-100 dark:bg-zinc-800 text-zinc-400 hover:bg-zinc-200'}`}
          >
            <Megaphone size={18} />
            <span className="text-[10px] font-bold uppercase">Comunicado</span>
          </button>
          <button
            onClick={() => setCategory('atualizacao')}
            className={`flex flex-col items-center gap-1 p-2 rounded-xl border-2 transition-all ${category === 'atualizacao' ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-600' : 'border-transparent bg-zinc-100 dark:bg-zinc-800 text-zinc-400 hover:bg-zinc-200'}`}
          >
            <Zap size={18} />
            <span className="text-[10px] font-bold uppercase">Atualização</span>
          </button>
          <button
            onClick={() => setCategory('aviso')}
            className={`flex flex-col items-center gap-1 p-2 rounded-xl border-2 transition-all ${category === 'aviso' ? 'border-amber-500 bg-amber-50 dark:bg-amber-900/20 text-amber-600' : 'border-transparent bg-zinc-100 dark:bg-zinc-800 text-zinc-400 hover:bg-zinc-200'}`}
          >
            <AlertTriangle size={18} />
            <span className="text-[10px] font-bold uppercase">Aviso</span>
          </button>
        </div>

        <textarea
          className="w-full h-32 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-3 text-sm focus:ring-2 focus:ring-indigo-500 outline-none resize-none dark:text-white"
          placeholder="Digite a mensagem aqui..."
          value={message}
          onChange={(e) => setMessage(e.target.value)}
        />

        <div className="flex gap-3 mt-4 justify-end">
          <button onClick={onClose} className="px-4 py-2 text-sm font-bold text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg">Cancelar</button>
          <button
            onClick={handleSend}
            disabled={!message || sending}
            className="px-4 py-2 text-sm font-bold bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 rounded-lg hover:opacity-90 disabled:opacity-50 flex items-center gap-2 shadow-lg"
          >
            {sending ? <Loader2 size={16} className="animate-spin" /> : <Zap size={16} fill="currentColor" />}
            {sending ? 'Enviando...' : 'Transmitir'}
          </button>
        </div>
      </motion.div>
    </div>
  );
};

// --- MODAL GERENCIADOR DE EDITAIS ---
const EditaisManagerModal = ({ isOpen, onClose }) => {
  const [installedTemplates, setInstalledTemplates] = useState([]);
  const [activeTab, setActiveTab] = useState('todos');

  useEffect(() => {
    if (!isOpen) return;
    const unsub = onSnapshot(collection(db, 'editais_templates'), (snap) => {
      const ids = snap.docs.map(d => d.id);
      setInstalledTemplates(ids);
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

  const EditalCard = ({ edital }) => {
    const isInstalled = installedTemplates.includes(edital.id);
    const SeedBtn = edital.SeedComponent;

    const handleDelete = async () => {
      if (window.confirm(`ATENÇÃO: Deseja apagar o template "${edital.titulo}" do banco de dados? Isso afetará a criação de novos ciclos para este edital.`)) {
        try {
          await deleteDoc(doc(db, 'editais_templates', edital.id));
          alert("Edital removido do banco.");
        } catch (e) {
          alert("Erro ao remover: " + e.message);
        }
      }
    };

    return (
      <div className={`p-4 rounded-2xl border transition-all flex items-center justify-between gap-4 ${isInstalled ? 'bg-emerald-50/50 dark:bg-emerald-900/10 border-emerald-200 dark:border-emerald-800' : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800'}`}>
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-white dark:bg-zinc-800 rounded-xl border border-zinc-100 dark:border-zinc-700 flex items-center justify-center p-2 shadow-sm relative">
            <img src={edital.logo} className="w-full h-full object-contain" alt="logo" onError={(e) => { e.target.src = '/vite.svg'; }} />
            {isInstalled && (
              <div className="absolute -top-1 -right-1 bg-emerald-500 text-white rounded-full p-0.5 border-2 border-white dark:border-zinc-900 shadow-sm">
                <CheckCircle2 size={10} strokeWidth={4} />
              </div>
            )}
          </div>
          <div>
            <h4 className="font-bold text-sm text-zinc-900 dark:text-white flex items-center gap-2">
              {edital.titulo}
              {isInstalled && <span className="text-[9px] bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 px-1.5 py-0.5 rounded font-bold uppercase tracking-wide">Instalado</span>}
            </h4>
            <p className="text-[10px] text-zinc-500 font-medium uppercase tracking-wide">Banca: {edital.banca} | ID: {edital.id}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <SeedBtn isInstalled={isInstalled} />
          {isInstalled && (
            <button
              onClick={handleDelete}
              className="p-2 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-400 hover:text-red-500 hover:border-red-200 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-all shadow-sm"
              title="Remover do Banco de Dados"
            >
              <Trash2 size={16} />
            </button>
          )}
        </div>
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

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 pb-10">
          {filteredEditais.map((edital) => (
            <EditalCard key={edital.id} edital={edital} />
          ))}
          {filteredEditais.length === 0 && <div className="col-span-full py-10 text-center text-zinc-400">Nenhum edital encontrado.</div>}
        </div>
      </div>
    </ExpandedModal>
  );
};

// --- Hook para timer sincronizado no Admin (sem chamar hook em loop) ---
const useSyncedSeconds = (session) => {
  const [live, setLive] = useState(Number(session?.seconds || 0));

  useEffect(() => {
    if (!session) return;
    let raf = null;
    let interval = null;

    const compute = () => {
      const baseSec = Number(session.seconds || 0);
      const baseTs = Number(session.lastTimestamp || Date.now());
      const delta = Math.floor((Date.now() - baseTs) / 1000);

      const isCountUp = (session.mode === 'free' && session.phase === 'focus');
      const paused = !!session.isPaused;

      let next = baseSec;
      if (!paused) next = isCountUp ? (baseSec + delta) : Math.max(0, baseSec - delta);

      setLive(next);
    };

    compute();
    interval = setInterval(compute, 1000);

    return () => {
      if (interval) clearInterval(interval);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [
    session?.uid,
    session?.seconds,
    session?.lastTimestamp,
    session?.isPaused,
    session?.mode,
    session?.phase
  ]);

  return live;
};

const ActiveTimerRow = ({ s }) => {
  const liveSeconds = useSyncedSeconds(s);

  const typeLabel = s?.timerType === 'pomodoro' ? 'Pomodoro' : 'Livre';
  const phaseLabel = s?.phase === 'rest' ? 'Descanso' : 'Foco';

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className="p-3 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/60 dark:bg-zinc-900/30 hover:bg-zinc-50 dark:hover:bg-zinc-900/50 transition-colors"
    >
      <div className="flex items-center gap-3">
        <Avatar user={{ name: s.userName, photoURL: s.photoURL }} size="sm" />
        <div className="min-w-0 flex-1">
          <p className="text-xs font-extrabold text-zinc-900 dark:text-white truncate">{s.userName}</p>
          <p className="text-[10px] text-zinc-500 dark:text-zinc-400 truncate">
            {s.disciplinaNome}{s.assunto ? ` • ${s.assunto}` : ''}
          </p>
          <div className="mt-1 flex items-center gap-2">
            <span className="text-[9px] font-bold uppercase px-2 py-0.5 rounded-full bg-zinc-200/70 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300">
              {typeLabel}
            </span>
            <span className={`text-[9px] font-bold uppercase px-2 py-0.5 rounded-full ${phaseLabel === 'Descanso'
              ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
              : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
              }`}>
              {phaseLabel}
            </span>
            {s.isPaused && (
              <span className="text-[9px] font-bold uppercase px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
                Pausado
              </span>
            )}
          </div>
        </div>

        <div className="text-right">
          <p className="text-lg font-black font-mono text-zinc-900 dark:text-white leading-none">{formatClock(liveSeconds)}</p>
          <p className="text-[9px] text-zinc-400">{formatTimeAgo(new Date(Number(s.lastTimestamp || Date.now())))}</p>
        </div>
      </div>
    </motion.div>
  );
};

const StudyingNowPanel = ({ session }) => {
  const [expanded, setExpanded] = useState(false);
  const liveSeconds = useSyncedSeconds(session);

  const hasSession = !!session;

  return (
    <div
      className="relative overflow-hidden rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 shadow-sm"
    >
      <div className="absolute inset-0 pointer-events-none opacity-30 dark:opacity-20 bg-[radial-gradient(circle_at_20%_20%,rgba(239,68,68,0.25),transparent_45%),radial-gradient(circle_at_80%_30%,rgba(59,130,246,0.25),transparent_45%),radial-gradient(circle_at_40%_90%,rgba(16,185,129,0.20),transparent_50%)]" />

      <button
        onClick={() => setExpanded(v => !v)}
        className="relative w-full text-left p-5 md:p-6 flex items-start justify-between gap-4"
      >
        <div className="flex items-center gap-3">
          <div className="p-2 bg-zinc-100 dark:bg-zinc-900 rounded-lg text-zinc-500 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-800 relative">
            <Timer size={18} strokeWidth={2.5} />
            <span className="absolute -top-1 -right-1 flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
            </span>
          </div>
          <div>
            <h3 className="text-sm font-extrabold text-zinc-900 dark:text-white uppercase tracking-tight">
              Estudando Agora
            </h3>
            <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
              Sessões ativas em tempo real
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {hasSession ? (
            <div className="flex items-center gap-3 px-3 py-2 rounded-2xl bg-white/70 dark:bg-zinc-900/60 border border-zinc-200/70 dark:border-zinc-800">
              <Avatar user={{ name: session.userName, photoURL: session.photoURL }} size="sm" />
              <div className="min-w-0">
                <p className="text-[11px] font-black text-zinc-900 dark:text-white truncate max-w-[180px]">{session.userName}</p>
                <p className="text-[10px] text-zinc-500 dark:text-zinc-400 truncate max-w-[180px]">
                  {session.disciplinaNome}{session.assunto ? ` • ${session.assunto}` : ''}
                </p>
              </div>
              <div className="pl-2 border-l border-zinc-200 dark:border-zinc-800">
                <p className="text-sm font-black font-mono text-zinc-900 dark:text-white">{formatClock(liveSeconds)}</p>
              </div>
            </div>
          ) : (
            <div className="px-3 py-2 rounded-2xl bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-xs font-bold text-zinc-500">
              Nenhum aluno ativo agora
            </div>
          )}

          <div className="p-2 rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-colors border border-transparent">
            {expanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
          </div>
        </div>
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="relative overflow-hidden"
          >
            <div className="px-5 md:px-6 pb-6">
              {hasSession ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-5 rounded-2xl bg-white/70 dark:bg-zinc-900/60 border border-zinc-200/70 dark:border-zinc-800">
                    <div className="flex items-center gap-4">
                      <Avatar user={{ name: session.userName, photoURL: session.photoURL }} size="lg" />
                      <div className="min-w-0">
                        <p className="text-sm font-black text-zinc-900 dark:text-white truncate">{session.userName}</p>
                        <p className="text-xs text-zinc-500 dark:text-zinc-400 truncate">
                          {session.disciplinaNome}{session.assunto ? ` • ${session.assunto}` : ''}
                        </p>

                        <div className="mt-3 flex flex-wrap gap-2">
                          <span className="text-[10px] font-black uppercase px-2 py-1 rounded-full bg-zinc-200/70 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-200">
                            {session.timerType === 'pomodoro' ? 'Pomodoro' : 'Livre'}
                          </span>
                          <span className={`text-[10px] font-black uppercase px-2 py-1 rounded-full ${session.phase === 'rest'
                            ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
                            : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
                            }`}>
                            {session.phase === 'rest' ? 'Descanso' : 'Foco'}
                          </span>
                          {session.isPaused && (
                            <span className="text-[10px] font-black uppercase px-2 py-1 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
                              Pausado
                            </span>
                          )}
                          {session.cicloNome && (
                            <span className="text-[10px] font-black uppercase px-2 py-1 rounded-full bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-300">
                              {session.cicloNome}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="p-5 rounded-2xl bg-gradient-to-br from-zinc-950 to-zinc-900 text-white border border-zinc-800 shadow-xl">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-white/60 mb-2">
                      Timer sincronizado
                    </p>
                    <p className="text-5xl md:text-6xl font-black font-mono tracking-tighter">
                      {formatClock(liveSeconds)}
                    </p>
                    <p className="mt-3 text-xs text-white/70">
                      Atualização ao vivo • {formatTimeAgo(new Date(Number(session.lastTimestamp || Date.now())))}
                    </p>
                    <div className="mt-4 flex items-center gap-2 text-[10px] font-bold uppercase tracking-wide text-white/60">
                      <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                      LIVE
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-5 rounded-2xl bg-zinc-50 dark:bg-zinc-900/40 border border-zinc-200 dark:border-zinc-800 text-sm text-zinc-500">
                  Quando alguém iniciar o timer, ele aparece aqui automaticamente.
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// --- PÁGINA ADMIN PRINCIPAL ---
function AdminPage() {
  const [users, setUsers] = useState([]);
  const [studyRecords, setStudyRecords] = useState([]);
  const [activeSessions, setActiveSessions] = useState([]);

  const [loading, setLoading] = useState(true);
  const [expandedView, setExpandedView] = useState(null);
  const [showEditaisModal, setShowEditaisModal] = useState(false);
  const [showBroadcastModal, setShowBroadcastModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const [rankingMode, setRankingMode] = useState('hours'); // hours | correct

  // USERS
  useEffect(() => {
    const q = query(collection(db, 'users'), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q, (snap) => {
      const data = snap.docs.map(docu => {
        const d = docu.data();
        const createdAt = d.createdAt?.toDate ? d.createdAt.toDate() : new Date();
        return { id: docu.id, ...d, createdAt };
      });
      setUsers(data);
      setLoading(false);
    }, (error) => {
      console.error("Erro ao buscar usuários:", error);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  // STUDY RECORDS (últimos 1000 globais)
  useEffect(() => {
    const q = query(collectionGroup(db, 'registrosEstudo'), orderBy('timestamp', 'desc'), limit(1000));
    const unsub = onSnapshot(q, (snap) => {
      const data = snap.docs.map(docu => {
        const d = docu.data();
        const uid = d.uid || docu.ref.path.split('/')[1];
        return {
          id: docu.id,
          uid,
          ...d,
          timestamp: d.timestamp?.toDate?.() || new Date()
        };
      });
      setStudyRecords(data);
    }, (error) => {
      console.error("Erro ao buscar registros:", error);
    });
    return () => unsub();
  }, []);

  // ACTIVE SESSIONS (real-time)
  useEffect(() => {
    const q = query(collection(db, 'active_timers'), orderBy('updatedAt', 'desc'), limit(50));
    const unsub = onSnapshot(q, (snap) => {
      const data = snap.docs.map(docu => {
        const d = docu.data();
        return {
          id: docu.id,
          ...d,
          updatedAt: d.updatedAt?.toDate?.() || new Date(),
          lastTimestamp: Number(d.lastTimestamp || Date.now()),
          seconds: Number(d.seconds || 0),
        };
      });
      setActiveSessions(data);
    }, (error) => {
      console.error("Erro ao buscar active_timers:", error);
    });
    return () => unsub();
  }, []);

  const getUser = (uid) => users.find(u => u.id === uid) || { name: 'Usuário', email: '...', photoURL: null };

  const handleDeleteUser = async (uid) => {
    if (window.confirm("⚠️ OPERAÇÃO IRREVERSÍVEL\n\nIsso apagará o usuário e desvinculará todos os dados. Confirmar exclusão?")) {
      try {
        await deleteDoc(doc(db, 'users', uid));
        alert("Usuário excluído com sucesso.");
      } catch (error) {
        alert("Erro ao eliminar usuário: " + error.message);
      }
    }
  };

  const dashboardData = useMemo(() => {
    const now = new Date();
    const active7Days = new Set();
    const active24Hours = new Set();

    const statsByUid = new Map(); // minutes / questions / correct

    studyRecords.forEach(reg => {
      if (!reg.uid) return;

      const minutes = Number(reg.tempoEstudadoMinutos || reg.duracaoMinutos || 0);
      const q = Number(reg.questoesFeitas || 0);
      const c = Number(reg.acertos || 0);

      const cur = statsByUid.get(reg.uid) || { minutes: 0, questions: 0, correct: 0 };
      cur.minutes += minutes;
      cur.questions += q;
      cur.correct += c;
      statsByUid.set(reg.uid, cur);

      const diffTime = now - reg.timestamp;
      if (diffTime < 604800000) active7Days.add(reg.uid);
      if (diffTime < 86400000) active24Hours.add(reg.uid);
    });

    const enrichedUsers = users.map(u => {
      const stats = statsByUid.get(u.id) || { minutes: 0, questions: 0, correct: 0 };
      const userRecs = studyRecords.filter(r => r.uid === u.id);
      const lastStudy = userRecs.length > 0 ? userRecs[0].timestamp : null;

      let status = 'inactive';
      if (lastStudy && (now - lastStudy) < 604800000) status = 'active';
      else if (lastStudy) status = 'churn_risk';
      else if ((now - u.createdAt) > 259200000) status = 'dropout';

      const totalHours = Math.round(stats.minutes / 60);
      const totalQuestions = stats.questions;
      const totalCorrect = stats.correct;
      const accuracy = totalQuestions > 0 ? Math.round((totalCorrect / totalQuestions) * 100) : null;

      return {
        ...u,
        totalHours,
        lastStudy,
        status,
        totalQuestions,
        totalCorrect,
        accuracy
      };
    }).sort((a, b) => (b.lastStudy || 0) - (a.lastStudy || 0));

    const topByHours = [...enrichedUsers].sort((a, b) => (b.totalHours || 0) - (a.totalHours || 0)).slice(0, 10);
    const topByCorrect = [...enrichedUsers].sort((a, b) => (b.totalCorrect || 0) - (a.totalCorrect || 0)).slice(0, 10);

    return {
      totalUsers: users.length,
      newUsers24h: users.filter(u => (now - u.createdAt) < 86400000).length,
      active7d: active7Days.size,
      active24h: active24Hours.size,
      enrichedUsers,
      topByHours,
      topByCorrect,
    };
  }, [users, studyRecords]);

  // TTL: só considera sessão "viva" se recebeu heartbeat recentemente
  const activeSessionsFresh = useMemo(() => {
    const TTL = 2 * 60 * 1000; // 2 min
    const now = Date.now();
    return activeSessions.filter(s => (now - Number(s.lastTimestamp || 0)) <= TTL);
  }, [activeSessions]);

  const studyingNow = useMemo(() => {
    const runningFocus = activeSessionsFresh.find(s => !s.isPaused && s.phase === 'focus');
    return runningFocus || activeSessionsFresh[0] || null;
  }, [activeSessionsFresh]);

  const newUsersRealtime = useMemo(() => users.slice(0, 8), [users]);

  return (
    <div className="w-full pb-20 animate-slide-up space-y-6 max-w-7xl mx-auto px-4 pt-8">
      <EditaisManagerModal isOpen={showEditaisModal} onClose={() => setShowEditaisModal(false)} />
      <BroadcastModal isOpen={showBroadcastModal} onClose={() => setShowBroadcastModal(false)} />

      {/* EXPANDED MODAL (Tabelas Completas) */}
      <ExpandedModal isOpen={!!expandedView} onClose={() => setExpandedView(null)} title={expandedView === 'users' ? 'Base de Alunos (QAP)' : 'Registro de Estudos (Log)'}>
        <div className="space-y-4">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2 bg-zinc-100 dark:bg-zinc-900 p-2 rounded-xl w-full md:w-96 border border-zinc-200 dark:border-zinc-800 transition-colors focus-within:ring-2 focus-within:ring-red-500/20">
              <Search size={18} className="text-zinc-400 ml-2" />
              <input type="text" placeholder="Filtrar dados por nome, email..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="bg-transparent outline-none w-full text-sm text-zinc-700 dark:text-zinc-300" />
            </div>
            {expandedView === 'users' && (
              <button
                onClick={() => exportToCSV(dashboardData.enrichedUsers, 'alunos_modoqap.csv')}
                className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 font-bold text-xs shadow-lg shadow-emerald-600/20 transition-transform hover:scale-105"
              >
                <FileSpreadsheet size={16} /> Exportar Excel
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
                    <th className="p-4 text-center">Horas</th>
                    <th className="p-4 text-center">Acertos</th>
                    <th className="p-4 text-right">Ação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800 text-sm">
                  {dashboardData.enrichedUsers
                    .filter(u => (u.name || '').toLowerCase().includes(searchTerm.toLowerCase()) || (u.email || '').toLowerCase().includes(searchTerm.toLowerCase()))
                    .map(u => (
                      <tr key={u.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-900/50 bg-white dark:bg-zinc-950 transition-colors">
                        <td className="p-4">
                          <div className="flex items-center gap-3">
                            <Avatar user={u} size="sm" />
                            <span className="font-bold text-zinc-800 dark:text-zinc-200">{u.name}</span>
                          </div>
                        </td>
                        <td className="p-4 text-zinc-500">{u.email}</td>
                        <td className="p-4 text-center">
                          <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase ${u.status === 'active'
                            ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30'
                            : u.status === 'churn_risk'
                              ? 'bg-amber-100 text-amber-600 dark:bg-amber-900/30'
                              : 'bg-zinc-100 text-zinc-400 dark:bg-zinc-800'
                            }`}>
                            {u.status === 'active' ? 'Ativo' : u.status === 'churn_risk' ? 'Risco' : 'Inativo'}
                          </span>
                        </td>
                        <td className="p-4 text-center text-zinc-400 text-xs">{formatTimeAgo(u.createdAt)}</td>
                        <td className="p-4 text-center text-zinc-400 text-xs">{formatTimeAgo(u.lastStudy)}</td>
                        <td className="p-4 text-center font-mono font-black text-red-600 dark:text-red-400">{u.totalHours}h</td>
                        <td className="p-4 text-center font-mono font-black text-zinc-700 dark:text-zinc-200">{u.totalCorrect || 0}</td>
                        <td className="p-4 text-right">
                          <button onClick={() => handleDeleteUser(u.id)} className="p-2 bg-zinc-100 dark:bg-zinc-900 rounded hover:bg-red-100 hover:text-red-600 transition-colors">
                            <Trash2 size={16} />
                          </button>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          )}

          {expandedView === 'studies' && (
            <div className="overflow-x-auto rounded-2xl border border-zinc-200 dark:border-zinc-800">
              <table className="w-full text-left border-collapse">
                <thead className="bg-zinc-100 dark:bg-zinc-900 text-xs uppercase text-zinc-500 font-bold">
                  <tr>
                    <th className="p-4">Aluno</th>
                    <th className="p-4">Ciclo</th>
                    <th className="p-4">Disciplina</th>
                    <th className="p-4">Assunto</th>
                    <th className="p-4 text-center">Tempo</th>
                    <th className="p-4 text-center">Questões</th>
                    <th className="p-4 text-center">Precisão</th>
                    <th className="p-4 text-right">Quando</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800 text-sm">
                  {studyRecords
                    .filter(r => (r.disciplinaNome || '').toLowerCase().includes(searchTerm.toLowerCase()))
                    .slice(0, 150)
                    .map(r => {
                      const user = getUser(r.uid);
                      const q = Number(r.questoesFeitas || 0);
                      const c = Number(r.acertos || 0);
                      const precision = q > 0 ? Math.round((c / q) * 100) : null;

                      return (
                        <tr key={r.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-900/50 bg-white dark:bg-zinc-950 transition-colors">
                          <td className="p-4">
                            <div className="flex items-center gap-2">
                              <Avatar user={user} size="sm" />
                              <span className="font-medium">{user.name}</span>
                            </div>
                          </td>
                          <td className="p-4 text-zinc-500 text-xs">{r.cicloNome || (r.cicloId ? `Ciclo ${String(r.cicloId).slice(0, 6)}` : '-')}</td>
                          <td className="p-4 font-bold text-zinc-700 dark:text-zinc-300">{r.disciplinaNome}</td>
                          <td className="p-4 text-zinc-500 text-xs">{r.assunto || '-'}</td>
                          <td className="p-4 text-center font-mono font-black text-emerald-600">+{formatHMFromMinutes(r.tempoEstudadoMinutos || 0)}</td>
                          <td className="p-4 text-center font-mono font-black text-zinc-800 dark:text-zinc-100">{q}</td>
                          <td className="p-4 text-center font-mono font-black">{precision === null ? '-' : `${precision}%`}</td>
                          <td className="p-4 text-right text-zinc-400 text-xs">{formatTimeAgo(r.timestamp)}</td>
                        </tr>
                      );
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
          <button
            onClick={() => setShowBroadcastModal(true)}
            className="flex items-center gap-2 px-5 py-3 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 rounded-xl font-bold hover:scale-105 transition-transform shadow-xl"
          >
            <Megaphone size={18} /> <span className="hidden sm:inline">Broadcast</span>
          </button>

          {dashboardData.newUsers24h > 0 && (
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="flex items-center gap-3 px-4 py-2 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-800 rounded-xl">
              <div className="relative"><Bell size={18} className="text-emerald-600" /><span className="absolute top-0 right-0 w-2 h-2 bg-red-500 rounded-full animate-pulse"></span></div>
              <span className="text-xs font-bold text-emerald-700 dark:text-emerald-300">+{dashboardData.newUsers24h} Novos</span>
            </motion.div>
          )}
        </div>
      </header>

      {loading ? (
        <div className="flex flex-col items-center justify-center h-64">
          <Loader2 size={48} className="text-red-600 animate-spin mb-4" />
          <span className="text-zinc-400 font-bold uppercase text-xs tracking-widest">Carregando inteligência...</span>
        </div>
      ) : (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4">
            <PerformanceMetricCard color="zinc" icon={Users} title="Total Alunos" value={dashboardData.totalUsers} subValue="Na plataforma" trend={2} />
            <PerformanceMetricCard color="red" icon={Target} title="Ativos (7d)" value={dashboardData.active7d} subValue="Engajamento Real" />
            <PerformanceMetricCard color="amber" icon={Activity} title="Online (24h)" value={dashboardData.active24h} subValue="Plantão QAP" />
          </div>

          {/* LINHA: EDITAIS + NOVOS USUÁRIOS */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div
              onClick={() => setShowEditaisModal(true)}
              className="lg:col-span-2 bg-gradient-to-r from-zinc-900 to-zinc-800 dark:from-zinc-950 dark:to-zinc-900 text-white p-6 rounded-2xl shadow-lg cursor-pointer hover:shadow-red-900/20 transition-all flex items-center justify-between group relative overflow-hidden border border-zinc-800"
            >
              <div className="absolute right-0 top-0 p-6 opacity-10 group-hover:opacity-20 transition-opacity transform group-hover:scale-110 duration-700"><Database size={120} /></div>
              <div className="relative z-10 flex items-center gap-5">
                <div className="p-4 bg-white/10 rounded-2xl backdrop-blur-sm border border-white/10"><Server size={32} className="text-red-500" /></div>
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
              <div className="relative z-10 bg-red-600 p-3 rounded-full group-hover:bg-red-500 transition-colors shadow-lg shadow-red-900/50"><ExternalLink size={24} /></div>
            </div>

            <CardContainer title="Novos Usuários" subtitle="Entradas em tempo real" icon={Users} isLive={true} className="h-[220px]">
              <div className="space-y-2 overflow-y-auto custom-scrollbar pr-1 h-full pb-2">
                <AnimatePresence>
                  {newUsersRealtime.map((u) => (
                    <motion.div key={u.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between gap-3 p-2 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/60 dark:bg-zinc-900/30">
                      <div className="flex items-center gap-2 min-w-0">
                        <Avatar user={u} size="sm" />
                        <div className="min-w-0">
                          <p className="text-xs font-black text-zinc-900 dark:text-white truncate">{u.name}</p>
                          <p className="text-[10px] text-zinc-500 dark:text-zinc-400">{formatTimeAgo(u.createdAt)}</p>
                        </div>
                      </div>
                      <span className="text-[9px] font-bold uppercase px-2 py-1 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
                        Novo
                      </span>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            </CardContainer>
          </div>

          {/* LINHA: ESTUDANDO AGORA + RANKING */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <StudyingNowPanel session={studyingNow} />

            <CardContainer
              title="Ranking"
              subtitle={rankingMode === 'hours' ? 'Ordenado por horas' : 'Ordenado por acertos'}
              icon={Trophy}
              className="h-[380px]"
              action={
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setRankingMode('hours')}
                    className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wide border transition-all ${rankingMode === 'hours'
                      ? 'bg-red-600 text-white border-red-600'
                      : 'bg-zinc-100 dark:bg-zinc-900 text-zinc-500 border-zinc-200 dark:border-zinc-800 hover:text-zinc-800 dark:hover:text-zinc-200'
                      }`}
                  >
                    Horas
                  </button>
                  <button
                    onClick={() => setRankingMode('correct')}
                    className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wide border transition-all ${rankingMode === 'correct'
                      ? 'bg-red-600 text-white border-red-600'
                      : 'bg-zinc-100 dark:bg-zinc-900 text-zinc-500 border-zinc-200 dark:border-zinc-800 hover:text-zinc-800 dark:hover:text-zinc-200'
                      }`}
                  >
                    Acertos
                  </button>
                </div>
              }
            >
              <div className="overflow-y-auto h-full space-y-2 custom-scrollbar pr-1 pb-2">
                {(rankingMode === 'hours' ? dashboardData.topByHours : dashboardData.topByCorrect).map((u, i) => (
                  <motion.div
                    key={u.id}
                    whileHover={{ scale: 1.01 }}
                    className="flex items-center gap-3 p-3 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/60 dark:bg-zinc-900/30"
                  >
                    <div className={`font-black text-lg w-8 text-center ${i === 0 ? 'text-yellow-500 drop-shadow-md' : i === 1 ? 'text-zinc-400' : i === 2 ? 'text-amber-700' : 'text-zinc-300'}`}>
                      {i + 1}
                    </div>
                    <Avatar user={u} size="md" />
                    <p className="text-sm font-black text-zinc-900 dark:text-white truncate">
                      {u.name}
                    </p>
                    {/* IMPORTANTE: pedido do usuário = só foto + nome. Então NÃO exibimos métrica */}
                  </motion.div>
                ))}
              </div>

              <div className="mt-3 flex items-center justify-between text-[10px] text-zinc-500">
                <button onClick={() => setExpandedView('users')} className="font-bold text-red-600 hover:text-red-700 uppercase">
                  Ver base completa
                </button>
                <span className="opacity-70">Ordenação muda ao alternar</span>
              </div>
            </CardContainer>
          </div>

          {/* LINHA: FEED AO VIVO + USUÁRIOS COM TIMER */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <CardContainer
              title="Feed Ao Vivo"
              subtitle="Registros recentes detalhados"
              icon={Activity}
              isLive={true}
              className="h-[520px]"
              action={<button onClick={() => setExpandedView('studies')} className="p-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg text-zinc-400 transition-colors"><Maximize2 size={14} /></button>}
            >
              <div className="overflow-y-auto space-y-3 custom-scrollbar pr-1 h-full pb-4">
                <AnimatePresence>
                  {studyRecords.slice(0, 18).map(r => {
                    const user = getUser(r.uid);

                    const q = Number(r.questoesFeitas || 0);
                    const c = Number(r.acertos || 0);
                    const precision = q > 0 ? Math.round((c / q) * 100) : null;
                    const tempoMin = Number(r.tempoEstudadoMinutos || r.duracaoMinutos || 0);

                    const cicloLabel = r.cicloNome || (r.cicloId ? `Ciclo ${String(r.cicloId).slice(0, 6)}` : 'Ciclo');

                    return (
                      <motion.div
                        key={r.id}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="p-4 bg-zinc-50 dark:bg-zinc-900/40 rounded-2xl border border-zinc-100 dark:border-zinc-800/50 hover:border-zinc-300 dark:hover:border-zinc-700 transition-colors"
                      >
                        <div className="flex items-start gap-3">
                          <Avatar user={user} size="sm" />
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-black text-zinc-900 dark:text-white truncate">{user.name}</p>
                            <p className="text-[11px] font-bold text-zinc-700 dark:text-zinc-200 truncate">
                              {cicloLabel} • {r.disciplinaNome}
                            </p>
                            <p className="text-[10px] text-zinc-500 dark:text-zinc-400 truncate">
                              {r.assunto || 'Sem assunto'}
                            </p>

                            <div className="mt-2 flex flex-wrap gap-2">
                              <span className="text-[10px] font-black px-2 py-1 rounded-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
                                🧩 {q} questões
                              </span>
                              <span className="text-[10px] font-black px-2 py-1 rounded-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
                                🎯 {precision === null ? '-' : `${precision}%`}
                              </span>
                              <span className="text-[10px] font-black px-2 py-1 rounded-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
                                ⏱ {formatHMFromMinutes(tempoMin)}
                              </span>
                            </div>
                          </div>

                          <div className="text-right">
                            <span className="text-[10px] text-zinc-400">{formatTimeAgo(r.timestamp)}</span>
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
              </div>
            </CardContainer>

            <CardContainer
              title="Timers Ativos"
              subtitle="Usuários com timer aberto"
              icon={Timer}
              isLive={true}
              className="h-[520px]"
              footer={
                <div className="flex items-center justify-between text-[10px] text-zinc-500">
                  <span>{activeSessionsFresh.length} ativo(s) agora</span>
                  <span className="opacity-70">TTL 2min (evita fantasma)</span>
                </div>
              }
            >
              <div className="overflow-y-auto h-full space-y-3 custom-scrollbar pr-1 pb-4">
                {activeSessionsFresh.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-sm text-zinc-400">
                    Nenhum timer aberto agora.
                  </div>
                ) : (
                  activeSessionsFresh.map(s => (
                    <ActiveTimerRow key={s.id} s={s} />
                  ))
                )}
              </div>
            </CardContainer>
          </div>
        </>
      )}
    </div>
  );
}

export default AdminPage;
