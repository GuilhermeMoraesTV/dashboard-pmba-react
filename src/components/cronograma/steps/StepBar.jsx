/**
 * src/components/cronograma/steps/StepBar.jsx
 * Design "Progress Path" — Minimalista, conectado e visual em todos os dispositivos.
 */
import React from 'react';
import { motion } from 'framer-motion';
import { Check } from 'lucide-react';

const StepBar = ({ passo, steps, isExpresso }) => {
  const accentBg = isExpresso ? 'bg-amber-500' : 'bg-red-600';
  const accentText = isExpresso ? 'text-amber-500' : 'text-red-600';

  return (
    <div className="w-full select-none">
      
      {/* 📱 MOBILE VIEW: Todos os passos visíveis em linha conectada */}
      <div className="flex sm:hidden items-start justify-center w-full px-1 py-1 gap-0.5 rounded-[1.15rem] border border-zinc-200/80 dark:border-zinc-800 bg-white/80 dark:bg-zinc-950/70 backdrop-blur">
        {steps.map((step, idx) => {
          const isDone = passo > step.id;
          const isActive = passo === step.id;
          const stepNumber = idx + 1;

          return (
            <React.Fragment key={step.id}>
              <div className="relative flex flex-1 min-w-0 flex-col items-center pt-0.5 pb-2.5">
                <motion.div
                  initial={false}
                  animate={{
                    backgroundColor: isDone || isActive ? (isExpresso ? '#f59e0b' : '#dc2626') : 'transparent',
                    borderColor: isDone || isActive ? (isExpresso ? '#f59e0b' : '#dc2626') : 'currentColor',
                    scale: isActive ? 1.08 : 1
                  }}
                  className={`
                    w-6 h-6 rounded-xl border-2 flex items-center justify-center transition-colors duration-300
                    ${isDone || isActive ? 'text-white' : 'text-zinc-300 dark:text-zinc-700'}
                  `}
                >
                  {isDone ? (
                    <Check size={10} strokeWidth={4} />
                  ) : (
                    <span className="text-[9px] font-black leading-none tabular-nums">{stepNumber}</span>
                  )}
                </motion.div>
                
                {isActive && (
                  <motion.span 
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`absolute -bottom-0.5 max-w-[44px] truncate text-center text-[6px] font-black uppercase tracking-[0.08em] ${accentText}`}
                  >
                    {step.label}
                  </motion.span>
                )}
              </div>

              {idx < steps.length - 1 && (
                <div className="mt-3.5 h-[2px] flex-1 min-w-[5px] bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                  <motion.div
                    className={`h-full ${accentBg}`}
                    initial={{ width: '0%' }}
                    animate={{ width: isDone ? '100%' : '0%' }}
                    transition={{ duration: 0.4 }}
                  />
                </div>
              )}
            </React.Fragment>
          );
        })}
      </div>

      {/* 💻 DESKTOP VIEW: Design Conectado e Espaçado */}
      <div className="hidden sm:flex items-center justify-center gap-0 w-full rounded-[1.8rem] border border-zinc-200/80 dark:border-zinc-800 bg-white/85 dark:bg-zinc-950/70 backdrop-blur px-4 py-3">
        {steps.map((step, idx) => {
          const isDone = passo > step.id;
          const isActive = passo === step.id;
          const stepNumber = idx + 1;

          return (
            <React.Fragment key={step.id}>
              <div className="flex items-center gap-2 group">
                <motion.div
                  animate={{
                    backgroundColor: isDone || isActive ? (isExpresso ? '#f59e0b' : '#dc2626') : 'transparent',
                    borderColor: isDone || isActive ? (isExpresso ? '#f59e0b' : '#dc2626') : 'currentColor',
                  }}
                  className={`
                    w-9 h-9 rounded-2xl border-2 flex items-center justify-center transition-all duration-300
                    ${isDone || isActive ? 'text-white' : 'text-zinc-300 dark:text-zinc-700'}
                  `}
                >
                  {isDone ? (
                    <Check size={14} strokeWidth={4} />
                  ) : (
                    <span className="text-[12px] font-black leading-none tabular-nums">{stepNumber}</span>
                  )}
                </motion.div>

                <div className="flex flex-col">
                  <span className={`text-[9px] font-black uppercase tracking-widest leading-none ${isActive ? accentText : isDone ? 'text-zinc-900 dark:text-zinc-100' : 'text-zinc-400'}`}>
                    {step.label}
                  </span>
                  {isActive && (
                    <motion.div 
                      layoutId="activeUnderline"
                      className={`h-[1px] ${accentBg} mt-0.5 rounded-full`}
                    />
                  )}
                </div>
              </div>

              {idx < steps.length - 1 && (
                <div className="w-8 lg:w-10 h-[2px] bg-zinc-100 dark:bg-zinc-800 mx-2 lg:mx-3 rounded-full overflow-hidden">
                  <motion.div
                    className={`h-full ${accentBg}`}
                    initial={{ width: '0%' }}
                    animate={{ width: isDone ? '100%' : '0%' }}
                    transition={{ duration: 0.4 }}
                  />
                </div>
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
};

export default StepBar;
