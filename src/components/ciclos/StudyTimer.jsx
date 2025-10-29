import React, { useState, useEffect, useMemo, useRef } from 'react';
import { motion } from 'framer-motion';

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
const IconExpand = () => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9m5.25 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15" />
    </svg>
);
const IconMinimize = () => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 9V4.5M9 9H4.5M9 9 3.75 3.75M9 15v4.5M9 15H4.5M9 15l-5.25 5.25M15 9h4.5M15 9V4.5M15 9l5.25-5.25M15 15h4.5M15 15v4.5M15 15l5.25 5.25" />
    </svg>
);


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
  const [isFullscreen, setIsFullscreen] = useState(false);
  const timerRef = useRef(null);

  useEffect(() => {
    const interval = setInterval(() => {
      setSeconds(Math.floor((Date.now() - startTime) / 1000));
    }, 1000);

    const handleFullscreenChange = () => {
      setIsFullscreen(document.fullscreenElement != null);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);

    return () => {
      clearInterval(interval);
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, [startTime]);

  const handleStop = () => {
    const totalMinutos = Math.max(1, Math.round(seconds / 60));
    if (isFullscreen && document.fullscreenElement) {
        document.exitFullscreen();
    }
    onStop(totalMinutos);
  };

  const handleCancel = () => {
    if (isFullscreen && document.fullscreenElement) {
        document.exitFullscreen();
    }
    onCancel();
  };

  const toggleFullscreen = () => {
    if (!timerRef.current) return;

    if (!document.fullscreenElement) {
      timerRef.current.requestFullscreen()
        .then(() => setIsFullscreen(true))
        .catch(err => console.error(`Erro ao entrar em tela cheia: ${err.message}`));
    } else {
      document.exitFullscreen()
        .then(() => setIsFullscreen(false))
        .catch(err => console.error(`Erro ao sair da tela cheia: ${err.message}`));
    }
  };


  return (
    <motion.div
      ref={timerRef}
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.3, ease: 'easeInOut' }}
      className={`relative w-full h-full min-h-[450px] flex flex-col items-center justify-center bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-800 rounded-xl shadow-lg p-6 overflow-hidden
                 ${isFullscreen ? 'fixed inset-0 z-[100] rounded-none' : ''}`}
    >
        <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)', backgroundSize: '40px 40px' }}></div>
        <div className="absolute inset-0 bg-black/10 backdrop-blur-sm"></div>

        <motion.div
            animate={{ scale: [1, 1.05, 1] }}
            transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
            className="absolute w-64 h-64 bg-white/5 rounded-full pointer-events-none"
        ></motion.div>
        <motion.div
            animate={{ scale: [1, 1.1, 1] }}
            transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut', delay: 0.5 }}
            className="absolute w-80 h-80 bg-white/5 rounded-full pointer-events-none"
        ></motion.div>


        <div className="relative z-10 flex flex-col items-center justify-center text-white text-center">

            <p className="text-lg font-semibold text-white/80">Estudando</p>
            <h2 className={`text-3xl font-bold text-white mb-4 truncate max-w-sm ${isFullscreen ? 'md:text-4xl lg:text-5xl max-w-xl' : ''}`}>
              {disciplina.nome}
            </h2>

            <div className={`font-mono text-7xl font-bold my-6 ${isFullscreen ? 'md:text-8xl lg:text-9xl my-10' : ''}`} style={{textShadow: '0 2px 10px rgba(0,0,0,0.2)'}}>
                {formatTime(seconds)}
            </div>

            <div className={`flex gap-4 ${isFullscreen ? 'md:gap-6 lg:gap-8' : ''}`}>
                <button
                    onClick={handleCancel}
                    title="Cancelar (não salva)"
                    className={`flex items-center justify-center bg-white/20 hover:bg-white/30 backdrop-blur-lg rounded-full text-white transition-all duration-200 ease-in-out
                                ${isFullscreen ? 'w-20 h-20 md:w-24 md:h-24' : 'w-16 h-16'}`}
                >
                    <IconCancel className={`${isFullscreen ? 'w-8 h-8 md:w-10 md:h-10' : 'w-6 h-6'}`}/>
                </button>

                <button
                    onClick={handleStop}
                    title="Parar e Registrar"
                    className={`flex items-center justify-center bg-white hover:bg-gray-100 backdrop-blur-lg rounded-full text-danger-color shadow-lg transition-all duration-200 ease-in-out transform hover:scale-105
                                ${isFullscreen ? 'w-24 h-24 md:w-28 md:h-28' : 'w-20 h-20'}`}
                >
                    <IconStop className={`${isFullscreen ? 'w-10 h-10 md:w-12 md:h-12' : 'w-6 h-6'}`}/>
                </button>

                <button
                    onClick={toggleFullscreen}
                    title={isFullscreen ? 'Sair do Modo Foco' : 'Modo Foco'}
                    className={`flex items-center justify-center bg-white/20 hover:bg-white/30 backdrop-blur-lg rounded-full text-white transition-all duration-200 ease-in-out
                                ${isFullscreen ? 'w-20 h-20 md:w-24 md:h-24' : 'w-16 h-16'}`}
                >
                    {isFullscreen
                        ? <IconMinimize className={`${isFullscreen ? 'w-8 h-8 md:w-10 md:h-10' : 'w-6 h-6'}`}/>
                        : <IconExpand className={`${isFullscreen ? 'w-8 h-8 md:w-10 md:h-10' : 'w-6 h-6'}`}/>
                    }
                </button>
            </div>
        </div>
    </motion.div>
  );
}

export default StudyTimer;