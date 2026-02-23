/*import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Trophy, Zap, Plus } from 'lucide-react';

const XPNotification = () => {
  const [notifications, setNotifications] = useState([]);
  const [isTourActive, setIsTourActive] = useState(false);

  // Fila de espera para quando o tour estiver ativo
  const queueRef = useRef([]);

  // 1. Escuta o estado do Tour
  useEffect(() => {
    const handleTourStatus = (event) => {
        const isActive = event.detail;
        setIsTourActive(isActive);

        // Se o tour acabou e tem coisa na fila, libera agora
        if (!isActive && queueRef.current.length > 0) {
            setNotifications(prev => [...prev, ...queueRef.current]);
            queueRef.current = []; // Limpa a fila
        }
    };

    window.addEventListener('tour-active', handleTourStatus);
    return () => window.removeEventListener('tour-active', handleTourStatus);
  }, []);

  // 2. Escuta os eventos de XP
  useEffect(() => {
    const handleXPEvent = (event) => {
      const { amount, message, type } = event.detail;
      const id = Date.now() + Math.random(); // ID único garantido

      const newNotif = { id, amount, message, type };

      if (isTourActive) {
          // Se tour ativo, guarda na fila
          queueRef.current.push(newNotif);
      } else {
          // Se não, mostra direto
          setNotifications((prev) => [...prev, newNotif]);
      }

      // Remove após 4 segundos (tempo um pouco maior para leitura)
      setTimeout(() => {
        setNotifications((prev) => prev.filter((n) => n.id !== id));
      }, 4000);
    };

    window.addEventListener('xp-gained', handleXPEvent);
    return () => window.removeEventListener('xp-gained', handleXPEvent);
  }, [isTourActive]); // Dependência importante: isTourActive

  if (notifications.length === 0) return null;

  return (
    <div className="fixed top-4 md:top-6 left-1/2 transform -translate-x-1/2 z-[100005] flex flex-col items-center gap-2 md:gap-3 pointer-events-none w-full max-w-[90%] md:max-w-sm px-2 md:px-4">
      <AnimatePresence>
        {notifications.map((notif) => {
          const isMilestone = notif.type === 'milestone';

          return (
            <motion.div
              key={notif.id}
              initial={{ opacity: 0, y: -40, scale: 0.8 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -20, scale: 0.9 }}
              transition={{ type: "spring", stiffness: 500, damping: 25 }}
              className={`
                pointer-events-auto flex items-center
                gap-2 md:gap-3
                py-2 pl-2 pr-4 md:py-2.5 md:pr-5 md:pl-2.5
                rounded-full backdrop-blur-md border shadow-xl
                ${isMilestone
                  ? 'bg-amber-50/95 dark:bg-zinc-900/95 border-amber-200/50 dark:border-amber-500/30 shadow-amber-500/10'
                  : 'bg-white/95 dark:bg-zinc-900/95 border-zinc-200 dark:border-zinc-800 shadow-red-500/10'
                }
              `}
            >
              {/* Ícone Circular */}
              <div className={`
                w-8 h-8 md:w-9 md:h-9 rounded-full flex items-center justify-center shrink-0 shadow-inner
                ${isMilestone
                  ? 'bg-gradient-to-br from-amber-100 to-amber-200 text-amber-700 dark:from-amber-900/40 dark:to-amber-800/40 dark:text-amber-400'
                  : 'bg-gradient-to-br from-red-50 to-red-100 text-red-600 dark:from-red-900/30 dark:to-red-800/30 dark:text-red-500'}
              `}>
                {isMilestone
                  ? <Trophy className="w-3.5 h-3.5 md:w-4 md:h-4" strokeWidth={2.5} />
                  : <Zap className="w-3.5 h-3.5 md:w-4 md:h-4 opacity-90" strokeWidth={2.5} fill="currentColor" />
                }
              </div>

              {/* Texto Central */}
              <div className="flex flex-col min-w-[90px] md:min-w-[110px]">
                <div className="flex items-center gap-1.5">
                  <span className={`text-[9px] md:text-[10px] font-black uppercase tracking-wider ${
                    isMilestone ? 'text-amber-600 dark:text-amber-400' : 'text-zinc-500 dark:text-zinc-400'
                  }`}>
                    {isMilestone ? 'CONQUISTA!' : 'XP GANHO'}
                  </span>
                </div>
                {notif.message && (
                  <span className="text-[10px] md:text-xs font-bold text-zinc-700 dark:text-zinc-200 leading-tight truncate max-w-[130px] md:max-w-[160px]">
                    {notif.message}
                  </span>
                )}
              </div>

              {/* Valor do XP */}
              <div className={`flex items-center gap-0.5 pl-2 md:pl-3 border-l ${isMilestone ? 'border-amber-200 dark:border-amber-800' : 'border-zinc-100 dark:border-zinc-800'}`}>
                <Plus className={`w-2.5 h-2.5 md:w-3 md:h-3 mt-0.5 ${isMilestone ? 'text-amber-500' : 'text-red-500'}`} strokeWidth={4} />
                <span className={`text-lg md:text-xl font-black leading-none ${
                  isMilestone
                    ? 'text-amber-600 dark:text-amber-400'
                    : 'text-red-600 dark:text-red-500'
                }`}>
                  {notif.amount}
                </span>
              </div>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
};

export default XPNotification;