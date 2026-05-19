// src/utils/estadosSlugs.js
// Dicionário ÚNICO e autoritativo de slugs dos estados brasileiros
// ⚠️  Esta tabela é a fonte da verdade — filtroNoticias.js importa daqui.
//
// Regra de slug (alinhada com o Estratégia Concursos):
//   AL → alagoas | BA → bahia | RO → rondonia
//   Todos os outros → sigla minúscula (ex: SP → sp, RJ → rj)

export const ESTADOS_SLUGS = {
  AC: 'ac',
  AL: 'alagoas',
  AP: 'ap',
  AM: 'am',
  BA: 'bahia',
  CE: 'ce',
  DF: 'df',
  ES: 'es',
  GO: 'go',
  MA: 'ma',
  MT: 'mt',
  MS: 'ms',
  MG: 'mg',
  PA: 'pa',
  PB: 'pb',
  PR: 'pr',
  PE: 'pe',
  PI: 'pi',
  RJ: 'rj',
  RN: 'rn',
  RS: 'rs',
  RO: 'rondonia',
  RR: 'rr',
  SC: 'sc',
  SP: 'sp',
  SE: 'se',
  TO: 'to',
};

// Lista completa de estados para exibição em UI
export const ESTADOS_LISTA = [
  { uf: 'AC', nome: 'Acre',               slug: 'ac'               },
  { uf: 'AL', nome: 'Alagoas',            slug: 'alagoas'          },
  { uf: 'AP', nome: 'Amapá',              slug: 'ap'               },
  { uf: 'AM', nome: 'Amazonas',           slug: 'am'               },
  { uf: 'BA', nome: 'Bahia',              slug: 'bahia'            },
  { uf: 'CE', nome: 'Ceará',              slug: 'ce'               },
  { uf: 'DF', nome: 'Distrito Federal',   slug: 'df'               },
  { uf: 'ES', nome: 'Espírito Santo',     slug: 'es'               },
  { uf: 'GO', nome: 'Goiás',              slug: 'go'               },
  { uf: 'MA', nome: 'Maranhão',           slug: 'ma'               },
  { uf: 'MT', nome: 'Mato Grosso',        slug: 'mt'               },
  { uf: 'MS', nome: 'Mato Grosso do Sul', slug: 'ms'               },
  { uf: 'MG', nome: 'Minas Gerais',       slug: 'mg'               },
  { uf: 'PA', nome: 'Pará',               slug: 'pa'               },
  { uf: 'PB', nome: 'Paraíba',            slug: 'pb'               },
  { uf: 'PR', nome: 'Paraná',             slug: 'pr'               },
  { uf: 'PE', nome: 'Pernambuco',         slug: 'pe'               },
  { uf: 'PI', nome: 'Piauí',              slug: 'pi'               },
  { uf: 'RJ', nome: 'Rio de Janeiro',     slug: 'rj'               },
  { uf: 'RN', nome: 'Rio Grande do Norte',slug: 'rn'               },
  { uf: 'RS', nome: 'Rio Grande do Sul',  slug: 'rs'               },
  { uf: 'RO', nome: 'Rondônia',           slug: 'rondonia'         },
  { uf: 'RR', nome: 'Roraima',            slug: 'rr'               },
  { uf: 'SC', nome: 'Santa Catarina',     slug: 'sc'               },
  { uf: 'SP', nome: 'São Paulo',          slug: 'sp'               },
  { uf: 'SE', nome: 'Sergipe',            slug: 'se'               },
  { uf: 'TO', nome: 'Tocantins',          slug: 'to'               },
];

// Status possíveis para concursos
export const STATUS_CONCURSO = {
  PREVISTO:   'Previsto',
  AUTORIZADO: 'Autorizado',
  COMISSAO:   'Comissão Formada',
  BANCA:      'Banca Definida',
  EDITAL:     'Edital Publicado',
  SUSPENSO:   'Suspenso',
  ENCERRADO:  'Encerrado',
};

// Cores do badge por status
export const STATUS_CORES = {
  [STATUS_CONCURSO.EDITAL]:     { bg: 'bg-green-100 dark:bg-green-900/30',  text: 'text-green-700 dark:text-green-400',  border: 'border-green-200 dark:border-green-800'  },
  [STATUS_CONCURSO.AUTORIZADO]: { bg: 'bg-yellow-100 dark:bg-yellow-900/30',text: 'text-yellow-700 dark:text-yellow-400', border: 'border-yellow-200 dark:border-yellow-800' },
  [STATUS_CONCURSO.BANCA]:      { bg: 'bg-yellow-100 dark:bg-yellow-900/30',text: 'text-yellow-700 dark:text-yellow-400', border: 'border-yellow-200 dark:border-yellow-800' },
  [STATUS_CONCURSO.PREVISTO]:   { bg: 'bg-blue-100 dark:bg-blue-900/30',    text: 'text-blue-700 dark:text-blue-400',    border: 'border-blue-200 dark:border-blue-800'    },
  [STATUS_CONCURSO.COMISSAO]:   { bg: 'bg-blue-100 dark:bg-blue-900/30',    text: 'text-blue-700 dark:text-blue-400',    border: 'border-blue-200 dark:border-blue-800'    },
  [STATUS_CONCURSO.SUSPENSO]:   { bg: 'bg-red-100 dark:bg-red-900/30',      text: 'text-red-700 dark:text-red-400',      border: 'border-red-200 dark:border-red-800'      },
  [STATUS_CONCURSO.ENCERRADO]:  { bg: 'bg-gray-100 dark:bg-gray-800/30',    text: 'text-gray-600 dark:text-gray-400',    border: 'border-gray-200 dark:border-gray-700'    },
};

// Converte texto livre de situação para status padronizado
export function situacaoParaStatus(situacao) {
  if (!situacao) return STATUS_CONCURSO.PREVISTO;
  const s = situacao.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  if (s.includes('edital publicado') || s.includes('edital')) return STATUS_CONCURSO.EDITAL;
  if (s.includes('inscric') && s.includes('abert'))           return STATUS_CONCURSO.EDITAL;
  if (s.includes('autoriz'))                                  return STATUS_CONCURSO.AUTORIZADO;
  if (s.includes('comissao') || s.includes('comissão'))       return STATUS_CONCURSO.COMISSAO;
  if (s.includes('banca'))                                    return STATUS_CONCURSO.BANCA;
  if (s.includes('suspenso') || s.includes('cancelado'))      return STATUS_CONCURSO.SUSPENSO;
  if (s.includes('encerrado') || s.includes('finalizado') || s.includes('resultado')) return STATUS_CONCURSO.ENCERRADO;
  if (s.includes('previsto') || s.includes('esperado') || s.includes('previsao'))     return STATUS_CONCURSO.PREVISTO;
  return STATUS_CONCURSO.PREVISTO;
}