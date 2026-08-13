import React, { useMemo } from 'react';
import {
  ResponsiveContainer, ComposedChart, Line, Area, CartesianGrid, XAxis, YAxis, Tooltip,
  Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
} from 'recharts';
import {
  TrendingUp, TrendingDown, BookOpen, CheckCircle2, XCircle,
  Target, Crosshair, AlertCircle,
} from 'lucide-react';
import DesempenhoGrafico from './DesempenhoGrafico';

// ============================================================================
// HELPERS
// ============================================================================
const formatHM = (minutes) => {
  if (!minutes || isNaN(minutes) || minutes === 0) return '0m';
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
};

const performanceCardClass = 'group relative flex flex-col overflow-hidden rounded-xl border-2 border-l-4 border-zinc-200 !border-l-red-500/20 bg-white transition-all duration-300 hover:-translate-y-0.5 hover:border-accent-light/40 hover:!border-l-red-500 hover:shadow-[0_0_18px_rgba(239,68,68,0.07)] dark:border-white/10 dark:!border-l-red-500/25 dark:bg-card-dark dark:hover:border-accent-light/20 dark:hover:!border-l-red-500 dark:hover:shadow-[0_0_22px_rgba(239,68,68,0.08)]';

// ============================================================================
// TOOLTIP — EVOLUÇÃO
// ============================================================================
const EvolutionTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  const raw = payload[0]?.payload || {};
  const timeMinutes = raw.timeMinutes ?? (raw.timeHours != null ? raw.timeHours * 60 : null);
  const questions = raw.questions ?? null;
  const correct   = raw.correct   ?? null;
  const wrong     = (questions != null && correct != null) ? questions - correct : null;
  const accuracy  = raw.accuracy  ?? null;
  const hasQ = questions !== null && questions > 0;

  return (
    <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700/50 rounded-2xl shadow-2xl overflow-hidden min-w-[180px] z-50">
      <div className="px-3.5 py-2 bg-zinc-50 dark:bg-zinc-800/60 border-b border-zinc-100 dark:border-zinc-700/50">
        <p className="font-black text-zinc-700 dark:text-zinc-200 text-[11px] uppercase tracking-widest">{label}</p>
      </div>
      <div className="px-3.5 py-2.5 space-y-2">
        <div className="flex items-center justify-between gap-6">
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-red-500 flex-shrink-0" />
            <span className="text-[10px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">Tempo</span>
          </div>
          <span className="text-[11px] font-black text-zinc-900 dark:text-white tabular-nums">
            {timeMinutes != null ? formatHM(timeMinutes) : '—'}
          </span>
        </div>
        {hasQ && (
          <div className="border-t border-zinc-100 dark:border-zinc-700/50 pt-2 space-y-1.5">
            <div className="flex items-center justify-between gap-6">
              <div className="flex items-center gap-1.5">
                <Target size={10} className="text-zinc-400 flex-shrink-0" strokeWidth={2.5} />
                <span className="text-[10px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">Questões</span>
              </div>
              <span className="text-[11px] font-black text-zinc-900 dark:text-white tabular-nums">{questions}</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1 flex-1 justify-center px-2 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-900/20">
                <CheckCircle2 size={10} className="text-emerald-500" strokeWidth={3} />
                <span className="text-[10px] font-black text-emerald-600 dark:text-emerald-400 tabular-nums">{correct}</span>
              </div>
              <div className="flex items-center gap-1 flex-1 justify-center px-2 py-1 rounded-lg bg-red-50 dark:bg-red-900/20">
                <XCircle size={10} className="text-red-500" strokeWidth={3} />
                <span className="text-[10px] font-black text-red-600 dark:text-red-400 tabular-nums">{wrong}</span>
              </div>
            </div>
            {accuracy !== null && (
              <>
                <div className="flex items-center justify-between gap-6">
                  <div className="flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full bg-zinc-400 flex-shrink-0" />
                    <span className="text-[10px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">Precisão</span>
                  </div>
                  <span className="text-[11px] font-black tabular-nums" style={{ color: accuracy >= 70 ? '#10b981' : accuracy >= 50 ? '#f59e0b' : '#ef4444' }}>
                    {accuracy}%
                  </span>
                </div>
                <div className="h-1.5 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden mt-0.5">
                  <div className="h-full rounded-full transition-all duration-500" style={{ width: `${accuracy}%`, backgroundColor: accuracy >= 70 ? '#10b981' : accuracy >= 50 ? '#f59e0b' : '#ef4444' }} />
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

// ============================================================================
// TOOLTIP — RADAR
// ============================================================================
const RadarTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null;
  const userData = payload.find(p => p.dataKey === 'A');
  if (!userData) return null;
  const data = userData.payload;
  return (
    <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700/50 px-3 py-2.5 rounded-xl shadow-xl z-50 min-w-[140px]">
      <div className="flex items-center gap-2 mb-2 pb-2 border-b border-zinc-100 dark:border-zinc-800">
        <div className="w-2 h-2 rounded-full bg-indigo-500" />
        <p className="text-[10px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider truncate max-w-[200px]">{data.subject}</p>
      </div>
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-bold text-zinc-400 uppercase">Sua Nota</span>
          <span className="text-sm font-black text-indigo-500 tabular-nums">{data.A}%</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-bold text-zinc-400 uppercase">Meta (80%)</span>
          <span className={`text-xs font-bold tabular-nums ${data.A >= 80 ? 'text-emerald-500' : 'text-red-500'}`}>
            {data.A >= 80 ? 'Atingida' : `-${80 - data.A}%`}
          </span>
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// COMPONENTE PRINCIPAL
// ============================================================================
const DesempenhoResumo = ({
  filteredRecords = [],
  evolutionData = [],
  tableData = [],
}) => {

  // -- TENDÊNCIA --
  const trend = useMemo(() => {
    if (!evolutionData || evolutionData.length < 4) return 0;
    const mid     = Math.floor(evolutionData.length / 2);
    const first   = evolutionData.slice(0, mid);
    const second  = evolutionData.slice(mid);
    const avgFirst  = first.reduce((a, b) => a + (b.accuracy || 0), 0) / first.length;
    const avgSecond = second.reduce((a, b) => a + (b.accuracy || 0), 0) / second.length;
    return avgFirst > 0 ? Math.round(((avgSecond - avgFirst) / avgFirst) * 100) : 0;
  }, [evolutionData]);

  // -- RADAR --
  // CORREÇÃO 3: permite aparecer com 1 disciplina (removido o limite mínimo de 3)
  // Mantemos mínimo de 1 entrada válida para o radar funcionar.
  const radarData = useMemo(() => {
    const groups = {};
    filteredRecords.forEach(reg => {
      const disc = reg.disciplinaNome || 'Geral';
      const certas = Number(reg.acertos) || 0;
      const total  = Number(reg.questoesFeitas) || 0;
      if (total > 0) {
        if (!groups[disc]) groups[disc] = { totalQ: 0, totalC: 0 };
        groups[disc].totalQ += total;
        groups[disc].totalC += certas;
      }
    });
    return Object.entries(groups)
      .map(([name, val]) => ({
        subject: name,
        A: val.totalQ > 0 ? Math.round((val.totalC / val.totalQ) * 100) : 0,
        meta: 80,
        q: val.totalQ,
        fullMark: 100,
      }))
      .sort((a, b) => b.q - a.q);
  }, [filteredRecords]);

  // -- RENDERER LABELS RADAR --
  const renderPolarAngleAxis = ({ payload, x, y, cx, cy, ...rest }) => {
    const text = payload.value || '';
    let line1 = text, line2 = '';
    if (text.length > 15) {
      const words = text.split(' ');
      if (words.length > 1) {
        const mid = Math.ceil(words.length / 2);
        line1 = words.slice(0, mid).join(' ');
        line2 = words.slice(mid).join(' ');
      } else {
        line1 = text.substring(0, 13) + '...';
      }
    }
    const isBottom = y > cy;
    const isLeft   = x < cx;
    const isRight  = x > cx;
    let modX = x + (x - cx) / 5;
    let modY = y + (y - cy) / 5;
    if (isBottom) {
      modY += 12;
      if (isLeft)  modX -= 18;
      if (isRight) modX += 18;
    }
    return (
      <text {...rest} x={modX} y={modY} fontSize={9} fontWeight={700} fill="#71717a" textAnchor="middle">
        <tspan x={modX} dy={line2 ? '-4' : '4'}>{line1}</tspan>
        {line2 && <tspan x={modX} dy="12">{line2}</tspan>}
      </text>
    );
  };

  // CORREÇÃO 3: Quando só há 1 disciplina, exibimos uma barra de precisão em vez do radar
  const renderRadarOrSingle = () => {
    if (radarData.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center text-zinc-400 dark:text-zinc-600 text-center max-w-[220px]">
          <div className="p-3 bg-zinc-50 dark:bg-zinc-900 rounded-full mb-3">
            <AlertCircle size={24} className="opacity-40" />
          </div>
          <p className="text-xs font-bold text-zinc-500 dark:text-zinc-400">Dados Insuficientes</p>
          <p className="text-[10px] mt-1 leading-relaxed">
            Registre questões em pelo menos <strong className="text-indigo-500">1 matéria</strong> com questões respondidas para visualizar o equilíbrio.
          </p>
        </div>
      );
    }

    if (radarData.length < 3) {
      // Vista de barras para 1 ou 2 disciplinas
      return (
        <div className="w-full px-4 space-y-4">
          <p className="text-[10px] text-zinc-400 text-center mb-2">
            {radarData.length === 1
              ? 'Visualização em barra — adicione mais matérias para o radar completo'
              : 'Visualização em barras — adicione uma terceira matéria para o radar'}
          </p>
          {radarData.map((item) => (
            <div key={item.subject} className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-zinc-700 dark:text-zinc-300 truncate max-w-[180px]">{item.subject}</span>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold text-zinc-400">{item.q}q</span>
                  <span
                    className="text-sm font-black tabular-nums"
                    style={{ color: item.A >= 80 ? '#10b981' : item.A >= 60 ? '#f59e0b' : '#ef4444' }}
                  >
                    {item.A}%
                  </span>
                </div>
              </div>
              <div className="h-2 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{
                    width: `${item.A}%`,
                    backgroundColor: item.A >= 80 ? '#10b981' : item.A >= 60 ? '#f59e0b' : '#ef4444',
                  }}
                />
              </div>
              {/* Indicador de meta */}
              <div className="flex items-center justify-between text-[9px] text-zinc-400">
                <span>Meta: 80%</span>
                <span className={item.A >= 80 ? 'text-emerald-500 font-bold' : 'text-red-400 font-bold'}>
                  {item.A >= 80 ? '✓ Atingida' : `Faltam ${80 - item.A}%`}
                </span>
              </div>
            </div>
          ))}
        </div>
      );
    }

    // Radar normal para 3+ disciplinas
    return (
      <div className="w-full h-full min-h-[300px]">
        <ResponsiveContainer width="100%" height="100%">
          <RadarChart cx="50%" cy="50%" outerRadius="70%" data={radarData}>
            <PolarGrid stroke="#e4e4e7" strokeDasharray="3 3" className="dark:stroke-zinc-800" />
            <PolarAngleAxis dataKey="subject" tick={renderPolarAngleAxis} />
            <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
            <Radar name="Meta" dataKey="meta" stroke="#a1a1aa" strokeWidth={1} strokeDasharray="4 4" fill="#a1a1aa" fillOpacity={0.05} />
            <Radar name="Você" dataKey="A" stroke="#6366f1" strokeWidth={3} fill="#6366f1" fillOpacity={0.4} />
            <Tooltip content={<RadarTooltip />} cursor={false} />
          </RadarChart>
        </ResponsiveContainer>
      </div>
    );
  };

  return (
    <div className="xl:col-span-3 flex flex-col gap-6">

      {/* ── LINHA SUPERIOR: PIZZA + RADAR ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* CARD 1: Distribuição de Tempo/Questões */}
        {/* CORREÇÃO 2: Filtro de volta + modo expandido — gerenciado dentro do DesempenhoGrafico */}
        {/* CORREÇÃO 6: Subtítulo explica o que o gráfico faz */}
        <div className={`${performanceCardClass} min-h-[420px]`}>
          <div className="p-4 border-b border-zinc-100 dark:border-zinc-800 flex items-start gap-3 bg-zinc-50/50 dark:bg-transparent">
            <div className="relative shrink-0">
              <div className="absolute inset-0 animate-ping rounded-full bg-red-500/20 opacity-30 duration-[3s]" />
              <div className="relative flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-red-600 to-rose-700 text-white shadow-xl shadow-red-500/20">
                <BookOpen size={20} strokeWidth={1.8} />
              </div>
            </div>
            <div className="min-w-0">
              <h3 className="text-lg font-black uppercase tracking-tight text-zinc-900 dark:text-white leading-tight">
                Distribuicao <span className="bg-gradient-to-r from-red-600 to-rose-700 bg-clip-text text-transparent">Tatica</span>
              </h3>
              <span className="hidden">Distribuição</span>
              {/* CORREÇÃO 6 */}
              <p className="mt-1 text-[11px] font-semibold leading-relaxed text-zinc-500 dark:text-zinc-400">Quanto tempo e quantas questoes voce dedicou a cada disciplina.</p>
            </div>
          </div>
          <div className="flex-1 p-2">
            <DesempenhoGrafico filteredRecords={filteredRecords} />
          </div>
        </div>

        {/* CARD 2: Radar de Competências */}
        <div className={`${performanceCardClass} min-h-[420px]`}>
          <div className="p-4 border-b border-zinc-100 dark:border-zinc-800 flex items-start justify-between gap-3 bg-zinc-50/50 dark:bg-transparent">
            <div className="flex min-w-0 items-start gap-3">
              <div className="relative shrink-0">
                <div className="absolute inset-0 animate-ping rounded-full bg-red-500/20 opacity-30 duration-[3s]" />
                <div className="relative flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-red-600 to-rose-700 text-white shadow-xl shadow-red-500/20">
                  <Crosshair size={20} strokeWidth={1.8} />
                </div>
              </div>
              <div className="min-w-0">
                <h3 className="text-lg font-black uppercase tracking-tight text-zinc-900 dark:text-white leading-tight">
                  Equilibrio <span className="bg-gradient-to-r from-red-600 to-rose-700 bg-clip-text text-transparent">Tatico</span>
                </h3>
                <span className="hidden">Equilibrio Tatico</span>
                {/* CORREÇÃO 6 */}
                <p className="mt-1 text-[11px] font-semibold leading-relaxed text-zinc-500 dark:text-zinc-400">Sua taxa de acertos por materia comparada a meta de 80%.</p>
              </div>
            </div>
            {radarData.length >= 3 && (
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1">
                  <div className="w-2 h-2 rounded-full bg-indigo-500/50" />
                  <span className="text-[9px] font-bold text-zinc-400 uppercase">Você</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-2 h-2 rounded-full border border-zinc-400 bg-transparent" />
                  <span className="text-[9px] font-bold text-zinc-400 uppercase">Meta</span>
                </div>
              </div>
            )}
          </div>

          <div className="flex-1 w-full relative flex items-center justify-center p-4">
            {renderRadarOrSingle()}
          </div>
        </div>
      </div>

      {/* ── LINHA INFERIOR: EVOLUÇÃO (FULL WIDTH) ── */}
      <div className={`${performanceCardClass} min-h-[300px] w-full`}>
        <div className="p-4 border-b border-zinc-100 dark:border-zinc-800 flex items-start justify-between gap-3 bg-zinc-50/50 dark:bg-transparent">
          <div className="flex min-w-0 items-start gap-3">
            <div className="relative shrink-0">
              <div className="absolute inset-0 animate-ping rounded-full bg-red-500/20 opacity-30 duration-[3s]" />
              <div className="relative flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-red-600 to-rose-700 text-white shadow-xl shadow-red-500/20">
                <TrendingUp size={20} strokeWidth={1.8} />
              </div>
            </div>
            <div className="min-w-0">
              <h3 className="text-lg font-black uppercase tracking-tight text-zinc-900 dark:text-white leading-tight">
                Evolucao <span className="bg-gradient-to-r from-red-600 to-rose-700 bg-clip-text text-transparent">De Desempenho</span>
              </h3>
              <span className="hidden">Evolucao de Desempenho</span>
              {/* CORREÇÃO 6 */}
              <p className="mt-1 text-[11px] font-semibold leading-relaxed text-zinc-500 dark:text-zinc-400">Acompanhe como suas horas de estudo se correlacionam com sua taxa de acertos ao longo do tempo.</p>
            </div>
          </div>

          {/* CORREÇÃO 4: Legenda das duas séries do gráfico */}
          <div className="flex items-center gap-4 flex-shrink-0">
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-0.5 bg-red-500 rounded-full" />
              <span className="text-[9px] font-bold text-red-500 uppercase tracking-wide">Horas</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-0.5 rounded-full" style={{ backgroundColor: '#6366f1' }} />
              <span className="text-[9px] font-bold uppercase tracking-wide" style={{ color: '#6366f1' }}>Precisão %</span>
            </div>
            {trend !== 0 && (
              <div className={`flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1 rounded-lg border ${
                trend >= 0
                  ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/20'
                  : 'bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 border-red-200 dark:border-red-500/20'
              }`}>
                {trend >= 0 ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
                {Math.abs(trend)}% vs início
              </div>
            )}
          </div>
        </div>
        <div className="flex-1 p-4 min-h-[250px]">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={evolutionData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="gradHoursR" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#dc2626" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="#dc2626" stopOpacity={0.02} />
                </linearGradient>
                <linearGradient id="gradAccuracy" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#6366f1" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#6366f1" stopOpacity={0.0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e4e4e7" strokeOpacity={0.7} />
              <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: '#71717a', fontWeight: 600 }} dy={8} />
              {/* Eixo esquerdo: horas (vermelho) */}
              <YAxis yAxisId="left" axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: '#dc2626', fontWeight: 600 }} />
              {/* Eixo direito: precisão % (indigo) */}
              <YAxis yAxisId="right" orientation="right" axisLine={false} tickLine={false} unit="%" domain={[0, 100]} tick={{ fontSize: 9, fill: '#6366f1', fontWeight: 600 }} />
              <Tooltip
                content={<EvolutionTooltip />}
                cursor={{ stroke: '#ef4444', strokeWidth: 1, strokeDasharray: '4 4', strokeOpacity: 0.4 }}
                wrapperStyle={{ zIndex: 50 }}
              />
              {/* Área vermelha: horas estudadas — null = sem estudo nesse dia (não plota) */}
              <Area
                yAxisId="left"
                type="monotone"
                dataKey="timeHours"
                name="Horas"
                unit="h"
                stroke="#dc2626"
                strokeWidth={2.5}
                fill="url(#gradHoursR)"
                dot={false}
                connectNulls={false}
              />
              {/* Linha indigo: precisão % — null = sem questões nesse dia (não plota) */}
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="accuracy"
                name="Precisão"
                unit="%"
                stroke="#6366f1"
                strokeWidth={2}
                dot={{ r: 3, fill: '#6366f1', strokeWidth: 0 }}
                activeDot={{ r: 5, fill: '#6366f1', stroke: '#fff', strokeWidth: 2 }}
                connectNulls={false}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};

export default DesempenhoResumo;
