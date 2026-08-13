import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, Repeat, Coffee, AlarmClock, Play, X, AlertTriangle } from 'lucide-react';

const ModalConfirmacao = ({
  isOpen,
  onConfirm,
  onCancel,
  title,
  description,
  confirmText,
  isDestructive
}) => {
  if (!isOpen) return null;
  return (
    <motion.div
      className="fixed inset-0 z-[10000] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-2xl rounded-2xl p-6 w-full max-w-sm">
        <div className="flex items-start gap-4">
          <AlertTriangle className={`${isDestructive ? 'text-red-500' : 'text-amber-500'} mt-0.5 shrink-0`} size={24} />
          <div>
            <h3 className="text-lg font-bold text-zinc-900 dark:text-white mb-1">{title || 'Atenção'}</h3>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">{description}</p>
          </div>
        </div>
        <div className="mt-6 flex justify-end gap-3">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm font-semibold text-zinc-600 dark:text-zinc-300 bg-zinc-100 dark:bg-zinc-800 rounded-lg hover:bg-zinc-200 dark:hover:bg-zinc-700"
          >
            Cancelar
          </button>
          <button
            onClick={onConfirm}
            className={`px-4 py-2 text-sm font-bold text-white rounded-lg ${isDestructive ? 'bg-red-600 hover:bg-red-700' : 'bg-indigo-600 hover:bg-indigo-700'}`}
          >
            {confirmText || 'Confirmar'}
          </button>
        </div>
      </div>
    </motion.div>
  );
};

const OverlaysTimer = ({
    variant,
    isPomodoroFinished,
    isRestFinished,
    isCancelModalOpen,
    themeColor,
    totalFocusSeconds,
    settings,
    formatHM,
    onStop,
    onRepeatCycle,
    onStartRest,
    onBackToStudy,
    onCloseCancelModal,
    onConfirmCancel,
    onOpenCancelModal
}) => {
    return (
        <>
            {/* Modal de Cancelamento */}
            <ModalConfirmacao
                isOpen={isCancelModalOpen}
                onConfirm={onConfirmCancel}
                onCancel={onCloseCancelModal}
                title="Cancelar Sessão?"
                description="Todo o tempo desta sessão será descartado."
                confirmText="Sim, Cancelar"
                isDestructive={true}
            />

            {/* Overlays de Pomodoro/Descanso (Apenas modo Study) */}
            {variant !== 'simulado' && (
                <>
                    <AnimatePresence>
                        {isPomodoroFinished && (
                            <motion.div
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="fixed inset-0 z-[10000] bg-white/95 dark:bg-card-dark/95 backdrop-blur-md flex flex-col items-center justify-center p-6"
                            >
                                <div className="w-24 h-24 rounded-full flex items-center justify-center mb-6 animate-bounce shadow-2xl" style={{ backgroundColor: `${themeColor}20`, color: themeColor }}>
                                    <CheckCircle2 size={48} />
                                </div>
                                <h2 className="text-4xl font-black text-zinc-900 dark:text-white mb-2 uppercase tracking-tight">Ciclo Concluído!</h2>
                                <p className="text-zinc-500 dark:text-zinc-400 text-lg mb-2">Você completou {settings.pomodoroTime} minutos de foco.</p>
                                <p className="text-zinc-500 dark:text-zinc-400 text-sm mb-10">
                                    Total acumulado: <span className="font-black">{formatHM(totalFocusSeconds)}</span>
                                </p>

                                <div className="flex flex-col sm:flex-row gap-4 w-full max-w-md">
                                    <button
                                        onClick={onStop}
                                        className="flex-1 py-4 rounded-xl bg-zinc-200 dark:bg-zinc-800 text-zinc-900 dark:text-white font-bold uppercase tracking-wide hover:bg-zinc-300 dark:hover:bg-zinc-700 transition-colors"
                                    >
                                        Salvar Sessão
                                    </button>
                                    <button
                                        onClick={onRepeatCycle}
                                        className="flex-1 py-4 rounded-xl font-bold uppercase tracking-wide text-white hover:opacity-90 transition-opacity flex items-center justify-center gap-2 shadow-lg"
                                        style={{ backgroundColor: themeColor }}
                                    >
                                        <Repeat size={20} /> Novo Ciclo
                                    </button>
                                </div>

                                <button
                                    onClick={onStartRest}
                                    className="mt-6 px-8 py-3 rounded-full border-2 border-blue-500/30 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 text-sm font-bold uppercase tracking-widest flex items-center gap-2 transition-all"
                                >
                                    <Coffee size={18} /> Iniciar Descanso ({settings.restTime} min)
                                </button>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    <AnimatePresence>
                        {isRestFinished && (
                            <motion.div
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="fixed inset-0 z-[10000] bg-white/95 dark:bg-card-dark/95 backdrop-blur-md flex flex-col items-center justify-center p-6"
                            >
                                <div className="w-24 h-24 rounded-full flex items-center justify-center mb-6 animate-bounce shadow-2xl" style={{ backgroundColor: `${themeColor}20`, color: themeColor }}>
                                    <AlarmClock size={48} />
                                </div>
                                <h2 className="text-4xl font-black text-zinc-900 dark:text-white mb-2 uppercase tracking-tight">Descanso Acabou!</h2>
                                <p className="text-zinc-500 dark:text-zinc-400 text-lg mb-2">Hora de voltar ao foco total.</p>
                                <p className="text-zinc-500 dark:text-zinc-400 text-sm mb-10">
                                    Total acumulado: <span className="font-black">{formatHM(totalFocusSeconds)}</span>
                                </p>

                                <div className="flex flex-col sm:flex-row gap-4 w-full max-w-md">
                                    <button
                                        onClick={onBackToStudy}
                                        className="flex-1 py-4 rounded-xl font-bold uppercase tracking-wide text-white hover:opacity-90 transition-opacity flex items-center justify-center gap-2 shadow-lg"
                                        style={{ backgroundColor: themeColor }}
                                    >
                                        <Play size={20} /> Retomar Estudo
                                    </button>
                                    <button
                                        onClick={onStop}
                                        className="flex-1 py-4 rounded-xl bg-zinc-200 dark:bg-zinc-800 text-zinc-900 dark:text-white font-bold uppercase tracking-wide hover:bg-zinc-300 dark:hover:bg-zinc-700 transition-colors"
                                    >
                                        Finalizar
                                    </button>
                                </div>

                                <button
                                    onClick={onOpenCancelModal}
                                    className="mt-6 px-8 py-3 rounded-full border-2 border-red-500/30 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 text-sm font-bold uppercase tracking-widest flex items-center gap-2 transition-all"
                                >
                                    <X size={18} /> Cancelar Sessão
                                </button>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </>
            )}
        </>
    );
};

export default OverlaysTimer;