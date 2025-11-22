import React, { useMemo, useState, useEffect, useRef } from 'react';
import { Clock, Target, Trophy, CheckCircle2, ChevronDown, Zap } from 'lucide-react';

const dateToYMD = (date) => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
};

function DailyTacticalHUD({ registrosEstudo, goalsHistory }) {
    const [isExpanded, setIsExpanded] = useState(false);
    const [showCelebration, setShowCelebration] = useState(false);
    const [mounted, setMounted] = useState(false);

    // Ref para rastrear o estado anterior de completude
    // Inicializa com false para garantir que a primeira verificação funcione corretamente,
    // mas vamos controlar o disparo do efeito para não rodar no mount se já estiver completo.
    const wasCompleteRef = useRef(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    // 1. Cálculos de Meta e Progresso
    const stats = useMemo(() => {
        const activeGoal = goalsHistory && goalsHistory.length > 0
            ? [...goalsHistory].sort((a, b) => new Date(b.startDate) - new Date(a.startDate))[0]
            : { questions: 0, hours: 0 };

        const goalH = parseFloat(activeGoal.hours || 0) / 7;
        const goalQ = parseInt(activeGoal.questions || 0) / 7;

        const todayStr = dateToYMD(new Date());
        let todayH = 0;
        let todayQ = 0;

        registrosEstudo.forEach(reg => {
            if (reg.data === todayStr) {
                todayH += (reg.tempoEstudadoMinutos || reg.duracaoMinutos || 0) / 60;
                todayQ += (reg.questoesFeitas || 0);
            }
        });

        const percH = goalH > 0 ? Math.min((todayH / goalH) * 100, 100) : 0;
        const percQ = goalQ > 0 ? Math.min((todayQ / goalQ) * 100, 100) : 0;
        const isComplete = percH >= 100 && percQ >= 100;
        const hasActivity = todayH > 0 || todayQ > 0;

        let statusMessage = "Sistema aguardando...";
        let statusColor = "text-zinc-500";

        if (isComplete) {
            statusMessage = "Objetivo diário neutralizado.";
            statusColor = "text-emerald-400";
        } else if (hasActivity) {
            statusMessage = "Operação em andamento...";
            statusColor = "text-amber-500";
        } else {
            statusMessage = "Inicie a operação de hoje.";
            statusColor = "text-red-400";
        }

        return { todayH, todayQ, goalH, goalQ, percH, percQ, isComplete, hasActivity, statusMessage, statusColor };
    }, [registrosEstudo, goalsHistory]);

    // Efeito de Celebração Inteligente
    useEffect(() => {
        if (mounted) {
            // Só dispara se NÃO estava completo antes E agora está (transição)
            if (stats.isComplete && !wasCompleteRef.current) {
                setShowCelebration(true);
                const timer = setTimeout(() => setShowCelebration(false), 4000);
                return () => clearTimeout(timer);
            }
            // Atualiza a ref para o próximo render
            wasCompleteRef.current = stats.isComplete;
        } else {
            // No primeiro mount, se já estiver completo, marcamos como visto para não animar
            if (stats.isComplete) {
                wasCompleteRef.current = true;
            }
        }
    }, [stats.isComplete, mounted]);

    // Styles
    const getBorderGlow = () => {
        if (showCelebration) return "border-yellow-500/50 shadow-[0_0_40px_rgba(234,179,8,0.6)] bg-yellow-950/90";
        if (stats.isComplete) return "border-emerald-500/50 shadow-[0_0_15px_rgba(16,185,129,0.4)] bg-zinc-900/90"; // Compacto verde
        if (stats.hasActivity) return "border-amber-500/30 shadow-[0_0_15px_rgba(245,158,11,0.15)] bg-zinc-900/90";
        return "border-white/10 shadow-lg bg-zinc-900/80";
    };

    const ProgressRing = ({ percent, color, icon: Icon }) => {
        const r = 18;
        const c = 2 * Math.PI * r;
        const offset = c - (percent / 100) * c;

        return (
            <div className="relative flex items-center justify-center w-12 h-12">
                <svg className="w-full h-full transform -rotate-90">
                    <circle cx="24" cy="24" r={r} stroke="currentColor" strokeWidth="3" fill="transparent" className="text-zinc-800" />
                    <circle
                        cx="24" cy="24" r={r} stroke="currentColor" strokeWidth="3" fill="transparent"
                        strokeDasharray={c} strokeDashoffset={offset} strokeLinecap="round"
                        className={`transition-all duration-1000 ease-out ${color}`}
                    />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                    <Icon size={14} className={percent >= 100 ? color : "text-zinc-400"} />
                </div>
            </div>
        );
    };

    if (!mounted) return null;

    return (
        <div className="fixed top-6 left-0 right-0 z-50 flex justify-center px-4 pointer-events-none">

            <div
                className={`
                    pointer-events-auto cursor-pointer
                    relative backdrop-blur-xl border transition-all duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)]
                    rounded-full flex flex-col items-center overflow-hidden
                    ${getBorderGlow()}
                    ${isExpanded
                        ? 'w-full max-w-[380px] rounded-[2rem] pt-4 pb-2'
                        : (stats.isComplete && !showCelebration ? 'w-auto px-6 py-2' : 'w-auto p-1.5') // Compacto se completo
                    }
                `}
                onMouseEnter={() => setIsExpanded(true)}
                onMouseLeave={() => setIsExpanded(false)}
                onClick={() => setIsExpanded(!isExpanded)}
            >

                {/* MODO CELEBRAÇÃO (Troféu) */}
                {showCelebration ? (
                    <div className="flex flex-col items-center justify-center w-[300px] h-16 animate-fade-in">
                        <Trophy size={32} className="text-yellow-400 drop-shadow-[0_0_10px_rgba(234,179,8,0.8)] animate-bounce" />
                        <span className="text-yellow-100 font-bold text-sm mt-1 tracking-widest">CONQUISTA DESBLOQUEADA</span>
                    </div>
                ) : (
                    <>
                        {/* CONTEÚDO PRINCIPAL */}
                        {/* Se estiver completo e NÃO expandido, mostra versão Compacta/Sucinta */}
                        {stats.isComplete && !isExpanded ? (
                            <div className="flex items-center gap-3 animate-fade-in">
                                <div className="relative flex items-center justify-center">
                                    <div className="absolute inset-0 bg-emerald-500 rounded-full animate-ping opacity-20"></div>
                                    <CheckCircle2 size={18} className="text-emerald-400 relative z-10" />
                                </div>
                                <span className="text-sm font-bold text-emerald-100 tracking-wider flex items-center gap-2">
                                    META DIÁRIA CONCLUÍDA
                                    <span className="flex h-2 w-2 relative">
                                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                        <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                                    </span>
                                </span>
                            </div>
                        ) : (
                            // Versão Normal (Anéis) - Aparece se não completo OU se estiver expandido (hover)
                            <div className="flex items-center justify-center gap-4">

                                {/* Anel Horas */}
                                <div className="flex items-center gap-3">
                                    <ProgressRing percent={stats.percH} color={stats.percH >= 100 ? "text-emerald-400" : "text-amber-500"} icon={Clock} />
                                    <div className={`flex flex-col overflow-hidden transition-all duration-300 ${isExpanded ? 'w-20 opacity-100' : 'w-0 opacity-0'}`}>
                                        <span className="text-[10px] uppercase font-bold text-zinc-500">Foco</span>
                                        <span className="text-sm font-bold text-zinc-200 whitespace-nowrap">
                                            {stats.todayH.toFixed(1)}<span className="text-zinc-600">/{stats.goalH.toFixed(1)}h</span>
                                        </span>
                                    </div>
                                </div>

                                {/* Divisor Central */}
                                <div className={`h-8 w-px bg-zinc-700/50 transition-all ${isExpanded ? 'opacity-100' : 'opacity-0'}`}></div>

                                {/* Anel Questões */}
                                <div className="flex items-center gap-3">
                                    <div className={`flex flex-col items-end overflow-hidden transition-all duration-300 ${isExpanded ? 'w-20 opacity-100' : 'w-0 opacity-0'}`}>
                                        <span className="text-[10px] uppercase font-bold text-zinc-500">Questões</span>
                                        <span className="text-sm font-bold text-zinc-200 whitespace-nowrap">
                                            {stats.todayQ}<span className="text-zinc-600">/{Math.floor(stats.goalQ)}</span>
                                        </span>
                                    </div>
                                    <ProgressRing percent={stats.percQ} color={stats.percQ >= 100 ? "text-emerald-400" : "text-blue-500"} icon={Target} />
                                </div>
                            </div>
                        )}

                        {/* DETALHES EXPANDIDOS */}
                        <div className={`
                            overflow-hidden transition-all duration-500 ease-in-out w-full
                            ${isExpanded ? 'max-h-24 opacity-100 mt-2' : 'max-h-0 opacity-0 mt-0'}
                        `}>
                            <div className="w-full h-px bg-gradient-to-r from-transparent via-zinc-700 to-transparent mb-2"></div>

                            <div className="text-center pb-1">
                                <p className={`text-xs font-medium ${stats.statusColor} flex items-center justify-center gap-1.5`}>
                                    {stats.isComplete ? (
                                        <span className="flex items-center gap-1"><Zap size={12} fill="currentColor"/> EXCELENTE TRABALHO</span>
                                    ) : (
                                        stats.statusMessage
                                    )}
                                </p>

                                {/* Mostra o que falta se não estiver completo */}
                                {!stats.isComplete && (
                                    <p className="text-[10px] text-zinc-400 mt-0.5">
                                        Faltam <strong className="text-zinc-200">{Math.max(0, stats.goalH - stats.todayH).toFixed(1)}h</strong> e <strong className="text-zinc-200">{Math.max(0, stats.goalQ - stats.todayQ)}</strong> questões
                                    </p>
                                )}
                            </div>

                            <div className="flex justify-center">
                                <ChevronDown size={12} className="text-zinc-600 animate-bounce" />
                            </div>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}

export default DailyTacticalHUD;