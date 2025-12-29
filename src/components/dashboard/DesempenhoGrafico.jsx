import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Sector } from 'recharts';
import { X, Clock, Target, Calendar, Maximize2, BarChart2, ListFilter, Filter, ChevronDown, AlertCircle } from 'lucide-react';
import { format, subDays, startOfWeek, startOfMonth, startOfYear, parseISO, startOfToday, endOfDay } from 'date-fns';

// --- CORES VIBRANTES ---
const COLORS = [
    '#10b981', '#3b82f6', '#f59e0b', '#ef4444',
    '#8b5cf6', '#ec4899', '#6366f1', '#14b8a6', '#f97316'
];

// --- UTILITÁRIOS ---
const formatValue = (value, type) => {
    if (type === 'hours') {
        const h = Math.floor(value / 60);
        const m = Math.round(value % 60);
        if (h === 0) return `${m}m`;
        return `${h}h${m > 0 ? `${m}m` : ''}`;
    }
    return `${value}`;
};

// --- RENDERIZADORES ---
const renderActiveShape = (props) => {
    const { cx, cy, innerRadius, outerRadius, startAngle, endAngle, fill } = props;
    return (
        <g>
            <Sector
                cx={cx} cy={cy} innerRadius={innerRadius} outerRadius={outerRadius + 6}
                startAngle={startAngle} endAngle={endAngle} fill={fill}
                className="drop-shadow-lg transition-all duration-300"
            />
            <Sector
                cx={cx} cy={cy} startAngle={startAngle} endAngle={endAngle}
                innerRadius={outerRadius + 8} outerRadius={outerRadius + 12}
                fill={fill} opacity={0.3}
            />
        </g>
    );
};

const CustomTooltip = ({ active, payload, type }) => {
    if (active && payload && payload.length) {
        const data = payload[0].payload;
        return (
            <div className="bg-zinc-900/90 backdrop-blur-xl border border-zinc-700/50 p-3 rounded-xl shadow-2xl text-xs z-50">
                <div className="flex items-center gap-2 mb-1">
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: data.fill }}></div>
                    <span className="font-bold text-white">{data.name}</span>
                </div>
                <div className="flex justify-between gap-4 text-zinc-400">
                    <span className="font-mono font-bold text-zinc-200">{formatValue(data.value, type)}</span>
                    <span className="font-mono font-bold text-emerald-400">{data.percent.toFixed(1)}%</span>
                </div>
            </div>
        );
    }
    return null;
};

// --- COMPONENTES UI AUXILIARES (RESPONSIVO) ---
const FilterControls = ({ period, setPeriod, metric, setMetric, customStart, setCustomStart, customEnd, setCustomEnd, periodLabels, totals, compact = false }) => (
    <div className={`flex flex-wrap items-center gap-2 w-full md:w-auto ${compact ? 'text-xs' : 'text-sm'}`}>

        {/* Toggle Métrica */}
        <div className="bg-zinc-100 dark:bg-zinc-900 p-1 rounded-xl flex border border-zinc-200 dark:border-zinc-800 shrink-0 shadow-inner flex-1 md:flex-none justify-center">
            <button
                onClick={() => setMetric('hours')}
                className={`
                    flex-1 md:flex-none justify-center px-2 md:px-3 py-1.5 md:py-2 rounded-lg transition-all flex items-center gap-1.5 md:gap-2
                    ${metric === 'hours'
                        ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/30 ring-1 ring-indigo-500'
                        : 'text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200 hover:bg-zinc-200/50 dark:hover:bg-zinc-800'}
                `}
                title="Horas"
            >
                <Clock size={compact ? 14 : 16} className="w-3.5 h-3.5 md:w-4 md:h-4" strokeWidth={2.5}/>
                <span className="font-bold uppercase text-[10px] md:text-xs">Horas</span>
            </button>
            <button
                onClick={() => setMetric('questions')}
                className={`
                    flex-1 md:flex-none justify-center px-2 md:px-3 py-1.5 md:py-2 rounded-lg transition-all flex items-center gap-1.5 md:gap-2
                    ${metric === 'questions'
                        ? 'bg-emerald-600 text-white shadow-md shadow-emerald-500/30 ring-1 ring-emerald-500'
                        : 'text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200 hover:bg-zinc-200/50 dark:hover:bg-zinc-800'}
                `}
                title="Questões"
            >
                <Target size={compact ? 14 : 16} className="w-3.5 h-3.5 md:w-4 md:h-4" strokeWidth={2.5}/>
                <span className="font-bold uppercase text-[10px] md:text-xs">Questões</span>
            </button>
        </div>

        {/* Select Período */}
        <div className="relative flex-1 md:flex-none min-w-[110px] md:min-w-[140px]">
            <select
                value={period}
                onChange={(e) => setPeriod(e.target.value)}
                className={`
                    w-full appearance-none bg-white dark:bg-zinc-900
                    border-2 border-zinc-200 dark:border-zinc-700
                    font-black text-zinc-700 dark:text-zinc-200 uppercase tracking-wide
                    pl-8 md:pl-9 pr-7 md:pr-8 rounded-xl outline-none
                    focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500
                    transition-all cursor-pointer hover:border-zinc-300 dark:hover:border-zinc-600
                    py-1.5 text-[10px] md:py-2.5 md:text-xs truncate
                `}
            >
                {Object.entries(periodLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
            </select>
            <Filter size={12} className="absolute left-2.5 md:left-3 top-1/2 -translate-y-1/2 text-indigo-500 pointer-events-none w-3 h-3 md:w-3.5 md:h-3.5" strokeWidth={2.5}/>
            <ChevronDown size={12} className="absolute right-2 md:right-3 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none w-3 h-3 md:w-3.5 md:h-3.5" strokeWidth={2.5}/>
        </div>

        {/* Data Personalizada */}
        {period === 'CUSTOM' && (
            <div className="flex gap-2 animate-fade-in w-full md:w-auto mt-1 md:mt-0">
                <input type="date" value={customStart} onChange={e => setCustomStart(e.target.value)} className="w-full md:w-auto bg-white dark:bg-zinc-900 border-2 border-zinc-200 dark:border-zinc-700 rounded-xl font-bold text-zinc-700 dark:text-zinc-300 outline-none focus:border-indigo-500 p-1.5 text-[10px] md:p-2 md:text-xs" />
                <input type="date" value={customEnd} onChange={e => setCustomEnd(e.target.value)} className="w-full md:w-auto bg-white dark:bg-zinc-900 border-2 border-zinc-200 dark:border-zinc-700 rounded-xl font-bold text-zinc-700 dark:text-zinc-300 outline-none focus:border-indigo-500 p-1.5 text-[10px] md:p-2 md:text-xs" />
            </div>
        )}
    </div>
);

// --- MODAL EXPANDIDO ---
const ExpandedChartModal = ({ data, type, totals, periodLabel, onClose, filterProps }) => {
    const [hoveredIndex, setHoveredIndex] = useState(null);
    const [selectedItem, setSelectedItem] = useState(null);
    const handleSelect = (item) => setSelectedItem(prev => (prev?.name === item.name ? null : item));

    const displayValue = selectedItem ? selectedItem.value : (type === 'hours' ? totals.hours : totals.questions);
    const displayLabel = selectedItem ? selectedItem.name : "Total";
    const displayColor = selectedItem ? selectedItem.fill : null;

    const hasData = data && data.length > 0;

    return (
        <div className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in" onClick={onClose}>
            <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                transition={{ type: "spring", bounce: 0.3 }}
                className="bg-zinc-50 dark:bg-zinc-950 w-full max-w-6xl max-h-[95vh] rounded-[2rem] shadow-2xl border border-zinc-200 dark:border-zinc-800 flex flex-col overflow-hidden relative"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header do Modal */}
                <div className="flex flex-col md:flex-row justify-between items-center p-5 border-b border-zinc-200 dark:border-zinc-800 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-md gap-4 shrink-0">
                    <div className="flex items-center gap-3 self-start md:self-auto w-full md:w-auto">
                        <div className="p-2 bg-indigo-100 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 rounded-xl shrink-0">
                            <BarChart2 size={24} strokeWidth={2.5}/>
                        </div>
                        <div className="flex flex-col">
                            <h2 className="text-lg md:text-xl font-black text-zinc-900 dark:text-white uppercase tracking-tight leading-none">Análise Detalhada</h2>
                            <div className="mt-1 self-start inline-flex items-center px-2.5 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-900/30 border border-indigo-100 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 text-[10px] md:text-xs font-black uppercase tracking-wide">
                                {periodLabel}
                            </div>
                        </div>
                        <button onClick={onClose} className="ml-auto md:hidden p-2 text-zinc-400 hover:text-white hover:bg-red-500 rounded-full transition-all">
                            <X size={20} />
                        </button>
                    </div>

                    <div className="w-full md:w-auto flex justify-center md:justify-end">
                        <FilterControls {...filterProps} />
                    </div>

                    <button onClick={onClose} className="hidden md:block p-2 text-zinc-400 hover:text-white hover:bg-red-500 rounded-full transition-all">
                        <X size={24} />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-4 md:p-8 custom-scrollbar bg-zinc-50/50 dark:bg-black/20">
                    {!hasData ? (
                        <div className="flex flex-col items-center justify-center h-full text-center py-10 opacity-60">
                            <div className="p-4 bg-zinc-100 dark:bg-zinc-900 rounded-full mb-3"><AlertCircle size={40} className="text-zinc-400"/></div>
                            <p className="font-bold text-zinc-500 dark:text-zinc-400 text-lg">Sem dados para este filtro.</p>
                            <p className="text-sm text-zinc-400">Tente alterar o período ou a métrica acima.</p>
                        </div>
                    ) : (
                        <div className="flex flex-col lg:flex-row gap-6 lg:gap-12 h-full">
                            {/* COLUNA 1: Gráfico */}
                            <div className="w-full lg:w-5/12 flex flex-col items-center justify-start shrink-0">
                                <div className="w-full h-[220px] sm:h-[300px] lg:h-[350px] relative max-w-[400px]">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <PieChart>
                                            <Pie
                                                data={data}
                                                cx="50%" cy="50%"
                                                innerRadius="60%" outerRadius="85%"
                                                paddingAngle={4}
                                                dataKey="value"
                                                stroke="none"
                                                activeIndex={selectedItem ? data.findIndex(d => d.name === selectedItem.name) : undefined}
                                                activeShape={renderActiveShape}
                                                onClick={(_, index) => handleSelect(data[index])}
                                            >
                                                {data.map((entry, index) => (
                                                    <Cell key={`cell-${index}`} fill={entry.fill} className="transition-all duration-300 cursor-pointer outline-none" fillOpacity={selectedItem && selectedItem.name !== entry.name ? 0.3 : 1}/>
                                                ))}
                                            </Pie>
                                            <Tooltip content={<CustomTooltip type={type} />} />
                                        </PieChart>
                                    </ResponsiveContainer>
                                    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                                        <span className="text-3xl sm:text-4xl font-black text-zinc-800 dark:text-white tracking-tighter transition-all duration-300">
                                            {type === 'hours' ? formatValue(displayValue, 'hours').split(' ')[0] : displayValue}
                                        </span>
                                        <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mt-1 text-center px-4 truncate max-w-[180px]" style={{ color: displayColor || '#a1a1aa' }}>
                                            {displayLabel}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* COLUNA 2: Grid de Disciplinas */}
                            <div className="w-full lg:w-7/12">
                                <div className="flex items-center gap-2 mb-3 text-zinc-400 text-[10px] font-bold uppercase tracking-widest">
                                    <ListFilter size={12} /> Distribuição por Matéria
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-2 gap-3 pb-4">
                                    {data.map((item, idx) => (
                                        <motion.div
                                            initial={{ opacity: 0, y: 10 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            transition={{ delay: idx * 0.03 }}
                                            key={idx}
                                            onClick={() => handleSelect(item)}
                                            className={`
                                                relative overflow-hidden p-3 rounded-xl border transition-all duration-200 cursor-pointer
                                                ${selectedItem?.name === item.name
                                                    ? 'bg-white dark:bg-zinc-800 border-indigo-500/50 shadow-md transform -translate-y-1 ring-1 ring-indigo-500/20'
                                                    : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 opacity-90 hover:opacity-100'}
                                            `}
                                        >
                                            <div className="flex justify-between items-start mb-2">
                                                <div className="flex items-center gap-2 min-w-0">
                                                    <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: item.fill }}></div>
                                                    <h4 className="font-bold text-zinc-700 dark:text-zinc-200 text-xs truncate" title={item.name}>{item.name}</h4>
                                                </div>
                                                <span className="text-xs font-black text-zinc-900 dark:text-white ml-2 shrink-0">{formatValue(item.value, type)}</span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <div className="flex-1 h-1.5 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                                                    <motion.div className="h-full rounded-full" style={{ backgroundColor: item.fill }} initial={{ width: 0 }} animate={{ width: `${item.percent}%` }} transition={{ duration: 1 }} />
                                                </div>
                                                <span className="text-[10px] font-bold text-zinc-400 w-8 text-right">{item.percent.toFixed(0)}%</span>
                                            </div>
                                        </motion.div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </motion.div>
        </div>
    );
};

// --- COMPONENTE PRINCIPAL ---
const DesempenhoGrafico = ({ registrosEstudo }) => {
    // AQUI ESTÁ A MUDANÇA: 'TODAY' -> '7D'
    const [period, setPeriod] = useState('7D');
    const [metric, setMetric] = useState('hours');
    const [isExpanded, setIsExpanded] = useState(false);
    const [activeIndex, setActiveIndex] = useState(null);
    const [customStart, setCustomStart] = useState('');
    const [customEnd, setCustomEnd] = useState('');
    const [selectedItem, setSelectedItem] = useState(null);

    const periodLabels = {
        'TODAY': 'Hoje',
        '7D': 'Nos Últimos 7 Dias',
        '15D': 'Nos Últimos 15 Dias',
        '30D': 'Nos Últimos 30 Dias',
        'WEEK': 'Nesta Semana',
        'MONTH': 'Neste Mês',
        'YEAR': 'Neste Ano',
        'ALL': 'Em Todo o Período',
        'CUSTOM': 'Período Personal.'
    };

    // --- DATA ENGINE & TOTALS ---
    const { chartData, totals } = useMemo(() => {
        if (!registrosEstudo || registrosEstudo.length === 0) return { chartData: [], totals: { hours: 0, questions: 0 } };

        const now = startOfToday();
        let startDate;
        let endDate = endOfDay(new Date());

        switch (period) {
            case 'TODAY': startDate = now; break;
            case '7D': startDate = subDays(now, 7); break;
            case '15D': startDate = subDays(now, 15); break;
            case '30D': startDate = subDays(now, 30); break;
            case 'WEEK': startDate = startOfWeek(now, { weekStartsOn: 0 }); break;
            case 'MONTH': startDate = startOfMonth(now); break;
            case 'YEAR': startDate = startOfYear(now); break;
            case 'CUSTOM':
                if (customStart) startDate = parseISO(customStart);
                if (customEnd) endDate = endOfDay(parseISO(customEnd));
                break;
            default: startDate = new Date(0); // ALL
        }

        const grouped = {};
        let totalMetricValue = 0;
        let accHours = 0;
        let accQuestions = 0;

        if (startDate || period === 'ALL') {
            registrosEstudo.forEach(reg => {
                const regDate = reg.data ? parseISO(reg.data) : new Date(0);
                if (period === 'ALL' || (regDate >= startDate && regDate <= endDate)) {
                    const disciplina = reg.disciplinaNome || 'Geral';
                    const h = Number(reg.tempoEstudadoMinutos) || 0;
                    const q = Number(reg.questoesFeitas) || 0;

                    accHours += h;
                    accQuestions += q;

                    const value = metric === 'hours' ? h : q;
                    if (value > 0) {
                        if (!grouped[disciplina]) grouped[disciplina] = 0;
                        grouped[disciplina] += value;
                        totalMetricValue += value;
                    }
                }
            });
        }

        const data = Object.entries(grouped)
            .map(([name, value], index) => ({
                name,
                value,
                fill: COLORS[index % COLORS.length],
                percent: totalMetricValue > 0 ? (value / totalMetricValue) * 100 : 0
            }))
            .sort((a, b) => b.value - a.value);

        return {
            chartData: data,
            totals: { hours: accHours, questions: accQuestions }
        };

    }, [registrosEstudo, period, metric, customStart, customEnd]);

    const getCurrentPeriodLabel = () => {
        if (period === 'CUSTOM' && customStart && customEnd) {
             return `${format(parseISO(customStart), 'dd/MM')} - ${format(parseISO(customEnd), 'dd/MM')}`;
        }
        return periodLabels[period];
    };

    const filterProps = { period, setPeriod, metric, setMetric, customStart, setCustomStart, customEnd, setCustomEnd, periodLabels, totals };

    const handleSelectMini = (item) => setSelectedItem(prev => (prev?.name === item.name ? null : item));

    const displayValueMini = selectedItem ? selectedItem.value : (metric === 'hours' ? totals.hours : totals.questions);
    const displayLabelMini = selectedItem ? selectedItem.name : "Total";
    const displayColorMini = selectedItem ? selectedItem.fill : null;

    const hasData = chartData.length > 0;

    return (
        <>
            <AnimatePresence>
                {isExpanded && (
                    <ExpandedChartModal
                        data={chartData}
                        type={metric}
                        totals={totals}
                        periodLabel={getCurrentPeriodLabel()}
                        onClose={() => setIsExpanded(false)}
                        filterProps={filterProps}
                    />
                )}
            </AnimatePresence>

            <div className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-3xl shadow-sm p-5 flex flex-col h-full relative group overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/5 rounded-full blur-3xl pointer-events-none"></div>

                {/* HEADER DO CARD (LIMPO: TÍTULO + BADGE + BOTÃO EXPANDIR) */}
                <div className="flex justify-between items-start mb-4 relative z-10">
                    <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-2">
                            <div className="p-1.5 rounded-lg bg-indigo-100 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400">
                                <Clock size={16} strokeWidth={2.5}/>
                            </div>
                            <h3 className="text-xs font-extrabold text-zinc-900 dark:text-white uppercase tracking-tight">Distribuição de Estudos</h3>
                        </div>
                        <div className="mt-1 inline-flex items-center px-2 py-0.5 rounded-md bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 text-[10px] font-black uppercase tracking-wide">
                            {getCurrentPeriodLabel()}
                        </div>
                    </div>

                    {/* BOTÃO DE EXPANDIR (CLICÁVEL E VISÍVEL) */}
                    <button
                        onClick={() => setIsExpanded(true)}
                        className="p-2 text-zinc-400 hover:text-white hover:bg-indigo-600 dark:hover:bg-indigo-500 rounded-full transition-all shadow-sm hover:shadow-lg hover:shadow-indigo-500/30 active:scale-95"
                        title="Expandir e Filtrar"
                    >
                        <Maximize2 size={18} />
                    </button>
                </div>

                {/* GRÁFICO CARD OU EMPTY STATE */}
                {!hasData ? (
                    <div
                        className="flex-1 min-h-[180px] sm:min-h-[220px] flex flex-col items-center justify-center text-center cursor-pointer group/empty"
                        onClick={() => setIsExpanded(true)}
                    >
                        <div className="p-3 bg-zinc-100 dark:bg-zinc-900 rounded-full mb-3 group-hover/empty:scale-110 transition-transform">
                            <Target size={24} className="text-zinc-400"/>
                        </div>
                        <p className="font-bold text-zinc-500 mb-1 text-sm">Sem dados</p>
                        <p className="text-[10px] text-zinc-400">Toque para filtrar outro período</p>
                    </div>
                ) : (
                    <>
                        <div
                            className="flex-1 min-h-[180px] sm:min-h-[220px] relative cursor-pointer group/chart flex items-center justify-center"
                            onClick={() => setIsExpanded(true)} // Clicar no gráfico também expande
                        >
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={chartData}
                                        cx="50%" cy="50%"
                                        innerRadius="60%" outerRadius="85%"
                                        paddingAngle={3}
                                        dataKey="value"
                                        stroke="none"
                                        activeIndex={selectedItem ? chartData.findIndex(d => d.name === selectedItem.name) : undefined}
                                        activeShape={renderActiveShape}
                                        isAnimationActive={true}
                                    >
                                        {chartData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={entry.fill} className="transition-all duration-300 outline-none" />
                                        ))}
                                    </Pie>
                                    <Tooltip content={<CustomTooltip type={metric} />} />
                                </PieChart>
                            </ResponsiveContainer>

                            {/* INFO CENTRAL (SEMPRE TOTAL, POIS O CLIQUE ABRE O MODAL) */}
                            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none transition-transform duration-300 group-hover/chart:scale-105">
                                <span className="text-xl sm:text-2xl font-black text-zinc-800 dark:text-white tracking-tighter">
                                    {metric === 'hours' ? formatValue(totals.hours, 'hours').split(' ')[0] : totals.questions}
                                </span>
                                <span className="text-[9px] font-bold text-zinc-400 uppercase tracking-[0.2em] mt-1">Total</span>
                            </div>
                        </div>

                        {/* LEGENDA COMPACTA */}
                        <div className="mt-3 grid grid-cols-2 gap-2 max-h-24 overflow-y-auto custom-scrollbar">
                            {chartData.map((entry, i) => (
                                <div
                                    key={i}
                                    onClick={() => setIsExpanded(true)} // Clicar na legenda também expande
                                    className="flex items-center gap-1.5 px-2 py-1 rounded-lg border border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50 cursor-pointer hover:border-zinc-300 dark:hover:border-zinc-700 transition-colors"
                                >
                                    <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: entry.fill }}></div>
                                    <span className="text-[10px] sm:text-xs font-bold text-zinc-700 dark:text-zinc-300 truncate flex-1" title={entry.name}>{entry.name}</span>
                                    <span className="text-[10px] sm:text-xs font-black text-zinc-900 dark:text-white pl-1.5 border-l border-zinc-200 dark:border-zinc-700">{entry.percent.toFixed(0)}%</span>
                                </div>
                            ))}
                        </div>
                    </>
                )}
            </div>
        </>
    );
};

export default DesempenhoGrafico;