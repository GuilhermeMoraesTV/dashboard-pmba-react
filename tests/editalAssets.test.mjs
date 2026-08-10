import test from 'node:test';
import assert from 'node:assert/strict';

import { buildEditaisMap, resolveLogoUrl } from '../src/components/admin/config/editalAssets.js';

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
