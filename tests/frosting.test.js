import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { brushPoints, frostingHeight, toppingHeight, sampleCreamStroke, finishCreamStroke, CAKE_TOP, CAKE_BOTTOM, FROST_RADIUS, MAX_COAT_THICKNESS, COAT_EMBED, FLAT_RADIUS, RIM_END, cakeSurface, coatedSurface, edgeFalloff } from '../src/frosting.js';
import { makeFrostingGeometry } from '../src/frostingGeometry.js';

test('blade sampling follows the pointer and stays inside the paint domain', () => {
  const points = brushPoints({ x: -0.5, z: 0.3 }, { x: 0.5, z: 0.3 });
  assert.ok(points.length >= 28); assert.equal(points.at(-1).x, 0.5);
  assert.ok(points.every(p => p.z === 0.3));
  assert.equal(brushPoints(null, { x: FROST_RADIUS + 0.5, z: 0 }).length, 0);
});

test('cream stays local, varies in height, and overlaps add soft bounded volume', () => {
  const stroke = { color: '#fff2dc', points: brushPoints({ x: -0.6, z: 0 }, { x: 0.6, z: 0 }) };
  const once = frostingHeight(0, 0, [stroke]);
  assert.ok(once > 0.07 && once < 0.12);
  assert.equal(frostingHeight(0, 0.7, [stroke]), 0);
  assert.ok(frostingHeight(0, 0, [stroke, stroke]) > once + 0.015);
  assert.ok(frostingHeight(0, 0, Array(100).fill(stroke)) <= MAX_COAT_THICKNESS);
  for (let x = -0.5; x < 0.5; x += 0.025) assert.ok(frostingHeight(x, 0, [stroke]) > 0.025);
  assert.ok(toppingHeight({ x: 0, z: 0, scale: 1 }, [stroke]) < CAKE_TOP + MAX_COAT_THICKNESS);
});

test('spread cream has a broad soft fold instead of repeated nozzle ridges', () => {
  const stroke = { color: '#fff2dc', points: brushPoints({ x: -0.6, z: 0 }, { x: 0.6, z: 0 }) };
  const heights = Array.from({ length: 81 }, (_, i) => frostingHeight(0, -0.12 + i * 0.003, [stroke]));
  let extrema = 0;
  for (let i = 1; i < heights.length - 1; i++) if ((heights[i] - heights[i - 1]) * (heights[i + 1] - heights[i]) < 0) extrema++;
  assert.ok(extrema <= 3);
  assert.ok(Math.max(...heights) - Math.min(...heights) > 0.005);
  assert.ok(Math.min(...heights) > 0.05);
});

test('slow movements and turns deposit more cream; long strokes and pauses remain usable', () => {
  const from = { x: -0.5, z: 0 }, to = { x: 0.5, z: 0 };
  const slow = sampleCreamStroke(from, to, { elapsed: 500 });
  const fast = sampleCreamStroke(from, to, { elapsed: 40 });
  assert.ok(slow.points[5].amount > fast.points[5].amount);
  const turn = sampleCreamStroke(from, to, { elapsed: 500, previousAngle: Math.PI / 2 });
  assert.ok(turn.points[5].amount > slow.points[5].amount);
  let remaining = 1, previous = { x: -1.2, z: 0 };
  for (let i = 0; i < 8; i++) {
    const next = { x: i % 2 ? -1.2 : 1.2, z: 0 };
    const sampled = sampleCreamStroke(previous, next, { elapsed: 500, remaining });
    remaining = sampled.remaining; previous = next;
  }
  assert.ok(remaining >= 0.68);
  assert.ok(sampleCreamStroke(from, to, { remaining }).points.every(p => p.amount > 0));
  const paused = sampleCreamStroke(from, from, { remaining, elapsed: 30000 });
  assert.equal(paused.remaining, remaining);
  assert.equal(paused.points.length, 0);
  assert.ok(sampleCreamStroke(from, to, { remaining: paused.remaining, elapsed: 30000 }).points.length > 0);
  const stroke = { color: '#fff2dc', points: slow.points };
  assert.ok(finishCreamStroke(stroke).points.at(-1).amount > stroke.points.at(-1).amount);
});

test('rendered geometry uses the same deposited amount as fruit support heights', () => {
  const points = sampleCreamStroke({ x: -0.5, z: 0 }, { x: 0.5, z: 0 }, { elapsed: 400 }).points;
  const strokes = [{ color: '#fff2dc', points }], geometry = makeFrostingGeometry(strokes, 97);
  const p = geometry.attributes.position;
  assert.ok(Math.abs(p.getY(0) - (CAKE_TOP + frostingHeight(0, 0, strokes) - COAT_EMBED)) < 0.00001);
  geometry.dispose();
});

test('paint surface follows the flat top, round lip, and attached upper side', () => {
  const flat = cakeSurface(1, 0), rim = cakeSurface(FLAT_RADIUS + 0.04, 0), side = cakeSurface(RIM_END + 0.1, 0);
  assert.equal(flat.y, CAKE_TOP);
  assert.ok(rim.y < CAKE_TOP && rim.y > CAKE_TOP - 0.07);
  assert.ok(rim.nx > 0 && rim.ny > 0);
  assert.equal(side.x, 1.5); assert.ok(Math.abs(side.ny) < 1e-8);
  assert.ok(Math.abs(side.y - (CAKE_TOP - 0.17)) < 0.001);
});

test('the old upper-side cutoff is continuous and only the physical cake bottom fades', () => {
  const oldBoundary = RIM_END + 0.18;
  assert.equal(edgeFalloff(oldBoundary, 0), 1);
  assert.ok(cakeSurface(oldBoundary + 0.2, 0).y < cakeSurface(oldBoundary, 0).y);
  assert.equal(edgeFalloff(FROST_RADIUS, 0), 0);
  assert.ok(edgeFalloff(FROST_RADIUS - 0.07, 0) > 0.4);
  assert.ok(edgeFalloff(FROST_RADIUS - 0.07, 0) < 0.6);
  assert.ok(Math.abs(cakeSurface(FROST_RADIUS, 0).y - CAKE_BOTTOM) < 0.0001);
});

test('dense side cream bridges layer bevels without creating foam-like folded bands', () => {
  for (let u = RIM_END + 0.05; u < FROST_RADIUS - 0.16; u += 0.01) {
    const base = cakeSurface(u, 0), outer = coatedSurface(u, 0, 0.09);
    assert.equal(outer.y, base.y);
    assert.ok(outer.x >= 1.589 && outer.x < 1.61);
  }
});

test('cream forms a closed solid with a bottom embedded in the sponge', () => {
  const stroke = { color: '#fff2dc', points: brushPoints({ x: 1.1, z: 0 }, { x: FROST_RADIUS - 0.03, z: 0 }) };
  const geometry = makeFrostingGeometry([stroke], 97), count = geometry.userData.surfaceVertexCount;
  const p = geometry.attributes.position, index = geometry.index.array, edges = new Map();
  assert.ok(index.length > 0);
  for (let i = 0; i < index.length; i += 3) for (let j = 0; j < 3; j++) {
    const a = index[i + j], b = index[i + (j + 1) % 3], key = `${Math.min(a, b)}:${Math.max(a, b)}`;
    edges.set(key, (edges.get(key) || 0) + 1);
  }
  assert.ok([...edges.values()].every(count => count === 2));
  for (const vertex of new Set(index)) {
    if (vertex < count) continue;
    const uv = geometry.attributes.uv;
    const surface = cakeSurface((uv.getX(vertex) * 2 - 1) * FROST_RADIUS, (uv.getY(vertex) * 2 - 1) * FROST_RADIUS);
    const offset = (p.getX(vertex) - surface.x) * surface.nx + (p.getY(vertex) - surface.y) * surface.ny + (p.getZ(vertex) - surface.z) * surface.nz;
    assert.ok(Math.abs(offset + COAT_EMBED) < 1e-5);
  }
  assert.ok(p.array.every(Number.isFinite));
  geometry.dispose();
});

test('edge strokes are raycastable on the actual curved surface', () => {
  const geometry = makeFrostingGeometry([], 129, true), mesh = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial());
  const ray = new THREE.Raycaster(new THREE.Vector3(3, CAKE_TOP - 0.13, 0), new THREE.Vector3(-1, 0, 0));
  const hit = ray.intersectObject(mesh)[0];
  assert.ok(hit); assert.ok(Math.abs(hit.point.x - 1.5) < 0.002);
  const u = (hit.uv.x * 2 - 1) * FROST_RADIUS;
  assert.ok(u > RIM_END);
  ray.set(new THREE.Vector3(3, 1.15, 0), new THREE.Vector3(-1, 0, 0));
  const lowerHit = ray.intersectObject(mesh)[0];
  assert.ok(lowerHit); assert.ok(Math.abs(lowerHit.point.x - 1.5) < 0.002);
  assert.ok((lowerHit.uv.x * 2 - 1) * FROST_RADIUS > RIM_END + 0.18);
  geometry.dispose(); mesh.material.dispose();
});
