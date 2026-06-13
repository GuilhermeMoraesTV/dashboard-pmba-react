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
    <div className="flex min-h-full flex-col items-center px-4 py-4">
      <motion.div
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8 w-full px-4 text-center"
      >
        <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-red-600 shadow-lg shadow-red-600/30">
          <RefreshCw size={26} className="text-white" strokeWidth={2.5} />
        </div>
        <h2 className="mb-3 text-3xl font-black uppercase leading-none tracking-tight text-zinc-900 dark:text-white sm:text-4xl">
          Revisao <span className="text-red-600">Espacada</span>
        </h2>
        <p className="mx-auto max-w-md text-sm font-medium leading-relaxed text-zinc-500 dark:text-zinc-400">
          Defina como a sugestao de revisao aparece durante os registros do ciclo.
        </p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-2xl rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-700 dark:bg-zinc-900"
      >
        <div className="space-y-3">
          {MODOS_REVISAO.map((modo) => {
            const ativo = revisaoModo === modo.id;
            return (
              <button
                key={modo.id}
                type="button"
                onClick={() => setRevisaoModo(modo.id)}
                className={`w-full text-left p-4 rounded-2xl border-2 transition-all ${
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
                    <p className="text-sm font-black uppercase tracking-tight text-zinc-900 dark:text-white">{modo.titulo}</p>
                    <p className="text-xs text-zinc-500 mt-1">{modo.descricao}</p>
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        <div className="mt-5 flex items-center gap-2 rounded-xl bg-zinc-100 dark:bg-zinc-800 px-3 py-2 text-xs text-zinc-600 dark:text-zinc-300">
          <RefreshCw size={14} className="text-red-600" />
          Os dois modos continuam permitindo ajuste por registro. A diferenca e apenas o estado inicial do modal.
        </div>
      </motion.div>
    </div>
  );
}
