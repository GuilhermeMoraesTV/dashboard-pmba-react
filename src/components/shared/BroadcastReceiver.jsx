import React, { useEffect, useState, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { db, auth } from '../../firebaseConfig';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Megaphone, Check, Zap, AlertTriangle, Bell, X, ChevronLeft, ChevronRight,
  BarChart3, CheckCircle2, Loader2, Clock, Lock
} from 'lucide-react';
import {
  getUserPollAnswer,
  submitPollVote,
  getPollResults,
} from '../../services/broadcastPollService';
import {
  isPollEffectiveClosed,
  calculatePollPercentages,
} from '../../contracts/broadcastPoll';

// Quantas vezes o broadcast pode aparecer antes de ser silenciado
const MAX_VIEWS = 2;

const toMillisSafe = (value) => {
  if (!value) return null;
  if (typeof value.toDate === 'function') return value.toDate().getTime();
  if (value instanceof Date) return value.getTime();
  const parsed = new Date(value).getTime();
  return Number.isNaN(parsed) ? null : parsed;
};

const getAuthCreatedAtMillis = (user) => (
  toMillisSafe(user?.metadata?.creationTime) ||
  toMillisSafe(user?.metadata?.createdAt) ||
  null
);

const BroadcastReceiver = ({
  canShow = true,
  userAccess = null,
  user: propUser = null,
  broadcasts = null,
}) => {
  const [notification, setNotification] = useState(null);
  const [isVisible, setIsVisible] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [userCreatedAtMillis, setUserCreatedAtMillis] = useState(null);

  // Estados específicos de Enquete
  const [selectedOptionId, setSelectedOptionId] = useState(null);
  const [submittingVote, setSubmittingVote] = useState(false);
  const [voteFeedback, setVoteFeedback] = useState(null);
  const [pollResults, setPollResults] = useState(null);
  const [loadingResults, setLoadingResults] = useState(false);
  const [userAnswer, setUserAnswer] = useState(null);

  const location = useLocation();
  const processedInSession = useRef(new Set());

  const user = propUser || auth.currentUser;
  const pathname = (location.pathname || '').toLowerCase();
  const isHome = pathname === '/' || pathname === '/app' || pathname === '/app/home' || pathname.startsWith('/app/home');
  const isAdmin = userAccess?.permissions?.adminPanel === true;

  const preloadImages = (urls) => {
    if (!urls?.length) return;
    urls.forEach((src) => {
      const img = new Image();
      img.src = src;
    });
  };

  useEffect(() => {
    if (!user) {
      setUserCreatedAtMillis(null);
      return;
    }

    const authMillis = getAuthCreatedAtMillis(user);
    if (authMillis) {
      setUserCreatedAtMillis(authMillis);
      return;
    }

    let alive = true;
    getDoc(doc(db, 'users', user.uid))
      .then((snap) => {
        if (!alive) return;
        const data = snap.exists() ? snap.data() : {};
        setUserCreatedAtMillis(
          toMillisSafe(data.createdAt) ||
          toMillisSafe(data.dataCriacao) ||
          toMillisSafe(data.created_at) ||
          null
        );
      })
      .catch(() => {
        if (alive) setUserCreatedAtMillis(null);
      });

    return () => { alive = false; };
  }, [user]);

  // Consumir broadcasts (fornecidos pelo hook useNotifications pai)
  useEffect(() => {
    if (!isHome || !user || !Array.isArray(broadcasts) || broadcasts.length === 0) return;

    let cancelled = false;

    const processBroadcasts = async () => {
      const now = Date.now();
      const createdAtMillis = userCreatedAtMillis || getAuthCreatedAtMillis(user);

      for (const item of broadcasts) {
        if (cancelled) break;
        const msgId = item.id;
        if (!msgId) continue;

        // Já processamos este ID nesta sessão?
        if (processedInSession.current.has(msgId)) continue;

        // --- BROADCAST DE TESTE ---
        if (item.targetUid) {
          if (item.targetUid !== user.uid && !isAdmin) continue;
        }

        // --- BROADCAST SEGMENTADO ---
        if (Array.isArray(item.targetUserIds) && item.targetUserIds.length > 0) {
          const canReceiveSegment = isAdmin || item.targetUserIds.includes(user.uid);
          if (!canReceiveSegment) continue;
        }

        // --- CHECAGEM DE TEMPO (24 horas) ---
        const msgMillis = toMillisSafe(item.timestamp) || now;
        if (now - msgMillis >= 24 * 60 * 60 * 1000) continue;

        // --- CHECAGEM DE DATA DE CRIAÇÃO DA CONTA ---
        if (!isAdmin && createdAtMillis && msgMillis < createdAtMillis) continue;

        // --- TRATAMENTO ESPECÍFICO PARA ENQUETES ---
        const isPoll = item.contentType === 'poll' || item._type === 'poll' || Boolean(item.poll);
        const isClosed = isPoll && isPollEffectiveClosed(item);

        let existingAnswer = null;
        if (isPoll) {
          try {
            existingAnswer = await getUserPollAnswer(db, user.uid, msgId);
          } catch (_) {}

          // Se a enquete está aberta e o usuário já votou, não precisa exibir popup invasivo
          if (!isClosed && existingAnswer) {
            processedInSession.current.add(msgId);
            continue;
          }
        }

        // --- CONTROLE ESTRITO DE VISUALIZAÇÕES (MAX_VIEWS = 2) ---
        const readRef = doc(db, 'users', user.uid, 'broadcasts_read', msgId);
        let viewCount = 0;

        try {
          const readSnap = await getDoc(readRef);
          if (readSnap.exists()) {
            viewCount = Number(readSnap.data()?.viewCount) || 0;
          }
        } catch (err) {
          try {
            const localCount = localStorage.getItem(`broadcast_views_${user.uid}_${msgId}`);
            if (localCount !== null) {
              viewCount = Number(localCount) || 0;
            }
          } catch (_) {}
        }

        if (viewCount >= MAX_VIEWS) {
          continue;
        }

        // Marca como processado nesta sessão
        processedInSession.current.add(msgId);
        const nextCount = viewCount + 1;

        try {
          await setDoc(readRef, {
            viewCount: nextCount,
            lastSeenAt: new Date(),
            msgId,
          }, { merge: true });
        } catch (_) {}

        try {
          localStorage.setItem(`broadcast_views_${user.uid}_${msgId}`, String(nextCount));
        } catch (_) {}

        if (cancelled) break;

        // Carrega resultados sob demanda se for enquete fechada
        if (isPoll && isClosed) {
          setLoadingResults(true);
          getPollResults(db, msgId)
            .then((res) => {
              if (!cancelled && res) setPollResults(res);
            })
            .catch(() => {})
            .finally(() => {
              if (!cancelled) setLoadingResults(false);
            });
        }

        setUserAnswer(existingAnswer);
        setSelectedOptionId(existingAnswer?.optionId || null);
        setNotification({ ...item, id: msgId });
        setCurrentIndex(0);
        if (item.imageUrls?.length) preloadImages(item.imageUrls);
        return;
      }
    };

    processBroadcasts();

    return () => {
      cancelled = true;
    };
  }, [isHome, user, isAdmin, userCreatedAtMillis, broadcasts]);

  useEffect(() => {
    if (notification && canShow && !isVisible) {
      const timer = setTimeout(() => setIsVisible(true), 100);
      return () => clearTimeout(timer);
    } else if (!notification) {
      setIsVisible(false);
    }
  }, [notification, canShow, isVisible]);

  const handleClose = () => {
    if (!notification) return;
    setIsVisible(false);
    setTimeout(() => {
      setNotification(null);
      setCurrentIndex(0);
      setSelectedOptionId(null);
      setVoteFeedback(null);
      setPollResults(null);
      setUserAnswer(null);
    }, 400);
  };

  const handleConfirmVote = async () => {
    if (!notification || !selectedOptionId || !user || submittingVote) return;
    setSubmittingVote(true);
    setVoteFeedback(null);

    try {
      const answer = await submitPollVote(db, user.uid, notification.id, selectedOptionId, userAccess);
      setUserAnswer(answer);
    } catch (err) {
      console.error('[BroadcastReceiver] erro ao votar:', err);
      setVoteFeedback({
        type: 'error',
        message: err.message || 'Não foi possível registrar seu voto. Tente novamente.',
      });
    } finally {
      setSubmittingVote(false);
    }
  };

  if (!isHome || !user || !notification) return null;

  const isPoll = notification.contentType === 'poll' || notification._type === 'poll' || Boolean(notification.poll);
  const isClosed = isPoll && isPollEffectiveClosed(notification);

  // --- MODO 1: ENQUETE ---
  if (isPoll) {
    const poll = notification.poll || {};
    const options = Array.isArray(poll.options) ? poll.options : [];
    const pollTitle = notification.title || notification.message || 'Enquete da Comunidade';
    const pollDescription = notification.description || poll.description || (notification.title && notification.message && notification.message !== notification.title ? notification.message : null);
    const calculatedStats = isClosed && pollResults
      ? calculatePollPercentages(pollResults, options)
      : null;
    const percentages = calculatedStats?.optionStats || [];

    return (
      <AnimatePresence>
        {isVisible && (
          <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/80 backdrop-blur-md transition-all cursor-default"
            />

            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              transition={{ type: 'spring', duration: 0.4, bounce: 0.15 }}
              className="relative w-full max-w-lg overflow-hidden bg-white dark:bg-zinc-900 rounded-3xl shadow-2xl border border-zinc-200/80 dark:border-zinc-800 flex flex-col max-h-[90vh]"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header Compacto e Focado na Enquete */}
              <div className="relative px-5 pt-5 pb-4 border-b border-zinc-100 dark:border-zinc-800 shrink-0 bg-zinc-50/70 dark:bg-zinc-900/80">
                <div className="flex items-center justify-between gap-2 mb-2.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-red-100 dark:bg-red-950/60 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-900/50">
                      <BarChart3 size={11} /> Enquete
                    </span>
                    {isClosed ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300">
                        <Lock size={10} /> Encerrada
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-900/50">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" /> Aberta
                      </span>
                    )}
                    {poll.closesAt && !isClosed && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold text-zinc-500 dark:text-zinc-400 bg-white dark:bg-zinc-800 border border-zinc-200/60 dark:border-zinc-700/60">
                        <Clock size={10} /> Encerra em {new Date(toMillisSafe(poll.closesAt)).toLocaleString('pt-BR')}
                      </span>
                    )}
                  </div>
                  <button
                    onClick={handleClose}
                    className="p-1.5 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-200/60 dark:hover:bg-zinc-800 rounded-full transition-colors shrink-0"
                    title="Fechar"
                  >
                    <X size={18} />
                  </button>
                </div>

                {/* Pergunta / Título */}
                <h2 className="text-base sm:text-lg font-black leading-snug tracking-tight text-zinc-900 dark:text-white">
                  {pollTitle}
                </h2>

                {/* Descrição / Contexto da Enquete */}
                {pollDescription && (
                  <p className="mt-2 text-xs text-zinc-600 dark:text-zinc-300 leading-relaxed font-normal bg-white/80 dark:bg-zinc-800/80 p-3 rounded-2xl border border-zinc-200/60 dark:border-zinc-700/60 whitespace-pre-wrap">
                    {pollDescription}
                  </p>
                )}
              </div>

              {/* Corpo da Enquete */}
              <div className="flex-1 p-5 overflow-y-auto custom-scrollbar space-y-3">
                {isClosed ? (
                  // === VISUALIZAÇÃO DE RESULTADOS FECHADOS ===
                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-xs text-zinc-500 dark:text-zinc-400 font-bold mb-1 px-1">
                      <span>Resultados Consolidados</span>
                      <span>Total: {pollResults?.responseCount || 0} {pollResults?.responseCount === 1 ? 'voto' : 'votos'}</span>
                    </div>

                    {loadingResults && !pollResults ? (
                      <div className="py-10 flex flex-col items-center justify-center gap-2 text-zinc-400 text-xs font-semibold">
                        <Loader2 className="animate-spin text-red-600" size={24} />
                        Carregando resultados...
                      </div>
                    ) : (
                      percentages.map((opt) => {
                        const isUserChoice = userAnswer?.optionId === opt.id;
                        return (
                          <div
                            key={opt.id}
                            className={`relative overflow-hidden rounded-2xl p-3.5 border transition-all ${
                              isUserChoice
                                ? 'border-red-500/60 bg-red-50/40 dark:bg-red-950/20'
                                : 'border-zinc-200 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-800/40'
                            }`}
                          >
                            <div
                              className="absolute inset-y-0 left-0 bg-red-500/15 dark:bg-red-500/20 transition-all duration-700"
                              style={{ width: `${opt.percentage}%` }}
                            />
                            <div className="relative z-10 flex items-center justify-between gap-3">
                              <div className="flex items-center gap-2 min-w-0">
                                {isUserChoice && (
                                  <span className="shrink-0 text-red-600 dark:text-red-400" title="Sua resposta">
                                    <CheckCircle2 size={16} />
                                  </span>
                                )}
                                <span className="text-xs md:text-sm font-bold text-zinc-800 dark:text-zinc-200 truncate">
                                  {opt.text}
                                </span>
                              </div>
                              <div className="shrink-0 text-right">
                                <span className="text-xs md:text-sm font-black text-red-600 dark:text-red-400">
                                  {opt.percentage.toFixed(1)}%
                                </span>
                                <span className="text-[10px] text-zinc-400 font-semibold ml-1.5">
                                  ({opt.count})
                                </span>
                              </div>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                ) : userAnswer ? (
                  // === ABERTA E JÁ VOTOU: TELA EXCLUSIVA DE CONFIRMAÇÃO E AGRADECIMENTO ===
                  <div className="py-6 px-2 flex flex-col items-center text-center space-y-4">
                    <div className="w-16 h-16 rounded-3xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shadow-lg shadow-emerald-500/20 border border-emerald-200 dark:border-emerald-800">
                      <CheckCircle2 size={36} strokeWidth={2.5} />
                    </div>

                    <div className="space-y-1.5 max-w-sm">
                      <h3 className="text-lg font-black text-zinc-900 dark:text-white">
                        Voto Confirmado!
                      </h3>
                      <p className="text-sm font-bold text-emerald-600 dark:text-emerald-400">
                        Obrigado pela sua participação!
                      </p>
                      <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed pt-1">
                        Sua resposta foi registrada de forma segura. Enquanto a enquete estiver aberta, o resultado parcial permanece sob sigilo para garantir a imparcialidade.
                      </p>
                    </div>

                    <div className="w-full max-w-sm rounded-2xl bg-zinc-50 dark:bg-zinc-800/60 p-3.5 border border-zinc-200/60 dark:border-zinc-700/60 text-left flex items-center gap-3">
                      <div className="w-8 h-8 rounded-xl bg-emerald-500 text-white flex items-center justify-center shrink-0 shadow-sm">
                        <Check size={16} strokeWidth={3} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-[10px] font-black uppercase tracking-wider text-zinc-400">Sua escolha:</p>
                        <p className="text-xs font-bold text-zinc-800 dark:text-zinc-200 truncate">
                          {options.find((o) => o.id === (userAnswer?.optionId || selectedOptionId))?.text || 'Opção registrada'}
                        </p>
                      </div>
                    </div>

                    <div className="w-full max-w-sm p-3 rounded-xl bg-blue-50/70 dark:bg-blue-950/30 border border-blue-100 dark:border-blue-900/40 text-[11px] text-blue-700 dark:text-blue-300 font-medium leading-relaxed text-center">
                      🔔 Assim que a enquete for encerrada, você receberá uma notificação para visualizar o resultado final!
                    </div>
                  </div>
                ) : (
                  // === VISUALIZAÇÃO DE VOTAÇÃO ABERTA ===
                  <div className="space-y-2.5">
                    <p className="text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider px-1">
                      Selecione uma opção:
                    </p>
                    {options.map((opt) => {
                      const isSelected = selectedOptionId === opt.id;
                      return (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => {
                            if (!userAnswer) setSelectedOptionId(opt.id);
                          }}
                          disabled={Boolean(userAnswer) || submittingVote}
                          className={`w-full text-left p-3.5 rounded-2xl border-2 transition-all flex items-center justify-between gap-3 group ${
                            isSelected
                              ? 'border-red-600 bg-red-50/70 dark:bg-red-950/30 shadow-sm'
                              : 'border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-850 hover:border-red-300 dark:hover:border-red-900/60'
                          } ${userAnswer ? 'cursor-default' : 'cursor-pointer active:scale-[0.99]'}`}
                        >
                          <span className={`text-xs md:text-sm font-bold ${
                            isSelected ? 'text-red-700 dark:text-red-300' : 'text-zinc-700 dark:text-zinc-200'
                          }`}>
                            {opt.text}
                          </span>
                          <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${
                            isSelected
                              ? 'border-red-600 bg-red-600 text-white'
                              : 'border-zinc-300 dark:border-zinc-600 group-hover:border-red-400'
                          }`}>
                            {isSelected && <div className="w-2 h-2 rounded-full bg-white" />}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* Feedback de erro / sucesso */}
                {voteFeedback && (
                  <div className={`p-3 rounded-xl text-xs font-bold flex items-center gap-2 ${
                    voteFeedback.type === 'success'
                      ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300'
                      : 'bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-300'
                  }`}>
                    {voteFeedback.type === 'success' ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
                    <span>{voteFeedback.message}</span>
                  </div>
                )}
              </div>

              {/* Rodapé da Enquete (Focado e sem "Responder depois") */}
              <div className="p-4 border-t border-zinc-100 dark:border-zinc-800 bg-zinc-50/60 dark:bg-zinc-900/60 shrink-0">
                {!isClosed && !userAnswer ? (
                  <button
                    type="button"
                    onClick={handleConfirmVote}
                    disabled={!selectedOptionId || submittingVote}
                    className="w-full py-3 px-5 rounded-xl font-black text-xs uppercase tracking-wider text-white bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 transition-all shadow-md hover:shadow-lg disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 active:scale-[0.99]"
                  >
                    {submittingVote ? (
                      <>
                        <Loader2 size={15} className="animate-spin" />
                        Gravando resposta...
                      </>
                    ) : (
                      <>
                        <Check size={15} strokeWidth={3} />
                        Confirmar resposta
                      </>
                    )}
                  </button>
                ) : (
                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={handleClose}
                      className="w-full sm:w-auto px-6 py-2.5 rounded-xl font-black text-xs uppercase tracking-wider text-zinc-700 dark:text-zinc-200 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-750 transition-colors"
                    >
                      {isClosed ? 'Fechar' : 'Entendido'}
                    </button>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    );
  }

  // --- MODO 2: CARROSSEL DE IMAGENS ---
  const images = notification.imageUrls || (notification.imageUrl ? [notification.imageUrl] : []);

  if (images.length > 0) {
    const nextSlide = (e) => {
      e?.stopPropagation();
      setCurrentIndex((prev) => (prev + 1) % images.length);
    };
    const prevSlide = (e) => {
      e?.stopPropagation();
      setCurrentIndex((prev) => (prev === 0 ? images.length - 1 : prev - 1));
    };

    return (
      <AnimatePresence>
        {isVisible && (
          <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 md:p-8">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/80 backdrop-blur-md transition-all cursor-default"
            />

            <div className="relative z-10 flex flex-col md:flex-row items-center gap-3 md:gap-4 w-full max-w-7xl justify-center h-full pointer-events-none">
              {images.length > 1 && (
                <button
                  onClick={prevSlide}
                  className="hidden md:flex pointer-events-auto p-2 bg-white/10 hover:bg-white/20 text-white rounded-full backdrop-blur-md transition-all border border-white/10 hover:scale-110 shadow-xl shrink-0"
                >
                  <ChevronLeft size={24} />
                </button>
              )}

              <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                transition={{ type: 'spring', duration: 0.4 }}
                className="relative pointer-events-auto flex flex-col items-center"
                onClick={(e) => e.stopPropagation()}
              >
                <button
                  onClick={handleClose}
                  className="absolute top-3 right-3 p-2 bg-black/50 hover:bg-red-600 text-white rounded-full backdrop-blur-md border border-white/10 transition-all z-50 shadow-lg"
                  title="Fechar"
                >
                  <X size={18} />
                </button>

                <div className="relative flex items-center justify-center min-h-[50vh] md:min-h-[60vh] min-w-[300px] w-auto">
                  <motion.img
                    key={currentIndex}
                    src={images[currentIndex]}
                    alt={`Slide ${currentIndex}`}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.3 }}
                    drag="x"
                    dragConstraints={{ left: 0, right: 0 }}
                    dragElastic={0.2}
                    onDragEnd={(e, { offset, velocity }) => {
                      const swipe = Math.abs(offset.x) * velocity.x;
                      if (swipe < -200) nextSlide();
                      else if (swipe > 200) prevSlide();
                    }}
                    className="relative z-10 w-auto h-auto max-w-[95vw] md:max-w-[80vw] max-h-[70vh] md:max-h-[85vh] object-contain block cursor-grab active:cursor-grabbing rounded-2xl overflow-hidden shadow-2xl border border-zinc-800"
                  />

                  {images.length > 1 && (
                    <div className="absolute bottom-4 left-0 w-full hidden md:flex justify-center gap-2 z-20 pointer-events-none">
                      {images.map((_, idx) => (
                        <div
                          key={idx}
                          className={`h-1.5 rounded-full transition-all shadow-sm ${
                            idx === currentIndex ? 'bg-white w-6' : 'bg-white/40 w-1.5'
                          }`}
                        />
                      ))}
                    </div>
                  )}
                </div>

                {images.length > 1 && (
                  <div className="flex md:hidden items-center justify-between w-full mt-4 px-4">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        prevSlide();
                      }}
                      className="p-3 bg-white/10 text-white rounded-full active:bg-white/20 border border-white/5"
                    >
                      <ChevronLeft size={24} />
                    </button>
                    <div className="flex gap-1.5">
                      {images.map((_, idx) => (
                        <div
                          key={idx}
                          className={`h-1.5 rounded-full transition-all ${
                            idx === currentIndex ? 'bg-white w-5' : 'bg-white/20 w-1.5'
                          }`}
                        />
                      ))}
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        nextSlide();
                      }}
                      className="p-3 bg-white/10 text-white rounded-full active:bg-white/20 border border-white/5"
                    >
                      <ChevronRight size={24} />
                    </button>
                  </div>
                )}
              </motion.div>

              {images.length > 1 && (
                <button
                  onClick={nextSlide}
                  className="hidden md:flex pointer-events-auto p-2 bg-white/10 hover:bg-white/20 text-white rounded-full backdrop-blur-md transition-all border border-white/10 hover:scale-110 shadow-xl shrink-0"
                >
                  <ChevronRight size={24} />
                </button>
              )}
            </div>
          </div>
        )}
      </AnimatePresence>
    );
  }

  // --- MODO 3: TEXTO ---
  const getTheme = (type) => {
    const redThemeBase = {
      bgClass: 'bg-gradient-to-br from-red-50 to-red-100 border-r border-red-100/50',
      titleColor: 'text-red-700',
      iconColor: 'text-red-600',
      barColor: 'bg-red-600',
      button: 'bg-red-600 hover:bg-red-700 text-white shadow-red-200',
    };
    const styles = {
      atualizacao: { ...redThemeBase, title: 'ATUALIZAÇÃO', icon: Zap },
      urgente: { ...redThemeBase, title: 'URGENTE', icon: Bell },
      aviso: { ...redThemeBase, title: 'ATENÇÃO', icon: AlertTriangle },
      comunicado: { ...redThemeBase, title: 'COMUNICADO', icon: Megaphone },
    };
    return styles[type] || styles.comunicado;
  };

  const theme = getTheme(notification.category);
  const Icon = theme.icon;
  const isLongText = notification.message && notification.message.length > 150;

  return (
    <AnimatePresence>
      {isVisible && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
          <style>{`
            .custom-scrollbar::-webkit-scrollbar { width: 4px; }
            .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
            .custom-scrollbar::-webkit-scrollbar-thumb { background: #ef4444; border-radius: 10px; }
            .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #dc2626; }
          `}</style>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/80 backdrop-blur-md transition-all cursor-default"
          />

          <motion.div
            initial={{ scale: 0.9, opacity: 0, y: 50 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 50 }}
            transition={{ type: 'spring', duration: 0.6, bounce: 0.3 }}
            className={`
              relative w-full overflow-hidden bg-white
              rounded-3xl shadow-2xl border border-zinc-200
              flex flex-col md:flex-row
              max-h-[85vh] md:max-h-auto
              ${isLongText ? 'max-w-4xl' : 'max-w-[360px] md:max-w-2xl'}
            `}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Lado Esquerdo */}
            <div className={`relative overflow-hidden flex flex-col items-center justify-center shrink-0 w-full md:w-5/12 py-10 md:py-0 md:min-h-[300px] ${theme.bgClass}`}>
              <div className="absolute inset-0 flex items-center justify-center opacity-[0.07] pointer-events-none mix-blend-multiply">
                <img src="/logoModoQAP.png" alt="Watermark" className="w-[140%] h-[140%] object-contain scale-150 grayscale" />
              </div>
              <motion.div
                initial={{ scale: 0, rotate: -45 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ delay: 0.2 }}
                className="relative z-10 w-16 h-16 md:w-20 md:h-20 bg-white/60 backdrop-blur-md rounded-2xl border border-white/40 flex items-center justify-center shadow-lg mb-3 md:mb-4"
              >
                <Icon size={32} className={`${theme.iconColor} drop-shadow-sm md:w-10 md:h-10`} />
              </motion.div>
              <div className="relative z-10 text-center px-4">
                <h2 className={`text-xl md:text-3xl font-black ${theme.titleColor} uppercase tracking-widest drop-shadow-sm font-sans`}>{theme.title}</h2>
                <div className={`h-1 w-12 ${theme.barColor} mx-auto mt-2 rounded-full opacity-50`}></div>
              </div>
            </div>

            {/* Lado Direito */}
            <div className="flex flex-col relative bg-white overflow-hidden w-full md:w-7/12">
              <button
                onClick={handleClose}
                className="absolute top-3 right-3 p-1.5 text-zinc-400 hover:text-red-500 hover:bg-zinc-100 transition-colors z-20 rounded-full"
              >
                <X size={18} />
              </button>
              <div className="flex-1 p-6 md:p-8 overflow-y-auto custom-scrollbar">
                <div className="flex items-center gap-2 mb-4 shrink-0">
                  <div className={`w-1 h-6 rounded-full ${theme.barColor}`}></div>
                  <h3 className={`text-lg font-bold ${theme.titleColor} uppercase tracking-tight`}>{theme.title}</h3>
                </div>
                <div className="prose prose-sm prose-zinc max-w-none">
                  <p className="text-sm md:text-base text-zinc-600 whitespace-pre-wrap font-medium leading-relaxed">{notification.message}</p>
                </div>
              </div>
              <div className="p-4 md:p-5 pt-2 mt-auto border-t border-zinc-100 bg-zinc-50 shrink-0 flex flex-col items-center justify-center">
                <button
                  onClick={handleClose}
                  className={`px-6 py-2 rounded-lg font-bold text-[10px] uppercase tracking-widest shadow-md hover:shadow-lg transition-all transform active:scale-95 flex items-center gap-2 mb-3 ${theme.button}`}
                >
                  <Check size={14} strokeWidth={3} /> Ciente
                </button>
                <div className="flex items-center justify-center gap-2 opacity-40">
                  <img src="/logoModoQAP.png" alt="Logo Sistema" className="h-4 w-auto object-contain grayscale" />
                  <div className="h-3 w-px bg-zinc-300"></div>
                  <h1 className="text-red-600 font-black tracking-widest uppercase text-[9px]">MODOQAP</h1>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default BroadcastReceiver;

