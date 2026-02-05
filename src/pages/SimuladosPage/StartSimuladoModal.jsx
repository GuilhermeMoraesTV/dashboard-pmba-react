import React, { useState, useEffect } from 'react';
import { ClipboardList, X, Pencil, Clock, Hourglass, Play, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const StartSimuladoModal = ({ isOpen, onClose, onStart }) => {
  const [titulo, setTitulo] = useState('');
  const [mode, setMode] = useState('free');
  const [hours, setHours] = useState('04');
  const [minutes, setMinutes] = useState('00');

  // State para controle de erro
  const [error, setError] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setTitulo('');
      setMode('free');
      setHours('04');
      setMinutes('00');
      setError(false); // Reseta o erro ao abrir
    }
  }, [isOpen]);

  const handleStart = () => {
    // Validação: Se estiver vazio ou só tiver espaços
    if (!titulo.trim()) {
      setError(true);
      return;
    }

    let totalSeconds = 0;
    if (mode === 'countdown') {
      totalSeconds = (parseInt(hours || 0) * 3600) + (parseInt(minutes || 0) * 60);
      if (totalSeconds <= 0) return alert("Defina um tempo válido para o cronômetro.");
    }

    onStart({ titulo, mode, totalSeconds });
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-zinc-900/60 backdrop-blur-md animate-fade-in font-sans">
      <motion.div
        initial={{ scale: 0.9, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.9, opacity: 0, y: 20 }}
        transition={{ type: "spring", duration: 0.5 }}
        className="bg-white dark:bg-zinc-950 rounded-3xl shadow-2xl border border-zinc-200 dark:border-zinc-800 w-full max-w-md overflow-hidden relative"
      >
        {/* Header Vermelho */}
        <div className="relative bg-red-600 pt-8 pb-8 px-6 overflow-hidden">
          <div className="absolute -right-6 -bottom-8 opacity-20 transform -rotate-12 pointer-events-none">
            <ClipboardList size={140} className="text-white" />
          </div>
          <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-b from-white/10 to-transparent pointer-events-none" />
          <div className="relative z-10 flex justify-between items-start">
            <div>
              <div className="flex items-center gap-2 text-white/90 mb-1">
                <span className="bg-white/20 backdrop-blur-sm px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest border border-white/10">Modo Prova</span>
              </div>
              <h3 className="text-2xl font-black text-white tracking-tight">Iniciar Simulado</h3>
              <p className="text-red-100 text-xs font-medium mt-1 max-w-[80%]">Prepare o ambiente, desligue as distrações e boa prova.</p>
            </div>
            <button onClick={onClose} className="text-white/70 hover:text-white bg-white/10 hover:bg-white/20 rounded-full p-2 transition-colors backdrop-blur-sm">
              <X size={20} />
            </button>
          </div>
        </div>

        <div className="p-6 space-y-6">

          {/* Campo Título com Validação */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-zinc-500 uppercase tracking-wide ml-1">Título do Simulado</label>

            {/* CORREÇÃO AQUI:
                Mudamos type: "spring" para type: "tween"
                porque estamos usando keyframes (array de valores).
            */}
            <motion.div
              animate={error ? { x: [-10, 10, -10, 10, 0] } : {}}
              transition={{ duration: 0.4, type: "tween" }}
              className="relative"
            >
              <input
                autoFocus
                value={titulo}
                onChange={e => {
                  setTitulo(e.target.value);
                  if (error) setError(false); // Limpa o erro assim que digitar
                }}
                className={`w-full p-4 pl-4 rounded-2xl border-2 outline-none font-bold text-zinc-800 dark:text-white transition-all shadow-sm text-sm
                  ${error
                    ? 'border-red-500 bg-red-50 dark:bg-red-900/10 focus:border-red-600 placeholder:text-red-300'
                    : 'bg-zinc-50 dark:bg-zinc-900 border-zinc-100 dark:border-zinc-800 focus:border-red-500'
                  }`}
                placeholder="Ex: Simulado PMBA - Estratégia 01"
              />

              <div className={`absolute right-4 top-1/2 -translate-y-1/2 transition-colors ${error ? 'text-red-500' : 'text-zinc-400'}`}>
                {error ? <AlertCircle size={20} /> : <Pencil size={16} />}
              </div>
            </motion.div>

            {/* Mensagem de Erro Explícita */}
            <AnimatePresence>
              {error && (
                <motion.div
                  key="error-msg"
                  initial={{ opacity: 0, y: -10, height: 0 }}
                  animate={{ opacity: 1, y: 0, height: 'auto' }}
                  exit={{ opacity: 0, y: -10, height: 0 }}
                  className="flex items-center gap-2 pt-1 ml-1"
                >
                  <AlertCircle size={12} className="text-red-600 dark:text-red-400" strokeWidth={3} />
                  <span className="text-[10px] font-black uppercase tracking-wide text-red-600 dark:text-red-400">
                    O nome do simulado é obrigatório
                  </span>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Seleção de Modo */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-zinc-500 uppercase tracking-wide ml-1">Controle de Tempo</label>
            <div className="grid grid-cols-2 gap-3">
              <button onClick={() => setMode('free')} className={`relative p-4 rounded-2xl border-2 transition-all flex flex-col items-center justify-center gap-2 group ${mode === 'free' ? 'border-red-500 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 shadow-lg shadow-red-500/10' : 'border-zinc-100 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-400 hover:border-red-200 dark:hover:border-red-900/50 hover:bg-zinc-50'}`}>
                <div className={`p-2 rounded-full transition-colors ${mode === 'free' ? 'bg-red-100 dark:bg-red-500/20' : 'bg-zinc-100 dark:bg-zinc-800 group-hover:bg-red-50'}`}><Clock size={24} className={mode === 'free' ? 'text-red-600' : 'text-zinc-400 group-hover:text-red-500'} /></div>
                <span className="text-xs font-bold uppercase tracking-wide">Tempo Livre</span>
                {mode === 'free' && (<div className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full animate-pulse" />)}
              </button>
              <button onClick={() => setMode('countdown')} className={`relative p-4 rounded-2xl border-2 transition-all flex flex-col items-center justify-center gap-2 group ${mode === 'countdown' ? 'border-red-500 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 shadow-lg shadow-red-500/10' : 'border-zinc-100 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-400 hover:border-red-200 dark:hover:border-red-900/50 hover:bg-zinc-50'}`}>
                <div className={`p-2 rounded-full transition-colors ${mode === 'countdown' ? 'bg-red-100 dark:bg-red-500/20' : 'bg-zinc-100 dark:bg-zinc-800 group-hover:bg-red-50'}`}><Hourglass size={24} className={mode === 'countdown' ? 'text-red-600' : 'text-zinc-400 group-hover:text-red-500'} /></div>
                <span className="text-xs font-bold uppercase tracking-wide">Cronômetro</span>
                {mode === 'countdown' && (<div className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full animate-pulse" />)}
              </button>
            </div>
          </div>

          {/* Configuração do Cronômetro */}
          <AnimatePresence>
            {mode === 'countdown' && (
              <motion.div initial={{ opacity: 0, height: 0, marginTop: 0 }} animate={{ opacity: 1, height: 'auto', marginTop: 16 }} exit={{ opacity: 0, height: 0, marginTop: 0 }} className="overflow-hidden">
                <div className="p-5 bg-zinc-50 dark:bg-zinc-900/50 rounded-2xl border border-zinc-200 dark:border-zinc-800 flex flex-col items-center">
                  <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-3">Tempo Limite de Prova</label>
                  <div className="flex items-center gap-4">
                    <div className="flex flex-col items-center">
                      <input type="number" value={hours} onChange={e => setHours(e.target.value)} className="w-20 h-20 text-center text-4xl font-black bg-white dark:bg-zinc-900 rounded-2xl border-2 border-zinc-200 dark:border-zinc-700 focus:border-red-500 focus:ring-4 focus:ring-red-500/10 outline-none transition-all shadow-sm text-zinc-800 dark:text-white" placeholder="04" />
                      <span className="text-[10px] font-bold text-zinc-400 mt-2 uppercase">Horas</span>
                    </div>
                    <span className="text-4xl font-black text-zinc-300 -mt-6">:</span>
                    <div className="flex flex-col items-center">
                      <input type="number" value={minutes} onChange={e => setMinutes(e.target.value)} className="w-20 h-20 text-center text-4xl font-black bg-white dark:bg-zinc-900 rounded-2xl border-2 border-zinc-200 dark:border-zinc-700 focus:border-red-500 focus:ring-4 focus:ring-red-500/10 outline-none transition-all shadow-sm text-zinc-800 dark:text-white" placeholder="00" />
                      <span className="text-[10px] font-bold text-zinc-400 mt-2 uppercase">Minutos</span>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <button onClick={handleStart} className="w-full py-4 rounded-2xl bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 text-white font-bold shadow-xl shadow-red-600/20 hover:shadow-red-600/30 hover:-translate-y-0.5 active:translate-y-0 transition-all flex items-center justify-center gap-3 text-sm uppercase tracking-wide">
            <Play size={20} fill="currentColor" /> Começar Agora
          </button>
        </div>
      </motion.div>
    </div>
  );
};

export default StartSimuladoModal;