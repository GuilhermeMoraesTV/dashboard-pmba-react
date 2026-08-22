import React from 'react';
import { motion as Motion, useReducedMotion } from 'framer-motion';

function AuthLayout({ children, mode = 'login' }) {
  const isSignup = mode === 'signup';
  const reduceMotion = useReducedMotion();

  return (
    <main className="relative min-h-[100dvh] overflow-x-hidden bg-[#06080b] font-sans text-white">
      <style>{`
        input:-webkit-autofill,
        input:-webkit-autofill:hover,
        input:-webkit-autofill:focus,
        input:-webkit-autofill:active {
          -webkit-box-shadow: 0 0 0 30px #222428 inset !important;
          -webkit-text-fill-color: white !important;
          caret-color: white !important;
          border-radius: 0 !important;
          border: none !important;
        }
      `}</style>

      <div className="absolute inset-0 overflow-hidden lg:fixed" aria-hidden="true">
        <div className="absolute inset-x-0 top-0 h-[310px] lg:inset-y-0 lg:left-[3%] lg:right-[-3%] lg:h-auto">
          <Motion.img
            src="/login-tactical-background-v4-wide.png"
            alt=""
            initial={{ opacity: 0, scale: reduceMotion ? 1 : 1.015 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: reduceMotion ? 0 : 0.9, ease: 'easeOut' }}
            className="h-full w-full object-cover object-left"
          />

          <div className="absolute inset-0 bg-gradient-to-b from-black/5 via-transparent to-[#06080b] lg:bg-gradient-to-r lg:from-transparent lg:via-transparent lg:to-[#06080b]/55" />
          <div className="absolute inset-0 hidden bg-gradient-to-t from-black/25 via-transparent to-black/10 lg:block" />
        </div>

        {!reduceMotion && (
          <Motion.div
            className="absolute inset-y-0 w-px bg-gradient-to-b from-transparent via-red-500/55 to-transparent"
            initial={{ left: '8%', opacity: 0 }}
            animate={{ left: ['8%', '62%'], opacity: [0, 0.65, 0] }}
            transition={{ duration: 7, repeat: Infinity, ease: 'linear', repeatDelay: 2 }}
          />
        )}
      </div>

      <div className="relative z-10 mx-auto flex min-h-[100dvh] w-full max-w-[1560px] items-start justify-center px-4 pb-7 pt-[270px] sm:px-8 sm:pb-10 lg:items-center lg:justify-end lg:px-10 lg:py-10 xl:px-16">
        <Motion.section
          initial={{ opacity: 0, x: reduceMotion ? 0 : 22, y: reduceMotion ? 0 : 8 }}
          animate={{ opacity: 1, x: 0, y: 0 }}
          transition={{ duration: reduceMotion ? 0 : 0.6, delay: reduceMotion ? 0 : 0.08, ease: 'easeOut' }}
          className={`w-full ${isSignup ? 'max-w-[430px]' : 'max-w-[400px]'}`}
        >
          {children}
        </Motion.section>
      </div>
    </main>
  );
}

export default AuthLayout;
