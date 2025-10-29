import React, { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';

// --- Ícones ---
const IconStop = () => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6">
      <path fillRule="evenodd" d="M4.5 7.5a3 3 0 0 1 3-3h9a3 3 0 0 1 3 3v9a3 3 0 0 1-3 3h-9a3 3 0 0 1-3-3v-9Z" clipRule="evenodd" />
    </svg>
);
const IconCancel = () => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
    </svg>
);
const IconPlay = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
    <path fillRule="evenodd" d="M4.5 5.653c0-1.426 1.529-2.33 2.779-1.643l11.54 6.348c1.295.712 1.295 2.573 0 3.285L7.28 19.99c-1.25.687-2.779-.217-2.779-1.643V5.653Z" clipRule="evenodd" />
  </svg>
);


// --- Helper para formatar o tempo ---
const formatTime = (totalSeconds) => {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  return [
    hours,
    minutes,
    seconds
  ]
  .map(v => String(v).padStart(2, '0'))
  .join(':');
};

function StudyTimer({ disciplina, onStop, onCancel }) {
  const [seconds, setSeconds] = useState(0);
  const startTime = useMemo(() => Date.now(), []);

  useEffect(() => {
    const interval = setInterval(() => {
      setSeconds(Math.floor((Date.now() - startTime) / 1000));
    }, 1000);

    return () => clearInterval(interval);
  }, [startTime]);

  const handleStop = () => {
    const totalMinutos = Math.max(1, Math.round(seconds / 60)); // Arredonda e garante pelo menos 1 min
    onStop(totalMinutos);
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.3, ease: 'easeInOut' }}
      className="relative w-full h-full min-h-[450px] flex flex-col items-center justify-center bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-800 rounded-xl shadow-lg p-6 overflow-hidden"
    >
        {/* Fundo animado */}
        <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)', backgroundSize: '40px 40px' }}></div>
        <div className="absolute inset-0 bg-black/10 backdrop-blur-sm"></div>

        {/* Círculo Pulsante */}
        <motion.div
            animate={{ scale: [1, 1.05, 1] }}
            transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
            className="absolute w-64 h-64 bg-white/5 rounded-full"
        ></motion.div>
        <motion.div
            animate={{ scale: [1, 1.1, 1] }}
            transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut', delay: 0.5 }}
            className="absolute w-80 h-80 bg-white/5 rounded-full"
        ></motion.div>


        <div className="relative z-10 flex flex-col items-center justify-center text-white text-center">

            <p className="text-lg font-semibold text-white/80">Estudando</p>
            <h2 className="text-3xl font-bold text-white mb-4 truncate max-w-sm">
              {disciplina.nome}
            </h2>

            <div className="font-mono text-7xl font-bold my-6" style={{textShadow: '0 2px 10px rgba(0,0,0,0.2)'}}>
                {formatTime(seconds)}
            </div>

            <div className="flex gap-4">
                {/* Botão de Cancelar */}
                <button
                    onClick={onCancel}
                    title="Cancelar (não salva)"
                    className="flex items-center justify-center w-16 h-16 bg-white/20 hover:bg-white/30 backdrop-blur-lg rounded-full text-white transition-all duration-200 ease-in-out"
                >
                    <IconCancel />
                </button>

                {/* Botão de Parar */}
                <button
                    onClick={handleStop}
                    title="Parar e Registrar"
                    className="flex items-center justify-center w-20 h-20 bg-white hover:bg-gray-100 backdrop-blur-lg rounded-full text-danger-color shadow-lg transition-all duration-200 ease-in-out transform hover:scale-105"
                >
                    <IconStop />
                </button>
            </div>
        </div>
    </motion.div>
  );
}

export default StudyTimer;