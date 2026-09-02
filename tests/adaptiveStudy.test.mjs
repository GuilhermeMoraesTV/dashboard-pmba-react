import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import {
  ADAPTIVE_QUEUE_STATES,
  ADAPTIVE_SESSION_STATUSES,
  COGNITIVE_DIFFICULTIES,
  QUALITY_RATINGS,
} from '../src/contracts/index.js';
import { DEFAULT_PRODUCT_LIMITS } from '../src/config/productLimits.js';

const require = createRequire(import.meta.url);
const {
  adaptiveCardSchema,
  chooseCognitiveDifficulty,
  contentFingerprint,
  evolveMastery,
  masteryDocumentId,
  selectConceptPlans,
} = require('../functions/adaptiveStudy/service.js');

test('dificuldade cognitiva easy/hard permanece separada dos quatro ratings do scheduler', () => {
  assert.deepEqual(COGNITIVE_DIFFICULTIES, ['easy', 'hard']);
  assert.deepEqual(QUALITY_RATINGS, ['again', 'hard', 'good', 'easy']);
  assert.deepEqual(ADAPTIVE_SESSION_STATUSES, ['active', 'completed', 'cancelled', 'error']);
  assert.deepEqual(ADAPTIVE_QUEUE_STATES, ['generating', 'ready', 'served', 'consumed', 'cancelled', 'error']);
});

test('buffer usa valores internos pequenos e nao uma quantidade solicitada pelo usuario', () => {
  assert.equal(DEFAULT_PRODUCT_LIMITS.adaptiveStudy.targetReady, 4);
  assert.equal(DEFAULT_PRODUCT_LIMITS.adaptiveStudy.lowWatermark, 3);
  assert.equal(DEFAULT_PRODUCT_LIMITS.adaptiveStudy.refillSize, 4);
});

test('Again aumenta prioridade e duas recuperacoes reduzem o boost', () => {
  const firstError = evolveMastery({}, 'again', { itemId: 'i1', at: '2026-08-30T12:00:00.000Z' });
  const secondError = evolveMastery(firstError, 'again', { itemId: 'i2', at: '2026-08-30T12:01:00.000Z' });
  assert.equal(secondError.wrongCount, 2);
  assert.equal(secondError.wrongStreak, 2);
  assert.equal(secondError.priorityBoost, 4);
  assert.equal(secondError.learningStage, 'reinforcing');
  assert.equal(chooseCognitiveDifficulty(secondError), 'easy');

  const recoveredOnce = evolveMastery(secondError, 'good', { itemId: 'i3' });
  const recoveredTwice = evolveMastery(recoveredOnce, 'easy', { itemId: 'i4' });
  assert.ok(recoveredTwice.priorityBoost < secondError.priorityBoost);
  assert.equal(recoveredTwice.correctStreak, 2);
});

test('reforco reutiliza conceito, muda variantKey e progride easy para hard apos dominio', () => {
  const concepts = [{ conceptId: 'concept-x', name: 'Conceito X', summary: 'Resumo', sourceRefKeys: ['source:chunk_1'] }];
  const wrongMastery = new Map([['concept-x', { exposures: 2, wrongStreak: 2, priorityBoost: 4 }]]);
  const plans = selectConceptPlans(concepts, wrongMastery, 2, [
    { conceptId: 'concept-x', variantKey: 'concept-x:easy:v1' },
  ]);
  assert.equal(plans[0].conceptId, 'concept-x');
  assert.equal(plans[0].cognitiveDifficulty, 'easy');
  assert.equal(plans[0].variantKey, 'concept-x:easy:v2');
  assert.equal(plans[1].variantKey, 'concept-x:easy:v3');

  const recovered = new Map([['concept-x', { exposures: 5, correctStreak: 3, priorityBoost: 0 }]]);
  assert.equal(selectConceptPlans(concepts, recovered, 1, [])[0].cognitiveDifficulty, 'hard');
});

test('fingerprint deduplica equivalentes textuais e masteryId e deterministico', () => {
  assert.equal(contentFingerprint(' O que é Legalidade? ', 'Resposta direta.'), contentFingerprint('o que e legalidade', 'resposta direta'));
  assert.equal(masteryDocumentId('source-1', 'concept-1'), masteryDocumentId('source-1', 'concept-1'));
  assert.notEqual(masteryDocumentId('source-1', 'concept-1'), masteryDocumentId('source-1', 'concept-2'));
});

test('schema adaptativo exige conceito, variante, dificuldade e referencias de fonte', () => {
  const item = adaptiveCardSchema(3).properties.items.items;
  assert.ok(item.required.includes('conceptId'));
  assert.ok(item.required.includes('cognitiveDifficulty'));
  assert.ok(item.required.includes('variantKey'));
  assert.ok(item.required.includes('sourceRefKeys'));
  assert.deepEqual(item.properties.cognitiveDifficulty.enum, ['easy', 'hard']);
});
