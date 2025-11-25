import React, { useMemo, useState, useEffect, useRef } from 'react';
import { Clock, Target, Trophy, ChevronDown, CheckCircle2, Activity, Flame, Medal, AlertCircle, HelpCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const dateToYMD = (date) => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
};

function HeaderProgress({ registrosEstudo, goalsHistory, activeCicloId, onTriggerGuide }) {
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

        let state = 'idle';
        if (isComplete) state = 'complete';
        else if (isPartialComplete) state = 'partial';
        else if (overallProgress >= 80) state = 'close';
        else if (hasActivity) state = 'working';

        return { todayH, todayQ, goalH, goalQ, percH, percQ, isComplete, isPartialComplete, hasActivity, overallProgress, state };
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

    const statusConfig = {
        idle: {
            icon: Activity,
            colorClass: 'bg-zinc-100 dark:bg-zinc-800 text-zinc-400',
            barClass: 'bg-zinc-300 dark:bg-zinc-600',
            borderClass: 'hover:border-zinc-300 dark:hover:border-zinc-600',
            label: 'Sem atividade',
            animation: ''
        },
        working: {
            icon: Clock,
            colorClass: 'bg-blue-500 text-white shadow-lg shadow-blue-500/20',
            barClass: 'bg-blue-500',
            borderClass: 'border-blue-500/20 bg-blue-50/50 dark:bg-blue-900/10',
            label: 'Em Progresso',
            animation: ''
        },
        partial: {
            icon: Medal,
            colorClass: 'bg-amber-500 text-white shadow-lg shadow-amber-500/20',
            barClass: 'bg-gradient-to-r from-amber-400 to-amber-600',
            borderClass: 'border-amber-500/30 bg-amber-50/50 dark:bg-amber-900/10',
            label: 'Meta Parcial!',
            animation: 'animate-pulse'
        },
        close: {
            icon: Flame,
            colorClass: 'bg-orange-500 text-white shadow-lg shadow-orange-500/20 animate-bounce',
            barClass: 'bg-gradient-to-r from-orange-500 to-red-500',
            borderClass: 'border-orange-500/30 bg-orange-50/50 dark:bg-orange-900/10',
            label: 'Reta Final!',
            animation: ''
        },
        complete: {
            icon: Trophy,
            colorClass: 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20',
            barClass: 'bg-gradient-to-r from-emerald-400 to-emerald-600',
            borderClass: 'border-emerald-500/40 bg-emerald-50/50 dark:bg-emerald-900/10',
            label: 'Meta Batida',
            animation: ''
        }
    };

    const currentConfig = statusConfig[stats.state];
    const StatusIcon = currentConfig.icon;

    const ProgressRing = ({ percent, color, icon: Icon }) => {
        const r = 22;
        const c = 2 * Math.PI * r;
        const offset = c - (percent / 100) * c;
        const isDone = percent >= 100;

        return (
            <div className="relative flex items-center justify-center w-14 h-14">
                <svg className="w-full h-full transform -rotate-90">
                    <circle cx="28" cy="28" r={r} stroke="currentColor" strokeWidth="4" fill="transparent" className="text-zinc-100 dark:text-zinc-800" />
                    <motion.circle
                        initial={{ strokeDashoffset: c }}
                        animate={{ strokeDashoffset: offset }}
                        transition={{ duration: 1.5, ease: "easeOut" }}
                        cx="28" cy="28" r={r} stroke="currentColor" strokeWidth="4" fill="transparent"
                        strokeDasharray={c} strokeLinecap="round"
                        className={`transition-colors duration-500 ${isDone ? 'text-emerald-500' : color}`}
                    />
                </svg>
                <div className={`absolute inset-0 flex items-center justify-center ${isDone ? 'text-emerald-500' : 'text-zinc-500 dark:text-zinc-400'}`}>
                    {isDone ? <CheckCircle2 size={20} className="animate-bounce" /> : <Icon size={18} />}
                </div>
            </div>
        );
    };

    if (!mounted) return null;

    return (
        <div
            id="header-progress-root" /* ID ADICIONADO PARA O TOUR: Raiz do componente */
            className="relative z-30"
            onMouseEnter={() => setIsExpanded(true)}
            onMouseLeave={() => setIsExpanded(false)}
        >
            {/* --- BARRA COMPACTA (HEADER) --- */}
            <div
                id="header-progress-bar" /* ID ADICIONADO PARA O TOUR: Barra visível */
                className={`
                flex items-center gap-4 px-4 py-2 bg-white dark:bg-zinc-900
                border border-zinc-200 dark:border-zinc-800 rounded-xl cursor-pointer
                transition-all duration-300 shadow-sm hover:shadow-md relative overflow-hidden
                ${currentConfig.borderClass}
            `}>
                {/* Efeito de Brilho/Shimmer se tiver atividade */}
                {stats.hasActivity && (
                    <div className={`absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full ${stats.state === 'complete' ? 'animate-[shimmer_2s_infinite]' : 'animate-[shimmer_4s_infinite]'}`}></div>
                )}

                {/* Ícone de Status Reativo */}
                <div className={`p-2 rounded-lg flex items-center justify-center transition-all duration-300 ${currentConfig.colorClass} ${currentConfig.animation}`}>
                    <StatusIcon size={20} />
                </div>

                <div className="flex flex-col min-w-[150px]">
                    <div className="flex justify-between items-end mb-1 w-full">
                        <span className={`text-[10px] font-black uppercase tracking-widest ${stats.state === 'partial' ? 'text-amber-600 dark:text-amber-500' : 'text-zinc-400 dark:text-zinc-500'}`}>
                            {currentConfig.label}
                        </span>
                        <span className="text-sm font-black text-zinc-800 dark:text-white leading-none">
                            {stats.overallProgress.toFixed(0)}%
                        </span>
                    </div>

                    <div className="h-2 w-full bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden border border-zinc-100 dark:border-zinc-700 relative">
                        <motion.div
                            className={`h-full rounded-full absolute top-0 left-0 ${currentConfig.barClass}`}
                            initial={{ width: 0 }}
                            animate={{ width: `${stats.overallProgress}%` }}
                            transition={{ duration: 1 }}
                        />
                        {/* Indicador de Meta Parcial na Barra */}
                        {stats.isPartialComplete && (
                            <div className="absolute top-0 right-0 bottom-0 w-1/2 border-l-2 border-white/20 h-full"></div>
                        )}
                    </div>
                </div>

                <div className="flex items-center gap-2 border-l border-zinc-200 dark:border-zinc-700 pl-4 ml-2">
                    {/* Botão de Ajuda do Guia */}
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            if (onTriggerGuide) onTriggerGuide();
                        }}
                        className="text-zinc-300 hover:text-blue-500 transition-colors"
                        title="Ver guia do progresso"
                    >
                        <HelpCircle size={16} />
                    </button>
                    <ChevronDown size={16} className={`text-zinc-400 transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`} />
                </div>
            </div>

            {/* --- DROPDOWN DE DETALHES --- */}
            <AnimatePresence>
                {isExpanded && (
                    <motion.div
                        id="header-progress-expanded" /* ID ADICIONADO PARA O TOUR: Painel dropdown */
                        initial={{ opacity: 0, y: 10, scale: 0.98 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 10, scale: 0.98 }}
                        className="absolute top-full right-0 mt-3 w-[360px] bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-2xl overflow-hidden ring-1 ring-black/5 z-40"
                    >
                        {showCelebration ? (
                            <div className="flex flex-col items-center justify-center py-8 animate-fade-in bg-emerald-50/50 dark:bg-emerald-900/10">
                                <Trophy size={64} className="text-yellow-500 drop-shadow-xl animate-bounce mb-4" />
                                <h3 className="text-2xl font-black text-zinc-800 dark:text-white tracking-tight">META CUMPRIDA!</h3>
                                <p className="text-sm font-medium text-emerald-600 dark:text-emerald-400 uppercase tracking-wide">Desempenho Excelente</p>
                            </div>
                        ) : (
                            <div className="p-4">
                                <div className="grid grid-cols-2 gap-3">
                                    {/* Card Horas */}
                                    <div
                                        id="header-stats-hours" /* ID ADICIONADO PARA O TOUR: Card de horas */
                                        className={`bg-zinc-50 dark:bg-zinc-800/50 rounded-xl p-3 border flex flex-col items-center relative overflow-hidden transition-colors ${stats.percH >= 100 ? 'border-emerald-500/30 bg-emerald-50/30 dark:bg-emerald-900/10' : 'border-zinc-100 dark:border-zinc-800'}`}
                                    >
                                        {stats.percH >= 100 && <div className="absolute top-0 right-0 p-1.5"><CheckCircle2 size={14} className="text-emerald-500" /></div>}
                                        <div className="mb-2">
                                            <ProgressRing percent={stats.percH} color="text-amber-500" icon={Clock} />
                                        </div>
                                        <div className="text-center w-full">
                                            <span className="text-[10px] font-bold text-zinc-400 uppercase block mb-1 tracking-wide">Tempo</span>
                                            <div className="flex items-baseline justify-center gap-0.5 mb-2">
                                                <span className={`text-2xl font-black leading-none ${stats.percH >= 100 ? 'text-emerald-600 dark:text-emerald-400' : 'text-zinc-800 dark:text-white'}`}>
                                                    {stats.todayH.toFixed(1)}
                                                </span>
                                                <span className="text-xs font-bold text-zinc-400">h</span>
                                            </div>
                                            <div className="inline-flex items-center justify-center px-2 py-1 bg-zinc-100 dark:bg-zinc-800 rounded-md border border-zinc-200 dark:border-zinc-700 w-full">
                                                <span className="text-[10px] font-bold text-zinc-500 uppercase flex items-center gap-1">
                                                    <Target size={10} /> Meta: {stats.goalH}h
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Card Questões */}
                                    <div
                                        id="header-stats-questions" /* ID ADICIONADO PARA O TOUR: Card de questões */
                                        className={`bg-zinc-50 dark:bg-zinc-800/50 rounded-xl p-3 border flex flex-col items-center relative overflow-hidden transition-colors ${stats.percQ >= 100 ? 'border-emerald-500/30 bg-emerald-50/30 dark:bg-emerald-900/10' : 'border-zinc-100 dark:border-zinc-800'}`}
                                    >
                                        {stats.percQ >= 100 && <div className="absolute top-0 right-0 p-1.5"><CheckCircle2 size={14} className="text-emerald-500" /></div>}
                                        <div className="mb-2">
                                            <ProgressRing percent={stats.percQ} color="text-emerald-500" icon={Target} />
                                        </div>
                                        <div className="text-center w-full">
                                            <span className="text-[10px] font-bold text-zinc-400 uppercase block mb-1 tracking-wide">Questões</span>
                                            <div className="flex items-baseline justify-center gap-0.5 mb-2">
                                                <span className={`text-2xl font-black leading-none ${stats.percQ >= 100 ? 'text-emerald-600 dark:text-emerald-400' : 'text-zinc-800 dark:text-white'}`}>
                                                    {stats.todayQ}
                                                </span>
                                            </div>
                                            <div className="inline-flex items-center justify-center px-2 py-1 bg-zinc-100 dark:bg-zinc-800 rounded-md border border-zinc-200 dark:border-zinc-700 w-full">
                                                <span className="text-[10px] font-bold text-zinc-500 uppercase flex items-center gap-1">
                                                    <Target size={10} /> Meta: {stats.goalQ}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Rodapé Informativo */}
                                {!stats.isComplete && (
                                    <div className="mt-4">
                                        <div className={`
                                            text-center py-2 px-3 rounded-lg border text-xs font-medium transition-colors duration-300
                                            ${stats.state === 'close' ? 'bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800 text-orange-700 dark:text-orange-400' : ''}
                                            ${stats.state === 'partial' ? 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-400' : ''}
                                            ${stats.state === 'working' || stats.state === 'idle' ? 'bg-zinc-50 dark:bg-zinc-800/50 border-zinc-100 dark:border-zinc-800 text-zinc-500' : ''}
                                        `}>
                                            {stats.state === 'close' && <span className="flex items-center justify-center gap-1"><Flame size={12} className="animate-pulse" /> Falta pouco! Finalize a missão.</span>}
                                            {stats.state === 'partial' && <span className="flex items-center justify-center gap-1"><Medal size={12} /> Ótimo! Uma meta já foi. Complete a outra.</span>}
                                            {(stats.state === 'working' || stats.state === 'idle') && <span>Restam <strong>{(Math.max(0, stats.goalH - stats.todayH)).toFixed(1)}h</strong> e <strong>{Math.max(0, stats.goalQ - stats.todayQ)}</strong> questões.</span>}
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