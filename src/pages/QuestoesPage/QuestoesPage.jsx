import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { motion as Motion, AnimatePresence } from 'framer-motion';
import {
  AlertCircle,
  Award,
  BookOpen,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Filter,
  Flame,
  HelpCircle,
  Layers,
  Loader2,
  Plus,
  RotateCcw,
  Search,
  Sparkles,
  Target,
  XCircle,
} from 'lucide-react';
import {
  deletePrivateQuestion,
  getQuestions,
  getUserQuestionStats,
} from '../../services/questions/questionsService.js';
import QuestionCard from './QuestionCard.jsx';
import PrivateQuestionModal from './PrivateQuestionModal.jsx';
import { questionUiKey, removeScopedQuestion } from './questionUiIdentity.js';

export default function QuestoesPage({ user }) {
  const [activeScope, setActiveScope] = useState('all'); // 'all' | 'global' | 'private'
  const [selectedDiscipline, setSelectedDiscipline] = useState('');
  const [selectedDifficulty, setSelectedDifficulty] = useState('');
  const [selectedBanca, setSelectedBanca] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  const [questions, setQuestions] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState(null);

  const [stats, setStats] = useState({
    questionsResolved: 0,
    correctResolved: 0,
    incorrectResolved: 0,
    totalAttemptEvents: 0,
    totalAttempts: 0,
    correctAttempts: 0,
    wrongAttempts: 0,
    totalXpEarned: 0,
  });

  // Modo de exibição: 'list' (lista contínua) ou 'practice' (foco uma por uma)
  const [viewMode, setViewMode] = useState('list');
  const [practiceIndex, setPracticeIndex] = useState(0);

  // Modais de Criação e Edição
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [questionToEdit, setQuestionToEdit] = useState(null);
  const questionsRequestGeneration = useRef(0);

  // Carrega estatísticas do usuário
  const loadStats = useCallback(async () => {
    if (!user?.uid) return;
    try {
      const userStats = await getUserQuestionStats(user.uid);
      setStats(userStats);
    } catch (err) {
      console.warn('[QuestoesPage] Nao foi possivel carregar estatisticas:', err);
    }
  }, [user?.uid]);

  // Carrega questões do Firestore
  const loadQuestions = useCallback(async () => {
    const requestGeneration = ++questionsRequestGeneration.current;
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const baseFilter = {
        disciplineId: selectedDiscipline || undefined,
        difficulty: selectedDifficulty || undefined,
        banca: selectedBanca || undefined,
      };

      const requests = [];
      if (activeScope === 'global' || activeScope === 'all') {
        requests.push({
          scope: 'global',
          promise: getQuestions({
            ...baseFilter,
            scope: 'global',
            limit: activeScope === 'all' ? 30 : 50,
          }),
        });
      }

      if ((activeScope === 'private' || activeScope === 'all') && user?.uid) {
        requests.push({
          scope: 'private',
          promise: getQuestions({
            ...baseFilter,
            scope: 'private',
            userId: user.uid,
            limit: activeScope === 'all' ? 30 : 50,
          }),
        });
      }
      const settledRequests = await Promise.allSettled(requests.map((request) => request.promise));
      const results = settledRequests
        .filter((result) => result.status === 'fulfilled')
        .flatMap((result) => result.value);
      const failures = settledRequests
        .map((result, index) => ({ result, scope: requests[index].scope }))
        .filter(({ result }) => result.status === 'rejected');

      if (failures.length === requests.length && failures[0]?.result.status === 'rejected') {
        throw failures[0].result.reason;
      }
      failures.forEach(({ result, scope }) => {
        if (result.status === 'rejected') {
          console.warn(`[QuestoesPage] Escopo ${scope} indisponivel; exibindo os demais resultados:`, result.reason);
        }
      });

      if (requestGeneration === questionsRequestGeneration.current) {
        setQuestions(results);
        setPracticeIndex(0);
      }
    } catch (err) {
      console.error('[QuestoesPage] Erro ao carregar questoes:', err);
      if (requestGeneration === questionsRequestGeneration.current) {
        setErrorMessage('Não foi possível carregar as questões. Verifique sua conexão.');
      }
    } finally {
      if (requestGeneration === questionsRequestGeneration.current) setIsLoading(false);
    }
  }, [activeScope, selectedDiscipline, selectedDifficulty, selectedBanca, user?.uid]);

  useEffect(() => {
    loadQuestions();
    loadStats();
  }, [loadQuestions, loadStats]);

  // Filtro local adicional de busca textual
  const filteredQuestions = useMemo(() => {
    if (!searchTerm.trim()) return questions;
    const term = searchTerm.toLowerCase().trim();
    return questions.filter((q) => {
      const statement = String(q.statement || '').toLowerCase();
      const subject = String(q.subject || '').toLowerCase();
      const banca = String(q.banca || '').toLowerCase();
      return statement.includes(term) || subject.includes(term) || banca.includes(term);
    });
  }, [questions, searchTerm]);

  // Ações de criação/edição/exclusão de questões privadas
  const handleOpenCreateModal = () => {
    setQuestionToEdit(null);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (question) => {
    setQuestionToEdit(question);
    setIsModalOpen(true);
  };

  const handleDeleteQuestion = async (question) => {
    if (!user?.uid || !window.confirm('Tem certeza que deseja excluir esta questão privada?')) return;
    try {
      await deletePrivateQuestion(user.uid, question.id);
      setQuestions((prev) => removeScopedQuestion(prev, question));
    } catch (err) {
      alert('Erro ao excluir questão: ' + (err.message || 'Tente novamente.'));
    }
  };

  const handleQuestionSaved = (_savedQuestion) => {
    loadQuestions();
  };

  const handleQuestionAnswered = () => loadStats();

  const totalResolved = stats.questionsResolved ?? stats.totalAttempts ?? 0;
  const correctCount = stats.correctResolved ?? stats.correctAttempts ?? 0;
  const incorrectCount = stats.incorrectResolved ?? stats.wrongAttempts ?? 0;
  const totalAuditAttempts = stats.totalAttemptEvents ?? stats.totalAttempts ?? 0;

  const accuracyRate = totalResolved > 0
    ? Math.round((correctCount / totalResolved) * 100)
    : 0;

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-6 sm:px-6">
      {/* Header com Título e Estatísticas */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-red-600 text-white shadow-md shadow-red-600/30">
              <HelpCircle size={20} />
            </span>
            <h1 className="text-xl sm:text-2xl font-black tracking-tight text-zinc-900 dark:text-white">
              Banco de Questões
            </h1>
          </div>
          <p className="mt-1 text-xs sm:text-sm text-zinc-500 dark:text-zinc-400">
            Resolva questões oficiais e privadas com validação em tempo real e integração ao Caderno de Erros.
          </p>
        </div>

        {/* Botão de Criação de Questão Privada */}
        <button
          type="button"
          onClick={handleOpenCreateModal}
          className="flex items-center justify-center gap-2 rounded-xl bg-red-600 px-4 py-2.5 text-xs sm:text-sm font-bold text-white shadow-md shadow-red-600/20 hover:bg-red-700 transition-all shrink-0"
        >
          <Plus size={16} />
          <span>Criar Questão</span>
        </button>
      </div>

      {/* Grid de Métricas de Desempenho */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
        {/* Total Resolvidas */}
        <div className="rounded-2xl border border-zinc-200/80 bg-white p-4 shadow-sm dark:border-zinc-800/80 dark:bg-card-dark">
          <div className="flex items-center gap-2 text-zinc-500 dark:text-zinc-400 text-xs font-semibold">
            <Target size={15} className="text-blue-500" />
            <span>Resolvidas</span>
          </div>
          <div className="mt-2 text-2xl font-black text-zinc-900 dark:text-white">
            {totalResolved}
          </div>
          {totalAuditAttempts > totalResolved && (
            <p className="mt-1 text-[11px] text-zinc-400">
              {totalAuditAttempts} tentativas registradas
            </p>
          )}
        </div>

        {/* Taxa de Acerto */}
        <div className="rounded-2xl border border-zinc-200/80 bg-white p-4 shadow-sm dark:border-zinc-800/80 dark:bg-card-dark">
          <div className="flex items-center gap-2 text-zinc-500 dark:text-zinc-400 text-xs font-semibold">
            <CheckCircle2 size={15} className="text-emerald-500" />
            <span>Taxa de Acerto</span>
          </div>
          <div className="mt-2 text-2xl font-black text-emerald-600 dark:text-emerald-400">
            {accuracyRate}%
          </div>
        </div>

        {/* Acertos vs Erros */}
        <div className="rounded-2xl border border-zinc-200/80 bg-white p-4 shadow-sm dark:border-zinc-800/80 dark:bg-card-dark">
          <div className="flex items-center gap-2 text-zinc-500 dark:text-zinc-400 text-xs font-semibold">
            <Flame size={15} className="text-orange-500" />
            <span>Acertos / Erros</span>
          </div>
          <div className="mt-2 flex items-baseline gap-2 text-lg font-black text-zinc-900 dark:text-white">
            <span className="text-emerald-600 dark:text-emerald-400">{correctCount}</span>
            <span className="text-zinc-400 font-normal">/</span>
            <span className="text-red-500">{incorrectCount}</span>
          </div>
        </div>

        {/* XP Ganho */}
        <div className="rounded-2xl border border-zinc-200/80 bg-white p-4 shadow-sm dark:border-zinc-800/80 dark:bg-card-dark">
          <div className="flex items-center gap-2 text-zinc-500 dark:text-zinc-400 text-xs font-semibold">
            <Sparkles size={15} className="text-amber-500" />
            <span>XP Acumulado</span>
          </div>
          <div className="mt-2 text-2xl font-black text-amber-600 dark:text-amber-400">
            +{stats.totalXpEarned}
          </div>
        </div>
      </div>

      {/* Barra de Filtros e Busca */}
      <div className="rounded-2xl border border-zinc-200/80 bg-white p-4 shadow-sm dark:border-zinc-800/80 dark:bg-card-dark space-y-4">
        {/* Seletor de Escopo */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-100 pb-3 dark:border-zinc-800/60">
          <div className="flex rounded-xl bg-zinc-100 p-1 dark:bg-zinc-800/80">
            <button
              type="button"
              onClick={() => setActiveScope('all')}
              className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-all ${
                activeScope === 'all'
                  ? 'bg-white text-zinc-900 shadow-sm dark:bg-zinc-700 dark:text-white'
                  : 'text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200'
              }`}
            >
              Todas
            </button>
            <button
              type="button"
              onClick={() => setActiveScope('global')}
              className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-all ${
                activeScope === 'global'
                  ? 'bg-white text-zinc-900 shadow-sm dark:bg-zinc-700 dark:text-white'
                  : 'text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200'
              }`}
            >
              Banco Oficial
            </button>
            <button
              type="button"
              onClick={() => setActiveScope('private')}
              className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-all ${
                activeScope === 'private'
                  ? 'bg-white text-zinc-900 shadow-sm dark:bg-zinc-700 dark:text-white'
                  : 'text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200'
              }`}
            >
              Minhas Questões
            </button>
          </div>

          {/* Alternador de Modo de Exibição */}
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setViewMode('list')}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
                viewMode === 'list'
                  ? 'bg-zinc-200 text-zinc-900 dark:bg-zinc-700 dark:text-white'
                  : 'text-zinc-500 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800'
              }`}
            >
              Lista
            </button>
            <button
              type="button"
              onClick={() => setViewMode('practice')}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
                viewMode === 'practice'
                  ? 'bg-zinc-200 text-zinc-900 dark:bg-zinc-700 dark:text-white'
                  : 'text-zinc-500 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800'
              }`}
            >
              Modo Prática (Foco)
            </button>
          </div>
        </div>

        {/* Dropdowns de Filtros e Busca */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-5">
          {/* Busca Textual */}
          <div className="relative sm:col-span-2">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar no enunciado ou assunto..."
              className="w-full rounded-xl border border-zinc-200 bg-zinc-50/50 pl-9 pr-3 py-2 text-xs text-zinc-800 placeholder-zinc-400 focus:border-red-500 focus:bg-white focus:outline-none dark:border-zinc-800 dark:bg-zinc-900/50 dark:text-zinc-200"
            />
          </div>

          {/* Disciplina */}
          <div>
            <input
              type="text"
              value={selectedDiscipline}
              onChange={(e) => setSelectedDiscipline(e.target.value)}
              placeholder="Filtrar disciplina..."
              className="w-full rounded-xl border border-zinc-200 bg-zinc-50/50 px-3 py-2 text-xs text-zinc-800 focus:border-red-500 focus:bg-white focus:outline-none dark:border-zinc-800 dark:bg-zinc-900/50 dark:text-zinc-200"
            />
          </div>

          {/* Dificuldade */}
          <div>
            <select
              value={selectedDifficulty}
              onChange={(e) => setSelectedDifficulty(e.target.value)}
              className="w-full rounded-xl border border-zinc-200 bg-zinc-50/50 px-3 py-2 text-xs text-zinc-800 focus:border-red-500 focus:bg-white focus:outline-none dark:border-zinc-800 dark:bg-zinc-900/50 dark:text-zinc-200"
            >
              <option value="">Todas Dificuldades</option>
              <option value="easy">Fácil</option>
              <option value="medium">Média</option>
              <option value="hard">Difícil</option>
            </select>
          </div>

          {/* Banca */}
          <div>
            <select
              value={selectedBanca}
              onChange={(e) => setSelectedBanca(e.target.value)}
              className="w-full rounded-xl border border-zinc-200 bg-zinc-50/50 px-3 py-2 text-xs text-zinc-800 focus:border-red-500 focus:bg-white focus:outline-none dark:border-zinc-800 dark:bg-zinc-900/50 dark:text-zinc-200"
            >
              <option value="">Todas as Bancas</option>
              <option value="FCC">FCC</option>
              <option value="Cebraspe">Cebraspe / CESPE</option>
              <option value="Vunesp">VUNESP</option>
              <option value="FGV">FGV</option>
              <option value="IBFC">IBFC</option>
              <option value="Consulplan">Consulplan</option>
            </select>
          </div>
        </div>
      </div>

      {/* Lista de Questões / Modo de Prática */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-16 text-zinc-400">
          <Loader2 size={32} className="animate-spin text-red-600 mb-3" />
          <p className="text-sm font-medium">Carregando questões...</p>
        </div>
      ) : errorMessage ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-red-200 bg-red-50 p-8 text-center dark:border-red-900/50 dark:bg-red-950/20">
          <AlertCircle size={32} className="text-red-600 mb-2" />
          <p className="text-sm font-bold text-red-800 dark:text-red-300">{errorMessage}</p>
          <button
            type="button"
            onClick={loadQuestions}
            className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-red-600 px-4 py-2 text-xs font-bold text-white hover:bg-red-700"
          >
            <RotateCcw size={14} />
            <span>Tentar Novamente</span>
          </button>
        </div>
      ) : filteredQuestions.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-zinc-300 bg-white p-12 text-center dark:border-zinc-800 dark:bg-card-dark">
          <HelpCircle size={40} className="text-zinc-300 dark:text-zinc-700 mb-3" />
          <h3 className="text-base font-bold text-zinc-800 dark:text-zinc-200">
            Nenhuma questão encontrada
          </h3>
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400 max-w-sm">
            Tente ajustar os filtros acima ou crie suas próprias questões personalizadas para praticar.
          </p>
          <button
            type="button"
            onClick={handleOpenCreateModal}
            className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-red-600 px-4 py-2 text-xs font-bold text-white hover:bg-red-700"
          >
            <Plus size={15} />
            <span>Criar Primeira Questão</span>
          </button>
        </div>
      ) : viewMode === 'practice' ? (
        /* Modo Prática (Foco em uma questão com navegação) */
        <div className="space-y-4">
          {/* Barra de Progresso da Prática */}
          <div className="flex items-center justify-between rounded-xl bg-zinc-100 px-4 py-2 text-xs font-bold text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
            <span>Questão {practiceIndex + 1} de {filteredQuestions.length}</span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={practiceIndex === 0}
                onClick={() => setPracticeIndex((prev) => Math.max(0, prev - 1))}
                className="rounded-lg p-1 hover:bg-zinc-200 disabled:opacity-40 dark:hover:bg-zinc-700"
              >
                <ChevronLeft size={16} />
              </button>
              <button
                type="button"
                disabled={practiceIndex >= filteredQuestions.length - 1}
                onClick={() => setPracticeIndex((prev) => Math.min(filteredQuestions.length - 1, prev + 1))}
                className="rounded-lg p-1 hover:bg-zinc-200 disabled:opacity-40 dark:hover:bg-zinc-700"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>

          <QuestionCard
            key={questionUiKey(filteredQuestions[practiceIndex])}
            question={filteredQuestions[practiceIndex]}
            currentUser={user}
            onEdit={handleOpenEditModal}
            onDelete={handleDeleteQuestion}
            onAnswered={handleQuestionAnswered}
          />
        </div>
      ) : (
        /* Modo Lista Contínua */
        <div className="space-y-4">
          {filteredQuestions.map((q) => (
            <QuestionCard
              key={questionUiKey(q)}
              question={q}
              currentUser={user}
              onEdit={handleOpenEditModal}
              onDelete={handleDeleteQuestion}
              onAnswered={handleQuestionAnswered}
            />
          ))}
        </div>
      )}

      {/* Modal de Criação e Edição */}
      <PrivateQuestionModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSaved={handleQuestionSaved}
        questionToEdit={questionToEdit}
        currentUser={user}
      />
    </div>
  );
}
