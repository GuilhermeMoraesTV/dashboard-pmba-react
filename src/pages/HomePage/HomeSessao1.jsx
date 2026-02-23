import React, { useState, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

// 1. Componentes do Gráfico (Recharts)
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Cell,
  CartesianGrid,
} from 'recharts';

// 2. Ícones (Lucide React)
import {
  Clock,
  Target,
  TrendingUp,
  Flame,
  Calendar,
  CheckCircle2,
  XCircle,
  Play,
  Zap,
  BookOpen,
  Settings,
  Check,
  ChevronLeft,
  ChevronRight,
  Crown,
  Star,
  Shield,
} from 'lucide-react';

// ============================================================================
// CONSTANTS & HELPERS LOCAIS
// ============================================================================
const PT_DAYS_SHORT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

const dateToYMD_local = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const addDays = (date, days) => {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
};

const getMonday = (d) => {
  const date = new Date(d);
  const day = date.getDay();
  const diff = date.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(date.setDate(diff));
};

const formatDecimalHours = (minutes) => {
  if (!minutes || minutes < 0) return '00h 00m';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, '0')}h ${String(m).padStart(2, '0')}m`;
};

const formatMultiplierText = (multiplier) => {
  const val = parseFloat(multiplier);
  if (val >= 2.0) return "2x";
  if (val >= 1.5) return "+50%";
  if (val >= 1.25) return "+25%";
  return "";
};

const getMultiplierBadge = (multiplier) => {
  const val = parseFloat(multiplier);
  if (val >= 2.0) return { bg: 'bg-gradient-to-r from-purple-600 to-indigo-600', text: 'text-white', border: 'border-purple-300', icon: Crown };
  if (val >= 1.5) return { bg: 'bg-gradient-to-r from-yellow-400 to-amber-500', text: 'text-yellow-950', border: 'border-yellow-200', icon: Star };
  if (val >= 1.25) return { bg: 'bg-gradient-to-r from-slate-300 to-slate-400', text: 'text-slate-900', border: 'border-slate-200', icon: Shield };
  return null;
};

const getMultiplierDescription = (multiplier) => {
  const val = parseFloat(multiplier);
  if (val >= 2.0) return "XP DUPLO! 2x em tudo.";
  if (val >= 1.5) return "Bônus de +50% XP ativo.";
  if (val >= 1.25) return "Bônus de +25% XP ativo.";
  return "Mantenha a sequência!";
};

// ============================================================================
// SUB-COMPONENTS DA SESSÃO 1
// ============================================================================

const StatCard = ({ icon: Icon, title, value, subValue, className = "" }) => (
  <div className={`dashboard-card relative overflow-hidden group p-3 md:p-6 h-[110px] md:h-[140px] flex flex-col justify-center items-start transition-all duration-500 hover:shadow-glow border-l-4 border-transparent hover:border-red-500 bg-card-light dark:bg-card-dark ${className}`}>
    <div className="relative z-20 flex flex-col gap-0.5 md:gap-1 w-full">
      <h3 className="text-[10px] md:text-xs font-bold uppercase tracking-wider text-text-secondary dark:text-text-dark-secondary truncate w-full">{title}</h3>
      <div className="flex flex-col md:flex-row md:items-end gap-0 md:gap-2">
        <p className="text-2xl md:text-3xl lg:text-4xl font-extrabold text-text-primary dark:text-text-dark-primary tracking-tight leading-none">{value}</p>
        {subValue && <div className="mb-0 md:mb-1 text-xs md:text-sm opacity-90">{subValue}</div>}
      </div>
    </div>
    <div className="absolute -bottom-4 -right-4 md:-bottom-6 md:-right-6 text-red-500/10 dark:text-red-500/5 transition-all duration-700 ease-out group-hover:scale-125 group-hover:rotate-[-10deg] group-hover:text-red-500/15 z-10 pointer-events-none">
      <Icon strokeWidth={1.5} className="w-24 h-24 md:w-36 md:h-36" />
    </div>
  </div>
);

const ActiveCycleCard = ({ activeCicloData, onClick }) => {
  const hasCycle = !!activeCicloData;
  return (
    <div id="active-cycle-card" onClick={onClick}
      className={`relative overflow-hidden group p-4 h-[110px] md:h-[140px] flex items-center rounded-2xl cursor-pointer shadow-lg transition-all duration-500 hover:shadow-red-500/40 hover:-translate-y-1 active:scale-95
        ${hasCycle ? 'bg-gradient-to-br from-red-600 to-red-800 text-white' : 'bg-zinc-100 dark:bg-zinc-800 border-2 border-dashed border-zinc-300 dark:border-zinc-700 text-zinc-500'}`}>
      {hasCycle ? (
        <>
          <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10 mix-blend-overlay pointer-events-none" />
          <div className="absolute -right-10 -top-10 text-white/5 group-hover:text-white/10 transition-all duration-700 transform group-hover:rotate-[30deg] group-hover:scale-150 pointer-events-none"><Zap size={140} fill="currentColor" /></div>
          <div className="relative z-10 w-full flex items-center justify-between gap-4">
            <div className="flex flex-col justify-center flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1 opacity-90">
                <div className="w-2.5 h-2.5 rounded-full bg-green-400 animate-pulse shadow-[0_0_8px_rgba(74,222,128,0.9)] border border-white/30 shrink-0" />
                <span className="text-[10px] font-bold uppercase tracking-widest text-white/80">Ciclo Ativo</span>
              </div>
              <h2 className="text-sm md:text-xl font-black leading-tight line-clamp-2 drop-shadow-md w-full" title={activeCicloData.nome}>{activeCicloData.nome}</h2>
            </div>
            <div className="flex flex-col items-center justify-center shrink-0 gap-1">
              <div className="w-10 h-10 md:w-12 md:h-12 rounded-full bg-white text-red-600 shadow-xl flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                <Play size={20} fill="currentColor" className="ml-1" />
              </div>
              <span className="text-[9px] font-bold uppercase text-white/90">Iniciar</span>
            </div>
          </div>
        </>
      ) : (
        <div className="flex flex-col items-center justify-center w-full text-center gap-2">
          <BookOpen size={24} className="opacity-40" />
          <div>
            <span className="block text-xs font-bold uppercase opacity-70">Nenhum ciclo</span>
            <span className="text-[10px] bg-zinc-200 dark:bg-zinc-700 px-2 py-0.5 rounded opacity-60 mt-1 inline-block">Criar Novo</span>
          </div>
        </div>
      )}
    </div>
  );
};

// ============================================================================
// WEEKLY BAR CHART - DESIGN ESTRUTURAL
// ============================================================================
const WeeklyBarChart = ({ registrosEstudo }) => {
  const [metric, setMetric] = useState('hours');
  const [weekOffset, setWeekOffset] = useState(0);
  const chartWrapperRef = useRef(null);
  const [hoveredBar, setHoveredBar] = useState(null);

  const weekData = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const baseMonday = getMonday(new Date());
    const currentMonday = addDays(baseMonday, weekOffset * 7);
    const days = Array.from({ length: 7 }, (_, i) => {
      const d = addDays(currentMonday, i);
      return dateToYMD_local(d);
    });
    const todayStr = dateToYMD_local(today);
    const map = {};
    (registrosEstudo || []).forEach(r => {
      if (!r.data) return;
      if (!map[r.data]) map[r.data] = { minutes: 0, questions: 0, correct: 0 };
      map[r.data].minutes += Number(r.tempoEstudadoMinutos) || 0;
      map[r.data].questions += Number(r.questoesFeitas) || 0;
      map[r.data].correct += Number(r.acertos) || 0;
    });
    return days.map((dateStr) => {
      const [y, m, dNum] = dateStr.split('-').map(Number);
      const d = new Date(y, m - 1, dNum);
      const dayLabel = PT_DAYS_SHORT[d.getDay()];
      const data = map[dateStr] || { minutes: 0, questions: 0, correct: 0 };
      const isFuture = dateStr > todayStr;
      const isToday = dateStr === todayStr;
      return { dateStr, dayLabel, minutes: isFuture ? 0 : data.minutes, questions: isFuture ? 0 : data.questions, correct: isFuture ? 0 : data.correct, isFuture, isToday };
    });
  }, [registrosEstudo, weekOffset]);

  const chartData = weekData.map(d => ({
    date: d.dayLabel,
    dateStr: d.dateStr,
    value: metric === 'hours' ? d.minutes : d.questions,
    minutes: d.minutes,
    questions: d.questions,
    isToday: d.isToday,
    isFuture: d.isFuture,
  }));

  const yAxisTicks = useMemo(() => {
    if (metric !== 'hours') return undefined;
    const maxVal = Math.max(...chartData.map(d => d.value), 0);
    const maxHours = Math.ceil(maxVal / 60) || 1;
    const step = maxHours > 5 ? 120 : 60;
    return Array.from({ length: maxHours + 2 }, (_, i) => i * step).filter(v => v <= maxVal + step);
  }, [metric, chartData]);

  const weekLabel = useMemo(() => {
    const first = weekData[0];
    const last = weekData[6];
    if (!first || !last) return '';
    const f = new Date(first.dateStr + 'T00:00:00');
    const l = new Date(last.dateStr + 'T00:00:00');
    const fmt = (dt) => `${String(dt.getDate()).padStart(2, '0')}/${String(dt.getMonth() + 1).padStart(2, '0')}`;
    return `${fmt(f)} – ${fmt(l)}`;
  }, [weekData]);

  const isCurrentWeek = weekOffset === 0;

  // Lógica de posicionamento PRECISO no topo da barra
  const handleBarMouseEnter = (entry, index, e) => {
    if (!chartWrapperRef.current || !e?.target) return;

    const barRect = e.target.getBoundingClientRect();
    const wrapperRect = chartWrapperRef.current.getBoundingClientRect();

    // X = Centro da barra
    const relativeX = (barRect.left - wrapperRect.left) + (barRect.width / 2);

    // Y = Topo exato da barra (menos um pequeno offset para não colar)
    const relativeY = (barRect.top - wrapperRect.top);

    setHoveredBar({ x: relativeX, y: relativeY, entry });
  };

  return (
    <div className="dashboard-card col-span-1 lg:col-span-2 p-4 flex flex-col gap-3 relative overflow-visible group/chart z-20">

      {/* Header com Design do Sequência de Estudo (Título vermelho/rose) */}
      <div className="flex items-center justify-between gap-2 mb-2">
         <div className="flex items-center gap-3">
          <div className="p-2 bg-gradient-to-br from-red-500 to-rose-500 rounded-xl shadow-lg shadow-red-500/25">
            <TrendingUp size={35} className="text-white" strokeWidth={2.5} />
          </div>
          <div>
            {/* TÍTULO IGUAL AO SEQUÊNCIA DE ESTUDO (Estilo Gráfico) */}
            <h3 className="text-[12px] font-black uppercase tracking-[0.18em] bg-gradient-to-r from-red-600 to-rose-600 dark:from-red-400 dark:to-rose-400 bg-clip-text text-transparent">
              Estudo Semanal
            </h3>
             <div className="flex items-center gap-2 mt-0.5">
                <button onClick={() => setWeekOffset(o => o - 1)} className="w-4 h-4 rounded hover:bg-zinc-200 dark:hover:bg-zinc-700 flex items-center justify-center transition-colors text-zinc-500"><ChevronLeft size={10} /></button>
                <span className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 tracking-wide">{weekLabel}</span>
                <button onClick={() => setWeekOffset(o => Math.min(o + 1, 0))} disabled={isCurrentWeek} className={`w-4 h-4 rounded flex items-center justify-center transition-colors text-zinc-500 ${isCurrentWeek ? 'opacity-30 cursor-not-allowed' : 'hover:bg-zinc-200 dark:hover:bg-zinc-700'}`}><ChevronRight size={10} /></button>
              </div>
          </div>
        </div>

        {/* Toggle */}
        <div className="flex bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg p-0.5 gap-0.5 self-start md:self-center">
          <button onClick={() => setMetric('hours')} className={`px-3 py-1.5 rounded-md text-[9px] font-black uppercase tracking-wide transition-all ${metric === 'hours' ? 'bg-red-500 text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 hover:bg-white/50 dark:hover:bg-zinc-800'}`}>Horas</button>
          <button onClick={() => setMetric('questions')} className={`px-3 py-1.5 rounded-md text-[9px] font-black uppercase tracking-wide transition-all ${metric === 'questions' ? 'bg-red-500 text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 hover:bg-white/50 dark:hover:bg-zinc-800'}`}>Questões</button>
        </div>
      </div>

      {/* Área do Gráfico */}
      <div ref={chartWrapperRef} className="relative z-10 flex-1 w-full min-h-[160px] mt-2" onMouseLeave={() => setHoveredBar(null)}>

        {/* TOOLTIP DINÂMICO POSICIONADO NA PONTA DA BARRA */}
        {hoveredBar && (
          <div
            className="absolute z-[200] pointer-events-none transition-transform duration-100 ease-out will-change-transform"
            style={{
              left: hoveredBar.x,
              top: hoveredBar.y,
              transform: 'translate(-50%, -115%)' // Puxa para cima da coordenada Y
            }}
          >
            <div className="bg-zinc-900/95 dark:bg-zinc-800/95 backdrop-blur-sm text-white text-[10px] p-2 rounded-lg border border-zinc-700/50 shadow-xl w-max mb-1">
              <div className="font-bold text-center border-b border-white/10 pb-1 mb-1 text-zinc-300 uppercase tracking-wider text-[9px]">
                {hoveredBar.entry.dateStr ? hoveredBar.entry.dateStr.split('-').reverse().slice(0, 2).join('/') : hoveredBar.entry.date}
              </div>
              <div className="flex flex-col gap-0.5 text-left min-w-[60px]">
                {metric === 'hours' ? (
                  /* SÓ MOSTRA HORAS SE METRIC == HOURS */
                  <div className="flex items-center justify-center gap-2">
                    <Clock size={10} className="text-red-400 shrink-0" />
                    <span className="font-mono text-[10px] font-bold">{formatDecimalHours(hoveredBar.entry.minutes ?? 0)}</span>
                  </div>
                ) : (
                  /* SÓ MOSTRA QUESTÕES SE METRIC == QUESTIONS */
                  <div className="flex items-center justify-center gap-2">
                    <Target size={10} className="text-blue-400 shrink-0" />
                    <span className="font-mono text-[10px] font-bold">{hoveredBar.entry.questions ?? 0} questões</span>
                  </div>
                )}
              </div>
            </div>
            {/* Seta do tooltip apontando para baixo */}
            <div className="flex justify-center">
              <div className="border-4 border-transparent border-t-zinc-900/95 dark:border-t-zinc-800/95 w-0 h-0" />
            </div>
          </div>
        )}

        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 20, right: 0, left: -25, bottom: 0 }} barCategoryGap="30%">
             <defs>
              <linearGradient id="wkBarRedOld" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#ef4444" stopOpacity={0.9} />
                <stop offset="100%" stopColor="#dc2626" stopOpacity={0.75} />
              </linearGradient>
            </defs>

            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e4e4e7" strokeOpacity={0.6} className="dark:stroke-zinc-800" />

            <XAxis
              dataKey="date"
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 11, fill: '#71717a', fontWeight: 600 }}
              dy={10}
            />

            <YAxis
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 11, fill: '#a1a1aa', fontWeight: 500 }}
              ticks={yAxisTicks}
              tickFormatter={(v) => metric === 'hours' ? (v===0 ? '' : `${Math.round(v / 60)}h`) : (v===0 ? '' : v)}
            />

            <Bar
              dataKey="value"
              barSize={32}
              radius={[4, 4, 0, 0]}
              onMouseEnter={handleBarMouseEnter}
              onMouseLeave={() => setHoveredBar(null)}
              cursor="pointer"
            >
              {chartData.map((entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={entry.value === 0 ? 'transparent' : 'url(#wkBarRedOld)'}
                  opacity={entry.isFuture ? 0.3 : 1}
                  stroke={entry.isToday ? '#fb923c' : 'none'}
                  strokeWidth={entry.isToday ? 2 : 0}
                  style={{ transition: 'all 0.2s ease' }}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

// ============================================================================
// COMPONENTE PRINCIPAL SESSÃO 1
// ============================================================================
export default function HomeSessao1({
  homeStats,
  activeCicloData,
  setActiveTab,
  registrosEstudo, // Usado apenas no gráfico se não tiver unify
  allRegistrosEstudo, // Usado no gráfico se tiver unify
  unifyStreaks,
  updateUnifyPreference,
  handleDayClick
}) {
  const [showPrefMenu, setShowPrefMenu] = useState(false);
  const [isHoveringMultiplier, setIsHoveringMultiplier] = useState(false);

  const badgeConfig = getMultiplierBadge(homeStats.multiplier);

  // Determina fonte de dados do gráfico
  const chartSource = unifyStreaks ? allRegistrosEstudo : registrosEstudo;

  return (
    <>
      {showPrefMenu && (
        <div className="fixed inset-0 z-40 bg-transparent cursor-default" onClick={(e) => { e.stopPropagation(); setShowPrefMenu(false); }} />
      )}

      {/* ── TOP STATS GRID ── */}
      <div id="home-stats-grid" className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 pt-0">
        <StatCard icon={Clock} title="Tempo de Estudo" value={formatDecimalHours(homeStats.totalTimeMinutes)} />
        <StatCard icon={Target} title="Questões Feitas" value={homeStats.performance.total} />
        <StatCard icon={TrendingUp} title="Precisão Geral" value={`${homeStats.performance.percentage.toFixed(0)}%`}
          subValue={
            <div className="flex items-center gap-2 text-[10px] md:text-sm font-bold md:ml-1 mt-1 md:mt-0">
              <span className="text-emerald-500 flex items-center"><CheckCircle2 size={12} className="mr-0.5" strokeWidth={3} /> {homeStats.performance.correct}</span>
              <span className="text-zinc-300">|</span>
              <span className="text-red-500 flex items-center"><XCircle size={12} className="mr-0.5" strokeWidth={3} /> {homeStats.performance.wrong}</span>
            </div>
          }
        />
        <ActiveCycleCard activeCicloData={activeCicloData} onClick={() => setActiveTab('ciclos')} />
      </div>

      {/* ── STREAK + WEEKLY CHART ── */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-3 md:gap-4">

        {/* STREAK CARD */}
        <div className={`dashboard-card col-span-1 lg:col-span-3 p-4 flex flex-col gap-3 relative overflow-visible border-l-4 border-orange-500 group/card ${showPrefMenu ? 'z-50' : 'z-20'}`}>
          <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-orange-500/5 to-transparent pointer-events-none rounded-xl" />

          {showPrefMenu && (
            <div className="absolute inset-0 z-40 bg-transparent cursor-default rounded-xl" onClick={(e) => { e.stopPropagation(); setShowPrefMenu(false); }} />
          )}

          {/* Header row */}
          <div className={`flex items-start gap-4 w-full relative pointer-events-none ${showPrefMenu ? 'z-[70]' : 'z-10'}`}>
            {/* Flame */}
            <div
              className="relative p-3.5 rounded-2xl shadow-lg shadow-orange-500/30 bg-gradient-to-tr from-orange-600 via-orange-500 to-amber-400 text-white transform group-hover/card:scale-105 transition-all duration-500 pointer-events-auto cursor-help shrink-0 mt-0.5"
              onMouseEnter={() => setIsHoveringMultiplier(true)} onMouseLeave={() => setIsHoveringMultiplier(false)}>
              <Flame size={45} className={`${homeStats.streak > 0 ? "animate-pulse fill-white/20" : ""}`} strokeWidth={2} />
              <AnimatePresence mode="wait">
                {badgeConfig && (
                  <motion.div key={homeStats.multiplier} initial={{ opacity: 0, scale: 0.8, rotate: -10 }} animate={{ opacity: 1, scale: 1, rotate: 6 }} exit={{ opacity: 0, scale: 0.8, rotate: 10 }} className="absolute -top-3 -right-8 z-50">
                    <div className={`${badgeConfig.bg} ${badgeConfig.text} border-2 ${badgeConfig.border} px-2 py-0.5 rounded-full shadow-lg flex items-center gap-1 min-w-max`}>
                      <badgeConfig.icon size={13} fill="currentColor" strokeWidth={3} />
                      <span className="text-[11px] font-black leading-none ml-0.5">{formatMultiplierText(homeStats.multiplier)}</span>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
              <AnimatePresence>
                {isHoveringMultiplier && badgeConfig && (
                  <motion.div initial={{ opacity: 0, x: -10, scale: 0.9 }} animate={{ opacity: 1, x: 0, scale: 1 }} exit={{ opacity: 0, x: -10, scale: 0.9 }} transition={{ duration: 0.2 }}
                    className="absolute bottom-full left-full -ml-8 mb-2 w-36 bg-zinc-900/95 backdrop-blur-md text-white text-[10px] p-2.5 rounded-xl border border-zinc-700 shadow-2xl z-[100] text-center">
                    <div className="absolute -bottom-1.5 left-6 w-3 h-3 bg-zinc-900 border-r border-b border-zinc-700 transform rotate-45" />
                    <p className="font-bold mb-0.5 uppercase tracking-wider text-orange-400 text-[9px]">Bônus Ativo</p>
                    <p className="leading-tight opacity-90 font-medium">{getMultiplierDescription(homeStats.multiplier)}</p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Streak number + title */}
            <div className="flex-1 pointer-events-auto">
              <div className="flex items-center gap-2 mb-1">
                <h3 className="text-[12px] font-black uppercase tracking-[0.18em] bg-gradient-to-r from-orange-600 to-amber-600 dark:from-orange-400 dark:to-amber-400 bg-clip-text text-transparent">
                  Sequência de Estudo
                </h3>
                <div className="relative z-50">
                  <button onClick={(e) => { e.stopPropagation(); setShowPrefMenu(!showPrefMenu); }}
                    className="p-1 hover:bg-orange-50 dark:hover:bg-orange-900/20 rounded-md text-orange-400 hover:text-orange-600 transition-colors cursor-pointer" title="Configurar Sequência">
                    <Settings size={12} />
                  </button>
                  <AnimatePresence>
                    {showPrefMenu && (
                      <motion.div initial={{ opacity: 0, scale: 0.95, y: -5 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: -5 }}
                        className="absolute left-0 top-full mt-2 w-56 bg-white dark:bg-zinc-900 border border-orange-100 dark:border-orange-900/30 rounded-xl shadow-xl z-[100] p-1.5 ring-1 ring-black/5 cursor-auto pointer-events-auto"
                        onClick={(e) => e.stopPropagation()}>
                        <div className="px-3 py-2 border-b border-zinc-100 dark:border-zinc-800 mb-1 text-left">
                          <span className="text-[9px] font-black text-orange-500 uppercase tracking-widest">Configuração de Sequência</span>
                        </div>
                        <button type="button" onClick={(e) => { e.stopPropagation(); updateUnifyPreference(false); setShowPrefMenu(false); }}
                          className={`w-full flex items-center justify-between px-3 py-2.5 text-[10px] font-bold uppercase tracking-tight rounded-lg transition-colors duration-150 mb-1 cursor-pointer ${!unifyStreaks ? 'bg-orange-500 text-white shadow-md hover:bg-orange-600' : 'text-zinc-600 dark:text-zinc-400 hover:bg-orange-100 dark:hover:bg-zinc-800'}`}>
                          <span>Apenas o Ciclo Atual</span>
                          {!unifyStreaks && <Check size={12} strokeWidth={4} />}
                        </button>
                        <button type="button" onClick={(e) => { e.stopPropagation(); updateUnifyPreference(true); setShowPrefMenu(false); }}
                          className={`w-full flex items-center justify-between px-3 py-2.5 text-[10px] font-bold uppercase tracking-tight rounded-lg transition-colors duration-150 cursor-pointer ${unifyStreaks ? 'bg-orange-500 text-white shadow-md hover:bg-orange-600' : 'text-zinc-600 dark:text-zinc-400 hover:bg-orange-100 dark:hover:bg-zinc-800'}`}>
                          <span>Histórico Completo</span>
                          {unifyStreaks && <Check size={12} strokeWidth={4} />}
                        </button>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>
              <div className="flex items-baseline gap-2.5">
                <p className="text-6xl font-black text-orange-600 dark:text-orange-500 tracking-tighter leading-none drop-shadow-sm">{homeStats.streak}</p>
                <span className="text-sm font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wide">dias sem falhar</span>
              </div>
            </div>

            {/* "Últimos X dias" */}
            <div className="pointer-events-none shrink-0 text-right self-start">
              <span className="hidden sm:flex items-center gap-1 text-[10px] font-black text-zinc-400 uppercase tracking-widest whitespace-nowrap">
                <Calendar size={15} /> Últimos 12 dias
              </span>
              <span className="flex sm:hidden items-center gap-1 text-[8px] font-black text-zinc-400 uppercase tracking-widest whitespace-nowrap">
                <Calendar size={8} /> Últimos 10 dias
              </span>
            </div>
          </div>

          {/* ── DAY BARS ── */}
          <div className="flex items-end gap-1.5 w-full mt-auto relative z-20 overflow-visible">
            {homeStats.last12Days.map((day, index) => {
              const [, month, dayNum] = day.date.split('-');
              const dateDisplay = `${dayNum}/${month}`;
              const isToday = day.date === dateToYMD_local(new Date());
              const hideOnMobile = index < 2;

              return (
                <div key={day.date} className={`relative group/day flex-1 flex flex-col items-center gap-0 hover:z-[60] ${hideOnMobile ? 'hidden sm:flex' : 'flex'}`}>
                  {/* Streak day tooltip */}
                  {!showPrefMenu && (
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-max p-2 bg-zinc-900/95 dark:bg-zinc-800/95 backdrop-blur-sm text-white text-[10px] rounded-lg border border-zinc-700/50 shadow-xl opacity-0 group-hover/day:opacity-100 transition-opacity duration-150 pointer-events-none z-[100]">
                      <div className="font-bold text-center border-b border-white/10 pb-1 mb-1 text-zinc-300 uppercase tracking-wider text-[9px]">
                        {day.date.split('-').reverse().slice(0, 2).join('/')}
                      </div>
                      <div className="flex flex-col gap-0.5 text-left">
                        <div className="flex items-center gap-2"><Clock size={9} className="text-red-400 shrink-0" /><span className="font-mono text-[9px]">{formatDecimalHours(day.minutes)}</span></div>
                        <div className="flex items-center gap-2"><Target size={9} className="text-blue-400 shrink-0" /><span className="font-mono text-[9px]">{day.questions} questões</span></div>
                      </div>
                      <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-zinc-900/95 dark:border-t-zinc-800/95 w-0 h-0" />
                    </div>
                  )}

                  <div className="w-full h-16 flex items-end">
                    <div role="button" onClick={() => { if (day.hasData) handleDayClick(day.date); }}
                      className={`w-full rounded-md transition-all duration-300 ease-out border border-white/5
                        ${day.status === 'goal-met-both' ? 'bg-emerald-500 h-full shadow-[0_0_10px_rgba(16,185,129,0.3)]' : ''}
                        ${day.status === 'goal-met-one' ? 'bg-amber-500 h-[75%] shadow-[0_0_10px_rgba(245,158,11,0.3)]' : ''}
                        ${day.status === 'goal-not-met' ? 'bg-red-500 h-[40%] shadow-[0_0_10px_rgba(239,68,68,0.3)]' : ''}
                        ${day.status === 'no-data' ? 'bg-zinc-200 dark:bg-zinc-800/60 h-[10%]' : ''}
                        ${isToday ? 'ring-1 ring-orange-500' : ''}
                        ${day.hasData ? 'cursor-pointer active:scale-95' : 'cursor-default opacity-50'}`}
                    />
                  </div>
                  <span className={`text-[9px] font-bold tracking-tight leading-none mt-1 ${isToday ? 'text-orange-500' : 'text-zinc-400 dark:text-zinc-500'}`}>
                    {dateDisplay}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* WEEKLY BAR CHART (DESIGN FINAL) */}
        <WeeklyBarChart registrosEstudo={chartSource} />

      </div>
    </>
  );
}