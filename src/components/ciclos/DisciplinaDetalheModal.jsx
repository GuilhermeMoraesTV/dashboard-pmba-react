import React, { useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Clock, Target, Trophy, BookOpen, Activity, BarChart2, TrendingUp, AlertCircle } from 'lucide-react';

const formatDecimalHours = (minutos) => {
    if (!minutos || minutos < 0) return '0.0';
    return (minutos / 60).toFixed(1);
};

const formatTimeShort = (minutes) => {
    if (!minutes || minutes === 0) return '--';
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
};

// Card Refatorado: Organização Técnica com Número Centralizado
const CompactStatCard = ({ icon: Icon, label, value, unit, colorClass, borderColor }) => (
  <div className="w-full min-h-[110px] p-5 rounded-[2rem] bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 relative overflow-hidden shadow-sm flex flex-col group">
    {/* Marca d'água estilizada ao fundo */}
    <div className={`absolute -right-4 -bottom-4 opacity-[0.06] transform -rotate-12 transition-transform group-hover:scale-110 duration-700 ${colorClass}`}>
        <Icon size={100} strokeWidth={1.5} />
    </div>

    {/* 1. TOPO: Identificação (Alinhado à esquerda) */}
    <div className="flex items-center gap-2 mb-auto relative z-10">
        <div className={`p-1.5 rounded-lg bg-opacity-10 ${colorClass.replace('text-', 'bg-')} ${colorClass}`}>
            <Icon size={14} />
        </div>
        <p className="text-[9px] font-black uppercase tracking-[0.2em] text-zinc-400">{label}</p>
    </div>

    {/* 2. CENTRO: O Número (Centralizado com destaque máximo) */}
    <div className="flex flex-col items-center justify-center py-2 relative z-10">
        <div className="flex items-baseline gap-1">
            <span className="text-4xl font-black text-zinc-900 dark:text-white tracking-tighter leading-none">
                {value}
            </span>
            <span className={`text-[10px] font-black uppercase ${colorClass}`}>
                {unit}
            </span>
        </div>
    </div>

    {/* Barra de cor lateral para identificação rápida */}
    <div className={`absolute left-0 top-0 w-1.5 h-full ${borderColor}`}></div>
  </div>
);

const ActivityChart = ({ data }) => {
    const maxVal = Math.max(...data.map(d => d.val), 0.5);
    return (
        <div className="h-full min-h-[180px] flex items-end justify-between gap-3 px-2 w-full">
            {data.map((day, i) => (
                <div key={i} className="flex flex-col items-center flex-1 h-full justify-end group">
                    <div className="relative w-full flex items-end justify-center h-full">
                        <div className="absolute bottom-0 w-2 bg-zinc-100 dark:bg-zinc-800 h-full rounded-full opacity-30"></div>
                        <motion.div
                            initial={{ height: 0 }}
                            animate={{ height: day.val > 0 ? `${(day.val / maxVal) * 100}%` : '6px' }}
                            className={`w-full max-w-[14px] rounded-full z-10 transition-all ${day.val > 0 ? 'bg-red-600 shadow-[0_0_20px_rgba(220,38,38,0.3)]' : 'bg-zinc-300 dark:bg-zinc-700'}`}
                        />
                    </div>
                    <span className={`text-[10px] mt-3 font-black uppercase tracking-tighter ${day.isToday ? 'text-red-600' : 'text-zinc-500'}`}>{day.shortDate}</span>
                </div>
            ))}
        </div>
    );
};

function DisciplinaDetalheModal({ disciplina, registrosEstudo, onClose }) {

    const { stats, tabelaAssuntos, chartData } = useMemo(() => {
        if (!disciplina) return { stats: {}, tabelaAssuntos: [], chartData: [] };

        const registrosDaDisciplina = registrosEstudo.filter(r => r.disciplinaId === disciplina.id);
        const totalMinutes = registrosDaDisciplina.reduce((sum, r) => sum + (r.tempoEstudadoMinutos || 0), 0);
        const totalQuestions = registrosDaDisciplina.reduce((sum, r) => sum + (r.questoesFeitas || 0), 0);
        const totalCorrect = registrosDaDisciplina.reduce((sum, r) => sum + (r.acertos || 0), 0);

        const mapaRegistros = {};
        const daysMap = {};

        registrosDaDisciplina.forEach(reg => {
            const nome = reg.assunto || 'Geral';
            if (!mapaRegistros[nome]) mapaRegistros[nome] = { tempo: 0, questoes: 0, acertos: 0 };
            mapaRegistros[nome].tempo += (reg.tempoEstudadoMinutos || 0);
            mapaRegistros[nome].questoes += (reg.questoesFeitas || 0);
            mapaRegistros[nome].acertos += (reg.acertos || 0);

            const dateKey = typeof reg.data === 'string' ? reg.data.split('T')[0] : new Date().toISOString().split('T')[0];
            daysMap[dateKey] = (daysMap[dateKey] || 0) + (reg.tempoEstudadoMinutos || 0);
        });

        const cData = [];
        for (let i = 6; i >= 0; i--) {
            const d = new Date(); d.setDate(d.getDate() - i);
            const dateStr = d.toISOString().split('T')[0];
            cData.push({
                shortDate: d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
                val: (daysMap[dateStr] || 0) / 60,
                isToday: i === 0
            });
        }

        const listaOficial = Array.isArray(disciplina.assuntos) ? disciplina.assuntos : [];
        const todosNomes = Array.from(new Set([...listaOficial.map(a => typeof a === 'object' ? a.nome : a), ...Object.keys(mapaRegistros)]));

        const tabela = todosNomes.map(nome => {
            const reg = mapaRegistros[nome] || { tempo: 0, questoes: 0, acertos: 0 };
            return { nome, ...reg, estudado: reg.tempo > 0 || reg.questoes > 0 };
        }).sort((a, b) => b.tempo - a.tempo);

        return {
            stats: { totalHours: formatDecimalHours(totalMinutes), totalQuestions, performance: totalQuestions > 0 ? ((totalCorrect / totalQuestions) * 100).toFixed(0) : 0 },
            tabelaAssuntos: tabela,
            chartData: cData
        };
    }, [registrosEstudo, disciplina]);

    if (!disciplina) return null;

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="fixed inset-0 bg-black/95 z-[70] backdrop-blur-md flex items-center justify-center p-2 sm:p-6"
                onClick={onClose}
            >
                <motion.div
                    initial={{ scale: 0.98, opacity: 0, y: 10 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.98, opacity: 0, y: 10 }}
                    className="relative w-full max-w-6xl max-h-[96vh] bg-zinc-50 dark:bg-zinc-950 rounded-[3rem] shadow-2xl border border-zinc-200 dark:border-zinc-800 flex flex-col overflow-hidden"
                    onClick={(e) => e.stopPropagation()}
                >
                    {/* Header Premium */}
                    <div className="flex-shrink-0 p-8 sm:px-10 flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 bg-white/50 dark:bg-zinc-900/50 backdrop-blur-xl z-10">
                        <div className="flex items-center gap-6">
                            <div className="w-16 h-16 bg-red-600 text-white rounded-[1.5rem] flex items-center justify-center shadow-xl shadow-red-600/20">
                                <Activity size={32} />
                            </div>
                            <div>
                                <p className="text-[10px] font-black text-red-600 uppercase tracking-[0.4em] mb-1">Métricas de Inteligência</p>
                                <h2 className="text-3xl sm:text-4xl font-black text-zinc-900 dark:text-white uppercase tracking-tighter leading-none">
                                    {disciplina.nome}
                                </h2>
                            </div>
                        </div>
                        <button onClick={onClose} className="p-4 rounded-3xl bg-zinc-100 dark:bg-zinc-800 text-zinc-500 hover:text-red-600 transition-all hover:scale-110">
                            <X size={28} />
                        </button>
                    </div>

                    <div className="flex-1 overflow-y-auto custom-scrollbar p-8 sm:p-10 z-10 space-y-10">

                        {/* Seção Superior Expandida */}
                        <div className="flex flex-col lg:flex-row gap-6">

                            {/* Coluna Lateral de Métricas (25% aprox) */}
                            <div className="lg:w-[280px] flex flex-col gap-4 shrink-0">
                                <CompactStatCard icon={Clock} label="Foco Total" value={stats.totalHours} unit="HORAS" colorClass="text-amber-500" borderColor="bg-amber-500" />
                                <CompactStatCard icon={Target} label="Questões" value={stats.totalQuestions} unit="FEITAS" colorClass="text-emerald-500" borderColor="bg-emerald-500" />
                                <CompactStatCard icon={Trophy} label="Precisão" value={stats.performance} unit="%" colorClass="text-red-500" borderColor="bg-red-600" />
                            </div>

                            {/* Coluna Central do Gráfico (75% aprox) */}
                            <div className="flex-1 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-[2.5rem] p-8 shadow-sm relative flex flex-col overflow-hidden">
                                <div className="flex items-center justify-between mb-8">
                                    <div className="flex items-center gap-3">
                                        <TrendingUp size={20} className="text-red-500" />
                                        <span className="text-sm font-black uppercase text-zinc-800 dark:text-zinc-200 tracking-widest">Ritmo Diário de Estudo</span>
                                    </div>
                                    <div className="px-4 py-1.5 bg-zinc-100 dark:bg-zinc-800 rounded-full border border-zinc-200 dark:border-zinc-700">
                                        <span className="text-[10px] font-bold text-zinc-500">RELATÓRIO DOS ÚLTIMOS 7 DIAS</span>
                                    </div>
                                </div>
                                <div className="flex-1">
                                    <ActivityChart data={chartData} />
                                </div>
                            </div>
                        </div>

                        {/* Tabela de Tópicos do Edital */}
                        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-[2.5rem] overflow-hidden shadow-sm">
                            <div className="p-8 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between bg-zinc-50/50 dark:bg-zinc-900/50">
                                <h3 className="text-sm font-black text-zinc-500 uppercase tracking-widest flex items-center gap-2">
                                    <BarChart2 size={20} className="text-red-600" /> Cobertura Técnica por Assunto
                                </h3>
                                <span className="text-[10px] font-black text-zinc-400 bg-zinc-200 dark:bg-zinc-800 px-4 py-1.5 rounded-full uppercase tracking-tighter">
                                    {tabelaAssuntos.length} tópicos rastreados
                                </span>
                            </div>

                            <div className="overflow-x-auto">
                                <table className="w-full text-left border-collapse">
                                    <thead>
                                        <tr className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em] bg-zinc-50/30 dark:bg-black/20">
                                            <th className="px-10 py-6">Assunto / Edital</th>
                                            <th className="px-6 py-6 text-center">Tempo Gasto</th>
                                            <th className="px-6 py-6 text-center">Questões</th>
                                            <th className="px-10 py-6 text-right">Performance</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                                        {tabelaAssuntos.map((assunto, idx) => {
                                            const perc = assunto.questoes > 0 ? Math.round((assunto.acertos / assunto.questoes) * 100) : 0;
                                            const barColor = perc >= 75 ? 'bg-emerald-500' : perc >= 50 ? 'bg-amber-500' : 'bg-red-500';

                                            return (
                                                <tr key={idx} className={`group transition-colors ${!assunto.estudado ? 'opacity-40 grayscale-[0.4]' : 'hover:bg-zinc-50 dark:hover:bg-zinc-800/50'}`}>
                                                    <td className="px-10 py-6">
                                                        <div className="flex flex-col gap-1">
                                                            <span className={`text-sm font-bold leading-tight ${assunto.estudado ? 'text-zinc-800 dark:text-zinc-100' : 'text-zinc-500 italic'}`}>
                                                                {assunto.nome}
                                                            </span>
                                                            {!assunto.estudado && (
                                                                <span className="text-[9px] font-black text-red-500/70 uppercase tracking-tighter flex items-center gap-1"><AlertCircle size={10}/> Pendente</span>
                                                            )}
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-6 text-center">
                                                        <span className={`text-xs font-mono font-bold ${assunto.estudado ? 'text-zinc-600 dark:text-zinc-400' : 'text-zinc-300'}`}>
                                                            {formatTimeShort(assunto.tempo)}
                                                        </span>
                                                    </td>
                                                    <td className="px-6 py-6 text-center text-sm font-bold text-zinc-400">
                                                        {assunto.questoes || '--'}
                                                    </td>
                                                    <td className="px-10 py-6 text-right">
                                                        <div className="flex items-center justify-end gap-4">
                                                            <div className="flex-1 h-1.5 max-w-[80px] bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden hidden sm:block">
                                                                {assunto.estudado && <div style={{ width: `${perc}%` }} className={`h-full ${barColor}`} />}
                                                            </div>
                                                            <span className={`text-xs font-black w-10 ${assunto.estudado ? (perc >= 50 ? 'text-zinc-700 dark:text-zinc-300' : 'text-red-500') : 'text-zinc-300'}`}>
                                                                {perc}%
                                                            </span>
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                    {/* Marca d'água de fundo gigante para fechar o visual */}
                    <div className="absolute -bottom-20 -left-20 p-10 opacity-[0.01] dark:opacity-[0.02] pointer-events-none transform rotate-45">
                        <BookOpen size={600} strokeWidth={1} />
                    </div>
                </motion.div>
            </motion.div>
        </AnimatePresence>
    );
}

export default DisciplinaDetalheModal;