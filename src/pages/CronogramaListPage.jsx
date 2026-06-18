import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../firebaseConfig';
import {
  collection, query, onSnapshot, doc,
  writeBatch, getDoc,
} from 'firebase/firestore';
import {
  Plus, CalendarDays, Target, ArrowRight,
  MoreVertical, Zap, Trash2, AlertOctagon,
  TrendingUp, CalendarClock, SkipForward, Calendar, PauseCircle,
  FilePenLine,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import CronogramaCreateWizard from '../components/cronograma/WizardShell';
import { useCronogramaSystem } from '../hooks/useCronogramaSystem';
import FeedbackWidget from '../components/FeedbackWidget';
import ModalEditarCronograma from '../components/cronograma/ModalEditarCronograma';
import { CATALOGO_EDITAIS } from '../pages/AdminPage/EditaisManager';
import EmptyStateCard from '../components/shared/EmptyStateCard';

// ============================================================================
// CORREÇÃO 1: getLogo — idêntico ao CiclosList
// ============================================================================
const getLogo = (cronograma) => {
  if (!cronograma) return null;
  if (cronograma.logoUrl) return cronograma.logoUrl;
  const templateId = cronograma.editalId || cronograma.templateId;
  if (templateId && CATALOGO_EDITAIS) {
    const edital = CATALOGO_EDITAIS.find(e => e.id === templateId);
    if (edital && (edital.logoUrl || edital.logo)) return edital.logoUrl || edital.logo;
  }
  if (templateId && templateId !== 'manual') {
    const idLimpo = templateId.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
    return `/logosEditais/logo-${idLimpo}.png`;
  }
  const nomeLower = cronograma.nome?.toLowerCase() || '';
  if (nomeLower.includes('pmba')) return '/logosEditais/logo-pmba.png';
  if (nomeLower.includes('pmal')) return '/logosEditais/logo-pmal.png';
  return null;
};

// ─── MODAL ────────────────────────────────────────────────────────────────────
const ModalConfirmacao = ({ isOpen, titulo, descricao, icone: Icone, corBg, corBtn, labelBtn, onClose, onConfirm, loading }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[60] flex justify-center items-center p-4 animate-fade-in" onClick={onClose}>
      <div className="bg-white dark:bg-zinc-950 rounded-2xl shadow-2xl border border-zinc-200 dark:border-zinc-800 w-full max-w-md overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className={`${corBg} p-6 flex flex-col items-center border-b`}>
          <div className="w-16 h-16 rounded-full flex items-center justify-center mb-4"><Icone size={32} /></div>
          <h2 className="text-xl font-black text-zinc-900 dark:text-white uppercase tracking-tight">{titulo}</h2>
        </div>
        <div className="p-6 text-center">
          <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-6" dangerouslySetInnerHTML={{ __html: descricao }} />
          <div className="flex gap-3">
            <button onClick={onClose} disabled={loading} className="flex-1 px-4 py-3 bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 rounded-xl font-bold text-xs uppercase tracking-wider hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors">Cancelar</button>
            <button onClick={onConfirm} disabled={loading} className={`flex-1 px-4 py-3 ${corBtn} text-white rounded-xl font-bold text-xs uppercase tracking-wider shadow-lg transition-all flex items-center justify-center gap-2`}>
              {loading ? 'Aguarde...' : labelBtn}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// ─── FORMATADORES ─────────────────────────────────────────────────────────────
const formatDate = (val) => {
  if (!val) return '-';
  let d;
  try {
    if (val?.toDate) d = val.toDate();
    else if (typeof val === 'string') d = new Date(val);
    else d = new Date(val);
  } catch { return '-'; }
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' });
};

// ─── MÉTRICAS ─────────────────────────────────────────────────────────────────
const calcularMetricas = (cronograma) => {
  // Progresso Geral (%)
  // Cruza slots do semanaTemplate × semanas registradas no progresso (chaves "w*")
  const template = cronograma?.semanaTemplate ?? cronograma?.slots ?? [];
  const slotsTemplate = template.length;
  const progresso = (() => {
    if (!slotsTemplate) return 0;
    const progObj = cronograma?.progresso || {};
    const semanasComProgresso = Object.keys(progObj).filter(k => k.startsWith('w'));
    let slotsConcluidos = 0;
    semanasComProgresso.forEach(semKey => {
      const semData = progObj[semKey];
      if (semData && typeof semData === 'object') {
        slotsConcluidos += Object.values(semData).filter(Boolean).length;
      }
    });
    const totalSemanasEsperadas = cronograma?.totalSemanasNecessarias ?? 1;
    const totalSlotsEsperados = slotsTemplate * totalSemanasEsperadas;
    return Math.round(Math.min(100, (slotsConcluidos / totalSlotsEsperados) * 100));
  })();

  // Dias Restantes até dataFim
  const diasRestantes = (() => {
    if (!cronograma?.dataFim) return null;
    let fim;
    try {
      fim = cronograma.dataFim?.toDate
        ? cronograma.dataFim.toDate()
        : new Date(cronograma.dataFim);
    } catch { return null; }
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    fim.setHours(0, 0, 0, 0);
    return Math.max(0, Math.ceil((fim - hoje) / (1000 * 60 * 60 * 24)));
  })();

  // Horas Semanais
  const horasSemanais = cronograma?.cargaHorariaSemanal ?? cronograma?.horasSemanais ?? null;

  // Total de Disciplinas
  const totalDisciplinas = (cronograma?.disciplinasSnapshot ?? []).filter((disciplina) => disciplina?.inCiclo !== false).length;

  return { progresso, diasRestantes, horasSemanais, totalDisciplinas };
};

// ─── CARD ─────────────────────────────────────────────────────────────────────
const CronogramaCard = ({ cronograma, onOpen, onMenuToggle, isMenuOpen, onAction, allowInactiveOpen = true }) => {
  const metricas = useMemo(() => calcularMetricas(cronograma), [cronograma]);
  const { progresso, diasRestantes, horasSemanais, totalDisciplinas } = metricas;
  const totalSemanas = cronograma.totalSemanasNecessarias || 0;
  const logo = getLogo(cronograma);
  const canOpen = typeof onOpen === 'function' && (allowInactiveOpen || cronograma.ativo);

  const semanaAtual = useMemo(() => {
    if (!cronograma.dataInicio) return 1;
    const inicio = new Date(cronograma.dataInicio);
    const diff = Math.max(0, Math.floor((new Date() - inicio) / (7 * 24 * 60 * 60 * 1000)));
    return Math.min(diff + 1, totalSemanas);
  }, [cronograma.dataInicio, totalSemanas]);

  return (
    <div onClick={() => canOpen && onOpen(cronograma.id, cronograma)} className={`group relative bg-white dark:bg-zinc-900/50 rounded-2xl p-4 sm:p-5 border border-zinc-200 dark:border-zinc-800 overflow-hidden transition-all duration-500 hover:-translate-y-1 hover:shadow-2xl flex flex-col justify-between h-full min-h-[170px] sm:min-h-[220px] ${canOpen ? 'cursor-pointer' : 'cursor-default'}`}>
      <div className="absolute left-0 top-0 bottom-0 w-1 bg-transparent group-hover:bg-emerald-500 transition-colors duration-300 z-20" />

      {/* CORREÇÃO 1: logo */}
      {logo ? (
        <div className="absolute bottom-0 right-0 w-20 h-20 sm:w-24 sm:h-24 md:w-36 md:h-36 opacity-25 md:opacity-20 transition-all duration-700 ease-out group-hover:scale-110 group-hover:opacity-40 z-0 pointer-events-none filter saturate-150">
          <img src={logo} alt="" className="w-full h-full object-contain" onError={e => { e.target.style.display = 'none'; e.target.parentElement.style.display = 'none'; }} />
        </div>
      ) : (
        <div className="absolute -bottom-6 -right-6 text-emerald-500/10 dark:text-emerald-500/5 transition-all duration-700 ease-out group-hover:scale-125 group-hover:rotate-[-10deg] z-0 pointer-events-none">
          <CalendarDays strokeWidth={1.5} size={100} className="sm:w-[140px] sm:h-[140px]" />
        </div>
      )}

      <div className="relative z-10 flex flex-col h-full">
        <div className="flex justify-between items-start mb-3 sm:mb-4">
          <div className="flex flex-wrap gap-2 items-center">
            <div className={`px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-md text-[9px] sm:text-[10px] font-black uppercase tracking-widest border flex items-center gap-1.5 ${cronograma.ativo ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20 shadow-[0_0_10px_rgba(16,185,129,0.2)]' : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500 border-zinc-200 dark:border-zinc-700'}`}>
              {cronograma.ativo && (<span className="relative flex h-1.5 w-1.5"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" /><span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500" /></span>)}
              {cronograma.ativo ? 'ATIVO' : 'INATIVO'}
            </div>
            <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg border bg-zinc-100 dark:bg-zinc-800/50 border-zinc-200 dark:border-zinc-700 text-[9px] font-black uppercase tracking-widest text-zinc-500">
              <Calendar size={10} /> Sem {semanaAtual}/{totalSemanas}
            </div>
          </div>
          <div className="relative">
            <button onClick={e => onMenuToggle(e, cronograma.id)} className="p-1.5 sm:p-2 -mr-2 -mt-2 text-zinc-400 hover:text-zinc-800 dark:hover:text-white rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"><MoreVertical size={18} className="sm:w-5 sm:h-5" /></button>
            <AnimatePresence>
              {isMenuOpen && (
                <motion.div initial={{ opacity: 0, y: 5, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} onClick={e => e.stopPropagation()} className="absolute top-8 right-0 w-44 sm:w-52 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-xl py-1 z-50 overflow-hidden ring-1 ring-black/5">
                  {cronograma.ativo && <button onClick={e => onAction(e, 'desativar', cronograma)} className="w-full text-left px-4 py-2.5 text-xs font-bold uppercase tracking-wide text-zinc-500 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800/60 flex items-center gap-2 transition-colors"><PauseCircle size={14} /> Desativar</button>}
                  <button onClick={e => onAction(e, 'adiar', cronograma)} className="w-full text-left px-4 py-2.5 text-xs font-bold uppercase tracking-wide text-amber-600 dark:text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-900/10 flex items-center gap-2 transition-colors"><SkipForward size={14} /> Adiar semana</button>
                  <div className="h-px bg-zinc-100 dark:bg-zinc-800 my-1" />
                  <button onClick={e => onAction(e, 'excluir', cronograma)} className="w-full text-left px-4 py-2.5 text-xs font-bold uppercase tracking-wide text-red-600 dark:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/10 flex items-center gap-2 transition-colors"><Trash2 size={14} /> Excluir</button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* ── Título + datas ───────────────────────────────────────────────── */}
        <div className="mb-3 sm:mb-4 flex-grow">
          <h3 className="text-lg sm:text-xl md:text-2xl font-black text-zinc-900 dark:text-white leading-tight mb-2 line-clamp-2 group-hover:text-emerald-600 dark:group-hover:text-emerald-500 transition-colors">{cronograma.nome}</h3>
          <div className="hidden sm:block w-8 h-1 bg-emerald-500 rounded-full mb-4 group-hover:w-16 transition-all duration-500" />
          <div className="flex flex-row sm:flex-col gap-3 sm:gap-2 mb-3 sm:mb-4 flex-wrap">
            {cronograma.dataInicio && <div className="flex items-center gap-1.5 sm:gap-2 text-zinc-500 dark:text-zinc-400 text-xs"><CalendarClock size={12} className="text-emerald-500/70 sm:w-[14px] sm:h-[14px]" /><span className="text-[9px] sm:text-[10px] font-medium">Início: {formatDate(cronograma.dataInicio)}</span></div>}
            {cronograma.dataFim && <div className="flex items-center gap-1.5 sm:gap-2 text-zinc-500 dark:text-zinc-400 text-xs"><Target size={12} className="text-emerald-500/70 sm:w-[14px] sm:h-[14px]" /><span className="text-[9px] sm:text-[10px] font-medium">Término: {formatDate(cronograma.dataFim)}</span></div>}
          </div>

          {/* ── Barra de Progresso ─────────────────────────────────────────── */}
          <div className="mt-auto">
            <div className="flex justify-between items-end mb-1.5">
              <span className="text-[10px] sm:text-[11px] font-black text-zinc-400 dark:text-zinc-500 uppercase tracking-widest flex items-center gap-1">
                <TrendingUp size={11} className="sm:w-[13px] sm:h-[13px]" /> Progresso
              </span>
              <span className="text-[11px] sm:text-[13px] font-black tabular-nums text-zinc-600 dark:text-zinc-300">{progresso}%</span>
            </div>
            <div className="h-1.5 sm:h-2 w-full bg-zinc-100 dark:bg-zinc-800/80 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{
                  width: `${progresso}%`,
                  background: progresso >= 80
                    ? 'linear-gradient(90deg, #10b981, #059669)'
                    : progresso >= 40
                    ? 'linear-gradient(90deg, #1d4ed8, #2563eb)'
                    : 'linear-gradient(90deg, #334155, #475569)',
                }}
              />
            </div>
          </div>
        </div>

        {/* ── Rodapé: Métricas + Acessar ───────────────────────────────────── */}
        <div className="border-t border-zinc-100 dark:border-zinc-800/50 mt-1 sm:mt-2 pt-3 sm:pt-4 flex flex-col gap-3">

          {/* Linha de metadados */}
          <div className="flex items-center gap-x-3 gap-y-1.5 flex-wrap">
            {/* Disciplinas */}
            {totalDisciplinas > 0 && (
              <div className="flex items-center gap-1 text-zinc-400 dark:text-zinc-500">
                <span className="text-[10px] leading-none">📚</span>
                <span className="text-[9px] sm:text-[10px] font-bold tabular-nums text-zinc-500 dark:text-zinc-400">
                  {totalDisciplinas} disc.
                </span>
              </div>
            )}

            {/* Horas semanais */}
            {horasSemanais != null && (
              <div className="flex items-center gap-1 text-zinc-400 dark:text-zinc-500">
                <span className="text-[10px] leading-none">⏱</span>
                <span className="text-[9px] sm:text-[10px] font-bold tabular-nums text-zinc-500 dark:text-zinc-400">
                  {horasSemanais}h/sem
                </span>
              </div>
            )}

            {/* Dias restantes — só se dataFim existir */}
            {diasRestantes != null && (
              <div className="flex items-center gap-1">
                <span className="text-[10px] leading-none">📅</span>
                <span className={`text-[9px] sm:text-[10px] font-black tabular-nums ${
                  diasRestantes === 0
                    ? 'text-red-500 dark:text-red-400'
                    : diasRestantes <= 7
                    ? 'text-amber-500 dark:text-amber-400'
                    : 'text-zinc-500 dark:text-zinc-400'
                }`}>
                  {diasRestantes === 0 ? 'Hoje' : `${diasRestantes}d`}
                </span>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2">
            {cronograma.ativo ? (
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  if (canOpen) onOpen(cronograma.id, cronograma);
                }}
                className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-emerald-600 px-3 py-2 text-[9px] font-black uppercase tracking-widest text-white shadow-lg shadow-emerald-600/20 transition hover:bg-emerald-700 sm:text-[10px]"
              >
                Acessar <ArrowRight size={13} />
              </button>
            ) : (
              <button
                type="button"
                onClick={(event) => onAction(event, 'ativar', cronograma)}
                className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-emerald-600 px-3 py-2 text-[9px] font-black uppercase tracking-widest text-white shadow-lg shadow-emerald-600/20 transition hover:bg-emerald-700 sm:text-[10px]"
              >
                <Zap size={13} /> Ativar
              </button>
            )}

            <button
              type="button"
              onClick={(event) => onAction(event, 'editar', cronograma)}
              className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-zinc-200 bg-white px-3 py-2 text-[9px] font-black uppercase tracking-widest text-zinc-700 shadow-sm transition hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-700 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:border-emerald-900/40 dark:hover:bg-emerald-950/20 dark:hover:text-emerald-400 sm:text-[10px]"
            >
              <FilePenLine size={13} /> Editar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// ─── PÁGINA PRINCIPAL ─────────────────────────────────────────────────────────
function CronogramaListPage({
  user,
  onCronogramaAberto,
  hideHeader = false,
  onRequestCreate = null,
  onRequestEdit = null,
  compact = false,
  allowInactiveOpen = true,
}) {
  const [cronogramas, setCronogramas] = useState([]);
  const [loadingList, setLoadingList] = useState(true);
  const [showCreateWizard, setShowCreateWizard] = useState(false);
  const [menuAberto, setMenuAberto] = useState(null);
  const [cronogramaParaExcluir, setCronogramaParaExcluir] = useState(null);
  const [cronogramaParaDesativar, setCronogramaParaDesativar] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [feedbackView, setFeedbackView] = useState('home');
  const [feedbackType, setFeedbackType] = useState('ideia');
  const [cronogramaParaEditar, setCronogramaParaEditar] = useState(null);
  const [actionError, setActionError] = useState('');
  const canUseInlineCreate = typeof onRequestCreate !== 'function';
  const canUseInlineEdit = typeof onRequestEdit !== 'function';
  const containerClassName = compact ? 'p-0 animate-fade-in' : 'p-0 min-h-[50vh] animate-fade-in pb-12';

  const { adiarCronograma, ativarCronograma, desativarCronograma } = useCronogramaSystem(user);

  const handleOpenFeedback = ({ initialView = 'home', initialType = 'ideia' } = {}) => {
    setFeedbackView(initialView); setFeedbackType(initialType); setFeedbackOpen(true);
  };

  useEffect(() => {
    const closeMenu = () => setMenuAberto(null);
    document.addEventListener('click', closeMenu);
    return () => document.removeEventListener('click', closeMenu);
  }, []);

  // CORREÇÃO 3: busca sem orderBy para compatibilidade com documentos legados
  // (alguns usam dataCriacao, outros criadoEm) — ordena em JS
  useEffect(() => {
    if (!user) { setLoadingList(false); return; }
    setLoadingList(true);
    const q = query(collection(db, 'users', user.uid, 'cronogramas'));
    return onSnapshot(q, snapshot => {
      const docs = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      docs.sort((a, b) => {
        const getTs = (x) => {
          const ts = x.criadoEm || x.dataCriacao;
          if (!ts) return 0;
          if (ts?.toDate) return ts.toDate().getTime();
          if (ts?.seconds) return ts.seconds * 1000;
          return new Date(ts).getTime();
        };
        return getTs(b) - getTs(a);
      });
      setCronogramas(docs);
      setLoadingList(false);
    }, err => { console.error(err); setLoadingList(false); });
  }, [user]);

  const sortedCronogramas = useMemo(() =>
    [...cronogramas].sort((a, b) => {
      if (a.ativo && !b.ativo) return -1;
      if (!a.ativo && b.ativo) return 1;
      return 0;
    }), [cronogramas]);

  const handleMenuToggle = (e, id) => { e.stopPropagation(); setMenuAberto(prev => prev === id ? null : id); };

  const handleAction = async (e, action, cronograma) => {
    e.stopPropagation(); setMenuAberto(null);
    if (action === 'ativar') { setActionLoading(true); await ativarCronograma(cronograma.id); setActionLoading(false); }
    else if (action === 'desativar') { setCronogramaParaDesativar(cronograma); }
    else if (action === 'editar') {
      if (canUseInlineEdit) setCronogramaParaEditar(cronograma);
      else onRequestEdit(cronograma);
    }
    else if (action === 'adiar') { setActionLoading(true); await adiarCronograma(cronograma.id, cronograma); setActionLoading(false); }
    else if (action === 'excluir') { setCronogramaParaExcluir(cronograma); }
  };

  const handleConfirmarDesativacao = async () => {
    if (!cronogramaParaDesativar || actionLoading) return;
    setActionLoading(true);
    await desativarCronograma(cronogramaParaDesativar.id);
    setActionLoading(false); setCronogramaParaDesativar(null);
  };

  // CORREÇÃO 2: exclusão robusta — verifica se cicloVinculadoId existe antes de tentar atualizar
  const handleConfirmarExclusao = async () => {
    if (!cronogramaParaExcluir || actionLoading) return;
    setActionLoading(true);
    try {
      const { id, cicloVinculadoId } = cronogramaParaExcluir;
      const batch = writeBatch(db);
      batch.delete(doc(db, 'users', user.uid, 'cronogramas', id));
      if (cicloVinculadoId) {
        try {
          const cicloSnap = await getDoc(doc(db, 'users', user.uid, 'ciclos', cicloVinculadoId));
          if (cicloSnap.exists()) {
            batch.update(doc(db, 'users', user.uid, 'ciclos', cicloVinculadoId), { arquivado: true, ativo: false });
          }
        } catch { /* ciclo não existe mais — ok */ }
      }
      await batch.commit();
    } catch (err) {
      console.error('Erro ao excluir:', err);
      setActionError('Erro ao excluir cronograma. Tente novamente.');
    } finally {
      setActionLoading(false); setCronogramaParaExcluir(null);
    }
  };

  const handleCreateRequest = () => {
    if (canUseInlineCreate) setShowCreateWizard(true);
    else onRequestCreate();
  };

  if (cronogramaParaEditar && canUseInlineEdit) {
    return (
      <div className={containerClassName}>
        <ModalEditarCronograma
          user={user}
          cronograma={cronogramaParaEditar}
          onFechar={() => setCronogramaParaEditar(null)}
          onCronogramaAtualizado={() => setCronogramaParaEditar(null)}
        />
      </div>
    );
  }

  return (
    <div className={containerClassName}>
      <FeedbackWidget user={user} isOpen={feedbackOpen} onClose={() => setFeedbackOpen(false)} initialView={feedbackView} initialType={feedbackType} />

      {showCreateWizard && canUseInlineCreate ? (
        <CronogramaCreateWizard user={user} onClose={() => setShowCreateWizard(false)} onCronogramaCriado={() => setShowCreateWizard(false)} onOpenFeedback={handleOpenFeedback} />
      ) : (
        <>
          <AnimatePresence>
            {actionError && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="fixed left-1/2 top-4 z-[90] flex w-[calc(100%-2rem)] max-w-md -translate-x-1/2 items-center gap-3 rounded-2xl border border-red-200 bg-white px-4 py-3 text-sm font-bold text-red-700 shadow-2xl shadow-red-900/10 dark:border-red-900/40 dark:bg-zinc-950 dark:text-red-300"
              >
                <AlertOctagon size={18} className="shrink-0" />
                <span>{actionError}</span>
                <button onClick={() => setActionError('')} className="ml-auto rounded-lg px-2 py-1 text-[10px] uppercase tracking-wider text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30">Ok</button>
              </motion.div>
            )}

            {cronogramaParaDesativar && (
              <ModalConfirmacao isOpen={true} titulo="Desativar Cronograma?" descricao={`O cronograma <strong>"${cronogramaParaDesativar.nome}"</strong> será pausado. Seu progresso é preservado.`} icone={PauseCircle} corBg="bg-zinc-100 dark:bg-zinc-800/60 border-zinc-200 dark:border-zinc-700 text-zinc-500" corBtn="bg-zinc-700 hover:bg-zinc-800 dark:bg-zinc-600 dark:hover:bg-zinc-500" labelBtn="Desativar" onClose={() => setCronogramaParaDesativar(null)} onConfirm={handleConfirmarDesativacao} loading={actionLoading} />
            )}
            {cronogramaParaExcluir && (
              <ModalConfirmacao isOpen={true} titulo="Excluir Cronograma?" descricao={`O cronograma <strong class="text-red-600">"${cronogramaParaExcluir.nome}"</strong> e todo o progresso serão apagados permanentemente.`} icone={AlertOctagon} corBg="bg-red-600/10 border-red-500/20 text-red-600" corBtn="bg-red-600 hover:bg-red-700" labelBtn="Excluir Definitivamente" onClose={() => setCronogramaParaExcluir(null)} onConfirm={handleConfirmarExclusao} loading={actionLoading} />
            )}
          </AnimatePresence>

          {!hideHeader && (
            <div className="mb-6 md:mb-8 flex flex-col md:flex-row justify-between items-start md:items-end gap-4 border-b border-zinc-200 dark:border-zinc-800 pb-4 md:pb-6">
              <div>
                <div className="flex items-center gap-3 mb-1 md:mb-2">
                  <div className="p-2 md:p-2.5 bg-emerald-100 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-500 rounded-xl">
                    <CalendarDays size={24} className="md:w-7 md:h-7" strokeWidth={2} />
                  </div>
                  <h1 className="text-2xl md:text-3xl font-black text-zinc-800 dark:text-white tracking-tight uppercase">Cronogramas</h1>
                </div>
                <p className="text-sm text-zinc-500 dark:text-zinc-400 pl-1">Gerencie seus cronogramas de estudo semanais</p>
              </div>
              <button onClick={handleCreateRequest} className="group relative px-4 py-2.5 md:px-5 md:py-3 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 rounded-xl font-bold shadow-lg hover:shadow-xl transition-all transform hover:-translate-y-0.5 active:translate-y-0 flex items-center gap-2 overflow-hidden shrink-0 text-sm md:text-base w-full md:w-auto justify-center">
                <div className="absolute inset-0 bg-white/20 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-500" />
                <Plus size={18} className="md:w-5 md:h-5 group-hover:rotate-90 transition-transform" /><span>Novo Cronograma</span>
              </button>
            </div>
          )}

          {loadingList ? (
            <div className="flex justify-center py-20"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-emerald-500" /></div>
          ) : sortedCronogramas.length === 0 ? (
            <EmptyStateCard
              icon={CalendarDays}
              title="Nenhum cronograma"
              description="Crie seu primeiro cronograma para distribuir automaticamente seus estudos semana a semana."
              actionLabel="Criar cronograma"
              onAction={handleCreateRequest}
              variant="cta"
              className="min-h-[320px]"
            />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-6">
              {sortedCronogramas.map(cronograma => (
                <CronogramaCard key={cronograma.id} cronograma={cronograma} onOpen={(id, item) => onCronogramaAberto?.(id, item)} onMenuToggle={handleMenuToggle} isMenuOpen={menuAberto === cronograma.id} onAction={handleAction} allowInactiveOpen={allowInactiveOpen} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default CronogramaListPage;
