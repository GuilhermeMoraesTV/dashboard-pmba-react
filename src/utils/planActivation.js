// Sessões antigas sem contexto preservam o bloqueio até serem finalizadas.
export function isPlanActivationBlocked(isTimerActive, activeTimerContext, targetContext) {
  if (!isTimerActive) return false;
  if (activeTimerContext !== 'ciclo' && activeTimerContext !== 'cronograma') return true;
  return activeTimerContext === targetContext;
}
