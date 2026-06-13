import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Check, Sparkles } from 'lucide-react';

const PARTICLES = Array.from({ length: 14 }, (_, index) => ({
  id: index,
  angle: (index / 14) * Math.PI * 2,
  distance: 72 + (index % 3) * 18,
  delay: (index % 5) * 0.035,
}));

export default function PlanningSuccessCelebration() {
  const [celebration, setCelebration] = useState(null);

  useEffect(() => {
    let hideTimer;
    const handleCreated = (event) => {
      clearTimeout(hideTimer);
      setCelebration({
        id: `${Date.now()}-${Math.random()}`,
        type: event.detail?.type === 'ciclo' ? 'Ciclo' : 'Cronograma',
        name: event.detail?.name || '',
      });
      hideTimer = setTimeout(() => setCelebration(null), 3400);
    };

    window.addEventListener('Planning:Created', handleCreated);
    return () => {
      clearTimeout(hideTimer);
      window.removeEventListener('Planning:Created', handleCreated);
    };
  }, []);

  return (
    <AnimatePresence>
      {celebration && (
        <motion.div
          key={celebration.id}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100200] flex items-center justify-center overflow-hidden bg-zinc-950/55 p-5 backdrop-blur-md"
          onClick={() => setCelebration(null)}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.72, y: 28 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 12 }}
            transition={{ type: 'spring', stiffness: 300, damping: 24 }}
            className="relative w-full max-w-sm overflow-hidden rounded-[32px] border border-white/15 bg-zinc-950 px-7 py-9 text-center text-white shadow-[0_32px_100px_rgba(0,0,0,0.5)]"
            onClick={(event) => event.stopPropagation()}
          >
            <motion.div
              className="absolute inset-0 bg-[radial-gradient(circle_at_50%_25%,rgba(239,68,68,0.35),transparent_45%)]"
              animate={{ opacity: [0.55, 1, 0.65] }}
              transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
            />

            <div className="relative mx-auto mb-6 h-32 w-32">
              {PARTICLES.map((particle) => (
                <motion.span
                  key={particle.id}
                  className="absolute left-1/2 top-1/2 h-2 w-2 rounded-full bg-red-400 shadow-[0_0_14px_rgba(248,113,113,0.9)]"
                  initial={{ x: -4, y: -4, scale: 0, opacity: 0 }}
                  animate={{
                    x: Math.cos(particle.angle) * particle.distance,
                    y: Math.sin(particle.angle) * particle.distance,
                    scale: [0, 1, 0],
                    opacity: [0, 1, 0],
                  }}
                  transition={{ duration: 1.15, delay: particle.delay, ease: 'easeOut' }}
                />
              ))}

              <motion.div
                initial={{ rotate: -18, scale: 0 }}
                animate={{ rotate: 0, scale: 1 }}
                transition={{ type: 'spring', stiffness: 360, damping: 18, delay: 0.12 }}
                className="absolute inset-4 flex items-center justify-center rounded-full bg-red-600 shadow-[0_0_55px_rgba(239,68,68,0.55)]"
              >
                <motion.div
                  initial={{ opacity: 0, scale: 0.4 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ type: 'spring', stiffness: 420, damping: 20, delay: 0.32 }}
                >
                  <Check size={48} strokeWidth={3.2} />
                </motion.div>
              </motion.div>
            </div>

            <div className="relative">
              <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-red-400/25 bg-red-500/10 px-3 py-1 text-[9px] font-black uppercase tracking-[0.22em] text-red-300">
                <Sparkles size={12} />
                Planejamento pronto
              </div>
              <h2 className="text-2xl font-black uppercase tracking-tight">
                {celebration.type} criado!
              </h2>
              <p className="mt-2 text-sm font-medium leading-relaxed text-zinc-400">
                {celebration.name
                  ? `${celebration.name} ja esta pronto para guiar seus estudos.`
                  : 'Seu novo planejamento ja esta pronto para guiar seus estudos.'}
              </p>
              <motion.div
                className="mx-auto mt-6 h-1 w-28 overflow-hidden rounded-full bg-white/10"
              >
                <motion.div
                  className="h-full bg-red-500"
                  initial={{ width: '100%' }}
                  animate={{ width: '0%' }}
                  transition={{ duration: 3.2, ease: 'linear' }}
                />
              </motion.div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
