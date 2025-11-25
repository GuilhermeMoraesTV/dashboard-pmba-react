import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  X,
  Clock,
  CheckCircle2,
  BookOpen,
  Target,
  Calendar,
  PieChart,
  BrainCircuit,
  AlertCircle,
  Trophy,
  Medal,
  TrendingUp
} from 'lucide-react';

// --- Helpers de Tempo ---
const formatTime = (minutes) => {
  if (!minutes || minutes === 0) return '0m';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
};

// --- Cores e Ícones ---
const getTypeColor = (tipo) => {
  switch (tipo) {
    case 'Questões': return 'text-emerald-600 bg-emerald-100 dark:bg-emerald-900/30 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800';
    case 'Teoria': return 'text-blue-600 bg-blue-100 dark:bg-blue-900/30 dark:text-blue-400 border-blue-200 dark:border-blue-800';
    case 'Revisão': return 'text-amber-600 bg-amber-100 dark:bg-amber-900/30 dark:text-amber-400 border-amber-200 dark:border-amber-800';
    default: return 'text-zinc-600 bg-zinc-100 dark:bg-zinc-800 dark:text-zinc-400 border-zinc-200 dark:border-zinc-700';
  }
};

const getTypeIcon = (tipo) => {
  switch (tipo) {
    case 'Questões': return <CheckCircle2 size={16} />;
    case 'Teoria': return <BookOpen size={16} />;
    case 'Revisão': return <BrainCircuit size={16} />;
    default: return <Clock size={16} />;
  }
};

// Cores para o Gráfico (Paleta)
const CHART_COLORS = [
  '#ef4444', // red-500
  '#3b82f6', // blue-500
  '#10b981', // emerald-500
  '#f59e0b', // amber-500
  '#8b5cf6', // violet-500
  '#ec4899', // pink-500
  '#6366f1', // indigo-500
  '#71717a', // zinc-500
];

// --- Componente Donut Chart ---
const DonutChart = ({ data, totalMinutes }) => {
  const radius = 40;
  const circumference = 2 * Math.PI * radius;
  let accumulatedPercent = 0;

  const segments = data.map((item, index) => {
    const percent = item.minutes / totalMinutes;
    const strokeDasharray = `${percent * circumference} ${circumference}`;
    const strokeDashoffset = -accumulatedPercent * circumference;
    accumulatedPercent += percent;

    return {
      ...item,
      color: CHART_COLORS[index % CHART_COLORS.length],
      strokeDasharray,
      strokeDashoffset
    };
  });

  return (
    <div className="flex flex-col sm:flex-row items-center gap-6">
      <div className="relative w-40 h-40 shrink-0">
        <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90 transform">
          <circle cx="50" cy="50" r={radius} fill="transparent" strokeWidth="12" className="stroke-zinc-100 dark:stroke-zinc-800" />
          {segments.map((seg, i) => (
            <motion.circle
              key={i}
              initial={{ strokeDasharray: `0 ${circumference}` }}
              animate={{ strokeDasharray: seg.strokeDasharray }}
              transition={{ duration: 0.8, delay: 0.2, ease: "easeOut" }}
              cx="50" cy="50" r={radius}
              fill="transparent"
              stroke={seg.color}
              strokeWidth="12"
              strokeDashoffset={seg.strokeDashoffset}
              strokeLinecap="round"
              className="hover:opacity-80 transition-opacity cursor-pointer"
            />
          ))}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center text-zinc-700 dark:text-zinc-300">
           <span className="text-xs font-medium uppercase text-zinc-400">Total</span>
           <span className="text-lg font-bold">{formatTime(totalMinutes)}</span>
        </div>
      </div>
      <div className="flex-1 w-full grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2 max-h-40 overflow-y-auto pr-2 custom-scrollbar">
        {segments.map((seg, i) => (
          <div key={i} className="flex items-center justify-between text-sm group">
            <div className="flex items-center gap-2 overflow-hidden">
              <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: seg.color }}></span>
              <span className="truncate font-medium text-zinc-700 dark:text-zinc-300 group-hover:text-zinc-900 dark:group-hover:text-white transition-colors">
                {seg.name}
              </span>
            </div>
            <span className="text-zinc-500 font-medium text-xs whitespace-nowrap">
              {Math.round(seg.percentTime)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

// --- Componente de Barra de Meta (Novo) ---
const GoalProgress = ({ label, current, target, unit = '', icon: Icon, colorClass }) => {
  const percentage = Math.min((current / target) * 100, 100);
  const isMet = current >= target;

  return (
    <div className="space-y-2">
      <div className="flex justify-between items-end text-sm">
        <div className="flex items-center gap-2 font-semibold text-zinc-700 dark:text-zinc-300">
          <Icon size={16} className={isMet ? colorClass : 'text-zinc-400'} />
          <span>{label}</span>
        </div>
        <div className="text-xs font-medium text-zinc-500">
          <span className={isMet ? `font-bold ${colorClass}` : 'text-zinc-800 dark:text-white'}>
            {current}{unit}
          </span>
          <span className="mx-1">/</span>
          {target}{unit}
        </div>
      </div>
      <div className="h-2.5 w-full bg-zinc-200 dark:bg-zinc-700 rounded-full overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${percentage}%` }}
          transition={{ duration: 1, ease: "easeOut" }}
          className={`h-full rounded-full ${isMet ? colorClass.replace('text-', 'bg-') : 'bg-zinc-400 dark:bg-zinc-500'}`}
        />
      </div>
    </div>
  );
};

function DayDetailsModal({ date, dayData, goals = { questions: 0, hours: 0 }, onClose }) {

  const {
    formattedDate,
    stats,
    registrosOrdenados,
    disciplinaBreakdown
  } = useMemo(() => {
    const [year, month, day] = date.split('-').map(Number);
    const dateObj = new Date(year, month - 1, day);
    const formatted = dateObj.toLocaleDateString('pt-BR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    });

    const allRecords = [
      ...dayData.dayHours.map(r => ({ ...r, category: 'time' })),
      ...dayData.dayQuestions.map(r => ({ ...r, category: 'question' }))
    ];

    const uniqueMap = new Map();
    allRecords.forEach(r => uniqueMap.set(r.id, r));
    const sorted = Array.from(uniqueMap.values()).sort((a, b) => b.timestamp - a.timestamp);

    let totalMinutos = 0;
    let totalQst = 0;
    let totalAcertos = 0;
    const breakdown = {};

    sorted.forEach(r => {
      const min = Number(r.tempoEstudadoMinutos || 0);
      const qst = Number(r.questoesFeitas || 0);
      const acrt = Number(r.acertos || 0);

      totalMinutos += min;
      totalQst += qst;
      totalAcertos += acrt;

      const discName = r.disciplinaNome || 'Geral';
      if (!breakdown[discName]) {
        breakdown[discName] = { name: discName, minutes: 0, questions: 0 };
      }
      breakdown[discName].minutes += min;
      breakdown[discName].questions += qst;
    });

    const breakdownArray = Object.values(breakdown)
      .sort((a, b) => b.minutes - a.minutes)
      .map(item => ({
        ...item,
        percentTime: totalMinutos > 0 ? (item.minutes / totalMinutos) * 100 : 0
      }));

    const accuracy = totalQst > 0 ? (totalAcertos / totalQst) * 100 : 0;

    return {
      formattedDate: formatted,
      stats: { totalMinutos, totalQst, totalAcertos, accuracy },
      registrosOrdenados: sorted,
      disciplinaBreakdown: breakdownArray
    };
  }, [date, dayData]);

  // Cálculo de Status da Meta
  const metaStatus = useMemo(() => {
    const hoursGoalMinutes = (goals.hours || 0) * 60;
    const questionsGoal = goals.questions || 0;

    const hoursMet = hoursGoalMinutes === 0 || stats.totalMinutos >= hoursGoalMinutes;
    const questionsMet = questionsGoal === 0 || stats.totalQst >= questionsGoal;

    // Se não tiver meta cadastrada, não mostra a seção
    const hasGoals = hoursGoalMinutes > 0 || questionsGoal > 0;

    let verdict = 'neutral'; // neutral, partial, success
    let message = 'Sem metas definidas para este dia.';
    let icon = Calendar;

    if (hasGoals) {
      if (hoursMet && questionsMet) {
        verdict = 'success';
        message = 'Parabéns! Todas as metas foram batidas!';
        icon = Trophy;
      } else if (hoursMet || questionsMet) {
        verdict = 'partial';
        message = 'Quase lá! Você cumpriu parte da meta.';
        icon = Medal;
      } else {
        verdict = 'fail';
        message = 'Meta não atingida. Continue firme!';
        icon = TrendingUp;
      }
    }

    return { hasGoals, hoursGoalMinutes, questionsGoal, hoursMet, questionsMet, verdict, message, Icon: icon };
  }, [goals, stats]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-zinc-900/60 backdrop-blur-sm"
      />

      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="relative w-full max-w-2xl bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] border border-zinc-200 dark:border-zinc-800"
      >
        {/* Header */}
        <div className="bg-red-50 dark:bg-red-900/10 border-b border-red-100 dark:border-red-900/30 p-6 shrink-0 relative overflow-hidden">
          <div className="absolute top-[-20px] right-[-20px] opacity-[0.05] dark:opacity-[0.1] rotate-12 pointer-events-none">
            <Calendar size={150} className="text-red-600" />
          </div>

          <div className="relative z-10 flex justify-between items-start">
            <div>
              <p className="text-red-600 dark:text-red-400 text-xs font-bold uppercase tracking-widest flex items-center gap-2 mb-1">
                <Calendar size={14} /> Relatório Diário
              </p>
              <h2 className="text-2xl md:text-3xl font-extrabold text-zinc-800 dark:text-white capitalize">
                {formattedDate}
              </h2>
            </div>
            <button onClick={onClose} className="p-2 bg-white dark:bg-zinc-800 hover:bg-red-100 dark:hover:bg-red-900/40 text-zinc-500 hover:text-red-600 rounded-full transition-all shadow-sm border border-zinc-200 dark:border-zinc-700">
              <X size={20} />
            </button>
          </div>

          {/* KPI Cards */}
          <div className="flex gap-3 mt-6">
            <div className="bg-white dark:bg-zinc-800/80 rounded-lg p-3 flex-1 border border-zinc-200 dark:border-zinc-700/50 shadow-sm flex flex-col justify-center">
              <div className="flex items-center gap-1.5 text-zinc-500 dark:text-zinc-400 text-[10px] uppercase font-bold tracking-wider"><Clock size={12} /> Tempo</div>
              <div className="text-xl font-bold text-zinc-800 dark:text-white mt-0.5">{formatTime(stats.totalMinutos)}</div>
            </div>
            <div className="bg-white dark:bg-zinc-800/80 rounded-lg p-3 flex-1 border border-zinc-200 dark:border-zinc-700/50 shadow-sm flex flex-col justify-center">
              <div className="flex items-center gap-1.5 text-zinc-500 dark:text-zinc-400 text-[10px] uppercase font-bold tracking-wider"><CheckCircle2 size={12} /> Questões</div>
              <div className="text-xl font-bold text-zinc-800 dark:text-white mt-0.5 flex items-baseline gap-1">
                {stats.totalQst}
              </div>
            </div>
            <div className="bg-white dark:bg-zinc-800/80 rounded-lg p-3 flex-1 border border-zinc-200 dark:border-zinc-700/50 shadow-sm flex flex-col justify-center">
              <div className="flex items-center gap-1.5 text-zinc-500 dark:text-zinc-400 text-[10px] uppercase font-bold tracking-wider"><Target size={12} /> Precisão</div>
              <div className={`text-xl font-bold mt-0.5 ${stats.accuracy >= 80 ? 'text-emerald-600' : stats.accuracy >= 50 ? 'text-amber-600' : 'text-red-600'}`}>{stats.accuracy.toFixed(0)}%</div>
            </div>
          </div>
        </div>

        <div className="overflow-y-auto flex-1 p-6 space-y-6 bg-zinc-50/50 dark:bg-zinc-950/50">

          {/* --- NOVA SEÇÃO: VEREDITO DA META --- */}
          {metaStatus.hasGoals && (
            <motion.section
              initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
              className={`p-4 rounded-xl border shadow-sm relative overflow-hidden
                ${metaStatus.verdict === 'success' ? 'bg-emerald-50 border-emerald-200 dark:bg-emerald-900/10 dark:border-emerald-800' : ''}
                ${metaStatus.verdict === 'partial' ? 'bg-amber-50 border-amber-200 dark:bg-amber-900/10 dark:border-amber-800' : ''}
                ${metaStatus.verdict === 'fail' ? 'bg-white border-zinc-200 dark:bg-zinc-900 dark:border-zinc-800' : ''}
              `}
            >
              <div className="flex items-start gap-4 mb-4 relative z-10">
                <div className={`p-3 rounded-full shrink-0
                  ${metaStatus.verdict === 'success' ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400' : ''}
                  ${metaStatus.verdict === 'partial' ? 'bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400' : ''}
                  ${metaStatus.verdict === 'fail' ? 'bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400' : ''}
                `}>
                  <metaStatus.Icon size={24} strokeWidth={2.5} />
                </div>
                <div>
                  <h3 className={`font-bold text-lg leading-tight
                     ${metaStatus.verdict === 'success' ? 'text-emerald-800 dark:text-emerald-200' : ''}
                     ${metaStatus.verdict === 'partial' ? 'text-amber-800 dark:text-amber-200' : ''}
                     ${metaStatus.verdict === 'fail' ? 'text-zinc-800 dark:text-zinc-200' : ''}
                  `}>
                    {metaStatus.message}
                  </h3>

                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 relative z-10 pl-2 pr-2 pb-1">
                {metaStatus.hoursGoalMinutes > 0 && (
                  <GoalProgress
                    label="Meta de Horas"
                    icon={Clock}
                    current={formatTime(stats.totalMinutos)}
                    target={formatTime(metaStatus.hoursGoalMinutes)}
                    colorClass="text-blue-600"
                    unit="" // Já formatado
                  />
                )}
                {metaStatus.questionsGoal > 0 && (
                  <GoalProgress
                    label="Meta de Questões"
                    icon={CheckCircle2}
                    current={stats.totalQst}
                    target={metaStatus.questionsGoal}
                    colorClass="text-emerald-600"
                    unit=""
                  />
                )}
              </div>
            </motion.section>
          )}

          {/* Gráfico de Rosca */}
          {disciplinaBreakdown.length > 0 && stats.totalMinutos > 0 && (
            <section className="bg-white dark:bg-zinc-900 p-5 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
              <h3 className="flex items-center gap-2 text-xs font-bold text-zinc-400 uppercase tracking-widest mb-6">
                <PieChart size={14} /> Distribuição do Tempo
              </h3>
              <DonutChart data={disciplinaBreakdown} totalMinutes={stats.totalMinutos} />
            </section>
          )}

          {/* Timeline */}
          <section>
            <h3 className="flex items-center gap-2 text-xs font-bold text-zinc-400 uppercase tracking-widest mb-4">
              <Clock size={14} /> Linha do Tempo
            </h3>

            {registrosOrdenados.length === 0 ? (
              <div className="text-center py-12 border-2 border-dashed border-zinc-200 dark:border-zinc-800 rounded-xl">
                <AlertCircle size={40} className="mx-auto mb-3 text-zinc-300 dark:text-zinc-700" />
                <p className="text-zinc-500 font-medium">Nenhum registro neste dia.</p>
              </div>
            ) : (
              <div className="space-y-4 relative pl-4">
                 <div className="absolute left-[19px] top-2 bottom-4 w-[2px] bg-zinc-200 dark:bg-zinc-800 z-0"></div>
                {registrosOrdenados.map((item, index) => {
                  const colorClass = getTypeColor(item.tipoEstudo);
                  return (
                    <motion.div
                      initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: index * 0.05 }}
                      key={item.id || index} className="relative z-10"
                    >
                      <div className="flex gap-4">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 border-2 shadow-sm ${colorClass} bg-white dark:bg-zinc-900`}>
                          {getTypeIcon(item.tipoEstudo)}
                        </div>
                        <div className="flex-1 bg-white dark:bg-zinc-900 p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm hover:shadow-md transition-all group">
                          <div className="flex justify-between items-start mb-2">
                            <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${colorClass.split(' ')[1]} ${colorClass.split(' ')[0]}`}>{item.tipoEstudo}</span>
                            {item.tempoEstudadoMinutos > 0 && <span className="text-xs font-bold text-zinc-500 dark:text-zinc-400 flex items-center gap-1"><Clock size={10} />{formatTime(item.tempoEstudadoMinutos)}</span>}
                          </div>
                          <h4 className="font-bold text-zinc-800 dark:text-white text-base leading-tight group-hover:text-red-600 dark:group-hover:text-red-400 transition-colors">{item.disciplinaNome}</h4>
                          {item.topicoNome && <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1 flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-zinc-300 dark:bg-zinc-600"></span>{item.topicoNome}</p>}
                          {item.questoesFeitas > 0 && (
                            <div className="mt-3 pt-3 border-t border-zinc-100 dark:border-zinc-800 flex items-center gap-4 text-sm bg-zinc-50/50 dark:bg-zinc-900/50 -mx-4 -mb-4 px-4 py-2 rounded-b-xl">
                              <div className="flex items-center gap-1.5 text-zinc-600 dark:text-zinc-400 text-xs"><span className="font-bold text-zinc-800 dark:text-white">{item.acertos}</span> acertos</div>
                              <div className="flex items-center gap-1.5 text-zinc-600 dark:text-zinc-400 text-xs"><span className="font-bold text-zinc-800 dark:text-white">{item.questoesFeitas}</span> feitas</div>
                              <div className={`ml-auto text-xs font-bold px-2 py-0.5 rounded ${(item.acertos/item.questoesFeitas) >= 0.8 ? 'bg-emerald-100 text-emerald-700' : (item.acertos/item.questoesFeitas) >= 0.6 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'}`}>{((item.acertos / item.questoesFeitas) * 100).toFixed(0)}%</div>
                            </div>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      </motion.div>
    </div>
  );
}

export default DayDetailsModal;