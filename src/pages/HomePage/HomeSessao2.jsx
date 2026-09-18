import React, { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  Sector,
} from 'recharts';
import {
  Clock,
  BookOpen,
  Maximize2,
  X,
} from 'lucide-react';
import HomeCardTitle from './HomeCardTitle.jsx';
import HomeEmptyState from './HomeEmptyState.jsx';

const customScrollbarClass = "overflow-y-auto pr-1 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-zinc-200 dark:[&::-webkit-scrollbar-thumb]:bg-zinc-700 [&::-webkit-scrollbar-thumb]:rounded-full";

const CHART_COLORS = [
  '#ef4444', '#f97316', '#3b82f6', '#10b981', '#8b5cf6', '#ec4899', '#06b6d4', '#eab308',
];

const dateToYMD_local = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const getRegistroDate = (registro) => {
  if (registro?.data) return registro.data;
  if (registro?.dataRegistro) return registro.dataRegistro;
  if (registro?.timestamp?.toDate) return dateToYMD_local(registro.timestamp.toDate());
  if (registro?.createdAt?.toDate) return dateToYMD_local(registro.createdAt.toDate());
  return null;
};

const isRegistroRevisao = (registro) => (
  registro?.isRevisao === true ||
  registro?.revisao === true ||
  registro?.tipoEstudo === 'revisao' ||
  registro?.tipo === 'Revisao' ||
  registro?.tipo === 'Revisão'
);

const formatTime = (minutes) => {
  if (!minutes || minutes === 0) return '0m';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h > 0) return `${h}h${m > 0 ? ` ${m}m` : ''}`;
  return `${m}m`;
};

const getCenterValueClass = (value, size = 220) => {
  const length = String(value || '').replace(/\s/g, '').length;
  if (size <= 140) {
    if (length >= 7) return 'text-[12px]';
    if (length >= 6) return 'text-[13px]';
    if (length >= 5) return 'text-[14px]';
    return 'text-[15px]';
  }
  if (size <= 180) {
    if (length >= 7) return 'text-[16px]';
    if (length >= 6) return 'text-[18px]';
    return 'text-[20px]';
  }
  if (length >= 7) return 'text-[18px]';
  if (length >= 6) return 'text-[20px]';
  return 'text-2xl';
};

const getAccuracyTone = (accuracy) => {
  if (accuracy >= 80) return 'text-emerald-600 dark:text-emerald-400';
  if (accuracy >= 60) return 'text-amber-600 dark:text-amber-400';
  return 'text-red-600 dark:text-red-400';
};

// ============================================================================
// RECHARTS HELPERS (Efeito ativo idêntico ao DesempenhoGrafico)
// ============================================================================
const renderActiveShape = (props) => {
  const { cx, cy, innerRadius, outerRadius, startAngle, endAngle, fill } = props;
  return (
    <g>
      <Sector
        cx={cx}
        cy={cy}
        innerRadius={innerRadius}
        outerRadius={outerRadius + 4}
        startAngle={startAngle}
        endAngle={endAngle}
        fill={fill}
        style={{ filter: `drop-shadow(0 0 6px ${fill}66)` }}
      />
      <Sector
        cx={cx}
        cy={cy}
        innerRadius={outerRadius + 6}
        outerRadius={outerRadius + 8}
        startAngle={startAngle}
        endAngle={endAngle}
        fill={fill}
        opacity={0.2}
      />
    </g>
  );
};

const CustomTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null;
  const item = payload[0].payload;
  return (
    <div className="bg-white/95 dark:bg-zinc-900/95 backdrop-blur-md border border-zinc-200 dark:border-zinc-700/50 p-2 rounded-xl shadow-xl text-xs z-50 pointer-events-none">
      <div className="flex items-center gap-1.5 mb-0.5">
        <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: item.color }} />
        <span className="font-black text-zinc-900 dark:text-white max-w-[130px] truncate">{item.name}</span>
      </div>
      <div className="flex justify-between gap-3 text-[11px]">
        <span className="font-mono font-bold text-zinc-600 dark:text-zinc-300">{item.displayValue}</span>
        <span className="font-bold text-zinc-400">{item.percent.toFixed(0)}%</span>
      </div>
    </div>
  );
};

// ============================================================================
// CARD ESTUDO DE HOJE
// ============================================================================
const TodayChart = ({ registrosEstudo, _wide = false, compact = false, expandedView = false, onClose = null }) => {
  const [hoveredHour, setHoveredHour] = useState(null);
  const [isExpandedModal, setIsExpandedModal] = useState(false);

  const todayStr = useMemo(() => dateToYMD_local(new Date()), []);

  const data = useMemo(() => {
    const todayRegs = (registrosEstudo || []).filter((r) => getRegistroDate(r) === todayStr);

    const simuladosMap = {};
    const discMap = {};
    let totalMinutes = 0;
    let totalQuestions = 0;
    let totalCorrect = 0;

    todayRegs.forEach((reg) => {
      const min = Number(reg.tempoEstudadoMinutos) || 0;
      const qst = Number(reg.questoesFeitas) || 0;
      const correct = Number(reg.acertos) || 0;
      totalMinutes += min;
      totalQuestions += qst;
      totalCorrect += correct;

      const isSimulado = reg.disciplinaDisplay === 'Simulado' || reg.tipoEstudo === 'Simulado';

      if (isSimulado) {
        const titulo = reg.simuladoTitulo || reg.assunto || 'Simulado';
        if (!simuladosMap[titulo]) simuladosMap[titulo] = { titulo, minutes: 0, questions: 0, correct: 0 };
        simuladosMap[titulo].minutes += min;
        simuladosMap[titulo].questions += qst;
        simuladosMap[titulo].correct += correct;
      } else {
        const isReview = isRegistroRevisao(reg);
        const disc = reg.disciplinaNome || 'Geral';
        const topic = reg.assuntoNome || reg.assunto || 'Estudo Geral';
        if (!discMap[disc]) discMap[disc] = { name: disc, minutes: 0, questions: 0, correct: 0, topics: {} };
        discMap[disc].minutes += min;
        discMap[disc].questions += qst;
        discMap[disc].correct += correct;
        const topicKey = `${isReview ? 'review' : 'study'}::${topic}`;
        if (!discMap[disc].topics[topicKey]) discMap[disc].topics[topicKey] = { name: topic, minutes: 0, questions: 0, correct: 0, isReview };
        discMap[disc].topics[topicKey].minutes += min;
        discMap[disc].topics[topicKey].questions += qst;
        discMap[disc].topics[topicKey].correct += correct;
      }
    });

    const discItems = Object.values(discMap).map((d, i) => ({
      name: d.name,
      minutes: d.minutes,
      questions: d.questions,
      correct: d.correct,
      color: CHART_COLORS[i % CHART_COLORS.length],
      topics: Object.values(d.topics),
      hasReview: Object.values(d.topics).some((topic) => topic.isReview),
      isSimulado: false,
    }));

    const simItems = Object.values(simuladosMap).map((s, i) => ({
      name: s.titulo,
      minutes: s.minutes,
      questions: s.questions,
      correct: s.correct,
      color: CHART_COLORS[(discItems.length + i) % CHART_COLORS.length],
      topics: [],
      isSimulado: true,
    }));

    const allItems = [...discItems, ...simItems].sort((a, b) => b.minutes - a.minutes);
    return {
      items: allItems,
      totalMinutes,
      totalQuestions,
      totalCorrect,
      totalWrong: Math.max(0, totalQuestions - totalCorrect),
      accuracy: totalQuestions > 0 ? Math.round((totalCorrect / totalQuestions) * 100) : 0,
    };
  }, [registrosEstudo, todayStr]);

  const donutSegments = useMemo(() => {
    return data.items.map((item) => ({
      name: item.name,
      value: item.minutes,
      color: item.color,
      displayValue: formatTime(item.minutes),
      percent: data.totalMinutes > 0 ? (item.minutes / data.totalMinutes) * 100 : 0,
    }));
  }, [data.items, data.totalMinutes]);

  const metricConfig = {
    gradient: 'from-red-600 to-rose-700',
    shadow: 'shadow-red-500/10',
  };

  const chartSize = expandedView
    ? (data.totalQuestions > 0 ? 190 : 240)
    : (data.totalQuestions > 0 ? (compact ? 120 : 138) : (compact ? 170 : 204));
  const cardHeightClass = expandedView ? 'min-h-0' : 'h-full';

  return (
    <>
      <div className={`group relative z-20 flex flex-col overflow-hidden rounded-xl border-2 border-l-4 border-zinc-200 !border-l-red-500/20 bg-white transition-all duration-300 hover:border-accent-light/40 hover:!border-l-red-500 hover:shadow-lg dark:border-white/10 dark:!border-l-red-500/25 dark:bg-card-dark dark:hover:border-accent-light/20 dark:hover:!border-l-red-500 ${expandedView ? 'w-full shadow-2xl shadow-zinc-950/15' : 'hover:-translate-y-0.5'} ${cardHeightClass}`}>
        {/* Orbes Decorativas */}
        <div className={`pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full blur-[80px] opacity-10 transition-all duration-700 group-hover:opacity-16 bg-gradient-to-br ${metricConfig.gradient}`} />
        <div className="pointer-events-none absolute -bottom-20 -left-20 h-64 w-64 rounded-full bg-zinc-500/5 blur-[80px] opacity-40 transition-all duration-700" />

        {/* Header (mantido limpo, sem botões de horas/questões) */}
        <div className={`relative z-10 flex items-center justify-between border-b border-zinc-100 dark:border-white/5 bg-zinc-50/30 dark:bg-transparent ${expandedView ? 'px-6 py-5' : compact ? 'px-4 py-3' : 'px-5 py-3.5'}`}>
          <HomeCardTitle icon={Clock} eyebrow="Estudo de Hoje">
            
          </HomeCardTitle>

          <div className="flex items-center gap-2">
            {!expandedView && (
              <button
                type="button"
                onClick={() => setIsExpandedModal(true)}
                title="Expandir estudo de hoje"
                className="w-7 h-7 rounded-lg border border-zinc-200/80 bg-white/90 dark:border-white/10 dark:bg-zinc-800/80 flex items-center justify-center text-zinc-400 hover:text-red-600 dark:hover:text-red-400 transition-all shadow-xs hover:scale-105"
              >
                <Maximize2 size={13} />
              </button>
            )}

            {expandedView && onClose && (
              <button
                type="button"
                onClick={onClose}
                title="Fechar"
                className="flex h-8 w-8 items-center justify-center rounded-xl border border-zinc-200 bg-white text-zinc-500 shadow-sm transition-all hover:bg-red-50 hover:text-red-600 dark:border-white/10 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-red-950/40 dark:hover:text-red-400"
              >
                <X size={16} />
              </button>
            )}
          </div>
        </div>

        {/* Corpo: Layout clássico (Gráfico em cima, disciplinas em baixo) */}
        <div className={`relative z-10 flex-1 flex flex-col min-h-0 ${expandedView ? '' : 'overflow-hidden'}`}>
          {data.totalMinutes === 0 && data.totalQuestions === 0 ? (
            <div className="flex flex-1 items-center justify-center px-3 py-8">
              <HomeEmptyState
                icon={BookOpen}
                title="Nenhum estudo registrado hoje"
                description="Quando você registrar uma sessão, o resumo do dia aparece aqui."
                className="min-h-[210px]"
              />
            </div>
          ) : (
            <div className={`flex-1 flex flex-col ${expandedView ? 'px-6 pb-6 pt-4 gap-3' : 'px-4 pb-4 pt-2 gap-2 overflow-hidden'}`}>
              {/* Seção Superior: Gráfico Donut (Recharts) & Stats Lado a Lado */}
              <div className={`flex items-center ${
                data.totalQuestions > 0
                  ? expandedView ? 'gap-6 justify-center' : 'gap-3 justify-start'
                  : expandedView ? 'justify-center gap-6' : 'justify-center gap-3'
              }`}>
                {/* Donut Recharts idêntico ao DesempenhoGrafico */}
                <div
                  className="relative shrink-0 flex items-center justify-center"
                  style={{ width: chartSize, height: chartSize }}
                >
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
                      <Pie
                        data={donutSegments}
                        cx="50%"
                        cy="50%"
                        innerRadius="58%"
                        outerRadius="88%"
                        paddingAngle={3}
                        dataKey="value"
                        stroke="none"
                        activeIndex={hoveredHour}
                        activeShape={renderActiveShape}
                        onMouseEnter={(_, i) => setHoveredHour(i)}
                        onMouseLeave={() => setHoveredHour(null)}
                      >
                        {donutSegments.map((entry, i) => (
                          <Cell
                            key={`cell-${entry.name}-${i}`}
                            fill={entry.color}
                            fillOpacity={hoveredHour === i ? 1 : hoveredHour !== null ? 0.3 : 1}
                            className="transition-all duration-300"
                          />
                        ))}
                      </Pie>
                      <Tooltip content={<CustomTooltip />} />
                    </PieChart>
                  </ResponsiveContainer>

                  {/* Texto Central Dinâmico */}
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                    <AnimatePresence mode="wait">
                      {hoveredHour !== null && donutSegments[hoveredHour] ? (
                        <motion.div
                          key={`h-${hoveredHour}`}
                          initial={{ opacity: 0, scale: 0.8 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0 }}
                          transition={{ duration: 0.15 }}
                          className="flex max-w-[62%] flex-col items-center gap-0.5 px-1 text-center"
                        >
                          <span
                            className={`${getCenterValueClass(donutSegments[hoveredHour].displayValue, chartSize)} max-w-full whitespace-nowrap font-black leading-none tracking-tighter`}
                            style={{ color: donutSegments[hoveredHour].color }}
                          >
                            {donutSegments[hoveredHour].displayValue}
                          </span>
                          <span
                            className="text-[9px] font-bold leading-tight max-w-[80px] text-center truncate"
                            style={{ color: donutSegments[hoveredHour].color, opacity: 0.85 }}
                          >
                            {donutSegments[hoveredHour].name}
                          </span>
                          <span className="text-[9px] font-black text-zinc-400 mt-0.5 leading-none">
                            {donutSegments[hoveredHour].percent.toFixed(0)}%
                          </span>
                        </motion.div>
                      ) : (
                        <motion.div
                          key="tot"
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          transition={{ duration: 0.15 }}
                          className="flex max-w-[62%] flex-col items-center gap-0.5 text-center"
                        >
                          <span className={`${getCenterValueClass(formatTime(data.totalMinutes), chartSize)} max-w-full whitespace-nowrap font-black leading-none tracking-tighter text-zinc-900 dark:text-white`}>
                            {formatTime(data.totalMinutes)}
                          </span>
                          <span className="text-[9px] font-bold uppercase tracking-widest text-zinc-400 leading-none">
                            total
                          </span>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>

                {/* Grid de Estatísticas das Questões de Hoje (à direita do Donut) */}
                {data.totalQuestions > 0 ? (
                  <div className={`grid grid-cols-2 ${expandedView ? 'w-full max-w-[280px] gap-2.5' : 'flex-1 gap-1.5'}`}>
                    <div className={`flex flex-col rounded-lg border border-zinc-100 bg-white/70 shadow-sm dark:border-white/5 dark:bg-zinc-900/50 ${expandedView ? 'p-3' : 'p-1.5'}`}>
                      <span className={`${expandedView ? 'text-[9px]' : 'text-[8px]'} font-black uppercase tracking-wider text-zinc-400`}>Questões</span>
                      <span className={`${expandedView ? 'mt-1 text-2xl' : 'mt-0.5 text-sm'} font-black leading-none text-zinc-900 dark:text-white`}>{data.totalQuestions}</span>
                    </div>
                    <div className={`flex flex-col rounded-lg border border-zinc-100 bg-white/70 shadow-sm dark:border-white/5 dark:bg-zinc-900/50 ${expandedView ? 'p-3' : 'p-1.5'}`}>
                      <span className={`${expandedView ? 'text-[9px]' : 'text-[8px]'} font-black uppercase tracking-wider text-emerald-500`}>Acertos</span>
                      <span className={`${expandedView ? 'mt-1 text-2xl' : 'mt-0.5 text-sm'} font-black leading-none text-emerald-600 dark:text-emerald-400`}>{data.totalCorrect}</span>
                    </div>
                    <div className={`col-span-2 flex items-center justify-between rounded-lg border border-zinc-100 bg-white/70 shadow-sm dark:border-white/5 dark:bg-zinc-900/50 ${expandedView ? 'p-3' : 'p-1.5'}`}>
                      <div className="flex flex-col">
                        <span className={`${expandedView ? 'text-[9px]' : 'text-[8px]'} font-black uppercase tracking-widest text-zinc-400`}>Precisão</span>
                        <span className={`${expandedView ? 'mt-1 text-xl' : 'mt-0.5 text-xs'} font-black leading-none ${getAccuracyTone(data.accuracy)}`}>{data.accuracy}%</span>
                      </div>
                      <div className={`${expandedView ? 'h-2 w-24' : 'h-1.5 w-14'} overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800`}>
                        <div
                          className="h-full bg-emerald-500 transition-all duration-700"
                          style={{ width: `${data.accuracy}%` }}
                        />
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>

              {/* Seção Inferior: Lista de Disciplinas (em baixo) */}
              <div className={`${expandedView ? 'min-h-0' : `flex-1 min-h-0 ${customScrollbarClass}`}`}>
                <div className={`${expandedView ? 'space-y-1.5' : 'space-y-1 pr-1'}`}>
                  {data.items.map((item, i) => (
                    <div key={item.name} className="group/item">
                      <div
                        className={`relative flex items-center gap-2.5 rounded-xl border border-transparent transition-all duration-200 hover:border-zinc-200 hover:bg-zinc-50 dark:hover:border-zinc-800 dark:hover:bg-zinc-800/40 ${expandedView ? 'px-3 py-2.5' : 'px-2.5 py-2'} ${hoveredHour === i ? 'bg-zinc-50 dark:bg-zinc-800/40 border-zinc-200 dark:border-zinc-800' : ''}`}
                        onMouseEnter={() => setHoveredHour(i)}
                        onMouseLeave={() => setHoveredHour(null)}
                      >
                        <span
                          className="h-3 w-3 shrink-0 rounded-[3px] shadow-sm ring-1 ring-black/5 dark:ring-white/10"
                          style={{ backgroundColor: item.color }}
                          aria-hidden="true"
                        />
                        <h4 className={`${expandedView ? 'text-sm' : 'text-xs'} min-w-0 flex-1 truncate font-black text-zinc-900 transition-colors group-hover/item:text-red-600 dark:text-zinc-100 dark:group-hover/item:text-red-400`}>
                          {item.name}
                        </h4>
                        <span className={`${expandedView ? 'text-sm' : 'text-[11px]'} shrink-0 font-black tabular-nums text-zinc-900 dark:text-zinc-100`}>
                          {formatTime(item.minutes)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Modal Expandido via Portal */}
      {isExpandedModal && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/60 backdrop-blur-md animate-fade-in">
          <motion.div
            initial={{ opacity: 0, scale: 0.94, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.94, y: 15 }}
            className="relative w-full max-w-2xl max-h-[92vh] flex flex-col bg-white dark:bg-card-dark rounded-2xl shadow-2xl border-2 border-l-4 border-zinc-200 !border-l-red-500 dark:border-white/10 dark:!border-l-red-500 overflow-hidden"
          >
            <TodayChart
              registrosEstudo={registrosEstudo}
              expandedView
              onClose={() => setIsExpandedModal(false)}
            />
          </motion.div>
        </div>,
        document.body
      )}
    </>
  );
};

// ============================================================================
// COMPONENTE PRINCIPAL
// ============================================================================
export default function HomeSessao2({ registrosEstudo, wide = false, compact = false, className = '' }) {
  return (
    <div className={`w-full h-full ${className}`}>
      <TodayChart registrosEstudo={registrosEstudo} _wide={wide} compact={compact} />
    </div>
  );
}
