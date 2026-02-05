import React from 'react';
import {
  ClipboardList, ArrowLeftRight, Play, Plus, Search,
  Target, BarChart2, Trophy, TrendingUp, TrendingDown
} from 'lucide-react';
import { motion } from 'framer-motion';

const HeaderSimulado = ({
  kpis,
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
      {/* CABEÇALHO SUPERIOR */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-zinc-200 dark:border-zinc-800 pb-5 md:pb-6">
        <div className="min-w-0">
          <h1 className="text-2xl md:text-3xl font-black text-zinc-800 dark:text-white tracking-tight flex items-center gap-3">
            <ClipboardList className="text-red-600" size={30} />
            Simulados
          </h1>
          <p className="text-zinc-500 dark:text-zinc-400 mt-2 text-sm max-w-xl">
            Registre seus simulados, acompanhe histórico e compare evolução.
          </p>
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto flex-wrap">
          <button
            onClick={compareMode ? onCancelCompare : () => setCompareMode(true)}
            className={`flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-bold transition-all border ${
              compareMode
                ? 'bg-blue-600 border-blue-600 text-white shadow-lg shadow-blue-500/30'
                : 'bg-zinc-100 dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700'
            }`}
          >
            <ArrowLeftRight size={18} /> {compareMode ? 'Cancelar' : 'Comparar'}
          </button>

          {!compareMode && (
            <>
              <button
                onClick={onStartClick}
                className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2.5 rounded-xl font-bold shadow-lg shadow-emerald-600/30 transition-transform active:scale-95 whitespace-nowrap"
              >
                <Play size={20} fill="currentColor" /> Iniciar Agora
              </button>

              <button
                onClick={onNewClick}
                className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700 text-white px-5 py-2.5 rounded-xl font-bold shadow-lg shadow-red-600/30 transition-transform active:scale-95 whitespace-nowrap"
              >
                <Plus size={20} /> Novo Registro
              </button>
            </>
          )}
        </div>
      </div>

      {/* KPI CARDS */}
      {kpis && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 mt-6">
          <div className="bg-white dark:bg-zinc-900 p-4 md:p-5 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm relative overflow-hidden group hover:border-red-500/30 transition-colors">
            <div className="absolute right-0 top-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity"><Target size={80} /></div>
            <span className="text-[10px] md:text-xs font-bold text-zinc-400 uppercase tracking-wider">Total</span>
            <div className="text-2xl md:text-3xl font-black text-zinc-800 dark:text-white mt-1">{kpis.totalSimulados}</div>
            <div className="text-[10px] md:text-xs text-zinc-400 mt-1">Registros</div>
          </div>

          <div className="bg-white dark:bg-zinc-900 p-4 md:p-5 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm relative overflow-hidden group hover:border-blue-500/30 transition-colors">
            <div className="absolute right-0 top-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity"><BarChart2 size={80} /></div>
            <span className="text-[10px] md:text-xs font-bold text-zinc-400 uppercase tracking-wider">Média</span>
            <div className="text-2xl md:text-3xl font-black text-blue-600 mt-1">{kpis.mediaPontos.toFixed(1)}</div>
            <div className="text-[10px] md:text-xs text-zinc-400 mt-1">Pontos</div>
          </div>

          <div className="bg-white dark:bg-zinc-900 p-4 md:p-5 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm relative overflow-hidden group hover:border-emerald-500/30 transition-colors">
            <div className="absolute right-0 top-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity"><Trophy size={80} /></div>
            <span className="text-[10px] md:text-xs font-bold text-zinc-400 uppercase tracking-wider">Recorde</span>
            <div className="text-2xl md:text-3xl font-black text-emerald-600 mt-1">{kpis.melhorNotaPontos.toFixed(1)}</div>
            <div className="text-[10px] md:text-xs text-zinc-400 mt-1">Maior nota</div>
          </div>

          <div className="bg-zinc-900 dark:bg-black p-4 md:p-5 rounded-2xl border border-zinc-800 shadow-lg relative overflow-hidden group">
            <div className="absolute inset-0 bg-gradient-to-br from-red-600/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            <span className="text-[10px] md:text-xs font-bold text-zinc-500 uppercase tracking-wider block mb-2 flex justify-between">
              Último
              {kpis.trend !== 0 && (
                <span className={kpis.trend > 0 ? 'text-emerald-500' : 'text-red-500'}>
                  {kpis.trend > 0 ? '+' : ''}{kpis.trend.toFixed(1)}
                </span>
              )}
            </span>
            <div className="relative z-10">
              <h3 className="text-white font-bold truncate mb-1 text-base md:text-lg">{kpis.ultimo.titulo}</h3>
              <div className="flex items-end gap-2">
                <span className="text-2xl md:text-3xl font-black text-red-500">{(kpis.ultimo.resumo.pontosObtidos || 0).toFixed(1)}</span>
                <span className="text-[10px] md:text-xs text-zinc-400 mb-1.5 font-bold uppercase">Pontos</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* BARRA DE BUSCA E AÇÕES DE COMPARAÇÃO */}
      <div className="mt-6 md:mt-8 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-t-3xl overflow-hidden shadow-sm border-b-0">
        <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 flex flex-col md:flex-row md:justify-between md:items-center gap-3 bg-zinc-50/50 dark:bg-zinc-900/50 backdrop-blur-sm sticky top-0 z-10">
          <div className="relative w-full md:w-80">
            <Search className="absolute left-3 top-3 text-zinc-400" size={16} />
            <input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar por título ou banca..."
              className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 transition-all shadow-sm"
            />
          </div>

          {compareMode && (
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="flex items-center justify-between md:justify-end gap-3 w-full md:w-auto"
            >
              <span className="text-sm font-bold text-zinc-600 dark:text-zinc-300 bg-white dark:bg-zinc-800 px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700">
                {selectedIds.length} selecionados
              </span>

              <button
                disabled={selectedIds.length < 2}
                onClick={onCompareClick}
                className="bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-bold shadow-lg shadow-blue-600/20 transition-all flex items-center gap-2"
              >
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