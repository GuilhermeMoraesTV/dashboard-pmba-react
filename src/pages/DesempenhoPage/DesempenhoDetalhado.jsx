import React, { useState, useMemo } from 'react';
import {
  ResponsiveContainer, ScatterChart, Scatter, XAxis, YAxis, ZAxis,
  CartesianGrid, Tooltip, Cell, ReferenceLine
} from 'recharts';
import {
  AlertTriangle, BrainCircuit, Star, BarChart2,
  List, Maximize2, X, Award, Crown, Medal, Crosshair, TrendingUp,
  AlertOctagon, BookOpen, Zap, CheckCircle2, Trophy, ChevronDown, ChevronUp
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// ============================================================================
// HELPERS & STYLES
// ============================================================================
const getAccColor = (acc) => {
  if (acc >= 80) return '#10b981'; // Emerald
  if (acc >= 60) return '#f59e0b'; // Amber
  return '#ef4444'; // Red
};

// Scrollbar estilizada (Fina e moderna)
const customScrollbarClass = "overflow-y-auto pr-2 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-zinc-200 dark:[&::-webkit-scrollbar-thumb]:bg-zinc-700 [&::-webkit-scrollbar-thumb]:rounded-full hover:[&::-webkit-scrollbar-thumb]:bg-zinc-300 dark:hover:[&::-webkit-scrollbar-thumb]:bg-zinc-600";

// ============================================================================
// MATRIX TOOLTIP
// ============================================================================
const MatrixTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null;
  const data = payload[0].payload;
  const acc = data.q > 0 ? Math.round((data.c / data.q) * 100) : 0;
  const color = getAccColor(acc);

  let quadrant = '';
  const avgVol = 15; // Valor de referência visual
  if (acc >= 80) quadrant = data.q >= avgVol ? '✅ Manter domínio' : '🚀 Avançar volume';
  else if (acc >= 60) quadrant = data.q >= avgVol ? '⚡ Otimizar precisão' : '📚 Praticar mais';
  else quadrant = data.q >= avgVol ? '🔥 Revisão urgente' : '📖 Revisar conteúdo';

  return (
    <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700/50 p-3 rounded-xl shadow-2xl text-xs backdrop-blur-sm max-w-[210px] z-50">
      <p className="font-black text-zinc-900 dark:text-white text-[11px] uppercase tracking-wide truncate">{data.assunto}</p>
      <p className="text-zinc-500 text-[10px] mb-2 truncate">{data.disciplina}</p>
      <div className="flex gap-3 mb-2">
        <div>
          <div className="text-[9px] text-zinc-400 uppercase font-bold">Volume</div>
          <div className="font-mono font-bold text-zinc-700 dark:text-zinc-200">{data.q}q</div>
        </div>
        <div className="w-px bg-zinc-200 dark:bg-zinc-700" />
        <div>
          <div className="text-[9px] text-zinc-400 uppercase font-bold">Precisão</div>
          <div className="font-mono font-bold" style={{ color }}>{acc}%</div>
        </div>
      </div>
      <div className="text-[10px] text-zinc-500 dark:text-zinc-400 font-medium">{quadrant}</div>
      <div className="mt-2 h-1 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
        <div className="h-full rounded-full" style={{ width: `${acc}%`, backgroundColor: color }} />
      </div>
    </div>
  );
};

// ============================================================================
// MATRIX CHART
// ============================================================================
const MatrixChart = ({ scatterData, avgVolume }) => (
  <ResponsiveContainer width="100%" height="100%">
    <ScatterChart margin={{ top: 15, right: 20, bottom: 38, left: 5 }}>
      <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" className="dark:stroke-zinc-800" strokeOpacity={0.6} />
      <XAxis
        type="number" dataKey="q" name="Questões" unit="q"
        tick={{ fontSize: 9, fill: '#71717a' }} tickLine={false}
        axisLine={{ stroke: '#e4e4e7' }}
        label={{ value: 'Volume de Questões →', position: 'insideBottom', offset: -8, style: { fontSize: 9, fill: '#71717a', fontWeight: 700, textTransform: 'uppercase' } }}
      />
      <YAxis
        type="number" dataKey="accuracy" name="Precisão" unit="%" domain={[0, 100]}
        tick={{ fontSize: 9, fill: '#71717a' }} tickLine={false}
        axisLine={{ stroke: '#e4e4e7' }}
      />
      <ZAxis type="number" dataKey="q" range={[60, 400]} />
      <Tooltip content={<MatrixTooltip />} cursor={{ stroke: '#00000010', strokeDasharray: '3 3' }} />
      <ReferenceLine y={80} stroke="#10b981" strokeDasharray="4 4" strokeOpacity={0.5}
        label={{ value: '80% meta', position: 'insideRight', fill: '#10b98199', fontSize: 9, fontWeight: 700 }} />
      <ReferenceLine y={60} stroke="#ef4444" strokeDasharray="4 4" strokeOpacity={0.35}
        label={{ value: '60% crítico', position: 'insideRight', fill: '#ef444499', fontSize: 9, fontWeight: 700 }} />
      <ReferenceLine x={avgVolume} stroke="#a1a1aa" strokeDasharray="3 3" strokeOpacity={0.4} />
      <Scatter name="Tópicos" data={scatterData}>
        {scatterData.map((entry, index) => (
          <Cell key={`cell-${index}`}
            fill={getAccColor(entry.accuracy)}
            fillOpacity={0.75}
            stroke={getAccColor(entry.accuracy)}
            strokeOpacity={0.3}
            strokeWidth={1}
          />
        ))}
      </Scatter>
    </ScatterChart>
  </ResponsiveContainer>
);

// ============================================================================
// PRIORITY MATRIX (Com Painel Tático Completo)
// ============================================================================
const PriorityMatrix = ({ tableData }) => {
  const [isExpanded, setIsExpanded] = useState(false);

  const scatterData = useMemo(() =>
    (tableData || [])
      .filter(t => t.q > 0)
      .map(t => ({
        ...t,
        accuracy: Math.round((t.c / t.q) * 100)
      }))
  , [tableData]);

  const avgVolume = useMemo(() => {
    if (!scatterData.length) return 15;
    return Math.round(scatterData.reduce((a, b) => a + b.q, 0) / scatterData.length);
  }, [scatterData]);

  // Análise Tática Completa (4 Quadrantes)
  const tacticalAnalysis = useMemo(() => {
    // 1. Crítico: Precisão Baixa (<60)
    const critical = scatterData.filter(d => d.accuracy < 60).sort((a,b) => b.q - a.q); // Ordena por volume (mais urgentes primeiro)

    // 2. Praticar: Precisão Média (60-79)
    const practice = scatterData.filter(d => d.accuracy >= 60 && d.accuracy < 80).sort((a,b) => a.accuracy - b.accuracy); // Ordena por menor precisão

    // 3. Avançar: Precisão Alta (>80) mas pouco volume (Abaixo da média)
    const advance = scatterData.filter(d => d.accuracy >= 80 && d.q < avgVolume).sort((a,b) => a.q - b.q); // Menor volume primeiro

    // 4. Dominado: Precisão Alta (>80) e bom volume
    const mastered = scatterData.filter(d => d.accuracy >= 80 && d.q >= avgVolume).sort((a,b) => b.accuracy - a.accuracy);

    return { critical, practice, advance, mastered };
  }, [scatterData, avgVolume]);

  const quadrantBadges = [
    { label: 'Dominado', count: tacticalAnalysis.mastered.length, color: '#10b981' },
    { label: 'Avançar',  count: tacticalAnalysis.advance.length,  color: '#60a5fa' },
    { label: 'Praticar', count: tacticalAnalysis.practice.length, color: '#f59e0b' },
    { label: 'Crítico',  count: tacticalAnalysis.critical.length, color: '#ef4444' },
  ];

  // Componente de Item da Lista
  const TopicListItem = ({ topic, type }) => {
    const configs = {
        critical: { border: 'border-l-red-500', bg: 'bg-red-50 dark:bg-red-900/10', text: 'text-red-700 dark:text-red-400', accColor: 'text-red-600' },
        practice: { border: 'border-l-amber-500', bg: 'bg-amber-50 dark:bg-amber-900/10', text: 'text-amber-700 dark:text-amber-400', accColor: 'text-amber-600' },
        advance:  { border: 'border-l-blue-500', bg: 'bg-blue-50 dark:bg-blue-900/10', text: 'text-blue-700 dark:text-blue-400', accColor: 'text-blue-600' },
        mastered: { border: 'border-l-emerald-500', bg: 'bg-emerald-50 dark:bg-emerald-900/10', text: 'text-emerald-700 dark:text-emerald-400', accColor: 'text-emerald-600' },
    };
    const cfg = configs[type];

    return (
        <div className={`p-2.5 mb-2 bg-white dark:bg-zinc-900 border-l-[3px] rounded-r-lg shadow-sm flex justify-between items-center group hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors ${cfg.border}`}>
            <div className="min-w-0 pr-3">
                <span className="block text-xs font-bold text-zinc-800 dark:text-zinc-200 truncate" title={topic.assunto}>{topic.assunto}</span>
                <span className="block text-[10px] text-zinc-500 truncate">{topic.disciplina}</span>
            </div>
            <div className="text-right flex flex-col items-end min-w-[60px]">
                <span className={`text-xs font-black ${cfg.accColor}`}>{topic.accuracy}%</span>
                <span className="text-[10px] font-mono text-zinc-400">{topic.q}q</span>
            </div>
        </div>
    );
  };

  return (
    <>
      {/* ── MODAL EXPANDIDO (WAR ROOM) ── */}
      <AnimatePresence>
        {isExpanded && (
          <div
            className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-md flex items-center justify-center p-4"
            onClick={() => setIsExpanded(false)}
          >
            <motion.div
              initial={{ scale: 0.94, opacity: 0, y: 12 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.94, opacity: 0 }}
              transition={{ type: 'spring', bounce: 0.18 }}
              className="bg-white dark:bg-zinc-950 w-full max-w-[95vw] h-[90vh] rounded-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden shadow-2xl flex flex-col"
              onClick={e => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/70 shrink-0">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-red-500/10 rounded-xl">
                    <BrainCircuit size={20} className="text-red-500" strokeWidth={2.5} />
                  </div>
                  <div>
                    <h2 className="text-lg font-black text-zinc-900 dark:text-white uppercase tracking-tight">Detalhamento da Matriz</h2>
                    <p className="text-xs text-zinc-500 mt-0.5">Análise Tática Completa ({scatterData.length} tópicos)</p>
                  </div>
                </div>
                <button onClick={() => setIsExpanded(false)} className="p-2 text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-full transition-colors">
                  <X size={20} />
                </button>
              </div>

              {/* Body: Grid Layout */}
              <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">

                {/* ESQUERDA: Gráfico (Visual) */}
                <div className="flex-1 p-6 relative border-b lg:border-b-0 lg:border-r border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 flex flex-col">
                   <div className="flex-1 min-h-[300px]">
                       {scatterData.length > 0 ? (
                          <MatrixChart scatterData={scatterData} avgVolume={avgVolume} />
                       ) : (
                          <div className="h-full flex items-center justify-center text-zinc-500">Sem dados.</div>
                       )}
                   </div>
                   {/* Legenda do Gráfico */}
                   <div className="mt-4 flex justify-center gap-4 text-[10px] text-zinc-500">
                      <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-emerald-500"></div>Dominado (&gt;80%)</span>
                      <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-amber-500"></div>Atenção (60-80%)</span>
                      <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-red-500"></div>Crítico (&lt;60%)</span>
                   </div>
                </div>

                {/* DIREITA: Painel Tático (Dados) */}
                <div className="w-full lg:w-[420px] bg-zinc-50/50 dark:bg-black/20 flex flex-col border-l border-zinc-100 dark:border-zinc-800">

                    {/* KPI Grid */}
                    <div className="p-5 border-b border-zinc-200 dark:border-zinc-800 grid grid-cols-2 gap-3 bg-white dark:bg-zinc-900/50">
                        <div className="p-3 bg-red-50 dark:bg-red-900/10 border border-red-100 dark:border-red-900/30 rounded-xl flex items-center justify-between">
                            <div>
                                <span className="text-[10px] font-bold text-red-600 dark:text-red-400 uppercase block">Críticos</span>
                                <span className="text-2xl font-black text-red-700 dark:text-red-300">{tacticalAnalysis.critical.length}</span>
                            </div>
                            <AlertOctagon size={20} className="text-red-400 dark:text-red-500/50" />
                        </div>
                        <div className="p-3 bg-amber-50 dark:bg-amber-900/10 border border-amber-100 dark:border-amber-900/30 rounded-xl flex items-center justify-between">
                            <div>
                                <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 uppercase block">Praticar</span>
                                <span className="text-2xl font-black text-amber-700 dark:text-amber-300">{tacticalAnalysis.practice.length}</span>
                            </div>
                            <TrendingUp size={20} className="text-amber-400 dark:text-amber-500/50" />
                        </div>
                        <div className="p-3 bg-blue-50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-900/30 rounded-xl flex items-center justify-between">
                            <div>
                                <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400 uppercase block">Avançar</span>
                                <span className="text-2xl font-black text-blue-700 dark:text-blue-300">{tacticalAnalysis.advance.length}</span>
                            </div>
                            <Zap size={20} className="text-blue-400 dark:text-blue-500/50" />
                        </div>
                        <div className="p-3 bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-100 dark:border-emerald-900/30 rounded-xl flex items-center justify-between">
                            <div>
                                <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase block">Dominados</span>
                                <span className="text-2xl font-black text-emerald-700 dark:text-emerald-300">{tacticalAnalysis.mastered.length}</span>
                            </div>
                            <Award size={20} className="text-emerald-400 dark:text-emerald-500/50" />
                        </div>
                    </div>

                    {/* Lista Completa com Scroll */}
                    <div className={`flex-1 p-4 ${customScrollbarClass}`}>

                        {/* 1. Críticos */}
                        {tacticalAnalysis.critical.length > 0 && (
                            <div className="mb-6">
                                <h5 className="flex items-center gap-2 text-xs font-black text-red-600 dark:text-red-400 mb-3 uppercase tracking-tight sticky top-0 bg-zinc-50 dark:bg-zinc-950 py-1 z-10">
                                    <AlertOctagon size={14} /> Prioridade Máxima
                                </h5>
                                {tacticalAnalysis.critical.map((t, i) => <TopicListItem key={i} topic={t} type="critical" />)}
                            </div>
                        )}

                        {/* 2. Praticar */}
                        {tacticalAnalysis.practice.length > 0 && (
                            <div className="mb-6">
                                <h5 className="flex items-center gap-2 text-xs font-black text-amber-600 dark:text-amber-400 mb-3 uppercase tracking-tight sticky top-0 bg-zinc-50 dark:bg-zinc-950 py-1 z-10">
                                    <TrendingUp size={14} /> Melhorar Precisão
                                </h5>
                                {tacticalAnalysis.practice.map((t, i) => <TopicListItem key={i} topic={t} type="practice" />)}
                            </div>
                        )}

                        {/* 3. Avançar */}
                        {tacticalAnalysis.advance.length > 0 && (
                            <div className="mb-6">
                                <h5 className="flex items-center gap-2 text-xs font-black text-blue-600 dark:text-blue-400 mb-3 uppercase tracking-tight sticky top-0 bg-zinc-50 dark:bg-zinc-950 py-1 z-10">
                                    <Zap size={14} /> Aumentar Volume
                                </h5>
                                {tacticalAnalysis.advance.map((t, i) => <TopicListItem key={i} topic={t} type="advance" />)}
                            </div>
                        )}

                        {/* 4. Dominados */}
                        {tacticalAnalysis.mastered.length > 0 && (
                            <div className="mb-4">
                                <h5 className="flex items-center gap-2 text-xs font-black text-emerald-600 dark:text-emerald-400 mb-3 uppercase tracking-tight sticky top-0 bg-zinc-50 dark:bg-zinc-950 py-1 z-10">
                                    <CheckCircle2 size={14} /> Zona de Excelência
                                </h5>
                                {tacticalAnalysis.mastered.map((t, i) => <TopicListItem key={i} topic={t} type="mastered" />)}
                            </div>
                        )}

                        {scatterData.length === 0 && (
                            <div className="text-center text-zinc-400 py-10 text-sm">
                                Nenhum dado para exibir no resumo.
                            </div>
                        )}
                    </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── CARD NORMAL (Adaptado para Mobile/Desktop) ── */}
      <div className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5 h-full min-h-[450px] flex flex-col relative group">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-red-500/10 rounded-xl">
              <BrainCircuit size={17} className="text-red-500" strokeWidth={2.5} />
            </div>
            <div>
              <h3 className="text-sm font-black text-zinc-900 dark:text-white uppercase tracking-tight">Matriz Estratégica</h3>
              <p className="text-[10px] text-zinc-500 mt-0.5">
                {scatterData.length} tópicos · Volume × Precisão
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
             <button
              onClick={() => setIsExpanded(true)}
              className="p-1.5 text-zinc-400 hover:text-red-500 hover:bg-red-500/10 rounded-lg border border-zinc-200 dark:border-zinc-700 hover:border-red-500/30 transition-all"
              title="Expandir Matriz"
            >
              <Maximize2 size={14} />
            </button>
          </div>
        </div>

        {/* Labels Flutuantes ao passar o mouse */}
        <div className="absolute top-16 right-6 z-10 flex flex-col gap-1 items-end pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-300">
            {quadrantBadges.map(q => (
                <span key={q.label} className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-white/90 dark:bg-black/80 border shadow-sm backdrop-blur-sm" style={{ color: q.color, borderColor: `${q.color}40` }}>
                    {q.label}: {q.count}
                </span>
            ))}
        </div>

        <div className="flex-1 w-full min-h-[300px] relative">
          {scatterData.length > 0 ? (
            <MatrixChart scatterData={scatterData} avgVolume={avgVolume} />
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-zinc-400 dark:text-zinc-700">
              <BrainCircuit size={36} className="mb-2 opacity-30" />
              <p className="text-xs font-medium">Registre sessões de estudo para visualizar.</p>
            </div>
          )}
        </div>
      </div>
    </>
  );
};

// ============================================================================
// PODIUM CARD (top 3 no modo "best") - ESTILO PADRONIZADO HOME
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
    <motion.div
      initial={{ opacity: 0, y: 14, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 8 }}
      transition={{ delay: (rank - 1) * 0.06, duration: 0.28, ease: 'easeOut' }}
      className={`relative overflow-hidden rounded-xl border p-3 ${cfg.bg} ${cfg.border} shadow-sm`}
    >
      <div className="flex items-start justify-between mb-2">
        <div className={`p-1.5 rounded-lg ${cfg.iconBg}`}>
          <Icon size={14} className={cfg.iconColor} strokeWidth={2.5} />
        </div>
        <span className={`text-[9px] font-black uppercase tracking-wider ${cfg.label}`}>{cfg.rankLabel}</span>
      </div>
      <p className="text-xs font-black text-zinc-900 dark:text-white leading-tight mb-0.5 truncate" title={item.label}>{item.label}</p>
      <p className="text-[10px] text-zinc-500 truncate mb-2">{item.sub}</p>

      <div className="flex flex-col items-end justify-end mt-1">
        <span className="text-[8px] font-bold text-zinc-400 uppercase tracking-wider mb-0.5">% Acertos</span>
        <span className="text-lg font-black leading-none" style={{ color }}>{acc}%</span>
      </div>

      <div className="mt-1.5 h-1.5 bg-black/5 dark:bg-white/5 rounded-full overflow-hidden">
        <motion.div className="h-full rounded-full" style={{ backgroundColor: color }} initial={{ width: 0 }} animate={{ width: `${acc}%` }} transition={{ delay: (rank - 1) * 0.06 + 0.2, duration: 0.7, ease: 'easeOut' }} />
      </div>
    </motion.div>
  );
};

// ============================================================================
// ENHANCED RANKING - PADRONIZADO COM SESSÃO 2 DA HOME
// ============================================================================
const EnhancedRanking = ({ tableData }) => {
  const [rankType, setRankType] = useState('topics');
  const [rankSort, setRankSort] = useState('best');

  const disciplineData = useMemo(() => {
    const groups = {};
    (tableData || []).forEach(t => {
      if (!groups[t.disciplina]) groups[t.disciplina] = { name: t.disciplina, totalQ: 0, totalC: 0, topicsCount: 0 };
      groups[t.disciplina].totalQ += t.q;
      groups[t.disciplina].totalC += t.c;
      groups[t.disciplina].topicsCount += 1;
    });
    return Object.values(groups).map(g => ({
      label: g.name,
      sub: `${g.topicsCount} assunto${g.topicsCount > 1 ? 's' : ''} estudado${g.topicsCount > 1 ? 's' : ''}`,
      q: g.totalQ,
      accuracy: g.totalQ > 0 ? (g.totalC / g.totalQ) * 100 : 0,
    }));
  }, [tableData]);

  const topicData = useMemo(() =>
    (tableData || []).filter(t => t.q >= 1).map(t => ({
      label: t.assunto,
      sub: t.disciplina,
      q: t.q,
      accuracy: t.q > 0 ? (t.c / t.q) * 100 : 0,
    }))
  , [tableData]);

  const items = useMemo(() => {
    const src = rankType === 'topics' ? topicData : disciplineData;
    const sorted = [...src].sort((a, b) => rankSort === 'best' ? b.accuracy - a.accuracy : a.accuracy - b.accuracy);
    return sorted.slice(0, 10);
  }, [rankType, rankSort, topicData, disciplineData]);

  const isBestMode = rankSort === 'best';
  const podiumItems = isBestMode ? items.slice(0, 3) : [];
  const listItems   = isBestMode ? items.slice(3)    : items;

  const typeButtons = [ { key: 'topics', label: 'Assuntos', icon: BookOpen }, { key: 'disciplines', label: 'Disciplinas', icon: List } ];
  const sortButtons = [
    { key: 'best',   label: 'Melhores', icon: Trophy },
    { key: 'worst',  label: 'Piores',   icon: AlertTriangle }
  ];

  return (
    <div className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-2xl overflow-hidden flex flex-col h-full min-h-[450px]">
      {/* ── HEADER ── */}
      <div className="p-5 border-b border-zinc-100 dark:border-zinc-800 space-y-4 bg-zinc-50/50 dark:bg-zinc-900/30">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-gradient-to-br from-red-500 to-rose-500 rounded-xl shadow-lg shadow-red-500/25">
            <Award size={18} className="text-white" strokeWidth={2.5} />
          </div>
          <div>
            <h3 className="text-sm font-black text-zinc-900 dark:text-white uppercase tracking-tight">Ranking</h3>
            <p className="text-[10px] text-zinc-500 mt-0.5">Análise de acertos acumulados</p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-between gap-2">
          {/* Toggles de Tipo */}
          <div className="flex bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg p-0.5 gap-0.5 w-full sm:w-auto">
            {typeButtons.map(b => (
              <button key={b.key} onClick={() => setRankType(b.key)}
                className={`flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md text-[9px] font-black uppercase tracking-wide transition-all ${rankType === b.key ? 'bg-red-500 text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 hover:bg-white/50 dark:hover:bg-zinc-800'}`}>
                <b.icon size={9} strokeWidth={2.5} />{b.label}
              </button>
            ))}
          </div>

          {/* Toggles de Ordenação */}
          <div className="flex bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg p-0.5 gap-0.5 w-full sm:w-auto">
            {sortButtons.map(b => {
              const isActive = rankSort === b.key;
              let activeClass = isActive ? (b.key === 'best' ? "bg-emerald-500 text-white shadow-sm shadow-emerald-500/25" : "bg-white dark:bg-zinc-700 text-red-500 shadow-sm") : "text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 hover:bg-white/50 dark:hover:bg-zinc-800";
              return (
                <button key={b.key} onClick={() => setRankSort(b.key)}
                  className={`flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md text-[9px] font-black uppercase tracking-wide transition-all ${activeClass}`}>
                  <b.icon size={9} strokeWidth={2.5} />{b.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── CONTENT ── */}
      <div className={`flex-1 ${customScrollbarClass}`}>
        <AnimatePresence mode="wait">
          <motion.div key={`${rankType}-${rankSort}`} initial={{ opacity: 0, y: 3 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -3 }} transition={{ duration: 0.14 }}>
            {items.length === 0 && <div className="py-10 text-center text-zinc-400 dark:text-zinc-600 text-xs font-bold">Sem dados suficientes.</div>}

            {/* PÓDIO */}
            {isBestMode && podiumItems.length > 0 && (
              <div className="px-1 pb-3 border-b border-zinc-100 dark:border-zinc-800/50 mb-2 mt-4">
                <div className="text-[9px] font-black text-zinc-400 uppercase tracking-widest mb-2 flex items-center gap-1 px-3">
                  <Crown size={9} className="text-amber-500" /> Pódio
                </div>
                <div className="grid grid-cols-3 gap-1.5 px-3">
                  {podiumItems.map((item, i) => <PodiumCard key={item.label} item={item} rank={i + 1} />)}
                </div>
              </div>
            )}

            {/* LISTA GERAL */}
            <div className="flex flex-col gap-1 p-2">
              {listItems.length > 0 && (
                <div className="flex items-center justify-between px-3 pb-1 mb-1">
                  <span className="text-[9px] font-black text-zinc-400 uppercase tracking-widest">
                    {rankType === 'topics' ? 'Assunto' : 'Disciplina'}
                  </span>
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
// COMPONENTE PRINCIPAL (DETALHADO)
// ============================================================================
const DesempenhoDetalhado = ({ tableData }) => (
  <div className="flex flex-col gap-6 xl:col-span-3">
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 h-auto xl:h-[500px]">
      <PriorityMatrix tableData={tableData} />
      <EnhancedRanking tableData={tableData} />
    </div>
  </div>
);

export default DesempenhoDetalhado;