import React from 'react';
import { motion } from 'framer-motion';
import { CheckCircle2, RefreshCw } from 'lucide-react';
import { REVISAO_MODO_FLEXIVEL, REVISAO_MODO_SUGESTAO } from '../../../../utils/cicloReviewMode';

const MODOS_REVISAO = [
  {
    id: REVISAO_MODO_FLEXIVEL,
    titulo: 'Flexivel no registro',
    descricao:
      'O modal do ciclo abre sem revisao marcada. Voce precisa escolher 1 dia, 7 dias, 30 dias ou Nao revisar em cada registro.',
  },
  {
    id: REVISAO_MODO_SUGESTAO,
    titulo: 'Sugestao automatica',
    descricao:
      'O modal do ciclo ja inicia com 1 dia sugerido, mas continua permitindo trocar a revisao ou marcar Nao revisar.',
  },
];

export default function StepRevisao({ revisaoModo, setRevisaoModo }) {
  return (
    <div className="flex min-h-full flex-col items-center px-2 py-2 sm:px-4 sm:py-4">
      <motion.div
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-3 w-full px-2 text-center sm:mb-8 sm:px-4"
      >
        <div className="mx-auto mb-2 flex h-9 w-9 items-center justify-center rounded-xl bg-red-600 shadow-lg shadow-red-600/30 sm:mb-5 sm:h-14 sm:w-14 sm:rounded-2xl">
          <RefreshCw size={18} className="text-white sm:h-[26px] sm:w-[26px]" strokeWidth={2.5} />
        </div>
        <h2 className="mb-1 text-xl font-black uppercase leading-none tracking-tight text-zinc-900 dark:text-white sm:mb-3 sm:text-4xl">
          Revisao <span className="text-red-600">Espacada</span>
        </h2>
        <p className="mx-auto hidden max-w-md text-sm font-medium leading-relaxed text-zinc-500 dark:text-zinc-400 sm:block">
          Defina como a sugestao de revisao aparece durante os registros do ciclo.
        </p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-2xl rounded-2xl border border-zinc-200 bg-white p-3 dark:border-zinc-700 dark:bg-zinc-900 sm:p-5"
      >
        <div className="space-y-2 sm:space-y-3">
          {MODOS_REVISAO.map((modo) => {
            const ativo = revisaoModo === modo.id;
            return (
              <button
                key={modo.id}
                type="button"
                onClick={() => setRevisaoModo(modo.id)}
                  className={`w-full text-left p-3 rounded-2xl border-2 transition-all sm:p-4 ${
                  ativo
                    ? 'border-red-500 bg-red-50 dark:bg-red-900/20'
                    : 'border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 hover:border-red-300'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div
                    className={`mt-0.5 w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                      ativo ? 'bg-red-600 border-red-600 text-white' : 'border-zinc-300 dark:border-zinc-600'
                    }`}
                  >
                    {ativo && <CheckCircle2 size={12} strokeWidth={3} />}
                  </div>
                  <div>
                    <p className="text-xs font-black uppercase tracking-tight text-zinc-900 dark:text-white sm:text-sm">{modo.titulo}</p>
                    <p className="hidden text-xs text-zinc-500 mt-1 sm:block">{modo.descricao}</p>
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        <div className="mt-3 hidden items-center gap-2 rounded-xl bg-zinc-100 dark:bg-zinc-800 px-3 py-2 text-xs text-zinc-600 dark:text-zinc-300 sm:flex sm:mt-5">
          <RefreshCw size={14} className="text-red-600" />
          Os dois modos continuam permitindo ajuste por registro. A diferenca e apenas o estado inicial do modal.
        </div>
      </motion.div>
    </div>
  );
}
