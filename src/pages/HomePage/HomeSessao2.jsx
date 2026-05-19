import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Clock, BookOpen, ChevronDown, ChevronUp, Target, CheckCircle2, XCircle,
} from 'lucide-react';

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

const getDonutValueClass = (value) => {
  const length = String(value || '').replace(/\s/g, '').length;
  if (length >= 7) return 'text-[22px]';
  if (length >= 6) return 'text-[24px]';
  if (length >= 5) return 'text-[27px]';
  return 'text-3xl';
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
  const centerValueClass = getDonutValueClass(hovered?.displayValue || centerLabel);

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
              className="flex max-w-[52%] flex-col items-center gap-0.5 px-1 text-center">
              <span className={`${centerValueClass} max-w-full whitespace-nowrap font-black leading-none tracking-tighter`} style={{ color: hovered.color }}>{hovered.displayValue}</span>
              <span className="text-xs font-bold leading-tight max-w-[120px] text-center truncate px-2" style={{ color: hovered.color, opacity: 0.8 }}>{hovered.name}</span>
              <span className="text-xs font-black text-zinc-400 mt-1">{(hovered.pct * 100).toFixed(0)}%</span>
            </motion.div>
          ) : (
            <motion.div key="tot" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }} className="flex max-w-[52%] flex-col items-center gap-0.5">
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
const TodayChart = ({ registrosEstudo, wide = false, compact = false }) => {
  const [hoveredHour, setHoveredHour] = useState(null);
  const [expandedIndex, setExpandedIndex] = useState(null);

  const todayStr = useMemo(() => dateToYMD_local(new Date()), []);

  const dateFormatted = useMemo(() => {
    const date = new Date();
    const s = date.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });
    return s.charAt(0).toUpperCase() + s.slice(1);
  }, []);

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

  return (
    <div className={`dashboard-card h-full min-h-0 overflow-hidden flex flex-col border-l-4 border-transparent hover:border-red-500 transition-all duration-300 ${compact ? 'p-4 gap-3' : 'p-4 md:p-5 gap-4'}`}>
      <div className="flex items-center gap-3 shrink-0">
        <div className="p-2 bg-gradient-to-br from-zinc-800 to-zinc-900 dark:from-zinc-100 dark:to-zinc-200 rounded-xl shadow-lg">
          <Clock size={20} className="text-white dark:text-zinc-900" strokeWidth={2.5} />
        </div>
        <div>
          <h3 className="text-[12px] font-black uppercase tracking-[0.18em] text-zinc-900 dark:text-zinc-100">
            Estudo de Hoje
          </h3>
          <p className="text-[11px] text-zinc-400 font-medium mt-0.5">{dateFormatted}</p>
        </div>
      </div>

      {data.totalMinutes === 0 && data.totalQuestions === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center opacity-30 gap-2 py-8">
          <BookOpen size={36} strokeWidth={1.5} />
          <p className="text-xs font-bold uppercase tracking-widest text-center">Nenhum estudo registrado hoje</p>
        </div>
      ) : (
        <div className={`${wide ? 'flex flex-col md:flex-row md:items-center' : 'flex flex-col items-center'} ${compact ? 'gap-3' : 'gap-4'} flex-1 min-h-0`}>
          <div className={`${wide ? 'md:w-[190px]' : 'w-full'} flex shrink-0 flex-col items-center gap-2`}>
            <div className="flex justify-center">
              <InteractiveDonutBig
                segments={donutSegments}
                total={data.totalMinutes}
                hoveredIndex={hoveredHour}
                onHover={setHoveredHour}
                centerLabel={formatTime(data.totalMinutes)}
                centerSub="hoje"
                size={wide ? 180 : compact ? 165 : 220}
              />
            </div>
            {data.totalQuestions > 0 && (
              <div className="grid w-full grid-cols-3 gap-1.5">
                <div className="rounded-xl border border-zinc-100 bg-zinc-50 px-2 py-1.5 text-center dark:border-zinc-800 dark:bg-zinc-900/50">
                  <div className="mx-auto mb-0.5 flex h-5 w-5 items-center justify-center rounded-lg bg-blue-100 text-blue-600 dark:bg-blue-500/15 dark:text-blue-300">
                    <Target size={11} strokeWidth={2.5} />
                  </div>
                  <p className="text-[12px] font-black leading-none text-zinc-900 dark:text-white">{data.totalQuestions}</p>
                  <p className="mt-0.5 text-[8px] font-black uppercase tracking-wider text-zinc-400">Questões</p>
                </div>
                <div className="rounded-xl border border-emerald-100 bg-emerald-50 px-2 py-1.5 text-center dark:border-emerald-900/30 dark:bg-emerald-500/10">
                  <div className="mx-auto mb-0.5 flex h-5 w-5 items-center justify-center rounded-lg bg-emerald-100 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300">
                    <CheckCircle2 size={11} strokeWidth={2.5} />
                  </div>
                  <p className="text-[12px] font-black leading-none text-emerald-700 dark:text-emerald-300">{data.totalCorrect}</p>
                  <p className="mt-0.5 text-[8px] font-black uppercase tracking-wider text-emerald-600/70 dark:text-emerald-300/70">Acertos</p>
                </div>
                <div className="rounded-xl border border-red-100 bg-red-50 px-2 py-1.5 text-center dark:border-red-900/30 dark:bg-red-500/10">
                  <div className="mx-auto mb-0.5 flex h-5 w-5 items-center justify-center rounded-lg bg-red-100 text-red-600 dark:bg-red-500/15 dark:text-red-300">
                    <XCircle size={11} strokeWidth={2.5} />
                  </div>
                  <p className="text-[12px] font-black leading-none text-red-700 dark:text-red-300">{data.totalWrong}</p>
                  <p className="mt-0.5 text-[8px] font-black uppercase tracking-wider text-red-600/70 dark:text-red-300/70">Erros</p>
                </div>
              </div>
            )}
            {data.totalQuestions > 0 && (
              <div className="flex w-full items-center justify-between rounded-xl bg-zinc-100/70 px-3 py-1.5 dark:bg-zinc-900/70">
                <span className="text-[9px] font-black uppercase tracking-widest text-zinc-400">Precisão</span>
                <span className={`text-xs font-black ${getAccuracyTone(data.accuracy)}`}>{data.accuracy}%</span>
              </div>
            )}
          </div>
          <div className={`${wide ? 'flex-1 max-h-[210px]' : compact ? 'w-full flex-1 min-h-0' : 'w-full max-h-[260px]'} space-y-1.5 ${customScrollbarClass}`}>
            {data.items.map((item, i) => {
              const pct = data.totalMinutes > 0 ? (item.minutes / data.totalMinutes) * 100 : 0;
              const accuracy = item.questions > 0 ? Math.round((item.correct / item.questions) * 100) : 0;
              const wrong = Math.max(0, item.questions - item.correct);
              const isExpanded = expandedIndex === i;
              const hasTopics = item.topics && item.topics.length > 1;
              const primaryTopic = !item.isSimulado && item.topics?.length === 1 ? item.topics[0] : null;
              return (
                <div key={item.name}>
                  <div
                    className={`flex items-center gap-2.5 p-2 rounded-xl transition-all duration-200 group/row ${hasTopics ? 'cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-800/50' : ''} ${hoveredHour === i ? 'bg-zinc-100 dark:bg-zinc-800' : ''}`}
                    onMouseEnter={() => setHoveredHour(i)}
                    onMouseLeave={() => setHoveredHour(null)}
                    onClick={() => hasTopics && setExpandedIndex(isExpanded ? null : i)}
                  >
                    <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1">
                        <div className="min-w-0 flex items-center gap-1.5">
                          {item.hasReview && item.topics.length === 1 && (
                            <span className="shrink-0 rounded-md bg-violet-100 px-1.5 py-0.5 text-[8px] font-black uppercase tracking-wider text-violet-700 dark:bg-violet-500/15 dark:text-violet-300">
                              Revisão
                            </span>
                          )}
                          <p className="text-[11px] font-bold text-zinc-800 dark:text-zinc-200 truncate">{item.name}</p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-[10px] font-black text-zinc-500">{formatTime(item.minutes)}</span>
                          {item.questions > 0 && (
                            <span className="hidden">
                              {item.questions}q · {item.questions > 0 ? Math.round((item.correct / item.questions) * 100) : 0}%
                            </span>
                          )}
                          {hasTopics && (
                            <span className="text-zinc-400 group-hover/row:text-zinc-600 dark:group-hover/row:text-zinc-300 transition-colors">
                              {isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                            </span>
                          )}
                        </div>
                      </div>
                      {primaryTopic && (
                        <p className="mt-0.5 truncate text-[10px] font-medium text-zinc-400">
                          {primaryTopic.name}
                        </p>
                      )}
                      {item.questions > 0 && (
                        <div className="mt-1.5 flex flex-wrap items-center gap-1">
                          <span className="rounded-md bg-zinc-100 px-1.5 py-0.5 text-[8.5px] font-black text-zinc-500 dark:bg-zinc-800 dark:text-zinc-300">{item.questions}q</span>
                          <span className="rounded-md bg-emerald-50 px-1.5 py-0.5 text-[8.5px] font-black text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-300">{item.correct} acertos</span>
                          <span className="rounded-md bg-red-50 px-1.5 py-0.5 text-[8.5px] font-black text-red-500 dark:bg-red-500/10 dark:text-red-300">{wrong} erros</span>
                          <span className={`rounded-md bg-zinc-100 px-1.5 py-0.5 text-[8.5px] font-black dark:bg-zinc-800 ${getAccuracyTone(accuracy)}`}>{accuracy}%</span>
                        </div>
                      )}
                      <div className="mt-1 h-1 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                        <motion.div
                          className="h-full rounded-full"
                          style={{ backgroundColor: item.color }}
                          initial={{ width: 0 }}
                          animate={{ width: `${pct}%` }}
                          transition={{ duration: 0.6, ease: 'easeOut', delay: i * 0.05 }}
                        />
                      </div>
                    </div>
                  </div>
                  <AnimatePresence>
                    {isExpanded && hasTopics && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.2 }}
                        className="ml-5 space-y-1 overflow-hidden"
                      >
                        {item.topics.map(topic => (
                          <div key={topic.name} className="flex items-center justify-between gap-2 px-2 py-1 rounded-lg bg-zinc-50 dark:bg-zinc-800/40">
                            <div className="min-w-0 flex-1 flex items-center gap-1.5">
                              {topic.isReview && (
                                <span className="shrink-0 rounded-md bg-violet-100 px-1.5 py-0.5 text-[8px] font-black uppercase tracking-wider text-violet-700 dark:bg-violet-500/15 dark:text-violet-300">
                                  Revisão
                                </span>
                              )}
                              <p className="text-[10px] text-zinc-600 dark:text-zinc-400 truncate">{topic.name}</p>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <span className="text-[9px] font-bold text-zinc-500">{formatTime(topic.minutes)}</span>
                              {topic.questions > 0 && (
                                <span className="text-[9px] text-zinc-400">{topic.correct}/{topic.questions}q</span>
                              )}
                            </div>
                          </div>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
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
