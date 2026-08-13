// components/ciclos/ModalConclusaoCiclo.js

import React from 'react';
import { ArrowRight, CheckCircle2, Clock3, RefreshCw, Trophy } from 'lucide-react';
import DailyGoalCompletedModal from '../shared/DailyGoalCompletedModal';

const fmtMin = (min) => {
    const total = Math.max(0, Math.round(Number(min) || 0));
    if (total < 60) return `${total}m`;
    const h = Math.floor(total / 60);
    const m = total % 60;
    return m > 0 ? `${h}h${String(m).padStart(2, '0')}` : `${h}h`;
};

function ModalConclusaoCiclo({
    ciclo,
    onConfirm,
    onClose,
    loading,
    disciplinas = [],
    totalEstudado = 0,
    totalMeta = 0,
    revisoesPendentes = 0,
    revisoesAtrasadas = 0,
    revisoesHoje = 0,
    revisoesProgramadas = 0,
    editalLogo = null,
    editalName = null,
}) {
    const proximaConclusao = Number(ciclo?.conclusoes || 0) + 1;
    const tempoSemanalMeta = Number(totalMeta || 0)
        || disciplinas.reduce((acc, disciplina) => acc + Number(disciplina?.tempoAlocadoSemanalMinutos || 0), 0);
    const tempoSemanalFeito = Number(totalEstudado || 0);
    const nomeEdital = editalName || ciclo?.editalNome || ciclo?.nome || ciclo?.titulo || 'Ciclo ativo';

    const stats = [
        {
            label: 'Tempo',
            value: `${fmtMin(tempoSemanalFeito)} / ${fmtMin(tempoSemanalMeta)}`,
            description: 'Nesta volta',
            icon: Clock3,
            tone: 'zinc',
        },
        {
            label: 'Conclusoes',
            value: proximaConclusao,
            description: 'Voltas finalizadas',
            icon: Trophy,
            tone: 'emerald',
        },
    ];

    const footer = (
        <div className="space-y-2">
            <p className="truncate text-center text-[9px] font-bold uppercase tracking-wide text-zinc-500 dark:text-zinc-400 sm:text-[10px]">
                Confirmar salva a conclusao e abre uma nova volta.
            </p>
            <div className="grid grid-cols-2 gap-2">
                <button
                    type="button"
                    onClick={onClose}
                    disabled={loading}
                    className="rounded-xl bg-zinc-100 px-3 py-2 text-[10px] font-black uppercase tracking-wider text-zinc-700 transition-all hover:bg-zinc-200 active:scale-[0.98] disabled:opacity-60 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700 sm:rounded-2xl sm:py-2.5 sm:text-xs"
                >
                    Cancelar
                </button>
                <button
                    type="button"
                    onClick={() => onConfirm?.({ resetarRevisoesPendentes: false })}
                    disabled={loading}
                    className="group flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-3 py-2 text-[10px] font-black uppercase tracking-wider text-white shadow-xl shadow-emerald-600/25 transition-all hover:-translate-y-0.5 hover:bg-emerald-500 hover:shadow-emerald-600/35 active:translate-y-0 disabled:pointer-events-none disabled:opacity-70 sm:rounded-2xl sm:py-2.5 sm:text-xs"
                >
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
    );

    return (
        <DailyGoalCompletedModal
            open
            onClose={onClose}
            ariaLabel="Ciclo completo"
            achievementLabel="Ciclo finalizado"
            title="Ciclo completo"
            contextLabel="Proxima volta pronta"
            planName={nomeEdital}
            editalName={nomeEdital}
            editalLogo={editalLogo || ciclo?.editalLogo || ciclo?.logoUrl || ciclo?.logo || null}
            largeEditalLogo
            heroIcon={CheckCircle2}
            stats={stats}
            progressLabel="100%"
            notice={null}
            footer={footer}
        />
    );
}

export default ModalConclusaoCiclo;
