import React, { useState, useMemo, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, Cell, LineChart, Line,
  ComposedChart, Area
} from 'recharts';
import {
  TrendingUp, TrendingDown, Minus, BarChart2, Target,
  ChevronDown, CheckCircle2, Activity, Award, Zap
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

// ─── HELPERS ─────────────────────────────────────────────────────────────────

const getScoreColor = (score) => {
  if (score === null || score === undefined) return '#71717a';
  if (score >= 80) return '#10b981';
  if (score >= 60) return '#f59e0b';
  if (score >= 40) return '#f97316';
  return '#ef4444';
};

const getScoreLabel = (score) => {
  if (score === null || score === undefined) return '—';
  if (score >= 80) return 'Ótimo';
  if (score >= 60) return 'Bom';
  if (score >= 40) return 'Regular';
  return 'Fraco';
};

const getScoreBg = (score) => {
  if (score === null || score === undefined) return 'bg-zinc-800';
  if (score >= 80) return 'bg-emerald-900/30 border-emerald-700/40';
  if (score >= 60) return 'bg-amber-900/30 border-amber-700/40';
  if (score >= 40) return 'bg-orange-900/30 border-orange-700/40';
  return 'bg-red-900/30 border-red-700/40';
};

const formatDate = (dateStr) => {
  try {
    const d = parseISO(dateStr);
    return format(d, "dd/MM", { locale: ptBR });
  } catch {
    return dateStr;
  }
};

const formatDateLong = (dateStr) => {
  try {
    const d = parseISO(dateStr);
    return format(d, "dd 'de' MMMM", { locale: ptBR });
  } catch {
    return dateStr;
  }
};

const calcScore = (simulado) => {
  const pct = Number(simulado?.resumo?.porcentagem ?? -1);
  if (pct >= 0 && pct <= 100) return Math.round(pct);
  const acertos = Number(simulado?.resumo?.totalAcertos ?? simulado.acertos ?? 0);
  const total = Number(simulado?.resumo?.totalQuestoes ?? simulado.totalQuestoes ?? 0);
  if (total > 0) return Math.round((acertos / total) * 100);
  return null;
};

// ─── FILTRO DE PERÍODO ────────────────────────────────────────────────────────

const FILTER_OPTIONS = [
  { value: 'all',  label: 'Todos' },
  { value: '30d',  label: '30d' },
  { value: '90d',  label: '90d' },
  { value: '180d', label: '6m' },
  { value: '365d', label: '1a' },
];

const InlineSelect = ({ options, value, onChange }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const selected = options.find(o => o.value === value);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(v => !v)}
        className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wide border transition-all duration-150 select-none
          ${open
            ? 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 border-red-200 dark:border-red-700/50'
            : 'bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-300 border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700'
          }`}
      >
        <span>{selected?.label ?? '—'}</span>
        <ChevronDown size={10} strokeWidth={2.5} className={`transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.97 }}
            transition={{ duration: 0.12 }}
            className="absolute z-50 top-full mt-1.5 right-0 min-w-[100px] bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700/80 rounded-xl shadow-xl overflow-hidden"
          >
            <div className="p-1">
              {options.map(opt => (
                <button
                  key={opt.value}
                  onClick={() => { onChange(opt.value); setOpen(false); }}
                  className={`w-full text-left px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wide flex items-center justify-between transition-colors
                    ${value === opt.value
                      ? 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400'
                      : 'text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800'
                    }`}
                >
                  {opt.label}
                  {value === opt.value && <CheckCircle2 size={10} strokeWidth={2.5} />}
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// ─── TOOLTIP CUSTOMIZADO ──────────────────────────────────────────────────────

const CustomTooltip = ({ active, payload, label, metric }) => {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload;
  if (!d) return null;

  const score = d.score;
  const color = getScoreColor(score);

  return (
    <div
      className="bg-zinc-900 border border-zinc-700/60 rounded-2xl shadow-2xl p-3 pointer-events-none"
      style={{
        boxShadow: `0 0 20px ${color}20, 0 8px 24px rgba(0,0,0,0.5)`,
        width: '200px',
        maxWidth: '200px',
      }}
    >
      <div className="flex items-center gap-2 mb-2 pb-2 border-b border-zinc-800">
        <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
        <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400 truncate">{formatDateLong(d.data)}</span>
      </div>

      <div className="flex items-end gap-2 mb-2">
        {metric === 'pontos' ? (
          <span className="text-2xl font-black leading-none" style={{ color }}>
            {d.pontos !== null ? d.pontos.toFixed(1) : '—'}
          </span>
        ) : (
          <span className="text-2xl font-black leading-none" style={{ color }}>
            {score !== null ? `${score}%` : '—'}
          </span>
        )}
        <span
          className={`text-[10px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-lg border mb-0.5 ${getScoreBg(score)}`}
          style={{ color }}
        >
          {getScoreLabel(score)}
        </span>
      </div>

      <p className="text-[11px] font-bold text-white mb-2 leading-tight" style={{ wordBreak: 'break-word', whiteSpace: 'normal' }}>
        {d.titulo || 'Simulado'}
      </p>

      <div className="grid grid-cols-2 gap-1.5">
        {d.totalQuestoes > 0 && (
          <div className="bg-zinc-800/60 rounded-lg p-1.5">
            <p className="text-[8px] uppercase tracking-wider text-zinc-500 font-bold mb-0.5">Questões</p>
            <p className="text-[12px] font-black text-white">{d.acertos}/{d.totalQuestoes}</p>
          </div>
        )}
        {d.pontos !== null && (
          <div className="bg-zinc-800/60 rounded-lg p-1.5">
            <p className="text-[8px] uppercase tracking-wider text-zinc-500 font-bold mb-0.5">Pontos Líq.</p>
            <p className="text-[12px] font-black text-white">{d.pontos.toFixed(1)}</p>
          </div>
        )}
        {d.durationMinutes > 0 && (
          <div className="bg-zinc-800/60 rounded-lg p-1.5">
            <p className="text-[8px] uppercase tracking-wider text-zinc-500 font-bold mb-0.5">Duração</p>
            <p className="text-[12px] font-black text-white">
              {d.durationMinutes >= 60
                ? `${Math.floor(d.durationMinutes / 60)}h${d.durationMinutes % 60 > 0 ? `${d.durationMinutes % 60}m` : ''}`
                : `${d.durationMinutes}m`}
            </p>
          </div>
        )}
        {score !== null && metric === 'pontos' && (
          <div className="bg-zinc-800/60 rounded-lg p-1.5">
            <p className="text-[8px] uppercase tracking-wider text-zinc-500 font-bold mb-0.5">% Acertos</p>
            <p className="text-[12px] font-black text-white">{score}%</p>
          </div>
        )}
      </div>
    </div>
  );
};

// ─── BARRA CUSTOMIZADA ────────────────────────────────────────────────────────

const CustomBar = (props) => {
  const { x, y, width, height, score, isActive } = props;
  if (!height || height <= 0) return null;

  const color = getScoreColor(score);
  const radius = 5;

  return (
    <g>
      {isActive && (
        <rect x={x - 2} y={y - 2} width={width + 4} height={height + 4} rx={radius + 2} fill={color} opacity={0.12} />
      )}
      <rect
        x={x} y={y} width={width} height={height} rx={radius}
        fill={color} opacity={isActive ? 1 : 0.75}
        style={{ filter: isActive ? `drop-shadow(0 0 6px ${color}80)` : 'none', transition: 'all 0.2s ease' }}
      />
      <rect x={x + 2} y={y + 2} width={width - 4} height={Math.min(5, height - 4)} rx={radius - 2} fill="white" opacity={isActive ? 0.2 : 0.1} />
    </g>
  );
};

// ─── COMPONENTE PRINCIPAL ─────────────────────────────────────────────────────

const SimuladoGrafico = ({ simulados = [], compact = false }) => {
  const [period, setPeriod] = useState('all');
  const [activeIndex, setActiveIndex] = useState(null);
  const [viewMode, setViewMode] = useState('bar'); // 'bar' | 'trend'
  const [metric, setMetric] = useState('porcentagem'); // 'porcentagem' | 'pontos'

  const filteredSimulados = useMemo(() => {
    if (period === 'all') return simulados;
    const days = parseInt(period);
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    return simulados.filter(s => {
      const d = s.data ? new Date(s.data) : null;
      return d && d >= cutoff;
    });
  }, [simulados, period]);

  const chartData = useMemo(() => {
    return filteredSimulados
      .map(s => ({
        // Campos explícitos — sem spread do objeto original para evitar colisões com props Recharts
        id: s.id,
        titulo: s.titulo || 'Simulado',
        data: s.data,
        banca: s.banca || '',
        score: calcScore(s),
        pontos: s.resumo?.pontosObtidos != null ? Number(s.resumo.pontosObtidos) : null,
        acertos: Number(s?.resumo?.totalAcertos ?? s.acertos ?? 0),
        totalQuestoes: Number(s?.resumo?.totalQuestoes ?? s.totalQuestoes ?? 0),
        durationMinutes: Number(s.durationMinutes ?? s.duracaoMinutos ?? 0),
        // 'xLabel' em vez de 'label' — evita colisão com a prop reservada 'label' do Recharts
        xLabel: formatDate(s.data),
      }))
      .sort((a, b) => new Date(a.data) - new Date(b.data));
  }, [filteredSimulados]);

  const stats = useMemo(() => {
    const scored = chartData.filter(d => d.score !== null);
    if (!scored.length) return null;

    const avg = Math.round(scored.reduce((s, d) => s + d.score, 0) / scored.length);
    const best = Math.max(...scored.map(d => d.score));
    const last = scored[scored.length - 1]?.score ?? null;
    const prev = scored[scored.length - 2]?.score ?? null;

    const pontosList = chartData.filter(d => d.pontos !== null).map(d => d.pontos);
    const mediaPontos = pontosList.length ? pontosList.reduce((a, b) => a + b, 0) / pontosList.length : null;
    const melhorPontos = pontosList.length ? Math.max(...pontosList) : null;
    const ultimoPontos = chartData.filter(d => d.pontos !== null).at(-1)?.pontos ?? null;

    let trend = 'neutral';
    let trendVal = 0;
    if (last !== null && prev !== null) {
      trendVal = last - prev;
      trend = trendVal > 3 ? 'up' : trendVal < -3 ? 'down' : 'neutral';
    }

    return { avg, best, last, trend, trendVal, total: scored.length, mediaPontos, melhorPontos, ultimoPontos };
  }, [chartData]);

  const TrendIcon = stats?.trend === 'up' ? TrendingUp : stats?.trend === 'down' ? TrendingDown : Minus;
  const trendColor = stats?.trend === 'up' ? '#10b981' : stats?.trend === 'down' ? '#ef4444' : '#71717a';

  const hasData = chartData.length > 0;

  // Dados mapeados para o eixo atual
  const dataKey = metric === 'pontos' ? 'pontos' : 'score';
  const yDomain = metric === 'pontos'
    ? ['auto', 'auto']
    : [0, 100];
  const yTicks = metric === 'pontos' ? undefined : [0, 25, 50, 75, 100];
  const yFormatter = metric === 'pontos' ? (v) => v.toFixed(0) : (v) => `${v}%`;
  const avgLine = metric === 'pontos'
    ? (stats?.mediaPontos != null ? Math.round(stats.mediaPontos * 10) / 10 : null)
    : stats?.avg;

  // Altura do gráfico — reduzida no modo compact
  const chartHeight = compact ? 160 : Math.max(200, Math.min(280, chartData.length * 24 + 80));

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] }}
      className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl"
    >
      {/* ── HEADER ── */}
      <div className="px-4 pt-4 pb-3 border-b border-zinc-100 dark:border-zinc-800">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800/40">
              <Activity size={13} className="text-red-600 dark:text-red-500" />
            </div>
            <div>
              <h3 className="text-xs font-black text-zinc-900 dark:text-white leading-tight">Consistência</h3>
              <p className="text-[10px] text-zinc-400 font-medium">
                {hasData ? `${chartData.length} simulado${chartData.length !== 1 ? 's' : ''}` : 'Sem dados'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {/* Toggle métrica % / Pontos */}
            <div className="flex items-center gap-0.5 p-0.5 bg-zinc-100 dark:bg-zinc-800 rounded-lg">
              {[
                { key: 'porcentagem', label: '%' },
                { key: 'pontos', label: 'Pts' },
              ].map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => setMetric(key)}
                  title={key === 'porcentagem' ? 'Porcentagem de acertos' : 'Pontos líquidos'}
                  className={`relative px-2 py-1 rounded-md text-[10px] font-black transition-all duration-150 select-none
                    ${metric === key ? 'text-zinc-900 dark:text-white' : 'text-zinc-400 dark:text-zinc-500 hover:text-zinc-600 dark:hover:text-zinc-300'}`}
                >
                  {metric === key && (
                    <motion.div
                      layoutId="metric-pill"
                      className="absolute inset-0 bg-white dark:bg-zinc-700 rounded-md shadow-sm"
                      transition={{ type: 'spring', stiffness: 400, damping: 35 }}
                    />
                  )}
                  <span className="relative z-10">{label}</span>
                </button>
              ))}
            </div>

            {/* Toggle Bar / Tendência */}
            <div className="flex items-center gap-0.5 p-0.5 bg-zinc-100 dark:bg-zinc-800 rounded-lg">
              {[
                { key: 'bar', Icon: BarChart2 },
                { key: 'trend', Icon: TrendingUp },
              ].map(({ key, Icon }) => (
                <button
                  key={key}
                  onClick={() => setViewMode(key)}
                  className={`relative flex items-center px-2 py-1 rounded-md text-[10px] font-bold transition-all duration-150 select-none
                    ${viewMode === key ? 'text-zinc-900 dark:text-white' : 'text-zinc-400 dark:text-zinc-500 hover:text-zinc-600 dark:hover:text-zinc-300'}`}
                >
                  {viewMode === key && (
                    <motion.div
                      layoutId="view-pill"
                      className="absolute inset-0 bg-white dark:bg-zinc-700 rounded-md shadow-sm"
                      transition={{ type: 'spring', stiffness: 400, damping: 35 }}
                    />
                  )}
                  <Icon size={11} strokeWidth={2.5} className="relative z-10" />
                </button>
              ))}
            </div>

            <InlineSelect options={FILTER_OPTIONS} value={period} onChange={setPeriod} />
          </div>
        </div>
      </div>

      {/* ── BODY ── */}
      <div className="p-4">
        {!hasData ? (
          <div className="flex flex-col items-center justify-center py-10 text-zinc-400">
            <div className="p-4 rounded-2xl bg-zinc-100 dark:bg-zinc-800 mb-3">
              <BarChart2 size={24} className="opacity-40" />
            </div>
            <p className="text-xs font-bold text-zinc-500 dark:text-zinc-400">Nenhum simulado no período</p>
          </div>
        ) : (
          <div className="space-y-3">

            {/* ── MINI STATS ── */}
            {stats && !compact && (
              <div className="grid grid-cols-4 gap-2">
                {[
                  { icon: Target,    label: 'Média %',     value: `${stats.avg}%`,                       color: getScoreColor(stats.avg) },
                  { icon: Award,     label: 'Melhor %',    value: `${stats.best}%`,                      color: '#10b981' },
                  { icon: BarChart2, label: 'Média Pts',   value: stats.mediaPontos != null ? stats.mediaPontos.toFixed(1) : '—', color: '#3b82f6' },
                  { icon: TrendIcon, label: 'Evolução',    value: stats.trendVal !== 0 ? `${stats.trendVal > 0 ? '+' : ''}${stats.trendVal}%` : '—', color: trendColor },
                ].map(({ icon: Icon, label, value, color }, i) => (
                  <motion.div
                    key={label}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05, duration: 0.3 }}
                    className="flex flex-col justify-between bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-100 dark:border-zinc-800 rounded-xl p-2.5 min-w-0"
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-[9px] font-black uppercase tracking-widest text-zinc-400">{label}</span>
                      <div className="p-1 rounded-md" style={{ backgroundColor: `${color}18` }}>
                        <Icon size={10} style={{ color }} />
                      </div>
                    </div>
                    <span className="text-lg font-black leading-none" style={{ color }}>{value}</span>
                  </motion.div>
                ))}
              </div>
            )}

            {/* ── GRÁFICO ── */}
            <AnimatePresence mode="wait">
              <motion.div
                key={`${viewMode}-${metric}`}
                initial={{ opacity: 0, x: viewMode === 'bar' ? -8 : 8 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="w-full"
                style={{ height: chartHeight }}
              >
                <ResponsiveContainer width="100%" height="100%">
                  {viewMode === 'bar' ? (
                    <BarChart
                      data={chartData}
                      margin={{ top: 8, right: 6, left: -24, bottom: 0 }}
                      onMouseLeave={() => setActiveIndex(null)}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="text-zinc-100 dark:text-zinc-800" vertical={false} />
                      <XAxis
                        dataKey="xLabel"
                        tick={{ fontSize: 9, fontWeight: 700, fill: 'currentColor' }}
                        className="text-zinc-400 dark:text-zinc-500"
                        axisLine={false}
                        tickLine={false}
                        interval={chartData.length > 10 ? Math.floor(chartData.length / 8) : 0}
                      />
                      <YAxis
                        domain={yDomain}
                        ticks={yTicks}
                        tick={{ fontSize: 9, fontWeight: 700, fill: 'currentColor' }}
                        className="text-zinc-400 dark:text-zinc-500"
                        axisLine={false}
                        tickLine={false}
                        tickFormatter={yFormatter}
                      />
                      <Tooltip
                        content={<CustomTooltip metric={metric} />}
                        cursor={{ fill: 'transparent' }}
                        wrapperStyle={{ zIndex: 9999, overflow: 'visible' }}
                      />
                      {avgLine != null && (
                        <ReferenceLine
                          y={avgLine}
                          stroke="#ef4444"
                          strokeDasharray="5 4"
                          strokeOpacity={0.5}
                          strokeWidth={1.5}
                          label={{ value: `Média ${metric === 'pontos' ? avgLine : `${avgLine}%`}`, position: 'insideTopRight', fill: '#ef4444', fontSize: 9, fontWeight: 800, opacity: 0.7 }}
                        />
                      )}
                      <Bar
                        dataKey={dataKey}
                        shape={(props) => {
                          // score vem do payload do dado, não das props injetadas pelo Recharts
                          const payloadScore = props?.score ?? props?.payload?.score ?? null;
                          return (
                            <CustomBar
                              {...props}
                              score={payloadScore}
                              isActive={activeIndex === props.index}
                            />
                          );
                        }}
                        onMouseEnter={(_, index) => setActiveIndex(index)}
                        maxBarSize={42}
                        isAnimationActive={true}
                        animationDuration={700}
                        animationEasing="ease-out"
                      >
                        {chartData.map((entry, index) => (
                          <Cell key={index} fill={getScoreColor(entry.score)} />
                        ))}
                      </Bar>
                    </BarChart>
                  ) : (
                    <ComposedChart data={chartData} margin={{ top: 8, right: 6, left: -24, bottom: 0 }}>
                      <defs>
                        <linearGradient id="scoreGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#ef4444" stopOpacity={0.25} />
                          <stop offset="95%" stopColor="#ef4444" stopOpacity={0.02} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="text-zinc-100 dark:text-zinc-800" vertical={false} />
                      <XAxis
                        dataKey="xLabel"
                        tick={{ fontSize: 9, fontWeight: 700, fill: 'currentColor' }}
                        className="text-zinc-400 dark:text-zinc-500"
                        axisLine={false}
                        tickLine={false}
                        interval={chartData.length > 10 ? Math.floor(chartData.length / 8) : 0}
                      />
                      <YAxis
                        domain={yDomain}
                        ticks={yTicks}
                        tick={{ fontSize: 9, fontWeight: 700, fill: 'currentColor' }}
                        className="text-zinc-400 dark:text-zinc-500"
                        axisLine={false}
                        tickLine={false}
                        tickFormatter={yFormatter}
                      />
                      <Tooltip
                        content={<CustomTooltip metric={metric} />}
                        cursor={{ stroke: '#ef4444', strokeWidth: 1, strokeDasharray: '4 3', strokeOpacity: 0.4 }}
                        wrapperStyle={{ zIndex: 9999, overflow: 'visible' }}
                      />
                      {avgLine != null && (
                        <ReferenceLine
                          y={avgLine}
                          stroke="#ef4444"
                          strokeDasharray="5 4"
                          strokeOpacity={0.4}
                          strokeWidth={1.5}
                          label={{ value: `Média ${metric === 'pontos' ? avgLine : `${avgLine}%`}`, position: 'insideTopRight', fill: '#ef4444', fontSize: 9, fontWeight: 800, opacity: 0.6 }}
                        />
                      )}
                      <Area type="monotone" dataKey={dataKey} fill="url(#scoreGradient)" stroke="none" isAnimationActive={true} animationDuration={800} />
                      <Line
                        type="monotone"
                        dataKey={dataKey}
                        stroke="#ef4444"
                        strokeWidth={2}
                        dot={(props) => {
                          const { cx, cy, payload, index } = props;
                          const color = getScoreColor(payload.score);
                          return (
                            <g key={index}>
                              <circle cx={cx} cy={cy} r={4} fill={color} stroke="#18181b" strokeWidth={1.5} />
                              {index === chartData.length - 1 && (
                                <circle cx={cx} cy={cy} r={7} fill={color} fillOpacity={0.2} />
                              )}
                            </g>
                          );
                        }}
                        activeDot={{ r: 6, fill: '#ef4444', stroke: '#18181b', strokeWidth: 2 }}
                        isAnimationActive={true}
                        animationDuration={800}
                      />
                    </ComposedChart>
                  )}
                </ResponsiveContainer>
              </motion.div>
            </AnimatePresence>

            {/* ── LEGENDA DE CORES ── */}
            {!compact && (
              <div className="flex items-center gap-3 flex-wrap pt-1 border-t border-zinc-100 dark:border-zinc-800">
                {[
                  { label: '≥80%', color: '#10b981' },
                  { label: '60–79%', color: '#f59e0b' },
                  { label: '40–59%', color: '#f97316' },
                  { label: '<40%', color: '#ef4444' },
                ].map(({ label, color }) => (
                  <div key={label} className="flex items-center gap-1">
                    <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
                    <span className="text-[9px] font-bold text-zinc-500">{label}</span>
                  </div>
                ))}
              </div>
            )}

          </div>
        )}
      </div>
    </motion.div>
  );
};

export default SimuladoGrafico;