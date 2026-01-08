import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  X,
  Clock,
  CheckCircle2,
  List,
  Target,
  Calendar,
  ArrowDown,
} from 'lucide-react';

// --- Helpers ---
const formatTime = (minutes) => {
  if (!minutes || minutes === 0) return '0m';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h > 0) return `${h}h ${m > 0 ? `${m}m` : ''}`;
  return `${m}m`;
};

const CHART_COLORS = [
  '#3b82f6', // blue
  '#10b981', // emerald
  '#f59e0b', // amber
  '#ef4444', // red
  '#8b5cf6', // violet
  '#ec4899', // pink
  '#06b6d4', // cyan
];

// --- Componente de Gráfico (Donut + Barras de Progresso) ---
const AdvancedChart = ({ data, totalMinutes }) => {
  const radius = 70;
  const center = 90;
  const viewBoxSize = 180;
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
      percentValue: percent * 100
    };
  });

  return (
    <div className="flex flex-col sm:flex-row items-center w-full h-full gap-6 p-2">
      {/* Gráfico Donut */}
      <div className="relative w-48 h-48 shrink-0">
        <svg viewBox={`0 0 ${viewBoxSize} ${viewBoxSize}`} className="w-full h-full -rotate-90">
          <circle cx={center} cy={center} r={radius} fill="transparent" strokeWidth="20" className="stroke-zinc-100 dark:stroke-zinc-800" />
          {segments.map((seg, i) => (
            <motion.circle
              key={i}
              initial={{ strokeDasharray: `0 ${circumference}` }}
              animate={{ strokeDasharray: seg.strokeDasharray }}
              transition={{ duration: 1.2, delay: 0.1 * i, ease: [0.22, 1, 0.36, 1] }}
              cx={center} cy={center} r={radius}
              fill="transparent"
              stroke={seg.color}
              strokeWidth="20"
              strokeDashoffset={seg.strokeDashoffset}
              strokeLinecap="butt"
              className="hover:opacity-80 transition-opacity cursor-pointer"
            />
          ))}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center text-zinc-800 dark:text-zinc-100 pointer-events-none">
           <span className="text-2xl font-black tracking-tighter leading-none">
             {formatTime(totalMinutes)}
           </span>
           <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 mt-1">Total</span>
        </div>
      </div>

      {/* Legenda com Barras */}
      <div className="flex flex-col justify-center flex-1 w-full gap-3 min-w-0">
        {segments.slice(0, 5).map((seg, i) => (
          <div key={i} className="flex flex-col gap-1 w-full">
            <div className="flex justify-between items-end">
                <span className="text-xs font-bold text-zinc-700 dark:text-zinc-300 leading-tight">
                    {seg.name}
                </span>
                <span className="text-xs font-black text-zinc-900 dark:text-white shrink-0 ml-2">
                    {formatTime(seg.minutes)}
                </span>
            </div>
            <div className="w-full h-1.5 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${seg.percentValue}%` }}
                    transition={{ duration: 1, delay: 0.2 }}
                    className="h-full rounded-full"
                    style={{ backgroundColor: seg.color }}
                />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// --- NOVO COMPONENTE: Card Duplo de Questões (Sem Badge de Precisão) ---
const QuestionsDualCard = ({ total, correct }) => {
    return (
        <div className="flex flex-col bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-sm overflow-hidden relative">

            {/* Conector Visual Sutil */}
            <div className="absolute left-6 top-1/2 -translate-y-1/2 z-10 text-zinc-200 dark:text-zinc-700">
                <ArrowDown size={12} strokeWidth={3} className="opacity-50" />
            </div>

            {/* Parte Superior: Total (Violeta) */}
            <div className="flex justify-between items-center p-2.5 pb-1.5 bg-violet-50/30 dark:bg-violet-900/5 relative">
                <div className="flex flex-col">
                    <span className="text-[9px] font-bold uppercase text-violet-600 dark:text-violet-400 flex items-center gap-1.5 mb-0.5">
                        <List size={11} strokeWidth={3} /> Total de Questões
                    </span>
                    <span className="text-base font-black text-zinc-900 dark:text-white leading-none pl-4">
                        {total}
                    </span>
                </div>
            </div>

            {/* Linha Divisória Sutil */}
            <div className="h-px w-full bg-gradient-to-r from-zinc-100 via-zinc-200 to-zinc-100 dark:from-zinc-800 dark:via-zinc-700 dark:to-zinc-800"></div>

            {/* Parte Inferior: Acertos (Esmeralda) - SEM BADGE */}
            <div className="flex justify-between items-center p-2.5 pt-1.5 bg-emerald-50/30 dark:bg-emerald-900/5">
                 <div className="flex flex-col">
                    <span className="text-[9px] font-bold uppercase text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5 mb-0.5">
                        <CheckCircle2 size={11} strokeWidth={3} /> Acertos
                    </span>
                    <span className="text-lg font-black text-zinc-900 dark:text-white leading-none pl-4">
                        {correct}
                    </span>
                </div>
            </div>
        </div>
    );
};


// --- KPI Card Simples (para Tempo) ---
const MiniStatBox = ({ label, value, icon: Icon, colorClass }) => (
    <div className="flex items-center justify-between p-3 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-sm">
        <div className="flex flex-col">
            <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-0.5 flex items-center gap-1.5">
                <Icon size={10} className={colorClass} /> {label}
            </span>
            <span className="text-lg font-black text-zinc-900 dark:text-white leading-none">
                {value}
            </span>
        </div>
    </div>
);

// --- Componente Auxiliar de Métricas (Lista) ---
const MetricsDisplay = ({ time, questions, correct, variant = 'row' }) => {
    const accuracy = questions > 0 ? (correct / questions) * 100 : 0;
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
            <div className="flex flex-col min-w-[50px]">
                <span className={labelClass}>Tempo</span>
                <div className="flex items-center justify-end gap-1">
                    <Clock size={10} className="text-blue-500" />
                    <span className={valueClass}>{time > 0 ? formatTime(time) : '-'}</span>
                </div>
            </div>
            <div className="flex flex-col min-w-[40px]">
                <span className={labelClass}>Qts</span>
                <div className="flex items-center justify-end gap-1">
                    <List size={10} className="text-violet-500" />
                    <span className={valueClass}>{questions}</span>
                </div>
            </div>
            <div className="flex flex-col min-w-[40px]">
                <span className={labelClass}>Acertos</span>
                <div className="flex items-center justify-end gap-1">
                    <CheckCircle2 size={10} className="text-emerald-500" />
                    <span className={valueClass}>{correct}</span>
                </div>
            </div>
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

      if (!topicsMap[discName]) {
          topicsMap[discName] = { name: discName, totalMinutes: 0, totalQuestions: 0, totalCorrect: 0, topics: {} };
      }
      topicsMap[discName].totalMinutes += min;
      topicsMap[discName].totalQuestions += qst;
      topicsMap[discName].totalCorrect += acrt;

      if (!topicsMap[discName].topics[topicName]) {
          topicsMap[discName].topics[topicName] = { name: topicName, minutes: 0, questions: 0, correct: 0 };
      }
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
        {/* --- HEADER COMPACTO --- */}
        <div className="bg-red-50 dark:bg-red-900/10 border-b border-red-100 dark:border-red-900/30 p-3 sm:px-6 shrink-0 relative overflow-hidden">
          <div className="absolute top-[-20px] right-[-20px] opacity-[0.06] dark:opacity-[0.08] rotate-12 pointer-events-none">
            <Calendar size={120} className="text-red-600" />
          </div>

          <div className="relative z-10 flex justify-between items-center">
            <div className="flex flex-col">
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

                <div className="flex flex-wrap items-baseline gap-x-2">
                    <h2 className="text-2xl sm:text-3xl font-black text-zinc-900 dark:text-white capitalize tracking-tighter leading-none">
                        {formattedDate.weekday},
                    </h2>
                    <span className="text-lg sm:text-xl font-bold text-zinc-400 dark:text-zinc-500 tracking-tight">
                        {formattedDate.dayMonth}
                    </span>
                </div>
            </div>

            <button onClick={onClose} className="p-2 bg-white dark:bg-zinc-800 hover:bg-red-100 dark:hover:bg-red-900/40 text-zinc-500 hover:text-red-600 rounded-xl transition-all shadow-sm border border-zinc-200 dark:border-zinc-700/50">
              <X size={18} />
            </button>
          </div>
        </div>

        {/* --- BODY --- */}
        <div className="overflow-y-auto flex-1 p-4 sm:p-5 custom-scrollbar bg-zinc-50/50 dark:bg-black/20">

            {/* SEÇÃO 1: HERO GRID */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch">

                {/* 1. GRÁFICO GRANDE (Col-span-8) */}
                <div className="lg:col-span-8 bg-white dark:bg-zinc-900 rounded-2xl p-4 border border-zinc-200/50 dark:border-zinc-800 shadow-sm flex flex-col items-center justify-center relative min-h-[220px]">
                    {stats.totalMinutos > 0 ? (
                        <AdvancedChart data={disciplinaBreakdown} totalMinutes={stats.totalMinutos} />
                    ) : (
                        <div className="flex flex-col items-center justify-center py-8 opacity-50">
                            <Clock size={40} className="mb-2 text-zinc-300 dark:text-zinc-600" />
                            <span className="text-xs font-bold uppercase tracking-widest text-zinc-400">Sem dados</span>
                        </div>
                    )}
                </div>

                {/* 2. KPIs MINI (Col-span-4) */}
                <div className="lg:col-span-4 flex flex-col gap-3 h-full justify-center">

                    {/* Tempo Total (Mini Stat Box Simple) */}
                    <MiniStatBox
                        label="Tempo Total"
                        value={formatTime(stats.totalMinutos)}
                        icon={Clock}
                        colorClass="text-blue-500"
                    />

                    {/* NOVO CARD DUPLO: Questões e Acertos (Sem Badge de Porcentagem) */}
                    <QuestionsDualCard total={stats.totalQst} correct={stats.totalAcertos} />

                    {/* Precisão (Card existente, mantido) */}
                    <div className={`flex items-center justify-between p-3 border rounded-xl shadow-sm ${
                        stats.accuracy >= 80 ? "bg-emerald-50 dark:bg-emerald-900/10 border-emerald-200 dark:border-emerald-800" :
                        stats.accuracy >= 50 ? "bg-amber-50 dark:bg-amber-900/10 border-amber-200 dark:border-amber-800" :
                        "bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800"
                    }`}>
                        <div className="flex flex-col">
                            <span className={`text-[10px] font-bold uppercase tracking-wider mb-0.5 flex items-center gap-1.5 ${
                                stats.accuracy >= 80 ? "text-emerald-600" : stats.accuracy >= 50 ? "text-amber-600" : "text-red-500"
                            }`}>
                                <Target size={10} /> Precisão Geral
                            </span>
                            <span className="text-lg font-black text-zinc-900 dark:text-white leading-none">
                                {stats.accuracy.toFixed(0)}%
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            {/* SEÇÃO 2: DETALHAMENTO DE ESTUDO */}
            {topicosAgrupados.length > 0 && (
                <section className="mt-5">
                    <div className="flex items-center gap-2 mb-3 px-1">
                        <div className="p-1.5 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 rounded-lg shadow-sm">
                            <List size={14} strokeWidth={3} />
                        </div>
                        <h3 className="text-xs sm:text-sm font-black text-zinc-900 dark:text-white uppercase tracking-tight">Estudo do dia</h3>
                    </div>

                    <div className="grid gap-3">
                        {topicosAgrupados.map((disc, idx) => (
                            <motion.div
                                key={idx}
                                initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.05 }}
                                className="bg-white dark:bg-zinc-900 border border-zinc-200/60 dark:border-zinc-800 rounded-2xl overflow-hidden shadow-sm"
                            >
                                <div className="px-4 py-2.5 bg-zinc-50/80 dark:bg-zinc-950/30 border-b border-zinc-100 dark:border-zinc-800 flex flex-col sm:flex-row justify-between sm:items-center gap-2">
                                    <div className="flex items-center gap-2">
                                        <div className="w-1 h-5 bg-indigo-500 rounded-full"></div>
                                        <h4 className="font-bold text-zinc-800 dark:text-white text-sm">{disc.name}</h4>
                                    </div>
                                    <MetricsDisplay time={disc.totalMinutes} questions={disc.totalQuestions} correct={disc.totalCorrect} variant="header" />
                                </div>

                                <div className="divide-y divide-zinc-100 dark:divide-zinc-800/50">
                                    {disc.topics.map((topic, tIdx) => (
                                        <div key={tIdx} className="px-4 py-2 flex flex-col sm:flex-row justify-between gap-2 hover:bg-zinc-50 dark:hover:bg-zinc-800/30 transition-colors group">
                                            <div className="flex items-start gap-2 min-w-0 flex-1">
                                                <div className="mt-1.5 w-1.5 h-1.5 rounded-full bg-zinc-300 dark:bg-zinc-600 shrink-0"></div>
                                                <span className="text-xs sm:text-sm font-medium text-zinc-600 dark:text-zinc-300 leading-snug break-words">
                                                    {topic.name}
                                                </span>
                                            </div>
                                            <MetricsDisplay time={topic.minutes} questions={topic.questions} correct={topic.correct} />
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