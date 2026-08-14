import React, { useState, useEffect } from 'react';
import { db } from '../../firebaseConfig';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import {
  Lock, MessageSquare, Megaphone, Quote, Bug, FileText, Lightbulb, HelpCircle,
  Database, AlertTriangle, RefreshCw, GitMerge, SlidersHorizontal, X, ShieldCheck
} from 'lucide-react';

// Importação dos Modais
import HeaderOcorrencias from './HeaderOcorrencias';
import HeaderFrases from './HeaderFrases';
import HeaderBroadcast from './HeaderBroadcast';
import MigrarTemplateModal from './MigrarTemplateModal';

const HeaderAdmin = ({
  onRecalculateStats,
  broadcastDraft = null,
  filters,
  filterOptions = {},
  onFilterChange,
  onResetFilters,
}) => {
  const [showInbox, setShowInbox]           = useState(false);
  const [showBroadcast, setShowBroadcast]   = useState(false);
  const [showQuotes, setShowQuotes]         = useState(false);
  const [showMigrar, setShowMigrar]         = useState(false);
  const [showFilters, setShowFilters]       = useState(false);

  const [recalcMode, setRecalcMode] = useState('idle');
  const [counts, setCounts]         = useState({ total: 0, bug: 0, ideia: 0, edital: 0, duvida: 0 });
  const [quotesCount, setQuotesCount] = useState(0);

  const handleSecretClick = async () => {
    if (recalcMode === 'loading') return;
    if (recalcMode === 'idle') {
      setRecalcMode('confirm');
      setTimeout(() => {
        setRecalcMode((prev) => prev === 'loading' ? 'loading' : 'idle');
      }, 3000);
    } else if (recalcMode === 'confirm') {
      setRecalcMode('loading');
      if (onRecalculateStats) await onRecalculateStats();
      setRecalcMode('idle');
    }
  };

  useEffect(() => {
    const q = query(collection(db, 'system_feedback'), where('status', '==', 'pendente'));
    const unsub = onSnapshot(q, (snap) => {
      let newCounts = { total: 0, bug: 0, ideia: 0, edital: 0, duvida: 0 };
      snap.docs.forEach(doc => {
        const data = doc.data();
        newCounts.total++;
        if (data.type) {
          const type = data.type.toLowerCase();
          if (newCounts[type] !== undefined) newCounts[type]++;
        }
      });
      setCounts(newCounts);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    const q = query(collection(db, 'system_quotes'));
    const unsub = onSnapshot(q, (snap) => setQuotesCount(snap.size));
    return () => unsub();
  }, []);

  useEffect(() => {
    if (broadcastDraft?.key) {
      setShowBroadcast(true);
    }
  }, [broadcastDraft]);

  return (
    <>
      <HeaderOcorrencias isOpen={showInbox}     onClose={() => setShowInbox(false)} />
      <HeaderBroadcast   isOpen={showBroadcast} onClose={() => setShowBroadcast(false)} segmentDraft={broadcastDraft?.segment || null} />
      <HeaderFrases      isOpen={showQuotes}    onClose={() => setShowQuotes(false)} />
      <MigrarTemplateModal isOpen={showMigrar}  onClose={() => setShowMigrar(false)} />

      <header className="admin-control-header relative sticky top-3 z-40 flex flex-col items-start justify-between gap-5 overflow-visible rounded-xl border-2 border-l-4 border-zinc-200 !border-l-red-500/20 bg-white/95 px-5 py-5 shadow-soft backdrop-blur-xl dark:border-white/10 dark:!border-l-red-500/25 dark:bg-card-dark/95 sm:px-6 lg:flex-row lg:items-center">
        <div className="flex min-w-0 items-center gap-4">
          <div className="hidden h-14 w-14 shrink-0 items-center justify-center rounded-[20px] bg-gradient-to-br from-red-500 to-red-700 text-white shadow-lg shadow-red-600/20 sm:flex">
            <ShieldCheck size={27} />
          </div>
          <div className="min-w-0">
          <div className="mb-1.5 flex items-center gap-2">
            <div className="inline-flex items-center gap-2 rounded-full border border-red-200 bg-red-50 px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.2em] text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300">
              <Lock size={10} /> Área administrativa
            </div>

            {/* Botão Secreto (Bala de Prata) */}
            {onRecalculateStats && (
              <button
                onClick={handleSecretClick}
                className={`
                  ml-1 p-1.5 rounded-lg transition-all duration-300
                  ${recalcMode === 'idle'    ? 'text-zinc-300 dark:text-zinc-800 hover:text-zinc-400 dark:hover:text-zinc-700 opacity-50 hover:opacity-100' : ''}
                  ${recalcMode === 'confirm' ? 'bg-red-500 text-white shadow-lg shadow-red-500/40 animate-pulse' : ''}
                  ${recalcMode === 'loading' ? 'bg-blue-500 text-white cursor-wait' : ''}
                `}
                title={
                  recalcMode === 'idle'    ? 'Recalibrar Sistema (Duplo Clique)' :
                  recalcMode === 'confirm' ? 'CONFIRMAR RECÁLCULO?' :
                  'Processando...'
                }
              >
                {recalcMode === 'idle'    && <Database size={12} />}
                {recalcMode === 'confirm' && <AlertTriangle size={12} strokeWidth={3} />}
                {recalcMode === 'loading' && <RefreshCw size={12} className="animate-spin" />}
              </button>
            )}
          </div>

          <h1 className="flex items-center gap-2 text-2xl font-black tracking-[-0.04em] text-zinc-950 dark:text-white sm:text-3xl">
            Painel de controle <span className="text-red-600">.</span>
          </h1>
          <p className="mt-1 text-xs font-semibold text-zinc-500 dark:text-zinc-400">Operação, comunicação e inteligência acadêmica em um só lugar.</p>
          </div>
        </div>

        <div className="admin-control-actions flex w-full flex-wrap items-center gap-2 lg:w-auto lg:justify-end">

          <button
            type="button"
            onClick={() => setShowFilters((current) => !current)}
            aria-expanded={showFilters}
            className={`admin-control-action relative flex items-center gap-2 rounded-full border px-4 py-2.5 font-bold transition-all active:scale-95 ${showFilters ? 'border-red-300 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300' : 'border-zinc-200 bg-zinc-50 text-zinc-700 hover:border-red-200 hover:bg-white dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200'}`}
          >
            <SlidersHorizontal size={18} />
            <span>Filtros</span>
            {filters?.windowDays ? <span className="rounded-md bg-zinc-100 px-1.5 py-0.5 text-[10px] font-black text-zinc-500 dark:bg-zinc-800 dark:text-zinc-300">{filters.windowDays}d</span> : null}
          </button>

          {/* ── NOVO: Botão Migrar Template ── */}
          <button
            onClick={() => setShowMigrar(true)}
            className="admin-control-action group relative flex items-center gap-2 rounded-full border border-zinc-200 bg-zinc-50 px-4 py-2.5 font-bold text-zinc-700 transition-all hover:border-violet-300 hover:bg-white hover:text-violet-600 active:scale-95 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:border-violet-800 dark:hover:text-violet-400"
            title="Migrar ciclos de um template para outro"
          >
            <GitMerge size={18} className="group-hover:text-violet-500 transition-colors" />
            <span className="hidden sm:inline">Migrar Template</span>
          </button>

          {/* Botão Ocorrências */}
          <div className="relative group">
            <button onClick={() => setShowInbox(true)} className="admin-control-action relative flex items-center gap-2 rounded-full border border-zinc-200 bg-zinc-50 px-4 py-2.5 font-bold text-zinc-700 transition-all hover:border-red-200 hover:bg-white active:scale-95 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:border-red-900/50">
              <div className="relative">
                <MessageSquare size={18} className="group-hover:text-red-600 transition-colors" />
                {counts.total > 0 && (
                  <span className="absolute -top-2 -right-2 flex h-4 w-4">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-4 w-4 bg-red-600 text-[9px] text-white font-black items-center justify-center border-2 border-white dark:border-zinc-900">{counts.total > 9 ? '9+' : counts.total}</span>
                  </span>
                )}
              </div>
              <span className="hidden sm:inline group-hover:text-red-600 transition-colors">Ocorrências</span>
            </button>

            {counts.total > 0 && (
              <div className="absolute top-full right-0 mt-2 w-48 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-xl p-2 opacity-0 group-hover:opacity-100 invisible group-hover:visible transition-all transform origin-top-right z-50">
                <p className="text-[10px] font-bold uppercase text-zinc-400 px-2 mb-1 tracking-widest">Pendentes</p>
                <div className="space-y-1">
                  {counts.bug > 0    && <div className="flex items-center justify-between px-2 py-1.5 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 text-xs font-bold"><span className="flex items-center gap-1"><Bug size={12} /> Bugs</span><span>{counts.bug}</span></div>}
                  {counts.edital > 0 && <div className="flex items-center justify-between px-2 py-1.5 rounded-lg bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300 text-xs font-bold"><span className="flex items-center gap-1"><FileText size={12} /> Editais</span><span>{counts.edital}</span></div>}
                  {counts.ideia > 0  && <div className="flex items-center justify-between px-2 py-1.5 rounded-lg bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300 text-xs font-bold"><span className="flex items-center gap-1"><Lightbulb size={12} /> Ideias</span><span>{counts.ideia}</span></div>}
                  {counts.duvida > 0 && <div className="flex items-center justify-between px-2 py-1.5 rounded-lg bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 text-xs font-bold"><span className="flex items-center gap-1"><HelpCircle size={12} /> Dúvidas</span><span>{counts.duvida}</span></div>}
                </div>
              </div>
            )}
          </div>

          {/* Botão Frases */}
          <button
            onClick={() => setShowQuotes(true)}
            className="admin-control-action group relative flex items-center gap-2 rounded-full border border-zinc-200 bg-zinc-50 px-4 py-2.5 font-bold text-zinc-700 transition-all hover:border-violet-200 hover:bg-white hover:text-violet-600 active:scale-95 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:border-violet-900/50 dark:hover:text-violet-400"
          >
            <Quote size={18} className="group-hover:text-violet-500 transition-colors" />
            <span className="hidden sm:inline">Frases</span>
            {quotesCount > 0 && (
              <span className="ml-0.5 text-[10px] font-black text-violet-500 bg-violet-50 dark:bg-violet-900/20 px-1.5 py-0.5 rounded-md border border-violet-200 dark:border-violet-800/40">
                {quotesCount}
              </span>
            )}
          </button>

          {/* Botão Broadcast */}
          <button
            onClick={() => setShowBroadcast(true)}
            className="admin-control-action flex items-center gap-2 rounded-full bg-zinc-950 px-4 py-2.5 font-bold text-white shadow-lg shadow-zinc-950/15 transition-all hover:-translate-y-0.5 hover:bg-red-600 dark:bg-white dark:text-zinc-950 dark:hover:bg-red-500 dark:hover:text-white"
          >
            <Megaphone size={18} /> <span className="hidden sm:inline">Broadcast</span>
          </button>
        </div>

        {showFilters && filters && (
          <div className="absolute left-0 right-0 top-[calc(100%+0.65rem)] z-50 rounded-xl border-2 border-l-4 border-zinc-200 !border-l-red-500/20 bg-white p-4 shadow-2xl dark:border-white/10 dark:!border-l-red-500/25 dark:bg-card-dark md:left-auto md:right-0 md:w-[760px]">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-black text-zinc-900 dark:text-white">Filtrar indicadores</p>
                <p className="text-[11px] font-medium text-zinc-400">O período e os recortes permanecem ativos ao trocar de aba.</p>
              </div>
              <button type="button" onClick={() => setShowFilters(false)} aria-label="Fechar filtros" className="rounded-xl p-2 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-900 dark:hover:text-zinc-200"><X size={17} /></button>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
              <label className="space-y-1">
                <span className="text-[10px] font-black uppercase tracking-[0.14em] text-zinc-400">Período</span>
                <select value={filters.windowDays} onChange={(event) => onFilterChange?.('windowDays', Number(event.target.value))} className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2.5 text-xs font-bold text-zinc-700 outline-none dark:border-zinc-700 dark:bg-zinc-800/70 dark:text-zinc-200">
                  {[30, 60, 90].map((days) => <option key={days} value={days}>{days} dias</option>)}
                </select>
              </label>
              <label className="space-y-1">
                <span className="text-[10px] font-black uppercase tracking-[0.14em] text-zinc-400">Origem</span>
                <select value={filters.contextType} onChange={(event) => onFilterChange?.('contextType', event.target.value)} className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2.5 text-xs font-bold text-zinc-700 outline-none dark:border-zinc-700 dark:bg-zinc-800/70 dark:text-zinc-200">
                  <option value="all">Todas</option>
                  <option value="ciclo">Ciclos</option>
                  <option value="cronograma">Cronogramas</option>
                  <option value="simulado">Simulados</option>
                </select>
              </label>
              <label className="space-y-1">
                <span className="text-[10px] font-black uppercase tracking-[0.14em] text-zinc-400">Perfil</span>
                <select value={filters.userProfile} onChange={(event) => onFilterChange?.('userProfile', event.target.value)} className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2.5 text-xs font-bold text-zinc-700 outline-none dark:border-zinc-700 dark:bg-zinc-800/70 dark:text-zinc-200">
                  <option value="all">Todos</option>
                  {(filterOptions.userProfiles || []).map((profile) => <option key={profile} value={profile}>{profile}</option>)}
                </select>
              </label>
              <label className="space-y-1">
                <span className="text-[10px] font-black uppercase tracking-[0.14em] text-zinc-400">Edital</span>
                <select value={filters.templateId} onChange={(event) => onFilterChange?.('templateId', event.target.value)} className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2.5 text-xs font-bold text-zinc-700 outline-none dark:border-zinc-700 dark:bg-zinc-800/70 dark:text-zinc-200">
                  <option value="all">Todos</option>
                  {(filterOptions.templateIds || []).map((templateId) => <option key={templateId} value={templateId}>{templateId === 'manual' ? 'Manual' : templateId}</option>)}
                </select>
              </label>
              <div className="flex items-end">
                <button type="button" onClick={onResetFilters} className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2.5 text-xs font-black uppercase tracking-[0.12em] text-zinc-500 hover:text-red-600 dark:border-zinc-700 dark:bg-zinc-800/70">Limpar</button>
              </div>
            </div>
          </div>
        )}
      </header>
    </>
  );
};

export default HeaderAdmin;
