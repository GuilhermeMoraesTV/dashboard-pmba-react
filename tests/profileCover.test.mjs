import test from 'node:test';
import assert from 'node:assert/strict';
import {
  coverPositionToStyle,
  hasCoverPositionChanged,
  moveCoverPosition,
  normalizeCoverPosition,
} from '../src/utils/profileCover.js';

test('normaliza uma posicao de capa legada ou invalida', () => {
  assert.deepEqual(normalizeCoverPosition(), { x: 50, y: 50 });
  assert.deepEqual(normalizeCoverPosition({ x: -20, y: 140 }), { x: 0, y: 100 });
  assert.equal(coverPositionToStyle({ x: 25, y: 75 }), '25% 75%');
});

test('arraste horizontal acompanha o excedente real da imagem sem distorcer', () => {
  const moved = moveCoverPosition({
    position: { x: 50, y: 50 },
    deltaX: 150,
    deltaY: 0,
    containerWidth: 300,
    containerHeight: 100,
    imageWidth: 600,
    imageHeight: 100,
  });

  assert.deepEqual(moved, { x: 0, y: 50 });
});

test('arraste vertical respeita limites e detecta alteracao persistivel', () => {
  const moved = moveCoverPosition({
    position: { x: 50, y: 50 },
    deltaX: 0,
    deltaY: -100,
    containerWidth: 300,
    containerHeight: 100,
    imageWidth: 300,
    imageHeight: 300,
  });

  assert.deepEqual(moved, { x: 50, y: 100 });
  assert.equal(hasCoverPositionChanged(moved, { x: 50, y: 50 }), true);
  assert.equal(hasCoverPositionChanged({ x: 50, y: 50 }, null), false);
});
