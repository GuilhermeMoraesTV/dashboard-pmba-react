import React, { useState, useMemo, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { db } from '../firebaseConfig';
import {
  collection, doc, getDoc, getDocs, query, where,
  addDoc, serverTimestamp, deleteDoc, onSnapshot, writeBatch, updateDoc
} from 'firebase/firestore';
import {
  BookOpen, CheckCircle2, ChevronDown,
  Search, AlertCircle, Play,
  Target, CheckSquare, Clock,
  Flame, AlertTriangle, Trophy, LayoutDashboard,
  ChevronRight, LayoutGrid, GraduationCap, X, Ban, RefreshCw, ArrowUpCircle,
  GripVertical, Sparkles, Rocket, Plus, Minus, Shield, Star, Undo2, Trash2, ChevronUp,
  CalendarDays, ArrowLeftRight, Zap, LayoutList,
  Download, FileText, Loader2, Library, Eye, ArrowLeft,
} from 'lucide-react';
import { CATALOGO_EDITAIS } from '../pages/AdminPage/EditaisManager';
import { useForceUnlock } from '../hooks/useForceUnlock';
import EmptyStateCard from '../components/shared/EmptyStateCard';
import { TelaCatalogo } from '../components/cronograma/Step1Edital';
import {
  filterEditalDisciplines,
  formatEditalProgressText,
  formatEditalStudyDate,
  prepareExternalEditalDisciplines,
} from '../utils/editalPageUtils';
import {
  downloadEditalVerticalizadoPdf,
  PDF_FILL_BLANK,
  PDF_FILL_PROGRESS,
  PDF_SCOPE_COMPLETE,
  PDF_SCOPE_PLANNING,
  prepareEditalVerticalizadoDisciplines,
} from './EditalVerticalizadoPdf';
import { isHighRelevance } from '../utils/planningPriority';

// ----------------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------------
const systemCardClass = 'group relative overflow-hidden rounded-xl border-2 border-l-4 border-zinc-200 !border-l-red-500/20 bg-white shadow-soft transition-all duration-300 hover:border-accent-light/40 hover:!border-l-red-500 hover:shadow-[0_0_18px_rgba(239,68,68,0.07)] dark:border-white/10 dark:!border-l-red-500/25 dark:bg-zinc-950 dark:hover:border-accent-light/20 dark:hover:!border-l-red-500 dark:hover:shadow-[0_0_22px_rgba(239,68,68,0.08)]';
const systemPanelClass = 'rounded-xl border border-zinc-200 bg-zinc-50/80 dark:border-white/10 dark:bg-zinc-900/65';

const getTemplateIdDoCiclo = (ciclo) => {
  if (!ciclo) return null;
  return ciclo.templateId || ciclo.editalId || 'manual';
};

const normalize = (str) =>
  str ? str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase() : '';

const formatMinutesToTime = (totalMinutes) => {
  if (!totalMinutes || totalMinutes === 0) return '0m';
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  if (h > 0 && m > 0) return `${h}h ${m}m`;
  if (h > 0) return `${h}h`;
  return `${m}m`;
};

const getProgressStats = (acertos, total) => {
  const nTotal = Number(total) || 0; const nAcertos = Number(acertos) || 0;
  if (nTotal === 0) return { colorText: 'text-zinc-400', perc: 0 };
  const perc = Math.round((nAcertos / nTotal) * 100);
  if (perc >= 80) return { colorText: 'text-emerald-600 dark:text-emerald-400', perc };
  if (perc >= 50) return { colorText: 'text-amber-600 dark:text-amber-400', perc };
  return          { colorText: 'text-red-600 dark:text-red-400', perc };
};

const isRegistroRevisao = (registro) => (
  registro?.isRevisao === true ||
  registro?.revisao === true ||
  registro?.tipoEstudo === 'revisao'
);

const getDesempenhoConfig = (perc, questoes) => {
  if (!questoes || questoes === 0) return { style: 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500 border border-zinc-200 dark:border-zinc-700', icon: Target, label: '0%' };
  if (perc >= 85) return { style: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 border border-yellow-200 dark:border-yellow-700/50', icon: Trophy, label: `${perc}%` };
  if (perc >= 70) return { style: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-700/50', icon: CheckCircle2, label: `${perc}%` };
  return          { style: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-700/50', icon: AlertTriangle, label: `${perc}%` };
};

const getLogo = (ciclo) => {
  if (!ciclo) return null;
  if (ciclo.logoUrl) return ciclo.logoUrl;
  const templateId = getTemplateIdDoCiclo(ciclo);
  if (templateId && templateId !== 'manual') {
    const t = CATALOGO_EDITAIS.find(e => e.id === templateId);
    if (t) return t.logoUrl || t.logo;
  }
  const n = ciclo.nome?.toLowerCase() || '';
  if (n.includes('pmba')) return '/logosEditais/logo-pmba.png';
  return null;
};

const getCronogramaLogo = (cronograma) => {
  if (!cronograma) return null;
  if (cronograma.logoUrl) return cronograma.logoUrl;
  if (cronograma.editalLogoUrl) return cronograma.editalLogoUrl;
  const editalId = cronograma.editalId || cronograma.templateId;
  if (editalId && editalId !== 'manual') {
    const t = CATALOGO_EDITAIS.find(e => e.id === editalId);
    if (t) return t.logoUrl || t.logo;
  }
  return null;
};

// Extrai as disciplinas do cronograma a partir do snapshot ou do semanaTemplate
const getDisciplinasDoCronograma = (cronograma) => {
  if (!cronograma) return [];

  // Prefere disciplinasSnapshot (lista estruturada com assuntos)
  if (Array.isArray(cronograma.disciplinasSnapshot) && cronograma.disciplinasSnapshot.length > 0) {
    return cronograma.disciplinasSnapshot.map((d, idx) => ({
      id: d.id || `crono-disc-${idx}`,
      nome: d.nome || d.disciplinaNome || '',
      peso: Number(d.peso) || 1,
      assuntos: Array.isArray(d.assuntos) ? d.assuntos : [],
      index: d.index ?? idx,
      inCiclo: d.inCiclo !== false,
    }));
  }

  // Fallback: agrupa as disciplinas únicas do semanaTemplate
  if (Array.isArray(cronograma.semanaTemplate) && cronograma.semanaTemplate.length > 0) {
    const map = new Map();
    cronograma.semanaTemplate.forEach((slot, idx) => {
      const nome = slot.disciplinaNome || slot.nome || '';
      if (!nome) return;
      const id = slot.disciplinaId || `crono-disc-${normalize(nome)}`;
      if (!map.has(id)) {
        map.set(id, { id, nome, peso: 1, assuntos: [], index: idx, inCiclo: true });
      }
      // Adiciona assunto se não existir ainda
      const disc = map.get(id);
      const assunto = slot.assunto;
      if (assunto && !disc.assuntos.some(a => {
        const nomeA = typeof a === 'string' ? a : a.nome;
        return normalize(nomeA) === normalize(assunto);
      })) {
        disc.assuntos.push(assunto);
      }
    });
    return Array.from(map.values());
  }

  return [];
};

// ----------------------------------------------------------------------
// Sub-components
// ----------------------------------------------------------------------
const NewBadge = ({ isNew }) => {
  const [visible, setVisible] = useState(isNew);
  useEffect(() => {
    if (!isNew) return;
    const t = setTimeout(() => setVisible(false), 8000);
    return () => clearTimeout(t);
  }, [isNew]);
  return (
    <AnimatePresence>
      {visible && (
        <motion.span
          initial={{ opacity: 0, scale: 0.6 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.6 }}
          transition={{ type: 'spring', duration: 0.4 }}
          className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-gradient-to-r from-emerald-500 to-teal-500 text-white text-[8px] font-black uppercase tracking-widest shadow-sm flex-shrink-0"
        >
          <Star size={7} fill="currentColor" /> NOVO
        </motion.span>
      )}
    </AnimatePresence>
  );
};

const UPDATE_TYPE_CONFIG = {
  LANCAMENTO:    { label: 'Novo Lançamento!', color: 'from-emerald-500 to-teal-600',  icon: Rocket,        textColor: 'text-emerald-700 dark:text-emerald-300', bgGradient: 'from-emerald-50 to-teal-50 dark:from-emerald-900/20 dark:to-teal-900/20', borderColor: 'border-emerald-300 dark:border-emerald-700/50' },
  RETIFICACAO:   { label: 'Retificação',      color: 'from-amber-500 to-orange-600',  icon: AlertTriangle, textColor: 'text-amber-700 dark:text-amber-300',   bgGradient: 'from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20', borderColor: 'border-amber-300 dark:border-amber-700/50' },
  AJUSTE_INTERNO:{ label: 'Atualizado',       color: 'from-blue-500 to-indigo-600',   icon: RefreshCw,     textColor: 'text-blue-700 dark:text-blue-300',     bgGradient: 'from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20', borderColor: 'border-blue-300 dark:border-blue-700/50' },
};

const BookStackBadge = ({ count }) => {
  const vis = Math.min(count, 5); const isZero = count <= 0;
  let colorClass = 'bg-zinc-300 dark:bg-zinc-700', textColor = 'text-zinc-400';
  if (count >= 1 && count <= 2) { colorClass = 'bg-emerald-500'; textColor = 'text-emerald-600 dark:text-emerald-400'; }
  else if (count >= 3 && count <= 4) { colorClass = 'bg-blue-500'; textColor = 'text-blue-600 dark:text-blue-400'; }
  else if (count >= 5 && count <= 6) { colorClass = 'bg-amber-500'; textColor = 'text-amber-600 dark:text-amber-400'; }
  else if (count >= 7) { colorClass = 'bg-red-600 animate-pulse'; textColor = 'text-red-600 dark:text-red-400'; }
  return (
    <div className="flex flex-col items-end w-14 shrink-0">
      <span className="text-[9px] font-bold text-zinc-400 uppercase tracking-wider mb-0.5">Revisões</span>
      <div className="flex items-center gap-1.5">
        <span className={`text-xs font-black ${isZero ? 'text-zinc-300 dark:text-zinc-600' : textColor}`}>{count}x</span>
        <div className="flex items-end gap-[2px] h-3">
          {isZero
            ? <div className="w-1.5 h-1 rounded-[1px] bg-zinc-200 dark:bg-zinc-800" />
            : Array.from({ length: vis }).map((_, i) => (
                <motion.div key={i} initial={{ height: 0, opacity: 0 }} animate={{ height: `${(i + 1) * 3}px`, opacity: 1 }} transition={{ duration: 0.3, delay: i * 0.1 }}
                  className={`w-1.5 rounded-[1px] ${colorClass} shadow-sm`} />
              ))
          }
        </div>
      </div>
    </div>
  );
};

const StartStudyModal = ({ disciplina, assunto, onClose, onConfirm }) => {
  if (!disciplina) return null;
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} onClick={(e) => e.stopPropagation()}
        className="bg-white dark:bg-zinc-900 w-full max-w-sm rounded-3xl p-6 shadow-2xl border border-zinc-200 dark:border-zinc-800 text-center">
        <div className="w-16 h-16 bg-red-100 dark:bg-red-900/20 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4"><Clock size={32} /></div>
        <h3 className="text-xl font-black text-zinc-900 dark:text-white mb-2">Iniciar Sessão?</h3>
        <div className="text-sm text-zinc-500 mb-6 px-4">
          Você vai iniciar o cronômetro para estudar:<br/>
          <strong className="text-zinc-800 dark:text-zinc-200 text-base block mt-1">{disciplina.nome}</strong>
          {assunto && <span className="block mt-1 text-emerald-600 dark:text-emerald-400 font-bold text-xs bg-emerald-100 dark:bg-emerald-900/30 py-1 px-2 rounded-lg mx-auto w-fit">{assunto}</span>}
        </div>
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 py-3 rounded-xl font-bold text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors">Cancelar</button>
          <button onClick={() => onConfirm(disciplina, assunto)} className="flex-1 py-3 rounded-xl bg-red-600 text-white font-bold hover:bg-red-700 shadow-lg shadow-red-600/30 transition-transform active:scale-95 flex items-center justify-center gap-2">
            <Play size={18} fill="currentColor"/> Iniciar
          </button>
        </div>
      </motion.div>
    </div>
  );
};

const UpdateBanner = ({ templateData, cicloLogo, cicloNome, diff, updatingEdital, onUpdate, onIgnore }) => {
  const updateMetadata = templateData?.updateMetadata || null;
  const typeKey = updateMetadata?.tipo || 'AJUSTE_INTERNO';
  const typeCfg = UPDATE_TYPE_CONFIG[typeKey] || UPDATE_TYPE_CONFIG.AJUSTE_INTERNO;
  const TypeIcon = typeCfg.icon;

  const totalAdd = diff
    ? (diff.novasDisciplinas?.length || 0) + (diff.disciplinasComNovosAssuntos?.reduce((a, d) => a + d.novosAssuntos.length, 0) || 0)
    : 0;

  const totalRem = diff
    ? (diff.disciplinasRemovidas?.length || 0) + (diff.disciplinasComAssuntosRemovidos?.reduce((a, d) => a + d.assuntosRemovidos.length, 0) || 0)
    : 0;

  return (
    <motion.div
      initial={{ height: 0, opacity: 0 }}
      animate={{ height: 'auto', opacity: 1 }}
      exit={{ height: 0, opacity: 0 }}
      transition={{ duration: 0.35, ease: 'easeOut' }}
      className="overflow-hidden mx-4 md:mx-0"
    >
      <div className={`relative bg-gradient-to-br ${typeCfg.bgGradient} border ${typeCfg.borderColor} rounded-2xl overflow-hidden shadow-md`}>
        <div className={`h-1 w-full bg-gradient-to-r ${typeCfg.color}`} />
        {typeKey === 'LANCAMENTO' && (
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            {[...Array(5)].map((_, i) => (
              <motion.div
                key={i}
                className="absolute w-1 h-1 rounded-full bg-emerald-400/40"
                animate={{ y: [-10, -40], x: [(i % 2 === 0 ? 1 : -1) * 10], opacity: [0, 1, 0] }}
                transition={{ duration: 2.5, delay: i * 0.4, repeat: Infinity, repeatDelay: 1.5 }}
                style={{ left: `${15 + i * 18}%`, bottom: '10%' }}
              />
            ))}
          </div>
        )}
        <div className="p-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <div className="flex items-center gap-3 flex-1 min-w-0">
              {cicloLogo && (
                <div className="w-10 h-10 rounded-xl bg-white/70 dark:bg-zinc-900/50 shadow-sm border border-white/50 flex items-center justify-center flex-shrink-0 overflow-hidden">
                  <img src={cicloLogo} alt="" className="w-8 h-8 object-contain" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                  <span className={`inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-widest ${typeCfg.textColor}`}>
                    <TypeIcon size={9} /> {typeCfg.label}
                  </span>
                  {typeKey === 'LANCAMENTO' && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-500 text-white text-[8px] font-black uppercase tracking-widest rounded-full animate-pulse">
                      <Sparkles size={7} /> Disponível agora!
                    </span>
                  )}
                </div>
                <h3 className="text-sm font-black text-zinc-900 dark:text-zinc-100 truncate">{cicloNome}</h3>
                {updateMetadata?.mensagem ? (
                  <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-0.5 line-clamp-1">{updateMetadata.mensagem}</p>
                ) : (
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">O edital base foi atualizado. Sincronize sem perder seu progresso.</p>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2 flex-shrink-0">
              {totalAdd > 0 && (
                <div className="flex items-center gap-1 px-2 py-1 bg-emerald-100 dark:bg-emerald-900/30 rounded-lg border border-emerald-200 dark:border-emerald-800">
                  <Plus size={9} strokeWidth={3} className="text-emerald-600 dark:text-emerald-400" />
                  <span className="text-[11px] font-black text-emerald-700 dark:text-emerald-300">{totalAdd}</span>
                </div>
              )}
              {totalRem > 0 && (
                <div className="flex items-center gap-1 px-2 py-1 bg-zinc-100 dark:bg-zinc-800 rounded-lg border border-zinc-200 dark:border-zinc-700">
                  <Minus size={9} strokeWidth={3} className="text-zinc-500" />
                  <span className="text-[11px] font-black text-zinc-600 dark:text-zinc-300">{totalRem}</span>
                </div>
              )}

              <button onClick={onIgnore} className="px-3 py-2 rounded-xl text-xs font-bold text-zinc-500 hover:bg-white/50 dark:hover:bg-zinc-800/50 transition-colors">
                Ignorar
              </button>
              <button
                onClick={onUpdate}
                disabled={updatingEdital}
                className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wide transition-all active:scale-95 flex items-center gap-1.5 text-white bg-gradient-to-r ${typeCfg.color} hover:opacity-90 shadow-md disabled:opacity-60 disabled:cursor-not-allowed`}
              >
                {updatingEdital
                  ? <><div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" /> Atualizando...</>
                  : <><ArrowUpCircle size={13} /> Atualizar Agora</>
                }
              </button>
            </div>
          </div>
          <div className="mt-3 flex items-center gap-1.5 text-[10px] text-zinc-500 dark:text-zinc-400">
            <Shield size={10} className="flex-shrink-0" />
            Seu progresso está protegido. Itens removidos ficam inativos mas o histórico é preservado. Seu histórico receberá as renomeações automaticamente.
          </div>
        </div>
      </div>
    </motion.div>
  );
};

// ----------------------------------------------------------------------
// Botão de alternância Ciclo ↔ Cronograma
// Fica posicionado abaixo do círculo da logo no header
// ----------------------------------------------------------------------
const SourceToggleButton = ({ viewSource, onToggle, cicloLogo, cronogramaLogo }) => {
  const isCiclo = viewSource === 'ciclo';
  const destinoLogo  = isCiclo ? cronogramaLogo : cicloLogo;
  const destinoLabel = isCiclo ? 'Cronograma' : 'Ciclo';

  return (
    <motion.button
      onClick={onToggle}
      whileHover={{ scale: 1.04, y: -1 }}
      whileTap={{ scale: 0.96 }}
      className="group absolute right-0 top-0 flex h-7 w-7 items-center justify-center rounded-full border border-zinc-200 bg-white/95 shadow-md backdrop-blur-sm transition-all duration-200 hover:border-red-300 hover:shadow-lg dark:border-zinc-700 dark:bg-zinc-800/95 dark:hover:border-red-600 sm:static sm:h-auto sm:w-auto sm:min-w-[9.75rem] sm:gap-1.5 sm:py-1.5 sm:pl-1.5 sm:pr-3 md:min-w-[11.25rem]"
      title={`Ver edital do ${destinoLabel}`}
      aria-label={`Ver edital do ${destinoLabel}`}
    >
      {/* Mini-logo do destino */}
      <div className="hidden h-6 w-6 flex-shrink-0 items-center justify-center overflow-hidden rounded-full border border-zinc-200 bg-zinc-100 dark:border-zinc-600 dark:bg-zinc-700 sm:flex">
        {destinoLogo
          ? <img src={destinoLogo} alt="" className="w-5 h-5 object-contain" />
          : (isCiclo
              ? <CalendarDays size={12} className="text-zinc-400" />
              : <BookOpen size={12} className="text-zinc-400" />)
        }
      </div>

      <ArrowLeftRight size={14} className="flex-shrink-0 text-red-600 transition-colors group-hover:text-red-500 sm:h-[9px] sm:w-[9px] sm:text-zinc-400" />

      <span className="hidden min-w-0 whitespace-nowrap text-[8px] font-black uppercase tracking-[0.12em] text-zinc-500 transition-colors group-hover:text-red-600 dark:group-hover:text-red-400 sm:inline md:text-[9px]">
        Ver {destinoLabel}
      </span>
    </motion.button>
  );
};

const DownloadEditalModal = ({
  open,
  editalNome,
  scope,
  fillMode,
  generating,
  onScopeChange,
  onFillModeChange,
  onClose,
  onGenerate,
}) => {
  if (!open || typeof document === 'undefined') return null;

  const scopeLabel = scope === PDF_SCOPE_COMPLETE ? 'Edital completo' : 'Disciplinas do planejamento';
  const fillLabel = fillMode === PDF_FILL_PROGRESS ? 'Progresso atual' : 'Em branco';
  const Option = ({ active, icon, title, description, onClick }) => (
    <button
      type="button"
      onClick={onClick}
      disabled={generating}
      className={`flex min-h-[88px] w-full items-start gap-3 rounded-2xl border-2 p-3.5 text-left transition-all disabled:cursor-wait disabled:opacity-70 ${active
        ? 'border-red-500 bg-red-50 text-red-900 shadow-sm shadow-red-500/10 dark:border-red-500 dark:bg-red-500/10 dark:text-red-100'
        : 'border-zinc-200 bg-white text-zinc-700 hover:border-red-200 hover:bg-red-50/40 dark:border-white/10 dark:bg-zinc-950 dark:text-zinc-300 dark:hover:border-red-500/40'}`}
    >
      <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${active ? 'bg-red-600 text-white' : 'bg-zinc-100 text-zinc-500 dark:bg-zinc-900 dark:text-zinc-400'}`}>
        {React.createElement(icon, { size: 19 })}
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-black">{title}</span>
        <span className="mt-1 block text-[11px] font-medium leading-relaxed text-zinc-500 dark:text-zinc-400">{description}</span>
      </span>
      <span className={`ml-auto mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 ${active ? 'border-red-600' : 'border-zinc-300 dark:border-zinc-700'}`}>
        {active && <span className="h-2.5 w-2.5 rounded-full bg-red-600" />}
      </span>
    </button>
  );

  return createPortal(
    <div className="fixed inset-0 z-[100100] flex items-center justify-center bg-zinc-950/70 p-3 backdrop-blur-sm sm:p-5" onClick={generating ? undefined : onClose}>
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 14 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 14 }}
        onClick={(event) => event.stopPropagation()}
        className="flex max-h-[calc(100vh-1.5rem)] w-full max-w-2xl flex-col overflow-hidden rounded-3xl border border-zinc-200 bg-zinc-50 shadow-2xl dark:border-white/10 dark:bg-zinc-950 sm:max-h-[calc(100vh-2.5rem)]"
      >
        <div className="flex items-start gap-4 border-b border-zinc-200 bg-white p-5 dark:border-white/10 dark:bg-zinc-950 sm:p-6">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-red-600 text-white shadow-lg shadow-red-600/25">
            <Download size={23} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-red-600">Edital verticalizado</p>
            <h2 className="mt-1 truncate text-xl font-black text-zinc-900 dark:text-white">Baixar edital</h2>
            <p className="mt-1 line-clamp-2 text-xs font-medium text-zinc-500 dark:text-zinc-400">{editalNome}</p>
          </div>
          <button type="button" onClick={onClose} disabled={generating} className="rounded-xl p-2 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-700 disabled:opacity-40 dark:hover:bg-zinc-900 dark:hover:text-white" aria-label="Fechar">
            <X size={20} />
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-6 overflow-y-auto p-4 sm:p-6">
          <section>
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-black uppercase tracking-wider text-zinc-900 dark:text-white">1. Conteúdo</p>
                <p className="mt-0.5 text-[11px] font-medium text-zinc-500">Escolha quais disciplinas entram no arquivo.</p>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Option active={scope === PDF_SCOPE_COMPLETE} icon={BookOpen} title="Edital completo" description="Inclui todas as disciplinas e assuntos do edital oficial." onClick={() => onScopeChange(PDF_SCOPE_COMPLETE)} />
              <Option active={scope === PDF_SCOPE_PLANNING} icon={LayoutList} title="Disciplinas do planejamento" description="Inclui apenas o conteúdo selecionado no plano atual." onClick={() => onScopeChange(PDF_SCOPE_PLANNING)} />
            </div>
          </section>

          <section>
            <div className="mb-3">
              <p className="text-xs font-black uppercase tracking-wider text-zinc-900 dark:text-white">2. Preenchimento</p>
              <p className="mt-0.5 text-[11px] font-medium text-zinc-500">Defina como os campos de acompanhamento serão gerados.</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Option active={fillMode === PDF_FILL_BLANK} icon={FileText} title="Em branco" description="Caixas de teoria, revisões e questões ficam livres para preencher." onClick={() => onFillModeChange(PDF_FILL_BLANK)} />
              <Option active={fillMode === PDF_FILL_PROGRESS} icon={CheckCircle2} title="Progresso atual" description="Preenche teoria, revisões, questões e acertos registrados no sistema." onClick={() => onFillModeChange(PDF_FILL_PROGRESS)} />
            </div>
          </section>

          <div className="rounded-2xl border border-red-100 bg-red-50/80 p-4 dark:border-red-500/20 dark:bg-red-500/10">
            <p className="text-[9px] font-black uppercase tracking-[0.18em] text-red-600 dark:text-red-400">Arquivo selecionado</p>
            <p className="mt-1.5 text-sm font-black text-zinc-900 dark:text-white">{scopeLabel} · {fillLabel}</p>
            <p className="mt-1 text-[11px] font-medium leading-relaxed text-zinc-500 dark:text-zinc-400">Capa, sumário, tabelas vetoriais, logos do edital e do ModoQAP, marca-d'água e páginas numeradas.</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 border-t border-zinc-200 bg-white p-4 dark:border-white/10 dark:bg-zinc-950 sm:p-5">
          <button type="button" onClick={onClose} disabled={generating} className="rounded-2xl bg-zinc-100 px-4 py-3 text-xs font-black uppercase tracking-wider text-zinc-700 transition-colors hover:bg-zinc-200 disabled:opacity-50 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800">Cancelar</button>
          <button type="button" onClick={onGenerate} disabled={generating} className="flex items-center justify-center gap-2 rounded-2xl bg-red-600 px-4 py-3 text-xs font-black uppercase tracking-wider text-white shadow-lg shadow-red-600/25 transition-all hover:bg-red-700 disabled:cursor-wait disabled:opacity-75">
            {generating ? <Loader2 size={17} className="animate-spin" /> : <Download size={17} />}
            {generating ? 'Gerando...' : 'Gerar PDF'}
          </button>
        </div>
      </motion.div>
    </div>,
    document.body,
  );
};

const EditalLibraryModal = ({
  open,
  modelos,
  loading,
  downloadingId,
  onClose,
  onPreview,
  onDownload,
  onCreatePlanning,
  onMissingEdital,
}) => {
  const [selectedEdital, setSelectedEdital] = useState(null);
  if (!open || typeof document === 'undefined') return null;

  return createPortal(
    <div className="fixed inset-0 z-[100100] flex items-center justify-center bg-zinc-950/75 p-2 backdrop-blur-sm sm:p-5" onClick={onClose}>
      <motion.div
        initial={{ opacity: 0, scale: 0.97, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.97, y: 12 }}
        onClick={(event) => event.stopPropagation()}
        className="edital-library-modal relative flex max-h-[calc(100vh-1rem)] w-full max-w-7xl flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-2xl dark:border-white/10 dark:bg-zinc-950 sm:max-h-[calc(100vh-2.5rem)]"
      >
        <button type="button" onClick={onClose} className="absolute right-3 top-3 z-20 rounded-xl border border-zinc-200 bg-white/95 p-2 text-zinc-500 shadow-sm backdrop-blur hover:bg-zinc-100 hover:text-zinc-800 dark:border-white/10 dark:bg-zinc-950/95 dark:text-zinc-300 dark:hover:bg-zinc-900 dark:hover:text-white" aria-label="Fechar biblioteca de editais">
          <X size={20} />
        </button>

        <div className="min-h-0 flex-1 overflow-y-auto px-1 pt-2 sm:px-3 sm:pt-3">
          <TelaCatalogo
            modelos={modelos}
            carregando={loading}
            idConfirmado={selectedEdital?.id || null}
            onConfirmar={setSelectedEdital}
            onAbrirSuporte={onMissingEdital}
            cardsClassName="edital-library-cards"
          />
        </div>

        <div className="grid grid-cols-2 gap-2 border-t border-zinc-200 bg-white p-3 dark:border-white/10 dark:bg-zinc-950 sm:grid-cols-3 sm:gap-3 sm:p-4">
          <button
            type="button"
            disabled={!selectedEdital}
            onClick={() => onPreview(selectedEdital)}
            className="flex min-h-11 items-center justify-center gap-1.5 rounded-xl border border-zinc-200 bg-zinc-50 px-2 text-[9px] font-black uppercase text-zinc-700 transition-colors hover:border-red-200 hover:bg-red-50 hover:text-red-700 disabled:cursor-not-allowed disabled:opacity-40 dark:border-white/10 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-red-500/10 sm:text-xs"
          >
            <Eye size={15} /> <span>Visualizar</span>
          </button>
          <button
            type="button"
            disabled={!selectedEdital || Boolean(downloadingId)}
            onClick={() => onDownload(selectedEdital)}
            className="flex min-h-11 items-center justify-center gap-1.5 rounded-xl border border-zinc-200 bg-zinc-50 px-2 text-[9px] font-black uppercase text-zinc-700 transition-colors hover:border-red-200 hover:bg-red-50 hover:text-red-700 disabled:cursor-not-allowed disabled:opacity-40 dark:border-white/10 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-red-500/10 sm:text-xs"
          >
            {downloadingId ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />} <span>Baixar PDF</span>
          </button>
          <button
            type="button"
            disabled={!selectedEdital}
            onClick={() => onCreatePlanning(selectedEdital)}
            className="col-span-2 flex min-h-11 items-center justify-center gap-1.5 rounded-xl bg-zinc-900 px-2 text-[9px] font-black uppercase text-white shadow-lg transition-colors hover:bg-red-600 disabled:cursor-not-allowed disabled:opacity-40 dark:bg-white dark:text-zinc-900 dark:hover:bg-red-600 dark:hover:text-white sm:col-span-1 sm:text-xs"
          >
            <Plus size={15} /> <span>Criar planejamento</span>
          </button>
        </div>
      </motion.div>
    </div>,
    document.body,
  );
};

// ----------------------------------------------------------------------
// COMPONENTE PRINCIPAL
// ----------------------------------------------------------------------
function EditalPage({
  user,
  activeCicloId,
  onStartStudy,
  onBack,              // navega para Painel do Ciclo
  onGoToCronograma,    // navega para página do Cronograma (novo)
  onCreatePlanningFromEdital,
  openLibraryOnMount = false,
  onLibraryOpened,
  initialViewSource,
  editalUpdates,
  onApplyEditalUpdate,
  onDismissEditalUpdate,
  loadingEditalUpdate,
  // Novos props opcionais para suporte ao cronograma
  activeCronogramaId,   // ID do cronograma ativo (pode vir do Dashboard)
}) {
  useForceUnlock();

  // ── Dados do CICLO ────────────────────────────────────────────────────────
  const [ciclo,       setCiclo]       = useState(null);
  const [disciplinas, setDisciplinas] = useState([]);
  const [registros,   setRegistros]   = useState([]);

  // ── Dados do CRONOGRAMA ───────────────────────────────────────────────────
  const [cronograma,             setCronograma]             = useState(null);
  const [registrosCronograma,    setRegistrosCronograma]    = useState([]);

  // ── UI state ──────────────────────────────────────────────────────────────
  const [loading,               setLoading]               = useState(true);
  const [expandedDisciplinas,   setExpandedDisciplinas]   = useState({});
  const [searchTerm,            setSearchTerm]            = useState('');
  const [optimisticChecks,      setOptimisticChecks]      = useState({});
  const [loadingCheck,          setLoadingCheck]          = useState({});
  const [studyModalData,        setStudyModalData]        = useState(null);
  const [dragId,                setDragId]                = useState(null);
  const [overId,                setOverId]                = useState(null);
  const [isSavingOrder,         setIsSavingOrder]         = useState(false);
  const [showInactive,          setShowInactive]          = useState(false);
  const [disciplinaParaExcluir, setDisciplinaParaExcluir] = useState(null);
  const [disciplinaParaRestaurar, setDisciplinaParaRestaurar] = useState(null);
  const [toastMessage,          setToastMessage]          = useState('');
  const [downloadModalOpen,     setDownloadModalOpen]     = useState(false);
  const [pdfScope,              setPdfScope]              = useState(PDF_SCOPE_PLANNING);
  const [pdfFillMode,           setPdfFillMode]           = useState(PDF_FILL_BLANK);
  const [generatingPdf,         setGeneratingPdf]         = useState(false);
  const [libraryModalOpen,      setLibraryModalOpen]      = useState(false);
  const [catalogModels,         setCatalogModels]         = useState(CATALOGO_EDITAIS);
  const [loadingCatalog,        setLoadingCatalog]        = useState(false);
  const [externalEdital,        setExternalEdital]        = useState(null);
  const [downloadingExternalId, setDownloadingExternalId] = useState(null);

  // ── Fonte de visualização: 'ciclo' | 'cronograma' ────────────────────────
  const [viewSource, setViewSource] = useState(initialViewSource === 'cronograma' ? 'cronograma' : 'ciclo');

  const dragIdRef = useRef(null);

  useEffect(() => {
    if (!openLibraryOnMount) return;
    setLibraryModalOpen(true);
    onLibraryOpened?.();
  }, [openLibraryOnMount, onLibraryOpened]);

  useEffect(() => {
    if (!libraryModalOpen) return undefined;
    let active = true;

    const loadCatalog = async () => {
      setLoadingCatalog(true);
      try {
        const snapshot = await getDocs(collection(db, 'editais_templates'));
        const firestoreTemplates = snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
        const firestoreMap = new Map(firestoreTemplates.map((item) => [String(item.id), item]));
        const local = CATALOGO_EDITAIS
          .filter((item) => !firestoreMap.get(String(item.id))?.deleted)
          .map((item) => {
            const stored = firestoreMap.get(String(item.id));
            if (!stored) return item;
            firestoreMap.delete(String(item.id));
            return { ...item, ...stored, logo: stored.logoUrl || stored.logo || item.logo };
          });
        const custom = Array.from(firestoreMap.values())
          .filter((item) => !item.deleted)
          .map((item) => ({ ...item, logo: item.logoUrl || item.logo, ativo: item.ativo !== false }));
        if (active) setCatalogModels([...local, ...custom]);
      } catch (error) {
        console.warn('Nao foi possivel atualizar o catalogo de editais:', error);
        if (active) setCatalogModels(CATALOGO_EDITAIS);
      } finally {
        if (active) setLoadingCatalog(false);
      }
    };

    loadCatalog();
    return () => { active = false; };
  }, [libraryModalOpen]);

  // Pending update do edital (apenas para ciclo)
  const pendingUpdate = useMemo(() => {
    return (editalUpdates || []).find(u => u.cicloId === activeCicloId && !u.isDismissed);
  }, [editalUpdates, activeCicloId]);

  // ── Subscription: CICLO ───────────────────────────────────────────────────
  useEffect(() => {
    if (!user || !activeCicloId) { setLoading(false); return; }

    let unsubCiclo = () => {};
    let unsubDisc  = () => {};
    let unsubReg   = () => {};

    setLoading(true);

    unsubCiclo = onSnapshot(doc(db, 'users', user.uid, 'ciclos', activeCicloId), (docSnap) => {
      if (!docSnap.exists()) return;
      const data = docSnap.data();
      setCiclo({ id: docSnap.id, ...data, computedLogo: getLogo(data) });
    });

    unsubDisc = onSnapshot(
      query(collection(db, 'users', user.uid, 'ciclos', activeCicloId, 'disciplinas')),
      (snapshot) => {
        const lista = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        lista.sort((a, b) => {
          const iA = a.index !== undefined ? Number(a.index) : 9999;
          const iB = b.index !== undefined ? Number(b.index) : 9999;
          return iA !== iB ? iA - iB : (a.nome || '').localeCompare(b.nome || '');
        });
        setDisciplinas(lista);
        setLoading(false);
      }
    );

    unsubReg = onSnapshot(
      query(collection(db, 'users', user.uid, 'registrosEstudo'), where('cicloId', '==', activeCicloId)),
      (snapshot) => setRegistros(snapshot.docs.map(d => ({ id: d.id, ...d.data() })))
    );

    return () => { unsubCiclo(); unsubDisc(); unsubReg(); };
  }, [user, activeCicloId]);

  // ── Subscription: CRONOGRAMA ──────────────────────────────────────────────
  useEffect(() => {
    if (!user) return;

    let unsubCrono = () => {};
    let unsubRegC  = () => {};

    // Se recebemos um cronogramaId explícito, usamos ele;
    // caso contrário, ouvimos o cronograma ativo do usuário.
    if (activeCronogramaId) {
      unsubCrono = onSnapshot(
        doc(db, 'users', user.uid, 'cronogramas', activeCronogramaId),
        (docSnap) => {
          if (!docSnap.exists()) { setCronograma(null); return; }
          const data = docSnap.data();
          setCronograma({ id: docSnap.id, ...data, computedLogo: getCronogramaLogo(data) });
        }
      );
    } else {
      // Busca o cronograma ativo automaticamente
      const q = query(
        collection(db, 'users', user.uid, 'cronogramas'),
        where('ativo', '==', true)
      );
      unsubCrono = onSnapshot(q, (snap) => {
        if (snap.empty) { setCronograma(null); return; }
        const docs = snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(d => d.arquivado !== true);
        const maisRecente = docs.sort((a, b) => {
          const tA = a.criadoEm?.seconds || a.dataCriacao?.seconds || a.createdAt?.seconds || 0;
          const tB = b.criadoEm?.seconds || b.dataCriacao?.seconds || b.createdAt?.seconds || 0;
          return tB - tA;
        })[0];
        if (!maisRecente) { setCronograma(null); return; }
        setCronograma({ ...maisRecente, computedLogo: getCronogramaLogo(maisRecente) });
      });
    }

    // Registros de estudo vinculados ao cronograma (por cronogramaId OU sem cicloId, mas com disciplinaNome)
    // Para o cronograma usamos registros que têm cronogramaId ou são gerais (sem cicloId)
    // A estratégia mais robusta: ouvir todos os registros e filtrar no useMemo.
    unsubRegC = onSnapshot(
      collection(db, 'users', user.uid, 'registrosEstudo'),
      (snapshot) => setRegistrosCronograma(snapshot.docs.map(d => ({ id: d.id, ...d.data() })))
    );

    return () => { unsubCrono(); unsubRegC(); };
  }, [user, activeCronogramaId]);

  // ── Decide se há dois editais distintos ───────────────────────────────────
  const cicloEditalId     = ciclo ? getTemplateIdDoCiclo(ciclo) : null;
  const cronogramaEditalId = cronograma
    ? (cronograma.editalId || cronograma.templateId || 'cronograma')
    : null;

  // Mostra o toggle quando ambos existem e têm editais (potencialmente diferentes)
  const showToggle = !!(ciclo && cronograma);

  // Se só tiver cronograma (sem ciclo ativo), força view = cronograma
  useEffect(() => {
    if (!activeCicloId && cronograma) setViewSource('cronograma');
    else if (activeCicloId && !cronograma) setViewSource('ciclo');
  }, [activeCicloId, cronograma]);

  useEffect(() => {
    if (initialViewSource === 'cronograma' && cronograma) setViewSource('cronograma');
    else if (initialViewSource === 'ciclo' && ciclo) setViewSource('ciclo');
  }, [initialViewSource, cronograma?.id, ciclo?.id]);

  // ── Dados derivados do CRONOGRAMA ─────────────────────────────────────────
  const disciplinasCronograma = useMemo(() => {
    return getDisciplinasDoCronograma(cronograma);
  }, [cronograma]);

  // Registros filtrados para o cronograma:
  // Usa registros com cronogramaId igual OU registros de qualquer ciclo
  // (para capturar estudos feitos via timer que registram por disciplinaNome)
  const registrosCronoFiltrados = useMemo(() => {
    if (!cronograma) return [];
    const cronoId = cronograma.id;
    return registrosCronograma.filter(r => String(r.cronogramaId || '') === String(cronoId || ''));
  }, [registrosCronograma, cronograma]);

  // ── useMemo: processa edital do CICLO ─────────────────────────────────────
  const { editalProcessado: editalCiclo, inactiveDisciplines: inactiveCiclo, statsGlobal: statsCiclo } = useMemo(() => {
    if (!disciplinas.length) return { editalProcessado: [], inactiveDisciplines: [], statsGlobal: { total: 0, concluidos: 0, percentual: 0 } };

    const mapaDetalhado = {}; const statsPorDisc = {};

    registros.forEach(reg => {
      if (!statsPorDisc[reg.disciplinaNome]) statsPorDisc[reg.disciplinaNome] = { acertos: 0, questoes: 0, lastDate: null, minutes: 0 };
      const s = statsPorDisc[reg.disciplinaNome];
      s.acertos += Number(reg.acertos || 0); s.questoes += Number(reg.questoesFeitas || 0); s.minutes += Number(reg.tempoEstudadoMinutos || 0);
      if (!s.lastDate || reg.data > s.lastDate) s.lastDate = reg.data;

      if (reg.assunto) {
        const key = `${reg.disciplinaNome}-${reg.assunto}`.toLowerCase().trim();
        if (!mapaDetalhado[key]) mapaDetalhado[key] = { count: 0, minutes: 0, questions: 0, correct: 0, lastDate: null, hasManualCheck: false };
        if (isRegistroRevisao(reg)) mapaDetalhado[key].count += 1;
        mapaDetalhado[key].minutes += Number(reg.tempoEstudadoMinutos || 0);
        mapaDetalhado[key].questions += Number(reg.questoesFeitas || 0);
        mapaDetalhado[key].correct += Number(reg.acertos || 0);
        if (reg.tipoEstudo === 'check_manual') mapaDetalhado[key].hasManualCheck = true;
        if (!mapaDetalhado[key].lastDate || reg.data > mapaDetalhado[key].lastDate) mapaDetalhado[key].lastDate = reg.data;
      }
    });

    let totalTopicosG = 0, totalConcluidosG = 0;

    const listaCompleta = disciplinas.map(disc => {
      const listaAssuntos = Array.isArray(disc.assuntos) ? disc.assuntos : [];
      const sd = statsPorDisc[disc.nome] || { acertos: 0, questoes: 0, lastDate: null, minutes: 0 };
      const desempenho = sd.questoes > 0 ? Math.round((sd.acertos / sd.questoes) * 100) : 0;

      const assuntosProc = listaAssuntos
        .filter(item => !(typeof item === 'object' && item.inCiclo === false))
        .map(item => {
          const nomeA = typeof item === 'string' ? item : item.nome;
          const relev = typeof item === 'object' ? (item.relevancia || 1) : 1;
          const key = `${disc.nome}-${nomeA}`.toLowerCase().trim();
          const db_data = mapaDetalhado[key]; const optim = optimisticChecks[key];
          return {
            nome: nomeA, relevancia: relev,
            estudado: optim !== undefined ? optim : !!db_data?.hasManualCheck,
            qtdVezes: db_data?.count || 0, minutos: db_data?.minutes || 0,
            questoes: db_data?.questions || 0, acertos: db_data?.correct || 0,
            inCiclo: true,
            isNew: pendingUpdate?.diff?.novosAssuntoKeys?.has(`${disc.id}-${normalize(nomeA)}`),
          };
        });

      const total = assuntosProc.length; const concl = assuntosProc.filter(a => a.estudado).length;
      totalTopicosG += total; totalConcluidosG += concl;

      return {
        ...disc, assuntos: assuntosProc,
        progresso: total > 0 ? (concl / total) * 100 : 0,
        totalAssuntos: total, concluidos: concl,
        inCiclo: disc.inCiclo !== false,
        isNew: pendingUpdate?.diff?.novosDiscIds?.has(disc.id),
        stats: { desempenho, questoes: sd.questoes, ultimaData: sd.lastDate, minutos: sd.minutes },
      };
    });

    return {
      editalProcessado: listaCompleta.filter(d => d.inCiclo),
      inactiveDisciplines: listaCompleta.filter(d => !d.inCiclo),
      statsGlobal: { total: totalTopicosG, concluidos: totalConcluidosG, percentual: totalTopicosG > 0 ? (totalConcluidosG / totalTopicosG) * 100 : 0 }
    };
  }, [disciplinas, registros, optimisticChecks, pendingUpdate]);

  // ── useMemo: processa edital do CRONOGRAMA ────────────────────────────────
  const { editalProcessado: editalCrono, inactiveDisciplines: inactiveCrono, statsGlobal: statsCrono } = useMemo(() => {
    if (!disciplinasCronograma.length) return { editalProcessado: [], inactiveDisciplines: [], statsGlobal: { total: 0, concluidos: 0, percentual: 0 } };

    const mapaDetalhado = {}; const statsPorDisc = {};

    registrosCronoFiltrados.forEach(reg => {
      const discNome = reg.disciplinaNome || '';
      if (!statsPorDisc[discNome]) statsPorDisc[discNome] = { acertos: 0, questoes: 0, lastDate: null, minutes: 0 };
      const s = statsPorDisc[discNome];
      s.acertos += Number(reg.acertos || 0); s.questoes += Number(reg.questoesFeitas || 0); s.minutes += Number(reg.tempoEstudadoMinutos || 0);
      if (!s.lastDate || reg.data > s.lastDate) s.lastDate = reg.data;

      if (reg.assunto) {
        const key = `${discNome}-${reg.assunto}`.toLowerCase().trim();
        if (!mapaDetalhado[key]) mapaDetalhado[key] = { count: 0, minutes: 0, questions: 0, correct: 0, lastDate: null, hasManualCheck: false };
        if (isRegistroRevisao(reg)) mapaDetalhado[key].count += 1;
        mapaDetalhado[key].minutes += Number(reg.tempoEstudadoMinutos || 0);
        mapaDetalhado[key].questions += Number(reg.questoesFeitas || 0);
        mapaDetalhado[key].correct += Number(reg.acertos || 0);
        if (reg.tipoEstudo === 'check_manual') mapaDetalhado[key].hasManualCheck = true;
        if (!mapaDetalhado[key].lastDate || reg.data > mapaDetalhado[key].lastDate) mapaDetalhado[key].lastDate = reg.data;
      }
    });

    // Também conta progresso das tarefas concluídas no cronograma (slots concluídos)
    // para enriquecer os stats de tempo mesmo sem registrosEstudo explícitos
    const progressoCrono = cronograma?.progresso || {};

    let totalTopicosG = 0, totalConcluidosG = 0;

    const listaCompleta = disciplinasCronograma.map(disc => {
      const listaAssuntos = Array.isArray(disc.assuntos) ? disc.assuntos : [];
      const sd = statsPorDisc[disc.nome] || { acertos: 0, questoes: 0, lastDate: null, minutes: 0 };
      const desempenho = sd.questoes > 0 ? Math.round((sd.acertos / sd.questoes) * 100) : 0;

      const assuntosProc = listaAssuntos
        .filter(item => !(typeof item === 'object' && item.inCiclo === false))
        .map(item => {
          const nomeA = typeof item === 'string' ? item : item.nome;
          const relev = typeof item === 'object' ? (item.relevancia || 1) : 1;
          const key = `${disc.nome}-${nomeA}`.toLowerCase().trim();
          const db_data = mapaDetalhado[key];
          const optimKey = `crono-${key}`;
          const optim = optimisticChecks[optimKey];

          // Verifica se o assunto foi estudado via check manual OU via slots concluídos do cronograma
          const estudadoViaRegistro = optim !== undefined ? optim : !!db_data?.hasManualCheck;

          return {
            nome: nomeA, relevancia: relev,
            estudado: estudadoViaRegistro,
            qtdVezes: db_data?.count || 0, minutos: db_data?.minutes || 0,
            questoes: db_data?.questions || 0, acertos: db_data?.correct || 0,
            inCiclo: true, isNew: false,
          };
        });

      const total = assuntosProc.length; const concl = assuntosProc.filter(a => a.estudado).length;
      const inCiclo = disc.inCiclo !== false;
      if (inCiclo) {
        totalTopicosG += total;
        totalConcluidosG += concl;
      }

      return {
        ...disc, assuntos: assuntosProc,
        progresso: total > 0 ? (concl / total) * 100 : 0,
        totalAssuntos: total, concluidos: concl,
        inCiclo, isNew: false,
        stats: { desempenho, questoes: sd.questoes, ultimaData: sd.lastDate, minutos: sd.minutes },
      };
    });

    return {
      editalProcessado: listaCompleta.filter(d => d.inCiclo),
      inactiveDisciplines: listaCompleta.filter(d => !d.inCiclo),
      statsGlobal: { total: totalTopicosG, concluidos: totalConcluidosG, percentual: totalTopicosG > 0 ? (totalConcluidosG / totalTopicosG) * 100 : 0 }
    };
  }, [disciplinasCronograma, registrosCronoFiltrados, optimisticChecks, cronograma]);

  // ── Seleciona dados da fonte ativa ────────────────────────────────────────
  const isCronoView = viewSource === 'cronograma';
  const isExternalPreview = Boolean(externalEdital);
  const externalDisciplines = useMemo(() => prepareExternalEditalDisciplines(externalEdital), [externalEdital]);
  const editalFonteAtivo = isExternalPreview ? externalDisciplines : (isCronoView ? editalCrono : editalCiclo);
  const statsAtivos = isExternalPreview
    ? { total: 0, concluidos: 0, percentual: 0 }
    : (isCronoView ? statsCrono : statsCiclo);
  const inativeFonteAtiva = isExternalPreview ? [] : (isCronoView ? inactiveCrono : inactiveCiclo);
  const activeSearchResult = useMemo(
    () => filterEditalDisciplines(editalFonteAtivo, searchTerm),
    [editalFonteAtivo, searchTerm],
  );
  const inactiveSearchResult = useMemo(
    () => filterEditalDisciplines(inativeFonteAtiva, searchTerm),
    [inativeFonteAtiva, searchTerm],
  );
  const editalAtivo = activeSearchResult.disciplines;
  const inativeAtivos = inactiveSearchResult.disciplines;
  const autoExpandedNames = useMemo(
    () => new Set(activeSearchResult.autoExpandedNames),
    [activeSearchResult.autoExpandedNames],
  );

  // Logo e nome do header
  const logoAtivo = isExternalPreview
    ? (externalEdital?.logoUrl || externalEdital?.logo || null)
    : (isCronoView ? cronograma?.computedLogo : ciclo?.computedLogo);
  const nomeAtivo = isExternalPreview
    ? (externalEdital?.titulo || externalEdital?.nome || 'Edital verticalizado')
    : (isCronoView ? (cronograma?.nome || 'Cronograma') : (ciclo?.nome || 'Missão Sem Nome'));
  const labelAtivo = isCronoView ? 'Cronograma Ativo' : 'Ciclo Ativo';

  // ── Handlers de drag (só funciona no ciclo) ───────────────────────────────
  const handleDragStart = (e, id) => { dragIdRef.current = id; setDragId(id); e.dataTransfer.effectAllowed = 'move'; };
  const handleDragOver  = (e, id) => { e.preventDefault(); if (id !== dragIdRef.current) setOverId(id); };
  const handleDragLeave = (e)     => { if (!e.currentTarget.contains(e.relatedTarget)) setOverId(null); };
  const handleDragEnd   = ()      => { dragIdRef.current = null; setDragId(null); setOverId(null); };

  const handleDrop = async (e, targetId) => {
    if (isCronoView) return; // drag-reorder só no ciclo
    e.preventDefault();
    const sourceId = dragIdRef.current;
    setDragId(null); setOverId(null); dragIdRef.current = null;
    if (!sourceId || sourceId === targetId) return;

    const list = [...disciplinas];
    const srcIdx = list.findIndex(d => d.id === sourceId);
    const tgtIdx = list.findIndex(d => d.id === targetId);
    if (srcIdx === -1 || tgtIdx === -1) return;

    const [removed] = list.splice(srcIdx, 1);
    list.splice(tgtIdx, 0, removed);
    setDisciplinas(list);
    setIsSavingOrder(true);

    try {
      const batch = writeBatch(db);
      list.forEach((disc, idx) => {
        if (disc.index !== idx)
          batch.update(doc(db, 'users', user.uid, 'ciclos', activeCicloId, 'disciplinas', disc.id), { index: idx });
      });
      await batch.commit();
    } catch (err) { console.error('Erro ao salvar ordem:', err); }
    finally { setIsSavingOrder(false); }
  };

  const handleUpdateEdital = async () => {
    if (pendingUpdate && onApplyEditalUpdate) await onApplyEditalUpdate(pendingUpdate);
  };

  const handleIgnorarUpdate = () => {
    if (pendingUpdate && onDismissEditalUpdate) onDismissEditalUpdate(pendingUpdate.cicloId, pendingUpdate.versionKey);
  };

  const handleConfirmRestoreDisciplina = async () => {
    const disc = disciplinaParaRestaurar;
    if (!user || !disc) return;
    try {
      if (isCronoView) {
        if (!cronograma?.id || !Array.isArray(cronograma.disciplinasSnapshot)) return;
        const disciplinasSnapshot = cronograma.disciplinasSnapshot.map((item, idx) => {
          const itemId = item.id || `crono-disc-${idx}`;
          const sameId = String(itemId) === String(disc.id);
          const sameName = normalize(item.nome || item.disciplinaNome) === normalize(disc.nome);
          return sameId || sameName ? { ...item, inCiclo: true } : item;
        });
        await updateDoc(doc(db, 'users', user.uid, 'cronogramas', cronograma.id), { disciplinasSnapshot });
        setDisciplinaParaRestaurar(null);
        setShowInactive(false);
        setToastMessage('Disciplina restaurada. Recalcule o cronograma para incluir na rotina.');
        onGoToCronograma?.({ initialEditMode: 'recalculate' });
        return;
      }

      if (!activeCicloId) return;
      await updateDoc(doc(db, 'users', user.uid, 'ciclos', activeCicloId, 'disciplinas', disc.id), { inCiclo: true });
      setDisciplinaParaRestaurar(null);
    } catch (err) {
      console.error("Erro ao restaurar disciplina", err);
      setToastMessage('Erro ao restaurar disciplina. Tente novamente.');
    }
  };

  const handleHardDeleteDisciplina = async (disc) => {
    if (!user || !activeCicloId) return;
    try {
      await deleteDoc(doc(db, 'users', user.uid, 'ciclos', activeCicloId, 'disciplinas', disc.id));
      setDisciplinaParaExcluir(null);
    } catch (err) {
      console.error("Erro ao excluir disciplina", err);
      setToastMessage('Erro ao excluir disciplina. Tente novamente.');
    }
  };

  // ── Toggle check de assunto ───────────────────────────────────────────────
  const handleToggleCheck = async (disciplinaId, disciplinaNome, assuntoNome, estadoAtual) => {
    // Para ciclo: chave normal. Para cronograma: prefixo "crono-"
    const key = isCronoView
      ? `crono-${disciplinaNome}-${assuntoNome}`.toLowerCase().trim()
      : `${disciplinaNome}-${assuntoNome}`.toLowerCase().trim();

    setOptimisticChecks(prev => ({ ...prev, [key]: !estadoAtual }));
    setLoadingCheck(prev => ({ ...prev, [key]: true }));

    try {
      if (!estadoAtual) {
        const payload = {
          disciplinaId,
          disciplinaNome,
          assunto: assuntoNome,
          data: new Date().toISOString().split('T')[0],
          timestamp: serverTimestamp(),
          tempoEstudadoMinutos: 0,
          questoesFeitas: 0,
          acertos: 0,
          tipoEstudo: 'check_manual',
          obs: 'Check Manual',
        };
        if (isCronoView) {
          payload.cronogramaId = cronograma?.id;
        } else {
          payload.cicloId = activeCicloId;
        }
        await addDoc(collection(db, 'users', user.uid, 'registrosEstudo'), payload);
      } else {
        // Remove o check manual correspondente
        const constraints = [
          where('assunto', '==', assuntoNome),
          where('tipoEstudo', '==', 'check_manual'),
        ];
        if (isCronoView) {
          constraints.push(where('cronogramaId', '==', cronograma?.id));
        } else {
          constraints.push(where('cicloId', '==', activeCicloId));
        }
        const q = query(collection(db, 'users', user.uid, 'registrosEstudo'), ...constraints);
        const snap = await getDocs(q);
        const doc_ = snap.docs.find(d => normalize(d.data().disciplinaNome) === normalize(disciplinaNome));
        if (doc_) await deleteDoc(doc_.ref);
        else {
          // Fallback sem filtro de ciclo/cronograma
          const q2 = query(collection(db, 'users', user.uid, 'registrosEstudo'), where('assunto', '==', assuntoNome));
          const snap2 = await getDocs(q2);
          const doc2 = snap2.docs.find(d => normalize(d.data().disciplinaNome) === normalize(disciplinaNome) && d.data().tipoEstudo === 'check_manual');
          if (doc2) await deleteDoc(doc2.ref);
        }
      }
      setOptimisticChecks(prev => { const s = { ...prev }; delete s[key]; return s; });
    } catch {
      setOptimisticChecks(prev => ({ ...prev, [key]: estadoAtual }));
      setToastMessage('Erro de conexao. Tente novamente.');
    } finally {
      setLoadingCheck(prev => ({ ...prev, [key]: false }));
    }
  };

  const toggleDisciplina      = (nome) => setExpandedDisciplinas(prev => ({ ...prev, [nome]: !prev[nome] }));
  const confirmStartStudy     = (disc, assunto) => { if (onStartStudy) { onStartStudy(disc, assunto, { defaultContext: 'ciclo' }); setStudyModalData(null); } };
  const handleStartTopicStudy = (disc, nome) => setStudyModalData({ disciplina: disc, assunto: nome });

  const handleGenerateEditalPdf = async () => {
    if (generatingPdf) return;
    setGeneratingPdf(true);
    setToastMessage('');

    try {
      const sourcePlan = isCronoView ? cronograma : ciclo;
      const templateId = isCronoView ? cronogramaEditalId : cicloEditalId;
      let templateData = null;
      let usedSavedFallback = false;
      const catalogTemplate = CATALOGO_EDITAIS.find((item) => String(item.id) === String(templateId));

      if (templateId && !['manual', 'cronograma'].includes(String(templateId))) {
        try {
          const templateSnap = await getDoc(doc(db, 'editais_templates', String(templateId)));
          if (templateSnap.exists()) templateData = { id: templateSnap.id, ...templateSnap.data() };
        } catch (error) {
          console.warn('Nao foi possivel carregar o template oficial para o PDF:', error);
        }
      }

      const storedDisciplines = [...editalFonteAtivo, ...inativeFonteAtiva];
      let sourceDisciplines = editalFonteAtivo;
      if (pdfScope === PDF_SCOPE_COMPLETE) {
        const officialDisciplines = templateData?.disciplinas || catalogTemplate?.disciplinas;
        if (Array.isArray(officialDisciplines) && officialDisciplines.length > 0) {
          sourceDisciplines = officialDisciplines;
        } else {
          sourceDisciplines = storedDisciplines;
          usedSavedFallback = true;
        }
      }

      const preparedDisciplines = prepareEditalVerticalizadoDisciplines({
        sourceDisciplines,
        progressDisciplines: storedDisciplines,
        scope: pdfScope,
        fillMode: pdfFillMode,
      });
      const editalName = templateData?.titulo
        || templateData?.nome
        || catalogTemplate?.titulo
        || catalogTemplate?.nome
        || sourcePlan?.editalNome
        || sourcePlan?.concursoNome
        || nomeAtivo;
      const editalCargo = templateData?.cargo
        || catalogTemplate?.cargo
        || sourcePlan?.cargo
        || sourcePlan?.cargoNome
        || '';

      await downloadEditalVerticalizadoPdf({
        edital: { ...sourcePlan, ...templateData, nome: editalName, cargo: editalCargo },
        disciplinas: preparedDisciplines,
        scope: pdfScope,
        fillMode: pdfFillMode,
        logos: {
          edital: templateData?.logoUrl || templateData?.logo || catalogTemplate?.logoUrl || catalogTemplate?.logo || logoAtivo,
          system: '/logoModoQAP.png',
        },
      });

      setDownloadModalOpen(false);
      setToastMessage(usedSavedFallback
        ? 'PDF gerado com o conteudo salvo no planejamento. O template oficial completo nao estava disponivel.'
        : 'Edital verticalizado baixado com sucesso.');
    } catch (error) {
      console.error('Erro ao gerar edital verticalizado:', error);
      setToastMessage(error?.message || 'Nao foi possivel gerar o PDF. Tente novamente.');
    } finally {
      setGeneratingPdf(false);
    }
  };

  // ── Early returns ─────────────────────────────────────────────────────────
  const handlePreviewCatalogEdital = (edital) => {
    if (!edital) return;
    setExternalEdital(edital);
    setLibraryModalOpen(false);
    setSearchTerm('');
    setExpandedDisciplinas({});
    setShowInactive(false);
  };

  const handleDownloadCatalogEdital = async (edital) => {
    if (!edital || downloadingExternalId) return;
    setDownloadingExternalId(edital.id || 'external');
    setToastMessage('');
    try {
      const preparedDisciplines = prepareEditalVerticalizadoDisciplines({
        sourceDisciplines: edital.disciplinas || [],
        progressDisciplines: [],
        scope: PDF_SCOPE_COMPLETE,
        fillMode: PDF_FILL_BLANK,
      });
      await downloadEditalVerticalizadoPdf({
        edital,
        disciplinas: preparedDisciplines,
        scope: PDF_SCOPE_COMPLETE,
        fillMode: PDF_FILL_BLANK,
        logos: {
          edital: edital.logoUrl || edital.logo || null,
          system: '/logoModoQAP.png',
        },
      });
      setToastMessage('Edital verticalizado baixado com sucesso.');
    } catch (error) {
      console.error('Erro ao baixar edital do catalogo:', error);
      setToastMessage(error?.message || 'Nao foi possivel gerar o PDF deste edital.');
    } finally {
      setDownloadingExternalId(null);
    }
  };

  const handleCreatePlanningWithCatalogEdital = (edital) => {
    if (!edital || !onCreatePlanningFromEdital) return;
    setLibraryModalOpen(false);
    onCreatePlanningFromEdital(edital);
  };

  const handleReturnToActiveEdital = () => {
    setExternalEdital(null);
    setSearchTerm('');
    setExpandedDisciplinas({});
    setShowInactive(false);
  };

  if (loading) return (
    <div className="flex h-96 items-center justify-center">
      <div className="animate-spin w-8 h-8 border-4 border-red-600 rounded-full border-t-transparent" />
    </div>
  );

  const noCiclo     = !activeCicloId || !ciclo;
  const noCronograma = !cronograma;

  if (noCiclo && noCronograma && !isExternalPreview) return (
    <>
      <AnimatePresence>
        {libraryModalOpen && (
          <EditalLibraryModal
            open={libraryModalOpen}
            modelos={catalogModels}
            loading={loadingCatalog}
            downloadingId={downloadingExternalId}
            onClose={() => setLibraryModalOpen(false)}
            onPreview={handlePreviewCatalogEdital}
            onDownload={handleDownloadCatalogEdital}
            onCreatePlanning={handleCreatePlanningWithCatalogEdital}
            onMissingEdital={() => setToastMessage('Use o canal de feedback para solicitar a inclusao de um novo edital.')}
          />
        )}
      </AnimatePresence>
      <div className="flex min-h-[calc(100vh-120px)] w-full items-center justify-center px-4 py-10">
      <motion.div
        initial={{ opacity: 0, y: 30, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        className="group relative w-full max-w-2xl overflow-hidden rounded-[40px] border border-zinc-200 bg-white p-8 text-center shadow-[0_30px_100px_rgba(0,0,0,0.06)] dark:border-white/10 dark:bg-zinc-950 dark:shadow-[0_30px_100px_rgba(0,0,0,0.3)] sm:px-12 sm:pb-9 sm:pt-12"
      >
        {/* Decorative background elements */}
        <div className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-red-500/5 blur-[80px] transition-all duration-700 group-hover:bg-red-500/10" />
        <div className="pointer-events-none absolute -bottom-20 -left-20 h-64 w-64 rounded-full bg-zinc-500/5 blur-[80px] transition-all duration-700 group-hover:bg-zinc-500/10" />

        <div className="relative z-10 flex flex-col items-center">
          <div className="relative mb-8">
            <div className="absolute inset-0 animate-ping rounded-full bg-red-500/20 opacity-40 duration-[3s]" />
            <div className="relative flex h-24 w-24 items-center justify-center rounded-[32px] bg-gradient-to-br from-red-600 to-rose-700 text-white shadow-2xl shadow-red-500/30 sm:h-28 sm:w-28">
              <LayoutList size={48} strokeWidth={1.5} />
            </div>
            <div className="absolute -bottom-2 -right-2 flex h-10 w-10 items-center justify-center rounded-2xl bg-white text-red-600 shadow-xl dark:bg-zinc-900 dark:text-red-400">
              <Zap size={20} fill="currentColor" />
            </div>
          </div>

          <p className="text-[11px] font-black uppercase tracking-[0.4em] text-red-600 dark:text-red-400">
            Edital Verticalizado
          </p>
          
          <h2 className="mt-4 text-3xl font-black uppercase tracking-tight text-zinc-900 dark:text-white sm:text-4xl">
            Nenhum planejamento <span className="bg-gradient-to-r from-red-600 to-rose-600 bg-clip-text text-transparent">ativo</span>
          </h2>
          
          <p className="mt-6 max-w-md text-base font-medium leading-relaxed text-zinc-500 dark:text-zinc-400">
            Seu edital está aguardando um plano ativo. Ative um cronograma ou ciclo de estudos para visualizar o conteúdo detalhado e acompanhar seu progresso.
          </p>

          <div className="mt-10 flex flex-col items-center gap-3 sm:flex-row">
            <button type="button" onClick={() => setLibraryModalOpen(true)} className="group/btn relative flex h-14 items-center gap-3 overflow-hidden rounded-2xl bg-red-600 px-8 text-xs font-black uppercase tracking-[0.16em] text-white shadow-2xl transition-all hover:scale-105 hover:bg-red-700 active:scale-95">
              <Library size={17} /> Outros editais
            </button>
            <button type="button" onClick={onBack} className="group/btn relative flex h-14 items-center gap-3 overflow-hidden rounded-2xl bg-zinc-950 px-8 text-xs font-black uppercase tracking-[0.16em] text-white shadow-2xl transition-all hover:scale-105 hover:bg-red-600 active:scale-95 dark:bg-white dark:text-zinc-950 dark:hover:bg-red-500 dark:hover:text-white">
              <span className="relative z-10 flex items-center gap-2">Ir para Planejamento <ArrowLeftRight size={16} /></span>
            </button>
          </div>
          <div className="mt-3">
            <img
              src="/logoModoQAP.png"
              alt="Logo Modo QAP"
              className="h-8 w-auto object-contain opacity-90 transition-opacity duration-300 group-hover:opacity-100"
            />
          </div>
        </div>
      </motion.div>
      </div>
    </>
  );

  // Se está em view cronograma mas não tem dados relevantes no edital
  // (cronograma sem disciplinasSnapshot nem semanaTemplate), mostra aviso
  const semDadosCrono = !isExternalPreview && isCronoView && editalCrono.length === 0 && inactiveCrono.length === 0 && !searchTerm;

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="mobile-page-zoom mobile-page-zoom--edital desktop-page-zoom desktop-page-zoom--edital w-full space-y-3 animate-fade-in pb-24">
      <AnimatePresence>
        {toastMessage && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="fixed left-1/2 top-4 z-[90] flex w-[calc(100%-2rem)] max-w-md -translate-x-1/2 items-center gap-3 rounded-2xl border border-red-200 bg-white px-4 py-3 text-sm font-bold text-red-700 shadow-2xl shadow-red-900/10 dark:border-red-900/40 dark:bg-zinc-950 dark:text-red-300"
          >
            <AlertTriangle size={18} className="shrink-0" />
            <span>{toastMessage}</span>
            <button onClick={() => setToastMessage('')} className="ml-auto rounded-lg px-2 py-1 text-[10px] uppercase tracking-wider text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30">Ok</button>
          </motion.div>
        )}

        {disciplinaParaExcluir && (
          <div className="fixed inset-0 z-[95] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm" onClick={() => setDisciplinaParaExcluir(null)}>
            <motion.div
              initial={{ opacity: 0, scale: 0.94, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.94, y: 12 }}
              className="w-full max-w-md overflow-hidden rounded-3xl border border-red-200 bg-white shadow-2xl dark:border-red-900/40 dark:bg-zinc-950"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="border-b border-red-100 bg-red-50 p-6 text-center dark:border-red-900/30 dark:bg-red-950/20">
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-red-600 text-white shadow-lg shadow-red-600/25">
                  <Trash2 size={28} />
                </div>
                <h3 className="text-lg font-black uppercase text-zinc-900 dark:text-white">Excluir disciplina?</h3>
                <p className="mt-2 text-sm font-medium text-zinc-600 dark:text-zinc-400">
                  Isso apaga "{disciplinaParaExcluir.nome}" permanentemente deste ciclo.
                </p>
              </div>
              <div className="grid grid-cols-2 gap-3 p-5">
                <button onClick={() => setDisciplinaParaExcluir(null)} className="rounded-2xl bg-zinc-100 px-4 py-3 text-xs font-black uppercase tracking-wider text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-200">
                  Cancelar
                </button>
                <button onClick={() => handleHardDeleteDisciplina(disciplinaParaExcluir)} className="rounded-2xl bg-red-600 px-4 py-3 text-xs font-black uppercase tracking-wider text-white shadow-lg shadow-red-600/25 hover:bg-red-700">
                  Excluir
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {disciplinaParaRestaurar && (
          <div className="fixed inset-0 z-[95] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm" onClick={() => setDisciplinaParaRestaurar(null)}>
            <motion.div
              initial={{ opacity: 0, scale: 0.94, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.94, y: 12 }}
              className="w-full max-w-md overflow-hidden rounded-3xl border border-amber-200 bg-white shadow-2xl dark:border-amber-900/40 dark:bg-zinc-950"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="border-b border-amber-100 bg-amber-50 p-6 text-center dark:border-amber-900/30 dark:bg-amber-950/20">
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-500 text-white shadow-lg shadow-amber-600/25">
                  <RefreshCw size={28} />
                </div>
                <h3 className="text-lg font-black uppercase text-zinc-900 dark:text-white">Restaurar disciplina?</h3>
                <p className="mt-2 text-sm font-medium text-zinc-600 dark:text-zinc-400">
                  Restaurar "{disciplinaParaRestaurar.nome}" impacta o {isCronoView ? 'cronograma' : 'ciclo'} atual. Para entrar na rotina, o planejamento precisa ser recalculado.
                </p>
              </div>
              <div className="grid grid-cols-2 gap-3 p-5">
                <button onClick={() => setDisciplinaParaRestaurar(null)} className="rounded-2xl bg-zinc-100 px-4 py-3 text-xs font-black uppercase tracking-wider text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-200">
                  Cancelar
                </button>
                <button onClick={handleConfirmRestoreDisciplina} className="rounded-2xl bg-amber-500 px-4 py-3 text-xs font-black uppercase tracking-wider text-white shadow-lg shadow-amber-600/25 hover:bg-amber-600">
                  {isCronoView ? 'Restaurar e recalcular' : 'Restaurar'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {studyModalData && (
        <StartStudyModal
          disciplina={studyModalData.disciplina}
          assunto={studyModalData.assunto}
          onClose={() => setStudyModalData(null)}
          onConfirm={confirmStartStudy}
        />
      )}

      <AnimatePresence>
        {downloadModalOpen && !isExternalPreview && (
          <DownloadEditalModal
            open={downloadModalOpen}
            editalNome={nomeAtivo}
            scope={pdfScope}
            fillMode={pdfFillMode}
            generating={generatingPdf}
            onScopeChange={setPdfScope}
            onFillModeChange={setPdfFillMode}
            onClose={() => !generatingPdf && setDownloadModalOpen(false)}
            onGenerate={handleGenerateEditalPdf}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {libraryModalOpen && (
          <EditalLibraryModal
            open={libraryModalOpen}
            modelos={catalogModels}
            loading={loadingCatalog}
            downloadingId={downloadingExternalId}
            onClose={() => setLibraryModalOpen(false)}
            onPreview={handlePreviewCatalogEdital}
            onDownload={handleDownloadCatalogEdital}
            onCreatePlanning={handleCreatePlanningWithCatalogEdital}
            onMissingEdital={() => setToastMessage('Use o canal de feedback para solicitar a inclusao de um novo edital.')}
          />
        )}
      </AnimatePresence>

      {/* Banner de atualização (apenas no modo ciclo) */}
      <AnimatePresence>
        {!isExternalPreview && !isCronoView && pendingUpdate && (
          <UpdateBanner
            templateData={pendingUpdate.templateData}
            cicloLogo={ciclo?.computedLogo}
            cicloNome={ciclo?.nome}
            diff={pendingUpdate.diff}
            updatingEdital={loadingEditalUpdate}
            onUpdate={handleUpdateEdital}
            onIgnore={handleIgnorarUpdate}
          />
        )}
      </AnimatePresence>

      {/* ── HEADER ── */}
      <div className={`${systemCardClass} edital-header-zoom flex flex-row items-start gap-2.5 p-3 pb-16 text-left sm:gap-5 sm:p-4 sm:pb-4 md:gap-7 md:p-6 md:pb-6`}>

        <div className="relative z-10 flex w-[4.5rem] flex-shrink-0 flex-col items-center gap-3 sm:w-[8.75rem] md:w-[12.25rem]">
          <div className="relative flex h-16 w-16 items-center justify-center rounded-full border-4 border-white bg-zinc-50 shadow-xl dark:border-white/10 dark:bg-zinc-900 sm:h-20 sm:w-20 md:h-28 md:w-28">
            {logoAtivo
              ? <img src={logoAtivo} alt="Logo" className="h-10 w-10 object-contain sm:h-12 sm:w-12 md:h-20 md:w-20" />
              : <GraduationCap size={52} className="text-zinc-300 dark:text-zinc-600" />
            }
            <div className="absolute -bottom-2 px-1.5 py-0.5 bg-emerald-500 text-white text-[7px] md:text-[9px] font-bold uppercase tracking-widest rounded-full shadow-md border-2 border-white dark:border-zinc-950">{isExternalPreview ? 'Visualização' : 'Ativo'}</div>
          </div>
          {showToggle && !isExternalPreview && (
            <SourceToggleButton
              viewSource={viewSource}
              onToggle={() => setViewSource(v => v === 'ciclo' ? 'cronograma' : 'ciclo')}
              cicloLogo={ciclo?.computedLogo}
              cronogramaLogo={cronograma?.computedLogo}
            />
          )}
        </div>

        <div className="z-10 w-full min-w-0 flex-1 pr-0">
          <div className="mb-2 flex w-full flex-col gap-2 md:pr-[30rem]">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="inline-flex w-fit items-center gap-1.5 px-2.5 py-1 bg-red-50 dark:bg-red-500/10 rounded-full text-[10px] md:text-[13px] font-bold uppercase tracking-wider border border-red-100 dark:border-red-500/20 text-red-600 dark:text-red-400">
                <CheckCircle2 size={17} /> Edital Verticalizado
              </div>
            </div>
          </div>

          <h1 className="mb-2 max-w-[calc(100%-6.5rem)] break-words text-[0.9rem] font-black uppercase leading-tight tracking-tight text-zinc-900 dark:text-white sm:max-w-[calc(100%-4.5rem)] sm:text-3xl md:max-w-none md:pr-[30rem] md:text-5xl">{nomeAtivo}</h1>

          {!isExternalPreview && <div className="absolute bottom-3 left-3 right-[7.1rem] mt-0 sm:static sm:mt-8 sm:w-full md:mt-10">
            <div className="flex justify-between items-end mb-2">
              <span className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Progresso Atual</span>
              <div className="flex items-baseline gap-1"><span className="text-2xl font-black text-red-600 dark:text-red-500">{statsAtivos.percentual.toFixed(0)}</span><span className="text-sm font-bold text-zinc-400">%</span></div>
            </div>
            <div className="flex h-2 w-full gap-1">
              {Array.from({ length: 30 }).map((_, i) => (
                <div key={i} className={`flex-1 rounded-sm transition-all duration-700 ${i < (statsAtivos.percentual / 3.33) ? 'bg-red-600 dark:bg-red-500' : 'bg-zinc-100 dark:bg-zinc-900'}`} />
              ))}
            </div>
            <div className="text-[10px] text-zinc-400 font-bold uppercase mt-2">
              <span>{formatEditalProgressText(statsAtivos.concluidos, statsAtivos.total)}</span>
            </div>
          </div>}
        </div>

        <div className="absolute right-2.5 top-2.5 z-20 flex w-[6.1rem] flex-col items-stretch gap-1.5 sm:right-3 sm:top-3 sm:w-auto sm:flex-row sm:items-end sm:gap-2 md:right-6 md:top-6">
          <button
            type="button"
            onClick={() => setLibraryModalOpen(true)}
            className="flex min-w-0 items-center justify-start gap-1.5 rounded-lg border border-zinc-200 bg-zinc-50 px-2 py-1.5 text-[7px] font-bold uppercase tracking-wide text-zinc-600 shadow-sm transition-all hover:border-red-200 hover:bg-red-50 hover:text-red-700 dark:border-white/10 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-red-500/10 sm:px-2.5 sm:text-[9px] md:text-[11px]"
            title="Ver outros editais verticalizados"
          >
            <Library size={14} className="text-red-600 dark:text-red-500" />
            <span>Outros editais</span>
          </button>
          {isExternalPreview && (
            <button
              type="button"
              onClick={handleReturnToActiveEdital}
              className="flex min-w-0 items-center gap-1.5 rounded-lg border border-zinc-200 bg-zinc-50 px-2.5 py-1.5 text-[9px] font-bold uppercase tracking-wide text-zinc-600 shadow-sm transition-all hover:border-red-200 hover:bg-red-50 hover:text-red-700 dark:border-white/10 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-red-500/10 md:text-[11px]"
            >
              <ArrowLeft size={14} className="text-red-600 dark:text-red-500" />
              <span>Meu edital</span>
            </button>
          )}
          <button
            type="button"
            onClick={() => isExternalPreview ? handleDownloadCatalogEdital(externalEdital) : setDownloadModalOpen(true)}
            disabled={generatingPdf || Boolean(downloadingExternalId) || (editalFonteAtivo.length === 0 && inativeFonteAtiva.length === 0)}
            className="flex min-w-0 items-center justify-start gap-1.5 rounded-lg border border-zinc-200 bg-zinc-50 px-2 py-1.5 text-[7px] font-bold uppercase tracking-wide text-zinc-600 shadow-sm transition-all hover:border-red-200 hover:bg-red-50 hover:text-red-700 disabled:cursor-not-allowed disabled:opacity-45 dark:border-white/10 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-red-500/10 sm:px-2.5 sm:text-[9px] md:text-[11px]"
            title="Baixar edital verticalizado"
          >
            {generatingPdf || downloadingExternalId ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} className="text-red-600 dark:text-red-500" />}
            <span>Baixar edital</span>
          </button>
          {!isExternalPreview && (isCronoView
            ? (onGoToCronograma && (
                <button onClick={onGoToCronograma} className="flex min-w-0 items-center gap-1.5 rounded-lg border border-zinc-200 bg-zinc-50 px-2.5 py-1.5 text-[7px] font-bold uppercase tracking-wide text-zinc-600 shadow-sm transition-all hover:border-red-200 hover:bg-red-50 hover:text-red-700 dark:border-white/10 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-red-500/10 sm:text-[9px] md:text-[11px]">
                  <CalendarDays size={14} className="text-red-600 dark:text-red-500" />
                  <span>Cronograma</span>
                  <ChevronRight size={12} className="opacity-60" />
                </button>
              ))
            : (onBack && (
                <button onClick={onBack} className="flex min-w-0 items-center gap-1.5 rounded-lg border border-zinc-200 bg-zinc-50 px-2.5 py-1.5 text-[7px] font-bold uppercase tracking-wide text-zinc-600 shadow-sm transition-all hover:border-red-200 hover:bg-red-50 hover:text-red-700 dark:border-white/10 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-red-500/10 sm:text-[9px] md:text-[11px]">
                  <LayoutDashboard size={14} className="text-red-600 dark:text-red-500" />
                  <span>Ciclo</span>
                  <ChevronRight size={12} className="opacity-60" />
                </button>
              ))
          )}
        </div>

        <div className="absolute right-0 top-0 p-10 opacity-5 pointer-events-none transform rotate-12"><BookOpen size={200} /></div>
      </div>

      {/* ── BARRA DE BUSCA ── */}
      <div className="sticky top-4 z-20 px-1">
        <div className={`relative flex items-center backdrop-blur-md shadow-xl ${systemPanelClass}`}>
          <Search className="ml-4 text-zinc-400" size={20} />
          <input
            type="text"
            placeholder="Filtrar disciplina ou tópico..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full p-4 bg-transparent text-sm font-bold text-zinc-800 dark:text-white outline-none placeholder:text-zinc-500"
          />
          {searchTerm && (
            <button onClick={() => setSearchTerm('')} className="mr-4 text-zinc-400 hover:text-red-500"><X size={16} /></button>
          )}
        </div>
      </div>

      {/* Dica de reordenação (apenas no ciclo) */}
      {!isExternalPreview && !isCronoView && (
        <div className="flex items-center justify-between px-4 md:px-0">
          <p className="text-[11px] text-zinc-400 font-medium flex items-center gap-1.5">
            <GripVertical size={13} className="text-zinc-300" /> Arraste pelo ⋮ para reordenar
          </p>
          <AnimatePresence>
            {isSavingOrder && (
              <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="text-[10px] font-bold text-zinc-400 uppercase tracking-wide flex items-center gap-1.5">
                <div className="w-3 h-3 border-2 border-zinc-400 border-t-transparent rounded-full animate-spin" /> Salvando...
              </motion.span>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* Aviso quando cronograma não tem assuntos mapeados */}
      {semDadosCrono && (
        <div className={`${systemCardClass} mx-4 md:mx-0 p-6 text-center`}>
          <CalendarDays size={34} className="mx-auto text-blue-500 dark:text-blue-400 mb-3" />
          <p className="text-base font-black text-zinc-900 dark:text-white mb-1">Detalhamento de assuntos não disponível</p>
          <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
            O cronograma não possui assuntos detalhados mapeados. O progresso é rastreado pelos slots de estudo concluídos.
          </p>
        </div>
      )}

      {/* ── LISTA DE DISCIPLINAS ── */}
      <div className="space-y-2 px-3 md:px-0">
        {editalAtivo.length === 0 && !semDadosCrono && (
          <EmptyStateCard
            icon={Search}
            title={searchTerm ? "Nenhum resultado" : "Edital Vazio"}
            description={searchTerm ? `Não encontramos nada para "${searchTerm}". Tente outros termos.` : "Não há disciplinas ou tópicos mapeados neste plano."}
            actionLabel={searchTerm ? "Limpar Busca" : undefined}
            onAction={searchTerm ? () => setSearchTerm('') : undefined}
            variant="cta"
            className="py-12"
          />
        )}

        {editalAtivo.map((disc) => {
          const desempConf = getDesempenhoConfig(disc.stats.desempenho, disc.stats.questoes);
          const DesempIcon = desempConf.icon;
          const isDragging = dragId === disc.id;
          const isOver     = overId === disc.id && !isDragging;
          const isExpanded = Boolean(expandedDisciplinas[disc.nome] || autoExpandedNames.has(disc.nome));

          return (
            <div key={disc.id}
              onDragOver={(e) => !isExternalPreview && handleDragOver(e, disc.id)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, disc.id)}
              onDragEnd={handleDragEnd}
              className={[systemCardClass,
                !isDragging && !isOver ? '' : '',
                isDragging ? 'opacity-40 scale-[0.99] shadow-none' : '',
                isOver ? 'border-red-400 ring-2 ring-red-400/30 shadow-xl -translate-y-1' : '',
                disc.isNew ? 'ring-2 ring-emerald-400/40 border-emerald-300 dark:border-emerald-700' : '',
              ].join(' ')}>

              <div className="flex flex-row items-stretch">
                {/* Grip de drag (apenas no ciclo) */}
                {!isExternalPreview && !isCronoView && (
                  <div
                    draggable
                    onDragStart={(e) => handleDragStart(e, disc.id)}
                    className="hidden md:flex items-center justify-center w-8 shrink-0 cursor-grab active:cursor-grabbing text-zinc-300 dark:text-zinc-700 hover:text-red-400 hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-colors border-r border-zinc-100 dark:border-white/10 group/grip"
                  >
                    <GripVertical size={16} className="group-hover/grip:text-red-400 transition-colors" />
                  </div>
                )}

                <div onClick={() => toggleDisciplina(disc.nome)} className="flex-1 flex items-center gap-3 p-3 text-left cursor-pointer group">
                  {!isExternalPreview && <div className="relative flex-shrink-0">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center border transition-colors ${disc.progresso === 100 ? 'bg-emerald-100 dark:bg-emerald-900/20 text-emerald-600 border-emerald-200 dark:border-emerald-500/30' : 'bg-zinc-100 dark:bg-zinc-900 text-zinc-500 border-zinc-200 dark:border-white/10 group-hover:text-red-500'}`}>
                      {disc.progresso === 100 ? <CheckCircle2 size={20} /> : <LayoutGrid size={20} />}
                    </div>
                    <svg className="absolute -top-1 -left-1 w-12 h-12 pointer-events-none" viewBox="0 0 100 100">
                      <circle cx="50" cy="50" r="48" fill="none" stroke="currentColor" className="text-zinc-200 dark:text-zinc-800" strokeWidth="2" />
                      <circle cx="50" cy="50" r="48" fill="none" stroke={disc.progresso === 100 ? '#10b981' : '#dc2626'} strokeWidth="2" strokeDasharray="301.59" strokeDashoffset={301.59 * (1 - disc.progresso / 100)} transform="rotate(-90 50 50)" className="transition-all duration-1000 ease-out" />
                    </svg>
                  </div>}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-bold text-sm md:text-base truncate transition-colors text-zinc-900 dark:text-white group-hover:text-red-600 dark:group-hover:text-red-400">{disc.nome}</h3>
                      <NewBadge isNew={disc.isNew} />
                      {isHighRelevance(disc) && (
                        <div className="hidden sm:flex items-center gap-1 px-2 py-0.5 bg-orange-100 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400 rounded-full border border-orange-200 dark:border-orange-900/30 animate-pulse">
                          <Flame size={10} fill="currentColor" /><span className="text-[9px] font-bold uppercase">Alta Relevância</span>
                        </div>
                      )}
                    </div>
                    {!isExternalPreview && <div className="flex flex-wrap items-center gap-2 mt-2">
                      <span className="px-2 py-1 rounded-md bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-300 text-[10px] font-black uppercase flex items-center gap-1 border border-blue-100 dark:border-blue-500/20"><CheckSquare size={11} /> {disc.concluidos}/{disc.totalAssuntos}</span>
                      <span className="px-2 py-1 rounded-md bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-300 text-[10px] font-black uppercase flex items-center gap-1 border border-amber-100 dark:border-amber-500/20"><Clock size={11} /> {formatMinutesToTime(disc.stats.minutos)}</span>
                      <span className={`px-2 py-1 rounded-md text-[10px] font-black uppercase flex items-center gap-1 ${desempConf.style}`}><DesempIcon size={11} /> {desempConf.label}</span>
                    </div>}
                  </div>
                  <ChevronDown size={20} className={`text-zinc-400 transition-transform flex-shrink-0 ${isExpanded ? 'rotate-180' : ''}`} />
                </div>

                {!isExternalPreview && <div className="edital-discipline-side flex shrink-0 items-center justify-end border-l border-zinc-100 bg-zinc-50/70 dark:border-white/10 dark:bg-zinc-900/55">
                  <div className="edital-discipline-side__date hidden flex-col items-end md:flex">
                    <span className="font-bold text-zinc-400 uppercase">Último Estudo</span>
                    <span className="font-mono text-zinc-700 dark:text-zinc-300">{formatEditalStudyDate(disc.stats.ultimaData)}</span>
                  </div>
                  <button
                    onClick={() => setStudyModalData({ disciplina: disc, assunto: null })}
                    className="edital-discipline-side__button flex items-center bg-zinc-900 font-bold uppercase text-white shadow transition-all hover:bg-red-600 active:scale-95 dark:bg-white dark:text-black dark:hover:bg-red-600 dark:hover:text-white"
                  >
                    <Play className="edital-discipline-side__icon" fill="currentColor" /> <span className="hidden min-[390px]:inline">Estudar</span>
                  </button>
                </div>}
              </div>

              {/* ── Assuntos expandidos ── */}
              <AnimatePresence>
                {isExpanded && (
                  <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} className="border-t border-zinc-100 dark:border-white/10 bg-zinc-50/40 dark:bg-zinc-900/35">
                    <div className="divide-y divide-zinc-100 dark:divide-zinc-800/50">
                      {disc.assuntos.map((assunto, i) => {
                        const qStats = getProgressStats(assunto.acertos, assunto.questoes);
                        const hasAct = assunto.minutos > 0 || assunto.questoes > 0;
                        const isHot  = assunto.relevancia >= 4 && !assunto.estudado;
                        // Para cronograma: prefixo "crono-", para ciclo: normal
                        const ckKey = isCronoView
                          ? `crono-${disc.nome}-${assunto.nome}`.toLowerCase().trim()
                          : `${disc.nome}-${assunto.nome}`.toLowerCase().trim();

                        return (
                          <div key={i} className={`flex flex-col md:flex-row md:items-center p-3 sm:px-4 transition-all gap-3 hover:bg-white/80 dark:hover:bg-zinc-900 ${assunto.estudado ? 'bg-emerald-50/40 dark:bg-emerald-500/10' : ''} ${assunto.isNew ? 'bg-emerald-50/60 dark:bg-emerald-500/10 border-l-2 border-emerald-400' : ''}`}>
                            <div className="flex items-start gap-3 flex-1">
                              {!isExternalPreview && <button
                                onClick={() => handleToggleCheck(disc.id, disc.nome, assunto.nome, assunto.estudado)}
                                disabled={loadingCheck[ckKey]}
                                className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all flex-shrink-0 shadow-sm z-10 ${assunto.estudado ? 'bg-emerald-500 text-white' : 'bg-white dark:bg-zinc-900 border-2 border-zinc-200 dark:border-white/10 text-zinc-300 hover:border-red-400 hover:text-red-400'}`}
                              >
                                {loadingCheck[ckKey]
                                  ? <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                                  : <CheckSquare size={18} strokeWidth={3} />
                                }
                              </button>}
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <p className={`text-[15px] leading-snug ${assunto.estudado ? 'text-zinc-500 line-through decoration-2 decoration-emerald-500/50 font-medium' : 'text-zinc-800 dark:text-zinc-100 font-bold'}`}>{assunto.nome}</p>
                                  {!isExternalPreview && <NewBadge isNew={assunto.isNew} />}
                                  {!isExternalPreview && isHot && (
                                    <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-gradient-to-r from-orange-500 to-red-500 text-white shadow-sm ml-2">
                                      <Flame size={14} fill="currentColor" /><span className="text-[10px] font-bold uppercase">Altas Chances</span>
                                    </div>
                                  )}
                                </div>
                                {!isExternalPreview && !hasAct && !assunto.estudado && (
                                  <p className="text-xs text-red-500 font-medium mt-1 flex items-center gap-1"><AlertCircle size={10} /> Não iniciado</p>
                                )}
                              </div>
                            </div>
                            {!isExternalPreview && <div className="edital-topic-side flex w-full items-center justify-end md:w-auto">
                              <div className="mr-1"><BookStackBadge count={assunto.qtdVezes} /></div>
                              <div className="edital-topic-side__metrics flex items-center">
                                <div className="edital-topic-side__metric flex flex-col items-end"><span className="edital-topic-side__label font-bold text-zinc-400 uppercase">Tempo</span><span className="edital-topic-side__value font-black text-zinc-700 dark:text-zinc-300">{formatMinutesToTime(assunto.minutos)}</span></div>
                                <div className="edital-topic-side__metric edital-topic-side__metric--questions flex flex-col items-end"><span className="edital-topic-side__label font-bold text-zinc-400 uppercase">Questões</span><div className="flex items-center gap-1.5"><span className={`edital-topic-side__value font-black ${qStats.colorText}`}>{qStats.perc}%</span><span className="text-[10px] font-medium text-zinc-400">({assunto.acertos}/{assunto.questoes})</span></div></div>
                              </div>
                              <button
                                onClick={() => handleStartTopicStudy(disc, assunto.nome)}
                                className="edital-topic-side__button flex items-center justify-center border border-zinc-200 bg-zinc-100 text-zinc-400 shadow-sm transition-all hover:bg-red-500 hover:text-white dark:border-white/10 dark:bg-zinc-900 dark:hover:bg-red-600"
                              >
                                <Play className="edital-topic-side__icon" fill="currentColor" />
                              </button>
                            </div>}
                          </div>
                        );
                      })}
                      {disc.assuntos.length === 0 && (
                        <div className="p-6 text-center text-xs text-zinc-400 italic">
                          {isCronoView ? 'Assuntos não detalhados neste cronograma.' : 'Sem tópicos cadastrados.'}
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}

        {/* DISCIPLINAS INATIVAS */}
        {inativeAtivos.length > 0 && (
          <div className={`${systemCardClass} mt-8`}>
            <button
              onClick={() => setShowInactive(!showInactive)}
              className="w-full flex items-center justify-between p-4 bg-zinc-50/80 dark:bg-zinc-900/60 hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-colors"
            >
              <div className="flex items-center gap-2">
                <Ban size={16} className="text-zinc-500" />
                <span className="text-sm font-bold text-zinc-600 dark:text-zinc-300 uppercase tracking-wide">
                  Disciplinas Fora do {isCronoView ? 'Cronograma' : 'Ciclo'} ({inativeAtivos.length})
                </span>
              </div>
              {showInactive ? <ChevronUp size={18} className="text-zinc-500" /> : <ChevronDown size={18} className="text-zinc-500" />}
            </button>
            <AnimatePresence>
              {showInactive && (
                <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} className="overflow-hidden bg-white dark:bg-zinc-950 divide-y divide-zinc-100 dark:divide-white/10">
                  {inativeAtivos.map(disc => (
                    <div key={disc.id} className="p-4 flex flex-col md:flex-row items-center justify-between gap-4 opacity-75 hover:opacity-100 transition-opacity">
                      <div className="flex-1 min-w-0 flex items-center gap-3">
                        <div className="w-10 h-10 bg-zinc-100 dark:bg-zinc-900 rounded-xl flex items-center justify-center shrink-0 border border-zinc-200 dark:border-white/10">
                          <BookOpen size={16} className="text-zinc-400" />
                        </div>
                        <div>
                          <h4 className="text-sm font-bold text-zinc-500 dark:text-zinc-400 line-through">{disc.nome}</h4>
                          <p className="text-[10px] text-zinc-400 mt-0.5">Removida do {isCronoView ? 'cronograma' : 'ciclo'} atual</p>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => setDisciplinaParaRestaurar(disc)} className="px-3 py-2 bg-emerald-50 text-emerald-600 border border-emerald-200 rounded-lg text-xs font-bold uppercase hover:bg-emerald-100 transition-colors flex items-center gap-1.5">
                          <Undo2 size={14} /> Restaurar
                        </button>
                        {!isCronoView && (
                          <button onClick={() => setDisciplinaParaExcluir(disc)} className="px-3 py-2 bg-red-50 text-red-600 border border-red-200 rounded-lg text-xs font-bold uppercase hover:bg-red-100 transition-colors flex items-center gap-1.5">
                            <Trash2 size={14} /> Excluir
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
      </div>
    </div>
  );
}

export default EditalPage;
