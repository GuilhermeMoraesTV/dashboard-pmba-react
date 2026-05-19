import React from 'react';
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
    <div className="px-1 sm:px-4">
      <div className="max-w-4xl mx-auto p-5 sm:p-7 rounded-3xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/40 shadow-sm">
        <div className="mb-6 text-center">
          <h3 className="text-2xl sm:text-3xl font-black text-zinc-900 dark:text-white uppercase tracking-tight">Revisao no Ciclo</h3>
          <p className="text-sm text-zinc-500 mt-2">
            Este passo define o contrato real salvo no ciclo e aplicado depois no registro manual e no timer.
          </p>
        </div>

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
      </div>
    </div>
  );
}
