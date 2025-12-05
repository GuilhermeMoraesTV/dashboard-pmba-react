import React, { useMemo, useState, useEffect, useRef } from 'react';
import { Trophy, ChevronDown, Activity, Flame, Medal } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// --- UTILITÁRIOS E CONSTANTES ---

const dateToYMD = (date) => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
};

// Converte horas decimais para HH:MM
const formatHoursToHHMM = (hoursDecimal) => {
    if (hoursDecimal <= 0) return { hours: 0, minutes: 0, display: '0h 0m' };

    const totalMinutes = Math.round(hoursDecimal * 60);
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;

    let display = '';
    if (hours > 0) {
        display += `${hours}h`;
    }
    // Adiciona minutos apenas se > 0 ou se as horas forem 0 (para evitar '0h')
    if (minutes > 0 || hours > 0) {
        if (hours > 0 && minutes > 0) display += ' ';
        if (hours === 0 && minutes === 0) display = '0h';
        else if (minutes > 0) display += `${minutes}m`;
    }
    if (hours === 0 && minutes === 0) return { hours: 0, minutes: 0, display: '0h' };

    return { hours, minutes, display };
};

// --- COMPONENTE: PROGRESS RING MAIOR (DETALHES) ---
const DetailedProgressRing = ({ percent, colorClass, value, unit }) => {
    const r = 50;
    const c = 2 * Math.PI * r;
    const offset = c - (percent / 100) * c;
    const isDone = percent >= 100;

    return (
        <div className="relative flex flex-col items-center justify-center w-full max-w-[120px] h-[120px] mx-auto">
            <svg viewBox="0 0 106 106" className="w-full h-full transform -rotate-90">
                <circle cx="53" cy="53" r={r} stroke="currentColor" strokeWidth="6" fill="transparent" className="text-zinc-800 dark:text-zinc-700 opacity-50" />
                <motion.circle
                    initial={{ strokeDashoffset: c }}
                    animate={{ strokeDashoffset: offset }}
                    transition={{ duration: 1.5, ease: "easeOut" }}
                    cx="53" cy="53" r={r} stroke="currentColor" strokeWidth="6" fill="transparent"
                    strokeDasharray={c} strokeLinecap="round"
                    className={`transition-colors duration-500 ${isDone ? 'text-emerald-500' : colorClass} ${percent > 0 ? 'drop-shadow-lg' : ''}`}
                />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                <span className={`text-2xl font-black leading-none ${isDone ? 'text-emerald-500' : 'text-white'}`}>
                    {value}
                </span>
                <span className={`text-[10px] font-bold uppercase ${isDone ? 'text-emerald-400' : 'text-zinc-400'}`}>
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
        // ... (Lógica de Stats inalterada)
        const activeGoal = goalsHistory && goalsHistory.length > 0
            ? [...goalsHistory].sort((a, b) => new Date(b.startDate) - new Date(a.startDate))[0]
            : { questions: 0, hours: 0 };

        const goalH = parseFloat(activeGoal.hours || 0);
        const goalQ = parseInt(activeGoal.questions || 0);

        const todayStr = dateToYMD(new Date());
        let todayH = 0; // Total de horas em decimal
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

        // Formato HH:MM para exibição
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

    // Efeito de Celebração
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

    // --- CONFIGURAÇÃO VISUAL NEO-BRUTALISTA/GLOW ---
    const statusConfig = {
        idle: {
            icon: Activity,
            colorClass: 'text-zinc-400',
            barClass: 'bg-zinc-600',
            glowColor: 'shadow-zinc-700/50',
            glowAnimation: 'shadow-zinc-700/50 hover:shadow-zinc-700/70',
            label: 'Sem atividade',
        },
        working: {
            icon: Activity, // Alterado de Clock para Activity
            colorClass: 'text-blue-500',
            barClass: 'bg-blue-500',
            glowColor: 'shadow-blue-500/50',
            glowAnimation: 'animate-pulse-slow shadow-blue-500/50 hover:shadow-blue-500/70',
            label: 'Em Progresso',
        },
        partial: {
            icon: Medal,
            colorClass: 'text-amber-500',
            barClass: 'bg-gradient-to-r from-amber-400 to-orange-500',
            glowColor: 'shadow-amber-500/50',
            glowAnimation: 'animate-pulse-slow shadow-amber-500/50 hover:shadow-amber-500/70',
            label: 'Meta Parcial!',
        },
        close: {
            icon: Flame,
            colorClass: 'text-orange-500',
            barClass: 'bg-gradient-to-r from-orange-500 to-red-600',
            glowColor: 'shadow-red-600/50',
            glowAnimation: 'animate-pulse-slow shadow-red-600/50 hover:shadow-red-600/70',
            label: 'Reta Final!',
        },
        complete: {
            icon: Trophy,
            colorClass: 'text-emerald-500',
            barClass: 'bg-gradient-to-r from-emerald-400 to-green-600',
            glowColor: 'shadow-emerald-500/50',
            glowAnimation: 'shadow-emerald-500/50 hover:shadow-emerald-500/70',
            label: 'Meta Batida',
        }
    };

    const currentConfig = statusConfig[stats.state];
    const StatusIcon = currentConfig.icon;
    const { percH, percQ, todayH_HHMM, todayQ, goalH, goalQ, state, remainingH_HHMM, hasActivity, isCompleteH, isCompleteQ } = stats;

    // --- SUB-COMPONENTE: ÍCONE DE STATUS COMPACTO (LÓGICA DE COR CORRIGIDA) ---
    const StatusBadge = ({ Icon, percent, isQuestionIcon = false, isTimeIcon = false }) => {
        let iconColorClass = 'text-zinc-500'; // Padrão: Neutro (sem estudo)

        if (percent >= 100) {
            iconColorClass = 'text-emerald-500'; // Prioridade 1: Meta batida (VERDE)
        } else if (hasActivity) {
            // Prioridade 2: Em andamento (AZUL)
            iconColorClass = 'text-blue-500';

            // Exceção: Se for ícone de status principal, usa a cor do estado (Amber/Orange)
            if (!isQuestionIcon && !isTimeIcon) {
                iconColorClass = currentConfig.colorClass;
            }
        }

        // Se não há atividade e não está completo, mantém zinc-500.

        return (
            <div
                className={`
                    p-1 rounded-lg shrink-0
                    ${iconColorClass}
                    transition-all duration-300
                `}
            >
                <Icon size={16} className="w-4 h-4 sm:w-5 sm:h-5" strokeWidth={2.5} />
            </div>
        );
    };

    if (!mounted) return null;

    return (
        <div
            id="header-progress-root"
            className="relative z-30"
            onMouseEnter={() => setIsExpanded(true)}
            onMouseLeave={() => setIsExpanded(false)}
        >
            {/* --- BARRA COMPACTA (DESIGN DE CÁPSULA NEUROMÓRFICA) --- */}
            <motion.div
                id="header-progress-bar"
                className={`
                    flex items-center gap-1 px-2 py-2 sm:gap-2 sm:px-4 sm:py-2
                    bg-zinc-800/80 backdrop-blur-md
                    border border-white/5 rounded-xl cursor-pointer
                    transition-all duration-300 relative overflow-hidden
                    ${currentConfig.glowAnimation}
                `}
                style={{
                    boxShadow: `0 0 15px ${currentConfig.glowColor.split('shadow-')[1].replace('/', ' ')}, 0 0 1px ${currentConfig.glowColor.split('shadow-')[1].replace('/', ' ')}`
                }}
                initial={{ scale: 1 }}
                whileHover={{ scale: 1.01 }}
            >
                {/* 1. Status Principal */}
                <div className="relative flex items-center gap-1 pr-2 sm:gap-3 sm:pr-3 border-r border-white/10 shrink-0">
                    <StatusBadge Icon={StatusIcon} percent={stats.overallProgress} />
                    {stats.hasActivity && stats.state !== 'complete' && (
                        <div className="absolute top-0.5 right-1 w-2 h-2 rounded-full ${currentConfig.colorClass.replace('text-', 'bg-')} animate-ping-slow"></div>
                    )}
                </div>

                {/* 2. Progresso Central */}
                <div className="flex flex-col flex-1 min-w-[70px] sm:min-w-[160px]"> {/* Reduzido o min-w em mobile */}
                    <div className="flex justify-between items-center w-full">
                        {/* Texto de Status Oculto em Mobile */}
                        <span className="text-[10px] font-bold text-zinc-400 uppercase truncate hidden sm:block">
                            {currentConfig.label}
                        </span>
                        {/* Status principal em Mobile */}
                        <span className="text-[10px] font-bold text-zinc-400 uppercase truncate sm:hidden">
                            {stats.state === 'idle' ? 'Inativo' : currentConfig.label.split(' ')[0]}
                        </span>

                        <span className={`text-sm font-black leading-none ${currentConfig.colorClass} sm:text-xl`}>
                            {stats.overallProgress.toFixed(0)}%
                        </span>
                    </div>

                    <div className="h-1.5 w-full bg-zinc-700 rounded-full overflow-hidden relative mt-1">
                        <motion.div
                            className={`h-full rounded-full absolute top-0 left-0 ${currentConfig.barClass}`}
                            initial={{ width: 0 }}
                            animate={{ width: `${stats.overallProgress}%` }}
                            transition={{ duration: 1 }}
                        />
                    </div>
                </div>

                {/* 3. Status Icons Condensados (REMOVIDO) */}
                {/* 4. Ação */}
                <div className="flex items-center gap-0.5 pl-1 sm:pl-3 border-l border-white/10 shrink-0">
                    {/* Botão de Ajuda/Guia REMOVIDO */}
                    <ChevronDown size={14} className={`text-zinc-500 transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''} sm:w-4 sm:h-4`} />
                </div>
            </motion.div>

            {/* --- DROPDOWN DE DETALHES (DESIGN DE PAINEL FOSCO) --- */}
            <AnimatePresence>
                {isExpanded && (
                    <motion.div
                        id="header-progress-expanded"
                        initial={{ opacity: 0, y: 10, scale: 0.98 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 10, scale: 0.98 }}
                        className="absolute top-full right-0 mt-3 w-72 sm:w-[380px] p-5
                                     bg-zinc-800/80 backdrop-blur-md
                                     border border-white/5 rounded-2xl shadow-2xl
                                     ring-1 ring-white/5 z-40 text-white"
                    >
                        {showCelebration ? (
                            <div className="flex flex-col items-center justify-center py-8 bg-emerald-900/10 rounded-xl">
                                <Trophy size={64} className="text-yellow-400 drop-shadow-xl animate-bounce mb-4" />
                                <h3 className="text-xl sm:text-2xl font-black tracking-tight">META CUMPRIDA!</h3>
                                <p className="text-sm font-medium text-emerald-400 uppercase tracking-wide">Desempenho Excelente</p>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {/* Títulos e Status + BOTÃO DE COMPARTILHAR (REMOVIDO) */}
                                <div className='flex justify-between items-center border-b border-zinc-700 pb-3'>
                                    <h3 className='text-lg font-black'>Progresso Diário</h3>
                                    <div className="flex items-center gap-2">
                                        {/* Botão de Compartilhamento REMOVIDO */}
                                        <span className={`text-sm font-bold ${currentConfig.colorClass}`}>{currentConfig.label}</span>
                                    </div>
                                </div>

                                {/* Cards de Progresso em Círculo (Tempo e Questões) */}
                                <div className="grid grid-cols-2 gap-4">
                                    {/* Card Horas (Laranja/Âmbar) */}
                                    <div
                                        id="header-stats-hours"
                                        className="flex flex-col items-center p-3 bg-zinc-700/50 rounded-xl border border-white/10 shadow-lg shadow-zinc-900/50"
                                    >
                                        <span className="text-xs font-bold text-zinc-400 uppercase block mb-2">Tempo</span>
                                        <DetailedProgressRing
                                            percent={percH}
                                            colorClass={'text-amber-500'}
                                            value={todayH_HHMM.display}
                                            unit={`Meta: ${goalH}h`}
                                        />
                                    </div>

                                    {/* Card Questões (Verde/Esmeralda) */}
                                    <div
                                        id="header-stats-questions"
                                        className="flex flex-col items-center p-3 bg-zinc-700/50 rounded-xl border border-white/10 shadow-lg shadow-zinc-900/50"
                                    >
                                        <span className="text-xs font-bold text-zinc-400 uppercase block mb-2">Questões</span>
                                        <DetailedProgressRing
                                            percent={percQ}
                                            colorClass={'text-emerald-500'}
                                            value={todayQ}
                                            unit={`Meta: ${goalQ}`}
                                        />
                                    </div>
                                </div>

                                {/* Rodapé Informativo Estilizado */}
                                {!stats.isComplete && (
                                    <div className="mt-4">
                                        <div className={`
                                            text-center py-2 px-3 rounded-lg text-xs font-medium
                                            bg-zinc-700/70 border border-white/10
                                            ${stats.state === 'close' ? 'shadow-lg shadow-red-500/20 text-red-400' : ''}
                                            ${stats.state === 'partial' ? 'shadow-lg shadow-amber-500/20 text-amber-400' : ''}
                                            ${stats.state === 'working' || stats.state === 'idle' ? 'text-zinc-300' : ''}
                                        `}>
                                            {stats.state === 'close' && <span className="flex items-center justify-center gap-1"><Flame size={12} className="text-red-500" /> Falta pouco! Finalize a missão.</span>}
                                            {stats.state === 'partial' && <span className="flex items-center justify-center gap-1"><Medal size={12} className="text-amber-500" /> Ótimo! Uma meta já foi. Complete a outra.</span>}
                                            {(stats.state === 'working' || stats.state === 'idle') && <span>Restam <strong>{remainingH_HHMM.display}</strong> e <strong>{Math.max(0, goalQ - todayQ)}</strong> questões.</span>}
                                        </div>
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