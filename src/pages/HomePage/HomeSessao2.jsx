import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Clock, BookOpen, Target,
} from 'lucide-react';
import HomeEmptyState from './HomeEmptyState.jsx';

const customScrollbarClass = "overflow-y-auto pr-1 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-zinc-200 dark:[&::-webkit-scrollbar-thumb]:bg-zinc-700 [&::-webkit-scrollbar-thumb]:rounded-full";

const CHART_COLORS = [
  '#ef4444','#f97316','#3b82f6','#10b981','#8b5cf6','#ec4899','#06b6d4','#eab308',
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

const getDonutValueClass = (value, size = 220) => {
  const length = String(value || '').replace(/\s/g, '').length;
  if (size <= 140) {
    if (length >= 7) return 'text-[15px]';
    if (length >= 6) return 'text-[16px]';
    if (length >= 5) return 'text-[18px]';
    return 'text-xl';
  }
  if (size <= 180) {
    if (length >= 7) return 'text-[18px]';
    if (length >= 6) return 'text-[20px]';
    if (length >= 5) return 'text-[22px]';
    return 'text-2xl';
  }
  if (length >= 7) return 'text-[18px]';
  if (length >= 6) return 'text-[20px]';
  if (length >= 5) return 'text-[22px]';
  return 'text-2xl';
};

const getAccuracyTone = (accuracy) => {
  if (accuracy >= 80) return 'text-emerald-600 dark:text-emerald-400';
  if (accuracy >= 60) return 'text-amber-600 dark:text-amber-400';
  return 'text-red-600 dark:text-red-400';
};

// ============================================================================
// DONUT CHART
// ============================================================================
const InteractiveDonutBig = ({ segments, total, hoveredIndex, onHover, centerLabel, centerSub, size = 220 }) => {
  const SIZE = size, C = SIZE / 2, R = SIZE * 0.386, STROKE = SIZE * 0.1, STROKE_HOV = SIZE * 0.127;
  const circ = 2 * Math.PI * R;
  let acc = 0;
  const segs = segments.map((s, i) => {
    const pct = total > 0 ? s.value / total : 0;
    const dash = `${pct * circ} ${circ}`;
    const offset = -acc * circ;
    acc += pct;
    return { ...s, dash, offset, pct, idx: i };
  });
  const hovered = hoveredIndex !== null ? segs[hoveredIndex] ?? null : null;
  const centerValueClass = getDonutValueClass(hovered?.displayValue || centerLabel, SIZE);

  return (
    <div className="relative shrink-0" style={{ width: SIZE, height: SIZE }}>
      <svg viewBox={`0 0 ${SIZE} ${SIZE}`} width={SIZE} height={SIZE} className="-rotate-90">
        <circle cx={C} cy={C} r={R} fill="none" strokeWidth={STROKE} className="stroke-zinc-100 dark:stroke-zinc-800" />
        {total === 0 ? (
          <circle cx={C} cy={C} r={R} fill="none" strokeWidth={STROKE} stroke="#d4d4d8" />
        ) : segs.map((s) => {
          const isHov = hoveredIndex === s.idx;
          return (
            <motion.circle key={s.idx} cx={C} cy={C} r={R} fill="none" stroke={s.color} strokeLinecap="butt"
              strokeDashoffset={s.offset}
              initial={{ strokeDasharray: `0 ${circ}`, opacity: 0, strokeWidth: STROKE }}
              animate={{ strokeDasharray: s.dash, opacity: hoveredIndex !== null && !isHov ? 0.2 : 1, strokeWidth: isHov ? STROKE_HOV : STROKE }}
              transition={{ strokeDasharray: { duration: 0.85, delay: s.idx * 0.07, ease: [0.22, 1, 0.36, 1] }, opacity: { duration: 0.2 }, strokeWidth: { duration: 0.15 } }}
              style={{ cursor: 'pointer', filter: isHov ? `drop-shadow(0 0 8px ${s.color}bb)` : 'none' }}
              onMouseEnter={() => onHover(s.idx)} onMouseLeave={() => onHover(null)}
            />
          );
        })}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
        <AnimatePresence mode="wait">
          {hovered ? (
            <motion.div key={`h${hovered.idx}`} initial={{ opacity: 0, scale: 0.75 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.75 }} transition={{ duration: 0.15 }}
              className="flex max-w-[58%] flex-col items-center gap-0.5 px-1 text-center">
              <span className={`${centerValueClass} max-w-full whitespace-nowrap font-black leading-none tracking-tighter`} style={{ color: hovered.color }}>{hovered.displayValue}</span>
              <span className="text-xs font-bold leading-tight max-w-[120px] text-center truncate px-2" style={{ color: hovered.color, opacity: 0.8 }}>{hovered.name}</span>
              <span className="text-xs font-black text-zinc-400 mt-1">{(hovered.pct * 100).toFixed(0)}%</span>
            </motion.div>
          ) : (
            <motion.div key="tot" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }} className="flex max-w-[58%] flex-col items-center gap-0.5">
              <span className={`${centerValueClass} max-w-full whitespace-nowrap font-black leading-none tracking-tighter text-zinc-900 dark:text-white`}>{centerLabel}</span>
              <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">{centerSub}</span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

// ============================================================================
// CARD ESTUDO DE HOJE
// ============================================================================
const TodayChart = ({ registrosEstudo, wide = false, compact = false, expandedView = false, onClose = null }) => {
  const [hoveredHour, setHoveredHour] = useState(null);

  const todayStr = useMemo(() => dateToYMD_local(new Date()), []);

  const data = useMemo(() => {
    const todayRegs = (registrosEstudo || []).filter(r => getRegistroDate(r) === todayStr);

    const simuladosMap = {};
    const discMap = {};
    let totalMinutes = 0;
    let totalQuestions = 0;
    let totalCorrect = 0;

    todayRegs.forEach(reg => {
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
        discMap[disc].minutes   += min;
        discMap[disc].questions += qst;
        discMap[disc].correct   += correct;
        const topicKey = `${isReview ? 'review' : 'study'}::${topic}`;
        if (!discMap[disc].topics[topicKey]) discMap[disc].topics[topicKey] = { name: topic, minutes: 0, questions: 0, correct: 0, isReview };
        discMap[disc].topics[topicKey].minutes   += min;
        discMap[disc].topics[topicKey].questions += qst;
        discMap[disc].topics[topicKey].correct   += correct;
      }
    });

    const discItems = Object.values(discMap).map((d, i) => ({
      name: d.name, minutes: d.minutes, questions: d.questions, correct: d.correct,
      color: CHART_COLORS[i % CHART_COLORS.length],
      topics: Object.values(d.topics),
      hasReview: Object.values(d.topics).some((topic) => topic.isReview),
      isSimulado: false,
    }));

    const simItems = Object.values(simuladosMap).map((s, i) => ({
      name: s.titulo, minutes: s.minutes, questions: s.questions, correct: s.correct,
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

  const donutSegments = data.items.map((item, i) => ({
    name: item.name, value: item.minutes, color: item.color,
    displayValue: formatTime(item.minutes),
  }));

  const metricConfig = {
    gradient: 'from-red-600 to-rose-700',
    shadow: 'shadow-red-500/10',
  };

  const chartSize = expandedView
    ? (data.totalQuestions > 0 ? 190 : 240)
    : (data.totalQuestions > 0 ? (compact ? 116 : 136) : (compact ? 170 : 204));
  const cardHeightClass = expandedView ? 'min-h-0' : 'h-full';

  return (
    <>
    <div className={`group relative flex flex-col overflow-hidden rounded-xl border-2 border-l-4 border-zinc-200 !border-l-red-500/20 bg-white transition-all duration-300 hover:border-accent-light/40 hover:!border-l-red-500 hover:shadow-[0_0_18px_rgba(239,68,68,0.07)] dark:border-white/10 dark:!border-l-red-500/25 dark:hover:border-accent-light/20 dark:hover:!border-l-red-500 dark:bg-zinc-950 dark:hover:shadow-[0_0_22px_rgba(239,68,68,0.08)] ${expandedView ? 'w-full shadow-2xl shadow-red-950/15' : 'hover:-translate-y-0.5'} ${cardHeightClass} z-20`}>
      {/* Decorative Orbs */}
      <div className={`pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full blur-[80px] opacity-10 transition-all duration-700 group-hover:opacity-16 bg-gradient-to-br ${metricConfig.gradient}`} />
      <div className="pointer-events-none absolute -bottom-20 -left-20 h-64 w-64 rounded-full bg-zinc-500/5 blur-[80px] opacity-40 transition-all duration-700" />

      {/* Header */}
      <div className={`relative z-10 flex items-center justify-between border-b border-zinc-100 dark:border-white/5 bg-zinc-50/30 dark:bg-transparent ${expandedView ? 'px-6 py-5' : compact ? 'px-4 py-3' : 'px-5 py-3.5'}`}>
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className={`absolute inset-0 animate-ping rounded-full opacity-20 duration-[3s] bg-gradient-to-br ${metricConfig.gradient}`} />
            <div className={`relative flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br ${metricConfig.gradient} text-white shadow-xl ${metricConfig.shadow}`}>
              <Clock size={18} strokeWidth={2.2} />
            </div>
          </div>
          <div>
            <h3 className="text-lg font-black uppercase tracking-tight text-zinc-900 dark:text-white leading-tight">
              Estudo <span className={`bg-gradient-to-r ${metricConfig.gradient} bg-clip-text text-transparent`}>de Hoje</span>
            </h3>
            {expandedView && (
              <p className="mt-1 text-[10px] font-black uppercase tracking-[0.22em] text-zinc-400">
                Resumo para compartilhar
              </p>
            )}
          </div>
        </div>
      </div>

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
            {/* Top Section: Donut & Stats Side-by-Side */}
            <div className={`flex items-center ${
              data.totalQuestions > 0
                ? expandedView ? 'gap-6 justify-center' : 'gap-3 justify-start'
                : expandedView ? 'justify-center gap-6' : 'justify-center gap-3'
            }`}>
              <div className="relative shrink-0">
                <InteractiveDonutBig
                  segments={donutSegments}
                  total={data.totalMinutes}
                  hoveredIndex={hoveredHour}
                  onHover={setHoveredHour}
                  centerLabel={formatTime(data.totalMinutes)}
                  centerSub="total"
                  size={chartSize}
                />
              </div>

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

            {/* Bottom Section: Disciplines List */}
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
    </>
  );
};

// ============================================================================
// COMPONENTE PRINCIPAL — apenas TodayChart (Ranking foi para Desempenho)
// ============================================================================
export default function HomeSessao2({ registrosEstudo, wide = false, compact = false, className = '' }) {
  return (
    <div className={`w-full h-full ${className}`}>
      <TodayChart registrosEstudo={registrosEstudo} wide={wide} compact={compact} />
    </div>
  );
}
