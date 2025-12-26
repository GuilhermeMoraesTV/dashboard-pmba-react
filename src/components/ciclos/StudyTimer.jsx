import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Play, Pause, Square, Minimize2, X, AlertTriangle, Maximize2, Volume2, Target } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// --- Função de Formatação ---
const formatTime = (totalSeconds) => {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return [hours, minutes, seconds].map(v => String(v).padStart(2, '0')).join(':');
};

// --- Áudio de Ruído Branco ---
const WHITE_NOISE_URL = 'https://raw.githubusercontent.com/anars/blank-audio/master/10-minutes-of-silence.mp3';

// --- Modal de Confirmação ---
const ConfirmationModal = ({ isOpen, onConfirm, onCancel }) => {
    if (!isOpen) return null;
    return (
        <motion.div
            className="fixed inset-0 z-[10000] bg-zinc-950/70 backdrop-blur-sm flex items-center justify-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
        >
            <div className="bg-zinc-900 border border-red-500/30 shadow-2xl rounded-xl p-6 w-full max-w-sm">
                <div className="flex items-start gap-4">
                    <AlertTriangle className="text-red-500 mt-0.5 shrink-0" size={24} />
                    <div>
                        <h3 className="text-lg font-bold text-white mb-1">Cancelar Sessão?</h3>
                        <p className="text-sm text-zinc-400">O tempo não será salvo.</p>
                    </div>
                </div>
                <div className="mt-6 flex justify-end gap-3">
                    <button onClick={onCancel} className="px-4 py-2 text-sm font-semibold text-zinc-300 bg-zinc-800 rounded-lg">Manter</button>
                    <button onClick={onConfirm} className="px-4 py-2 text-sm font-bold text-white bg-red-600 rounded-lg">Sim, Cancelar</button>
                </div>
            </div>
        </motion.div>
    );
}

// --- Componente Principal ---
function StudyTimer({ disciplina, assunto, onStop, onCancel, isMinimized, onMaximize, onMinimize }) {
  const [isPreparing, setIsPreparing] = useState(true);
  const [countdown, setCountdown] = useState(3);
  const [seconds, setSeconds] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);

  const [audioPermission, setAudioPermission] = useState(false);

  const startTimeRef = useRef(null);
  const accumulatedTimeRef = useRef(0);
  const audioRef = useRef(null);
  const intervalRef = useRef(null);
  const originalTitleRef = useRef(document.title);

  useEffect(() => {
    audioRef.current = new Audio(WHITE_NOISE_URL);
    audioRef.current.loop = true;
    audioRef.current.preload = 'auto';
    audioRef.current.volume = 0.05;

    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  const activateFocusMode = useCallback(async () => {
    if (!audioRef.current) return;

    try {
      await audioRef.current.play();
      setAudioPermission(true);

      if ('mediaSession' in navigator) {
        navigator.mediaSession.metadata = new MediaMetadata({
          title: assunto || 'Foco Total', // Mostra o Assunto na notificação
          artist: disciplina?.nome,
          album: 'ModoQAP',
          artwork: [{ src: '/soldado.png', sizes: '96x96', type: 'image/png' }]
        });
        navigator.mediaSession.playbackState = 'playing';

        navigator.mediaSession.setActionHandler('play', () => {
             setIsPaused(false);
             audioRef.current?.play();
        });
        navigator.mediaSession.setActionHandler('pause', () => {
             setIsPaused(true);
             audioRef.current?.pause();
        });
      }
    } catch (err) {
      console.warn("Autoplay bloqueado:", err);
      setAudioPermission(false);
    }
  }, [disciplina?.nome, assunto]);

  const updateExternalStatus = useCallback((isRunning, currentSec) => {
    const timeString = formatTime(currentSec);
    const statusText = isRunning ? `Estudando: ${timeString}` : `Pausado: ${timeString}`;

    document.title = `${timeString} - ${disciplina.nome}`;

    if ('mediaSession' in navigator) {
        navigator.mediaSession.metadata = new MediaMetadata({
            title: statusText,
            artist: assunto ? `${disciplina.nome} - ${assunto}` : disciplina.nome,
            album: 'ModoQAP',
            artwork: [{ src: '/soldado.png', sizes: '96x96', type: 'image/png' }]
        });
        navigator.mediaSession.playbackState = isRunning ? 'playing' : 'paused';
    }
  }, [disciplina.nome, assunto]);

  const calculateElapsedSeconds = useCallback(() => {
    if (startTimeRef.current === null) return accumulatedTimeRef.current;
    const now = Date.now();
    return Math.floor((now - startTimeRef.current) / 1000) + accumulatedTimeRef.current;
  }, []);

  useEffect(() => {
    if (isPreparing) {
      if (countdown > 0) {
        const timer = setTimeout(() => setCountdown(c => c - 1), 1000);
        return () => clearTimeout(timer);
      } else {
        activateFocusMode();
        setIsPreparing(false);
        if (!startTimeRef.current) {
            startTimeRef.current = Date.now();
        }
      }
    }
  }, [isPreparing, countdown, activateFocusMode]);

  useEffect(() => {
      if (isPreparing || isPaused) {
          clearInterval(intervalRef.current);
          if (isPaused) updateExternalStatus(false, seconds);
          return;
      }
      if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'playing';

      intervalRef.current = setInterval(() => {
        const currentSec = calculateElapsedSeconds();
        setSeconds(currentSec);
        updateExternalStatus(true, currentSec);
      }, 1000);

      return () => clearInterval(intervalRef.current);
  }, [isPreparing, isPaused, calculateElapsedSeconds, updateExternalStatus, seconds]);

  const handleTogglePause = () => {
    setIsPaused(prev => {
      const willPause = !prev;
      if (willPause) {
        const now = Date.now();
        const sessionSeconds = Math.floor((now - startTimeRef.current) / 1000);
        accumulatedTimeRef.current += sessionSeconds;
        startTimeRef.current = null;
        setSeconds(accumulatedTimeRef.current);
        if (audioRef.current) audioRef.current.pause();
      } else {
        startTimeRef.current = Date.now();
        if (audioRef.current) audioRef.current.play().catch(() => {});
      }
      return willPause;
    });
  };

  const handleRequestCancel = () => setIsCancelModalOpen(true);

  const handleConfirmCancel = () => {
      setIsCancelModalOpen(false);
      clearInterval(intervalRef.current);
      if (audioRef.current) audioRef.current.pause();
      document.title = originalTitleRef.current;
      onCancel();
  };

  const handleStop = () => {
    clearInterval(intervalRef.current);
    if (audioRef.current) audioRef.current.pause();
    document.title = originalTitleRef.current;
    const finalSeconds = calculateElapsedSeconds();
    const totalMinutos = Math.max(1, Math.round(finalSeconds / 60));
    onStop(totalMinutos);
  };

  // --- RENDERIZAÇÃO ---

  if (isMinimized) {
    return (
      <div className="fixed bottom-24 right-4 z-[9999] animate-fade-in">
        <div
          className="bg-zinc-900/90 backdrop-blur-md border border-emerald-500/30 shadow-[0_0_20px_rgba(16,185,129,0.2)] rounded-2xl p-3 flex items-center gap-4 w-auto max-w-[300px] overflow-hidden hover:scale-105 transition-transform cursor-pointer"
          onClick={onMaximize}
        >
          <div className="relative flex items-center justify-center w-10 h-10 bg-zinc-800 rounded-full shrink-0">
            <div className={`absolute inset-0 rounded-full ${isPaused ? 'bg-amber-500/20' : 'bg-emerald-500/20 animate-ping'}`}></div>
            <span className={`text-xs font-bold ${isPaused ? 'text-amber-500' : 'text-emerald-500'}`}>
              {isPaused ? '||' : 'ON'}
            </span>
          </div>
          <div className="flex flex-col mr-2 min-w-0">
            <span className="text-[10px] text-zinc-400 uppercase font-bold tracking-wider truncate">
              {disciplina.nome}
            </span>
            {assunto && (
               <span className="text-[9px] text-emerald-400 truncate leading-tight">{assunto}</span>
            )}
            <span className="text-xl font-mono font-bold text-white leading-none mt-0.5">
              {formatTime(seconds)}
            </span>
          </div>
          <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={handleTogglePause}
              className={`p-2 rounded-full ${isPaused ? 'bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20' : 'bg-amber-500/10 text-amber-500 hover:bg-amber-500/20'}`}
            >
              {isPaused ? <Play size={14} fill="currentColor" /> : <Pause size={14} fill="currentColor" />}
            </button>
            <button onClick={onMaximize} className="p-2 rounded-full bg-zinc-800 text-zinc-400 hover:bg-zinc-700">
              <Maximize2 size={14} />
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (isPreparing) {
      return (
        <div className="fixed inset-0 z-[9999] bg-zinc-950 flex flex-col items-center justify-center">
            <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, rgba(255,255,255,0.1) 1px, transparent 0)', backgroundSize: '40px 40px' }}></div>
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

  return (
    <div className="fixed inset-0 z-[9999] bg-zinc-950 flex flex-col items-center justify-center animate-fade-in">
        <AnimatePresence>
            <ConfirmationModal isOpen={isCancelModalOpen} onConfirm={() => { onCancel(); clearInterval(intervalRef.current); }} onCancel={() => setIsCancelModalOpen(false)} />
        </AnimatePresence>

        {!audioPermission && !isPaused && !isPreparing && (
           <motion.div
             initial={{ opacity: 0, y: -20 }}
             animate={{ opacity: 1, y: 0 }}
             className="absolute top-20 z-50"
           >
              <button
                onClick={activateFocusMode}
                className="bg-amber-500/10 border border-amber-500/50 text-amber-500 px-6 py-3 rounded-xl font-bold flex items-center gap-3 backdrop-blur-md hover:bg-amber-500/20 transition-all shadow-lg animate-pulse"
              >
                <Volume2 size={20} />
                <span>Ativar Modo Segundo Plano</span>
              </button>
           </motion.div>
        )}

        <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, rgba(255,255,255,0.1) 1px, transparent 0)', backgroundSize: '40px 40px' }}></div>
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-emerald-500 to-transparent opacity-30"></div>

        <div className="absolute top-6 right-6 flex gap-4 z-20">
            <button
                onClick={onMinimize}
                className="flex items-center gap-2 text-zinc-400 hover:text-white transition-colors px-4 py-2 rounded-lg hover:bg-zinc-900/50 border border-transparent hover:border-zinc-800"
            >
                <Minimize2 size={20} />
                <span className="text-sm font-medium hidden md:inline">Minimizar</span>
            </button>
        </div>

        <div className="relative z-10 flex flex-col items-center text-center w-full max-w-4xl px-6">
            <div className={`mb-8 px-4 py-1.5 rounded-full border text-sm font-bold tracking-[0.2em] uppercase flex items-center gap-2 ${isPaused ? 'border-amber-500/30 text-amber-500 bg-amber-500/5' : 'border-emerald-500/30 text-emerald-500 bg-emerald-500/5'}`}>
                <span className={`w-2 h-2 rounded-full ${isPaused ? 'bg-amber-500' : 'bg-emerald-500 animate-pulse'}`}></span>
                {isPaused ? 'Sessão Pausada' : 'Foco Absoluto'}
            </div>

            <h2 className="text-2xl md:text-4xl font-bold text-zinc-300 mb-2 tracking-tight">{disciplina.nome}</h2>

            {/* Exibe o Assunto em Destaque */}
            {assunto ? (
                <div className="flex items-center gap-2 text-emerald-500 bg-emerald-500/10 px-4 py-1.5 rounded-full mb-8 border border-emerald-500/20">
                    <Target size={16} />
                    <span className="text-sm md:text-base font-bold uppercase tracking-wide">{assunto}</span>
                </div>
            ) : (
                <p className="text-zinc-500 text-sm uppercase tracking-widest mb-10">Cronômetro de Estudo</p>
            )}

            <div className="relative mb-16">
                <div className={`absolute -inset-10 blur-[60px] opacity-20 rounded-full transition-colors duration-700 ${isPaused ? 'bg-amber-500' : 'bg-emerald-500'}`}></div>
                <div className={`text-[5rem] md:text-[8rem] lg:text-[10rem] font-mono font-bold leading-none tracking-tighter tabular-nums transition-colors duration-300 ${isPaused ? 'text-zinc-500' : 'text-white'}`} style={{ textShadow: isPaused ? 'none' : '0 0 30px rgba(16,185,129,0.3)' }}>
                    {formatTime(seconds)}
                </div>
            </div>

            <div className="flex items-center gap-6 md:gap-10">
                <button onClick={handleRequestCancel} className="group flex flex-col items-center gap-2 text-zinc-500 hover:text-red-500 transition-colors">
                    <div className="w-14 h-14 md:w-16 md:h-16 rounded-full border-2 border-zinc-800 group-hover:border-red-500/50 flex items-center justify-center bg-zinc-900 transition-all">
                        <X size={24} />
                    </div>
                    <span className="text-xs font-bold uppercase tracking-wider text-center pt-1">CANCELAR<br/></span>
                </button>

                <button onClick={handleTogglePause} className={`w-24 h-24 md:w-32 md:h-32 rounded-full flex flex-col items-center justify-center shadow-2xl transition-all transform hover:scale-105 active:scale-95 ${isPaused ? 'bg-emerald-500 hover:bg-emerald-400 text-zinc-950' : 'bg-amber-500 hover:bg-amber-400 text-zinc-950'}`}>
                    {isPaused ? <Play size={40} fill="currentColor" className="ml-2" /> : <Pause size={40} fill="currentColor" />}
                    <span className="mt-1 text-sm font-bold uppercase">{isPaused ? 'INICIAR' : ''}</span>
                </button>

                <button onClick={handleStop} className="group flex flex-col items-center gap-2 text-zinc-500 hover:text-emerald-500 transition-colors">
                    <div className="w-14 h-14 md:w-16 md:h-16 rounded-full border-2 border-zinc-800 group-hover:border-emerald-500/50 flex items-center justify-center bg-zinc-900 transition-all">
                        <Square size={24} fill="currentColor" />
                    </div>
                    <span className="text-xs font-bold uppercase tracking-wider text-center pt-1">Registrar<br/></span>
                </button>
            </div>
        </div>
    </div>
  );
}

export default StudyTimer;