import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Play, Pause, Zap } from 'lucide-react';

const MiniWidgetTimer = ({
    isPaused,
    themeColor,
    assunto,
    variant,
    isResting,
    disciplina,
    seconds,
    isPreparing = false,
    countdown = 0,
    formatClock,
    onTogglePause,
    onMaximize
}) => {
    const activeColor = isPaused ? '#fbbf24' : themeColor;
    const displaySeconds = isPreparing ? Math.max(1, Number(countdown) || 1) : seconds;

    return (
        <motion.div
            initial={{ opacity: 0, x: 50, scale: 0.9 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="fixed bottom-[calc(5.75rem+env(safe-area-inset-bottom,0px))] right-4 z-[100040] sm:bottom-[calc(6.5rem+env(safe-area-inset-bottom,0px))] sm:right-6"
        >
            <div
                className="relative overflow-hidden group bg-white/90 dark:bg-zinc-900/95 backdrop-blur-xl border border-zinc-200/50 dark:border-white/10 shadow-xl rounded-xl p-2.5 flex items-center gap-3 w-auto max-w-[280px] cursor-pointer transition-all duration-300"
                onClick={onMaximize}
            >
                {/* Glow de fundo reduzido */}
                <div
                    className="absolute -inset-4 opacity-5 blur-xl pointer-events-none group-hover:opacity-10 transition-opacity"
                    style={{ backgroundColor: activeColor }}
                />

                {/* Indicador Visual (SVG Ajustado para não cortar) */}
                <div className="relative flex items-center justify-center w-10 h-10 shrink-0">
                    <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 40 40">
                        <circle
                            cx="20" cy="20" r="18"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2.5"
                            className="text-zinc-100 dark:text-white/5"
                        />
                        {!isPaused && (
                            <motion.circle
                                cx="20" cy="20" r="18"
                                fill="none"
                                stroke={activeColor}
                                strokeWidth="2.5"
                                strokeLinecap="round"
                                strokeDasharray="113.1" // Perímetro aproximado (2 * PI * 18)
                                initial={{ strokeDashoffset: 113.1 }}
                                animate={{ strokeDashoffset: 0 }}
                                transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
                            />
                        )}
                    </svg>

                    <div
                        className="relative z-10 flex items-center justify-center w-7 h-7 rounded-full transition-colors duration-500"
                        style={{ backgroundColor: `${activeColor}15` }}
                    >
                        {!isPaused ? (
                            <Zap size={12} className="fill-current" style={{ color: activeColor }} />
                        ) : (
                            <div className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                        )}
                    </div>
                </div>

                {/* Textos e Tempo */}
                <div className="flex flex-col min-w-0 flex-1">
                    <span className="text-[8px] text-zinc-500 dark:text-zinc-400 uppercase font-black tracking-wider truncate mb-0.5">
                        {isPreparing ? 'Preparando' : (assunto ? assunto : (variant !== 'simulado' && isResting ? 'Descanso' : (disciplina?.nome || 'Estudo')))}
                    </span>
                    <span className="text-lg font-mono font-black text-zinc-900 dark:text-white leading-none">
                        {formatClock(displaySeconds)}
                    </span>
                </div>

                {/* Botão de Controle Compacto */}
                <div className="flex items-center pl-1" onClick={(e) => e.stopPropagation()}>
                    <button
                        onClick={onTogglePause}
                        className={`p-2 rounded-lg transition-all duration-300 border ${
                            isPaused
                            ? 'bg-amber-500 border-amber-400 text-white'
                            : 'bg-zinc-900 dark:bg-white border-zinc-800 dark:border-zinc-100 text-white dark:text-zinc-900'
                        } hover:scale-110 active:scale-95 shadow-md`}
                    >
                        {isPaused ? <Play size={12} fill="currentColor" /> : <Pause size={12} fill="currentColor" />}
                    </button>
                </div>

                {/* Detalhe Lateral */}
                <div
                    className="absolute left-0 top-2 bottom-2 w-0.5 rounded-r-full transition-colors duration-500"
                    style={{ backgroundColor: activeColor }}
                />
            </div>
        </motion.div>
    );
};

export default MiniWidgetTimer;
