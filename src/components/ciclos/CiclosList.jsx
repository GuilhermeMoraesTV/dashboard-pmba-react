import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../../firebaseConfig';
import {
  collection,
  query,
  onSnapshot,
  orderBy,
  doc,
  writeBatch,
  getDocs,
  where
} from 'firebase/firestore';
import CicloCreateWizard from '../ciclos/CicloCreateWizard/CicloCreateWizard';
import CicloEditModal from './CicloEditModal';
import { useCiclos } from '../../hooks/useCiclos';
import { CATALOGO_EDITAIS } from '../../pages/AdminPage/EditaisManager';
import { useForceUnlock } from '../../hooks/useForceUnlock';

import {
  MoreVertical,
  Plus,
  Clock,
  Zap,
  Archive,
  Edit,
  AlertTriangle,
  BookOpen,
  Calendar,
  Target,
  ArrowRight,
  RotateCw,
  Trophy,
  Map,
  BarChart3,
  Trash2,
  AlertOctagon,
  PauseCircle,   // ← ícone de desativar
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// --- MODAL DE ARQUIVAMENTO ---
function ModalConfirmacaoArquivamento({ ciclo, onClose, onConfirm, loading }) {
  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[60] flex justify-center items-center p-4 animate-fade-in" onClick={onClose}>
      <div className="bg-white dark:bg-zinc-950 p-0 rounded-2xl shadow-2xl border border-zinc-200 dark:border-zinc-800 w-full max-w-md relative overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="bg-amber-500/10 p-6 flex flex-col items-center border-b border-amber-500/20">
          <div className="w-16 h-16 bg-amber-500/20 text-amber-600 dark:text-amber-500 rounded-full flex items-center justify-center mb-4 shadow-[0_0_15px_rgba(245,158,11,0.4)]">
            <Archive size={32} />
          </div>
          <h2 className="text-xl font-black text-zinc-900 dark:text-white uppercase tracking-tight">Arquivar Ciclo?</h2>
        </div>
        <div className="p-6 text-center">
          <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-6">
            O ciclo <strong className="text-zinc-900 dark:text-white">"{ciclo.nome}"</strong> será movido para o <strong>Arquivo Morto</strong> no seu perfil.
            <br /><span className="text-xs opacity-70">(Seus dados e horas serão preservados).</span>
          </p>
          <div className="flex gap-3">
            <button onClick={onClose} disabled={loading} className="flex-1 px-4 py-3 bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 rounded-xl font-bold text-xs uppercase tracking-wider hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors">Cancelar</button>
            <button onClick={onConfirm} disabled={loading} className="flex-1 px-4 py-3 bg-amber-600 hover:bg-amber-700 text-white rounded-xl font-bold text-xs uppercase tracking-wider shadow-lg shadow-amber-900/20 transition-all flex items-center justify-center gap-2">{loading ? "Arquivando..." : "Arquivar"}</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// --- MODAL DE EXCLUSÃO ---
function ModalConfirmacaoExclusao({ ciclo, onClose, onConfirm, loading }) {
  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[60] flex justify-center items-center p-4 animate-fade-in" onClick={onClose}>
      <div className="bg-white dark:bg-zinc-950 p-0 rounded-2xl shadow-2xl border border-zinc-200 dark:border-zinc-800 w-full max-w-md relative overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="bg-red-600/10 p-6 flex flex-col items-center border-b border-red-500/20">
          <div className="w-16 h-16 bg-red-600/20 text-red-600 rounded-full flex items-center justify-center mb-4 shadow-[0_0_15px_rgba(220,38,38,0.4)]">
            <AlertOctagon size={32} />
          </div>
          <h2 className="text-xl font-black text-zinc-900 dark:text-white uppercase tracking-tight">Excluir Tudo?</h2>
        </div>
        <div className="p-6 text-center">
          <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-4">
            Você está prestes a apagar o ciclo <strong className="text-red-600 font-bold">"{ciclo.nome}"</strong>.
          </p>
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-900/50 p-3 rounded-xl text-xs text-red-800 dark:text-red-300 font-medium mb-6 text-left">
            <AlertTriangle size={14} className="inline mr-1 -mt-0.5" />
            <strong>Atenção:</strong> Todos os registros de estudo e horas vinculados a este ciclo também serão apagados permanentemente. Isso reduzirá seu tempo total acumulado.
          </div>
          <div className="flex gap-3">
            <button onClick={onClose} disabled={loading} className="flex-1 px-4 py-3 bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 rounded-xl font-bold text-xs uppercase tracking-wider hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors">Cancelar</button>
            <button onClick={onConfirm} disabled={loading} className="flex-1 px-4 py-3 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold text-xs uppercase tracking-wider shadow-lg shadow-red-900/20 transition-all flex items-center justify-center gap-2">{loading ? "Apagando..." : "Excluir Definitivamente"}</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// --- MODAL DE DESATIVAÇÃO (confirmação leve) ---
function ModalConfirmacaoDesativacao({ ciclo, onClose, onConfirm, loading }) {
  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[60] flex justify-center items-center p-4 animate-fade-in" onClick={onClose}>
      <div className="bg-white dark:bg-zinc-950 p-0 rounded-2xl shadow-2xl border border-zinc-200 dark:border-zinc-800 w-full max-w-md relative overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="bg-zinc-100 dark:bg-zinc-800/60 p-6 flex flex-col items-center border-b border-zinc-200 dark:border-zinc-700">
          <div className="w-16 h-16 bg-zinc-200 dark:bg-zinc-700 text-zinc-500 dark:text-zinc-300 rounded-full flex items-center justify-center mb-4">
            <PauseCircle size={32} />
          </div>
          <h2 className="text-xl font-black text-zinc-900 dark:text-white uppercase tracking-tight">Desativar Ciclo?</h2>
        </div>
        <div className="p-6 text-center">
          <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-2">
            O ciclo <strong className="text-zinc-900 dark:text-white">"{ciclo.nome}"</strong> será <strong>pausado</strong> e ficará inativo na lista.
          </p>
          <p className="text-xs text-zinc-400 dark:text-zinc-500 mb-6">
            Seus dados e registros de estudo são preservados. Você pode reativar a qualquer momento.
          </p>
          <div className="flex gap-3">
            <button onClick={onClose} disabled={loading} className="flex-1 px-4 py-3 bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 rounded-xl font-bold text-xs uppercase tracking-wider hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors">Cancelar</button>
            <button onClick={onConfirm} disabled={loading} className="flex-1 px-4 py-3 bg-zinc-700 hover:bg-zinc-800 dark:bg-zinc-600 dark:hover:bg-zinc-500 text-white rounded-xl font-bold text-xs uppercase tracking-wider shadow-lg transition-all flex items-center justify-center gap-2">
              {loading ? "Desativando..." : "Desativar"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// FUNÇÃO DE LOGO
// ============================================================================
const getLogo = (ciclo) => {
  if (!ciclo) return null;
  if (ciclo.logoUrl) return ciclo.logoUrl;
  if (ciclo.templateId && CATALOGO_EDITAIS) {
    const editalTemplate = CATALOGO_EDITAIS.find(e => e.id === ciclo.templateId);
    if (editalTemplate && (editalTemplate.logoUrl || editalTemplate.logo)) {
      return editalTemplate.logoUrl || editalTemplate.logo;
    }
  }
  if (ciclo.templateId && ciclo.templateId !== 'manual') {
    const idLimpo = ciclo.templateId.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
    return `/logosEditais/logo-${idLimpo}.png`;
  }
  const nomeLower = ciclo.nome?.toLowerCase() || "";
  if (nomeLower.includes("pmba")) return "/logosEditais/logoModoQAP.png";
  if (nomeLower.includes("pmal")) return "/logosEditais/logo-pmal.png";
  return null;
};

// --- CARD DO CICLO ---
const CicloCard = ({ ciclo, onClick, onMenuToggle, isMenuOpen, onAction, registrosEstudo, isTimerActive }) => {
  const concluidos = ciclo.conclusoes || 0;
  const logo = getLogo(ciclo);

  const { totalHoras, progressoPercent } = useMemo(() => {
    if (!registrosEstudo) return { totalHoras: 0, progressoPercent: 0 };
    const registrosDoCiclo = registrosEstudo.filter(r => r.cicloId === ciclo.id && !r.conclusaoId && r.tipoEstudo !== 'check_manual');
    const minutosTotais = registrosDoCiclo.reduce((acc, curr) => acc + Number(curr.tempoEstudadoMinutos || 0), 0);
    const horasTotais = Math.round(minutosTotais / 60 * 10) / 10;
    const metaSemanal = Number(ciclo.cargaHorariaSemanalTotal) || 1;
    const percent = Math.min((horasTotais / metaSemanal) * 100, 100);
    return { totalHoras: horasTotais, progressoPercent: percent };
  }, [ciclo.id, registrosEstudo, ciclo.cargaHorariaSemanalTotal]);

  return (
    <div
      onClick={() => onClick(ciclo.id)}
      className="group relative bg-white dark:bg-zinc-900/50 rounded-2xl p-4 sm:p-5 cursor-pointer border border-zinc-200 dark:border-zinc-800 overflow-hidden transition-all duration-500 hover:-translate-y-1 hover:shadow-2xl flex flex-col justify-between h-full min-h-[170px] sm:min-h-[220px]"
    >
      <div className="absolute left-0 top-0 bottom-0 w-1 bg-transparent group-hover:bg-red-500 transition-colors duration-300 z-20" />

      {logo ? (
        <div className="absolute bottom-0 right-0 w-20 h-20 sm:w-24 sm:h-24 md:w-36 md:h-36 opacity-25 md:opacity-20 transition-all duration-700 ease-out group-hover:scale-110 group-hover:opacity-40 z-0 pointer-events-none filter saturate-150">
          <img src={logo} alt="Logo Edital" className="w-full h-full object-contain" onError={(e) => { e.target.style.display = 'none'; e.target.parentElement.style.display = 'none'; }} />
        </div>
      ) : (
        <div className="absolute -bottom-6 -right-6 text-red-500/10 dark:text-red-500/5 transition-all duration-700 ease-out group-hover:scale-125 group-hover:rotate-[-10deg] z-0 pointer-events-none">
          {ciclo.ativo ? <Target strokeWidth={1.5} size={100} className="sm:w-[140px] sm:h-[140px]" /> : <BookOpen strokeWidth={1.5} size={100} className="sm:w-[140px] sm:h-[140px]" />}
        </div>
      )}

      <div className="relative z-10 flex flex-col h-full">
        <div className="flex justify-between items-start mb-3 sm:mb-4">
          <div className="flex flex-wrap gap-2 items-center">
            <div className={`px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-md text-[9px] sm:text-[10px] font-black uppercase tracking-widest border flex items-center gap-1.5 ${ciclo.ativo ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20 shadow-[0_0_10px_rgba(16,185,129,0.2)]' : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500 border-zinc-200 dark:border-zinc-700'}`}>
              {ciclo.ativo && (<span className="relative flex h-1.5 w-1.5"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" /><span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500" /></span>)}
              {ciclo.ativo ? 'ATIVO' : 'INATIVO'}
            </div>

            <div className={`flex items-center gap-1.5 sm:gap-2 pl-1.5 pr-2.5 py-1 sm:py-1.5 rounded-lg border transition-all ${concluidos > 0 ? 'bg-amber-50 dark:bg-amber-900/10 border-amber-500/20 shadow-[0_0_10px_rgba(245,158,11,0.1)]' : 'bg-zinc-100 dark:bg-zinc-800/50 border-zinc-200 dark:border-zinc-700'}`}>
              <div className="relative flex items-center justify-center w-8 h-8 sm:w-9 sm:h-9 shrink-0">
                <motion.svg animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 15, ease: "linear" }} className="absolute inset-0 w-full h-full" viewBox="0 0 100 100">
                  <circle cx="50" cy="50" r="44" fill="none" stroke="currentColor" strokeWidth="5" strokeDasharray="14 10" strokeLinecap="round" className={concluidos > 0 ? "text-amber-500/60" : "text-zinc-300 dark:text-zinc-600"} />
                </motion.svg>
                <div className="absolute inset-0 flex items-center justify-center z-10">
                  <span className={`text-base sm:text-lg font-black tracking-tighter leading-none mt-[1px] ${concluidos > 0 ? 'text-amber-600 dark:text-amber-500' : 'text-zinc-500'}`}>{concluidos}</span>
                </div>
                <div className="absolute -bottom-1 -right-1 bg-white dark:bg-zinc-900 rounded-full p-[3px] shadow-sm border border-zinc-100 dark:border-zinc-800 z-20">
                  {concluidos > 0 ? <Trophy size={10} className="text-amber-500" /> : <RotateCw size={10} className="text-zinc-400" />}
                </div>
              </div>
              <div className="flex flex-col justify-center">
                <span className="text-[8px] font-bold uppercase tracking-widest text-zinc-500 dark:text-zinc-400 leading-none mb-0.5">Ciclos Semanais</span>
                <span className={`text-[9px] sm:text-[10px] font-black uppercase tracking-wide leading-none ${concluidos > 0 ? 'text-amber-600 dark:text-amber-500' : 'text-zinc-600 dark:text-zinc-400'}`}>Concluídos</span>
              </div>
            </div>
          </div>

          <div className="relative">
            <button onClick={(e) => onMenuToggle(e, ciclo.id)} className="p-1.5 sm:p-2 -mr-2 -mt-2 text-zinc-400 hover:text-zinc-800 dark:hover:text-white rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors">
              <MoreVertical size={18} className="sm:w-5 sm:h-5" />
            </button>
            <AnimatePresence>
              {isMenuOpen && (
                <motion.div
                  initial={{ opacity: 0, y: 5, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  onClick={(e) => e.stopPropagation()}
                  className="absolute top-8 right-0 w-44 sm:w-52 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-xl py-1 z-50 overflow-hidden ring-1 ring-black/5"
                >
                  {/* Ativar — só para ciclos inativos */}
                  {!ciclo.ativo && (
                    <button
                      onClick={(e) => onAction(e, 'ativar', ciclo)}
                      className={`w-full text-left px-4 py-2.5 text-xs font-bold uppercase tracking-wide flex items-center gap-2 transition-colors ${
                        isTimerActive
                          ? 'text-zinc-400 dark:text-zinc-600 cursor-not-allowed opacity-50'
                          : 'text-emerald-600 dark:text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-900/10'
                      }`}
                    >
                      <Zap size={14} />
                      Ativar
                      {isTimerActive && <span className="ml-auto text-[9px] font-black uppercase tracking-wider text-amber-500">Timer ativo</span>}
                    </button>
                  )}

                  {/* ── NOVO: Desativar — só para ciclos ativos ─────────────── */}
                  {ciclo.ativo && (
                    <button
                      onClick={(e) => onAction(e, 'desativar', ciclo)}
                      className="w-full text-left px-4 py-2.5 text-xs font-bold uppercase tracking-wide text-zinc-500 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800/60 flex items-center gap-2 transition-colors"
                    >
                      <PauseCircle size={14} />
                      Desativar
                    </button>
                  )}

                  <button onClick={(e) => onAction(e, 'editar', ciclo)} className="w-full text-left px-4 py-2.5 text-xs font-bold uppercase tracking-wide text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 flex items-center gap-2 transition-colors">
                    <Edit size={14} /> Editar
                  </button>
                  <button onClick={(e) => onAction(e, 'arquivar', ciclo)} className="w-full text-left px-4 py-2.5 text-xs font-bold uppercase tracking-wide text-amber-600 dark:text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-900/10 flex items-center gap-2 transition-colors">
                    <Archive size={14} /> Arquivar
                  </button>
                  <div className="h-px bg-zinc-100 dark:bg-zinc-800 my-1" />
                  <button onClick={(e) => onAction(e, 'excluir', ciclo)} className="w-full text-left px-4 py-2.5 text-xs font-bold uppercase tracking-wide text-red-600 dark:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/10 flex items-center gap-2 transition-colors">
                    <Trash2 size={14} /> Excluir Tudo
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        <div className="mb-3 sm:mb-4 flex-grow">
          <h3 className="text-lg sm:text-xl md:text-2xl font-black text-zinc-900 dark:text-white leading-tight mb-2 line-clamp-2 group-hover:text-red-600 dark:group-hover:text-red-500 transition-colors">{ciclo.nome}</h3>
          <div className="hidden sm:block w-8 h-1 bg-red-500 rounded-full mb-4 group-hover:w-16 transition-all duration-500" />
          <div className="flex flex-row sm:flex-col gap-3 sm:gap-2 mb-3 sm:mb-4 flex-wrap">
            <div className="flex items-center gap-1.5 sm:gap-2 text-zinc-500 dark:text-zinc-400 text-xs md:text-sm">
              <Clock size={12} className="text-red-500/70 sm:w-[14px] sm:h-[14px]" />
              <span className="font-mono font-bold text-zinc-700 dark:text-zinc-300">{ciclo.cargaHorariaSemanalTotal}h</span>
              <span className="text-[9px] sm:text-[10px] uppercase font-bold opacity-70">Meta</span>
            </div>
            <div className="flex items-center gap-1.5 sm:gap-2 text-zinc-500 dark:text-zinc-400 text-xs md:text-sm">
              <Calendar size={12} className="text-red-500/70 sm:w-[14px] sm:h-[14px]" />
              <span className="text-[9px] sm:text-[10px] md:text-xs font-medium truncate">
                {new Date(ciclo.dataCriacao?.toDate ? ciclo.dataCriacao.toDate() : Date.now()).toLocaleDateString('pt-BR')}
              </span>
            </div>
          </div>

          <div className="mt-auto">
            <div className="flex justify-between items-end mb-1">
              <span className="text-[10px] sm:text-[12px] font-bold text-zinc-400 uppercase flex items-center gap-1">
                <BarChart3 size={12} className="sm:w-[15px] sm:h-[15px]" /> Progresso
              </span>
              <span className="text-[12px] sm:text-[15px] font-bold text-zinc-600 dark:text-zinc-300">
                {totalHoras}h <span className="text-zinc-400 font-normal">/ {ciclo.cargaHorariaSemanalTotal}h</span>
              </span>
            </div>
            <div className="h-1.5 sm:h-2 w-full bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden shadow-inner">
              <div className={`h-full rounded-full transition-all duration-700 ${progressoPercent >= 100 ? 'bg-emerald-500' : 'bg-red-500'}`} style={{ width: `${progressoPercent}%` }} />
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between pt-3 sm:pt-4 border-t border-zinc-100 dark:border-zinc-800/50 mt-1 sm:mt-2">
          <span className="text-[9px] sm:text-[10px] font-black text-zinc-400 uppercase tracking-widest group-hover:text-red-500 transition-colors">Acessar</span>
          <div className={`w-6 h-6 sm:w-8 sm:h-8 rounded-full flex items-center justify-center transition-all duration-300 ${ciclo.ativo ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/30' : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-400 group-hover:bg-red-500 group-hover:text-white'}`}>
            <ArrowRight size={14} className="sm:w-4 sm:h-4" />
          </div>
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// LISTA DE CICLOS
// ============================================================================
function CiclosList({
  onCicloClick,
  user,
  onCicloAtivado,
  registrosEstudo,
  isTimerActive,
  hideHeader = false,
  onRequestCreate = null,
  onRequestEdit = null,
  compact = false,
}) {
  useForceUnlock();
  const [ciclos, setCiclos] = useState([]);
  const [loadingList, setLoadingList] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [menuAberto, setMenuAberto] = useState(null);

  const [cicloParaArquivar, setCicloParaArquivar] = useState(null);
  const [cicloParaExcluir, setCicloParaExcluir] = useState(null);
  const [cicloParaEditar, setCicloParaEditar] = useState(null);
  const [cicloParaDesativar, setCicloParaDesativar] = useState(null); // ← novo estado

  const [deleteLoading, setDeleteLoading] = useState(false);
  const [timerActiveWarning, setTimerActiveWarning] = useState(false);
  const canUseInlineCreate = typeof onRequestCreate !== 'function';
  const canUseInlineEdit = typeof onRequestEdit !== 'function';
  const containerClassName = compact ? 'p-0 animate-fade-in' : 'p-0 min-h-[50vh] animate-fade-in pb-12';

  // ← desativarCiclo extraído do hook
  const { ativarCiclo, desativarCiclo, arquivarCiclo, loading: actionLoading, error: actionError } = useCiclos(user);

  useEffect(() => {
    const closeMenu = () => setMenuAberto(null);
    document.addEventListener('click', closeMenu);
    return () => document.removeEventListener('click', closeMenu);
  }, []);

  useEffect(() => {
    if (!user) { setLoadingList(false); return; }
    setLoadingList(true);
    const ciclosRef = collection(db, 'users', user.uid, 'ciclos');
    const q = query(ciclosRef, orderBy('dataCriacao', 'desc'));
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const ciclosData = [];
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        if (!data.arquivado) ciclosData.push({ id: doc.id, ...data });
      });
      setCiclos(ciclosData);
      setLoadingList(false);
    }, (error) => { console.error("Erro ao buscar ciclos: ", error); setLoadingList(false); });
    return () => unsubscribe();
  }, [user]);

  const sortedCiclos = useMemo(() => {
    return [...ciclos].sort((a, b) => {
      if (a.ativo && !b.ativo) return -1;
      if (!a.ativo && b.ativo) return 1;
      return 0;
    });
  }, [ciclos]);

  const handleMenuToggle = (e, cicloId) => {
    e.stopPropagation();
    setMenuAberto(prev => (prev === cicloId ? null : cicloId));
  };

  const handleAction = async (e, action, ciclo) => {
    e.stopPropagation();
    setMenuAberto(null);

    if (action === 'ativar') {
      if (actionLoading) return;
      if (isTimerActive) { setTimerActiveWarning(true); return; }
      const sucesso = await ativarCiclo(ciclo.id);
      if (sucesso && onCicloAtivado) onCicloAtivado(ciclo.id);

    } else if (action === 'desativar') {
      // Abre modal de confirmação leve
      setCicloParaDesativar(ciclo);

    } else if (action === 'editar') {
      if (canUseInlineEdit) setCicloParaEditar(ciclo);
      else onRequestEdit(ciclo);

    } else if (action === 'arquivar') {
      setCicloParaArquivar(ciclo);

    } else if (action === 'excluir') {
      setCicloParaExcluir(ciclo);
    }
  };

  const handleConfirmarDesativacao = async () => {
    if (actionLoading || !cicloParaDesativar) return;
    await desativarCiclo(cicloParaDesativar.id);
    setCicloParaDesativar(null);
  };

  const handleConfirmarArquivamento = async () => {
    if (actionLoading || !cicloParaArquivar) return;
    await arquivarCiclo(cicloParaArquivar.id);
    setCicloParaArquivar(null);
  };

  const handleConfirmarExclusao = async () => {
    if (deleteLoading || !cicloParaExcluir) return;
    setDeleteLoading(true);
    const { id } = cicloParaExcluir;
    try {
      const registrosQuery = query(collection(db, 'users', user.uid, 'registrosEstudo'), where('cicloId', '==', id));
      const snapshot = await getDocs(registrosQuery);
      const batch = writeBatch(db);
      snapshot.docs.forEach((docRef) => { batch.delete(docRef.ref); });
      const cicloRef = doc(db, 'users', user.uid, 'ciclos', id);
      batch.delete(cicloRef);
      await batch.commit();
    } catch (error) {
      console.error("Erro ao excluir ciclo:", error);
      alert("Erro ao excluir ciclo. Tente novamente.");
    } finally {
      setDeleteLoading(false);
      setCicloParaExcluir(null);
    }
  };

  const handleCreateRequest = () => {
    if (canUseInlineCreate) setShowCreateModal(true);
    else onRequestCreate();
  };

  if (showCreateModal && canUseInlineCreate) {
    return (
      <div className={containerClassName}>
        <CicloCreateWizard
          onClose={() => setShowCreateModal(false)}
          user={user}
          onCicloAtivado={onCicloAtivado}
        />
      </div>
    );
  }

  if (cicloParaEditar && canUseInlineEdit) {
    return (
      <div className={containerClassName}>
        <CicloEditModal
          onClose={() => setCicloParaEditar(null)}
          user={user}
          ciclo={cicloParaEditar}
          onCicloAtivado={onCicloAtivado}
        />
      </div>
    );
  }

  return (
    <div className={containerClassName}>
      <AnimatePresence>
        {/* Warning: timer ativo */}
        {timerActiveWarning && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[60] flex justify-center items-center p-4" onClick={() => setTimerActiveWarning(false)}>
            <div className="bg-white dark:bg-zinc-950 rounded-2xl shadow-2xl border border-zinc-200 dark:border-zinc-800 w-full max-w-md overflow-hidden" onClick={(e) => e.stopPropagation()}>
              <div className="bg-amber-500/10 p-6 flex flex-col items-center border-b border-amber-500/20">
                <div className="w-16 h-16 bg-amber-500/20 text-amber-600 dark:text-amber-500 rounded-full flex items-center justify-center mb-4"><AlertTriangle size={32} /></div>
                <h2 className="text-xl font-black text-zinc-900 dark:text-white uppercase tracking-tight">Cronômetro Ativo</h2>
              </div>
              <div className="p-6 text-center">
                <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-6">Não é possível ativar outro ciclo enquanto houver um <strong className="text-zinc-900 dark:text-white">cronômetro em andamento</strong>. Finalize ou cancele a sessão atual primeiro.</p>
                <button onClick={() => setTimerActiveWarning(false)} className="w-full px-4 py-3 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 rounded-xl font-bold text-xs uppercase tracking-wider hover:opacity-90 transition-opacity">Entendi</button>
              </div>
            </div>
          </div>
        )}

        {/* Modal desativar */}
        {cicloParaDesativar && (
          <ModalConfirmacaoDesativacao
            ciclo={cicloParaDesativar}
            onClose={() => setCicloParaDesativar(null)}
            onConfirm={handleConfirmarDesativacao}
            loading={actionLoading}
          />
        )}

        {cicloParaArquivar && <ModalConfirmacaoArquivamento ciclo={cicloParaArquivar} onClose={() => setCicloParaArquivar(null)} onConfirm={handleConfirmarArquivamento} loading={actionLoading} />}
        {cicloParaExcluir && <ModalConfirmacaoExclusao ciclo={cicloParaExcluir} onClose={() => setCicloParaExcluir(null)} onConfirm={handleConfirmarExclusao} loading={deleteLoading} />}
      </AnimatePresence>

      {!hideHeader && (
        <div className="mb-6 md:mb-8 flex flex-col md:flex-row justify-between items-start md:items-end gap-4 border-b border-zinc-200 dark:border-zinc-800 pb-4 md:pb-6">
          <div>
            <div className="flex items-center gap-3 mb-1 md:mb-2">
              <div className="p-2 md:p-2.5 bg-red-100 dark:bg-red-900/20 text-red-600 dark:text-red-500 rounded-xl">
                <Map size={24} className="md:w-7 md:h-7" strokeWidth={2} />
              </div>
              <h1 className="text-2xl md:text-3xl font-black text-zinc-800 dark:text-white tracking-tight uppercase">Meus Ciclos</h1>
            </div>
          </div>
          <button
            onClick={handleCreateRequest}
            disabled={actionLoading}
            className="group relative px-4 py-2.5 md:px-5 md:py-3 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 rounded-xl font-bold shadow-lg hover:shadow-xl transition-all transform hover:-translate-y-0.5 active:translate-y-0 flex items-center gap-2 overflow-hidden shrink-0 text-sm md:text-base w-full md:w-auto justify-center"
          >
            <div className="absolute inset-0 bg-white/20 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-500" />
            <Plus size={18} className="md:w-5 md:h-5 group-hover:rotate-90 transition-transform" />
            <span>Novo Ciclo</span>
          </button>
        </div>
      )}

      {actionError && (
        <div className="mb-6 p-4 bg-red-100 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 rounded-xl flex items-center gap-3">
          <AlertTriangle size={20} /><p>{actionError}</p>
        </div>
      )}

      {loadingList ? (
        <div className="flex justify-center py-20"><div className="animate-spin rounded-full h-10 w-10 md:h-12 md:w-12 border-b-2 border-red-500" /></div>
      ) : ciclos.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center bg-zinc-50 dark:bg-zinc-900/50 rounded-3xl border-2 border-dashed border-zinc-200 dark:border-zinc-800">
          <BookOpen size={40} className="md:w-12 md:h-12 text-zinc-300 mb-4" />
          <h3 className="text-lg md:text-xl font-bold text-zinc-700 dark:text-zinc-300 mb-1">Nenhum ciclo encontrado</h3>
          <p className="text-zinc-500 text-sm mb-6">Crie seu primeiro plano de estudos agora.</p>
          <button onClick={handleCreateRequest} className="px-6 py-2 bg-red-600 text-white rounded-lg font-bold text-sm hover:bg-red-700">Criar Ciclo</button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-6">
          {sortedCiclos.map((ciclo) => (
            <CicloCard
              key={ciclo.id}
              ciclo={ciclo}
              onClick={onCicloClick}
              onMenuToggle={handleMenuToggle}
              isMenuOpen={menuAberto === ciclo.id}
              onAction={handleAction}
              registrosEstudo={registrosEstudo}
              isTimerActive={isTimerActive}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default CiclosList;
