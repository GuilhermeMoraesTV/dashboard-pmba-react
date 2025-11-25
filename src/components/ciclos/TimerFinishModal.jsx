import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { CheckCircle2, XCircle, Target, Save, Clock, HelpCircle, Plus, Minus, BookOpen } from 'lucide-react';

function TimerFinishModal({ timeMinutes, disciplinaNome, onConfirm, onCancel }) {
  const [step, setStep] = useState(1); // 1: Pergunta, 2: Detalhes
  const [hasQuestions, setHasQuestions] = useState(null);
  const [questionsData, setQuestionsData] = useState({ total: 0, correct: 0 });

  const formatTime = (min) => {
    const h = Math.floor(min / 60);
    const m = min % 60;
    if (h > 0) return `${h}h ${m}m`;
    return `${m}m`;
  };

  const handleNext = (didQuestions) => {
    setHasQuestions(didQuestions);
    if (didQuestions) {
      setStep(2);
    } else {
      onConfirm({ questions: 0, correct: 0 });
    }
  };

  const handleValueChange = (field, amount) => {
    setQuestionsData(prev => {
      const newValue = Math.max(0, Number(prev[field]) + amount);
      if (field === 'total') {
         return { ...prev, total: newValue, correct: Math.min(prev.correct, newValue) };
      }
      if (field === 'correct') {
         return { ...prev, correct: Math.min(newValue, prev.total) };
      }
      return prev;
    });
  };

  const handleInputChange = (field, value) => {
      const numValue = parseInt(value) || 0;
      setQuestionsData(prev => {
          if (field === 'total') {
              return { ...prev, total: numValue, correct: Math.min(prev.correct, numValue) };
          }
          if (field === 'correct') {
              return { ...prev, correct: Math.min(numValue, prev.total) };
          }
          return prev;
      });
  };

  const handleSubmitQuestions = (e) => {
    e.preventDefault();
    onConfirm({
      questions: parseInt(questionsData.total) || 0,
      correct: parseInt(questionsData.correct) || 0
    });
  };

  // Componente Reutilizável de Input
  const NumberInputControl = ({ label, value, onChange, onIncrement, onDecrement, icon: Icon, colorClass }) => (
    <div>
        <label className="block text-xs font-bold text-zinc-400 uppercase tracking-widest mb-2 ml-1">{label}</label>
        <div className="flex items-center gap-2 bg-zinc-50 dark:bg-zinc-900 p-1 rounded-xl border border-zinc-200 dark:border-zinc-700 focus-within:ring-2 focus-within:ring-emerald-500 transition-all">
            <button
                type="button"
                onClick={onDecrement}
                className="p-3 rounded-lg text-zinc-400 hover:text-red-500 hover:bg-zinc-200 dark:hover:bg-zinc-800 transition-colors active:scale-95"
            >
                <Minus size={18} />
            </button>

            <div className="flex-1 relative">
                <Icon className={`absolute left-0 top-1/2 -translate-y-1/2 ${colorClass}`} size={18} />
                <input
                    type="number"
                    min="0"
                    value={value === 0 ? '' : value}
                    onChange={(e) => onChange(e.target.value)}
                    placeholder="0"
                    className="w-full bg-transparent text-center font-black text-xl text-zinc-800 dark:text-white outline-none p-1 pl-6"
                />
            </div>

            <button
                type="button"
                onClick={onIncrement}
                className="p-3 rounded-lg text-zinc-400 hover:text-emerald-500 hover:bg-zinc-200 dark:hover:bg-zinc-800 transition-colors active:scale-95"
            >
                <Plus size={18} />
            </button>
        </div>
    </div>
  );

  return (
    <div className="fixed inset-0 z-[10000] bg-black/90 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.9 }}
        className="bg-white dark:bg-zinc-950 w-full max-w-md rounded-3xl shadow-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden relative"
      >
        {/* Cabeçalho Visual (COM DISCIPLINA) */}
        <div className="bg-zinc-50 dark:bg-zinc-900/50 p-6 border-b border-zinc-100 dark:border-zinc-800">
          <div className="flex items-center justify-between mb-3">
             <div className="flex items-center gap-3">
                <div className="p-2 bg-emerald-100 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-500 rounded-xl">
                  <CheckCircle2 size={24} />
                </div>
                <h2 className="text-lg font-black text-zinc-800 dark:text-white uppercase tracking-tight">Sessão Finalizada</h2>
             </div>
             <div className="text-right">
                <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">Tempo Total</span>
                <span className="text-xl font-black text-emerald-600 dark:text-emerald-400">{formatTime(timeMinutes)}</span>
             </div>
          </div>

          {/* Badge da Disciplina */}
          <div className="flex items-center gap-2 bg-white dark:bg-zinc-800 p-3 rounded-xl border border-zinc-200 dark:border-zinc-700 shadow-sm">
             <BookOpen size={18} className="text-zinc-400" />
             <span className="font-bold text-zinc-700 dark:text-zinc-200 truncate">{disciplinaNome || "Estudo Livre"}</span>
          </div>
        </div>

        <div className="p-6">
          {step === 1 ? (
            <div className="space-y-6">
              <div className="text-center">
                <HelpCircle size={48} className="mx-auto text-zinc-300 mb-4" />
                <h3 className="text-xl font-bold text-zinc-800 dark:text-white mb-2">Resolveu questões?</h3>
                <p className="text-zinc-500 text-sm">Registre seu desempenho para alimentar as estatísticas.</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <button
                  onClick={() => handleNext(false)}
                  className="flex flex-col items-center justify-center gap-2 p-4 rounded-2xl border-2 border-zinc-100 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-all group"
                >
                  <XCircle size={32} className="text-zinc-400 group-hover:text-red-500 transition-colors" />
                  <span className="font-bold text-zinc-600 dark:text-zinc-400">Apenas Estudo</span>
                </button>

                <button
                  onClick={() => handleNext(true)}
                  className="flex flex-col items-center justify-center gap-2 p-4 rounded-2xl border-2 border-emerald-100 dark:border-emerald-900/30 bg-emerald-50/50 dark:bg-emerald-900/10 hover:border-emerald-500 hover:shadow-lg hover:shadow-emerald-500/20 transition-all group"
                >
                  <Target size={32} className="text-emerald-500 group-hover:scale-110 transition-transform" />
                  <span className="font-bold text-emerald-700 dark:text-emerald-400">Sim, resolvi!</span>
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmitQuestions} className="space-y-6">
              <div className="space-y-4">
                <NumberInputControl
                    label="Total de Questões"
                    value={questionsData.total}
                    onChange={(val) => handleInputChange('total', val)}
                    onIncrement={() => handleValueChange('total', 1)}
                    onDecrement={() => handleValueChange('total', -1)}
                    icon={Target}
                    colorClass="text-zinc-400"
                />
                <NumberInputControl
                    label="Acertos"
                    value={questionsData.correct}
                    onChange={(val) => handleInputChange('correct', val)}
                    onIncrement={() => handleValueChange('correct', 1)}
                    onDecrement={() => handleValueChange('correct', -1)}
                    icon={CheckCircle2}
                    colorClass="text-emerald-500"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="px-4 py-3 rounded-xl font-bold text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                >
                  Voltar
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold shadow-lg shadow-emerald-600/20 transition-all transform hover:-translate-y-0.5 active:translate-y-0 flex items-center justify-center gap-2"
                >
                  <Save size={20} /> Salvar Sessão
                </button>
              </div>
            </form>
          )}
        </div>
      </motion.div>
    </div>
  );
}

export default TimerFinishModal;