import React, { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  AlertOctagon,
  ArrowRight,
  Archive,
  BookOpen,
  Calendar,
  CalendarClock,
  Clock,
  FilePenLine,
  MoreVertical,
  PauseCircle,
  Plus,
  RefreshCw,
  RotateCw,
  Target,
  Trash2,
  Trophy,
  Zap,
} from 'lucide-react';
import {
  collection,
  doc,
  onSnapshot,
  query,
  updateDoc,
  writeBatch,
} from 'firebase/firestore';

import { db } from '../../firebaseConfig';
import { resolveLogoUrl } from '../admin/config/editalAssets';
import { useEditaisCatalog } from '../../hooks/useEditaisCatalog';
import EmptyStateCard from '../shared/EmptyStateCard';
import CicloCreateWizard from './CicloCreateWizard/CicloCreateWizard';
import CicloEditModal from './CicloEditModal';
import { useCiclos } from '../../hooks/useCiclos';
import { deletePlanStudyRecords } from '../../services/planDeletion';

const formatDate = (value) => {
  if (!value) return '-';
  const date = value?.toDate ? value.toDate() : new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' });
};

const formatHours = (value) => {
  const number = Number(value || 0);
  if (!number) return '0h';
  return Number.isInteger(number) ? `${number}h` : `${number.toFixed(1).replace('.', ',')}h`;
};

const getTs = (item) => {
  const value = item?.dataCriacao || item?.criadoEm;
  if (!value) return 0;
  if (value?.toDate) return value.toDate().getTime();
  if (value?.seconds) return value.seconds * 1000;
  return new Date(value).getTime() || 0;
};

const ModalConfirmacao = ({ item, title, description, icon: Icon, tone = 'red', label, onClose, onConfirm, loading }) => {
  if (!item) return null;
  const toneClass = tone === 'zinc'
    ? 'bg-zinc-100 dark:bg-zinc-800/60 border-zinc-200 dark:border-zinc-700 text-zinc-500'
    : 'bg-red-600/10 border-red-500/20 text-red-600';
  const buttonClass = tone === 'zinc'
    ? 'bg-zinc-700 hover:bg-zinc-800 dark:bg-zinc-600 dark:hover:bg-zinc-500'
    : 'bg-red-600 hover:bg-red-700';

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-md overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-2xl dark:border-zinc-800 dark:bg-card-dark" onClick={(event) => event.stopPropagation()}>
        <div className={`${toneClass} flex flex-col items-center border-b p-6`}>
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-white/50 dark:bg-zinc-800/55">
            <Icon size={32} />
          </div>
          <h2 className="text-xl font-black uppercase tracking-tight text-zinc-900 dark:text-white">{title}</h2>
        </div>
        <div className="p-6 text-center">
          <p className="mb-6 text-sm text-zinc-600 dark:text-zinc-400">{description}</p>
          <div className="flex gap-3">
            <button type="button" onClick={onClose} disabled={loading} className="flex-1 rounded-xl bg-zinc-100 px-4 py-3 text-xs font-bold uppercase tracking-wider text-zinc-700 transition-colors hover:bg-zinc-200 disabled:opacity-60 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700">
              Cancelar
            </button>
            <button type="button" onClick={onConfirm} disabled={loading} className={`flex-1 rounded-xl px-4 py-3 text-xs font-bold uppercase tracking-wider text-white shadow-lg transition-all disabled:opacity-60 ${buttonClass}`}>
              {loading ? 'Aguarde...' : label}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

const CicloCard = ({ ciclo, editaisMap, registrosEstudo = [], onOpen, onMenuToggle, isMenuOpen, onAction, isTimerActive }) => {
  const logo = resolveLogoUrl({ ciclo, editaisMap });
  const concluidoCount = Number(ciclo.conclusoes || 0);
  const totalBlocos = Number(
    ciclo.totalSessoesCiclo ||
    ciclo.ordemSessoes?.length ||
    ciclo.disciplinas?.reduce?.((acc, disciplina) => acc + Number(disciplina.sessoesPorCiclo || 0), 0) ||
    0
  );
  const concluidos = Array.isArray(ciclo.sessoesConcluidas) ? ciclo.sessoesConcluidas.length : 0;
  const progressoPorSessao = totalBlocos > 0 ? Math.round((concluidos / totalBlocos) * 100) : 0;

  const { totalHoras, progressoHoras } = useMemo(() => {
    const registros = registrosEstudo.filter((registro) => registro.cicloId === ciclo.id && !registro.conclusaoId && registro.tipoEstudo !== 'check_manual');
    const minutos = registros.reduce((acc, registro) => acc + Number(registro.tempoEstudadoMinutos || registro.duracaoMinutos || 0), 0);
    const horas = Math.round((minutos / 60) * 10) / 10;
    const meta = Number(ciclo.cargaHorariaSemanalTotal || ciclo.cargaHorariaTotal || 0);
    return {
      totalHoras: horas,
      progressoHoras: meta > 0 ? Math.min(100, Math.round((horas / meta) * 100)) : progressoPorSessao,
    };
  }, [ciclo, registrosEstudo, progressoPorSessao]);

  const progresso = Math.max(progressoPorSessao, progressoHoras);
  const canOpen = typeof onOpen === 'function' && ciclo.ativo;
  const dataInicio = ciclo.dataInicio || ciclo.inicio || ciclo.dataCriacao || ciclo.criadoEm;
  const dataFim = ciclo.dataFim || ciclo.termino || ciclo.dataProva || ciclo.dataFinal;
  const terminoLabel = dataFim ? formatDate(dataFim) : 'Em aberto';
  const cargaSemanal = Number(ciclo.cargaHorariaSemanalTotal || ciclo.cargaHorariaSemanal || ciclo.horasSemanais || ciclo.horasTotais || 0);

  return (
    <div onClick={() => canOpen && onOpen(ciclo.id, ciclo)} className={`group relative flex h-full min-h-[170px] flex-col justify-between overflow-hidden rounded-2xl border border-zinc-200 bg-white p-4 transition-all duration-500 hover:-translate-y-1 hover:shadow-2xl dark:border-zinc-800 dark:bg-card-dark sm:min-h-[220px] sm:p-5 ${canOpen ? 'cursor-pointer' : 'cursor-default'}`}>
      <div className="absolute bottom-0 top-0 left-0 z-20 w-1 bg-transparent transition-colors duration-300 group-hover:bg-red-500" />

      {logo ? (
        <div className="pointer-events-none absolute bottom-0 right-0 z-0 h-32 w-32 opacity-20 saturate-150 transition-all duration-700 ease-out group-hover:scale-110 group-hover:opacity-35 sm:h-24 sm:w-24 md:h-36 md:w-36 md:opacity-20">
          <img src={logo} alt="" className="h-full w-full object-contain" onError={(event) => { event.currentTarget.style.display = 'none'; }} />
        </div>
      ) : (
        <div className="pointer-events-none absolute -bottom-6 -right-6 z-0 text-red-500/10 transition-all duration-700 ease-out group-hover:scale-125 group-hover:rotate-[-10deg] dark:text-red-500/5">
          <RefreshCw strokeWidth={1.5} size={128} className="sm:h-[140px] sm:w-[140px]" />
        </div>
      )}

      <div className="relative z-10 flex h-full flex-col">
        <div className="mb-3 flex items-start justify-between sm:mb-4">
          <div className="flex flex-wrap items-center gap-2">
            <div className={`flex items-center gap-1.5 rounded-md border px-2 py-1 text-[10px] font-black uppercase tracking-widest sm:px-2.5 sm:text-[11px] ${ciclo.ativo ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.2)]' : 'border-zinc-200 bg-zinc-100 text-zinc-500 dark:border-zinc-700 dark:bg-zinc-800'}`}>
              {ciclo.ativo && <span className="relative flex h-1.5 w-1.5"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" /><span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" /></span>}
              {ciclo.ativo ? 'ATIVO' : 'INATIVO'}
            </div>
            <div className="flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-zinc-100 px-2 py-1 text-[10px] font-black uppercase tracking-widest text-zinc-500 dark:border-zinc-700 dark:bg-zinc-800/50 sm:text-[11px]">
              <RotateCw size={10} /> {concluidoCount} voltas
            </div>
          </div>
          <div className="relative">
            <button type="button" onClick={(event) => onMenuToggle(event, ciclo.id)} className="-mr-2 -mt-2 rounded-full p-1.5 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-800 dark:hover:bg-zinc-800 dark:hover:text-white sm:p-2">
              <MoreVertical size={18} className="sm:h-5 sm:w-5" />
            </button>
            <AnimatePresence>
              {isMenuOpen && (
                <motion.div initial={{ opacity: 0, y: 5, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} onClick={(event) => event.stopPropagation()} className="absolute right-0 top-8 z-50 w-44 overflow-hidden rounded-xl border border-zinc-200 bg-white py-1 shadow-xl ring-1 ring-black/5 dark:border-zinc-800 dark:bg-card-dark sm:w-52">
                  {ciclo.ativo && <button type="button" onClick={(event) => onAction(event, 'desativar', ciclo)} className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-xs font-bold uppercase tracking-wide text-zinc-500 transition-colors hover:bg-zinc-50 dark:text-zinc-400 dark:hover:bg-zinc-800/60"><PauseCircle size={14} /> Desativar</button>}
                  <button type="button" onClick={(event) => onAction(event, 'arquivar', ciclo)} className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-xs font-bold uppercase tracking-wide text-zinc-500 transition-colors hover:bg-zinc-50 dark:text-zinc-400 dark:hover:bg-zinc-800/60"><Archive size={14} /> Arquivar</button>
                  <div className="my-1 h-px bg-zinc-100 dark:bg-zinc-800" />
                  <button type="button" onClick={(event) => onAction(event, 'excluir', ciclo)} className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-xs font-bold uppercase tracking-wide text-red-600 transition-colors hover:bg-red-50 dark:text-red-500 dark:hover:bg-red-900/10"><Trash2 size={14} /> Excluir</button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        <div className="mb-3 flex-grow sm:mb-4">
          <h3 className="mb-2 line-clamp-2 text-lg font-black leading-tight text-zinc-900 transition-colors group-hover:text-red-600 dark:text-white dark:group-hover:text-red-500 sm:text-xl md:text-2xl">{ciclo.nome || 'Ciclo sem nome'}</h3>
          <div className="mb-4 hidden h-1 w-8 rounded-full bg-red-500 transition-all duration-500 group-hover:w-16 sm:block" />
          <div className="mb-3 grid grid-cols-2 gap-1.5 sm:mb-4 sm:gap-2">
            <div className="flex min-w-0 items-center gap-1.5 rounded-lg border border-zinc-200/70 bg-zinc-50/80 px-2 py-1.5 text-zinc-500 dark:border-zinc-700 dark:bg-zinc-800/55 dark:text-zinc-300">
              <CalendarClock size={14} className="shrink-0 text-red-500/70" />
              <span className="min-w-0 text-[10px] font-bold sm:text-xs">INÍCIO: {formatDate(dataInicio)}</span>
            </div>
            <div className="flex min-w-0 items-center gap-1.5 rounded-lg border border-zinc-200/70 bg-zinc-50/80 px-2 py-1.5 text-zinc-500 dark:border-zinc-700 dark:bg-zinc-800/55 dark:text-zinc-300">
              <Target size={14} className="shrink-0 text-red-500/70" />
              <span className="min-w-0 whitespace-nowrap text-[10px] font-bold sm:text-xs">TÉRMINO: {terminoLabel}</span>
            </div>
            <div className="flex min-w-0 items-center gap-1.5 rounded-lg border border-zinc-200/70 bg-zinc-50/80 px-2 py-1.5 text-zinc-500 dark:border-zinc-700 dark:bg-zinc-800/55 dark:text-zinc-300">
              <Clock size={14} className="shrink-0 text-red-500/70" />
              <span className="min-w-0 text-[10px] font-bold sm:text-xs">TEMPO TOTAL: {formatHours(totalHoras)}</span>
            </div>
            <div className="flex min-w-0 items-center gap-1.5 rounded-lg border border-zinc-200/70 bg-zinc-50/80 px-2 py-1.5 text-zinc-500 dark:border-zinc-700 dark:bg-zinc-800/55 dark:text-zinc-300">
              <Calendar size={14} className="shrink-0 text-red-500/70" />
              <span className="min-w-0 text-[10px] font-bold sm:text-xs">CARGA SEMANAL: {formatHours(cargaSemanal)}</span>
            </div>
          </div>

          <div className="mt-auto">
            <div className="mb-1.5 flex items-end justify-between">
              <span className="flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-zinc-400 dark:text-zinc-500 sm:text-[11px]">
                <Trophy size={11} className="sm:h-[13px] sm:w-[13px]" /> Progresso
              </span>
              <span className="text-[11px] font-black tabular-nums text-zinc-600 dark:text-zinc-300 sm:text-[13px]">{progresso}%</span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800/80 sm:h-2">
              <div className="h-full rounded-full bg-red-600 transition-all duration-700" style={{ width: `${progresso}%` }} />
            </div>
          </div>
        </div>

        <div className="mt-1 flex flex-col gap-3 border-t border-zinc-100 pt-3 dark:border-zinc-800/50 sm:mt-2 sm:pt-4">
          <div className="grid grid-cols-2 gap-2">
            {ciclo.ativo ? (
              <button type="button" onClick={(event) => { event.stopPropagation(); if (canOpen) onOpen(ciclo.id, ciclo); }} className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-emerald-600 px-3 py-2 text-[9px] font-black uppercase tracking-widest text-white shadow-lg shadow-emerald-600/20 transition hover:bg-emerald-700 sm:text-[10px]">
                Acessar <ArrowRight size={13} />
              </button>
            ) : (
              <button type="button" onClick={(event) => onAction(event, 'ativar', ciclo)} disabled={isTimerActive} className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-[9px] font-black uppercase tracking-widest text-emerald-700 shadow-sm transition hover:border-emerald-300 hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-emerald-900/40 dark:bg-emerald-950/20 dark:text-emerald-300 dark:hover:bg-emerald-900/30 sm:text-[10px]">
                <Zap size={13} /> Ativar
              </button>
            )}
            <button type="button" onClick={(event) => onAction(event, 'editar', ciclo)} className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-zinc-200 bg-white px-3 py-2 text-[9px] font-black uppercase tracking-widest text-zinc-700 shadow-sm transition hover:border-red-200 hover:bg-red-50 hover:text-red-700 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:border-red-900/40 dark:hover:bg-red-950/20 dark:hover:text-red-400 sm:text-[10px]">
              <FilePenLine size={13} /> Editar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default function CiclosList({
  user,
  onCicloClick,
  onCicloAtivado,
  registrosEstudo = [],
  isTimerActive = false,
  hideHeader = false,
  onRequestCreate = null,
  onRequestEdit = null,
  compact = false,
}) {
  const [ciclos, setCiclos] = useState([]);
  const [loadingList, setLoadingList] = useState(true);
  const [showCreateWizard, setShowCreateWizard] = useState(false);
  const [menuAberto, setMenuAberto] = useState(null);
  const [cicloParaEditar, setCicloParaEditar] = useState(null);
  const [cicloParaExcluir, setCicloParaExcluir] = useState(null);
  const [cicloParaDesativar, setCicloParaDesativar] = useState(null);
  const [timerWarning, setTimerWarning] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [actionError, setActionError] = useState('');
  const editaisMap = useEditaisCatalog();

  const { ativarCiclo, desativarCiclo, loading: actionLoading, error } = useCiclos(user);
  const canUseInlineCreate = typeof onRequestCreate !== 'function';
  const canUseInlineEdit = typeof onRequestEdit !== 'function';
  const containerClassName = compact ? 'p-0 animate-fade-in' : 'p-0 min-h-[50vh] animate-fade-in pb-12';

  useEffect(() => {
    const closeMenu = () => setMenuAberto(null);
    document.addEventListener('click', closeMenu);
    return () => document.removeEventListener('click', closeMenu);
  }, []);

  useEffect(() => {
    if (!user?.uid) {
      setCiclos([]);
      setLoadingList(false);
      return undefined;
    }

    setLoadingList(true);
    const ciclosRef = collection(db, 'users', user.uid, 'ciclos');
    return onSnapshot(query(ciclosRef), { includeMetadataChanges: true }, (snapshot) => {
      const list = snapshot.docs
        .map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }))
        .filter((ciclo) => !ciclo.arquivado)
        .sort((a, b) => getTs(b) - getTs(a));
      setCiclos(list);
      const awaitingServerConfirmation = snapshot.metadata.fromCache
        && list.length === 0
        && navigator.onLine;
      if (!awaitingServerConfirmation) setLoadingList(false);
    }, (err) => {
      console.error('Erro ao buscar ciclos:', err);
      setLoadingList(false);
    });
  }, [user?.uid]);

  const sortedCiclos = useMemo(() => [...ciclos].sort((a, b) => {
    if (a.ativo && !b.ativo) return -1;
    if (!a.ativo && b.ativo) return 1;
    return 0;
  }), [ciclos]);

  const handleCreateRequest = () => {
    if (canUseInlineCreate) setShowCreateWizard(true);
    else onRequestCreate();
  };

  const handleAction = async (event, action, ciclo) => {
    event.stopPropagation();
    setMenuAberto(null);
    setActionError('');

    if (action === 'ativar') {
      if (isTimerActive) {
        setTimerWarning(true);
        return;
      }
      const success = await ativarCiclo(ciclo.id);
      if (success) onCicloAtivado?.(ciclo.id);
      return;
    }

    if (action === 'desativar') {
      setCicloParaDesativar(ciclo);
      return;
    }

    if (action === 'editar') {
      if (canUseInlineEdit) setCicloParaEditar(ciclo);
      else onRequestEdit(ciclo);
      return;
    }

    if (action === 'arquivar') {
      try {
        await updateDoc(doc(db, 'users', user.uid, 'ciclos', ciclo.id), {
          arquivado: true,
          ativo: false,
          dataArquivamento: new Date(),
        });
      } catch (err) {
        console.error('Erro ao arquivar ciclo:', err);
        setActionError('Erro ao arquivar ciclo. Tente novamente.');
      }
      return;
    }

    if (action === 'excluir') setCicloParaExcluir(ciclo);
  };

  const handleConfirmarDesativacao = async () => {
    if (!cicloParaDesativar || actionLoading) return;
    const success = await desativarCiclo(cicloParaDesativar.id);
    if (success) setCicloParaDesativar(null);
  };

  const handleConfirmarExclusao = async () => {
    if (!cicloParaExcluir || deleteLoading || !user?.uid) return;
    setDeleteLoading(true);
    try {
      await deletePlanStudyRecords({
        userId: user.uid,
        planId: cicloParaExcluir.id,
        planType: 'ciclo',
      });
      const batch = writeBatch(db);
      batch.delete(doc(db, 'users', user.uid, 'ciclos', cicloParaExcluir.id));
      await batch.commit();
      setCicloParaExcluir(null);
    } catch (err) {
      console.error('Erro ao excluir ciclo:', err);
      setActionError('Erro ao excluir ciclo. Tente novamente.');
    } finally {
      setDeleteLoading(false);
    }
  };

  if (showCreateWizard && canUseInlineCreate) {
    return (
      <div className={containerClassName}>
        <CicloCreateWizard onClose={() => setShowCreateWizard(false)} user={user} onCicloAtivado={onCicloAtivado} />
      </div>
    );
  }

  if (cicloParaEditar && canUseInlineEdit) {
    return (
      <div className={containerClassName}>
        <CicloEditModal onClose={() => setCicloParaEditar(null)} user={user} ciclo={cicloParaEditar} onCicloAtivado={onCicloAtivado} />
      </div>
    );
  }

  return (
    <div className={containerClassName}>
      <AnimatePresence>
        {timerWarning && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm" onClick={() => setTimerWarning(false)}>
            <div className="w-full max-w-md overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-2xl dark:border-zinc-800 dark:bg-card-dark" onClick={(event) => event.stopPropagation()}>
              <div className="flex flex-col items-center border-b border-amber-500/20 bg-amber-500/10 p-6">
                <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-amber-500/20 text-amber-600"><AlertOctagon size={32} /></div>
                <h2 className="text-xl font-black uppercase tracking-tight text-zinc-900 dark:text-white">Cronometro ativo</h2>
              </div>
              <div className="p-6 text-center">
                <p className="mb-6 text-sm text-zinc-600 dark:text-zinc-400">Finalize ou cancele a sessao atual antes de ativar outro ciclo.</p>
                <button type="button" onClick={() => setTimerWarning(false)} className="w-full rounded-xl bg-zinc-900 px-4 py-3 text-xs font-bold uppercase tracking-wider text-white transition-opacity hover:opacity-90 dark:bg-white dark:text-zinc-900">Entendi</button>
              </div>
            </div>
          </div>
        )}
        <ModalConfirmacao
          item={cicloParaDesativar}
          title="Desativar ciclo?"
          description={`O ciclo "${cicloParaDesativar?.nome || ''}" sera pausado. Seu progresso fica preservado.`}
          icon={PauseCircle}
          tone="zinc"
          label="Desativar"
          onClose={() => setCicloParaDesativar(null)}
          onConfirm={handleConfirmarDesativacao}
          loading={actionLoading}
        />
        <ModalConfirmacao
          item={cicloParaExcluir}
          title="Excluir ciclo?"
          description={`O ciclo "${cicloParaExcluir?.nome || ''}" e os registros vinculados serao apagados permanentemente.`}
          icon={Trash2}
          tone="red"
          label="Excluir"
          onClose={() => setCicloParaExcluir(null)}
          onConfirm={handleConfirmarExclusao}
          loading={deleteLoading}
        />
      </AnimatePresence>

      {!hideHeader && (
        <div className="mb-6 flex flex-col items-start justify-between gap-4 border-b border-zinc-200 pb-4 dark:border-zinc-800 md:mb-8 md:flex-row md:items-end md:pb-6">
          <div>
            <div className="mb-1 flex items-center gap-3 md:mb-2">
              <div className="rounded-xl bg-red-100 p-2 text-red-600 dark:bg-red-900/20 dark:text-red-500 md:p-2.5">
                <BookOpen size={24} className="md:h-7 md:w-7" strokeWidth={2} />
              </div>
              <h1 className="text-2xl font-black uppercase tracking-tight text-zinc-800 dark:text-white md:text-3xl">Meus ciclos</h1>
            </div>
            <p className="pl-1 text-sm text-zinc-500 dark:text-zinc-400">Gerencie seus ciclos de estudo semanais</p>
          </div>
          <button type="button" onClick={handleCreateRequest} className="group relative flex w-full shrink-0 items-center justify-center gap-2 overflow-hidden rounded-xl bg-zinc-900 px-4 py-2.5 text-sm font-bold text-white shadow-lg transition-all hover:-translate-y-0.5 hover:shadow-xl active:translate-y-0 dark:bg-white dark:text-zinc-900 md:w-auto md:px-5 md:py-3 md:text-base">
            <span className="absolute inset-0 translate-x-[-100%] bg-white/20 transition-transform duration-500 group-hover:translate-x-[100%]" />
            <Plus size={18} className="relative z-10 transition-transform group-hover:rotate-90 md:h-5 md:w-5" />
            <span className="relative z-10">Novo Ciclo</span>
          </button>
        </div>
      )}

      {(actionError || error) && (
        <div className="mb-6 flex items-center gap-3 rounded-xl border border-red-200 bg-red-100 p-4 text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400">
          <AlertOctagon size={20} />
          <p>{actionError || error}</p>
        </div>
      )}

      {loadingList ? (
        <div className="flex justify-center py-20"><div className="h-10 w-10 animate-spin rounded-full border-b-2 border-red-500" /></div>
      ) : sortedCiclos.length === 0 ? (
        <EmptyStateCard
          icon={BookOpen}
          title="Nenhum ciclo"
          description="Crie seu primeiro ciclo para organizar a rotacao das disciplinas."
          actionLabel="Criar ciclo"
          onAction={handleCreateRequest}
          variant="cta"
          className="min-h-[320px]"
        />
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 md:gap-6 lg:grid-cols-3">
          {sortedCiclos.map((ciclo) => (
            <CicloCard
              key={ciclo.id}
              ciclo={ciclo}
              editaisMap={editaisMap}
              registrosEstudo={registrosEstudo}
              onOpen={onCicloClick}
              onMenuToggle={(event, id) => {
                event.stopPropagation();
                setMenuAberto((current) => (current === id ? null : id));
              }}
              isMenuOpen={menuAberto === ciclo.id}
              onAction={handleAction}
              isTimerActive={isTimerActive}
            />
          ))}
        </div>
      )}
    </div>
  );
}
