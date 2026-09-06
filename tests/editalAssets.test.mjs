import test from 'node:test';
import assert from 'node:assert/strict';

import { buildEditaisMap, normalizeSlug, resolveLogoUrl } from '../src/components/admin/config/editalAssets.js';

test('normalizeSlug lida com seguranca com null, undefined e tipos nao string', () => {
  assert.equal(normalizeSlug(null), '');
  assert.equal(normalizeSlug(undefined), '');
  assert.equal(normalizeSlug(''), '');
  assert.equal(normalizeSlug('ALECE'), 'alece');
  assert.equal(normalizeSlug('GCM Viana - ES'), 'gcmvianaes');
  assert.equal(normalizeSlug(12345), '12345');
});

test('resolve os nomes legados do campo de logo', () => {
  assert.equal(resolveLogoUrl({ ciclo: { logo: '/logo-legada.png' } }), '/logo-legada.png');
  assert.equal(resolveLogoUrl({ ciclo: { editalLogoUrl: '/logo-edital.png' } }), '/logo-edital.png');
});

test('resolve ciclo antigo pelo editalId no catalogo', () => {
  const editaisMap = buildEditaisMap([
    { id: 'pmmg_soldado', logoUrl: '/logosEditais/logo-pmmg.png' },
  ]);

  assert.equal(
    resolveLogoUrl({ ciclo: { editalId: 'pmmg_soldado' }, editaisMap }),
    '/logosEditais/logo-pmmg.png',
  );
});

test('prioriza a logo atual do catalogo sobre a copia antiga do planejamento', () => {
  const editaisMap = buildEditaisMap([
    { id: 'pmmg_soldado', logoUrl: '/logosEditais/logo-pmmg.png' },
  ]);

  assert.equal(
    resolveLogoUrl({
      ciclo: { templateId: 'pmmg_soldado', logoUrl: '/logosEditais/logo-antiga.png' },
      editaisMap,
    }),
    '/logosEditais/logo-pmmg.png',
  );
});

test('resolve ciclo antigo pelo templateOrigem no catalogo', () => {
  const editaisMap = buildEditaisMap([
    { id: 'sac_ba', logo: 'https://cdn.exemplo/logo-sac.png' },
  ]);

  assert.equal(
    resolveLogoUrl({ ciclo: { templateOrigem: 'sac_ba' }, editaisMap }),
    'https://cdn.exemplo/logo-sac.png',
  );
});

test('resolve aliases conhecidos quando o id antigo nao coincide com o catalogo', () => {
  assert.equal(
    resolveLogoUrl({ ciclo: { templateId: 'edital_pmmg_soldado_2026' } }),
    '/logosEditais/logo-pmmg.png',
  );
  assert.equal(
    resolveLogoUrl({ ciclo: { nome: 'GCM Salvador - BA' } }),
    '/logosEditais/logo-gcmsalvador.png',
  );
});

test('nao lanca excecao para ciclos com templateOrigem null e campos nulos (caso ALECE/DATAPREV)', () => {
  // Caso similar ao ALECE: templateOrigem null, sem logo, nome valido
  assert.equal(
    resolveLogoUrl({
      ciclo: {
        templateOrigem: null,
        nome: 'ALECE',
        titulo: null,
        instituicao: null,
      },
    }),
    '/logosEditais/logo-alece.png',
  );

  // Caso DATAPREV: ciclo legado manual sem template e sem logo cadastrada
  assert.equal(
    resolveLogoUrl({
      ciclo: {
        id: 'dataprev-123',
        nome: 'DATAPREV ADMINISTRAÇÃO E GOVERNANÇA',
        templateOrigem: null,
        templateId: null,
        editalId: null,
        logo: null,
        logoUrl: null,
        editalLogoUrl: null,
        titulo: null,
        instituicao: null,
      },
    }),
    '/logosEditais/logo-dataprevadministracaoegovernanca.png',
  );

  // Ciclo completamente sem dados ou com campos nulos
  assert.equal(
    resolveLogoUrl({
      ciclo: {
        templateOrigem: null,
        nome: null,
        titulo: null,
        instituicao: null,
      },
    }),
    null,
  );

  // Ciclo legado sem correspondencia de logo e nome curto
  assert.equal(
    resolveLogoUrl({
      ciclo: {
        templateOrigem: null,
        nome: 'AB',
        titulo: null,
        instituicao: null,
      },
    }),
    null,
  );

  // Invocacoes com parametros vazios ou nulos
  assert.equal(resolveLogoUrl({ ciclo: null }), null);
  assert.equal(resolveLogoUrl(), null);
  assert.equal(resolveLogoUrl({}), null);
});

test('mantem fallbacks legados de concursos historicos com campos nulos', () => {
  assert.equal(
    resolveLogoUrl({
      ciclo: {
        templateOrigem: null,
        nome: 'Edital PMBA 2026',
        titulo: null,
        instituicao: null,
      },
    }),
    '/logosEditais/logo-pmba.png',
  );

  assert.equal(
    resolveLogoUrl({
      ciclo: {
        templateOrigem: null,
        nome: 'Concurso PMAL Soldado',
        titulo: null,
        instituicao: null,
      },
    }),
    '/logosEditais/logo-pmal.png',
  );
});
