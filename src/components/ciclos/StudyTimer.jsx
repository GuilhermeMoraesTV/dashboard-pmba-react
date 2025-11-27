import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Play, Pause, Square, Minimize2, X, AlertTriangle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// --- Função de Formatação (Mantida) ---
const formatTime = (totalSeconds) => {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  // Retorna no formato HH:MM:SS
  return [hours, minutes, seconds].map(v => String(v).padStart(2, '0')).join(':');
};

// --- Subcomponente do Modal de Confirmação (Mantido) ---
const ConfirmationModal = ({ isOpen, onConfirm, onCancel }) => {
    // Usamos AnimatePresence fora do retorno, mas o retorno deve ser envolvido por ela no componente pai.
    // Aqui, apenas garantimos que a lógica de renderização condicional está dentro do componente.
    if (!isOpen) return null;

    // Variante para a animação do modal
    const modalVariants = {
        hidden: { opacity: 0, scale: 0.95 },
        visible: { opacity: 1, scale: 1, transition: { duration: 0.15 } },
        exit: { opacity: 0, scale: 0.95, transition: { duration: 0.1 } },
    };

    return (
        <motion.div
            className="fixed inset-0 z-[10000] bg-zinc-950/70 backdrop-blur-sm flex items-center justify-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.1 }}
        >
            <motion.div
                className="bg-zinc-900 border border-red-500/30 shadow-2xl rounded-xl p-6 w-full max-w-sm"
                variants={modalVariants}
                initial="hidden"
                animate="visible"
                exit="exit"
            >
                <div className="flex items-start gap-4">
                    <AlertTriangle className="text-red-500 mt-0.5 shrink-0" size={24} />
                    <div>
                        <h3 className="text-lg font-bold text-white mb-1">
                            Cancelar Sessão?
                        </h3>
                        <p className="text-sm text-zinc-400">
                            Se você cancelar, **o tempo de estudo não será salvo**. Deseja prosseguir com o cancelamento?
                        </p>
                    </div>
                </div>

                <div className="mt-6 flex justify-end gap-3">
                    <button
                        onClick={onCancel}
                        className="px-4 py-2 text-sm font-semibold text-zinc-300 bg-zinc-800 rounded-lg hover:bg-zinc-700 transition-colors border border-zinc-700"
                    >
                        Manter Estudo
                    </button>
                    <button
                        onClick={onConfirm}
                        className="px-4 py-2 text-sm font-bold text-white bg-red-600 rounded-lg hover:bg-red-500 transition-colors"
                    >
                        Sim, Cancelar
                    </button>
                </div>
            </motion.div>
        </motion.div>
    );
}

// --- Componente Principal ---
function StudyTimer({ disciplina, onStop, onCancel, isMinimized, onMaximize, onMinimize }) {
  // --- Estados do Timer ---
  const [isPreparing, setIsPreparing] = useState(true);
  const [countdown, setCountdown] = useState(3);

  const [seconds, setSeconds] = useState(0);
  const [isPaused, setIsPaused] = useState(false);

  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);

  const startTimeRef = useRef(null);
  const pausedTimeRef = useRef(0);

  const intervalRef = useRef(null);
  const titleIntervalRef = useRef(null);
  const originalTitleRef = useRef(document.title);

  // Função para calcular o tempo decorrido
  const calculateElapsedSeconds = useCallback(() => {
    if (startTimeRef.current === null) return pausedTimeRef.current;
    const elapsed = Math.floor((Date.now() - startTimeRef.current) / 1000) + pausedTimeRef.current;
    return elapsed;
  }, []);

  // --- Funções de Controle do Título da Página (Mantidas) ---

  const startTitleTimer = useCallback((currentSeconds) => {
    clearInterval(titleIntervalRef.current);
    let currentTitleSeconds = currentSeconds;
    document.title = `${formatTime(currentTitleSeconds)} - ${disciplina.nome}`;

    titleIntervalRef.current = setInterval(() => {
      currentTitleSeconds++;
      document.title = `${formatTime(currentTitleSeconds)} - ${disciplina.nome}`;
    }, 1000);
  }, [disciplina.nome]);


  const stopTitleTimer = useCallback(() => {
    clearInterval(titleIntervalRef.current);
    document.title = originalTitleRef.current;
  }, []);

  // --- Efeito de Contagem Regressiva Inicial (Mantido) ---
  useEffect(() => {
    if (isPreparing) {
      if (countdown > 0) {
        const timer = setTimeout(() => setCountdown(c => c - 1), 1000);
        return () => clearTimeout(timer);
      } else {
        setIsPreparing(false);
        if (!startTimeRef.current) {
            startTimeRef.current = Date.now();
        }
      }
    }
  }, [isPreparing, countdown]);

  // --- Timer Principal: Atualiza o estado `seconds` - CORREÇÃO DE CONGELAMENTO ---
  const startMainTimer = useCallback(() => {
      if (isPreparing || isPaused) return;

      if (startTimeRef.current === null) {
          startTimeRef.current = Date.now();
      }

      // 1. Limpa qualquer intervalo anterior
      clearInterval(intervalRef.current);

      // 2. Define o novo intervalo
      intervalRef.current = setInterval(() => {
        setSeconds(calculateElapsedSeconds());
      }, 1000);
  }, [isPreparing, isPaused, calculateElapsedSeconds]);

  // Efeito para gerenciar o timer principal
  useEffect(() => {
      if (!isPreparing && !isPaused) {
          startMainTimer();
      } else {
          clearInterval(intervalRef.current);
      }

      return () => clearInterval(intervalRef.current);
  }, [isPaused, isPreparing, startMainTimer]);


  // --- Lógica de Pausa/Unpause (Mantida) ---
  const handleTogglePause = () => {
    setIsPaused(prev => {
      const isCurrentlyPaused = !prev;

      if (isCurrentlyPaused) {
        const currentSeconds = calculateElapsedSeconds();
        pausedTimeRef.current = currentSeconds;
        startTimeRef.current = null;
        setSeconds(currentSeconds);
        stopTitleTimer();
      } else {
        startTimeRef.current = Date.now();
      }

      return isCurrentlyPaused;
    });
  };

  // --- Manipuladores de Ação ---

  // Ação de Cancelar -> Abre o Modal
  const handleRequestCancel = () => {
      // **CORREÇÃO 1:** Não chame window.confirm aqui! Apenas abre o modal customizado.
      setIsCancelModalOpen(true);
  };

  // Ação de Cancelar -> Confirmado pelo Modal
  const handleConfirmCancel = () => {
      setIsCancelModalOpen(false);
      clearInterval(intervalRef.current);
      stopTitleTimer();
      onCancel();
  };

  const handleStop = () => {
    clearInterval(intervalRef.current);
    stopTitleTimer();
    const totalMinutos = Math.max(1, Math.round(calculateElapsedSeconds() / 60));
    onStop(totalMinutos);
  };

  // --- Efeito de Título da Página (visibilitychange) - CORREÇÃO DE CONGELAMENTO ---
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (isPreparing) return;

      if (document.hidden) {
        // PERDEU FOCO
        const currentSeconds = calculateElapsedSeconds();
        setSeconds(currentSeconds);

        if (!isPaused) {
            startTitleTimer(currentSeconds);
        } else {
            document.title = `|| ${formatTime(currentSeconds)} - ${disciplina.nome}`;
        }

      } else {
        // GANHOU FOCO (AQUI ESTÁ A CORREÇÃO DO CONGELAMENTO)
        stopTitleTimer();

        if (!isPaused) {
            const currentSeconds = calculateElapsedSeconds();
            setSeconds(currentSeconds);
            // CORREÇÃO: Chama a função para reiniciar o setInterval
            startMainTimer();
        }
      }
    };

    originalTitleRef.current = document.title;

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      stopTitleTimer();
    };
  }, [isPreparing, isPaused, disciplina.nome, calculateElapsedSeconds, startTitleTimer, stopTitleTimer, startMainTimer]);

  // --- MODO BOLHA (MINIMIZADO) ---
  if (isMinimized) {
    return (
      // ... (código do modo bolha mantido)
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
          <div className="flex flex-col mr-2">
            <span className="text-[10px] text-zinc-400 uppercase font-bold tracking-wider truncate max-w-[120px]">
              {disciplina.nome}
            </span>
            <span className="text-xl font-mono font-bold text-white leading-none">
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
            <button
              onClick={onMaximize}
              className="p-2 rounded-full bg-zinc-800 text-zinc-400 hover:bg-zinc-700"
            >
              <Minimize2 size={14} className="rotate-180" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  // --- TELA DE PREPARAÇÃO (3, 2, 1) ---
  if (isPreparing) {
      return (
        // ... (código da tela de preparação mantido)
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
        </div>
      );
  }

  // --- MODO FOCO (TIMER ATIVO) ---
  return (
    <div className="fixed inset-0 z-[9999] bg-zinc-950 flex flex-col items-center justify-center animate-fade-in">

        {/* Modal de Confirmação (Envolvido por AnimatePresence) */}
        <AnimatePresence>
            <ConfirmationModal
                isOpen={isCancelModalOpen}
                onConfirm={handleConfirmCancel}
                onCancel={() => setIsCancelModalOpen(false)}
            />
        </AnimatePresence>

        {/* Background Tático */}
        <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, rgba(255,255,255,0.1) 1px, transparent 0)', backgroundSize: '40px 40px' }}></div>
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-emerald-500 to-transparent opacity-30"></div>

        {/* Header do Timer */}
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
            {/* Badge de Status */}
            <div className={`
                mb-8 px-4 py-1.5 rounded-full border text-sm font-bold tracking-[0.2em] uppercase flex items-center gap-2
                ${isPaused
                    ? 'border-amber-500/30 text-amber-500 bg-amber-500/5'
                    : 'border-emerald-500/30 text-emerald-500 bg-emerald-500/5'}
            `}>
                <span className={`w-2 h-2 rounded-full ${isPaused ? 'bg-amber-500' : 'bg-emerald-500 animate-pulse'}`}></span>
                {isPaused ? 'Sessão Pausada' : 'Foco Absoluto'}
            </div>

            {/* Nome da Disciplina */}
            <h2 className="text-2xl md:text-4xl font-bold text-zinc-300 mb-2 tracking-tight">
              {disciplina.nome}
            </h2>
            <p className="text-zinc-500 text-sm uppercase tracking-widest mb-10">Cronômetro de Estudo</p>

            {/* O Relógio Gigante */}
            <div className="relative mb-16">
                {/* Glow de fundo */}
                <div className={`absolute -inset-10 blur-[60px] opacity-20 rounded-full transition-colors duration-700 ${isPaused ? 'bg-amber-500' : 'bg-emerald-500'}`}></div>

                <div className={`
                    text-[5rem] md:text-[8rem] lg:text-[10rem] font-mono font-bold leading-none tracking-tighter tabular-nums transition-colors duration-300
                    ${isPaused ? 'text-zinc-500' : 'text-white'}
                `} style={{ textShadow: isPaused ? 'none' : '0 0 30px rgba(16,185,129,0.3)' }}>
                    {formatTime(seconds)}
                </div>
            </div>

            {/* Controles Principais */}
            <div className="flex items-center gap-6 md:gap-10">
                <button
                    onClick={handleRequestCancel}
                    className="group flex flex-col items-center gap-2 text-zinc-500 hover:text-red-500 transition-colors"
                >
                    <div className="w-14 h-14 md:w-16 md:h-16 rounded-full border-2 border-zinc-800 group-hover:border-red-500/50 flex items-center justify-center bg-zinc-900 transition-all">
                        <X size={24} />
                    </div>
                    <span className="text-xs font-bold uppercase tracking-wider text-center pt-1">
                        CANCELAR<br/>
                    </span>
                </button>

                <button
                    onClick={handleTogglePause}
                    className={`
                        w-24 h-24 md:w-32 md:h-32 rounded-full flex flex-col items-center justify-center shadow-2xl transition-all transform hover:scale-105 active:scale-95
                        ${isPaused
                            ? 'bg-emerald-500 hover:bg-emerald-400 text-zinc-950'
                            : 'bg-amber-500 hover:bg-amber-400 text-zinc-950'}
                    `}
                >
                    {isPaused
                        ? <Play size={40} fill="currentColor" className="ml-2" />
                        : <Pause size={40} fill="currentColor" />
                    }
                    <span className="mt-1 text-sm font-bold uppercase">
                      {isPaused ? 'INICIAR' : ''}
                    </span>
                </button>

                <button
                    onClick={handleStop}
                    className="group flex flex-col items-center gap-2 text-zinc-500 hover:text-emerald-500 transition-colors"
                >
                    <div className="w-14 h-14 md:w-16 md:h-16 rounded-full border-2 border-zinc-800 group-hover:border-emerald-500/50 flex items-center justify-center bg-zinc-900 transition-all">
                        <Square size={24} fill="currentColor" />
                    </div>
                    <span className="text-xs font-bold uppercase tracking-wider text-center pt-1">
                        Registrar Estudo<br/>
                    </span>
                </button>
            </div>
        </div>
    </div>
  );
}

export default StudyTimer;