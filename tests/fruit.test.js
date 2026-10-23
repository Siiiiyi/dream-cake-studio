import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { makeBerryGeometry, makeStrawberryGeometry, makeStrawberryLeafGeometry, STRAWBERRY_HEIGHT, strawberrySeeds, strawberryPoint } from '../src/fruitSurface.js';

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
  assert.ok(width > 0.44 && width < 0.52);
  assert.ok(depth > 0.43 && depth < 0.52);
  assert.ok(Math.abs(box.max.y - STRAWBERRY_HEIGHT) < 0.002);
  assert.ok((box.max.y - box.min.y) / depth < 1.35);
  assert.ok(new Set(seeds.map(seed => seed.point.y.toFixed(4))).size > seeds.length * 0.8);
  assert.ok(seeds.every(seed => Math.abs(seed.normal.length() - 1) < 0.0001));
  geometry.dispose();
  const leaf = makeStrawberryLeafGeometry(); leaf.computeBoundingBox();
  const leafLength = leaf.boundingBox.max.x, leafWidth = leaf.boundingBox.max.z - leaf.boundingBox.min.z;
  assert.ok(leafLength > 0.25 && leafLength < 0.31);
  assert.ok(leafWidth / leafLength > 0.4);
  assert.ok(leaf.boundingBox.min.y < -0.015 && leaf.boundingBox.max.y < 0.02);
  leaf.dispose();
});

test('strawberries have a long taper, broad shoulders and a rounded cap without a spike', () => {
  const lower = strawberryPoint(STRAWBERRY_HEIGHT * 0.2, 0);
  const shoulder = strawberryPoint(STRAWBERRY_HEIGHT * 0.65, 0);
  assert.ok(shoulder.x > lower.x * 1.7);
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

test('calyx unfolds across the fruit shoulder with connected roots and unequal curled tips', () => {
  const bounds = new THREE.Box3(), lengths = [], tips = [];
  for (let i = 0; i < 7; i++) {
    const angle = i / 7 * Math.PI * 2 + 0.22 * Math.sin(i * 3);
    const leaf = makeStrawberryLeafGeometry(angle), p = leaf.attributes.position;
    assert.ok(Math.hypot(p.getX(0), p.getY(0), p.getZ(0)) < 0.0001);
    assert.ok(p.array.every(Number.isFinite));
    const tip = new THREE.Vector3().fromBufferAttribute(p, p.count - 1);
    lengths.push(tip.x); tips.push(tip.y);
    leaf.rotateY(-angle); leaf.computeBoundingBox(); bounds.union(leaf.boundingBox); leaf.dispose();
  }
  const span = bounds.getSize(new THREE.Vector3());
  assert.ok(span.x > 0.49 && span.x < 0.65);
  assert.ok(span.z > 0.49 && span.z < 0.65);
  assert.ok(Math.max(...lengths) - Math.min(...lengths) > 0.05);
  assert.ok(Math.max(...tips) - Math.min(...tips) > 0.02);
});
