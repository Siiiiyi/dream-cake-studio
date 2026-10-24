import * as THREE from 'three';

const palettes = {
  strawberry: ['#971827', '#c82f34', '#e45c38'],
  blueberry: ['#242c49', '#4b5878', '#909baa'],
  cherry: ['#471927', '#852c39', '#b84d49'],
  raspberry: ['#8d354e', '#ba586f', '#d5838c'],
  orange: ['#c7802f', '#e6a544', '#f5ca7a'],
};

export function colorFruitGeometry(geometry, kind) {
  const position = geometry.attributes.position;
  const colors = new Float32Array(position.count * 3);
  const [dark, mid, light] = palettes[kind].map(hex => new THREE.Color(hex));
  const color = new THREE.Color();
  for (let i = 0; i < position.count; i++) {
    const x = position.getX(i), y = position.getY(i), z = position.getZ(i);
    const patches = 0.5 + 0.19 * Math.sin(x * 16 + z * 9) * Math.cos(y * 17 - z * 8) + 0.11 * Math.sin(x * 35 - y * 21 + z * 28) + 0.08 * Math.cos(y * 62 + x * 17);
    const t = kind === 'strawberry'
      ? THREE.MathUtils.clamp(0.52 + 0.18 * Math.sin(x * 12 + z * 8) * Math.cos(y * 15) + 0.1 * Math.sin(y * 21 - z * 10) + 0.04 * Math.cos(x * 28 + y * 9), 0, 1)
      : THREE.MathUtils.clamp(patches, 0, 1);
    color.copy(t < 0.5 ? dark : mid).lerp(t < 0.5 ? mid : light, t < 0.5 ? t * 2 : (t - 0.5) * 2);
    if (kind === 'strawberry' && geometry.attributes.seedDepth) color.multiplyScalar(1 - Math.min(0.08, geometry.attributes.seedDepth.getX(i) / 0.0031 * 0.08));
    colors.set([color.r, color.g, color.b], i * 3);
  }
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  return geometry;
}

export function makeFruitGrain() {
  const size = 128, data = new Uint8Array(size * size * 4);
  let state = 681;
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    state = (state * 1664525 + 1013904223) >>> 0;
    const value = Math.round(140 + (state % 71) + 18 * Math.sin(x * 0.65) * Math.sin(y * 0.79));
    data.set([value, value, value, 255], (y * size + x) * 4);
  }
  const texture = new THREE.DataTexture(data, size, size);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.minFilter = texture.magFilter = THREE.LinearFilter;
  texture.needsUpdate = true;
  return texture;
}

export const STRAWBERRY_HEIGHT = 0.66;
export const STRAWBERRY_SEAT_HEIGHT = STRAWBERRY_HEIGHT * 0.96;

// Interpolate squared radius: both poles form rounded caps instead of conical spikes.
const strawberryProfile = [[0, 0], [0.04, 0.05], [0.15, 0.098], [0.3, 0.151], [0.5, 0.205], [0.67, 0.228], [0.79, 0.222], [0.9, 0.174], [0.97, 0.094], [1, 0]];
function strawberryRadius(t) {
  let i = 0;
  while (i < strawberryProfile.length - 2 && t > strawberryProfile[i + 1][0]) i++;
  const a = strawberryProfile[i], b = strawberryProfile[i + 1], span = b[0] - a[0];
  const slope = index => {
    const before = strawberryProfile[Math.max(0, index - 1)], after = strawberryProfile[Math.min(strawberryProfile.length - 1, index + 1)];
    const left = index > 0 ? (strawberryProfile[index][1] ** 2 - before[1] ** 2) / (strawberryProfile[index][0] - before[0]) : null;
    const right = index < strawberryProfile.length - 1 ? (after[1] ** 2 - strawberryProfile[index][1] ** 2) / (after[0] - strawberryProfile[index][0]) : null;
    if (left === null) return right;
    if (right === null) return left;
    return left * right <= 0 ? 0 : 2 * left * right / (left + right);
  };
  const u = (t - a[0]) / span, u2 = u * u, u3 = u2 * u;
  const squared = (2 * u3 - 3 * u2 + 1) * a[1] ** 2 + (u3 - 2 * u2 + u) * span * slope(i) + (-2 * u3 + 3 * u2) * b[1] ** 2 + (u3 - u2) * span * slope(i + 1);
  return Math.sqrt(Math.max(0, squared));
}

export function strawberryPoint(height, angle) {
  const t = THREE.MathUtils.clamp(height / STRAWBERRY_HEIGHT, 0, 1);
  const radius = strawberryRadius(t);
  const organic = 1 + 0.03 * Math.sin(angle * 3 + t * 4) + 0.017 * Math.cos(angle * 5 - t * 3);
  const heart = 1 + 0.055 * Math.cos(angle * 2) * Math.sin(Math.PI * t);
  const flesh = 0.001 * Math.sin(angle * 9 + t * 18) * Math.sin(angle * 7 - t * 13) * Math.sin(Math.PI * t);
  const r = radius * organic * heart + flesh;
  const shoulders = 0.01 * Math.cos(angle * 2) * Math.sin(Math.PI * t) * t;
  return new THREE.Vector3(r * Math.cos(angle) + 0.009 * t * t, height + shoulders, (radius * organic + flesh) * Math.sin(angle) * 0.98);
}

function strawberryNormal(h, angle) {
  const point = strawberryPoint(h, angle);
  const vertical = strawberryPoint(Math.min(STRAWBERRY_HEIGHT, h + 0.0005), angle).sub(strawberryPoint(Math.max(0, h - 0.0005), angle));
  const around = strawberryPoint(h, angle + 0.0005).sub(point);
  const normal = vertical.cross(around);
  return normal.lengthSq() > 1e-16 ? normal.normalize() : new THREE.Vector3(0, h < STRAWBERRY_HEIGHT / 2 ? -1 : 1, 0);
}

export function strawberrySeeds() {
  const seeds = [];
  for (let row = 0; row < 13; row++) {
    const h = STRAWBERRY_HEIGHT * (0.06 + row * 0.07);
    const r = Math.hypot(strawberryPoint(h, 0).x, strawberryPoint(h, 0).z);
    const count = Math.round(Math.PI * 2 * r / 0.083);
    for (let i = 0; i < count; i++) {
      const a = i / count * Math.PI * 2 + row * 0.61 + 0.1 * Math.sin(i * 7.3 + row * 3.7);
      const height = h + 0.009 * Math.sin(i * 9.1 + row * 4.2);
      seeds.push({ point: strawberryPoint(height, a), normal: strawberryNormal(height, a), size: 0.78 + 0.3 * (0.5 + 0.5 * Math.sin(i * 4.7 + row)), tilt: 0.32 * Math.sin(i * 3.2 + row) });
    }
  }
  return seeds;
}

export function makeStrawberryGeometry(seeds) {
  const rows = 80, sides = 96, positions = [], uvs = [], indices = [], depths = [];
  for (let row = 0; row <= rows; row++) for (let side = 0; side <= sides; side++) {
    const h = row / rows * STRAWBERRY_HEIGHT, angle = side / sides * Math.PI * 2;
    const point = strawberryPoint(h, angle);
    let indentation = 0;
    for (const seed of seeds) {
      const distance = point.distanceToSquared(seed.point);
      if (distance < 0.0005) indentation += 0.004 * Math.exp(-distance / 0.0001);
    }
    const normal = strawberryNormal(h, angle);
    point.addScaledVector(normal, -indentation);
    positions.push(point.x, point.y, point.z); uvs.push(side / sides, row / rows);
    depths.push(indentation);
    if (row < rows && side < sides) {
      const a = row * (sides + 1) + side, b = a + sides + 1;
      indices.push(a, b, a + 1, a + 1, b, b + 1);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setAttribute('seedDepth', new THREE.Float32BufferAttribute(depths, 1));
  geometry.setIndex(indices); geometry.computeVertexNormals();
  return colorFruitGeometry(geometry, 'strawberry');
}

export function makeStandingStrawberryGeometry(seeds) {
  const geometry = makeStrawberryGeometry(seeds);
  const position = geometry.attributes.position;
  // Flatten only the former stem cap: after inversion it is a broad, closed support face.
  for (let i = 0; i < position.count; i++) {
    position.setY(i, Math.min(position.getY(i), STRAWBERRY_SEAT_HEIGHT));
  }
  position.needsUpdate = true;
  geometry.computeVertexNormals();
  return geometry;
}

export function makeBerryGeometry(kind) {
  const geometry = new THREE.SphereGeometry(1, kind === 'raspberry' ? 16 : 56, kind === 'raspberry' ? 12 : 40);
  const p = geometry.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const uneven = 1 + 0.025 * Math.sin(x * 7 + z * 4) * Math.cos(y * 5 - z * 6);
    if (kind === 'blueberry') {
      const radial = Math.hypot(x, z);
      p.setXYZ(i, x * 0.151 * uneven, (y + 1) * 0.137 - (y > 0.5 ? 0.031 * Math.exp(-((radial / 0.36) ** 2)) : 0), z * 0.143 * uneven);
    } else if (kind === 'cherry') {
      const radial = Math.hypot(x, z);
      p.setXYZ(i, x * 0.184 * uneven + y * 0.008, (y + 1) * 0.168 - (y > 0.4 ? 0.023 * Math.exp(-((radial / 0.32) ** 2)) + 0.006 * Math.exp(-((x / 0.2) ** 2)) : 0), z * 0.177 * uneven);
    } else p.setXYZ(i, x * uneven, y * uneven, z * uneven);
  }
  geometry.computeVertexNormals();
  return colorFruitGeometry(geometry, kind);
}
