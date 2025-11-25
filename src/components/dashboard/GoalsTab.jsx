import React, { useState, useEffect, useMemo } from 'react';
import {
  Target, Clock, Trophy, Plus, Minus, Save, History,
  Shield, Zap, Calendar, BarChart3, CheckCircle2, RotateCcw, Trash2
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// --- COMPONENTE DE CONTROLE (INPUT) ---
const ControlCard = ({ label, value, onChange, icon: Icon, unit, step, min, max, colorClass }) => {
  return (
    <div className="bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-700/50 rounded-xl p-4 relative overflow-hidden group transition-all hover:border-zinc-300 dark:hover:border-zinc-600">
      <div className="relative z-10 flex justify-between items-center mb-4">
        <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-500 flex items-center gap-2">
          <Icon size={14} className={colorClass} /> {label}
        </h3>
        <span className={`text-2xl font-black ${colorClass}`}>
          {value} <span className="text-sm font-bold text-zinc-400">{unit}</span>
        </span>
      </div>

      <div className="relative z-10 flex items-center gap-3 bg-white dark:bg-zinc-950 p-1.5 rounded-lg border border-zinc-200 dark:border-zinc-800 shadow-inner">
        <button
          onClick={() => onChange(-step)}
          className="p-3 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-400 hover:text-red-500 transition-colors active:scale-95"
        >
          <Minus size={16} />
        </button>

        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(Number(e.target.value) - value)}
          className="flex-1 h-2 bg-zinc-200 dark:bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-red-600"
        />

        <button
          onClick={() => onChange(step)}
          className="p-3 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-400 hover:text-emerald-500 transition-colors active:scale-95"
        >
          <Plus size={16} />
        </button>
      </div>

      <div className={`absolute -bottom-4 -right-4 opacity-5 group-hover:opacity-10 transition-opacity transform rotate-12 ${colorClass}`}>
        <Icon size={80} />
      </div>
    </div>
  );
};

function GoalsTab({ onSetGoal, goalsHistory, onDeleteGoal }) {
  const currentGoal = goalsHistory && goalsHistory[0];
  const [questionsGoal, setQuestionsGoal] = useState(0);
  const [hoursGoal, setHoursGoal] = useState(0);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (currentGoal) {
      setQuestionsGoal(currentGoal.questions || 0);
      setHoursGoal(currentGoal.hours || 0);
    }
  }, [currentGoal]);

  const stats = useMemo(() => {
    const weeklyHours = hoursGoal * 7;
    const monthlyHours = hoursGoal * 30;
    const weeklyQuestions = questionsGoal * 7;
    const monthlyQuestions = questionsGoal * 30;

    let level = { label: 'MANUTENÇÃO', color: 'text-blue-500', border: 'border-blue-500', bg: 'bg-blue-500' };
    if (hoursGoal >= 2) level = { label: 'OPERACIONAL', color: 'text-emerald-500', border: 'border-emerald-500', bg: 'bg-emerald-500' };
    if (hoursGoal >= 4) level = { label: 'INTENSIVO', color: 'text-amber-500', border: 'border-amber-500', bg: 'bg-amber-500' };
    if (hoursGoal >= 6) level = { label: 'ELITE', color: 'text-red-600', border: 'border-red-600', bg: 'bg-red-600' };
    if (hoursGoal >= 8) level = { label: 'INSANO', color: 'text-purple-600', border: 'border-purple-600', bg: 'bg-purple-600' };

    return { weeklyHours, monthlyHours, weeklyQuestions, monthlyQuestions, level };
  }, [hoursGoal, questionsGoal]);

  const handleSubmit = async (e) => {
    if(e) e.preventDefault();
    setIsLoading(true);
    try {
      await onSetGoal({
        questions: parseInt(questionsGoal, 10),
        hours: parseFloat(hoursGoal)
      });
    } catch (error) {
      console.error("Erro ao salvar meta:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleReactivate = (goal) => {
      setQuestionsGoal(goal.questions || 0);
      setHoursGoal(goal.hours || 0);
      window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleQuestionsChange = (amount) => {
    setQuestionsGoal(q => Math.max(0, (parseInt(q, 10) || 0) + amount));
  };
  const handleHoursChange = (amount) => {
    setHoursGoal(h => Math.max(0, parseFloat(((parseFloat(h) || 0) + amount).toFixed(1))));
  };

  return (
    <div className="animate-fade-in space-y-8 pb-12">

      {/* --- CABEÇALHO INTERNO DA PÁGINA (PADRONIZADO) --- */}
      <div className="mb-8 border-b border-zinc-200 dark:border-zinc-800 pb-6">
        <div className="flex items-center gap-3 mb-2">
            <div className="p-2.5 bg-red-100 dark:bg-red-900/20 text-red-600 dark:text-red-500 rounded-xl">
                <Target size={28} strokeWidth={2} />
            </div>
            <h1 className="text-3xl font-black text-zinc-800 dark:text-white tracking-tight uppercase">
                Estratégia & Metas
            </h1>
        </div>

      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white dark:bg-zinc-950 rounded-2xl shadow-xl border border-zinc-200 dark:border-zinc-800 p-6 relative overflow-hidden">
              <div className={`absolute left-0 top-0 bottom-0 w-1.5 ${stats.level.bg}`}></div>

              <div className="flex justify-between items-center mb-6 pl-2">
                  <h2 className="text-lg font-bold text-zinc-800 dark:text-white flex items-center gap-2">
                      <Zap size={18} className="text-amber-500" /> Configuração Diária
                  </h2>
                  <span className={`px-3 py-1 rounded-full text-[10px] font-black border ${stats.level.color} ${stats.level.border} bg-opacity-10 bg-zinc-100 dark:bg-zinc-900 uppercase tracking-wide`}>
                      NÍVEL: {stats.level.label}
                  </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <ControlCard
                      label="Meta de Horas"
                      value={hoursGoal}
                      unit="h/dia"
                      icon={Clock}
                      onChange={handleHoursChange}
                      step={0.5} min={0} max={16}
                      colorClass="text-amber-500"
                  />
                  <ControlCard
                      label="Meta de Questões"
                      value={questionsGoal}
                      unit="q/dia"
                      icon={Target}
                      onChange={handleQuestionsChange}
                      step={5} min={0} max={200}
                      colorClass="text-emerald-500"
                  />
              </div>

              <div className="mt-8 p-5 bg-zinc-50 dark:bg-zinc-900/30 rounded-xl border border-zinc-200 dark:border-zinc-800">
                  <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                      <BarChart3 size={14} /> Projeção de Impacto
                  </h3>
                  <div className="grid grid-cols-2 gap-4">
                      <div className="flex items-center justify-between p-3 bg-white dark:bg-zinc-950 rounded-lg border border-zinc-200 dark:border-zinc-800/50">
                          <div>
                              <p className="text-[10px] text-zinc-400 font-bold uppercase">Semanal</p>
                              <p className="text-xs font-medium text-zinc-600 dark:text-zinc-400">Consistência</p>
                          </div>
                          <div className="text-right">
                              <p className="text-lg font-black text-zinc-800 dark:text-white">{stats.weeklyHours.toFixed(1)}h</p>
                              <p className="text-xs font-bold text-emerald-500">{stats.weeklyQuestions} qst</p>
                          </div>
                      </div>
                      <div className="flex items-center justify-between p-3 bg-white dark:bg-zinc-950 rounded-lg border border-zinc-200 dark:border-zinc-800/50">
                          <div>
                              <p className="text-[10px] text-zinc-400 font-bold uppercase">Mensal</p>
                              <p className="text-xs font-medium text-zinc-600 dark:text-zinc-400">Evolução</p>
                          </div>
                          <div className="text-right">
                              <p className="text-lg font-black text-zinc-800 dark:text-white">{stats.monthlyHours.toFixed(1)}h</p>
                              <p className="text-xs font-bold text-emerald-500">{stats.monthlyQuestions} qst</p>
                          </div>
                      </div>
                  </div>
              </div>

              <div className="mt-6 flex justify-end">
                  <button
                    onClick={handleSubmit}
                    disabled={isLoading}
                    className="group relative px-8 py-4 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold shadow-xl hover:shadow-red-900/20 transition-all transform hover:-translate-y-1 active:translate-y-0 flex items-center gap-3 overflow-hidden disabled:opacity-70 disabled:cursor-not-allowed"
                  >
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700"></div>
                    {isLoading ? 'Salvando...' : (
                        <>
                            <Save size={20} />
                            <span className="uppercase tracking-wide">Confirmar Nova Meta</span>
                        </>
                    )}
                  </button>
              </div>
          </div>
        </div>

        <div className="lg:col-span-1">
           <div className="bg-white dark:bg-zinc-950 rounded-2xl shadow-xl border border-zinc-200 dark:border-zinc-800 p-6 h-full flex flex-col relative overflow-hidden">
             <div className="absolute -top-10 -right-10 text-zinc-100 dark:text-zinc-900 pointer-events-none transform -rotate-12">
                <History size={150} strokeWidth={1} />
            </div>

            <div className="flex items-center justify-between mb-6 relative z-10">
                <h2 className="text-lg font-bold text-zinc-800 dark:text-white flex items-center gap-2">
                  <History size={20} className="text-red-500" /> Histórico
                </h2>
                <span className="text-[10px] font-black text-zinc-400 bg-zinc-100 dark:bg-zinc-900 px-2 py-1 rounded uppercase tracking-wide">
                    Registro
                </span>
            </div>

            <div className="space-y-3 flex-1 overflow-y-auto pr-2 custom-scrollbar max-h-[600px] relative z-10">
              {goalsHistory && goalsHistory.length > 0 ? (
                goalsHistory.map((goal, index) => {
                  const isActive = index === 0;
                  const date = new Date(goal.startDate?.includes('-') ? goal.startDate + 'T03:00:00' : (goal.timestamp?.toDate() || goal.startDate));

                  return (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.05 }}
                      key={goal.id}
                      className={`
                        relative p-4 rounded-xl border transition-all duration-300 group
                        ${isActive
                            ? 'bg-red-50 dark:bg-red-900/10 border-red-500/30 shadow-sm'
                            : 'bg-zinc-50 dark:bg-zinc-900/50 border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700'
                        }
                      `}
                    >
                      <div className="flex justify-between items-start mb-3">
                        <div>
                            <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 mb-0.5">DATA DE INÍCIO</p>
                            <p className="text-xs font-mono text-zinc-600 dark:text-zinc-300 font-bold flex items-center gap-1">
                              <Calendar size={12} /> {date.toLocaleDateString('pt-BR')}
                            </p>
                        </div>

                        {isActive ? (
                          <span className="text-[9px] font-black bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400 py-1 px-2 rounded flex items-center gap-1">
                            <CheckCircle2 size={10} /> ATIVA
                          </span>
                        ) : (
                            <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button
                                    onClick={() => {
                                        if(window.confirm("Tem certeza que deseja excluir este registro de meta do histórico?")) {
                                            onDeleteGoal(goal.id);
                                        }
                                    }}
                                    className="p-1.5 rounded-md bg-zinc-200 dark:bg-zinc-800 text-zinc-400 hover:text-red-500 hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors"
                                    title="Excluir Registro"
                                >
                                    <Trash2 size={14} />
                                </button>

                                <button
                                    onClick={() => handleReactivate(goal)}
                                    className="text-[9px] font-bold bg-white dark:bg-zinc-800 text-indigo-500 border border-indigo-200 dark:border-indigo-900 py-1.5 px-2 rounded flex items-center gap-1 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 shadow-sm"
                                >
                                    <RotateCcw size={10} /> USAR
                                </button>
                            </div>
                        )}
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                          <div className="flex flex-col items-center bg-white dark:bg-zinc-950 p-2 rounded-lg border border-zinc-100 dark:border-zinc-800">
                              <span className="text-[10px] text-zinc-400 font-bold uppercase">Horas</span>
                              <span className="text-sm font-black text-zinc-800 dark:text-white">{goal.hours || 0}h</span>
                          </div>
                          <div className="flex flex-col items-center bg-white dark:bg-zinc-950 p-2 rounded-lg border border-zinc-100 dark:border-zinc-800">
                              <span className="text-[10px] text-zinc-400 font-bold uppercase">Questões</span>
                              <span className="text-sm font-black text-zinc-800 dark:text-white">{goal.questions || 0}q</span>
                          </div>
                      </div>
                    </motion.div>
                  );
                })
              ) : (
                <div className="text-center py-10 text-zinc-400">
                    <Shield size={40} className="mx-auto mb-2 opacity-20" />
                    <p className="text-sm">Nenhuma estratégia definida.</p>
                </div>
              )}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}

export default GoalsTab;