import React, { useState, useEffect, useMemo } from 'react';
import {
  TrendingUp, TrendingDown, Calendar, AlertTriangle, Zap,
  ArrowUpRight, ArrowDownRight, Activity, Target, Layers, X, Clock, Timer, Scale, History
} from 'lucide-react';
import { motion } from 'framer-motion';

// --- HELPER LOCAL ---
const formatDate = (dateString) => {
  if (!dateString) return '-';
  const [year, month, day] = dateString.split('-');
  return `${day}/${month}/${year}`;
};

const formatDuration = (minutes) => {
  if (minutes === null || minutes === undefined) return '-';
  const totalSeconds = Math.round(minutes * 60);
  if (totalSeconds < 60) return `${totalSeconds}s`;
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
};

const getStatusColor = (status) => {
  switch (status) {
    case 'growth': return 'bg-emerald-100 text-emerald-700 border-emerald-200';
    case 'drop': return 'bg-red-100 text-red-700 border-red-200';
    case 'new': return 'bg-blue-100 text-blue-700 border-blue-200'; // Inédita
    case 'stable': return 'bg-zinc-100 text-zinc-600 border-zinc-200';
    default: return 'bg-zinc-50 text-zinc-400';
  }
};

const ArrowRightIcon = ({ size = 12, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={`text-zinc-300 ${className}`}>
    <path d="M5 12h14" />
    <path d="m12 5 7 7-7 7" />
  </svg>
);

// --- COMPONENTE RADAR MELHORADO (DARK MODE FIX) ---
const SimpleRadarChart = ({ data, colorA, colorB, labelA, labelB }) => {
  const size = 320;
  const center = size / 2;
  const radius = (size / 2) - 50;

  if (!data || data.length < 3) return (
    <div className="flex items-center justify-center h-full text-xs text-zinc-400">Dados insuficientes para radar (min 3 matérias)</div>
  );

  const angleSlice = (Math.PI * 2) / data.length;
  const getCoords = (value, index) => {
    const angle = index * angleSlice - Math.PI / 2;
    const r = (Math.min(value, 100) / 100) * radius;
    return [center + Math.cos(angle) * r, center + Math.sin(angle) * r];
  };

  const buildPath = (key) => {
    const points = data.map((d, i) => getCoords(d[key], i));
    return points.map(p => p.join(',')).join(' ');
  };

  const pathA = buildPath('valA');
  const pathB = buildPath('valB');

  const axes = data.map((_, i) => {
    const [x, y] = getCoords(100, i);
    return (
      <line
        key={i}
        x1={center}
        y1={center}
        x2={x}
        y2={y}
        // AQUI: Classes Tailwind para controle de cor no dark mode
        className="stroke-zinc-200 dark:stroke-zinc-800"
        strokeWidth="1"
        strokeDasharray="4 2"
      />
    );
  });

  const levels = [20, 40, 60, 80, 100];

  return (
    <div className="relative w-full h-full flex flex-col items-center">
      <svg width="100%" height="100%" viewBox={`0 0 ${size} ${size}`} className="overflow-visible font-sans">
        {/* Círculos da Grade */}
        {levels.map(l => (
          <circle
            key={l}
            cx={center}
            cy={center}
            r={(l / 100) * radius}
            fill="none"
            // AQUI: Classes Tailwind para controle de cor no dark mode
            className="stroke-zinc-200 dark:stroke-zinc-800"
            strokeWidth="1"
          />
        ))}

        {axes}

        <motion.polygon initial={{ opacity: 0, scale: 0 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.5 }} points={pathA} fill={colorA} fillOpacity="0.25" stroke={colorA} strokeWidth="2" />
        <motion.polygon initial={{ opacity: 0, scale: 0 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.7, delay: 0.2 }} points={pathB} fill={colorB} fillOpacity="0.2" stroke={colorB} strokeWidth="3" />

        {/* Labels de Texto */}
        {data.map((d, i) => {
          const [x, y] = getCoords(115, i);
          return (
            <text
              key={i}
              x={x}
              y={y}
              textAnchor="middle"
              alignmentBaseline="middle"
              // AQUI: Removido textShadow branco e ajustado fill para dark mode (zinc-300)
              className="text-[9px] font-bold uppercase tracking-wide fill-zinc-500 dark:fill-zinc-300"
            >
              {d.subject.split(' ').slice(0, 2).join(' ')}{d.subject.split(' ').length > 2 ? '...' : ''}
            </text>
          );
        })}
      </svg>

      {/* Legenda */}
      <div className="flex gap-4 mt-2 flex-wrap justify-center">
        <div className="flex items-center gap-2 text-xs font-bold text-zinc-500 dark:text-zinc-400">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: colorA, opacity: 0.5 }} />{labelA}
        </div>
        <div className="flex items-center gap-2 text-xs font-bold text-zinc-800 dark:text-white">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: colorB }} />{labelB}
        </div>
      </div>
    </div>
  );
};

const SimuladoComparisonModal = ({ simuladosSelecionados, onClose }) => {
  if (!simuladosSelecionados || simuladosSelecionados.length < 2) return null;

  const ordered = useMemo(() => {
    return [...simuladosSelecionados].sort((a, b) => new Date(a.data) - new Date(b.data));
  }, [simuladosSelecionados]);

  const base = ordered[0];
  const targets = ordered.slice(1);
  const [activeTargetId, setActiveTargetId] = useState(targets[targets.length - 1]?.id);

  useEffect(() => {
    if (!targets.find(t => t.id === activeTargetId)) {
      setActiveTargetId(targets[targets.length - 1]?.id);
    }
  }, [targets.length, activeTargetId, targets]);

  const target = targets.find(t => t.id === activeTargetId) || targets[targets.length - 1];

  // Scores
  const scoreBase = base?.resumo?.pontosObtidos || 0;
  const scoreTarget = target?.resumo?.pontosObtidos || 0;
  const deltaPontos = scoreTarget - scoreBase;
  const isPositive = deltaPontos >= 0;
  const growthPerc = scoreBase > 0 ? (deltaPontos / scoreBase) * 100 : 100;

  // Time Comparison
  const timeBase = base.durationMinutes || 0;
  const timeTarget = target.durationMinutes || 0;
  const timeDiff = timeBase - timeTarget;
  const isTimeFaster = timeDiff > 0;

  const allDisciplines = useMemo(() => {
    const map = new Map();
    (base?.disciplinas || []).forEach(d => {
      const peso = d.peso || 1;
      map.set(d.nome, { name: d.nome, baseRaw: d.acertos, baseTotal: d.total, basePoints: d.acertos * peso, baseMaxPoints: d.total * peso, targetRaw: 0, targetTotal: 0, targetPoints: 0, targetMaxPoints: 0, weight: peso });
    });
    (target?.disciplinas || []).forEach(d => {
      const peso = d.peso || 1;
      const current = map.get(d.nome) || { name: d.nome, baseRaw: 0, baseTotal: 0, basePoints: 0, baseMaxPoints: 0, weight: peso };
      current.targetRaw = d.acertos;
      current.targetTotal = d.total;
      current.targetPoints = d.acertos * peso;
      current.targetMaxPoints = d.total * peso;
      map.set(d.nome, current);
    });
    return Array.from(map.values()).map(item => {
      const diff = item.targetPoints - item.basePoints;
      const basePerc = item.baseTotal > 0 ? (item.baseRaw / item.baseTotal) * 100 : 0;
      const targetPerc = item.targetTotal > 0 ? (item.targetRaw / item.targetTotal) * 100 : 0;
      let status = 'stable';
      if (item.baseTotal === 0 && item.targetTotal > 0) status = 'new';
      else if (item.baseTotal > 0 && item.targetTotal === 0) status = 'removed';
      else if (diff > 0.5) status = 'growth';
      else if (diff < -0.5) status = 'drop';
      return { ...item, diff, basePerc, targetPerc, status, relevance: Math.abs(diff) + (item.weight * 2) };
    }).sort((a, b) => b.relevance - a.relevance);
  }, [base, target]);

  const radarData = allDisciplines.slice(0, 7).map(d => ({ subject: d.name, valA: d.basePerc, valB: d.targetPerc }));
  const topDrops = useMemo(() => allDisciplines.filter(d => d.diff < -0.5).sort((a, b) => a.diff - b.diff).slice(0, 4), [allDisciplines]);
  const topGrowth = useMemo(() => allDisciplines.filter(d => d.diff > 0.5).sort((a, b) => b.diff - a.diff).slice(0, 4), [allDisciplines]);

  return (
    <div className="fixed inset-0 z-[70] bg-zinc-100/95 dark:bg-black/95 backdrop-blur-xl flex items-center justify-center p-3 md:p-4 animate-fade-in overflow-hidden">
      <div className="bg-white dark:bg-zinc-950 w-full max-w-7xl h-[94vh] md:h-[92vh] rounded-[1.5rem] md:rounded-[2rem] shadow-2xl border border-zinc-200 dark:border-zinc-800 flex flex-col relative overflow-hidden">
        {/* HEADER */}
        <div className="p-4 md:p-6 border-b border-zinc-100 dark:border-zinc-800 bg-white/50 dark:bg-zinc-900/50 backdrop-blur-sm flex justify-between items-center z-20">
          <div className="flex items-center gap-3 md:gap-4 min-w-0">
            <div className="p-2.5 md:p-3 bg-blue-50 dark:bg-blue-900/20 rounded-2xl text-blue-600 border border-blue-100 dark:border-blue-800 shrink-0">
              <TrendingUp size={24} className="md:hidden" /><TrendingUp size={28} className="hidden md:block" />
            </div>
            <div className="min-w-0">
              <h2 className="text-lg md:text-2xl font-black text-zinc-800 dark:text-white uppercase tracking-tight truncate">Análise Evolutiva</h2>
              <div className="flex items-center gap-2 text-xs md:text-sm text-zinc-500 flex-wrap">
                <span className="flex items-center gap-1 bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 rounded text-zinc-600 dark:text-zinc-300 font-bold"><Calendar size={10} /> {formatDate(base.data)}</span>
                <ArrowRightIcon /><span className="flex items-center gap-1 bg-blue-50 dark:bg-blue-900/30 px-2 py-0.5 rounded text-blue-700 dark:text-blue-400 font-bold border border-blue-100 dark:border-blue-800"><Calendar size={10} /> {formatDate(target.data)}</span>
              </div>
              <div className="mt-2 flex items-center gap-2 flex-wrap">
                <span className="text-[10px] md:text-xs font-black bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 px-2.5 py-1 rounded-full truncate max-w-[13rem] md:max-w-none">{base.titulo}</span>
                <ArrowRightIcon size={14} className="text-zinc-400" />
                <span className="text-[10px] md:text-xs font-black bg-blue-600 text-white px-2.5 py-1 rounded-full truncate max-w-[13rem] md:max-w-none">{target.titulo}</span>
              </div>
            </div>
          </div>
          <button onClick={onClose} className="p-2.5 md:p-3 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-full transition-colors group"><X size={22} className="text-zinc-400 group-hover:text-red-500 transition-colors" /></button>
        </div>

        {/* ABAS DE ALVO */}
        {targets.length > 1 && (
          <div className="px-4 md:px-6 py-3 border-b border-zinc-100 dark:border-zinc-800 bg-white/40 dark:bg-zinc-900/30">
            <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
              <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400 mr-2 shrink-0">Comparar com:</span>
              {targets.map(t => {
                const active = t.id === activeTargetId;
                return (
                  <button key={t.id} onClick={() => setActiveTargetId(t.id)} className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-black border transition-all ${active ? 'bg-blue-600 text-white border-blue-600 shadow-lg shadow-blue-600/20' : 'bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-300 border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-900/60'}`} title={`${t.titulo} • ${formatDate(t.data)}`}>{t.titulo}</button>
                );
              })}
            </div>
          </div>
        )}

        {/* CONTEÚDO */}
        <div className="flex-1 overflow-y-auto custom-scrollbar bg-zinc-50/50 dark:bg-zinc-950/50 p-4 md:p-6">

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 md:gap-6 mb-6 md:mb-8">

            {/* COLUNA ESQUERDA (KPIs + TEMPO + ATENÇÃO/POSITIVAS) */}
            <div className="lg:col-span-3 flex flex-col gap-4">

              {/* Card 1: Variação Líquida */}
              <div className={`p-4 md:p-6 rounded-3xl border flex flex-col items-center justify-center text-center shadow-sm relative overflow-hidden ${isPositive ? 'bg-emerald-50 border-emerald-100 dark:bg-emerald-900/10 dark:border-emerald-800' : 'bg-red-50 border-red-100 dark:bg-red-900/10 dark:border-red-800'}`}>
                <div className="relative z-10">
                  <span className={`text-[10px] md:text-xs font-bold uppercase tracking-widest mb-2 md:mb-3 block ${isPositive ? 'text-emerald-700' : 'text-red-700'}`}>Variação Líquida</span>
                  <div className="flex items-center justify-center gap-1"><span className={`text-4xl md:text-6xl font-black tracking-tighter ${isPositive ? 'text-emerald-600' : 'text-red-600'}`}>{isPositive ? '+' : ''}{deltaPontos.toFixed(1)}</span></div>
                  <div className={`inline-flex items-center gap-1 mt-2 md:mt-3 px-3 py-1 rounded-full text-[11px] md:text-xs font-bold ${isPositive ? 'bg-emerald-200/50 text-emerald-800' : 'bg-red-200/50 text-red-800'}`}>{isPositive ? <TrendingUp size={14} /> : <TrendingDown size={14} />}{Math.abs(growthPerc).toFixed(1)}% {isPositive ? 'Crescimento' : 'Retração'}</div>
                </div>
                <div className={`absolute -right-4 -bottom-4 opacity-10 transform rotate-12 ${isPositive ? 'text-emerald-600' : 'text-red-600'}`}><Activity size={120} /></div>
              </div>

              {/* Card 2: Comparação de Tempo */}
              <div className="p-4 rounded-3xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm relative overflow-hidden">
                 <div className="flex items-center gap-2 mb-4 border-b border-zinc-100 dark:border-zinc-800 pb-3">
                    <div className="p-1.5 bg-blue-50 dark:bg-blue-900/20 rounded-lg text-blue-600"><Timer size={18} /></div>
                    <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Tempo de Prova</span>
                 </div>
                 <div className="space-y-3">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 min-w-0">
                            <span className="w-1.5 h-1.5 rounded-full bg-zinc-300"></span>
                            <span className="text-[10px] font-bold text-zinc-500 uppercase truncate max-w-[120px]" title={base.titulo}>{base.titulo}</span>
                        </div>
                        <p className="text-xs font-bold text-zinc-700 dark:text-zinc-300 tabular-nums">{formatDuration(timeBase)}</p>
                    </div>
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 min-w-0">
                            <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
                            <span className="text-[10px] font-bold text-blue-600 uppercase truncate max-w-[120px]" title={target.titulo}>{target.titulo}</span>
                        </div>
                        <p className="text-xs font-black text-zinc-900 dark:text-white tabular-nums">{formatDuration(timeTarget)}</p>
                    </div>
                 </div>
                 {(timeBase > 0 && timeTarget > 0) && (
                    <div className={`mt-3 pt-3 border-t border-zinc-100 dark:border-zinc-800 text-center`}>
                        <p className={`text-xs font-bold ${isTimeFaster ? 'text-emerald-600' : 'text-amber-600'}`}>
                            {isTimeFaster
                                ? `Você foi ${Math.abs(timeDiff)}min mais rápido`
                                : `Você foi ${Math.abs(timeDiff)}min mais lento`}
                        </p>
                    </div>
                 )}
                 {(!timeBase || !timeTarget) && (
                     <div className="mt-3 pt-3 border-t border-zinc-100 dark:border-zinc-800 text-center">
                         <p className="text-[10px] text-zinc-400">Tempo não registrado em um dos simulados.</p>
                     </div>
                 )}
              </div>

              {/* Cards de Detalhe (Atenção/Positivas) - GRANDES */}
              <div className="flex flex-col gap-3">
                <div className="p-4 rounded-3xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm">
                  <h4 className="text-[10px] font-bold text-zinc-400 uppercase mb-3 flex items-center gap-2"><AlertTriangle size={14} className="text-red-500" /> Atenção (Maiores Quedas)</h4>
                  {topDrops.length === 0 ? (<p className="text-xs text-zinc-500">Nenhuma queda relevante 🎯</p>) : (<div className="space-y-3">{topDrops.map((d, i) => (<div key={i} className="flex items-center justify-between gap-2 p-2 rounded-xl bg-red-50/50 dark:bg-red-900/10"><span className="text-xs font-bold text-zinc-700 dark:text-zinc-200 truncate">{d.name}</span><span className="text-xs font-black text-red-600 shrink-0">{d.diff.toFixed(1)}</span></div>))}</div>)}
                </div>
                <div className="p-4 rounded-3xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm">
                  <h4 className="text-[10px] font-bold text-zinc-400 uppercase mb-3 flex items-center gap-2"><Zap size={14} className="text-emerald-500" /> Positivas (Melhores Ganhos)</h4>
                  {topGrowth.length === 0 ? (<p className="text-xs text-zinc-500">Sem ganhos relevantes ainda 👊</p>) : (<div className="space-y-3">{topGrowth.map((d, i) => (<div key={i} className="flex items-center justify-between gap-2 p-2 rounded-xl bg-emerald-50/50 dark:bg-emerald-900/10"><span className="text-xs font-bold text-zinc-700 dark:text-zinc-200 truncate">{d.name}</span><span className="text-xs font-black text-emerald-600 shrink-0">+{d.diff.toFixed(1)}</span></div>))}</div>)}
                </div>
              </div>
            </div>

            {/* COLUNA CENTRAL (RADAR) */}
            <div className="lg:col-span-5 bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-200 dark:border-zinc-800 shadow-sm p-2 flex flex-col items-center justify-center relative min-h-[300px] md:min-h-[400px]">
              <div className="absolute top-4 md:top-6 left-4 md:left-6 z-10"><h3 className="font-bold text-zinc-800 dark:text-white flex items-center gap-2"><Target className="text-purple-500" size={18} /> Radar</h3><p className="text-[11px] md:text-xs text-zinc-500 mt-1">Aproveitamento por disciplina</p></div>
              <div className="w-full h-full p-2 md:p-4"><SimpleRadarChart data={radarData} colorA="#9ca3af" colorB="#2563eb" labelA={base.titulo} labelB={target.titulo} /></div>
            </div>

            {/* COLUNA DIREITA (DESTAQUES) */}
            <div className="lg:col-span-4 flex flex-col gap-4">
              <div className="flex-1 bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-200 dark:border-zinc-800 shadow-sm p-4 md:p-6 overflow-hidden relative">
                <h4 className="text-[10px] md:text-xs font-bold text-zinc-400 uppercase tracking-widest mb-4 flex items-center gap-2"><Zap size={14} className="text-amber-500" /> Destaques Principais</h4>
                <div className="space-y-4 relative z-10">
                  {topGrowth[0] && (<div className="flex items-start gap-3 p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-100 dark:border-emerald-800/30"><div className="p-2.5 bg-emerald-100 dark:bg-emerald-800 rounded-xl text-emerald-700 dark:text-emerald-300"><ArrowUpRight size={20} /></div><div className="min-w-0"><p className="text-[10px] font-bold text-emerald-600 uppercase">Maior ganho</p><p className="font-bold text-zinc-800 dark:text-white text-sm truncate mt-0.5">{topGrowth[0].name}</p><p className="text-sm font-black text-emerald-600 mt-1">+{topGrowth[0].diff.toFixed(1)} pts</p></div></div>)}
                  {topDrops[0] && (<div className="flex items-start gap-3 p-4 rounded-2xl bg-red-50 dark:bg-red-900/10 border border-red-100 dark:border-red-800/30"><div className="p-2.5 bg-red-100 dark:bg-red-800 rounded-xl text-red-700 dark:text-red-300"><ArrowDownRight size={20} /></div><div className="min-w-0"><p className="text-[10px] font-bold text-red-600 uppercase">Maior queda</p><p className="font-bold text-zinc-800 dark:text-white text-sm truncate mt-0.5">{topDrops[0].name}</p><p className="text-sm font-black text-red-600 mt-1">{topDrops[0].diff.toFixed(1)} pts</p></div></div>)}
                  {(!topGrowth[0] && !topDrops[0]) && (<div className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-950/40 border border-zinc-200 dark:border-zinc-800 text-sm text-zinc-500">Sem variações relevantes — continue registrando.</div>)}
                </div>
              </div>
            </div>
          </div>

          {/* SECTION 2: Detalhamento por disciplina */}
          <div className="bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-200 dark:border-zinc-800 shadow-sm overflow-hidden">
            <div className="p-4 md:p-6 border-b border-zinc-100 dark:border-zinc-800 flex flex-col md:flex-row md:justify-between md:items-center gap-2">
              <h3 className="font-black text-base md:text-lg text-zinc-800 dark:text-white flex items-center gap-2"><Layers className="text-blue-500" size={20} /> Detalhamento</h3><div className="text-[11px] md:text-xs font-medium text-zinc-500">Ordenado por relevância</div>
            </div>

            {/* MOBILE: Tabela Compacta (Barra de detalhes refinada) */}
            <div className="md:hidden">
              <div className="grid grid-cols-12 gap-2 px-4 py-3 bg-zinc-50 dark:bg-zinc-950 text-[9px] font-bold text-zinc-500 uppercase tracking-wider text-center">
                <div className="col-span-6 text-left pl-1">Disciplina</div>
                <div className="col-span-2 text-center">Acertos</div>
                <div className="col-span-2 text-center">Pontos</div>
                <div className="col-span-2 text-right">Nota</div>
              </div>
              <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {allDisciplines.map((d, i) => (
                  <div key={i} className="px-4 py-3">
                    {/* Linha Principal */}
                    <div className="grid grid-cols-12 gap-2 items-center mb-2">
                      <div className="col-span-6 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className={`px-1.5 py-0.5 rounded text-[8px] font-black uppercase border tracking-tighter ${getStatusColor(d.status)}`}>
                            {d.status === 'growth' ? 'Evolução' : d.status === 'drop' ? 'Queda' : d.status === 'new' ? 'Inédita' : 'Estável'}
                          </span>
                          <span className="text-xs font-bold text-zinc-800 dark:text-zinc-100 truncate">{d.name}</span>
                        </div>
                      </div>

                      <div className="col-span-2 text-center text-xs font-bold text-zinc-600 dark:text-zinc-300">
                        {d.targetRaw}
                        <span className="text-[8px] text-zinc-400 block tracking-tighter">/ {d.targetTotal}</span>
                      </div>

                      <div className="col-span-2 text-center">
                         <div className={`text-xs font-black ${d.diff > 0 ? 'text-emerald-600' : d.diff < 0 ? 'text-red-600' : 'text-zinc-400'}`}>{d.diff > 0 ? '+' : ''}{d.diff.toFixed(1)}</div>
                      </div>

                      <div className="col-span-2 text-right text-xs font-bold text-blue-600 dark:text-blue-400">{Math.round(d.targetPerc)}%</div>
                    </div>

                    {/* Linha Secundária (Barra de Detalhes Melhorada) */}
                    <div className="bg-zinc-100 dark:bg-zinc-800/50 rounded-lg p-2 flex items-center justify-between">
                         <div className="flex items-center gap-2">
                            <Scale size={10} className="text-zinc-400"/>
                            <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-wider">Peso {d.weight}</span>
                         </div>
                         <div className="flex items-center gap-2">
                            <History size={10} className="text-zinc-400"/>
                            <span className="text-[9px] text-zinc-400 uppercase tracking-wider">Resultado Anterior</span>
                            <span className="text-[10px] font-bold text-zinc-600 dark:text-zinc-300">{d.baseRaw}/{d.baseTotal}</span>
                         </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* DESKTOP */}
            <div className="hidden md:block divide-y divide-zinc-100 dark:divide-zinc-800">
              {allDisciplines.map((item, idx) => (
                <div key={idx} className="p-4 hover:bg-zinc-50 dark:hover:bg-zinc-900/50 transition-colors group">
                  <div className="flex flex-col md:flex-row gap-4 items-center">
                    <div className="flex-1 w-full md:w-auto min-w-0 md:min-w-[250px]">
                      <div className="flex items-center gap-2 mb-1"><span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase border ${getStatusColor(item.status)}`}>{item.status === 'growth' ? 'Evolução' : item.status === 'drop' ? 'Queda' : item.status === 'new' ? 'Inédita' : 'Estável'}</span><h4 className="font-bold text-sm text-zinc-700 dark:text-zinc-200 truncate" title={item.name}>{item.name}</h4></div>
                      <div className="flex items-center gap-3 text-[11px] text-zinc-500 flex-wrap"><span className="flex items-center gap-1">Peso <b className="text-zinc-700 dark:text-zinc-300">{item.weight}</b></span><span className="w-1 h-1 rounded-full bg-zinc-300 hidden md:inline-block" /><span className="truncate"><b className="text-zinc-700 dark:text-zinc-300">{base.titulo}:</b> {item.basePoints.toFixed(1)}</span><ArrowRightIcon size={10} className="text-zinc-400" /><span className="truncate text-blue-600 dark:text-blue-400"><b>{target.titulo}:</b> {item.targetPoints.toFixed(1)}</span></div>
                    </div>
                    <div className="flex-[2] w-full md:w-auto px-1 md:px-2">
                      <div className="flex justify-between mb-1.5"><span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wide">Progresso</span><span className={`text-xs font-bold ${item.diff > 0 ? 'text-emerald-600' : item.diff < 0 ? 'text-red-600' : 'text-zinc-400'}`}>{item.diff > 0 ? '+' : ''}{item.diff.toFixed(1)} pts</span></div>
                      <div className="h-3 w-full bg-zinc-100 dark:bg-zinc-800 rounded-full relative overflow-hidden"><div className="absolute top-0 left-0 bottom-0 bg-zinc-400 dark:bg-zinc-600 opacity-30 z-10 border-r border-white dark:border-zinc-900" style={{ width: `${item.basePerc}%` }} /><motion.div initial={{ width: 0 }} animate={{ width: `${item.targetPerc}%` }} transition={{ duration: 1, delay: 0.2 }} className={`absolute top-0 left-0 bottom-0 z-20 opacity-90 ${item.status === 'growth' ? 'bg-emerald-500' : item.status === 'drop' ? 'bg-red-500' : item.status === 'new' ? 'bg-blue-500' : 'bg-zinc-400'}`} /></div>
                    </div>
                    <div className="w-full md:w-32 flex justify-between md:flex-col md:items-end gap-1 border-t md:border-t-0 border-zinc-100 pt-2 md:pt-0">
                      <div className="text-right"><span className="text-[9px] font-bold text-zinc-400 uppercase block">Acertos</span><span className="text-xs font-bold text-zinc-700 dark:text-zinc-300">{item.targetRaw} <span className="text-zinc-400">/ {item.targetTotal}</span></span></div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SimuladoComparisonModal;