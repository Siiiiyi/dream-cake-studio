import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { makeBerryGeometry, makeStrawberryGeometry, makeStandingStrawberryGeometry, STRAWBERRY_HEIGHT, STRAWBERRY_SEAT_HEIGHT, strawberrySeeds, strawberryPoint } from '../src/fruitSurface.js';
import { toppings, STRAWBERRY_MODEL_SCALE } from '../src/catalog.js';

test('fruit surfaces have finite normals and actual color variation', () => {
  const seeds = strawberrySeeds();
  assert.ok(seeds.length > 60);
  for (const geometry of [makeStrawberryGeometry(seeds), makeBerryGeometry('blueberry'), makeBerryGeometry('cherry'), makeBerryGeometry('raspberry')]) {
    for (const name of ['position', 'normal', 'color']) assert.ok(geometry.attributes[name].array.every(Number.isFinite));
    const colors = geometry.attributes.color.array;
    let min = Infinity, max = -Infinity;
    for (let i = 0; i < colors.length; i += 3) { min = Math.min(min, colors[i]); max = Math.max(max, colors[i]); }
    assert.ok(max - min > 0.02);
    geometry.dispose();
  }
});

test('blueberries have a recessed crown instead of a perfect sphere', () => {
  const geometry = makeBerryGeometry('blueberry'), p = geometry.attributes.position;
  let center = Infinity, shoulder = 0;
  for (let i = 0; i < p.count; i++) {
    if (p.getY(i) < 0.2) continue;
    const radius = Math.hypot(p.getX(i), p.getZ(i));
    if (radius < 0.01) center = Math.min(center, p.getY(i));
    if (radius > 0.04 && radius < 0.07) shoulder = Math.max(shoulder, p.getY(i));
  }
  assert.ok(shoulder > center + 0.004); geometry.dispose();
});

test('strawberries keep full fruit proportions and an irregular embedded seed layout', () => {
  const seeds = strawberrySeeds(), geometry = makeStrawberryGeometry(seeds);
  geometry.computeBoundingBox();
  const box = geometry.boundingBox, width = box.max.x - box.min.x, depth = box.max.z - box.min.z;
  assert.ok(width > 0.45 && width < 0.5);
  assert.ok(depth > 0.43 && depth < 0.48);
  assert.ok(Math.abs(box.max.y - STRAWBERRY_HEIGHT) < 0.002);
  assert.ok((box.max.y - box.min.y) / depth > 1.35);
  assert.ok((box.max.y - box.min.y) / depth < 1.55);
  assert.ok(new Set(seeds.map(seed => seed.point.y.toFixed(4))).size > seeds.length * 0.8);
  assert.ok(seeds.every(seed => Math.abs(seed.normal.length() - 1) < 0.0001));
  geometry.dispose();
});

test('strawberries have full shoulders and a short rounded tip without a spike', () => {
  const lower = strawberryPoint(STRAWBERRY_HEIGHT * 0.2, 0);
  const shoulder = strawberryPoint(STRAWBERRY_HEIGHT * 0.65, 0);
  assert.ok(shoulder.x > lower.x * 1.7);
  // The tip opens promptly into the flesh instead of extending as a thin cone.
  const tip = strawberryPoint(STRAWBERRY_HEIGHT * 0.04, 0);
  assert.ok(tip.x / shoulder.x > 0.2 && tip.x / shoulder.x < 0.26);
  const upperFlesh = strawberryPoint(STRAWBERRY_HEIGHT * 0.3, 0);
  assert.ok(upperFlesh.x / shoulder.x > 0.64);
  const capRatio = strawberryPoint(STRAWBERRY_HEIGHT * 0.004, 0).x / strawberryPoint(STRAWBERRY_HEIGHT * 0.001, 0).x;
  assert.ok(capRatio > 1.8 && capRatio < 2.2);
  let previous = 0;
  for (let t = 0.01; t < 0.62; t += 0.01) {
    const radius = strawberryPoint(STRAWBERRY_HEIGHT * t, 0).x;
    assert.ok(radius > previous); previous = radius;
  }
  assert.ok(Math.hypot(...strawberryPoint(0, 0).toArray()) < 0.001);
  const geometry = makeStrawberryGeometry(strawberrySeeds());
  assert.ok(Math.max(...geometry.attributes.seedDepth.array) > 0.002);
  geometry.dispose();
});

test('tip-up strawberries preserve flesh colors, texture coordinates and seed pockets', () => {
  const seeds = strawberrySeeds(), original = makeStrawberryGeometry(seeds), standing = makeStandingStrawberryGeometry(seeds);
  for (const name of ['color', 'uv', 'seedDepth']) assert.deepEqual(standing.attributes[name].array, original.attributes[name].array);
  const before = original.attributes.position, after = standing.attributes.position;
  for (let i = 0; i < before.count; i++) {
    assert.equal(after.getX(i), before.getX(i));
    assert.equal(after.getZ(i), before.getZ(i));
    if (before.getY(i) <= STRAWBERRY_SEAT_HEIGHT) assert.equal(after.getY(i), before.getY(i));
  }
  assert.ok(standing.attributes.normal.array.every(Number.isFinite));
  assert.ok(seeds.every(seed => seed.point.y + 0.005 < STRAWBERRY_SEAT_HEIGHT));
  original.dispose(); standing.dispose();
});

test('tip-up strawberries sit on a wide base at every allowed scale within the collision footprint', () => {
  const geometry = makeStandingStrawberryGeometry(strawberrySeeds());
  geometry.rotateX(Math.PI); geometry.translate(0, STRAWBERRY_SEAT_HEIGHT, 0);
  const p = geometry.attributes.position, footprint = toppings.find(item => item.id === 'strawberry').radius;
  let baseRadius = 0, tipRadius = 0, contacts = 0;
  for (const scale of [0.65, 1, 1.5]) for (let i = 0; i < p.count; i++) {
    const y = p.getY(i) * scale, radius = Math.hypot(p.getX(i), p.getZ(i));
    assert.ok(y >= -1e-7 && y <= STRAWBERRY_SEAT_HEIGHT * scale + 1e-7);
    assert.ok(radius * STRAWBERRY_MODEL_SCALE * scale <= footprint * scale);
    if (Math.abs(y) < 1e-7) { baseRadius = Math.max(baseRadius, radius); contacts++; }
    if (p.getY(i) > STRAWBERRY_SEAT_HEIGHT - 0.015) tipRadius = Math.max(tipRadius, radius);
  }
  assert.ok(contacts > 100 && baseRadius > 0.1 && baseRadius < 0.15);
  assert.ok(tipRadius < baseRadius * 0.4);
  let widestRadius = 0, widestHeight = 0;
  for (let i = 0; i < p.count; i++) {
    const radius = Math.hypot(p.getX(i), p.getZ(i));
    if (radius > widestRadius) { widestRadius = radius; widestHeight = p.getY(i); }
  }
  assert.ok(widestRadius > baseRadius * 1.5);
  assert.ok(widestHeight > STRAWBERRY_SEAT_HEIGHT * 0.2);
  const aspect = STRAWBERRY_SEAT_HEIGHT / (widestRadius * 2);
  assert.ok(aspect > 1.25 && aspect < 1.4);
  geometry.dispose();
});

test('decoration strawberries scale uniformly about their contact base and remain larger than blueberries', () => {
  const strawberry = makeStandingStrawberryGeometry(strawberrySeeds());
  strawberry.rotateX(Math.PI); strawberry.translate(0, STRAWBERRY_SEAT_HEIGHT, 0);
  strawberry.computeBoundingBox();
  const original = strawberry.boundingBox.getSize(new THREE.Vector3());
  strawberry.scale(STRAWBERRY_MODEL_SCALE, STRAWBERRY_MODEL_SCALE, STRAWBERRY_MODEL_SCALE);
  strawberry.computeBoundingBox();
  const size = strawberry.boundingBox.getSize(new THREE.Vector3());
  for (const axis of ['x', 'y', 'z']) assert.ok(Math.abs(size[axis] / original[axis] - STRAWBERRY_MODEL_SCALE) < 1e-6);
  const blueberry = makeBerryGeometry('blueberry'); blueberry.computeBoundingBox();
  const blueberryWidth = blueberry.boundingBox.getSize(new THREE.Vector3()).x;
  assert.ok(size.x / blueberryWidth > 1.15 && size.x / blueberryWidth < 1.4);
  assert.ok(size.x < 0.4 && size.y < 0.51);
  for (const scale of [0.65, 1, 1.5]) {
    assert.ok(Math.abs(strawberry.boundingBox.min.y * scale) < 1e-7);
    assert.ok(size.x * scale < toppings.find(item => item.id === 'strawberry').radius * 2 * scale);
  }
  strawberry.dispose(); blueberry.dispose();
});
