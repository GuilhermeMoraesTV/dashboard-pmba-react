import React, { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { db } from '../../firebaseConfig';
import {
  collection, deleteDoc, doc, getDoc, getDocs, limit, orderBy, query, setDoc, Timestamp,
} from 'firebase/firestore';
import {
  Users, Activity, Server, Loader2, Search, Maximize2, Trash2, X, FileSpreadsheet,
  Clock, Zap, Trophy, ChevronRight, MoreHorizontal, Radio, UserPlus, CalendarDays,
  Flame, ShieldAlert, Send, FileText,
} from 'lucide-react';

import HeaderAdmin from './HeaderAdmin';
import EditaisManagerModal from './EditaisManager';
import AdminAnalyticsSection from './AdminAnalyticsSection';
import StudyingNowPanel from './LiveStudyMonitor';
import UserDetailModal from './UserDetailModal';
import ConfirmModal from '../../components/shared/ConfirmModal';
import { useForceUnlock } from '../../hooks/useForceUnlock';
import { useAdminAnalytics } from '../../hooks/useAdminAnalytics';
import {
  buildBroadcastDraftFromSegment,
  buildExecutivePdfPayload,
  buildSavedSegments,
  downloadUsersCsv,
  openExecutivePdfWindow,
} from './adminOperations';

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

const formatDelta = (value, suffix = '%') => {
  if (value == null || Number.isNaN(Number(value))) return null;
  const numeric = Math.round(Number(value));
  if (numeric === 0) return `0${suffix}`;
  return `${numeric > 0 ? '+' : ''}${numeric}${suffix}`;
};

const FILTER_PERIOD_OPTIONS = [
  { value: 30, label: '30d' },
  { value: 60, label: '60d' },
  { value: 90, label: '90d' },
];

const dateToYMD = (date = new Date()) => {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Bahia',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const get = (type) => parts.find((part) => part.type === type)?.value;
  return `${get('year')}-${get('month')}-${get('day')}`;
};

const AdminHealthPanel = () => {
  const [health, setHealth] = useState({
    loading: true,
    quotes: null,
    ai: [],
    activeTimers: 0,
    aiFailures: 0,
    cacheErrors: 0,
  });

  useEffect(() => {
    let alive = true;
    async function loadHealth() {
      try {
        const today = dateToYMD();
        const [quotesSnap, usageSnap, timersSnap, aiFailuresSnap, cacheErrorsSnap] = await Promise.all([
          getDoc(doc(db, 'system_config', 'quotes_automation')),
          getDocs(collection(db, 'system_ai_usage')),
          getDocs(collection(db, 'active_timers')),
          getDocs(query(collection(db, 'system_ai_failures'), orderBy('createdAt', 'desc'), limit(5))),
          getDocs(query(collection(db, 'system_cache_errors'), orderBy('createdAt', 'desc'), limit(5))),
        ]);

        if (!alive) return;
        setHealth({
          loading: false,
          quotes: quotesSnap.exists() ? quotesSnap.data() : null,
          ai: usageSnap.docs
            .filter((item) => item.id.startsWith(`${today}_`))
            .map((item) => ({ id: item.id, ...item.data() })),
          activeTimers: timersSnap.size,
          aiFailures: aiFailuresSnap.size,
          cacheErrors: cacheErrorsSnap.size,
        });
      } catch (error) {
        if (!alive) return;
        setHealth((current) => ({ ...current, loading: false, error: error?.message || 'Falha ao carregar saude do sistema.' }));
      }
    }
    loadHealth();
    return () => { alive = false; };
  }, []);

  const totalAiCalls = health.ai.reduce((sum, item) => sum + Number(item.calls || 0), 0);
  const totalAiTokens = health.ai.reduce((sum, item) => sum + Number(item.estimatedTokens || 0), 0);
  const quoteStatus = health.quotes?.status || 'sem status';
  const surfaceUsage = health.ai.reduce((summary, item) => {
    Object.entries(item.surfaces || {}).forEach(([surface, metrics]) => {
      summary[surface] = (summary[surface] || 0) + Number(metrics?.calls || 0);
    });
    return summary;
  }, {});
  const surfaceDetail = Object.entries(surfaceUsage)
    .sort((a, b) => b[1] - a[1])
    .map(([surface, calls]) => `${surface}: ${calls}`)
    .join(' · ') || 'Sem chamadas por superfície';

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-3">
      {[
        { label: 'Frases IA', value: health.loading ? '...' : quoteStatus, detail: health.quotes?.message || health.error || 'Automacao de frases' },
        { label: 'Chamadas IA hoje', value: health.loading ? '...' : totalAiCalls, detail: `${totalAiTokens.toLocaleString('pt-BR')} tokens · ${surfaceDetail}` },
        { label: 'Timers ativos', value: health.loading ? '...' : health.activeTimers, detail: 'Colecao active_timers' },
        { label: 'Falhas recentes de IA', value: health.loading ? '...' : health.aiFailures, detail: 'Últimos 5 registros operacionais' },
        { label: 'Erros cache/notícias', value: health.loading ? '...' : health.cacheErrors, detail: 'Últimos 5 registros operacionais' },
      ].map((item) => (
        <div key={item.label} className="rounded-3xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-zinc-400">{item.label}</p>
          <p className="mt-2 text-2xl font-black tracking-tight text-zinc-950 dark:text-white">{item.value}</p>
          <p className="mt-1 line-clamp-2 text-xs font-semibold text-zinc-500 dark:text-zinc-400">{item.detail}</p>
        </div>
      ))}
    </div>
  );
};

const FilterBar = ({ filters, options, onChange, onReset }) => (
  <div className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-[28px] p-4 shadow-sm">
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-6 gap-3">
      <label className="space-y-1">
        <span className="text-[10px] font-black uppercase tracking-[0.16em] text-zinc-400">Periodo</span>
        <select value={filters.windowDays} onChange={(e) => onChange('windowDays', Number(e.target.value))} className="w-full rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 px-3 py-2.5 text-sm font-semibold text-zinc-700 dark:text-zinc-200 outline-none">
          {FILTER_PERIOD_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
      </label>
      <label className="space-y-1">
        <span className="text-[10px] font-black uppercase tracking-[0.16em] text-zinc-400">Contexto</span>
        <select value={filters.contextType} onChange={(e) => onChange('contextType', e.target.value)} className="w-full rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 px-3 py-2.5 text-sm font-semibold text-zinc-700 dark:text-zinc-200 outline-none">
          <option value="all">Todos</option>
          <option value="ciclo">Ciclo</option>
          <option value="cronograma">Cronograma</option>
        </select>
      </label>
      <label className="space-y-1">
        <span className="text-[10px] font-black uppercase tracking-[0.16em] text-zinc-400">Perfil</span>
        <select value={filters.userProfile} onChange={(e) => onChange('userProfile', e.target.value)} className="w-full rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 px-3 py-2.5 text-sm font-semibold text-zinc-700 dark:text-zinc-200 outline-none">
          <option value="all">Todos</option>
          {(options.userProfiles || []).map((profile) => <option key={profile} value={profile}>{profile}</option>)}
        </select>
      </label>
      <label className="space-y-1">
        <span className="text-[10px] font-black uppercase tracking-[0.16em] text-zinc-400">Edital/Template</span>
        <select value={filters.templateId} onChange={(e) => onChange('templateId', e.target.value)} className="w-full rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 px-3 py-2.5 text-sm font-semibold text-zinc-700 dark:text-zinc-200 outline-none">
          <option value="all">Todos</option>
          {(options.templateIds || []).map((templateId) => <option key={templateId} value={templateId}>{templateId === 'manual' ? 'Manual' : templateId}</option>)}
        </select>
      </label>
      <label className="space-y-1">
        <span className="text-[10px] font-black uppercase tracking-[0.16em] text-zinc-400">Precisao</span>
        <select value={filters.accuracyBand} onChange={(e) => onChange('accuracyBand', e.target.value)} className="w-full rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 px-3 py-2.5 text-sm font-semibold text-zinc-700 dark:text-zinc-200 outline-none">
          <option value="all">Todas</option>
          {(options.accuracyBands || []).map((band) => <option key={band} value={band}>{band}</option>)}
        </select>
      </label>
      <div className="flex items-end">
        <button onClick={onReset} className="w-full rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 px-3 py-2.5 text-sm font-black uppercase tracking-[0.16em] text-zinc-500 hover:text-red-600 transition-colors">
          Limpar
        </button>
      </div>
    </div>
  </div>
);

const SegmentCard = ({
  segment,
  isActive,
  onOpen,
  onExport,
  onBroadcast,
}) => {
  const tones = {
    zinc: 'border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950',
    emerald: 'border-emerald-200 dark:border-emerald-900/40 bg-emerald-50/60 dark:bg-emerald-950/20',
    amber: 'border-amber-200 dark:border-amber-900/40 bg-amber-50/60 dark:bg-amber-950/20',
    red: 'border-red-200 dark:border-red-900/40 bg-red-50/70 dark:bg-red-950/20',
  };

  const accent = {
    zinc: 'text-zinc-500',
    emerald: 'text-emerald-600 dark:text-emerald-400',
    amber: 'text-amber-600 dark:text-amber-400',
    red: 'text-red-600 dark:text-red-400',
  };

  return (
    <div className={`rounded-[28px] border p-5 shadow-sm transition-all ${tones[segment.tone] || tones.zinc} ${isActive ? 'ring-2 ring-red-500/40' : ''}`}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className={`text-[10px] font-black uppercase tracking-[0.18em] ${accent[segment.tone] || accent.zinc}`}>Segmento salvo</p>
          <h3 className="text-lg font-black tracking-tight text-zinc-900 dark:text-white mt-1">{segment.label}</h3>
          <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 mt-2 leading-relaxed">{segment.description}</p>
        </div>
        <div className="text-right shrink-0">
          <p className="text-3xl font-black tracking-tight text-zinc-900 dark:text-white">{segment.count}</p>
          <p className="text-[10px] font-black uppercase tracking-[0.16em] text-zinc-400">usuarios</p>
        </div>
      </div>

      <div className="mt-4 rounded-2xl border border-white/60 dark:border-zinc-900 bg-white/70 dark:bg-black/10 px-3 py-3">
        <p className="text-[11px] font-semibold text-zinc-600 dark:text-zinc-300">{segment.subtitle}</p>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <button onClick={onOpen} className="px-3 py-2 rounded-xl bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 text-[11px] font-black uppercase tracking-[0.14em]">
          Abrir lista
        </button>
        <button onClick={onExport} className="px-3 py-2 rounded-xl border border-zinc-200 dark:border-zinc-800 text-[11px] font-black uppercase tracking-[0.14em] text-zinc-600 dark:text-zinc-300 hover:text-red-600 transition-colors">
          CSV
        </button>
        <button onClick={onBroadcast} className="px-3 py-2 rounded-xl border border-zinc-200 dark:border-zinc-800 text-[11px] font-black uppercase tracking-[0.14em] text-zinc-600 dark:text-zinc-300 hover:text-red-600 transition-colors">
          Broadcast
        </button>
      </div>
    </div>
  );
};

const Avatar = ({ user, size = 'md', className = '' }) => {
  const sizeClasses = { sm: 'w-8 h-8 text-[10px]', md: 'w-10 h-10 text-xs', lg: 'w-12 h-12 text-sm' };
  return (
    <div className={`${sizeClasses[size]} ${className} rounded-2xl flex-shrink-0 bg-gradient-to-br from-zinc-100 to-zinc-200 dark:from-zinc-800 dark:to-zinc-900 border border-white/50 dark:border-zinc-700 shadow-sm overflow-hidden flex items-center justify-center relative`}>
      {user?.photoURL ? <img src={user.photoURL} className="w-full h-full object-cover" alt="avatar" /> : <Users size={14} className="text-zinc-400" />}
    </div>
  );
};

const ExpandedModal = ({ isOpen, onClose, title, children }) => {
  useEffect(() => {
    document.body.style.overflow = isOpen ? 'hidden' : 'unset';
  }, [isOpen]);

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
          <button onClick={onClose} className="p-2 hover:bg-zinc-200 dark:hover:bg-zinc-800 rounded-full transition-colors">
            <X size={24} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-6 live-monitor-scroll bg-zinc-50/30 dark:bg-black/20">{children}</div>
      </motion.div>
    </div>
  );
};

const KpiCard = ({ title, value, subValue, icon: Icon, accent = 'zinc', trend, onClick, drilldownLabel, valueSuffix = '' }) => {
  const accents = {
    zinc: {
      iconWrap: 'bg-zinc-100 dark:bg-zinc-900 text-zinc-600 dark:text-zinc-300',
      border: 'before:bg-zinc-300/70 dark:before:bg-zinc-700',
      glow: 'bg-zinc-500/5',
      trend: 'bg-zinc-100 dark:bg-zinc-900/70 text-zinc-600 dark:text-zinc-300',
    },
    red: {
      iconWrap: 'bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400',
      border: 'before:bg-red-500',
      glow: 'bg-red-500/10',
      trend: 'bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400',
    },
    amber: {
      iconWrap: 'bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400',
      border: 'before:bg-amber-500',
      glow: 'bg-amber-500/10',
      trend: 'bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400',
    },
    emerald: {
      iconWrap: 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400',
      border: 'before:bg-emerald-500',
      glow: 'bg-emerald-500/10',
      trend: 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400',
    },
  }[accent] || {};

  const trendLabel = formatDelta(trend);

  return (
    <motion.button
      whileHover={{ y: -2 }}
      whileTap={{ scale: 0.995 }}
      onClick={onClick}
      className={`relative overflow-hidden bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-[28px] px-4 py-4 text-left flex flex-col justify-between shadow-sm group min-h-[122px] before:absolute before:left-0 before:top-4 before:bottom-4 before:w-[3px] before:rounded-full ${accents.border}`}
    >
      <div className="flex items-start justify-between gap-3 relative z-10">
        <div className="min-w-0">
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-zinc-400 mb-1">{title}</p>
          <div className="flex items-end gap-1">
            <h3 className="text-2xl lg:text-[28px] font-black tracking-tight text-zinc-900 dark:text-white leading-none">{value}</h3>
            {valueSuffix ? <span className="text-xs font-black text-zinc-400 pb-0.5">{valueSuffix}</span> : null}
          </div>
        </div>
        <div className={`p-2 rounded-2xl border border-white/60 dark:border-zinc-800 ${accents.iconWrap}`}>
          <Icon size={16} />
        </div>
      </div>

      <div className="relative z-10 mt-4 flex items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold text-zinc-500 dark:text-zinc-400 leading-snug">{subValue}</p>
          <p className="text-[10px] font-black uppercase tracking-[0.16em] text-zinc-300 dark:text-zinc-600 mt-1">{drilldownLabel}</p>
        </div>
        {trendLabel ? <span className={`shrink-0 px-2 py-1 rounded-lg text-[10px] font-black ${accents.trend}`}>{trendLabel}</span> : null}
      </div>

      <div className={`absolute top-0 right-0 w-20 h-20 rounded-full blur-2xl -mr-7 -mt-7 transition-opacity opacity-60 group-hover:opacity-100 ${accents.glow}`} />
    </motion.button>
  );
};

const BentoCard = ({ title, subtitle, icon: Icon, children, className = '', action, isLive = false, headerColor = 'text-zinc-900 dark:text-white' }) => (
  <div className={`bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-[32px] shadow-sm flex flex-col overflow-hidden relative group ${className}`}>
    <div className="flex-shrink-0 p-5 pb-3 flex items-center justify-between relative z-10 border-b border-zinc-50 dark:border-zinc-900/50 bg-white dark:bg-zinc-950">
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-xl border border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 text-zinc-500 relative shadow-sm">
          <Icon size={18} />
          {isLive && (
            <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500 border-2 border-white dark:border-zinc-950" />
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
    <div className="flex-1 min-h-0 overflow-hidden relative">{children}</div>
  </div>
);

function AdminPage() {
  useForceUnlock();

  const [expandedView, setExpandedView] = useState(null);
  const [showEditaisModal, setShowEditaisModal] = useState(false);
  const [detailUser, setDetailUser] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [rankingMetric, setRankingMetric] = useState('hours');
  const [rankingLimit] = useState(10);
  const [selectedFeedUid] = useState('all');
  const [selectedExecutiveMetric, setSelectedExecutiveMetric] = useState(null);
  const [userToDelete, setUserToDelete] = useState(null);
  const [segmentDrilldown, setSegmentDrilldown] = useState(null);
  const [activeSavedSegmentId, setActiveSavedSegmentId] = useState('filtered-base');
  const [broadcastDraft, setBroadcastDraft] = useState(null);
  const [adminFeedback, setAdminFeedback] = useState(null);
  const [globalFilters, setGlobalFilters] = useState({
    windowDays: 30,
    contextType: 'all',
    userProfile: 'all',
    templateId: 'all',
    accuracyBand: 'all',
  });

  const analyticsFilters = useMemo(() => {
    const now = Date.now();
    const from = new Date(now - (globalFilters.windowDays * 24 * 60 * 60 * 1000));
    return {
      createdFrom: from,
      recordFrom: from,
      windowDays: globalFilters.windowDays,
      contextType: globalFilters.contextType,
      userProfile: globalFilters.userProfile,
      templateId: globalFilters.templateId,
      accuracyBand: globalFilters.accuracyBand,
    };
  }, [globalFilters]);

  const {
    loading,
    users,
    studyRecords,
    cicloNameByKey,
    getUser,
    dashboardData,
    rankingList,
    feedList,
    studyingNowSessions,
    filterOptions,
  } = useAdminAnalytics({
    filters: analyticsFilters,
    rankingMetric,
    rankingLimit,
    selectedFeedUid,
  });

  const savedSegments = useMemo(
    () => buildSavedSegments({ dashboardData, filters: globalFilters }),
    [dashboardData, globalFilters],
  );

  const activeSavedSegment = useMemo(
    () => savedSegments.find((segment) => segment.id === activeSavedSegmentId) || savedSegments[0] || null,
    [activeSavedSegmentId, savedSegments],
  );

  const visibleExpandedUsers = useMemo(() => {
    const sourceRows = activeSavedSegment?.rows || dashboardData?.enrichedUsers || [];
    return sourceRows.filter((user) => user.name?.toLowerCase().includes(searchTerm.toLowerCase()));
  }, [activeSavedSegment, dashboardData, searchTerm]);

  const updateGlobalFilter = (key, value) => {
    setGlobalFilters((prev) => ({ ...prev, [key]: value }));
  };

  const resetGlobalFilters = () => {
    setGlobalFilters({
      windowDays: 30,
      contextType: 'all',
      userProfile: 'all',
      templateId: 'all',
      accuracyBand: 'all',
    });
  };

  const executiveMetricCards = useMemo(() => {
    const executive = dashboardData?.executive || {};

    return [
      {
        id: 'totalUsers',
        title: 'Usuarios Totais',
        value: executive.totalUsers?.value || 0,
        subValue: executive.totalUsers?.subtext || 'Base total',
        trend: executive.totalUsers?.delta,
        accent: 'zinc',
        icon: Users,
        drilldownLabel: 'Abrir base completa',
      },
      {
        id: 'newUsers7d',
        title: 'Novos 7d',
        value: executive.newUsers7d?.value || 0,
        subValue: executive.newUsers7d?.subtext || 'Entradas recentes',
        trend: executive.newUsers7d?.delta,
        accent: 'emerald',
        icon: UserPlus,
        drilldownLabel: 'Abrir cohort recente',
      },
      {
        id: 'dau',
        title: 'DAU',
        value: executive.dau?.value || 0,
        subValue: executive.dau?.subtext || 'Ativos do dia',
        trend: executive.dau?.delta,
        accent: 'red',
        icon: Radio,
        drilldownLabel: 'Abrir ativos 24h',
      },
      {
        id: 'wau',
        title: 'WAU',
        value: executive.wau?.value || 0,
        subValue: executive.wau?.subtext || 'Ativos da semana',
        trend: executive.wau?.delta,
        accent: 'amber',
        icon: CalendarDays,
        drilldownLabel: 'Abrir ativos 7d',
      },
      {
        id: 'mau',
        title: 'MAU',
        value: executive.mau?.value || 0,
        subValue: executive.mau?.subtext || 'Ativos do mes',
        trend: executive.mau?.delta,
        accent: 'zinc',
        icon: Activity,
        drilldownLabel: 'Abrir ativos 30d',
      },
      {
        id: 'stickiness',
        title: 'Stickiness',
        value: executive.stickiness?.value || 0,
        valueSuffix: '%',
        subValue: executive.stickiness?.subtext || 'DAU / MAU',
        trend: executive.stickiness?.delta,
        accent: 'red',
        icon: Flame,
        drilldownLabel: 'Abrir composicao',
      },
      {
        id: 'activation24h',
        title: 'Ativacao 24h',
        value: executive.activation24h?.value || 0,
        valueSuffix: '%',
        subValue: executive.activation24h?.subtext || 'Primeiro valor percebido',
        trend: executive.activation24h?.delta,
        accent: 'emerald',
        icon: Zap,
        drilldownLabel: 'Abrir cohort ativada',
      },
      {
        id: 'risk7d',
        title: 'Risco 7d',
        value: executive.risk7d?.value || 0,
        subValue: executive.risk7d?.subtext || 'Risco inicial',
        trend: executive.risk7d?.delta,
        accent: 'amber',
        icon: ShieldAlert,
        drilldownLabel: 'Abrir usuarios em risco',
      },
      {
        id: 'risk14d',
        title: 'Risco 14d',
        value: executive.risk14d?.value || 0,
        subValue: executive.risk14d?.subtext || 'Risco moderado',
        trend: executive.risk14d?.delta,
        accent: 'amber',
        icon: ShieldAlert,
        drilldownLabel: 'Abrir usuarios em risco',
      },
      {
        id: 'risk30d',
        title: 'Risco 30d',
        value: executive.risk30d?.value || 0,
        subValue: executive.risk30d?.subtext || 'Risco critico',
        trend: executive.risk30d?.delta,
        accent: 'red',
        icon: ShieldAlert,
        drilldownLabel: 'Abrir usuarios em risco',
      },
    ];
  }, [dashboardData]);

  const executiveDrilldown = useMemo(() => {
    if (!selectedExecutiveMetric) return null;

    const executive = dashboardData?.executive || {};
    const metric = executive[selectedExecutiveMetric];
    if (!metric) return null;

    const usersById = new Map((dashboardData.enrichedUsers || []).map((user) => [user.id, user]));
    const rows = (metric.userIds || []).map((uid) => usersById.get(uid)).filter(Boolean);

    const titles = {
      totalUsers: 'Base Completa',
      newUsers7d: 'Novos Usuarios nos Ultimos 7 Dias',
      dau: 'Usuarios Ativos nas Ultimas 24h',
      wau: 'Usuarios Ativos nos Ultimos 7 Dias',
      mau: 'Usuarios Ativos nos Ultimos 30 Dias',
      stickiness: 'Composicao DAU x MAU',
      activation24h: 'Usuarios Ativados em Ate 24h',
      risk7d: 'Usuarios em Risco 7d',
      risk14d: 'Usuarios em Risco 14d',
      risk30d: 'Usuarios em Risco 30d',
    };

    return {
      title: titles[selectedExecutiveMetric] || 'Drill-down Executivo',
      metric,
      rows,
    };
  }, [dashboardData, selectedExecutiveMetric]);

  const openDisciplineDrilldown = (segment) => {
    if (!segment?.disciplina) return;
    const rows = (studyRecords || []).filter((record) => (record.disciplinaNome || record.disciplina || 'Nao informado') === segment.disciplina);
    setSegmentDrilldown({
      title: `Disciplina: ${segment.disciplina}`,
      subtitle: `${segment.hours || 0}h e ${segment.questions || 0} questoes`,
      rows,
      kind: 'records',
    });
  };

  const openAccuracyDrilldown = (segment) => {
    if (!segment?.range) return;
    const rows = (studyRecords || []).filter((record) => {
      const questions = Number(record.questoesFeitas || 0);
      const correct = Number(record.acertos || 0);
      if (questions <= 0) return segment.range === 'Sem questoes';
      const accuracy = Math.round((correct / questions) * 100);
      if (segment.range === '0-20%') return accuracy <= 20;
      if (segment.range === '21-40%') return accuracy >= 21 && accuracy <= 40;
      if (segment.range === '41-60%') return accuracy >= 41 && accuracy <= 60;
      if (segment.range === '61-80%') return accuracy >= 61 && accuracy <= 80;
      return accuracy >= 81;
    });
    setSegmentDrilldown({
      title: `Precisao: ${segment.range}`,
      subtitle: `${segment.count || rows.length} registros`,
      rows,
      kind: 'records',
    });
  };

  const exportToCSV = (rows = visibleExpandedUsers, fileName = null) => {
    const segmentSlug = (activeSavedSegment?.label || 'base-filtrada').toLowerCase().replace(/\s+/g, '-');
    downloadUsersCsv(rows, fileName || `admin-${segmentSlug}.csv`);
  };

  const openSavedSegment = (segment) => {
    setActiveSavedSegmentId(segment.id);
    setExpandedView('users');
  };

  const prepareSegmentBroadcast = (segment) => {
    setActiveSavedSegmentId(segment.id);
    setBroadcastDraft({
      key: Date.now(),
      segment: buildBroadcastDraftFromSegment(segment),
    });
  };

  const openExecutivePdfExport = () => {
    const payload = buildExecutivePdfPayload({
      dashboardData,
      filters: globalFilters,
      segment: activeSavedSegment,
    });
    openExecutivePdfWindow(payload);
  };

  const handleDeleteUser = async (uid) => {
    setUserToDelete(uid);
  };

  const confirmDeleteUser = async () => {
    if (!userToDelete) return;
    await deleteDoc(doc(db, 'users', userToDelete));
    setUserToDelete(null);
  };

  const handleRecalculateAllUsersStats = async () => {
    try {
      const usersSnapshot = await getDocs(collection(db, 'users'));
      let processedCount = 0;

      for (const userDoc of usersSnapshot.docs) {
        const uid = userDoc.id;
        const studyQuery = query(collection(db, 'users', uid, 'registrosEstudo'));
        const studySnapshot = await getDocs(studyQuery);

        let totalMin = 0;
        let totalQ = 0;
        let totalC = 0;

        studySnapshot.forEach((studyDoc) => {
          const data = studyDoc.data();
          totalMin += Number(data.tempoEstudadoMinutos) || 0;
          totalQ += Number(data.questoesFeitas) || 0;
          totalC += Number(data.acertos) || 0;
        });

        await setDoc(doc(db, 'users', uid, 'stats', 'geral'), {
          totalHorasMinutos: totalMin,
          totalQuestoes: totalQ,
          totalAcertos: totalC,
          lastUpdated: Timestamp.now(),
        });

        processedCount += 1;
      }

      setAdminFeedback({ type: 'success', message: `${processedCount} usuários recalibrados com sucesso.` });
    } catch (error) {
      console.error('Erro fatal no recalculo:', error);
      setAdminFeedback({ type: 'error', message: 'Erro ao recalcular estatísticas. Veja o console.' });
    }
  };

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: `
        .live-monitor-scroll::-webkit-scrollbar { width: 8px; }
        .live-monitor-scroll::-webkit-scrollbar-track { background: transparent; }
        .live-monitor-scroll::-webkit-scrollbar-thumb { background: #a1a1aa; border-radius: 4px; }
        .live-monitor-scroll::-webkit-scrollbar-thumb:hover { background: #71717a; }
        .dark .live-monitor-scroll::-webkit-scrollbar-thumb { background: #3f3f46; }
        .dark .live-monitor-scroll::-webkit-scrollbar-thumb:hover { background: #52525b; }
      ` }}
      />
      {adminFeedback && (
        <div className={`fixed top-5 left-1/2 -translate-x-1/2 z-[320] px-4 py-3 rounded-xl text-sm font-bold text-white shadow-xl ${adminFeedback.type === 'success' ? 'bg-emerald-600' : 'bg-red-600'}`}>
          {adminFeedback.message}
          <button onClick={() => setAdminFeedback(null)} className="ml-3 opacity-80 hover:opacity-100">×</button>
        </div>
      )}

      <div className="w-full pb-20 animate-slide-up space-y-8 max-w-[1600px] mx-auto px-4 sm:px-6 pt-10">
        <AnimatePresence>
          {showEditaisModal && (
            <EditaisManagerModal
              isOpen={showEditaisModal}
              onClose={() => setShowEditaisModal(false)}
            />
          )}
        </AnimatePresence>

        <ExpandedModal
          isOpen={!!executiveDrilldown}
          onClose={() => setSelectedExecutiveMetric(null)}
          title={executiveDrilldown?.title || 'Drill-down Executivo'}
        >
          <div className="space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="rounded-3xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-5">
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-zinc-400 mb-2">Valor</p>
                <p className="text-3xl font-black tracking-tight text-zinc-900 dark:text-white">{executiveDrilldown?.metric?.value ?? 0}</p>
              </div>
              <div className="rounded-3xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-5">
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-zinc-400 mb-2">Variacao</p>
                <p className="text-3xl font-black tracking-tight text-zinc-900 dark:text-white">{formatDelta(executiveDrilldown?.metric?.delta) || '0%'}</p>
              </div>
              <div className="rounded-3xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-5">
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-zinc-400 mb-2">Contexto</p>
                <p className="text-sm font-semibold text-zinc-600 dark:text-zinc-300 leading-relaxed">
                  {executiveDrilldown?.metric?.subtext || 'Sem detalhe adicional para esta janela.'}
                </p>
              </div>
            </div>

            {executiveDrilldown?.rows?.length ? (
              <div className="grid grid-cols-1 gap-2">
                {executiveDrilldown.rows.map((user) => (
                  <button
                    key={user.id}
                    onClick={() => setDetailUser(user)}
                    className="w-full flex items-center gap-3 p-4 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 hover:border-red-200 dark:hover:border-red-900/30 transition-colors text-left"
                  >
                    <Avatar user={user} size="sm" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-zinc-900 dark:text-white truncate">{user.name}</p>
                      <p className="text-[11px] font-medium text-zinc-500 truncate">{user.email}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] font-black uppercase tracking-[0.16em] text-zinc-400">Ultimo estudo</p>
                      <p className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">{formatTimeAgo(user.lastStudy)}</p>
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <div className="rounded-3xl border border-dashed border-zinc-200 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-900/30 p-6">
                <p className="text-sm font-semibold text-zinc-600 dark:text-zinc-300">
                  Este KPI ja abre em modo executivo. A estrutura de drill-down esta pronta para aprofundar essa visao sem poluir o topo da pagina.
                </p>
              </div>
            )}
          </div>
        </ExpandedModal>

        <UserDetailModal isOpen={!!detailUser} onClose={() => setDetailUser(null)} user={detailUser} records={studyRecords} />
        <ConfirmModal
          isOpen={!!userToDelete}
          onClose={() => setUserToDelete(null)}
          onConfirm={confirmDeleteUser}
          title="Apagar usuario?"
          message="O documento principal do aluno sera removido. Confirme apenas se essa acao administrativa for realmente necessaria."
          confirmText="Apagar"
          isDestructive
        />

        <ExpandedModal isOpen={!!segmentDrilldown} onClose={() => setSegmentDrilldown(null)} title={segmentDrilldown?.title || 'Drill-down'}>
          <div className="space-y-5">
            <div className="rounded-3xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-5">
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-zinc-400 mb-2">Resumo</p>
              <p className="text-sm font-semibold text-zinc-600 dark:text-zinc-300">{segmentDrilldown?.subtitle || 'Sem resumo adicional.'}</p>
            </div>
            <div className="space-y-2">
              {(segmentDrilldown?.rows || []).map((record) => {
                const user = getUser(record.uid);
                return (
                  <button key={record.id} onClick={() => setDetailUser(user)} className="w-full text-left p-4 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 hover:border-red-200 dark:hover:border-red-900/30 transition-colors">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <Avatar user={user} size="sm" />
                        <div className="min-w-0">
                          <p className="text-sm font-bold text-zinc-900 dark:text-white truncate">{user.name}</p>
                          <p className="text-[11px] font-medium text-zinc-500 truncate">
                            {(record.disciplinaNome || record.disciplina || 'Geral')} • {record.assunto || 'Sem assunto'}
                          </p>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-[10px] font-black uppercase tracking-[0.16em] text-zinc-400">{formatTimeAgo(record.timestamp)}</p>
                        <p className="text-xs font-semibold text-zinc-600 dark:text-zinc-300">
                          {formatHMFromMinutes(record.tempoEstudadoMinutos || record.duracaoMinutos || 0)}
                          {Number(record.questoesFeitas || 0) > 0 ? ` • ${record.questoesFeitas}q` : ''}
                        </p>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </ExpandedModal>

        <ExpandedModal isOpen={!!expandedView} onClose={() => setExpandedView(null)} title={expandedView === 'users' ? 'Base de Alunos' : 'Feed Completo'}>
          <div className="space-y-6">
            <div className="flex justify-between items-center sticky top-0 bg-white dark:bg-zinc-950 z-20 py-2">
              <div className="flex items-center gap-3 bg-zinc-100 dark:bg-zinc-900 p-2.5 rounded-2xl w-96 border border-zinc-200 dark:border-zinc-800">
                <Search size={18} className="text-zinc-400" />
                <input className="bg-transparent outline-none w-full text-sm font-medium text-zinc-900 dark:text-white placeholder:text-zinc-500" placeholder="Buscar aluno..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
              </div>
              {expandedView === 'users' && (
                <button onClick={exportToCSV} className="flex items-center gap-2 px-5 py-2.5 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 rounded-xl font-bold text-xs hover:opacity-90 transition-opacity">
                  <FileSpreadsheet size={16} /> Exportar CSV
                </button>
              )}
            </div>

            {expandedView === 'users' && activeSavedSegment ? (
              <div className="rounded-3xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-900/30 p-4">
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-zinc-400 mb-1">Segmento atual</p>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-bold text-zinc-900 dark:text-white">{activeSavedSegment.label}</p>
                    <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">{activeSavedSegment.subtitle}</p>
                  </div>
                  <button onClick={() => prepareSegmentBroadcast(activeSavedSegment)} className="px-4 py-2 rounded-2xl border border-zinc-200 dark:border-zinc-800 text-[11px] font-black uppercase tracking-[0.16em] text-zinc-600 dark:text-zinc-300 hover:text-red-600 transition-colors">
                    Enviar para Broadcast
                  </button>
                </div>
              </div>
            ) : null}

            {expandedView === 'users' ? (
              <div className="grid grid-cols-1 gap-2">
                <div className="grid grid-cols-12 gap-4 px-4 py-2 bg-zinc-50 dark:bg-zinc-900/50 rounded-lg text-xs font-bold uppercase text-zinc-400 tracking-wider">
                  <div className="col-span-4">Aluno</div>
                  <div className="col-span-4">Email</div>
                  <div className="col-span-2 text-center">Horas</div>
                  <div className="col-span-2 text-right">Acao</div>
                </div>
                {visibleExpandedUsers.map((user) => (
                  <div key={user.id} className="grid grid-cols-12 gap-4 items-center p-3 rounded-2xl hover:bg-zinc-50 dark:hover:bg-zinc-900 border border-transparent hover:border-zinc-200 dark:hover:border-zinc-800 transition-all cursor-pointer group" onClick={() => setDetailUser(user)}>
                    <div className="col-span-4 flex items-center gap-3">
                      <Avatar user={user} size="sm" />
                      <span className="font-bold text-zinc-900 dark:text-white">{user.name}</span>
                    </div>
                    <div className="col-span-4 text-sm text-zinc-500">{user.email}</div>
                    <div className="col-span-2 text-center"><span className="px-2 py-1 rounded bg-zinc-100 dark:bg-zinc-800 font-bold text-xs text-zinc-700 dark:text-zinc-300">{user.totalHours}h</span></div>
                    <div className="col-span-2 text-right">
                      <button onClick={(e) => { e.stopPropagation(); handleDeleteUser(user.id); }} className="p-2 text-zinc-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg opacity-0 group-hover:opacity-100 transition-all">
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="space-y-2">
                {feedList.map((record) => (
                  <div key={record.id} className="p-4 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 flex justify-between items-center">
                    <div className="flex items-center gap-3">
                      <Avatar user={getUser(record.uid)} size="sm" />
                      <div>
                        <p className="font-bold text-sm text-zinc-900 dark:text-white">{getUser(record.uid).name}</p>
                        <p className="text-xs text-zinc-500">{record.disciplinaNome} • {record.assunto || 'Geral'}</p>
                      </div>
                    </div>
                    <span className="text-xs font-medium text-zinc-400">{formatTimeAgo(record.timestamp)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </ExpandedModal>

        <HeaderAdmin
          newUsersCount={dashboardData.newUsers24h}
          onRecalculateStats={handleRecalculateAllUsersStats}
          broadcastDraft={broadcastDraft}
        />

        {loading ? (
          <div className="flex flex-col items-center justify-center py-32 space-y-4">
            <Loader2 size={48} className="animate-spin text-red-600" />
            <p className="text-zinc-400 font-medium animate-pulse">Sincronizando QG...</p>
          </div>
        ) : (
          <div className="space-y-6">
            <FilterBar
              filters={globalFilters}
              options={filterOptions || {}}
              onChange={updateGlobalFilter}
              onReset={resetGlobalFilters}
            />

            <AdminHealthPanel />

            <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_320px] gap-6 items-start">
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {savedSegments.map((segment) => (
                  <SegmentCard
                    key={segment.id}
                    segment={segment}
                    isActive={activeSavedSegmentId === segment.id}
                    onOpen={() => openSavedSegment(segment)}
                    onExport={() => exportToCSV(segment.rows, `admin-${segment.id}.csv`)}
                    onBroadcast={() => prepareSegmentBroadcast(segment)}
                  />
                ))}
              </div>

              <div className="rounded-[28px] border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-5 shadow-sm">
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-zinc-400 mb-2">Exportacao executiva</p>
                <h3 className="text-xl font-black tracking-tight text-zinc-900 dark:text-white">PDF pronto para operacao</h3>
                <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400 mt-3 leading-relaxed">
                  Gera uma visao imprimivel do recorte atual com KPIs, filtros aplicados e top usuarios do segmento selecionado.
                </p>
                <div className="mt-4 rounded-2xl border border-red-100 dark:border-red-900/30 bg-red-50/70 dark:bg-red-950/20 p-4">
                  <p className="text-xs font-bold text-red-700 dark:text-red-300">{activeSavedSegment?.label || 'Base filtrada'}</p>
                  <p className="text-[11px] font-semibold text-red-600/80 dark:text-red-300/80 mt-1">{activeSavedSegment?.count || 0} usuarios na audiencia atual</p>
                </div>
                <div className="mt-4 flex flex-col gap-2">
                  <button onClick={openExecutivePdfExport} className="w-full flex items-center justify-center gap-2 rounded-2xl bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 px-4 py-3 text-sm font-black uppercase tracking-[0.16em]">
                    <FileText size={16} /> Abrir PDF Executivo
                  </button>
                  <button onClick={() => activeSavedSegment && prepareSegmentBroadcast(activeSavedSegment)} className="w-full flex items-center justify-center gap-2 rounded-2xl border border-zinc-200 dark:border-zinc-800 px-4 py-3 text-sm font-black uppercase tracking-[0.16em] text-zinc-600 dark:text-zinc-300 hover:text-red-600 transition-colors">
                    <Send size={16} /> Preparar Broadcast
                  </button>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-start">
              <div className="lg:col-span-3 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4">
                {executiveMetricCards.map((metric) => (
                  <KpiCard
                    key={metric.id}
                    accent={metric.accent}
                    icon={metric.icon}
                    title={metric.title}
                    value={metric.value}
                    valueSuffix={metric.valueSuffix}
                    subValue={metric.subValue}
                    trend={metric.trend}
                    drilldownLabel={metric.drilldownLabel}
                    onClick={() => setSelectedExecutiveMetric(metric.id)}
                  />
                ))}
              </div>

              <div onClick={() => setShowEditaisModal(true)} className="bg-zinc-900 text-white rounded-3xl p-6 flex flex-col justify-between cursor-pointer group shadow-xl shadow-zinc-900/20 hover:scale-[1.02] transition-all relative overflow-hidden h-full min-h-[260px]">
                <div className="relative z-10">
                  <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center mb-3 backdrop-blur-sm">
                    <Server size={20} className="text-red-500" />
                  </div>
                  <h3 className="text-xl font-black uppercase leading-tight">Gerenciar<br />Editais</h3>
                </div>
                <div className="relative z-10 flex justify-between items-end gap-4">
                  <p className="text-xs text-zinc-400 font-medium">Templates, seeds e operacao administrativa</p>
                  <ChevronRight className="opacity-50 group-hover:translate-x-1 transition-transform shrink-0" />
                </div>
                <div className="absolute top-0 right-0 w-32 h-32 bg-red-600/20 blur-3xl rounded-full -mr-10 -mt-10 pointer-events-none" />
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-auto lg:h-[600px]">
              <div className="h-full min-h-[600px] lg:min-h-0 flex flex-col">
                <StudyingNowPanel
                  sessions={studyingNowSessions}
                  getUser={getUser}
                  cicloNameByKey={cicloNameByKey}
                  onOpenUser={setDetailUser}
                />
              </div>

              <BentoCard
                title="Feed de Guerra"
                subtitle="Registro de atividades em tempo real"
                icon={Activity}
                className="h-full min-h-[600px] lg:min-h-0"
                isLive={true}
                action={(
                  <button onClick={() => setExpandedView('studies')} className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg text-zinc-400 transition-colors">
                    <Maximize2 size={16} />
                  </button>
                )}
              >
                <div className="h-full overflow-y-auto px-2 sm:px-5 py-4 live-monitor-scroll">
                  <div className="space-y-4 pb-4 relative">
                    <div className="absolute left-[19px] top-0 bottom-0 w-px bg-zinc-200 dark:bg-zinc-800 z-0" />
                    {feedList.map((record, index) => {
                      const user = getUser(record.uid);
                      return (
                        <div key={record.id} onClick={() => setDetailUser(user)} className="flex gap-4 group cursor-pointer pl-1 relative z-10">
                          <div className="mt-1 relative flex-shrink-0">
                            <div className={`w-9 h-9 rounded-full border-[3px] border-white dark:border-zinc-950 flex items-center justify-center z-10 relative ${index === 0 ? 'bg-red-500 shadow-lg shadow-red-500/30' : 'bg-zinc-200 dark:bg-zinc-800'}`}>
                              {index === 0 ? <Zap size={14} className="text-white fill-white" /> : <Clock size={14} className="text-zinc-500" />}
                            </div>
                          </div>
                          <div className="flex-1 bg-white dark:bg-zinc-900 p-3 rounded-2xl border border-zinc-100 dark:border-zinc-800 shadow-sm group-hover:border-red-200 dark:group-hover:border-red-900/30 transition-all">
                            <div className="flex justify-between items-start mb-1">
                              <div className="flex items-center gap-2">
                                <Avatar user={user} size="sm" className="w-5 h-5 rounded-md" />
                                <p className="text-xs font-bold text-zinc-900 dark:text-white truncate max-w-[100px]">{user.name}</p>
                              </div>
                              <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wide">{formatTimeAgo(record.timestamp)}</span>
                            </div>
                            <p className="text-xs font-medium text-zinc-600 dark:text-zinc-400 line-clamp-1 mt-1">
                              Estudou <span className="text-red-600 dark:text-red-400 font-bold">{record.disciplinaNome}</span>
                            </p>
                            <div className="flex items-center gap-2 mt-2">
                              <span className="text-[9px] font-black bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 rounded text-zinc-500">{formatHMFromMinutes(record.tempoEstudadoMinutos)}</span>
                              {record.questoesFeitas > 0 && <span className="text-[9px] font-black bg-emerald-50 dark:bg-emerald-900/20 px-2 py-0.5 rounded text-emerald-600">{record.questoesFeitas}q</span>}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </BentoCard>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <BentoCard
                title="Novos Alunos"
                icon={Users}
                className="h-[500px]"
                action={<button onClick={() => openSavedSegment(savedSegments[0] || { id: 'filtered-base' })} className="text-zinc-400 hover:text-red-500"><MoreHorizontal size={20} /></button>}
              >
                <div className="h-full overflow-y-auto px-2 sm:px-5 py-4 live-monitor-scroll">
                  <div className="space-y-2 pb-4">
                    {users.slice(0, 15).map((user) => (
                      <div key={user.id} onClick={() => setDetailUser(user)} className="flex items-center gap-3 p-3 rounded-2xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 hover:border-red-200 cursor-pointer transition-colors group">
                        <Avatar user={user} size="md" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold text-zinc-900 dark:text-white truncate group-hover:text-red-600 transition-colors">{user.name}</p>
                          <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wide">{formatTimeAgo(user.createdAt)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </BentoCard>

              <div className="lg:col-span-2">
                <BentoCard
                  title="Ranking Global"
                  subtitle="Melhores desempenhos da plataforma"
                  icon={Trophy}
                  className="h-[500px]"
                  action={(
                    <div className="flex gap-2 p-1 bg-zinc-100 dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800">
                      <button onClick={() => setRankingMetric('hours')} className={`px-3 py-1.5 text-[10px] font-black uppercase rounded-lg transition-all ${rankingMetric === 'hours' ? 'bg-white dark:bg-zinc-800 shadow text-red-600' : 'text-zinc-400 hover:text-zinc-600'}`}>Horas</button>
                      <button onClick={() => setRankingMetric('questions')} className={`px-3 py-1.5 text-[10px] font-black uppercase rounded-lg transition-all ${rankingMetric === 'questions' ? 'bg-white dark:bg-zinc-800 shadow text-red-600' : 'text-zinc-400 hover:text-zinc-600'}`}>Questoes</button>
                    </div>
                  )}
                >
                  <div className="h-full overflow-y-auto px-2 sm:px-5 py-4 live-monitor-scroll">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pb-4">
                      {rankingList.map((user, index) => (
                        <div key={user.id} onClick={() => setDetailUser(user)} className="flex items-center gap-4 p-4 rounded-3xl bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-100 dark:border-zinc-800 cursor-pointer hover:border-red-200 dark:hover:border-red-900/50 hover:bg-white dark:hover:bg-zinc-900 transition-all group">
                          <div className={`w-8 h-8 rounded-xl flex items-center justify-center font-black text-sm flex-shrink-0 ${index < 3 ? 'bg-gradient-to-br from-yellow-400 to-orange-500 text-white shadow-lg shadow-orange-500/20' : 'bg-zinc-200 dark:bg-zinc-800 text-zinc-500'}`}>
                            {index + 1}
                          </div>
                          <Avatar user={user} />
                          <div className="flex-1 min-w-0">
                            <p className="font-bold text-sm text-zinc-900 dark:text-white truncate group-hover:text-red-600 transition-colors">{user.name}</p>
                            <div className="flex gap-3 text-[10px] font-bold text-zinc-400 mt-0.5 uppercase tracking-wide">
                              <span className={rankingMetric === 'hours' ? 'text-zinc-800 dark:text-zinc-200' : ''}>{user.totalHours}h Estudo</span>
                              <span className={rankingMetric === 'questions' ? 'text-zinc-800 dark:text-zinc-200' : ''}>{user.totalQuestions} Questoes</span>
                            </div>
                          </div>
                          {index < 3 && <Trophy size={16} className="text-yellow-500 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />}
                        </div>
                      ))}
                    </div>
                  </div>
                </BentoCard>
              </div>
            </div>

            <AdminAnalyticsSection
              datasets={dashboardData.datasets}
              onDisciplineSelect={openDisciplineDrilldown}
              onAccuracySelect={openAccuracyDrilldown}
            />
          </div>
        )}
      </div>
    </>
  );
}

export default AdminPage;
