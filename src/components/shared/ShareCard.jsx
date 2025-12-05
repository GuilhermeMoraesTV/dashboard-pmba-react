// components/shared/ShareCard.js (CÓDIGO COMPLETO E CORRIGIDO)

import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  Trophy, Clock, Target, Calendar, PieChart, Medal, TrendingUp, AlertCircle, CheckCircle2,
  BookOpen, BrainCircuit, Sparkles, Activity
} from 'lucide-react';



// --- Helpers ---
const formatTime = (minutes) => {
  if (!minutes || minutes === 0) return '0m';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
};

// --- Cores para o gráfico ---
const CHART_COLORS = [
  '#ef4444', '#f59e0b', '#3b82f6', '#10b981',
  '#8b5cf6', '#ec4899', '#6366f1', '#71717a'
];

// --- Donut Chart (Correção Definitiva de Truncamento) ---
const DonutChart = ({ data, totalMinutes, isDarkMode }) => {
  const radius = 35;
  const circumference = 2 * Math.PI * radius;
  let accumulatedPercent = 0;
  const strokeColor = isDarkMode ? '#3f3f46' : '#e4e4e7';
  const textColor = isDarkMode ? '#e4e4e7' : '#18181b';
  const zincColor = isDarkMode ? '#a1a1aa' : '#52525b';

  const segments = data.map((item, index) => {
    const percent = item.minutes / totalMinutes;
    const strokeDasharray = `${percent * circumference} ${circumference}`;
    const strokeDashoffset = -accumulatedPercent * circumference;
    accumulatedPercent += percent;

    return {
      ...item,
      color: CHART_COLORS[index % CHART_COLORS.length],
      strokeDasharray,
      strokeDashoffset,
      percentTime: totalMinutes > 0 ? (item.minutes / totalMinutes) * 100 : 0
    };
  });

  return (
    <div className="flex items-center gap-2">
      <div className="relative w-28 h-28 shrink-0">
        <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
          <circle cx="50" cy="50" r={radius} fill="transparent" strokeWidth="10" style={{ stroke: strokeColor }} />
          {segments.map((seg, i) => (
            <circle
              key={i}
              cx="50" cy="50" r={radius}
              fill="transparent"
              stroke={seg.color}
              strokeWidth="10"
              strokeDasharray={seg.strokeDasharray}
              strokeDashoffset={seg.strokeDashoffset}
              strokeLinecap="round"
            />
          ))}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-1" style={{ color: textColor }}>
           <span className="text-[10px] font-medium uppercase text-zinc-500 leading-none">Total</span>
           <span className="text-sm font-bold leading-tight">{formatTime(totalMinutes)}</span>
        </div>
      </div>
      <div className="flex-1 w-full grid grid-cols-1 gap-y-1.5">
        {segments.map((seg, i) => (
          <div key={i} className="flex items-start justify-between text-sm">
            <div className="flex items-start gap-2 flex-1 min-w-0">
              <span className="w-3 h-3 rounded-full shrink-0 mt-0.5" style={{ backgroundColor: seg.color }}></span>
              <span className="font-medium text-xs break-words flex-1 min-w-0" style={{ color: textColor }}>{seg.name}</span>
            </div>
            <span className="text-xs font-medium whitespace-nowrap shrink-0" style={{ color: zincColor }}>{Math.round(seg.percentTime)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
};

// --- Barra de Meta (Adaptada para Captura Estática) ---
const GoalProgress = ({ label, currentMinutes, targetMinutes, icon: Icon, colorClass, isTime = false, isDarkMode }) => {
  const percentage = Math.min((currentMinutes / targetMinutes) * 100, 100);
  const isMet = currentMinutes >= targetMinutes;
  const bgColorClass = isMet ? colorClass.replace('text-', 'bg-') : (isDarkMode ? 'bg-zinc-600' : 'bg-zinc-300');
  const textColor = isDarkMode ? '#e4e4e7' : '#18181b';
  const zincColor = isDarkMode ? '#a1a1aa' : '#52525b';

  const currentDisplay = isTime ? formatTime(currentMinutes) : currentMinutes;
  const targetDisplay = isTime ? formatTime(targetMinutes) : targetMinutes;

  return (
    <div className="space-y-1.5">
      <div className="flex justify-between items-end text-sm">
        <div className="flex items-center gap-2 font-semibold text-xs" style={{ color: textColor }}>
          {/* Cor do ícone ajustada: se atingida, usa a cor de sucesso; senão, cinza */}
          <Icon size={14} className={isMet ? colorClass : (isDarkMode ? 'text-zinc-400' : 'text-zinc-500')} />
          <span>{label}</span>
        </div>
        <div className="text-[10px] font-medium" style={{ color: zincColor }}>
          <span className={isMet ? `font-bold ${colorClass}` : textColor}>
            {currentDisplay}
          </span>
          <span className="mx-0.5">/</span>
          {targetDisplay}
        </div>
      </div>
      <div className="h-2 w-full rounded-full overflow-hidden" style={{ backgroundColor: isDarkMode ? '#3f3f46' : '#e4e4e7' }}>
        <div
          style={{ width: `${percentage}%` }}
          className={`h-full rounded-full ${bgColorClass}`}
        />
      </div>
    </div>
  );
};


// --- ShareCard (Refletindo estilo do DayDetailsModal) ---
function ShareCard({ stats, userName, dayData, goals, isDarkMode }) {

    const firstName = userName.split(' ')[0];

    const {
        formattedDate,
        dayStats,
        disciplinaBreakdown
    } = useMemo(() => {
        const dateStr = new Date().toISOString().slice(0, 10);
        const [year, month, day] = dateStr.split('-').map(Number);
        const dateObj = new Date(year, month - 1, day);
        const formatted = dateObj.toLocaleDateString('pt-BR', {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
        });

        const dayHours = dayData?.dayHours || [];
        const dayQuestions = dayData?.dayQuestions || [];

        const allRecords = [
            ...dayHours,
            ...dayQuestions
        ];

        let totalMinutos = 0;
        let totalQst = 0;
        let totalAcertos = 0;
        const breakdown = {};

        allRecords.forEach(r => {
            const min = Number(r.tempoEstudadoMinutos || 0);
            const qst = Number(r.questoesFeitas || 0);
            const acrt = Number(r.acertos || 0);

            totalMinutos += min;
            totalQst += qst;
            totalAcertos += acrt;

            const disc = r.disciplinaNome || 'Geral';
            if (!breakdown[disc]) breakdown[disc] = { name: disc, minutes: 0 };
            breakdown[disc].minutes += min;
        });

        const accuracy = totalQst > 0 ? (totalAcertos / totalQst) * 100 : 0;
        const breakdownArray = Object.values(breakdown);

        return {
            formattedDate: formatted,
            dayStats: { totalMinutos, totalQst, totalAcertos, accuracy },
            disciplinaBreakdown: breakdownArray
        };
    }, [dayData]);

    const metaStatus = useMemo(() => {
        const hoursGoalMinutes = (goals.hours || 0) * 60;
        const questionsGoal = (goals.questions || 0);

        const hoursMet = hoursGoalMinutes === 0 || dayStats.totalMinutos >= hoursGoalMinutes;
        const questionsMet = questionsGoal === 0 || dayStats.totalQst >= questionsGoal;

        const hasGoals = hoursGoalMinutes > 0 || questionsGoal > 0;

        let verdict = 'neutral';
        let message = 'Sem metas definidas';
        let icon = Calendar;

        if (hasGoals) {
            if (hoursMet && questionsMet) {
                verdict = 'success';
                message = 'Parabéns! Todas as metas atingidas!';
                icon = Trophy;
            } else if (hoursMet || questionsMet) {
                verdict = 'partial';
                message = 'Você cumpriu parte da meta!';
                icon = Medal;
            } else {
                verdict = 'fail';
                message = 'Meta não atingida. Continue firme!';
                icon = TrendingUp;
            }
        }

        return {
            hasGoals, hoursGoalMinutes, questionsGoal, hoursMet, questionsMet,
            verdict, message, Icon: icon
        };
    }, [goals, dayStats]);

    // --- Configuração de Cores/Temas ---
    const currentCardStyle = {
        success: { color: '#10b981', secondary: isDarkMode ? '#1e3a2d' : '#ecfdf5', iconBg: isDarkMode ? '#059669' : '#a7f3d0' }, // Emerald
        partial: { color: '#f59e0b', secondary: isDarkMode ? '#4a3605' : '#fff7ed', iconBg: isDarkMode ? '#d97706' : '#fed7aa' }, // Amber
        fail: { color: '#ef4444', secondary: isDarkMode ? '#451616' : '#fef2f2', iconBg: isDarkMode ? '#b91c1c' : '#fecaca' }, // Red
        neutral: { color: '#3b82f6', secondary: isDarkMode ? '#172554' : '#eff6ff', iconBg: isDarkMode ? '#2563eb' : '#bfdbfe' } // Blue
    }[metaStatus.verdict];

    const backgroundColor = isDarkMode ? '#18181b' : '#ffffff';
    const primaryTextColor = isDarkMode ? '#e4e4e7' : '#18181b';
    const secondaryBgColor = isDarkMode ? '#27272a' : '#f4f4f5';
    const overallProgressDisplay = stats.overallProgress.toFixed(0);

    const targetHoursMinutes = (goals.hours || 0) * 60;
    const targetQuestions = (goals.questions || 0);

    // Configuração da cor do Mascote/Watermark
    const watermarkColor = isDarkMode ? '#ffffff' : '#18181b';
    const calendarOpacity = '0.20';
    const soldierOpacity = '0.35'; // AUMENTO DE OPACIDADE PARA SER VISÍVEL
    const soldierFilter = isDarkMode ? 'brightness(0.9)' : 'grayscale(100%) opacity(0.5)'; // FILTRO LIGHT MODE AJUSTADO


    return (
        <div
            id="share-card-capture-target"
            className="w-[340px] h-auto p-4 rounded-xl relative overflow-hidden font-sans select-none"
            style={{
                backgroundColor: backgroundColor,
                border: `1px solid ${isDarkMode ? '#3f3f46' : '#d4d4d8'}`,
                boxShadow: `0 0 10px rgba(0,0,0,0.1)`,
                color: primaryTextColor
            }}
        >
            {/* --- Mascote (Soldado) Watermark --- */}
            {/* Ícone de Marca D'água (CALENDÁRIO) */}
            <div className="absolute top-[-25px] right-[-25px] rotate-12 pointer-events-none" style={{ color: watermarkColor, opacity: calendarOpacity }}>
                <Calendar size={150} />
            </div>
            
            <div className="relative z-10 space-y-3">

                {/* === TOP HEADER E DATA === */}
                <div className="text-center">
                     <p className="text-xs font-bold uppercase tracking-widest text-zinc-500">
                        {formattedDate}
                    </p>
                    <h1 className="text-lg font-black uppercase tracking-widest mt-0.5" style={{ color: primaryTextColor }}>
                        Relatório Diario de {firstName}
                    </h1>
                </div>

                {/* === VEREDITO & PROGRESSO CENTRAL === */}
                <div className="p-3 rounded-xl border shadow-sm" style={{ backgroundColor: currentCardStyle.secondary, borderColor: currentCardStyle.color }}>
                    <div className="flex items-center gap-4 relative z-10">
                        <div className="p-2 rounded-full shrink-0" style={{ backgroundColor: currentCardStyle.iconBg, color: currentCardStyle.color }}>
                            <metaStatus.Icon size={20} strokeWidth={2.5} />
                        </div>
                        <div>
                            <h3 className={`font-bold text-base leading-tight`} style={{ color: primaryTextColor }}>
                                {metaStatus.message}
                            </h3>
                            <p className="text-xs text-zinc-500" style={{ color: currentCardStyle.color }}>
                                Progresso geral: {overallProgressDisplay}%
                            </p>
                        </div>
                    </div>
                </div>


                {/* === METAS BATIDAS (Goal Progress Bars) === */}
                {metaStatus.hasGoals && (
                    <div className="space-y-3 p-3 rounded-xl border" style={{ backgroundColor: secondaryBgColor, borderColor: isDarkMode ? '#3f3f46' : '#e4e4e7' }}>
                        <p className="text-xs font-bold uppercase tracking-widest text-zinc-500 mb-2">METAS DIÁRIAS</p>

                        {metaStatus.hoursGoalMinutes > 0 && (
                          <GoalProgress
                            label="Horas de Estudo"
                            icon={Clock}
                            currentMinutes={dayStats.totalMinutos}
                            targetMinutes={targetHoursMinutes}
                            colorClass={metaStatus.hoursMet ? "text-emerald-500" : "text-blue-500"} // CORREÇÃO HORAS: Verde se batida, Azul se em andamento
                            isTime={true}
                            isDarkMode={isDarkMode}
                          />
                        )}
                        {metaStatus.questionsGoal > 0 && (
                          <GoalProgress
                            label="Questões"
                            icon={Target}
                            currentMinutes={dayStats.totalQst}
                            targetMinutes={targetQuestions}
                            colorClass={metaStatus.questionsMet ? "text-emerald-500" : "text-blue-500"} // CORREÇÃO QUESTÕES: Verde se batida, Azul se em andamento
                            isTime={false}
                            isDarkMode={isDarkMode}
                          />
                        )}

                        <div className="pt-2 border-t" style={{ borderColor: isDarkMode ? '#3f3f46' : '#d4d4d8' }}>
                            <p className={`text-xs font-bold`} style={{ color: primaryTextColor }}>
                                Precisão: <span className={dayStats.accuracy >= 80 ? 'text-emerald-500' : 'text-amber-500'}>{dayStats.accuracy.toFixed(0)}%</span>
                            </p>
                        </div>
                    </div>
                )}


                {/* === DETALHES DE DISCIPLINAS (Donut Chart) === */}
                {dayStats.totalMinutos > 0 && (
                    <div className="space-y-3 p-3 rounded-xl border" style={{ backgroundColor: secondaryBgColor, borderColor: isDarkMode ? '#3f3f46' : '#e4e4e7' }}>
                        <p className="text-xs font-bold uppercase tracking-widest text-zinc-500">DISTRIBUIÇÃO POR MATÉRIA</p>
                        <DonutChart data={disciplinaBreakdown} totalMinutes={dayStats.totalMinutos} isDarkMode={isDarkMode} />
                    </div>
                )}


            </div>
        </div>
    );
}

export default ShareCard;