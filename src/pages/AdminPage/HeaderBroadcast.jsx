import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { db, auth } from '../../firebaseConfig';
import {
  addDoc, collection, deleteDoc, query, orderBy, onSnapshot, limit,
  doc, serverTimestamp,
} from 'firebase/firestore';
import {
  X, Loader2, Megaphone, Zap, AlertTriangle, Bell, History, Layout,
  Palette, ImageIcon, Upload, Trash, Check, Smartphone, Monitor, Power, Trash2,
  Images, ChevronLeft, ChevronRight, Type, BarChart3, Clock, Plus, Minus,
  RefreshCw, Vote, Lock, Users, AlertCircle, HelpCircle, CheckCircle2
} from 'lucide-react';
import ConfirmModal from '../../components/shared/ConfirmModal';
import { useBodyScrollLock } from '../../hooks/useBodyScrollLock';
import { uploadSecureImage, validateImageFile } from '../../services/secureImageUpload';
import { PRODUCT_LIMITS } from '../../config/productLimits';
import {
  createBroadcastPoll,
  closeBroadcastPoll,
  toggleBroadcastActive,
  deleteBroadcastPoll,
  getPollResults,
  getPollRespondentsPage,
} from '../../services/broadcastPollService';
import {
  validatePollDraft,
  getPollEffectiveStatus,
  isPollEffectiveClosed,
  calculatePollPercentages,
  toMillisSafe,
} from '../../contracts/broadcastPoll';

// --- UTILITÁRIOS ---
const formatTimeAgo = (date) => {
  if (!date) return '-';
  const time = date?.toDate ? date.toDate() : (date instanceof Date ? date : new Date(date));
  const diff = Math.floor((new Date() - time) / 60000);
  if (diff < 1) return 'Agora';
  if (diff < 60) return `${diff}m`;
  const hours = Math.floor(diff / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
};

const formatDateTime = (value) => {
  if (!value) return '—';
  const time = value?.toDate ? value.toDate() : (value instanceof Date ? value : new Date(value));
  if (isNaN(time.getTime())) return '—';
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(time);
};

// --- MODAL DE RESULTADOS DA ENQUETE (SOB DEMANDA) ---
const PollResultsModal = ({ isOpen, onClose, poll, users = [] }) => {
  useBodyScrollLock(isOpen, { fixed: false });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [results, setResults] = useState(null);
  const [activeTab, setActiveTab] = useState('summary'); // 'summary' | 'respondents'
  const [selectedOptionFilter, setSelectedOptionFilter] = useState('all');

  // Respondentes com paginação em cursor
  const [respondents, setRespondents] = useState([]);
  const [loadingRespondents, setLoadingRespondents] = useState(false);
  const [lastDoc, setLastDoc] = useState(null);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState(null);

  const pollId = poll?.id;

  const loadResults = useCallback(async (isRefresh = false) => {
    if (!pollId) return;
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const data = await getPollResults({ db, pollId });
      setResults(data);
    } catch (err) {
      console.error('[PollResultsModal] Erro ao carregar contagens:', err);
      setError('Não foi possível carregar os resultados da enquete.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [pollId]);

  const loadRespondentsPage = useCallback(async (reset = false, filterOpt = selectedOptionFilter) => {
    if (!pollId) return;
    setLoadingRespondents(true);
    try {
      const currentLast = reset ? null : lastDoc;
      const res = await getPollRespondentsPage({
        db,
        pollId,
        optionId: filterOpt === 'all' ? null : filterOpt,
        pageSize: PRODUCT_LIMITS?.polls?.pageSizeRespondents || 50,
        lastDoc: currentLast,
      });
      if (reset) {
        setRespondents(res.respondents);
      } else {
        setRespondents((prev) => [...prev, ...res.respondents]);
      }
      setLastDoc(res.lastDoc);
      setHasMore(res.hasMore);
    } catch (err) {
      console.error('[PollResultsModal] Erro ao carregar respondentes:', err);
    } finally {
      setLoadingRespondents(false);
    }
  }, [pollId, lastDoc, selectedOptionFilter]);

  useEffect(() => {
    if (isOpen && pollId) {
      loadResults(false);
      loadRespondentsPage(true, selectedOptionFilter);
    }
  }, [isOpen, pollId]);

  const handleFilterOption = (optId) => {
    setSelectedOptionFilter(optId);
    setLastDoc(null);
    loadRespondentsPage(true, optId);
  };

  const userMap = useMemo(() => {
    const map = new Map();
    (users || []).forEach((u) => {
      if (u.uid) map.set(u.uid, u);
      if (u.id) map.set(u.id, u);
    });
    return map;
  }, [users]);

  if (!isOpen || !poll) return null;

  const effectiveStatus = getPollEffectiveStatus(poll.poll || poll);
  const isClosed = effectiveStatus === 'closed_manual' || effectiveStatus === 'closed_deadline';
  const options = poll.poll?.options || [];
  const totalResponses = results?.responseCount ?? poll.poll?.responseCount ?? 0;
  const audienceCount = poll.audienceCount || (poll.targetUserIds?.length) || (users.length || null);
  const calculated = calculatePollPercentages(results || { responseCount: totalResponses, optionCounts: {} }, options, audienceCount);

  return createPortal(
    <div className="fixed inset-0 z-[10030] flex items-center justify-center bg-zinc-950/80 p-3 backdrop-blur-md animate-fade-in sm:p-5">
      <motion.div
        initial={{ scale: 0.96, opacity: 0, y: 16 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.96, opacity: 0, y: 16 }}
        className="relative flex h-[90vh] max-h-[820px] w-full max-w-4xl flex-col overflow-hidden rounded-3xl border border-zinc-200 bg-white shadow-2xl dark:border-zinc-800 dark:bg-zinc-900"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-200 px-6 py-4 dark:border-zinc-800">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-red-50 text-red-600 dark:bg-red-950/30 dark:text-red-400">
              <BarChart3 size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-black text-zinc-900 dark:text-white sm:text-lg">Resultados da Enquete</h3>
                <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[9px] font-black uppercase tracking-wider ${isClosed ? 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400' : 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/30 dark:text-emerald-400'}`}>
                  {isClosed ? 'Encerrada' : 'Aberta'}
                </span>
                {poll.targetUid && (
                  <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-amber-600 border border-amber-200">
                    Modo Teste
                  </span>
                )}
              </div>
              <p className="text-xs font-semibold text-zinc-400 truncate max-w-md sm:max-w-xl">{poll.title || 'Enquete sem título'}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => { loadResults(true); loadRespondentsPage(true, selectedOptionFilter); }}
              disabled={refreshing || loading}
              className="inline-flex items-center gap-1.5 rounded-xl border border-zinc-200 px-3 py-2 text-xs font-bold text-zinc-600 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800 disabled:opacity-50"
              title="Atualizar resultados sob demanda"
            >
              <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
              <span className="hidden sm:inline">Atualizar</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="flex h-9 w-9 items-center justify-center rounded-xl text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-white"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Sub-tabs */}
        <div className="flex items-center gap-4 border-b border-zinc-100 bg-zinc-50 px-6 py-2.5 dark:border-zinc-800/60 dark:bg-zinc-900/50">
          <button
            type="button"
            onClick={() => setActiveTab('summary')}
            className={`inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-black uppercase tracking-wider transition-all ${activeTab === 'summary' ? 'bg-red-600 text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-white'}`}
          >
            <BarChart3 size={14} /> Resumo & Votos
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('respondents')}
            className={`inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-black uppercase tracking-wider transition-all ${activeTab === 'respondents' ? 'bg-red-600 text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-white'}`}
          >
            <Users size={14} /> Votos Nominais ({totalResponses})
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
          {error && (
            <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-xs font-bold text-red-700 dark:border-red-900/40 dark:bg-red-950/20 dark:text-red-300 flex items-center gap-2">
              <AlertCircle size={16} /> {error}
            </div>
          )}

          {activeTab === 'summary' ? (
            <div className="space-y-6">
              {/* Cards de Métricas */}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div className="rounded-2xl border border-zinc-200 bg-zinc-50/70 p-4 dark:border-zinc-800 dark:bg-zinc-800/40">
                  <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Total de Votos</p>
                  <p className="mt-1 text-2xl font-black text-zinc-900 dark:text-white">{loading ? '—' : totalResponses}</p>
                  <p className="text-[10px] font-semibold text-zinc-400 mt-0.5">Votos computados de forma atômica</p>
                </div>
                <div className="rounded-2xl border border-zinc-200 bg-zinc-50/70 p-4 dark:border-zinc-800 dark:bg-zinc-800/40">
                  <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Público Elegível</p>
                  <p className="mt-1 text-2xl font-black text-zinc-900 dark:text-white">{audienceCount || 'Geral'}</p>
                  <p className="text-[10px] font-semibold text-zinc-400 mt-0.5">{poll.audienceMode === 'test' ? 'Modo de Teste' : poll.segmentLabel || 'Todos os estudantes'}</p>
                </div>
                <div className="rounded-2xl border border-zinc-200 bg-zinc-50/70 p-4 dark:border-zinc-800 dark:bg-zinc-800/40">
                  <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Taxa de Participação</p>
                  <p className="mt-1 text-2xl font-black text-red-600 dark:text-red-400">{loading ? '—' : (calculated.participationRate !== null ? `${calculated.participationRate}%` : '—')}</p>
                  <p className="text-[10px] font-semibold text-zinc-400 mt-0.5">Baseado no público elegível</p>
                </div>
              </div>

              {/* Descrição se houver */}
              {poll.message && (
                <div className="rounded-2xl border border-zinc-100 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-900/70">
                  <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400 mb-1">Contexto da Enquete</p>
                  <p className="text-xs leading-relaxed text-zinc-600 dark:text-zinc-300 whitespace-pre-wrap">{poll.message}</p>
                </div>
              )}

              {/* Lista de Opções e Barras */}
              <div className="space-y-3">
                <h4 className="text-xs font-black uppercase tracking-widest text-zinc-400">Distribuição dos Votos</h4>
                {calculated.optionStats.map((opt, index) => (
                  <div key={opt.id} className="relative overflow-hidden rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
                    <div className="relative z-10 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-xl bg-zinc-100 text-xs font-black text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200">
                          {String.fromCharCode(65 + index)}
                        </span>
                        <span className="text-sm font-bold text-zinc-900 dark:text-white leading-snug">{opt.text}</span>
                      </div>
                      <div className="flex shrink-0 items-baseline gap-2 text-right">
                        <span className="text-sm font-black text-zinc-900 dark:text-white">{opt.count} {opt.count === 1 ? 'voto' : 'votos'}</span>
                        <span className="text-xs font-black text-red-600 dark:text-red-400">({opt.percentageLabel})</span>
                      </div>
                    </div>
                    {/* Barra de progresso */}
                    <div className="mt-3 h-2.5 w-full overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${opt.percentage}%` }}
                        transition={{ duration: 0.5, ease: 'easeOut' }}
                        className="h-full rounded-full bg-gradient-to-r from-red-600 to-red-500"
                      />
                    </div>
                  </div>
                ))}
              </div>

              {/* Nota informativa de integridade de dados */}
              <div className="rounded-2xl border border-zinc-200 bg-zinc-50/70 p-4 text-[11px] leading-relaxed text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900/40">
                <div className="flex items-start gap-2.5">
                  <HelpCircle size={15} className="shrink-0 text-zinc-400 mt-0.5" />
                  <div>
                    <strong className="text-zinc-700 dark:text-zinc-300">Preservação Histórica:</strong> Os totais de votos agregados são armazenados em documento privado e imutáveis. Eventuais diferenças nominais entre os totais e os respondentes listados decorrem de contas excluídas posteriormente.
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Filtro por Opção */}
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[10px] font-black uppercase text-zinc-400 tracking-wider mr-1">Filtrar:</span>
                <button
                  type="button"
                  onClick={() => handleFilterOption('all')}
                  className={`rounded-xl px-3 py-1.5 text-xs font-bold transition-all ${selectedOptionFilter === 'all' ? 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-900' : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300'}`}
                >
                  Todas ({totalResponses})
                </button>
                {options.map((opt, idx) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => handleFilterOption(opt.id)}
                    className={`rounded-xl px-3 py-1.5 text-xs font-bold transition-all ${selectedOptionFilter === opt.id ? 'bg-red-600 text-white' : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300'}`}
                  >
                    {String.fromCharCode(65 + idx)}: {opt.text.slice(0, 20)}{opt.text.length > 20 ? '…' : ''}
                  </button>
                ))}
              </div>

              {/* Lista de Respondentes */}
              {loadingRespondents && respondents.length === 0 ? (
                <div className="flex h-48 items-center justify-center gap-3 text-sm font-bold text-zinc-400">
                  <Loader2 size={18} className="animate-spin text-red-600" /> Carregando respondentes...
                </div>
              ) : respondents.length === 0 ? (
                <div className="flex h-48 flex-col items-center justify-center text-center">
                  <Users size={32} className="text-zinc-300 dark:text-zinc-700 mb-2" />
                  <p className="text-xs font-bold text-zinc-500">Nenhum voto registrado para o filtro selecionado.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {respondents.map((resp) => {
                    const matchedUser = userMap.get(resp.uid);
                    const chosenOption = options.find((o) => o.id === resp.optionId);
                    return (
                      <div
                        key={resp.id || `${resp.uid}-${resp.optionId}`}
                        className="flex items-center justify-between gap-3 rounded-2xl border border-zinc-100 bg-zinc-50/70 p-3 dark:border-zinc-800/80 dark:bg-zinc-800/30"
                      >
                        <div className="flex min-w-0 items-center gap-3">
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-zinc-200 bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-800">
                            {matchedUser?.photoURL ? (
                              <img src={matchedUser.photoURL} alt="" className="h-full w-full object-cover" />
                            ) : (
                              <Users size={15} className="text-zinc-400" />
                            )}
                          </div>
                          <div className="min-w-0">
                            <p className="truncate text-xs font-extrabold text-zinc-900 dark:text-white">
                              {matchedUser?.name || matchedUser?.displayName || (matchedUser ? 'Estudante' : 'Conta Excluída / Usuário não encontrado')}
                            </p>
                            <p className="truncate text-[10px] font-semibold text-zinc-400">
                              {matchedUser?.email || `UID: ${resp.uid}`}
                            </p>
                          </div>
                        </div>

                        <div className="flex shrink-0 items-center gap-3">
                          <div className="rounded-xl bg-white px-3 py-1.5 text-right border border-zinc-200 dark:border-zinc-700 dark:bg-zinc-800">
                            <p className="text-[9px] font-black uppercase tracking-wider text-red-600 dark:text-red-400">
                              Opção Escolhida
                            </p>
                            <p className="text-xs font-black text-zinc-800 dark:text-zinc-100">
                              {chosenOption?.text || resp.optionId}
                            </p>
                          </div>
                          <time className="text-[10px] font-semibold text-zinc-400 hidden sm:inline">
                            {formatDateTime(resp.respondedAt)}
                          </time>
                        </div>
                      </div>
                    );
                  })}

                  {/* Botão de Paginação */}
                  {hasMore && (
                    <div className="pt-2 text-center">
                      <button
                        type="button"
                        onClick={() => loadRespondentsPage(false, selectedOptionFilter)}
                        disabled={loadingRespondents}
                        className="rounded-xl border border-zinc-200 bg-white px-5 py-2.5 text-xs font-black uppercase tracking-wider text-zinc-600 shadow-sm transition hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700 disabled:opacity-50"
                      >
                        {loadingRespondents ? 'Carregando mais…' : 'Carregar mais respondentes (50)'}
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </motion.div>
    </div>,
    document.body
  );
};

// --- MODAL EXPANDIDO ---
const ExpandedModal = ({ isOpen, onClose, title, children }) => {
  useBodyScrollLock(isOpen, { fixed: false });

  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-[10020] flex items-center justify-center bg-zinc-900/70 p-3 backdrop-blur-md animate-fade-in sm:p-5 md:p-7">
      <motion.div
        initial={{ scale: 0.95, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.95, opacity: 0, y: 20 }}
        className="admin-modal-shell admin-modal-shell--broadcast modal-zoom modal-zoom--admin-broadcast w-full h-[calc(100dvh-1.5rem)] sm:h-[calc(100dvh-2.5rem)] md:w-[96vw] md:max-w-[1500px] md:h-[calc(100dvh-3rem)] lg:h-[88dvh] rounded-2xl md:rounded-[2rem] border border-zinc-200 dark:border-zinc-800 shadow-2xl flex flex-col overflow-hidden relative"
      >
        <div className="admin-modal-heading flex items-center justify-between gap-4 px-5 py-4 sm:px-6 z-50">
          <div className="flex min-w-0 items-center gap-3">
            <span className="admin-modal-heading__icon"><Megaphone size={21} /></span>
            <div className="min-w-0">
              <h3 className="truncate text-lg font-black tracking-tight text-zinc-900 dark:text-white sm:text-xl">{title}</h3>
              <p className="hidden text-xs font-semibold text-zinc-500 sm:block">Crie comunicados e enquetes, confira a prévia e acompanhe o histórico.</p>
            </div>
          </div>
          <button onClick={onClose} aria-label="Fechar central de broadcast" className="admin-modal-close">
            <X size={20} />
          </button>
        </div>
        <div className="admin-modal-body flex-1 overflow-hidden relative flex flex-col md:flex-row">
          {children}
        </div>
      </motion.div>
    </div>,
    document.body,
  );
};
// --- COMPONENTE PRINCIPAL ---
const HeaderBroadcast = ({ isOpen, onClose, segmentDraft = null, users = [] }) => {
  const [activeTab, setActiveTab] = useState('create');
  const [broadcastKind, setBroadcastKind] = useState('message'); // 'message' | 'poll'
  const [message, setMessage] = useState('');
  const [category, setCategory] = useState('comunicado');
  const [sending, setSending] = useState(false);
  const [history, setHistory] = useState([]);
  const [feedback, setFeedback] = useState(null);
  const [previewMode, setPreviewMode] = useState('mobile');
  const [isTestMode, setIsTestMode] = useState(false);
  const [selectedSegment, setSelectedSegment] = useState(null);
  const [broadcastToDelete, setBroadcastToDelete] = useState(null);

  // Estados de Imagem (Carrossel)
  const [images, setImages] = useState([]);
  const [previewIndex, setPreviewIndex] = useState(0);
  const fileInputRef = useRef(null);

  // Estados da Enquete
  const [pollTitle, setPollTitle] = useState('');
  const [pollDescription, setPollDescription] = useState('');
  const [pollOptions, setPollOptions] = useState(['', '']);
  const [hasDeadline, setHasDeadline] = useState(false);
  const [pollClosesAt, setPollClosesAt] = useState('');

  // Modais de Controle
  const [selectedPollForResults, setSelectedPollForResults] = useState(null);
  const [pollToClose, setPollToClose] = useState(null);
  const [closingPoll, setClosingPoll] = useState(false);

  // Temas para SELEÇÃO (Admin vê colorido para diferenciar)
  const themesSelection = {
    comunicado: { bgClass: 'bg-zinc-100', label: 'Padrão', icon: Megaphone },
    atualizacao: { bgClass: 'bg-blue-50', label: 'Feature', icon: Zap },
    aviso: { bgClass: 'bg-amber-50', label: 'Alerta', icon: AlertTriangle },
    urgente: { bgClass: 'bg-red-50', label: 'Urgente', icon: Bell }
  };

  useEffect(() => {
    if (!isOpen) return;
    const maxItems = PRODUCT_LIMITS?.polls?.maxHistoryItems || 100;
    const q = query(collection(db, 'system_broadcasts'), orderBy('timestamp', 'desc'), limit(maxItems));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setHistory(snapshot.docs.map(doc => ({
        id: doc.id, ...doc.data(),
        timestamp: doc.data().timestamp?.toDate ? doc.data().timestamp.toDate() : (doc.data().timestamp || new Date())
      })));
    });
    return () => unsubscribe();
  }, [isOpen]);

  useEffect(() => {
    if (segmentDraft) {
      setSelectedSegment(segmentDraft);
      setActiveTab('create');
    }
  }, [segmentDraft]);

  // Handlers de Imagem (Multi-upload)
  const handleImageChange = async (e) => {
    if (e.target.files) {
      const remaining = Math.max(0, 10 - images.length);
      const candidates = Array.from(e.target.files).slice(0, remaining);
      const newImages = [];
      for (const file of candidates) {
        try {
          await validateImageFile(file);
          newImages.push({ file, preview: URL.createObjectURL(file) });
        } catch (validationError) {
          setFeedback({ type: 'error', message: validationError.message });
        }
      }
      setImages(prev => [...prev, ...newImages]);
      e.target.value = '';
    }
  };

  const handleRemoveImage = (index) => {
    setImages(prev => prev.filter((_, i) => i !== index));
    if (previewIndex >= index && previewIndex > 0) {
      setPreviewIndex(previewIndex - 1);
    }
  };

  // Enviar Broadcast Normal
  const handleSendBroadcast = async () => {
    if (!message.trim() && images.length === 0) return;
    setSending(true);
    try {
      const user = auth.currentUser;
      const targetUserIds = !isTestMode && selectedSegment?.targetUserIds?.length
        ? selectedSegment.targetUserIds
        : null;
      let imageUrls = [];

      if (images.length > 0) {
        const uploadPromises = images.map(async (img) => {
          const upload = await uploadSecureImage(img.file, { kind: 'broadcast' });
          return upload.url;
        });
        imageUrls = await Promise.all(uploadPromises);
      }

      await addDoc(collection(db, 'system_broadcasts'), {
        message: imageUrls.length > 0 ? null : message,
        category,
        imageUrls: imageUrls.length > 0 ? imageUrls : null,
        imageUrl: imageUrls.length > 0 ? imageUrls[0] : null,
        timestamp: serverTimestamp(),
        active: true,
        type: 'admin_push',
        targetUid: isTestMode && user ? user.uid : null,
        targetUserIds,
        audienceMode: isTestMode ? 'test' : targetUserIds?.length ? 'segment' : 'all',
        audienceCount: isTestMode ? 1 : targetUserIds?.length || null,
        segmentId: !isTestMode ? selectedSegment?.id || null : null,
        segmentLabel: !isTestMode ? selectedSegment?.label || null : null,
        segmentFilters: !isTestMode ? selectedSegment?.filtersSnapshot || null : null,
      });

      setMessage('');
      setCategory('comunicado');
      setImages([]);
      setPreviewIndex(0);
      setSelectedSegment(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      setActiveTab('history');
      setIsTestMode(false);
      setFeedback({ type: 'success', message: 'Comunicado publicado com sucesso!' });
    } catch (error) {
      console.error(error);
      setFeedback({ type: 'error', message: `Erro ao enviar: ${error.message}` });
    } finally {
      setSending(false);
    }
  };

  // Handlers da Enquete
  const handleAddPollOption = () => {
    const maxOpt = PRODUCT_LIMITS?.polls?.maxOptions || 6;
    if (pollOptions.length < maxOpt) {
      setPollOptions(prev => [...prev, '']);
    }
  };

  const handleRemovePollOption = (index) => {
    const minOpt = PRODUCT_LIMITS?.polls?.minOptions || 2;
    if (pollOptions.length > minOpt) {
      setPollOptions(prev => prev.filter((_, i) => i !== index));
    }
  };

  const handlePollOptionChange = (index, value) => {
    const maxChars = PRODUCT_LIMITS?.polls?.maxOptionChars || 120;
    const truncated = value.slice(0, maxChars);
    setPollOptions(prev => prev.map((opt, i) => (i === index ? truncated : opt)));
  };

  const handleSendPoll = async () => {
    setSending(true);
    try {
      const user = auth.currentUser;
      const targetUserIds = !isTestMode && selectedSegment?.targetUserIds?.length
        ? selectedSegment.targetUserIds
        : null;

      const closesAtValue = hasDeadline && pollClosesAt ? new Date(pollClosesAt) : null;

      const validation = validatePollDraft({
        title: pollTitle,
        description: pollDescription,
        options: pollOptions,
        closesAt: closesAtValue,
      });

      if (!validation.isValid) {
        setFeedback({ type: 'error', message: validation.errors.join(' ') });
        setSending(false);
        return;
      }

      await createBroadcastPoll({
        db,
        title: pollTitle,
        description: pollDescription || null,
        options: validation.normalizedOptions,
        closesAt: closesAtValue,
        audienceMode: isTestMode ? 'test' : targetUserIds?.length ? 'segment' : 'all',
        targetUid: isTestMode && user ? user.uid : null,
        targetUserIds,
        audienceCount: isTestMode ? 1 : targetUserIds?.length || (users.length || null),
        segmentId: !isTestMode ? selectedSegment?.id || null : null,
        segmentLabel: !isTestMode ? selectedSegment?.label || null : null,
        segmentFilters: !isTestMode ? selectedSegment?.filtersSnapshot || null : null,
      });

      setPollTitle('');
      setPollDescription('');
      setPollOptions(['', '']);
      setHasDeadline(false);
      setPollClosesAt('');
      setSelectedSegment(null);
      setActiveTab('history');
      setIsTestMode(false);
      setFeedback({ type: 'success', message: 'Enquete publicada com sucesso!' });
    } catch (error) {
      console.error(error);
      setFeedback({ type: 'error', message: `Erro ao criar enquete: ${error.message}` });
    } finally {
      setSending(false);
    }
  };

  const handleToggleActive = async (id, currentStatus) => {
    try {
      await toggleBroadcastActive({ db, broadcastId: id, active: !currentStatus });
    } catch (error) {
      console.error(error);
      setFeedback({ type: 'error', message: `Erro ao alterar visibilidade: ${error.message}` });
    }
  };

  const handleConfirmClosePoll = async () => {
    if (!pollToClose) return;
    setClosingPoll(true);
    try {
      await closeBroadcastPoll({ db, pollId: pollToClose.id });
      setFeedback({ type: 'success', message: 'Enquete encerrada com sucesso!' });
      setPollToClose(null);
    } catch (error) {
      console.error(error);
      setFeedback({ type: 'error', message: `Erro ao encerrar enquete: ${error.message}` });
    } finally {
      setClosingPoll(false);
    }
  };

  const handleDeleteClick = (msg) => {
    const isPoll = msg.contentType === 'poll' || !!msg.poll;
    const isTest = Boolean(msg.targetUid || msg.audienceMode === 'test');
    const responseCount = Number(msg.poll?.responseCount || 0);

    if (isPoll && !isTest && responseCount > 0) {
      setFeedback({
        type: 'error',
        message: 'Esta enquete possui respostas registradas e não pode ser excluída fisicamente. Desative-a para arquivá-la mantendo o histórico de métricas.',
      });
      return;
    }

    setBroadcastToDelete(msg);
  };

  const confirmDeleteBroadcast = async () => {
    if (!broadcastToDelete) return;
    const msg = broadcastToDelete;
    const isPoll = msg.contentType === 'poll' || !!msg.poll;
    const isTest = Boolean(msg.targetUid || msg.audienceMode === 'test');
    try {
      if (isPoll) {
        await deleteBroadcastPoll({
          db,
          pollId: msg.id,
          isTest,
          currentUid: auth.currentUser?.uid,
        });
      } else {
        await deleteDoc(doc(db, 'system_broadcasts', msg.id));
      }
      setFeedback({ type: 'success', message: 'Item excluído com sucesso.' });
    } catch (error) {
      console.error(error);
      setFeedback({ type: 'error', message: `Erro ao excluir: ${error.message}` });
    } finally {
      setBroadcastToDelete(null);
    }
  };

  // --- LÓGICA DE VISUALIZAÇÃO DO PREVIEW (Igual ao Receiver) ---
  const getPreviewTheme = (type) => {
    const redThemeBase = {
      bgClass: 'bg-gradient-to-br from-red-50 to-red-100 border-r border-red-100/50',
      titleColor: 'text-red-700',
      iconColor: 'text-red-600',
      barColor: 'bg-red-600',
      button: 'bg-red-600 hover:bg-red-700 text-white shadow-red-200'
    };

    const styles = {
      atualizacao: { ...redThemeBase, title: 'ATUALIZAÇÃO', icon: Zap },
      urgente: { ...redThemeBase, title: 'URGENTE', icon: Bell },
      aviso: { ...redThemeBase, title: 'ATENÇÃO', icon: AlertTriangle },
      comunicado: { ...redThemeBase, title: 'COMUNICADO', icon: Megaphone }
    };
    return styles[type] || styles.comunicado;
  };

  const previewTheme = getPreviewTheme(category);

  if (!isOpen) return null;

  return (
    <>
    <ExpandedModal isOpen={isOpen} onClose={onClose} title="Estúdio de Transmissão">
      <div className="admin-broadcast-modal-content flex h-full w-full flex-col bg-zinc-50 dark:bg-zinc-900">

        {/* --- ABAS PRINCIPAIS --- */}
        <div className="admin-modal-tabs flex items-center justify-between px-8 py-4 border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shrink-0">
          <div className="flex items-center gap-6">
            <button onClick={() => setActiveTab('create')} className={`flex items-center gap-2 text-xs font-bold uppercase tracking-wide pb-1 border-b-2 transition-all ${activeTab === 'create' ? 'border-red-600 text-red-600' : 'border-transparent text-zinc-400 hover:text-zinc-600'}`}>
              <Layout size={14} /> Estúdio
            </button>
            <button onClick={() => setActiveTab('history')} className={`flex items-center gap-2 text-xs font-bold uppercase tracking-wide pb-1 border-b-2 transition-all ${activeTab === 'history' ? 'border-red-600 text-red-600' : 'border-transparent text-zinc-400 hover:text-zinc-600'}`}>
              <History size={14} /> Histórico ({history.length})
            </button>
          </div>

          {/* Sub-toggle no Estúdio: Comunicado vs Enquete */}
          {activeTab === 'create' && (
            <div className="flex items-center rounded-xl bg-zinc-100 p-1 dark:bg-zinc-800">
              <button
                type="button"
                onClick={() => setBroadcastKind('message')}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition-all ${broadcastKind === 'message' ? 'bg-white text-red-600 shadow-sm dark:bg-zinc-900 dark:text-white' : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-white'}`}
              >
                <Megaphone size={13} /> Comunicado
              </button>
              <button
                type="button"
                onClick={() => setBroadcastKind('poll')}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition-all ${broadcastKind === 'poll' ? 'bg-white text-red-600 shadow-sm dark:bg-zinc-900 dark:text-white' : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-white'}`}
              >
                <Vote size={13} /> Enquete
              </button>
            </div>
          )}
        </div>

        {activeTab === 'create' ? (
          <div className="admin-broadcast-create flex flex-col lg:flex-row flex-1 overflow-hidden">

            {/* --- EDITOR (ESQUERDA) --- */}
            <div className="admin-broadcast-editor flex-1 space-y-6 overflow-y-auto bg-white p-6 custom-scrollbar dark:bg-zinc-900 lg:p-8">

              {broadcastKind === 'message' ? (
                // === FORMULÁRIO DE COMUNICADO PADRÃO ===
                <>
                  {/* Seletor de Categoria (Só se não tiver imagens) */}
                  {images.length === 0 && (
                    <div className="space-y-3">
                      <label className="text-[10px] font-black uppercase text-zinc-400 tracking-widest flex items-center gap-2">
                        <Palette size={12} /> Categoria Visual
                      </label>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        {Object.entries(themesSelection).map(([key, theme]) => (
                          <button key={key} onClick={() => setCategory(key)} className={`relative overflow-hidden rounded-xl p-3 border-2 transition-all flex flex-col items-center gap-2 group ${category === key ? `border-red-600 bg-red-50 dark:bg-red-900/10` : 'border-transparent bg-zinc-100 dark:bg-zinc-900 opacity-60 hover:opacity-100'}`}>
                            <div className={`w-8 h-8 rounded-full ${theme.bgClass} shadow-md mb-1 flex items-center justify-center text-zinc-700`}>
                              <theme.icon size={14} />
                            </div>
                            <span className="text-[10px] font-black uppercase text-zinc-600 dark:text-zinc-300">{theme.label}</span>
                            {category === key && <div className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full animate-pulse" />}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Upload de Imagens */}
                  <div className="space-y-3">
                    <label className="text-[10px] font-black uppercase text-zinc-400 tracking-widest flex items-center gap-2">
                      <Images size={12} /> Imagens / Slides ({images.length})
                    </label>

                    <div
                        onClick={() => fileInputRef.current?.click()}
                        className="border-2 border-dashed border-zinc-300 dark:border-zinc-700 rounded-2xl p-6 flex flex-col items-center justify-center cursor-pointer hover:border-red-500 hover:bg-red-50 dark:hover:bg-red-900/10 transition-all group"
                    >
                        <div className="p-3 bg-zinc-100 dark:bg-zinc-800 rounded-full mb-2 group-hover:scale-110 transition-transform">
                            <Upload size={20} className="text-zinc-400 group-hover:text-red-500" />
                        </div>
                        <p className="text-xs font-bold text-zinc-600 dark:text-zinc-300 group-hover:text-red-600">
                            {images.length > 0 ? "Adicionar mais imagens" : "Enviar imagens"}
                        </p>
                        <p className="text-[10px] text-zinc-400 mt-1">Suporta múltiplas imagens (até 10)</p>
                    </div>

                    {images.length > 0 && (
                        <div className="grid grid-cols-3 gap-2 mt-3">
                            {images.map((img, idx) => (
                                <div key={idx} className="relative aspect-[9/16] rounded-xl overflow-hidden border border-zinc-200 dark:border-zinc-800 group">
                                    <img src={img.preview} alt={`Slide ${idx}`} className="w-full h-full object-cover" />
                                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button onClick={() => handleRemoveImage(idx)} className="p-1.5 bg-red-600 text-white rounded-full hover:bg-red-700">
                                            <Trash size={14} />
                                        </button>
                                    </div>
                                    <span className="absolute top-1 left-1 bg-black/50 text-white text-[9px] px-1.5 rounded font-bold">{idx + 1}</span>
                                </div>
                            ))}
                        </div>
                    )}

                    <input type="file" ref={fileInputRef} onChange={handleImageChange} accept="image/jpeg,image/png,image/webp" multiple className="hidden" />
                  </div>

                  {/* Editor de Texto */}
                  {images.length === 0 && (
                    <div className="space-y-3 flex-1 flex flex-col">
                      <label className="text-[10px] font-black uppercase text-zinc-400 tracking-widest flex justify-between items-center">
                        <span className="flex items-center gap-2"><Type size={12} /> Mensagem</span>
                        <span className={message.length > 300 ? 'text-red-500' : 'text-zinc-400'}>{message.length} chars</span>
                      </label>
                      <div className="relative flex-1 min-h-[140px]">
                        <textarea value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Digite sua mensagem oficial aqui..." className="w-full h-full p-4 bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-800 rounded-2xl focus:ring-2 focus:ring-red-500/20 focus:border-red-500 outline-none text-sm leading-relaxed dark:text-white resize-none shadow-inner transition-all" />
                      </div>
                    </div>
                  )}
                </>
              ) : (
                // === FORMULÁRIO DE ENQUETE ===
                <div className="space-y-5">
                  {/* Título da Enquete */}
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase text-zinc-400 tracking-widest flex justify-between items-center">
                      <span className="flex items-center gap-2"><Vote size={12} /> Pergunta / Título da Enquete</span>
                      <span className={pollTitle.length > (PRODUCT_LIMITS?.polls?.maxTitleChars || 120) ? 'text-red-500 font-bold' : 'text-zinc-400'}>
                        {pollTitle.length}/{PRODUCT_LIMITS?.polls?.maxTitleChars || 120}
                      </span>
                    </label>
                    <input
                      type="text"
                      value={pollTitle}
                      onChange={(e) => setPollTitle(e.target.value.slice(0, PRODUCT_LIMITS?.polls?.maxTitleChars || 120))}
                      placeholder="Ex: Qual o melhor horário para o simulado de sábado?"
                      className="w-full p-3.5 bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-800 rounded-2xl focus:ring-2 focus:ring-red-500/20 focus:border-red-500 outline-none text-sm font-bold dark:text-white shadow-inner transition-all"
                    />
                  </div>

                  {/* Contexto / Descrição */}
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase text-zinc-400 tracking-widest flex justify-between items-center">
                      <span className="flex items-center gap-2"><Type size={12} /> Contexto ou Instruções (Opcional)</span>
                      <span className={pollDescription.length > (PRODUCT_LIMITS?.polls?.maxDescriptionChars || 600) ? 'text-red-500 font-bold' : 'text-zinc-400'}>
                        {pollDescription.length}/{PRODUCT_LIMITS?.polls?.maxDescriptionChars || 600}
                      </span>
                    </label>
                    <textarea
                      value={pollDescription}
                      onChange={(e) => setPollDescription(e.target.value.slice(0, PRODUCT_LIMITS?.polls?.maxDescriptionChars || 600))}
                      placeholder="Explique o objetivo da enquete ou dê detalhes adicionais para os estudantes..."
                      className="w-full h-24 p-3.5 bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-800 rounded-2xl focus:ring-2 focus:ring-red-500/20 focus:border-red-500 outline-none text-xs leading-relaxed dark:text-white resize-none shadow-inner transition-all"
                    />
                  </div>

                  {/* Lista de Opções Dinâmica */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <label className="text-[10px] font-black uppercase text-zinc-400 tracking-widest flex items-center gap-2">
                        <CheckCircle2 size={12} /> Opções de Resposta ({pollOptions.length}/{PRODUCT_LIMITS?.polls?.maxOptions || 6})
                      </label>
                      <span className="text-[10px] font-semibold text-zinc-400">Escolha única por aluno</span>
                    </div>

                    <div className="space-y-2">
                      {pollOptions.map((opt, index) => (
                        <div key={index} className="flex items-center gap-2">
                          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-zinc-100 text-xs font-black text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                            {String.fromCharCode(65 + index)}
                          </span>
                          <input
                            type="text"
                            value={opt}
                            onChange={(e) => handlePollOptionChange(index, e.target.value)}
                            placeholder={`Opção ${index + 1} (Ex: ${index === 0 ? '08:00 às 12:00' : index === 1 ? '14:00 às 18:00' : 'Outro'})`}
                            className="flex-1 p-2.5 bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-800 rounded-xl focus:ring-2 focus:ring-red-500/20 focus:border-red-500 outline-none text-xs font-semibold dark:text-white transition-all"
                          />
                          {pollOptions.length > (PRODUCT_LIMITS?.polls?.minOptions || 2) && (
                            <button
                              type="button"
                              onClick={() => handleRemovePollOption(index)}
                              className="p-2 text-zinc-400 hover:text-red-600 rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                              title="Remover opção"
                            >
                              <Minus size={16} />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>

                    {pollOptions.length < (PRODUCT_LIMITS?.polls?.maxOptions || 6) && (
                      <button
                        type="button"
                        onClick={handleAddPollOption}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-dashed border-zinc-300 px-3.5 py-2 text-xs font-bold text-zinc-600 hover:border-red-500 hover:text-red-600 dark:border-zinc-700 dark:text-zinc-300 dark:hover:border-red-500 transition-colors"
                      >
                        <Plus size={14} /> Adicionar Opção
                      </button>
                    )}
                  </div>

                  {/* Prazo de Encerramento Opcional */}
                  <div className="space-y-3 rounded-2xl border border-zinc-200 bg-zinc-50/70 p-4 dark:border-zinc-800 dark:bg-zinc-800/30">
                    <label className="flex items-center gap-2.5 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={hasDeadline}
                        onChange={(e) => setHasDeadline(e.target.checked)}
                        className="rounded border-zinc-300 text-red-600 focus:ring-red-500"
                      />
                      <span className="text-xs font-bold text-zinc-800 dark:text-zinc-200">
                        Definir prazo de encerramento automático
                      </span>
                    </label>

                    {hasDeadline && (
                      <div className="pt-2">
                        <label className="text-[10px] font-black uppercase text-zinc-400 tracking-wider block mb-1.5 flex items-center gap-1">
                          <Clock size={11} /> Data e Hora Limite
                        </label>
                        <input
                          type="datetime-local"
                          value={pollClosesAt}
                          onChange={(e) => setPollClosesAt(e.target.value)}
                          className="w-full p-2.5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl text-xs font-bold text-zinc-800 dark:text-zinc-100 outline-none focus:border-red-500"
                        />
                        <p className="mt-1 text-[10px] text-zinc-400">
                          Após essa data/hora, a enquete será travada e os resultados percentuais ficarão visíveis para os alunos.
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Segmento Selecionado */}
              {selectedSegment && !isTestMode && (
                <div className="p-4 rounded-2xl border border-red-100 dark:border-red-900/30 bg-red-50/70 dark:bg-red-950/20 space-y-2">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-[0.16em] text-red-500">Audiência segmentada</p>
                      <p className="text-sm font-bold text-zinc-900 dark:text-white">{selectedSegment.label}</p>
                    </div>
                    <button onClick={() => setSelectedSegment(null)} className="text-[10px] font-black uppercase tracking-[0.16em] text-zinc-500 hover:text-red-600 transition-colors">
                      Limpar
                    </button>
                  </div>
                  <p className="text-xs font-medium text-zinc-600 dark:text-zinc-300">{selectedSegment.description || selectedSegment.subtitle}</p>
                  <p className="text-[11px] font-bold text-red-600 dark:text-red-300">{selectedSegment.audienceCount || 0} usuários receberão este broadcast.</p>
                </div>
              )}

              {/* Modo de Teste */}
              <div onClick={() => setIsTestMode(!isTestMode)} className={`p-3 rounded-xl border flex items-center gap-3 cursor-pointer transition-all ${isTestMode ? 'bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800' : 'bg-zinc-50 border-zinc-200 dark:bg-zinc-900 dark:border-zinc-800'}`}>
                <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${isTestMode ? 'bg-red-600 border-red-600 text-white' : 'border-zinc-300 dark:border-zinc-600'}`}>
                  {isTestMode && <Check size={12} strokeWidth={4} />}
                </div>
                <div>
                    <span className={`text-xs font-bold ${isTestMode ? 'text-red-700 dark:text-red-400' : 'text-zinc-500'}`}>Modo de Teste</span>
                    <p className="text-[10px] text-zinc-400">Somente você verá esta publicação.</p>
                </div>
              </div>

              {/* Botão de Publicação */}
              {broadcastKind === 'message' ? (
                <button
                  onClick={handleSendBroadcast}
                  disabled={(!message.trim() && images.length === 0) || sending}
                  className="w-full py-4 bg-red-600 text-white rounded-xl font-black uppercase tracking-widest hover:bg-red-700 transition-all disabled:opacity-50 flex items-center justify-center gap-3 active:scale-95 shadow-md shadow-red-600/20"
                >
                  {sending ? <Loader2 className="animate-spin" /> : <Megaphone />} {isTestMode ? 'Publicar Teste' : selectedSegment?.audienceCount ? `Publicar para ${selectedSegment.audienceCount}` : 'Publicar Comunicado'}
                </button>
              ) : (
                <button
                  onClick={handleSendPoll}
                  disabled={!pollTitle.trim() || pollOptions.filter(o => o.trim()).length < (PRODUCT_LIMITS?.polls?.minOptions || 2) || sending}
                  className="w-full py-4 bg-red-600 text-white rounded-xl font-black uppercase tracking-widest hover:bg-red-700 transition-all disabled:opacity-50 flex items-center justify-center gap-3 active:scale-95 shadow-md shadow-red-600/20"
                >
                  {sending ? <Loader2 className="animate-spin" /> : <Vote />} {isTestMode ? 'Publicar Enquete (Teste)' : selectedSegment?.audienceCount ? `Publicar Enquete para ${selectedSegment.audienceCount}` : 'Publicar Enquete'}
                </button>
              )}
            </div>

            {/* --- LIVE PREVIEW (DIREITA) --- */}
            <div className="admin-broadcast-preview relative flex flex-1 flex-col items-center justify-center overflow-hidden border-l border-zinc-700 bg-zinc-800/95 p-8">
              <div className="absolute top-6 right-6 flex bg-zinc-900 rounded-lg p-1 shadow-sm border border-zinc-800 z-10">
                <button onClick={() => setPreviewMode('mobile')} className={`p-2 rounded-md transition-all ${previewMode === 'mobile' ? 'bg-red-600 text-white' : 'text-zinc-500 hover:text-white'}`}><Smartphone size={16} /></button>
                <button onClick={() => setPreviewMode('desktop')} className={`p-2 rounded-md transition-all ${previewMode === 'desktop' ? 'bg-red-600 text-white' : 'text-zinc-500 hover:text-white'}`}><Monitor size={16} /></button>
              </div>

              <h3 className="absolute top-8 left-8 text-[10px] font-black uppercase text-zinc-500 tracking-widest flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" /> Live Preview (Estudante)
              </h3>

              {/* CONTAINER DO MOCKUP */}
              <div className={`transition-all duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)] origin-center z-0 ${previewMode === 'mobile' ? 'w-[320px] scale-100' : 'w-[500px] scale-90'}`}>

                {broadcastKind === 'poll' ? (
                  // === PREVIEW: MODO ENQUETE ===
                  <div className="relative w-full overflow-hidden bg-white rounded-3xl shadow-2xl border border-zinc-200 flex flex-col">
                    {/* Header Visual */}
                    <div className="relative overflow-hidden bg-gradient-to-br from-red-50 to-red-100 border-b border-red-100/50 p-6 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white shadow-md text-red-600">
                          <Vote size={22} />
                        </div>
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="text-[10px] font-black uppercase tracking-widest text-red-600">ENQUETE</span>
                            <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[8px] font-black uppercase text-emerald-600">Aberta</span>
                          </div>
                          <p className="text-[10px] font-semibold text-zinc-400">
                            {hasDeadline && pollClosesAt ? `Encerra em ${formatDateTime(pollClosesAt)}` : 'Voto único e definitivo'}
                          </p>
                        </div>
                      </div>
                      <div className="p-1.5 text-zinc-400 bg-white/80 rounded-full shadow-sm">
                        <X size={14} />
                      </div>
                    </div>

                    {/* Pergunta e Opções */}
                    <div className="p-6 space-y-4">
                      <div>
                        <h4 className="text-sm font-black text-zinc-900 leading-snug">
                          {pollTitle || 'Qual sua opinião sobre este tema?'}
                        </h4>
                        {pollDescription && (
                          <p className="mt-1 text-xs text-zinc-500 leading-relaxed whitespace-pre-wrap">{pollDescription}</p>
                        )}
                      </div>

                      <div className="space-y-2">
                        {pollOptions.filter(o => o.trim() || pollOptions.length <= 2).map((opt, idx) => (
                          <div
                            key={idx}
                            className="flex items-center gap-3 rounded-2xl border border-zinc-200 bg-zinc-50/70 p-3.5 transition-all"
                          >
                            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-white border border-zinc-200 text-[11px] font-black text-zinc-700 shadow-sm">
                              {String.fromCharCode(65 + idx)}
                            </span>
                            <span className="text-xs font-bold text-zinc-700 flex-1">
                              {opt || `Opção ${idx + 1}`}
                            </span>
                            <div className="h-4 w-4 rounded-full border-2 border-zinc-300" />
                          </div>
                        ))}
                      </div>

                      <div className="pt-2">
                        <div className="w-full py-3 bg-red-600 text-white rounded-xl text-center text-xs font-black uppercase tracking-wider opacity-90 shadow-md shadow-red-600/20">
                          Confirmar Resposta
                        </div>
                      </div>
                    </div>

                    {/* Footer com logo */}
                    <div className="p-3 border-t border-zinc-100 bg-zinc-50/70 flex items-center justify-center gap-2 opacity-50">
                      <img src="/logoModoQAP.png" className="h-3 w-auto object-contain grayscale" alt="Logo" />
                      <div className="h-2 w-px bg-zinc-300"></div>
                      <span className="text-red-600 font-black tracking-widest uppercase text-[8px]">MODOQAP</span>
                    </div>
                  </div>
                ) : images.length > 0 ? (
                  // === PREVIEW: MODO IMAGEM/CARROSSEL ===
                  <div className="relative w-full flex flex-col items-center">
                    <div className="relative rounded-2xl overflow-hidden shadow-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center w-full aspect-[9/16]">
                      {/* Botão Fechar Simulado */}
                      <div className="absolute top-3 right-3 p-1.5 bg-black/50 text-white rounded-full border border-white/10 z-50">
                        <X size={14} />
                      </div>

                      <AnimatePresence mode="wait">
                        <motion.img
                          key={previewIndex}
                          src={images[previewIndex].preview}
                          alt="Preview"
                          initial={{ opacity: 0, x: 20 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: -20 }}
                          className="relative z-10 w-auto h-auto max-w-full max-h-full object-contain"
                        />
                      </AnimatePresence>

                      {/* Controles de Navegação */}
                      {images.length > 1 && (
                        <>
                          <button
                            onClick={() => setPreviewIndex(prev => prev === 0 ? images.length - 1 : prev - 1)}
                            className="absolute left-2 top-1/2 -translate-y-1/2 p-2 bg-black/50 text-white rounded-full hover:bg-black/70 backdrop-blur-sm z-20"
                          >
                            <ChevronLeft size={20} />
                          </button>
                          <button
                            onClick={() => setPreviewIndex(prev => (prev + 1) % images.length)}
                            className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-black/50 text-white rounded-full hover:bg-black/70 backdrop-blur-sm z-20"
                          >
                            <ChevronRight size={20} />
                          </button>
                          <div className="absolute bottom-4 w-full flex justify-center gap-1.5 z-20">
                            {images.map((_, i) => (
                              <div key={i} className={`h-1.5 rounded-full transition-all ${i === previewIndex ? 'bg-white w-4' : 'bg-white/40 w-1.5'}`} />
                            ))}
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                ) : (
                  // === PREVIEW: MODO TEXTO ===
                  <div className={`
                    relative w-full overflow-hidden bg-white
                    rounded-3xl shadow-2xl border border-zinc-200
                    flex flex-col ${previewMode === 'desktop' ? 'md:flex-row' : ''}
                  `}>
                    {/* Lado Esquerdo (Visual) */}
                    <div className={`
                      relative overflow-hidden flex flex-col items-center justify-center shrink-0
                      w-full ${previewMode === 'desktop' ? 'md:w-5/12' : ''}
                      py-10
                      ${previewTheme.bgClass}
                    `}>
                      <div className="absolute inset-0 flex items-center justify-center opacity-[0.07] pointer-events-none mix-blend-multiply">
                        <img src="/logoModoQAP.png" alt="Watermark" className="w-[140%] h-[140%] object-contain scale-150 grayscale" />
                      </div>
                      <div className="relative z-10 w-16 h-16 bg-white/60 backdrop-blur-md rounded-2xl border border-white/40 flex items-center justify-center shadow-lg mb-3">
                        {React.createElement(previewTheme.icon, { size: 32, className: previewTheme.iconColor })}
                      </div>
                      <h2 className={`relative z-10 text-xl font-black ${previewTheme.titleColor} uppercase tracking-widest drop-shadow-sm`}>{previewTheme.title}</h2>
                    </div>

                    {/* Lado Direito (Texto) */}
                    <div className={`flex flex-col relative bg-white overflow-hidden w-full ${previewMode === 'desktop' ? 'md:w-7/12' : ''}`}>
                      <div className="absolute top-3 right-3 p-1.5 text-zinc-400 bg-zinc-100 rounded-full">
                        <X size={14} />
                      </div>

                      <div className="flex-1 p-6 min-h-[150px]">
                        <div className="flex items-center gap-2 mb-3">
                          <div className={`w-1 h-5 rounded-full ${previewTheme.barColor}`}></div>
                          <h3 className={`text-sm font-bold ${previewTheme.titleColor} uppercase`}>{previewTheme.title}</h3>
                        </div>
                        <p className="text-xs md:text-sm text-zinc-600 whitespace-pre-wrap leading-relaxed font-medium">
                          {message || "O conteúdo da sua mensagem aparecerá aqui..."}
                        </p>
                      </div>

                      <div className="p-4 border-t border-zinc-100 bg-zinc-50 flex flex-col items-center">
                        <div className={`px-6 py-2 rounded-lg font-bold text-[10px] uppercase tracking-widest shadow-md flex items-center gap-2 mb-2 ${previewTheme.button}`}>
                          <Check size={12} strokeWidth={3} /> Ciente
                        </div>
                        <div className="flex items-center justify-center gap-2 opacity-40">
                          <img src="/logoModoQAP.png" className="h-3 w-auto object-contain grayscale" alt="Logo" />
                          <div className="h-2 w-px bg-zinc-300"></div>
                          <h1 className="text-red-600 font-black tracking-widest uppercase text-[8px]">MODOQAP</h1>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : (
          // === ABA HISTÓRICO ===
          <div className="admin-modal-scroll flex-1 overflow-y-auto bg-white p-6 custom-scrollbar dark:bg-zinc-900 lg:p-10">
            <div className="max-w-4xl mx-auto w-full space-y-4">
              {history.length === 0 && <div className="text-center py-20 opacity-50"><p>Nenhum broadcast enviado.</p></div>}
              {history.map((msg) => {
                const isPoll = msg.contentType === 'poll' || !!msg.poll;
                const effectiveStatus = isPoll ? getPollEffectiveStatus(msg.poll || msg) : null;
                const isPollClosed = effectiveStatus === 'closed_manual' || effectiveStatus === 'closed_deadline';

                return (
                  <div key={msg.id} className="p-5 rounded-2xl border border-zinc-200 dark:border-zinc-800 flex flex-col sm:flex-row justify-between gap-4 bg-white dark:bg-zinc-900 items-start sm:items-center hover:shadow-md transition-all">
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-2">
                        {isPoll ? (
                          <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded bg-purple-50 text-purple-700 dark:bg-purple-950/30 dark:text-purple-400 flex items-center gap-1 border border-purple-200 dark:border-purple-800">
                            <Vote size={10} /> Enquete
                          </span>
                        ) : (
                          <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-500">
                            {msg.category || 'Comunicado'}
                          </span>
                        )}

                        <span className={`text-[9px] font-bold uppercase px-2 py-0.5 rounded ${msg.active ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/30 dark:text-emerald-400' : 'bg-red-50 text-red-500 dark:bg-red-950/30 dark:text-red-400'}`}>
                          {msg.active ? 'Ativo' : 'Inativo'}
                        </span>

                        {isPoll && (
                          <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded ${isPollClosed ? 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400' : 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/30 dark:text-emerald-400'}`}>
                            {isPollClosed ? 'Encerrada' : 'Aberta'}
                          </span>
                        )}

                        {msg.imageUrls && msg.imageUrls.length > 0 && (
                          <span className="text-[9px] font-bold uppercase px-2 py-0.5 rounded bg-blue-50 text-blue-600 flex items-center gap-1">
                            <Images size={10}/> {msg.imageUrls.length} Slides
                          </span>
                        )}
                        {!msg.imageUrls && msg.imageUrl && (
                          <span className="text-[9px] font-bold uppercase px-2 py-0.5 rounded bg-blue-50 text-blue-600 flex items-center gap-1">
                            <ImageIcon size={10}/> 1 Imagem
                          </span>
                        )}

                        {msg.targetUid && <span className="text-[9px] font-bold uppercase px-2 py-0.5 rounded border bg-amber-50 text-amber-600 border-amber-200">Teste</span>}
                        {msg.segmentLabel && <span className="text-[9px] font-bold uppercase px-2 py-0.5 rounded border bg-red-50 text-red-600 border-red-200">{msg.segmentLabel}</span>}
                      </div>

                      <p className="text-sm font-bold text-zinc-900 dark:text-white line-clamp-1 truncate">
                        {isPoll ? (msg.title || msg.poll?.title || 'Enquete') : (msg.message || '(Conteúdo Visual)')}
                      </p>

                      {isPoll && msg.message && (
                        <p className="text-xs text-zinc-500 line-clamp-1 truncate mt-0.5">{msg.message}</p>
                      )}

                      <div className="flex items-center gap-3 text-[10px] text-zinc-400 mt-1">
                        <span>{formatTimeAgo(msg.timestamp)}</span>
                        {isPoll && msg.poll?.closesAt && (
                          <span>· Prazo: {formatDateTime(msg.poll.closesAt)}</span>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 self-end sm:self-center">
                      {isPoll && (
                        <>
                          <button
                            type="button"
                            onClick={() => setSelectedPollForResults(msg)}
                            className="inline-flex items-center gap-1 rounded-xl bg-zinc-100 px-3 py-2 text-xs font-black uppercase text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700 transition-colors"
                            title="Ver estatísticas e votos"
                          >
                            <BarChart3 size={14} /> Resultados
                          </button>

                          {!isPollClosed && (
                            <button
                              type="button"
                              onClick={() => setPollToClose(msg)}
                              className="inline-flex items-center gap-1 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-black uppercase text-amber-700 hover:bg-amber-100 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-400 transition-colors"
                              title="Encerrar votação manualmente"
                            >
                              <Lock size={14} /> Encerrar
                            </button>
                          )}
                        </>
                      )}

                      <button
                        type="button"
                        onClick={() => handleToggleActive(msg.id, msg.active)}
                        className={`p-2 rounded-xl transition-colors ${msg.active ? 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300' : 'bg-amber-50 text-amber-600 hover:bg-amber-100 dark:bg-amber-950/30'}`}
                        title={msg.active ? 'Desativar exibição' : 'Ativar exibição'}
                      >
                        <Power size={16}/>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleDeleteClick(msg)}
                        className="p-2 bg-red-50 text-red-500 rounded-xl hover:bg-red-100 dark:bg-red-950/30 dark:hover:bg-red-900/40 transition-colors"
                        title="Excluir permanentemente"
                      >
                        <Trash2 size={16}/>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </ExpandedModal>

    {/* Modal de Resultados da Enquete */}
    <PollResultsModal
      isOpen={Boolean(selectedPollForResults)}
      onClose={() => setSelectedPollForResults(null)}
      poll={selectedPollForResults}
      users={users}
    />

    {/* Modal de Confirmação para Encerrar Enquete */}
    <ConfirmModal
      isOpen={Boolean(pollToClose)}
      onClose={() => setPollToClose(null)}
      onConfirm={handleConfirmClosePoll}
      title="Encerrar enquete?"
      message={`Tem certeza que deseja encerrar a enquete "${pollToClose?.title || ''}"? Esta ação é definitiva e nenhum novo voto poderá ser computado.`}
      confirmText={closingPoll ? 'Encerrando…' : 'Encerrar Enquete'}
      isDestructive
    />

    {/* Modal de Confirmação de Exclusão */}
    <ConfirmModal
      isOpen={Boolean(broadcastToDelete)}
      onClose={() => setBroadcastToDelete(null)}
      onConfirm={confirmDeleteBroadcast}
      title="Excluir publicação?"
      message="Este item será removido permanentemente do histórico."
      confirmText="Excluir"
      isDestructive
    />

    {/* Alerta de Feedback */}
    {feedback && (
      <div className={`fixed top-5 left-1/2 -translate-x-1/2 z-[10050] px-5 py-3 rounded-2xl text-sm font-bold text-white shadow-2xl flex items-center gap-3 animate-slide-up ${feedback.type === 'success' ? 'bg-emerald-600' : 'bg-red-600'}`}>
        <span>{feedback.message}</span>
        <button onClick={() => setFeedback(null)} className="opacity-80 hover:opacity-100 text-base">×</button>
      </div>
    )}
    </>
  );
};

export default HeaderBroadcast;
