import React, { useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import TopicListPanel from './TopicListPanel';
import { X, Clock, Target, Trophy, BookOpen, BarChart3, TrendingUp, Activity, Calendar } from 'lucide-react';

const formatDecimalHours = (minutos) => {
    if (!minutos || minutos < 0) return '0.0';
    return (minutos / 60).toFixed(1);
};

// Componente de Card de Estatística Tático
const StatCard = ({ icon: Icon, label, value, unit, subValue, colorClass, bgClass, borderColor }) => (
  <div className={`flex-1 p-5 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 relative overflow-hidden group hover:-translate-y-1 transition-transform duration-300 shadow-sm`}>
    <div className={`absolute top-0 left-0 w-full h-1 ${borderColor}`}></div>

    <div className="flex justify-between items-start relative z-10">
        <div>
            <p className="text-xs font-bold uppercase tracking-wider text-zinc-500 mb-1">{label}</p>
            <p className="text-3xl font-black text-zinc-800 dark:text-white">
                {value} <span className="text-lg font-bold text-zinc-400">{unit}</span>
            </p>
            {subValue && <p className="text-xs font-medium text-zinc-400 mt-1">{subValue}</p>}
        </div>
        <div className={`p-3 rounded-lg ${bgClass} ${colorClass}`}>
            <Icon size={24} />
        </div>
    </div>

    <div className={`absolute -bottom-4 -right-4 opacity-10 transform rotate-12 scale-150 ${colorClass}`}>
        <Icon size={80} />
    </div>
  </div>
);

// Componente de Gráfico de Barras (Correção: Janela Fixa de 7 Dias)
const ActivityChart = ({ data }) => {
    // Calcula o máximo para escala (mínimo de 1h visual para não quebrar se tudo for 0)
    const maxVal = Math.max(...data.map(d => d.val), 0.5);

    return (
        <div className="h-40 flex items-end justify-between gap-3 mt-4 px-2 pb-2">
            {data.map((day, i) => (
                <div key={i} className="flex flex-col items-center flex-1 group h-full justify-end">
                    {/* Área da Barra */}
                    <div className="relative w-full flex items-end justify-center h-full">

                        {/* Trilho de Fundo (Opcional, para dar volume) */}
                        <div className="absolute bottom-0 w-1.5 bg-zinc-100 dark:bg-zinc-800/50 h-full rounded-full opacity-50"></div>

                        {/* A Barra */}
                        <div
                            className={`
                                w-full max-w-[18px] rounded-t-md transition-all duration-700 ease-out relative
                                ${day.val > 0 ? 'bg-indigo-500 dark:bg-indigo-500 shadow-lg shadow-indigo-500/20' : 'bg-zinc-200 dark:bg-zinc-800'}
                            `}
                            style={{ height: day.val > 0 ? `${(day.val / maxVal) * 100}%` : '4px' }} // 4px se vazio
                        >
                             {/* Tooltip Flutuante */}
                             <div className="opacity-0 group-hover:opacity-100 absolute -top-12 left-1/2 -translate-x-1/2 bg-zinc-800 text-white text-[10px] px-3 py-1.5 rounded-lg shadow-xl pointer-events-none transition-all transform translate-y-2 group-hover:translate-y-0 whitespace-nowrap z-20 flex flex-col items-center border border-zinc-700">
                                <span className="font-bold text-zinc-300 mb-0.5">{day.label}</span>
                                <span className="text-indigo-400 font-black text-xs">{day.val.toFixed(1)}h</span>
                                {/* Seta do Tooltip */}
                                <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-zinc-800 border-r border-b border-zinc-700 rotate-45"></div>
                             </div>
                        </div>
                    </div>

                    {/* Data no Eixo X */}
                    <span className={`text-[10px] mt-3 uppercase tracking-wider font-bold ${day.isToday ? 'text-indigo-500' : 'text-zinc-400'}`}>
                        {day.shortDate}
                    </span>
                </div>
            ))}
        </div>
    );
};

function DisciplinaDetalheModal({ disciplina, registrosEstudo, cicloId, user, onClose, onQuickAddTopic }) {

  const registrosDaDisciplina = useMemo(() => {
    if (!registrosEstudo || !disciplina) return [];
    // Garante ordenação por data
    return registrosEstudo.filter(r => r.disciplinaId === disciplina.id).sort((a, b) => new Date(a.data) - new Date(b.data));
  }, [registrosEstudo, disciplina]);

  const stats = useMemo(() => {
    const totalMinutes = registrosDaDisciplina.reduce((sum, r) => sum + r.tempoEstudadoMinutos, 0);
    const totalQuestions = registrosDaDisciplina.reduce((sum, r) => sum + r.questoesFeitas, 0);
    const totalCorrect = registrosDaDisciplina.reduce((sum, r) => sum + r.acertos, 0);
    const performance = totalQuestions > 0 ? (totalCorrect / totalQuestions) * 100 : 0;

    const totalHours = totalMinutes / 60;
    const speed = totalHours > 0 ? (totalQuestions / totalHours).toFixed(1) : 0;

    // --- CORREÇÃO LÓGICA DO GRÁFICO ---
    // Cria um mapa de dados: "YYYY-MM-DD" -> Minutos
    const daysMap = {};
    registrosDaDisciplina.forEach(r => {
        // Pega apenas a parte da data (YYYY-MM-DD) com segurança
        const dateKey = typeof r.data === 'string' ? r.data.split('T')[0] : new Date().toISOString().split('T')[0];
        daysMap[dateKey] = (daysMap[dateKey] || 0) + r.tempoEstudadoMinutos;
    });

    // Gera os últimos 7 dias FIXOS (incluindo hoje)
    const chartData = [];
    for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const dateStr = d.toISOString().split('T')[0]; // Chave YYYY-MM-DD

        const val = (daysMap[dateStr] || 0) / 60; // Converte para Horas

        chartData.push({
            label: d.toLocaleDateString('pt-BR', { weekday: 'short', day: 'numeric' }), // Ex: "Seg, 24"
            shortDate: d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }), // Ex: "24/11"
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
          className="relative w-full max-w-6xl max-h-[90vh] bg-zinc-50 dark:bg-zinc-950 rounded-2xl shadow-2xl border border-zinc-200 dark:border-zinc-800 flex flex-col overflow-hidden"
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
                    Relatório Tático
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
          <div className="flex-1 overflow-y-auto custom-scrollbar p-6 md:p-8">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

                {/* COLUNA ESQUERDA: ESTATÍSTICAS + GRÁFICO */}
                <div className="lg:col-span-1 space-y-6">

                    {/* Cards Principais */}
                    <div className="grid grid-cols-1 gap-4">
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
                            unit="q"
                            subValue={`Ritmo: ~${stats.speed} q/h`}
                            colorClass="text-emerald-500"
                            bgClass="bg-emerald-500/10"
                            borderColor="bg-emerald-500"
                        />
                        <StatCard
                            icon={Trophy}
                            label="Precisão"
                            value={stats.performance}
                            unit="%"
                            colorClass="text-red-500"
                            bgClass="bg-red-500/10"
                            borderColor="bg-red-500"
                        />
                    </div>

                    {/* Gráfico de Evolução (Agora Corrigido) */}
                    <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-5 shadow-sm">
                        <div className="flex items-center justify-between mb-2">
                            <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-widest flex items-center gap-2">
                                <TrendingUp size={14} /> Evolução (Últimos 7 dias)
                            </h3>
                        </div>
                        <ActivityChart data={stats.chartData} />
                    </div>
                </div>

                {/* COLUNA DIREITA: TÓPICOS */}
                <div className="lg:col-span-2 space-y-6">
                    <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-sm border border-zinc-200 dark:border-zinc-800 overflow-hidden flex flex-col h-full min-h-[500px]">
                        <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 flex justify-between items-center bg-zinc-50/50 dark:bg-zinc-900/50">
                             <h2 className="text-sm font-bold text-zinc-500 uppercase tracking-widest flex items-center gap-2">
                                <Activity size={16} className="text-indigo-500" /> Detalhamento por Tópico
                            </h2>
                        </div>

                        <div className="flex-1 p-4">
                             <TopicListPanel
                                user={user}
                                cicloId={cicloId}
                                disciplinaId={disciplina.id}
                                registrosEstudo={registrosDaDisciplina}
                                disciplinaNome=""
                                onQuickAddTopic={onQuickAddTopic}
                            />
                        </div>
                    </div>
                </div>
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