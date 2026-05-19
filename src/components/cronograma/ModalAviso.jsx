/**
 * src/components/cronograma/ModalAviso.jsx
 * Modal de confirmação genérico — componente puramente presentacional.
 */
import { motion } from 'framer-motion';

const ModalAviso = ({ onConfirmar, onCancelar, titulo, descricao, icone, cor }) => (
  <motion.div
    initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
    className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
    onClick={onCancelar}
  >
    <motion.div
      initial={{ scale: 0.88, opacity: 0, y: 16 }} animate={{ scale: 1, opacity: 1, y: 0 }}
      exit={{ scale: 0.88, opacity: 0, y: 16 }}
      transition={{ type: 'spring', stiffness: 380, damping: 28 }}
      className="bg-white dark:bg-zinc-950 w-full max-w-sm rounded-3xl shadow-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden"
      onClick={e => e.stopPropagation()}
    >
      <div className={`bg-gradient-to-br ${cor} px-6 pt-7 pb-6 flex flex-col items-center border-b border-zinc-100 dark:border-zinc-800/20`}>
        <div className="w-16 h-16 bg-white dark:bg-zinc-900 rounded-2xl flex items-center justify-center mb-4 shadow-sm">{icone}</div>
        <h3 className="text-lg font-black text-zinc-900 dark:text-white text-center leading-tight mb-1">{titulo}</h3>
        <p className="text-xs text-zinc-500 dark:text-zinc-400 text-center leading-relaxed">{descricao}</p>
      </div>
      <div className="p-4 flex gap-3 bg-white dark:bg-zinc-950">
        <button onClick={onCancelar} className="flex-1 py-3 rounded-2xl font-bold text-xs uppercase tracking-wide bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors">Cancelar</button>
        <button onClick={onConfirmar} className="flex-1 py-3 rounded-2xl font-black text-xs uppercase tracking-wide bg-red-600 hover:bg-red-700 text-white shadow-lg shadow-red-600/25 transition-all active:scale-95">Sim, confirmar</button>
      </div>
    </motion.div>
  </motion.div>
);

export default ModalAviso;
