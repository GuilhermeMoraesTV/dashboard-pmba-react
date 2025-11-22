import React, { useMemo, useState, useEffect } from 'react';
import { Clock, Target, Trophy, CheckCircle2, AlertTriangle, ChevronDown, Zap } from 'lucide-react';

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

    useEffect(() => {
        setMounted(true);
    }, []);

    // 1. Cálculos de Meta e Progresso
    const stats = useMemo(() => {
        const activeGoal = goalsHistory && goalsHistory.length > 0
            ? [...goalsHistory].sort((a, b) => new Date(b.startDate) - new Date(a.startDate))[0]
            : { questions: 0, hours: 0 };

        // Meta Diária (Semanal / 7)
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

        // Mensagem Dinâmica do Sistema
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

    // Efeito de Celebração quando completa
    useEffect(() => {
        if (stats.isComplete) {
            setShowCelebration(true);
            const timer = setTimeout(() => setShowCelebration(false), 4000); // 4 segundos de glória
            return () => clearTimeout(timer);
        }
    }, [stats.isComplete]);

    // Helpers de estilo
    const getBorderGlow = () => {
        if (showCelebration) return "border-yellow-500/50 shadow-[0_0_40px_rgba(234,179,8,0.6)] bg-yellow-950/90";
        if (stats.isComplete) return "border-emerald-500/50 shadow-[0_0_20px_rgba(16,185,129,0.3)] bg-zinc-900/90";
        if (stats.hasActivity) return "border-amber-500/30 shadow-[0_0_15px_rgba(245,158,11,0.15)] bg-zinc-900/90";
        return "border-white/10 shadow-lg bg-zinc-900/80"; // Frio
    };

    // Renderização do Anel de Progresso (SVG)
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
                {/* Pulso se ativo e incompleto */}
                {stats.hasActivity && percent < 100 && (
                    <div className={`absolute inset-0 rounded-full opacity-20 animate-pulse ${color.replace('text-', 'bg-')}`}></div>
                )}
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
                    rounded-[2rem] flex flex-col items-center overflow-hidden
                    ${getBorderGlow()}
                    ${isExpanded ? 'w-full max-w-[380px] pt-4 pb-2' : 'w-auto p-1.5'}
                `}
                onMouseEnter={() => setIsExpanded(true)}
                onMouseLeave={() => setIsExpanded(false)}
                onClick={() => setIsExpanded(!isExpanded)}
            >

                {/* MODO CELEBRAÇÃO (Troféu Dourado) */}
                {showCelebration ? (
                    <div className="flex flex-col items-center justify-center w-[300px] h-16 animate-fade-in">
                        <Trophy size={32} className="text-yellow-400 drop-shadow-[0_0_10px_rgba(234,179,8,0.8)] animate-bounce" />
                        <span className="text-yellow-100 font-bold text-sm mt-1 tracking-widest">CONQUISTA DESBLOQUEADA</span>
                    </div>
                ) : (
                    <>
                        {/* CONTEÚDO PRINCIPAL */}
                        <div className="flex items-center justify-center gap-4">

                            {/* Anel Horas */}
                            <div className="flex items-center gap-3">
                                <ProgressRing percent={stats.percH} color={stats.percH >= 100 ? "text-emerald-400" : "text-amber-500"} icon={Clock} />

                                {/* Texto Expandido - Horas */}
                                <div className={`flex flex-col overflow-hidden transition-all duration-300 ${isExpanded ? 'w-20 opacity-100' : 'w-0 opacity-0'}`}>
                                    <span className="text-[10px] uppercase font-bold text-zinc-500">Foco</span>
                                    <span className="text-sm font-bold text-zinc-200 whitespace-nowrap">
                                        {stats.todayH.toFixed(1)}<span className="text-zinc-600">/{stats.goalH.toFixed(1)}h</span>
                                    </span>
                                </div>
                            </div>

                            {/* Divisor ou Check de Completo */}
                            {stats.isComplete ? (
                                <div className="w-8 h-8 bg-emerald-500 rounded-full flex items-center justify-center shadow-[0_0_15px_rgba(16,185,129,0.5)] animate-fade-in">
                                    <CheckCircle2 size={18} className="text-white" />
                                </div>
                            ) : (
                                <div className={`h-8 w-px bg-zinc-700/50 transition-all ${isExpanded ? 'opacity-100' : 'opacity-0'}`}></div>
                            )}

                            {/* Anel Questões */}
                            <div className="flex items-center gap-3">
                                {/* Texto Expandido - Questões (Ordem inversa para simetria) */}
                                <div className={`flex flex-col items-end overflow-hidden transition-all duration-300 ${isExpanded ? 'w-20 opacity-100' : 'w-0 opacity-0'}`}>
                                    <span className="text-[10px] uppercase font-bold text-zinc-500">Questões</span>
                                    <span className="text-sm font-bold text-zinc-200 whitespace-nowrap">
                                        {stats.todayQ}<span className="text-zinc-600">/{Math.floor(stats.goalQ)}</span>
                                    </span>
                                </div>

                                <ProgressRing percent={stats.percQ} color={stats.percQ >= 100 ? "text-emerald-400" : "text-blue-500"} icon={Target} />
                            </div>
                        </div>

                        {/* MENSAGEM DE STATUS (Só aparece expandido) */}
                        <div className={`
                            overflow-hidden transition-all duration-500 ease-in-out
                            ${isExpanded ? 'max-h-20 opacity-100 mt-2' : 'max-h-0 opacity-0 mt-0'}
                        `}>
                            <div className="w-full h-px bg-gradient-to-r from-transparent via-zinc-700 to-transparent mb-2"></div>
                            <div className="text-center pb-1">
                                <p className={`text-xs font-medium ${stats.statusColor} flex items-center justify-center gap-1.5`}>
                                    {stats.hasActivity && !stats.isComplete && <span className="relative flex h-2 w-2">
                                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                                      <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
                                    </span>}
                                    {stats.statusMessage}
                                </p>
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