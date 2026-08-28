import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildEditalVerticalizadoFileName,
  buildEditalLogoCandidates,
  buildEditalLogoFallbackLabel,
  getReviewBoxState,
  getReviewCellLayout,
  PDF_COVER_TYPOGRAPHY,
  PDF_COVER_DESIGNS,
  PDF_CLOSING_DESIGNS,
  PDF_PREMIUM_COVER_DESIGNS,
  PDF_DEFAULT_PAGE_DESIGN,
  PDF_TACTICAL_WATERMARK_DESIGN,
  PDF_FEATURED_COVER_TITLE_SIZE,
  PDF_PHOTO_CARD_DESIGN,
  PDF_TACTICAL_FONT_DESIGNS,
  PDF_FILL_BLANK,
  PDF_FILL_PROGRESS,
  PDF_SCOPE_COMPLETE,
  PDF_SCOPE_PLANNING,
  prepareEditalVerticalizadoDisciplines,
} from '../src/pages/EditalVerticalizadoPdf.js';

test('oferece dez capas, incluindo cinco propostas premium, e cinco encerramentos', () => {
  assert.equal(PDF_COVER_DESIGNS.length, 10);
  assert.equal(PDF_CLOSING_DESIGNS.length, 5);
  assert.equal(PDF_PREMIUM_COVER_DESIGNS.length, 5);
  assert.equal(PDF_DEFAULT_PAGE_DESIGN, 'tactical-grid');
  assert.deepEqual(
    PDF_COVER_DESIGNS.slice(0, 5).map((item) => item.id),
    ['orbital', 'diagonal', 'tactical-grid', 'horizon', 'architectural'],
  );
  assert.deepEqual(
    PDF_PREMIUM_COVER_DESIGNS.map((item) => item.id),
    ['command-shield', 'topographic', 'night-ops', 'kinetic-ribbons', 'precision-radar'],
  );
  assert.equal(PDF_TACTICAL_WATERMARK_DESIGN, 'tactical-grid-watermark');
  assert.equal(PDF_FEATURED_COVER_TITLE_SIZE, 29);
  assert.equal(PDF_PHOTO_CARD_DESIGN, 'photo-card');
  assert.equal(PDF_TACTICAL_FONT_DESIGNS.length, 5);
  assert.equal(new Set(PDF_TACTICAL_FONT_DESIGNS.map((item) => item.family)).size, 5);
});

test('resolve logo oficial conhecido e preserva fallback tipografico para qualquer edital', () => {
  assert.deepEqual(
    buildEditalLogoCandidates({ edital: { id: 'soldado-pmba-2026', nome: 'Policia Militar da Bahia' } }),
    ['/logosEditais/logo-pmba.png', '/logosEditais/logo-soldado-pmba-2026.png'],
  );
  assert.equal(buildEditalLogoFallbackLabel({ nome: 'Policia Militar da Bahia' }), 'PMBA');
  assert.equal(buildEditalLogoFallbackLabel({ nome: 'Concurso Municipal de Exemplo' }), 'CME');
});

test('prioriza todas as fontes persistidas de logo antes dos fallbacks derivados', () => {
  assert.deepEqual(
    buildEditalLogoCandidates({
      edital: {
        id: 'edital_custom_2026',
        logoURL: 'https://cdn.exemplo/logo-legada.svg',
        editalLogoUrl: 'https://cdn.exemplo/logo-planejamento.webp',
        computedLogo: '/logosEditais/logo-calculada.png',
      },
      providedLogo: 'https://cdn.exemplo/logo-atual.avif',
    }),
    [
      'https://cdn.exemplo/logo-atual.avif',
      'https://cdn.exemplo/logo-legada.svg',
      'https://cdn.exemplo/logo-planejamento.webp',
      '/logosEditais/logo-calculada.png',
      '/logosEditais/logo-edital-custom-2026.png',
    ],
  );
});

test('tipografia da capa fica centralizada em um unico ponto de ajuste', () => {
  assert.equal(PDF_COVER_TYPOGRAPHY.headingSize, 19);
  assert.equal(PDF_COVER_TYPOGRAPHY.titleSize, 18);
  assert.equal(PDF_COVER_TYPOGRAPHY.cargoSize, 12);
  assert.equal(PDF_COVER_TYPOGRAPHY.titleFont, 'helvetica');
});

const sourceDisciplines = [
  {
    id: 'portugues',
    nome: 'Língua Portuguesa',
    inCiclo: true,
    assuntos: [
      { nome: 'Interpretação de textos', inCiclo: true },
      { nome: 'Crase', inCiclo: false },
    ],
  },
  {
    id: 'informatica',
    nome: 'Informática',
    inCiclo: false,
    assuntos: ['Segurança da informação'],
  },
];

const progressDisciplines = [
  {
    nome: 'Lingua Portuguesa',
    assuntos: [
      { nome: 'Interpretacao de textos', estudado: true, qtdVezes: 5, questoes: 42, acertos: 35 },
      { nome: 'Crase', estudado: false, qtdVezes: 0, questoes: 0, acertos: 0 },
    ],
  },
];

test('planejamento em branco inclui somente disciplinas e assuntos selecionados', () => {
  const result = prepareEditalVerticalizadoDisciplines({
    sourceDisciplines,
    progressDisciplines,
    scope: PDF_SCOPE_PLANNING,
    fillMode: PDF_FILL_BLANK,
  });

  assert.equal(result.length, 1);
  assert.equal(result[0].nome, 'Língua Portuguesa');
  assert.deepEqual(result[0].assuntos.map((item) => item.nome), ['Interpretação de textos']);
  assert.equal(result[0].assuntos[0].estudado, false);
  assert.equal(result[0].assuntos[0].questoes, null);
  assert.equal(result[0].assuntos[0].acertos, null);
});

test('planejamento com progresso preenche teoria, revisoes, questoes e acertos', () => {
  const [discipline] = prepareEditalVerticalizadoDisciplines({
    sourceDisciplines,
    progressDisciplines,
    scope: PDF_SCOPE_PLANNING,
    fillMode: PDF_FILL_PROGRESS,
  });
  const [topic] = discipline.assuntos;

  assert.equal(topic.estudado, true);
  assert.equal(topic.qtdVezes, 5);
  assert.equal(topic.questoes, 42);
  assert.equal(topic.acertos, 35);
});

test('edital completo em branco preserva disciplinas e assuntos fora do planejamento', () => {
  const result = prepareEditalVerticalizadoDisciplines({
    sourceDisciplines,
    progressDisciplines,
    scope: PDF_SCOPE_COMPLETE,
    fillMode: PDF_FILL_BLANK,
  });

  assert.equal(result.length, 2);
  assert.deepEqual(result[0].assuntos.map((item) => item.nome), ['Interpretação de textos', 'Crase']);
  assert.equal(result[1].nome, 'Informática');
});

test('edital externo gera conteudo completo sem depender de progresso salvo', () => {
  const result = prepareEditalVerticalizadoDisciplines({
    sourceDisciplines: [{ nome: 'Direito Constitucional', assuntos: ['Direitos fundamentais'] }],
    progressDisciplines: [],
    scope: PDF_SCOPE_COMPLETE,
    fillMode: PDF_FILL_BLANK,
  });

  assert.equal(result.length, 1);
  assert.equal(result[0].assuntos[0].nome, 'Direitos fundamentais');
  assert.equal(result[0].assuntos[0].estudado, false);
  assert.equal(result[0].assuntos[0].questoes, null);
});

test('edital completo com progresso mantém zeros registrados', () => {
  const result = prepareEditalVerticalizadoDisciplines({
    sourceDisciplines,
    progressDisciplines,
    scope: PDF_SCOPE_COMPLETE,
    fillMode: PDF_FILL_PROGRESS,
  });
  const crase = result[0].assuntos[1];

  assert.equal(crase.estudado, false);
  assert.equal(crase.qtdVezes, 0);
  assert.equal(crase.questoes, 0);
  assert.equal(crase.acertos, 0);
});

test('cinco caixas de revisao mostram excedente acima de cinco', () => {
  assert.deepEqual(getReviewBoxState(7, PDF_FILL_PROGRESS), {
    boxes: [true, true, true, true, true],
    extra: 2,
    total: 7,
  });
  assert.deepEqual(getReviewBoxState(5, PDF_FILL_PROGRESS), {
    boxes: [true, true, true, true, true],
    extra: 0,
    total: 5,
  });
  assert.deepEqual(getReviewBoxState(5, PDF_FILL_BLANK), {
    boxes: [false, false, false, false, false],
    extra: 0,
    total: 0,
  });
});

test('caixas e indicador de revisoes extras permanecem dentro da coluna', () => {
  const columnWidth = 36;
  const layout = getReviewCellLayout(columnWidth, true);

  assert.ok(layout.boxSize > 0);
  assert.ok(layout.totalWidth <= columnWidth - (layout.horizontalPadding * 2));
});

test('nome do arquivo diferencia escopo e preenchimento', () => {
  assert.equal(
    buildEditalVerticalizadoFileName({
      editalName: 'PC-BA - Investigador',
      scope: PDF_SCOPE_COMPLETE,
      fillMode: PDF_FILL_PROGRESS,
    }),
    'edital-verticalizado-pc-ba-investigador-completo-progresso-atual.pdf',
  );
  assert.equal(
    buildEditalVerticalizadoFileName({
      editalName: 'Edital Manual',
      scope: PDF_SCOPE_PLANNING,
      fillMode: PDF_FILL_BLANK,
    }),
    'edital-verticalizado-edital-manual-planejamento-em-branco.pdf',
  );
});
