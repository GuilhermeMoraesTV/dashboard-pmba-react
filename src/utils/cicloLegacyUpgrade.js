export const CICLO_GUIDE_VERSION = 2;

export const isCicloLegacyForGuide = (ciclo) => {
  if (!ciclo || ciclo.arquivado === true) return false;

  const version = Number(ciclo.versaoCiclo || 0);
  const hasGuideStamp = Boolean(ciclo.guiaAtualizadoEm);
  const hasSessionOrder = Array.isArray(ciclo.ordemSessoes) && ciclo.ordemSessoes.length > 0;
  const hasStudyDays = Boolean(ciclo.diasEstudo && typeof ciclo.diasEstudo === 'object' && Object.keys(ciclo.diasEstudo).length > 0);
  const hasSessionDuration = Number(ciclo.tempoSessaoMinutos || 0) > 0;

  return version < CICLO_GUIDE_VERSION || !hasGuideStamp || !hasSessionOrder || !hasStudyDays || !hasSessionDuration;
};

export const DEFAULT_LEGACY_CYCLE_STUDY_DAYS = {
  1: 1,
  2: 1,
  3: 1,
  4: 1,
  5: 1,
};
