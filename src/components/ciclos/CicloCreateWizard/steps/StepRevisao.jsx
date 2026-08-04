import React from 'react';
import { motion } from 'framer-motion';
import { CheckCircle2, Clock3, RefreshCw, Sparkles } from 'lucide-react';
import { REVISAO_MODO_FLEXIVEL, REVISAO_MODO_SUGESTAO } from '../../../../utils/cicloReviewMode';

const MODOS_REVISAO = [
  {
    id: REVISAO_MODO_FLEXIVEL,
    titulo: 'Flexivel no registro',
    subtitulo: 'Controle manual',
    descricao:
      'O modal do ciclo abre sem revisao marcada. Voce precisa escolher 1 dia, 7 dias, 30 dias ou Nao revisar em cada registro.',
    icon: Clock3,
    accent: 'red',
  },
  {
    id: REVISAO_MODO_SUGESTAO,
    titulo: 'Sugestao automatica',
    subtitulo: 'Comeca sugerido',
    descricao:
      'O modal do ciclo ja inicia com 1 dia sugerido, mas continua permitindo trocar a revisao ou marcar Nao revisar.',
    icon: Sparkles,
    accent: 'zinc',
  },
];

export default function StepRevisao({ revisaoModo, setRevisaoModo }) {
  return (
    <div className="flex min-h-full flex-col items-center px-2 py-2 sm:px-4 sm:py-4">
      <motion.div
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-5 w-full px-2 text-center sm:mb-8 sm:px-4"
      >
        <h2 className="mb-2 text-4xl font-black uppercase leading-[0.95] tracking-tighter text-zinc-900 dark:text-white sm:mb-3 sm:text-4xl">
          Revisao <span className="text-red-600">Espacada</span>
        </h2>
        <p className="mx-auto max-w-md text-[12px] font-black uppercase leading-relaxed tracking-[0.16em] text-zinc-500 dark:text-zinc-400 sm:text-sm sm:font-semibold sm:normal-case sm:tracking-normal">
          Defina como a revisao aparece no registro do ciclo sem perder o controle em cada estudo.
        </p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-5xl"
      >
        <div className="grid grid-cols-2 gap-2 sm:gap-6">
          {MODOS_REVISAO.map((modo) => {
            const ativo = revisaoModo === modo.id;
            const Icon = modo.icon;
            const isPrimary = modo.accent === 'red';
            return (
              <button
                key={modo.id}
                type="button"
                onClick={() => setRevisaoModo(modo.id)}
                className={`group relative flex min-h-[178px] flex-col overflow-hidden rounded-2xl border-2 p-3 text-left shadow-md transition-all duration-500 hover:-translate-y-1 sm:min-h-[260px] sm:rounded-[2.2rem] sm:p-6 md:p-7 ${
                  ativo
                    ? 'border-red-500 bg-white shadow-red-500/10 dark:border-red-900/60 dark:bg-zinc-900'
                    : isPrimary
                      ? 'border-red-100 bg-white hover:border-red-500 hover:shadow-red-500/10 dark:border-red-900/30 dark:bg-zinc-900'
                      : 'border-zinc-100 bg-white hover:border-zinc-300 hover:shadow-zinc-900/10 dark:border-zinc-800 dark:bg-zinc-900'
                }`}
              >
                <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-[2.2rem]">
                  <Icon
                    size={150}
                    strokeWidth={1.35}
                    className={`absolute -bottom-6 -right-6 opacity-[0.05] transition-all duration-700 group-hover:-rotate-12 group-hover:scale-110 dark:opacity-[0.08] ${isPrimary ? 'text-red-600' : 'text-zinc-500'}`}
                  />
                </div>
                <div className="relative z-10 flex h-full flex-col">
                  <div className={`mb-3 flex h-9 w-9 items-center justify-center rounded-xl text-white shadow-lg transition-all duration-500 group-hover:rotate-6 sm:mb-6 sm:h-12 sm:w-12 sm:rounded-2xl ${isPrimary ? 'bg-red-600 shadow-red-500/20' : 'bg-zinc-900 shadow-zinc-900/15 dark:bg-white dark:text-zinc-900'}`}>
                    <Icon size={18} strokeWidth={2.5} className="sm:h-6 sm:w-6" />
                  </div>

                  <p className="mb-1 text-[8px] font-black uppercase tracking-[0.14em] text-red-600 dark:text-red-500 sm:text-[9px] sm:tracking-[0.2em]">
                    {modo.subtitulo}
                  </p>
                  <h3 className="text-[17px] font-black uppercase leading-none tracking-tighter text-zinc-900 dark:text-white min-[390px]:text-[19px] sm:text-2xl">
                    {modo.titulo}
                  </h3>
                  <p className="mt-3 line-clamp-4 text-[11px] font-semibold leading-snug text-zinc-500 dark:text-zinc-400 min-[390px]:text-[12px] sm:mt-4 sm:text-sm sm:leading-relaxed">
                    {modo.descricao}
                  </p>

                  <div className="mt-auto flex items-center justify-between pt-4">
                    <span className="text-[8px] font-black uppercase tracking-[0.12em] text-zinc-400 sm:text-[10px] sm:tracking-[0.16em]">
                      {ativo ? 'Selecionado' : 'Escolher'}
                    </span>
                    <div className={`flex h-7 w-7 items-center justify-center rounded-full border-2 transition-all ${ativo ? 'border-red-600 bg-red-600 text-white' : 'border-zinc-200 text-zinc-300 dark:border-zinc-700'}`}>
                      {ativo && <CheckCircle2 size={15} strokeWidth={3} />}
                    </div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        <div className="mt-3 flex items-center gap-2 rounded-xl bg-zinc-100 px-3 py-2 text-[10px] font-bold text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300 sm:mt-5 sm:text-xs">
          <RefreshCw size={14} className="text-red-600" />
          Os dois modos continuam permitindo ajuste por registro. A diferenca e apenas o estado inicial do modal.
        </div>
      </motion.div>
    </div>
  );
}
