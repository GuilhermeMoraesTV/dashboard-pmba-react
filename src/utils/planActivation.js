// Bloqueia ativação/troca de qualquer planejamento enquanto houver timer de estudo ativo.
export function isPlanActivationBlocked(isTimerActive) {
  return Boolean(isTimerActive);
}
