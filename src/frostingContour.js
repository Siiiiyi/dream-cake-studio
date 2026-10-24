import { bladeCoverage, creamContribution, coatingHeight, levelingWork, levelCreamMass, spatulaPasses, FROST_CONTOUR } from './frosting.js';

export function makeFrostingSampler(strokes) {
  const cells = new Map(), size = 0.4;
  let passIndex = 0;
  for (const stroke of spatulaPasses(strokes)) {
    for (const point of stroke.points) {
      if ((point.amount ?? 1) <= 0) continue;
      const entry = { point, passIndex };
      for (let x = Math.floor((point.x - point.radius) / size); x <= Math.floor((point.x + point.radius) / size); x++) {
        for (let z = Math.floor((point.z - point.radius) / size); z <= Math.floor((point.z + point.radius) / size); z++) {
          const key = `${x}:${z}`;
          if (!cells.has(key)) cells.set(key, []);
          cells.get(key).push(entry);
        }
      }
    }
    passIndex++;
  }
  const nearby = (x, z) => cells.get(`${Math.floor(x / size)}:${Math.floor(z / size)}`) || [];
  const coverageAt = (x, z) => {
    let coverage = 0;
    for (const { point } of nearby(x, z)) {
      coverage = Math.max(coverage, bladeCoverage(x, z, point));
      if (coverage === 1) break;
    }
    return coverage;
  };
  const heightAt = (x, z) => {
    const passes = new Map();
    for (const { point, passIndex } of nearby(x, z)) {
      const coverage = bladeCoverage(x, z, point);
      if (coverage <= 0) continue;
      if (!passes.has(passIndex)) passes.set(passIndex, { coverage: 0, mass: 0, angle: 0 });
      const pass = passes.get(passIndex), mass = creamContribution(x, z, point);
      pass.coverage = Math.max(pass.coverage, coverage);
      if (mass >= pass.mass && mass > 0) { pass.mass = mass; pass.angle = point.angle; }
    }
    let coverage = 0, mass = 0, angle = 0, work = 0;
    for (const pass of passes.values()) {
      work += levelingWork(coverage, pass.coverage);
      mass = levelCreamMass(mass, coverage, pass.coverage, pass.mass);
      coverage = Math.max(coverage, pass.coverage); angle = pass.angle;
    }
    return coatingHeight(coverage, x, z, angle, mass, work);
  };
  return { coverageAt, heightAt };
}

export function makeCoverageSampler(strokes) {
  return makeFrostingSampler(strokes).coverageAt;
}

export function clipFrostingContour(layout, coverage, strokes, appendVertex) {
  const field = makeFrostingSampler(strokes), sample = field.coverageAt, crossings = new Map(), top = [], boundary = new Map();
  function crossing(a, b) {
    const key = `${Math.min(a, b)}:${Math.max(a, b)}`;
    if (crossings.has(key)) return crossings.get(key);
    let inside = coverage[a] >= FROST_CONTOUR ? 0 : 1, outside = 1 - inside;
    const xAt = t => layout.px[a] + (layout.px[b] - layout.px[a]) * t;
    const zAt = t => layout.pz[a] + (layout.pz[b] - layout.pz[a]) * t;
    // Refine the real brush boundary, rather than following a whole grid-cell edge.
    for (let i = 0; i < 10; i++) {
      const middle = (inside + outside) / 2;
      if (sample(xAt(middle), zAt(middle)) >= FROST_CONTOUR) inside = middle; else outside = middle;
    }
    const x = xAt(inside), z = zAt(inside);
    const index = appendVertex(a, b, x, z, field.heightAt(x, z));
    crossings.set(key, index);
    return index;
  }
  for (let i = 0; i < layout.triangles.length; i += 3) {
    const triangle = layout.triangles.slice(i, i + 3), polygon = [];
    for (let j = 0; j < 3; j++) {
      const a = triangle[(j + 2) % 3], b = triangle[j];
      const aInside = coverage[a] >= FROST_CONTOUR, bInside = coverage[b] >= FROST_CONTOUR;
      if (aInside !== bInside) polygon.push(crossing(a, b));
      if (bInside) polygon.push(b);
    }
    for (let j = 1; j + 1 < polygon.length; j++) top.push(polygon[0], polygon[j], polygon[j + 1]);
  }
  for (let i = 0; i < top.length; i += 3) for (let j = 0; j < 3; j++) {
    const a = top[i + j], b = top[i + (j + 1) % 3], key = `${Math.min(a, b)}:${Math.max(a, b)}`;
    if (boundary.has(key)) boundary.delete(key); else boundary.set(key, [a, b]);
  }
  return { top, boundary, contourIndices: [...crossings.values()] };
}
