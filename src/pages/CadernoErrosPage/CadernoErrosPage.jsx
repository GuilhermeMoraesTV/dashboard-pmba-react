import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { motion as Motion } from 'framer-motion';
import {
  AlertCircle,
  AlertTriangle,
  Award,
  CheckCircle2,
  Filter,
  Flame,
  HelpCircle,
  Layers,
  Loader2,
  RotateCcw,
  Search,
  Sparkles,
  Target,
  XCircle,
} from 'lucide-react';
import {
  getErrorBookEntries,
  getErrorBookSummaryStats,
} from '../../services/errorBook/errorBookService.js';
import ErrorBookItemCard from './ErrorBookItemCard.jsx';

export default function CadernoErrosPage({ user }) {
  const [selectedStatus, setSelectedStatus] = useState('all'); // 'all' | 'pending' | 'mastered'
  const [sortBy, setSortBy] = useState('recent'); // 'recent' | 'mostErrors' | 'leastCorrect'
  const [searchTerm, setSearchTerm] = useState('');

  const [entries, setEntries] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState(null);

  const [summaryStats, setSummaryStats] = useState({
    totalEntries: 0,
    masteredEntries: 0,
    pendingEntries: 0,
    masteryRate: 0,
    totalWrongAttempts: 0,
    totalCorrectAttempts: 0,
  });
  const entriesRequestGeneration = useRef(0);

  const loadEntries = useCallback(async () => {
    if (!user?.uid) return;
    const requestGeneration = ++entriesRequestGeneration.current;
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const filter = {
        sourceType: 'question',
        mastered: selectedStatus === 'all' ? undefined : selectedStatus === 'mastered',
      };

      const [loadedEntries, stats] = await Promise.all([
        getErrorBookEntries(user.uid, filter),
        getErrorBookSummaryStats(user.uid),
      ]);

      if (requestGeneration === entriesRequestGeneration.current) {
        setEntries(loadedEntries);
        setSummaryStats(stats);
      }
    } catch (err) {
      console.error('[CadernoErrosPage] Erro ao carregar caderno de erros:', err);
      if (requestGeneration === entriesRequestGeneration.current) {
        setErrorMessage('Não foi possível carregar o Caderno de Erros. Tente novamente.');
      }
    } finally {
      if (requestGeneration === entriesRequestGeneration.current) setIsLoading(false);
    }
  }, [user?.uid, selectedStatus]);

  useEffect(() => {
    loadEntries();
  }, [loadEntries]);

  // Filtro de busca textual e ordenação local
  const processedEntries = useMemo(() => {
    let list = [...entries];

    // Busca textual local
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase().trim();
      list = list.filter((e) => {
        const statement = String(e.preview?.statement || e.preview?.front || '').toLowerCase();
        const subject = String(e.subject || '').toLowerCase();
        const notes = String(e.userNotes || '').toLowerCase();
        return statement.includes(term) || subject.includes(term) || notes.includes(term);
      });
    }

    // Ordenação
    if (sortBy === 'mostErrors') {
      list.sort((a, b) => (b.wrongCount || 0) - (a.wrongCount || 0));
    } else if (sortBy === 'leastCorrect') {
      list.sort((a, b) => (a.correctCount || 0) - (b.correctCount || 0));
    } else {
      // 'recent'
      list.sort((a, b) => {
        const dateA = a.lastAttemptAt instanceof Date ? a.lastAttemptAt.getTime() : 0;
        const dateB = b.lastAttemptAt instanceof Date ? b.lastAttemptAt.getTime() : 0;
        return dateB - dateA;
      });
    }

    return list;
  }, [entries, searchTerm, sortBy]);

  const handleEntryUpdated = (updatedEntry) => {
    setEntries((prev) => prev.map((e) => (e.id === updatedEntry.id ? updatedEntry : e)));
    // Atualiza contadores
    if (user?.uid) {
      getErrorBookSummaryStats(user.uid).then(setSummaryStats).catch(() => {});
    }
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-6 sm:px-6">
      {/* Header com Título */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-red-600 text-white shadow-md shadow-red-600/30">
              <AlertTriangle size={20} />
            </span>
            <h1 className="text-xl sm:text-2xl font-black tracking-tight text-zinc-900 dark:text-white">
              Caderno de Erros
            </h1>
          </div>
          <p className="mt-1 text-xs sm:text-sm text-zinc-500 dark:text-zinc-400">
            Repositório centralizado de reestudo ativo para superar dificuldades e consolidar conceitos.
          </p>
        </div>
      </div>

      {/* Grid de Métricas de Fixação */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
        {/* Total de Erros */}
        <div className="rounded-2xl border border-zinc-200/80 bg-white p-4 shadow-sm dark:border-zinc-800/80 dark:bg-card-dark">
          <div className="flex items-center gap-2 text-zinc-500 dark:text-zinc-400 text-xs font-semibold">
            <AlertTriangle size={15} className="text-red-500" />
            <span>Itens no Caderno</span>
          </div>
          <div className="mt-2 text-2xl font-black text-zinc-900 dark:text-white">
            {summaryStats.totalEntries}
          </div>
        </div>

        {/* Itens Dominados */}
        <div className="rounded-2xl border border-zinc-200/80 bg-white p-4 shadow-sm dark:border-zinc-800/80 dark:bg-card-dark">
          <div className="flex items-center gap-2 text-zinc-500 dark:text-zinc-400 text-xs font-semibold">
            <Award size={15} className="text-emerald-500" />
            <span>Superados / Dominados</span>
          </div>
          <div className="mt-2 text-2xl font-black text-emerald-600 dark:text-emerald-400">
            {summaryStats.masteredEntries}
          </div>
        </div>

        {/* Pendentes */}
        <div className="rounded-2xl border border-zinc-200/80 bg-white p-4 shadow-sm dark:border-zinc-800/80 dark:bg-card-dark">
          <div className="flex items-center gap-2 text-zinc-500 dark:text-zinc-400 text-xs font-semibold">
            <Target size={15} className="text-amber-500" />
            <span>Pendentes de Fixação</span>
          </div>
          <div className="mt-2 text-2xl font-black text-amber-600 dark:text-amber-400">
            {summaryStats.pendingEntries}
          </div>
        </div>

        {/* Taxa de Superação */}
        <div className="rounded-2xl border border-zinc-200/80 bg-white p-4 shadow-sm dark:border-zinc-800/80 dark:bg-card-dark">
          <div className="flex items-center gap-2 text-zinc-500 dark:text-zinc-400 text-xs font-semibold">
            <CheckCircle2 size={15} className="text-blue-500" />
            <span>Taxa de Superação</span>
          </div>
          <div className="mt-2 text-2xl font-black text-blue-600 dark:text-blue-400">
            {Math.round(summaryStats.masteryRate)}%
          </div>
        </div>
      </div>

      {/* Barra de Filtros e Busca */}
      <div className="rounded-2xl border border-zinc-200/80 bg-white p-4 shadow-sm dark:border-zinc-800/80 dark:bg-card-dark space-y-4">
        {/* Filtros de Tipo e Status */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-100 pb-3 dark:border-zinc-800/60">
          {/* Seletor de Status (Pendentes vs Dominados) */}
          <div className="flex rounded-xl bg-zinc-100 p-1 dark:bg-zinc-800/80">
            <button
              type="button"
              onClick={() => setSelectedStatus('all')}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
                selectedStatus === 'all'
                  ? 'bg-white text-zinc-900 shadow-sm dark:bg-zinc-700 dark:text-white'
                  : 'text-zinc-500 hover:text-zinc-800 dark:text-zinc-400'
              }`}
            >
              Todos
            </button>
            <button
              type="button"
              onClick={() => setSelectedStatus('pending')}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
                selectedStatus === 'pending'
                  ? 'bg-white text-zinc-900 shadow-sm dark:bg-zinc-700 dark:text-white'
                  : 'text-zinc-500 hover:text-zinc-800 dark:text-zinc-400'
              }`}
            >
              Pendentes
            </button>
            <button
              type="button"
              onClick={() => setSelectedStatus('mastered')}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
                selectedStatus === 'mastered'
                  ? 'bg-white text-zinc-900 shadow-sm dark:bg-zinc-700 dark:text-white'
                  : 'text-zinc-500 hover:text-zinc-800 dark:text-zinc-400'
              }`}
            >
              Dominados
            </button>
          </div>
        </div>

        {/* Busca e Ordenação */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {/* Busca Textual */}
          <div className="relative sm:col-span-2">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar em enunciados, assuntos ou anotações..."
              className="w-full rounded-xl border border-zinc-200 bg-zinc-50/50 pl-9 pr-3 py-2 text-xs text-zinc-800 placeholder-zinc-400 focus:border-red-500 focus:bg-white focus:outline-none dark:border-zinc-800 dark:bg-zinc-900/50 dark:text-zinc-200"
            />
          </div>

          {/* Ordenação */}
          <div>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="w-full rounded-xl border border-zinc-200 bg-zinc-50/50 px-3 py-2 text-xs text-zinc-800 focus:border-red-500 focus:bg-white focus:outline-none dark:border-zinc-800 dark:bg-zinc-900/50 dark:text-zinc-200"
            >
              <option value="recent">Mais Recentes</option>
              <option value="mostErrors">Mais Erros Cometidos</option>
              <option value="leastCorrect">Menos Acertos</option>
            </select>
          </div>
        </div>
      </div>

      {/* Lista de Itens do Caderno de Erros */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-16 text-zinc-400">
          <Loader2 size={32} className="animate-spin text-red-600 mb-3" />
          <p className="text-sm font-medium">Carregando Caderno de Erros...</p>
        </div>
      ) : errorMessage ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-red-200 bg-red-50 p-8 text-center dark:border-red-900/50 dark:bg-red-950/20">
          <AlertCircle size={32} className="text-red-600 mb-2" />
          <p className="text-sm font-bold text-red-800 dark:text-red-300">{errorMessage}</p>
          <button
            type="button"
            onClick={loadEntries}
            className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-red-600 px-4 py-2 text-xs font-bold text-white hover:bg-red-700"
          >
            <RotateCcw size={14} />
            <span>Tentar Novamente</span>
          </button>
        </div>
      ) : processedEntries.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-zinc-300 bg-white p-12 text-center dark:border-zinc-800 dark:bg-card-dark">
          <Award size={40} className="text-emerald-500 mb-3" />
          <h3 className="text-base font-bold text-zinc-800 dark:text-zinc-200">
            {summaryStats.totalEntries === 0
              ? 'Nenhum erro registrado!'
              : 'Nenhum item com os filtros selecionados'}
          </h3>
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400 max-w-sm">
            {summaryStats.totalEntries === 0
              ? 'Quando você errar questões, elas serão catalogadas aqui automaticamente para seu reestudo ativo.'
              : 'Tente ajustar os filtros ou o termo de busca acima.'}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {processedEntries.map((entry) => (
            <ErrorBookItemCard
              key={entry.id}
              entry={entry}
              currentUser={user}
              onEntryUpdated={handleEntryUpdated}
            />
          ))}
        </div>
      )}
    </div>
  );
}
