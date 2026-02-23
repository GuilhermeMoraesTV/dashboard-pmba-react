import React, { useMemo, useState } from 'react';
import {
  ResponsiveContainer, ComposedChart, Line, Area, CartesianGrid, XAxis, YAxis, Tooltip,
  Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Legend
} from 'recharts';
import {
  TrendingUp, TrendingDown, BookOpen, CheckCircle2, XCircle, Target, Crosshair, AlertCircle, Info
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

// ============================================================================
// TOOLTIP CUSTOMIZADO — EVOLUÇÃO
// ============================================================================
const EvolutionTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;

  const raw = payload[0]?.payload || {};
  const timeMinutes = raw.timeMinutes ?? (raw.timeHours != null ? raw.timeHours * 60 : null);
  const questions   = raw.questions  ?? null;
  const correct     = raw.correct    ?? null;
  const wrong       = (questions != null && correct != null) ? questions - correct : null;
  const accuracy    = raw.accuracy   ?? null;
  const hasQuestions = questions !== null && questions > 0;

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
        {hasQuestions && (
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
              <div className="flex items-center justify-between gap-6">
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full bg-zinc-400 flex-shrink-0" />
                  <span className="text-[10px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">Precisão</span>
                </div>
                <span className="text-[11px] font-black tabular-nums" style={{ color: accuracy >= 70 ? '#10b981' : accuracy >= 50 ? '#f59e0b' : '#ef4444' }}>{accuracy}%</span>
              </div>
            )}
            {accuracy !== null && (
              <div className="h-1.5 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden mt-0.5">
                <div className="h-full rounded-full transition-all duration-500" style={{ width: `${accuracy}%`, backgroundColor: accuracy >= 70 ? '#10b981' : accuracy >= 50 ? '#f59e0b' : '#ef4444' }} />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

// ============================================================================
// TOOLTIP CUSTOMIZADO — RADAR
// ============================================================================
const RadarTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null;
  // Payload pode vir misturado (meta vs usuario), filtramos o usuario (dataKey="A")
  const userData = payload.find(p => p.dataKey === 'A');
  const metaData = payload.find(p => p.dataKey === 'meta');

  if (!userData) return null;
  const data = userData.payload;

  return (
    <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700/50 px-3 py-2.5 rounded-xl shadow-xl z-50 min-w-[140px]">
      <div className="flex items-center gap-2 mb-2 pb-2 border-b border-zinc-100 dark:border-zinc-800">
        <div className="w-2 h-2 rounded-full bg-indigo-500"></div>
        <p className="text-[10px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider truncate max-w-[120px]">{data.subject}</p>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
           <span className="text-[10px] font-bold text-zinc-400 uppercase">Sua Nota</span>
           <span className="text-sm font-black text-indigo-500 tabular-nums">{data.A}%</span>
        </div>
        <div className="flex items-center justify-between">
           <span className="text-[10px] font-bold text-zinc-400 uppercase">Meta Estável (80%) </span>
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
const DesempenhoResumo = ({ registrosEstudo, activeCicloId, evolutionData }) => {

  // -- CÁLCULO DE TENDÊNCIA --
  const trend = useMemo(() => {
    if (!evolutionData || evolutionData.length < 4) return 0;
    const mid = Math.floor(evolutionData.length / 2);
    const first  = evolutionData.slice(0, mid);
    const second = evolutionData.slice(mid);
    const avgFirst  = first.reduce((a, b) => a + (b.accuracy || 0), 0) / first.length;
    const avgSecond = second.reduce((a, b) => a + (b.accuracy || 0), 0) / second.length;
    return avgFirst > 0 ? Math.round(((avgSecond - avgFirst) / avgFirst) * 100) : 0;
  }, [evolutionData]);

  // -- CÁLCULO DO RADAR --
  const radarData = useMemo(() => {
    if (!registrosEstudo || registrosEstudo.length === 0) return [];

    // 1. Filtrar pelo ciclo (se houver)
    const filtered = activeCicloId
      ? registrosEstudo.filter(r => r.cicloId === activeCicloId)
      : registrosEstudo;

    // 2. Agrupar dados
    const groups = {};

    filtered.forEach(reg => {
      const disc = reg.disciplinaNome || 'Geral';

      const certas = Number(reg.acertos) || Number(reg.questoesCertas) || Number(reg.qtdAcertos) || Number(reg.correct) || 0;
      const total = Number(reg.questoesFeitas) || Number(reg.questoes) || Number(reg.total) || 0;

      if (total > 0) {
        if (!groups[disc]) groups[disc] = { totalQ: 0, totalC: 0 };
        groups[disc].totalQ += total;
        groups[disc].totalC += certas;
      }
    });

    // 3. Formatar para Recharts (Com Meta Fixa de 80%)
    const result = Object.entries(groups)
      .map(([name, val]) => ({
        subject: name,
        A: val.totalQ > 0 ? Math.round((val.totalC / val.totalQ) * 100) : 0,
        meta: 80, // Meta de "Corte" fictícia ou configurável
        q: val.totalQ,
        fullMark: 100
      }))
      .sort((a, b) => b.q - a.q)
      .slice(0, 6);

    return result;
  }, [registrosEstudo, activeCicloId]);

  // Renderer Customizado para os Textos do Radar
  const renderPolarAngleAxis = ({ payload, x, y, cx, cy, ...rest }) => {
    return (
      <text
        {...rest}
        x={x + (x - cx) / 10}
        y={y + (y - cy) / 10}
        dy={4}
        fontSize={10}
        fontWeight={700}
        fill="#71717a"
        textAnchor="middle"
      >
        {payload.value}
      </text>
    );
  };

  return (
    <div className="xl:col-span-3 flex flex-col gap-6">

      {/* ── LINHA SUPERIOR: PIZZA + RADAR ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* CARD 1: Distribuição de Tempo */}
        <div className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-2xl overflow-hidden flex flex-col min-h-[420px]">
          <div className="p-4 border-b border-zinc-100 dark:border-zinc-800 flex items-center gap-2.5 bg-zinc-50/50 dark:bg-transparent">
            <div className="p-1.5 bg-red-500/10 rounded-lg">
              <BookOpen size={15} className="text-red-500" strokeWidth={2.5} />
            </div>
            <div>
              <span className="text-xs font-black text-zinc-900 dark:text-zinc-100 uppercase tracking-tight">Distribuição de Tempo</span>
              <p className="text-[10px] text-zinc-500 mt-0.5">Foco quantitativo</p>
            </div>
          </div>
          <div className="flex-1 p-2">
            <DesempenhoGrafico
              registrosEstudo={(registrosEstudo || []).filter(r => r.cicloId === activeCicloId)}
            />
          </div>
        </div>

        {/* CARD 2: Radar de Competências (Aumentado + Comparativo) */}
        <div className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-2xl overflow-hidden flex flex-col min-h-[420px]">
          <div className="p-4 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between bg-zinc-50/50 dark:bg-transparent">
            <div className="flex items-center gap-2.5">
              <div className="p-1.5 bg-indigo-500/10 rounded-lg">
                <Crosshair size={15} className="text-indigo-500" strokeWidth={2.5} />
              </div>
              <div>
                <span className="text-xs font-black text-zinc-900 dark:text-zinc-100 uppercase tracking-tight">Equilíbrio Tático</span>
                <p className="text-[10px] text-zinc-500 mt-0.5">Precisão vs Meta (80%)</p>
              </div>
            </div>
            {/* Legenda Simples */}
            <div className="flex items-center gap-3">
               <div className="flex items-center gap-1">
                 <div className="w-2 h-2 rounded-full bg-indigo-500/50"></div>
                 <span className="text-[9px] font-bold text-zinc-400 uppercase">Você</span>
               </div>
               <div className="flex items-center gap-1">
                 <div className="w-2 h-2 rounded-full border border-zinc-400 bg-transparent"></div>
                 <span className="text-[9px] font-bold text-zinc-400 uppercase">Meta</span>
               </div>
            </div>
          </div>

          <div className="flex-1 w-full relative flex items-center justify-center p-2">
            {radarData.length < 3 ? (
              <div className="flex flex-col items-center justify-center text-zinc-400 dark:text-zinc-600 text-center max-w-[220px]">
                <div className="p-3 bg-zinc-50 dark:bg-zinc-900 rounded-full mb-3">
                    <AlertCircle size={24} className="opacity-40" />
                </div>
                <p className="text-xs font-bold text-zinc-500 dark:text-zinc-400">Dados Insuficientes</p>
                <p className="text-[10px] mt-1 leading-relaxed">
                  Registre questões em pelo menos <strong className="text-indigo-500">3 matérias diferentes</strong> para gerar o radar de competências.
                </p>
              </div>
            ) : (
              <div className="w-full h-full min-h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart cx="50%" cy="50%" outerRadius="75%" data={radarData}>
                    <PolarGrid stroke="#e4e4e7" strokeDasharray="3 3" className="dark:stroke-zinc-800" />
                    <PolarAngleAxis dataKey="subject" tick={renderPolarAngleAxis} />
                    <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />

                    {/* Camada da META (Fundo) */}
                    <Radar
                      name="Meta"
                      dataKey="meta"
                      stroke="#a1a1aa" // zinc-400
                      strokeWidth={1}
                      strokeDasharray="4 4"
                      fill="#a1a1aa"
                      fillOpacity={0.05}
                    />

                    {/* Camada do USUÁRIO (Frente) */}
                    <Radar
                      name="Você"
                      dataKey="A"
                      stroke="#6366f1" // Indigo-500
                      strokeWidth={3}
                      fill="#6366f1"
                      fillOpacity={0.4}
                    />

                    <Tooltip content={<RadarTooltip />} cursor={false} />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        </div>

      </div>

      {/* ── LINHA INFERIOR: EVOLUÇÃO (FULL WIDTH) ── */}
      <div className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-2xl overflow-hidden min-h-[300px] flex flex-col w-full">
        <div className="p-4 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between bg-zinc-50/50 dark:bg-transparent">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 bg-red-500/10 rounded-lg">
              <TrendingUp size={15} className="text-red-500" strokeWidth={2.5} />
            </div>
            <div>
              <span className="text-xs font-black text-zinc-900 dark:text-zinc-100 uppercase tracking-tight">Evolução de Desempenho</span>
              <p className="text-[10px] text-zinc-500 mt-0.5">Correlação Horas × Precisão</p>
            </div>
          </div>
          {trend !== 0 && (
            <div className={`flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1 rounded-lg border
              ${trend >= 0
                ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/20'
                : 'bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 border-red-200 dark:border-red-500/20'
              }`}
            >
              {trend >= 0 ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
              {Math.abs(trend)}% vs início
            </div>
          )}
        </div>

        <div className="flex-1 p-4 min-h-[250px]">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={evolutionData || []} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="gradHoursR" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#dc2626" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="#dc2626" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid
                strokeDasharray="3 3" vertical={false}
                stroke="#e4e4e7" strokeOpacity={0.7}
              />
              <XAxis
                dataKey="date" axisLine={false} tickLine={false}
                tick={{ fontSize: 9, fill: '#71717a', fontWeight: 600 }} dy={8}
              />
              <YAxis
                yAxisId="left" axisLine={false} tickLine={false}
                tick={{ fontSize: 9, fill: '#71717a' }}
              />
              <YAxis
                yAxisId="right" orientation="right" axisLine={false} tickLine={false}
                unit="%" domain={[0, 100]} tick={{ fontSize: 9, fill: '#71717a' }}
              />
              <Tooltip
                content={<EvolutionTooltip />}
                cursor={{ stroke: '#ef4444', strokeWidth: 1, strokeDasharray: '4 4', strokeOpacity: 0.4 }}
                wrapperStyle={{ zIndex: 50 }}
              />
              <Area
                yAxisId="left" type="monotone" dataKey="timeHours" name="Horas" unit="h"
                stroke="#dc2626" strokeWidth={2.5} fill="url(#gradHoursR)" dot={false}
              />
              <Line
                yAxisId="right" type="monotone" dataKey="accuracy" name="Precisão" unit="%"
                stroke="#71717a" strokeWidth={2}
                dot={{ r: 3, fill: '#71717a', strokeWidth: 0 }}
                activeDot={{ r: 5, fill: '#ef4444', strokeWidth: 0 }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

    </div>
  );
};

export default DesempenhoResumo;