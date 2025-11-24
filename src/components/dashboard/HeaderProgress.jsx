import React, { useMemo, useState, useEffect, useRef } from 'react';
import { Clock, Target, Trophy, ChevronDown, Zap, CheckCircle2, Activity, Flame, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const dateToYMD = (date) => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
};

function HeaderProgress({ registrosEstudo, goalsHistory, activeCicloId }) {
    const [isExpanded, setIsExpanded] = useState(false);
    const [showCelebration, setShowCelebration] = useState(false);
    const wasCompleteRef = useRef(false);
    const [mounted, setMounted] = useState(false);

    useEffect(() => { setMounted(true); }, []);

    const stats = useMemo(() => {
        // Pega a meta mais recente definida
        const activeGoal = goalsHistory && goalsHistory.length > 0
            ? [...goalsHistory].sort((a, b) => new Date(b.startDate) - new Date(a.startDate))[0]
            : { questions: 0, hours: 0 };

        const goalH = parseFloat(activeGoal.hours || 0);
        const goalQ = parseInt(activeGoal.questions || 0);

        const todayStr = dateToYMD(new Date());
        let todayH = 0;
        let todayQ = 0;

        // --- FILTRAGEM INTELIGENTE ---
        registrosEstudo.forEach(reg => {
            // Verifica se é hoje E se pertence ao ciclo ativo
            const isToday = reg.data === todayStr;
            const isCurrentCycle = activeCicloId ? reg.cicloId === activeCicloId : true; // Se não tiver activeCicloId, conta tudo (fallback)

            if (isToday && isCurrentCycle) {
                todayH += (Number(reg.tempoEstudadoMinutos) || Number(reg.duracaoMinutos) || 0) / 60;
                todayQ += (Number(reg.questoesFeitas) || 0);
            }
        });

        const percH = goalH > 0 ? Math.min((todayH / goalH) * 100, 100) : 0;
        const percQ = goalQ > 0 ? Math.min((todayQ / goalQ) * 100, 100) : 0;

        const isCompleteH = goalH === 0 || percH >= 100;
        const isCompleteQ = goalQ === 0 || percQ >= 100;

        // Completo apenas se tiver meta definida e atingida
        const isComplete = isCompleteH && isCompleteQ && (goalH > 0 || goalQ > 0);
        const hasActivity = todayH > 0 || todayQ > 0;

        const overallProgress = (goalH > 0 || goalQ > 0) ? ((percH + percQ) / 2) : 0;

        // --- ESTADOS REATIVOS DO SISTEMA ---
        let state = 'idle'; // Aguardando
        if (isComplete) state = 'complete';
        else if (overallProgress >= 80) state = 'close'; // Reta final (>80%)
        else if (hasActivity) state = 'working'; // Em andamento

        return { todayH, todayQ, goalH, goalQ, percH, percQ, isComplete, hasActivity, overallProgress, state };
    }, [registrosEstudo, goalsHistory, activeCicloId]); // Recalcula quando o ID do ciclo mudar

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

    // Configurações Visuais Baseadas no Estado
    const statusConfig = {
        idle: {
            icon: Activity,
            colorClass: 'bg-zinc-100 dark:bg-zinc-800 text-zinc-400',
            barClass: 'bg-zinc-300 dark:bg-zinc-600',
            borderClass: 'hover:border-zinc-300 dark:hover:border-zinc-600',
            label: 'Inicie seu Progresso'
        },
        working: {
            icon: Clock,
            colorClass: 'bg-blue-500 text-white shadow-lg shadow-blue-500/20',
            barClass: 'bg-blue-500',
            borderClass: 'border-blue-500/20 bg-blue-50/50 dark:bg-blue-900/10',
            label: 'Em Progresso'
        },
        close: {
            icon: Flame,
            colorClass: 'bg-orange-500 text-white shadow-lg shadow-orange-500/20 animate-pulse',
            barClass: 'bg-orange-500',
            borderClass: 'border-orange-500/30 bg-orange-50/50 dark:bg-orange-900/10',
            label: 'Reta Final!'
        },
        complete: {
            icon: Trophy,
            colorClass: 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20',
            barClass: 'bg-emerald-500',
            borderClass: 'border-emerald-500/40 bg-emerald-50/50 dark:bg-emerald-900/10',
            label: 'Meta Batida'
        }
    };

    const currentConfig = statusConfig[stats.state];
    const StatusIcon = currentConfig.icon;

    // Anel de Progresso Otimizado
    const ProgressRing = ({ percent, color, icon: Icon }) => {
        const r = 22;
        const c = 2 * Math.PI * r;
        const offset = c - (percent / 100) * c;
        return (
            <div className="relative flex items-center justify-center w-14 h-14">
                <svg className="w-full h-full transform -rotate-90">
                    <circle cx="28" cy="28" r={r} stroke="currentColor" strokeWidth="4" fill="transparent" className="text-zinc-100 dark:text-zinc-800" />
                    <circle
                        cx="28" cy="28" r={r} stroke="currentColor" strokeWidth="4" fill="transparent"
                        strokeDasharray={c} strokeDashoffset={offset} strokeLinecap="round"
                        className={`transition-all duration-1000 ease-out ${color}`}
                    />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center text-zinc-500 dark:text-zinc-400">
                    <Icon size={18} />
                </div>
            </div>
        );
    };

    if (!mounted) return null;

    return (
        <div
            className="relative z-50"
            onMouseEnter={() => setIsExpanded(true)}
            onMouseLeave={() => setIsExpanded(false)}
        >
            {/* --- BARRA COMPACTA (HEADER) --- */}
            <div className={`
                flex items-center gap-4 px-4 py-2 bg-white dark:bg-zinc-900
                border border-zinc-200 dark:border-zinc-800 rounded-xl cursor-pointer
                transition-all duration-300 shadow-sm hover:shadow-md relative overflow-hidden
                ${currentConfig.borderClass}
            `}>
                {/* Efeito de Brilho se Completo */}
                {stats.state === 'complete' && (
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full animate-[shimmer_2s_infinite]"></div>
                )}

                {/* Ícone de Status Reativo */}
                <div className={`p-2 rounded-lg flex items-center justify-center transition-all duration-300 ${currentConfig.colorClass}`}>
                    <StatusIcon size={20} />
                </div>

                <div className="flex flex-col min-w-[150px]">
                    <div className="flex justify-between items-end mb-1 w-full">
                        <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400 dark:text-zinc-500">
                            {currentConfig.label}
                        </span>
                        <span className="text-sm font-black text-zinc-800 dark:text-white leading-none">
                            {stats.overallProgress.toFixed(0)}%
                        </span>
                    </div>

                    <div className="h-2 w-full bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden border border-zinc-100 dark:border-zinc-700">
                        <motion.div
                            className={`h-full rounded-full ${currentConfig.barClass}`}
                            initial={{ width: 0 }}
                            animate={{ width: `${stats.overallProgress}%` }}
                            transition={{ duration: 1 }}
                        />
                    </div>
                </div>

                <ChevronDown size={16} className={`text-zinc-400 transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`} />
            </div>

            {/* --- DROPDOWN DE DETALHES (TÁTICO) --- */}
            <AnimatePresence>
                {isExpanded && (
                    <motion.div
                        initial={{ opacity: 0, y: 10, scale: 0.98 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 10, scale: 0.98 }}
                        className="absolute top-full right-0 mt-3 w-[360px] bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-2xl overflow-hidden ring-1 ring-black/5"
                    >
                        {showCelebration ? (
                            <div className="flex flex-col items-center justify-center py-8 animate-fade-in bg-emerald-50/50 dark:bg-emerald-900/10">
                                <Trophy size={64} className="text-yellow-500 drop-shadow-xl animate-bounce mb-4" />
                                <h3 className="text-2xl font-black text-zinc-800 dark:text-white tracking-tight">MISSÃO CUMPRIDA!</h3>
                                <p className="text-sm font-medium text-emerald-600 dark:text-emerald-400 uppercase tracking-wide">Desempenho Excelente</p>
                            </div>
                        ) : (
                            <div className="p-4">
                                {/* Grid de Métricas (Cards Individuais) */}
                                <div className="grid grid-cols-2 gap-3">

                                    {/* Card Horas */}
                                    <div className="bg-zinc-50 dark:bg-zinc-800/50 rounded-xl p-3 border border-zinc-100 dark:border-zinc-800 flex flex-col items-center relative overflow-hidden">
                                        {stats.percH >= 100 && <div className="absolute top-0 right-0 p-1.5"><CheckCircle2 size={14} className="text-emerald-500" /></div>}

                                        <div className="mb-2">
                                            <ProgressRing percent={stats.percH} color="text-amber-500" icon={Clock} />
                                        </div>

                                        <div className="text-center w-full">
                                            <span className="text-[10px] font-bold text-zinc-400 uppercase block mb-1 tracking-wide">Tempo de Estudo</span>

                                            <div className="flex items-baseline justify-center gap-0.5 mb-2">
                                                <span className="text-2xl font-black text-zinc-800 dark:text-white leading-none">
                                                    {stats.todayH.toFixed(1)}
                                                </span>
                                                <span className="text-xs font-bold text-zinc-400">h</span>
                                            </div>

                                            {/* Meta Badge */}
                                            <div className="inline-flex items-center justify-center px-2 py-1 bg-zinc-100 dark:bg-zinc-800 rounded-md border border-zinc-200 dark:border-zinc-700 w-full">
                                                <span className="text-[10px] font-bold text-zinc-500 uppercase flex items-center gap-1">
                                                    <Target size={10} /> Meta: {stats.goalH}h
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Card Questões */}
                                    <div className="bg-zinc-50 dark:bg-zinc-800/50 rounded-xl p-3 border border-zinc-100 dark:border-zinc-800 flex flex-col items-center relative overflow-hidden">
                                        {stats.percQ >= 100 && <div className="absolute top-0 right-0 p-1.5"><CheckCircle2 size={14} className="text-emerald-500" /></div>}

                                        <div className="mb-2">
                                            <ProgressRing percent={stats.percQ} color="text-emerald-500" icon={Target} />
                                        </div>

                                        <div className="text-center w-full">
                                            <span className="text-[10px] font-bold text-zinc-400 uppercase block mb-1 tracking-wide">Questões</span>

                                            <div className="flex items-baseline justify-center gap-0.5 mb-2">
                                                <span className="text-2xl font-black text-zinc-800 dark:text-white leading-none">
                                                    {stats.todayQ}
                                                </span>

                                            </div>

                                            {/* Meta Badge */}
                                            <div className="inline-flex items-center justify-center px-2 py-1 bg-zinc-100 dark:bg-zinc-800 rounded-md border border-zinc-200 dark:border-zinc-700 w-full">
                                                <span className="text-[10px] font-bold text-zinc-500 uppercase flex items-center gap-1">
                                                    <Target size={10} /> Meta: {stats.goalQ}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Rodapé Informativo (Reativo) */}
                                {!stats.isComplete && (
                                    <div className="mt-4">
                                        <div className={`
                                            text-center py-2 px-3 rounded-lg border text-xs font-medium
                                            ${stats.state === 'close'
                                                ? 'bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800 text-orange-700 dark:text-orange-400'
                                                : 'bg-zinc-50 dark:bg-zinc-800/50 border-zinc-100 dark:border-zinc-800 text-zinc-500'
                                            }
                                        `}>
                                            {stats.state === 'close'
                                                ? <span className="flex items-center justify-center gap-1"><Flame size={12}/> Falta pouco! Mantenha o foco.</span>
                                                : <span>Restam <strong>{(Math.max(0, stats.goalH - stats.todayH)).toFixed(1)}h</strong> e <strong>{Math.max(0, stats.goalQ - stats.todayQ)}</strong> questões.</span>
                                            }
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