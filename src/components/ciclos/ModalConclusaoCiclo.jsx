// components/ciclos/ModalConclusaoCiclo.js

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Trophy, RefreshCw, X } from 'lucide-react';

function ModalConclusaoCiclo({ ciclo, onConfirm, onClose, loading, progressoGeral }) {
    return (
        <AnimatePresence>
            {true && ( // O estado de visibilidade é controlado pelo componente pai (CicloDetalhePage)
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[60] flex justify-center items-center p-4"
                    onClick={onClose}
                >
                    <motion.div
                        initial={{ opacity: 0, scale: 0.8, y: 50 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.8, y: 50 }}
                        transition={{ type: "spring", stiffness: 300, damping: 30 }}
                        className="bg-white dark:bg-zinc-950 p-6 rounded-2xl shadow-2xl border border-zinc-200 dark:border-zinc-800 w-full max-w-md relative overflow-hidden"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <button onClick={onClose} className="absolute top-4 right-4 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors">
                            <X size={20} />
                        </button>

                        <div className="bg-emerald-500/10 p-4 rounded-xl flex flex-col items-center border border-emerald-500/20 mb-6">
                            <Trophy size={48} className="text-emerald-600 dark:text-emerald-500 mb-2" />
                            <h2 className="text-2xl font-black text-zinc-900 dark:text-white uppercase tracking-tight">
                                Ciclo Completo!
                            </h2>
                            <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-1 font-medium">
                                Você alcançou **{progressoGeral.toFixed(0)}%** do ciclo semanal.
                            </p>
                        </div>

                        <div className="text-center">
                            <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-6">
                                Ao confirmar, você registra a **{((ciclo.conclusoes || 0) + 1)}ª conclusão** do ciclo <strong className="text-zinc-900 dark:text-white">"{ciclo.nome}"</strong> e zera o seu progresso de horas para recomeçar.
                            </p>
                            <ul className="text-left mb-6 text-xs text-zinc-700 dark:text-zinc-300 space-y-2 px-4">
                                <li className="flex items-start gap-2"><Trophy size={14} className="text-emerald-500 flex-shrink-0 mt-0.5" /> <span className="font-bold">Contabiliza esta conclusão no histórico.</span></li>
                                <li className="flex items-start gap-2"><RefreshCw size={14} className="text-red-500 flex-shrink-0 mt-0.5" /> <span className="font-bold">Arquiva os registros de estudo atuais</span> (reseta o progresso para 0%).</li>
                            </ul>

                            <div className="flex gap-3">
                                <button onClick={onClose} disabled={loading} className="flex-1 px-4 py-3 bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 rounded-xl font-bold text-xs uppercase tracking-wider hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors">Cancelar</button>
                                <button onClick={onConfirm} disabled={loading} className="flex-1 px-4 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs uppercase tracking-wider shadow-lg shadow-emerald-900/20 transition-all flex items-center justify-center gap-2">
                                    {loading ? "Concluindo..." : "Confirmar Conclusão"}
                                </button>
                            </div>
                        </div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}

export default ModalConclusaoCiclo;