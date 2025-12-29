import React, { useMemo, useState, useEffect } from 'react';
import {
    ResponsiveContainer,
    ComposedChart,
    Line,
    Area,
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Cell
} from 'recharts';
import {
    TrendingUp,
    Target,
    Clock,
    Activity,
    ChevronDown,
    Filter,
    List,
    Calendar,
    CheckCircle2,
    XCircle,
    AlertTriangle,
    CalendarDays
} from 'lucide-react';
import {
    format,
    parseISO,
    startOfToday,
    subDays,
    eachDayOfInterval
} from 'date-fns';

// IMPORTA O GRÁFICO DE PIZZA
import DesempenhoGrafico from '../components/dashboard/DesempenhoGrafico';

// ============================================================================
// 1. CONFIGURAÇÕES & UTILS
// ============================================================================

const TIME_RANGES = [
    { id: '7D', label: '7 Dias' },
    { id: '15D', label: '15 Dias' },
    { id: '30D', label: '30 Dias' },
    { id: 'CYCLE', label: 'Ciclo Total' }
];

const formatTime = (minutes) => {
    if (!minutes || isNaN(minutes)) return '0h 0m';
    const h = Math.floor(minutes / 60);
    const m = Math.round(minutes % 60);
    return `${h}h ${m}m`;
};

// ============================================================================
// 2. COMPONENTES VISUAIS
// ============================================================================

const PerformanceMetricCard = ({ title, value, subValue, icon: Icon, color }) => {

    // Configuração de Cores
    const colorStyles = {
        blue: {
            iconBg: 'bg-blue-50 dark:bg-blue-900/20',
            iconColor: 'text-blue-600 dark:text-blue-400',
            watermark: 'text-blue-600'
        },
        violet: {
            iconBg: 'bg-violet-50 dark:bg-violet-900/20',
            iconColor: 'text-violet-600 dark:text-violet-400',
            watermark: 'text-violet-600'
        },
        emerald: {
            iconBg: 'bg-emerald-50 dark:bg-emerald-900/20',
            iconColor: 'text-emerald-600 dark:text-emerald-400',
            watermark: 'text-emerald-600'
        },
        red: {
            iconBg: 'bg-red-50 dark:bg-red-900/20',
            iconColor: 'text-red-600 dark:text-red-400',
            watermark: 'text-red-600'
        },
    };

    const style = colorStyles[color] || colorStyles.blue;

    return (
        <div className="relative overflow-hidden bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5 flex flex-col justify-between shadow-sm hover:border-zinc-300 dark:hover:border-zinc-700 transition-all duration-300 group min-h-[140px]">

            {/* MARCA D'ÁGUA (Mais visível no light mode conforme pedido) */}
            <Icon
                className={`absolute -bottom-4 -right-4 w-28 h-28 opacity-[0.08] dark:opacity-[0.04] pointer-events-none transform -rotate-12 transition-transform duration-500 group-hover:scale-110 group-hover:-rotate-6 ${style.watermark}`}
            />

            <div className="flex justify-between items-start mb-4 relative z-10">
                <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 mb-1">{title}</p>
                    <h3 className="text-2xl lg:text-3xl font-black text-zinc-900 dark:text-white tracking-tighter leading-none">
                        {value}
                    </h3>
                </div>
                <div className={`p-3 rounded-xl ${style.iconBg} ${style.iconColor} group-hover:scale-110 transition-transform`}>
                    <Icon size={20} strokeWidth={2.5} />
                </div>
            </div>

            <div className="relative z-10 mt-auto">
                <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 flex items-center gap-1.5">
                    {subValue}
                </p>
            </div>
        </div>
    );
};

const CardContainer = ({ title, subtitle, icon: Icon, children, className = "" }) => (
    <div className={`bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-sm p-5 md:p-6 flex flex-col ${className}`}>
        <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-zinc-100 dark:bg-zinc-900 rounded-lg text-zinc-500 dark:text-zinc-400">
                <Icon size={18} strokeWidth={2.5} />
            </div>
            <div>
                <h3 className="text-sm font-extrabold text-zinc-900 dark:text-white uppercase tracking-tight">
                    {title}
                </h3>
                {subtitle && <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">{subtitle}</p>}
            </div>
        </div>
        <div className="flex-1 w-full min-h-0 relative">
            {children}
        </div>
    </div>
);

const AnalyticsTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
        return (
            <div className="bg-zinc-900/95 backdrop-blur-md border border-zinc-700 p-3 rounded-lg shadow-2xl text-xs z-50 min-w-[150px]">
                <p className="font-bold text-zinc-300 uppercase mb-2 border-b border-zinc-700 pb-1 tracking-wider">
                    {label}
                </p>
                {payload.map((entry, index) => (
                    <div key={index} className="flex items-center justify-between gap-4 mb-1.5 last:mb-0">
                        <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full shadow-sm" style={{ backgroundColor: entry.color || entry.fill }} />
                            <span className="font-medium text-zinc-100">{entry.name}</span>
                        </div>
                        <span className="font-mono font-bold text-white">
                            {typeof entry.value === 'number' ? entry.value.toLocaleString('pt-BR') : entry.value}
                            <span className="text-zinc-500 text-[9px] ml-0.5">{entry.unit}</span>
                        </span>
                    </div>
                ))}
            </div>
        );
    }
    return null;
};

const CustomSelect = ({ value, onChange, options, placeholder, icon: Icon, disabled = false }) => (
    <div className={`relative group ${disabled ? 'opacity-50 pointer-events-none' : ''}`}>
        {Icon && <Icon size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 z-10" />}
        <select
            value={value}
            onChange={(e) => onChange(e.target.value)}
            disabled={disabled}
            className={`
                appearance-none w-full bg-white dark:bg-zinc-950
                border border-zinc-200 dark:border-zinc-800
                text-zinc-700 dark:text-zinc-300 text-xs font-bold uppercase tracking-wide
                py-2.5 ${Icon ? 'pl-9' : 'pl-3'} pr-8 rounded-xl
                focus:outline-none focus:ring-2 focus:ring-red-500/50 focus:border-red-500 transition-all cursor-pointer
                hover:border-zinc-300 dark:hover:border-zinc-700
            `}
        >
            <option value="ALL">{placeholder || 'Selecione'}</option>
            {options.map((opt) => (
                <option key={opt} value={opt}>{opt}</option>
            ))}
        </select>
        <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none" />
    </div>
);

// ============================================================================
// 3. COMPONENTE PRINCIPAL
// ============================================================================

const PerformanceHub = ({ registrosEstudo = [], activeCicloId, disciplinasDoCiclo = [] }) => {
    const [timeRange, setTimeRange] = useState('30D');
    const [selectedDiscipline, setSelectedDiscipline] = useState('ALL');
    const [selectedTopic, setSelectedTopic] = useState('ALL');

    // --- DATA ENGINE ---
    const analytics = useMemo(() => {
        if (!activeCicloId) return null;

        // 1. Filtro Temporal
        const today = startOfToday();
        let startDate;
        let daysInPeriod = 30; // Default

        if (timeRange === '7D') { startDate = subDays(today, 7); daysInPeriod = 7; }
        else if (timeRange === '15D') { startDate = subDays(today, 15); daysInPeriod = 15; }
        else if (timeRange === '30D') { startDate = subDays(today, 30); daysInPeriod = 30; }
        else { daysInPeriod = 90; } // Cycle fallback approximation

        // Filtra registros do ciclo ativo
        let filteredRecords = registrosEstudo.filter(r => r.cicloId === activeCicloId);

        if (startDate) {
            filteredRecords = filteredRecords.filter(r => r.data && parseISO(r.data) >= startDate);
        }

        // 2. Filtro de Disciplina
        let disciplinesAvailable = [];
        if (disciplinasDoCiclo && disciplinasDoCiclo.length > 0) {
            disciplinesAvailable = disciplinasDoCiclo.map(d => d.nome).sort();
        } else {
            disciplinesAvailable = [...new Set(filteredRecords.map(r => r.disciplinaNome).filter(Boolean))].sort();
        }

        if (selectedDiscipline !== 'ALL') {
            filteredRecords = filteredRecords.filter(r => r.disciplinaNome === selectedDiscipline);
        }

        // 3. Filtro de Assunto
        let topicsAvailable = [];
        if (selectedDiscipline !== 'ALL') {
            const discData = disciplinasDoCiclo.find(d => d.nome === selectedDiscipline);
            if (discData && discData.assuntos) {
                topicsAvailable = discData.assuntos.map(a => (typeof a === 'object' ? (a.nome || a.texto || '') : a)).filter(Boolean);
            }
            const recordedTopics = filteredRecords.map(r => r.assunto).filter(Boolean);
            topicsAvailable = [...new Set([...topicsAvailable, ...recordedTopics])].sort();
        } else {
            topicsAvailable = [...new Set(filteredRecords.map(r => r.assunto).filter(Boolean))].sort();
        }

        if (selectedTopic !== 'ALL' && selectedDiscipline !== 'ALL') {
            filteredRecords = filteredRecords.filter(r => r.assunto === selectedTopic);
        }

        // 4. Agregação de Dados
        let totalTime = 0;
        let totalQuestions = 0;
        let totalCorrect = 0;
        const datesMap = {};
        const topicsMap = {};

        // NOVO: Cálculo de Dias Únicos Estudados
        const uniqueDaysStudied = new Set();

        filteredRecords.forEach(r => {
            const t = Number(r.tempoEstudadoMinutos) || 0;
            const q = Number(r.questoesFeitas) || 0;
            const c = Number(r.acertos) || 0;
            const d = r.data;
            const subj = r.disciplinaNome || 'Geral';
            const topic = r.assunto || 'Geral';

            // Só conta se houve atividade real (tempo ou questão)
            if (t > 0 || q > 0) {
                totalTime += t;
                totalQuestions += q;
                totalCorrect += c;
                if (d) {
                    uniqueDaysStudied.add(d);
                    if (!datesMap[d]) datesMap[d] = { time: 0, q: 0, c: 0 };
                    datesMap[d].time += t;
                    datesMap[d].q += q;
                    datesMap[d].c += c;
                }
            }

            const topicKey = `${subj} - ${topic}`;
            if (!topicsMap[topicKey]) topicsMap[topicKey] = { disciplina: subj, assunto: topic, time: 0, q: 0, c: 0 };
            topicsMap[topicKey].time += t;
            topicsMap[topicKey].q += q;
            topicsMap[topicKey].c += c;
        });

        const accuracy = totalQuestions > 0 ? (totalCorrect / totalQuestions) * 100 : 0;
        const daysCount = uniqueDaysStudied.size;
        const consistency = daysInPeriod > 0 ? (daysCount / daysInPeriod) * 100 : 0;

        let evolutionData = [];
        if (startDate) {
            const interval = eachDayOfInterval({ start: startDate, end: today });
            evolutionData = interval.map(day => {
                const dKey = format(day, 'yyyy-MM-dd');
                const dData = datesMap[dKey] || { time: 0, q: 0, c: 0 };
                return {
                    date: format(day, 'dd/MM'),
                    timeHours: Number((dData.time / 60).toFixed(1)),
                    accuracy: dData.q > 0 ? Math.round((dData.c / dData.q) * 100) : 0
                };
            });
        }

        const weakTopics = Object.values(topicsMap)
            .filter(t => t.q >= 3)
            .map(t => ({
                name: t.assunto.length > 20 ? t.assunto.substring(0, 20) + '...' : t.assunto,
                fullTopic: t.assunto,
                discipline: t.disciplina,
                accuracy: Math.round((t.c / t.q) * 100),
                volume: t.q
            }))
            .sort((a, b) => a.accuracy - b.accuracy)
            .slice(0, 5);

        return {
            kpis: { totalTime, totalQuestions, totalCorrect, accuracy, daysCount, consistency },
            evolutionData,
            weakTopics,
            tableData: Object.values(topicsMap).sort((a, b) => b.time - a.time),
            disciplinesAvailable,
            topicsAvailable
        };

    }, [registrosEstudo, activeCicloId, timeRange, selectedDiscipline, selectedTopic, disciplinasDoCiclo]);

    useEffect(() => {
        setSelectedTopic('ALL');
    }, [selectedDiscipline]);


    if (!activeCicloId) return <div className="p-10 text-center text-zinc-500">Selecione um ciclo para ver os dados.</div>;
    if (!analytics) return <div className="p-10 text-center text-zinc-500">Carregando análise...</div>;

    return (
        <div className="w-full pb-20 animate-slide-up space-y-6">

            {/* HEADER COM FILTROS NO TOPO */}
            <header className="flex flex-col lg:flex-row justify-between items-start lg:items-end gap-4 border-b border-zinc-200 dark:border-zinc-800 pb-4">
                <div>
                    <h1 className="text-2xl md:text-3xl font-black text-zinc-900 dark:text-white uppercase tracking-tighter flex items-center gap-2">
                        Desempenho
                    </h1>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 w-full lg:w-auto">
                    {/* Filtro Tempo */}
                    <div className="w-full min-w-[100px]">
                        <label className="block text-[9px] font-bold uppercase text-zinc-400 mb-1 ml-1">Período</label>
                        <div className="relative">
                            <select
                                value={timeRange}
                                onChange={(e) => setTimeRange(e.target.value)}
                                className="appearance-none w-full bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 text-xs font-bold uppercase py-2 pl-3 pr-8 rounded-lg cursor-pointer hover:bg-zinc-200 dark:hover:bg-zinc-800 transition-colors focus:outline-none"
                            >
                                {TIME_RANGES.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
                            </select>
                            <Calendar size={12} className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none"/>
                        </div>
                    </div>

                    {/* Filtro Disciplina */}
                    <div className="w-full min-w-[140px] col-span-1 md:col-span-2">
                        <label className="block text-[9px] font-bold uppercase text-zinc-400 mb-1 ml-1">Disciplina</label>
                        <CustomSelect
                            value={selectedDiscipline}
                            onChange={setSelectedDiscipline}
                            options={analytics.disciplinesAvailable}
                            placeholder="Todas as Disciplinas"
                            icon={Filter}
                        />
                    </div>

                    {/* Filtro Assunto */}
                    <div className="w-full min-w-[140px] col-span-2 md:col-span-1">
                        <label className="block text-[9px] font-bold uppercase text-zinc-400 mb-1 ml-1">Assunto</label>
                        <CustomSelect
                            value={selectedTopic}
                            onChange={setSelectedTopic}
                            options={analytics.topicsAvailable}
                            placeholder="Todos"
                            disabled={selectedDiscipline === 'ALL'}
                            icon={List}
                        />
                    </div>
                </div>
            </header>

            {/* KPI CARDS (Com Marca D'água e sem barra de progresso) */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">

                {/* 1. Tempo (Azul) */}
                <PerformanceMetricCard
                    color="blue"
                    icon={Clock}
                    title="Tempo Líquido"
                    value={formatTime(analytics.kpis.totalTime)} // Formato Xh Ym
                    subValue={analytics.kpis.totalTime > 0 ? "Registrado no período" : "Sem registros"}
                />

                {/* 2. Questões (Roxo) */}
                <PerformanceMetricCard
                    color="violet"
                    icon={Target}
                    title="Questões Totais"
                    value={analytics.kpis.totalQuestions}
                    subValue={`${analytics.kpis.totalCorrect} Acertos`}
                />

                {/* 3. Precisão (Verde) */}
                <PerformanceMetricCard
                    color="emerald"
                    icon={TrendingUp}
                    title="Precisão Global"
                    value={`${analytics.kpis.accuracy.toFixed(0)}%`}
                    subValue="Taxa de acertos"
                />

                {/* 4. Constância (Vermelho) */}
                <PerformanceMetricCard
                    color="red"
                    icon={CalendarDays}
                    title="Dias Estudados"
                    value={analytics.kpis.daysCount}
                    subValue="Neste filtro"
                />
            </div>

            {/* ÁREA DE GRÁFICOS */}
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">

                {/* 1. GRÁFICO DE DISTRIBUIÇÃO (PIZZA) */}
                <div className="xl:col-span-1 min-h-[300px]">
                    <DesempenhoGrafico registrosEstudo={registrosEstudo.filter(r => r.cicloId === activeCicloId)} />
                </div>

                {/* 2. Evolução Temporal */}
                <CardContainer
                    title="Evolução de Desempenho"
                    subtitle="Correlação entre Horas e Precisão"
                    icon={Activity}
                    className="xl:col-span-2 min-h-[300px]"
                >
                    <ResponsiveContainer width="100%" height="100%">
                        <ComposedChart data={analytics.evolutionData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                            <defs>
                                <linearGradient id="colorHours" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#dc2626" stopOpacity={0.2}/>
                                    <stop offset="95%" stopColor="#dc2626" stopOpacity={0}/>
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e4e4e7" strokeOpacity={0.5} />
                            <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#a1a1aa', fontWeight: 600 }} dy={10} />
                            <YAxis yAxisId="left" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#a1a1aa' }} />
                            <YAxis yAxisId="right" orientation="right" axisLine={false} tickLine={false} unit="%" domain={[0, 100]} tick={{ fontSize: 10, fill: '#a1a1aa' }} />
                            <Tooltip content={<AnalyticsTooltip />} cursor={{ stroke: '#ef4444', strokeWidth: 1, strokeDasharray: '4 4' }} />
                            <Area yAxisId="left" type="monotone" dataKey="timeHours" name="Horas" stroke="#dc2626" strokeWidth={3} fill="url(#colorHours)" />
                            <Line yAxisId="right" type="monotone" dataKey="accuracy" name="Precisão" stroke="#71717a" strokeWidth={2} dot={{r:3}} />
                        </ComposedChart>
                    </ResponsiveContainer>
                </CardContainer>

                {/* 3. Pontos de Atenção (Gráfico Negativo) */}
                <CardContainer
                    title="Pontos de Atenção"
                    subtitle="Tópicos com menor precisão (Min. 3 questões)"
                    icon={AlertTriangle}
                    className="xl:col-span-3 min-h-[300px]"
                >
                    <div className="h-full w-full">
                        {analytics.weakTopics.length > 0 ? (
                            <ResponsiveContainer width="100%" height={250}>
                                <BarChart layout="vertical" data={analytics.weakTopics} margin={{ left: 0, right: 20 }}>
                                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e4e4e7" strokeOpacity={0.5} />
                                    <XAxis type="number" domain={[0, 100]} hide />
                                    <YAxis type="category" dataKey="name" width={150} tick={{fontSize: 10, fill: '#71717a', fontWeight: 'bold'}} />
                                    <Tooltip
                                        cursor={{fill: 'transparent'}}
                                        content={({ active, payload }) => {
                                            if (active && payload && payload.length) {
                                                const data = payload[0].payload;
                                                return (
                                                    <div className="bg-zinc-900 text-white text-xs p-2 rounded shadow-lg border border-zinc-700">
                                                        <p className="font-bold mb-1">{data.fullTopic}</p>
                                                        <p className="text-zinc-400">{data.discipline}</p>
                                                        <p className="text-red-400 font-bold mt-1">Precisão: {data.accuracy}%</p>
                                                        <p className="text-zinc-500">Vol: {data.volume} questões</p>
                                                    </div>
                                                );
                                            }
                                            return null;
                                        }}
                                    />
                                    <Bar dataKey="accuracy" radius={[0, 4, 4, 0]} barSize={20}>
                                        {analytics.weakTopics.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={entry.accuracy < 30 ? '#ef4444' : '#f97316'} />
                                        ))}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="h-full flex flex-col items-center justify-center text-zinc-400 text-center p-4 opacity-60">
                                <CheckCircle2 size={32} className="mb-2 text-emerald-500" />
                                <p className="text-xs">Sem pontos críticos detectados neste filtro.</p>
                            </div>
                        )}
                    </div>
                </CardContainer>
            </div>

            {/* TABELA DETALHADA */}
            <div className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-sm overflow-hidden">
                <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50 flex items-center gap-2">
                    <List size={16} className="text-zinc-500"/>
                    <h3 className="text-xs font-bold uppercase text-zinc-500">Detalhamento Completo</h3>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="border-b border-zinc-100 dark:border-zinc-800">
                                <th className="px-4 py-3 text-[10px] font-black uppercase text-zinc-400">Tópico</th>
                                <th className="px-4 py-3 text-center text-[10px] font-black uppercase text-zinc-400">Tempo</th>
                                <th className="px-4 py-3 text-center text-[10px] font-black uppercase text-zinc-400">Questões</th>
                                <th className="px-4 py-3 text-right text-[10px] font-black uppercase text-zinc-400">Performance</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/50">
                            {analytics.tableData.map((row, i) => {
                                const acc = row.q > 0 ? Math.round((row.c / row.q) * 100) : 0;
                                let colorClass = 'bg-red-500';
                                if (acc >= 60) colorClass = 'bg-amber-500';
                                if (acc >= 80) colorClass = 'bg-emerald-500';

                                return (
                                    <tr key={i} className="hover:bg-zinc-50 dark:hover:bg-zinc-900/50 transition-colors">
                                        <td className="px-4 py-3">
                                            <div className="flex flex-col">
                                                <span className="text-[10px] font-bold text-zinc-400 uppercase">{row.disciplina}</span>
                                                <span className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">{row.assunto}</span>
                                            </div>
                                        </td>
                                        <td className="px-4 py-3 text-center text-xs font-mono text-zinc-600 dark:text-zinc-400">
                                            {formatTime(row.time)}
                                        </td>
                                        <td className="px-4 py-3 text-center text-xs font-bold text-zinc-700 dark:text-zinc-300">
                                            {row.q}
                                        </td>
                                        <td className="px-4 py-3 text-right">
                                            <div className="flex items-center justify-end gap-2">
                                                <div className="w-12 h-1.5 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                                                    <div className={`h-full ${colorClass}`} style={{width: `${acc}%`}}></div>
                                                </div>
                                                <span className="text-xs font-bold w-8">{acc}%</span>
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
    );
};

export default PerformanceHub;