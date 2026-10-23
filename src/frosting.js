export const CAKE_TOP = 2.035;
export const CAKE_OFFSET = -0.8;
export const CAKE_RADIUS = 1.5;
export const CAKE_BEVEL = 0.07;
export const FLAT_RADIUS = CAKE_RADIUS - CAKE_BEVEL;
export const RIM_END = FLAT_RADIUS + CAKE_BEVEL * Math.PI / 2;
export const CAKE_BOTTOM = 0.9;
export const MAX_FROST_POINTS = 3000;
export const BRUSH_SPACING = 0.035;
export const COAT_THICKNESS = 0.115;
export const MAX_COAT_THICKNESS = 0.23;
export const COAT_EMBED = 0.0008;

const smooth = t => { const v = Math.max(0, Math.min(1, t)); return v * v * (3 - 2 * v); };

function radiusAtHeight(y) {
  let outside = 0;
  for (const [center, height, radius] of [[1.78, 0.51, 1.5], [1.455, 0.15, 1.51], [1.15, 0.5, 1.5]]) {
    const bottom = center - height / 2, top = center + height / 2, bevel = Math.min(0.07, height / 3);
    if (y < bottom - 1e-8 || y > top + 1e-8) continue;
    const cornerY = Math.max(bottom + bevel, Math.min(top - bevel, y));
    outside = Math.max(outside, radius - bevel + Math.sqrt(Math.max(0, bevel * bevel - (y - cornerY) ** 2)));
  }
  return outside;
}

const profile = [{ u: 0, r: 0, y: CAKE_TOP }, { u: FLAT_RADIUS, r: FLAT_RADIUS, y: CAKE_TOP }];
for (let i = 1; i <= 12; i++) {
  const angle = i / 12 * Math.PI / 2;
  const r = FLAT_RADIUS + CAKE_BEVEL * Math.sin(angle), y = CAKE_TOP - CAKE_BEVEL + CAKE_BEVEL * Math.cos(angle), previous = profile.at(-1);
  profile.push({ u: previous.u + Math.hypot(r - previous.r, y - previous.y), r, y });
}
const sideTop = CAKE_TOP - CAKE_BEVEL, sideRows = Math.ceil((sideTop - CAKE_BOTTOM) / 0.004);
for (let i = 1; i <= sideRows; i++) {
  const y = sideTop - (sideTop - CAKE_BOTTOM) * i / sideRows, r = radiusAtHeight(y), previous = profile.at(-1);
  profile.push({ u: previous.u + Math.hypot(r - previous.r, y - previous.y), r, y });
}
export const FROST_RADIUS = profile.at(-1).u;

export function edgeFalloff(x, z) {
  return 1 - smooth((Math.hypot(x, z) - (FROST_RADIUS - 0.14)) / 0.14);
}

export function brushPoints(from, to, radius = 0.28) {
  if (!to || !Number.isFinite(to.x) || !Number.isFinite(to.z)) return [];
  const distance = from ? Math.hypot(to.x - from.x, to.z - from.z) : 0;
  if (from && distance < BRUSH_SPACING) return [];
  const count = from ? Math.ceil(distance / BRUSH_SPACING) : 1;
  const angle = from ? Math.atan2(to.z - from.z, to.x - from.x) : 0;
  return Array.from({ length: count }, (_, i) => {
    const t = (i + 1) / count;
    return { x: from ? from.x + (to.x - from.x) * t : to.x, z: from ? from.z + (to.z - from.z) * t : to.z, radius, angle };
  }).filter(p => Math.hypot(p.x, p.z) <= FROST_RADIUS + radius * 0.5);
}

export function bladeCoverage(x, z, point) {
  const dx = x - point.x, dz = z - point.z;
  const along = (dx * Math.cos(point.angle) + dz * Math.sin(point.angle)) / (point.radius * 0.72);
  const across = (-dx * Math.sin(point.angle) + dz * Math.cos(point.angle)) / point.radius;
  const distance = Math.hypot(along, across);
  return 1 - smooth((distance - 0.58) / 0.42);
}

export function sampleCreamStroke(from, to, { remaining = 1, elapsed = 16, previousAngle = null, travelled = 0 } = {}) {
  const points = brushPoints(from, to);
  if (!points.length) return { points: [], remaining, travelled, angle: previousAngle };
  const distance = from ? Math.hypot(to.x - from.x, to.z - from.z) : 0;
  const angle = points.at(-1).angle;
  const turn = previousAngle == null ? 0 : Math.abs(Math.atan2(Math.sin(angle - previousAngle), Math.cos(angle - previousAngle))) / Math.PI;
  const speed = distance / Math.max(0.008, Math.min(0.5, elapsed / 1000));
  const density = 0.72 + 0.6 / (1 + speed * 0.28) + turn * 0.38;
  const used = from ? distance * density / 5.2 : 0.025;
  for (let i = 0; i < points.length; i++) {
    const t = (i + 1) / points.length;
    // A continuously replenished blade varies in load but never becomes unusable.
    const load = Math.max(0.68, remaining - used * t);
    points[i].amount = load * density * (from ? 0.96 + 0.04 * Math.sin((travelled + distance * t) * 4.5 + to.x * 3) : 1.1);
    points[i].load = load; points[i].speed = speed; points[i].turn = turn;
    points[i].radius *= 1 + turn * 0.1;
  }
  return { points, remaining: Math.max(0.68, remaining - used), travelled: travelled + distance, angle };
}

export function finishCreamStroke(stroke) {
  if (!stroke.points.length) return stroke;
  const points = [...stroke.points], last = points.at(-1);
  points[points.length - 1] = { ...last, amount: (last.amount ?? 1) * 1.15, finish: true };
  return { ...stroke, points };
}

export function creamContribution(x, z, point) {
  const coverage = bladeCoverage(x, z, point);
  const across = (-(x - point.x) * Math.sin(point.angle) + (z - point.z) * Math.cos(point.angle)) / point.radius;
  // A broad compressed bed and one low folded edge replace nozzle-like parallel ribs.
  const fold = 0.11 * Math.exp(-(((across - 0.48) / 0.38) ** 2));
  const depression = 0.045 * Math.exp(-((across / 0.55) ** 2));
  return coverage * (point.amount ?? 1) * (0.98 + fold - depression);
}

export function coatingHeight(coverage, x, z, angle = 0, mass = coverage) {
  const across = -x * Math.sin(angle) + z * Math.cos(angle);
  const knifeMark = 0.0025 * Math.sin(across * 10 + 0.3 * Math.sin(x * 2 + z * 3));
  const bulk = MAX_COAT_THICKNESS * (1 - Math.exp(-COAT_THICKNESS * mass / MAX_COAT_THICKNESS));
  const body = bulk * (0.975 + 0.025 * Math.sin(x * 6 + z * 5)) + knifeMark * Math.min(1, mass);
  return Math.min(MAX_COAT_THICKNESS, Math.max(0, body)) * smooth(coverage) * edgeFalloff(x, z);
}

export function frostingHeight(x, z, strokes = []) {
  let coverage = 0, angle = 0, mass = 0;
  for (const stroke of strokes) {
    let localMass = 0;
    for (const point of stroke.points) {
      const next = bladeCoverage(x, z, point), contribution = creamContribution(x, z, point);
      coverage = Math.max(coverage, next);
      if (contribution >= localMass && contribution > 0) { localMass = contribution; angle = point.angle; }
    }
    mass += localMass;
  }
  return coatingHeight(coverage, x, z, angle, mass);
}

// Arc length unfolds the real top, lip, filling seam and lower sponge into one disc.
export function cakeSurface(paintX, paintZ) {
  const distance = Math.hypot(paintX, paintZ);
  const dx = distance > 0 ? paintX / distance : 0, dz = distance > 0 ? paintZ / distance : 0;
  if (distance <= FLAT_RADIUS) return { x: paintX, y: CAKE_TOP, z: paintZ, nx: 0, ny: 1, nz: 0 };
  let lo = 1, hi = profile.length - 1;
  while (hi - lo > 1) { const middle = (lo + hi) >> 1; if (profile[middle].u < distance) lo = middle; else hi = middle; }
  const a = profile[lo], b = profile[hi], t = Math.max(0, Math.min(1, (distance - a.u) / (b.u - a.u)));
  const radius = a.r + (b.r - a.r) * t, y = a.y + (b.y - a.y) * t;
  const length = Math.hypot(b.r - a.r, b.y - a.y), nr = -(b.y - a.y) / length, ny = (b.r - a.r) / length;
  return { x: dx * radius, y, z: dz * radius, nx: dx * nr, ny, nz: dz * nr };
}

export function coatedSurface(x, z, height, surface = cakeSurface(x, z)) {
  const distance = Math.hypot(x, z);
  if (distance <= RIM_END || height <= 0) {
    return { x: surface.x + surface.nx * height, y: surface.y + surface.ny * height, z: surface.z + surface.nz * height };
  }
  // Dense frosting bridges sponge/filling bevels; it does not balloon along each seam normal.
  const radius = Math.hypot(surface.x, surface.z);
  const bridge = Math.max(0, CAKE_RADIUS - radius) * smooth(height / 0.035);
  const outerRadius = radius + bridge + height;
  return { x: x / distance * outerRadius, y: surface.y, z: z / distance * outerRadius };
}

export function toppingHeight(item, strokes) {
  const radius = 0.065 * item.scale;
  let height = frostingHeight(item.x, item.z, strokes);
  for (let i = 0; i < 6; i++) {
    const a = i / 6 * Math.PI * 2;
    height = Math.max(height, frostingHeight(item.x + Math.cos(a) * radius, item.z + Math.sin(a) * radius, strokes));
  }
  return CAKE_TOP + Math.max(0, height - COAT_EMBED) + 0.0005;
}
