import React, { useMemo, useState, useEffect, useRef } from 'react';
import { Trophy, ChevronDown, Activity, Flame, Medal, Share2, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// --- UTILITÁRIOS E CONSTANTES ---

const dateToYMD = (date) => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
};

const formatHoursToHHMM = (hoursDecimal) => {
    if (hoursDecimal <= 0) return { hours: 0, minutes: 0, display: '0h 0m' };
    const totalMinutes = Math.round(hoursDecimal * 60);
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    let display = '';
    if (hours > 0) display += `${hours}h`;
    if (minutes > 0 || hours > 0) {
        if (hours > 0 && minutes > 0) display += ' ';
        if (hours === 0 && minutes === 0) display = '0h';
        else if (minutes > 0) display += `${minutes}m`;
    }
    if (hours === 0 && minutes === 0) return { hours: 0, minutes: 0, display: '0h' };
    return { hours, minutes, display };
};

// --- COMPONENTE: PROGRESS RING MAIOR (DETALHES) ---
const DetailedProgressRing = ({ percent, colorClass, value, unit, trackColor }) => {
    const r = 50;
    const c = 2 * Math.PI * r;
    const offset = c - (percent / 100) * c;
    const isDone = percent >= 100;

    return (
        <div className="relative flex flex-col items-center justify-center w-full max-w-[120px] h-[120px] mx-auto group">
            {/* Efeito de brilho atrás do anel */}
            <div className={`absolute inset-0 rounded-full blur-xl opacity-0 group-hover:opacity-20 transition-opacity duration-500 ${colorClass.replace('text-', 'bg-')}`}></div>

            <svg viewBox="0 0 106 106" className="w-full h-full transform -rotate-90 relative z-10">
                <circle cx="53" cy="53" r={r} stroke="currentColor" strokeWidth="8" fill="transparent" className={`${trackColor} opacity-30`} />
                <motion.circle
                    initial={{ strokeDashoffset: c }}
                    animate={{ strokeDashoffset: offset }}
                    transition={{ duration: 1.5, ease: "easeOut" }}
                    cx="53" cy="53" r={r} stroke="currentColor" strokeWidth="8" fill="transparent"
                    strokeDasharray={c} strokeLinecap="round"
                    className={`transition-colors duration-500 ${isDone ? 'text-emerald-500' : colorClass} drop-shadow-md`}
                />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center z-10">
                <span className={`text-2xl font-black leading-none ${isDone ? 'text-emerald-600 dark:text-emerald-400' : 'text-zinc-800 dark:text-white'}`}>
                    {value}
                </span>
                <span className={`text-[10px] font-bold uppercase mt-1 ${isDone ? 'text-emerald-600/70 dark:text-emerald-400/70' : 'text-zinc-500 dark:text-zinc-400'}`}>
                    {unit}
                </span>
            </div>
        </div>
    );
};

// --- COMPONENTE PRINCIPAL ---
function HeaderProgress({ registrosEstudo, goalsHistory, activeCicloId, onTriggerGuide, onShareGoal }) {
    const [isExpanded, setIsExpanded] = useState(false);
    const [showCelebration, setShowCelebration] = useState(false);
    const wasCompleteRef = useRef(false);
    const [mounted, setMounted] = useState(false);

    useEffect(() => { setMounted(true); }, []);

    const stats = useMemo(() => {
        const activeGoal = goalsHistory && goalsHistory.length > 0
            ? [...goalsHistory].sort((a, b) => new Date(b.startDate) - new Date(a.startDate))[0]
            : { questions: 0, hours: 0 };

        const goalH = parseFloat(activeGoal.hours || 0);
        const goalQ = parseInt(activeGoal.questions || 0);
        const todayStr = dateToYMD(new Date());
        let todayH = 0;
        let todayQ = 0;

        registrosEstudo.forEach(reg => {
            const isToday = reg.data === todayStr;
            const isCurrentCycle = activeCicloId ? reg.cicloId === activeCicloId : true;
            if (isToday && isCurrentCycle) {
                todayH += (Number(reg.tempoEstudadoMinutos) || Number(reg.duracaoMinutos) || 0) / 60;
                todayQ += (Number(reg.questoesFeitas) || 0);
            }
        });

        const percH = goalH > 0 ? Math.min((todayH / goalH) * 100, 100) : 0;
        const percQ = goalQ > 0 ? Math.min((todayQ / goalQ) * 100, 100) : 0;
        const isCompleteH = goalH === 0 || percH >= 100;
        const isCompleteQ = goalQ === 0 || percQ >= 100;
        const isComplete = isCompleteH && isCompleteQ && (goalH > 0 || goalQ > 0);
        const isPartialComplete = (isCompleteH || isCompleteQ) && !isComplete && (goalH > 0 || goalQ > 0);
        const hasActivity = todayH > 0 || todayQ > 0;
        const overallProgress = (goalH > 0 || goalQ > 0) ? ((percH + percQ) / 2) : 0;
        const todayH_HHMM = formatHoursToHHMM(todayH);
        const remainingH = Math.max(0, goalH - todayH);
        const remainingH_HHMM = formatHoursToHHMM(remainingH);

        let state = 'idle';
        if (isComplete) state = 'complete';
        else if (isPartialComplete) state = 'partial';
        else if (overallProgress >= 80) state = 'close';
        else if (hasActivity) state = 'working';

        return {
            todayH, todayQ, goalH, goalQ, percH, percQ,
            isComplete, isPartialComplete, hasActivity, overallProgress, state,
            todayH_HHMM, remainingH_HHMM, isCompleteH, isCompleteQ
        };
    }, [registrosEstudo, goalsHistory, activeCicloId]);

    useEffect(() => {
        if (mounted) {
            if (stats.isComplete && !wasCompleteRef.current) {
                setShowCelebration(true);
                const timer = setTimeout(() => setShowCelebration(false), 4000);
                return () => clearTimeout(timer);
            }
            wasCompleteRef.current = stats.isComplete;
        } else {
            if (stats.isComplete) wasCompleteRef.current = true;
        }
    }, [stats.isComplete, mounted]);

    // --- CONFIGURAÇÃO VISUAL VIBRANTE (LIGHT & DARK MODE) ---
    const statusConfig = {
        idle: {
            icon: Activity,
            // Light: Cinza claro com borda suave | Dark: Zinco escuro
            containerClass: 'bg-white border-zinc-200 shadow-sm hover:border-zinc-300 dark:bg-zinc-900 dark:border-zinc-800',
            textClass: 'text-zinc-500 dark:text-zinc-400',
            barBg: 'bg-zinc-100 dark:bg-zinc-800',
            barFill: 'bg-zinc-400 dark:bg-zinc-600',
            label: 'Sem atividade',
            iconBg: 'bg-zinc-100 text-zinc-400 dark:bg-zinc-800 dark:text-zinc-500'
        },
        working: {
            icon: Activity,
            // Light: Fundo levemente azulado | Dark: Fundo escuro com brilho azul
            containerClass: 'bg-blue-50/50 border-blue-200 shadow-blue-100 dark:bg-blue-900/10 dark:border-blue-800 dark:shadow-none hover:shadow-md hover:shadow-blue-100/50 transition-shadow',
            textClass: 'text-blue-700 dark:text-blue-400',
            barBg: 'bg-blue-100 dark:bg-blue-900/30',
            barFill: 'bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.5)]', // Neon effect
            label: 'Em Foco',
            iconBg: 'bg-blue-100 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400'
        },
        partial: {
            icon: Medal,
            containerClass: 'bg-amber-50/50 border-amber-200 shadow-amber-100 dark:bg-amber-900/10 dark:border-amber-800 dark:shadow-none hover:shadow-md hover:shadow-amber-100/50',
            textClass: 'text-amber-700 dark:text-amber-400',
            barBg: 'bg-amber-100 dark:bg-amber-900/30',
            barFill: 'bg-gradient-to-r from-amber-400 to-orange-500 shadow-[0_0_10px_rgba(245,158,11,0.5)]',
            label: 'Parcial!',
            iconBg: 'bg-amber-100 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400'
        },
        close: {
            icon: Flame,
            containerClass: 'bg-orange-50/50 border-orange-200 shadow-orange-100 dark:bg-orange-900/10 dark:border-orange-800 dark:shadow-none hover:shadow-md hover:shadow-orange-100/50 animate-pulse-slow',
            textClass: 'text-orange-700 dark:text-orange-400',
            barBg: 'bg-orange-100 dark:bg-orange-900/30',
            barFill: 'bg-gradient-to-r from-orange-500 to-red-600 shadow-[0_0_10px_rgba(234,88,12,0.5)]',
            label: 'Quase lá!',
            iconBg: 'bg-orange-100 text-orange-600 dark:bg-orange-500/20 dark:text-orange-400'
        },
        complete: {
            icon: Trophy,
            containerClass: 'bg-emerald-50/80 border-emerald-200 shadow-emerald-100 dark:bg-emerald-900/20 dark:border-emerald-800 dark:shadow-none hover:shadow-lg hover:shadow-emerald-100/50',
            textClass: 'text-emerald-700 dark:text-emerald-400',
            barBg: 'bg-emerald-100 dark:bg-emerald-900/30',
            barFill: 'bg-gradient-to-r from-emerald-400 to-green-600 shadow-[0_0_15px_rgba(16,185,129,0.6)]',
            label: 'Concluído',
            iconBg: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400'
        }
    };

    const currentConfig = statusConfig[stats.state];
    const StatusIcon = currentConfig.icon;

    if (!mounted) return null;

    return (
        <div
            id="header-progress-root"
            className="relative z-30"
            onMouseEnter={() => setIsExpanded(true)}
            onMouseLeave={() => setIsExpanded(false)}
        >
            {/* --- BARRA PRINCIPAL (CAPSULA) --- */}
            <motion.div
                id="header-progress-bar"
                initial={{ scale: 1 }}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className={`
                    flex items-center gap-3 px-1.5 py-1.5 sm:px-3 sm:py-2
                    border rounded-2xl cursor-pointer
                    backdrop-blur-xl transition-all duration-300
                    ${currentConfig.containerClass}
                `}
            >
                {/* 1. Ícone com Fundo Colorido */}
                <div className={`
                    flex items-center justify-center w-8 h-8 sm:w-10 sm:h-10 rounded-xl shrink-0
                    ${currentConfig.iconBg} transition-colors duration-300
                `}>
                    <StatusIcon size={18} className="sm:w-5 sm:h-5" strokeWidth={2.5} />
                </div>

                {/* 2. Área Central (Texto e Barra) */}
                <div className="flex flex-col justify-center flex-1 min-w-[90px] sm:min-w-[140px]">
                    <div className="flex justify-between items-baseline mb-1">
                        <span className={`text-[10px] sm:text-xs font-bold uppercase tracking-wider ${currentConfig.textClass}`}>
                            {currentConfig.label}
                        </span>
                        <span className={`text-xs sm:text-sm font-black ${currentConfig.textClass}`}>
                            {stats.overallProgress.toFixed(0)}%
                        </span>
                    </div>

                    <div className={`h-1.5 sm:h-2 w-full rounded-full overflow-hidden relative ${currentConfig.barBg}`}>
                        <motion.div
                            className={`h-full rounded-full absolute top-0 left-0 ${currentConfig.barFill}`}
                            initial={{ width: 0 }}
                            animate={{ width: `${stats.overallProgress}%` }}
                            transition={{ duration: 1 }}
                        />
                    </div>
                </div>

                {/* 3. Indicador de Expansão */}
                <div className="hidden sm:flex items-center pl-2 border-l border-zinc-200 dark:border-zinc-700/50">
                    <ChevronDown
                        size={16}
                        className={`text-zinc-400 dark:text-zinc-500 transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`}
                    />
                </div>
            </motion.div>

            {/* --- DROPDOWN EXPANDIDO (PAINEL DE DETALHES) --- */}
            <AnimatePresence>
                {isExpanded && (
                    <motion.div
                        id="header-progress-expanded"
                        initial={{ opacity: 0, y: 15, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 15, scale: 0.95 }}
                        className="absolute top-full right-0 mt-4 w-[calc(100vw-32px)] max-w-sm sm:w-[400px]
                                   bg-white/90 dark:bg-zinc-900/95 backdrop-blur-2xl
                                   border border-zinc-200 dark:border-zinc-700 rounded-3xl shadow-2xl
                                   z-50 overflow-hidden ring-4 ring-black/5 dark:ring-white/5"
                    >
                        {/* Header do Dropdown */}
                        <div className="px-6 py-4 border-b border-zinc-100 dark:border-zinc-800 flex justify-between items-center bg-zinc-50/50 dark:bg-zinc-800/20">
                            <h3 className="text-sm font-bold text-zinc-700 dark:text-zinc-200 uppercase tracking-wide flex items-center gap-2">
                                <Sparkles size={14} className="text-amber-500" />
                                Desempenho Hoje
                            </h3>
                            {stats.hasActivity && (
                                <button
                                    onClick={(e) => { e.stopPropagation(); onShareGoal(stats); }}
                                    className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5"
                                >
                                    <Share2 size={14} /> Compartilhar
                                </button>
                            )}
                        </div>

                        {showCelebration ? (
                            <div className="flex flex-col items-center justify-center py-10 px-6">
                                <Trophy size={80} className="text-yellow-400 drop-shadow-lg animate-bounce mb-4" />
                                <h3 className="text-2xl font-black text-zinc-800 dark:text-white text-center leading-tight">META BATIDA!</h3>
                                <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400 mt-2 text-center">
                                    Você é imparável. Continue assim!
                                </p>
                            </div>
                        ) : (
                            <div className="p-6 space-y-6">
                                {/* Grid de Anéis */}
                                <div className="grid grid-cols-2 gap-4">
                                    {/* Card Horas */}
                                    <div className="flex flex-col items-center p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-100 dark:border-zinc-700/50 transition-colors hover:bg-white dark:hover:bg-zinc-800 hover:border-amber-200 dark:hover:border-amber-800/50 group">
                                        <span className="text-xs font-bold text-zinc-400 uppercase mb-3 flex items-center gap-1">
                                            Tempo
                                        </span>
                                        <DetailedProgressRing
                                            percent={stats.percH}
                                            colorClass={'text-amber-500'}
                                            trackColor={'text-zinc-200 dark:text-zinc-700'}
                                            value={stats.todayH_HHMM.display}
                                            unit={`Meta: ${stats.goalH}h`}
                                        />
                                    </div>

                                    {/* Card Questões */}
                                    <div className="flex flex-col items-center p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-100 dark:border-zinc-700/50 transition-colors hover:bg-white dark:hover:bg-zinc-800 hover:border-emerald-200 dark:hover:border-emerald-800/50 group">
                                        <span className="text-xs font-bold text-zinc-400 uppercase mb-3 flex items-center gap-1">
                                            Questões
                                        </span>
                                        <DetailedProgressRing
                                            percent={stats.percQ}
                                            colorClass={'text-emerald-500'}
                                            trackColor={'text-zinc-200 dark:text-zinc-700'}
                                            value={stats.todayQ}
                                            unit={`Meta: ${stats.goalQ}`}
                                        />
                                    </div>
                                </div>

                                {/* Footer com Dica/Status */}
                                {!stats.isComplete && (
                                    <div className={`
                                        p-3 rounded-xl text-xs font-medium text-center border
                                        ${stats.state === 'close'
                                            ? 'bg-red-50 text-red-600 border-red-100 dark:bg-red-900/20 dark:text-red-300 dark:border-red-900/50'
                                            : 'bg-blue-50 text-blue-600 border-blue-100 dark:bg-blue-900/20 dark:text-blue-300 dark:border-blue-900/50'}
                                    `}>
                                        {stats.state === 'close' && "🔥 Incrível! Falta muito pouco para finalizar."}
                                        {stats.state === 'partial' && "🥇 Metade do caminho já foi. Foque no restante!"}
                                        {(stats.state === 'working' || stats.state === 'idle') && (
                                            <span>
                                                Faltam <strong>{stats.remainingH_HHMM.display}</strong> de estudo e <strong>{Math.max(0, stats.goalQ - stats.todayQ)}</strong> questões.
                                            </span>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

export default HeaderProgress;