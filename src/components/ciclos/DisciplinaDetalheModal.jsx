import React, { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  Clock,
  Target,
  BookOpen,
  Activity,
  List,
  CheckCircle2,
  ArrowDown
} from 'lucide-react';

// --- HELPERS ---

const formatTime = (minutes) => {
  if (!minutes || minutes === 0) return '0m';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h > 0) return `${h}h ${m > 0 ? `${m}m` : ''}`;
  return `${m}m`;
};

const normalizeText = (text) => {
    if (!text) return 'Geral';
    return text.trim();
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

// --- COMPONENTES VISUAIS ---

// 2. Metrics Display (Lista de Assuntos)
const MetricsDisplay = ({ time, questions, correct, variant = 'row' }) => {
    const accuracy = questions > 0 ? (correct / questions) * 100 : 0;
    let accColor = 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400';
    if (questions > 0) {
        if (accuracy >= 80) accColor = 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400';
        else if (accuracy >= 50) accColor = 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400';
        else accColor = 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400';
    }

    const containerClass = "flex flex-wrap sm:flex-nowrap items-center justify-end gap-3 sm:gap-5 w-full sm:w-auto mt-2 sm:mt-0";
    const labelClass = "text-[9px] font-bold text-zinc-400 uppercase tracking-wide block mb-0.5 text-right";
    const valueClass = "text-xs font-mono font-bold text-zinc-600 dark:text-zinc-400 text-right";

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

// 3. Mini Stat Box (KPI Simples)
const MiniStatBox = ({ label, value, icon: Icon, colorClass }) => (
    <div className="flex items-center justify-between p-3 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-sm h-full min-h-[70px]">
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

// 4. Questions Dual Card (KPI Duplo - Corrigido)
const QuestionsDualCard = ({ total, correct }) => {
    return (
        <div className="flex flex-col bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-sm overflow-hidden relative h-full min-h-[100px]">
            <div className="absolute left-6 top-1/2 -translate-y-1/2 z-10 text-zinc-200 dark:text-zinc-700 pointer-events-none">
                <ArrowDown size={12} strokeWidth={3} className="opacity-50" />
            </div>
            {/* Topo: Total */}
            <div className="flex justify-between items-center p-2.5 pb-1.5 bg-violet-50/30 dark:bg-violet-900/5 flex-1">
                <div className="flex flex-col">
                    <span className="text-[9px] font-bold uppercase text-violet-600 dark:text-violet-400 flex items-center gap-1.5 mb-0.5">
                        <List size={11} strokeWidth={3} /> Questões
                    </span>
                    <span className="text-base font-black text-zinc-900 dark:text-white leading-none pl-4">
                        {total}
                    </span>
                </div>
            </div>

            {/* Divisor */}
            <div className="h-px w-full bg-zinc-100 dark:bg-zinc-800"></div>

            {/* Baixo: Acertos */}
            <div className="flex justify-between items-center p-2.5 pt-1.5 bg-emerald-50/30 dark:bg-emerald-900/5 flex-1">
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

// 5. AdvancedChart (Donut Chart)
const AdvancedChart = ({ data, totalMinutes }) => {
    const radius = 70;
    const center = 90;
    const viewBoxSize = 180;
    const circumference = 2 * Math.PI * radius;
    let accumulatedPercent = 0;

    const safeTotal = totalMinutes > 0 ? totalMinutes : 1;

    // Filtra apenas o que tem minutos e ordena
    const sortedData = [...data]
        .filter(d => d.minutes > 0)
        .sort((a, b) => b.minutes - a.minutes);

    const segments = sortedData.map((item, index) => {
      const percent = item.minutes / safeTotal;
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

        {/* Legenda */}
        <div className="flex flex-col justify-center flex-1 w-full gap-3 min-w-0">
          {segments.slice(0, 5).map((seg, i) => (
            <div key={i} className="flex flex-col gap-1 w-full">
              <div className="flex justify-between items-end">
                  <span className="text-xs font-bold text-zinc-700 dark:text-zinc-300 leading-tight truncate">
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
          {segments.length === 0 && (
             <div className="text-center text-zinc-400 text-xs">Nenhum dado para o gráfico.</div>
          )}
        </div>
      </div>
    );
};


function DisciplinaDetalheModal({ disciplina, registrosEstudo, activeCicloId, onClose }) {
    // viewMode: 'cycle' (Histórico Completo)
    const [viewMode, setViewMode] = useState('cycle');

    const data = useMemo(() => {
        if (!disciplina) return null;

        // 1. Filtragem Inicial
        const registrosDaDisciplina = registrosEstudo.filter(r => r.disciplinaId === disciplina.id);

        // 2. Lógica de Filtro
        const registrosFiltrados = registrosDaDisciplina.filter(r => {
            if (viewMode === 'total') {
                // VISÃO TOTAL (Nome no botão) -> Lógica: Filtrar pelo Ciclo Ativo
                return activeCicloId && r.cicloId === activeCicloId;
            }
            // CICLO ATUAL (Nome no botão) -> Lógica: Pegar Todo o Histórico
            return true;
        });

        // 3. KPIs - CORREÇÃO: Garante conversão para Number para evitar erro na soma
        const totalMinutes = registrosFiltrados.reduce((acc, r) => acc + (Number(r.tempoEstudadoMinutos) || 0), 0);
        const totalQuestions = registrosFiltrados.reduce((acc, r) => acc + (Number(r.questoesFeitas) || 0), 0);
        const totalCorrect = registrosFiltrados.reduce((acc, r) => acc + (Number(r.acertos) || 0), 0);
        const accuracy = totalQuestions > 0 ? ((totalCorrect / totalQuestions) * 100).toFixed(0) : 0;

        // 4. Mapeamento
        const mapaRegistros = {};
        registrosFiltrados.forEach(reg => {
            const nomeChave = normalizeText(reg.assunto);
            if (!mapaRegistros[nomeChave]) {
                mapaRegistros[nomeChave] = { tempo: 0, questoes: 0, acertos: 0, originalName: reg.assunto };
            }
            mapaRegistros[nomeChave].tempo += (Number(reg.tempoEstudadoMinutos) || 0);
            mapaRegistros[nomeChave].questoes += (Number(reg.questoesFeitas) || 0);
            mapaRegistros[nomeChave].acertos += (Number(reg.acertos) || 0);
        });

        // 5. Lista Unificada
        const listaOficial = Array.isArray(disciplina.assuntos) ? disciplina.assuntos : [];
        const chavesUnicas = new Set();

        listaOficial.forEach(item => {
            const nome = typeof item === 'object' ? item.nome : item;
            chavesUnicas.add(normalizeText(nome));
        });
        Object.keys(mapaRegistros).forEach(chave => chavesUnicas.add(chave));

        let tabelaAssuntos = Array.from(chavesUnicas).map(chave => {
            const dados = mapaRegistros[chave] || { tempo: 0, questoes: 0, acertos: 0 };

            let displayNome = chave;
            const editalItem = listaOficial.find(item => normalizeText(typeof item === 'object' ? item.nome : item) === chave);
            if (editalItem) {
                displayNome = typeof editalItem === 'object' ? editalItem.nome : editalItem;
            } else if (dados.originalName) {
                displayNome = dados.originalName;
            }

            const hasData = dados.tempo > 0 || dados.questoes > 0;

            return {
                nome: displayNome,
                tempo: dados.tempo,
                questoes: dados.questoes,
                acertos: dados.acertos,
                hasData,
                // Dados extras para o gráfico
                minutes: dados.tempo,
                name: displayNome
            };
        });

        // 6. Filtro de Exibição (Histórico só mostra o que tem dado)
        if (viewMode === 'cycle') {
            tabelaAssuntos = tabelaAssuntos.filter(t => t.hasData);
        }

        // Ordenação
        tabelaAssuntos.sort((a, b) => {
            if (a.hasData && !b.hasData) return -1;
            if (!a.hasData && b.hasData) return 1;
            return b.tempo - a.tempo;
        });

        return {
            stats: { totalMinutes, totalQuestions, totalCorrect, accuracy },
            tabelaAssuntos,
            topicsCovered: tabelaAssuntos.filter(t => t.hasData).length
        };
    }, [disciplina, registrosEstudo, viewMode, activeCicloId]);

    if (!disciplina || !data) return null;

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="fixed inset-0 z-[100] flex items-center justify-center p-2 sm:p-4 overflow-hidden"
            >
                <div className="absolute inset-0 bg-zinc-950/70 backdrop-blur-sm" onClick={onClose} />

                <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: 20 }}
                    onClick={(e) => e.stopPropagation()}
                    className="relative w-full max-w-4xl bg-zinc-50 dark:bg-zinc-950 rounded-[2rem] shadow-2xl overflow-hidden flex flex-col max-h-[90vh] border border-white/50 dark:border-zinc-800"
                >
                    {/* --- HEADER --- */}
                    <div className="bg-red-50 dark:bg-red-900/10 border-b border-red-100 dark:border-red-900/30 p-4 sm:px-6 shrink-0 relative overflow-hidden">
                        <div className="absolute top-[-20px] right-[-20px] opacity-[0.06] dark:opacity-[0.08] rotate-12 pointer-events-none">
                            <BookOpen size={120} className="text-red-600" />
                        </div>

                        <div className="relative z-10 flex flex-col sm:flex-row justify-between items-center gap-4">
                            <div className="flex flex-col items-center sm:items-start text-center sm:text-left">
                                <p className="text-red-600 dark:text-red-400 text-[10px] font-bold uppercase tracking-widest flex items-center gap-1.5 mb-1">
                                    <Activity size={12} strokeWidth={2.5} /> Relatório de Disciplina
                                </p>
                                <h2 className="text-2xl sm:text-3xl font-black text-zinc-900 dark:text-white uppercase tracking-tighter leading-none">
                                    {disciplina.nome}
                                </h2>
                            </div>

                            {/* --- BOTÃO DE FECHAR (SEM SEGMENTED CONTROL) --- */}
                            <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
                                <button onClick={onClose} className="p-2 bg-white dark:bg-zinc-800 hover:bg-red-100 dark:hover:bg-red-900/40 text-zinc-500 hover:text-red-600 rounded-xl transition-all shadow-sm border border-zinc-200 dark:border-zinc-700/50">
                                    <X size={18} />
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* --- BODY --- */}
                    <div className="overflow-y-auto flex-1 p-4 sm:p-5 custom-scrollbar bg-zinc-50/50 dark:bg-black/20">

                        {/* 1. SEÇÃO HERO */}
                        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 mb-6 items-stretch">

                            {/* Gráfico Donut (Ocupa 8 colunas) */}
                            <div className="lg:col-span-8 bg-white dark:bg-zinc-900 rounded-2xl p-4 border border-zinc-200/50 dark:border-zinc-800 shadow-sm flex flex-col items-center justify-center relative min-h-[220px]">
                                {data.stats.totalMinutes > 0 ? (
                                     <AdvancedChart
                                        data={data.tabelaAssuntos}
                                        totalMinutes={data.stats.totalMinutes}
                                     />
                                ) : (
                                    <div className="flex flex-col items-center justify-center py-8 opacity-50">
                                        <Clock size={40} className="mb-2 text-zinc-300 dark:text-zinc-600" />
                                        <span className="text-xs font-bold uppercase tracking-widest text-zinc-400">Sem dados</span>
                                    </div>
                                )}
                            </div>

                            {/* Cards KPIs (Ocupa 4 colunas) */}
                            <div className="lg:col-span-4 flex flex-col gap-3 h-full justify-center">
                                {/* Tempo */}
                                <MiniStatBox
                                    label="Tempo Estudado"
                                    value={formatTime(data.stats.totalMinutes)}
                                    icon={Clock}
                                    colorClass="text-blue-500"
                                />

                                {/* Questões Duplo (Total + Acertos) */}
                                <QuestionsDualCard
                                    total={data.stats.totalQuestions}
                                    correct={data.stats.totalCorrect}
                                />

                                {/* Precisão */}
                                <div className={`flex items-center justify-between p-3 border rounded-xl shadow-sm ${
                                    data.stats.accuracy >= 70 ? "bg-emerald-50 dark:bg-emerald-900/10 border-emerald-200 dark:border-emerald-800" :
                                    "bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800"
                                }`}>
                                    <div className="flex flex-col">
                                        <span className={`text-[10px] font-bold uppercase tracking-wider mb-0.5 flex items-center gap-1.5 ${
                                            data.stats.accuracy >= 70 ? "text-emerald-600" : "text-zinc-400"
                                        }`}>
                                            <Target size={10} /> Precisão
                                        </span>
                                        <span className="text-lg font-black text-zinc-900 dark:text-white leading-none">
                                            {data.stats.accuracy}%
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* 2. LISTA DE TÓPICOS */}
                        <div className="flex flex-col gap-3">
                            <div className="flex items-center justify-between px-1">
                                <h3 className="text-xs font-black text-zinc-500 uppercase tracking-widest flex items-center gap-2">
                                    <List size={14} /> Detalhamento por Tópico
                                </h3>
                                <div className="flex gap-2">
                                    <span className="text-[9px] font-bold bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 px-2 py-1 rounded text-zinc-400">
                                        {data.tabelaAssuntos.length} Exibidos
                                    </span>
                                </div>
                            </div>

                            <div className="bg-white dark:bg-zinc-900 border border-zinc-200/60 dark:border-zinc-800 rounded-2xl overflow-hidden shadow-sm">
                                <div className="divide-y divide-zinc-100 dark:divide-zinc-800/50">
                                    {data.tabelaAssuntos.map((assunto, idx) => (
                                        <div key={idx} className="px-4 py-3 flex flex-col sm:flex-row justify-between sm:items-center gap-2 hover:bg-zinc-50 dark:hover:bg-zinc-800/30 transition-colors group">
                                            {/* Lado Esquerdo: Nome */}
                                            <div className="flex items-start gap-2 min-w-0 flex-1">
                                                <div className={`mt-1.5 w-1.5 h-1.5 rounded-full shrink-0 ${assunto.hasData ? 'bg-indigo-500' : 'bg-zinc-300 dark:bg-zinc-600'}`}></div>
                                                <span className={`text-xs sm:text-sm font-bold leading-snug break-words ${assunto.hasData ? 'text-zinc-700 dark:text-zinc-200' : 'text-zinc-400'}`}>
                                                    {assunto.nome}
                                                </span>
                                            </div>

                                            {/* Lado Direito: Métricas */}
                                            <MetricsDisplay
                                                time={assunto.tempo}
                                                questions={assunto.questoes}
                                                correct={assunto.acertos}
                                            />
                                        </div>
                                    ))}

                                    {data.tabelaAssuntos.length === 0 && (
                                        <div className="p-8 text-center">
                                            <p className="text-zinc-400 text-xs font-bold uppercase tracking-wider">
                                                {viewMode === 'cycle'
                                                    ? "Nenhum histórico de estudo encontrado."
                                                    : "Nenhum assunto cadastrado."}
                                            </p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                    </div>
                </motion.div>
            </motion.div>
        </AnimatePresence>
    );
}

export default DisciplinaDetalheModal;