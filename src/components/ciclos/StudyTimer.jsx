import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Play, Pause, Square, Minimize2, X, AlertTriangle,
  Maximize, Minimize, Target
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const STORAGE_KEY = '@ModoQAP:ActiveSession';

const formatTime = (totalSeconds) => {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return [hours, minutes, seconds].map(v => String(v).padStart(2, '0')).join(':');
};

const WHITE_NOISE_URL = 'https://raw.githubusercontent.com/anars/blank-audio/master/10-minutes-of-silence.mp3';

const ConfirmationModal = ({ isOpen, onConfirm, onCancel }) => {
    if (!isOpen) return null;
    return (
        <motion.div
            className="fixed inset-0 z-[10000] bg-zinc-950/70 backdrop-blur-sm flex items-center justify-center p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
        >
            <div className="bg-zinc-900 border border-red-500/30 shadow-2xl rounded-xl p-6 w-full max-w-sm">
                <div className="flex items-start gap-4">
                    <AlertTriangle className="text-red-500 mt-0.5 shrink-0" size={24} />
                    <div>
                        <h3 className="text-lg font-bold text-white mb-1">Cancelar Sessão?</h3>
                        <p className="text-sm text-zinc-400">O tempo estudado será perdido.</p>
                    </div>
                </div>
                <div className="mt-6 flex justify-end gap-3">
                    <button onClick={onCancel} className="px-4 py-2 text-sm font-semibold text-zinc-300 bg-zinc-800 rounded-lg hover:bg-zinc-700">Manter</button>
                    <button onClick={onConfirm} className="px-4 py-2 text-sm font-bold text-white bg-red-600 rounded-lg hover:bg-red-700">Sim, Cancelar</button>
                </div>
            </div>
        </motion.div>
    );
}

function StudyTimer({ disciplina, assunto, onStop, onCancel, isMinimized, onMaximize: onWidgetMode, onMinimize: onWidgetMinimize }) {
  const [isPreparing, setIsPreparing] = useState(true);
  const [countdown, setCountdown] = useState(3);
  const [seconds, setSeconds] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Refs para controle preciso do tempo
  const startTimeRef = useRef(null);
  const accumulatedTimeRef = useRef(0);
  const audioRef = useRef(null);
  const intervalRef = useRef(null);
  const originalTitleRef = useRef(document.title);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().then(() => setIsFullscreen(true)).catch(err => console.log(err));
    } else {
        document.exitFullscreen().then(() => setIsFullscreen(false));
    }
  };

  // --- Persistência ---
  const saveToStorage = useCallback((currentSeconds, pausedStatus) => {
      const currentStorage = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
      if (currentStorage.isFinishing) return;

      const data = {
          disciplinaId: disciplina?.id,
          disciplinaNome: disciplina?.nome,
          assunto: assunto,
          accumulatedTime: currentSeconds,
          lastTimestamp: Date.now(),
          isPaused: pausedStatus
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }, [disciplina, assunto]);

  // --- Inicialização e Restore ---
  useEffect(() => {
    const savedSession = localStorage.getItem(STORAGE_KEY);

    if (savedSession) {
        try {
            const data = JSON.parse(savedSession);
            const savedId = String(data.disciplinaId);
            const currentId = String(disciplina?.id);

            if (savedId === currentId && !data.isFinishing) {
                setIsPreparing(false);
                let restoredSeconds = Number(data.accumulatedTime) || 0;

                if (!data.isPaused) {
                    const now = Date.now();
                    const timeDiff = Math.floor((now - data.lastTimestamp) / 1000);
                    if (timeDiff >= 0 && timeDiff < 86400) {
                        restoredSeconds += timeDiff;
                    }
                }

                accumulatedTimeRef.current = restoredSeconds;
                setSeconds(restoredSeconds);
                setIsPaused(true);
                startTimeRef.current = null;
            } else {
               if (!data.isFinishing && savedId !== currentId) {
                   localStorage.removeItem(STORAGE_KEY);
               }
            }
        } catch (e) {
            console.error("Erro restore:", e);
        }
    }

    // Configura Audio
    audioRef.current = new Audio(WHITE_NOISE_URL);
    audioRef.current.loop = true;
    audioRef.current.volume = 0.01;

    return () => {
      clearInterval(intervalRef.current);
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      document.title = originalTitleRef.current;
      if ('mediaSession' in navigator) {
          navigator.mediaSession.metadata = null;
          navigator.mediaSession.playbackState = 'none';
      }
      if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    };
  }, [disciplina?.id]);

  // --- ATUALIZAÇÃO STATUS EXTERNO (ABA + TELA BLOQUEIO) ---
  const updateExternalStatus = useCallback((isRunning, currentSec) => {
    const timeString = formatTime(currentSec);
    const prefix = isRunning ? "Estudando" : "Pausado";
    const statusText = `${prefix}: ${timeString}`;

    // 1. Atualiza Título da Aba
    document.title = `${statusText} - ${disciplina.nome}`;

    // 2. Atualiza Media Session (Tela de Bloqueio)
    if ('mediaSession' in navigator) {
        navigator.mediaSession.metadata = new MediaMetadata({
            title: statusText,
            artist: disciplina.nome,
            album: 'Modo QAP',
            artwork: [
                { src: '/logo-pmba.png', sizes: '96x96', type: 'image/png' },
                { src: '/logo-pmba.png', sizes: '128x128', type: 'image/png' },
                { src: '/logo-pmba.png', sizes: '192x192', type: 'image/png' },
                { src: '/logo-pmba.png', sizes: '512x512', type: 'image/png' },
            ]
        });

        navigator.mediaSession.playbackState = isRunning ? 'playing' : 'paused';

        try {
            navigator.mediaSession.setActionHandler('play', () => handleTogglePause());
            navigator.mediaSession.setActionHandler('pause', () => handleTogglePause());
            navigator.mediaSession.setActionHandler('stop', () => handleStop());
        } catch(e) { /* Ignore */ }
    }
  }, [disciplina.nome]);

  // Função pura para calcular segundos totais
  const getExactTotalSeconds = () => {
    if (!startTimeRef.current) return accumulatedTimeRef.current;
    const now = Date.now();
    const sessionSeconds = Math.floor((now - startTimeRef.current) / 1000);
    return accumulatedTimeRef.current + sessionSeconds;
  };

  // --- Ciclo do Timer ---
  useEffect(() => {
    if (isPreparing) {
      if (countdown > 0) {
        const timer = setTimeout(() => setCountdown(c => c - 1), 1000);
        return () => clearTimeout(timer);
      } else {
        // Start Automático
        if (audioRef.current) audioRef.current.play().catch(() => {});
        setIsPreparing(false);
        startTimeRef.current = Date.now();
        setIsPaused(false);
      }
    }
  }, [isPreparing, countdown]);

  useEffect(() => {
      if (isPreparing) return;

      if (isPaused) {
          clearInterval(intervalRef.current);
          updateExternalStatus(false, seconds);
          return;
      }

      intervalRef.current = setInterval(() => {
        const currentTotal = getExactTotalSeconds();
        setSeconds(currentTotal);
        updateExternalStatus(true, currentTotal);
        saveToStorage(currentTotal, false);
      }, 1000);

      return () => clearInterval(intervalRef.current);
  }, [isPreparing, isPaused, updateExternalStatus, saveToStorage]);

  // --- Handlers ---
  const handleTogglePause = () => {
    setIsPaused(prev => {
      const willPause = !prev;

      if (willPause) {
        const exactTotal = getExactTotalSeconds();
        accumulatedTimeRef.current = exactTotal;
        startTimeRef.current = null;
        setSeconds(exactTotal);
        saveToStorage(exactTotal, true);
        if (audioRef.current) audioRef.current.pause();
        updateExternalStatus(false, exactTotal);
      } else {
        startTimeRef.current = Date.now();
        saveToStorage(accumulatedTimeRef.current, false);
        if (audioRef.current) audioRef.current.play().catch(() => {});
        updateExternalStatus(true, accumulatedTimeRef.current);
      }
      return willPause;
    });
  };

  const handleConfirmCancel = () => {
      setIsCancelModalOpen(false);
      localStorage.removeItem(STORAGE_KEY);
      clearInterval(intervalRef.current);
      if (audioRef.current) {
          audioRef.current.pause();
          audioRef.current.src = "";
      }
      if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'none';
      document.title = originalTitleRef.current;
      onCancel();
  };

  const handleStop = () => {
    clearInterval(intervalRef.current);
    if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = "";
    }
    if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'none';

    let finalSeconds = accumulatedTimeRef.current;

    if (startTimeRef.current) {
        const now = Date.now();
        const currentSession = Math.floor((now - startTimeRef.current) / 1000);
        finalSeconds += currentSession;
    }

    accumulatedTimeRef.current = finalSeconds;
    startTimeRef.current = null;
    setIsPaused(true);
    setSeconds(finalSeconds);

    const data = {
        disciplinaId: disciplina?.id,
        disciplinaNome: disciplina?.nome,
        assunto: assunto,
        accumulatedTime: finalSeconds,
        lastTimestamp: Date.now(),
        isPaused: true
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    onStop(Math.max(1, Math.round(finalSeconds / 60)));
  };

  // --- RENDERIZAÇÃO (Widget Minimizado) ---
  if (isMinimized) {
    return (
      <div className="fixed bottom-24 right-4 z-[9999] animate-fade-in">
        <div
          className="bg-zinc-900/90 backdrop-blur-md border border-emerald-500/30 shadow-[0_0_20px_rgba(16,185,129,0.2)] rounded-2xl p-3 flex items-center gap-4 w-auto max-w-[300px] overflow-hidden hover:scale-105 transition-transform cursor-pointer"
          onClick={onWidgetMode}
        >
          <div className="relative flex items-center justify-center w-10 h-10 bg-zinc-800 rounded-full shrink-0">
            <div className={`absolute inset-0 rounded-full ${isPaused ? 'bg-amber-500/20' : 'bg-emerald-500/20 animate-ping'}`}></div>
            <span className={`text-xs font-bold ${isPaused ? 'text-amber-500' : 'text-emerald-500'}`}>
              {isPaused ? '||' : 'ON'}
            </span>
          </div>
          <div className="flex flex-col mr-2 min-w-0">
            <span className="text-[10px] text-zinc-400 uppercase font-bold tracking-wider truncate">{disciplina.nome}</span>
            {assunto && <span className="text-[9px] text-emerald-400 truncate leading-tight">{assunto}</span>}
            <span className="text-xl font-mono font-bold text-white leading-none mt-0.5">{formatTime(seconds)}</span>
          </div>
          <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
            <button onClick={handleTogglePause} className={`p-2 rounded-full ${isPaused ? 'bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20' : 'bg-amber-500/10 text-amber-500 hover:bg-amber-500/20'}`}>
              {isPaused ? <Play size={14} fill="currentColor" /> : <Pause size={14} fill="currentColor" />}
            </button>
            <button onClick={onWidgetMode} className="p-2 rounded-full bg-zinc-800 text-zinc-400 hover:bg-zinc-700">
              <Maximize size={14} />
            </button>
          </div>
        </div>
      </div>
    );
  }

  // --- RENDERIZAÇÃO (Preparação) ---
  if (isPreparing) {
      return (
        <div className="fixed inset-0 z-[9999] bg-zinc-950 flex flex-col items-center justify-center">
            <motion.div
                key={countdown}
                initial={{ scale: 0.5, opacity: 0 }}
                animate={{ scale: 1.5, opacity: 1 }}
                exit={{ scale: 2, opacity: 0 }}
                transition={{ duration: 0.5 }}
                className="text-[15rem] font-black text-white drop-shadow-[0_0_30px_rgba(16,185,129,0.5)]"
            >
                {countdown > 0 ? countdown : "GO!"}
            </motion.div>
            <p className="mt-8 text-zinc-500 text-xl uppercase tracking-[0.5em] font-bold">Preparar Foco</p>
            {assunto && <p className="mt-2 text-emerald-500 font-bold">{assunto}</p>}
        </div>
      );
  }

  // --- RENDERIZAÇÃO (Timer Full) ---
  return (
    <div className="fixed inset-0 z-[9999] bg-zinc-950 flex flex-col items-center justify-center animate-fade-in overflow-hidden">
        <AnimatePresence>
            <ConfirmationModal isOpen={isCancelModalOpen} onConfirm={handleConfirmCancel} onCancel={() => setIsCancelModalOpen(false)} />
        </AnimatePresence>

        {/* LOGO AJUSTADA: Reduzida no Desktop (md:h-28) */}
        <div className="absolute top-6 left-1/2 -translate-x-1/2 z-20 opacity-80 pointer-events-none transition-all">
            <img src="/logo-pmba.png" alt="Logo" className="h-20 md:h-28 w-auto drop-shadow-2xl grayscale-[0.3]" />
        </div>

        <div className="absolute top-6 right-6 flex gap-3 z-30">
            <button onClick={toggleFullscreen} className="p-3 rounded-full bg-zinc-900 text-zinc-400 hover:text-white hover:bg-zinc-800 transition-all border border-zinc-800">
                {isFullscreen ? <Minimize size={20} /> : <Maximize size={20} />}
            </button>
            <button onClick={onWidgetMinimize} className="flex items-center gap-2 bg-zinc-900 text-zinc-400 hover:text-white hover:bg-zinc-800 transition-all px-4 py-2 rounded-full border border-zinc-800">
                <Minimize2 size={20} />
                <span className="hidden md:inline text-sm font-bold uppercase tracking-wide">Minimizar</span>
            </button>
        </div>

        <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, rgba(255,255,255,0.1) 1px, transparent 0)', backgroundSize: '40px 40px' }}></div>
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-emerald-500 to-transparent opacity-30"></div>

        <div className="relative z-10 flex flex-col items-center text-center w-full max-w-5xl px-4 mt-24 md:mt-32">
            <div className={`mb-6 px-4 py-1.5 rounded-full border text-[10px] md:text-sm font-bold tracking-[0.2em] uppercase flex items-center gap-2 ${isPaused ? 'border-amber-500/30 text-amber-500 bg-amber-500/5' : 'border-emerald-500/30 text-emerald-500 bg-emerald-500/5'}`}>
                <span className={`w-2 h-2 rounded-full ${isPaused ? 'bg-amber-500' : 'bg-emerald-500 animate-pulse'}`}></span>
                {isPaused ? 'Sessão Pausada' : 'Foco Absoluto'}
            </div>

            <h2 className="text-xl md:text-4xl font-bold text-zinc-300 mb-2 tracking-tight max-w-3xl leading-tight">{disciplina.nome}</h2>
            {assunto ? (
                <div className="flex items-center gap-2 text-emerald-500 bg-emerald-500/10 px-4 py-1.5 rounded-full mb-8 border border-emerald-500/20 max-w-full">
                    <Target size={14} className="shrink-0" />
                    <span className="text-xs md:text-sm font-bold uppercase tracking-wide truncate">{assunto}</span>
                </div>
            ) : (
                <p className="text-zinc-500 text-xs uppercase tracking-widest mb-10">Cronômetro Livre</p>
            )}

            <div className="relative mb-12 md:mb-16">
                <div className={`absolute -inset-10 blur-[50px] md:blur-[80px] opacity-15 rounded-full transition-colors duration-700 ${isPaused ? 'bg-amber-500' : 'bg-emerald-500'}`}></div>
                <div className={`text-6xl sm:text-8xl md:text-9xl lg:text-[11rem] font-mono font-bold leading-none tracking-tighter tabular-nums transition-colors duration-300 ${isPaused ? 'text-zinc-500' : 'text-white'}`} style={{ textShadow: isPaused ? 'none' : '0 0 30px rgba(16,185,129,0.3)' }}>
                    {formatTime(seconds)}
                </div>
            </div>

            <div className="flex items-center gap-4 md:gap-10">
                <button onClick={() => setIsCancelModalOpen(true)} className="group flex flex-col items-center gap-2 text-zinc-500 hover:text-red-500 transition-colors">
                    <div className="w-12 h-12 md:w-16 md:h-16 rounded-full border-2 border-zinc-800 group-hover:border-red-500/50 flex items-center justify-center bg-zinc-900 transition-all"><X size={20} className="md:w-6 md:h-6" /></div>
                    <span className="text-[10px] md:text-xs font-bold uppercase tracking-wider text-center pt-1">CANCELAR</span>
                </button>

                <button onClick={handleTogglePause} className={`w-20 h-20 md:w-32 md:h-32 rounded-full flex flex-col items-center justify-center shadow-2xl transition-all transform hover:scale-105 active:scale-95 ${isPaused ? 'bg-emerald-500 hover:bg-emerald-400 text-zinc-950' : 'bg-amber-500 hover:bg-amber-400 text-zinc-950'}`}>
                    {isPaused ? <Play size={32} fill="currentColor" className="ml-1 md:ml-2 md:w-10 md:h-10" /> : <Pause size={32} fill="currentColor" className="md:w-10 md:h-10" />}
                    <span className="mt-1 text-[10px] md:text-sm font-bold uppercase">{isPaused ? 'RETOMAR' : 'PAUSAR'}</span>
                </button>

                <button onClick={handleStop} className="group flex flex-col items-center gap-2 text-zinc-500 hover:text-emerald-500 transition-colors">
                    <div className="w-12 h-12 md:w-16 md:h-16 rounded-full border-2 border-zinc-800 group-hover:border-emerald-500/50 flex items-center justify-center bg-zinc-900 transition-all"><Square size={20} fill="currentColor" className="md:w-6 md:h-6" /></div>
                    <span className="text-[10px] md:text-xs font-bold uppercase tracking-wider text-center pt-1">FINALIZAR</span>
                </button>
            </div>
        </div>
    </div>
  );
}

export default StudyTimer;