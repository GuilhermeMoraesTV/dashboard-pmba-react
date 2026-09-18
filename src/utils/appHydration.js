export const HYDRATION_RESOURCE_KEYS = [
  'registros',
  'simulados',
  'activeCiclo',
  'activeCronograma',
  'disciplinasCiclo',
  'metas',
];

export const createHydrationState = () => Object.fromEntries(
  HYDRATION_RESOURCE_KEYS.map((key) => [key, {
    received: false,
    authoritative: false,
    hasData: false,
    failed: false,
    hasPendingWrites: false,
  }])
);

export const getCoreHydrationStatus = ({
  hydrationState,
  isOnline = true,
}) => {
  const resources = HYDRATION_RESOURCE_KEYS.map((key) => hydrationState[key]);
  const allReceived = resources.every((resource) => resource?.received);
  const allSettled = resources.every((resource) => resource?.authoritative || resource?.failed);
  const hasPendingWrites = resources.some((resource) => resource?.hasPendingWrites);
  const allSafeToRender = resources.every((resource) => (
    resource?.authoritative
    || resource?.failed
    || (resource?.received && (resource?.hasData || !isOnline))
  ));
  return {
    resources,
    allReceived,
    allSettled,
    hasPendingWrites,
    // Cache com dados pode ser exibido imediatamente. Cache vazio em um
    // dispositivo online ainda não prova ausência: após limpar os dados do
    // navegador, o Firestore o emite antes da resposta do servidor.
    ready: Boolean(allReceived && allSafeToRender),
  };
};

export const isPlanningAssessmentReady = (hydrationState) => Boolean(
  hydrationState.activeCiclo?.authoritative
  && hydrationState.activeCronograma?.authoritative
  && hydrationState.registros?.authoritative
);

/**
 * O boot de tela cheia existe apenas para a janela inicial de hidratação.
 * Depois do timeout, a shell pode abrir com skeletons enquanto cada listener
 * continua tentando sincronizar. Decisões destrutivas ou de "usuário novo"
 * seguem protegidas por isPlanningAssessmentReady().
 */
export const shouldShowDashboardBoot = ({
  hasSubscriptionAccess,
  coreDataReady,
  hydrationTimedOut,
}) => Boolean(
  hasSubscriptionAccess
  && !coreDataReady
  && !hydrationTimedOut
);
