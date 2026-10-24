import * as THREE from 'three';
import { FROST_RADIUS, FLAT_RADIUS, RIM_END, COAT_EMBED, FROST_CONTOUR, bladeCoverage, creamContribution, coatingHeight, cakeSurface, coatedSurface, levelCreamMass, levelingWork, spatulaPasses } from './frosting.js';
import { resolveFrostingColor } from './catalog.js';
import { clipFrostingContour } from './frostingContour.js';

const layouts = new Map();
const TAU = Math.PI * 2;

function surfaceLayout(resolution) {
  if (layouts.has(resolution)) return layouts.get(resolution);
  const segments = Math.ceil(resolution * 1.2 / 8) * 8, rings = [];
  function section(from, to, steps) {
    for (let i = 1; i <= steps; i++) rings.push({ u: from + (to - from) * i / steps, start: 1 + rings.length * segments });
  }
  section(0, FLAT_RADIUS, Math.round(resolution * 0.38));
  section(FLAT_RADIUS, RIM_END, 10);
  section(RIM_END, FROST_RADIUS, Math.ceil((FROST_RADIUS - RIM_END) / 0.022));
  const count = 1 + rings.length * segments;
  const px = new Float32Array(count), pz = new Float32Array(count), base = new Float32Array(count * 3), normal = new Float32Array(count * 3), uv = new Float32Array(count * 2);
  function vertex(index, x, z) {
    const surface = cakeSurface(x, z);
    px[index] = x; pz[index] = z;
    base.set([surface.x, surface.y, surface.z], index * 3); normal.set([surface.nx, surface.ny, surface.nz], index * 3);
    uv.set([x / (FROST_RADIUS * 2) + 0.5, z / (FROST_RADIUS * 2) + 0.5], index * 2);
  }
  vertex(0, 0, 0);
  for (const ring of rings) for (let i = 0; i < segments; i++) vertex(ring.start + i, Math.cos(i / segments * TAU) * ring.u, Math.sin(i / segments * TAU) * ring.u);
  const triangles = [];
  for (let i = 0; i < segments; i++) triangles.push(0, 1 + (i + 1) % segments, 1 + i);
  for (let row = 0; row < rings.length - 1; row++) for (let i = 0; i < segments; i++) {
    const next = (i + 1) % segments, a = rings[row].start + i, b = rings[row].start + next, c = rings[row + 1].start + i, d = rings[row + 1].start + next;
    triangles.push(a, b, c, b, d, c);
  }
  const layout = { count, segments, rings, px, pz, base, normal, uv, triangles };
  layouts.set(resolution, layout);
  return layout;
}

export function makeFrostingGeometry(strokes, resolution = 161, bare = false) {
  const layout = surfaceLayout(resolution), { count, px, pz, rings, segments } = layout;
  const coverage = new Float32Array(count), mass = new Float32Array(count), work = new Float32Array(count), angles = new Float32Array(count), colors = new Float32Array(count * 3);
  const localCoverage = new Float32Array(count), localMass = new Float32Array(count), visited = new Uint8Array(count);
  for (const stroke of spatulaPasses(strokes)) {
    const color = new THREE.Color(resolveFrostingColor(stroke.color)), touched = [];
    localCoverage.fill(0); localMass.fill(0); visited.fill(0);
    for (const point of stroke.points) {
      if ((point.amount ?? 1) <= 0) continue;
      const distance = Math.hypot(point.x, point.z), angle = Math.atan2(point.z, point.x);
      const visit = index => {
        const value = bladeCoverage(px[index], pz[index], point);
        if (value <= 0) return;
        if (!visited[index]) { visited[index] = 1; touched.push(index); }
        localCoverage[index] = Math.max(localCoverage[index], value);
        const deposited = creamContribution(px[index], pz[index], point);
        if (deposited >= localMass[index]) { localMass[index] = deposited; angles[index] = point.angle; }
      };
      if (distance <= point.radius) visit(0);
      for (const ring of rings) {
        if (Math.abs(ring.u - distance) > point.radius) continue;
        const cosine = distance > 1e-8 ? (ring.u * ring.u + distance * distance - point.radius * point.radius) / (2 * ring.u * distance) : -1;
        const span = Math.acos(Math.max(-1, Math.min(1, cosine)));
        const first = Math.floor((angle - span) / TAU * segments), last = Math.ceil((angle + span) / TAU * segments);
        if (last - first >= segments) { for (let i = 0; i < segments; i++) visit(ring.start + i); }
        else for (let i = first; i <= last; i++) visit(ring.start + (i % segments + segments) % segments);
      }
    }
    for (const index of touched) {
      const value = localCoverage[index], blend = coverage[index] > 0 ? Math.min(1, value * 1.5) : 1;
      colors[index * 3] = THREE.MathUtils.lerp(colors[index * 3], color.r, blend);
      colors[index * 3 + 1] = THREE.MathUtils.lerp(colors[index * 3 + 1], color.g, blend);
      colors[index * 3 + 2] = THREE.MathUtils.lerp(colors[index * 3 + 2], color.b, blend);
      work[index] += levelingWork(coverage[index], value);
      mass[index] = levelCreamMass(mass[index], coverage[index], value, localMass[index]);
      coverage[index] = Math.max(coverage[index], value);
    }
  }
  const edges = [];
  const { top, boundary, contourIndices } = bare ? { top: layout.triangles, boundary: new Map(), contourIndices: [] } : clipFrostingContour(layout, coverage, strokes, (a, b, x, z, height) => {
    const inside = coverage[a] >= FROST_CONTOUR ? a : b;
    edges.push({ x, z, height, color: colors.slice(inside * 3, inside * 3 + 3) });
    return count + edges.length - 1;
  });
  const surfaceCount = count + edges.length, vertexCount = bare ? surfaceCount : surfaceCount * 2;
  const positions = new Float32Array(vertexCount * 3), tints = new Float32Array(vertexCount * 3), uv = new Float32Array(vertexCount * 2);
  for (let i = 0; i < surfaceCount; i++) {
    const edge = i >= count ? edges[i - count] : null, x = edge ? edge.x : px[i], z = edge ? edge.z : pz[i];
    const height = bare ? 0 : (edge ? edge.height : coatingHeight(coverage[i], x, z, angles[i], mass[i], work[i])) - COAT_EMBED;
    const offset = i * 3;
    const base = edge ? cakeSurface(x, z) : {
      x: layout.base[offset], y: layout.base[offset + 1], z: layout.base[offset + 2],
      nx: layout.normal[offset], ny: layout.normal[offset + 1], nz: layout.normal[offset + 2],
    };
    const outer = bare ? null : coatedSurface(x, z, height, base);
    for (let c = 0; c < 3; c++) {
      positions[i * 3 + c] = bare ? layout.base[i * 3 + c] : c === 0 ? outer.x : c === 1 ? outer.y : outer.z;
      tints[i * 3 + c] = edge ? edge.color[c] : colors[i * 3 + c];
      if (!bare) {
        positions[(i + surfaceCount) * 3 + c] = c === 0 ? base.x - base.nx * COAT_EMBED : c === 1 ? base.y - base.ny * COAT_EMBED : base.z - base.nz * COAT_EMBED;
        tints[(i + surfaceCount) * 3 + c] = tints[i * 3 + c];
      }
    }
    uv.set([x / (FROST_RADIUS * 2) + 0.5, z / (FROST_RADIUS * 2) + 0.5], i * 2);
    if (!bare) uv.set(uv.subarray(i * 2, i * 2 + 2), (i + surfaceCount) * 2);
  }
  const indices = [...top];
  if (!bare) {
    for (let i = 0; i < top.length; i += 3) indices.push(top[i] + surfaceCount, top[i + 2] + surfaceCount, top[i + 1] + surfaceCount);
    for (const [a, b] of boundary.values()) indices.push(a, b + surfaceCount, b, a, a + surfaceCount, b + surfaceCount);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(tints, 3));
  geometry.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  geometry.setIndex(indices); geometry.computeVertexNormals(); geometry.computeBoundingSphere();
  geometry.userData.surfaceVertexCount = surfaceCount;
  geometry.userData.gridVertexCount = count;
  geometry.userData.contourIndices = contourIndices;
  return geometry;
}
