import React from 'react';
import { motion } from 'framer-motion';

const IconTarget = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" className="h-5 w-5" aria-hidden="true">
    <circle cx="12" cy="12" r="8.5" />
    <circle cx="12" cy="12" r="4.5" />
    <path d="M12 2v3M22 12h-3M12 22v-3M2 12h3" strokeLinecap="round" />
  </svg>
);

const IconCalendar = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" className="h-5 w-5" aria-hidden="true">
    <rect x="3" y="5" width="18" height="16" rx="2" />
    <path d="M8 3v4M16 3v4M3 10h18M8 14h.01M12 14h.01M16 14h.01M8 17h.01M12 17h.01" strokeLinecap="round" />
  </svg>
);

const IconChart = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" className="h-5 w-5" aria-hidden="true">
    <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const benefits = [
  {
    icon: <IconTarget />,
    title: 'Estudo com direção',
    description: 'Organize ciclos, disciplinas e sessões em uma rotina clara.',
  },
  {
    icon: <IconCalendar />,
    title: 'Planejamento inteligente',
    description: 'Transforme seu edital e sua disponibilidade em um plano executável.',
  },
  {
    icon: <IconChart />,
    title: 'Evolução mensurável',
    description: 'Acompanhe tempo, questões, revisões e desempenho em um só lugar.',
  },
];

function AuthLayout({ children, mode = 'login' }) {
  const isSignup = mode === 'signup';

  return (
    <main className="relative min-h-[100dvh] overflow-x-hidden bg-[#080808] font-sans text-white">
      <style>{`
        input:-webkit-autofill,
        input:-webkit-autofill:hover,
        input:-webkit-autofill:focus,
        input:-webkit-autofill:active {
          -webkit-box-shadow: 0 0 0 30px #1a1a1a inset !important;
          -webkit-text-fill-color: white !important;
          caret-color: white !important;
          border-radius: 0 !important;
          border: none !important;
        }
      `}</style>

      <div className="absolute inset-0" aria-hidden="true">
        <img src="/imagem-login.png" alt="" className="h-full w-full object-cover object-top" />
        <div className="absolute inset-0 bg-gradient-to-r from-black/95 via-black/82 to-black/70" />
        <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-black/45" />
        <div className="absolute -left-24 top-1/4 h-72 w-72 rounded-full bg-red-700/15 blur-[100px]" />
        <div className="absolute bottom-0 right-0 h-72 w-72 rounded-full bg-red-950/25 blur-[110px]" />
      </div>

      <div className="relative z-10 mx-auto grid min-h-[100dvh] w-full max-w-[1240px] items-center gap-8 px-4 py-6 sm:px-8 lg:grid-cols-[minmax(0,1.18fr)_minmax(360px,0.82fr)] lg:gap-14 lg:px-12 lg:py-10 xl:gap-20">
        <motion.section
          initial={{ opacity: 0, x: -24 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.65, ease: 'easeOut' }}
          className="mx-auto w-full max-w-2xl lg:mx-0"
        >
          <div className="flex items-center justify-between gap-4 lg:block">
            <img src="/logoModoQAP.png" alt="ModoQAP" className="h-20 w-auto drop-shadow-2xl sm:h-24 lg:h-32" />
            <span className="rounded-full border border-red-500/25 bg-red-500/10 px-3 py-1.5 text-[9px] font-bold uppercase tracking-[0.22em] text-red-300 sm:text-[10px] lg:hidden">
              Sua preparação em missão
            </span>
          </div>

          <div className="mt-3 lg:mt-7">
            <div className="mb-5 hidden items-center gap-3 lg:flex">
              <span className="h-px w-10 bg-red-600" />
              <span className="text-xs font-bold uppercase tracking-[0.28em] text-red-400">Sua preparação em missão</span>
            </div>
            <h1 className="max-w-xl text-2xl font-black leading-tight tracking-tight text-white sm:text-3xl lg:text-5xl lg:leading-[1.08]">
              Estratégia, constância e controle para chegar à sua aprovação.
            </h1>
            <p className="mt-3 max-w-xl text-sm leading-relaxed text-zinc-300 sm:text-base lg:mt-5 lg:text-lg lg:leading-8">
              O ModoQAP reúne planejamento, execução e análise para você saber o que estudar hoje e enxergar a evolução da sua preparação.
            </p>
          </div>

          <div className="mt-5 grid grid-cols-3 gap-2 lg:mt-9 lg:gap-3">
            {benefits.map((benefit) => (
              <div key={benefit.title} className="rounded-xl border border-white/10 bg-white/[0.045] p-3 backdrop-blur-md transition-colors hover:border-red-500/30 hover:bg-white/[0.07] sm:p-4">
                <div className="mb-2 flex h-8 w-8 items-center justify-center rounded-lg border border-red-500/25 bg-red-600/10 text-red-400 sm:h-9 sm:w-9">
                  {benefit.icon}
                </div>
                <h2 className="text-[10px] font-bold leading-tight text-white sm:text-xs lg:text-sm">{benefit.title}</h2>
                <p className="mt-1 hidden text-xs leading-relaxed text-zinc-400 lg:block">{benefit.description}</p>
              </div>
            ))}
          </div>

          <p className="mt-6 hidden text-xs text-zinc-500 lg:block">
            Disciplina transforma intenção em resultado. O próximo passo começa agora.
          </p>
        </motion.section>

        <motion.section
          initial={{ opacity: 0, x: 24, y: 8 }}
          animate={{ opacity: 1, x: 0, y: 0 }}
          transition={{ duration: 0.65, delay: 0.08, ease: 'easeOut' }}
          className={`mx-auto w-full ${isSignup ? 'max-w-[430px]' : 'max-w-[400px]'} lg:mx-0 lg:ml-auto`}
        >
          {children}
        </motion.section>
      </div>
    </main>
  );
}

export default AuthLayout;
