import React from 'react';
import {
  ClipboardList, ArrowLeftRight, Play, Plus,
  Target, BarChart2, Trophy, TrendingUp, TrendingDown
} from 'lucide-react';
import { motion } from 'framer-motion';
import SimuladoGrafico from './SimuladoGrafico';

// --- CONFIGURAÇÃO DE CORES E ESTILOS ---
const colorMap = {
  blue: {
    text: 'text-zinc-500',
    bgHover: 'group-hover:text-red-500/15 dark:group-hover:text-red-500/10',
    border: 'border-red-500',
    watermark: 'text-red-500/10 dark:text-red-500/5'
  },
  emerald: {
    text: 'text-zinc-500',
    bgHover: 'group-hover:text-red-500/15 dark:group-hover:text-red-500/10',
    border: 'border-red-500',
    watermark: 'text-red-500/10 dark:text-red-500/5'
  },
  red: {
    text: 'text-zinc-500',
    bgHover: 'group-hover:text-red-500/15 dark:group-hover:text-red-500/10',
    border: 'hover:border-red-500',
    watermark: 'text-red-500/10 dark:text-red-500/5'
  },
  zinc: {
    text: 'text-zinc-500',
    bgHover: 'group-hover:text-red-500/15 dark:group-hover:text-red-500/10',
    border: 'border-red-500',
    watermark: 'text-red-500/10 dark:text-red-500/5'
  },
  violet: {
    text: 'text-zinc-500',
    bgHover: 'group-hover:text-red-500/15 dark:group-hover:text-red-500/10',
    border: 'border-red-500',
    watermark: 'text-red-500/10 dark:text-red-500/5'
  },
};

// --- COMPONENTE DE CARD DE ESTATÍSTICA ---
const StatCard = ({ icon: Icon, title, value, subValue, color = 'red', className = "" }) => {
  const theme = colorMap[color] || colorMap.red;

  return (
    <div className={`group relative flex min-h-[104px] flex-col justify-center overflow-hidden rounded-xl border-2 border-l-4 border-zinc-200 !border-l-red-500/20 bg-white px-4 py-3 shadow-soft transition-all duration-300 hover:-translate-y-0.5 hover:border-accent-light/40 hover:!border-l-red-500 hover:shadow-[0_0_18px_rgba(239,68,68,0.07)] dark:border-white/10 dark:!border-l-red-500/25 dark:bg-card-dark dark:hover:border-accent-light/20 dark:hover:!border-l-red-500 dark:hover:shadow-[0_0_22px_rgba(239,68,68,0.08)] ${className}`}>
      <div className="relative z-20 flex w-full flex-col gap-1">
        <h3 className="w-full truncate text-[10px] font-semibold uppercase leading-none tracking-wide text-zinc-500 dark:text-zinc-400">
          {title}
        </h3>
        <div className="mt-1.5 flex flex-row items-baseline gap-1.5">
          <div className="text-2xl font-black leading-none tracking-tight text-zinc-900 dark:text-white md:text-3xl">
            {value}
          </div>
          {subValue && <div className="min-w-0 text-[10px] font-semibold leading-none text-zinc-500 opacity-95 dark:text-zinc-400">{subValue}</div>}
        </div>
      </div>

      {/* Marca D'água */}
      <div className={`pointer-events-none absolute -bottom-4 -right-4 z-10 ${theme.watermark} transition-all duration-700 ease-out group-hover:scale-125 group-hover:rotate-[-10deg] ${theme.bgHover}`}>
        <Icon strokeWidth={1.5} className="h-16 w-16 md:h-20 md:w-20" />
      </div>
    </div>
  );
};

// --- HEADER SIMULADO ---
const HeaderSimulado = ({
  kpis,
  simulados,
  searchTerm,
  setSearchTerm,
  compareMode,
  setCompareMode,
  selectedIds,
  onCompareClick,
  onStartClick,
  onNewClick,
  onCancelCompare
}) => {
  return (
    <>
      {/* 1. CABEÇALHO SUPERIOR */}
      <div className="group relative mb-6 overflow-hidden rounded-xl border-2 border-l-4 border-zinc-200 !border-l-red-500/20 bg-white p-4 shadow-soft transition-all duration-300 hover:border-accent-light/40 hover:!border-l-red-500 hover:shadow-[0_0_18px_rgba(239,68,68,0.07)] dark:border-white/10 dark:!border-l-red-500/25 dark:bg-card-dark dark:hover:border-accent-light/20 dark:hover:!border-l-red-500 dark:hover:shadow-[0_0_22px_rgba(239,68,68,0.08)]">
        <div className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-red-500/5 blur-[80px] transition-all duration-700 group-hover:bg-red-500/10" />
        <div className="pointer-events-none absolute -bottom-20 -left-20 h-64 w-64 rounded-full bg-zinc-500/5 blur-[80px]" />
        <div className="relative z-10 flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
            <div className="flex min-w-0 items-start gap-3">
                <div className="relative">
                  <div className="absolute inset-0 animate-ping rounded-full bg-red-500/20 opacity-30 duration-[3s]" />
                  <div className="relative flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-red-600 to-rose-700 text-white shadow-xl shadow-red-500/20">
                      <ClipboardList size={22} strokeWidth={2.1} />
                  </div>
                </div>
                <div className="min-w-0">
                  <h1 className="text-2xl font-black uppercase leading-none tracking-tight text-zinc-900 dark:text-white sm:text-3xl">
                      Simulados <span className="bg-gradient-to-r from-red-600 to-rose-700 bg-clip-text text-transparent">Estrategicos</span>
                  </h1>
                  <p className="mt-2 max-w-2xl text-xs font-semibold leading-relaxed text-zinc-500 dark:text-zinc-400 sm:text-sm">
                    Analise pontuacao, evolucao, comparativos e historico para medir sua preparacao em provas.
                  </p>
                </div>
            </div>

            <div className="simulado-header-actions flex w-full flex-wrap items-center gap-2 md:flex-nowrap xl:w-auto">
                <button
                  onClick={compareMode ? onCancelCompare : () => setCompareMode(true)}
                  className={`flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wide transition-all border ${
                    compareMode
                      ? 'bg-blue-600 border-blue-600 text-white shadow-lg shadow-blue-500/30'
                      : 'bg-zinc-50 dark:bg-zinc-900 border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800'
                  }`}
                >
                  <ArrowLeftRight size={16} /> {compareMode ? 'Cancelar' : 'Comparar'}
                </button>

                {!compareMode && (
                  <>
                    <button
                      onClick={onStartClick}
                      className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wide shadow-lg shadow-emerald-600/30 transition-transform active:scale-95 whitespace-nowrap"
                    >
                      <Play size={16} fill="currentColor" /> Iniciar Simulado
                    </button>

                    <button
                      onClick={onNewClick}
                      className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700 text-white px-5 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wide shadow-lg shadow-red-600/30 transition-transform active:scale-95 whitespace-nowrap"
                    >
                      <Plus size={16} /> Novo Simulado
                    </button>
                  </>
                )}
            </div>
        </div>
      </div>

      {/* 2. KPI CARDS + GRÁFICO LADO A LADO */}
      {kpis && (
        <div className="flex flex-col xl:flex-row gap-4 mb-6">

          {/* Cards de KPI — empilhados em grid 2x2 */}
          <div className="grid grid-cols-2 gap-3 xl:w-[420px] shrink-0">
            <StatCard icon={Target}    title="Total Realizado"  value={kpis.totalSimulados}               subValue="Simulados"       color="red" />
            <StatCard icon={BarChart2} title="Média Geral"      value={kpis.mediaPontos.toFixed(1)}       subValue="Pontos Líquidos" color="red" />
            <StatCard icon={Trophy}    title="Recorde Pessoal"  value={kpis.melhorNotaPontos.toFixed(1)}  subValue="Maior pontuação" color="red" />
            <StatCard
              icon={kpis.trend > 0 ? TrendingUp : TrendingDown}
              title="Último Resultado"
              value={(kpis.ultimo?.resumo?.pontosObtidos || 0).toFixed(1)}
              color="red"
              subValue={
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="truncate max-w-[70px] md:max-w-[90px] block font-semibold" title={kpis.ultimo?.titulo}>{kpis.ultimo?.titulo || '-'}</span>
                  {kpis.trend !== 0 && (
                    <span className={`flex items-center text-[9px] font-black px-1 py-0.5 rounded ${kpis.trend > 0 ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'}`}>
                      {kpis.trend > 0 ? '+' : ''}{kpis.trend.toFixed(1)}
                    </span>
                  )}
                </div>
              }
            />
          </div>

          {/* Gráfico compacto — ocupa o espaço restante */}
          {simulados && simulados.length > 0 && (
            <div className="flex-1 min-w-0">
              <SimuladoGrafico simulados={simulados} compact={true} />
            </div>
          )}
        </div>
      )}

      {/* Se não há KPIs mas há simulados, mostra só o gráfico */}
      {!kpis && simulados && simulados.length > 0 && (
        <div className="mb-6">
          <SimuladoGrafico simulados={simulados} compact={false} />
        </div>
      )}

      {/* 3. BARRA DE BUSCA (Sticky) */}
      {/* ⚠️ CORREÇÃO CRÍTICA: Removido 'overflow-hidden' que travava o scroll */}
      {compareMode && <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-sm">
        <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 flex flex-col md:flex-row md:justify-between md:items-center gap-3 bg-zinc-50/50 dark:bg-zinc-900/50 backdrop-blur-sm sticky top-0 z-10 rounded-t-3xl">
            <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="flex items-center justify-between md:justify-end gap-3 w-full md:w-auto">
              <span className="text-xs font-bold text-zinc-600 dark:text-zinc-300 bg-white dark:bg-zinc-800 px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 uppercase tracking-wide">
                {selectedIds.length} selecionados
              </span>
              <button disabled={selectedIds.length < 2} onClick={onCompareClick} className="bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wide shadow-lg shadow-blue-600/20 transition-all flex items-center gap-2">
                <TrendingUp size={16} /> Analisar Evolução
              </button>
            </motion.div>
        </div>
      </div>}
    </>
  );
};

export default HeaderSimulado;

