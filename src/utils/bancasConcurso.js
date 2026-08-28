export const PRINCIPAIS_BANCAS_CONCURSO = [
  'A definir',
  'Avança SP',
  'Cebraspe',
  'FCC',
  'FGV',
  'Fundação Cesgranrio',
  'Fundatec',
  'IADES',
  'IBFC',
  'IDECAN',
  'INDEPAC',
  'Instituto ACCESS',
  'Instituto AOCP',
  'Instituto Consulpam',
  'Instituto Consulplan',
  'Instituto Nosso Rumo',
  'Instituto Selecon',
  'Legalle Concursos',
  'NUCEPE',
  'Quadrix',
  'Vunesp',
];

const normalizeBancaKey = (value) => String(value || '')
  .trim()
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLocaleLowerCase('pt-BR');

export const buildBancaOptions = (editais = [], currentValue = '') => {
  const options = [];
  const seen = new Set();

  const add = (value) => {
    const label = String(value || '').trim();
    const key = normalizeBancaKey(label);
    if (!label || seen.has(key)) return;
    seen.add(key);
    options.push(label);
  };

  PRINCIPAIS_BANCAS_CONCURSO.forEach(add);

  const catalogBanks = editais
    .map(edital => edital?.banca)
    .filter(Boolean)
    .sort((a, b) => String(a).localeCompare(String(b), 'pt-BR', { sensitivity: 'base' }));

  catalogBanks.forEach(add);
  add(currentValue);

  return options.sort((a, b) => a.localeCompare(b, 'pt-BR', { sensitivity: 'base' }));
};
