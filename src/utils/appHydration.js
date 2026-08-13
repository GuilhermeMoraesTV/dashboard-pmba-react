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
    failed: false,
    hasPendingWrites: false,
  }])
);

export const getCoreHydrationStatus = ({
  hydrationState,
  isOnline,
  timedOut,
  legacyReadyFlags,
}) => {
  const resources = HYDRATION_RESOURCE_KEYS.map((key) => hydrationState[key]);
  const allReceived = resources.every((resource) => resource?.received);
  const allSettled = resources.every((resource) => resource?.authoritative || resource?.failed);
  const hasPendingWrites = resources.some((resource) => resource?.hasPendingWrites);

  return {
    resources,
    allReceived,
    allSettled,
    hasPendingWrites,
    ready: Boolean(allReceived && (
      timedOut
      || (legacyReadyFlags && (!isOnline || allSettled))
    )),
  };
};

export const isPlanningAssessmentReady = (hydrationState) => Boolean(
  hydrationState.activeCiclo?.authoritative
  && hydrationState.activeCronograma?.authoritative
  && hydrationState.registros?.authoritative
);
