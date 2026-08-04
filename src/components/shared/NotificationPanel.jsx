import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Bell, X, RefreshCw, Megaphone, Zap, AlertTriangle,
  Check, Plus, Minus, ChevronDown,
  BookOpen, Shield, ArrowUpCircle, Clock,
  CheckCheck, Inbox, Eye, Layers, Sparkles, Rocket,
  ExternalLink, ChevronRight, Info, History, Trash2,
  ChevronLeft, Target, CalendarDays, TrendingUp, Flame
} from 'lucide-react';

// =======================================================
// 🎨 ESTILOS GLOBAIS COMPACTOS E PREMIUM - FIRE THEME
// =======================================================
const notifGlobalStyles = `
  .notif-scrollbar::-webkit-scrollbar { width: 4px; height: 4px; }
  .notif-scrollbar::-webkit-scrollbar-track { background: transparent; }
  .notif-scrollbar::-webkit-scrollbar-thumb { background: linear-gradient(to bottom, #dc2626, #ef4444); border-radius: 10px; }
  
  .glass-panel-fire {
    background: rgba(255, 255, 255, 0.96);
    backdrop-filter: blur(8px);
    border: 1px solid rgba(239, 68, 68, 0.12);
  }
  .dark .glass-panel-fire {
    background: rgba(15, 15, 18, 0.97);
    backdrop-filter: blur(8px);
    border: 1px solid rgba(239, 68, 68, 0.18);
  }

  @keyframes fire-glow {
    0% { box-shadow: 0 0 5px rgba(239, 68, 68, 0.2); }
    50% { box-shadow: 0 0 15px rgba(239, 68, 68, 0.4); }
    100% { box-shadow: 0 0 5px rgba(239, 68, 68, 0.2); }
  }
  .animate-fire-glow { animation: fire-glow 3s ease-in-out infinite; }

  @keyframes float {
    0% { transform: translateY(0px); }
    50% { transform: translateY(-3px); }
    100% { transform: translateY(0px); }
  }
  .animate-float { animation: float 3s ease-in-out infinite; }
`;

// Helpers
const formatTimeAgo = (date) => {
  if (!date) return '';
  const d = date instanceof Date ? date : new Date(date);
  if (isNaN(d.getTime())) return '';
  const diff = Math.floor((Date.now() - d.getTime()) / 60000);
  if (diff < 1) return 'Agora';
  if (diff < 60) return `${diff}m atrás`;
  const h = Math.floor(diff / 60);
  if (h < 24) return `${h}h atrás`;
  const days = Math.floor(h / 24);
  if (days < 30) return `${days}d atrás`;
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
};

const formatDate = (date) => {
  if (!date) return '';
  const d = date instanceof Date ? date : new Date(date);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
};

const toMillisSafe = (value) => {
  if (!value) return null;
  if (typeof value.toDate === 'function') return value.toDate().getTime();
  const millis = new Date(value).getTime();
  return Number.isNaN(millis) ? null : millis;
};

const BROADCAST_CONFIG = {
  comunicado: { icon: Megaphone, label: 'Comunicado', accent: 'text-zinc-600 dark:text-zinc-400', bg: 'bg-zinc-100 dark:bg-zinc-800/80', strip: 'bg-zinc-400 dark:bg-zinc-600' },
  atualizacao: { icon: Rocket, label: 'Atualização', accent: 'text-red-600 dark:text-red-400', bg: 'bg-red-50 dark:bg-red-950/30', strip: 'bg-red-500' },
  aviso: { icon: AlertTriangle, label: 'Atenção', accent: 'text-red-600 dark:text-red-400', bg: 'bg-red-50 dark:bg-red-950/30', strip: 'bg-red-500' },
  urgente: { icon: Flame, label: 'URGENTE', accent: 'text-red-600 dark:text-red-500', bg: 'bg-red-100 dark:bg-red-900/40', strip: 'bg-gradient-to-b from-red-700 to-red-500' },
};

const UPDATE_TYPE_CONFIG = {
  LANCAMENTO: {
    label: 'Novo Lançamento!', shortLabel: 'Lançamento', color: 'from-red-500 to-red-700',
    icon: Flame, textColor: 'text-red-700 dark:text-red-400',
    bgLight: 'bg-red-50 dark:bg-red-900/20', borderColor: 'border-red-200 dark:border-red-800/50',
    stripColor: 'bg-gradient-to-r from-red-500 to-red-700', badgeBg: 'bg-red-100 dark:bg-red-900/40', badgeText: 'text-red-800 dark:text-red-300',
  },
  RETIFICACAO: {
    label: 'Retificação Oficial', shortLabel: 'Retificação', color: 'from-red-500 to-red-700',
    icon: AlertTriangle, textColor: 'text-red-700 dark:text-red-400',
    bgLight: 'bg-red-900/10 dark:bg-red-900/20', borderColor: 'border-red-200 dark:border-red-800/50',
    stripColor: 'bg-red-500', badgeBg: 'bg-red-100 dark:bg-red-900/40', badgeText: 'text-red-800 dark:text-red-300',
  },
  AJUSTE_INTERNO: {
    label: 'Conteúdo Atualizado', shortLabel: 'Atualizado', color: 'from-zinc-700 to-zinc-900',
    icon: RefreshCw, textColor: 'text-zinc-700 dark:text-zinc-400',
    bgLight: 'bg-zinc-50 dark:bg-zinc-900/20', borderColor: 'border-zinc-200 dark:border-zinc-800/50',
    stripColor: 'bg-zinc-500', badgeBg: 'bg-zinc-100 dark:bg-zinc-900/40', badgeText: 'text-zinc-800 dark:text-zinc-300',
  },
};

const getPreviewTheme = (type) => {
    const fireThemeBase = {
        bgClass: 'bg-gradient-to-br from-red-600/10 to-red-500/10 dark:from-red-950/40 dark:to-red-950/20 border-r border-red-500/10',
        titleColor: 'text-red-700 dark:text-red-400',
        iconColor: 'text-red-600 dark:text-red-500',
        barColor: 'bg-gradient-to-r from-red-700 to-red-500',
        button: 'bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white shadow-xl shadow-red-600/20'
    };
    const styles = {
        atualizacao: { ...fireThemeBase, title: 'ATUALIZAÇÃO', icon: Rocket },
        urgente:     { ...fireThemeBase, title: 'FOGO NO PARQUINHO!', icon: Flame },
        aviso:       { ...fireThemeBase, title: 'ATENÇÃO',     icon: AlertTriangle },
        comunicado:  { ...fireThemeBase, title: 'COMUNICADO',  icon: Megaphone }
    };
    return styles[type] || styles.comunicado;
};

// ─── System Alert Card ───────────────────────────────────────────────
const SYSTEM_ALERT_CONFIG = {
  falta_estudo: {
    icon: Target,
    label: 'Estudo Pendente',
    iconColor: 'text-red-600 dark:text-red-400',
    iconBg: 'bg-red-50 dark:bg-red-950/40',
    borderColor: 'border-l-red-500',
    actionColor: 'bg-gradient-to-r from-red-600 to-red-700 text-white hover:brightness-110',
  },
  revisoes_pendentes: {
    icon: CalendarDays,
    label: 'Revisões Pendentes',
    iconColor: 'text-blue-600 dark:text-blue-400',
    iconBg: 'bg-blue-50 dark:bg-blue-950/40',
    borderColor: 'border-l-blue-500',
    actionColor: 'bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 hover:opacity-90',
  },
  ciclo_finalizacao: {
    icon: ArrowUpCircle,
    label: 'Ciclo Fechado',
    iconColor: 'text-emerald-600 dark:text-emerald-400',
    iconBg: 'bg-emerald-50 dark:bg-emerald-950/40',
    borderColor: 'border-l-emerald-500',
    actionColor: 'bg-gradient-to-r from-emerald-600 to-emerald-700 text-white hover:brightness-110',
  },
  ciclo_legacy_upgrade: {
    icon: Sparkles,
    label: 'Novo Guia',
    iconColor: 'text-red-600 dark:text-red-400',
    iconBg: 'bg-red-50 dark:bg-red-950/40',
    borderColor: 'border-l-red-500',
    actionColor: 'bg-gradient-to-r from-red-600 to-red-700 text-white hover:brightness-110',
  },
};

export const SystemAlertCard = ({ alert, onAction }) => {
  const cfg = SYSTEM_ALERT_CONFIG[alert.type] || SYSTEM_ALERT_CONFIG.falta_estudo;
  const Icon = cfg.icon;

  return (
    <motion.div
      whileHover={{ scale: 1.02 }}
      className={`group relative flex items-start gap-2.5 p-3 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 ${cfg.borderColor} border-l-[3px] shadow-sm hover:shadow-md transition-all overflow-hidden`}
      role="alert"
    >
      <div className="absolute top-0 right-0 w-16 h-16 bg-gradient-to-br from-transparent to-red-500/5 dark:to-red-500/10 rounded-full translate-x-8 -translate-y-8 pointer-events-none" />
      
      <div className={`shrink-0 w-8 h-8 rounded-lg ${cfg.iconBg} flex items-center justify-center shadow-inner`}>
        <Icon size={14} className={cfg.iconColor} />
      </div>
      <div className="flex-1 min-w-0 relative z-10">
        <div className="flex items-center justify-between gap-1.5">
          <p className="text-[10px] font-black text-zinc-900 dark:text-zinc-100 leading-tight uppercase tracking-wider">{alert.title}</p>
          <div className="flex h-1 w-1 rounded-full bg-red-500 animate-pulse" />
        </div>
        <p className="text-[9px] text-zinc-500 dark:text-zinc-400 mt-1 leading-tight font-semibold line-clamp-2">{alert.message}</p>
        <button
          onClick={(e) => { e.stopPropagation(); onAction(alert); }}
          className={`mt-2.5 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[8px] font-black uppercase tracking-wider transition-all active:scale-95 shadow-md ${cfg.actionColor}`}
        >
          {alert.actionLabel}
          <ChevronRight size={9} strokeWidth={3} />
        </button>
      </div>
    </motion.div>
  );
};

// Broadcast Modal
const BroadcastModal = ({ notif, onClose }) => {
  const [imgIdx, setImgIdx] = useState(0);

  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Escape') { e.stopPropagation(); onClose(); }
  }, [onClose]);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  if (!notif) return null;

  const images = notif.imageUrls || (notif.imageUrl ? [notif.imageUrl] : []);
  const theme = getPreviewTheme(notif.category);
  const Icon = theme.icon;
  const isLongText = notif.message && notif.message.length > 120;

  return createPortal(
    <AnimatePresence>
        <div className="notif-modal-portal fixed inset-0 z-[9999] flex items-center justify-center p-3">
            <motion.div
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="absolute inset-0 bg-zinc-950/80 backdrop-blur-md transition-all cursor-default"
                onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
            />

            {images.length > 0 ? (
                <div className="relative z-10 flex flex-col md:flex-row items-center gap-2 md:gap-3 w-full max-w-6xl justify-center h-full pointer-events-none">
                    {images.length > 1 && (
                        <button onClick={(e) => { e.stopPropagation(); setImgIdx((prev) => (prev === 0 ? images.length - 1 : prev - 1)); }} className="hidden md:flex pointer-events-auto p-2 bg-white/10 hover:bg-red-600 text-white rounded-full backdrop-blur-xl transition-all border border-white/20 hover:scale-110 shadow-2xl shrink-0">
                            <ChevronLeft size={24} strokeWidth={2.5} />
                        </button>
                    )}
                    <motion.div
                        initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
                        transition={{ type: "spring", duration: 0.5 }}
                        className="relative pointer-events-auto flex flex-col items-center"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <button onClick={onClose} className="absolute -top-3 -right-3 p-2 bg-white dark:bg-zinc-800 text-zinc-900 dark:white hover:text-red-600 rounded-full transition-all z-50 shadow-xl border border-zinc-200 dark:border-zinc-700">
                            <X size={16} strokeWidth={3} />
                        </button>

                        <div className="relative flex items-center justify-center min-h-[40vh] md:min-h-[50vh] min-w-[280px] w-auto">
                            <motion.img
                                key={imgIdx}
                                src={images[imgIdx]}
                                alt={`Slide ${imgIdx}`}
                                initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.4 }}
                                className="relative z-10 w-auto h-auto max-w-[90vw] md:max-w-[80vw] max-h-[70vh] md:max-h-[80vh] object-contain block rounded-2xl overflow-hidden shadow-[0_24px_48px_-12px_rgba(0,0,0,0.5)] border border-white/10"
                            />
                            {images.length > 1 && (
                                <div className="absolute -bottom-6 left-0 w-full hidden md:flex justify-center gap-2 z-20 pointer-events-none">
                                    {images.map((_, idx) => (
                                        <div key={idx} className={`h-1.5 rounded-full transition-all shadow-md ${idx === imgIdx ? 'bg-red-500 w-8' : 'bg-white/30 w-1.5'}`} />
                                    ))}
                                </div>
                            )}
                        </div>
                    </motion.div>

                    {images.length > 1 && (
                        <button onClick={(e) => { e.stopPropagation(); setImgIdx((prev) => (prev + 1) % images.length); }} className="hidden md:flex pointer-events-auto p-2 bg-white/10 hover:bg-red-600 text-white rounded-full backdrop-blur-xl transition-all border border-white/20 hover:scale-110 shadow-2xl shrink-0">
                            <ChevronRight size={24} strokeWidth={2.5} />
                        </button>
                    )}
                </div>
            ) : (
                <motion.div
                    initial={{ scale: 0.9, opacity: 0, y: 20 }}
                    animate={{ scale: 1, opacity: 1, y: 0 }}
                    exit={{ scale: 0.9, opacity: 0, y: 20 }}
                    transition={{ type: "spring", duration: 0.5, bounce: 0.3 }}
                    className={`
                        relative w-full overflow-hidden bg-white dark:bg-zinc-950
                        rounded-[24px] shadow-[0_32px_64px_-12px_rgba(0,0,0,0.5)] border border-zinc-200 dark:border-zinc-800
                        flex flex-col md:flex-row
                        max-h-[80vh] md:max-h-auto
                        ${isLongText ? 'max-w-4xl' : 'max-w-[320px] md:max-w-2xl'}
                    `}
                    onClick={(e) => e.stopPropagation()}
                >
                    <div className={`relative overflow-hidden flex flex-col items-center justify-center shrink-0 w-full md:w-5/12 py-6 md:py-0 md:min-h-[260px] ${theme.bgClass}`}>
                        <div className="absolute inset-0 flex items-center justify-center opacity-[0.05] pointer-events-none">
                            <img src="/logoModoQAP.png" alt="Watermark" className="w-[120%] h-[120%] object-contain scale-125 grayscale dark:invert" />
                        </div>
                        <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", delay: 0.2 }} className="relative z-10 w-16 h-16 md:w-20 md:h-20 bg-white dark:bg-zinc-900 backdrop-blur-xl rounded-[20px] border border-white/50 dark:border-zinc-700/50 flex items-center justify-center shadow-xl mb-3 md:mb-4">
                            <Icon size={30} className={`${theme.iconColor} md:w-10 md:h-10`} strokeWidth={1.5} />
                        </motion.div>
                        <div className="relative z-10 text-center px-4">
                            <h2 className={`text-base md:text-xl font-black ${theme.titleColor} uppercase tracking-widest drop-shadow-sm leading-tight`}>{theme.title}</h2>
                            <div className={`h-1 w-8 ${theme.barColor} mx-auto mt-3 rounded-full shadow-md`}></div>
                        </div>
                    </div>

                    <div className="flex flex-col relative bg-white dark:bg-zinc-950 overflow-hidden w-full md:w-7/12">
                        <button onClick={onClose} className="absolute top-4 right-4 p-1.5 text-zinc-400 hover:text-red-600 bg-zinc-100 dark:bg-zinc-900 rounded-xl transition-all z-20 shadow-sm">
                            <X size={16} strokeWidth={3} />
                        </button>
                        <div className="flex-1 p-5 md:p-6 overflow-y-auto notif-scrollbar">
                            <div className="flex items-center gap-2.5 mb-4 shrink-0">
                                <div className={`w-1 h-5 rounded-full ${theme.barColor}`}></div>
                                <h3 className={`text-[10px] md:text-xs font-black ${theme.titleColor} uppercase tracking-wider`}>{theme.title}</h3>
                            </div>
                            <div className="prose prose-zinc dark:prose-invert max-w-none">
                                <p className="text-xs md:text-sm font-bold text-zinc-800 dark:text-zinc-200 whitespace-pre-wrap leading-relaxed">{notif.message}</p>
                            </div>
                        </div>
                        <div className="p-5 md:p-6 pt-2 mt-auto border-t border-zinc-100 dark:border-zinc-800/60 bg-zinc-50/50 dark:bg-zinc-900/50 shrink-0 flex flex-col items-center justify-center">
                            <button onClick={onClose} className={`w-full max-w-[200px] px-6 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all transform active:scale-95 flex items-center justify-center gap-2 mb-4 shadow-xl ${theme.button}`}>
                                <CheckCheck size={16} strokeWidth={3} /> Entendido
                            </button>
                            <div className="flex items-center justify-center gap-2.5 opacity-30">
                                <img src="/logoModoQAP.png" alt="Logo" className="h-3.5 grayscale dark:invert" />
                                <div className="h-2.5 w-px bg-zinc-400"></div>
                                <span className="text-red-600 dark:text-red-500 font-black tracking-widest uppercase text-[9px]">MODOQAP</span>
                            </div>
                        </div>
                    </div>
                </motion.div>
            )}
        </div>
    </AnimatePresence>,
    document.body
  );
};

const DiffSection = ({ label, count, variant, children, defaultOpen = false }) => {
  const [open, setOpen] = useState(defaultOpen);
  const isAdd = variant === 'add';
  return (
    <div className={`rounded-[20px] border overflow-hidden transition-all duration-300 ${isAdd ? 'border-emerald-200 dark:border-emerald-900/40 bg-emerald-50/30 dark:bg-emerald-900/5 hover:border-emerald-300' : 'border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/30 hover:border-zinc-300'}`}>
      <button onClick={() => setOpen((v) => !v)}
        className={`w-full flex items-center justify-between px-4 py-3 text-left transition-colors ${isAdd ? 'hover:bg-emerald-50 dark:hover:bg-emerald-900/20' : 'hover:bg-zinc-100 dark:hover:bg-zinc-800/60'}`}
      >
        <div className="flex items-center gap-3">
          <div className={`w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0 shadow-sm ${isAdd ? 'bg-emerald-500 text-white' : 'bg-zinc-400 dark:bg-zinc-700 text-white'}`}>
            {isAdd ? <Plus size={12} strokeWidth={3} /> : <Minus size={12} strokeWidth={3} />}
          </div>
          <span className={`text-[11px] font-black uppercase tracking-wider ${isAdd ? 'text-emerald-700 dark:text-emerald-400' : 'text-zinc-600 dark:text-zinc-400'}`}>{label}</span>
          <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${isAdd ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-300' : 'bg-zinc-200 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300'}`}>{count}</span>
        </div>
        <motion.div animate={{ rotate: open ? 180 : 0 }} transition={{ duration: 0.3 }}>
          <ChevronDown size={14} className="text-zinc-400" />
        </motion.div>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
            <div className="bg-white/40 dark:bg-zinc-950/40 divide-y divide-zinc-100 dark:divide-zinc-800/50 border-t border-zinc-100 dark:border-zinc-800/50">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export const EditalUpdateModal = ({ notif, onClose, onApply, onDismiss, loading, onNavigateToEdital }) => {
  const [applying, setApplying] = useState(false);
  if (!notif) return null;
  const { diff, cicloNome, cicloLogo, templateData, timestamp, isDismissed, ciclosAfetadosCount, ciclosAfetados } = notif;
  const updateMetadata = templateData?.updateMetadata || null;
  const typeKey = updateMetadata?.tipo || 'AJUSTE_INTERNO';
  const typeCfg = UPDATE_TYPE_CONFIG[typeKey] || UPDATE_TYPE_CONFIG.AJUSTE_INTERNO;
  const TypeIcon = typeCfg.icon;

  const totalAdd = (diff?.novasDisciplinas?.length || 0) + (diff?.disciplinasComNovosAssuntos?.reduce((a, d) => a + d.novosAssuntos.length, 0) || 0);
  const totalRem = (diff?.disciplinasRemovidas?.length || 0) + (diff?.disciplinasComAssuntosRemovidos?.reduce((a, d) => a + d.assuntosRemovidos.length, 0) || 0);

  const handleApply = async () => {
    setApplying(true);
    await onApply(notif);
    setApplying(false);
    onClose();
  };

  return createPortal(
    <AnimatePresence>
      <motion.div
        key="edital-modal-backdrop"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="notif-modal-portal fixed inset-0 z-[9999] flex items-center justify-center p-2.5 sm:p-4 bg-zinc-950/80 backdrop-blur-md"
        onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0, y: 15 }} animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.95, opacity: 0, y: 15 }} transition={{ type: 'spring', duration: 0.4, bounce: 0.2 }}
          onMouseDown={(e) => e.stopPropagation()}
          className="bg-white dark:bg-zinc-950 w-full max-w-[320px] sm:max-w-sm rounded-[20px] shadow-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden flex flex-col"
          style={{ maxHeight: 'min(90vh, 600px)' }}
        >
          <div className={`relative bg-gradient-to-br ${typeCfg.color} px-4 py-4 flex-shrink-0`}>
            <button onClick={onClose} className="absolute top-3 right-3 p-1 rounded-full bg-white/20 hover:bg-white/40 text-white transition-colors">
              <X size={12} strokeWidth={2.5} />
            </button>
            <div className="flex items-center gap-3 pr-4">
              <div className="w-10 h-10 rounded-lg bg-white shadow-lg flex items-center justify-center flex-shrink-0 overflow-hidden border border-white/40">
                {cicloLogo ? <img src={cicloLogo} alt="" className="w-7 h-7 object-contain" /> : <BookOpen size={20} className="text-zinc-300" />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-white/20 text-white text-[8px] font-black uppercase tracking-wider rounded-full border border-white/20 backdrop-blur-sm">
                    <TypeIcon size={8} /> {typeCfg.shortLabel}
                  </span>
                  {timestamp && <span className="text-white/80 text-[8px] font-bold bg-black/10 px-1.5 rounded-full">{formatDate(timestamp)}</span>}
                </div>
                <h2 className="text-white font-black text-base leading-tight truncate drop-shadow-sm">{cicloNome}</h2>
                {ciclosAfetadosCount > 1 && (
                  <p className="mt-0.5 text-[9px] font-black uppercase tracking-wider text-white/80">
                    {ciclosAfetadosCount} ciclos afetados
                  </p>
                )}
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto notif-scrollbar bg-zinc-50/50 dark:bg-zinc-950">
            {updateMetadata?.mensagem ? (
              <div className={`mx-3 mt-3 rounded-lg ${typeCfg.bgLight} border ${typeCfg.borderColor} p-2.5 shadow-sm`}>
                <div className="flex items-start gap-2">
                  <Sparkles size={12} className={`${typeCfg.textColor} flex-shrink-0 mt-0.5 animate-pulse`} />
                  <div>
                    <p className={`text-[8px] font-black uppercase tracking-wider mb-1 ${typeCfg.textColor}`}>Nota Oficial</p>
                    <p className="text-[11px] text-zinc-700 dark:text-zinc-300 leading-tight font-semibold">{updateMetadata.mensagem}</p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="mx-3 mt-3 rounded-lg bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-2.5 shadow-sm">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-lg bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center text-blue-500">
                    <Info size={12} />
                  </div>
                  <p className="text-[10px] text-zinc-600 dark:text-zinc-400 font-medium leading-tight">Este edital foi revisado. Sincronize para atualizar.</p>
                </div>
              </div>
            )}

            <div className="px-3 pt-3 pb-1.5">
              <div className="grid grid-cols-2 gap-2.5">
                <div className="flex items-center gap-2.5 p-2.5 bg-white dark:bg-zinc-900 rounded-lg border border-emerald-100 dark:border-emerald-900/30 shadow-sm transition-all hover:shadow-md">
                  <div className="w-7 h-7 bg-emerald-500 text-white rounded-md flex items-center justify-center flex-shrink-0 shadow-md shadow-emerald-500/20"><Plus size={12} strokeWidth={3} /></div>
                  <div>
                    <div className="text-lg font-black text-zinc-900 dark:text-zinc-100 leading-none">{totalAdd}</div>
                    <div className="text-[8px] font-black text-emerald-600 dark:text-emerald-500 uppercase mt-0.5">Novos</div>
                  </div>
                </div>
                <div className="flex items-center gap-2.5 p-2.5 bg-white dark:bg-zinc-900 rounded-lg border border-zinc-100 dark:border-zinc-800 shadow-sm transition-all hover:shadow-md">
                  <div className="w-7 h-7 bg-zinc-200 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 rounded-md flex items-center justify-center flex-shrink-0 shadow-inner"><Minus size={12} strokeWidth={3} /></div>
                  <div>
                    <div className="text-lg font-black text-zinc-900 dark:text-zinc-100 leading-none">{totalRem}</div>
                    <div className="text-[8px] font-black text-zinc-400 uppercase mt-0.5">Saíram</div>
                  </div>
                </div>
              </div>
            </div>

            {diff && (totalAdd > 0 || totalRem > 0) && (
              <div className="px-3 pb-3 space-y-2 mt-1">
                {diff.novasDisciplinas?.length > 0 && (
                  <DiffSection label="Matérias Novas" count={diff.novasDisciplinas.length} variant="add" defaultOpen>
                    {diff.novasDisciplinas.map((d, i) => (
                      <div key={i} className="flex items-center gap-2 px-2.5 py-1.5 group">
                        <Plus size={9} strokeWidth={3} className="text-emerald-500 flex-shrink-0" />
                        <span className="text-[10px] font-bold text-zinc-800 dark:text-zinc-200 flex-1 min-w-0">{d.nome}</span>
                      </div>
                    ))}
                  </DiffSection>
                )}
                {diff.disciplinasComNovosAssuntos?.length > 0 && (
                  <DiffSection label="Assuntos" count={diff.disciplinasComNovosAssuntos.reduce((a, d) => a + d.novosAssuntos.length, 0)} variant="add">
                    {diff.disciplinasComNovosAssuntos.map((d, i) => (
                      <div key={i} className="px-2.5 py-2">
                        <div className="flex items-center gap-1.5 mb-1.5">
                          <div className="w-1 h-2.5 rounded-full bg-emerald-500/50" />
                          <span className="text-[8px] font-black text-zinc-600 dark:text-zinc-400 uppercase truncate">{d.nome}</span>
                        </div>
                        <div className="pl-2.5 space-y-1 border-l border-zinc-100 dark:border-zinc-800/50 ml-1">
                          {d.novosAssuntos.slice(0, 4).map((a, j) => (
                            <div key={j} className="flex items-start gap-1.5">
                              <Plus size={6} strokeWidth={3} className="text-emerald-400 mt-0.5 flex-shrink-0" />
                              <span className="text-[9px] text-zinc-600 dark:text-zinc-300 leading-tight font-medium">{a}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </DiffSection>
                )}
              </div>
            )}

            <div className="mx-3 mb-3 flex items-center gap-2.5 p-2.5 bg-indigo-50/50 dark:bg-indigo-900/10 rounded-lg border border-indigo-100 dark:border-indigo-900/30 shadow-sm">
              <Shield size={14} strokeWidth={2.5} className="text-indigo-600 dark:text-indigo-400 shrink-0" />
              <p className="text-[9px] text-indigo-900 dark:text-indigo-300 font-bold leading-tight">Seu progresso será preservado nesta transição.</p>
            </div>
          </div>

            {ciclosAfetadosCount > 1 && (
              <div className="mx-3 mb-3 rounded-lg border border-zinc-200 bg-white p-2.5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
                <p className="mb-1.5 text-[8px] font-black uppercase tracking-widest text-zinc-400">Ciclos que serao atualizados</p>
                <div className="space-y-1">
                  {(ciclosAfetados || []).slice(0, 5).map((item) => (
                    <div key={item.cicloId} className="truncate text-[10px] font-bold text-zinc-700 dark:text-zinc-300">
                      {item.cicloNome}
                    </div>
                  ))}
                  {ciclosAfetadosCount > 5 && (
                    <div className="text-[9px] font-black uppercase text-zinc-400">+{ciclosAfetadosCount - 5} outros</div>
                  )}
                </div>
              </div>
            )}
          <div className="flex-shrink-0 px-4 py-4 border-t border-zinc-100 dark:border-zinc-800 bg-white dark:bg-zinc-950 space-y-2.5 shadow-2xl">
            <button onClick={handleApply} disabled={applying || loading}
              className={`group w-full py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all active:scale-[0.98] flex items-center justify-center gap-2 shadow-xl disabled:opacity-50 text-white bg-gradient-to-r ${typeCfg.color} hover:brightness-110`}
            >
              {applying || loading ? <><div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" /> ...</> : <><ArrowUpCircle size={16} /> {ciclosAfetadosCount > 1 ? 'Atualizar Ciclos' : 'Atualizar Agora'}</>}
            </button>
            <div className="flex gap-2">
              <button onClick={onClose} className="flex-1 py-1.5 rounded-lg text-[8px] font-black uppercase tracking-wider text-zinc-400 hover:text-red-600 transition-all border border-zinc-100 dark:border-zinc-800">Adiar</button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>,
    document.body
  );
};

const NotifItem = ({ notif, isRead, onRead, onOpenBroadcast, onOpenEditalModal, onDismissUpdate, onDeleteBroadcast, onDeleteHistory, isDismissedItem = false }) => {
  const resolvedType = notif._type || (notif.cicloId ? 'edital_update' : 'broadcast');
  const historyId = notif.id || (notif.cicloId && notif.versionKey ? `edital_${notif.cicloId}_${notif.versionKey}` : null);
  const handleDelete = (event) => {
    event.stopPropagation();
    if (isDismissedItem && historyId && onDeleteHistory) {
      onDeleteHistory(historyId);
      return;
    }
    if (notif.id && onDeleteBroadcast) onDeleteBroadcast(notif.id);
  };

  if (resolvedType === 'broadcast') {
    const cfg = BROADCAST_CONFIG[notif.category] || BROADCAST_CONFIG.comunicado;
    const Icon = cfg.icon;
    const hasImage = notif.imageUrls?.length > 0 || notif.imageUrl;
    const preview = notif.message?.slice(0, 60);

    return (
      <motion.div initial={false}
        className={`relative rounded-xl border overflow-hidden transition-colors duration-75 group ${isRead ? 'opacity-70 hover:opacity-100' : 'shadow-md'} bg-white dark:bg-zinc-900/80 border-zinc-200 dark:border-zinc-800 hover:border-red-500/30 dark:hover:border-red-500/40`}
      >
        <div className={`absolute left-0 top-0 bottom-0 w-1 ${cfg.strip} shadow-xl`} />
        {!isRead && (
          <div className="absolute top-2.5 right-2.5 flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
            <span className="relative inline-flex h-2 w-2 rounded-full bg-red-600 shadow-[0_0_6px_rgba(220,38,38,0.8)]"></span>
          </div>
        )}
        <div className="flex items-start gap-3 p-3 pl-4">
          <div className={`w-8 h-8 rounded-lg ${cfg.bg} flex items-center justify-center flex-shrink-0 shadow-inner group-hover:scale-105 transition-transform duration-300`}>
            <Icon size={14} className={`${cfg.accent} ${notif.category === 'urgente' ? 'animate-pulse' : ''}`} strokeWidth={2.5} />
          </div>
          <div className="flex-1 min-w-0 pr-3">
            <div className="flex items-center gap-1.5 mb-1 flex-wrap">
              <span className={`text-[8px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-md ${cfg.bg} ${cfg.accent} border border-black/5 dark:border-white/5`}>{cfg.label}</span>
              <span className="text-[8px] font-bold text-zinc-400 flex items-center gap-1"><Clock size={8} /> {formatTimeAgo(notif.timestamp)}</span>
            </div>
            {hasImage ? (
              <div className="flex items-center gap-1.5 text-[9px] font-black text-red-600 dark:text-red-400 bg-red-500/5 dark:bg-red-500/10 px-2 py-1 rounded-lg w-fit mt-1 border border-red-500/10">
                <Flame size={10} className="animate-bounce" /> <span>VISUAL</span>
              </div>
            ) : (
              <p className="text-[11px] text-zinc-700 dark:text-zinc-300 leading-tight line-clamp-2 font-bold group-hover:text-zinc-900 dark:group-hover:text-white transition-colors">{preview}{notif.message?.length > 60 ? '...' : ''}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 px-3 pb-3 pt-0">
          <button onClick={() => onOpenBroadcast(notif)} className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest text-white bg-gradient-to-r from-red-600 to-red-700 hover:brightness-110 shadow-lg shadow-red-600/20 transition-all active:scale-[0.97]">
            <Eye size={12} strokeWidth={3} /> ACESSAR
          </button>
          {!isRead && (
            <button onClick={(e) => { e.stopPropagation(); onRead(notif.id); }} className="p-1.5 rounded-lg text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 transition-all active:scale-90 border border-emerald-100 dark:border-emerald-900/30 shadow-sm"><Check size={14} strokeWidth={3} /></button>
          )}
          {isRead && <div className="flex items-center gap-1 p-1.5 text-zinc-400"><CheckCheck size={14} strokeWidth={2.5} /></div>}
          <button onClick={handleDelete} className="p-1.5 rounded-lg text-zinc-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20 transition-all opacity-0 group-hover:opacity-100 active:scale-90"><Trash2 size={14} strokeWidth={2.5} /></button>
        </div>
      </motion.div>
    );
  }

  if (resolvedType === 'edital_update') {
    const { diff, cicloNome, cicloLogo, templateData, ciclosAfetadosCount } = notif;
    const updateMetadata = templateData?.updateMetadata || null;
    const typeKey = updateMetadata?.tipo || 'AJUSTE_INTERNO';
    const typeCfg = UPDATE_TYPE_CONFIG[typeKey] || UPDATE_TYPE_CONFIG.AJUSTE_INTERNO;
    const TypeIcon = typeCfg.icon;

    const totalAdd = (diff?.novasDisciplinas?.length || 0) + (diff?.disciplinasComNovosAssuntos?.reduce((a, d) => a + d.novosAssuntos.length, 0) || 0);
    const totalRem = (diff?.disciplinasRemovidas?.length || 0) + (diff?.disciplinasComAssuntosRemovidos?.reduce((a, d) => a + d.assuntosRemovidos.length, 0) || 0);

    return (
      <motion.div initial={false}
        className={`rounded-xl border bg-white dark:bg-zinc-900/80 overflow-hidden cursor-pointer transition-all group ${isDismissedItem ? 'border-zinc-200 dark:border-zinc-800 opacity-70 hover:opacity-100' : 'border-zinc-200 dark:border-zinc-800 hover:border-red-500/30 dark:hover:border-red-500/40 shadow-sm'}`}
        onClick={() => onOpenEditalModal(notif)}
      >
        <div className={`h-1 w-full ${typeCfg.stripColor} shadow-xl`} />
        <div className="p-3">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-lg bg-white dark:bg-zinc-800 border border-zinc-100 dark:border-zinc-700 flex items-center justify-center flex-shrink-0 overflow-hidden shadow-md transition-transform group-hover:rotate-2">
              {cicloLogo ? <img src={cicloLogo} alt="" className="w-7 h-7 object-contain" /> : <BookOpen size={18} className="text-zinc-300" />}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                <span className={`inline-flex items-center gap-1 text-[8px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-md ${typeCfg.badgeBg} ${typeCfg.textColor} border ${typeCfg.borderColor} shadow-sm`}><TypeIcon size={8} strokeWidth={2.5} /> {typeCfg.shortLabel}</span>
                <span className="text-[8px] font-bold text-zinc-400 flex items-center gap-1"><Clock size={8}/> {formatTimeAgo(notif.timestamp)}</span>
              </div>
              <p className="text-[12px] font-black text-zinc-900 dark:text-zinc-100 truncate tracking-tight uppercase group-hover:text-red-600 dark:group-hover:text-red-400 transition-colors">{cicloNome}</p>
              {ciclosAfetadosCount > 1 && (
                <p className="mt-0.5 text-[8px] font-black uppercase tracking-widest text-zinc-400">
                  Atualizacao agrupada
                </p>
              )}
              {updateMetadata?.mensagem && (
                <div className="flex items-center gap-1.5 mt-1.5 px-2 py-1 bg-gradient-to-r from-red-500/5 to-red-700/5 dark:from-red-500/10 dark:to-red-700/10 rounded-md border border-red-500/10">
                  <Sparkles size={10} className="text-red-500 flex-shrink-0 animate-pulse" />
                  <p className="text-[9px] text-zinc-700 dark:text-zinc-300 font-bold line-clamp-1">{updateMetadata.mensagem}</p>
                </div>
              )}
              <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                {totalAdd > 0 && <span className="text-[8px] font-black px-1.5 py-0.5 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 rounded-md border border-emerald-500/20 shadow-sm">+{totalAdd} NOVIDADES</span>}
                {totalRem > 0 && <span className="text-[8px] font-black px-1.5 py-0.5 bg-zinc-500/10 text-zinc-500 dark:text-zinc-400 rounded-md border border-zinc-500/20">-{totalRem} INATIVOS</span>}
                <span className="ml-auto text-[8px] font-black text-red-600 dark:text-red-400 flex items-center gap-0.5 flex-shrink-0 uppercase tracking-widest transition-transform group-hover:translate-x-0.5">VER <ChevronRight size={10} strokeWidth={3} /></span>
              </div>
            </div>
          </div>
        </div>
        {isDismissedItem ? (
          <div className="px-3 pb-3 flex justify-end border-t border-zinc-50 dark:border-zinc-800/60 pt-2.5" onClick={(e) => e.stopPropagation()}>
            <button onClick={handleDelete} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[8px] font-black uppercase tracking-widest text-zinc-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20 transition-all">
              <Trash2 size={12} strokeWidth={2.5} /> Excluir
            </button>
          </div>
        ) : (
          <div className="px-3 pb-3 flex gap-2 border-t border-zinc-50 dark:border-zinc-800/60 pt-2.5" onClick={(e) => e.stopPropagation()}>
            <button onClick={(e) => { e.stopPropagation(); if (onDismissUpdate) onDismissUpdate(notif.cicloId, notif.versionKey); }} className="px-3 py-1.5 rounded-lg text-[8px] font-black uppercase tracking-widest text-zinc-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20 transition-all border border-transparent hover:border-red-100 dark:hover:border-red-900/30">IGNORAR</button>
            <button onClick={(e) => { e.stopPropagation(); onOpenEditalModal(notif); }} className={`flex-1 py-1.5 rounded-lg text-[8px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-1.5 text-white bg-gradient-to-r ${typeCfg.color} hover:brightness-110 active:scale-[0.97] shadow-lg shadow-red-600/15`}><Rocket size={12} strokeWidth={2.5} /> ATUALIZAR</button>
          </div>
        )}
      </motion.div>
    );
  }
  return null;
};

const NotificationPanel = ({
  isOpen, onClose, notifications, dismissedHistory, unreadCount,
  readBroadcasts, onMarkBroadcastRead, onMarkAllRead,
  onApplyEditalUpdate, onDismissEditalUpdate, loadingUpdate, onNavigateToEdital,
  deleteBroadcast, deleteHistoryItem, systemAlerts = [], onSystemAlertAction,
  bellRef
}) => {
  const [activeFilter, setActiveFilter] = useState('all');
  const [broadcastModal, setBroadcastModal] = useState(null);
  const [editalModal, setEditalModal] = useState(null);
  const panelRef = useRef(null);
  const onCloseRef = useRef(onClose);
  useEffect(() => { onCloseRef.current = onClose; }, [onClose]);

  useEffect(() => {
    if (!isOpen) return;
    const handler = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target)) {
        if (e.target.closest('.notif-modal-portal')) return;
        onCloseRef.current();
      }
    };
    document.addEventListener('mousedown', handler, true);
    return () => document.removeEventListener('mousedown', handler, true);
  }, [isOpen]);

  const validNotifications = useMemo(() => {
    const valid = (notifications || []).filter(n => {
      if (n._type === 'edital_update') {
          const totalAdd = (n.diff?.novasDisciplinas?.length || 0) + (n.diff?.disciplinasComNovosAssuntos?.reduce((a, d) => a + d.novosAssuntos.length, 0) || 0);
          const totalRem = (n.diff?.disciplinasRemovidas?.length || 0) + (n.diff?.disciplinasComAssuntosRemovidos?.reduce((a, d) => a + d.assuntosRemovidos.length, 0) || 0);
          const hasMessage = !!n.templateData?.updateMetadata?.mensagem;
          return totalAdd > 0 || totalRem > 0 || hasMessage;
      }
      return true;
    });

    const latestUpdates = new Map();
    valid.forEach(n => {
      if (n._type === 'edital_update') {
          const existing = latestUpdates.get(n.cicloId);
          if (!existing || n.timestamp > existing.timestamp) latestUpdates.set(n.cicloId, n);
      }
    });
    return valid.filter(n => n._type !== 'edital_update' || latestUpdates.get(n.cicloId) === n);
  }, [notifications]);

  const filtered = useMemo(() => {
    if (activeFilter === 'broadcasts') return validNotifications.filter((n) => n._type === 'broadcast');
    if (activeFilter === 'updates') return validNotifications.filter((n) => n._type === 'edital_update');
    if (activeFilter === 'history') {
      return (dismissedHistory || [])
        .map(h => ({ ...h, _type: h._type || (h.cicloId ? 'edital_update' : 'broadcast'), isDismissed: true }))
        .sort((a, b) => (toMillisSafe(b.dismissedAt || b.timestamp) || 0) - (toMillisSafe(a.dismissedAt || a.timestamp) || 0));
    }
    return validNotifications;
  }, [activeFilter, validNotifications, dismissedHistory]);

  const filters = [
    { id: 'all', label: 'TUDO', count: unreadCount },
    { id: 'broadcasts', label: 'AVISOS', count: validNotifications.filter(n => n._type === 'broadcast' && !readBroadcasts.has(n.id)).length, icon: Megaphone },
    { id: 'updates', label: 'EDITAL', count: validNotifications.filter(n => n._type === 'edital_update').length, icon: BookOpen },
    { id: 'history', label: 'HISTORICO', count: (dismissedHistory || []).length, icon: History },
  ];

  const [bellRectState, setBellRectState] = useState(null);
  useEffect(() => {
    if (!bellRef?.current || !isOpen) { setBellRectState(null); return; }
    const update = () => setBellRectState(bellRef.current.getBoundingClientRect());
    update(); window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, [bellRef, isOpen]);

  const isMobileViewport = window.innerWidth < 640;
  const panelWidth = isMobileViewport ? Math.min(390, Math.max(300, window.innerWidth - 40)) : 340;
  const bellRight = bellRectState ? Math.max(window.innerWidth - bellRectState.right, 10) : 10;
  const bellBottom = bellRectState ? bellRectState.bottom : 74;
  const panelMaxHeight = Math.min(isMobileViewport ? 500 : 520, Math.max(280, window.innerHeight - bellBottom - 24));
  const panelPosition = isMobileViewport
    ? { left: '50%', width: panelWidth, marginLeft: -(panelWidth / 2) }
    : { right: bellRight, width: panelWidth };

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <>
          {broadcastModal && <BroadcastModal notif={broadcastModal} onClose={() => setBroadcastModal(null)} />}
          {editalModal && <EditalUpdateModal notif={editalModal} onClose={() => setEditalModal(null)} onApply={onApplyEditalUpdate} onDismiss={onDismissEditalUpdate} loading={loadingUpdate} onNavigateToEdital={onNavigateToEdital} />}
          {!broadcastModal && !editalModal && <div className="fixed inset-0 z-[90] bg-zinc-950/10" onClick={onClose} />}
          <motion.div
            ref={panelRef}
            initial={{ opacity: 0, scale: 0.985, y: -4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.985, y: -4 }}
            transition={{ duration: 0.1, ease: 'easeOut' }}
            style={{ top: bellBottom + 8, ...panelPosition, maxHeight: panelMaxHeight }}
            className="modal-zoom modal-zoom--notifications fixed z-[100] flex flex-col overflow-hidden glass-panel-fire rounded-[22px] sm:rounded-[20px] shadow-2xl"
          >
            <style>{notifGlobalStyles}</style>
            <div className="h-1 bg-gradient-to-r from-red-700 via-red-500 to-red-700 flex-shrink-0 shadow-lg" />
            <div className="flex-shrink-0 flex items-center justify-between px-3 py-2.5 border-b border-zinc-100 dark:border-zinc-800/60 bg-white/20 dark:bg-zinc-950/40">
              <div className="flex items-center gap-2">
                <div className="relative flex items-center justify-center w-7 h-7 bg-red-600/10 dark:bg-red-500/20 rounded-lg">
                  <Bell size={14} className="text-red-600 dark:text-red-500" strokeWidth={2.5} />
                  {unreadCount > 0 && <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white dark:border-zinc-900 shadow-lg" />}
                </div>
                <div><h3 className="text-[13px] font-black text-zinc-900 dark:text-white uppercase tracking-[0.1em] leading-none">Notificações</h3><p className="text-[8px] font-bold text-zinc-400 uppercase tracking-widest mt-1 flex items-center gap-1"><Flame size={8} className="text-red-500" /> FEED OPERACIONAL</p></div>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={onMarkAllRead}
                  disabled={validNotifications.length === 0}
                  title="Marcar todas como vistas e mover para o historico"
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[9px] font-black uppercase text-zinc-500 hover:text-white hover:bg-zinc-900 dark:hover:bg-white dark:hover:text-zinc-900 transition-all disabled:cursor-not-allowed disabled:opacity-30"
                >
                  <CheckCheck size={12} />
                  <span className="hidden sm:inline">Marcar todas como lido</span>
                </button>
                <button onClick={onClose} className="p-1.5 rounded-lg text-zinc-400 hover:text-red-600 transition-all"><X size={16} /></button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto notif-scrollbar">
              {systemAlerts.length > 0 && activeFilter === 'all' && (
                <div className="px-3 pt-3 pb-2 space-y-2 bg-gradient-to-b from-red-600/5 to-transparent">
                  {systemAlerts.map(alert => <SystemAlertCard key={alert.id} alert={alert} onAction={onSystemAlertAction} />)}
                </div>
              )}
              <div className="sticky top-0 z-20 grid grid-cols-2 gap-1.5 px-2.5 py-2 bg-white/95 dark:bg-zinc-950/95 border-b border-zinc-100 dark:border-zinc-800/60 sm:flex sm:items-center sm:justify-between sm:gap-1 sm:overflow-x-hidden">
                {filters.map(f => (
                  <button key={f.id} onClick={() => setActiveFilter(f.id)} className={`flex min-w-0 items-center justify-center gap-1 px-2 py-1.5 rounded-lg text-[8px] font-black uppercase tracking-wider transition-colors duration-75 border ${activeFilter === f.id ? 'bg-zinc-900 text-white border-zinc-900 dark:bg-white dark:text-zinc-900 dark:border-white shadow-md' : 'bg-white dark:bg-zinc-900 text-zinc-500 border-zinc-100 dark:border-zinc-800 shadow-sm'}`}>
                    {f.icon && <f.icon size={11} />} {f.label} {f.count > 0 && <span className="text-[8px] font-black px-1.5 py-0.5 rounded-md bg-red-500 text-white shadow-md">{f.count}</span>}
                  </button>
                ))}
              </div>
              <div className="space-y-3 p-2.5 sm:p-3">
                {filtered.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <div className="w-16 h-16 bg-zinc-50 dark:bg-zinc-900 rounded-[20px] flex items-center justify-center mb-5 shadow-inner border border-zinc-100 dark:border-zinc-800"><Flame size={28} className="text-red-100 dark:text-red-950" strokeWidth={1.5} /></div>
                    <h4 className="text-[12px] font-black text-zinc-700 dark:text-zinc-200 tracking-[0.1em] uppercase leading-tight">SEM PENDÊNCIAS</h4>
                  </div>
                ) : (
                  <div key={activeFilter} className="space-y-3.5">
                    {filtered.map(n => <NotifItem key={`${n._type || 'notif'}:${n.id}:${n.versionKey || ''}`} notif={n} isRead={n._type === 'broadcast' ? readBroadcasts.has(n.id) : false} onRead={onMarkBroadcastRead} onOpenBroadcast={(notif) => { setBroadcastModal(notif); if (!readBroadcasts.has(notif.id)) onMarkBroadcastRead(notif.id); }} onOpenEditalModal={setEditalModal} onDismissUpdate={onDismissEditalUpdate} onDeleteBroadcast={deleteBroadcast} onDeleteHistory={deleteHistoryItem} isDismissedItem={n.isDismissed || activeFilter === 'history'} />)}
                  </div>
                )}
              </div>
            </div>
            <div className="flex-shrink-0 px-3 py-2.5 border-t border-zinc-100 dark:border-zinc-800/60 flex items-center justify-between bg-white/95 dark:bg-zinc-950/95">
              <span className="text-[9px] font-black text-zinc-400 uppercase tracking-[0.1em]">{filtered.length} REGISTROS</span>
              <div className="flex items-center gap-2 opacity-40 group cursor-default"><img src="/logoModoQAP.png" alt="Logo" className="h-3.5 grayscale dark:invert" /><span className="text-[8px] font-black text-zinc-900 dark:text-white uppercase tracking-[0.2em]">MODOQAP</span></div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>,
    document.body
  );
};

export const NotificationBell = ({ unreadCount, notifications, dismissedHistory, readBroadcasts, onMarkBroadcastRead, onMarkAllRead, onApplyEditalUpdate, onDismissEditalUpdate, loadingUpdate, onNavigateToEdital, deleteBroadcast, deleteHistoryItem, systemAlerts = [], onSystemAlertAction, bellRef }) => {
  const [panelOpen, setPanelOpen] = useState(false);
  const hasEditalUpdate = (notifications || []).some(n => n._type === 'edital_update');
  const totalBadgeCount = Number(unreadCount || 0) + (systemAlerts || []).length;
  return (
    <div className="relative">
      <motion.button ref={bellRef} whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.95 }} onClick={() => setPanelOpen(!panelOpen)} className={`relative w-8 h-8 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl flex items-center justify-center transition-all border shadow-sm ${panelOpen ? 'bg-gradient-to-br from-red-600 to-red-700 text-white border-transparent shadow-xl scale-105' : 'bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-800'}`} aria-label="Notificações">
        <Bell size={17} strokeWidth={2.2} />
        {totalBadgeCount > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] bg-red-500 text-white text-[9px] font-black rounded-full flex items-center justify-center border-2 border-white dark:border-zinc-950 shadow-lg">
            {totalBadgeCount > 9 ? '9+' : totalBadgeCount}
          </span>
        )}
        {hasEditalUpdate && totalBadgeCount === 0 && <span className="absolute -top-1 -right-1 h-3.5 w-3.5 rounded-full bg-red-500 border-2 border-white dark:border-zinc-950" />}
      </motion.button>
      <NotificationPanel isOpen={panelOpen} onClose={() => setPanelOpen(false)} notifications={notifications || []} dismissedHistory={dismissedHistory || []} unreadCount={unreadCount} readBroadcasts={readBroadcasts} onMarkBroadcastRead={onMarkBroadcastRead} onMarkAllRead={onMarkAllRead} onApplyEditalUpdate={onApplyEditalUpdate} onDismissEditalUpdate={onDismissEditalUpdate} loadingUpdate={loadingUpdate} onNavigateToEdital={onNavigateToEdital} deleteBroadcast={deleteBroadcast} deleteHistoryItem={deleteHistoryItem} systemAlerts={systemAlerts} onSystemAlertAction={onSystemAlertAction} bellRef={bellRef} />
    </div>
  );
};
