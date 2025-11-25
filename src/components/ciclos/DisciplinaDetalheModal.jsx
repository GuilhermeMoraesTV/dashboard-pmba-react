import React, { useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Clock, Target, Trophy, BookOpen, TrendingUp } from 'lucide-react';

const formatDecimalHours = (minutos) => {
    if (!minutos || minutos < 0) return '0.0';
    return (minutos / 60).toFixed(1);
};

// Componente de Card de Estatística Tático
const StatCard = ({ icon: Icon, label, value, unit, subValue, colorClass, bgClass, borderColor }) => (
  <div className={`flex-1 p-6 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 relative overflow-hidden group hover:-translate-y-1 transition-transform duration-300 shadow-sm`}>
    <div className={`absolute top-0 left-0 w-full h-1 ${borderColor}`}></div>

    <div className="flex justify-between items-start relative z-10">
        <div>
            <p className="text-xs font-bold uppercase tracking-wider text-zinc-500 mb-2">{label}</p>
            <p className="text-4xl font-black text-zinc-800 dark:text-white tracking-tight">
                {value} <span className="text-xl font-bold text-zinc-400">{unit}</span>
            </p>
            {subValue && <p className="text-sm font-medium text-zinc-400 mt-2">{subValue}</p>}
        </div>
        <div className={`p-4 rounded-xl ${bgClass} ${colorClass}`}>
            <Icon size={28} />
        </div>
    </div>

    <div className={`absolute -bottom-6 -right-6 opacity-10 transform rotate-12 scale-150 ${colorClass}`}>
        <Icon size={100} />
    </div>
  </div>
);

// Componente de Gráfico de Barras
const ActivityChart = ({ data }) => {
    // Calcula o máximo para escala (mínimo de 1h visual para não quebrar se tudo for 0)
    const maxVal = Math.max(...data.map(d => d.val), 0.5);

    return (
        <div className="h-64 flex items-end justify-between gap-4 mt-6 px-4 pb-2 w-full">
            {data.map((day, i) => (
                <div key={i} className="flex flex-col items-center flex-1 group h-full justify-end">
                    {/* Área da Barra */}
                    <div className="relative w-full flex items-end justify-center h-full">

                        {/* Trilho de Fundo */}
                        <div className="absolute bottom-0 w-2 bg-zinc-100 dark:bg-zinc-800/50 h-full rounded-full opacity-50"></div>

                        {/* A Barra */}
                        <div
                            className={`
                                w-full max-w-[32px] rounded-t-lg transition-all duration-700 ease-out relative
                                ${day.val > 0 ? 'bg-indigo-500 dark:bg-indigo-500 shadow-lg shadow-indigo-500/20' : 'bg-zinc-200 dark:bg-zinc-800'}
                            `}
                            style={{ height: day.val > 0 ? `${(day.val / maxVal) * 100}%` : '4px' }}
                        >
                             {/* Tooltip Flutuante */}
                             <div className="opacity-0 group-hover:opacity-100 absolute -top-12 left-1/2 -translate-x-1/2 bg-zinc-800 text-white text-xs px-3 py-2 rounded-lg shadow-xl pointer-events-none transition-all transform translate-y-2 group-hover:translate-y-0 whitespace-nowrap z-20 flex flex-col items-center border border-zinc-700">
                                <span className="font-bold text-zinc-300 mb-0.5">{day.label}</span>
                                <span className="text-indigo-400 font-black">{day.val.toFixed(1)}h</span>
                                {/* Seta do Tooltip */}
                                <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-zinc-800 border-r border-b border-zinc-700 rotate-45"></div>
                             </div>
                        </div>
                    </div>

                    {/* Data no Eixo X */}
                    <span className={`text-xs mt-3 uppercase tracking-wider font-bold ${day.isToday ? 'text-indigo-500' : 'text-zinc-400'}`}>
                        {day.shortDate}
                    </span>
                </div>
            ))}
        </div>
    );
};

function DisciplinaDetalheModal({ disciplina, registrosEstudo, onClose }) {

  const registrosDaDisciplina = useMemo(() => {
    if (!registrosEstudo || !disciplina) return [];
    return registrosEstudo.filter(r => r.disciplinaId === disciplina.id).sort((a, b) => new Date(a.data) - new Date(b.data));
  }, [registrosEstudo, disciplina]);

  const stats = useMemo(() => {
    const totalMinutes = registrosDaDisciplina.reduce((sum, r) => sum + r.tempoEstudadoMinutos, 0);
    const totalQuestions = registrosDaDisciplina.reduce((sum, r) => sum + r.questoesFeitas, 0);
    const totalCorrect = registrosDaDisciplina.reduce((sum, r) => sum + r.acertos, 0);
    const performance = totalQuestions > 0 ? (totalCorrect / totalQuestions) * 100 : 0;

    const totalHours = totalMinutes / 60;
    const speed = totalHours > 0 ? (totalQuestions / totalHours).toFixed(1) : 0;

    // --- LÓGICA DO GRÁFICO (Últimos 7 dias) ---
    const daysMap = {};
    registrosDaDisciplina.forEach(r => {
        const dateKey = typeof r.data === 'string' ? r.data.split('T')[0] : new Date().toISOString().split('T')[0];
        daysMap[dateKey] = (daysMap[dateKey] || 0) + r.tempoEstudadoMinutos;
    });

    const chartData = [];
    for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const dateStr = d.toISOString().split('T')[0];

        const val = (daysMap[dateStr] || 0) / 60; // Converte para Horas

        chartData.push({
            label: d.toLocaleDateString('pt-BR', { weekday: 'short', day: 'numeric' }),
            shortDate: d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
            val: val,
            isToday: i === 0
        });
    }

    return {
      totalHours: formatDecimalHours(totalMinutes),
      totalQuestions: totalQuestions,
      performance: performance.toFixed(0),
      speed,
      chartData
    };
  }, [registrosDaDisciplina]);

  if (!disciplina) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/80 z-[70] backdrop-blur-sm flex items-center justify-center p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.95, opacity: 0, y: 20 }}
          transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
          className="relative w-full max-w-4xl max-h-[90vh] bg-zinc-50 dark:bg-zinc-950 rounded-2xl shadow-2xl border border-zinc-200 dark:border-zinc-800 flex flex-col overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >

          {/* --- HEADER --- */}
          <div className="flex-shrink-0 p-6 flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 relative overflow-hidden">
            <div className="absolute -top-6 -right-6 text-zinc-100 dark:text-zinc-800 pointer-events-none">
                <BookOpen size={180} strokeWidth={1} />
            </div>

            <div className="relative z-10 flex items-center gap-4">
                <div className="w-14 h-14 bg-zinc-100 dark:bg-zinc-800 rounded-2xl flex items-center justify-center border border-zinc-200 dark:border-zinc-700 shadow-sm">
                    <BookOpen size={28} className="text-red-600 dark:text-red-500" />
                </div>
                <div>
                  <p className="text-xs font-bold text-red-600 dark:text-red-500 uppercase tracking-widest mb-0.5">
                    Detalhes da Disciplina
                  </p>
                  <h1 className="text-2xl md:text-3xl font-black text-zinc-900 dark:text-white uppercase tracking-tight">
                    {disciplina.nome}
                  </h1>
                </div>
            </div>

            <button onClick={onClose} className="relative z-10 p-2 rounded-full text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-red-500 transition-all">
              <X size={24} />
            </button>
          </div>

          {/* --- CONTEÚDO --- */}
          <div className="flex-1 overflow-y-auto custom-scrollbar p-6 md:p-8 space-y-8">

            {/* LINHA 1: STATS CARDS */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <StatCard
                    icon={Clock}
                    label="Tempo Total"
                    value={stats.totalHours}
                    unit="h"
                    colorClass="text-amber-500"
                    bgClass="bg-amber-500/10"
                    borderColor="bg-amber-500"
                />
                <StatCard
                    icon={Target}
                    label="Questões Totais"
                    value={stats.totalQuestions}

                    colorClass="text-emerald-500"
                    bgClass="bg-emerald-500/10"
                    borderColor="bg-emerald-500"
                />
                <StatCard
                    icon={Trophy}
                    label="Precisão Geral"
                    value={stats.performance}
                    unit="%"
                    subValue={stats.totalQuestions > 0 ? "Taxa de acerto" : "Sem dados"}
                    colorClass="text-red-500"
                    bgClass="bg-red-500/10"
                    borderColor="bg-red-500"
                />
            </div>

            {/* LINHA 2: GRÁFICO GRANDE */}
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 shadow-sm">
                <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-bold text-zinc-500 uppercase tracking-widest flex items-center gap-2">
                        <TrendingUp size={18} className="text-indigo-500" /> Performance da Semana
                    </h3>
                </div>
                <ActivityChart data={stats.chartData} />
            </div>

          </div>

          {/* Footer Decorativo */}
          <div className="h-2 w-full bg-gradient-to-r from-red-600 via-zinc-800 to-red-600"></div>

        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

export default DisciplinaDetalheModal;