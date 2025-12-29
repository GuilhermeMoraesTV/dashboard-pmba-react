import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  X,
  Clock,
  CheckCircle2,
  BookOpen,
  Target,
  Calendar,
  Trophy,
  Medal,
  AlertCircle,
  List,
  BarChart2,
  TrendingUp,
  Percent
} from 'lucide-react';

// --- Helpers ---
const formatTime = (minutes) => {
  if (!minutes || minutes === 0) return '0m';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
};

// Cores Vibrantes para o Gráfico
const CHART_COLORS = [
  '#3b82f6', // blue
  '#10b981', // emerald
  '#f59e0b', // amber
  '#ef4444', // red
  '#8b5cf6', // violet
  '#ec4899', // pink
  '#06b6d4', // cyan
];

// --- Componente Donut Chart ---
const DonutChart = ({ data, totalMinutes }) => {
  const radius = 60;
  const circumference = 2 * Math.PI * radius;
  let accumulatedPercent = 0;

  const sortedData = [...data].sort((a, b) => b.minutes - a.minutes);

  const segments = sortedData.map((item, index) => {
    const percent = item.minutes / totalMinutes;
    const strokeDasharray = `${percent * circumference} ${circumference}`;
    const strokeDashoffset = -accumulatedPercent * circumference;
    accumulatedPercent += percent;

    return {
      ...item,
      color: CHART_COLORS[index % CHART_COLORS.length],
      strokeDasharray,
      strokeDashoffset,
      percentDisplay: Math.round(percent * 100)
    };
  });

  return (
    <div className="flex flex-col items-center justify-center w-full h-full">
      <div className="relative w-48 h-48">
        <svg viewBox="0 0 160 160" className="w-full h-full -rotate-90 transform drop-shadow-md">
          <circle cx="80" cy="80" r={radius} fill="transparent" strokeWidth="16" className="stroke-zinc-100 dark:stroke-zinc-800/50" />
          {segments.map((seg, i) => (
            <motion.circle
              key={i}
              initial={{ strokeDasharray: `0 ${circumference}` }}
              animate={{ strokeDasharray: seg.strokeDasharray }}
              transition={{ duration: 1.2, delay: 0.1 * i, ease: [0.22, 1, 0.36, 1] }}
              cx="80" cy="80" r={radius}
              fill="transparent"
              stroke={seg.color}
              strokeWidth="16"
              strokeDashoffset={seg.strokeDashoffset}
              strokeLinecap="round"
              className="hover:opacity-80 transition-opacity cursor-pointer"
            />
          ))}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center text-zinc-800 dark:text-zinc-100 pointer-events-none">
           <span className="text-3xl font-black tracking-tighter leading-none">
             {formatTime(totalMinutes).split(' ')[0]}
           </span>
           <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 mt-1">Total</span>
        </div>
      </div>

      <div className="flex flex-wrap justify-center gap-2 mt-4 w-full">
        {segments.slice(0, 4).map((seg, i) => (
          <div key={i} className="flex items-center gap-1.5 text-[10px] font-bold text-zinc-600 dark:text-zinc-400 bg-zinc-50 dark:bg-zinc-800 px-2 py-1 rounded-md border border-zinc-200 dark:border-zinc-700/50">
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: seg.color }}></span>
            <span className="truncate max-w-[80px]">{seg.name}</span>
            <span className="text-zinc-900 dark:text-white ml-0.5">{seg.percentDisplay}%</span>
          </div>
        ))}
      </div>
    </div>
  );
};

// --- Card de KPI Compacto (Atualizado para aceitar className) ---
const StatBox = ({ label, value, subValue, icon: Icon, colorClass, bgClass, className = "" }) => (
    <div className={`flex flex-col justify-center rounded-xl p-3 border transition-all hover:shadow-md ${bgClass || 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800'} ${className}`}>
        <div className={`flex items-center gap-1.5 text-[9px] font-black uppercase tracking-wider mb-1 opacity-70 ${colorClass}`}>
            <Icon size={12} strokeWidth={3} /> {label}
        </div>
        <div>
            <div className="text-lg sm:text-xl font-black text-zinc-900 dark:text-white leading-none tracking-tight">
                {value}
            </div>
            {subValue && <div className="text-[10px] font-semibold text-zinc-500 dark:text-zinc-400 mt-0.5">{subValue}</div>}
        </div>
    </div>
);

// --- Componente Auxiliar de Métricas (Reutilizável) ---
const MetricsDisplay = ({ time, questions, correct, variant = 'row' }) => {
    const accuracy = questions > 0 ? (correct / questions) * 100 : 0;

    // Cores baseadas na precisão
    let accColor = 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400';
    if (questions > 0) {
        if (accuracy >= 80) accColor = 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400';
        else if (accuracy >= 50) accColor = 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400';
        else accColor = 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400';
    }

    const containerClass = variant === 'header'
        ? "flex flex-wrap items-center justify-end gap-3 sm:gap-6"
        : "flex items-center justify-end gap-3 sm:gap-5 w-full sm:w-auto mt-2 sm:mt-0";

    const labelClass = "text-[9px] font-bold text-zinc-400 uppercase tracking-wide block mb-0.5 text-right";
    const valueClass = `text-xs font-mono font-bold ${variant === 'header' ? 'text-zinc-700 dark:text-zinc-200' : 'text-zinc-600 dark:text-zinc-400'} text-right`;

    return (
        <div className={containerClass}>
            {/* Tempo */}
            <div className="flex flex-col min-w-[50px]">
                <span className={labelClass}>Tempo</span>
                <div className="flex items-center justify-end gap-1">
                    <Clock size={10} className="text-blue-500" />
                    <span className={valueClass}>{time > 0 ? formatTime(time) : '-'}</span>
                </div>
            </div>

            {/* Questões */}
            <div className="flex flex-col min-w-[40px]">
                <span className={labelClass}>Qts</span>
                <div className="flex items-center justify-end gap-1">
                    <List size={10} className="text-violet-500" />
                    <span className={valueClass}>{questions}</span>
                </div>
            </div>

            {/* Acertos */}
            <div className="flex flex-col min-w-[40px]">
                <span className={labelClass}>Acertos</span>
                <div className="flex items-center justify-end gap-1">
                    <CheckCircle2 size={10} className="text-emerald-500" />
                    <span className={valueClass}>{correct}</span>
                </div>
            </div>

            {/* Precisão (Badge) */}
            <div className="flex flex-col min-w-[50px] items-end">
                <span className={labelClass}>Prec.</span>
                <div className={`px-2 py-0.5 rounded text-[10px] font-black border border-transparent ${accColor}`}>
                    {questions > 0 ? `${Math.round(accuracy)}%` : '-'}
                </div>
            </div>
        </div>
    );
};

function DayDetailsModal({ date, dayData, goals = { questions: 0, hours: 0 }, onClose }) {

  const { formattedDate, stats, disciplinaBreakdown, topicosAgrupados } = useMemo(() => {
    const [year, month, day] = date.split('-').map(Number);
    const dateObj = new Date(year, month - 1, day);
    const weekday = dateObj.toLocaleDateString('pt-BR', { weekday: 'long' });
    const dayMonth = dateObj.toLocaleDateString('pt-BR', { day: 'numeric', month: 'long' });
    const formatted = { weekday, dayMonth };

    const allRecords = [
      ...dayData.dayHours.map(r => ({ ...r, category: 'time' })),
      ...dayData.dayQuestions.map(r => ({ ...r, category: 'question' }))
    ];

    const uniqueMap = new Map();
    allRecords.forEach(r => uniqueMap.set(r.id, r));
    const sorted = Array.from(uniqueMap.values()).sort((a, b) => b.timestamp - a.timestamp);

    let totalMinutos = 0, totalQst = 0, totalAcertos = 0;
    const breakdown = {};
    const topicsMap = {};

    sorted.forEach(r => {
      const min = Number(r.tempoEstudadoMinutos || 0);
      const qst = Number(r.questoesFeitas || 0);
      const acrt = Number(r.acertos || 0);

      totalMinutos += min; totalQst += qst; totalAcertos += acrt;

      const discName = r.disciplinaNome || 'Geral';
      if (!breakdown[discName]) breakdown[discName] = { name: discName, minutes: 0, questions: 0 };
      breakdown[discName].minutes += min; breakdown[discName].questions += qst;

      const topicName = r.assunto || 'Estudo Geral';

      // Inicializa Disciplina no Mapa
      if (!topicsMap[discName]) {
          topicsMap[discName] = {
              name: discName,
              totalMinutes: 0,
              totalQuestions: 0,
              totalCorrect: 0,
              topics: {}
          };
      }

      // Acumula na Disciplina
      topicsMap[discName].totalMinutes += min;
      topicsMap[discName].totalQuestions += qst;
      topicsMap[discName].totalCorrect += acrt;

      // Inicializa Tópico
      if (!topicsMap[discName].topics[topicName]) {
          topicsMap[discName].topics[topicName] = { name: topicName, minutes: 0, questions: 0, correct: 0 };
      }

      // Acumula no Tópico
      topicsMap[discName].topics[topicName].minutes += min;
      topicsMap[discName].topics[topicName].questions += qst;
      topicsMap[discName].topics[topicName].correct += acrt;
    });

    const breakdownArray = Object.values(breakdown).sort((a, b) => b.minutes - a.minutes).map(item => ({
        ...item, percentTime: totalMinutos > 0 ? (item.minutes / totalMinutos) * 100 : 0
    }));

    const topicosAgrupadosArray = Object.values(topicsMap).sort((a, b) => b.totalMinutes - a.totalMinutes).map(disc => ({
        ...disc, topics: Object.values(disc.topics).sort((a, b) => b.minutes - a.minutes)
    }));

    const accuracy = totalQst > 0 ? (totalAcertos / totalQst) * 100 : 0;

    return { formattedDate: formatted, stats: { totalMinutos, totalQst, totalAcertos, accuracy }, disciplinaBreakdown: breakdownArray, topicosAgrupados: topicosAgrupadosArray };
  }, [date, dayData]);

  const metaStatus = useMemo(() => {
    const hoursGoalMinutes = (goals.hours || 0) * 60;
    const questionsGoal = goals.questions || 0;
    const hasGoals = hoursGoalMinutes > 0 || questionsGoal > 0;

    const hoursMet = hoursGoalMinutes === 0 || stats.totalMinutos >= hoursGoalMinutes;
    const questionsMet = questionsGoal === 0 || stats.totalQst >= questionsGoal;

    let verdict = 'neutral', label = 'Indefinido', color = 'zinc';
    if (hasGoals) {
      if (hoursMet && questionsMet) { verdict = 'success'; label = 'Meta Batida!'; color = 'emerald'; }
      else if (hoursMet || questionsMet) { verdict = 'partial'; label = 'Meta Parcial'; color = 'amber'; }
      else { verdict = 'fail'; label = 'Meta Pendente'; color = 'red'; }
    }
    return { hasGoals, verdict, label, color };
  }, [goals, stats]);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-2 sm:p-4 overflow-hidden">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} className="absolute inset-0 bg-zinc-950/70 backdrop-blur-sm" />

      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="relative w-full max-w-4xl bg-zinc-50 dark:bg-zinc-950 rounded-[2rem] shadow-2xl overflow-hidden flex flex-col max-h-[90vh] border border-white/50 dark:border-zinc-800"
      >
        {/* --- HEADER (Vermelho + Marca D'água) --- */}
        <div className="bg-red-50 dark:bg-red-900/10 border-b border-red-100 dark:border-red-900/30 p-5 sm:px-8 shrink-0 relative overflow-hidden">
          {/* Marca D'água Gigante */}
          <div className="absolute top-[-30px] right-[-30px] opacity-[0.06] dark:opacity-[0.08] rotate-12 pointer-events-none">
            <Calendar size={200} className="text-red-600" />
          </div>

          <div className="relative z-10 flex justify-between items-start">
            <div className="flex flex-col gap-1">
                <div className="flex items-center gap-3">
                    <p className="text-red-600 dark:text-red-400 text-[10px] font-bold uppercase tracking-widest flex items-center gap-1.5">
                        <Calendar size={12} strokeWidth={2.5} /> Relatório Diário
                    </p>
                    {metaStatus.hasGoals && (
                        <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wide border ${
                            metaStatus.color === 'emerald' ? 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/40 dark:text-emerald-300 dark:border-emerald-800' :
                            metaStatus.color === 'amber' ? 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/40 dark:text-amber-300 dark:border-amber-800' :
                            'bg-red-100 text-red-700 border-red-200 dark:bg-red-900/40 dark:text-red-300 dark:border-red-800'
                        }`}>
                            {metaStatus.label}
                        </span>
                    )}
                </div>

                <div className="flex flex-wrap items-baseline gap-x-2 mt-1">
                    <h2 className="text-3xl sm:text-4xl font-black text-zinc-900 dark:text-white capitalize tracking-tighter leading-none">
                        {formattedDate.weekday},
                    </h2>
                    <span className="text-xl sm:text-2xl font-bold text-zinc-400 dark:text-zinc-500 tracking-tight">
                        {formattedDate.dayMonth}
                    </span>
                </div>
            </div>

            <button onClick={onClose} className="p-2.5 bg-white dark:bg-zinc-800 hover:bg-red-100 dark:hover:bg-red-900/40 text-zinc-500 hover:text-red-600 rounded-xl transition-all shadow-sm border border-zinc-200 dark:border-zinc-700/50">
              <X size={20} />
            </button>
          </div>
        </div>

        {/* --- BODY --- */}
        <div className="overflow-y-auto flex-1 p-4 sm:p-6 custom-scrollbar bg-zinc-50/50 dark:bg-black/20">

            {/* SEÇÃO 1: HERO */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">

                {/* Gráfico */}
                <div className="lg:col-span-5 bg-white dark:bg-zinc-900 rounded-2xl p-4 border border-zinc-200/50 dark:border-zinc-800 shadow-sm flex flex-col items-center justify-center relative min-h-[220px]">
                    {stats.totalMinutos > 0 ? (
                        <DonutChart data={disciplinaBreakdown} totalMinutes={stats.totalMinutos} />
                    ) : (
                        <div className="flex flex-col items-center justify-center py-8 opacity-50">
                            <Clock size={40} className="mb-2 text-zinc-300 dark:text-zinc-600" />
                            <span className="text-xs font-bold uppercase tracking-widest text-zinc-400">Sem dados</span>
                        </div>
                    )}
                </div>

                {/* KPIs */}
                <div className="lg:col-span-7 flex flex-col justify-center h-full">
                    <div className="grid grid-cols-2 gap-3">
                        <StatBox
                            label="Tempo Total"
                            value={formatTime(stats.totalMinutos)}
                            icon={Clock}
                            colorClass="text-blue-500"
                            bgClass="bg-blue-50/50 dark:bg-blue-900/10 border-blue-100 dark:border-blue-900/30"
                        />
                        <StatBox
                            label="Questões"
                            value={stats.totalQst}
                            subValue={`${stats.totalAcertos} Acertos`}
                            icon={CheckCircle2}
                            colorClass="text-violet-500"
                            bgClass="bg-violet-50/50 dark:bg-violet-900/10 border-violet-100 dark:border-violet-900/30"
                        />
                        {/* Precisão ocupando 2 colunas para fechar o grid */}
                        <StatBox
                            label="Precisão"
                            value={`${stats.accuracy.toFixed(0)}%`}
                            icon={Target}
                            colorClass={stats.accuracy >= 80 ? "text-emerald-500" : stats.accuracy >= 50 ? "text-amber-500" : "text-red-500"}
                            bgClass={stats.accuracy >= 80 ? "bg-emerald-50/50 dark:bg-emerald-900/10 border-emerald-100 dark:border-emerald-900/30" : "bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800"}
                            className="col-span-2"
                        />
                    </div>
                </div>
            </div>

            {/* SEÇÃO 2: DETALHAMENTO DE ESTUDO (Completo e Explicativo) */}
            {topicosAgrupados.length > 0 && (
                <section className="mt-6">
                    <div className="flex items-center gap-2 mb-3 px-1">
                        <div className="p-1.5 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 rounded-lg shadow-sm">
                            <List size={14} strokeWidth={3} />
                        </div>
                        <h3 className="text-sm font-black text-zinc-900 dark:text-white uppercase tracking-tight">O que foi estudado</h3>
                    </div>

                    <div className="grid gap-4">
                        {topicosAgrupados.map((disc, idx) => (
                            <motion.div
                                key={idx}
                                initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.05 }}
                                className="bg-white dark:bg-zinc-900 border border-zinc-200/60 dark:border-zinc-800 rounded-2xl overflow-hidden shadow-sm"
                            >
                                {/* Header da Disciplina (RESUMO COMPLETO) */}
                                <div className="px-4 py-3 bg-zinc-50/80 dark:bg-zinc-950/30 border-b border-zinc-100 dark:border-zinc-800 flex flex-col sm:flex-row justify-between sm:items-center gap-3">
                                    <div className="flex items-center gap-3">
                                        <div className="w-1 h-6 bg-indigo-500 rounded-full"></div>
                                        <h4 className="font-bold text-zinc-800 dark:text-white text-sm">{disc.name}</h4>
                                    </div>

                                    {/* Métricas da Disciplina (Resumo) */}
                                    <MetricsDisplay
                                        time={disc.totalMinutes}
                                        questions={disc.totalQuestions}
                                        correct={disc.totalCorrect}
                                        variant="header"
                                    />
                                </div>

                                {/* Lista de Assuntos (DETALHAMENTO) */}
                                <div className="divide-y divide-zinc-100 dark:divide-zinc-800/50">
                                    {disc.topics.map((topic, tIdx) => (
                                        <div key={tIdx} className="px-4 py-3 flex flex-col sm:flex-row justify-between gap-3 hover:bg-zinc-50 dark:hover:bg-zinc-800/30 transition-colors group">
                                            {/* Nome do Tópico */}
                                            <div className="flex items-start gap-2.5 min-w-0 flex-1">
                                                <div className="mt-1.5 w-1.5 h-1.5 rounded-full bg-zinc-300 dark:bg-zinc-600 shrink-0"></div>
                                                <span className="text-xs sm:text-sm font-medium text-zinc-600 dark:text-zinc-300 leading-snug break-words">
                                                    {topic.name}
                                                </span>
                                            </div>

                                            {/* Métricas do Tópico */}
                                            <MetricsDisplay
                                                time={topic.minutes}
                                                questions={topic.questions}
                                                correct={topic.correct}
                                            />
                                        </div>
                                    ))}
                                </div>
                            </motion.div>
                        ))}
                    </div>
                </section>
            )}

        </div>
      </motion.div>
    </div>
  );
}

export default DayDetailsModal;