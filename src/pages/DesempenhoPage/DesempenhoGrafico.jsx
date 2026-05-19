import React, { useState, useMemo, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Sector } from 'recharts';
import {
  X, Clock, Target, ChevronDown, CheckCircle2,
  Maximize2, Minimize2,
} from 'lucide-react';

// ============================================================================
// CONFIGURAÇÕES
// ============================================================================
const COLORS = [
  '#ef4444','#f97316','#f59e0b','#10b981',
  '#3b82f6','#8b5cf6','#ec4899','#14b8a6','#6366f1',
];

// ============================================================================
// HELPERS
// ============================================================================
const formatValue = (value, type) => {
  if (type === 'hours') {
    const h = Math.floor(value / 60);
    const m = Math.round(value % 60);
    if (h === 0) return `${m}m`;
    if (m === 0) return `${h}h`;
    return `${h}h ${m}m`;
  }
  return `${value}`;
};

// ============================================================================
// RECHARTS HELPERS
// ============================================================================
const renderActiveShape = (props) => {
  const { cx, cy, innerRadius, outerRadius, startAngle, endAngle, fill } = props;
  return (
    <g>
      <Sector cx={cx} cy={cy} innerRadius={innerRadius} outerRadius={outerRadius + 6} startAngle={startAngle} endAngle={endAngle} fill={fill} style={{ filter: `drop-shadow(0 0 8px ${fill}60)` }} />
      <Sector cx={cx} cy={cy} innerRadius={outerRadius + 8} outerRadius={outerRadius + 11} startAngle={startAngle} endAngle={endAngle} fill={fill} opacity={0.2} />
    </g>
  );
};

const CustomTooltip = ({ active, payload, type }) => {
  if (!active || !payload?.length) return null;
  const data = payload[0].payload;
  return (
    <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700/50 p-2.5 rounded-xl shadow-xl text-xs z-50">
      <div className="flex items-center gap-2 mb-1">
        <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: data.fill }} />
        <span className="font-black text-zinc-900 dark:text-white max-w-[150px] truncate">{data.name}</span>
      </div>
      <div className="flex justify-between gap-4">
        <span className="font-mono font-bold text-zinc-600 dark:text-zinc-300">{formatValue(data.value, type)}</span>
        <span className="font-bold text-zinc-400">{data.percent.toFixed(1)}%</span>
      </div>
    </div>
  );
};

// ============================================================================
// TOGGLE DE MÉTRICA
// ============================================================================
const MetricToggle = ({ value, onChange }) => {
  const options = [
    { key: 'hours',     label: 'Horas',    Icon: Clock  },
    { key: 'questions', label: 'Questões', Icon: Target },
  ];
  return (
    <div className="flex items-center gap-0.5 p-0.5 bg-zinc-100 dark:bg-zinc-800/60 rounded-lg">
      {options.map(({ key, label, Icon }) => (
        <button key={key} onClick={() => onChange(key)}
          className={`relative flex items-center gap-1.5 px-3 py-1 rounded-md text-[11px] font-bold uppercase tracking-wide transition-all duration-150 select-none
            ${value === key ? 'text-zinc-900 dark:text-white' : 'text-zinc-400 dark:text-zinc-500 hover:text-zinc-600 dark:hover:text-zinc-300'}`}>
          {value === key && (
            <motion.div layoutId="metric-pill-graf" className="absolute inset-0 bg-white dark:bg-zinc-700 rounded-md shadow-sm" transition={{ type: 'spring', stiffness: 400, damping: 35 }} />
          )}
          <Icon size={11} strokeWidth={2.5} className="relative z-10 flex-shrink-0" />
          <span className="relative z-10 hidden sm:block">{label}</span>
        </button>
      ))}
    </div>
  );
};

// ============================================================================
// CHART INTERNO (reutilizado no modal e no card normal)
// ============================================================================
const PieChartContent = ({ chartData, metric, totals, activeIndex, setActiveIndex, isExpanded = false }) => {
  const renderList = () => (
    <div className="flex flex-col h-full overflow-hidden">
      <div className={`mb-3 px-2 ${isExpanded ? 'block' : 'hidden lg:block'}`}>
        <h4 className="text-3xl font-black text-zinc-900 dark:text-white tracking-tight">
          {metric === 'hours' ? formatValue(totals.hours, 'hours') : totals.questions}
        </h4>
        <p className="text-[11px] font-bold text-zinc-500 uppercase tracking-wide">
          {metric === 'hours' ? 'Tempo total no filtro' : 'Questões no filtro'}
        </p>
      </div>
      <div className="flex-1 overflow-y-auto pr-1 space-y-1 custom-scrollbar">
        {chartData.map((entry, i) => (
          <div key={i}
            onMouseEnter={() => setActiveIndex(i)}
            onMouseLeave={() => setActiveIndex(null)}
            className={`flex items-center justify-between p-2 rounded-lg cursor-pointer transition-all duration-200 group
              ${activeIndex === i ? 'bg-zinc-100 dark:bg-zinc-800 translate-x-1' : 'hover:bg-zinc-50 dark:hover:bg-zinc-900/50'}`}
          >
            <div className="flex items-center gap-2.5 overflow-hidden">
              <div className="w-2.5 h-2.5 rounded-full shadow-sm shrink-0 transition-transform duration-300"
                style={{ backgroundColor: entry.fill, transform: activeIndex === i ? 'scale(1.2)' : 'scale(1)' }} />
              <span className={`text-[11px] font-bold truncate transition-colors ${activeIndex === i ? 'text-zinc-900 dark:text-white' : 'text-zinc-600 dark:text-zinc-400'}`}>
                {entry.name}
              </span>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <span className="text-[11px] font-mono font-bold text-zinc-500 dark:text-zinc-400">
                {formatValue(entry.value, metric)}
              </span>
              <span className="text-[10px] font-bold bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded min-w-[32px] text-center" style={{ color: entry.fill }}>
                {entry.percent.toFixed(0)}%
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div className={`flex flex-col lg:flex-row h-full gap-6 ${isExpanded ? 'min-h-[400px]' : ''}`}>
      {/* DONUT */}
      <div className={`${isExpanded ? 'w-full lg:w-5/12 h-[300px] lg:h-auto' : 'w-full lg:w-5/12 h-[220px] lg:h-auto'} min-h-[220px] relative shrink-0`}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={chartData} cx="50%" cy="50%"
              innerRadius="60%" outerRadius="90%"
              paddingAngle={4} dataKey="value" stroke="none"
              activeIndex={activeIndex}
              activeShape={renderActiveShape}
              onMouseEnter={(_, i) => setActiveIndex(i)}
              onMouseLeave={() => setActiveIndex(null)}
            >
              {chartData.map((entry, i) => (
                <Cell key={i} fill={entry.fill} fillOpacity={activeIndex === i ? 1 : activeIndex !== null ? 0.3 : 1} className="transition-all duration-300" />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip type={metric} />} />
          </PieChart>
        </ResponsiveContainer>

        {/* TEXTO CENTRAL */}
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <AnimatePresence mode="wait">
            {activeIndex !== null ? (
              <motion.div key="active" initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} className="text-center">
                <span className="text-2xl font-black text-zinc-800 dark:text-white block leading-none">
                  {formatValue(chartData[activeIndex].value, metric)}
                </span>
                <span className="text-[10px] font-bold uppercase tracking-widest mt-1" style={{ color: chartData[activeIndex].fill }}>
                  {chartData[activeIndex].name.split(' ')[0]}
                </span>
              </motion.div>
            ) : (
              <motion.div key="total" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center">
                <span className="text-2xl font-black text-zinc-800 dark:text-white block leading-none">
                  {metric === 'hours' ? formatValue(totals.hours, 'hours') : totals.questions}
                </span>
                <span className="text-[10px] text-zinc-400 font-bold uppercase tracking-widest mt-1">Total</span>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* LISTA */}
      <div className="flex-1 min-h-0 border-t lg:border-t-0 lg:border-l border-zinc-100 dark:border-zinc-800 pt-4 lg:pt-0 lg:pl-6 overflow-hidden">
        {renderList()}
      </div>
    </div>
  );
};

// ============================================================================
// COMPONENTE PRINCIPAL
// ============================================================================
const DesempenhoGrafico = ({ filteredRecords = [] }) => {
  const [metric, setMetric] = useState('hours');
  const [activeIndex, setActiveIndex] = useState(null);
  // CORREÇÃO 2: estado para modo expandido
  const [isExpanded, setIsExpanded] = useState(false);

  // ── Cálculo do gráfico ──────────────────────────────────────────────────
  const { chartData, totals } = useMemo(() => {
    const grouped = {};
    let totalH = 0, totalQ = 0, totalMetric = 0;

    filteredRecords.forEach(reg => {
      const disc = reg.disciplinaNome || 'Geral';
      const h = Number(reg.tempoEstudadoMinutos) || 0;
      const q = Number(reg.questoesFeitas) || 0;
      totalH += h;
      totalQ += q;
      const val = metric === 'hours' ? h : q;
      if (val > 0) {
        if (!grouped[disc]) grouped[disc] = 0;
        grouped[disc] += val;
        totalMetric += val;
      }
    });

    const data = Object.entries(grouped)
      .map(([name, value], i) => ({
        name,
        value,
        fill: COLORS[i % COLORS.length],
        percent: totalMetric > 0 ? (value / totalMetric) * 100 : 0,
      }))
      .sort((a, b) => b.value - a.value);

    return { chartData: data, totals: { hours: totalH, questions: totalQ } };
  }, [filteredRecords, metric]);

  const hasData = chartData.length > 0;

  return (
    <>
      {/* ── MODAL EXPANDIDO — Layout elegante e proporcional ── */}
      <AnimatePresence>
        {isExpanded && (
          <div
            className="fixed inset-0 z-[100] bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 sm:p-6"
            onClick={() => setIsExpanded(false)}
          >
            <motion.div
              initial={{ scale: 0.96, opacity: 0, y: 8 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.96, opacity: 0, y: 8 }}
              transition={{ type: 'spring', stiffness: 380, damping: 30 }}
              className="bg-white dark:bg-zinc-900 w-full max-w-2xl rounded-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden shadow-2xl flex flex-col"
              style={{ maxHeight: 'min(680px, 92vh)' }}
              onClick={e => e.stopPropagation()}
            >
              {/* Header compacto */}
              <div className="flex items-center justify-between px-5 py-3.5 border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50/60 dark:bg-zinc-900/60 shrink-0">
                <div className="flex items-center gap-2.5">
                  <div className="p-1.5 bg-red-500/10 rounded-lg">
                    <Target size={15} className="text-red-500" strokeWidth={2.5} />
                  </div>
                  <div>
                    <h2 className="text-xs font-black text-zinc-900 dark:text-white uppercase tracking-tight">Distribuição por Disciplina</h2>
                    <p className="text-[10px] text-zinc-400 mt-0.5">
                      {metric === 'hours' ? formatValue(totals.hours, 'hours') : `${totals.questions} questões`} · {chartData.length} matéria{chartData.length !== 1 ? 's' : ''}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <MetricToggle value={metric} onChange={setMetric} />
                  <button
                    onClick={() => setIsExpanded(false)}
                    className="p-1.5 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors"
                  >
                    <X size={16} />
                  </button>
                </div>
              </div>

              {/* Conteúdo */}
              <div className="flex-1 overflow-hidden">
                {!hasData ? (
                  <div className="h-full flex flex-col items-center justify-center text-zinc-400 opacity-60 p-8">
                    <Target size={28} className="mb-2" />
                    <p className="text-xs font-bold">Sem atividades neste filtro</p>
                  </div>
                ) : (
                  <div className="flex flex-col sm:flex-row h-full">
                    {/* Donut — lado esquerdo, tamanho fixo e proporcional */}
                    <div className="shrink-0 w-full sm:w-[240px] h-[220px] sm:h-full relative border-b sm:border-b-0 sm:border-r border-zinc-100 dark:border-zinc-800">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={chartData} cx="50%" cy="50%"
                            innerRadius="55%" outerRadius="82%"
                            paddingAngle={3} dataKey="value" stroke="none"
                            activeIndex={activeIndex}
                            activeShape={renderActiveShape}
                            onMouseEnter={(_, i) => setActiveIndex(i)}
                            onMouseLeave={() => setActiveIndex(null)}
                          >
                            {chartData.map((entry, i) => (
                              <Cell key={i} fill={entry.fill} fillOpacity={activeIndex === i ? 1 : activeIndex !== null ? 0.25 : 1} className="transition-all duration-300" />
                            ))}
                          </Pie>
                          <Tooltip content={<CustomTooltip type={metric} />} />
                        </PieChart>
                      </ResponsiveContainer>
                      {/* Centro */}
                      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                        <AnimatePresence mode="wait">
                          {activeIndex !== null ? (
                            <motion.div key="active" initial={{ opacity: 0, scale: 0.85 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} className="text-center px-3">
                              <span className="text-xl font-black text-zinc-800 dark:text-white block leading-none">
                                {formatValue(chartData[activeIndex].value, metric)}
                              </span>
                              <span className="text-[9px] font-bold uppercase tracking-widest mt-1 block truncate max-w-[100px]" style={{ color: chartData[activeIndex].fill }}>
                                {chartData[activeIndex].name.split(' ')[0]}
                              </span>
                            </motion.div>
                          ) : (
                            <motion.div key="total" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center">
                              <span className="text-xl font-black text-zinc-800 dark:text-white block leading-none">
                                {metric === 'hours' ? formatValue(totals.hours, 'hours') : totals.questions}
                              </span>
                              <span className="text-[9px] text-zinc-400 font-bold uppercase tracking-widest mt-1">Total</span>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    </div>

                    {/* Lista — lado direito, scroll independente */}
                    <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-1">
                      {chartData.map((entry, i) => (
                        <div
                          key={i}
                          onMouseEnter={() => setActiveIndex(i)}
                          onMouseLeave={() => setActiveIndex(null)}
                          className={`flex items-center gap-3 px-3 py-2 rounded-xl cursor-pointer transition-all duration-150 ${
                            activeIndex === i
                              ? 'bg-zinc-100 dark:bg-zinc-800'
                              : 'hover:bg-zinc-50 dark:hover:bg-zinc-800/50'
                          }`}
                        >
                          {/* Posição */}
                          <span className="text-[10px] font-black text-zinc-300 dark:text-zinc-600 w-4 shrink-0 text-center">{i + 1}</span>
                          {/* Cor */}
                          <div
                            className="w-2.5 h-2.5 rounded-full shrink-0"
                            style={{ backgroundColor: entry.fill, opacity: activeIndex !== null && activeIndex !== i ? 0.3 : 1 }}
                          />
                          {/* Nome */}
                          <span className={`flex-1 text-xs font-bold truncate transition-colors ${activeIndex === i ? 'text-zinc-900 dark:text-white' : 'text-zinc-600 dark:text-zinc-400'}`}>
                            {entry.name}
                          </span>
                          {/* Valor + percentual */}
                          <div className="flex items-center gap-2 shrink-0">
                            <span className="text-[11px] font-mono font-bold text-zinc-500 dark:text-zinc-400">
                              {formatValue(entry.value, metric)}
                            </span>
                            <span
                              className="text-[10px] font-black px-1.5 py-0.5 rounded-md min-w-[36px] text-center"
                              style={{ color: entry.fill, backgroundColor: `${entry.fill}15` }}
                            >
                              {entry.percent.toFixed(0)}%
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── CARD NORMAL ── */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-sm p-5 h-full flex flex-col min-h-[360px]">

        {/* ── CONTROLES ── */}
        <div className="flex items-center justify-between gap-3 mb-4 shrink-0">
          <MetricToggle value={metric} onChange={setMetric} />
          <div className="flex items-center gap-3">
            {/* Totais rápidos */}
            <div className="flex items-center gap-3 text-[10px] font-bold text-zinc-400">
              <span className="flex items-center gap-1">
                <Clock size={10} /> {formatValue(totals.hours, 'hours')}
              </span>
              <span className="w-px h-3 bg-zinc-200 dark:bg-zinc-700" />
              <span className="flex items-center gap-1">
                <Target size={10} /> {totals.questions}q
              </span>
            </div>
            {/* CORREÇÃO 2: botão de expandir */}
            <button
              onClick={() => setIsExpanded(true)}
              className="p-1.5 text-zinc-400 hover:text-red-500 hover:bg-red-500/10 rounded-lg border border-zinc-200 dark:border-zinc-700 hover:border-red-500/30 transition-all"
              title="Expandir gráfico"
            >
              <Maximize2 size={13} />
            </button>
          </div>
        </div>

        {/* ── CONTEÚDO ── */}
        <div className="flex-1 min-h-0 w-full">
          {!hasData ? (
            <div className="h-full flex flex-col items-center justify-center text-zinc-400 opacity-60">
              <div className="p-4 bg-zinc-50 dark:bg-zinc-900 rounded-full mb-3">
                <Target size={32} />
              </div>
              <p className="text-xs font-bold">Sem atividades neste filtro</p>
            </div>
          ) : (
            <PieChartContent
              chartData={chartData}
              metric={metric}
              totals={totals}
              activeIndex={activeIndex}
              setActiveIndex={setActiveIndex}
            />
          )}
        </div>
      </div>
    </>
  );
};

export default DesempenhoGrafico;