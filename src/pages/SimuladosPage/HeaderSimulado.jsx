import React from 'react';
import {
  ClipboardList, ArrowLeftRight, Play, Plus, Search,
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
    <div className={`relative overflow-hidden group p-3 md:p-4 h-[100px] md:h-[120px] flex flex-col justify-center items-start transition-all duration-500 hover:shadow-lg border-l-4 border-red-500 bg-white dark:bg-zinc-900 rounded-2xl shadow-sm ${className}`}>
      <div className="relative z-20 flex flex-col gap-0.5 w-full">
        <h3 className="text-[10px] md:text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 truncate w-full">
          {title}
        </h3>
        <div className="flex flex-col md:flex-row md:items-end gap-0 md:gap-1.5">
          <div className="text-xl md:text-2xl lg:text-3xl font-extrabold text-zinc-900 dark:text-white tracking-tight leading-none">
            {value}
          </div>
          {subValue && <div className="mb-0 md:mb-0.5 text-[10px] md:text-xs opacity-90 text-zinc-500 dark:text-zinc-400 font-medium">{subValue}</div>}
        </div>
      </div>

      {/* Marca D'água */}
      <div className={`absolute -bottom-4 -right-4 md:-bottom-5 md:-right-5 ${theme.watermark} transition-all duration-700 ease-out group-hover:scale-125 group-hover:rotate-[-10deg] ${theme.bgHover} z-10 pointer-events-none`}>
        <Icon strokeWidth={1.5} className="w-20 h-20 md:w-28 md:h-28" />
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
      <div className="border-b border-zinc-200 dark:border-zinc-800 pb-4 mb-6">
        <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4">
            <div className="flex items-center gap-3">
                <div className="p-2.5 bg-red-100 dark:bg-red-900/20 text-red-600 dark:text-red-500 rounded-xl">
                    <ClipboardList size={28} strokeWidth={2} />
                </div>
                <div>
                  <h1 className="text-3xl font-black text-zinc-800 dark:text-white tracking-tight uppercase leading-none">
                      Simulados
                  </h1>
                </div>
            </div>

            <div className="flex items-center gap-2 w-full xl:w-auto flex-wrap md:flex-nowrap">
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
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-t-3xl shadow-sm border-b-0">
        <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 flex flex-col md:flex-row md:justify-between md:items-center gap-3 bg-zinc-50/50 dark:bg-zinc-900/50 backdrop-blur-sm sticky top-0 z-10 rounded-t-3xl">
          <div className="relative w-full md:w-80">
            <Search className="absolute left-3 top-3 text-zinc-400" size={16} />
            <input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar simulado ou banca..."
              className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-sm font-medium outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 transition-all shadow-sm"
            />
          </div>

          {compareMode && (
            <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="flex items-center justify-between md:justify-end gap-3 w-full md:w-auto">
              <span className="text-xs font-bold text-zinc-600 dark:text-zinc-300 bg-white dark:bg-zinc-800 px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 uppercase tracking-wide">
                {selectedIds.length} selecionados
              </span>
              <button disabled={selectedIds.length < 2} onClick={onCompareClick} className="bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wide shadow-lg shadow-blue-600/20 transition-all flex items-center gap-2">
                <TrendingUp size={16} /> Analisar Evolução
              </button>
            </motion.div>
          )}
        </div>
      </div>
    </>
  );
};

export default HeaderSimulado;

