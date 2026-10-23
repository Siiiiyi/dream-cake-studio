import test from 'node:test';
import assert from 'node:assert/strict';
import { findPlacement, isValidPosition, updateTopping, MAX_TOPPINGS } from '../src/design.js';
import { toppings } from '../src/catalog.js';

test('every topping can be placed inside the cake without overlap', () => {
  const items = [];
  for (let n = 0; n < 24; n++) {
    const type = toppings[n % toppings.length].id;
    const candidate = findPlacement(type, items);
    if (!candidate) continue;
    assert.equal(isValidPosition(candidate, items), true);
    items.push({ ...candidate, id: String(n) });
  }
  assert.ok(items.length >= 18);
  assert.ok(items.some(item => item.type === 'orange'));
});

test('rejects overlap, off-cake movements and invalid scales', () => {
  const items = [{ id: 'a', type: 'strawberry', scale: 1, x: 0, z: 0 }, { id: 'b', type: 'blueberry', scale: 1, x: 0.7, z: 0 }];
  assert.equal(updateTopping(items, 'a', { x: 2 }), items);
  assert.equal(updateTopping(items, 'a', { x: 0.65 }), items);
  assert.equal(updateTopping(items, 'a', { scale: NaN }), items);
  assert.equal(updateTopping(items, 'a', { x: -0.2 })[0].x, -0.2);
  assert.equal(updateTopping(items, 'a', { scale: 0.1 })[0].scale, 0.65);
  assert.equal(updateTopping(items, 'a', { scale: 3 })[0].scale, 1.5);
});

test('stops adding at the maximum and handles missing selection', () => {
  assert.equal(findPlacement('pearls', Array.from({ length: MAX_TOPPINGS }, () => ({}))), null);
  const items = [];
  assert.equal(updateTopping(items, 'missing', { scale: 1 }), items);
});
