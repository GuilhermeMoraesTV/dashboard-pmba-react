// components/ciclos/ModalConclusaoCiclo.js

import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import confetti from 'canvas-confetti';
import { AlertTriangle, Trophy, RefreshCw, X, CheckCircle2, Clock3, Sparkles, ArrowRight } from 'lucide-react';

const celebrationBursts = [
    { angle: 60, origin: { x: 0.12, y: 0.18 } },
    { angle: 120, origin: { x: 0.88, y: 0.18 } },
];

const floatingSparks = Array.from({ length: 14 }, (_, index) => ({
    id: index,
    left: `${8 + ((index * 17) % 84)}%`,
    top: `${8 + ((index * 23) % 78)}%`,
    delay: index * 0.12,
    duration: 3 + (index % 4) * 0.35,
}));

function ModalConclusaoCiclo({
    ciclo,
    onConfirm,
    onClose,
    loading,
    progressoGeral,
    revisoesPendentes = 0,
    revisoesAtrasadas = 0,
    revisoesHoje = 0,
    revisoesProgramadas = 0,
}) {
    const hasRevisoesPendentes = revisoesPendentes > 0;
    const proximaConclusao = (Number(ciclo?.conclusoes || 0) + 1);
    const progressoSeguro = Number.isFinite(Number(progressoGeral)) ? Math.min(100, Math.max(0, Number(progressoGeral))) : 100;

    useEffect(() => {
        if (typeof window === 'undefined') return;
        const prefersReducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
        if (prefersReducedMotion) return;

        const timers = celebrationBursts.map((burst, index) => window.setTimeout(() => {
            confetti({
                particleCount: 54,
                spread: 62,
                startVelocity: 42,
                scalar: 0.85,
                ticks: 180,
                gravity: 0.95,
                colors: ['#10b981', '#f59e0b', '#ef4444', '#ffffff'],
                ...burst,
            });
        }, index * 180));

        timers.push(window.setTimeout(() => {
            confetti({
                particleCount: 70,
                spread: 90,
                startVelocity: 28,
                scalar: 0.72,
                ticks: 150,
                origin: { x: 0.5, y: 0.25 },
                colors: ['#10b981', '#22c55e', '#fbbf24', '#ffffff'],
            });
        }, 360));

        return () => timers.forEach((timer) => window.clearTimeout(timer));
    }, []);

    return (
        <AnimatePresence>
            {true && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 z-[9999] flex items-center justify-center overflow-hidden bg-zinc-950/88 p-2 backdrop-blur-md sm:p-4"
                    onClick={onClose}
                >
                    <div className="pointer-events-none absolute inset-0 hidden overflow-hidden sm:block">
                        <motion.div
                            className="absolute left-1/2 top-1/2 h-[560px] w-[560px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-emerald-500/10 blur-3xl"
                            animate={{ scale: [0.9, 1.08, 0.96], opacity: [0.35, 0.7, 0.45] }}
                            transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}
                        />
                        <motion.div
                            className="absolute right-[10%] top-[12%] h-40 w-40 rounded-full bg-amber-400/10 blur-3xl"
                            animate={{ y: [0, 16, 0], opacity: [0.25, 0.5, 0.25] }}
                            transition={{ duration: 4.5, repeat: Infinity, ease: 'easeInOut' }}
                        />
                        {floatingSparks.map((spark) => (
                            <motion.span
                                key={spark.id}
                                className="absolute h-1.5 w-1.5 rounded-full bg-white/70 shadow-[0_0_14px_rgba(255,255,255,0.8)]"
                                style={{ left: spark.left, top: spark.top }}
                                animate={{ y: [0, -18, 0], opacity: [0, 0.8, 0], scale: [0.7, 1.2, 0.7] }}
                                transition={{ duration: spark.duration, delay: spark.delay, repeat: Infinity, ease: 'easeInOut' }}
                            />
                        ))}
                    </div>

                    <motion.div
                        initial={{ opacity: 0, y: 28 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 18 }}
                        transition={{ type: 'spring', stiffness: 260, damping: 26 }}
                        className="relative flex max-h-[calc(100dvh-1rem)] w-full max-w-2xl flex-col overflow-hidden rounded-[18px] border border-white/60 bg-white shadow-[0_30px_90px_-35px_rgba(15,23,42,0.9)] dark:border-white/10 dark:bg-zinc-950 sm:max-h-[calc(100dvh-3rem)] sm:rounded-[24px]"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="pointer-events-none absolute inset-x-0 top-0 h-48 bg-[radial-gradient(circle_at_50%_0%,rgba(16,185,129,0.24),transparent_62%)]" />
                        <div className="pointer-events-none absolute -right-20 -top-24 h-56 w-56 rounded-full bg-amber-400/20 blur-3xl" />
                        <div className="pointer-events-none absolute -left-20 top-20 h-44 w-44 rounded-full bg-red-500/10 blur-3xl" />

                        <button onClick={onClose} className="absolute right-3 top-3 z-20 flex h-8 w-8 items-center justify-center rounded-full border border-zinc-200/70 bg-white/80 text-zinc-400 shadow-sm backdrop-blur transition-all hover:scale-105 hover:text-zinc-700 dark:border-white/10 dark:bg-zinc-900/80 dark:hover:text-white sm:right-4 sm:top-4 sm:h-9 sm:w-9">
                            <X size={18} />
                        </button>

                        <div className="relative z-10 min-h-0 flex-1 overflow-y-auto px-4 pb-3 pt-4 sm:px-7 sm:pb-5 sm:pt-6">
                            <div className="grid items-center gap-3 text-center sm:grid-cols-[132px_minmax(0,1fr)] sm:gap-4 sm:text-left">
                                <motion.div
                                    initial={{ scale: 0.6, rotate: -12 }}
                                    animate={{ scale: 1, rotate: 0 }}
                                    transition={{ type: 'spring', stiffness: 280, damping: 16, delay: 0.08 }}
                                    className="relative mx-auto flex h-16 w-16 items-center justify-center sm:h-28 sm:w-28"
                                >
                                    <motion.div
                                        className="absolute inset-0 rounded-full bg-emerald-400/25"
                                        animate={{ scale: [1, 1.22, 1], opacity: [0.65, 0.18, 0.65] }}
                                        transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
                                    />
                                    <div className="absolute inset-2 rounded-full bg-gradient-to-br from-emerald-400 via-emerald-500 to-teal-600 shadow-2xl shadow-emerald-500/30" />
                                    <div className="relative flex h-11 w-11 items-center justify-center rounded-full border border-white/50 bg-white/18 text-white shadow-inner backdrop-blur sm:h-16 sm:w-16">
                                        <Trophy size={28} className="sm:h-9 sm:w-9" strokeWidth={2.6} />
                                    </div>
                                    <motion.div
                                        className="absolute -right-1 top-0 flex h-6 w-6 items-center justify-center rounded-full bg-amber-400 text-white shadow-lg shadow-amber-500/30 sm:top-2 sm:h-8 sm:w-8"
                                        animate={{ rotate: [0, 12, -8, 0], scale: [1, 1.08, 1] }}
                                        transition={{ duration: 2.6, repeat: Infinity, ease: 'easeInOut' }}
                                    >
                                        <Sparkles size={13} className="sm:h-4 sm:w-4" fill="currentColor" />
                                    </motion.div>
                                </motion.div>

                                <div className="min-w-0">
                                    <motion.div
                                        initial={{ opacity: 0, y: 12 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: 0.16 }}
                                        className="mb-2 inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-[9px] font-black uppercase tracking-[0.2em] text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-300 sm:text-[10px] sm:tracking-[0.24em]"
                                    >
                                        <CheckCircle2 size={13} />
                                        Meta batida
                                    </motion.div>

                                    <motion.h2
                                        initial={{ opacity: 0, y: 12 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: 0.22 }}
                                        className="text-2xl font-black uppercase leading-none tracking-tight text-zinc-950 dark:text-white sm:text-4xl"
                                    >
                                        Ciclo Completo!
                                    </motion.h2>
                                    <motion.p
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: 0.28 }}
                                        className="mx-auto mt-2 max-w-sm text-xs font-medium leading-relaxed text-zinc-500 dark:text-zinc-400 sm:mx-0 sm:mt-3 sm:max-w-lg sm:text-sm"
                                    >
                                        Voce fechou a rodada de estudos de <strong className="font-black text-zinc-900 dark:text-white">{ciclo?.nome || 'Ciclo'}</strong>. Agora e so registrar a conclusao para iniciar uma nova volta.
                                    </motion.p>
                                </div>
                            </div>

                            <div className="mt-3 grid overflow-hidden rounded-xl border border-zinc-200 bg-white text-left dark:border-zinc-800 dark:bg-zinc-950 sm:mt-4 sm:grid-cols-[minmax(0,1fr)_132px_170px]">
                                <div className="p-3 dark:border-zinc-800 sm:border-r sm:p-4">
                                    <div className="mb-2 flex items-center justify-between gap-3">
                                        <p className="text-sm font-bold text-zinc-700 dark:text-zinc-200">Progresso final</p>
                                        <p className="text-sm font-black text-emerald-600 dark:text-emerald-400">{Math.round(progressoSeguro)}%</p>
                                    </div>
                                    <div className="h-2.5 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800">
                                        <div
                                            className="h-full rounded-full bg-emerald-500"
                                            style={{ width: `${progressoSeguro}%` }}
                                        />
                                    </div>
                                </div>

                                <div className="hidden border-b border-zinc-200 p-4 dark:border-zinc-800 sm:block sm:border-b-0 sm:border-r">
                                    <p className="flex items-center gap-2 text-sm font-bold text-zinc-700 dark:text-zinc-200">
                                        <Trophy size={15} className="text-emerald-600 dark:text-emerald-400" />
                                        Conclusao
                                    </p>
                                    <p className="mt-1 text-2xl font-black leading-none text-zinc-950 dark:text-white">{proximaConclusao}&deg;</p>
                                </div>

                                <div className="hidden p-4 sm:block">
                                    <p className="flex items-center gap-2 text-sm font-bold text-zinc-700 dark:text-zinc-200">
                                        <Clock3 size={15} className="text-zinc-500 dark:text-zinc-400" />
                                        Proximo passo
                                    </p>
                                    <p className="mt-1 text-base font-black leading-tight text-zinc-950 dark:text-white">Resetar progresso</p>
                                </div>
                            </div>

                        </div>

                        <div className="relative z-10 shrink-0 border-t border-zinc-200/80 bg-white/95 px-4 py-3 text-center backdrop-blur dark:border-white/10 dark:bg-zinc-950/95 sm:px-7 sm:py-5">
                            <p className="hidden text-sm text-zinc-600 dark:text-zinc-400 sm:block">
                                Ao confirmar, voce registra a conclusao e zera o progresso de horas para recomecar.
                            </p>
                            <ul className="my-3 hidden max-h-[19vh] gap-2 overflow-y-auto text-left text-xs text-zinc-700 dark:text-zinc-300 sm:my-4 sm:grid sm:max-h-none sm:grid-cols-2 sm:overflow-visible">
                                <li className="flex items-start gap-3 rounded-2xl border border-zinc-200/70 bg-zinc-50 px-3 py-2.5 dark:border-white/10 dark:bg-white/[0.03]">
                                    <Trophy size={16} className="mt-0.5 flex-shrink-0 text-emerald-500" />
                                    <span><span className="font-black text-zinc-900 dark:text-white">Historico atualizado.</span> Esta volta fica contabilizada no seu ciclo.</span>
                                </li>
                                <li className="flex items-start gap-3 rounded-2xl border border-zinc-200/70 bg-zinc-50 px-3 py-2.5 dark:border-white/10 dark:bg-white/[0.03]">
                                    <RefreshCw size={16} className="mt-0.5 flex-shrink-0 text-red-500" />
                                    <span><span className="font-black text-zinc-900 dark:text-white">Novo inicio liberado.</span> Os registros atuais sao arquivados e o progresso volta para 0%.</span>
                                </li>
                            </ul>

                            {hasRevisoesPendentes && (
                                <div className="mb-4 hidden rounded-2xl border border-amber-200 bg-gradient-to-br from-amber-50 to-white p-3 text-left shadow-sm dark:border-amber-900/50 dark:from-amber-950/25 dark:to-zinc-950 sm:block sm:p-4">
                                    <div className="grid gap-3 sm:grid-cols-[40px_minmax(0,1fr)_250px] sm:items-center">
                                        <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-amber-500 text-white shadow-lg shadow-amber-500/20">
                                            <AlertTriangle size={18} />
                                        </div>
                                        <div className="min-w-0">
                                            <p className="text-xs font-black uppercase tracking-wider text-amber-800 dark:text-amber-200">
                                                Revisoes pendentes neste ciclo
                                            </p>
                                            <p className="mt-1 text-xs font-medium leading-relaxed text-amber-800/80 dark:text-amber-100/80">
                                                Existem {revisoesPendentes} revisao{revisoesPendentes === 1 ? '' : 'es'} ainda aberta{revisoesPendentes === 1 ? '' : 's'} neste ciclo. Isso inclui atrasadas, revisoes de hoje e revisoes futuras ja programadas.
                                            </p>
                                        </div>
                                        <div className="grid grid-cols-3 gap-2">
                                            <div className="rounded-xl border border-amber-200/80 bg-white/80 px-2 py-2 text-center shadow-sm dark:border-amber-900/50 dark:bg-zinc-950/30">
                                                <p className="text-sm font-black text-amber-900 dark:text-amber-100">{revisoesAtrasadas}</p>
                                                <p className="text-[8px] font-black uppercase tracking-wider text-amber-700/80 dark:text-amber-200/70">Atrasadas</p>
                                            </div>
                                            <div className="rounded-xl border border-amber-200/80 bg-white/80 px-2 py-2 text-center shadow-sm dark:border-amber-900/50 dark:bg-zinc-950/30">
                                                <p className="text-sm font-black text-amber-900 dark:text-amber-100">{revisoesHoje}</p>
                                                <p className="text-[8px] font-black uppercase tracking-wider text-amber-700/80 dark:text-amber-200/70">Hoje</p>
                                            </div>
                                            <div className="rounded-xl border border-amber-200/80 bg-white/80 px-2 py-2 text-center shadow-sm dark:border-amber-900/50 dark:bg-zinc-950/30">
                                                <p className="text-sm font-black text-amber-900 dark:text-amber-100">{revisoesProgramadas}</p>
                                                <p className="text-[8px] font-black uppercase tracking-wider text-amber-700/80 dark:text-amber-200/70">Futuras</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            <div className="grid grid-cols-2 gap-2 sm:flex sm:gap-3">
                                <button onClick={onClose} disabled={loading} className="rounded-xl bg-zinc-100 px-3 py-2.5 text-[10px] font-black uppercase tracking-wider text-zinc-700 transition-all hover:bg-zinc-200 active:scale-[0.98] disabled:opacity-60 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700 sm:flex-1 sm:rounded-2xl sm:px-4 sm:py-3 sm:text-xs">Cancelar</button>
                                <button onClick={() => onConfirm?.({ resetarRevisoesPendentes: false })} disabled={loading} className="group flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-3 py-2.5 text-[10px] font-black uppercase tracking-wider text-white shadow-xl shadow-emerald-600/25 transition-all hover:-translate-y-0.5 hover:bg-emerald-500 hover:shadow-emerald-600/35 active:translate-y-0 disabled:pointer-events-none disabled:opacity-70 sm:flex-1 sm:rounded-2xl sm:px-4 sm:py-3 sm:text-xs">
                                    {loading ? (
                                        <>
                                            <RefreshCw size={15} className="animate-spin" />
                                            Concluindo...
                                        </>
                                    ) : (
                                        <>
                                            Confirmar
                                            <ArrowRight size={15} className="transition-transform group-hover:translate-x-0.5" />
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}

export default ModalConclusaoCiclo;
