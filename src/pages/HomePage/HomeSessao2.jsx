import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Clock, Target, List, BarChart2, CheckCircle2, XCircle,
  Crown, Medal, Award, Trophy, AlertTriangle, BookOpen, ChevronDown, ChevronUp
} from 'lucide-react';

const CHART_COLORS = [
  '#ef4444','#f97316','#3b82f6','#10b981','#8b5cf6','#ec4899','#06b6d4','#eab308',
];

const customScrollbarClass = "overflow-y-auto pr-1 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-zinc-200 dark:[&::-webkit-scrollbar-thumb]:bg-zinc-700 [&::-webkit-scrollbar-thumb]:rounded-full";

const dateToYMD_local = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const formatTime = (minutes) => {
  if (!minutes || minutes === 0) return '0m';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h > 0) return `${h}h${m > 0 ? ` ${m}m` : ''}`;
  return `${m}m`;
};

const getAccColor = (acc) => {
  if (acc >= 80) return '#10b981';
  if (acc >= 60) return '#f59e0b';
  return '#ef4444';
};

// ============================================================================
// DONUT CHART
// ============================================================================
const InteractiveDonutBig = ({ segments, total, hoveredIndex, onHover, centerLabel, centerSub }) => {
  const SIZE = 220, C = SIZE / 2, R = 85, STROKE = 22, STROKE_HOV = 28;
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
              className="flex flex-col items-center gap-0.5 px-1 text-center">
              <span className="text-2xl font-black leading-none" style={{ color: hovered.color }}>{hovered.displayValue}</span>
              <span className="text-xs font-bold leading-tight max-w-[120px] text-center truncate px-2" style={{ color: hovered.color, opacity: 0.8 }}>{hovered.name}</span>
              <span className="text-xs font-black text-zinc-400 mt-1">{(hovered.pct * 100).toFixed(0)}%</span>
            </motion.div>
          ) : (
            <motion.div key="tot" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }} className="flex flex-col items-center gap-0.5">
              <span className="text-3xl font-black leading-none text-zinc-900 dark:text-white tracking-tighter">{centerLabel}</span>
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
const TodayChart = ({ registrosEstudo }) => {
  const [hoveredHour, setHoveredHour] = useState(null);
  const [expandedIndex, setExpandedIndex] = useState(null);

  const todayStr = useMemo(() => dateToYMD_local(new Date()), []);

  const dateFormatted = useMemo(() => {
    const date = new Date();
    const options = { weekday: 'long', day: 'numeric', month: 'long' };
    const dateString = date.toLocaleDateString('pt-BR', options);
    return dateString.charAt(0).toUpperCase() + dateString.slice(1);
  }, []);

  const data = useMemo(() => {
    const todayRegs = (registrosEstudo || []).filter(r => r.data === todayStr);
    const byDisc = {};
    let totalMinutes = 0;

    todayRegs.forEach(reg => {
      const disc = reg.disciplinaNome || 'Geral';
      const topic = reg.assuntoNome || reg.assunto || 'Estudo Geral';
      const h = Number(reg.tempoEstudadoMinutos) || 0;
      totalMinutes += h;
      if (!byDisc[disc]) byDisc[disc] = { name: disc, minutes: 0, topics: {} };
      byDisc[disc].minutes += h;
      if (!byDisc[disc].topics[topic]) byDisc[disc].topics[topic] = { name: topic, minutes: 0 };
      byDisc[disc].topics[topic].minutes += h;
    });

    const sorted = Object.values(byDisc).sort((a, b) => b.minutes - a.minutes);

    const hourSegs = sorted.filter(d => d.minutes > 0).map((d, i) => ({
      name: d.name,
      value: d.minutes,
      color: CHART_COLORS[i % CHART_COLORS.length],
      displayValue: formatTime(d.minutes),
      pct: totalMinutes > 0 ? d.minutes / totalMinutes : 0,
      topics: Object.values(d.topics).sort((a, b) => b.minutes - a.minutes),
    }));

    return { hourSegs, totalMinutes };
  }, [registrosEstudo, todayStr]);

  const isEmpty = data.totalMinutes === 0;

  return (
    <div className="dashboard-card h-full flex flex-col p-4 md:p-5 gap-4 relative overflow-visible border-l-4 border-transparent hover:border-red-500 transition-all duration-300 group z-20">

      {/* Header */}
      <div className="flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-gradient-to-br from-red-500 to-rose-500 rounded-xl shadow-lg shadow-red-500/25">
            <Clock size={35} className="text-white" strokeWidth={2.5} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-[12px] font-black uppercase tracking-[0.18em] bg-gradient-to-r from-red-600 to-rose-600 dark:from-red-400 dark:to-rose-400 bg-clip-text text-transparent">
                Estudo do dia
              </h3>
              <span className="text-[12px] font-bold text-zinc-300 dark:text-zinc-600 uppercase tracking-widest border-l border-zinc-200 dark:border-zinc-700 pl-2">
                {dateFormatted}
              </span>
            </div>
            <p className="text-[10px] text-zinc-400 font-medium mt-0.5">
              {isEmpty ? 'Sem registros' : `${formatTime(data.totalMinutes)} totais`}
            </p>
          </div>
        </div>
      </div>

      {isEmpty ? (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center justify-center py-12 gap-3 flex-1">
          <div className="w-16 h-16 rounded-full bg-zinc-100 dark:bg-zinc-800/60 flex items-center justify-center">
            <BarChart2 size={32} className="text-zinc-300 dark:text-zinc-600" strokeWidth={1.5} />
          </div>
          <div className="text-center">
            <p className="text-xs font-bold text-zinc-400 dark:text-zinc-500">Nenhum estudo hoje</p>
            <p className="text-[10px] text-zinc-300 dark:text-zinc-700 mt-0.5">Inicie um ciclo para registrar</p>
          </div>
        </motion.div>
      ) : (
        <div className="flex flex-col items-center gap-6 flex-1">

          {/* Donut */}
          <div className="py-2 shrink-0">
            <InteractiveDonutBig
              segments={data.hourSegs}
              total={data.totalMinutes}
              hoveredIndex={hoveredHour}
              onHover={setHoveredHour}
              centerLabel={formatTime(data.totalMinutes)}
              centerSub="TEMPO TOTAL"
            />
          </div>

          {/* Lista de disciplinas — sempre 1 coluna */}
          <div className="w-full flex-1 overflow-y-auto pr-1">
            <div className="flex items-center justify-between px-2 pb-1 border-b border-zinc-100 dark:border-zinc-800/50 mb-1.5">
              <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Disciplinas Estudadas</span>
            </div>

            {/* ✅ flex flex-col — sempre uma coluna em qualquer tela */}
            <div className="flex flex-col gap-2">
              {data.hourSegs.map((seg, i) => (
                <div
                  key={i}
                  className="w-full flex flex-col bg-zinc-50/50 dark:bg-zinc-900/30 rounded-xl border border-zinc-100 dark:border-zinc-800/50 overflow-hidden transition-all hover:border-red-200 dark:hover:border-red-900/30"
                >
                  {/* Linha principal da disciplina */}
                  <div
                    className="flex items-center gap-2.5 px-2.5 py-2 cursor-pointer hover:bg-white dark:hover:bg-zinc-800/50 transition-colors"
                    onMouseEnter={() => setHoveredHour(i)}
                    onMouseLeave={() => setHoveredHour(null)}
                    onClick={() => setExpandedIndex(expandedIndex === i ? null : i)}
                  >
                    <div className="w-2 h-2 rounded-full shrink-0 shadow-sm" style={{ backgroundColor: seg.color }} />

                    <div className="flex-1 min-w-0 flex flex-col gap-0.5">
                      {/* Nome completo — sem truncate, quebra linha se necessário */}
                      <div className="flex items-start justify-between gap-2">
                        <span className="text-[11px] font-bold text-zinc-700 dark:text-zinc-200 leading-snug break-words min-w-0">
                          {seg.name}
                        </span>
                        <span className="text-[11px] font-black text-zinc-900 dark:text-white tabular-nums shrink-0">
                          {seg.displayValue}
                        </span>
                      </div>
                      {/* Barra de progresso */}
                      <div className="w-full h-1 bg-zinc-200 dark:bg-zinc-700 rounded-full overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: `${seg.pct * 100}%`, backgroundColor: seg.color }} />
                      </div>
                    </div>

                    <div className="text-zinc-400 shrink-0">
                      {expandedIndex === i ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
                    </div>
                  </div>

                  {/* Expansão de assuntos */}
                  <AnimatePresence>
                    {expandedIndex === i && seg.topics.length > 0 && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="bg-white/50 dark:bg-zinc-900/50 border-t border-zinc-100 dark:border-zinc-800/50"
                      >
                        <div className="px-2.5 py-1.5 space-y-1">
                          {seg.topics.map((topic, ti) => (
                            <div key={ti} className="flex items-center justify-between text-[11px] pl-1.5 border-l-2" style={{ borderLeftColor: `${seg.color}40` }}>
                              <span className="text-zinc-500 break-words min-w-0 mr-2">{topic.name}</span>
                              <span className="font-mono font-medium text-zinc-600 dark:text-zinc-400 shrink-0">{formatTime(topic.minutes)}</span>
                            </div>
                          ))}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ============================================================================
// RANKING
// ============================================================================
const PodiumCard = ({ item, rank }) => {
  const acc = Math.round(item.accuracy);
  const color = getAccColor(acc);
  const configs = {
    1: { icon: Crown, bg: 'bg-gradient-to-br from-amber-50 to-yellow-100 dark:from-amber-500/10 dark:to-yellow-500/5', border: 'border-amber-300 dark:border-amber-500/30', iconBg: 'bg-amber-100 dark:bg-amber-500/15', iconColor: 'text-amber-500', label: 'text-amber-600 dark:text-amber-400', rankLabel: '1º Lugar' },
    2: { icon: Medal, bg: 'bg-gradient-to-br from-zinc-50 to-zinc-100 dark:from-zinc-700/20 dark:to-zinc-600/10', border: 'border-zinc-300 dark:border-zinc-500/40', iconBg: 'bg-zinc-100 dark:bg-zinc-600/20', iconColor: 'text-zinc-400 dark:text-zinc-300', label: 'text-zinc-500 dark:text-zinc-400', rankLabel: '2º Lugar' },
    3: { icon: Award, bg: 'bg-gradient-to-br from-orange-50 to-amber-50 dark:from-orange-600/10 dark:to-amber-600/5', border: 'border-orange-200 dark:border-orange-600/30', iconBg: 'bg-orange-100 dark:bg-orange-500/15', iconColor: 'text-orange-500 dark:text-orange-400', label: 'text-orange-500 dark:text-orange-400', rankLabel: '3º Lugar' },
  };
  const cfg = configs[rank];
  const Icon = cfg.icon;
  return (
    <motion.div initial={{ opacity: 0, y: 14, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 8 }}
      transition={{ delay: (rank - 1) * 0.06, duration: 0.28, ease: 'easeOut' }}
      className={`relative overflow-hidden rounded-xl border p-3 ${cfg.bg} ${cfg.border} shadow-sm`}>
      <div className="flex items-start justify-between mb-2">
        <div className={`p-1.5 rounded-lg ${cfg.iconBg}`}><Icon size={14} className={cfg.iconColor} strokeWidth={2.5} /></div>
        <span className={`text-[9px] font-black uppercase tracking-wider ${cfg.label}`}>{cfg.rankLabel}</span>
      </div>
      <p className="text-xs font-black text-zinc-900 dark:text-white leading-tight mb-0.5 truncate" title={item.label}>{item.label}</p>
      <p className="text-[10px] text-zinc-500 truncate mb-2">{item.sub}</p>
      <div className="flex flex-col items-end justify-end mt-1">
        <span className="text-[8px] font-bold text-zinc-400 uppercase tracking-wider mb-0.5">% Acertos</span>
        <span className="text-lg font-black leading-none" style={{ color }}>{acc}%</span>
      </div>
      <div className="mt-1.5 h-1.5 bg-black/5 dark:bg-white/5 rounded-full overflow-hidden">
        <motion.div className="h-full rounded-full" style={{ backgroundColor: color }}
          initial={{ width: 0 }} animate={{ width: `${acc}%` }} transition={{ delay: (rank - 1) * 0.06 + 0.2, duration: 0.7, ease: 'easeOut' }} />
      </div>
    </motion.div>
  );
};

const EnhancedRanking = ({ tableData }) => {
  const [rankType, setRankType] = useState('topics');
  const [rankSort, setRankSort] = useState('best');

  const disciplineData = useMemo(() => {
    const groups = {};
    (tableData || []).forEach(t => {
      if (!groups[t.disciplina]) groups[t.disciplina] = { name: t.disciplina, totalQ: 0, totalC: 0, topicsCount: 0 };
      groups[t.disciplina].totalQ += t.q; groups[t.disciplina].totalC += t.c; groups[t.disciplina].topicsCount += 1;
    });
    return Object.values(groups).map(g => ({
      label: g.name, sub: `${g.topicsCount} assunto${g.topicsCount > 1 ? 's' : ''} estudado${g.topicsCount > 1 ? 's' : ''}`,
      q: g.totalQ, accuracy: g.totalQ > 0 ? (g.totalC / g.totalQ) * 100 : 0,
    }));
  }, [tableData]);

  const topicData = useMemo(() =>
    (tableData || []).filter(t => t.q >= 1).map(t => ({ label: t.assunto, sub: t.disciplina, q: t.q, accuracy: t.q > 0 ? (t.c / t.q) * 100 : 0 }))
  , [tableData]);

  const items = useMemo(() => {
    const src = rankType === 'topics' ? topicData : disciplineData;
    if (rankSort === 'best') return [...src].sort((a, b) => b.accuracy - a.accuracy).slice(0, 10);
    return [...src].sort((a, b) => a.accuracy - b.accuracy).slice(0, 10);
  }, [rankType, rankSort, topicData, disciplineData]);

  const isBestMode = rankSort === 'best';
  const podiumItems = isBestMode ? items.slice(0, 3) : [];
  const listItems = isBestMode ? items.slice(3) : items;

  const typeButtons = [{ key: 'topics', label: 'Assuntos', icon: BookOpen }, { key: 'disciplines', label: 'Disciplinas', icon: List }];
  const sortButtons = [{ key: 'best', label: 'Melhores', icon: Trophy }, { key: 'worst', label: 'Piores', icon: AlertTriangle }];

  return (
    <div className="dashboard-card h-full flex flex-col p-4 md:p-5 gap-3 relative overflow-visible border-l-4 border-transparent hover:border-red-500 transition-all duration-300 group z-20">
      <div className="relative z-10 flex flex-col gap-3 shrink-0">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-gradient-to-br from-red-500 to-rose-500 rounded-xl shadow-lg shadow-red-500/25">
            <Award size={35} className="text-white" strokeWidth={2.5} />
          </div>
          <div>
            <h3 className="text-[12px] font-black uppercase tracking-[0.18em] bg-gradient-to-r from-red-600 to-rose-600 dark:from-red-400 dark:to-rose-400 bg-clip-text text-transparent">
              Ranking
            </h3>
            <p className="text-[11px] text-zinc-400 font-medium mt-0.5">
              {items.length > 0 ? `${items.length} ${rankType === 'topics' ? 'assuntos' : 'disciplinas'} estudados` : 'Sem dados ainda'}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
          <div className="flex bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg p-0.5 gap-0.5">
            {typeButtons.map(b => (
              <button key={b.key} onClick={() => setRankType(b.key)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[9px] font-black uppercase tracking-wide transition-all
                  ${rankType === b.key ? 'bg-red-500 text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 hover:bg-white/50 dark:hover:bg-zinc-800'}`}>
                <b.icon size={9} strokeWidth={2.5} />{b.label}
              </button>
            ))}
          </div>
          <div className="flex bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg p-0.5 gap-0.5">
            {sortButtons.map(b => {
              const isActive = rankSort === b.key;
              let activeClass = isActive
                ? (b.key === 'best' ? 'bg-emerald-500 text-white shadow-sm shadow-emerald-500/25' : 'bg-white dark:bg-zinc-700 text-red-500 shadow-sm')
                : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 hover:bg-white/50 dark:hover:bg-zinc-800';
              return (
                <button key={b.key} onClick={() => setRankSort(b.key)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[9px] font-black uppercase tracking-wide transition-all ${activeClass}`}>
                  <b.icon size={9} strokeWidth={2.5} />{b.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className={`flex-1 overflow-y-auto ${customScrollbarClass} min-h-[300px]`}>
        <AnimatePresence mode="wait">
          <motion.div key={`${rankType}-${rankSort}`} initial={{ opacity: 0, y: 3 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -3 }} transition={{ duration: 0.14 }}>
            {items.length === 0 && <div className="py-10 text-center text-zinc-400 dark:text-zinc-600 text-xs font-bold">Sem dados suficientes.</div>}
            {isBestMode && podiumItems.length > 0 && (
              <div className="px-1 pb-3 border-b border-zinc-100 dark:border-zinc-800/50 mb-2">
                <div className="text-[9px] font-black text-zinc-400 uppercase tracking-widest mb-2 flex items-center gap-1 px-1">
                  <Crown size={9} className="text-amber-500" /> Pódio
                </div>
                <div className="grid grid-cols-3 gap-1.5">{podiumItems.map((item, i) => <PodiumCard key={item.label} item={item} rank={i + 1} />)}</div>
              </div>
            )}
            <div className="flex flex-col gap-1">
              {listItems.length > 0 && (
                <div className="flex items-center justify-between px-3 pb-1 mb-1">
                  <span className="text-[9px] font-black text-zinc-400 uppercase tracking-widest">{rankType === 'topics' ? 'Assunto' : 'Disciplina'}</span>
                  <span className="text-[9px] font-black text-zinc-400 uppercase tracking-widest text-right">% de Acertos</span>
                </div>
              )}
              {listItems.map((item, rawIdx) => {
                const i = isBestMode ? rawIdx + 3 : rawIdx;
                const acc = Math.round(item.accuracy);
                const color = getAccColor(acc);
                return (
                  <motion.div key={`${item.label}-${i}`} initial={{ opacity: 0, x: -4 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: rawIdx * 0.02, duration: 0.16 }}
                    className="px-3 py-2 flex items-center gap-2.5 bg-zinc-50/50 dark:bg-zinc-900/30 rounded-lg border border-transparent hover:border-zinc-200 dark:hover:border-zinc-700 hover:bg-white dark:hover:bg-zinc-800/60 transition-all">
                    <span className="text-[10px] font-black text-zinc-300 dark:text-zinc-600 w-4 shrink-0 text-center">{i + 1}</span>
                    <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: color, boxShadow: `0 0 4px ${color}60` }} />
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] font-bold text-zinc-800 dark:text-zinc-200 truncate leading-none">{item.label}</p>
                      <p className="text-[9px] text-zinc-400 dark:text-zinc-600 truncate mt-0.5">{item.sub}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {acc < 60 && item.q >= 3 && <AlertTriangle size={9} className="text-red-500 animate-pulse shrink-0" />}
                      <div className="w-12 flex flex-col gap-0.5">
                        <div className="h-1 bg-zinc-200 dark:bg-zinc-700 rounded-full overflow-hidden">
                          <motion.div className="h-full rounded-full" style={{ backgroundColor: color }}
                            initial={{ width: 0 }} animate={{ width: `${acc}%` }} transition={{ delay: rawIdx * 0.02 + 0.08, duration: 0.45, ease: 'easeOut' }} />
                        </div>
                      </div>
                      <span className="text-[11px] font-black w-7 text-right" style={{ color }}>{acc}%</span>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
};

// ============================================================================
// COMPONENTE PRINCIPAL SESSÃO 2
// ============================================================================
export default function HomeSessao2({ registrosEstudo, tableData }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4 items-stretch">
      <TodayChart registrosEstudo={registrosEstudo} />
      <EnhancedRanking tableData={tableData} />
    </div>
  );
}