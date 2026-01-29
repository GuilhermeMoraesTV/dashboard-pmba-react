import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Link, useNavigate } from 'react-router-dom';
import { Wifi, WifiOff, Home, ArrowLeft, RefreshCw, AlertCircle } from 'lucide-react';

function NotFoundPage() {
  const navigate = useNavigate();
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  // Monitoramento de Rede em Tempo Real
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const handleReload = () => {
    window.location.reload();
  };

  return (
    <div className="flex min-h-screen bg-[#050505] relative overflow-hidden font-sans items-center justify-center p-4">

      {/* 1. BACKGROUND (Imagem do Login Nítida) */}
      <div className="absolute inset-0 z-0">
        <img
          src="/imagem-login.png"
          alt="Background"
          className="w-full h-full object-cover object-top"
        />
        {/* Overlay escuro para contraste do texto */}
        <div className="absolute inset-0 bg-black/60 backdrop-blur-[2px]"></div>

        {/* Grid sutil animado */}
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:40px_40px] opacity-20"></div>
      </div>

      {/* 2. CARD PRINCIPAL */}
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        className="w-full max-w-[480px] relative z-10"
      >
        {/* Borda brilhante animada (MUDADO DE VERMELHO PARA NEUTRO/BRANCO SUTIL) */}
        <div className="absolute -inset-0.5 bg-gradient-to-r from-zinc-700/50 to-white/20 rounded-[2rem] opacity-30 blur-md"></div>

        <div className="bg-black/70 backdrop-blur-xl border border-white/10 rounded-[1.8rem] p-8 md:p-10 shadow-2xl relative overflow-hidden">

          {/* Status da Rede (Badge Flutuante) */}
          <div className={`absolute top-6 right-6 flex items-center gap-2 px-3 py-1.5 rounded-full border text-[10px] font-black uppercase tracking-widest transition-colors duration-500 ${
            isOnline
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-500'
              : 'bg-red-500/10 border-red-500/30 text-red-500 animate-pulse' // Mantive vermelho só aqui pois é um alerta funcional
          }`}>
            {isOnline ? <Wifi size={12} /> : <WifiOff size={12} />}
            {isOnline ? 'Online' : 'Offline'}
          </div>

          {/* Logo */}
          <div className="flex justify-center mb-8">
            <img src="/logo-pmba.png" alt="Logo" className="h-16 w-auto drop-shadow-xl opacity-90" />
          </div>

          {/* 404 GIGANTE (MUDADO GLITCH DE VERMELHO PARA CINZA) */}
          <div className="relative flex justify-center items-center mb-2 select-none">
            <h1 className="text-[8rem] md:text-[9rem] font-black leading-none tracking-tighter text-transparent bg-clip-text bg-gradient-to-b from-white to-white/5 relative z-10">
              404
            </h1>
            {/* Sombra Glitch Neutra */}
            <h1 className="text-[8rem] md:text-[9rem] font-black leading-none tracking-tighter text-zinc-500/30 absolute top-0 left-1 z-0 blur-[2px]">
              404
            </h1>
          </div>

          {/* Mensagem Dinâmica */}
          <div className="text-center mb-8">
            <h2 className="text-2xl font-bold text-white mb-3 flex items-center justify-center gap-2">
              {isOnline ? 'Página não encontrada' : 'Sem Conexão'}
            </h2>

            <div className="flex flex-col items-center gap-2">
              <p className="text-sm text-zinc-300 leading-relaxed max-w-[90%] mx-auto font-medium">
                {isOnline
                  ? "O endereço que você digitou não existe ou foi movido. Verifique a URL."
                  : "Detectamos que sua internet caiu. Verifique seu wi-fi ou dados móveis."
                }
              </p>

              {/* Linha Divisória (MUDADO DE VERMELHO PARA NEUTRO) */}
              <div className="h-px w-24 bg-gradient-to-r from-transparent via-zinc-700/50 to-transparent mt-4"></div>
            </div>
          </div>

          {/* Ações Inteligentes */}
          <div className="space-y-3">
            {/* Se estiver OFFLINE */}
            {!isOnline && (
               <button
                onClick={handleReload}
                // Mudei o botão de reconectar para branco também, para ficar mais sóbrio
                className="w-full py-4 bg-white text-black hover:bg-zinc-200 rounded-xl font-bold tracking-widest uppercase text-xs shadow-lg transition-all flex items-center justify-center gap-2 group"
              >
                <RefreshCw size={16} className="group-hover:rotate-180 transition-transform duration-500" />
                Tentar Reconectar
              </button>
            )}

            {/* Se estiver ONLINE */}
            {isOnline && (
              <Link to="/" className="block w-full">
                <button className="w-full py-4 bg-white text-black hover:bg-zinc-200 rounded-xl font-black tracking-widest uppercase text-xs shadow-lg transition-all flex items-center justify-center gap-2 transform active:scale-95">
                  <Home size={16} strokeWidth={2.5} />
                  Ir para Dashboard
                </button>
              </Link>
            )}


          </div>

          {/* Footer Decorativo (Ícone neutro) */}
          <div className="mt-8 flex justify-center items-center gap-2 opacity-40">
            <AlertCircle size={12} className="text-zinc-500" />
            <span className="text-[9px] font-mono text-white tracking-widest">SYSTEM_ERROR_404_NOT_FOUND</span>
          </div>

        </div>
      </motion.div>
    </div>
  );
}

export default NotFoundPage;