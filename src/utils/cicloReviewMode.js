export const REVISAO_MODO_FLEXIVEL = 'flexivel_registro';
export const REVISAO_MODO_SUGESTAO = 'sugestao_automatica';

export const normalizeRevisaoModoCiclo = (revisaoModo) => (
  revisaoModo === REVISAO_MODO_SUGESTAO ? REVISAO_MODO_SUGESTAO : REVISAO_MODO_FLEXIVEL
);

export const getRevisaoEscolhidaInicial = (revisaoModo) => (
  normalizeRevisaoModoCiclo(revisaoModo) === REVISAO_MODO_SUGESTAO ? 1 : null
);

export const getRevisaoEscolhidaPlaceholder = (contextoRegistro, revisaoModo) => (
  contextoRegistro === 'ciclo' ? getRevisaoEscolhidaInicial(revisaoModo) : 'skip'
);

export const shouldPersistIntervaloRevisao = (contextoRegistro, revisaoEscolhida) => (
  contextoRegistro === 'ciclo' &&
  revisaoEscolhida !== null &&
  revisaoEscolhida !== undefined &&
  revisaoEscolhida !== 'skip'
);
